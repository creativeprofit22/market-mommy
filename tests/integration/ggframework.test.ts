import assert from 'node:assert/strict';
import childProcess, { spawnSync } from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import { Server } from 'node:net';
import { DomainError } from '../../src/domain/errors.js';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { setTimeout as delay } from 'node:timers/promises';
import test, { type TestContext } from 'node:test';
import { SqliteStorage } from '../../src/adapters/sqlite/client.js';
import { runNextFixture, type RunFixtureOptions } from '../../src/adapters/ggframework/runner.js';
import { evidenceTools } from '../../src/adapters/ggframework/tools.js';
import { validateFixtureOutput } from '../../src/adapters/ggframework/validation.js';
import { denyLiveProvider } from '../../src/adapters/providers/policy.js';
import type { Job } from '../../src/domain/job.js';
import type { WorkflowRequest } from '../../src/application/workflow.js';
import type { FixtureResult } from '../../src/domain/fixture-result.js';
import * as f from '../helpers/records.js';

let sequence = 0;
const requestId = () => `framework-${++sequence}`;
const output: FixtureResult = { scope: 'synthetic-fixture', label: 'Deterministic synthetic fixture; not market research.', evidence: [] };
async function command(store: SqliteStorage, value: object) {
  const result = await store.dispatch(JSON.stringify({ requestId: requestId(), ...value }));
  assert.equal(result.status, 'ok', JSON.stringify(result)); return result;
}
async function journey(store: SqliteStorage) {
  const record = await store.read('J'); assert.equal(record?.kind, 'journey');
  if (record?.kind !== 'journey') throw new Error('Missing Journey'); return record.data;
}
async function job(store: SqliteStorage, id: string) {
  const record = await store.read(id); assert.equal(record?.kind, 'job');
  if (record?.kind !== 'job') throw new Error('Missing job'); return record.data;
}
function sql(path: string, statement: string) {
  const db = new DatabaseSync(path); try { return db.prepare(statement).all(); } finally { db.close(); }
}
function exec(path: string, statement: string) {
  const db = new DatabaseSync(path); try { db.exec(statement); } finally { db.close(); }
}
async function fixture(t: TestContext) {
  const root = await mkdtemp(join(tmpdir(), 'market-mommy-framework-')); const path = join(root, 'fixture.sqlite');
  const store = await SqliteStorage.open(path, ['read', 'fixture-write', 'fixture-run', 'cancel']);
  t.after(async () => { await store.close(); await rm(root, { recursive: true, force: true }); });
  await command(store, { action: 'saveProfile', profileId: 'P', expectedVersion: 0, profile: f.profile });
  await command(store, { action: 'createJourney', journeyId: 'J', profileId: 'P', profileVersion: 1, expectedVersion: 0, priorLearning: [] });
  return { store, path };
}
async function evidence(store: SqliteStorage, version = 0) {
  await command(store, { action: 'acceptFixtureEvidence', journeyId: 'J', expectedVersion: (await journey(store)).version,
    expectedObservationVersion: version, expectedEvidenceVersion: version, observationId: 'O', evidenceId: 'E',
    observation: { ...f.observation, statement: `Synthetic version ${version + 1}` },
    evidence: { ...f.evidence, observation: { id: 'O', version: version + 1 } } });
}
async function enqueue(store: SqliteStorage, limits = f.limits) {
  await command(store, { action: 'enqueueJob', journeyId: 'J', expectedVersion: (await journey(store)).version, limits });
  return job(store, (await journey(store)).jobIds.at(-1)!);
}
async function running(store: SqliteStorage, id: string) {
  const until = Date.now() + 10000;
  while (Date.now() < until) { if ((await job(store, id)).state === 'running') return; await delay(20); }
  assert.fail('Job did not become running');
}
function settlement(j: Job) {
  return { action: 'settle', jobId: j.id, journeyId: j.journeyId, ownerId: 'test-owner', fence: j.fence,
    state: 'succeeded', actualMinorUnits: 0, providerRequestId: null, validatedResult: output } as const;
}

for (const capabilities of [['fixture-run'], ['read']] as const) {
  test(`${capabilities.join('+')} runner scope rejects before durable mutation or executor launch`, async t => {
    const { store, path } = await fixture(t); const queued = await enqueue(store);
    const savedJourney = await journey(store);
    await store.close();
    const snapshot = () => ({
      records: sql(path, 'SELECT * FROM record_versions ORDER BY id, version'),
      claim: sql(path, 'SELECT * FROM workflow_claim'),
      ledger: sql(path, 'SELECT * FROM workflow_ledger ORDER BY sequence'),
      receipts: sql(path, 'SELECT * FROM request_receipts ORDER BY request_id'),
      workflowReceipts: sql(path, 'SELECT * FROM workflow_receipts ORDER BY request_id'),
      results: sql(path, 'SELECT * FROM workflow_results'),
    });
    const before = snapshot();
    const restricted = await SqliteStorage.open(path, capabilities);
    const launches = t.mock.method(childProcess, 'spawn', () => { throw new Error('Unexpected child launch'); });
    const listeners = t.mock.method(Server.prototype, 'listen', () => { throw new Error('Unexpected provider launch'); });
    syncBuiltinESMExports();
    const progress: string[] = [];
    try {
      await assert.rejects(runNextFixture(restricted, { onProgress: event => progress.push(event) }), error => {
        assert.ok(error instanceof DomainError);
        assert.equal(error.code, 'unauthorized');
        assert.equal(error.message, 'This entry point does not have permission for that action.');
        return true;
      });
      assert.equal(launches.mock.callCount(), 0); assert.equal(listeners.mock.callCount(), 0);
      assert.deepEqual(progress, []);
      assert.deepEqual(snapshot(), before);
    } finally {
      launches.mock.restore(); listeners.mock.restore(); syncBuiltinESMExports();
      await restricted.close();
    }
    const reader = await SqliteStorage.open(path, ['read']);
    try {
      assert.deepEqual(await job(reader, queued.id), queued);
      assert.deepEqual(await journey(reader), savedJourney);
    } finally { await reader.close(); }
  });
}

test('read+fixture-run scope executes queued work without write or cancel capabilities', async t => {
  const { store, path } = await fixture(t); const queued = await enqueue(store); await store.close();
  const runner = await SqliteStorage.open(path, ['read', 'fixture-run']);
  try {
    const result = await runNextFixture(runner);
    assert.equal(result.status, 'settled'); assert.equal(result.job.id, queued.id);
    assert.equal(result.job.state, 'succeeded'); assert.equal(result.metrics.requests, 1);
    assert.deepEqual(result.output, output);
    assert.equal((await journey(runner)).costs.outstandingMinorUnits, '0');
  } finally { await runner.close(); }
});

test('actual AgentLoop reads nonempty immutable evidence and atomically persists validated output', async t => {
  const { store, path } = await fixture(t); await evidence(store); const queued = await enqueue(store);
  await evidence(store, 1);
  const result = await runNextFixture(store, { scenario: 'read-evidence' });
  assert.equal(result.status, 'settled');
  assert.equal(result.job.state, 'succeeded'); assert.equal(result.job.id, queued.id);
  assert.deepEqual(result.output, { ...output, evidence: [{ id: 'E', version: 1 }] });
  assert.equal(result.toolCalls, 1); assert.equal(result.turns, 2); assert.equal(result.metrics.requests, 2);
  assert.equal(result.forcedKill, false); assert.equal(result.frameworkRetries, 0);
  assert.deepEqual(JSON.parse(String(sql(path, 'SELECT result FROM workflow_results')[0]?.result)), result.output);
  assert.equal((await job(store, queued.id)).state, 'succeeded');
  assert.equal((await journey(store)).costs.outstandingMinorUnits, '0');
  assert.equal(sql(path, 'SELECT job_id FROM workflow_claim')[0]?.job_id, null);
});

test('actual framework internal retries are observable in the owned HTTP protocol', { timeout: 45000 }, async t => {
  const { store } = await fixture(t); await enqueue(store);
  const result = await runNextFixture(store, { scenario: 'retry-responses' });
  assert.notEqual(result.status, 'no-job'); if (result.status === 'no-job') return;
  assert.equal(result.job.state, 'succeeded'); assert.equal(result.metrics.retryResponses, 3);
  assert.equal(result.metrics.requests, 4); assert.ok(result.frameworkRetries > 0);
  assert.equal(result.turns, 1); assert.deepEqual(result.output, output);
});

for (const scenario of ['malformed-output', 'excessive-output'] as const) {
  test(`${scenario} fails safely without a persisted result`, async t => {
    const { store, path } = await fixture(t); await enqueue(store, { ...f.limits, outputBytes: 4096 });
    const result = await runNextFixture(store, { scenario });
    assert.equal(result.status, 'settled');
    assert.equal(result.job.state, 'failed'); assert.equal(result.output, undefined);
    assert.equal(sql(path, 'SELECT * FROM workflow_results').length, 0);
    assert.ok(result.metrics.requests > 0); assert.ok(result.metrics.responseBytes <= f.limits.outputBytes * 2);
    assert.ok(Buffer.byteLength(JSON.stringify(result)) < 8192);
  });
}

test('caller turns=1 prevents a second provider turn after the evidence tool', async t => {
  const { store, path } = await fixture(t); await evidence(store); await enqueue(store, { ...f.limits, turns: 1 });
  const result = await runNextFixture(store, { scenario: 'read-evidence' });
  assert.equal(result.status, 'settled');
  assert.equal(result.job.state, 'failed'); assert.equal(result.metrics.requests, 1);
  assert.ok(result.turns <= 1); assert.equal(result.output, undefined);
  assert.equal(sql(path, 'SELECT * FROM workflow_results').length, 0);
});

function observedRun(store: SqliteStorage, scenario: 'delayed-stream' | 'noncooperative-worker', signal: AbortSignal) {
  let reached!: () => void;
  const progress = new Promise<void>(resolve => { reached = resolve; });
  const pending = runNextFixture(store, { scenario, signal, onProgress: event => {
    if (event === (scenario === 'noncooperative-worker' ? 'worker-ready' : 'provider-request')) reached();
  } });
  const ready = Promise.race([progress, pending.then(() => { throw new Error('Worker ended before requested readiness'); })]);
  return { pending, ready };
}

for (const durable of [false, true]) {
  test(`${durable ? 'durable command' : 'AbortSignal'} cancels a running delayed stream and releases the owned executor`, async t => {
    const { store, path } = await fixture(t); const queued = await enqueue(store); const controller = new AbortController();
    const { pending, ready } = observedRun(store, 'delayed-stream', controller.signal);
    t.after(() => controller.abort()); await ready;
    assert.equal((await job(store, queued.id)).state, 'running');
    if (durable) await command(store, { action: 'cancelJob', journeyId: 'J', expectedVersion: (await journey(store)).version, jobId: queued.id });
    else controller.abort();
    const result = await pending; assert.equal(result.status, 'settled');
    assert.ok(result.metrics.requests >= 1, 'Cancellation must interrupt an actual provider request');
    assert.equal(result.job.state, 'cancelled'); assert.equal(result.output, undefined);
    assert.equal(sql(path, 'SELECT * FROM workflow_results').length, 0);
    assert.equal(sql(path, 'SELECT job_id FROM workflow_claim')[0]?.job_id, null);
    await enqueue(store); const next = await runNextFixture(store); assert.notEqual(next.status, 'no-job');
    if (next.status !== 'no-job') assert.equal(next.job.state, 'succeeded');
  });
}

test('cancellation accepted after fixture completion wins final settlement and releases the executor', async t => {
  const { store, path } = await fixture(t); const queued = await enqueue(store);
  const other = await SqliteStorage.open(path, ['read', 'cancel']);
  const reached = Promise.withResolvers<Extract<WorkflowRequest, { action: 'settle' }>>();
  const release = Promise.withResolvers<void>();
  const pending = runNextFixture({
    read: store.read.bind(store), append: store.append.bind(store), info: store.info.bind(store), close: store.close.bind(store),
    workflow: async request => {
      if (request.action === 'settle') { reached.resolve(request); await release.promise; }
      return store.workflow(request);
    },
  });
  let request: Extract<WorkflowRequest, { action: 'settle' }>;
  try {
    request = await Promise.race([reached.promise, pending.then(() => { throw new Error('Runner ended before settlement'); })]);
    assert.equal(request.state, 'succeeded'); assert.deepEqual(request.validatedResult, output);
    await command(other, { action: 'cancelJob', journeyId: 'J', expectedVersion: (await journey(other)).version, jobId: queued.id });
    assert.equal((await job(other, queued.id)).state, 'cancel-requested');
  } finally {
    release.resolve();
    try { await pending; } finally { await other.close(); }
  }
  const result = await pending;
  assert.equal(result.status, 'settled');
  assert.equal(result.job.state, 'cancelled'); assert.equal(result.output, undefined);
  assert.equal(result.metrics.requests, 1); assert.equal(result.forcedKill, false);
  assert.deepEqual(result.job, await job(store, queued.id));
  assert.equal(result.job.billing, 'known'); assert.equal(result.job.actualMinorUnits, '0'); assert.equal(result.job.reservedMinorUnits, '0');
  assert.equal(sql(path, 'SELECT * FROM workflow_results').length, 0);
  assert.equal(sql(path, 'SELECT job_id FROM workflow_claim')[0]?.job_id, null);
  assert.deepEqual((await journey(store)).costs, { actualMinorUnits: '0', outstandingMinorUnits: '0', unknownMinorUnits: '0' });
  const ledger = sql(path, 'SELECT * FROM workflow_ledger');
  assert.deepEqual(await store.workflow(request), [result.job]);
  assert.deepEqual(sql(path, 'SELECT * FROM workflow_ledger'), ledger);
  assert.equal(sql(path, 'SELECT * FROM workflow_results').length, 0);
  await assert.rejects(store.workflow({ ...request, state: 'cancelled' }), { code: 'conflict' });
  const next = await enqueue(store);
  const [claimed] = await store.workflow({ action: 'claim', ownerId: 'next-owner', leaseMs: 120000 });
  assert.equal(claimed?.id, next.id);
});

test('three real framework launch/cancel cycles return owned process and network resources to baseline', { timeout: 25000 }, async t => {
  const { store, path } = await fixture(t);
  // Count handle classes owned by the runner, not heap usage or performance.
  const ownedTypes = ['ProcessWrap', 'PipeWrap', 'TCPServerWrap', 'TCPSocketWrap', 'TCPConnectWrap'];
  const resources = () => {
    const active = process.getActiveResourcesInfo();
    return Object.fromEntries(ownedTypes.map(type => [type, active.filter(value => value === type).length]));
  };
  const baseline = resources();
  for (let cycle = 0; cycle < 3; cycle++) {
    const queued = await enqueue(store); const controller = new AbortController();
    const { pending, ready } = observedRun(store, 'delayed-stream', controller.signal);
    t.after(async () => { controller.abort(); await pending; });
    try {
      await ready;
      assert.equal((await job(store, queued.id)).state, 'running');
    } finally { controller.abort(); }
    const result = await pending;
    assert.equal(result.status, 'settled'); assert.equal(result.job.state, 'cancelled');
    assert.ok(result.metrics.requests >= 1);
    assert.equal(sql(path, 'SELECT job_id FROM workflow_claim')[0]?.job_id, null);
    const until = Date.now() + 3000;
    let current = resources();
    while (ownedTypes.some(type => current[type]! > baseline[type]!) && Date.now() < until) {
      await delay(25); current = resources();
    }
    for (const type of ownedTypes) assert.ok(current[type]! <= baseline[type]!, `${type} leaked after cycle ${cycle + 1}: ${JSON.stringify({ baseline, current })}`);
  }
  assert.equal(sql(path, 'SELECT * FROM workflow_results').length, 0);
  await enqueue(store); const next = await runNextFixture(store);
  assert.equal(next.status, 'settled'); assert.equal(next.job.state, 'succeeded');
});

test('deadline stops a delayed stream and quarantines its expired fence', { timeout: 15000 }, async t => {
  const { store, path } = await fixture(t); const queued = await enqueue(store, { ...f.limits, deadlineMs: 2000 });
  const start = Date.now(); const result = await runNextFixture(store, { scenario: 'delayed-stream' });
  assert.equal(result.status, 'fence-lost'); assert.ok(Date.now() - start < 8000);
  assert.equal((await job(store, queued.id)).state, 'reconciliation-required');
  assert.deepEqual(result.job, await job(store, queued.id));
  assert.equal(result.output, undefined);
  assert.deepEqual((await journey(store)).costs, { actualMinorUnits: '0', outstandingMinorUnits: '25', unknownMinorUnits: '25' });
  assert.deepEqual(await store.workflow({ action: 'claim', ownerId: 'next-owner', leaseMs: 120000 }), []);
  assert.equal(sql(path, 'SELECT * FROM workflow_results').length, 0);
  assert.equal(sql(path, 'SELECT job_id FROM workflow_claim')[0]?.job_id, null);
});

test('noncooperative live child is force-killed before cancellation returns', { timeout: 15000 }, async t => {
  const { store, path } = await fixture(t); const queued = await enqueue(store); const controller = new AbortController();
  const { pending, ready } = observedRun(store, 'noncooperative-worker', controller.signal);
  t.after(() => controller.abort()); await ready;
  assert.equal((await job(store, queued.id)).state, 'running');
  controller.abort(); const result = await pending;
  assert.equal(result.status, 'settled');
  assert.equal(result.forcedKill, true); assert.equal(result.job.state, 'cancelled');
  assert.equal(sql(path, 'SELECT job_id FROM workflow_claim')[0]?.job_id, null);
  await enqueue(store); const next = await runNextFixture(store);
  assert.notEqual(next.status, 'no-job'); if (next.status !== 'no-job') assert.equal(next.job.state, 'succeeded');
});

test('no-job, live deny and unknown runner options fail closed without claiming work', async t => {
  const { store } = await fixture(t); assert.deepEqual(await runNextFixture(store), { status: 'no-job' });
  assert.throws(denyLiveProvider, { code: 'policy-denied' }); const queued = await enqueue(store);
  await assert.rejects(runNextFixture(store, { scenario: 'success', baseUrl: 'http://hostile.invalid' } as RunFixtureOptions));
  await assert.rejects(runNextFixture(store, { scenario: 'unknown' } as unknown as RunFixtureOptions));
  assert.equal((await job(store, queued.id)).state, 'queued');
});

test('hostile inherited environment is absent from the actual worker and safe outputs/errors', async t => {
  const { store, path } = await fixture(t); const sentinel = 'synthetic-secret-sentinel-never-in-worker';
  const previous = process.env.MARKET_MOMMY_HOSTILE_SECRET; process.env.MARKET_MOMMY_HOSTILE_SECRET = sentinel;
  t.after(() => { if (previous === undefined) delete process.env.MARKET_MOMMY_HOSTILE_SECRET; else process.env.MARKET_MOMMY_HOSTILE_SECRET = previous; });
  await enqueue(store); const result = await runNextFixture(store);
  assert.equal(result.status, 'settled');
  assert.equal(result.job.state, 'succeeded');
  // Windows populates these keys even in a fresh Node child explicitly spawned with env:{}.
  // Verify that platform behavior independently rather than allowing an arbitrary nonzero count.
  const probe = spawnSync(process.execPath, ['-e', 'console.log(JSON.stringify(Object.keys(process.env).sort()))'], { env: {}, encoding: 'utf8' });
  assert.equal(probe.status, 0);
  const automaticKeys: unknown = JSON.parse(probe.stdout);
  assert.deepEqual(automaticKeys, process.platform === 'win32'
    ? ['HOMEDRIVE', 'HOMEPATH', 'LOGONSERVER', 'PATH', 'SYSTEMDRIVE', 'SYSTEMROOT', 'TEMP', 'USERDOMAIN', 'USERNAME', 'USERPROFILE', 'WINDIR'] : []);
  assert.ok(Array.isArray(automaticKeys));
  assert.equal(result.environmentKeyCount, automaticKeys.length);
  assert.equal(JSON.stringify(result).includes(sentinel), false);
  const denied = await store.dispatch(JSON.stringify({ action: 'enqueueJob', requestId: requestId(), journeyId: 'J', expectedVersion: (await journey(store)).version, limits: f.limits, apiKey: sentinel }));
  assert.equal(denied.status, 'error'); assert.equal(JSON.stringify(denied).includes(sentinel), false);
  await enqueue(store); const failed = await runNextFixture(store, { scenario: 'malformed-output' });
  assert.equal(failed.status, 'settled'); assert.equal(failed.job.state, 'failed');
  assert.equal(JSON.stringify(failed).includes(sentinel), false);
  const destination = `${path}.export.json`;
  await store.administer({ action: 'export', destination });
  // Fixture-only containment: the sentinel was inherited, never manually saved as data.
  assert.equal((await readFile(destination, 'utf8')).includes(sentinel), false);
});

test('validated result settlement rolls back all writes, replays exactly, and rejects stale fences', async t => {
  const { store, path } = await fixture(t); await enqueue(store);
  const [claimed] = await store.workflow({ action: 'claim', ownerId: 'test-owner', leaseMs: 120000 }); assert.ok(claimed);
  const request = settlement(claimed); const before = await journey(store);
  const ledger = sql(path, 'SELECT * FROM workflow_ledger');
  exec(path, "CREATE TRIGGER reject_result_receipt BEFORE INSERT ON workflow_receipts BEGIN SELECT RAISE(ABORT,'fixture'); END");
  await assert.rejects(store.workflow(request), { code: 'storage-failure' });
  assert.equal(sql(path, 'SELECT * FROM workflow_results').length, 0);
  assert.deepEqual(await job(store, claimed.id), claimed); assert.deepEqual(await journey(store), before);
  assert.deepEqual(sql(path, 'SELECT * FROM workflow_ledger'), ledger);
  assert.equal(sql(path, 'SELECT job_id FROM workflow_claim')[0]?.job_id, claimed.id);
  exec(path, 'DROP TRIGGER reject_result_receipt');
  const settled = await store.workflow(request); const rows = sql(path, 'SELECT * FROM workflow_results');
  assert.equal(rows.length, 1); assert.deepEqual(JSON.parse(String(rows[0]?.result)), output);
  assert.deepEqual(await store.workflow(request), settled); assert.deepEqual(sql(path, 'SELECT * FROM workflow_results'), rows);
  await assert.rejects(store.workflow({ ...request, validatedResult: { ...output, evidence: [{ id: 'E', version: 1 }] } }), { code: 'conflict' });
  assert.throws(() => exec(path, "UPDATE workflow_results SET result='{}'"));
  assert.throws(() => exec(path, 'DELETE FROM workflow_results'));
  await enqueue(store); const [stale] = await store.workflow({ action: 'claim', ownerId: 'test-owner', leaseMs: 120000 }); assert.ok(stale);
  exec(path, "UPDATE workflow_claim SET expires_at='2000-01-01T00:00:00.000Z'");
  await assert.rejects(store.workflow(settlement(stale)), { code: 'conflict' });
  assert.deepEqual(sql(path, 'SELECT * FROM workflow_results'), rows);
  assert.equal((await job(store, stale.id)).state, 'reconciliation-required');
});

test('evidence tool has only immutable allowlisted access and enforces call and byte limits', async t => {
  const { store } = await fixture(t); await evidence(store); const queued = await enqueue(store);
  const record = await store.read('E'); assert.ok(record); const saved = JSON.stringify(record);
  let aborted = 0; const tools = evidenceTools({ ...queued, limits: { ...queued.limits, toolCalls: 1 } }, [record], () => { aborted++; });
  assert.deepEqual(tools.tools.map(tool => tool.name), ['read_evidence']);
  const tool = tools.tools[0]!; assert.equal(tool.executionMode, 'sequential'); assert.equal(tool.timeoutMs, queued.limits.toolTimeoutMs);
  const context = { signal: new AbortController().signal } as Parameters<typeof tool.execute>[1];
  record.data.version = 99;
  assert.equal(await tool.execute({ id: 'E', version: 1 }, context), saved);
  await assert.rejects(async () => tool.execute({ id: 'E', version: 1 }, context), /Evidence tool denied/); assert.equal(aborted, 1);
  const original = await store.read('E'); assert.ok(original);
  const allowed = evidenceTools(queued, [original], () => { aborted++; }).tools[0]!;
  await assert.rejects(async () => allowed.execute({ id: 'P', version: 1 }, context), /Evidence tool denied/);
  await assert.rejects(async () => allowed.execute({ id: 'E', version: 2 }, context), /Evidence tool denied/);
  const huge = structuredClone(original); if (huge.kind !== 'evidence') assert.fail('Missing evidence');
  huge.data.supportedClaim = 'x'.repeat(8193);
  const oversized = evidenceTools(queued, [huge], () => { aborted++; }).tools[0]!;
  await assert.rejects(async () => oversized.execute({ id: 'E', version: 1 }, context), /Evidence tool denied/);
  const medium = structuredClone(original); if (medium.kind !== 'evidence') assert.fail('Missing evidence');
  medium.data.supportedClaim = 'x'.repeat(6000);
  assert.ok(Buffer.byteLength(JSON.stringify(medium)) < 8192);
  const aggregate = evidenceTools(queued, [medium], () => { aborted++; }); const aggregateTool = aggregate.tools[0]!;
  await aggregateTool.execute({ id: 'E', version: 1 }, context);
  await aggregateTool.execute({ id: 'E', version: 1 }, context);
  await assert.rejects(async () => aggregateTool.execute({ id: 'E', version: 1 }, context), /Evidence tool denied/);
  aggregate.resetTurn(); assert.equal(await aggregateTool.execute({ id: 'E', version: 1 }, context), JSON.stringify(medium));
  const cancelled = new AbortController(); cancelled.abort();
  await assert.rejects(async () => allowed.execute({ id: 'E', version: 1 }, { ...context, signal: cancelled.signal }), /Evidence tool denied/);
  assert.throws(() => evidenceTools({ ...queued, inputVersions: [] }, [original], () => {}), /Invalid snapshot/);
  assert.throws(() => validateFixtureOutput(JSON.stringify({ ...output, evidence: [{ id: 'E', version: 2 }] }), [{ id: 'E', version: 1 }], 4096));
  assert.throws(() => validateFixtureOutput(JSON.stringify({ ...output, evidence: [{ id: 'E', version: 1 }, { id: 'E', version: 1 }] }), [{ id: 'E', version: 1 }], 4096));
});

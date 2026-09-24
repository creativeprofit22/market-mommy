import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { backup, DatabaseSync } from 'node:sqlite';
import test, { type TestContext } from 'node:test';
import { SqliteStorage } from '../../src/adapters/sqlite/client.js';
import type { DispatchResult } from '../../src/application/dispatch.js';
import { cli, mcp, raw, sentinel } from '../helpers/interfaces.js';
import * as f from '../helpers/records.js';

async function fixture(t: TestContext) {
  const cwd = await mkdtemp(join(tmpdir(), 'market-mommy-interfaces-'));
  const cleanup: (() => Promise<void>)[] = [];
  t.after(async () => { try { for (const close of cleanup.reverse()) await close(); } finally { await rm(cwd, { recursive: true, force: true }); } });
  return { cwd, path: join(cwd, 'shared.sqlite'), cleanup };
}
function ok(r: DispatchResult) { assert.equal(r.status, 'ok', JSON.stringify(r)); if (r.status !== 'ok') throw new Error('Expected success'); return r.data; }
function error(r: DispatchResult, code: string) { assert.equal(r.status, 'error', JSON.stringify(r)); if (r.status === 'error') assert.equal(r.error.code, code); }
const profile = { action: 'saveProfile', requestId: 'profile', profileId: 'P', expectedVersion: 0, profile: f.profile };
const resume = { action: 'resumeJourney', journeyId: 'J' };
const names = ['saveProfile', 'createJourney', 'resumeJourney', 'acceptFixtureEvidence', 'reuseFixtureEvidence', 'saveFixtureAdvice', 'startExperiment', 'recordOutcome', 'enqueueJob', 'cancelJob', 'collectEvidence', 'recommendDirections', 'prepareOffer'].sort();

test('real CLI/MCP alternate shared writes, then replay original receipts from SQLite backup copies without normalization', async t => {
  const { cwd, path, cleanup } = await fixture(t);
  const peer = await mcp(path, cwd); cleanup.push(() => peer.close());
  const receipts: { command: Record<string, unknown>; result: DispatchResult }[] = [];
  let version = 0;
  async function write(command: Record<string, unknown>) {
    const result = receipts.length % 2 ? await peer.call(command) : await cli(path, cwd, command);
    const data = ok(result); receipts.push({ command, result });
    const j = data.records.find(r => r.kind === 'journey' && r.data.id === 'J');
    if (j) version = j.data.version;
    if (version) {
      const reader = await SqliteStorage.open(path, ['read']);
      try {
        const saved = await reader.dispatch(JSON.stringify(resume));
        assert.deepEqual(await cli(path, cwd, resume, false), saved);
        assert.deepEqual(await peer.call(resume), saved);
      } finally { await reader.close(); }
    }
    return data;
  }
  const journeyWrite = (action: string, extra: Record<string, unknown>) => ({ action, requestId: `receipt-${receipts.length}`, journeyId: 'J', expectedVersion: version, ...extra });
  await write(profile);
  await write({ action: 'createJourney', requestId: 'journey', journeyId: 'J', expectedVersion: 0, profileId: 'P', profileVersion: 1, priorLearning: [] });
  await write(journeyWrite('acceptFixtureEvidence', { observationId: 'O', evidenceId: 'EV', expectedObservationVersion: 0, expectedEvidenceVersion: 0, observation: f.observation, evidence: { ...f.evidence, observation: { id: 'O', version: 1 } } }));
  await write(journeyWrite('saveFixtureAdvice', { expectedRecordVersion: 0, record: { kind: 'interpretation', data: { ...f.interpretation, id: 'I', journeyId: 'J', profile: { id: 'P', version: 1 }, evidence: [{ id: 'EV', version: 1 }] } } }));
  await write(journeyWrite('saveFixtureAdvice', { expectedRecordVersion: 0, record: { kind: 'recommendation', data: { ...f.recommendation, id: 'R', journeyId: 'J', profile: { id: 'P', version: 1 }, evidence: [{ id: 'EV', version: 1 }], decision: { kind: 'action', buyer: 'Synthetic buyer', problem: 'Fixture problem', action: 'Manual test', fit: 'Fixture only', economicAssumptions: ['Unknown'], experiment: 'Manual fixture', successConditions: ['One observation'], stopConditions: ['No access'], changesAdvice: ['Correction'] } } } }));
  await write(journeyWrite('saveFixtureAdvice', { expectedRecordVersion: 0, record: { kind: 'offer', data: { ...f.offer, id: 'OFF', journeyId: 'J', recommendation: { id: 'R', version: 1 } } } }));
  await write(journeyWrite('startExperiment', { experimentId: 'E', baseline: { ...f.baseline, recommendation: { id: 'R', version: 1 }, offer: { id: 'OFF', version: 1 } } }));
  await write(journeyWrite('recordOutcome', { outcomeId: 'OUT', outcome: { experimentId: 'E', event: { kind: 'conversation', description: 'Synthetic only' }, occurredAt: f.now, provenance: 'synthetic-self-report', supersedes: null } }));
  const queued = await write(journeyWrite('enqueueJob', { limits: f.limits }));
  const job = queued.records.find(r => r.kind === 'job'); assert.ok(job && job.kind === 'job'); assert.equal(job.data.state, 'queued'); assert.equal(job.data.version, 1);
  const cancelled = await write(journeyWrite('cancelJob', { jobId: job.data.id }));
  const terminal = cancelled.records.find(r => r.kind === 'job'); assert.ok(terminal && terminal.kind === 'job'); assert.equal(terminal.data.state, 'cancelled'); assert.equal(terminal.data.id, job.data.id); assert.equal(terminal.data.attemptId, job.data.attemptId); assert.equal(terminal.data.version, 2);
  await write({ action: 'saveProfile', requestId: 'other-profile', profileId: 'Q', expectedVersion: 0, profile: f.profile });
  await write({ action: 'createJourney', requestId: 'other-journey', journeyId: 'OTHER', expectedVersion: 0, profileId: 'Q', profileVersion: 1, priorLearning: [] });
  const failures: [Record<string, unknown>, string][] = [
    [{ ...profile, profile: { ...f.profile, skills: ['changed'] } }, 'conflict'],
    [{ ...profile, journeyId: 'OTHER' }, 'conflict'],
    [{ action: 'saveProfile', requestId: 'wrong-profile', profileId: 'Q', journeyId: 'J', expectedVersion: 1, profile: f.profile }, 'conflict'],
    [{ action: 'cancelJob', requestId: 'wrong-job', journeyId: 'OTHER', expectedVersion: 1, jobId: job.data.id }, 'conflict'],
    [{ action: 'recordOutcome', requestId: 'wrong-experiment', journeyId: 'OTHER', expectedVersion: 1, outcomeId: 'wrong', outcome: { experimentId: 'E', event: { kind: 'conversation', description: 'Fixture' }, occurredAt: null, provenance: 'synthetic-self-report', supersedes: null } }, 'conflict'],
    [{ action: 'resumeJourney', journeyId: 'missing' }, 'not-found'],
    ...['collectEvidence', 'recommendDirections', 'prepareOffer'].map(action => [journeyWrite(action, { requestId: `unavailable-${action}` }), action === 'collectEvidence' ? 'policy-denied' : 'unavailable'] as [Record<string, unknown>, string]),
  ];
  for (const [command, code] of failures) { const a = await cli(path, cwd, command); error(a, code); assert.deepEqual(await peer.call(command), a); }
  // Populated live/WAL source: never copy only the main database file.
  const copies = [join(cwd, 'cli.sqlite'), join(cwd, 'mcp.sqlite')];
  const db = new DatabaseSync(path);
  try {
    for (const { command, result } of receipts) {
      const row = db.prepare('SELECT result FROM request_receipts WHERE request_id=?').get(String(command.requestId));
      assert.deepEqual(JSON.parse(String(row?.result)), result);
    }
    for (const destination of copies) await backup(db, destination);
  } finally { db.close(); }
  const copiedPeer = await mcp(copies[1]!, cwd); cleanup.push(() => copiedPeer.close());
  for (const { command, result } of receipts) {
    assert.deepEqual(await cli(copies[0]!, cwd, command), result);
    assert.deepEqual(await copiedPeer.call(command), result);
  }
  assert.deepEqual(await cli(copies[0]!, cwd, resume, false), await copiedPeer.call(resume));
});

test('CLI/MCP resume uses current accounting after recovery, reconciliation and retry without rewriting history', async t => {
  const { cwd, path, cleanup } = await fixture(t);
  let store = await SqliteStorage.open(path, ['read', 'fixture-write', 'fixture-run', 'cancel']);
  cleanup.push(() => store.close());
  const peer = await mcp(path, cwd); cleanup.push(() => peer.close());
  const send = (command: unknown) => store.dispatch(JSON.stringify(command));
  ok(await send(profile));
  ok(await send({ action: 'createJourney', requestId: 'journey', journeyId: 'J', expectedVersion: 0, profileId: 'P', profileVersion: 1, priorLearning: [] }));
  ok(await send({ action: 'createJourney', requestId: 'later', journeyId: 'LATER', expectedVersion: 0, profileId: 'P', profileVersion: 1, priorLearning: [] }));
  const version = async () => (await store.read('J'))!.data.version;
  ok(await send({ action: 'enqueueJob', requestId: 'enqueue', journeyId: 'J', expectedVersion: await version(), limits: f.limits }));
  async function check(required: boolean, step: string) {
    const a = await cli(path, cwd, resume, false); const b = await peer.call(resume);
    assert.deepEqual(a, b);
    const data = ok(a); assert.equal(data.reconciliationRequired, required); assert.equal(data.nextSafeStep, step);
    const other = ok(await peer.call({ action: 'resumeJourney', journeyId: 'LATER' }));
    assert.equal(other.reconciliationRequired, false); assert.deepEqual(other.jobStatuses, []);
    return data;
  }
  await check(false, 'wait-for-job-start');
  const running = (await store.workflow({ action: 'claim', ownerId: 'owner', leaseMs: 120000 }))[0]!;
  const active = await check(false, 'wait-for-job-completion');
  assert.equal(active.jobStatuses[0]!.billing, 'unknown');
  ok(await peer.call({ action: 'cancelJob', requestId: 'cancel', journeyId: 'J', jobId: running.id, expectedVersion: await version() }));
  await check(false, 'wait-for-cancellation');
  const db = new DatabaseSync(path);
  try { db.prepare('UPDATE workflow_claim SET expires_at=? WHERE slot=1').run('2000-01-01T00:00:00.000Z'); } finally { db.close(); }
  await store.workflow({ action: 'recover' });
  await check(true, 'reconcile-uncertain-work');
  const history = JSON.stringify(await store.read(running.id));
  await store.workflow({ action: 'reconcile', journeyId: 'J', jobId: running.id, adjustmentId: 'adjustment', actualMinorUnits: 12, providerRequestId: 'provider' });
  await store.close(); store = await SqliteStorage.open(path, ['read', 'fixture-write', 'fixture-run', 'cancel']);
  const resolved = await check(false, 'profile-saved');
  assert.equal(resolved.jobStatuses[0]!.billing, 'known');
  assert.deepEqual(resolved.jobStatuses[0]!.accounting, { actualMinorUnits: '12', reservedMinorUnits: '0', unknownMinorUnits: '0' });
  assert.equal(JSON.stringify(await store.read(running.id)), history);
  await store.workflow({ action: 'retry', journeyId: 'J', jobId: running.id, requestId: 'retry', expectedVersion: await version(), limits: f.limits });
  const retry = (await store.workflow({ action: 'claim', ownerId: 'next', leaseMs: 120000 }))[0]!;
  await check(false, 'wait-for-job-completion');
  await store.workflow({ action: 'settle', journeyId: 'J', jobId: retry.id, ownerId: 'next', fence: retry.fence, state: 'succeeded', actualMinorUnits: 5, providerRequestId: null });
  const settled = await check(false, 'profile-saved');
  assert.equal(settled.jobStatuses.length, 2); assert.ok(settled.jobStatuses.every(job => job.billing === 'known'));
  assert.equal(JSON.stringify(await store.read(running.id)), history);
});

test('saved history stays bounded after 63 real zero-charge fixture jobs', async t => {
  const { cwd, path, cleanup } = await fixture(t);
  let store = await SqliteStorage.open(path, ['read', 'fixture-write', 'fixture-run', 'cancel']);
  cleanup.push(() => store.close());
  const send = (command: unknown) => store.dispatch(JSON.stringify(command));
  const legacy = await send(profile); ok(legacy);
  if (legacy.status === 'ok') delete legacy.data.jobSummary;
  // Seed an actual pre-pagination receipt, not a mocked replay path.
  const db = new DatabaseSync(path);
  try { db.prepare('UPDATE request_receipts SET result=? WHERE request_id=?').run(JSON.stringify(legacy), 'profile'); } finally { db.close(); }
  ok(await send({ action: 'createJourney', requestId: 'journey', journeyId: 'J', expectedVersion: 0, profileId: 'P', profileVersion: 1, priorLearning: [] }));
  const version = async () => (await store.read('J'))!.data.version;
  const write = async (action: string, extra: Record<string, unknown>) => send({ action, requestId: action, journeyId: 'J', expectedVersion: await version(), ...extra });
  ok(await write('acceptFixtureEvidence', { observationId: 'O', evidenceId: 'EV', expectedObservationVersion: 0, expectedEvidenceVersion: 0, observation: f.observation, evidence: { ...f.evidence, observation: { id: 'O', version: 1 } } }));
  ok(await write('saveFixtureAdvice', { expectedRecordVersion: 0, record: { kind: 'recommendation', data: { ...f.recommendation, id: 'R', journeyId: 'J', profile: { id: 'P', version: 1 }, evidence: [{ id: 'EV', version: 1 }], decision: { kind: 'action', buyer: 'Synthetic buyer', problem: 'Fixture problem', action: 'Manual test', fit: 'Fixture only', economicAssumptions: ['Unknown'], experiment: 'Manual fixture', successConditions: ['One observation'], stopConditions: ['No access'], changesAdvice: ['Correction'] } } } }));
  ok(await write('saveFixtureAdvice', { requestId: 'offer', expectedRecordVersion: 0, record: { kind: 'offer', data: { ...f.offer, id: 'OFF', journeyId: 'J', recommendation: { id: 'R', version: 1 } } } }));
  ok(await write('startExperiment', { experimentId: 'E', baseline: { ...f.baseline, recommendation: { id: 'R', version: 1 }, offer: { id: 'OFF', version: 1 } } }));
  const expectedJobs: string[] = [];
  for (let i = 0; i < 63; i++) {
    const queued = ok(await send({ action: 'enqueueJob', requestId: `job-${i}`, journeyId: 'J', expectedVersion: (await store.read('J'))!.data.version, limits: f.limits }));
    assert.ok(queued.records.length <= 64);
    const running = (await store.workflow({ action: 'claim', ownerId: 'owner', leaseMs: 120000 }))[0]!;
    expectedJobs.push(running.id);
    await store.workflow({ action: 'settle', journeyId: 'J', jobId: running.id, ownerId: 'owner', fence: running.fence, state: 'succeeded', actualMinorUnits: 0, providerRequestId: null });
  }
  const enqueue = async (requestId: string) => {
    const result = await send({ action: 'enqueueJob', requestId, journeyId: 'J', expectedVersion: await version(), limits: f.limits });
    const data = ok(result); assert.equal(data.records.length, 2); assert.equal(data.jobStatuses.length, 1);
    const job = data.records.find(r => r.kind === 'job')!; expectedJobs.push(job.data.id); return job.data.id;
  };
  const unknownId = await enqueue('unknown');
  const uncertain = (await store.workflow({ action: 'claim', ownerId: 'owner', leaseMs: 120000 }))[0]!;
  await store.workflow({ action: 'settle', journeyId: 'J', jobId: uncertain.id, ownerId: 'owner', fence: uncertain.fence, state: 'reconciliation-required', actualMinorUnits: null, providerRequestId: null });
  await enqueue('running');
  assert.deepEqual(await store.workflow({ action: 'claim', ownerId: 'active-owner', leaseMs: 120000 }), []); // Unknown billing blocks further claims.
  const queuedId = await enqueue('queued');
  await store.close(); store = await SqliteStorage.open(path, ['read', 'fixture-write', 'fixture-run', 'cancel']);
  const peer = await mcp(path, cwd); cleanup.push(() => peer.close());
  type NextPage = NonNullable<ReturnType<typeof ok>['historyPage']>['next'];
  let page: NextPage = null;
  let continuation: NextPage = null;
  const seen: string[] = [];
  do {
    const command: Record<string, unknown> = { ...resume, ...(page ? { historyPage: page } : {}) };
    const result = await cli(path, cwd, command, false);
    assert.deepEqual(await peer.call(command), result);
    assert.ok(Buffer.byteLength(JSON.stringify(result)) <= 256 * 1024);
    const data = ok(result); assert.ok(data.records.length <= 64); assert.ok(data.jobStatuses.length <= 61);
    assert.deepEqual(data.jobSummary, { total: 66, active: 2, unresolved: 1 });
    assert.equal(data.reconciliationRequired, true); assert.equal(data.nextSafeStep, 'reconcile-uncertain-work');
    const journey = data.records.find(r => r.kind === 'journey'); assert.ok(journey && journey.kind === 'journey');
    assert.deepEqual(journey.data.costs, { actualMinorUnits: '0', outstandingMinorUnits: '75', unknownMinorUnits: '25' });
    assert.ok(data.records.some(r => r.kind === 'experiment' && r.data.id === 'E'));
    seen.push(...data.records.filter(r => r.kind === 'job').map(r => r.data.id));
    assert.ok(data.historyPage); assert.equal(data.historyPage.total, 67);
    page = data.historyPage.next; continuation ??= page;
  } while (page);
  assert.deepEqual(seen, expectedJobs);
  const maximum = ok(await peer.call({ ...resume, historyPage: { offset: 0, limit: 61 } }));
  assert.equal(maximum.records.length, 64);
  assert.ok(maximum.jobStatuses.every(job => !job.reconciliationRequired));
  assert.equal(maximum.reconciliationRequired, true); // Unknown work is outside this payload page.
  assert.deepEqual(await cli(path, cwd, profile), legacy); assert.deepEqual(await peer.call(profile), legacy);
  const cancel = { action: 'cancelJob', requestId: 'cancel-late', journeyId: 'J', expectedVersion: await version(), jobId: queuedId };
  const cancelled = await peer.call(cancel); assert.equal(ok(cancelled).records.length, 2);
  error(await peer.call({ ...resume, historyPage: continuation }), 'conflict');
  await store.workflow({ action: 'reconcile', journeyId: 'J', jobId: unknownId, adjustmentId: 'resolved', actualMinorUnits: 7, providerRequestId: null });
  assert.equal((await store.workflow({ action: 'claim', ownerId: 'active-owner', leaseMs: 120000 })).length, 1);
  const current = ok(await peer.call(resume));
  assert.equal(current.reconciliationRequired, false); assert.equal(current.nextSafeStep, 'wait-for-job-completion');
  assert.deepEqual(current.jobSummary, { total: 66, active: 1, unresolved: 0 });
  const reconciledPage = ok(await peer.call({ ...resume, historyPage: { offset: 63, limit: 1, journeyVersion: await version() } }));
  assert.equal(reconciledPage.jobStatuses[0]!.jobId, unknownId);
  assert.equal(reconciledPage.jobStatuses[0]!.billing, 'known');
  assert.deepEqual(reconciledPage.jobStatuses[0]!.accounting, { actualMinorUnits: '7', reservedMinorUnits: '0', unknownMinorUnits: '0' });
  const immutable = reconciledPage.records.find(r => r.kind === 'job');
  assert.ok(immutable && immutable.kind === 'job'); assert.equal(immutable.data.billing, 'unknown');
  const journey = current.records.find(r => r.kind === 'journey'); assert.ok(journey && journey.kind === 'journey');
  assert.deepEqual(journey.data.costs, { actualMinorUnits: '7', outstandingMinorUnits: '25', unknownMinorUnits: '25' }); // Newly running work is unknown, not terminal reconciliation.
  for (const historyPage of [{ offset: -1, limit: 1 }, { offset: 0, limit: 62 }, { offset: 1, limit: 1 }, { offset: 5001, limit: 1 }, { offset: 68, limit: 1, journeyVersion: await version() }]) {
    error(await peer.call({ ...resume, historyPage }), 'validation');
    error(await cli(path, cwd, { ...resume, historyPage }, false), 'validation');
  }
  await store.close(); store = await SqliteStorage.open(path, ['read', 'fixture-write', 'fixture-run', 'cancel']);
  assert.deepEqual(await cli(path, cwd, cancel), cancelled); assert.deepEqual(await peer.call(cancel), cancelled);
  // Both old and new receipts must also pass the real export/import validators.
  const exported = join(cwd, 'export.json'); const ledger = join(cwd, 'ledger.json'); const imported = join(cwd, 'imported.sqlite');
  await store.administer({ action: 'export', destination: exported });
  await store.administer({ action: 'exportRemovalLedger', destination: ledger });
  await store.administer({ action: 'import', source: exported, destination: imported, ledger });
  assert.deepEqual(await cli(imported, cwd, profile), legacy);
  assert.deepEqual(await cli(imported, cwd, cancel), cancelled);
});

test('13 strict named tools; default read denies receipt replay and JSON cannot grant scope or select stores', async t => {
  const { cwd, path, cleanup } = await fixture(t);
  ok(await cli(path, cwd, profile));
  const peer = await mcp(path, cwd, false); cleanup.push(() => peer.close());
  const tools = (await peer.client.listTools()).tools;
  assert.deepEqual(tools.map(tool => tool.name).sort(), names);
  for (const tool of tools) {
    assert.equal(tool.inputSchema.additionalProperties, false);
    for (const key of ['action', 'capabilities', 'scope', 'store', 'storePath', 'sql', 'shell', 'provider', 'credential']) assert.ok(!Object.hasOwn(tool.inputSchema.properties ?? {}, key));
  }
  const denied = await cli(path, cwd, profile, false); error(denied, 'unauthorized'); assert.deepEqual(await peer.call(profile), denied);
  for (const key of ['capabilities', 'scope', 'store', 'storePath', 'sql', 'shell', 'provider', 'credential', 'confirmed']) {
    const command = { ...profile, [key]: sentinel };
    const rejected = await cli(path, cwd, command, false); error(rejected, 'validation'); assert.deepEqual(await peer.call(command), rejected);
  }
  for (const action of ['admin', 'sql', 'shell', 'provider', 'credentials', 'restore', 'delete']) error(await peer.call({ action }), 'validation');
  const injected = await peer.client.callTool({ name: 'resumeJourney', arguments: { action: 'saveProfile', journeyId: 'J' } });
  assert.equal(injected.isError, true);
});

test('bounded hostile stdio frames, safe diagnostics, CLI single JSON/5s deadline and MCP EOF cleanup', async t => {
  const { cwd, path } = await fixture(t);
  for (const input of ['{', '{}\n{}', JSON.stringify({ secret: sentinel }), ' '.repeat(256 * 1024 + 1)]) {
    const result = await raw('cli', path, cwd, input); assert.equal(result.code, 1); assert.equal(result.stderr, ''); error(JSON.parse(result.stdout), 'validation');
  }
  const start = performance.now();
  const timeout = await raw('cli', path, cwd, '{', false, false);
  assert.ok(performance.now() - start >= 4_900); assert.equal(timeout.code, 1); error(JSON.parse(timeout.stdout), 'validation');
  for (const input of ['{"secret":"' + sentinel + '"\n', ' '.repeat(256 * 1024 + 1)]) {
    const result = await raw('mcp', path, cwd, input, false, false);
    assert.equal(result.code, 1); assert.equal(result.stdout, ''); assert.equal(result.stderr, 'Market Mommy MCP stopped safely.\n');
  }
  const eof = await raw('mcp', path, cwd, ''); assert.equal(eof.code, 0); assert.equal(eof.stdout, ''); assert.equal(eof.stderr, '');
  // A fresh process can reopen after every exit, proving owned storage workers do not hold it open.
  ok(await cli(path, cwd, profile));
});

import assert from 'node:assert/strict';
import { fork, type ChildProcess } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { setTimeout as delay } from 'node:timers/promises';
import test, { type TestContext } from 'node:test';
import { SqliteStorage } from '../../src/adapters/sqlite/client.js';
import type { DispatchResult } from '../../src/application/dispatch.js';
import type { WorkflowRequest } from '../../src/application/workflow.js';
import { DomainError } from '../../src/domain/errors.js';
import type { Job } from '../../src/domain/job.js';
import * as f from '../helpers/records.js';

const grants = ['read', 'fixture-write', 'fixture-run', 'cancel'] as const;
let sequence = 0;
const key = () => `workflow-${++sequence}`;
const dispatch = (s: SqliteStorage, command: unknown) => s.dispatch(JSON.stringify(command));
function ok(r: DispatchResult) { assert.equal(r.status, 'ok', JSON.stringify(r)); }
function error(r: DispatchResult, code: string) { assert.equal(r.status, 'error'); if (r.status === 'error') assert.equal(r.error.code, code); }
async function journey(s: SqliteStorage, id = 'J-A') { const r = await s.read(id); assert.equal(r?.kind, 'journey'); if (r?.kind !== 'journey') throw new Error('Missing Journey'); return r.data; }
async function job(s: SqliteStorage, id: string) { const r = await s.read(id); assert.equal(r?.kind, 'job'); if (r?.kind !== 'job') throw new Error('Missing job'); return r.data; }
async function setup(s: SqliteStorage, id = 'J-A') {
  if (!await s.read('P')) ok(await dispatch(s, { action: 'saveProfile', requestId: key(), profileId: 'P', expectedVersion: 0, profile: f.profile }));
  ok(await dispatch(s, { action: 'createJourney', requestId: key(), journeyId: id, profileId: 'P', profileVersion: 1, expectedVersion: 0, priorLearning: [] }));
}
async function fixture(t: TestContext) {
  const root = await mkdtemp(join(tmpdir(), 'market-mommy-workflow-')); const path = join(root, 'fixture.sqlite');
  const stores: SqliteStorage[] = [];
  async function open(readonly = false) { const s = await SqliteStorage.open(path, readonly ? ['read'] : grants); stores.push(s); return s; }
  t.after(async () => { await Promise.all(stores.map(s => s.close())); await rm(root, { recursive: true, force: true }); });
  const store = await open(); await setup(store); return { store, open, path };
}
async function enqueueCommand(s: SqliteStorage, id = 'J-A', limits = f.limits) { return { action: 'enqueueJob', requestId: key(), journeyId: id, expectedVersion: (await journey(s, id)).version, limits }; }
async function enqueue(s: SqliteStorage, id = 'J-A', limits = f.limits) { ok(await dispatch(s, await enqueueCommand(s, id, limits))); return job(s, (await journey(s, id)).jobIds.at(-1)!); }
async function claim(s: SqliteStorage, ownerId = 'owner') { const jobs = await s.workflow({ action: 'claim', ownerId, leaseMs: 120000 }); assert.equal(jobs.length, 1); return jobs[0]!; }
function settlement(j: Job, actualMinorUnits: number | null = 25, ownerId = 'owner'): WorkflowRequest & { action: 'settle' } { return { action: 'settle', journeyId: j.journeyId, jobId: j.id, ownerId, fence: j.fence, state: actualMinorUnits === null ? 'reconciliation-required' : 'succeeded', actualMinorUnits, providerRequestId: `provider-${j.id}` }; }
function expire(path: string) { const db = new DatabaseSync(path); try { db.prepare('UPDATE workflow_claim SET expires_at=? WHERE slot=1').run('2000-01-01T00:00:00.000Z'); } finally { db.close(); } }
function sql(path: string, statement: string) { const db = new DatabaseSync(path); try { return db.prepare(statement).all(); } finally { db.close(); } }
async function rejects(work: Promise<unknown>, code: string) { await assert.rejects(work, e => e instanceof DomainError && e.code === code); }
function message(child: ChildProcess): Promise<{ state: string; jobs: Job[] }> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { cleanup(); reject(new Error('Workflow child timeout')); }, 15000);
    const onExit = () => { cleanup(); reject(new Error('Workflow child exited early')); };
    const onMessage = (value: unknown) => { cleanup(); resolve(value as { state: string; jobs: Job[] }); };
    function cleanup() { clearTimeout(timer); child.off('exit', onExit); child.off('message', onMessage); }
    child.once('exit', onExit); child.once('message', onMessage);
  });
}
async function processWorker(t: TestContext, path: string, owner: string) {
  const child = fork(new URL('../helpers/workflow-process.js', import.meta.url), [path, owner], { env: {}, stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
  const exited = new Promise<void>((resolve, reject) => { child.once('exit', () => resolve()); child.once('error', reject); });
  const stop = async () => { if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL'); await exited; };
  t.after(stop); assert.equal((await message(child)).state, 'ready'); return { child, stop };
}

test('enqueue atomically persists intent, reservation and receipt; duplicates survive restart', async t => {
  const { store, open, path } = await fixture(t); const command = await enqueueCommand(store);
  const db = new DatabaseSync(path);
  try {
    db.exec("CREATE TRIGGER reject_workflow_receipt BEFORE INSERT ON request_receipts BEGIN SELECT RAISE(ABORT,'fixture'); END");
    error(await dispatch(store, command), 'storage-failure');
    assert.deepEqual((await journey(store)).jobIds, []); assert.equal(sql(path, 'SELECT * FROM workflow_attempts').length, 0); assert.equal(sql(path, 'SELECT * FROM workflow_ledger').length, 0);
    db.exec('DROP TRIGGER reject_workflow_receipt');
  } finally { db.close(); }
  const saved = await dispatch(store, command); ok(saved);
  assert.deepEqual(await dispatch(store, command), saved); await store.close(); const reopened = await open();
  assert.deepEqual(await dispatch(reopened, command), saved);
  assert.equal(sql(path, 'SELECT * FROM workflow_attempts').length, 1); assert.equal(sql(path, 'SELECT * FROM workflow_ledger').length, 1);
  assert.deepEqual((await journey(reopened)).costs, { actualMinorUnits: '0', outstandingMinorUnits: '25', unknownMinorUnits: '0' });
  error(await dispatch(reopened, { ...command, limits: { ...f.limits, turns: 1 } }), 'conflict');
  await setup(reopened, 'J-B'); error(await dispatch(reopened, { ...command, journeyId: 'J-B' }), 'conflict');
});

test('competing processes claim exactly one winner; crash recovery quarantines unknown reservation without replay', async t => {
  const { store, path, open } = await fixture(t); const queued = await enqueue(store);
  const a = await processWorker(t, path, 'process-a'); const b = await processWorker(t, path, 'process-b');
  const responses = [message(a.child), message(b.child)]; a.child.send('claim'); b.child.send('claim');
  const results = await Promise.all(responses); assert.deepEqual(results.map(r => r.state), ['claimed', 'claimed']);
  assert.deepEqual(results.map(r => r.jobs.length).sort(), [0, 1]);
  const running = results.flatMap(r => r.jobs)[0]!; assert.equal(running.id, queued.id); assert.equal(running.fence, 1);
  await Promise.all([a.stop(), b.stop()]); expire(path); await store.close(); const reopened = await open();
  const recovered = await job(reopened, queued.id); assert.equal(recovered.state, 'reconciliation-required'); assert.equal(recovered.billing, 'unknown'); assert.equal(recovered.attemptId, running.attemptId);
  assert.deepEqual((await journey(reopened)).costs, { actualMinorUnits: '0', outstandingMinorUnits: '25', unknownMinorUnits: '25' });
  assert.deepEqual(await reopened.workflow({ action: 'recover' }), []); assert.deepEqual(await reopened.workflow({ action: 'claim', ownerId: 'new-owner', leaseMs: 1000 }), []);
  assert.equal(sql(path, 'SELECT * FROM workflow_attempts').length, 1);
});

test('queue and caller limits are bounded; queue waiting consumes deadline', async t => {
  const { store } = await fixture(t); await setup(store, 'J-B');
  error(await dispatch(store, await enqueueCommand(store, 'J-A', { ...f.limits, deadlineMs: 120001 })), 'validation');
  for (let n = 0; n < 16; n++) await enqueue(store, n < 8 ? 'J-A' : 'J-B');
  error(await dispatch(store, await enqueueCommand(store, 'J-B')), 'unavailable');
  assert.equal((await journey(store, 'J-A')).jobIds.length + (await journey(store, 'J-B')).jobIds.length, 16);
  const other = await fixture(t); const queued = await enqueue(other.store, 'J-A', { ...f.limits, deadlineMs: 20 });
  await delay(40); await other.store.workflow({ action: 'recover' });
  assert.equal((await job(other.store, queued.id)).state, 'failed'); assert.equal((await journey(other.store)).costs.outstandingMinorUnits, '0');
  assert.deepEqual(await other.store.workflow({ action: 'claim', ownerId: 'owner', leaseMs: 1000 }), []);
});

test('queued cancellation releases reservation; running cancellation retains uncertainty until settlement', async t => {
  const { store } = await fixture(t); const queued = await enqueue(store);
  const cancel = async (j: Job) => dispatch(store, { action: 'cancelJob', requestId: key(), journeyId: j.journeyId, expectedVersion: (await journey(store, j.journeyId)).version, jobId: j.id });
  ok(await cancel(queued)); assert.equal((await job(store, queued.id)).state, 'cancelled'); assert.equal((await journey(store)).costs.outstandingMinorUnits, '0');
  await enqueue(store); const running = await claim(store); ok(await cancel(running));
  assert.equal((await job(store, running.id)).state, 'cancel-requested'); assert.equal((await journey(store)).costs.unknownMinorUnits, '25');
  await store.workflow({ ...settlement(running, 5), state: 'cancelled' });
  assert.equal((await job(store, running.id)).state, 'cancelled'); assert.deepEqual((await journey(store)).costs, { actualMinorUnits: '5', outstandingMinorUnits: '0', unknownMinorUnits: '0' });
});

test('expired fences reject stale results; reconciliation is idempotent and preserves terminal history and old Journey attribution', async t => {
  const { store, path, open } = await fixture(t); await enqueue(store); const running = await claim(store); expire(path);
  await rejects(store.workflow(settlement(running)), 'conflict'); const terminal = await job(store, running.id);
  assert.equal(terminal.state, 'reconciliation-required');
  const resume = async (s: SqliteStorage, required: boolean) => {
    const result = await dispatch(s, { action: 'resumeJourney', journeyId: 'J-A' });
    ok(result); if (result.status !== 'ok') throw new Error('Expected resume');
    assert.equal(result.data.reconciliationRequired, required);
    assert.equal(result.data.nextSafeStep === 'reconcile-uncertain-work', required);
  };
  await resume(store, true);
  await setup(store, 'J-B'); const later = await journey(store, 'J-B');
  const adjustment = { action: 'reconcile', journeyId: 'J-A', jobId: running.id, adjustmentId: key(), actualMinorUnits: 12, providerRequestId: 'old-provider' } as const;
  await rejects(store.workflow({ ...adjustment, journeyId: 'J-B' }), 'conflict');
  await rejects(store.workflow({ action: 'retry', journeyId: 'J-A', jobId: running.id, requestId: key(), expectedVersion: (await journey(store)).version, limits: f.limits }), 'reconciliation-required');
  const result = await store.workflow(adjustment); const ledger = sql(path, 'SELECT * FROM workflow_ledger'); const version = (await journey(store)).version;
  assert.deepEqual(await store.workflow(adjustment), result); assert.deepEqual(sql(path, 'SELECT * FROM workflow_ledger'), ledger); assert.equal((await journey(store)).version, version);
  await rejects(store.workflow({ ...adjustment, actualMinorUnits: 13 }), 'conflict');
  assert.deepEqual(await job(store, running.id), terminal); assert.deepEqual((await store.read(running.id, terminal.version))?.data, terminal);
  assert.deepEqual(await journey(store, 'J-B'), later); assert.deepEqual((await journey(store)).costs, { actualMinorUnits: '12', outstandingMinorUnits: '0', unknownMinorUnits: '0' });
  await resume(store, false);
  await store.close(); const reopened = await open();
  await resume(reopened, false);
  assert.equal(JSON.stringify(await job(reopened, running.id)), JSON.stringify(terminal));
  const retried = (await reopened.workflow({ action: 'retry', journeyId: 'J-A', jobId: running.id, requestId: key(), expectedVersion: version, limits: f.limits }))[0]!;
  const next = await claim(reopened, 'next'); assert.equal(next.id, retried.id); assert.ok(next.fence > running.fence);
  await rejects(reopened.workflow(settlement(running)), 'conflict'); assert.deepEqual(await job(reopened, next.id), next);
  await reopened.workflow(settlement(next, 5, 'next'));
  await resume(reopened, false);
  assert.equal(JSON.stringify(await job(reopened, running.id)), JSON.stringify(terminal));
});

test('settlement replay is exact, conflicting replay rejects, and unknown settlement keeps encumbrance', async t => {
  const { store, path } = await fixture(t); await enqueue(store); const running = await claim(store); const request = settlement(running, null);
  const result = await store.workflow(request); const before = sql(path, 'SELECT * FROM workflow_ledger');
  assert.deepEqual(await store.workflow(request), result); assert.deepEqual(sql(path, 'SELECT * FROM workflow_ledger'), before);
  await rejects(store.workflow({ ...request, actualMinorUnits: 1 }), 'conflict');
  assert.deepEqual((await journey(store)).costs, { actualMinorUnits: '0', outstandingMinorUnits: '25', unknownMinorUnits: '25' });
});

test('linked retries use distinct immutable identities without resetting the 100-cent run cap', async t => {
  const { store } = await fixture(t); let previous = await enqueue(store); const root = previous.id; const identities = new Set<string>();
  for (let attempt = 0; attempt < 4; attempt++) {
    const running = await claim(store); identities.add(running.id); identities.add(running.attemptId); assert.equal(running.rootJobId, root);
    previous = (await store.workflow(settlement(running)))[0]!;
    const retry = { action: 'retry', journeyId: 'J-A', jobId: previous.id, requestId: key(), expectedVersion: (await journey(store)).version, limits: f.limits } as const;
    if (attempt === 3) await rejects(store.workflow(retry), 'budget-exhausted');
    else {
      const next = (await store.workflow(retry))[0]!; assert.equal(next.precedingAttemptId, previous.attemptId); assert.notEqual(next.id, previous.id); assert.notEqual(next.attemptId, previous.attemptId);
      assert.deepEqual(await store.workflow(retry), [next]);
      await rejects(store.workflow({ ...retry, requestId: key(), expectedVersion: (await journey(store)).version }), 'conflict');
    }
  }
  assert.equal(identities.size, 8); assert.deepEqual((await journey(store)).costs, { actualMinorUnits: '100', outstandingMinorUnits: '0', unknownMinorUnits: '0' });
});

test('concurrent reservations cannot overspend the 300-cent Journey cap', async t => {
  const { store, open } = await fixture(t); const other = await open();
  for (let n = 0; n < 11; n++) { await enqueue(store); await store.workflow(settlement(await claim(store))); }
  const a = await enqueueCommand(store); const b = { ...a, requestId: key() };
  const results = await Promise.all([dispatch(store, a), dispatch(other, b)]);
  assert.equal(results.filter(r => r.status === 'ok').length, 1); assert.equal(results.filter(r => r.status === 'error').length, 1);
  for (const r of results) if (r.status === 'error') assert.equal(r.error.code, 'conflict');
  assert.deepEqual((await journey(store)).costs, { actualMinorUnits: '275', outstandingMinorUnits: '25', unknownMinorUnits: '0' });
  error(await dispatch(store, await enqueueCommand(store)), 'budget-exhausted');
  await store.workflow(settlement(await claim(store))); error(await dispatch(store, await enqueueCommand(store)), 'budget-exhausted');
  assert.equal((await journey(store)).costs.actualMinorUnits, '300'); assert.equal((await journey(store)).jobIds.length, 12);
});

test('read-only launch denies workflow; invalid administrative inputs reject DomainError', async t => {
  const { store, open } = await fixture(t); const reader = await open(true);
  for (const request of [{ action: 'recover' }, { action: 'claim', ownerId: 'owner', leaseMs: 1000 }] as const) await rejects(reader.workflow(request), 'unauthorized');
  error(await dispatch(reader, await enqueueCommand(store)), 'unauthorized');
  await enqueue(store); const running = await claim(store);
  await rejects(store.workflow({ ...settlement(running), actualMinorUnits: 26 }), 'validation');
  await rejects(store.workflow({ ...settlement(running), state: 'running' } as unknown as WorkflowRequest), 'validation');
  await rejects(store.workflow({ action: 'claim', ownerId: 'owner', leaseMs: 0 }), 'validation');
  await setup(store, 'J-B'); await rejects(store.workflow({ ...settlement(running), journeyId: 'J-B' }), 'conflict');
  assert.deepEqual(await job(store, running.id), running);
});

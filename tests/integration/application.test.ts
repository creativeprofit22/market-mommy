import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import test, { type TestContext } from 'node:test';
import { SqliteStorage } from '../../src/adapters/sqlite/client.js';
import type { DispatchResult } from '../../src/application/dispatch.js';
import { storedRecordSchema, type StoredRecord } from '../../src/domain/records.js';
import * as f from '../helpers/records.js';

const grants = ['read', 'fixture-write', 'fixture-run', 'cancel'] as const;
let sequence = 0;
const requestId = (): string => `request-${++sequence}`;
async function fixture(t: TestContext) {
  const root = await mkdtemp(join(tmpdir(), 'market-mommy-application-'));
  const path = join(root, 'fixture.sqlite');
  const stores: SqliteStorage[] = [];
  async function open(readonly = false) { const s = await SqliteStorage.open(path, readonly ? ['read'] : grants); stores.push(s); return s; }
  t.after(async () => { await Promise.all(stores.map(s => s.close())); await rm(root, { recursive: true, force: true }); });
  return { path, open, store: await open() };
}
const dispatch = (s: SqliteStorage, command: unknown) => s.dispatch(JSON.stringify(command));
function ok(result: DispatchResult) { assert.equal(result.status, 'ok', JSON.stringify(result)); if (result.status !== 'ok') throw new Error('Expected success'); return result.data; }
function error(result: DispatchResult, code: string) { assert.equal(result.status, 'error'); if (result.status === 'error') assert.equal(result.error.code, code); }
type RecordData = { [R in StoredRecord as R['kind']]: R['data'] };
function read<K extends keyof RecordData>(s: SqliteStorage, id: string, kind: K): Promise<RecordData[K]> {
  return s.read(id).then(r => {
    assert.ok(r); assert.equal(r.kind, kind);
    return r.data as RecordData[K];
  });
}
async function setup(s: SqliteStorage, id = 'J-A', priorLearning: { id: string; version: number }[] = []) {
  if (!await s.read('P')) ok(await dispatch(s, { action: 'saveProfile', requestId: requestId(), profileId: 'P', expectedVersion: 0, profile: f.profile }));
  const p = await read(s, 'P', 'profile');
  ok(await dispatch(s, { action: 'createJourney', requestId: requestId(), journeyId: id, profileId: 'P', profileVersion: p.version, expectedVersion: 0, priorLearning }));
}
async function evidence(s: SqliteStorage, j = 'J-A', id = 'EV', sourceId = 'source-1', originId = 'origin-1') {
  const journey = await read(s, j, 'journey');
  const old = await s.read(id);
  const version = old?.data.version ?? 0;
  const command = { action: 'acceptFixtureEvidence', requestId: requestId(), journeyId: j, expectedVersion: journey.version, expectedObservationVersion: version, expectedEvidenceVersion: version, observationId: `O-${id}`, evidenceId: id, observation: { ...f.observation, sourceId, originId, statement: `Synthetic version ${version + 1}` }, evidence: { ...f.evidence, observation: { id: `O-${id}`, version: version + 1 }, independentOrigin: originId } };
  return { command, result: await dispatch(s, command) };
}
async function advice(s: SqliteStorage, j = 'J-A', suffix = 'A') {
  const journey = await read(s, j, 'journey');
  const data = { ...f.recommendation, id: `REC-${suffix}`, journeyId: j, profile: journey.profile, evidence: [{ id: 'EV', version: (await read(s, 'EV', 'evidence')).version }], decision: { kind: 'action', buyer: 'Synthetic buyer', problem: 'Fixture problem', action: 'Manual test', fit: 'Fixture only', economicAssumptions: ['Unknown'], experiment: 'Manual fixture', successConditions: ['One observation'], stopConditions: ['No access'], changesAdvice: ['Correction'] } };
  ok(await dispatch(s, { action: 'saveFixtureAdvice', requestId: requestId(), journeyId: j, expectedVersion: journey.version, expectedRecordVersion: 0, record: { kind: 'recommendation', data } }));
  const updated = await read(s, j, 'journey');
  ok(await dispatch(s, { action: 'saveFixtureAdvice', requestId: requestId(), journeyId: j, expectedVersion: updated.version, expectedRecordVersion: 0, record: { kind: 'offer', data: { ...f.offer, id: `OFF-${suffix}`, journeyId: j, recommendation: { id: data.id, version: 1 } } } }));
  return { ...f.baseline, recommendation: { id: data.id, version: 1 }, offer: { id: `OFF-${suffix}`, version: 1 } };
}
async function start(s: SqliteStorage, j = 'J-A', suffix = 'A') {
  const baseline = await advice(s, j, suffix);
  ok(await dispatch(s, { action: 'startExperiment', requestId: requestId(), journeyId: j, expectedVersion: (await read(s, j, 'journey')).version, experimentId: `E-${suffix}`, baseline }));
}
/** Pre-existing accounting state only. No claim/reservation/recovery algorithm is exercised here. */
async function seedAccounting(s: SqliteStorage, j = 'J-A', id = 'K-A', step = 'evidence-review') {
  const journey = await read(s, j, 'journey');
  const job = storedRecordSchema.parse({ kind: 'job', data: { ...f.job, id, journeyId: j, rootJobId: id, attemptId: `A-${id}`, requestId: `request-${id}`, state: 'reconciliation-required', billing: 'unknown', providerRequestId: `provider-${id}`, actualMinorUnits: '25', reservedMinorUnits: '30' } });
  const changed = storedRecordSchema.parse({ kind: 'journey', data: { ...journey, version: journey.version + 1, lastSavedStep: step, jobIds: [id], costs: { actualMinorUnits: '25', outstandingMinorUnits: '30', unknownMinorUnits: '30' } } });
  await s.append([{ record: job, expectedVersion: 0, dependencies: [] }, { record: changed, expectedVersion: journey.version, dependencies: [] }]);
  return { job: job.data, journey: changed.data };
}

test('missing and wrong-kind workload references still reject resume and roll back cancellation', async t => {
  const { store } = await fixture(t);
  await setup(store); ok((await evidence(store)).result);
  ok(await dispatch(store, { action: 'enqueueJob', requestId: requestId(), journeyId: 'J-A', expectedVersion: (await read(store, 'J-A', 'journey')).version, limits: f.limits }));
  const initial = await read(store, 'J-A', 'journey');
  const job = await read(store, initial.jobIds[0]!, 'job');
  for (const [id, code] of [['absent', 'not-found'], ['P', 'conflict']] as const) {
    const before = await read(store, 'J-A', 'journey');
    const changed = { ...before, version: before.version + 1, workload: { ...before.workload, evidenceIds: [id] } };
    await store.append([{ record: { kind: 'journey', data: changed }, expectedVersion: before.version, dependencies: [] }]);
    error(await dispatch(store, { action: 'resumeJourney', journeyId: 'J-A' }), code);
    error(await dispatch(store, { action: 'cancelJob', requestId: requestId(), journeyId: 'J-A', expectedVersion: changed.version, jobId: job.id }), code);
    assert.deepEqual(await read(store, 'J-A', 'journey'), changed);
    assert.deepEqual(await read(store, job.id, 'job'), job);
  }
});

test('global receipts replay identical validated results after restart and reject changed payload or Journey', async t => {
  const { store, open, path } = await fixture(t);
  const command = { action: 'saveProfile', requestId: 'global-key', profileId: 'P', expectedVersion: 0, profile: f.profile };
  const saved = await dispatch(store, command); ok(saved);
  await setup(store);
  await store.close();
  const reopened = await open();
  assert.deepEqual(await dispatch(reopened, { ...command, profile: { ...f.profile } }), saved);
  error(await dispatch(reopened, { ...command, profile: { ...f.profile, skills: ['changed'] } }), 'conflict');
  error(await dispatch(reopened, { ...command, journeyId: 'J-A' }), 'conflict');
  const db = new DatabaseSync(path, { readOnly: true });
  try { const row = db.prepare('SELECT semantic_request,result FROM request_receipts WHERE request_id=?').get('global-key'); assert.deepEqual(JSON.parse(String(row?.result)), saved); assert.equal(JSON.parse(String(row?.semantic_request)).profileId, 'P'); }
  finally { db.close(); }
});

test('read-only launch cannot write or replay write receipts; request arguments cannot grant capabilities', async t => {
  const { store, open } = await fixture(t);
  const command = { action: 'saveProfile', requestId: 'key', profileId: 'P', expectedVersion: 0, profile: f.profile };
  ok(await dispatch(store, command)); await setup(store);
  const reader = await open(true);
  error(await dispatch(reader, command), 'unauthorized');
  error(await dispatch(reader, { ...command, capabilities: ['fixture-write'] }), 'validation');
  await assert.rejects(reader.append([{ record: storedRecordSchema.parse({ kind: 'profile', data: { ...f.base, ...f.profile } }), expectedVersion: 0, dependencies: [] }]), { code: 'unauthorized' });
  ok(await dispatch(reader, { action: 'resumeJourney', journeyId: 'J-A' }));
  error(await dispatch(reader, { action: 'resumeJourney', profileId: 'P' }), 'validation');
  error(await reader.dispatch('{'), 'validation');
  error(await reader.dispatch(' '.repeat(262145)), 'validation');
});

test('competing worker dispatches commit one receipt and return the same result', async t => {
  const { store, open } = await fixture(t); const other = await open();
  const command = { action: 'saveProfile', requestId: 'race', profileId: 'P', expectedVersion: 0, profile: f.profile };
  const results = await Promise.all([dispatch(store, command), dispatch(other, command)]);
  ok(results[0]!); assert.deepEqual(results[0], results[1]); assert.equal((await store.info()).versions, 1);
});

test('receipt insertion failure rolls back every record and permits a clean retry', async t => {
  const { store, path } = await fixture(t);
  const db = new DatabaseSync(path);
  const command = { action: 'saveProfile', requestId: 'atomic', profileId: 'P', expectedVersion: 0, profile: f.profile };
  try {
    db.exec("CREATE TRIGGER reject_receipt BEFORE INSERT ON request_receipts BEGIN SELECT RAISE(ABORT,'fixture fault'); END");
    error(await dispatch(store, command), 'storage-failure'); assert.equal(await store.read('P'), null);
    db.exec('DROP TRIGGER reject_receipt'); ok(await dispatch(store, command));
  } finally { db.close(); }
});

test('profile and evidence corrections append versions and invalidate every dependent Journey', async t => {
  const { store } = await fixture(t); await setup(store); ok((await evidence(store)).result); await advice(store);
  await setup(store, 'J-B'); await advice(store, 'J-B', 'B');
  const j = await read(store, 'J-B', 'journey');
  ok(await dispatch(store, { action: 'saveFixtureAdvice', requestId: requestId(), journeyId: 'J-B', expectedVersion: j.version, expectedRecordVersion: 0, record: { kind: 'interpretation', data: { ...f.interpretation, id: 'I-B', journeyId: 'J-B', profile: j.profile, evidence: [{ id: 'EV', version: 1 }] } } }));
  ok((await evidence(store)).result);
  for (const id of ['REC-A', 'REC-B']) { const r = await read(store, id, 'recommendation'); assert.equal(r.version, 2); assert.equal(r.validity, 'reassessment-required'); }
  assert.equal((await read(store, 'I-B', 'interpretation')).validity, 'reassessment-required');
  assert.equal((await store.read('EV', 1))?.data.version, 1);
  const old = await read(store, 'P', 'profile');
  ok(await dispatch(store, { action: 'saveProfile', requestId: requestId(), profileId: 'P', journeyId: 'J-A', expectedVersion: old.version, profile: { ...f.profile, availableHoursPerWeek: 2 } }));
  assert.equal((await read(store, 'J-B', 'journey')).profile.version, 2);
  assert.equal((await store.read('P', 1))?.data.version, 1);
  const a = await read(store, 'J-A', 'journey');
  error(await dispatch(store, { action: 'startExperiment', requestId: requestId(), journeyId: 'J-A', expectedVersion: a.version, experimentId: 'E-A', baseline: { ...f.baseline, recommendation: { id: 'REC-A', version: 1 }, offer: { id: 'OFF-A', version: 1 } } }), 'conflict');
});

test('source/origin membership is cumulative, reused evidence counts, and caps roll back new records', async t => {
  const { store } = await fixture(t); await setup(store);
  ok((await evidence(store)).result); ok((await evidence(store, 'J-A', 'EV-2', 'source-2', 'origin-1')).result);
  const before = await store.info();
  error((await evidence(store, 'J-A', 'EV-3', 'source-3', 'origin-3')).result, 'validation');
  assert.deepEqual(await store.info(), before); assert.equal(await store.read('O-EV-3'), null);
  error((await evidence(store, 'J-A', 'EV', 'source-new')).result, 'conflict');
  await setup(store, 'J-B');
  const reuse = { action: 'reuseFixtureEvidence', requestId: requestId(), journeyId: 'J-B', expectedVersion: 1, evidence: [{ id: 'EV', version: 1 }, { id: 'EV-2', version: 1 }] };
  ok(await dispatch(store, reuse));
  const resumed = ok(await dispatch(store, { action: 'resumeJourney', journeyId: 'J-B' }));
  assert.deepEqual(resumed.independentOrigins, ['origin-1']);
  assert.deepEqual((await read(store, 'J-B', 'journey')).workload.sourceIds, ['source-1', 'source-2']);
  assert.deepEqual(await dispatch(store, reuse), await dispatch(store, reuse));
});

test('evidence and direction caps include previous membership, not just the latest command', async t => {
  const { store } = await fixture(t); await setup(store);
  for (let n = 0; n < 50; n++) ok((await evidence(store, 'J-A', n === 0 ? 'EV' : `EV-${n}`)).result);
  error((await evidence(store, 'J-A', 'EV-over')).result, 'validation');
  assert.equal(await store.read('EV-over'), null);
  for (const suffix of ['A', 'B', 'C']) await advice(store, 'J-A', suffix);
  const before = await store.info();
  const j = await read(store, 'J-A', 'journey');
  error(await dispatch(store, { action: 'saveFixtureAdvice', requestId: requestId(), journeyId: 'J-A', expectedVersion: j.version, expectedRecordVersion: 0, record: { kind: 'recommendation', data: { ...f.recommendation, id: 'REC-over', journeyId: 'J-A', profile: j.profile } } }), 'validation');
  assert.deepEqual(await store.info(), before);
});

test('experiment baseline is immutable; outcome corrections append supersession without branches', async t => {
  const { store } = await fixture(t); await setup(store); ok((await evidence(store)).result); await start(store);
  const experiment = await read(store, 'E-A', 'experiment');
  await assert.rejects(store.append([{ record: { kind: 'experiment', data: { ...experiment, version: 2, baseline: { ...experiment.baseline, successConditions: ['Changed after outcome'] } } }, expectedVersion: 1, dependencies: [] }]), { code: 'conflict' });
  const input = { experimentId: 'E-A', event: { kind: 'paid-commitment', description: 'Synthetic unpaid commitment', money: { ...f.money, minorUnits: '10000' } }, occurredAt: f.now, provenance: 'synthetic-self-report', supersedes: null };
  for (const [id, outcome] of [['commitment', input], ['deposit', { ...input, event: { ...input.event, kind: 'payment-received', money: { ...f.money, minorUnits: '4000' } } }]] as const) {
    ok(await dispatch(store, { action: 'recordOutcome', requestId: requestId(), journeyId: 'J-A', expectedVersion: (await read(store, 'J-A', 'journey')).version, outcomeId: id, outcome }));
  }
  const corrected = { ...input, event: { kind: 'payment-received', description: 'Corrected deposit', money: { ...f.money, minorUnits: '3000' } }, supersedes: { id: 'deposit', version: 1 } };
  ok(await dispatch(store, { action: 'recordOutcome', requestId: requestId(), journeyId: 'J-A', expectedVersion: (await read(store, 'J-A', 'journey')).version, outcomeId: 'correction', outcome: corrected }));
  error(await dispatch(store, { action: 'recordOutcome', requestId: requestId(), journeyId: 'J-A', expectedVersion: (await read(store, 'J-A', 'journey')).version, outcomeId: 'branch', outcome: corrected }), 'conflict');
  const deposit = await read(store, 'deposit', 'outcome'); assert.equal(deposit.version, 1); assert.equal(deposit.event.kind, 'payment-received');
  await assert.rejects(store.append([{ record: { kind: 'outcome', data: { ...deposit, version: 2 } }, expectedVersion: 1, dependencies: [] }]), { code: 'conflict' });
  assert.deepEqual(await read(store, 'E-A', 'experiment'), experiment);
});

test('reference mismatches and unavailable engines fail honestly without fabricated jobs', async t => {
  const { store } = await fixture(t); await setup(store); await setup(store, 'J-B'); ok((await evidence(store)).result); await start(store);
  error(await dispatch(store, { action: 'recordOutcome', requestId: requestId(), journeyId: 'J-B', expectedVersion: 1, outcomeId: 'wrong', outcome: { experimentId: 'E-A', event: { kind: 'conversation', description: 'Fixture' }, occurredAt: null, provenance: 'synthetic-self-report', supersedes: null } }), 'conflict');
  ok(await dispatch(store, { action: 'saveProfile', requestId: requestId(), profileId: 'Q', expectedVersion: 0, profile: f.profile }));
  error(await dispatch(store, { action: 'saveProfile', requestId: requestId(), profileId: 'Q', journeyId: 'J-A', expectedVersion: 1, profile: f.profile }), 'conflict');
  for (const action of ['collectEvidence', 'recommendDirections', 'prepareOffer'] as const) {
    const command = { action, requestId: requestId(), journeyId: 'J-B', expectedVersion: 1 };
    const result = await dispatch(store, command); error(result, action === 'collectEvidence' ? 'policy-denied' : 'unavailable'); assert.deepEqual(await dispatch(store, command), result);
  }
  assert.deepEqual((await read(store, 'J-B', 'journey')).jobIds, []);
});

test('trace 1: saved partially charged research survives restart, profile correction and explicit resume', async t => {
  const { store, open } = await fixture(t); await setup(store); ok((await evidence(store)).result); await advice(store);
  const seeded = await seedAccounting(store);
  await store.close(); const reopened = await open();
  ok(await dispatch(reopened, { action: 'saveProfile', requestId: requestId(), profileId: 'P', journeyId: 'J-A', expectedVersion: 1, profile: { ...f.profile, availableHoursPerWeek: 2 } }));
  const result = ok(await dispatch(reopened, { action: 'resumeJourney', journeyId: 'J-A' }));
  const j = await read(reopened, 'J-A', 'journey');
  assert.equal(j.profile.version, 2); assert.equal(j.lastSavedStep, 'evidence-review'); assert.equal(j.selectedExperiment, null);
  assert.deepEqual(j.costs, 'costs' in seeded.journey ? seeded.journey.costs : null);
  assert.deepEqual(j.jobIds, ['K-A']); assert.deepEqual(await read(reopened, 'K-A', 'job'), seeded.job);
  assert.equal(result.reconciliationRequired, true); assert.equal(result.nextSafeStep, 'reconcile-uncertain-work');
  assert.equal(result.jobStatuses[0]!.accounting, null);
  assert.equal(result.jobStatuses[0]!.billing, 'unknown');
  assert.equal((await read(reopened, 'REC-A', 'recommendation')).validity, 'reassessment-required');
  assert.deepEqual(j.workload, 'workload' in seeded.journey ? seeded.journey.workload : null);
  // Step 6 only: actual crash classification, ledger settlement and no-external-replay execution.
});

test('trace 2: unknown completion preserves saved offer review, root/attempt/provider identities and charges', async t => {
  const { store, open } = await fixture(t); await setup(store); ok((await evidence(store)).result); await advice(store);
  const seeded = await seedAccounting(store, 'J-A', 'K-B', 'offer-review');
  await store.close(); const reopened = await open();
  const result = ok(await dispatch(reopened, { action: 'resumeJourney', journeyId: 'J-A' }));
  assert.equal(result.reconciliationRequired, true);
  const j = await read(reopened, 'J-A', 'journey'); assert.equal(j.lastSavedStep, 'offer-review'); assert.equal(j.selectedExperiment, null);
  error(await dispatch(reopened, { action: 'enqueueJob', requestId: requestId(), journeyId: 'J-A', expectedVersion: j.version, limits: f.limits }), 'reconciliation-required');
  assert.deepEqual(await read(reopened, 'K-B', 'job'), seeded.job); assert.deepEqual(await read(reopened, 'J-A', 'journey'), seeded.journey);
  // Step 6 only: reconciliation, permitted linked retry K-C/A-3, run/Journey reservation enforcement.
});

test('trace 3: sequential Journeys retain distinct experiments, prior learning, workloads and accounting', async t => {
  const { store, open } = await fixture(t); await setup(store); ok((await evidence(store)).result); await start(store);
  ok(await dispatch(store, { action: 'recordOutcome', requestId: requestId(), journeyId: 'J-A', expectedVersion: (await read(store, 'J-A', 'journey')).version, outcomeId: 'outcome-A', outcome: { experimentId: 'E-A', event: { kind: 'conversation', description: 'Synthetic learning' }, occurredAt: f.now, provenance: 'synthetic-self-report', supersedes: null } }));
  await seedAccounting(store, 'J-A', 'K-B', 'outcome-review');
  const old = await read(store, 'J-A', 'journey');
  await setup(store, 'J-B', [{ id: 'J-A', version: old.version }]);
  assert.equal((await read(store, 'J-B', 'journey')).selectedExperiment, null);
  ok(await dispatch(store, { action: 'reuseFixtureEvidence', requestId: requestId(), journeyId: 'J-B', expectedVersion: 1, evidence: [{ id: 'EV', version: 1 }] }));
  await start(store, 'J-B', 'B'); await seedAccounting(store, 'J-B', 'K-D', 'experiment-active');
  await store.close(); const reopened = await open();
  for (const id of ['J-A', 'J-B']) ok(await dispatch(reopened, { action: 'resumeJourney', journeyId: id }));
  assert.deepEqual(await read(reopened, 'J-A', 'journey'), old);
  const later = await read(reopened, 'J-B', 'journey');
  assert.equal(later.selectedExperiment?.id, 'E-B'); assert.equal(old.selectedExperiment?.id, 'E-A');
  assert.deepEqual(later.jobIds, ['K-D']); assert.deepEqual(old.jobIds, ['K-B']); assert.deepEqual(later.workload.evidenceIds, ['EV']);
  assert.deepEqual(later.priorLearning, [{ id: 'J-A', version: old.version }]);
  error(await dispatch(reopened, { action: 'resumeJourney', profileId: 'P' }), 'validation');
  error(await dispatch(reopened, { action: 'cancelJob', requestId: requestId(), journeyId: 'J-B', expectedVersion: later.version, jobId: 'K-B' }), 'conflict');
  // Step 6 only: later settlement of an old provider request against J-A, not J-B.
});

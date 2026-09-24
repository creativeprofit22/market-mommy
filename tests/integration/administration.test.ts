import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm, stat, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { DatabaseSync, backup as sqliteBackup } from 'node:sqlite';
import { migrate, migrations } from '../../src/adapters/sqlite/migrate.js';
import type { AdministrationRequest } from '../../src/application/administration.js';
import { lookupRecord } from '../../src/adapters/sqlite/repositories.js';
import { SqliteStorage } from '../../src/adapters/sqlite/client.js';
import { MAX_BYTES, exportSchema, hash } from '../../src/adapters/sqlite/export.js';
import { storedRecordSchema } from '../../src/domain/records.js';
import * as f from '../helpers/records.js';
import { cli, mcp } from '../helpers/interfaces.js';
import type { DispatchResult } from '../../src/application/dispatch.js';

test('populated schema 004 upgrades to 005 without changing historical records or receipts', async t => {
  const root = await mkdtemp(join(tmpdir(), 'market-mommy-upgrade-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const path = join(root, 'v4.sqlite');
  const db = new DatabaseSync(path, { enableForeignKeyConstraints: true });
  try {
    await migrate(db, path, migrations.filter(m => m.version <= 4));
    const payload = JSON.stringify({ ...f.base, ...f.profile, id: 'P' });
    db.exec('BEGIN');
    db.prepare('INSERT INTO record_identities(id,kind,latest_version) VALUES(?,?,?)').run('P', 'profile', 1);
    db.prepare('INSERT INTO record_versions VALUES(?,?,?,?,?)').run('P', 'profile', 1, f.now, payload);
    db.exec('COMMIT');
    const before = db.prepare('SELECT * FROM record_versions').all();
    const report = await migrate(db, path);
    assert.equal(report.version, 5); assert.ok(report.backupPath);
    assert.deepEqual(db.prepare('SELECT * FROM record_versions').all(), before);
    assert.equal(db.prepare('SELECT ledger_version FROM store_metadata').get()?.ledger_version, 0);
    assert.equal(db.prepare('PRAGMA foreign_key_check').all().length, 0);
    const copy = new DatabaseSync(report.backupPath, { readOnly: true });
    try {
      assert.equal(copy.prepare('SELECT MAX(version) n FROM schema_migrations').get()?.n, 4);
      assert.deepEqual(copy.prepare('SELECT * FROM record_versions').all(), before);
    } finally { copy.close(); }
    assert.equal((await migrate(db, path)).backupPath, null);
  } finally { db.close(); }
  const store = await SqliteStorage.open(path);
  try {
    assert.equal((await store.read('P'))?.data.id, 'P');
    await store.administer({ action: 'export', destination: join(root, 'upgraded.json') });
  } finally { await store.close(); }
});

test('backup rejects a physical artifact over 16 MiB while bounded semantic export remains available and source is unchanged', async t => {
  const root = await mkdtemp(join(tmpdir(), 'market-mommy-backup-limit-'));
  const source = join(root, 'source.sqlite');
  const s = await SqliteStorage.open(source, ['read', 'fixture-write']);
  t.after(async () => { await s.close(); await rm(root, { recursive: true, force: true }); });
  for (let offset = 0; offset < 5000; offset += 32) {
    await s.append(Array.from({ length: Math.min(32, 5000 - offset) }, (_, i) => ({
      record: storedRecordSchema.parse({ kind: 'observation', data: { ...f.base, ...f.observation, id: `O-${offset + i}`, statement: 'x'.repeat(2000) } }),
      expectedVersion: 0, dependencies: [],
    })));
  }
  const beforePath = join(root, 'before.json');
  await s.administer({ action: 'export', destination: beforePath });
  const before = exportSchema.parse(JSON.parse(await readFile(beforePath, 'utf8')));
  const semanticBytes = Buffer.byteLength(JSON.stringify(before.tables));
  assert.ok(semanticBytes < MAX_BYTES);
  assert.ok((await stat(beforePath)).size < MAX_BYTES);
  assert.equal(before.tables.record_versions.length, 5000);

  // Measure a real SQLite artifact independently, without modifying the source.
  const probe = new DatabaseSync(source, { readOnly: true });
  const rawBackup = join(root, 'raw.sqlite');
  try { await sqliteBackup(probe, rawBackup); } finally { probe.close(); }
  const physicalBytes = (await stat(rawBackup)).size;
  assert.ok(physicalBytes > MAX_BYTES);
  t.diagnostic(`semantic snapshot bytes=${semanticBytes}; SQLite backup bytes=${physicalBytes}; limit=${MAX_BYTES}`);

  const destination = join(root, 'rejected.sqlite');
  const filesBefore = (await readdir(root)).sort();
  await assert.rejects(s.administer({ action: 'backup', destination }), { code: 'validation' });
  await assert.rejects(stat(destination), { code: 'ENOENT' });
  assert.deepEqual((await readdir(root)).sort(), filesBefore);
  const afterPath = join(root, 'after.json');
  await s.administer({ action: 'export', destination: afterPath });
  const after = exportSchema.parse(JSON.parse(await readFile(afterPath, 'utf8')));
  assert.equal(after.sourceStoreId, before.sourceStoreId);
  assert.equal(after.ledgerVersion, before.ledgerVersion);
  assert.deepEqual(after.tables, before.tables);
  for (const id of ['O-0', 'O-4999']) {
    const row = before.tables.record_versions.find(row => row.id === id)!;
    assert.deepEqual((await s.read(id))?.data, JSON.parse(row.payload));
  }
});

const grants = ['read', 'fixture-write', 'fixture-run', 'cancel'] as const;
const profile = { action: 'saveProfile', requestId: 'profile-request', profileId: 'P', expectedVersion: 0, profile: f.profile };
async function send(s: SqliteStorage, command: unknown) {
  const result = await s.dispatch(JSON.stringify(command));
  assert.equal(result.status, 'ok', JSON.stringify(result)); return result;
}
async function journey(s: SqliteStorage) {
  const r = await s.read('J'); assert.equal(r?.kind, 'journey');
  if (r?.kind !== 'journey') throw new Error('Missing Journey'); return r.data;
}
async function populate(s: SqliteStorage) {
  const receipt = await send(s, profile);
  await send(s, { action: 'createJourney', requestId: 'journey-request', journeyId: 'J', profileId: 'P', profileVersion: 1, expectedVersion: 0, priorLearning: [] });
  await send(s, { action: 'acceptFixtureEvidence', requestId: 'evidence-request', journeyId: 'J', expectedVersion: (await journey(s)).version, expectedObservationVersion: 0, expectedEvidenceVersion: 0, observationId: 'O', evidenceId: 'EV', observation: { ...f.observation, statement: 'REMOVED-SENTINEL' }, evidence: { ...f.evidence, observation: { id: 'O', version: 1 } } });
  for (const [n, actual] of [7, null].entries()) {
    await send(s, { action: 'enqueueJob', requestId: `enqueue-${n}`, journeyId: 'J', expectedVersion: (await journey(s)).version, limits: f.limits });
    const [job] = await s.workflow({ action: 'claim', ownerId: 'owner', leaseMs: 120000 }); assert.ok(job);
    await s.workflow({ action: 'settle', journeyId: 'J', jobId: job.id, ownerId: 'owner', fence: job.fence, state: actual === null ? 'reconciliation-required' : 'succeeded', actualMinorUnits: actual, providerRequestId: `provider-${n}` });
  }
  return receipt;
}

test('populated backup/semantic recovery preserves exact tables, receipts, accounting and uncertain jobs; removal ledger prevents resurrection', async t => {
  const root = await mkdtemp(join(tmpdir(), 'market-mommy-admin-'));
  const stores: SqliteStorage[] = [];
  const open = async (name: string) => { const s = await SqliteStorage.open(join(root, name), grants); stores.push(s); return s; };
  t.after(async () => { await Promise.all(stores.map(s => s.close())); await rm(root, { recursive: true, force: true }); });
  const s = await open('source.sqlite'); const receipt = await populate(s);
  const artifact = join(root, 'export.json'); const ledger = join(root, 'ledger.json'); const backup = join(root, 'backup.sqlite');
  await s.administer({ action: 'export', destination: artifact });
  await s.administer({ action: 'exportRemovalLedger', destination: ledger });
  const original = exportSchema.parse(JSON.parse(await readFile(artifact, 'utf8')));
  assert.ok(original.tables.record_dependencies.length); assert.ok(original.tables.workflow_receipts.length);
  assert.ok(original.tables.record_versions.length > original.tables.record_identities.length);
  const b = await s.administer({ action: 'backup', destination: backup });
  assert.equal(b.checksum, hash({ sourceStoreId: original.sourceStoreId, ledgerVersion: 0, tables: original.tables }));
  for (const action of ['import', 'restoreBackup'] as const) {
    const destination = join(root, `${action}.sqlite`);
    const report = await s.administer(action === 'import' ? { action, source: artifact, destination, ledger } : { action, source: backup, destination, ledger, checksum: b.checksum });
    assert.ok(Number.isFinite(report.elapsedMs)); assert.ok(report.elapsedMs >= 0); assert.equal(report.verified, true);
    if (action === 'restoreBackup') t.diagnostic(`restore elapsedMs=${report.elapsedMs}`);
    const copy = await open(`${action}.sqlite`);
    const out = join(root, `${action}.json`); await copy.administer({ action: 'export', destination: out });
    assert.deepEqual(exportSchema.parse(JSON.parse(await readFile(out, 'utf8'))).tables, original.tables);
    assert.deepEqual(await send(copy, profile), receipt);
    assert.deepEqual((await journey(copy)).costs, { actualMinorUnits: '7', outstandingMinorUnits: '25', unknownMinorUnits: '25' });
    assert.deepEqual(await copy.workflow({ action: 'claim', ownerId: 'recovery', leaseMs: 1000 }), []);
    for (const row of original.tables.record_versions) assert.deepEqual((await copy.read(row.id, row.version))?.data, JSON.parse(row.payload));
  }
  await assert.rejects(s.administer({ action: 'restoreBackup', source: backup, destination: join(root, 'bad-checksum.sqlite'), ledger, checksum: '0'.repeat(64) }), { code: 'validation' });
  const existing = join(root, 'existing.sqlite'); await writeFile(existing, 'DO NOT OVERWRITE');
  await assert.rejects(s.administer({ action: 'backup', destination: existing }), { code: 'storage-failure' });
  assert.equal(await readFile(existing, 'utf8'), 'DO NOT OVERWRITE');
  await assert.rejects(s.administer({ action: 'restoreBackup', source: backup, destination: existing, ledger, checksum: b.checksum }), { code: 'storage-failure' });
  assert.equal(await readFile(existing, 'utf8'), 'DO NOT OVERWRITE');
  const later = { ...profile, requestId: 'later-request', profileId: 'LATER' }; await send(s, later);
  const before = await journey(s);
  await s.administer({ action: 'removeFixtures', recordIds: ['O', 'LATER'] });
  assert.equal(await s.read('O'), null); assert.equal(await s.read('EV'), null);
  assert.deepEqual(await journey(s), before);
  const newest = join(root, 'new-ledger.json'); await s.administer({ action: 'exportRemovalLedger', destination: newest });
  const removed = join(root, 'removed.json'); await s.administer({ action: 'export', destination: removed });
  assert.ok(!(await readFile(removed, 'utf8')).includes('REMOVED-SENTINEL'));
  await assert.rejects(s.administer({ action: 'reapplyRemovalLedger', ledger }));
  await assert.rejects(s.administer({ action: 'import', source: removed, destination: join(root, 'stale.sqlite'), ledger }), { code: 'validation' });
  await s.administer({ action: 'restoreBackup', source: backup, destination: join(root, 'redacted.sqlite'), ledger: newest, checksum: b.checksum });
  const recovered = await open('redacted.sqlite');
  for (const id of ['O', 'EV', 'LATER']) assert.equal(await recovered.read(id), null);
  for (const command of [profile, later]) assert.equal((await recovered.dispatch(JSON.stringify(command))).status, 'error');
  assert.deepEqual(await journey(recovered), before);
  await send(recovered, { action: 'resumeJourney', journeyId: 'J' });
  const first = await recovered.administer({ action: 'reapplyRemovalLedger', ledger: newest });
  const second = await recovered.administer({ action: 'reapplyRemovalLedger', ledger: newest }); assert.equal(first.checksum, second.checksum);
  await send(recovered, { action: 'resumeJourney', journeyId: 'J' });
  const after = join(root, 'source-after.json'); await s.administer({ action: 'export', destination: after });
  assert.deepEqual(exportSchema.parse(JSON.parse(await readFile(after, 'utf8'))).tables, exportSchema.parse(JSON.parse(await readFile(removed, 'utf8'))).tables);
});

for (const removedId of ['O', 'P', 'E']) for (const state of ['queued', 'running']) {
  test(`removed ${removedId}: ${state} cancellation and resume through dispatch/CLI/MCP, including older backup`, async t => {
    const root = await mkdtemp(join(tmpdir(), 'market-mommy-removed-progress-'));
    const sourcePath = join(root, 'source.sqlite');
    const s = await SqliteStorage.open(sourcePath, grants);
    const stores = [s];
    t.after(async () => { await Promise.all(stores.map(store => store.close())); await rm(root, { recursive: true, force: true }); });
    await populate(s);
    if (state === 'running') await s.workflow({ action: 'reconcile', adjustmentId: 'prior-reconciled', journeyId: 'J', jobId: (await journey(s)).jobIds.at(-1)!, actualMinorUnits: 3, providerRequestId: 'provider-1' });
    for (const record of [
      { kind: 'recommendation', data: { ...f.recommendation, id: 'R', journeyId: 'J', profile: { id: 'P', version: 1 }, evidence: [{ id: 'EV', version: 1 }], decision: { kind: 'action', buyer: 'Fixture', problem: 'Fixture', action: 'Manual test', fit: 'Fixture', economicAssumptions: ['Unknown'], experiment: 'Fixture', successConditions: ['Observation'], stopConditions: ['No access'], changesAdvice: ['Correction'] } } },
      { kind: 'offer', data: { ...f.offer, id: 'OFF', journeyId: 'J', recommendation: { id: 'R', version: 1 } } },
    ]) await send(s, { action: 'saveFixtureAdvice', requestId: `save-${record.kind}`, journeyId: 'J', expectedVersion: (await journey(s)).version, expectedRecordVersion: 0, record });
    await send(s, { action: 'startExperiment', requestId: 'start', journeyId: 'J', expectedVersion: (await journey(s)).version, experimentId: 'E', baseline: { ...f.baseline, recommendation: { id: 'R', version: 1 }, offer: { id: 'OFF', version: 1 } } });
    await send(s, { action: 'enqueueJob', requestId: 'pending', journeyId: 'J', expectedVersion: (await journey(s)).version, limits: f.limits });
    const jobId = (await journey(s)).jobIds.at(-1)!;
    if (state === 'running') {
      const [claimed] = await s.workflow({ action: 'claim', ownerId: 'active-owner', leaseMs: 120000 });
      assert.equal(claimed?.id, jobId);
    }
    const before = await journey(s);
    const originalJob = await s.read(jobId);
    const backup = join(root, 'old.sqlite'), ledger = join(root, 'new-ledger.json');
    const report = await s.administer({ action: 'backup', destination: backup });
    await s.administer({ action: 'removeFixtures', recordIds: [removedId] });
    await s.administer({ action: 'exportRemovalLedger', destination: ledger });
    assert.deepEqual(await journey(s), before);
    const db = new DatabaseSync(sourcePath, { readOnly: true });
    try {
      assert.equal(lookupRecord(db, 'J').status, 'available');
      assert.equal(lookupRecord(db, 'absent').status, 'missing');
      assert.equal(lookupRecord(db, removedId, 999).status, 'missing');
      assert.equal(lookupRecord(db, removedId, 1).status, 'removed');
    } finally { db.close(); }
    for (const transport of ['dispatch', 'cli', 'mcp'] as const) {
      const path = transport === 'dispatch' ? sourcePath : join(root, `${transport}.sqlite`);
      if (transport !== 'dispatch') await s.administer({ action: 'restoreBackup', source: backup, destination: path, ledger, checksum: report.checksum });
      const store = transport === 'dispatch' ? s : await SqliteStorage.open(path, grants);
      if (store !== s) stores.push(store);
      const peer = transport === 'mcp' ? await mcp(path, root) : null;
      try {
        const call = (command: Record<string, unknown>): Promise<DispatchResult> => transport === 'dispatch' ? store.dispatch(JSON.stringify(command)) : peer ? peer.call(command) : cli(path, root, command);
        const resume = await call({ action: 'resumeJourney', journeyId: 'J' });
        assert.equal(resume.status, 'ok', JSON.stringify(resume));
        if (resume.status !== 'ok') throw new Error('Resume failed');
        assert.ok(resume.data.removedDependencies.some(item => item.id === (removedId === 'O' ? 'EV' : removedId)));
        assert.ok(resume.warnings.length > 1);
        assert.equal(resume.data.independentOriginsComplete, removedId !== 'O');
        assert.deepEqual(resume.data.independentOrigins, removedId === 'O' ? [] : ['origin-1']);
        assert.ok(!JSON.stringify(resume).includes('REMOVED-SENTINEL'));
        if (removedId === 'P') assert.ok(!resume.data.records.some(record => record.kind === 'profile'));
        assert.ok(!resume.data.records.some(record => record.kind === 'experiment'));
        assert.deepEqual(await journey(store), before);
        const cancel = { action: 'cancelJob', requestId: `fresh-${transport}`, journeyId: 'J', expectedVersion: before.version, jobId };
        const result = await call(cancel);
        assert.equal(result.status, 'ok', JSON.stringify(result));
        if (result.status === 'ok') assert.deepEqual(result.data.removedDependencies, resume.data.removedDependencies);
        assert.deepEqual(await call(cancel), result);
        const after = await journey(store);
        assert.deepEqual(after.workload, before.workload); assert.deepEqual(after.history, before.history);
        assert.deepEqual(after.jobIds, before.jobIds); assert.deepEqual(after.selectedExperiment, before.selectedExperiment);
        assert.deepEqual(after.costs, { ...before.costs, outstandingMinorUnits: state === 'queued' ? String(BigInt(before.costs.outstandingMinorUnits) - 25n) : before.costs.outstandingMinorUnits });
        const job = await store.read(jobId);
        assert.equal(job?.kind, 'job'); assert.equal(originalJob?.kind, 'job');
        if (job?.kind !== 'job' || originalJob?.kind !== 'job') throw new Error('Missing job');
        assert.equal(job.data.state, state === 'queued' ? 'cancelled' : 'cancel-requested');
        assert.equal(job.data.attemptId, originalJob.data.attemptId);
        assert.deepEqual(job.data.inputVersions, originalJob.data.inputVersions);
        assert.equal((await call({ action: 'resumeJourney', journeyId: 'J' })).status, 'ok');
        const blocked = await call(profile); assert.equal(blocked.status, 'error');
        if (blocked.status === 'error') assert.equal(blocked.error.code, 'conflict');
        assert.equal(await store.read(removedId), null);
        const artifact = join(root, `${transport}-after.json`);
        await store.administer({ action: 'export', destination: artifact });
        if (removedId === 'O') assert.ok(!(await readFile(artifact, 'utf8')).includes('REMOVED-SENTINEL'));
      } finally { await peer?.close(); }
    }
  });
}

test('imports fail closed on corrupt hashes, malformed domains, typed references, unknown/future fields, ledger and destination errors', async t => {
  const root = await mkdtemp(join(tmpdir(), 'market-mommy-admin-invalid-'));
  const s = await SqliteStorage.open(join(root, 'source.sqlite'), grants);
  t.after(async () => { await s.close(); await rm(root, { recursive: true, force: true }); });
  await populate(s);
  const source = join(root, 'source.json'), ledger = join(root, 'ledger.json');
  await s.administer({ action: 'export', destination: source }); await s.administer({ action: 'exportRemovalLedger', destination: ledger });
  const original = exportSchema.parse(JSON.parse(await readFile(source, 'utf8')));
  let n = 0;
  for (const change of ['hash', 'domain', 'reference', 'accounting', 'unknown', 'future']) {
    const value = structuredClone(original);
    if (change === 'domain' || change === 'reference') {
      const row = value.tables.record_versions.find(r => r.kind === 'evidence')!;
      const payload = JSON.parse(row.payload) as Record<string, unknown>;
      if (change === 'domain') payload.freshness = 'invalid'; else payload.observation = { id: 'P', version: 1 };
      row.payload = JSON.stringify(payload);
    }
    if (change === 'accounting') {
      const row = value.tables.record_versions.filter(row => row.kind === 'journey').at(-1)!;
      const data = JSON.parse(row.payload) as { costs: { actualMinorUnits: string } };
      data.costs.actualMinorUnits = '0'; row.payload = JSON.stringify(data);
    }
    const body: Record<string, unknown> = { ...value }; delete body.checksum;
    if (change === 'unknown') body.extra = true;
    if (change === 'future') body.formatVersion = 2;
    const corrupt = join(root, `corrupt-${n}.json`); await writeFile(corrupt, JSON.stringify({ ...body, checksum: change === 'hash' ? '0'.repeat(64) : hash(body) }));
    await assert.rejects(s.administer({ action: 'import', source: corrupt, ledger, destination: join(root, `reject-${n++}.sqlite`) }));
  }
  await assert.rejects(s.administer({ action: 'import', source, ledger: join(root, 'missing'), destination: join(root, 'missing.sqlite') }));
  await assert.rejects(s.administer({ action: 'import', source, destination: join(root, 'omitted.sqlite') } as AdministrationRequest), { code: 'validation' });
  const other = await SqliteStorage.open(join(root, 'other.sqlite'), grants);
  const mismatched = join(root, 'other-ledger.json');
  try { await other.administer({ action: 'exportRemovalLedger', destination: mismatched }); }
  finally { await other.close(); }
  await assert.rejects(s.administer({ action: 'import', source, ledger: mismatched, destination: join(root, 'mismatched.sqlite') }), { code: 'validation' });
  const destination = join(root, 'existing'); await writeFile(destination, 'DO NOT OVERWRITE');
  await assert.rejects(s.administer({ action: 'import', source, ledger, destination })); assert.equal(await readFile(destination, 'utf8'), 'DO NOT OVERWRITE');
  const reader = await SqliteStorage.open(join(root, 'source.sqlite'));
  try {
    await assert.rejects(reader.administer({ action: 'removeFixtures', recordIds: ['O'] }), { code: 'unauthorized' });
    await assert.rejects(reader.administer({ action: 'import', source, ledger, destination: join(root, 'denied.sqlite') }), { code: 'unauthorized' });
  } finally { await reader.close(); }
});

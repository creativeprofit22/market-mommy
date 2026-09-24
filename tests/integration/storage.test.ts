import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import type { TestContext } from 'node:test';
import { SqliteStorage } from '../../src/adapters/sqlite/client.js';
import { migrate, migrations } from '../../src/adapters/sqlite/migrate.js';
import { appendRecords } from '../../src/adapters/sqlite/repositories.js';
import { businessProfileSchema } from '../../src/domain/profile.js';
import type { RecordWrite } from '../../src/application/ports.js';
import * as fixture from '../helpers/records.js';

async function directory(t: TestContext): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'market-mommy-storage-'));
  t.after(async () => { await rm(root, { recursive: true, force: true }); });
  return root;
}
function write(id = 'P', version = 1): RecordWrite {
  return { record: { kind: 'profile', data: businessProfileSchema.parse({ ...fixture.base, ...fixture.profile, id, version }) }, expectedVersion: version - 1, dependencies: [] };
}

test('on-disk worker writes survive close/reopen and preserve old versions', async t => {
  const root = await directory(t);
  const path = join(root, 'fixture.sqlite');
  let store = await SqliteStorage.open(path, ['read', 'fixture-write']);
  try {
    await store.append([write()]);
    await store.append([write('P', 2)]);
    assert.equal((await store.read('P'))?.data.version, 2);
    assert.equal((await store.read('P', 1))?.data.version, 1);
  } finally { await store.close(); }
  store = await SqliteStorage.open(path, ['read', 'fixture-write']);
  try {
    assert.deepEqual(await store.info(), { schemaVersion: 5, records: 1, versions: 2 });
    assert.deepEqual(await store.read('P', 1), write().record);
  } finally { await store.close(); }
});

test('a failed batched write rolls back identities, versions and dependencies', async t => {
  const root = await directory(t);
  const store = await SqliteStorage.open(join(root, 'fixture.sqlite'), ['read', 'fixture-write']);
  try {
    const second = write('Q');
    second.dependencies = [{ id: 'missing', version: 1 }];
    await assert.rejects(store.append([write(), second]), { code: 'storage-failure' });
    assert.deepEqual(await store.info(), { schemaVersion: 5, records: 0, versions: 0 });
    await store.append([write()]);
    await assert.rejects(store.append([write()]), { code: 'conflict' });
    assert.equal((await store.info()).versions, 1);
  } finally { await store.close(); }
});

test('independent workers cannot both win an expected-version write', async t => {
  const root = await directory(t);
  const path = join(root, 'fixture.sqlite');
  const first = await SqliteStorage.open(path, ['read', 'fixture-write']);
  const second = await SqliteStorage.open(path, ['read', 'fixture-write']);
  try {
    const results = await Promise.allSettled([first.append([write()]), second.append([write()])]);
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal((await first.info()).versions, 1);
  } finally { await Promise.all([first.close(), second.close()]); }
});

test('lock contention fails within busy timeout without losing committed records', async t => {
  const root = await directory(t);
  const path = join(root, 'fixture.sqlite');
  const store = await SqliteStorage.open(path, ['read', 'fixture-write']);
  const locker = new DatabaseSync(path);
  try {
    await store.append([write()]);
    locker.exec('BEGIN IMMEDIATE');
    await assert.rejects(store.append([write('Q')]), { code: 'storage-failure' });
    locker.exec('ROLLBACK');
    assert.deepEqual(await store.info(), { schemaVersion: 5, records: 1, versions: 1 });
  } finally {
    if (locker.isTransaction) locker.exec('ROLLBACK');
    locker.close();
    await store.close();
  }
});

test('populated additive migration makes a consistent backup and is idempotent', async t => {
  const root = await directory(t);
  const path = join(root, 'fixture.sqlite');
  const db = new DatabaseSync(path, { enableForeignKeyConstraints: true });
  try {
    db.exec('PRAGMA journal_mode=WAL');
    const initial = migrations[0];
    assert.ok(initial);
    await migrate(db, path, [initial]);
    // Populate historical schema directly; current repositories require schema 5.
    db.exec('BEGIN');
    db.prepare('INSERT INTO record_identities(id,kind,latest_version) VALUES(?,?,?)').run('P', 'profile', 1);
    db.prepare('INSERT INTO record_versions VALUES(?,?,?,?,?)').run('P', 'profile', 1, fixture.now, JSON.stringify(write().record.data));
    db.exec('COMMIT');
    const upgraded = await migrate(db, path);
    assert.equal(upgraded.version, 5);
    assert.ok(upgraded.backupPath);
    const copy = new DatabaseSync(upgraded.backupPath, { readOnly: true });
    try {
      assert.equal(copy.prepare('SELECT COUNT(*) n FROM record_versions').get()?.n, 1);
      assert.equal(copy.prepare('SELECT MAX(version) n FROM schema_migrations').get()?.n, 1);
      assert.equal(copy.prepare('PRAGMA integrity_check').get()?.integrity_check, 'ok');
    } finally { copy.close(); }
    assert.equal((await migrate(db, path)).backupPath, null);
    assert.equal((await readdir(root)).filter(name => name.includes('pre-migration-') && name.endsWith('.sqlite')).length, 1);
  } finally { db.close(); }
});

test('bad migration rolls back; changed checksum and future schema fail closed', async t => {
  const root = await directory(t);
  const path = join(root, 'fixture.sqlite');
  const db = new DatabaseSync(path, { enableForeignKeyConstraints: true });
  try {
    await migrate(db, path);
    appendRecords(db, [write()]);
    await assert.rejects(migrate(db, path, [...migrations, { version: 6, name: 'bad.sql', sql: 'CREATE TABLE should_rollback (id INTEGER); INVALID SQL;' }]));
    assert.equal(db.prepare("SELECT name FROM sqlite_schema WHERE name='should_rollback'").get(), undefined);
    assert.equal(db.prepare('SELECT MAX(version) n FROM schema_migrations').get()?.n, 5);
    assert.equal(db.prepare('SELECT COUNT(*) n FROM record_versions').get()?.n, 1);
    const changed = migrations.map(m => m.version === 1 ? { ...m, sql: m.sql + '\n-- changed' } : m);
    await assert.rejects(migrate(db, path, changed), { code: 'storage-failure' });
    db.prepare('INSERT INTO schema_migrations VALUES (?,?,?)').run(6, 'future.sql', 'a'.repeat(64));
    await assert.rejects(migrate(db, path), { code: 'storage-failure' });
    assert.equal(db.prepare('SELECT COUNT(*) n FROM record_versions').get()?.n, 1);
  } finally { db.close(); }
});

test('killing a process inside a migration leaves the previous schema and records usable', async t => {
  const root = await directory(t);
  const path = join(root, 'fixture.sqlite');
  const store = await SqliteStorage.open(path, ['read', 'fixture-write']);
  await store.append([write()]);
  await store.close();
  const child = fork(new URL('../helpers/storage-crash.js', import.meta.url), [path], { env: {}, stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
  const exited = new Promise<void>((resolve, reject) => { child.once('exit', () => resolve()); child.once('error', reject); });
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Migration child readiness timeout')), 15000);
      child.once('message', value => { clearTimeout(timer); if ((value as { state?: string }).state === 'uncommitted') resolve(); else reject(new Error('Unexpected child state')); });
      child.once('exit', () => { clearTimeout(timer); reject(new Error('Child exited before transaction marker')); });
    });
    child.kill('SIGKILL');
    await exited;
    const reopened = await SqliteStorage.open(path, ['read', 'fixture-write']);
    try { assert.deepEqual(await reopened.info(), { schemaVersion: 5, records: 1, versions: 1 }); }
    finally { await reopened.close(); }
    const db = new DatabaseSync(path, { readOnly: true });
    try { assert.equal(db.prepare("SELECT name FROM sqlite_schema WHERE name='interrupted_migration'").get(), undefined); }
    finally { db.close(); }
  } finally {
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    await exited;
  }
});

test('unwritable and unrelated databases are not silently recreated', async t => {
  const root = await directory(t);
  await assert.rejects(SqliteStorage.open(root), { code: 'storage-failure' });
  const path = join(root, 'unrelated.sqlite');
  const db = new DatabaseSync(path);
  db.exec('CREATE TABLE unrelated (id INTEGER); INSERT INTO unrelated VALUES (7)');
  db.close();
  await assert.rejects(SqliteStorage.open(path, ['read', 'fixture-write']), { code: 'storage-failure' });
  const check = new DatabaseSync(path, { readOnly: true });
  try { assert.equal(check.prepare('SELECT id FROM unrelated').get()?.id, 7); }
  finally { check.close(); }
});

test('SQL itself enforces identity/version consistency, foreign keys and immutable history', async t => {
  const root = await directory(t);
  const path = join(root, 'fixture.sqlite');
  const db = new DatabaseSync(path, { enableForeignKeyConstraints: true });
  try {
    await migrate(db, path);
    appendRecords(db, [write()]);
    assert.throws(() => db.prepare('UPDATE record_versions SET payload=? WHERE id=?').run('{}', 'P'));
    assert.throws(() => db.prepare('DELETE FROM record_versions WHERE id=?').run('P'));
    assert.throws(() => db.prepare('UPDATE record_identities SET latest_version=2 WHERE id=?').run('P'));
    assert.throws(() => db.prepare('INSERT INTO record_dependencies VALUES (?,?,?,?)').run('P', 1, 'missing', 1));
    assert.equal(db.prepare('PRAGMA foreign_key_check').all().length, 0);
  } finally { db.close(); }
});

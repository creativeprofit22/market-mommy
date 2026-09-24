import { createHash, randomUUID } from 'node:crypto';
import { closeSync, openSync, readFileSync } from 'node:fs';
import { DatabaseSync, backup } from 'node:sqlite';
import { DomainError } from '../../domain/errors.js';

export interface Migration { version: number; name: string; sql: string }
export const migrations: readonly Migration[] = [
  { version: 1, name: '001_initial.sql', sql: readFileSync(new URL('../../../../migrations/001_initial.sql', import.meta.url), 'utf8') },
  { version: 2, name: '002_dependency_indexes.sql', sql: readFileSync(new URL('../../../../migrations/002_dependency_indexes.sql', import.meta.url), 'utf8') },
  { version: 3, name: '003_workflow.sql', sql: readFileSync(new URL('../../../../migrations/003_workflow.sql', import.meta.url), 'utf8') },
  { version: 4, name: '004_fixture_results.sql', sql: readFileSync(new URL('../../../../migrations/004_fixture_results.sql', import.meta.url), 'utf8') },
  { version: 5, name: '005_administration.sql', sql: readFileSync(new URL('../../../../migrations/005_administration.sql', import.meta.url), 'utf8') },
];
function checksum(sql: string): string { return createHash('sha256').update(sql.replaceAll('\r\n', '\n')).digest('hex'); }
function existing(db: DatabaseSync): { version: number; checksum: string }[] {
  const table = db.prepare("SELECT name FROM sqlite_schema WHERE type='table' AND name='schema_migrations'").get();
  if (!table) {
    const others = db.prepare("SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%'").get();
    if (others) throw new DomainError('storage-failure');
    return [];
  }
  return db.prepare('SELECT version, checksum FROM schema_migrations ORDER BY version').all() as unknown as { version: number; checksum: string }[];
}
function checkApplied(applied: ReturnType<typeof existing>, available: readonly Migration[]): void {
  for (const [index, row] of applied.entries()) {
    const migration = available[index];
    if (!migration || row.version !== migration.version || row.checksum !== checksum(migration.sql)) throw new DomainError('storage-failure');
  }
}

/** Only checked-in/trusted migration definitions; never accept SQL from a request. */
export async function migrate(db: DatabaseSync, path: string, available: readonly Migration[] = migrations): Promise<{ version: number; backupPath: string | null }> {
  if (available.some((migration, index) => migration.version !== index + 1)) throw new DomainError('storage-failure');
  const applied = existing(db);
  checkApplied(applied, available);
  if (applied.length === available.length) return { version: applied.length, backupPath: null };
  let backupPath: string | null = null;
  if (applied.length > 0) {
    backupPath = `${path}.pre-migration-${randomUUID()}.sqlite`;
    // Exclusive reservation: the backup API only overwrites the empty file we own.
    closeSync(openSync(backupPath, 'wx', 0o600));
    await backup(db, backupPath);
    const copy = new DatabaseSync(backupPath, { readOnly: true });
    try {
      if (copy.prepare('PRAGMA integrity_check').get()?.integrity_check !== 'ok' || copy.prepare('PRAGMA foreign_key_check').all().length) throw new DomainError('storage-failure');
    } finally { copy.close(); }
  }
  db.exec('BEGIN IMMEDIATE');
  try {
    const current = existing(db);
    checkApplied(current, available);
    db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY NOT NULL CHECK(version > 0), name TEXT NOT NULL, checksum TEXT NOT NULL CHECK(length(checksum)=64)) STRICT');
    for (const migration of available.slice(current.length)) {
      db.exec(migration.sql);
      db.prepare('INSERT INTO schema_migrations(version,name,checksum) VALUES (?,?,?)').run(migration.version, migration.name, checksum(migration.sql));
    }
    if (db.prepare('PRAGMA foreign_key_check').all().length) throw new DomainError('storage-failure');
    db.exec('COMMIT');
    return { version: available.length, backupPath };
  } catch (error) {
    if (db.isTransaction) db.exec('ROLLBACK');
    throw error;
  }
}

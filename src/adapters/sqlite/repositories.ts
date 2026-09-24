import { z } from 'zod';
import { DatabaseSync } from 'node:sqlite';
import { idSchema, nextVersion, referenceSchema, validate, versionSchema } from '../../domain/common.js';
import { DomainError } from '../../domain/errors.js';
import { recordKindSchema, storedRecordSchema } from '../../domain/records.js';
import type { StoredRecord } from '../../domain/records.js';
import { assertExperimentRevision } from '../../domain/experiment.js';
import { assertJobTransition, HOST_LIMITS } from '../../domain/job.js';
import type { RecordLookup, RecordWrite, StorageInfo } from '../../application/ports.js';

const writesSchema = z.array(z.strictObject({
  record: storedRecordSchema, expectedVersion: z.number().int().min(0).max(2_147_483_646), dependencies: z.array(referenceSchema).max(1_100),
})).min(1).max(64);

export function lookupRecord(db: DatabaseSync, id: string, version?: number): RecordLookup {
  validate(idSchema, id);
  if (version !== undefined) validate(versionSchema, version);
  const removed = db.prepare(`SELECT v.kind, v.version FROM record_versions v
    JOIN record_identities i ON i.id=v.id
    JOIN removal_tombstones t ON t.record_id=v.id
    WHERE v.id=? AND v.version=COALESCE(?,i.latest_version)`).get(id, version ?? null);
  if (removed) return { status: 'removed', kind: validate(recordKindSchema, removed.kind), id, version: validate(versionSchema, removed.version) };
  const record = readRecord(db, id, version);
  return record ? { status: 'available', record } : { status: 'missing' };
}
export function readRecord(db: DatabaseSync, id: string, version?: number): StoredRecord | null {
  validate(idSchema, id);
  if (version !== undefined) validate(versionSchema, version);
  const row = db.prepare(`SELECT v.kind, v.payload FROM record_versions v
    JOIN record_identities i ON i.id=v.id
    WHERE v.id=? AND v.version=COALESCE(?,i.latest_version)
    AND NOT EXISTS (SELECT 1 FROM removal_tombstones t WHERE t.record_id=v.id)`).get(id, version ?? null);
  if (!row) return null;
  if (typeof row.payload !== 'string' || Buffer.byteLength(row.payload) > HOST_LIMITS.inputBytes) throw new DomainError('storage-failure');
  return validate(storedRecordSchema, { kind: row.kind, data: JSON.parse(row.payload) as unknown });
}
export function appendRecords(db: DatabaseSync, input: readonly RecordWrite[], workflowWrite = false): void {
  const writes = validate(writesSchema, input);
  if (new Set(writes.map(write => write.record.data.id)).size !== writes.length) throw new DomainError('validation');
  if (Buffer.byteLength(JSON.stringify(writes)) > HOST_LIMITS.inputBytes) throw new DomainError('validation');
  const ownsTransaction = !db.isTransaction;
  if (ownsTransaction) db.exec('BEGIN IMMEDIATE');
  try {
    for (const { record, expectedVersion } of writes) {
      const { kind, data } = record;
      if (kind === 'job' && !workflowWrite && db.prepare("SELECT name FROM sqlite_schema WHERE name='workflow_attempts'").get() && db.prepare('SELECT 1 FROM workflow_attempts WHERE job_id=?').get(data.id)) throw new DomainError('unauthorized');
      const prior = db.prepare('SELECT kind, journey_id, latest_version FROM record_identities WHERE id=?').get(data.id);
      const journeyId = 'journeyId' in data ? data.journeyId : null;
      if (prior && (prior.kind !== kind || prior.journey_id !== journeyId)) throw new DomainError('conflict');
      if (db.prepare('SELECT record_id FROM removal_tombstones WHERE record_id=?').get(data.id) || db.prepare('SELECT record_id FROM removal_ledger WHERE record_id=?').get(data.id)) throw new DomainError('conflict');
      if (nextVersion(prior ? Number(prior.latest_version) : 0, expectedVersion) !== data.version) throw new DomainError('conflict');
      const before = prior ? readRecord(db, data.id) : null;
      if (before && before.data.createdAt !== data.createdAt) throw new DomainError('conflict');
      if (before?.kind === 'outcome') throw new DomainError('conflict');
      if (before?.kind === 'experiment' && record.kind === 'experiment') assertExperimentRevision(before.data, record.data);
      if (before?.kind === 'job' && record.kind === 'job') {
        if (before.data.rootJobId !== record.data.rootJobId || before.data.attemptId !== record.data.attemptId || before.data.requestId !== record.data.requestId || before.data.precedingAttemptId !== record.data.precedingAttemptId) throw new DomainError('conflict');
        if (before.data.deadlineAt !== record.data.deadlineAt || JSON.stringify(before.data.limits) !== JSON.stringify(record.data.limits) || JSON.stringify(before.data.inputVersions) !== JSON.stringify(record.data.inputVersions)) throw new DomainError('conflict');
        assertJobTransition(before.data.state, record.data.state);
      }
      if (prior) db.prepare('UPDATE record_identities SET latest_version=? WHERE id=? AND latest_version=?').run(data.version, data.id, expectedVersion);
      else db.prepare('INSERT INTO record_identities(id,kind,journey_id,latest_version) VALUES (?,?,?,?)').run(data.id, kind, journeyId, data.version);
      db.prepare('INSERT INTO record_versions(id,kind,version,created_at,payload) VALUES (?,?,?,?,?)').run(data.id, kind, data.version, data.createdAt, JSON.stringify(data));
    }
    for (const { record, dependencies } of writes) {
      for (const dependency of dependencies) {
        db.prepare('INSERT INTO record_dependencies(dependent_id,dependent_version,dependency_id,dependency_version) VALUES (?,?,?,?)').run(record.data.id, record.data.version, dependency.id, dependency.version);
      }
    }
    if (ownsTransaction) db.exec('COMMIT');
  } catch (error) {
    if (ownsTransaction && db.isTransaction) db.exec('ROLLBACK');
    throw error;
  }
}
export function storageInfo(db: DatabaseSync): StorageInfo {
  return {
    schemaVersion: Number(db.prepare('SELECT COALESCE(MAX(version),0) n FROM schema_migrations').get()?.n),
    records: Number(db.prepare('SELECT COUNT(*) n FROM record_identities').get()?.n),
    versions: Number(db.prepare('SELECT COUNT(*) n FROM record_versions').get()?.n),
  };
}

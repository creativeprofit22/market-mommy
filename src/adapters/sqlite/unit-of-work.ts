import type { DatabaseSync } from 'node:sqlite';
import { DomainError } from '../../domain/errors.js';
import type { UnitOfWork } from '../../application/ports.js';
import type { TrustedContext } from '../../application/authorization.js';
import { dispatchCommand, dispatchFailure, type DispatchResult } from '../../application/dispatch.js';
import { appendRecords, lookupRecord, readRecord } from './repositories.js';
import { SqliteWorkflow } from './workflow.js';

function unitOfWork(db: DatabaseSync): UnitOfWork {
  const workflow = new SqliteWorkflow(db);
  return {
    workflow,
    currentJobStatuses: journey => workflow.currentJobStatuses(journey),
    read: (id, version) => readRecord(db, id, version),
    lookup: (id, version) => lookupRecord(db, id, version),
    list: kind => {
      const rows = db.prepare('SELECT id FROM record_identities WHERE kind=? ORDER BY id LIMIT 2001').all(kind);
      if (rows.length > 2000) throw new DomainError('validation');
      return rows.flatMap(row => { const record = readRecord(db, String(row.id)); return record ? [record] : []; });
    },
    append: writes => appendRecords(db, writes),
    receipt: id => {
      if (db.prepare('SELECT 1 FROM blocked_receipts WHERE request_id=?').get(id)) throw new DomainError('conflict');
      const row = db.prepare('SELECT semantic_request, result FROM request_receipts WHERE request_id=?').get(id)
        ?? db.prepare('SELECT semantic AS semantic_request,result FROM workflow_receipts WHERE request_id=?').get(id);
      return row ? { semantic: String(row.semantic_request), result: JSON.parse(String(row.result)) as unknown } : null;
    },
    saveReceipt: (id, journeyId, semantic, result, now) => {
      db.prepare('INSERT INTO request_receipts(request_id,journey_id,semantic_request,result,created_at) VALUES (?,?,?,?,?)').run(id, journeyId, semantic, JSON.stringify(result), now);
    },
  };
}
export function dispatchTransaction(db: DatabaseSync, json: string, context: TrustedContext): DispatchResult {
  try {
    db.exec('BEGIN IMMEDIATE');
    const result = dispatchCommand(json, context, unitOfWork(db), new Date().toISOString());
    db.exec('COMMIT');
    return result;
  } catch (error) {
    if (db.isTransaction) db.exec('ROLLBACK');
    return dispatchFailure(error, json);
  }
}

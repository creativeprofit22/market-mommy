import type { DatabaseSync } from 'node:sqlite';
import { DomainError } from '../../domain/errors.js';

export interface Removal { record_id: string; removed_at: string; reason: 'explicit-fixture-removal' }
/** Caller holds an IMMEDIATE transaction and a trusted fixture-write grant. */
export function applyRemovals(db: DatabaseSync, entries: readonly Removal[]): void {
  for (const entry of entries) {
    const kind = db.prepare('SELECT kind FROM record_identities WHERE id=?').get(entry.record_id)?.kind;
    if (kind === 'journey' || kind === 'job') throw new DomainError('policy-denied');
    const existing = db.prepare('SELECT removed_at FROM removal_ledger WHERE record_id=?').get(entry.record_id);
    if (existing && existing.removed_at !== entry.removed_at) throw new DomainError('conflict');
    db.prepare('INSERT OR IGNORE INTO removal_ledger VALUES(?,?,?)').run(entry.record_id, entry.removed_at, entry.reason);
  }
  // Traverse dependencies but retain Journey/job payloads and their immutable accounting membership.
  // Every affected content record is hidden, including historical versions (fail closed).
  const affected = db.prepare(`WITH RECURSIVE affected(id) AS (
    SELECT record_id FROM removal_ledger UNION
    SELECT d.dependent_id FROM record_dependencies d JOIN affected a ON d.dependency_id=a.id
    JOIN record_identities i ON i.id=d.dependent_id WHERE i.kind NOT IN ('journey','job')
  ) SELECT i.id FROM affected a JOIN record_identities i ON i.id=a.id`).all();
  if (affected.length > 10000) throw new DomainError('validation');
  for (const row of affected) {
    const id = String(row.id);
    const original = db.prepare('SELECT removed_at FROM removal_ledger WHERE record_id=?').get(id);
    const at = original ? String(original.removed_at) : entries[0]?.removed_at;
    if (!at) continue;
    db.prepare("INSERT OR IGNORE INTO removal_ledger VALUES(?,?,'explicit-fixture-removal')").run(id, at);
    db.prepare("INSERT OR IGNORE INTO removal_tombstones VALUES(?,?,'explicit-fixture-removal')").run(id, at);
    db.prepare("UPDATE record_versions SET payload=json_object('id',id,'version',version,'createdAt',created_at,'removed',json('true')) WHERE id=?").run(id);
  }
  if (db.prepare('SELECT 1 FROM removal_ledger').get()) {
    // Conservative global sanitization: canonical requests and results may embed copied content.
    // Keep every used key permanently reserved, never return an old result after removal.
    db.exec(`INSERT OR IGNORE INTO blocked_receipts SELECT request_id FROM request_receipts;
      INSERT OR IGNORE INTO blocked_receipts SELECT request_id FROM workflow_receipts;
      UPDATE request_receipts SET semantic_request='null',result='null';
      UPDATE workflow_receipts SET semantic='null',result='null';
      UPDATE workflow_results SET result='null';`);
  }
  db.exec('UPDATE store_metadata SET ledger_version=(SELECT count(*) FROM removal_ledger)');
}

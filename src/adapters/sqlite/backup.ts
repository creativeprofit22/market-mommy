import { randomUUID } from 'node:crypto';
import { closeSync, openSync, readFileSync, fstatSync, writeFileSync, unlinkSync } from 'node:fs';
import { isAbsolute } from 'node:path';
import { DatabaseSync, backup } from 'node:sqlite';
import { validate } from '../../domain/common.js';
import { DomainError } from '../../domain/errors.js';
import { authorize, type TrustedContext } from '../../application/authorization.js';
import type { AdministrationRequest, AdministrationResult } from '../../application/administration.js';
import { migrate, migrations } from './migrate.js';
import { applyRemovals } from './retention.js';
import { MAX_BYTES, canonical, checkHash, exportSchema, hash, integrity, ledgerSchema, snapshot, tableNames, type Ledger, type Tables } from './export.js';

function localPath(path: string): void { if (!isAbsolute(path) || /^[/\\]{2}/.test(path)) throw new DomainError('validation'); }
function reserve(path: string): void { localPath(path); closeSync(openSync(path,'wx',0o600)); }
function checkBackupFile(path: string): void {
  localPath(path);
  const fd = openSync(path,'r');
  try { const stat = fstatSync(fd); if (!stat.isFile() || stat.size > MAX_BYTES) throw new DomainError('validation'); } finally { closeSync(fd); }
}
function readJson(path: string): unknown {
  localPath(path);
  const fd = openSync(path,'r');
  try { const size = fstatSync(fd); if (!size.isFile() || size.size > MAX_BYTES) throw new DomainError('validation'); const data = readFileSync(fd); if (data.length > MAX_BYTES) throw new DomainError('validation'); return JSON.parse(data.toString('utf8')) as unknown; }
  finally { closeSync(fd); }
}
function writeArtifact(path: string, body: object): string {
  const checksum = hash(body); const json = canonical({ ...body, checksum });
  if (Buffer.byteLength(json) > MAX_BYTES) throw new DomainError('validation');
  localPath(path); writeFileSync(path,json,{flag:'wx',mode:0o600}); return checksum;
}
function metadata(db: DatabaseSync): { sourceStoreId: string; ledgerVersion: number } {
  const row = db.prepare('SELECT store_id,ledger_version FROM store_metadata WHERE slot=1').get();
  if (!row) throw new DomainError('validation');
  return { sourceStoreId:String(row.store_id), ledgerVersion:Number(row.ledger_version) };
}
function transaction(db: DatabaseSync, work: () => void): void { db.exec('BEGIN IMMEDIATE'); try { work(); db.exec('COMMIT'); } catch(error) { if(db.isTransaction) db.exec('ROLLBACK'); throw error; } }
function loadLedger(path: string): Ledger { const ledger = validate(ledgerSchema,readJson(path)); checkHash(ledger); if (ledger.ledgerVersion !== ledger.removals.length || new Set(ledger.removals.map(r=>r.record_id)).size !== ledger.removals.length) throw new DomainError('validation'); return ledger; }
function reapply(db: DatabaseSync, ledger: Ledger): void {
  const meta = metadata(db);
  if (ledger.sourceStoreId !== meta.sourceStoreId || ledger.ledgerVersion < meta.ledgerVersion) throw new DomainError('validation');
  for (const row of db.prepare('SELECT * FROM removal_ledger').all()) if (!ledger.removals.some(item => canonical(item) === canonical(row))) throw new DomainError('validation');
  for (const row of db.prepare('SELECT request_id FROM blocked_receipts').all()) if (!ledger.blockedReceipts.some(item => item.request_id === row.request_id)) throw new DomainError('validation');
  for (const row of ledger.blockedReceipts) db.prepare('INSERT OR IGNORE INTO blocked_receipts VALUES(?)').run(row.request_id);
  applyRemovals(db,ledger.removals);
}
function insertTables(db: DatabaseSync,tables: Tables): void {
  db.exec('PRAGMA defer_foreign_keys=ON; DELETE FROM workflow_claim');
  for (const name of tableNames) {
    for (const row of tables[name]) {
      // Every row was parsed by the strict, fixed per-table schema above. No caller SQL.
      const columns = Object.keys(row);
      const values = Object.values(row) as (string | number | null)[];
      db.prepare(`INSERT INTO ${name} (${columns.join(',')}) VALUES (${columns.map(()=>'?').join(',')})`).run(...values);
    }
  }
}
/** Runs only on the owning SQLite worker; messages are serialized across async backup. */
export async function administer(db: DatabaseSync, request: AdministrationRequest, context: TrustedContext): Promise<AdministrationResult> {
  authorize(context, request.action === 'backup' || request.action === 'export' || request.action === 'exportRemovalLedger' ? 'resumeJourney' : 'saveProfile');
  const start = performance.now(); const artifactId = randomUUID(); const createdAt = new Date().toISOString();
  let meta = metadata(db); let checksum: string;
  const header = () => ({ formatVersion:1 as const, schemaVersion:5 as const, artifactId, ...meta, createdAt });
  try {
    if (request.action === 'backup') {
      reserve(request.destination);
      try {
        await backup(db,request.destination);
        checkBackupFile(request.destination);
        const copy = new DatabaseSync(request.destination,{readOnly:true,allowExtension:false});
        try { integrity(copy); const tables = snapshot(copy); meta = metadata(copy); checksum = hash({ ...meta,tables }); } finally { copy.close(); }
      } catch(error) { unlinkSync(request.destination); throw error; }
    } else if (request.action === 'export' || request.action === 'exportRemovalLedger') {
      db.exec('BEGIN');
      try {
        meta = metadata(db); integrity(db);
        const tables = snapshot(db);
        checksum = writeArtifact(request.destination,request.action === 'export' ? { ...header(),format:'market-mommy-semantic',tables } : { ...header(),format:'market-mommy-removals',removals:tables.removal_ledger,blockedReceipts:tables.blocked_receipts });
        db.exec('COMMIT');
      } catch(error) { if(db.isTransaction) db.exec('ROLLBACK'); throw error; }
    } else if (request.action === 'removeFixtures' || request.action === 'reapplyRemovalLedger') {
      const ledger = request.action === 'reapplyRemovalLedger' ? loadLedger(request.ledger) : null;
      transaction(db,()=> {
        if (ledger) reapply(db,ledger);
        else if (request.action === 'removeFixtures') {
          for (const id of request.recordIds) {
            const row = db.prepare('SELECT kind FROM record_identities WHERE id=?').get(id);
            // Administrative fixture policy only; do not delete budget/workload containers.
            if (!row) throw new DomainError('not-found');
            if (row.kind === 'journey' || row.kind === 'job') throw new DomainError('policy-denied');
          }
          applyRemovals(db,request.recordIds.map(id=>({record_id:id,removed_at:String(db.prepare('SELECT removed_at FROM removal_ledger WHERE record_id=?').get(id)?.removed_at ?? createdAt),reason:'explicit-fixture-removal' as const})));
        }
        integrity(db);
      });
      meta=metadata(db); checksum=hash(snapshot(db));
    } else {
      // A separate authoritative ledger is mandatory even for copies with no known removals.
      const ledger = loadLedger(request.ledger);
      let tables: Tables;
      if (request.action === 'import') {
        const artifact = validate(exportSchema,readJson(request.source)); checkHash(artifact);
        meta = {sourceStoreId:artifact.sourceStoreId,ledgerVersion:artifact.ledgerVersion}; tables=artifact.tables;
      } else {
        checkBackupFile(request.source);
        const source = new DatabaseSync(request.source,{readOnly:true,allowExtension:false});
        try {
          const applied = source.prepare('SELECT version,checksum FROM schema_migrations ORDER BY version').all();
          if (applied.length !== migrations.length) throw new DomainError('validation');
          // migrate on read-only connection verifies exact applied checksums without changing it.
          await migrate(source,request.source); integrity(source); meta=metadata(source); tables=snapshot(source);
          if (hash({ ...meta,tables }) !== request.checksum) throw new DomainError('validation');
        } finally { source.close(); }
      }
      if (meta.sourceStoreId !== ledger.sourceStoreId || meta.ledgerVersion > ledger.ledgerVersion || meta.ledgerVersion !== tables.removal_ledger.length) throw new DomainError('validation');
      reserve(request.destination);
      let target: DatabaseSync | undefined;
      try {
        target = new DatabaseSync(request.destination,{enableForeignKeyConstraints:true,allowExtension:false});
        await migrate(target,request.destination);
        const destination = target;
        transaction(destination,()=> {
          destination.prepare('UPDATE store_metadata SET store_id=?,ledger_version=? WHERE slot=1').run(meta.sourceStoreId,meta.ledgerVersion);
          insertTables(destination,tables); integrity(destination);
          // Validate semantic hashes by round trip before applying newer removals.
          if(hash(snapshot(destination)) !== hash(tables)) throw new DomainError('validation');
          reapply(destination,ledger); integrity(destination);
        });
        meta=metadata(destination); checksum=hash(snapshot(destination));
      } catch(error) { target?.close(); target=undefined; unlinkSync(request.destination); throw error; }
      finally { target?.close(); }
    }
    return {artifactId,...meta,schemaVersion:5,checksum,completedAt:new Date().toISOString(),elapsedMs:performance.now()-start,verified:true};
  } catch(error) { if(error instanceof DomainError) throw error; throw new DomainError('storage-failure'); }
}

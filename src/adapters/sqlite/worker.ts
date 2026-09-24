import { isAbsolute } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { parentPort, workerData } from 'node:worker_threads';
import { z } from 'zod';
import { idSchema, validate, versionSchema } from '../../domain/common.js';
import { DomainError, safeError } from '../../domain/errors.js';
import { HOST_LIMITS } from '../../domain/job.js';
import { migrate } from './migrate.js';
import { appendRecords, readRecord, storageInfo } from './repositories.js';
import { authorize, createTrustedContext } from '../../application/authorization.js';
import { dispatchTransaction } from './unit-of-work.js';
import type { RecordWrite } from '../../application/ports.js';
import { workflowRequestSchema } from '../../application/workflow.js';
import { SqliteWorkflow, workflowTransaction } from './workflow.js';
import { administrationRequestSchema } from '../../application/administration.js';
import { administer } from './backup.js';

const port = parentPort;
if (!port) throw new Error('Storage requires an owning worker');
const options = validate(z.strictObject({ path: z.string().min(1).max(4096), capabilities: z.array(z.enum(['read', 'fixture-write', 'fixture-run', 'cancel'])).max(4).default(['read']) }), workerData);
if (!isAbsolute(options.path) || /^[/\\]{2}/.test(options.path)) throw new DomainError('validation');
const context = createTrustedContext(options.capabilities);
const requestSchema = z.discriminatedUnion('operation', [
  z.strictObject({ id: z.number().int().positive(), operation: z.literal('administer'), request: administrationRequestSchema }),
  z.strictObject({ id: z.number().int().positive(), operation: z.literal('workflow'), request: workflowRequestSchema }),
  z.strictObject({ id: z.number().int().positive(), operation: z.literal('dispatch'), json: z.string().max(HOST_LIMITS.inputBytes) }),
  z.strictObject({ id: z.number().int().positive(), operation: z.literal('read'), recordId: idSchema, version: versionSchema.optional() }),
  z.strictObject({ id: z.number().int().positive(), operation: z.literal('append'), writes: z.array(z.unknown()).min(1).max(64) }),
  z.strictObject({ id: z.number().int().positive(), operation: z.enum(['info', 'close']) }),
]);
let db: DatabaseSync | undefined;
try {
  db = new DatabaseSync(options.path, { timeout: 1_000, enableForeignKeyConstraints: true, allowExtension: false });
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA trusted_schema=OFF');
  await migrate(db, options.path);
  // Startup only quarantines expired work; it never executes or replays it.
  db.exec('BEGIN IMMEDIATE');
  try { new SqliteWorkflow(db).recover(new Date().toISOString()); db.exec('COMMIT'); }
  catch (error) { if (db.isTransaction) db.exec('ROLLBACK'); throw error; }
  port.postMessage({ id: 0, ok: true, data: storageInfo(db) });
  let queue = Promise.resolve();
  port.on('message', (input: unknown) => {
    queue = queue.then(async () => {
    let id = -1;
    try {
      id = validate(z.object({ id: z.number().int().positive() }), input).id;
      if (Buffer.byteLength(JSON.stringify(input)) > HOST_LIMITS.inputBytes) throw new DomainError('validation');
      const request = validate(requestSchema, input);
      id = request.id;
      if (!db) throw new DomainError('storage-failure');
      switch (request.operation) {
        case 'administer': port.postMessage({ id, ok: true, data: await administer(db, request.request, context) }); break;
        case 'workflow': port.postMessage({ id, ok: true, data: workflowTransaction(db, request.request, context) }); break;
        case 'dispatch': port.postMessage({ id, ok: true, data: dispatchTransaction(db, request.json, context) }); break;
        case 'read': authorize(context, 'resumeJourney'); port.postMessage({ id, ok: true, data: readRecord(db, request.recordId, request.version) }); break;
        case 'append': authorize(context, 'saveProfile'); appendRecords(db, request.writes as RecordWrite[]); port.postMessage({ id, ok: true, data: null }); break;
        case 'info': authorize(context, 'resumeJourney'); port.postMessage({ id, ok: true, data: storageInfo(db) }); break;
        case 'close': db.close(); db = undefined; port.postMessage({ id, ok: true, data: null }); port.close(); break;
      }
    } catch (error) { port.postMessage({ id, ok: false, error: safeError(error) }); }
    });
  });
} catch (error) {
  db?.close();
  port.postMessage({ id: 0, ok: false, error: safeError(error) });
  port.close();
}

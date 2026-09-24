import { isAbsolute } from 'node:path';
import { Worker } from 'node:worker_threads';
import { z } from 'zod';
import { DomainError } from '../../domain/errors.js';
import { idSchema, validate, versionSchema } from '../../domain/common.js';
import { HOST_LIMITS } from '../../domain/job.js';
import { storedRecordSchema } from '../../domain/records.js';
import type { StoredRecord } from '../../domain/records.js';
import type { Capability } from '../../application/authorization.js';
import { receiptResultSchema, type DispatchResult } from '../../application/dispatch.js';
import { dispatchFailure } from '../../application/dispatch.js';
import type { RecordWrite, StorageInfo, StoragePort } from '../../application/ports.js';
import { workflowRequestSchema, workflowResultSchema, type WorkflowPort, type WorkflowRequest } from '../../application/workflow.js';
import type { Job } from '../../domain/job.js';
import { administrationRequestSchema, administrationResultSchema, type AdministrationRequest, type AdministrationResult, type AdministrativeStoragePort } from '../../application/administration.js';

const infoSchema = z.strictObject({ schemaVersion: z.number().int().min(0), records: z.number().int().min(0), versions: z.number().int().min(0) });
const responseSchema = z.discriminatedUnion('ok', [
  z.strictObject({ id: z.number().int().min(0), ok: z.literal(true), data: z.unknown() }),
  z.strictObject({ id: z.number().int().min(0), ok: z.literal(false), error: z.strictObject({ code: z.enum(['validation', 'unauthorized', 'conflict', 'not-found', 'policy-denied', 'unavailable', 'budget-exhausted', 'storage-failure', 'reconciliation-required']), message: z.string().max(2000) }) }),
]);
type Pending = { resolve: (value: unknown) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> };

export class SqliteStorage implements StoragePort, WorkflowPort, AdministrativeStoragePort {
  private readonly worker: Worker;
  private readonly pending = new Map<number, Pending>();
  private sequence = 0;
  private stopped = false;
  private closing: Promise<void> | undefined;
  private termination: Promise<number> | undefined;
  private readonly exited: Promise<void>;
  private constructor(path: string, capabilities: readonly Capability[]) {
    this.worker = new Worker(new URL('./worker.js', import.meta.url), { workerData: { path, capabilities }, env: {} });
    this.exited = new Promise(resolve => this.worker.once('exit', () => { this.failAll(); resolve(); }));
    this.worker.on('error', () => { this.failAll(); });
    this.worker.on('message', (input: unknown) => {
      const parsed = responseSchema.safeParse(input);
      if (!parsed.success) { this.failAll(); return; }
      const response = parsed.data;
      const pending = this.pending.get(response.id);
      if (!pending) { this.failAll(); return; }
      clearTimeout(pending.timer);
      this.pending.delete(response.id);
      if (response.ok) pending.resolve(response.data);
      else pending.reject(new DomainError(response.error.code));
    });
  }
  static async open(path: string, capabilities: readonly Capability[] = ['read']): Promise<SqliteStorage> {
    if (!isAbsolute(path) || /^[/\\]{2}/.test(path)) throw new DomainError('validation');
    const storage = new SqliteStorage(path, capabilities);
    try { validate(infoSchema, await storage.wait(0)); return storage; }
    catch (error) { await storage.close(); throw error; }
  }
  private failAll(): void {
    this.stopped = true;
    for (const item of this.pending.values()) { clearTimeout(item.timer); item.reject(new DomainError('storage-failure')); }
    this.pending.clear();
    this.termination ??= this.worker.terminate();
  }
  private wait(id: number): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.failAll(); }, 15_000);
      this.pending.set(id, { resolve, reject, timer });
    });
  }
  private request(body: Record<string, unknown>): Promise<unknown> {
    if (this.stopped || this.closing || this.pending.size >= 64) return Promise.reject(new DomainError('storage-failure'));
    const id = ++this.sequence;
    const request = { ...body, id };
    if (Buffer.byteLength(JSON.stringify(request)) > HOST_LIMITS.inputBytes) return Promise.reject(new DomainError('validation'));
    const response = this.wait(id);
    try { this.worker.postMessage(request); } catch { this.failAll(); }
    return response;
  }
  async dispatch(json: string): Promise<DispatchResult> {
    try { return validate(receiptResultSchema, await this.request({ operation: 'dispatch', json })); }
    catch (error) { return dispatchFailure(error, json); }
  }
  /** Trusted administrative API, deliberately absent from dispatch command schemas. */
  async workflow(request: WorkflowRequest): Promise<Job[]> {
    return validate(workflowResultSchema, await this.request({ operation: 'workflow', request: validate(workflowRequestSchema, request) }));
  }
  async administer(request: AdministrationRequest): Promise<AdministrationResult> {
    return validate(administrationResultSchema, await this.request({ operation: 'administer', request: validate(administrationRequestSchema, request) }));
  }
  async append(writes: readonly RecordWrite[]): Promise<void> { await this.request({ operation: 'append', writes }); }
  async read(id: string, version?: number): Promise<StoredRecord | null> {
    validate(idSchema, id);
    if (version !== undefined) validate(versionSchema, version);
    const data = await this.request({ operation: 'read', recordId: id, ...(version === undefined ? {} : { version }) });
    return data === null ? null : validate(storedRecordSchema, data);
  }
  async info(): Promise<StorageInfo> { return validate(infoSchema, await this.request({ operation: 'info' })); }
  close(): Promise<void> {
    if (this.closing) return this.closing;
    // Obtain the request before assigning closing, which prevents new requests.
    const acknowledgement = this.stopped ? Promise.resolve() : this.request({ operation: 'close' });
    this.closing = (async () => {
      try { await acknowledgement; } catch { this.failAll(); }
      await this.exited;
      if (this.termination) await this.termination;
      this.worker.removeAllListeners();
    })();
    return this.closing;
  }
}

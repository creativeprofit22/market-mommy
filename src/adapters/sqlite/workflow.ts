import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { validate } from '../../domain/common.js';
import { DomainError } from '../../domain/errors.js';
import { HOST_LIMITS, jobSchema, type Job } from '../../domain/job.js';
import { ALLOWANCES, type Journey } from '../../domain/journey.js';
import { authorize, type TrustedContext } from '../../application/authorization.js';
import { SYNTHETIC_RESERVATION, workflowRequestSchema, workflowResultSchema, type WorkflowRequest, type WorkflowUnitOfWork } from '../../application/workflow.js';
import { jobStatusesSchema, type JobStatus } from '../../application/ports.js';
import { appendRecords, readRecord } from './repositories.js';

const terminal = (job: Job): boolean => !['queued', 'running', 'cancel-requested'].includes(job.state);
export class SqliteWorkflow implements WorkflowUnitOfWork {
  constructor(private readonly db: DatabaseSync) {}
  private job(id: string, journeyId?: string): Job {
    const record = readRecord(this.db, id);
    if (!record) throw new DomainError('not-found');
    if (record.kind !== 'job' || (journeyId !== undefined && record.data.journeyId !== journeyId) || !this.db.prepare('SELECT 1 FROM workflow_attempts WHERE job_id=?').get(id)) throw new DomainError('conflict');
    return record.data;
  }
  private jobs(): Job[] {
    const rows = this.db.prepare('SELECT job_id FROM workflow_attempts ORDER BY rowid LIMIT 2001').all();
    if (rows.length > 2000) throw new DomainError('validation');
    return rows.map(row => this.job(String(row.job_id)));
  }
  private save(job: Job): Job {
    const checked = validate(jobSchema, job);
    appendRecords(this.db, [{ record: { kind: 'job', data: checked }, expectedVersion: checked.version - 1, dependencies: checked.inputVersions }], true);
    return checked;
  }
  private balance(jobId: string): { actual: number; reserved: number; unknown: number; adjusted: boolean } {
    const row = this.db.prepare('SELECT actual,reserved,unknown,event_id FROM workflow_ledger WHERE job_id=? ORDER BY sequence DESC LIMIT 1').get(jobId);
    if (!row) throw new DomainError('storage-failure');
    return { actual: Number(row.actual), reserved: Number(row.reserved), unknown: Number(row.unknown), adjusted: String(row.event_id).startsWith('adjust:') };
  }
  private unresolved(job: Job, balance: ReturnType<SqliteWorkflow['balance']>): boolean {
    return balance.reserved !== 0 || (job.state === 'reconciliation-required' && !balance.adjusted);
  }
  currentJobStatuses(journey: Journey): JobStatus[] {
    if (journey.jobIds.length > 1000) throw new DomainError('validation');
    return validate(jobStatusesSchema, journey.jobIds.map(id => {
      const record = readRecord(this.db, id);
      if (!record) throw new DomainError('not-found');
      if (record.kind !== 'job' || record.data.journeyId !== journey.id) throw new DomainError('conflict');
      const job = record.data;
      const attempt = this.db.prepare('SELECT journey_id FROM workflow_attempts WHERE job_id=?').get(id);
      if (!attempt) return {
        jobId: id, journeyId: journey.id, state: job.state, billing: job.billing, accounting: null,
        reconciliationRequired: terminal(job) && (job.billing === 'unknown' || job.state === 'reconciliation-required' || job.reservedMinorUnits !== '0'),
      };
      if (attempt.journey_id !== journey.id) throw new DomainError('conflict');
      const b = this.balance(id);
      return {
        jobId: id, journeyId: journey.id, state: job.state,
        billing: b.unknown > 0 ? 'unknown' : job.state === 'queued' ? 'not-started' : 'known',
        accounting: { actualMinorUnits: String(b.actual), reservedMinorUnits: String(b.reserved), unknownMinorUnits: String(b.unknown) },
        reconciliationRequired: terminal(job) && this.unresolved(job, b),
      };
    }));
  }
  private ledger(job: Job, event: string, actual: number, reserved: number, unknown: number, now: string, provider: string | null = job.providerRequestId): void {
    this.db.prepare('INSERT INTO workflow_ledger(event_id,job_id,actual,reserved,unknown,provider_request_id,created_at) VALUES(?,?,?,?,?,?,?)').run(event, job.id, actual, reserved, unknown, provider, now);
  }
  private journey(id: string): Journey {
    const record = readRecord(this.db, id);
    if (record?.kind !== 'journey') throw new DomainError('conflict');
    return record.data;
  }
  private syncJourney(id: string, newJob?: string): void {
    const journey = this.journey(id);
    const totals = this.jobs().filter(j => j.journeyId === id).reduce((sum, job) => {
      const b = this.balance(job.id);
      return { actual: sum.actual + b.actual, reserved: sum.reserved + b.reserved, unknown: sum.unknown + b.unknown };
    }, { actual: 0, reserved: 0, unknown: 0 });
    appendRecords(this.db, [{ record: { kind: 'journey', data: { ...journey, version: journey.version + 1, jobIds: newJob ? [...journey.jobIds, newJob] : journey.jobIds, costs: { actualMinorUnits: String(totals.actual), outstandingMinorUnits: String(totals.reserved), unknownMinorUnits: String(totals.unknown) } } }, expectedVersion: journey.version, dependencies: [journey.profile, ...journey.history, ...journey.priorLearning] }]);
  }
  enqueue(journey: Journey, requestId: string, limits: Job['limits'], now: string, previous?: Job): Job {
    this.recover(now);
    const jobs = this.jobs();
    if (journey.jobIds.some(id => !jobs.some(job => job.id === id))) throw new DomainError('reconciliation-required');
    if (jobs.filter(j => j.state === 'queued').length >= HOST_LIMITS.queuedJobs) throw new DomainError('unavailable');
    const used = (filter: (job: Job) => boolean): number => jobs.filter(filter).reduce((sum, job) => { const b = this.balance(job.id); return sum + b.actual + b.reserved; }, 0);
    if (used(j => j.journeyId === journey.id) + SYNTHETIC_RESERVATION > Number(ALLOWANCES.journeyMinorUnits) || (previous && used(j => j.rootJobId === previous.rootJobId) + SYNTHETIC_RESERVATION > Number(ALLOWANCES.runMinorUnits))) throw new DomainError('budget-exhausted');
    if (this.db.prepare('SELECT 1 FROM request_receipts WHERE request_id=?').get(requestId) || this.db.prepare('SELECT 1 FROM workflow_receipts WHERE request_id=?').get(requestId)) throw new DomainError('conflict');
    const id = randomUUID();
    const job = this.save({ id, version: 1, createdAt: now, journeyId: journey.id, rootJobId: previous?.rootJobId ?? id, attemptId: randomUUID(), precedingAttemptId: previous?.attemptId ?? null, requestId, useCase: 'fixture-interpretation', scope: 'synthetic-fixture', inputVersions: [journey.profile, ...journey.workload.evidenceIds.map(id => {
      const record = readRecord(this.db, id);
      if (record?.kind !== 'evidence') throw new DomainError('conflict');
      return { id, version: record.data.version };
    })], state: 'queued', checkpoint: null, deadlineAt: new Date(Date.parse(now) + limits.deadlineMs).toISOString(), limits, reservedMinorUnits: String(SYNTHETIC_RESERVATION), actualMinorUnits: '0', billing: 'not-started', providerRequestId: null, fence: 0 });
    this.db.prepare('INSERT INTO workflow_attempts VALUES(?,?,?,?,?,?)').run(id, journey.id, job.rootJobId, job.attemptId, job.precedingAttemptId, requestId);
    this.ledger(job, `reserve:${id}`, 0, SYNTHETIC_RESERVATION, 0, now);
    this.syncJourney(journey.id, id);
    return job;
  }
  cancel(journey: Journey, id: string, now: string): Job {
    const job = this.job(id, journey.id);
    if (terminal(job) || job.state === 'cancel-requested') return job;
    if (job.state === 'queued') {
      const result = this.save({ ...job, version: job.version + 1, state: 'cancelled', billing: 'known', reservedMinorUnits: '0' });
      this.ledger(job, `cancel:${id}`, 0, 0, 0, now); this.syncJourney(journey.id); return result;
    }
    return this.save({ ...job, version: job.version + 1, state: 'cancel-requested' });
  }
  private release(): void { this.db.prepare('UPDATE workflow_claim SET job_id=NULL,owner_id=NULL,expires_at=NULL WHERE slot=1').run(); }
  recover(now: string): Job[] {
    const changed: Job[] = [];
    const claim = this.db.prepare('SELECT * FROM workflow_claim WHERE slot=1').get()!;
    for (const job of this.jobs()) {
      if (job.state === 'queued' && job.deadlineAt <= now) {
        changed.push(this.save({ ...job, version: job.version + 1, state: 'failed', billing: 'known', reservedMinorUnits: '0' }));
        this.ledger(job, `expire:${job.id}`, 0, 0, 0, now); this.syncJourney(job.journeyId);
      } else if (['running', 'cancel-requested'].includes(job.state) && (claim.job_id !== job.id || String(claim.expires_at) <= now || job.deadlineAt <= now)) {
        changed.push(this.save({ ...job, version: job.version + 1, state: 'reconciliation-required', billing: 'unknown' }));
        const b = this.balance(job.id); this.ledger(job, `interrupt:${job.id}`, b.actual, b.reserved, b.reserved, now);
        if (claim.job_id === job.id) this.release();
        this.syncJourney(job.journeyId);
      }
    }
    return changed;
  }
  execute(request: WorkflowRequest, now: string): Job[] {
    if (request.action === 'recover') return this.recover(now);
    if (request.action === 'claim') {
      const claim = this.db.prepare('SELECT * FROM workflow_claim WHERE slot=1').get()!;
      if (claim.job_id !== null) return [];
      // Quarantine blocks another executor until uncertain prior work is explicitly reconciled.
      if (this.jobs().some(job => terminal(job) && this.balance(job.id).unknown > 0)) return [];
      const job = this.jobs().find(j => j.state === 'queued' && j.deadlineAt > now);
      if (!job) return [];
      const fence = Number(claim.fence) + 1;
      const result = this.save({ ...job, version: job.version + 1, state: 'running', fence, billing: 'unknown' });
      this.db.prepare('UPDATE workflow_claim SET fence=?,job_id=?,owner_id=?,expires_at=? WHERE slot=1').run(fence, job.id, request.ownerId, new Date(Math.min(Date.parse(now) + request.leaseMs, Date.parse(job.deadlineAt))).toISOString());
      this.ledger(job, `claim:${job.id}`, 0, SYNTHETIC_RESERVATION, SYNTHETIC_RESERVATION, now); this.syncJourney(job.journeyId);
      return [result];
    }
    const key = request.action === 'retry' ? request.requestId : request.action === 'reconcile' ? request.adjustmentId : `settle:${request.jobId}:${request.fence}`;
    const semantic = JSON.stringify(request);
    if (this.db.prepare('SELECT 1 FROM request_receipts WHERE request_id=?').get(key)) throw new DomainError('conflict');
    if (this.db.prepare('SELECT 1 FROM blocked_receipts WHERE request_id=?').get(key)) throw new DomainError('conflict');
    const receipt = this.db.prepare('SELECT semantic,result FROM workflow_receipts WHERE request_id=?').get(key);
    if (receipt) {
      if (receipt.semantic !== semantic) throw new DomainError('conflict');
      return validate(workflowResultSchema, JSON.parse(String(receipt.result)) as unknown);
    }
    const job = this.job(request.jobId, request.journeyId);
    let result: Job;
    if (request.action === 'retry') {
      if (!terminal(job) || this.unresolved(job, this.balance(job.id))) throw new DomainError('reconciliation-required');
      if (this.db.prepare('SELECT 1 FROM workflow_attempts WHERE preceding_attempt_id=?').get(job.attemptId)) throw new DomainError('conflict');
      const journey = this.journey(job.journeyId);
      if (journey.version !== request.expectedVersion) throw new DomainError('conflict');
      result = this.enqueue(journey, request.requestId, request.limits, now, job);
    } else if (request.action === 'reconcile') {
      if (!terminal(job)) throw new DomainError('conflict');
      this.ledger(job, `adjust:${key}`, request.actualMinorUnits, 0, 0, now, request.providerRequestId);
      this.syncJourney(job.journeyId); result = job;
    } else {
      const claim = this.db.prepare('SELECT * FROM workflow_claim WHERE slot=1').get()!;
      if (terminal(job) || claim.job_id !== job.id || claim.owner_id !== request.ownerId || claim.fence !== request.fence || job.fence !== request.fence || String(claim.expires_at) <= now || job.deadlineAt <= now) throw new DomainError('conflict');
      // A previously accepted cancellation wins over this completed fixture output.
      // Ownership/expiry checks above still apply; accounting remains the executor's report.
      const discardResult = job.state === 'cancel-requested' && request.validatedResult !== undefined;
      if (request.validatedResult !== undefined) {
        if (job.inputVersions.some(ref => !readRecord(this.db, ref.id, ref.version))) throw new DomainError('conflict');
        if (request.state !== 'succeeded' || request.actualMinorUnits !== 0 || Buffer.byteLength(JSON.stringify(request.validatedResult)) > job.limits.outputBytes || request.validatedResult.evidence.some(ref => !job.inputVersions.some(input => input.id === ref.id && input.version === ref.version) || readRecord(this.db, ref.id, ref.version)?.kind !== 'evidence')) throw new DomainError('validation');
        if (!discardResult) this.db.prepare('INSERT INTO workflow_results(job_id,fence,result) VALUES(?,?,?)').run(job.id, request.fence, JSON.stringify(request.validatedResult));
      }
      const unknown = request.actualMinorUnits === null;
      result = this.save({ ...job, version: job.version + 1, state: discardResult ? 'cancelled' : request.state, billing: unknown ? 'unknown' : 'known', actualMinorUnits: String(request.actualMinorUnits ?? 0), reservedMinorUnits: unknown ? String(SYNTHETIC_RESERVATION) : '0', providerRequestId: request.providerRequestId });
      this.ledger(job, key, request.actualMinorUnits ?? 0, unknown ? SYNTHETIC_RESERVATION : 0, unknown ? SYNTHETIC_RESERVATION : 0, now, request.providerRequestId);
      this.release(); this.syncJourney(job.journeyId);
    }
    this.db.prepare('INSERT INTO workflow_receipts VALUES(?,?,?)').run(key, semantic, JSON.stringify([result]));
    return [result];
  }
}
function transaction<T>(db: DatabaseSync, work: () => T): T {
  db.exec('BEGIN IMMEDIATE');
  try { const result = work(); db.exec('COMMIT'); return result; }
  catch (error) { if (db.isTransaction) db.exec('ROLLBACK'); throw error; }
}
export function workflowTransaction(db: DatabaseSync, input: unknown, context: TrustedContext): Job[] {
  authorize(context, 'enqueueJob');
  const request = validate(workflowRequestSchema, input);
  const workflow = new SqliteWorkflow(db);
  // Recovery commits independently: rejecting a late result must not undo quarantine.
  const recovered = transaction(db, () => workflow.recover(new Date().toISOString()));
  if (request.action === 'recover') return recovered;
  return transaction(db, () => workflow.execute(request, new Date().toISOString()));
}

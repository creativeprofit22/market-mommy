import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { DatabaseSync } from 'node:sqlite';
import { idSchema, timeSchema, versionSchema, validate } from '../../domain/common.js';
import { storedRecordSchema } from '../../domain/records.js';
import { fixtureResultSchema } from '../../domain/fixture-result.js';
import { DomainError } from '../../domain/errors.js';
import { parseCommand } from '../../application/commands.js';
import { receiptResultSchema } from '../../application/dispatch.js';
import { workflowRequestSchema, workflowResultSchema } from '../../application/workflow.js';

export const MAX_BYTES = 16 * 1024 * 1024;
const integer = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const text = z.string().max(262144);
const kind = z.enum(['profile','observation','evidence','interpretation','recommendation','offer','experiment','outcome','journey','job']);
export const removalSchema = z.strictObject({ record_id: idSchema, removed_at: timeSchema, reason: z.literal('explicit-fixture-removal') });
const rows = <T extends z.ZodType>(schema: T) => z.array(schema).max(10000);
export const tablesSchema = z.strictObject({
  record_identities: rows(z.strictObject({ id: idSchema, kind, journey_id: idSchema.nullable(), journey_kind: z.literal('journey'), latest_version: versionSchema })),
  record_versions: rows(z.strictObject({ id: idSchema, kind, version: versionSchema, created_at: timeSchema, payload: text })),
  record_dependencies: rows(z.strictObject({ dependent_id: idSchema, dependent_version: versionSchema, dependency_id: idSchema, dependency_version: versionSchema })),
  request_receipts: rows(z.strictObject({ request_id: idSchema, journey_id: idSchema.nullable(), semantic_request: text, result: text, created_at: timeSchema })),
  removal_tombstones: rows(removalSchema),
  workflow_attempts: rows(z.strictObject({ job_id: idSchema, journey_id: idSchema, root_job_id: idSchema, attempt_id: idSchema, preceding_attempt_id: idSchema.nullable(), request_id: idSchema })),
  workflow_ledger: rows(z.strictObject({ sequence: integer, event_id: z.string().min(1).max(300), job_id: idSchema, actual: integer.max(25), reserved: integer.max(25), unknown: integer.max(25), provider_request_id: idSchema.nullable(), created_at: timeSchema })),
  workflow_claim: z.array(z.strictObject({ slot: z.literal(1), fence: integer, job_id: idSchema.nullable(), owner_id: idSchema.nullable(), expires_at: timeSchema.nullable() })).length(1),
  workflow_receipts: rows(z.strictObject({ request_id: z.string().min(1).max(300), semantic: text, result: text })),
  workflow_results: rows(z.strictObject({ job_id: idSchema, fence: integer.min(1), result: text })),
  removal_ledger: rows(removalSchema),
  blocked_receipts: rows(z.strictObject({ request_id: z.string().min(1).max(300) })),
});
export type Tables = z.infer<typeof tablesSchema>;
export const tableNames = Object.keys(tablesSchema.shape) as (keyof Tables)[];
const header = { formatVersion: z.literal(1), schemaVersion: z.literal(5), artifactId: z.uuid(), sourceStoreId: z.string().regex(/^[a-f0-9]{32}$/), ledgerVersion: integer, createdAt: timeSchema };
export const exportSchema = z.strictObject({ ...header, format: z.literal('market-mommy-semantic'), tables: tablesSchema, checksum: z.string().regex(/^[a-f0-9]{64}$/) });
export const ledgerSchema = z.strictObject({ ...header, format: z.literal('market-mommy-removals'), removals: rows(removalSchema), blockedReceipts: rows(z.strictObject({ request_id: z.string().min(1).max(300) })), checksum: z.string().regex(/^[a-f0-9]{64}$/) });
export type Ledger = z.infer<typeof ledgerSchema>;
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value).sort(([a],[b]) => a < b ? -1 : a > b ? 1 : 0).map(([key,item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(',')}}`;
  return JSON.stringify(value);
}
export function hash(value: unknown): string { return createHash('sha256').update(canonical(value)).digest('hex'); }
export function checkHash(value: { checksum: string }): void { const { checksum, ...body } = value; if (hash(body) !== checksum) throw new DomainError('validation'); }
export function integrity(db: DatabaseSync): void {
  if (db.prepare('PRAGMA integrity_check').get()?.integrity_check !== 'ok' || db.prepare('PRAGMA foreign_key_check').all().length) throw new DomainError('validation');
}
export function snapshot(db: DatabaseSync): Tables {
  const result: Record<string, unknown> = {};
  // Names and columns derive only from the checked-in fixed schema, never input.
  for (const name of tableNames) result[name] = db.prepare(`SELECT * FROM ${name} ORDER BY 1 LIMIT 10001`).all();
  const checked = validate(tablesSchema, result);
  if (Buffer.byteLength(JSON.stringify(checked)) > MAX_BYTES) throw new DomainError('validation');
  validateContents(checked);
  return checked;
}
export function validateContents(t: Tables): void {
  const identities = new Map(t.record_identities.map(i => [i.id,i]));
  const versions = new Map(t.record_versions.map(v => [`${v.id}:${v.version}`,v]));
  const removed = new Set(t.removal_tombstones.map(r => r.record_id));
  const ledger = new Map(t.removal_ledger.map(r => [r.record_id,r]));
  const blocked = new Set(t.blocked_receipts.map(r => r.request_id));
  function identity(id: string, expected?: string): void { const i = identities.get(id); if (!i || expected && i.kind !== expected) throw new DomainError('validation'); }
  function references(value: unknown): void {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) { value.forEach(references); return; }
    const object = value as Record<string, unknown>;
    if (Object.keys(object).length === 2 && typeof object.id === 'string' && typeof object.version === 'number' && !versions.has(`${object.id}:${object.version}`)) throw new DomainError('validation');
    Object.values(object).forEach(references);
  }
  for (const tombstone of t.removal_tombstones) if (canonical(ledger.get(tombstone.record_id)) !== canonical(tombstone)) throw new DomainError('validation');
  for (const i of t.record_identities) {
    if (!versions.has(`${i.id}:${i.latest_version}`)) throw new DomainError('validation');
    if (i.journey_id) identity(i.journey_id,'journey');
  }
  for (const row of t.record_versions) {
    const payload: unknown = JSON.parse(row.payload);
    const i = identities.get(row.id);
    if (!i || i.kind !== row.kind || row.version > i.latest_version) throw new DomainError('validation');
    if (removed.has(row.id)) {
      const redacted = validate(z.strictObject({ id: idSchema, version: versionSchema, createdAt: timeSchema, removed: z.literal(true) }),payload);
      if (redacted.id !== row.id || redacted.version !== row.version || redacted.createdAt !== row.created_at) throw new DomainError('validation');
      continue;
    }
    const record = validate(storedRecordSchema,{ kind: row.kind, data: payload });
    const data = record.data;
    if (data.id !== row.id || data.version !== row.version || data.createdAt !== row.created_at || ('journeyId' in data ? data.journeyId : null) !== i.journey_id) throw new DomainError('validation');
    references(data);
    const typedRef = (ref: { id: string; version: number }, expected: string, journeyId?: string): void => {
      identity(ref.id, expected);
      if (journeyId !== undefined && identities.get(ref.id)?.journey_id !== journeyId) throw new DomainError('validation');
    };
    if (record.kind === 'evidence') {
      typedRef(record.data.observation, 'observation');
      record.data.contradictions.forEach(ref => typedRef(ref, 'evidence'));
    }
    if (record.kind === 'interpretation' || record.kind === 'recommendation') {
      typedRef(record.data.profile, 'profile');
      record.data.evidence.forEach(ref => typedRef(ref, 'evidence'));
      if (record.kind === 'recommendation') record.data.counterevidence.forEach(ref => typedRef(ref, 'evidence'));
    }
    if (record.kind === 'offer') typedRef(record.data.recommendation, 'recommendation', record.data.journeyId);
    if (record.kind === 'experiment') {
      typedRef(record.data.baseline.recommendation, 'recommendation', record.data.journeyId);
      typedRef(record.data.baseline.offer, 'offer', record.data.journeyId);
    }
    if (record.kind === 'outcome') {
      if (identities.get(record.data.experimentId)?.journey_id !== record.data.journeyId) throw new DomainError('validation');
      if (record.data.supersedes) typedRef(record.data.supersedes, 'outcome', record.data.journeyId);
    }
    if (record.kind === 'journey') {
      typedRef(record.data.profile, 'profile');
      if (record.data.selectedExperiment) typedRef(record.data.selectedExperiment, 'experiment', record.data.id);
      for (const id of record.data.jobIds) identity(id,'job');
      for (const id of record.data.workload.evidenceIds) identity(id,'evidence');
      for (const id of record.data.workload.directionIds) identity(id,'recommendation');
      for (const id of record.data.workload.experimentIds) identity(id,'experiment');
    }
    if (record.kind === 'outcome') identity(record.data.experimentId,'experiment');
    if (record.kind === 'job') identity(record.data.rootJobId,'job');
  }
  for (const receipt of t.request_receipts) {
    if (blocked.has(receipt.request_id)) { if (receipt.semantic_request !== 'null' || receipt.result !== 'null') throw new DomainError('validation'); }
    else { parseCommand(receipt.semantic_request); const result = validate(receiptResultSchema,JSON.parse(receipt.result)); references(result); }
  }
  for (const receipt of t.workflow_receipts) {
    if (blocked.has(receipt.request_id)) { if (receipt.semantic !== 'null' || receipt.result !== 'null') throw new DomainError('validation'); }
    else { validate(workflowRequestSchema,JSON.parse(receipt.semantic)); references(validate(workflowResultSchema,JSON.parse(receipt.result))); }
  }
  for (const result of t.workflow_results) {
    if (result.result === 'null') { if (!ledger.size) throw new DomainError('validation'); }
    else references(validate(fixtureResultSchema,JSON.parse(result.result)));
  }
  const latestCharges = new Map<string, Tables['workflow_ledger'][number]>();
  for (const row of t.workflow_ledger) {
    if (row.unknown > row.reserved || !t.workflow_attempts.some(attempt => attempt.job_id === row.job_id)) throw new DomainError('validation');
    const previous = latestCharges.get(row.job_id);
    if (!previous || previous.sequence < row.sequence) latestCharges.set(row.job_id, row);
  }
  for (const item of t.record_identities.filter(item => item.kind === 'journey')) {
    const current = versions.get(`${item.id}:${item.latest_version}`);
    if (!current) throw new DomainError('validation');
    const journey = validate(storedRecordSchema, { kind: 'journey', data: JSON.parse(current.payload) });
    if (journey.kind !== 'journey') throw new DomainError('validation');
    const charges = t.workflow_attempts.filter(attempt => attempt.journey_id === item.id).map(attempt => latestCharges.get(attempt.job_id));
    if (charges.some(charge => !charge)) throw new DomainError('validation');
    const sums = charges.reduce((sum, charge) => ({ actual: sum.actual + (charge?.actual ?? 0), reserved: sum.reserved + (charge?.reserved ?? 0), unknown: sum.unknown + (charge?.unknown ?? 0) }), { actual: 0, reserved: 0, unknown: 0 });
    if (journey.data.costs.actualMinorUnits !== String(sums.actual) || journey.data.costs.outstandingMinorUnits !== String(sums.reserved) || journey.data.costs.unknownMinorUnits !== String(sums.unknown)) throw new DomainError('validation');
  }
  for (const attempt of t.workflow_attempts) {
    identity(attempt.job_id,'job'); identity(attempt.journey_id,'journey');
    for (const row of t.record_versions.filter(v => v.id === attempt.job_id)) {
      const job = validate(storedRecordSchema,{kind:row.kind,data:JSON.parse(row.payload)});
      if (job.kind !== 'job' || job.data.attemptId !== attempt.attempt_id || job.data.rootJobId !== attempt.root_job_id || job.data.requestId !== attempt.request_id || job.data.journeyId !== attempt.journey_id || job.data.precedingAttemptId !== attempt.preceding_attempt_id) throw new DomainError('validation');
    }
  }
}

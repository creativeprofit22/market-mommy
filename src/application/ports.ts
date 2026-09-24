import { z } from 'zod';
import { idSchema } from '../domain/common.js';
import { jobStateSchema } from '../domain/job.js';
import { minorUnitsSchema } from '../domain/money.js';
import type { Journey } from '../domain/journey.js';
import type { StoredRecord } from '../domain/records.js';
import type { Reference } from '../domain/common.js';

/** Current accounting is separate from immutable Job history; null means untracked, not zero. */
export const jobStatusSchema = z.strictObject({
  jobId: idSchema, journeyId: idSchema, state: jobStateSchema,
  billing: z.enum(['not-started', 'known', 'unknown']),
  accounting: z.strictObject({
    actualMinorUnits: minorUnitsSchema, reservedMinorUnits: minorUnitsSchema, unknownMinorUnits: minorUnitsSchema,
  }).nullable(),
  reconciliationRequired: z.boolean(),
});
export const jobStatusesSchema = z.array(jobStatusSchema).max(1_000);
export type JobStatus = z.infer<typeof jobStatusSchema>;

export interface RecordWrite {
  record: StoredRecord;
  expectedVersion: number;
  dependencies: Reference[];
}
/** Removed identities expose no payload; missing versions are not tombstones. */
export type RecordLookup =
  | { status: 'available'; record: StoredRecord }
  | { status: 'removed'; kind: StoredRecord['kind']; id: string; version: number }
  | { status: 'missing' };
/** Synchronous operations used only inside the owning worker's short transaction. */
export interface UnitOfWork {
  workflow?: import('./workflow.js').WorkflowUnitOfWork;
  currentJobStatuses(journey: Journey): JobStatus[];
  read(id: string, version?: number): StoredRecord | null;
  lookup(id: string, version?: number): RecordLookup;
  list(kind: StoredRecord['kind']): StoredRecord[];
  append(writes: readonly RecordWrite[]): void;
  receipt(requestId: string): { semantic: string; result: unknown } | null;
  saveReceipt(requestId: string, journeyId: string | null, semantic: string, result: unknown, createdAt: string): void;
}
export interface StorageInfo {
  schemaVersion: number;
  records: number;
  versions: number;
}
/** Trusted core port, not a transport/agent tool. All writes in a batch are atomic. */
export interface StoragePort {
  append(writes: readonly RecordWrite[]): Promise<void>;
  read(id: string, version?: number): Promise<StoredRecord | null>;
  info(): Promise<StorageInfo>;
  close(): Promise<void>;
}

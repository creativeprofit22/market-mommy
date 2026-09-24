import { z } from 'zod';
import { idSchema, recordFields, referenceSchema, shortTextSchema, timeSchema } from './common.js';
import { minorUnitsSchema } from './money.js';
import { DomainError } from './errors.js';

/** Implementation ceilings; product allowances remain owned by docs/evaluation.md. */
export const HOST_LIMITS = Object.freeze({
  activeJobs: 1, queuedJobs: 16, turns: 4, turnExtensions: 0, continuations: 0,
  outputTokens: 2_048, toolResultBytes: 8_192, turnToolResultBytes: 16_384,
  jobTextBytes: 65_536, inputBytes: 262_144, toolCalls: 8,
  toolTimeoutMs: 5_000, deadlineMs: 120_000, recommendationDeadlineMs: 30_000,
});
export const jobLimitsSchema = z.strictObject({
  turns: z.number().int().min(1).max(HOST_LIMITS.turns),
  outputTokens: z.number().int().min(1).max(HOST_LIMITS.outputTokens),
  outputBytes: z.number().int().min(1).max(HOST_LIMITS.jobTextBytes),
  toolCalls: z.number().int().min(1).max(HOST_LIMITS.toolCalls),
  toolTimeoutMs: z.number().int().min(1).max(HOST_LIMITS.toolTimeoutMs),
  deadlineMs: z.number().int().min(1).max(HOST_LIMITS.deadlineMs),
});
export const jobStateSchema = z.enum(['queued', 'running', 'cancel-requested', 'succeeded', 'partial', 'failed', 'cancelled', 'budget-exhausted', 'reconciliation-required']);
export type JobState = z.infer<typeof jobStateSchema>;
export const jobSchema = z.strictObject({
  ...recordFields,
  journeyId: idSchema, rootJobId: idSchema, attemptId: idSchema,
  precedingAttemptId: idSchema.nullable(), requestId: idSchema,
  useCase: z.literal('fixture-interpretation'), scope: z.literal('synthetic-fixture'),
  inputVersions: z.array(referenceSchema).max(51), state: jobStateSchema,
  checkpoint: shortTextSchema.nullable(), deadlineAt: timeSchema,
  limits: jobLimitsSchema,
  reservedMinorUnits: minorUnitsSchema, actualMinorUnits: minorUnitsSchema,
  billing: z.enum(['not-started', 'known', 'unknown']),
  providerRequestId: idSchema.nullable(), fence: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
});
const transitions: Record<JobState, readonly JobState[]> = {
  queued: ['running', 'cancelled', 'failed', 'budget-exhausted'],
  running: ['cancel-requested', 'succeeded', 'partial', 'failed', 'cancelled', 'budget-exhausted', 'reconciliation-required'],
  'cancel-requested': ['succeeded', 'partial', 'failed', 'cancelled', 'reconciliation-required'],
  succeeded: [], partial: [], failed: [], cancelled: [], 'budget-exhausted': [], 'reconciliation-required': [],
};
export function assertJobTransition(from: JobState, to: JobState): void {
  if (!transitions[from]?.includes(to)) throw new DomainError('conflict');
}
export type Job = z.infer<typeof jobSchema>;

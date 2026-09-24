import { z } from 'zod';
import { idSchema } from '../domain/common.js';
import { fixtureResultSchema } from '../domain/fixture-result.js';
import { jobLimitsSchema, jobSchema } from '../domain/job.js';
import type { Job } from '../domain/job.js';
import type { Journey } from '../domain/journey.js';

/** Synthetic accounting only; not a price guarantee for any paid provider. */
export const SYNTHETIC_RESERVATION = 25;
const identity = { jobId: idSchema, journeyId: idSchema };
export const workflowRequestSchema = z.discriminatedUnion('action', [
  z.strictObject({ action: z.literal('claim'), ownerId: idSchema, leaseMs: z.number().int().min(1).max(120_000) }),
  z.strictObject({ action: z.literal('recover') }),
  z.strictObject({ action: z.literal('settle'), ...identity, ownerId: idSchema, fence: z.number().int().positive().max(Number.MAX_SAFE_INTEGER), state: z.enum(['succeeded', 'partial', 'failed', 'cancelled', 'budget-exhausted', 'reconciliation-required']), actualMinorUnits: z.number().int().min(0).max(SYNTHETIC_RESERVATION).nullable(), providerRequestId: idSchema.nullable(), validatedResult: fixtureResultSchema.optional() }),
  z.strictObject({ action: z.literal('reconcile'), ...identity, adjustmentId: idSchema, actualMinorUnits: z.number().int().min(0).max(SYNTHETIC_RESERVATION), providerRequestId: idSchema.nullable() }),
  z.strictObject({ action: z.literal('retry'), ...identity, requestId: idSchema, expectedVersion: z.number().int().positive(), limits: jobLimitsSchema }),
]);
export type WorkflowRequest = z.infer<typeof workflowRequestSchema>;
export const workflowResultSchema = z.array(jobSchema).max(1000);
export interface WorkflowPort { workflow(request: WorkflowRequest): Promise<Job[]> }
/** Transaction-local workflow hooks; never exposed as agent commands. */
export interface WorkflowUnitOfWork {
  enqueue(journey: Journey, requestId: string, limits: Job['limits'], now: string): Job;
  cancel(journey: Journey, jobId: string, now: string): Job;
}

import { z } from 'zod';
import { expectedVersionSchema, idSchema, referencesSchema, validate } from '../domain/common.js';
import { profileInputSchema } from '../domain/profile.js';
import { observationInputSchema, evidenceInputSchema } from '../domain/evidence.js';
import { experimentBaselineSchema, outcomeInputSchema } from '../domain/experiment.js';
import { jobLimitsSchema, HOST_LIMITS } from '../domain/job.js';
import { interpretationSchema } from '../domain/evidence.js';
import { recommendationSchema, offerSchema } from '../domain/recommendation.js';
import { DomainError, safeError } from '../domain/errors.js';
import type { ErrorCode } from '../domain/errors.js';

/** Continuations are scoped by resumeJourney's Journey and its current version. */
export const historyPageRequestSchema = z.strictObject({
  offset: z.number().int().min(0).max(5_000),
  limit: z.number().int().min(1).max(61),
  journeyVersion: expectedVersionSchema.refine(v => v > 0).optional(),
}).refine(page => page.offset === 0 || page.journeyVersion !== undefined);

const writeFields = { requestId: idSchema, expectedVersion: expectedVersionSchema };
const journeyWriteFields = { ...writeFields, journeyId: idSchema };
export const commandSchema = z.discriminatedUnion('action', [
  z.strictObject({ action: z.literal('saveProfile'), ...writeFields, profileId: idSchema, journeyId: idSchema.optional(), profile: profileInputSchema }),
  z.strictObject({ action: z.literal('createJourney'), ...writeFields, journeyId: idSchema, profileId: idSchema, profileVersion: expectedVersionSchema.refine(v => v > 0), priorLearning: referencesSchema }),
  z.strictObject({ action: z.literal('resumeJourney'), journeyId: idSchema, historyPage: historyPageRequestSchema.optional() }),
  z.strictObject({ action: z.literal('acceptFixtureEvidence'), ...journeyWriteFields, observationId: idSchema, evidenceId: idSchema, expectedObservationVersion: expectedVersionSchema, expectedEvidenceVersion: expectedVersionSchema, observation: observationInputSchema, evidence: evidenceInputSchema }),
  z.strictObject({ action: z.literal('reuseFixtureEvidence'), ...journeyWriteFields, evidence: referencesSchema.min(1) }),
  z.strictObject({ action: z.literal('saveFixtureAdvice'), ...journeyWriteFields, expectedRecordVersion: expectedVersionSchema, record: z.discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('interpretation'), data: interpretationSchema }),
    z.strictObject({ kind: z.literal('recommendation'), data: recommendationSchema }),
    z.strictObject({ kind: z.literal('offer'), data: offerSchema }),
  ]) }),
  z.strictObject({ action: z.literal('startExperiment'), ...journeyWriteFields, experimentId: idSchema, baseline: experimentBaselineSchema }),
  z.strictObject({ action: z.literal('recordOutcome'), ...journeyWriteFields, outcomeId: idSchema, outcome: outcomeInputSchema }),
  z.strictObject({ action: z.literal('enqueueJob'), ...journeyWriteFields, limits: jobLimitsSchema }),
  z.strictObject({ action: z.literal('cancelJob'), ...journeyWriteFields, jobId: idSchema }),
  z.strictObject({ action: z.enum(['collectEvidence', 'recommendDirections', 'prepareOffer']), ...journeyWriteFields }),
]);
export type Command = z.infer<typeof commandSchema>;
export type CommandAction = Command['action'];

/** Byte cap precedes JSON parsing. Bounded nesting prevents schema/canonicalization stack exhaustion. */
export function parseCommand(json: string): Command {
  if (json.length > HOST_LIMITS.inputBytes || new TextEncoder().encode(json).byteLength > HOST_LIMITS.inputBytes) throw new DomainError('validation');
  let depth = 0;
  let quoted = false;
  let escaped = false;
  for (const char of json) {
    if (quoted) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') quoted = false;
    } else if (char === '"') quoted = true;
    else if (char === '[' || char === '{') {
      if (++depth > 32) throw new DomainError('validation');
    } else if (char === ']' || char === '}') depth--;
  }
  let input: unknown;
  try { input = JSON.parse(json) as unknown; } catch { throw new DomainError('validation'); }
  return validate(commandSchema, input);
}

/** Operates only on already validated, JSON-compatible command values. */
export function canonicalCommand(command: Command): string {
  function ordered(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(ordered);
    if (value !== null && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, item]) => [key, ordered(item)]));
    }
    return value;
  }
  return JSON.stringify(ordered(validate(commandSchema, command)));
}
export type Result<T> =
  | { status: 'ok'; journeyId: string | null; requestId: string | null; data: T; warnings: string[] }
  | { status: 'error'; journeyId: string | null; requestId: string | null; error: { code: ErrorCode; message: string } };
export function resultSchema<T>(dataSchema: z.ZodType<T>) {
  const identity = { journeyId: idSchema.nullable(), requestId: idSchema.nullable() };
  return z.discriminatedUnion('status', [
    z.strictObject({ status: z.literal('ok'), ...identity, data: dataSchema, warnings: z.array(z.string().max(2_000)).max(20) }),
    z.strictObject({ status: z.literal('error'), ...identity, error: z.strictObject({
      code: z.enum(['validation', 'unauthorized', 'conflict', 'not-found', 'policy-denied', 'unavailable', 'budget-exhausted', 'storage-failure', 'reconciliation-required']),
      message: z.string().min(1).max(2_000),
    }) }),
  ]);
}
export function failure(error: unknown, command?: Command): Result<never> {
  return {
    status: 'error', journeyId: command && 'journeyId' in command ? command.journeyId ?? null : null,
    requestId: command && 'requestId' in command ? command.requestId : null,
    error: safeError(error),
  };
}

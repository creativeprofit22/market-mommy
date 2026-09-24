import { z } from 'zod';
import { jobSchema, HOST_LIMITS } from '../../domain/job.js';
import { storedRecordSchema } from '../../domain/records.js';
import { fixtureResultSchema, type FixtureResult } from '../../domain/fixture-result.js';
import { fixtureScenarioSchema } from '../providers/policy.js';
import { DomainError } from '../../domain/errors.js';

export const workerInputSchema = z.strictObject({
  job: jobSchema, scenario: fixtureScenarioSchema,
  port: z.number().int().min(1).max(65535), token: z.string().uuid(),
  evidence: z.array(storedRecordSchema).max(50),
});
export const workerResultSchema = z.strictObject({ type: z.literal('result'), text: z.string().max(HOST_LIMITS.jobTextBytes), retries: z.number().int().min(0).max(100), toolCalls: z.number().int().min(0).max(HOST_LIMITS.toolCalls), turns: z.number().int().min(0).max(HOST_LIMITS.turns), environmentKeyCount: z.number().int().min(0).max(1000) });
export function validateFixtureOutput(text: string, allowed: readonly { id: string; version: number }[], maxBytes: number): FixtureResult {
  if (Buffer.byteLength(text) > maxBytes) throw new DomainError('validation');
  const parsed = fixtureResultSchema.safeParse(JSON.parse(text) as unknown);
  if (!parsed.success || parsed.data.evidence.some(ref => !allowed.some(a => a.id === ref.id && a.version === ref.version)) || new Set(parsed.data.evidence.map(ref => ref.id)).size !== parsed.data.evidence.length) throw new DomainError('validation');
  return parsed.data;
}

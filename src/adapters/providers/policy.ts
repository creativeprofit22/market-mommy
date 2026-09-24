import { z } from 'zod';
import { DomainError } from '../../domain/errors.js';

export const fixtureScenarioSchema = z.enum(['success', 'read-evidence', 'malformed-output', 'retry-responses', 'delayed-stream', 'excessive-output', 'noncooperative-worker']);
export type FixtureScenario = z.infer<typeof fixtureScenarioSchema>;
/** No raw provider configuration is accepted here or by dispatch. Paid adapters are absent. */
export function denyLiveProvider(): never { throw new DomainError('policy-denied'); }
export const fixtureOptionsSchema = z.strictObject({ scenario: fixtureScenarioSchema.optional() });

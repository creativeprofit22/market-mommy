import { z } from 'zod';
import { referenceSchema } from './common.js';
/** Deliberately not a recommendation or market-research record. */
export const fixtureResultSchema = z.strictObject({
  scope: z.literal('synthetic-fixture'),
  label: z.literal('Deterministic synthetic fixture; not market research.'),
  evidence: z.array(referenceSchema).max(50),
});
export type FixtureResult = z.infer<typeof fixtureResultSchema>;

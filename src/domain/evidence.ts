import { z } from 'zod';
import { idSchema, recordFields, referenceSchema, referencesSchema, shortTextSchema, textSchema, timeSchema } from './common.js';

export const observationInputSchema = z.strictObject({
  sourceId: idSchema,
  originId: idSchema,
  statement: textSchema,
  observedAt: timeSchema.nullable(),
  publishedAt: timeSchema.nullable(),
  collectedAt: timeSchema,
  provenance: textSchema,
  permission: z.literal('synthetic-fixture'),
  retention: z.literal('until-explicit-fixture-removal'),
  limitations: z.array(shortTextSchema).min(1).max(20),
});
export const observationSchema = z.strictObject({ ...recordFields, ...observationInputSchema.shape });
export const evidenceInputSchema = z.strictObject({
  observation: referenceSchema,
  supportedClaim: textSchema,
  segment: shortTextSchema,
  independentOrigin: idSchema,
  duplicateGroup: idSchema,
  freshness: z.enum(['current', 'stale', 'unknown']),
  freshnessPolicyBasis: textSchema,
  uncertainty: z.array(shortTextSchema).min(1).max(20),
  contradictions: referencesSchema,
});
export const evidenceSchema = z.strictObject({ ...recordFields, ...evidenceInputSchema.shape });
export const interpretationSchema = z.strictObject({
  ...recordFields,
  journeyId: idSchema,
  profile: referenceSchema,
  evidence: referencesSchema.min(1),
  explanation: textSchema,
  unknowns: z.array(shortTextSchema).max(20),
  method: z.literal('fixture'),
  methodVersion: shortTextSchema,
  validity: z.enum(['current', 'reassessment-required', 'removed-dependency']),
});
export type Observation = z.infer<typeof observationSchema>;
export type Evidence = z.infer<typeof evidenceSchema>;
export type Interpretation = z.infer<typeof interpretationSchema>;

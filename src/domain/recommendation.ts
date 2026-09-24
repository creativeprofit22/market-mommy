import { z } from 'zod';
import { idSchema, recordFields, referenceSchema, referencesSchema, shortTextSchema, textSchema } from './common.js';
import { moneySchema } from './money.js';

const nextActionFields = {
  buyer: shortTextSchema, problem: textSchema, action: textSchema,
  fit: textSchema, economicAssumptions: z.array(textSchema).min(1).max(20),
  experiment: textSchema, successConditions: z.array(shortTextSchema).min(1).max(20),
  stopConditions: z.array(shortTextSchema).min(1).max(20),
  changesAdvice: z.array(shortTextSchema).min(1).max(20),
};
export const recommendationSchema = z.strictObject({
  ...recordFields,
  journeyId: idSchema,
  profile: referenceSchema,
  evidence: referencesSchema,
  counterevidence: referencesSchema,
  assumptions: z.array(textSchema).max(20),
  unknowns: z.array(shortTextSchema).max(20),
  validity: z.enum(['current', 'reassessment-required', 'removed-dependency']),
  decision: z.discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('action'), ...nextActionFields }),
    z.strictObject({ kind: z.literal('abstention'), reason: textSchema, informationNeeded: z.array(shortTextSchema).min(1).max(20) }),
  ]),
}).refine(value => value.decision.kind !== 'action' || value.evidence.length > 0);
export const offerSchema = z.strictObject({
  ...recordFields, journeyId: idSchema, recommendation: referenceSchema,
  buyer: shortTextSchema, problem: textSchema, deliverable: textSchema,
  exclusions: z.array(shortTextSchema).max(20), price: moneySchema,
  expenseAssumptions: z.array(textSchema).min(1).max(20),
  deliveryHours: z.number().min(0).max(10_000), buyerAccessRoute: textSchema,
});
export type Recommendation = z.infer<typeof recommendationSchema>;
export type Offer = z.infer<typeof offerSchema>;

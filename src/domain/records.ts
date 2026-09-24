import { z } from 'zod';
import { businessProfileSchema } from './profile.js';
import { evidenceSchema, interpretationSchema, observationSchema } from './evidence.js';
import { offerSchema, recommendationSchema } from './recommendation.js';
import { experimentSchema, outcomeSchema } from './experiment.js';
import { journeySchema } from './journey.js';
import { jobSchema } from './job.js';

export const storedRecordSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('profile'), data: businessProfileSchema }),
  z.strictObject({ kind: z.literal('observation'), data: observationSchema }),
  z.strictObject({ kind: z.literal('evidence'), data: evidenceSchema }),
  z.strictObject({ kind: z.literal('interpretation'), data: interpretationSchema }),
  z.strictObject({ kind: z.literal('recommendation'), data: recommendationSchema }),
  z.strictObject({ kind: z.literal('offer'), data: offerSchema }),
  z.strictObject({ kind: z.literal('experiment'), data: experimentSchema }),
  z.strictObject({ kind: z.literal('outcome'), data: outcomeSchema }),
  z.strictObject({ kind: z.literal('journey'), data: journeySchema }),
  z.strictObject({ kind: z.literal('job'), data: jobSchema }),
]);
export const recordKindSchema = z.enum(storedRecordSchema.options.map(option => option.shape.kind.value));
export type StoredRecord = z.infer<typeof storedRecordSchema>;

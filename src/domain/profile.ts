import { z } from 'zod';
import { recordFields, shortTextSchema, textSchema, timeSchema } from './common.js';
import { moneySchema } from './money.js';

export const profileInputSchema = z.strictObject({
  stage: z.enum(['finding-direction', 'first-customer', 'consistent-sales']),
  skills: z.array(shortTextSchema).max(30),
  deliverability: textSchema.nullable(),
  reachableBuyers: z.array(shortTextSchema).max(30),
  geography: z.literal('US'),
  availableHoursPerWeek: z.number().min(0).max(168).nullable(),
  incomeNeed: moneySchema.nullable(),
  incomeDeadline: timeSchema.nullable(),
  spendingTolerance: moneySchema.nullable(),
  preferences: z.array(shortTextSchema).max(30),
  qualifications: z.array(shortTextSchema).max(30),
  unknowns: z.array(shortTextSchema).max(30),
});
export const businessProfileSchema = z.strictObject({ ...recordFields, ...profileInputSchema.shape });
export type BusinessProfile = z.infer<typeof businessProfileSchema>;

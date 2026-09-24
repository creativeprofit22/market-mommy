import { z } from 'zod';
import { idSchema, recordFields, referenceSchema, referencesSchema, shortTextSchema, textSchema, timeSchema } from './common.js';
import { moneySchema } from './money.js';
import { DomainError } from './errors.js';

export const experimentBaselineSchema = z.strictObject({
  recommendation: referenceSchema, offer: referenceSchema,
  assumptions: z.array(textSchema).min(1).max(20),
  intendedActions: z.array(textSchema).min(1).max(20),
  successConditions: z.array(shortTextSchema).min(1).max(20),
  stopConditions: z.array(shortTextSchema).min(1).max(20),
});
export const experimentSchema = z.strictObject({
  ...recordFields, journeyId: idSchema, baseline: experimentBaselineSchema,
  state: z.enum(['draft', 'active', 'completed', 'stopped']),
  amendments: referencesSchema,
});
export const outcomeEventSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.enum(['conversation', 'objection', 'offer', 'repeat-purchase']), description: textSchema }),
  z.strictObject({ kind: z.enum(['paid-commitment', 'payment-received', 'refund', 'expense']), description: textSchema, money: moneySchema.refine(value => value.basis === 'observed') }),
  z.strictObject({ kind: z.literal('delivery-hours'), description: textSchema, hours: z.number().positive().max(10_000) }),
]);
export const outcomeInputSchema = z.strictObject({
  experimentId: idSchema, event: outcomeEventSchema,
  occurredAt: timeSchema.nullable(), provenance: z.literal('synthetic-self-report'),
  supersedes: referenceSchema.nullable(),
});
export const outcomeSchema = z.strictObject({ ...recordFields, journeyId: idSchema, ...outcomeInputSchema.shape });
export type Experiment = z.infer<typeof experimentSchema>;
export type Outcome = z.infer<typeof outcomeSchema>;

export function assertExperimentRevision(previous: Experiment, next: Experiment): void {
  const before = experimentSchema.parse(previous);
  const after = experimentSchema.parse(next);
  const allowed: Record<Experiment['state'], readonly Experiment['state'][]> = {
    draft: ['draft', 'active', 'stopped'], active: ['active', 'completed', 'stopped'],
    completed: [], stopped: [],
  };
  if (before.id !== after.id || before.journeyId !== after.journeyId || before.createdAt !== after.createdAt
      || after.version !== before.version + 1 || JSON.stringify(before.baseline) !== JSON.stringify(after.baseline)
      || !allowed[before.state].includes(after.state)
      || before.amendments.some(ref => !after.amendments.some(item => item.id === ref.id && item.version === ref.version))) {
    throw new DomainError('conflict');
  }
}

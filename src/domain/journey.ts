import { z } from 'zod';
import { idSchema, recordFields, referenceSchema, referencesSchema, shortTextSchema } from './common.js';
import { minorUnitsSchema } from './money.js';

/** Accepted fixture allowances from docs/evaluation.md, not provider-price guarantees. */
export const ALLOWANCES = Object.freeze({ sources: 2, evidence: 50, directions: 3, experiments: 1, runMinorUnits: '100', journeyMinorUnits: '300' });
export const journeyStateSchema = z.enum(['profile-draft', 'evidence-review', 'direction-selected', 'offer-prepared', 'experiment-active', 'outcome-review', 'stopped']);
export const journeySchema = z.strictObject({
  ...recordFields, profile: referenceSchema,
  state: journeyStateSchema, lastSavedStep: shortTextSchema,
  selectedExperiment: referenceSchema.nullable(),
  history: z.array(referenceSchema).max(1_000).refine(values => new Set(values.map(value => `${value.id}:${value.version}`)).size === values.length), priorLearning: referencesSchema,
  jobIds: z.array(idSchema).max(1_000),
  workload: z.strictObject({
    sourceIds: z.array(idSchema).max(ALLOWANCES.sources),
    evidenceIds: z.array(idSchema).max(ALLOWANCES.evidence),
    directionIds: z.array(idSchema).max(ALLOWANCES.directions),
    experimentIds: z.array(idSchema).max(ALLOWANCES.experiments),
  }),
  costs: z.strictObject({
    actualMinorUnits: minorUnitsSchema, outstandingMinorUnits: minorUnitsSchema,
    unknownMinorUnits: minorUnitsSchema,
  }),
}).superRefine((value, ctx) => {
  for (const ids of Object.values(value.workload)) {
    if (new Set(ids).size !== ids.length) ctx.addIssue({ code: 'custom', message: 'Duplicate workload membership' });
  }
  if (new Set(value.jobIds).size !== value.jobIds.length) ctx.addIssue({ code: 'custom', message: 'Duplicate job membership' });
  if (value.selectedExperiment && !value.workload.experimentIds.includes(value.selectedExperiment.id)) ctx.addIssue({ code: 'custom', message: 'Experiment is not workload member' });
  if (['experiment-active', 'outcome-review'].includes(value.state) && !value.selectedExperiment) ctx.addIssue({ code: 'custom', message: 'Experiment selection required' });
  if (minorUnitsSchema.safeParse(value.costs.unknownMinorUnits).success && minorUnitsSchema.safeParse(value.costs.outstandingMinorUnits).success && BigInt(value.costs.unknownMinorUnits) > BigInt(value.costs.outstandingMinorUnits)) ctx.addIssue({ code: 'custom', message: 'Unknown charges must retain reservations' });
});
export type Journey = z.infer<typeof journeySchema>;

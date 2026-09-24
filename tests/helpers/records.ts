export const now = '2026-09-19T00:00:00.000Z';
export const ref = { id: 'record-1', version: 1 };
export const base = { id: 'record-1', version: 1, createdAt: now };
export const money = { minorUnits: '100', currency: 'USD', scale: 2, basis: 'observed', includedExpenses: [], excludedExpenses: ['tax'] };
export const profile = {
  stage: 'finding-direction', skills: ['spreadsheets'], deliverability: 'Synthetic spreadsheet task',
  reachableBuyers: ['synthetic professional group'], geography: 'US', availableHoursPerWeek: 5,
  incomeNeed: money, incomeDeadline: null, spendingTolerance: money,
  preferences: [], qualifications: [], unknowns: ['income deadline'],
};
export const observation = {
  sourceId: 'source-1', originId: 'origin-1', statement: 'Synthetic observation, not market research.',
  observedAt: null, publishedAt: null, collectedAt: now, provenance: 'Manual synthetic fixture',
  permission: 'synthetic-fixture', retention: 'until-explicit-fixture-removal', limitations: ['Synthetic only'],
};
export const evidence = {
  observation: ref, supportedClaim: 'A fixture statement exists', segment: 'Synthetic', independentOrigin: 'origin-1',
  duplicateGroup: 'group-1', freshness: 'unknown', freshnessPolicyBasis: 'Publication date unknown',
  uncertainty: ['Not real-world evidence'], contradictions: [],
};
export const interpretation = {
  ...base, journeyId: 'journey-1', profile: ref, evidence: [ref], explanation: 'A synthetic interpretation',
  unknowns: ['Demand'], method: 'fixture', methodVersion: '1', validity: 'current',
};
export const recommendation = {
  ...base, journeyId: 'journey-1', profile: ref, evidence: [], counterevidence: [],
  assumptions: [], unknowns: ['Demand'], validity: 'current',
  decision: { kind: 'abstention', reason: 'No market evidence', informationNeeded: ['Permitted observations'] },
};
export const offer = {
  ...base, journeyId: 'journey-1', recommendation: ref, buyer: 'Synthetic buyer', problem: 'Synthetic problem',
  deliverable: 'Spreadsheet', exclusions: [], price: money, expenseAssumptions: ['Tax unknown'],
  deliveryHours: 2, buyerAccessRoute: 'Manual fixture; no outreach',
};
export const baseline = {
  recommendation: ref, offer: ref, assumptions: ['Fixture only'], intendedActions: ['Record a synthetic conversation'],
  successConditions: ['Record one conversation'], stopConditions: ['No permitted access'],
};
export const experiment = { ...base, journeyId: 'journey-1', baseline, state: 'active', amendments: [] };
export const outcome = {
  ...base, journeyId: 'journey-1', experimentId: 'experiment-1',
  event: { kind: 'payment-received', description: 'Synthetic deposit', money },
  occurredAt: now, provenance: 'synthetic-self-report', supersedes: null,
};
export const journey = {
  ...base, profile: ref, state: 'profile-draft', lastSavedStep: 'profile-saved', selectedExperiment: null,
  history: [], priorLearning: [], jobIds: [], workload: { sourceIds: [], evidenceIds: [], directionIds: [], experimentIds: [] },
  costs: { actualMinorUnits: '0', outstandingMinorUnits: '0', unknownMinorUnits: '0' },
};
export const limits = { turns: 4, outputTokens: 2048, outputBytes: 65536, toolCalls: 8, toolTimeoutMs: 5000, deadlineMs: 120000 };
export const job = {
  ...base, journeyId: 'journey-1', rootJobId: 'job-1', attemptId: 'attempt-1', precedingAttemptId: null, requestId: 'request-1',
  useCase: 'fixture-interpretation', scope: 'synthetic-fixture', inputVersions: [], state: 'queued', checkpoint: null,
  deadlineAt: now, limits, reservedMinorUnits: '0', actualMinorUnits: '0', billing: 'not-started', providerRequestId: null, fence: 0,
};

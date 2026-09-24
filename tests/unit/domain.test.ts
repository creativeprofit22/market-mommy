import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { businessProfileSchema } from '../../src/domain/profile.js';
import { evidenceSchema, interpretationSchema, observationSchema } from '../../src/domain/evidence.js';
import { offerSchema, recommendationSchema } from '../../src/domain/recommendation.js';
import { assertExperimentRevision, experimentSchema, outcomeSchema } from '../../src/domain/experiment.js';
import { journeySchema } from '../../src/domain/journey.js';
import { assertJobTransition, jobLimitsSchema, jobSchema, jobStateSchema } from '../../src/domain/job.js';
import { addMinorUnits, minorUnitsSchema, moneySchema, remainingMinorUnits } from '../../src/domain/money.js';
import { nextVersion, validate } from '../../src/domain/common.js';
import { DomainError, safeError } from '../../src/domain/errors.js';
import { authorize, createTrustedContext } from '../../src/application/authorization.js';
import { canonicalCommand, failure, parseCommand, resultSchema } from '../../src/application/commands.js';
import * as fixture from '../helpers/records.js';

const schemas = [
  ['profile', businessProfileSchema, { ...fixture.base, ...fixture.profile }],
  ['observation', observationSchema, { ...fixture.base, ...fixture.observation }],
  ['evidence', evidenceSchema, { ...fixture.base, ...fixture.evidence }],
  ['interpretation', interpretationSchema, fixture.interpretation],
  ['recommendation', recommendationSchema, fixture.recommendation],
  ['offer', offerSchema, fixture.offer], ['experiment', experimentSchema, fixture.experiment],
  ['outcome', outcomeSchema, fixture.outcome], ['journey', journeySchema, fixture.journey], ['job', jobSchema, fixture.job],
] as const;
for (const [name, schema, value] of schemas) {
  test(`${name}: validated versioned record round trips and rejects extra authority`, () => {
    assert.deepEqual(schema.parse(JSON.parse(JSON.stringify(value))), value);
    assert.equal(schema.safeParse({ ...value, confirmed: true }).success, false);
    assert.equal(schema.safeParse({ ...value, version: 0 }).success, false);
    assert.equal(schema.safeParse({ ...value, createdAt: '2026-09-19' }).success, false);
  });
}

test('money is canonical bounded integer text, never binary floating-point', () => {
  assert.equal(addMinorUnits('9007199254740993', '1'), '9007199254740994');
  assert.equal(remainingMinorUnits('300', '100'), '200');
  assert.equal(JSON.parse(JSON.stringify(moneySchema.parse(fixture.money))).minorUnits, '100');
  for (const invalid of ['-1', '01', '1.00', '1e2', 'NaN', '', '9223372036854775808', 1, null]) {
    assert.equal(minorUnitsSchema.safeParse(invalid).success, false);
    assert.throws(() => addMinorUnits(invalid as string), { code: 'validation' });
  }
  assert.throws(() => addMinorUnits('9223372036854775807', '1'), { code: 'validation' });
  assert.throws(() => remainingMinorUnits('100', '101'), { code: 'budget-exhausted' });
  assert.equal(moneySchema.safeParse({ ...fixture.money, currency: 'EUR' }).success, false);
});

test('version increments are expected-version checked and bounded', () => {
  assert.equal(nextVersion(0, 0), 1);
  assert.equal(nextVersion(1, 1), 2);
  assert.throws(() => nextVersion(2, 1), { code: 'conflict' });
  assert.throws(() => nextVersion(2_147_483_647, 2_147_483_647), { code: 'validation' });
  assert.throws(() => nextVersion(-1, 0), { code: 'validation' });
});

test('terminal job history cannot transition back into execution', () => {
  assertJobTransition('queued', 'running');
  assertJobTransition('running', 'cancel-requested');
  assertJobTransition('cancel-requested', 'succeeded');
  assertJobTransition('running', 'reconciliation-required');
  for (const from of ['succeeded', 'partial', 'failed', 'cancelled', 'budget-exhausted', 'reconciliation-required'] as const) {
    for (const to of jobStateSchema.options) assert.throws(() => assertJobTransition(from, to), { code: 'conflict' });
  }
});

test('caller limits can only reduce positive host ceilings', () => {
  assert.equal(jobLimitsSchema.safeParse(fixture.limits).success, true);
  for (const [key, limit] of Object.entries(fixture.limits)) {
    assert.equal(jobLimitsSchema.safeParse({ ...fixture.limits, [key]: limit + 1 }).success, false);
    assert.equal(jobLimitsSchema.safeParse({ ...fixture.limits, [key]: 0 }).success, false);
    assert.equal(jobLimitsSchema.safeParse({ ...fixture.limits, [key]: 1 }).success, true);
  }
});

test('unknown dates remain unknown; live or unpermitted observations reject', () => {
  const parsed = observationSchema.parse({ ...fixture.base, ...fixture.observation });
  assert.equal(parsed.publishedAt, null);
  assert.equal(parsed.observedAt, null);
  assert.equal(observationSchema.safeParse({ ...parsed, permission: 'public-web' }).success, false);
});

test('abstention is valid without evidence; asserted actions need evidence', () => {
  const action = { kind: 'action', buyer: 'Fixture buyer', problem: 'Fixture problem', action: 'Fixture action', fit: 'Fixture fit', economicAssumptions: ['Unknown costs'], experiment: 'Manual conversation', successConditions: ['Learn one objection'], stopConditions: ['No permission'], changesAdvice: ['Contradicting evidence'] };
  assert.equal(recommendationSchema.safeParse({ ...fixture.recommendation, decision: action }).success, false);
  assert.equal(recommendationSchema.safeParse({ ...fixture.recommendation, evidence: [fixture.ref], decision: action }).success, true);
});

test('payment and commitment are separate; neither can use assumed money', () => {
  const payment = outcomeSchema.parse(fixture.outcome);
  const commitment = outcomeSchema.parse({ ...fixture.outcome, event: { ...fixture.outcome.event, kind: 'paid-commitment' } });
  assert.notEqual(payment.event.kind, commitment.event.kind);
  assert.equal(outcomeSchema.safeParse({ ...fixture.outcome, event: { ...fixture.outcome.event, money: { ...fixture.money, basis: 'assumed' } } }).success, false);
});

test('experiment revisions preserve the original baseline and terminal history', () => {
  const before = experimentSchema.parse(fixture.experiment);
  const after = { ...before, version: 2, state: 'completed' as const };
  assertExperimentRevision(before, after);
  assert.throws(() => assertExperimentRevision(before, { ...after, baseline: { ...before.baseline, assumptions: ['Rewritten after results'] } }), { code: 'conflict' });
  assert.throws(() => assertExperimentRevision(after, { ...after, version: 3, state: 'active' }), { code: 'conflict' });
});

test('shared result validation checks both identity and domain data', () => {
  const schema = resultSchema(journeySchema);
  const result = { status: 'ok', journeyId: 'J', requestId: null, data: fixture.journey, warnings: [] };
  assert.equal(schema.safeParse(result).success, true);
  assert.equal(schema.safeParse({ ...result, data: { ...fixture.journey, version: 0 } }).success, false);
  assert.equal(schema.safeParse({ ...result, apiKey: 'NONSECRET_SENTINEL' }).success, false);
  assert.equal(schema.safeParse(failure(new DomainError('validation'))).success, true);
});

test('journey workload uniqueness, selection and unknown reservation containment', () => {
  assert.equal(journeySchema.safeParse({ ...fixture.journey, state: 'experiment-active' }).success, false);
  assert.equal(journeySchema.safeParse({ ...fixture.journey, workload: { ...fixture.journey.workload, evidenceIds: ['e1', 'e1'] } }).success, false);
  assert.equal(journeySchema.safeParse({ ...fixture.journey, costs: { actualMinorUnits: '0', outstandingMinorUnits: '0', unknownMinorUnits: '1' } }).success, false);
  assert.equal(journeySchema.safeParse({ ...fixture.journey, costs: { actualMinorUnits: '0', outstandingMinorUnits: 'invalid', unknownMinorUnits: '1' } }).success, false);
});

test('command parser bounds bytes, nesting, types and explicit Journey selection', () => {
  assert.deepEqual(parseCommand('{"action":"resumeJourney","journeyId":"J-A"}'), { action: 'resumeJourney', journeyId: 'J-A' });
  for (const input of ['{', 'null', '[]', '{"action":"resumeJourney","profileId":"P"}', '{"action":"resumeJourney","journeyId":"J","confirmed":true}', ' '.repeat(262145), '"' + '🙂'.repeat(70000) + '"', '['.repeat(33) + ']'.repeat(33)]) {
    assert.throws(() => parseCommand(input), { code: 'validation' });
  }
  const first = parseCommand(JSON.stringify({ action: 'saveProfile', profileId: 'P', expectedVersion: 0, requestId: 'R', profile: fixture.profile }));
  const reordered = parseCommand(JSON.stringify({ profile: fixture.profile, requestId: 'R', expectedVersion: 0, profileId: 'P', action: 'saveProfile' }));
  assert.equal(canonicalCommand(first), canonicalCommand(reordered));
  const otherJourney = parseCommand(JSON.stringify({ ...first, journeyId: 'other-journey' }));
  assert.notEqual(canonicalCommand(first), canonicalCommand(otherJourney));
});

test('trusted launch scopes cannot be forged through request context data', () => {
  const reader = createTrustedContext();
  authorize(reader, 'resumeJourney');
  assert.throws(() => authorize(reader, 'saveProfile'), { code: 'unauthorized' });
  assert.throws(() => authorize({ kind: 'local-launch-context' }, 'resumeJourney'), { code: 'unauthorized' });
  const writer = createTrustedContext(['fixture-write']);
  authorize(writer, 'saveProfile');
  assert.throws(() => authorize(writer, 'enqueueJob'), { code: 'unauthorized' });
});

test('error envelopes never echo arbitrary exception text or validation input', () => {
  const sentinel = 'NONSECRET_SENTINEL_DO_NOT_ECHO';
  assert.equal(JSON.stringify(failure(new Error(sentinel))).includes(sentinel), false);
  assert.equal(safeError(new DomainError('validation')).code, 'validation');
  assert.throws(() => validate(moneySchema, { sentinel }), { code: 'validation' });
});

test('scenario inventory retains 10/10/10 predeclared groups and unevaluated quality', () => {
  const file = JSON.parse(readFileSync(new URL('../../../tests/fixtures/scenarios.json', import.meta.url), 'utf8')) as { scenarios: { id: string; group: string; expected: string; quality: string; actionRequired: boolean }[] };
  assert.equal(file.scenarios.length, 30);
  assert.equal(new Set(file.scenarios.map(s => s.id)).size, 30);
  for (const group of ['ordinary', 'insufficient', 'failure-correction']) assert.equal(file.scenarios.filter(s => s.group === group).length, 10);
  for (const scenario of file.scenarios) {
    assert.ok(scenario.expected.length > 10);
    assert.equal(scenario.quality, 'unevaluated');
    if (scenario.group === 'ordinary') assert.equal(scenario.actionRequired, true);
    if (scenario.group === 'insufficient') assert.match(scenario.expected, /[Aa]bstain/);
  }
});

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  chooseOption,
  initialState,
  NOTE_MAX_LENGTH,
  outcomeKinds,
  outcomeNeedsAmount,
  parseAmountCents,
  parseOutcome,
  parsePath,
  recordOutcome,
  resolveRoute,
  resumeTarget,
  returnTarget,
  routeToPath,
  shortlist,
  stateFromExample,
  submitAnswer,
  toProfileDraft,
  unknowns,
  visit,
} from '../../ui/prototype/src/journey-model.js';
import type { Answer, JourneyState, OutcomeDraft, OutcomeKind, RecordedOutcome, RecordError, Result, Route } from '../../ui/prototype/src/journey-model.js';
import { outcomeInputSchema } from '../../src/domain/experiment.js';
import { profileInputSchema } from '../../src/domain/profile.js';
import type { QuestionId } from '../../ui/prototype/src/fixtures.js';

function answerAll(entries: readonly (readonly [QuestionId, Answer])[]): { state: JourneyState; next: Route } {
  let state = initialState;
  let next: Route = { name: 'welcome' };
  for (const [id, answer] of entries) {
    const result = submitAnswer(state, id, answer);
    assert.equal(result.ok, true, `answer ${id}`);
    if (!result.ok) throw new Error('unreachable');
    ({ state, next } = result.value);
  }
  return { state, next };
}
const choice = (value: string): Answer => ({ kind: 'choice', value });
const unsure: Answer = { kind: 'unsure' };

test('"I\'m not sure" is accepted for every question and never blocks the shortlist', () => {
  const { state, next } = answerAll([['skill', unsure], ['hours', unsure], ['money', unsure], ['timing', unsure]]);
  assert.deepEqual(next, { name: 'options' });
  const options = shortlist(state);
  assert.ok(options.length > 0 && options.length <= 3);
  assert.ok(options.every((option) => option.upfrontCostUsd === 0), 'unsure money shows only no-cost options');
  assert.equal(unknowns(state).length, 4);
});

test('continuing without an answer is a validation error and keeps state unchanged', () => {
  const result = submitAnswer(initialState, 'skill', null);
  assert.deepEqual(result, { ok: false, error: 'missing-answer' });
  assert.deepEqual(submitAnswer(initialState, 'skill', choice('juggling')), { ok: false, error: 'unknown-choice' });
});

test('urgent income need leads to the safe exit before any option is shown', () => {
  const { state, next } = answerAll([['skill', choice('writing')], ['hours', choice('3-to-6')], ['money', choice('50')], ['timing', choice('within-2-weeks')]]);
  assert.deepEqual(next, { name: 'stop-here' });
  assert.deepEqual(resolveRoute(state, { name: 'options' }), { name: 'stop-here' });
  assert.deepEqual(resolveRoute(state, { name: 'next-step' }), { name: 'stop-here' });
  const changed = submitAnswer(state, 'timing', choice('1-to-2-months'));
  assert.ok(changed.ok);
  if (changed.ok) assert.deepEqual(changed.value.next, { name: 'options' });
});

test('shortlist respects skill and money limits and only allows choosing a listed option', () => {
  const { state } = answerAll([['skill', choice('bookkeeping')], ['hours', choice('3-to-6')], ['money', choice('0')], ['timing', choice('no-fixed-date')]]);
  assert.deepEqual(shortlist(state).map((option) => option.id), ['spreadsheet-tidy']);
  assert.deepEqual(chooseOption(state, 'move-out-cleaning'), { ok: false, error: 'not-on-shortlist' });
  const chosen = chooseOption(state, 'spreadsheet-tidy');
  assert.ok(chosen.ok);
  if (chosen.ok) assert.equal(chosen.value.chosenOptionId, 'spreadsheet-tidy');
});

test('skipping ahead by address sends the person to the first unanswered question', () => {
  const { state } = answerAll([['skill', choice('writing')]]);
  assert.deepEqual(resolveRoute(state, { name: 'question', question: 'timing' }), { name: 'question', question: 'hours' });
  assert.deepEqual(resolveRoute(state, { name: 'next-step' }), { name: 'question', question: 'hours' });
});

test('return-to-progress goes back to the exact step with answers intact', () => {
  const { state: answered } = answerAll([['skill', choice('writing')], ['hours', choice('3-to-6')], ['money', choice('50')], ['timing', choice('no-fixed-date')]]);
  const chosen = chooseOption(answered, 'newsletter-proofread');
  assert.ok(chosen.ok);
  if (!chosen.ok) return;
  const atNextStep = visit(chosen.value, { name: 'next-step' });
  const onProgress = visit(atNextStep, { name: 'progress' });
  assert.deepEqual(returnTarget(onProgress), { name: 'next-step' });
  assert.deepEqual(onProgress.answers, answered.answers);
  const midQuestion = visit(answered, { name: 'question', question: 'money' });
  assert.deepEqual(returnTarget(visit(midQuestion, { name: 'progress' })), { name: 'question', question: 'money' });
});

test('continue-where-you-left-off resumes at the furthest reachable step, even after visiting welcome', () => {
  const all: readonly (readonly [QuestionId, Answer])[] = [['skill', choice('writing')], ['hours', choice('3-to-6')], ['money', choice('50')], ['timing', choice('no-fixed-date')]];
  const urgent: readonly (readonly [QuestionId, Answer])[] = [...all.slice(0, 3), ['timing', choice('within-2-weeks')]];
  const answered = answerAll(all).state;
  const chosen = chooseOption(answered, 'newsletter-proofread');
  assert.ok(chosen.ok);
  if (!chosen.ok) return;
  const cases: readonly { readonly name: string; readonly state: JourneyState; readonly expected: Route }[] = [
    { name: 'no answers', state: initialState, expected: { name: 'question', question: 'skill' } },
    { name: 'two answers', state: answerAll(all.slice(0, 2)).state, expected: { name: 'question', question: 'money' } },
    { name: 'all answered, urgent', state: answerAll(urgent).state, expected: { name: 'stop-here' } },
    { name: 'chosen option', state: chosen.value, expected: { name: 'next-step' } },
    { name: 'all answered, no choice', state: answered, expected: { name: 'options' } },
  ];
  for (const { name, state, expected } of cases) {
    assert.deepEqual(resumeTarget(state), expected, name);
    assert.deepEqual(resumeTarget(visit(state, { name: 'welcome' })), expected, `${name} after welcome`);
  }
});

test('changing an earlier answer clears a direction that may no longer fit', () => {
  const { state } = answerAll([['skill', choice('writing')], ['hours', choice('3-to-6')], ['money', choice('50')], ['timing', choice('no-fixed-date')]]);
  const chosen = chooseOption(state, 'newsletter-proofread');
  assert.ok(chosen.ok);
  if (!chosen.ok) return;
  const same = submitAnswer(chosen.value, 'hours', choice('3-to-6'));
  assert.ok(same.ok && same.value.state.chosenOptionId === 'newsletter-proofread');
  const changed = submitAnswer(chosen.value, 'skill', choice('bookkeeping'));
  assert.ok(changed.ok && changed.value.state.chosenOptionId === null);
});

function chosenState(): JourneyState {
  const { state } = answerAll([['skill', choice('writing')], ['hours', choice('3-to-6')], ['money', choice('50')], ['timing', choice('no-fixed-date')]]);
  const chosen = chooseOption(state, 'shop-descriptions');
  assert.ok(chosen.ok);
  if (!chosen.ok) throw new Error('unreachable');
  return chosen.value;
}
const draft = (kind: string | null, amount = '', note = ''): OutcomeDraft => ({ kind, amount, note });

test('recording an outcome needs a direction and a listed outcome', () => {
  assert.deepEqual(recordOutcome(initialState, draft('payment-received', '25')), { ok: false, error: 'no-direction' });
  const chosen = chosenState();
  assert.deepEqual(recordOutcome(chosen, draft(null)), { ok: false, error: 'missing-answer' });
  assert.deepEqual(recordOutcome(chosen, draft('paid')), { ok: false, error: 'missing-answer' }, 'old prototype names are not accepted');
  const recorded = recordOutcome(chosen, draft('paid-commitment', '40', '  Asked for Friday delivery.  '));
  assert.ok(recorded.ok);
  if (recorded.ok) assert.deepEqual(recorded.value.outcome, { kind: 'paid-commitment', amountCents: 4_000, note: 'Asked for Friday delivery.' });
});

test('an amount is required for the money outcomes and rejected for the others', () => {
  const chosen = chosenState();
  const cases: readonly { readonly name: string; readonly input: OutcomeDraft; readonly expected: Result<RecordedOutcome, RecordError> }[] = [
    { name: 'agreed, no amount', input: draft('paid-commitment'), expected: { ok: false, error: 'missing-amount' } },
    { name: 'arrived, blank amount', input: draft('payment-received', '   '), expected: { ok: false, error: 'missing-amount' } },
    { name: 'arrived, zero', input: draft('payment-received', '0'), expected: { ok: false, error: 'invalid-amount' } },
    { name: 'arrived, negative', input: draft('payment-received', '-5'), expected: { ok: false, error: 'invalid-amount' } },
    { name: 'arrived, words', input: draft('payment-received', 'twenty'), expected: { ok: false, error: 'invalid-amount' } },
    { name: 'arrived, three decimals', input: draft('payment-received', '1.005'), expected: { ok: false, error: 'invalid-amount' } },
    { name: 'arrived, over the limit', input: draft('payment-received', '1000000.01'), expected: { ok: false, error: 'invalid-amount' } },
    { name: 'arrived, 25', input: draft('payment-received', '25'), expected: { ok: true, value: { kind: 'payment-received', amountCents: 2_500, note: null } } },
    { name: 'arrived, formatted', input: draft('payment-received', '$1,250.5'), expected: { ok: true, value: { kind: 'payment-received', amountCents: 125_050, note: null } } },
    { name: 'no reply with amount', input: draft('conversation', '10'), expected: { ok: false, error: 'unexpected-amount' } },
    { name: 'said no with amount', input: draft('objection', '10'), expected: { ok: false, error: 'unexpected-amount' } },
    { name: 'no reply', input: draft('conversation'), expected: { ok: true, value: { kind: 'conversation', amountCents: null, note: null } } },
    { name: 'said no, with note', input: draft('objection', '', 'Too expensive.'), expected: { ok: true, value: { kind: 'objection', amountCents: null, note: 'Too expensive.' } } },
    { name: 'note too long', input: draft('objection', '', 'x'.repeat(NOTE_MAX_LENGTH + 1)), expected: { ok: false, error: 'note-too-long' } },
  ];
  for (const { name, input, expected } of cases) {
    assert.deepEqual(parseOutcome(input), expected, name);
    const recorded = recordOutcome(chosen, input);
    assert.deepEqual(recorded.ok ? { ok: true, value: recorded.value.outcome } : recorded, expected, `${name} via recordOutcome`);
  }
  assert.equal(parseAmountCents('12.3'), 1_230);
});

test('every outcome the record screen can save maps to a valid core outcome payload', () => {
  const labels: Record<OutcomeKind, string> = { 'paid-commitment': 'They agreed to buy', 'payment-received': 'Money arrived', conversation: 'No reply yet', objection: 'They said no' };
  for (const kind of outcomeKinds) {
    const parsed = parseOutcome(draft(kind, outcomeNeedsAmount(kind) ? '25' : ''));
    assert.ok(parsed.ok, kind);
    if (!parsed.ok) continue;
    const { amountCents, note } = parsed.value;
    const description = note ?? labels[kind];
    const event = amountCents === null
      ? { kind, description }
      : { kind, description, money: { minorUnits: String(amountCents), currency: 'USD', scale: 2, basis: 'observed', includedExpenses: [], excludedExpenses: [] } };
    const payload = { experimentId: 'exp-practice', event, occurredAt: null, provenance: 'synthetic-self-report', supersedes: null };
    assert.equal(outcomeInputSchema.safeParse(payload).success, true, kind);
  }
  const example = stateFromExample('recorded');
  assert.deepEqual(example?.outcome, { kind: 'paid-commitment', amountCents: 4_000, note: null });
});

const NOW = new Date('2026-09-26T12:00:00.000Z');
const usd = (minorUnits: string): unknown => ({ minorUnits, currency: 'USD', scale: 2, basis: 'assumed', includedExpenses: [], excludedExpenses: [] });
/** Local copy of the answer-derived `profileInputSchema` field names (docs/ux/journey.md, "Mapping answers to the profile"). */
const draftFields = ['availableHoursPerWeek', 'incomeDeadline', 'incomeNeed', 'skills', 'spendingTolerance', 'unknowns'];
/** Profile fields the prototype does not ask; filled only so the whole draft can be parsed by the core schema. */
const notAsked = { stage: 'finding-direction', deliverability: null, reachableBuyers: [], geography: 'US', preferences: [], qualifications: [] };

test('each answer maps to the profile field the core expects', () => {
  const cases: readonly { name: string; answers: readonly (readonly [QuestionId, Answer])[]; expected: Record<string, unknown> }[] = [
    {
      name: 'writer, 1 to 2 months',
      answers: [['skill', choice('writing')], ['hours', choice('3-to-6')], ['money', choice('50')], ['timing', choice('1-to-2-months')]],
      expected: { skills: ['writing'], availableHoursPerWeek: 3, spendingTolerance: usd('5000'), incomeNeed: null, incomeDeadline: '2026-10-26T12:00:00.000Z', unknowns: [] },
    },
    {
      name: 'urgent, under 3 hours, nothing to spend',
      answers: [['skill', choice('tutoring')], ['hours', choice('under-3')], ['money', choice('0')], ['timing', choice('within-2-weeks')]],
      expected: { skills: ['tutoring'], availableHoursPerWeek: 0, spendingTolerance: usd('0'), incomeNeed: null, incomeDeadline: '2026-10-10T12:00:00.000Z', unknowns: [] },
    },
    {
      name: 'no fixed date, over 12 hours',
      answers: [['skill', choice('cleaning')], ['hours', choice('over-12')], ['money', choice('200')], ['timing', choice('no-fixed-date')]],
      expected: { skills: ['cleaning'], availableHoursPerWeek: 12, spendingTolerance: usd('20000'), incomeNeed: null, incomeDeadline: null, unknowns: [] },
    },
    {
      name: 'seven to twelve hours',
      answers: [['skill', choice('bookkeeping')], ['hours', choice('7-to-12')], ['money', choice('50')], ['timing', choice('no-fixed-date')]],
      expected: { skills: ['bookkeeping'], availableHoursPerWeek: 7, spendingTolerance: usd('5000'), incomeNeed: null, incomeDeadline: null, unknowns: [] },
    },
  ];
  for (const { name, answers, expected } of cases) {
    const result = toProfileDraft(answerAll(answers).state, NOW);
    assert.deepEqual(result, { ok: true, value: expected }, name);
  }
});

test('"I\'m not sure" maps to null or empty plus an unknowns entry', () => {
  const { state } = answerAll([['skill', unsure], ['hours', unsure], ['money', unsure], ['timing', unsure]]);
  const result = toProfileDraft(state, NOW);
  if (!result.ok) throw new Error(result.error);
  const { skills, availableHoursPerWeek, spendingTolerance, incomeNeed, incomeDeadline } = result.value;
  assert.deepEqual({ skills, availableHoursPerWeek, spendingTolerance, incomeNeed, incomeDeadline }, { skills: [], availableHoursPerWeek: null, spendingTolerance: null, incomeNeed: null, incomeDeadline: null });
  assert.deepEqual(result.value.unknowns, unknowns(state));
  assert.equal(result.value.unknowns.length, 4);
});

test('profile drafts use the core field names and parse as a core profile input', () => {
  for (const name of ['answered', 'unsure', 'urgent', 'thin']) {
    const state = stateFromExample(name);
    assert.ok(state, name);
    const result = toProfileDraft(state, NOW);
    if (!result.ok) throw new Error(result.error);
    assert.deepEqual(Object.keys(result.value).sort(), draftFields, name);
    assert.equal(profileInputSchema.safeParse({ ...notAsked, ...result.value }).success, true, name);
  }
});

test('profile draft needs every answer, a valid clock and known choices', () => {
  assert.deepEqual(toProfileDraft(initialState, NOW), { ok: false, error: 'incomplete' });
  const answered = stateFromExample('answered');
  assert.ok(answered);
  assert.deepEqual(toProfileDraft(answered, new Date(Number.NaN)), { ok: false, error: 'invalid-now' });
  const tampered: JourneyState = { ...answered, answers: { ...answered.answers, hours: choice('forever') } };
  assert.deepEqual(toProfileDraft(tampered, NOW), { ok: false, error: 'unknown-choice' });
});

test('addresses round-trip and unknown addresses fall back to welcome', () => {
  const routes: Route[] = [{ name: 'welcome' }, { name: 'question', question: 'money' }, { name: 'stop-here' }, { name: 'options' }, { name: 'next-step' }, { name: 'record' }, { name: 'progress' }];
  for (const route of routes) assert.deepEqual(parsePath(routeToPath(route)), route);
  for (const path of ['', '/', '/about/secret', '/../etc', '/admin', '/about/skill/extra']) assert.deepEqual(parsePath(path), { name: 'welcome' });
});

// Pure journey rules for the practice prototype. No DOM, no clock, no storage.
import { practiceExamples, practiceOptions, questionIds, questions, URGENT_TIMING } from './fixtures.js';
import type { PracticeExample, PracticeOption, Question, QuestionId } from './fixtures.js';

export type Result<T, E> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: E };

export type Answer = { readonly kind: 'choice'; readonly value: string } | { readonly kind: 'unsure' };

/**
 * Outcome kinds use the application core's event names (see docs/ux/journey.md, "Recording a result").
 * Display order: agreed to buy, money arrived, no reply yet, said no.
 */
export const outcomeKinds = ['paid-commitment', 'payment-received', 'conversation', 'objection'] as const;
export type OutcomeKind = (typeof outcomeKinds)[number];

/** Longest note the core accepts as an outcome description. */
export const NOTE_MAX_LENGTH = 2_000;
/** Largest amount the practice form accepts, in cents ($1,000,000.00). */
export const AMOUNT_MAX_CENTS = 100_000_000;

/** A saved result. `amountCents` is an observed US-dollar amount, present only for the two money kinds. `note` is null when left blank. */
export interface RecordedOutcome {
  readonly kind: OutcomeKind;
  readonly amountCents: number | null;
  readonly note: string | null;
}

/** Raw form input before validation. `amount` is empty when the amount field does not apply. */
export interface OutcomeDraft {
  readonly kind: string | null;
  readonly amount: string;
  readonly note: string;
}

export type RecordError = 'no-direction' | 'missing-answer' | 'missing-amount' | 'invalid-amount' | 'unexpected-amount' | 'note-too-long';

export type Route =
  | { readonly name: 'welcome' }
  | { readonly name: 'question'; readonly question: QuestionId }
  | { readonly name: 'stop-here' }
  | { readonly name: 'options' }
  | { readonly name: 'next-step' }
  | { readonly name: 'record' }
  | { readonly name: 'progress' };

export interface JourneyState {
  readonly answers: Readonly<Partial<Record<QuestionId, Answer>>>;
  readonly chosenOptionId: string | null;
  readonly outcome: RecordedOutcome | null;
  readonly stoppedSafely: boolean;
  readonly returnRoute: Route;
}

export const initialState: JourneyState = {
  answers: {},
  chosenOptionId: null,
  outcome: null,
  stoppedSafely: false,
  returnRoute: { name: 'welcome' },
};

const welcome: Route = { name: 'welcome' };

export function routeToPath(route: Route): string {
  return route.name === 'question' ? `/about/${route.question}` : `/${route.name}`;
}

/** Every address the prototype answers; the local server serves the page for exactly these. */
export function allRoutePaths(): readonly string[] {
  const names = ['welcome', 'stop-here', 'options', 'next-step', 'record', 'progress'] as const;
  return [...names.map((name) => `/${name}`), ...questionIds.map((id) => `/about/${id}`)];
}

export function parsePath(pathname: string): Route {
  const path = pathname.replace(/^\//, '');
  const about = /^about\/([a-z]+)$/.exec(path);
  if (about) {
    const id = questionIds.find((candidate) => candidate === about[1]);
    return id ? { name: 'question', question: id } : welcome;
  }
  switch (path) {
    case 'stop-here':
    case 'options':
    case 'next-step':
    case 'record':
    case 'progress':
      return { name: path };
    default:
      return welcome;
  }
}

export function questionById(id: QuestionId): Question {
  const found = questions.find((question) => question.id === id);
  if (!found) throw new Error(`Unknown question ${id}`);
  return found;
}

export function isUrgent(state: JourneyState): boolean {
  const timing = state.answers.timing;
  return timing?.kind === 'choice' && timing.value === URGENT_TIMING;
}

function firstUnanswered(state: JourneyState): QuestionId | null {
  return questionIds.find((id) => state.answers[id] === undefined) ?? null;
}

export function chosenOption(state: JourneyState): PracticeOption | null {
  return practiceOptions.find((option) => option.id === state.chosenOptionId) ?? null;
}

/** Sends a requested route to the nearest step whose prerequisites are met. */
export function resolveRoute(state: JourneyState, requested: Route): Route {
  switch (requested.name) {
    case 'welcome':
    case 'progress':
      return requested;
    case 'question': {
      const index = questionIds.indexOf(requested.question);
      const missing = questionIds.slice(0, index).find((id) => state.answers[id] === undefined);
      return missing ? { name: 'question', question: missing } : requested;
    }
    case 'stop-here':
      return isUrgent(state) ? requested : resolveRoute(state, { name: 'options' });
    case 'options': {
      const missing = firstUnanswered(state);
      if (missing) return { name: 'question', question: missing };
      return isUrgent(state) ? { name: 'stop-here' } : requested;
    }
    case 'next-step':
    case 'record':
      return chosenOption(state) ? requested : resolveRoute(state, { name: 'options' });
  }
}

/** Records where "Back to your next step" should return to. The progress view never becomes a return target. */
export function visit(state: JourneyState, route: Route): JourneyState {
  return route.name === 'progress' ? state : { ...state, returnRoute: route };
}

export function returnTarget(state: JourneyState): Route {
  return resolveRoute(state, state.returnRoute);
}

/** Where "Continue where you left off" goes: the furthest step the answers so far allow. */
export function resumeTarget(state: JourneyState): Route {
  const missing = firstUnanswered(state);
  const target: Route = missing
    ? { name: 'question', question: missing }
    : isUrgent(state)
      ? { name: 'stop-here' }
      : chosenOption(state)
        ? { name: 'next-step' }
        : { name: 'options' };
  return resolveRoute(state, target);
}

export type AnswerError = 'missing-answer' | 'unknown-choice';

export function submitAnswer(state: JourneyState, id: QuestionId, answer: Answer | null): Result<{ state: JourneyState; next: Route }, AnswerError> {
  if (answer === null) return { ok: false, error: 'missing-answer' };
  if (answer.kind === 'choice' && !questionById(id).choices.some((choice) => choice.value === answer.value)) {
    return { ok: false, error: 'unknown-choice' };
  }
  const answers = { ...state.answers, [id]: answer };
  const changed = state.answers[id] === undefined || JSON.stringify(state.answers[id]) !== JSON.stringify(answer);
  const next: JourneyState = { ...state, answers, stoppedSafely: false, ...(changed ? { chosenOptionId: null, outcome: null } : {}) };
  const index = questionIds.indexOf(id);
  const following = questionIds[index + 1];
  if (following) return { ok: true, value: { state: next, next: resolveRoute(next, { name: 'question', question: following }) } };
  return { ok: true, value: { state: next, next: resolveRoute(next, { name: 'options' }) } };
}

export function stopSafely(state: JourneyState): JourneyState {
  return { ...state, stoppedSafely: true };
}

function budgetUsd(state: JourneyState): number {
  const money = state.answers.money;
  // "I'm not sure" is treated as no money to risk.
  return money?.kind === 'choice' ? Number(money.value) : 0;
}

/** Up to three options that match the skill (any skill when unsure) and cost no more than the money the person can risk. */
export function shortlist(state: JourneyState): readonly PracticeOption[] {
  const skill = state.answers.skill;
  const budget = budgetUsd(state);
  return practiceOptions
    .filter((option) => (skill?.kind === 'choice' ? option.skill === skill.value : true))
    .filter((option) => option.upfrontCostUsd <= budget)
    .slice(0, 3);
}

/** Plain-language unknowns added by "I'm not sure" answers. */
export function unknowns(state: JourneyState): readonly string[] {
  const notes: Record<QuestionId, string> = {
    skill: 'Which skill to lead with. The options below cover more than one.',
    hours: 'How much time you have. Start with the smallest version of any option.',
    money: 'How much you can risk. Only options with no upfront cost are shown.',
    timing: 'When you need income. Nothing here should be counted on to pay a bill.',
  };
  return questionIds.filter((id) => state.answers[id]?.kind === 'unsure').map((id) => notes[id]);
}

/** A US-dollar amount in the core's money shape: whole cents as a decimal string, scale 2. */
export interface ProfileMoneyDraft {
  readonly minorUnits: string;
  readonly currency: 'USD';
  readonly scale: 2;
  readonly basis: 'assumed';
  readonly includedExpenses: readonly string[];
  readonly excludedExpenses: readonly string[];
}

/**
 * The answer-derived part of the core's business-profile input. Field names match `profileInputSchema`;
 * the rest of that schema is not asked in this prototype. Mapping rules: docs/ux/journey.md, "Mapping answers to the profile".
 */
export interface ProfileDraft {
  readonly skills: readonly string[];
  readonly availableHoursPerWeek: number | null;
  readonly spendingTolerance: ProfileMoneyDraft | null;
  readonly incomeNeed: null;
  readonly incomeDeadline: string | null;
  readonly unknowns: readonly string[];
}

export type ProfileDraftError = 'incomplete' | 'invalid-now' | 'unknown-choice';

/** Hours bands map to their lower bound, so the profile never claims more time than the person gave. */
const hoursLowerBound: Readonly<Record<string, number>> = { 'under-3': 0, '3-to-6': 3, '7-to-12': 7, 'over-12': 12 };
/** Timing bands map to the earliest day in the band; null means no deadline. */
const timingDays: Readonly<Record<string, number | null>> = { [URGENT_TIMING]: 14, '1-to-2-months': 30, 'no-fixed-date': null };
const DAY_MS = 86_400_000;

/** Maps complete answers to the core profile fields. `now` is injected; it anchors the relative timing answer. */
export function toProfileDraft(state: JourneyState, now: Date): Result<ProfileDraft, ProfileDraftError> {
  const { skill, hours, money, timing } = state.answers;
  if (!skill || !hours || !money || !timing) return { ok: false, error: 'incomplete' };
  const nowMs = now.getTime();
  if (!Number.isFinite(nowMs)) return { ok: false, error: 'invalid-now' };

  const hoursValue = hours.kind === 'choice' ? hoursLowerBound[hours.value] : null;
  const days = timing.kind === 'choice' ? timingDays[timing.value] : null;
  const moneyChoice = money.kind === 'choice' ? questionById('money').choices.find((choice) => choice.value === money.value) : null;
  const skillKnown = skill.kind === 'unsure' || questionById('skill').choices.some((choice) => choice.value === skill.value);
  if (hoursValue === undefined || days === undefined || moneyChoice === undefined || !skillKnown) return { ok: false, error: 'unknown-choice' };

  return {
    ok: true,
    value: {
      skills: skill.kind === 'choice' ? [skill.value] : [],
      availableHoursPerWeek: hoursValue,
      spendingTolerance: moneyChoice
        ? { minorUnits: String(Number(moneyChoice.value) * 100), currency: 'USD', scale: 2, basis: 'assumed', includedExpenses: [], excludedExpenses: [] }
        : null,
      incomeNeed: null,
      incomeDeadline: days === null ? null : new Date(nowMs + days * DAY_MS).toISOString(),
      unknowns: unknowns(state),
    },
  };
}

export function chooseOption(state: JourneyState, optionId: string): Result<JourneyState, 'not-on-shortlist'> {
  if (!shortlist(state).some((option) => option.id === optionId)) return { ok: false, error: 'not-on-shortlist' };
  return { ok: true, value: { ...state, chosenOptionId: optionId, outcome: state.chosenOptionId === optionId ? state.outcome : null } };
}

/** True for the kinds that record money: an agreement to pay, or money that actually arrived. */
export function outcomeNeedsAmount(kind: OutcomeKind): boolean {
  return kind === 'paid-commitment' || kind === 'payment-received';
}

/** Parses a US-dollar amount such as "25", "$1,250.50" into whole cents; null when it is not a positive amount within the limit. */
export function parseAmountCents(text: string): number | null {
  const match = /^\$?\s*(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?$/.exec(text.trim());
  if (!match) return null;
  const dollars = (match[1] ?? '').replaceAll(',', '');
  if (dollars.length > 9) return null;
  const cents = Number(dollars) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
  return cents > 0 && cents <= AMOUNT_MAX_CENTS ? cents : null;
}

export function parseOutcome(draft: OutcomeDraft): Result<RecordedOutcome, Exclude<RecordError, 'no-direction'>> {
  const kind = outcomeKinds.find((candidate) => candidate === draft.kind);
  if (!kind) return { ok: false, error: 'missing-answer' };
  const amountText = draft.amount.trim();
  let amountCents: number | null = null;
  if (outcomeNeedsAmount(kind)) {
    if (amountText === '') return { ok: false, error: 'missing-amount' };
    amountCents = parseAmountCents(amountText);
    if (amountCents === null) return { ok: false, error: 'invalid-amount' };
  } else if (amountText !== '') {
    return { ok: false, error: 'unexpected-amount' };
  }
  const note = draft.note.trim();
  if (note.length > NOTE_MAX_LENGTH) return { ok: false, error: 'note-too-long' };
  return { ok: true, value: { kind, amountCents, note: note === '' ? null : note } };
}

export function recordOutcome(state: JourneyState, draft: OutcomeDraft): Result<JourneyState, RecordError> {
  if (!chosenOption(state)) return { ok: false, error: 'no-direction' };
  const parsed = parseOutcome(draft);
  if (!parsed.ok) return parsed;
  return { ok: true, value: { ...state, outcome: parsed.value } };
}

/** Builds a state from a named practice example; unknown names return null. */
export function stateFromExample(name: string): JourneyState | null {
  const entry = Object.entries(practiceExamples).find(([key]) => key === name);
  if (!entry) return null;
  const example: PracticeExample = entry[1];
  let answers: Partial<Record<QuestionId, Answer>> = {};
  for (const id of questionIds) {
    const value = example.answers[id];
    answers = { ...answers, [id]: value === 'unsure' ? { kind: 'unsure' } : { kind: 'choice', value } };
  }
  let outcome: RecordedOutcome | null = null;
  if (example.outcome) {
    const parsed = parseOutcome(example.outcome);
    if (!parsed.ok) throw new Error(`Practice example ${name} has an invalid outcome: ${parsed.error}`);
    outcome = parsed.value;
  }
  return { ...initialState, answers, chosenOptionId: example.chosenOptionId, outcome };
}

export function answerLabel(id: QuestionId, answer: Answer | undefined): string | null {
  if (!answer) return null;
  if (answer.kind === 'unsure') return "I'm not sure";
  return questionById(id).choices.find((choice) => choice.value === answer.value)?.label ?? null;
}

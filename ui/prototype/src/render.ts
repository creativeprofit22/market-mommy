// Builds each screen from plain data. No innerHTML: every string is set as text.
import { icon } from './icons.js';
import type { IconName } from './icons.js';
import { questionIds, questions } from './fixtures.js';
import type { PracticeOption, QuestionId } from './fixtures.js';
import { answerLabel, chosenOption, isUrgent, NOTE_MAX_LENGTH, outcomeKinds, outcomeNeedsAmount, questionById, resumeTarget, returnTarget, routeToPath, shortlist, unknowns } from './journey-model.js';
import type { JourneyState, OutcomeDraft, OutcomeKind, RecordedOutcome, RecordError, Route } from './journey-model.js';

export type Checking = 'running' | 'held' | 'stopped' | null;

export interface View {
  readonly journey: JourneyState;
  readonly route: Route;
  readonly invalid: boolean;
  readonly notice: 'saved' | 'save-failed' | null;
  readonly checking: Checking;
  readonly evidenceOpen: boolean;
  /** Record-form input that failed validation or saving; shown again exactly as entered. */
  readonly pendingOutcome: OutcomeDraft | null;
  /** Why the last record-form submission was rejected. */
  readonly recordError: RecordError | null;
}

export interface Handlers {
  readonly answer: (question: QuestionId, value: string | null) => void;
  readonly choose: (optionId: string) => void;
  readonly stopChecking: () => void;
  readonly stopSafely: () => void;
  readonly record: (draft: OutcomeDraft) => void;
}

export interface Screen {
  readonly title: string;
  readonly body: readonly (Node | null)[];
}

type Child = Node | string | null | false;
type Attrs = Readonly<Record<string, string | boolean>>;

function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, ...children: readonly Child[]): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) {
    if (value === false) continue;
    node.setAttribute(name, value === true ? '' : value);
  }
  for (const child of children) if (child !== null && child !== false) node.append(child);
  return node;
}

const outcomeLabels: Record<OutcomeKind, string> = {
  'paid-commitment': 'They agreed to buy',
  'payment-received': 'Money arrived',
  conversation: 'No reply yet',
  objection: 'They said no',
};

const recordErrorMessages: Record<RecordError, string> = {
  'no-direction': 'Please choose a direction first.',
  'missing-answer': 'Please choose what happened.',
  'missing-amount': 'Please enter the amount in dollars.',
  'invalid-amount': 'Please enter an amount above $0, like 25 or 25.50.',
  'unexpected-amount': 'Only add an amount if they agreed to buy or money arrived.',
  'note-too-long': `Please keep your note under ${NOTE_MAX_LENGTH.toLocaleString('en-US')} characters.`,
};

export function recordErrorMessage(error: RecordError): string {
  return recordErrorMessages[error];
}

/** The control that should receive focus for a record-form error. */
export function recordErrorTarget(error: RecordError): string {
  if (error === 'missing-amount' || error === 'invalid-amount' || error === 'unexpected-amount') return '#record-amount';
  if (error === 'note-too-long') return '#record-note';
  return 'input[name="outcome"]';
}

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

function outcomeSummary(outcome: RecordedOutcome | null): readonly Node[] {
  if (!outcome) return [h('p', {}, 'Nothing recorded yet.')];
  const amount = outcome.amountCents === null ? '' : `: ${usd.format(outcome.amountCents / 100)}`;
  return [h('p', {}, `${outcomeLabels[outcome.kind]}${amount}`), ...(outcome.note ? [h('p', { class: 'hint' }, outcome.note)] : [])];
}

function draftFrom(outcome: RecordedOutcome | null): OutcomeDraft | null {
  if (!outcome) return null;
  return { kind: outcome.kind, amount: outcome.amountCents === null ? '' : (outcome.amountCents / 100).toFixed(2), note: outcome.note ?? '' };
}

const shortQuestion: Record<QuestionId, string> = {
  skill: 'What you could offer',
  hours: 'Hours a week',
  money: 'Money you could risk',
  timing: 'When you need income',
};

const dateFormat = new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
function formatDate(iso: string): string {
  return dateFormat.format(new Date(`${iso}T00:00:00Z`));
}

function heading(text: string): HTMLHeadingElement {
  return h('h1', { tabindex: '-1', class: 'screen-title' }, text);
}

function linkButton(href: string, text: string, variant: 'primary' | 'quiet', iconName?: IconName, iconFirst = false): HTMLAnchorElement {
  const glyph = iconName ? icon(iconName) : null;
  return h('a', { href, class: `button ${variant}` }, iconFirst ? glyph : null, h('span', {}, text), iconFirst ? null : glyph);
}

function backLink(href: string, text: string): HTMLAnchorElement {
  return h('a', { href, class: 'back-link' }, icon('arrow-left'), h('span', {}, text));
}

function statusNotice(kind: 'info' | 'attention', title: string, ...rest: readonly Child[]): HTMLElement {
  return h('div', { class: `notice notice-${kind}`, role: kind === 'attention' ? 'alert' : 'status' }, kind === 'attention' ? icon('alert') : icon('check'), h('div', { class: 'notice-body' }, h('p', { class: 'notice-title' }, title), ...rest));
}

function welcome(view: View): Screen {
  const started = Object.keys(view.journey.answers).length > 0;
  return {
    title: 'Welcome',
    body: [
      heading("Let's find a small, realistic next step using skills you already have."),
      h('p', { class: 'lede' }, "You'll answer four short questions. \u201CI'm not sure\u201D is always a fine answer."),
      h('p', {}, 'Nothing you enter leaves this page. It is forgotten when you close or reload it.'),
      h('div', { class: 'actions actions-end' }, linkButton(started ? routeToPath(resumeTarget(view.journey)) : '/about/skill', started ? 'Continue where you left off' : 'Start', 'primary', 'arrow-right')),
    ],
  };
}

function choiceRow(name: string, value: string, label: string, checked: boolean, extraClass = ''): HTMLLabelElement {
  const input = h('input', { type: 'radio', name, value, checked });
  return h('label', { class: `choice ${extraClass}`.trim() }, input, h('span', { class: 'choice-text' }, label), icon('check'));
}

function question(view: View, id: QuestionId, handlers: Handlers): Screen {
  const q = questionById(id);
  const index = questionIds.indexOf(id);
  const current = view.journey.answers[id];
  const describedBy = [q.hint ? 'question-hint' : '', view.invalid ? 'question-error' : ''].filter(Boolean).join(' ');
  const fieldset = h(
    'fieldset',
    { role: 'radiogroup', class: 'question', ...(describedBy ? { 'aria-describedby': describedBy } : {}), ...(view.invalid ? { 'aria-invalid': 'true' } : {}) },
    h('legend', {}, heading(q.legend)),
    q.hint ? h('p', { id: 'question-hint', class: 'hint' }, q.hint) : null,
    view.invalid ? h('p', { id: 'question-error', class: 'field-error' }, icon('alert'), h('span', {}, "Please choose an answer, or pick \u201CI'm not sure\u201D.")) : null,
    h('div', { class: 'choices' }, ...q.choices.map((choice) => choiceRow('answer', choice.value, choice.label, current?.kind === 'choice' && current.value === choice.value))),
    h('div', { class: 'choices choices-unsure' }, choiceRow('answer', 'unsure', "I'm not sure", current?.kind === 'unsure', 'choice-unsure')),
  );
  const previous = index === 0 ? '/welcome' : routeToPath({ name: 'question', question: questionIds[index - 1] ?? 'skill' });
  const form = h(
    'form',
    { class: 'step-form', novalidate: true },
    fieldset,
    h('div', { class: 'actions' }, backLink(previous, 'Back'), h('button', { type: 'submit', class: 'button primary' }, h('span', {}, 'Continue'), icon('arrow-right'))),
  );
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const selected = form.querySelector<HTMLInputElement>('input[name="answer"]:checked');
    handlers.answer(id, selected ? selected.value : null);
  });
  return { title: `Question ${index + 1} of ${questionIds.length}`, body: [h('p', { class: 'step-count' }, `Question ${index + 1} of ${questionIds.length}`), form] };
}

function stopHere(view: View, handlers: Handlers): Screen {
  const saved = view.journey.stoppedSafely;
  const save = h('button', { type: 'button', class: 'button primary' }, h('span', {}, 'Save and stop here'));
  save.addEventListener('click', handlers.stopSafely);
  return {
    title: 'Stopping here is fine',
    body: [
      heading('This cannot reliably cover an urgent bill.'),
      h('p', { class: 'lede' }, 'You can stop here without spending on research.'),
      h('p', {}, 'Testing an offer usually takes longer than two weeks to bring in money. Nothing here asks you to borrow, buy anything or pay for research.'),
      saved ? statusNotice('info', 'Your answers are kept for this visit.', h('p', {}, 'You can review them in Your progress.')) : null,
      h('div', { class: 'actions' }, backLink('/about/timing', 'Change my answer'), saved ? null : save),
    ],
  };
}

function detailRow(term: string, value: string): readonly HTMLElement[] {
  return [h('dt', {}, term), h('dd', {}, value)];
}

function optionEntry(option: PracticeOption, chosen: boolean, handlers: Handlers): HTMLElement {
  const choose = h('button', { type: 'button', class: 'button primary' }, h('span', {}, chosen ? 'Continue with this direction' : 'Choose this direction'), icon('arrow-right'));
  choose.addEventListener('click', () => { handlers.choose(option.id); });
  const titleId = `option-${option.id}`;
  return h(
    'article',
    { class: chosen ? 'option option-chosen' : 'option', 'aria-labelledby': titleId },
    h('h2', { id: titleId, class: 'option-title' }, option.name),
    chosen ? h('p', { class: 'chosen-mark' }, icon('check'), h('span', {}, 'Your chosen direction')) : null,
    h('dl', { class: 'facts' }, ...detailRow('Who would pay', option.buyer), ...detailRow("What you'd deliver", option.deliverable), ...detailRow('Why it fits you', option.fit), ...detailRow('Effort and cost', option.effort), ...detailRow('Biggest unknown', option.biggestUnknown)),
    h('details', { class: 'disclosure' }, h('summary', {}, h('span', {}, 'Why this option?')), h('p', {}, option.whyThisOption)),
    h('div', { class: 'actions actions-end' }, choose),
  );
}

function options(view: View, handlers: Handlers): Screen {
  const list = shortlist(view.journey);
  const notes = unknowns(view.journey);
  const title = list.length === 0 ? 'No direction fits yet' : list.length === 1 ? 'One direction to consider' : `${list.length === 2 ? 'Two' : 'Three'} directions to consider`;
  return {
    title,
    body: [
      heading(title),
      list.length === 0
        ? h('p', { class: 'lede' }, "We don't have enough evidence to recommend a direction for these answers yet. Changing how much you could risk may show more.")
        : h('p', { class: 'lede' }, 'Each one is small enough to try once. Pick the one you would most like to test.'),
      notes.length > 0 ? h('section', { class: 'unknowns', 'aria-labelledby': 'unknowns-title' }, h('h2', { id: 'unknowns-title' }, icon('question'), h('span', {}, "What we're not sure about yet")), h('ul', {}, ...notes.map((note) => h('li', {}, note)))) : null,
      ...list.map((option) => optionEntry(option, option.id === view.journey.chosenOptionId, handlers)),
      h('div', { class: 'actions' }, backLink('/about/skill', "This doesn't fit my situation")),
    ],
  };
}

function evidence(option: PracticeOption, open: boolean): HTMLDetailsElement {
  return h(
    'details',
    { class: 'disclosure evidence', open },
    h('summary', {}, icon('book'), h('span', {}, 'Show me the evidence')),
    h(
      'div',
      { class: 'evidence-body' },
      ...option.evidence.map((item) =>
        h(
          'section',
          { class: 'source' },
          h('h3', {}, item.source),
          h('blockquote', {}, item.excerpt),
          h('dl', { class: 'facts' }, ...detailRow('Published', item.publishedOn ? formatDate(item.publishedOn) : 'Publication date unknown'), ...detailRow('Collected', formatDate(item.collectedOn)), ...detailRow('What the source says', item.observation), ...detailRow('What we think it means', item.interpretation)),
        ),
      ),
      h('h3', {}, 'What could go against this'),
      h('ul', {}, ...option.counterevidence.map((text) => h('li', {}, text))),
      h('h3', {}, "What we're assuming"),
      h('ul', {}, ...option.assumptions.map((text) => h('li', {}, text))),
    ),
  );
}

function nextStep(view: View, handlers: Handlers): Screen {
  const option = chosenOption(view.journey);
  if (!option) return welcome(view);
  if (view.checking === 'running' || view.checking === 'held') {
    const stop = h('button', { type: 'button', class: 'button quiet' }, icon('pause'), h('span', {}, 'Stop checking'));
    stop.addEventListener('click', handlers.stopChecking);
    return {
      title: 'Checking sources',
      body: [
        heading('Your next step'),
        h('div', { class: 'notice notice-info checking', role: 'status' }, h('span', { class: 'pulse', 'aria-hidden': 'true' }), h('div', { class: 'notice-body' }, h('p', { class: 'notice-title' }, 'Checking the sources you approved.'), h('p', {}, `Looking at: ${option.evidence.length} practice ${option.evidence.length === 1 ? 'source' : 'sources'}.`))),
        h('div', { class: 'actions' }, stop),
      ],
    };
  }
  const thin = option.evidenceStatus === 'insufficient';
  const outcome = view.journey.outcome;
  return {
    title: 'Your next step',
    body: [
      heading('Your next step'),
      view.checking === 'stopped' ? statusNotice('info', 'Checks stopped. Here is what was saved.') : null,
      view.notice === 'saved' ? statusNotice('info', 'Your result is saved.') : null,
      h(
        'article',
        { class: thin ? 'next-step next-step-thin' : 'next-step', 'aria-labelledby': 'next-step-direction' },
        h('p', { id: 'next-step-direction', class: 'direction' }, option.name),
        thin ? h('p', { class: 'thin-warning' }, icon('alert'), h('span', {}, "We don't have enough evidence to recommend this yet.")) : null,
        h('p', { class: 'next-action' }, option.nextStep),
        h('h2', {}, 'Why this fits'),
        h('p', {}, option.whyThisOption),
        h('h2', {}, 'What happened'),
        ...outcomeSummary(outcome),
        evidence(option, view.evidenceOpen),
      ),
      h('div', { class: 'actions' }, backLink('/options', thin ? 'Stop here or see other options' : 'See other options'), linkButton('/record', 'Record what happened', 'primary', 'arrow-right')),
    ],
  };
}

/** Labeled text field with a hint and, after a rejected save, a linked error. */
function textField(id: string, label: string, hint: string, error: string | null, control: HTMLInputElement | HTMLTextAreaElement, prefix?: string): HTMLDivElement {
  control.id = id;
  control.setAttribute('aria-describedby', [`${id}-hint`, error ? `${id}-error` : ''].filter(Boolean).join(' '));
  if (error) control.setAttribute('aria-invalid', 'true');
  return h(
    'div',
    { class: error ? 'field field-invalid' : 'field' },
    h('label', { for: id, class: 'field-label' }, label),
    h('p', { id: `${id}-hint`, class: 'hint' }, hint),
    error ? h('p', { id: `${id}-error`, class: 'field-error' }, icon('alert'), h('span', {}, error)) : null,
    prefix ? h('div', { class: 'input-affix' }, h('span', { class: 'input-prefix', 'aria-hidden': 'true' }, prefix), control) : control,
  );
}

function record(view: View, handlers: Handlers): Screen {
  const draft = view.pendingOutcome ?? draftFrom(view.journey.outcome);
  const error = view.recordError ?? (view.invalid ? 'missing-answer' : null);
  const choiceError = error === 'missing-answer' || error === 'no-direction' ? recordErrorMessage(error) : null;
  const amountError = error === 'missing-amount' || error === 'invalid-amount' || error === 'unexpected-amount' ? recordErrorMessage(error) : null;
  const noteError = error === 'note-too-long' ? recordErrorMessage(error) : null;
  const selectedKind = outcomeKinds.find((kind) => kind === draft?.kind) ?? null;
  const describedBy = ['record-hint', choiceError ? 'record-error' : ''].filter(Boolean).join(' ');

  const amountInput = h('input', { type: 'text', inputmode: 'decimal', autocomplete: 'off', name: 'amount', class: 'text-input', value: draft?.amount ?? '' });
  const amountField = textField('record-amount', 'Amount in US dollars', 'Only what they agreed to pay, or what actually arrived. Don\u2019t guess.', amountError, amountInput, '$');
  amountField.hidden = !(selectedKind && outcomeNeedsAmount(selectedKind));
  const noteInput = h('textarea', { name: 'note', rows: '3', maxlength: String(NOTE_MAX_LENGTH), class: 'text-input' });
  noteInput.value = draft?.note ?? '';
  const noteField = textField('record-note', 'Add a short note (optional)', 'For example, who you spoke to or what they said.', noteError, noteInput);

  const form = h(
    'form',
    { class: 'step-form', novalidate: true },
    view.notice === 'save-failed' ? statusNotice('attention', "We couldn't save that change.", h('p', {}, 'Your answer is still filled in. Please try again.')) : null,
    h(
      'fieldset',
      { role: 'radiogroup', class: 'question', 'aria-describedby': describedBy, ...(choiceError ? { 'aria-invalid': 'true' } : {}) },
      h('legend', {}, heading('What happened when you tried it?')),
      h('p', { id: 'record-hint', class: 'hint' }, 'Agreeing to buy and paying are recorded separately. Only choose \u201CMoney arrived\u201D once it has.'),
      choiceError ? h('p', { id: 'record-error', class: 'field-error' }, icon('alert'), h('span', {}, choiceError)) : null,
      h('div', { class: 'choices' }, ...outcomeKinds.map((kind) => choiceRow('outcome', kind, outcomeLabels[kind], selectedKind === kind))),
    ),
    amountField,
    noteField,
    h('div', { class: 'actions' }, backLink('/next-step', 'Back to your next step'), h('button', { type: 'submit', class: 'button primary' }, h('span', {}, view.notice === 'save-failed' ? 'Try again' : 'Save'))),
  );
  const selected = (): string | null => form.querySelector<HTMLInputElement>('input[name="outcome"]:checked')?.value ?? null;
  form.addEventListener('change', () => {
    const kind = outcomeKinds.find((candidate) => candidate === selected());
    amountField.hidden = !(kind && outcomeNeedsAmount(kind));
  });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    handlers.record({ kind: selected(), amount: amountField.hidden ? '' : amountInput.value, note: noteInput.value });
  });
  return { title: 'Record what happened', body: [form] };
}

function progress(view: View): Screen {
  const state = view.journey;
  const answered = questionIds.filter((id) => state.answers[id] !== undefined);
  const option = chosenOption(state);
  const back = returnTarget(state);
  if (answered.length === 0) {
    return {
      title: 'Your progress',
      body: [heading('Your progress'), h('p', { class: 'lede' }, 'Nothing saved yet. Your answers will appear here as you go.'), h('div', { class: 'actions actions-end' }, linkButton('/welcome', 'Start', 'primary', 'arrow-right'))],
    };
  }
  const rows = questions.filter((q) => state.answers[q.id] !== undefined).map((q) =>
    h('li', { class: 'progress-row' }, h('span', { class: 'progress-term' }, shortQuestion[q.id]), h('span', { class: 'progress-value' }, answerLabel(q.id, state.answers[q.id]) ?? ''), h('a', { href: routeToPath({ name: 'question', question: q.id }), class: 'change-link', 'aria-label': `Change ${shortQuestion[q.id].toLowerCase()}` }, 'Change')),
  );
  return {
    title: 'Your progress',
    body: [
      heading('Your progress'),
      h('p', { class: 'hint' }, 'This practice version keeps answers only while this tab is open.'),
      h('section', { 'aria-labelledby': 'answers-title' }, h('h2', { id: 'answers-title' }, 'Your answers'), h('ol', { class: 'progress-list' }, ...rows)),
      h('section', { 'aria-labelledby': 'direction-title' }, h('h2', { id: 'direction-title' }, 'Chosen direction'), h('p', {}, option ? option.name : isUrgent(state) ? 'None. You chose to stop here for now.' : 'Not chosen yet.')),
      h('section', { 'aria-labelledby': 'result-title' }, h('h2', { id: 'result-title' }, 'What happened'), ...outcomeSummary(state.outcome)),
      h('div', { class: 'actions actions-end' }, linkButton(routeToPath(back), 'Back to your next step', 'primary', 'arrow-right')),
    ],
  };
}

export function renderScreen(view: View, handlers: Handlers): Screen {
  switch (view.route.name) {
    case 'welcome':
      return welcome(view);
    case 'question':
      return question(view, view.route.question, handlers);
    case 'stop-here':
      return stopHere(view, handlers);
    case 'options':
      return options(view, handlers);
    case 'next-step':
      return nextStep(view, handlers);
    case 'record':
      return record(view, handlers);
    case 'progress':
      return progress(view);
  }
}

export function practiceMenu(): HTMLElement {
  const links: readonly (readonly [string, string])[] = [
    ['/next-step?example=chosen&show=checking', 'Checking sources'],
    ['/next-step?example=thin', 'Not enough evidence'],
    ['/record?example=chosen&show=save-failed', 'Saving fails'],
    ['/stop-here?example=urgent', 'Income needed within 2 weeks'],
    ['/options?example=unsure', "Every answer \u201CI'm not sure\u201D"],
  ];
  return h(
    'details',
    { class: 'disclosure practice-menu' },
    h('summary', {}, h('span', {}, 'Practice screens')),
    h('p', { class: 'hint' }, 'Opening one starts a new practice run with made-up answers.'),
    h('ul', {}, ...links.map(([href, text]) => h('li', {}, h('a', { href }, text)))),
  );
}

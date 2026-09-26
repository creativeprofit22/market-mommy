// Wires the pure journey model to the page. All state lives in memory for this tab only.
import { allRoutePaths, chooseOption, initialState, parsePath, recordOutcome, resolveRoute, routeToPath, stateFromExample, stopSafely, submitAnswer, visit } from './journey-model.js';
import type { JourneyState, OutcomeDraft, RecordError, Route } from './journey-model.js';
import { practiceMenu, recordErrorMessage, recordErrorTarget, renderScreen } from './render.js';
import type { Checking, View } from './render.js';

const CHECKING_MS = 1200;
const showValues = ['checking', 'save-failed', 'error', 'evidence'] as const;
type Show = (typeof showValues)[number];

interface Ui {
  journey: JourneyState;
  invalid: boolean;
  notice: View['notice'];
  checking: Checking;
  evidenceOpen: boolean;
  pendingOutcome: OutcomeDraft | null;
  recordError: RecordError | null;
  failNextSave: boolean;
  checkingTimer: number | null;
}

function required<T extends Element>(selector: string): T {
  const found = document.querySelector<T>(selector);
  if (!found) throw new Error(`Missing page element ${selector}`);
  return found;
}

function readPractice(search: string): { journey: JourneyState; show: Show | null } {
  const params = new URLSearchParams(search);
  const example = params.get('example');
  const requested = params.get('show');
  const show = showValues.find((value) => value === requested) ?? null;
  return { journey: (example ? stateFromExample(example) : null) ?? initialState, show };
}

function start(): void {
  const main = required<HTMLElement>('#main');
  const footer = required<HTMLElement>('#practice');
  const announcer = required<HTMLElement>('#announcer');
  const progressLink = required<HTMLAnchorElement>('#progress-link');
  const skipLink = required<HTMLAnchorElement>('#skip-link');

  const practice = readPractice(window.location.search);
  const ui: Ui = {
    journey: practice.journey,
    invalid: practice.show === 'error',
    notice: null,
    checking: practice.show === 'checking' ? 'held' : null,
    evidenceOpen: practice.show === 'evidence',
    pendingOutcome: null,
    recordError: null,
    failNextSave: practice.show === 'save-failed',
    checkingTimer: null,
  };
  let current: Route = parsePath(window.location.pathname);
  const appPaths = new Set(allRoutePaths());
  let firstRender = true;

  function announce(message: string): void {
    announcer.textContent = '';
    window.setTimeout(() => { announcer.textContent = message; }, 50);
  }

  function clearTimer(): void {
    if (ui.checkingTimer !== null) window.clearTimeout(ui.checkingTimer);
    ui.checkingTimer = null;
  }

  function go(route: Route): void {
    const path = routeToPath(route);
    if (window.location.pathname !== path) window.history.pushState(null, '', path);
    navigate();
  }

  function paint(moveFocus: boolean): void {
    const screen = renderScreen({ journey: ui.journey, route: current, invalid: ui.invalid, notice: ui.notice, checking: ui.checking, evidenceOpen: ui.evidenceOpen, pendingOutcome: ui.pendingOutcome, recordError: ui.recordError }, handlers);
    main.replaceChildren(...screen.body.filter((node): node is Node => node !== null));
    document.title = `${screen.title} | Market Mommy practice`;
    if (current.name === 'progress') progressLink.setAttribute('aria-current', 'page');
    else progressLink.removeAttribute('aria-current');
    if (ui.recordError) {
      main.querySelector<HTMLElement>(recordErrorTarget(ui.recordError))?.focus();
    } else if (ui.invalid) {
      main.querySelector<HTMLInputElement>('input[type="radio"]')?.focus();
    } else if (moveFocus) {
      main.querySelector<HTMLElement>('h1')?.focus();
    }
  }

  function navigate(): void {
    const requested = parsePath(window.location.pathname);
    const resolved = resolveRoute(ui.journey, requested);
    if (routeToPath(resolved) !== window.location.pathname) {
      window.history.replaceState(null, '', `${routeToPath(resolved)}${window.location.search}`);
    }
    current = resolved;
    ui.journey = visit(ui.journey, resolved);
    if (!firstRender) {
      ui.invalid = false;
      if (!(ui.notice === 'saved' && resolved.name === 'next-step')) ui.notice = null;
      ui.pendingOutcome = null;
      ui.recordError = null;
    }
    if (resolved.name !== 'next-step' && ui.checking === 'stopped') ui.checking = null;
    paint(!firstRender);
    firstRender = false;
  }

  const handlers = {
    answer(question: Parameters<typeof submitAnswer>[1], value: string | null): void {
      const result = submitAnswer(ui.journey, question, value === null ? null : value === 'unsure' ? { kind: 'unsure' } : { kind: 'choice', value });
      if (!result.ok) {
        ui.invalid = true;
        paint(false);
        announce("Please choose an answer, or pick \u201CI'm not sure\u201D.");
        return;
      }
      ui.journey = result.value.state;
      ui.invalid = false;
      go(result.value.next);
    },
    choose(optionId: string): void {
      const result = chooseOption(ui.journey, optionId);
      if (!result.ok) return;
      const same = ui.journey.chosenOptionId === optionId;
      ui.journey = result.value;
      clearTimer();
      if (!same) {
        ui.checking = 'running';
        ui.checkingTimer = window.setTimeout(() => {
          ui.checkingTimer = null;
          ui.checking = null;
          if (current.name === 'next-step') {
            paint(false);
            announce('Checks finished. Your next step is ready.');
          }
        }, CHECKING_MS);
      }
      go({ name: 'next-step' });
      if (!same) announce('Checking the sources you approved.');
    },
    stopChecking(): void {
      clearTimer();
      ui.checking = 'stopped';
      paint(true);
      announce('Checks stopped. Here is what was saved.');
    },
    stopSafely(): void {
      ui.journey = stopSafely(ui.journey);
      paint(true);
      announce('Your answers are kept for this visit.');
    },
    record(draft: OutcomeDraft): void {
      const result = recordOutcome(ui.journey, draft);
      if (!result.ok) {
        ui.invalid = false;
        ui.recordError = result.error;
        ui.notice = null;
        ui.pendingOutcome = draft;
        paint(false);
        announce(recordErrorMessage(result.error));
        return;
      }
      ui.recordError = null;
      if (ui.failNextSave) {
        ui.failNextSave = false;
        ui.invalid = false;
        ui.notice = 'save-failed';
        ui.pendingOutcome = draft;
        paint(false);
        main.querySelector<HTMLInputElement>('input[type="radio"]:checked')?.focus();
        return;
      }
      ui.journey = result.value;
      ui.invalid = false;
      ui.pendingOutcome = null;
      ui.notice = 'saved';
      go({ name: 'next-step' });
      announce('Your result is saved.');
    },
  };

  skipLink.addEventListener('click', (event) => {
    event.preventDefault();
    (main.querySelector<HTMLElement>('h1') ?? main).focus();
  });
  footer.replaceChildren(practiceMenu());
  // In-app links move between screens without reloading, so answers kept in memory survive.
  document.addEventListener('click', (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const target = event.target instanceof Element ? event.target.closest('a') : null;
    if (!target || target.target || target.hasAttribute('download')) return;
    const url = new URL(target.href);
    if (url.origin !== window.location.origin || url.search !== '' || url.hash !== '' || !appPaths.has(url.pathname)) return;
    event.preventDefault();
    go(parsePath(url.pathname));
  });
  window.addEventListener('popstate', navigate);
  navigate();
}

start();

# Journey and screens

Owner: [DESIGN.md](../../DESIGN.md). This covers the prototype slice of the [bounded journey](../product.md#complete-bounded-journey). It is not the whole product. All content is **labeled practice data**: made-up people, options and sources, stored only in memory in the browser tab.

## Shape

The main path is a guided wizard with one question per screen. The progress view is secondary: it is reachable from the header on every screen and it never replaces the next step.

| # | Screen (address) | Purpose | Primary action | Secondary |
|---|---|---|---|---|
| 1 | Welcome (`/welcome`) | Set expectations: "Let's find a small, realistic next step using skills you already have." | Start | Your progress |
| 2 | Skill (`/about/skill`) | "What could you do for someone this month?" (choices + I'm not sure) | Continue | Back |
| 3 | Hours (`/about/hours`) | "How many hours a week can you spend on this?" | Continue | Back |
| 4 | Money (`/about/money`) | "How much money could you spend on this and be fine if you lost it?" | Continue | Back |
| 5 | Income timing (`/about/timing`) | "When do you need income from this?" Explains that a test may not pay in time. | Continue | Back |
| 5a | Safe exit (`/stop-here`) | Shown when income is needed within two weeks: "This cannot reliably cover an urgent bill. You can stop here without spending on research." | Save and stop here | Change my answer |
| 6 | Shortlist (`/options`) | Up to three directions: buyer, deliverable, fit, effort and cost, biggest unknown; "Why this option?" | Choose this direction | This doesn't fit my situation |
| 7 | Next step (`/next-step`) | **Your next step**, **Why this fits**, **What happened**; "Show me the evidence" | Record what happened | Other options |
| 8 | What happened (`/record`) | Separate "They agreed to buy" from "Money arrived", "No reply yet" and "They said no"; an amount in US dollars for the first two; an optional short note | Save | Back to your next step |
| P | Your progress (`/progress`) | Saved answers with Change links, the chosen direction and recorded results | Back to your next step | n/a |

## Rules

- **"I'm not sure" never blocks.** It is saved as an answer. It adds an item to the biggest-unknown list and keeps the shortlist honest; for example, an unsure money answer means only options with no upfront cost are shown.
- **Safe exit.** Needing income within two weeks leads to the safe-exit screen before any options are shown. That screen offers no debt, paid research or pressure. Answers are kept, and "Change my answer" returns to the timing question.
- **Return.** The progress view remembers the address of the step you came from. "Back to your next step" goes back to that exact step, with the in-memory answers intact. The browser Back and Forward buttons move between addresses without losing answers. Reloading the page starts over, and the prototype says so on the progress view, because nothing is saved to disk.
- **Validation.** Continuing without choosing anything shows an announced, linked error: "Please choose an answer, or pick 'I'm not sure'." It is never shown before an attempt.
- **Evidence.** The recommendation shows the action and a short reason first. The evidence disclosure separates **What the source says** (observation) from **What we think it means** (interpretation), shows dates, including "Publication date unknown", and lists counterevidence and assumptions.
- **Recording a result.** See [the mapping below](#recording-a-result). The amount field appears only for "They agreed to buy" and "Money arrived". Leaving it empty, entering zero or less, or entering something that isn't a dollar amount shows an announced error linked to that field, and focus moves to it. The selected answer, amount and note stay filled in after an error or a failed save.
- **Practice screens.** A small "Practice screens" menu in the footer can preview the checking, not-enough-evidence, save-failed, income-needed-within-2-weeks and every-answer-"I'm not sure" screens. Opening one starts a new practice run with made-up answers. It is labeled and never covers content.

## Fixture labeling

Every practice screen shows the banner "Practice example: made-up information, not advice." The names of people and sources in fixtures are clearly invented (for example, "Neighborhood forum post (made-up)"). No testimonial, earnings figure, logo or real business name is used.

## Mapping answers to the profile

The four setup answers are banded choices, while the core business profile (`profileInputSchema`, `src/domain/profile.ts`) wants single values. This table is the written conversion so integration does not invent one. The pure function `toProfileDraft(state, now)` in `ui/prototype/src/journey-model.ts` implements it without importing the core; unit tests check every result parses as a core profile input. Each band maps to its cautious end: the fewest hours and the earliest deadline, so the profile never claims more time than the person gave.

| Question | Answer value | Core field | Core value |
|---|---|---|---|
| skill | `writing`, `bookkeeping`, `tutoring`, `cleaning` | `skills` | `[value]` |
| hours | `under-3` / `3-to-6` / `7-to-12` / `over-12` | `availableHoursPerWeek` | `0` / `3` / `7` / `12` (lower bound) |
| money | `0` / `50` / `200` | `spendingTolerance` | `Money`: `minorUnits` `'0'` / `'5000'` / `'20000'`, `currency: 'USD'`, `scale: 2`, `basis: 'assumed'`, empty expense lists |
| timing | `within-2-weeks` / `1-to-2-months` / `no-fixed-date` | `incomeDeadline` | `now` + 14 days / `now` + 30 days / `null` |
| any | `unsure` ("I'm not sure") | the question's field | `null` (`skills: []`), plus one plain-language `unknowns` entry per question |
| not asked | none | `incomeNeed` | always `null` |

- **Clock.** `now` is injected, never read inside the mapping. `incomeDeadline` is `now` plus whole 24-hour days, written as an ISO UTC timestamp (`timeSchema`). The integration must pass the time the person answered, not the time the profile is saved, or a deadline slides forward.
- **Money basis.** A spending limit is the person's planning ceiling, not a recorded payment, so it uses `basis: 'assumed'` (recorded outcomes use `observed`; see [below](#recording-a-result)). Expense lists stay empty because the question does not ask about them.
- **Unknowns.** Entries are the same notes the options screen shows for "I'm not sure"; each fits the core's 200-character limit.
- **Not mapped here.** `stage`, `deliverability`, `reachableBuyers`, `geography` (`'US'` by audience scope), `preferences` and `qualifications` are not asked in this prototype and come from other steps.
- **Incomplete or unknown answers.** The mapping returns an error rather than a partial profile when an answer is missing, a value is not one of the listed choices, or `now` is not a valid time.

The product owner must confirm before integration:

1. Lower bounds for hours, including `under-3` becoming `0` rather than a small positive number.
2. `1-to-2-months` becoming 30 days (earliest in the band) rather than the 60-day upper end. [Product](../product.md#audience-and-income-needs) asks for the person's actual deadline, so a derived one may need an explicit date question instead.
3. `basis: 'assumed'` for spending tolerance.
4. Leaving `incomeNeed` null. Product asks for a desired take-home amount; the prototype has no question for it yet.

## Recording a result

The record screen (`/record`) is the design reference for saving an outcome through the application core. The prototype does not import the core (see the "Prototype only" row in the [decision ledger](../decisions.md)), but it uses the core's outcome kind names so each saved result maps directly to one `outcomeEventSchema` event (`src/domain/experiment.ts`). Unit tests check that every result the screen can save forms a valid `outcomeInputSchema` payload.

| On screen | Core `kind` | Amount | Core fields |
|---|---|---|---|
| They agreed to buy | `paid-commitment` | Required, above $0 | `description`, `money` with basis `observed` |
| Money arrived | `payment-received` | Required, above $0 | `description`, `money` with basis `observed` |
| No reply yet | `conversation` | Not allowed | `description` |
| They said no | `objection` | Not allowed | `description` |

- **Amount.** The amount is entered in US dollars with up to two decimals and stored as whole cents, which becomes `money.minorUnits` (`currency: 'USD'`, `scale: 2`, `basis: 'observed'`, no expense lists). The screen never fills in or estimates an amount. Agreeing to buy and money arriving stay separate kinds, as [product](../product.md) and [UX copy](../ux-copy.md) require.
- **Note.** The optional note (up to 2,000 characters, the core's `textSchema` limit) becomes `description`. If it is left blank, the integration uses the on-screen label instead.
- **Set at integration.** `experimentId`, `occurredAt` (null unless a date is asked for), `provenance: 'synthetic-self-report'` and `supersedes` come from the journey and are not asked on this screen.
- **Not on this screen yet.** The core's `offer`, `repeat-purchase`, `refund`, `expense` and `delivery-hours` kinds have no prototype control.

# Design reference

Status: accepted for the labeled-fixture prototype in `ui/prototype/` (2026-09-26). This is the visual and interaction contract for the guided UI. Product scope stays with [product](docs/product.md), and copy and state meaning stay with [UX copy](docs/ux-copy.md). The production UI library is still an open decision; see the [decision ledger](docs/decisions.md). Rendered evidence is recorded in [UI verification](docs/ui-verification.md).

Linked details:

- [Journey and screens](docs/ux/journey.md): the order of steps, what each screen asks, and how return works.
- [Tokens and primitives](docs/ux/tokens-and-primitives.md): color, type, space, shape, motion, icons and components.
- [States and accessibility](docs/ux/states-and-accessibility.md): recovery states, their copy, and the accessibility requirements with how each is checked.

## Design read

| Question | Answer |
|---|---|
| Surface | Application UI in a guided-wizard form. Reading passages borrow from editorial layout. |
| Audience | US adults with an existing skill, a small amount of money they can afford to lose, and a 30 to 60 day planning horizon ([product](docs/product.md#audience-and-income-needs)). They are not business experts and may be anxious about money. They use a laptop or a phone. |
| Single job | Leave each visit knowing **your next step**, **why it fits you**, and **what happened** last time. |
| Task and risk | Used rarely, but each visit carries a high decision cost: someone could spend money or time they cannot afford. There is no time pressure. An urgent need for income is steered to a safe exit. |
| Content | Short questions, three options at most, and one recommendation with an evidence trail. Sources, dates and counterevidence are real parts of the content, not decoration. |
| Platform | Local browser at 320 to 1440+ CSS px, used by keyboard, pointer or touch. No accounts, no hover-only features. |
| Constraints | No UI framework or new dependency for the prototype. No downloaded web fonts. Content uses honestly labeled fixtures only. |

## Visual thesis: a steady notebook

The interface should feel like working through a problem on a good notebook page with a calm, experienced friend beside you. It should not feel like a dashboard.

- **First glance:** one question or one next step, set in a warm serif heading on a paper-colored page.
- **Second glance:** the reason, in plain sans-serif text, with the single primary action directly below it.
- **Everything else** is one deliberate click away: evidence, other options, and your saved answers.

**Memorable device:** the *margin rule*. A thin vertical line in the accent color runs down the left edge of the "Your next step" card, like the margin line on ruled paper. It marks the one thing that matters. It appears only on the current next step, so it never becomes wallpaper.

**Rejected on purpose:** metric tiles, charts, card grids, gradients, glass effects, pill badges on everything, confidence percentages, testimonials, illustrations of success and dark "premium" themes. Each of these either implies certainty we do not have or turns a decision into a tour.

**Composition:**

- One centered reading column, 40rem wide at most, shared by the banner, header, main content and footer.
- The shortlist stacks options vertically at every width, so they are compared by reading, not by scanning a grid.
- The progress view uses the same rail.

## Typography

No web fonts are downloaded. The stacks below are deliberate choices, listed in order of preference, and each ends in a generic fallback.

| Role | Stack | Use |
|---|---|---|
| Display | `"Iowan Old Style", "Palatino Linotype", Charter, "Book Antiqua", Georgia, serif` | Screen headings and the next-step title. It is a humane book serif that signals "reading and thinking", not "software". |
| Body | `"Segoe UI Variable Text", "Segoe UI", "SF Pro Text", -apple-system, "Noto Sans", Ubuntu, sans-serif` | Questions, reasons, controls and evidence. |
| Figures | Body stack with `font-variant-numeric: tabular-nums` | Hours, money and dates. |

The type scale and line lengths are in [tokens](docs/ux/tokens-and-primitives.md#type-scale). Body text is at least 1.0625rem (17 px) with a line height of 1.55.

## Tokens and primitives (summary)

Every screen is built from these primitives, and all values come from CSS custom properties in `ui/prototype/public/styles.css`. The full tables are in [tokens and primitives](docs/ux/tokens-and-primitives.md).

- **Page scaffolding:** practice banner, rail, screen heading.
- **Question:** the question group, choice list and "I'm not sure" choice.
- **Buttons and navigation:** primary button, quiet button, back link.
- **Content blocks:** next-step card, reason block, evidence disclosure, option entry, status notice, field error, progress list.

Icons form one inline SVG set:

- 24 px grid, 1.5 px stroke, round caps.
- Each uses `currentColor` and is `aria-hidden` next to a visible text label.
- Icons never stand alone as the only label.

## Language rules

- Follow the [UX copy](docs/ux-copy.md) contract. Lead with "Your next step", "Why this fits" and "What happened".
- Plain words only. Never mention agents, models, tokens, databases, connectors, fixtures, APIs or confidence scores in the interface.
- "I'm not sure" is a valid answer everywhere a question is asked, and it is never shown as an error.
- Keep observation and interpretation separate. "People posted about this problem" is an observation; "This may be worth testing" is an interpretation. Never write "people will pay you".
- Every practice screen shows the notice "Practice example: made-up information, not advice."
- No em dashes in interface copy. No exclamation marks. No urgency or pressure to spend.
- Button labels are verbs describing what happens: "Continue", "Choose this direction", "Show me the evidence", "Back to your next step".

## States

Every screen that loads, saves or validates has a designed state. The required states are:

- checking (with a stop action),
- not enough evidence,
- save failed (with the input kept),
- validation error (announced and linked to its field),
- safe exit for an urgent income need,
- empty progress.

Their copy and behavior are in [states and accessibility](docs/ux/states-and-accessibility.md).

The record screen uses the application core's outcome kinds. "They agreed to buy" and "Money arrived" each require an observed amount in US dollars, and "No reply yet" and "They said no" accept none. Every result also takes an optional short note. The full mapping to the core outcome contract is in [journey: recording a result](docs/ux/journey.md#recording-a-result).

## Accessibility floor

WCAG 2.2 Level A and AA across the whole journey, in every state and at every width, is the floor, not a goal. Any applicable failure blocks acceptance. Automated checks find defects; they do not prove conformance. The criterion-by-criterion evidence and anything not yet verified are recorded in [UI verification](docs/ui-verification.md).

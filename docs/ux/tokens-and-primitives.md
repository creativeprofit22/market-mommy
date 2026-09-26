# Tokens and primitives

Owner: [DESIGN.md](../../DESIGN.md). The CSS custom properties live in `ui/prototype/public/styles.css`. The names below match those property names exactly. Change a value here and in the stylesheet together.

## Color

The contrast ratios were computed with the WCAG 2.x relative-luminance formula from the hex values. The script used and the results are recorded in [UI verification](../ui-verification.md#token-contrast). Each ratio is measured against the background the token is actually used on.

| Token | Value | Role | Measured contrast |
|---|---|---|---|
| `--paper` | `#F6F2EA` | Page background | n/a |
| `--surface` | `#FFFDF8` | Cards, inputs, disclosures | n/a |
| `--subtle` | `#EDE7DB` | Quiet grouping (evidence body, progress rows) | n/a |
| `--rule` | `#D9D1C3` | Decorative structural dividers between sections (header, footer, sources, progress rows); never the only boundary of a control | n/a |
| `--ink` | `#1E2126` | Main text, headings | 14.46 on paper; 15.88 on surface; 13.11 on subtle |
| `--muted` | `#4A505A` | Secondary text (dates, hints) | 7.27 on paper; 7.99 on surface; 6.59 on subtle |
| `--line` | `#7C828C` | Control borders and dividers that identify a control | 3.46 on paper; 3.81 on surface |
| `--accent` | `#1D5C57` | Primary buttons, links, margin rule, selected edge | 6.91 on paper; 7.59 on surface |
| `--accent-hover` | `#154743` | Primary button hover and press | white text 10.43 |
| `--on-accent` | `#FFFFFF` | Text on accent | 7.72 on accent |
| `--attention` | `#A13A12` | Error and mismatch text, error edge and icon | 6.01 on paper; 6.60 on surface |
| `--selected` | `#E6EEEC` | Selected choice background (paired with a 2 px accent edge and a check icon) | ink text 13.69 |
| `--focus` | `#1E2126` | Focus ring: 3 px outline at a 3 px offset | 14.46 against paper, the adjacent color because of the offset |
| `--banner` / `--on-banner` | `#2A2E35` / `#F6F2EA` | Practice banner | 12.21 |

Rules:

- Status is never shown by color alone. Errors carry an icon plus the words "Please fix", and selected choices carry a check icon plus a thicker edge.
- Semantic tint-on-tint treatments are not used. The error treatment is a neutral surface with an attention-colored edge and icon, and ink-colored text.

## Type scale

| Token | Size | Line height | Use |
|---|---|---|---|
| `--step-title` | `clamp(1.75rem, 1.2rem + 2.2vw, 2.5rem)` | 1.15 | Screen heading (display serif) |
| `--step-subtitle` | 1.375rem | 1.25 | Card titles (display serif) |
| `--text-body` | 1.0625rem | 1.55 | Body, controls |
| `--text-small` | 0.9375rem | 1.5 | Dates, source lines, hints (never below 15 px) |

The reading measure is 40rem at most, about 70 characters of body text. Weights are 400 and 600 only.

## Space, shape, rail

- **Space scale** (`--space-1` to `--space-7`): 0.25, 0.5, 0.75, 1, 1.5, 2.25 and 3.5 rem. Screens use `--space-6` between major blocks and `--space-4` inside cards.
- **Rail:** `--rail: 40rem`, with inline gutters of `--gutter: clamp(1rem, 4vw, 2rem)`. The banner, header, main content and footer all align to the same rail.
- **Shape:**
  - `--radius: 6px` on cards, inputs and buttons.
  - Choices use the same radius.
  - No pills and no fully rounded shapes except the step dots.
- **Control height:** `--control: 3rem` (48 px). Every hit target is at least 44×44 CSS px.
- **Borders:** 1 px `--line` on controls. The next-step margin rule is 4 px `--accent`.

## Motion

| Token | Value | Use |
|---|---|---|
| `--dur-fast` | 90ms | Button and choice color changes |
| `--dur-std` | 160ms | Disclosure open, notice arrival |
| `--ease` | `cubic-bezier(0.2, 0, 0.38, 0.9)` | All transitions |

Transitions name their properties; `transition: all` is never used. There is no hover lift, parallax or ambient motion.

With `prefers-reduced-motion: reduce`, durations become 0 ms. State changes still show through color, edge and text.

## Icons

There is one inline SVG set in `ui/prototype/src/icons.ts`:

- 24×24 viewBox, 1.5 px stroke, round caps and joins, no fill, `currentColor`.
- Icons are always `aria-hidden="true" focusable="false"` next to visible text.

| Icon | Meaning |
|---|---|
| `arrow-right` | Continue |
| `arrow-left` | Back |
| `check` | Selected |
| `alert` | Please fix |
| `pause` | Stop checking |
| `book` | Evidence |
| `path` | Your progress |
| `question` | I'm not sure |

## Primitives

| Primitive | Anatomy | States |
|---|---|---|
| Practice banner | Full-width bar, text on the rail | Always visible on practice screens |
| Screen heading | `h1` display serif, receives focus after each step change | n/a |
| Question group | `fieldset` + `legend` (the question) + choice list + optional hint | default, error |
| Choice | Native radio inside a full-width label, 48 px minimum height, check icon when selected | hover (border ink), focus-visible (ring), checked (selected fill + 2 px accent edge + check), error group |
| "I'm not sure" choice | Same as a choice, separated by a divider and carrying the `question` icon | Same |
| Primary button | Accent fill, on-accent text, trailing icon; full width below 30rem (DOM and focus order unchanged) | hover/press (`--accent-hover`), focus-visible ring. No busy state: the record form's submit button reads "Save", or "Try again" after a failed save |
| Quiet button | Surface fill, ink text, 1 px line border | hover (border ink), focus-visible ring |
| Back link | Text link with a leading arrow icon | underline on hover, ring on focus |
| Next-step card | Surface card with the 4 px accent margin rule; `h2` "Your next step", then "Why this fits" and "What happened" | Default, not-enough-evidence variant |
| Evidence disclosure | Native `details`/`summary` "Show me the evidence"; the body lists source, excerpt, dates, observation vs. interpretation, counterevidence and assumptions | closed, open |
| Option entry | `article` with `h2` name; a `dl` for buyer, deliverable, fit, effort and cost, biggest unknown; "Why this option?" disclosure; "Choose this direction" button | default, chosen |
| Status notice | `role="status"` region with an icon, heading text and action | checking, not enough evidence, saved |
| Field error | Text with the alert icon, linked via `aria-describedby`; the group gets `aria-invalid` | Shown only after a submit attempt |
| Progress list | `ol` of saved answers with "Change" links, the chosen direction and the recorded result | empty, filled |

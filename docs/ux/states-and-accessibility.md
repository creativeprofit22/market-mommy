# States and accessibility

Owner: [DESIGN.md](../../DESIGN.md). Copy comes from [UX copy](../ux-copy.md#required-recovery-and-boundary-copy). This page defines how those states look and behave in the prototype. Test results live in [UI verification](../ui-verification.md), not here.

## States in the prototype

| State | Copy | Behavior |
|---|---|---|
| Checking | "Checking the sources you approved." Scope line: "Looking at: 2 practice sources." | `role="status"`, no percentage, and a "Stop checking" button. Stopping shows "Checks stopped. Here is what was saved." |
| Not enough evidence | "We don't have enough evidence to recommend this yet." | Offers a low-risk information-gathering step ("Ask two people you know…") or "Stop here". It does not invent an option. |
| Unknown date | "Publication date unknown." | Shown in place of a date and never guessed. |
| Save failed | "We couldn't save that change." | Input stays visible and focus stays on the form. "Try again" is offered, and nothing claims it is safe to close. |
| Saved | "Your result is saved." | `role="status"`. It never says "validated". |
| Validation error | "Please choose an answer, or pick 'I'm not sure'." | Appears only after Continue. The fieldset gets `aria-invalid="true"` and `aria-describedby` pointing to the message. Focus moves to the first choice, and the message is also in the page's live region. |
| Safe exit | "This cannot reliably cover an urgent bill. You can stop here without spending on research." | No option is shown and nothing prompts spending. Answers are kept. |
| Empty progress | "Nothing saved yet. Your answers will appear here as you go." | "Start" is offered. |

## Accessibility requirements and how each is checked

The target is WCAG 2.2 Level A and AA for the prototype journey. Each row gets a result in [UI verification](../ui-verification.md#accessibility-matrix).

| Area | Requirement | Check |
|---|---|---|
| Structure | One `h1` per screen; landmarks for banner, main and footer; `lang="en"`; a unique `<title>` per step; a skip link to main content. | Automated structure probe plus DOM review |
| Keyboard | The whole journey works with Tab, Shift+Tab, Space, Enter and arrow keys (native radios) with no trap. After a step change, focus moves to the new `h1` (`tabindex="-1"`). | Scripted keyboard-only run in Chromium |
| Focus | Focus is visible on every control: a 3 px ring at a 3 px offset, not obscured by the banner (no sticky elements). | Screenshots of focused controls plus computed style |
| Labels | Every input is inside a `label`; questions are `legend`s; buttons have visible text that matches their accessible name. | Accessibility tree snapshot |
| Errors | Errors are shown in text with an icon, announced through the live region, and linked via `aria-describedby`. | Scripted run reading the live region and attributes |
| Status | Checking, saved and stopped messages are announced without moving focus. | Scripted run |
| Contrast | 4.5:1 for text, 3:1 for control borders, focus and icons. | Token math plus pixel samples from screenshots |
| Reflow | No horizontal scrolling or lost content at 320 CSS px or 200% zoom. | Probe at 320 px and at 1280 px with 2× zoom |
| Text spacing | Content survives the WCAG 1.4.12 overrides. | Injected style probe |
| Motion | `prefers-reduced-motion: reduce` removes transitions. | Emulated media plus computed duration |
| Target size | Controls are at least 44×44 CSS px (the minimum is 24). | Measured bounding boxes |
| Screen reader | The journey is understandable with Narrator or NVDA. | **A person must test this.** It stays "not verified" until done. |

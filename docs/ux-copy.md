# Journey language and states

Status: proposed copy/interaction contract, not rendered UI or accessibility verification. Scope: [product](product.md); state meaning: [contracts](contracts.md). No visual redesign is part of this phase.

## Everyday structure

Lead with **Your next step**, **Why this fits**, and **What happened**. Ask about skills, hours, money available to risk, people the user can reach and income timing progressively. “I'm not sure” is a valid answer, not an error. Ask only a missing answer that can change the next decision. Do not require users to invent a chat prompt.

| Journey moment | Illustrative copy or action |
| --- | --- |
| Welcome | “Let's find a small, realistic next step using skills you already have.” |
| Income need | “When do you need income?” Explain that testing an offer may not produce money in time |
| Mismatch | “This cannot reliably cover an urgent bill. You can stop here without spending on research.” |
| Shortlist | Show buyer, deliverable, fit, effort/cost assumptions and biggest unknown; “Why this option?” |
| Selection | “Choose this direction” and “This doesn't fit my situation” |
| Offer | “What will the customer receive?” “What is included in this starting price?” |
| Test | “Decide what you will try, what would count as useful progress, and when to stop.” |
| Outcome | “What happened?” Separate “They agreed to buy” from “Money arrived” |
| Return | “Here is your saved next step.” Show unresolved checks without restarting them |

Examples are hypothetical, never testimonials or claims of observed demand. Explain business terms in context: who is likely to buy, why someone would choose you, what it costs to win a customer. Do not expose agents, token budgets, databases or connectors in ordinary UI. Still show consequential data sharing, sources, costs and permissions.

## Evidence progressively disclosed

First show the action and short reason. “Show me the evidence” opens source identity, supported excerpt, source/collection dates, independent origins, counterevidence, assumptions and uncertainty. Distinguish a source observation from our interpretation. “We found complaints” is not “People will pay you.” Never present a model confidence percentage as commercial-success probability.

## Required recovery and boundary copy

| State | User-facing meaning and safe action |
| --- | --- |
| Loading | “Checking the sources you approved.” Show current scope and “Stop checking”; no fake progress percentage |
| No usable results | “We checked these sources but found no usable evidence for this question.” Offer a narrower question/manual evidence; no claim of no demand |
| Missing coverage | “We haven't checked this part yet.” State what remains unknown |
| Stale evidence | “This information may no longer apply.” Display dates and refresh/limited-use choice |
| Unknown date | “Publication date unknown.” Never substitute a guessed date |
| Conflicting evidence | “The sources disagree.” Explain the disagreement and what could resolve it |
| Insufficient evidence | “We don't have enough evidence to recommend this yet.” Offer a low-risk information-gathering step or stop |
| Access rejected | “We couldn't access this source with the approved access.” Do not suggest bypassing it |
| Partial collection | “Some checks finished; others did not.” Identify which evidence is available and how advice is limited |
| Offline/provider failure | “This check could not finish. Your saved information is still available.” Show permitted retry only when safe |
| Cancellation pending | “Stopping new checks. A request already sent may still finish or cost money.” |
| Cancelled | “Checks stopped. Here is what was saved.” Disclose unresolved external requests rather than claiming refunds |
| Budget limit | “This check reached its spending limit.” No pressured upsell or automatic paid retry |
| Uncertain completion | “We need to check whether the earlier request finished before trying again.” |
| Correction | “Update what doesn't fit.” Explain affected advice will be reviewed; retain prior versions |
| Save failed | “We couldn't save that change.” Keep current input visible; do not claim it is safe to close |
| Success | “Your test is saved.” Never “Your business is validated” merely because an offer was generated |

Back, cancel and resume are distinct: navigation does not silently discard saved state or authorize new calls. Future UI must use accessible labels, keyboard/focus behavior, announced errors and status changes, readable contrast and narrow-screen reflow; those are implementation/verification requirements, not results from this document.

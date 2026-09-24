# Application contracts and preserved product requirements

Status: the synthetic shared-core subset is implemented; the original product design and manual Journey traces below remain requirements, not a claim of live research or product delivery. The implemented API section distinguishes actual wire shapes from illustrative design examples. Domain meanings: [CONTEXT](../CONTEXT.md). Ownership: [architecture](architecture.md). Numerical bounds: [evaluation](evaluation.md).

## Implemented fixture API (2026-09-19)

The strict command union in `src/application/commands.ts` is the wire authority. `createApplication({ storePath, capabilities })` returns `dispatch(json)` and `close()`; store path and grants are trusted startup configuration, not command fields. CLI reads one JSON command through EOF; MCP exposes the same thirteen action names with `action` omitted from tool arguments.

- Implemented saves/reads: `saveProfile`, `createJourney`, `resumeJourney`, `acceptFixtureEvidence`, `reuseFixtureEvidence`, `saveFixtureAdvice`, `startExperiment`, `recordOutcome`, `enqueueJob`, `cancelJob`.
- `collectEvidence`, `recommendDirections`, `prepareOffer` return typed unavailable/policy-denied results, never fabricated research. Supplied fixture advice is synthetic, not generated market advice.
- Writes use `requestId` and `expectedVersion`, plus explicit Journey and record-version references as required by the union. New records use expected version zero. `saveProfile` takes a complete validated `profile`, not the illustrative patch below; `createJourney` takes `profileId`, `profileVersion`, `priorLearning` and an explicit new `journeyId`. `resumeJourney` requires only action and Journey ID; optional `historyPage` accepts `{ offset, limit, journeyVersion? }`. The default is offset 0 / limit 32; the maximum limit is 61. Nonzero offsets require the Journey version supplied in the previous response's continuation.
- Success is `{ status: 'ok', journeyId, requestId, data, warnings }`; failure is `{ status: 'error', journeyId, requestId, error: { code, message } }`. IDs may be null for non-Journey/non-request operations. Safe error codes and schemas are defined in the command module; the broader failure taxonomy below remains the product requirement.
- Durable semantic receipts replay exact saved results and reject changed payload/Journey reuse. Authorization precedes replay. Fixture removal is the deliberate exception: all existing saved request results are sanitized/blocked, while used keys remain reserved; no replay can recover removed payloads or create fresh budget headroom.

`enqueueJob` does not execute automatically. Trusted `runNextFixture(storage, { signal, scenario, onProgress })` in `src/adapters/ggframework/runner.ts` claims and executes one queued fixture job. `onProgress` is an optional trusted callback for `worker-ready` / `provider-request`, not serializable model input. Retry/reconciliation and backup/export/import/removal-ledger operations are separate trusted worker APIs, not CLI/MCP tools. See [operations](operations.md#implemented-fixture-administration) and [verification](foundation-verification.md).

## Records and invariants

All mutable records have stable IDs and versions; times carry timezone or an explicit unknown value. Unknown publication/occurrence time is not replaced with collection time. Money carries an exact decimal/minor-unit representation, currency, basis (observed or assumed), and included/excluded expenses. Do not add currencies without an explicit dated conversion assumption. Revenue received, unpaid commitments, refunds, fees, taxes and delivery costs remain distinct.

| Proposed record | Required meaning |
| --- | --- |
| Journey | Stable `journeyId`, profile reference/version, durable journey state and last saved step, selected experiment reference (unset before selection), versioned recommendation/offer/experiment and prior-learning history links; references to constituent jobs/attempts, cumulative cost accounting and workload counters as defined below |
| BusinessProfile | Skills and deliverability, reachable buyers, geography, available hours, income need/deadline, spending tolerance, preferences, qualifications and unknown fields; correctable stage and version |
| Observation | Source statement or recorded event, permitted excerpt/snapshot reference, origin identity, observed/published/collected times separately, provenance, rights/retention context |
| Evidence | Observation reference, supported claim, segment, independent-origin/duplicate group, freshness state and policy basis, uncertainty, contradictions, correction version and dependent interpretations |
| Interpretation | Evidence versions plus profile version, contextual explanation and unknowns; extractor/model/rule version where applicable |
| Recommendation | Version, profile/evidence dependencies, buyer/problem/action, fit, counterevidence, economic assumptions, feasible experiment, success/stop conditions, what changes the advice, or explicit abstention |
| Offer | Selected recommendation version, buyer, problem, deliverable/exclusions, price/currency, expense and delivery-hour assumptions, safe buyer-access route |
| Experiment | Offer/recommendation versions, original assumptions/actions/success and stop conditions fixed before outcomes; state and later amendments without erasing baseline |
| Outcome | Experiment ID, distinct event type (conversation, objection, offer, paid commitment, payment received, refund, expense, delivery hours, repeat purchase), occurrence date, provenance and correction chain |
| Job | Stable `jobId`, immutable `journeyId`, original/root job reference and distinct `attemptId`; use case, scope/approval references, input versions, request/idempotency key, state, checkpoints, cancellation, deadline, limits, reserved/actual/unknown cost and provider request ID |

No customer payment processing is implied by recording a reported payment. A self-reported outcome must stay labeled self-reported; do not fabricate receipts or verification.

## Journey identity and accounting

Journey is the durable aggregate for one bounded journey; this section preserves its original design contract rather than spelling out the SQLite schema. Workflow control owns its progression, job membership and accounting; domain modules retain ownership of referenced profile, evidence, recommendation, offer, experiment and outcome records. Storage persists the aggregate and its references through the existing inward-owned ports. A profile can have multiple sequential journeys; its ID is never a substitute for `journeyId`.

- Establish and durably save `journeyId` with the profile reference before journey work begins; return it to the caller. Initial creation follows the same version/idempotency rules as other commands. The Journey owns its saved state, last completed step, selected experiment reference and history links. Referenced versions preserve the assumptions used at each step; profile correction flags dependent advice without replacing that history or journey identity.
- Every job and attempt belongs to exactly one immutable `journeyId`. The initial attempt has its own `attemptId`; each retry has a new job/attempt/request identity linked to the original/root job and preceding attempt. Those links retain the original run allowance as well as the journey allowance; a new attempt is not a new run budget. Idempotent replay returns the existing identity/result, not another attempt. Reusing a key with another journey or changed payload is a conflict.
- Journey owns the cumulative accounting view through durable references to all constituent job/attempt entries: estimates, outstanding reservations, actual charges and unknown charges remain separately identifiable. Each entry retains its originating `journeyId`, job/attempt and provider request identity. Reconciliation records adjustments without erasing that origin or rewriting terminal jobs. Retain unresolved reservations; replacing a reconciled reservation with its actual charge must not count both as separate spending. Money representation is governed by [records and invariants](#records-and-invariants), and reservation/reconciliation rules by [operations](operations.md#workflow-and-spending-ownership).
- Journey owns cumulative workload counters backed by membership/history references for declared sources, evidence records, direction options and selected experiment. Corrections, repeated reads, retries and interface switches do not clear those counters or membership; referencing the same item again does not create a new item. Replacements cannot conceal earlier consumed workload. All run/journey bounds remain solely defined by [evaluation](evaluation.md#bounded-workload) and its [accepted targets](evaluation.md#accepted-targets); no additional allowance is implied here.
- Shared use cases persist linked job intent, reservations and workload accounting consistently with the Journey before external work, and save progress/result references before reporting success. Expected versions and idempotency prevent concurrent interfaces or recovery from silently overwriting progress or allocating the same remaining allowance twice. Correction, cancellation, restart and resume preserve cumulative accounting; only reconciled adjustments can release reservations.
- A later separately approved experiment creates a distinct `journeyId` referencing the same profile and explicit prior journey/learning versions and approval. Its selected experiment starts unset and is then set to the newly confirmed experiment; the earlier Journey retains its selected experiment and saved history. Amendments to the existing experiment stay in the existing Journey. No old job, attempt, outstanding reservation, actual/unknown charge or unfinished work may be reassigned to the new Journey to obtain fresh allowance. Old uncertain requests still reconcile against the old Journey, even after it is stopped or a later Journey exists. Prior evidence can be referenced where suitable, but its use must be represented within the new Journey's workload bounds, not hidden by the learning link.

## Shared use cases

Every command supplies validated local session context, request ID, applicable expected versions and policy context. Context is resolved by the application, not trusted merely because a caller claims permission. Repeated matching idempotency keys return the prior outcome; the same key with different payload rejects as a conflict. All journey-scoped commands and results carry the same explicit `journeyId`, including collection, recommendation, offer/experiment work, outcomes, cancellation and resume. The application verifies that supplied profile, job, experiment and version references belong to that Journey context; conflicting references reject before work. A profile-only save may exist before a Journey, but a correction made during journey work carries that `journeyId` and retains its allowance. Shared profile corrections flag dependent advice in every affected Journey without changing any Journey's accounting.

| Proposed use case | Input → output and important rule |
| --- | --- |
| `saveProfile` | Profile patch + expected version → saved profile/version or validation/conflict; flag dependent advice for reassessment |
| `collectEvidence` | Profile ID, question, approved source scope and job limits → job and normalized evidence/coverage; no unapproved provider call |
| `recommendDirections` | Profile version and evidence snapshot → bounded shortlist/selected recommendation or abstention; suitable stored evidence can be reused |
| `prepareOffer` | Selected recommendation/version and corrected assumptions → draft offer or unresolved requirements; no outreach side effect |
| `startExperiment` | Reviewed offer and original conditions with user confirmation → saved active experiment; does not contact buyers or spend |
| `recordOutcome` | Experiment ID, typed event and idempotency key → event/history; corrections append a version/supersession link |
| `resumeJourney` | Required explicit `journeyId` → that Journey's saved state/version, profile/version, selected experiment/history, next safe step, interrupted job/attempt links, cumulative workload/cost status and unresolved evidence dependencies; never auto-replays a paid action. A profile-only request rejects as missing journey selection; all interfaces may present saved journeys for explicit selection but must not infer the latest or active journey |
| `cancelJob` | Job ID → cancellation request or existing terminal result; do not claim upstream cancellation or zero charge without confirmation |

Implemented fixture resume and cancellation distinguish confirmed removal tombstones from missing or corrupt references. Removed profile/selected-experiment payloads stay absent; responses include at most 102 `removedDependencies` entries (kind, ID and version only) and fixed warnings. `independentOriginsComplete` is false when removed evidence/observations make origin metadata unavailable; no origin is inferred from redacted content. Journey/job membership, history, charges, tombstones and blocked historical receipt keys remain intact. Queued cancellation still releases its unstarted reservation; running cancellation retains unresolved reservations. Missing/wrong-kind references and storage errors still fail rather than being treated as removal.

New fixture results contain at most 64 records. Resume repeats the Journey, available profile and selected experiment, then includes one explicit history page: jobs in immutable membership order, followed by current interpretations and recommendations in kind/ID order. `historyPage` reports the offset, total and `next` (null at the end); pass `next` as the next request's `historyPage`. A changed Journey version rejects continuation with `conflict`; restart from the first page. Pages are current projections, not frozen job-status snapshots. Writes return affected records, not accumulated historical job payloads. Existing receipts retain their original bounded schema (including the earlier 2,000-record limit) for replay and import/export only.

Fixture results include a bounded `jobStatuses` projection for the returned Job payloads (at most 61), separate from immutable Job records. `jobSummary` reports total, active and unresolved job counts across the entire selected Journey (up to 1,000 jobs); Journey costs, `reconciliationRequired` and `nextSafeStep` also use the entire history, never only the selected page. Tracked accounting and billing use each job's latest workflow ledger entry, including reconciliation adjustments; untracked legacy accounting is `null`, never an inferred zero. Terminal unresolved work returns `reconcile-uncertain-work`; active jobs instead return `wait-for-job-start`, `wait-for-job-completion` or `wait-for-cancellation`. Reconciliation clears the current status without rewriting terminal history. Historical idempotency receipts remain snapshots, not current status; use `resumeJourney` for a fresh projection.

A result envelope contains `journeyId` for journey-scoped work, request/job/attempt IDs where applicable, status, relevant record versions, data where valid, warnings/limitations, evidence/coverage and cost status, plus a typed error with safe next action when needed. Diagnostic detail stays separate from plain-language copy. No success response before the durable save is acknowledged.

## State transitions

Journey (state owned by the durable Journey aggregate): profile draft → evidence review → direction selected → offer prepared → experiment active → outcome review → continue/revise/stop. Missing evidence may pause rather than force progression. Corrections can return to evidence or offer review while retaining history. Resume identifies the last saved step, not the most optimistic transcript statement.

Job: queued → running → succeeded / partial / failed / cancelled / budget-exhausted / reconciliation-required. A running cancellation first becomes cancel-requested; settle cancelled only after work stops or clearly record unresolved upstream work. Crash with unknown external completion becomes reconciliation-required. A terminal job is immutable; a permitted retry is a linked new attempt with its own request identity and remaining journey budget. Completed work may win a cancellation race; return its actual terminal state.

Experiment: draft → active → completed or stopped; revisions/amendments are linked, not replacement of original conditions. Outcome review can recommend another experiment, not retroactively change the first one's success bar.

## Failure contract

| Status / condition | Meaning and safe response |
| --- | --- |
| Validation failure | Invalid or missing critical input; identify correctable field without losing saved progress |
| Version conflict | State changed since read; reload and explicitly reconcile, no last-write-wins data loss |
| Absent evidence | A successfully checked scope yielded no usable evidence; not proof of no demand |
| Missing coverage | Required source/segment was not checked; explain the unanswered question |
| Stale / unknown freshness | Evidence cannot support a current claim without recheck or explicit limitation; do not silently treat unknown dates as recent |
| Partial collection | Some validated observations saved, but declared scope incomplete; list failed/unvisited portions |
| Access rejected | Source permission/authentication/terms gate failed; no bypass or fallback that evades restrictions |
| Provider failure | Service failed; keep separate from empty findings; retry only under policy and remaining budget |
| Budget exhausted | No further external work; retain partial evidence and known/unknown charges; no model override |
| Cancelled | Stop requested and settled locally; disclose unresolved upstream charges/requests separately |
| Reconciliation required | Completion or billing uncertain after interruption; inspect provider status before retry |
| Storage failure | Save not confirmed; do not claim saved progress, overwrite records, or blindly repeat external actions |
| Unsupported recommendation | Output fails evidence/fit validation; abstain and name the gap rather than fabricate support |

## Illustrative input/result cases

These are synthetic contract examples, not tested endpoint payloads or researched opportunities.

- `saveProfile`: existing spreadsheet skill, US, limited weekly hours, income deadline unknown → save version with unknown deadline; ask when income is needed before time-sensitive advice.
- `collectEvidence`: approved manual notes plus an external source with rejected access → `partial`, manual observations retained, external status `access-rejected`, publication dates explicitly unknown. No claim that buyer demand is absent.
- `recommendDirections`: profile version A, repeated copies of one buyer complaint and no payment evidence → one independent origin, willingness to pay unknown; abstain from a demand-backed recommendation and suggest a suitable conversation.
- `recordOutcome`: hypothetical USD 100 commitment followed later by USD 40 deposit → two distinct events, USD 40 received, unpaid balance not represented as cash. Expenses still needed before margin can be described.
- `resumeJourney`: provider request ID recorded but result missing after shutdown → `reconciliation-required`, saved profile available, no automatic chargeable replay.

### Manual identity and recovery traces

These synthetic traces check the documentation contract only, not runtime behavior. `J-A` and `J-B` are Journey IDs for profile `P`; `C` denotes an already recorded actual charge and `R` an outstanding reservation, using the money rules above rather than new numerical limits.

| Trace | Identity, saved progress and experiment | Accounting and safe result |
| --- | --- | --- |
| Partially charged research → crash → profile correction → CLI resume | UI research records `J-A`, root job `K-A`, attempt `A-1`, provider request and partial evidence at the saved evidence-review step. `J-A` has no selected experiment yet. A correction saves `P` at its next version in `J-A` context and flags advice for reassessment. CLI calls `resumeJourney(J-A)` and receives those same links, corrected profile/version and saved step, not a new Journey | Actual charge `C`, unresolved reservation `R` and consumed workload remain on `J-A` across crash/correction/resume. Resume reports reconciliation-required for uncertain external work, preserves the unset experiment selection and makes no paid replay |
| Retry with unknown provider completion | `J-A` retains saved offer-review progress and no selected experiment; preparation job `K-B`, attempt `A-2` and its provider request remain linked to it. Unknown completion requires reconciliation before any permitted retry. Such a retry creates job `K-C`, attempt `A-3` and a new request identity, linked to root `K-B` and preceding `A-2`, still in `J-A` | Before reconciliation, `C` and `R` remain unchanged, not zeroed. A permitted retry must fit the remaining original run and Journey allowances, retaining any unresolved `R` and reserving its own bounded cost. Confirmed settlement alone adjusts `R`/actual cost against `J-A`; terminal job history, saved progress and experiment selection are not replaced by retry |
| Two sequential journeys for the same profile | `J-A` saves outcome-review/stop, selected experiment `E-A` and its job/attempt history, including `K-B`/`A-2`. Separate approval for a later experiment creates `J-B` for `P` with prior-learning links to `J-A`; its preparation job `K-D`/attempt `A-4` belongs only to `J-B`. On confirmation `J-B` saves experiment-active with selected experiment `E-B`. Explicit resume of each ID returns its own state and experiment; profile-only resume is rejected | `J-A` retains `C`, any unresolved `R`, consumed workload and later settlements from its old requests. `J-B` accounts only for its own work/charges and represented reused evidence; no unfinished work or old charges migrate to its fresh allowance. Creating `J-B` does not reset or reconcile `J-A` |

The same explicit-ID selection, version/conflict, saved-state and accounting rules apply if UI, CLI and GG Coder exchange roles in any trace. Bounds remain those in [evaluation](evaluation.md); these traces neither change accepted limits nor demonstrate a runtime budget bypass or verified enforcement.

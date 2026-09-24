# Evaluation and acceptance contract

Owner: evaluation maintainer. **Targets accepted 2026-09-18; fixture retrieval measured 2026-09-19, broader product acceptance unevaluated.** This document is the sole canonical owner of numerical workload and quality/cost/latency targets. [Decision ledger](decisions.md#approval-provenance) records the user's explicit agreement to the step-1 brief. Procedures below govern measurement; the implemented fixture suite and labeled scenario inventory are not a real-user pilot or recommendation-quality dataset.

## Bounded workload

One US adult beginner profile, a direction/offer/test journey, later outcome recording and resume. At most **two sources, 50 evidence records, three direction options and one selected experiment** per bounded journey/evaluation fixture. A source is one declared origin/source collection (including a declared manual dataset); multiple pages under that scope remain subject to record/cost/time limits and cannot conceal additional origins. Reposts do not establish independent sources. Every external destination still requires permission; a provider is not itself an evidence source merely because it fetched one.

A run is one user-requested bounded research or recommendation job, including its subcalls, retries and continuation attempts. A digital journey accumulates external model/collection costs across profile interpretation, research, recommendations, offer/test preparation and outcome review/resume. Restart, correction or interface switching must not reset its budget. A later separately approved experiment is a new journey, not a workaround to finish the old one over budget. Real-world waiting, customer conversations and delivery time are recorded separately, not counted as software response latency.

Build **30 non-sensitive labeled scenarios** before implementation evaluation: **10 ordinary**, **10 insufficient/conflicting-evidence**, **10 failure/correction**. Label expected decisions and abstentions before running the system. The insufficient-evidence group requires abstention from a definitive business recommendation; it may still allow a clearly labeled information-gathering step. Ordinary cases must require useful actions so an always-abstain system cannot pass.

Failure/correction coverage: provider timeout, rejected access, partial collection, unknown date, stale evidence, duplicate/reposted evidence, profile/evidence correction, cancellation, interrupted external completion/restart, and outcome/version conflict. Include misleading instructions and secret sentinel strings within suitable non-sensitive fixtures. No real credentials or personal buyer data. A single scenario can exercise multiple boundaries without diluting the fixed group allocation.

## Accepted targets

| Measure | Acceptance threshold | Denominator and scoring |
| --- | --- | --- |
| Material factual claim support | **≥95%** | Supported material factual claims / all material factual claims across outputs. A material claim can change choice, risk, price, effort or next action. Review whether a cited accessible excerpt actually supports the claim in context; a plausible URL is not enough |
| Recommendation grounding | **100%** | Recommendation results with appropriate evidence links, or explicit justified abstention / all expected recommendation results. Missing/error output fails this measure rather than disappearing |
| Invented citations | **0** | Count nonexistent, fabricated or source-mismatched citations; any one fails, regardless of average support |
| Income guarantees | **0** | Count express or implied guaranteed earnings/time-to-cash promises; planning horizons are not predictions |
| Correct abstention | **≥90%** | Correctly reasoned abstentions / all pre-labeled insufficient-evidence cases: at least **9 of 10**. Provider error alone is not a reasoned abstention |
| Feasible next actions | **≥80%** | Actions passing the human rubric / all scenario-required action slots. Ordinary scenarios each require an action; other slots are pre-labeled. Missing, errored or inappropriately abstained slots fail. Information-gathering actions do not turn an ungrounded business recommendation into a pass |
| Beginner comprehension | **≥80% of five consented beginners** | At least **four of five** can explain their next action without coaching. Use all five consented starters in the denominator; incomplete attempts do not count as success |
| Saved-progress retrieval | **p95 ≤1 second** | Invocation to usable saved result, including required local loading; no provider call needed |
| Existing-evidence recommendation | **p95 ≤30 seconds** | Invocation to usable, saved recommendation/appropriate abstention using the declared evidence snapshot |
| Fresh bounded research | **p95 ≤120 seconds** | Invocation through collection, validation and saved usable result or justified abstention; not just first streamed text |
| External model/collection cost per run | **≤USD 1** | Every run, including retries/failed/partial attempts; maximum cap, not a mean or percentile |
| External model/collection cost per complete digital journey | **≤USD 3** | Sum of all constituent calls/attempts over the journey; maximum cap, not a mean |

Citation and income-guarantee zero-tolerance rules override aggregate percentages. These are pilot acceptance targets, not permission to release despite unsafe behavior. Full operating cost also reports storage, support and independent review separately. Unknown live price or uncertain charges cannot be counted as zero or a passed cap.

## Review rubric and baseline comparisons

Have a reviewer independent of the generating model/author inspect every material claim, citation and proposed action, blinded to approach where practical. Record item IDs, verdict, supporting excerpt, contradiction and correction reason. Disagreements remain unresolved/failing until adjudicated; do not silently relabel cases after seeing results.

A feasible action must satisfy all of: matches deliverable skills/qualifications; fits time and affordable downside; has a plausible permitted path to reachable buyers; specifies a concrete deliverable or information-gathering task; makes currency, expense and uncertainty assumptions visible; defines what to observe and when to stop. Missing critical constraints require a question/abstention, not an assumed favorable answer. The independent reviewer checks traceable evidence, not personal enthusiasm for an idea.

Compare on identical versioned inputs/evidence against a simple rules/checklist baseline and plain structured-output reasoning. Evaluate the proposed ggframework-assisted path for support, feasibility, abstention, corrections, latency and cost; do not assume agent complexity improves results. TypeSafe is a later optional comparison only after source/license/API review. Meeting absolute thresholds does not establish improvement over a baseline; report the deltas and whether complexity buys useful behavior. No required improvement percentage has been approved.

## Future measurement procedure

1. Freeze scenario IDs, inputs, source snapshots/permissions, expected outcomes, action slots and rubric before runs. Record product commit, framework/package versions, model/provider/settings, price schedule/currency assumptions and reviewer identity/role without publishing private data.
2. Run deterministic non-sensitive fixtures first; they require no live provider charges. Exercise actual shared use cases through UI/CLI/GG Coder once implemented; compare semantic states and failures, not just mock adapter return values.
3. Measure cold and warm paths separately on a declared hardware/OS/runtime setup and database fixture size within the workload. Cold means a new process with empty application caches; warm means an already-running process with declared caches. Report uncontrolled OS/provider caching rather than claiming it was cleared. Reset fixture versions between repetitions to avoid hidden data growth.
4. For each latency path and cold/warm group, use **30 predeclared attempts** as the measurement procedure, not a new product workload promise. Order values and use nearest-rank p95: rank `ceil(0.95 × n)` (29th of 30). Record wall-clock start/end, queueing, provider time, persistence and cancellation; streaming onset alone is not completion.
5. Retain all scheduled attempts in the report. Timeout/error/non-usable results get an unbounded completion value for successful-response p95 and separate actual elapsed/termination status; they cannot make the product look faster. Deliberately injected failure fixtures are reported in their own recovery group and still remain in its denominator, not mixed away or represented as ordinary success. Measure expected safe terminal states separately, clearly labeled. A justified evidence-based abstention is usable; a provider failure is not.
6. Report percentages with counts and group breakdowns, zero-tolerance violations, maximum and total cost, and cold/warm p95 separately. Both latency groups must meet targets; no pooled percentile that hides cold-start regressions. Run fixture protocol does not validate live price/latency; later live measurement requires source, data and spending authorization.
7. For usability, recruit consented adults matching the audience, explain data use/withdrawal and avoid essential-expense pressure. Ask each to explain the next task, intended buyer/information gap and stop condition without coaching. Count a participant only if all are correctly understood; record misunderstandings and withdrawals honestly. This tiny sample is usability evidence, not market validation or proof of earnings.
8. Track real experiment outcomes separately: conversations, offers, commitments, received payments, refunds, expenses and hours. Report uncertainty and elapsed real-world time; never treat a generated plan as first-customer success.

Predeclare scenario review and sampling changes in a dated evaluation record before rerunning. Changing an accepted threshold needs explicit agreement recorded in [decisions](decisions.md), not a quiet denominator adjustment.

## Functional acceptance and safety gates

Across equivalent entry points: saved profiles and corrections persist; collection distinguishes no results from failures; evidence links resolve to supporting material; recommendations retain assumptions and versions; original experiments survive amendments; commitments and received payments stay separate; outcome retries do not duplicate events; cancellation stops new work; restart reconciles uncertain external actions; budgets survive retries/resume; no secrets appear in model/tool/UI/log outputs. Verify backup/restore on a copy and safe failure when persistence is unavailable. Fixture portions have local test evidence in [foundation verification](foundation-verification.md); live collection, product reasoning, UI and real-user portions remain future checks.

Partial/no-data paths must remain useful and honest. Fail closed on unknown source permission, unknown costs or unvalidated output. No live outreach/publishing/purchasing is part of initial acceptance. Follow [operations](operations.md) and [evidence policy](evidence-policy.md) for required specialist review before real use.

## Current evidence and limitations

The predeclared scenario inventory and fixture application/fault tests exist; scenario quality labels remain unevaluated rather than passing recommendation scores. Parent-reported local verification passed the full suite after readiness/child-exit timing fixes; see [foundation verification](foundation-verification.md#latest-parent-verification-and-measurements) for execution IDs, counts and limits. No consented comprehension trial, independent advice-quality review, live price enforcement or market outcome evidence exists.

Latest parent report finished 2026-09-19T07:03:23.825Z with 30 cold CLI and 30 warm MCP retrieval attempts, no failures, nearest-rank p95 at rank 29: **506.4191 ms cold / 7.8894 ms warm**. Both are within the saved-progress target for this Windows/Node fixture only. Retrieval did not mutate state. The store contained 102 records / 152 versions, main file 4,096 bytes and WAL 3,699,792 bytes; it exercised two sources and 50 evidence records but zero directions/experiments. This is a **partial maximum workload**, not full-workload or product acceptance. OS caches were not claimed cleared; cold means new CLI process and warm an existing MCP process.

The unchanged [historical measurement artifact](foundation-measurements.json) contains an earlier successful full 60-sample retrieval run (cold p95 799.72 ms / warm 7.20 ms), before readiness fixes. It is not the latest report's raw samples. Latest figures are parent-provided summary evidence, not newly committed raw samples. Resource/recovery measurements and unmeasured child peaks/OS handles are disclosed in the verification record. Neither synthetic cost accounting nor these timings establishes live recommendation/research performance, legal compliance, leak freedom or commercial usefulness. Accepted targets above are unchanged.

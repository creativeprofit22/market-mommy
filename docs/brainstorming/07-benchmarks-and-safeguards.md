# Benchmarks and safeguards

Everything here is proposed evaluation/design guidance. No product benchmark, provider test, security audit, or legal review was performed during this brainstorming.

## Evaluation objective

Measure useful decision quality for a given cost and delay. Optimize user progress rather than report length, agent activity, or collected data volume.

For early users, assess whether they understand the next step, can carry it out, and learn something relevant from actual buyers. Longer-term outcomes include paid commitments, contribution margin, and time to cash; these are not guaranteed or attributable to the tool without suitable evidence.

## Benchmark layers

| Layer | Measurements |
| --- | --- |
| Collection | Valid unique records, completeness, freshness, cost per usable record |
| Extraction | Precision/recall for pain, intent, objections, prices, relationships |
| Entity resolution | False merges and missed matches |
| Retrieval | Relevant evidence found, counterevidence coverage, duplicate inflation |
| Grounding | Whether material claims are supported by cited evidence |
| Classification | Accuracy, calibration, and error rates when abstention is allowed |
| Forecasting | Error against simple baselines; calibration for defined probabilistic events |
| Recommendations | Feasibility, fit, economics, useful tests, reviewer agreement |
| User experience | Comprehension, successful next-action completion, confusing terminology |
| Operations | End-to-end latency, memory, storage growth, cancellation, recovery, cost |
| Commercial outcomes | Paid pilots, win rates, money retained after costs, time to cash |

## Proposed evaluation design

- Start with a small human-labeled evidence set containing ambiguity, duplicates, conflicts, missing timestamps, and manipulative source content.
- Use time-based holdouts. Do not allow later information into historical decisions or forecasts.
- Keep near-duplicates, syndicated stories, and related evidence from leaking across tuning and evaluation sets.
- Compare against keyword rules, a single-model summary, manual analysis, and simple trend baselines.
- Remove components in turn to measure whether TypeSafe, extra agents, semantic retrieval, graphs, and simulations justify their cost.
- Use frozen snapshots for reproducible analysis comparisons and separate live tests for collection reliability/freshness.
- Log recommendations before outcomes. Use approved real-world tests and control groups where feasible.
- Do not rely solely on model-based judging; polished language can conceal weak decisions.
- Report sample size, uncertainty, and missing coverage. Small commercial samples do not justify broad claims.

No fixed performance thresholds or commercial success rates have been agreed. Set targets for a concrete workload, then measure cold and warm behavior on the same data and environment.

## Security and operational boundaries

- Treat scraped content, files, model output, and tool output as untrusted data—not authorization.
- Grant research agents only the capabilities needed for research.
- Enforce spending, source access, approvals, and external actions in code rather than prompts alone.
- Do not publish, contact people, or spend beyond authorized limits by default.
- Keep credentials outside prompts and user-facing logs.
- Validate external destinations and contain file/network access through controlled interfaces.
- Isolate private business data by workspace and user authorization.
- Bound retries, jobs, model context, storage, and concurrency.
- Preserve correction and deletion handling for dependent claims.

These are design requirements, not a claim that the future system is secure.

## Responsible data use

Engineering guidance, not legal advice.

Public availability or a vendor's technical capability does not establish rights to collect, retain, redistribute, or profile. Evaluate actual sources, provider terms, intended jurisdictions, and data use before launch.

Use necessary professional information rather than personal-life profiling. Avoid sensitive-trait inference, covert tracking, leaked data, fabricated reviews, and access-control bypasses. Review outreach rules before enabling contact workflows.

Make vendor data sharing, retention, correction, and deletion understandable. Preserve source evidence only as permitted. Get appropriate legal advice for source rights, professional-person data, regulated business activities, and the actual markets served.

## Honest claims

Separate observed facts, hypotheses, vendor claims, code observations, and runtime measurements. Do not promise income, forecast certainty, legal compliance, security, or performance without relevant evidence.

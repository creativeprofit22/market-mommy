# Decision ledger

Owner: product maintainer. Updated 2026-09-19. This is the sole decision-status and approval-provenance ledger; numeric targets are owned by [evaluation](evaluation.md). Accepted design is not installed software, measured performance, source permission, or spending authorization.

## Approval provenance

The user approved execution of the documentation plan in session `a286077d-26c9-4c0f-afee-78c96c92220b`, then answered the step-1 clickable decision brief on 2026-09-18:

- Audience: “Accept proposed audience; initial geography United States.” The brief specified English-speaking adults with an existing deliverable skill, limited spending tolerance and a 30–60-day planning horizon, not an earnings promise.
- Delivery: “Accept single-user local browser pilot, TypeScript/Node core, SQLite, required ggframework adapter, secondary CLI/GG Coder, approachable launcher requirement.”
- Targets: “Accept all numerical targets and bounded workload in the decision brief as future acceptance requirements, not measured results or paid-call authorization.” The exact set is preserved in [evaluation](evaluation.md#accepted-targets).

Plan approval alone did not accept open choices. No application implementation, installation, framework edits, provider charges, commits or release were authorized.

## Foundation implementation authorization (2026-09-19)

The user approved the shared-core implementation plan and its ordered steps, including project-local installation of the six exact candidate packages after review. During step 1 the user separately authorized installing Node 24.21.0 side-by-side through the existing fnm manager without changing its default. That installation and the SQLite API probe succeeded. The selected runtime, exact package pins, archive/license/script findings and remaining redistribution notice gate are recorded in [foundation verification](foundation-verification.md#step-1--runtime-and-dependency-review-2026-09-19). This authorization does not permit live providers, real data, changes in other repositories, automatic MCP registration, commits or release. Earlier documentation-phase statements above remain historical.

Steps 1–10 of the approved shared-core plan are implemented locally; step 11 reconciles documentation. This is implementation progress, **not phase Done**. Local fixture CLI/MCP protocol checks do not substitute for host integration or beginner delivery. Actual GG Coder registration permission was requested but the prompt was dismissed; no host settings changed and the host smoke test remains unverified. No commit/push or hosted CI run is claimed. Current evidence and remaining gates are in [foundation verification](foundation-verification.md).

## Accepted decisions

| ID | Decision | Rationale and owned detail |
| --- | --- | --- |
| D1 | Narrow US adult beginner audience and planning horizon | Existing skills and limited downside make a first test bounded; [product](product.md#audience-and-income-needs) owns audience and mismatch handling |
| D2 | Local browser pilot with shared TypeScript/Node core, SQLite and ggframework adapter | Avoid hosted tenancy and another desktop shell; preserve one engine across entry points; [architecture](architecture.md#delivery-and-stack) owns consequences |
| D3 | Bounded workload and predeclared acceptance targets | Evaluate usefulness, grounding, cost and delay before expanding; [evaluation](evaluation.md) owns exact values and measurement definitions |
| D4 | Preserve brainstorming and distinguish payment plans from business stages | Explicit approved-plan requirement, consistent with prior accepted direction; glossary in [CONTEXT](../CONTEXT.md), scope in [product](product.md) |

D2 remains in this ledger rather than an ADR: the local pilot is an explicitly limited, reversible delivery choice, not yet a hard-to-reverse deployment commitment. No ADR file is warranted merely to duplicate it. Revisit with new evidence before hosted or multi-user operation.

## Proposed design details

The complete journey, owned modules, proposed use cases/records, failure contracts, source policy and operational requirements implement the approved documentation scope. Their full product scope remains specifications for future review and implementation, not separately user-approved production APIs. The fixture subset now implemented is explicitly identified in each owning document; original design requirements and manual Journey traces are preserved. [Architecture](architecture.md), [contracts](contracts.md), [evidence policy](evidence-policy.md) and [operations](operations.md) own those details. Measurement procedures in [evaluation](evaluation.md) operationalize D3 without claiming results.

## Open gates and deferred decisions

| Status | Decision | Gate / next owner |
| --- | --- | --- |
| Selected for fixture foundation | Node 24.21.0, built-in SQLite, exact registry framework/SDK/schema/compiler pins | Manifest/lockfile and dependency review establish the choice; SQLite maturity and zstd wrapper/WASM missing-notice redistribution gate remain explicit |
| Open | UI library, launcher packaging, host registration and release distribution | Separate permission for actual host registration; beginner setup, supported platforms and complete redistribution notices before delivery |
| Open | Model and collection providers; first permitted external sources; live price schedule | Product/security/legal review of actual sources and data handling, explicit key/cost authorization before live calls |
| Open | Source-specific freshness periods and retention schedules | Define against selected source terms and decision use before enabling collection; unknown freshness is not “fresh” |
| Open | Platform support and beginner setup procedure | Validate a packaged launcher on a named supported environment before beginner delivery |
| Open | Product pricing and payment plans | Later consented willingness-to-pay and full operating-cost evidence; no billing feature implied |
| Later | TypeSafe | Compare against rules and available structured-output reasoning; review exact candidate API/skill and rights before adoption |
| Later | Rust, semantic/vector/graph databases, workflow platform | Require measured workload benefit exceeding operational cost; no dependency adoption in this phase |
| Later | Stage 3, enterprise, hosted monitoring, autonomous execution, Linkgo | Separate future scope and approval; preserve hypotheses, not initial requirements |

A missing provider or package version does not prevent accepting this documentation contract; it prevents pretending that implementation, security, recovery or live economics are verified. Change agreed targets prospectively with explicit approval and a dated ledger entry, never retroactively to make a failed benchmark pass.

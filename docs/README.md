# Market Mommy documentation

**Implemented developer foundation, synthetic fixtures only; not a completed market-advice product.** Updated 2026-09-26 (foundation phase Done for synthetic-fixture scope). The approved shared-core plan authorized the local implementation now described here; full product/UI/live requirements remain distinct. [Decisions](decisions.md) owns exact status and approval provenance. Start with [developer setup](../README.md) and [foundation evidence/gap matrix](foundation-verification.md#six-criterion-evidence-and-gap-matrix). No live costs, real data, host registration or release are authorized by these documents.

## Canonical owners and navigation

Ownership below is a maintenance responsibility, not a claim that a team or named reviewer has been staffed. The project maintainer holds unassigned roles. Update the owning document and link to it elsewhere instead of copying values or decisions.

| Document | Owns | Responsible role |
| --- | --- | --- |
| [Product](product.md) | Audience, income needs, full direction-to-first-customer journey, scope/non-goals, later stage | Product maintainer |
| [Architecture](architecture.md) | Delivery rationale, module dependencies, shared interface flow, actual framework seam | Architecture maintainer |
| [Contracts](contracts.md) | Implemented fixture API versus preserved product records/use cases, invariants, failures and manual Journey traces | Application-contract maintainer |
| [Decisions](decisions.md) | Accepted/proposed/open/later status and approval provenance | Product maintainer |
| [UX and copy](ux-copy.md) | Plain-language journey and recovery states, progressive evidence; not a visual design | Experience maintainer |
| [Design reference](../DESIGN.md) with [journey](ux/journey.md), [tokens and primitives](ux/tokens-and-primitives.md), [states and accessibility](ux/states-and-accessibility.md) | Visual thesis, typography, tokens, primitives, icons, screen flow and accessibility requirements for the guided UI; copy stays in UX and copy | Experience maintainer |
| [UI verification](ui-verification.md) | Dated toolkit/browser/ImageMagick readiness, rendered screenshots, drift and accessibility evidence and gaps for the guided UI prototype | Experience maintainer |
| [Evidence policy](evidence-policy.md) | Provenance, independence, freshness, source permission and correction rules | Evidence maintainer |
| [Operations](operations.md) | Required budget/cancellation, credentials, restart/backup/retention and local limits | Operations maintainer |
| [Evaluation](evaluation.md) | Sole numerical workload/threshold owner, rubrics, denominators, fixture measurements and remaining evaluation | Evaluation maintainer |
| [References](references.md) | Dated inventory/classification, actual source inspection, licensing/freshness limits | Architecture maintainer |
| [Shared vocabulary](../CONTEXT.md) | Settled domain meanings only | Every contributor before naming |
| [Agent guide](../AGENTS.md) | Repository working instructions and actual toolchain status | Repository maintainer |

No ADR currently qualifies: the explicitly limited local pilot is reversible, so its decision/rationale stays in the ledger and architecture. Create numbered, immutable accepted ADRs only for genuinely hard-to-reverse, surprising tradeoffs; supersede rather than rewrite.

## Exploratory archive — preserved, not canonical

[The brainstorming index](brainstorming/README.md) and its nine topic files remain unchanged as the ten-file exploratory archive. Their references to open choices and unvalidated benchmarks describe that historical exploration, not today's decision state. They are not hidden requirements or an implementation specification. Current canonical owners above take precedence; retain advanced vision as explicitly deferred scope rather than copying it into the pilot.

Additional implementation owners: [foundation verification](foundation-verification.md) owns dated local evidence and gaps; [storage administration](storage-administration.md) owns trusted artifact API details (its handoff test status is historical).

## Six-criterion documentation audit (original scope, updated status)

| Phase criterion | Exact owning evidence | Conclusion and limit |
| --- | --- | --- |
| Audience, geography, income needs, complete journey; stage 3/enterprise deferred | [Product: Audience and income needs](product.md#audience-and-income-needs), [Complete bounded journey](product.md#complete-bounded-journey), [Stage-3 extension and non-goals](product.md#stage-3-extension-and-non-goals) | Documented; US audience explicitly agreed. Customer acquisition remains an uncertain real-world outcome |
| Modular architecture and shared use cases | [Architecture: Owned modules and dependency direction](architecture.md#owned-modules-and-dependency-direction), [Shared flow and interface equivalence](architecture.md#shared-flow-and-interface-equivalence), [Contracts](contracts.md#shared-use-cases) | Fixture domain/core, SQLite and CLI/MCP implemented; browser and live flows remain future |
| Initial delivery/stack, required ggframework, measured justification for Rust/databases | [Architecture: Delivery and stack](architecture.md#delivery-and-stack), [Framework seam](architecture.md#framework-seam-actual-source-inspection), [Decision D2](decisions.md#accepted-decisions) | Delivery agreed; registry/runtime pins selected and fixture paths exercised. Launcher/release distribution remain gates |
| Linked maintained documentation and preserved exploratory archive | [Canonical owners](#canonical-owners-and-navigation), [archive notice](#exploratory-archive--preserved-not-canonical) | All requested topics have an owner; archive is historical rather than rewritten |
| Dated register covering all tagged repositories with honest provenance/license/status | [References: Tagged inventory](references.md#tagged-inventory--exactly-30-entries), [Narrow inspected source patterns](references.md#narrow-inspected-source-patterns), [extra references](references.md#required-framework-and-historical-references) | All 30 classified; three narrow implementation patterns inspected. Candidate status, unknown rights and snapshot limits remain explicit |
| Agreed numerical acceptance before implementation; payment plans distinct from business stages | [Evaluation: Accepted targets](evaluation.md#accepted-targets), [Approval provenance](decisions.md#approval-provenance), [Product: Commercial boundary](product.md#commercial-boundary), [Vocabulary](../CONTEXT.md) | Targets unchanged; fixture retrieval measured with partial-workload limits. Product quality/usability/live economics unverified; no payment-plan approval |

## Verification boundary and remaining gates

The original documentation audit is distinct from the subsequent approved foundation work. Application build/tests, boundary checks and fixture reports now exist. Windows/Linux CI is configured with pinned actions and runtime. Hosted CI run `36033459408` passed for `70bc885` on ubuntu-latest and windows-latest; this supersedes the earlier 2026-09-19 statement that no hosted run existed. No local Linux run is claimed. This documentation-only reconciliation does not rerun tests; [verification](foundation-verification.md) identifies parent-reported execution evidence.

Remaining implementation gates are in [the decision ledger](decisions.md#open-gates-and-deferred-decisions): UI/launcher/platform support and release notices, permitted providers/sources with known prices, real-data retention/encryption/freshness policies and later pricing. Real-user work also needs the actual security, durability, privacy/legal, accessibility, budget and performance verification described in [operations](operations.md#future-verification-gates) and [evaluation](evaluation.md). Fixture tests establish only their declared local scope, not those broader release obligations. The GG Coder host smoke test passed on 2026-09-26 on the developer machine, with trust limited to this project. This supersedes the earlier note that registration was dismissed. The foundation phase is Done for synthetic-fixture scope only.

Roadmap lifecycle state is owned by the host Roadmap, not this file. A completed documentation audit is not itself a release, product validation or automatic permission to mark a phase Done.

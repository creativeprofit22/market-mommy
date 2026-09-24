# Modular architecture

Status: delivery/stack accepted; the approved shared-core foundation is implemented locally for synthetic fixtures (2026-09-19). The browser product, launcher and live research/advice remain future requirements. See [decisions](decisions.md), [contracts](contracts.md), and source provenance in [references](references.md#required-framework-and-historical-references).

## Delivery and stack

Use one single-user local modular application: guided browser UI → Node application core → local SQLite. TypeScript-first keeps contracts and adapters near ggframework. An approachable launcher must start the local service, open the UI, explain setup failures and stop owned processes; exact packaging and supported platforms remain open. A developer CLI alone is not beginner delivery.

This avoids hosted tenancy, remote database operations and a second desktop shell while testing the product's usefulness. Tradeoffs: the computer must be running; local backups and device security matter; remote monitoring and multi-device access are absent. Localhost is not automatically secure. Bind only to loopback and enforce browser-origin/session protections before real use. Hosted operation is a separate tenancy, privacy, deployment and concurrency decision, not a configuration toggle.

SQLite is implemented through Node 24.21.0's built-in `node:sqlite`, behind an asynchronous owned worker, with checksummed migrations 001–005. Its release-candidate API maturity remains a risk. Start with ordinary indexed retrieval; Rust, extra databases, semantic retrieval and graph services need a measured bottleneck and demonstrated benefit. Runtime and package pins are selected in the manifest/lockfile; UI framework and launcher remain open. ggframework is required; TypeSafe, scraping vendors, workflow platforms and reference repositories are not.

## Owned modules and dependency direction

```text
UI / CLI / GG Coder adapters
             ↓
shared application use cases → domain contracts and rules
             ↓ inward-owned ports
storage / collection / model / ggframework adapters implement ports

composition root wires implementations; domain never imports adapters
```

| Owner | Responsibility | Must not own |
| --- | --- | --- |
| Business profile | Constraints, unknowns, stage correction, profile versions | Vendor prompts, payment plans |
| Evidence | Observations, provenance, independent origins, freshness and correction dependencies | Business recommendations disguised as facts |
| Recommendations | Fit, assumptions, counterevidence, versioned advice and abstention | Provider permissions or source collection |
| Experiments | Original test conditions, actions and distinct outcome events | Rewriting original hypotheses after results |
| Workflow control | Durable Journey progression, job membership, cumulative accounting/workload references, job state, cancellation, cost reservation, retries, deadlines, idempotency | Delegating permissions or money limits to a model |
| Storage adapter | Transactional persistence/retrieval through inward-owned repositories | Domain rules or UI-specific records |
| Provider adapters | Validated normalized collection/model results, usage and failure details | Direct UI access, arbitrary destinations selected by source text |
| ggframework adapter | Narrow bounded interpretation, tools and event translation | Durable business truth or unrestricted coding tools |
| UI/CLI/GG Coder adapters | Validate transport input, invoke shared use cases, present results | Alternative recommendation logic or bypassing gates |
| Composition root | Configure approved implementations and limits | Domain decisions hidden in interface wiring |

Domain modules exchange identifiers/versioned contracts, not each other's storage tables. Application use cases coordinate modules and enforce command permissions. Repository, collector, reasoner, clock/ID and cost-meter ports are owned inward. Storage and vendor SDK dependencies point inward through those ports. No domain import from GG Coder internals or a vendor SDK.

## Shared flow and interface equivalence

The full product requires all entry points to invoke the same `saveProfile`, `collectEvidence`, `recommendDirections`, `prepareOffer`, `startExperiment`, `recordOutcome`, `resumeJourney`, and `cancelJob` use cases. A scoped GG Coder tool calls this API through an owned adapter rather than importing the entire coding-agent session. A future process transport may wrap the CLI using an argument array, not a shell command constructed from model text.

All interfaces follow the canonical [Journey identity and accounting contract](contracts.md#journey-identity-and-accounting): journey-scoped commands/results carry an explicit `journeyId`; profile-only resume requires explicit journey selection, never a latest/active default. Jobs, attempts, saved progress, selected experiment and cumulative accounting resolve through that same Journey regardless of interface.

Flow: validate request and local session → resolve Journey/version and matching profile/version → enforce job/source/budget policy → retrieve suitable existing evidence → collect only approved gaps → normalize and persist observations → interpret bounded evidence → validate structured recommendations and deterministic economics → persist versioned result → present next action → capture human-run experiment outcomes. A profile correction can reinterpret existing evidence without mandatory recollection.

Equivalent validated input, evidence snapshot and policy must yield equivalent persisted state, permission decisions and result envelopes on all interfaces. Presentation may differ, and live model wording need not be byte-identical. Implemented CLI/MCP fixture checks compare persisted result IDs, versions, statuses and errors; no browser or actual GG Coder host equivalence has been verified. UI navigation and CLI exit codes must not turn a partial job into a successful full collection.

## Framework seam: actual source inspection

Checked 2026-09-18 at `E:/Projects/gg-framework-fork`, HEAD `03784732521ae3f1bf7c7ce4526549b481c88a15`, origin `creativeprofit22/gg-framework`. The checkout is dirty in unrelated app/core files and instructions; it is not a verified clean release. The inspected agent and tool files listed below were not shown modified by `git status`. Nothing in the framework was changed.

- `packages/gg-agent/package.json`: package metadata identifies `@kenkaiiii/gg-agent` 5.60.3; exports point at built `dist/index` ESM/CJS and declarations. Dependencies include workspace `gg-ai` and Zod. Package repository metadata points at `kenkaiiii/gg-framework`, not the local fork origin. This is not proof of registry equivalence or a selected distribution artifact.
- `packages/gg-agent/src/index.ts:1–42`: exports `Agent`, `AgentStream`, `agentLoop`, `AgentTool`, `ToolContext`, `AgentOptions`, result/event types. Use an owned wrapper over this public package surface rather than internal files.
- `types.ts:286–404`: provider/model/tools, `signal`, turn/token and tool-result limits, continuations and turn-extension callback are exposed. Set explicit limits and disable turn extensions in the bounded product. Tokens are not a currency budget.
- `agent-loop.ts:1710–1744`: host-granted extensions can raise the effective turn budget. `1880–1927` parses tool input and combines caller cancellation with tool timeout; a zero timeout disables that tool deadline. Cancellation still depends on cooperative execution. Neither path establishes durable restart recovery or a whole-job monetary ceiling.
- `packages/ggcoder/src/tools/steroids.ts:196–248` demonstrates `AgentTool` schema/execute integration and cancellation passed to bounded `execFile` argv execution. `tools/index.ts:275–277` registers it when the binary is present. This is a source pattern, not a published plugin guarantee or permission to edit GG Coder now.

This paragraph's fork inspection is historical. The approved foundation now uses exact registry artifacts reviewed in [foundation verification](foundation-verification.md#step-1--runtime-and-dependency-review-2026-09-19), not an installation of the local fork. Required public seams were checked and exercised; whole-fork equivalence is not claimed. Host registration and redistribution rights remain separate gates. Root LICENSE and agent metadata say MIT; retain required notices if reused and inspect transitive/file-specific terms first.

## Failure ownership

Workflow persists intent before external execution and result before presenting completion. Uncertain external completion becomes reconciliation-required, never automatic paid replay. Storage failure must not return a saved-success result. Provider errors, rejected access, absent/stale evidence, partial collection, cancellation and budget exhaustion retain distinct statuses through every adapter. [Contracts](contracts.md#failure-contract) define results; [operations](operations.md) defines required enforcement and recovery. The live-provider aspects remain requirements; fixture persistence, cancellation, reconciliation and failure paths have local tests documented in [foundation verification](foundation-verification.md).

## Implemented foundation layout

`src/domain` owns strict records and invariants; `src/application` owns commands, authorization, dispatch and storage/workflow/administration ports. `src/adapters/sqlite` implements these ports in one owning worker, with durable receipts, versions, dependencies, fenced claims, ledger and removal history. `src/adapters/ggframework` runs the installed framework in an owned child against `src/adapters/providers`' scripted loopback fixture; live selection fails closed. CLI and MCP use `src/composition.ts` and the same worker dispatch. No UI, shell tool, generic SQL tool or browser listener exists.

`enqueueJob` only persists work. Trusted composition explicitly calls `runNextFixture(storage, options)`; neither transport starts a runner automatically. Its optional `signal`, scripted `scenario` and `onProgress` observer are trusted API options, never model arguments. `onProgress` reports `worker-ready` / `provider-request` readiness, not business progress. Backup/export/import/removal and reconciliation are trusted worker APIs, not agent tools; see [operations](operations.md#implemented-fixture-administration). Boundary checks prohibit inward transport/framework/SQL imports; no Rust, graph/vector service or workflow-platform dependency was added.

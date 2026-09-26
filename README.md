# Market Mommy — developer foundation

A local, single-user TypeScript/SQLite **synthetic-fixture foundation**, not a completed market-advice product. Shared records, durable workflow, CLI and MCP are implemented; live research/advice, beginner browser UI and approachable launcher are not. The phase remains in progress. No live calls, real customer data, outreach, payments or release are authorized.

Start with [documentation ownership](docs/README.md), [contracts](docs/contracts.md) and [verification / remaining gates](docs/foundation-verification.md). Read [CONTEXT.md](CONTEXT.md) before naming domain concepts.

## Developer setup

Use **Node 24.21.0 exactly**, as pinned in `.node-version` and `package.json`. Select it for this project/shell without changing other projects' defaults (for an existing fnm installation: `fnm use 24.21.0`). Check `node --version` before continuing; do not silently install a different runtime. Node's built-in SQLite API maturity remains a documented risk.

```sh
npm ci --ignore-scripts
npm run build
npm run typecheck
npm test
npm run check:boundaries
npm run report:foundation
```

Dependencies are exact and locked; lifecycle scripts stay disabled. Tests use Node's runner over compiled tests (`npm test` also builds). The report builds and exercises disposable synthetic stores, cold/warm retrieval, cancellation resources and recovery. See [evaluation](docs/evaluation.md) for canonical targets and partial-workload limits, not a product performance promise. Local verification was Windows-only; configured Windows/Linux CI has no claimed hosted result. Redistribution remains gated on complete zstd wrapper/WASM notices.

## CLI: synthetic save and resume

Build first. Supply absolute executable, compiled script and local store paths; these placeholders must be replaced. Windows paths may use `E:/...`; POSIX paths start with `/`. No reliance on the caller's working directory:

```sh
/absolute/node-24.21.0/bin/node /absolute/market-mommy/dist/src/interfaces/cli.js --store /absolute/fixtures.sqlite --capabilities read,fixture-write < /absolute/save-profile.json
```

For a first synthetic record, `save-profile.json` contains:

```json
{"action":"saveProfile","requestId":"save-demo-1","expectedVersion":0,"profileId":"profile-demo","profile":{"stage":"finding-direction","skills":["synthetic writing fixture"],"deliverability":null,"reachableBuyers":[],"geography":"US","availableHoursPerWeek":null,"incomeNeed":null,"incomeDeadline":null,"spendingTolerance":null,"preferences":[],"qualifications":[],"unknowns":["synthetic example only"]}}
```

Then send each following document in a separate CLI invocation through stdin ending at EOF, using the same store and trusted write scope:

```json
{"action":"createJourney","requestId":"journey-demo-1","expectedVersion":0,"journeyId":"journey-demo","profileId":"profile-demo","profileVersion":1,"priorLearning":[]}
```

```json
{"action":"resumeJourney","journeyId":"journey-demo"}
```

Resume needs only the default `read` capability. Keep the explicit Journey ID; the application never guesses the latest Journey from a profile. These are developer instructions for synthetic save/resume, **not beginner product delivery or business advice**. Matching write requests replay saved receipts; changed payloads require new request IDs and appropriate expected versions. Removal intentionally blocks old receipts rather than returning removed data.

CLI consumes one bounded JSON document and emits one shared result envelope, with exit 0 on success / 1 on error. Startup capabilities are OS-owner grants, never request fields; an explicit list replaces the default `read`. Read-only is domain authorization, not a SQLite read-only connection: opening can create/migrate the selected store. See [interface details](examples/README.md) and [current verification](docs/foundation-verification.md).

## MCP: explicit host permission required

```text
/absolute/node-24.21.0/bin/node /absolute/market-mommy/dist/src/interfaces/mcp.js --store /absolute/fixtures.sqlite --capabilities read
```

[examples/gg-coder-mcp.json](examples/gg-coder-mcp.json) is an **inert, disabled configuration object**, not an installed server. Replace all paths with absolute paths only after explicit host-registration approval; retain `shared: false`. Prefer the direct Node/script launch for STDIO, not npm diagnostics. Never copy credentials or inherited environment into configuration. No automatic registration occurs. An authorized developer-machine registration passed a [read-only host smoke test](docs/foundation-verification.md#gg-coder-host-smoke-test-2026-09-26); local MCP SDK protocol tests alone are not an actual-host result.

To register on a developer machine (explicit approval only), see [Registering with GG Coder](examples/README.md#registering-with-gg-coder-developer-machine-explicit-approval-only).

MCP exposes the same strict command actions without `action` in tool arguments; startup store/grants cannot be changed by a tool. No shell, generic SQL, unrestricted filesystem, provider destination, credential or administrative tool exists. `collectEvidence`, `recommendDirections` and `prepareOffer` fail with typed unavailable/policy-denied results rather than inventing advice.

## Explicit execution and trusted administration

`enqueueJob` **does not run automatically**. A trusted composition caller with owned storage explicitly invokes `runNextFixture(storage, options)` from `dist/src/adapters/ggframework/runner.js`. The store must have fixed **`read` + `fixture-run`** launch grants: the runner checks read authority through the nonmutating `info()` port before claiming, and claim separately enforces `fixture-run`. Insufficient scope rejects with typed `unauthorized` before changing the queued attempt or reservation or launching a child/provider. Options include a scripted `scenario`, `signal` and optional `onProgress(event)` callback for `worker-ready` / `provider-request`. These are trusted API inputs/observations, not model arguments or CLI runner flags. The installed framework runs only against the owned synthetic fixture endpoint; live paths are absent/denied.

Backup/export/import, restore, fixture removal and removal-ledger reapplication use trusted `SqliteStorage.administer`, not CLI/MCP agent tools. See [operations](docs/operations.md#implemented-fixture-administration) and [administration request shapes](docs/storage-administration.md). Restore/import exclusively create new destinations and require the authoritative removal ledger. Removal conservatively redacts transitive dependent payloads and sanitizes/blocks all saved request results while preserving used keys, accounting and workload identities. It is not secure erasure; real-data retention, encryption and release policy remain deferred.

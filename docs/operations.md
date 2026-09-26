# Operational requirements for the local pilot

Status: fixture-only runtime controls, backup/export/import, removal recovery and local tests are implemented. The broader live/product requirements below remain binding; no security certification, real-data policy or release is implied. Limits are owned by [evaluation](evaluation.md); states by [contracts](contracts.md); delivery by [architecture](architecture.md).

## Workflow and spending ownership

Application workflow control, not the model, owns job scope, source approval, total deadline, retries, concurrency, cancellation and cost. The canonical [Journey identity and accounting contract](contracts.md#journey-identity-and-accounting) binds every reservation, charge, workload entry and saved step to an immutable `journeyId` through job/attempt references; profile correction and interface selection cannot create a fresh allowance. A separately approved later Journey leaves all old charges and uncertain requests with their original Journey. Before execution, resolve the approved provider/model price schedule and a conservative maximum for the call; reserve that amount against both run and journey allowance. Account for input/output, collection, server-side tools, retries and currency conversion where applicable. Record estimated, reserved, actual and uncertain cost separately. No known bound or price means no live call, not permission to try and inspect the bill afterward.

Release reservations only after reconciliation; maintain them when external billing/completion is uncertain. A retry, restart or alternate interface cannot reset the journey allowance. Provider-side caps/usage reconciliation may be needed where charges are asynchronous. If a hard cap cannot be guaranteed, disable that live path until the mechanism or an explicitly revised policy is agreed. A token ceiling and abort signal do not prove a dollar ceiling. Support, storage and review are reported separately as full operating costs.

Only allowlisted narrow research tools reach ggframework. Set explicit turn, token, output and tool limits, disable automatic turn extensions, and enforce an overall deadline outside individual tools. Exact internal settings must be calibrated inside accepted workload/latency/cost bounds before live execution; no unlimited default or zero-deadline escape. Prefer serial bounded work in the pilot and justified queueing over uncontrolled fan-out. Reuse suitable local evidence before another network request.

## Cancellation and restart

Propagate cancellation to the framework and every owned I/O operation. Stop new work immediately; persist partial validated evidence and cancellation state. Confirm whether providers can actually cancel an already accepted request; do not promise charge reversal. Cleanup timers, streams, child processes and temporary resources by ownership, not broad process killing.

Persist intent/request identity before an external call and durable result before UI success. Recovery loads the explicitly selected Journey and its linked job/attempt state independently of chat history, using the same [resume contract](contracts.md#shared-use-cases) in UI, CLI and GG Coder. Reconcile external request IDs before retrying uncertain actions; never replay a payment-causing operation merely because its result was not saved. Use idempotency where the provider supports it, but do not claim exactly-once external execution without evidence. Retried attempts link to the original job and remaining journey allowance.

## Local data, backup and recovery

Implemented fixture persistence uses transactional writes, version checks and checksum-tracked forward migrations. Do not overwrite newer corrections. Prepare a backup before schema changes, validate recovery on a copy, and retain rollback options; the owning worker creates/migrates local stores and refuses incompatible or changed applied migrations.

Provide user-controlled export and a documented local backup/restore process. SQLite backups must be consistent with transactional/WAL behavior, not an arbitrary copy of an active main file. Exclude credentials from ordinary exports; protect local files and backups against unauthorized access. Report last successful backup and restore validation, not just backup intent. Test restart, interrupted write, duplicate request, correction and restore against representative records before real-user delivery.

Synthetic fixtures persist until explicit trusted removal; no real-data retention duration is selected yet. Before storing real data, define per-source retention, user correction/deletion, backup expiry and restore-time reapplication of removals. Keep only necessary records, make the limits understandable, and avoid collecting buyer identities by default. Local storage is neither automatically encrypted nor protected from a compromised device. User data must not be silently lost when closing the browser or updating the application.

## Credentials, browser and outbound boundaries

Keep provider credentials in a protected server-side store, outside prompts, frontend bundles, source control, exports and ordinary logs. Retrieve them only inside approved adapters. Do not grant an agent unrestricted environment, filesystem, shell or credential access. Never ask users to paste keys into normal conversation history.

Loopback service must reject unauthorized origins/requests and enforce a local session boundary; no network-wide bind. Validate paths/import sizes and source destinations including redirects; block local/private infrastructure access from externally supplied destinations except explicitly owned application transport. Provider/source configuration is selected by trusted policy, not model text. Validate source content and structured outputs before persistence or rendering. No automatic outreach, publishing or purchase tools in the initial contract.

## Diagnostics and support

Log job/result IDs, timings, usage, policy decisions and safe failure categories. Do not log secrets or raw sensitive evidence by default; fixture sentinel tests cover prompt/tool/result/error/export/worker boundaries; real-data security review remains later. Distinguish timeout, access rejection, partial work, storage failure and uncertain billing. Preserve enough version/fixture context for reproducibility without retaining prohibited source text.

An approachable launcher, named supported environment and beginner setup/shutdown instructions are release prerequisites; those are not delivered here. The root [developer setup](../README.md) covers only the fixture foundation. Offline use can show saved progress but cannot fabricate fresh research. There is no hosted monitoring while the computer is off, multi-user isolation, unattended scheduling or subscription billing.

## Implemented fixture administration

The trusted async `SqliteStorage.administer(request)` worker port exposes `backup`, `export`, `exportRemovalLedger`, `removeFixtures`, `reapplyRemovalLedger`, `import` and `restoreBackup`. These are not CLI commands, MCP tools or model permissions. Startup `read` grants backup/export; `fixture-write` grants destructive fixture operations and new-destination recovery. Exact request/result fields and artifact bounds are in [storage administration](storage-administration.md); its original handoff verification paragraph is historical, superseded by [current evidence](foundation-verification.md#steps-9–11--storage-verification-and-documentation).

Backup uses SQLite's backup API, not a raw WAL main-file copy. Export carries validated semantic tables. Restore requires the returned backup checksum and a separately supplied authoritative removal ledger; import also requires that ledger, even empty. Both exclusively create a new destination, validate integrity/references/checksums and never overwrite the current store. Checksums detect corruption, not authenticity or globally newest ledger selection. The trusted administrator must retain/select the latest removal artifact outside old backups. Recovery carries accounting and uncertain job states forward without executing jobs.

Removal conservatively redacts content transitively through dependencies and hides removed records from domain reads. It sanitizes **all existing** saved request/worker results and framework outputs, not only apparently related receipts; used request keys remain permanently reserved/blocked. Accounting, attempts, workload membership and version identities survive. Removed-input jobs cannot settle new content. This is not secure erasure: free pages and old artifacts may retain bytes. Real-data retention, encryption/key storage, backup expiry and legal deletion policy remain deferred gates.

The bounded fixture runner is explicit trusted composition, never automatic on enqueue. Cancellation propagates to the owned framework child and fixture endpoint with finite teardown; normal success awaits child exit within the deadline before forced cleanup. `onProgress` readiness callbacks are trust-only observability, not model parameters. Fixture zero-cost settlement cannot establish a live monetary cap. No credential store or paid-provider adapter exists.

## GG Coder host smoke test (manual, fixture-only)

This re-verifies that a real GG Coder host can read, but not write, a synthetic fixture store. Host registration needs explicit user approval; see `examples/README.md` for trust and settings details. The host call is manual; only the preparation script and its test run in CI.

1. **Prepare the store.** With pinned Node 24.21.0, run `npm run build`, then `node scripts/prepare-host-smoke.mjs --dir <absolute directory>`. It refuses to overwrite an existing `fixtures.sqlite` or `expected-resume.json`. It saves synthetic profile `HOST-P` and Journey `HOST-J`, writes the `resumeJourney` result to `expected-resume.json`, cross-checks it against the real read-only CLI, and prints the store's sha256 plus the exact `.gg/mcp.json` entry (absolute Node path, `mcp.js`, `--store`, `--capabilities read`).
2. **Register.** Add the printed entry to the git-ignored project `.gg/mcp.json`. Trust only this project through the host's per-project `trustedProjects`; keep global project-MCP trust off. Back up host settings first. Never commit `.gg/`.
3. **Restart** the host session so it loads the entry.
4. **Read.** Through the host, call `resumeJourney` with `journeyId: "HOST-J"`. The returned envelope must deep-equal `expected-resume.json`.
5. **Write is refused.** Call a write tool such as `saveProfile`. It must return error code `unauthorized`.
6. **Store unchanged.** After the host session, the sha256 of `fixtures.sqlite` must equal the value the script printed.

Record the date, host identity, commit and results in `docs/foundation-verification.md`. A passed run is evidence for that host and commit only.

## Future verification gates

Before real use: security review and adversarial boundary tests; backup/restore and migration checks; provider/source rights and data-handling review; performance and budget measurement under the agreed workload; consented beginner usability/accessibility checks. Relevant security, durability, legal/privacy and performance specialists are required when later work enters that scope. Documentation does not certify any of these controls or authorize live costs.

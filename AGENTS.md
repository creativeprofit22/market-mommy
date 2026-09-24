# Coding agent guide

- Read CONTEXT.md before naming anything.
- Start with `docs/README.md` for canonical document ownership and decision status. `docs/brainstorming/` is a preserved exploratory archive, not the current contract. Foundation implementation is authorized by the approved shared-core plan; design documents alone do not authorize further scope. Preserve the distinction between accepted, proposed, open, and later decisions.
- Stack: one npm package, strict TypeScript/ESM, Node 24.21.0 pinned in `.node-version`. Install with `npm ci --ignore-scripts`. Dependencies are exact and locked; lifecycle scripts stay disabled. Use the pinned runtime without changing other projects' defaults.
- Build: `npm run build`. Typecheck: `npm run typecheck`. Test: `npm test` (Node test runner over compiled tests). Architecture: `npm run check:boundaries`. Fixture measurements: `npm run report:foundation`. No formatter/linter dependency. Current evidence and gaps: `docs/foundation-verification.md`.
- CI lives in `.github/workflows/ci.yml` and must stay green. It now configures pinned Windows/Linux foundation checks. Local Windows verification is recorded; no hosted run or Linux test result is claimed.
- Foundation scope is synthetic fixtures only, not completed market advice or beginner delivery. Preserve original design requirements/manual Journey traces and the brainstorming archive. UI/launcher, live providers and real-data/release gates remain later; phase is in progress.
- Enqueue does not autoexecute: `runNextFixture` and its `onProgress` observer are trusted composition APIs, not model arguments. Backup/export/import/removal-ledger/reconciliation APIs are trusted worker administration, never agent tools. Fixture removal blocks/sanitizes all saved request results while retaining reserved keys, accounting and workload identities.
- Never auto-register MCP. The example is inert/disabled; host permission was requested but dismissed, settings unchanged and actual host smoke test unverified.
- Never commit with `--no-verify`.
- Never commit secrets, local environment files, or `.gg/` agent state.

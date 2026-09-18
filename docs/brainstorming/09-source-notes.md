# Source notes

These notes record evidence used during the preceding brainstorming, not a fresh runtime verification. Local code can change; recheck relevant contracts before implementation. Documentation claims about delivered features or performance are not independent verification.

## Local sources inspected

### ggframework

Root: `E:/Projects/gg-framework-fork`.

- `AGENTS.md`: package ownership and architecture context.
- `packages/gg-agent/src/types.ts`: tool and agent options, budgets, deadlines, cancellation, and execution hints.
- `packages/gg-agent/src/agent-loop.ts`: bounded tool-batch execution options inspected through symbol search.
- `packages/ggcoder/src/tools/steroids.ts`: structured tool contract, argv construction, output budgeting, and compact retrieval integration.
- `packages/ggcoder/src/core/steroids.ts`: CLI discovery, probing, and integration context.

These support reuse hypotheses. They do not establish that a market-intelligence workflow already exists or that unrestricted coding capabilities should be exposed to it.

### Linkgo

Root: `E:/Projects/linkgo`.

- `AGENTS.md` and `README.md`: architecture boundaries, approval rules, documented features and limitations.
- `src/agent/messages.ts`: research, score, draft, audit, approve, schedule, and measure workflow goals.
- `src/features/drafts/data.ts`: bounded drafting reference context and intent-related inputs.

The README describes policy-enforced local JSON intake and excludes an approved production source connector at the inspected point. Do not treat this as an available scraping integration. Its workflow boundaries are the relevant inspiration.

### Steroids

Local checkout inspected: `E:/Projects/agent-steroids-download-fix`.

- `AGENTS.md`, `README.md`.
- `src/index.rs`: compact trigram candidate indexing and incremental-indexing patterns.
- GG Coder integration files listed above.

This was a local checkout, not a claim about the latest upstream revision. Its referenced `CLAUDE.md` was not present at the inspected path. The README identifies AGPL licensing; licensing rights require confirmation before implementation reuse.

No saved repository corpus was explored for this brainstorming. README timing claims were not benchmarked.

## External documentation read

- [TypeSafe introduction](https://docs.typesafe.ai/introduction): Choice, Score, Noul, and atomic structured questions.
- [TypeSafe confidence](https://docs.typesafe.ai/confidence): confidence derived from answer distributions and domain-specific thresholding.
- [TypeSafe build guidance](https://docs.typesafe.ai/concepts/how-to-build-with-system-one): retrieval was partially obstructed by embedded page code; do not treat it as a fully reviewed source.
- [Bright Data asynchronous requests](https://docs.brightdata.com/api-reference/rest-api/scraper/asynchronous-requests): asynchronous collection, snapshot identifier, and selected output fields; retrieved documentation was partial.
- [Apify webhook integration](https://docs.apify.com/integrations/webhooks): event-triggered HTTP notifications.

## What was not validated

- Live provider behavior, pricing, quotas, source rights, or coverage.
- TypeSafe accuracy, calibration, latency, or comparative cost on this workload.
- Rust versus TypeScript performance for the proposed product.
- Native integration, packaging, hosted operation, or multi-user isolation.
- Commercial demand, willingness to pay, or income outcomes.
- A security, privacy, legal, or licensing audit.

The brainstorming consists of source-informed recommendations and open hypotheses. None of the above gaps should be silently converted into validated assumptions during implementation.

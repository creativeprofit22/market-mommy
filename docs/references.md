# Dated reference register

Owner: architecture maintainer. Checked **2026-09-18**. The historical tagged references below are patterns to evaluate, not adopted dependencies. Separately approved registry foundation dependencies are recorded in the dated addendum below. [Decisions](decisions.md) owns adoption gates.

## Foundation dependency addendum — 2026-09-19

The approved foundation selects Node 24.21.0 with built-in `node:sqlite`; exact installed registry pins are `@kenkaiiii/gg-agent@5.60.3`, `@kenkaiiii/gg-ai@5.60.3`, `@modelcontextprotocol/sdk@1.30.0`, `zod@4.5.4`, `typescript@6.0.3` and `@types/node@24.12.0`. Manifest/lockfile preserve versions/integrities. [Foundation verification](foundation-verification.md#step-1--runtime-and-dependency-review-2026-09-19) records archive, lifecycle-script, API and license review; scripts remain disabled. Public framework execution and MCP protocol paths were locally tested, not merely inferred from README claims. Registry artifacts are not asserted equivalent to the whole local fork; the older fork inspection below remains historical evidence.

`standardwebhooks`' library notice was located at its reported gitHead. `@bokuweb/zstd-wasm@0.0.27` still lacks complete wrapper/WASM notices/provenance: its declared MIT metadata permits no claim that redistribution review is complete. Resolve that gate before redistribution. No reference inventory row becomes adopted merely because a related pattern was inspected; no Rust, DBOS, graph/vector service or scraping vendor was added.

CI now pins `actions/checkout` at `3d3c42e5aac5ba805825da76410c181273ba90b1` and `actions/setup-node` at `249970729cb0ef3589644e2896645e5dc5ba9c38`; parent verification checked their GitHub refs on 2026-09-19. This is ref provenance, not a hosted CI result or Linux execution evidence.

## Method, dates and reuse limits

`steroids repos --tag market-mommy` returned exactly the 30 identities below. **I** is the inventory observation date, not a commit/index freshness guarantee; **C** is this review's check date. All rows have I/C = 2026-09-18 / 2026-09-18. Inventory did not establish upstream freshness. Corpus source snapshots and current GitHub README/license responses may describe different revisions.

Read README introductions and available license headers/exception clauses through GitHub's read-only API; no install snippets were executed. `R` means `README.md` and its Git blob prefix; `L` gives the actual license filename and blob prefix. **Blob identities are file-content hashes, not commit revisions.** Candidate rows have no inspected implementation commit; do not manufacture one from a blob. Root-license excerpts establish only the reported terms, not a full dependency/file-level legal audit. Full applicable licenses, notices, exceptions and dependencies must be reviewed before reuse.

- **Now:** inspect a narrow source pattern for this design; not adoption.
- **Later:** plausible future reference after a demonstrated need; implementation candidate-only.
- **Not needed:** no role in this bounded pilot; documentation reviewed only.
- **MIT:** preserve copyright/license notices if reuse is later authorized.
- **Apache-2.0:** review license, NOTICE, attribution/change and patent obligations before reuse.
- **AGPL-3.0:** evaluate copyleft and network source-availability obligations; not interchangeable with MIT.
- **Mixed/custom/MPL:** review exact files and conditions; no blanket permissive claim.
- **Unknown:** no code reuse without establishing permission. An API 404 is unavailable evidence, not proof no license exists anywhere.

No upstream performance, privacy or safety marketing claim is treated as verified behavior. No new repositories were indexed and no implementation was copied.

## Tagged inventory — exactly 30 entries

Dates in every row use `09-18 / 09-18` for I/C in **2026**. `Docs` status means README/license excerpts inspected, implementation remains candidate-only. Source detail keys N1–N3 are below.

| # | Repository / GitHub URL | I / C | Class and relevance/rationale | Inspection identity/path | License evidence and reuse implication |
| --- | --- | --- | --- | --- | --- |
| 1 | [AnotiaWang/deep-research-web-ui](https://github.com/AnotiaWang/deep-research-web-ui) | 09-18 / 09-18 | Now — evidence excerpts, relevance and unknown dates; not a full research UI adoption | Source N1; R `18b8f621`; implementation commit `d981f9cffda09fcd2b4403b8e56b4f5a857e4bc5` | License endpoint 404; root listing showed no license file. Unknown: no code reuse |
| 2 | [Helicone/helicone](https://github.com/Helicone/helicone) | 09-18 / 09-18 | Later — gateway/LLM observability if local usage logs prove insufficient | Docs; R `0bfc4616`; L `LICENSE` `4a1ada09` | Apache-2.0 header; apply Apache review, not automatic gateway adoption |
| 3 | [Openpanel-dev/openpanel](https://github.com/Openpanel-dev/openpanel) | 09-18 / 09-18 | Later — web/product analytics after consent and real usage, not needed for local fixtures | Docs; R `4a4c56bf`; L `LICENSE.md` `0ad25db4` | AGPL-3.0; copyleft/network review |
| 4 | [QuintinShaw/pi-dynamic-workflows](https://github.com/QuintinShaw/pi-dynamic-workflows) | 09-18 / 09-18 | Not needed — another agent/workflow ecosystem beyond required ggframework | Docs; R `d1dd5337`; L `LICENSE` `e458607e` | MIT; preserve notices if scope ever changes |
| 5 | [SeekStorm/SeekStorm](https://github.com/SeekStorm/SeekStorm) | 09-18 / 09-18 | Later — search candidate only after measured local retrieval limits | Docs; R `6b4aa546`; L `LICENSE` `3478d851` | Apache-2.0 header; Apache review |
| 6 | [TriliumNext/Trilium](https://github.com/TriliumNext/Trilium) | 09-18 / 09-18 | Not needed — knowledge/note workspace would expand product scope | Docs; R `80b39d44`; L `LICENSE` `dbbe3558` | AGPL-3.0; copyleft/network review |
| 7 | [agentset-ai/agentset](https://github.com/agentset-ai/agentset) | 09-18 / 09-18 | Later — RAG reference only if bounded evidence retrieval outgrows simpler storage | Docs; R `5b692b00`; L `LICENSE.md` `5f95b7e3` | MIT; preserve notices; hosted terms separate |
| 8 | [dzhng/deep-research](https://github.com/dzhng/deep-research) | 09-18 / 09-18 | Now — bounded breadth/depth and failure-handling contrast | Source N2; R `78d7dcaa`; L `LICENSE` `a2c64419`; implementation commit `1f8f3e285bbc23e80b98a66a64effab9069f3ad4` | MIT; preserve notices if reuse authorized |
| 9 | [evidence-dev/evidence](https://github.com/evidence-dev/evidence) | 09-18 / 09-18 | Later — reporting reference when outcome summaries need more than simple history | Docs; R `22ef3a65`; L `LICENSE` `1b8b65fb` | MIT; preserve notices |
| 10 | [google/schema-dts](https://github.com/google/schema-dts) | 09-18 / 09-18 | Later — structured web-data typing if approved sources expose relevant data | Docs; R `fc57a396`; L `LICENSE` `d6456956` | Apache-2.0 header; types do not establish source-data rights |
| 11 | [growthbook/growthbook](https://github.com/growthbook/growthbook) | 09-18 / 09-18 | Later — product experimentation after real traffic, not customer-test infrastructure now | Docs; R `a2401fcb`; L `LICENSE` `0a17616a` | MIT outside listed enterprise directories; enterprise/third-party exceptions. File-specific review |
| 12 | [jina-ai/node-DeepResearch](https://github.com/jina-ai/node-DeepResearch) | 09-18 / 09-18 | Later — iterative search/read/reason comparison; no second engine now | Docs; R `e02e8778`; L `LICENSE` `0db6d6cb` | Apache-2.0 header; external service terms/prices separate |
| 13 | [labring/FastGPT](https://github.com/labring/FastGPT) | 09-18 / 09-18 | Not needed — visual agent platform exceeds bounded modular app | Docs; R `d051be03`; L `LICENSE` `03ba1a33` | Apache-based custom terms include similar multi-tenant SaaS and logo restrictions; no blanket Apache claim |
| 14 | [lancedb/lancedb](https://github.com/lancedb/lancedb) | 09-18 / 09-18 | Later — vector retrieval only after measured need | Docs; R `c8a70780`; L `LICENSE` `7a4a3ea2` | Apache-2.0 header; Apache review |
| 15 | [langgenius/dify](https://github.com/langgenius/dify) | 09-18 / 09-18 | Not needed — alternative application/workflow platform conflicts with small owned core | Docs; R `0b4df324`; L `LICENSE` `329ee302` | Dify Open Source License, Apache-based with extra multi-tenant/branding conditions; exact terms review |
| 16 | [langwatch/langwatch](https://github.com/langwatch/langwatch) | 09-18 / 09-18 | Later — evaluation/tracing if local test records are insufficient | Docs; R `7d7182b3`; L `LICENSE.md` `83629bc5` | Apache-2.0 root; README describes enterprise extension. Inspect selected paths, not root alone |
| 17 | [marmelab/atomic-crm](https://github.com/marmelab/atomic-crm) | 09-18 / 09-18 | Now — small activity/outcome history pattern, not full CRM | Source N3; R `5897a015`; L `LICENSE.md` `7d10cba7`; implementation commit `625c221d1f3adc442298d9a8cea3af02397dc125` | MIT; preserve notices if reuse authorized |
| 18 | [mdSilo/mdSilo-app](https://github.com/mdSilo/mdSilo-app) | 09-18 / 09-18 | Not needed — local writing/knowledge workspace and desktop shell outside initial journey | Docs; R `57f43eaf`; L `LICENSE` `be3f7b28` | AGPL-3.0; copyleft/network review |
| 19 | [meilisearch/meilisearch](https://github.com/meilisearch/meilisearch) | 09-18 / 09-18 | Later — separate search service only after local search measurements | Docs; R `fd6c408f`; L `LICENSE` `edcaeebc` | Root explicitly splits MIT and BUSL-1.1 enterprise portions; review LICENSE-MIT/EE and selected code |
| 20 | [pingcap/autoflow](https://github.com/pingcap/autoflow) | 09-18 / 09-18 | Not needed — graph RAG/TiDB platform beyond pilot | Docs; R `2fd8c020`; L `LICENSE.txt` `f9c890a5` | Apache-2.0 header; Apache review |
| 21 | [qdrant/qdrant](https://github.com/qdrant/qdrant) | 09-18 / 09-18 | Later — vector service only after semantic retrieval need is demonstrated | Docs; R `cf4c1c52`; L `LICENSE` `456fb05e` | Apache-2.0 header; Apache review |
| 22 | [quickwit-oss/tantivy](https://github.com/quickwit-oss/tantivy) | 09-18 / 09-18 | Later — Rust retrieval library only after measured justification | Docs; R `d8098a5e`; L `LICENSE` `7b1fc849`; historical indexed short revision `b91a405e`, not implementation-inspected here | MIT; preserve notices; README benchmarks are not our measurements |
| 23 | [reaviz/reagraph](https://github.com/reaviz/reagraph) | 09-18 / 09-18 | Later — graph visualization for deferred evidence relationships, not ordinary beginner UI | Docs; R `ec57b1c2`; L `LICENSE` `261eeb9e` | Apache-2.0 header; Apache review |
| 24 | [rybbit-io/rybbit](https://github.com/rybbit-io/rybbit) | 09-18 / 09-18 | Later — analytics if later consented product use warrants it | Docs; R `bb647149`; L `LICENSE.md` `b8ddc05f` | AGPL-3.0; privacy marketing is not a compliance finding |
| 25 | [swarmclawai/swarmvault](https://github.com/swarmclawai/swarmvault) | 09-18 / 09-18 | Not needed — wiki/graph/RAG system adds a second knowledge platform | Docs; R `bc7fac7d`; L `LICENSE` `e856c7bc` | MIT; preserve notices |
| 26 | [twentyhq/twenty](https://github.com/twentyhq/twenty) | 09-18 / 09-18 | Not needed — broad customizable CRM exceeds outcome tracking | Docs; R `e6137b5c`; L `LICENSE` `085e0c6b` | Mostly AGPLv3, enterprise-marked files, named MIT packages and application exception; exact-path review |
| 27 | [umami-software/umami](https://github.com/umami-software/umami) | 09-18 / 09-18 | Later — web analytics for a future public product, not local research truth | Docs; R `c641cee3`; L `LICENSE` `eff41369` | MIT; preserve notices; privacy claims need independent review |
| 28 | [valeriansaliou/sonic](https://github.com/valeriansaliou/sonic) | 09-18 / 09-18 | Not needed — extra identifier-search backend duplicates the current retrieval decision | Docs; R `43a3d71a`; L `LICENSE.md` `8d80a210` | MPL-2.0 header; review file-level obligations |
| 29 | [virattt/dexter](https://github.com/virattt/dexter) | 09-18 / 09-18 | Not needed — autonomous financial research is outside first-customer scope | Docs; R `ed1b9350`; root listing inspected | License endpoint 404 and no root license listed; unknown, no code reuse |
| 30 | [xyflow/xyflow](https://github.com/xyflow/xyflow) | 09-18 / 09-18 | Later — node-based UI for deferred graph/workflow needs, not required beginner navigation | Docs; R `116e99c7`; L `LICENSE` `072ff46d` | MIT; preserve notices; paid offerings have separate terms |

## Narrow inspected source patterns

- **N1**, `lib/core/deep-research.ts:247–300`, corpus search literal `evidence`, then source read at row 1's commit: schema/prompt requests evidence-grounded learnings, allows empty results, distinguishes publication/event dates, checks permitted URL references and labels source text untrusted. Useful for evidence contract design; this excerpt is not proof of enforcement or injection resistance. Unknown license prevents code reuse.
- **N2**, `src/deep-research.ts:216–291`, corpus literal search for `pLimit`/`catch`, then read at row 8's commit: concurrency wrapper, shrinking breadth/depth and recursion are visible. Catch returns empty learnings/URLs, so failures can resemble no findings at this boundary. Borrow bounded-work reasoning, not that failure contract; our result must preserve partial/provider-error status. No claim of a global money cap or whole-tree concurrency bound.
- **N3**, `src/components/atomic-crm/activity/ActivityLog.tsx:1–31`, literal `ActivityLog`, then read at row 17's commit: paginated descending-date activity history with company/context filtering. Useful for small outcome-history presentation. Client filters are not authorization evidence, and CRM scope is not adopted.

Current live README/license blobs above do not prove terms at those older source commits. Check the exact revision and any file-specific license before reuse. Source inspection did not execute these projects.

## Required framework and historical references

These additional entries are **outside the 30-tagged inventory**, all checked 2026-09-18. They preserve that historical review; the foundation addendum above supersedes the framework distribution's then-open status.

| Reference | Status, provenance and relevance | Rights/freshness limits |
| --- | --- | --- |
| [ggframework local fork](https://github.com/creativeprofit22/gg-framework) | Required engine. Local HEAD `03784732521ae3f1bf7c7ce4526549b481c88a15`; inspected `packages/gg-agent/package.json`, `src/index.ts`, `src/types.ts:286–404`, `src/agent-loop.ts:1710–1744,1880–1927`, and `packages/ggcoder/src/tools/steroids.ts:196–248`, `tools/index.ts:275–277`. [Architecture](architecture.md#framework-seam-actual-source-inspection) owns API conclusions | Root LICENSE and agent metadata MIT; workspace/transitive review pending. Dirty checkout, not clean release. Package metadata points at a different upstream; exact distribution still open |
| [Linkgo](https://github.com/creativeprofit22/linkgo) | Historical later execution integration, not required product flow. Local HEAD `6443368629499f5d43c100d251423dd354575e76`; README.md:1–29 describes local LinkedIn operations and approval boundaries. No current implementation inspection; README status claims not verified | No LICENSE found by local filename search; rights unknown, no code reuse. Working-tree cleanliness not checked; local ref is not public availability proof |
| [Agent Steroids](https://github.com/KenKaiii/agent-steroids) | Historical coding-research pattern, not a business evidence collector dependency. Local checkout HEAD `79fb437da11eb2aea3fa218bf51549d9299815ec`; README.md:1–40 and LICENSE:1–20 inspected | AGPL-3.0 header, not MIT. No implementation audit or cleanliness check; avoid unreviewed code copying |
| [DBOS Transact](https://github.com/dbos-inc/dbos-transact-ts) | Later durable-workflow candidate only. GitHub README.md blob `bc2084a9` describes Postgres-backed workflows; no implementation commit inspected. Compare checkpoint/idempotency ideas only if owned local workflow becomes insufficient | LICENSE blob `b3d39200`, MIT text read. Additional database conflicts with current simplicity unless measured need; no claim its advertised recovery behavior was tested |

## Retrieval coverage and remaining uncertainty

Corpus README lookup for the research CLI was unavailable, so GitHub's read-only API supplied document evidence for all tagged repositories. A first console output failed on Windows text encoding; successful UTF-8 retries supplied the evidence used above. Missing license responses were retained as unknown, not silently repaired by badges. API documents were read as bounded excerpts; long license bodies, dependencies, enterprise exceptions and actual source terms still require review before reuse.

Review evidence is in this session's tool results: GitHub document batches `91e6c0bb-3ddb-4feb-846d-9734edf2401e` and `bfaf6054-a73b-45db-a9d7-aeb066d6509b`; root/ref check `37171408-442d-4422-92f2-144de061694d`; DBOS read `818c3eca-161a-4a95-b6c1-a82466ed4cb6`; corpus source searches and reads N1–N3. IDs identify observations, not certification. Refresh exact source revision, full license and API behavior during implementation; this register authorizes no downloads, indexing, copying or paid calls.

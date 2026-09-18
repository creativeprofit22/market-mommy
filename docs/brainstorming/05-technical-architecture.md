# Technical architecture

This is developer-facing reference material. None of this vocabulary is required in the ordinary user experience.

## Status

**Accepted direction:** agentic and programmatic behavior using ggframework; retain technical depth while simplifying the experience.

**Proposed architecture:** an independent headless engine, CLI, native GG Coder integration, and a thin guided visual experience. Exact boundaries and first delivery surface remain open. No component is claimed implemented here.

## Shared foundation

```text
User situation and objective
        ↓
Bounded research plan
        ↓
Programmatic collection and normalization
        ↓
Evidence storage and retrieval
        ↓
Narrow classification / extraction
        ↓
Opportunity analysis and counterevidence
        ↓
Deterministic calculations where useful
        ↓
Practical recommendation
        ↓
Approved real-world experiment
        ↓
Measured outcomes and adaptation
```

One foundation should support multiple business stages. Change the questions, depth, and presentation rather than maintaining separate engines for beginners and enterprises.

## Responsibilities

### Programmatic control

Own job state, scheduling, connector execution, deduplication, validation, timestamps, lineage, budgets, calculations, approval enforcement, and outcome records.

### Agent reasoning

Interpret business questions, propose bounded research, identify information gaps, interpret ambiguity, challenge explanations, design experiments, and explain recommendations.

Start with one orchestrator and selective specialist passes, not a permanent committee for every document. Agent count is not a quality metric. Durable jobs and business records must not depend solely on conversation history.

## ggframework

Intended engine: `E:/Projects/gg-framework-fork`.

Relevant inspected capabilities include typed tools, cancellation, turn budgets, tool deadlines, execution-order hints, and result-size budgets in `packages/gg-agent`. Provider abstractions live in `packages/gg-ai`; GG Coder provides an existing integration surface.

Reuse bounded agent infrastructure rather than importing unrestricted coding tools into market research. Persist business workflow state independently of the agent transcript.

## Interfaces

| Surface | Proposed role |
| --- | --- |
| CLI | Automation, repeatable jobs, development, benchmarks; not required of ordinary users |
| GG Coder tool | Conversational access to the same engine |
| Guided visual experience | Next action, evidence review, progress, later comparisons and relationship views |
| Hosted worker later | Monitoring while the user's computer is off |
| Generic MCP interface later | External-agent interoperability if demand justifies it |

Avoid coupling all domain logic to GG Coder or building multiple independent implementations. A CLI alone is insufficient for the intended beginner experience. A separate desktop shell is not automatically the first priority.

## TypeSafe — candidate, not commitment

Potential uses: classify firsthand experience, complaint versus marketing, problem category, explicit switching intent, and relevance against a clear rubric.

The documented Choice, Score, and Noul primitives support narrow structured judgments. Keep a replaceable classifier interface and benchmark against rules and existing structured-output models.

Model confidence is not source truth or probability of commercial success. Independent evaluation of questions does not establish statistical independence of business factors. Provide an insufficient-evidence path and keep permissions outside model control.

## Collection providers

Bright Data documents asynchronous collection with snapshot identifiers. Apify documents event-triggered webhooks. These patterns suit durable ingestion but do not select a vendor or establish permission to collect a particular source.

Normalize results into an owned contract. Proposed connector responsibilities include capabilities, scope, estimated/actual cost, status, errors, pagination, incremental updates, provenance, and restrictions.

Start with few sources and one provider if it fits. Failover must justify its complexity and duplicate-billing risk.

## Language and storage choices — proposed

Keep orchestration and initial adapters in TypeScript near the existing framework. Evaluate Rust for measured CPU-heavy parsing, normalization, deduplication, indexing, or numerical workloads.

Rust does not reduce remote-provider latency or establish analytical accuracy. Measure the workload before adding cross-language boundaries.

SQLite is a reasonable local-first candidate. Hosted multi-user operation needs a separate concurrency and isolation decision. Relational entity/edge tables can support initial relationships; do not adopt a graph database simply to draw a graph. Start with full-text retrieval and add semantic retrieval only when evaluation shows value.

## Lean defaults

- Incremental refresh and content-hash caching.
- Source-appropriate freshness policies.
- Bounded queues, concurrency, retries, output, and spending.
- Cancellation and cleanup across job boundaries.
- Local retrieval before repeated network collection.
- Deterministic code before model calls where sufficient.
- Compact evidence retrieval instead of sending entire datasets to models.
- Separate fast existing-evidence responses from slower fresh collection.

No latency, memory, or cost target has been validated yet.

## Patterns from Steroids

Borrow deliberate collection, local indexing, narrow search followed by original evidence inspection, explicit output budgets, structured responses, and incremental updates.

Distinguish missing coverage, truncated results, and additional matches. Use cheap candidate filtering before expensive analysis. Do not assume a code-search index transfers unchanged to natural-language research.

The inspected local checkout identifies AGPL licensing. Confirm reuse rights before copying implementation; borrowing an architectural idea is a different decision.

## Patterns from Linkgo

Borrow the separation of research, scoring, drafting, audit, approval, scheduling, and measurement; bounded reference context; intent-specific variants; and explicit external-action gates.

Its documented local JSON intake is not a delivered production scraping layer. A possible future boundary is Market Mommy deciding what to say and why, with Linkgo handling approved execution. This integration is not yet selected or implemented.

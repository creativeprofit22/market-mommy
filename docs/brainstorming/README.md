# Market Mommy — brainstorming reference

Status: exploratory product and architecture reference, not an approved build specification.

Last updated: 2026-09-18.

## Product direction

Help people find a realistic way forward, understand what to try next, and use real-world evidence to build toward paying customers.

Revenue generation is the priority, balanced with delivery costs, time to cash, and the user's real constraints. Sophisticated research should support simple, practical decisions—not require users to understand business or developer terminology.

The immediate audience is people finding a business direction or seeking their first paying customers. The information model should remain adaptable to agencies, SaaS, and other business types. More advanced business capabilities remain a later reference, not initial scope.

## Read by topic

| Document | Purpose |
| --- | --- |
| [Product direction and decision status](01-product-direction.md) | Accepted direction, proposed choices, open decisions, and non-goals |
| [Business stages and journeys](02-business-stages.md) | Different user problems, early journeys, and stage progression |
| [Experience and language](03-experience-and-language.md) | Guided experience, plain language, evidence, and uncertainty |
| [Evidence and market intelligence](04-evidence-and-signals.md) | Data sources, collection, sentiment, trends, relationships, and OSINT |
| [Technical architecture](05-technical-architecture.md) | ggframework, CLI, GG Coder, TypeSafe, scraping, storage, Rust, and reuse |
| [Recommendations and experiments](06-decisions-and-experiments.md) | Practical advice, simulations, social strategy, and outcome learning |
| [Benchmarks and safeguards](07-benchmarks-and-safeguards.md) | Quality, performance, cost, trust boundaries, and responsible data use |
| [Commercial model and later capabilities](08-commercial-model-and-later-scope.md) | Monetization hypotheses and preserved advanced ideas |
| [Source notes](09-source-notes.md) | Local code and external documentation inspected during brainstorming |

## Decision labels

- **Accepted direction:** explicitly supported in the conversation; not permission to implement.
- **Proposed:** a recommendation to evaluate before committing.
- **Open:** a material question not yet settled.
- **Later:** preserved for reference, not a current requirement.

## How to maintain this reference

Keep shared principles in their owning document and link to them rather than duplicating specifications. Record a decision as accepted only after it is actually settled. Distinguish source observations, hypotheses, and measured results.

This documentation does not create Roadmap phases, authorize implementation, select paid providers, or claim that any component has been built or benchmarked.

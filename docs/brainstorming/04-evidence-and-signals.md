# Evidence and market intelligence

## Purpose

Collect information that can change a practical commercial decision. The user need determines the research scope; beginner guidance should not automatically trigger enterprise-sized collection.

First-party outcomes are essential. Public data suggests opportunities; actual conversations, payments, delivery costs, and repeat purchases help establish whether they work for this user.

## Signal families

| Family | Examples | Useful question |
| --- | --- | --- |
| Pain and unmet needs | Recurring complaints, manual workarounds, unresolved questions | What problem deserves an offer? |
| Buying intent | Recommendation requests, migration discussions, tenders | Who may be looking for a solution? |
| Willingness to pay | Current spending, accepted proposals, deposits | Is this interest or commercial demand? |
| Trigger events | Expansion, leadership changes, hiring, launches | Why might timing matter? |
| Competitor changes | Pricing, features, packaging, discontinued products | Is an opening emerging? |
| Switching friction | Contracts, migration, training, procurement | Can buyers realistically change? |
| Access to buyers | Communities, search, partners, marketplaces | Can this user reach customers? |
| Demand and supply | Repeated requests and credible available suppliers | Is the need underserved? |
| Sales and customer outcomes | Won/lost deals, objections, refunds, repeat purchases | Which signals predict useful business? |
| Delivery economics | Hours, maintenance, infrastructure, review costs | Can the offer be fulfilled profitably? |
| Market relationships | Ownership, partnerships, integrations | Who influences access or dependency? |
| Source health | Freshness, coverage, failures, duplication | How much should the evidence be trusted? |

Candidate sources include official APIs, permitted public pages, reviews, job descriptions, public tenders, changelogs, directories, public business filings, authorized community exports, customer interviews, CRM records, and support tickets.

## Do not overinterpret proxies

- Funding is not a confirmed budget for the user's offer.
- Hiring is not proof of willingness to outsource.
- Persistent advertising is not proof of profitable advertising.
- Complaints are not proof of willingness to pay.
- Search volume is not purchase intent.
- A sale after seeing content is not proof that content caused the sale.

## Collection strategy — proposed

Prefer authorized first-party imports, official APIs and structured feeds, permitted lightweight retrieval, managed scraping, then justified and permitted browser automation.

Keep vendors replaceable. Bright Data and Apify are candidates, not selected providers.

Each collection should preserve scope, source, publication time where known, collection time, job status, partial failures, cost, and applicable retention/reuse constraints. Never equate failed collection or missing coverage with absence of market demand.

Collect incrementally. Resolve specific information gaps rather than scraping everything continuously. Additional research should be justified by its likely decision value relative to cost and delay.

## Evidence model — proposed

Preserve original observations separately from interpretations and recommendations. Useful fields include:

- Source identifier and URL where applicable.
- Source type, origin, and relevant excerpt or permitted snapshot reference.
- Published, observed, and collected times, distinguishing unknown values.
- Entity, segment, topic, and supported claim.
- Provenance, duplicate relationships, and independent corroboration.
- Extractor/model version where relevant for reproducibility.
- Uncertainty, contradictions, rights, retention, and correction status.

Recommendations should retain links to supporting and contradicting evidence. Correction or removal of evidence should trigger reassessment of dependent claims.

## Sentiment

Measure expressed experience among observed people—not “true feelings” or a representative population without evidence.

Prefer aspect-based analysis: what helps or hurts, severity, recurrence, firsthand experience, workaround, switching behavior, and explicit spending. Preserve ambiguity and unknowns.

Deduplicate reposts, distinguish marketing from customer statements, count independent origins, and avoid pooling incompatible customer segments. A collection change can create an artificial trend.

## Trends — more advanced use

Use bounded questions with a time horizon, not universal market prophecy. Track emergence, acceleration, commercial validation, saturation, and decline as hypotheses supported by observations.

Consider baseline growth, source diversity, persistence, buyer participation, purchase language, actual spending, and supply response. Separate observation, explanation, forecast, and action. Compare forecasts with simple baselines before relying on complex methods.

## Relationships and business OSINT — later or question-specific

Use a graph underneath and focused, question-specific views in the interface. Candidate entities include companies, products, professional roles, investors, partners, communities, and business events.

Connections must have a type, evidence, source, time, and uncertainty. Do not equate follows with relationships, shared mentions with partnerships, similar names with identity, or affiliation with permission to contact.

Useful questions include partner access to a customer segment, relevant leadership changes, verified introduction paths, and discontinued-integration dependencies.

Borrow corroboration, timelines, provenance, and entity resolution from public-source investigation. Exclude covert tracking, personal-life profiling, sensitive-trait inference, leaked credentials, and speculative allegations.

# Product direction and decision status

## Core promise

> Find a realistic way forward, understand what to try next, and use real-world evidence to build toward paying customers.

The tool should help answer: given this person's skills, resources, constraints, and available market evidence, what is a sensible next action toward earning money?

The operating loop is:

**Understand the person → gather relevant evidence → recommend a practical action → record what happened → adapt.**

Research is useful only insofar as it improves a decision. Reports, graphs, agent activity, and collected data are not outcomes by themselves.

## Accepted direction

- Revenue generation is the top priority. Consider expenses, delivery feasibility, time to cash, and repeatability rather than gross revenue alone.
- Focus first on people finding a direction and seeking their first paying customers; provide a path toward more consistent sales.
- Keep the information adaptable across business types, including AI agencies and SaaS.
- Use an agentic and programmatic approach, with ggframework as the intended engine.
- Preserve the earlier technical vision while simplifying the user experience.
- Keep the tool lean and fast without sacrificing evidence quality.
- Prefer understandable language. Do not expose developer language in the ordinary user experience.
- Preserve advanced business ideas for later rather than making them initial requirements.
- Stay at the brainstorming/documentation stage for now.

## Proposed initial boundary

One business profile, a small number of permitted sources, evidence-backed guidance, one manageable real-world experiment, and outcome feedback.

The first complete journey should help someone choose a sensible direction, form a clear offer, and learn from actual potential buyers. Exact screens, connectors, markets, and acceptance criteria remain undecided.

## Agnostic does not mean generic

Keep three things separate:

1. **Observation:** what a source actually says or what happened.
2. **Interpretation:** what it could mean for a particular customer or business.
3. **Recommendation:** what this user should do given their circumstances.

The same recurring workflow complaint might justify an agency service, a SaaS demand test, or an educational article. Changing the business profile should allow reinterpretation of existing evidence without automatically collecting everything again.

## Proposed principles

- Prefer a few relevant options and one explained recommendation over a large idea list.
- Spend on research in proportion to the decision it could improve.
- Recommend doing less when extra activity is unlikely to help.
- Learn from first-party outcomes, not public attention alone.
- Preserve uncertainty and counterevidence.
- Avoid income guarantees, fabricated estimates, and synthetic validation presented as real demand.

## Open decisions

- The first narrowly defined audience and geography.
- The first end-to-end journey and how its usefulness will be evaluated.
- The initial user-facing delivery surface and deployment model.
- Permitted sources, collection vendors, operating budget, and freshness requirements.
- TypeSafe adoption and any need for Rust processing components.
- Pricing, packaging, and willingness to pay.

These are not blockers to documenting the concept. They should be settled when needed for a bounded implementation or validation effort.

## Non-goals for the initial experience

- Universal market prediction.
- An enterprise dashboard as the default home screen.
- Autonomous outreach, publishing, or spending.
- A giant relationship graph without a specific commercial question.
- A synthetic-customer simulation that claims to prove demand.
- Requiring users to learn a CLI or understand AI infrastructure.

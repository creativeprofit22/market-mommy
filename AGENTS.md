# Coding agent guide

- Read CONTEXT.md before naming anything.
- Start with `docs/README.md` for canonical document ownership and decision status. `docs/brainstorming/` is a preserved exploratory archive, not the current contract. Foundation implementation is authorized by the approved shared-core plan; design documents alone do not authorize further scope. Preserve the distinction between accepted, proposed, open, and later decisions.
- Stack: one npm package, strict TypeScript/ESM, Node 24.21.0 pinned in `.node-version`. Install with `npm ci --ignore-scripts`. Dependencies are exact and locked; lifecycle scripts stay disabled. Use the pinned runtime without changing other projects' defaults.
- Build: `npm run build`. Typecheck: `npm run typecheck`. Test: `npm test` (Node test runner over compiled tests). Architecture: `npm run check:boundaries`. Fixture measurements: `npm run report:foundation`. No formatter/linter dependency. Current evidence and gaps: `docs/foundation-verification.md`.
- Guided UI prototype (labeled fixtures only, no framework): `npm run build:ui`; run with `npm run ui:prototype` (loopback-only `http://127.0.0.1:4317/`). Design contract: `DESIGN.md`; evidence and gaps: `docs/ui-verification.md`. ImageMagick probes must set `MAGICK_CONFIGURE_PATH=E:/Projects/market-mommy/.gg/imagemagick` (constrained project policy).
- CI lives in `.github/workflows/ci.yml` and must stay green. It now configures pinned Windows/Linux foundation checks. Hosted run `36033459408` passed on ubuntu-latest and windows-latest for `70bc885`; no local Linux run is claimed.
- Foundation scope is synthetic fixtures only, not completed market advice or beginner delivery. Preserve original design requirements/manual Journey traces and the brainstorming archive. UI/launcher, live providers and real-data/release gates remain later; the foundation phase is Done for synthetic-fixture scope (2026-09-26).
- Enqueue does not autoexecute: `runNextFixture` and its `onProgress` observer are trusted composition APIs, not model arguments. Backup/export/import/removal-ledger/reconciliation APIs are trusted worker administration, never agent tools. Fixture removal blocks/sanitizes all saved request results while retaining reserved keys, accounting and workload identities.
- Never auto-register MCP. The committed example is inert/disabled. With user authorization, GG Coder Local Fork gained a per-project `trustedProjects` entry for this project only (other projects' existing entries untouched, global `trustProjectMcpServers` still `false`), loads the git-ignored read-only fixture entry, and passed the host smoke test on 2026-09-26 (see `docs/foundation-verification.md`).
- Never commit with `--no-verify`.
- Never commit secrets, local environment files, or `.gg/` agent state.

## Polish

This project uses the `uimaxxxing` reference-image-to-UI methodology. The
agent contract lives at `C:/ggcoder-projects/uimaxxxing/AGENTS.md`. Per-project decisions
(material map, palette, fonts, off-limits, density config) live in
`.gg/style-pack.md` — **read it before every CSS turn**. Asset-lane details
live in `.gg/assets/manifest.json` and `.gg/assets/slots/<slot>.md` when
`/polish --assets` is used. Reference-conditioned component work lives in
`.gg/reference-ui/<id>/` when `/ref-ui` is used.

The methodology is **not** auto-loaded into this project. Before the first
UI, CSS, layout, motion, or visual-review turn of a session, read
`C:/ggcoder-projects/uimaxxxing/methodology/01-contract.md`, `02-protocol.md`, `03-eyes.md`,
and `07-voice.md`; they route to the on-demand shards and companions. Non-UI
work in this project needs none of it.

Read a topic file only when the work touches it (all under
`C:/ggcoder-projects/uimaxxxing/methodology/`; links inside the shards resolve there too):

- Animation, motion, scroll, transitions → `08-liveness.md` + `motion-craft.md`
  (named-but-vague effects: `effect-vocabulary.md`; native apps: `native-motion.md`)
- Phone, touch, viewport height, safe areas, translucency → `mobile-craft.md`
- Installed UI library misbehaving, or a new library implied → `library-craft.md`
- Loading / empty / error states → `09-states.md` · hit targets → `10-affordance.md`
- Keyboard, ARIA, contrast → `12-a11y.md` · wording → `11-microcopy.md` · sound → `13-sound.md`
- Navigation, workflow, onboarding, recovery → `14-experience-coherence.md`
- Two plausible directions, no probe settles it → `comparison-preview.md`

**Run eyes with the full path and the no-install env, in the same call, always:**
bash `UIMAXXXING_EYES_NO_INSTALL=1 node "C:/ggcoder-projects/uimaxxxing/eyes/<probe>.mjs"`;
PowerShell `$env:UIMAXXXING_EYES_NO_INSTALL='1'; node "C:/ggcoder-projects/uimaxxxing/eyes/<probe>.mjs"`.
Each shell call starts fresh, so `node eyes/…` (shard shorthand), a
`$EYES_TOOL_ROOT`, or the env exported in an earlier call all fail here. Without
the env a probe may silently install Playwright. A missing-Playwright error means
say **not verified** and route to `/setup-polish` — never install.

### Images (ImageMagick-backed eyes)

Whenever a turn involves a reference image, mockup, or UI screenshot — inside
or outside `/polish` — use the eyes instead of eyeballing a raw `read`. The host
shrinks large images (~1568 px long edge) and cannot open `.jfif`.

- Decode first (always for `.jfif`/`.avif`):
  `UIMAXXXING_EYES_NO_INSTALL=1 node "C:/ggcoder-projects/uimaxxxing/eyes/visual.mjs" --reference <path>`, then `read` the PNG.
- Colours: `UIMAXXXING_EYES_NO_INSTALL=1 node "C:/ggcoder-projects/uimaxxxing/eyes/palette.mjs" <path>` — never guess hex.
- Fine detail (text, borders, icons): crop with
  `UIMAXXXING_EYES_NO_INSTALL=1 node "C:/ggcoder-projects/uimaxxxing/eyes/extract-region.mjs" <path> --coords W,H,X,Y`.
- Live vs reference: `UIMAXXXING_EYES_NO_INSTALL=1 node "C:/ggcoder-projects/uimaxxxing/eyes/visual.mjs" --compare <url> <ref>`
  and `UIMAXXXING_EYES_NO_INSTALL=1 node "C:/ggcoder-projects/uimaxxxing/eyes/drift.mjs" <live-png> <ref-png>`.
- Raw ImageMagick is `magick` (v7). Never call bare `convert` — on Windows it is
  the unrelated disk-conversion tool. If `magick` is missing, say so; do not
  claim visual verification.

### Polish command

The `/polish` slash-command at `.gg/commands/polish.md` is tuned to this
project — it knows the dev URL, cascade entry, component dir, and
verification floor for **market-mommy**. Invoke it for:

- `/polish` — inspect one journey, recommend one improvement (or none), wait for approval.
- `/polish <component>` — scoped to one component.
- `/polish --ref <path>` — reference-image-driven (full 7-step protocol).
- `/polish --ref <path> --assets` — asset-lane audit for non-codeable art.
- `/polish --assets ingest` — register files dropped into `.gg/assets/inbox/`.
- `/polish --assets plan <slot>` — write component anatomy/build-spec for one slot.
- `/ref-ui --registry <url> --mode clone|adapt|remix` — ingest a registry reference.
- `/ref-ui --repo owner/name --component <name> --demo <url> --selector <css>` — source + rendered contract workflow for repo/live components.
- `/ref-ui --refs A=<url>#selector B=<url>#selector --mode remix --traits "..."` — capture one contract per label, gate each selected label, and aggregate the label gates.
- `/ref-ui --contract .gg/reference-ui/<id>/contract.json --verify <dev-url> --selector <css>` — re-run the reference gate.

For missing prerequisites or changed setup facts, read the existing
`C:/ggcoder-projects/uimaxxxing/commands/setup-polish.md` workflow internally: inspect, reuse,
propose missing preparation, approve consequential operations, configure, verify,
and resume the original request. Use its internal-continuation input branch: carry
the inspected project root and setup-relevant facts explicitly; retain the original
request separately for resumption, not as setup arguments. `/setup-polish` remains the explicit setup/refresh
shortcut; no mandatory command sequence. Discover supported host tools rather than
assuming `/setup-eyes` exists. Distinguish configured instructions from render verified
readiness. Setup does not authorize UI edits or adoption; curated refreshes require
a narrow approved diff. Cancellation preserves existing files.

### When to use the polish loop (automatically, without being asked)

Use the same `.gg/commands/polish.md` instructions for normal conversation;
no slash syntax or synthetic argument section is required. Classify by primary outcome
before triggers: blank or vague requests diagnose one bounded journey and recommend
one-or-zero changes; no app or style-pack writes before approval. An explanation-only
question stays inspection and explanation unless changes are requested. Narrow directed
work stays narrow. Reuse valid same-scope approval, including identical journey scope;
planning is not implementation approval. New scope and stricter specialist gates still
need approval. Pass original request, surface, constraints, approval scope, and expected
evidence internally; journey-plus-component work remains journey-led. Read canonical
`C:/ggcoder-projects/uimaxxxing/commands/ref-ui.md` for source-backed components and
`C:/ggcoder-projects/uimaxxxing/commands/asset.md` for ordinary scratch art using local recipes.
Read `C:/ggcoder-projects/uimaxxxing/commands/perf-ui.md` for explicit performance plans and
`C:/ggcoder-projects/uimaxxxing/commands/ingest-spec.md` for supplied-spec planning; neither authorizes
product code. Specialists return result, retained approval scope, artifacts, verification
evidence, and unresolved gates internally. No unrelated source search for asset recipes;
ordinary measured performance fixes requested as implementation stay scoped in polish.

Use installed probes with `UIMAXXXING_EYES_NO_INSTALL=1`, inspect scripts before
starting them, and verify the explicit local target serves the intended root. Missing
browser or target support is a capability gap, not permission to install or claim readiness.

Within those boundaries, reach for the polish instructions or underlying eyes when:

<!-- BEGIN: polish-triggers -->

- `ui/prototype/public/styles.css` is where CSS lives: the web floor (`typecheck`/`build:ui`/`visual.mjs` at 390x844 then 1440x900/`a11y.mjs`/`affordance.mjs --pointer coarse`) runs after any edit here.
- Interactive surfaces live under `ui/prototype/src/` (`render.ts`); touching a `button`, `[role]`, or form control triggers `affordance.mjs --pointer coarse`.
- Data-bearing surfaces (option entries, evidence disclosure, progress list) live in `ui/prototype/src/render.ts`; adding or removing one triggers `states.mjs`.
- Changing audience, workflow, navigation, disclosure, or recovery loads methodology `14-experience-coherence.md`. Name one journey; walk its happy, back or cancel, and highest-risk failure paths, then run existing probes for affected states, controls, feedback, copy, and surfaces. The journey contract is `DESIGN.md` + `docs/ux/journey.md`.
- Motion changes under `ui/prototype/` trigger `liveness.mjs` within its limits (stillness is an observation, not a failure; it fails only when reduced motion adds motion or ignores the preference). Read `C:/ggcoder-projects/uimaxxxing/methodology/08-liveness.md` and on-demand `C:/ggcoder-projects/uimaxxxing/methodology/motion-craft.md`. Completion, focus and cleanup must not depend solely on animation/transition end events.
- Mobile web & translucency, on demand: phone-browser symptoms load `C:/ggcoder-projects/uimaxxxing/methodology/mobile-craft.md`; report findings by evidence tier (code inspection, viewport emulation, real phone) and disclose absent hardware.
- Installed libraries, on demand: this prototype has no UI library (see `docs/decisions.md`); a request implying one loads `C:/ggcoder-projects/uimaxxxing/methodology/library-craft.md` and never installs without asking.
- Naming effects & comparing directions, on demand: `C:/ggcoder-projects/uimaxxxing/methodology/effect-vocabulary.md`; two plausible directions load `C:/ggcoder-projects/uimaxxxing/methodology/comparison-preview.md` with the harness copied into ignored scratch.
- Tokens live in `:root` of `ui/prototype/public/styles.css` (mirrored in `docs/ux/tokens-and-primitives.md`); adding or renaming a token triggers `design-system.mjs`.
- Reference imagery: none in this project. Any "matches the reference" claim triggers `visual.mjs --compare`, `drift.mjs`, and `squint.mjs`.
- ImageMagick-backed probes in this project run with `MAGICK_CONFIGURE_PATH=E:/Projects/market-mommy/.gg/imagemagick` (constrained project policy; see `docs/ui-verification.md`).
- Repo/registry/live-component references use `/ref-ui` (artifacts in `.gg/reference-ui/<id>/`); scratch icons and ornaments use `/asset` (under `.gg/assets/`).

<!-- END: polish-triggers -->

### Reference UI

Use `/ref-ui` when the user asks to copy, clone, adapt, remix, install, or take
construction from a repo, registry URL, shadcn-compatible install command, live
demo, or component library. Do not freehand from memory when the source and
rendered contract tools can inspect it.

Required artifacts before fidelity claims: `.gg/reference-ui/<id>/source.json`,
`decision.md`, `contract.json` (unless explicitly degraded) or multi-ref remix
`contracts/<label>.json` files, and `gate.json`. For multi-ref remix, `gate.json`
aggregates `.gg/reference-ui/<id>/gates/<label>.json` for every selected label.
Ask before guessing mode
(`clone`/`adapt`/`remix`), selectors, variants, selected traits,
license/provenance approval, or new dependencies. If the gate is missing or
failing, say **not verified** and ask how to proceed. If the reference contains
a concrete silhouette (logo/icon/book/device/card stack or hardware shape),
`shape-drift.mjs` is mandatory in addition to pixel drift.

### Asset lane

Use `/polish --assets` when a reference contains product renders, logos,
textures, cutouts, 3D objects, or hardware-like interactive controls that
CSS/DOM cannot honestly recreate. Never paste a flat image for an
interactive control; decompose into component anatomy first, then record
source, licensing, dimensions, provenance, files, and verification in the
asset manifest.

### Cascade contract

The CSS cascade entry is **`ui/prototype/public/styles.css`**. Read it before adding any new
rule — its `@layer` / `@import` order decides which layer your declaration
belongs in.

### Where to add things

<!-- BEGIN: polish-where-to-add -->

| What you're adding     | Where it goes |
| ---------------------- | ------------- |
| New component CSS      | `ui/prototype/public/styles.css` (single stylesheet; add a commented section) |
| New component markup   | `ui/prototype/src/render.ts` (DOM builders, text only, no innerHTML) |
| New design token       | `:root` in `ui/prototype/public/styles.css` **and** `docs/ux/tokens-and-primitives.md` |
| New icon               | `ui/prototype/src/icons.ts` (24 px grid, 1.5 px stroke, currentColor) |
| New material / texture | Not used by this design (see DESIGN.md); cite provenance if that changes |

<!-- END: polish-where-to-add -->

### Off-limits

<!-- BEGIN: polish-off-limits -->

- Nothing recorded yet in `.gg/style-pack.md` §6. Project rules: no new UI dependency for the prototype, no web-font downloads, labeled fixtures only, no developer terminology in UI copy (see `DESIGN.md`).

<!-- END: polish-off-limits -->

### When NOT to invoke /polish

- Docs-only changes, comments, formatting.
- Refactors covered by tests with no visual surface touched.
- Dev server isn't up AND the task doesn't require runtime verification.

### Capability-gap escalation

If a polish pass needs a probe that doesn't exist, surface the tradeoff
inline (same protocol as `## Eyes` escalation). Don't guess at visual
fidelity — log a `wish` with `ggcoder eyes log wish "<gap>"` and either
build the probe or fall back with the user's approval.

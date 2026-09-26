# Guided UI verification

Evidence for the "Establish the guided UI" phase. This records what was actually run, on which machine, and what is still missing. It is not a WCAG conformance claim and not a release gate.

## Toolchain readiness (2026-09-26, Windows host)

Nothing was installed or upgraded for these checks.

| Item | Result | How it was checked |
|---|---|---|
| Node (project) | 24.21.0 available via fnm; PATH default is 22.20.0 | `fnm exec --using=24.21.0 -- node --version` |
| UImaxxxing toolkit | `C:/ggcoder-projects/uimaxxxing` at `d2767540f23ec5274e1bb7f80aabe4775f808eb3`. That is 30 commits past the revision reviewed when this phase was drafted (`78a33a5`). It adds page-session, structure, breakage, pixel, motion and sweep probes. Its `registry/projects.json` already had uncommitted changes from other projects. | `git rev-parse HEAD`, `git log 78a33a5..HEAD`, `git status` |
| Browser tooling | Playwright 1.60.0 in the toolkit `eyes/bin` | read of `eyes/bin/node_modules/playwright/package.json` |
| Chromium | Revision 1223, `148.0.7778.96`, installed at `%LOCALAPPDATA%/ms-playwright/chromium-1223`. A headless launch rendered a test page in 1.27 s. | Node 24.21.0 script run with `UIMAXXXING_EYES_NO_INSTALL=1` |
| ImageMagick (actually used) | Host `C:/Program Files/ImageMagick-7.1.2-Q16-HDRI/magick.exe`. It was 7.1.2-25 at first check and is now **7.1.2-31 Q16-HDRI x64**, `fb965f1:20260903`, after the user-approved upgrade described below. | `magick -version`, `where magick` |
| ImageMagick (toolkit managed pack) | Pinned to 7.1.2-27 (`…-im7.1.2-27-r2`). **Not installed on this machine**, so it is never used here. | search of toolkit docs and local app-data directories |
| Latest ImageMagick release | 7.1.2-31, published 2026-09-03; the host now matches it | GitHub releases API, checked 2026-09-26 |
| Toolkit adoption | Done 2026-09-26 with user approval. It created git-ignored `.gg/commands/{setup-polish,perf-ui,ref-ui,asset,ingest-spec}.md` and `.gg/style-pack.md`, and registered the project in the toolkit's `registry/projects.json`. Before/after diff: only a `market-mommy` entry was added; entries for other projects were untouched. `/polish` was created later by setup-polish (next row). |
| setup-polish | Done 2026-09-26 with user approval. Settings: site kind `web` (signal: `docs/` holds 3 or more Markdown files), targets `web, mobile-web`, dev URL `http://127.0.0.1:4317/` (`npm run ui:prototype`), no card candidates, no reference images. Created `.gg/commands/polish.md` from `templates/polish-web.md` (51,845 bytes, one fingerprint marker pair, no unresolved placeholders). Appended a `## Polish` section to `AGENTS.md` (loaded guide now 15,626 bytes, under the 32 KB host limit). `.gg/style-pack.md` was left untouched. The registry entry gained a `polish` block, with no other bytes changed. Result: `configured`. See the screenshot sections for the rendered check. | Rendered with `.gg/eyes/ui/render-setup-polish.mjs`; registry diff checked | `node C:/ggcoder-projects/uimaxxxing/bin/adopt-project.mjs` under Node 24.21.0, exit 0 |

### How the toolkit picks ImageMagick

The toolkit's probes call whatever `magick` is on PATH. Only the desktop app sets `MAGICK_CONFIGURE_PATH` to the toolkit's restrictive policy. So by default, command-line probes use the host's policy.

### Effective policy

- **Host default:** `C:/Program Files/ImageMagick-7.1.2-Q16-HDRI/policy.xml` sets no restrictions (the open policy).
- **Toolkit policy**, used via `MAGICK_CONFIGURE_PATH=C:/ggcoder-projects/uimaxxxing/desktop/runtime/imagemagick`:
  - The host binary loads and enforces it (confirmed with `magick -list policy`).
  - Only JPEG, PNG and WEBP are allowed. Delegates and filters are off.
  - Limits: 2 threads, 60 s, 256 MiB memory, 12 MP area, width 6000 px, height 2000 px.
  - `-` (stdin/stdout), `fd:`, `@` and `../` paths are denied, and symlinks are not followed.

Negative tests under the toolkit policy were all refused as expected: SVG input, `text:` input, `xc:` generation, and reading a PNG taller than 2000 px.

Positive tests under the same policy: PNG→PNG `compare -metric AE` with a diff image (exit 1, meaning "different", as expected) and PNG→WEBP resize both worked.

**Compatibility gap:** the toolkit policy also refuses the output formats that its own probes need:

| Probe | Output it needs |
|---|---|
| drift | `null:` |
| palette | `histogram:info:` |
| pixel/`_pixels` | `info:` and `txt:-` |

Each of these failed under the toolkit policy. Running every probe under that policy, as the approved plan assumed, does not work as-is. The project policy copy below fixes this.

### Release and advisory comparison

The GitHub security advisories for ImageMagick were checked on 2026-09-26.

**Host 7.1.2-25 was affected by advisories fixed in 7.1.2-26 through 7.1.2-31.** The upgrade below resolves these. Most are low or medium denial-of-service issues or memory leaks in coders this project never reads. The ones relevant to screenshot analysis are:

- GHSA-422r-8c97-xcg4: heap over-write in the `fx` operation, fixed in 7.1.2-27. Pixel probes use `%[fx:…]`.
- GHSA-jvjm-9f73-fhpq: heap over-write in `GetVirtualPixels`, fixed in 7.1.2-31.
- GHSA-vcjj-32hg-qpx5: policy bypass when "coder" is used as the policy domain, fixed in 7.1.2-31.
- GHSA-x8g2-7r3w-h44p: Windows path-policy symlink race, fixed in 7.1.2-30.
- GHSA-4mwf-mggw-29vp: denial of service by exhausting the memory budget, fixed in 7.1.2-30.

The only images these probes read are screenshots rendered locally from this project's own fixture pages, so exploitability here is low. Still, the fixes are relevant, and no upgrade was done without approval.

### Upgrade to 7.1.2-31 (user-approved, 2026-09-26)

1. **Source.** winget package `ImageMagick.ImageMagick` (the same package already installed) offers 7.1.2.31. Its manifest installer is the official GitHub release asset `ImageMagick-7.1.2-31-Q16-HDRI-x64-dll.exe`.
2. **Hash.** The downloaded installer's SHA-256 is `8536e5aec5053d6531fc099cf52bebbd71f983a55593fc4eab81c40040b2a629`. It matches all three:
   - the winget manifest,
   - the GitHub release API asset digest,
   - a local `sha256sum`.
3. **Signature.** `Get-AuthenticodeSignature` reported **Valid**:
   - Signer: `CN=ImageMagick Studio LLC, O=ImageMagick Studio LLC, L=Landenberg, S=Pennsylvania, C=US`
   - Issuer: Microsoft ID Verified CS EOC CA 03
   - Thumbprint: `681640EF289860188D39967E87F7DB8CF8E676CB`
   - Timestamped by Microsoft Public RSA Time Stamping Authority. The certificate's NotAfter (2026-09-05) has passed, but the timestamp keeps the signature valid.
4. **Install.** `winget upgrade --id ImageMagick.ImageMagick --version 7.1.2.31 --exact --silent` succeeded, and winget re-verified the hash.
5. **Result:**
   - `magick -version` → `ImageMagick 7.1.2-31 Q16-HDRI x64 fb965f1:20260903`.
   - `where magick` → `C:\Program Files\ImageMagick-7.1.2-Q16-HDRI\magick.exe`, the same install path as before.
   - `winget list` → 7.1.2.31.
   - The installed `magick.exe` has a valid signature from the same signer.

The toolkit's managed pack (7.1.2-27) is still not installed and is not used.

### Project ImageMagick policy (git-ignored copy)

The toolkit policy blocks the output formats its own probes need, so this project keeps a user-approved copy at `.gg/imagemagick/policy.xml`. It is git-ignored under `.gg/`. SHA-256 `efee4b5eabdd3404a6681589eedd4e79d1e2d21a66cba6bf204b03b793a60dcd`.

Every probe in this project runs with `MAGICK_CONFIGURE_PATH=E:/Projects/market-mommy/.gg/imagemagick`. `magick -list policy` confirms this file loads first.

**Changes from the toolkit copy (`d2767540`):**

1. The `INFO`, `NULL`, `TXT` and `HISTOGRAM` modules may load. New coder rules make them **write-only**.
2. Coder rules were added so only JPEG, PNG and WEBP can be read.
3. The path `-` is **write-only**. This lets `txt:-` print to stdout, while reading from stdin stays denied.

**Unchanged:** resource limits, the delegate and filter bans, no-follow symlinks, and the `fd:`, `@` and `../` path denials.

**Proof run** under the project policy with Node 24.21.0 `spawnSync`, the same way the toolkit calls `magick`. It used two test PNGs:

- `a.png`: 64×48 `#2F5D62`, SHA-256 `20c72940…0885`.
- `b.png`: the same, plus a 16×16 `#E07A5F` square at (8,8), SHA-256 `e38ec8c6…5ace`.

A loopback HTTP listener on `127.0.0.1:47123` counted URL fetch attempts. As a control, the host's default policy **did** fetch `http://127.0.0.1:47123/control.png` (1 request).

| Check | Result |
|---|---|
| `compare -metric AE a b null:` | pass: exit 1, `69.9399` (images differ) |
| `compare -metric AE a a null:` | pass: exit 0, `0` |
| `compare … diff.png` | pass: exit 1, diff image written |
| `-format %c histogram:info:` | pass: exit 0, 2816 × `#2F5D62`, 256 × `#E07A5F` |
| `txt:-` (pixel values to stdout) | pass: exit 0, `0,0: (224,122,95) #E07A5F` |
| `-format %[fx:mean] info:` | pass: exit 0, `0.333224` |
| MVG file input `t.mvg` | **denied**: "not authorized … `MVG`" |
| `mvg:t.mvg` | **denied**: "not authorized … `MVG`" |
| `http://127.0.0.1:47123/x.png` | **denied**: not opened; listener got **0 requests** |
| `url:http://127.0.0.1:47123/y.png` | **denied**: not opened; listener got **0 requests** |
| `txt:` input | **denied**: "not authorized … `TXT`" |
| SVG input | **denied**: "not authorized … `SVG`" |
| stdin input `png:-` | **denied**: "not authorized … `-`" |

No output file was produced by any denied case.

The canonical toolkit probes also passed on the same PNGs under this policy:

- `eyes/palette.mjs b.png` returned both colors.
- `eyes/drift.mjs a.png b.png --regions` returned verdict `mismatch`, 2.21 % pixel difference, and exactly one region, `16x16+8+8`.

Notes:

- In this bash shell, `txt:-` (stdout) wrote to a file named `txt` instead of printing, even with no custom policy. It printed correctly through Node `spawnSync`, which is the path the probes use. This is a shell quirk, not a policy result.
- `info:a.png` as an input was not refused. It decodes the named PNG through the allowed PNG coder, so it adds no new format.

## Rendered evidence: before critique (2026-09-26)

How it was captured:

- **Server:** `npm run ui:prototype` on `127.0.0.1:4317`, loopback only.
- **Screens:** the prototype uses normal page addresses (for example `/about/skill`). The toolkit's `--loopback-only` capture guard refuses `#` addresses, and the user chose normal addresses over turning the guard off.
- **Captures:** 14 screens × 2 viewports (390×844 and 1280×800) = 28 captures. Each was taken with `eyes/visual.mjs --viewport-only --loopback-only`, with `UIMAXXXING_EYES_NO_INSTALL=1` and the project ImageMagick policy set.
- **Storage:** the images are in git-ignored `.gg/eyes/ui/before/`. The capture and probe scripts, `capture.sh` and `probes.sh`, are next to them. Every image was opened and inspected.

Before-screenshot SHA-256 values (first 12 hex digits):

| Screen | 390×844 | 1280×800 |
|---|---|---|
| welcome | 91d2b14703ba | 1e5b4db9be2f |
| q-skill | 956853fb6057 | d2d8793563c0 |
| q-skill-error | c0782cdf8541 | f858428362b6 |
| q-timing | 62c7c652fb81 | 4161ef09c6d1 |
| stop-here | 57cea3a49b65 | 90573908c5ea |
| options | d3df5c8aa0b4 | 25111708fb21 |
| options-unsure | 3cd9a6430278 | c94035608959 |
| next-checking | 24d38aa11cda | 0b64634b379a |
| next-step | 339f3cd7595b | 766bc447b52c |
| next-evidence | 82f890ed3201 | f815af212a5b |
| next-thin | 9994b9d66ccb | e6d3df579162 |
| record | a04a0a597b47 | c455a3f78742 |
| progress | bdc190ec5e65 | 495d24bbb084 |
| progress-empty | 8558510c1fcc | f758a7109353 |

### Probe results (before)

8 key screens were probed at both viewports.

**`a11y.mjs`:**

- Tab order was in DOM order everywhere.
- 0 positive tabindex, 0 ARIA gaps, 0 low-contrast spots, 0 color-only states.

**`breakage.mjs`:** `no-breakage` on all 16 runs.

**`palette.mjs`** (ImageMagick histogram, next-step and options at 1280 px):

- About 91 % of the page is paper color (`#f8f4ed`, the rendered `--paper`).
- Next is ink (`#2a2e35` / `#282c33`), then the accent green (`#205d59`).
- No stray hues were found.

**`squint.mjs`** (ImageMagick blur ladder of next-step at 390 px): at the heaviest blur, three blocks still read clearly: the heading, the card with its margin rule, and the primary button. The hierarchy survives.

**`affordance.mjs --pointer coarse`** raised flags. Each was checked against the actual page:

| Flag | Where | Verdict | Evidence |
|---|---|---|---|
| 5 links "without a focus style" | all screens | **False positive** | They are the 5 practice-screen links inside the closed "Practice screens" disclosure, which cannot be focused while it is closed (`verify-flags.mjs`). |
| Radio inputs 20×20 px, "no focus ring" | question and record screens | **False positive** | Each radio sits inside a label with a 358×48 px hit area, and clicking the label text checks it. The focus ring is drawn on the label (`.choice:has(:focus-visible)`). After keyboard Tab, the focused label shows a solid 3 px ring (see `before/probes/focus-choice-390.png`). |
| `h1` 308×32 small target | next-step, progress (390 px) | **False positive** | The heading has `tabindex="-1"` only so focus can move to it after each step. It is not a control. |
| `summary` / `span` "cursor misuse" | all screens | **False positive** | The probe flags `cursor: pointer` on elements it does not treat as controls. `summary` is the native disclosure control, and the `span` is its label. The pointer cursor is correct. |

### Critique list (before)

1. **Heading and lede collide.** The paragraph right after an `h1` has no gap: on welcome, options, stop-here and progress-empty the lede touches the heading. Cause: `p { margin: 0 }` overrides the rail's `main > * + *` spacing (same specificity, declared later).
2. **Repeated copy on "not enough evidence."** The attention line and the action title both say "We don't have enough evidence to recommend this yet."
3. **Actions reflow unevenly at 390 px.** On next-step and next-thin, the long primary label wraps under the back link as a half-width button. Question screens keep both on one row. The narrow-screen primary action should be one predictable full-width target.
4. ~~Disclosure cursor~~: withdrawn after checking. The probe flag was a false positive (see table above).
5. **Progress view note is misgrouped.** "This practice version keeps answers only while this tab is open." sits directly under the recorded result, so it reads as part of the result.
6. **Evidence excerpts use straight quotes.** The body text uses typographic quotes, so the two are inconsistent.
7. **Deliberately not changed:** the tall empty space under the welcome and progress-empty actions on desktop. One question per screen is the design; filling the space would add decoration.

### Revisions made (critique → change)

| # | Change |
|---|---|
| 1 | The paragraph reset is now zero-specificity (`:where(p)`), so the rail's block rhythm applies. The lede after a heading and the hint after a legend get `--space-3`. |
| 2 | The not-enough-evidence fixture's next step no longer repeats the warning line. It now starts at "Ask two renters…". |
| 3 | Below 30rem, action rows stack: the back link comes first, then a full-width primary button. DOM and focus order are unchanged. The token doc is updated. |
| 5 | The note "keeps answers only while this tab is open" moved under the Your progress heading. |
| 6 | Evidence excerpts use typographic quotes. |

## Rendered evidence: after revision (2026-09-26)

The same 14 screens × 2 viewports, the same scripts and the same constrained policy were used. The images are in `.gg/eyes/ui/after/`, and each was opened and inspected.

After-screenshot SHA-256 values (first 12 hex digits):

| Screen | 390×844 | 1280×800 |
|---|---|---|
| welcome | 3fd6e793989d | b821e766b63e |
| q-skill | 8a2e12659d36 | d1cb4dc132ca |
| q-skill-error | acf006d3ddea | 09306ba9db75 |
| q-timing | f0809c560306 | dcfc3f947db6 |
| stop-here | 0fcb7f794ec1 | 5a0e44a443bd |
| options | f07c6c107904 | 660fa4cdbcb4 |
| options-unsure | 7b631984cd16 | eee6427b0916 |
| next-checking | 6722df59d1b7 | 95a2e3af43a5 |
| next-step | e3c4a8bd877a | 766bc447b52c (unchanged) |
| next-evidence | 5a1b07a7649c | 34fb34c84a22 |
| next-thin | ebd189d7d75a | e46cc2945a91 |
| record | ddeead5df2f1 | b96f016e5b91 |
| progress | 3f7e71e2a388 | 8fd70d833b9d |
| progress-empty | ad37ba91be06 | 6faace678f78 |

### Drift, before → after

Run with `eyes/drift.mjs --regions`, using ImageMagick 7.1.2-31 under the project policy. Diffs, masks and region boxes are in `.gg/eyes/ui/drift/`.

Every change comes from a revision above:

| Screen | Pixel diff (390 / 1280) | What changed |
|---|---|---|
| welcome, stop-here, options, options-unsure, progress-empty | 3.7–6.8 % / 0.5–2.9 % | Lede spacing: content below the heading shifted down by 12 px. The 390 px actions are stacked. |
| q-skill, q-skill-error, q-timing, record | 6.8–9.3 % / 1.2–2.3 % | Hint spacing and stacked actions. |
| next-thin | 8.67 % / 2.13 % | The duplicate sentence was removed, and the actions are stacked. |
| progress | 6.55 % / 1.6 % | The note moved to the top, and the actions are stacked. |
| next-step | 1.27 % / 0 % | Only the 390 px action stack changed. Desktop is byte-identical. |
| next-evidence | 7 px / 7 px | Only the excerpt's quote marks changed. |
| next-checking | 0.29 % / 5 px | Stop button width at 390 px; spinner animation phase. |

In `options-390x844-diff.png`, the region boxes and the diff image show the text block shifted by one line gap. There was no unexpected change to any control, color or icon.

**Toolkit incompatibility found and bypassed.** On 5 pairs at 1280 px with a very small diff, `drift.mjs --regions` failed with "unrecognised connected-components line". ImageMagick 7.1.2-31 writes the background component's area in scientific notation (`1.02395e+06`), which the toolkit's `_pixels.mjs` parser does not accept (`CC_LINE` expects an integer). Those 5 pairs were re-run without `--regions`, and the pixel and DSSIM figures above come from that run. This is a toolkit bug to report upstream; it is not fixed here.

### Probe results (after)

- **`a11y.mjs`** (16 runs): tab order follows the DOM; 0 positive tabindex, 0 ARIA gaps, 0 low-contrast spots, 0 color-only states.
- **`breakage.mjs`:** `no-breakage` on all 16 runs.
- **`affordance.mjs`:** exactly the same flag totals as before (21 small targets, 98 missing focus style, 32 cursor misuse). These are the same false positives classified above, and no new flag appeared.
- **`measure-text.mjs`:**
  - `h1` is 40 px at 1280 and 28 px at 390, weight 600.
  - Body is 17 px with a 26.35 px line height. Small text is 15 px.
  - The first family named in each stack is the requested one. The face Windows actually rendered (visually Palatino Linotype for display, Segoe UI Variable for body) is not reported by the probe.
  - The probe's exit 1 came from a wrong selector in my script, not from the page.

## Token contrast

The WCAG 2.x relative-luminance ratios were computed from the token hex values (script in the step 4 notes, re-run 2026-09-26). The full table is in [tokens and primitives](ux/tokens-and-primitives.md#color).

| Pair | Ratio | Requirement |
|---|---|---|
| Lowest text | muted on subtle, 6.59 | 4.5 |
| Control borders | line on paper, 3.46 | 3.0 |
| Control borders | line on surface, 3.81 | 3.0 |
| White on accent (primary button) | 7.72 | 4.5 |
| Attention text on paper | 6.01 | 4.5 |
| Focus ring against paper | 14.46 | 3.0 |

`a11y.mjs` found 0 low-contrast rendered text on 16 screen and viewport runs.

## Accessibility matrix

Scope: the prototype journey only, in headless Chromium 148 on this Windows machine, on 2026-09-26. **This is not a WCAG conformance claim.**

Evidence:

- Script: `.gg/eyes/ui/a11y-matrix.mjs`, results in `.gg/eyes/ui/after/a11y/matrix.jsonl`.
- Images: focus-radio `1ca49ce68e77`, focus-button `f7d7ab1fe3bb`, reflow-320 `81e98318f8f4`, zoom-200 `5c71cf28d62b`, text-spacing `4431a0a3251b`.

| Area | Result | Evidence |
|---|---|---|
| Keyboard | **Passed** | Full journey by keyboard only. The skip link is the first stop. Arrow keys move within native radio groups. The route covered "I'm not sure", a validation error, the urgent-income safe exit, "Change my answer", the shortlist and its disclosure (opened with Enter), "Stop checking", the evidence disclosure, recording a result, the progress view, and returning to the next step with the recorded result intact. Browser Back and Forward kept all 4 answers. No page errors. |
| Focus visibility | **Passed** | 43 focus stops across 7 screens. Every one had a solid 3 px outline on the control, or on the whole choice label for radios. After each step change, focus moves to the new `h1`. The screenshots were inspected. |
| Labels, names, structure | **Passed** | Every radio is labeled. Every link, button and summary has an accessible name. Each screen has one `h1` and `lang="en"`. Each step has its own title (8 distinct titles checked). The accessibility-tree snapshot shows a radiogroup named by the question. |
| Errors | **Passed** | After a failed Continue: `aria-invalid="true"`, and `aria-describedby` includes the error id. Focus moves to the first radio. The live region announces "Please choose an answer, or pick 'I'm not sure'." The error uses text and an icon, not color alone. |
| Status messages | **Passed** | Checking has no percentage and offers Stop. "Checks stopped", "Your result is saved" and "Your answers are kept" arrive through the live region without moving focus. Save failed shows `role="alert"`, keeps the chosen answer selected and focused, and offers "Try again". |
| Contrast | **Passed** | Token ratios above, plus `a11y.mjs` finding 0 low-contrast spots. |
| Reflow (320 CSS px) | **Passed** | No horizontal scroll and no clipped content on 6 screens. The screenshot was inspected. |
| Zoom (200 %, emulated as 640×400) | **Passed** | Same checks as reflow, and the screenshot was inspected. Real browser zoom at 200 % was not separately exercised. |
| Text spacing (1.4.12) | **Passed** | The overrides were injected in a test-only context with CSP bypass, and applying them was confirmed (letter-spacing 1.8–2.28 px). There was no overflow on 4 screens, and the screenshot was inspected. |
| Reduced motion | **Passed** | Under `prefers-reduced-motion: reduce`: the spinner animation is `none`, transition durations are 0 s, and `--dur-std` is 0 ms. Without it, the spinner animates. |
| Target size | **Passed** | Every visible link, button, summary and choice at 390 px is at least 44×44 CSS px (5 screens). |
| Forced colors (emulated `forced-colors: active`) | **Passed (emulation only)** | The selected choice keeps a border and a visible check icon. The keyboard focus ring stays solid. The error edge and icon remain. The primary button keeps a visible border. Screenshots `forced-colors-timing-390.png` and `forced-colors-error-390.png` were inspected. A real Windows contrast theme was not tested. |
| Screen reader (Narrator / NVDA) | **Not verified (owner declined)** | On 2026-09-26 the project owner declined a manual screen-reader pass for this prototype. The accessibility-tree snapshot, labels, and live-region checks above are indirect evidence only; they are not a substitute. |
| axe-core | **Not run** | Not added, because it would be a new dependency. |

**Defect found and fixed in this pass.** After "We couldn't save that change", the page redrew and cleared the selected answer, even though the message says the answer is still selected, and "Try again" then showed a validation error. The unsaved choice is now kept in view state. The matrix confirms it stays selected and focused, and that Try again saves. The record screenshots are byte-identical after the fix, since the fix only affects the failure path.

**Record screen aligned with the core outcome contract (2026-09-26).** The record screen now uses the core outcome kinds and asks for an amount in US dollars for "They agreed to buy" and "Money arrived", plus an optional note (mapping in [journey](ux/journey.md#recording-a-result)). The matrix was updated to enter an amount and re-run, and all 11 checks passed. A scripted check (`.gg/eyes/ui/record-amount-check.mjs`) covered two paths. Choosing "Money arrived" with no amount keeps the page, focuses the amount field with `aria-invalid="true"` and `aria-describedby="record-amount-hint record-amount-error"`, and announces "Please enter the amount in dollars." Entering 25 saves, shows "Money arrived: $25.00" on the next step, and lists it in Your progress. `a11y.mjs` found 0 ARIA gaps and 0 low-contrast spots. `affordance.mjs --pointer coarse` flagged only the known 20 px radio false positive. The 390 px error-state and 1440 px screenshots were inspected.

## Checks and gaps (2026-09-26)

These checks were run under Node 24.21.0, and all passed:

| Check | Result |
|---|---|
| `npm run typecheck` | Passed |
| `npm test` | 105/105 passed. Includes the new journey-model and loopback-server tests. |
| `npm run check:boundaries` | Passed, 36 source files |
| `npm run build:ui` | Passed |

No CI change was needed. The prototype model and server tests run inside `npm test`.

Known gaps:

- **Screen reader:** not verified. The owner declined a Narrator or NVDA pass.
- **Browser coverage:** only headless Chromium 148 on this Windows machine. There is no Firefox, Safari or real-phone evidence. Real 200 % browser zoom and a real Windows contrast theme were not tested; only their emulations were.
- **axe-core:** not run, because it would be a new dependency.
- **Toolkit bug:** `drift.mjs --regions` cannot parse ImageMagick 7.1.2-31's scientific-notation connected-components output on nearly identical pairs. It needs an upstream fix in `eyes/_pixels.mjs`.
- **Toolkit drift:** the toolkit is at `d2767540`, not at the revision reviewed at drafting (`78a33a5`).
- **Scope:** this is a prototype on practice data only. The production UI library is still an open decision, and nothing is persisted.

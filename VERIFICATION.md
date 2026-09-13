# SpicyHome verification — 7 September 2026

## Completed

- [First live Track apartments run succeeded](https://github.com/spicyChicken59/SpicyHome/actions/runs/34160646756) on September 7, 2026 at 20:46 UTC. Exactly one request reservation was persisted before the provider call and is recorded as consumed.
- RentCast returned 500 of 2,703 Chicago matches; 192 active 1-bed/1-bath listings in the $1,200–$3,000 range fit the downtown search window. The other 308 returned listings were outside that window. Coverage is explicitly incomplete.
- The connected feed contains those 192 listings plus ten researched buildings. The app's production feed validator accepts all 202 records; default filters display 201 records, including all 192 live listings and nine research prospects. The daily archive, success status and last-success timestamp are persisted.
- [SpicyHome is published privately](https://spicyhome.motahir-official.chatgpt.site); native deployment status confirmed success. The deployed app is configured to read this public GitHub feed without another deployment. Full browser verification remains unclaimed below.

- Complete source published to [spicyChicken59/SpicyHome](https://github.com/spicyChicken59/SpicyHome). [GitHub Checks passed](https://github.com/spicyChicken59/SpicyHome/actions/runs/34158094270) on source commit `d3beb8352666e0e519e7ea40430789c2a81ce647`, including all 46 tests, syntax, assets and a clean-worktree check. The uploaded source tree matches the verified local tree.

- 27 JavaScript checks: 19 data/cost/backup cases and eight app interaction cases in jsdom. Together with the 21 Python cases, all 48 checks pass after the publication-preparation fixes.
- 21 Python checks: request reservation, rolling caps, one-call transport, validation, capped coverage, observed history, retention, charger filtering and station grouping.
- All local entrypoints and assets verified; all 22 shared design assets match their immutable hashes.
- Ten real official-source building prospects, ten sourced approximate coordinates, and a successfully fetched 37-station CTA reference subset.
- Independent read-only review found storage-confirmation, stale-cache, schema-validation, zero-cost and retention issues. These were corrected before delivery.
- Request failures preserve data; startup source failure retains a newer connected cache. Saved homes retain a snapshot even if the public feed stops including their ID.
- Manual entry, saved notes, zero-dollar quotes, comparison, backup schema, retained cache and persistent storage warnings exercised through actual authored app handlers in DOM emulation.

- Fixed keyboard-focus loss after saving/removing homes and saving notes. Pending search updates are cancelled when views change; rapid search/navigation is covered by regression checks.
- Added a locked Vite development server for repeatable browser preview; deployment still serves the authored static files directly.

## Not claimed

- The first authenticated manual scan has succeeded. The first scheduled daily run has not yet been observed; its configured schedule is 13:17 UTC, with one attempt per UTC day and at most 30 per rolling 32 days.
- No AFDC charging dataset has been fetched without its optional key.
- Source research is not a lease quote, inspected apartment, confirmed available unit or guaranteed parking/charger allocation.
- No full browser/visual QA or real map-tile interaction is claimed. The supervised preview starts successfully, but the browser connection was unresponsive during this publication attempt. Responsive CSS, semantic controls, native dialogs, focus styles and reduced-motion rules are implemented; DOM checks do not establish browser layout quality.
- Public GitHub Pages publication remains disabled; its post-tracking publication job was correctly skipped. Private Sites publication is already verified and reads the committed live feed independently.
- No leasing message, rental application or tour booking was sent.

## Two-bedroom expansion — September 8, 2026

- 106 automated checks pass: 66 JavaScript model/app checks and 40 Python checks.
  Required syntax/static validation passes; all 22 shared assets retain their hashes.
- Bedroom selection defaults to both sizes; exact selections, source counts, 1.5/2
  bathroom labels, local corrections, imported legacy reviews and reload are covered.
- Independent review found differing duplicate provider layouts and non-string
  imported layout checks; both are fixed with regression coverage.
- Four official-source 2-bedroom plans added under separate IDs. All 210 existing
  records, provider scan metadata, events, request usage and evidence ledgers are
  unchanged. New advertised prices remain separate from unknown base rent.
- Both bedroom sizes share one scheduled 500-result query and the existing city
  rotation. No paid provider request or live browser verification was performed.

## Published release audit — September 8, 2026

- The two-bedroom release was merged in PR #6 and successfully published through
  Sites before this follow-up audit.
- Independent UX and data audits identified four bounded improvements: overlapping
  plan pins, bedroom choice lost in scoped recovery, malformed optional provider
  text and missing historical bedroom scope per city. All four are implemented.
- 113 automated checks pass: 71 JavaScript and 42 Python. Focused independent
  verification also passed for the reported findings. Static validation confirms
  214 unchanged apartment records and 22 unchanged immutable design assets.
- Map interactions use DOM emulation with a Leaflet stub: correct grouped options,
  plan-specific notes, focus restoration and unlocated fallback are exercised.
  This does not claim visual browser QA or real tile/network interaction.
- Provider required text is bounded using JavaScript-compatible UTF-16 lengths;
  malformed optional fields retain a valid address fallback or unknown value.
  The normalized output passes the actual browser feed validator.
- Existing listing observations, scan dates, source facts, histories, events and
  request/evidence ledgers are unchanged. No paid provider call was made.

## Five-feature experience audit — September 8, 2026

- 124 automated checks: 82 JavaScript and 42 Python. Includes prior regression
  coverage plus Explore modes, map resizing, Focus save/skip/undo, stage moves,
  tour checklist/quote roundtrips, Cost Lab unknowns/zeroes/term arithmetic and
  invalid-field handling. No source data or paid-provider request was changed.
- Independent flow and data reviewers reproduced stale Focus counts, hidden or
  lost keyboard focus and a Cost Lab error-clearing bug. Fixes have regression
  coverage and passed focused independent confirmation.
- Existing map grouped-plan selection and saved-note focus checks exposed a
  surface-selector event bubbling issue; handlers now target only the buttons.
  A queued disclosure event also now uses its connected event target safely.
- Source health details collapse routine context and expand unavailable/stale
  observations. All 214 apartment records, source dates, histories, request
  reservations and evidence ledgers are byte-for-byte unchanged.
- Mobile CSS includes wrapping/min-width safeguards, single-column cards and
  boards, 44px controls, 16px fields and bottom navigation with safe-area spacing.
  DOM interaction checks use a Leaflet stub; real browser, map-tile and iPhone
  visual QA are not claimed by these automated checks.

## Second five-feature round — September 8, 2026

- 135 automated checks: 93 JavaScript and 42 Python. Added coverage for search
  save/restore/import, atomic over-capacity rejection, Atlas plan selection and
  missing data, mobile/desktop comparison parity, clipboard fallback and note
  privacy, move-in cash arithmetic and validation across both cost forms.
- Two independent reviewers found four bounded issues: two-bedroom hit circles
  rendered visibly, long mobile comparison identities could clip, copied quotes
  rounded cents, and the Atlas used a source date alongside a personal quote.
  All four were fixed and passed focused independent verification.
- Explicit null saved searches reject while legacy omission stays compatible.
  Undated personal quotes require a fresh quote; Atlas labels source and personal
  quote dates separately. Monthly lease costs and move-in cash stay separate.
- Static verification confirms 214 unchanged apartments and 22 immutable shared
  assets. Data observations, scan/evidence/usage ledgers and workflows are unchanged.
  No paid calls, leasing messages or appointments were made.
- Interaction verification uses DOM emulation; CSS audits cover responsive
  wrapping, chart hit areas, dark-theme labels and mobile chart text. This does
  not claim a real browser, map network, or physical phone visual test.

## Lean usability round — September 8, 2026

- One bounded independent audit; no second audit/verification-agent round.
- The audit and first regression pass exposed a shared density-selector event
  bubbling defect. The selector now binds only buttons. Targeted rechecks cover
  real checkbox clicks and saved-card focus after the fix.
- 100 JavaScript checks plus 42 Python checks cover the prior features and seven
  new cases: jump navigation/open-dialog protection, compact-list controls,
  finalist limits and notebook preservation, Chicago-time agenda/calendar inputs,
  section-dock navigation/saving, and legacy backup compatibility.
- Initial full-suite failures were followed by scoped rechecks of the affected
  paths. Required repository CI runs the full suite on the release revision.
- Static validation confirms 214 unchanged apartments and 22 immutable design
  assets. Source data, request ledgers and workflows remain unchanged. No paid
  calls or leasing messages were made. No browser/physical-phone visual QA.

## SpicyPicks — September 8, 2026

- One bounded independent ranking audit. Both findings were fixed: all linked
  building members now deduplicate before comparison, and future-dated source,
  quote and CTA evidence cannot receive freshness credit. No second audit round.
- Eight new regression cases cover valid local comparison cohorts, minimum sample
  size and duplicate locations, date gates, layout/status/filter exclusions,
  unknown base rents, cost uncertainty, priority switching and exact plan labels,
  saving snapshots, synchronized comparison controls, and Explore surface changes.
- The initial full JavaScript run passed 107 of 108 checks; the new two-bedroom
  lead check exposed a missing visible layout label. That label is added, and all
  eight focused SpicyPicks regressions pass. Required CI runs the full release
  suite. The 42 Python checks and static site validation also pass.
- All 214 apartments, source observations, scan/usage/evidence ledgers, workflows
  and 22 immutable design assets are unchanged. No paid provider calls were made.
- UI interaction checks use DOM emulation. Responsive CSS includes a horizontal
  mobile card row, wrapping content and 44px controls; no real-browser, live-map
  or physical-phone visual test is claimed.

## Decision Studio — September 8, 2026

- One bounded independent model audit found two issues: unchanged scans hid a
  recent price drop, and tradeoff lanes could repeat members of a linked building
  group. Both are fixed with deterministic regression cases. No second audit.
- The complete initial run passed 119 JavaScript checks and all 42 Python checks.
  A subsequent optimization reuses computed evidence for recipe changes; all 12
  focused Studio checks passed, including an added equivalence regression for
  fast remix versus full ranking. The final suite contains 120 JavaScript checks;
  required release CI runs that suite plus all 42 Python checks.
- New interaction coverage includes recipe changes and snapshot saving, exact
  two-home comparisons, sparse/empty area views, price filters and history focus,
  and advancing a next move after a saved layout check. Model coverage verifies
  quote freshness, current filters, grouping, sample medians, historical changes,
  priorities and nonmutation of inputs.
- The concurrent scheduled scan on GitHub was incorporated before release:
  390 apartment records, including 93 reported two-bedroom entries. Static
  validation passes with all 22 immutable design assets intact. This feature
  change does not modify source observations, usage reservations or workflows.
- Recipe scoring on the 390-record snapshot reuses its comparison evidence:
  approximately 0.27 ms per remix in Node locally, excluding DOM rendering and
  initial evidence computation. This is not a phone/browser performance claim.
- UI verification uses DOM emulation. Responsive rules cover wrapping, narrow
  layouts, internal tool navigation and 44px controls. No browser or physical-phone
  visual QA is claimed. No paid requests were made for development or validation.

## Discovery, list and map — September 13, 2026

**Revision.** SpicyHome `claude/spicyhome-discovery-list-map-x8vuyf` from `main`
at `cdbdafa`; design-system, same branch name, from `1ffd905` (v2.11.0) with one
commit `a2f8aa5` proposing v2.12.0. Every record, ledger and workflow is
byte-for-byte unchanged. Branch implementation only: nothing merged, tagged,
deployed or published; no RentCast, leasing or tour call.

**Rendered before it was edited,** over the committed feed in Chromium at
1280×900 and 390×844, both themes. Three weaknesses, measured:

1. **A tap on the map could not select a home.** 573 places sit on 365 recorded
   coordinates and only coordinate-identical ones were grouped, so 364 marks fell
   into 95 distinct 4px cells on a 360×388 pane, 362 with another mark's centre
   within 22px. A press at a mark's own centre selected a *different* mark 363
   times out of 364 on a phone, 357 of 364 at 1280.
2. **The plan and its cost evidence began below the phone's first dialog
   screen:** 589 of its first 760px were chrome — a two-row dock, a full-width
   *Save changes* before anything had changed, three short links one per row.
3. **Choosing a surface left it where it was:** *Map* left 203 of the map's
   388px on screen; *List* left the first apartment 1,549px down.

**Built upstream, then consumed it.** The answer is a design-system composition,
not app CSS: **`.sc-pick`**, the panel a plotted surface opens when a press
cannot name one mark — resolve by distance, ask nearest first when distance
cannot settle it, stay a popover rather than a modal. SpicyStock had improvised
it and Home needed it, this repository's bar for promotion. Home's half:
marks group by rendered proximity at the current zoom (`mapClusters()`), each on
a real recorded coordinate and carrying the number it stands for — without a
projection it is the coordinate-identical grouping the map always drew, so every
existing map contract holds. A press resolves by distance
(`mapPressCandidates()`); a crowd too large to name offers the zoom that
separates it. Leaflet, the coordinates, the costs and the notebook stay in Home.

**After,** same feed: 8 separable marks at 390px and 16 at 1280px for the same
573 places, **none** hiding another's centre, every press at a mark's own centre
naming that mark's place first. The largest crowd offers *Zoom in to separate the
other 198*, turning 8 marks into 63 and that crowd from 201 into 54. The dialog's
layout evidence starts at 479px of a 760px phone dialog (was 589), and every
surface reaches the top of the screen at both widths and under reduced motion,
keeping focus on the pressed control.

**Checks.** 123 JavaScript and 42 Python checks pass; `check_site.py` confirms 22
immutable assets and 574 unchanged records. The committed
`npm run browser-check` adds 86 Chromium scenarios: press resolution, the
popover, the surface reveal, the dialog head, missing tiles, stale/failed/empty
feeds, 320px, 200% zoom (a 640px CSS viewport), keyboard reach, a reloaded
shortlist, a damaged notebook. **It found a defect this milestone
introduced:** regrouping on a zoom replaced the very marker the directory had
just asked for, so its popup opened on a dead object — and a zoom far enough to
skip the animation raises both Leaflet events inside `setView`, so the first fix
listened too late. The reveal now listens before the move and opens on the mark
that exists after it; the surface listeners bind once per `#map` element. All 86
pass now. Upstream `check.mjs` is all good, `visual-check --browser` passes its
four pick scenarios, four mutants over the rule each turn it red, PR #23 is
green.

**Not claimed.** No merge, tag, release, deployment or Pages build; no physical
phone; no listing-accuracy or live-tile judgement. `.sc-actionbar` and
`.sc-field--group` shipped in v2.11.0 and are not this contribution, and Home's
refresh from the agreed combined source is owed once both upstream contributions
land: the family rollout is not complete.

**Reconciled, 13 September 2026.** SpicyCar's upstream branch
(`design/car-decision-polish`, PR #24) turned out to propose the *same*
v2.12.0 from the *same* base `1ffd905`, overlapping on all 33 files it
touches — every one of them a file this contribution also changes. Neither
could merge after the other without its generated output being rebuilt, so
the two were reconciled onto one branch at `d292a00`: the pick, the figure
basis and the transposed comparison as one release, every generated file
built once from the combined source. `.sc-pick` took band `4f`; Car's
figure-basis band stays **last** as `4g`, because a value slot sets its own
colour at one class of specificity and the basis has to follow it to win.

**That merge broke Car's contribution, and the fix is in.** Resolving the
`sc.css` conflict dropped the opening `/*` of Car's band comment, leaving a
stray `*/`. Braces stayed balanced, the source still read correctly, and
`build/check.mjs` reported *all good* — but the browser swallowed the whole
`.sc-estimate` rule as parser error recovery, so a derived figure rendered in
the heading ink, the exact thing that band exists to prevent. Found by
rendering Car's branch beside the merge: `rgb(47,55,65)` there against
`rgb(24,46,75)` here, with the rule absent from the CSSOM. `build/parse-check.mjs`
now gates the class — every class `sc.css` defines must survive into the
*parsed* sheet, since the existing rules only ever read the source text. Its
first version could not fail (a regex comment-stripper re-pairs around a stray
`*/`, so both sides of the comparison lost the same class); it scans now and
names the line.

Home was re-vendored from `d292a00`: `provenance.json` pins that commit,
version 2.12.0, all 22 hashes verified against both the vendored files and the
source tree. Re-run here: 123 JavaScript, 42 Python, `check_site.py` (22
assets, 574 records unchanged) and `npm run browser-check` 86/86. Upstream CI
is green on `d292a00`. Still no merge, tag, release or deployment.

### Repair, 13 September 2026 — every mark was in the wrong place

**What prompted it.** `main` moved after the merge: `track.yml` ran its daily
scan and committed `f74f76e`, thirty more apartments than the 573 this milestone
measured. Those commits are never checked — the workflow pushes with
`GITHUB_TOKEN`, and a push by that token starts no workflow, so `checks.yml` has
run on no data commit in this repository's history. Re-running the committed
gates against the record now on `main` turned one red: `1280px no mark hides
another mark's centre — 2 overlapping`.

**The defect, reproduced before it was touched.** In Chromium over that record,
two cluster anchors 40.5px apart in layer space rendered 14.6px apart on screen.
`dist/style.css` carried `.home-map-marker { position: relative; }`, added by
this milestone so the count badge on a grouped mark could be positioned against
it. Leaflet places every marker with `.leaflet-marker-icon { position: absolute }`
— the same specificity, and `style.css` loads after `leaflet.css`, so the app's
rule won and returned every marker to normal flow. Each mark's transform stayed
correct while its flow position marched down the DOM order: `offsetTop` 0, 14,
28 … 252. Every mark was off its own coordinates, by up to 112px at 390px and
266px at 1280px — and on a map whose tiles the check blanks, marks that are all
wrong still look evenly spread, which is how 86/86 was green over it. An
absolutely positioned element is already a containing block for its absolutely
positioned children, so the badge needed nothing: the line is deleted, not
replaced. After: one pane origin for all 20 marks, and no pair overlapping.

**The gate that missed it.** The checks read separation and resolution; none read
position. `every mark sits where its coordinates put it` subtracts each marker's
own transform and requires what is left — the pane origin — to be one point for
every mark, within half a pixel, at both widths. Proved both ways: restoring the
one line reddens it at 112px and 266px, and a mutant that crowds the marks
instead (`MAP_CLUSTER_RADIUS` 30 → 2) leaves it green at 0.0px while the
separation checks go red, so it fails for its own rule and for nothing else.

**Swept for the same class.** No other rule in `style.css` sets `position` on a
Leaflet or design-system class. One shared-class layout override remains,
`#map > .sc-pick { z-index: 900 }`, deliberate and winning on specificity rather
than on order. A second miss from the same pass is fixed here too: the milestone
changed `dist/style.css` but left `index.html` asking for
`style.css?v=20260909-layout4`, against this repo's convention of bumping that
token whenever the sheet changes — a returning reader could have been served the
pre-milestone stylesheet against the new script, or the reverse. Both tokens move
together here, as every release before this one moved them: `?v=20260913-mapfix`.

**Checks on this tree.** 123 JavaScript and 42 Python checks pass;
`check_site.py` verifies 22 immutable assets and 603 records; `npm run
browser-check` is **88/88** — the milestone's 86 scenarios plus the new one at
each width. **Not claimed:** no merge, no deployment, no Pages build, no physical
phone, and no live tiles — the check serves a blank pixel, which is exactly what
hid this defect from the screenshots.

### NEXT BUILDER PROMPT — finish the family rollout

One design-system release is published and one consumer has not taken it.
**Implement no new feature and choose no new finding.**

Starting points, all verified on 13 Sep 2026:

- `spicyChicken59/design-system` `main` is **`600283f`**, tagged and released as
  **v2.12.0**. It carries both upstream contributions as one release: `.sc-pick`
  (band 4f) and `.sc-estimate` / `.sc-unreported` / `.sc-signal-matrix--fit`
  (band 4g, last by cascade requirement), gated by `build/pick-check.mjs` and
  `build/parse-check.mjs`, both run by `node build/visual-check.mjs --browser`.
- `spicyChicken59/SpicyHome` `main` is at the repair above;
  `dist/design-system/provenance.json` pins `d292a00`, which is reachable on the
  design system's `main` through its merge commit, version 2.12.0, 22 hashes
  verified.
- **`spicyChicken59/SpicyCar` has NOT re-vendored.** Its snapshot still points at
  a pre-v2.12.0 design-system commit. This is the one thing outstanding.

Do, in this order:

1. **Re-vendor SpicyCar from `600283f`.** From a clean, committed design-system
   checkout at that commit run `node build/vendor.mjs <SpicyCar>/dist/design-system`
   (or Car's own snapshot path), then verify `provenance.commit` and all 22
   hashes against both the vendored files and `git show 600283f:<path>`. Do not
   hand-edit a vendored file.
2. **Rerun Car's own gates** and look at its shots before saying it is done.
3. **Then the family rollout is complete** — and not before. Say which consumer
   was still behind if you stop early.

Standing hazards worth knowing before you touch SpicyHome:

- A stylesheet rule that names a Leaflet or design-system class at equal
  specificity wins by load order and can silently undo the library's own
  layout. `npm run browser-check` now catches the map case; nothing catches the
  general one.
- `track.yml` commits a new scan daily and those commits run no workflow, so
  `main` can go red between merges without anyone being told. Re-run `npm test`,
  `npm run check`, `python tools/check_site.py` and `npm run browser-check`
  (88 Chromium scenarios; needs Playwright and Chromium, and reports SKIP and
  exits 1 without them) against the record actually on `main` before trusting a
  green recorded earlier. Whether to give that workflow a checking run of its own
  is the owner's call, not a builder's.

Preserve without exception: base rent versus advertised total versus known
subtotal, zero versus unknown, exact layout evidence, source dates, capped
coverage, resident versus public charging, provider records, request and
evidence ledgers, the notebook schema, local corrections, saved snapshots,
cross-tab conflicts and transactional import/export recovery. Invent no
availability, amenity or travel claim. Make no RentCast, leasing or tour call,
no merge to `main` without approval, no force-push, and no deployment.

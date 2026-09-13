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

### Milestone, 13 September 2026 — Find → Compare → Decide

**Revision.** Branch `claude/spicyhome-find-compare-decide-sijq32`, cut from
`main` at `abc9264` (the merge of #15). `dist/data.json`, `dist/status.json`,
`data/` and `dist/design-system/` are `origin/main`'s to the byte: no record,
no snapshot and no vendored asset was touched. Nothing was merged, deployed or
dispatched, and no provider request was made.

**Rendered before it was edited**, in Chromium over the committed 603-record
feed at 1280×900 and 390×844, both themes, through `tools/browser_check.mjs`'s
own server and feed doubles. Three weaknesses, each measured rather than argued:

1. **Three kinds of control, one visual language, and the two that belong
   together held apart.** The bedroom filter (which decides *which homes exist*)
   and the surface switch (which decides *how the same homes are drawn*) sat on
   one row at the same y in identical unlabelled pills; the second presentation
   control, list style, sat **869 px lower at 1280 and 1,561 px lower at 390**,
   inside the results column. SpicyPicks' ranking row was a third look-alike
   directly beneath. `aria-label` on a plain `div` named none of them to a
   screen reader either.
2. **Comparison could not be started from two of the five surfaces.** Measured
   over the committed record: 602 compare controls on cards, 3 on picks, 1 on
   the Atlas selection — and **0 of 602 map-directory rows and 0 in the
   apartment record**. A map press opens the record, so the map had no route
   into a comparison at all. The tray then printed `2 of 3 places selected` with
   no identity, no per-item removal, and one destructive `×`; narrowing the
   search to zero matches left that sentence **unchanged** while both
   selections were invisible on every surface of the page.
3. **A saved home said nothing about what was unresolved.** The board repeated
   the full discovery card plus a stage select and a Cost Lab button;
   `hasNextMove` was false. `nextMoves()` already computed the answer and only
   Decision Studio printed it. An empty Final Three cost a 151 px panel to say
   "pin up to three", and a card said "Some costs remain unquoted" while
   `costs().unknown` held the names and threw them away.

**Changed.** The deck reads in one order — what you are looking for, then how
you are looking at it — with each group captioned by the design system's
released `.sc-field--group` / `.sc-field__label`, the pattern written for
exactly this ("two unlabelled segmented rows side by side are unreadable as
soon as their words overlap"). `visibleHomes()` stays the one population and
each band says what its own kind of control does, so a count that differs
between List, Map, Atlas and Focus is explained instead of forced to match.
The record and the map's list now write the same `[data-compare]` into the same
`comparison` set through the same handler. `renderTray()` names each selection
by building and exact plan, removes one without disturbing the others, marks a
selection the current filters hide — kept, named, reachable in one press, with
the stored preferences untouched — and a fourth press names the three it would
have replaced and replaces none. The comparison states a rent or space
difference only where every column has that figure on the same basis, names
what is missing otherwise, declares no winner and invents no score.
`nextMove()` is one home's step and `nextMoves()` is that function ranked, so
the board and the studio cannot disagree; `field` names the exact notebook
input for a cost gap while `target` stays the step itself. `.sc-unreported` and
`.sc-estimate` (v2.12.0's figure-basis band) carry the word beside the mark for
an absent figure and the reader's own estimate.

**After** (same record, same browser): presentation controls **0 px apart at
1280 and 60 px at 390**, each captioned; compare controls 602/602 on the map
list and present in the record; the tray names three, removes one at a time,
and marks what a filter hides; the Atlas plots 425 of 602 with the 177 it
cannot place split by reason (15 with no base rent, 162 with a base rent and no
reported size); the empty Final Three is 49 px instead of 151, and the first
saved home starts at 657 px instead of 759.

**The connected journey, in a real browser** (`scratchpad/repro/journey.mjs`,
**39/39** at 1280 dark, 390 phone and 1280 light): filter → List/Map/Atlas/split
→ compare from the Atlas selection → add the second from the map's own list →
two exact plans in the comparison with a $100 base-rent spread and *not
comparable* for a missing size → a cost action opens that apartment's record →
record parking and save → back with the search, the surface and the selection
intact → pin a finalist → its next action opens `layoutReview`. No page error
at any width or theme.

**Checks run here** (offline, over the committed record and the committed
fixtures): `npm test` **133** (123 before, 10 added); `npm run check` 42 Python
checks; `python tools/check_site.py` 22 immutable assets and 603 records;
`npm run browser-check` **122/122** (88 before, 34 added across a deck/tray
section at 1280, 390 and 320 px and an Atlas axis section). Screenshots at
1280×900, 390×844 and 320×640 in both themes were looked at, not only counted.

**The mutants.** Seventeen over the rules this milestone adds — the hidden
selection, the tray's identities, the record's and the map list's compare
controls, the fourth-selection refusal, the named cost gap, the exact cost
field, the board's next step, the spread's comparability rule, the row
control's scope, the group captions, saving from inside the record, the shared
dot, `nextMoves` as ranked `nextMove`, the axis ladder, the two presentation
controls, and the follow-on row's width — **all seventeen died on the first
pass, each in the check that names its rule.** Three more were run over the
tray's size promises after those checks were rewritten; two died and one
survived — restoring `display` to a folded identity list changed no height,
because the boxes overflow the summary rather than growing it. That was a hole
in the check, not an equivalent mutant: folded has to mean *gone from the
layout*, and `a folded tray draws no box for what it is hiding` now says so and
kills it at all three widths.

**Two defects found by the new checks and fixed, each reproduced first.**
Rewriting the save handler to keep an open record open read `aria-label` off a
control that has none — the record's button says what it does in words — and
`null.replace` took the rest of that sweep down with it, so the button's text
never changed. And at 390 px a full tray widened the page to 541 px under a
390 px viewport: `.sc-actionbar__more` is `flex: 1 1 100%` with the default
`min-width: auto`, so its min-content width held the page open and the fixed
navigation bar stretched with it. The row is told it may shrink
(`min-width: 0; max-width: 100%`). A third, in Chromium 141: a closed
`<details>` still lays its content out, so the folded identity list added 38 px
to the bar until the closed state was stated (`display: none`).

**Shared design system: nothing changed, and that is deliberate.** The
vendored snapshot stays `d292a00` / v2.12.0 — verified here, 22 of 22 hashes
equal across `provenance.json`, the design system's own tree at that commit and
the files on disk, and that commit is reachable on the design system's `main`
through `600283f`. Everything this milestone needed already existed and was
**composed**: `.sc-field--group` + `.sc-field__label` for the captioned control
groups, `.sc-actionbar` + `.sc-actionbar__more` for the selection tray and the
board's next-step row (taking the notebook's palette through the component's
own token channel, never by overriding its rules), `.sc-unreported` and
`.sc-estimate` for the figure basis, `.sc-chip`, `.sc-sr-only`, and the
already-consumed `.sc-pick` / `.sc-figure`. `README.md`'s design-provenance
line claimed commit `08cd626f`, which `provenance.json` has not pinned for two
releases; it names `d292a00` now.

**Adoption other consumers would need — recorded, not done.** SpicyCar has an
open design-system branch `claude/spicycar-discover-compare-decide-h4hxfp`
proposing **v2.13.0**: `.sc-compare-pair` (a record comparison turned on its
side for a screen too narrow for two columns) and `[data-differs="true"]` (a
row marked as differing, never as a winner). SpicyHome is the concrete second
consumer that contribution names: its `.compare-mobile` stack and its
"Differences only" toggle are the same two problems, solved locally. Taking
them is a follow-up **after** that release is on the design system's `main` and
tagged — adopting from an unmerged branch would point this repository's
provenance at a commit `main` does not carry. Nothing in this milestone
duplicates either primitive: `.compare-spread` states a numeric spread between
comparable figures, which is neither a row mark nor a layout. Also unchanged:
`SpicyCar` has still not re-vendored v2.12.0 (the previous handoff's one
outstanding item), and this run did not touch it.

**Blockers: none offline. Not claimed:** no merge, no deployment, no Pages
build, no provider request, no physical phone, and no live map tiles — the
browser check serves a blank pixel, which is exactly what hid the marker defect
from the screenshots in the previous milestone. **A merge to `main` would publish, if Pages is
enabled.** `publish.yml` fires on a push to `main` touching `dist/**` — which
every file this milestone changes is — and deploys to GitHub Pages, but its job
is gated on the repository variable `SPICYHOME_PAGES_ENABLED == 'true'`, whose
value this sandbox cannot read. Treat a merge as a publish unless that variable
is known to be unset. `checks.yml` runs `npm test`, `npm run check` and
`python tools/check_site.py` on every push and pull request, so this branch and
its pull request are covered; it does not run `npm run browser-check`, which was
run here instead.

### NEXT BUILDER PROMPT — the shared comparison, then the family rollout

Verify the tips first; these were true on 13 Sep 2026.

- **SpicyHome** `main` is `abc9264` (the merge of #15). This milestone is
  `claude/spicyhome-find-compare-decide-sijq32`, open as a pull request, with
  `dist/data.json`, `dist/status.json`, `data/` and `dist/design-system/`
  byte-identical to `main`.
- **design-system** `main` is `600283f` / v2.12.0, tagged. SpicyHome's snapshot
  pins `d292a00`, the same tree, all 22 hashes verified.
- **An unmerged design-system branch proposes v2.13.0**
  (`claude/spicycar-discover-compare-decide-h4hxfp`, `ad5aa0f`): `.sc-compare-pair`
  and `[data-differs="true"]`, driven by SpicyCar PR #78.

Do these in order, and do **not** redo the discovery hierarchy, the comparison
tray, the cost-basis marks, the shortlist's next step or the Atlas pass.

1. **Adopt v2.13.0's record comparison here — once it is on the design system's
   `main` and tagged, not before.** SpicyHome's `.compare-mobile` stack is
   `.sc-compare-pair`'s case, and `compareDifferences` is `[data-differs]`'s:
   marking the rows that differ is better than hiding the rest, and this app
   already has the toggle. Re-vendor with `node build/vendor.mjs
   <SpicyHome>/dist/design-system` from a clean design-system checkout, verify
   `provenance.commit` and all 22 hashes against `git show <commit>:<path>` and
   the files on disk, then replace the local stack. Never hand-edit a vendored
   file and never vendor from an unmerged branch.
2. **SpicyCar has still not re-vendored v2.12.0.** That was the previous
   handoff's one outstanding item and it is still outstanding; this run did not
   touch SpicyCar. Doing it after (1) lands means one re-vendor, not two.
3. **The Atlas is a scatter of 425 points in one pane.** Overlapping plans are
   named where they coincide (within 7 px of the selected point) and the picker
   reaches every one, but a crowded region still cannot be aimed at. SpicyStock
   solved the same shape with a compressed axis and a nearby-chooser; whether
   this map-sized problem is worth that here is a product call, not a builder's.

Offline gates, all of which must pass before a pull request: `npm ci
--ignore-scripts`, `npm test` (133), `npm run check` (42 Python), `python
tools/check_site.py` (22 assets, 603 records), `npm run browser-check`
(**122** Chromium scenarios; it needs Playwright whose bundled Chromium
revision matches the one installed — 1194 here, which is playwright 1.56.x —
and reports SKIP and exits 1 without it). CI runs the first three on every push
and pull request; it does **not** run the browser check, so run it yourself.

Standing hazards, still true:

- A stylesheet rule naming a Leaflet or design-system class at equal
  specificity wins by load order and can silently undo the library's own
  layout. The map case is covered; the general one is not.
- A shared component's flex row is `min-width: auto` by default. Wide content
  inside one holds the whole page open and a fixed navigation bar stretches
  with it — measured at 390 px here. Give a consumer's instance `min-width: 0`
  rather than editing the component.
- Chromium 141 still lays out a closed `<details>`'s content. If the closed
  state must take no space, say `display: none` — do not assume it.
- `track.yml` commits a new scan daily and those commits run no workflow, so
  `main` can go red between merges without anyone being told. Re-run every gate
  against the record actually on `main` before trusting an earlier green.
- `publish.yml` deploys Pages on a push to `main` touching `dist/**`, gated on
  `SPICYHOME_PAGES_ENABLED`. Treat a merge as a publication.

Preserve without exception: base rent versus advertised total versus known
subtotal, zero versus unknown, exact layout evidence, source dates, capped
coverage, resident versus public charging, provider records, request and
evidence ledgers, the notebook schema, local corrections, saved snapshots,
cross-tab conflicts and transactional import/export recovery. Invent no
availability, amenity or travel claim. Make no RentCast, leasing or tour call,
no merge to `main` without approval, no force-push, and no deployment.

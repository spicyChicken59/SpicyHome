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

### Milestone, 14 September 2026 — the shared record comparison

**Revision.** Branch `claude/spicyhome-find-compare-decide-sijq32`, restarted
from `main` at `7c522d0` (the merge of #16, whose own pull request was already
merged — a merged pull request cannot track new work). `dist/data.json`,
`dist/status.json` and `data/` are `origin/main`'s to the byte; the only files
under `dist/design-system/` that change are the 22 the vendor wrote.

**The upstream release this takes.** design-system `main` moved to `14a752d`
(v2.13.0, PR #25) and the tag was published, after which `check` on `main` was
dispatched and is green (run 89) — the red on run 87 was the tag lookup alone,
and rule 1 re-reads `origin` at run time. v2.13.0 promotes two patterns two
consumers had each improvised: `[data-differs="true"]`, a row the records do not
agree on, and `.sc-compare-pair`, the matrix turned on its side below the width
two columns need. SpicyHome is the second consumer that contribution names.

**Re-vendored, not hand-edited.** `node build/vendor.mjs
<SpicyHome>/dist/design-system` from a clean design-system checkout at
`14a752d`, with no dirty file in that tree. Verified afterwards: `provenance.commit`
is `14a752d`, `provenance.version` is 2.13.0, it is the commit `refs/tags/v2.13.0`
points at, it is on that repository's `main`, and all **22 of 22** hashes are
equal across `provenance.json`, `git show 14a752d:<path>` and the files on disk.
A test holds the version, the commit, the count, every hash, and the six class
names the page composes — a snapshot rolled back below 2.13 would take the
styling with it and this says so.

**What the page gave up.** `.compare-mobile` / `.compare-metric` — SpicyHome's
own stacked phone comparison, about forty lines of markup and CSS — is deleted,
replaced by `.sc-compare-pair` with the notebook's palette handed to it through
the component's token channel. The desktop table is deliberately **not**
adopted as `.sc-signal-matrix`: that component brings a 680 px minimum width,
`border-spacing`, sticky columns and its own borders to a table that has none of
them, and the ask was the comparison pattern, not the table. Its differing rows
carry the shared attribute and one local declaration draws the mark, which is
recorded below as an upstream question rather than as a preference.

**Two behaviours the contract required, and one the render demanded.** Three
places can be selected and the pair shows two, so the heads carry the control
that chooses which two — a selection, never a silent truncation — and choosing
a place the other side already holds swaps them rather than comparing one
apartment with itself. Folding is allowed "only if the page says it did and
keeps them readable": the fold now names and counts what it put away, and the
plan and unit, the layout evidence, the base rent, the known monthly subtotal
and the source date are never folded. Then the render showed what the contract
did not: over three places the pair was marking rows by whether all THREE
agreed, so *Observed* was marked as differing above two identical dates. The
pair asks its own question now — the two in front of the reader — while the
matrix keeps asking about all of them.

**Measured in Chromium, inside this app's own scrolling dialog** (the claims are
the component's, but they have to survive `#compare-dialog`, which scrolls at
`max-height: 90vh`): at 390 px and 320 px the phone gets the pair and not the
matrix; the heads are `position: sticky` and, scrolled to the last of 14
measures, sit at 43 px against a dialog top of 42 with both names still read
("A · 721-27 Austin St", "B · 2030 Greenwood St"); the two value columns are
equal to the pixel (147/147 at 390, 112/112 at 320); the mark appears on labels
only, never on a value, and nothing is `.is-best`; no sideways scroll; no page
error. `.sc-eyebrow` lowercases by design, which turned a building into
"721-27 austin st" — `.sc-case` is what the sheet provides for a proper noun,
and a check reads the casing back.

**Checks run here.** `npm test` **137** (133 before, 4 added); `npm run check`
42 Python; `python tools/check_site.py` 22 immutable assets and 603 records;
`npm run browser-check` **138/138** (122 before, 16 added across a pair-view
section at 390 and 320 px). Screenshots at 390 and 320 px in both themes were
looked at — the second defect above came from looking, not from a count.

**The mutants.** Ten over the rules this adoption adds — the mark moved onto
the values, the matrix no longer marking, the fold taking the price basis with
it, the fold going silent, a third place truncated rather than chosen, a side
choice dropping the other place, the pair marking by the matrix's question, the
identities scrolling away, the matrix drawn on a phone, and a building name
lowercased. **Seven died on the first pass and three survived, every one of them
a hole in a check rather than an equivalent mutant**, and each is closed with
the check it showed was missing.

The side-choice mutant survived because `pairChoice()` de-duplicates on the next
render, so the wrong answer was rescued into a right-looking one — but only when
the displaced place happened to be the first: the check now swaps from a state
where neither side is the first place, where the mutant loses the displaced
place and shows another. The pair-scoping mutant survived because the fixture
had no row two of the three agreed on, which is the ONLY case that tells a
pair-scoped mark from a comparison-scoped one; the third place has its own
neighborhood now, and the matrix marks that row while the pair does not. And the
casing check could not have failed as written — `textContent` returns the source
text and cannot see a CSS `text-transform` at all, the second shape this file
names — so it reads the computed casing off the rendering instead. All ten die.

**Merged**, on the owner's word, as `8614118` (#17): the tree on `main` is
byte-identical to the tip these checks were run against, and `Checks` is green
on it (run 60). *Publish website* fired on the `dist/**` change and **skipped**
— its `if:` gate reads `SPICYHOME_PAGES_ENABLED`, which is still not `true`,
as it was not for the four merges before this one. Nothing has been served yet.

**The pre-publication sweep, since publishing is next.** What the Pages job
would upload is `dist/` — 35 files, 2.3 MB, of which `data.json` is 1.2 MB.
Read rather than assumed: no `.env`, key, token, credential-shaped string or
private setup file anywhere in the tree (`check_site.py` refuses `usage.json`
and `search.json` there by its own rule, and neither is present); the public
feed carries 603 sourced apartment records and **none** of the notebook's
personal fields — no notes, quotes, tour dates, saved searches or rent
overrides, which live in the reader's own browser and never reach `dist/`; the
`provider` block carries coverage and scan dates, no key. The seven hosts the
page can contact are the OpenStreetMap tile server, raw.githubusercontent and
api.github.com for the feed and its mirror, and google/openstreetmap/wikimedia
for the links and the photograph attribution.

**Not claimed:** no live map tiles, no physical phone, no provider request, no
deployment. Publication remains the owner's: the repository variable is the one
thing between this commit and a live page, and this sandbox cannot set it.

### Milestone, 14 September 2026 — the site is served

**Revision.** No code, no data, no vendored asset. `main` is `b2a5a93` (the
merge of #18) and the tree served is that commit's `dist/`, byte for byte the
one the previous entry's sweep read.

**Published, on the owner's word and by their hand for the part only they
could do.** The gate was never a defect: `publish.yml`'s `if:` reads
`vars.SPICYHOME_PAGES_ENABLED == 'true'`, so the job declined on all five
merges before this and reported `skipped`, not failed. The owner set Pages'
source to **GitHub Actions** and the repository variable to `true`; the
workflow was then dispatched on `main`.

**What the run did**, read off its log rather than assumed — two dispatches
landed three seconds apart (runs 29 and 30, `34841231758` and `34841235330`),
both green, both deploying the same commit, so the second was a no-op repeat
of the first:

| | |
|---|---|
| validated before upload | `python tools/check_site.py`, its own step, passed |
| uploaded | `github-pages.zip`, 522,141 bytes, SHA-256 `369c5509…` |
| deployment | `Created deployment for b2a5a936…` → `Reported success!` |
| url | `https://spicychicken59.github.io/SpicyHome/` |

**It republishes itself now.** Any push to `main` touching `dist/**`, and the
`workflow_run` completion of *Track apartments* or *Update city context* — so
the daily scan's commit, which triggers no other workflow, does reach the
public site. That cuts both ways: **`main` is now a publication**, and the
standing hazard about scan commits going unchecked is now a hazard about
unchecked bytes being served. `check_site.py` runs first and fails the job
before an upload, which is the only thing standing between a bad scan and the
reader.

**Not claimed, and this is the honest edge of it:** the served page has not
been read back. This sandbox's proxy refuses `spicychicken59.github.io` with
403 CONNECT, so the evidence stops at GitHub's own `Reported success!` and the
deployment URL it evaluated. First paint, the OpenStreetMap tiles, the feed
fetch and its mirror fallback are unobserved on the public origin — they are
covered offline by `browser-check`, which serves a blank pixel for tiles. Also
unclaimed, unchanged: no physical phone, no provider request, no leasing
message.

### Milestone, 15 September 2026 — traceable source access and dated evidence

**Revision.** Branch `claude/spicyhome-source-evidence-m6fqo1`, cut from `main`
at `2b1c8e1` — the tip when this began, and the same commit the branch already
pointed at, so nothing was reset, rebased or reconciled. `dist/data.json`,
`dist/status.json`, `data/history/`, `data/usage.json` and the whole vendored
`dist/design-system/` are untouched to the byte. No sibling repository was read
for anything but its pinned hashes, and none was written. No provider request,
no dispatch, no merge, no deployment, no leasing contact.

**Reproduced first, over the committed record** (`scratchpad/repro/source_repro.mjs`,
run against `2b1c8e1` before anything was edited; 1,000 records = 22 curated
plans + 978 provider rows, Chicago scanned 15 Sep returning 500 of 4,484):

| what the reader was shown | what was true |
|---|---|
| AMLI Lofts A320: **“Official source ↗”** | the building's *floorplans* page — a plan page, not an available unit |
| provider row: **“Find the listing ↗”** → a Google web search | a search labelled as a found listing; the absence of a listing URL was never said |
| “Sources behind this record”: URL + claim | the retained `observed_at` on every reference was dropped — 61 dated references in the feed, 0 printed |
| the fallback search | built from `address` alone; `unit_label` and `floor_plan` were lost |
| the record | carried no city-query context at all; the only coverage line on the page is the global one, which names **whichever city was scanned last** |
| a saved record | `{saved, finalist, snapshot, status}` — no query context, so nothing distinguished the query it was read under from today's |
| the monthly subtotal | named base rent, parking, fees and utilities; said nothing about resident EV charging either way |

All 978 provider rows carry `source_url: null` and a RentCast documentation
reference. That is the documented contract, not a defect: the published listing
schema has **no direct listing-page URL**, so none is invented and none is
guessed from a provider ID. What was fixed is the reader's route to checking it.

**Changed.** Five pure helpers in `dist/model.js` — `sourceAccess`,
`searchIdentity`, `sourceReferences`, `scanContext`, `chargingEvidence` — and the
surfaces that read them. A record's link is labelled by destination type
(listing page on record / building or plan page / your own link / provider
documentation); a missing exact listing URL is stated; the way out is a labelled
search over recorded public identity only — address, unit, plan, building name,
city, and nothing from the notebook. Each source reference prints its own date or
“Source date not recorded”. Each record reads the retained scan for its **own**
city, says when an area has none rather than borrowing one, and marks an
observation older than that query as not captured with it. Curated research is
never called a provider-query result. Building charging, its unquoted cost and
public-charging context are four separate answers, and the charging cost is named
beside the known subtotal, never inside it. Saving freezes the matching scan with
its own dates (`record.scan`, validated, backward compatible, carried through the
existing export/import); an archived record is never re-stamped, by a read or by
a save. The comparison gained *Source access* and *Listing query for this area*,
both unfoldable; cards name the destination type in the evidence stamp. One
producer line: the run records **when** it read the documentation reference
(`src/tracker.py`), which is the only date it genuinely has; the URL is unchanged.

**Three defects the screenshots found that the assertions had not.** The
source's own charging words were printed twice — once as the new status fact and
once as the old standalone note. The provider's single “Not reported by the
listing provider; confirm with leasing.” appeared as three identical bullets once
charging joined parking and access; one voice per fact now, each naming its
subject. And a saved record whose frozen query PREDATES the observation filed
beside it read “Observed for this home: Sep 15, 2026 — older than the recorded
query below”, which is a lie in the other direction: `scanContext` reports which
of the two came first now, and the page says “later than” when it is. All three
are pinned, the last by a check in each direction and by two mutants.

**Gates, all run here at the tip.** `npm ci --ignore-scripts`; **`npm test`
163** (137 before, 26 added); **`npm run check`** — JS syntax plus **43 Python**
(42 before); **`python tools/check_site.py`** — 22 immutable design assets and
1,000 apartment records verified; **`npm run browser-check --shots`
190/190** (138 before, 52 added across 1280 px and 390 px in both themes, plus
the reopened saved record); `git diff --check` clean. Playwright 1.56.1 was
installed unsaved against the preinstalled Chromium 141 (revision 1194);
`package.json` and `package-lock.json` are unchanged.

**Every new check was run against `2b1c8e1` and fails there** — 30 of the 52 new
browser scenarios fail on the pre-change tree, each naming its own reason
(“Official source ↗”, “Find the listing ↗”, no source sentence, no query line,
no charging row). The ones that pass on both are invariants the change had to
preserve: an open record raises no page error, pushes the page sideways nowhere,
and opens the record it named.

**The mutation pass: 25 mutants, all dead.** Twelve over the model rules, eleven
over the page's, two over the producer's, each run in a copy of the tree, and
none run while the tree was being edited.
**Two survived the first pass and both were holes**, closed with the check each
showed was missing: “today's query is stamped onto an archived record” lived
because no check ever ran a *save* path on an archived record — reading one
cannot restamp it, so the check now moves its stage and saves its notes; and
“provenance can be folded away” lived because the two compared places
*disagreed* on both new rows, so the difference rule kept them and the “never
folded” rule was never exercised — two places that agree is the case that can
fail, and a matching row with no such rule is asserted to fold beside it. A
third shape appeared in my own harness: `CSS.escape` escapes identifiers, not
quoted attribute values, so `[data-detail="rentcast:…"]` matched nothing, the
optional-chained click did nothing, and the provider assertions were re-reading
the curated record still in the dialog. Each read names the record it opened now.

**Screenshots looked at, not counted:** the record at 1280 px and 390 px in both
themes, curated and provider, plus the reopened saved record. The links row fits
one line at 1280 with the source route leading it and becomes full-width text
links on a phone; every link is a 44 px target; the source sentence is 42 px at
1280 and 84 px at 390 and stays inside the dialog; the two dated lines of a saved
record are 63 + 42 px at 1280 and 147 + 126 px at 390; nothing scrolls sideways
at either width. **No stylesheet changed**: every new element reuses `.meta`,
`.sourceline`, `.detail-links`, `.fact-list` and `.cost-table`, with the design
system's own `.sc-unreported` and `.sc-estimate` already carrying the figure
basis.

**Shared design.** Installed: **v2.13.0**, commit
`14a752dd0269bd6ebbb7080eb0d9e1922cd1ef2c`, 22 files. Approved upstream: the same
commit — it is the `v2.13.0` tag, it is `design-system`'s `main`, and `v2.13.0`
is the newest tag published. **Measured drift: 0 of 22**, checked both ways —
every installed file's SHA-256 equals its manifest entry *and* equals the blob at
that commit in the source tree. Nothing was re-vendored. **Reusable promotion
candidates: none this round**, and that is a measurement rather than a
preference: this pass added no CSS at all.

**Not claimed.** No live provider request and no new listing data — every check
answers the remote feed with the committed records. No physical phone and no
public origin: this sandbox's proxy still refuses `spicychicken59.github.io` with
403 CONNECT, so the served page is still unread by anyone. Fixture navigation
proves the route is labelled and reachable; it is **not** evidence that a live
apartment is available or that a source still offers a particular lease. The 978
provider rows still have no listing URL, and nothing here changes that — only
what the reader is told about it and what they can do next.

### Milestone, 16 September 2026 — the saved-home decision desk

**Revision.** Branch `claude/spicyhome-source-evidence-m6fqo1`, restarted from
`main` at `c983f6a` (the merge of #20) because its own pull request was already
merged; the branch carried only that merged history, so nothing unfinished was
discarded and nothing was reconciled. `dist/data.json`, `dist/status.json`,
`data/**` and the vendored `dist/design-system/` are untouched to the byte. No
provider request, no dispatch, no merge, no deployment, no sibling write, and no
notebook schema change.

**Rendered before anything was decided** (`scratchpad/repro/board_before.mjs`
against `c983f6a`, six saved homes: two curated plans, three provider rows, one
archived, three pinned, one ruled out):

| | 1280 px | 390 px |
|---|---|---|
| page height, six saved homes | 3,381 px | **9,199 px** |
| one saved home | **1,065 px** | **1,247 px** |
| controls under one saved home | **10** | 10 |
| first saved home begins at | 966 px | **1,451 px** |
| Final Three shelf | 358 px | 724 px |
| what the Final Three said | name, plan, price | name, plan, price |

The shortlist was the Discover card printed again, once per home, followed by a
next-step bar and three more controls — and the same disclaimer, *“Recording an
amount updates this step; opening the field does not.”*, under every single
home. A ruled-out home was 731 px of the same card, smaller only because
`nextMove()` returns nothing for it. Nothing on the first phone screen said what
any saved home cost, what was unresolved, or what to do next.

**Changed — composition, not mechanism.** Two pure helpers carry the new
answers. `openQuestions()` derives the unresolved list from facts the record
already holds — `costs().unknown`, `layoutEvidence()`, the parking and charging
evidence, the quote's age, the record's presence in the latest scan,
`sourceAccess()`, `tourProgress()` — and each item names the exact existing
notebook field or evidence section that settles it. `figureSpread()` is the
comparison's own difference arithmetic, extracted so the Final Three and the
full comparison cannot report the same numbers differently. `savedRow()`
replaces `renderCard()` on this surface; `savedGroups()` splits finalists,
contenders and ruled-out homes while every row keeps and can change its own
stage; the Final Three carries four comparable facts per finalist and one line
naming what differs. **No new notebook field, no new engine, no second
comparison, no ranking, score or winner.**

| | 1280 px | 390 px |
|---|---|---|
| page height, the same six homes | 2,807 px | **5,234 px** |
| one saved home | **475 px** | **648 px** |
| controls a reader faces | **4** | 4 |
| Final Three | 509 px, four facts each | 774 px, two lines each |
| first phone screen | — | the difference line and a finalist's money |

**Gates, all run here at the tip.** `npm ci --ignore-scripts`; **`npm test`
181** (163 before, 18 added); **`npm run check`** — JS syntax plus 43 Python;
**`python tools/check_site.py`** — 22 immutable design assets and 1,000 records;
**`npm run browser-check --shots` 250/250** (190 before, 60 added across 1280,
390 and 320 px in both themes); `git diff --check` clean. **47 of the 60 new
browser scenarios fail on `c983f6a`**, each naming its own reason; the pass on
both trees is either an invariant this had to preserve or was strengthened after
it proved it could pass on an empty surface.

**Six existing checks were updated, none weakened.** Four were selector-only
(`.home-card` → `.saved-row`, `.board-controls` → `.saved-row`); one now asserts
the row's step, its marked item and that exactly one item is marked; and one
guard against calling an absent home *leased* had to be scoped to the parts that
STATE a status, because the unresolved list says, correctly, that a capped query
missing a home *is not proof it is leased* — a bare word match read that as the
claim it refuses to make.

**The mutation pass: 13 over the new rules, all dead** — and the previous
milestone's 25 were re-run against this tree and all still die, so the source
and evidence work #20 landed is intact. **One survived the first pass and was a
hole:** a pinned home's *Final Three* marker on its own row was asserted only by
the browser gate, which CI does not run, so a jsdom-level regression would have
reached `main` unseen. It is pinned in both now, in each direction — pinning
adds the marker, unpinning removes it.

**One defect this milestone's own journey found.** Ruling a home out moves it
into a folded section, inside its own folded *More* — and a control inside a
closed `<details>` is not focusable, so the focus fell to the body in the exact
journey the brief names. `focusHomeControl()` opens **every** ancestor
disclosure now, not just the nearest; the section opens where the reader put the
home and is folded again on a later visit. Reproduced by a check that fails
without the fix, and by a mutant.

**Screenshots looked at, not counted**, at 1280, 390 and 320 px in both themes:
the desk, the unresolved list open, and the ruled-out section. A ruled-out home
is dashed and at 0.72 opacity — measured at **8.9:1** contrast in dark and
**6.3:1** in light, so it is demoted, not made hard to read — and returns to
full opacity on hover or focus. Nothing scrolls sideways at any width, and
every control a reader faces is a 44 px target; the one that was not, the tour
agenda's *Directions* link at 27 px, is fixed.

**Shared design.** Installed **v2.13.0**, commit
`14a752dd0269bd6ebbb7080eb0d9e1922cd1ef2c`, 22 files; the newest tag `origin`
carries is still v2.13.0. **Measured drift: 0 of 22**, both ways. Nothing was
re-vendored and no vendored byte moved. One honest consequence: the old
next-step bar was the design system's `.sc-actionbar`, and **this surface no
longer uses it** — the pattern it models (chip, one sentence, one action, a
follow-on row) is gone from the desk, and with it `nextMove().why`, which is
still printed by Decision Studio's Next moves. `.sc-unreported` still carries
the unquoted amounts on every row. **Reusable upstream candidates, as candidates
only:** a *counted disclosure* (a folded section whose summary carries the count
of what it holds, so folding never hides how much is open) and a *demoted
record* (dashed, reduced opacity, restored on hover and focus). Each has exactly
one consumer today, so neither is proven shared; neither was released and no
sibling was edited.

**Not claimed.** No live provider request and no new listing data: every check
answers the remote feed with the committed records. No physical phone and no
public origin — the proxy still refuses `spicychicken59.github.io` with 403
CONNECT. A fixture is not proof of a lease, an availability, an amenity or an
external source.

### Milestone, 16 September 2026 — the tour-day walkthrough

**Revision.** Branch `claude/spicyhome-source-evidence-m6fqo1`, restarted from
`main` at `46d17b8` (the merge of #21, whose post-merge `Checks` run
35037554446 and `Publish website` run 35037554413 are both green) because its
own pull request was already merged and the branch carried only that merged
history. `dist/data.json`, `dist/status.json`, `data/**`, `src/**` and the
vendored `dist/design-system/` are untouched to the byte; the notebook schema is
unchanged. No provider request, dispatch, booking, calendar mutation, merge,
deployment or sibling write.

**Rendered before anything was decided** (`scratchpad/repro/tour_before.mjs`
against `46d17b8`, a saved provider contender with a tour date, two checks done
and a note):

| | 1280 px | 390 px | 320 px |
|---|---|---|---|
| record dialog | 3,252 px | 5,603 px | 6,469 px |
| the walkthrough's own height | 678 px | 1,338 px | 1,707 px |
| **from the last check to the first field** | 956 px | **1,657 px** | **1,940 px** |
| the apartment named where the reader is working | **no** | **no** | **no** |
| checkbox | 17 px | 17 px | 17 px |

Standing in the apartment, the first phone screen carried the dock, the tail of
an introductory paragraph, and checks 01–05. **Nothing on it said which
apartment it was** — no unit, no plan, no address, no tour date, no progress —
and the fields that record what a check finds were four screens below, past the
cost table, the parking and charging facts, the atmosphere and the price
history. The parking evidence a reader needs at the parking check sat 1,000 px
above it.

**Changed — composition, not mechanism.** `tourCompanion()` gained a head
carrying the building, the exact plan or unit, the address, the tour date when
one is recorded and a directions link built from that recorded address;
`tourCheckEvidence()` puts what the record already holds beside the four checks
it holds anything about, and returns nothing for the four it does not. The
walkthrough moved from five sections above the notebook form to directly above
it. No field was duplicated, no second checklist or tour record was created, and
`tourChecks` and the record schema are exactly as they were.

| | 1280 px | 390 px | 320 px |
|---|---|---|---|
| **from the last check to the first field** | **20 px** | **20 px** | **20 px** |
| the apartment named where the reader is working | **yes** | **yes** | **yes** |
| checkbox / target row | 24 / 151 px | 24 / 100 px | 24 / 121 px |

**Gates, all run here at the tip.** `npm ci --ignore-scripts`; **`npm test`
187** (181 before, 6 added); **`npm run check`** — JS syntax plus 43 Python;
**`python tools/check_site.py`** — 22 immutable design assets and 1,000 records;
**`npm run browser-check --shots` 310/310** (250 before, 60 added at 1280, 390
and 320 px in both themes); `git diff --check` clean. **40 of the 60 new
scenarios fail on `46d17b8`**, each printing its own before-number.

**Eleven mutants over the new rules, all dead**, among them: a recorded $0
parking cost read as not quoted; the source's silence about parking read as *no
parking*; the charging cost said to be in the subtotal; an unavailable public
dataset read as *no stations nearby*; a tour nobody scheduled given today at
9 AM; directions built from coordinates rather than the recorded address; a
source-listed plan read as a layout the reader checked; and the walkthrough
drifting back away from the fields.

**One layout defect this milestone's own measurement found.** The head is sticky
so the apartment stays named while eight checks scroll past, and the record's
dock is **66 px at 1280 but 108 px on a phone** — it wraps to two rows — so a
64 px offset hid 21 px of the head behind it. The offset is per width now and a
check measures the overlap at every width, so a dock that changes shape again
fails rather than quietly clipping.

**Screenshots looked at**, at 1280, 390 and 320 px in both themes: the
walkthrough on opening, the charger check's evidence, and the fields after a
jump. The head rests below the dock at every width; the charger check reads
*“Building charging unknown. Its cost is quoted by no one here and is not in the
subtotal. No public charging dataset is loaded, which is not evidence that there
are none nearby.”*; a field jumped to sits clear of both sticky bars with its
half-typed text intact.

**Shared design.** Installed **v2.13.0**, commit
`14a752dd0269bd6ebbb7080eb0d9e1922cd1ef2c`, 22 files; still the newest tag.
**Measured drift: 0 of 22**, both ways, nothing re-vendored and no vendored byte
moved. No shared-component usage changed either way: the walkthrough is
app-scoped `tour-*` styles, and the record's `.sc-estimate` and `.sc-unreported`
marks are as they were. **Reusable upstream candidates: none this round** — the
only new pattern is a section head that sticks under an existing sticky bar,
which is an offset this consumer measures for itself rather than a component.

**Not claimed.** No live provider request and no new listing data. No physical
phone and no public origin — the proxy still refuses `spicychicken59.github.io`
with 403 CONNECT. **No external navigation fixture proves an apartment fact:**
a directions link opening is not evidence that the building, the unit, the
parking or the charger is as the record describes.

### Release acceptance, 16 September 2026 — the Final Three on a phone

**Revision.** `main` at `75007e4` (the merge of #22), whose post-merge runs were
both green on that commit: *Checks* 35041190857, and *Publish website*
35041190850, whose steps ran in order — `check_site.py` passed before the
upload, then `deploy-pages`. The committed feed is untouched: `generated_at`
**2026-09-15T13:28:27Z**, **1,000 records** (978 provider listings, 22 curated
building plans), **8 city scans** — Chicago capped at 500 of 4,484 and
`truncated`, the other seven complete, Evanston's the oldest at 8 Sep. The
vendored design system is **v2.13.0 / `14a752d`, 22 files, drift 0 both ways**
and was not touched. No provider request was made and no schedule was changed.

**One release blocker, found by looking at a screenshot rather than by any
gate.** On the Decision Desk at 390 px and 320 px, a pinned home whose name is
long — a provider listing, which is 978 of the 1,000 records — rendered its
Final Three card unreadable. Measured in Chromium at `75007e4`, over the three
homes the acceptance walk saved (the gate's own fixture saves a different three
and reads different numbers for the same defect):

| 390 px | name | rank badge | money |
|---|---|---|---|
| AMLI Lofts | 104 px | 19x19 | 117 px |
| 6700 S South Constance Ave | **42 px, 8 lines** | **10x38, "0" over "2"** | 221 px |

At 320 px the name box measured **0 px wide and 503 px tall** and **overlapped
the price**; `UNRESOLVED` read as `UNR / ESOL / VED`. The cause is one track:
the card is `grid-template-columns: minmax(0,1fr) auto` on a phone, and the
money column holds a price *and* its basis sentence ("Provider asking rent ·
verify the exact unit"). An `auto` track takes that sentence at max-content
before the `1fr` identity column gets anything, so the apartment's name is left
with whatever remains. `AMLI Lofts` looked right only because its caption
("Base rent from · A320") is short.

**Repaired, smallest change that holds.** The money column is
`fit-content(40%)`, so a short caption still sizes to its content and a long one
cannot take the identity's half; `.finalist-number` is `flex: 0 0 auto`, because
the card sets `overflow-wrap: anywhere` for long addresses and a rank badge is
not an address; and `.finalist-grid .actions` is `overflow-wrap: normal`, so
*Open* is a button rather than "Op / en". **Three declarations and two comments
in `dist/style.css`, no logic, no markup, no model change.** Measured after:
name 136 px at 390 and 94 px at 320, rank 19x19 at every width, no overlap, the
price on one line. **1280 px is byte-identical** — the number, name and money
boxes measure exactly as they did before.

**The class, swept and closed.** Every heading that names an apartment, on all
ten surfaces, at 390 px and 320 px: **0 squeezed**. The desk row, the cards, the
quick scan, the picks, the comparison, the Atlas and the tour all size their
identity independently of a caption.

**Gates, all run here at the repaired tip.** `npm ci --ignore-scripts`;
**`npm test` 187/187**; **`npm run check`** — JS syntax plus **43** Python;
**`python tools/check_site.py`** — 22 immutable design assets and 1,000 records;
**`npm run browser-check --shots` 315/315** (5 added, one per
viewport/theme the desk suite already walked); `git diff --check` clean. **The
new check fails at `75007e4`** on 390 px dark, 390 px light and 320 px dark, and
passes at 1280 px in both themes, which is exactly where the defect lives; it
prints each card's own before-numbers.

**That check over-asserted on its first writing, and the gate caught it.** It
said the name must always be at least as wide as the money beside it, which is
false for a short name: `AMLI Lofts` asks for 104 px and gets exactly 104 px
next to a 117 px money column, and nothing is wrong with that. It measures what
the name ASKED for now — one unwrapped line of its own text — and requires the
name to get either that or, when the card cannot give it, at least the money
column's width. Same three labels red at `75007e4`, and the 320 px line now
names the squeeze directly: `AMLI Lofts: name 72px of the 104px it wants`.

**Acceptance, walked from a fresh browser profile** against the committed feed:
open → freshness and coverage → filter → list and map → a provider record → what
is provider-reported versus unknown → the labelled search fallback → save → save
a curated plan → the desk → subtotal and missing costs → pin three → compare →
the Tour Companion → record a layout, a $0 parking quote, a date and notes →
back to the desk with the answered questions gone → rule out and recover →
reload → reopen the saved evidence → and again with a home the feed no longer
carries. **All twenty steps pass.** Also challenged: an empty feed, no filter
matches, a stale status, a dead feed, Chicago's capped query beside Evanston's
complete one, a record with no coordinates, a feed serving `javascript:` and
`data:` source URLs, an explicit `$0` against an unquoted item, charging
yes/no/unknown with the public dataset unavailable, one finalist rather than
three, export, an unreadable notebook, a notebook pinning four finalists, and
keyboard-only operation including focus returning to the control that opened a
record. Nothing else was repaired.

**Not claimed.** No live provider request, no new listing data, no physical
phone. **Public-origin verification is BLOCKED:** this sandbox's proxy refuses
`github.io:443` with 403 CONNECT, so nobody has read the served page back. The
publish workflow succeeding proves the deployment ran, not that the origin
renders. No fixture proves a lease, availability, amenity, price or source
validity.

### Milestone, 16 September 2026 — a map you can read prices off

**Revision.** Branch restarted from `main` at **`55a853a`** (the merge of #23,
whose post-merge runs are both green on that commit: *Checks* 35050232849 and
*Publish website* 35050232850, whose steps ran in order — `check_site.py` before
the upload, then `deploy-pages`). The committed feed is untouched: `generated_at`
**2026-09-15T13:28:27Z**, **1,000 records** (978 provider listings, 22 curated
building plans), **999 with recorded coordinates on 534 distinct ones**, one
without. The vendored design system is **v2.13.0 / `14a752d`, 22 files, drift 0
both ways**, and was not touched. No provider request was made, no schedule was
changed, and no sibling repository was written.

**What was there, read before anything was changed.** `.map-dot` was a 12x12px
rounded *square* — `border-radius: 4px` — in a hard-coded wine that ignores the
theme, with a separate rounded-rectangle badge (`.map-dot-count`) hung off its
top-right corner for a crowd. The price existed in the markup and was
**invisible**: `.map-marker-label` is `clip-path: inset(50%)`, for screen readers
only. So the map answered *where* and *how many* and never *how much*, and the
reader had to open every apartment to find out. `mapSelection` was tracked in
four places and **rendered nowhere** — nothing on the map showed what the reader
had chosen, saved or pinned.

**The history, recovered.** The first build (`d3beb83`) did print prices: a
`.map-price` pill on **every** placed home, with no clustering at all — 999 pills
over 534 coordinates, which is the "hundreds of overlapping price pills" case.
`b028946` replaced it with the silent dot, and `a8c79ba` added the cluster and
the press-by-distance panel that this milestone keeps. SpicyCar's
`.car-map-dot` was read and not copied: taken from it are the circle, the count
*inside* it, a size that grows with `log2` of the crowd and a cap, and state as
an outline rather than a new hue. Left behind are its 12px hit radius, its
two-tone local/shipping fill and its `is-pick` accent — Home resolves a press by
distance over a 22px reach, and its own colours mean something else.

**What was measured first, and what it decided.** In Chromium over the committed
feed, at 1280/390/320 px, split and map surfaces, every zoom the reader can
reach. A `$1.7k` pill measures **49x19px**; marks are never closer than
`MAP_CLUSTER_RADIUS` = 30px, and their nearest-neighbour distance runs 30–64px
(median 32–45). So a label is about four times the width of the dot it replaces,
and two marks far enough apart to be *told apart* are not necessarily far enough
apart to be *read* — which is the whole of the density question, and none of it
is a record count.

The measurement then said something I had not expected, and it changed the
design: **space is almost never what withholds a price.** Counting, at each
zoom, marks with no agreed figure against marks that had one and no room:

| 1280px | visible marks | no agreed figure | had a figure, no room | printed |
|---|---|---|---|---|
| fitted metro (z9) | 14 | 13 | 0 | 1 |
| +2 (z11) | 61 | 49 | 3 | 9 |
| +3 (z12) | 34 | 14 | 8 | 12 |

Placed labels cover **0.1–6.6%** of the pane and **no two ever collide**, so the
brief's "prefer them if they stay legible at more density than expected" is
answered: legibility is not the limit. The limit is honesty — a mark standing
for several apartments at different rents has no one figure to print. I also
measured whether the cluster radius was the real lever and it is not: dropping
it 30 → 22 moves the fitted metro view from 1 printed of 14 marks to 2 of 26 and
leaves the zoomed-in count at 9 either way, while eating the 8px of margin the
gate's "no mark hides another mark's centre" rule lives on. **It stays 30.**

**What it draws now.** One shape, three forms of it. A place is a circle
(`border-radius: 50%`, 16px, theme tokens rather than the hard-coded wine).
A crowd is the same circle grown by `clusterSize()` — `18 + log2(n)*3`, capped
at `MAP_CLUSTER_RADIUS - 2` so two of them can never touch — with the number
**inside** it; the badge that hung off the corner is gone. And where a mark can
honestly print a price and has room for it, the circle is replaced by that price.

`markPrice()` is the honesty rule, and it is the card's own contract: a mark
prints a figure only when **every** place under it prints **that same figure on
the same basis** (`displayPrice` and `priceKind`, the two the card already
prints). A crowd whose rents differ has no number. A place nobody quoted has no
number — never `$0`. Two records that happen to share a number on two different
bases have no number, because one pill would say they are the same kind of money.
`compactMoney()` rounds to the nearest hundred (`$2,663` → `$2.7k`) and leaves
anything under a thousand exact; the **exact** figure and its basis word stay on
the mark's own screen-reader label, in its `title`, in the panel a press opens
and on the card, and the map's caption says underneath that a mark is rounded and
is never an all-in cost, a verified current rent or proof that the exact unit is
free.

`placePrices()` is the space rule, and it runs on the marks **as drawn** — after
every redraw, after a zoom, after a pan, after a resize. It reads each mark's own
painted box, offers a label to the reader's own marks first (Final Three, then
shortlist, then the order the clusters were built in, so the same map answers
the same way twice) and takes one only where it clears every mark already on the
map by 2px and sits wholly inside the pane. Nothing else changes: the clusters,
their anchors on real recorded coordinates, the press-by-distance panel and the
directory are the ones `a8c79ba` proved.

**State, in the marks this app already uses for it.** The shortlist fills its
mark wine, as the heart fills; the Final Three add the warm ring the desk gives
their rank; and the mark the reader is on takes the focus blue and is raised over
its neighbours. `paintSelection()` only toggles a class, so choosing a mark never
re-shuffles the labels on the rest of the map. Three states, two accents already
in the palette, no new vocabulary — and the selection is the one thing here that
had no representation at all before.

**One press rule extended, for the one thing that changed under it.** A price
reaches further than the dot it replaced: its far edge is 24px from the
coordinate where a dot's was 8. `mapPressCandidates()` now counts a press
**inside a painted label** as that mark's, at distance 0, so it sorts first;
every other mark within the same 22px finger still joins the list, so a crowd
behind a label stays exactly as reachable as before. A label is only ever placed
where it covers no other mark, so nothing can hide under one.

**The journey, walked over the committed feed** (`scratchpad/release` harness,
1280 and 390 px, **15/15**): pressing `$2.7k` selects that mark and opens the
record it stands for, `amli-evanston`; the popup repeats the exact figure and
its basis (`Base rent from · A420: $2,739`) rather than the rounding; *Open
details & notes* opens `amli-evanston` and nothing else; closing it leaves the
mark still chosen and the focus on that home's own list control; choosing a
place in *Places on this map* selects its mark and opens its popup, the same
identity both ways. At the fitted metro zoom the largest mark stands for **243
places**, prints no price, and a press opens the panel that asks which one you
meant — choosing one opens `rentcast:720-Benedetti-Dr,-Naperville,-IL-60563`,
the record's own id, unit and plan intact. The one home the feed cannot place
reads *(998 of 999 · 1 without a recorded location)* in the directory and is
never given a position.

**Gates, all run here.** `npm test` **194/194** (7 new); `npm run check` — JS
syntax plus **43** Python; `python tools/check_site.py` — 22 immutable design
assets and 1,000 records; **`npm run browser-check --shots` 337/337** (22 new,
eleven per viewport); `git diff --check` clean. **Every one of the seven new
unit tests fails at `55a853a`**, run there against the pre-change `dist/` with
this branch's test file. Seven mutants over the new rules, each against a COPY
of the tree rather than the live one: six die, each only in the tests that name
its rule, and a control mutant that only edits a comment stays green. One
survivor was mine and it was the shape this file keeps finding — zeroing the
FIRST home's figure left the unanimity comparison to reject it, so the test
passed *because a different rule said no*. Zeroing every home's figure is what a
`$0` leak actually looks like, and that one dies in `a place with no quoted
figure gets a mark and no number`, alone.

**Five of the new gate checks could not fail, and running them against
`55a853a` is what showed it.** `no price label covers another mark`, `no price
label is cut off by the map's edge`, `a printed price is its own record's
figure` and `a metro-wide map degrades to circles` were all green on the tree
that prints no price at all: a map with nothing to draw satisfies "nothing
overlaps" and "nothing is cut off" without being a map that prints prices —
the first shape this file names, a check that passes because a different fact
makes it moot. Each asks first whether that map had a figure to print
(`candidates > 0`, a mark carrying a `.map-price` at all), and the sparse
state's `touches no other mark` asks that one was printed. **Twenty of the
twenty-two new checks now fail at `55a853a`**; the two that remain are the
two page-error checks, which are of that kind by nature. The margin on the
metro state is thin and worth knowing: at 390 px exactly **one** of the 14
marks carries a figure today, so a scheduled data commit that clusters that
one away turns those four checks red. The message says why — *0 had a figure*
— and that is the right answer to look at rather than a green that means
nothing.

**The screenshots, compared state for state against the boxed marks rather than
admired on their own.** Twenty-eight map states captured the same way before and
after — sparse, moderate, dense Chicago, the whole metro, overlapping
coordinates, a selection, a shortlist with a Final Three — at 1280, 390 and
320 px in both themes, over a stand-in street tile at the lightness
OpenStreetMap serves (the gate blanks its tiles, which is right for a geometry
check and useless for a legibility one).

| state | marks | prices before | prices after | label ink | sideways scroll |
|---|---|---|---|---|---|
| metro 1280 | 43 | 0 | 3 | 0.4% | none |
| metro 390 | 14 | 0 | 1 | 0.7% | none |
| metro 320 | 9 | 0 | 1 | 0.9% | none |
| Chicago only 1280 | 20 | 0 | 4 | 0.5% | none |
| Evanston 1280 | 28 | 0 | 7 | 0.9% | none |
| Evanston 390 | 14 | 0 | 3 | 1.8% | none |
| Evanston 320 | 14 | 0 | 3 | 2.6% | none |
| one neighbourhood 1280 | 4 | 0 | 3 | 0.4% | none |
| 21 homes on one coordinate | 2 | 0 | 1 | 0.1% | none |

Looked at, not just counted. **Before**: 12px rounded squares in a hard wine,
each with a blue count box hanging off its corner — at 390px the badge of one
mark sits *over* the square of its neighbour — and not one number on the map.
**After**: `$2.5k · $2.3k · $2k · $1.9k · $1.8k · $1.6k` sit on the map beside
circles reading `44 · 23 · 19 · 15 · 12 · 5 · 3 · 2`, the count inside the
circle. The 21 apartments on one Naperville coordinate are one circle marked
**21** with no price, because their rents differ, and the single beside them
reads `$1.8k`. The chosen mark carries a 3px blue ring at every width. A saved
home's mark is filled; the Final Three add the warm ring.
At 320px in the overlapping state **no price is printed at all**, and that is
the rule working rather than failing: the single's label would span 240–290px of
a 290px pane, flush with the edge, so the circle stands instead.

**CI went red on this branch for something that is not this milestone's, and
the sweep found eight more of it.** `source details stay compact when healthy`
asserts that a healthy feed leaves `#source-status` closed. The app opens that
disclosure when `ageDays(feed.provider?.last_success ?? feed.generated_at) > 7`,
and `data/seed.json` is dated **2026-09-08T04:18:00.506Z**, so `floor(age)`
became 8 at **2026-09-16T04:18:00Z** — between the local run that passed at
04:07 and the runner that failed at 04:19. The seed had simply become stale,
and the test was asserting that a feed the app rightly calls stale looks
healthy. It supplies its own fresh feed now, and passes with the clock moved
+30 and +400 days.

The class is this file's own worst kind — a test whose answer depends on the
hour it runs — so it was swept rather than patched and forgotten. A twelve-line
harness (`--import` a module that shifts `Date`) runs the suite at an offset
clock: at **+0 days one test fails, at +7 days nine do.** The other eight are
the SpicyPicks and Decision Studio suites, whose engines read
`pickAge(home.observed_at, now)` against fixture dates that are equally fixed —
`SpicyPicks shows priorities` expects 3 cards and gets 0 once the fixture's
observations age past the pick windows. **They are not red yet and they are not
repaired here**: dating those fixtures relative to the clock is its own change,
and widening this one to carry it would hide both. They are named here, and
above in the next-builder prompt, with the harness that finds them.

**What was deliberately not done.** No map mode and no settings toggle: the
brief asks for one only on evidence that it is needed, and the measurement says
the answer is decidable from the boxes without asking the reader. No change to
`MAP_CLUSTER_RADIUS`, to `mapClusters()`, to the press panel, to the directory or
to any model function — the diff is the marker's markup, its stylesheet, the two
placement passes and one extra clause in `mapPressCandidates`. And **no derived
figure**: a cluster's cheapest, its median or a "from $X" would all put a number
on the map that no card behind it prints, which is the one thing the brief's
semantics rule forbids. Where that is the only number available, the mark says
how many places it holds and the price stays one press away.

**Limitations, unchanged and stated rather than worked around.** Public-origin
verification is still **BLOCKED** from this sandbox — the proxy refuses
`github.io:443` with a 403 CONNECT — so a green *Publish website* run proves the
deployment workflow succeeded and **not** that the served page renders; reading
it back needs a browser outside this environment. Google Fonts is blocked here
too (`ERR_CERT_AUTHORITY_INVALID`), so every screenshot above shows fallback
faces, and the map tiles are stand-ins, not OpenStreetMap's own. Nothing here
claims current lease availability, live pricing, parking, charging or source
validity: every figure on a mark is a recorded figure from the committed feed,
rounded, with its basis beside it.

### Milestone, 16 September 2026 — why this one is in front of you

**Revision.** Branch restarted from `main` at **`040c3ba`** (the merge of #24,
green on both post-merge runs: *Checks* 35057402747 and *Publish website*
35057402770, whose `check_site.py` step ran before the upload and `deploy-pages`
after it). The committed feed is untouched: `generated_at`
**2026-09-15T13:28:27Z**, **1,000 records** (978 provider listings, 22 curated
building plans), Chicago capped at 500 of 4,484, Evanston's scan the oldest at
8 Sep. The vendored design system is **v2.13.0 / `14a752d`, 22 files, drift 0
both ways** and was not touched. No open pull request, no newer scheduled data
commit, no provider request, no schedule change, no sibling repository written.
**#24's map treatment is preserved and re-verified**, not re-done.

**The eight "clock-dependent" discovery tests were not clock-dependent, and
proving that came first.** The previous milestone's sweep shifted `Date` with an
`--import` module and reported eight failures at +7 days. The app is evaluated
*inside* the jsdom window (`w.eval(model + app)`) and reads **that window's**
`Date`; the shim only patched the Node process's. Measured directly: process
`2026-09-23T05:02:58Z`, window `2026-09-16T05:02:58Z`, `w.Date !== globalThis.Date`.
So every fixture — `picksSnapshot()` and `studioSnapshot()` already stamp from
`Date.now()` — was dated seven days into the page's **future**, and `pickAge()`
refuses a future observation by design. The instrument, not the suite.

**Fixed where the fault was: the test clock boundary, not a production rule.**
`SPICYHOME_TEST_CLOCK_SKEW_DAYS` now moves **both** clocks together —
`shiftWindowClock(w)` carries the window forward and `testNow()` stamps the
fixtures from the same instant. Unset, as in CI, it is zero and nothing changes:
the clock is carried, never frozen, so a rule that reads the calendar still
reads a real one. No freshness window was widened and no assertion was weakened.
The explicit aging tests stay where they were, in `tests/model.test.mjs` against
a pinned `deskNow` (`Quote is 46 days old`, the undated quote, the absent
record), untouched by any skew. **`npm test` is 206/206 at +0, +7, +30 and +400
days.** A new check asserts the invariant and its consequence together — the
page's clock equals the fixture's, and three picks render — and it dies under
the exact mutant that caused the false alarm: at +7 days with
`shiftWindowClock` removed it fails, at +0 it passes because no divergence is
possible.

**What actually surfaces a candidate, traced before anything was drawn.** Under
defaults, `visibleHomes` keeps 999 of 1,000 and `spicyPicks` ranks 766 eligible.
Every *balanced*, *budget* and *space* pick is a provider listing with a
`provider_reported` layout, `[parking, monthly fees, utilities]` unquoted and
penalty 9; the dominant contribution is exactly the chosen weight — `budget`
32.1 balanced, 62.4 budget; `space` 52.3; `amenities` 45.0 for the curated
`amli-900` under *EV + parking*, whose `value` signal is 0 because its quote is
older than seven days. `openQuestions` returns the same order for all of them:
`layout > cost:parking > cost:monthly fees > cost:utilities > amenity:parking >
amenity:charging > tour > source`.

**What the surfaces say now.** `surfacedBecause()` returns the rules that
actually ran for that record, and `whyBlock()` draws at most three of them on
the card itself rather than behind the existing disclosure — which keeps its job
of holding the full evidence. Three sources, in that priority:

1. **A gate the reader moved off its default.** A filter still at its default
   narrowed nothing, so it explains nothing and is not offered. Each sentence
   **re-checks the record against the gate it names** rather than trusting the
   caller: asked about a Chicago listing under an Evanston filter, or a
   provider-reported layout under the source-evidence filter, it stays silent.
2. **The signal the chosen priority weighted most**, read back off the weights
   the ranking already used — `(signals[key] × weights[key])`, largest first,
   zero-weight entries excluded. A recipe says so in its own kind, so the studio
   can mark it as the reader's own mix.
3. **Recorded facts those rules read**: room under the cap on the chosen basis,
   the layout's evidence status, a recent observation, a recorded price move.

Because it is derived from the current preferences on every render, a reason
whose rule stops applying stops being drawn. Measured on the page: choosing an
area adds *"In Oak Park, the area you chose"* to every pick that matched it and
returning the filter to `all` leaves **zero** `.why-item--filter` chips behind;
narrowing the cap to $1,600 renames the figure *and* the cap in the same
sentence; switching the basis renames the basis, not just the number.

**The one unresolved fact** is `headlineUnknown()`: the record's own first open
question in `openQuestions`' existing decision-weight order — the order
`nextMove()` already takes the shortlist's single step from — declining only the
`tour` kind, because a visit the reader has not arranged is not a property of
the apartment or of its evidence. Nothing outstanding returns `null` and the
surface says nothing rather than inventing a slot-filler. A layout question's
detail is suppressed because it *is* the evidence label the card already prints
beside the plan; every other kind keeps its caveat, which appears nowhere else.

**One defect of mine, found by the edge sweep and fixed.** A record with no
quoted base rent read *"$3,000 under your $3,000 base-rent cap"* — its known
subtotal is zero, so the arithmetic offered the whole cap as headroom and it
would have read as the cheapest thing on the page, against this repository's own
rule that unknown base rents never become cheap picks. An unquoted rent is not a
budget reason now, and a test pins it.

**Measured offline.** `npm test` **206/206** (11 new) — and 206/206 at +7, +30
and +400 days; `npm run check` 43 Python; `python tools/check_site.py` 22
immutable design assets and 1,000 records; **`npm run browser-check --shots`
353/353** (16 new, eight per width); `git diff --check` clean. **Every new test
fails at `040c3ba`**: the four surface tests run there and go red, the model
suite cannot even import two functions that do not exist, and the same gate run
against that tree is **339/353** — 14 of the 16 red, the two that survive being
the page-error checks, which are of that kind by nature. **Eight mutants over the new
rules, on a copy of the tree: all eight die, each only in the tests that name its
rule, and a comment-only control stays green.** Two instrument faults were found
and fixed on the way: a copy missing `src/` made the control "die", and a stale
copy of `tests/` judged one mutant against a suite nobody had.

**A check that could not fail, and one that read nine reasons as one card's.**
`the attention surfaces never print a verdict, a score or a confidence` was
green on a tree with no explanation at all — it now asks for the block before
checking it, and fails at `040c3ba`. And `'.pick-card .why-item'` over the
document matches every card at once, which is how a three-reason cap first read
as nine; the reads are scoped to one element.

**The journey and the edges.** The acceptance walk is **32/32** at 1280 and 390:
freshness before anything, a provider pick and a curated plan each explained by
the rule that ranked it, one open question each, budget → basis → layout-evidence
→ area changes each re-writing the explanation, Focus holding the same
vocabulary, the pick opening its own exact record with full provenance, and the
same pick still there on return. A page-edge pass is **7/7**: an empty
qualifying set leaves no explanation standing, a capped city still names its
area filter, the one unlocated record stays in the list, no reason escapes its
card at 320px, and a pick is still reachable on the map by its own identity —
#24's selection intact. A model-level sweep over fifteen states — curated and
provider, all three layout-evidence kinds, parking/charging yes/no/unknown, a
recorded `$0` against a missing cost, current against stale, history and none,
a missing exact URL, absence from a capped scan, no coordinates, the longest
provider identity, and an unquoted rent — reports **0 semantic violations**
against the four rules that matter: no verdict language, nothing implying an
all-in cost, no `$0` read as unknown, no public station read as a resident
amenity.

**Composition.** No new tab, dashboard, score, confidence, ranking schema,
generated prose or persistent preference model. The card grows from 429 to 620px
at 390 and 503 to 734 at 320 — still well under the full apartment card — and
nothing scrolls sideways at any width. The sticky Focus action bar covers **0px**
of the block at 390 and 320, measured at the scroll position that would hide it.

**Limitations.** Public-origin verification remains **BLOCKED** from this
sandbox: the proxy refuses `github.io:443` with a 403 CONNECT, so a green
*Publish website* run proves the workflow succeeded and not that the served page
renders. Google Fonts is blocked here too, so every screenshot shows fallback
faces. No figure in any explanation is anything but a recorded figure from the
committed feed with its basis beside it — nothing here claims current
availability, live pricing, parking, charging or source validity.

### Milestone, 16 September 2026 — the downtown lens, and what it cannot see

**Revision.** Branch restarted from `main` at **`f310e2f`** (the merge of #25,
the explainable-discovery milestone, merged at the start of this pass after a
scoped audit: head `1fe24dc`, both `verify` runs `success`, `mergeable_state`
clean, nine files, no review thread). The committed feed is untouched:
`generated_at` **2026-09-15T13:28:27Z**, **1,000 records** (978 provider
listings, 22 curated building plans). The vendored design system is **v2.13.0 /
`14a752d`, 22 files, drift 0**, re-verified and not touched — no upstream change
was needed and none was made. **#24's price-forward map marks are preserved**:
the lens adds no marker class, colour or category, and the map simply plots the
same narrowed set the cards do. No provider request, no schedule change, no
sibling repository written.

**The evidence was traced before any feature was designed, and it is thin.**
Measured over the committed record rather than assumed:

- **No provider listing can be classified at all.** `API-SOURCES.md` documents
  RentCast's listing schema and it carries no storey count, floor count,
  building class or subtype; `src/tracker.py` reads every documented field plus
  two undocumented layout probes (`unitLayout`, `floorPlanType`). So this is the
  provider's schema, not an artefact of normalising it. `property_type` is a
  DWELLING type — Apartment 866, Condo 61, Single Family 41, Multi-Family 5,
  Townhouse 5 — and the repository's own rules refuse reading a structure off
  it. A regex sweep for every structural word over every string in all 1,000
  records returns **zero hits on all 978 listings**.
- **All 22 curated buildings match, and every one of them is the same trap.**
  The hit is `access.note` — "Confirm step-free entrances, elevators and the
  route from parking to the apartment" — two spellings, 22 of 22. It is a
  question to go and ask on a tour, not a description of a building. Ten more
  match on "rooftop", which is not a height: a four-storey building can have a
  roof terrace.
- **Exactly one record in the whole snapshot describes its own building.**
  `73-east-lake.atmosphere`: *"Spacious high-rise homes with built-in shelving
  and a rooftop terrace."* From `https://www.experience73.com/`, observed
  2026-09-07. **Nothing affirmatively establishes a low or mid-rise anywhere.**
- Geography, by contrast, is solid. `search_area.center` is recorded
  (41.882, −87.632, "central Chicago") and every record but one carries
  coordinates. Neighborhood NAMES are not: 295 of the 305 Chicago records read
  "Chicago · neighborhood unverified", so a name-based downtown test would be
  silent for almost every listing. The lens is built on the coordinates.

**So the feature is a reading, not a filter, and it says so.** `buildingForm()`
reads three named source-backed fields — the building description, the
advertised amenities, and what each cited source is recorded as supporting — and
returns `high_rise`, `low_mid_rise` or `unknown` with the phrase it matched, the
field, the source link and **that source's own observation date**. `access.note`
is not among the fields it reads. Price, neighborhood, address, unit number,
property type, luxury branding, map density and the building's own NAME are
never read: a record titled "Willis Tower Apartments" whose only "tower" is its
own name returns `unknown` with reason `name_only`. Two sources describing one
building two ways returns `unknown` with reason `conflicting_text`. Over the
committed record: **1 high-rise, 0 low/mid-rise, 999 unknown** — and the page
draws a form mark only where there is one, because no mark is not a claim, while
the panel says in words that *a height nobody wrote down is not a low building*.

**Three preferences, on the filter panel that already exists.** A downtown lens
(`urbanScope`: core ≤ 1 straight-line mile, near ≤ 3), a `targetRent`, and
`highRise`. All three default to off, none of them is anyone's universal truth,
and no helper is named after a person. `visibleHomes()` now takes the feed and
resolves ONE anchor (`urbanAnchor`) for both the existing radius gate and the
new lens, so the mileage that filtered a card and the mileage the card prints
cannot come from two different points — pinned by a test that moves the recorded
centre and watches both follow. A record with no coordinates is `unlocated`,
never `outside`: it stays in every unfiltered list and is never given a position.
`highRise` never filters anything; it is a ranking signal worth 1 for a recorded
high-rise and **0, never −1, for an unknown**, plus a sixth SpicyPicks priority
(*Downtown value*) that gates on geography and weighs parking, evidence and
recorded form above budget. `recipeDefaults` gains `form: 0`, so no stored
recipe shifts.

**A target is the reader's own number and never a cap.** Each card carries its
distance from the target on the basis the budget filter is set to, beside the
line naming what is still unquoted: $2,650 with parking unquoted is not $2,700
all in, and the band never says it is. `under` / `near` (±5%) / `stretch` (above
target, inside the cap) / `outside` — a stretch is labelled as above target and
**stays on the page**. Over the committed record with a $2,700 target and the
near-downtown lens: 125 records in the band, 42 under, 44 around, 32 stretch,
6 with no quoted figure, and **1 past the $3,000 cap — 73 East Lake at $3,104,
the one building the record can honestly call a high-rise**. The panel counts it
and names the figure it would take to see it rather than dropping it in silence.

**Parking keeps four answers.** A price on record (a recorded $0 is an amount,
not a gap), advertised with no price quoted, a source reporting none, and
nothing recorded. Over the record: 2 priced, 19 advertised-unpriced, 0 none,
979 unrecorded. The detail line leads with the standing, then the source's own
note, then the caveat, so an unknown reads as unrecorded and never as a refusal.

**Measured.** `npm test` **228/228** (22 new: 97 model, 131 page) and 228/228 at
**+0, +7, +30 and +400 days** with both clocks carried together — no freshness
window widened, no assertion weakened, the explicit aging tests untouched.
`npm run check` 43 Python tests. `python tools/check_site.py` — 22 immutable
design assets, 1,000 records. `git diff --check` clean. `npm run browser-check --shots` **377/377**, with a
new 24-check lens section (twelve checks at 390px and at 1280px).

**A performance defect of my own, found by measuring rather than by a gate.**
`budgetBand()` built all four of its label sentences to use one, and `money()`
constructed a fresh `Intl.NumberFormat` on every call: over the 1,000-record
feed that cost **358ms per render**, on every keystroke in the search. One
formatter, built once, and only the band's own sentences: **4.3ms**, an 83×
improvement, and `money()` is now cheap for every surface that already used it.
`buildingForm()` over the same 1,000 records is 13.8ms.

**Twenty-five mutants, all behaving as expected, with a live control.** Every
trap has one: reading `access.note` as a source, "rooftop" in the phrase list,
dropping the `floor-plan` guard, accepting the building's own name, moving the
storey line by one, taking the first of two conflicting sources, scoring an
unknown height as −1, giving the distance gate its own anchor, calling an
unlocated record far away, a band that forgets its basis, a stretch that stops
at the cap, an unknown parking answer worded as a refusal, `$0` read as no
quote, a lens reason that outlives its preference, today's date stamped on an
old snapshot, and seven page mutants (a form chip on an undescribed building,
a panel that talks while the lens is off, missing evidence reported as an
absence of buildings, a cap overflow dropped in silence, a band without its
caveat, a map population the cards do not have, a verdict word on a lens
surface). A comment reworded stays green.

**Three holes the mutants found, each closed with the check it was missing.**
The `floor-plan` guard was dead against my trap corpus — no trap string had a
digit before "floor" — so "See all 34 floor-plans online" is a trap now and the
mutant dies. The access-note mutant was equivalent, because no phrase in the
list matches "elevators": the assertion now uses a note that WOULD classify if
the field were ever read, which is the actual contract. And
"a high-rise reason is never offered" passed because a different rule rejected:
the ranking readback filters a zero-weighted signal out before `signalReason` is
asked, so breaking either guard alone changes nothing observable. Either guard
alone is genuinely equivalent; the mutant that matters breaks **both**, and the
test now drives the priority readback directly — once for an undescribed record
(no sentence) and once for a described one (the sentence), so it cannot pass by
producing nothing.

**Looked at, not only exit codes.** Screenshots at **1280 light and dark, 390
light and dark, and 320** were opened and read, not just counted. At 320px the
panel is 258px wide with zero overflow and all five of its sentences fit; the
page does not scroll sideways at any width. The band costs a card 49–64px of
510–680, under a fifth of its height everywhere. On 73 East Lake's card the
three chips — *Parking advertised*, *EV unverified*, *High-rise recorded* —
wrap without collision, and the band reads *"$404 above your $2,700 target /
Base rent only · parking, monthly fees, utilities not quoted"* in the caution
colour rather than the positive one. Desktop puts the lens select on the area
row and the target beside the minimum and maximum.

**The acceptance journey, walked in Chromium over the committed record: 76/76
steps** at 1280 and 390 — open with the lens silent, no band and no form mark
before anything is asked; narrow to near-downtown and watch the map list hold
exactly the cards; set the target and read the counts; turn on the height
preference and read the honest absence; raise the cap and watch the one
described building arrive with its chip, its band naming it as above target,
its record quoting the words and the source's own date; open an undescribed
building and read *unknown is not a low-rise*; run the Downtown value priority
and check every pick for two to four concrete reasons and one or two unresolved
facts; then turn each preference off in turn and watch only its own sentence
leave.

**One page error, reproduced and proved pre-existing, not fixed.** The journey
surfaced a Leaflet `TypeError: Cannot read properties of undefined (reading
'_leaflet_pos')`. It reproduces **identically on `f310e2f`**, this milestone's
base, with no lens involved: open the filter
panel and change the bedroom select in the same frame, and the resize starts a
zoom whose `transitionend` lands after `removeMap()` has taken the panes away
(`_onZoomTransitionEnd` → `_move` → `_getMapPanePos`). Two candidate fixes were
tried and **neither moved it** — guarding the `ResizeObserver` on the observed
pane's `isConnected`, and `map.stop()` before `map.remove()` — so both were
reverted rather than left in as speculative code. It is recorded here, the
journey names it explicitly and fails on any other error, and the map system
#24 delivered is left alone.

**Not claimed.** Current availability; complete downtown coverage; that every
high-rise in the area has been found — one record in a thousand describes its
own building, and the rest are unrecorded rather than short; live rent; that a
parking space is available; or that any place here is objectively good value.
Nothing was deployed, and no leasing or provider contact was made.

### Closing pass, 16 September 2026 — the lens gets a starting point, and an absence gets a name

**Revision.** Branch restarted from `main` at **`d5bdf4b`** (the merge of #26,
green on both post-merge runs: *Checks* 35067651580 and *Publish website*
35067651606). No open pull request existed at that tip. The committed feed is
untouched — `generated_at` 2026-09-15T13:28:27Z, 1,000 records — the vendored
design system is **v2.13.0 / `14a752d`, 22 files, drift 0**, and #24's map marks
are unchanged.

**This is not a second milestone: it closes three things the brief asked for
that #26 did not deliver.** Re-reading the brief against what actually shipped:

1. **Part G asked for a preset**, and for *parking importance* to be
   expressible. #26 shipped three separate preferences and no way to say parking
   mattered except a hard filter that would have hidden all 979 records whose
   parking nobody recorded — the exact "unknown is not no" trap the same brief
   forbids.
2. **Part N asked for more empty states** than the one #26 wrote. Nothing said
   anything when the band held nothing at or under the target, or when the lens
   matched nothing at all.
3. **The acceptance journey runs 35 steps.** #26's walk stopped at the Double
   Down surface and never reached save, the Decision Desk, Final Three, the
   comparison, the Tour Companion, a reload, or a saved record the feed no
   longer carries.

**The preset reuses the mechanism that already existed.** `state.savedSearches`
is already a named-preference store with a one-press load and a live match
count, so *Downtown value* is offered beside the reader's own saved searches and
loaded the same way. It **merges** rather than replaces — a bedroom size or a
layout-evidence setting survives being handed a lens — every value it sets stays
in the control it came from, and each turns off by itself. `lensPresets` is a
data table; nothing is named after a reader, and changing its four fields turns
it into a quiet two-bedroom search in Evanston.

**`parkingPreferred` raises what is said, not what is shown.** With it on, an
advertised space (or a price on record) becomes a reason the place surfaced, and
the parking question becomes the first unresolved fact — *not recorded*, *price
not quoted*, or *the source reports no resident parking*, three answers kept
apart. It is **never a gate**: a mutant that makes it one dies. Ranking is
deliberately unchanged — every priority already weighs advertised parking
through the amenities signal, and weighing it twice would be a scoring engine.

**Two more empty states, both about the snapshot rather than the world.** *This
retained snapshot holds nothing at or under your $1,300 target in this area*
(and a separate sentence when nothing sits *around* the target, and another when
nothing in the area carries a quoted base rent at all); and, when the lens
matches nothing, *Nothing in this retained snapshot sits inside the downtown
lens and your other filters* — naming what the lens keeps, noting that a place
with no recorded coordinates is outside any distance, and offering one control
back out.

**The 35-step journey, walked end to end: 76/76** (38 steps at 1280 and at 390)
over the committed record, from a fresh profile through the preset, the target
and basis, a supported high-rise and an unrecorded one, parking support apart
from parking cost, the reasons and the unresolved facts, three preference
changes each taking only its own copy, the map by name, the record and its
source, save, the Decision Desk, Final Three, the comparison carrying building
form and parking, the Tour Companion, a reload, **a saved record absent from the
feed that still reads and claims no building form**, the empty lens and its way
out, the capped-scan statement, and a keyboard pass. One step failed first time
and it was the check, not the page: the preset sits inside the saved-search
disclosure, and a control inside a closed `<details>` is not focusable — this
file's own recorded hazard. The check opens the disclosure the way a reader does
and asserts focus and an accessible name once open.

**Measured.** `npm test` **233/233**, and 233/233 at +0/+7/+30/+400 days.
`npm run check` 43 Python tests. `python tools/check_site.py` 22 design assets,
1,000 records. `git diff --check` clean. `npm run browser-check --shots`
**393/393**, with 16 new lens checks (eight at each width).
**31 mutants** behave as expected with a live control — six new ones covering
the preset replacing instead of merging, an unrecorded parking answer becoming a
reason, the parking preference becoming a gate, an advertised space asked about
as if it had none, an empty lens reported as an empty area, and a target nothing
reaches passed over in silence. Screenshots were read at 1280 light and dark,
390 light and dark, and 320: the preset card carries its name, its live count
("125 places now") and its note; the four checkboxes wrap without collision; the
panel is 258px wide at 320 with zero overflow and no page scrolls sideways.

**A pre-existing map defect, fixed properly on the third attempt.** The 35-step
walk surfaced the Leaflet `_leaflet_pos` error this file had recorded as open,
and the new lens interactions made it red a previously-green gate check — so
looking past it was not available. The stack named the cause the earlier guesses
had missed: the fit a RE-RENDER performs started a zoom animation whose
`transitionend` outlived the map the next re-render destroyed. A re-render's fit
is `animate: false` now (it has nothing to animate from), the reader's own *Fit
all homes* stays animated, and the reproduction goes from two errors on the base
to zero here. The mutant that puts the animation back brings the errors back.

**Not claimed**, unchanged: current availability, complete downtown coverage,
that every high-rise has been found, live rent, parking availability, or value
as an objective fact.

### NEXT BUILDER PROMPT — live, and level except SpicyStock

> **Superseded, 19 September 2026.** The cross-repository items below — the
> SpicyStock re-vendor, the upstream design-system notes, the other consumers'
> tips — are a dated record of where the family stood on 15–16 September and
> are no longer an assignment for a SpicyHome builder: SpicyHome work is
> SpicyHome-only, and SpicyStock, SpicyCar and the design system are read-only
> from here. The offline gates, the environment notes and the standing hazards
> that follow remain true and are re-stated with current counts in *Personal
> quote dates — September 19, 2026* below, which is the authoritative
> checkpoint. Nothing under this heading was rewritten.


Verify the tips before trusting any of them; the SpicyHome and design-system
lines were re-read on 15 Sep 2026, the other two were not, and two of these
repositories commit to `main` on a schedule.

- **design-system** `main` is `14a752d`, **v2.13.0, tagged**, and `v2.13.0` is
  still the newest tag `origin` carries.
- **SpicyCar** `main` was `62db117` on 14 Sep, a `snapshot 2026-09-14` tracker
  commit over `aea4fa3` (#79). It vendors **v2.13.0**. Not re-read since.
- **SpicyHome** `main` is `f310e2f` (the merge of #25), vendoring **v2.13.0**
  with zero hash drift, **and served** at
  https://spicychicken59.github.io/SpicyHome/ — the publish job validated and
  deployed it (Checks 35062162017, Publish website 35062162004, whose
  `check_site.py` step runs before the upload and `deploy-pages` after it).
- **SpicyStock** `main` was `ce2c6c1` (#61) on 14 Sep and still vendored
  **v2.11.0** (`6f10309`). Not re-read since.

Do these; do not redo the discovery hierarchy, the comparison tray, the
cost-basis marks, the shortlist's next step, the Atlas, this adoption, #24's
map marks, or the downtown lens. In particular, do NOT widen `buildingForm()`
to infer a building's height from price, neighborhood, a downtown address, a
unit number, a building name, luxury branding or map density, and do not
hand-enrich records one by one to make the feature look fuller: one record in
a thousand describes its own building, and saying so is the product. If a
future provider or a new curated source ever supplies a real structural field,
add it as another named source field and let the counts move on their own.

1. **SpicyStock is the last consumer behind, by two minors.** It is also the
   other consumer v2.13.0 names: the upstream commit cites its marking of the
   rows two pinned records differ on. Re-vendor it from `14a752d` and replace
   that local marking with `[data-differs="true"]`, which styles the row's own
   label and never a cell. It has its own open method work (a dry run on a green
   or yellow session); this is a separate milestone from that, not a tail on it.
2. **Two questions this adoption raises upstream, neither urgent.**
   `tr[data-differs="true"]` is styled only inside `.sc-signal-matrix`, so a
   consumer whose comparison table is its own — SpicyHome's is — must declare
   the mark locally or swallow a component it does not want. The mark reads as a
   property of the row, not of the matrix that happens to hold it. And
   `.sc-actionbar__more` is `flex: 1 1 100%` with the default `min-width: auto`,
   which holds a page open when its content is wider than the bar (measured at
   390 px here, fixed in the consumer). Both are notes for whoever opens the
   next design-system release, not defects to route around.
3. **Publication is done, so `main` is now a publication.** The variable is
   set and the site is live; the entry above records the run. Two consequences
   for anyone working here, neither of which existed on 13 Sep:
   - A merge to `main` touching `dist/**` **serves the bytes**, and so does the
     daily scan — `publish.yml` also fires on the `workflow_run` completion of
     *Track apartments* and *Update city context*. The scan's own commit still
     triggers no test workflow, so the tree that reaches the reader can be one
     no gate has read except `check_site.py`, which the publish job runs before
     it uploads. That check is now load-bearing in a way it was not: widen it
     rather than route around it if a scan ever serves something wrong.
   - **Nobody has read the served page back.** This sandbox cannot: the proxy
     refuses `spicychicken59.github.io` with 403 CONNECT. A builder with a
     browser outside it should walk the connected journey once on the public
     origin — first paint, the OpenStreetMap tiles, the feed and its
     `api.github.com` mirror fallback, a deep link, and the phone width — and
     record what it found here. `browser-check` covers all of it offline
     against a blank tile, which is precisely the gap.

Offline gates, all of which must pass before a pull request: `npm ci
--ignore-scripts`, `npm test` (**206**, and the same 206 under
`SPICYHOME_TEST_CLOCK_SKEW_DAYS` at 7, 30 and 400), `npm run check` (**43**
Python), `python tools/check_site.py` (22 assets; it prints whatever the
committed feed holds — **1,000 records** on `040c3ba`), `npm run browser-check
--shots <dir>` (**353** Chromium scenarios; it needs a Playwright whose bundled Chromium
revision matches the one installed — 1194 here, which is playwright 1.56.x, and
`npm install --no-save --ignore-scripts playwright@1.56.1` gets it without
touching `package.json` — and it reports SKIP and exits 1 without it). Also
`git diff --check`, which CI enforces as `git diff --exit-code`. CI runs
everything except the browser check on every push and pull request, so run that
one yourself and LOOK at the shots.

Standing hazards, still true:

- A stylesheet rule naming a Leaflet or design-system class at equal specificity
  wins by load order and can silently undo the library's own layout. The map
  case is covered; the general one is not.
- **CORRECTED 16 Sep 2026.** The note here previously said eight SpicyPicks and
  Decision Studio tests would go red within seven days of any run. They do not,
  and the sweep that said so was measuring its own instrument: the app is
  evaluated INSIDE the jsdom window and reads that window's `Date`, while the
  `--import` shim patched only the Node process's, dating every fixture into the
  page's future. `picksSnapshot()` and `studioSnapshot()` were already relative
  to the clock. One clock moves both now — `SPICYHOME_TEST_CLOCK_SKEW_DAYS=7 npm
  test` — and the suite is 206/206 at +0, +7, +30 and +400 days. **The standing
  hazard that remains is the shape, not those tests:** a fixture dated from one
  clock and read by another says nothing about either. `the fixture clock and the
  page's own clock are one clock` pins it, and any new jsdom harness must carry
  `shiftWindowClock(w)` or that check fails at every non-zero offset.
- `data/seed.json` still carries a FIXED `generated_at` (2026-09-08), so a test
  that boots it and asserts a *fresh* feed ages out. One did, on 16 Sep, eight
  days later to the minute. Supply a fixture dated from `testNow()` when what is
  under test is not the aging itself.
- Every map marker's icon box is **28x28 and must stay so**, whatever it draws.
  Leaflet places each one by a transform off a single pane origin, and `every
  mark sits where its coordinates put it` reads that origin back by subtracting
  the transform from the box's centre — a box that changed width per mark would
  move the centre with it and the check would stop meaning anything. The circle
  and the price are centred inside the box and overflow it without resizing it.
- A shared component's flex row is `min-width: auto` by default. Give a
  consumer's instance `min-width: 0` rather than editing the component.
- Chromium 141 still lays out a closed `<details>`'s content. If the closed
  state must take no space, say `display: none`.
- `.sc-eyebrow` lowercases. A proper noun inside one needs `.sc-case`.
- Never vendor from an unmerged branch: pin a commit that is on the design
  system's `main`, and prefer the one its release tag points at.
- The record dialog's dock is `position: sticky` and **wraps to two rows below
  720 px**, so anything else that sticks under it needs a per-width offset, not
  one number. Measure the overlap rather than assuming the dock's height.
- A control inside a closed `<details>` is not focusable, and the saved desk
  nests them: a row's *More* sits inside the ruled-out section. Anything that
  hands focus to a control after a re-render has to open every ancestor
  disclosure, not the nearest one, and only a check that actually moves a home
  between stages can see it.
- A saved record's frozen query context is only honest while it is frozen. Any
  new write path for a saved home must go through `savedScan()`, which refuses
  to re-stamp a record the current feed no longer carries; a bare
  `snapshot: getHome(id)` beside it would silently attach today's query to an
  older observation, and only a check that *saves* something can see it.
- `track.yml` commits a new scan daily and those commits run no *test*
  workflow, so `main` can go red between merges without anyone being told.
  Re-run every gate against the record actually on `main` before trusting an
  earlier green. Since publication they do reach the public site, through
  `publish.yml`'s `workflow_run` trigger — an unchecked record is now a served
  record, held back only by `check_site.py`.
- **Closed, and worth keeping for the shape of it:** opening the filter panel
  and re-rendering in the same frame left a Leaflet zoom `transitionend` reading
  panes its map no longer had — `TypeError: ... reading '_leaflet_pos'` from
  `_onZoomTransitionEnd` → `_move` → `_getMapPanePos`. It reproduced identically
  on `f310e2f` with the bedroom select and no lens involved. **Two fixes were
  tried and reverted before the right one**: guarding the `ResizeObserver` on
  the observed pane's `isConnected`, and `map.stop()` before `map.remove()`.
  Neither moved it, and neither was left in, because a guard that changes
  nothing measurable is speculation. The stack named the real cause: the fit a
  RE-RENDER performs started a zoom animation that outlived its map. A
  re-render's fit is `animate: false` now — it has nothing to animate from —
  while the reader's own *Fit all homes* stays animated. Zero errors on this
  tree, two on the base.
- **`npm ci` removes Playwright from this sandbox.** It is deliberately not a
  `package.json` dependency — `browser-check` reports SKIP without it — so a
  clean install wipes it, and reinstalling the newest version then fails to
  launch because `/opt/pw-browsers` carries a specific Chromium build
  (`chromium-1194`, which is Playwright **1.56.0**). Restore it with
  `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install --no-save --ignore-scripts
  playwright@1.56.0`; `--no-save` leaves `package.json` and the lockfile
  untouched, which was checked with `git status` afterwards.
- A helper that builds every branch of a sentence map to use one branch is free
  in a test and expensive on a thousand cards. `money()` made a fresh
  `Intl.NumberFormat` per call, and `budgetBand()` built four labels per record:
  358ms per render over this feed, on every keystroke in the search. Measure a
  new per-card helper over the whole record before shipping it — no gate here
  watches render time.

Preserve without exception: base rent versus advertised total versus known
subtotal, zero versus unknown, exact layout evidence, source dates (the home's
own and each reference's, separately), a record's own area query versus another
area's and versus the global latest-area line, capped coverage, resident versus
public charging versus an unavailable public dataset, what a source link
actually reaches versus what a search can only look for, provider records,
request and evidence ledgers, the notebook schema including `record.scan` and
its "not recorded" reading for older saves, local corrections, saved snapshots,
cross-tab conflicts and transactional import/export recovery. Invent no
availability, amenity or travel claim. Make no RentCast, leasing or tour call,
no merge to `main` without approval, no force-push to a branch someone else
holds, and no deployment.

## Personal quote dates — September 19, 2026

**Revision.** SpicyHome only. Branch `claude/personal-quote-dates-4aee5g`
cut from `main` at **`c2e8143b08873dff3625e649e20ae3c5b8d2edff`**, which was
`origin/main` when this began and again when it ended (the tracker's data-only
commits since PR #27's merge `82c5f6e` — `data/history/2026-09-16..18.json`,
`data/usage.json`, `dist/data.json`, `dist/status.json` — are all on that base
and untouched). SpicyStock, SpicyCar and the design system were not written.
`dist/data.json`, `dist/status.json`, `data/**`, the tracker, the workflows,
the vendored `dist/design-system/` (22 hashes, unchanged) and `.env.example`
are byte-for-byte the base's. Nothing merged, dispatched, deployed or mailed;
no provider request.

**Reproduced first, through the jsdom harness the suite uses** (the app
evaluated inside the window, the seed feed; `before-jsdom.txt` in the PR):
a $2,600 quote dated 2026-09-10, then $2,500 with *Quote date* cleared. At
`c2e8143` the record kept `quoteDate: ""` while `quote_history` gained
`{date: "2026-09-19", rent: 2500}` — the UTC save day — and Price Pulse printed
*−$100 · $2,600 on Sep 10, 2026 → $2,500 on Sep 19, 2026 · Your recorded
quotes · Last observation Sep 19, 2026*; setting only the date to 2026-09-11
moved `quoteDate` and left the history at the save day. The append with the
save-day fallback dates from the first commit (`533b19b`), so **every** entry
a legacy notebook carries is of unrecorded provenance.

**Settled and built.** A personal entry keeps three facts apart — `rent`,
`date` (the day the reader entered, or `null` with `date_basis: "unknown"`)
and `recorded_at` (the instant the notebook saved it, a time and never a day).
`recordQuote()` in `model.js` is the one writer: a changed amount is an
observation on the day entered or on no day; a changed date alone corrects
the active quote's own entry and keeps what it replaced under
`date_corrections`; the same amount on the same day, a cleared amount, or a
notes/stage/tour-only save records nothing and re-dates nothing.
`quoteEvidence()` is the one reader: every entry classified (entered /
unknown / unrecorded) and never rewritten, and a dated series drawn only from
days the reader established — an entered day, or a legacy day that is the
last entry and matches the reader's own dated active quote (amount and day).
Price Pulse reads the personal series through it and says how many quotes it
left out; the record's *Observed base rent* section lists every entry
(`quoteLog()`), newest first, with its day or *unknown*, its recording time in
Chicago's zone, its corrections and its provenance, and draws the personal
chart from established days only; *Inspect history* lands on it. The notebook
validator (`quoteHistoryOk`) accepts the legacy shape unchanged and refuses a
day-less entry that does not say so, a day on an entry that claims none, a
bad basis, a bad recording instant or a malformed correction — whole, before
anything is merged; `historyOk` for source histories and snapshots is
untouched. Asset revision `20260919-quote-dates`; one small `.quote-log` rule.

**Measured here, all PASS.** `npm ci --ignore-scripts`; `npm test` **246**
(233 at the base + 13: six model, seven jsdom journeys), and the same 246
under `SPICYHOME_TEST_CLOCK_SKEW_DAYS` **7, 30 and 400**; `npm run check`
**43** Python; `python tools/check_site.py` (22 immutable assets, 1,000
records); `git diff --check` clean; `npm run browser-check -- --shots`
**469/469** on the corrected harness (below), **465/469** on its first full
run over this tree, all 76 of the new section 11 passing either way (1280 dark,
390 dark, 390 light, 320 dark) — the amount and the date entered and cleared
with the keyboard, the shortlist and the comparison, Price Pulse before and
after the correction, *History* and *Inspect history* landing under the dock,
the quote log fitting the screen, a notes-only save, a reload, the export
imported into an empty notebook, and the archived snapshot no feed carries
opening with its legacy entries. The screenshots were looked at, at all four
screens and both themes. **Each of the seven jsdom journeys was run against
`c2e8143` first and fails there** (`regressions-on-base-c2e8143.log`): the
undated change carries the save day, the date-only edit leaves `2026-09-19`
where `2026-09-11` was set, the UTC-midnight instant becomes `2026-09-20`.
The one existing test that changed, the Price Pulse separation test, used
provenance-less entries as if they were dated by the reader; it now dates
them and asserts the legacy pair forms no movement.

**The four that failed were not this branch's, and were classified rather
than waved past.** All four are one pre-existing scenario in section 7,
*the incomplete provider query is readable beside the home's own date*, at
1280 and 390 in both themes. It reads the first `listing` row in the committed
feed and requires its query sentence to say the coverage is incomplete. At PR
#27's head (`4a50b79`) that row was a Chicago listing under a capped query
(500 of 4,484); the tracker's data-only commits since then re-ordered the feed
and at `c2e8143` the first listing is a Park Ridge row under a complete query
(18 of 18), whose sentence says *Complete for that recorded query.* The code
that writes the sentence is untouched here. The scenario now chooses a row
whose city's scan is capped, by that fact rather than by position — a
one-line correction to the harness, disclosed here and in the PR. Proved
both ways: the base commit's own run of its unchanged harness is
**389/393 at `c2e8143`**, failing on exactly those four; the corrected
harness over this tree is **469/469** with `--shots`, all 76 new scenarios
and all 393 inherited ones.

**The harness, extended through the coordinated clock, not around it.**
`shiftWindowClock(w, extra)` and `boot({clockOffsetMs})` carry the page's
Date a bounded step past the suite-wide skew, and the boundary journey
computes its expectation from the same total: saved half a second past a UTC
midnight, the entry's `recorded_at` is on the far side of it, its Chicago
label is the evening before, and neither day is printed as the quote's.
Two of the browser scenarios could not have passed as first written and were
corrected before commit: Enter inside a date input does not submit the form
(the amount field does), and `open()`'s init script re-seeds `localStorage` on
every navigation, so a reload read the seed rather than what the page saved
— the new section seeds through the page once instead. One pre-existing
behaviour was met and left alone: a save through an archived record's form
has always re-read the home through `allHomes()`, so its snapshot carries
`notebook_only`/`seen_in_latest`, both derived again on load.

**Not run, not claimable.** The served page on the public origin: this sandbox
cannot reach `spicychicken59.github.io` (the agent proxy answers every CONNECT to it with 403, while `raw.githubusercontent.com` answers 200), so read-only
public-origin acceptance is NOT RUN and offline fixtures are not production
proof. A physical phone. Any RentCast, leasing or tour call. Chromium here is
1194 (Playwright 1.56.0), installed with `--no-save`; `package.json` and the
lockfile are untouched.

**Keep / fix now / defer / omit.** Keep: quote date optional; three facts
apart; one writer, one reader; legacy entries as written and disclosed;
source histories strict. Fix now: nothing found open. Defer: a per-entry
control to date a legacy quote in place (today the reader re-enters the
active quote's date, which establishes that entry only); the archived-form
snapshot flags above. Omit: any migration that guesses which legacy days were
entered, a second history surface, provider enrichment.

**An approved merge of this branch touches `dist/**`**, so `publish.yml`
fires on the push to `main` and serves the bytes after `check_site.py`; that
is the existing workflow, unchanged here, and the publication is Tahir's
call, not this branch's. Exact next action: review the PR for scope, the
material diff, the tests, the regressions and the workflow effect; merge only
on explicit approval; then read the served page once outside this sandbox and
walk the quote journey on a phone.

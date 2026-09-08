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

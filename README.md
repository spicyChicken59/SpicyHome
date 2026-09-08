# SpicyHome

A SpicyChicken apartment research notebook for Chicago and seven selected suburbs: **1–2 bedrooms, 1–2 bathrooms, $1,200–$3,000 base rent**, with parking and EV charging evidence kept visible.

Start with real, sourced building prospects; compare the known monthly cost; save homes, record quotes and tour notes; then connect a bounded daily listing feed when ready.

## What is built

- Twenty-two official-source apartment plans at 18 buildings, researched September 7–8, 2026. Starting prices and advertised monthly totals retain their original meaning. These are **not guaranteed available units**.
- Interactive OpenStreetMap/Leaflet map with sourced approximate building coordinates; co-located plans share a selectable marker. Unlocated plans remain in the list. Includes 37 CTA station references for nearby transit context.
- Rent and neighborhood filters, optional advertised parking/EV filters, and explicit inclusion of unquoted base rents.
- Three-home comparison matrix, real observed price history, saved-home snapshots, shortlist statuses, quote calculator, tour notes and personal calendar downloads.
- Manual apartment entries and JSON notebook export/import. Personal notes stay in the browser; the source feed does not receive them.
- Snapshot cache, request deadlines, retained reports on failure, explicit storage warnings and transactional backup validation.
- Python RentCast ingestion, usage reservations, daily archives and observed-change events. No automatic paid-provider retries or silent extra pages.
- Scheduled GitHub Actions, checks, opt-in Pages publication after bot commits, and optional regional charging/transit updates.
- Original SpicyChicken logo and palette from an immutable design-system snapshot, including file hashes and provenance.

**[Setup](SETUP.md) · [Data sources](API-SOURCES.md) · [Building research](RESEARCH-SOURCES.md) · [Verification](VERIFICATION.md)**

## Start locally

```bash
npm ci --ignore-scripts
npm test
npm run check
python tools/check_site.py
npm run dev
```

Open the local URL printed by Vite. The app reads the committed public feed, with
a second GitHub read endpoint if the raw-content host fails. Update checks bypass
cached responses and reload the feed configuration. When sources are unavailable,
the app keeps the newest complete connected snapshot available in memory, browser
storage or the deployed bundle. An older successful response cannot silently
replace newer saved listings. The fallback is labeled explicitly. It has no
production build step and no browser API secrets; refreshing never calls RentCast.

The loaded-versus-visible count distinguishes a stale feed from saved search
filters. Parking, EV and named-neighborhood filters can exclude listings whose
amenities or neighborhood are unverified. The recovery notice resets search
filters while retaining saved homes, notes, quotes and utility estimates. If
configuration cannot load, built-in public read URLs and the included data still
work. The app and stylesheet URLs carry a revision to refresh browser asset caches.

Layout counts describe evidence rather than guaranteeing an enclosed bedroom.
Cards distinguish official source-listed plans, provider-reported layouts and
layouts checked by the user. Exact plan/unit labels accompany prices, and missing
unit identifiers remain explicit. The layout filter can limit results to
source-listed plans or personal checks. Manual entries start with unknown layout.
A saved studio/convertible or other-layout correction stays in the notebook and
excludes that record from the search after refresh, without deleting saved notes.

The tracker does not infer bedrooms from price or square footage. It rejects
nonmatching numeric layouts and explicit contradictory unit-layout fields, retains
layout corrections on historical IDs, and prevents later unknown evidence from
restoring a previously identified studio. No new provider requests are needed to
use these controls. Existing provider counts have not been independently verified.

The layout check appears near the top of apartment details. Excluded layouts stay
reviewable from Discover, including corrections removed from the shortlist.
Checked-only searches explain when other filters hide checked homes and can reset
those filters without changing the layout scope. Plan and unit names are searchable.
Saved snapshots absent from the current feed remain archived notebook entries.

Notebook writes detect changes made in another tab before replacing saved data.
Conflicting tabs offer export and explicit reload; unreadable saved notebooks are
protected with a raw-data download and backup import. Search text is bounded before
saving. Tracking status is compared with the selected scan date so an older failure
cannot contradict a newer success. Explicit structured studio evidence is retained
across numeric-only provider updates until explicit matching one- or two-bedroom evidence resolves it.

## Daily operation

The rental job is disabled until the repository variable `SPICYHOME_TRACKING_ENABLED` equals `true` and `RENTCAST_API_KEY` is configured. It is scheduled at **13:17 UTC**; GitHub schedules can run late. Regional context refreshes Mondays at 12:47 UTC.

The search covers Chicago, Evanston, Oak Park, Park Ridge, Elmhurst, Downers Grove,
Arlington Heights and Naperville within 35 straight-line miles of the configured
central Chicago point. Discover includes city/suburb, named-area and distance
filters; tighter distance filters require coordinates. Eighteen sourced one-bedroom plans and four two-bedroom plans are available
immediately, bringing the research set to 22.

Each reserved request selects one city, with up to 500 active listings with 1–2 bedrooms and 1–2 bathrooms
in the existing base-rent range. The receipt persists the selected city and next
city before any request, including failed attempts. Eight cities rotate through
approximately 8–10 days per cycle; failed scans may take longer. Each city's last
successful scan is visible. Other cities are not marked omitted when one city is
scanned. Capped coverage and unknown coordinates remain explicit.

The bounded dashboard balances retained listing records across cities. Explicit
studio/convertible evidence is preserved separately in `data/layout-evidence.json`
so display eviction cannot restore a known studio after a weaker source response.
Only explicit valid one- or two-bedroom evidence resolves that provider contradiction.
Existing browser notes and local corrections continue to take precedence.

Each request reservation is committed **before** the provider call. The integration permits one attempt per UTC day and no more than 30 in a rolling 32-day window. A failed request still consumes its reservation. This cap cannot account for other software using the same RentCast account, and the provider can charge overages automatically.

The current dashboard keeps up to 1,000 research/listing records, up to 60 price observations per provider listing, and a payload under 7 MB. Older unseen listings remain in daily archives; saved-home snapshots in the browser preserve personal decisions. A listing missing from a capped query is described as unverified, never presumed rented.

## Architecture

`data/seed.json` and optional provider observations → `dist/data.json` and `data/history/` → static app. `dist/status.json` describes the most recent tracking attempt separately from the last successful data snapshot. Browser notes remain independent.

The same `dist/` works on private Sites and GitHub Pages. A private Sites deployment can read the public GitHub JSON feed once that repository exists, so daily observations do not require redeploying the private application. Client-code changes require a new Sites deployment or are published automatically on GitHub Pages.

The GitHub feed must be public for the static private Sites app to fetch it without credentials. Never publish personal notebook exports, API keys or private lease documents. If you choose a private GitHub repo instead, serve its snapshot through an authenticated backend or republish updated packaged data; do not put a GitHub token in this client.

## Design provenance

`dist/design-system/provenance.json` pins 22 unchanged assets from `spicyChicken59/design-system` commit `08cd626f658706e422e51cf23979fdceccc7a8f4`. The photograph is an attributed Chicago skyline, not a photograph of a listed apartment. Leaflet 1.9.4 is vendored with its license. No release tag is required.

## Deliberate limits

Rent, leasing dates and amenities can change. An advertised charger is not a guarantee of a usable, compatible or available charger for your lease. A nearby public charger is not a building amenity. Station distances are straight-line reference distances, not commute or walking times. Step-free access, noise and comfort require direct verification.

No rental application, tour booking, leasing message, API subscription or paid provider request is sent by the app. A calendar download creates a personal reminder only.

## One- and two-bedroom search

The bedroom selector defaults to both sizes. Exact-size searches use the reported
count or your personal correction; unknown bedroom counts appear only with both
sizes selected. Bathrooms are preserved as 1, 1.5 or 2, including in user checks.
Existing one-bedroom checks keep their original 1-bed/1-bath meaning.

A single RentCast request uses `bedrooms=1|2` and `bathrooms=1|1.5|2`, as supported
by the official [search query documentation](https://developers.rentcast.io/reference/search-queries).
Both sizes share the existing 500-result page, city rotation and request cap.
The last scan metadata is historical; the broader query starts with the next
permitted scheduled scan. No provider request was made to test this change.

## Release audit follow-up

Map pins group plans at the same exact coordinates, with separately labeled plan,
unit, layout evidence and price basis. Each option opens its own notebook record.
Map-list entries also identify plans, and unlocated entries still open details.

“Reset other filters” keeps the selected bedroom size and evidence scope; widening
to both bedroom sizes is a separately labeled action. The area guide distinguishes
historical one-bedroom-only scans from later combined scans. Each future scan
persists its query scope without changing earlier cities’ observation dates.

Provider optional titles must be valid bounded text or use the valid formatted
address. Invalid unit/type fields remain unknown; invalid required IDs or addresses
stop publication. A Python-to-browser contract check verifies the resulting feed.

## Five experience upgrades — September 8, 2026

1. **Explore cockpit:** a compact search summary, bedroom shortcuts, List + Map /
   List / Map / Focus modes, collapsible advanced filters and source freshness.
   Important data warnings expand automatically. Mobile navigation stays within
   reach, with safe-area spacing and controls that wrap at narrow widths.
2. **Focus:** review one matching, unsaved apartment at a time. Save, skip for this
   tab, undo the last Focus action, or clear skips. Skips never hide Discover
   records or change listing status. Saved homes enter the existing notebook.
3. **Cost Lab:** pick an apartment and try monthly rent, parking, fees, utilities
   and charging assumptions over 1–36 months. Unknown costs remain explicit;
   missing base rent prevents a misleading total. Scenarios last in the tab and
   never become saved quotes or price history. Deposit/move-in costs are excluded.
4. **Decision board:** saved homes grouped by all seven existing stages, with
   accessible stage selectors, stage filters, comparison, tours and Cost Lab
   shortcuts. Ruled-out homes remain recoverable. No leasing messages are sent.
5. **Tour companion:** eight personal review checks saved alongside existing
   notes, quote history and tour dates. Checkbox completion means reviewed by the
   user, not independently certified amenities, accessibility or layout.

Existing version-1 backups remain compatible. New tour-check fields validate
before import; search surface preferences are bounded. Notes, feed observations,
source facts, request caps and provider workflows remain unchanged.

## Five more decision tools — September 8, 2026

1. **Saved searches:** up to eight named filter/view combinations in Discover,
   with current match counts and one-tap restore. Loading keeps the current
   utility estimate and apartment records. Reusing a name updates it; backups
   merge searches by name and reject invalid or over-capacity unions atomically.
2. **Rent × space Atlas:** a fifth Explore surface plots known base rent against
   positive reported square footage. Saved quotes take precedence and show their
   own dates separately. Unknown rent/size is excluded with a count, never replaced
   by an advertised total. The picker reaches overlapping plans; List retains all
   filtered homes. Mobile axes use readable text outside the chart.
3. **Apartment face-off:** exact plan identities, stacked phone comparison facts,
   desktop matrix, differences-only toggle and existing print action. Shared
   unknowns are hidden by differences-only just like other matching facts.
4. **Ask next:** each apartment's details include a copyable leasing-question draft
   based on unresolved layout, costs, resident charging, access and quote dates.
   Quoted cents are preserved. Personal notes are excluded; copying has a manual
   fallback. Nothing is sent and recording answers uses the existing notebook.
5. **Move-in cash planner:** Cost Lab separately combines one month of its current
   recurring scenario with refundable deposit, nonrefundable fees, moving costs
   and extra prepaid rent. Unknowns stay visible. These tab-local assumptions
   neither modify saved quotes nor add to the recurring lease projection.

The new fields remain compatible with version-1 notebooks. Listing observations,
source histories, scan/request budgets and shared design assets are unchanged.

## Faster everyday use — September 8, 2026

- **Quick jump:** use the header button or Cmd/Ctrl + K to search loaded homes,
  exact plans and screens. Arrow keys and Enter work; an open apartment notebook
  blocks the shortcut so unfinished notes remain in place.
- **Quick scan:** switch Discover between full cards and compact rows. Both retain
  price basis, layout evidence, source dates, save and comparison actions. List
  style travels with saved searches and version-1 backups.
- **Final three:** pin up to three saved homes above the decision board and compare
  them directly. Unpinning keeps notes; unsaving clears a pin. Imports validate
  the cap before mutation, including when combining two notebooks.
- **Tour agenda:** saved tour dates are grouped into upcoming and past appointments
  in Chicago time. Offset timestamps normalize consistently in editing/calendar
  export. Date-only entries request a time instead of inventing one. Directions,
  notes and calendar reminders stay within reach; no appointment is booked.
- **Apartment dock:** jump directly to layout, costs, tour checks, notes, history
  and sources, or save the existing notebook form from its sticky controls.

## SpicyPicks — September 8, 2026

Discover now recommends up to three distinct approximate building locations for
Best fit, Budget wins, More space, EV + parking and Near CTA. Each pick identifies
the exact plan, base rent, known monthly subtotal, three reasons to look closer,
and the unresolved costs or evidence that could change the decision. Existing
filters apply; save, details, comparison and a resident-review search are nearby.
Phone layouts offer a swipeable card row with labeled priority buttons.

Local price signals compare base rent per reported square foot with at least five
other approximate locations: same city, source type, bed/bath count, within three
straight-line miles and within 20% of size. Each location contributes its median;
quotes must be dated within seven days. This uneven, capped sample is not a
market valuation. The selected priority's weights are disclosed in the interface.

Unknown base rents never become cheap picks. Promising advertised-only plans,
including two-bedroom options, remain separately labeled research leads. Studios,
layout conflicts, archived/absent listings, ruled-out homes, future observations
and sources older than 30 days are excluded. Undated or older personal quotes
lose freshness credit and cannot support a local price-value claim. Location
comparisons remain independent of search filters and personal rejection status.

Near CTA uses the loaded station reference within half a straight-line mile,
only while the reference is at most 30 days old. It does not assess Metra, walking
routes or neighborhood popularity. No review-rating feed is connected: review
links help check recent resident experiences, while ratings do not affect ranks.
No additional provider requests, API subscriptions or persisted notebook fields
are needed. Existing notes, listing sources and request budgets are retained.

## Decision Studio — September 8, 2026

Open Decision Studio from the Explore controls in any Discover surface, or use
Quick jump. Five tools share the existing apartment facts and notebook:

1. **My recipe:** six adjustable priorities and four starting mixes rerank the
   supported SpicyPicks. Evidence and approximate building groups are computed
   once per loaded view; moving a slider only recalculates the weighted order.
   The displayed weights explain the mix. Experiments remain in the current tab;
   hard requirements use the existing Discover filters.
2. **Trade-offs:** choose a starting apartment and up to $500 extra base rent to
   consider within the search cap. Find a lower rent with at least 85% of its
   size, at least 100 more square feet, or newly advertised resident EV charging.
   Alternatives keep source type and bed/bath counts, require fresh quotes, show
   cost/size differences and caveats, and open a comparison of exactly two homes.
3. **Area match:** compare two cities or source-named Chicago neighborhoods for
   one bedroom size. Parking/EV counts and base-rent samples stay distinct from
   area ratings. Units at one approximate location share one contribution, source
   types remain separate and fewer than three priced locations never get a median.
   Unspecified neighborhoods and unquoted two-bedroom leads remain explicit.
4. **Price pulse:** filter recorded rent drops, rises or saved homes. Public source
   histories and private quote histories remain separate. An unchanged scan keeps
   the most recent actual change and its original date. Missing, future or
   conflicting same-time prices cannot manufacture a change. Old quotes and scan
   absences have a separate recheck list; no alert subscription is created.
5. **Next moves:** show one actionable step for each of up to three saved homes,
   prioritizing near-term tours, layout checks, quotes, unfinished tour checks and
   a decision note. Each action opens the relevant notebook field. Saving real
   answers updates the next step. No leasing messages, bookings or applications
   are sent.

The studio uses compact tool navigation, responsive comparison cards and existing
local save/compare actions. It adds no API, dependency, notebook schema or request
budget changes. A concurrent scheduled scan is retained in the release: the
snapshot contains 390 records, including 93 source-reported two-bedroom entries.
These counts do not establish current availability or separately enclosed rooms.

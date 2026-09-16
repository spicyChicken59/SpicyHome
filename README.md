# SpicyHome

A SpicyChicken apartment research notebook for Chicago and seven selected suburbs: **1–2 bedrooms, 1–2 bathrooms, $1,200–$3,000 base rent**, with parking and EV charging evidence kept visible.

Start with real, sourced building prospects; compare the known monthly cost; save homes, record quotes and tour notes; then connect a bounded daily listing feed when ready.

## What is built

- Twenty-two official-source apartment plans at 18 buildings, researched September 7–8, 2026. Starting prices and advertised monthly totals retain their original meaning. These are **not guaranteed available units**.
- Interactive OpenStreetMap/Leaflet map with sourced approximate building coordinates. A mark is a circle, and it prints the price its own card prints — rounded to the nearest $100, never an all-in cost, a verified current rent or proof that the exact unit is free — where every place under it prints that same figure on the same basis, and where the label clears every other mark and the edge of the map. Where it cannot, the circle stands and carries the number of places it holds, so a dense map degrades to circles rather than stacking boxes; what decides that is the boxes on the screen at the current zoom, not a record count. The shortlist fills its mark, the Final Three add a warm ring, and the mark you are on takes the focus blue. Places whose recorded coordinates fall within a mark's width of each other at the current zoom share one mark, anchored on a real recorded coordinate; a press is resolved by distance from the press — a press anywhere on a printed price is that mark's — and when several places are within a finger it asks which one you meant rather than choosing silently. A crowd too large to name one by one offers the zoom that separates it. Unlocated plans remain in the list, which is counted and stays the precise path to a named place. Includes 37 CTA station references for nearby transit context.
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
npm run browser-check     # needs Playwright + Chromium; SKIPs and exits 1 without them
npm run dev
```

`npm run browser-check` serves the committed `dist/` and answers the remote feed
with the committed records, then judges what jsdom cannot: where things land on a
screen, whether every map mark sits where its coordinates put it, which
place a press on the map actually selects, whether a mark prints a price only
where it has one figure to print and the room to print it, and whether a saved
home's name still gets the wider half of its card when its rent caption is long. Pass
`--shots <directory>` to save what it saw.

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

`dist/design-system/provenance.json` pins 22 unchanged assets from `spicyChicken59/design-system` commit `14a752dd0269bd6ebbb7080eb0d9e1922cd1ef2c`, which is the released **v2.13.0** tag and that repository's `main`. The photograph is an attributed Chicago skyline, not a photograph of a listed apartment. Leaflet 1.9.4 is vendored with its license.

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
(Since the discovery pass below, marks also group by rendered proximity at the
current zoom; the exact-coordinate grouping remains the behaviour wherever the
map cannot project, and every option still opens its own record.)

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

## Find → Compare → Decide — September 13, 2026

One workspace rather than a set of tools. Nothing new is tracked, ranked or
persisted; what changed is where the controls are, how a selection is carried
between surfaces, and what a number says about itself.

1. **One control hierarchy in Discover.** The explore deck now reads in the order
   a search is made: what you are looking for, then how you are looking at it.
   A hard filter (bedrooms) and the presentation modes no longer share a row in
   the same unlabeled pills — each group carries a caption a reader and a screen
   reader both get (`beds`, `view`, `rows`), composed from the design system's
   `.sc-field--group` / `.sc-field__label`. **Both** presentation controls sit in
   one band; the list-style control used to be 869 px lower on a desktop and
   1,561 px lower on a phone. Each band says what its kind of control does, and
   the view band says what the chosen surface can and cannot draw, so a count
   that differs between List, Map, Atlas and Focus is explained rather than
   forced to match. SpicyPicks' priority row is captioned `priority`: it ranks,
   it does not filter and it is not a view.
2. **Comparison reachable from every surface, in one selection.** The apartment
   record and the map's own list now carry the same save and compare controls
   the cards carry, writing to the same selection and the same handler — no
   second mechanism. The selection tray names each place by building and exact
   plan, removes one without disturbing the others, and offers the next action.
   A selection your filters later hide is kept, marked, named and reachable in
   one press; your saved filter preferences are not changed to show it. A fourth
   selection names the three it would have replaced and replaces none of them.
   The comparison itself shows a rent or space difference only where every
   compared place has that figure on the same basis, and names what is missing
   otherwise. No winner is declared and no score is invented.
3. **Cost evidence says what kind of number it is.** Base rent, an advertised
   total, a known monthly subtotal, an amount no source supplied and your own
   utility estimate are now visually and verbally distinct, using the design
   system's figure-basis marks (`.sc-unreported`, `.sc-estimate`) with the word
   in the markup beside the mark. A card names the costs that are unquoted
   instead of saying some are, and offers the exact notebook field that records
   the first of them. The comparison reaches each place's own cost breakdown and
   its missing costs. A recorded $0 is still an amount; an unquoted item is still
   not a total. Recurring monthly costs stay separate from deposits, one-time
   fees and moving cash.
4. **A saved home says what is unresolved and what to do next.** Each home on the
   decision board carries its stage, the open question and one action, from the
   same `nextMove()` engine Decision Studio's Next moves ranks — not a second
   task list. The action opens the exact layout, quote, tour or notes field for
   that apartment, and a cost gap offers the exact amount field beside it.
   Opening a field is never treated as answering it: the step changes when an
   answer is saved. An empty Final Three is a one-line prompt rather than a
   panel, and the board's own controls are one wrapping row under the step.
5. **The Atlas is readable and honest about what it cannot plot.** Axis labels
   are round numbers off a real ladder, never fractions of an arbitrary span,
   and no label is printed twice. The selected point wears a ring rather than
   growing, since a bigger dot reads as a bigger number on these axes. Plans
   recorded at the same rent and size share one dot: the summary names them and
   reaches each in one press. The homes that cannot be placed are counted by
   reason — no base rent on record, or a base rent with no reported size — and
   nothing is substituted for a missing figure.

No new dashboard, tab, ranking system or tracker. No provider request, schema
change, dependency or framework migration. Saved searches, notebook records,
snapshots, stages, quotes, tour notes and recovery paths are unchanged.

## The shared record comparison — September 14, 2026

The apartment face-off now uses the design system's own comparison (v2.13.0)
instead of a local copy of it. Nothing new is compared, ranked or stored.

- **The phone comparison is `.sc-compare-pair`.** SpicyHome's own stacked layout
  is gone. Both places are named in a head that stays on screen while the
  measures scroll past, so a value is never read against the wrong apartment,
  and the two values sit in equal columns under each measure.
- **A third selected place is a choice, not a truncation.** The pair shows two;
  where three are selected, the heads carry the control that picks which two.
  The third stays in the comparison, and choosing a place the other side already
  holds swaps the two rather than showing one apartment against itself.
- **Rows the places disagree on are marked (`data-differs="true"`), not hidden.**
  The mark is on the row's own label, never on a value: a difference is not a
  winner, and no apartment is called best. The pair marks what the two in front
  of you differ on; the desktop matrix marks what all the selected places differ
  on — each answers the question its own view is asking.
- **"Differences only" still folds the matching facts, and now says what it
  folded.** It names them and counts them, and the plan and unit, the layout
  evidence, the base rent, the known monthly subtotal and the source date are
  never folded — identity, price basis and the age of the evidence stay readable
  whatever else is put away.

Print is unchanged: it uses the full matrix, every row, as before.

## Traceable source access — September 15, 2026

Nothing new is fetched, ranked or persisted publicly. What changed is that a
record now says where its source actually goes, when each piece of evidence was
recorded, and which query it was read under.

1. **The link says what it reaches.** A record's source is labelled by its
   destination type — a listing page on record, a building or floor-plan page,
   your own link, or provider documentation — rather than "Official source".
   A populated URL is not proof of an exact unit: a curated plan's link is the
   building's floor-plan page and says so. Provider documentation is never
   promoted into a rental listing, and a provider ID is never turned into a
   guessed public listing address.
2. **A missing listing URL is said out loud, and the way out is a search.**
   Where no exact listing URL is on record, the record says so and offers
   *Search this address & unit* or *Search this building & plan*, built only
   from recorded public identity — address, unit, plan, building name and city.
   Personal notes, quotes, tour dates and every other notebook field are
   excluded by construction. A search is a search, not a found listing or a
   verified source, and the label says that too. A record with no source link
   and no recorded address or building name says there is nothing to search;
   none is invented. Opening a source or a search saves nothing, marks nothing
   verified and leaves a half-typed note where it was.
3. **Each source reference keeps its own date.** The record prints the date each
   reference was observed, and "Source date not recorded" where none was. A
   missing date is never today, and the home's own observation date is never
   copied onto a reference. The daily run now records when it read the
   provider's documentation reference; the documented listing schema still
   supplies no listing page, so none is invented.
4. **The area's query is beside the home's own observation, never merged with
   it.** Each record reads the retained scan for its *own* city — its date, its
   returned and reported counts where known, and whether that query's coverage
   was incomplete. An area with no recorded scan says so instead of borrowing
   another area's. A home observed before its city's latest query says the two
   were not captured together. Curated research is never described as a
   provider-query result. Query completeness is completeness for that recorded
   query, not proof of whole-market coverage or current availability.
5. **Resident charging, its cost and public charging context are separate
   answers.** "Building charging advertised", "no building charging" and
   "building charging unknown" are three states, and "public charging context
   unavailable" is a fourth that is not evidence that there are no chargers.
   Nearby public stations never establish resident charging or parking rights.
   No resident charging cost is quoted by any source here, so it is named
   beside the known monthly subtotal and never folded into it.
6. **A saved home keeps the query it was read under.** Saving freezes the
   matching city's scan with its own dates alongside the snapshot. Where the
   area has been scanned again since, both are shown, each labelled, and today's
   result is never attached to an older observation. An archived record is never
   re-stamped — not by reading it, and not by saving a note or moving its stage.
   Notebooks saved before this read "not recorded"; the field validates on
   import and travels through the existing backup path.

The comparison carries two more rows — how each place's source is reached and
the query behind it — and neither is folded away by "Differences only". Building
EV charging and nearby public charging are separate rows. Cards name the
destination type beside the evidence kind and date.

No new dashboard, tab, ranking system, crawler or tracker. No provider request,
schema change, dependency, request budget, geographic rule or schedule change.

## The saved-home decision desk — September 16, 2026

Nothing new is tracked, fetched, ranked or persisted. What changed is the shape
of the saved surface: a shortlist used to be the Discover card printed again,
once per home, with ten controls under each one.

1. **A saved home is one decision, not a discovery card.** Each row carries its
   exact identity and plan, its money on the basis the record holds it
   (base rent, an advertised total, or your own quote), the known monthly
   subtotal, the layout evidence, the parking and resident-EV answers, and one
   compact freshness-and-source cue. A saved home was 1,065 px tall on a desktop
   and 1,247 px on a phone; it is 475 px and 648 px now, and the controls a
   reader faces went from ten to four. The full provenance — the dated source
   references and the city query behind them — is not reprinted here; it stays
   one press away in the record, where it was built.
2. **“What could change my mind?” is derived, never guessed.** Each unresolved
   item comes from a fact the record already holds: an unquoted amount, a layout
   nobody checked, parking or resident charging the source never established, a
   quote past seven days or undated, a record absent from the latest area scan,
   a missing exact listing URL, tour checks not reviewed. Every item opens the
   exact notebook field or evidence section that settles it, and opening is
   never answering — an item clears when an answer is saved. The list is folded
   with its count on the summary, so folding never hides how much is open, and
   the one item the next step performs is marked. A recorded $0 is an amount and
   leaves the list; the source's silence about whether parking exists is a
   separate question and stays.
3. **Three groups, seven stages.** Finalists, homes in contention, and ruled-out
   homes read as three different things. Every row still carries and can change
   its own stage, and the stage filter is unchanged: a stage is a label on a
   home, not the shape of the page. A ruled-out home leaves the contenders'
   reading order for its own folded section, keeps every note, quote and check,
   and comes back in one press — it is demoted, not hidden, and stays readable
   (measured at 8.9:1 in dark and 6.3:1 in light).
4. **The Final Three is the decision core.** Each finalist shows its money and
   basis, the known subtotal, the layout evidence and how much is unresolved, so
   three can be told apart before the full comparison opens. One line above them
   says what actually differs, using the comparison's own arithmetic
   (`figureSpread`, shared by both) and naming what is *not comparable* rather
   than substituting anything for it. Nothing is ranked, scored or called best.
   Empty capacity is a prompt that names a contender to pin, not three empty
   slots. The full comparison remains the authoritative one.
5. **The phone gets the decision first.** On a phone a finalist is two lines —
   who and how much, then what is open and the two things to do about it — and
   the subtotal and layout live on that home's own row below rather than being
   printed twice. The first viewport now carries the difference line and a
   finalist's money instead of a masthead and a prose line. The saved surface is
   5,234 px for six homes where it was 9,199 px, with no sideways scroll at
   390 px or 320 px and every control a reader faces a 44 px target.

No new tab, dashboard, ranking system, tracker or notebook field. Saved status,
finalist pins, snapshots, notes, quotes, tour checks and preferences remain the
source of truth, and the notebook schema is unchanged.

## The tour-day walkthrough — September 16, 2026

Nothing new is tracked, booked, fetched or persisted, and the notebook schema is
unchanged. What changed is where the Tour Companion sits and what it carries.

1. **It says which apartment you are standing in.** The walkthrough opens with
   the building, the exact plan or unit, the full address, the tour date and
   time when one is recorded, and a directions link built from that recorded
   address and nothing else. On a phone that strip stays on screen while the
   checks scroll past, resting below the record's own dock rather than behind
   it. A tour nobody scheduled says *No tour date recorded*; no time is
   invented, and a record without coordinates still gets directions from its
   address rather than a fabricated position.
2. **Each check carries what the record already knows about it.** The layout
   check shows the layout evidence on record. The parking check says whether the
   source established that there is parking — advertised, not offered, or never
   established — and, separately, the monthly cost on record, where a recorded
   $0 is an amount and an unquoted one says so. The charger check gives the
   building's own answer, states that its cost is quoted by no one and is not in
   the subtotal, and keeps nearby public stations apart from both. The quote
   check shows the known monthly subtotal and what is still unquoted. The four
   checks the record holds nothing about — light, noise, the everyday route, the
   basics — carry no line at all rather than an invented one. Checking a box is
   still the reader's own review; nothing is marked verified by being opened.
3. **The checks run straight into the fields that record them.** The walkthrough
   now sits directly above the notebook form, so the last check and the quote,
   parking, fee, date and notes fields are 20 px apart. They were 1,657 px apart
   on a phone and 1,940 px at 320 px — roughly four screens of costs, amenities
   and price history in between. Nothing was duplicated to do it: the same
   fields, the same form, the same save.
4. **Progress says what is left.** The summary and the live count both read
   *N/8 reviewed · M left*, and the count follows each check as it is ticked.
   Saving carries the checks, the quote and the notes together, and the decision
   desk's unresolved list drops exactly what the walk answered while the rest
   persists.
5. **A finger lands on the check.** The box is 24 px inside a target row of at
   least 100 px. Nothing scrolls sideways at 390 px or 320 px, a field jumped to
   clears both sticky bars, and opening directions or a source saves nothing,
   marks nothing reviewed and leaves half-typed notes exactly as they were.

No second tour record, checklist engine or activity log; no booking, calendar
mutation, location tracking or photo system. Saved checks, quotes and notes
survive a refresh and an absent or stale feed exactly as before.

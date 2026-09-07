# SpicyHome

A SpicyChicken apartment research notebook for downtown Chicago: **1 bedroom, 1 bathroom, $1,200–$3,000 base rent**, with parking and EV charging evidence kept visible.

Start with real, sourced building prospects; compare the known monthly cost; save homes, record quotes and tour notes; then connect a bounded daily listing feed when ready.

## What is built

- Ten official-source building prospects, researched September 7, 2026. Starting prices and advertised monthly totals retain their original meaning. These are **not guaranteed available units**.
- Interactive OpenStreetMap/Leaflet map with ten sourced, approximate building coordinates; 37 CTA station references for nearby transit context.
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

## Daily operation

The rental job is disabled until the repository variable `SPICYHOME_TRACKING_ENABLED` equals `true` and `RENTCAST_API_KEY` is configured. It is scheduled at **13:17 UTC**; GitHub schedules can run late. Regional context refreshes Mondays at 12:47 UTC.

One Chicago query requests at most 500 active, 1-bed/1-bath listings in the configured base-rent range. A documented geographic search rectangle then keeps the broad downtown area. Source omissions, missing coordinates and truncation remain visible. This does not establish full market coverage.

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

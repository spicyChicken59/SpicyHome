# SpicyHome API sources and ingestion setup

Verified against primary documentation on 2026-09-07. Research only: no subscription created, no key accessed, no paid or authenticated API requests made. This is an implementation handoff, not a claim that live Chicago inventory has been retrieved.

## Recommendation

Use **RentCast rental listings** as the initial inventory provider, **AFDC public charging data** as a separately cached proximity layer, and the **official Chicago Data Portal CTA station feed** for transit proximity. GTFS remains an alternative described below. These are documented data interfaces rather than consumer-portal scraping. Keep manual apartment parking/EV verification separate from all three datasets.

RentCast lists Developer at $0/month with 50 requests; Foundation at $74/1,000; Growth at $199/5,000; Scale at $449/25,000. Developer overages are $0.20 per request. This is an ongoing free allowance, not a time-limited trial. [API pricing](https://www.rentcast.io/api)

An active API subscription is required. Only HTTP 200 requests with response bodies count toward billing, irrespective of records returned. Quotas renew on the subscription billing date, not necessarily the first of the calendar month. **There is no provider-side hard cap: overages are automatic.** All account usage must be considered before enabling a workflow. [Billing semantics](https://developers.rentcast.io/reference/billing-and-pricing)

## Exact RentCast interface

```text
GET https://api.rentcast.io/v1/listings/rental/long-term
Accept: application/json
X-Api-Key: <RENTCAST_API_KEY>

city=Chicago
state=IL
bedrooms=1
bathrooms=1
price=1200:3000
status=Active
limit=500
offset=0
includeTotalCount=true
```

The Python integration builds the query with `urllib.parse.urlencode`, not string concatenation. `city` and `state` are case-sensitive. Rent is the `price` field. Results sort by `lastSeenDate` descending. Exact bedrooms/bathrooms match the requested 1/1; a 1.5-bath unit is intentionally excluded. [Rental endpoint](https://developers.rentcast.io/reference/rental-listings-long-term)

The colon expresses an inclusive range; pipe separates alternatives. Omit `propertyType` initially to avoid losing rental units classified as condos or small multifamily. If a type constraint is wanted, use `Apartment|Condo|Multi-Family|Townhouse`; this is a product choice and may exclude relevant units. Do not add `daysOld`: that restricts listing age, not provider-change time, and would miss older active listings. [Query syntax](https://developers.rentcast.io/reference/search-queries)

For pagination, use offsets 0, 500, 1000 while all other criteria stay constant. Stop at fewer than 500 records or when the retrieved count reaches `X-Total-Count`; request the total only on page one. The endpoint returns an array, with pagination metadata in headers (`X-Limit`, `X-Offset`, `X-Total-Count`). Count queries can increase response latency. [Pagination](https://developers.rentcast.io/reference/pagination)

The technical rate limit is 20 requests/second/key, with HTTP 429 when exceeded. A daily sequential job is far below it; the paid-usage quota is the binding limit. [Rate limits](https://developers.rentcast.io/reference/rate-limits)

## Coverage and data honesty

RentCast obtains listing data from public feeds/directories, not directly from MLS. It says listings update at least daily and newly published listings generally arrive within 12–24 hours. Its stated coverage targets are at least 96% for residential types and at least 90% for 5+ unit commercial multifamily. These are provider claims, not verified Chicago completeness; query truncation is an additional app limitation. [Listings/coverage](https://developers.rentcast.io/reference/property-listings)

Available documented provider fields (the application stores a reduced subset):

| App field | RentCast source |
|---|---|
| Stable ID | `id`, prefixed `rentcast:` |
| Address/unit | `formattedAddress`, `addressLine1`, `addressLine2` |
| Location | `city`, `state`, `zipCode`, `latitude`, `longitude` |
| Monthly listed rent | `price` |
| Layout/size | `bedrooms`, `bathrooms`, `squareFootage` |
| Type | `propertyType` |
| Provider status | `status` |
| Listing dates | `listedDate`, `lastSeenDate`, `removedDate` |
| Contact | `listingAgent`, `listingOffice` |
| Provider history | `history` |

The published listing schema has **no listing photo, property description, direct listing-page URL, parking availability/price, or in-building EV charging field**. Agent/office websites are not listing URLs. Keep unsupported fields null/unknown. Do not infer a unit amenity from nearby parking, nearby charging, building age, or property type. [Listings schema](https://developers.rentcast.io/reference/property-listings-schema)

Suggested app-only verification record:

```json
{
  "parking": {"status": "unknown", "monthlyCost": null, "sourceUrl": null, "verifiedAt": null},
  "onSiteCharging": {"status": "unknown", "notes": "", "sourceUrl": null, "verifiedAt": null},
  "nearbyPublicCharging": [],
  "fetchedAt": null,
  "providerLastSeenAt": null,
  "lastIncludedInSnapshotAt": null
}
```

Use three-state amenities (`confirmed`, `unavailable`, `unknown`) and distinguish user verification from provider inventory. A listing missing from one capped snapshot is not proof it is leased or inactive. Compare prices only between observed snapshots of the same ID; describe a disappearance as “not in latest snapshot,” retaining notes and saved state.

## A bounded daily ingestion workflow

The implemented workflow uses `src/tracker.py` and `.github/workflows/track.yml`. The API contract above describes provider behavior; request limits below are this application's own safeguards.

1. Keep application code, public source snapshots, and non-secret request reservations in the SpicyHome repository. The browser reads a cached dataset; it never receives API secrets or calls RentCast directly. Personal notebook data stays in the browser.
2. Schedule one daily GitHub Actions run at an off-hour minute, `17 13 * * *` (13:17 UTC), plus manual `workflow_dispatch`. Use one concurrency group with `cancel-in-progress: false`.
3. Require repository variable `SPICYHOME_TRACKING_ENABLED=true`, a secret key, and initialized durable usage state. With any missing requirement, skip live requests and preserve the current dataset. An empty initial dataset should say “Connect a listing source”; fixtures must remain explicitly labeled samples.
4. Default to **one request and one 500-result page per day**. This needs 28–31 successful calls per typical billing period. Do not retrieve individual property/AVM records or make per-card calls. No automatic retries in the initial free-tier implementation: timeouts may still have consumed a successful provider request.
5. Persist a request-attempt reservation **before** the network request. Commit and push the reservation in `data/usage.json` to `main` before calling. Abort if reservation persistence fails. A reservation stays counted even if the response is lost. Concurrency plus this reservation protects reruns and cancellation cases.
6. Conservatively cap this integration at 30 attempted requests in any rolling 32-day window and at one attempt per UTC day. Count manual runs too. A rolling window avoids relying on an assumed billing renewal date. This cap does not control other integrations sharing the RentCast account: verify the current allowance and reserve other account usage before activation; separate API keys alone do not create separate billing quotas.
7. Validate response array, types, expected city/state/layout/rent, IDs and finite coordinates. Deduplicate by provider ID. Keep fetched timestamps and query configuration alongside the snapshot. Sanitize and minimize fields before exposing them to clients.
8. Set `truncated = totalCount > returnedCount`. If the header is absent and 500 records arrive, completeness is unknown. Display “Latest 500 of N matching listings” (or “Up to 500; coverage may be incomplete”). Never silently claim complete Chicago coverage.
9. Atomically publish the normalized snapshot only after validation. An HTTP failure, quota skip, invalid JSON, or validation failure preserves the last good inventory and updates a separate refresh status. A valid empty response is a genuine empty snapshot; distinguish it from a failure.
10. Keep user notes/favorites/verification outside provider-owned snapshots. Publish the app via its existing supported deployment flow only after the data update passes validation.

If the first actual query exceeds 500, the initial daily mode is deliberately incomplete. Options: narrow geography with an explicit visible filter; use less frequent complete pagination within a predeclared request budget; or select a paid plan. Never expand pagination automatically just because `X-Total-Count` is large. A 2-page daily query already requires 56–62 requests per normal month.

Implemented configuration:

| Setting | Actual location/default |
|---|---|
| `RENTCAST_API_KEY` | GitHub Actions secret; never browser code |
| `SPICYHOME_TRACKING_ENABLED` | Repository variable; absent/false skips both tracking and city-context jobs |
| `SPICYHOME_PAGES_ENABLED` | Repository variable; absent/false skips website publication |
| Daily and rolling request caps | `data/search.json`: `max_attempts_utc_day=1`, `max_attempts_32_days=30` |
| Query city/state | `data/search.json`: `city=Chicago`, `state=IL` |
| Rent/layout | `data/search.json`: `rent_min=1200`, `rent_max=3000`, `bedrooms=1`, `bathrooms=1` |
| Page size and downtown rectangle | `data/search.json`: `limit=500`, `bounds`; one page per attempt |
| `AFDC_API_KEY` | Optional GitHub Actions secret |
| AFDC/CTA endpoints | `AFDC` and `CTA` constants in `src/city_context.py`; no endpoint environment variables |

Other `RENTCAST_*` configuration variables are not read by the implementation.
See [SETUP.md](SETUP.md) for activation and first-run verification.

Initial setup: create an account in the [RentCast API dashboard](https://app.rentcast.io/app/api), select Developer, create an endpoint-restricted key, verify current billing-cycle usage, add the secret in the SpicyHome repository's Actions settings, initialize usage state with appropriate existing usage/reserve, then enable one manual run. The provider docs support endpoint and IP restrictions; shared hosted-runner IPs make strict IP allowlisting inconvenient. [Getting started](https://developers.rentcast.io/reference/getting-started-guide)

## AFDC charging layer

The current developer documentation resolves to `developer.nlr.gov`; older references use `developer.nrel.gov`. The implementation uses the documented host in the `AFDC` source constant.

Fetch one regional dataset daily or weekly, independently of apartment addresses:

```text
GET https://developer.nlr.gov/api/alt-fuel-stations/v1.json?fuel_type=ELEC&state=IL&status=E&access=public&limit=all
X-Api-Key: <AFDC_API_KEY>
```

`E` means available and `public` means public access. `limit=all` is documented; numeric limits only allow up to 200. JSON contains `fuel_stations` plus `total_results`. Preserve station ID/name, coordinates, network, connector types, L2/DC port counts, access restrictions/hours, pricing text, update/confirmation timestamps. Filter geographically after retrieval and compute straight-line distances locally. Label them “nearby public charging,” never “building EV charging.” Station availability is not a live free-port count. [All-stations API](https://developer.nlr.gov/docs/transportation/alt-fuel-stations-v1/all/)

A key can be passed in `X-Api-Key` rather than logged in a URL; keep it private. [Key usage](https://developer.nlr.gov/docs/api-key/) Default registered-key limit is 1,000 requests/hour across services; DEMO_KEY is only 30/hour and 50/day per IP. Response headers expose remaining rate budget. Use a registered key for scheduled production requests, not DEMO_KEY. [Rate limits](https://developer.nlr.gov/docs/rate-limits/) [Signup](https://developer.nlr.gov/signup/)

The nearest-stations endpoint is also documented with latitude/longitude, radius in miles, offset, and limit. The regional cache is preferable here because it avoids one call per apartment and does not transmit provider-derived apartment locations for enrichment. [Nearest endpoint](https://developer.nlr.gov/docs/transportation/alt-fuel-stations-v1/nearest/)

## Implemented CTA source and alternatives

The shipped city-context job reads the [Chicago Data Portal CTA station dataset](https://data.cityofchicago.org/Transportation/CTA-System-Information-List-of-L-Stops/8pix-ypme), groups platforms by `map_id`, and retains station routes and the advertised ADA flag. It does not download GTFS during scheduled runs or calculate a walking route. Like rental tracking, the context job requires `SPICYHOME_TRACKING_ENABLED=true`.

The following GTFS and OSM interfaces are alternatives, not active dependencies:

CTA's downloadable [GTFS feed](https://www.transitchicago.com/downloads/sch_data/google_transit.zip) includes stop locations, route/trip tables and schedules. It generally updates every week or two. Refresh weekly and reduce to parent rail stations plus route associations for the app; retain the source download date. [Official GTFS guide](https://www.transitchicago.com/developers/gtfs/) Train parent station IDs use 40000–49999; use the GTFS parent relation rather than counting opposite platforms twice. [CTA Train Tracker documentation](https://www.transitchicago.com/developers/ttdocs/)

Compute geographic distance to stations and label it “straight-line distance.” Do not describe it as a walking duration or actual commute time. Scheduled commute calculation would need GTFS calendar/trips/stop_times and routing logic; a simple nearest-stop distance cannot establish it.

CTA permits data use to assist transit riders/promote public transportation, allows caching with reasonable freshness efforts, and forbids implying affiliation/endorsement. A transit-access feature fits that stated purpose; keep it scoped to helping riders. [CTA terms](https://www.transitchicago.com/developers/terms/)

OSM is an optional cached spatial supplement, not required for first launch. Charging uses `amenity=charging_station`; access may be public, customer-only, or private, with separate connector/fee tags. Missing access information is unknown in our app. [OSM charging tags](https://wiki.openstreetmap.org/wiki/Tag:amenity%3Dcharging_station) OSM attribution and ODbL obligations apply to derived/distributed data. [License](https://www.openstreetmap.org/copyright)

Avoid making a public Overpass instance a critical runtime dependency. Current OSM guidance warns of overload, sets much smaller expectations for recurring use than one-off queries, and directs commercial workloads toward self-hosting/paid services; main-instance rules also restrict some rapid AI-app deployment platforms. Prefer a prebuilt extract or the official AFDC/CTA sources above. [Overpass guidance](https://wiki.openstreetmap.org/wiki/Overpass_API)

## Terms that affect the architecture

RentCast expressly permits storing API data and displaying/distributing it, subject to its restrictions and applicable third-party terms. Keep keys confidential and use reasonable measures against unauthorized scraping. Section 2(iv) prohibits using the API or API data to send automated queries to websites. Therefore avoid automated portal lookups or property-page scraping seeded by RentCast addresses; manual search links and separately downloaded regional datasets are the practical design. Attribution is optional; don't imply endorsement. [API terms](https://www.rentcast.io/terms-api)

## Remaining unknowns before live activation

- Actual query count/completeness for Chicago 1-bed/1-bath $1,200–$3,000, and prevalence of missing unit IDs/coordinates. No paid request was made to establish these.
- Whether a given apartment's listed rent excludes mandatory fees, utilities, or parking. Rent alone must not be presented as total monthly housing cost.
- Source-account allowance and key setup. No guarantee of zero overages is possible if unrelated calls bypass this workflow's ledger.
- Building parking and EV amenity verification require an explicit reliable source or user entry.

## Implemented CTA source

The production adapter uses the smaller official Chicago Data Portal [CTA station reference](https://data.cityofchicago.org/Transportation/CTA-System-Information-List-of-L-Stops/8pix-ypme), endpoint `https://data.cityofchicago.org/resource/8pix-ypme.json?$limit=1000`. Group platform rows by `map_id`, union route flags and parse string coordinates. The observed dataset had 302 platform rows / 144 distinct station IDs and source update November 19, 2025. SpicyHome fetched 37 distinct stations inside its downtown search window on September 7, 2026. This is a dated station reference, not a live service or accessibility guarantee. The initial full GTFS download exceeded the bounded fetch size; no partial archive was accepted.

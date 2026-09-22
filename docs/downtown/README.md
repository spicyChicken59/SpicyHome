# Downtown home search — implementation and acceptance

Starting/base commit: `a427c4c0f591ed8800534c85a60bd7617232cc5b`.
Branch: `feat/downtown-home-search`. PR #30 remains merged and untouched.
Research observed: **2026-09-22**. No provider requests were made.

The branch implements one Discover → dossier → save → compare → revisit journey. Browser visual acceptance is **BLOCKED**, so this is an implementation for review, not a claim that the requested visual gates passed.

## Search behavior

“Downtown home search” appears in Discover with a preview of all changes. Applying it explicitly selects River North, Streeterville, Lakeshore East, The Loop and West Loop / Fulton Market; excludes South Loop; keeps one- and two-bedroom choices; requests a private balcony, both in-unit laundry functions, strictly more than 600 sq ft, and documented high-rise form. Documented offer restrictions are excluded. Address/program evidence goes to verification. Ordinary records without a restriction remain investigable, with no claim of unrestricted eligibility.

The starting move-in target is November 1, 2026. The $2,500–$3,000 range is flexible: no minimum and no hidden $3,000 cap. Applying the preset clears previous price, text, radius, single-neighborhood and layout-evidence gates. Parking is optional; EV is not a requirement or leading question. The new controls do not change acquisition bounds.

Neighborhood inclusion is OR; exclusions win, including a source identifying both The Loop and South Loop. West Loop and Fulton Market are grouped only as explicit selectable source labels. Curated legacy neighborhood labels keep their retained source identities. Unverified provider neighborhood strings, ZIPs, radius membership and community areas do not become neighborhood evidence.

The same model partitions the list, map, Focus and research suggestions. The active home search uses explicit facts, with no weighted rankings. There are separate buttons for property-criteria matches and known-area verification leads. Unresolved neighborhoods and excluded records have secondary, bounded lists with ten more records per request. Saved homes remain accessible in Decision Desk regardless of those exclusions. A zero-match view names missing criteria and offers explicit, individual removal controls.

Search settings, named searches and a one-step undo survive reload and export/import. Import now explicitly restores the incoming search settings as well as merging notes and named searches, after validation and the existing import confirmation. Existing source prices and personal quotes keep their own basis and dates.

## What the actual retained data establishes

The full preset has **0 supported property-criteria matches, 5 known-area verification leads, 256 neighborhood-unresolved records, and 739 records excluded by all active filters**. These are counts of the 1,000 retained records, not market inventory. The 739 include non-Chicago records and all five curated South Loop records. No record was removed. Relaxing a criterion is an explicit user action.

Five existing properties were enriched. A sixth, AMLI River North, was inspected as a supplied reference; no new prospect or unit was created. Floor and view remain unconfirmed for the five retained plan records. A building’s height never supplies an apartment floor.

All observations below were accessed through public primary-source retrieval on September 22, separately from the public application browser check. Dynamic source advertisements can change. New research is stored in `data/home-evidence.json`, applied to seed/current feed by `tools/amend_home_evidence.py`, and reapplied/retained by the normal tracker without any new network path. The original scalar prices, observation clocks, price histories, events and source arrays remain unchanged.

| Stable ID / retained identity | Primary sources observed 2026-09-22 | Supported facts and qualifications | Remaining confirmation |
| --- | --- | --- | --- |
| `coast` · Coast, 345 E Wacker · plan 1x1L | [Overview](https://www.rentcoast.com/), [amenities](https://www.rentcoast.com/chicago/coast-at-lakeshore-east/amenities/), [plans](https://www.rentcoast.com/chicago/coast-at-lakeshore-east/conventional/) | Lakeshore East; 46-story building; 1BR/1BA plan, 663 sq ft. Plan advertisement from $2,650/month on a 15-month lease; fee treatment unspecified. Garage advertised. | Suite amenities are qualified to selected suites: glass-paneled balconies and washer/dryer do not establish 1x1L’s private balcony or appliances. Four units advertised, dates not established. |
| `marlowe` · 169 W Huron · A8 | [Overview](https://www.livemarlowe.com/), [community](https://www.livemarlowe.com/community), [A8](https://www.livemarlowe.com/floorplans/a8) | River North; 1BR/1BA A8, 719 sq ft. Unit 806 advertised October 26, 2026; 606 November 6, 2026; both $3,411/month with unspecified fee basis. Garage advertised. | Private balcony and both laundry functions not established. Generic appliances are not laundry proof. A 15th-floor social space is not an explicit total-height description. Unit 606’s date is after the target; neither unit becomes a synthetic record. |
| `amli-west-loop` · 205 S Peoria · A2c | [Overview](https://www.amli.com/apartments/chicago/west-loop-apartments/amli-west-loop), [amenities](https://www.amli.com/apartments/chicago/west-loop-apartments/amli-west-loop/amenities), [plans](https://www.amli.com/apartments/chicago/west-loop-apartments/amli-west-loop/floorplans) | West Loop; in-unit washer/dryer advertised; A2c listed with 635–644 sq ft and starting $2,769 base / $2,894 source total. Reserved garage advertised. | Balconies are selected-home marketing; A2c balcony and exact unit size remain unresolved. Height unknown. “Now” is not November 1 confirmation. ARO messaging establishes a mixed-program address, not that A2c or unrelated market-rate offers are restricted. |
| `215-west` · 215 W Washington · T03 | [Amenities](https://www.215westapts.com/amenities), [plans](https://www.215westapts.com/floorplans) | The Loop; high-rise description; T03 1BR/1BA, 756 sq ft; in-home washer/dryer. T03 advertises $2,683/month and October 24, 2026, subject to confirmation. Covered parking advertised. | Private T03 balcony not established; shared terrace does not qualify. Parking’s retained $300 quote was not reconfirmed and keeps its earlier date. Actual floor/view and November 1 lease start unknown. |
| `73-east-lake` · 73 E Lake · 07a | [Overview](https://www.experience73.com/), [amenities](https://www.experience73.com/amenities), [models](https://www.experience73.com/models) | The Loop; 42-story high-rise; 07a 1BR/1BA, 682 sq ft, shown with unit 2607. In-unit washer/dryer and garage advertised. Unit advertisement: $2,866–$4,319 base on a 12-month term. | Private balcony not established; rooftop facilities are shared. Source displays October 14 without an explicit year in the listing. Unit number 2607 does not prove floor 26. The old scalar rent stays dated September 7. |
| Reference only — AMLI River North, no new record | [Amenities](https://www.amli.com/apartments/chicago/downtown-chicago-apartments/amli-river-north/amenities) | The operator lists both Juliet and private balconies, each qualified to selected homes, plus washers and dryers. | No particular plan/unit linked to a balcony, price or date in this pass; therefore not added as an invented match. |

CPAH remains Greenwood’s existing provenance. Its annotation and original PR #30 clock/scope were not modified or inferred from price.

## Evidence and notebook preservation

Each new assertion retains attribute, typed value, status, building/plan/unit/address scope, exact subject, applicability, qualification, source name, URL and calendar observation day. Validators reject invalid dates, URLs, scopes, types, and preference arrays before mutation. Plan/unit applicability must match the retained identity. Conflicting sources require verification. Selected-home claims cannot qualify a particular plan/unit.

A source date after the target is labelled **after your target**; absent or ambiguous dates stay unknown. Earlier advertised dates require reconfirmation. Neither date state changes property-criteria evidence into an availability guarantee.

The offline ledger checks stable ID, address, city and plan before annotation. Refresh, seed omission, provider omission/reappearance and subsequent research retain previous observations. Identity conflicts fail rather than transfer evidence to another home. Notebook edits freeze the original snapshot, keep later research in `home_evidence_update`, and preserve that later history on archive edits and import. Notes remain personal. Known $0 values and undated personal quote histories survive.

`evidence/integrity.json` confirms that stripping only `home_evidence` from seed/current data exactly reproduces the starting JSON. Historical feeds, source arrays, prices, dates, provider state, usage, acquisition configuration and workflows were unchanged. All 22 immutable design files match v2.13.0 / `14a752dd0269bd6ebbb7080eb0d9e1922cd1ef2c`.

## Acceptance gates

| Gate | Result | Evidence / limitation |
| --- | --- | --- |
| `npm test` | PASS | 273 tests passed, zero failed or skipped; log in `evidence/npm-test.log`. |
| `npm run check` | PASS | JS syntax and 56 Python tests; `evidence/check.log`. |
| `python tools/check_site.py` | PASS | 1,000 records, static entrypoints and 22 immutable assets; `evidence/check-site.log`. |
| Focused home-search acceptance | PASS | 17 Node/jsdom tests, including the complete synthetic journey; `evidence/home-search-tests.log`. This is not rendered-browser proof. |
| Offline research preservation | PASS | Six Python cases: identity guards, refresh/omission/reappearance, immutable clocks, append-only research and JS/Python validator parity; `evidence/research-preservation.log`. |
| Existing filter, saved-search, comparison, quote, eligibility and archive regressions | PASS (Node/jsdom/model) | Included in the full `npm test` result. Legacy lens fixtures explicitly omit later research; the production-height test now expects the three sourced buildings. |
| Supported browser connection | PASS | Cloud Chrome connected through the supported browser skill. |
| Public-origin baseline | PASS (read-only) | `https://spicychicken59.github.io/SpicyHome/` opened; title “SpicyHome — Chicago apartment notebook”; source status “Listing scan Sep 21, 2026 · coverage & sources”. New preset absent, as expected before merge. No personal notebook actions. |
| Localhost browser access | **BLOCKED** | Navigation to `http://127.0.0.1:8765/` returned `net::ERR_BLOCKED_BY_CLIENT`. Reported at session start. No policies altered and no alternate browser mechanism used. |
| Isolated browser journey at desktop, 390px and 320px, both themes | **NOT RUN — BLOCKED** | The supported browser cannot reach the local implementation. Responsive styles are authored, not visually certified. |
| Existing rendered browser suites | **NOT RUN — BLOCKED** | Same supported-browser restriction. No browser gate is marked PASS from jsdom results. |
| Discover / neighborhoods / dossier / comparison screenshots | **BLOCKED — NOT PRODUCED** | No screenshots of the implementation could be taken. The old public release is not substituted as proof. |

The isolated synthetic journey covers apply → area editing → retained/excluded South Loop → list/map/Focus consistency → lead inspection → save two candidates → compare → note and $0 parking → reload → actual export/import handlers → archived recovery. Synthetic positives do not inflate the real-data counts.

No merge or manual deployment is part of this branch. Browser acceptance and the requested screenshots remain the explicit review gate before a future merge decision. The unrelated Elle/Tapestry empty-history label issue is deferred.

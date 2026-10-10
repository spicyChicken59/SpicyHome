# Unresolved Downtown records: deterministic verification triage

Starting main: `e638a57dd735dc04ab6975c2d70fb1099d977555` (squash merge of #31).
The initial checkout was clean, there were no intervening commits and GitHub
reported zero open PRs. Branch: `feat/unresolved-home-triage`.

## Product change

Previously Discover exposed one unresolved-neighborhood list, paged ten records
at a time in the general apartment sort order. It listed missing facts but did
not distinguish verification effort or show derived distance and source access
alongside those facts.

The same disclosure now shows three explicit buckets, including empty buckets:
neighborhood only, neighborhood plus exactly one other selected criterion, and
neighborhood plus two or more other selected criteria. Each bucket names its
remaining facts and pages independently. Later buckets are reachable without
paging through earlier ones. A row opens the existing dossier at Home criteria
& research and offers the existing source/search links with their qualifications.

`criteriaReading()` now emits stable missing-criterion keys alongside its existing
labels. `unresolvedTriage()` only projects that result; it reads no new evidence.
Exclusions still win. `discoveryGroups()` uses that projection and orders unresolved
records by bucket, descending source observation time (`home.observed_at`), then
ascending ID in code-unit order. Invalid/missing observation times sort last.
Within the several-checks bucket, the exact number of checks is shown but does
not rank records. Rent, distance, personal quotes, saves, research-recording time
and the general apartment sort control do not rank this queue.

## Full Downtown preset on the retained feed

| Evidence group | Before | After |
| --- | ---: | ---: |
| Property-criteria matches | 0 | 0 |
| Known-area verification leads | 5 | 5 |
| Neighborhood unresolved | 256 | 256 |
| Excluded | 739 | 739 |
| Total retained | 1,000 | 1,000 |

| Unresolved bucket | Records |
| --- | ---: |
| Neighborhood only | 0 |
| Neighborhood + one check | 0 |
| Several checks remain | 256 |

All 256 need neighborhood identity plus private balcony, in-unit washer AND
dryer, exact-plan size strictly over 600 sq ft, and building height. All 256 have
coordinates. The empty easier buckets are intentional: no closer candidate is
invented from raw square footage, price, proximity or marketing. Changing active
criteria immediately recomputes the buckets from the shared engine.

Feed SHA-256: `476f86a411dfac96afe5729208b9e9436c581417f3b6c2cacbe9cc5eeb81e42a`.
These are counts of retained evidence states, not downtown housing supply.

## Evidence preservation

Rows use `urbanSetting().detail` for explicitly derived straight-line distance.
They never use its radius labels as neighborhoods. Without coordinates, the row
says unlocated and distance unknown. Neither location presentation can satisfy
neighborhood identity or clear an area exclusion.

Triage is computed, never written to a home, original snapshot, research ledger,
notebook schema or export. Source facts, personal evidence, derived context and
unknowns retain their existing boundaries. Building height does not establish
floor/view; selected-home marketing does not establish an exact plan; low rent
does not imply restrictions; incomplete subtotals remain qualified. Query absence
does not establish unavailability. Save time never becomes quote-observation time;
no-op saves preserve research dates; later evidence and original snapshots survive
archive, reload and export/import paths.

No research or neighborhood assignments, data edits, provider requests, external
transactions, budget/schedule/acquisition changes, or sibling-repository edits.

## Validation

- `npm test`: **297 passed, 0 failed, 0 skipped**. Includes 13 new model/jsdom
  tests and all 28 existing Downtown tests, including #31 timestamp,
  height-supersession and evidence-preservation regressions.
- New coverage: all buckets; exclusions and documented negatives; selected-home,
  conflicting and eligibility evidence; derived/unlocated context; deterministic
  sort independent of general sort and personal timestamps; live criteria changes;
  List/Map/Focus/dossier state; independent pagination and focus; save/no-op save,
  reload/export/import/archive preservation; real-feed counts and source paths.
- `npm run check`: JavaScript syntax checks and **56 Python tests passed**.
- `python tools/check_site.py`: static entrypoints, **22 immutable assets** and
  **1,000 records** verified.
- Shared design: **v2.13.0**, commit
  `14a752dd0269bd6ebbb7080eb0d9e1922cd1ef2c`; all 22 files match both the immutable
  provenance hashes and starting main. **Zero drift**. Provenance is unchanged.
- `git diff --check`: passed. Data, source/acquisition code and workflows remain
  byte-for-byte unchanged from starting main.
- Rendered desktop / 390 / 320 / light / dark acceptance:
  **NOT RUN — phone execution environment.** No browser, localhost acceptance,
  screenshots, tunnel, branch deployment or browser-policy changes were attempted.

The PR description records the final commit and its CI results. No merge is
authorized by this milestone.

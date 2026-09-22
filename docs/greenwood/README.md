# Greenwood eligibility evidence

The original implementation below was reviewed at `86028437e2467b4cf6d6e6341c75e6a5367f4a1c`.
That review found an archived-save rollback missed by its tests. See the
[focused correction and current acceptance evidence](correction/README.md).

This correction preserves a dated source annotation for one existing provider
record. It does not determine anyone’s eligibility or verify current availability.

Base: `7d05766d18301c83b2672dbf5b13fe9334c1d5fa`

Branch: `fix/greenwood-eligibility-evidence`

## Identity and source scope

The exact record is
`rentcast:2030-Greenwood-St,-Unit-1BR,-Evanston,-IL-60201`, at
2030 Greenwood St, Unit 1BR, Evanston, IL 60201. The provider reports one bedroom,
one bathroom, 750 square feet and a $1,271 asking rent. Its retained observation
is `2026-09-16T13:29:09.296160Z`; provider last-seen is
`2026-09-16T03:43:56.899Z`, and listed date is `2026-08-31T00:00:00.000Z`.
Its two retained price observations are September 8 and September 16. None of
these dates or amounts changed. The [original record](evidence/before-record.json)
and [annotation-only integrity check](evidence/integrity.log) preserve that basis.

[CPAH’s Available Rentals page](https://cpahousing.org/rental-housing/available-rentals/)
was publicly read on **September 19, 2026**. It lists a one-bedroom at this
address under Inclusionary Housing and describes conditions involving income,
household size and program rules. The match establishes an **address/program
relationship**. “Unit 1BR” is not a numbered unit identifier, and this source
does not independently establish the retained provider offer’s price or terms.
No income threshold, move-in date, available unit or household verdict is added.

The exact base record omitted this condition. That omission was reproduced in
Chromium using the base’s own `dist/` files:
[before screenshot](evidence/before-390-light-discover.png) and
[baseline result](evidence/baseline-browser.log).

## Persistence and compatibility

- `data/eligibility-evidence.json` retains the annotation and source day.
  `src/eligibility.py` matches the stable ID plus address, city and layout. A
  contradictory identity raises an error before publication rather than guessing.
- `src/tracker.py` preserves retained evidence on refresh and reapplies the
  identity-matched annotation, including after omission and reappearance.
  Incoming price/date changes cannot re-date this separate source observation.
- `tools/amend_eligibility.py` is an offline, idempotent current-feed amendment.
  The committed feed diff adds exactly one field to exactly one home. Historical
  feeds, events, provider clocks, status and usage files are unchanged.
- The optional `eligibility_evidence` field is validated on homes, feed loading,
  manual entries and saved snapshots. Unsafe links, invalid dates, oversized text
  and malformed annotations fail before an import mutates the notebook.
- An evidence-bearing saved home retains its original snapshot and query dates.
  For an older unannotated save, an explicit later notebook action can retain
  new evidence in `eligibility_update`, with its own `recorded_at`. The original
  snapshot is not rewritten. Passive viewing never backfills it. Homes outside
  this evidence path retain their existing snapshot-save behavior.

Discover cards, compact rows and research picks use the same restrained note as
saved rows and finalists. The dossier exposes source, observation day, scope and
uncertainty. Comparison uses a shorter dated statement and explicitly identifies
missing evidence as unknown. No filtering, sorting, scoring or availability rule
uses this annotation.

## Acceptance

| Gate | Result | Evidence |
| --- | --- | --- |
| JavaScript unit/model/jsdom regressions | PASS — 252/252 | [log](evidence/npm-test.log) |
| Syntax and Python regressions | PASS — 50/50 Python | [log](evidence/check.log) |
| Static site and immutable shared assets | PASS — 22 assets, 1,000 records | [log](evidence/check-site.log) |
| Focused deterministic regressions | PASS — 6 JavaScript, 7 Python | [JS log](evidence/focused-js.log), [Python log](evidence/focused-python.log) |
| Focused Greenwood browser journey | PASS — 102/102 | [log](evidence/focused-browser.log), [results](evidence/browser-results.json) |
| Existing browser suite | PASS — 469/469 | [log](evidence/existing-browser.log) |
| Flagship browser suite | PASS — 89/89 | [log](evidence/flagship.log) |
| Windows and physical devices | NOT RUN | Linux Chromium acceptance only |

All required final gates pass; no unresolved FAIL or BLOCKED gate remains.

The focused journey uses 1280px, 390px and 320px in both themes. Every combination
starts in a fresh browser context, saves through the UI, compares against a home
without recorded evidence, reloads, exports, imports into another empty context,
and opens an archived fixture with the annotation intact. All remote requests
are intercepted. The notebooks and personal state are synthetic.

Deterministic cases also cover price-changing and failed mocked refreshes,
identity conflicts, idempotence, legacy snapshots, separately recorded later
evidence, malformed atomic imports and escaped hostile text. Existing quote-date,
known-$0 and incomplete-cost tests remain intact. Adding the annotation produces
no price movement and changes no cost, filter or ordering result.

During browser acceptance, filtering exposed a missing handler on the new
source/date control. The correction rebinds that control through the existing
task-opening helper; a regression now filters before opening it. Visual review
also shortened the comparison cell while keeping full provenance in the dossier.
Final review caught a stale notes form dropping separately retained evidence after
a Save toggle. The shared save helper now carries that evidence forward, and the
legacy-snapshot regression exercises that exact sequence.

The inherited tour assertion also failed in all five of its viewports/themes:
it selected `108 Fellows Ct, # 493H, Elmhurst, IL 60126` but required the literal
word `Unit`. The first complete suite was **464/469**
([log](evidence/existing-browser-before-assertion.log)). Its unchanged section
reproduces **55/60** on the untouched base
([log](evidence/base-tour.log)). The assertion now checks the selected fixture's
actual title, address and unit label; that section passes **60/60** against the
same base app ([log](evidence/base-tour-corrected.log)). No tour product code or
fixture data changed. This is the only inherited browser assertion modified.
The complete final run passes **469/469** against the corrected harness.

## Reviewed screenshots

| View | Evidence |
| --- | --- |
| Desktop / light / Discover | [1280px](evidence/1280-light-discover.png) |
| Desktop / dark / source detail | [1280px](evidence/1280-dark-source.png) |
| Mobile / light / source detail | [390px](evidence/390-light-source.png) |
| Mobile / dark / comparison | [390px](evidence/390-dark-comparison.png) |
| Small mobile / light / Discover | [320px](evidence/320-light-discover.png) |
| Small mobile / light / comparison | [320px](evidence/320-light-comparison.png) |
| Small mobile / dark / source detail | [320px](evidence/320-dark-source.png) |
| Small mobile / dark / archived detail | [320px](evidence/320-dark-archived.png) |

These are local fixture renders, not live apartment verification. Map tiles are
intentionally blocked; no imagery is substituted for a candidate.

## Reproduction and boundaries

Local environment: Linux, Node 24.19.0, Python 3.12.14, Playwright 1.56.0 and
Chromium Headless Shell 141.0.7390.37. Playwright was installed only in the local
test environment with `--no-save --package-lock=false --ignore-scripts`;
manifests and lockfiles are unchanged. Windows was not run. No line-ending
problem was observed, and `git diff --check` passed.
Committed logs have trailing whitespace trimmed; assertion output is retained.

```sh
npm ci --ignore-scripts
npm test
npm run check
python tools/check_site.py
python -m unittest discover -s tests -p 'test_eligibility.py' -v
node --test tests/eligibility.test.mjs
# Browser tooling, when not already installed in the test environment:
npm install --no-save --package-lock=false --ignore-scripts playwright@1.56.0
npx playwright install chromium --only-shell
npm run browser-check
node tools/flagship_check.mjs scratchpad/greenwood/flagship
node tools/eligibility_check.mjs scratchpad/greenwood/focused-browser
git diff --check
```

The offline amendment was applied with `python tools/amend_eligibility.py`;
the second application reported no changes. Baseline reproduction served an
extraction made with `git archive 7d05766d18301c83b2672dbf5b13fe9334c1d5fa dist`
under `scratchpad/greenwood/base`, using:

```sh
BASE_DIST=scratchpad/greenwood/base/dist node tools/eligibility_check.mjs scratchpad/greenwood/baseline-browser --baseline
```

The tour baseline used the original section verbatim, with its setup and cleanup.
To reproduce the failure and the corrected assertion against the same base app:

```sh
mkdir -p scratchpad/greenwood/base/tools
git show 7d05766d18301c83b2672dbf5b13fe9334c1d5fa:tools/browser_check.mjs > scratchpad/greenwood/base/tools/browser_check.mjs
python docs/greenwood/evidence/extract-tour-section.py scratchpad/greenwood/base/tools/browser_check.mjs scratchpad/greenwood/base/tools/tour-section.mjs
node scratchpad/greenwood/base/tools/tour-section.mjs
python docs/greenwood/evidence/extract-tour-section.py tools/browser_check.mjs scratchpad/greenwood/base/tools/tour-section-corrected.mjs
node scratchpad/greenwood/base/tools/tour-section-corrected.mjs
```

This session set `PLAYWRIGHT_BROWSERS_PATH` to
`/workspace/scratch/dfd42b0167d5/browsers` for browser commands. Full Chrome
initially failed to create a local profile socket; escalation was rejected by
the environment policy. Headless Shell succeeded under the existing permissions.
An optional full-suite screenshot run stalled at a capture and was interrupted;
the required existing suite was rerun without `--shots`. The tour identity
assertion correction is documented above; every other inherited assertion is
unchanged. The dedicated Greenwood harness supplies the screenshots above.
The source observation remains September 19 even though implementation and
acceptance continued on September 20.

Direct `git push` could not read a GitHub username in this environment. The
connected GitHub app uploaded the reviewed blobs to the same authorized
repository; blob hashes and the complete Git tree are checked against the local
tree before opening the PR. The local commits are retained as a checkpoint;
there is no reset or force-push.

[Tested file fingerprints](evidence/verified-files.json) identify the exact
code/data bytes used for acceptance. Shared design remains **v2.13.0**, commit
`14a752dd0269bd6ebbb7080eb0d9e1922cd1ef2c`, with all immutable hashes verified.

**KEEP:** PR #28 quote provenance, archived recovery, source/personal separation,
unknown costs, known zeroes and PR #29’s visual direction. **FIX NOW:** completed
Greenwood evidence preservation and presentation. **DEFER:** Elle/Tapestry’s
empty-history labels. **OMIT:** eligibility verdicts, income calculators, ranking,
budget changes, acquisition expansion and general annotation editing.

No provider request, paid action, leasing contact, workflow dispatch, publication,
settings change, secret access or cross-repository write was performed. Mocked
provider tests do not establish apartment facts. No merge is authorized.
A future approved merge touches `dist/**` and triggers the existing Publish
website workflow, gated by its existing `SPICYHOME_PAGES_ENABLED` setting.
Workflow and deployment behavior are unchanged. Next action: independent PR
review, followed by Tahir’s separate merge decision.

# PR #30 correction: retain later evidence on archived saves

Reviewed head: `86028437e2467b4cf6d6e6341c75e6a5367f4a1c`

Verified base/main: `7d05766d18301c83b2672dbf5b13fe9334c1d5fa`

This corrects the reviewer's preservation failure within the existing PR.
The production change is one expression and an explanatory comment in
`dist/app.js`. `savedSource()` now uses `eligibilityReading(home, prior).current`.
That reader returns no current evidence for a notebook-only home, so an archived
snapshot cannot replace or re-date a separately saved update. Current records
can still supply explicitly retained updates. No snapshot migration is added.

## Reproduction and correction

The new jsdom regressions first ran against the unchanged reviewed app and
failed **4/4**: notes, stage, finalist and save actions each rolled B back to A
([failure log](evidence/before-jsdom.log)). The same notes failure reproduced
through real controls in separate empty browser contexts at 1280px/light and
320px/dark ([browser failure log](evidence/before-browser.log)).

All source annotations and personal state in this reproduction are synthetic:
A says “Synthetic original source evidence,” observed September 19; B says
“Synthetic later source clarification,” observed September 20. They are test
inputs, not new apartment facts. A was saved through the UI; B was retained
through the current record's form before the fixture omitted Greenwood.

| 320px notes-save reproduction | B's recording time before save | Recording time after save | Retained annotation |
| --- | --- | --- | --- |
| Reviewed app | `2026-09-20T14:04:44.675Z` | `2026-09-20T14:04:45.893Z` | A — incorrect rollback |
| Corrected app | `2026-09-20T14:08:05.818Z` | `2026-09-20T14:08:05.818Z` | B — unchanged |

The original snapshot and saved query context remain unchanged in both runs.
The correction also preserves the complete saved record except for the intended
personal note, including personal quote history, known $0 parking and missing
utilities. Exact traces: [before](evidence/before-320-records.json) and
[after](evidence/after-320-records.json).

| Capture | Reviewed app after notes save | Corrected app after notes save |
| --- | --- | --- |
| 1280px / light | [A incorrectly promoted](evidence/before-1280-light.png) | [B retained, A disclosed separately](evidence/after-1280-light.png) |
| 320px / dark | [A incorrectly promoted](evidence/before-320-dark.png) | [B retained, A disclosed separately](evidence/after-320-dark.png) |

[320px before the failing save](evidence/before-save-320-dark.png) shows B was
already present. These screenshots were visually inspected; the dated evidence
wraps within the viewport and the actual controls remain reachable.

## Final acceptance

| Gate | Status | Evidence |
| --- | --- | --- |
| `npm test` | PASS — 256/256 | [log](evidence/npm-test.log) |
| `npm run check` | PASS — syntax, 50 Python tests | [log](evidence/check.log) |
| `python tools/check_site.py` | PASS — 1,000 records, 22 immutable assets | [log](evidence/check-site.log) |
| Eligibility jsdom regressions | PASS — 10/10 | [log](evidence/focused-jsdom.log) |
| Archived A/B browser journey | PASS — 28/28 | [log](evidence/archived-final.log), [results](evidence/after-results.json) |
| Existing focused eligibility browser journey | PASS — 102/102 | [log](evidence/eligibility-final.log), [results](evidence/eligibility-results.json) |
| Inherited tour and quote browser sections | PASS — 136/136 | [log](evidence/saved-browser.log) |
| Windows / physical devices | NOT RUN | Linux Chromium only |
| Full unrelated map/visual browser campaign | NOT RUN for this correction | Previous-head results remain in the original report |

Four new jsdom tests cover the failure and all affected save controls. Expanded
existing tests cover legacy unannotated snapshots and annotated snapshots with
no later update. The full journey also checks reload, export/import into an
empty notebook, reappearance without duplication, and explicit retention of a
new current annotation without rewriting A. The browser journey uses actual
notes, stage, finalist, unsave/resave, export and import controls, with all remote
requests intercepted. Existing quote-date assertions are unchanged.

The inherited tour/quote sections are extracted verbatim with
`extract_saved_checks.py`; only their filesystem root is pointed at this checkout.
This runs the applicable saved-record regressions without repeating the map and
visual-design campaign. No assertion is removed or relaxed within those sections.

## Commands and environment

Linux; Node 24.19.0; Python 3.12.14; Playwright 1.56.0; Chromium Headless Shell
141.0.7390.37. Existing test tooling was reused; no dependency installation or
lockfile change was needed. No Windows or line-ending issue was encountered.
Committed text logs have trailing whitespace trimmed.

```sh
node --test --test-name-pattern='archived later evidence' tests/eligibility.test.mjs
node --test tests/eligibility.test.mjs
npm test
npm run check
python tools/check_site.py
export PLAYWRIGHT_BROWSERS_PATH=/workspace/scratch/dfd42b0167d5/browsers
node tools/eligibility_check.mjs scratchpad/greenwood-correction/archived-final --archived-updates
node tools/eligibility_check.mjs scratchpad/greenwood-correction/eligibility-final
python docs/greenwood/correction/extract_saved_checks.py tools/browser_check.mjs scratchpad/greenwood-correction/saved-browser.mjs
node scratchpad/greenwood-correction/saved-browser.mjs
git diff --check
```

The first command was run before the application edit to demonstrate failure.
The browser's `--archived-updates` mode was also run before the edit, writing to
`scratchpad/greenwood-correction/before-browser`. To repeat it against an extracted
reviewed `dist/`, set `ELIGIBILITY_DIST` to that directory. Initial harness setup
needed button-specific navigation selectors and an explicit check of the More
disclosure's open state; the final harness uses the visible controls throughout.

[File fingerprints](evidence/verified-files.json) record the tested bytes.
The feed, eligibility ledger, source dates, tracker, model, historical data,
styles, shared-design provenance, dependencies and workflows are unchanged from
the reviewed head. Shared design remains v2.13.0 at
`14a752dd0269bd6ebbb7080eb0d9e1922cd1ef2c`.

No provider request, workflow dispatch, settings/schedule/secret change, paid
action, leasing contact, deployment or cross-repository write was performed.
The address-level qualification and $1,271 provider asking-rent basis are
unchanged. Elle/Tapestry history labels remain deferred. No merge is authorized;
the next action is independent reassessment of the updated PR head.

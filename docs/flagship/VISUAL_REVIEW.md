# Flagship visual review

All observations below are local Chromium evidence. The 1,000 homes are the
committed feed; saved finalists, personal quotes and archive exercises are
synthetic notebook fixtures. None establishes apartment facts or availability.

## Before

Captured and inspected 18 captures at each of 1440 dark, 1280 dark, 1280 light,
390 dark, 390 light and 320 dark. The opening, list, map/list, Focus, both source
classes of dossier, source reading, Decision Desk, Final Three, comparison,
history, tour, archived record, Cost Lab, Price Pulse and empty search are covered.

The original browser gate reproduced four failures: mobile layout evidence
below the first dialog viewport; a 203px folded tray at 320; a 771px saved row at
320; and a 7px tour identity/dock overlap at 320. The baseline passed 465 of 469
browser assertions and all 246 unit/integration assertions.

## Review cycle 1: composition

Inspected desktop dark and 390 dark/light screenshots at full size.

- An inherited mobile rule hid the new page headings. Restored them explicitly.
- Full-width listing rows left an unhelpful empty middle. Composed desktop
  identity, evidence and money as three aligned reading columns.
- Research picks stacked ahead of the actual results on phones. Made their
  existing reasons and caveats one optional native disclosure; an opened pick
  still exposes its reasons immediately.
- Comparison's computed summary delayed the actual paired facts. Made that
  explanatory summary optional, bringing the identity selectors and facts up.
- A large initial focus outline made the dossier title look like a form field.
  Kept the heading focus for announcement and removed only its decorative ring.
- Added a persistent Close action to the dossier and comparison reading bars.
- Kept every finalist's accent equal; candidate letters do not imply a ranking.

## Review cycle 2: six responsive compositions

Inspected all six contact sheets plus full-size finalist, dossier, listing,
comparison, history, tour, Price Pulse and empty-state captures.

- Sources opened beneath the sticky dossier bar: the new native disclosure
  needed the same scroll clearance as the sections it replaced.
- Price Pulse inherited pale inactive labels intended for a dark surface.
  The light composition exposed the contrast failure.
- The sticky comparison tray was constrained by its parent near the top of
  Discover and could cross the fixed phone navigation. Made its mobile position
  fixed with explicit navigation clearance and room to scroll the page past it.
- Desktop filter and view groups remained at exactly the same vertical level.
  Restored distinct reading bands, retaining the compact typography.
- An imported archive still carried the generic listing kicker, and its old
  absence sentence called every query capped. The dossier needs an explicit
  archive identity and a coverage-neutral absence sentence. Availability must
  remain unverified for both complete and capped queries.

The fresh-profile exercise preserved saving, three finalists, comparison,
layout evidence, literal $0 parking, entered quote day, separate recording time,
notes, resolved-question removal, rule-out/recovery, reload, export and import.
The additional checks caught the source scroll defect; they also prompted the
archive copy correction. The original source assertions are retained and now
open the source disclosure before measuring its content.

## Review cycle 3: repairs and keyboard edges

Inspected all six contact sheets and full-size 320px dossier/empty search,
390px sources/tour/light Price Pulse, desktop opening and mobile finalists.
Source summaries now land below the dossier dock; inactive Price Pulse filters
are readable in light mode; archive identity is explicit. All 71 initial
acceptance assertions passed, then 84 passed with keyboard and rendered-filter
contrast checks added.

One more screenshot-derived check found the 320×740 empty-search Reset control
could receive keyboard focus behind the comparison tray: its bottom was 503px,
while the tray started at 430px. Native viewport scroll padding now accounts for
the fixed controls. Repeating the same Tab path brought Reset to 177–224px,
above the tray. The regression also activates Reset and checks that all three
comparison choices survive.

Reading the lower desktop comparison facts exposed one last issue: property
headers had scrolled off-screen (top −571px). The desktop table now retains all
three column identities directly below its Close bar (top 86px, exactly the bar's
bottom), with wrapping and fixed column proportions. The mobile paired layout
remains separate. Focused checks cover 1440 dark and 1280 dark/light. A final
six-size capture and complete browser gate run after these repairs.

## Evidence method and limits

`tools/visual_review.mjs` captures the six requested viewport/theme combinations.
`tools/flagship_check.mjs` uses real browser controls for the complete notebook
journey and explicit edge fixtures. `tools/browser_check.mjs` retains the
repository's existing product/evidence assertions.

External map tiles and font services are blocked in reproducible captures.
Before screenshots therefore use available fallback fonts; after screenshots
use the app's bundled, licensed fonts. Marker geometry and selection are tested;
live tile delivery is not. Local screenshots, passing tests and GitHub checks
are not provider verification. Public-origin acceptance is not claimed.

# SpicyHome setup

The apartment notebook, sourced building research, comparison, map, notes and backups work before any paid API is connected.

## 1. GitHub repository

The source repository is **[spicyChicken59/SpicyHome](https://github.com/spicyChicken59/SpicyHome)**. It contains the complete application, tests, research and GitHub workflows.

The source repository is public, like the other SpicyChicken websites. Only application code, public building research, provider snapshots and request counts belong there. Browser notes, exported notebooks and API keys must remain private. The Sites application itself can remain owner-private.

To work locally:

```bash
git clone https://github.com/spicyChicken59/SpicyHome.git
cd SpicyHome
npm ci --ignore-scripts
```

The source repository and published website are separate. Follow the publication steps below when ready to make the website live.

## 2. Rental listings

1. Open the [RentCast API dashboard](https://app.rentcast.io/app/api). Review the current plan, account usage and automatic overage policy before activating an API key.
2. Add the key in GitHub repository **Settings → Secrets and variables → Actions → Secrets** as `RENTCAST_API_KEY`.
3. Check `data/search.json`. It contains the budget, 1-bed/1-bath query, downtown search window, one-page limit and local request caps. The lower cap does not cover other callers sharing your account.
4. Add repository **variable** `SPICYHOME_TRACKING_ENABLED` with value `true`.
5. Run **Actions → Track apartments → Run workflow** once. It reserves and commits one attempt before contacting RentCast. No commit permission means no provider request.
6. Confirm the job succeeded and `dist/status.json` says `success`. `dist/data.json` must have a new `provider.last_success` and coverage count. The dashboard’s Sources & setup view shows both the last successful scan and the latest attempt status.

The shipped defaults allow one attempt per UTC day and at most 30 in a rolling 32-day window. The free provider plan observed during implementation had 50 requests per billing month and automatic overage charges. Recheck its current terms; this integration cannot guarantee no overages if you make other calls. Do not reset `data/usage.json` to evade the budget.

**Do not paste API keys into chat, the app, a notebook export or a committed file.** Keys are read only by the GitHub runner or local Python process.

## 3. Public GitHub Pages

1. In repository **Settings → Pages**, select **GitHub Actions** as the build/deployment source.
2. When ready to publish, set repository **variable** `SPICYHOME_PAGES_ENABLED` to `true`. It is disabled by default so the initial source push does not attempt publication before setup.
3. Run **Publish website** from `main`. It publishes `dist/` from committed `main`.
4. The intended GitHub Pages URL is `https://spicychicken59.github.io/SpicyHome/`; it is not live merely because this guide names it.

Publication is enabled only while `SPICYHOME_PAGES_ENABLED` is `true`. It also runs after tracking/context workflows complete. This explicit trigger handles updates committed using GitHub’s built-in token. Existing branch protections and environment approvals remain in force. If protected `main` blocks the tracker’s reservation commit, it fails before consuming a provider request; configure an authorized data-publication flow instead of bypassing the protection.

The private Sites deployment reads `dist/config.json` to find the public raw GitHub snapshot. It starts with packaged research until that source exists. Notes belong to a browser origin: use Export/Import when moving between the private Sites URL and GitHub Pages.

## 4. Optional public EV charging

Create an [NLR developer key](https://developer.nlr.gov/signup/) and store it as GitHub secret `AFDC_API_KEY`. **Update city context** also requires repository variable `SPICYHOME_TRACKING_ENABLED=true`; with the gate disabled, even a manual run is skipped. Once enabled, run **Update city context**. This fetches a regional public-station dataset and filters it locally; it never sends apartment-provider addresses to another service. Charging data is a dated station reference, not live free-port status.

The **CTA station layer needs no key**. It uses the [official Chicago Data Portal station dataset](https://data.cityofchicago.org/Transportation/CTA-System-Information-List-of-L-Stops/8pix-ypme), not the large full transit schedule archive. Its source reference was last updated November 19, 2025; the app reports its own fetch date separately. Do not infer current elevator service, a step-free route or a walking time from it.

## 5. Use the notebook

- Heart a place to save it. Add a manual entry for any apartment you find elsewhere.
- In **Take a closer look**, record quoted base rent, parking, recurring fees, utilities, one-time nonrefundable fees, lease details and your notes. Unknown fields are never treated as free. An explicit `0` means included or no charge, as you recorded it.
- Enter a tour time in Chicago local time. **Save tour to calendar** downloads a personal one-hour reminder; contact leasing separately to confirm the appointment.
- Compare up to three places. Use print for a paper comparison.
- Export the notebook periodically. Import validates the full backup before merging. Incoming matching records replace existing records only after confirmation.

## Failure and recovery

| Situation | Behavior |
| --- | --- |
| API key missing or tracking disabled | No provider request. The research notebook remains usable. |
| Daily or rolling request cap reached | No provider request; last snapshot retained; failed attempt status is published when repository permissions allow. |
| Reservation commit fails | No provider request. Repair the repository permission or branch flow. |
| Timeout, invalid response or bad rent data | No automatic retry; prior complete inventory remains published. |
| More than 500 matching listings | One page only; incomplete coverage is explicitly reported. |
| A previously seen listing disappears | Retain it as not seen in the latest snapshot; do not assume it was rented. |
| Source unavailable in browser | Retain the last complete connected cache and saved-home snapshots. |
| Local storage full or blocked | Persistent warning with immediate export action; no false saved confirmation. |
| CTA/AFDC update fails | Keep the prior layer and its observation date; expose the failure in source status. |

## Development checks

```bash
npm ci --ignore-scripts
npm test
npm run check
python tools/check_site.py
```

Tests use synthetic provider responses and DOM emulation. They never spend provider quota, email leasing agents or submit applications. Actual map tiles, browser rendering and a credentialed live rental ingestion remain separate verification steps.

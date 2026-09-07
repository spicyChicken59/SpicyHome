# SpicyHome project rules

Preserve the original SpicyChicken mark geometry and immutable shared-asset provenance. The app is an apartment decision notebook, not a listing advertisement.

Never invent rent, unit availability, parking spaces, EV compatibility, accessibility, neighborhood ratings or price history. Keep base rent, advertised total, known subtotal and unquoted amounts distinct. Keep public charging separate from resident amenities. Do not infer that a listing was rented from its absence in a capped query.

API secrets belong only to environment variables/GitHub Actions secrets. Never put them in dist, browser code, URLs, logs or notebook exports. Do not reset usage reservations, add hidden provider retries or expand pages without an explicit budget decision. Persist reservations before provider calls. Preserve last good data on failure.

User notes remain local to the browser. All imports must validate before mutation. Export recovery must remain available when storage fails. Saved records must retain home snapshots.

Run npm test, npm run check and python tools/check_site.py for code/data changes. Do not contact leasing agents, subscribe to APIs, make paid test calls, place applications or book tours without the user's explicit authorization. Respect repository protections.

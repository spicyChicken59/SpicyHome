import {
  defaults,
  statuses,
  money,
  esc,
  safeUrl,
  amount,
  costs,
  visibleHomes,
  validateFeed,
  emptyWorkspace,
  validateWorkspace,
  ageDays,
  changeFor,
  distanceMiles,
  layoutEvidence,
  planLabel,
  homeCity,
  searchCenter,
} from "./model.js?v=20260907-suburbs";
const $ = (s) => document.querySelector(s),
  KEY = "spicyhome.workspace.v1",
  CACHE = "spicyhome.feed.v1";
// Public committed snapshots remain reachable even if a browser cannot load
// the optional deployment configuration. These URLs never call the provider.
const FALLBACK_FEED_CONFIG = {
  feed_url: "https://raw.githubusercontent.com/spicyChicken59/SpicyHome/main/dist/data.json",
  feed_mirror_url: "https://api.github.com/repos/spicyChicken59/SpicyHome/contents/dist/data.json?ref=main",
  fallback_url: "./data.json",
  status_url: "https://raw.githubusercontent.com/spicyChicken59/SpicyHome/main/dist/status.json",
};
let state = emptyWorkspace(),
  feed = null,
  config = null,
  lastAttempt = null,
  view = "discover",
  comparison = new Set(),
  map = null,
  markers = new Map(),
  refreshing = false,
  toastTimer,
  searchTimer,
  storedNotebook = null,
  unreadableNotebook = false;
try {
  storedNotebook = localStorage.getItem(KEY);
  if (storedNotebook) state = validateWorkspace(JSON.parse(storedNotebook));
} catch {
  unreadableNotebook = !!storedNotebook;
  setTimeout(() => {
    if (unreadableNotebook) notebookRecovery(true);
    else toast("Your saved notebook could not be loaded. Import a backup to restore it.");
  }, 0);
}
let prefs = { ...defaults, ...state.preferences };
const allHomes = () => {
  const homes = new Map(
    [...(feed?.homes ?? []), ...state.manual].map((h) => [h.id, h]),
  );
  for (const r of Object.values(state.records))
    if ((r.saved || ["studio", "other"].includes(r.layoutReview)) && r.snapshot && !homes.has(r.snapshot.id))
      homes.set(r.snapshot.id, { ...r.snapshot, notebook_only: true, seen_in_latest: false });
  return [...homes.values()];
};
const getHome = (id) => allHomes().find((h) => h.id === id);
const record = (id) => state.records[id] ?? {};
const dateLabel = (s) => {
  const d = new Date(s);
  return Number.isFinite(d.getTime())
    ? d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
      })
    : "Not dated";
};
function toast(message) {
  $("#toast").textContent = message;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ($("#toast").textContent = ""), 4500);
}
function notebookRecovery(unreadable = false) {
  let warning = $("#storage-warning");
  if (!warning) {
    warning = document.createElement("div");
    warning.id = "storage-warning";
    warning.className = "callout";
    warning.setAttribute("role", "alert");
    $("#workspace").before(warning);
  }
  warning.innerHTML = unreadable
    ? 'Your saved notebook could not be read. It has been protected from replacement. <button class="text-button" id="export-original">Download saved data</button> <button class="text-button" id="recover-import">Import a backup</button>'
    : 'The notebook changed in another tab. Changes in this tab have not overwritten it. <button class="text-button" id="export-unsaved">Export this tab</button> <button class="text-button" id="load-latest-notebook">Load saved notebook</button>';
  if (unreadable) {
    $("#export-original").onclick = () => download(storedNotebook, "spicyhome-recovery.json");
    $("#recover-import").onclick = () => $("#import-file").click();
  } else {
    $("#export-unsaved").onclick = exportNotebook;
    $("#load-latest-notebook").onclick = () => {
      try {
        const latest = localStorage.getItem(KEY);
        const restored = latest ? validateWorkspace(JSON.parse(latest)) : emptyWorkspace();
        if (!confirm("Load the saved notebook? This replaces this tab's unsaved changes. Export this tab first if you want to keep them.")) return;
        state = restored;
        prefs = { ...defaults, ...state.preferences };
        storedNotebook = latest;
        unreadableNotebook = false;
        document.querySelectorAll("dialog[open]").forEach((dialog) => dialog.close());
        warning.remove();
        render();
        toast("Loaded the saved notebook.");
      } catch { toast("The saved notebook could not be read. Export this tab before closing it."); }
    };
  }
}
function persist() {
  state.preferences = { ...prefs };
  try {
    if (unreadableNotebook || localStorage.getItem(KEY) !== storedNotebook) {
      notebookRecovery(unreadableNotebook);
      return false;
    }
    const serialized = JSON.stringify(validateWorkspace(state));
    localStorage.setItem(KEY, serialized);
    storedNotebook = serialized;
    $("#storage-warning")?.remove();
    return true;
  } catch {
    let warning = $("#storage-warning");
    if (!warning) {
      warning = document.createElement("div");
      warning.id = "storage-warning";
      warning.className = "callout";
      warning.setAttribute("role", "alert");
      $("#workspace").before(warning);
    }
    warning.innerHTML =
      'Changes are only in memory because browser storage is unavailable. Export a backup before closing. <button class="text-button" id="export-unsaved">Export now</button>';
    $("#export-unsaved").onclick = exportNotebook;
    return false;
  }
}
function saveNotice(success) {
  toast(
    success
      ? "Saved to this browser."
      : "Kept in memory only. Export a backup before closing.",
  );
}
function event(id, description) {
  state.events.unshift({
    at: new Date().toISOString(),
    id,
    title: getHome(id)?.title ?? "Notebook",
    description,
  });
  state.events = state.events.slice(0, 1000);
}
function link(url, label, classes = "") {
  const u = safeUrl(url);
  return u
    ? `<a class="${classes}" href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>`
    : "";
}
function chip(h, key, label) {
  const status = h[key]?.status ?? "unknown";
  return `<span class="chip ${status === "yes" ? "" : status === "no" ? "negative" : "unknown"}">${esc(label)} ${status === "yes" ? "advertised" : status === "no" ? "not offered" : "unverified"}</span>`;
}
function evidence(h) {
  return h.kind === "building"
    ? "Building research"
    : h.kind === "manual"
      ? "Your entry"
      : "Listing snapshot";
}
function displayPrice(h) {
  return (
    amount(record(h.id).rentOverride) ??
    amount(h.rent) ??
    amount(h.advertised_price)
  );
}
function priceKind(h) {
  if (amount(record(h.id).rentOverride) !== null) return "Your base-rent quote";
  if (h.kind === "manual" && amount(h.rent) !== null) return "Your entered base rent";
  if (h.rent !== null)
    return h.kind === "building"
      ? `Base rent from · ${h.floor_plan ?? "1-bedroom plan"}`
      : "Provider asking rent · verify the exact unit";
  if (h.advertised_price_type === "total_monthly")
    return "Advertised monthly total · base rent unverified";
  if (h.advertised_price !== null && h.advertised_price !== undefined)
    return "Advertised monthly price · fee basis unverified";
  return "Request a current 1-bedroom quote";
}
function priceChart(h) {
  const p = (h.history ?? []).filter((x) => amount(x.rent) !== null);
  if (p.length < 2)
    return '<p class="meta">One observation so far. A trend appears after a second dated quote; no history is invented.</p>';
  const values = p.map((x) => x.rent),
    lo = Math.min(...values),
    hi = Math.max(...values),
    spread = hi - lo || 1;
  const pts = p
    .map(
      (x, i) =>
        `${15 + (i / (p.length - 1)) * 470},${65 - ((x.rent - lo) / spread) * 45}`,
    )
    .join(" ");
  return `<svg viewBox="0 0 500 95" class="history-chart" role="img" aria-label="${esc(`Base rent from ${money(values[0])} on ${dateLabel(p[0].date)} to ${money(values.at(-1))} on ${dateLabel(p.at(-1).date)}`)}"><path d="M15 72H485" stroke="var(--line)"/><polyline points="${pts}" fill="none" stroke="var(--wine)" stroke-width="2.5"/><text x="15" y="90">${esc(dateLabel(p[0].date))}</text><text x="485" y="90" text-anchor="end">${esc(dateLabel(p.at(-1).date))}</text></svg>`;
}
function renderCard(h) {
  const r = record(h.id),
    layout = layoutEvidence(h, r),
    distance = distanceMiles(h, searchCenter),
    c = costs(h, r, prefs),
    delta = changeFor(h),
    saved = !!r.saved;
  return `<article class="home-card" data-home="${esc(h.id)}"><div class="card-top"><span class="neighborhood">${esc(h.neighborhood)}</span><button class="save-button" data-save="${esc(h.id)}" aria-label="${saved ? "Remove" : "Save"} ${esc(h.title)} ${saved ? "from" : "to"} shortlist" aria-pressed="${saved}">${saved ? "♥" : "♡"}</button></div><h3>${esc(h.title)}</h3><p class="address">${esc(h.address)}</p><p class="plan-label">${esc(planLabel(h))}</p><p class="meta">${esc(homeCity(h) || "City unverified")} · ${distance === null ? "Distance unverified" : distance.toFixed(1) + " mi from central Chicago"}</p><div class="rent-row"><strong class="rent">${money(displayPrice(h))}</strong>${displayPrice(h) !== null ? "<small>/ mo</small>" : ""}</div><p class="price-kind">${esc(priceKind(h))}</p><div class="specs"><span>${esc(layout.label)}</span><span>${h.sqft ? esc(h.sqft) + " sq ft" : "Size unverified"}</span></div><div class="cost-line"><span>Known monthly subtotal</span><strong>${c.rent === null ? "Incomplete" : money(c.known) + "+"}</strong></div><div class="chips">${chip(h, "parking", "Parking")}${chip(h, "charging", "EV")}</div><p class="card-evidence">${esc(h.atmosphere ?? (h.kind === "listing" ? "A source-reported listing. Verify its unit, price and amenity details." : "Your apartment research."))}</p>${delta !== null && delta !== 0 ? `<div class="price-change">${delta < 0 ? "↓" : "↑"} ${money(Math.abs(delta))} since previous observation</div>` : ""}${r.tourDate ? `<p class="tour-note">Tour: ${esc(r.tourDate.replace("T", " · "))}</p>` : ""}${h.notebook_only ? '<p class="price-change">Archived notebook entry · absent from the current feed</p>' : h.seen_in_latest === false ? '<p class="price-change">Not seen in this area’s last scan · availability unverified</p>' : ""}<div class="evidence-stamp">${evidence(h)} · ${esc(dateLabel(h.observed_at))}</div>${r.status ? `<p class="meta">${esc(r.status)}</p>` : ""}<div class="card-actions"><button class="button small secondary" data-detail="${esc(h.id)}">Details &amp; check layout</button><label class="compare-label"><input type="checkbox" data-compare="${esc(h.id)}" ${comparison.has(h.id) ? "checked" : ""}>Compare</label></div></article>`;
}
function empty(title, text, action = "") {
  return `<div class="empty"><h3>${esc(title)}</h3><p>${esc(text)}</p>${action}</div>`;
}
function render() {
  clearTimeout(searchTimer);
  if (!feed) return;
  const names = {
    discover: ["THE SEARCH", "Find your place."],
    shortlist: ["YOUR SAVED PLACES", "The ones worth a second look."],
    timeline: ["THE NOTEBOOK", "A search that remembers."],
    setup: ["CONNECTED RESEARCH", "Your sources. Your control."],
  };
  $("#view-eyebrow").textContent = names[view][0];
  $("#view-title").textContent = names[view][1];
  document.querySelectorAll("[data-view]").forEach((b) => {
    if (b.dataset.view === view) b.setAttribute("aria-current", "page");
    else b.removeAttribute("aria-current");
  });
  $("#saved-count").textContent = Object.values(state.records).filter(
    (r) => r.saved,
  ).length;
  if (map) {
    map.remove();
    map = null;
    markers.clear();
  }
  if (view === "discover") renderDiscover();
  if (view === "shortlist") renderShortlist();
  if (view === "timeline") renderActivity();
  if (view === "setup") renderSetup();
  bindContent();
}
function focusHomeControl(id, attribute) {
  const control = [...document.querySelectorAll(`[data-${attribute}]`)].find(
    (element) => element.getAttribute(`data-${attribute}`) === id,
  );
  const target = control ?? $("#view-title");
  control?.closest("details")?.setAttribute("open", "");
  if (!control) target.tabIndex = -1;
  target.focus();
}
function renderDiscover() {
  const neighborhoods = [
    ...new Set(allHomes().map((h) => h.neighborhood)),
  ].sort();
  $("#view-content").innerHTML =
    `<section class="area-controls" aria-label="Search area"><div class="area-selects"><div class="field"><label for="search-region">Where to look</label><select id="search-region"><option value="all" ${prefs.region === "all" ? "selected" : ""}>Chicago + selected suburbs</option><option value="chicago" ${prefs.region === "chicago" ? "selected" : ""}>Chicago only</option><option value="suburbs" ${prefs.region === "suburbs" ? "selected" : ""}>Suburbs only</option></select></div><div class="field"><label for="search-radius">Distance from central Chicago</label><select id="search-radius"><option value="0" ${prefs.radiusMiles === 0 ? "selected" : ""}>Full search · 35-mile coverage</option>${[10,20,35].map((m) => `<option value="${m}" ${prefs.radiusMiles === m ? "selected" : ""}>Within ${m} miles · located places only</option>`).join("")}</select></div></div><p class="meta">Distances are straight-line, not driving or commute times. The full search includes entries with unverified coordinates.</p><details class="area-guide"><summary>Areas &amp; last listing checks</summary><p class="meta">${esc(feed.search_area?.scan_note ?? "One city per scheduled scan. Each area keeps its own last observations.")}</p><div class="area-grid">${(feed.search_area?.areas ?? []).map((area) => {const scan = feed.provider?.area_scans?.[area.city]; const count = allHomes().filter((h) => homeCity(h) === area.city && !h.notebook_only); return `<article><h3>${esc(area.city)}</h3><p>${esc(area.note)}</p><p class="meta">${count.filter((h) => h.kind === "building").length} building prospects · ${count.filter((h) => h.kind === "listing").length} retained listing snapshots</p><p class="meta">${scan ? `Last listing scan: ${esc(dateLabel(scan.last_success))}${scan.truncated || scan.total == null && scan.returned === 500 ? " · capped coverage" : ""}` : "Awaiting first listing scan"}</p>${link(area.source_url,"Area & transport details ↗")}</article>`;}).join("")}</div></details></section><div class="layout-controls"><label for="layout-scope">Layout evidence</label><select id="layout-scope"><option value="all" ${prefs.layoutScope === "all" ? "selected" : ""}>All potential matches</option><option value="source" ${prefs.layoutScope === "source" ? "selected" : ""}>Source-listed plans + my checked layouts</option><option value="confirmed" ${prefs.layoutScope === "confirmed" ? "selected" : ""}>Only layouts I have checked</option></select><p id="layout-summary" class="meta" role="status"></p></div><form class="filters" id="filters"><div class="field"><label for="search">Building, plan or area</label><input type="search" id="search" name="search" maxlength="500" placeholder="Try Evanston, Oak Park or a plan name" value="${esc(prefs.search)}"></div><div class="field"><label for="min">Minimum / month</label><input type="number" id="min" name="min" min="0" max="20000" step="50" value="${prefs.min}"></div><div class="field"><label for="max">Maximum / month</label><input type="number" id="max" name="max" min="0" max="20000" step="50" value="${prefs.max}"></div><div class="field"><label for="basis">Compare budget against</label><select id="basis" name="basis"><option value="rent" ${prefs.basis === "rent" ? "selected" : ""}>Base rent</option><option value="total" ${prefs.basis === "total" ? "selected" : ""}>Known monthly subtotal</option></select></div><div class="field"><label for="neighborhood">Neighborhood / suburb</label><select id="neighborhood" name="neighborhood"><option value="all">All neighborhoods & suburbs</option>${neighborhoods.map((n) => `<option ${prefs.neighborhood === n ? "selected" : ""}>${esc(n)}</option>`).join("")}</select></div></form><div class="filter-options"><label><input type="checkbox" id="filter-parking" ${prefs.parking ? "checked" : ""}>Advertised parking only</label><label><input type="checkbox" id="filter-charging" ${prefs.charging ? "checked" : ""}>Advertised EV charging only</label><label><input type="checkbox" id="filter-unknown" ${prefs.unknown ? "checked" : ""}>Include unquoted base rent</label><button class="text-button" id="reset-filters">Reset</button><span class="meta">Target: a separate 1-bedroom · 1-bath apartment</span></div><p class="research-note" id="budget-note">${feed.mode === "research" ? "Start with sourced building prospects. These are research leads, not confirmed available apartments." : "Listing snapshots and sourced building prospects are shown together, each labeled by its source."} Budget is ${prefs.basis === "rent" ? "base rent; parking, utilities and other fees can take your monthly cost above it." : "a known subtotal; missing fees are never treated as free."}</p><div class="filter-summary" id="filter-summary" role="status" aria-live="polite" hidden></div><div class="results-layout"><aside class="map-panel" aria-label="Chicago and suburbs apartment map"><div class="map-heading"><h3>A neighborhood, not just a number.</h3></div><div class="map-surface" id="map" role="region" aria-label="Apartment locations"></div><ul class="map-list" id="map-list"></ul><div class="map-foot">Pins show approximate building locations. No pin means coordinates are unverified. Nearby public charging never proves resident charging access.</div></aside><div class="results-column"><div class="results-top"><strong id="result-count"></strong><label class="meta">Sort <select id="sort" aria-label="Sort apartments"><option value="rent" ${prefs.sort === "rent" ? "selected" : ""}>${prefs.basis === "rent" ? "Base rent" : "Known subtotal"}: low to high</option><option value="space" ${prefs.sort === "space" ? "selected" : ""}>More room</option><option value="recent" ${prefs.sort === "recent" ? "selected" : ""}>Recently observed</option></select></label></div><div class="home-grid" id="results"></div></div></div><details class="excluded-layouts" id="excluded-layouts"><summary id="excluded-summary"></summary><p class="meta">These places are outside your one-bedroom search. Open a record to review the source or correct your layout choice. Removing a heart does not erase a layout correction.</p><div class="home-grid" id="excluded-results"></div></details><div id="compare-tray"></div>`;
  renderResults();
  $("#filters").addEventListener("submit", (e) => e.preventDefault());
  $("#filters").addEventListener("change", updateFilters);
  $("#search").addEventListener("input", (e) => {
    prefs.search = e.target.value.slice(0, 500);
    e.target.value = prefs.search;
    persist();
    clearTimeout(searchTimer);
    searchTimer = setTimeout(updateFilters, 200);
  });
  ["parking", "charging", "unknown"].forEach((k) =>
    $("#filter-" + k).addEventListener("change", () => {
      prefs[k] = $("#filter-" + k).checked;
      persist();
      renderResults();
      bindCards();
    }),
  );
  $("#sort").addEventListener("change", () => {
    prefs.sort = $("#sort").value;
    persist();
    renderResults();
    bindCards();
  });
  $("#layout-scope").onchange = () => {
    prefs.layoutScope = $("#layout-scope").value;
    persist();
    renderResults();
    bindCards();
  };
  $("#search-region").onchange = () => {
    prefs.region = $("#search-region").value;
    prefs.neighborhood = "all";
    $("#neighborhood").value = "all";
    persist(); renderResults(); bindCards();
  };
  $("#search-radius").onchange = () => {
    prefs.radiusMiles = Number($("#search-radius").value);
    persist(); renderResults(); bindCards();
  };
  $("#reset-filters").onclick = resetSearchFilters;
}
function resetSearchFilters(keepLayout = false) {
  const layoutScope = keepLayout === true ? prefs.layoutScope : defaults.layoutScope;
  prefs = { ...defaults, utilityEstimate: prefs.utilityEstimate, layoutScope };
  persist();
  render();
  $("#reset-filters")?.focus();
}
function updateFilters() {
  if (view !== "discover" || !$("#filters")) return;
  const lo = Number($("#min").value),
    hi = Number($("#max").value);
  if (
    !Number.isFinite(lo) ||
    !Number.isFinite(hi) ||
    lo < 0 ||
    hi < lo ||
    hi > 20000
  ) {
    toast("Enter a valid monthly range with the maximum at least the minimum.");
    return;
  }
  prefs = {
    ...prefs,
    min: lo,
    max: hi,
    basis: $("#basis").value,
    neighborhood: $("#neighborhood").value,
    search: $("#search").value.slice(0, 500),
  };
  persist();
  renderResults();
  bindCards();
}
function renderResults() {
  const loaded = allHomes(),
    homes = visibleHomes(loaded.filter((h) => !h.notebook_only), state, prefs),
    checked = loaded.filter((h) => !h.notebook_only && layoutEvidence(h, record(h.id)).status === "confirmed").length,
    excluded = loaded.filter((h) => !layoutEvidence(h, record(h.id)).matches),
    listings = loaded.filter((h) => h.kind === "listing" && !h.notebook_only && layoutEvidence(h, record(h.id)).matches).length,
    shownListings = homes.filter((h) => h.kind === "listing").length,
    hiddenListings = listings - shownListings;
  $("#sort option[value=rent]").textContent = `${prefs.basis === "rent" ? "Base rent" : "Known subtotal"}: low to high`;
  $("#budget-note").textContent = `${feed.mode === "research" ? "Start with sourced building prospects. These are research leads, not confirmed available apartments." : "Listing snapshots and sourced building prospects are shown together, each labeled by its source."} Budget is ${prefs.basis === "rent" ? "base rent; parking, utilities and other fees can take your monthly cost above it." : "a known subtotal; missing fees are never treated as free."}`;
  $("#result-count").textContent =
    `${homes.length} of ${loaded.length} loaded places · ${homes.filter((h) => layoutEvidence(h, record(h.id)).status === "confirmed").length} layouts checked by you`;
  const statuses = homes.map((h) => layoutEvidence(h, record(h.id)).status);
  $("#layout-summary").textContent = `${statuses.filter((s) => s === "source_listed").length} source-listed plans · ${statuses.filter((s) => ["provider_reported", "unverified"].includes(s)).length} layouts need checking · ${excluded.length} excluded for studio, different or conflicting layout. A listed bedroom count does not confirm a separate enclosed bedroom.`;
  const summary = $("#filter-summary");
  summary.hidden = hiddenListings === 0;
  summary.innerHTML = hiddenListings
    ? `<div><strong>${listings} listing snapshots loaded · ${hiddenListings} hidden by your filters.</strong><p>${prefs.parking || prefs.charging ? "Parking and EV filters require advertised amenities; unverified amenities are excluded. " : ""}${prefs.neighborhood !== "all" ? "Listings without a supplied neighborhood are excluded from a named-neighborhood search. " : ""}Search filters are saved separately in each browser. Resetting them keeps your saved homes, notes and quotes.</p></div><button class="button secondary" id="show-unfiltered">Reset search filters</button>`
    : "";
  if (hiddenListings) $("#show-unfiltered").onclick = resetSearchFilters;
  $("#results").innerHTML = homes.length
    ? homes.map(renderCard).join("")
    : prefs.layoutScope === "confirmed" && !checked
      ? empty("No layouts checked yet.", "Open a potential match and check its exact floor plan, then record a separate one-bedroom and one-bathroom layout.", '<button class="button secondary" id="browse-layouts">Browse potential matches</button>')
      : empty("No places match these filters.", prefs.layoutScope === "confirmed" ? `${checked} checked layout${checked === 1 ? " is" : "s are"} hidden by your other filters.` : "Try clearing your search, neighborhood or amenity filters.", '<button class="button secondary" id="reset-other-filters">Reset other filters</button>');
  if ($("#browse-layouts")) $("#browse-layouts").onclick = () => resetSearchFilters();
  if ($("#reset-other-filters")) $("#reset-other-filters").onclick = () => resetSearchFilters(true);
  $("#excluded-layouts").hidden = !excluded.length;
  $("#excluded-summary").textContent = `Review excluded layouts (${excluded.length})`;
  $("#excluded-results").innerHTML = excluded.map(renderCard).join("");
  $("#map-list").innerHTML = homes
    .map(
      (h, i) =>
        `<li><button data-map-home="${esc(h.id)}"><span class="map-index">${i + 1}</span>${esc(h.title)}</button></li>`,
    )
    .join("");
  renderMap(homes);
  renderTray();
}
function renderMap(homes) {
  if (map) {
    map.remove();
    map = null;
    markers.clear();
  }
  if (!window.L) {
    $("#map-list")
      .querySelectorAll("[data-map-home]")
      .forEach((b) => (b.onclick = () => showDetail(b.dataset.mapHome)));
    $("#map").innerHTML =
      '<p class="map-unavailable">The map could not load. Every apartment remains available in the list, with its address and directions link.</p>';
    return;
  }
  const L = window.L;
  map = L.map("map", { scrollWheelZoom: false, zoomControl: true }).setView(
    [41.882, -87.632],
    13,
  );
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
    attribution:
      '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(map);
  const placed = homes.filter(
    (h) => Number.isFinite(h.lat) && Number.isFinite(h.lng),
  );
  for (const h of placed) {
    const marker = L.marker([h.lat, h.lng], {
      icon: L.divIcon({
        className: "",
        html: `<div class="map-price">${esc(money(displayPrice(h)))}</div>`,
        iconSize: null,
      }),
      title: h.title,
      keyboard: true,
    }).addTo(map);
    marker.bindPopup(
      `<strong>${esc(h.title)}</strong><br>${esc(h.address)}<br>${esc(priceKind(h))}: ${money(displayPrice(h))}`,
    );
    marker.on("click", () => {
      document
        .querySelector(`[data-home="${CSS.escape(h.id)}"]`)
        ?.scrollIntoView({
          behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
            ? "auto"
            : "smooth",
          block: "nearest",
        });
    });
    markers.set(h.id, marker);
  }
  if (placed.length)
    map.fitBounds(
      placed.map((h) => [h.lat, h.lng]),
      { padding: [45, 35], maxZoom: 14 },
    );
  for (const s of feed.charging_stations ?? []) {
    if (Number.isFinite(s.lat) && Number.isFinite(s.lng))
      L.circleMarker([s.lat, s.lng], {
        radius: 4,
        color: "#165194",
        fillOpacity: 0.75,
      })
        .addTo(map)
        .bindPopup(
          `${esc(s.title)}<br>Public charging · not a building amenity<br>Observed ${esc(dateLabel(feed.city_context?.afdc?.updated_at))}`,
        );
  }
  $("#map-list")
    .querySelectorAll("[data-map-home]")
    .forEach(
      (b) =>
        (b.onclick = () => {
          const marker = markers.get(b.dataset.mapHome);
          if (marker) {
            map.setView(marker.getLatLng(), 15, {
              animate: !matchMedia("(prefers-reduced-motion: reduce)").matches,
            });
            marker.openPopup();
          } else showDetail(b.dataset.mapHome);
        }),
    );
}
function renderShortlist() {
  const saved = allHomes().filter((h) => record(h.id).saved);
  $("#view-content").innerHTML =
    `<div class="research-note">Your statuses, quotes and notes stay in this browser. Export a backup to move them to another device. <button class="text-button" id="export-notebook">Export notebook</button></div>${saved.length ? `<div class="home-grid">${saved.map(renderCard).join("")}</div>` : empty("Your shortlist starts with a feeling.", "Save a place with the heart, then collect quotes and tour notes as your search develops.", '<button class="button" data-go="discover">Explore apartments</button>')}<div id="compare-tray"></div>`;
  renderTray();
  $("#export-notebook").onclick = exportNotebook;
}
function renderActivity() {
  const events = [...state.events, ...(feed.events ?? [])].sort((a, b) =>
    String(b.at).localeCompare(String(a.at)),
  );
  $("#view-content").innerHTML =
    `<p class="research-note">Price changes come from observed snapshots. A listing no longer seen is not proof it has been rented.</p><div class="panel">${
      events.length
        ? events
            .slice(0, 200)
            .map(
              (e) =>
                `<div class="activity-row"><time>${esc(dateLabel(e.at))}</time><div><strong>${esc(e.title)}</strong><p>${esc(e.description)}</p></div></div>`,
            )
            .join("")
        : empty(
            "The beginning of your search.",
            "Save a home, record a quote or schedule a tour. Future source updates and your decisions will appear here.",
          )
    }</div>`;
}
function renderSetup() {
  const provider = feed.provider ?? {};
  $("#view-content").innerHTML =
    `<div class="setup-grid"><div><section class="panel"><div class="setup-status"><strong>Rotating city listing feed</strong><span class="status-tag">${provider.configured ? "CONNECTED" : "KEY NEEDED"}</span></div><h3>Eight areas. Dated observations.</h3><p>Chicago, Evanston, Oak Park, Park Ridge, Elmhurst, Downers Grove, Arlington Heights and Naperville rotate one city at a time. Expect roughly 8–10 days per cycle; failed scans can take longer. Check the area guide in Discover for each city’s date.</p><p>${esc(provider.coverage ?? "No automated scan has run yet.")}</p><p>Latest successful listing scan: <strong>${provider.last_success ? esc(dateLabel(provider.last_success)) : "Not run"}</strong>. Source status: ${esc(lastAttempt?.status ?? provider.status ?? "awaiting_key")}. ${lastAttempt?.status === "failed" ? esc(lastAttempt.message) : ""}</p><ol><li>Create a RentCast API key and review the plan’s usage charges.</li><li>Add <code>RENTCAST_API_KEY</code> as a GitHub Actions repository secret.</li><li>Set repository variable <code>SPICYHOME_TRACKING_ENABLED</code> to <code>true</code>, then run <strong>Track apartments</strong>.</li><li>For GitHub Pages, choose <strong>GitHub Actions</strong> as the Pages source, set repository variable <code>SPICYHOME_PAGES_ENABLED</code> to <code>true</code>, and run <strong>Publish website</strong> from <code>main</code>.</li></ol><p>The included default requests one page per day, at most 30 attempts in any rolling 32-day window. Other uses of your key also consume quota. RentCast has automatic overage billing; review usage before enabling.</p>${link("https://github.com/spicyChicken59/SpicyHome/blob/main/SETUP.md", "Open the full setup guide ↗", "button secondary")}</section><section class="panel"><h3>Your notebook travels with you.</h3><p>Shortlists, tour notes, quotes and manually added apartments stay on this device. A downloaded backup carries them to another browser. They are never sent to listing providers or written to the public feed.</p><div class="actions"><button class="button secondary" id="export-notebook">Export backup</button><button class="button secondary" id="import-notebook">Import backup</button></div><p class="meta">An import merges homes and notes by ID; incoming records replace matching records after confirmation.</p></section><section class="panel"><h3>Comfort is personal.</h3><p>At a tour, check natural light, noise with windows closed, storage, airflow, water pressure, and whether the living room fits your furniture. Record your own impression in the apartment notes.</p></section></div><div><section class="panel"><h3>What counts as evidence?</h3><ul><li><strong>Building research:</strong> a dated official-site claim, often a starting floor-plan price.</li><li><strong>Listing snapshot:</strong> a provider-reported apartment listing. Verify current availability directly.</li><li><strong>Advertised parking or EV:</strong> the amenity is listed; an available space or working compatible charger is not guaranteed.</li><li><strong>Unknown:</strong> the source did not establish the fact. It is never silently treated as free or available.</li></ul><p>Research date: ${esc(dateLabel(feed.generated_at))}. A record over 7 days old needs a fresh quote.</p></section><section class="panel"><h3>Before you call a place home.</h3><ul><li>Base rent versus concession-adjusted rent; lease length and move-in date.</li><li>Parking space availability, monthly fee and garage clearance.</li><li>EV connector, power, fees, reservation rules and waitlist.</li><li>Step-free street and garage routes, working elevators and door widths if needed.</li><li>Utilities, recurring fees, deposits and move-in charges.</li></ul></section><section class="panel"><h3>Optional city context</h3><p>The infrastructure also supports public charging locations through NLR’s Alternative Fuel Stations API and CTA station locations from the official Chicago Data Portal station feed. Public chargers are shown separately from resident amenities.</p><p>Add <code>AFDC_API_KEY</code> for charger updates. The <strong>Update city context</strong> workflow also requires <code>SPICYHOME_TRACKING_ENABLED=true</code>. CTA data needs no key. Both are optional; the apartment search works without them.</p><p>CTA locations: ${feed.transit_stops?.length ?? 0}, observed ${esc(dateLabel(feed.city_context?.cta?.updated_at))}. Public charging: ${feed.charging_stations?.length ?? 0}, observed ${esc(dateLabel(feed.city_context?.afdc?.updated_at))}. ${esc(feed.city_context?.afdc_status ?? "Not connected")}${feed.city_context?.errors?.length ? " · Last context update had a source failure; prior observations were retained." : ""}</p>${link("https://github.com/spicyChicken59/SpicyHome/blob/main/API-SOURCES.md", "Data sources and limitations ↗")}</section></div></div>`;
  $("#export-notebook").onclick = exportNotebook;
  $("#import-notebook").onclick = () => $("#import-file").click();
}
function renderTray() {
  const el = $("#compare-tray");
  if (!el) return;
  el.className = comparison.size ? "compare-tray" : "";
  el.innerHTML = comparison.size
    ? `<span>${comparison.size} of 3 places selected</span><button class="button small" id="open-compare">Compare side by side</button><button class="icon-button" id="clear-compare" aria-label="Clear comparison">×</button>`
    : "";
  if (comparison.size) {
    $("#open-compare").onclick = showCompare;
    $("#clear-compare").onclick = () => {
      comparison.clear();
      render();
    };
  }
}
function bindContent() {
  bindCards();
  document.querySelectorAll("[data-go]").forEach(
    (b) =>
      (b.onclick = () => {
        view = b.dataset.go;
        render();
      }),
  );
}
function bindCards() {
  document.querySelectorAll("[data-save]").forEach(
    (b) =>
      (b.onclick = () => {
        const id = b.dataset.save,
          r = record(id),
          saved = !r.saved;
        state.records[id] = {
          ...r,
          saved,
          snapshot: getHome(id),
          status: r.status ?? "shortlisted",
        };
        event(id, saved ? "Added to shortlist." : "Removed from shortlist.");
        const ok = persist();
        render();
        focusHomeControl(id, "save");
        saveNotice(ok);
      }),
  );
  document
    .querySelectorAll("[data-detail]")
    .forEach((b) => (b.onclick = () => showDetail(b.dataset.detail)));
  document.querySelectorAll("[data-compare]").forEach(
    (b) =>
      (b.onchange = () => {
        if (b.checked) {
          if (comparison.size === 3) {
            b.checked = false;
            toast("Compare up to three places at a time.");
            return;
          }
          comparison.add(b.dataset.compare);
        } else comparison.delete(b.dataset.compare);
        renderTray();
      }),
  );
}
function showDetail(id) {
  const h = getHome(id);
  if (!h) return;
  const focusAttribute = document.activeElement?.hasAttribute("data-map-home")
    ? "map-home"
    : "detail";
  const r = record(id),
    c = costs(h, r, prefs);
  const stations = (feed.transit_stops ?? [])
    .map((s) => ({ ...s, distance: distanceMiles(h, s) }))
    .filter((s) => s.distance !== null)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 2);
  $("#detail-content").innerHTML =
    `<div class="dialog-body"><div class="dialog-header"><div><p class="eyebrow">${esc(h.neighborhood)} / ${evidence(h)}</p><h2 id="detail-title">${esc(h.title)}</h2></div><button class="dialog-close" data-close aria-label="Close apartment details">×</button></div><p class="detail-sub">${esc(h.address)} · ${esc(layoutEvidence(h, r).label)} · ${esc(planLabel(h))}${h.sqft ? " · " + esc(h.sqft) + " sq ft" : ""}</p><div class="detail-links">${link(h.source_url, h.kind === "manual" ? "Your source ↗" : "Official source ↗", "button secondary")}${link("https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(h.address), "Map & directions ↗", "button secondary")}${h.kind === "listing" ? link("https://www.google.com/search?q=" + encodeURIComponent(h.address + " apartment for rent"), "Find the listing ↗", "button secondary") : ""}</div><div class="callout">${h.kind === "building" ? "This is a researched building prospect, not a guaranteed available unit. " : ""}${h.seen_in_latest === false ? "Not in this area’s latest capped snapshot; current availability is unverified. " : ""}${esc(h.availability_note ?? "Confirm the current unit and move-in date with the listing source.")} Observed ${esc(dateLabel(h.observed_at))}${ageDays(h.observed_at) > 7 ? " — this quote needs refreshing." : "."}</div><section class="layout-review"><h3>Check the layout</h3><p class="meta">${esc(h.layout_note ?? "The source has not supplied a floor plan confirming a separate bedroom.")}</p><div class="field full"><label for="layoutReview">What did you find when checking the floor plan?</label><select id="layoutReview" name="layoutReview" form="record-form" aria-describedby="layout-help"><option value="unverified" ${!r.layoutReview || r.layoutReview === "unverified" ? "selected" : ""}>Not checked yet</option><option value="one_bed" ${r.layoutReview === "one_bed" ? "selected" : ""}>I checked: separate 1 bedroom and 1 bathroom</option><option value="studio" ${r.layoutReview === "studio" ? "selected" : ""}>Studio / convertible — hide from search</option><option value="other" ${r.layoutReview === "other" ? "selected" : ""}>Different layout — hide from search</option></select><p class="meta" id="layout-help">Compare the exact unit or named plan with the source. Your correction stays in this browser and survives feed refreshes; saved notes remain in your shortlist.</p></div><button class="button small" type="submit" form="record-form">Save changes</button></section><div class="detail-grid"><section class="detail-section"><h3>The monthly picture</h3><table class="cost-table"><tr><td>Base rent</td><td>${money(c.rent)}</td></tr><tr><td>Parking</td><td>${money(c.parking)}</td></tr><tr><td>Recurring fees</td><td>${money(c.fees)}</td></tr><tr><td>Your utility estimate</td><td>${c.utilities !== null ? money(c.utilities) : "Not entered"}</td></tr><tr><td>Known subtotal</td><td>${c.rent === null ? "Incomplete" : money(c.known)}</td></tr></table><p class="range-note">${c.unknown.length ? "Still unquoted: " + esc(c.unknown.join(", ")) + ". This is not an all-in total." : "All entered monthly items included. Confirm the quote’s completeness with leasing."}</p><p class="meta">One-time nonrefundable fees: ${money(c.upfront)}. Refundable deposits are separate; record them in your notes.</p></section><section class="detail-section"><h3>Parking, charging & access</h3><ul class="fact-list"><li>${esc(h.parking?.note ?? "Parking terms unverified.")}</li><li>${esc(h.charging?.note ?? "EV charging unverified.")}</li><li>${esc(h.access?.note ?? "Step-free access unverified.")}</li><li>Confirm space availability, charger compatibility and fees for your lease.</li><li>Distances below cover the loaded CTA station reference only. See the area guide for suburban Metra options; station proximity is not a commute estimate.</li>${stations.map((s) => `<li>${esc(s.title)}: ${s.distance.toFixed(2)} mi straight-line. This is not a walking route or accessibility rating.</li>`).join("")}</ul></section></div><section class="detail-section"><h3>The feel of the place</h3><p class="detail-sub">${esc(h.atmosphere ?? "Add your own impression after a visit.")}</p><div class="chips">${(h.amenities ?? []).map((a) => `<span class="chip">${esc(a)}</span>`).join("")}</div></section><section class="detail-section"><h3>Observed base rent</h3>${priceChart(h)}${r.quote_history?.length ? "<h3>Your recorded quotes</h3>" + priceChart({ history: r.quote_history }) : ""}</section><section class="detail-section"><h3>Your quotes & tour notebook</h3><form id="record-form" data-id="${esc(id)}"><div class="form-grid"><div class="field"><label for="status">Where you are</label><select id="status" name="status">${statuses.map((s) => `<option ${r.status === s ? "selected" : ""}>${s}</option>`).join("")}</select></div><div class="field"><label for="tourDate">Tour date & local time</label><input id="tourDate" name="tourDate" type="datetime-local" value="${esc(r.tourDate ?? "")}"></div>${[
      ["rentOverride", "Quoted base rent"],
      ["parkingCost", "Parking / month"],
      ["monthlyFees", "Other recurring fees / month"],
      ["utilities", "Utilities / month (estimate)"],
      ["oneTimeFees", "Nonrefundable one-time fees"],
    ]
      .map(
        ([k, label]) =>
          `<div class="field"><label for="${k}">${label}</label><input type="number" id="${k}" name="${k}" min="0" max="100000" step="0.01" placeholder="Unquoted" value="${r[k] ?? ""}"></div>`,
      )
      .join(
        "",
      )}<div class="field"><label for="quoteDate">Quote date</label><input id="quoteDate" name="quoteDate" type="date" value="${esc(r.quoteDate ?? "")}"></div><div class="field full"><label for="notes">The details that matter to you</label><textarea id="notes" name="notes" maxlength="20000" placeholder="Light, noise, storage, lease terms, parking quote, connector type, tour questions…">${esc(r.notes ?? "")}</textarea></div></div><div class="form-actions"><button class="button" type="submit">Save changes</button>${r.tourDate ? '<button class="button secondary" id="download-tour" type="button">Save tour to calendar</button>' : ""}</div><p class="meta">Saved on this device. No message is sent to the building.</p></form></section><section class="detail-section"><h3>Sources behind this record</h3>${(h.sources ?? [{ url: h.source_url, supports: "Your source link" }]).map((s) => `<p class="sourceline">${link(s.url, s.url)}<br>${esc(s.supports ?? "")}</p>`).join("")}</section></div>`;
  $("#detail-dialog").showModal();
  $("#detail-content [data-close]").onclick = () => $("#detail-dialog").close();
  $("#record-form").onsubmit = (e) => {
    e.preventDefault();
    const f = new FormData(e.target),
      next = {
        ...r,
        saved: true,
        status: f.get("status"),
        tourDate: f.get("tourDate"),
        quoteDate: f.get("quoteDate"),
        notes: f.get("notes"),
        layoutReview: f.get("layoutReview"),
      };
    for (const k of [
      "rentOverride",
      "parkingCost",
      "monthlyFees",
      "utilities",
      "oneTimeFees",
    ]) {
      const v = f.get(k);
      next[k] = v === "" ? null : Number(v);
    }
    next.snapshot = h;
    if (next.rentOverride !== null && next.rentOverride !== r.rentOverride) {
      next.quote_history = [
        ...(r.quote_history ?? []),
        {
          date: next.quoteDate || new Date().toISOString().slice(0, 10),
          rent: next.rentOverride,
        },
      ].slice(-120);
    }
    state.records[id] = next;
    event(id, "Updated notes and quotes · " + next.status + ".");
    const ok = persist();
    $("#detail-dialog").close();
    render();
    focusHomeControl(id, focusAttribute);
    saveNotice(ok);
  };
  if ($("#download-tour"))
    $("#download-tour").onclick = () => downloadTour(h, r);
}
function showCompare() {
  const hs = [...comparison].map(getHome).filter(Boolean);
  if (!hs.length) return;
  const rows = [
    ["Layout evidence", (h) => layoutEvidence(h, record(h.id)).label],
    ["Plan / unit", planLabel],
    ["City / suburb", (h) => homeCity(h) || "Unverified"],
    ["Neighborhood", (h) => h.neighborhood],
    ["Distance from central Chicago", (h) => {const d=distanceMiles(h,searchCenter);return d === null ? "Unverified" : `${d.toFixed(1)} mi straight-line`; }],
    ["Base rent", (h) => money(costs(h, record(h.id), prefs).rent)],
    [
      "Known monthly subtotal",
      (h) => {
        const c = costs(h, record(h.id), prefs);
        return c.rent === null
          ? "Incomplete"
          : money(c.known) + (c.unknown.length ? " + unquoted items" : "");
      },
    ],
    ["Parking / month", (h) => money(costs(h, record(h.id), prefs).parking)],
    [
      "EV charging",
      (h) =>
        h.charging?.status === "yes"
          ? "Advertised; access unverified"
          : h.charging?.status === "no"
            ? "Not offered"
            : "Unverified",
    ],
    ["Space", (h) => (h.sqft ? `${h.sqft} sq ft` : "Unverified")],
    [
      "Step-free access",
      (h) =>
        h.access?.status === "yes"
          ? "Source-reported"
          : h.access?.status === "no"
            ? "Not offered"
            : "Unverified",
    ],
    ["Observed", (h) => dateLabel(h.observed_at)],
    ["Your status", (h) => record(h.id).status ?? "Researching"],
    ["Your notes", (h) => record(h.id).notes || "No notes yet"],
  ];
  $("#compare-content").innerHTML =
    `<div class="dialog-body"><div class="dialog-header"><div><p class="eyebrow">THE SIDE-BY-SIDE</p><h2 id="compare-title">Picture your everyday.</h2></div><button class="dialog-close" data-close aria-label="Close comparison">×</button></div><p class="detail-sub">The same facts for every place. Unknowns stay visible.</p><div class="matrix-wrap"><table class="matrix"><thead><tr><th scope="col">Your priorities</th>${hs.map((h) => `<th scope="col">${esc(h.title)}</th>`).join("")}</tr></thead><tbody>${rows.map(([label, fn]) => `<tr><th scope="row">${label}</th>${hs.map((h) => `<td>${esc(fn(h))}</td>`).join("")}</tr>`).join("")}</tbody></table></div><div class="form-actions"><button class="button secondary" id="print-comparison">Print comparison</button></div></div>`;
  $("#compare-dialog").showModal();
  $("#compare-content [data-close]").onclick = () =>
    $("#compare-dialog").close();
  $("#print-comparison").onclick = () => window.print();
}
function addHome() {
  const fields = [
    ["title", "Building or apartment name", "text", true],
    ["address", "Street address", "text", true],
    ["neighborhood", "Neighborhood", "text", true],
    ["city", "City / suburb (if known)", "text", false],
    ["rent", "Quoted base rent / month", "number", false],
    ["sqft", "Square feet", "number", false],
    ["source_url", "Listing or official source URL", "url", false],
  ];
  $("#add-content").innerHTML =
    `<div class="dialog-body"><div class="dialog-header"><div><p class="eyebrow">A PLACE YOU FOUND</p><h2 id="apartment-add-title">Add to your search.</h2></div><button class="dialog-close" data-close aria-label="Close add apartment">×</button></div><p class="detail-sub">Add a place and record the layout you actually know. Leave unknown details blank. It stays in your private browser notebook.</p><form id="add-form"><div class="form-grid">${fields.map(([name, label, type, required]) => `<div class="field ${type === "url" ? "full" : ""}"><label for="add-${name}">${label}</label><input name="${name}" id="add-${name}" type="${type}" ${required ? "required" : ""} ${type === "number" ? 'min="0" max="100000" step="0.01"' : 'maxlength="500"'}></div>`).join("")}<div class="field"><label for="add-bedrooms">Bedrooms</label><select id="add-bedrooms" name="bedrooms"><option value="">Not verified</option><option value="0">Studio / no separate bedroom</option><option value="1">1 bedroom reported</option><option value="2">2 bedrooms</option></select></div><div class="field"><label for="add-bathrooms">Bathrooms</label><select id="add-bathrooms" name="bathrooms"><option value="">Not verified</option><option value="1">1 bathroom</option><option value="1.5">1.5 bathrooms</option><option value="2">2 bathrooms</option></select></div><div class="field"><label for="add-parking">Parking advertised?</label><select id="add-parking" name="parking"><option value="unknown">Unverified</option><option value="yes">Yes</option><option value="no">No</option></select></div><div class="field"><label for="add-charging">EV charging advertised?</label><select id="add-charging" name="charging"><option value="unknown">Unverified</option><option value="yes">Yes</option><option value="no">No</option></select></div></div><div class="form-actions"><button class="button" type="submit">Add apartment</button></div></form></div>`;
  $("#add-dialog").showModal();
  $("#add-content [data-close]").onclick = () => $("#add-dialog").close();
  $("#add-form").onsubmit = (e) => {
    e.preventDefault();
    const f = new FormData(e.target),
      now = new Date().toISOString(),
      h = {
        id: "manual-" + crypto.randomUUID(),
        kind: "manual",
        title: String(f.get("title")).trim(),
        address: String(f.get("address")).trim(),
        neighborhood: String(f.get("neighborhood")).trim(),
        city: String(f.get("city") ?? "").trim(),
        bedrooms: f.get("bedrooms") === "" ? null : Number(f.get("bedrooms")),
        bathrooms: f.get("bathrooms") === "" ? null : Number(f.get("bathrooms")),
        layout_status: "unverified",
        rent: f.get("rent") === "" ? null : Number(f.get("rent")),
        sqft: f.get("sqft") === "" ? null : Number(f.get("sqft")),
        source_url: safeUrl(f.get("source_url")),
        observed_at: now,
        lat: null,
        lng: null,
        parking: {
          status: f.get("parking"),
          monthly: null,
          note: "Recorded by you. Confirm parking terms and space availability.",
        },
        charging: {
          status: f.get("charging"),
          note: "Recorded by you. Confirm compatibility, access and cost.",
        },
        fees: { monthly: null, one_time: null },
        amenities: [],
        history: [],
      };
    if (!h.title || !h.address || !h.neighborhood) {
      toast("Enter a name, address and neighborhood.");
      return;
    }
    if (h.rent !== null) h.history = [{ date: now, rent: h.rent }];
    state.manual.push(h);
    state.records[h.id] = { saved: true, status: "researching" };
    event(h.id, "Added an apartment from your own research.");
    const ok = persist();
    $("#add-dialog").close();
    view = "shortlist";
    render();
    saveNotice(ok);
  };
}
function download(content, name, type = "application/json") {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function exportNotebook() {
  download(
    JSON.stringify(state, null, 2),
    "spicyhome-notebook-" + new Date().toISOString().slice(0, 10) + ".json",
  );
  toast("Backup downloaded. Keep it somewhere you can find it.");
}
function downloadTour(h, r) {
  const clean = (s) =>
    String(s ?? "")
      .replace(/\\/g, "\\\\")
      .replace(/\n/g, "\\n")
      .replace(/,/g, "\\,")
      .replace(/;/g, "\\;")
      .replace(/\r/g, "");
  const start = r.tourDate.replace(/[-:]/g, "") + "00";
  download(
    [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//SpicyHome//Tour notebook//EN",
      "BEGIN:VEVENT",
      "UID:" + crypto.randomUUID() + "@spicyhome",
      "DTSTAMP:" +
        new Date()
          .toISOString()
          .replace(/[-:]/g, "")
          .replace(/\.\d{3}/, ""),
      "DTSTART;TZID=America/Chicago:" + start,
      "DURATION:PT1H",
      "SUMMARY:" + clean("Apartment tour: " + h.title),
      "LOCATION:" + clean(h.address),
      "DESCRIPTION:" +
        clean(
          "Personal tour reminder. Confirm appointment with leasing. " +
            (r.notes ?? ""),
        ),
      "END:VEVENT",
      "END:VCALENDAR",
      "",
    ].join("\r\n"),
    "spicyhome-tour.ics",
    "text/calendar",
  );
}
$("#import-file").onchange = async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    if (file.size > 5_000_000) throw Error("Backup exceeds the 5 MB limit.");
    const incoming = validateWorkspace(JSON.parse(await file.text()));
    if (
      !confirm(
        "Import this notebook? Incoming notes replace notes for matching apartments. Export your current notebook first if you need a backup.",
      )
    )
      return;
    const byId = new Map(
      [...state.manual, ...incoming.manual].map((h) => [h.id, h]),
    );
    const merged = validateWorkspace({
      ...state,
      records: { ...state.records, ...incoming.records },
      manual: [...byId.values()],
      events: [...incoming.events, ...state.events]
        .sort((a, b) => String(b.at).localeCompare(String(a.at)))
        .slice(0, 1000),
    });
    state = merged;
    if (unreadableNotebook) unreadableNotebook = false;
    const ok = persist();
    render();
    saveNotice(ok);
  } catch (err) {
    toast(err.message ?? "Could not import that file.");
  } finally {
    e.target.value = "";
  }
};
async function fetchJSON(url, { fresh = false, raw = false } = {}) {
  const ctrl = new AbortController(),
    timer = setTimeout(() => ctrl.abort(), 12000);
  try {
    const target = fresh
      ? url + (url.includes("?") ? "&" : "?") + "_spicyhome=" + Date.now()
      : url;
    const r = await fetch(target, {
      cache: "no-store",
      signal: ctrl.signal,
      ...(raw ? { headers: { Accept: "application/vnd.github.raw+json" } } : {}),
    });
    if (!r.ok) throw Error("Source returned " + r.status);
    const text = await r.text();
    if (text.length > 8_000_000) throw Error("Snapshot too large");
    return JSON.parse(text);
  } finally {
    clearTimeout(timer);
  }
}
async function loadFeed(manual = false) {
  if (refreshing) return;
  refreshing = true;
  $("#refresh").setAttribute("aria-disabled", "true");
  $("#refresh").textContent = "Checking…";
  try {
    if (!config || manual) {
      try {
        const candidate = await fetchJSON("./config.json", { fresh: true });
        if (!candidate || typeof candidate !== "object" || Array.isArray(candidate))
          throw Error("Invalid feed configuration");
        for (const key of ["feed_url", "fallback_url", "feed_mirror_url", "status_url"]) {
          if (candidate[key] == null && ["feed_mirror_url", "status_url"].includes(key)) continue;
          if (typeof candidate[key] !== "string" || !candidate[key].trim() ||
              !["http:", "https:"].includes(new URL(candidate[key], location.href).protocol))
            throw Error("Invalid feed configuration");
        }
        config = candidate;
      } catch (err) {
        // Configuration is not a prerequisite for recovering the complete
        // public feed or the snapshot included with this deployment.
        if (!config) config = { ...FALLBACK_FEED_CONFIG };
      }
    }
    let next, remoteError, packaged;
    try {
      next = validateFeed(await fetchJSON(config.feed_url, { fresh: true }));
    } catch (err) {
      remoteError = err;
    }
    let cached;
    try {
      cached = validateFeed(JSON.parse(localStorage.getItem(CACHE)));
    } catch {}
    try {
      packaged = validateFeed(await fetchJSON(config.fallback_url, { fresh: true }));
    } catch {
      // A missing bundle must not discard a valid remote response, and the
      // independent mirror still gets its chance when nothing loaded yet.
    }
    let received = next;
    const timestamp = (snapshot) =>
      Date.parse(snapshot?.provider?.last_success ?? snapshot?.generated_at) || 0;
    const prefer = (candidate, current) =>
      !current ||
      (candidate.provider?.configured && !current.provider?.configured) ||
      (!!candidate.provider?.configured === !!current.provider?.configured &&
        (timestamp(candidate) > timestamp(current) ||
          (timestamp(candidate) === timestamp(current) &&
            (Date.parse(candidate.generated_at) || 0) > (Date.parse(current.generated_at) || 0))));
    // A stale-but-valid upstream response must not erase a newer connected
    // snapshot. This also makes a fresh browser use the deployed live snapshot
    // when the remote host is unavailable instead of requiring an old cache.
    for (const candidate of [feed, cached, packaged]) {
      if (!candidate) continue;
      if (prefer(candidate, next)) next = candidate;
    }
    // Both addresses read the same committed public snapshot. No rental API
    // request or provider quota is involved in opening or refreshing the site.
    if (config.feed_mirror_url && (!received || !received.provider?.configured || next !== received)) {
      try {
        const mirrored = validateFeed(
          await fetchJSON(config.feed_mirror_url, { fresh: true, raw: true }),
        );
        // A successful remote check also confirms an equally fresh saved or
        // included snapshot. Prefer the fetched copy on ties for honest status.
        if (!received || !prefer(received, mirrored)) received = mirrored;
        if (!next || !prefer(next, mirrored)) next = mirrored;
        remoteError = null;
      } catch (err) {
        if (!received) remoteError = err;
      }
    }
    if (!next) throw remoteError ?? Error("No complete snapshot is available");
    const usingCache = next !== received && next !== packaged;
    const usingPackaged = next === packaged;
    const olderSource = !!received && prefer(next, received);
    feed = next;
    const currentAttempt = (attempt) => Number.isFinite(Date.parse(attempt?.attempted_at)) &&
      Date.parse(attempt.attempted_at) >= (Date.parse(feed.provider?.last_success) || 0);
    if (!currentAttempt(lastAttempt)) lastAttempt = null;
    if (config.status_url) {
      try {
        const status = await fetchJSON(config.status_url, { fresh: true });
        if (
          status?.schema_version === 1 &&
          ["success", "failed", "not_configured"].includes(status.status) &&
          currentAttempt(status)
        )
          lastAttempt = status;
      } catch {}
    }
    const mode =
      feed.mode === "research"
        ? "Official-site research is ready. Connect the daily feed in Sources & setup."
        : `Latest successful listing scan: ${dateLabel(feed.provider?.last_success)}. ${feed.provider?.coverage ?? ""}`;
    $("#notice").textContent =
      (olderSource
        ? usingPackaged
          ? "The published source returned older data; showing the newer snapshot included with this site. "
          : "The published source returned older data; retaining your newer saved snapshot. "
        : usingCache
          ? "Source refresh unavailable; retaining your last complete snapshot. "
          : usingPackaged
            ? "Live update unavailable; showing the snapshot included with this site. "
            : "") +
      (lastAttempt?.status === "failed"
        ? "The most recent tracking attempt failed; the last successful scan remains below. "
        : "") +
      mode +
      (ageDays(feed.provider?.last_success ?? feed.generated_at) > 7
        ? " These observations are over 7 days old; request fresh quotes."
        : "");
    render();
    try {
      localStorage.setItem(CACHE, JSON.stringify(feed));
    } catch {}
    if (manual)
      toast(
        olderSource
          ? usingPackaged
            ? "Showing this site's newer included snapshot. The source returned older data."
            : "Your newer saved snapshot is retained. The source returned older data."
          : remoteError
          ? usingCache
            ? "Your last complete snapshot is retained. Source check unavailable."
            : "Live update unavailable. Showing this site's included snapshot."
          : "Latest published snapshot checked.",
      );
  } catch (err) {
    if (!feed) {
      try {
        feed = validateFeed(JSON.parse(localStorage.getItem(CACHE)));
        render();
      } catch {}
    }
    $("#notice").textContent = feed
      ? "Could not check the source. Your last complete snapshot and notebook are retained. Try again."
      : "The apartment data could not load. Check your connection and try again.";
    if (!feed)
      $("#view-content").innerHTML = empty(
        "Your notebook is taking a moment.",
        "Use Check for updates to try again.",
      );
  } finally {
    refreshing = false;
    $("#refresh").setAttribute("aria-disabled", "false");
    $("#refresh").textContent = "Check for updates";
  }
}
$("#refresh").onclick = () => loadFeed(true);
$("#add-home").onclick = addHome;
document.querySelectorAll("[data-view]").forEach(
  (b) =>
    (b.onclick = () => {
      view = b.dataset.view;
      render();
    }),
);
$("#theme-toggle").onclick = () => {
  const theme =
    document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem("sc-theme", theme);
  } catch {}
};
$("#photo-credit").innerHTML = link(
  "https://commons.wikimedia.org/wiki/File:2008-06-10_3000x1000_chicago_skyline.jpg",
  "Photo: J. Crocker / Wikimedia Commons",
);
loadFeed();

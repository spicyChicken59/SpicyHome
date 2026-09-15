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
  checkedLayouts,
  planLabel,
  homeCity,
  searchCenter,
  scanBedroomScope,
  tourChecks,
  tourProgress,
  tourAgenda,
  chicagoTime,
  scenarioFields,
  costScenario,
  moveInFields,
  moveInScenario,
  atlasPoints,
  leasingQuestions,
  spicyPicks,
  pickLenses,
  recipeDefaults, recipeLabels, remixPicks, decisionPool, apartmentTradeoffs, areaMatch, pricePulse, nextMoves, nextMove, costField,
  sourceAccess, sourceReferences, scanContext, chargingEvidence, publicChargingMiles,
  openQuestions, figureSpread,
} from "./model.js?v=20260916-decision-desk";
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
  mapResizeObserver = null,
  mapCamera = null,
  mapContentKey = null,
  mapGroups = [],
  mapPick = null,
  mapPickOpener = null,
  mapPickShown = 0,
  mapPickCrowd = [],
  mapSelection = null,
  mapReveal = null,
  mapAmbiguousPress = false,
  refreshing = false,
  toastTimer,
  searchTimer,
  storedNotebook = null,
  unreadableNotebook = false;
let filtersOpen = false, boardStage = "all", focusSkipped = new Set(), focusUndo = null;
let lab = { homeId: null, assumptions: {}, moveIn: {}, months: 12 };
let pickLens = "balanced";
let studio = {tab:"recipe",recipe:{...recipeDefaults},anchor:null,extra:150,bedrooms:"1",areaScope:"cities",areas:[],pulse:"all",savedOnly:false};
let atlasSelected = null, savedSearchesOpen = false, compareDifferences = false;
// null = not chosen yet, so the tray opens its identity list on a wide screen
// and keeps it one press away on a phone, where it would cover the apartments.
let trayListOpen = null;
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
// A saved home keeps the query context it was read under, with its own dates,
// so a later scan is never presented as having been captured with an older
// observation. An archived record -- one the current feed no longer carries --
// is never re-stamped with today's query: it keeps whatever it recorded, and an
// older save that recorded nothing stays "not recorded".
function savedScan(id, home) {
  const prior = record(id).scan;
  if (!home || home.notebook_only) return prior;
  const basis =
    home.kind === "building" ? "curated_research" : home.kind === "manual" ? "manual_entry" : "provider_query";
  const context = {
    basis,
    city: homeCity(home) || null,
    saved_at: new Date().toISOString(),
    feed_generated_at: feed?.generated_at ?? null,
    observed_at: home.observed_at ?? null,
  };
  const scan = basis === "provider_query" ? feed?.provider?.area_scans?.[context.city] : null;
  if (!scan) return context;
  for (const key of ["last_success", "returned", "total", "truncated", "accepted"])
    if (scan[key] !== undefined && scan[key] !== null) context[key] = scan[key];
  return context;
}
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
// The way to a record's source, in the words the record earns: the link that
// exists is labelled by what it actually reaches, a missing exact listing URL
// is said out loud, and the way out is a labelled search over recorded public
// identity -- never a guessed listing address and never anything personal.
function sourceLinks(h) {
  const a = sourceAccess(h);
  return (
    (a.url ? link(a.url, a.label, "button secondary") : "") +
    (a.fallback ? link(a.fallback.url, a.fallback.label, "button secondary") : "")
  );
}
function sourceSentence(h) {
  const a = sourceAccess(h);
  if (a.unavailable)
    return "No source link and no recorded address or building name, so there is nothing to open and nothing to search. None is invented.";
  return [a.says, a.missing, a.fallback ? a.fallback.note : ""].filter(Boolean).join(" ");
}
// The home's own observation and the area's recorded query are two dates about
// two different things, so they are printed as two sentences. A curated plan is
// never described as a provider-query result, and an area with no recorded scan
// says so rather than borrowing another area's coverage. These build plain text;
// escaping happens once, where the text is put into the page.
function scanSentence(context) {
  const where = context.city || "this area";
  if (!context.recorded)
    return context.basis === "curated_research"
      ? "Researched from the building's own source. No provider listing query stands behind this record."
      : context.basis === "manual_entry"
        ? "Entered by you. No provider listing query stands behind this record."
        : `No listing query is recorded for ${where}${context.frozen ? " in this saved record" : ""}.`;
  const counts =
    context.total === null
      ? `returned ${context.returned ?? "an unrecorded number of"} listings; the total matching count was not recorded`
      : `returned ${context.returned} of ${context.total.toLocaleString("en-US")} reported matches`;
  const completeness =
    context.coverage === "complete"
      ? "Complete for that recorded query."
      : "Coverage of that query is incomplete; it is not a reading of the whole market or of current availability.";
  return `Listing query for ${where}, ${dateLabel(context.last_success)}: ${counts}. ${completeness}`;
}
// A short form of the same answer, for a comparison cell.
function scanCell(h) {
  const context = scanContext(feed.provider, h, record(h.id).scan);
  if (!context.recorded)
    return context.basis === "provider_query"
      ? "Not recorded"
      : "No provider query — " + (context.basis === "curated_research" ? "official-source research" : "your own entry");
  const counts = context.total === null ? `${context.returned ?? "?"} returned · total not recorded` : `${context.returned} of ${context.total.toLocaleString("en-US")}`;
  return `${context.city || "Area"} · ${dateLabel(context.last_success)} · ${counts} · ${context.coverage === "complete" ? "complete for that query" : "incomplete"}`;
}
// A saved record keeps the query context it was read under. Where the area has
// been scanned again since, both are shown with their own dates rather than
// merged, and an older save that recorded none says "not recorded".
function evidenceDates(h, r) {
  const frozen = scanContext(feed.provider, h, r.scan);
  const live = r.scan ? scanContext(feed.provider, h, null) : null;
  const moved = live && live.recorded && live.last_success !== frozen.last_success;
  return (
    `<p class="meta source-dates">Observed for this home: <strong>${esc(dateLabel(h.observed_at))}</strong>${
      !frozen.recorded || frozen.order === "same" || frozen.order === "unknown"
        ? "."
        : frozen.order === "observed_first"
          ? " — older than the recorded query below, which was not captured with it."
          : " — later than the recorded query below, which was not captured with it."
    } ${esc(scanSentence(frozen))}${frozen.frozen ? " Recorded when you saved this home." : ""}</p>` +
    (moved
      ? `<p class="meta source-dates">Current feed context, separate from your saved record: ${esc(scanSentence(live))}</p>`
      : "")
  );
}
function chargingLines(h) {
  const ev = chargingEvidence(h, feed);
  const caveat =
    ev.status === "yes"
      ? "An advertised charger is not a guaranteed compatible, available or priced one."
      : ev.status === "no"
        ? "That is the source's answer for the building, not a check of your own."
        : "Unknown is not the same as none.";
  const resident = [ev.note || (ev.status === "unknown" ? "The source never established resident charging here." : ""), caveat]
    .filter(Boolean).join(" ");
  const publicLine =
    ev.public === "unavailable"
      ? `Nearby public charging: context unavailable — no public charging dataset is loaded${ev.status_note ? " (" + ev.status_note + ")" : ""}. That is not evidence that there are no chargers.`
      : ev.public === "unlocated"
        ? "Nearby public charging: this record has no coordinates, so no public station can be measured against it."
        : `Nearby public charging: ${ev.nearby} public station${ev.nearby === 1 ? "" : "s"} within ${publicChargingMiles} straight-line miles, observed ${dateLabel(ev.observed_at)}. Public stations are not a resident amenity and grant no parking or charging right.`;
  return `<li>${esc(ev.building)}. ${esc(resident)}</li><li>${esc(publicLine)}</li>`;
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
      ? `Base rent from · ${h.floor_plan ?? "apartment plan"}`
      : "Provider asking rent · verify the exact unit";
  if (h.advertised_price_type === "total_monthly")
    return "Advertised monthly total · base rent unverified";
  if (h.advertised_price !== null && h.advertised_price !== undefined)
    return "Advertised monthly price · fee basis unverified";
  return "Request a current quote for this layout";
}
// Four kinds of number stand in these surfaces and they are not the same kind:
// a base rent READ from a source or a quote, a known subtotal DERIVED from the
// amounts that exist, an amount the source never supplied, and the reader's own
// estimate. The design system's figure-basis band (v2.12.0) is what says which
// is which -- .sc-unreported for an absence, .sc-estimate for a derived or
// assumed figure -- and the WORD is in the markup beside the mark, never the
// mark alone.
function unreported(text) {
  return `<span class="sc-unreported">${esc(text)}</span>`;
}
// The gap, named, with the exact notebook field that closes it. Opening a field
// is not an answer; saving one is, which is why the label says "record".
function costGap(h, c) {
  if (!c.unknown.length) return "";
  return `<p class="meta cost-gap">Unquoted: ${unreported(c.unknown.join(" · "))}<button class="text-button" data-studio-task="${esc(h.id)}" data-task-target="${esc(costField(c.unknown[0]))}">Record ${esc(c.unknown[0])} ↗</button></p>`;
}
function subtotalValue(c) {
  return c.rent === null
    ? unreported("base rent not quoted")
    : `${money(c.known)}${c.unknown.length ? "+" : ""}`;
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
function heartIcon() {
  return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78Z"/></svg>';
}
function removeMap() {
  if (map?.getCenter && map?.getZoom) mapCamera = { center: map.getCenter(), zoom: map.getZoom() };
  mapResizeObserver?.disconnect();
  mapResizeObserver = null;
  closeMapPick(false);
  mapPick?.remove();
  mapPick = null;
  mapGroups = [];
  map?.remove();
  map = null;
  markers.clear();
}
// Half of the 44px box a browser hit-tests under a finger, so "within reach"
// means the same thing to this code as it does to the finger.
const MAP_TAP_RADIUS = 22, MAP_PICK_SHOWN = 3;
// Marks closer together than this at the current zoom cannot be told apart or
// aimed at, so they are drawn as one mark that says how many it stands for.
const MAP_CLUSTER_RADIUS = 30;
// Past this many, naming them one by one is not an answer: the panel offers the
// zoom that separates them instead. The popup, which the list route opens, is
// bounded the same way.
const MAP_PICK_LIST_MAX = 12, MAP_POPUP_MAX = 12;
// Places whose recorded coordinates land within a mark's width of each other at
// the current zoom. Every cluster is anchored on a real recorded coordinate --
// its first member's -- so no mark is drawn anywhere the feed does not place a
// home. Without a projection (the test double has none) this is exactly the
// coordinate-identical grouping the map has always drawn.
function mapClusters(placed) {
  if (typeof map?.latLngToLayerPoint !== "function") {
    const exact = new Map();
    for (const h of placed) {
      const key = `${h.lat},${h.lng}`;
      if (!exact.has(key)) exact.set(key, []);
      exact.get(key).push(h);
    }
    return [...exact.values()];
  }
  const clusters = [];
  for (const h of placed) {
    const point = map.latLngToLayerPoint([h.lat, h.lng]);
    let nearest = null, best = Infinity;
    for (const cluster of clusters) {
      const away = Math.hypot(cluster.point.x - point.x, cluster.point.y - point.y);
      if (away <= MAP_CLUSTER_RADIUS && away < best) { nearest = cluster; best = away; }
    }
    if (nearest) nearest.homes.push(h);
    else clusters.push({ point, homes: [h] });
  }
  return clusters.map((cluster) => cluster.homes);
}
// Which recorded places are within reach of a press, nearest first. Distance
// from the press decides, never which marker the browser hit-tested: 573 homes
// sit on 365 recorded coordinates, so at the fitted zoom a press at a marker's
// own centre lands on a neighbour almost every time.
function mapPressCandidates(x, y) {
  const found = [];
  for (const group of mapGroups) {
    const element = group.marker.getElement?.();
    const box = element?.getBoundingClientRect?.();
    if (!box?.width) continue;
    const distance = Math.hypot(box.left + box.width / 2 - x, box.top + box.height / 2 - y);
    // Only the home travels: the marker is rebuilt whenever the zoom regroups,
    // so a reference to it here would be the same stale-object trap the
    // directory route already paid for once.
    if (distance <= MAP_TAP_RADIUS)
      for (const home of group.homes) found.push({ distance, home });
  }
  return found.sort((a, b) => a.distance - b.distance);
}
function closeMapPick(refocus) {
  if (!mapPick || mapPick.hidden) return;
  mapPick.hidden = true;
  mapPick.innerHTML = "";
  mapPickCrowd = [];
  // The dismissing press runs its own default action after this handler, so the
  // focus has to be placed deliberately or it lands on the document body.
  const back = mapPickOpener;
  mapPickOpener = null;
  if (refocus) (back?.isConnected && !back.hidden ? back : $("#map-fit"))?.focus();
}
function fillMapPick() {
  const list = mapPick.querySelector(".sc-pick__list"),
    more = mapPick.querySelector(".sc-pick__more");
  list.innerHTML = mapPickCrowd
    .slice(0, mapPickShown)
    .map(({ home }) => {
      const evidence = layoutEvidence(home, record(home.id));
      return `<button type="button" class="sc-pick__item" data-map-pick="${esc(home.id)}" aria-pressed="${home.id === mapSelection}"><span class="sc-pick__name">${esc(home.title)}</span><span class="sc-pick__meta">${esc(planLabel(home))} · ${esc(evidence.label)}</span><span class="sc-figure">${esc(money(displayPrice(home)))}</span></button>`;
    })
    .join("");
  const crowded = mapPickCrowd.length > MAP_PICK_LIST_MAX;
  more.hidden = mapPickCrowd.length <= mapPickShown;
  // Naming 141 places one at a time is not an answer to "which one did you
  // mean?". The zoom that separates them is.
  more.textContent = crowded
    ? `Zoom in to separate the other ${mapPickCrowd.length - mapPickShown}`
    : `Show the other ${mapPickCrowd.length - mapPickShown}`;
  more.dataset.mapPickZoom = crowded ? "yes" : "no";
  list.querySelectorAll("[data-map-pick]").forEach((button) => {
    button.onclick = () => {
      const id = button.dataset.mapPick;
      closeMapPick(false);
      mapSelection = id;
      // A stable list control survives a feed rerender, as the popup path does.
      focusHomeControl(id, "map-home");
      showDetail(id);
    };
  });
  more.onclick = () => {
    if (more.dataset.mapPickZoom === "yes") {
      const crowd = mapPickCrowd.map(({ home }) => [home.lat, home.lng]);
      closeMapPick(true);
      map?.fitBounds(crowd, {
        padding: [40, 40],
        maxZoom: 17,
        animate: !matchMedia("(prefers-reduced-motion: reduce)").matches,
      });
      toast("Zoomed to separate the places that shared that spot.");
      return;
    }
    mapPickShown = mapPickCrowd.length;
    fillMapPick();
    mapPick.querySelector(".sc-pick__item")?.focus();
  };
}
function openMapPick(found, x, y, opener) {
  const surface = $("#map");
  if (!surface || !mapPick) return;
  mapPickCrowd = found;
  mapPickShown = MAP_PICK_SHOWN;
  mapPickOpener = opener;
  mapPick.innerHTML =
    `<div class="sc-pick__head"><h4 id="map-pick-title">${found.length} places within a finger of this press</h4><button type="button" class="button small secondary" data-map-pick-close>Close</button></div><p class="sc-pick__hint">Nearest first · Esc closes · approximate locations</p><div class="sc-pick__list" role="group" aria-label="Places within a finger of the press, nearest first"></div><button type="button" class="button small secondary sc-pick__more" hidden></button>`;
  mapPick.hidden = false;
  fillMapPick();
  mapPick.querySelector("[data-map-pick-close]").onclick = () => closeMapPick(true);
  const box = surface.getBoundingClientRect();
  mapPick.style.left = `${Math.max(6, Math.min(box.width - mapPick.offsetWidth - 6, x - box.left + 14))}px`;
  mapPick.style.top = `${Math.max(6, Math.min(box.height - mapPick.offsetHeight - 6, y - box.top + 14))}px`;
  mapPick.querySelector(".sc-pick__item")?.focus();
}
function bindMapPick(surface) {
  mapPick = document.createElement("div");
  mapPick.className = "sc-pick map-pick";
  mapPick.id = "map-pick";
  mapPick.hidden = true;
  mapPick.setAttribute("role", "dialog");
  mapPick.setAttribute("aria-labelledby", "map-pick-title");
  surface.appendChild(mapPick);
  mapPick.addEventListener("keydown", (event) => {
    if (event.key === "Escape") { event.preventDefault(); closeMapPick(true); }
  });
  // A popover, not a modal: hundreds of markers stay tabbable behind it, so Tab
  // may leave and leaving is what closes it.
  mapPick.addEventListener("focusout", (event) => {
    if (event.relatedTarget && !mapPick.contains(event.relatedTarget)) closeMapPick(false);
  });
  // renderMap() runs again on every filter change over the same #map element,
  // so the surface listeners are bound once and read the current panel through
  // mapPick; the panel itself is rebuilt with the map and torn down with it.
  if (surface.dataset.pickBound === "yes") return;
  surface.dataset.pickBound = "yes";
  surface.addEventListener("pointerdown", (event) => {
    if (event.target.closest(".sc-pick") || event.target.closest(".leaflet-control")) return;
    const found = mapPressCandidates(event.clientX, event.clientY);
    mapAmbiguousPress = found.length > 1;
    if (!found.length) { closeMapPick(false); return; }
    if (found.length === 1) { closeMapPick(false); mapSelection = found[0].home.id; return; }
    // Leaflet would open the hit-tested marker's popup on the click that
    // follows, which is the answer this panel exists to refuse.
    event.preventDefault();
    event.stopPropagation();
    openMapPick(found, event.clientX, event.clientY, null);
  }, true);
  surface.addEventListener("click", (event) => {
    if (event.target.closest(".sc-pick")) return;
    if (!mapAmbiguousPress) return;
    mapAmbiguousPress = false;
    event.preventDefault();
    event.stopPropagation();
  }, true);
}
function renderCard(h) {
  const r = record(h.id),
    layout = layoutEvidence(h, r),
    c = costs(h, r, prefs),
    delta = changeFor(h),
    saved = !!r.saved;
  return `<article class="home-card" data-home="${esc(h.id)}"><div class="card-top"><span class="neighborhood">${esc(homeCity(h) || h.neighborhood)}</span><button class="save-button" data-save="${esc(h.id)}" aria-label="${saved ? "Remove" : "Save"} ${esc(h.title)} ${saved ? "from" : "to"} shortlist" aria-pressed="${saved}">${heartIcon()}</button></div><h3>${esc(h.title)}</h3><p class="address">${esc(h.address)}</p><p class="plan-label">${esc(planLabel(h))} · ${h.sqft ? esc(h.sqft) + " sq ft" : "Size unverified"}</p><div class="rent-row"><strong class="rent">${money(displayPrice(h))}</strong>${displayPrice(h) !== null ? "<small>/ mo</small>" : ""}</div><p class="price-kind">${esc(priceKind(h))}</p><p class="meta layout-evidence">${esc(layout.label)}</p><div class="cost-line"><span>Known monthly subtotal</span><strong>${subtotalValue(c)}</strong></div><div class="chips">${chip(h, "parking", "Parking")}${chip(h, "charging", "EV")}</div>${costGap(h, c)}${delta !== null && delta !== 0 ? `<div class="price-change">${delta < 0 ? "↓" : "↑"} ${money(Math.abs(delta))} since previous observation</div>` : ""}${r.tourDate ? `<p class="tour-note">Tour: ${esc(r.tourDate.replace("T", " · "))}</p>` : ""}${h.notebook_only ? '<p class="price-change">Archived notebook entry · absent from the current feed</p>' : h.seen_in_latest === false ? '<p class="price-change">Not seen in this area’s last scan · availability unverified</p>' : ""}<div class="evidence-stamp">${evidence(h)} · ${esc(dateLabel(h.observed_at))} · ${esc(sourceAccess(h).summary)}</div>${r.status ? `<p class="meta card-status">${esc(r.status)}</p>` : ""}${tourProgress(r) ? `<p class="tour-progress">Your tour review · ${tourProgress(r)}/${tourChecks.length} checked</p>` : ""}<div class="card-actions"><button class="button small secondary" data-detail="${esc(h.id)}">Details &amp; check layout</button><label class="compare-label"><input type="checkbox" data-compare="${esc(h.id)}" ${comparison.has(h.id) ? "checked" : ""}>Compare</label><button class="text-button" data-tour="${esc(h.id)}">Tour companion ↗</button></div></article>`;
}
function empty(title, text, action = "") {
  return `<div class="empty"><h3>${esc(title)}</h3><p>${esc(text)}</p>${action}</div>`;
}
function render() {
  const resultScroll = $("#explore-results .results-column")?.scrollTop ?? 0;
  clearTimeout(searchTimer);
  if (!feed) return;
  const names = {
    discover: ["THE SEARCH", "Find your place."],
    shortlist: ["YOUR SAVED PLACES", "The ones worth a second look."],
    timeline: ["THE NOTEBOOK", "A search that remembers."],
    setup: ["CONNECTED RESEARCH", "Your sources. Your control."],
    lab: ["COST LAB", "What does life here really cost?"],
    studio: ["DECISION STUDIO", "Find the one that fits."],
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
  if (map) removeMap();
  if (view === "discover") renderDiscover();
  if (view === "shortlist") renderShortlist();
  if (view === "timeline") renderActivity();
  if (view === "setup") renderSetup();
  if (view === "lab") renderLab();
  if (view === "studio") renderStudio();
  document.body.dataset.view = view;
  bindContent();
  if (view === "discover" && $("#explore-results .results-column")) $("#explore-results .results-column").scrollTop = resultScroll;
}
function focusHomeControl(id, attribute) {
  const control = [...document.querySelectorAll(`[data-${attribute}]`)].find(
    (element) => element.getAttribute(`data-${attribute}`) === id && !element.closest("[hidden]"),
  );
  const target = control ?? (prefs.surface === "focus" && view === "discover" ? $("#focus-save") ?? $("#focus-undo") : null) ?? $("#view-title");
  for (let element = control?.parentElement; element; element = element.parentElement)
    if (element.tagName === "DETAILS") element.setAttribute("open", "");
  if (!control) target.tabIndex = -1;
  target.focus({ preventScroll: true });
}
function renderDiscover() {
  const neighborhoods = [
    ...new Set(allHomes().map((h) => h.neighborhood)),
  ].sort();
  $("#view-content").innerHTML =
    `${exploreToolbar()}<details id="search-controls" class="search-controls" ${filtersOpen ? "open" : ""}><summary>Fine-tune filters <span id="filter-caption"></span></summary><section class="area-controls" aria-label="Search area"><div class="area-selects"><div class="field"><label for="search-bedrooms">Bedrooms</label><select id="search-bedrooms"><option value="all" ${prefs.bedrooms === "all" ? "selected" : ""}>1 &amp; 2 bedrooms</option><option value="1" ${prefs.bedrooms === "1" ? "selected" : ""}>1 bedroom</option><option value="2" ${prefs.bedrooms === "2" ? "selected" : ""}>2 bedrooms</option></select></div><div class="field"><label for="search-region">Where to look</label><select id="search-region"><option value="all" ${prefs.region === "all" ? "selected" : ""}>Chicago + selected suburbs</option><option value="chicago" ${prefs.region === "chicago" ? "selected" : ""}>Chicago only</option><option value="suburbs" ${prefs.region === "suburbs" ? "selected" : ""}>Suburbs only</option></select></div><div class="field"><label for="search-radius">Distance from central Chicago</label><select id="search-radius"><option value="0" ${prefs.radiusMiles === 0 ? "selected" : ""}>Full search · 35-mile coverage</option>${[10,20,35].map((m) => `<option value="${m}" ${prefs.radiusMiles === m ? "selected" : ""}>Within ${m} miles · located places only</option>`).join("")}</select></div></div><p class="meta">Distances are straight-line, not driving or commute times. The full search includes entries with unverified coordinates.</p><details class="area-guide"><summary>Areas &amp; last listing checks</summary><p class="meta">${esc(feed.search_area?.scan_note ?? "One city per scheduled scan. Each area keeps its own last observations.")}</p><div class="area-grid">${(feed.search_area?.areas ?? []).map((area) => {const scan = feed.provider?.area_scans?.[area.city]; const count = allHomes().filter((h) => homeCity(h) === area.city && !h.notebook_only); return `<article><h3>${esc(area.city)}</h3><p>${esc(area.note)}</p><p class="meta">${count.filter((h) => h.kind === "building").length} sourced plans · ${count.filter((h) => h.kind === "listing").length} retained listing snapshots</p><p class="meta">${scan ? `Last listing scan: ${esc(dateLabel(scan.last_success))}${scan.truncated || scan.total == null && scan.returned === 500 ? " · capped coverage" : ""}` : "Awaiting first listing scan"}</p><p class="meta">${esc(scanBedroomScope(feed.provider, area.city))}</p>${link(area.source_url,"Area & transport details ↗")}</article>`;}).join("")}</div></details></section><div class="layout-controls"><label for="layout-scope">Layout evidence</label><select id="layout-scope"><option value="all" ${prefs.layoutScope === "all" ? "selected" : ""}>All potential matches</option><option value="source" ${prefs.layoutScope === "source" ? "selected" : ""}>Source-listed plans + my checked layouts</option><option value="confirmed" ${prefs.layoutScope === "confirmed" ? "selected" : ""}>Only layouts I have checked</option></select><p id="layout-summary" class="meta" role="status"></p></div><form class="filters" id="filters"><div class="field"><label for="search">Building, plan or area</label><input type="search" id="search" name="search" maxlength="500" placeholder="Try Evanston, Oak Park or a plan name" value="${esc(prefs.search)}"></div><div class="field"><label for="min">Minimum / month</label><input type="number" id="min" name="min" min="0" max="20000" step="50" value="${prefs.min}"></div><div class="field"><label for="max">Maximum / month</label><input type="number" id="max" name="max" min="0" max="20000" step="50" value="${prefs.max}"></div><div class="field"><label for="basis">Compare budget against</label><select id="basis" name="basis"><option value="rent" ${prefs.basis === "rent" ? "selected" : ""}>Base rent</option><option value="total" ${prefs.basis === "total" ? "selected" : ""}>Known monthly subtotal</option></select></div><div class="field"><label for="neighborhood">Neighborhood / suburb</label><select id="neighborhood" name="neighborhood"><option value="all">All neighborhoods & suburbs</option>${neighborhoods.map((n) => `<option ${prefs.neighborhood === n ? "selected" : ""}>${esc(n)}</option>`).join("")}</select></div></form><div class="filter-options"><label><input type="checkbox" id="filter-parking" ${prefs.parking ? "checked" : ""}>Advertised parking only</label><label><input type="checkbox" id="filter-charging" ${prefs.charging ? "checked" : ""}>Advertised EV charging only</label><label><input type="checkbox" id="filter-unknown" ${prefs.unknown ? "checked" : ""}>Include unquoted base rent</label><button class="text-button" id="reset-filters">Reset</button><span class="meta">Target: 1–2 separate bedrooms · 1–2 bathrooms</span></div>${searchShelf()}</details><div class="filter-summary" id="filter-summary" role="status" aria-live="polite" hidden></div><section id="focus-surface" aria-label="Focus review" hidden></section><section id="atlas-surface" aria-label="Rent and space atlas" hidden></section><div class="results-layout" id="explore-results"><aside class="map-panel" aria-label="Chicago and suburbs apartment map"><div class="map-heading"><h3>Explore the area</h3><button class="text-button" id="map-fit">Fit all homes</button></div><div class="map-surface" id="map" role="region" aria-label="Apartment locations"></div><details class="map-directory"><summary>Places on this map <span id="map-directory-count" class="meta"></span></summary><ul class="map-list" id="map-list"></ul></details><div class="map-foot">Approximate locations &middot; tap a dot for prices &amp; plans. Where several places share a spot, a tap asks which one you meant; the list below reaches any of them by name. Public chargers are separate from resident amenities.</div></aside><div class="results-column"><section id="spicy-picks" aria-labelledby="picks-title"></section><div class="results-top"><strong id="result-count"></strong><label class="meta">Sort <select id="sort" aria-label="Sort apartments"><option value="rent" ${prefs.sort === "rent" ? "selected" : ""}>${prefs.basis === "rent" ? "Base rent" : "Known subtotal"}: low to high</option><option value="space" ${prefs.sort === "space" ? "selected" : ""}>More room</option><option value="recent" ${prefs.sort === "recent" ? "selected" : ""}>Recently observed</option></select></label></div><div class="home-grid" id="results"></div></div></div><p class="research-note" id="budget-note">${feed.mode === "research" ? "Start with sourced building prospects. These are research leads, not confirmed available apartments." : "Listing snapshots and sourced building prospects are shown together, each labeled by its source."} Budget is ${prefs.basis === "rent" ? "base rent; parking, utilities and other fees can take your monthly cost above it." : "a known subtotal; missing fees are never treated as free."}</p><details class="excluded-layouts" id="excluded-layouts"><summary id="excluded-summary"></summary><p class="meta">These places are outside your 1–2 bedroom search. Open a record to review the source or correct your layout choice. Removing a heart does not erase a layout correction.</p><div class="home-grid" id="excluded-results"></div></details><div id="compare-tray"></div>`;
  renderResults();
  $("#search-controls").ontoggle = (event) => { if (event.currentTarget?.isConnected) filtersOpen = event.currentTarget.open; };
  bindExploreToolbar();
  bindSearchShelf();
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
  $("#search-bedrooms").onchange = () => {
    prefs.bedrooms = $("#search-bedrooms").value;
    persist(); renderResults(); bindCards();
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
  const bedrooms = keepLayout === true ? prefs.bedrooms : defaults.bedrooms;
  prefs = { ...defaults, utilityEstimate: prefs.utilityEstimate, surface: prefs.surface, density: prefs.density, layoutScope, bedrooms };
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
    return false;
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
  return true;
}
function renderResults() {
  $("#saved-count").textContent = Object.values(state.records).filter((r) => r.saved).length;
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
  $("#layout-summary").textContent = `${statuses.filter((s) => s === "source_listed").length} source-listed plans · ${statuses.filter((s) => ["provider_reported", "unverified"].includes(s)).length} layouts need checking · ${excluded.length} excluded for studio, different or conflicting layout. Unknown bedroom counts appear only under 1 & 2 bedrooms. Listed counts do not confirm separate enclosed bedrooms.`;
  const summary = $("#filter-summary");
  summary.hidden = hiddenListings === 0;
  summary.innerHTML = hiddenListings
    ? `<div><strong>${listings} listing snapshots loaded · ${hiddenListings} hidden by your filters.</strong><p>${prefs.parking || prefs.charging ? "Parking and EV filters require advertised amenities; unverified amenities are excluded. " : ""}${prefs.neighborhood !== "all" ? "Listings without a supplied neighborhood are excluded from a named-neighborhood search. " : ""}Search filters are saved separately in each browser. Resetting them keeps your saved homes, notes and quotes.</p></div><button class="button secondary" id="show-unfiltered">Reset search filters</button>`
    : "";
  if (hiddenListings) $("#show-unfiltered").onclick = resetSearchFilters;
  const scopedMatches = visibleHomes(loaded.filter((h) => !h.notebook_only), state, { ...defaults, utilityEstimate: prefs.utilityEstimate, bedrooms: prefs.bedrooms, layoutScope: prefs.layoutScope }).length;
  const recovery = scopedMatches || prefs.bedrooms === "all"
    ? '<button class="button secondary" id="reset-other-filters">Reset other filters</button>'
    : '<button class="button secondary" id="broaden-bedrooms">Show 1 &amp; 2 bedrooms</button>';
  $("#results").dataset.density = prefs.density;
  document.querySelectorAll("button[data-density]").forEach((button) => { button.setAttribute("aria-pressed",String(button.dataset.density===prefs.density)); button.onclick=()=>{prefs.density=button.dataset.density;persist();renderResults();bindCards();}; });
  $("#results").innerHTML = homes.length
    ? homes.map(prefs.density === "scan" ? renderScanCard : renderCard).join("")
    : prefs.layoutScope === "confirmed" && !checked
      ? empty("No layouts checked yet.", "Open a potential match and check its exact floor plan, then record the separate bedrooms and bathroom count you checked.", '<button class="button secondary" id="browse-layouts">Browse potential matches</button>')
      : empty("No places match these filters.", prefs.layoutScope === "confirmed" ? `${checked} checked layout${checked === 1 ? " is" : "s are"} hidden by your other filters.` : scopedMatches ? "Reset your area, budget and amenity filters while keeping your bedroom choice and layout evidence." : "No matching layouts are loaded for this bedroom choice. Try both sizes, or check the area guide for pending listing scans.", recovery);
  if ($("#browse-layouts")) $("#browse-layouts").onclick = () => { prefs.layoutScope = "all"; resetSearchFilters(true); };
  if ($("#broaden-bedrooms")) $("#broaden-bedrooms").onclick = () => { prefs.bedrooms = "all"; persist(); render(); $("#search-bedrooms")?.focus(); };
  if ($("#reset-other-filters")) $("#reset-other-filters").onclick = () => resetSearchFilters(true);
  $("#excluded-layouts").hidden = !excluded.length;
  $("#excluded-summary").textContent = `Review excluded layouts (${excluded.length})`;
  $("#excluded-results").innerHTML = excluded.map(renderCard).join("");
  $("#map-list").innerHTML = homes
    .map(
      (h, i) =>
        `<li><button data-map-home="${esc(h.id)}"><span class="map-index">${i + 1}</span><span class="map-place"><strong>${esc(h.title)}</strong><span>${esc(planLabel(h))}</span><span>${esc(layoutEvidence(h, record(h.id)).label)}</span></span></button><label class="compare-label"><input type="checkbox" data-compare="${esc(h.id)}" ${comparison.has(h.id) ? "checked" : ""}><span class="sc-sr-only">Compare ${esc(h.title)} ${esc(planLabel(h))}</span><span aria-hidden="true">Compare</span></label></li>`,
    )
    .join("");
  const located = homes.filter((h) => Number.isFinite(h.lat) && Number.isFinite(h.lng)).length;
  const directoryCount = $("#map-directory-count");
  if (directoryCount)
    directoryCount.textContent = located === homes.length
      ? `(${homes.length})`
      : `(${located} of ${homes.length} · ${homes.length - located} without a recorded location)`;
  updateExploreSurface(homes);
  renderSpicyPicks();
  renderTray();
}
function renderMap(homes) {
  const contentKey = JSON.stringify(homes.map(h => [h.id, h.lat, h.lng]).sort((a, b) => a[0].localeCompare(b[0])));
  const keepCamera = contentKey === mapContentKey;
  if (map) removeMap();
  if (!window.L) {
    $("#map-fit").disabled = true;
    $("#map-list")
      .querySelectorAll("[data-map-home]")
      .forEach((b) => (b.onclick = () => showDetail(b.dataset.mapHome)));
    $("#map").innerHTML =
      '<p class="map-unavailable">The map could not load. Every apartment remains available in the list, with its address and directions link.</p>';
    return;
  }
  const L = window.L;
  mapGroups = [];
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
  const drawMarkers = () => {
    for (const group of mapGroups) group.marker.remove();
    markers.clear();
    mapGroups = [];
    for (const group of mapClusters(placed)) {
      const h = group[0];
      const marker = L.marker([h.lat, h.lng], {
        icon: L.divIcon({
          className: "home-map-marker",
          html: `<span class="map-dot ${group.length > 1 ? "map-dot-group" : ""}" aria-hidden="true"></span>${group.length > 1 ? `<span class="map-dot-count" aria-hidden="true">${group.length}</span>` : ""}<span class="map-marker-label">${group.length > 1 ? `${group.length} options` : esc(money(displayPrice(h)))}</span>`,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        }),
        title: group.length > 1 ? `${group.length} apartment options at this location` : `${h.title} · ${planLabel(h)}`,
        keyboard: true,
      }).addTo(map);
      const popup = document.createElement("div");
      popup.className = "map-options";
      popup.innerHTML = `<p>${group.length > 1 ? `${group.length} options at this approximate location` : "Apartment details"}</p>` + group.slice(0, MAP_POPUP_MAX).map((home) => `<button type="button" class="map-plan" data-map-plan="${esc(home.id)}"><strong>${esc(home.title)} · ${esc(planLabel(home))}</strong><span>${esc(home.address)}</span><span>${esc(layoutEvidence(home, record(home.id)).label)}</span><span>${esc(priceKind(home))}: ${esc(money(displayPrice(home)))}</span><span class="map-open">Open details &amp; notes →</span></button>`).join("") + (group.length > MAP_POPUP_MAX ? `<p class="meta">${group.length - MAP_POPUP_MAX} more share this spot at this zoom. Zoom in to separate them, or find one by name under “Places on this map”.</p>` : "");
      popup.querySelectorAll("[data-map-plan]").forEach((button) => {
        button.onclick = () => {
          const id = button.dataset.mapPlan;
          // Use a stable list control for focus restoration after a feed rerender.
          mapSelection = id;
          focusHomeControl(id, "map-home");
          showDetail(id);
        };
      });
      marker.bindPopup(popup, { maxWidth: 340, maxHeight: 300 });

      for (const home of group) markers.set(home.id, marker);
      mapGroups.push({ marker, homes: group });
    }
    bindMapDirectory();
  };
  drawMarkers();
  bindMapPick($("#map"));
  // The clusters are a function of the zoom, so they are rebuilt when it changes.
  if (typeof map.on === "function") map.on("zoomend", () => { closeMapPick(false); drawMarkers(); });
  const fitHomes = () => {
    if (placed.length) map.fitBounds(placed.map(h => [h.lat, h.lng]), { padding: [45, 35], maxZoom: 14 });
    else map.setView([41.882, -87.632], 11);
  };
  if (keepCamera && mapCamera) map.setView(mapCamera.center, mapCamera.zoom, { animate: false });
  else fitHomes();
  mapContentKey = contentKey;
  $("#map-fit").onclick = fitHomes;
  $("#map-fit").disabled = !placed.length;
  if (typeof ResizeObserver !== "undefined") {
    const currentMap = map;
    mapResizeObserver = new ResizeObserver(() => {
      if (map === currentMap) currentMap.invalidateSize({ pan: false });
    });
    mapResizeObserver.observe($("#map"));
  }
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
  bindMapDirectory();
}
// The list is the precise path to a named place: it never needs aiming, and it
// reaches every home the map draws, including one inside a cluster.
function bindMapDirectory() {
  $("#map-list")
    ?.querySelectorAll("[data-map-home]")
    .forEach((b) => (b.onclick = () => revealOnMap(b.dataset.mapHome)));
}
// Changing the zoom regroups the marks, which replaces the very marker the
// reader asked for, so the popup is opened once the map has settled -- on the
// mark that exists then.
function openRevealed() {
  const id = mapReveal;
  mapReveal = null;
  if (id) markers.get(id)?.openPopup();
}
function revealOnMap(id) {
  const marker = markers.get(id);
  if (!marker || !map) { showDetail(id); return; }
  mapSelection = id;
  mapReveal = id;
  const target = marker.getLatLng();
  const view = { animate: !matchMedia("(prefers-reduced-motion: reduce)").matches };
  // A view that is already there sends no event, so it is opened outright.
  // Otherwise the listener goes on BEFORE the move: a zoom far enough to skip
  // the animation raises both events inside setView, and a listener added after
  // it would never hear them.
  const settled = map.getZoom?.() === 15 && map.getCenter?.().equals?.(target);
  if (settled || typeof map.once !== "function") {
    map.setView(target, 15, view);
    openRevealed();
    return;
  }
  map.once("moveend", openRevealed);
  map.setView(target, 15, view);
}
// The words for a next step, in one place: the shortlist and Decision Studio
// print the same engine's answer, so they cannot name the same step differently.
const MOVE_ACTIONS = {
  layoutReview: "Check the layout",
  "leasing-draft": "Prepare quote questions",
  "tour-draft-count": "Open tour companion",
  notes: "Record my decision",
};
// The compact evidence cue for a saved home: what kind of record it is, how old
// it is, and what its source link actually reaches. The full provenance -- the
// dated references and the city query behind them -- stays in the record, one
// press away, rather than being reprinted under every home.
function savedEvidenceCue(home) {
  const absent = home.notebook_only
    ? "Archived notebook entry · absent from the current feed"
    : home.seen_in_latest === false
      ? "Not in the last area scan"
      : "";
  return [evidence(home), dateLabel(home.observed_at), sourceAccess(home).summary, absent].filter(Boolean);
}
// What is still unresolved, each item opening the exact field or evidence
// section that settles it. Folded away by default so a shortlist reads as
// apartments rather than as a task list; the count is on the summary, so the
// reader knows what folding costs them. The one nextMove() picked is marked,
// because the button above is that same step.
function openQuestionList(home, rec) {
  const questions = openQuestions(home, rec, prefs);
  if (!questions.length)
    return '<p class="saved-clear">Nothing unresolved on record. Confirm the exact unit and the quote with leasing.</p>';
  const move = nextMove(home, state, prefs);
  const marked = move ? questions.findIndex((q) => q.target === move.target) : -1;
  const chosen = (q, i) => i === marked;
  return `<details class="saved-open"><summary>What could change my mind? <span>${questions.length}</span></summary><p class="meta">Each one opens the field or evidence that settles it. Opening is not answering — the item clears when an answer is saved.</p><ul>${questions
    .map((q, i) => `<li${chosen(q, i) ? ' class="is-next"' : ""}><button class="text-button" data-studio-task="${esc(home.id)}" data-task-target="${esc(q.target)}">${esc(q.label)}</button>${chosen(q, i) ? '<span class="chip saved-chip">next</span>' : ""}<span class="meta">${esc(q.detail)}</span></li>`)
    .join("")}</ul></details>`;
}
// A saved home as a decision, not as a discovery card again: who it is, what it
// costs on which basis, the evidence that qualifies it, one next step, and the
// rest folded. Every figure comes from the same helpers the cards use, so a
// number cannot differ between the two surfaces.
function savedRow(home) {
  const rec = record(home.id),
    layout = layoutEvidence(home, rec),
    cost = costs(home, rec, prefs),
    move = nextMove(home, state, prefs),
    stage = rec.status ?? "shortlisted",
    ruled = stage === "ruled out";
  return `<article class="saved-row${rec.finalist ? " is-finalist" : ""}${ruled ? " is-ruled" : ""}" data-home="${esc(home.id)}" data-saved-stage="${esc(stage)}"><header class="saved-head"><div class="saved-identity"><h4>${esc(home.title)}</h4><p class="plan-label">${esc(planLabel(home))} · ${esc(homeCity(home) || home.neighborhood)}</p></div><div class="saved-money"><strong class="rent">${money(displayPrice(home))}</strong><span class="price-kind">${esc(priceKind(home))}</span></div></header><dl class="saved-facts"><div><dt>Known monthly subtotal</dt><dd>${subtotalValue(cost)}</dd></div><div><dt>Layout evidence</dt><dd>${esc(layout.label)}</dd></div></dl><p class="saved-cues">${cost.unknown.length ? `<span class="saved-gap">Unquoted: ${unreported(esc(cost.unknown.join(" · ")))}</span>` : '<span class="saved-gap">Every monthly item above is entered</span>'}</p><div class="chips saved-chips">${rec.finalist ? '<span class="chip finalist-chip">Final Three</span>' : ""}${chip(home, "parking", "Parking")}${chip(home, "charging", "EV")}<span class="chip stage-chip">${esc(stage)}</span></div><p class="saved-evidence">${savedEvidenceCue(home).map((part) => esc(part)).join(" · ")}</p>${openQuestionList(home, rec)}<div class="saved-actions">${move ? `<button class="button small" data-studio-task="${esc(home.id)}" data-task-target="${esc(move.target)}">${esc(MOVE_ACTIONS[move.target] ?? "Open this record")}</button>` : ""}<button class="button small secondary" data-detail="${esc(home.id)}">Open record</button><button class="save-button" data-save="${esc(home.id)}" aria-label="Remove ${esc(home.title)} ${esc(planLabel(home))} from your shortlist" aria-pressed="true">${heartIcon()}</button><label class="compare-label"><input type="checkbox" data-compare="${esc(home.id)}" ${comparison.has(home.id) ? "checked" : ""}>Compare</label><details class="saved-more"><summary>More</summary><div><button class="button small secondary" data-finalist="${esc(home.id)}" aria-pressed="${!!rec.finalist}">${rec.finalist ? "Unpin finalist" : "Pin as finalist"}</button><label for="stage-${esc(home.id)}">Move to stage</label><select id="stage-${esc(home.id)}" data-stage="${esc(home.id)}">${statuses.map((s) => `<option ${s === stage ? "selected" : ""}>${s}</option>`).join("")}</select><button class="button small secondary" data-lab="${esc(home.id)}">Try the monthly costs ↗</button><button class="text-button" data-tour="${esc(home.id)}">Tour companion ↗</button></div></details></div></article>`;
}
// The three groups a returning reader is actually sorting into: the finalists,
// the homes still in contention, and the ones ruled out. The seven stages stay
// authoritative -- every row carries and can change its own -- but a stage is a
// label on a home, not the shape of the page. Ruled-out homes stay recoverable
// behind their own disclosure so they stop competing with contenders.
const CONTENDER_STAGES = statuses.filter((stage) => stage !== "ruled out");
function savedGroups(saved) {
  const stageOf = (home) => record(home.id).status ?? "shortlisted";
  const order = (a, b) => CONTENDER_STAGES.indexOf(stageOf(a)) - CONTENDER_STAGES.indexOf(stageOf(b)) || a.title.localeCompare(b.title);
  const scoped = boardStage === "all" ? saved : saved.filter((home) => stageOf(home) === boardStage);
  return {
    finalists: saved.filter((home) => record(home.id).finalist && stageOf(home) !== "ruled out"),
    contenders: scoped.filter((home) => stageOf(home) !== "ruled out").sort(order),
    ruled: scoped.filter((home) => stageOf(home) === "ruled out"),
  };
}
function renderShortlist() {
  const saved = allHomes().filter((h) => record(h.id).saved);
  const groups = savedGroups(saved);
  const counts = (stage) => stage === "all" ? saved.length : saved.filter((h) => (record(h.id).status ?? "shortlisted") === stage).length;
  $("#view-content").innerHTML = `<div class="board-heading"><p>Your decision desk. Nothing here is ranked or scored for you.</p><button class="button secondary" id="export-notebook">Export notebook</button></div>${finalistShelf(saved, groups)}<div class="stage-tabs" aria-label="Filter saved homes by stage">${["all", ...statuses].map((stage) => `<button data-board-stage="${stage}" aria-pressed="${boardStage === stage}">${stage === "all" ? "All saved" : esc(stage)} <span>${counts(stage)}</span></button>`).join("")}</div>${saved.length ? `<section class="saved-section" aria-label="Homes in contention"><div class="saved-section__head"><h3>In contention</h3><span>${groups.contenders.length}${boardStage === "all" ? "" : " at this stage"}</span></div>${groups.contenders.length ? `<div class="saved-list">${groups.contenders.map(savedRow).join("")}</div>` : `<p class="meta">${boardStage === "all" ? "Every saved home is ruled out. Reopen one below to bring it back into contention." : "No homes at this stage."}</p>`}</section>${groups.ruled.length ? `<details class="saved-ruled"><summary>Ruled out <span>${groups.ruled.length}</span></summary><p class="meta">Kept with every note, quote and check. Move one back to a stage to return it to contention.</p><div class="saved-list">${groups.ruled.map(savedRow).join("")}</div></details>` : ""}${renderTourAgenda(saved)}` : empty("Your decision desk starts here.", "Save a home from Discover or Focus, then narrow it down to the ones worth a tour.", '<button class="button" data-go="discover">Find apartments</button>')}<p class="meta">Stages, finalists and tour checks are your notes. They do not change listing availability or contact a building.</p><div id="compare-tray"></div>`;
  $("#export-notebook").onclick = exportNotebook;
  document.querySelectorAll("[data-board-stage]").forEach((button) => { button.onclick = () => { boardStage = button.dataset.boardStage; render(); [...document.querySelectorAll("[data-board-stage]")].find((b) => b.dataset.boardStage === boardStage)?.focus(); }; });
  document.querySelectorAll("[data-stage]").forEach((select) => { select.onchange = () => { const id = select.dataset.stage; state.records[id] = { ...record(id), status: select.value, snapshot: getHome(id), scan: savedScan(id, getHome(id)), saved: true }; event(id, "Moved to " + select.value + "."); const ok = persist(); render(); focusHomeControl(id, "stage"); saveNotice(ok); }; });
  bindFinalists();
  renderTray();
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
// The one comparison selection, and the one place that says what it holds.
// Every surface writes the same [data-compare] control into the same set, so
// this reads the set rather than the screen: a home chosen from a card, a
// compact row, the map's record, the Atlas or a pick is the same selection.
function comparisonEntries() {
  const loaded = allHomes();
  const shown = new Set(visibleHomes(loaded.filter((h) => !h.notebook_only), state, prefs).map((h) => h.id));
  return [...comparison].map((id) => {
    const home = loaded.find((h) => h.id === id) ?? null;
    return { id, home, hidden: !!home && !shown.has(id) };
  });
}
function renderTray() {
  document.querySelectorAll("[data-compare]").forEach((input)=>{input.checked=comparison.has(input.dataset.compare);});
  const el = $("#compare-tray");
  if (!el) return;
  const entries = comparisonEntries();
  const known = entries.filter((entry) => entry.home);
  const lost = entries.length - known.length;
  const hidden = known.filter((entry) => entry.hidden);
  el.className = comparison.size ? "compare-tray sc-actionbar" : "";
  document.body.dataset.tray = comparison.size ? "on" : "off";
  if (!comparison.size) { el.innerHTML = ""; el.removeAttribute("role"); el.removeAttribute("aria-label"); trayStatus(); return; }
  el.setAttribute("role", "region");
  el.setAttribute("aria-label", "Comparison selection");
  // A selection the reader made is never undone by a filter they changed
  // afterwards: the home is named, marked and reachable in one click, and the
  // saved search filters are not touched to show it.
  const listOpen = trayListOpen ?? !matchMedia("(max-width: 720px)").matches;
  el.innerHTML =
    `<span class="chip tray-count">${comparison.size} of 3 selected</span><p>${
      hidden.length
        ? `${hidden.length === 1 ? "One is" : `${hidden.length} are`} outside your current filters — kept, marked below, and your saved filters are unchanged.`
        : "Compared on the same recorded facts."
    }${lost ? ` ${lost} selected ${lost === 1 ? "place is" : "places are"} no longer in the loaded record and cannot be compared.` : ""}</p><button class="button" id="open-compare">Compare ${known.length === 1 ? "this place" : `these ${known.length}`} side by side</button><div class="sc-actionbar__more"><details class="tray-list" ${listOpen ? "open" : ""}><summary><span class="tray-toggle">Selected places</span><span class="tray-toggle__count">${known.length}</span>${hidden.length ? `<span class="tray-toggle__flag">${hidden.length} outside your filters</span>` : ""}</summary><ul class="tray-items">${known
      .map(({ home, hidden: out }, i) => `<li${out ? ' class="is-outside"' : ""}><span class="compare-letter">${String.fromCharCode(65 + i)}</span><span class="tray-name"><strong>${esc(home.title)}</strong><small>${esc(planLabel(home))}${out ? " · outside your current filters" : ""}</small></span>${out ? `<button class="text-button" data-detail="${esc(home.id)}">Open</button>` : ""}<button class="icon-button tray-remove" data-compare-remove="${esc(home.id)}" aria-label="Remove ${esc(home.title)} ${esc(planLabel(home))} from the comparison">×</button></li>`)
      .join("")}</ul></details><button class="text-button" id="clear-compare">Clear all</button></div>`;
  el.querySelector(".tray-list").ontoggle = (event) => { if (event.currentTarget?.isConnected) trayListOpen = event.currentTarget.open; };
  $("#open-compare").onclick = showCompare;
  $("#clear-compare").onclick = () => { comparison.clear(); render(); };
  el.querySelectorAll("[data-compare-remove]").forEach((button) => {
    button.onclick = () => {
      const id = button.dataset.compareRemove;
      comparison.delete(id);
      renderTray();
      // Put the reader back on a control that still exists: the next remove
      // button, or the tray's own action, never the document body.
      ($("#compare-tray .tray-remove") ?? $("#open-compare") ?? $("#view-title")).focus?.();
    };
  });
  el.querySelectorAll("[data-detail]").forEach((button) => { button.onclick = () => showDetail(button.dataset.detail); });
  trayStatus();
}
// The tray sits behind an open record, so the record says for itself what the
// selection now holds rather than leaving a press with no answer.
function trayStatus() {
  const status = $("#detail-compare-status");
  if (!status) return;
  const open = $("#detail-dialog")?.open ? $("#record-form")?.dataset.id : null;
  status.textContent = !comparison.size
    ? "Nothing selected to compare yet."
    : `${comparison.size} of 3 selected${open && comparison.has(open) ? ", including this place" : ""}. The comparison tray is on the page behind this record.`;
}
function bindContent() {
  bindCards();
  // One mechanism for "open the exact field for this apartment", wherever the
  // button is: the studio, a card's cost gap, the comparison or the shortlist.
  bindStudioTasks();
  document.querySelectorAll("[data-go]").forEach(
    (b) =>
      (b.onclick = () => {
        view = b.dataset.go;
        render();
      }),
  );
}
function bindCards() {
  document.querySelectorAll("button[data-open-studio]").forEach(button=>{button.onclick=()=>{view="studio";render();$("#view-title").tabIndex=-1;$("#view-title").focus();$("#workspace").scrollIntoView?.({block:"start"});};});
  document.querySelectorAll("[data-calendar]").forEach((button) => { button.onclick = () => {const home=getHome(button.dataset.calendar);if(home && record(home.id).tourDate) downloadTour(home,record(home.id));}; });
  document.querySelectorAll("[data-tour]").forEach((b) => { b.onclick = () => { showDetail(b.dataset.tour); $("#tour-companion").open = true; $("#tour-companion").scrollIntoView?.({block:"start"}); $("#tour-companion summary").focus(); }; });
  document.querySelectorAll("[data-lab]").forEach((b) => { b.onclick = () => { lab.homeId = b.dataset.lab; lab.assumptions = {}; lab.moveIn = {}; view = "lab"; render(); $("#lab-home")?.focus(); }; });
  document.querySelectorAll("[data-save]").forEach(
    (b) =>
      (b.onclick = () => {
        const id = b.dataset.save,
          r = record(id),
          saved = !r.saved;
        state.records[id] = {
          ...r,
          saved,
          finalist: saved ? !!r.finalist : false,
          snapshot: getHome(id),
          scan: savedScan(id, getHome(id)),
          status: r.status ?? "shortlisted",
        };
        event(id, saved ? "Added to shortlist." : "Removed from shortlist.");
        const ok = persist();
        // Saving should not rebuild the map, reset a scrollable list, jump to a
        // duplicate pick -- or, from inside an open record, redraw the page
        // behind the dialog and take the focus out of it with the page.
        if ($("#detail-dialog")?.open || (view === "discover" && ["split", "list", "map"].includes(prefs.surface))) {
          b.focus({ preventScroll: true });
          document.querySelectorAll("[data-save]").forEach(control => {
            if (control.dataset.save !== id) return;
            control.setAttribute("aria-pressed", String(saved));
            // A control whose own words say what it does carries no aria-label
            // (the record's button is one). Reading one off it and calling
            // .replace on null took the rest of this sweep down with it.
            const label = control.getAttribute("aria-label");
            if (label) control.setAttribute("aria-label", label
              .replace(/^(Save|Remove) /, saved ? "Remove " : "Save ")
              .replace(/ (to|from) shortlist$/, saved ? " from shortlist" : " to shortlist"));
          });
          document.querySelectorAll("[data-save-text]").forEach(label => {
            if (label.dataset.saveText === id) label.textContent = saved ? "Saved to your shortlist" : "Save to shortlist";
          });
          $("#saved-count").textContent = Object.values(state.records).filter(record => record.saved).length;
        } else {
          render();
          focusHomeControl(id, "save");
        }
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
          // Three is the limit, and the fourth press never replaces one of them
          // silently: it names what is held and leaves the choice to the reader.
          if (comparison.size === 3) {
            b.checked = false;
            const held = [...comparison].map((id) => getHome(id)?.title).filter(Boolean).join(", ");
            toast(`Three places are already selected${held ? ": " + held : ""}. Remove one in the comparison tray to add another.`);
            // The tray is inert behind an open record; do not aim the focus at it.
            if (!$("#detail-dialog")?.open) $("#compare-tray .tray-remove")?.focus();
            trayStatus();
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
    `<div class="dialog-body"><div class="dialog-header"><div><p class="eyebrow">${esc(h.neighborhood)} / ${evidence(h)}</p><h2 id="detail-title">${esc(h.title)}</h2></div><button class="dialog-close" data-close aria-label="Close apartment details">×</button></div><p class="detail-sub">${esc(h.address)} · ${esc(layoutEvidence(h, r).label)} · ${esc(planLabel(h))}${h.sqft ? " · " + esc(h.sqft) + " sq ft" : ""}</p><div class="detail-actions"><button class="button secondary" data-save="${esc(id)}" aria-pressed="${!!r.saved}">${heartIcon()}<span data-save-text="${esc(id)}">${r.saved ? "Saved to your shortlist" : "Save to shortlist"}</span></button><label class="compare-label"><input type="checkbox" data-compare="${esc(id)}" ${comparison.has(id) ? "checked" : ""}>Compare this place</label><p class="meta" id="detail-compare-status" role="status"></p></div>${detailDock()}<div class="callout">${h.kind === "building" ? "This is a researched building prospect, not a guaranteed available unit. " : ""}${h.seen_in_latest === false ? "Not in this area’s latest capped snapshot; current availability is unverified. " : ""}${esc(h.availability_note ?? "Confirm the current unit and move-in date with the listing source.")} Observed ${esc(dateLabel(h.observed_at))}${ageDays(h.observed_at) > 7 ? " — this quote needs refreshing." : "."}</div><div class="detail-links">${sourceLinks(h)}${link("https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(h.address), "Map & directions ↗", "button secondary")}${link("https://www.google.com/maps/search/?api=1&query="+encodeURIComponent(h.title+" "+h.address),"Check resident reviews ↗","button secondary")}</div><p class="meta source-access">${esc(sourceSentence(h))}</p><section class="layout-review"><h3>Check the layout</h3><p class="meta">${esc(h.layout_note ?? "The source has not supplied a floor plan confirming a separate bedroom.")}</p><div class="field full"><label for="layoutReview">What did you find when checking the floor plan?</label><select id="layoutReview" name="layoutReview" form="record-form" aria-describedby="layout-help"><option value="unverified" ${!r.layoutReview || r.layoutReview === "unverified" ? "selected" : ""}>Not checked yet</option>${Object.entries(checkedLayouts).map(([value, [beds, baths]]) => `<option value="${value}" ${r.layoutReview === value ? "selected" : ""}>I checked: ${beds} separate bedroom${beds === 1 ? "" : "s"} · ${baths} bathroom${baths === 1 ? "" : "s"}</option>`).join("")}<option value="studio" ${r.layoutReview === "studio" ? "selected" : ""}>Studio / convertible — hide from search</option><option value="other" ${r.layoutReview === "other" ? "selected" : ""}>Different layout — hide from search</option></select><p class="meta" id="layout-help">Compare the exact unit or named plan with the source. Your correction stays in this browser and survives feed refreshes; saved notes remain in your shortlist.</p></div><button class="button small" type="submit" form="record-form">Save changes</button></section>${questionBrief(h, r)}${tourCompanion(h, r)}<div class="detail-grid"><section class="detail-section" id="detail-costs" tabindex="-1"><h3>The monthly picture</h3><table class="cost-table"><tr><td>Base rent<small>${amount(r.rentOverride) !== null ? "Your quote" : h.rent !== null ? "Source amount" : "Not quoted"}</small></td><td>${c.rent === null ? unreported("not quoted") : money(c.rent)}</td></tr><tr><td>Parking<small>${amount(r.parkingCost) !== null ? "Your quote" : "Source amount"}</small></td><td>${c.parking === null ? unreported("not quoted") : money(c.parking)}</td></tr><tr><td>Recurring fees<small>${amount(r.monthlyFees) !== null ? "Your quote" : "Source amount"}</small></td><td>${c.fees === null ? unreported("not quoted") : money(c.fees)}</td></tr><tr><td>Utilities<small>Your estimate, not a quote</small></td><td>${c.utilities !== null ? `<span class="sc-estimate">${money(c.utilities)}</span>` : unreported("not entered")}</td></tr><tr><td>Resident EV charging<small>Never part of this subtotal</small></td><td>${h.charging?.status === "no" ? unreported("not offered here") : c.charging === null ? unreported("not quoted") : money(c.charging)}</td></tr><tr><td>Known monthly subtotal<small>${c.unknown.length ? "The amounts that exist — not a complete monthly cost" : "Every monthly item above"}</small></td><td>${subtotalValue(c)}</td></tr></table><p class="range-note">${c.unknown.length ? "Still unquoted: " + esc(c.unknown.join(", ")) + ". This is not an all-in total. A recorded $0 is an amount; an unquoted item is not." : "All entered monthly items included. Confirm the quote’s completeness with leasing."} ${h.charging?.status === "no" ? "No resident charging is offered here." : "No resident EV charging cost is quoted, and none is included in this subtotal."}</p>${c.unknown.length ? `<p class="meta cost-complete"><button class="text-button" type="button" data-detail-jump="${esc(costField(c.unknown[0]))}">Complete missing costs ↓</button><span>Recurring monthly amounts only. Deposits, one-time fees and moving costs are recorded separately below.</span></p>` : ""}<p class="meta">One-time nonrefundable fees: ${money(c.upfront)}. Refundable deposits are separate; record them in your notes.</p></section><section class="detail-section"><h3>Parking, charging & access</h3><ul class="fact-list"><li>Parking: ${esc(h.parking?.note ?? "terms unverified.")}</li>${chargingLines(h)}<li>Step-free access: ${esc(h.access?.note ?? "unverified.")}</li><li>Confirm space availability, charger compatibility and fees for your lease.</li><li>Distances below cover the loaded CTA station reference only. See the area guide for suburban Metra options; station proximity is not a commute estimate.</li>${stations.map((s) => `<li>${esc(s.title)}: ${s.distance.toFixed(2)} mi straight-line. This is not a walking route or accessibility rating.</li>`).join("")}</ul></section></div><section class="detail-section"><h3>The feel of the place</h3><p class="detail-sub">${esc(h.atmosphere ?? "Add your own impression after a visit.")}</p><div class="chips">${(h.amenities ?? []).map((a) => `<span class="chip">${esc(a)}</span>`).join("")}</div></section><section class="detail-section" id="detail-history" tabindex="-1"><h3>Observed base rent</h3>${priceChart(h)}${r.quote_history?.length ? "<h3>Your recorded quotes</h3>" + priceChart({ history: r.quote_history }) : ""}</section><section class="detail-section"><h3>Your quotes & tour notebook</h3><form id="record-form" data-id="${esc(id)}"><div class="form-grid"><div class="field"><label for="status">Where you are</label><select id="status" name="status">${statuses.map((s) => `<option ${r.status === s ? "selected" : ""}>${s}</option>`).join("")}</select></div><div class="field"><label for="tourDate">Tour date & Chicago time</label><input id="tourDate" name="tourDate" type="datetime-local" value="${esc(r.tourDate ? chicagoTime(r.tourDate) ?? "" : "")}"></div>${[
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
      )}<div class="field"><label for="quoteDate">Quote date</label><input id="quoteDate" name="quoteDate" type="date" value="${esc(r.quoteDate ?? "")}"></div><div class="field full"><label for="notes">The details that matter to you</label><textarea id="notes" name="notes" maxlength="20000" placeholder="Light, noise, storage, lease terms, parking quote, connector type, tour questions…">${esc(r.notes ?? "")}</textarea></div></div><div class="form-actions"><button class="button" type="submit">Save changes</button>${r.tourDate ? '<button class="button secondary" id="download-tour" type="button">Save tour to calendar</button>' : ""}</div><p class="meta">Saved on this device. No message is sent to the building.</p></form></section><section class="detail-section" id="detail-sources" tabindex="-1"><h3>Sources behind this record</h3>${evidenceDates(h, r)}${sourceReferences(h).map((s) => `<p class="sourceline">${link(s.url, s.url)}<br>${esc(s.supports)}<br><span class="meta">${s.documentation ? "Provider documentation, not a listing for this home. " : ""}${s.observed_at ? "Observed " + esc(dateLabel(s.observed_at)) : "Source date not recorded"}</span></p>`).join("") || '<p class="meta">No source reference is recorded for this home.</p>'}</section></div>`;
  $("#detail-dialog").showModal();
  // The record carries the same save and compare controls as every card, so it
  // is bound by the same handler rather than growing a second mechanism.
  bindCards();
  trayStatus();
  bindQuestionBrief();
  document.querySelectorAll("[data-detail-jump]").forEach((button) => {button.onclick=()=>{const target=document.getElementById(button.dataset.detailJump);if(!target)return;const disclosure=target.closest("details");if(disclosure)disclosure.open=true;if(target.tabIndex<0)target.tabIndex=-1;target.focus({preventScroll:true});target.scrollIntoView?.({block:"start"});};});
  document.querySelectorAll("[data-tour-check]").forEach((input) => { input.onchange = () => { $("#tour-draft-count").textContent = `${document.querySelectorAll("[data-tour-check]:checked").length}/${tourChecks.length} reviewed · save changes to keep`; }; });
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
        tourChecks: Object.fromEntries(tourChecks.map(([key]) => [key, f.has("tour:" + key)])),
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
    next.scan = savedScan(id, h);
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
// Which two of the compared places the phone view shows, as indices into the
// current selection. Below the width two columns need, the matrix turns on its
// side and the design system's .sc-compare-pair carries it: both identities in
// a sticky head so a value is never read against the wrong place, one measure
// per row with its two values under it. A third selected place is a choice the
// reader makes in those heads -- never a silent truncation.
let pairSides = [0, 1];
function pairChoice(hs) {
  const clamp = (index, fallback) => (Number.isInteger(index) && index >= 0 && index < hs.length ? index : fallback);
  let [a, b] = [clamp(pairSides[0], 0), clamp(pairSides[1], hs.length > 1 ? 1 : 0)];
  if (a === b) b = hs.findIndex((home, index) => index !== a);
  return [a, b < 0 ? a : b];
}
function comparePair(hs, visibleRows) {
  const [a, b] = pairChoice(hs);
  const sides = hs.length > 1 ? [a, b] : [a];
  // The mark belongs to the records the view actually shows. Over three homes
  // the matrix asks "do all three agree?", but the pair shows two, and marking
  // a row as differing above two identical values is a mark the reader cannot
  // read. This asks the pair's own question.
  const pairDiffers = ([, fn]) => sides.length > 1 && new Set(sides.map((index) => String(fn(hs[index])))).size > 1;
  const head = (index, side) => {
    const home = hs[index];
    const chooser = hs.length > 2
      ? `<select data-pair-side="${side}" aria-label="Which place to show on ${side === 0 ? "the left" : "the right"}">${hs.map((option, i) => `<option value="${i}" ${i === index ? "selected" : ""}>${String.fromCharCode(65 + i)} · ${esc(option.title)}</option>`).join("")}</select>`
      : "";
    return `<div class="sc-compare-pair__head"><span class="sc-eyebrow sc-case">${String.fromCharCode(65 + index)} · ${esc(home.title)}</span><p class="sc-note">${esc(planLabel(home))}</p>${chooser}</div>`;
  };
  return `<div class="sc-compare-pair compare-pair">${hs.length > 2 ? '<p class="meta">Two at a time on this screen. Choose which two; the third stays selected.</p>' : ""}<div class="sc-compare-pair__heads">${sides.map((index, side) => head(index, side)).join("")}</div><dl class="sc-compare-pair__rows">${visibleRows
    .map((row) => `<dt class="sc-compare-pair__measure"${pairDiffers(row) ? ' data-differs="true"' : ""}>${row[0]}${pairDiffers(row) || sides.length < 2 ? "" : '<span class="sc-note">same for both</span>'}</dt><dd class="sc-compare-pair__values">${sides
      .map((index) => `<div class="sc-compare-pair__value"><span class="sc-figure">${esc(row[1](hs[index]))}</span></div>`)
      .join("")}</dd>`)
    .join("")}</dl></div>`;
}
function showCompare() {
  const hs = [...comparison].map(getHome).filter(Boolean);
  if (!hs.length) return;
  const rows = [
    // `always` is the design system's own rule for a folded comparison: the
    // identity, the cost basis and any statement of uncertainty stay readable
    // whatever the reader folds away.
    ["Layout evidence", (h) => layoutEvidence(h, record(h.id)).label, true],
    ["Plan / unit", planLabel, true],
    ["City / suburb", (h) => homeCity(h) || "Unverified"],
    ["Neighborhood", (h) => h.neighborhood],
    ["Distance from central Chicago", (h) => {const d=distanceMiles(h,searchCenter);return d === null ? "Unverified" : `${d.toFixed(1)} mi straight-line`; }],
    ["Base rent", (h) => money(costs(h, record(h.id), prefs).rent), true],
    [
      "Known monthly subtotal",
      (h) => {
        const c = costs(h, record(h.id), prefs);
        return c.rent === null
          ? "Incomplete"
          : money(c.known) + (c.unknown.length ? " + unquoted items" : "");
      },
      true,
    ],
    ["Parking / month", (h) => money(costs(h, record(h.id), prefs).parking)],
    [
      "Building EV charging",
      (h) =>
        h.charging?.status === "yes"
          ? "Advertised; access unverified"
          : h.charging?.status === "no"
            ? "Not offered"
            : "Unverified",
    ],
    // Public stations are not a resident amenity, so they are never read in the
    // row above; an unavailable dataset is its own answer, not "none nearby".
    [
      "Nearby public charging",
      (h) => {
        const ev = chargingEvidence(h, feed);
        return ev.public === "unavailable"
          ? "Context unavailable — not evidence of no chargers"
          : ev.public === "unlocated"
            ? "No coordinates on record — cannot be measured"
            : `${ev.nearby} within ${publicChargingMiles} mi straight-line`;
      },
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
    ["Observed", (h) => dateLabel(h.observed_at), true],
    // What the source link actually reaches, and the query the record was read
    // under -- two things a reader needs before trusting a row above.
    ["Source access", (h) => sourceAccess(h).summary, true],
    ["Listing query for this area", (h) => scanCell(h), true],
    ["Your status", (h) => record(h.id).status ?? "Researching"],
    ["Your notes", (h) => record(h.id).notes || "No notes yet"],
  ];
  // A row the records do not agree on, read once and used three ways: the
  // mark the design system draws on a row's own label (never on a cell -- a
  // difference is not a winner), the fold, and the count that says what folding
  // took away.
  const differs = ([, fn]) => hs.length > 1 && new Set(hs.map((h) => String(fn(h)))).size > 1;
  const folded = rows.filter((row) => !differs(row) && !row[2]);
  const visibleRows = rows.filter((row) => !compareDifferences || differs(row) || row[2]);
  // A spread is only a fact when every column holds the same kind of number.
  // One missing base rent or one unreported size makes the comparison a
  // guess, so it is named as not comparable instead of being computed anyway.
  // No column is called the winner and no score is invented here.
  const spread = (label, read, format, caveat) => {
    const result = figureSpread(hs.map((h) => ({ name: h.title, value: read(h) })));
    if (result.reason === "one")
      return `<li><strong>${label}:</strong> one place selected. Add a second to see the difference.</li>`;
    if (result.reason === "missing")
      return `<li><strong>${label}:</strong> ${unreported("not comparable")} — ${esc(result.missing.join(", "))} ${result.missing.length === 1 ? "has" : "have"} no recorded figure. Nothing is substituted for it.</li>`;
    return `<li><strong>${label}:</strong> ${result.reason === "same" ? "the same for all " + hs.length : format(result.delta) + " between the lowest and the highest"} — ${result.entries.map((e, i) => `${String.fromCharCode(65 + i)} ${format(e.value)}`).join(" · ")}. ${caveat}</li>`;
  };
  const differences = `<section class="compare-spread"><h3>Where these actually differ</h3><ul>${
    spread("Base rent", (h) => costs(h, record(h.id), prefs).rent, money, "Base rent only — parking, recurring fees and utilities are on top and are compared row by row below.")
  }${
    spread("Reported space", (h) => (Number.isFinite(h.sqft) && h.sqft > 0 ? h.sqft : null), (v) => `${Math.round(v)} sq ft`, "Reported by the source for the named plan; the exact unit still needs confirming.")
  }</ul><p class="meta">No place is ranked here and no score is calculated. A difference is shown only where every selected place has that figure on the same basis.</p></section>`;
  $("#compare-content").innerHTML =
    `<div class="dialog-body"><div class="dialog-header"><div><p class="eyebrow">THE APARTMENT FACE-OFF</p><h2 id="compare-title">Picture your everyday.</h2></div><button class="dialog-close" data-close aria-label="Close comparison">×</button></div><p class="detail-sub">The same facts for every place. Differences only hides matching facts, including shared unknowns. Rent, square footage and amenity claims need confirmation for the exact unit.</p><div class="compare-controls"><label><input id="compare-differences" type="checkbox" ${compareDifferences ? "checked" : ""} ${hs.length < 2 ? "disabled" : ""}>Differences only</label><span role="status">${visibleRows.length} of ${rows.length} facts shown${compareDifferences && folded.length ? ` · ${folded.length} matching fact${folded.length === 1 ? "" : "s"} folded away` : ""}</span></div>${compareDifferences && folded.length ? `<p class="meta compare-folded">Folded because every place records the same answer: ${esc(folded.map(([label]) => label).join(", "))}. The plan, the layout evidence, the price basis, the source date, how the source is reached and the query behind it are never folded. Turn the toggle off to read them all.</p>` : ""}<div class="compare-identities">${hs.map((h,i) => { const c = costs(h, record(h.id), prefs); return `<article><span class="compare-letter">${String.fromCharCode(65+i)}</span><div><h3>${esc(h.title)}</h3><p>${esc(planLabel(h))}</p><p class="meta">${esc(h.address)}</p><div class="compare-actions"><button class="text-button" data-studio-task="${esc(h.id)}" data-task-target="detail-costs">See cost breakdown ↗</button>${c.unknown.length ? `<button class="text-button" data-studio-task="${esc(h.id)}" data-task-target="${esc(costField(c.unknown[0]))}">Complete missing costs ↗</button>` : ""}</div></div></article>`; }).join("")}</div>${differences}${visibleRows.length ? `<div class="matrix-wrap matrix-desktop"><table class="matrix"><thead><tr><th scope="col">Your priorities</th>${hs.map((h,i) => `<th scope="col">${String.fromCharCode(65+i)} · ${esc(h.title)}<small>${esc(planLabel(h))}</small></th>`).join("")}</tr></thead><tbody>${visibleRows.map((row) => `<tr${differs(row) ? ' data-differs="true"' : ""}><th scope="row">${row[0]}</th>${hs.map((h) => `<td>${esc(row[1](h))}</td>`).join("")}</tr>`).join("")}</tbody></table></div>${comparePair(hs, visibleRows)}` : empty("These recorded facts match.","Turn off Differences only to review every fact, including shared unknowns.")}<div class="form-actions"><button class="button secondary" id="print-comparison">Print comparison</button></div></div>`;
  $("#compare-dialog").showModal();
  bindStudioTasks();
  $("#compare-content [data-close]").onclick = () =>
    $("#compare-dialog").close();
  $("#compare-differences").onchange = (event) => { compareDifferences = event.target.checked; showCompare(); $("#compare-differences").focus(); };
  // Choosing a side never drops the place on the other one: the two sides swap
  // rather than collide, and the third stays in the comparison either way.
  document.querySelectorAll("[data-pair-side]").forEach((select) => {
    select.onchange = () => {
      const side = Number(select.dataset.pairSide), picked = Number(select.value);
      const next = pairChoice(hs);
      if (next[1 - side] === picked) next[1 - side] = next[side];
      next[side] = picked;
      pairSides = next;
      showCompare();
      $(`[data-pair-side="${side}"]`)?.focus();
    };
  });
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
  const local = chicagoTime(r.tourDate);
  if (!local) { toast("Add a valid tour date first."); return; }
  const start = local.replace(/[-:]/g, "") + "00";
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
        "Import this notebook? Incoming notes and named searches replace matching entries. Export your current notebook first if you need a backup.",
      )
    )
      return;
    const byId = new Map(
      [...state.manual, ...incoming.manual].map((h) => [h.id, h]),
    );
    const merged = validateWorkspace({
      ...state,
      records: { ...state.records, ...incoming.records },
      savedSearches: [...new Map([...(state.savedSearches ?? []), ...incoming.savedSearches].map((search) => [search.name.toLowerCase(), search])).values()],
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
    const sourceAttention = olderSource || usingCache || usingPackaged || lastAttempt?.status === "failed" || ageDays(feed.provider?.last_success ?? feed.generated_at) > 7;
    $("#source-status-label").textContent = sourceAttention ? "Data needs attention · retained observations are available" : feed.provider?.configured ? `Listing scan ${dateLabel(feed.provider.last_success)} · coverage & sources` : "Sourced research · coverage & freshness";
    if (sourceAttention) $("#source-status").open = true;
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
    $("#source-status-label").textContent = "Source update unavailable · details";
    $("#source-status").open = true;
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

// The explore deck reads in one order: what you are looking FOR, what that
// leaves you WITH, and how you are looking AT it. Before this, a hard filter
// (bedrooms) and a presentation mode (List/Map/Atlas/Focus) sat on one row at
// the same y in the same pill style with no visible caption, and the second
// presentation control (Cards/Quick scan) was 869px further down the desktop
// page and 1,561px down the phone. The design system's captioned group --
// .sc-field--group with its own .sc-field__label -- is the released answer to
// exactly that (two segmented rows whose words overlap), so it is composed
// here rather than re-invented: the caption is what a reader and a screen
// reader both use to tell a filter from a mode.
function exploreToolbar() {
  const group = (id, caption, cls, label, items, attribute) =>
    `<div class="sc-field sc-field--group explore-group"><span class="sc-field__label" id="${id}-caption">${caption}</span><div class="segmented ${cls}" role="group" aria-labelledby="${id}-caption" id="${id}">${items.map(([value,text]) => `<button data-${attribute}="${value}" aria-pressed="${false}">${text}</button>`).join("")}</div></div>`;
  return `<section class="explore-deck" aria-label="Explore apartments"><div class="explore-heading"><div><p class="eyebrow">MAKE ROOM FOR WHAT MATTERS</p><strong id="search-pulse"></strong><p id="search-scope" class="meta"></p></div><div class="actions"><button class="text-button" id="open-search-controls">Adjust budget &amp; area ↗</button><button class="button secondary" data-open-studio>Decision Studio ↗</button></div></div><div class="explore-band" aria-label="What you are looking for"><p class="band-label">What you’re looking for<span> — these decide which homes exist, in every view</span></p>${group("bed-switch","beds","bedroom-shortcuts","Bedrooms",[["all","1 & 2 beds"],["1","1 bed"],["2","2 beds"]],"bed")}</div><div class="explore-band explore-band--view" aria-label="How you are looking at them"><p class="band-label">How you’re looking at them</p>${group("surface-switch","view","surface-switch","Explore view",[["split","List + map"],["list","List"],["map","Map"],["focus","Focus"],["atlas","Atlas"]],"surface")}${group("density-switch","rows","density-switch","List style",[["cards","Cards"],["scan","Quick scan"]],"density")}<p class="band-note" id="surface-note"></p></div></section>`;
}
function bindExploreToolbar() {
  $("#open-search-controls").onclick = () => { filtersOpen = true; $("#search-controls").open = true; $("#min").focus(); };
  document.querySelectorAll("[data-bed]").forEach((button) => { button.onclick = () => { prefs.bedrooms = button.dataset.bed; $("#search-bedrooms").value = prefs.bedrooms; persist(); renderResults(); bindCards(); }; });
  document.querySelectorAll("button[data-surface]").forEach((button) => { button.onclick = () => { prefs.surface = button.dataset.surface; persist(); renderResults(); bindCards(); revealSurface(); }; });
}
// A mode never changes the population, so each one says what it can and
// cannot draw instead of leaving a reader to wonder why a count moved.
const SURFACE_NOTES = {
  split: "List and map over the same matches. Places with no recorded coordinates stay in the list, counted under the map.",
  list: "Every match, including the places the map cannot locate.",
  map: "Only matches with recorded coordinates — the count under the map names the rest.",
  focus: "One match at a time, minus what you saved or skipped in this tab.",
  atlas: "Only matches with both a base rent and a reported size — the rest are named under the plot.",
};
// Choosing a surface used to leave it where it was: on a phone "Map" left 203
// of the map's 388px below the fold and "List" left the first apartment 1,549px
// down. The control stays put; what it switched comes to the top of the screen.
function revealSurface() {
  const target = {
    map: ".map-panel",
    split: ".map-panel",
    list: ".results-column",
    focus: "#focus-surface",
    atlas: "#atlas-surface",
  }[prefs.surface];
  const surface = target && $(target);
  if (!surface || surface.hidden) return;
  const box = surface.getBoundingClientRect();
  // Already near the top of the screen: leave the page where the reader put it.
  if (box.top >= 0 && box.top <= innerHeight * 0.25) return;
  surface.scrollIntoView({
    block: "start",
    behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
  });
}
function updateExploreSurface(homes) {
  $("#search-pulse").textContent = `${homes.length} places to explore`;
  $("#search-scope").textContent = `${prefs.bedrooms === "all" ? "1 & 2 bedrooms" : prefs.bedrooms + " bedroom" + (prefs.bedrooms === "2" ? "s" : "")} · ${money(prefs.min)}–${money(prefs.max)} ${prefs.basis === "rent" ? "base rent" : "known subtotal"} · ${prefs.region === "all" ? "Chicago + suburbs" : prefs.region === "chicago" ? "Chicago" : "Selected suburbs"}`;
  $("#filter-caption").textContent = `${prefs.parking ? "Parking · " : ""}${prefs.charging ? "EV · " : ""}${prefs.layoutScope === "all" ? "All evidence" : prefs.layoutScope === "source" ? "Source-listed + checked" : "Checked by me"}${prefs.search ? " · Search active" : ""}`;
  document.querySelectorAll("button[data-surface]").forEach((b) => b.setAttribute("aria-pressed",String(b.dataset.surface === prefs.surface)));
  document.querySelectorAll("[data-bed]").forEach((b) => b.setAttribute("aria-pressed",String(b.dataset.bed === prefs.bedrooms)));
  document.querySelectorAll("[data-density]").forEach((b) => b.setAttribute("aria-pressed",String(b.dataset.density === prefs.density)));
  // These two bands hold different kinds of control, so each says what its own
  // kind does. A filter changes which homes exist; a mode changes how the same
  // homes are drawn -- and the population every surface reads is the same one.
  if ($("#surface-note")) $("#surface-note").textContent = SURFACE_NOTES[prefs.surface] ?? "";
  const rows = $("#density-switch")?.closest(".explore-group");
  if (rows) rows.hidden = !["split","list"].includes(prefs.surface);
  const layout = $("#explore-results");
  layout.dataset.surface = prefs.surface;
  layout.hidden = ["focus", "atlas"].includes(prefs.surface);
  $("#atlas-surface").hidden = prefs.surface !== "atlas";
  if (prefs.surface === "atlas") renderAtlas(homes);
  else $("#atlas-surface").replaceChildren();
  refreshSearchCounts();
  $("#focus-surface").hidden = prefs.surface !== "focus";
  layout.querySelector(".map-panel").hidden = ["list","focus"].includes(prefs.surface);
  layout.querySelector(".results-column").hidden = ["map","focus"].includes(prefs.surface);
  if (["map","split"].includes(prefs.surface)) {
    renderMap(homes);
    map?.invalidateSize?.({ pan: false });
  } else if (map) removeMap();
  if (prefs.surface === "focus") renderFocus(homes);
  else $("#focus-surface").replaceChildren();
}
function renderFocus(homes) {
  const candidates = homes.filter((h) => !record(h.id).saved && !focusSkipped.has(h.id));
  const home = candidates[0];
  const reviewed = homes.length - candidates.length;
  $("#focus-surface").innerHTML = `<div class="focus-heading"><div><p class="eyebrow">ONE PLACE. YOUR FULL ATTENTION.</p><h3>${home ? `${candidates.length} left to consider` : "You’re through this set."}</h3><p class="meta">${reviewed} saved or skipped in this set. Skips last only in this tab; every place stays in Discover.</p></div><button class="text-button" id="focus-restart">Clear skips</button></div>${home ? `<div class="focus-card">${renderCard(home)}</div><div class="focus-actions"><button class="button secondary" id="focus-skip">Skip for now</button><button class="button" id="focus-save">Save &amp; next ♥</button></div>` : empty(homes.length ? "A shorter list. A clearer choice." : "No matches in this set.", homes.length ? "Open your decision board or clear skips to revisit the places you passed." : "Adjust your bedroom, area or budget filters to find more options.", '<button class="button" data-go="shortlist">Open decision board</button>')}<button class="text-button" id="focus-undo" ${focusUndo ? "" : "disabled"}>Undo last Focus action</button>`;
  $("#focus-restart").onclick = () => { focusSkipped.clear(); focusUndo = null; renderResults(); bindContent(); focusHomeControl("", "focus-next"); };
  if (home) {
    $("#focus-skip").onclick = () => { focusUndo = { action: "skip", id: home.id }; focusSkipped.add(home.id); renderResults(); bindContent(); focusHomeControl("", "focus-next"); };
    $("#focus-save").onclick = () => {
      const previous = record(home.id);
      focusUndo = { action: "save", id: home.id, saved: !!previous.saved };
      state.records[home.id] = { ...previous, saved: true, status: previous.status ?? "shortlisted", snapshot: home, scan: savedScan(home.id, home) };
      event(home.id, "Saved from Focus."); const ok = persist(); renderResults(); bindContent(); focusHomeControl("", "focus-next"); saveNotice(ok);
    };
  }
  $("#focus-undo").onclick = () => {
    if (!focusUndo) return;
    const last = focusUndo; focusUndo = null;
    if (last.action === "skip") focusSkipped.delete(last.id);
    else { state.records[last.id] = { ...record(last.id), saved: last.saved, finalist: last.saved ? !!record(last.id).finalist : false }; event(last.id, "Undid the last Focus save."); saveNotice(persist()); }
    renderResults(); bindContent(); focusHomeControl("", "focus-next");
  };
  $("#focus-surface").querySelectorAll("[data-go]").forEach((b) => { b.onclick = () => { view = b.dataset.go; render(); }; });
}
function tourCompanion(home, rec) {
  return `<details id="tour-companion" class="tour-companion"><summary>Tour companion <span id="tour-draft-count">${tourProgress(rec)}/${tourChecks.length} reviewed</span></summary><p>Use this while walking the exact apartment. A check means you reviewed the item; it does not certify the building or update its advertised amenities.</p><div class="tour-checklist">${tourChecks.map(([key,label,prompt],index) => `<label class="tour-check"><input type="checkbox" name="tour:${key}" data-tour-check="${key}" form="record-form" ${rec.tourChecks?.[key] ? "checked" : ""}><span><strong>${String(index+1).padStart(2,"0")} / ${esc(label)}</strong><span>${esc(prompt)}</span></span></label>`).join("")}</div><p class="meta">Put prices, concerns and answers in the notes below. Checklist progress is saved with this apartment.</p><button class="button" type="submit" form="record-form">Save tour checks &amp; notes</button></details>`;
}
function renderLab() {
  const homes = allHomes();
  const home = homes.find((h) => h.id === lab.homeId) ?? homes.find((h) => record(h.id).saved) ?? homes[0];
  if (!home) { $("#view-content").innerHTML = empty("Add a home to try the numbers.","The Cost Lab needs an apartment or a manual entry."); return; }
  if (lab.homeId !== home.id) { lab.assumptions = {}; lab.moveIn = {}; }
  lab.homeId = home.id;
  const base = costScenario(home, record(home.id));
  $("#view-content").innerHTML = `<section class="cost-lab"><div class="lab-controls"><p class="eyebrow">THE MONTHLY REALITY CHECK</p><h3>Try the life,<br><em>then the price.</em></h3><div class="field"><label for="lab-home">Apartment to explore</label><select id="lab-home">${homes.map((h) => `<option value="${esc(h.id)}" ${h.id === home.id ? "selected" : ""}>${record(h.id).saved ? "♥ " : ""}${esc(h.title)} · ${esc(planLabel(h))}</option>`).join("")}</select></div><p class="meta">Start from source and saved amounts. Any number you type is a scenario assumption. This scratchpad lasts in this tab and never changes your quotes.</p><div class="lab-inputs">${scenarioFields.map(([key,label]) => { const known=base.items.find((x) => x.key===key).value; return `<div class="field"><label for="lab-${key}">${label} / month</label><input type="number" id="lab-${key}" data-scenario="${key}" min="0" max="100000" step="0.01" inputmode="decimal" placeholder="${known === null ? "Unknown · enter estimate" : "Use saved/source " + money(known)}" value="${lab.assumptions[key] ?? ""}"><small>${known === null ? "No amount established" : "Saved/source: " + money(known)}</small></div>`; }).join("")}</div><div class="field"><label for="lab-months">Months to explore <output id="lab-month-value">${lab.months}</output></label><input id="lab-months" type="range" min="1" max="36" step="1" value="${lab.months}"></div>${moveInInputs(home)}<div class="actions"><button class="text-button" id="lab-reset">Clear assumptions</button><button class="text-button" data-detail="${esc(home.id)}">Open source &amp; saved quotes ↗</button></div><p id="lab-error" class="meta" role="status"></p></div><div id="lab-output" class="lab-output" aria-live="polite"></div></section>`;
  $("#lab-home").onchange = () => { lab.homeId = $("#lab-home").value; lab.assumptions = {}; lab.moveIn = {}; renderLab(); bindCards(); $("#lab-home").focus(); };
  const updateScenario = () => {
    const inputs = [...document.querySelectorAll("[data-scenario], [data-move-in]")];
    const invalid = inputs.filter((input) => !input.checkValidity());
    inputs.forEach((input) => input.setAttribute("aria-invalid",String(invalid.includes(input))));
    if (invalid.length) { $("#lab-error").textContent = "Enter valid amounts from $0 to $100,000, with at most two decimal places. The last valid scenario is still shown."; return; }
    $("#lab-error").textContent = "";
    lab.assumptions = Object.fromEntries(inputs.filter((input) => input.hasAttribute("data-scenario")).map((input) => [input.dataset.scenario, input.value === "" ? null : Number(input.value)]));
    lab.moveIn = Object.fromEntries(inputs.filter((input) => input.hasAttribute("data-move-in")).map((input) => [input.dataset.moveIn, input.value === "" ? null : Number(input.value)]));
    lab.months = Number($("#lab-months").value);
    $("#lab-month-value").textContent = lab.months;
    renderLabOutput(home);
  };
  document.querySelectorAll("[data-scenario], [data-move-in]").forEach((input) => { input.oninput = updateScenario; });
  $("#lab-months").oninput = updateScenario;
  $("#lab-reset").onclick = () => { lab.assumptions = {}; lab.moveIn = {}; lab.months = 12; renderLab(); bindCards(); $("#lab-rent").focus(); };
  renderLabOutput(home);
}
function renderLabOutput(home) {
  const result = costScenario(home, record(home.id), lab.assumptions, lab.months);
  const gap = result.monthly === null ? null : prefs.max - result.monthly;
  const assumed = result.items.filter((item) => item.assumed).length;
  $("#lab-output").innerHTML = `<div class="lab-result-heading"><span class="scenario-tag">${assumed ? "YOUR WHAT-IF SCENARIO" : "SOURCE + SAVED AMOUNTS"}</span><h3>${esc(home.title)}</h3><p>${esc(planLabel(home))} · ${esc(layoutEvidence(home,record(home.id)).label)}</p></div><div class="lab-number">${result.monthly === null ? "Base rent needed" : money(result.monthly)}</div><p>${result.complete ? "Projected monthly amount for the entered items" : "Monthly subtotal · still incomplete"}</p><div class="cost-ribbon" role="img" aria-label="${esc(result.items.map((item) => item.label + ': ' + (item.value === null ? 'unknown' : money(item.value))).join(', '))}">${result.items.filter((item) => item.value > 0).map((item) => `<span class="cost-segment cost-${item.key}" style="flex-grow:${item.value / (result.subtotal || 1)}"></span>`).join("")}</div><dl class="lab-breakdown">${result.items.map((item) => `<div><dt><span class="cost-key cost-${item.key}"></span>${item.label}<small>${item.assumed ? "Your assumption" : item.value === null ? "Unquoted" : "Saved/source amount"}</small></dt><dd>${money(item.value)}</dd></div>`).join("")}</dl><div class="lab-bottom"><div><span>${result.term} months of recurring costs</span><strong>${result.termTotal === null ? "Incomplete" : money(result.termTotal)}${result.complete ? "" : "+"}</strong></div><div><span>Against your ${money(prefs.max)} monthly search cap</span><strong>${gap === null ? "Need base rent" : gap < 0 ? money(-gap) + " over" : money(gap) + " remaining"}</strong></div></div><p class="lab-caveat">${result.missing.length ? "Still unquoted: " + esc(result.missing.join(", ")) + ". Remaining room in the cap may be used by these costs. " : "All five entered monthly items are included. "}Deposits, move-in costs and any other unlisted charges are excluded. Check whether charging is already included in parking or utilities before adding it.</p>${moveInOutput(home, result)}`;
}

function searchShelf() {
  return `<details class="search-shelf" id="saved-searches" ${savedSearchesOpen ? "open" : ""}><summary>Saved searches <span>${state.savedSearches.length}/8</span></summary><p class="meta">Keep a downtown option and a suburban option ready to switch between. Filters and view are saved here; your current utility estimate stays in place.</p><div class="search-recipes">${state.savedSearches.map((search, i) => `<article><button class="search-recipe" data-search-load="${i}"><strong>${esc(search.name)}</strong><span data-search-count="${i}"></span></button><button class="text-button" data-search-remove="${i}" aria-label="Remove saved search ${esc(search.name)}">Remove</button></article>`).join("")}</div><form id="save-search-form" class="save-search-form"><div class="field"><label for="search-name">Name this search</label><input id="search-name" name="search-name" maxlength="60" required placeholder="Downtown with room to spare"></div><button class="button secondary" type="submit">Save current search</button></form><p class="meta">Reuse a name to update it. Searches stay on this device and travel in your notebook backup.</p></details>`;
}
function refreshSearchCounts() {
  const homes = allHomes().filter((h) => !h.notebook_only);
  document.querySelectorAll("[data-search-count]").forEach((span) => {
    const search = state.savedSearches[Number(span.dataset.searchCount)];
    if (search) span.textContent = `${visibleHomes(homes, state, {...search.preferences, utilityEstimate: prefs.utilityEstimate}).length} matches now · ${money(search.preferences.max)} cap`;
  });
}
function bindSearchShelf() {
  $("#saved-searches").ontoggle = (event) => { if (event.currentTarget?.isConnected) savedSearchesOpen = event.currentTarget.open; };
  $("#save-search-form").onsubmit = (event) => {
    event.preventDefault();
    const name = $("#search-name").value.trim();
    if (!name || name.length > 60) { toast("Give this search a name of up to 60 characters."); return; }
    if (updateFilters() === false) { filtersOpen = true; $("#search-controls").open = true; $("#min").focus(); return; }
    const existing = state.savedSearches.findIndex((search) => search.name.toLowerCase() === name.toLowerCase());
    if (existing < 0 && state.savedSearches.length >= 8) { toast("Eight searches are saved. Reuse a name or remove one first."); return; }
    const search = { name, preferences: {...prefs} };
    if (existing < 0) state.savedSearches.push(search); else state.savedSearches[existing] = search;
    savedSearchesOpen = true;
    const ok = persist(); render(); $("#search-name").focus(); saveNotice(ok);
  };
  document.querySelectorAll("[data-search-load]").forEach((button) => { button.onclick = () => {
    const index = Number(button.dataset.searchLoad), search = state.savedSearches[index];
    prefs = {...search.preferences, utilityEstimate: prefs.utilityEstimate};
    savedSearchesOpen = true; const ok = persist(); render(); $(`[data-search-load="${index}"]`)?.focus();
    if (ok) toast(`Loaded ${search.name}.`); else saveNotice(false);
  }; });
  document.querySelectorAll("[data-search-remove]").forEach((button) => { button.onclick = () => {
    state.savedSearches.splice(Number(button.dataset.searchRemove), 1);
    savedSearchesOpen = true; const ok = persist(); render(); $("#search-name").focus(); saveNotice(ok);
  }; });
}
// Round numbers a reader can hold, inside the recorded extent -- never values
// invented outside it. Three ticks at 0/.5/1 of an arbitrary span printed axis
// labels like "$1,247" and "638 sq ft", which are readings of nothing.
function niceTicks(min, max, count = 5, minStep = 0) {
  const span = max - min;
  if (!(span > 0)) return [min];
  const raw = span / count;
  const power = 10 ** Math.floor(Math.log10(raw));
  // minStep is the smallest step the quantity itself can have: square feet are
  // whole, so a 0.5 sq ft step would print "800 800 801 801" -- four labels and
  // two readings.
  const step = Math.max(minStep, [1, 2, 2.5, 5, 10].map((m) => m * power).find((candidate) => candidate >= raw) ?? 10 * power);
  const ticks = [];
  for (let value = Math.ceil(min / step) * step; value <= max + step / 1000; value += step) ticks.push(Number(value.toFixed(6)));
  return ticks.length ? ticks : [min, max];
}
function renderAtlas(homes) {
  const points = atlasPoints(homes, state.records);
  const selected = points.find((point) => point.home.id === atlasSelected) ?? points[0];
  atlasSelected = selected?.home.id ?? null;
  // A home is off this plot for a reason, and the reason is named rather than
  // rolled into one number. Nothing is substituted for a missing figure: an
  // advertised total is not a base rent and an unreported size is not zero.
  const plotted = new Set(points.map((point) => point.home.id));
  const off = homes.filter((home) => !plotted.has(home.id));
  const noRent = off.filter((home) => costs(home, record(home.id)).rent === null);
  const noSize = off.filter((home) => costs(home, record(home.id)).rent !== null);
  const extent = (values) => { const min = Math.min(...values), max = Math.max(...values), padding = Math.max((max-min)*.08, 1); return [Math.max(0,min-padding), max+padding]; };
  const [xmin,xmax] = points.length ? extent(points.map((point) => point.sqft)) : [0,1];
  const [ymin,ymax] = points.length ? extent(points.map((point) => point.rent)) : [0,1];
  const x = (value) => 72 + (value-xmin)/(xmax-xmin)*482;
  const y = (value) => 260 - (value-ymin)/(ymax-ymin)*224;
  const rentTicks = niceTicks(ymin, ymax), sizeTicks = niceTicks(xmin, xmax, 5, 1);
  // Two plans at the same rent and the same size sit on the same dot. The dot
  // is not made to say which; the summary names every plan that shares the
  // selected one's spot and reaches each in one press.
  const SAME_SPOT = 7;
  const sharing = selected
    ? points.filter((point) => point !== selected
        && Math.hypot(x(point.sqft) - x(selected.sqft), y(point.rent) - y(selected.rent)) <= SAME_SPOT)
    : [];
  $("#atlas-surface").innerHTML = `<div class="atlas-heading"><div><p class="eyebrow">THE RENT × SPACE ATLAS</p><h3>Find your breathing room.</h3></div><p>${points.length} of ${homes.length} matches plotted${off.length ? ` · ${off.length} without both figures` : ""}</p></div><p class="meta">Lower is less base rent; farther right is more reported space. This shows your filtered homes, not a market valuation. Advertised totals never substitute for base rent.</p>${points.length ? `<div class="atlas-layout"><div class="atlas-chart"><div class="atlas-mobile-axis"><span>↑ More base rent</span><span>${money(ymin)}–${money(ymax)}</span></div><svg viewBox="0 0 600 320" role="img" aria-label="Base rent versus reported square feet for ${points.length} apartments. Use the apartment picker below for every point.">${rentTicks.map((rent) => `<line x1="72" y1="${y(rent)}" x2="554" y2="${y(rent)}"/><text x="62" y="${y(rent)+4}" text-anchor="end">${money(rent)}</text>`).join("")}${sizeTicks.map((size) => `<text x="${x(size)}" y="282" text-anchor="middle">${Math.round(size)}</text>`).join("")}<text x="72" y="17">Base rent / month</text><text x="310" y="310" text-anchor="middle">Reported square feet →</text>${points.filter((point) => point !== selected).concat(selected).map((point) => `<g data-atlas-point="${esc(point.home.id)}" class="atlas-point ${point.home.id === atlasSelected ? "selected" : ""} ${point.bedrooms === 2 ? "two-bed" : "one-bed"}"><title>${esc(point.home.title)} · ${esc(planLabel(point.home))} · ${money(point.rent)} · ${point.sqft} sq ft</title><circle class="atlas-hit" cx="${x(point.sqft)}" cy="${y(point.rent)}" r="18"/>${point.home.id === atlasSelected ? `<circle class="atlas-ring" cx="${x(point.sqft)}" cy="${y(point.rent)}" r="13"/>` : ""}<circle cx="${x(point.sqft)}" cy="${y(point.rent)}" r="${point.home.id === atlasSelected ? 7 : record(point.home.id).saved ? 6 : 4}"/></g>`).join("")}</svg><div class="atlas-mobile-axis"><span>${Math.round(xmin)}–${Math.round(xmax)} sq ft</span><span>More space →</span></div><div class="atlas-legend"><span>● 1 bed / other reported counts</span><span>● 2 beds</span><span>Larger dots: saved homes</span><span>Ringed dot: selected</span></div><div class="field"><label for="atlas-home">Explore any plotted apartment</label><select id="atlas-home">${points.map((point) => `<option value="${esc(point.home.id)}" ${point.home.id === atlasSelected ? "selected" : ""}>${esc(point.home.title)} · ${esc(planLabel(point.home))} · ${money(point.rent)} · ${point.sqft} sq ft</option>`).join("")}</select></div></div><div class="atlas-selection"><span class="scenario-tag">SELECTED APARTMENT</span><h3>${esc(selected.home.title)}</h3><p>${esc(planLabel(selected.home))}</p><p class="meta">${esc(selected.home.address)}</p><div class="atlas-stats"><div><strong>${money(selected.rent)}</strong><span>Base rent / month</span></div><div><strong>${selected.sqft}</strong><span>Reported sq ft</span></div></div><p class="atlas-ratio">${selected.perFoot.toLocaleString("en-US",{style:"currency",currency:"USD",minimumFractionDigits:2,maximumFractionDigits:2})} base rent / sq ft / month</p><p class="meta">${esc(priceKind(selected.home))}. Size and exact unit need confirmation. Parking, fees and utilities are extra.</p><p class="meta">${esc(layoutEvidence(selected.home,record(selected.home.id)).label)}</p><p class="meta">${amount(record(selected.home.id).rentOverride) !== null ? "Your base-rent quote: " + esc(dateLabel(record(selected.home.id).quoteDate)) + ". " : ""}Source observed: ${esc(dateLabel(selected.home.observed_at))}</p>${sharing.length ? `<div class="atlas-nearby"><p><strong>${sharing.length === 1 ? "One other plan sits" : `${sharing.length} other plans sit`} on this dot.</strong> Same recorded rent and size, different apartment.</p><ul>${sharing.slice(0,6).map((point) => `<li><button class="text-button" data-atlas-point="${esc(point.home.id)}">${esc(point.home.title)} · ${esc(planLabel(point.home))}</button></li>`).join("")}</ul>${sharing.length > 6 ? `<p class="meta">Showing 6 of ${sharing.length}; the picker above reaches every one.</p>` : ""}</div>` : ""}<div class="actions"><button class="button" data-detail="${esc(selected.home.id)}">Open this apartment</button><button class="button secondary" data-save="${esc(selected.home.id)}" aria-pressed="${!!record(selected.home.id).saved}">${record(selected.home.id).saved ? "♥ Saved — remove" : "♡ Save apartment"}</button><label class="compare-label"><input type="checkbox" data-compare="${esc(selected.home.id)}" ${comparison.has(selected.home.id) ? "checked" : ""}>Compare</label><button class="text-button" data-studio-task="${esc(selected.home.id)}" data-task-target="detail-costs">See cost breakdown ↗</button></div></div></div>` : empty("Not enough numbers to plot.","These matches need both base rent and a positive square-foot figure. Open List to see all of them, including unquoted plans.",'<button class="button secondary" id="atlas-show-list">Show all matching homes</button>')}<p class="meta">${off.length ? `Of the ${off.length} that cannot be placed, ${noRent.length} ${noRent.length === 1 ? "has" : "have"} no base rent on record and ${noSize.length} ${noSize.length === 1 ? "has" : "have"} a base rent but no reported size. Neither figure is invented, and an advertised total is never used in place of base rent. All of them are unchanged in List and on the Map.` : "Every match in this search has both figures."} Overlapping dots can hide other plans; the picker above reaches every plotted home.</p>`;
  const select = (id) => { atlasSelected = id; renderAtlas(homes); bindCards(); $("#atlas-home").focus(); };
  if ($("#atlas-home")) $("#atlas-home").onchange = (event) => select(event.target.value);
  document.querySelectorAll("[data-atlas-point]").forEach((point) => { point.onclick = () => select(point.dataset.atlasPoint); });
  bindStudioTasks();
  if ($("#atlas-show-list")) $("#atlas-show-list").onclick = () => { prefs.surface = "list"; persist(); render(); $('[data-surface="list"]').focus(); };
}
function questionBrief(home, rec) {
  const text = `Hi, I'm interested in ${home.title} — ${planLabel(home)} (${home.address}).\n\n${leasingQuestions(home,rec).map((question,i) => `${i+1}. ${question}`).join("\n\n")}`;
  return `<details class="question-brief" id="question-brief"><summary>Ask next <span>${leasingQuestions(home,rec).length} questions for this apartment</span></summary><p>Built from saved amounts and gaps in this record. Review the draft before sharing; checking a tour item does not confirm a price or charger.</p><label for="leasing-draft">Your leasing questions</label><textarea id="leasing-draft" readonly rows="10">${esc(text)}</textarea><div class="actions"><button class="button" id="copy-questions" type="button">Copy questions</button><button class="button secondary" id="questions-to-notes" type="button">Record the answers</button></div><p class="meta" id="questions-copy-status" role="status">Nothing is sent. You choose whether to share this draft.</p></details>`;
}
function bindQuestionBrief() {
  $("#copy-questions").onclick = async () => {
    const draft = $("#leasing-draft"), status = $("#questions-copy-status");
    try { await navigator.clipboard.writeText(draft.value); status.textContent = "Questions copied. Ready to paste where you choose."; }
    catch { draft.focus(); draft.select(); status.textContent = "Select and copy the draft above. Automatic copying is unavailable in this browser."; }
  };
  $("#questions-to-notes").onclick = () => { $("#notes").focus(); $("#notes").scrollIntoView?.({block:"center"}); };
}
function moveInInputs(home) {
  const known = costs(home,record(home.id)).upfront;
  return `<details class="move-in-inputs"><summary>Plan the cash to move in</summary><p class="meta">Set aside one month of recurring costs plus these amounts. This is your cash plan, not a landlord invoice. Enter 0 only when you know an item does not apply.</p><div class="lab-inputs">${moveInFields.map(([key,label]) => `<div class="field"><label for="move-in-${key}">${label}</label><input id="move-in-${key}" data-move-in="${key}" type="number" min="0" max="100000" step="0.01" inputmode="decimal" value="${lab.moveIn[key] ?? ""}" placeholder="${key === "oneTime" && known !== null ? "Use saved/source " + money(known) : "Unknown · enter estimate"}"><small>${key === "oneTime" && known !== null ? "Saved/source: " + money(known) : "Your assumption"}</small></div>`).join("")}</div></details>`;
}
function moveInOutput(home, monthly) {
  const result = moveInScenario(home,record(home.id),monthly,lab.moveIn);
  return `<section class="move-in-output"><p class="eyebrow">CASH TO SET ASIDE</p><h3>Get the keys. Keep a cushion.</h3><strong class="move-in-total">${result.total === null ? "Base rent needed" : money(result.total) + (result.complete ? "" : "+")}</strong><p>${result.complete ? "Cash plan for the entered items" : "Partial cash plan · amounts still missing"}</p><dl class="lab-breakdown"><div><dt>First month of recurring costs<small>${monthly.complete ? "Current monthly scenario" : "Current scenario · incomplete"}</small></dt><dd>${money(monthly.monthly)}</dd></div>${result.items.map((item) => `<div><dt>${esc(item.label)}<small>${item.assumed ? "Your assumption" : item.value === null ? "Unquoted" : "Saved/source amount"}</small></dt><dd>${money(item.value)}</dd></div>`).join("")}</dl><p class="meta">${result.missing.length ? "Still unknown: " + esc(result.missing.join(", ")) + ". " : ""}The deposit is refundable subject to lease terms; prepaid rent is a cash payment, not extra rent. Moving costs and nonrefundable fees are separate expenses. Confirm payment dates, prorated rent and any additional charges.</p><p class="meta">This includes month one once. It is separate from the recurring lease projection above; do not add those two totals together.</p></section>`;
}

function renderScanCard(home) {
  const rec=record(home.id), layout=layoutEvidence(home,rec), cost=costs(home,rec,prefs);
  return `<article class="home-card scan-card" data-home="${esc(home.id)}"><div class="scan-identity"><p class="neighborhood">${esc(homeCity(home) || home.neighborhood)}</p><h3>${esc(home.title)}</h3><p class="plan-label">${esc(planLabel(home))}</p><p class="address">${esc(home.address)}</p><p class="meta">${esc(layout.label)} · ${home.sqft ? home.sqft + " sq ft reported" : "Size unverified"}</p></div><div class="scan-price"><strong>${money(displayPrice(home))}<small> / mo</small></strong><p class="price-kind">${esc(priceKind(home))}</p><p class="meta">Known subtotal: ${subtotalValue(cost)}</p>${costGap(home, cost)}<p class="meta">${evidence(home)} · ${esc(dateLabel(home.observed_at))}${home.seen_in_latest === false ? " · Not in last area scan" : ""}</p></div><div class="scan-actions"><button class="button small secondary" data-detail="${esc(home.id)}">Details</button><button class="save-button" data-save="${esc(home.id)}" aria-label="${rec.saved ? "Remove" : "Save"} ${esc(home.title)} ${esc(planLabel(home))}" aria-pressed="${!!rec.saved}">${heartIcon()}</button><label class="compare-label"><input type="checkbox" data-compare="${esc(home.id)}" ${comparison.has(home.id) ? "checked" : ""}>Compare</label></div></article>`;
}
// The decision core. Three finalists have to be tellable apart BEFORE the full
// comparison opens, so each carries the same four facts and its own count of
// what is unresolved; the line above them says what actually differs, using the
// comparison's own arithmetic (figureSpread) so the two cannot report the same
// numbers differently. No winner is named and nothing is scored.
function finalistDifference(finalists) {
  if (finalists.length < 2) return "";
  const rents = figureSpread(finalists.map((home) => ({ name: home.title, value: costs(home, record(home.id), prefs).rent })));
  const sizes = figureSpread(finalists.map((home) => ({ name: home.title, value: Number.isFinite(home.sqft) && home.sqft > 0 ? home.sqft : null })));
  const line = (label, result, format) =>
    result.reason === "missing"
      ? `${label}: ${unreported("not comparable")} — ${esc(result.missing.join(", "))} ${result.missing.length === 1 ? "has" : "have"} no recorded figure.`
      : result.reason === "same"
        ? `${label}: the same for all ${finalists.length}.`
        : `${label}: ${esc(format(result.delta))} between the lowest and the highest.`;
  return `<p class="finalist-difference">${line("Base rent", rents, money)} ${line("Reported space", sizes, (v) => Math.round(v) + " sq ft")} Nothing here is ranked.</p>`;
}
function finalistShelf(saved, groups) {
  const finalists = groups.finalists;
  const open = (home) => openQuestions(home, record(home.id), prefs).length;
  // Empty capacity is a prompt, not a panel: it names the contenders a press
  // away rather than drawing an empty slot for each.
  const room = 3 - finalists.length;
  const candidates = groups.contenders.filter((home) => !record(home.id).finalist).slice(0, 3);
  return `<section class="finalist-shelf${finalists.length ? "" : " is-empty"}" aria-label="Your finalists"><div class="finalist-heading"><div><p class="eyebrow">THE FINAL THREE</p><h3>${finalists.length ? "Your strongest maybes." : "Narrow it to three."}</h3></div><span>${finalists.length}/3 pinned</span></div>${finalists.length ? `${finalistDifference(finalists)}<div class="finalist-grid">${finalists.map((home, i) => {
    const rec = record(home.id), cost = costs(home, rec, prefs), unresolved = open(home);
    return `<article><div class="finalist-top"><span class="finalist-number">0${i + 1}</span><div><h4>${esc(home.title)}</h4><p>${esc(planLabel(home))}</p></div></div><p class="finalist-rent"><strong>${money(displayPrice(home))}</strong><span>${esc(priceKind(home))}</span></p><dl class="finalist-facts"><div data-fact="wide"><dt>Known subtotal</dt><dd>${subtotalValue(cost)}</dd></div><div data-fact="wide"><dt>Layout</dt><dd>${esc(layoutEvidence(home, rec).label)}</dd></div><div data-fact="always"><dt>Unresolved</dt><dd>${unresolved ? `${unresolved} open` : "none on record"}</dd></div></dl><div class="actions"><button class="button small secondary" data-detail="${esc(home.id)}">Open</button><button class="text-button" data-finalist="${esc(home.id)}" aria-label="Unpin ${esc(home.title)} ${esc(planLabel(home))}">Unpin</button></div></article>`;
  }).join("")}</div><div class="finalist-foot"><button class="button" id="compare-finalists" ${finalists.length < 2 ? "disabled" : ""}>Compare finalists</button>${room ? `<p class="meta">Room for ${room} more.${candidates.length ? " Pin " + candidates.map((home) => `<button class="text-button" data-finalist="${esc(home.id)}">${esc(home.title)} · ${esc(planLabel(home))}</button>`).join(" or ") + "." : ""}</p>` : '<p class="meta">Three pinned. Unpin one to swap it.</p>'}</div>` : `<p>Pin up to three saved apartments to compare them directly.${candidates.length ? " Start with " + candidates.map((home) => `<button class="text-button" data-finalist="${esc(home.id)}">${esc(home.title)} · ${esc(planLabel(home))}</button>`).join(" or ") + "." : " Save a home first."}</p>`}</section>`;
}
function bindFinalists() {
  document.querySelectorAll("[data-finalist]").forEach((button)=>{button.onclick=()=>{
    const id=button.dataset.finalist, rec=record(id), next=!rec.finalist;
    if(next && Object.values(state.records).filter((r)=>r.finalist).length>=3){toast("Three finalists are pinned. Unpin one before adding another.");return;}
    state.records[id]={...rec,saved:true,finalist:next,snapshot:getHome(id),scan:savedScan(id,getHome(id))};
    event(id,next ? "Pinned as a finalist." : "Unpinned finalist.");const ok=persist();render();focusHomeControl(id,"finalist");saveNotice(ok);
  };});
  if($("#compare-finalists")) $("#compare-finalists").onclick=()=>{comparison=new Set(allHomes().filter((home)=>record(home.id).saved && record(home.id).finalist).map((home)=>home.id));renderTray();showCompare();};
}
function renderTourAgenda(saved) {
  const undated=saved.filter((home)=>record(home.id).status!=="ruled out" && record(home.id).tourDate && !chicagoTime(record(home.id).tourDate));
  const entries=tourAgenda(saved,state.records), upcoming=entries.filter((entry)=>!entry.past), past=entries.filter((entry)=>entry.past).reverse();
  const rows=(tours)=>tours.map(({home,at,record:rec})=>`<article class="agenda-row"><time datetime="${esc(at)}"><strong>${esc(dateLabel(at.slice(0,10)))}</strong><span>${esc(at.slice(11))} · Chicago</span></time><div><h4>${esc(home.title)}</h4><p>${esc(planLabel(home))}</p><p class="meta">${esc(home.address)} · ${tourProgress(rec)}/${tourChecks.length} tour checks</p><div class="actions"><button class="button small secondary" data-tour="${esc(home.id)}">Open tour notes</button><button class="text-button" data-calendar="${esc(home.id)}">Save to calendar</button>${link("https://www.google.com/maps/dir/?api=1&destination="+encodeURIComponent(home.address),"Directions ↗","text-button")}</div></div></article>`).join("");
  return `<details class="tour-agenda"><summary>Tour agenda <span>${upcoming.length} upcoming · Chicago time</span></summary><p class="meta">Your recorded appointments; confirm them with leasing. Ruled-out and unsaved homes are omitted.</p>${undated.length ? `<div class="callout">${undated.length} saved tour date${undated.length===1 ? " needs" : "s need"} a complete date and time.${undated.map((home)=>`<button class="text-button" data-detail="${esc(home.id)}">Update ${esc(home.title)} · ${esc(planLabel(home))}</button>`).join("")}</div>` : ""}${upcoming.length ? rows(upcoming) : '<p>No upcoming tour dates saved. Open a home’s notes to add one.</p>'}${past.length ? `<details class="past-tours"><summary>Past dates (${past.length})</summary>${rows(past)}</details>` : ""}</details>`;
}
function detailDock() {
  return `<nav class="detail-dock" aria-label="Apartment sections"><div>${[["layoutReview","Layout"],["detail-costs","Costs"],["tour-draft-count","Tour"],["notes","Notes"],["detail-history","History"],["detail-sources","Sources"]].map(([target,label])=>`<button type="button" data-detail-jump="${target}">${label}</button>`).join("")}</div><button class="button small" type="submit" form="record-form">Save changes</button></nav>`;
}
function openJump() {
  if(document.querySelector("dialog[open]")) return;
  $("#jump-search").value="";renderJumpResults();$("#jump-dialog").showModal();$("#jump-search").focus();
}
function renderJumpResults() {
  const query=$("#jump-search").value.trim().toLowerCase();
  const screens=[["discover","Discover apartments"],["studio","Decision Studio: recipe, trade-offs, areas, price pulse & next moves"],["shortlist","Shortlist, finalists & tours"],["lab","Cost Lab"],["timeline","Activity"],["setup","Sources & setup"]].filter(([,label])=>label.toLowerCase().includes(query));
  const matches=allHomes().filter((home)=>`${home.title} ${home.address} ${homeCity(home)} ${planLabel(home)}`.toLowerCase().includes(query));
  const homes=(query ? matches : matches.filter((home)=>record(home.id).saved)).slice(0,12);
  $("#jump-count").textContent=query ? `${matches.length} apartment matches · showing ${homes.length}` : "Jump to a screen or a saved apartment. Type to search every home.";
  $("#jump-results").innerHTML=`${screens.length ? `<div class="jump-screens">${screens.map(([screen,label])=>`<button data-jump-view="${screen}">${esc(label)}</button>`).join("")}</div>` : ""}<div class="jump-homes">${homes.map((home)=>`<button data-jump-home="${esc(home.id)}"><span><strong>${esc(home.title)}</strong><small>${esc(planLabel(home))} · ${esc(homeCity(home))}</small><small>${esc(layoutEvidence(home,record(home.id)).label)}</small></span><span>${money(displayPrice(home))}<small>${esc(priceKind(home))}</small></span></button>`).join("")}</div>${!screens.length && !homes.length ? '<p>No matches. Try a shorter building name, a plan or a city.</p>' : ""}`;
  document.querySelectorAll("[data-jump-view]").forEach((button)=>{button.onclick=()=>{$("#jump-dialog").close();view=button.dataset.jumpView;render();$("#view-title").tabIndex=-1;$("#view-title").focus();$("#workspace").scrollIntoView?.({block:"start"});};});
  document.querySelectorAll("[data-jump-home]").forEach((button)=>{button.onclick=()=>{$("#jump-dialog").close();$("#open-jump").focus();showDetail(button.dataset.jumpHome);};});
}
$("#open-jump").onclick=openJump;
$("#close-jump").onclick=()=>{$("#jump-dialog").close();$("#open-jump").focus();};
$("#jump-search").oninput=renderJumpResults;
$("#jump-search").onkeydown=(event)=>{if(event.key==="ArrowDown"){event.preventDefault();$("#jump-results button")?.focus();}if(event.key==="Enter"){event.preventDefault();$("#jump-results button")?.click();}};
$("#jump-results").onkeydown=(event)=>{if(!["ArrowDown","ArrowUp"].includes(event.key))return;const buttons=[...document.querySelectorAll("#jump-results button")],index=buttons.indexOf(document.activeElement);event.preventDefault();if(event.key==="ArrowUp" && index<=0)$("#jump-search").focus();else buttons[Math.min(buttons.length-1,Math.max(0,index+(event.key==="ArrowDown"?1:-1)))]?.focus();};
document.addEventListener("keydown",(event)=>{if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==="k" && !event.altKey && !document.querySelector("dialog[open]")){event.preventDefault();openJump();}});

function renderSpicyPicks() {
  const el=$("#spicy-picks");if(!el)return;
  el.hidden=!["split","list"].includes(prefs.surface);
  if(el.hidden){el.replaceChildren();return;}
  const result=spicyPicks(allHomes(),state,prefs,feed,pickLens);
  const label=pickLenses.find(([key])=>key===pickLens)?.[1] ?? "Best fit";
  el.innerHTML=`<div class="picks-heading"><div><h3 id="picks-title">Spicy<span>Picks</span></h3></div><span class="picks-count">${result.picks.length} picks · ${result.eligible} eligible</span></div><div class="sc-field sc-field--group picks-lens-group"><span class="sc-field__label" id="picks-lens-caption">priority</span><div class="picks-lenses" role="group" aria-labelledby="picks-lens-caption">${pickLenses.map(([key,text])=>`<button data-pick-lens="${key}" aria-pressed="${pickLens===key}">${text}</button>`).join("")}</div></div><p class="meta picks-scope">${esc(label)} within your current filters. One option per approximate building location. ${pickLens==="rail" ? "CTA reference only; suburban Metra and walking routes are not assessed." : "More info can change a recommendation; these are research picks, not confirmed available units."}</p>${result.picks.length ? `<div class="picks-grid">${result.picks.map((pick,i)=>pickCard(pick,i)).join("")}</div>` : empty("No supported picks in this view yet.",pickLens==="rail" && !result.ctaAvailable ? "The CTA reference is missing or older than 30 days. Try another priority; all apartments remain below." : "Try another priority or loosen a filter. Picks need a recent source, a positive base rent and a supported layout or reported size; we do not promote unknown prices as bargains.")} ${result.leads.length ? `<details class="pick-leads"><summary>Promising, but needs a base-rent quote (${result.leads.length})</summary><p class="meta">These advertised prices are not comparable base rents. They are outside the ranked picks; confirm the exact layout, full costs and current availability.</p><div class="pick-lead-grid">${result.leads.map((home)=>`<article><h4>${esc(home.title)}</h4><p>${esc(planLabel(home))} · ${esc(homeCity(home))}</p><p class="meta">${esc(layoutEvidence(home,record(home.id)).label)}</p><strong>${money(home.advertised_price)} advertised / mo</strong><p class="meta">${esc(priceKind(home))}</p><p class="meta">${home.charging?.status==="yes" ? "Resident EV charging advertised" : "Resident parking advertised"} · Observed ${esc(dateLabel(home.observed_at))}</p><button class="button secondary small" data-detail="${esc(home.id)}">Check this lead</button></article>`).join("")}</div></details>` : ""}<details class="picks-method"><summary>How SpicyPicks decides</summary><p>Rankings combine room below your cap after known monthly costs, local price comparisons, reported size, advertised parking/EV and layout/date evidence. Missing costs and old or undated quotes lower the rank. A low rent alone cannot establish quality.</p><dl class="pick-weights">${Object.entries(result.weights).filter(([,weight])=>weight>0).map(([key,weight])=>`<div><dt>${({budget:"Budget room",value:"Local price value",space:"Reported space",amenities:"Parking + EV",evidence:"Layout + cost evidence",rail:"CTA proximity"})[key]}</dt><dd>${weight}%</dd></div>`).join("")}</dl><p>Local value compares base rent per square foot: same city, bedroom/bath counts and source type, within 3 straight-line miles and ±20% of reported size. Quotes must be no older than seven days, with at least five other approximate locations. Each location contributes its median, then we compare those medians. This is a capped, uneven listing sample, not a market-wide estimate.</p><p>Space scoring uses reported size up to 1,000 sq ft for a 1-bedroom or 1,400 sq ft for a 2-bedroom; it is not a layout-quality judgment. Near CTA requires a loaded station within 0.5 straight-line miles and reference data no older than 30 days. It says nothing about walking routes, commute time, safety or neighborhood popularity.</p><p>Studios, layout conflicts, ruled-out homes, archived entries, records absent from their last area scan, and sources older than 30 days do not become picks. Unknown base rents stay in the research leads. Reviews are not scored: use the resident-review link to check the building and recent resident experiences yourself.</p></details>`;
  document.querySelectorAll("button[data-pick-lens]").forEach((button)=>{button.onclick=()=>{pickLens=button.dataset.pickLens;renderSpicyPicks();bindCards();$(`button[data-pick-lens="${pickLens}"]`)?.focus();};});
}
function pickCard(pick,index,lens=pickLens,priority=lens) {
  const {home,cost,layout}=pick,rec=record(home.id);
  const verdict=lens==="recipe" ? "My recipe" : lens==="ev" ? "EV lifestyle fit" : lens==="rail" ? "Close to CTA" : lens==="space" ? "Room for the money" : pick.saving!==null && pick.saving>=.05 ? "Local price signal" : lens==="budget" ? "Budget room" : "Balanced fit";
  const leading=priority==="ev" ? pick.reasons.filter((reason)=>/parking|charging/i.test(reason)) : priority==="rail" ? pick.reasons.filter((reason)=>/CTA station/.test(reason)) : priority==="space" ? pick.reasons.filter((reason)=>/reported sq ft/.test(reason)) : [];
  const reasons=[...new Set([...leading,...pick.reasons])].slice(0,3);
  const details=[...new Set([...pick.catches,"Reviews have not been assessed. Confirm the exact unit and current availability."])];
  return `<article class="pick-card" data-pick-home="${esc(home.id)}"><div class="pick-top"><span class="pick-badge">${String(index+1).padStart(2,"0")} / ${verdict}</span><button class="save-button" data-save="${esc(home.id)}" aria-label="${rec.saved ? "Remove" : "Save"} ${esc(home.title)} ${esc(planLabel(home))}" aria-pressed="${!!rec.saved}">${heartIcon()}</button></div><p class="neighborhood">${esc(homeCity(home))} · ${esc(home.neighborhood)}</p><h4>${esc(home.title)}</h4><p class="plan-label">${esc(planLabel(home))}</p><p class="meta">${esc(home.address)}</p><div class="pick-price"><strong>${money(cost.rent)}</strong><span>base rent / month</span></div><p class="price-kind">${esc(priceKind(home))}</p><p class="meta">${esc(layout.label)}</p><div class="pick-subtotal"><span>Known monthly subtotal</span><strong>${money(cost.known)}${cost.unknown.length ? "+" : ""}</strong></div>${cost.utilities!==null ? `<p class="meta">Includes your ${money(cost.utilities)} utility estimate.</p>` : ""}<details class="pick-analysis"><summary>Why this pick &amp; the catch</summary><div class="pick-reasons"><h5>Why this one</h5><ul>${reasons.map((reason)=>`<li>${esc(reason)}</li>`).join("")}</ul></div><div class="pick-catch"><h5>The catch</h5><p>${esc(details.slice(0,2).join(" "))}</p><details><summary>Full evidence &amp; caveats</summary><ul>${details.map((item)=>`<li>${esc(item)}</li>`).join("")}</ul><p>Source observed ${esc(dateLabel(home.observed_at))}. ${pick.quoted ? "Your base-rent quote: " + esc(dateLabel(pick.quoteDate)) + "." : ""}</p><p>${pick.saving!==null ? `${pick.peerCount} local comparison locations · median ${pick.peerMedian.toLocaleString("en-US",{style:"currency",currency:"USD",minimumFractionDigits:2,maximumFractionDigits:2})} base rent / sq ft. Differences may reflect condition, amenities or data errors.` : `No reliable local price comparison: ${pick.peerCount} matching locations or the quote needs refreshing. This pick is based on its other signals.`}</p>${pick.nearby ? `<p>CTA reference observed ${esc(dateLabel(feed.city_context?.cta?.updated_at))}. Approximate coordinates; confirm the walking route.</p>` : ""}</details></div></details><div class="pick-actions"><button class="button" data-detail="${esc(home.id)}">Explore this pick</button><label class="compare-label"><input type="checkbox" data-compare="${esc(home.id)}" ${comparison.has(home.id) ? "checked" : ""}>Compare</label>${link("https://www.google.com/maps/search/?api=1&query="+encodeURIComponent(home.title+" "+home.address),"Check resident reviews ↗","text-button")}</div></article>`;
}

let recipeBase=null;
const studioTabs=[['recipe','My recipe'],['trade','Trade-offs'],['areas','Area match'],['pulse','Price pulse'],['moves','Next moves']];
function renderStudio() {
  $('#view-content').innerHTML=`<section class="decision-studio"><div class="studio-top"><button class="text-button" data-go="discover">← Back to Discover</button><p class="meta">${money(prefs.min)}–${money(prefs.max)} · ${prefs.bedrooms==='all' ? '1 & 2 beds' : prefs.bedrooms+' bed'} · Your current search filters apply</p></div><nav class="studio-tabs" aria-label="Decision tools">${studioTabs.map(([key,label],i)=>`<button data-studio-tab="${key}" aria-pressed="${studio.tab===key}"><span>0${i+1}</span>${label}</button>`).join('')}</nav><div id="studio-panel"></div><div id="compare-tray"></div></section>`;
  document.querySelectorAll('button[data-studio-tab]').forEach(button=>{button.onclick=()=>{studio.tab=button.dataset.studioTab;renderStudioPanel();document.querySelectorAll('button[data-studio-tab]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.studioTab===studio.tab)));};});
  renderStudioPanel();
}
function renderStudioPanel() {
  if(studio.tab==='recipe')renderRecipe();
  if(studio.tab==='trade')renderTradeoffs();
  if(studio.tab==='areas')renderAreas();
  if(studio.tab==='pulse')renderPulse();
  if(studio.tab==='moves')renderNextMoves();
  bindContent();bindStudioTasks();renderTray();
}
function studioHeading(title,text) {return `<div class="studio-heading"><h3>${title}</h3><p>${text}</p></div>`;}
function studioHome(home,extra='') {
  const c=costs(home,record(home.id),prefs);
  return `<article class="studio-home"><div><h4>${esc(home.title)}</h4><p>${esc(planLabel(home))}</p><p class="meta">${esc(homeCity(home))} · ${esc(layoutEvidence(home,record(home.id)).label)}</p><strong>${c.rent===null ? 'Base rent needs a quote' : money(c.rent)+' base / mo'}</strong>${extra}</div><div class="actions"><button class="button small secondary" data-detail="${esc(home.id)}">Details</button><button class="save-button" data-save="${esc(home.id)}" aria-label="${record(home.id).saved ? 'Remove' : 'Save'} ${esc(home.title)} ${esc(planLabel(home))}" aria-pressed="${!!record(home.id).saved}">${heartIcon()}</button></div></article>`;
}
function renderRecipe() {
  recipeBase=spicyPicks(allHomes(),state,prefs,feed);
  $('#studio-panel').innerHTML=studioHeading('Your taste. Your top three.','Turn up what matters. The shortlist changes; the evidence stays visible.')+`<div class="recipe-presets" aria-label="Recipe starting points">${[['balanced','Start balanced'],['value','Value hunter'],['ev','EV first'],['space','Space seeker']].map(([key,label])=>`<button class="button secondary small" data-recipe-preset="${key}">${label}</button>`).join('')}</div><details class="recipe-controls"><summary>Mix my own priorities <span>0 = ignore · 5 = highest priority</span></summary><div class="recipe-sliders">${Object.entries(recipeLabels).map(([key,label])=>`<div><label for="recipe-${key}">${label}<output id="recipe-value-${key}" for="recipe-${key}">${studio.recipe[key]}</output></label><input id="recipe-${key}" data-recipe="${key}" type="range" min="0" max="5" step="1" value="${studio.recipe[key]}"></div>`).join('')}</div><p class="meta">Your mix stays in this tab. Priorities change ranking; the parking and EV filters in Discover enforce requirements. All zeroes uses the balanced mix.</p></details><p id="recipe-result-status" role="status" class="meta"></p><div id="recipe-results"></div>`;
  document.querySelectorAll('[data-recipe]').forEach(input=>{input.oninput=()=>{studio.recipe[input.dataset.recipe]=Number(input.value);$('#recipe-value-'+input.dataset.recipe).textContent=input.value;renderRecipeResults();};});
  document.querySelectorAll('[data-recipe-preset]').forEach(button=>{button.onclick=()=>{studio.recipe=({...({balanced:recipeDefaults,value:{budget:5,value:5,space:1,amenities:1,rail:0,evidence:3},ev:{budget:2,value:1,space:1,amenities:5,rail:0,evidence:3},space:{budget:2,value:2,space:5,amenities:1,rail:1,evidence:3}})[button.dataset.recipePreset]});renderRecipe();bindCards();$(`[data-recipe-preset="${button.dataset.recipePreset}"]`)?.focus();};});
  renderRecipeResults();
}
function renderRecipeResults() {
  const result=remixPicks(recipeBase,studio.recipe);
  const priority=Object.entries(result.weights).sort((a,b)=>b[1]-a[1])[0]?.[0],leading=({amenities:'ev',rail:'rail',space:'space'})[priority] ?? 'recipe';
  $('#recipe-result-status').textContent=result.picks.length ? `${result.picks[0].home.title} leads this mix · ${result.eligible} eligible options.` : 'No supported priced picks in the current filters.';
  $('#recipe-results').innerHTML=`${result.weights.rail>0 && !result.ctaAvailable ? '<p class="meta">The CTA reference is unavailable or out of date; that priority cannot distinguish these homes yet.</p>' : ''}<div class="recipe-mix" aria-label="Ranking weights">${Object.entries(result.weights).filter(([,weight])=>weight>0).map(([key,weight])=>`<span>${recipeLabels[key]} <strong>${Math.round(weight)}%</strong></span>`).join('')}</div>${result.picks.length ? `<div class="recipe-result-grid"><div>${pickCard(result.picks[0],0,'recipe',leading)}</div><div class="recipe-runners"><h4>Also worth your time</h4>${result.picks.slice(1).map(pick=>studioHome(pick.home,`<p class="meta">${esc(pick.reasons[0] ?? 'Review the source and full costs.')}</p>`)).join('')}${result.picks.length===1 ? '<p>No second supported pick in this view.</p>' : ''}<div class="studio-note"><strong>Your mix explains the order.</strong><p>Missing costs and older quotes still reduce confidence. Local value needs five comparable locations. CTA is straight-line proximity; reviews and neighborhood popularity are not scored.</p></div></div></div>` : empty('Change a priority or widen your search.','Unknown base rents cannot become ranked bargains. Discover still includes the research leads.','<button class="button secondary" data-go="discover">Adjust search filters</button>')}`;
  bindContent();renderTray();
}
function renderTradeoffs() {
  const pool=decisionPool(allHomes(),state,prefs).filter(h=>costs(h,record(h.id),prefs).rent>0);
  if(!pool.some(h=>h.id===studio.anchor))studio.anchor=pool.find(h=>record(h.id).finalist)?.id ?? pool.find(h=>record(h.id).saved)?.id ?? spicyPicks(allHomes(),state,prefs,feed).picks[0]?.home.id ?? pool[0]?.id ?? null;
  $('#studio-panel').innerHTML=studioHeading('What would you trade?','Start with a place you like. Find a meaningful gain, with the cost and the compromise beside it.')+(pool.length ? `<div class="trade-controls"><div class="field"><label for="trade-anchor">Compare alternatives with</label><select id="trade-anchor">${pool.map(h=>`<option value="${esc(h.id)}" ${h.id===studio.anchor ? 'selected' : ''}>${esc(h.title)} · ${esc(planLabel(h))} · ${money(costs(h,record(h.id),prefs).rent)}</option>`).join('')}</select></div><div class="field"><label for="trade-extra">Extra base rent I would consider: <output id="trade-extra-value">${money(studio.extra)}/mo</output></label><input id="trade-extra" type="range" min="0" max="500" step="50" value="${studio.extra}"><p class="meta">Above this apartment’s base rent, within your current search cap.</p></div></div><div id="trade-results"></div><p class="studio-method">Same source type and bedroom/bath count, dated quotes within seven days. Saving rent requires at least 85% of this home’s reported size; more space means at least 100 extra sq ft. Fees, location, condition and amenities can change the trade-off. Results use your active filters and distinct approximate locations.</p>` : empty('Choose a priced place first.','The current filters have no recent positive base-rent options. Try Discover’s research leads for a quote.','<button class="button secondary" data-go="discover">Open Discover</button>'));
  if(!pool.length)return;
  $('#trade-anchor').onchange=()=>{studio.anchor=$('#trade-anchor').value;renderTradeResults();};
  $('#trade-extra').oninput=()=>{studio.extra=Number($('#trade-extra').value);$('#trade-extra-value').textContent=money(studio.extra)+'/mo';renderTradeResults();};renderTradeResults();
}
function renderTradeResults() {
  const anchor=getHome(studio.anchor),options=apartmentTradeoffs(anchor,allHomes(),state,prefs,studio.extra);
  $('#trade-results').innerHTML=`<div class="trade-anchor">Your starting point: <strong>${esc(anchor.title)}</strong> · ${esc(planLabel(anchor))} · ${money(costs(anchor,record(anchor.id),prefs).rent)} base${anchor.sqft ? ' · '+anchor.sqft+' reported sq ft' : ''}</div>${options.length ? `<div class="trade-grid">${options.map(option=>`<article class="trade-option"><span class="pick-badge">${option.label}</span><h4>${esc(option.home.title)}</h4><p>${esc(planLabel(option.home))}</p><p class="meta">${esc(option.home.address)}</p><div class="trade-deltas"><strong>${option.rentDelta===0 ? 'Same base rent' : `${money(Math.abs(option.rentDelta))} ${option.rentDelta<0 ? 'less' : 'more'} base / mo`}</strong><span>${option.spaceDelta===null ? 'Size comparison unavailable' : `${Math.abs(option.spaceDelta)} sq ft ${option.spaceDelta<0 ? 'less' : 'more'}`}</span></div><p class="meta">${money(option.cost.rent)} base / mo · ${money(option.cost.known)} known subtotal${option.cost.unknown.length ? ' + unquoted items' : ''}</p><h5>The trade-off</h5><ul>${option.catches.map(text=>`<li>${esc(text)}</li>`).join('')}</ul><div class="actions"><button class="button secondary" data-trade-compare="${esc(option.home.id)}">Compare these two</button><button class="text-button" data-detail="${esc(option.home.id)}">Open alternative</button></div></article>`).join('')}</div>` : empty('No supported upgrade at this setting.','Try another starting apartment or allow more base rent. If its quote is older than seven days, request a fresh one. A missing result does not mean the apartment is the best on the market.')}`;
  document.querySelectorAll('[data-trade-compare]').forEach(button=>{button.onclick=()=>{comparison=new Set([studio.anchor,button.dataset.tradeCompare]);renderTray();showCompare();};});bindCards();
}
function renderAreas() {
  const areas=areaMatch(allHomes(),state,prefs,studio.bedrooms,studio.areaScope);
  studio.areas=studio.areas.filter(name=>areas.some(area=>area.label===name));
  for(const area of areas)if(studio.areas.length<2 && !studio.areas.includes(area.label))studio.areas.push(area.label);
  $('#studio-panel').innerHTML=studioHeading('Two areas. One honest comparison.','See what the loaded homes actually offer, without turning sparse research into a neighborhood rating.')+`<div class="area-match-controls"><div class="field"><label for="area-match-beds">Compare the same bedroom size</label><select id="area-match-beds"><option value="1" ${studio.bedrooms==='1' ? 'selected' : ''}>1 bedroom</option><option value="2" ${studio.bedrooms==='2' ? 'selected' : ''}>2 bedrooms</option></select></div><div class="field"><label for="area-match-scope">Group homes by</label><select id="area-match-scope"><option value="cities" ${studio.areaScope==='cities' ? 'selected' : ''}>Chicago and suburbs</option><option value="neighborhoods" ${studio.areaScope==='neighborhoods' ? 'selected' : ''}>Chicago neighborhoods and suburbs</option></select></div>${[0,1].map(i=>`<div class="field"><label for="area-choice-${i}">Area ${i+1}</label><select id="area-choice-${i}" ${areas.length<2 && i===1 ? 'disabled' : ''}>${areas.map(area=>`<option value="${esc(area.label)}" ${area.label===studio.areas[i] ? 'selected' : ''}>${esc(area.label)} · ${area.locations} locations</option>`).join('')}</select></div>`).join('')}</div><p class="meta">Uses the bedroom choice above and your other search filters. Named neighborhoods come from the source; unspecified areas stay labeled that way.</p><div id="area-match-results"></div>`;
  $('#area-match-beds').onchange=()=>{studio.bedrooms=$('#area-match-beds').value;studio.areas=[];renderAreas();$('#area-match-beds').focus();};
  $('#area-match-scope').onchange=()=>{studio.areaScope=$('#area-match-scope').value;studio.areas=[];renderAreas();$('#area-match-scope').focus();};
  [0,1].forEach(i=>{$('#area-choice-'+i).onchange=()=>{const value=$('#area-choice-'+i).value,old=studio.areas[i];if(studio.areas[1-i]===value)studio.areas[1-i]=old;studio.areas[i]=value;[0,1].forEach(j=>{if(studio.areas[j])$('#area-choice-'+j).value=studio.areas[j];});renderAreaResults(areas);};});renderAreaResults(areas);
}
function renderAreaResults(areas) {
  const selected=studio.areas.map(name=>areas.find(a=>a.label===name)).filter(Boolean);
  $('#area-match-results').innerHTML=selected.length ? `<div class="area-faceoff">${selected.map(area=>`<article class="area-profile"><p class="eyebrow">${area.locations} APPROXIMATE LOCATIONS</p><h4>${esc(area.label)}</h4><p>${area.homes.length} matching plans · ${area.unknownRent} need base-rent quotes</p><div class="area-evidence-bars">${[['Resident parking advertised',area.parking],['Resident EV advertised',area.ev]].map(([label,count])=>`<div><span>${label}<strong>${count}/${area.locations}</strong></span><progress max="${area.locations}" value="${count}" aria-label="${label}: ${count} of ${area.locations} locations"></progress></div>`).join('')}</div><div class="area-cohorts">${Object.entries(area.cohorts).filter(([,cohort])=>cohort.count).map(([kind,cohort])=>`<div><span>${({listing:'Provider units',building:'Researched building plans',manual:'Your added places'})[kind]}</span><strong>${cohort.median!==null ? money(cohort.median)+' sample median base / mo' : cohort.min===cohort.max ? money(cohort.min)+' quoted base / mo' : money(cohort.min)+'–'+money(cohort.max)+' quoted base / mo'}</strong><small>${cohort.count} locations with quotes dated within seven days${cohort.count<3 ? ' · too few for a median' : ''}</small></div>`).join('') || '<p>Fresh base-rent comparisons are not available yet.</p>'}</div><p class="meta">${area.unverifiedLayouts} layouts need stronger evidence. Counts reflect advertisements, not confirmed access or available units.</p><details class="area-options"><summary>Explore these options (${area.homes.length})</summary>${area.homes.slice(0,8).map(h=>studioHome(h)).join('')}${area.homes.length>8 ? `<p class="meta">Showing 8 of ${area.homes.length}; the full set remains in Discover.</p>` : ''}</details></article>`).join('')}</div><p class="studio-method">These are uneven, capped samples, not area-wide prices. Each approximate location contributes its median base rent; provider units and building plans stay separate. No safety, popularity, school or review score is inferred.</p>` : empty('No areas match this view.','Try the other bedroom size or adjust the filters in Discover.');bindCards();
}
function renderPulse() {
  const pulse=pricePulse(allHomes(),state,prefs,studio.savedOnly),shown=pulse.changes.filter(c=>studio.pulse==='drops' ? c.delta<0 : studio.pulse==='rises' ? c.delta>0 : true);
  $('#studio-panel').innerHTML=studioHeading('Catch the change. Keep the context.','Dated base-rent movements and quotes worth checking. Source prices and your personal quotes stay separate.')+`<div class="pulse-controls"><div class="segmented" aria-label="Price changes">${[['all','All changes'],['drops','Rent drops'],['rises','Rent rises']].map(([key,label])=>`<button data-pulse="${key}" aria-pressed="${studio.pulse===key}">${label}</button>`).join('')}</div><label><input type="checkbox" id="pulse-saved" ${studio.savedOnly ? 'checked' : ''}>Saved homes only</label></div><div class="pulse-stats"><div><strong>${pulse.changes.filter(c=>c.delta<0).length}</strong><span>recorded drops</span></div><div><strong>${pulse.baseline}</strong><span>need a second dated point</span></div><div><strong>${pulse.stale.length}</strong><span>quotes or availability to recheck</span></div></div>${shown.length ? `<div class="pulse-list">${shown.slice(0,12).map(change=>`<article class="pulse-row"><div class="pulse-delta ${change.delta<0 ? 'drop' : ''}"><strong>${change.delta<0 ? '−' : '+'}${money(Math.abs(change.delta))}</strong><span>${Math.abs(change.percent).toFixed(1)}% ${change.delta<0 ? 'lower' : 'higher'} base</span></div><div><h4>${esc(change.home.title)}</h4><p>${esc(planLabel(change.home))}</p><p>${money(change.prior.rent)} on ${esc(dateLabel(change.prior.date))} → ${money(change.latest.rent)} on ${esc(dateLabel(change.latest.date))}</p><p class="meta">${change.kind==='source' ? 'Source observations' : 'Your recorded quotes'} · Last observation ${esc(dateLabel(change.lastObserved))}${change.stale ? ' · historical or availability needs rechecking' : ''} · Compare lease terms and fees.</p></div><button class="button secondary" data-studio-task="${esc(change.home.id)}" data-task-target="detail-history">Inspect history</button></article>`).join('')}</div>${shown.length>12 ? `<p class="meta">Showing the 12 most recent of ${shown.length} matching changes.</p>` : ''}` : empty(studio.pulse==='all' ? 'No measured price changes yet.' : 'No matching price changes.','The first dated observations form your baseline. A change appears after another dated base-rent observation; checking for updates loads the latest available snapshot.')}<details class="pulse-recheck"><summary>Quotes &amp; availability to recheck (${pulse.stale.length})</summary>${pulse.stale.slice(0,8).map(home=>studioHome(home,`<p class="meta">Source observed ${esc(dateLabel(home.observed_at))}${home.seen_in_latest===false || home.notebook_only ? ' · absent from the current scan' : ''}</p><button class="text-button" data-studio-task="${esc(home.id)}" data-task-target="leasing-draft">Prepare quote questions</button>`)).join('') || '<p>The current quotes are dated within seven days. Confirm the exact unit and complete costs.</p>'}${pulse.stale.length>8 ? `<p class="meta">Showing 8 of ${pulse.stale.length}; use Saved homes only or your Discover filters to narrow the list.</p>` : ''}</details><p class="studio-method">Shows the most recent recorded change in each series, using valid positive base rents. Unchanged scans retain the original change date. Conflicting prices at the same timestamp are excluded. No background alerts or provider requests are started by this screen.</p>`;
  document.querySelectorAll('button[data-pulse]').forEach(button=>{button.onclick=()=>{studio.pulse=button.dataset.pulse;renderPulse();$(`[data-pulse="${studio.pulse}"]`).focus();};});
  $('#pulse-saved').onchange=()=>{studio.savedOnly=$('#pulse-saved').checked;renderPulse();$('#pulse-saved').focus();};bindCards();bindStudioTasks();
}
function renderNextMoves() {
  const moves=nextMoves(allHomes(),state,prefs),suggestions=moves.length ? [] : spicyPicks(allHomes(),state,prefs,feed).picks;
  $('#studio-panel').innerHTML=studioHeading('Just the next three moves.','One useful step per saved home. Finish a check, save your notes, and the next step updates.')+(moves.length ? `<div class="next-moves">${moves.map((move,i)=>`<article class="next-move"><span class="move-number">0${i+1}</span><div><p class="eyebrow">${move.finalist ? 'YOUR FINALIST' : 'YOUR SHORTLIST'} · ${move.reviewed}/${tourChecks.length} tour checks reviewed</p><h4>${move.title}</h4><strong>${esc(move.home.title)} · ${esc(planLabel(move.home))}</strong><p>${esc(move.why)}</p><button class="button" data-studio-task="${esc(move.home.id)}" data-task-target="${move.target}">${esc(MOVE_ACTIONS[move.target] ?? 'Open this record')}</button></div></article>`).join('')}</div><p class="studio-method">Uses all saved homes, regardless of Discover filters. Tours within seven days come first, then layout checks, missing or old quotes, remaining tour checks and a decision note. Finalists get preference within those steps. Nothing is sent or booked.</p>` : `<div class="studio-note"><strong>Start by saving a place you would actually consider.</strong><p>Your next moves will use its layout evidence, quotes and tour notes.</p></div>${suggestions.map(pick=>studioHome(pick.home)).join('') || '<button class="button secondary" data-go="discover">Find a place in Discover</button>'}`);
  bindCards();bindStudioTasks();
}
function bindStudioTasks() {
  document.querySelectorAll('[data-studio-task]').forEach(button=>{button.onclick=()=>{
    // The record opens over whatever asked for it; a comparison sheet that
    // stayed open would leave two modals and no way back to the right one.
    document.querySelectorAll('dialog[open]').forEach(dialog=>{if(dialog.id!=='detail-dialog')dialog.close();});
    showDetail(button.dataset.studioTask);const target=document.getElementById(button.dataset.taskTarget);if(!target)return;const disclosure=target.closest('details');if(disclosure)disclosure.open=true;if(!target.hasAttribute('tabindex') && !/^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(target.tagName))target.tabIndex=-1;target.focus({preventScroll:true});target.scrollIntoView?.({block:'start'});};});
}

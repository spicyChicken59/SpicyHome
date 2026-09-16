export const VERSION = 1;
export const defaults = {
  min: 1200,
  max: 3000,
  basis: "rent",
  neighborhood: "all",
  charging: false,
  parking: false,
  unknown: true,
  sort: "rent",
  search: "",
  utilityEstimate: null,
  layoutScope: "all",
  region: "all",
  radiusMiles: 0,
  bedrooms: "all",
  targetRent: null,
  urbanScope: "all",
  highRise: false,
  parkingPreferred: false,
  surface: "split",
  density: "cards",
};
export const tourChecks = [
  ["layout", "Walk the exact layout", "Check bedroom doors, dimensions and where your furniture fits."],
  ["light", "Check the light", "Look at windows, daylight and the view from the actual unit."],
  ["noise", "Listen with windows closed", "Check street, hallway, neighbor and mechanical noise."],
  ["parking", "Walk the parking route", "Confirm the space, monthly price, clearance and route indoors."],
  ["charging", "Inspect the charger", "Confirm connector, access, pricing, shared use and any waitlist."],
  ["access", "Try the everyday route", "Check steps, elevators, doors, laundry and the trip with groceries."],
  ["condition", "Test the basics", "Look at storage, appliances, water pressure and heating/cooling."],
  ["lease", "Review the full quote", "Check lease term, move-in date, deposits and every recurring fee."],
];
export function tourProgress(record = {}) {
  return tourChecks.filter(([key]) => record.tourChecks?.[key] === true).length;
}
export function chicagoTime(value) {
  if (value == null || value === "") return null;
  if (typeof value === "string" && !/T\d{2}:\d{2}/.test(value)) return null;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(value)) return Number.isFinite(Date.parse(value)) ? value.slice(0,16) : null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US",{timeZone:"America/Chicago",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(date).map((part)=>[part.type,part.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}
export function tourAgenda(homes, records, now = new Date()) {
  const clock = chicagoTime(now);
  return homes.flatMap((home) => {
    const rec = records[home.id] ?? {}, at = rec.tourDate ? chicagoTime(rec.tourDate) : null;
    return rec.saved && rec.status !== "ruled out" && at ? [{home,at,past:at < clock,record:rec}] : [];
  }).sort((a,b)=>a.at.localeCompare(b.at));
}
export const scenarioFields = [
  ["rent", "Base rent"], ["parking", "Parking"], ["fees", "Recurring fees"],
  ["utilities", "Utilities"], ["charging", "EV charging"],
];
export function costScenario(home, record = {}, assumptions = {}, months = 12) {
  const known = costs(home, record, { ...defaults, utilityEstimate: null });
  const items = scenarioFields.map(([key, label]) => {
    const assumed = amount(assumptions[key]);
    return { key, label, value: assumed ?? (key === "charging" ? null : known[key]), assumed: assumed !== null };
  });
  const missing = items.filter((item) => item.value === null).map((item) => item.label);
  const subtotal = items.reduce((sum, item) => sum + (item.value ?? 0), 0);
  const hasRent = items[0].value !== null;
  const term = Number.isInteger(months) && months >= 1 && months <= 36 ? months : 12;
  return { items, missing, subtotal, monthly: hasRent ? subtotal : null, term, termTotal: hasRent ? subtotal * term : null, complete: !missing.length };
}
export const moveInFields = [
  ["deposit", "Refundable deposit"], ["oneTime", "Nonrefundable one-time fees"],
  ["moving", "Moving costs"], ["prepaid", "Extra prepaid rent beyond month one"],
];
export function moveInScenario(home, record = {}, monthly, assumptions = {}) {
  const items = moveInFields.map(([key, label]) => {
    const assumed = amount(assumptions[key]);
    return { key, label, value: assumed ?? (key === "oneTime" ? costs(home, record).upfront : null), assumed: assumed !== null };
  });
  const missing = [...monthly.missing, ...items.filter((item) => item.value === null).map((item) => item.label)];
  return { items, missing, complete: !missing.length, total: monthly.monthly === null ? null : monthly.monthly + items.reduce((sum, item) => sum + (item.value ?? 0), 0) };
}
export function atlasPoints(homes, records = {}) {
  return homes.flatMap((home) => {
    const rent = costs(home, records[home.id]).rent;
    return rent !== null && Number.isFinite(home.sqft) && home.sqft > 0
      ? [{ home, rent, sqft: home.sqft, perFoot: rent / home.sqft, bedrooms: layoutEvidence(home, records[home.id]).bedrooms }]
      : [];
  });
}
export function leasingQuestions(home, record = {}, now = new Date()) {
  const layout = layoutEvidence(home, record), c = costs(home, record, defaults);
  const exactMoney = (value) => value.toLocaleString("en-US", {style:"currency", currency:"USD", minimumFractionDigits: value % 1 ? 2 : 0, maximumFractionDigits:2});
  const questions = ["Is this exact unit or floor plan available for my move-in date, and for which lease lengths?"];
  if (layout.status !== "confirmed") questions.push("Can you send the exact floor plan and confirm the number of enclosed bedrooms and bathrooms? I want to rule out a studio or convertible.");
  if (c.rent === null) questions.push("What is the base rent before concessions? Please separate it from any advertised monthly total.");
  else questions.push(`Is the ${exactMoney(c.rent)} base rent still current for this exact unit? What concessions or lease conditions apply?`);
  if (c.parking === null) questions.push("Is a resident parking space available, and what is its monthly cost?");
  else questions.push(`Can you confirm a resident parking space and the ${exactMoney(c.parking)} monthly parking amount?`);
  questions.push("Is resident EV charging available now? Please confirm connector, access rules, waitlist, charging fees and whether those fees overlap parking or utilities.");
  if (c.fees === null || c.utilities === null) questions.push("Please itemize every recurring fee and utility charge, including anything billed separately or based on usage.");
  questions.push("What deposits, nonrefundable fees and prepaid rent are required, and when is each due?");
  if (home.access?.status !== "yes" || !record.tourChecks?.access) questions.push("Can you confirm the step-free route from the street and garage to this unit, including elevator access?");
  const quoteDate = amount(record.rentOverride) !== null ? record.quoteDate : home.observed_at;
  if (ageDays(quoteDate, now) === null || ageDays(quoteDate, now) > 7) questions.push("Please provide a fresh, dated written quote with its expiration date.");
  return questions;
}
// Keep the original one_bed review's exact 1/1 meaning in existing notebooks.
export const checkedLayouts = {
  one_bed: [1, 1],
  one_bed_one_half_bath: [1, 1.5],
  one_bed_two_bath: [1, 2],
  two_bed_one_bath: [2, 1],
  two_bed_one_half_bath: [2, 1.5],
  two_bed_two_bath: [2, 2],
};
export const searchCenter = { lat: 41.882, lng: -87.632 };
export const suburbCities = ["Evanston", "Oak Park", "Park Ridge", "Elmhurst", "Downers Grove", "Arlington Heights", "Naperville"];
export function scanBedroomScope(provider, city) {
  const scan = provider?.area_scans?.[city];
  if (!scan) return "First listing scan pending · will include 1 & 2 bedrooms";
  const query = scan.query ?? (provider.query?.city === city ? provider.query : null);
  const value = query?.bedrooms;
  const beds = Array.isArray(value) ? value : typeof value === "number" ? [value] : typeof value === "string" ? value.split("|").map(Number) : [];
  if (beds.length && beds.every((b) => b === 1)) return "1-bedroom scan · 2-bedroom listing coverage pending";
  if (beds.length && beds.every((b) => [1, 2].includes(b)) && beds.includes(1) && beds.includes(2)) return "Listing scan included 1 & 2 bedrooms";
  return "Bedroom coverage not recorded · next scan includes both sizes";
}
export function homeCity(home) {
  const match = home.address?.match(/,\s*([^,]+),\s*IL\b/i);
  const candidate = home.city?.trim() || match?.[1]?.trim() || (/,\s*Chicago\s*$/i.test(home.address ?? "") ? "Chicago" : "");
  return ["Chicago", ...suburbCities].find((city) => city.toLowerCase() === candidate.toLowerCase()) ?? candidate;
}
export function layoutEvidence(home, record = {}) {
  const review = record.layoutReview;
  if (["studio", "other"].includes(review))
    return { status: review, label: review === "studio" ? "Marked by you: studio / convertible" : "You marked a different layout", matches: false };
  if (typeof review === "string" && Object.hasOwn(checkedLayouts, review)) {
    const [bedrooms, bathrooms] = checkedLayouts[review];
    return { status: "confirmed", label: `${bedrooms} bed · ${bathrooms} bath — checked by you`, matches: true, bedrooms, bathrooms };
  }
  if (home.bedrooms === 0 || home.layout_status === "studio")
    return { status: "studio", label: "Studio · excluded from 1–2 bedroom search", matches: false };
  if (home.layout_status === "conflict")
    return { status: "conflict", label: "Conflicting layout information", matches: false };
  if (home.layout_status === "other" || (home.bedrooms != null && ![1, 2].includes(home.bedrooms)) || (home.bathrooms != null && ![1, 1.5, 2].includes(home.bathrooms)))
    return { status: "other", label: "Different bed / bath layout", matches: false };
  const counts = { bedrooms: home.bedrooms ?? null, bathrooms: home.bathrooms ?? null };
  const label = `${counts.bedrooms ?? "?"} bed · ${counts.bathrooms ?? "?"} bath`;
  if (home.layout_status === "unverified" || home.bedrooms == null || home.bathrooms == null)
    return { status: "unverified", label: `Layout needs checking · ${label}`, matches: true, ...counts };
  if (home.kind === "building" && home.floor_plan && home.sources?.length && home.layout_status !== "unverified")
    return { status: "source_listed", label: `Source lists ${label}`, matches: true, ...counts };
  if (home.kind === "manual")
    return { status: "unverified", label: `${label} entered — not checked`, matches: true, ...counts };
  return { status: "provider_reported", label: `${label} reported — not checked`, matches: true, ...counts };
}
export function planLabel(home) {
  const unit = home.unit_label || home.address?.match(/\b(?:unit|apt|apartment|suite)\s*#?\s*([\w-]+)/i)?.[0];
  if (home.floor_plan) return [`Plan ${home.floor_plan}`, unit].filter(Boolean).join(" · ");
  return unit || (home.kind === "listing" ? "Unit not identified by source" : "Floor plan not supplied");
}
export const statuses = [
  "researching",
  "shortlisted",
  "contacted",
  "tour scheduled",
  "toured",
  "applied",
  "ruled out",
];
// One formatter, built once: constructing an Intl.NumberFormat per call cost
// a third of a second over a thousand cards, on every keystroke in the search.
const dollars = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});
export const money = (n) => (Number.isFinite(n) ? dollars.format(n) : "Not quoted");
export const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export function safeUrl(s) {
  try {
    const u = new URL(s);
    return ["https:", "http:"].includes(u.protocol) ? u.href : "";
  } catch {
    return "";
  }
}
export function amount(v) {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null;
}
// Hosts that publish a data interface rather than an apartment. A reference to
// one of these is documentation: it explains how a feed reports listings, and
// it is never promoted into a rental listing link for a home.
export const documentationHosts = [
  "developers.rentcast.io",
  "developer.nlr.gov",
  "developer.nrel.gov",
  "data.cityofchicago.org",
];
export function isDocumentationUrl(value) {
  const safe = safeUrl(value);
  if (!safe) return false;
  try {
    const host = new URL(safe).hostname.toLowerCase().replace(/^www\./, "");
    return documentationHosts.some((d) => host === d || host.endsWith("." + d));
  } catch {
    return false;
  }
}
// The recorded public identity of a place, and nothing else. Personal notes,
// quotes, tour dates and every other notebook field are excluded by
// construction: only these five fields are ever read.
export function searchIdentity(home = {}) {
  const clean = (v) => (typeof v === "string" ? v.trim() : "");
  const title = clean(home.title),
    address = clean(home.address),
    city = clean(home.city),
    unit = clean(home.unit_label),
    plan = clean(home.floor_plan);
  const inAddress = unit && address.toLowerCase().includes(unit.toLowerCase());
  if (plan && (title || address || city))
    return {
      scope: "building-plan",
      label: "Search this building & plan ↗",
      terms: [title, address || city, "floor plan " + plan].filter(Boolean),
    };
  if (address)
    return unit && !inAddress
      ? { scope: "address-unit", label: "Search this address & unit ↗", terms: [address, unit, "apartment for rent"] }
      : { scope: unit ? "address-unit" : "address", label: unit ? "Search this address & unit ↗" : "Search this address ↗", terms: [address, "apartment for rent"] };
  if (title && city)
    return { scope: "building", label: "Search this building ↗", terms: [title, city, "apartments"] };
  return null;
}
const sourceDestinations = {
  listing_source: {
    label: "Open the recorded listing ↗",
    summary: "Listing page on record",
    says: "The listing page this record was observed from. Confirm the exact unit is still offered.",
  },
  plan_source: {
    label: "Open the building / plan source ↗",
    summary: "Building / plan page",
    says: "An official building or floor-plan page for the named plan — not proof that an exact unit is available.",
  },
  personal: {
    label: "Open your source ↗",
    summary: "Your own source",
    says: "The link you recorded for this entry. SpicyHome has not checked where it leads.",
  },
  documentation: {
    label: "Provider documentation ↗",
    summary: "Provider documentation only",
    says: "Describes how the provider reports apartments. It is not a rental listing for this home.",
  },
  none: {
    label: "",
    summary: "No source link on record",
    says: "No source link was recorded for this home.",
  },
};
// One answer about where a record's source can actually be reached, read off
// what the record itself carries. A populated URL is not proof of an exact
// unit, so the destination is named rather than assumed; a provider ID is
// never turned into a guessed listing address. Where no exact listing URL was
// supplied, that is said, and the way out is a labelled SEARCH over recorded
// public identity -- which is a search, not a found listing.
export function sourceAccess(home = {}) {
  const references = sourceReferences(home);
  // A safe URL that was actually supplied is preserved, whether the record
  // carries it as its own link or only among its references. Nothing is
  // promoted: documentation stays documentation.
  const supplied = safeUrl(home.source_url) || references.find((s) => !s.documentation)?.url || "";
  const documentation = !supplied && references.length > 0 && references.every((s) => s.documentation);
  const url = documentation ? "" : supplied;
  const kind = documentation
    ? "documentation"
    : !url
      ? "none"
      : isDocumentationUrl(url)
        ? "documentation"
        : home.kind === "manual"
          ? "personal"
          : home.kind === "building"
            ? "plan_source"
            : "listing_source";
  const destination = sourceDestinations[kind];
  const exact = kind === "listing_source";
  const identity = exact ? null : searchIdentity(home);
  const plan =
    kind === "plan_source" && typeof home.floor_plan === "string" && home.floor_plan.trim()
      ? `An official building or floor-plan page for plan ${home.floor_plan.trim()} — not proof that an exact unit is available.`
      : null;
  return {
    kind,
    url,
    exact,
    label: destination.label,
    summary: exact || !identity ? destination.summary : `${destination.summary} · search available`,
    says: plan ?? destination.says,
    // Said plainly wherever the reader is offered a way to the source.
    missing: exact ? "" : "No exact listing URL is on record for this home.",
    fallback: identity
      ? {
          url: "https://www.google.com/search?q=" + encodeURIComponent(identity.terms.join(" ")),
          label: identity.label,
          scope: identity.scope,
          terms: identity.terms,
          note: "A search, not a found listing or a verified source.",
        }
      : null,
    // No address, no building name: nothing is invented to fill the gap.
    unavailable: !url && !identity,
  };
}
// Every source reference this record retains, each keeping its own date. A
// reference with no recorded date says so; the home's own observation date is
// never copied onto it, and today's date is never assumed.
export function sourceReferences(home = {}) {
  const listed = Array.isArray(home.sources) ? home.sources : [];
  const list = listed.length
    ? listed
    : safeUrl(home.source_url)
      ? [{ url: home.source_url, supports: "Your source link" }]
      : [];
  return list
    .filter((s) => isObj(s) && safeUrl(s.url))
    .map((s) => ({
      url: safeUrl(s.url),
      supports: typeof s.supports === "string" ? s.supports : "",
      observed_at: dateOk(s.observed_at) ? s.observed_at : null,
      documentation: isDocumentationUrl(s.url),
    }));
}
// The matching city's retained query, and never another city's. The global
// "latest area" belongs to whichever city was scanned last, so it is not read
// here: an area with no recorded scan says so instead of borrowing one. A
// frozen copy from a saved record is preferred when one is supplied, and it
// carries its own dates so a saved observation is never presented as having
// been captured with today's query.
export function scanContext(provider, home = {}, saved = null) {
  const city = homeCity(home) || (typeof home.city === "string" ? home.city.trim() : "");
  const frozen = isObj(saved) ? saved : null;
  const basis =
    frozen?.basis ??
    (home.kind === "building" ? "curated_research" : home.kind === "manual" ? "manual_entry" : "provider_query");
  const scan = frozen ?? (isObj(provider?.area_scans) ? provider.area_scans[city] : null);
  const observed_at = dateOk(home.observed_at) ? home.observed_at : null;
  const base = { city, basis, frozen: !!frozen, observed_at, saved_at: frozen && dateOk(frozen.saved_at) ? frozen.saved_at : null };
  if (!isObj(scan) || !dateOk(scan.last_success) || basis !== "provider_query")
    return { ...base, recorded: false, coverage: "unrecorded" };
  const returned = Number.isInteger(scan.returned) ? scan.returned : null;
  const total = Number.isInteger(scan.total) ? scan.total : null;
  const truncated = scan.truncated === true || (total === null && returned === 500);
  return {
    ...base,
    recorded: true,
    last_success: scan.last_success,
    returned,
    total,
    accepted: Number.isInteger(scan.accepted) ? scan.accepted : null,
    truncated,
    // Completeness of THAT recorded query, never of the market.
    coverage: total === null ? "unknown-total" : truncated ? "capped" : "complete",
    sameCapture: !!observed_at && observed_at === scan.last_success,
    // Which of the two came first, so a newer observation is never called
    // older than the query beside it.
    order: !observed_at
      ? "unknown"
      : observed_at === scan.last_success
        ? "same"
        : Date.parse(observed_at) < Date.parse(scan.last_success)
          ? "observed_first"
          : "query_first",
  };
}
// Four different states, never collapsed into one: the building advertises
// charging, it does not, the source never established it, and the public
// charging dataset was not available. A public station is not a resident
// amenity and establishes no parking or charging right.
export const publicChargingMiles = 0.5;
export function chargingEvidence(home = {}, feed = {}) {
  const status = ["yes", "no", "unknown"].includes(home.charging?.status) ? home.charging.status : "unknown";
  const stations = Array.isArray(feed.charging_stations) ? feed.charging_stations : [];
  const located = Number.isFinite(home.lat) && Number.isFinite(home.lng);
  return {
    status,
    building: { yes: "Building charging advertised", no: "No building charging", unknown: "Building charging unknown" }[status],
    cost: amount(home.charging?.monthly),
    note: typeof home.charging?.note === "string" ? home.charging.note : "",
    public: !stations.length ? "unavailable" : located ? "loaded" : "unlocated",
    nearby: stations.length && located
      ? stations.filter((s) => { const d = distanceMiles(home, s); return d !== null && d <= publicChargingMiles; }).length
      : null,
    observed_at: dateOk(feed.city_context?.afdc?.updated_at) ? feed.city_context.afdc.updated_at : null,
    status_note: typeof feed.city_context?.afdc_status === "string" ? feed.city_context.afdc_status : "",
  };
}
export function costs(home, record = {}, prefs = defaults) {
  const rent = amount(record.rentOverride) ?? amount(home.rent);
  const parking = amount(record.parkingCost) ?? amount(home.parking?.monthly);
  const fees = amount(record.monthlyFees) ?? amount(home.fees?.monthly);
  const utilities = amount(record.utilities) ?? amount(prefs.utilityEstimate);
  const known =
    [rent, parking, fees].filter((x) => x !== null).reduce((a, b) => a + b, 0) +
    (utilities ?? 0);
  const unknown = [];
  if (rent === null) unknown.push("base rent");
  if (parking === null) unknown.push("parking");
  if (fees === null) unknown.push("monthly fees");
  if (utilities === null) unknown.push("utilities");
  return {
    rent,
    parking,
    fees,
    utilities,
    known,
    unknown,
    complete: !unknown.length,
    upfront: amount(record.oneTimeFees) ?? amount(home.fees?.one_time),
    // Resident EV charging is reported by no source here and is quoted by
    // none, so it is named beside the subtotal rather than folded into it. A
    // subtotal that exists is not a subtotal that includes charging.
    charging: amount(home.charging?.monthly),
    chargingIncluded: false,
  };
}
export function visibleHomes(homes, workspace, prefs, feed = {}) {
  // One anchor for every distance this function gates on, taken from the feed
  // the reader is looking at, so the mileage a card prints and the mileage that
  // filtered it cannot come from two different points. With no feed in hand it
  // is searchCenter, which is what the radius gate has always used.
  const anchor = urbanAnchor(feed);
  return homes
    .filter((h) => {
      const city = homeCity(h);
      if (prefs.region === "chicago" && city !== "Chicago") return false;
      if (prefs.region === "suburbs" && !suburbCities.includes(city)) return false;
      if (prefs.radiusMiles) {
        const distance = distanceMiles(h, anchor);
        if (distance === null || distance > prefs.radiusMiles) return false;
      }
      if (prefs.urbanScope !== "all") {
        const setting = urbanSetting(h, feed);
        if (prefs.urbanScope === "core" && setting.status !== "core") return false;
        if (prefs.urbanScope === "near" && !["core", "near"].includes(setting.status)) return false;
      }
      const rec = workspace.records[h.id] ?? {};
      const layout = layoutEvidence(h, rec);
      if (!layout.matches) return false;
      if (prefs.bedrooms && prefs.bedrooms !== "all" && layout.bedrooms !== Number(prefs.bedrooms)) return false;
      if (prefs.layoutScope === "source" && !["source_listed", "confirmed"].includes(layout.status)) return false;
      if (prefs.layoutScope === "confirmed" && layout.status !== "confirmed") return false;
      const c = costs(h, rec, prefs);
      const p =
        prefs.basis === "total" ? (c.rent === null ? null : c.known) : c.rent;
      if (p === null && !prefs.unknown) return false;
      if (p !== null && (p < prefs.min || p > prefs.max)) return false;
      if (prefs.neighborhood !== "all" && h.neighborhood !== prefs.neighborhood)
        return false;
      if (prefs.parking && h.parking?.status !== "yes") return false;
      if (prefs.charging && h.charging?.status !== "yes") return false;
      return `${h.title} ${h.address} ${h.neighborhood} ${homeCity(h)} ${planLabel(h)}`
        .toLowerCase()
        .includes(prefs.search.toLowerCase());
    })
    .sort((a, b) => {
      if (prefs.sort === "recent")
        return String(b.observed_at).localeCompare(String(a.observed_at));
      if (prefs.sort === "space") return (b.sqft ?? -1) - (a.sqft ?? -1);
      const ca = costs(a, workspace.records[a.id], prefs),
        cb = costs(b, workspace.records[b.id], prefs);
      return (
        (prefs.basis === "total"
          ? ca.rent === null
            ? Infinity
            : ca.known
          : (ca.rent ?? Infinity)) -
        (prefs.basis === "total"
          ? cb.rent === null
            ? Infinity
            : cb.known
          : (cb.rent ?? Infinity))
      );
    });
}
const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const textOk = (v, max = 2000) => typeof v === "string" && v.length <= max;
const nullableAmount = (v) => v == null || amount(v) !== null;
const dateOk = (v) =>
  typeof v === "string" && v.length <= 40 && Number.isFinite(Date.parse(v));
function historyOk(v) {
  return (
    v === undefined ||
    (Array.isArray(v) &&
      v.length <= 2000 &&
      v.every((p) => isObj(p) && dateOk(p.date) && nullableAmount(p.rent)))
  );
}
function eventsOk(v) {
  return (
    Array.isArray(v) &&
    v.length <= 10000 &&
    v.every(
      (e) =>
        isObj(e) &&
        dateOk(e.at) &&
        textOk(e.title) &&
        textOk(e.description, 20000),
    )
  );
}
export function validateHome(h) {
  if (
    !isObj(h) ||
    !textOk(h.id, 180) ||
    !h.id ||
    ["__proto__", "constructor", "prototype"].includes(h.id) ||
    !textOk(h.title) ||
    !h.title.trim() ||
    !textOk(h.address) ||
    !textOk(h.neighborhood)
  )
    return false;
  if (
    !["building", "listing", "manual"].includes(h.kind) ||
    !(h.bedrooms == null || (Number.isInteger(h.bedrooms) && h.bedrooms >= 0 && h.bedrooms <= 20)) ||
    !(h.bathrooms == null || (Number.isFinite(h.bathrooms) && h.bathrooms >= 0 && h.bathrooms <= 20 && h.bathrooms * 2 % 1 === 0)) ||
    !nullableAmount(h.rent) ||
    !nullableAmount(h.sqft) ||
    !nullableAmount(h.advertised_price)
  )
    return false;
  if (h.layout_status !== undefined && !["source_listed", "provider_reported", "unverified", "studio", "conflict", "other"].includes(h.layout_status)) return false;
  if (h.city !== undefined && !textOk(h.city, 500)) return false;
  if (h.layout_declaration != null && !["studio", "one_bed", "two_bed", "conflict"].includes(h.layout_declaration)) return false;
  for (const key of ["layout_note", "unit_label", "property_type"])
    if (h[key] !== undefined && h[key] !== null && !textOk(h[key], 2000)) return false;
  if (!dateOk(h.observed_at) || !historyOk(h.history)) return false;
  if (h.source_url != null && !textOk(h.source_url, 4000)) return false;
  if (
    (h.lat != null && (!Number.isFinite(h.lat) || Math.abs(h.lat) > 90)) ||
    (h.lng != null && (!Number.isFinite(h.lng) || Math.abs(h.lng) > 180))
  )
    return false;
  for (const key of ["parking", "charging", "access"])
    if (
      h[key] !== undefined &&
      (!isObj(h[key]) ||
        !["yes", "no", "unknown"].includes(h[key].status) ||
        (h[key].note !== undefined && !textOk(h[key].note, 5000)) ||
        !nullableAmount(h[key].monthly))
    )
      return false;
  if (
    h.fees !== undefined &&
    (!isObj(h.fees) ||
      !nullableAmount(h.fees.monthly) ||
      !nullableAmount(h.fees.one_time))
  )
    return false;
  if (
    h.amenities !== undefined &&
    (!Array.isArray(h.amenities) ||
      h.amenities.length > 100 ||
      !h.amenities.every((x) => textOk(x, 500)))
  )
    return false;
  if (
    h.sources !== undefined &&
    (!Array.isArray(h.sources) ||
      h.sources.length > 100 ||
      !h.sources.every(
        (x) =>
          isObj(x) &&
          textOk(x.url, 4000) &&
          (x.supports === undefined || textOk(x.supports, 5000)),
      ))
  )
    return false;
  for (const key of ["atmosphere", "availability_note", "floor_plan"])
    if (h[key] !== undefined && !textOk(h[key], 5000)) return false;
  return true;
}
export function validateFeed(d) {
  if (
    d?.schema_version !== 1 ||
    !Array.isArray(d.homes) ||
    d.homes.length > 5000 ||
    !d.homes.every(validateHome) ||
    new Set(d.homes.map((h) => h.id)).size !== d.homes.length ||
    !dateOk(d.generated_at) ||
    !isObj(d.provider) ||
    !eventsOk(d.events ?? [])
  )
    throw Error("This snapshot has an unsupported or incomplete format.");
  for (const key of ["charging_stations", "transit_stops"])
    if (
      d[key] !== undefined &&
      (!Array.isArray(d[key]) ||
        d[key].length > 10000 ||
        !d[key].every(
          (s) =>
            isObj(s) &&
            textOk(s.title) &&
            Number.isFinite(s.lat) &&
            Number.isFinite(s.lng),
        ))
    )
      throw Error("This snapshot contains invalid city context.");
  if (d.search_area !== undefined) {
    const area = d.search_area;
    if (!isObj(area) || !isObj(area.center) || !Number.isFinite(area.center.lat) || !Number.isFinite(area.center.lng) || !Number.isFinite(area.radius_miles) || area.radius_miles <= 0 || area.radius_miles > 100 || !Array.isArray(area.areas) || area.areas.length > 50 || !area.areas.every((a) => isObj(a) && textOk(a.city,500) && textOk(a.note,2000) && textOk(a.source_url,4000)))
      throw Error("This snapshot contains an invalid search area.");
  }
  if (d.provider.area_scans !== undefined && (!isObj(d.provider.area_scans) || !Object.values(d.provider.area_scans).every((scan) => isObj(scan) && dateOk(scan.last_success) && (scan.returned == null || (Number.isInteger(scan.returned) && scan.returned >= 0 && scan.returned <= 500)) && (scan.total == null || (Number.isInteger(scan.total) && scan.total >= 0)))))
    throw Error("This snapshot contains invalid area scan dates.");
  return d;
}
export function emptyWorkspace() {
  return {
    version: VERSION,
    records: {},
    manual: [],
    events: [],
    preferences: { ...defaults },
    savedSearches: [],
  };
}
// The query context a saved home was read under. Every field is optional
// except the date the notebook froze it, so a notebook saved before this
// existed stays valid and simply reads "not recorded".
function savedScanOk(s) {
  if (!isObj(s) || !["provider_query", "curated_research", "manual_entry"].includes(s.basis)) return false;
  if (s.city != null && !textOk(s.city, 500)) return false;
  if (!dateOk(s.saved_at)) return false;
  for (const k of ["feed_generated_at", "observed_at", "last_success"])
    if (s[k] != null && !dateOk(s[k])) return false;
  for (const [k, max] of [["returned", 500], ["accepted", 500], ["total", 10000000]])
    if (s[k] != null && (!Number.isInteger(s[k]) || s[k] < 0 || s[k] > max)) return false;
  if (s.truncated !== undefined && typeof s.truncated !== "boolean") return false;
  return true;
}
export function validateWorkspace(w) {
  if (
    w?.version !== VERSION ||
    !isObj(w.records) ||
    !Array.isArray(w.manual) ||
    w.manual.length > 2000 ||
    !eventsOk(w.events) ||
    !w.manual.every(validateHome)
  )
    throw Error("This file is not a supported SpicyHome backup.");
  for (const [key, r] of Object.entries(w.records)) {
    if (
      ["__proto__", "constructor", "prototype"].includes(key) ||
      !isObj(r) ||
      (r.status && !statuses.includes(r.status)) ||
      (r.notes !== undefined && !textOk(r.notes, 20000)) ||
      (r.saved !== undefined && typeof r.saved !== "boolean") ||
      (r.finalist !== undefined && typeof r.finalist !== "boolean") ||
      (r.finalist === true && r.saved !== true)
    )
      throw Error("The backup contains an invalid record.");
    if (r.layoutReview !== undefined && (typeof r.layoutReview !== "string" || !Object.hasOwn(checkedLayouts, r.layoutReview) && !["studio", "other", "unverified"].includes(r.layoutReview)))
      throw Error("The backup contains an invalid layout review.");
    if (r.tourChecks !== undefined && (!isObj(r.tourChecks) || Object.entries(r.tourChecks).some(([key, value]) => !tourChecks.some(([known]) => known === key) || typeof value !== "boolean")))
      throw Error("The backup contains an invalid tour checklist.");
    for (const k of [
      "rentOverride",
      "parkingCost",
      "monthlyFees",
      "utilities",
      "oneTimeFees",
    ])
      if (!nullableAmount(r[k]))
        throw Error("The backup contains an invalid cost.");
    for (const k of ["tourDate", "quoteDate"])
      if (r[k] !== undefined && r[k] !== "" && !dateOk(r[k]))
        throw Error("The backup contains an invalid date.");
    if (
      (r.snapshot !== undefined && !validateHome(r.snapshot)) ||
      !historyOk(r.quote_history)
    )
      throw Error("The backup contains an invalid saved home or quote.");
    if (r.scan !== undefined && !savedScanOk(r.scan))
      throw Error("The backup contains invalid saved source context.");
  }
  if (Object.values(w.records).filter((r) => r.finalist).length > 3)
    throw Error("A notebook can pin at most three finalists. Unpin one before combining these notebooks.");
  const p = validatePreferences(w.preferences);
  const savedSearches = w.savedSearches === undefined ? [] : w.savedSearches;
  if (!Array.isArray(savedSearches) || savedSearches.length > 8 || savedSearches.some((s) => !isObj(s) || !textOk(s.name, 60) || !s.name.trim() || !isObj(s.preferences)) || new Set(savedSearches.map((s) => s.name.trim().toLowerCase())).size !== savedSearches.length)
    throw Error("The backup contains invalid saved searches (maximum eight unique names).");
  return { ...w, preferences: p, savedSearches: savedSearches.map((s) => ({ name: s.name.trim(), preferences: validatePreferences(s.preferences) })) };
}
export function validatePreferences(preferences) {
  const p = { ...defaults, ...(isObj(preferences) ? preferences : {}) };
  if (
    !Number.isFinite(p.min) ||
    !Number.isFinite(p.max) ||
    p.min < 0 ||
    p.max < p.min ||
    p.max > 20000 ||
    !["rent", "total"].includes(p.basis) ||
    !["rent", "recent", "space"].includes(p.sort) ||
    !["all", "source", "confirmed"].includes(p.layoutScope) ||
    !["all", "chicago", "suburbs"].includes(p.region) ||
    !["all", "1", "2"].includes(p.bedrooms) ||
    !["split", "list", "map", "focus", "atlas"].includes(p.surface) ||
    !["cards", "scan"].includes(p.density) ||
    ![0, 10, 20, 35].includes(p.radiusMiles) ||
    !textOk(p.search, 500) ||
    !textOk(p.neighborhood, 500) ||
    !["all", "core", "near"].includes(p.urbanScope) ||
    !["parking", "charging", "unknown", "highRise", "parkingPreferred"].every(
      (k) => typeof p[k] === "boolean",
    ) ||
    !nullableAmount(p.utilityEstimate) ||
    !nullableAmount(p.targetRent) ||
    (p.targetRent !== null && p.targetRent > 20000)
  )
    throw Error("The backup contains invalid search preferences.");
  return Object.fromEntries(Object.keys(defaults).map((key) => [key, p[key]]));
}
export function ageDays(date, now = new Date()) {
  const time = Date.parse(date);
  return Number.isFinite(time)
    ? Math.max(0, Math.floor((now.getTime() - time) / 86400000))
    : null;
}
export function distanceMiles(a, b) {
  if (![a.lat, a.lng, b.lat, b.lng].every(Number.isFinite)) return null;
  const d = Math.PI / 180,
    dl = (b.lat - a.lat) * d,
    dg = (b.lng - a.lng) * d,
    x =
      Math.sin(dl / 2) ** 2 +
      Math.cos(a.lat * d) * Math.cos(b.lat * d) * Math.sin(dg / 2) ** 2;
  return 3958.8 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}
export function changeFor(h) {
  const points = (h.history ?? []).filter((p) => amount(p.rent) !== null);
  if (points.length < 2) return null;
  return points.at(-1).rent - points.at(-2).rent;
}

// SpicyPicks is a transparent shortlist heuristic, not a market valuation.
export const pickLenses = [
  ["balanced","Best fit"], ["budget","Budget wins"], ["space","More space"],
  ["ev","EV + parking"], ["rail","Near CTA"], ["downtown","Downtown value"],
];
const pickWeights = {
  balanced:{budget:35,value:20,space:10,amenities:25,evidence:10},
  budget:{budget:65,value:25,space:0,amenities:0,evidence:10},
  space:{budget:15,value:20,space:55,amenities:0,evidence:10},
  ev:{budget:30,value:10,space:5,amenities:45,evidence:10},
  rail:{budget:25,value:10,space:5,amenities:5,evidence:10,rail:45},
  // Downtown is a place, so it is a gate below rather than a weight. What is
  // left to weigh is what the reader said matters there: a recorded building
  // form, advertised parking, and evidence -- with budget lowered, because the
  // cheapest downtown apartment is not the one this priority is looking for.
  downtown:{budget:20,value:15,space:5,amenities:30,evidence:10,form:20},
};
const clampPick = (value) => Math.max(0,Math.min(1,value));
const medianPick = (values) => { const sorted=[...values].sort((a,b)=>a-b), middle=Math.floor(sorted.length/2);return sorted.length%2 ? sorted[middle] : (sorted[middle-1]+sorted[middle])/2; };
function pickAddress(home) {
  return (home.address ?? home.id).toLowerCase().replace(/\b(?:apt|unit|suite|apartment)\s*#?\s*[\w-]+/g,"").replace(/#\s*[\w-]+/g,"").replace(/[.,]/g," ").replace(/\s+/g," ").trim();
}
function samePickPlace(a,b) {
  const distance=distanceMiles(a,b);
  return pickAddress(a)===pickAddress(b) || distance!==null && distance<0.03;
}
function pickAge(value, now) {
  const timestamp=Date.parse(value);
  return Number.isFinite(timestamp) && timestamp<=now.getTime() ? Math.floor((now.getTime()-timestamp)/86400000) : null;
}
function observedPickHomes(homes, workspace, now) {
  const records=workspace.records ?? {};
  return homes.filter((home)=>{
    const rec=records[home.id] ?? {}, layout=layoutEvidence(home,rec), age=pickAge(home.observed_at,now);
    return !home.notebook_only && home.seen_in_latest!==false && !(amount(rec.rentOverride)!==null && Date.parse(rec.quoteDate)>now.getTime()) && layout.matches && [1,2].includes(layout.bedrooms) && [1,1.5,2].includes(layout.bathrooms) && age!==null && age<=30;
  });
}
export function spicyPicks(homes, workspace, prefs=defaults, context={}, lens="balanced", now=new Date(), recipe=null) {
  const records=workspace.records ?? {}, weight=recipe ? recipeWeights(recipe) : pickWeights[lens] ?? pickWeights.balanced;
  const observed=observedPickHomes(homes,workspace,now);
  const current=observed.filter((home)=>(records[home.id] ?? {}).status!=="ruled out");
  const scoped=visibleHomes(current,workspace,prefs,context);
  const priced=observed.filter((home)=>costs(home,records[home.id],prefs).rent>0);
  const matches=scoped.filter((home)=>costs(home,records[home.id],prefs).rent>0 && (["source_listed","confirmed"].includes(layoutEvidence(home,records[home.id]).status) || home.sqft>0));
  const parents=priced.map((_,index)=>index);
  const root=(index)=>{while(parents[index]!==index){parents[index]=parents[parents[index]];index=parents[index];}return index;};
  for(let i=0;i<priced.length;i++)for(let j=0;j<i;j++)if(samePickPlace(priced[i],priced[j]))parents[root(i)]=root(j);
  const references=priced.map((home,index)=>{
    const rec=records[home.id] ?? {};
    return {home,group:root(index),layout:layoutEvidence(home,rec),cost:costs(home,rec,prefs),quoteAge:pickAge(amount(rec.rentOverride)!==null ? rec.quoteDate : home.observed_at,now)};
  });
  const groupsById=new Map(references.map((entry)=>[entry.home.id,entry.group]));
  const ctaAge=pickAge(context.city_context?.cta?.updated_at,now);
  const stations=ctaAge!==null && ctaAge<=30 ? context.transit_stops ?? [] : [];
  const ranked=matches.map((home)=>{
    const rec=records[home.id] ?? {}, cost=costs(home,rec,prefs), layout=layoutEvidence(home,rec);
    const sourceAge=pickAge(home.observed_at,now);
    const quoted=amount(rec.rentOverride)!==null;
    const quoteAge=quoted ? pickAge(rec.quoteDate,now) : sourceAge;
    const fresh=quoteAge!==null && quoteAge<=7;
    const peerGroups=new Map();
    if(home.sqft>0 && homeCity(home)) for(const entry of references){
      const other=entry.home, distance=distanceMiles(home,other);
      if(entry.group===groupsById.get(home.id) || other.kind!==home.kind || homeCity(other)!==homeCity(home) || entry.layout.bedrooms!==layout.bedrooms || entry.layout.bathrooms!==layout.bathrooms || !(other.sqft>=home.sqft*.8 && other.sqft<=home.sqft*1.2) || distance===null || distance>3 || entry.quoteAge===null || entry.quoteAge>7)continue;
      if(!peerGroups.has(entry.group))peerGroups.set(entry.group,[]);
      peerGroups.get(entry.group).push(entry.cost.rent/other.sqft);
    }
    const peerCount=peerGroups.size;
    const rate=home.sqft>0 ? cost.rent/home.sqft : null;
    const peerMedian=peerCount>=5 ? medianPick([...peerGroups.values()].map(medianPick)) : null;
    const saving=peerMedian && rate!==null && fresh ? (peerMedian-rate)/peerMedian : null;
    const station=stations.map((stop)=>({...stop,distance:distanceMiles(home,stop)})).filter((stop)=>stop.distance!==null).sort((a,b)=>a.distance-b.distance)[0] ?? null;
    const nearby=station && station.distance<=0.5 ? station : null;
    const parking=home.parking?.status==="yes", charging=home.charging?.status==="yes";
    const room=home.sqft>0 ? clampPick(home.sqft/(layout.bedrooms===1 ? 1000 : 1400)) : 0;
    const signals={
      budget:clampPick((prefs.max-cost.known)/Math.max(1,prefs.max-prefs.min)),
      value:saving===null ? 0 : clampPick(saving/.25),
      space:room,
      amenities:(parking ? .4 : 0)+(charging ? .6 : 0),
      evidence:(["source_listed","confirmed"].includes(layout.status) ? .55 : 0)+(fresh ? .25 : 0)+(.2*(4-cost.unknown.length)/4),
      rail:nearby ? clampPick(1-nearby.distance/.75) : 0,
      // A recorded high-rise scores; everything else scores nothing. An
      // unrecorded height is never a deduction, because unknown is not a no.
      form:buildingForm(home).status==="high_rise" ? 1 : 0,
    };
    // Missing quotes reduce confidence; they never become assumed free services.
    const penalty=cost.unknown.length*3+(!fresh ? 12 : 0)+(sourceAge>7 ? 6 : 0);
    const score=Object.entries(weight).reduce((sum,[key,points])=>sum+signals[key]*points,0)-penalty;
    const reasons=[];
    if(saving!==null && saving>=.05)reasons.push(`${Math.round(saving*100)}% lower base rent per sq ft than the median of ${peerCount} nearby comparison locations`);
    if(cost.known<prefs.max)reasons.push(`${money(prefs.max-cost.known)} below your ${money(prefs.max)} cap on the known monthly subtotal${cost.unknown.length ? "; missing costs still apply" : ""}`);
    if(home.sqft>0)reasons.push(`${home.sqft} reported sq ft${rate!==null ? ` · ${rate.toLocaleString("en-US",{style:"currency",currency:"USD",minimumFractionDigits:2,maximumFractionDigits:2})} base rent / sq ft` : ""}`);
    if(parking && charging)reasons.push("Both resident parking and EV charging are advertised");
    else if(parking)reasons.push("Resident parking is advertised");
    if(nearby)reasons.push(`${nearby.distance.toFixed(2)} mi straight-line to ${nearby.title} CTA station`);
    if(layout.status==="confirmed")reasons.push("You checked the bedroom and bathroom layout");
    else if(layout.status==="source_listed")reasons.push("An identified floor plan supports the bedroom count");
    const catches=[];
    if(home.parking?.status==="no")catches.push("The source reports no resident parking.");
    if(home.charging?.status==="no")catches.push("The source reports no resident EV charging.");
    if(cost.unknown.length)catches.push(`Still unquoted: ${cost.unknown.join(", ")}.`);
    if(cost.known>prefs.max)catches.push(`The known monthly subtotal is ${money(cost.known-prefs.max)} above your search cap.`);
    if(!["source_listed","confirmed"].includes(layout.status))catches.push("Bedroom count is unverified; check the exact plan for a studio or convertible.");
    if(parking || charging)catches.push("Confirm an available parking space, charger compatibility and all charging fees.");
    else catches.push("Parking and resident EV charging are not established.");
    if(!fresh)catches.push("The rent quote is not dated within the last seven days; request a fresh quote.");
    if(sourceAge>7)catches.push("The listing observation is older than seven days; confirm current availability.");
    if(!home.sqft)catches.push("Square footage is unverified.");
    return {home,cost,layout,score,penalty,group:groupsById.get(home.id),reasons,catches,nearby,rate,peerCount,peerMedian,saving,fresh,quoted,quoteDate:quoted ? rec.quoteDate : home.observed_at,signals};
  }).filter((pick)=>lens!=="downtown" || ["core","near"].includes(urbanSetting(pick.home,context).status))
    .filter((pick)=>lens!=="ev" || pick.home.parking?.status==="yes" && pick.home.charging?.status==="yes")
    .filter((pick)=>lens!=="rail" || pick.nearby)
    .filter((pick)=>lens!=="space" || pick.home.sqft>0)
    .sort((a,b)=>b.score-a.score || a.cost.known-b.cost.known || a.home.id.localeCompare(b.home.id));
  const picks=[];
  for(const pick of ranked){if(picks.some((selected)=>groupsById.get(selected.home.id)===groupsById.get(pick.home.id)))continue;picks.push(pick);if(picks.length===3)break;}
  const leads=[];
  for(const home of scoped.filter((home)=>(lens!=="downtown" || ["core","near"].includes(urbanSetting(home,context).status)) && (lens!=="ev" || home.parking?.status==="yes" && home.charging?.status==="yes") && (lens!=="space" || home.sqft>0) && (lens!=="rail" || stations.some((station)=>{const d=distanceMiles(home,station);return d!==null && d<=.5;}))).filter((home)=>costs(home,records[home.id],prefs).rent===null && amount(home.advertised_price)>0 && home.advertised_price<=prefs.max && (home.parking?.status==="yes" || home.charging?.status==="yes")).sort((a,b)=>Number(b.charging?.status==="yes")-Number(a.charging?.status==="yes") || a.id.localeCompare(b.id))){
    if(leads.some((other)=>samePickPlace(other,home)) || picks.some((pick)=>samePickPlace(pick.home,home)))continue;leads.push(home);if(leads.length===2)break;
  }
  return {picks,leads,candidates:ranked,eligible:ranked.length,visible:scoped.length,excluded:homes.length-current.length,lens:pickWeights[lens] ? lens : "balanced",weights:weight,ctaAvailable:stations.length>0};
}

// Decision Studio experiments never mutate the user's notebook or source feed.
export const recipeDefaults={budget:3,value:3,space:2,amenities:4,rail:1,evidence:3,form:0};
export const recipeLabels={budget:'Lower monthly costs',value:'Local price value',space:'More room',amenities:'Parking + EV',rail:'Near CTA',evidence:'Stronger evidence',form:'Recorded high-rise'};
export function recipeWeights(recipe={}) {
  const entries=Object.keys(recipeDefaults).map(key=>[key,Number.isFinite(recipe[key]) ? Math.max(0,Math.min(5,recipe[key])) : recipeDefaults[key]]);
  const sum=entries.reduce((total,[,value])=>total+value,0);
  return sum ? Object.fromEntries(entries.map(([key,value])=>[key,value/sum*100])) : recipeWeights(recipeDefaults);
}
export function remixPicks(result, recipe) {
  const weights=recipeWeights(recipe),picks=[],used=new Set();
  const candidates=result.candidates.map(pick=>({...pick,score:Object.entries(weights).reduce((sum,[key,weight])=>sum+pick.signals[key]*weight,0)-pick.penalty})).sort((a,b)=>b.score-a.score || a.cost.known-b.cost.known || a.home.id.localeCompare(b.home.id));
  for(const pick of candidates){if(used.has(pick.group))continue;used.add(pick.group);picks.push(pick);if(picks.length===3)break;}
  return {...result,picks,candidates,weights};
}
export function decisionPool(homes, workspace, prefs=defaults, now=new Date(), feed={}) {
  return visibleHomes(observedPickHomes(homes,workspace,now).filter(h=>workspace.records[h.id]?.status!=='ruled out'),workspace,prefs,feed);
}
function distinctPlaces(homes) {
  const parents=homes.map((_,i)=>i),root=i=>{while(parents[i]!==i){parents[i]=parents[parents[i]];i=parents[i];}return i;};
  for(let i=0;i<homes.length;i++)for(let j=0;j<i;j++)if(samePickPlace(homes[i],homes[j]))parents[root(i)]=root(j);
  const groups=new Map();homes.forEach((h,i)=>{const id=root(i);if(!groups.has(id))groups.set(id,[]);groups.get(id).push(h);});return [...groups.values()];
}
export function apartmentTradeoffs(anchor, homes, workspace, prefs=defaults, extra=150, now=new Date(), feed={}) {
  if(!anchor)return [];
  const eligible=decisionPool(homes,workspace,prefs,now,feed), rec=workspace.records[anchor.id] ?? {}, ac=costs(anchor,rec,prefs), al=layoutEvidence(anchor,rec);
  if(!eligible.some(h=>h.id===anchor.id) || !(ac.rent>0))return [];
  const cap=Number.isFinite(extra) ? Math.max(0,Math.min(500,extra)) : 150;
  const places=distinctPlaces(eligible),groupIds=new Map(places.flatMap((group,i)=>group.map(h=>[h.id,i])));
  const group=places.find(group=>group.some(h=>h.id===anchor.id)) ?? [];
  const own=new Set(group.map(h=>h.id));
  const options=eligible.flatMap(h=>{
    const r=workspace.records[h.id] ?? {}, c=costs(h,r,prefs),l=layoutEvidence(h,r);
    const quoteAge=pickAge(amount(r.rentOverride)!==null ? r.quoteDate : h.observed_at,now);
    if(own.has(h.id) || !(c.rent>0) || c.rent>ac.rent+cap || h.kind!==anchor.kind || l.bedrooms!==al.bedrooms || l.bathrooms!==al.bathrooms || quoteAge===null || quoteAge>7)return [];
    const gain=h.sqft>0 && anchor.sqft>0 ? h.sqft-anchor.sqft : null;
    const catches=[];
    if(gain!==null && gain<0)catches.push(`${Math.abs(gain)} fewer reported sq ft`);
    if(gain===null)catches.push('Size comparison unavailable');
    if(anchor.parking?.status==='yes' && h.parking?.status!=='yes')catches.push('Resident parking is not established here');
    if(anchor.charging?.status==='yes' && h.charging?.status!=='yes')catches.push('Resident EV charging is not established here');
    if(c.unknown.length || ac.unknown.length)catches.push('Unquoted fees can change the monthly cost difference');
    if(l.status!=='confirmed' || al.status!=='confirmed')catches.push('Verify both exact layouts and current availability');
    return [{home:h,cost:c,rentDelta:c.rent-ac.rent,spaceDelta:gain,catches,anchorCost:ac}];
  });
  const anchorAge=pickAge(amount(rec.rentOverride)!==null ? rec.quoteDate : anchor.observed_at,now);
  if(anchorAge===null || anchorAge>7)return [];
  const chosen=[],used=new Set();
  const lanes=[
    ['save','Save on base rent',options.filter(o=>o.rentDelta<=-100 && o.spaceDelta!==null && o.home.sqft>=anchor.sqft*.85).sort((a,b)=>a.rentDelta-b.rentDelta || b.spaceDelta-a.spaceDelta)],
    ['space','Get more room',options.filter(o=>o.spaceDelta>=100).sort((a,b)=>b.spaceDelta-a.spaceDelta || a.rentDelta-b.rentDelta)],
    ['ev','Add resident EV charging',anchor.charging?.status==='yes' ? [] : options.filter(o=>o.home.charging?.status==='yes' && o.home.parking?.status==='yes').sort((a,b)=>a.rentDelta-b.rentDelta)],
  ];
  for(const [key,label,items] of lanes){const option=items.find(o=>!used.has(groupIds.get(o.home.id)));if(option){chosen.push({...option,key,label});used.add(groupIds.get(option.home.id));}}
  return chosen;
}
export function areaMatch(homes, workspace, prefs=defaults, bedrooms='1', scope='cities', now=new Date(), feed={}) {
  const pool=decisionPool(homes,workspace,{...prefs,bedrooms},now,feed),groups=new Map();
  for(const h of pool){const city=homeCity(h);if(!city)continue;
    const knownNeighborhood=h.neighborhood && !/search area|unknown|unverified/i.test(h.neighborhood);
    const label=scope==='neighborhoods' && city==='Chicago' ? knownNeighborhood ? `Chicago · ${h.neighborhood}` : 'Chicago · neighborhood not supplied' : city;
    if(!groups.has(label))groups.set(label,[]);groups.get(label).push(h);
  }
  return [...groups.entries()].map(([label,items])=>{
    const places=distinctPlaces(items),cohorts={};
    for(const kind of ['listing','building','manual']){
      const rates=places.flatMap(group=>{const prices=group.filter(h=>h.kind===kind).flatMap(h=>{const r=workspace.records[h.id] ?? {},c=costs(h,r,prefs),age=pickAge(amount(r.rentOverride)!==null ? r.quoteDate : h.observed_at,now);return c.rent>0 && age!==null && age<=7 ? [c.rent] : [];});return prices.length ? [medianPick(prices)] : [];});
      cohorts[kind]={count:rates.length,median:rates.length>=3 ? medianPick(rates) : null,min:rates.length ? Math.min(...rates) : null,max:rates.length ? Math.max(...rates) : null};
    }
    return {label,homes:items,locations:places.length,cohorts,
      parking:places.filter(g=>g.some(h=>h.parking?.status==='yes')).length,
      ev:places.filter(g=>g.some(h=>h.charging?.status==='yes')).length,
      unknownRent:items.filter(h=>costs(h,workspace.records[h.id],prefs).rent===null).length,
      unverifiedLayouts:items.filter(h=>!['source_listed','confirmed'].includes(layoutEvidence(h,workspace.records[h.id]).status)).length};
  }).sort((a,b)=>b.locations-a.locations || a.label.localeCompare(b.label));
}
function datedRentPoints(history, now) {
  const dates=new Map();
  for(const point of history ?? []){const time=Date.parse(point.date),rent=amount(point.rent);if(!Number.isFinite(time) || time>now.getTime() || !(rent>0))continue;
    if(!dates.has(time))dates.set(time,new Set());dates.get(time).add(rent);
  }
  return [...dates.entries()].filter(([,rents])=>rents.size===1).sort(([a],[b])=>a-b).map(([time,rents])=>({date:new Date(time).toISOString(),rent:[...rents][0]}));
}
export function pricePulse(homes, workspace, prefs=defaults, savedOnly=false, now=new Date(), feed={}) {
  const pool=visibleHomes(homes,workspace,prefs,feed).filter(h=>!savedOnly || workspace.records[h.id]?.saved);
  const changes=[],stale=[];let baseline=0;
  for(const h of pool){const rec=workspace.records[h.id] ?? {};if(rec.status==='ruled out')continue;
    const quoteAge=pickAge(amount(rec.rentOverride)!==null ? rec.quoteDate : h.observed_at,now);
    if(quoteAge===null || quoteAge>7 || h.notebook_only || h.seen_in_latest===false)stale.push(h);
    let hasSeries=false;
    for(const [kind,history] of [['source',h.history],['personal',rec.quote_history]]){
      const points=datedRentPoints(history,now);
      if(points.length<2)continue;hasSeries=true;
      const lastObserved=points.at(-1).date;let index=points.length-1;
      while(index>0 && points[index-1].rent===points[index].rent)index--;
      if(index===0)continue;
      const prior=points[index-1],latest=points[index],delta=latest.rent-prior.rent;
      changes.push({home:h,kind,prior,latest,lastObserved,delta,percent:delta/prior.rent*100,stale:pickAge(lastObserved,now)>7 || !!h.notebook_only || h.seen_in_latest===false});
    }
    if(!hasSeries)baseline++;
  }
  changes.sort((a,b)=>a.latest.date===b.latest.date ? a.delta-b.delta : b.latest.date.localeCompare(a.latest.date));
  return {changes,stale,baseline,total:pool.filter(h=>workspace.records[h.id]?.status!=='ruled out').length};
}
// One saved home's single next step. The shortlist prints this beside the home
// it belongs to and nextMoves() ranks the same objects, so the board and the
// studio can never disagree about what is outstanding: there is one engine.
export function nextMove(home, workspace, prefs=defaults, now=new Date()) {
  const rec=workspace.records[home.id] ?? {};if(!rec.saved || rec.status==='ruled out')return null;
  const clock=chicagoTime(now);
  const cost=costs(home,rec,prefs),layout=layoutEvidence(home,rec),age=pickAge(amount(rec.rentOverride)!==null ? rec.quoteDate : home.observed_at,now);
  const tour=chicagoTime(rec.tourDate);let task;
  if(tour && tour>=clock && (Date.parse(tour)-Date.parse(clock))<=7*86400000)task={title:'Prepare for your tour',why:`Your saved appointment is ${tour.replace('T',' · ')} Chicago time.`,target:'tour-draft-count',priority:100};
  else if(!layout.matches || layout.status!=='confirmed')task={title:'Check the exact layout',why:'Confirm separate bedrooms and the bathroom count before spending time on this option.',target:'layoutReview',priority:80};
  else if(home.notebook_only || home.seen_in_latest===false || age===null || age>7 || cost.unknown.length)task={title:'Get a fresh, complete quote',why:cost.unknown.length ? `Still missing: ${cost.unknown.join(', ')}. Ask for a dated quote and current availability.` : 'The saved quote or source needs a fresh availability check.',target:'leasing-draft',priority:70};
  else if(tourProgress(rec)<tourChecks.length)task={title:'Resolve the remaining tour checks',why:`You have reviewed ${tourProgress(rec)} of ${tourChecks.length} checks. Start with parking, charging and the everyday route.`,target:'tour-draft-count',priority:50};
  else task={title:'Record your decision',why:'Your checklist is complete. Record remaining questions and your decision; completion does not certify the apartment.',target:'notes',priority:20};
  return {home,...task,priority:task.priority+(rec.finalist ? 10 : 0),reviewed:tourProgress(rec),finalist:!!rec.finalist,unknown:cost.unknown,field:cost.unknown.length ? costField(cost.unknown[0]) : null};
}
// What is still unresolved about a saved home, derived from facts the record
// already carries and from nothing else. Every item names the exact existing
// field or evidence section that can settle it; none of them settles anything
// by being opened, and none of them guesses. Ordered by decision weight, the
// same order nextMove() picks its one step from, so the two cannot disagree
// about what matters most.
export function openQuestions(home = {}, record = {}, prefs = defaults, now = new Date()) {
  const cost = costs(home, record, prefs);
  const layout = layoutEvidence(home, record);
  const access = sourceAccess(home);
  const quoteAge = ageDays(amount(record.rentOverride) !== null ? record.quoteDate : home.observed_at, now);
  const reviewed = tourProgress(record);
  const items = [];
  if (layout.status !== "confirmed")
    items.push({ key: "layout", kind: "layout", label: "Layout not checked by you",
      detail: layout.label, target: "layoutReview" });
  for (const missing of cost.unknown)
    items.push({ key: "cost:" + missing, kind: "cost", label: `${missing[0].toUpperCase()}${missing.slice(1)} not quoted`,
      detail: missing === "utilities" ? "Your own estimate, not a quote from anyone." : "No source or quote records this amount.",
      target: costField(missing), field: costField(missing) });
  if (quoteAge === null)
    items.push({ key: "quote", kind: "freshness", label: "No dated quote on record",
      detail: "Ask for a dated quote and current availability.", target: "leasing-draft" });
  else if (quoteAge > 7)
    items.push({ key: "quote", kind: "freshness", label: `Quote is ${quoteAge} days old`,
      detail: "Rent, fees and availability can move. Ask for a fresh one.", target: "leasing-draft" });
  if (home.parking?.status === "unknown")
    items.push({ key: "parking", kind: "amenity", label: "Parking not established by the source",
      detail: "Unknown is not none, and it is not free.", target: "leasing-draft" });
  if (home.charging?.status === "unknown")
    items.push({ key: "charging", kind: "amenity", label: "Resident charging not established",
      detail: "A nearby public station is not a resident amenity.", target: "leasing-draft" });
  if (reviewed < tourChecks.length)
    items.push({ key: "tour", kind: "tour", label: `${tourChecks.length - reviewed} of ${tourChecks.length} tour checks not reviewed`,
      detail: "Your own review at a visit, not a certification.", target: "tour-draft-count" });
  if (home.notebook_only || home.seen_in_latest === false)
    items.push({ key: "presence", kind: "freshness", label: "Absent from the latest area scan",
      detail: "A capped query missing it is not proof it is leased.", target: "detail-sources" });
  if (!access.exact)
    items.push({ key: "source", kind: "source", label: "No exact listing URL on record",
      detail: access.fallback ? "The record offers a labelled search instead." : "Nothing recorded to search for.",
      target: "detail-sources" });
  return items;
}
// ---------------------------------------------------------------------------
// Building form, read off a record's own retained text and nothing else.
//
// What the snapshot holds was measured before this was written. Of 1,000
// retained records, 978 are provider listings and not one carries a word about
// how tall its building is. RentCast's documented listing schema (API-SOURCES
// .md) has no storey count, floor count, building class or subtype, and
// tracker.py reads every documented field plus two undocumented layout probes
// -- so the absence is the provider's schema, not an artefact of normalising
// it. `property_type` is a DWELLING type (Apartment, Condo, Single Family) and
// this repository's rules refuse reading a structure or an amenity off it.
//
// That leaves descriptive text a source actually supplied: the operator's own
// `atmosphere` line, the advertised `amenities`, and what each cited source is
// recorded as supporting. Those three are read. These are NOT:
//   * `access.note` -- the tour checklist ("Confirm step-free entrances,
//     elevators and the route from parking to the apartment"). It is a
//     question to go and ask, identical on all 22 buildings, and reading it as
//     evidence would call every one of them the same thing;
//   * title, address, neighborhood, unit label, property type, price, or how
//     crowded the map looks, each of which is an inference this build refuses;
//   * "rooftop", which is not a height -- a four-storey building can have a
//     rooftop terrace, and ten of these records advertise one.
//
// A record whose sources never described its building is `unknown`, and the
// page is required never to draw unknown as "not a high-rise".
export const HIGH_RISE_STOREYS = 12;
const formPhrases = [
  { status: "high_rise", re: /\b(?:high[- ]?rise|hi-rise|skyscraper)\b/i },
  // A building NAMED "... Tower" has been named, not described. The word is
  // evidence only where it is not the record's own title.
  { status: "high_rise", re: /\btowers?\b/i, refuseIfNamed: true },
  { status: "low_mid_rise", re: /\b(?:low[- ]?rise|mid[- ]?rise|walk[- ]?ups?)\b/i },
];
// "A320 floor-plan" must not read as 320 floors: \b cannot fall inside A320,
// and a plan is excluded by name.
const storeyPhrase = /\b(\d{1,3})[- ]?(?:stor(?:y|ey|ies|eys)|floors?)\b(?![- ]*plan)/i;
const formLabels = {
  high_rise: "High-rise, in the building’s own description",
  low_mid_rise: "Low or mid-rise, in the building’s own description",
  unknown: "Building height not recorded",
};
const formShort = { high_rise: "High-rise recorded", low_mid_rise: "Low/mid-rise recorded", unknown: "Height not recorded" };
function formSources(home) {
  const url = safeUrl(home.source_url), at = home.observed_at;
  const out = [];
  if (typeof home.atmosphere === "string" && home.atmosphere.trim())
    out.push({ field: "the building description", text: home.atmosphere.trim(), url, observed_at: at });
  for (const item of Array.isArray(home.amenities) ? home.amenities : [])
    if (typeof item === "string" && item.trim())
      out.push({ field: "the advertised amenities", text: item.trim(), url, observed_at: at });
  for (const source of Array.isArray(home.sources) ? home.sources : [])
    if (source && typeof source.supports === "string" && source.supports.trim())
      out.push({ field: "a cited source note", text: source.supports.trim(), url: safeUrl(source?.url) || url,
        observed_at: dateOk(source?.observed_at) ? source.observed_at : at });
  return out;
}
export function buildingForm(home = {}) {
  const title = String(home.title ?? "").toLowerCase();
  const hits = [];
  let named = false;
  for (const entry of formSources(home)) {
    for (const rule of formPhrases) {
      const found = rule.re.exec(entry.text);
      if (!found) continue;
      if (rule.refuseIfNamed && title.includes(found[0].toLowerCase())) { named = true; continue; }
      hits.push({ ...entry, status: rule.status, phrase: found[0] });
    }
    const storeys = storeyPhrase.exec(entry.text);
    if (storeys)
      hits.push({ ...entry, phrase: storeys[0],
        status: Number(storeys[1]) >= HIGH_RISE_STOREYS ? "high_rise" : "low_mid_rise" });
  }
  const statuses = new Set(hits.map((hit) => hit.status));
  // Two sources describing one building two ways is not a reading either way.
  if (statuses.size > 1)
    return { status: "unknown", label: formLabels.unknown, short: formShort.unknown, reason: "conflicting_text",
      because: "This record’s own sources describe the building two different ways.",
      phrase: null, field: null, quote: "", url: "", observed_at: null };
  const [hit] = hits;
  if (hit)
    return { status: hit.status, label: formLabels[hit.status], short: formShort[hit.status], reason: null,
      because: `Taken from ${hit.field}, which says “${hit.phrase}”.`,
      phrase: hit.phrase, field: hit.field, quote: hit.text.slice(0, 240), url: hit.url,
      observed_at: dateOk(hit.observed_at) ? hit.observed_at : null };
  return { status: "unknown", label: formLabels.unknown, short: formShort.unknown,
    reason: named ? "name_only" : "no_recorded_description",
    because: named
      ? "The only mention of a tower here is the building’s own name, which describes nothing."
      : "Nothing in this record’s retained sources describes the building’s height. Unknown is not a low-rise.",
    phrase: null, field: null, quote: "", url: "", observed_at: null };
}
// How central a place is, measured from the centre the search itself recorded
// -- a straight line on the map, never a commute, a walk or a judgement about
// what a neighborhood is like. Provider listings in Chicago carry
// "neighborhood unverified" (295 of the 305 retained), so a lens built on
// neighborhood NAMES would be silent for almost every listing; this is built on
// the coordinates the record actually holds. A record without coordinates is
// `unlocated` -- present in every list, absent from a distance answer, and
// never given a position it does not have.
export const urbanBands = { core: 1, near: 3 };
export function urbanAnchor(feed = {}) {
  const centre = feed?.search_area?.center;
  return Number.isFinite(centre?.lat) && Number.isFinite(centre?.lng)
    ? { lat: centre.lat, lng: centre.lng,
        label: typeof centre.label === "string" && centre.label.trim() ? centre.label.trim() : "central Chicago" }
    : { ...searchCenter, label: "central Chicago" };
}
export function urbanSetting(home = {}, feed = {}) {
  const anchor = urbanAnchor(feed);
  const miles = distanceMiles(home, anchor);
  if (miles === null)
    return { status: "unlocated", miles: null, anchor: anchor.label, label: "Distance not measurable",
      detail: "This record has no coordinates, so it cannot be placed on the map or measured. It stays in the list." };
  const status = miles <= urbanBands.core ? "core" : miles <= urbanBands.near ? "near" : "outside";
  return { status, miles, anchor: anchor.label,
    label: { core: "Downtown core", near: "Near downtown", outside: "Outside the downtown bands" }[status],
    detail: `${miles.toFixed(1)} straight-line miles from ${anchor.label}. Straight-line only: not a walk, a drive or a commute.` };
}
// A target is the reader's own number and never a cap: a place above it is
// shown, named as above it, and is not a suggestion to spend more.
export const TARGET_BAND_PCT = 5;
export function budgetBand(home = {}, record = {}, prefs = defaults) {
  const target = amount(prefs.targetRent);
  const cost = costs(home, record, prefs);
  const total = prefs.basis === "total";
  const figure = total ? (cost.rent === null ? null : cost.known) : cost.rent;
  const basis = total ? "known monthly subtotal" : "base rent";
  // Whatever the basis, the figure is not an all-in cost while anything is
  // unquoted, and the band says so rather than letting the reader assume it.
  const caveat = cost.unknown.length
    ? `${total ? "Known subtotal" : "Base rent"} only · ${cost.unknown.join(", ")} not quoted`
    : total ? "Every recorded monthly amount is quoted" : "Base rent only · other monthly costs are quoted separately";
  const base = { target, figure, basis, caveat, delta: null };
  if (target === null) return { ...base, status: "off", label: "No target set" };
  if (figure === null) return { ...base, status: "unpriced", label: "No base rent quoted",
    detail: "Nobody has quoted this one, so it has no figure to put against your target." };
  const edge = (target * TARGET_BAND_PCT) / 100;
  const delta = figure - target;
  const status = delta < -edge ? "under" : delta <= edge ? "near" : figure <= prefs.max ? "stretch" : "outside";
  // Only the band this record is in gets its sentences built.
  const label = status === "under" ? `${money(Math.abs(delta))} under your ${money(target)} target`
    : status === "near" ? `Within ${money(Math.round(edge))} of your ${money(target)} target`
      : status === "stretch" ? `${money(delta)} above your ${money(target)} target`
        : `${money(delta)} above your target and past your ${money(prefs.max)} cap`;
  const detail = status === "stretch"
    ? `On ${basis}, inside your ${money(prefs.max)} cap. Shown so you can weigh it, not because it is worth more. ${caveat}.`
    : status === "outside" ? `On ${basis}. Outside the range your filters are set to.`
      : `On ${basis}. ${caveat}.`;
  return { ...base, delta, status, label, detail };
}
// Four parking answers that mean four different things. An unknown is not a no,
// an advertised space is not a reserved one, and a quoted $0 is a known amount
// rather than a missing one. A public or street space near the building is not
// this building's parking and is never folded in here.
export function parkingStanding(home = {}, record = {}) {
  const status = ["yes", "no", "unknown"].includes(home.parking?.status) ? home.parking.status : "unknown";
  const yours = amount(record.parkingCost);
  const monthly = yours ?? amount(home.parking?.monthly);
  const note = typeof home.parking?.note === "string" ? home.parking.note : "";
  if (status === "no")
    return { status: "none", monthly: null, quotedBy: null, note,
      label: "The source reports no resident parking",
      detail: "Anything you park would be outside the building." };
  if (status === "unknown")
    return { status: "unknown", monthly: null, quotedBy: null, note,
      label: "Parking not recorded",
      detail: "Unknown is not a no, and it is not free." };
  if (monthly === null)
    return { status: "advertised", monthly: null, quotedBy: null, note,
      label: "Parking advertised · price not quoted",
      detail: "The building advertises resident parking. No one has quoted what it costs, and no space is reserved for you." };
  return { status: "priced", monthly, quotedBy: yours === null ? "source" : "you", note,
    label: `Parking advertised · ${money(monthly)}/mo ${yours === null ? "on record" : "in your own quote"}`,
    detail: `${money(monthly)} a month is the amount recorded, not a reserved space. Confirm availability and any one-time charge.` };
}
// One question: is the reader currently reading through the downtown lens? Its
// three controls are ordinary preferences, so every surface asks this rather
// than each keeping its own idea of when the lens is on.
export function doubleDownOn(prefs = defaults) {
  return prefs.urbanScope !== defaults.urbanScope || amount(prefs.targetRent) !== null
    || prefs.highRise === true || prefs.parkingPreferred === true;
}
// A named starting point, offered beside the reader’s own saved searches and
// applied the same way: it MERGES onto whatever they already have, so a bedroom
// choice or an evidence filter they set survives being handed a lens. Every
// value it sets stays visible in the control it came from and can be changed
// one at a time afterwards, so this is a starting point and not a mode. It
// describes a way of looking rather than a person: a later reader wanting a
// quiet two-bedroom in Evanston changes these four fields and keeps the rest.
export const lensPresets = [
  {
    key: "downtown-value",
    name: "Downtown value",
    note: "Near downtown, around a target you can change, with recorded high-rises and advertised parking called out.",
    preferences: { urbanScope: "near", targetRent: 2700, highRise: true, parkingPreferred: true },
  },
];
// The unresolved facts worth carrying onto an attention surface: the record's
// own open questions, in the order openQuestions already ranks them by decision
// weight, with the one the ACTIVE lens makes consequential first. A reader who
// has asked for high-rises is owed the fact that this building's height was
// never recorded -- and a reader who has not asked is not, so it is not
// offered. A tour is a visit the reader has not arranged, not a property of the
// apartment, and is skipped. Nothing is invented to fill a slot: a record with
// nothing outstanding returns an empty list.
export function focusUnknowns(home = {}, record = {}, prefs = defaults, now = new Date(), limit = 1) {
  const lens = [];
  if (prefs.highRise) {
    const form = buildingForm(home);
    if (form.status === "unknown")
      lens.push({ key: "form", kind: "form", label: "Building height not recorded",
        detail: form.because, target: "detail-sources" });
    else if (form.status === "low_mid_rise")
      lens.push({ key: "form", kind: "form", label: "Recorded as low or mid-rise",
        detail: "You asked for high-rises; this record’s own description says otherwise.", target: "detail-sources" });
  }
  // Asking for parking makes its absence from the record the thing worth
  // knowing first. An unrecorded answer stays unrecorded, an advertised space
  // with no price is a cost question, and a building reporting none is a third
  // fact -- the preference changes which is raised, never what any of them say.
  if (prefs.parkingPreferred) {
    const standing = parkingStanding(home, record);
    if (standing.status === "unknown")
      lens.push({ key: "parking", kind: "amenity", label: "Parking not recorded",
        detail: standing.detail, target: "leasing-draft" });
    else if (standing.status === "advertised")
      lens.push({ key: "cost:parking", kind: "cost", label: "Parking price not quoted",
        detail: standing.detail, target: "parkingCost", field: "parkingCost" });
    else if (standing.status === "none")
      lens.push({ key: "parking", kind: "amenity", label: "The source reports no resident parking",
        detail: standing.detail, target: "leasing-draft" });
  }
  const out = [], seen = new Set();
  for (const item of [...lens, ...openQuestions(home, record, prefs, now).filter((item) => item.kind !== "tour")]) {
    if (seen.has(item.key)) continue;
    seen.add(item.key);
    out.push(item);
    if (out.length >= limit) break;
  }
  return out;
}
// Why a candidate is on an attention surface -- and nothing else.
//
// Every entry names a rule that actually ran for THIS record: a filter the
// reader moved off its default and this record satisfied, the ranking signal
// that contributed most to its place under the chosen priority, or a recorded
// fact one of those rules read. A filter still at its default narrowed nothing,
// so it explains nothing and is not offered. That is also why this copy cannot
// go stale: it is derived from the CURRENT preferences every time it is asked,
// so a reason whose rule stops applying stops being produced.
//
// SpicyPicks and Focus are attention aids over the retained pool. Nothing here
// says an omitted apartment is worse or unavailable, and nothing here calls an
// apartment a fit.
const signalReason = {
  // A record nobody has quoted a base rent for has no figure to be under a cap:
  // its known subtotal is zero, and "the full cap below your cap" would read as
  // the cheapest thing on the page. An unquoted rent is never a budget reason.
  budget: (home, { cost, prefs }) => cost.rent !== null && cost.known < prefs.max
    ? `${money(prefs.max - cost.known)} under your ${money(prefs.max)} ${prefs.basis === "total" ? "known-subtotal" : "base-rent"} cap${cost.unknown.length ? " \u00b7 unquoted costs still apply" : ""}`
    : null,
  space: (home) => home.sqft > 0 ? `${home.sqft} reported sq ft` : null,
  amenities: (home) => home.parking?.status === "yes" && home.charging?.status === "yes"
    ? "Resident parking and EV charging are both advertised"
    : home.parking?.status === "yes" ? "Resident parking is advertised"
      : home.charging?.status === "yes" ? "Resident EV charging is advertised" : null,
  evidence: (home, { layout }) => layout.status === "confirmed" ? "You checked this bedroom and bathroom layout"
    : layout.status === "source_listed" ? "An identified floor plan supports the bedroom count" : null,
  value: (home, { pick }) => pick?.saving !== null && pick?.saving !== undefined && pick.saving >= .05
    ? `${Math.round(pick.saving * 100)}% lower base rent per sq ft than the median of ${pick.peerCount} nearby comparison locations`
    : null,
  rail: (home, { pick }) => pick?.nearby
    ? `${pick.nearby.distance.toFixed(2)} mi straight-line to ${pick.nearby.title} CTA station` : null,
  // Only a recorded high-rise has anything to say here. An unrecorded height
  // did not raise this candidate and must not be written as though it had.
  form: (home) => buildingForm(home).status === "high_rise"
    ? "The building\u2019s own description calls it a high-rise" : null,
};
export function surfacedBecause(home, workspace = emptyWorkspace(), prefs = defaults, context = {}, now = new Date()) {
  const rec = workspace.records?.[home.id] ?? {};
  const layout = layoutEvidence(home, rec);
  const cost = costs(home, rec, prefs);
  const { pick = null, weights = null, priority = null } = context;
  const out = [];
  const add = (key, kind, text) => { if (text && !out.some((r) => r.key === key)) out.push({ key, kind, text }); };

  // 1. The gates the reader themselves moved. visibleHomes() applied each one,
  //    and each sentence re-checks the record against the gate it names rather
  //    than trusting that the caller only asks about records that passed.
  const city = homeCity(home);
  if (prefs.search.trim() && `${home.title} ${home.address} ${home.neighborhood} ${city} ${planLabel(home)}`
    .toLowerCase().includes(prefs.search.trim().toLowerCase()))
    add("search", "filter", `Matches your search for “${prefs.search.trim()}”`);
  if (prefs.neighborhood !== defaults.neighborhood && home.neighborhood === prefs.neighborhood)
    add("neighborhood", "filter", `In ${home.neighborhood}, the area you chose`);
  if (prefs.region !== defaults.region && city
    && (prefs.region === "chicago" ? city === "Chicago" : suburbCities.includes(city)))
    add("region", "filter", `In ${city}, inside the ${prefs.region === "chicago" ? "Chicago-only" : "suburbs-only"} area you chose`);
  if (prefs.radiusMiles !== defaults.radiusMiles) {
    const away = distanceMiles(home, searchCenter);
    if (away !== null && away <= prefs.radiusMiles)
      add("radius", "filter", `${away.toFixed(1)} straight-line miles from central Chicago, inside your ${prefs.radiusMiles}-mile limit`);
  }
  if (prefs.bedrooms !== defaults.bedrooms && layout.bedrooms === Number(prefs.bedrooms))
    add("bedrooms", "filter", `${layout.bedrooms} bedroom, the size you chose`);
  if (prefs.layoutScope === "confirmed" && layout.status === "confirmed")
    add("layoutScope", "filter", "A layout you checked yourself, which your evidence filter requires");
  else if (prefs.layoutScope === "source" && ["source_listed", "confirmed"].includes(layout.status))
    add("layoutScope", "filter", layout.status === "confirmed"
      ? "A layout you checked yourself, which your evidence filter accepts"
      : "A source-listed floor plan, which your evidence filter requires");
  if (prefs.urbanScope !== defaults.urbanScope) {
    const setting = urbanSetting(home, context.feed ?? {});
    if (prefs.urbanScope === "core" ? setting.status === "core" : ["core", "near"].includes(setting.status))
      add("urbanScope", "filter", `${setting.miles.toFixed(1)} straight-line miles from ${setting.anchor}, inside the ${prefs.urbanScope === "core" ? "downtown core" : "near-downtown area"} you chose`);
  }
  // A height nobody recorded says nothing, whatever the reader asked for.
  if (prefs.highRise && buildingForm(home).status === "high_rise")
    add("form", "filter", "Its own description calls it a high-rise, the kind you asked to see first");
  if (amount(prefs.targetRent) !== null) {
    const band = budgetBand(home, rec, prefs);
    if (["under", "near", "stretch"].includes(band.status))
      add("target", "filter", `${band.label}, on ${band.basis}`);
  }
  if (prefs.parkingPreferred) {
    const standing = parkingStanding(home, rec);
    if (standing.status === "priced")
      add("parkingPreferred", "filter", `${standing.label}, the kind of answer you asked to see`);
    else if (standing.status === "advertised")
      add("parkingPreferred", "filter", "Resident parking is advertised, which you asked to prioritise");
  }
  if (prefs.parking && home.parking?.status === "yes")
    add("parking", "filter", "Resident parking is advertised, which your filter requires");
  if (prefs.charging && home.charging?.status === "yes")
    add("charging", "filter", "Resident EV charging is advertised, which your filter requires");
  if (prefs.min !== defaults.min || prefs.max !== defaults.max || prefs.basis !== defaults.basis)
    add("budget", "filter", signalReason.budget(home, { cost, prefs }));

  // 2. The signal that contributed most to its place under the chosen priority.
  //    This is a readback of the weight the ranking already used, not a score.
  if (pick?.signals && weights) {
    const [top] = Object.entries(weights)
      .map(([key, points]) => [key, (pick.signals[key] ?? 0) * points])
      .filter(([, value]) => value > 0)
      .sort((a, b) => b[1] - a[1]);
    if (top) add(top[0], priority === "recipe" ? "recipe" : "priority",
      signalReason[top[0]]?.(home, { cost, prefs, layout, pick }));
  }

  // 3. Recorded facts the rules above read, for a reader who narrowed nothing.
  add("budget", "budget", signalReason.budget(home, { cost, prefs }));
  add("layout", "evidence", signalReason.evidence(home, { layout }));
  const seen = ageDays(home.observed_at, now);
  if (seen !== null && seen <= 7)
    add("observed", "evidence", `Observed ${seen === 0 ? "today" : seen === 1 ? "yesterday" : seen + " days ago"}`);
  const moved = changeFor(home);
  if (moved) add("history", "evidence", `${money(Math.abs(moved))} ${moved < 0 ? "lower" : "higher"} than the previous recorded observation`);
  return out;
}
// The one unresolved fact worth carrying onto an attention surface: the first
// of the record's OWN open questions, in the order openQuestions already ranks
// them by decision weight, skipping the tour checklist -- a visit the reader
// has not arranged is not a property of the apartment or of its evidence. A
// record with nothing outstanding returns null, and the surface then says
// nothing rather than inventing an unknown to fill the slot.
export function headlineUnknown(home = {}, record = {}, prefs = defaults, now = new Date()) {
  return focusUnknowns(home, record, prefs, now, 1)[0] ?? null;
}
// A difference is only a fact when every place holds that figure on the same
// basis. One engine, so the Final Three and the full comparison cannot report
// the same set of numbers differently; neither of them names a winner.
export function figureSpread(entries = []) {
  const missing = entries.filter((e) => !Number.isFinite(e.value));
  if (entries.length < 2) return { comparable: false, reason: "one", missing: [], entries };
  if (missing.length) return { comparable: false, reason: "missing", missing: missing.map((e) => e.name), entries };
  const values = entries.map((e) => e.value);
  const lo = Math.min(...values), hi = Math.max(...values);
  return { comparable: true, reason: lo === hi ? "same" : "spread", missing: [], lo, hi, delta: hi - lo, entries };
}
// The exact notebook field that records a missing monthly amount. Opening a
// field is not an answer -- saving one is -- so this only says where to type.
export const costFields={'base rent':'rentOverride',parking:'parkingCost','monthly fees':'monthlyFees',utilities:'utilities'};
export function costField(label) { return costFields[label] ?? 'leasing-draft'; }
export function nextMoves(homes, workspace, prefs=defaults, now=new Date()) {
  return homes.map(home=>nextMove(home,workspace,prefs,now)).filter(Boolean)
    .sort((a,b)=>b.priority-a.priority || a.home.id.localeCompare(b.home.id)).slice(0,3);
}

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
export const money = (n) =>
  Number.isFinite(n)
    ? new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      }).format(n)
    : "Not quoted";
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
  };
}
export function visibleHomes(homes, workspace, prefs) {
  return homes
    .filter((h) => {
      const city = homeCity(h);
      if (prefs.region === "chicago" && city !== "Chicago") return false;
      if (prefs.region === "suburbs" && !suburbCities.includes(city)) return false;
      if (prefs.radiusMiles) {
        const distance = distanceMiles(h, searchCenter);
        if (distance === null || distance > prefs.radiusMiles) return false;
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
    !["parking", "charging", "unknown"].every(
      (k) => typeof p[k] === "boolean",
    ) ||
    !nullableAmount(p.utilityEstimate)
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
  ["ev","EV + parking"], ["rail","Near CTA"],
];
const pickWeights = {
  balanced:{budget:35,value:20,space:10,amenities:25,evidence:10},
  budget:{budget:65,value:25,space:0,amenities:0,evidence:10},
  space:{budget:15,value:20,space:55,amenities:0,evidence:10},
  ev:{budget:30,value:10,space:5,amenities:45,evidence:10},
  rail:{budget:25,value:10,space:5,amenities:5,evidence:10,rail:45},
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
export function spicyPicks(homes, workspace, prefs=defaults, context={}, lens="balanced", now=new Date()) {
  const records=workspace.records ?? {}, weight=pickWeights[lens] ?? pickWeights.balanced;
  const observed = homes.filter((home)=>{
    const rec=records[home.id] ?? {}, layout=layoutEvidence(home,rec), age=pickAge(home.observed_at,now);
    return !home.notebook_only && home.seen_in_latest!==false && !(amount(rec.rentOverride)!==null && Date.parse(rec.quoteDate)>now.getTime()) && layout.matches && [1,2].includes(layout.bedrooms) && [1,1.5,2].includes(layout.bathrooms) && age!==null && age<=30;
  });
  const current=observed.filter((home)=>(records[home.id] ?? {}).status!=="ruled out");
  const scoped=visibleHomes(current,workspace,prefs);
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
    return {home,cost,layout,score,reasons,catches,nearby,rate,peerCount,peerMedian,saving,fresh,quoted,quoteDate:quoted ? rec.quoteDate : home.observed_at,signals};
  }).filter((pick)=>lens!=="ev" || pick.home.parking?.status==="yes" && pick.home.charging?.status==="yes")
    .filter((pick)=>lens!=="rail" || pick.nearby)
    .filter((pick)=>lens!=="space" || pick.home.sqft>0)
    .sort((a,b)=>b.score-a.score || a.cost.known-b.cost.known || a.home.id.localeCompare(b.home.id));
  const picks=[];
  for(const pick of ranked){if(picks.some((selected)=>groupsById.get(selected.home.id)===groupsById.get(pick.home.id)))continue;picks.push(pick);if(picks.length===3)break;}
  const leads=[];
  for(const home of scoped.filter((home)=>(lens!=="ev" || home.parking?.status==="yes" && home.charging?.status==="yes") && (lens!=="space" || home.sqft>0) && (lens!=="rail" || stations.some((station)=>{const d=distanceMiles(home,station);return d!==null && d<=.5;}))).filter((home)=>costs(home,records[home.id],prefs).rent===null && amount(home.advertised_price)>0 && home.advertised_price<=prefs.max && (home.parking?.status==="yes" || home.charging?.status==="yes")).sort((a,b)=>Number(b.charging?.status==="yes")-Number(a.charging?.status==="yes") || a.id.localeCompare(b.id))){
    if(leads.some((other)=>samePickPlace(other,home)) || picks.some((pick)=>samePickPlace(pick.home,home)))continue;leads.push(home);if(leads.length===2)break;
  }
  return {picks,leads,eligible:ranked.length,visible:scoped.length,excluded:homes.length-current.length,lens:pickWeights[lens] ? lens : "balanced",weights:weight,ctaAvailable:stations.length>0};
}

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
};
export function layoutEvidence(home, record = {}) {
  const review = record.layoutReview;
  if (["studio", "other"].includes(review))
    return { status: review, label: review === "studio" ? "Marked by you: studio / convertible" : "You marked a different layout", matches: false };
  if (review === "one_bed")
    return { status: "confirmed", label: "1 bed · 1 bath — checked by you", matches: true };
  if (home.bedrooms === 0 || home.layout_status === "studio")
    return { status: "studio", label: "Studio · excluded from one-bedroom search", matches: false };
  if (home.layout_status === "conflict")
    return { status: "conflict", label: "Conflicting layout information", matches: false };
  if (home.layout_status === "other" || (home.bedrooms != null && home.bedrooms !== 1) || (home.bathrooms != null && home.bathrooms !== 1))
    return { status: "other", label: "Different bed / bath layout", matches: false };
  if (home.layout_status === "unverified" || home.bedrooms == null || home.bathrooms == null)
    return { status: "unverified", label: "Layout needs checking", matches: true };
  if (home.kind === "building" && home.floor_plan && home.sources?.length && home.layout_status !== "unverified")
    return { status: "source_listed", label: "Source lists 1 bed · 1 bath", matches: true };
  if (home.kind === "manual")
    return { status: "unverified", label: "1 bed · 1 bath entered — not checked", matches: true };
  return { status: "provider_reported", label: "1 bed · 1 bath reported — not checked", matches: true };
}
export function planLabel(home) {
  if (home.floor_plan) return `Plan ${home.floor_plan}`;
  const unit = home.unit_label || home.address?.match(/\b(?:unit|apt|apartment|suite)\s*#?\s*([\w-]+)/i)?.[0];
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
      const rec = workspace.records[h.id] ?? {};
      const layout = layoutEvidence(h, rec);
      if (!layout.matches) return false;
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
      return `${h.title} ${h.address} ${h.neighborhood} ${planLabel(h)}`
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
  if (h.layout_declaration != null && !["studio", "one_bed", "conflict"].includes(h.layout_declaration)) return false;
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
  return d;
}
export function emptyWorkspace() {
  return {
    version: VERSION,
    records: {},
    manual: [],
    events: [],
    preferences: { ...defaults },
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
      (r.saved !== undefined && typeof r.saved !== "boolean")
    )
      throw Error("The backup contains an invalid record.");
    if (r.layoutReview !== undefined && !["one_bed", "studio", "other", "unverified"].includes(r.layoutReview))
      throw Error("The backup contains an invalid layout review.");
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
  const p = { ...defaults, ...(isObj(w.preferences) ? w.preferences : {}) };
  if (
    !Number.isFinite(p.min) ||
    !Number.isFinite(p.max) ||
    p.min < 0 ||
    p.max < p.min ||
    p.max > 20000 ||
    !["rent", "total"].includes(p.basis) ||
    !["rent", "recent", "space"].includes(p.sort) ||
    !["all", "source", "confirmed"].includes(p.layoutScope) ||
    !textOk(p.search, 500) ||
    !textOk(p.neighborhood, 500) ||
    !["parking", "charging", "unknown"].every(
      (k) => typeof p[k] === "boolean",
    ) ||
    !nullableAmount(p.utilityEstimate)
  )
    throw Error("The backup contains invalid search preferences.");
  return { ...w, preferences: p };
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

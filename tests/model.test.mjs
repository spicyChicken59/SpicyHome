import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  costs,
  defaults,
  visibleHomes,
  validateFeed,
  validateHome,
  validateWorkspace,
  emptyWorkspace,
  safeUrl,
  esc,
  ageDays,
  changeFor,
  distanceMiles,
  layoutEvidence,
  planLabel,
} from "../dist/model.js";
const seed = JSON.parse(
  fs.readFileSync(new URL("../data/seed.json", import.meta.url)),
);
const home = seed.homes.find((h) => h.id === "amli-900");
test("studios and explicit conflicts never become one-bedroom candidates", () => {
  for (const patch of [{bedrooms:0},{bedrooms:2},{bathrooms:2},{layout_status:"conflict"},{layout_status:"other"}]) {
    const h={...home,...patch};
    assert(validateHome(h));
    assert.equal(visibleHomes([h],emptyWorkspace(),defaults).length,0);
  }
  assert(!validateHome({...home,bedrooms:true}));
  assert(!validateHome({...home,bathrooms:"1"}));
});
test("provider counts and small sizes never imply a checked bedroom", () => {
  const h={...home,kind:"listing",floor_plan:undefined,layout_status:"provider_reported",sqft:422};
  assert.equal(layoutEvidence(h).status,"provider_reported");
  assert.equal(visibleHomes([h],emptyWorkspace(),{...defaults,layoutScope:"confirmed"}).length,0);
  assert.equal(visibleHomes([h],emptyWorkspace(),defaults).length,1);
});
test("local studio corrections survive imported legacy snapshots without losing quotes", () => {
  const w=emptyWorkspace();w.records[home.id]={saved:true,snapshot:home,notes:"Tour notes",rentOverride:2400,layoutReview:"studio"};
  const imported=validateWorkspace(JSON.parse(JSON.stringify(w)));
  assert.equal(visibleHomes([home],imported,defaults).length,0);
  assert.equal(imported.records[home.id].rentOverride,2400);
  assert.equal(imported.records[home.id].notes,"Tour notes");
  assert.throws(()=>validateWorkspace({...w,records:{bad:{layoutReview:"anything"}}}));
});
test("only a user check enters the checked-layout search", () => {
  const w=emptyWorkspace();w.records[home.id]={layoutReview:"one_bed"};
  assert.equal(visibleHomes([home],w,{...defaults,layoutScope:"confirmed"}).length,1);
  assert.equal(layoutEvidence(home).status,"source_listed");
  assert.equal(layoutEvidence({...home,kind:"manual",bedrooms:0},{layoutReview:"one_bed"}).status,"confirmed");
  assert.match(planLabel(home),/Trendy/);
  assert.equal(planLabel({...home,kind:"listing",floor_plan:undefined,address:"2030 S Clark St"}),"Unit not identified by source");
});
test("unknown manual layout is valid without silently becoming one bedroom", () => {
  const h={...home,kind:"manual",bedrooms:null,bathrooms:null};
  assert(validateHome(h));assert.equal(layoutEvidence(h).status,"unverified");
  assert.equal(visibleHomes([h],emptyWorkspace(),{...defaults,layoutScope:"confirmed"}).length,0);
  assert.equal(layoutEvidence({...home,layout_status:"unverified"}).status,"unverified");
});
test("official research is valid and ten sourced map pins are present", () => {
  assert.equal(validateFeed(seed).homes.length, 10);
  assert(
    seed.homes.every(
      (h) =>
        Number.isFinite(h.lat) && Number.isFinite(h.lng) && h.sources.length,
    ),
  );
});
test("unknown parking is never free", () => {
  const c = costs(home);
  assert.equal(c.rent, 2507);
  assert.equal(c.known, 2572);
  assert(c.unknown.includes("parking"));
  assert(c.unknown.includes("utilities"));
  assert.equal(c.complete, false);
});
test("explicit zero utilities means included, not unquoted", () => {
  const c = costs(home, { parkingCost: 0, utilities: 0 });
  assert.equal(c.known, 2572);
  assert.equal(c.utilities, 0);
  assert.equal(c.complete, true);
});
test("quoted overrides preserve zero costs", () => {
  const c = costs(home, {
    rentOverride: 2400,
    parkingCost: 200,
    monthlyFees: 0,
    utilities: 80,
  });
  assert.equal(c.known, 2680);
  assert.equal(c.complete, true);
});
test("total monthly quote does not become base rent", () => {
  const h = seed.homes.find((h) => h.id === "the-elle");
  assert.equal(costs(h).rent, null);
  assert.equal(h.advertised_price, 2526);
});
test("base budget excludes above-budget prospect and retains unquoted leads", () => {
  const list = visibleHomes(seed.homes, emptyWorkspace(), defaults);
  assert(!list.some((h) => h.id === "73-east-lake"));
  assert(list.some((h) => h.id === "marlowe"));
  assert(list.every((h) => h.rent === null || h.rent <= 3000));
});
test("strict rent filter removes unquoted base rents", () => {
  const list = visibleHomes(seed.homes, emptyWorkspace(), {
    ...defaults,
    unknown: false,
  });
  assert.equal(list.length, 3);
});
test("known subtotal budget applies quoted parking costs", () => {
  const w = emptyWorkspace();
  w.records[home.id] = { parkingCost: 600, utilities: 0 };
  assert(!visibleHomes([home], w, { ...defaults, basis: "total" }).length);
});
test("EV filter does not infer charging from a garage", () => {
  const h = seed.homes.find((h) => h.id === "215-west");
  assert.equal(
    visibleHomes([h], emptyWorkspace(), { ...defaults, charging: true }).length,
    0,
  );
});
test("search and neighborhood filters combine", () => {
  assert.equal(
    visibleHomes(seed.homes, emptyWorkspace(), {
      ...defaults,
      neighborhood: "South Loop",
      search: "900",
    }).length,
    1,
  );
});
test("unknown values and invalid numbers are rejected in costs", () => {
  assert.equal(costs({ ...home, rent: NaN }).rent, null);
  assert.equal(costs(home, { parkingCost: -1 }).parking, null);
});
test("bad feed history and amenities are rejected before render", () => {
  for (const patch of [
    { history: {} },
    { amenities: "pool" },
    { sources: [null] },
    { parking: { status: "maybe" } },
    { rent: Infinity },
    { lat: 999 },
  ])
    assert.throws(() =>
      validateFeed({ ...seed, homes: [{ ...home, ...patch }] }),
    );
});
test("feed IDs are unique and events are structurally valid", () => {
  assert.throws(() => validateFeed({ ...seed, homes: [home, home] }));
  assert.throws(() => validateFeed({ ...seed, events: [null] }));
});
test("backups reject invalid dates, event entries and preference injection", () => {
  for (const patch of [
    { events: [null] },
    { records: { a: { tourDate: {} } } },
    { preferences: { min: "0 onmouseover=x" } },
    { records: { a: { utilities: -2 } } },
  ])
    assert.throws(() => validateWorkspace({ ...emptyWorkspace(), ...patch }));
});
test("backup accepts saved listing snapshots and zero quotes", () => {
  const w = emptyWorkspace();
  w.records[home.id] = {
    saved: true,
    snapshot: home,
    utilities: 0,
    status: "toured",
    quote_history: [{ date: "2026-09-07", rent: 2500 }],
  };
  assert.equal(validateWorkspace(w).records[home.id].utilities, 0);
});
test("backup prevents dangerous record keys", () => {
  const w = emptyWorkspace();
  w.records = JSON.parse('{"__proto__":{"saved":true}}');
  assert.throws(() => validateWorkspace(w));
});
test("dangerous source URLs are not links and text is escaped", () => {
  assert.equal(safeUrl("javascript:alert(1)"), "");
  assert.equal(safeUrl("data:text/html,hi"), "");
  assert.equal(esc('<img onerror="x">'), "&lt;img onerror=&quot;x&quot;&gt;");
});
test("no fabricated price trend for a single observation", () => {
  assert.equal(changeFor(home), null);
  assert.equal(
    changeFor({ ...home, history: [{ rent: 2600 }, { rent: 2500 }] }),
    -100,
  );
});
test("dates and distances have explicit units", () => {
  assert.equal(ageDays("2026-09-01", new Date("2026-09-08T00:00:00Z")), 7);
  assert.equal(distanceMiles({ lat: null, lng: 0 }, home), null);
  assert.equal(distanceMiles(home, home), 0);
});

test("plan and unit identifiers are searchable and structured declarations validate", () => {
  assert.equal(visibleHomes([home],emptyWorkspace(),{...defaults,search:home.floor_plan}).length,1);
  const listing={...home,kind:"listing",floor_plan:undefined,unit_label:"Unit 427"};
  assert.equal(visibleHomes([listing],emptyWorkspace(),{...defaults,search:"427"}).length,1);
  assert(validateHome({...home,layout_declaration:"conflict"}));
  assert(!validateHome({...home,layout_declaration:"anything"}));
});

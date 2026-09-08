import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
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
  homeCity,
  searchCenter,
  scanBedroomScope,
  costScenario,
  tourProgress,
} from "../dist/model.js";
const seed = JSON.parse(
  fs.readFileSync(new URL("../data/seed.json", import.meta.url)),
);
const home = seed.homes.find((h) => h.id === "amli-900");
test("studios and explicit conflicts never become one- or two-bedroom candidates", () => {
  for (const patch of [{bedrooms:0},{bedrooms:3},{bathrooms:2.5},{layout_status:"conflict"},{layout_status:"other"}]) {
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
test("official city and suburban research is valid with only sourced map pins", () => {
  assert.equal(validateFeed(seed).homes.length, 22);
  assert(
    seed.homes.every(
      (h) =>
        h.sources.length && ((Number.isFinite(h.lat) && Number.isFinite(h.lng)) || (h.lat === null && h.lng === null && h.coordinate_note)),
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
  assert.equal(list.length, 6);
  assert(list.every((h) => h.rent !== null));
  assert(!list.some((h) => h.id === "tapestry-station"));
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

test("city, suburb and distance filters keep geography explicit", () => {
  const suburban=seed.homes.find((h)=>h.id==="amli-evanston");
  const unlocated=seed.homes.find((h)=>h.id==="burlington-station");
  const homes=[home,suburban,unlocated];const w=emptyWorkspace();
  assert.equal(homeCity({...home,city:undefined}),"Chicago");
  assert.equal(homeCity({...home,city:"CHICAGO"}),"Chicago");
  assert.equal(homeCity({...suburban,city:"evanston"}),"Evanston");
  assert.equal(visibleHomes([{...suburban,city:"evanston"}],w,{...defaults,region:"suburbs"}).length,1);
  assert.equal(planLabel(seed.homes.find((h)=>h.id==="tapestry-station")),"Plan The Main · Unit 212");
  assert.deepEqual(visibleHomes(homes,w,{...defaults,region:"chicago"}).map(h=>h.id),[home.id]);
  assert.equal(visibleHomes(homes,w,{...defaults,region:"suburbs"}).length,2);
  assert.equal(visibleHomes([suburban],w,{...defaults,radiusMiles:10}).length,0);
  assert.equal(visibleHomes([suburban],w,{...defaults,radiusMiles:20}).length,1);
  assert.equal(visibleHomes([unlocated],w,{...defaults,radiusMiles:35}).length,0);
  assert.equal(visibleHomes([unlocated],w,defaults).length,1);
  const legacy=emptyWorkspace();delete legacy.preferences.region;delete legacy.preferences.radiusMiles;
  assert.equal(validateWorkspace(legacy).preferences.region,"all");
  assert.throws(()=>validateWorkspace({...legacy,preferences:{region:"anywhere"}}));
  assert.throws(()=>validateWorkspace({...legacy,preferences:{radiusMiles:500}}));
  assert(distanceMiles(suburban,searchCenter)>10);
});

test("bedroom filters use exact counts and preserve bathroom labels", () => {
  const w=emptyWorkspace();
  const two={...home,id:"two",bedrooms:2,bathrooms:2};
  const unknown={...home,id:"unknown",bedrooms:null,bathrooms:null};
  const homes=[home,two,unknown];
  assert.equal(visibleHomes(homes,w,defaults).length,3);
  assert.deepEqual(visibleHomes(homes,w,{...defaults,bedrooms:"1"}).map(h=>h.id),[home.id]);
  assert.deepEqual(visibleHomes(homes,w,{...defaults,bedrooms:"2"}).map(h=>h.id),["two"]);
  assert.match(layoutEvidence(two).label,/2 bed · 2 bath/);
  assert.equal(visibleHomes([{...two,bathrooms:1.5}],w,{...defaults,bedrooms:"2"}).length,1);
});
test("two-bedroom checks override source counts while legacy checks retain their exact meaning", () => {
  const w=emptyWorkspace();delete w.preferences.bedrooms;
  w.records[home.id]={saved:true,snapshot:home,layoutReview:"two_bed_two_bath",notes:"Keep my notes",rentOverride:2500};
  const imported=validateWorkspace(JSON.parse(JSON.stringify(w)));
  assert.equal(imported.preferences.bedrooms,"all");
  assert.equal(visibleHomes([home],imported,{...defaults,bedrooms:"2",layoutScope:"confirmed"}).length,1);
  assert.equal(visibleHomes([home],imported,{...defaults,bedrooms:"1"}).length,0);
  assert.match(layoutEvidence(home,imported.records[home.id]).label,/2 bed · 2 bath/);
  assert.equal(imported.records[home.id].notes,"Keep my notes");
  assert.equal(imported.records[home.id].rentOverride,2500);
  imported.records[home.id].layoutReview="one_bed";
  assert.deepEqual([layoutEvidence({...home,bedrooms:2,bathrooms:2},imported.records[home.id]).bedrooms,layoutEvidence(home,imported.records[home.id]).bathrooms],[1,1]);
  assert.throws(()=>validateWorkspace({...w,preferences:{...defaults,bedrooms:"3"}}));
});

test("malformed layout review values cannot become personal confirmation", () => {
  for (const layoutReview of [["two_bed_two_bath"],{},null,2]) {
    const w=emptyWorkspace();w.records[home.id]={layoutReview};
    assert.throws(()=>validateWorkspace(w));
    assert.notEqual(layoutEvidence(home,{layoutReview}).status,"confirmed");
  }
});

test("area scope distinguishes old one-bedroom scans from broader observations", () => {
  const provider={query:{city:"Chicago",bedrooms:1},area_scans:{Chicago:{last_success:"2026-09-07"}}};
  assert.match(scanBedroomScope(provider,"Chicago"),/2-bedroom listing coverage pending/);
  assert.match(scanBedroomScope(provider,"Evanston"),/First listing scan pending/);
  provider.area_scans.Chicago.query={bedrooms:"1|2"};
  assert.match(scanBedroomScope(provider,"Chicago"),/included 1 & 2 bedrooms/);
  provider.area_scans.Chicago.query={bedrooms:{bad:true}};
  assert.match(scanBedroomScope(provider,"Chicago"),/not recorded/);
});
test("provider-normalized malformed optional fields remain readable by the browser", () => {
  const normalized=JSON.parse(execFileSync('python',['-c',`
import sys,json
sys.path.insert(0,'src')
import tracker as t
cfg=json.load(open('data/search.json'))
row=dict(id='contract',formattedAddress='200 W Adams St, Chicago, IL',addressLine1={'bad':True},addressLine2=['bad'],propertyType={'bad':True},city='Chicago',state='IL',bedrooms=2,bathrooms=2,price=2400,status='Active',latitude=41.879,longitude=-87.634)
homes,_=t.normalize([row],cfg,'2026-09-08T04:00:00Z')
print(json.dumps(homes))
`],{cwd:new URL('..',import.meta.url),encoding:'utf8'}));
  assert.equal(normalized[0].title,normalized[0].address);
  assert.equal(normalized[0].unit_label,null);
  assert.equal(normalized[0].property_type,null);
  assert(validateFeed({...seed,homes:normalized}));
});

test("cost scenarios keep assumed amounts separate and preserve unknowns", () => {
  const h={...home,rent:null,parking:{status:'unknown',monthly:null},fees:{monthly:null}};
  const rec={notes:'Do not change',rentOverride:null};
  const baseline=costScenario(h,rec,{});
  assert.equal(baseline.monthly,null);
  assert.equal(baseline.complete,false);
  assert(baseline.missing.includes('Base rent'));
  const result=costScenario(h,rec,{rent:2200,parking:100,fees:0,utilities:80,charging:25},12);
  assert.equal(result.monthly,2405);
  assert.equal(result.termTotal,28860);
  assert.equal(result.complete,true);
  assert.equal(result.items.filter(i=>i.assumed).length,5);
  assert.equal(h.rent,null);assert.equal(rec.rentOverride,null);assert.equal(rec.notes,'Do not change');
  assert.equal(costScenario(h,rec,{rent:2200},12).complete,false);
});
test("scenario quotes, zeroes and chosen month counts remain explicit", () => {
  const rec={rentOverride:2300,parkingCost:0,monthlyFees:0,utilities:80};
  const result=costScenario(home,rec,{charging:0},6);
  assert.equal(result.monthly,2380);assert.equal(result.termTotal,14280);
  assert.equal(result.items[0].assumed,false);
  assert.equal(result.items[4].assumed,true);
  assert.equal(costScenario(home,rec,{rent:-1}).items[0].value,2300);
  assert.equal(costScenario(home,rec,{},0).term,12);
});
test("tour checklists survive backup round trips without implying layout confirmation", () => {
  const w=emptyWorkspace();w.records[home.id]={saved:true,snapshot:home,notes:'Daylight first',tourChecks:{layout:true,light:true,charging:false}};
  const imported=validateWorkspace(JSON.parse(JSON.stringify(w)));
  assert.equal(tourProgress(imported.records[home.id]),2);
  assert.equal(layoutEvidence(home,imported.records[home.id]).status,'source_listed');
  for(const tourChecks of [{unknown:true},{layout:'yes'},[],null])assert.throws(()=>validateWorkspace({...w,records:{[home.id]:{tourChecks}}}));
  delete w.preferences.surface;assert.equal(validateWorkspace(w).preferences.surface,'split');
  assert.throws(()=>validateWorkspace({...w,preferences:{...defaults,surface:'unknown'}}));
});

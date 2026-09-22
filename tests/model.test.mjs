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
  atlasPoints,
  leasingQuestions,
  moveInScenario,
  spicyPicks,
  recipeDefaults, recipeWeights, remixPicks, apartmentTradeoffs, areaMatch, pricePulse, nextMoves, nextMove, costField,
  sourceAccess, sourceReferences, searchIdentity, scanContext, chargingEvidence, isDocumentationUrl, publicChargingMiles,
  openQuestions, figureSpread, tourChecks, surfacedBecause, headlineUnknown, decisionPool,
  buildingForm, HIGH_RISE_STOREYS, urbanSetting, budgetBand, parkingStanding, focusUnknowns, doubleDownOn,
  lensPresets, validatePreferences,
  quoteEvidence, recordQuote, QUOTE_HISTORY_MAX, QUOTE_CORRECTIONS_MAX,
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

test("saved searches validate legacy backups, unique bounded names and full preferences", () => {
  const legacy={version:1,records:{},manual:[],events:[],preferences:{}};
  assert.deepEqual(validateWorkspace(legacy).savedSearches,[]);
  const search={name:" Suburbs ",preferences:{...defaults,region:"suburbs",surface:"atlas"}};
  assert.equal(validateWorkspace({...legacy,savedSearches:[search]}).savedSearches[0].name,"Suburbs");
  for (const savedSearches of [[search,{...search,name:"suburbs"}], [{...search,name:" "}], [{...search,preferences:{...defaults,max:-1}}], Array.from({length:9},(_,i)=>({...search,name:String(i)})), "invalid", null]) {
    assert.throws(()=>validateWorkspace({...legacy,savedSearches}));
  }
});
test("atlas uses base rent, positive reported area and personal quotes without substituting advertised totals", () => {
  const a={...home,id:"a",rent:null,advertised_price:2400,sqft:1000};
  const b={...home,id:"b",rent:2000,sqft:800};
  assert.deepEqual(atlasPoints([a,{...b,sqft:0}]),[]);
  const points=atlasPoints([a,b],{a:{rentOverride:2100}});
  assert.equal(points[0].rent,2100);assert.equal(points[0].perFoot,2.1);
  assert.equal(points[1].perFoot,2.5);assert.equal(a.rent,null);
});
test("leasing draft preserves unresolved facts even after tour checks and never includes private notes", () => {
  const h={...home,rent:null,observed_at:"2026-01-01",parking:{status:"yes"},charging:{status:"yes"}};
  const r={notes:"PRIVATE PHONE 555",tourChecks:{layout:true,charging:true,parking:true}};
  const draft=leasingQuestions(h,r,new Date("2026-09-08")).join(" ");
  assert.match(draft,/enclosed bedrooms/);assert.match(draft,/base rent before concessions/);
  assert.match(draft,/connector, access rules, waitlist/);assert.match(draft,/fresh, dated written quote/);
  assert.doesNotMatch(draft,/PRIVATE PHONE/);
  const exact=leasingQuestions({...h,observed_at:"2026-09-08"},{rentOverride:1999.99,parkingCost:99.50},new Date("2026-09-08")).join(" ");
  assert.match(exact,/\$1,999\.99/);assert.match(exact,/\$99\.50/);assert.match(exact,/fresh, dated written quote/);
});
test("move-in plan adds first month once, keeps refundable and prepaid cash separate from recurring lease costs", () => {
  const record={oneTimeFees:300};
  const monthly=costScenario(home,record,{rent:2000,parking:100,fees:50,utilities:100,charging:50},12);
  const before=JSON.stringify(monthly);
  const cash=moveInScenario(home,record,monthly,{deposit:2000,moving:500,prepaid:2000});
  assert.equal(monthly.monthly,2300);assert.equal(monthly.termTotal,27600);
  assert.equal(cash.total,7100);assert.equal(cash.complete,true);
  assert.equal(cash.items.find(item=>item.key==="oneTime").assumed,false);
  assert.equal(JSON.stringify(monthly),before);assert.deepEqual(record,{oneTimeFees:300});
});
test("move-in unknowns are not zero, zero assumptions are valid, and missing base rent blocks a total", () => {
  const h={...home,rent:null,advertised_price:2400};
  const monthly=costScenario(h);
  assert.equal(moveInScenario(h,{},monthly,{deposit:0,oneTime:0,moving:0,prepaid:0}).total,null);
  const complete=costScenario(h,{}, {rent:2000,parking:0,fees:0,utilities:0,charging:0});
  const partial=moveInScenario(h,{},complete);
  assert.equal(partial.complete,false);assert(partial.missing.includes("Refundable deposit"));
  const zero=moveInScenario(h,{},complete,{deposit:0,oneTime:0,moving:0,prepaid:0});
  assert.equal(zero.complete,true);assert.equal(zero.total,2000);
});

test("tour agenda uses Chicago wall time, normalizes offset timestamps and excludes ruled-out homes", async () => {
  const {chicagoTime,tourAgenda}=await import('../dist/model.js');
  assert.equal(chicagoTime('2026-09-08T18:30:00Z'),'2026-09-08T13:30');
  assert.equal(chicagoTime('2026-01-08T18:30:00Z'),'2026-01-08T12:30');
  assert.equal(chicagoTime('2026-09-08T13:30'),'2026-09-08T13:30');
  assert.equal(chicagoTime(null),null);assert.equal(chicagoTime('2026-09-08'),null);assert.equal(chicagoTime('2026-99-99T30:99'),null);
  const homes=['past','future','ruled','unsaved'].map(id=>({...home,id}));
  const records={past:{saved:true,tourDate:'2026-09-08T09:00'},future:{saved:true,tourDate:'2026-09-08T18:30:00Z'},ruled:{saved:true,status:'ruled out',tourDate:'2026-09-09T12:00'},unsaved:{tourDate:'2026-09-09T12:00'}};
  const agenda=tourAgenda(homes,records,new Date('2026-09-08T17:00:00Z'));
  assert.deepEqual(agenda.map(item=>[item.home.id,item.past]),[['past',true],['future',false]]);
});
test("finalist pins require saved homes, cap at three and remain compatible with older notebooks", () => {
  const legacy=emptyWorkspace();assert.equal(validateWorkspace(legacy).preferences.density,'cards');
  const record={saved:true,finalist:true,snapshot:home,notes:'Keep this quote',rentOverride:2300};
  const w={...legacy,records:{a:record,b:record,c:record},preferences:{density:'scan'}};
  assert.equal(validateWorkspace(w).records.a.notes,'Keep this quote');
  assert.throws(()=>validateWorkspace({...w,records:{...w.records,d:record}}));
  assert.throws(()=>validateWorkspace({...w,records:{a:{...record,saved:false}}}));
  assert.throws(()=>validateWorkspace({...w,records:{a:{...record,finalist:'true'}}}));
  assert.throws(()=>validateWorkspace({...w,preferences:{density:'invalid'}}));
});

const pickNow = new Date('2026-09-08T12:00:00Z');
function pickHome(id, patch={}) {
  return {...home,id,title:id,address:`${id} Main St, Chicago, IL 60601`,city:'Chicago',
    kind:'listing',layout_status:'provider_reported',floor_plan:undefined,
    bedrooms:1,bathrooms:1,sqft:800,rent:2400,lat:41.88,lng:-87.63,
    observed_at:'2026-09-07',...patch};
}
const pickPeers = () => Array.from({length:5},(_,i)=>pickHome(`peer-${i}`,{lat:41.885+i*.002,rent:2400}));
const findPick = (homes,workspace=emptyWorkspace(),context={},lens='budget') =>
  spicyPicks(homes,workspace,{...defaults,search:'candidate'},context,lens,pickNow).picks[0];
test('SpicyPicks uses five other matching locations and base rent, independent of search or ruled-out preferences', () => {
  const candidate=pickHome('candidate',{rent:1600,advertised_price:3000}),peers=pickPeers();
  const extras=[
    {kind:'building'}, {city:'Evanston'}, {bedrooms:2}, {bathrooms:2},
    {sqft:500}, {lat:42.5}, {observed_at:'2026-08-20'}, {rent:null,advertised_price:100},
  ].map((patch,i)=>pickHome(`excluded-${i}`,{lat:41.90+i*.002,rent:500,...patch}));
  const w=emptyWorkspace();w.records[peers[0].id]={status:'ruled out'};
  const all=[candidate,...peers,...extras],before=JSON.stringify({all,w});
  const pick=findPick(all,w);
  assert.equal(pick.peerCount,5);assert.equal(pick.peerMedian,3);
  assert(Math.abs(pick.saving-1/3)<1e-9);assert.match(pick.reasons[0],/33% lower base rent per sq ft/);
  assert.equal(JSON.stringify({all,w}),before);
  assert.equal(findPick([candidate,...peers.slice(0,4)]).saving,null);
  const duplicate=pickHome('peer-unit',{address:peers[0].address+' Apt 2',lat:peers[0].lat,rent:3200});
  assert.equal(findPick([candidate,...peers,duplicate]).peerCount,5);
});
test('SpicyPicks merges every linked building member before excluding own-building comparables', () => {
  const a=pickHome('building-a',{lat:41.8800}), b=pickHome('building-b',{address:'500 Main St Apt 1, Chicago, IL 60601',lat:41.8803});
  const candidate=pickHome('candidate',{address:'500 Main St Apt 2, Chicago, IL 60601',lat:41.8806,rent:1600});
  const pick=findPick([a,b,candidate,...pickPeers().slice(0,4)]);
  assert.equal(pick.peerCount,4);assert.equal(pick.saving,null);
  assert.equal(spicyPicks([a,b,candidate],emptyWorkspace(),defaults,{},'budget',pickNow).picks.length,1);
});
test('SpicyPicks rejects future source and quote dates and stale or future CTA evidence', () => {
  const candidate=pickHome('candidate',{rent:1600});
  assert.equal(findPick([{...candidate,observed_at:'2099-01-01'},...pickPeers()]),undefined);
  const w=emptyWorkspace();w.records.candidate={rentOverride:1400,quoteDate:'2099-01-01'};
  assert.equal(findPick([candidate,...pickPeers()],w),undefined);
  w.records={};w.records['peer-0']={rentOverride:2500,quoteDate:'2099-01-01'};
  assert.equal(findPick([candidate,...pickPeers()],w).peerCount,4);
  w.records={candidate:{rentOverride:1400}};
  assert.equal(findPick([candidate,...pickPeers()],w).saving,null);
  const context={transit_stops:[{title:'Test',lat:41.881,lng:-87.63}],city_context:{cta:{updated_at:'2026-09-07'}}};
  assert(findPick([candidate],emptyWorkspace(),context,'rail').nearby.distance<.5);
  for(const at of ['2099-01-01','2026-07-01',null]) {
    context.city_context.cta.updated_at=at;
    assert.equal(findPick([candidate],emptyWorkspace(),context,'rail'),undefined);
  }
});
test('SpicyPicks excludes unsupported or rejected candidates and respects current bedroom, area and amenity filters', () => {
  const patches=[{bedrooms:0},{layout_status:'conflict'},{notebook_only:true},{seen_in_latest:false},{observed_at:'2026-07-01'},{sqft:null},{rent:0}];
  const homes=patches.map((patch,i)=>pickHome(`invalid-${i}`,patch));
  const one=pickHome('valid-one'),two=pickHome('valid-two',{bedrooms:2,city:'Elmhurst',address:'100 First St, Elmhurst, IL 60126',lat:41.9,lng:-87.94});
  const w=emptyWorkspace();w.records['valid-one']={status:'ruled out'};
  let result=spicyPicks([...homes,one,two],w,defaults,{},'balanced',pickNow);
  assert.deepEqual(result.picks.map(p=>p.home.id),['valid-two']);
  result=spicyPicks([one,two],emptyWorkspace(),{...defaults,bedrooms:'2',region:'suburbs',charging:true}, {}, 'ev',pickNow);
  assert.deepEqual(result.picks.map(p=>p.home.id),['valid-two']);
  assert.equal(spicyPicks([two],emptyWorkspace(),{...defaults,region:'chicago'}, {},'budget',pickNow).picks.length,0);
});
test('SpicyPicks separates advertised-only leads from bargains and reduces rank for missing quotes', () => {
  const lead=pickHome('lead',{bedrooms:2,rent:null,advertised_price:2200});
  const result=spicyPicks([lead],emptyWorkspace(),{...defaults,bedrooms:'2'}, {},'budget',pickNow);
  assert.equal(result.picks.length,0);assert.equal(result.leads[0].id,'lead');
  const candidate=pickHome('candidate',{parking:{status:'no',monthly:null},charging:{status:'no'},fees:{monthly:null}});
  const unquoted=findPick([candidate]);
  const w=emptyWorkspace();w.records.candidate={parkingCost:0,monthlyFees:0,utilities:0};
  const quoted=findPick([candidate],w);
  assert(quoted.score>unquoted.score);assert.equal(unquoted.cost.complete,false);
  assert.match(unquoted.catches.join(' '),/no resident parking.*no resident EV charging.*Still unquoted/);
});

test('Decision Studio recipe normalizes priorities without mutating the input or suppressing evidence penalties', () => {
  const recipe={budget:5,value:0,space:0,amenities:0,rail:0,evidence:0,form:0};
  assert.deepEqual(recipeWeights(recipe),{budget:100,value:0,space:0,amenities:0,rail:0,evidence:0,form:0});
  assert.equal(recipe.budget,5);
  const zero=Object.fromEntries(Object.keys(recipeDefaults).map(key=>[key,0]));
  assert.deepEqual(recipeWeights(zero),recipeWeights(recipeDefaults));
  const homes=[pickHome('cheap',{rent:1800,lat:41.89}),pickHome('large',{rent:2500,sqft:1100,lat:41.90})],w=emptyWorkspace();
  const before=JSON.stringify({homes,w});
  assert.equal(spicyPicks(homes,w,defaults,{},'balanced',pickNow,recipe).picks[0].home.id,'cheap');
  assert.equal(spicyPicks(homes,w,defaults,{},'balanced',pickNow,{...zero,space:5}).picks[0].home.id,'large');
  assert.equal(JSON.stringify({homes,w}),before);
});
test('Decision Studio tradeoffs keep layout, fresh prices, active cap and missing-cost caveats intact', () => {
  const anchor=pickHome('anchor',{rent:2500,charging:{status:'unknown'}}),cheap=pickHome('cheap',{rent:2000,sqft:750,lat:41.89}),room=pickHome('room',{rent:2600,sqft:1000,lat:41.90}),ev=pickHome('ev',{rent:2550,sqft:850,lat:41.91});
  const other=[pickHome('wrong-bed',{bedrooms:2,rent:1500,lat:41.92}),pickHome('old',{rent:1500,observed_at:'2026-08-20',lat:41.93}),pickHome('over-cap',{rent:3100,sqft:1300,lat:41.94})];
  const options=apartmentTradeoffs(anchor,[anchor,cheap,room,ev,...other],emptyWorkspace(),defaults,150,pickNow);
  assert.deepEqual(options.map(o=>[o.key,o.home.id]),[['save','cheap'],['space','room'],['ev','ev']]);
  assert.equal(options[0].rentDelta,-500);assert.match(options[0].catches.join(' '),/50 fewer reported sq ft.*Unquoted fees/);
  assert(!apartmentTradeoffs(anchor,[anchor,cheap,room,ev],emptyWorkspace(),defaults,0,pickNow).some(o=>o.rentDelta>0));
  const w=emptyWorkspace();w.records.anchor={rentOverride:2500};
  assert.equal(apartmentTradeoffs(anchor,[anchor,cheap],w,defaults,150,pickNow).length,0);
});
test('Decision Studio tradeoff lanes deduplicate linked location chains', () => {
  const anchor=pickHome('anchor',{lat:41.87,rent:2500}),a=pickHome('a',{lat:41.8800,rent:2000,sqft:800}),b=pickHome('b',{lat:41.8803,rent:2500,sqft:850}),c=pickHome('c',{lat:41.8806,rent:2500,sqft:1000});
  const options=apartmentTradeoffs(anchor,[anchor,a,b,c],emptyWorkspace(),defaults,150,pickNow);
  assert.equal(options.length,1);assert.equal(options[0].key,'save');
});
test('Decision Studio area samples separate sources, deduplicate units and withhold sparse medians', () => {
  const homes=[0,1,2].map(i=>pickHome('chicago-'+i,{lat:41.88+i*.01,rent:2000+i*200}));
  homes.push({...homes[0],id:'another-unit',address:homes[0].address+' Apt 2',rent:2200});
  homes.push(pickHome('building',{kind:'building',lat:41.94,rent:2800}));
  homes.push(pickHome('elmhurst',{city:'Elmhurst',address:'1 Main St, Elmhurst, IL 60126',lat:41.9,lng:-87.94,rent:null,advertised_price:2300,bedrooms:2}));
  const areas=areaMatch(homes,emptyWorkspace(),defaults,'1','cities',pickNow),city=areas[0];
  assert.equal(areas.length,1);assert.equal(city.locations,4);assert.equal(city.cohorts.listing.count,3);assert.equal(city.cohorts.listing.median,2200);
  assert.equal(city.cohorts.building.median,null);assert.equal(city.cohorts.building.min,2800);
  const two=areaMatch(homes,emptyWorkspace(),defaults,'2','cities',pickNow)[0];
  assert.equal(two.label,'Elmhurst');assert.equal(two.unknownRent,1);assert.equal(two.cohorts.listing.count,0);
});
test('Decision Studio price pulse preserves actual drop dates after unchanged scans and separates personal series', () => {
  const home=pickHome('pulse',{rent:2300,history:[{date:'2026-09-06',rent:2500},{date:'2026-09-07',rent:2300},{date:'2026-09-08',rent:2300},{date:'2099-01-01',rent:1000}]}),w=emptyWorkspace();
  // The reader's own quotes form a series between the days THEY entered.
  w.records.pulse={saved:true,rentOverride:2200,quoteDate:'2026-09-08',quote_history:[{date:'2026-09-06',rent:2400,date_basis:'entered'},{date:'2026-09-08',rent:2200,date_basis:'entered'}]};
  const result=pricePulse([home],w,defaults,true,pickNow);
  assert.equal(result.changes.length,2);const source=result.changes.find(c=>c.kind==='source');
  assert.equal(source.delta,-200);assert.equal(source.latest.date,'2026-09-07T00:00:00.000Z');assert.equal(source.lastObserved,'2026-09-08T00:00:00.000Z');
  assert.equal(result.changes.find(c=>c.kind==='personal').delta,-200);assert.equal(result.undatedQuotes,0);
  // The same two entries written before quote-date provenance was kept say
  // nothing about which day was entered and which was a save day: no movement.
  const legacy=emptyWorkspace();legacy.records.pulse={saved:true,quote_history:[{date:'2026-09-06',rent:2400},{date:'2026-09-08',rent:2200}]};
  const unrecorded=pricePulse([home],legacy,defaults,true,pickNow);
  assert.equal(unrecorded.changes.filter(c=>c.kind==='personal').length,0);assert.equal(unrecorded.undatedQuotes,2);
  const conflict={...home,history:[{date:'2026-09-06',rent:2400},{date:'2026-09-07',rent:2000},{date:'2026-09-07',rent:2500}]};
  assert.equal(pricePulse([conflict],emptyWorkspace(),defaults,false,pickNow).changes.length,0);
  assert.equal(pricePulse([home],emptyWorkspace(),defaults,true,pickNow).total,0);
});
test('Decision Studio next moves prioritize appointments and advance only from saved evidence', () => {
  const homes=['tour','layout','quote','review','ruled'].map((id,i)=>pickHome(id,{lat:41.88+i*.01})),w=emptyWorkspace();
  for(const h of homes)w.records[h.id]={saved:true,snapshot:h};
  w.records.tour.tourDate='2026-09-09T13:30';w.records.quote.layoutReview='one_bed';w.records.review={...w.records.review,layoutReview:'one_bed',parkingCost:0,utilities:0,monthlyFees:0};w.records.ruled.status='ruled out';
  const before=JSON.stringify(w),moves=nextMoves(homes,w,defaults,pickNow);
  assert.deepEqual(moves.map(m=>[m.home.id,m.target]),[['tour','tour-draft-count'],['layout','layoutReview'],['quote','leasing-draft']]);
  assert.equal(JSON.stringify(w),before);
  w.records.layout.layoutReview='one_bed';w.records.layout.parkingCost=0;w.records.layout.utilities=0;w.records.layout.monthlyFees=0;
  assert.equal(nextMoves([homes[1]],w,defaults,pickNow)[0].target,'tour-draft-count');
});
test('Decision Studio instant remix matches full scoring and preserves distinct locations and evidence penalties', () => {
  const homes=[pickHome('cheap',{rent:1800,lat:41.89}),pickHome('large',{rent:2500,sqft:1100,lat:41.90}),pickHome('duplicate',{address:'large Main St Apt 2, Chicago, IL 60601',rent:2400,sqft:1050,lat:41.90}),pickHome('fresh',{lat:41.91})],w=emptyWorkspace();
  const base=spicyPicks(homes,w,defaults,{},'balanced',pickNow),before=JSON.stringify(base),recipe={budget:5,value:3,space:4,amenities:0,rail:0,evidence:1};
  const fast=remixPicks(base,recipe),full=spicyPicks(homes,w,defaults,{},'balanced',pickNow,recipe);
  assert.deepEqual(fast.picks.map(p=>[p.home.id,p.score]),full.picks.map(p=>[p.home.id,p.score]));
  assert.equal(new Set(fast.picks.map(p=>p.group)).size,fast.picks.length);assert.equal(JSON.stringify(base),before);
});
test("one saved home's next move is the same object the studio ranks, and names the exact field for the gap", () => {
  const homes=['a','b'].map((id,i)=>pickHome(id,{lat:41.88+i*.01})),w=emptyWorkspace();
  for(const h of homes)w.records[h.id]={saved:true,snapshot:h};
  // nextMoves is nextMove ranked, not a second engine: every ranked move is
  // identical to the one the board prints beside its own home.
  const ranked=nextMoves(homes,w,defaults,pickNow);
  assert(ranked.length);
  for(const move of ranked) {
    const own=nextMove(move.home,w,defaults,pickNow);
    assert.deepEqual([own.title,own.why,own.target,own.priority],[move.title,move.why,move.target,move.priority]);
  }
  // An unsaved home and a ruled-out home have no next move at all.
  assert.equal(nextMove(pickHome('unsaved'),w,defaults,pickNow),null);
  w.records.b.status='ruled out';
  assert.equal(nextMove(homes[1],w,defaults,pickNow),null);
  // Past the layout check, the gap is a cost, and `field` is the exact notebook
  // input that records it while `target` stays the step itself.
  w.records.a.layoutReview='one_bed';
  const quote=nextMove(homes[0],w,defaults,pickNow);
  assert.equal(quote.target,'leasing-draft');
  assert.deepEqual(quote.unknown,['parking','utilities']);
  assert.equal(quote.field,'parkingCost');
  assert.equal(costField('monthly fees'),'monthlyFees');
  assert.equal(costField('base rent'),'rentOverride');
  assert.equal(costField('something the notebook has no field for'),'leasing-draft');
  // Recording the amounts closes that gap; `field` then claims nothing.
  // A recorded zero is an amount, not a gap: closing these with 0 must clear them.
  Object.assign(w.records.a,{parkingCost:0,monthlyFees:0,utilities:0});
  const after=nextMove(homes[0],w,defaults,pickNow);
  assert.equal(after.field,null);
  assert.deepEqual(after.unknown,[]);
});

// --- Traceable source access -------------------------------------------------
const curatedPlan = {
  id: "amli-lofts", kind: "building", title: "AMLI Lofts",
  address: "850 S. Clark St., Chicago, IL 60605", city: "Chicago", neighborhood: "South Loop",
  floor_plan: "A320", rent: 2663, observed_at: "2026-09-07",
  source_url: "https://www.amli.com/apartments/chicago/south-loop-apartments/amli-lofts/floorplans",
  sources: [
    { url: "https://www.amli.com/apartments/chicago/south-loop-apartments/amli-lofts", supports: "Address and plan", observed_at: "2026-09-07" },
    { url: "https://www.amli.com/apartments/chicago/south-loop-apartments/amli-lofts/floorplans", supports: "A320 details" },
  ],
  charging: { status: "yes", note: "Building advertises charging." },
  parking: { status: "yes", monthly: null }, fees: { monthly: 120, one_time: null },
};
const providerRow = {
  id: "rentcast:6700-S-South-Constance-Ave,-Unit-1,-Chicago,-IL-60649", kind: "listing",
  title: "6700 S South Constance Ave", address: "6700 S South Constance Ave, Unit 1, Chicago, IL 60649",
  city: "Chicago", neighborhood: "Chicago · neighborhood unverified", unit_label: "Unit 1",
  rent: 1750, observed_at: "2026-09-15T13:28:27.690566Z", source_url: null,
  sources: [{ url: "https://developers.rentcast.io/reference/property-listings", supports: "RentCast listing ID; no direct listing URL supplied by the API." }],
  charging: { status: "unknown" }, parking: { status: "unknown", monthly: null },
};

test("a curated plan's broader building URL is labelled as a plan page, never as an available unit", () => {
  const access = sourceAccess(curatedPlan);
  assert.equal(access.kind, "plan_source");
  assert.equal(access.url, curatedPlan.source_url);
  assert.match(access.says, /plan A320/);
  assert.match(access.says, /not proof that an exact unit is available/);
  // A populated URL does not make it an exact-unit destination.
  assert.equal(access.exact, false);
  assert.match(access.missing, /No exact listing URL/);
  assert.equal(access.fallback.scope, "building-plan");
  assert.match(access.fallback.label, /Search this building & plan/);
  assert.match(decodeURIComponent(access.fallback.url), /AMLI Lofts.*floor plan A320/);
  assert.match(access.fallback.note, /A search, not a found listing/);
});

test("a safe supplied listing URL is preserved; missing, unsafe and documentation URLs are not promoted into one", () => {
  const supplied = sourceAccess({ ...providerRow, source_url: "https://example.com/listings/6700-constance-1" });
  assert.equal(supplied.kind, "listing_source");
  assert.equal(supplied.exact, true);
  assert.equal(supplied.url, "https://example.com/listings/6700-constance-1");
  // An exact listing needs no search detour.
  assert.equal(supplied.fallback, null);
  assert.equal(supplied.missing, "");

  // Documentation only: the provider ID is never turned into a listing URL.
  const documented = sourceAccess(providerRow);
  assert.equal(documented.kind, "documentation");
  assert.equal(documented.url, "");
  assert.match(documented.says, /not a rental listing/);
  assert.match(documented.summary, /Provider documentation only/);
  assert.equal(documented.exact, false);
  assert(!documented.fallback.url.includes("6700-S-South-Constance-Ave,-Unit-1"), "the provider ID is not the search");

  // Unsafe: refused, and a safe reference is used instead of it.
  const unsafe = sourceAccess({ ...providerRow, source_url: "javascript:alert(1)",
    sources: [{ url: "https://example.com/plan", supports: "The plan" }] });
  assert.equal(unsafe.url, "https://example.com/plan");
  const unsafeOnly = sourceAccess({ ...providerRow, source_url: "javascript:alert(1)", sources: [] });
  assert.equal(unsafeOnly.kind, "none");
  assert.equal(unsafeOnly.url, "");
  assert.match(unsafeOnly.says, /No source link was recorded/);
  assert(unsafeOnly.fallback, "a record with an address still has a labelled search");

  // A user's own link is labelled as theirs, not as an official source.
  const mine = sourceAccess({ ...providerRow, kind: "manual", source_url: "https://example.com/mine" });
  assert.equal(mine.kind, "personal");
  assert.match(mine.label, /Open your source/);
});

test("the search fallback carries recorded public identity only, and missing identity produces an honest unavailable state", () => {
  const withNotes = { ...providerRow,
    notes: "my landlord contact is Dana", quote_history: [{ date: "2026-09-01", rent: 1700 }],
    tourDate: "2026-09-20T10:00", rentOverride: 1699 };
  const terms = sourceAccess(withNotes).fallback.terms.join(" ");
  for (const secret of ["Dana", "landlord", "1699", "2026-09-20"])
    assert(!terms.includes(secret), `the search must not carry ${secret}`);
  assert.deepEqual(sourceAccess(providerRow).fallback.terms,
    ["6700 S South Constance Ave, Unit 1, Chicago, IL 60649", "apartment for rent"]);
  // A unit the address does not already name is added rather than lost.
  assert(searchIdentity({ ...providerRow, address: "6700 S South Constance Ave, Chicago, IL 60649" })
    .terms.includes("Unit 1"));

  const nameless = sourceAccess({ kind: "listing", id: "x", observed_at: "2026-09-15" });
  assert.equal(nameless.kind, "none");
  assert.equal(nameless.fallback, null);
  assert.equal(nameless.unavailable, true);
  // A record with nothing to search for must not advertise a search.
  assert.equal(nameless.summary, "No source link on record");
  assert.match(sourceAccess(providerRow).summary, /· search available$/);
});

test("documentation hosts are recognised and ordinary building sites are not", () => {
  assert.equal(isDocumentationUrl("https://developers.rentcast.io/reference/property-listings"), true);
  assert.equal(isDocumentationUrl("https://data.cityofchicago.org/resource/8pix-ypme.json"), true);
  assert.equal(isDocumentationUrl("https://www.amli.com/apartments/chicago"), false);
  assert.equal(isDocumentationUrl("javascript:alert(1)"), false);
  assert.equal(isDocumentationUrl(null), false);
});

test("each source reference keeps its own date, and a missing one reads as not recorded rather than today", () => {
  const refs = sourceReferences(curatedPlan);
  assert.equal(refs.length, 2);
  assert.equal(refs[0].observed_at, "2026-09-07");
  assert.equal(refs[1].observed_at, null);
  assert.equal(refs[0].documentation, false);
  assert.equal(sourceReferences(providerRow)[0].documentation, true);
  assert.equal(sourceReferences(providerRow)[0].observed_at, null);
  // A run that records the reference's date keeps it.
  assert.equal(sourceReferences({ ...providerRow,
    sources: [{ ...providerRow.sources[0], observed_at: "2026-09-15T13:28:27.690566Z" }] })[0].observed_at,
    "2026-09-15T13:28:27.690566Z");
  assert.deepEqual(sourceReferences({ kind: "manual", source_url: "javascript:bad" }), []);
});

// --- City-query context ------------------------------------------------------
const providerBlock = {
  query: { city: "Chicago" },
  area_scans: {
    Chicago: { last_success: "2026-09-15T13:28:27.690566Z", returned: 500, total: 4484, truncated: true, accepted: 500 },
    Evanston: { last_success: "2026-09-08T13:29:28.215967Z", returned: 176, total: 176, truncated: false, accepted: 176 },
    Naperville: { last_success: "2026-09-14T13:30:09.810813Z", returned: 385, total: null, truncated: false, accepted: 385 },
  },
};

test("a home reads its own city's recorded query, never another city's and never a borrowed one", () => {
  const chicago = scanContext(providerBlock, providerRow);
  assert.equal(chicago.city, "Chicago");
  assert.equal(chicago.recorded, true);
  assert.equal(chicago.total, 4484);
  assert.equal(chicago.coverage, "capped");
  assert.equal(chicago.sameCapture, true);

  // Evanston's own scan is a different date and complete for that query.
  const evanston = scanContext(providerBlock,
    { ...providerRow, id: "e", city: "Evanston", address: "1 Main St, Evanston, IL 60201", observed_at: "2026-09-08T13:29:28.215967Z" });
  assert.equal(evanston.last_success, "2026-09-08T13:29:28.215967Z");
  assert.equal(evanston.coverage, "complete");
  assert.notEqual(evanston.last_success, chicago.last_success);

  // An unavailable total is its own state, not a completeness claim.
  assert.equal(scanContext(providerBlock,
    { ...providerRow, id: "n", city: "Naperville", address: "1 Main St, Naperville, IL 60540" }).coverage, "unknown-total");

  // A city with no recorded scan says so instead of taking the latest area's.
  const unscanned = scanContext(providerBlock,
    { ...providerRow, id: "o", city: "Oak Park", address: "1 Main St, Oak Park, IL 60301" });
  assert.equal(unscanned.recorded, false);
  assert.equal(unscanned.coverage, "unrecorded");
  assert.equal(unscanned.city, "Oak Park");
  assert.equal(scanContext({}, providerRow).recorded, false);
});

test("a home observed before its city's latest query keeps both dates apart, and says which came first", () => {
  const older = scanContext(providerBlock, { ...providerRow, observed_at: "2026-09-09T13:00:00Z" });
  assert.equal(older.recorded, true);
  assert.equal(older.observed_at, "2026-09-09T13:00:00Z");
  assert.equal(older.last_success, "2026-09-15T13:28:27.690566Z");
  assert.equal(older.sameCapture, false);
  assert.equal(older.order, "observed_first");
  assert.equal(scanContext(providerBlock, providerRow).order, "same");
  // A saved record can hold a query OLDER than the observation beside it, and
  // calling that observation "older" would be a lie in the other direction.
  assert.equal(scanContext(providerBlock, providerRow, { basis: "provider_query", city: "Chicago",
    saved_at: "2026-09-16T00:00:00Z", last_success: "2026-09-09T13:00:00Z", returned: 500, total: 4100, truncated: true }).order,
    "query_first");
  assert.equal(scanContext(providerBlock, { ...providerRow, observed_at: undefined }).order, "unknown");
});

test("curated research is never described as a provider-query result", () => {
  const curated = scanContext(providerBlock, curatedPlan);
  assert.equal(curated.basis, "curated_research");
  assert.equal(curated.recorded, false);
  assert.equal(scanContext(providerBlock, { ...curatedPlan, kind: "manual" }).basis, "manual_entry");
  // A frozen copy is preferred over the live block and keeps its own dates.
  const frozen = scanContext(providerBlock, providerRow, {
    basis: "provider_query", city: "Chicago", saved_at: "2026-09-10T00:00:00Z",
    observed_at: "2026-09-09T13:00:00Z", last_success: "2026-09-09T13:00:00Z", returned: 500, total: 4100, truncated: true });
  assert.equal(frozen.frozen, true);
  assert.equal(frozen.total, 4100);
  assert.equal(frozen.last_success, "2026-09-09T13:00:00Z");
  assert.equal(frozen.saved_at, "2026-09-10T00:00:00Z");
  // An older save that recorded nothing stays "not recorded".
  assert.equal(scanContext(providerBlock, providerRow,
    { basis: "provider_query", city: "Chicago", saved_at: "2026-09-10T00:00:00Z" }).recorded, false);
});

// --- Charging evidence -------------------------------------------------------
test("building charging and public charging context are four separate states", () => {
  const noStations = { charging_stations: [], city_context: { afdc_status: "Key not configured; no public charging dataset fetched." } };
  const yes = chargingEvidence({ ...curatedPlan, lat: 41.87, lng: -87.63 }, noStations);
  assert.equal(yes.status, "yes");
  assert.match(yes.building, /Building charging advertised/);
  assert.equal(yes.public, "unavailable");
  assert.equal(yes.nearby, null);

  const none = chargingEvidence({ ...providerRow, lat: 41.87, lng: -87.63, charging: { status: "no" } }, noStations);
  assert.match(none.building, /No building charging/);
  assert.equal(none.public, "unavailable");

  const unknown = chargingEvidence({ ...providerRow, lat: 41.87, lng: -87.63 }, noStations);
  assert.match(unknown.building, /Building charging unknown/);

  // A loaded public dataset counts nearby stations and still changes nothing
  // about the building's own three states.
  const loaded = { charging_stations: [
      { title: "Near", lat: 41.8705, lng: -87.6305 },
      { title: "Far", lat: 42.2, lng: -87.9 }],
    city_context: { afdc: { updated_at: "2026-09-14T13:01:29Z" } } };
  const near = chargingEvidence({ ...providerRow, lat: 41.87, lng: -87.63 }, loaded);
  assert.equal(near.public, "loaded");
  assert.equal(near.nearby, 1);
  assert.equal(near.status, "unknown");
  assert.equal(near.observed_at, "2026-09-14T13:01:29Z");
  assert(publicChargingMiles > 0 && publicChargingMiles <= 1);

  // No coordinates: nothing is measured and no location is invented.
  const unlocated = chargingEvidence({ ...providerRow, lat: null, lng: null }, loaded);
  assert.equal(unlocated.public, "unlocated");
  assert.equal(unlocated.nearby, null);
});

test("a charging cost is never folded into the known monthly subtotal", () => {
  const base = costs({ ...curatedPlan, parking: { status: "yes", monthly: 200 } }, {}, defaults);
  assert.equal(base.charging, null);
  assert.equal(base.chargingIncluded, false);
  assert.equal(base.known, 2663 + 200 + 120);
  // Even a recorded amount stays outside the subtotal rather than implying it.
  const priced = costs({ ...curatedPlan, parking: { status: "yes", monthly: 200 }, charging: { status: "yes", monthly: 35 } }, {}, defaults);
  assert.equal(priced.charging, 35);
  assert.equal(priced.known, base.known);
  assert(!priced.unknown.includes("charging"));
});

test("a record with no coordinates stays inspectable and source-accessible", () => {
  const unlocated = { ...curatedPlan, id: "unlocated-plan", lat: null, lng: null };
  const access = sourceAccess(unlocated);
  assert.equal(access.kind, "plan_source");
  assert(access.fallback.terms.length > 0);
  assert.equal(distanceMiles(unlocated, searchCenter), null);
  assert.equal(validateHome({ ...unlocated, id: "unlocated-plan" }), true);
});

// --- Saved query context -----------------------------------------------------
const scanRecord = { basis: "provider_query", city: "Chicago", saved_at: "2026-09-15T14:00:00Z",
  feed_generated_at: "2026-09-15T13:28:27.690566Z", observed_at: "2026-09-15T13:28:27.690566Z",
  last_success: "2026-09-15T13:28:27.690566Z", returned: 500, total: 4484, truncated: true, accepted: 500 };

test("saved query context validates, survives a backup, and a notebook without it stays valid", () => {
  const notebook = { ...emptyWorkspace(), records: { a: { saved: true, scan: scanRecord } } };
  assert.deepEqual(validateWorkspace(notebook).records.a.scan, scanRecord);
  // Backward compatible: a version-1 notebook that never recorded one is fine.
  assert.doesNotThrow(() => validateWorkspace({ ...emptyWorkspace(), records: { a: { saved: true } } }));
  // Only the three recorded bases, real dates and bounded counts are accepted.
  for (const bad of [
    { ...scanRecord, basis: "guessed" },
    { ...scanRecord, saved_at: "not a date" },
    { ...scanRecord, last_success: "not a date" },
    { ...scanRecord, returned: 501 },
    { ...scanRecord, returned: 1.5 },
    { ...scanRecord, total: -1 },
    { ...scanRecord, truncated: "yes" },
    "a string instead of a record",
  ])
    assert.throws(() => validateWorkspace({ ...emptyWorkspace(), records: { a: { saved: true, scan: bad } } }),
      /invalid saved source context/);
});

// --- What could change my mind? ----------------------------------------------
const deskNow = new Date("2026-09-16T12:00:00Z");
const deskHome = {
  id: "desk-a", kind: "listing", title: "6700 S South Constance Ave",
  address: "6700 S South Constance Ave, Unit 1, Chicago, IL 60649", city: "Chicago",
  neighborhood: "Chicago · neighborhood unverified", unit_label: "Unit 1",
  rent: 1750, sqft: 700, lat: 41.77, lng: -87.58, observed_at: "2026-09-15T13:00:00Z",
  bedrooms: 1, bathrooms: 1, layout_status: "provider_reported",
  parking: { status: "unknown", monthly: null }, charging: { status: "unknown" },
  fees: { monthly: null, one_time: null }, source_url: null, seen_in_latest: true,
  sources: [{ url: "https://developers.rentcast.io/reference/property-listings", supports: "RentCast listing ID" }],
};
const keys = (home, rec, now = deskNow) => openQuestions(home, rec, defaults, now).map((q) => q.key);

test("the unresolved list is derived from recorded facts and names the exact field for each", () => {
  const items = openQuestions(deskHome, { saved: true }, defaults, deskNow);
  const byKey = Object.fromEntries(items.map((q) => [q.key, q]));
  assert.equal(byKey.layout.target, "layoutReview");
  assert.equal(byKey["cost:parking"].target, "parkingCost");
  assert.equal(byKey["cost:monthly fees"].target, "monthlyFees");
  assert.equal(byKey["cost:utilities"].target, "utilities");
  assert.equal(byKey.parking.target, "leasing-draft");
  assert.equal(byKey.charging.target, "leasing-draft");
  assert.equal(byKey.tour.target, "tour-draft-count");
  assert.equal(byKey.source.target, "detail-sources");
  // Every field named is one the notebook actually has.
  for (const q of items)
    assert(["layoutReview", "leasing-draft", "tour-draft-count", "notes", "detail-sources", "rentOverride", "parkingCost", "monthlyFees", "utilities"].includes(q.target), q.target);
  // Nothing speculative: every label states a recorded absence, not a guess.
  for (const q of items) assert.doesNotMatch(q.label + q.detail, /probabl|likely|maybe|should be|we think/i);
});

test("a recorded $0 is a known amount; the source's silence about parking is a separate question", () => {
  const zeroed = openQuestions(deskHome, { saved: true, parkingCost: 0 }, defaults, deskNow).map((q) => q.key);
  assert(!zeroed.includes("cost:parking"), "$0 parking is quoted, so it is no longer an unquoted cost");
  assert(zeroed.includes("parking"), "the source still never established that there is parking");
  const unknown = keys(deskHome, { saved: true });
  assert(unknown.includes("cost:parking"));
  // A source that says parking exists closes the amenity question, not the cost.
  const advertised = keys({ ...deskHome, parking: { status: "yes", monthly: null } }, { saved: true });
  assert(!advertised.includes("parking"));
  assert(advertised.includes("cost:parking"));
});

test("layout evidence closes the layout question only when the reader checked it", () => {
  assert(keys(deskHome, { saved: true }).includes("layout"), "provider-reported is not a check");
  assert(keys({ ...deskHome, kind: "building", floor_plan: "A320", layout_status: "source_listed",
    sources: [{ url: "https://example.com/plan", supports: "A320" }] }, { saved: true }).includes("layout"),
    "source-listed is not a check either");
  assert(!keys(deskHome, { saved: true, layoutReview: "one_bed" }).includes("layout"));
});

test("charging yes, no and unknown are three answers and only unknown is an open question", () => {
  for (const [status, open] of [["yes", false], ["no", false], ["unknown", true]])
    assert.equal(keys({ ...deskHome, charging: { status } }, { saved: true }).includes("charging"), open, status);
});

test("a quote's age, an undated quote and an absent record are each their own question", () => {
  const fresh = openQuestions(deskHome, { saved: true, rentOverride: 1725, quoteDate: "2026-09-15" }, defaults, deskNow);
  assert(!fresh.some((q) => q.key === "quote"));
  const old = openQuestions(deskHome, { saved: true, rentOverride: 1725, quoteDate: "2026-08-01" }, defaults, deskNow);
  assert.match(old.find((q) => q.key === "quote").label, /Quote is 46 days old/);
  const undated = openQuestions({ ...deskHome, observed_at: "not a date" }, { saved: true }, defaults, deskNow);
  assert.match(undated.find((q) => q.key === "quote").label, /No dated quote on record/);
  // Absence from a capped query is a question, never a claim that it is gone.
  const absent = openQuestions({ ...deskHome, seen_in_latest: false }, { saved: true }, defaults, deskNow);
  const gone = absent.find((q) => q.key === "presence");
  assert.match(gone.label, /Absent from the latest area scan/);
  assert.match(gone.detail, /not proof it is leased/);
  assert.equal(gone.target, "detail-sources");
  assert(keys({ ...deskHome, notebook_only: true }, { saved: true }).includes("presence"));
  assert(!keys(deskHome, { saved: true }).includes("presence"));
});

test("a record with an exact listing URL stops asking for one", () => {
  assert(keys(deskHome, { saved: true }).includes("source"));
  assert(!keys({ ...deskHome, source_url: "https://example.com/listings/6700-1" }, { saved: true }).includes("source"));
});

test("tour checks clear the tour question only when every check is reviewed", () => {
  const all = Object.fromEntries(tourChecks.map(([key]) => [key, true]));
  assert(keys(deskHome, { saved: true, tourChecks: { layout: true } }).includes("tour"));
  assert(!keys(deskHome, { saved: true, tourChecks: all }).includes("tour"));
  assert.match(openQuestions(deskHome, { saved: true, tourChecks: { layout: true } }, defaults, deskNow)
    .find((q) => q.key === "tour").label, new RegExp(`${tourChecks.length - 1} of ${tourChecks.length} tour checks`));
});

test("a record with nothing outstanding asks nothing", () => {
  const settled = { ...deskHome, source_url: "https://example.com/listing", parking: { status: "yes", monthly: 150 },
    charging: { status: "no" }, fees: { monthly: 40, one_time: null } };
  const rec = { saved: true, layoutReview: "one_bed", rentOverride: 1750, quoteDate: "2026-09-15",
    utilities: 90, tourChecks: Object.fromEntries(tourChecks.map(([key]) => [key, true])) };
  assert.deepEqual(openQuestions(settled, rec, defaults, deskNow), []);
});

test("the unresolved list and nextMove agree about which step comes first", () => {
  const workspace = { ...emptyWorkspace(), records: { "desk-a": { saved: true, status: "contacted" } } };
  const move = nextMove(deskHome, workspace, defaults, deskNow);
  const items = openQuestions(deskHome, workspace.records["desk-a"], defaults, deskNow);
  assert.equal(items.filter((q) => q.target === move.target).length >= 1, true);
  assert.equal(items[0].target, move.target, "the list opens on the step nextMove picked");
});

test("one spread engine answers for the finalists and the full comparison alike", () => {
  const three = figureSpread([{ name: "A", value: 2663 }, { name: "B", value: 1725 }, { name: "C", value: 2507 }]);
  assert.equal(three.comparable, true);
  assert.equal(three.reason, "spread");
  assert.equal(three.delta, 938);
  assert.equal(figureSpread([{ name: "A", value: 2000 }, { name: "B", value: 2000 }]).reason, "same");
  const missing = figureSpread([{ name: "A", value: 2663 }, { name: "B", value: null }]);
  assert.equal(missing.comparable, false);
  assert.deepEqual(missing.missing, ["B"]);
  assert.equal(figureSpread([{ name: "A", value: 1 }]).reason, "one");
  assert.equal(figureSpread([]).reason, "one");
  // NaN and Infinity are not figures either.
  assert.equal(figureSpread([{ name: "A", value: NaN }, { name: "B", value: 1 }]).comparable, false);
});

// --- why a candidate is on an attention surface --------------------------
// Pinned to deskNow, like every other dated assertion here, so the answers
// cannot drift with the hour the suite runs in.
const why = (home, prefs = defaults, context = {}, ws = emptyWorkspace(), now = deskNow) =>
  surfacedBecause(home, ws, prefs, context, now);
const texts = (...args) => why(...args).map((r) => r.text);

test("a reason is only offered for a filter the reader actually moved", () => {
  // Every gate at its default narrowed nothing, so none of them is a reason.
  const plain = why(deskHome);
  assert.equal(plain.some((r) => r.kind === "filter"), false, JSON.stringify(plain));
  // Move one, and exactly that one appears.
  const chosen = why(deskHome, { ...defaults, neighborhood: deskHome.neighborhood });
  const named = chosen.filter((r) => r.kind === "filter");
  assert.equal(named.length, 1);
  assert.match(named[0].text, /the area you chose/);
  assert.equal(named[0].key, "neighborhood");
  // Put it back and the sentence is gone, not merely hidden.
  assert.equal(why(deskHome).some((r) => r.key === "neighborhood"), false);
});

test("a reason never claims a match the record does not hold", () => {
  // Asked about a record that would NOT pass the gate, the gate stays silent
  // rather than asserting it matched.
  const elsewhere = { ...deskHome, neighborhood: "Somewhere else" };
  assert.equal(why(elsewhere, { ...defaults, neighborhood: "Chicago · neighborhood unverified" })
    .some((r) => r.key === "neighborhood"), false);
  assert.equal(why(deskHome, { ...defaults, bedrooms: "2" }).some((r) => r.key === "bedrooms"), false);
  assert.equal(why(deskHome, { ...defaults, bedrooms: "1" }).some((r) => r.key === "bedrooms"), true);
  // deskHome's layout is provider-reported, so a source-evidence filter cannot
  // be the reason it is here.
  assert.equal(why(deskHome, { ...defaults, layoutScope: "source" }).some((r) => r.key === "layoutScope"), false);
  const listed = { ...deskHome, kind: "building", floor_plan: "A2", layout_status: "source_listed" };
  assert.equal(why(listed, { ...defaults, layoutScope: "source" }).some((r) => r.key === "layoutScope"), true);
  assert.equal(why(deskHome, { ...defaults, search: "constance" }).some((r) => r.key === "search"), true);
  assert.equal(why(deskHome, { ...defaults, search: "evanston" }).some((r) => r.key === "search"), false);
});

test("the ranking signal offered is the one the chosen weights actually rewarded", () => {
  const pick = { signals: { budget: 1, value: 0, space: .2, amenities: 0, evidence: .5, rail: 0 }, saving: null, nearby: null };
  const budgetLed = why(deskHome, defaults, { pick, weights: { budget: 65, space: 5, evidence: 10 }, priority: "budget" });
  assert.equal(budgetLed[0].kind, "priority");
  assert.match(budgetLed[0].text, /under your .* cap/);
  // Re-weight the same candidate and a different rule explains it.
  const roomy = { ...deskHome, sqft: 900 };
  const spaceLed = why(roomy, defaults, { pick: { ...pick, signals: { ...pick.signals, space: 1 } },
    weights: { budget: 5, space: 80, evidence: 10 }, priority: "space" });
  assert.equal(spaceLed[0].kind, "priority");
  assert.match(spaceLed[0].text, /900 reported sq ft/);
  // A recipe says so in its own kind, so the surface can mark it as the
  // reader's explicit mix rather than a preset priority.
  const mixed = why(roomy, defaults, { pick: { ...pick, signals: { ...pick.signals, space: 1 } },
    weights: { space: 80 }, priority: "recipe" });
  assert.equal(mixed[0].kind, "recipe");
  // A priority that contributes NOTHING cannot be the explanation. The weight
  // has to be present and zero for this to bite: leaving the key out entirely
  // would let a missing entry do the rejecting instead of the rule under test.
  const weightless = why(roomy, defaults, { pick: { ...pick, signals: { ...pick.signals, space: 1 } },
    weights: { space: 0 }, priority: "space" });
  assert.equal(weightless.some((r) => r.kind === "priority"), false, JSON.stringify(weightless));
  // and the same candidate under a weight that does count is explained by it,
  // so the check above fails for the weight rather than for the sentence.
  const weighted = why(roomy, defaults, { pick: { ...pick, signals: { ...pick.signals, space: 1 } },
    weights: { space: 1 }, priority: "space" });
  assert.equal(weighted.filter((r) => r.kind === "priority").length, 1);
});

test("an unquoted base rent is never a reason to be under a cap", () => {
  // Its known subtotal is zero, so the arithmetic would offer the whole cap as
  // headroom and read as the cheapest thing on the page. This repository's rule
  // is that unknown base rents never become cheap picks; the same holds for the
  // sentence that explains one.
  const unquoted = { ...deskHome, rent: null, advertised_price: 1900, advertised_price_type: "total_monthly" };
  const reasons = why(unquoted, { ...defaults, unknown: true });
  assert.equal(reasons.some((r) => r.key === "budget"), false, JSON.stringify(reasons));
  assert.equal(texts(unquoted, { ...defaults, unknown: true }).some((t) => /\$3,000 under your \$3,000/.test(t)), false);
  // and a record that IS quoted still gets it, so the guard is about the quote.
  assert.equal(why(deskHome).some((r) => r.key === "budget"), true);
});

test("an explanation never uses the language of a verdict", () => {
  const banned = /\b(best|winner|perfect|ideal|guaranteed)\b|recommended for you/i;
  const homes = [deskHome, { ...deskHome, sqft: 900, parking: { status: "yes", monthly: null }, charging: { status: "yes" } },
    { ...deskHome, kind: "building", floor_plan: "A2", layout_status: "source_listed" }];
  const prefsList = [defaults, { ...defaults, bedrooms: "1", parking: true, charging: true, search: "constance",
    neighborhood: deskHome.neighborhood, min: 1000, max: 2000, basis: "total", layoutScope: "source", radiusMiles: 35 }];
  for (const home of homes) for (const prefs of prefsList) {
    for (const reason of why(home, prefs, { pick: { signals: { budget: 1, space: 1, amenities: 1, evidence: 1, value: 0, rail: 0 },
      saving: null, nearby: null }, weights: { budget: 20, space: 20, amenities: 20, evidence: 20 }, priority: "balanced" }))
      assert.doesNotMatch(reason.text, banned, reason.text);
    const open = headlineUnknown(home, {}, prefs, deskNow);
    if (open) assert.doesNotMatch(open.label + " " + open.detail, banned, open.label);
  }
});

test("the headline unknown is the record's own first open question, never a tour it has not had", () => {
  // openQuestions already ranks by decision weight; this takes that order and
  // only declines the tour checklist, which is about a visit, not the record.
  const all = openQuestions(deskHome, {}, defaults, deskNow).map((q) => q.kind);
  assert(all.includes("tour"));
  assert.equal(headlineUnknown(deskHome, {}, defaults, deskNow).key, "layout");
  // Settle the questions ahead of it and the next one steps up, in that order.
  const checked = { layoutReview: "one_bed", parkingCost: 0, monthlyFees: 0, utilities: 0,
    rentOverride: 1750, quoteDate: "2026-09-16" };
  const next = headlineUnknown(deskHome, checked, defaults, deskNow);
  assert.equal(next.key, "parking");
  assert.match(next.detail, /Unknown is not none/);
  // A recorded $0 is an answer and a source's "no" is an answer, so neither is
  // what is still open; the record's missing exact URL is, and it steps up.
  const answered = headlineUnknown({ ...deskHome, parking: { status: "yes", monthly: 0 }, charging: { status: "no" } },
    checked, defaults, deskNow);
  assert.equal(answered.key, "source");
  assert.match(answered.label, /No exact listing URL/);
});

test("nothing outstanding means nothing is said, rather than an unknown invented to fill the slot", () => {
  const settled = { ...deskHome, parking: { status: "yes", monthly: 0 }, charging: { status: "no" },
    source_url: "https://example.com/unit-1" };
  const rec = { layoutReview: "one_bed", parkingCost: 0, monthlyFees: 0, utilities: 0,
    rentOverride: 1750, quoteDate: "2026-09-16" };
  assert.equal(headlineUnknown(settled, rec, defaults, deskNow), null);
  // and the tour checklist, which is genuinely outstanding, is still recorded
  // by the engine this reads from -- it is declined here, not deleted there.
  assert(openQuestions(settled, rec, defaults, deskNow).some((q) => q.kind === "tour"));
});

// --- The downtown lens ------------------------------------------------------
// A fixed instant, so what these assert cannot depend on the hour they run.
// (deskNow is already declared above, for the explanation tests.)
const formHome = (patch = {}) => ({ ...home, id: "form", title: "Elm Place", atmosphere: undefined,
  amenities: [], sources: [], observed_at: "2026-09-07", ...patch });
test("a building is a high-rise only where a source actually described one", () => {
  // The whole retained record, read the way the page reads it. One building in
  // 1,000 originally carried the words; later research adds two scoped descriptions.
  const record = JSON.parse(fs.readFileSync(new URL("../dist/data.json", import.meta.url)));
  const called = record.homes.filter((h) => buildingForm(h).status === "high_rise");
  assert.deepEqual(called.map((h) => h.id), ["coast", "215-west", "73-east-lake"]);
  const only = buildingForm(called.find(h => h.id === "73-east-lake"));
  assert.equal(only.phrase.toLowerCase(), "high-rise");
  assert.match(only.quote, /42-story high-rise/);
  assert.equal(only.observed_at, "2026-09-22", "the research source date, not the older rent observation");
  assert.equal(record.homes.filter((h) => buildingForm(h).status === "low_mid_rise").length, 0,
    "nothing in this record affirmatively establishes a low or mid-rise, so nothing claims one");
  // Of the 978 provider listings, NONE can be classified: the provider's
  // schema has no structural field at all.
  const listings = record.homes.filter((h) => h.kind === "listing");
  assert.equal(listings.length, 978);
  assert.equal(listings.filter((h) => buildingForm(h).status !== "unknown").length, 0);
  assert.equal(buildingForm(listings[0]).reason, "no_recorded_description");
});
test("the words that look structural and are not never classify a building", () => {
  // Each of these is real text from the retained record. Reading any of them as
  // a height would call ten buildings tall for owning a roof, and all 22 of
  // them the same thing for carrying the same accessibility question.
  const traps = [
    ["Confirm step-free entrances, elevators and the route from parking to the apartment.", "access checklist"],
    ["Rooftop terrace", "a roof is not a height"],
    ["Floor-to-ceiling windows", "a window is not a storey"],
    ["Light cabinetry and chestnut flooring, with a library and rooftop fire pits.", "flooring"],
    ["A320 floor-plan details and advertised availability", "a plan number is not a floor count"],
    ["Official floor-plan page says available now; recheck for the move-in date.", "a floor plan"],
    ["See all 34 floor-plans online.", "a count of PLANS is not a count of floors"],
  ];
  for (const [text, why] of traps) {
    assert.equal(buildingForm(formHome({ atmosphere: text })).status, "unknown", why);
    assert.equal(buildingForm(formHome({ amenities: [text] })).status, "unknown", why);
    assert.equal(buildingForm(formHome({ sources: [{ url: "https://example.com/a", supports: text, observed_at: "2026-01-01" }] })).status, "unknown", why);
  }
  // `access.note` is not read at all -- not because nothing in it ever matches,
  // but because a question to go and ask is not a description of a building.
  // This note would classify if that field were ever a source.
  assert.equal(buildingForm({ ...formHome(),
    access: { status: "unknown", note: "Confirm the high-rise elevator bank and the route from parking." } }).status,
    "unknown", "a tour question is never read as evidence, whatever words it contains");
});
test("a building named after a tower has not been described as one", () => {
  const named = formHome({ title: "Willis Tower Apartments", atmosphere: "Homes at Willis Tower Apartments." });
  assert.equal(buildingForm(named).status, "unknown");
  assert.equal(buildingForm(named).reason, "name_only");
  // The same word in a source's own description, on a building of another name,
  // is a description and is read.
  const described = formHome({ title: "Elm Place", atmosphere: "A slender tower above the river." });
  assert.equal(buildingForm(described).status, "high_rise");
  assert.equal(described.title.toLowerCase().includes("tower"), false);
});
test("a storey count decides which side of the line a building falls, and the line is one number", () => {
  const at = (n) => buildingForm(formHome({ atmosphere: `A ${n}-story building on the corner.` })).status;
  assert.equal(HIGH_RISE_STOREYS, 12);
  assert.equal(at(HIGH_RISE_STOREYS - 1), "low_mid_rise");
  assert.equal(at(HIGH_RISE_STOREYS), "high_rise");
  assert.equal(at(HIGH_RISE_STOREYS + 1), "high_rise");
  assert.equal(buildingForm(formHome({ atmosphere: "A 4-storey walk-up." })).status, "low_mid_rise");
  assert.equal(buildingForm(formHome({ amenities: ["Mid-rise building with a courtyard"] })).status, "low_mid_rise");
});
test("two sources describing one building differently is not a reading either way", () => {
  const split = formHome({ atmosphere: "A high-rise home.", amenities: ["Low-rise courtyard building"] });
  assert.equal(buildingForm(split).status, "unknown");
  assert.equal(buildingForm(split).reason, "conflicting_text");
  assert.match(buildingForm(split).because, /two different ways/);
});
test("an unrecorded height is never counted against a place, and never scores", () => {
  const tall = pickHome("tall", { atmosphere: "A 30-story tower.", search: undefined });
  const quiet = pickHome("quiet");
  const ranked = spicyPicks([tall, quiet, ...pickPeers()], emptyWorkspace(), defaults, {}, "downtown", pickNow);
  const signals = Object.fromEntries(ranked.candidates.map((c) => [c.home.id, c.signals.form]));
  assert.equal(signals.tall, 1);
  assert.equal(signals.quiet, 0, "unknown scores nothing -- it is never a deduction");
  assert(ranked.candidates.every((c) => c.signals.form >= 0));
  // And the unknown one is still a candidate: an unrecorded height hides nobody.
  assert(ranked.candidates.some((c) => c.home.id === "quiet"));
});
test("the downtown bands are measured from the centre the record itself recorded", () => {
  const near = pickHome("near", { lat: 41.882, lng: -87.632 });
  const far = pickHome("far", { lat: 42.05, lng: -87.69 });
  const homes = [near, far];
  const moved = { search_area: { center: { lat: 42.05, lng: -87.69, label: "somewhere else" } } };
  assert.equal(urbanSetting(near, {}).status, "core");
  assert.equal(urbanSetting(far, {}).status, "outside");
  // Move the recorded centre and BOTH the gate and the printed distance move
  // with it, because they are one anchor.
  assert.equal(urbanSetting(far, moved).status, "core");
  assert.equal(urbanSetting(far, moved).anchor, "somewhere else");
  assert.deepEqual(visibleHomes(homes, emptyWorkspace(), { ...defaults, urbanScope: "core" }, {}).map((h) => h.id), ["near"]);
  assert.deepEqual(visibleHomes(homes, emptyWorkspace(), { ...defaults, urbanScope: "core" }, moved).map((h) => h.id), ["far"]);
  // Every surface that narrows by distance reads the same anchor, so the
  // Decision Studio cannot answer from a different centre than the cards.
  const lens = { ...defaults, urbanScope: "core", bedrooms: "all" };
  assert.deepEqual(decisionPool(homes, emptyWorkspace(), lens, pickNow, {}).map((h) => h.id), ["near"]);
  assert.deepEqual(decisionPool(homes, emptyWorkspace(), lens, pickNow, moved).map((h) => h.id), ["far"]);
  assert.deepEqual(pricePulse(homes, emptyWorkspace(), lens, false, pickNow, moved).changes.map((c) => c.home.id).filter((id) => id === "near"), []);
});
test("a place with no coordinates is never given a position, and never called far away", () => {
  const lost = pickHome("lost", { lat: null, lng: null });
  const setting = urbanSetting(lost, {});
  assert.equal(setting.status, "unlocated");
  assert.equal(setting.miles, null);
  assert.notEqual(setting.status, "outside");
  // It stays in an unfiltered list and leaves only when a distance gate is set.
  assert(visibleHomes([lost], emptyWorkspace(), defaults, {}).length === 1);
  assert(visibleHomes([lost], emptyWorkspace(), { ...defaults, urbanScope: "near" }, {}).length === 0);
});
test("a target names the basis it was measured on and never claims an all-in cost", () => {
  const prefs = { ...defaults, targetRent: 2700 };
  const priced = pickHome("priced", { rent: 2650, parking: { status: "yes", monthly: null } });
  const band = budgetBand(priced, {}, prefs);
  assert.equal(band.basis, "base rent");
  assert.match(band.caveat, /Base rent only/);
  assert.match(band.caveat, /parking/);
  // $2,650 with parking unquoted is NOT "under $2,700 all in", and the band
  // never says it is.
  assert(!/all[- ]in/i.test(band.label + band.detail.replace(/not an all-in/i, "")));
  const onTotal = budgetBand(priced, {}, { ...prefs, basis: "total" });
  assert.equal(onTotal.basis, "known monthly subtotal");
  assert.match(onTotal.caveat, /Known subtotal only/);
  assert.equal(budgetBand(pickHome("none", { rent: null }), {}, prefs).status, "unpriced");
  assert.equal(budgetBand(priced, {}, defaults).status, "off", "no target set says nothing at all");
});
test("a place above the target is shown and named, never hidden and never urged", () => {
  const prefs = { ...defaults, targetRent: 2700 };
  const band = (rent) => budgetBand(pickHome("x", { rent }), {}, prefs);
  assert.equal(band(2500).status, "under");
  assert.equal(band(2700).status, "near");
  assert.equal(band(2835).status, "near", "the band's own edge is inside it");
  assert.equal(band(2836).status, "stretch");
  assert.equal(band(3000).status, "stretch");
  assert.equal(band(3001).status, "outside");
  assert.match(band(2900).label, /\$200 above your \$2,700 target/);
  const words = band(2900).label + " " + band(2900).detail;
  assert(!/\b(best|winner|perfect|ideal|recommend|guaranteed|worth it)\b/i.test(words), words);
  assert.match(band(2900).detail, /not because it is worth more/);
  // A stretch is still visible: the band is a label, not a filter.
  assert.equal(visibleHomes([pickHome("x", { rent: 2900 })], emptyWorkspace(), prefs, {}).length, 1);
});
test("parking keeps four answers that mean four different things", () => {
  const of = (parking, rec = {}) => parkingStanding({ ...home, parking }, rec);
  assert.equal(of({ status: "yes", monthly: 300 }).status, "priced");
  assert.equal(of({ status: "yes", monthly: 0 }).status, "priced", "a recorded $0 is an amount, not a missing one");
  assert.match(of({ status: "yes", monthly: 0 }).label, /\$0\/mo/);
  assert.equal(of({ status: "yes", monthly: null }).status, "advertised");
  assert.match(of({ status: "yes", monthly: null }).label, /price not quoted/);
  assert.equal(of({ status: "no" }).status, "none");
  assert.equal(of({ status: "unknown" }).status, "unknown");
  assert.equal(of(undefined).status, "unknown");
  // Unknown is never worded as a refusal, and a refusal is never worded as
  // unknown.
  const unknown = of({ status: "unknown" });
  assert(!/no resident parking|not offered/i.test(unknown.label + unknown.detail));
  assert.match(unknown.detail, /Unknown is not a no/);
  assert(!/unknown|not recorded/i.test(of({ status: "no" }).label));
  // The reader's own quote is marked as theirs rather than as the source's.
  assert.equal(of({ status: "yes", monthly: null }, { parkingCost: 220 }).quotedBy, "you");
  assert.match(of({ status: "yes", monthly: null }, { parkingCost: 220 }).label, /in your own quote/);
});
test("the lens explains nothing while it is off, and stops explaining when it is turned off", () => {
  const tall = { ...home, id: "tall", atmosphere: "A high-rise home downtown.", lat: 41.882, lng: -87.632, rent: 2650 };
  const on = { ...defaults, urbanScope: "near", targetRent: 2700, highRise: true };
  const text = (prefs) => surfacedBecause(tall, emptyWorkspace(), prefs, {}, deskNow).map((r) => r.text).join(" | ");
  const lit = text(on);
  assert.match(lit, /inside the near-downtown area you chose/);
  assert.match(lit, /calls it a high-rise/);
  assert.match(lit, /Within \$135 of your \$2,700 target/);
  const dark = text(defaults);
  for (const gone of [/downtown/i, /high-rise/i, /target/i]) assert(!gone.test(dark), `${gone} survived the preference being off: ${dark}`);
  // Turning ONE of them off takes only its own sentence.
  const noHeight = text({ ...on, highRise: false });
  assert(!/high-rise/i.test(noHeight));
  assert.match(noHeight, /inside the near-downtown area you chose/);
});
test("a high-rise reason is never offered for a building nobody described", () => {
  const quiet = { ...home, id: "quiet", atmosphere: undefined, amenities: [], sources: [], lat: 41.882, lng: -87.632 };
  const on = { ...defaults, urbanScope: "near", targetRent: 2700, highRise: true };
  const reasons = surfacedBecause(quiet, emptyWorkspace(), on, {}, deskNow).map((r) => r.text).join(" | ");
  assert(!/high-rise/i.test(reasons), reasons);
  // The priority readback is a second door into the same sentence, so it is
  // asked here too: a weight that rewards a recorded form must still produce
  // nothing for a record that has none.
  const readback = surfacedBecause(quiet, emptyWorkspace(), on,
    { pick: { signals: { form: 0, budget: 0, value: 0, space: 0, amenities: 0, evidence: 0, rail: 0 } },
      weights: { form: 100 }, priority: "downtown" }, deskNow).map((r) => r.text).join(" | ");
  assert(!/high-rise/i.test(readback), readback);
  // ... and the same door DOES produce it for a record that has one.
  const tallReadback = surfacedBecause({ ...quiet, atmosphere: "A high-rise home downtown." }, emptyWorkspace(),
    { ...on, highRise: false }, { pick: { signals: { form: 1 } }, weights: { form: 100 }, priority: "downtown" }, deskNow)
    .map((r) => r.text).join(" | ");
  assert.match(tallReadback, /calls it a high-rise/);
  // What it gets instead is the open fact -- first, because the lens is what
  // makes it consequential.
  const opens = focusUnknowns(quiet, {}, on, deskNow, 2);
  assert.equal(opens[0].kind, "form");
  assert.match(opens[0].detail, /Unknown is not a low-rise/);
  assert.equal(opens.length, 2, "the lens carries a second open fact, not one repeated");
  assert.notEqual(opens[1].key, opens[0].key);
  // With the lens off there is no form question at all, and one fact is the cap.
  assert(!focusUnknowns(quiet, {}, defaults, deskNow, 2).some((i) => i.kind === "form"));
  assert.equal(focusUnknowns(quiet, {}, defaults, deskNow, 1).length, 1);
  // And a record with a RECORDED height is not asked about it.
  const tall = { ...quiet, atmosphere: "A high-rise home downtown." };
  assert(!focusUnknowns(tall, {}, on, deskNow, 2).some((i) => i.kind === "form"));
});
test("a saved snapshot is read from its own words and its own date, never today's", () => {
  // Part of the record's honesty: nothing is backfilled onto an old snapshot.
  const older = { ...home, id: "older", observed_at: "2026-03-01",
    atmosphere: "A 20-story building by the park.", sources: [] };
  assert.equal(buildingForm(older).observed_at, "2026-03-01");
  const silent = { ...older, atmosphere: undefined, amenities: [] };
  assert.equal(buildingForm(silent).status, "unknown");
  assert.equal(buildingForm(silent).observed_at, null, "nothing recorded carries no date at all");
  assert.equal(buildingForm(silent).quote, "");
});
test("a preset is a starting point that merges, never a mode that replaces", () => {
  const preset = lensPresets.find((entry) => entry.key === "downtown-value");
  assert(preset, "the downtown starting point exists");
  // It sets only the four fields the lens is made of, and nothing else.
  assert.deepEqual(Object.keys(preset.preferences).sort(),
    ["highRise", "parkingPreferred", "targetRent", "urbanScope"]);
  // Merged onto a reader's own settings, theirs survive.
  const mine = { ...defaults, bedrooms: "2", layoutScope: "source", max: 2800, utilityEstimate: 90 };
  const after = validatePreferences({ ...mine, ...preset.preferences });
  assert.equal(after.bedrooms, "2");
  assert.equal(after.layoutScope, "source");
  assert.equal(after.max, 2800);
  assert.equal(after.utilityEstimate, 90);
  assert.equal(after.urbanScope, "near");
  assert.equal(after.targetRent, 2700);
  // Every value it sets is an ordinary preference the reader can change back.
  for (const [key, value] of Object.entries(preset.preferences)) {
    assert.notEqual(value, defaults[key], `${key} would be a no-op`);
    assert.doesNotThrow(() => validatePreferences({ ...after, [key]: defaults[key] }));
  }
  // The name describes a way of looking, not a person.
  assert(!/tahir/i.test(JSON.stringify(lensPresets)), "no preset is named after a reader");
});
test("asking for parking changes what is said about it, and never what it says", () => {
  const near = { ...home, id: "near", lat: 41.882, lng: -87.632 };
  const on = { ...defaults, parkingPreferred: true };
  const reasons = (h, prefs) => surfacedBecause(h, emptyWorkspace(), prefs, {}, deskNow).map((r) => r.text).join(" | ");
  const advertised = { ...near, parking: { status: "yes", monthly: null } };
  assert.match(reasons(advertised, on), /Resident parking is advertised, which you asked to prioritise/);
  assert.match(reasons({ ...near, parking: { status: "yes", monthly: 175 } }, on), /\$175\/mo on record, the kind of answer you asked to see/);
  // An unknown or a refusal is never turned into a reason to look closer.
  for (const parking of [{ status: "unknown" }, { status: "no" }, undefined])
    assert(!/parking/i.test(reasons({ ...near, parking }, on)), JSON.stringify(parking));
  // And with the preference off, not even the advertised one is claimed.
  assert(!/asked to prioritise/.test(reasons(advertised, defaults)));
  // It is a preference, never a gate: an unrecorded answer hides nobody.
  const pool = [advertised, { ...near, id: "quiet", parking: { status: "unknown" } }];
  assert.equal(visibleHomes(pool, emptyWorkspace(), on, {}).length, 2);
});
test("the parking question the lens raises matches the answer the record gives", () => {
  const near = { ...home, id: "near", lat: 41.882, lng: -87.632, charging: { status: "yes" } };
  const on = { ...defaults, parkingPreferred: true };
  const first = (parking, rec = {}) => focusUnknowns({ ...near, parking }, rec, on, deskNow, 1)[0];
  assert.equal(first({ status: "unknown" }).label, "Parking not recorded");
  assert.match(first({ status: "unknown" }).detail, /Unknown is not a no/);
  assert.equal(first({ status: "yes", monthly: null }).label, "Parking price not quoted");
  assert.equal(first({ status: "no" }).label, "The source reports no resident parking");
  // A priced space leaves no parking question, so the record's own next one wins.
  assert.notEqual(first({ status: "yes", monthly: 150 }, { parkingCost: 150 }).key, "parking");
  // With the preference off the record's own order is untouched.
  assert.notEqual(focusUnknowns({ ...near, parking: { status: "unknown" } }, {}, defaults, deskNow, 1)[0].key, "parking");
  // The three answers are never merged into one sentence.
  const said = [{ status: "unknown" }, { status: "yes", monthly: null }, { status: "no" }].map((p) => first(p).label);
  assert.equal(new Set(said).size, 3, said.join(" / "));
});

// ---------------------------------------------------------------------------
// Personal quote dates. A notebook save time is not a quote-observation date.
test("a personal quote is observed on the day entered, or on no day, and never on the day it was saved", () => {
  const at = "2026-09-19T00:00:00.500Z"; // half a second past a UTC midnight
  const first = recordQuote({}, { rentOverride: 2600, quoteDate: "2026-09-10" }, at);
  assert.equal(first.change, "observed");
  assert.deepEqual(first.history, [{ rent: 2600, date: "2026-09-10", date_basis: "entered", recorded_at: at }]);
  const record = { rentOverride: 2600, quoteDate: "2026-09-10", quote_history: first.history };
  const blank = recordQuote(record, { rentOverride: 2500, quoteDate: "" }, at);
  assert.equal(blank.change, "observed");
  assert.equal(blank.history.length, 2);
  assert.deepEqual(blank.history[1], { rent: 2500, date: null, date_basis: "unknown", recorded_at: at });
  assert.deepEqual(blank.history[0], first.history[0], "the earlier observation is untouched");
  // The recording instant sits on a UTC-midnight boundary; no day is read off it on either side.
  const ev = quoteEvidence({ rentOverride: 2500, quoteDate: "", quote_history: blank.history });
  assert.deepEqual(ev.dated, [{ date: "2026-09-10", rent: 2600 }]);
  assert.equal(ev.unknown, 1);
  assert.equal(ev.entries[1].date, null);
  assert.equal(ev.entries[1].recorded_at, at, "the recording instant is kept, as a recording instant");
  for (const day of ["2026-09-18", "2026-09-19"]) assert(!JSON.stringify(ev.dated).includes(day), `${day} is not a quote date`);
  // The bound on entries is the one the notebook always had.
  const full = { rentOverride: 1, quote_history: Array.from({ length: QUOTE_HISTORY_MAX }, (_, i) => ({ rent: i + 1, date: "2026-09-01", date_basis: "entered" })) };
  assert.equal(recordQuote(full, { rentOverride: 9999, quoteDate: "" }, at).history.length, QUOTE_HISTORY_MAX);
});
test("changing only the quote date corrects the active quote's own entry and keeps what it replaced", () => {
  const at1 = "2026-09-19T01:00:00Z", at2 = "2026-09-19T02:00:00Z", at3 = "2026-09-19T03:00:00Z";
  const history = [
    { rent: 2600, date: "2026-09-10", date_basis: "entered", recorded_at: at1 },
    { rent: 2500, date: null, date_basis: "unknown", recorded_at: at1 },
  ];
  const record = { rentOverride: 2500, quoteDate: "", quote_history: history };
  const dated = recordQuote(record, { rentOverride: 2500, quoteDate: "2026-09-11" }, at2);
  assert.equal(dated.change, "corrected");
  assert.equal(dated.history.length, 2, "a corrected day is one observation with a history, not two observations");
  assert.deepEqual(dated.history[1], { rent: 2500, date: "2026-09-11", date_basis: "entered", recorded_at: at1,
    date_corrections: [{ from: null, basis: "unknown", at: at2 }] });
  assert.deepEqual(dated.history[0], history[0]);
  // One movement, between the two days the reader entered.
  assert.deepEqual(quoteEvidence({ ...record, quoteDate: "2026-09-11", quote_history: dated.history }).dated,
    [{ date: "2026-09-10", rent: 2600 }, { date: "2026-09-11", rent: 2500 }]);
  // Clearing the date is the same kind of correction, back to unknown, with the day it replaced kept.
  const cleared = recordQuote({ ...record, quoteDate: "2026-09-11", quote_history: dated.history }, { rentOverride: 2500, quoteDate: "" }, at3);
  assert.equal(cleared.change, "corrected");
  assert.equal(cleared.history[1].date, null);
  assert.equal(cleared.history[1].date_basis, "unknown");
  assert.deepEqual(cleared.history[1].date_corrections,
    [{ from: null, basis: "unknown", at: at2 }, { from: "2026-09-11", basis: "entered", at: at3 }]);
  assert.equal(quoteEvidence({ ...record, quote_history: cleared.history }).dated.length, 1);
  // Corrections are bounded, and the newest are the ones kept.
  let run = { rentOverride: 2500, quoteDate: "2026-09-01", quote_history: [{ rent: 2500, date: "2026-09-01", date_basis: "entered" }] };
  for (let i = 2; i <= QUOTE_CORRECTIONS_MAX + 5; i++) {
    const day = `2026-10-${String(i % 28 + 1).padStart(2, "0")}`;
    run = { ...run, quoteDate: day, quote_history: recordQuote(run, { rentOverride: 2500, quoteDate: day }, `2026-11-01T00:00:${String(i % 60).padStart(2, "0")}Z`).history };
  }
  assert.equal(run.quote_history.length, 1);
  assert.equal(run.quote_history[0].date_corrections.length, QUOTE_CORRECTIONS_MAX);
});
test("a save that changes no quote records nothing and re-dates nothing", () => {
  const history = [{ rent: 2500, date: "2026-09-11", date_basis: "entered", recorded_at: "2026-09-19T01:00:00Z" }];
  const record = { rentOverride: 2500, quoteDate: "2026-09-11", quote_history: history, notes: "old", status: "researching" };
  for (const next of [
    { ...record, notes: "new notes" },
    { ...record, status: "toured" },
    { ...record, tourDate: "2026-09-21T10:00" },
    { ...record, tourChecks: { noise: true } },
    { ...record },
    { ...record, rentOverride: null, quoteDate: "2026-09-12" }, // a day without an amount is not a quote
    { ...record, rentOverride: null, quoteDate: "" },
  ]) {
    const out = recordQuote(record, next, "2026-09-19T02:00:00Z");
    assert.equal(out.change, null);
    assert.equal(out.history, history, "the same array, untouched");
  }
  // Amount only: the new amount is an observation on the day still in the field.
  const amountOnly = recordQuote(record, { ...record, rentOverride: 2450 }, "2026-09-19T02:00:00Z");
  assert.equal(amountOnly.change, "observed");
  assert.deepEqual(amountOnly.history.at(-1), { rent: 2450, date: "2026-09-11", date_basis: "entered", recorded_at: "2026-09-19T02:00:00Z" });
  // Two amounts on one day conflict, and a conflict is not a movement.
  const h = pickHome("quoted", { history: [] }), w = emptyWorkspace();
  w.records.quoted = { ...record, rentOverride: 2450, quote_history: amountOnly.history, saved: true };
  assert.equal(pricePulse([h], w, defaults, true, new Date("2026-09-19T12:00:00Z")).changes.length, 0);
  // A record with an amount but no entry to correct gets its observation recorded now, on the day entered.
  const bare = recordQuote({ rentOverride: 2500, quoteDate: "" }, { rentOverride: 2500, quoteDate: "2026-09-11" }, "2026-09-19T02:00:00Z");
  assert.equal(bare.change, "observed");
  assert.deepEqual(bare.history, [{ rent: 2500, date: "2026-09-11", date_basis: "entered", recorded_at: "2026-09-19T02:00:00Z" }]);
});
test("legacy quote entries are kept as written, read as unrecorded provenance, and count only beside the reader's dated active quote", () => {
  const legacy = [{ date: "2026-09-05", rent: 2600 }, { date: "2026-09-12", rent: 2500 }];
  // Nothing on record says whether either day was entered or was the day it was saved.
  const undated = quoteEvidence({ rentOverride: 2500, quoteDate: "", quote_history: legacy });
  assert.deepEqual(undated.entries.map((e) => e.basis), ["unrecorded", "unrecorded"]);
  assert.deepEqual(undated.entries.map((e) => e.date), ["2026-09-05", "2026-09-12"], "the days are kept, not erased");
  assert.deepEqual(undated.dated, []);
  assert.equal(undated.unrecorded, 2);
  // The reader's own dated active quote supports the entry it names, and that one only.
  const supported = quoteEvidence({ rentOverride: 2500, quoteDate: "2026-09-12", quote_history: legacy });
  assert.deepEqual(supported.entries.map((e) => e.supported), [false, true]);
  assert.deepEqual(supported.dated, [{ date: "2026-09-12", rent: 2500 }]);
  assert.equal(supported.unrecorded, 1);
  // A different amount, a different day, or an entry that is not the last one is no support.
  assert.deepEqual(quoteEvidence({ rentOverride: 2400, quoteDate: "2026-09-12", quote_history: legacy }).dated, []);
  assert.deepEqual(quoteEvidence({ rentOverride: 2500, quoteDate: "2026-09-13", quote_history: legacy }).dated, []);
  assert.deepEqual(quoteEvidence({ rentOverride: 2600, quoteDate: "2026-09-05", quote_history: legacy }).dated, []);
  // Nothing is rewritten: a legacy notebook validates and comes back as it went in.
  const w = emptyWorkspace();
  w.records[home.id] = { saved: true, rentOverride: 2500, quoteDate: "", quote_history: legacy };
  assert.deepEqual(validateWorkspace(w).records[home.id].quote_history, legacy);
  // Correcting a legacy entry's date is the reader establishing it; the old day is kept beside it.
  const fixed = recordQuote(w.records[home.id], { rentOverride: 2500, quoteDate: "2026-09-11" }, "2026-09-19T02:00:00Z");
  assert.equal(fixed.change, "corrected");
  assert.deepEqual(fixed.history[1], { date: "2026-09-11", rent: 2500, date_basis: "entered",
    date_corrections: [{ from: "2026-09-12", basis: null, at: "2026-09-19T02:00:00Z" }] });
  assert.deepEqual(fixed.history[0], legacy[0]);
  assert.deepEqual(quoteEvidence({ rentOverride: 2500, quoteDate: "2026-09-11", quote_history: fixed.history }).dated, [{ date: "2026-09-11", rent: 2500 }]);
});
test("the personal quote contract validates on import, and the source contract is unchanged", () => {
  const ok = (history) => { const w = emptyWorkspace(); w.records[home.id] = { saved: true, snapshot: home, quote_history: history }; return validateWorkspace(w); };
  for (const history of [
    [{ date: "2026-09-07", rent: 2500 }],
    [{ rent: 2500, date: "2026-09-07", date_basis: "entered", recorded_at: "2026-09-19T01:00:00Z" }],
    [{ rent: 2500, date: null, date_basis: "unknown", recorded_at: "2026-09-19T01:00:00Z" }],
    [{ rent: 2500, date_basis: "unknown" }],
    [{ rent: 2500, date: "2026-09-08", date_basis: "entered", date_corrections: [{ from: null, basis: "unknown", at: "2026-09-19T01:00:00Z" }, { from: "2026-09-07", basis: null, at: "2026-09-19T02:00:00Z" }] }],
    [{ rent: null, date: "2026-09-07" }],
  ]) assert.deepEqual(ok(history).records[home.id].quote_history, history);
  for (const history of [
    [{ rent: 2500, date: null }], // no day and nothing saying so
    [{ rent: 2500, date: "2026-09-07", date_basis: "unknown" }], // a day on an entry that claims none
    [{ rent: 2500, date: null, date_basis: "entered" }],
    [{ rent: 2500, date: "2026-09-07", date_basis: "guessed" }],
    [{ rent: 2500, date: "2026-09-07", recorded_at: "yesterday" }],
    [{ rent: 2500, date: "2026-09-07", date_corrections: {} }],
    [{ rent: 2500, date: "2026-09-07", date_corrections: [{ from: "2026-09-06" }] }],
    [{ rent: 2500, date: "2026-09-07", date_corrections: [{ from: "not a day", at: "2026-09-19T01:00:00Z" }] }],
    [{ rent: 2500, date: "2026-09-07", date_corrections: [{ from: null, basis: "saved", at: "2026-09-19T01:00:00Z" }] }],
    [{ rent: 2500, date: "2026-09-07", date_corrections: Array.from({ length: QUOTE_CORRECTIONS_MAX + 1 }, () => ({ from: null, at: "2026-09-19T01:00:00Z" })) }],
    [{ rent: -1, date: "2026-09-07" }],
  ]) assert.throws(() => ok(history), /invalid saved home or quote/);
  // A source history is the provider's and still needs a day on every point.
  assert.equal(validateHome({ ...home, history: [{ date: "2026-09-07", rent: 2500 }] }), true);
  assert.equal(validateHome({ ...home, history: [{ date: null, rent: 2500, date_basis: "unknown" }] }), false);
  assert.throws(() => validateFeed({ ...seed, homes: [{ ...home, history: [{ date: null, rent: 2500, date_basis: "unknown" }] }] }));
  const w = emptyWorkspace();
  w.records[home.id] = { saved: true, snapshot: { ...home, history: [{ date: null, rent: 2500, date_basis: "unknown" }] } };
  assert.throws(() => validateWorkspace(w));
});
test("Price Pulse derives a personal movement only between days the reader entered, and says how many it left out", () => {
  const now = new Date("2026-09-19T12:00:00Z");
  const h = pickHome("quoted", { history: [] }), w = emptyWorkspace();
  const entered = [
    { rent: 2600, date: "2026-09-10", date_basis: "entered", recorded_at: "2026-09-19T00:00:00.000Z" },
    { rent: 2500, date: null, date_basis: "unknown", recorded_at: "2026-09-19T00:00:00.000Z" },
  ];
  w.records.quoted = { saved: true, rentOverride: 2500, quoteDate: "", quote_history: entered };
  let pulse = pricePulse([h], w, defaults, true, now);
  assert.equal(pulse.changes.length, 0, "an undated quote is not a dated decrease");
  assert.equal(pulse.undatedQuotes, 1);
  assert.deepEqual(pulse.stale.map((s) => s.id), ["quoted"], "an undated active quote is one to recheck, not a fresh one");
  // The reader dates it: one movement, between their two days, dated by neither recording instant.
  w.records.quoted = { ...w.records.quoted, quoteDate: "2026-09-11",
    quote_history: [entered[0], { ...entered[1], date: "2026-09-11", date_basis: "entered", date_corrections: [{ from: null, basis: "unknown", at: "2026-09-19T00:00:00.000Z" }] }] };
  pulse = pricePulse([h], w, defaults, true, now);
  assert.equal(pulse.changes.length, 1);
  assert.equal(pulse.changes[0].kind, "personal");
  assert.equal(pulse.changes[0].delta, -100);
  assert.equal(pulse.changes[0].prior.date, "2026-09-10T00:00:00.000Z");
  assert.equal(pulse.changes[0].latest.date, "2026-09-11T00:00:00.000Z");
  assert.equal(pulse.changes[0].lastObserved, "2026-09-11T00:00:00.000Z");
  assert.equal(pulse.undatedQuotes, 0);
  // A recording instant on either side of a UTC midnight never becomes the day.
  for (const at of ["2026-09-18T23:59:59.999Z", "2026-09-19T00:00:00.000Z"]) {
    w.records.quoted = { saved: true, rentOverride: 2500, quoteDate: "", quote_history: [{ ...entered[0], recorded_at: at }, { ...entered[1], recorded_at: at }] };
    assert.equal(pricePulse([h], w, defaults, true, now).changes.length, 0, at);
  }
  // Legacy entries, no active date: kept, counted, no movement. With the reader's
  // dated active quote naming the last one, still no movement: the first day is unsupported.
  for (const quoteDate of ["", "2026-09-12"]) {
    w.records.quoted = { saved: true, rentOverride: 2500, quoteDate, quote_history: [{ date: "2026-09-05", rent: 2600 }, { date: "2026-09-12", rent: 2500 }] };
    pulse = pricePulse([h], w, defaults, true, now);
    assert.equal(pulse.changes.length, 0, quoteDate || "undated");
    assert.equal(pulse.undatedQuotes, quoteDate ? 1 : 2);
  }
});

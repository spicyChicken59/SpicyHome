import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM, VirtualConsole } from 'jsdom';
import { defaults, downtownSearch, criteriaReading, discoveryGroups, visibleHomes, emptyWorkspace, validatePreferences, validateWorkspace, validateHome, validHomeEvidence, attributeReading, homeEvidenceReading, moveInReading, preferredBudget, buildingForm, leasingQuestions } from '../dist/model.js';
const clone = v => structuredClone(v);
const feed = JSON.parse(fs.readFileSync(new URL('../dist/data.json',import.meta.url)));
const p = downtownSearch(defaults);
const assertion = (attribute,value,extra={}) => ({attribute,value,status:value===null?'unknown':'reported',scope:'plan',subject:'P1',applies:'exact',note:'Synthetic acceptance assertion; not production research.',source:{name:'Synthetic fixture',url:'https://example.invalid/property',observed_at:'2026-09-22'},...extra});
function fixture(id='positive', changes={}) {
  return {id,kind:'building',title:'Synthetic '+id,address:'1 Example Ave, Chicago, IL',city:'Chicago',neighborhood:'River North',bedrooms:1,bathrooms:1,layout_status:'source_listed',floor_plan:'P1',rent:2400,sqft:700,observed_at:'2026-09-07',history:[{date:'2026-09-07',rent:2400}],sources:[{url:'https://example.invalid/property',observed_at:'2026-09-07',supports:'Synthetic fixture'}],parking:{status:'unknown',monthly:null},charging:{status:'unknown'},fees:{monthly:null,one_time:null},home_evidence:[assertion('neighborhood',['River North'],{scope:'building',subject:'Synthetic building',applies:'all'}),assertion('balcony','private'),assertion('laundry','in_unit_both'),assertion('sqft',700),assertion('height','20-story building',{scope:'building',subject:'Synthetic building',applies:'general'})],...changes};
}
function replace(h,attr,value,extra={}) {return {...h,home_evidence:[...h.home_evidence.filter(e=>e.attribute!==attr),assertion(attr,value,extra)]};}
const w=emptyWorkspace();

test('downtown preset explicitly clears old cap and filters, preserves optional UI/estimate and is valid',()=>{
 const old={...defaults,min:1800,max:1900,search:'old',charging:true,parking:true,neighborhood:'South Loop',utilityEstimate:0,surface:'focus'};
 const next=downtownSearch(old);assert.equal(next.max,20000);assert.equal(next.min,0);assert.equal(next.strictCap,null);assert.equal(next.budgetMode,'flexible');assert.equal(next.search,'');assert.equal(next.charging,false);assert.equal(next.surface,'focus');assert.equal(next.utilityEstimate,0);assert.equal(old.max,1900);assert.deepEqual(validatePreferences(next),next);
});
test('area inclusions OR together, South Loop exclusion wins overlapping and conflicting source labels',()=>{
 const rn=fixture(),loop=replace(fixture('loop'),'neighborhood',['The Loop'],{scope:'building',applies:'all'}),south=replace(fixture('south'),'neighborhood',['The Loop','South Loop'],{scope:'building',applies:'all'});
 const unknown={...fixture('unknown'),kind:'listing',neighborhood:'Chicago · neighborhood unverified',home_evidence:[]};
 const groups=discoveryGroups([rn,loop,south,unknown],w,p);assert.deepEqual(groups.matches.map(h=>h.id),['positive','loop']);assert.deepEqual(groups.excluded.map(h=>h.id),['south']);assert.deepEqual(groups.unresolved.map(h=>h.id),['unknown']);
 const conflict={...south,home_evidence:[...south.home_evidence,assertion('neighborhood',['River North'],{scope:'building',applies:'all',source:{name:'Second synthetic source',url:'https://example.invalid/second',observed_at:'2026-09-22'}})]};
 assert.equal(criteriaReading(conflict,{},p).status,'excluded');
 assert.equal(discoveryGroups([rn],w,{...p,excludeAreas:['River North']}).matches.length,0);
});
test('private outdoor and both laundry functions require applicable exact evidence, never selected/shared/hookups',()=>{
 for(const v of ['juliet','shared','none'])assert.equal(criteriaReading(replace(fixture(),'balcony',v),{},p).status,'excluded',v);
 for(const v of ['washer_only','dryer_only','shared','hookups','none'])assert.equal(criteriaReading(replace(fixture(),'laundry',v),{},p).status,'excluded',v);
 for(const attr of ['balcony','laundry'])for(const patch of [{applies:'selected'},{applies:'general'},{subject:'Other plan'},{scope:'unit',subject:'1901'}])assert.equal(criteriaReading(replace(fixture(),attr,attr==='balcony'?'private':'in_unit_both',patch),{},p).status,'lead');
 assert.equal(criteriaReading(fixture(),{},p).status,'match');
});
test('size 599 and 600 fail; >600 passes; absent/building-range/unqualified evidence never passes',()=>{
 for(const size of [599,600,600.01,800,null])assert.equal(criteriaReading(replace(fixture(),'sqft',size),{},p).status,size===null?'lead':size>600?'match':'excluded');
 assert.equal(criteriaReading(replace(fixture(),'sqft',900,{scope:'building',applies:'general'}),{},p).status,'lead');
 const h=replace(fixture(),'sqft',null);assert.equal(criteriaReading(h,{}, {...p,over600:false}).status,'match');
});
test('building height never establishes apartment floor or actual view',()=>{
 const h=fixture();assert.equal(buildingForm(h).status,'high_rise');assert.equal(attributeReading(h,{},'floor').status,'unknown');assert.equal(attributeReading({...h,unit_label:'3901'}, {},'floor').status,'unknown');assert.equal(attributeReading(h,{},'view').status,'unknown');
 assert(leasingQuestions(h,{},new Date(),p).some(q=>q.includes('What floor')));assert(!leasingQuestions(h,{},new Date(),p).some(q=>q.includes('EV charging')));
});
const eligibility=(scope)=>({condition:'income_restricted',scope,note:'Synthetic program evidence.',source:{name:'Synthetic',url:'https://example.invalid/program',observed_at:'2026-09-20',supports:'Synthetic program; exact scope only.'}});
test('documented offer restriction excludes, address evidence holds, conflicts hold and cheap unknown is not restricted',()=>{
 assert.equal(criteriaReading({...fixture(),eligibility_evidence:eligibility('offer')},{},p).status,'excluded');
 assert.equal(criteriaReading({...fixture(),eligibility_evidence:eligibility('address')},{},p).status,'lead');
 assert.equal(criteriaReading({...fixture(),rent:900},{},p).status,'match');
 let market=replace(fixture(),'eligibility','unrestricted');market.eligibility_evidence=eligibility('address');assert.equal(criteriaReading(market,{},p).status,'match');
 market.eligibility_evidence=eligibility('offer');assert.equal(criteriaReading(market,{},p).status,'lead');
 const mixed=replace(fixture(),'eligibility','mixed_program',{scope:'address',applies:'general'});assert.equal(criteriaReading(mixed,{},p).status,'lead');
 assert.equal(criteriaReading(mixed,{}, {...p,excludeRestricted:false}).status,'match');
});
test('flexible budget is not a minimum or hidden cap and incomplete subtotal stays qualified',()=>{
 const homes=[fixture('cheap',{rent:1000}),fixture('stretch',{rent:3400}),fixture('unquoted',{rent:null})];
 assert.equal(visibleHomes(homes,w,p).length,3);assert.deepEqual(visibleHomes(homes,w,{...p,strictCap:3000}).map(h=>h.id),['cheap','unquoted']);
 assert.match(preferredBudget(fixture(),{parkingCost:0},{...p,basis:'total'}),/not an all-in budget match/);
});
test('source-backed date after target differs from missing date; plan does not inherit a different unit date',()=>{
 const late=replace(fixture(),'availability','2026-11-06');assert.equal(moveInReading(late,{},p.moveIn).timing,'after');assert.match(moveInReading(late,{},p.moveIn).label,/after your target/);
 assert.equal(moveInReading(fixture(),{},p.moveIn).timing,'unknown');
 assert.equal(moveInReading(replace(fixture(),'availability','2026-10-26',{scope:'unit',subject:'806'}),{},p.moveIn).timing,'unknown');
});
test('fresh and legacy searches validate; malformed preferences and source scopes are rejected at every import boundary',()=>{
 assert.equal(validateWorkspace({...w,preferences:{max:2800},savedSearches:[{name:'Legacy',preferences:{neighborhood:'The Loop'}}]}).savedSearches[0].preferences.budgetMode,'strict');
 for(const patch of [{includeAreas:'River North'},{excludeAreas:[3]},{preferredMin:4000},{strictCap:-1},{moveIn:'2026-02-30'},{inUnitLaundry:'true'},{resultGroup:'all'}])assert.throws(()=>validatePreferences({...p,...patch}));
 for(const patch of [{scope:'city'},{applies:'usually'},{value:true},{source:{name:'x',url:'javascript:bad',observed_at:'2026-09-22'}}]){
   const h=replace(fixture(),'sqft',700,patch);assert.equal(validateHome(h),false);assert.throws(()=>validateWorkspace({...w,records:{positive:{saved:true,snapshot:h}}}));
 }
 for(const malformed of [null, false, [], "wrong"]) assert.throws(()=>validatePreferences(malformed));
 assert(!validHomeEvidence([assertion('availability','2026-02-30')]));
});
test('real research: five leads, zero full preset matches; source counts are retained-data counts',()=>{
 const groups=discoveryGroups(feed.homes,w,p,feed);assert.equal(groups.matches.length,0);assert.deepEqual(new Set(groups.leads.map(h=>h.id)),new Set(['coast','marlowe','amli-west-loop','215-west','73-east-lake']));
 for(const id of ['amli-lofts','amli-900','aspire','the-elle','grand-central'])assert(groups.excluded.some(h=>h.id===id),id);
 assert.equal(groups.unresolved.length,256);assert.equal(feed.homes.length,1000);
});

const html=fs.readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');
const code=fs.readFileSync(new URL('../dist/model.js',import.meta.url),'utf8').replace(/^export\s+/gm,'')+'\n'+fs.readFileSync(new URL('../dist/app.js',import.meta.url),'utf8').replace(/^import\s*\{[\s\S]*?\}\s*from\s*["']\.\/model\.js(?:\?[^"']*)?["'];?\s*/,'');
const KEY='spicyhome.workspace.v1';
async function boot(homes,notebook=null,now=null) {
 const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
 const dom=new JSDOM(html,{url:'https://downtown-fixture.test/',runScripts:'outside-only',virtualConsole:vc});const w=dom.window,doc=w.document;
 if(now) { const NativeDate=w.Date; w.Date=class extends NativeDate {
   constructor(...args){super(...(args.length ? args : [now]));}
   static now(){return new NativeDate(now).getTime();}
 }; }
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 w.matchMedia=()=>({matches:false});w.confirm=()=>true;w.URL.createObjectURL=()=> 'blob:synthetic';w.URL.revokeObjectURL=()=>{};w.HTMLAnchorElement.prototype.click=()=>{};
 if(notebook)w.localStorage.setItem(KEY,JSON.stringify(notebook));
 const data={...feed,homes};w.fetch=async url=>({ok:true,text:async()=>JSON.stringify(String(url).includes('config.json')?{feed_url:'fixture',fallback_url:'fixture'}:data)});
 w.eval(code);for(let i=0;i<80&&!doc.querySelector('#apply-downtown');i++)await new Promise(r=>setTimeout(r,3));
 return {w,doc,errors,setNow:at=>{now=at;},notebook:()=>JSON.parse(w.localStorage.getItem(KEY)),close:()=>{w.close();assert.deepEqual(errors,[]);}};
}
const input=(d,selector,value)=>{const el=d.doc.querySelector(selector);el.value=value;el.dispatchEvent(new d.w.Event('change',{bubbles:true}));};
const importText=(d,text)=>d.doc.querySelector('#import-file').onchange({target:{files:[{size:text.length,text:async()=>text}],value:''}});
const click=(d,selector)=>{const el=d.doc.querySelector(selector);assert(el,selector);el.click();};
const saveRecord=(d)=>d.doc.querySelector('#record-form').dispatchEvent(new d.w.Event('submit',{bubbles:true,cancelable:true}));

test('journey: explicit apply, neighborhoods, surfaces, lead, two saves, compare, note, reload and export/import',async()=>{
 const a=fixture('first'),b=replace(fixture('second'),'sqft',850),lead=replace(fixture('lead'),'balcony',null),south=replace(fixture('south'),'neighborhood',['The Loop','South Loop'],{scope:'building',applies:'all'});
 const homes=[a,b,lead,south];let d=await boot(homes,{...emptyWorkspace(),preferences:{...defaults,max:1900,charging:true},savedSearches:[{name:'Old',preferences:{...defaults,max:1900}}]});
 assert.equal(d.notebook()?.preferences.homeSearch,false);click(d,'#apply-downtown');assert.equal(d.doc.querySelectorAll('#results .home-card').length,2);assert.equal(d.notebook().savedSearches[0].preferences.max,1900);
 input(d,'[data-area-choice="The Loop"]','any');assert.deepEqual(d.notebook().preferences.excludeAreas,['South Loop']);assert.equal(d.doc.querySelectorAll('#map-list [data-map-home]').length,2);
 click(d,'[data-surface="focus"]');assert.match(d.doc.querySelector('#focus-surface').textContent,/Synthetic/);assert.doesNotMatch(d.doc.querySelector('#focus-surface').textContent,/Synthetic south/);
 click(d,'[data-surface="list"]');click(d,'[data-evidence-group="leads"]');assert.equal(d.doc.querySelectorAll('#results .home-card').length,1);click(d,'#results [data-detail="lead"]');assert.match(d.doc.querySelector('#detail-home-evidence').textContent,/Private balcony/);d.doc.querySelector('#detail-dialog').close();
 click(d,'[data-evidence-group="matches"]');for(const id of ['first','second']){click(d,`#results [data-save="${id}"]`);click(d,`#results [data-compare="${id}"]`);}click(d,'#open-compare');assert.match(d.doc.querySelector('#compare-content').textContent,/850 sq ft/);assert.match(d.doc.querySelector('#compare-content').textContent,/Private balcony/);d.doc.querySelector('#compare-dialog').close();
 click(d,'#results [data-detail="first"]');d.doc.querySelector('#notes').value='Synthetic personal impression: check afternoon light.';d.doc.querySelector('#parkingCost').value='0';saveRecord(d);
 let notebook=d.notebook();assert.equal(notebook.records.first.parkingCost,0);assert.equal(notebook.records.first.quote_history?.length??0,0);d.close();
 d=await boot(homes,notebook);assert.equal(d.notebook().records.first.notes,'Synthetic personal impression: check afternoon light.');let exported;d.w.Blob=class{constructor(parts){exported=parts[0];}};click(d,'[data-view="setup"]');click(d,'#export-notebook');d.close();
 d=await boot(homes);await importText(d,exported);assert.deepEqual(d.notebook().preferences,notebook.preferences);assert.equal(d.notebook().records.first.parkingCost,0);assert.deepEqual(d.notebook().records.first.snapshot,notebook.records.first.snapshot);d.close();
});
test('undo persists and malformed imports fail atomically before notebook or UI preferences change',async()=>{
 let d=await boot([fixture()]);click(d,'#apply-downtown');const n=d.notebook();d.close();d=await boot([fixture()],n);click(d,'#undo-home-search');assert.equal(d.notebook().preferences.homeSearch,false);
 click(d,'#apply-downtown');const before=d.w.localStorage.getItem(KEY);const bad=clone(d.notebook());bad.preferences.includeAreas=['The Loop'];bad.manual=[replace(fixture('bad'),'sqft',-3)];await importText(d,JSON.stringify(bad));assert.equal(d.w.localStorage.getItem(KEY),before);assert.equal(d.doc.querySelector('[data-area-choice="River North"]').value,'include');d.close();
});
test('original snapshots and later evidence survive archive editing, reload, export/import and reappearance',async()=>{
 const original=fixture('saved');delete original.home_evidence;
 const notebook={...emptyWorkspace(),preferences:p,records:{saved:{saved:true,snapshot:clone(original),notes:'Keep original note',parkingCost:0,quote_history:[{rent:2200,date:null,date_basis:'unknown',recorded_at:'2026-09-19T12:00:00Z'}]}}};
 let d=await boot([fixture('saved')],notebook);click(d,'[data-view="shortlist"]');click(d,'[data-detail="saved"]');d.doc.querySelector('#notes').value='Later personal note';saveRecord(d);let kept=d.notebook();assert.deepEqual(kept.records.saved.snapshot,original);assert.equal(kept.records.saved.home_evidence_update.evidence.length,5);assert.equal(kept.records.saved.quote_history.length,1);d.close();
 d=await boot([],kept);click(d,'[data-view="shortlist"]');click(d,'[data-detail="saved"]');assert.match(d.doc.querySelector('#detail-home-evidence').textContent,/Saved research/);assert.match(d.doc.querySelector('#detail-home-evidence').textContent,/No home criteria evidence existed/);d.doc.querySelector('#notes').value='Archived personal note';saveRecord(d);const archived=d.notebook();assert.deepEqual(archived.records.saved.snapshot,original);assert.deepEqual(archived.records.saved.home_evidence_update,kept.records.saved.home_evidence_update);assert.equal(archived.records.saved.parkingCost,0);d.close();
 d=await boot([]);await importText(d,JSON.stringify(archived));assert.deepEqual(d.notebook().records.saved,archived.records.saved);d.close();
 d=await boot([fixture('saved')],archived);click(d,'[data-view="shortlist"]');click(d,'[data-detail="saved"]');assert.match(d.doc.querySelector('#detail-home-evidence').textContent,/Current research/);assert.equal(d.notebook().records.saved.notes,'Archived personal note');d.close();
});

test('address-wide restrictions stay verification even when asserted for the whole address; real floor/view need exact scope',()=>{
 assert.equal(criteriaReading(replace(fixture(),'eligibility','income_restricted',{scope:'address',applies:'all'}),{},p).status,'lead');
 const unit={...fixture(),unit_label:'X12',home_evidence:[...fixture().home_evidence,assertion('floor',25,{scope:'unit',subject:'X12'}),assertion('view','North-facing courtyard',{scope:'unit',subject:'X12'})]};
 assert.equal(attributeReading(unit,{},'floor').value,25);assert.equal(attributeReading(unit,{},'view').value,'North-facing courtyard');assert.equal(attributeReading({...unit,unit_label:'X13'}, {},'floor').value,null);
});
test('fresh saved search persists all criteria; research suggestions follow the same unranked group',async()=>{
 const homes=[fixture('match'),replace(fixture('lead'),'balcony',null)];const d=await boot(homes);click(d,'#apply-downtown');
 d.doc.querySelector('#search-name').value='Downtown editable';d.doc.querySelector('#save-search-form').dispatchEvent(new d.w.Event('submit',{cancelable:true}));
 assert.deepEqual(d.notebook().savedSearches[0].preferences,p);click(d,'#reset-home-search');click(d,'[data-search-load="0"]');assert.deepEqual(d.notebook().preferences,p);
 click(d,'[data-evidence-group="leads"]');click(d,'[data-open-studio]');assert.match(d.doc.querySelector('#view-content').textContent,/Synthetic lead/);assert.doesNotMatch(d.doc.querySelector('#view-content').textContent,/Synthetic match|Ranking weights|SpicyPicks/);d.close();
});
test('later observations append to separately saved history when an incoming feed omits an earlier observation',async()=>{
 const h=fixture('history');const snapshot={...h,home_evidence:[]};const old=assertion('view','Courtyard',{source:{name:'Old fixture',url:'https://example.invalid/old',observed_at:'2026-09-20'}});
 const notebook={...emptyWorkspace(),records:{history:{saved:true,snapshot,home_evidence_update:{evidence:[old],recorded_at:'2026-09-20T12:00:00Z'}}}};
 const d=await boot([h],notebook);click(d,'[data-view="shortlist"]');click(d,'[data-detail="history"]');saveRecord(d);assert(d.notebook().records.history.home_evidence_update.evidence.some(e=>e.source.observed_at==='2026-09-20'));assert.deepEqual(d.notebook().records.history.snapshot,snapshot);d.close();
});

test('zero-match state names missing evidence and requires an explicit single-criterion relaxation',async()=>{
 const d=await boot([replace(fixture('lead'),'balcony',null)]);click(d,'#apply-downtown');assert.equal(d.doc.querySelectorAll('#results .home-card').length,0);assert.match(d.doc.querySelector('.criteria-gaps').textContent,/Private balcony: 1 need confirmation/);assert.equal(d.notebook().preferences.privateBalcony,true);click(d,'[data-relax-home="privateBalcony"]');assert.equal(d.notebook().preferences.privateBalcony,false);assert.equal(d.notebook().preferences.inUnitLaundry,true);assert.equal(d.doc.querySelectorAll('#results .home-card').length,1);d.close();
});

test('correction A: repeated save of an incoming subset keeps the first effective research recording time',async()=>{
 const h=fixture('history'),snapshot={...h,home_evidence:[]};
 const old=assertion('view','Courtyard',{source:{name:'Old fixture',url:'https://example.invalid/old',observed_at:'2026-09-20'}});
 const notebook={...emptyWorkspace(),records:{history:{saved:true,snapshot,home_evidence_update:{evidence:[old],recorded_at:'2026-09-20T12:00:00Z'}}}};
 const d=await boot([h],notebook,'2026-09-22T12:00:00Z');
 try {
   click(d,'[data-view="shortlist"]');click(d,'[data-detail="history"]');saveRecord(d);
   const first=d.notebook().records.history;
   assert.deepEqual(first.home_evidence_update.evidence,[old,...h.home_evidence]);
   assert.equal(first.home_evidence_update.recorded_at,'2026-09-22T12:00:00.000Z');
   d.setNow('2026-09-23T12:00:00Z');
   click(d,'[data-detail="history"]');saveRecord(d);
   assert.deepEqual(d.notebook().records.history.home_evidence_update,first.home_evidence_update);
   assert.deepEqual(d.notebook().records.history.snapshot,snapshot);
 } finally {d.close();}
});

const heightAssertion=(value,day='2026-09-20',extra={})=>assertion('height',value,{
 scope:'building',subject:'Synthetic building',applies:'all',
 source:{name:'Synthetic height source',url:'https://example.invalid/height',observed_at:day},...extra
});
for(const status of ['unknown','conflicting'])test(`correction B: newer same-source ${status} supersedes historical height`,()=>{
 const h=fixture('height',{home_evidence:[heightAssertion('20-story building'),heightAssertion(null,'2026-09-22',{status})]});
 assert.equal(attributeReading(h,{},'height').status,status);
 assert.equal(buildingForm(h).status,'unknown');
 assert.equal(criteriaReading(h,{}, {...defaults,requireHighRise:true}).status,'lead');
 assert.equal(h.home_evidence.length,2,'Both historical assertions stay retained');
});

test('correction A: notes, stage, finalist and save actions preserve effective history through subsets, reorder, archive and reappearance',async()=>{
 const h=fixture('stable'),snapshot={...h,home_evidence:[]};
 const old=assertion('view','Courtyard',{source:{name:'Old fixture',url:'https://example.invalid/old',observed_at:'2026-09-20'}});
 const retained={evidence:[old,...h.home_evidence],recorded_at:'2026-09-22T12:00:00Z'};
 const scan={basis:'curated_research',city:'Chicago',saved_at:'2026-09-07T12:00:00Z',observed_at:'2026-09-07',feed_generated_at:'2026-09-07T10:00:00Z'};
 const eligibilityUpdate={evidence:eligibility('address'),recorded_at:'2026-09-20T12:00:00Z'};
 const quotes=[{rent:2200,date:'2026-09-19',date_basis:'entered',recorded_at:'2026-09-19T12:00:00Z'}];
 let notebook={...emptyWorkspace(),records:{stable:{saved:true,snapshot,scan,parkingCost:0,utilities:0,
   rentOverride:2200,quoteDate:'2026-09-19',quote_history:quotes,eligibility_update:eligibilityUpdate,home_evidence_update:retained}}};
 validateWorkspace(notebook);
 const unchanged=d=>{
   const r=d.notebook().records.stable;
   for(const [key,value] of Object.entries({snapshot,scan,parkingCost:0,utilities:0,rentOverride:2200,
     quoteDate:'2026-09-19',quote_history:quotes,eligibility_update:eligibilityUpdate,home_evidence_update:retained}))
     assert.deepEqual(r[key],value,key);
 };
 const variants=[h,{...h,home_evidence:[...h.home_evidence].reverse()},
   {...h,home_evidence:h.home_evidence.slice(2,3)},{...h,home_evidence:[]},null,h];
 for(const [index,current] of variants.entries()) {
   const d=await boot(current?[current]:[],notebook,`2026-09-${23+index}T12:00:00Z`);
   try {
     click(d,'[data-view="shortlist"]');click(d,'[data-detail="stable"]');
     d.doc.querySelector('#notes').value=`Personal note ${index}`;saveRecord(d);unchanged(d);
     input(d,'[data-stage="stable"]','researching');unchanged(d);
     click(d,'[data-finalist="stable"]');unchanged(d);
     click(d,'[data-finalist="stable"]');unchanged(d);
     if(current) {
       click(d,'[data-view="discover"]');
       click(d,'#results [data-save="stable"]');unchanged(d);
       click(d,'#results [data-save="stable"]');unchanged(d);
     }
     notebook=d.notebook();assert.equal(notebook.records.stable.notes,`Personal note ${index}`);
   } finally {d.close();}
 }
 // A genuinely new assertion is appended once after reappearance. A later
 // stage/notes save cannot manufacture a second research observation or quote.
 const fresh=assertion('floor',24,{scope:'unit',subject:'X24',source:{name:'New fixture',url:'https://example.invalid/new',observed_at:'2026-09-29'}});
 const d=await boot([{...h,home_evidence:[...h.home_evidence,fresh]}],notebook,'2026-09-29T12:00:00Z');
 try {
   click(d,'[data-view="shortlist"]');click(d,'[data-detail="stable"]');saveRecord(d);
   const once=d.notebook().records.stable;
   assert.deepEqual(once.home_evidence_update,{evidence:[...retained.evidence,fresh],recorded_at:'2026-09-29T12:00:00.000Z'});
   d.setNow('2026-09-30T12:00:00Z');input(d,'[data-stage="stable"]','shortlisted');
   click(d,'[data-detail="stable"]');saveRecord(d);
   assert.deepEqual(d.notebook().records.stable.home_evidence_update,once.home_evidence_update);
   assert.deepEqual(d.notebook().records.stable.snapshot,snapshot);
   assert.deepEqual(d.notebook().records.stable.scan,scan);
   assert.deepEqual(d.notebook().records.stable.quote_history,quotes);
   assert.deepEqual(d.notebook().records.stable.eligibility_update,eligibilityUpdate);
 } finally {d.close();}
});

test('correction A: an empty incoming ledger does not create a dated empty update',async()=>{
 const snapshot=fixture('empty',{home_evidence:undefined});
 const d=await boot([{...snapshot,home_evidence:[]}],{...emptyWorkspace(),records:{empty:{saved:true,snapshot}}},'2026-09-22T12:00:00Z');
 try {
   click(d,'[data-view="shortlist"]');click(d,'[data-detail="empty"]');saveRecord(d);
   assert.equal(d.notebook().records.empty.home_evidence_update,undefined);
 } finally {d.close();}
});

test('correction B: latest same-source corrections replace the reading without removing history or depending on array order',()=>{
 const old=heightAssertion('20-story building');
 for(const value of ['8-story building','30-story building']) {
   const correction=heightAssertion(value,'2026-09-22',{applies:'general'});
   for(const evidence of [[old,correction],[correction,old]]) {
     const h=fixture('corrected',{home_evidence:evidence}),before=clone(h);
     assert.equal(attributeReading(h,{},'height').value,value);
     assert.equal(buildingForm(h).status,value.startsWith('8')?'low_mid_rise':'high_rise');
     assert.equal(buildingForm(h).observed_at,'2026-09-22');
     assert.equal(criteriaReading(h,{}, {...defaults,requireHighRise:true}).status,value.startsWith('8')?'excluded':'match');
     assert.equal(attributeReading(h,{},'floor').status,'unknown');
     assert.equal(attributeReading(h,{},'view').status,'unknown');
     assert.deepEqual(h,before);
   }
 }
});

test('correction B: independent current disagreements remain unresolved, including two different high-rise counts',()=>{
 for(const value of ['8-story building','30-story building',null]) {
   const other=heightAssertion(value,'2026-09-22',{status:value===null?'conflicting':'reported',
     source:{name:'Independent source',url:'https://example.invalid/other-height',observed_at:'2026-09-22'}});
   const h=fixture('conflict',{home_evidence:[heightAssertion('20-story building'),other]});
   assert.equal(attributeReading(h,{},'height').status,'conflicting');
   assert.equal(buildingForm(h).status,'unknown');
   assert.equal(criteriaReading(h,{}, {...defaults,requireHighRise:true}).status,'lead');
 }
 const unknown=heightAssertion(null,'2026-09-22');
 const independent=heightAssertion('8-story building','2026-09-22',{source:{...unknown.source,url:'https://example.invalid/independent'}});
 const h=fixture('independent',{home_evidence:[heightAssertion('20-story building'),unknown,independent]});
 assert.equal(buildingForm(h).status,'low_mid_rise','An independent current source may support a reading; the superseded 20-story claim may not');
});

test('correction B: scope and subject identity bound supersession; plan/unit claims never establish building height',()=>{
 const old=heightAssertion('20-story building');
 for(const patch of [{scope:'unit',subject:'P1',applies:'exact'},{scope:'plan',subject:'P1',applies:'exact'},
   {scope:'building',subject:'Other building'}]) {
   const h=fixture('scope',{home_evidence:[old,heightAssertion(null,'2026-09-22',patch)]});
   assert.equal(buildingForm(h).status,'high_rise');
 }
 for(const patch of [{scope:'unit',subject:'P1',applies:'exact'},{scope:'plan',subject:'P1',applies:'exact'},{applies:'selected'}]) {
   const h=fixture('unqualified',{home_evidence:[heightAssertion('20-story building','2026-09-22',patch)]});
   assert.equal(buildingForm(h).status,'unknown');assert.equal(attributeReading(h,{},'height').status,'unknown');
 }
});

test('correction B: applicable corrections supersede older same-source legacy text, preserving independent and uncorrected legacy evidence',()=>{
 const legacy=fixture('legacy',{home_evidence:[],source_url:'https://example.invalid/height',atmosphere:'20-story building',
   amenities:['High-rise building'],sources:[{url:'https://example.invalid/height',supports:'20-story building',observed_at:'2026-09-20'}]});
 assert.equal(buildingForm(legacy).status,'high_rise');
 for(const status of ['unknown','conflicting']) {
   const h={...legacy,home_evidence:[heightAssertion(null,'2026-09-22',{status})]};
   assert.equal(buildingForm(h).status,'unknown');
 }
 const corrected={...legacy,home_evidence:[heightAssertion('8-story building','2026-09-22')]};
 assert.equal(buildingForm(corrected).status,'low_mid_rise');
 assert.equal(buildingForm({...legacy,home_evidence:[heightAssertion(null,'2026-09-22',{scope:'plan',subject:'P1'})]}).status,'high_rise');
 assert.equal(buildingForm({...legacy,home_evidence:[heightAssertion(null,'2026-09-22')],
   sources:[{url:'https://example.invalid/independent',supports:'20-story building',observed_at:'2026-09-21'}]}).status,'high_rise');
 assert.equal(buildingForm({...legacy,home_evidence:[heightAssertion(null,'2026-09-22')],
   sources:[{url:'https://example.invalid/height',supports:'20-story building',observed_at:'2026-09-23'}]}).status,'high_rise');
});

for(const status of ['unknown','conflicting'])test(`correction B: cards, dossier, comparison and archived controls agree on ${status} height`,async()=>{
 const old=heightAssertion('20-story building'),correction=heightAssertion(null,'2026-09-22',{status});
 const original=fixture('changed',{home_evidence:[...fixture().home_evidence.filter(e=>e.attribute!=='height'),old]});
 const current={...original,home_evidence:[...original.home_evidence,correction]},other=fixture('other');
 let notebook={...emptyWorkspace(),preferences:p,records:{changed:{saved:true,snapshot:original},other:{saved:true,snapshot:other}}};
 assert.equal(buildingForm(original).status,'high_rise');
 for(const homes of [[current,other],[other],[current,other]]) {
   const archived=homes.length===1,d=await boot(homes,notebook,'2026-09-23T12:00:00Z');
   try {
     if(!archived) {
       click(d,'[data-evidence-group="matches"]');
       assert(!d.doc.querySelector('#results [data-home="changed"]'),'Not a supported match');
       click(d,'[data-evidence-group="leads"]');
       const card=d.doc.querySelector('#results [data-home="changed"]');assert(card);
       assert.match(card.querySelector('.home-evidence-summary').textContent,/Height not recorded/);
       assert.doesNotMatch(card.textContent,/High-rise recorded/);
     }
     click(d,'[data-view="shortlist"]');click(d,'[data-detail="changed"]');
     assert.match(d.doc.querySelector('.detail-form').textContent,/Height not recorded/);
     assert.match(d.doc.querySelector('.original-home-evidence').textContent,/20-story building/);
     assert.match(d.doc.querySelector('#detail-home-evidence').textContent,new RegExp('height · '+status));
     d.doc.querySelector('#notes').value=archived?'Archived correction note':'Live correction note';saveRecord(d);
     for(const id of ['changed','other'])click(d,`[data-compare="${id}"]`);
     click(d,'#open-compare');
     const label=[...d.doc.querySelectorAll('.sc-compare-pair__measure')].find(el=>el.textContent.startsWith('Building form on record'));
     assert.deepEqual([...label.nextElementSibling.querySelectorAll('.sc-figure')].map(el=>el.textContent),['Height not recorded','High-rise recorded']);
     notebook=d.notebook();assert.deepEqual(notebook.records.changed.snapshot,original);
     assert.deepEqual(notebook.records.changed.home_evidence_update.evidence,current.home_evidence);
     const context=archived?{...original,notebook_only:true}:current;
     assert.equal(attributeReading(context,notebook.records.changed,'height').status,status);
     assert.equal(buildingForm({...context,home_evidence:homeEvidenceReading(context,notebook.records.changed).evidence}).status,'unknown');
   } finally {d.close();}
 }
});

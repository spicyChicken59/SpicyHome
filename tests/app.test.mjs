import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { JSDOM } from "jsdom";
const html = fs.readFileSync(
  new URL("../dist/index.html", import.meta.url),
  "utf8",
);
const model = fs
  .readFileSync(new URL("../dist/model.js", import.meta.url), "utf8")
  .replace(/^export\s+/gm, "");
const app = fs
  .readFileSync(new URL("../dist/app.js", import.meta.url), "utf8")
  .replace(/^import\s*\{[\s\S]*?\}\s*from\s*["']\.\/model\.js(?:\?[^"']*)?["'];?\s*/, "");
const seed = JSON.parse(
  fs.readFileSync(new URL("../data/seed.json", import.meta.url), "utf8"),
);
async function boot({
  remote = seed,
  cache = null,
  notebook = null,
  storageFails = false,
  mirror = undefined,
  packaged = seed,
  configuration = undefined,
  attempt = undefined,
} = {}) {
  const d = new JSDOM(html, {
      url: "https://spicyhome.test/",
      runScripts: "outside-only",
    }),
    w = d.window;
  w.HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  w.HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
  w.matchMedia = () => ({ matches: false });
  w.confirm = () => true;
  w.URL.createObjectURL = () => "blob:test";
  w.URL.revokeObjectURL = () => {};
  if (cache) w.localStorage.setItem("spicyhome.feed.v1", JSON.stringify(cache));
  if (notebook)
    w.localStorage.setItem("spicyhome.workspace.v1", JSON.stringify(notebook));
  if (storageFails)
    w.Storage.prototype.setItem = function () {
      throw Error("QuotaExceeded");
    };
  const requests = [];
  w.fetch = async (url, options) => {
    requests.push({ url, options });
    let path = url.split("?")[0];
    if (path === "https://raw.githubusercontent.com/spicyChicken59/SpicyHome/main/dist/data.json") path = "remote";
    if (path === "https://api.github.com/repos/spicyChicken59/SpicyHome/contents/dist/data.json") path = "mirror";
    if (path === "./config.json" && configuration === null) throw Error("configuration unavailable");
    if (path === "remote" && remote === null) throw Error("offline");
    if (path === "mirror" && mirror === null) throw Error("mirror offline");
    if (path === "./data.json" && packaged === null) throw Error("bundle unavailable");
    const data =
      path === "./config.json"
        ? configuration ?? { feed_url: "remote", fallback_url: "./data.json", ...(mirror !== undefined ? { feed_mirror_url: "mirror" } : {}) }
        : path === "status"
          ? attempt
        : path === "remote"
          ? remote
          : path === "mirror"
            ? mirror
            : packaged;
    return { ok: true, text: async () => JSON.stringify(data) };
  };
  w.eval(model + "\n" + app);
  for (let i = 0; i < 30 && !w.document.querySelector(".home-card"); i++)
    await new Promise((r) => setTimeout(r, 3));
  return { w, doc: w.document, requests, close: () => w.close() };
}

function connectedSnapshot(at = "2026-09-08T00:00:00Z") {
  return { ...seed, mode: "connected", generated_at: at,
    provider: { configured: true, last_success: at, coverage: "Test connected snapshot", status: "success" } };
}
test("failed configuration still loads the connected bundle instead of trapping old research", async () => {
  const live = connectedSnapshot();
  const d = await boot({ configuration: null, remote: null, mirror: null, packaged: live, cache: seed });
  assert.equal(JSON.parse(d.w.localStorage.getItem("spicyhome.feed.v1")).mode, "connected");
  assert.match(d.doc.querySelector("#notice").textContent, /snapshot included with this site/);
  d.doc.querySelector("#refresh").click();
  for (let i = 0; i < 30 && d.doc.querySelector("#refresh").textContent === "Checking…"; i++) await new Promise(r => setTimeout(r, 3));
  assert.equal(d.requests.filter(r => r.url.startsWith("./data.json?")).length, 2);
  assert.equal(JSON.parse(d.w.localStorage.getItem("spicyhome.feed.v1")).mode, "connected");
  d.close();
});
test("invalid configuration still permits a live public source without browser cache", async () => {
  const d = await boot({ configuration: {feed_url: "javascript:bad", fallback_url: "./data.json"}, remote: connectedSnapshot() });
  assert.equal(JSON.parse(d.w.localStorage.getItem("spicyhome.feed.v1")).mode, "connected");
  assert(!d.requests.some(r => r.url.startsWith("javascript:")));
  d.close();
});
for (const preferences of [{parking:true}, {charging:true}, {neighborhood:"River North"}]) {
  test(`saved ${Object.keys(preferences)[0]} filter explains hidden listings and recovers without losing notes`, async () => {
    const live = connectedSnapshot();
    const listing = {...seed.homes[0], id:"test-unverified-listing", kind:"listing", rent:1800,
      neighborhood:"Downtown search area", parking:{status:"unknown"}, charging:{status:"unknown"}};
    live.homes = [...seed.homes, listing];
    const notebook = {version:1,records:{[seed.homes[0].id]:{saved:true,notes:"Keep my tour notes",snapshot:seed.homes[0]}},manual:[],events:[],preferences:{...preferences,utilityEstimate:80}};
    const d = await boot({remote:live,packaged:live,notebook});
    assert(d.doc.querySelector("#result-count").textContent.includes(`of ${seed.homes.length+1} loaded places`));
    assert.match(d.doc.querySelector("#filter-summary").textContent, /1 listing snapshots loaded · 1 hidden/);
    assert.equal(d.doc.querySelector('[data-home="test-unverified-listing"]'),null);
    d.doc.querySelector("#show-unfiltered").click();
    assert(d.doc.querySelector('[data-home="test-unverified-listing"]'));
    assert.equal(d.doc.querySelector("#filter-summary").hidden,true);
    const saved=JSON.parse(d.w.localStorage.getItem("spicyhome.workspace.v1"));
    assert.equal(saved.records[seed.homes[0].id].notes,"Keep my tour notes");
    assert.equal(saved.records[seed.homes[0].id].saved,true);
    assert.equal(saved.preferences.utilityEstimate,80);
    assert.equal(d.doc.activeElement.id,"reset-filters");
    d.close();
  });
}
test("fresh direct visit can load the mirror without an existing browser cache", async () => {
  const d = await boot({ remote: null, mirror: connectedSnapshot() });
  assert.equal(JSON.parse(d.w.localStorage.getItem("spicyhome.feed.v1")).mode, "connected");
  assert.match(d.doc.querySelector("#notice").textContent, /Latest successful listing scan/);
  assert.doesNotMatch(d.doc.querySelector("#notice").textContent, /Live update unavailable|Connect the daily feed/);
  const request = d.requests.find(r => r.url.startsWith("mirror?"));
  assert.equal(request.options.headers.Accept, "application/vnd.github.raw+json");
  assert.match(request.url, /_spicyhome=/);
  d.close();
});
test("a direct visit uses the included connected snapshot when both public hosts fail", async () => {
  const d = await boot({ remote: null, mirror: null, packaged: connectedSnapshot() });
  assert.equal(JSON.parse(d.w.localStorage.getItem("spicyhome.feed.v1")).mode, "connected");
  assert.match(d.doc.querySelector("#notice").textContent, /snapshot included with this site/);
  assert.doesNotMatch(d.doc.querySelector("#notice").textContent, /Connect the daily feed/);
  d.close();
});
test("a stale successful response cannot replace a newer connected browser snapshot", async () => {
  const newer = connectedSnapshot("2026-09-09T00:00:00Z");
  const d = await boot({ remote: connectedSnapshot(), cache: newer });
  assert.equal(JSON.parse(d.w.localStorage.getItem("spicyhome.feed.v1")).provider.last_success, newer.provider.last_success);
  assert.match(d.doc.querySelector("#notice").textContent, /source returned older data/);
  d.close();
});
test("an old research response does not hide the newer packaged listings", async () => {
  const d = await boot({ remote: seed, packaged: connectedSnapshot() });
  assert.equal(JSON.parse(d.w.localStorage.getItem("spicyhome.feed.v1")).mode, "connected");
  d.close();
});
test("a stale connected response on a fresh visit is compared with the newer bundle", async () => {
  const newer = connectedSnapshot("2026-09-09T00:00:00Z");
  const d = await boot({ remote: connectedSnapshot(), packaged: newer });
  assert.equal(JSON.parse(d.w.localStorage.getItem("spicyhome.feed.v1")).provider.last_success, newer.provider.last_success);
  assert.match(d.doc.querySelector("#notice").textContent, /newer snapshot included with this site/);
  d.close();
});
test("an older primary triggers the mirror and can discover an even newer snapshot", async () => {
  const newest = connectedSnapshot("2026-09-10T00:00:00Z");
  const d = await boot({ remote: connectedSnapshot(), packaged: connectedSnapshot("2026-09-09T00:00:00Z"), mirror: newest });
  assert.equal(JSON.parse(d.w.localStorage.getItem("spicyhome.feed.v1")).provider.last_success, newest.provider.last_success);
  assert(d.requests.some(r => r.url.startsWith("mirror?")));
  assert.doesNotMatch(d.doc.querySelector("#notice").textContent, /older data|unavailable/);
  d.close();
});
test("a missing bundle never discards valid published research", async () => {
  const d = await boot({ remote: seed, packaged: null });
  assert.equal(d.doc.querySelectorAll(".home-card").length, seed.homes.length - 1);
  assert.doesNotMatch(d.doc.querySelector("#notice").textContent, /could not load/);
  d.close();
});
for (const source of ["cache", "packaged"]) {
  test(`a matching mirror confirms the ${source} snapshot as current`, async () => {
    const newest = connectedSnapshot("2026-09-09T00:00:00Z");
    const d = await boot({ remote: connectedSnapshot(), [source]: newest, mirror: newest });
    assert.doesNotMatch(d.doc.querySelector("#notice").textContent, /older data|unavailable/);
    d.doc.querySelector("#refresh").click();
    for (let i = 0; i < 30 && d.doc.querySelector("#refresh").textContent === "Checking…"; i++) await new Promise(r => setTimeout(r, 3));
    assert.match(d.doc.querySelector("#toast").textContent, /Latest published snapshot checked/);
    assert.equal(JSON.parse(d.w.localStorage.getItem("spicyhome.feed.v1")).provider.last_success, newest.provider.last_success);
    d.close();
  });
}
test("research retained during an outage is never called a connected snapshot", async () => {
  const d = await boot({ remote: null, mirror: null, packaged: null, cache: seed });
  assert.match(d.doc.querySelector("#notice").textContent, /last complete snapshot/);
  assert.doesNotMatch(d.doc.querySelector("#notice").textContent, /complete connected snapshot/);
  d.close();
});
test("manual refresh reloads configuration and sends uncached snapshot requests", async () => {
  const d = await boot({ remote: connectedSnapshot() });
  d.doc.querySelector("#refresh").click();
  for (let i = 0; i < 30 && d.doc.querySelector("#refresh").textContent === "Checking…"; i++) await new Promise(r => setTimeout(r, 3));
  assert.equal(d.requests.filter(r => r.url.startsWith("./config.json?")).length, 2);
  const reads = d.requests.filter(r => r.url.startsWith("remote?"));
  assert.equal(reads.length, 2);
  assert(reads.every(r => /_spicyhome=/.test(r.url) && r.options.cache === "no-store"));
  assert.match(d.doc.querySelector("#toast").textContent, /Latest published snapshot checked/);
  d.close();
});
test("working surface renders real prospects and usable map fallback", async () => {
  const d = await boot();
  assert.equal(d.doc.querySelectorAll(".home-card").length, seed.homes.length - 1);
  assert.match(d.doc.querySelector("#map").textContent, /could not load/);
  d.doc.querySelector("[data-map-home]").click();
  assert(d.doc.querySelector("#detail-dialog").open);
  d.close();
});
test("save retains a home snapshot and survives a later missing source", async () => {
  const d = await boot();
  d.doc.querySelector("[data-save]").click();
  const saved = JSON.parse(d.w.localStorage.getItem("spicyhome.workspace.v1"));
  const id = Object.keys(saved.records)[0];
  assert(saved.records[id].snapshot);
  assert(saved.records[id].saved);
  d.close();
  const newer = { ...seed, homes: seed.homes.filter((h) => h.id !== id) };
  const next = await boot({ remote: newer, notebook: saved });
  assert.equal(next.doc.querySelector(`#results [data-home="${id}"]`), null);
  next.doc.querySelector('[data-view="shortlist"]').click();
  assert.equal(next.doc.querySelectorAll(".home-card").length, 1);
  assert.match(next.doc.querySelector(".home-card").textContent, /Archived notebook entry/);
  next.close();
});
test("failed startup refresh retains newer connected cache", async () => {
  const connected = {
    ...seed,
    mode: "connected",
    generated_at: "2026-09-08T00:00:00Z",
    provider: {
      configured: true,
      last_success: "2026-09-08T00:00:00Z",
      coverage: "Test connected snapshot",
      status: "success",
    },
  };
  const d = await boot({ remote: null, cache: connected });
  assert.match(
    d.doc.querySelector("#notice").textContent,
    /retaining your last complete snapshot/,
  );
  assert.equal(
    JSON.parse(d.w.localStorage.getItem("spicyhome.feed.v1")).mode,
    "connected",
  );
  d.close();
});
test("failed persistence leaves a visible export warning and no false saved toast", async () => {
  const d = await boot({ storageFails: true });
  d.doc.querySelector("[data-save]").click();
  assert.match(
    d.doc.querySelector("#storage-warning").textContent,
    /only in memory/,
  );
  assert(d.doc.querySelector("#export-unsaved"));
  assert.match(d.doc.querySelector("#toast").textContent, /memory only/);
  d.close();
});
test("notes and zero-dollar quotes are persisted through the actual form", async () => {
  const d = await boot();
  const opener = d.doc.querySelector("[data-detail]");
  const homeId = opener.dataset.detail;
  opener.focus();
  opener.click();
  d.doc.querySelector("#notes").value = "Quiet bedroom; confirm J1772 access.";
  d.doc.querySelector("#utilities").value = "0";
  d.doc.querySelector("#rentOverride").value = "2490";
  d.doc
    .querySelector("#record-form")
    .dispatchEvent(
      new d.w.Event("submit", { bubbles: true, cancelable: true }),
    );
  const w = JSON.parse(d.w.localStorage.getItem("spicyhome.workspace.v1"));
  const r = Object.values(w.records)[0];
  assert.equal(r.utilities, 0);
  assert.equal(r.rentOverride, 2490);
  assert.equal(r.quote_history.length, 1);
  assert.match(r.notes, /Quiet bedroom/);
  assert(!d.doc.querySelector("#detail-dialog").open);
  assert.equal(d.doc.activeElement.dataset.detail, homeId);
  d.close();
});
test("save preserves keyboard position and removing the last saved home focuses its view", async () => {
  const d = await boot();
  const save = d.doc.querySelector("[data-save]");
  const homeId = save.dataset.save;
  save.focus();
  save.click();
  assert.equal(d.doc.activeElement.dataset.save, homeId);
  assert.equal(d.doc.activeElement.getAttribute("aria-pressed"), "true");
  d.doc.querySelector('[data-view="shortlist"]').click();
  const remove = d.doc.querySelector("[data-save]");
  remove.focus();
  remove.click();
  assert.equal(d.doc.querySelectorAll(".home-card").length, 0);
  assert.equal(d.doc.activeElement.id, "view-title");
  d.close();
});
test("search followed immediately by navigation is safe and keeps the query", async () => {
  const d = await boot();
  const errors = [];
  d.w.addEventListener("error", (e) => errors.push(e.message));
  const search = d.doc.querySelector("#search");
  search.value = "Loop";
  search.dispatchEvent(new d.w.Event("input", { bubbles: true }));
  d.doc.querySelector('[data-view="shortlist"]').click();
  await new Promise((resolve) => setTimeout(resolve, 250));
  assert.deepEqual(errors, []);
  assert.equal(d.doc.querySelector('[aria-current="page"]').dataset.view, "shortlist");
  d.doc.querySelector('[data-view="discover"]').click();
  assert.equal(d.doc.querySelector("#search").value, "Loop");
  assert.equal(JSON.parse(d.w.localStorage.getItem("spicyhome.workspace.v1")).preferences.search, "Loop");
  d.close();
});
test("manual entry, shortlist and comparison preserve explicit no charging", async () => {
  const d = await boot();
  d.doc.querySelector("#add-home").click();
  assert.equal(d.doc.querySelector("#add-bedrooms").value, "");
  assert.equal(d.doc.querySelector("#add-bathrooms").value, "");
  for (const [k, v] of Object.entries({
    title: "Test home",
    address: "100 Test St, Chicago",
    neighborhood: "Loop",
    rent: "1800",
  }))
    d.doc.querySelector("#add-" + k).value = v;
  d.doc.querySelector("#add-charging").value = "no";
  d.doc
    .querySelector("#add-form")
    .dispatchEvent(
      new d.w.Event("submit", { bubbles: true, cancelable: true }),
    );
  assert.match(d.doc.querySelector("#view-title").textContent, /second look/);
  const stored=JSON.parse(d.w.localStorage.getItem("spicyhome.workspace.v1"));
  assert.equal(stored.manual[0].bedrooms,null);
  assert.equal(stored.manual[0].bathrooms,null);
  assert.match(d.doc.querySelector(".home-card").textContent,/Layout needs checking/);
  const box = d.doc.querySelector("[data-compare]");
  box.checked = true;
  box.dispatchEvent(new d.w.Event("change"));
  d.doc.querySelector("#open-compare").click();
  assert.match(
    d.doc.querySelector("#compare-content").textContent,
    /Not offered/,
  );
  d.close();
});
test("a studio correction hides the candidate after refresh but keeps its notebook", async () => {
  const d=await boot();
  const id=d.doc.querySelector('[data-detail]').getAttribute('data-detail');
  d.doc.querySelector('[data-detail]').click();
  d.doc.querySelector('#layoutReview').value='studio';
  d.doc.querySelector('#notes').value='Open sleeping area, no bedroom door';
  d.doc.querySelector('#record-form').dispatchEvent(new d.w.Event('submit',{bubbles:true,cancelable:true}));
  assert.equal(d.doc.querySelector(`#results [data-home="${id}"]`),null);
  d.doc.querySelector('#refresh').click();
  for(let i=0;i<30&&d.doc.querySelector('#refresh').textContent==='Checking…';i++)await new Promise(r=>setTimeout(r,3));
  assert.equal(d.doc.querySelector(`#results [data-home="${id}"]`),null);
  d.doc.querySelector('[data-view="shortlist"]').click();
  assert.match(d.doc.querySelector(`[data-home="${id}"]`).textContent,/studio \/ convertible/);
  const stored=JSON.parse(d.w.localStorage.getItem('spicyhome.workspace.v1'));
  assert.equal(stored.records[id].notes,'Open sleeping area, no bedroom door');
  d.close();
});
test("checked-layout filter responds to an explicit floor-plan check", async () => {
  const d=await boot();
  d.doc.querySelector('[data-detail]').click();
  d.doc.querySelector('#layoutReview').value='one_bed';
  d.doc.querySelector('#record-form').dispatchEvent(new d.w.Event('submit',{bubbles:true,cancelable:true}));
  const select=d.doc.querySelector('#layout-scope');select.value='confirmed';select.dispatchEvent(new d.w.Event('change'));
  assert.equal(d.doc.querySelectorAll('.home-card').length,1);
  assert.match(d.doc.querySelector('.home-card').textContent,/checked by you/);
  d.close();
});

test("excluded layouts stay reviewable after unshortlisting and can be corrected", async () => {
  const d = await boot();
  const id = d.doc.querySelector("[data-detail]").dataset.detail;
  d.doc.querySelector("[data-detail]").click();
  assert(d.doc.querySelector(".layout-review").compareDocumentPosition(d.doc.querySelector(".detail-grid")) & 4);
  assert.equal(d.doc.querySelector("#layoutReview").form.id, "record-form");
  d.doc.querySelector("#layoutReview").value = "studio";
  d.doc.querySelector("#notes").value = "Keep this correction accessible";
  d.doc.querySelector('.layout-review button[type="submit"]').click();
  assert.equal(d.doc.querySelector(`#results [data-home="${id}"]`), null);
  assert(d.doc.querySelector(`#excluded-results [data-home="${id}"]`));
  assert.equal(d.doc.querySelector("#excluded-layouts").open, true);
  assert.equal(d.doc.activeElement.dataset.detail, id);
  d.doc.querySelector('[data-view="shortlist"]').click();
  d.doc.querySelector(`[data-save="${id}"]`).click();
  d.doc.querySelector('[data-view="discover"]').click();
  d.doc.querySelector(`#excluded-results [data-detail="${id}"]`).click();
  d.doc.querySelector("#layoutReview").value = "one_bed";
  d.doc.querySelector('.layout-review button[type="submit"]').click();
  assert(d.doc.querySelector(`#results [data-home="${id}"]`));
  assert.equal(JSON.parse(d.w.localStorage.getItem("spicyhome.workspace.v1")).records[id].notes, "Keep this correction accessible");
  d.close();
});
test("checked layouts hidden by other filters get a scoped recovery action", async () => {
  const d = await boot();
  d.doc.querySelector("[data-detail]").click();
  d.doc.querySelector("#layoutReview").value = "one_bed";
  d.doc.querySelector('.layout-review button[type="submit"]').click();
  const scope = d.doc.querySelector("#layout-scope");
  scope.value = "confirmed"; scope.dispatchEvent(new d.w.Event("change"));
  const search = d.doc.querySelector("#search");
  search.value = "no matching apartment"; search.dispatchEvent(new d.w.Event("change", {bubbles:true}));
  assert.match(d.doc.querySelector("#results").textContent, /1 checked layout is hidden/);
  assert.doesNotMatch(d.doc.querySelector("#results").textContent, /No layouts checked yet/);
  d.doc.querySelector("#reset-other-filters").click();
  assert.equal(d.doc.querySelector("#layout-scope").value, "confirmed");
  assert.equal(d.doc.querySelectorAll("#results .home-card").length, 1);
  d.close();
});
test("budget labels follow the active basis without moving focus", async () => {
  const d = await boot();
  const basis = d.doc.querySelector("#basis"); basis.focus();
  basis.value = "total"; basis.dispatchEvent(new d.w.Event("change", {bubbles:true}));
  assert.match(d.doc.querySelector('#sort option[value="rent"]').textContent, /Known subtotal/);
  assert.match(d.doc.querySelector("#budget-note").textContent, /Budget is a known subtotal/);
  assert.equal(d.doc.activeElement, basis);
  d.close();
});
test("overlong search cannot make notes and studio corrections unloadable", async () => {
  const h = seed.homes[0];
  const notebook = {version:1,records:{[h.id]:{saved:true,snapshot:h,notes:"Keep me",layoutReview:"studio"}},manual:[],events:[],preferences:{}};
  const d = await boot({notebook});
  const search = d.doc.querySelector("#search");
  search.value = "x".repeat(501); search.dispatchEvent(new d.w.Event("input", {bubbles:true}));
  const saved = JSON.parse(d.w.localStorage.getItem("spicyhome.workspace.v1"));
  assert.equal(saved.preferences.search.length,500);
  d.close();
  const next = await boot({notebook:saved});
  next.doc.querySelector("#reset-filters").click();
  const retained = JSON.parse(next.w.localStorage.getItem("spicyhome.workspace.v1"));
  assert.equal(retained.records[h.id].notes,"Keep me");
  assert.equal(retained.records[h.id].layoutReview,"studio");
  next.close();
});
test("a stale tab cannot overwrite a newer notebook and can load the saved copy", async () => {
  const d = await boot();
  const h = seed.homes[0];
  const updated = {version:1,records:{[h.id]:{saved:true,snapshot:h,notes:"Saved in another tab",layoutReview:"studio"}},manual:[],events:[],preferences:{}};
  const raw = JSON.stringify(updated);
  d.w.localStorage.setItem("spicyhome.workspace.v1",raw);
  const sort = d.doc.querySelector("#sort"); sort.value="space"; sort.dispatchEvent(new d.w.Event("change"));
  assert.equal(d.w.localStorage.getItem("spicyhome.workspace.v1"),raw);
  assert(d.doc.querySelector("#export-unsaved"));
  d.doc.querySelector("#load-latest-notebook").click();
  assert.equal(d.doc.querySelector(`#results [data-home="${h.id}"]`),null);
  d.doc.querySelector("#reset-filters").click();
  assert.equal(JSON.parse(d.w.localStorage.getItem("spicyhome.workspace.v1")).records[h.id].notes,"Saved in another tab");
  d.close();
});
test("unreadable notebook remains recoverable until a validated backup is imported", async () => {
  const h = seed.homes[0];
  const notebook = {version:1,records:{[h.id]:{saved:true,snapshot:h,notes:"Original notes"}},manual:[],events:[],preferences:{search:"x".repeat(501)}};
  const d = await boot({notebook});
  const original = d.w.localStorage.getItem("spicyhome.workspace.v1");
  d.doc.querySelector("#reset-filters").click();
  assert.equal(d.w.localStorage.getItem("spicyhome.workspace.v1"),original);
  let downloaded;
  d.w.Blob = class {constructor(parts) {downloaded=parts[0];}};
  d.w.HTMLAnchorElement.prototype.click = () => {};
  d.doc.querySelector("#export-original").click();
  assert.equal(downloaded,original);
  const fixed = JSON.stringify({...notebook,preferences:{}});
  await d.doc.querySelector("#import-file").onchange({target:{files:[{size:fixed.length,text:async()=>fixed}],value:""}});
  assert.equal(JSON.parse(d.w.localStorage.getItem("spicyhome.workspace.v1")).records[h.id].notes,"Original notes");
  assert.equal(d.doc.querySelector("#storage-warning"),null);
  d.close();
});
for (const attempted_at of ["2026-09-06T00:00:00Z", undefined, "2026-09-09T00:00:00Z"]) {
  test(`tracking failure is compared with the selected successful scan: ${attempted_at}`, async () => {
    const live = connectedSnapshot();
    const d = await boot({remote:live,packaged:live,configuration:{feed_url:"remote",fallback_url:"./data.json",status_url:"status"},attempt:{schema_version:1,status:"failed",attempted_at,message:"Test failure"}});
    const failureVisible=d.doc.querySelector("#notice").textContent.includes("most recent tracking attempt failed");
    assert.equal(failureVisible,attempted_at === "2026-09-09T00:00:00Z");
    d.close();
  });
}

test("suburban search, area dates and notebook state work together", async () => {
  const live=connectedSnapshot();live.provider.area_scans={Chicago:{last_success:live.provider.last_success,returned:500,total:800,truncated:true}};
  const d=await boot({remote:live,packaged:live});
  assert.match(d.doc.querySelector(".area-guide").textContent,/Evanston/);
  assert.match(d.doc.querySelector(".area-guide").textContent,/Awaiting first listing scan/);
  const region=d.doc.querySelector("#search-region");region.value="suburbs";region.dispatchEvent(new d.w.Event("change"));
  assert.equal(d.doc.querySelectorAll("#results .home-card").length,8);
  assert(d.doc.querySelector('#results [data-home="amli-evanston"]'));
  assert.equal(d.doc.querySelector('#results [data-home="amli-900"]'),null);
  const radius=d.doc.querySelector("#search-radius");radius.value="10";radius.dispatchEvent(new d.w.Event("change"));
  assert.equal(d.doc.querySelector('#results [data-home="amli-evanston"]'),null);
  radius.value="0";radius.dispatchEvent(new d.w.Event("change"));
  const save=d.doc.querySelector('#results [data-save="amli-evanston"]');save.click();
  d.doc.querySelector("#reset-filters").click();
  const saved=JSON.parse(d.w.localStorage.getItem("spicyhome.workspace.v1"));
  assert.equal(saved.records['amli-evanston'].saved,true);
  assert.equal(saved.preferences.region,"all");
  d.close();
});

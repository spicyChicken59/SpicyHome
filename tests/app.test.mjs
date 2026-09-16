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
const { openQuestions: modelOpenQuestions, defaults: modelDefaults } =
  await import("../dist/model.js");
const openQuestionsFor = (home) => modelOpenQuestions(home, {}, modelDefaults, testNow());
// One clock for the fixture and for the page under test. The app is evaluated
// INSIDE the jsdom window and reads that window's own Date, so a fixture
// stamped from the Node process clock while the page reads another measures the
// gap between two clocks rather than the behaviour it names. An earlier sweep
// shifted only the process clock and reported eight "clock-dependent" discovery
// tests; what it had actually done was date every observation into the page's
// future, which pickAge() refuses by design.
// SPICYHOME_TEST_CLOCK_SKEW_DAYS moves BOTH together, which is the only way to
// ask "does this still hold a year from now". Unset -- as in CI -- it is zero
// and nothing here changes: the clock is never frozen, only carried forward, so
// a rule that reads the calendar still reads a real one.
const SKEW_DAYS = Number(process.env.SPICYHOME_TEST_CLOCK_SKEW_DAYS ?? 0);
const CLOCK_SKEW = Number.isFinite(SKEW_DAYS) ? SKEW_DAYS * 86400000 : 0;
const testNow = () => new Date(Date.now() + CLOCK_SKEW);
function shiftWindowClock(w) {
  if (!CLOCK_SKEW) return;
  const Real = w.Date;
  class Shifted extends Real {
    constructor(...args) { if (!args.length) super(Real.now() + CLOCK_SKEW); else super(...args); }
    static now() { return Real.now() + CLOCK_SKEW; }
  }
  w.Date = Shifted;
}
async function boot({
  remote = seed,
  cache = null,
  notebook = null,
  storageFails = false,
  mirror = undefined,
  packaged = seed,
  configuration = undefined,
  attempt = undefined,
  leaflet = undefined,
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
  if (leaflet) w.L = leaflet(w);
  shiftWindowClock(w);
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
  assert.equal(next.doc.querySelectorAll(".saved-row").length, 1);
  assert.match(next.doc.querySelector(".saved-row").textContent, /Archived notebook entry/);
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
  const remove = d.doc.querySelector(".saved-row [data-save]");
  remove.focus();
  remove.click();
  assert.equal(d.doc.querySelectorAll(".saved-row").length, 0);
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
  assert.match(d.doc.querySelector(".saved-row").textContent,/Layout needs checking/);
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
  assert.equal(d.doc.querySelectorAll("#results .home-card").length,12);
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

test("two-bedroom selection, layout correction and reload keep the notebook intact", async () => {
  const d=await boot();
  const bedrooms=d.doc.querySelector("#search-bedrooms");
  assert.equal(bedrooms.value,"all");
  bedrooms.value="2";bedrooms.dispatchEvent(new d.w.Event("change"));
  assert.equal(d.doc.querySelectorAll("#results .home-card").length,4);
  const id="bristol-station-victoria";
  assert.match(d.doc.querySelector(`#results [data-home="${id}"]`).closest('.home-card').textContent,/2 bed · 2 bath/);
  d.doc.querySelector(`#results [data-detail="${id}"]`).click();
  d.doc.querySelector("#layoutReview").value="two_bed_one_bath";
  d.doc.querySelector("#notes").value="Checked the exact plan";
  d.doc.querySelector("#record-form").dispatchEvent(new d.w.Event("submit",{bubbles:true,cancelable:true}));
  const stored=JSON.parse(d.w.localStorage.getItem("spicyhome.workspace.v1"));
  assert.equal(stored.records[id].layoutReview,"two_bed_one_bath");
  assert.equal(stored.records[id].notes,"Checked the exact plan");
  assert.equal(stored.preferences.bedrooms,"2");
  d.close();
  const reloaded=await boot({notebook:stored});
  assert.equal(reloaded.doc.querySelector("#search-bedrooms").value,"2");
  assert.match(reloaded.doc.querySelector(`#results [data-home="${id}"]`).closest('.home-card').textContent,/2 bed · 1 bath — checked by you/);
  reloaded.doc.querySelector("#reset-filters").click();
  assert.equal(reloaded.doc.querySelector("#search-bedrooms").value,"all");
  reloaded.close();
});

function mapStub(capture) {
  return () => {
    const map={center:[41.882,-87.632],zoom:13,setView(center,zoom){this.center=center;this.zoom=zoom;return this;},getCenter(){return this.center;},getZoom(){return this.zoom;},fitBounds(){capture.fits=(capture.fits??0)+1;return this;},remove(){capture.removals=(capture.removals??0)+1;},invalidateSize(){capture.invalidations=(capture.invalidations??0)+1;return this;}};
    const makeMarker=(coords,options) => {
      const m={coords,options,openCount:0,addTo(){return this;},bindPopup(content){this.popup=content;return this;},on(){return this;},getLatLng(){return coords;},openPopup(){this.openCount++;return this;}};
      capture.push(m);return m;
    };
    capture.map=map;
    return {map:()=>{capture.creations=(capture.creations??0)+1;return map;},divIcon:(options)=>options,tileLayer:()=>({addTo(){}}),marker:makeMarker,circleMarker:()=>({addTo(){return this;},bindPopup(){return this;}})};
  };
}

test("co-located map plans stay selectable with exact labels and notes", async () => {
  const capture=[];const d=await boot({leaflet:mapStub(capture)});
  const bristol=seed.homes.find(h=>h.id==='bristol-station');
  const shared=capture.filter(m=>m.coords[0]===bristol.lat&&m.coords[1]===bristol.lng);
  assert.equal(shared.length,1);
  const marker=shared[0];assert.match(marker.options.icon.html,/3 options/);
  assert.equal(marker.popup.querySelectorAll('[data-map-plan]').length,3);
  const ids=['bristol-station','bristol-station-victoria','bristol-station-grand-central'];
  for(const id of ids){
    const button=d.doc.querySelector(`[data-map-home="${id}"]`);
    assert.match(button.textContent,/Plan /);button.click();
  }
  assert.equal(marker.openCount,3);
  const choice=marker.popup.querySelector('[data-map-plan="bristol-station-victoria"]');
  assert.match(choice.textContent,/Victoria · Unit 816-202/);
  assert.match(choice.textContent,/2 bed · 2 bath/);
  assert.match(choice.textContent,/Advertised/);
  choice.click();
  assert.equal(d.doc.querySelector('#record-form').dataset.id,'bristol-station-victoria');
  d.doc.querySelector('#notes').value='Check the Victoria plan';
  d.doc.querySelector('#record-form').dispatchEvent(new d.w.Event('submit',{bubbles:true,cancelable:true}));
  assert.equal(JSON.parse(d.w.localStorage.getItem('spicyhome.workspace.v1')).records['bristol-station-victoria'].notes,'Check the Victoria plan');
  assert.equal(d.doc.activeElement.dataset.mapHome,'bristol-station-victoria');
  d.doc.querySelector('[data-map-home="burlington-station"]').click();
  assert.equal(d.doc.querySelector('#record-form').dataset.id,'burlington-station');
  d.close();
});

test("resetting other filters preserves the selected bedroom size and evidence", async () => {
  const d=await boot();
  for(const [id,value] of [['#search-bedrooms','2'],['#layout-scope','source'],['#search-region','chicago']]){
    const control=d.doc.querySelector(id);control.value=value;control.dispatchEvent(new d.w.Event('change'));
  }
  assert.equal(d.doc.querySelectorAll('#results .home-card').length,0);
  d.doc.querySelector('#reset-other-filters').click();
  assert.equal(d.doc.querySelector('#search-bedrooms').value,'2');
  assert.equal(d.doc.querySelector('#layout-scope').value,'source');
  assert.equal(d.doc.querySelectorAll('#results .home-card').length,4);
  d.close();
});

test("empty bedroom coverage offers an explicit way to broaden it", async () => {
  const one={...seed,homes:seed.homes.filter(h=>h.bedrooms===1)};
  const d=await boot({remote:one,packaged:one});
  const control=d.doc.querySelector('#search-bedrooms');control.value='2';control.dispatchEvent(new d.w.Event('change'));
  assert.equal(d.doc.querySelector('#reset-other-filters'),null);
  d.doc.querySelector('#broaden-bedrooms').click();
  assert.equal(d.doc.querySelector('#search-bedrooms').value,'all');
  assert(d.doc.querySelectorAll('#results .home-card').length>0);
  d.close();
});

// A number on a map is read as a fact about the place under it, so what a mark
// may print is the same contract the card keeps: the figure the card prints,
// on the basis the card names, for every place the mark stands for.
const markerFor = (capture, id, seedHomes) => {
  const home = seedHomes.find((h) => h.id === id);
  return capture.find((m) => m.coords[0] === home.lat && m.coords[1] === home.lng);
};

test("a mark prints the figure its own card prints, rounded, and carries the exact one", async () => {
  const capture = [];
  const d = await boot({ leaflet: mapStub(capture) });
  const mark = markerFor(capture, "amli-lofts", seed.homes);
  assert.match(mark.options.icon.html, /class="map-price"[^>]*>\$2\.7k</);
  // the exact figure and its basis word, for a reader who cannot see the pill
  assert.match(mark.options.icon.html, /AMLI Lofts[^<]*Base rent from[^<]*\$2,663/);
  assert.match(mark.options.title, /Base rent from[^"]*\$2,663/);
  // and it is the same figure the card prints for that record
  const card = d.doc.querySelector('.home-card[data-home="amli-lofts"]');
  assert.match(card.querySelector(".rent").textContent, /\$2,663/);
  assert.match(card.querySelector(".price-kind").textContent, /Base rent from/);
  d.close();
});

test("a mark standing for places that disagree on price prints no price", async () => {
  const capture = [];
  const d = await boot({ leaflet: mapStub(capture) });
  const mark = markerFor(capture, "tapestry-station", seed.homes);
  assert.match(mark.options.icon.html, /3 options/);
  assert.equal(/class="map-price"/.test(mark.options.icon.html), false);
  assert.match(mark.options.icon.html, /class="map-dot map-dot-group"/);
  // and the silence is this mark's, not the map's: a place whose one figure is
  // agreed still prints it in the same render
  assert.match(markerFor(capture, "amli-lofts", seed.homes).options.icon.html, /class="map-price"/);
  d.close();
});

test("a mark standing for places that agree prints the one figure they share", async () => {
  const feed = structuredClone(seed);
  const base = feed.homes.find((h) => h.id === "tapestry-station");
  for (const id of ["tapestry-station", "tapestry-station-sheridan", "tapestry-station-dempster"]) {
    const home = feed.homes.find((h) => h.id === id);
    home.rent = null;
    home.advertised_price = base.advertised_price;
    home.advertised_price_type = base.advertised_price_type;
  }
  const capture = [];
  const d = await boot({ leaflet: mapStub(capture), remote: feed, packaged: feed });
  const mark = markerFor(capture, "tapestry-station", feed.homes);
  assert.match(mark.options.icon.html, /3 options/);
  assert.match(mark.options.icon.html, /class="map-price"[^>]*>\$2\.3k</);
  d.close();
});

test("a mark prints no price where one figure would mean two different bases", async () => {
  const feed = structuredClone(seed);
  // Same number, two bases: a base rent read from a plan, and an advertised
  // monthly total whose base rent nobody has seen. One pill would say they are
  // the same kind of money.
  const one = feed.homes.find((h) => h.id === "tapestry-station");
  const two = feed.homes.find((h) => h.id === "tapestry-station-sheridan");
  const three = feed.homes.find((h) => h.id === "tapestry-station-dempster");
  for (const home of [one, two, three]) { home.rent = null; home.advertised_price = 2400; }
  one.advertised_price_type = "total_monthly";
  two.advertised_price_type = "total_monthly";
  three.advertised_price_type = "monthly_fee_treatment_unspecified";
  const capture = [];
  const d = await boot({ leaflet: mapStub(capture), remote: feed, packaged: feed });
  const mark = markerFor(capture, "tapestry-station", feed.homes);
  assert.match(mark.options.icon.html, /3 options/);
  assert.equal(/class="map-price"/.test(mark.options.icon.html), false);
  // and with the odd one out removed, the two that agree do print it
  three.advertised_price_type = "total_monthly";
  const agreed = [];
  const e = await boot({ leaflet: mapStub(agreed), remote: feed, packaged: feed });
  assert.match(markerFor(agreed, "tapestry-station", feed.homes).options.icon.html,
    /class="map-price"[^>]*>\$2\.4k</);
  d.close(); e.close();
});

test("a place with no quoted figure gets a mark and no number", async () => {
  const capture = [];
  const d = await boot({ leaflet: mapStub(capture) });
  const mark = markerFor(capture, "marlowe", seed.homes);
  assert.equal(/class="map-price"/.test(mark.options.icon.html), false);
  assert.match(mark.options.icon.html, /class="map-dot"/);
  assert.match(mark.options.icon.html, /Not quoted/);
  // never a zero standing in for a figure nobody quoted
  assert.equal(/\$0/.test(mark.options.icon.html), false);
  assert.match(markerFor(capture, "amli-lofts", seed.homes).options.icon.html, /class="map-price"/);
  d.close();
});

test("a rounded mark rounds to the nearest hundred and never below a thousand", async () => {
  const feed = structuredClone(seed);
  const cases = [["amli-lofts", 1749, "\\$1\\.7k"], ["amli-900", 1750, "\\$1\\.8k"],
    ["amli-west-loop", 3000, "\\$3k"], ["73-east-lake", 999, "\\$999"]];
  for (const [id, rent] of cases) feed.homes.find((h) => h.id === id).rent = rent;
  const capture = [];
  // The reader's own budget decides which places the map draws at all, so this
  // one is opened wide: what is under test is the figure, not the filter.
  const d = await boot({ leaflet: mapStub(capture), remote: feed, packaged: feed,
    notebook: { version: 1, records: {}, manual: [], events: [], preferences: { min: 0, max: 20000 } } });
  for (const [id, , shown] of cases)
    assert.match(markerFor(capture, id, feed.homes).options.icon.html,
      new RegExp(`class="map-price"[^>]*>${shown}<`), id);
  d.close();
});

test("a mark carries the shortlist and the final three it stands for", async () => {
  const capture = [];
  const d = await boot({ leaflet: mapStub(capture), notebook: { version: 1, records: {
    "amli-lofts": { saved: true },
    "amli-evanston": { saved: true, finalist: true },
  }, manual: [], events: [] } });
  assert.match(markerFor(capture, "amli-lofts", seed.homes).options.icon.className, /home-map-marker is-saved$/);
  assert.match(markerFor(capture, "amli-lofts", seed.homes).options.icon.html, /saved to your shortlist/);
  const finalist = markerFor(capture, "amli-evanston", seed.homes);
  assert.match(finalist.options.icon.className, /is-finalist is-saved$/);
  assert.match(finalist.options.icon.html, /one of your final three/);
  assert.match(markerFor(capture, "amli-900", seed.homes).options.icon.className, /^home-map-marker$/);
  d.close();
});

test("Explore offers compact filters and working List Map Focus switches", async () => {
  const capture=[];const d=await boot({leaflet:mapStub(capture)});
  assert.equal(d.doc.querySelector('#search-controls').open,false);
  assert.match(d.doc.querySelector('#search-scope').textContent,/1 & 2 bedrooms/);
  d.doc.querySelector('[data-bed="2"]').click();
  assert.equal(d.doc.querySelectorAll('#results .home-card').length,4);
  assert.equal(d.doc.querySelector('#search-bedrooms').value,'2');
  d.doc.querySelector('button[data-surface="list"]').click();
  assert.equal(d.doc.querySelector('.map-panel').hidden,true);
  d.doc.querySelector('button[data-surface="map"]').click();
  assert.equal(d.doc.querySelector('.map-panel').hidden,false);
  assert.equal(d.doc.querySelector('.results-column').hidden,true);
  assert(capture.invalidations>=2);
  d.doc.querySelector('button[data-surface="focus"]').click();
  assert.equal(d.doc.querySelector('#explore-results').hidden,true);
  assert.equal(d.doc.querySelectorAll('#focus-surface .home-card').length,1);
  d.doc.querySelector('#open-search-controls').click();
  assert.equal(d.doc.querySelector('#search-controls').open,true);
  assert.equal(d.doc.activeElement.id,'min');
  d.close();
});
test("Focus skip and save can be undone without losing notes or hiding Discover homes", async () => {
  const d=await boot();d.doc.querySelector('button[data-surface="focus"]').click();
  const first=d.doc.querySelector('#focus-surface [data-home]').dataset.home;
  d.doc.querySelector('#focus-skip').click();
  assert.notEqual(d.doc.querySelector('#focus-surface [data-home]').dataset.home,first);
  assert(d.doc.querySelector(`#results [data-home="${first}"]`));
  d.doc.querySelector('#focus-undo').click();
  assert.equal(d.doc.querySelector('#focus-surface [data-home]').dataset.home,first);
  d.doc.querySelector('#focus-save').click();
  let notebook=JSON.parse(d.w.localStorage.getItem('spicyhome.workspace.v1'));
  assert.equal(notebook.records[first].saved,true);
  d.doc.querySelector('#focus-undo').click();
  notebook=JSON.parse(d.w.localStorage.getItem('spicyhome.workspace.v1'));
  assert.equal(notebook.records[first].saved,false);
  assert.equal(d.doc.querySelector('#focus-surface [data-home]').dataset.home,first);
  d.doc.querySelector('#focus-skip').click();d.close();
  const again=await boot({notebook});
  assert.equal(again.doc.querySelector('#focus-surface [data-home]').dataset.home,first);
  again.close();
});
test("decision board moves a saved home through stages while preserving notebook values", async () => {
  const h=seed.homes[0];const notebook={version:1,manual:[],events:[],preferences:{},records:{[h.id]:{saved:true,snapshot:h,status:'researching',notes:'Keep this note',rentOverride:2200,tourChecks:{light:true}}}};
  const d=await boot({notebook});d.doc.querySelector('[data-view="shortlist"]').click();
  let stage=d.doc.querySelector('[data-stage]');stage.value='tour scheduled';stage.dispatchEvent(new d.w.Event('change'));
  let stored=JSON.parse(d.w.localStorage.getItem('spicyhome.workspace.v1'));
  assert.equal(stored.records[h.id].status,'tour scheduled');
  assert.equal(stored.records[h.id].notes,'Keep this note');
  assert.equal(stored.records[h.id].rentOverride,2200);
  assert.equal(stored.records[h.id].tourChecks.light,true);
  assert.equal(d.doc.activeElement.dataset.stage,h.id);
  stage=d.doc.querySelector('[data-stage]');stage.value='ruled out';stage.dispatchEvent(new d.w.Event('change'));
  d.doc.querySelector('[data-board-stage="ruled out"]').click();
  assert.equal(d.doc.querySelector('[data-home]').dataset.home,h.id);
  d.close();
});
test("tour companion saves personal checks alongside notes and later quotes", async () => {
  const d=await boot();const id=d.doc.querySelector('[data-tour]').dataset.tour;
  d.doc.querySelector('[data-tour]').click();
  assert.equal(d.doc.querySelector('#tour-companion').open,true);
  d.doc.querySelector('[data-tour-check="layout"]').checked=true;
  d.doc.querySelector('[data-tour-check="charging"]').checked=true;
  d.doc.querySelector('#notes').value='Charger needs an adapter; ask about fees.';
  d.doc.querySelector('#record-form').dispatchEvent(new d.w.Event('submit',{bubbles:true,cancelable:true}));
  d.doc.querySelector(`[data-detail="${id}"]`).click();
  assert.equal(d.doc.querySelector('[data-tour-check="charging"]').checked,true);
  d.doc.querySelector('#rentOverride').value='2250';
  d.doc.querySelector('#record-form').dispatchEvent(new d.w.Event('submit',{bubbles:true,cancelable:true}));
  const record=JSON.parse(d.w.localStorage.getItem('spicyhome.workspace.v1')).records[id];
  assert.equal(record.tourChecks.layout,true);assert.equal(record.tourChecks.charging,true);
  assert.equal(record.rentOverride,2250);assert.match(record.notes,/adapter/);
  assert.notEqual(record.layoutReview,'one_bed');
  d.close();
});
test("Cost Lab computes scenarios without saving assumptions as apartment quotes", async () => {
  const d=await boot();d.doc.querySelector('[data-view="lab"]').click();
  const select=d.doc.querySelector('#lab-home');select.value='bristol-station-victoria';select.dispatchEvent(new d.w.Event('change'));
  assert.match(d.doc.querySelector('#lab-output').textContent,/Base rent needed/);
  for(const [key,value] of Object.entries({rent:2200,parking:100,fees:0,utilities:80,charging:25})){
    const input=d.doc.querySelector('#lab-'+key);input.value=String(value);input.dispatchEvent(new d.w.Event('input'));
  }
  assert.match(d.doc.querySelector('.lab-number').textContent,/2,405/);
  assert.match(d.doc.querySelector('.lab-bottom').textContent,/28,860/);
  assert.match(d.doc.querySelector('#lab-output').textContent,/YOUR WHAT-IF SCENARIO/);
  const stored=d.w.localStorage.getItem('spicyhome.workspace.v1');
  assert(stored===null||!JSON.parse(stored).records['bristol-station-victoria']);
  const months=d.doc.querySelector('#lab-months');months.value='6';months.dispatchEvent(new d.w.Event('input'));
  assert.match(d.doc.querySelector('.lab-bottom').textContent,/14,430/);
  const current=d.doc.querySelector('#lab-home');current.value='bristol-station';current.dispatchEvent(new d.w.Event('change'));
  assert.equal(d.doc.querySelector('#lab-rent').value,'');
  assert.match(d.doc.querySelector('#lab-output').textContent,/Base rent needed/);
  d.close();
});

test("Focus actions refresh counts and restore focus to a visible action", async () => {
  const only={...seed,homes:[seed.homes[0]]};
  const d=await boot({remote:only,packaged:only});
  d.doc.querySelector('button[data-surface="focus"]').click();
  d.doc.querySelector('#focus-save').focus();d.doc.querySelector('#focus-save').click();
  assert.equal(d.doc.querySelector('#saved-count').textContent,'1');
  assert.equal(d.doc.activeElement.id,'focus-undo');
  d.doc.querySelector('#focus-undo').click();
  assert.equal(d.doc.querySelector('#saved-count').textContent,'0');
  const heart=d.doc.querySelector('#focus-surface [data-save]');heart.focus();heart.click();
  assert.notEqual(d.doc.activeElement.tagName,'BODY');
  assert.equal(d.doc.activeElement.closest('[hidden]'),null);
  d.close();
});
test("Cost Lab keeps invalid-field feedback when another field changes", async () => {
  const d=await boot();d.doc.querySelector('[data-view="lab"]').click();
  const before=d.doc.querySelector('.lab-number').textContent;
  const rent=d.doc.querySelector('#lab-rent');rent.value='-1';rent.dispatchEvent(new d.w.Event('input'));
  const parking=d.doc.querySelector('#lab-parking');parking.value='150';parking.dispatchEvent(new d.w.Event('input'));
  assert.match(d.doc.querySelector('#lab-error').textContent,/last valid scenario/);
  assert.equal(rent.getAttribute('aria-invalid'),'true');
  assert.equal(d.doc.querySelector('.lab-number').textContent,before);
  rent.value='2200';rent.dispatchEvent(new d.w.Event('input'));
  assert.equal(d.doc.querySelector('#lab-error').textContent,'');
  assert.equal(rent.getAttribute('aria-invalid'),'false');
  d.close();
});

test("source details stay compact when healthy and expand for a failed refresh", async () => {
  // Healthy is a property of the FEED, not of the hour this suite runs in. The
  // seed's own generated_at crosses the app's seven-day line eight days after
  // it was written, and from that minute this test was asserting that a feed
  // the app rightly calls stale looks healthy. It supplies a fresh one instead.
  const fresh={...seed,generated_at:testNow().toISOString()};
  const healthy=await boot({remote:fresh,packaged:fresh});assert.equal(healthy.doc.querySelector('#source-status').open,false);
  assert.doesNotMatch(healthy.doc.querySelector('#source-status-label').textContent,/attention/);healthy.close();
  const failed=await boot({remote:null,packaged:seed});
  assert.equal(failed.doc.querySelector('#source-status').open,true);
  assert.match(failed.doc.querySelector('#source-status-label').textContent,/attention/);
  assert.match(failed.doc.querySelector('#notice').textContent,/unavailable/);
  failed.close();
});

test("named searches switch all filters and view while retaining notebook and current utility estimate", async () => {
  const h=seed.homes[0];
  const notebook={version:1,records:{[h.id]:{saved:true,notes:"Keep this",snapshot:h}},manual:[],events:[],preferences:{utilityEstimate:90}};
  const d=await boot({notebook});
  d.doc.querySelector('[data-bed="2"]').click();
  const region=d.doc.querySelector('#search-region');region.value='suburbs';region.dispatchEvent(new d.w.Event('change'));
  d.doc.querySelector('[data-surface="atlas"]').click();
  d.doc.querySelector('#search-name').value='Suburban two-bed';
  d.doc.querySelector('#save-search-form').dispatchEvent(new d.w.Event('submit',{cancelable:true}));
  d.doc.querySelector('#reset-filters').click();
  d.doc.querySelector('[data-surface="list"]').click();
  d.doc.querySelector('[data-search-load="0"]').click();
  const saved=JSON.parse(d.w.localStorage.getItem('spicyhome.workspace.v1'));
  assert.equal(saved.preferences.bedrooms,'2');assert.equal(saved.preferences.region,'suburbs');
  assert.equal(saved.preferences.surface,'atlas');assert.equal(saved.preferences.utilityEstimate,90);
  assert.equal(saved.records[h.id].notes,'Keep this');assert.equal(saved.savedSearches.length,1);
  assert.equal(d.doc.querySelector('#atlas-surface').hidden,false);
  assert.equal(d.doc.activeElement.dataset.searchLoad,'0');
  d.close();
});
test("saved-search import merges names and rejects invalid or over-capacity imports atomically", async () => {
  const search={name:'First',preferences:{bedrooms:'1'}};
  const d=await boot({notebook:{version:1,records:{},manual:[],events:[],preferences:{},savedSearches:[search]}});
  async function importSearches(savedSearches) {
    const text=JSON.stringify({version:1,records:{},manual:[],events:[],preferences:{},savedSearches});
    await d.doc.querySelector('#import-file').onchange({target:{files:[{size:text.length,text:async()=>text}],value:''}});
  }
  await importSearches([{name:'FIRST',preferences:{bedrooms:'2'}}]);
  let saved=JSON.parse(d.w.localStorage.getItem('spicyhome.workspace.v1'));
  assert.equal(saved.savedSearches.length,1);assert.equal(saved.savedSearches[0].preferences.bedrooms,'2');
  const before=JSON.stringify(saved);
  await importSearches([{name:'Broken',preferences:{surface:'bad'}}]);
  assert.equal(d.w.localStorage.getItem('spicyhome.workspace.v1'),before);
  await importSearches(Array.from({length:8},(_,i)=>({name:'Extra '+i,preferences:{}})));
  assert.equal(d.w.localStorage.getItem('spicyhome.workspace.v1'),before);
  d.close();
});
test("atlas selects overlapping exact plans, excludes unknown numbers, and keeps all homes in list mode", async () => {
  const base={...seed.homes[0],rent:2000,sqft:800};
  const homes=[{...base,id:'atlas-a',floor_plan:'A'},{...base,id:'atlas-b',floor_plan:'B'},{...base,id:'atlas-unknown',rent:null,advertised_price:2200}];
  const snapshot={...seed,homes};const d=await boot({remote:snapshot,packaged:snapshot,notebook:{version:1,records:{"atlas-b":{rentOverride:2100,quoteDate:"2026-09-08"}},manual:[],events:[],preferences:{}}});
  d.doc.querySelector('[data-surface="atlas"]').click();
  assert.equal(d.doc.querySelector('#atlas-home').options.length,2);
  assert.equal(d.doc.querySelector('#explore-results').hidden,true);
  assert.match(d.doc.querySelector('#atlas-surface').textContent,/2 of 3 matches plotted · 1 without both figures/);
  assert.match(d.doc.querySelector('#atlas-surface').textContent,/1 has no base rent on record and 0 have a base rent but no reported size/);
  assert.doesNotMatch(d.doc.querySelector('#atlas-surface').textContent,/2,200/);
  const picker=d.doc.querySelector('#atlas-home');picker.value='atlas-b';picker.dispatchEvent(new d.w.Event('change'));
  assert.match(d.doc.querySelector('.atlas-selection').textContent,/Your base-rent quote: Sep 8, 2026/);
  assert.match(d.doc.querySelector('.atlas-selection').textContent,/Source observed:/);
  d.doc.querySelector('.atlas-selection [data-detail]').click();
  assert.match(d.doc.querySelector('.detail-sub').textContent,/Plan B/);
  d.doc.querySelector('#detail-content [data-close]').click();
  d.doc.querySelector('.atlas-selection [data-save]').click();
  assert.equal(JSON.parse(d.w.localStorage.getItem('spicyhome.workspace.v1')).records['atlas-b'].saved,true);
  assert.equal(d.doc.activeElement.dataset.save,'atlas-b');
  assert.equal(d.doc.activeElement.closest('[hidden]'),null);
  d.doc.querySelector('[data-surface="list"]').click();
  assert.equal(d.doc.querySelectorAll('#results .home-card').length,3);
  assert.equal(d.doc.querySelector('#atlas-surface').children.length,0);
  d.close();
});
test("comparison keeps exact plan identity and differences toggle works for phone and desktop facts", async () => {
  const base={...seed.homes[0],rent:2000,sqft:800};
  const homes=[{...base,id:'compare-a',floor_plan:'A'},{...base,id:'compare-b',floor_plan:'B',rent:2200}];
  const d=await boot({remote:{...seed,homes},packaged:{...seed,homes}});
  for (const checkbox of d.doc.querySelectorAll('#results [data-compare]')) {checkbox.checked=true;checkbox.dispatchEvent(new d.w.Event('change'));}
  d.doc.querySelector('#open-compare').click();
  assert.match(d.doc.querySelector('.compare-identities').textContent,/Plan A/);assert.match(d.doc.querySelector('.compare-identities').textContent,/Plan B/);
  const measures=() => d.doc.querySelectorAll('.sc-compare-pair__measure');
  const before=measures().length;
  const toggle=d.doc.querySelector('#compare-differences');toggle.checked=true;toggle.dispatchEvent(new d.w.Event('change'));
  assert(measures().length<before);
  assert.match(d.doc.querySelector('.compare-pair').textContent,/Base rent/);
  assert.doesNotMatch(d.doc.querySelector('.compare-pair').textContent,/EV charging/);
  assert.equal(d.doc.querySelectorAll('.matrix tbody tr').length,measures().length);
  assert.equal(d.doc.activeElement.id,'compare-differences');
  d.close();
});
test("Ask next has a manual-copy fallback, preserves draft privacy and moves to notes without saving", async () => {
  const h=seed.homes[0];
  const d=await boot({notebook:{version:1,records:{[h.id]:{saved:true,notes:'Private notes stay here',snapshot:h}},manual:[],events:[],preferences:{}}});
  d.doc.querySelector(`[data-detail="${h.id}"]`).click();
  assert.doesNotMatch(d.doc.querySelector('#leasing-draft').value,/Private notes/);
  await d.doc.querySelector('#copy-questions').onclick();
  assert.match(d.doc.querySelector('#questions-copy-status').textContent,/Select and copy/);
  assert.equal(d.doc.activeElement.id,'leasing-draft');
  const before=d.w.localStorage.getItem('spicyhome.workspace.v1');
  d.doc.querySelector('#questions-to-notes').click();
  assert.equal(d.doc.activeElement.id,'notes');assert.equal(d.w.localStorage.getItem('spicyhome.workspace.v1'),before);
  d.close();
});
test("move-in scratchpad validates every field, updates cash only and clears for another home", async () => {
  const d=await boot();d.doc.querySelector('[data-view="lab"]').click();
  const enter=(id,value)=>{const input=d.doc.querySelector('#'+id);input.value=String(value);input.dispatchEvent(new d.w.Event('input'));};
  for (const [key,value] of Object.entries({rent:2000,parking:100,fees:50,utilities:100,charging:50})) enter('lab-'+key,value);
  for (const [key,value] of Object.entries({deposit:2000,oneTime:300,moving:500,prepaid:2000})) enter('move-in-'+key,value);
  assert.match(d.doc.querySelector('.move-in-total').textContent,/7,100/);
  assert.match(d.doc.querySelector('.lab-bottom').textContent,/27,600/);
  const valid=d.doc.querySelector('#lab-output').textContent;
  enter('move-in-deposit',-1);enter('lab-parking',150);
  assert.match(d.doc.querySelector('#lab-error').textContent,/last valid scenario/);
  assert.equal(d.doc.querySelector('#lab-output').textContent,valid);
  enter('move-in-deposit',2000);
  assert.equal(d.doc.querySelector('#lab-error').textContent,'');
  assert.match(d.doc.querySelector('.move-in-total').textContent,/7,150/);
  const select=d.doc.querySelector('#lab-home');select.selectedIndex=1;select.dispatchEvent(new d.w.Event('change'));
  assert.equal(d.doc.querySelector('#move-in-deposit').value,'');
  assert.equal(d.doc.querySelector('#lab-rent').value,'');
  assert.equal(d.w.localStorage.getItem('spicyhome.workspace.v1'),null);
  d.close();
});

test("quick jump searches excluded plans, navigates by keyboard and respects an open notebook dialog", async () => {
  const h={...seed.homes[0],id:'jump-excluded',title:'Hidden Studio',bedrooms:0,layout_status:'studio'};
  const snapshot={...seed,homes:[...seed.homes,h]};const d=await boot({remote:snapshot,packaged:snapshot});
  d.doc.dispatchEvent(new d.w.KeyboardEvent('keydown',{key:'k',ctrlKey:true,bubbles:true}));
  assert.equal(d.doc.querySelector('#jump-dialog').open,true);assert.equal(d.doc.activeElement.id,'jump-search');
  const search=d.doc.querySelector('#jump-search');search.value='Hidden Studio';search.dispatchEvent(new d.w.Event('input'));
  assert.match(d.doc.querySelector('#jump-results').textContent,/Studio/);
  search.dispatchEvent(new d.w.KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true}));
  assert.equal(d.doc.activeElement.dataset.jumpHome,'jump-excluded');d.doc.activeElement.click();
  assert.equal(d.doc.querySelector('#jump-dialog').open,false);assert.equal(d.doc.querySelector('#detail-dialog').open,true);
  d.doc.querySelector('#notes').value='Uncommitted note';
  d.doc.dispatchEvent(new d.w.KeyboardEvent('keydown',{key:'k',ctrlKey:true,bubbles:true}));
  assert.equal(d.doc.querySelector('#jump-dialog').open,false);assert.equal(d.doc.querySelector('#notes').value,'Uncommitted note');
  d.doc.querySelector('#detail-content [data-close]').click();
  d.doc.querySelector('#open-jump').click();const input=d.doc.querySelector('#jump-search');input.value='Cost Lab';input.dispatchEvent(new d.w.Event('input'));input.dispatchEvent(new d.w.KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
  assert(d.doc.querySelector('#lab-home'));assert.equal(d.doc.activeElement.id,'view-title');
  d.close();
});
test("quick scan keeps price basis and layout visible and preserves saving and comparison", async () => {
  const d=await boot();const count=d.doc.querySelectorAll('#results .home-card').length;
  d.doc.querySelector('[data-density="scan"]').click();
  assert.equal(d.doc.querySelectorAll('#results .scan-card').length,count);
  const first=d.doc.querySelector('#results .scan-card'),id=first.dataset.home;
  assert(first.querySelector('.price-kind').textContent);assert.match(first.querySelector('.meta').textContent,/bed/);
  first.querySelector('[data-save]').click();
  const rec=JSON.parse(d.w.localStorage.getItem('spicyhome.workspace.v1'));
  assert.equal(rec.preferences.density,'scan');assert.equal(rec.records[id].saved,true);
  assert.equal(d.doc.activeElement.dataset.save,id);
  const compare=d.doc.querySelector('#results [data-compare]');compare.click();
  assert.match(d.doc.querySelector('#compare-tray').textContent,/1 of 3/);
  d.doc.querySelector('[data-density="cards"]').click();assert.equal(d.doc.querySelectorAll('#results .scan-card').length,0);
  d.close();
});
test("finalist pins cap at three, compare the pinned set and unpin on unsave without erasing notes", async () => {
  const homes=seed.homes.slice(0,4),records=Object.fromEntries(homes.map(h=>[h.id,{saved:true,snapshot:h,notes:'Personal quote',rentOverride:2300}]));
  const d=await boot({notebook:{version:1,manual:[],events:[],preferences:{},records}});d.doc.querySelector('[data-view="shortlist"]').click();
  for(const home of homes.slice(0,3)) d.doc.querySelector(`.saved-row [data-finalist="${home.id}"]`).click();
  d.doc.querySelector(`.saved-row [data-finalist="${homes[3].id}"]`).click();
  assert.match(d.doc.querySelector('#toast').textContent,/Three finalists/);
  let notebook=JSON.parse(d.w.localStorage.getItem('spicyhome.workspace.v1'));
  assert.equal(Object.values(notebook.records).filter(r=>r.finalist).length,3);
  d.doc.querySelector('#compare-finalists').click();assert.equal(d.doc.querySelectorAll('.compare-identities article').length,3);
  d.doc.querySelector('#compare-content [data-close]').click();
  d.doc.querySelector(`.saved-row [data-save="${homes[0].id}"]`).click();
  notebook=JSON.parse(d.w.localStorage.getItem('spicyhome.workspace.v1'));
  assert.equal(notebook.records[homes[0].id].finalist,false);assert.equal(notebook.records[homes[0].id].notes,'Personal quote');
  assert.equal(d.doc.querySelectorAll('.finalist-grid article').length,2);
  d.close();
});
test("tour agenda shows saved appointments and imported offset times edit consistently", async () => {
  const h=seed.homes[0],notebook={version:1,manual:[],events:[],preferences:{},records:{[h.id]:{saved:true,snapshot:h,tourDate:'2099-09-08T18:30:00Z',tourChecks:{layout:true}}}};
  const d=await boot({notebook});d.doc.querySelector('[data-view="shortlist"]').click();
  assert.match(d.doc.querySelector('.tour-agenda').textContent,/1 upcoming/);
  assert.match(d.doc.querySelector('.agenda-row').textContent,/13:30 · Chicago/);
  d.doc.querySelector('.agenda-row [data-tour]').click();assert.equal(d.doc.querySelector('#tourDate').value,'2099-09-08T13:30');
  assert.equal(d.doc.querySelector('#tour-companion').open,true);
  d.close();
});
test("detail dock jumps to notes and tour checks and saves the same notebook form", async () => {
  const d=await boot();d.doc.querySelector('#results [data-detail]').click();
  const form=d.doc.querySelector('#record-form'),id=form.dataset.id;
  d.doc.querySelector('[data-detail-jump="tour-draft-count"]').click();assert.equal(d.doc.querySelector('#tour-companion').open,true);assert.equal(d.doc.activeElement.id,'tour-draft-count');
  d.doc.querySelector('[data-detail-jump="notes"]').click();assert.equal(d.doc.activeElement.id,'notes');
  d.doc.querySelector('#notes').value='Saved through the quick dock';
  d.doc.querySelector('.detail-dock [form="record-form"]').click();
  const saved=JSON.parse(d.w.localStorage.getItem('spicyhome.workspace.v1'));
  assert.equal(saved.records[id].notes,'Saved through the quick dock');assert.equal(d.doc.querySelector('#detail-dialog').open,false);
  d.close();
});

function picksSnapshot() {
  const now=testNow().toISOString();
  const homes=seed.homes.map(h=>({...h,observed_at:now}));
  return {...seed,generated_at:now,homes,city_context:{cta:{updated_at:now}},transit_stops:[{id:'cta:test',title:'Test CTA',lat:homes[0].lat,lng:homes[0].lng,routes:[]}]};
}
test('the fixture clock and the page\'s own clock are one clock', async () => {
  const snapshot=picksSnapshot(),d=await boot({remote:snapshot,packaged:snapshot});
  // The app is evaluated inside the jsdom window and reads THAT window's Date.
  // If the two ever drift, a fixture stamped "now" lands in the page's future,
  // pickAge() refuses it by design and every discovery surface empties -- which
  // is how an earlier shifted-clock sweep mistook its own instrument for eight
  // broken tests. Assert the invariant and the consequence together, so a
  // harness that forgets to carry the window forward is caught at any offset.
  const pageNow=d.w.eval('Date.now()');
  assert(Math.abs(pageNow-testNow().getTime())<60000,
    `page clock ${new Date(pageNow).toISOString()} vs fixture clock ${testNow().toISOString()}`);
  assert.equal(d.doc.querySelectorAll('.pick-card').length,3);
  assert.equal(d.doc.querySelector('#source-status').open,false);
  d.close();
});
test('SpicyPicks shows priorities, exact plans, caveats and review links and follows bedroom filters', async () => {
  const snapshot=picksSnapshot(),d=await boot({remote:snapshot,packaged:snapshot});
  assert.equal(d.doc.querySelectorAll('#spicy-picks [data-pick-lens]').length,5);
  assert.equal(d.doc.querySelectorAll('.pick-card').length,3);
  const card=d.doc.querySelector('.pick-card');
  assert(card.querySelector('.plan-label').textContent);assert.match(card.textContent,/Why this one.*The catch/s);
  const link=[...card.querySelectorAll('a')].find(a=>/resident reviews/.test(a.textContent));
  assert.equal(new URL(link.href).hostname,'www.google.com');assert.match(new URL(link.href).searchParams.get('query'),new RegExp(card.querySelector('h4').textContent));
  d.doc.querySelector('[data-pick-lens="space"]').click();
  assert.equal(d.doc.activeElement.dataset.pickLens,'space');assert.equal(d.doc.activeElement.getAttribute('aria-pressed'),'true');
  d.doc.querySelector('[data-bed="2"]').click();
  assert.equal(d.doc.querySelectorAll('.pick-card').length,0);
  assert.match(d.doc.querySelector('.pick-leads').textContent,/needs a base-rent quote/);
  assert.match(d.doc.querySelector('.pick-lead-grid').textContent,/2 bed/);
  d.doc.querySelector('[data-bed="1"]').click();
  assert.equal(d.doc.querySelectorAll('.pick-card').length,3);d.close();
});
// Scoped to ONE element: '.pick-card .why-item' over the document matches every
// card at once, which is how a three-reason cap first read as nine.
const whyTexts = (root) => [...(root?.querySelectorAll('.why-item') ?? [])].map((n) => n.textContent);

test('a pick says why it is here and what is still open, without opening anything', async () => {
  const snapshot=picksSnapshot(),d=await boot({remote:snapshot,packaged:snapshot});
  const card=d.doc.querySelector('.pick-card');
  // Visible on the card itself: the disclosure below it is for the full
  // evidence, not for the answer to "why am I looking at this".
  const block=card.querySelector('.why-block');
  assert(block,'no why block on the pick card');
  assert.equal(block.closest('details'),null,'the explanation is hidden behind a disclosure');
  const reasons=whyTexts(card);
  assert(reasons.length>=1 && reasons.length<=3,`${reasons.length} reasons`);
  const open=card.querySelector('.why-open');
  assert(open,'no open question on the pick card');
  assert.match(open.textContent,/Still open/);
  // The one unknown is the record's own first open question.
  const id=card.dataset.pickHome;
  const home=snapshot.homes.find(h=>h.id===id);
  assert(open.textContent.includes(
    openQuestionsFor(home).find(q=>q.kind!=='tour').label),open.textContent);
  d.close();
});

test('Focus explains the one place it is showing, with the same vocabulary', async () => {
  const snapshot=picksSnapshot(),d=await boot({remote:snapshot,packaged:snapshot});
  d.doc.querySelector('button[data-surface="focus"]').click();
  const block=d.doc.querySelector('#focus-surface .why-block');
  assert(block,'Focus shows no explanation');
  assert(whyTexts(d.doc.querySelector('#focus-surface')).length>=1);
  assert.match(block.textContent,/Still open/);
  d.close();
});

test('an explanation follows the filters and leaves nothing stale behind', async () => {
  const snapshot=picksSnapshot(),d=await boot({remote:snapshot,packaged:snapshot});
  const area=/the area you chose/;
  const allReasons=()=>[...d.doc.querySelectorAll('.pick-card')].flatMap(c=>whyTexts(c));
  assert.equal(allReasons().some(t=>area.test(t)),false,'claimed an area nobody chose');
  const pick=snapshot.homes.find(h=>h.id===d.doc.querySelector('.pick-card').dataset.pickHome);
  const select=d.doc.querySelector('#neighborhood');
  select.value=pick.neighborhood;select.dispatchEvent(new d.w.Event('change',{bubbles:true}));
  const cards=[...d.doc.querySelectorAll('.pick-card')];
  assert(cards.length,'the chosen area has no picks to explain');
  for(const card of cards)
    assert(whyTexts(card).some(t=>area.test(t)),`${card.dataset.pickHome} does not name the area filter`);
  // Put the filter back: the sentence it produced is gone, not merely hidden.
  select.value='all';select.dispatchEvent(new d.w.Event('change',{bubbles:true}));
  assert.equal(allReasons().some(t=>area.test(t)),false,'a reason outlived its rule');
  assert.equal(d.doc.querySelectorAll('.why-item--filter').length,0);
  // A budget the reader narrows is named on its own terms.
  // #filters listens on change; only the search box debounces an input event.
  const max=d.doc.querySelector('#max');max.value='2600';max.dispatchEvent(new d.w.Event('change',{bubbles:true}));
  assert(d.doc.querySelectorAll('.pick-card').length,'no picks left to explain under the narrowed cap');
  assert(allReasons().some(t=>/under your \$2,600 base-rent cap/.test(t)),JSON.stringify(allReasons()));
  d.close();
});

test('the attention surfaces never print a verdict, a score or a confidence', async () => {
  const snapshot=picksSnapshot(),d=await boot({remote:snapshot,packaged:snapshot});
  const banned=/\b(best|winner|perfect|ideal|guaranteed)\b|recommended for you/i;
  for(const scope of ['#spicy-picks','#focus-surface']){
    if(scope==='#focus-surface')d.doc.querySelector('button[data-surface="focus"]').click();
    const blocks=[...d.doc.querySelectorAll(`${scope} .why-block`)];
    // A surface with nothing to read satisfies "says no verdict" without
    // saying anything, so the check asks for the explanation first.
    assert(blocks.length,`${scope} has no explanation to check`);
    for(const node of blocks){
      assert.doesNotMatch(node.textContent,banned,node.textContent);
      // No opaque number stands in for the explanation.
      assert.doesNotMatch(node.textContent,/\bscore\b|\bconfidence\b|\b\d+\s*\/\s*100\b|\b\d+\s*points?\b/i,node.textContent);
    }
  }
  d.close();
});

test('SpicyPick saving preserves snapshots and comparison checkboxes stay synchronized with the full list', async () => {
  const snapshot=picksSnapshot(),d=await boot({remote:snapshot,packaged:snapshot});
  const id=d.doc.querySelector('.pick-card').dataset.pickHome;
  d.doc.querySelector(`.pick-card [data-save="${id}"]`).click();
  const saved=JSON.parse(d.w.localStorage.getItem('spicyhome.workspace.v1')).records[id];
  assert.equal(saved.saved,true);assert.equal(saved.snapshot.id,id);assert.equal(d.doc.activeElement.dataset.save,id);
  d.doc.querySelector(`.pick-card [data-compare="${id}"]`).click();
  assert(d.doc.querySelector(`#results [data-compare="${id}"]`).checked);
  assert.match(d.doc.querySelector('#compare-tray').textContent,/1 of 3/);
  d.doc.querySelector(`#results [data-compare="${id}"]`).click();
  assert.equal(d.doc.querySelector(`.pick-card [data-compare="${id}"]`).checked,false);
  assert.equal(d.doc.querySelector('#compare-tray').textContent,'');d.close();
});
test('SpicyPicks leaves map, Focus and Atlas surfaces clear and restores on List', async () => {
  const snapshot=picksSnapshot(),d=await boot({remote:snapshot,packaged:snapshot});
  for(const surface of ['map','focus','atlas']) {
    d.doc.querySelector(`button[data-surface="${surface}"]`).click();
    assert.equal(d.doc.querySelector('#spicy-picks').hidden,true);assert.equal(d.doc.querySelectorAll('.pick-card').length,0);
  }
  d.doc.querySelector('button[data-surface="list"]').click();
  assert.equal(d.doc.querySelector('#spicy-picks').hidden,false);assert.equal(d.doc.querySelectorAll('.pick-card').length,3);d.close();
});

function studioSnapshot() {
  const snapshot=picksSnapshot(),h=snapshot.homes[0];
  snapshot.homes=[
    {...h,id:'studio-anchor',title:'Starting Place',kind:'listing',floor_plan:undefined,address:'100 Main St, Chicago, IL 60601',city:'Chicago',layout_status:'provider_reported',rent:2500,sqft:800,lat:41.87,lng:-87.63,charging:{status:'unknown'}},
    {...h,id:'studio-cheap',title:'Budget Place',kind:'listing',floor_plan:undefined,address:'200 Main St, Chicago, IL 60601',city:'Chicago',layout_status:'provider_reported',rent:2000,sqft:750,lat:41.88,lng:-87.63},
    {...h,id:'studio-room',title:'Roomy Place',kind:'listing',floor_plan:undefined,address:'300 Main St, Chicago, IL 60601',city:'Chicago',layout_status:'provider_reported',rent:2600,sqft:1000,lat:41.90,lng:-87.63},
    {...h,id:'studio-ev',title:'EV Place',kind:'listing',floor_plan:undefined,address:'400 Main St, Elmhurst, IL 60126',city:'Elmhurst',layout_status:'provider_reported',rent:2550,sqft:850,lat:41.9,lng:-87.94},
  ];
  const before=new Date(testNow().getTime()-86400000).toISOString();snapshot.homes.forEach(home=>home.history=[{date:before,rent:home.rent+100},{date:snapshot.generated_at,rent:home.rent}]);
  return snapshot;
}
async function bootStudio(notebook=null) {
  const snapshot=studioSnapshot(),d=await boot({remote:snapshot,packaged:snapshot,notebook});
  d.doc.querySelector('[data-open-studio]').click();return {...d,snapshot};
}
test('Decision Studio recipe controls change results without altering the notebook and saving keeps the chosen snapshot', async () => {
  const d=await bootStudio();assert.equal(d.doc.querySelectorAll('[data-studio-tab]').length,5);
  const before=d.w.localStorage.getItem('spicyhome.workspace.v1');
  d.doc.querySelector('[data-recipe-preset="space"]').click();
  assert.equal(d.doc.activeElement.dataset.recipePreset,'space');
  assert.equal(d.doc.querySelector('#recipe-results .pick-card').dataset.pickHome,'studio-room');
  const input=d.doc.querySelector('#recipe-space');input.value='0';input.dispatchEvent(new d.w.Event('input'));
  assert.equal(d.doc.querySelector('#recipe-value-space').textContent,'0');assert.equal(d.w.localStorage.getItem('spicyhome.workspace.v1'),before);
  const card=d.doc.querySelector('#recipe-results .pick-card'),id=card.dataset.pickHome;card.querySelector('[data-save]').click();
  const saved=JSON.parse(d.w.localStorage.getItem('spicyhome.workspace.v1')).records[id];
  assert.equal(saved.saved,true);assert.equal(saved.snapshot.id,id);d.close();
});
test('Decision Studio tradeoff controls compare exactly the anchor and the selected alternative', async () => {
  const d=await bootStudio();d.doc.querySelector('[data-studio-tab="trade"]').click();
  const select=d.doc.querySelector('#trade-anchor');select.value='studio-anchor';select.dispatchEvent(new d.w.Event('change'));
  assert.equal(d.doc.querySelectorAll('.trade-option').length,3);
  assert.match(d.doc.querySelector('.trade-option').textContent,/500 less base.*50 sq ft less/s);
  const button=d.doc.querySelector('[data-trade-compare]'),id=button.dataset.tradeCompare;button.click();
  assert.equal(d.doc.querySelector('#compare-dialog').open,true);
  const identities=d.doc.querySelector('.compare-identities').textContent;
  assert.match(identities,/Starting Place/);assert(identities.includes(d.snapshot.homes.find(h=>h.id===id).title));
  assert.equal(d.doc.querySelectorAll('.compare-identities article').length,2);d.close();
});
test('Decision Studio area comparison keeps sparse counts clear and survives an empty bedroom selection', async () => {
  const d=await bootStudio();d.doc.querySelector('[data-studio-tab="areas"]').click();
  assert.equal(d.doc.querySelectorAll('.area-profile').length,2);assert.match(d.doc.querySelector('#area-match-results').textContent,/Chicago.*sample median.*Elmhurst.*too few for a median/s);
  const select=d.doc.querySelector('#area-match-beds');select.value='2';select.dispatchEvent(new d.w.Event('change'));
  assert.match(d.doc.querySelector('#area-match-results').textContent,/No areas match/);
  const back=d.doc.querySelector('#area-match-beds');back.value='1';back.dispatchEvent(new d.w.Event('change'));
  assert.equal(d.doc.querySelectorAll('.area-profile').length,2);assert.equal(d.doc.activeElement.id,'area-match-beds');d.close();
});
test('Decision Studio price pulse filters real changes and opens their recorded history', async () => {
  const d=await bootStudio();d.doc.querySelector('[data-studio-tab="pulse"]').click();
  assert.equal(d.doc.querySelectorAll('.pulse-row').length,4);assert.match(d.doc.querySelector('.pulse-row').textContent,/100.*Source observations/s);
  d.doc.querySelector('[data-pulse="rises"]').click();assert.equal(d.doc.querySelectorAll('.pulse-row').length,0);
  d.doc.querySelector('[data-pulse="drops"]').click();d.doc.querySelector('.pulse-row [data-studio-task]').click();
  assert.equal(d.doc.querySelector('#detail-dialog').open,true);assert.equal(d.doc.activeElement.id,'detail-history');d.doc.querySelector('#detail-content [data-close]').click();
  d.doc.querySelector('#pulse-saved').click();assert.equal(d.doc.querySelectorAll('.pulse-row').length,0);assert.equal(d.doc.activeElement.id,'pulse-saved');d.close();
});
test('Decision Studio next moves open the right field and advance after saving a real layout check', async () => {
  const h=studioSnapshot().homes[0],notebook={version:1,manual:[],events:[],preferences:{},records:{[h.id]:{saved:true,snapshot:h,notes:'Keep my note'}}};
  const d=await bootStudio(notebook);d.doc.querySelector('[data-studio-tab="moves"]').click();
  assert.match(d.doc.querySelector('.next-move').textContent,/Check the exact layout/);
  d.doc.querySelector('.next-move [data-studio-task]').click();assert.equal(d.doc.activeElement.id,'layoutReview');
  d.doc.querySelector('#layoutReview').value='one_bed';d.doc.querySelector('.layout-review [type="submit"]').click();
  assert.match(d.doc.querySelector('.next-move').textContent,/Get a fresh, complete quote/);
  assert.equal(JSON.parse(d.w.localStorage.getItem('spicyhome.workspace.v1')).records[h.id].notes,'Keep my note');d.close();
});


test("saving a duplicate pick keeps the exact heart, map camera, and results position", async () => {
  const capture=[],snapshot=picksSnapshot();
  const d=await boot({remote:snapshot,packaged:snapshot,leaflet:mapStub(capture)});
  const id=d.doc.querySelector('.pick-card').dataset.pickHome;
  const button=d.doc.querySelector(`#results [data-save="${id}"]`);
  const scroller=d.doc.querySelector('.results-column');scroller.scrollTop=400;
  capture.map.setView([42,-87.7],16);const creations=capture.creations;
  button.click();
  assert.equal(d.doc.activeElement,button);
  assert.equal(d.doc.querySelector('.results-column'),scroller);
  assert.equal(scroller.scrollTop,400);
  assert.equal(capture.creations,creations);
  assert.equal(capture.map.getZoom(),16);
  assert([...d.doc.querySelectorAll(`[data-save="${id}"]`)].every(b=>b.getAttribute('aria-pressed')==='true'));
  d.close();
});
test("sorting keeps the map camera and explicit Fit all homes still fits the results", async () => {
  const capture=[],d=await boot({leaflet:mapStub(capture)});
  capture.map.setView([42,-87.7],16);const fits=capture.fits;
  const sort=d.doc.querySelector('#sort');sort.value='space';sort.dispatchEvent(new d.w.Event('change'));
  assert.equal(capture.fits,fits);
  assert.equal(capture.map.getZoom(),16);
  assert.deepEqual(Array.from(capture.map.getCenter()),[42,-87.7]);
  d.doc.querySelector('#map-fit').click();assert.equal(capture.fits,fits+1);
  d.close();
});
test("saving apartment notes preserves the desktop results scroll position", async () => {
  const d=await boot();d.doc.querySelector('.results-column').scrollTop=320;
  d.doc.querySelector('#results [data-detail]').click();
  d.doc.querySelector('#notes').value='Layout check';
  d.doc.querySelector('#record-form').dispatchEvent(new d.w.Event('submit',{bubbles:true,cancelable:true}));
  assert.equal(d.doc.querySelector('.results-column').scrollTop,320);
  d.close();
});

// --- Find → Compare → Decide ------------------------------------------------
// Reproduced before these were written: the comparison tray printed "2 of 3
// places selected" with no identity, no way to remove one, and the same
// sentence after a filter change had hidden both selections from every surface
// on the page; comparison could not be started from the apartment record or
// from the map's own list; and a saved home's board card said nothing about
// what was unresolved or what to do next.
test("the comparison tray names what it holds, removes one at a time, and marks a selection the filters hide", async () => {
  const d = await boot();
  const boxes = [...d.doc.querySelectorAll('#results [data-compare]')].slice(0, 2);
  const [first, second] = boxes.map((box) => box.dataset.compare);
  for (const box of boxes) box.click();
  const tray = () => d.doc.querySelector('#compare-tray');
  assert.match(tray().textContent, /2 of 3 selected/);
  const titles = [...tray().querySelectorAll('.tray-name strong')].map((el) => el.textContent);
  assert.equal(titles.length, 2);
  assert.deepEqual(titles, [first, second].map((id) => d.doc.querySelector(`#results [data-home="${id}"] h3`).textContent));
  assert.equal(tray().querySelectorAll('.tray-name small').length, 2);
  // A filter change hides both from every surface. Neither is dropped, both are
  // named and marked, each is reachable, and the saved preferences are unchanged.
  const sort = d.doc.querySelector('#sort');
  sort.value = 'space';
  sort.dispatchEvent(new d.w.Event('change'));
  const preferences = JSON.parse(d.w.localStorage.getItem('spicyhome.workspace.v1')).preferences;
  const search = d.doc.querySelector('#search');
  search.value = 'zzzz no such building';
  search.dispatchEvent(new d.w.Event('input'));
  await new Promise((resolve) => setTimeout(resolve, 260));
  assert.equal(d.doc.querySelectorAll('#results [data-home]').length, 0);
  assert.match(tray().textContent, /2 are outside your current filters/);
  assert.equal(tray().querySelectorAll('li.is-outside').length, 2);
  assert.equal(tray().querySelectorAll('li.is-outside [data-detail]').length, 2);
  const after = JSON.parse(d.w.localStorage.getItem('spicyhome.workspace.v1')).preferences;
  assert.deepEqual({ ...after, search: preferences.search }, preferences);
  tray().querySelector(`[data-compare-remove="${first}"]`).click();
  assert.match(tray().textContent, /1 of 3 selected/);
  assert.equal(tray().querySelectorAll('.tray-name strong').length, 1);
  assert.equal(tray().querySelector(`[data-compare-remove="${second}"]`).dataset.compareRemove, second);
  assert.equal(tray().querySelector(`[data-compare-remove="${first}"]`), null);
  d.close();
});
test("the apartment record and the map list start a comparison in the same selection", async () => {
  const d = await boot();
  const id = d.doc.querySelector('#results [data-home]').dataset.home;
  d.doc.querySelector(`#results [data-detail="${id}"]`).click();
  const inRecord = d.doc.querySelector(`#detail-content [data-compare="${id}"]`);
  assert(inRecord, 'the record carries the comparison control');
  assert(d.doc.querySelector(`#detail-content [data-save="${id}"]`), 'the record carries the save control');
  inRecord.click();
  assert.match(d.doc.querySelector('#detail-compare-status').textContent, /1 of 3 selected, including this place/);
  assert.match(d.doc.querySelector('#compare-tray').textContent, /1 of 3 selected/);
  d.doc.querySelector('#detail-content [data-close]').click();
  assert.equal(d.doc.querySelector(`#results [data-compare="${id}"]`).checked, true);
  // The map's own list is a way to a place, so it carries the same control.
  const fromMap = [...d.doc.querySelectorAll('#map-list [data-compare]')].find((box) => box.dataset.compare !== id);
  assert(fromMap, 'the map list carries the comparison control');
  fromMap.click();
  assert.match(d.doc.querySelector('#compare-tray').textContent, /2 of 3 selected/);
  assert.equal(d.doc.querySelector(`#results [data-compare="${fromMap.dataset.compare}"]`).checked, true);
  d.close();
});
test("a fourth selection names the three it would replace and replaces none of them", async () => {
  const d = await boot();
  const boxes = [...d.doc.querySelectorAll('#results [data-compare]')].slice(0, 4);
  for (const box of boxes.slice(0, 3)) box.click();
  const held = boxes.slice(0, 3).map((box) => d.doc.querySelector(`#results [data-home="${box.dataset.compare}"] h3`).textContent);
  boxes[3].click();
  assert.equal(boxes[3].checked, false);
  for (const title of held) assert.match(d.doc.querySelector('#toast').textContent, new RegExp(title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(d.doc.querySelector('#compare-tray').textContent, /3 of 3 selected/);
  assert.equal(d.doc.querySelectorAll('#compare-tray .tray-name strong').length, 3);
  d.close();
});
test("a card names the costs that are unquoted and opens the exact field for that apartment", async () => {
  const home = { ...seed.homes[0], id: 'gap-a', rent: 1900, parking: { status: 'unknown', monthly: null }, fees: { monthly: null } };
  const snapshot = { ...seed, homes: [home] };
  const d = await boot({ remote: snapshot, packaged: snapshot });
  const card = d.doc.querySelector('#results [data-home="gap-a"]');
  assert.match(card.querySelector('.cost-gap').textContent, /Unquoted: *parking/);
  assert.match(card.querySelector('.cost-gap .sc-unreported').textContent, /monthly fees/);
  const gap = card.querySelector('.cost-gap [data-studio-task]');
  assert.equal(gap.dataset.taskTarget, 'parkingCost');
  gap.click();
  assert.equal(d.doc.querySelector('#detail-dialog').open, true);
  assert.equal(d.doc.activeElement.id, 'parkingCost');
  // The record says how each figure was arrived at, and an absence is not a number.
  assert.match(d.doc.querySelector('#detail-costs').textContent, /Utilities/);
  assert.equal(d.doc.querySelectorAll('#detail-costs .sc-unreported').length >= 2, true);
  d.close();
});
test("a saved home carries its stage, its open question and one action that opens the exact field", async () => {
  const home = { ...seed.homes[0], id: 'board-a' };
  const snapshot = { ...seed, homes: [home] };
  const d = await boot({ remote: snapshot, packaged: snapshot,
    notebook: { version: 1, manual: [], events: [], preferences: {}, records: { 'board-a': { saved: true, status: 'contacted', snapshot: home } } } });
  d.doc.querySelector('[data-view="shortlist"]').click();
  const row = d.doc.querySelector('.saved-row');
  assert(row, 'a saved home carries its own decision row');
  assert.match(row.querySelector('.stage-chip').textContent, /contacted/);
  // The one step is the row's primary action, and the unresolved list marks
  // that same step rather than naming a different one beside it.
  const action = row.querySelector('.saved-actions .button');
  assert.equal(action.dataset.taskTarget, 'layoutReview');
  assert.match(action.textContent, /Check the layout/);
  const marked = row.querySelector('.saved-open li.is-next');
  assert.match(marked.textContent, /Layout not checked by you/);
  assert.equal(marked.querySelector('button').dataset.taskTarget, action.dataset.taskTarget);
  assert.equal(row.querySelectorAll('.saved-open li.is-next').length, 1, 'exactly one item is the next step');
  action.click();
  assert.equal(d.doc.querySelector('#detail-dialog').open, true);
  assert.equal(d.doc.activeElement.id, 'layoutReview');
  // Opening the field is not answering it: the step only changes once an answer
  // is saved, and then it is the next real gap, not the same sentence again.
  d.doc.querySelector('#layoutReview').value = 'one_bed';
  d.doc.querySelector('#record-form').dispatchEvent(new d.w.Event('submit', { bubbles: true, cancelable: true }));
  const movedRow = d.doc.querySelector('.saved-row');
  const moved = movedRow.querySelector('.saved-actions .button');
  assert.doesNotMatch(moved.textContent, /Check the layout/);
  assert.match(movedRow.querySelector('.saved-open li.is-next').textContent, /quote/i);
  assert.doesNotMatch(movedRow.querySelector('.saved-open').textContent, /Layout not checked by you/,
    'the answered question leaves the list');
  d.close();
});
test("the comparison shows a spread only where every place has the figure on the same basis", async () => {
  const base = { ...seed.homes[0], rent: 2000, sqft: 800 };
  const homes = [
    { ...base, id: 'spread-a', floor_plan: 'A' },
    { ...base, id: 'spread-b', floor_plan: 'B', rent: 2150, sqft: null },
  ];
  const snapshot = { ...seed, homes };
  const d = await boot({ remote: snapshot, packaged: snapshot });
  for (const box of d.doc.querySelectorAll('#results [data-compare]')) box.click();
  d.doc.querySelector('#open-compare').click();
  const spread = d.doc.querySelector('.compare-spread');
  assert.match(spread.textContent, /Base rent:.*\$150 between the lowest and the highest/);
  assert.match(spread.textContent, /Reported space:.*not comparable/);
  assert.match(spread.textContent, /no recorded figure/);
  assert.doesNotMatch(spread.textContent, /winner|best|wins/i);
  // Each column reaches its own costs, and the record replaces the sheet
  // rather than opening a second dialog over it.
  const breakdown = d.doc.querySelector(`.compare-identities [data-studio-task="spread-a"][data-task-target="detail-costs"]`);
  assert(breakdown, 'each compared place reaches its own cost breakdown');
  breakdown.click();
  assert.equal(d.doc.querySelector('#compare-dialog').open, false);
  assert.equal(d.doc.querySelector('#detail-dialog').open, true);
  d.close();
});
test("the explore deck captions its filter and its presentation modes and keeps both modes together", async () => {
  const d = await boot();
  const captions = [...d.doc.querySelectorAll('.explore-deck .sc-field--group')].map((group) => ({
    caption: group.querySelector('.sc-field__label').textContent,
    labelled: group.querySelector('[role="group"]').getAttribute('aria-labelledby'),
    id: group.querySelector('.sc-field__label').id,
  }));
  assert.deepEqual(captions.map((c) => c.caption), ['beds', 'view', 'rows']);
  for (const caption of captions) assert.equal(caption.labelled, caption.id);
  // A hard filter and a presentation mode are different kinds of control and do
  // not share a band; both presentation modes do share one.
  const band = (selector) => d.doc.querySelector(selector).closest('.explore-band');
  assert.notEqual(band('#bed-switch'), band('#surface-switch'));
  assert.equal(band('#surface-switch'), band('#density-switch'));
  assert.match(band('#bed-switch').querySelector('.band-label').textContent, /What you’re looking for/);
  assert.match(band('#surface-switch').querySelector('.band-label').textContent, /How you’re looking at them/);
  // The row control has nothing to act on where no list is drawn, and says so
  // by leaving rather than sitting there inert.
  assert.equal(d.doc.querySelector('#density-switch').closest('.explore-group').hidden, false);
  d.doc.querySelector('[data-surface="map"]').click();
  assert.equal(d.doc.querySelector('#density-switch').closest('.explore-group').hidden, true);
  assert.match(d.doc.querySelector('#surface-note').textContent, /recorded coordinates/);
  d.doc.querySelector('[data-surface="list"]').click();
  assert.equal(d.doc.querySelector('#density-switch').closest('.explore-group').hidden, false);
  d.close();
});
test("saving from inside an open record keeps the record open and the focus inside it", async () => {
  const d = await boot();
  d.doc.querySelector('[data-view="shortlist"]').click();
  d.doc.querySelector('[data-view="discover"]').click();
  const id = d.doc.querySelector('#results [data-home]').dataset.home;
  d.doc.querySelector('[data-surface="focus"]').click();
  d.doc.querySelector('#focus-surface [data-detail]').click();
  const inRecord = d.doc.querySelector('#detail-content [data-save]');
  inRecord.click();
  assert.equal(d.doc.querySelector('#detail-dialog').open, true, 'the record stays open');
  assert.equal(d.doc.activeElement, inRecord, 'the focus stays on the control that was pressed');
  assert.equal(inRecord.getAttribute('aria-pressed'), 'true');
  assert.match(d.doc.querySelector('[data-save-text]').textContent, /Saved to your shortlist/);
  assert.equal(JSON.parse(d.w.localStorage.getItem('spicyhome.workspace.v1')).records[inRecord.dataset.save].saved, true);
  assert(id);
  d.close();
});
test("the atlas names the plans that share a dot and reaches each of them", async () => {
  const base = { ...seed.homes[0], rent: 2000, sqft: 800 };
  const homes = [
    { ...base, id: 'dot-a', floor_plan: 'A' },
    { ...base, id: 'dot-b', floor_plan: 'B' },
    { ...base, id: 'dot-far', floor_plan: 'C', rent: 2900, sqft: 1400 },
  ];
  const snapshot = { ...seed, homes };
  const d = await boot({ remote: snapshot, packaged: snapshot });
  d.doc.querySelector('[data-surface="atlas"]').click();
  const nearby = d.doc.querySelector('.atlas-nearby');
  assert(nearby, 'a shared dot says so');
  assert.match(nearby.textContent, /One other plan sits on this dot/);
  const link = nearby.querySelector('[data-atlas-point]');
  assert.equal(link.dataset.atlasPoint, 'dot-b');
  link.click();
  assert.equal(d.doc.querySelector('#atlas-home').value, 'dot-b');
  assert.match(d.doc.querySelector('.atlas-selection').textContent, /Plan B/);
  // The far point shares nothing, so nothing is claimed.
  const picker = d.doc.querySelector('#atlas-home');
  picker.value = 'dot-far';
  picker.dispatchEvent(new d.w.Event('change'));
  assert.equal(d.doc.querySelector('.atlas-nearby'), null);
  d.close();
});

// --- the shared record comparison (design system v2.13.0) -------------------
test("a differing row is marked on its own label in both the matrix and the pair, and never on a value", async () => {
  const base = { ...seed.homes[0], rent: 2000, sqft: 800 };
  const homes = [
    { ...base, id: 'differs-a', floor_plan: 'A' },
    { ...base, id: 'differs-b', floor_plan: 'B', rent: 2200 },
  ];
  const snapshot = { ...seed, homes };
  const d = await boot({ remote: snapshot, packaged: snapshot });
  for (const box of d.doc.querySelectorAll('#results [data-compare]')) box.click();
  d.doc.querySelector('#open-compare').click();
  const marked = (selector) => [...d.doc.querySelectorAll(selector)].map((el) => el.textContent.replace(/same for both/, '').trim());
  const rowsMarked = marked('.matrix tbody tr[data-differs="true"] th[scope="row"]');
  const pairMarked = marked('.sc-compare-pair__measure[data-differs="true"]');
  assert(rowsMarked.includes('Base rent'), 'the rent the two do not share is marked');
  assert(!rowsMarked.includes('EV charging'), 'a fact they share is not marked');
  assert.deepEqual(pairMarked, rowsMarked, 'the pair marks exactly what the matrix marks');
  // A difference is never a winner: the attribute is on the row and the measure,
  // never on a cell or a value, and nothing claims "best".
  assert.equal(d.doc.querySelectorAll('.matrix td[data-differs]').length, 0);
  assert.equal(d.doc.querySelectorAll('.sc-compare-pair__value[data-differs]').length, 0);
  assert.equal(d.doc.querySelectorAll('.sc-compare-pair__value.is-best').length, 0);
  d.close();
});
test("folding the matching facts says how many went and never folds identity, price basis or evidence", async () => {
  const base = { ...seed.homes[0], rent: 2000, sqft: 800 };
  const homes = [
    { ...base, id: 'fold-a', floor_plan: 'A' },
    { ...base, id: 'fold-b', floor_plan: 'B', rent: 2200 },
  ];
  const snapshot = { ...seed, homes };
  const d = await boot({ remote: snapshot, packaged: snapshot });
  for (const box of d.doc.querySelectorAll('#results [data-compare]')) box.click();
  d.doc.querySelector('#open-compare').click();
  const toggle = d.doc.querySelector('#compare-differences');
  toggle.checked = true;
  toggle.dispatchEvent(new d.w.Event('change'));
  const labels = () => [...d.doc.querySelectorAll('.matrix tbody th[scope="row"]')].map((el) => el.textContent);
  // The design system's rule for a folded comparison, kept here.
  for (const kept of ['Plan / unit', 'Layout evidence', 'Base rent', 'Known monthly subtotal', 'Observed'])
    assert(labels().includes(kept), `${kept} is never folded`);
  assert(!labels().includes('EV charging'), 'a matching fact is folded');
  const said = d.doc.querySelector('.compare-folded').textContent;
  assert.match(said, /Folded because every place records the same answer/);
  assert.match(said, /EV charging/, 'the folded facts are named, not merely counted');
  assert.match(d.doc.querySelector('.compare-controls [role="status"]').textContent, /matching facts folded away/);
  d.close();
});
test("a third compared place is a choice in the pair's heads, not a truncation", async () => {
  const base = { ...seed.homes[0], rent: 2000, sqft: 800 };
  // C differs from A and B on its neighborhood, so a row the SHOWN two agree on
  // is a row the whole comparison does not: the one case that tells a
  // pair-scoped mark from a comparison-scoped one.
  const homes = ['a', 'b', 'c'].map((id, i) => ({ ...base, id: 'trio-' + id, floor_plan: id.toUpperCase(),
    rent: 2000 + i * 100, neighborhood: id === 'c' ? 'Trio Far Side' : 'Trio Shared Side' }));
  const snapshot = { ...seed, homes };
  const d = await boot({ remote: snapshot, packaged: snapshot });
  for (const box of d.doc.querySelectorAll('#results [data-compare]')) box.click();
  d.doc.querySelector('#open-compare').click();
  assert.equal(d.doc.querySelectorAll('.compare-identities article').length, 3, 'all three stay in the comparison');
  const heads = () => [...d.doc.querySelectorAll('.sc-compare-pair__head .sc-eyebrow')].map((el) => el.textContent);
  assert.equal(heads().length, 2, 'the pair shows two at a time');
  assert.match(heads()[0], /^A · /);
  assert.match(heads()[1], /^B · /);
  assert.match(d.doc.querySelector('.compare-pair .meta').textContent, /the third stays selected/);
  // Choosing C on the right leaves A on the left and keeps every value beside
  // the identity it belongs to.
  const right = d.doc.querySelector('[data-pair-side="1"]');
  right.value = '2';
  right.dispatchEvent(new d.w.Event('change'));
  assert.match(heads()[0], /^A · /);
  assert.match(heads()[1], /^C · /);
  assert.equal(d.doc.querySelectorAll('.compare-identities article').length, 3, 'choosing a side drops nobody');
  // Choosing the side the other one already holds swaps them rather than
  // showing one place against itself.
  const left = d.doc.querySelector('[data-pair-side="0"]');
  left.value = '2';
  left.dispatchEvent(new d.w.Event('change'));
  assert.match(heads()[0], /^C · /);
  assert.match(heads()[1], /^A · /);
  const rows = d.doc.querySelectorAll('.sc-compare-pair__values');
  assert(rows.length > 0);
  for (const row of rows) assert.equal(row.querySelectorAll('.sc-compare-pair__value').length, 2);
  // The mark answers the question the view in front of the reader is asking.
  // All three differ on base rent, so the matrix marks it; C and A differ too,
  // so the pair marks it. Neighborhood is the same for all three, so neither
  // marks it — and a row two of the three share is marked in the matrix, which
  // compares three, and not in the pair, which is comparing those two.
  const pairLabel = (label) => [...d.doc.querySelectorAll('.sc-compare-pair__measure')]
    .find((el) => el.textContent.startsWith(label));
  const rowLabel = (label) => [...d.doc.querySelectorAll('.matrix tbody th[scope="row"]')]
    .find((el) => el.textContent === label);
  assert.equal(rowLabel('Base rent').parentElement.dataset.differs, 'true');
  assert.equal(pairLabel('Base rent').dataset.differs, 'true');
  // Back to A and B, which share a neighborhood that C does not: the matrix
  // (comparing all three) marks that row and the pair (comparing those two)
  // does not.
  right.value = '1';
  right.dispatchEvent(new d.w.Event('change'));
  left.value = '0';
  left.dispatchEvent(new d.w.Event('change'));
  assert.match(heads()[0], /^A · /);
  assert.match(heads()[1], /^B · /);
  assert.equal(rowLabel('Neighborhood').parentElement.dataset.differs, 'true',
    'all three do not agree on the neighborhood');
  assert.equal(pairLabel('Neighborhood').dataset.differs, undefined,
    'the two in front of the reader do agree on it');
  assert.match(pairLabel('Neighborhood').textContent, /same for both/);
  assert.equal(pairLabel('Plan / unit').dataset.differs, 'true');
  // Swapping from a state where NEITHER side is the first place must keep the
  // place that was displaced, not fall back to whatever sorts first.
  left.value = '1';
  left.dispatchEvent(new d.w.Event('change'));
  assert.match(heads()[0], /^B · /);
  right.value = '2';
  right.dispatchEvent(new d.w.Event('change'));
  assert.match(heads()[0], /^B · /, 'the left keeps B');
  assert.match(heads()[1], /^C · /);
  left.value = '2';
  left.dispatchEvent(new d.w.Event('change'));
  assert.match(heads()[0], /^C · /);
  assert.match(heads()[1], /^B · /, 'the displaced place moves across, it is not replaced by another');
  d.close();
});
test("the vendored design snapshot is the released v2.13.0 and every hash matches the files on disk", async () => {
  const manifest = JSON.parse(fs.readFileSync(new URL("../dist/design-system/provenance.json", import.meta.url), "utf8"));
  assert.equal(manifest.version, "2.13.0");
  assert.equal(manifest.commit, "14a752dd0269bd6ebbb7080eb0d9e1922cd1ef2c");
  assert.equal(Object.keys(manifest.files).length, 22);
  const { createHash } = await import("node:crypto");
  for (const [name, expected] of Object.entries(manifest.files)) {
    const bytes = fs.readFileSync(new URL("../dist/design-system/" + name, import.meta.url));
    assert.equal(createHash("sha256").update(bytes).digest("hex"), expected, name);
  }
  // The page composes the shared comparison, so the sheet it vendors has to
  // define it: a snapshot rolled back below 2.13 would take the styling with it.
  const sheet = fs.readFileSync(new URL("../dist/design-system/sc.css", import.meta.url), "utf8");
  for (const needed of ['.sc-compare-pair', '.sc-compare-pair__heads', '.sc-compare-pair__measure',
                        '.sc-compare-pair__values', '.sc-compare-pair__value', 'tr[data-differs="true"]'])
    assert(sheet.includes(needed), `${needed} is defined by the vendored sheet`);
});

// --- Traceable source access and evidence continuity -------------------------
// One connected record set with two cities scanned on different dates, a
// curated plan whose only URL is a building floor-plan page, and a provider row
// the API supplies no listing URL for -- the three shapes this journey turns on.
function sourceFeed(at = "2026-09-15T13:28:27.690566Z") {
  const curated = {
    ...seed.homes[0], id: "curated-plan", kind: "building", title: "AMLI Lofts",
    address: "850 S. Clark St., Chicago, IL 60605", city: "Chicago", neighborhood: "South Loop",
    floor_plan: "A320", rent: 2663, lat: 41.8713, lng: -87.6306, observed_at: "2026-09-07",
    source_url: "https://www.amli.com/apartments/chicago/south-loop-apartments/amli-lofts/floorplans",
    sources: [
      { url: "https://www.amli.com/apartments/chicago/south-loop-apartments/amli-lofts", supports: "Address, neighborhood, A320 1BR/1BA", observed_at: "2026-09-07" },
      { url: "https://www.amli.com/apartments/chicago/south-loop-apartments/amli-lofts/floorplans", supports: "A320 floor-plan details" },
    ],
    parking: { status: "yes", monthly: 0 }, fees: { monthly: 120, one_time: null },
    charging: { status: "yes", note: "Building advertises electric car charging stations." },
    layout_status: "source_listed",
  };
  const listing = {
    id: "rentcast:6700-S-South-Constance-Ave,-Unit-1,-Chicago,-IL-60649", kind: "listing",
    title: "6700 S South Constance Ave", address: "6700 S South Constance Ave, Unit 1, Chicago, IL 60649",
    city: "Chicago", neighborhood: "Chicago · neighborhood unverified", unit_label: "Unit 1",
    rent: 1750, sqft: null, lat: 41.7731, lng: -87.5808, observed_at: at,
    bedrooms: 1, bathrooms: 1, layout_status: "provider_reported", layout_declaration: null,
    parking: { status: "unknown", note: "Not reported by the listing provider; confirm with leasing.", monthly: null },
    charging: { status: "unknown", note: "Not reported by the listing provider; confirm with leasing." },
    access: { status: "unknown", note: "Not reported by the listing provider; confirm with leasing." },
    fees: { monthly: null, one_time: null }, amenities: [], source_url: null, seen_in_latest: true,
    sources: [{ url: "https://developers.rentcast.io/reference/property-listings", supports: "RentCast listing ID; no direct listing URL supplied by the API." }],
    history: [{ date: at, rent: 1750 }],
  };
  const suburb = {
    ...listing, id: "rentcast:evanston-1", title: "1 Main St", address: "1 Main St, Unit 4, Evanston, IL 60201",
    city: "Evanston", neighborhood: "Evanston", unit_label: "Unit 4", rent: 1900,
    lat: 42.045, lng: -87.688, observed_at: "2026-09-08T13:29:28.215967Z",
    history: [{ date: "2026-09-08T13:29:28.215967Z", rent: 1900 }],
  };
  return {
    ...seed, mode: "connected", generated_at: at, charging_stations: [],
    city_context: { afdc_status: "Key not configured; no public charging dataset fetched." },
    homes: [curated, listing, suburb],
    provider: {
      configured: true, status: "success", last_success: at, coverage: "Latest area: Chicago.",
      returned: 500, total: 4484, truncated: true, query: { city: "Chicago" },
      area_scans: {
        Chicago: { last_success: at, returned: 500, total: 4484, truncated: true, accepted: 500, query: { city: "Chicago", bedrooms: "1|2" } },
        Evanston: { last_success: "2026-09-08T13:29:28.215967Z", returned: 176, total: 176, truncated: false, accepted: 176, query: { city: "Evanston", bedrooms: "1|2" } },
      },
    },
  };
}
const openRecord = (d, id) => { d.doc.querySelector(`[data-detail="${id}"]`).click(); return d.doc.querySelector("#detail-content"); };
const linkNamed = (box, pattern) => [...box.querySelectorAll("a")].find((a) => pattern.test(a.textContent));

test("a curated plan's source is labelled as a building/plan page and offers a labelled plan search", async () => {
  const feed = sourceFeed();
  const d = await boot({ remote: feed, packaged: feed });
  const box = openRecord(d, "curated-plan");
  const source = linkNamed(box, /Open the building \/ plan source/);
  assert.equal(source.getAttribute("href"), feed.homes[0].source_url);
  assert.equal(source.target, "_blank");
  assert.equal(source.rel, "noopener noreferrer");
  const fallback = linkNamed(box, /Search this building & plan/);
  assert.match(decodeURIComponent(fallback.href), /AMLI Lofts.*floor plan A320/);
  const sentence = box.querySelector(".source-access").textContent;
  assert.match(sentence, /plan A320/);
  assert.match(sentence, /not proof that an exact unit is available/);
  assert.match(sentence, /No exact listing URL is on record/);
  assert.match(sentence, /A search, not a found listing/);
  // Each reference keeps its own recorded date; the one without says so.
  const lines = [...box.querySelectorAll(".sourceline")].map((p) => p.textContent);
  assert.match(lines[0], /Observed Sep 7, 2026/);
  assert.match(lines[1], /Source date not recorded/);
  // Curated research is not a provider-query result.
  const dates = box.querySelector(".source-dates").textContent;
  assert.match(dates, /Observed for this home: Sep 7, 2026/);
  assert.match(dates, /No provider listing query stands behind this record/);
  assert.doesNotMatch(dates, /4,484/);
  d.close();
});

test("a provider row with no listing URL says so, labels its documentation, and offers an address search", async () => {
  const feed = sourceFeed();
  const id = feed.homes[1].id;
  const d = await boot({ remote: feed, packaged: feed });
  const box = openRecord(d, id);
  assert.equal(linkNamed(box, /Open the recorded listing/), undefined);
  // The provider ID never becomes a guessed public listing address.
  for (const a of box.querySelectorAll(".detail-links a"))
    assert(!decodeURIComponent(a.href).includes("rentcast:"), a.href);
  const fallback = linkNamed(box, /Search this address & unit/);
  assert.match(decodeURIComponent(fallback.href), /6700 S South Constance Ave, Unit 1, Chicago, IL 60649 apartment for rent/);
  assert.match(box.querySelector(".source-access").textContent, /It is not a rental listing for this home\./);
  assert.match(box.querySelector(".source-access").textContent, /No exact listing URL is on record/);
  assert.match(box.querySelector(".sourceline").textContent, /Provider documentation, not a listing for this home/);
  // Its own city's capped query, with the counts the record retained.
  const dates = box.querySelector(".source-dates").textContent;
  assert.match(dates, /Listing query for Chicago, Sep 15, 2026: returned 500 of 4,484 reported matches/);
  assert.match(dates, /Coverage of that query is incomplete/);
  d.close();
});

test("a suburb reads its own scan date, never Chicago's, and an unscanned area says it is not recorded", async () => {
  const feed = sourceFeed();
  const d = await boot({ remote: feed, packaged: feed });
  const evanston = openRecord(d, "rentcast:evanston-1").querySelector(".source-dates").textContent;
  assert.match(evanston, /Listing query for Evanston, Sep 8, 2026: returned 176 of 176 reported matches/);
  assert.match(evanston, /Complete for that recorded query\./);
  assert.doesNotMatch(evanston, /Chicago|4,484/);
  d.doc.querySelector("#detail-dialog").close();
  // An area the feed has never scanned borrows nothing.
  const unscanned = { ...feed, provider: { ...feed.provider, area_scans: { Evanston: feed.provider.area_scans.Evanston } } };
  const d2 = await boot({ remote: unscanned, packaged: unscanned });
  const chicago = openRecord(d2, feed.homes[1].id).querySelector(".source-dates").textContent;
  assert.match(chicago, /No listing query is recorded for Chicago\./);
  assert.doesNotMatch(chicago, /176/);
  d.close(); d2.close();
});

test("a home observed before its area's latest query keeps the two dates apart, in the right order", async () => {
  const feed = sourceFeed();
  feed.homes[1] = { ...feed.homes[1], observed_at: "2026-09-09T13:00:00Z", seen_in_latest: false };
  const d = await boot({ remote: feed, packaged: feed });
  const dates = openRecord(d, feed.homes[1].id).querySelector(".source-dates").textContent;
  assert.match(dates, /Observed for this home: Sep 9, 2026 — older than the recorded query below, which was not captured with it\./);
  assert.match(dates, /Listing query for Chicago, Sep 15, 2026/);
  d.close();
  // The other direction happens on a saved record whose frozen query predates
  // the observation it is filed beside; calling that one "older" is a lie.
  const later = sourceFeed();
  const notebook = { version: 1, manual: [], events: [], preferences: {}, savedSearches: [],
    records: { [later.homes[1].id]: { saved: true, snapshot: later.homes[1],
      scan: { basis: "provider_query", city: "Chicago", saved_at: "2026-09-16T00:00:00Z",
        observed_at: "2026-09-09T13:00:00Z", last_success: "2026-09-09T13:00:00Z",
        returned: 500, total: 4100, truncated: true } } } };
  const d2 = await boot({ remote: later, packaged: later, notebook });
  const reversed = openRecord(d2, later.homes[1].id).querySelector(".source-dates").textContent;
  assert.match(reversed, /Observed for this home: Sep 15, 2026 — later than the recorded query below, which was not captured with it\./);
  assert.doesNotMatch(reversed, /Sep 15, 2026 — older/);
  d2.close();
});

test("looking up a source changes no saved or unsaved personal note, quote or check", async () => {
  const feed = sourceFeed();
  const id = feed.homes[1].id;
  const notebook = { version: 1, records: { [id]: { saved: true, status: "toured", notes: "Landlord said the garage is full",
    rentOverride: 1699, quoteDate: "2026-09-12", layoutReview: "one_bed", tourChecks: { parking: true } } },
    manual: [], events: [], preferences: {} };
  const d = await boot({ remote: feed, packaged: feed, notebook });
  const box = openRecord(d, id);
  // A half-typed note, not yet saved, is part of this check.
  const notes = box.querySelector('[name="notes"]');
  notes.value = "half-typed: ask about the charger";
  const before = JSON.parse(d.w.localStorage.getItem("spicyhome.workspace.v1"));
  for (const a of [...box.querySelectorAll(".detail-links a"), ...box.querySelectorAll(".sourceline a")]) a.click();
  const after = JSON.parse(d.w.localStorage.getItem("spicyhome.workspace.v1"));
  assert.deepEqual(after.records[id], before.records[id]);
  assert.equal(after.records[id].notes, "Landlord said the garage is full");
  assert.equal(after.records[id].rentOverride, 1699);
  assert.equal(after.records[id].tourChecks.parking, true);
  assert.equal(box.querySelector('[name="notes"]').value, "half-typed: ask about the charger");
  // Returning lands on the same record, with the same plan identity.
  assert.equal(d.doc.querySelector("#detail-title").textContent, "6700 S South Constance Ave");
  assert.match(box.querySelector(".detail-sub").textContent, /Unit 1/);
  assert.equal(d.doc.querySelector("#detail-dialog").open, true);
  d.close();
});

test("a recorded $0 is an amount, unquoted fees are not, and charging is never treated as included", async () => {
  const feed = sourceFeed();
  const d = await boot({ remote: feed, packaged: feed });
  const curated = openRecord(d, "curated-plan");
  const rows = [...curated.querySelectorAll(".cost-table tr")].map((r) => r.textContent);
  assert.match(rows.find((r) => r.startsWith("Parking")), /\$0/);
  assert.match(rows.find((r) => r.startsWith("Resident EV charging")), /Never part of this subtotal/);
  assert.match(rows.find((r) => r.startsWith("Resident EV charging")), /not quoted/);
  // $2,663 + $0 parking + $120 fees, with utilities still unquoted.
  assert.match(rows.find((r) => r.startsWith("Known monthly subtotal")), /\$2,783\+/);
  assert.match(curated.querySelector(".range-note").textContent, /Still unquoted: utilities/);
  assert.doesNotMatch(curated.querySelector(".range-note").textContent, /Still unquoted:[^.]*parking/);
  assert.match(curated.querySelector(".range-note").textContent, /No resident EV charging cost is quoted, and none is included in this subtotal/);
  d.doc.querySelector("#detail-dialog").close();
  // The provider row has no parking and no fees at all: both stay unquoted.
  const listing = openRecord(d, feed.homes[1].id);
  assert.match(listing.querySelector(".range-note").textContent, /Still unquoted: parking, monthly fees, utilities/);
  assert.match(listing.querySelector(".range-note").textContent, /not an all-in total/);
  d.close();
});

test("building charging, no charging and unknown charging stay separate from an unavailable public context", async () => {
  const feed = sourceFeed();
  feed.homes[2] = { ...feed.homes[2], charging: { status: "no", note: "Leasing confirmed no resident charging." } };
  const d = await boot({ remote: feed, packaged: feed });
  const facts = (id) => [...openRecord(d, id).querySelectorAll(".fact-list li")].map((li) => li.textContent);
  const advertised = facts("curated-plan");
  assert(advertised.some((f) => /Building charging advertised\./.test(f)));
  assert(advertised.some((f) => /Nearby public charging: context unavailable/.test(f) && /not evidence that there are no chargers/.test(f)));
  // The source's own words are evidence and the status word is a reading of
  // them: printing both as separate facts said one thing twice.
  assert.equal(advertised.filter((f) => f.includes("Building advertises electric car charging stations.")).length, 1,
    "the source's charging note is printed once");
  assert(advertised.some((f) => /Building charging advertised\. Building advertises electric car charging stations\. An advertised charger is not a guaranteed/.test(f)));
  d.doc.querySelector("#detail-dialog").close();
  const unknown = facts(feed.homes[1].id);
  assert(unknown.some((f) => /Building charging unknown\. Not reported by the listing provider; confirm with leasing\. Unknown is not the same as none\./.test(f)));
  assert.equal(unknown.filter((f) => /^Building charging/.test(f)).length, 1, "one building-charging fact, not two voices");
  assert.equal(unknown.filter((f) => /^Nearby public charging/.test(f)).length, 1, "one public-charging fact");
  // The provider writes one unknown note for parking, charging and access, so
  // each fact has to say which one it is about.
  assert.equal(new Set(unknown).size, unknown.length, "no two facts read as the same sentence");
  assert(unknown.some((f) => /^Parking: Not reported by the listing provider/.test(f)));
  assert(unknown.some((f) => /^Step-free access: Not reported by the listing provider/.test(f)));
  d.doc.querySelector("#detail-dialog").close();
  const refused = facts("rentcast:evanston-1");
  assert(refused.some((f) => /No building charging\. Leasing confirmed no resident charging\./.test(f)));
  assert(refused.some((f) => /Nearby public charging: context unavailable/.test(f)),
    "a building that offers none still says the public context is unavailable, not that there is none");
  d.close();
  // A record whose source said nothing at all about charging gets the words
  // for that, rather than an empty status sentence.
  const silent = sourceFeed();
  silent.homes[1] = { ...silent.homes[1], charging: { status: "unknown" } };
  const quiet = await boot({ remote: silent, packaged: silent });
  assert([...openRecord(quiet, silent.homes[1].id).querySelectorAll(".fact-list li")]
    .some((li) => /Building charging unknown\. The source never established resident charging here\. Unknown is not the same as none\./.test(li.textContent)));
  quiet.close();
});

test("the comparison names how each source is reached and which query stands behind it", async () => {
  const feed = sourceFeed();
  const d = await boot({ remote: feed, packaged: feed });
  for (const id of ["curated-plan", feed.homes[1].id]) {
    const box = d.doc.querySelector(`#results [data-compare="${id}"]`);
    box.checked = true; box.dispatchEvent(new d.w.Event("change"));
  }
  d.doc.querySelector("#open-compare").click();
  const row = (label) => [...d.doc.querySelectorAll(".matrix tbody tr")]
    .find((r) => r.querySelector("th").textContent === label);
  assert.match(row("Source access").textContent, /Building \/ plan page · search available/);
  assert.match(row("Source access").textContent, /Provider documentation only · search available/);
  assert.match(row("Listing query for this area").textContent, /No provider query — official-source research/);
  assert.match(row("Listing query for this area").textContent, /Chicago · Sep 15, 2026 · 500 of 4,484 · incomplete/);
  assert.match(row("Building EV charging").textContent, /Advertised; access unverified/);
  assert.match(row("Nearby public charging").textContent, /Context unavailable — not evidence of no chargers/);
  d.close();
});

test("provenance is never folded away, even when every compared place records the same answer", async () => {
  // Two provider rows in one city agree on how their source is reached and on
  // the query behind them, so only the "always" rule can keep those rows.
  const feed = sourceFeed();
  const twin = { ...feed.homes[1], id: "rentcast:twin", title: "6702 S South Constance Ave",
    address: "6702 S South Constance Ave, Unit 2, Chicago, IL 60649", unit_label: "Unit 2", rent: 1800 };
  feed.homes = [feed.homes[1], twin];
  const d = await boot({ remote: feed, packaged: feed });
  for (const id of [feed.homes[0].id, twin.id]) {
    const box = d.doc.querySelector(`#results [data-compare="${id}"]`);
    box.checked = true; box.dispatchEvent(new d.w.Event("change"));
  }
  d.doc.querySelector("#open-compare").click();
  const row = (label) => [...d.doc.querySelectorAll(".matrix tbody tr")]
    .find((r) => r.querySelector("th").textContent === label);
  assert.equal(row("Source access").dataset.differs, undefined, "the two agree on how the source is reached");
  assert.equal(row("Listing query for this area").dataset.differs, undefined, "and on the query behind them");
  const toggle = d.doc.querySelector("#compare-differences");
  toggle.checked = true; toggle.dispatchEvent(new d.w.Event("change"));
  assert(row("Source access"), "source access survives Differences only");
  assert(row("Listing query for this area"), "the query behind the record survives Differences only");
  // A matching fact with no such rule does fold, so the check is not vacuous.
  assert.equal(row("Nearby public charging"), undefined);
  assert.match(d.doc.querySelector(".compare-folded").textContent, /how the source is reached and the query behind it are never folded/);
  d.close();
});

test("a saved home keeps the query it was read under, and a later scan is shown as separate context", async () => {
  const feed = sourceFeed();
  const id = feed.homes[1].id;
  const d = await boot({ remote: feed, packaged: feed });
  d.doc.querySelector(`[data-save="${id}"]`).click();
  const stored = JSON.parse(d.w.localStorage.getItem("spicyhome.workspace.v1")).records[id];
  assert.equal(stored.scan.basis, "provider_query");
  assert.equal(stored.scan.city, "Chicago");
  assert.equal(stored.scan.total, 4484);
  assert.equal(stored.scan.observed_at, feed.homes[1].observed_at);
  assert.equal(stored.scan.last_success, feed.homes[1].observed_at);
  const notebook = JSON.parse(d.w.localStorage.getItem("spicyhome.workspace.v1"));
  d.close();

  // The area is scanned again, more widely, and the saved record leaves the page.
  const later = sourceFeed("2026-09-22T13:00:00Z");
  later.homes = [later.homes[0], later.homes[2]];
  later.provider.area_scans.Chicago = { last_success: "2026-09-22T13:00:00Z", returned: 500, total: 5000, truncated: true, accepted: 500 };
  const d2 = await boot({ remote: later, packaged: later, notebook });
  d2.doc.querySelector('[data-view="shortlist"]').click();
  const box = openRecord(d2, id);
  const dates = [...box.querySelectorAll(".source-dates")].map((p) => p.textContent);
  assert.match(dates[0], /returned 500 of 4,484 reported matches/);
  assert.match(dates[0], /Recorded when you saved this home\./);
  assert.match(dates[0], /Observed for this home: Sep 15, 2026\. /, "the save froze the query it was read under, so the two dates match");
  assert.match(dates[1], /Current feed context, separate from your saved record/);
  assert.match(dates[1], /returned 500 of 5,000 reported matches/);
  // The two are never merged into one claim.
  assert.doesNotMatch(dates[0], /5,000/);
  d2.close();
});

test("a saved home outlives a changed, stale, empty and absent feed with its dated evidence intact", async () => {
  const feed = sourceFeed();
  const id = feed.homes[1].id;
  const first = await boot({ remote: feed, packaged: feed });
  first.doc.querySelector(`[data-save="${id}"]`).click();
  const box = openRecord(first, id);
  box.querySelector('[name="notes"]').value = "Garage is full; ask about the waitlist";
  box.querySelector("#record-form").dispatchEvent(new first.w.Event("submit"));
  const notebook = JSON.parse(first.w.localStorage.getItem("spicyhome.workspace.v1"));
  first.close();

  const gone = { ...sourceFeed("2026-09-22T13:00:00Z"), homes: [sourceFeed().homes[0]] };
  for (const [name, remote, packaged] of [
    ["changed", gone, gone],
    ["empty", { ...gone, homes: [] }, { ...gone, homes: [] }],
    ["absent", null, gone],
  ]) {
    const d = await boot({ remote, mirror: null, packaged, notebook });
    d.doc.querySelector('[data-view="shortlist"]').click();
    const saved = d.doc.querySelector(`[data-home="${id}"]`);
    assert(saved, `the saved home is reachable with an ${name} feed`);
    assert.match(saved.textContent, /Archived notebook entry · absent from the current feed/);
    for (const stated of [saved.querySelector(".saved-evidence"), saved.querySelector(".saved-chips"), saved.querySelector(".saved-head")])
      assert.doesNotMatch(stated.textContent, /leased|no longer available|unavailable/i);
    assert.match(saved.querySelector(".saved-open").textContent,
      /Absent from the latest area scan.*not proof it is leased/s);
    const detail = openRecord(d, id);
    assert.match(detail.querySelector(".detail-sub").textContent, /Unit 1/);
    assert.match(detail.querySelector(".source-dates").textContent, /Observed for this home: Sep 15, 2026/);
    assert.match(detail.querySelector(".source-dates").textContent, /returned 500 of 4,484 reported matches/);
    assert.match(detail.querySelector(".sourceline").textContent, /Provider documentation, not a listing/);
    assert(linkNamed(detail, /Search this address & unit/), "the labelled search still reaches it");
    assert.equal(detail.querySelector('[name="notes"]').value, "Garage is full; ask about the waitlist");
    // An archived record is never re-stamped with today's query -- not by
    // reading it, and not by saving something else about it either.
    const stamp = () => JSON.parse(d.w.localStorage.getItem("spicyhome.workspace.v1")).records[id].scan;
    assert.equal(stamp().total, 4484);
    assert.equal(stamp().last_success, "2026-09-15T13:28:27.690566Z");
    detail.querySelector("#record-form").dispatchEvent(new d.w.Event("submit"));
    assert.equal(stamp().total, 4484, `saving notes must not restamp the ${name} feed's query`);
    d.doc.querySelector("#detail-dialog").close();
    const stage = d.doc.querySelector(`[data-stage="${id}"]`);
    stage.value = "contacted";
    stage.dispatchEvent(new d.w.Event("change"));
    assert.equal(stamp().total, 4484, `moving the stage must not restamp the ${name} feed's query`);
    assert.equal(stamp().last_success, "2026-09-15T13:28:27.690566Z");
    d.close();
  }
});

test("saved query context travels through export and import, and an invalid one is refused before anything changes", async () => {
  const feed = sourceFeed();
  const id = feed.homes[1].id;
  const d = await boot({ remote: feed, packaged: feed });
  d.doc.querySelector(`[data-save="${id}"]`).click();
  let exported = null;
  d.w.Blob = class { constructor(parts) { exported = parts[0]; } };
  d.w.HTMLAnchorElement.prototype.click = () => {};
  d.doc.querySelector('[data-view="setup"]').click();
  d.doc.querySelector("#export-notebook").click();
  const backup = JSON.parse(exported);
  assert.equal(backup.records[id].scan.total, 4484);
  assert.equal(backup.records[id].scan.basis, "provider_query");
  d.close();

  // A second browser imports it through the notebook's own import path.
  const fresh = await boot({ remote: feed, packaged: feed });
  await fresh.doc.querySelector("#import-file").onchange(
    { target: { files: [{ size: exported.length, text: async () => exported }], value: "" } });
  const landed = JSON.parse(fresh.w.localStorage.getItem("spicyhome.workspace.v1")).records[id];
  assert.equal(landed.scan.total, 4484);
  assert.equal(landed.scan.city, "Chicago");
  // A backup whose context is not a recorded shape is refused whole, before
  // anything in the notebook is replaced.
  const before = fresh.w.localStorage.getItem("spicyhome.workspace.v1");
  const bad = JSON.stringify({ ...backup, records: { ...backup.records,
    [id]: { ...backup.records[id], notes: "would have overwritten", scan: { basis: "guessed", saved_at: "2026-09-15T00:00:00Z" } } } });
  await fresh.doc.querySelector("#import-file").onchange(
    { target: { files: [{ size: bad.length, text: async () => bad }], value: "" } });
  assert.equal(fresh.w.localStorage.getItem("spicyhome.workspace.v1"), before);
  assert.match(fresh.doc.querySelector("#toast").textContent, /invalid saved source context/);
  fresh.close();
});
test("a record with no coordinates is still inspectable and still reaches its source", async () => {
  const feed = sourceFeed();
  feed.homes[1] = { ...feed.homes[1], lat: null, lng: null };
  const d = await boot({ remote: feed, packaged: feed });
  const box = openRecord(d, feed.homes[1].id);
  assert.equal(d.doc.querySelector("#detail-title").textContent, "6700 S South Constance Ave");
  assert(linkNamed(box, /Search this address & unit/));
  assert(![...box.querySelectorAll(".fact-list li")].some((li) => /within 0.5 straight-line miles/.test(li.textContent)),
    "no public station is measured against a place with no coordinates");
  assert([...box.querySelectorAll(".fact-list li")].some((li) => /no coordinates, so no public station can be measured|context unavailable/.test(li.textContent)));
  d.close();
});

test("every card says what its source link actually reaches", async () => {
  const feed = sourceFeed();
  const d = await boot({ remote: feed, packaged: feed });
  const stamp = (id) => d.doc.querySelector(`[data-home="${id}"] .evidence-stamp`).textContent;
  assert.match(stamp("curated-plan"), /Building research · Sep 7, 2026 · Building \/ plan page · search available/);
  assert.match(stamp(feed.homes[1].id), /Listing snapshot · Sep 15, 2026 · Provider documentation only · search available/);
  d.close();
});

// --- The saved-home decision desk --------------------------------------------
// One curated plan and two provider rows, with the states a returning reader
// actually has: a recorded $0, an unquoted fee, three layout evidences, three
// charging answers, two observation dates and one record the feed has dropped.
function deskFeed(at = "2026-09-15T13:28:27.690566Z") {
  const curated = {
    ...seed.homes[0], id: "desk-curated", kind: "building", title: "AMLI Lofts",
    address: "850 S. Clark St., Chicago, IL 60605", city: "Chicago", neighborhood: "South Loop",
    floor_plan: "A320", rent: 2663, sqft: 745, lat: 41.8713, lng: -87.6306, observed_at: "2026-09-07",
    source_url: "https://www.amli.com/apartments/chicago/south-loop-apartments/amli-lofts/floorplans",
    sources: [{ url: "https://www.amli.com/apartments/chicago/south-loop-apartments/amli-lofts", supports: "A320", observed_at: "2026-09-07" }],
    parking: { status: "yes", monthly: 0 }, fees: { monthly: 120, one_time: null },
    charging: { status: "yes", note: "Building advertises electric car charging stations." },
    layout_status: "source_listed",
  };
  const provider = {
    id: "desk-provider", kind: "listing", title: "6700 S South Constance Ave",
    address: "6700 S South Constance Ave, Unit 1, Chicago, IL 60649", city: "Chicago",
    neighborhood: "Chicago · neighborhood unverified", unit_label: "Unit 1",
    rent: 1750, sqft: null, lat: 41.7731, lng: -87.5808, observed_at: at,
    bedrooms: 1, bathrooms: 1, layout_status: "provider_reported", layout_declaration: null,
    parking: { status: "unknown", note: "Not reported by the listing provider; confirm with leasing.", monthly: null },
    charging: { status: "unknown", note: "Not reported by the listing provider; confirm with leasing." },
    access: { status: "unknown" }, fees: { monthly: null, one_time: null }, amenities: [],
    source_url: null, seen_in_latest: true, history: [{ date: at, rent: 1750 }],
    sources: [{ url: "https://developers.rentcast.io/reference/property-listings", supports: "RentCast listing ID" }],
  };
  const suburb = { ...provider, id: "desk-suburb", title: "1 Main St", address: "1 Main St, Unit 4, Evanston, IL 60201",
    city: "Evanston", neighborhood: "Evanston", unit_label: "Unit 4", rent: 1900,
    lat: 42.045, lng: -87.688, observed_at: "2026-09-08T13:29:28.215967Z",
    charging: { status: "no", note: "Leasing confirmed no resident charging." },
    history: [{ date: "2026-09-08T13:29:28.215967Z", rent: 1900 }] };
  return { ...seed, mode: "connected", generated_at: at, charging_stations: [],
    city_context: { afdc_status: "Key not configured; no public charging dataset fetched." },
    homes: [curated, provider, suburb],
    provider: { configured: true, status: "success", last_success: at, coverage: "Latest area: Chicago.",
      returned: 500, total: 4484, truncated: true, query: { city: "Chicago" },
      area_scans: { Chicago: { last_success: at, returned: 500, total: 4484, truncated: true, accepted: 500 },
        Evanston: { last_success: "2026-09-08T13:29:28.215967Z", returned: 176, total: 176, truncated: false, accepted: 176 } } } };
}
const deskNotebook = (records) => ({ version: 1, manual: [], events: [], preferences: {}, savedSearches: [], records });
const rowFor = (d, id) => [...d.doc.querySelectorAll(".saved-row")].find((r) => r.dataset.home === id);
const openDesk = async (options) => { const d = await boot(options); d.doc.querySelector('[data-view="shortlist"]').click(); return d; };

test("a saved provider home and a saved curated plan are both readable on the desk without reopening a discovery card", async () => {
  const feed = deskFeed();
  const d = await openDesk({ remote: feed, packaged: feed, notebook: deskNotebook({
    "desk-curated": { saved: true, status: "shortlisted" },
    "desk-provider": { saved: true, status: "researching" } }) });
  const curated = rowFor(d, "desk-curated"), provider = rowFor(d, "desk-provider");
  // Exact identity, on the row rather than behind a press.
  assert.match(curated.querySelector(".saved-identity").textContent, /AMLI Lofts/);
  assert.match(curated.querySelector(".saved-identity").textContent, /Plan A320/);
  assert.match(provider.querySelector(".saved-identity").textContent, /Unit 1/);
  // Money, on its recorded basis.
  assert.match(curated.querySelector(".saved-money").textContent, /\$2,663/);
  assert.match(curated.querySelector(".saved-money").textContent, /Base rent from/);
  assert.match(provider.querySelector(".saved-money").textContent, /Provider asking rent/);
  // A recorded $0 parking is an amount; the subtotal carries it and says it is
  // still not an all-in cost.
  assert.match(curated.querySelector(".saved-facts").textContent, /\$2,783\+/,
    "base rent + a recorded $0 parking + $120 fees, still marked incomplete");
  assert.match(curated.querySelector(".saved-cues").textContent, /^Unquoted: utilities$/,
    "a recorded $0 is a known amount and is never listed as unquoted");
  assert.match(provider.querySelector(".saved-cues").textContent, /Unquoted: parking · monthly fees · utilities/);
  // Layout evidence, parking and resident EV each say which kind they are.
  assert.match(curated.querySelector(".saved-facts").textContent, /Source lists 1 bed · 1 bath/);
  assert.match(provider.querySelector(".saved-facts").textContent, /reported — not checked/);
  assert.match(curated.querySelector(".saved-chips").textContent, /Parking advertised/);
  assert.match(curated.querySelector(".saved-chips").textContent, /EV advertised/);
  assert.match(provider.querySelector(".saved-chips").textContent, /Parking unverified/);
  assert.match(provider.querySelector(".saved-chips").textContent, /EV unverified/);
  // A compact freshness and source cue, not the record's whole provenance.
  assert.match(curated.querySelector(".saved-evidence").textContent, /Building research · Sep 7, 2026 · Building \/ plan page/);
  assert.doesNotMatch(curated.textContent, /Listing query for Chicago/);
  assert.doesNotMatch(curated.textContent, /reported matches/);
  // The full record is one press away and carries the provenance.
  curated.querySelector("[data-detail]").click();
  assert.match(d.doc.querySelector("#detail-sources").textContent, /Observed for this home/);
  d.close();
});

test("the unresolved list is folded, counted, and each item opens the exact field that settles it", async () => {
  const feed = deskFeed();
  const d = await openDesk({ remote: feed, packaged: feed,
    notebook: deskNotebook({ "desk-provider": { saved: true, status: "researching" } }) });
  const row = rowFor(d, "desk-provider");
  const disclosure = row.querySelector(".saved-open");
  assert.equal(disclosure.open, false, "a shortlist reads as apartments, not as a task list");
  const count = Number(disclosure.querySelector("summary span").textContent);
  assert.equal(count, disclosure.querySelectorAll("li").length);
  assert(count > 0);
  assert.match(disclosure.querySelector("p").textContent, /Opening is not answering/);
  // The marked item is the same step the row's primary button performs.
  const marked = disclosure.querySelector("li.is-next button");
  assert.equal(marked.dataset.taskTarget, row.querySelector(".saved-actions .button").dataset.taskTarget);
  // Opening a cost gap lands on that exact notebook field, and saving an
  // amount — a recorded $0 — clears that item and no other.
  const fee = [...disclosure.querySelectorAll("li button")].find((b) => /Monthly fees not quoted/.test(b.textContent));
  assert.equal(fee.dataset.taskTarget, "monthlyFees");
  fee.click();
  assert.equal(d.doc.querySelector("#detail-dialog").open, true);
  assert.equal(d.doc.activeElement.id, "monthlyFees");
  d.doc.querySelector("#monthlyFees").value = "0";
  d.doc.querySelector("#record-form").dispatchEvent(new d.w.Event("submit", { bubbles: true, cancelable: true }));
  d.doc.querySelector("#detail-dialog").close();
  const after = rowFor(d, "desk-provider");
  assert.doesNotMatch(after.querySelector(".saved-open").textContent, /Monthly fees not quoted/);
  assert.match(after.querySelector(".saved-cues").textContent, /Unquoted: parking · utilities/);
  assert.match(after.querySelector(".saved-open").textContent, /Parking not quoted/);
  // Returning keeps the shortlist, not the discovery view.
  assert.match(d.doc.querySelector("#view-title").textContent, /second look/);
  d.close();
});

test("the Final Three says what separates the finalists, and empty capacity names a contender to pin", async () => {
  const feed = deskFeed();
  const d = await openDesk({ remote: feed, packaged: feed, notebook: deskNotebook({
    "desk-curated": { saved: true, status: "shortlisted" },
    "desk-provider": { saved: true, status: "contacted" },
    "desk-suburb": { saved: true, status: "researching" } }) });
  // Nothing pinned: a prompt that names a contender, not three empty slots.
  assert(d.doc.querySelector(".finalist-shelf.is-empty"));
  assert.equal(d.doc.querySelectorAll(".finalist-grid article").length, 0);
  const invite = d.doc.querySelector(".finalist-shelf [data-finalist]");
  assert(invite, "the empty shelf offers a contender to pin");
  invite.click();
  assert.equal(d.doc.querySelectorAll(".finalist-grid article").length, 1);
  assert.match(d.doc.querySelector(".finalist-foot .meta").textContent, /Room for 2 more/);
  for (const id of ["desk-curated", "desk-provider", "desk-suburb"]) {
    const pin = rowFor(d, id).querySelector("[data-finalist]");
    if (pin.getAttribute("aria-pressed") !== "true") pin.click();
  }
  assert.equal(d.doc.querySelectorAll(".finalist-grid article").length, 3);
  assert.match(d.doc.querySelector(".finalist-foot .meta").textContent, /Three pinned/);
  // Each finalist is tellable apart before the comparison opens.
  const cards = [...d.doc.querySelectorAll(".finalist-grid article")];
  for (const card of cards) {
    assert.match(card.querySelector(".finalist-rent").textContent, /\$[\d,]+/);
    assert.match(card.querySelector(".finalist-facts").textContent, /Known subtotal/);
    assert.match(card.querySelector(".finalist-facts").textContent, /Unresolved/);
  }
  // The difference line uses the comparison's own arithmetic and names what is
  // not comparable rather than substituting anything for it. Nothing is ranked.
  const difference = d.doc.querySelector(".finalist-difference").textContent;
  assert.match(difference, /Base rent: \$913 between the lowest and the highest/);
  assert.match(difference, /Reported space: not comparable — 6700 S South Constance Ave, 1 Main St have no recorded figure/);
  assert.match(difference, /Nothing here is ranked/);
  assert.doesNotMatch(difference, /best|winner|score|recommend/i);
  // A pinned home says so on its own row too, so the contenders list shows
  // which three are the finalists without scrolling back to the shelf.
  for (const id of ["desk-curated", "desk-provider", "desk-suburb"]) {
    const row = rowFor(d, id);
    assert(row.classList.contains("is-finalist"), id);
    assert.match(row.querySelector(".saved-chips").textContent, /Final Three/, id);
  }
  rowFor(d, "desk-suburb").querySelector("[data-finalist]").click();
  const unpinned = rowFor(d, "desk-suburb");
  assert.equal(unpinned.classList.contains("is-finalist"), false);
  assert.doesNotMatch(unpinned.querySelector(".saved-chips").textContent, /Final Three/);
  unpinned.querySelector("[data-finalist]").click();
  // The full comparison stays the authoritative one, over the pinned set.
  d.doc.querySelector("#compare-finalists").click();
  assert.equal(d.doc.querySelectorAll(".compare-identities article").length, 3);
  d.close();
});

test("ruling a home out demotes it without losing it, and it comes back in one press", async () => {
  const feed = deskFeed();
  const d = await openDesk({ remote: feed, packaged: feed, notebook: deskNotebook({
    "desk-curated": { saved: true, status: "shortlisted" },
    "desk-provider": { saved: true, status: "researching", notes: "Too far from the train." } }) });
  assert.equal(d.doc.querySelectorAll(".saved-section .saved-row").length, 2);
  assert.equal(d.doc.querySelector(".saved-ruled"), null);
  const stage = rowFor(d, "desk-provider").querySelector("[data-stage]");
  stage.value = "ruled out";
  stage.dispatchEvent(new d.w.Event("change"));
  // It leaves the reading order of the contenders and sits behind its own
  // folded disclosure, with every note kept.
  assert.equal(d.doc.querySelectorAll(".saved-section .saved-row").length, 1);
  const ruledOut = d.doc.querySelector(".saved-ruled");
  assert.equal(ruledOut.open, true, "the reader sees where the home they just moved went");
  d.doc.querySelector('[data-view="discover"]').click();
  d.doc.querySelector('[data-view="shortlist"]').click();
  assert.equal(d.doc.querySelector(".saved-ruled").open, false, "on a later visit it is folded away again");
  assert.match(d.doc.querySelector(".saved-ruled summary").textContent, /Ruled out\s*1/);
  const row = d.doc.querySelector(".saved-ruled .saved-row");
  assert.equal(row.dataset.home, "desk-provider");
  assert(row.classList.contains("is-ruled"));
  assert.equal(JSON.parse(d.w.localStorage.getItem("spicyhome.workspace.v1")).records["desk-provider"].notes, "Too far from the train.");
  // Back in one press, with the note still there.
  const back = row.querySelector("[data-stage]");
  back.value = "researching";
  back.dispatchEvent(new d.w.Event("change"));
  assert.equal(d.doc.querySelectorAll(".saved-section .saved-row").length, 2);
  assert.equal(d.doc.querySelector(".saved-ruled"), null);
  assert.equal(JSON.parse(d.w.localStorage.getItem("spicyhome.workspace.v1")).records["desk-provider"].notes, "Too far from the train.");
  d.close();
});

test("a ruled-out home is never pinned into the Final Three and never counted as a contender", async () => {
  const feed = deskFeed();
  const d = await openDesk({ remote: feed, packaged: feed, notebook: deskNotebook({
    "desk-curated": { saved: true, status: "shortlisted" },
    "desk-provider": { saved: true, status: "ruled out", finalist: true } }) });
  assert.equal(d.doc.querySelectorAll(".finalist-grid article").length, 0,
    "a home the reader ruled out is not one of their strongest maybes");
  assert.match(d.doc.querySelector(".saved-section__head").textContent, /In contention\s*1/);
  assert.equal(d.doc.querySelector(".saved-ruled .saved-row").dataset.home, "desk-provider");
  d.close();
});

test("a saved home the refreshed feed no longer carries keeps its row, its evidence and its notes", async () => {
  const feed = deskFeed();
  const first = await boot({ remote: feed, packaged: feed });
  first.doc.querySelector('[data-save="desk-provider"]').click();
  const notebook = JSON.parse(first.w.localStorage.getItem("spicyhome.workspace.v1"));
  notebook.records["desk-provider"].notes = "Ask about the garage waitlist";
  first.close();
  const later = deskFeed("2026-09-22T13:00:00Z");
  later.homes = later.homes.filter((h) => h.id !== "desk-provider");
  const d = await openDesk({ remote: later, packaged: later, notebook });
  const row = rowFor(d, "desk-provider");
  assert(row, "the saved home is still on the desk");
  assert.match(row.querySelector(".saved-identity").textContent, /Unit 1/);
  assert.match(row.querySelector(".saved-evidence").textContent, /Archived notebook entry · absent from the current feed/);
  for (const stated of [row.querySelector(".saved-evidence"), row.querySelector(".saved-chips"), row.querySelector(".saved-head")])
    assert.doesNotMatch(stated.textContent, /leased|no longer available|unavailable/i);
  assert.match(row.querySelector(".saved-open").textContent, /Absent from the latest area scan/);
  // Its own dated evidence is still in the record it came from.
  row.querySelector("[data-detail]").click();
  assert.match(d.doc.querySelector(".source-dates").textContent, /returned 500 of 4,484 reported matches/);
  assert.equal(d.doc.querySelector('[name="notes"]').value, "Ask about the garage waitlist");
  d.close();
});

test("looking up a saved home's source from the desk changes no note, check or evidence", async () => {
  const feed = deskFeed();
  const notebook = deskNotebook({ "desk-curated": { saved: true, status: "toured", notes: "Loved the light",
    rentOverride: 2600, quoteDate: "2026-09-14", layoutReview: "one_bed", tourChecks: { light: true } } });
  const d = await openDesk({ remote: feed, packaged: feed, notebook });
  const before = d.w.localStorage.getItem("spicyhome.workspace.v1");
  rowFor(d, "desk-curated").querySelector("[data-detail]").click();
  const box = d.doc.querySelector("#detail-content");
  const notes = box.querySelector('[name="notes"]');
  notes.value = "half-typed: ask about the garage";
  for (const a of box.querySelectorAll(".detail-links a, .sourceline a")) a.click();
  assert.equal(d.w.localStorage.getItem("spicyhome.workspace.v1"), before);
  assert.equal(box.querySelector('[name="notes"]').value, "half-typed: ask about the garage");
  d.close();
});

test("ruling a home out leaves the focus on its own stage control, not on the body", async () => {
  const feed = deskFeed();
  const d = await openDesk({ remote: feed, packaged: feed, notebook: deskNotebook({
    "desk-curated": { saved: true, status: "shortlisted" },
    "desk-provider": { saved: true, status: "researching" } }) });
  const stage = rowFor(d, "desk-provider").querySelector("[data-stage]");
  stage.focus();
  stage.value = "ruled out";
  stage.dispatchEvent(new d.w.Event("change"));
  // The row moved into the ruled-out disclosure, which is closed, and the
  // control sits inside the row's own More disclosure inside that: a control
  // in a closed details is not focusable, so every ancestor has to open.
  const moved = d.doc.querySelector(".saved-ruled [data-stage]");
  assert.equal(d.doc.activeElement, moved, "focus follows the home the reader just moved");
  for (let el = moved.parentElement; el; el = el.parentElement)
    if (el.tagName === "DETAILS") assert.equal(el.open, true, "every disclosure around it is open");
  d.close();
});

// --- The tour-day walkthrough ------------------------------------------------
const openTour = (d, id) => {
  const row = [...d.doc.querySelectorAll(".saved-row")].find((r) => r.dataset.home === id);
  row.querySelector(".saved-more").open = true;
  row.querySelector("[data-tour]").click();
  return d.doc.querySelector("#tour-companion");
};
const checkNamed = (tour, pattern) => [...tour.querySelectorAll(".tour-check")].find((l) => pattern.test(l.textContent));

test("the walkthrough names the exact unit, its tour date and what is left, at the point of use", async () => {
  const feed = deskFeed();
  const d = await openDesk({ remote: feed, packaged: feed, notebook: deskNotebook({
    "desk-provider": { saved: true, status: "tour scheduled", tourDate: "2026-09-20T10:00",
      tourChecks: { layout: true, light: true } } }) });
  const tour = openTour(d, "desk-provider");
  assert.equal(tour.open, true);
  const head = tour.querySelector(".tour-head").textContent;
  assert.match(head, /6700 S South Constance Ave/);
  assert.match(head, /Unit 1/);
  assert.match(head, /6700 S South Constance Ave, Unit 1, Chicago, IL 60649/);
  assert.match(head, /Sep 20, 2026/);
  assert.match(head, /10:00 · Chicago/);
  assert.match(d.doc.querySelector("#tour-draft-count").textContent, /2\/8 reviewed · 6 left/);
  // Directions are built from the recorded address and nothing else.
  const directions = [...tour.querySelectorAll("a")].find((a) => /Directions/.test(a.textContent));
  assert.equal(decodeURIComponent(directions.href),
    "https://www.google.com/maps/dir/?api=1&destination=6700 S South Constance Ave, Unit 1, Chicago, IL 60649");
  assert.equal(directions.target, "_blank");
  assert.equal(directions.rel, "noopener noreferrer");
  // The checks sit directly above the fields that record what they found.
  const form = d.doc.querySelector("#record-form");
  assert.equal(tour.nextElementSibling, form, "the walkthrough runs straight into the notebook fields");
  assert.equal(tour.parentElement, form.parentElement);
  d.close();
});

test("each check carries what the record already knows, and a $0 amount is not an unknown one", async () => {
  const feed = deskFeed();
  const d = await openDesk({ remote: feed, packaged: feed, notebook: deskNotebook({
    "desk-curated": { saved: true, status: "tour scheduled" },
    "desk-provider": { saved: true, status: "tour scheduled" },
    "desk-suburb": { saved: true, status: "tour scheduled" } }) });
  // Curated: parking advertised with a recorded $0, charging advertised,
  // a source-listed layout, and fees on record.
  const curated = openTour(d, "desk-curated");
  assert.match(checkNamed(curated, /Walk the exact layout/).textContent, /On record: Source lists 1 bed · 1 bath\./);
  const curatedParking = checkNamed(curated, /Walk the parking route/).textContent;
  assert.match(curatedParking, /Parking is advertised here\./);
  assert.match(curatedParking, /Monthly cost on record: \$0\./, "a recorded $0 is an amount, not an unknown");
  assert.match(checkNamed(curated, /Inspect the charger/).textContent, /Building charging advertised\./);
  assert.match(checkNamed(curated, /Review the full quote/).textContent, /Known monthly subtotal on record: \$2,783 — still unquoted: utilities\./);
  d.doc.querySelector("#detail-dialog").close();
  // Provider: parking never established and never quoted — two separate facts.
  const provider = openTour(d, "desk-provider");
  const providerParking = checkNamed(provider, /Walk the parking route/).textContent;
  assert.match(providerParking, /The source never established whether there is parking\./);
  assert.match(providerParking, /Monthly cost on record: not quoted\./);
  assert.match(checkNamed(provider, /Walk the exact layout/).textContent, /On record: 1 bed · 1 bath reported — not checked\./);
  const providerCharging = checkNamed(provider, /Inspect the charger/).textContent;
  assert.match(providerCharging, /Building charging unknown\./);
  assert.match(providerCharging, /cost is quoted by no one here and is not in the subtotal/);
  assert.match(providerCharging, /No public charging dataset is loaded, which is not evidence that there are none nearby\./);
  d.doc.querySelector("#detail-dialog").close();
  // Suburb: the source says there is no resident charging. Still not a claim
  // about public stations, and still not a cost.
  const suburb = openTour(d, "desk-suburb");
  assert.match(checkNamed(suburb, /Inspect the charger/).textContent, /No building charging\./);
  assert.doesNotMatch(checkNamed(suburb, /Inspect the charger/).textContent, /free|included/i);
  // A check the record holds nothing about says nothing rather than inventing.
  for (const pattern of [/Check the light/, /Listen with windows closed/, /Try the everyday route/, /Test the basics/])
    assert.equal(checkNamed(suburb, pattern).querySelector(".tour-known"), null, String(pattern));
  d.close();
});

test("a walked tour records its answers and the decision desk shows them", async () => {
  const feed = deskFeed();
  const d = await openDesk({ remote: feed, packaged: feed,
    notebook: deskNotebook({ "desk-provider": { saved: true, status: "tour scheduled", tourDate: "2026-09-20T10:00" } }) });
  const before = [...rowFor(d, "desk-provider").querySelectorAll(".saved-open li")].map((li) => li.textContent);
  assert(before.some((q) => /Layout not checked by you/.test(q)));
  assert(before.some((q) => /Parking not quoted/.test(q)));
  assert(before.some((q) => /8 of 8 tour checks not reviewed/.test(q)));
  const tour = openTour(d, "desk-provider");
  // Walk several checks; the count tracks what is left as they are ticked.
  for (const key of ["layout", "light", "noise", "parking"]) {
    const box = tour.querySelector(`[data-tour-check="${key}"]`);
    box.checked = true;
    box.dispatchEvent(new d.w.Event("change"));
  }
  assert.match(d.doc.querySelector("#tour-draft-count").textContent, /4\/8 reviewed · 4 left · save changes to keep/);
  // Record what the walk found, in the fields directly below the checks.
  const box = d.doc.querySelector("#detail-content");
  box.querySelector("#layoutReview").value = "one_bed";
  box.querySelector("#parkingCost").value = "0";
  box.querySelector("#rentOverride").value = "1725";
  box.querySelector("#quoteDate").value = "2026-09-20";
  box.querySelector('[name="notes"]').value = "Garage is full; waitlist is about two months.";
  box.querySelector("#record-form").dispatchEvent(new d.w.Event("submit", { bubbles: true, cancelable: true }));
  d.doc.querySelector("#detail-dialog").close();
  // Back on the desk, the answered questions are gone and the rest remain.
  const after = [...rowFor(d, "desk-provider").querySelectorAll(".saved-open li")].map((li) => li.textContent);
  assert(!after.some((q) => /Layout not checked by you/.test(q)), "the layout is checked now");
  assert(!after.some((q) => /Parking not quoted/.test(q)), "a recorded $0 answers the parking cost");
  assert(after.some((q) => /4 of 8 tour checks not reviewed/.test(q)), "the remaining checks persist");
  assert(after.some((q) => /Monthly fees not quoted/.test(q)), "what the walk did not answer is still open");
  assert.match(rowFor(d, "desk-provider").querySelector(".saved-money").textContent, /\$1,725/);
  // And it survives a reload with an unchanged feed.
  const notebook = JSON.parse(d.w.localStorage.getItem("spicyhome.workspace.v1"));
  d.close();
  const again = await openDesk({ remote: feed, packaged: feed, notebook });
  const reopened = openTour(again, "desk-provider");
  assert.equal(reopened.querySelectorAll("[data-tour-check]:checked").length, 4);
  assert.match(again.doc.querySelector("#tour-draft-count").textContent, /4\/8 reviewed · 4 left/);
  assert.equal(again.doc.querySelector('[name="notes"]').value, "Garage is full; waitlist is about two months.");
  assert.equal(again.doc.querySelector("#parkingCost").value, "0");
  again.close();
});

test("opening directions or a source from the walkthrough changes no check, note, quote or status", async () => {
  const feed = deskFeed();
  const notebook = deskNotebook({ "desk-provider": { saved: true, status: "toured", tourDate: "2026-09-20T10:00",
    notes: "Garage is full", rentOverride: 1725, quoteDate: "2026-09-14", parkingCost: 0,
    layoutReview: "one_bed", tourChecks: { layout: true, parking: true } } });
  const d = await openDesk({ remote: feed, packaged: feed, notebook });
  const tour = openTour(d, "desk-provider");
  const box = d.doc.querySelector("#detail-content");
  // Text typed at the apartment and not yet saved is part of this check.
  box.querySelector('[name="notes"]').value = "half-typed: ask about the bike room";
  box.querySelector("#monthlyFees").value = "45";
  const noise = tour.querySelector('[data-tour-check="noise"]');
  noise.checked = true;
  noise.dispatchEvent(new d.w.Event("change"));
  const stored = d.w.localStorage.getItem("spicyhome.workspace.v1");
  for (const a of [...tour.querySelectorAll("a"), ...box.querySelectorAll(".detail-links a, .sourceline a")]) a.click();
  assert.equal(d.w.localStorage.getItem("spicyhome.workspace.v1"), stored, "a lookup saves nothing");
  assert.equal(box.querySelector('[name="notes"]').value, "half-typed: ask about the bike room");
  assert.equal(box.querySelector("#monthlyFees").value, "45");
  assert.equal(tour.querySelector('[data-tour-check="noise"]').checked, true);
  assert.equal(tour.querySelectorAll("[data-tour-check]:checked").length, 3);
  assert.match(d.doc.querySelector("#tour-draft-count").textContent, /3\/8 reviewed · 5 left/);
  // The record it belongs to is still the one on screen.
  assert.match(tour.querySelector(".tour-head").textContent, /Unit 1/);
  d.close();
});

test("no tour date says so, and an archived home still walks with its own evidence", async () => {
  const feed = deskFeed();
  const undated = await openDesk({ remote: feed, packaged: feed,
    notebook: deskNotebook({ "desk-provider": { saved: true, status: "shortlisted" } }) });
  const head = openTour(undated, "desk-provider").querySelector(".tour-head").textContent;
  assert.match(head, /No tour date recorded/);
  assert.doesNotMatch(head, /\d{1,2}:\d{2}/, "no time is invented for a tour nobody scheduled");
  undated.close();
  // A home the feed has dropped keeps its walkthrough, its identity and the
  // evidence its own snapshot carries.
  const later = deskFeed("2026-09-22T13:00:00Z");
  later.homes = later.homes.filter((h) => h.id !== "desk-provider");
  const archived = await openDesk({ remote: later, packaged: later, notebook: deskNotebook({
    "desk-provider": { saved: true, status: "toured", snapshot: feed.homes[1],
      tourChecks: { layout: true }, notes: "Walked it on the 20th" } }) });
  const tour = openTour(archived, "desk-provider");
  assert.match(tour.querySelector(".tour-head").textContent, /6700 S South Constance Ave/);
  assert.match(tour.querySelector(".tour-head").textContent, /Unit 1/);
  assert.match(checkNamed(tour, /Walk the parking route/).textContent, /never established whether there is parking/);
  assert.equal(archived.doc.querySelector('[name="notes"]').value, "Walked it on the 20th");
  assert.match(archived.doc.querySelector(".saved-evidence").textContent, /Archived notebook entry/);
  archived.close();
});

test("a home with no coordinates still walks, with directions from its recorded address", async () => {
  const feed = deskFeed();
  feed.homes[1] = { ...feed.homes[1], lat: null, lng: null };
  const d = await openDesk({ remote: feed, packaged: feed,
    notebook: deskNotebook({ "desk-provider": { saved: true, status: "tour scheduled" } }) });
  const tour = openTour(d, "desk-provider");
  const directions = [...tour.querySelectorAll("a")].find((a) => /Directions/.test(a.textContent));
  assert.match(decodeURIComponent(directions.href), /destination=6700 S South Constance Ave, Unit 1, Chicago, IL 60649$/);
  assert.equal(tour.querySelectorAll(".tour-check").length, 8);
  // Nothing invents a position for a record that has none.
  assert.doesNotMatch(directions.href, /-?\d+\.\d+,-?\d+\.\d+/);
  d.close();
});

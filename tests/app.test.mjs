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
  .replace(/^import\s*\{[\s\S]*?\}\s*from\s*["']\.\/model\.js["'];?\s*/, "");
const seed = JSON.parse(
  fs.readFileSync(new URL("../data/seed.json", import.meta.url), "utf8"),
);
async function boot({
  remote = seed,
  cache = null,
  notebook = null,
  storageFails = false,
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
  w.fetch = async (url) => {
    if (url === "remote" && remote === null) throw Error("offline");
    const data =
      url === "./config.json"
        ? { feed_url: "remote", fallback_url: "./data.json" }
        : url === "remote"
          ? remote
          : seed;
    return { ok: true, text: async () => JSON.stringify(data) };
  };
  w.eval(model + "\n" + app);
  for (let i = 0; i < 30 && !w.document.querySelector(".home-card"); i++)
    await new Promise((r) => setTimeout(r, 3));
  return { w, doc: w.document, close: () => w.close() };
}
test("working surface renders real prospects and usable map fallback", async () => {
  const d = await boot();
  assert.equal(d.doc.querySelectorAll(".home-card").length, 9);
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
  next.doc.querySelector('[data-view="shortlist"]').click();
  assert.equal(next.doc.querySelectorAll(".home-card").length, 1);
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
    /retaining your last complete connected snapshot/,
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

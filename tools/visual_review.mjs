// Local, reproducible visual evidence. No provider requests or external writes.
// node tools/visual_review.mjs --shots /absolute/path [--width 390]
// The feed is the committed fixture. Saved/archived notebook entries are synthetic.
import { createServer } from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve, extname, join } from "node:path";
import { chromium } from "playwright";

const args = process.argv.slice(2);
const value = (key, fallback) =>
  args.includes(key) ? args[args.indexOf(key) + 1] : fallback;
const dist = resolve(value("--dist", "dist"));
const out = resolve(value("--shots", "scratchpad/visual-review"));
await mkdir(out, { recursive: true });
const data = JSON.parse(await readFile(join(dist, "data.json"), "utf8"));
const status = await readFile(join(dist, "status.json"), "utf8");
const buildings = data.homes.filter((h) => h.kind === "building");
const listings = data.homes.filter((h) => h.kind === "listing");
const archived = {
  ...listings[0],
  id: "visual-archived-fixture",
  title: "Archived notebook fixture",
};
const notebook = {
  version: 1,
  manual: [],
  events: [],
  preferences: {},
  savedSearches: [],
  records: {
    [buildings[0].id]: { saved: true, finalist: true, status: "shortlisted" },
    [buildings[1].id]: {
      saved: true,
      finalist: true,
      status: "tour scheduled",
      layoutReview: "one_bed",
      tourDate: "2026-09-20T10:00",
    },
    [listings[0].id]: {
      saved: true,
      finalist: true,
      status: "contacted",
      rentOverride: 1725,
      parkingCost: 0,
      quoteDate: "2026-09-14",
      quote_history: [
        {
          rent: 1800,
          date: "2026-09-10",
          date_basis: "entered",
          recorded_at: "2026-09-10T12:00:00Z",
        },
        {
          rent: 1725,
          date: "2026-09-14",
          date_basis: "entered",
          recorded_at: "2026-09-14T12:00:00Z",
        },
      ],
    },
    [listings[1].id]: { saved: true, status: "researching" },
    [listings[2].id]: {
      saved: true,
      status: "ruled out",
      notes: "Synthetic review note.",
    },
    [archived.id]: { saved: true, status: "researching", snapshot: archived },
  },
};
const types = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".woff2": "font/woff2",
};
const server = createServer(async (req, res) => {
  const p = resolve(dist, "." + decodeURIComponent(req.url.split("?")[0]));
  if (p !== dist && !p.startsWith(dist + "/")) return res.writeHead(403).end();
  try {
    const path = p === dist ? join(p, "index.html") : p;
    res
      .writeHead(200, {
        "Content-Type": types[extname(path)] ?? "application/octet-stream",
      })
      .end(await readFile(path));
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
const observations = [];
const sizes = [
  [1440, 900, "dark"],
  [1280, 900, "dark"],
  [1280, 900, "light"],
  [390, 844, "dark"],
  [390, 844, "light"],
  [320, 740, "dark"],
].filter(([w]) => !args.includes("--width") || w === Number(value("--width")));
try {
  for (const [width, height, theme] of sizes) {
    const tag = `${width}-${theme}`;
    const ctx = await browser.newContext({
      viewport: { width, height },
      colorScheme: theme,
      reducedMotion: "reduce",
      isMobile: width < 600,
      hasTouch: width < 600,
    });
    await ctx.route("**/*", (route) => {
      const url = route.request().url();
      if (url.startsWith(origin)) return route.continue();
      if (url.includes("raw.githubusercontent.com"))
        return route.fulfill({
          contentType: "application/json",
          body: url.includes("status.json") ? status : JSON.stringify(data),
        });
      // No web calls. In particular, maps are fixture geometry, not live tiles.
      return route.abort();
    });
    const page = await ctx.newPage();
    await page.addInitScript((theme) => {
      if (!localStorage.getItem("sc-theme"))
        localStorage.setItem("sc-theme", theme);
    }, theme);
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto(origin, { waitUntil: "load" });
    await page.waitForSelector("#results .home-card");
    const capture = async (name, selector) => {
      if (selector)
        await page.locator(selector).first().scrollIntoViewIfNeeded();
      await page.waitForTimeout(120);
      await page.screenshot({ path: join(out, `${tag}-${name}.png`) });
      observations.push({
        tag,
        name,
        ...(await page.evaluate(() => {
          const d = document.querySelector("dialog[open]");
          return {
            pageHeight: document.documentElement.scrollHeight,
            overflow: document.documentElement.scrollWidth - innerWidth,
            dialogOverflow: d ? d.scrollWidth - d.clientWidth : 0,
            y: scrollY,
            cards: [...document.querySelectorAll("#results .home-card")].filter(
              (e) => {
                const r = e.getBoundingClientRect();
                return r.top < innerHeight && r.bottom > 0;
              },
            ).length,
          };
        })),
      });
    };
    const click = async (selector) => {
      await page
        .locator(selector)
        .first()
        .evaluate((el) => el.click());
      await page.waitForTimeout(150);
    };
    const jump = async (target) => {
      await click(`[data-detail-jump="${target}"]`);
    };
    await capture("opening");
    await click('[data-surface="list"]');
    await capture("listing", "#results .home-card");
    await click('[data-surface="split"]');
    await capture("map-list", ".map-panel");
    await click('[data-surface="focus"]');
    await capture("focus", "#focus-surface");
    await click('[data-surface="list"]');
    for (const [name, home] of [
      ["provider", listings[0]],
      ["curated", buildings[0]],
    ]) {
      await click(`[data-detail="${home.id}"]`);
      await capture(`dossier-${name}`);
      await jump("detail-sources");
      await capture(`sources-${name}`);
      await click("#detail-dialog [data-close]");
    }
    // Seed only the notebook; the provider fixture remains byte-for-byte intact.
    await page.evaluate(
      (n) => localStorage.setItem("spicyhome.workspace.v1", JSON.stringify(n)),
      notebook,
    );
    await page.reload({ waitUntil: "load" });
    await page.waitForSelector("#results .home-card");
    await click('[data-view="shortlist"]');
    await page.evaluate(() => scrollTo(0, 0));
    await capture("desk");
    await capture("final-three", ".finalist-shelf");
    await page
      .locator(".finalist-shelf")
      .screenshot({ path: join(out, `${tag}-final-three-full.png`) });
    await click("#compare-finalists");
    await capture("comparison");
    await click("#compare-dialog [data-close]");
    await click(`[data-detail="${listings[0].id}"]`);
    await jump("detail-history");
    await capture("history");
    await jump("tour-draft-count");
    await capture("tour");
    await click("#detail-dialog [data-close]");
    await click(`[data-detail="${archived.id}"]`);
    await capture("archived");
    await click("#detail-dialog [data-close]");
    await click('[data-view="lab"]');
    await page.evaluate(() => scrollTo(0, 0));
    await capture("cost-lab");
    await click('[data-view="discover"]');
    await click("[data-open-studio]");
    await click('[data-studio-tab="pulse"]');
    await capture("price-pulse", "#studio-panel");
    await click('[data-view="discover"]');
    await click("#open-search-controls");
    await page.locator("#search").fill("There are no matches for this fixture");
    await page.waitForTimeout(400);
    await click('[data-surface="list"]');
    await capture("empty", "#results");
    observations.push({ tag, errors });
    await ctx.close();
    console.log(`${tag}: captured`);
  }
} finally {
  await browser.close();
  server.close();
}
await writeFile(
  join(out, "observations.json"),
  JSON.stringify(observations, null, 2),
);
console.log(`${observations.length} observations saved to ${out}`);

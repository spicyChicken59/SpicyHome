// Real Chromium acceptance for the flagship composition. All remote requests
// are intercepted; synthetic personal evidence never touches the committed feed.
import { createServer } from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, join, extname } from "node:path";
import { chromium } from "playwright";
const ROOT = resolve("dist"),
  out = resolve(process.argv[2] || "scratchpad/flagship-check");
await mkdir(out, { recursive: true });
const feed = JSON.parse(await readFile(join(ROOT, "data.json"), "utf8"));
const status = JSON.parse(await readFile(join(ROOT, "status.json"), "utf8"));
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
  const p = resolve(ROOT, "." + decodeURIComponent(req.url.split("?")[0]));
  if (p !== ROOT && !p.startsWith(ROOT + "/")) return res.writeHead(403).end();
  try {
    const path = p === ROOT ? join(p, "index.html") : p;
    res
      .writeHead(200, {
        "Content-Type": types[extname(path)] || "application/octet-stream",
      })
      .end(await readFile(path));
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch(),
  results = [],
  metrics = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? " — " + detail : ""}`);
};
async function open({
  width = 390,
  theme = "dark",
  data = feed,
  fail = false,
} = {}) {
  const context = await browser.newContext({
    viewport: { width, height: width < 360 ? 740 : width < 600 ? 844 : 900 },
    isMobile: width < 600,
    hasTouch: width < 600,
    colorScheme: theme,
    reducedMotion: "reduce",
    acceptDownloads: true,
  });
  await context.route("**/*", (route) => {
    const u = route.request().url();
    if (u.startsWith(origin)) return route.continue();
    if (u.includes("raw.githubusercontent.com"))
      return fail
        ? route.abort()
        : route.fulfill({
            contentType: "application/json",
            body: JSON.stringify(u.includes("status.json") ? status : data),
          });
    return route.abort();
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("dialog", (d) => d.accept());
  await page.addInitScript(
    (theme) => localStorage.setItem("sc-theme", theme),
    theme,
  );
  const t = performance.now();
  await page.goto(origin, { waitUntil: "load" });
  await page.waitForSelector("#result-count");
  metrics.push({
    width,
    theme,
    loaded: data.homes.length,
    loadMs: Math.round(performance.now() - t),
  });
  return { context, page, errors };
}
async function shot(page, name) {
  await page.screenshot({ path: join(out, name + ".png") });
}
async function jump(page, home) {
  await page.locator("#open-jump").click();
  await page.locator("#jump-search").fill(home.title);
  await page.locator(`[data-jump-home="${home.id}"]`).click();
}
async function clearBars(page, target) {
  return page.locator(target).evaluate((el) => {
    const r = el.getBoundingClientRect(),
      dock = document.querySelector(".detail-dock").getBoundingClientRect();
    return (
      r.top >= dock.bottom - 1 &&
      r.top < innerHeight &&
      r.right <= innerWidth + 1
    );
  });
}
try {
  const { context, page, errors } = await open();
  const homes = [
    feed.homes.find((h) => h.kind === "listing"),
    ...feed.homes.filter((h) => h.kind === "building").slice(0, 2),
  ];
  check(
    "fresh profile explains source health",
    /scan|source|snapshot/i.test(
      await page.locator("#source-status-label").innerText(),
    ),
  );
  check(
    "page heading survives the mobile composition",
    await page.locator("#view-title").isVisible(),
  );
  check(
    "research picks begin as an optional section",
    (await page.locator(".research-picks").getAttribute("open")) === null,
  );
  await page.locator(".research-picks>summary").click();
  check(
    "an opened pick shows reasons and unresolved evidence together",
    (await page.locator(".pick-card .why-block").first().isVisible()) &&
      (await page.locator(".pick-card .why-open").first().isVisible()),
  );
  await page.locator(".research-picks>summary").click();
  await page.locator("#open-search-controls").click();
  const t = performance.now();
  await page.locator("#search").fill(homes[0].title);
  await page.waitForFunction(
    () => document.querySelectorAll("#results .home-card").length < 20,
  );
  metrics.push({ filterMs: Math.round(performance.now() - t) });
  for (const surface of ["list", "map", "focus", "list"]) {
    await page.locator(`[data-surface="${surface}"]`).click();
    check(
      `${surface} remains reachable after filtering`,
      await page
        .locator(
          surface === "focus"
            ? "#focus-surface"
            : surface === "map"
              ? ".map-panel"
              : ".results-column",
        )
        .isVisible(),
    );
  }
  await page.locator(`#results [data-detail="${homes[0].id}"]`).click();
  check(
    "dossier opens at identity and meaningful money",
    (await page.locator("#detail-title").isVisible()) &&
      /Provider asking rent/.test(
        await page.locator(".dossier-price").innerText(),
      ) &&
      (await page.locator("#detail-dialog").evaluate((d) => d.scrollTop === 0)),
  );
  check(
    "subtotal says which costs are missing",
    /Incomplete/.test(await page.locator(".dossier-subtotal").innerText()),
  );
  await page.locator("#detail-dialog [data-save]").click();
  await page.locator(".detail-dock .dock-close").click();
  for (const h of homes.slice(1)) {
    await jump(page, h);
    await page.locator("#detail-dialog [data-save]").click();
    await page.locator(".detail-dock .dock-close").click();
  }
  await page.locator('[data-view="shortlist"]').click();
  for (const h of homes) {
    const row = page.locator(`.saved-row[data-home="${h.id}"]`);
    await row.locator(".saved-more>summary").click();
    await row.locator("[data-finalist]").click();
  }
  check(
    "three saved candidates become three unranked finalists",
    (await page.locator(".finalist-grid article").count()) === 3 &&
      !/winner|score|best choice/i.test(
        await page.locator(".finalist-grid").innerText(),
      ),
  );
  check(
    "mobile finalists retain subtotal, layout and missing costs",
    (await page
      .locator('.finalist-facts [data-fact="wide"]')
      .first()
      .isVisible()) &&
      (await page.locator(".finalist-missing").first().isVisible()),
  );
  await page.locator("#compare-finalists").click();
  check(
    "comparison starts with visible identity choices on mobile",
    await page
      .locator(".sc-compare-pair__heads")
      .evaluate((el) => el.getBoundingClientRect().top < innerHeight - 60),
  );
  await page.locator('[data-pair-side="1"]').selectOption("2");
  await page
    .locator(".sc-compare-pair__measure")
    .last()
    .scrollIntoViewIfNeeded();
  check(
    "comparison close stays reachable while reading the last fact",
    await page.locator(".comparison-toolbar [data-close]").evaluate((el) => {
      const r = el.getBoundingClientRect();
      return r.top >= 0 && r.bottom < innerHeight;
    }),
  );
  await page.locator("#compare-dialog [data-close]").click();
  await page
    .locator(`.finalist-candidate [data-detail="${homes[0].id}"]`)
    .click();
  for (const [target, label] of [
    ["detail-sources", "source evidence"],
    ["detail-costs", "missing costs"],
    ["detail-history", "source and quote histories"],
  ]) {
    await page.locator(`[data-detail-jump="${target}"]`).click();
    check(
      `${label} lands clear of the dossier dock`,
      await clearBars(page, "#" + target),
    );
  }
  await page.locator('[data-detail-jump="layoutReview"]').click();
  // The actual validator accepts only the repository's named layout vocabulary.
  const layoutOptions = await page
    .locator("#layoutReview option")
    .evaluateAll((els) =>
      els.map((e) => ({ value: e.value, text: e.textContent })),
    );
  const checked = layoutOptions.find((o) =>
    /I checked: 2 separate bedrooms.*1 bathroom/.test(o.text),
  );
  if (checked) await page.locator("#layoutReview").selectOption(checked.value);
  await page.locator('[data-detail-jump="tour-draft-count"]').click();
  await page.locator('[data-tour-check="layout"]').check();
  check(
    "tour review stays explicitly personal",
    /not that anyone certified it/.test(
      await page.locator("#tour-companion").innerText(),
    ),
  );
  await page.locator('[data-detail-jump="notes"]').click();
  await page
    .locator("#notes")
    .fill(
      "Synthetic acceptance note: checked the layout; ask about move-in fees.",
    );
  await page.locator("#parkingCost").fill("0");
  await page.locator("#rentOverride").fill("1900");
  await page.locator("#quoteDate").fill("2026-09-14");
  await page.locator('.detail-dock [type="submit"]').click();
  let record = await page.evaluate(
    (id) =>
      JSON.parse(localStorage.getItem("spicyhome.workspace.v1")).records[id],
    homes[0].id,
  );
  check(
    "$0 parking is saved as zero, with an entered quote day",
    record.parkingCost === 0 &&
      record.quoteDate === "2026-09-14" &&
      record.tourChecks.layout &&
      record.notes.startsWith("Synthetic"),
  );
  const row = page.locator(`.saved-row[data-home="${homes[0].id}"]`);
  await row.locator(".saved-open>summary").click();
  check(
    "answered layout and parking-cost questions leave the unresolved list",
    !/Layout not checked by you|Parking amount unquoted/.test(
      await row.locator(".saved-open").innerText(),
    ),
  );
  await row.locator(".saved-more>summary").click();
  await row.locator("[data-stage]").selectOption("ruled out");
  check(
    "ruled out record stays recoverable",
    await page
      .locator(`.saved-ruled .saved-row[data-home="${homes[0].id}"]`)
      .isVisible(),
  );
  await page
    .locator(`.saved-ruled [data-stage="${homes[0].id}"]`)
    .selectOption("researching");
  await page.reload({ waitUntil: "load" });
  await page.locator('[data-view="shortlist"]').click();
  await page
    .locator(`.saved-row[data-home="${homes[0].id}"] [data-detail]`)
    .click();
  check(
    "reload retains the quote, personal notes and literal zero",
    (await page.locator("#parkingCost").inputValue()) === "0" &&
      (await page.locator("#notes").inputValue()) === record.notes,
  );
  await page.locator('[data-detail-jump="detail-history"]').click();
  check(
    "history labels recording time independently of quote day",
    /quoted Sep 14, 2026.*Recorded/s.test(
      await page.locator(".quote-log").innerText(),
    ),
  );
  await page.keyboard.press("Escape");
  check(
    "Escape returns focus to the apartment opener",
    await page.evaluate(
      (id) => document.activeElement?.dataset.detail === id,
      homes[0].id,
    ),
  );
  await page.locator('[data-view="lab"]').click();
  check(
    "Cost Lab remains reachable",
    await page.locator("#lab-home").isVisible(),
  );
  await page.locator('[data-view="shortlist"]').click();
  const downloaded = page.waitForEvent("download");
  await page.locator("#export-notebook").click();
  const download = await downloaded;
  const path = await download.path();
  const exported = JSON.parse(await readFile(path, "utf8"));
  check(
    "export carries personal evidence and snapshots",
    exported.records[homes[0].id].parkingCost === 0 &&
      !!exported.records[homes[0].id].snapshot,
  );
  const gone = {
    ...homes[0],
    id: "synthetic-archived-acceptance",
    title: "Synthetic archived apartment",
  };
  exported.records[gone.id] = {
    saved: true,
    status: "researching",
    snapshot: gone,
  };
  const fresh = await open();
  await fresh.page.locator('[data-view="setup"]').click();
  await fresh.page.locator("#import-file").setInputFiles({
    name: "synthetic-notebook.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(exported)),
  });
  await fresh.page.locator('[data-view="shortlist"]').click();
  await fresh.page
    .locator(`.saved-row[data-home="${gone.id}"] [data-detail]`)
    .click();
  check(
    "imported archived home keeps current availability unknown",
    /current availability is unverified/.test(
      await fresh.page.locator(".callout").innerText(),
    ) &&
      /Archived notebook entry/.test(
        await fresh.page.locator("#detail-content").innerText(),
      ),
  );
  await shot(fresh.page, "journey-archived-390");
  await fresh.context.close();
  check(
    "fresh-profile journey raises no page errors",
    errors.length === 0,
    errors.join(" | "),
  );
  await context.close();
  // Edge fixtures: intentional synthetic data, never written to dist/data.json.
  const unknown = {
    ...homes[0],
    id: "synthetic-long-unknown",
    title:
      "The Residences at a Very Long Building Name on South Constance Avenue — Synthetic Layout Fixture",
    rent: null,
    advertised_price: null,
    bedrooms: null,
    bathrooms: null,
    sqft: null,
    lat: null,
    lng: null,
    source_url: null,
    sources: [],
    history: [],
    layout_status: "unverified",
  };
  const challenge = {
    ...feed,
    homes: [
      unknown,
      {
        ...homes[1],
        id: "synthetic-priced",
        title: "Synthetic priced prospect",
      },
    ],
  };
  for (const [width, theme] of [
    [1440, "dark"],
    [1280, "dark"],
    [1280, "light"],
    [390, "dark"],
    [390, "light"],
    [320, "dark"],
  ]) {
    const { context, page, errors } = await open({
      width,
      theme,
      data: challenge,
    });
    await page.locator('[data-surface="list"]').click();
    const tag = `${width}-${theme}`;
    await page.locator(`#results [data-detail="${unknown.id}"]`).click();
    check(
      `${tag}: long identity and unknown money wrap without horizontal overflow`,
      await page.evaluate(() => {
        const d = document.querySelector("dialog[open]");
        return (
          document.documentElement.scrollWidth <= innerWidth + 1 &&
          d.scrollWidth <= d.clientWidth + 1
        );
      }),
    );
    check(
      `${tag}: unknown base is not presented as an all-in total`,
      /unquoted|not quoted|unknown/i.test(
        await page.locator(".dossier-price").innerText(),
      ) &&
        /Incomplete/.test(await page.locator(".dossier-subtotal").innerText()),
    );
    await page.locator('[data-detail-jump="detail-sources"]').click();
    check(
      `${tag}: source disclosure opens at its visible title`,
      await clearBars(page, "#detail-sources"),
    );
    await page.locator('[data-detail-jump="tour-draft-count"]').click();
    check(
      `${tag}: tour check targets meet 44px`,
      await page
        .locator(".tour-check")
        .evaluateAll((els) =>
          els.every((e) => e.getBoundingClientRect().height >= 44),
        ),
    );
    await shot(page, `${tag}-challenge-tour`);
    await page.locator(".detail-dock .dock-close").click();
    const ratios = await page.evaluate(() => {
      const s = getComputedStyle(document.documentElement);
      const lum = (name) => {
        const c = s.getPropertyValue(name).trim().slice(1);
        const rgb = [0, 2, 4]
          .map((i) => parseInt(c.slice(i, i + 2), 16) / 255)
          .map((v) =>
            v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4,
          );
        return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
      };
      return [
        ["--ink", "--bg"],
        ["--muted", "--surface"],
        ["--wine", "--bg"],
        ["--action", "--action-ink"],
      ].map(([a, b]) => {
        const x = lum(a),
          y = lum(b);
        return {
          pair: [a, b],
          ratio: (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05),
        };
      });
    });
    check(
      `${tag}: body, evidence, accent and action token contrast meet 4.5:1`,
      ratios.every((r) => r.ratio >= 4.5),
      ratios.map((r) => r.ratio.toFixed(2)).join(", "),
    );
    check(
      `${tag}: reduced-motion preference suppresses entry motion`,
      await page
        .locator("body")
        .evaluate(
          (e) => parseFloat(getComputedStyle(e).animationDuration) < 0.01,
        ),
    );
    await page.locator("[data-open-studio]").click();
    await page.locator('[data-studio-tab="pulse"]').click();
    const contrast = await page.locator("[data-pulse]").evaluateAll((buttons) =>
      buttons.map((button) => {
        const rgb = (value) => value.match(/[\d.]+/g).map(Number);
        const luminance = (values) =>
          values
            .slice(0, 3)
            .map((v) => v / 255)
            .map((v) =>
              v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4,
            )
            .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
        let ancestor = button,
          background;
        do {
          background = rgb(getComputedStyle(ancestor).backgroundColor);
          ancestor = ancestor.parentElement;
        } while (background[3] === 0 && ancestor);
        const a = luminance(rgb(getComputedStyle(button).color)),
          b = luminance(background);
        return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      }),
    );
    check(
      `${tag}: every Price Pulse filter label has readable contrast`,
      contrast.length === 3 && contrast.every((r) => r >= 4.5),
      contrast.map((r) => r.toFixed(2)).join(", "),
    );
    check(
      `${tag}: no fixture page error`,
      errors.length === 0,
      errors.join(" | "),
    );
    await context.close();
  }
  // The dossier can be reached, saved, explored and dismissed without a mouse.
  for (const [width, theme] of [
    [1440, "dark"],
    [1280, "dark"],
    [1280, "light"],
  ]) {
    const desktop = await open({ width, theme });
    const dp = desktop.page;
    await dp.evaluate(() => {
      for (const box of [
        ...document.querySelectorAll("#results [data-compare]"),
      ].slice(0, 3))
        box.click();
    });
    await dp.locator("#open-compare").click();
    await dp.locator(".matrix tbody tr").last().scrollIntoViewIfNeeded();
    check(
      `${width}-${theme}: comparison keeps all three identities readable below its Close bar`,
      await dp
        .locator(".matrix thead th:not(:first-child)")
        .evaluateAll((heads) => {
          const bar = document
            .querySelector(".comparison-toolbar")
            .getBoundingClientRect();
          return (
            heads.length === 3 &&
            heads.every((head) => {
              const box = head.getBoundingClientRect();
              return (
                box.top >= bar.bottom - 1 &&
                box.bottom < innerHeight &&
                box.width >= 160
              );
            })
          );
        }),
    );
    await shot(dp, `${width}-${theme}-comparison-lower-facts`);
    await desktop.context.close();
  }

  const narrow = await open({ width: 320 });
  const np = narrow.page;
  await np.locator('button[data-surface="list"]').click();
  for (const box of (await np.locator("#results [data-compare]").all()).slice(
    0,
    3,
  ))
    await box.check();
  await np.locator("#open-search-controls").click();
  await np.locator("#search").fill("Synthetic empty-search keyboard fixture");
  await np.locator('button[data-surface="list"]').click();
  await np.locator("#reset-other-filters").waitFor();
  await np.locator("#sort").focus();
  await np.keyboard.press("Tab");
  check(
    "320px empty-search Reset receives visible keyboard focus above the comparison tray",
    await np.evaluate(() => {
      const target = document.activeElement,
        box = target.getBoundingClientRect();
      return (
        target.id === "reset-other-filters" &&
        box.bottom <
          document.querySelector("#compare-tray").getBoundingClientRect().top
      );
    }),
  );
  await shot(np, "320-empty-keyboard");
  await np.keyboard.press("Enter");
  check(
    "320px keyboard Reset restores results without discarding the comparison",
    (await np.locator("#results .home-card").count()) > 0 &&
      (await np.locator("#compare-tray .tray-items li").count()) === 3,
  );
  await narrow.context.close();

  const keyboard = await open();
  const kp = keyboard.page;
  await kp.keyboard.press("Tab");
  check(
    "keyboard starts at the skip link",
    await kp.evaluate(() =>
      document.activeElement?.classList.contains("skip-link"),
    ),
  );
  await kp.keyboard.press("Enter");
  await kp.keyboard.press("Control+k");
  await kp.keyboard.type(homes[0].title);
  await kp.keyboard.press("Enter");
  check(
    "keyboard jump announces the dossier identity",
    await kp.evaluate(() => document.activeElement?.id === "detail-title"),
  );
  await kp.keyboard.press("Tab");
  check(
    "keyboard reaches Save with a visible focus ring",
    await kp.evaluate(
      () =>
        document.activeElement?.hasAttribute("data-save") &&
        getComputedStyle(document.activeElement).outlineStyle !== "none",
    ),
  );
  await kp.keyboard.press("Space");
  check(
    "keyboard Save preserves the chosen home",
    await kp.evaluate(
      (id) =>
        JSON.parse(localStorage.getItem("spicyhome.workspace.v1")).records[id]
          ?.saved,
      homes[0].id,
    ),
  );
  for (
    let i = 0;
    i < 20 &&
    (await kp.evaluate(
      () => document.activeElement?.dataset.detailJump !== "detail-sources",
    ));
    i++
  )
    await kp.keyboard.press("Tab");
  await kp.keyboard.press("Enter");
  check(
    "keyboard Sources opens a visible, focused disclosure",
    (await kp.locator("#detail-sources").getAttribute("open")) !== null &&
      (await clearBars(kp, "#detail-sources")) &&
      (await kp.evaluate(
        () => document.activeElement?.id === "detail-sources",
      )),
  );
  await kp.keyboard.press("Escape");
  check(
    "keyboard dismissal returns to Jump to",
    await kp.evaluate(() => document.activeElement?.id === "open-jump"),
  );
  check("keyboard journey raises no page errors", keyboard.errors.length === 0);
  await keyboard.context.close();
  const failed = await open({ fail: true });
  check(
    "failed remote source still exposes fallback/source status",
    !!(await failed.page.locator("#source-status-label").innerText()),
  );
  await shot(failed.page, "failed-source-390");
  await failed.context.close();
} catch (error) {
  check("acceptance journey completed", false, String(error.stack || error));
} finally {
  await browser.close();
  server.close();
  await writeFile(
    join(out, "results.json"),
    JSON.stringify({ results, metrics }, null, 2),
  );
}
console.log(`${results.filter((r) => r.ok).length}/${results.length} passed`);
process.exitCode = results.some((r) => !r.ok) ? 1 : 0;

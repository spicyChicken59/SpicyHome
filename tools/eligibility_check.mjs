// Focused real-browser acceptance. Every remote request is intercepted.
// node tools/eligibility_check.mjs [output-directory] [--baseline | --archived-updates]
// --baseline serves BASE_DIST and verifies the omission before this correction.
// ELIGIBILITY_DIST optionally serves a reviewed revision for a failing regression.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, join, extname, sep } from 'node:path';
import { chromium } from 'playwright';
import { isDeepStrictEqual as same } from 'node:util';

const baseline = process.argv.includes('--baseline');
const archivedUpdates = process.argv.includes('--archived-updates');
const dist = resolve(process.env.ELIGIBILITY_DIST || (baseline ? process.env.BASE_DIST : 'dist'));
const out = resolve(process.argv[2] || 'scratchpad/eligibility-check');
await mkdir(out, { recursive: true });
const feed = JSON.parse(await readFile(join(dist, 'data.json'), 'utf8'));
const status = await readFile(join(dist, 'status.json'), 'utf8');
const id = 'rentcast:2030-Greenwood-St,-Unit-1BR,-Evanston,-IL-60201';
const home = feed.homes.find(h => h.id === id);
assert(home, 'the exact provider identity must exist');
const other = feed.homes.find(h => h.kind === 'building' && h.rent >= 1200 && h.rent <= 3000);
const key = 'spicyhome.workspace.v1';
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };
const server = createServer(async (req, res) => {
  const p = resolve(dist, '.' + decodeURIComponent(req.url.split('?')[0]));
  if (p !== dist && !p.startsWith(dist + sep)) return res.writeHead(403).end();
  try {
    const file = p === dist ? join(p, 'index.html') : p;
    res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream' }).end(await readFile(file));
  } catch { res.writeHead(404).end(); }
});
const results = [];
let browser;
const check = (name, ok, detail = '') => {
  results.push({ name, ok: !!ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);
  assert(ok, name);
};
let origin;
async function open(width, theme, data = feed) {
  const context = await browser.newContext({ viewport: { width, height: width < 600 ? 844 : 900 },
    isMobile: width < 600, hasTouch: width < 600, colorScheme: theme, reducedMotion: 'reduce', acceptDownloads: true });
  const fixture = { data };
  await context.route('**/*', async route => {
    const url = route.request().url();
    if (url.startsWith(origin) && !/\/(data|status)\.json/.test(url)) return route.continue();
    if (url.startsWith(origin) || url.includes('raw.githubusercontent.com'))
      return route.fulfill({ contentType: 'application/json', body: url.includes('status.json') ? status : JSON.stringify(fixture.data) });
    return route.abort();
  });
  const page = await context.newPage(), errors = [];
  page.on('pageerror', err => errors.push(String(err)));
  page.on('dialog', dialog => dialog.accept());
  // Only the theme is set on navigation. Never re-seed a notebook on reload.
  await page.addInitScript(theme => localStorage.setItem('sc-theme', theme), theme);
  await page.goto(origin);
  await page.locator('#result-count').waitFor();
  assert.equal(await page.evaluate(key => localStorage.getItem(key), key), null, 'each profile begins with an empty notebook');
  return { context, page, errors, fixture };
}
const shot = (page, name) => page.screenshot({ path: join(out, name + '.png') });
async function find(page, text) {
  if (!await page.locator('#search').isVisible()) await page.locator('#search-controls > summary').click();
  await page.locator('#search').fill(text);
  await page.locator('#search').press('Enter');
}
async function jump(page, target) {
  await page.locator('#open-jump').click();
  await page.locator('#jump-search').fill(target.title);
  await page.locator(`[data-jump-home="${target.id}"]`).click();
}
async function fit(page, label, selector) {
  const measured = await page.locator(selector).evaluateAll(elements => elements.filter(e => e.getClientRects().length).map(e => {
    const r = e.getBoundingClientRect();
    return { text: e.textContent.slice(0, 70), left: r.left, right: r.right, width: innerWidth, extra: e.scrollWidth - e.clientWidth };
  }));
  check(label, measured.length > 0 && measured.every(x => x.left >= -1 && x.right <= x.width + 1 && x.extra <= 1), JSON.stringify(measured));
}
const syntheticEvidence = (note, observed_at) => ({ ...structuredClone(home.eligibility_evidence), note,
  source: { name: 'Synthetic preservation fixture', url: 'https://example.invalid/evidence', observed_at,
    supports: 'Synthetic evidence for preservation tests only.' } });
const originalEvidence = syntheticEvidence('Synthetic original source evidence.', '2026-09-19');
const laterEvidence = syntheticEvidence('Synthetic later source clarification.', '2026-09-20');
function withEvidence(evidence) {
  const data = structuredClone(feed); data.homes.find(h => h.id === id).eligibility_evidence = evidence; return data;
}
async function archivedUpdateJourney(d, tag, width, theme) {
  const p = d.page;
  const readRecord = page => page.evaluate(({ key, id }) => JSON.parse(localStorage.getItem(key)).records[id], { key, id });
  const submit = () => p.locator('.detail-dock [type="submit"]').click();
  const openSaved = async page => {
    await page.locator('button[data-view="shortlist"]').click();
    await page.locator(`.saved-row[data-home="${id}"] [data-detail]`).click();
  };
  const showEvidence = async name => {
    await p.locator('#detail-eligibility > summary').click();
    await p.locator('#detail-eligibility').scrollIntoViewIfNeeded();
    await shot(p, `${tag}-${name}`);
  };
  await find(p, '2030 Greenwood');
  await p.locator(`#results [data-home="${id}"] [data-detail]`).click();
  await p.locator(`#detail-content [data-save="${id}"]`).click();
  await p.locator('#notes').fill('Synthetic original personal note');
  await p.locator('#parkingCost').fill('0');
  await p.locator('#rentOverride').fill('1300');
  await p.locator('#quoteDate').fill('2026-09-18');
  await submit();
  const initial = await readRecord(p);
  check(`${tag} original snapshot contains synthetic A`, same(initial.snapshot.eligibility_evidence, originalEvidence));
  d.fixture.data = withEvidence(laterEvidence);
  await p.reload(); await p.locator('#result-count').waitFor();
  await openSaved(p); await submit();
  const before = await readRecord(p);
  check(`${tag} current B is retained separately from A`, same(before.eligibility_update.evidence, laterEvidence) && same(before.snapshot, initial.snapshot) && same(before.scan, initial.scan));
  d.fixture.data = { ...feed, homes: feed.homes.filter(h => h.id !== id) };
  await p.reload(); await p.locator('#result-count').waitFor();
  await openSaved(p); await showEvidence('before-notes');
  await p.locator('#notes').fill('Synthetic notes-only archived edit');
  await submit();
  const after = await readRecord(p);
  await openSaved(p); await showEvidence('after-notes');
  await writeFile(join(out, `${tag}-records.json`), JSON.stringify({ initial, before, after }, null, 2) + '\n');
  check(`${tag} archived notes retain B and its original recording time`, same(after.eligibility_update, before.eligibility_update));
  check(`${tag} only personal notes change`, same(after, { ...before, notes: 'Synthetic notes-only archived edit' }));
  await fit(p, `${tag} archived source evidence remains readable`, '#detail-eligibility');
  await p.locator('#detail-dialog .dock-close').click();
  const row = p.locator(`.saved-row[data-home="${id}"]`);
  const openMore = async () => {
    if (await row.locator('.saved-more').getAttribute('open') === null) await row.locator('.saved-more > summary').click();
  };
  await openMore();
  await row.locator('[data-stage]').selectOption('contacted');
  check(`${tag} archived stage change retains B`, same((await readRecord(p)).eligibility_update, before.eligibility_update));
  await openMore();
  await row.locator('[data-finalist]').click();
  check(`${tag} archived finalist action retains B`, same((await readRecord(p)).eligibility_update, before.eligibility_update));
  await row.locator('[data-detail]').click();
  const saveButton = p.locator(`#detail-content [data-save="${id}"]`);
  await saveButton.click();
  check(`${tag} archived unsave retains B`, same((await readRecord(p)).eligibility_update, before.eligibility_update));
  await saveButton.click();
  const saved = await readRecord(p);
  check(`${tag} archived resave keeps source and personal evidence`, same(saved.eligibility_update, before.eligibility_update) && same(saved.snapshot, before.snapshot) && same(saved.scan, before.scan) && same(saved.quote_history, before.quote_history) && saved.parkingCost === 0 && saved.utilities === null);
  await p.reload(); await p.locator('#result-count').waitFor();
  check(`${tag} reload retains exact record`, same(await readRecord(p), saved));
  await p.locator('[data-view="setup"]').click();
  const pendingDownload = p.waitForEvent('download'); await p.locator('#export-notebook').click();
  const download = await pendingDownload, backup = await readFile(await download.path(), 'utf8');
  check(`${tag} export retains exact record`, same(JSON.parse(backup).records[id], saved));
  const fresh = await open(width, theme, d.fixture.data);
  try {
    await fresh.page.locator('#import-file').setInputFiles({ name: 'synthetic-later-evidence.json', mimeType: 'application/json', buffer: Buffer.from(backup) });
    await fresh.page.waitForFunction(({ key, id }) => JSON.parse(localStorage.getItem(key))?.records[id]?.saved, { key, id });
    check(`${tag} empty-profile import retains exact record`, same(await readRecord(fresh.page), saved));
    fresh.fixture.data = withEvidence(laterEvidence);
    await fresh.page.reload(); await fresh.page.locator('#result-count').waitFor();
    await fresh.page.locator('button[data-view="shortlist"]').click();
    check(`${tag} reappearance keeps one record and the same evidence`, await fresh.page.locator(`.saved-row[data-home="${id}"]`).count() === 1 && same(await readRecord(fresh.page), saved));
    check(`${tag} isolated journeys have no page errors`, d.errors.length === 0 && fresh.errors.length === 0, [...d.errors, ...fresh.errors].join('; '));
  } finally { await fresh.context.close(); }
}
try {
  await new Promise((done, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', done); });
  origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch();
  const cases = archivedUpdates ? [[1280, 'light'], [320, 'dark']] : baseline ? [[390, 'light']] : [1280, 390, 320].flatMap(width => ['light', 'dark'].map(theme => [width, theme]));
  for (const [width, theme] of cases) {
    const tag = `${width}-${theme}`, d = await open(width, theme, archivedUpdates ? withEvidence(originalEvidence) : feed), p = d.page;
    try {
      if (archivedUpdates) { await archivedUpdateJourney(d, tag, width, theme); continue; }
      await find(p, '2030 Greenwood');
      const card = p.locator(`#results [data-home="${id}"]`);
      await card.waitFor({ state: 'visible' });
      if (baseline) {
        check('baseline exact $1,271 record omits the sourced condition', !home.eligibility_evidence && !/income.restricted|inclusionary/i.test(await card.innerText()));
        await card.scrollIntoViewIfNeeded(); await shot(p, 'baseline-390-light-discover');
        continue;
      }
      check(`${tag} Discover shows condition beside retained price`, /\$1,271/.test(await card.innerText()) && /Income-restricted housing advertised at this address/.test(await card.innerText()));
      await card.locator('.eligibility-note').scrollIntoViewIfNeeded();
      await fit(p, `${tag} condition wraps without clipping`, '#results .eligibility-note');
      await shot(p, `${tag}-discover`);
      await card.locator('[data-task-target="detail-eligibility"]').click();
      check(`${tag} source/date control opens the scoped evidence`, await p.locator('#detail-eligibility').getAttribute('open') !== null);
      const details = await p.locator('#detail-eligibility').innerText();
      check(`${tag} actual source day and offer uncertainty are accessible`, /Source observed Sep 19, 2026/.test(details) && /exact offer unconfirmed/.test(details));
      check(`${tag} safe source link is reachable`, await p.locator('#detail-eligibility a').getAttribute('href') === home.eligibility_evidence.source.url);
      await fit(p, `${tag} dossier evidence fits`, '#detail-eligibility');
      await shot(p, `${tag}-source`);
      await p.locator(`#detail-content [data-save="${id}"]`).click();
      await p.locator(`#detail-content [data-compare="${id}"]`).check();
      await p.locator('#detail-dialog .dock-close').click();
      await jump(p, other);
      await p.locator(`#detail-content [data-compare="${other.id}"]`).check();
      await p.locator('#detail-dialog .dock-close').click();
      await p.locator('#open-compare').click();
      const comparison = await p.locator('#compare-content').innerText();
      check(`${tag} comparison separates annotated from unknown evidence`, /Income-restricted housing advertised/.test(comparison) && /Eligibility evidence not recorded. Restrictions unknown/.test(comparison));
      const comparisonRow = width > 780 ? '.matrix-desktop tr' : '.sc-compare-pair__measure';
      await p.locator(comparisonRow).filter({ hasText: 'Eligibility evidence' }).scrollIntoViewIfNeeded();
      await shot(p, `${tag}-comparison`);
      await p.locator('#compare-dialog [data-close]').first().click();
      await p.locator('[data-view="shortlist"]').click();
      const row = p.locator(`.saved-row[data-home="${id}"]`);
      check(`${tag} saved summary retains the condition`, /Income-restricted/.test(await row.locator('.eligibility-note').innerText()));
      await row.locator('.saved-more > summary').click();
      await row.locator('[data-finalist]').click();
      check(`${tag} finalist retains condition`, /Income-restricted/.test(await p.locator('.finalist-candidate .eligibility-note').innerText()));
      const saved = await p.evaluate(key => JSON.parse(localStorage.getItem(key)), key);
      check(`${tag} saved snapshot has exact annotation`, JSON.stringify(saved.records[id].snapshot.eligibility_evidence) === JSON.stringify(home.eligibility_evidence));
      await p.reload(); await p.locator('#result-count').waitFor();
      const reloaded = await p.evaluate(key => JSON.parse(localStorage.getItem(key)), key);
      check(`${tag} reload preserves snapshot and save dates`, JSON.stringify(reloaded.records[id]) === JSON.stringify(saved.records[id]));
      await p.locator('[data-view="setup"]').click();
      const downloaded = p.waitForEvent('download'); await p.locator('#export-notebook').click();
      const download = await downloaded;
      const text = await readFile(await download.path(), 'utf8');
      check(`${tag} export retains the exact saved record`, JSON.stringify(JSON.parse(text).records[id]) === JSON.stringify(saved.records[id]));
      const fresh = await open(width, theme);
      try {
        await fresh.page.locator('#import-file').setInputFiles({ name: 'synthetic-notebook.json', mimeType: 'application/json', buffer: Buffer.from(text) });
        await fresh.page.waitForFunction(({ key, id }) => JSON.parse(localStorage.getItem(key))?.records[id]?.saved, { key, id });
        const imported = await fresh.page.evaluate(key => JSON.parse(localStorage.getItem(key)), key);
        check(`${tag} separate empty profile imports exact snapshot`, JSON.stringify(imported.records[id]) === JSON.stringify(saved.records[id]));
        fresh.fixture.data = { ...feed, homes: feed.homes.filter(h => h.id !== id) };
        await fresh.page.reload(); await fresh.page.locator('#result-count').waitFor();
        await fresh.page.locator('[data-view="shortlist"]').click();
        const archived = fresh.page.locator(`.saved-row[data-home="${id}"]`);
        check(`${tag} archived fixture keeps sourced condition`, /Archived notebook entry/.test(await archived.innerText()) && /Income-restricted/.test(await archived.innerText()));
        await archived.locator('[data-detail]').click();
        await fresh.page.locator('#detail-eligibility > summary').click();
        check(`${tag} archived evidence retains its source day`, /Sep 19, 2026/.test(await fresh.page.locator('#detail-eligibility').innerText()));
        await fit(fresh.page, `${tag} archived evidence fits`, '#detail-eligibility');
        await shot(fresh.page, `${tag}-archived`);
        check(`${tag} neither isolated profile has page errors`, d.errors.length === 0 && fresh.errors.length === 0, [...d.errors, ...fresh.errors].join('; '));
      } finally { await fresh.context.close(); }
    } catch (error) {
      if (!archivedUpdates) throw error;
      console.error(error); process.exitCode = 1;
      results.push({ name: `${tag} archived update journey completion`, ok: false, detail: String(error.stack || error) });
    } finally { await d.context.close(); }
  }
} catch (error) {
  results.push({ name: 'journey completion', ok: false, detail: String(error.stack || error) });
  console.error(error);
  process.exitCode = 1;
} finally {
  await browser?.close(); server.close();
  await writeFile(join(out, 'results.json'), JSON.stringify({ baseline, archivedUpdates, results }, null, 2) + '\n');
}
console.log(`${results.filter(x => x.ok).length}/${results.length} passed`);

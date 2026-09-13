// Real-browser verification for the behaviour jsdom cannot judge: where things
// land on a screen, and which place a press on the map actually selects.
//
//   node tools/browser_check.mjs [--shots <directory>]
//
// Serves the committed dist/ over a local port and answers the remote feed with
// the committed dist/data.json, so every run reads the same records. Playwright
// and Chromium must be installed; without them this reports SKIP and exits 1,
// the way the design system's own browser gate does.
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { dirname, join, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const argv = process.argv.slice(2);
const shots = argv.includes('--shots') ? argv[argv.indexOf('--shots') + 1] : null;
const FEED = readFileSync(join(DIST, 'data.json'), 'utf8');
const STATUS = readFileSync(join(DIST, 'status.json'), 'utf8');
const EMPTY = JSON.stringify({ ...JSON.parse(FEED), homes: [] });
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.ico': 'image/x-icon' };
const PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

let chromium;
try { ({ chromium } = await import('playwright')); }
catch { console.log('  SKIP browser check: Playwright unavailable; no rendered verification performed.'); process.exit(1); }

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);
};

const server = createServer(async (req, res) => {
  const path = resolve(DIST, '.' + decodeURIComponent(req.url.split('?')[0]));
  if (!(path + sep).startsWith(DIST + sep)) { res.writeHead(403).end(); return; }
  try {
    const body = await readFile(path.endsWith(sep) || path === DIST ? join(DIST, 'index.html') : path);
    res.writeHead(200, { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream' }).end(body);
  } catch { res.writeHead(404).end('not found'); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;

// feed: 'ok' | 'stale' | 'fail' | 'empty' — the committed records unless named otherwise
async function open(browser, { width = 1280, height = 900, theme = 'dark', mobile = false,
  motion = 'no-preference', feed = 'ok', tiles = 'blank', storage = null, zoom = 1 } = {}) {
  const context = await browser.newContext({
    viewport: { width: Math.round(width / zoom), height: Math.round(height / zoom) },
    isMobile: mobile, hasTouch: mobile, colorScheme: theme, reducedMotion: motion,
  });
  await context.route('**/raw.githubusercontent.com/**', (route) => {
    const url = route.request().url();
    if (feed === 'fail') return route.abort();
    if (url.includes('status.json'))
      return route.fulfill({ status: 200, contentType: 'application/json',
        body: feed === 'stale'
          ? JSON.stringify({ schema_version: 1, attempted_at: '2026-08-01T13:24:40Z', status: 'error',
              message: 'Provider request failed.' })
          : STATUS });
    return route.fulfill({ status: 200, contentType: 'application/json', body: feed === 'empty' ? EMPTY : FEED });
  });
  await context.route('**/api.github.com/**', (route) => route.abort());
  await context.route('**/tile.openstreetmap.org/**', (route) =>
    tiles === 'fail' ? route.abort() : route.fulfill({ status: 200, contentType: 'image/png', body: PIXEL }));
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.addInitScript((entries) => {
    for (const [k, v] of Object.entries(entries ?? {})) { try { localStorage.setItem(k, v); } catch {} }
  }, { 'sc-theme': theme, ...(storage ?? {}) });
  await page.goto(`${base}/index.html`, { waitUntil: 'load' });
  await page.waitForFunction(() => !document.querySelector('#view-content')?.textContent?.includes('Loading your apartment'),
    null, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(600);
  return { context, page, errors };
}
const shot = async (page, name) => { if (shots) { await mkdir(shots, { recursive: true }); await page.screenshot({ path: join(shots, name + '.png') }); } };

const browser = await chromium.launch();
try {
  // --- 1. a press on the map selects a place the mark actually holds --------
  for (const [label, size] of [['390px', { width: 390, height: 844, mobile: true }], ['1280px', {}]]) {
    const { context, page, errors } = await open(browser, { ...size, theme: 'dark' });
    await page.waitForTimeout(900);
    const marks = await page.evaluate(() => document.querySelectorAll('.home-map-marker').length);
    const listed = await page.evaluate(() => document.querySelectorAll('#map-list [data-map-home]').length);
    check(`${label} the map draws separable marks for ${listed} places`, marks > 0 && marks < listed / 4,
      `${marks} marks for ${listed} places`);
    const crowding = await page.evaluate(() => {
      const pts = [...document.querySelectorAll('.home-map-marker')].map((m) => {
        const r = m.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      });
      return pts.filter((p) => pts.some((q) => q !== p && Math.hypot(p.x - q.x, p.y - q.y) < 22)).length;
    });
    check(`${label} no mark hides another mark's centre`, crowding === 0, `${crowding} overlapping`);
    // press every mark at its own centre
    const sweep = await page.evaluate(async () => {
      const out = { tested: 0, asked: 0, taken: 0, wrong: 0 };
      const pane = document.querySelector('#map').getBoundingClientRect();
      for (const m of document.querySelectorAll('.home-map-marker')) {
        const r = m.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        if (cx < pane.left + 20 || cx > pane.right - 20 || cy < pane.top + 20 || cy > pane.bottom - 20) continue;
        out.tested++;
        m.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, clientX: cx, clientY: cy }));
        await new Promise((res) => setTimeout(res, 0));
        const panel = document.querySelector('#map-pick');
        const held = Number(/^(\d+) options/.exec(m.querySelector('.map-marker-label')?.textContent ?? '')?.[1] ?? 1);
        if (panel && !panel.hidden) {
          out.asked++;
          if (Number(/^(\d+)/.exec(panel.querySelector('h4').textContent)[1]) < held) out.wrong++;
          panel.hidden = true; panel.innerHTML = '';
        } else { out.taken++; if (held > 1) out.wrong++; }
      }
      return out;
    });
    check(`${label} every press at a mark's own centre is resolved by distance`,
      sweep.tested > 0 && sweep.wrong === 0 && sweep.asked + sweep.taken === sweep.tested, JSON.stringify(sweep));
    check(`${label} no page errors while pressing the map`, errors.length === 0, errors.slice(0, 2).join(' '));
    await context.close();
  }

  // --- 2. the pick behaves like a popover, and its exits work ---------------
  {
    const { context, page } = await open(browser, { width: 390, height: 844, mobile: true, theme: 'dark' });
    await page.waitForTimeout(900);
    await page.evaluate(() => document.querySelector('#map').scrollIntoView({ block: 'center' }));
    await page.waitForTimeout(300);
    const big = await page.evaluate(() => {
      const n = (m) => Number(/^(\d+) options/.exec(m.querySelector('.map-marker-label')?.textContent ?? '')?.[1] ?? 1);
      const m = [...document.querySelectorAll('.home-map-marker')].sort((a, b) => n(b) - n(a))[0];
      const r = m.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, count: n(m) };
    });
    await page.mouse.move(big.x, big.y); await page.mouse.down(); await page.mouse.up();
    await page.waitForTimeout(250);
    const panel = await page.evaluate(() => {
      const p = document.querySelector('#map-pick'), mr = document.querySelector('#map').getBoundingClientRect();
      const pr = p.getBoundingClientRect();
      return { hidden: p.hidden, modal: p.getAttribute('aria-modal'), role: p.getAttribute('role'),
        labelled: !!document.getElementById(p.getAttribute('aria-labelledby')),
        head: p.querySelector('h4').textContent, items: p.querySelectorAll('.sc-pick__item').length,
        target: Math.round(p.querySelector('.sc-pick__item').getBoundingClientRect().height),
        focus: document.activeElement.className, popups: document.querySelectorAll('.leaflet-popup').length,
        more: p.querySelector('.sc-pick__more').textContent,
        inside: pr.left >= mr.left - 1 && pr.right <= mr.right + 1 && pr.top >= mr.top - 1 && pr.bottom <= mr.bottom + 1 };
    });
    check('a crowded press asks instead of opening a popup', !panel.hidden && panel.popups === 0, panel.head);
    check('the panel is a popover, not a modal', panel.modal === null && panel.role === 'dialog' && panel.labelled);
    check('the nearest place takes the focus', /sc-pick__item/.test(panel.focus), panel.focus);
    check('options keep a 44px target', panel.target >= 44, panel.target + 'px');
    check('the panel stays inside the map', panel.inside);
    check('a crowd too large to name offers the zoom that separates it',
      /Zoom in to separate the other \d+/.test(panel.more), panel.more);
    await shot(page, 'map-pick-390');
    const before = await page.evaluate(() => document.querySelectorAll('.home-map-marker').length);
    await page.evaluate(() => document.querySelector('#map-pick .sc-pick__more').click());
    await page.waitForTimeout(900);
    const after = await page.evaluate(() => ({ marks: document.querySelectorAll('.home-map-marker').length,
      hidden: document.querySelector('#map-pick').hidden }));
    check('the zoom separates the crowd and closes the panel', after.marks > before && after.hidden,
      `${before} marks -> ${after.marks}`);
    // Escape returns to what opened the panel, never to a mark
    await page.evaluate(() => document.querySelector('#map').scrollIntoView({ block: 'center' }));
    await page.waitForTimeout(300);
    const small = await page.evaluate(() => {
      const n = (m) => Number(/^(\d+) options/.exec(m.querySelector('.map-marker-label')?.textContent ?? '')?.[1] ?? 1);
      const pane = document.querySelector('#map').getBoundingClientRect();
      const inside = [...document.querySelectorAll('.home-map-marker')].filter((m) => {
        const r = m.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        return n(m) > 1 && n(m) <= 12 && cx > pane.left + 24 && cx < pane.right - 24
          && cy > Math.max(pane.top, 0) + 24 && cy < Math.min(pane.bottom, innerHeight) - 24;
      }).sort((a, b) => n(a) - n(b));
      const m = inside[0];
      if (!m) return null;
      const r = m.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, count: n(m) };
    });
    check('the zoomed map offers a crowd small enough to name one by one', !!small,
      small ? `${small.count} places` : 'none in view');
    if (small) {
      await page.mouse.move(small.x, small.y); await page.mouse.down(); await page.mouse.up();
      await page.waitForTimeout(250);
      const listable = await page.evaluate(() => {
        const p = document.querySelector('#map-pick');
        const more = p.querySelector('.sc-pick__more');
        return { open: !p.hidden, zoom: more.dataset.mapPickZoom, text: more.hidden ? null : more.textContent,
          items: p.querySelectorAll('.sc-pick__item').length,
          claimed: Number(/^(\d+)/.exec(p.querySelector('h4').textContent)[1]) };
      });
      check('a crowd small enough to name lists the rest instead of zooming',
        listable.open && listable.zoom === 'no'
          && (listable.text === null
            ? listable.items === listable.claimed
            : listable.items + Number(/other (\d+)/.exec(listable.text)[1]) === listable.claimed),
        JSON.stringify(listable));
      await page.keyboard.press('Escape');
      await page.waitForTimeout(250);
      const escaped = await page.evaluate(() => ({ hidden: document.querySelector('#map-pick').hidden,
        marker: !!document.activeElement.closest?.('.home-map-marker'),
        active: document.activeElement.id || document.activeElement.className }));
      check('Escape closes and never lands on a map mark', escaped.hidden && !escaped.marker, escaped.active);
    }
    // renderMap() runs again on every filter change over the same #map element:
    // one panel must exist, and one press must still open exactly one.
    await page.evaluate(() => { window.scrollTo(0, 0); document.querySelector('[data-bed="1"]').click(); });
    await page.waitForTimeout(700);
    await page.evaluate(() => document.querySelector('[data-bed="all"]').click());
    await page.waitForTimeout(900);
    await page.evaluate(() => document.querySelector('#map').scrollIntoView({ block: 'center' }));
    await page.waitForTimeout(300);
    const redrawn = await page.evaluate(() => document.querySelectorAll('#map > .sc-pick').length);
    check('a redrawn map keeps exactly one panel', redrawn === 1, String(redrawn));
    const again = await page.evaluate(async () => {
      const n = (m) => Number(/^(\d+) options/.exec(m.querySelector('.map-marker-label')?.textContent ?? '')?.[1] ?? 1);
      const m = [...document.querySelectorAll('.home-map-marker')].sort((a, b) => n(b) - n(a))[0];
      const r = m.getBoundingClientRect();
      m.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true,
        clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }));
      await new Promise((res) => setTimeout(res, 0));
      const p = document.querySelector('#map-pick');
      const out = { open: !p.hidden, heads: p.querySelectorAll('h4').length, items: p.querySelectorAll('.sc-pick__item').length };
      p.hidden = true; p.innerHTML = '';
      return out;
    });
    check('a press after a redraw still opens one panel with one heading',
      again.open && again.heads === 1 && again.items > 0, JSON.stringify(again));

    // the list is still the precise path to a named place
    const named = await page.evaluate(async () => {
      const b = document.querySelector('#map-list [data-map-home]');
      const want = b.querySelector('strong').textContent;
      document.querySelector('.map-directory').open = true;
      b.click();
      await new Promise((r) => setTimeout(r, 800));
      const popup = document.querySelector('.leaflet-popup-content .map-options');
      return { want, got: popup?.querySelector('.map-plan strong')?.textContent ?? null };
    });
    check('the list reaches a named place without aiming', named.got?.startsWith(named.want), `${named.want} -> ${named.got}`);
    await context.close();
  }

  // --- 3. choosing a surface brings it to the first screen ------------------
  for (const [label, size] of [['390px', { width: 390, height: 844, mobile: true }], ['1280px', {}]])
    for (const motion of ['no-preference', 'reduce']) {
      const { context, page } = await open(browser, { ...size, theme: 'dark', motion });
      const height = size.height ?? 900;
      for (const surface of ['map', 'list', 'focus', 'atlas', 'split']) {
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForTimeout(120);
        await page.click(`button[data-surface="${surface}"]`);
        await page.waitForTimeout(900);
        const m = await page.evaluate((s) => {
          const sel = { map: '.map-panel', split: '.map-panel', list: '.results-column',
            focus: '#focus-surface', atlas: '#atlas-surface' }[s];
          const r = document.querySelector(sel).getBoundingClientRect();
          return { top: Math.round(r.top), focused: document.activeElement?.dataset?.surface === s };
        }, surface);
        check(`${label} ${motion} · ${surface} reaches the first screen`,
          m.top >= -2 && m.top <= height * 0.25, `top ${m.top}`);
        check(`${label} ${motion} · ${surface} keeps the pressed control focused`, m.focused);
      }
      await context.close();
    }

  // --- 4. the plan and its cost evidence reach the first dialog screen ------
  for (const [label, size] of [['390px', { width: 390, height: 844, mobile: true }], ['1280px', {}]]) {
    const { context, page } = await open(browser, { ...size, theme: 'light' });
    await page.click('#results .home-card [data-detail]');
    await page.waitForTimeout(400);
    const m = await page.evaluate(() => {
      const d = document.querySelector('#detail-dialog'), box = d.getBoundingClientRect();
      const at = (sel) => { const e = d.querySelector(sel); if (!e) return null;
        const r = e.getBoundingClientRect(); return Math.round(r.top - box.top + d.scrollTop); };
      const rows = new Set([...d.querySelectorAll('.detail-dock a, .detail-dock button')]
        .map((b) => Math.round(b.getBoundingClientRect().top)));
      return { dialog: Math.round(box.height), dockRows: rows.size, callout: at('.callout'),
        first: at('.layout-review'), save: !!d.querySelector('.detail-dock [form="record-form"]'),
        links: [...d.querySelectorAll('.detail-links a')].length };
    });
    check(`${label} the dock stays within two rows`, m.dockRows <= 2, `${m.dockRows} rows`);
    check(`${label} the record's own sentence comes before the links away from it`, m.callout < m.first);
    check(`${label} the layout evidence starts on the first dialog screen`, m.first < m.dialog,
      `section at ${m.first} of ${m.dialog}px`);
    check(`${label} every external link and the dock's save survive`, m.links >= 3 && m.save, `${m.links} links`);
    await shot(page, `detail-${label}`);
    await context.close();
  }

  // --- 5. the states the map and the feed can be in -------------------------
  {
    const { context, page, errors } = await open(browser, { width: 390, height: 844, mobile: true, tiles: 'fail' });
    await page.waitForTimeout(900);
    const tiles = await page.evaluate(() => ({ marks: document.querySelectorAll('.home-map-marker').length,
      list: document.querySelectorAll('#map-list [data-map-home]').length }));
    check('missing tiles leave every mark and every listed place', tiles.marks > 0 && tiles.list > 0, JSON.stringify(tiles));
    check('missing tiles raise no page error', errors.length === 0, errors.slice(0, 2).join(' '));
    await context.close();
  }
  for (const feed of ['stale', 'fail', 'empty']) {
    const { context, page, errors } = await open(browser, { width: 390, height: 844, mobile: true, feed });
    const state = await page.evaluate(() => ({
      notice: document.querySelector('#source-status-label')?.textContent?.trim() ?? '',
      count: document.querySelector('#result-count')?.textContent ?? '',
      body: document.querySelector('#view-content')?.textContent ?? '',
      undefineds: (document.querySelector('#view-content')?.textContent ?? '').match(/undefined|NaN/g)?.length ?? 0,
    }));
    check(`a ${feed} feed still says where it stands`, state.notice.length > 0, state.notice.slice(0, 70));
    check(`a ${feed} feed prints no undefined or NaN`, state.undefineds === 0, String(state.undefineds));
    check(`a ${feed} feed raises no page error`, errors.length === 0, errors.slice(0, 2).join(' '));
    await shot(page, `feed-${feed}`);
    await context.close();
  }

  // --- 6. 320px, 200% zoom, keyboard -------------------------------------
  for (const [label, opts] of [['320px', { width: 320, height: 640, mobile: true }],
                               ['200% zoom', { width: 1280, height: 900, zoom: 2 }]]) {
    const { context, page } = await open(browser, { ...opts, theme: 'dark' });
    await page.waitForTimeout(900);
    const flow = await page.evaluate(() => {
      const de = document.documentElement, over = [];
      for (const el of document.querySelectorAll('body *')) {
        const r = el.getBoundingClientRect();
        if (!r.width || r.right <= de.clientWidth + 1) continue;
        const s = getComputedStyle(el);
        if (s.position === 'fixed') continue;
        let scrolled = false;
        for (let p = el.parentElement; p; p = p.parentElement)
          if (/auto|scroll|hidden/.test(getComputedStyle(p).overflowX)) { scrolled = true; break; }
        if (!scrolled) over.push(el.tagName + '.' + String(el.className).slice(0, 40));
      }
      return { sideways: de.scrollWidth > de.clientWidth + 1, over: over.slice(0, 4) };
    });
    check(`${label} the page does not scroll sideways`, !flow.sideways, flow.over.join(' '));
    await shot(page, `reflow-${label.replace(/[^a-z0-9]/gi, '')}`);
    await context.close();
  }
  {
    const { context, page } = await open(browser, { width: 390, height: 844, mobile: true });
    await page.evaluate(() => document.querySelector('#map').scrollIntoView({ block: 'center' }));
    const reached = await page.evaluate(async () => {
      document.querySelector('.map-directory').open = true;
      const first = document.querySelector('#map-list [data-map-home]');
      first.focus();
      return document.activeElement === first;
    });
    check('the map directory is reachable by keyboard', reached);
    await context.close();
  }

  // --- 7. a saved shortlist and a damaged notebook survive a reload --------
  {
    const { context, page } = await open(browser, { width: 390, height: 844, mobile: true });
    await page.evaluate(() => document.querySelectorAll('#results .home-card [data-save]').forEach((b, i) => { if (i < 2) b.click(); }));
    await page.waitForTimeout(300);
    const saved = await page.evaluate(() => document.querySelector('#saved-count').textContent);
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(1800);
    const back = await page.evaluate(() => document.querySelector('#saved-count').textContent);
    check('a saved shortlist survives a reload', saved === '2' && back === '2', `${saved} -> ${back}`);
    await context.close();
  }
  {
    const { context, page, errors } = await open(browser, { width: 390, height: 844, mobile: true,
      storage: { 'spicyhome.workspace.v1': '{ this is not json' } });
    await page.waitForTimeout(900);
    const recovered = await page.evaluate(() => ({
      body: document.body.textContent.includes('notebook') || document.body.textContent.includes('backup'),
      results: document.querySelectorAll('#results .home-card').length,
    }));
    check('an unreadable notebook still renders the apartments and offers recovery',
      recovered.results > 0 && recovered.body, JSON.stringify(recovered));
    check('an unreadable notebook raises no page error', errors.length === 0, errors.slice(0, 2).join(' '));
    await context.close();
  }
} finally {
  await browser.close();
  server.close();
}
const failed = results.filter((r) => !r.ok);
console.log(`browser-check: ${results.length - failed.length}/${results.length} scenarios passed`);
if (failed.length) process.exit(1);

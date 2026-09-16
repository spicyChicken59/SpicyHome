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
    // A mark is only honest if it sits where its coordinates put it. Leaflet
    // places every marker by a transform off one pane origin, so what is left of
    // a mark's position once its own transform is subtracted must be the same
    // point for all of them. A stylesheet that takes a marker out of
    // `position: absolute` returns it to normal flow, and each mark then slides
    // down the pane by its own place in the DOM -- every mark over the wrong
    // building, while the marks still look evenly spread.
    const drift = await page.evaluate(() => {
      const origins = [...document.querySelectorAll('.home-map-marker')].map((m) => {
        const r = m.getBoundingClientRect();
        const t = /translate3d\((-?[\d.]+)px,\s*(-?[\d.]+)px/.exec(m.style.transform);
        return t ? { x: r.left + r.width / 2 - Number(t[1]), y: r.top + r.height / 2 - Number(t[2]) } : null;
      });
      if (!origins.length || origins.some((o) => o === null)) return { read: false, worst: Infinity };
      const first = origins[0];
      return { read: true, worst: Math.max(...origins.map((o) => Math.hypot(o.x - first.x, o.y - first.y))) };
    });
    check(`${label} every mark sits where its coordinates put it`, drift.read && drift.worst < 0.5,
      drift.read ? `worst ${drift.worst.toFixed(1)}px off the pane origin` : 'no mark reported a position');
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

  // --- 8. the controls that decide what you see, and the tray that holds -----
  //        what you chose. Both are questions about position on a screen: how
  //        far apart two presentation controls sit, and what a floating tray
  //        covers. Measured at `main` before this section existed: the view
  //        switch and the list-style switch were 869px apart at 1280 and
  //        1,561px apart on a phone, with no visible caption on either, beside
  //        a bedroom filter drawn in the same pills.
  for (const [label, opts] of [['1280px', {}], ['390px', { width: 390, height: 844, mobile: true }],
                               ['320px', { width: 320, height: 640, mobile: true }]]) {
    const { context, page, errors } = await open(browser, { ...opts, theme: 'dark' });
    await page.waitForTimeout(500);
    const deck = await page.evaluate(() => {
      const mid = (el) => { const r = el.getBoundingClientRect(); return r.top + scrollY + r.height / 2; };
      const view = document.querySelector('#surface-switch'), rows = document.querySelector('#density-switch');
      const beds = document.querySelector('#bed-switch');
      const captions = [...document.querySelectorAll('.explore-deck .sc-field__label')]
        .map((el) => ({ text: el.textContent, shown: el.getBoundingClientRect().height > 0 }));
      return {
        modesApart: Math.round(Math.abs(mid(view) - mid(rows))),
        filterApart: Math.round(Math.abs(mid(view) - mid(beds))),
        captions,
        sameBand: view.closest('.explore-band') === rows.closest('.explore-band'),
        filterBand: beds.closest('.explore-band') !== view.closest('.explore-band'),
      };
    });
    check(`${label} both presentation controls sit in one band`,
      deck.sameBand && deck.modesApart < 120, `${deck.modesApart}px apart`);
    check(`${label} the bedroom filter is not in the presentation band`,
      deck.filterBand && deck.filterApart > 0, `${deck.filterApart}px from the view switch`);
    check(`${label} every control group carries a caption a reader can see`,
      deck.captions.length === 3 && deck.captions.every((c) => c.shown && c.text.trim()),
      deck.captions.map((c) => c.text).join(','));
    // The tray floats over the page. It must clear the phone's navigation, and
    // it must not take a screen to say what it holds.
    const tray = await page.evaluate(async () => {
      for (const box of [...document.querySelectorAll('#results [data-compare]')].slice(0, 3)) box.click();
      await new Promise((r) => setTimeout(r, 250));
      const el = document.querySelector('#compare-tray'), r = el.getBoundingClientRect();
      const nav = document.querySelector('.topbar nav').getBoundingClientRect();
      return {
        height: Math.round(r.height), viewport: Math.round(innerHeight),
        clearsNav: r.bottom <= nav.top + 1 || r.top >= nav.bottom - 1,
        names: [...el.querySelectorAll('.tray-name strong')].length,
        removes: el.querySelectorAll('[data-compare-remove]').length,
        action: !!el.querySelector('#open-compare'),
        sideways: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      };
    });
    check(`${label} the tray names all three, removes one at a time and offers the next action`,
      tray.names >= 3 && tray.removes === 3 && tray.action, JSON.stringify({ names: tray.names, removes: tray.removes }));
    // Two separate promises. The tray must never sit over the navigation, and
    // it must never HAVE to cover the apartments: folding its identity list
    // away leaves a compact bar at every width. Where it opens by default --
    // a wide screen, where there is room -- it may be taller than that.
    check(`${label} the tray clears the navigation`, tray.clearsNav,
      `${tray.height}px of ${tray.viewport}px, nav ${tray.clearsNav ? 'clear' : 'covered'}`);
    const folded = await page.evaluate(async () => {
      const list = document.querySelector('#compare-tray .tray-list');
      const was = list.open;
      list.open = false;
      await new Promise((r) => setTimeout(r, 150));
      const height = Math.round(document.querySelector('#compare-tray').getBoundingClientRect().height);
      list.open = was;
      return height;
    });
    check(`${label} a folded tray is a compact bar`, folded < 200, `${folded}px folded, ${tray.height}px as it opens`);
    // Chromium still lays a closed <details>'s content out -- it paints nothing
    // and refuses it the focus, but the boxes are there, off the bar. Folded
    // means gone from the layout, not merely unpainted.
    const phantom = await page.evaluate(async () => {
      const list = document.querySelector('#compare-tray .tray-list');
      const was = list.open;
      list.open = false;
      await new Promise((r) => setTimeout(r, 150));
      const boxes = [...list.querySelectorAll('[data-compare-remove]')]
        .filter((b) => b.offsetParent || b.getBoundingClientRect().height).length;
      list.open = was;
      return boxes;
    });
    check(`${label} a folded tray draws no box for what it is hiding`, phantom === 0, `${phantom} still laid out`);
    check(`${label} on a phone it opens folded and stays under a third of the screen`,
      tray.viewport > 720 || (tray.height < tray.viewport / 3 && tray.height === folded),
      `${tray.height}px of ${tray.viewport}px`);
    check(`${label} a full tray does not push the page sideways`, !tray.sideways);
    check(`${label} the explore deck and the tray raise no page error`, errors.length === 0, errors.slice(0, 2).join(' '));
    await shot(page, `deck-${label}`);
    await context.close();
  }

  // --- 9. the atlas axes are readings, not arbitrary fractions ---------------
  {
    const { context, page } = await open(browser, { width: 1280, height: 900, theme: 'dark' });
    await page.evaluate(() => document.querySelector('[data-surface="atlas"]').click());
    await page.waitForTimeout(700);
    const axes = await page.evaluate(() => {
      const svg = document.querySelector('#atlas-surface svg');
      const labels = [...svg.querySelectorAll('text')].map((t) => t.textContent.trim())
        .filter((t) => /^[$\d,]+$/.test(t));
      const rings = svg.querySelectorAll('.atlas-ring').length;
      return { labels, unique: new Set(labels).size, rings,
        plotted: document.querySelector('.atlas-heading > p').textContent.trim() };
    });
    check('the atlas prints no axis label twice', axes.labels.length === axes.unique,
      axes.labels.join(' '));
    check('every atlas axis label is a round number', axes.labels.length >= 4 &&
      axes.labels.every((t) => /^\$?[\d,]+$/.test(t) && Number(t.replace(/[$,]/g, '')) % 50 === 0),
      axes.labels.join(' '));
    check('the atlas rings exactly one selected point', axes.rings === 1, String(axes.rings));
    check('the atlas says how many matches it could not place', /plotted/.test(axes.plotted), axes.plotted);
    await shot(page, 'atlas-1280px');
    await context.close();
  }


  // --- 10. the shared record comparison, where two columns are not enough ----
  //         The design system's .sc-compare-pair (v2.13.0) makes claims only a
  //         browser can judge, and it has to keep making them inside this app's
  //         own scrolling dialog: both identities on screen while the measures
  //         scroll past, equal room for both values, and no sideways scroll.
  for (const [label, opts] of [['390px', { width: 390, height: 844, mobile: true }],
                               ['320px', { width: 320, height: 640, mobile: true }]]) {
    const { context, page, errors } = await open(browser, { ...opts, theme: 'dark' });
    const pair = await page.evaluate(async () => {
      for (const box of [...document.querySelectorAll('#results [data-compare]')].slice(0, 3)) box.click();
      await new Promise((r) => setTimeout(r, 250));
      document.querySelector('#open-compare').click();
      await new Promise((r) => setTimeout(r, 450));
      const view = document.querySelector('.compare-pair');
      const shown = (el) => !!el && getComputedStyle(el).display !== 'none';
      const values = [...view.querySelectorAll('.sc-compare-pair__values')];
      const columns = values.map((row) => [...row.children].map((v) => Math.round(v.getBoundingClientRect().width)));
      return {
        pair: shown(view), matrix: shown(document.querySelector('.matrix-desktop')),
        sticky: getComputedStyle(view.querySelector('.sc-compare-pair__heads')).position,
        measures: view.querySelectorAll('.sc-compare-pair__measure').length,
        markedLabels: view.querySelectorAll('.sc-compare-pair__measure[data-differs="true"]').length,
        markedValues: view.querySelectorAll('.sc-compare-pair__value[data-differs], .sc-compare-pair__value.is-best').length,
        choosers: view.querySelectorAll('[data-pair-side]').length,
        even: columns.every((row) => row.length === 2 && Math.abs(row[0] - row[1]) <= 1),
        sideways: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      };
    });
    check(`${label} the phone gets the pair view and not the matrix`, pair.pair && !pair.matrix);
    check(`${label} both values get equal room`, pair.even && pair.measures > 0, `${pair.measures} measures`);
    check(`${label} the difference is marked on labels only, and nothing is called best`,
      pair.markedLabels > 0 && pair.markedValues === 0, `${pair.markedLabels} labels, ${pair.markedValues} values`);
    check(`${label} a third selected place is a choice, not a truncation`, pair.choosers === 2, `${pair.choosers} choosers`);
    check(`${label} the comparison does not scroll sideways`, !pair.sideways);
    // Scroll to the last measure: a value read against the wrong place is worse
    // than a value not read at all, so the identities have to still be there.
    const held = await page.evaluate(async () => {
      [...document.querySelectorAll('.sc-compare-pair__measure')].pop().scrollIntoView({ block: 'end' });
      await new Promise((r) => setTimeout(r, 300));
      const heads = document.querySelector('.sc-compare-pair__heads').getBoundingClientRect();
      const box = document.querySelector('#compare-dialog').getBoundingClientRect();
      return { on: heads.bottom > box.top && heads.top < box.bottom && heads.height > 0,
        names: [...document.querySelectorAll('.sc-compare-pair__head .sc-eyebrow')].map((e) => e.textContent.trim()) };
    });
    check(`${label} both identities stay on screen at the last measure`, held.on && held.names.length === 2,
      held.names.join(' | '));
    // .sc-eyebrow lowercases; a building name is a proper noun. textContent
    // returns the source text and cannot see a CSS text-transform, so this
    // reads what the element is actually rendered with.
    const casing = await page.evaluate(() => [...document.querySelectorAll('.sc-compare-pair__head .sc-eyebrow')]
      .map((el) => getComputedStyle(el).textTransform));
    check(`${label} the identities keep their own casing`,
      casing.length === 2 && casing.every((t) => t === 'none'), casing.join(', '));
    check(`${label} the comparison raises no page error`, errors.length === 0, errors.slice(0, 2).join(' '));
    await shot(page, `pair-${label}`);
    await context.close();
  }

  // --- 7. the source route and the evidence behind it, on a screen ---------
  //         jsdom can say the words are in the markup. Only a browser can say
  //         the links wrap instead of pushing the page sideways, that a finger
  //         can hit them, and that the dated evidence is actually visible.
  const ARCHIVED = JSON.parse(FEED).homes.find((h) => h.kind === 'listing');
  // A home the current feed no longer carries: the notebook is keyed by the
  // snapshot's own id, which is how a saved record is read back.
  const ARCHIVED_ID = ARCHIVED.id + '-archived';
  const savedNotebook = JSON.stringify({
    version: 1, manual: [], events: [], preferences: {}, savedSearches: [],
    records: { [ARCHIVED_ID]: { saved: true, status: 'toured', notes: 'Ask about the garage waitlist',
      snapshot: { ...ARCHIVED, id: ARCHIVED_ID },
      scan: { basis: 'provider_query', city: 'Chicago', saved_at: '2026-09-09T14:00:00Z',
        feed_generated_at: '2026-09-09T13:00:00Z', observed_at: '2026-09-09T13:00:00Z',
        last_success: '2026-09-09T13:00:00Z', returned: 500, total: 4100, truncated: true, accepted: 500 } } },
  });
  for (const [label, opts] of [['1280px dark', { theme: 'dark' }],
                               ['1280px light', { theme: 'light' }],
                               ['390px dark', { width: 390, height: 844, mobile: true, theme: 'dark' }],
                               ['390px light', { width: 390, height: 844, mobile: true, theme: 'light' }]]) {
    const { context, page, errors } = await open(browser, opts);
    const read = await page.evaluate(async (id) => {
      const open = async (home) => {
        const button = [...document.querySelectorAll('[data-detail]')].find((b) => b.dataset.detail === home);
        if (!button) return { opened: null };
        button.click();
        await new Promise((r) => setTimeout(r, 350));
        const box = document.querySelector('#detail-content');
        const dialog = document.querySelector('#detail-dialog').getBoundingClientRect();
        const links = [...box.querySelectorAll('.detail-links a')].map((a) => {
          const r = a.getBoundingClientRect();
          return { text: a.textContent.trim(), h: Math.round(r.height), w: Math.round(r.width),
            inside: r.left >= dialog.left - 1 && r.right <= dialog.right + 1 };
        });
        const line = (sel) => { const el = box.querySelector(sel); if (!el) return null;
          const r = el.getBoundingClientRect();
          return { text: el.textContent.trim(), h: Math.round(r.height), inside: r.right <= dialog.right + 1 }; };
        const out = { opened: box.querySelector('[data-save]')?.dataset.save ?? null,
          links, access: line('.source-access'), dates: line('.source-dates'),
          references: [...box.querySelectorAll('.sourceline')].map((p) => p.textContent.trim()),
          charging: [...box.querySelectorAll('.fact-list li')].map((li) => li.textContent.trim()),
          costRows: [...box.querySelectorAll('.cost-table tr')].map((r) => r.textContent.trim()),
          sideways: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1 };
        document.querySelector('#detail-dialog').close();
        return out;
      };
      const curated = await open('amli-lofts');
      const provider = await open(id);
      return { curated, provider };
    }, ARCHIVED.id);
    const hitable = (r) => r.links.every((l) => l.h >= 24 && l.w > 0 && l.inside);
    check(`${label} each read opened the record it named`,
      read.curated.opened === 'amli-lofts' && read.provider.opened === ARCHIVED.id,
      `${read.curated.opened} | ${read.provider.opened}`);
    check(`${label} a curated plan's source is labelled as a plan page and reachable`,
      read.curated.links.some((l) => /Open the building \/ plan source/.test(l.text)) &&
      read.curated.links.some((l) => /Search this building & plan/.test(l.text)) && hitable(read.curated),
      read.curated.links.map((l) => `${l.text} ${l.h}px`).join(' · '));
    check(`${label} a provider row offers a labelled search and no invented listing link`,
      read.provider.links.some((l) => /Search this address/.test(l.text)) &&
      !read.provider.links.some((l) => /Open the recorded listing|Find the listing/.test(l.text)) && hitable(read.provider),
      read.provider.links.map((l) => l.text).join(' · '));
    check(`${label} the sentence about the source is on screen and inside the record`,
      read.provider.access?.h > 0 && read.provider.access.inside &&
      /No exact listing URL is on record/.test(read.provider.access.text), `${read.provider.access?.h}px`);
    check(`${label} the incomplete provider query is readable beside the home's own date`,
      read.provider.dates?.h > 0 && read.provider.dates.inside &&
      /Observed for this home/.test(read.provider.dates.text) &&
      /Coverage of that query is incomplete/.test(read.provider.dates.text), `${read.provider.dates?.h}px`);
    check(`${label} every source reference prints a date or says it is not recorded`,
      read.curated.references.length > 0 &&
      read.curated.references.every((r) => /Observed |Source date not recorded/.test(r)),
      `${read.curated.references.length} references`);
    check(`${label} building charging and public charging context stay apart`,
      read.curated.charging.some((c) => /Building charging advertised/.test(c)) &&
      read.curated.charging.some((c) => /public charging: context unavailable/i.test(c)) &&
      read.curated.charging.filter((c) => /Building advertises electric car charging stations\./.test(c)).length === 1,
      read.curated.charging.slice(1, 3).join(' | ').slice(0, 90));
    check(`${label} the charging cost is named outside the subtotal`,
      read.curated.costRows.some((r) => /^Resident EV charging/.test(r) && /Never part of this subtotal/.test(r)));
    check(`${label} an open record does not push the page sideways`,
      !read.curated.sideways && !read.provider.sideways);
    check(`${label} the record raises no page error`, errors.length === 0, errors.slice(0, 2).join(' '));
    // The record itself is what this suite is about, so the artifact shows it
    // open rather than the page behind it.
    await page.evaluate(async (id) => {
      [...document.querySelectorAll('[data-detail]')].find((b) => b.dataset.detail === id)?.click();
      await new Promise((r) => setTimeout(r, 350));
      document.querySelector('#detail-sources')?.scrollIntoView({ block: 'center' });
    }, ARCHIVED.id);
    await page.waitForTimeout(250);
    await shot(page, `source-${label.replace(/\s+/g, '-')}`);
    await page.evaluate(async () => {
      [...document.querySelectorAll('[data-detail]')].find((b) => b.dataset.detail === 'amli-lofts')?.click();
      await new Promise((r) => setTimeout(r, 350));
    });
    await page.waitForTimeout(250);
    await shot(page, `source-curated-${label.replace(/\s+/g, '-')}`);
    await context.close();
  }
  // The saved record the feed no longer carries: its own frozen query, beside
  // today's, each labelled -- and its notes still in the form.
  for (const [label, opts] of [['1280px', { theme: 'dark' }],
                               ['390px', { width: 390, height: 844, mobile: true, theme: 'light' }]]) {
    const { context, page, errors } = await open(browser, { ...opts, storage: { 'spicyhome.workspace.v1': savedNotebook } });
    const saved = await page.evaluate(async (id) => {
      document.querySelector('[data-view="shortlist"]').click();
      await new Promise((r) => setTimeout(r, 400));
      const card = [...document.querySelectorAll('[data-home]')].find((el) => el.dataset.home === id);
      const stated = card ? ['.saved-evidence', '.saved-chips', '.saved-head']
        .map((sel) => card.querySelector(sel)?.textContent ?? '').join(' ') : '';
      card?.querySelector('[data-detail]')?.click();
      await new Promise((r) => setTimeout(r, 400));
      const box = document.querySelector('#detail-content');
      const dialog = document.querySelector('#detail-dialog').getBoundingClientRect();
      const lines = [...box.querySelectorAll('.source-dates')].map((p) => {
        const r = p.getBoundingClientRect();
        return { text: p.textContent.trim(), h: Math.round(r.height), inside: r.right <= dialog.right + 1 };
      });
      return { opened: box.querySelector('[data-save]')?.dataset.save ?? null, cardText: card?.textContent ?? '', stated, lines,
        notes: box.querySelector('[name="notes"]')?.value ?? '',
        search: [...box.querySelectorAll('.detail-links a')].map((a) => a.textContent.trim()),
        sideways: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1 };
    }, ARCHIVED_ID);
    check(`${label} the reopened record is the saved one`, saved.opened === ARCHIVED_ID, String(saved.opened));
    check(`${label} a saved home the feed dropped is archived, never called leased`,
      /Archived notebook entry/.test(saved.stated) && !/leased|no longer available|unavailable/i.test(saved.stated),
      saved.stated.replace(/\s+/g, ' ').trim().slice(-70));
    check(`${label} its own recorded query is shown, and today's beside it as separate context`,
      saved.lines.length === 2 && /4,100/.test(saved.lines[0].text) &&
      /Recorded when you saved this home/.test(saved.lines[0].text) &&
      /Current feed context, separate from your saved record/.test(saved.lines[1].text) &&
      !/4,100/.test(saved.lines[1].text),
      saved.lines.map((l) => `${l.h}px`).join(' + '));
    check(`${label} the saved evidence is readable inside the record`,
      saved.lines.every((l) => l.h > 0 && l.inside) && !saved.sideways);
    check(`${label} the notes and the labelled search survive with it`,
      saved.notes === 'Ask about the garage waitlist' && saved.search.some((s) => /Search this address/.test(s)),
      saved.search.join(' · '));
    check(`${label} the reopened saved record raises no page error`, errors.length === 0, errors.slice(0, 2).join(' '));
    await shot(page, `saved-evidence-${label}`);
    await context.close();
  }

  // --- 8. the saved decision desk, on a screen -----------------------------
  //         jsdom can say the facts are in the markup. Only a browser can say
  //         whether a returning reader meets a decision or a wall: what is in
  //         the first viewport, how tall one saved home is, how many controls
  //         it faces them with, and whether a ruled-out home still competes.
  const DESK_HOMES = JSON.parse(FEED).homes;
  const deskNotebook = JSON.stringify({
    version: 1, manual: [], events: [], preferences: {}, savedSearches: [],
    records: Object.fromEntries([
      [DESK_HOMES.find((h) => h.kind === 'building').id, { saved: true, status: 'shortlisted', finalist: true }],
      [DESK_HOMES.filter((h) => h.kind === 'building')[1].id, { saved: true, status: 'tour scheduled', finalist: true, layoutReview: 'one_bed' }],
      [DESK_HOMES.find((h) => h.kind === 'listing').id, { saved: true, status: 'contacted', finalist: true, rentOverride: 1725, quoteDate: '2026-09-14', parkingCost: 0 }],
      [DESK_HOMES.filter((h) => h.kind === 'listing')[1].id, { saved: true, status: 'researching' }],
      [DESK_HOMES.filter((h) => h.kind === 'listing')[2].id, { saved: true, status: 'ruled out', notes: 'Too far from the train.' }],
    ]),
  });
  for (const [label, opts] of [['1280px dark', { theme: 'dark' }],
                               ['1280px light', { theme: 'light' }],
                               ['390px dark', { width: 390, height: 844, mobile: true, theme: 'dark' }],
                               ['390px light', { width: 390, height: 844, mobile: true, theme: 'light' }],
                               ['320px dark', { width: 320, height: 640, mobile: true, theme: 'dark' }]]) {
    const { context, page, errors } = await open(browser, { ...opts, storage: { 'spicyhome.workspace.v1': deskNotebook } });
    const viewport = opts.height ?? 900;
    const desk = await page.evaluate(async (fold) => {
      document.querySelector('[data-view="shortlist"]').click();
      await new Promise((r) => setTimeout(r, 500));
      const box = (el) => el?.getBoundingClientRect() ?? null;
      const rows = [...document.querySelectorAll('.saved-row')];
      const stageOf = (row) => row.querySelector('[data-stage]')?.value ?? '';
      const contender = rows.find((r) => stageOf(r) && stageOf(r) !== 'ruled out');
      const ruled = document.querySelector('.saved-ruled .saved-row');
      const painted = (el) => { const r = box(el); return !!r && r.height > 0 && r.width > 0 && getComputedStyle(el).visibility !== 'hidden'; };
      // What a reader can actually reach without opening anything.
      const facing = contender ? [...contender.querySelectorAll('button, select, input, a')]
        .filter((el) => painted(el) && !el.closest('details:not([open])')).length : null;
      const top = (el) => el ? Math.round(box(el).top + window.scrollY) : null;
      const firstScreen = [...document.querySelectorAll('#view-content *')]
        .filter((el) => { const r = box(el); return r.top >= 0 && r.top < fold && r.height > 0; });
      return {
        rows: rows.length,
        rowHeight: contender ? Math.round(box(contender).height) : null,
        facing,
        docHeight: Math.round(document.documentElement.scrollHeight),
        sideways: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
        firstRowTop: top(rows[0]),
        shelfHeight: Math.round(box(document.querySelector('.finalist-shelf'))?.height ?? 0),
        // The decision facts a phone shows before any scrolling.
        firstScreenHasMoney: firstScreen.some((el) => el.matches('.finalist-rent, .saved-money')),
        firstScreenHasDifference: firstScreen.some((el) => el.matches('.finalist-difference')),
        openLists: document.querySelectorAll('.saved-open').length,
        foldedOpen: [...document.querySelectorAll('.saved-open')].every((el) => !el.open),
        ruledFolded: !document.querySelector('.saved-ruled')?.open,
        ruledInFlow: !!ruled && !!ruled.closest('.saved-section'),
        ruledOpacity: ruled ? Number(getComputedStyle(ruled.closest('.saved-row')).opacity) : null,
        ruledContrast: (() => {
          if (!ruled) return null;
          const parse = (c) => (c.match(/[\d.]+/g) ?? []).map(Number);
          const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
            return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
          const behind = parse(getComputedStyle(document.body).backgroundColor);
          const a = Number(getComputedStyle(ruled).opacity);
          const text = parse(getComputedStyle(ruled.querySelector('h4')).color);
          // The row is composited at its own opacity over the page behind it.
          const blended = text.slice(0, 3).map((v, i) => v * a + behind[i] * (1 - a));
          const [l1, l2] = [lum(blended), lum(behind)].sort((x, y) => y - x);
          return Math.round(((l1 + 0.05) / (l2 + 0.05)) * 10) / 10;
        })(),
        pinnedRows: rows.filter((r) => r.classList.contains('is-finalist')).length,
        finalistMarked: rows.filter((r) => r.classList.contains('is-finalist'))
          .every((r) => /Final Three/.test(r.querySelector('.saved-chips')?.textContent ?? '')),
        smallTargets: [...document.querySelectorAll('#view-content button, #view-content select, #view-content a')]
          .filter((el) => { const r = box(el); return r.height > 0 && r.height < 44 && !el.closest('details:not([open])'); })
          .map((el) => `${el.textContent.trim().slice(0, 24)}|${Math.round(box(el).height)}px`),
      };
    }, viewport);
    check(`${label} a saved home is one compact decision, not a discovery card again`,
      desk.rowHeight !== null && desk.rowHeight < (opts.mobile ? 760 : 560), `${desk.rowHeight}px per home`);
    check(`${label} it faces the reader with a handful of controls, not a wall`,
      desk.facing !== null && desk.facing <= 6, `${desk.facing} controls`);
    check(`${label} the unresolved list and the ruled-out homes start folded`,
      desk.openLists > 0 && desk.foldedOpen && desk.ruledFolded, `${desk.openLists} lists`);
    check(`${label} a ruled-out home is out of the contenders' reading order and quieter`,
      !desk.ruledInFlow && desk.ruledOpacity !== null && desk.ruledOpacity < 1,
      `opacity ${desk.ruledOpacity}`);
    check(`${label} a ruled-out home stays readable while it is demoted`,
      desk.ruledContrast !== null && desk.ruledContrast >= 4.5, `${desk.ruledContrast}:1 at ${desk.ruledOpacity} opacity`);
    check(`${label} a pinned home says so on its own row`,
      desk.pinnedRows > 0 && desk.finalistMarked, `${desk.pinnedRows} pinned rows`);
    check(`${label} the desk does not push the page sideways`, !desk.sideways);
    check(`${label} every control a reader faces is a 44px target`,
      desk.smallTargets.length === 0, desk.smallTargets.join(' · '));
    check(`${label} the first screen carries a decision fact, not just a masthead`,
      desk.firstScreenHasMoney || desk.firstScreenHasDifference,
      `money ${desk.firstScreenHasMoney}, difference ${desk.firstScreenHasDifference}`);
    check(`${label} the desk raises no page error`, errors.length === 0, errors.slice(0, 2).join(' '));
    await shot(page, `desk-${label.replace(/\s+/g, '-')}`);
    // The unresolved list opened: every item is a control that opens a field.
    const opened = await page.evaluate(async () => {
      const row = document.querySelector('.saved-row');
      if (!row) return { items: 0, allActionable: false, marked: 0, readable: false, sideways: false };
      row.querySelector('.saved-open').open = true;
      await new Promise((r) => setTimeout(r, 200));
      const items = [...row.querySelectorAll('.saved-open li')];
      return { items: items.length,
        allActionable: items.every((li) => !!li.querySelector('button[data-task-target]')),
        marked: row.querySelectorAll('.saved-open li.is-next').length,
        readable: items.every((li) => li.getBoundingClientRect().height >= 24),
        sideways: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1 };
    });
    check(`${label} every unresolved item is a control that opens the field that settles it`,
      opened.items > 0 && opened.allActionable && opened.marked === 1 && opened.readable && !opened.sideways,
      `${opened.items} items, ${opened.marked} marked next`);
    await page.evaluate(() => document.querySelector('.saved-row .saved-open')?.scrollIntoView({ block: 'center' }));
    await page.waitForTimeout(250);
    await shot(page, `desk-open-${label.replace(/\s+/g, '-')}`);
    const moved = await page.evaluate(async () => {
      const row = [...document.querySelectorAll('.saved-row')].find((r) => (r.querySelector('[data-stage]')?.value ?? '') === 'researching');
      if (!row) return { ran: false };
      row.querySelector('.saved-more').open = true;
      const select = row.querySelector('[data-stage]');
      const id = select.dataset.stage;
      select.focus();
      select.value = 'ruled out';
      select.dispatchEvent(new Event('change'));
      await new Promise((r) => setTimeout(r, 300));
      const active = document.activeElement;
      let shut = 0;
      for (let el = active?.parentElement; el; el = el.parentElement) if (el.tagName === 'DETAILS' && !el.open) shut++;
      return { ran: true, id, onControl: active?.dataset?.stage === id, tag: active?.tagName ?? 'none', shut,
        inRuled: !!active?.closest('.saved-ruled'),
        visible: active ? active.getBoundingClientRect().height > 0 : false };
    });
    check(`${label} moving a home to ruled out keeps the reader on its own control`,
      moved.ran && moved.onControl && moved.inRuled && moved.shut === 0 && moved.visible,
      `focus on ${moved.tag}, ${moved.shut} closed disclosures around it`);
    await page.evaluate(() => { const r = document.querySelector('.saved-ruled'); if (r) { r.open = true; r.scrollIntoView({ block: 'center' }); } });
    await page.waitForTimeout(250);
    await shot(page, `desk-ruled-${label.replace(/\s+/g, '-')}`);
    await context.close();
  }

  // --- 9. the tour-day walkthrough, on a phone -----------------------------
  //         jsdom can say the identity and the evidence are in the markup.
  //         Only a browser can say whether the reader standing in the
  //         apartment can see which apartment it is, reach the checks with a
  //         finger, and write down what they found without four screens of
  //         scrolling in between.
  const TOUR_HOME = DESK_HOMES.find((h) => h.kind === 'listing' && h.unit_label);
  const tourNotebook = JSON.stringify({
    version: 1, manual: [], events: [], preferences: {}, savedSearches: [],
    records: { [TOUR_HOME.id]: { saved: true, status: 'tour scheduled', tourDate: '2026-09-20T10:00',
      tourChecks: { layout: true, light: true }, notes: 'Ask about the garage waitlist.' } },
  });
  for (const [label, opts] of [['1280px dark', { theme: 'dark' }],
                               ['1280px light', { theme: 'light' }],
                               ['390px dark', { width: 390, height: 844, mobile: true, theme: 'dark' }],
                               ['390px light', { width: 390, height: 844, mobile: true, theme: 'light' }],
                               ['320px dark', { width: 320, height: 640, mobile: true, theme: 'dark' }]]) {
    const { context, page, errors } = await open(browser, { ...opts, storage: { 'spicyhome.workspace.v1': tourNotebook } });
    const fold = opts.height ?? 900;
    const tour = await page.evaluate(async ({ id, fold }) => {
      document.querySelector('[data-view="shortlist"]').click();
      await new Promise((r) => setTimeout(r, 450));
      const row = [...document.querySelectorAll('.saved-row')].find((r) => r.dataset.home === id);
      if (!row) return { ran: false };
      row.querySelector('.saved-more').open = true;
      row.querySelector('[data-tour]').click();
      await new Promise((r) => setTimeout(r, 500));
      const box = (s) => document.querySelector(s)?.getBoundingClientRect() ?? null;
      const companion = document.querySelector('#tour-companion');
      const form = document.querySelector('#record-form');
      const dock = box('.detail-dock');
      const head = box('.tour-head');
      const dialog = document.querySelector('#detail-dialog');
      const onScreen = (r) => !!r && r.bottom > 0 && r.top < fold && r.height > 0;
      return {
        ran: true, open: companion?.open === true,
        // Which apartment, where the reader is working.
        identityOnScreen: onScreen(head),
        identity: document.querySelector('.tour-head')?.textContent.replace(/\s+/g, ' ').trim() ?? '',
        // The head comes to rest below the record's dock, not behind it.
        headBehindDock: head && dock ? Math.max(0, Math.round(dock.bottom - head.top)) : null,
        dockHeight: dock ? Math.round(dock.height) : null,
        // From the last check to the fields that record what it found.
        checksToFields: companion && form
          ? Math.round(form.getBoundingClientRect().top - companion.getBoundingClientRect().bottom) : null,
        adjacent: companion?.nextElementSibling === form,
        // A finger has to land on the box, not only on the label around it.
        smallestBox: Math.min(...[...document.querySelectorAll('.tour-check input')]
          .map((c) => { const r = c.getBoundingClientRect(); return Math.round(Math.min(r.width, r.height)); })),
        smallestRow: Math.min(...[...document.querySelectorAll('.tour-check')]
          .map((l) => Math.round(l.getBoundingClientRect().height))),
        evidenceLines: document.querySelectorAll('.tour-known').length,
        progress: document.querySelector('#tour-draft-count')?.textContent.trim() ?? '',
        sideways: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
        dialogSideways: dialog.scrollWidth > dialog.clientWidth + 1,
      };
    }, { id: TOUR_HOME.id, fold });
    check(`${label} the walkthrough opens on the apartment it belongs to`,
      tour.ran && tour.open && /Unit/.test(tour.identity), tour.identity.slice(0, 70));
    check(`${label} the reader can see which apartment they are standing in`,
      tour.identityOnScreen && /Sep 20, 2026/.test(tour.identity), `on screen: ${tour.identityOnScreen}`);
    check(`${label} the identity rests below the record's dock, not behind it`,
      tour.headBehindDock === 0, `dock ${tour.dockHeight}px, overlap ${tour.headBehindDock}px`);
    check(`${label} the checks run straight into the fields that record them`,
      tour.adjacent && tour.checksToFields !== null && tour.checksToFields < 80,
      `${tour.checksToFields}px between them`);
    check(`${label} a finger lands on the check, not only near it`,
      tour.smallestBox >= 24 && tour.smallestRow >= 44, `box ${tour.smallestBox}px, row ${tour.smallestRow}px`);
    check(`${label} the checks the record knows something about say what it knows`,
      tour.evidenceLines === 4, `${tour.evidenceLines} evidence lines`);
    check(`${label} the walkthrough says what is left, not only what is done`,
      /reviewed · \d+ left/.test(tour.progress), tour.progress);
    check(`${label} the walkthrough does not push anything sideways`,
      !tour.sideways && !tour.dialogSideways);
    check(`${label} the walkthrough raises no page error`, errors.length === 0, errors.slice(0, 2).join(' '));
    await page.evaluate(() => document.querySelector('#tour-companion')?.scrollIntoView({ block: 'start' }));
    await page.waitForTimeout(250);
    await shot(page, `tour-${label.replace(/\s+/g, '-')}`);
    // Walking a check and typing an answer: the identity stays put, the text
    // survives a lookup, and the field a jump lands on clears both sticky bars.
    const walked = await page.evaluate(async () => {
      const tick = document.querySelector('[data-tour-check="noise"]');
      tick.click();
      const notes = document.querySelector('[name="notes"]');
      notes.value = 'half-typed: ask about the bike room';
      const before = localStorage.getItem('spicyhome.workspace.v1');
      document.querySelector('.tour-head a')?.click();
      await new Promise((r) => setTimeout(r, 200));
      document.querySelector('[data-detail-jump="notes"]')?.click();
      await new Promise((r) => setTimeout(r, 400));
      const dock = document.querySelector('.detail-dock').getBoundingClientRect();
      const field = document.activeElement?.getBoundingClientRect();
      const head = document.querySelector('.tour-head')?.getBoundingClientRect();
      return { saved: localStorage.getItem('spicyhome.workspace.v1') === before,
        text: document.querySelector('[name="notes"]').value,
        ticked: document.querySelector('[data-tour-check="noise"]').checked,
        progress: document.querySelector('#tour-draft-count').textContent.trim(),
        focused: document.activeElement?.name ?? document.activeElement?.tagName,
        clearOfBars: !!field && field.top >= dock.bottom - 1 && (!head || field.top >= Math.min(head.bottom, dock.bottom) - 1) };
    });
    check(`${label} a lookup from the walkthrough saves nothing and keeps unsaved text`,
      walked.saved && walked.text === 'half-typed: ask about the bike room' && walked.ticked,
      `ticked ${walked.ticked}`);
    check(`${label} the live count follows the walk`, /3\/8 reviewed · 5 left/.test(walked.progress), walked.progress);
    check(`${label} a field jumped to is not left under the sticky bars`,
      walked.focused === 'notes' && walked.clearOfBars, `focus ${walked.focused}, clear ${walked.clearOfBars}`);
    await shot(page, `tour-fields-${label.replace(/\s+/g, '-')}`);
    await context.close();
  }

} finally {
  await browser.close();
  server.close();
}
const failed = results.filter((r) => !r.ok);
console.log(`browser-check: ${results.length - failed.length}/${results.length} scenarios passed`);
if (failed.length) process.exit(1);

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
    // A number on a map is read as a fact about the place under it. A mark
    // prints one only where every place it stands for prints that same figure
    // on the same basis, and only where the label clears every other mark, so a
    // crowd degrades to circles instead of stacking boxes over the city. What
    // decides that is not a record count: it is these boxes, at this zoom.
    const priced = await page.evaluate(() => {
      const pane = document.querySelector('#map').getBoundingClientRect();
      const marks = [...document.querySelectorAll('.home-map-marker')];
      const painted = marks.map((m) => {
        const on = m.classList.contains('is-priced');
        const el = on ? m.querySelector('.map-price') : m.querySelector('.map-dot');
        return { on, box: el.getBoundingClientRect(), text: el.textContent.trim(),
          label: m.querySelector('.map-price') ? m.querySelector('.map-price').textContent : null,
          spoken: m.querySelector('.map-marker-label').textContent };
      });
      const over = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
      const dot = getComputedStyle(marks[0].querySelector('.map-dot'));
      const radius = parseFloat(dot.borderTopLeftRadius);
      return { marks: marks.length, shown: painted.filter((p) => p.on).length,
        candidates: painted.filter((p) => p.label).length,
        round: dot.borderTopLeftRadius,
        circle: /%$/.test(dot.borderTopLeftRadius) ? radius >= 50
          : radius * 2 >= parseFloat(dot.width) - 0.5,
        square: Math.round(parseFloat(dot.width)) === Math.round(parseFloat(dot.height)),
        covering: painted.filter((p, i) => p.on && painted.some((q, j) => i !== j && over(p.box, q.box))).length,
        cut: painted.filter((p) => p.on && (p.box.left < pane.left || p.box.right > pane.right
          || p.box.top < pane.top || p.box.bottom > pane.bottom)).length,
        malformed: painted.filter((p) => p.on && !/^\$[\d,]+(\.\d)?k?$/.test(p.text)).length,
        // a printed price is the rounding of the exact figure the mark's own
        // label carries -- a crowd's label counts places and carries none
        wrong: painted.filter((p) => {
          if (!p.on) return false;
          const exact = /\$([\d,]+)/.exec(p.spoken);
          if (!exact) return false;
          const n = Number(exact[1].replace(/,/g, ''));
          const k = Math.round(n / 100) / 10;
          return p.text !== (n < 1000 ? exact[0] : `$${Number.isInteger(k) ? k : k.toFixed(1)}k`);
        }).length };
    });
    check(`${label} a mark is a circle, not a box`, priced.circle && priced.square,
      `radius ${priced.round}, square ${priced.square}`);
    // Each of these asks first whether this map had a figure to print at all.
    // A map with none satisfies "nothing overlaps" and "nothing is cut off"
    // without being a map that prints prices, and a check that cannot fail on
    // the tree before this one is not a check.
    check(`${label} a metro-wide map degrades to circles rather than stacking boxes`,
      priced.candidates > 0 && priced.marks > 5 && priced.shown < priced.marks / 2,
      `${priced.shown} printed of ${priced.candidates} that had a figure, ${priced.marks} marks`);
    check(`${label} no price label covers another mark`,
      priced.candidates > 0 && priced.covering === 0,
      `${priced.covering} covering, ${priced.candidates} had a figure`);
    check(`${label} no price label is cut off by the map's edge`,
      priced.candidates > 0 && priced.cut === 0,
      `${priced.cut} cut off, ${priced.candidates} had a figure`);
    check(`${label} a printed price is its own record's figure, rounded`,
      priced.candidates > 0 && priced.malformed === 0 && priced.wrong === 0,
      `${priced.malformed} malformed, ${priced.wrong} not its own figure, ${priced.candidates} had a figure`);
    check(`${label} no page errors while pressing the map`, errors.length === 0, errors.slice(0, 2).join(' '));
    await context.close();
  }

  // --- 1b. a map with room: prices, the reader's own marks, and the one --
  //         they are on. Searching one building name leaves four curated
  //         places at four coordinates across the metro, which is the sparse
  //         end of the gradient the dense metro view above stands at.
  for (const [label, size] of [['390px', { width: 390, height: 844, mobile: true }], ['1280px', {}]]) {
    const notebook = JSON.stringify({ version: 1, records: {
      'amli-lofts': { saved: true }, 'amli-evanston': { saved: true, finalist: true },
    }, manual: [], events: [] });
    const { context, page, errors } = await open(browser, { ...size, theme: 'dark',
      storage: { 'spicyhome.workspace.v1': notebook } });
    await page.waitForTimeout(700);
    await page.evaluate(() => {
      document.querySelector('#search-controls')?.setAttribute('open', '');
      const box = document.querySelector('#search');
      box.value = 'AMLI';
      box.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.waitForTimeout(1400);
    await page.evaluate(() => document.querySelector('#map-fit')?.click());
    await page.waitForTimeout(900);
    // The policy, re-derived from the rendered boxes rather than trusted: a mark
    // carrying an agreed figure prints it unless its label would touch another
    // mark or the pane's edge, and a printed one never does either.
    const room = await page.evaluate(() => {
      const pane = document.querySelector('#map').getBoundingClientRect();
      const marks = [...document.querySelectorAll('.home-map-marker')];
      const painted = marks.map((m) => {
        const on = m.classList.contains('is-priced');
        const el = on ? m.querySelector('.map-price') : m.querySelector('.map-dot');
        return { on, box: el.getBoundingClientRect(), text: el.textContent.trim(),
          label: m.querySelector('.map-price')?.getBoundingClientRect() ?? null,
          spoken: m.querySelector('.map-marker-label').textContent };
      });
      const over = (a, b, g) => a.left - g < b.right && b.left < a.right + g
        && a.top - g < b.bottom && b.top < a.bottom + g;
      const blocked = (b, i) => b.left < pane.left + 3 || b.right > pane.right - 3
        || b.top < pane.top + 3 || b.bottom > pane.bottom - 3
        || painted.some((q, j) => j !== i && over(b, q.box, 2));
      return { marks: marks.length, candidates: painted.filter((p) => p.label).length,
        shown: painted.filter((p) => p.on).length,
        // a figure that had the room and was not printed, and one printed without it
        missed: painted.filter((p, i) => p.label && !p.on && !blocked(p.label, i)).length,
        misplaced: painted.filter((p, i) => p.on && blocked(p.label, i)).length,
        wrong: painted.filter((p) => {
          if (!p.on) return false;
          const exact = /\$([\d,]+)/.exec(p.spoken);
          if (!exact) return true;
          const n = Number(exact[1].replace(/,/g, ''));
          const k = Math.round(n / 100) / 10;
          return p.text !== (n < 1000 ? exact[0] : `$${Number.isInteger(k) ? k : k.toFixed(1)}k`);
        }).length,
        inkPct: Math.round(painted.filter((p) => p.on)
          .reduce((n, p) => n + p.box.width * p.box.height, 0) / (pane.width * pane.height) * 1000) / 10 };
    });
    check(`${label} a map with room prints every price it honestly can`,
      room.candidates >= 2 && room.shown >= 1 && room.missed === 0 && room.wrong === 0,
      `${room.shown} printed of ${room.candidates} that had a figure, ${room.missed} had the room and went without, ${room.wrong} not its own figure`);
    check(`${label} a printed price touches no other mark, no edge, and little of the map`,
      room.shown > 0 && room.misplaced === 0 && room.inkPct < 15,
      `${room.shown} printed, ${room.misplaced} misplaced, ${room.inkPct}% of the pane`);
    const state = await page.evaluate(() => {
      const marks = [...document.querySelectorAll('.home-map-marker')];
      const paint = (m) => {
        const el = m.classList.contains('is-priced') ? m.querySelector('.map-price') : m.querySelector('.map-dot');
        const s = getComputedStyle(el);
        return `${s.backgroundColor}|${s.borderColor}|${s.outlineColor}|${s.outlineWidth}`;
      };
      const saved = marks.filter((m) => m.classList.contains('is-saved'));
      const finalist = marks.filter((m) => m.classList.contains('is-finalist'));
      const plain = marks.find((m) => !m.classList.contains('is-saved'));
      const onlySaved = saved.find((m) => !m.classList.contains('is-finalist'));
      return { marks: marks.length, saved: saved.length, finalist: finalist.length,
        savedDiffers: !!onlySaved && !!plain && paint(onlySaved) !== paint(plain),
        finalistDiffers: !!finalist[0] && !!onlySaved && paint(finalist[0]) !== paint(onlySaved),
        says: marks.filter((m) => /saved|final three/.test(m.querySelector('.map-marker-label').textContent)).length };
    });
    check(`${label} a saved mark and a Final Three mark are told apart from a plain one`,
      state.saved === 2 && state.finalist === 1 && state.savedDiffers && state.finalistDiffers
      && state.says === 2, JSON.stringify(state));
    // The map as the reader meets it, before any press opens anything over it.
    if (shots) {
      await mkdir(shots, { recursive: true });
      await page.locator('#map')
        .screenshot({ path: join(shots, `map-prices-${label.replace('px', '')}.png`) }).catch(() => {});
    }
    // Selection: press a mark, and only that one wears the ring.
    const chosen = await page.evaluate(async () => {
      const pane = document.querySelector('#map').getBoundingClientRect();
      const m = [...document.querySelectorAll('.home-map-marker')].find((x) => {
        const r = x.getBoundingClientRect();
        return r.left > pane.left + 30 && r.right < pane.right - 30
          && r.top > pane.top + 30 && r.bottom < pane.bottom - 30;
      });
      const r = m.getBoundingClientRect();
      m.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true,
        clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }));
      await new Promise((res) => setTimeout(res, 40));
      const panel = document.querySelector('#map-pick');
      if (panel && !panel.hidden) panel.querySelector('.sc-pick__item')?.click();
      await new Promise((res) => setTimeout(res, 40));
      const on = [...document.querySelectorAll('.home-map-marker.is-selected')];
      const ring = on[0] ? getComputedStyle(on[0].classList.contains('is-priced')
        ? on[0].querySelector('.map-price') : on[0].querySelector('.map-dot')) : null;
      return { selected: on.length, mine: on[0] === m, outline: ring ? parseFloat(ring.outlineWidth) : 0 };
    });
    check(`${label} the mark the reader chose is the one that wears the ring`,
      chosen.selected === 1 && chosen.mine && chosen.outline >= 3, JSON.stringify(chosen));
    // A price reaches further than the dot it replaced: both ends of the label
    // sit outside the 22px a dot answers for, and both still answer for it.
    const edge = await page.evaluate(async () => {
      const m = [...document.querySelectorAll('.home-map-marker.is-priced')][0];
      if (!m) return { found: false };
      const box = m.querySelector('.map-price').getBoundingClientRect();
      const r = m.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const name = m.querySelector('.map-marker-label').textContent.split(' \u00b7 ')[0];
      const out = { found: true, reach: 0, answered: 0, tried: 0 };
      for (const x of [box.left + 1, box.right - 1]) {
        document.querySelectorAll('.home-map-marker').forEach((o) => o.classList.remove('is-selected'));
        const panel = document.querySelector('#map-pick');
        if (panel) { panel.hidden = true; panel.innerHTML = ''; }
        out.tried++;
        out.reach = Math.max(out.reach, Math.round(Math.abs(x - cx)));
        m.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, clientX: x, clientY: cy }));
        await new Promise((res) => setTimeout(res, 40));
        const open = document.querySelector('#map-pick');
        const first = open && !open.hidden ? open.querySelector('.sc-pick__name')?.textContent ?? '' : '';
        if (m.classList.contains('is-selected') || first === name) out.answered++;
      }
      return out;
    });
    check(`${label} a press anywhere on a price answers for that mark, past a dot's reach`,
      edge.found && edge.reach > 22 && edge.answered === edge.tried && edge.tried === 2, JSON.stringify(edge));
    check(`${label} no page errors on a map that prints prices`, errors.length === 0, errors.slice(0, 2).join(' '));
    await context.close();
  }

  // --- 1c. why a candidate is in front of the reader, and what is open ------
  // The answer has to be on the card, not behind a disclosure, and it has to
  // follow the reader's own filters: a reason whose rule stops applying has to
  // stop being drawn, or it reads as still true.
  for (const [label, size] of [['390px', { width: 390, height: 900, mobile: true }], ['1280px', { width: 1280, height: 1100 }]]) {
    const { context, page, errors } = await open(browser, { ...size, theme: 'dark' });
    await page.waitForTimeout(700);
    const read = () => page.evaluate(() => {
      const card = document.querySelector('.pick-card');
      if (!card) return { card: false };
      const block = card.querySelector('.why-block');
      const items = [...card.querySelectorAll('.why-item')];
      const box = card.getBoundingClientRect();
      return { card: true, id: card.dataset.pickHome, block: !!block,
        behindDisclosure: !!block?.closest('details'),
        reasons: items.map((n) => n.textContent.trim()),
        escapes: items.some((n) => { const b = n.getBoundingClientRect();
          return b.right > box.right + 1 || b.left < box.left - 1; }),
        open: card.querySelector('.why-open')?.textContent.replace(/\s+/g, ' ').trim() ?? '',
        text: block?.textContent ?? '' };
    });
    const first = await read();
    check(`${label} a pick says why it is here without opening anything`,
      first.card && first.block && !first.behindDisclosure
      && first.reasons.length >= 1 && first.reasons.length <= 3,
      first.card ? `${first.reasons.length} reasons${first.behindDisclosure ? ', behind a disclosure' : ''}` : 'no pick card');
    check(`${label} a pick names one thing that is still open`,
      /Still open/.test(first.open), first.open || 'none');
    // Asks for a reason first: a card with none satisfies "nothing escapes"
    // without anything being drawn, which is green on the tree before this one.
    check(`${label} a reason stays inside the card it explains`,
      first.reasons.length > 0 && !first.escapes, `${first.reasons.length} reasons`);
    check(`${label} the explanation is neither a verdict nor a score`,
      first.block && !/\b(best|winner|perfect|ideal|guaranteed)\b|recommended for you/i.test(first.text)
      && !/\bscore\b|\bconfidence\b|\b\d+\s*points?\b/i.test(first.text),
      first.text.replace(/\s+/g, ' ').slice(0, 90));
    // A filter the reader sets is named; put it back and the sentence is gone.
    const area = await page.evaluate(async (id) => {
      document.querySelector('#search-controls')?.setAttribute('open', '');
      const card = [...document.querySelectorAll('#results [data-home]')].find((n) => n.dataset.home === id);
      const picked = document.querySelector('#neighborhood');
      const home = card?.querySelector('.neighborhood')?.textContent ?? '';
      const match = [...picked.options].find((o) => home.includes(o.value) && o.value !== 'all');
      if (!match) return { skipped: true };
      picked.value = match.value;
      picked.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise((r) => setTimeout(r, 700));
      const named = [...document.querySelectorAll('.pick-card')].map((c) =>
        [...c.querySelectorAll('.why-item')].some((n) => /the area you chose/.test(n.textContent)));
      const chipsWhileOn = document.querySelectorAll('.why-item--filter').length;
      picked.value = 'all';
      picked.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise((r) => setTimeout(r, 700));
      const left = [...document.querySelectorAll('.why-item')].some((n) => /the area you chose/.test(n.textContent));
      return { skipped: false, value: match.value, named, left, chipsWhileOn,
        chips: document.querySelectorAll('.why-item--filter').length };
    }, first.id);
    check(`${label} an area the reader chooses is named on every pick that matched it`,
      area.skipped || (area.named.length > 0 && area.named.every(Boolean)), JSON.stringify(area));
    // There has to have been something to outlive: a tree that never drew the
    // reason also never leaves it behind, and that is not the same fact.
    check(`${label} a reason does not outlive the filter that produced it`,
      area.skipped || (area.chipsWhileOn > 0 && !area.left && area.chips === 0), JSON.stringify(area));
    // Focus explains the one place it puts in front of the reader.
    const focus = await page.evaluate(async () => {
      document.querySelector('button[data-surface="focus"]')?.click();
      await new Promise((r) => setTimeout(r, 700));
      const block = document.querySelector('#focus-surface .why-block');
      if (!block) return { block: false };
      block.scrollIntoView({ block: 'center' });
      await new Promise((r) => setTimeout(r, 200));
      const b = block.getBoundingClientRect();
      const bar = document.querySelector('.focus-actions')?.getBoundingClientRect();
      return { block: true, reasons: block.querySelectorAll('.why-item').length,
        open: /Still open/.test(block.textContent),
        covered: bar ? Math.round(Math.max(0, Math.min(b.bottom, bar.bottom) - Math.max(b.top, bar.top))) : 0 };
    });
    check(`${label} Focus explains the one place it shows, and the sticky bar does not bury it`,
      focus.block && focus.reasons >= 1 && focus.open && focus.covered === 0, JSON.stringify(focus));
    check(`${label} no page errors while the explanation follows the filters`,
      errors.length === 0, errors.slice(0, 2).join(' '));
    if (shots) {
      await mkdir(shots, { recursive: true });
      await page.evaluate(() => document.querySelector('button[data-surface="split"]')?.click());
      await page.waitForTimeout(500);
      await page.locator('.pick-card').first()
        .screenshot({ path: join(shots, `why-pick-${label.replace('px', '')}.png`) }).catch(() => {});
    }
    await context.close();
  }

  // --- 1d. the downtown lens, on a screen -----------------------------------
  // The lens is three ordinary preferences, so this drives the real controls.
  // What a screen has to settle: the panel and the band fit the card at phone
  // width, a recorded form is visible without opening anything, and nothing the
  // lens prints reads as a verdict.
  for (const [label, size] of [['390px', { width: 390, height: 900, mobile: true }], ['1280px', { width: 1280, height: 1100 }]]) {
    const { context, page, errors } = await open(browser, { ...size, theme: 'dark' });
    await page.waitForTimeout(700);
    await page.evaluate(() => {
      document.querySelector('#search-controls').open = true;
      const scope = document.querySelector('#urban-scope');
      scope.value = 'near'; scope.onchange();
      document.querySelector('#target').value = '2700';
      document.querySelector('#filters').dispatchEvent(new Event('change', { bubbles: true }));
      const tall = document.querySelector('#filter-highRise');
      tall.checked = true; tall.dispatchEvent(new Event('change'));
    });
    await page.waitForTimeout(500);
    const lens = await page.evaluate(() => {
      const panel = document.querySelector('#downtown-lens');
      const doc = document.documentElement;
      const band = document.querySelector('.home-card .band-line');
      const card = band?.closest('.home-card');
      const cardBox = card?.getBoundingClientRect(), bandBox = band?.getBoundingClientRect();
      return {
        shown: panel && !panel.hidden,
        text: panel?.textContent.replace(/\s+/g, ' ').trim() ?? '',
        panelFits: panel ? panel.scrollWidth <= panel.clientWidth + 1 : false,
        sideways: doc.scrollWidth > doc.clientWidth + 1,
        band: band?.textContent.replace(/\s+/g, ' ').trim() ?? '',
        bandInside: !!(cardBox && bandBox && bandBox.right <= cardBox.right + 1 && bandBox.left >= cardBox.left - 1),
        bandHeight: bandBox ? Math.round(bandBox.height) : 0,
        cardHeight: cardBox ? Math.round(cardBox.height) : 0,
      };
    });
    check(`${label}: the lens says what it can see, before anything is opened`,
      lens.shown && /retained record/.test(lens.text) && /Against your \$2,700 target/.test(lens.text), lens.text.slice(0, 90));
    check(`${label}: missing evidence is an absence of evidence, never of buildings`,
      /A height nobody wrote down is not a low building/.test(lens.text)
      && !/there are no high-rises/i.test(lens.text), lens.text.slice(0, 90));
    check(`${label}: the lens panel and the page do not scroll sideways`,
      lens.panelFits && !lens.sideways, `panel ${lens.panelFits} page ${!lens.sideways}`);
    check(`${label}: a target band stays inside the card it belongs to`,
      !!lens.band && lens.bandInside, lens.band.slice(0, 70));
    check(`${label}: the band says what it measured, and never claims an all-in cost`,
      /Base rent only/.test(lens.band) && !/all[- ]in/i.test(lens.band), lens.band.slice(0, 70));
    // A card that grows by a third for one line is not compact any more.
    check(`${label}: the band costs the card less than a fifth of its height`,
      lens.cardHeight > 0 && lens.bandHeight / lens.cardHeight < 0.2,
      `${lens.bandHeight} of ${lens.cardHeight}px`);
    // Raise the cap and the one described building arrives, chip and all.
    const tall = await page.evaluate(() => {
      document.querySelector('#max').value = '3200';
      document.querySelector('#filters').dispatchEvent(new Event('change', { bubbles: true }));
      const card = document.querySelector('.home-card[data-home="73-east-lake"]');
      const chip = card?.querySelector('.chip.form');
      return { arrived: !!card, chip: chip?.textContent.trim() ?? '',
        chips: document.querySelectorAll('.chip.form').length,
        quiet: document.querySelector('.home-card[data-home="amli-900"]')?.textContent ?? '' };
    });
    check(`${label}: a recorded high-rise is readable on its card without opening it`,
      tall.arrived && /High-rise recorded/.test(tall.chip), `${tall.arrived} ${tall.chip}`);
    check(`${label}: a building nobody described carries no form mark at all`,
      tall.chips === 1 && !/low[- ]rise|not a high-rise/i.test(tall.quiet), `${tall.chips} marks`);
    const words = lens.text + ' ' + lens.band + ' ' + tall.chip;
    check(`${label}: the lens never prints a verdict, a score or a confidence`,
      !/\b(best|winner|perfect|ideal|recommended for you|guaranteed fit)\b/i.test(words)
      && !/\bscore\b/i.test(words), words.slice(0, 80));
    // Keyboard only: reach all three controls and change one by keystroke.
    const keys = await page.evaluate(async () => {
      const ids = ['urban-scope', 'target', 'filter-highRise'];
      const reach = ids.map((id) => {
        const el = document.getElementById(id);
        if (!el) return false;
        el.focus();
        return document.activeElement === el && el.tabIndex >= 0;
      });
      const box = document.getElementById('filter-highRise');
      box.focus(); box.checked = false; box.dispatchEvent(new Event('change'));
      const off = !document.querySelector('#downtown-lens').textContent.includes('A height nobody wrote down');
      box.checked = true; box.dispatchEvent(new Event('change'));
      return { reach, off, back: document.querySelector('#downtown-lens').textContent.includes('A height nobody wrote down') };
    });
    check(`${label}: every lens control takes keyboard focus`, keys.reach.every(Boolean), JSON.stringify(keys.reach));
    check(`${label}: a lens sentence leaves with the preference that produced it`,
      keys.off && keys.back, `off ${keys.off} back ${keys.back}`);
    // The lens has a named starting point, and it must not be a mode: it merges
    // onto what the reader already set, and each value stays in its own control.
    const preset = await page.evaluate(() => {
      document.querySelector('#saved-searches').open = true;
      const bedrooms = document.querySelector('#search-bedrooms');
      bedrooms.value = '2'; bedrooms.onchange();
      const button = document.querySelector('[data-preset="downtown-value"]');
      if (!button) return { offered: false };
      const name = button.textContent.trim();
      button.click();
      const p = JSON.parse(localStorage.getItem('spicyhome.workspace.v1')).preferences;
      return { offered: true, name,
        set: [p.urbanScope, p.targetRent, p.highRise, p.parkingPreferred].join('|'),
        kept: p.bedrooms,
        shown: [document.querySelector('#urban-scope').value, document.querySelector('#target').value,
          document.querySelector('#filter-highRise').checked, document.querySelector('#filter-parkingPreferred').checked].join('|'),
        focused: document.activeElement?.dataset?.preset ?? '' };
    });
    check(`${label}: one press starts the lens and says what it will do`,
      preset.offered && preset.set === 'near|2700|true|true' && /Downtown value/.test(preset.name), preset.name);
    check(`${label}: the preset merges onto what the reader already chose`,
      preset.kept === '2', `bedrooms ${preset.kept}`);
    check(`${label}: every value it set is visible in the control it came from`,
      preset.shown === 'near|2700|true|true', preset.shown);
    check(`${label}: the press keeps focus where the reader put it`, preset.focused === 'downtown-value', preset.focused);
    // Parking importance raises what is said, and never hides an unknown.
    // Measured on the whole lens, not on the two-bedroom slice the merge check
    // left behind: a reason nobody can reach proves nothing either way.
    const parking = await page.evaluate(() => {
      const bedrooms = document.querySelector('#search-bedrooms');
      bedrooms.value = 'all'; bedrooms.onchange();
      // On the priority this lens is for, where a place that advertises parking
      // can actually reach a card.
      document.querySelector('[data-pick-lens="downtown"]')?.click();
      const before = document.querySelectorAll('.home-card').length;
      const reasons = () => [...document.querySelectorAll('.why-item')].filter((i) => /asked to prioritise|asked to see/.test(i.textContent)).length;
      const on = reasons();
      const box = document.querySelector('#filter-parkingPreferred');
      box.checked = false; box.dispatchEvent(new Event('change'));
      return { before, on, off: reasons(), after: document.querySelectorAll('.home-card').length };
    });
    check(`${label}: asking for parking adds reasons rather than removing places`,
      parking.on > 0 && parking.before === parking.after, `${parking.on} reasons, ${parking.before} of ${parking.after} places`);
    check(`${label}: turning parking importance off takes its reasons with it`, parking.off === 0, `${parking.on} -> ${parking.off}`);
    // An absence in this snapshot is never reported as an absence in the area.
    const empty = await page.evaluate(async () => {
      document.querySelector('#target').value = '1300';
      document.querySelector('#min').value = '2400';
      document.querySelector('#filters').dispatchEvent(new Event('change', { bubbles: true }));
      const band = document.querySelector('#downtown-lens').textContent;
      document.querySelector('#min').value = '1200';
      document.querySelector('#filters').dispatchEvent(new Event('change', { bubbles: true }));
      const search = document.querySelector('#search');
      search.value = 'zzzz-nothing-here'; search.dispatchEvent(new Event('input'));
      await new Promise((r) => setTimeout(r, 300));
      const results = document.querySelector('#results').textContent;
      const widen = document.querySelector('#widen-lens');
      if (widen) widen.click();
      return { band, results, widened: document.querySelector('#urban-scope')?.value };
    });
    check(`${label}: a target nothing reaches is said about the snapshot, not the area`,
      /holds nothing at or under your \$1,300 target in this area/.test(empty.band)
      && !/no apartments (exist|are available)/i.test(empty.band), empty.band.slice(-90));
    check(`${label}: an empty lens explains itself and offers one way out`,
      /Nothing in this retained snapshot sits inside the downtown lens/.test(empty.results)
      && /not that the area is empty/.test(empty.results) && empty.widened === 'all', empty.widened);
    check(`${label}: no page errors while the lens is driven`, errors.length === 0, errors.slice(0, 2).join(' '));
    if (shots) {
      await mkdir(shots, { recursive: true });
      await page.screenshot({ path: join(shots, `lens-${label.replace('px', '')}.png`) }).catch(() => {});
    }
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
  // A provider row read under a CAPPED query, chosen as such: the scenario
  // reads the incomplete-coverage sentence, and which row happens to come
  // first in the committed feed moves with every scan (a complete Park Ridge
  // query led the feed on 18 Sep where a capped Chicago one had before).
  const ARCHIVED = JSON.parse(FEED).homes.find((h) => h.kind === 'listing' && JSON.parse(FEED).provider?.area_scans?.[h.city]?.truncated === true)
    ?? JSON.parse(FEED).homes.find((h) => h.kind === 'listing');
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
        // A pinned home has to be identifiable at a glance. Its card is a two
        // column grid on a phone, and the money column carries a price AND its
        // basis sentence: sized to that sentence, it leaves the address column
        // a few characters wide and the rank badge broken across lines.
        // A short name asking for less than the money column is not that --
        // what is measured is whether the name got what it ASKED for, and when
        // it could not, whether it was still left the wider half.
        finalistCards: [...document.querySelectorAll('.finalist-grid article')].map((a) => {
          const heading = a.querySelector('h4');
          const n = box(a.querySelector('.finalist-number'));
          const h = box(heading);
          const money = box(a.querySelector('.finalist-rent'));
          const over = (x, y) => !!x && !!y && x.left < y.right && y.left < x.right && x.top < y.bottom && y.top < x.bottom;
          // What one unwrapped line of this name would take.
          const wants = (() => {
            if (!heading) return 0;
            const copy = heading.cloneNode(true);
            copy.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap;width:auto;left:-9999px;top:0';
            heading.parentElement.appendChild(copy);
            const w = Math.round(copy.getBoundingClientRect().width);
            copy.remove();
            return w;
          })();
          return { name: (heading?.textContent ?? '').trim().slice(0, 26),
            rankHeight: n ? Math.round(n.height) : 0, rankWidth: n ? Math.round(n.width) : 0,
            nameWidth: h ? Math.round(h.width) : 0, moneyWidth: money ? Math.round(money.width) : 0,
            wants,
            // Only a phone puts the two beside each other; a wide card stacks them.
            sideBySide: !!h && !!money && money.top < h.bottom,
            overlap: over(h, money) || over(n, money) };
        }),
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
    check(`${label} a pinned home's name is not squeezed by the money beside it`,
      desk.finalistCards.length > 0 && desk.finalistCards.every((c) =>
        c.rankHeight > 0 && c.rankHeight <= 26 && !c.overlap &&
        (!c.sideBySide || c.nameWidth >= Math.min(c.wants, c.moneyWidth))),
      desk.finalistCards.map((c) => `${c.name}: name ${c.nameWidth}px of the ${c.wants}px it wants, money ${c.moneyWidth}px${c.sideBySide ? ' beside' : ' stacked'}, rank ${c.rankWidth}x${c.rankHeight}${c.overlap ? ', OVERLAPS the money' : ''}`).join(' · '));
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


  // --- 11. personal quote dates: a save time is not a quote day, on a screen --
  //         jsdom holds the record's shape and the words. Only a browser can
  //         say whether the reader can enter and clear a date with the keyboard,
  //         whether the history a Price Pulse row points at lands on screen
  //         under the record's dock, and whether the quote log fits a phone.
  {
    const QUOTE_KEY = 'spicyhome.workspace.v1';
    const QUOTE_HOMES = JSON.parse(FEED).homes;
    const QUOTE_HOME = QUOTE_HOMES.find((h) => h.kind === 'listing' && h.rent && h.rent > 1500 && h.rent < 2800);
    // A saved snapshot whose id no feed carries, with two entries from before
    // quote-date provenance was kept.
    const ARCHIVED = { ...QUOTE_HOMES.find((h) => h.kind === 'listing' && h.id !== QUOTE_HOME.id && h.rent),
      id: 'archived-quote-home', title: 'Archived Court', address: '1 Archived Way, Chicago, IL 60601' };
    const quoteNotebook = JSON.stringify({ version: 1, manual: [], events: [], preferences: {}, savedSearches: [],
      records: { [ARCHIVED.id]: { saved: true, status: 'contacted', rentOverride: 2350, quoteDate: '', snapshot: ARCHIVED,
        quote_history: [{ date: '2026-09-05', rent: 2450 }, { date: '2026-09-12', rent: 2350 }] } } });
    const usDate = (day) => new Date(day).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
    for (const [label, opts] of [['1280px dark', {}],
                                 ['390px dark', { width: 390, height: 844, mobile: true }],
                                 ['390px light', { width: 390, height: 844, mobile: true, theme: 'light' }],
                                 ['320px dark', { width: 320, height: 640, mobile: true }]]) {
      const tag = label.replace(/\s+/g, '-');
      const { context, page, errors } = await open(browser, opts);
      page.on('dialog', (d) => d.accept());
      // Seeded through the page itself, once, so a later reload re-reads what
      // the page saved rather than a seed applied on every navigation.
      await page.evaluate(({ key, notebook }) => localStorage.setItem(key, notebook), { key: QUOTE_KEY, notebook: quoteNotebook });
      await page.reload({ waitUntil: 'load' }); await page.waitForTimeout(900);
      const fold = opts.height ?? 900;
      const id = QUOTE_HOME.id;
      const record = (which = id) => page.evaluate(({ key, which }) => JSON.parse(localStorage.getItem(key)).records[which], { key: QUOTE_KEY, which });
      const openRecord = async () => {
        await page.evaluate(() => document.querySelector('[data-view="discover"]').click());
        await page.waitForTimeout(350);
        const opened = await page.evaluate((id) => { const b = document.querySelector(`[data-detail="${id}"]`); if (!b) return false; b.click(); return true; }, id);
        await page.waitForTimeout(350);
        return opened;
      };
      // Enter submits from the amount field; a date input's Enter does not.
      const submitByEnter = async () => { await page.focus('#rentOverride'); await page.keyboard.press('Enter'); await page.waitForTimeout(450); };
      const typeAmount = async (digits) => { await page.focus('#rentOverride'); await page.keyboard.press('Control+A'); await page.keyboard.type(digits); };
      const typeDate = async (digits) => { await page.focus('#quoteDate'); await page.keyboard.type(digits); };
      const clearDate = async () => { await page.focus('#quoteDate'); for (let i = 0; i < 3; i++) { await page.keyboard.press('Backspace'); await page.keyboard.press('Tab'); } };
      const pulse = async () => page.evaluate(async () => {
        if (!document.querySelector('[data-studio-tab="pulse"]')) {
          document.querySelector('[data-view="discover"]').click(); await new Promise((r) => setTimeout(r, 200));
          document.querySelector('[data-open-studio]').click(); await new Promise((r) => setTimeout(r, 200));
        }
        document.querySelector('[data-studio-tab="pulse"]').click();
        if (!document.querySelector('#pulse-saved').checked) document.querySelector('#pulse-saved').click();
        await new Promise((r) => setTimeout(r, 200));
        return { rows: [...document.querySelectorAll('.pulse-row')].map((r) => r.textContent.replace(/\s+/g, ' ').trim()),
          method: document.querySelector('.studio-method').textContent };
      });
      // 1. a dated quote, entered with the keyboard
      check(`${label} the record opens from Discover`, await openRecord());
      await typeAmount('2600'); await typeDate('09102026'); await submitByEnter();
      let r = await record();
      check(`${label} a dated quote is observed on the day entered`,
        r?.rentOverride === 2600 && r.quoteDate === '2026-09-10' && r.quote_history?.length === 1
          && r.quote_history[0].date === '2026-09-10' && r.quote_history[0].date_basis === 'entered' && Number.isFinite(Date.parse(r.quote_history[0].recorded_at)),
        JSON.stringify(r?.quote_history));
      // 2. the amount changes and the date is cleared, with the keyboard
      await openRecord(); await clearDate(); await typeAmount('2500'); await submitByEnter();
      r = await record();
      const undated = r?.quote_history?.[1];
      check(`${label} an undated change keeps the amount and invents no day`,
        r?.rentOverride === 2500 && r.quoteDate === '' && r.quote_history.length === 2 && undated?.rent === 2500
          && undated.date === null && undated.date_basis === 'unknown' && Number.isFinite(Date.parse(undated.recorded_at)),
        JSON.stringify(r?.quote_history));
      const saveDay = usDate(new Date(Number.isFinite(Date.parse(undated?.recorded_at)) ? Date.parse(undated.recorded_at) : Date.now()).toISOString().slice(0, 10));
      // 3. the shortlist and the comparison carry the amount and no day
      const desk = await page.evaluate(async (id) => {
        document.querySelector('[data-view="shortlist"]').click(); await new Promise((r) => setTimeout(r, 400));
        const row = document.querySelector(`.saved-row[data-home="${id}"]`);
        row.querySelector('[data-compare]').click(); await new Promise((r) => setTimeout(r, 200));
        document.querySelector('#open-compare')?.click(); await new Promise((r) => setTimeout(r, 400));
        const sheet = document.querySelector('#compare-content');
        const rent = [...sheet.querySelectorAll('.matrix tr, .sc-compare-pair__measure')].map((el) => el.textContent.replace(/\s+/g, ' ')).find((t) => /^Base rent/.test(t)) ?? '';
        const pair = sheet.querySelector('.sc-compare-pair__rows')?.textContent.replace(/\s+/g, ' ') ?? '';
        const out = { row: row.textContent.replace(/\s+/g, ' '), rent, pair, open: document.querySelector('#compare-dialog').open };
        document.querySelector('#compare-content [data-close]')?.click(); await new Promise((r) => setTimeout(r, 200));
        document.querySelector('#clear-compare')?.click();
        return out;
      }, id);
      check(`${label} the shortlist keeps the amount as the reader's quote and gives it no dated freshness`,
        /\$2,500/.test(desk.row) && /Your base-rent quote/.test(desk.row) && /No dated quote on record/.test(desk.row), desk.row.slice(0, 100));
      check(`${label} the comparison shows the same amount and prints no quote day`,
        desk.open && /\$2,500/.test(desk.rent + desk.pair) && !(desk.rent + desk.pair).includes(saveDay), desk.rent.slice(0, 60));
      // 4. Price Pulse derives nothing from a day nobody entered
      let p = await pulse();
      check(`${label} Price Pulse derives no personal movement from the undated change`,
        p.rows.filter((row) => /Your recorded quotes/.test(row)).length === 0 && /3 such quotes in this view/.test(p.method), p.method.slice(-120));
      await shot(page, `quotes-pulse-none-${tag}`);
      // 5. the history surface lists the undated quote where the reader can read it
      await openRecord();
      const hist = await page.evaluate(async () => {
        document.querySelector('[data-detail-jump="detail-history"]').click(); await new Promise((r) => setTimeout(r, 400));
        const section = document.querySelector('#detail-history').getBoundingClientRect();
        const dock = document.querySelector('.detail-dock').getBoundingClientRect();
        const log = document.querySelector('#detail-history .quote-log');
        return { top: Math.round(section.top), dockBottom: Math.round(dock.bottom), width: window.innerWidth, active: document.activeElement?.id,
          items: [...log.querySelectorAll('li')].map((li) => ({ text: li.textContent.replace(/\s+/g, ' '), right: Math.round(li.getBoundingClientRect().right) })),
          plotted: !!log.previousElementSibling?.classList.contains('history-chart'),
          sideways: document.querySelector('#detail-dialog').scrollWidth > document.querySelector('#detail-dialog').clientWidth + 1 };
      });
      check(`${label} History lands on screen under the dock`, hist.active === 'detail-history' && hist.top >= hist.dockBottom - 1 && hist.top < fold, `top ${hist.top}, dock ${hist.dockBottom}`);
      check(`${label} the undated quote is listed as unknown, the dated one as entered, and one day is no series`,
        hist.items.length === 2 && /^\$2,500 · quote date unknown — none entered, none assumed · Recorded .* Chicago time$/.test(hist.items[0].text)
          && /^\$2,600 · quoted Sep 10, 2026, a date you entered · Recorded .* Chicago time$/.test(hist.items[1].text) && !hist.plotted,
        hist.items.map((i) => i.text.slice(0, 70)).join(' | '));
      check(`${label} the quote log fits the screen`, !hist.sideways && hist.items.every((i) => i.right <= hist.width), `rights ${hist.items.map((i) => i.right)} of ${hist.width}`);
      await shot(page, `quotes-history-unknown-${tag}`);
      // 6. correcting only the date: one entry corrected, one movement between the reader's own days
      await openRecord(); await typeDate('09112026'); await submitByEnter();
      r = await record();
      check(`${label} a date-only edit corrects the active quote's entry and keeps what it replaced`,
        r.quoteDate === '2026-09-11' && r.quote_history.length === 2 && r.quote_history[1].date === '2026-09-11' && r.quote_history[1].date_basis === 'entered'
          && r.quote_history[1].recorded_at === undated.recorded_at && r.quote_history[1].date_corrections?.length === 1 && r.quote_history[1].date_corrections[0].from === null,
        JSON.stringify(r.quote_history[1]));
      p = await pulse();
      const personal = p.rows.filter((row) => /Your recorded quotes/.test(row));
      check(`${label} Price Pulse shows one movement, between the reader's two days and on no save day`,
        personal.length === 1 && /\$2,600 on Sep 10, 2026 → \$2,500 on Sep 11, 2026/.test(personal[0]) && /on days you entered/.test(personal[0]) && !personal[0].includes(saveDay),
        personal[0]?.slice(0, 120));
      await shot(page, `quotes-pulse-corrected-${tag}`);
      const reach = await page.evaluate(async () => {
        const row = [...document.querySelectorAll('.pulse-row')].find((r) => /Your recorded quotes/.test(r.textContent));
        row.querySelector('[data-studio-task][data-task-target="detail-history"]').click(); await new Promise((r) => setTimeout(r, 450));
        const section = document.querySelector('#detail-history').getBoundingClientRect();
        const dock = document.querySelector('.detail-dock').getBoundingClientRect();
        const log = document.querySelector('#detail-history .quote-log');
        return { open: document.querySelector('#detail-dialog').open, active: document.activeElement?.id, top: Math.round(section.top), dockBottom: Math.round(dock.bottom),
          first: log?.querySelector('li')?.textContent.replace(/\s+/g, ' ') ?? '', series: log?.previousElementSibling?.getAttribute('aria-label') ?? '' };
      });
      check(`${label} Inspect history reaches the corrected entry, on screen under the dock`,
        reach.open && reach.active === 'detail-history' && reach.top >= reach.dockBottom - 1 && reach.top < fold
          && /quoted Sep 11, 2026, a date you entered · Recorded .* · Date corrected .* \(was unknown\)/.test(reach.first)
          && /from \$2,600 on Sep 10, 2026 to \$2,500 on Sep 11, 2026/.test(reach.series),
        `${reach.first.slice(0, 100)} | top ${reach.top}`);
      await shot(page, `quotes-inspect-${tag}`);
      // 7. a notes-only save changes no quote evidence
      const frozen = JSON.stringify(r.quote_history);
      await openRecord(); await page.fill('#notes', 'Ask about the bike room'); await page.click('#record-form button[type="submit"]'); await page.waitForTimeout(450);
      r = await record();
      check(`${label} a notes-only save records no quote and re-dates none`, JSON.stringify(r.quote_history) === frozen && r.notes === 'Ask about the bike room' && r.quoteDate === '2026-09-11');
      // 8. a reload, then the export the reader would download
      await page.reload({ waitUntil: 'load' }); await page.waitForTimeout(900);
      r = await record();
      check(`${label} the quote history survives a reload`, JSON.stringify(r?.quote_history) === frozen);
      const exported = await page.evaluate((key) => JSON.stringify(JSON.parse(localStorage.getItem(key)), null, 2), QUOTE_KEY);
      check(`${label} no page errors through the quote journey`, errors.length === 0, errors.join(' | '));
      await context.close();
      // 9. that export imported into an empty notebook, and the archived record it carries
      const fresh = await open(browser, opts);
      fresh.page.on('dialog', (d) => d.accept());
      await fresh.page.setInputFiles('#import-file', { name: 'spicyhome-notebook-test.json', mimeType: 'application/json', buffer: Buffer.from(exported) });
      await fresh.page.waitForTimeout(700);
      const imported = await fresh.page.evaluate(({ key, id }) => JSON.parse(localStorage.getItem(key) ?? '{}').records?.[id], { key: QUOTE_KEY, id });
      check(`${label} an export imports with its unknown day and its correction intact`, JSON.stringify(imported?.quote_history) === frozen, JSON.stringify(imported?.quote_history)?.slice(0, 100));
      const archived = await fresh.page.evaluate(async (fold) => {
        document.querySelector('[data-view="shortlist"]').click(); await new Promise((r) => setTimeout(r, 400));
        const row = document.querySelector('.saved-row[data-home="archived-quote-home"]');
        if (!row) return { ran: false };
        const evidence = row.querySelector('.saved-evidence')?.textContent ?? '';
        row.querySelector('[data-detail]').click(); await new Promise((r) => setTimeout(r, 400));
        document.querySelector('[data-detail-jump="detail-history"]').click(); await new Promise((r) => setTimeout(r, 400));
        const section = document.querySelector('#detail-history').getBoundingClientRect();
        return { ran: true, evidence, open: document.querySelector('#detail-dialog').open, title: document.querySelector('#detail-title').textContent,
          callout: document.querySelector('#detail-content .callout').textContent,
          items: [...document.querySelectorAll('#detail-history .quote-log li')].map((li) => li.textContent.replace(/\s+/g, ' ')),
          summary: document.querySelector('#detail-history .quote-log + p')?.textContent ?? '', onScreen: section.top >= 0 && section.top < fold };
      }, fold);
      check(`${label} an archived record the feed no longer carries opens with its own quotes`,
        archived.ran && archived.open && archived.title === 'Archived Court' && /Archived notebook entry/.test(archived.evidence)
          && /current availability is unverified/.test(archived.callout) && archived.onScreen, `${archived.title} | ${archived.evidence?.slice(0, 50)}`);
      check(`${label} legacy days are kept, said to be of unrecorded provenance, and form no series`,
        archived.items?.length === 2 && /^\$2,350 · dated Sep 12, 2026 — recorded before this notebook kept quote-date provenance/.test(archived.items[0])
          && /^\$2,450 · dated Sep 5, 2026 — recorded before/.test(archived.items[1]) && /0 of 2 dated by you · 2 without date provenance/.test(archived.summary),
        archived.items?.map((i) => i.slice(0, 50)).join(' | '));
      await shot(fresh.page, `quotes-archived-${tag}`);
      check(`${label} no page errors after the import`, fresh.errors.length === 0, fresh.errors.join(' | '));
      await fresh.context.close();
    }
  }

} finally {
  await browser.close();
  server.close();
}
const failed = results.filter((r) => !r.ok);
console.log(`browser-check: ${results.length - failed.length}/${results.length} scenarios passed`);
if (failed.length) process.exit(1);

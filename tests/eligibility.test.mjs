import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';
import { emptyWorkspace, validateHome, validateFeed, validateWorkspace, eligibilityReading, pricePulse, defaults } from '../dist/model.js';

const read = path => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const full = JSON.parse(read('../dist/data.json'));
const ID = 'rentcast:2030-Greenwood-St,-Unit-1BR,-Evanston,-IL-60201';
const source = JSON.parse(read('../data/eligibility-evidence.json')).records[ID].evidence;
const original = full.homes.find(h => h.id === ID);
const other = full.homes.find(h => h.kind === 'building' && h.rent >= 1200 && h.rent <= 3000);
const fixture = () => structuredClone({ ...full, homes: [original, other] });
const KEY = 'spicyhome.workspace.v1';
const html = read('../dist/index.html');
const code = read('../dist/model.js').replace(/^export\s+/gm, '') + '\n' + read('../dist/app.js').replace(/^import\s*\{[\s\S]*?\}\s*from\s*["']\.\/model\.js(?:\?[^"']*)?["'];?\s*/, '');

// An isolated window and synthetic notebook for each journey; every fetch is
// answered from memory. This harness has no network path or personal state.
async function boot(data = fixture(), notebook = null) {
  const dom = new JSDOM(html, { url: 'https://eligibility.test/', runScripts: 'outside-only' });
  const w = dom.window, doc = w.document;
  w.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  w.HTMLDialogElement.prototype.close = function () { this.open = false; };
  w.matchMedia = () => ({ matches: false });
  w.confirm = () => true;
  w.URL.createObjectURL = () => 'blob:synthetic';
  w.URL.revokeObjectURL = () => {};
  w.HTMLAnchorElement.prototype.click = () => {};
  if (notebook) w.localStorage.setItem(KEY, JSON.stringify(notebook));
  w.fetch = async url => ({ ok: true, text: async () => JSON.stringify(String(url).includes('config.json') ? { feed_url: 'fixture', fallback_url: 'fixture' } : data) });
  w.eval(code);
  for (let i = 0; i < 80 && !doc.querySelector('#result-count'); i++) await new Promise(r => setTimeout(r, 3));
  return { w, doc, close: () => w.close(), notebook: () => JSON.parse(w.localStorage.getItem(KEY)),
    detail: () => { doc.querySelector(`[data-detail="${ID}"]`).click(); return doc.querySelector('#detail-content'); } };
}
const importText = (d, text) => d.doc.querySelector('#import-file').onchange({ target: { files: [{ size: text.length, text: async () => text }], value: '' } });
const save = d => d.doc.querySelector(`#results [data-save="${ID}"]`).click();

test('eligibility: all accepting boundaries reject malformed source annotations', () => {
  const variants = [null, [], {}, { ...source, scope: 'unrestricted' }, { ...source, note: 'x'.repeat(601) },
    ...['javascript:alert(1)', 'data:text/html,bad', '//example.com', 'https://u:p@example.com', 'https://example.com/\nfoo'].map(url => ({ ...source, source: { ...source.source, url } })),
    ...['2026-02-30', '', null, '2026-09-19T12:00:00Z'].map(observed_at => ({ ...source, source: { ...source.source, observed_at } })),
    { ...source, source: { ...source.source, supports: 'x'.repeat(1201) } }, { ...source, source: { url: source.source.url } }];
  assert(validateHome(original));
  for (const evidence of variants) {
    const h = { ...original, eligibility_evidence: evidence };
    assert.equal(validateHome(h), false);
    assert.throws(() => validateFeed({ ...full, homes: [h] }));
    assert.throws(() => validateWorkspace({ ...emptyWorkspace(), manual: [{ ...h, kind: 'manual' }] }));
    assert.throws(() => validateWorkspace({ ...emptyWorkspace(), records: { [ID]: { saved: true, snapshot: h } } }));
    assert.throws(() => validateWorkspace({ ...emptyWorkspace(), records: { [ID]: { saved: true, snapshot: original, eligibility_update: { evidence, recorded_at: '2026-09-20T00:00:00Z' } } } }));
  }
  const legacy = structuredClone(original); delete legacy.eligibility_evidence;
  const workspace = { ...emptyWorkspace(), records: { [ID]: { saved: true, snapshot: legacy } } };
  assert.deepEqual(validateWorkspace(workspace).records[ID].snapshot, legacy);
  assert.equal(eligibilityReading(legacy).evidence, null);
});

test('eligibility: Discover, dossier, saved/finalist and comparison show scoped evidence beside price', async () => {
  const d = await boot();
  const beforeFilter = d.doc.querySelector(`#results [data-home="${ID}"]`);
  d.doc.querySelector('#search').value = '2030 Greenwood';
  d.doc.querySelector('#search').dispatchEvent(new d.w.Event('input', { bubbles: true }));
  for (let i = 0; i < 100 && beforeFilter.isConnected; i++) await new Promise(r => setTimeout(r, 5));
  assert.equal(beforeFilter.isConnected, false, 'exercise the filtered-card rebind path');
  const card = d.doc.querySelector(`#results [data-home="${ID}"]`);
  assert.match(card.querySelector('.eligibility-note').textContent, /Income-restricted housing advertised at this address/);
  card.querySelector('[data-task-target="detail-eligibility"]').click();
  const detail = d.doc.querySelector('#detail-eligibility');
  assert(detail.open);
  assert.match(detail.textContent, /address \/ program; exact offer unconfirmed/);
  assert.match(detail.textContent, /Source observed Sep 19, 2026/);
  assert.equal(detail.querySelector('a').href, source.source.url);
  d.doc.querySelector('#detail-dialog').close();
  save(d);
  d.doc.querySelector('#reset-filters').click();
  for (const id of [ID, other.id]) d.doc.querySelector(`#results [data-compare="${id}"]`).click();
  d.doc.querySelector('#open-compare').click();
  assert.match(d.doc.querySelector('#compare-content').textContent, /Income-restricted housing advertised/);
  assert.match(d.doc.querySelector('#compare-content').textContent, /Eligibility evidence not recorded. Restrictions unknown/);
  d.doc.querySelector('#compare-dialog').close();
  d.doc.querySelector('[data-view="shortlist"]').click();
  assert(d.doc.querySelector('.saved-row .eligibility-note'));
  d.doc.querySelector(`[data-finalist="${ID}"]`).click();
  assert(d.doc.querySelector('.finalist-candidate .eligibility-note'));
  assert.deepEqual(d.notebook().records[ID].snapshot.eligibility_evidence, source);
  d.close();
});

test('eligibility: save reload export import archive and reappearance keep the original evidence', async () => {
  const first = await boot(); save(first);
  const detail = first.detail();
  detail.querySelector('#notes').value = 'Synthetic tour note';
  detail.querySelector('#parkingCost').value = '0';
  detail.querySelector('#rentOverride').value = '1300';
  detail.querySelector('#quoteDate').value = '';
  detail.querySelector('#record-form').dispatchEvent(new first.w.Event('submit'));
  const notebook = first.notebook(); first.close();
  const reloaded = await boot(fixture(), notebook);
  let exported;
  reloaded.w.Blob = class { constructor(parts) { exported = parts[0]; } };
  reloaded.doc.querySelector('[data-view="setup"]').click();
  reloaded.doc.querySelector('#export-notebook').click();
  assert.deepEqual(JSON.parse(exported).records[ID], notebook.records[ID]);
  reloaded.close();
  const absent = fixture(); absent.homes = [other];
  const fresh = await boot(absent);
  await importText(fresh, exported);
  fresh.doc.querySelector('[data-view="shortlist"]').click();
  assert.match(fresh.doc.querySelector('.saved-row').textContent, /Archived notebook entry/);
  assert.match(fresh.doc.querySelector('.saved-row .eligibility-note').textContent, /Saved source evidence/);
  const archived = fresh.detail();
  assert.match(archived.querySelector('#detail-eligibility').textContent, /Sep 19, 2026/);
  assert.equal(archived.querySelector('#notes').value, 'Synthetic tour note');
  assert.equal(archived.querySelector('#parkingCost').value, '0');
  assert.match(archived.querySelector('.dossier-subtotal').textContent, /Incomplete/);
  assert.match(archived.querySelector('#detail-history').textContent, /quote date unknown/);
  assert.deepEqual(fresh.notebook().records[ID].snapshot, notebook.records[ID].snapshot);
  const retained = fresh.notebook(); fresh.close();
  const changed = fixture(); changed.homes[0].rent = 1450; changed.homes[0].observed_at = '2026-09-26T12:00:00Z';
  const back = await boot(changed, retained);
  back.doc.querySelector('[data-view="shortlist"]').click();
  assert.equal(back.doc.querySelectorAll(`.saved-row[data-home="${ID}"]`).length, 1);
  assert.deepEqual(back.notebook().records[ID].snapshot, notebook.records[ID].snapshot);
  assert.match(back.doc.querySelector('.saved-row .eligibility-note').textContent, /Income-restricted/);
  back.close();
});

test('eligibility: older snapshots stay frozen and explicitly saved later evidence travels separately', async () => {
  const legacy = structuredClone(original); delete legacy.eligibility_evidence;
  const scan = { basis: 'provider_query', city: 'Evanston', saved_at: '2026-09-17T12:00:00Z', observed_at: legacy.observed_at };
  const notebook = { ...emptyWorkspace(), records: { [ID]: { saved: true, status: 'shortlisted', snapshot: legacy, scan, notes: 'original note' } } };
  const d = await boot(fixture(), notebook);
  const detail = d.detail();
  assert.match(detail.querySelector('#detail-eligibility').textContent, /not recorded in your original saved snapshot/);
  assert.deepEqual(d.notebook().records[ID], notebook.records[ID], 'reading current evidence cannot backfill the saved snapshot');
  detail.querySelector('[data-save]').click();
  const separatelyRecorded = d.notebook().records[ID].eligibility_update;
  detail.querySelector('#notes').value = 'New synthetic note';
  detail.querySelector('#record-form').dispatchEvent(new d.w.Event('submit'));
  const saved = d.notebook().records[ID];
  assert.deepEqual(saved.snapshot, legacy);
  assert.deepEqual(saved.scan, scan);
  assert.deepEqual(saved.eligibility_update.evidence, source);
  assert.deepEqual(saved.eligibility_update, separatelyRecorded, 'a form opened before the Save toggle cannot erase or re-date the newly retained evidence');
  assert(Number.isFinite(Date.parse(saved.eligibility_update.recorded_at)));
  assert.equal(saved.quote_history, undefined, 'a source annotation cannot create a personal price event');
  d.doc.querySelector('[data-view="shortlist"]').click();
  d.doc.querySelector(`[data-finalist="${ID}"]`).click();
  const stage = d.doc.querySelector(`[data-stage="${ID}"]`); stage.value = 'contacted'; stage.dispatchEvent(new d.w.Event('change'));
  assert.deepEqual(d.notebook().records[ID].eligibility_update, saved.eligibility_update, 'routine actions do not re-date unchanged evidence');
  assert.deepEqual(d.notebook().records[ID].snapshot, legacy);
  assert.deepEqual(d.notebook().records[ID].scan, scan);
  const backup = JSON.stringify(d.notebook()); d.close();
  const absent = fixture(); absent.homes = [other];
  const archive = await boot(absent); await importText(archive, backup);
  archive.doc.querySelector('[data-view="shortlist"]').click();
  assert.match(archive.detail().querySelector('#detail-eligibility').textContent, /Later source evidence recorded in this notebook/);
  assert.deepEqual(archive.notebook().records[ID].snapshot, legacy);
  archive.close();
});

test('eligibility: invalid imports fail atomically before confirmation; text cannot inject HTML', async () => {
  const d = await boot(); save(d);
  const before = d.w.localStorage.getItem(KEY);
  let confirms = 0; d.w.confirm = () => { confirms++; return true; };
  for (const value of [null, { ...source, note: 'x'.repeat(601) }, { ...source, source: { ...source.source, url: 'javascript:alert(1)' } }]) {
    const bad = JSON.parse(before); bad.records[ID].notes = 'should not land'; bad.records[ID].snapshot.eligibility_evidence = value;
    await importText(d, JSON.stringify(bad));
    assert.equal(d.w.localStorage.getItem(KEY), before);
  }
  const badUpdate = JSON.parse(before); badUpdate.records[ID].eligibility_update = { evidence: source, recorded_at: 'not a date' };
  await importText(d, JSON.stringify(badUpdate));
  assert.equal(d.w.localStorage.getItem(KEY), before);
  assert.equal(confirms, 0);
  d.close();
  const malicious = fixture();
  for (const field of ['note']) malicious.homes[0].eligibility_evidence[field] = '<img src=x onerror="window.injected=1">';
  malicious.homes[0].eligibility_evidence.source.name = '<script>window.injected=2</script>';
  malicious.homes[0].eligibility_evidence.source.supports = '<svg onload="window.injected=3">';
  const escaped = await boot(malicious);
  assert.equal(escaped.doc.querySelector('.eligibility-note img'), null);
  const detail = escaped.detail().querySelector('#detail-eligibility');
  assert.equal(detail.querySelector('script, img, svg'), null);
  assert.match(detail.textContent, /<script>/);
  assert.equal(escaped.w.injected, undefined);
  escaped.close();
});

test('eligibility: annotation alone cannot affect price movements, costs, filters or order', async () => {
  const { costs, visibleHomes } = await import('../dist/model.js');
  const annotated = fixture(), before = fixture(); delete before.homes[0].eligibility_evidence;
  assert.deepEqual(costs(before.homes[0], { parkingCost: 0 }, defaults), costs(annotated.homes[0], { parkingCost: 0 }, defaults));
  assert.deepEqual(visibleHomes(before.homes, emptyWorkspace(), defaults).map(h => h.id), visibleHomes(annotated.homes, emptyWorkspace(), defaults).map(h => h.id));
  const normalized = result => JSON.parse(JSON.stringify(result, (key, value) => key === 'eligibility_evidence' ? undefined : value));
  assert.deepEqual(normalized(pricePulse(before.homes, emptyWorkspace(), defaults, false, new Date('2026-09-20T12:00:00Z'))), normalized(pricePulse(annotated.homes, emptyWorkspace(), defaults, false, new Date('2026-09-20T12:00:00Z'))));
});

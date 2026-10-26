#!/usr/bin/env node
'use strict';
/* Fills content/photo-credits.json with the author and license of every Wikimedia Commons photo in content/photos.d/.
   It reads the Commons API (needs internet access to commons.wikimedia.org), so run it on your own computer or in CI:
     node scripts/photo-credits.js            fetch credits for photos that have none yet
     node scripts/photo-credits.js --all      fetch again for every Commons photo
     node scripts/photo-credits.js --check    exit 1 if any Commons photo still has no confirmed author/license (no network)
     node scripts/photo-credits.js --from saved.json [more.json ...]
                                              no network: read API responses saved by hand from
       https://commons.wikimedia.org/w/api.php?action=query&prop=imageinfo&iiprop=extmetadata&titles=File:a.jpg|File:b.jpg&format=json&origin=*
   Entries are keyed by the Commons file name ("File:..."); content/photos.js also accepts a photo id as the key.
   Each entry: { author, license, licenseUrl, attributionRequired, fetchedAt }. Nothing else in the project is changed.
   The parser is exported (require('./scripts/photo-credits.js').parseResponse) and unit-tested in tests/photos-check.js with tests/fixtures/commons-extmetadata.json. */
const fs = require('fs');
const path = require('path');
const OUT = path.join(__dirname, '..', 'content', 'photo-credits.json');
const BATCH = 50;   // the API accepts up to 50 titles per request

/* the Artist field is HTML; keep the visible text only */
const text = h => String(h || '').replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&nbsp;/g, ' ')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();

/* one Commons API response (formatversion 1 or 2) -> { 'File:Name.jpg': credit }; also returns the titles it could not use */
function parseResponse(j, today) {
  const out = {}, missing = [];
  const q = (j && j.query) || {};
  const norm = Object.fromEntries((q.normalized || []).map(n => [n.to, n.from]));
  for (const r of q.redirects || []) norm[r.to] = norm[r.from] || r.from;   // a renamed file: keep the name used in the manifest
  const pages = Array.isArray(q.pages) ? q.pages : Object.values(q.pages || {});
  for (const pg of pages) {
    const key = norm[pg.title] || pg.title;
    const m = (((pg.imageinfo || [])[0] || {}).extmetadata) || {};
    const v = k => (m[k] || {}).value;
    if (pg.missing !== undefined && pg.missing !== false || !v('LicenseShortName')) { missing.push(key); continue; }
    out[key] = {
      author: text(v('Artist')) || text(v('Credit')) || 'ไม่ระบุชื่อผู้สร้าง',
      license: text(v('LicenseShortName')),
      licenseUrl: v('LicenseUrl') || null,
      attributionRequired: v('AttributionRequired') !== 'false',
      fetchedAt: today || new Date().toISOString().slice(0, 10)
    };
  }
  return { credits: out, missing };
}
const apiUrl = titles => 'https://commons.wikimedia.org/w/api.php?action=query&format=json&formatversion=2&redirects=1&origin=*&prop=imageinfo&iiprop=extmetadata'
  + '&iiextmetadatafilter=Artist|LicenseShortName|LicenseUrl|AttributionRequired|Credit|UsageTerms&titles=' + encodeURIComponent(titles.join('|'));

module.exports = { parseResponse, text, apiUrl, BATCH };
if (require.main === module) main();

function main() {
const PHOTOS = require('../content/photos.js').PHOTOS;
const args = process.argv.slice(2);
let credits = {};
try { credits = JSON.parse(fs.readFileSync(OUT, 'utf8')); } catch (e) { credits = {}; }
const files = [...new Set(Object.values(PHOTOS).filter(p => p.credit && p.credit.source === 'commons').map(p => p.credit.file))].sort();
const save = () => { const sorted = Object.fromEntries(Object.keys(credits).sort().map(k => [k, credits[k]])); fs.writeFileSync(OUT, JSON.stringify(sorted, null, 2) + '\n'); };

if (args.includes('--from')) {
  const srcs = args.slice(args.indexOf('--from') + 1).filter(a => !a.startsWith('--'));
  if (!srcs.length) { console.error('usage: node scripts/photo-credits.js --from saved-api-response.json [...]'); process.exit(2); }
  let ok = 0;
  for (const f of srcs) {
    const r = parseResponse(JSON.parse(fs.readFileSync(f, 'utf8')));
    for (const [k, c] of Object.entries(r.credits)) { credits[k] = c; ok++; console.log(`  ${k}: ${c.author} | ${c.license}`); }
    for (const k of r.missing) console.log('  NOT FOUND or no license:', k);
  }
  save();
  console.log(`saved ${ok} credit(s) to content/photo-credits.json`);
  return;
}

if (args.includes('--check')) {
  const missing = files.filter(f => !(credits[f] && credits[f].author && credits[f].license));
  console.log(`Commons photos: ${files.length}, confirmed credits: ${files.length - missing.length}`);
  for (const f of missing) console.log('  missing:', f);
  process.exit(missing.length ? 1 : 0);
}

(async () => {
  const todo = args.includes('--all') ? files : files.filter(f => !(credits[f] && credits[f].author && credits[f].license));
  console.log(`Commons photos: ${files.length}, to fetch: ${todo.length}`);
  let ok = 0;
  for (let i = 0; i < todo.length; i += BATCH) {
    const batch = todo.slice(i, i + BATCH);
    const r = await fetch(apiUrl(batch), { headers: { 'User-Agent': 'NetLab-photo-credits/1.0 (course website; credits for reused photos)' } });
    if (!r.ok) throw new Error('Commons API HTTP ' + r.status);
    const p = parseResponse(await r.json());
    for (const [k, c] of Object.entries(p.credits)) { credits[k] = c; ok++; console.log(`  ${k}: ${c.author} | ${c.license}`); }
    for (const k of p.missing) console.log('  NOT FOUND or no license:', k);
  }
  save();
  console.log(`saved ${ok} credit(s) to content/photo-credits.json`);
})().catch(e => { console.error('photo-credits:', e.message, '\n(this script needs internet access to commons.wikimedia.org)'); process.exit(1); });
}

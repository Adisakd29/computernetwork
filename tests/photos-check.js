// 2.16 real device photos: every photo entry, file, label, credit and placement is valid.
//   node tests/photos-check.js            (Commons photos without a confirmed author/license are reported as warnings)
//   node tests/photos-check.js --strict   (those become errors: run before deploying, after scripts/photo-credits.js)
'use strict';
const fs = require('fs');
const path = require('path');
const P = require('../content/photos');
const { LESSONS } = require('../server/lessons');
const strict = process.argv.includes('--strict');
const errors = [], warns = [];
const bad = m => errors.push(m), warn = m => warns.push(m);

/* JPEG size from the SOF marker (no dependencies) */
function jpegSize(buf) {
  if (buf[0] !== 0xFF || buf[1] !== 0xD8) return null;
  let i = 2;
  while (i < buf.length) {
    if (buf[i] !== 0xFF) { i++; continue; }
    const m = buf[i + 1], len = buf.readUInt16BE(i + 2);
    if ((m >= 0xC0 && m <= 0xC3) || (m >= 0xC5 && m <= 0xC7) || (m >= 0xC9 && m <= 0xCB) || (m >= 0xCD && m <= 0xCF)) return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
    i += 2 + len;
  }
  return null;
}
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
const used = new Map();
const PUBLIC_LESSONS = require('../server/lessons').PUBLIC;
for (const L of LESSONS.values()) for (const s of L.sections) for (const b of s.blocks) if (P.isPhotoBlock(b)) {
  const ids = P.photoIds(b), nb = P.normBlock(b);
  if (!nb.name) bad(`${L.id} ${s.id}: photo block without a name`);
  if (!ids.length) bad(`${L.id} ${s.id}: photo block ${nb.name} has no photos`);
  if (b.type === 'photos' && (ids.length < 2 || ids.length > 4)) bad(`${L.id} ${s.id}: photos gallery ${nb.name} needs 2-4 names`);
  for (const id of ids) { if (!P.PHOTOS[id]) bad(`${L.id} ${s.id}: unknown photo id ${id}`); used.set(id, (used.get(id) || []).concat(`${L.id}/${s.id}`)); }
  if (b.caption && EMOJI.test(b.caption)) bad(`${L.id} ${s.id}: emoji in caption`);
}
/* what the server actually sends: every photo block is resolved, every item has the fields the client needs */
for (const [lid, json] of PUBLIC_LESSONS) for (const s of JSON.parse(json).sections) for (const b of s.blocks) {
  if (b.type === 'photos') bad(`${lid} ${s.id}: 'photos' block sent unresolved`);
  if (b.type !== 'photo') continue;
  if (!Array.isArray(b.items) || !b.items.length) { bad(`${lid} ${s.id}: photo block ${b.name} resolved to no photos`); continue; }
  for (const it of b.items) for (const k of ['file', 'small', 'w', 'h', 'alt', 'labels', 'page'])
    if (it[k] == null || it[k] === '') bad(`${lid} ${s.id}: photo ${it.id} sent without ${k}`);
}

const files = new Set(fs.existsSync(P.PUBDIR) ? fs.readdirSync(P.PUBDIR) : []);
const known = new Set();
let unverified = 0;
for (const [id, p] of Object.entries(P.PHOTOS)) {
  const where = `photo ${id} (${p.batch})`;
  if (!/^[a-z0-9-]+$/.test(id)) bad(`${where}: id must be lower-case letters, digits and -`);
  if (!p.title || !p.alt || p.alt.length < 20) bad(`${where}: title and a descriptive alt (20+ characters) are required`);
  if ([p.title, p.alt, ...(p.labels || []).map(l => l.text)].some(t => t && EMOJI.test(t))) bad(`${where}: emoji`);
  if (!/\.jpg$/.test(p.file || '')) bad(`${where}: file must be a .jpg`);
  for (const [f, max, kb] of [[p.file, 1600, 400], [P.smallOf(p.file || ''), 800, 160]]) {
    known.add(f);
    if (!files.has(f)) { bad(`${where}: missing public/photos/${f}`); continue; }
    const buf = fs.readFileSync(path.join(P.PUBDIR, f)), sz = jpegSize(buf);
    if (!sz) { bad(`${where}: ${f} is not a JPEG`); continue; }
    if (Math.max(sz.w, sz.h) > max) bad(`${where}: ${f} is ${sz.w}x${sz.h}, long edge must be at most ${max}`);
    if (buf.length > kb * 1024) bad(`${where}: ${f} is ${Math.round(buf.length / 1024)} KB (max ${kb})`);
    if (f === p.file && (sz.w !== p.w || sz.h !== p.h)) bad(`${where}: w/h ${p.w}x${p.h} do not match the file ${sz.w}x${sz.h}`);
    if (f !== p.file && p.w && Math.abs(sz.w / sz.h - p.w / p.h) > 0.02) bad(`${where}: ${f} has a different aspect ratio`);
    if (buf.includes(Buffer.from('Exif')) && buf.indexOf(Buffer.from('GPS')) > 0) bad(`${where}: ${f} may contain GPS metadata`);
  }
  (p.labels || []).forEach((l, i) => {
    if (!(l.x >= 2 && l.x <= 98 && l.y >= 2 && l.y <= 98) || !l.text || !String(l.text).trim()) bad(`${where}: label out of range or empty: ${JSON.stringify(l)}`);
    if (l.n != null && l.n !== i + 1) bad(`${where}: label n must run 1..k in order, got ${l.n} at position ${i + 1}`);
  });
  if ((p.labels || []).length > 12) bad(`${where}: more than 12 labels`);
  const c = p.credit || {};
  if (c.source === 'commons') {
    if (!/^File:.+\.(jpe?g|png|tiff?|webp)$/i.test(c.file || '')) bad(`${where}: credit.file must be the Commons file name "File:....jpg"`);
    const pub = P.publicPhoto(id);
    if (pub.page !== 'https://commons.wikimedia.org/wiki/' + encodeURI(String(c.file).replace(/ /g, '_')) || pub.commons !== c.file) bad(`${where}: credit page does not match the Commons file name`);
    if (!P.creditOf(p).verified) { unverified++; (strict ? bad : warn)(`${where}: author/license of ${c.file} not confirmed yet (run node scripts/photo-credits.js)`); }
  } else if (c.source === 'pexels') { if (!/^https:\/\/www\.pexels\.com\/photo\//.test(c.page || '')) bad(`${where}: pexels credit needs the photo page`); }
  else if (c.source === 'unsplash') { if (!/^https:\/\/unsplash\.com\/photos\//.test(c.page || '')) bad(`${where}: unsplash credit needs the photo page`); }
  else if (c.source !== 'teacher') bad(`${where}: credit.source must be commons, pexels, unsplash or teacher`);
  if (!used.has(id)) bad(`${where}: not used in any lesson`);
}
for (const f of files) if (!known.has(f)) bad(`public/photos/${f}: no entry in content/photos.d`);

/* scripts/photo-credits.js parser on a saved Commons API response (no network) */
{
  const { parseResponse } = require('../scripts/photo-credits.js');
  const r = parseResponse(JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'commons-extmetadata.json'), 'utf8')), '2026-01-01');
  const a = r.credits['File:Crimping-pliers-pro-RJ-0a.jpg'], b = r.credits['File:Ethernet RJ45 connector p1160054.jpg'];
  const expect = (ok, m) => { if (!ok) bad('photo-credits parser: ' + m); };
  expect(a && a.author === 'Example User & Friend', 'Artist HTML must become plain text, got ' + JSON.stringify(a && a.author));
  expect(a && a.license === 'CC BY-SA 3.0' && a.licenseUrl === 'https://creativecommons.org/licenses/by-sa/3.0' && a.attributionRequired === true && a.fetchedAt === '2026-01-01', 'license fields of file a');
  expect(b && b.author === 'Own work' && b.license === 'Public domain' && b.licenseUrl === null && b.attributionRequired === false, 'empty Artist falls back to Credit; no LicenseUrl is null');
  expect(r.missing.length === 1 && r.missing[0] === 'File:no_such_netlab_file.jpg', 'a missing file is reported under the name that was asked for');
  expect(Object.keys(r.credits).length === 2, 'exactly two credits parsed');
}

console.log(`photos: ${Object.keys(P.PHOTOS).length} entries, ${used.size} used, ${[...used.values()].reduce((a, v) => a + v.length, 0)} placements, Commons credits not yet confirmed: ${unverified}`);
for (const w of warns) console.log('  warning:', w);
for (const e of errors) console.log('  ✗', e);
console.log(errors.length ? `${errors.length} problem(s)` : 'photos OK');
process.exit(errors.length ? 1 : 0);

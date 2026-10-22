'use strict';
/* NetLab real photos of real devices (2.16). One entry per photo file in public/photos/.
   Lessons place photos with { type:'photo', name, photos:[ids], caption, layout:'single'|'grid' } through
   content/lessons/visuals.d/*.js (anchor placement) or directly in a lesson; server/lessons.js resolves the ids here.
   Drawings stay only where they teach something a photo cannot (pin order, cross-sections, light paths).

   Entry fields
     file      'name.jpg' in public/photos/ (long edge 1600 px); 'name-800.jpg' is the smaller copy for phones
     w, h      pixel size of file
     title     short Thai name shown under the photo
     alt       what the photo shows, for screen readers (Thai)
     labels    optional numbered markers on the photo: { x, y (percent of width/height), text }
     credit    where the photo comes from
                 { source:'commons', file:'File:Name.jpg' }   Wikimedia Commons; author and license come from
                    content/photo-credits.json, filled by `node scripts/photo-credits.js` on a machine that can reach
                    commons.wikimedia.org (see docs/PHOTOS.md). Until then the credit links to the file page.
                 { source:'pexels', page, author }            Pexels License (free use, attribution not required)
                 { source:'unsplash', page, author }          Unsplash License (free use, attribution not required)
                 { source:'teacher', author }                 photographed by the course teacher
     changes   optional: what was changed from the original (e.g. 'ครอปและย่อขนาด'), shown in the credit

   Block shapes accepted in lessons and visuals.d (all are normalised by normBlock() below):
     { type:'photo', name:'<block name>', photos:['id', ...], layout, caption }    original 2.16 shape
     { type:'photo', name:'<photo id>', caption }                                  one photo; name is the photo id
     { type:'photos', names:['a','b','c'], caption }                               a gallery of 2-4 photos
   New photo files: python3 scripts/photo-import.py <id> <source> --commons "File:..." (writes <id>.jpg and <id>-800.jpg).
   content/photo-credits.json may be keyed by Commons file name ("File:...", what scripts/photo-credits.js writes) or by photo id. */
const fs = require('fs');
const path = require('path');

const PHOTOS = require('./photos.d/index.js');
/* entries added outside the batches (same fields as photos.d); the coordinator may move them into a photos.d file */
const LOCAL = {
};
for (const [id, p] of Object.entries(LOCAL)) {
  if (PHOTOS[id]) throw new Error('photos.js: duplicate photo id ' + id);
  PHOTOS[id] = Object.assign({ batch: 'photos.js' }, p);
}
let CREDITS = {};
try { CREDITS = JSON.parse(fs.readFileSync(path.join(__dirname, 'photo-credits.json'), 'utf8')); } catch (e) { CREDITS = {}; }

const LICENSES = {
  pexels: { license: 'Pexels License', licenseUrl: 'https://www.pexels.com/license/', site: 'Pexels' },
  unsplash: { license: 'Unsplash License', licenseUrl: 'https://unsplash.com/license', site: 'Unsplash' }
};
const commonsPage = f => 'https://commons.wikimedia.org/wiki/' + encodeURI(String(f).replace(/ /g, '_'));

/* public credit of one photo: { site, page, author?, license?, licenseUrl?, verified, changes? } */
function creditOf(p, id) {
  const c = p.credit || {};
  if (c.source === 'commons') {
    const k = CREDITS[c.file] || (id && CREDITS[id]) || {};
    return { site: 'Wikimedia Commons', page: commonsPage(c.file), file: c.file, author: k.author || null, license: k.license || null,
      licenseUrl: k.licenseUrl || null, verified: !!(k.author && k.license), changes: p.changes || null };
  }
  if (LICENSES[c.source]) return { site: LICENSES[c.source].site, page: c.page, author: c.author || null, license: LICENSES[c.source].license,
    licenseUrl: LICENSES[c.source].licenseUrl, verified: true, changes: p.changes || null };
  if (c.source === 'teacher') return { site: null, page: null, author: c.author || 'ครูผู้สอน', license: null, licenseUrl: null, verified: true, changes: null };
  return { site: null, page: null, author: null, license: null, licenseUrl: null, verified: false, changes: null };
}

const PUBDIR = path.join(__dirname, '..', 'public', 'photos');
const VER = {};
function ver(file) {   // content hash in the URL: a replaced photo gets a new URL, so the offline cache never shows an old one
  if (!VER[file]) { try { VER[file] = require('crypto').createHash('sha1').update(fs.readFileSync(path.join(PUBDIR, file))).digest('hex').slice(0, 8); } catch (e) { VER[file] = '0'; } }
  return VER[file];
}
const smallOf = file => file.replace(/\.(jpe?g|webp|png)$/i, '-800.$1');
function publicPhoto(id) {
  const p = PHOTOS[id]; if (!p) return null;
  const small = smallOf(p.file);
  const credit = creditOf(p, id);
  const src = '/photos/' + p.file + '?v=' + ver(p.file), src800 = '/photos/' + small + '?v=' + ver(small);
  return { id, src, src800, w: p.w, h: p.h, title: p.title, alt: p.alt,
    labels: (p.labels || []).map((l, i) => ({ n: i + 1, x: l.x, y: l.y, text: l.text })), credit,
    // flat aliases (same data) so a block carries file/small/page/commons/author/license/licenseUrl directly
    file: src, small: src800, page: credit.page || null, commons: credit.file || null,
    author: credit.author || null, license: credit.license || null, licenseUrl: credit.licenseUrl || null };
}

/* the photo ids a lesson block names, for every accepted shape; [] for other block types */
function photoIds(b) {
  if (!b) return [];
  if (b.type === 'photos') return Array.isArray(b.names) ? b.names.slice() : [];
  if (b.type !== 'photo') return [];
  if (Array.isArray(b.photos)) return b.photos.slice();
  return b.name ? [b.name] : [];
}
const isPhotoBlock = b => !!b && (b.type === 'photo' || b.type === 'photos');
/* any accepted shape -> { type:'photo', name, photos, layout, caption } (the shape the client renders) */
function normBlock(b) {
  const ids = photoIds(b);
  const name = b.type === 'photos' ? (b.name || 'photos-' + ids.join('+')) : b.name;
  return { type: 'photo', name, photos: ids, layout: b.layout || (ids.length > 1 ? 'grid' : 'single'), caption: b.caption || null };
}

/* lesson block -> public block with resolved photos (unknown ids are dropped with a warning) */
function resolveBlock(b) {
  const n = normBlock(b);
  const items = n.photos.map(id => { const r = publicPhoto(id); if (!r) console.warn('photos: unknown photo id', id); return r; }).filter(Boolean);
  return { type: 'photo', name: n.name, caption: n.caption, layout: n.layout, items };
}

/* where each photo is used: server/lessons.js calls setUsage() after placing every block */
let USAGE = {};
function setUsage(u) { USAGE = u || {}; }

/* every photo with its credit and where it is used, for the credits page (GET /api/photo-credits) */
function creditList() {
  return Object.keys(PHOTOS).sort().map(id => {
    const r = publicPhoto(id);
    return { id, title: r.title, src800: r.src800, w: r.w, h: r.h, credit: r.credit, used: USAGE[id] || [] };
  });
}

module.exports = { PUBDIR, smallOf, PHOTOS, CREDITS, creditOf, publicPhoto, photoIds, isPhotoBlock, normBlock, resolveBlock, setUsage, creditList, commonsPage };

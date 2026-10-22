'use strict';
/* Accept technically equivalent answer formats for typed answers (Phase 4 "รองรับคำตอบหลายรูปแบบ").
   - subnet mask written as dotted mask or as prefix: 255.255.255.192 == /26 (a bare "26" counts only when the key itself is a prefix)
   - numbers with thousands separators: 1,024 == 1024
   Only applies when the accepted answer itself is a mask/prefix/number, so it never widens unrelated text answers. */
const MASKS = new Map();
for (let p = 0; p <= 32; p++) { const m = p === 0 ? 0 : (0xFFFFFFFF << (32 - p)) >>> 0; MASKS.set([m >>> 24, (m >>> 16) & 255, (m >>> 8) & 255, m & 255].join('.'), p); }
const clean = s => String(s == null ? '' : s).trim().replace(/\s+/g, '');
function prefixOf(s, allowBare) {
  const v = clean(s);
  if (MASKS.has(v)) return MASKS.get(v);
  let m = v.match(/^\/(\d{1,2})$/); if (m && +m[1] <= 32) return +m[1];
  if (allowBare) { m = v.match(/^(\d{1,2})$/); if (m && +m[1] <= 32) return +m[1]; }
  return null;
}
const numOf = s => { const v = clean(s); return /^\d{1,3}(,\d{3})+$/.test(v) ? v.replace(/,/g, '') : /^\d+$/.test(v) ? v.replace(/^0+(?=\d)/, '') : null; };
function equivalent(key, given) {
  const k = clean(key); if (!k) return false;
  const kp = prefixOf(k, false);
  if (kp != null) { const gp = prefixOf(given, /^\//.test(k)); return gp != null && gp === kp; }
  const kn = numOf(k); if (kn != null) { const gn = numOf(given); return gn != null && gn === kn; }
  return false;
}
module.exports = { equivalent, prefixOf };

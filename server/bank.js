'use strict';
/* Question bank: content/bank/unitN.js. Public views never include answers. */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DIR = path.join(__dirname, '..', 'content', 'bank');
const Q = new Map();         // id -> question (with answers)
const UNITS = {};            // unit -> [ids]

for (const f of fs.readdirSync(DIR).filter(f => /^unit\d+\.js$/.test(f))) {
  for (const q of require(path.join(DIR, f))) {
    Q.set(q.id, q);
    (UNITS[q.unit] = UNITS[q.unit] || []).push(q.id);
  }
}

/* deterministic shuffle from a string seed */
function shuffled(arr, seed) {
  const h = crypto.createHash('sha256').update(String(seed)).digest();
  const a = arr.slice();
  for (let i = a.length - 1, k = 0; i > 0; i--, k++) {
    const j = ((h[k % 32] << 8) | h[(k + 7) % 32]) % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  if (a.length > 1 && a.every((v, i) => v === arr[i])) [a[0], a[1]] = [a[1], a[0]];
  return a;
}

function publicQ(q) {
  const o = { id: q.id, unit: q.unit, week: q.week, level: q.level, type: q.type, q: q.q, tags: q.tags };
  switch (q.type) {
    case 'choice': case 'multi': o.options = q.options.slice(); break;
    case 'match': o.left = q.left.slice(); o.right = q.right.slice(); break;
    case 'order': o.items = shuffled(q.items, 'order:' + q.id); break;   // items are stored in the correct order
    case 'fill': o.blanks = q.blanks.length; break;
    case 'subnet': o.ip = q.ip; o.ask = q.ask.slice(); if (q.maskGiven) o.mask = maskOf(q.prefix); else o.prefix = q.prefix; break;
    case 'diagram': o.answerType = q.answerType || 'choice'; o.options = q.options.slice(); if (q.topo) o.topo = q.topo; if (q.diagram) o.diagram = q.diagram; break;
    case 'command': o.os = q.os; break;
    case 'scenario': o.context = q.context; if (q.pre) o.pre = q.pre; o.steps = q.steps.map(s => ({ q: s.q, options: s.options.slice() })); break;
  }
  return o;
}
function maskOf(p) { const m = p === 0 ? 0 : (0xFFFFFFFF << (32 - p)) >>> 0; return [m >>> 24, (m >>> 16) & 255, (m >>> 8) & 255, m & 255].join('.'); }

/* pick questions: filter by units/levels/types; counts per level, falling back to other levels when short */
function draw({ units, levels, types, n, counts, seed, exclude }) {
  const pool = [...Q.values()].filter(q =>
    (!units || !units.length || units.includes(q.unit)) &&
    (!types || !types.length || types.includes(q.type)) &&
    (!exclude || !exclude.has(q.id)));
  const rnd = seed ? (() => { let c = 0; return () => { const h = crypto.createHash('sha256').update(seed + ':' + (c++)).digest(); return h.readUInt32BE(0) / 4294967296; }; })() : Math.random;
  const pick = (list, k) => { const a = list.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a.slice(0, k); };
  if (counts) {
    const out = []; let short = 0;
    for (const lv of ['easy', 'medium', 'hard']) {
      const want = Math.max(0, counts[lv] | 0);
      const got = pick(pool.filter(q => q.level === lv), want);
      out.push(...got); short += want - got.length;
    }
    if (short > 0) out.push(...pick(pool.filter(q => !out.includes(q)), short));
    return pick(out, out.length).map(q => q.id);
  }
  const lv = levels && levels.length ? pool.filter(q => levels.includes(q.level)) : pool;
  return pick(lv, Math.max(1, Math.min(50, n | 0 || 10))).map(q => q.id);
}

function stats() {
  const by = {};
  for (const q of Q.values()) {
    const u = (by[q.unit] = by[q.unit] || { unit: q.unit, total: 0, easy: 0, medium: 0, hard: 0, types: {} });
    u.total++; u[q.level]++; u.types[q.type] = (u.types[q.type] || 0) + 1;
  }
  return Object.values(by).sort((a, b) => a.unit - b.unit);
}

module.exports = { Q, UNITS, publicQ, draw, stats };

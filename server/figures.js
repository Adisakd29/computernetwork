'use strict';
/* Server-side view of the diagram catalog (public/js/diagrams*.js + figs-*.js), used to build "label the diagram"
   questions: the answers (text labels) stay on the server, the browser only gets the positions to cover. */
const vm = require('vm'), fs = require('fs'), path = require('path');
const DIR = path.join(__dirname, '..', 'public', 'js');
let SVG = null;
function load() {
  const ctx = { document: { createElement: () => ({ style: {} }), head: { append() {} }, getElementById: () => null, querySelector: () => null } };
  ctx.window = ctx; ctx.self = ctx; vm.createContext(ctx);
  const files = ['diagrams.js', 'diagrams2.js', ...fs.readdirSync(DIR).filter(f => /^figs-.*\.js$/.test(f)).sort()];
  for (const f of files) { try { vm.runInContext(fs.readFileSync(path.join(DIR, f), 'utf8'), ctx, { filename: f, timeout: 2000 }); } catch (e) { console.warn('figures:', f, e.message); } }
  SVG = ctx.NL_DIAGRAMS || {};
}
const svgOf = name => { if (!SVG) load(); return SVG[name] || null; };
const decode = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
/* every <text> element: its x/y attributes and plain content (tspans joined) */
function texts(name) {
  const s = svgOf(name); if (!s) return null;
  const out = [];
  for (const m of s.matchAll(/<text\b([^>]*)>([\s\S]*?)<\/text>/g)) {
    const a = m[1], x = (a.match(/\bx="([^"]*)"/) || [])[1], y = (a.match(/\by="([^"]*)"/) || [])[1];
    out.push({ x, y, text: decode(m[2].replace(/<[^>]+>/g, '')).trim() });
  }
  return out;
}
/* positions for the labels to hide; null if a label is not found exactly once as a whole text element */
function marksFor(name, hide) {
  const T = texts(name); if (!T) return null;
  const marks = [];
  for (const h of hide) {
    const hits = T.filter(t => t.text === h);
    if (hits.length !== 1 || hits[0].x == null || hits[0].y == null) return null;
    marks.push({ x: hits[0].x, y: hits[0].y });
  }
  return marks;
}
module.exports = { svgOf, texts, marksFor, names: () => { if (!SVG) load(); return Object.keys(SVG); } };

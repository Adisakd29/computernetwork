'use strict';
/* Validates content/lessons/guide/wN.js (per-section learning guide).
   Shape: { sN: { lead: string, goals: string[1..3], gloss: [{en,say,th,ex}], keys: string[2..4] } } */
const fs = require('fs'), path = require('path');
const DIR = path.join(__dirname, '..', 'content', 'lessons');
let issues = 0, sections = 0, withGuide = 0, terms = 0;
const bad = (...m) => { issues++; console.log('  x', ...m); };
const seenTerm = new Map();
const str = (v, min, max) => typeof v === 'string' && v.trim().length >= min && v.length <= max;
for (let w = 1; w <= 18; w++) {
  const L0 = require(path.join(DIR, `w${w}.js`)), XF = path.join(DIR, 'extra', `w${w}.js`);
  const L = { sections: L0.sections.concat(fs.existsSync(XF) ? require(XF) : []) };
  const f = path.join(DIR, 'guide', `w${w}.js`);
  sections += L.sections.length;
  if (!fs.existsSync(f)) { bad(`w${w}: guide file missing`); continue; }
  const G = require(f);
  for (const sid of Object.keys(G)) if (!L.sections.some(s => s.id === sid)) bad(`w${w}: unknown section ${sid}`);
  for (const s of L.sections) {
    const g = G[s.id]; const at = `w${w}/${s.id}`;
    if (!g) { bad(at, 'no guide'); continue; }
    withGuide++;
    if (!str(g.lead, 10, 220)) bad(at, 'lead must be a question 10-220 chars');
    else if (!/[?？]|ไหม|อย่างไร|อะไร|ทำไม|เท่าไร|หรือไม่|แบบไหน|ใด/.test(g.lead)) bad(at, 'lead should be phrased as a question:', g.lead);
    if (!Array.isArray(g.goals) || g.goals.length < 1 || g.goals.length > 3 || !g.goals.every(x => str(x, 8, 160))) bad(at, 'goals: 1-3 strings');
    if (!Array.isArray(g.keys) || g.keys.length < 2 || g.keys.length > 4 || !g.keys.every(x => str(x, 8, 220))) bad(at, 'keys: 2-4 strings');
    if (g.gloss != null) {
      if (!Array.isArray(g.gloss) || g.gloss.length > 5) bad(at, 'gloss: up to 5 items');
      else for (const t of g.gloss) {
        terms++;
        if (!str(t.en, 2, 60) || !str(t.say, 2, 80) || !str(t.th, 6, 220) || !str(t.ex, 6, 220)) bad(at, 'gloss item needs en/say/th/ex', JSON.stringify(t).slice(0, 80));
        const k = (t.en || '').toLowerCase();
        if (seenTerm.has(k)) bad(at, `glossary term "${t.en}" repeats ${seenTerm.get(k)}`); else seenTerm.set(k, at);
        if (/[\u{1F300}-\u{1FAFF}]/u.test(JSON.stringify(t))) bad(at, 'emoji in glossary');
      }
    }
  }
}
console.log(`guide: ${withGuide}/${sections} sections, ${terms} glossary terms, ${issues} issue(s)`);
process.exit(issues ? 1 : 0);

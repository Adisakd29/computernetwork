'use strict';
/* Lesson content (18 weeks): public view without answers + answer keys for grading */
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'content', 'lessons');
const PHOTOS = require('../content/photos');
const LESSONS = new Map();       // id -> full lesson
const QKEYS = new Map();         // key -> { lesson, q, kind:'quiz'|'check', index }
const PUBLIC = new Map();        // id -> public JSON string
let META = '[]';

function publicQ(q) {
  const o = { type: q.type, q: q.q, level: q.level };
  if (q.options) o.options = q.options.slice();
  return o;
}

/* extra visuals (content/lessons/visuals.js) are placed by anchor so lesson text can change independently */
let VISUALS = [];
try { VISUALS = require(path.join(DIR, 'visuals.js')); } catch (e) { VISUALS = []; }
// more placements, one file per batch: content/lessons/visuals.d/*.js (same shape as visuals.js)
try { const D = path.join(DIR, 'visuals.d'); if (fs.existsSync(D)) for (const f of fs.readdirSync(D).filter(f => f.endsWith('.js')).sort()) VISUALS = VISUALS.concat(require(path.join(D, f))); } catch (e) { console.warn('visuals.d:', e.message); }
// a { type:'photos', names } gallery without a name gets one, so placeVisuals() can tell galleries apart
for (const v of VISUALS) if (v.block && v.block.type === 'photos' && !v.block.name) v.block = Object.assign({}, v.block, { name: PHOTOS.normBlock(v.block).name });
function blockText(b) { return [b.text, b.name, b.term, b.title, (b.items || []).join(' '), (b.head || []).join(' ')].filter(Boolean).join(' '); }
function placeVisuals(L) {
  for (const v of VISUALS.filter(x => x.lesson === L.id)) {
    const S = L.sections.find(x => x.id === v.section); if (!S) { console.warn('visuals: no section', v.lesson, v.section); continue; }
    if (S.blocks.some(b => b.type === v.block.type && b.name === v.block.name)) continue;          // already there
    const i = S.blocks.findIndex(b => b.type === v.anchor.type && blockText(b).includes(v.anchor.match));
    if (i < 0) { console.warn('visuals: anchor not found, appended', v.lesson, v.section, v.block.name); S.blocks.push(v.block); continue; }
    if (v.mode === 'replace') S.blocks.splice(i, 1, v.block); else if (v.mode === 'before') S.blocks.splice(i, 0, v.block); else S.blocks.splice(i + 1, 0, v.block);
  }
}
/* parallel post-test (form B), index-aligned with quiz (form A) */
function loadForm(L) {
  const f = path.join(DIR, 'forms', L.id + '.js');
  if (!fs.existsSync(f)) return null;
  const B = require(f);
  if (!Array.isArray(B) || B.length !== L.quiz.length) { console.warn('form B ignored (length mismatch):', L.id); return null; }
  return B;
}
/* per-section learning guide (lead question, measurable goals, glossary, key points): content/lessons/guide/wN.js */
const GUIDE_KEYS = ['lead', 'goals', 'gloss', 'keys'];
function loadGuide(L) {
  const f = path.join(DIR, 'guide', L.id + '.js');
  if (!fs.existsSync(f)) return {};
  const G = require(f);
  for (const sid of Object.keys(G)) if (!L.sections.some(s => s.id === sid)) console.warn('guide: no section', L.id, sid);
  return G;
}
const formOf = (L, kind) => (kind === 'post' && L.quizB ? L.quizB : L.quiz);
let GLOSSARY = '[]';
/* plain text per section for full-text search (no check answers, no quiz) */
const SEARCH = [];
function plain(b) {
  if (b.type === 'check') return b.q && b.q.q ? b.q.q : '';
  if (b.type === 'table') return [(b.head || []).join(' '), ...(b.rows || []).map(r => r.join(' '))].join(' ');
  if (PHOTOS.isPhotoBlock(b)) return [b.caption, ...PHOTOS.photoIds(b).map(id => (PHOTOS.PHOTOS[id] || {}).title)].filter(Boolean).join(' ');
  return [b.title, b.term, b.text, b.caption, (b.items || []).join(' ')].filter(Boolean).join(' ');
}

function load() {
  const files = fs.readdirSync(DIR).filter(f => /^w\d+\.js$/.test(f)).sort((a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1)));
  for (const f of files) {
    const L = require(path.join(DIR, f));
    // 2.8: supplementary sections (content/lessons/extra/wN.js) appended after the core ones; ids x1, x2, ...
    // they are marked extra and do not count towards "content finished", so earlier progress keeps its status
    const xf = path.join(DIR, 'extra', L.id + '.js');
    if (fs.existsSync(xf) && !L.sections.some(s => s.extra)) L.sections = L.sections.concat(require(xf).map(s => Object.assign({}, s, { extra: true })));
    LESSONS.set(L.id, L);
    placeVisuals(L);
    L.quizB = loadForm(L);
    L.guide = loadGuide(L);
    L.quiz.forEach((q, i) => QKEYS.set(`L:${L.id}:q:${i}`, { lesson: L, q, kind: 'quiz', index: i }));
    if (L.quizB) L.quizB.forEach((q, i) => QKEYS.set(`L:${L.id}:p:${i}`, { lesson: L, q, kind: 'quizB', index: i }));
    let n = 0;
    const sections = L.sections.map(s => ({
      id: s.id, title: s.title, ...(s.extra ? { extra: true } : {}),
      ...Object.fromEntries(GUIDE_KEYS.filter(k => L.guide[s.id] && L.guide[s.id][k] != null).map(k => [k, L.guide[s.id][k]])),
      blocks: s.blocks.map(b => {
        if (PHOTOS.isPhotoBlock(b)) return PHOTOS.resolveBlock(b);   // 2.16 real photos ('photo' or 'photos'): ids -> files, size, labels, credit
        if (b.type !== 'check') return b;
        const key = `L:${L.id}:c:${n++}`;
        QKEYS.set(key, { lesson: L, q: b.q, kind: 'check', index: n - 1 });
        return { type: 'check', key, q: publicQ(b.q) };
      })
    }));
    L.checkCount = n;
    PUBLIC.set(L.id, JSON.stringify({
      id: L.id, week: L.week, unit: L.unit, title: L.title, minutes: L.minutes,
      objectives: L.objectives, competency: L.competency, keywords: L.keywords,
      quiz: L.quiz.map((q, i) => ({ key: `L:${L.id}:q:${i}`, ...publicQ(q) })),
      quizPost: L.quizB ? L.quizB.map((q, i) => ({ key: `L:${L.id}:p:${i}`, ...publicQ(q) })) : null,
      sections, summary: L.summary
    }));
  }
  const gl = [];
  for (const L of LESSONS.values()) for (const s of L.sections) for (const g of ((L.guide[s.id] || {}).gloss || []))
    gl.push({ ...g, lesson: L.id, week: L.week, section: s.id, title: s.title });
  GLOSSARY = JSON.stringify(gl);
  const usage = {};   // photo id -> where it is used, for the credits page
  for (const L of LESSONS.values()) for (const s of L.sections) for (const b of s.blocks) for (const id of PHOTOS.photoIds(b))
    (usage[id] = usage[id] || []).push({ lesson: L.id, week: L.week, section: s.id, title: s.title });
  PHOTOS.setUsage(usage);
  SEARCH.length = 0;
  for (const L of LESSONS.values()) for (const s of L.sections) {
    const g = L.guide[s.id] || {};
    const text = [s.title, g.lead, ...(g.keys || []), ...(g.gloss || []).map(t => t.en + ' ' + t.th), ...s.blocks.map(plain)].filter(Boolean).join(' ').replace(/\s+/g, ' ');
    SEARCH.push({ lesson: L.id, week: L.week, ltitle: L.title, section: s.id, stitle: s.title, text, low: text.toLowerCase() });
  }
  META = JSON.stringify([...LESSONS.values()].map(L => ({
    id: L.id, week: L.week, unit: L.unit, title: L.title, minutes: L.minutes, keywords: L.keywords,
    sections: L.sections.map(s => ({ id: s.id, title: s.title, ...(s.extra ? { extra: true } : {}) })), checks: L.checkCount, coreChecks: L.sections.filter(s => !s.extra).reduce((a, s) => a + s.blocks.filter(b => b.type === 'check').length, 0), quiz: L.quiz.length,
    text: L.sections.map(s => s.title).join(' ') + ' ' + L.objectives.join(' ')
  })));
}
load();

/* human-readable correct answer for feedback after the post-test */
function answerText(q) {
  switch (q.type) {
    case 'choice': return q.options[q.correct];
    case 'multi': return q.correct.map(i => q.options[i]).join(', ');
    case 'tf': return q.answer ? 'ถูก' : 'ผิด';
    case 'text': return q.answers[0];
    default: return '';
  }
}

module.exports = { LESSONS, QKEYS, PUBLIC, get META() { return META; }, get GLOSSARY() { return GLOSSARY; }, SEARCH, answerText, formOf };

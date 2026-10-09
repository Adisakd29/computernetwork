'use strict';
/* Lesson content (18 weeks): public view without answers + answer keys for grading */
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'content', 'lessons');
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
function blockText(b) { return [b.text, b.name, b.term, b.title, (b.items || []).join(' '), (b.head || []).join(' ')].filter(Boolean).join(' '); }
function placeVisuals(L) {
  for (const v of VISUALS.filter(x => x.lesson === L.id)) {
    const S = L.sections.find(x => x.id === v.section); if (!S) { console.warn('visuals: no section', v.lesson, v.section); continue; }
    if (S.blocks.some(b => b.type === v.block.type && b.name === v.block.name)) continue;          // already there
    const i = S.blocks.findIndex(b => b.type === v.anchor.type && blockText(b).includes(v.anchor.match));
    if (i < 0) { console.warn('visuals: anchor not found, appended', v.lesson, v.section, v.block.name); S.blocks.push(v.block); continue; }
    if (v.mode === 'replace') S.blocks.splice(i, 1, v.block); else S.blocks.splice(i + 1, 0, v.block);
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
const formOf = (L, kind) => (kind === 'post' && L.quizB ? L.quizB : L.quiz);

function load() {
  const files = fs.readdirSync(DIR).filter(f => /^w\d+\.js$/.test(f)).sort((a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1)));
  for (const f of files) {
    const L = require(path.join(DIR, f));
    LESSONS.set(L.id, L);
    placeVisuals(L);
    L.quizB = loadForm(L);
    L.quiz.forEach((q, i) => QKEYS.set(`L:${L.id}:q:${i}`, { lesson: L, q, kind: 'quiz', index: i }));
    if (L.quizB) L.quizB.forEach((q, i) => QKEYS.set(`L:${L.id}:p:${i}`, { lesson: L, q, kind: 'quizB', index: i }));
    let n = 0;
    const sections = L.sections.map(s => ({
      id: s.id, title: s.title,
      blocks: s.blocks.map(b => {
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
  META = JSON.stringify([...LESSONS.values()].map(L => ({
    id: L.id, week: L.week, unit: L.unit, title: L.title, minutes: L.minutes, keywords: L.keywords,
    sections: L.sections.map(s => ({ id: s.id, title: s.title })), checks: L.checkCount, quiz: L.quiz.length,
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

module.exports = { LESSONS, QKEYS, PUBLIC, get META() { return META; }, answerText, formOf };

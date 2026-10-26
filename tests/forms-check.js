// Validates parallel post-test forms: content/lessons/forms/wN.js (index-aligned with quiz in content/lessons/wN.js)
// usage: node tests/forms-check.js            (all files present)
//        node tests/forms-check.js w3 w4
'use strict';
const fs = require('fs'), path = require('path');
const { check } = require('../server/grading');
const DIR = path.join(__dirname, '..', 'content', 'lessons');
const FORMS = path.join(DIR, 'forms');
const names = process.argv.slice(2).length ? process.argv.slice(2) : fs.readdirSync(FORMS).filter(f => /^w\d+\.js$/.test(f)).map(f => f.replace('.js', ''));
const right = q => q.type === 'choice' ? q.correct : q.type === 'multi' ? q.correct : q.type === 'tf' ? q.answer : q.answers[0];
const norm = s => String(s || '').replace(/\s+/g, '').toLowerCase();
let bad = 0;
for (const n of names.sort((a, b) => a.slice(1) - b.slice(1))) {
  const errs = [], warns = [];
  let A, B;
  try { A = require(path.join(DIR, n + '.js')).quiz; } catch (e) { errs.push('cannot load lesson: ' + e.message); }
  try { delete require.cache[require.resolve(path.join(FORMS, n + '.js'))]; B = require(path.join(FORMS, n + '.js')); } catch (e) { errs.push('cannot load form: ' + e.message); }
  if (A && B) {
    if (!Array.isArray(B) || B.length !== A.length) errs.push(`form must be an array of ${A.length} items`);
    else B.forEach((q, i) => {
      const a = A[i], w = `#${i + 1}`;
      if (!q || q.type !== a.type) errs.push(`${w} type must match quiz A (${a.type})`);
      if (q.level !== a.level) errs.push(`${w} level must match quiz A (${a.level})`);
      if (!q.q || !q.explain || q.explain.length < 15) errs.push(`${w} needs q and explain`);
      if (norm(q.q) === norm(a.q)) errs.push(`${w} question text is identical to form A`);
      if (q.type === 'choice') {
        if (!Array.isArray(q.options) || q.options.length < 3 || new Set(q.options).size !== q.options.length) errs.push(`${w} options`);
        if (!Number.isInteger(q.correct) || q.correct < 0 || q.correct >= (q.options || []).length) errs.push(`${w} correct index`);
        if (q.why && q.why.length !== q.options.length) errs.push(`${w} why[] length`);
        if (q.options && a.options && norm(q.options.join('|')) === norm(a.options.join('|'))) warns.push(`${w} same options as form A`);
      }
      if (q.type === 'multi' && (!Array.isArray(q.correct) || q.correct.length < 2 || q.correct.some(x => x < 0 || x >= q.options.length))) errs.push(`${w} multi correct`);
      if (q.type === 'tf' && typeof q.answer !== 'boolean') errs.push(`${w} tf answer`);
      if (q.type === 'text' && (!Array.isArray(q.answers) || !q.answers.length)) errs.push(`${w} text answers`);
      if (!errs.some(e => e.startsWith(w + ' '))) { const c = check(q, right(q)); if (!c.correct) errs.push(`${w} canonical answer graded wrong`); }
    });
    const pos = B.filter(q => q.type === 'choice').map(q => q.correct);
    if (pos.length >= 4 && Math.max(...[0, 1, 2, 3].map(k => pos.filter(p => p === k).length)) > Math.ceil(pos.length * 0.5)) warns.push('correct option position not varied: ' + pos.join(','));
    const longest = B.filter(q => q.type === 'choice').filter(q => { const L = q.options.map(o => o.length); return L[q.correct] === Math.max(...L) && L.filter(x => x === Math.max(...L)).length === 1; }).length;
    if (pos.length && longest / pos.length > 0.5) warns.push(`correct option is the single longest in ${longest}/${pos.length} choice items`);
  }
  console.log(`${n}: ${errs.length ? 'FAIL' : 'ok'}`); errs.forEach(e => console.log('   ERROR', e)); warns.forEach(w => console.log('   warn ', w));
  if (errs.length) bad++;
}
process.exit(bad ? 1 : 0);

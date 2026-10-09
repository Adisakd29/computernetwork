// Content + client audit (no database needed): node tests/audit.js
// 1) checks every task's data, 2) grades the correct and a wrong answer for every task,
// 3) loads the real page in jsdom with an in-process fake API and solves every lab as a guest,
// 4) checks that terminal answers match the simulated command output.
'use strict';
const path = require('path');
const fs = require('fs');
const { JSDOM } = require('jsdom');
const { ALL } = require('../content/labs');
const { TASKS, PUBLIC } = require('../server/content');
const { check } = require('../server/grading');
const LESSONS = require('../server/lessons');

const issues = [];
const bad = m => { issues.push(m); console.log('  ✗', m); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const correct = t => t.type === 'text' ? t.answers[0] : t.type === 'choice' ? t.correct : t.type === 'order' ? t.items.map(x => x.t)
  : t.fields.map(f => f.type === 'select' ? f.options.find(o => f.ok(o)) : (f.ok.v !== undefined ? f.ok.v : 'Lab#2026room!'));
const wrong = t => t.type === 'text' ? 'zz-wrong-zz' : t.type === 'choice' ? (t.correct + 1) % t.options.length : t.type === 'order' ? t.items.map(x => x.t).reverse() : t.fields.map(() => '');

(async () => {
  console.log('== Content checks');
  const B = new Set([8, 10, 32, 39, 44, 45, 46, 47, ...Array.from({ length: 10 }, (_, i) => 48 + i), 59, 61, 91, 92, 93, 96, ...Array.from({ length: 26 }, (_, i) => 97 + i),
    33, 34, 35, 36, 37, 38, 40, 41, 42, 43, 58, 60, 62, 63, 64, ...Array.from({ length: 26 }, (_, i) => 65 + i), 94, 95, 123, 124, 125, 126]);
  const ids = new Set();
  for (const r of ALL) {
    if (ids.has(r.id)) bad('duplicate lab id ' + r.id); ids.add(r.id);
    if (!r.flag) bad(r.id + ' has no flag');
    [...r.tasks, ...(r.vmTasks || [])].forEach((t, i) => {
      const w = `${r.id}#${i + 1}`;
      if (!t.q || !t.explain || !t.hint) bad(w + ' missing question/explanation/hint');
      if (t.type === 'choice' && !(t.correct >= 0 && t.correct < t.options.length)) bad(w + ' choice index out of range');
      if (t.type === 'choice' && new Set(t.options).size !== t.options.length) bad(w + ' duplicate options');
      if (t.type === 'order' && t.labels.length !== t.items.length) bad(w + ' labels/items mismatch');
      if (t.type === 'order' && new Set(t.items.map(x => x.t)).size !== t.items.length) bad(w + ' duplicate items');
      if (t.type === 'form') t.fields.forEach((f, k) => { if (f.type === 'select' && !f.options.some(o => f.ok(o))) bad(`${w} field ${k} has no valid option`); });
    });
    if (r.vmSetup) for (const ch of r.vmSetup) if (!B.has(ch.charCodeAt(0))) bad(`${r.id} VM setup has a character the virtual keyboard cannot type: ${JSON.stringify(ch)}`);
  }
  console.log(`  ${ALL.length} labs, ${TASKS.size} tasks`);

  console.log('== Server grading of every task');
  for (const [key, { task }] of TASKS) {
    if (!check(task, correct(task)).correct) bad(key + ' correct answer graded wrong');
    const wr = check(task, wrong(task));
    if (wr.correct) bad(key + ' wrong answer graded correct');
  }
  for (const [key, k] of LESSONS.QKEYS) {
    const q = k.q;
    const right = q.type === 'choice' ? q.correct : q.type === 'multi' ? q.correct : q.type === 'tf' ? q.answer : q.answers[0];
    const wrongA = q.type === 'choice' ? (q.correct + 1) % q.options.length : q.type === 'multi' ? [...Array(q.options.length).keys()].filter(i => !q.correct.includes(i)).slice(0, 1) : q.type === 'tf' ? !q.answer : 'zz-wrong-zz';
    if (!check(q, right).correct) bad(key + ' lesson answer key graded wrong');
    if (check(q, wrongA).correct) bad(key + ' lesson wrong answer graded correct');
  }
  for (const s of LESSONS.PUBLIC.values()) ['"correct"', '"explain"', '"answers"', '"answer"', '"why"'].forEach(k => { if (s.includes(k)) bad('public lesson leaks ' + k); });
  const pub = PUBLIC;
  ['"answers"', '"correct"', '"explain"', '"hint"', '"flag"'].forEach(k => { if (pub.includes(k)) bad('public content leaks ' + k); });

  console.log('== Page in jsdom (guest) with in-process API');
  const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
  const fakeFetch = async (url, opts = {}) => {
    const body = opts.body ? JSON.parse(opts.body) : {};
    const reply = (obj, status = 200) => ({ ok: status < 400, status, json: async () => obj });
    if (url === '/api/content') return reply(JSON.parse(PUBLIC));
    if (url === '/api/me') return reply({ db: false, user: null });
    if (url === '/api/lessons') return reply(JSON.parse(LESSONS.META));
    if (url.startsWith('/api/lessons/')) return reply(JSON.parse(LESSONS.PUBLIC.get(url.split('/')[3])));
    if (url === '/api/hint') return reply({ hint: TASKS.get(body.key).task.hint });
    if (url === '/api/check') {
      const t = TASKS.get(body.key); const c = check(t.task, body.answer);
      if (c.empty) return reply({ error: 'empty', message: 'ยังไม่ได้ตอบ' }, 400);
      return reply({ correct: c.correct, detail: c.detail, explain: c.correct ? t.task.explain : undefined, flag: c.correct ? t.lab.flag : undefined, given: c.correct ? (t.task.type === 'choice' ? t.task.options[body.answer] : Array.isArray(body.answer) ? body.answer.join(' | ') : String(body.answer)) : undefined, guest: true });
    }
    return reply({ error: 'not_found' }, 404);
  };
  const { ResourceLoader } = require('jsdom');
  class LocalLoader extends ResourceLoader {
    fetch(url, opts) {
      const u = new URL(url);
      if (u.hostname === 'localhost') { const f = path.join(__dirname, '..', 'public', u.pathname); return Promise.resolve(fs.readFileSync(f)); }
      return null; // external (fonts) ignored
    }
  }
  const dom = new JSDOM(html, { runScripts: 'dangerously', resources: new LocalLoader(), pretendToBeVisual: true, url: 'http://localhost/index.html',
    beforeParse(w) { w.fetch = fakeFetch; w.scrollTo = () => {}; w.confirm = () => true; w.alert = () => {}; w.localStorage.setItem('netlab-v2', JSON.stringify({ name: 'ทดสอบ' })); } });
  const w = dom.window, d = w.document; const errs = []; w.addEventListener('error', e => errs.push(e.message));
  for (let i = 0; i < 50 && !(w.ALL && w.eval('ALL.length')); i++) await sleep(100);
  const CL = w.eval('ALL');
  if (CL.length !== ALL.length) bad('page loaded ' + CL.length + ' labs');

  for (let ri = 0; ri < CL.length; ri++) {
    const r = ALL[ri];
    w.eval(`openRoom(${ri})`); await sleep(2);
    const sb = d.querySelector('.btn.start'); if (sb) sb.click(); await sleep(5);
    const all = [...r.tasks, ...(r.vmTasks || [])];
    for (let i = 0; i < all.length; i++) {
      const t = all[i], key = i < r.tasks.length ? `${r.id}-${i}` : `${r.id}-vm${i - r.tasks.length}`;
      const card = d.getElementById('task-' + key);
      if (!card) { bad(key + ' card not rendered'); continue; }
      if (t.type === 'text') { card.querySelector('input').value = t.answers[0]; card.querySelector('.row .btn').click(); }
      else if (t.type === 'choice') { [...card.querySelectorAll('.choice')].find(b => b.textContent === t.options[t.correct]).click(); }
      else if (t.type === 'order') {
        for (const it of t.items) { const chip = [...d.getElementById('task-' + key).querySelectorAll('.pool .chip')].find(c => c.textContent === it.t); if (!chip) { bad(key + ' chip missing ' + it.t); break; } chip.click(); }
        [...d.getElementById('task-' + key).querySelectorAll('.btn')].find(b => b.textContent === 'ตรวจลำดับ').click();
      } else if (t.type === 'form') {
        const cs = card.querySelectorAll('.form input,.form select'); const ans = correct(t);
        cs.forEach((c, k) => { c.value = ans[k]; }); card.querySelector('.row .btn').click();
      }
      await sleep(3);
      const c2 = d.getElementById('task-' + key);
      if (!c2 || !c2.classList.contains('solved')) bad(`${key} (${t.type}) not solved in the page: ${c2 && c2.querySelector('.msg').textContent}`);
    }
    if (!d.querySelector('#flagbox .flag')) bad(r.id + ' flag not shown');
    await sleep(1300);
    const tm = w.eval(`S.timers['${r.id}']`); if (!tm || tm.status !== 'finished') bad(r.id + ' did not auto-finish');
    if (w.eval(`roomScore(ALL[${ri}])`) !== w.eval(`roomMax(ALL[${ri}])`)) bad(r.id + ' not full score after perfect run');
  }

  console.log('== Guessing penalty');
  {
    w.eval("S.timers={};S.done={};S.att={};S.wrong={};S.hints={};save()");
    const ri = ALL.findIndex(r => r.id === 'w1'); w.eval(`openRoom(${ri})`); d.querySelector('.btn.start').click(); await sleep(5);
    const t = ALL[ri].tasks[0]; const btns = [...d.getElementById('task-w1-0').querySelectorAll('.choice')];
    for (const b of btns) if (b.textContent !== t.options[t.correct]) { b.click(); await sleep(3); b.click(); await sleep(3); }
    btns.find(b => b.textContent === t.options[t.correct]).click(); await sleep(5);
    const p = w.eval("pts('w1-0')"); if (p !== 4) bad('expected 4 points after 3 distinct wrong picks, got ' + p);
  }

  console.log('== Terminal answers match command output');
  for (const r of ALL.filter(x => x.terminal)) {
    w.eval(`openRoom(${ALL.indexOf(r)})`); await sleep(2);
    const sb = d.querySelector('.btn.start'); if (sb) sb.click(); await sleep(2);
    const inp = d.querySelector('.term input');
    for (const c of ['ipconfig', 'ipconfig /all', 'hostname', 'net view', 'net share', 'whoami', 'net user', 'net user student', 'net user guest', 'net localgroup administrators', 'arp -a', 'netstat', 'nslookup www.netlab.test', 'getmac', 'ping 192.168.20.99', 'tracert 8.8.8.8']) {
      inp.value = c; inp.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Enter' }));
    }
    await sleep(9000);
    const out = d.querySelector('.screen').textContent.toLowerCase().replace(/\s+/g, '');
    r.tasks.forEach((t, i) => {
      if (t.type !== 'text' || /\\\\/.test(t.answers[0]) || /^\d{1,2}$/.test(t.answers[0])) return;
      if (!t.answers.some(a => out.includes(String(a).toLowerCase().replace(/\s/g, '')))) bad(`${r.id}#${i + 1} answer "${t.answers[0]}" not in terminal output`);
    });
  }

  console.log('JS errors:', errs.length ? errs : 'none');
  console.log(`\nISSUES (${issues.length})`); issues.forEach(i => console.log(' -', i));
  process.exit(issues.length ? 1 : 0);
})();

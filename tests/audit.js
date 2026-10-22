// Content + client audit (no database needed): node tests/audit.js
// 1) checks every task's data, 2) grades the correct and a wrong answer for every task,
// 3) loads the real page in jsdom with an in-process fake API: the practical plan of every week, and every hands-on task solved in its card,
// 4) checks that terminal answers match the simulated command output (tasks marked know:true are knowledge questions, not read from the terminal).
'use strict';
const path = require('path');
const fs = require('fs');
const { JSDOM } = require('jsdom');
const { ALL } = require('../content/labs');
const { TASKS, PUBLIC, TWINS, isActive } = require('../server/content');
const { check } = require('../server/grading');
const LESSONS = require('../server/lessons');
const PRA = require('../server/practical');

const issues = [];
const bad = m => { issues.push(m); console.log('  ✗', m); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const correct = t => t.type === 'text' ? t.answers[0] : t.type === 'choice' ? t.correct : t.type === 'order' ? t.items.map(x => x.t)
  : t.fields.map(f => f.type === 'select' ? f.options.find(o => f.ok(o)) : (f.ok.v !== undefined ? f.ok.v : 'Lab#2026room!'));
const wrong = t => t.type === 'text' ? 'zz-wrong-zz' : t.type === 'choice' ? (t.correct + 1) % t.options.length : t.type === 'order' ? t.items.map(x => x.t).reverse() : t.fields.map(() => '');

/* the same public plan GET /api/curriculum serves (server/api.js) */
const CURRICULUM = () => { const { WEEKS, MINUTES, firstWeekOf } = require('../content/curriculum'); const { MODS } = require('../server/sims-api');
  const ref = r => { const [sim, id] = r.split(':'); const m = MODS[sim].missions.find(x => x.id === id);
    return { sim, id, simTitle: MODS[sim].title, title: m.title, level: m.level || 'medium', minutes: MINUTES[m.level] || 15, max: m.max || 10, first: firstWeekOf(r) }; };
  return { weeks: WEEKS.map(w => ({ id: w.id, strand: w.strand, focus: w.focus, can: w.can, skills: w.skills, guided: w.guided.map(ref), independent: w.independent.map(ref),
    trouble: w.trouble.map(ref), solve: w.solve.map(ref), solveType: w.solveType, more: w.more.map(ref), planned: w.planned || [] })) }; };
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
  // 2.9: a merged copy must be the same question with the same accepted answer as the copy that was kept
  for (const [from, to] of TWINS) {
    const a = TASKS.get(from), b = TASKS.get(to.key);
    if (!a || !b) { bad(`twin ${from} -> ${to.key} missing`); continue; }
    if (a.task.type !== b.task.type) { bad(`twin ${from} -> ${to.key} type differs`); continue; }
    const ans = t => t.type === 'text' ? t.answers[0] : t.type === 'choice' ? t.options[t.correct] : t.type === 'order' ? t.items.map(x => x.t).join('|') : null;
    const okA = a.task.type === 'choice' ? check(b.task, b.task.options.indexOf(ans(a.task))).correct : a.task.type === 'order' ? ans(a.task) === ans(b.task) : check(b.task, ans(a.task)).correct;
    if (!okA) bad(`twin ${from} -> ${to.key}: answer of the merged copy is not accepted by the kept copy`);
    if (a.task.type === 'text' && !b.task.answers.every(x => check(a.task, x).correct)) bad(`twin ${from} -> ${to.key}: kept copy accepts answers the merged copy did not`);
  }
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
    if (url === '/api/content?v=29') return reply(JSON.parse(PUBLIC));
    if (url === '/api/me') return reply({ db: false, user: null });
    if (url === '/api/curriculum') return reply(CURRICULUM());
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

  /* 3.2: hands-on tasks live in the week's practical page (#/lesson/wN/lab, one server timer); knowledge tasks moved to the
     question bank and the room sets are retired. Guest: the plan of every week matches the server's practical set, and
     every active hands-on task card renders and is solved in the page (the in-process API grades statelessly).
     The guessing penalty (each distinct wrong answer -2, hint -5) is scored on the server per session: tests/api.test.js */
  for (const W of ALL.filter(r => /^w\d+$/.test(r.id))) {
    w.location.hash = `#/lesson/${W.id}/lab`;
    let pg = null; for (let i = 0; i < 80 && !(pg = d.querySelector(`#prPage[data-week="${W.id}"][data-mode="guest"] #prPlan`)); i++) await sleep(25);
    if (!pg) { bad(W.id + ' practical page (guest) not rendered'); continue; }
    const shown = [...d.querySelectorAll('#prPlan .prplanitem[data-key]')].map(x => x.dataset.key).sort();
    const want = PRA.setOf(W.id).items.map(i => i.key).sort();
    if (shown.join() !== want.join()) bad(`${W.id} plan shows [${shown}] but the session holds [${want}]`);
    if (d.querySelector('a[href*="/solve"],a[href*="/extra"],a[href*="/challenge"]')) bad(W.id + ': a link to a removed step is still on the page');
  }
  w.eval('PR={id:"audit",st:{running:{id:1}},busy:true,dead:true,off:0}');
  const host = d.createElement('div'); d.body.append(host);
  let cards = 0;
  for (const r of ALL) {
    const all = [...r.tasks, ...(r.vmTasks || [])];
    for (let i = 0; i < all.length; i++) {
      const t = all[i], key = i < r.tasks.length ? `${r.id}-${i}` : `${r.id}-vm${i - r.tasks.length}`;
      if (!PRA.isPracticalTask(key) || i >= r.tasks.length) continue;   // VM tasks are checked against the Linux simulator in e2e
      host.replaceChildren(w.eval(`prTaskCard({key:${JSON.stringify(key)},kind:'task'},null)`));
      const card = d.getElementById('task-' + key);
      if (!card) { bad(key + ' card not rendered'); continue; }
      cards++;
      if (t.type === 'text') { card.querySelector('input').value = t.answers[0]; card.querySelector('.row .btn').click(); }
      else if (t.type === 'choice') { [...card.querySelectorAll('.choice')].find(b => b.textContent === t.options[t.correct]).click(); }
      else if (t.type === 'order') {
        for (const it of t.items) { const chip = [...card.querySelectorAll('.pool .chip')].find(c => c.textContent === it.t); if (!chip) { bad(key + ' chip missing ' + it.t); break; } chip.click(); }
        [...card.querySelectorAll('.btn')].find(b => b.textContent === 'ตรวจลำดับ').click();
      } else if (t.type === 'form') {
        const cs = card.querySelectorAll('.form input,.form select'); const ans = correct(t);
        cs.forEach((c, k) => { c.value = ans[k]; }); card.querySelector('.row .btn').click();
      }
      await sleep(3);
      const c2 = d.getElementById('task-' + key);
      if (!c2 || !c2.classList.contains('solved')) bad(`${key} (${t.type}) not solved in the page: ${c2 && c2.querySelector('.msg').textContent}`);
    }
  }
  console.log(`  18 week plans, ${cards} hands-on task cards solved`);
  host.remove(); w.eval('PR=null');

  console.log('== Terminal answers match command output');
  // the simulated PC is the same in every lab: slow commands (ping/tracert print line by line and block input while
  // running) are run once, one at a time, and their output is reused for every lab
  const FAST = ['ipconfig', 'ipconfig /all', 'hostname', 'net view', 'net config workstation', 'net share', 'net share homework', 'net use', 'whoami', 'net user', 'net user student', 'net user guest', 'net localgroup administrators', 'arp -a', 'netstat', 'nslookup www.netlab.test', 'getmac', 'route print', 'icacls C:\\Share\\Homework', 'netsh advfirewall show allprofiles state', 'netsh advfirewall set privateprofile state on'];
  const SLOW = ['ping 192.168.20.99', 'ping 192.168.20.88', 'ping 192.168.20.10', 'ping 8.8.8.8', 'ping www.netlab.test', 'tracert 8.8.8.8', 'tracert www.netlab.test'];
  let slowOut = null;
  for (const r of ALL.filter(x => x.terminal && !x.retired && x.tasks.some((t, i) => PRA.isPracticalTask(`${x.id}-${i}`)))) {
    const th = d.createElement('div'); th.append(w.eval(`terminal(${JSON.stringify(r.quick || [])})`)); d.body.replaceChildren(th); await sleep(2);
    const inp = d.querySelector('.term input');
    const send = c => { inp.value = c; inp.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Enter' })); };
    for (const c of FAST) send(c);
    await sleep(50);
    const norm = x => x.toLowerCase().replace(/\s+/g, '');
    if (slowOut === null) {
      const before = d.querySelector('.screen').textContent.length;
      for (const c of SLOW) { send(c); await sleep(c.startsWith('tracert') ? 4800 : 4200); }
      if (process.env.AUDIT_DUMP) fs.writeFileSync(process.env.AUDIT_DUMP, [...d.querySelectorAll('.screen .line')].map(x => x.textContent).join('\n'));
      slowOut = norm(d.querySelector('.screen').textContent.slice(before));
      for (const c of SLOW) if (!slowOut.includes(norm('>' + c))) bad('terminal command not run (still busy?): ' + c);
    }
    const out = norm(d.querySelector('.screen').textContent) + slowOut;
    r.tasks.forEach((t, i) => {
      if (!PRA.isPracticalTask(`${r.id}-${i}`)) return;   // only the hands-on tasks students still answer from the terminal
      if (t.type !== 'text' || t.know || /\\\\/.test(t.answers[0]) || /^\d{1,2}$/.test(t.answers[0])) return;
      if (!t.answers.some(a => out.includes(String(a).toLowerCase().replace(/\s/g, '')))) bad(`${r.id}#${i + 1} answer "${t.answers[0]}" not in terminal output`);
    });
  }

  console.log('JS errors:', errs.length ? errs : 'none');
  console.log(`\nISSUES (${issues.length})`); issues.forEach(i => console.log(' -', i));
  process.exit(issues.length ? 1 : 0);
})();

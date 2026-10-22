// 3.2 practical session: Guided + Independent + Troubleshooting under ONE server-side timer per week, one combined score,
// attempts (best counts), teacher weights and pass mark, lesson lock, legacy results, teacher views. Needs a real PostgreSQL:
//   TEST_DATABASE_URL=postgres://user@127.0.0.1:5432/netlab_test node tests/practical.test.js   (the database is wiped)
'use strict';
const assert = require('assert');
const url = process.env.TEST_DATABASE_URL;
if (!url) { console.log('SKIP practical tests: set TEST_DATABASE_URL'); process.exit(0); }
process.env.DATABASE_URL = url;
process.env.ADMIN_USERNAME = 'admin';
process.env.ADMIN_PASSWORD = 'admin-pass-123';
process.env.PORT = process.env.PORT || '3988';
const { Pool } = require('pg');
const BASE = `http://127.0.0.1:${process.env.PORT}`;
let passed = 0;
const it = async (name, fn) => { try { await fn(); passed++; console.log('  ✓', name); } catch (e) { console.log('  ✗', name, '\n    ', e.stack.split('\n').slice(0, 3).join('\n     ')); process.exitCode = 1; } };
function client() {
  let cookie = '';
  const call = async (method, path, body) => {
    const r = await fetch(BASE + path, { method, headers: { 'Content-Type': 'application/json', 'X-NetLab': '1', ...(cookie ? { Cookie: cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
    const j = await r.json().catch(() => ({}));
    if (method === 'POST' && path === '/api/auth/login' && r.ok) {
      const me = await (await fetch(BASE + '/api/me', { headers: { 'X-NetLab': '1', Cookie: cookie } })).json();
      if (me.user && me.user.mustChangePw) await fetch(BASE + '/api/auth/password', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-NetLab': '1', Cookie: cookie }, body: JSON.stringify({ current: body.password, next: body.password }) });
    }
    return { status: r.status, ...j };
  };
  return { get: p => call('GET', p), post: (p, b) => call('POST', p, b || {}), put: (p, b) => call('PUT', p, b || {}),
    raw: p => fetch(BASE + p, { headers: { 'X-NetLab': '1', ...(cookie ? { Cookie: cookie } : {}) } }) };
}

(async () => {
  const pool = new Pool({ connectionString: url });
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  const server = await require('../server').start();
  await new Promise(r => setTimeout(r, 300));
  const q = (s, p) => pool.query(s, p).then(r => r.rows);
  const P = require('../server/practical');
  const C = require('../server/content');
  const LABS = require('../content/labs');
  const { WEEKS } = require('../content/curriculum');
  const { LESSONS, formOf } = require('../server/lessons');
  const right = qq => qq.type === 'choice' ? qq.correct : qq.type === 'multi' ? qq.correct : qq.type === 'tf' ? qq.answer : qq.answers[0];
  const taskAnswer = key => { const t = C.TASKS.get(key).task; return t.type === 'text' ? t.answers[0] : t.type === 'choice' ? t.correct : null; };
  const x15Topo = () => { const m = require('../server/sims/troubleshoot').missions.find(x => x.id === 'x15'); const t = JSON.parse(JSON.stringify(m.start.topo)); t.links.find(l => l.id === 'l3').up = true; return t; };

  const admin = client(), kru = client();
  await admin.post('/api/auth/login', { username: 'admin', password: 'admin-pass-123' });
  const t1 = await admin.post('/api/admin/teachers', { username: 'kru.p', name: 'ครูพี' });
  await kru.post('/api/auth/login', { username: 'kru.p', password: t1.password });
  const cls = await kru.post('/api/teacher/classes', { name: 'ปวช.2/7' });
  const N = 8;
  const cr = await kru.post(`/api/teacher/classes/${cls.id}/students`, { rows: [...Array(N).keys()].map(i => ({ no: String(i + 1), name: 'นักเรียน ' + (i + 1) })) });
  const stu = []; for (const r of cr.created) { const c = client(); await c.post('/api/auth/login', { username: r.username, password: r.password }); c.id = (await c.get('/api/me')).user.id; stu.push(c); }
  const back = async (c, wid, min) => pool.query("UPDATE practical_sessions SET deadline = now() - interval '1 second' WHERE user_id=$1 AND lesson_id=$2 AND status='running'", [c.id, wid]);
  const coolOff = async c => pool.query("UPDATE practical_sessions SET ended_at = ended_at - interval '1 day' WHERE user_id=$1 AND ended_at IS NOT NULL", [c.id]);
  const week = async (c, wid) => (await c.get('/api/path')).weeks.find(w => w.id === wid);

  console.log('Structure: 5 steps, practical set per week');
  await it('every week has a practical set with one timer, the old step 4 and the old timed sets are gone', async () => {
    const A = stu[0]; const w1 = await week(A, 'w1');
    assert.deepEqual(Object.keys(w1.steps).sort(), ['learn', 'post', 'practice', 'pre', 'summary']);
    assert(!('solve' in w1), 'no separate step 4');
    for (const W of WEEKS) {
      const s = P.setOf(W.id); assert(s.minutes >= 30 && s.minutes <= 100, `${W.id}: ${s.minutes} min`);
      assert(s.parts.length >= 2 && s.parts.some(p => p.id === 'trouble'), W.id + ' has a troubleshooting/analysis part');
      assert(s.parts.every((p, i, a) => i === 0 || ['guided', 'independent', 'trouble'].indexOf(a[i - 1].id) < ['guided', 'independent', 'trouble'].indexOf(p.id)), 'parts in order');
    }
    const keys = WEEKS.flatMap(W => P.setOf(W.id).items.map(i => i.key));
    assert.equal(new Set(keys).size, keys.length, 'no task or mission is in two weeks\' sessions');
    const st = await A.get('/api/practical/w1');
    assert.equal(st.minutes, P.setOf('w1').minutes); assert.equal(st.parts.map(p => p.id).join(','), 'guided,independent,trouble');
    assert.equal(st.running, null); assert.equal(st.attempts.max, 3);
    const r1 = await A.post('/api/labs/r1/start'); assert.equal(r1.status, 410, 'old timed set retired');
    const wl = await A.post('/api/labs/w1/start'); assert.equal(wl.status, 410, 'the week lab has no timer of its own any more');
    const knowledge = LABS.WEEKS.find(w => w.id === 'w1').tasks.findIndex(t => t.toBank);
    const k = await A.post('/api/check', { key: 'w1-' + knowledge, answer: 0 }); assert.equal(k.status, 410, 'knowledge questions moved to the bank');
  });

  console.log('One timer for the whole session');
  await it('start sets the deadline on the server; a second start, a reload and another device see the same session', async () => {
    const A = stu[0];
    const before = await A.post('/api/check', { key: 'w1-8', answer: taskAnswer('w1-8') });
    assert.equal(before.status, 409); assert.equal(before.error, 'not_started');
    const s = await A.post('/api/practical/w1/start'); assert.equal(s.status, 200);
    assert(s.running && s.running.deadline - s.running.startedAt === P.setOf('w1').minutes * 60000, 'deadline = start + minutes');
    assert(Math.abs(s.now - Date.now()) < 5000);
    const again = await A.post('/api/practical/w1/start'); assert.equal(again.running.deadline, s.running.deadline, 'pressing start again never restarts the timer');
    const reload = await A.get('/api/practical/w1'); assert.equal(reload.running.deadline, s.running.deadline, 'reload keeps the deadline');
    const dev2 = client(); await dev2.post('/api/auth/login', { username: cr.created[0].username, password: cr.created[0].password });
    const other = await dev2.get('/api/practical/active'); assert.equal(other.session.deadline, s.running.deadline, 'another device reads the same deadline');
    assert.equal(other.session.week, 'w1');
    const w2 = await A.post('/api/practical/w2/start'); assert.equal(w2.status, 403, 'week 2 is still locked');
  });
  await it('tasks, Guided, Independent and Troubleshooting missions all go into the same session; a mission submitted twice counts once (best)', async () => {
    const A = stu[0];
    const g = await A.post('/api/check', { key: 'w1-8', answer: taskAnswer('w1-8') }); assert.equal(g.correct, true); assert.equal(g.points, 10);
    assert(g.practical && g.practical.week === 'w1');
    const wrong = await A.post('/api/check', { key: 'w1-9', answer: 'zz-wrong' }); assert.equal(wrong.correct, false);
    const h = await A.post('/api/hint', { key: 'w1-9' }); assert(typeof h.hint === 'string');
    const g2 = await A.post('/api/check', { key: 'w1-9', answer: taskAnswer('w1-9') }); assert.equal(g2.points, 3, '10 - 5 (hint) - 2 (one wrong)');
    const sub = await A.post('/api/sims/troubleshoot/submit', { mission: 'x15', payload: { cause: 'cable', topo: x15Topo() } });
    assert.equal(sub.score, 10); assert.equal(sub.practical.recorded, true); assert.equal(sub.practical.week, 'w1');
    const sub2 = await A.post('/api/sims/troubleshoot/submit', { mission: 'x15', payload: { cause: 'switch', topo: x15Topo() } });
    assert.equal(sub2.score, 6);
    const rows = await q("SELECT item, score FROM practical_items i JOIN practical_sessions s ON s.id=i.session_id WHERE s.user_id=$1 AND i.item='troubleshoot:x15'", [A.id]);
    assert.equal(rows.length, 1); assert.equal(Number(rows[0].score), 10, 'best kept, one row');
    const x2 = require('../server/sims/troubleshoot').missions.find(x => x.id === 'x2');
    const off = await A.post('/api/sims/troubleshoot/submit', { mission: 'x2', payload: { cause: 'ssid', topo: JSON.parse(JSON.stringify(x2.start.topo)) } });
    assert(!off.practical || off.practical.recorded === false, 'a mission of another week never enters this session');
    const st = await A.get('/api/practical/w1');
    assert(st.running, 'still running'); assert.equal(st.running.result.parts.find(p => p.id === 'trouble').pct, 100);
  });
  await it('the combined score follows the weights (a part a week lacks is left out) and the item reasons say what to fix', async () => {
    const A = stu[0];
    const s = await A.post('/api/practical/w1/submit'); assert.equal(s.submitted, true); assert.equal(s.running, null);
    const r = s.sessions[0].result; const pp = Object.fromEntries(r.parts.map(p => [p.id, p.pct]));
    // guided: 3 tasks (10/10, 3/10, 0) + 2 missions (0, 0) -> mean (1 + .3 + 0 + 0 + 0)/5 = 26%; independent 0; trouble 100
    assert.equal(pp.guided, 26); assert.equal(pp.independent, 0); assert.equal(pp.trouble, 100);
    assert.equal(r.total, Math.round((30 * 26 + 40 * 0 + 30 * 100) / 100), 'weighted 30/40/30');
    assert.equal(r.passed, false);
    const it = r.parts.find(p => p.id === 'guided').items.find(i => i.key === 'w1-10'); assert.equal(it.passed, false); assert(/ยังไม่ได้ตอบ/.test(it.reason));
    const m = r.parts.find(p => p.id === 'guided').items.find(i => i.kind === 'mission'); assert(/ยังไม่ได้ส่งงาน/.test(m.reason) && m.href.startsWith('#/sim/'));
    const w3 = P.setOf('w3'); assert(!w3.parts.some(p => p.id === 'independent'));
    const ev = P.evaluate(w3, new Map(w3.items.map(i => [i.key, { score: i.kind === 'task' ? 10 : i.max, max: i.max, solved: true }])), { passPct: 70, weights: { guided: 30, independent: 40, trouble: 30 } });
    assert.equal(ev.total, 100, 'week without Independent: the other two parts scale up');
    const half = P.evaluate(w3, new Map(w3.items.filter(i => i.part === 'guided').map(i => [i.key, { score: i.kind === 'task' ? 10 : i.max, max: i.max, solved: true }])), { passPct: 70, weights: { guided: 30, independent: 40, trouble: 30 } });
    assert.equal(half.total, 50, 'guided 100% and trouble 0% with 30:30 -> 50%');
  });
  await it('after the deadline nothing more is accepted for that session; it closes by itself and is scored from what was recorded', async () => {
    const A = stu[0]; await coolOff(A);
    const s = await A.post('/api/practical/w1/start'); assert.equal(s.running.attempt, 2);
    await A.post('/api/check', { key: 'w1-8', answer: taskAnswer('w1-8') });
    await back(A, 'w1');
    const late = await A.post('/api/check', { key: 'w1-10', answer: taskAnswer('w1-10') }); assert.equal(late.status, 409);
    const lateSim = await A.post('/api/sims/troubleshoot/submit', { mission: 'x15', payload: { cause: 'cable', topo: x15Topo() } });
    assert.equal(lateSim.practical.recorded, false, 'a simulator submit after the deadline is not counted');
    const st = await A.get('/api/practical/w1'); assert.equal(st.running, null);
    const last = st.sessions.find(x => x.attempt === 2); assert.equal(last.status, 'timeout');
    assert.equal(last.result.parts.find(p => p.id === 'trouble').pct, 0, 'the x15 submit came too late');
    assert.equal(st.best.total, st.sessions.find(x => x.attempt === 1).total, 'the best session counts');
  });

  console.log('Attempts and teacher policy');
  await it('three attempts, cooldown between them, best counts; the teacher can give one attempt back (kept as history)', async () => {
    const A = stu[1];
    for (let i = 0; i < 3; i++) { if (i) { const c = await A.post('/api/practical/w1/start'); assert.equal(c.status, 429, 'cooldown'); assert(c.nextAt > Date.now()); await coolOff(A); }
      const s = await A.post('/api/practical/w1/start'); assert.equal(s.running.attempt, i + 1); await A.post('/api/practical/w1/submit'); }
    await coolOff(A);
    const no = await A.post('/api/practical/w1/start'); assert.equal(no.status, 409); assert.equal(no.error, 'no_attempts');
    const sid = (await q("SELECT id FROM practical_sessions WHERE user_id=$1 AND attempt=3", [A.id]))[0].id;
    assert.equal((await kru.post(`/api/teacher/practical/sessions/${sid}/void`, {})).status, 400, 'a reason is required');
    assert.equal((await kru.post(`/api/teacher/practical/sessions/${sid}/void`, { reason: 'เครื่องค้าง' })).ok, true);
    const s4 = await A.post('/api/practical/w1/start'); assert.equal(s4.status, 200); assert.equal(s4.running.attempt, 4);
    const det = await kru.get(`/api/teacher/students/${A.id}/practical/w1`);
    assert(det.sessions.some(x => x.id === sid && x.voided && x.voidReason === 'เครื่องค้าง'), 'voided session kept with its reason');
    await A.post('/api/practical/w1/submit');
  });
  await it('only one practical session at a time per student; students only', async () => {
    const A = stu[2];
    await kru.post(`/api/teacher/students/${A.id}/unlock`, { lesson: 'w2', reason: 'ทดสอบ' });
    assert.equal((await A.post('/api/practical/w1/start')).status, 200);
    const o = await A.post('/api/practical/w2/start'); assert.equal(o.status, 409); assert.equal(o.error, 'running_other'); assert.equal(o.week, 'w1');
    assert.equal((await kru.post('/api/practical/w1/start')).status, 403, 'teachers browse without a timer');
    await A.post('/api/practical/w1/submit');
  });
  await it('teacher weights and pass mark: validated (sum 100), applied to existing sessions, recorded in history', async () => {
    const bad = await kru.put(`/api/teacher/classes/${cls.id}/path`, { settings: { practical: { weights: { guided: 50, independent: 40, trouble: 30 } } } });
    assert.equal(bad.status, 400); assert(/100/.test(bad.message));
    const A = stu[0]; const before = (await A.get('/api/practical/w1')).sessions.find(x => x.attempt === 1).total;
    const okp = await kru.put(`/api/teacher/classes/${cls.id}/path`, { settings: { practical: { weights: { guided: 50, independent: 0, trouble: 50 }, passPct: 60 } } });
    assert.equal(okp.ok, true);
    const after = (await A.get('/api/practical/w1')).sessions.find(x => x.attempt === 1);
    assert.equal(after.total, Math.round((50 * 26 + 50 * 100) / 100)); assert.notEqual(after.total, before);
    assert.equal(after.passed, true, '63% >= 60%');
    const h = await kru.get(`/api/teacher/classes/${cls.id}/path/history`); assert(h.history.some(x => x.kind === 'settings' && /สัดส่วนคะแนน/.test(x.reason)));
    await kru.put(`/api/teacher/classes/${cls.id}/path`, { settings: { practical: { weights: { guided: 30, independent: 40, trouble: 30 }, passPct: 70 } } });
  });

  console.log('Lesson lock');
  await it('a week completes only with the combined practical result passed (plus the other conditions); the next week opens', async () => {
    const A = stu[3], wid = 'w1', L = LESSONS.get(wid);
    await A.post(`/api/lessons/${wid}/quiz`, { kind: 'pre', answers: L.quiz.map(() => 0) });
    for (const s of L.sections.filter(s => !s.extra)) await A.post(`/api/lessons/${wid}/visit`, { section: s.id });
    let n = 0; for (const s of L.sections) for (const b of s.blocks) if (b.type === 'check') { if (!s.extra) await A.post(`/api/lessons/${wid}/check`, { key: `L:${wid}:c:${n}`, answer: right(b.q) }); n++; }
    await A.post(`/api/lessons/${wid}/quiz`, { kind: 'post', answers: formOf(L, 'post').map(right) });
    let w = await week(A, wid);
    assert.notEqual(w.status, 'completed'); assert.deepEqual(w.missing, ['practice']);
    assert.equal(w.criteria.find(c => c.key === 'practice').link, '#/lesson/w1/lab');
    assert.equal((await week(A, 'w2')).status, 'locked');
    await A.post('/api/practical/w1/start');
    assert.equal((await week(A, wid)).steps.practice, 'doing');
    for (const k of C.labKeys(C.LABS.get(wid))) await A.post('/api/check', { key: k, answer: taskAnswer(k) });
    for (const it of P.setOf(wid).items.filter(i => i.kind === 'mission'))
      await pool.query('SELECT 1');   // missions below go through the real simulator API where a payload is known
    await A.post('/api/sims/troubleshoot/submit', { mission: 'x15', payload: { cause: 'cable', topo: x15Topo() } });
    const sub = await A.post('/api/practical/w1/submit');
    // tasks 100% (3 of 5 guided items) + Guided missions not done -> guided 60%, independent 0, trouble 100 -> 0.3*60 + 0.3*100 = 48%
    assert.equal(sub.best.total, 48); assert.equal(sub.best.passed, false);
    w = await week(A, wid); assert.equal(w.steps.practice, 'review'); assert.notEqual(w.status, 'completed');
    // the missions done in the simulator during a new attempt complete it
    await coolOff(A); const s2 = await A.post('/api/practical/w1/start');
    for (const k of C.labKeys(C.LABS.get(wid))) await A.post('/api/check', { key: k, answer: taskAnswer(k) });
    const sid = s2.running.id;
    for (const it of P.setOf(wid).items.filter(i => i.kind === 'mission'))
      await pool.query('INSERT INTO practical_items(session_id,item,part,score,max,solved) VALUES($1,$2,$3,$4,$4,true) ON CONFLICT (session_id,item) DO UPDATE SET score=EXCLUDED.score', [sid, it.key, it.part, it.max]);
    const done = await A.post('/api/practical/w1/submit'); assert.equal(done.best.total, 100); assert.equal(done.best.passed, true);
    w = await week(A, wid); assert.equal(w.status, 'completed'); assert.equal(w.steps.practice, 'done');
    const st = await A.get('/api/path'); assert.equal(st.weeks.find(x => x.id === 'w2').status, 'available'); assert.equal(st.weeks.find(x => x.id === 'w3').status, 'locked');
  });
  await it('settings saved before 3.2 (guided/solve) are read as the practice condition; the old keys are still accepted on input', async () => {
    const pm = require('../server/path');
    assert.equal(pm.merge({ require: { guided: true, solve: false } }).require.practice, true);
    assert.equal(pm.merge({ require: { guided: false, solve: false } }).require.practice, false);
    assert.equal(pm.merge({ require: { guided: false, solve: true } }).require.practice, true);
    assert(!('guided' in pm.merge({ require: { guided: true } }).require));
    assert.equal((await kru.put(`/api/teacher/classes/${cls.id}/path`, { settings: { require: { foo: true } } })).status, 400);
  });

  console.log('Earlier data');
  await it('legacy: earlier task answers and simulator results become one legacy result per week (no attempt used); nothing deleted; once only', async () => {
    const L = stu[4];
    await q("INSERT INTO task_progress(user_id,task_key,lab_id,solved,points) VALUES($1,'w1-8','w1',true,10),($1,'w1-9','w1',true,8),($1,'w1-0','w1',true,10),($1,'r1-0','r1',true,10)", [L.id]);
    await q("INSERT INTO sim_results(user_id,sim,mission,best,max) VALUES($1,'troubleshoot','x15',10,10),($1,'topology','t1',5,10)", [L.id]);
    const counts = async () => Object.fromEntries(await Promise.all(['task_progress', 'sim_results', 'lab_runs', 'quiz_attempts'].map(async t => [t, (await q(`SELECT count(*)::int n FROM ${t} WHERE user_id=$1`, [L.id]))[0].n])));
    const c0 = await counts();
    await q("DELETE FROM app_migrations WHERE id='practical-1'"); await q("DELETE FROM practical_sessions WHERE status='legacy'");
    await P.migrate(); await P.migrate();
    const leg = await q("SELECT * FROM practical_sessions WHERE user_id=$1 AND status='legacy'", [L.id]);
    assert.equal(leg.length, 1, 'one legacy session (w1), created once'); assert.equal(leg[0].attempt, 0);
    const items = await q('SELECT item, score FROM practical_items WHERE session_id=$1 ORDER BY item', [leg[0].id]);
    assert.deepEqual(items.map(i => i.item), ['topology:t1', 'troubleshoot:x15', 'w1-8', 'w1-9'], 'knowledge question w1-0 and old set r1-0 are not part of the practical result');
    const st = await L.get('/api/practical/w1'); assert.equal(st.attempts.used, 0); assert.equal(st.best.legacy, true);
    // guided (10 + 8)/10 over 5 items = 36%; independent t1 50%; trouble 100% -> 0.3*36 + 0.4*50 + 0.3*100 = 61
    assert.equal(st.best.total, 61);
    assert.deepEqual(await counts(), c0, 'no earlier row removed or added');
    assert.equal((await week(L, 'w1')).criteria.find(c => c.key === 'practice').legacy, true);
  });

  console.log('Teacher');
  await it('class matrix and per-student detail show the best total and each part, so the teacher sees which skill is weak', async () => {
    const m = await kru.get(`/api/teacher/classes/${cls.id}/practical`);
    assert.equal(m.weeks.length, 18); assert.equal(m.policy.passPct, 70);
    const row = m.students.find(s => s.id === stu[3].id); assert.equal(row.weeks.w1.best, 100); assert.equal(row.weeks.w1.passed, true);
    assert.deepEqual(Object.keys(row.weeks.w1.parts).sort(), ['guided', 'independent', 'trouble']);
    const leg = m.students.find(s => s.id === stu[4].id); assert.equal(leg.weeks.w1.legacy, true);
    const d = await kru.get(`/api/teacher/students/${stu[0].id}/practical/w1`);
    assert(d.sessions.length >= 2 && d.sessions[0].result.parts.length === 3 && d.student.id === stu[0].id);
    const x = await kru.get(`/api/teacher/students/${stu[0].id}/practical/w1`.replace(/\d+\/practical/, '999999/practical')); assert.equal(x.status, 404);
    const other = client(); await other.post('/api/auth/login', { username: cr.created[5].username, password: cr.created[5].password });
    assert.equal((await other.get(`/api/teacher/classes/${cls.id}/practical`)).status, 403, 'students cannot read the matrix');
  });
  await it('Excel export: practical per week, parts per week, the old lab and set scores as history, and the step states', async () => {
    const res = await kru.raw(`/api/teacher/classes/${cls.id}/export.xlsx`); assert.equal(res.status, 200);
    const ExcelJS = require('exceljs'); const wb = new ExcelJS.Workbook(); await wb.xlsx.load(Buffer.from(await res.arrayBuffer()));
    for (const n of ['ฝึกปฏิบัติ', 'ฝึกปฏิบัติรายส่วน', 'ประวัติแล็บและชุดฝึกเดิม', 'สถานะขั้นตอน']) assert(wb.getWorksheet(n), 'sheet ' + n);
    const hp = wb.getWorksheet('ฝึกปฏิบัติ').getRow(2).values.filter(v => v != null).map(String);
    assert(hp.includes('ส.1 (%)') && hp.includes('ส.18 (%)'));
    const hs = wb.getWorksheet('สถานะขั้นตอน').getRow(2).values.filter(v => v != null).map(String);
    assert(!hs.includes('ฝึกแก้ปัญหา') && hs.includes('ฝึกปฏิบัติ'), 'four lesson steps + the week result (no separate step 4)');
  });

  console.log(`\n${passed} passed`);
  await pool.end(); server.close && server.close(); process.exit(process.exitCode || 0);
})().catch(e => { console.error(e); process.exit(1); });

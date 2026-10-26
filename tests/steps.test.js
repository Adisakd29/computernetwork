// NetLab 3.2 lesson steps (pre, learn, practice, post, summary: the former step 4 "ฝึกแก้ปัญหา" is now part 3 of the
// practical session), retired review rooms, missions used in several weeks, lab history totals and earlier data. Needs a real PostgreSQL (the database is wiped):
//   TEST_DATABASE_URL=postgres://user@127.0.0.1:5432/netlab_test node tests/steps.test.js
'use strict';
const assert = require('assert');
const url = process.env.TEST_DATABASE_URL;
process.env.TIMETABLE = process.env.TIMETABLE || 'off';   // 3.4: no class timetable in test databases (path.test turns it on for its own test)
process.env.STEP_ORDER = process.env.STEP_ORDER || 'off';   // 3.6: step order inside a week is tested on its own (practical.test)
if (!url) { console.log('SKIP steps tests: set TEST_DATABASE_URL'); process.exit(0); }
process.env.DATABASE_URL = url;
process.env.ADMIN_USERNAME = 'admin';
process.env.ADMIN_PASSWORD = 'admin-pass-123';
process.env.PORT = process.env.PORT || '3987';
const { Pool } = require('pg');
const BASE = `http://127.0.0.1:${process.env.PORT}`;
let passed = 0;
const it = async (name, fn) => { try { await fn(); passed++; console.log('  ✓', name); } catch (e) { console.log('  ✗', name, '\n    ', e.message); process.exitCode = 1; } };
function client() {
  let cookie = '';
  const call = async (method, path, body) => {
    const r = await fetch(BASE + path, { method, headers: { 'Content-Type': 'application/json', 'X-NetLab': '1', ...(cookie ? { Cookie: cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
    const j = await r.json().catch(() => ({}));
    if (method === 'POST' && path === '/api/auth/login' && r.ok) {   // temporary password: set the same one again
      const me = await (await fetch(BASE + '/api/me', { headers: { 'X-NetLab': '1', Cookie: cookie } })).json();
      if (me.user && me.user.mustChangePw) await fetch(BASE + '/api/auth/password', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-NetLab': '1', Cookie: cookie }, body: JSON.stringify({ current: body.password, next: body.password }) });
    }
    return { status: r.status, ...j };
  };
  return { get: p => call('GET', p), post: (p, b) => call('POST', p, b || {}), put: (p, b) => call('PUT', p, b || {}), patch: (p, b) => call('PATCH', p, b),
    raw: p => fetch(BASE + p, { headers: { 'X-NetLab': '1', ...(cookie ? { Cookie: cookie } : {}) } }) };   // binary downloads (export.xlsx)
}

(async () => {
  const pool = new Pool({ connectionString: url });
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  const server = await require('../server').start();
  await new Promise(r => setTimeout(r, 300));
  const { LESSONS, formOf } = require('../server/lessons');
  const { WEEKS } = require('../content/curriculum');
  const { ROOMS } = require('../content/labs');
  const { TASKS, LABS, labKeys } = require('../server/content');
  const { REQUIRE_LABEL } = require('../content/learning-path');
  const q = (s, p) => pool.query(s, p).then(r => r.rows);

  /* --- helpers that do the real work through the API (simulator results are written directly: their grading is tested elsewhere) --- */
  const right = qq => qq.type === 'choice' ? qq.correct : qq.type === 'multi' ? qq.correct : qq.type === 'tf' ? qq.answer : qq.answers[0];
  const wrongOf = qq => qq.type === 'choice' ? (qq.correct + 1) % qq.options.length : qq.type === 'tf' ? !qq.answer : qq.type === 'multi' ? [0, 1, 2].filter(i => !qq.correct.includes(i)).slice(0, 1).concat(qq.correct.length ? [] : [0]) : 'zz-wrong';
  async function readAll(c, wid) { for (const s of LESSONS.get(wid).sections.filter(s => !s.extra)) assert.equal((await c.post(`/api/lessons/${wid}/visit`, { section: s.id })).ok, true); }
  async function checksAll(c, wid) {
    let n = 0; for (const s of LESSONS.get(wid).sections) for (const b of s.blocks) if (b.type === 'check') { if (!s.extra) assert.equal((await c.post(`/api/lessons/${wid}/check`, { key: `L:${wid}:c:${n}`, answer: right(b.q) })).correct, true); n++; }
  }
  const pre = (c, wid) => c.post(`/api/lessons/${wid}/quiz`, { kind: 'pre', answers: LESSONS.get(wid).quiz.map(() => 0) });
  const post = (c, wid, nRight) => { const items = formOf(LESSONS.get(wid), 'post'); return c.post(`/api/lessons/${wid}/quiz`, { kind: 'post', answers: items.map((qq, i) => i < nRight ? right(qq) : wrongOf(qq)) }); };
  /* 3.2: step 3 is the week's practical session (one timer; Guided + Independent + Troubleshooting). One attempt through the
     API: start, answer the hands-on tasks right, record every mission of the set at frac*max (simulator grading is tested
     elsewhere and through the real API below), submit. Returns the total of this session. */
  const P = require('../server/practical');
  const taskAnswer = key => { const t = TASKS.get(key).task; return t.type === 'text' ? t.answers[0] : t.type === 'choice' ? t.correct : null; };
  const coolOff = uid => pool.query("UPDATE practical_sessions SET ended_at = ended_at - interval '1 day' WHERE user_id=$1 AND ended_at IS NOT NULL", [uid]);
  async function practical(c, wid, frac = 1) {
    await coolOff(c.id);
    const s = await c.post(`/api/practical/${wid}/start`); assert.equal(s.status, 200, `practical ${wid} start: ${s.error}`);
    for (const k of labKeys(LABS.get(wid))) assert.equal((await c.post('/api/check', { key: k, answer: taskAnswer(k) })).correct, true, k);
    for (const it of P.setOf(wid).items.filter(i => i.kind === 'mission'))
      await pool.query('INSERT INTO practical_items(session_id,item,part,score,max,solved) VALUES($1,$2,$3,$4,$5,$6)', [s.running.id, it.key, it.part, Math.round(it.max * frac), it.max, frac >= 1]);
    const r = await c.post(`/api/practical/${wid}/submit`); assert.equal(r.submitted, true);
    return r.sessions.find(x => x.id === s.running.id).total;
  }
  async function completeWeek(c, wid) { await pre(c, wid); await readAll(c, wid); await checksAll(c, wid); await practical(c, wid); return post(c, wid, 10); }
  const status = async c => Object.fromEntries((await c.get('/api/path')).weeks.map(w => [w.id, w.status]));
  const week = async (c, wid) => (await c.get('/api/path')).weeks.find(w => w.id === wid);
  const x15 = async c => (await c.get('/api/sims/troubleshoot')).missions.find(m => m.id === 'x15');
  const fixedTopo = m => { const t = JSON.parse(JSON.stringify(m.start.topo)); t.links.find(l => l.id === 'l3').up = true; return t; };
  const counts = async uid => Object.fromEntries(await Promise.all(['quiz_attempts', 'task_progress', 'sim_results', 'lesson_progress', 'lab_runs']
    .map(async t => [t, (await q(`SELECT count(*)::int n FROM ${t} WHERE user_id=$1`, [uid]))[0].n])));

  const admin = client(), kru = client();
  await admin.post('/api/auth/login', { username: 'admin', password: 'admin-pass-123' });
  const t1 = await admin.post('/api/admin/teachers', { username: 'kru.s', name: 'ครูเอส' });
  await kru.post('/api/auth/login', { username: 'kru.s', password: t1.password });
  const cls = await kru.post('/api/teacher/classes', { name: 'ปวช.2/6' });
  const N = 9;
  const cr = await kru.post(`/api/teacher/classes/${cls.id}/students`, { rows: [...Array(N).keys()].map(i => ({ no: String(i + 1), name: 'นักเรียน' + (i + 1) })) });
  const uid = async c => (await c.get('/api/me')).user.id;
  const login = async (row) => { const c = client(); await c.post('/api/auth/login', { username: row.username, password: row.password }); c.id = await uid(c); return c; };
  const S = []; for (const row of cr.created) S.push(await login(row));

  console.log('Lesson steps');
  await it('1. a new student: five steps of week 1, all todo; step 3 is the practical session, the former step-4 mission x15 is its Troubleshooting part', async () => {
    const w1 = await week(S[0], 'w1');
    assert.deepEqual(w1.steps, { pre: 'todo', learn: 'todo', practice: 'todo', post: 'todo', summary: 'todo' });
    assert.deepEqual(w1.required, ['pre', 'content', 'checks', 'practice', 'post']);
    assert(!('solve' in w1), 'no separate step 4');
    assert.deepEqual(w1.practice, { best: null, passed: false, legacy: false, passPct: 70, required: true });
    const pc = w1.criteria.find(x => x.key === 'practice');
    assert.equal(pc.label, REQUIRE_LABEL.practice); assert.equal(pc.done, false); assert.equal(pc.link, '#/lesson/w1/lab');
    assert(!w1.criteria.some(c => c.key === 'guided' || c.key === 'solve'));
    const st = await S[0].get('/api/practical/w1');
    assert.deepEqual(st.parts.map(p => [p.id, p.items.map(i => i.key)]),
      [['guided', ['w1-8', 'w1-9', 'w1-10', 'topology:t8', 'topology:t14']], ['independent', ['topology:t1']], ['trouble', ['troubleshoot:x15']]]);
    assert.equal(st.type, 'trouble'); assert.equal(st.running, null);
    assert.deepEqual((await S[0].get('/api/path')).rules.practical, { passPct: 70, weights: { guided: 30, independent: 40, trouble: 30 }, maxAttempts: 3, cooldownMin: 10 });
  });

  await it('2. the retired review room (r1) can no longer be started or answered; earlier room answers stay but do not count; the week completes without them', async () => {
    const c = S[1];
    assert.equal(ROOMS.find(r => r.id === 'r1').host, 'w1');
    const s = await c.post('/api/labs/r1/start'); assert.equal(s.status, 410); assert.equal(s.error, 'retired');
    const k = await c.post('/api/check', { key: 'r1-0', answer: 0 }); assert.equal(k.status, 410); assert.equal(k.error, 'moved');
    assert.equal((await c.post('/api/hint', { key: 'r1-0' })).status, 410);
    assert.deepEqual(labKeys(LABS.get('r1')), [], 'a retired room has no active task');
    await q("INSERT INTO task_progress(user_id,task_key,lab_id,solved,points,solved_at) VALUES($1,'r1-0','r1',true,10,now()),($1,'r1-1','r1',true,8,now())", [c.id]);   // done before 3.2
    let w1 = await week(c, 'w1');
    assert.equal(w1.steps.practice, 'todo', 'a room is not the practical session'); assert.equal((await c.get('/api/practical/w1')).best, null);
    assert.equal(w1.status, 'available', 'QA E2: old review work alone keeps the week neutral (not "กำลังเรียน")');
    assert.equal((await status(c)).w2, 'locked');
    await completeWeek(c, 'w1');
    w1 = await week(c, 'w1');
    assert.equal(w1.status, 'completed'); assert.equal(w1.steps.summary, 'done'); assert.equal(w1.steps.practice, 'done');
    const st = await status(c); assert.equal(st.w2, 'available'); assert.equal(st.w3, 'locked');
    assert.equal((await q("SELECT count(*)::int n FROM task_progress WHERE user_id=$1 AND lab_id='r1' AND solved", [c.id]))[0].n, 2, 'room history kept');
  });

  await it('3. real pass conditions: pre, learn (read AND checks), practice (session running = doing, submitted below the mark = review, passed = done), post (review/done)', async () => {
    const c = S[2];
    assert.equal((await pre(c, 'w1')).status, 200); assert.equal((await week(c, 'w1')).steps.pre, 'done');
    await checksAll(c, 'w1');
    assert.equal((await week(c, 'w1')).steps.learn, 'doing', 'checks correct but sections not read');
    const L = LESSONS.get('w1'), core = L.sections.filter(s => !s.extra);
    for (const s of core.slice(0, -1)) await c.post('/api/lessons/w1/visit', { section: s.id });
    assert.equal((await week(c, 'w1')).steps.learn, 'doing', 'one core section still unread');
    await c.post('/api/lessons/w1/visit', { section: core[core.length - 1].id });
    assert.equal((await week(c, 'w1')).steps.learn, 'done');
    // practical session: a task cannot be answered before start; started = doing; every hands-on task right but missions missing -> doing until submitted
    const keys = labKeys(LABS.get('w1'));
    const early = await c.post('/api/check', { key: keys[0], answer: taskAnswer(keys[0]) }); assert.equal(early.status, 409); assert.equal(early.error, 'not_started');
    assert.equal((await week(c, 'w1')).steps.practice, 'todo');
    assert.equal((await c.post('/api/practical/w1/start')).status, 200);
    let w1 = await week(c, 'w1'); assert.equal(w1.steps.practice, 'doing'); assert(/กำลังฝึกปฏิบัติ/.test(w1.criteria.find(x => x.key === 'practice').detail));
    for (const k of keys) assert.equal((await c.post('/api/check', { key: k, answer: taskAnswer(k) })).correct, true);
    assert.equal((await week(c, 'w1')).steps.practice, 'doing', 'all hands-on tasks answered, session still running');
    // submitted with the missions missing: guided 3/5 = 60 %, independent 0, trouble 0 -> 18 %
    const sub = await c.post('/api/practical/w1/submit'); assert.equal(sub.best.total, 18);
    w1 = await week(c, 'w1'); assert.equal(w1.steps.practice, 'review'); assert.deepEqual([w1.practice.best, w1.practice.passed], [18, false]);
    assert.equal(await practical(c, 'w1'), 100, 'second attempt with every item');
    w1 = await week(c, 'w1'); assert.equal(w1.steps.practice, 'done'); assert.deepEqual([w1.practice.best, w1.practice.passed], [100, true]);
    // post-test
    const r = await post(c, 'w1', 6); assert.equal(r.passed, false);
    w1 = await week(c, 'w1'); assert.equal(w1.steps.post, 'review'); assert.equal(w1.status, 'in_progress');
    await pool.query("UPDATE quiz_attempt_log SET created_at = now() - interval '11 minutes' WHERE user_id=$1", [c.id]);
    assert.equal((await post(c, 'w1', 8)).passed, true);
    w1 = await week(c, 'w1'); assert.equal(w1.steps.post, 'done'); assert.equal(w1.status, 'completed'); assert.equal(w1.steps.summary, 'done');
  });

  await it('4. post passed but the practical not passed: not completed, practice listed done:false with a link to the practical page; a session that runs out empty is review', async () => {
    const c = S[3];
    await pre(c, 'w1'); await readAll(c, 'w1'); await checksAll(c, 'w1');
    assert.equal((await post(c, 'w1', 10)).passed, true);
    let w1 = await week(c, 'w1');
    assert.notEqual(w1.status, 'completed'); assert.deepEqual(w1.missing, ['practice']); assert.equal(w1.steps.post, 'done'); assert.equal(w1.steps.practice, 'todo');
    let g = w1.criteria.find(x => x.key === 'practice'); assert.equal(g.done, false); assert.equal(g.link, '#/lesson/w1/lab'); assert(/ยังไม่ได้ฝึกปฏิบัติ/.test(g.detail));
    // simulator results outside a session do not pass step 3
    await pool.query(`INSERT INTO sim_results(user_id,sim,mission,best,max) VALUES($1,'topology','t8',10,10),($1,'topology','t14',10,10)`, [c.id]);
    assert.equal((await week(c, 'w1')).steps.practice, 'todo');
    await c.post('/api/practical/w1/start');
    w1 = await week(c, 'w1'); assert.equal(w1.steps.practice, 'doing');
    await pool.query("UPDATE practical_sessions SET deadline = now() - interval '1 second' WHERE user_id=$1 AND status='running'", [c.id]);   // time is up, nothing done
    w1 = await week(c, 'w1'); assert.equal(w1.steps.practice, 'review'); assert.equal(w1.practice.best, 0);
    const st = await c.get('/api/practical/w1'); assert.equal(st.running, null); assert.equal(st.sessions[0].status, 'timeout'); assert.equal(st.attempts.used, 1);
    const s = await status(c); assert.equal(s.w1, 'in_progress'); assert.equal(s.w2, 'locked');
    assert.equal((await c.get('/api/lessons/w2')).status, 403);
  });

  console.log('Teacher sets the practice condition');
  await it('5. require.practice off: the week completes without the practical (only the next week opens); old keys accepted, not stored; on again keeps earlier completions; bad key 400', async () => {
    const cls2 = await kru.post('/api/teacher/classes', { name: 'ปวช.2/7' });
    const st = await kru.post(`/api/teacher/classes/${cls2.id}/students`, { rows: [{ no: '1', name: 'พี' }, { no: '2', name: 'คิว' }, { no: '3', name: 'อาร์' }] });
    const [Pp, Q, R] = [await login(st.created[0]), await login(st.created[1]), await login(st.created[2])];
    await completeWeek(Q, 'w1'); assert.equal((await status(Q)).w1, 'completed', 'completed with the practical');
    const off = await kru.put(`/api/teacher/classes/${cls2.id}/path`, { settings: { require: { practice: false } } });
    assert.equal(off.status, 200); assert.equal(off.settings.require.practice, false);
    let w1 = await week(Pp, 'w1');
    assert(!w1.required.includes('practice')); assert(!w1.criteria.some(x => x.key === 'practice')); assert.equal(w1.practice.required, false);
    await pre(Pp, 'w1'); await readAll(Pp, 'w1'); await checksAll(Pp, 'w1'); await post(Pp, 'w1', 10);
    w1 = await week(Pp, 'w1'); assert.equal(w1.status, 'completed'); assert.equal(w1.steps.practice, 'todo', 'the real state is still shown');
    let s = await status(Pp); assert.equal(s.w2, 'available'); assert.equal(s.w3, 'locked');
    // a client from before 3.2 may still send the old keys: accepted, never stored (saved settings with them are read as practice: tests/practical.test.js)
    const old = await kru.put(`/api/teacher/classes/${cls2.id}/path`, { settings: { require: { solve: true, guided: true } } });
    assert.equal(old.status, 200); assert(!('solve' in old.settings.require) && !('guided' in old.settings.require));
    const on = await kru.put(`/api/teacher/classes/${cls2.id}/path`, { settings: { require: { practice: true } } });
    assert.equal(on.status, 200); assert.equal(on.settings.require.practice, true);
    await pre(R, 'w1'); await readAll(R, 'w1'); await checksAll(R, 'w1'); await post(R, 'w1', 10);
    w1 = await week(R, 'w1'); assert.equal(w1.status, 'in_progress'); assert.deepEqual(w1.missing, ['practice']); assert.equal((await status(R)).w2, 'locked');
    assert.equal((await status(Pp)).w1, 'completed', 'sticky'); assert.equal((await status(Q)).w1, 'completed');
    await practical(R, 'w1'); s = await status(R); assert.equal(s.w1, 'completed'); assert.equal(s.w2, 'available'); assert.equal(s.w3, 'locked');
    assert.equal((await kru.put(`/api/teacher/classes/${cls2.id}/path`, { settings: { require: { foo: true } } })).status, 400);
    assert.equal((await kru.put(`/api/teacher/classes/${cls2.id}/path`, { settings: { require: { practice: 'yes' } } })).status, 400);
  });

  console.log('Missions used in several weeks');
  await it('6. one result per mission: no mission is in two weeks\' sessions (wf5: w6 Troubleshooting, w7 extra only); x15 three times keeps one row, best, XP once, in and out of a session', async () => {
    const keys = WEEKS.flatMap(W => P.setOf(W.id).items.map(i => i.key));
    assert.equal(new Set(keys).size, keys.length, 'each task / mission is scored in one week only');
    assert.equal(P.weekOfItem('wifi:wf5'), 'w6'); assert(!P.setOf('w7').items.some(i => i.key === 'wifi:wf5'));
    assert.equal(P.setOf('w6').items.find(i => i.key === 'wifi:wf5').part, 'trouble');
    const c = S[4];
    await pool.query(`INSERT INTO sim_results(user_id,sim,mission,best,max) VALUES($1,'wifi','wf5',8,10)`, [c.id]);
    const done = (await c.get('/api/sims/done')).done;   // one row per sim and mission, whatever page reads it
    assert.equal(done.wifi.wf5.best, 8);
    assert.equal((await q("SELECT count(*)::int n FROM sim_results WHERE user_id=$1 AND sim='wifi' AND mission='wf5'", [c.id]))[0].n, 1);
    // the same mission three times through the real simulator API, outside a session: kept as practice, not in a practical result
    const m = await x15(c);
    const a = await c.post('/api/sims/troubleshoot/submit', { mission: 'x15', payload: { cause: 'cable', topo: fixedTopo(m) } }); assert.equal(a.score, 10); assert.equal(a.saved, true);
    assert.deepEqual(a.practical, { recorded: false, week: 'w1' });
    const xp1 = (await c.get('/api/game/me')).xp;
    const b = await c.post('/api/sims/troubleshoot/submit', { mission: 'x15', payload: { cause: 'switch', topo: fixedTopo(m) } }); assert.equal(b.score, 6);
    const d = await c.post('/api/sims/troubleshoot/submit', { mission: 'x15', payload: { cause: 'cable', topo: fixedTopo(m) } }); assert.equal(d.score, 10);
    const rows = await q("SELECT best,last,attempts FROM sim_results WHERE user_id=$1 AND sim='troubleshoot' AND mission='x15'", [c.id]);
    assert.equal(rows.length, 1); assert.equal(rows[0].best, 10); assert.equal(rows[0].attempts, 3);
    const xp2 = (await c.get('/api/game/me')).xp;
    assert.equal(xp2.sims, xp1.sims, 'sim XP does not grow for the same mission'); assert.equal(xp2.sims, 8 + 10);
    assert.equal((await week(c, 'w1')).steps.practice, 'todo');
    // inside a session: 10, 6, 10 -> one item, best 10
    const s = await c.post('/api/practical/w1/start');
    for (const cause of ['cable', 'switch', 'cable']) assert.equal((await c.post('/api/sims/troubleshoot/submit', { mission: 'x15', payload: { cause, topo: fixedTopo(m) } })).practical.recorded, true);
    const it = await q("SELECT score FROM practical_items WHERE session_id=$1 AND item='troubleshoot:x15'", [s.running.id]);
    assert.equal(it.length, 1); assert.equal(Number(it[0].score), 10);
    const sub = await c.post('/api/practical/w1/submit'); assert.equal(sub.best.result.parts.find(p => p.id === 'trouble').pct, 100);
  });

  await it('7. x15 through the real API: public mission has no secret fields, start.basic, fixed topology + cable = 10; outside a session it is not recorded', async () => {
    const c = S[5];
    const m = await x15(c);
    assert(m); assert.equal(m.start.basic, true); assert.equal(m.level, 'easy'); assert.equal(m.max, 10);
    for (const k of ['cause', 'allowed', 'faults', 'explain', 'build', 'topo', 'causes', 'successPings']) assert(!(k in m), `top-level ${k} must not be public`);
    assert(!('cause' in m.start) && !('allowed' in m.start) && !('faults' in m.start) && !('explain' in m.start));
    assert.deepEqual(m.start.causes.map(x => x.id).sort(), ['bus', 'cable', 'pc4', 'protocol', 'server', 'switch']);
    const secret = require('../server/sims/troubleshoot')._scenarios.x15;
    assert(!JSON.stringify(m).includes(secret.explain), 'explanation is not sent before grading');
    assert.equal(m.start.topo.links.find(l => l.id === 'l3').up, false, 'the fault is in the starting topology');
    const one = (await c.get('/api/sims/troubleshoot')).missions.filter(x => x.id === 'x15'); assert.equal(one.length, 1);
    const unfixed = await c.post('/api/sims/troubleshoot/submit', { mission: 'x15', payload: { cause: 'cable', topo: m.start.topo } }); assert.equal(unfixed.score, 4);
    const r = await c.post('/api/sims/troubleshoot/submit', { mission: 'x15', payload: { cause: 'cable', topo: fixedTopo(m) } });
    assert.equal(r.status, 200); assert.equal(r.score, 10); assert.equal(r.max, 10); assert.equal(r.ok, true);
    assert.equal(r.practical.recorded, false); assert.equal(r.practical.week, 'w1');
    assert.equal((await week(c, 'w1')).steps.practice, 'todo', 'only work inside the practical session counts for step 3');
  });

  console.log('Teacher report');
  await it('8. lab history report: mainTotal = former end-of-class labs, extraTotal = former rooms, total = mainTotal; export keeps both; step sheet has the 4 lesson steps', async () => {
    const c = S[6];
    // before 3.2: a knowledge question of the week lab (now in the bank), a hands-on task, and a room answer
    await q("INSERT INTO task_progress(user_id,task_key,lab_id,solved,points,solved_at) VALUES($1,'w1-0','w1',true,8,now()),($1,'w1-8','w1',true,10,now()),($1,'r1-0','r1',true,10,now()),($1,'r1-1','r1',true,6,now())", [c.id]);
    // 3.2: a hands-on task answered inside the practical session is kept in the history too
    await c.post('/api/practical/w1/start');
    assert.equal((await c.post('/api/check', { key: 'w1-9', answer: taskAnswer('w1-9') })).points, 10);
    await c.post('/api/practical/w1/submit');
    const rep = await kru.get(`/api/teacher/classes/${cls.id}/report`);
    assert.equal(rep.status, 200);
    assert.deepEqual(rep.labs.filter(l => l.optional).map(l => l.id).sort(), ROOMS.map(r => r.id).sort(), 'optional labs are exactly the former rooms');
    assert(rep.labs.filter(l => l.optional).every(l => l.retired));
    assert(rep.labs.filter(l => !l.optional).every(l => l.exit));
    const row = rep.rows.find(r => r.id === c.id);
    const opt = new Set(rep.labs.filter(l => l.optional).map(l => l.id));
    const sum = f => Object.entries(row.labs).filter(([id]) => f(id)).reduce((a, [, x]) => a + x.points, 0);
    assert.equal(row.mainTotal, sum(id => !opt.has(id))); assert.equal(row.extraTotal, sum(id => opt.has(id)));
    assert.equal(row.mainTotal, 28); assert.equal(row.extraTotal, 16);
    assert.equal(row.total, row.mainTotal);
    const dbMain = (await q("SELECT sum(points)::int s FROM task_progress WHERE user_id=$1 AND lab_id='w1'", [c.id]))[0].s; assert.equal(row.mainTotal, dbMain);
    // export
    const res = await kru.raw(`/api/teacher/classes/${cls.id}/export.xlsx`);
    assert.equal(res.status, 200);
    const ExcelJS = require('exceljs'); const wb = new ExcelJS.Workbook(); await wb.xlsx.load(Buffer.from(await res.arrayBuffer()));
    const MAIN = 'รวมแล็บท้ายคาบเดิม', EXTRA = 'รวมชุดฝึกจับเวลาเดิม (แยกจากคะแนนหลัก)';
    const ws = wb.getWorksheet('ประวัติแล็บและชุดฝึกเดิม'); assert(ws, 'history sheet'); const head = ws.getRow(4).values.filter(v => v != null).map(String);
    assert(head.includes(MAIN), 'main total column'); assert(head.includes(EXTRA), 'extra total column');
    assert(head.indexOf(MAIN) < head.indexOf(EXTRA));
    let found = null; ws.eachRow(r => { if (r.getCell(3).value === cr.created[6].username) found = r; });
    assert(found, 'student row in the export');
    assert.equal(found.getCell(head.indexOf(MAIN) + 1).value, row.mainTotal);
    assert.equal(found.getCell(head.indexOf(EXTRA) + 1).value, row.extraTotal);
    /* QA #6: a sheet with the real state of every step per student and week (summary = the "ผ่านสัปดาห์" column) */
    const st = wb.getWorksheet('สถานะขั้นตอน'); assert(st, 'step-state sheet');
    const h = st.getRow(2).values.filter(v => v != null).map(String);
    for (const k of ['ก่อนเรียน', 'เนื้อหา', 'ฝึกปฏิบัติ', 'หลังเรียน', 'ผ่านสัปดาห์', 'เงื่อนไขที่ยังขาด']) assert(h.includes(k), 'step sheet column ' + k);
    assert(!h.includes('ฝึกแก้ปัญหา'), 'no step-4 column');
    let rows = 0, mine = null; st.eachRow((r, n) => { if (n > 2) { rows++; assert(['ผ่าน', 'ยังไม่ผ่าน'].includes(r.getCell(h.indexOf('ผ่านสัปดาห์') + 1).value));
      if (r.getCell(2).value === 'นักเรียน7' && r.getCell(3).value === 1) mine = r; } });
    assert(rows > 0, 'step sheet has rows');
    assert(mine, 'row of this student, week 1'); assert.equal(mine.getCell(h.indexOf('ฝึกปฏิบัติ') + 1).value, 'ต้องทบทวน', 'submitted below the mark');
  });
  await it('11. QA E1: every week has a Guided mission of its own, and simulator results outside a session never pass step 3 (w7)', async () => {
    const { firstWeekOf } = require('../content/curriculum');
    for (const W of WEEKS) assert(W.guided.some(r => firstWeekOf(r) === W.id), W.id + ' has no own Guided mission');
    const s = client();
    const n = await kru.post(`/api/teacher/classes/${cls.id}/students`, { rows: [{ no: '91', name: 'ทดสอบสัปดาห์ 7' }] });
    await s.post('/api/auth/login', { username: n.created[0].username, password: n.created[0].password }); const sid = (await s.get('/api/me')).user.id;
    for (const ref of WEEKS.find(w => w.id === 'w7').guided.concat('topology:t6')) { const [sim, m] = ref.split(':');
      await pool.query(`INSERT INTO sim_results(user_id,sim,mission,best,max) VALUES($1,$2,$3,10,10)`, [sid, sim, m]); }
    await kru.post(`/api/teacher/students/${sid}/unlock`, { lesson: 'w7', reason: 'test' });
    const w7 = (await s.get('/api/path')).weeks.find(w => w.id === 'w7');
    assert.equal(w7.steps.practice, 'todo', 'step 3 is the practical session of the week, not loose simulator results');
  });

  console.log('Earlier data');
  let legacyCls, legacyStu;
  await it('9. legacy rules and pre-3.2 scores: /api/me unchanged, the step shows the legacy practical result, nothing deleted by GET /api/path', async () => {
    legacyCls = await kru.post('/api/teacher/classes', { name: 'ห้องเดิม 3.0' });
    const r = await kru.put(`/api/teacher/classes/${legacyCls.id}/path`, { settings: { sequential: false, post: { maxAttempts: 1, cooldownMin: 0, review: 'always' } } }); assert.equal(r.status, 200);
    const st = await kru.post(`/api/teacher/classes/${legacyCls.id}/students`, { rows: [{ no: '1', name: 'เดิมหนึ่ง' }, { no: '2', name: 'เดิมสอง' }] });
    const c = legacyStu = await login(st.created[0]); c.row = st.created[0]; legacyStu.other = await login(st.created[1]);
    // rows as written before 3.2
    await pool.query(`INSERT INTO quiz_attempts(user_id,lesson_id,kind,answers,results,score,max) VALUES($1,'w1','pre','[]','[]',4,10),($1,'w1','post','[]','[]',8,10),($1,'w2','post','[]','[]',5,10)`, [c.id]);
    await pool.query(`INSERT INTO task_progress(user_id,task_key,lab_id,attempts,solved,points,solved_at) VALUES($1,'w1-0','w1',1,true,8,now()),($1,'r1-0','r1',0,true,10,now())`, [c.id]);
    await pool.query(`INSERT INTO sim_results(user_id,sim,mission,best,max,last,attempts) VALUES($1,'topology','t8',9,10,9,2),($1,'troubleshoot','x15',3,10,3,1)`, [c.id]);
    // the deploy of 3.2 turns earlier results into one legacy practical result per week (server/practical.js migrate)
    await q("DELETE FROM app_migrations WHERE id='practical-1'"); await q("DELETE FROM practical_sessions WHERE status='legacy'");
    await P.migrate();
    const before = await counts(c.id);
    const me1 = await c.get('/api/me');
    assert.equal(me1.lessons.w1.post.score, 8); assert.equal(me1.lessons.w1.post.max, 10); assert.equal(me1.lessons.w1.pre.score, 4); assert.equal(me1.lessons.w2.post.score, 5);
    assert(Array.isArray(me1.lessons.w1.post.review), "legacy review policy 'always'");
    assert.equal(me1.progress.done['w1-0'], true); assert.equal(me1.progress.done['r1-0'], true);
    const p = await c.get('/api/path'); assert.equal(p.sequential, false); assert(p.weeks.every(w => w.status !== 'locked'));
    const w1 = p.weeks.find(w => w.id === 'w1'), w2 = p.weeks.find(w => w.id === 'w2');
    assert.equal(w1.steps.pre, 'done'); assert.equal(w1.steps.post, 'done', 'old post 8/10'); assert.equal(w2.steps.post, 'review', 'old post 5/10');
    // legacy: t8 9/10 (guided 90/5 = 18 %), x15 3/10 (trouble 30 %), w1-0 is a knowledge question (not part of it) -> 0.3*18 + 0.3*30 = 14 %
    assert.equal(w1.steps.practice, 'review'); assert.deepEqual([w1.practice.best, w1.practice.passed, w1.practice.legacy], [14, false, true]);
    assert.equal(w1.criteria.find(x => x.key === 'practice').legacy, true);
    assert.equal((await c.get('/api/practical/w1')).attempts.used, 0, 'the legacy result uses no attempt');
    assert.equal(w1.post.bestPct, 80); assert.equal(w1.post.attempts, 1, 'a post-test taken before attempts were logged');
    const after = await counts(c.id); assert.deepEqual(after, before);
    const me2 = await c.get('/api/me');
    assert.deepEqual(me2.lessons, me1.lessons); assert.deepEqual(me2.progress, me1.progress);
    const sims = await q('SELECT sim,mission,best,max,attempts FROM sim_results WHERE user_id=$1 ORDER BY sim,mission', [c.id]);
    assert.deepEqual(sims.map(s => [s.sim, s.mission, s.best, s.max, s.attempts]), [['topology', 't8', 9, 10, 2], ['troubleshoot', 'x15', 3, 10, 1]]);
    // the old passing score is not reopened: no further attempt, nothing overwritten
    assert.equal((await post(c, 'w1', 10)).error, 'passed');
    assert.equal((await q("SELECT score FROM quiz_attempts WHERE user_id=$1 AND lesson_id='w1' AND kind='post'", [c.id]))[0].score, 8);
  });

  await it('10. rewritten duplicate questions (now in the question bank) keep their correct option; /api/check says where they went; earlier solves stay solved and in the history', async () => {
    const { isActive } = require('../server/content');
    const KEYS = ['w3-2', 'w3-8', 'w9-4', 'w10-5', 'w14-3', 'w6-0'];
    const c = legacyStu.other;   // legacy class: every week is open
    for (const k of KEYS) { const t = TASKS.get(k); assert(t, k); assert.equal(t.task.type, 'choice'); assert.equal(t.task.correct, 0, `${k}: the correct option stays the first one`);
      assert(t.lab.exit, `${k} was an end-of-class lab task`); assert.equal(t.task.toBank, true, `${k} is a knowledge question`); assert.equal(isActive(k), false); }
    for (const k of KEYS) {
      const r = await c.post('/api/check', { key: k, answer: 0 });
      assert.equal(r.status, 410, k); assert.equal(r.error, 'moved'); assert(/คลังข้อสอบ/.test(r.message), 'tells the student where the question went');
    }
    // a student who solved them before 3.2
    const old = legacyStu;
    for (const k of KEYS) await pool.query(`INSERT INTO task_progress(user_id,task_key,lab_id,attempts,solved,points,solved_at) VALUES($1,$2,$3,0,true,10,now())`, [old.id, k, k.split('-')[0]]);
    const me = await old.get('/api/me');
    for (const k of KEYS) assert.equal(me.progress.done[k], true, `${k} still solved`);
    const again = await old.post('/api/check', { key: 'w3-2', answer: 1 }); assert.equal(again.status, 410, 'nothing is re-scored');
    assert.equal((await q("SELECT points FROM task_progress WHERE user_id=$1 AND task_key='w3-2'", [old.id]))[0].points, 10);
    const rep = await kru.get(`/api/teacher/classes/${legacyCls.id}/report`);
    const row = rep.rows.find(r => r.id === old.id); assert.equal(row.labs.w3.points, 20); assert.equal(row.labs.w3.solved, 2);
  });

  console.log(`\n${passed} passed`);
  await pool.end(); server.close(); await require('../server/db').close();
  process.exit(process.exitCode || 0);
})().catch(e => { console.error(e); process.exit(1); });

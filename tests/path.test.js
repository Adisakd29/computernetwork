// Progressive Unlock (sequential learning path). Needs a real PostgreSQL (the database is wiped):
//   TEST_DATABASE_URL=postgres://user@127.0.0.1:5432/netlab_test node tests/path.test.js
'use strict';
const assert = require('assert');
const url = process.env.TEST_DATABASE_URL;
if (!url) { console.log('SKIP path tests: set TEST_DATABASE_URL'); process.exit(0); }
process.env.DATABASE_URL = url;
process.env.ADMIN_USERNAME = 'admin';
process.env.ADMIN_PASSWORD = 'admin-pass-123';
process.env.PORT = process.env.PORT || '3985';
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
  return { get: p => call('GET', p), post: (p, b) => call('POST', p, b || {}), put: (p, b) => call('PUT', p, b || {}), patch: (p, b) => call('PATCH', p, b) };
}

(async () => {
  const pool = new Pool({ connectionString: url });
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  const server = await require('../server').start();
  await new Promise(r => setTimeout(r, 300));
  const { LESSONS, formOf } = require('../server/lessons');
  const { WEEKS } = require('../content/curriculum');
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
  const guided = async (uid, wid, best = 10) => { for (const ref of WEEKS.find(w => w.id === wid).guided) { const [sim, m] = ref.split(':');
    await pool.query(`INSERT INTO sim_results(user_id,sim,mission,best,max) VALUES($1,$2,$3,$4,10) ON CONFLICT (user_id,sim,mission) DO UPDATE SET best=EXCLUDED.best`, [uid, sim, m, best]); } };
  async function completeWeek(c, uid, wid) { await pre(c, wid); await readAll(c, wid); await checksAll(c, wid); await guided(uid, wid); return post(c, wid, 10); }
  const status = async c => Object.fromEntries((await c.get('/api/path')).weeks.map(w => [w.id, w.status]));

  const admin = client(), kru = client(), kru2 = client(), guest = client();
  await admin.post('/api/auth/login', { username: 'admin', password: 'admin-pass-123' });
  const t1 = await admin.post('/api/admin/teachers', { username: 'kru.u', name: 'ครูยู' }), t2 = await admin.post('/api/admin/teachers', { username: 'kru.v', name: 'ครูวี' });
  await kru.post('/api/auth/login', { username: 'kru.u', password: t1.password }); await kru2.post('/api/auth/login', { username: 'kru.v', password: t2.password });
  const cls = await kru.post('/api/teacher/classes', { name: 'ปวช.2/5' });
  const cr = await kru.post(`/api/teacher/classes/${cls.id}/students`, { rows: [{ no: '1', name: 'นักเรียนเอ' }, { no: '2', name: 'นักเรียนบี' }, { no: '3', name: 'นักเรียนซี' }] });
  const A = client(), B = client(), C = client(), A2 = client();
  await A.post('/api/auth/login', { username: cr.created[0].username, password: cr.created[0].password });
  await B.post('/api/auth/login', { username: cr.created[1].username, password: cr.created[1].password });
  await C.post('/api/auth/login', { username: cr.created[2].username, password: cr.created[2].password });
  const uid = async c => (await c.get('/api/me')).user.id;
  const aId = await uid(A), bId = await uid(B), cId = await uid(C);

  console.log('New members');
  await it('a new class uses sequential learning; a new student has only week 1 open', async () => {
    const p = await A.get('/api/path'); assert.equal(p.sequential, true);
    assert.equal(p.weeks[0].status, 'available'); assert(p.weeks.slice(1).every(w => w.status === 'locked'));
    assert.equal(p.weeks[1].lock.message, 'ต้องผ่านสัปดาห์ที่ 1 ก่อน จึงจะสามารถเรียนบทเรียนนี้ได้');
    assert.equal(p.summary.current, 'w1'); assert.equal(p.summary.next, 'w2'); assert.equal(p.rules.passPct, 70);
  });
  await it('guests get a clear message and no saved path', async () => {
    const g = await guest.get('/api/path'); assert.equal(g.guest, true); assert(/ไม่ถูกบันทึก/.test(g.message));
    assert.equal((await fetch(BASE + '/api/lessons/w10')).status, 200, 'guests may read every week (nothing is saved)');
  });

  console.log('Skipping by URL or API');
  await it('a locked week cannot be opened, practised or scored (lesson, exercises, visits, quizzes, lab, simulator)', async () => {
    const r = await A.get('/api/lessons/w10'); assert.equal(r.status, 403); assert.equal(r.error, 'locked'); assert.equal(r.lock.needWeek, 9);
    assert.equal((await A.post('/api/lessons/w2/visit', { section: 's1' })).status, 403);
    assert.equal((await A.post('/api/lessons/w2/check', { key: 'L:w2:c:0', answer: 0 })).status, 403);
    assert.equal((await A.post('/api/lessons/w2/quiz', { kind: 'pre', answers: Array(10).fill(0) })).status, 403);
    assert.equal((await A.post('/api/labs/w3/start')).status, 403);
    assert.notEqual((await A.post('/api/labs/r1/start')).status, 403, 'r1 is the week 1 challenge: open');
    assert.equal((await A.post('/api/labs/r3/start')).status, 403, 'r3 is hosted in week 4');
    assert.equal((await A.post('/api/sims/switching/submit', { mission: 'sw1', payload: {} })).status, 403, 'sw1 serves week 4 only');
    assert.notEqual((await A.post('/api/sims/topology/submit', { mission: 't8', payload: {} })).status, 403, 't8 serves week 1');
    assert.equal((await A.get('/api/lessons/w1')).status, 200, 'week 1 opens');
  });

  console.log('Completing a week');
  await it('post-test below the pass mark does not unlock; the answer key stays hidden while attempts remain', async () => {
    await pre(A, 'w1'); await readAll(A, 'w1'); await checksAll(A, 'w1'); await guided(aId, 'w1');
    const r = await post(A, 'w1', 6);
    assert.equal(r.score, 6); assert.equal(r.passed, false); assert.equal(r.attemptsLeft, 2); assert.equal(r.reviewLocked, true); assert(!r.review);
    assert.equal((await status(A)).w2, 'locked');
    const me = await A.get('/api/me'); assert.equal(me.lessons.w1.post.reviewLocked, true); assert(!me.lessons.w1.post.review, '/api/me must not leak the key either');
    const p = (await A.get('/api/path')).weeks[0]; assert.deepEqual(p.missing, ['post']); assert(p.criteria.find(c => c.key === 'post').link.endsWith('/w1/post'));
  });
  await it('a retake waits for the cooldown, then a pass unlocks week 2 (and only week 2); best score kept, key shown', async () => {
    const cd = await post(A, 'w1', 10); assert.equal(cd.status, 429); assert.equal(cd.error, 'cooldown'); assert(cd.nextAt > Date.now());
    await pool.query("UPDATE quiz_attempt_log SET created_at = now() - interval '11 minutes' WHERE user_id=$1", [aId]);
    const r = await post(A, 'w1', 8); assert.equal(r.passed, true); assert.equal(r.attempt, 2); assert(Array.isArray(r.review));
    const s = await status(A); assert.equal(s.w1, 'completed'); assert.equal(s.w2, 'available'); assert.equal(s.w3, 'locked');
    assert.equal((await q("SELECT score FROM quiz_attempts WHERE user_id=$1 AND lesson_id='w1' AND kind='post'", [aId]))[0].score, 8);
    assert.equal((await post(A, 'w1', 10)).error, 'passed', 'no further attempts after passing');
  });
  await it('passing the post-test without the Guided Lab does not unlock', async () => {
    await pre(A, 'w2'); await readAll(A, 'w2'); await checksAll(A, 'w2');
    assert.equal((await post(A, 'w2', 10)).passed, true);
    const w2 = (await A.get('/api/path')).weeks[1]; assert.equal(w2.status, 'in_progress'); assert.deepEqual(w2.missing, ['guided']);
    await guided(aId, 'w2', 6); assert.equal((await status(A)).w3, 'locked', '6/10 is below 70%');
    await guided(aId, 'w2', 7); assert.equal((await status(A)).w3, 'available', '7/10 passes');
  });
  await it('old weeks stay open for review, and the state is the same on another device', async () => {
    assert.equal((await A.get('/api/lessons/w1')).status, 200);
    assert.equal((await A.post('/api/lessons/w1/visit', { section: 's1' })).ok, true);
    await A2.post('/api/auth/login', { username: cr.created[0].username, password: cr.created[0].password });
    assert.deepEqual(await status(A2), await status(A));
  });
  await it('another student in the same class has their own progress', async () => {
    const s = await status(B); assert.equal(s.w1, 'available'); assert.equal(s.w2, 'locked');
  });
  await it('all attempts used without passing: the key is shown and the student is told to contact the teacher', async () => {
    await pre(B, 'w1');
    for (let i = 0; i < 3; i++) { await pool.query("UPDATE quiz_attempt_log SET created_at = now() - interval '1 hour' WHERE user_id=$1", [bId]); const r = await post(B, 'w1', 3); if (i < 2) assert(!r.review); else assert(Array.isArray(r.review)); }
    await pool.query("UPDATE quiz_attempt_log SET created_at = now() - interval '1 hour' WHERE user_id=$1", [bId]);
    const r = await post(B, 'w1', 10); assert.equal(r.error, 'no_attempts'); assert(/ติดต่อครู/.test(r.message));
  });

  console.log('Teacher');
  await it('teacher sees every student\'s path, the week they are stuck in and what is missing', async () => {
    const d = await kru.get(`/api/teacher/classes/${cls.id}/path`);
    const a = d.students.find(s => s.id === aId), b = d.students.find(s => s.id === bId);
    assert.equal(a.current, 'w3'); assert.equal(a.completed, 2); assert.equal(a.weeks.slice(0, 3).join(''), 'CCA');
    assert.equal(b.current, 'w1'); assert(b.missing.includes('post'));
    const one = await kru.get(`/api/teacher/students/${bId}/path`); assert.equal(one.attempts.filter(x => x.lesson === 'w1').length, 3);
  });
  await it('only the class teacher (or admin) can see or change paths; students cannot', async () => {
    assert.equal((await kru2.get(`/api/teacher/classes/${cls.id}/path`)).status, 404);
    assert.equal((await kru2.post(`/api/teacher/students/${bId}/unlock`, { lesson: 'w2' })).status, 404);
    assert.equal((await B.post(`/api/teacher/students/${bId}/unlock`, { lesson: 'w2' })).status, 403);
    assert.equal((await B.put(`/api/teacher/classes/${cls.id}/path`, { settings: { sequential: false } })).status, 403);
    assert.equal((await admin.get(`/api/teacher/classes/${cls.id}/path`)).students.length, 3);
  });
  await it('teacher resets the post-test: the attempts are voided (kept as history) and the student may try again', async () => {
    await kru.post(`/api/teacher/students/${bId}/lessons/w1/reset-quiz`, { kind: 'post' });
    assert.equal((await post(B, 'w1', 10)).passed, true);
    assert.equal((await q("SELECT count(*)::int n FROM quiz_attempt_log WHERE user_id=$1 AND voided_at IS NOT NULL", [bId]))[0].n, 3);
  });
  let unlockId;
  await it('teacher unlocks a week for one student; it does not open the week after it', async () => {
    const r = await kru.post(`/api/teacher/students/${cId}/unlock`, { lesson: 'w5', reason: 'ย้ายมาจากห้องอื่น' }); unlockId = r.id;
    const s = await status(C); assert.equal(s.w5, 'available'); assert.equal(s.w2, 'locked'); assert.equal(s.w6, 'locked');
    const w5 = (await C.get('/api/path')).weeks[4]; assert.equal(w5.unlockedBy.kind, 'teacher'); assert.equal(w5.unlockedBy.reason, 'ย้ายมาจากห้องอื่น');
    assert.equal((await C.get('/api/lessons/w5')).status, 200);
  });
  await it('revoking the unlock locks it again; the history keeps both events', async () => {
    await kru.post(`/api/teacher/unlocks/${unlockId}/revoke`); assert.equal((await status(C)).w5, 'locked');
    const h = (await kru.get(`/api/teacher/classes/${cls.id}/path/history`)).history.filter(x => x.lesson === 'w5');
    assert.equal(h.length, 1); assert(h[0].revokedAt && h[0].revoker === 'ครูยู' && h[0].actor === 'ครูยู');
  });
  await it('teacher unlocks a week for the whole class', async () => {
    await kru.post(`/api/teacher/classes/${cls.id}/unlock`, { lesson: 'w4', reason: 'เรียนพร้อมกันทั้งห้อง' });
    for (const c of [A, B, C]) assert.notEqual((await status(c)).w4, 'locked');
    assert.equal((await status(C)).w3, 'locked', 'other weeks keep their rules');
  });
  await it('raising the pass mark later does not take back completed weeks', async () => {
    const r = await kru.put(`/api/teacher/classes/${cls.id}/path`, { settings: { passPct: 90 } }); assert.equal(r.settings.passPct, 90);
    const s = await status(A); assert.equal(s.w1, 'completed'); assert.equal(s.w2, 'completed'); assert.equal(s.w3, 'available');
    assert.equal((await kru.put(`/api/teacher/classes/${cls.id}/path`, { settings: { passPct: 20 } })).status, 400, 'limits are checked');
    assert.equal((await kru.put(`/api/teacher/classes/${cls.id}/path`, { settings: { require: { pre: false, content: false, checks: false, guided: false, post: false } } })).status, 400);
    const h = (await kru.get(`/api/teacher/classes/${cls.id}/path/history`)).history; assert(h.some(x => x.kind === 'settings' && /70% → 90%/.test(x.reason)));
  });
  await it('open dates: a week waits for its date even after the previous week is completed, unless a teacher unlocks it', async () => {
    await kru.put(`/api/teacher/classes/${cls.id}/path`, { settings: { passPct: 70, openDates: { w3: '2099-01-01' } } });
    const w3 = (await A.get('/api/path')).weeks[2]; assert.equal(w3.status, 'locked'); assert.equal(w3.lock.openDate, '2099-01-01');
    await kru.post(`/api/teacher/students/${aId}/unlock`, { lesson: 'w3' }); assert.equal((await status(A)).w3, 'available');
    await kru.put(`/api/teacher/classes/${cls.id}/path`, { settings: { openDates: { w3: null } } });
  });

  console.log('Existing classes and earlier work');
  let old, oldStu;
  await it('the migration keeps classes that existed before as they were (all weeks open, one post-test with the key)', async () => {
    old = await kru.post('/api/teacher/classes', { name: 'ห้องเดิม' });
    const st = await kru.post(`/api/teacher/classes/${old.id}/students`, { rows: [{ no: '1', name: 'นักเรียนเดิม' }] });
    oldStu = client(); await oldStu.post('/api/auth/login', { username: st.created[0].username, password: st.created[0].password });
    await pool.query("UPDATE classes SET path=NULL WHERE id=$1", [old.id]); await pool.query("DELETE FROM app_migrations WHERE id='path-1'");
    await pool.query("UPDATE classes SET path=$2 WHERE id=$1", [cls.id, JSON.stringify((await kru.get(`/api/teacher/classes/${cls.id}/path`)).settings)]);
    await require('../server/path').migrate();
    const p = await oldStu.get('/api/path'); assert.equal(p.sequential, false); assert(p.weeks.every(w => w.status !== 'locked'));
    const r = await post(oldStu, 'w3', 4); assert(Array.isArray(r.review), 'one attempt, key shown as before');
    assert.equal((await post(oldStu, 'w3', 10)).error, 'done');
    assert.equal((await kru.get(`/api/teacher/classes/${cls.id}/path`)).settings.sequential, true, 'a class that already had rules is untouched');
  });
  await it('turning sequential learning on keeps started weeks open (legacy) and reports them; earlier completions count', async () => {
    const sid = await uid(oldStu);
    await completeWeek(oldStu, sid, 'w1'); await pre(oldStu, 'w5');   // w1 complete, w3 attempted, w5 started
    const r = await kru.put(`/api/teacher/classes/${old.id}/path`, { settings: { sequential: true } });
    assert.deepEqual(r.report.map(x => x.legacy), [['w3', 'w5']]);
    const s = await status(oldStu); assert.equal(s.w1, 'completed'); assert.equal(s.w2, 'available'); assert.notEqual(s.w3, 'locked'); assert.equal(s.w4, 'locked'); assert.notEqual(s.w5, 'locked');
    const w3 = (await oldStu.get('/api/path')).weeks[2]; assert.equal(w3.unlockedBy.kind, 'legacy');
    const row = (await kru.get(`/api/teacher/classes/${old.id}/path`)).students[0]; assert.deepEqual(row.legacy, ['w3', 'w5']);
  });
  await it('students without a class learn in order too', async () => {
    const reg = client(); const g = await reg.post('/api/auth/register', { classCode: old.code, username: 'solo.one', name: 'นักเรียนเดี่ยว', studentNo: '9', password: 'abc12345' });
    if (g.ok) await pool.query("UPDATE users SET class_id=NULL WHERE username='solo.one'");
    const p = await reg.get('/api/path'); assert.equal(p.sequential, true); assert.equal(p.weeks[1].status, 'locked');
  });
  await it('turning it off opens every week again without losing completions', async () => {
    await kru.put(`/api/teacher/classes/${cls.id}/path`, { settings: { sequential: false } });
    const s = await status(C); assert(Object.values(s).every(v => v !== 'locked')); assert.equal((await status(A)).w2, 'completed');
    await kru.put(`/api/teacher/classes/${cls.id}/path`, { settings: { sequential: true } });
  });

  console.log(`\n${passed} passed`);
  await pool.end(); server.close(); await require('../server/db').close();
  process.exit(process.exitCode || 0);
})().catch(e => { console.error(e); process.exit(1); });

// 3.0 Phase 5: Skills Portfolio, teacher observations, capstone defense rubric, practice gate. Needs a real PostgreSQL:
//   TEST_DATABASE_URL=postgres://user@127.0.0.1:5432/netlab_test node tests/portfolio.test.js   (the database is wiped)
'use strict';
const assert = require('assert');
const url = process.env.TEST_DATABASE_URL;
if (!url) { console.log('SKIP portfolio tests: set TEST_DATABASE_URL'); process.exit(0); }
process.env.DATABASE_URL = url;
process.env.ADMIN_USERNAME = 'admin';
process.env.ADMIN_PASSWORD = 'admin-pass-123';
process.env.PORT = process.env.PORT || '3987';
const { Pool } = require('pg');
const BASE = `http://127.0.0.1:${process.env.PORT}`;
let passed = 0;
const it = async (name, fn) => { try { await fn(); passed++; console.log('  ✓', name); } catch (e) { console.log('  ✗', name, '\n    ', e.message); process.exitCode = 1; } };
function client(opts = {}) {
  let cookie = '';
  const call = async (method, path, body) => {
    const r = await fetch(BASE + path, { method, headers: { 'Content-Type': 'application/json', 'X-NetLab': '1', ...(cookie ? { Cookie: cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
    // 3.0 P6: the server refuses most actions on a temporary password; a test account sets the same password again
    // right after its first login (the browser forces this step for real users). keepTemp keeps the flag for tests about it.
    if (method === 'POST' && path === '/api/auth/login' && r.ok && !opts.keepTemp) {
      const me = await (await fetch(BASE + '/api/me', { headers: { 'X-NetLab': '1', Cookie: cookie } })).json().catch(() => ({}));
      if (me.user && me.user.mustChangePw) await fetch(BASE + '/api/auth/password', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-NetLab': '1', Cookie: cookie }, body: JSON.stringify({ current: body.password, next: body.password }) });
    }
    const j = await r.json().catch(() => ({}));
    return { status: r.status, ...j };
  };
  return { get: p => call('GET', p), post: (p, b) => call('POST', p, b || {}), put: (p, b) => call('PUT', p, b || {}), patch: (p, b) => call('PATCH', p, b), del: p => call('DELETE', p) };
}

(async () => {
  const pool = new Pool({ connectionString: url });
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  const server = await require('../server').start();
  await new Promise(r => setTimeout(r, 300));
  const admin = client(), kru = client(), kru2 = client(), stu = client(), stu2 = client(), guest = client();
  await admin.post('/api/auth/login', { username: 'admin', password: 'admin-pass-123' });
  const t1 = await admin.post('/api/admin/teachers', { username: 'kru.p', name: 'ครูพี' });
  const t2 = await admin.post('/api/admin/teachers', { username: 'kru.q', name: 'ครูคิว' });
  await kru.post('/api/auth/login', { username: 'kru.p', password: t1.password });
  await kru2.post('/api/auth/login', { username: 'kru.q', password: t2.password });
  const cls = await kru.post('/api/teacher/classes', { name: 'ปวช.2/1' });
  const cls2 = await kru2.post('/api/teacher/classes', { name: 'ปวช.2/2' });
  const legacyRules = { settings: { sequential: false, post: { maxAttempts: 1, cooldownMin: 0, review: 'always' } } };   // sequential learning: tests/path.test.js
  await kru.put(`/api/teacher/classes/${cls.id}/path`, legacyRules); await kru2.put(`/api/teacher/classes/${cls2.id}/path`, legacyRules);
  const cr = await kru.post(`/api/teacher/classes/${cls.id}/students`, { rows: [{ no: '1', name: 'สมชาย' }] });
  const cr2 = await kru2.post(`/api/teacher/classes/${cls2.id}/students`, { rows: [{ no: '1', name: 'สมหญิง' }] });
  await stu.post('/api/auth/login', { username: cr.created[0].username, password: cr.created[0].password });
  await stu2.post('/api/auth/login', { username: cr2.created[0].username, password: cr2.created[0].password });
  const sid = (await stu.get('/api/me')).user.id;

  console.log('Schema (additive)');
  await it('new tables and the class column exist after start', async () => {
    const t = (await pool.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='public'`)).rows.map(r => r.table_name);
    ['skill_observations', 'portfolio_notes', 'capstone_reviews'].forEach(x => assert(t.includes(x), x));
    const c = (await pool.query(`SELECT column_default FROM information_schema.columns WHERE table_name='classes' AND column_name='require_practice'`)).rows[0];
    assert(c && /false/.test(c.column_default));
  });

  console.log('Student portfolio');
  await it('guest gets 401', async () => { assert.equal((await guest.get('/api/portfolio')).status, 401); });
  await it('empty portfolio: 10 skills without level, 18 weeks, capstone not submitted', async () => {
    const p = await stu.get('/api/portfolio');
    assert.equal(p.skills.length, 10); assert(p.skills.every(s => s.level === null && s.rubric.length === 4));
    assert.equal(p.weeks.length, 18); assert.equal(p.capstone.auto, null); assert.equal(p.capstone.defense.score, null); assert.equal(p.capstone.defense.max, 20);
    assert.equal(p.student.name, 'สมชาย');
  });
  await it('a passed simulator mission becomes dated hands-on evidence of its skills', async () => {
    await pool.query(`INSERT INTO sim_results(user_id,sim,mission,best,max,last,attempts) VALUES($1,'wifi','wf2',10,10,10,2)`, [sid]);
    const p = await stu.get('/api/portfolio');
    const w = p.skills.find(s => s.id === 'wireless'); const e = w.hands.find(x => x.src === 'wifi:wf2');
    assert(e && e.kind === 'sim' && e.best === 10 && e.at > 0); assert.equal(w.level, 'Developing');
    assert(p.skills.find(s => s.id === 'design').hands.some(x => x.src === 'wifi:wf2'), 'second skill of the mission');
    assert.equal(p.weeks.find(x => x.id === 'w6').practice.passed, 1);
  });

  console.log('Teacher observations (evidence from real work in class)');
  let obsId;
  await it('teacher records observed evidence; it counts toward the level', async () => {
    let r = await kru.post(`/api/teacher/students/${sid}/observations`, { skill: 'cabling', level: 3, title: 'เข้าหัว RJ-45 จริง 2 เส้น ผ่านเครื่องทดสอบ', week: 5, observed_on: new Date().toISOString().slice(0, 10) });
    assert.equal(r.ok, true); obsId = r.id;
    r = await kru.post(`/api/teacher/students/${sid}/observations`, { skill: 'cabling', level: 4, title: 'หาสายเสียในตู้ Rack จริงและแก้ไขเอง', week: 5 });
    const p = await stu.get('/api/portfolio'); const c = p.skills.find(s => s.id === 'cabling');
    assert.equal(c.hands.filter(x => x.kind === 'teacher').length, 2);
    assert.equal(c.level, 'Advanced', 'level 3 + level 4 observations: two full passes, one counted as hard');
    assert(c.reasons[0].includes('ครูบันทึกจากการปฏิบัติจริง 2'));
    assert.equal((await kru.get(`/api/teacher/classes/${cls.id}/skills`)).students[0].skills.find(x => x.id === 'cabling').level, 'Advanced', 'class skill matrix uses the same evidence');
  });
  await it('bad observations are rejected', async () => {
    const u = `/api/teacher/students/${sid}/observations`;
    assert.equal((await kru.post(u, { skill: 'nope', level: 2, title: 'ทดสอบ' })).status, 400);
    assert.equal((await kru.post(u, { skill: 'cabling', level: 5, title: 'ทดสอบ' })).status, 400);
    assert.equal((await kru.post(u, { skill: 'cabling', level: 2, title: 'x' })).status, 400);
    assert.equal((await kru.post(u, { skill: 'cabling', level: 2, title: 'ทดสอบ', week: 19 })).status, 400);
    assert.equal((await kru.post(u, { skill: 'cabling', level: 2, title: 'ทดสอบ', observed_on: '2099-01-01' })).status, 400);
  });
  await it('only the student\'s own teacher can see or change the portfolio', async () => {
    assert.equal((await kru2.get(`/api/teacher/students/${sid}/portfolio`)).status, 404);
    assert.equal((await kru2.post(`/api/teacher/students/${sid}/observations`, { skill: 'cabling', level: 2, title: 'แอบเพิ่ม' })).status, 404);
    assert.equal((await kru2.del(`/api/teacher/observations/${obsId}`)).status, 404);
    assert.equal((await stu.get(`/api/teacher/students/${sid}/portfolio`)).status, 403);
    assert.equal((await stu2.get('/api/portfolio')).skills.find(s => s.id === 'cabling').hands.length, 0, 'another student sees only their own evidence');
    const p = await kru.get(`/api/teacher/students/${sid}/portfolio`); assert.equal(p.student.id, sid);
    assert.equal((await admin.get(`/api/teacher/students/${sid}/portfolio`)).student.id, sid, 'admin can see every class');
  });
  await it('teacher deletes an observation', async () => {
    assert.equal((await kru.del(`/api/teacher/observations/${obsId}`)).ok, true);
    assert.equal((await stu.get('/api/portfolio')).skills.find(s => s.id === 'cabling').hands.length, 1);
  });

  console.log('Reflections and comments');
  await it('student writes a reflection, teacher comments; each side writes only its own field', async () => {
    assert.equal((await stu.put('/api/portfolio/notes/cabling', { reflection: 'เข้าหัวได้เร็วขึ้น ครั้งแรกสลับคู่สีเขียว' })).ok, true);
    assert.equal((await kru.put(`/api/teacher/students/${sid}/notes/cabling`, { comment: 'ดีมาก ฝึกตรวจด้วย LAN tester ทุกครั้ง' })).ok, true);
    assert.equal((await stu.put('/api/portfolio/notes/cabling', { reflection: 'แก้ไขแล้ว: เข้าหัวได้เร็วขึ้น' })).ok, true);
    const p = await stu.get('/api/portfolio'); const n = p.skills.find(s => s.id === 'cabling').note;
    assert.equal(n.reflection, 'แก้ไขแล้ว: เข้าหัวได้เร็วขึ้น'); assert.equal(n.comment, 'ดีมาก ฝึกตรวจด้วย LAN tester ทุกครั้ง', 'student edit keeps the teacher comment');
    assert.equal((await stu.put('/api/portfolio/notes/nope', { reflection: 'x' })).status, 404);
    assert.equal((await stu.put(`/api/teacher/students/${sid}/notes/cabling`, { comment: 'ปลอม' })).status, 403);
    await stu.put('/api/portfolio/notes/overall', { reflection: 'ก'.repeat(5000) });
    assert.equal((await stu.get('/api/portfolio')).overall.reflection.length, 2000, 'long text is clipped');
  });

  console.log('Capstone presentation and defense rubric');
  await it('teacher scores criteria 1-4; unknown criteria are ignored, partial scoring allowed', async () => {
    assert.equal((await kru.put(`/api/teacher/students/${sid}/capstone`, { scores: { design: 5 } })).status, 400);
    const r = await kru.put(`/api/teacher/students/${sid}/capstone`, { scores: { design: 3, demo: 4, bogus: 2 }, comment: 'สาธิตครบ' });
    assert.deepEqual(r.scores, { design: 3, demo: 4 });
    const p = await stu.get('/api/portfolio');
    assert.equal(p.capstone.defense.score, 7); assert.equal(p.capstone.defense.comment, 'สาธิตครบ'); assert.equal(p.capstone.defense.teacher, 'ครูพี');
    assert.equal((await kru2.put(`/api/teacher/students/${sid}/capstone`, { scores: { design: 1 } })).status, 404);
  });
  await it('class overview lists evidence counts and capstone totals', async () => {
    const d = await kru.get(`/api/teacher/classes/${cls.id}/portfolio`);
    assert.equal(d.students.length, 1); const s = d.students[0];
    assert.equal(s.observations, 1); assert.equal(s.reflections, 2); assert.equal(s.defense, 7); assert.equal(d.requirePractice, false);
    assert.equal((await kru2.get(`/api/teacher/classes/${cls.id}/portfolio`)).status, 404);
  });

  console.log('Teacher option: Guided Lab before the post-test');
  const answers = Array(10).fill(0);
  await it('off by default: the post-test opens without practice', async () => {
    assert.deepEqual(await stu.get('/api/lessons/w1/gate').then(g => [g.required, g.missing.length]), [false, 0]);
    assert.equal((await stu.post('/api/lessons/w2/quiz', { kind: 'post', answers })).kind, 'post');
  });
  await it('when on, the post-test is refused on the server until the guided missions are passed', async () => {
    assert.equal((await kru.patch(`/api/teacher/classes/${cls.id}/require-practice`, { enabled: 'yes' })).status, 400);
    assert.equal((await kru.patch(`/api/teacher/classes/${cls.id}/require-practice`, { enabled: true })).ok, true);
    const g = await stu.get('/api/lessons/w1/gate');
    assert.equal(g.required, true); assert.deepEqual(g.missing.map(m => m.ref), ['topology:t8', 'topology:t14']);
    const r = await stu.post('/api/lessons/w1/quiz', { kind: 'post', answers });
    assert.equal(r.status, 409); assert.equal(r.error, 'practice_required'); assert.equal(r.missing.length, 2);
    assert.equal((await stu.post('/api/lessons/w1/quiz', { kind: 'pre', answers })).kind, 'pre', 'the pre-test is never gated');
    assert.equal((await stu2.get('/api/lessons/w1/gate')).required, false, 'other classes are not affected');
  });
  await it('a mission below 70 % does not open it; passing both does', async () => {
    await pool.query(`INSERT INTO sim_results(user_id,sim,mission,best,max) VALUES($1,'topology','t8',6,10),($1,'topology','t14',10,10)`, [sid]);
    assert.deepEqual((await stu.get('/api/lessons/w1/gate')).missing.map(m => [m.ref, m.best]), [['topology:t8', 6]]);
    await pool.query(`UPDATE sim_results SET best=7 WHERE user_id=$1 AND mission='t8'`, [sid]);
    assert.equal((await stu.get('/api/lessons/w1/gate')).missing.length, 0);
    assert.equal((await stu.post('/api/lessons/w1/quiz', { kind: 'post', answers })).kind, 'post');
  });

  console.log('Backup and deletion');
  await it('admin backup (version 2) includes the score and portfolio tables', async () => {
    const b = await admin.get('/api/admin/backup');
    assert.equal(b.version, 2); ['sim_results', 'quiz_attempts', 'skill_observations', 'portfolio_notes', 'capstone_reviews'].forEach(t => assert(Array.isArray(b[t]) && b[t].length, t));
    assert(!JSON.stringify(b).includes('scrypt$'), 'no password hashes');
  });
  await it('deleting the account removes the student\'s portfolio rows (ON DELETE CASCADE)', async () => {
    await pool.query('DELETE FROM users WHERE id=$1', [sid]);
    for (const t of ['skill_observations', 'portfolio_notes', 'capstone_reviews']) assert.equal(Number((await pool.query(`SELECT count(*) FROM ${t} WHERE user_id=$1`, [sid])).rows[0].count), 0, t);
  });

  console.log(`\n${passed} passed`);
  await pool.end(); server.close(); await require('../server/db').close();
  process.exit(process.exitCode || 0);
})().catch(e => { console.error(e); process.exit(1); });

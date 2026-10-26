// 3.0 Phase 6: fixes from the independent security and answer-leak review. Needs a real PostgreSQL (the database is wiped):
//   TEST_DATABASE_URL=postgres://user@127.0.0.1:5432/netlab_test node tests/security.test.js
'use strict';
const assert = require('assert');
const url = process.env.TEST_DATABASE_URL;
process.env.TIMETABLE = process.env.TIMETABLE || 'off';   // 3.4: no class timetable in test databases (path.test turns it on for its own test)
process.env.STEP_ORDER = process.env.STEP_ORDER || 'off';   // 3.6: step order inside a week is tested on its own (practical.test)
if (!url) { console.log('SKIP security tests: set TEST_DATABASE_URL'); process.exit(0); }
process.env.DATABASE_URL = url;
process.env.ADMIN_USERNAME = 'admin';
process.env.ADMIN_PASSWORD = 'admin-pass-123';
process.env.PORT = process.env.PORT || '3986';
const { Pool } = require('pg');
const BASE = `http://127.0.0.1:${process.env.PORT}`;
let passed = 0;
const it = async (name, fn) => { try { await fn(); passed++; console.log('  ✓', name); } catch (e) { console.log('  ✗', name, '\n    ', e.message); process.exitCode = 1; } };
function client() {
  let cookie = '';
  const call = async (method, path, body, rawBody) => {
    const r = await fetch(BASE + path, { method, headers: { 'Content-Type': 'application/json', 'X-NetLab': '1', ...(cookie ? { Cookie: cookie } : {}) }, body: rawBody != null ? rawBody : body ? JSON.stringify(body) : undefined });
    const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
    const j = await r.json().catch(() => ({}));
    return { status: r.status, headers: r.headers, ...j };
  };
  return { get: p => call('GET', p), post: (p, b) => call('POST', p, b || {}), put: (p, b) => call('PUT', p, b || {}), patch: (p, b) => call('PATCH', p, b), raw: (m, p, s) => call(m, p, null, s) };
}

(async () => {
  const pool = new Pool({ connectionString: url });
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  const server = await require('../server').start();
  await new Promise(r => setTimeout(r, 300));
  const admin = client(), kru = client(), guest = client();
  await admin.post('/api/auth/login', { username: 'admin', password: 'admin-pass-123' });
  const t = await admin.post('/api/admin/teachers', { username: 'kru.s', name: 'ครูเอส' });
  await kru.post('/api/auth/login', { username: 'kru.s', password: t.password });

  console.log('Temporary passwords');
  await it('a teacher on a temporary password can only change it (server-side, not just the browser form)', async () => {
    assert.equal((await kru.get('/api/me')).user.mustChangePw, true);
    const r = await kru.get('/api/teacher/classes'); assert.equal(r.status, 403); assert.equal(r.error, 'must_change_pw');
    assert.equal((await kru.post('/api/teacher/classes', { name: 'x' })).status, 403);
    assert.equal((await kru.get('/api/content')).status, 200, 'public course data stays readable');
    assert.equal((await kru.post('/api/auth/password', { current: t.password, next: 'teacher123' })).ok, true);
    assert.equal((await kru.get('/api/teacher/classes')).status, 200);
  });
  await it('generated temporary passwords always contain letters and digits', async () => {
    const auth = require('../server/auth'); for (let i = 0; i < 5000; i++) assert.equal(auth.passwordProblem(auth.tempPassword()), null);
  });
  const cls = await kru.post('/api/teacher/classes', { name: 'ปวช.3/1' });
  await kru.put(`/api/teacher/classes/${cls.id}/path`, { settings: { sequential: false, post: { maxAttempts: 1, cooldownMin: 0, review: 'always' } } });   // sequential learning: tests/path.test.js
  const cr = await kru.post(`/api/teacher/classes/${cls.id}/students`, { rows: [{ no: '1', name: 'นักเรียนหนึ่ง' }, { no: '2', name: 'นักเรียนสอง' }, null] });
  const s1 = client(), s1b = client(), s2 = client();
  const u1 = cr.created[0];
  await s1.post('/api/auth/login', { username: u1.username, password: u1.password });
  await it('a null row in bulk create is skipped, not a server error', async () => { assert.equal(cr.created.length, 2); assert.equal(cr.skipped.length, 1); });
  await it('student on a temporary password cannot save work until the password is changed', async () => {
    // 3.2: the timed work of a week is its practical session
    assert.equal((await s1.post('/api/practical/w2/start')).error, 'must_change_pw');
    assert.equal((await s1.post('/api/check', { key: 'w2-8', answer: 'x' })).error, 'must_change_pw');
    assert.equal((await s1.post('/api/sims/topology/submit', { mission: 't1', payload: {} })).error, 'must_change_pw');
    assert.equal((await s1.get('/api/practical/active')).session, null, 'nothing was started');
    assert.equal((await s1.post('/api/auth/password', { current: u1.password, next: 'stud12345' })).ok, true);
    const s = await s1.post('/api/practical/w2/start'); assert.equal(s.status, 200); assert(s.running && s.running.deadline > s.now);
    await s1.post('/api/practical/w2/submit');
  });

  console.log('Sessions');
  await it('changing the password signs out every other device (both endpoints), but not this one', async () => {
    await s1b.post('/api/auth/login', { username: u1.username, password: 'stud12345' });
    assert(((await s1b.get('/api/me')).user || {}).id);
    assert.equal((await s1.post('/api/auth/password', { current: 'stud12345', next: 'stud67890' })).ok, true);
    assert.equal((await s1b.get('/api/me')).user, null, 'other device signed out');
    assert(((await s1.get('/api/me')).user || {}).id, 'this device still signed in');
    await s1b.post('/api/auth/login', { username: u1.username, password: 'stud67890' });
    assert.equal((await s1.post('/api/account/password', { current: 'stud67890', next: 'stud24680' })).ok, true);
    assert.equal((await s1b.get('/api/me')).user, null);
  });

  console.log('Answer leaks');
  const answers = Array(10).fill(0);
  await it('a guest cannot take the post-test (its review is the answer key); logged in works', async () => {
    const g = await guest.post('/api/lessons/w1/quiz', { kind: 'post', answers });
    assert.equal(g.status, 401); assert.equal(g.error, 'login_required'); assert(!g.review);
    assert.equal((await guest.post('/api/lessons/w1/quiz', { kind: 'pre', answers })).kind, 'pre', 'the pre-test stays open for guests (no answers in its reply)');
    assert(Array.isArray((await s1.post('/api/lessons/w1/quiz', { kind: 'post', answers })).review));
  });
  await it('a guest lab check gives no flag when accounts are on', async () => {
    const { ALL } = require('../content/labs');
    const lab = ALL.find(l => l.id === 'w2'), i = lab.tasks.findIndex(x => x.practical && x.type === 'text');   // 3.2: week labs keep hands-on tasks only
    const r = await guest.post('/api/check', { key: `w2-${i}`, answer: lab.tasks[i].answers[0] });
    assert.equal(r.correct, true); assert.equal(r.guest, true); assert.equal(r.flag, undefined);
  });
  await it('course data no longer carries the VM setup scripts (they plant the flags); the button fetches them', async () => {
    const c = JSON.stringify(await guest.get('/api/content?v=29')) + JSON.stringify(await guest.get('/api/content'));
    assert(!/printf|NET\{/.test(c), 'setup text or flags in /api/content');
    const v = await guest.get('/api/labs/w12/vmsetup'); assert(typeof v.setup === 'string' && v.setup.length > 10);
    assert.equal((await guest.get('/api/labs/w1/vmsetup')).status, 404);
  });
  await it('practice check refuses questions of an exam that is being taken, and allows them after submission', async () => {
    const e = await kru.post(`/api/teacher/classes/${cls.id}/exams`, { title: 'สอบย่อย', units: [1], counts: { easy: 3, medium: 0, hard: 0 }, minutes: 20, showReview: true });
    const a = await s1.post(`/api/exams/${e.id}/start`); const qid = a.questions[0].id;
    const r = await guest.post('/api/practice/check', { id: qid, answer: 0 });
    assert.equal(r.status, 423); assert(!r.answer, 'no answer during the exam');
    await s1.post(`/api/exams/${e.id}/submit`);
    assert.notEqual((await guest.post('/api/practice/check', { id: qid, answer: 0 })).status, 423);
  });

  console.log('Privacy');
  await it('"export my data" includes lab answers and the Skills Portfolio', async () => {
    const sid = (await s1.get('/api/me')).user.id;
    await kru.post(`/api/teacher/students/${sid}/observations`, { skill: 'cabling', level: 2, title: 'เข้าหัวสายจริง' });
    await s1.put('/api/portfolio/notes/cabling', { reflection: 'ฝึกเพิ่ม' });
    const ex = client(); await ex.post('/api/auth/login', { username: u1.username, password: 'stud24680' });
    const d = await ex.get('/api/account/export');
    ['labAnswers', 'examAnswers', 'portfolioNotes', 'skillObservations', 'capstoneReview', 'resetRequests', 'challenges'].forEach(k => assert(Array.isArray(d[k]), k));
    assert.equal(d.skillObservations.length, 1); assert.equal(d.portfolioNotes[0].reflection, 'ฝึกเพิ่ม'); assert(d.examAnswers.length >= 1);
  });
  await it('deleting the account also removes its rows from the 2.9 backup table', async () => {
    await pool.query('CREATE TABLE IF NOT EXISTS backup_29_task_progress AS SELECT * FROM task_progress WITH NO DATA');
    const u2 = cr.created[1]; await s2.post('/api/auth/login', { username: u2.username, password: u2.password });
    const id = (await s2.get('/api/me')).user.id;
    await s2.post('/api/auth/password', { current: u2.password, next: 'stud13579' });   // temporary password first
    await pool.query(`INSERT INTO backup_29_task_progress(user_id,task_key,lab_id) VALUES($1,'w1-0','w1')`, [id]);
    assert.equal((await s2.post('/api/account/delete', { confirm: 'ลบบัญชี', password: 'stud13579' })).ok, true);
    assert.equal(Number((await pool.query('SELECT count(*) FROM backup_29_task_progress WHERE user_id=$1', [id])).rows[0].count), 0);
  });

  console.log('Bad input and headers');
  await it('bad ids, dates and oversized bodies answer 4xx, not 500', async () => {
    for (const p of ['/api/teacher/classes/1.5', '/api/teacher/classes/99999999999', '/api/teacher/students/1e400/portfolio']) assert.equal((await kru.get(p)).status === 500, false, p);
    const sid = (await s1.get('/api/me')).user.id;
    assert.equal((await kru.post(`/api/teacher/students/${sid}/observations`, { skill: 'cabling', level: 2, title: 'ทดสอบวันที่', observed_on: '2024-02-30' })).status, 400);
    assert.equal((await s1.raw('PUT', '/api/portfolio/notes/overall', JSON.stringify({ reflection: 'ก'.repeat(70000) }))).status, 413);
    assert.equal((await guest.get('/api/sims/__proto__')).status, 404);
    assert.equal((await guest.post('/api/sims/toString/submit', { mission: 'x' })).status, 404);
  });
  await it('security headers: CSP with the teacher page script hash, Permissions-Policy, no inline script in index.html', async () => {
    const h = (await fetch(BASE + '/teacher.html')).headers, csp = h.get('content-security-policy');
    assert(csp && /script-src 'self' 'wasm-unsafe-eval' 'sha256-/.test(csp) && /frame-ancestors 'self'/.test(csp) && /object-src 'none'/.test(csp));
    const crypto = require('crypto'), fs = require('fs');
    const html = fs.readFileSync(require('path').join(__dirname, '..', 'public', 'teacher.html'), 'utf8');
    for (const m of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) assert(csp.includes(crypto.createHash('sha256').update(m[1]).digest('base64')), 'hash of an inline block missing');
    assert(h.get('permissions-policy')); assert(!/<script>/.test(fs.readFileSync(require('path').join(__dirname, '..', 'public', 'index.html'), 'utf8')));
  });
  await it('an unknown username takes about as long as a wrong password (no account discovery by timing)', async () => {
    const tm = async u => { const c = client(); const a = Date.now(); await c.post('/api/auth/login', { username: u, password: 'wrong-pass-1' }); return Date.now() - a; };
    await tm('nobody.zz');   // warm-up
    const known = (await tm('kru.s') + await tm('kru.s')) / 2, unknown = (await tm('nobody.aa') + await tm('nobody.bb')) / 2;
    assert(unknown > known * 0.4, `unknown ${unknown} ms vs known ${known} ms`);
  });

  console.log(`\n${passed} passed`);
  await pool.end(); server.close(); await require('../server/db').close();
  process.exit(process.exitCode || 0);
})().catch(e => { console.error(e); process.exit(1); });

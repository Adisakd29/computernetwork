// Personal accounts (2.7): e-mail sign-up + verification, password reset, Google sign-in (against a local fake OIDC provider),
// account linking, profile, class join, isolation between students, sessions, export and deletion. Needs PostgreSQL:
//   TEST_DATABASE_URL=postgres://user@127.0.0.1:5432/netlab_test node tests/accounts.test.js   (the database is wiped)
'use strict';
const assert = require('assert');
const fs = require('fs'), os = require('os'), path = require('path');
const url = process.env.TEST_DATABASE_URL;
if (!url) { console.log('SKIP accounts tests: set TEST_DATABASE_URL'); process.exit(0); }
const PORT = process.env.PORT || '3987', BASE = `http://127.0.0.1:${PORT}`;
const MAILS = fs.mkdtempSync(path.join(os.tmpdir(), 'nlmail-'));
Object.assign(process.env, { DATABASE_URL: url, PORT, ADMIN_USERNAME: 'admin', ADMIN_PASSWORD: 'admin-pass-123', MAIL_DEV_DIR: MAILS, EMAIL_MX_CHECK: '0', PUBLIC_URL: BASE, APP_SECRET: 'acct-test' });

let passed = 0;
const it = async (name, fn) => { try { await fn(); passed++; console.log('  ✓', name); } catch (e) { console.log('  ✗', name, '\n    ', e.stack.split('\n').slice(0, 2).join(' | ')); process.exitCode = 1; } };

/* client with a real cookie jar (path-scoped cookies such as the OAuth state cookie) */
function client() {
  const jar = new Map();   // name -> {value, path}
  const header = p => [...jar.entries()].filter(([, c]) => p.startsWith(c.path)).map(([k, c]) => `${k}=${c.value}`).join('; ');
  const store = r => { for (const sc of r.headers.getSetCookie ? r.headers.getSetCookie() : []) {
    const [kv, ...attrs] = sc.split(';'); const i = kv.indexOf('='); const k = kv.slice(0, i).trim(), v = kv.slice(i + 1).trim();
    const pth = (attrs.map(a => a.trim()).find(a => /^path=/i.test(a)) || 'Path=/').slice(5);
    if (!v || attrs.some(a => /max-age=0/i.test(a))) jar.delete(k); else jar.set(k, { value: v, path: pth });
  } };
  const call = async (method, p, body, opts = {}) => {
    const u = new URL(p, BASE);
    const r = await fetch(u, { method, redirect: 'manual', headers: { 'Content-Type': 'application/json', 'X-NetLab': '1', ...(u.origin === BASE ? { Cookie: header(u.pathname) } : {}) }, body: body ? JSON.stringify(body) : undefined });
    if (u.origin === BASE) store(r);
    if (opts.raw) return r;
    const j = await r.json().catch(() => ({}));
    return { status: r.status, ...j };
  };
  /* follows a Google sign-in: our /start -> provider /auth -> our /callback; returns the result code from /#/auth-result/<code> */
  const google = async (mode = 'login') => {
    let r = await call('GET', `/api/auth/google/start?mode=${mode}`, null, { raw: true });
    for (let i = 0; i < 4 && r.status >= 300 && r.status < 400; i++) {
      const loc = r.headers.get('location');
      if (loc.startsWith('/#/auth-result/')) return loc.split('/').pop();
      r = await call('GET', new URL(loc, BASE).toString(), null, { raw: true });
    }
    return 'no-redirect-' + r.status;
  };
  return { get: p => call('GET', p), post: (p, b) => call('POST', p, b || {}), patch: (p, b) => call('PATCH', p, b), raw: p => call('GET', p, null, { raw: true }), google, jar };
}
const mails = () => fs.readdirSync(MAILS).sort().map(f => JSON.parse(fs.readFileSync(path.join(MAILS, f), 'utf8')));
const lastMailTo = to => mails().filter(m => m.to === to).pop();
const linkToken = (m, kind) => { const x = m.text.match(new RegExp(`#/${kind}/([A-Za-z0-9_-]+)`)); return x && x[1]; };

(async () => {
  const fake = await require('./fake-google').start(4556);
  Object.assign(process.env, fake.env);
  const { Pool } = require('pg');
  const pool = new Pool({ connectionString: url });
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  const server = await require('../server').start();
  await new Promise(r => setTimeout(r, 300));
  const W1 = require('../content/lessons/w1.js');
  const right = q => q.type === 'choice' ? q.correct : q.type === 'multi' ? q.correct : q.type === 'tf' ? q.answer : q.answers[0];

  const A = client(), A2 = client(), B = client(), C = client(), D = client(), T = client(), admin = client(), guest = client();
  console.log('E-mail sign-up and verification');
  await it('config tells the page which methods are on', async () => {
    const c = await guest.get('/api/auth/config'); assert.deepStrictEqual([c.db, c.email, c.google], [true, true, true]);
  });
  await it('sign-up validation messages (Thai) for bad input', async () => {
    const base = { name: 'สมชาย ใจดี', email: 'a.student@example.com', password: 'Netlab2026', password2: 'Netlab2026', accept: true };
    for (const [patch, code] of [[{ name: 'ก' }, 'bad_name'], [{ email: 'not-an-email' }, 'bad_email'], [{ password: 'short1', password2: 'short1' }, 'bad_password'],
      [{ password2: 'Netlab2027' }, 'mismatch'], [{ accept: false }, 'terms']]) {
      const r = await guest.post('/api/auth/signup', { ...base, ...patch }); assert.strictEqual(r.error, code, JSON.stringify(r)); assert(/[ก-๙]/.test(r.message));
    }
  });
  let aId;
  await it('1. student A signs up with e-mail; account is not usable until the link is opened', async () => {
    const r = await A.post('/api/auth/signup', { name: 'สมชาย ใจดี', email: 'A.Student@Example.com ', password: 'Netlab2026', password2: 'Netlab2026', accept: true });
    assert.strictEqual(r.ok, true); assert.strictEqual(r.email, 'a.student@example.com');
    assert.strictEqual((await A.get('/api/me')).user, null, 'no session before verification');
    const l = await A.post('/api/auth/login', { username: 'a.student@example.com', password: 'Netlab2026' }); assert.strictEqual(l.error, 'unverified');
    const m = lastMailTo('a.student@example.com'); assert(m && /ยืนยัน/.test(m.subject) && m.html.includes(BASE + '/#/verify/'));
    assert.strictEqual((await A.post('/api/auth/verify', { token: 'forged-token' })).error, 'bad_token');
    const v = await A.post('/api/auth/verify', { token: linkToken(m, 'verify') }); assert.strictEqual(v.ok, true);
    const me = await A.get('/api/me'); assert.strictEqual(me.user.email, 'a.student@example.com'); assert.strictEqual(me.user.role, 'student'); assert.strictEqual(me.user.class, null);
    aId = me.user.id;
    assert.strictEqual((await B.post('/api/auth/verify', { token: linkToken(m, 'verify') })).error, 'bad_token', 'a link works only once');
  });
  await it('2. student B signs up with another e-mail; the same e-mail cannot be used twice', async () => {
    const dup = await B.post('/api/auth/signup', { name: 'สมหญิง', email: 'a.student@example.com', password: 'Netlab2026', password2: 'Netlab2026', accept: true });
    assert.strictEqual(dup.error, 'dup_email');
    await B.post('/api/auth/signup', { name: 'สมหญิง รักเรียน', email: 'b.student@example.com', password: 'Netlab2026b', password2: 'Netlab2026b', accept: true });
    await B.post('/api/auth/resend-verify', { email: 'b.student@example.com' });
    const ms = mails().filter(m => m.to === 'b.student@example.com'); assert.strictEqual(ms.length, 2);
    assert.strictEqual((await B.post('/api/auth/verify', { token: linkToken(ms[0], 'verify') })).error, 'bad_token', 'older link stops working after a resend');
    assert.strictEqual((await B.post('/api/auth/verify', { token: linkToken(ms[1], 'verify') })).ok, true);
  });
  await it('sign-up never grants teacher/admin even if the request asks for it', async () => {
    const r = await guest.post('/api/auth/signup', { name: 'แอบเป็นครู', email: 'x.teacher@example.com', password: 'Netlab2026', password2: 'Netlab2026', accept: true, role: 'teacher' });
    assert.strictEqual(r.ok, true);
    assert.strictEqual((await pool.query("SELECT role FROM users WHERE email='x.teacher@example.com'")).rows[0].role, 'student');
    const p = await A.patch('/api/account/profile', { role: 'admin', displayName: 'สมชาย' }); assert.strictEqual(p.role, 'student');
  });

  console.log('Google sign-in (fake provider speaking OpenID Connect)');
  let cId;
  await it('3. student C signs in with Google the first time: a student account is created from verified claims', async () => {
    fake.setNext({ sub: '1100000000000000000003', email: 'c.student@gmail.com', name: 'ชัยวัฒน์ กูเกิล', picture: 'https://lh3.googleusercontent.com/a/x' });
    assert.strictEqual(await C.google(), 'new');
    const me = await C.get('/api/me'); assert.strictEqual(me.user.email, 'c.student@gmail.com'); assert.strictEqual(me.user.role, 'student'); assert.strictEqual(me.user.signupMethod, 'google');
    assert.strictEqual(me.user.hasPassword, false); cId = me.user.id;
    const auth = fake.log.filter(x => x.path === '/auth').pop().q; assert.strictEqual(auth.code_challenge_method, 'S256'); assert(auth.nonce && auth.state); assert.strictEqual(auth.scope, 'openid email profile');
    assert(!JSON.stringify(auth).includes(fake.clientSecret), 'client secret never in the browser redirect');
  });
  await it('4–5. C signs in with Google again (another device): same account, no duplicate', async () => {
    const C2 = client(); fake.setNext({ sub: '1100000000000000000003', email: 'c.student@gmail.com', name: 'ชัยวัฒน์ กูเกิล' });
    assert.strictEqual(await C2.google(), 'ok'); assert.strictEqual((await C2.get('/api/me')).user.id, cId);
    const n = (await pool.query("SELECT count(*)::int n FROM users WHERE email='c.student@gmail.com'")).rows[0].n; assert.strictEqual(n, 1);
    assert.strictEqual((await pool.query("SELECT count(*)::int n FROM auth_identities WHERE provider='google' AND subject='1100000000000000000003'")).rows[0].n, 1);
  });
  await it('13. different Google accounts get different NetLab accounts', async () => {
    fake.setNext({ sub: '1100000000000000000004', email: 'd.student@gmail.com', name: 'ดวงใจ' });
    assert.strictEqual(await D.google(), 'new'); const d = (await D.get('/api/me')).user; assert.notStrictEqual(d.id, cId); assert.strictEqual(d.email, 'd.student@gmail.com');
  });
  await it('Google with an address that already has a NetLab account is NOT merged by e-mail text', async () => {
    const X = client(); fake.setNext({ sub: '1100000000000000000009', email: 'a.student@example.com', name: 'ใครก็ได้' });
    assert.strictEqual(await X.google(), 'email_taken'); assert.strictEqual((await X.get('/api/me')).user, null);
    assert.strictEqual((await pool.query("SELECT count(*)::int n FROM auth_identities WHERE subject='1100000000000000000009'")).rows[0].n, 0);
  });
  await it('A links Google from inside the signed-in account (both sides proven), then Google opens A', async () => {
    fake.setNext({ sub: '1100000000000000000009', email: 'a.student@example.com', name: 'สมชาย' });
    assert.strictEqual(await A.google('link'), 'linked');
    assert.deepStrictEqual((await A.get('/api/account/profile')).google, [{ email: 'a.student@example.com' }]);
    const X = client(); assert.strictEqual(await X.google(), 'ok'); assert.strictEqual((await X.get('/api/me')).user.id, aId);
    fake.setNext({ sub: '1100000000000000000003', email: 'c.student@gmail.com' });
    assert.strictEqual(await B.google('link'), 'link_conflict', 'a Google account already used by C cannot be linked to B');
    assert.strictEqual(await guest.google('link'), 'login_first');
  });
  await it('tampered or failed Google responses are rejected (nonce, audience, signature, cancel, unverified e-mail, bad state)', async () => {
    for (const [w, code] of [[{ tamper: 'nonce' }, 'google_error'], [{ tamper: 'aud' }, 'google_error'], [{ tamper: 'sig' }, 'google_error'], [{ cancel: true }, 'cancelled'], [{ email_verified: false }, 'unverified_email']]) {
      const X = client(); fake.setNext({ sub: '12' + Math.random().toString().slice(2, 12), email: 'z' + Math.random().toString(36).slice(2, 7) + '@gmail.com', name: 'z', ...w });
      assert.strictEqual(await X.google(), code, JSON.stringify(w)); assert.strictEqual((await X.get('/api/me')).user, null);
    }
    const X = client(); const r = await X.raw('/api/auth/google/callback?code=abc&state=forged'); assert.strictEqual(r.headers.get('location'), '/#/auth-result/state');
  });

  console.log('Scores belong to one account only');
  let classCode;
  await it('6–8. A takes the pre-test; B cannot see it; A on another device sees the same score', async () => {
    const r = await A.post('/api/lessons/w1/quiz', { kind: 'pre', answers: W1.quiz.map(right) }); assert.strictEqual(r.score, 10);
    assert(!(await B.get('/api/me')).lessons.w1 || !(await B.get('/api/me')).lessons.w1.pre, 'B does not see A');
    const l = await A2.post('/api/auth/login', { username: 'a.student@example.com', password: 'Netlab2026' }); assert.strictEqual(l.ok, true);
    assert.strictEqual((await A2.get('/api/me')).lessons.w1.pre.score, 10);
  });
  await it('15. a student cannot read other accounts: teacher/admin APIs refused, ids in the body ignored', async () => {
    assert.strictEqual((await B.get('/api/teacher/classes')).status, 403);
    assert.strictEqual((await B.get('/api/admin/teachers')).status, 403);
    const ex = await (await B.raw('/api/account/export')).json(); assert.strictEqual(ex.profile.email, 'b.student@example.com'); assert.strictEqual(ex.quizzes.length, 0);
    await B.patch('/api/account/profile', { id: aId, userId: aId, displayName: 'บีเปลี่ยนชื่อ' });
    assert.strictEqual((await A.get('/api/account/profile')).displayName, 'สมชาย');
  });
  await it('9–10. A signed up without a class code and joins the teacher\'s class later; scores stay', async () => {
    await admin.post('/api/auth/login', { username: 'admin', password: 'admin-pass-123' });
    const t = await admin.post('/api/admin/teachers', { username: 'kru.acct', name: 'ครูบัญชี' });
    await T.post('/api/auth/login', { username: 'kru.acct', password: t.password }); await T.post('/api/auth/password', { current: t.password, next: 'Teach2026x' });
    const c = await T.post('/api/teacher/classes', { name: 'ปวช.2/9' }); classCode = c.code || (await T.get('/api/teacher/classes')).classes[0].code;
    assert.strictEqual((await A.post('/api/account/class/join', { code: 'NOPE00' })).error, 'bad_code');
    const j = await A.post('/api/account/class/join', { code: classCode.toLowerCase(), studentNo: '7' }); assert.strictEqual(j.ok, true);
    const cls = (await T.get('/api/teacher/classes')).classes[0]; const det = await T.get(`/api/teacher/classes/${cls.id}`);
    const row = det.students.find(s => s.id === aId); assert(row && row.method === 'email' && row.no === '7');
    assert.strictEqual((await B.post('/api/account/class/join', { code: classCode, studentNo: '7' })).error, 'dup_no');
    await A.patch('/api/account/profile', { displayName: 'สมชาย (ชื่อเล่น)', fullName: 'สมชาย ใจดี', studentCode: '66201-007', gradeLevel: 'ปวช.2', roomName: '2/9', avatar: 'c3' });
    assert.strictEqual((await A.get('/api/me')).lessons.w1.pre.score, 10, 'renaming keeps scores');
    const other = await T.get(`/api/teacher/classes/${cls.id}`); assert(!other.students.some(s => s.id === cId), 'teacher sees only students in own class');
  });
  await it('11. guest progress can be imported into the new account', async () => {
    const lab = require('../content/labs').ALL.find(r => !r.exit);
    const task = lab.tasks[0]; const key = `${lab.id}:0`;
    const ans = task.type === 'text' ? task.answers[0] : task.type === 'choice' ? task.correct : null;
    if (ans === null) return;
    const r = await B.post('/api/account/import-guest', { labs: { [lab.id]: { tasks: { [key]: { answer: ans, attempts: 0, hint: false } } } } });
    assert(r.status === 200 || r.ok !== undefined, JSON.stringify(r).slice(0, 200));
  });

  console.log('Passwords, sessions and deletion');
  await it('12. forgot password by e-mail: link resets the password and signs out every device', async () => {
    const r = await guest.post('/api/auth/forgot-email', { email: 'a.student@example.com' }); assert.strictEqual(r.ok, true);
    const none = await guest.post('/api/auth/forgot-email', { email: 'nobody@example.com' }); assert.strictEqual(none.message, r.message, 'same reply for unknown addresses');
    const m = lastMailTo('a.student@example.com'); assert(/รหัสผ่าน/.test(m.subject));
    assert.strictEqual((await guest.post('/api/auth/reset', { token: linkToken(m, 'reset'), password: 'New2026pass', password2: 'Other2026' })).error, 'mismatch');
    const ok = await guest.post('/api/auth/reset', { token: linkToken(m, 'reset'), password: 'New2026pass', password2: 'New2026pass' }); assert.strictEqual(ok.ok, true);
    assert.strictEqual((await A2.get('/api/me')).user, null, 'old device signed out');
    assert.strictEqual((await A2.post('/api/auth/login', { username: 'a.student@example.com', password: 'Netlab2026' })).error, 'bad_login');
    assert.strictEqual((await A2.post('/api/auth/login', { username: 'a.student@example.com', password: 'New2026pass' })).ok, true);
    assert.strictEqual((await guest.post('/api/auth/reset', { token: linkToken(m, 'reset'), password: 'New2026pass', password2: 'New2026pass' })).error, 'bad_token');
  });
  await it('14. expired sessions are refused; "sign out everywhere" works', async () => {
    await pool.query('UPDATE sessions SET expires_at=now() - interval \'1 minute\' WHERE user_id=$1', [cId]);
    assert.strictEqual((await C.get('/api/me')).user, null);
    await A.post('/api/auth/login', { username: 'a.student@example.com', password: 'New2026pass' });
    assert.strictEqual((await A.post('/api/auth/logout-all')).ok, true);
    assert.strictEqual((await A2.get('/api/me')).user, null); assert.strictEqual((await A.get('/api/me')).user, null);
  });
  await it('old scrypt password hashes still work and are upgraded to Argon2id at login', async () => {
    const crypto = require('crypto'); const salt = crypto.randomBytes(16);
    const h = `scrypt$${salt.toString('base64')}$${crypto.scryptSync('Legacy2024', salt, 64, { N: 16384, r: 8, p: 1 }).toString('base64')}`;
    await pool.query("INSERT INTO users(username,password_hash,display_name,role) VALUES('legacy.s',$1,'นักเรียนเก่า','student')", [h]);
    const L = client(); assert.strictEqual((await L.post('/api/auth/login', { username: 'legacy.s', password: 'Legacy2024' })).ok, true);
    assert((await pool.query("SELECT password_hash FROM users WHERE username='legacy.s'")).rows[0].password_hash.startsWith('$argon2id$'));
    assert.strictEqual((await client().post('/api/auth/login', { username: 'legacy.s', password: 'Legacy2024' })).ok, true);
  });
  await it('Google-only account: can set a first password soon after signing in; cannot unlink its only method', async () => {
    fake.setNext({ sub: '1100000000000000000004', email: 'd.student@gmail.com' }); await D.google();
    assert.strictEqual((await D.post('/api/account/google/unlink')).error, 'last_method');
    assert.strictEqual((await D.post('/api/account/password', { next: 'Dpass2026' })).ok, true);
    assert.strictEqual((await client().post('/api/auth/login', { username: 'd.student@gmail.com', password: 'Dpass2026' })).ok, true);
  });
  await it('a student deletes the account: profile and every score are removed; teachers cannot self-delete', async () => {
    await B.post('/api/lessons/w1/quiz', { kind: 'pre', answers: W1.quiz.map(right) });
    assert.strictEqual((await B.post('/api/account/delete', { confirm: 'ลบ', password: 'Netlab2026b' })).error, 'confirm');
    assert.strictEqual((await B.post('/api/account/delete', { confirm: 'ลบบัญชี', password: 'wrong' })).error, 'bad_current');
    const bid = (await B.get('/api/me')).user.id;
    assert.strictEqual((await B.post('/api/account/delete', { confirm: 'ลบบัญชี', password: 'Netlab2026b' })).ok, true);
    for (const t of ['users WHERE id', 'quiz_attempts WHERE user_id', 'sessions WHERE user_id']) assert.strictEqual((await pool.query(`SELECT count(*)::int n FROM ${t}=$1`, [bid])).rows[0].n, 0, t);
    assert.strictEqual((await T.post('/api/account/delete', { confirm: 'ลบบัญชี', password: 'Teach2026x' })).status, 403);
  });
  await it('existing accounts (teacher-made usernames, class-code sign-up) keep working', async () => {
    const r = await guest.post('/api/auth/register', { classCode, username: 'classcode.s', name: 'นักเรียน รหัสห้อง', studentNo: '12', password: 'Class2026' });
    assert.strictEqual(r.ok, true);
    const L = client(); assert.strictEqual((await L.post('/api/auth/login', { username: 'classcode.s', password: 'Class2026' })).ok, true);
    assert.strictEqual((await L.get('/api/me')).user.class.code, classCode);
  });

  console.log(`\n${passed} passed`);
  await pool.end(); await fake.close(); server.close(); setTimeout(() => process.exit(process.exitCode || 0), 100);
})().catch(e => { console.error(e); process.exit(1); });

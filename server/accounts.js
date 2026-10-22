'use strict';
/* 2.7 personal accounts: e-mail sign-up with verification, password reset by e-mail, Google sign-in and linking,
   profile, joining a class later, sign out everywhere, data export and account deletion.
   Every route works on req.user from the server session only; ids in the request body are never trusted. */
const express = require('express');
const crypto = require('crypto');
const dns = require('dns').promises;
const db = require('./db');
const auth = require('./auth');
const mailer = require('./mailer');
const google = require('./google-oidc');

const ok = (res, d) => res.json(d);
const fail = (res, code, error, message) => res.status(code).json({ error, message });
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const router = express.Router();
const PROD = process.env.NODE_ENV === 'production';

/* ---------- helpers ---------- */
const normEmail = e => String(e || '').trim().toLowerCase().slice(0, 160);
const EMAIL_RX = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;
async function emailProblem(email) {
  if (!EMAIL_RX.test(email)) return 'รูปแบบอีเมลไม่ถูกต้อง ตัวอย่าง: somchai@gmail.com';
  if (process.env.EMAIL_MX_CHECK === '0') return null;
  const domain = email.split('@')[1];
  try {
    const mx = await Promise.race([dns.resolveMx(domain), new Promise((_, rej) => setTimeout(() => rej(Object.assign(new Error('t'), { code: 'TIMEOUT' })), 3000))]);
    if (!mx || !mx.length) return 'โดเมนของอีเมลนี้รับอีเมลไม่ได้ ตรวจสอบการสะกด หรือใช้อีเมลอื่น';
  } catch (e) {
    if (['ENOTFOUND', 'ENODATA', 'ESERVFAIL'].includes(e.code)) return 'โดเมนของอีเมลนี้รับอีเมลไม่ได้ ตรวจสอบการสะกด หรือใช้อีเมลอื่น';
    // network problems: let it pass, the verification link still proves the address
  }
  return null;
}
const newUsername = p => p + crypto.randomBytes(5).toString('hex');
const tokenOf = () => crypto.randomBytes(32).toString('base64url');
async function issueToken(userId, purpose, minutes) {
  const t = tokenOf();
  await db.q(`UPDATE email_tokens SET used_at=now() WHERE user_id=$1 AND purpose=$2 AND used_at IS NULL`, [userId, purpose]);   // only the newest link works
  await db.q(`INSERT INTO email_tokens(token_hash,user_id,purpose,expires_at) VALUES($1,$2,$3, now() + make_interval(mins => $4))`, [auth.sha(t), userId, purpose, minutes]);
  return t;
}
async function useToken(token, purpose) {
  const r = await db.q(`UPDATE email_tokens SET used_at=now() WHERE token_hash=$1 AND purpose=$2 AND used_at IS NULL AND expires_at>now() RETURNING user_id`, [auth.sha(String(token || '')), purpose]);
  return r.rows[0] ? r.rows[0].user_id : null;
}
/* per-address throttle for mails (on top of per-IP limits): 3 per 30 minutes */
const mailHits = new Map();
function mailAllowed(key) {
  const now = Date.now(), h = (mailHits.get(key) || []).filter(t => now - t < 30 * 60000);
  if (h.length >= 3) { mailHits.set(key, h); return false; }
  h.push(now); mailHits.set(key, h);
  if (mailHits.size > 5000) for (const [k, v] of mailHits) if (!v.some(t => now - t < 30 * 60000)) mailHits.delete(k);
  return true;
}
async function sendVerify(req, u) {
  const t = await issueToken(u.id, 'verify', 24 * 60);
  const m = mailer.verifyMail(u.display_name, `${mailer.baseUrl(req)}/#/verify/${t}`);
  await mailer.send({ to: u.email, ...m });
}
/* unverified e-mail sign-ups that were never confirmed are removed after 7 days (they cannot have any data) */
async function cleanupPending() {
  await db.q(`DELETE FROM users WHERE signup_method='email' AND email_verified_at IS NULL AND created_at < now() - interval '7 days'
              AND NOT EXISTS (SELECT 1 FROM sessions s WHERE s.user_id=users.id)`);
  await db.q(`DELETE FROM email_tokens WHERE expires_at < now() - interval '1 day'`);
}
let lastCleanup = 0;
const maybeCleanup = () => { if (Date.now() - lastCleanup > 3600000) { lastCleanup = Date.now(); cleanupPending().catch(e => console.error('cleanup', e.message)); } };

/* ---------- configuration the login page needs ---------- */
const linksReady = () => !PROD || !!process.env.PUBLIC_URL;   // in production every link is built from PUBLIC_URL
router.get('/auth/config', (req, res) => ok(res, { db: db.enabled(), email: db.enabled() && mailer.enabled() && linksReady(), google: db.enabled() && google.enabled() && linksReady() }));

/* ---------- e-mail sign-up ---------- */
router.post('/auth/signup', auth.requireDb, auth.rateLimit(5, 30), wrap(async (req, res) => {
  maybeCleanup();
  if (!mailer.enabled() || !linksReady()) return fail(res, 503, 'no_mail', 'ระบบส่งอีเมลยังไม่ได้ตั้งค่า จึงยังสมัครด้วยอีเมลไม่ได้ ใช้ "ดำเนินการต่อด้วย Google" หรือรหัสห้องจากครูแทน');
  const name = String(req.body.name || '').trim().replace(/\s+/g, ' ').slice(0, 60);
  const email = normEmail(req.body.email);
  const pw = String(req.body.password || ''), pw2 = String(req.body.password2 || '');
  if (name.length < 2) return fail(res, 400, 'bad_name', 'กรอกชื่อที่ใช้แสดงในระบบ อย่างน้อย 2 ตัวอักษร');
  const ep = await emailProblem(email); if (ep) return fail(res, 400, 'bad_email', ep);
  const pp = auth.passwordProblem(pw); if (pp) return fail(res, 400, 'bad_password', pp);
  if (pw !== pw2) return fail(res, 400, 'mismatch', 'รหัสผ่านทั้งสองช่องไม่ตรงกัน');
  if (req.body.accept !== true) return fail(res, 400, 'terms', 'กรุณาอ่านและยอมรับเงื่อนไขการใช้งานและนโยบายความเป็นส่วนตัว');
  if (!mailAllowed('s:' + email)) return fail(res, 429, 'rate', 'ส่งอีเมลไปที่อยู่นี้หลายครั้งแล้ว รอ 30 นาทีแล้วลองใหม่');
  const ex = (await db.q('SELECT id, email_verified_at, signup_method FROM users WHERE email=$1', [email])).rows[0];
  if (ex && (ex.email_verified_at || ex.signup_method !== 'email')) return fail(res, 409, 'dup_email', 'อีเมลนี้มีบัญชี NetLab แล้ว ลองเข้าสู่ระบบ หรือกด "ลืมรหัสผ่าน"');
  const hash = await auth.hashPassword(pw);
  let u;
  if (ex) {   // pending sign-up that was never verified: start again with the new details
    u = (await db.q(`UPDATE users SET display_name=$2, password_hash=$3, terms_accepted_at=now() WHERE id=$1 RETURNING id, display_name, email`, [ex.id, name, hash])).rows[0];
  } else {
    u = (await db.q(`INSERT INTO users(username,password_hash,display_name,role,email,signup_method,terms_accepted_at)
                     VALUES($1,$2,$3,'student',$4,'email',now()) RETURNING id, display_name, email`, [newUsername('u'), hash, name, email])).rows[0];
  }
  try { await sendVerify(req, u); }
  catch (e) { console.error('verify mail failed:', e.message); return fail(res, 502, 'mail_failed', 'สร้างบัญชีแล้ว แต่ส่งอีเมลยืนยันไม่สำเร็จ ลองกด "ส่งลิงก์ยืนยันอีกครั้ง" ภายหลัง'); }
  ok(res, { ok: true, email, message: `ส่งลิงก์ยืนยันไปที่ ${email} แล้ว เปิดอีเมลแล้วกดลิงก์ภายใน 24 ชั่วโมงเพื่อเริ่มใช้งาน (ถ้าไม่เห็น ลองดูในโฟลเดอร์จดหมายขยะ)` });
}));

router.post('/auth/resend-verify', auth.requireDb, auth.rateLimit(3, 20), wrap(async (req, res) => {
  const email = normEmail(req.body.email);
  const generic = { ok: true, message: 'ถ้าอีเมลนี้สมัครไว้และยังไม่ได้ยืนยัน ระบบได้ส่งลิงก์ใหม่ให้แล้ว' };
  if (!mailer.enabled() || !EMAIL_RX.test(email)) return ok(res, generic);
  const u = (await db.q(`SELECT id, display_name, email FROM users WHERE email=$1 AND email_verified_at IS NULL AND signup_method='email' AND NOT disabled`, [email])).rows[0];
  if (u && mailAllowed('v:' + email)) { try { await sendVerify(req, u); } catch (e) { console.error('resend failed:', e.message); } }
  ok(res, generic);
}));

/* the link opens #/verify/<token>; the page POSTs here (a GET would let mail scanners use the link up) */
router.post('/auth/verify', auth.requireDb, auth.rateLimit(10, 60), wrap(async (req, res) => {
  const uid = await useToken(req.body.token, 'verify');
  if (!uid) return fail(res, 400, 'bad_token', 'ลิงก์ยืนยันใช้ไม่ได้ อาจหมดอายุหรือถูกใช้ไปแล้ว ลองเข้าสู่ระบบ หรือขอลิงก์ใหม่');
  await db.q('UPDATE users SET email_verified_at=COALESCE(email_verified_at, now()) WHERE id=$1', [uid]);
  await auth.createSession(req, res, uid);
  ok(res, { ok: true, message: 'ยืนยันอีเมลเรียบร้อย ยินดีต้อนรับสู่ NetLab' });
}));

/* ---------- password reset by e-mail (accounts with a verified e-mail); username-only accounts keep the teacher flow ---------- */
router.post('/auth/forgot-email', auth.requireDb, auth.rateLimit(5, 40), wrap(async (req, res) => {
  const email = normEmail(req.body.email);
  const generic = { ok: true, message: 'ถ้าอีเมลนี้มีบัญชี NetLab ระบบได้ส่งลิงก์ตั้งรหัสผ่านใหม่ให้แล้ว ลิงก์ใช้ได้ 30 นาที' };
  if (!EMAIL_RX.test(email)) return fail(res, 400, 'bad_email', 'รูปแบบอีเมลไม่ถูกต้อง');
  if (!mailer.enabled()) return fail(res, 503, 'no_mail', 'ระบบส่งอีเมลยังไม่ได้ตั้งค่า ติดต่อครูผู้สอนเพื่อรีเซ็ตรหัสผ่าน');
  const u = (await db.q(`SELECT id, display_name, email FROM users WHERE email=$1 AND email_verified_at IS NOT NULL AND NOT disabled AND role<>'admin'`, [email])).rows[0];
  if (u && mailAllowed('r:' + email)) {
    try { const t = await issueToken(u.id, 'reset', 30); await mailer.send({ to: u.email, ...mailer.resetMail(u.display_name, `${mailer.baseUrl(req)}/#/reset/${t}`) }); }
    catch (e) { console.error('reset mail failed:', e.message); }
  }
  ok(res, generic);
}));

router.post('/auth/reset', auth.requireDb, auth.rateLimit(10, 60), wrap(async (req, res) => {
  const pw = String(req.body.password || ''), pw2 = String(req.body.password2 || '');
  const pp = auth.passwordProblem(pw); if (pp) return fail(res, 400, 'bad_password', pp);
  if (pw !== pw2) return fail(res, 400, 'mismatch', 'รหัสผ่านทั้งสองช่องไม่ตรงกัน');
  const uid = await useToken(req.body.token, 'reset');
  if (!uid) return fail(res, 400, 'bad_token', 'ลิงก์ตั้งรหัสผ่านใช้ไม่ได้ อาจหมดอายุ (30 นาที) หรือถูกใช้ไปแล้ว ขอลิงก์ใหม่ได้ที่ "ลืมรหัสผ่าน"');
  await db.q('UPDATE users SET password_hash=$2, must_change_pw=false WHERE id=$1', [uid, await auth.hashPassword(pw)]);
  await auth.destroyAllSessions(uid);   // every device signed out
  await db.q('UPDATE reset_requests SET resolved_at=now() WHERE user_id=$1 AND resolved_at IS NULL', [uid]);
  await auth.createSession(req, res, uid);
  ok(res, { ok: true, message: 'ตั้งรหัสผ่านใหม่แล้ว อุปกรณ์อื่นที่เคยเข้าสู่ระบบไว้ถูกออกจากระบบทั้งหมด' });
}));

/* ---------- Google ---------- */
const STATE_COOKIE_ATTRS = req => `Path=/api/auth/google; HttpOnly; SameSite=Lax; Max-Age=600${(req.secure || req.headers['x-forwarded-proto'] === 'https') ? '; Secure' : ''}`;
const back = (res, code) => res.redirect(303, `/#/auth-result/${code}`);
router.get('/auth/google/start', auth.rateLimit(20, 200), wrap(async (req, res) => {
  if (!db.enabled() || !google.enabled() || !linksReady()) return back(res, 'google_off');
  const mode = req.query.mode === 'link' ? 'link' : 'login';
  if (mode === 'link' && !req.user) return back(res, 'login_first');
  const { url, cookie } = google.begin({ redirectUri: mailer.baseUrl(req) + '/api/auth/google/callback', mode, uid: mode === 'link' ? req.user.id : null });
  res.setHeader('Set-Cookie', `${google.STATE_COOKIE}=${cookie}; ${STATE_COOKIE_ATTRS(req)}`);
  res.redirect(302, url);
}));

router.get('/auth/google/callback', auth.rateLimit(20, 200), wrap(async (req, res) => {
  const st = google.unpackState(auth.parseCookies(req.headers.cookie)[google.STATE_COOKIE]);
  res.setHeader('Set-Cookie', `${google.STATE_COOKIE}=; ${STATE_COOKIE_ATTRS(req)}; Max-Age=0`);
  if (req.query.error) return back(res, 'cancelled');
  if (!st || !req.query.state || req.query.state !== st.state || !req.query.code) return back(res, 'state');
  let claims;
  try { claims = await google.finish({ code: String(req.query.code), verifier: st.verifier, nonce: st.nonce, redirectUri: mailer.baseUrl(req) + '/api/auth/google/callback' }); }
  catch (e) { console.error('google sign-in failed:', e.message); return back(res, 'google_error'); }
  const sub = String(claims.sub), email = claims.email_verified === true || claims.email_verified === 'true' ? normEmail(claims.email) : null;
  const ident = (await db.q(`SELECT i.user_id, u.disabled FROM auth_identities i JOIN users u ON u.id=i.user_id WHERE provider='google' AND subject=$1`, [sub])).rows[0];

  if (st.mode === 'link') {
    if (!req.user || req.user.id !== st.uid) return back(res, 'login_first');
    if (ident && ident.user_id !== req.user.id) return back(res, 'link_conflict');
    if (!ident) await db.q(`INSERT INTO auth_identities(provider,subject,user_id,email,last_used_at) VALUES('google',$1,$2,$3,now())`, [sub, req.user.id, email]);
    // the Google address is now proven for this account: record it if the account has no e-mail yet and nobody else uses it
    if (email && !req.user.email) await db.q(`UPDATE users SET email=$2, email_verified_at=now() WHERE id=$1 AND NOT EXISTS (SELECT 1 FROM users WHERE email=$2)`, [req.user.id, email]);
    await db.q(`UPDATE users SET avatar_url=$2 WHERE id=$1`, [req.user.id, claims.picture ? String(claims.picture).slice(0, 500) : null]);
    return back(res, 'linked');
  }

  if (ident) {   // returning Google user: same account every time
    if (ident.disabled) return back(res, 'disabled');
    await db.q(`UPDATE auth_identities SET last_used_at=now() WHERE provider='google' AND subject=$1`, [sub]);
    if (claims.picture) await db.q(`UPDATE users SET avatar_url=$2 WHERE id=$1`, [ident.user_id, String(claims.picture).slice(0, 500)]);
    await auth.createSession(req, res, ident.user_id);
    return back(res, 'ok');
  }
  if (!email) return back(res, 'unverified_email');
  const owner = (await db.q('SELECT id, email_verified_at, signup_method FROM users WHERE email=$1', [email])).rows[0];
  if (owner && (owner.email_verified_at || owner.signup_method !== 'email')) return back(res, 'email_taken');   // never merge by e-mail text: link from inside that account
  if (owner) await db.q('DELETE FROM users WHERE id=$1 AND email_verified_at IS NULL', [owner.id]);   // unconfirmed sign-up with this address (no data possible)
  const name = String(claims.name || email.split('@')[0]).trim().slice(0, 60) || 'นักเรียน';
  const u = (await db.q(`INSERT INTO users(username,password_hash,display_name,full_name,role,email,email_verified_at,signup_method,terms_accepted_at,avatar_url,avatar)
                         VALUES($1,$2,$3,$4,'student',$5,now(),'google',now(),$6,$7) RETURNING id`,
    [newUsername('g'), auth.NO_PASSWORD, name, String(claims.name || '').slice(0, 80) || null, email, claims.picture ? String(claims.picture).slice(0, 500) : null, claims.picture ? 'google' : null])).rows[0];
  await db.q(`INSERT INTO auth_identities(provider,subject,user_id,email,last_used_at) VALUES('google',$1,$2,$3,now())`, [sub, u.id, email]);
  await auth.createSession(req, res, u.id);
  back(res, 'new');
}));

/* ---------- signed-in account ---------- */
const me = [auth.requireDb, auth.requireUser];
const AVATARS = ['c0', 'c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'google'];
async function profileOf(uid) {
  const u = (await db.q(`SELECT u.id,u.username,u.display_name,u.full_name,u.role,u.email,u.email_verified_at,u.student_code,u.grade_level,u.room_name,u.student_no,
                                u.avatar,u.avatar_url,u.signup_method,u.created_at,u.password_hash<>'!' AS has_password,c.id AS class_id,c.name AS class_name,c.code AS class_code
                           FROM users u LEFT JOIN classes c ON c.id=u.class_id WHERE u.id=$1`, [uid])).rows[0];
  const ids = (await db.q(`SELECT provider, email FROM auth_identities WHERE user_id=$1`, [uid])).rows;
  return {
    username: u.username, displayName: u.display_name, fullName: u.full_name || '', role: u.role,
    email: u.email, emailVerified: !!u.email_verified_at, studentCode: u.student_code || '', gradeLevel: u.grade_level || '', roomName: u.room_name || '',
    studentNo: u.student_no || '', avatar: u.avatar || 'c0', avatarUrl: u.avatar === 'google' ? u.avatar_url : null, hasGooglePhoto: !!u.avatar_url,
    signupMethod: u.signup_method || 'teacher', hasPassword: u.has_password, createdAt: +u.created_at,
    class: u.class_id ? { id: u.class_id, name: u.class_name, code: u.class_code } : null,
    google: ids.filter(i => i.provider === 'google').map(i => ({ email: i.email })), googleEnabled: google.enabled()
  };
}
router.get('/account/profile', ...me, wrap(async (req, res) => ok(res, await profileOf(req.user.id))));
router.patch('/account/profile', ...me, auth.rateLimit(20, 200), wrap(async (req, res) => {
  const b = req.body || {}, set = [], val = [req.user.id];
  const put = (col, v) => { val.push(v); set.push(`${col}=$${val.length}`); };
  const txt = (v, n) => String(v == null ? '' : v).trim().replace(/\s+/g, ' ').slice(0, n);
  if (b.displayName != null) { const v = txt(b.displayName, 60); if (v.length < 2) return fail(res, 400, 'bad_name', 'ชื่อที่แสดงต้องมีอย่างน้อย 2 ตัวอักษร'); put('display_name', v); }
  if (b.fullName != null) put('full_name', txt(b.fullName, 80) || null);
  if (b.studentCode != null) { const v = txt(b.studentCode, 20); if (v && !/^[A-Za-z0-9-]{3,20}$/.test(v)) return fail(res, 400, 'bad_code', 'รหัสนักเรียนใช้ได้เฉพาะตัวอักษรภาษาอังกฤษ ตัวเลข และขีด'); put('student_code', v || null); }
  if (b.gradeLevel != null) put('grade_level', txt(b.gradeLevel, 30) || null);
  if (b.roomName != null) put('room_name', txt(b.roomName, 30) || null);
  if (b.avatar != null) { if (!AVATARS.includes(b.avatar)) return fail(res, 400, 'bad_avatar', 'ไม่มีรูปแบบนี้'); put('avatar', b.avatar); }
  if (set.length) await db.q(`UPDATE users SET ${set.join(', ')} WHERE id=$1`, val);   // scores are keyed by id, so nothing else changes
  ok(res, await profileOf(req.user.id));
}));

/* join a class with the code from the teacher (any time after sign-up); changing class keeps all scores */
router.post('/account/class/join', ...me, auth.rateLimit(10, 60), wrap(async (req, res) => {
  if (req.user.role !== 'student') return fail(res, 403, 'forbidden', 'เฉพาะบัญชีนักเรียน');
  const code = String(req.body.code || '').trim().toUpperCase();
  const no = String(req.body.studentNo || '').trim();
  const c = (await db.q('SELECT id, name, join_open FROM classes WHERE code=$1', [code])).rows[0];
  if (!c) return fail(res, 400, 'bad_code', 'ไม่พบรหัสห้องนี้ ตรวจสอบกับครูอีกครั้ง');
  if (!c.join_open) return fail(res, 400, 'closed', 'ห้องนี้ปิดรับนักเรียนใหม่แล้ว ติดต่อครูผู้สอน');
  if (no && !/^\d{1,3}$/.test(no)) return fail(res, 400, 'bad_no', 'เลขที่ต้องเป็นตัวเลข 1–3 หลัก');
  if (no && (await db.q(`SELECT 1 FROM users WHERE class_id=$1 AND student_no=$2 AND role='student' AND NOT disabled AND id<>$3`, [c.id, no, req.user.id])).rowCount)
    return fail(res, 409, 'dup_no', 'เลขที่นี้มีนักเรียนในห้องแล้ว ตรวจสอบเลขที่อีกครั้ง หรือเว้นว่างไว้แล้วแจ้งครู');
  await db.q('UPDATE users SET class_id=$2, student_no=$3 WHERE id=$1', [req.user.id, c.id, no || null]);
  ok(res, { ok: true, class: { id: c.id, name: c.name }, message: `เข้าร่วมห้อง ${c.name} แล้ว ครูผู้สอนจะเห็นความก้าวหน้าของคุณ` });
}));
router.post('/account/class/leave', ...me, wrap(async (req, res) => {
  if (req.user.role !== 'student') return fail(res, 403, 'forbidden', 'เฉพาะบัญชีนักเรียน');
  await db.q('UPDATE users SET class_id=NULL, student_no=NULL WHERE id=$1', [req.user.id]);
  ok(res, { ok: true });
}));

/* set a first password (Google-only accounts) or change it */
router.post('/account/password', ...me, auth.rateLimit(10, 60), wrap(async (req, res) => {
  const u = (await db.q('SELECT password_hash FROM users WHERE id=$1', [req.user.id])).rows[0];
  const hasPw = u.password_hash !== auth.NO_PASSWORD;
  if (hasPw && !(await auth.verifyPassword(String(req.body.current || ''), u.password_hash))) return fail(res, 400, 'bad_current', 'รหัสผ่านเดิมไม่ถูกต้อง');
  if (!hasPw && Date.now() - +req.user.session_at > 15 * 60000) return fail(res, 401, 'reauth', 'เพื่อความปลอดภัย กรุณาเข้าสู่ระบบด้วย Google อีกครั้งก่อนตั้งรหัสผ่าน');
  const pp = auth.passwordProblem(req.body.next); if (pp) return fail(res, 400, 'bad_password', pp);
  await db.q('UPDATE users SET password_hash=$1, must_change_pw=false WHERE id=$2', [await auth.hashPassword(req.body.next), req.user.id]);
  await auth.destroyOtherSessions(req);
  ok(res, { ok: true });
}));
router.post('/account/google/unlink', ...me, wrap(async (req, res) => {
  const u = (await db.q('SELECT password_hash FROM users WHERE id=$1', [req.user.id])).rows[0];
  if (u.password_hash === auth.NO_PASSWORD) return fail(res, 400, 'last_method', 'ตั้งรหัสผ่านก่อน เพราะตอนนี้ Google เป็นวิธีเข้าสู่ระบบเดียวของบัญชีนี้');
  await db.q(`DELETE FROM auth_identities WHERE user_id=$1 AND provider='google'`, [req.user.id]);
  ok(res, { ok: true });
}));
router.post('/auth/logout-all', ...me, wrap(async (req, res) => {
  await auth.destroyAllSessions(req.user.id);
  await auth.destroySession(req, res);
  ok(res, { ok: true });
}));

/* a copy of everything stored about me (PDPA-style access request) */
router.get('/account/export', ...me, auth.rateLimit(5, 30), wrap(async (req, res) => {
  const uid = req.user.id, q = async s => (await db.q(s, [uid])).rows;
  const data = {
    exportedAt: new Date().toISOString(), profile: await profileOf(uid),
    lessons: await q('SELECT lesson_id, visited, checks, last_section, updated_at FROM lesson_progress WHERE user_id=$1'),
    quizzes: await q('SELECT lesson_id, kind, form, score, max, submitted_at FROM quiz_attempts WHERE user_id=$1'),
    labs: await q('SELECT lab_id, status, started_at, ended_at FROM lab_runs WHERE user_id=$1'),
    labTasks: await q('SELECT task_key, lab_id, attempts, hint_used, solved, points, solved_at FROM task_progress WHERE user_id=$1'),
    simulators: await q('SELECT sim, mission, best, max, attempts, updated_at FROM sim_results WHERE user_id=$1'),
    practice: await q('SELECT qid, correct, score, created_at FROM bank_log WHERE user_id=$1 ORDER BY created_at'),
    exams: await q('SELECT exam_id, score, max, submitted_at FROM exam_attempts WHERE user_id=$1'),
    activityDays: await q('SELECT * FROM activity WHERE user_id=$1').catch(() => []),
    badges: await q('SELECT badge, earned_at FROM user_badges WHERE user_id=$1'),
    submissions: await q('SELECT sim, mission, auto_score, auto_max, report, teacher_scores, teacher_comment, created_at FROM sim_submissions WHERE user_id=$1').catch(() => []),
    // 3.0 P6: every answer typed, challenges, requests and the Skills Portfolio (teacher observations, comments, capstone rubric)
    labAnswers: await q('SELECT task_key, lab_id, correct, answer, created_at FROM attempt_log WHERE user_id=$1 ORDER BY id').catch(() => []),
    examAnswers: await q('SELECT exam_id, answers, results, started_at, submitted_at FROM exam_attempts WHERE user_id=$1').catch(() => []),
    challenges: await q('SELECT * FROM challenge_done WHERE user_id=$1').catch(() => []),
    resetRequests: await q('SELECT note, created_at, resolved_at FROM reset_requests WHERE user_id=$1').catch(() => []),
    portfolioNotes: await q('SELECT skill, reflection, reflected_at, teacher_comment, commented_at FROM portfolio_notes WHERE user_id=$1').catch(() => []),
    skillObservations: await q('SELECT skill, level, title, note, week, observed_on, created_at FROM skill_observations WHERE user_id=$1').catch(() => []),
    capstoneReview: await q('SELECT scores, comment, updated_at FROM capstone_reviews WHERE user_id=$1').catch(() => [])
  };
  res.setHeader('Content-Disposition', 'attachment; filename="netlab-my-data.json"');
  res.type('json').send(JSON.stringify(data, null, 1));
}));

/* students can delete their own account and all of its data; teachers/admins are managed by the admin */
router.post('/account/delete', ...me, auth.rateLimit(5, 30), wrap(async (req, res) => {
  if (req.user.role !== 'student') return fail(res, 403, 'forbidden', 'บัญชีครูและผู้ดูแลลบได้โดยผู้ดูแลระบบเท่านั้น');
  if (String(req.body.confirm || '').trim() !== 'ลบบัญชี') return fail(res, 400, 'confirm', 'พิมพ์คำว่า ลบบัญชี เพื่อยืนยัน');
  const u = (await db.q('SELECT password_hash FROM users WHERE id=$1', [req.user.id])).rows[0];
  if (u.password_hash !== auth.NO_PASSWORD) { if (!(await auth.verifyPassword(String(req.body.password || ''), u.password_hash))) return fail(res, 400, 'bad_current', 'รหัสผ่านไม่ถูกต้อง'); }
  else if (Date.now() - +req.user.session_at > 15 * 60000) return fail(res, 401, 'reauth', 'เพื่อความปลอดภัย กรุณาเข้าสู่ระบบด้วย Google อีกครั้งก่อนลบบัญชี');
  await db.q('DELETE FROM users WHERE id=$1', [req.user.id]);   // all score tables reference users ON DELETE CASCADE
  // 3.0 P6: the 2.9 migration's backup copy has no foreign key, so it is cleaned by hand
  if ((await db.q("SELECT to_regclass('backup_29_task_progress') AS t")).rows[0].t) await db.q('DELETE FROM backup_29_task_progress WHERE user_id=$1', [req.user.id]);
  await auth.destroySession(req, res);
  ok(res, { ok: true, message: 'ลบบัญชีและข้อมูลการเรียนทั้งหมดแล้ว' });
}));

function startupReport() {
  const w = [];
  if (PROD && !process.env.PUBLIC_URL) w.push('PUBLIC_URL is not set: e-mail links and Google sign-in are switched off');
  if (!google.enabled()) w.push('Google sign-in off (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET not set)');
  if (!mailer.enabled()) w.push('E-mail off (SMTP_URL or RESEND_API_KEY not set): e-mail sign-up and reset links are unavailable');
  if (!process.env.APP_SECRET) w.push('APP_SECRET not set');
  w.forEach(x => console.warn('accounts: ' + x));
}
module.exports = { startupReport, router, normEmail, EMAIL_RX, cleanupPending };

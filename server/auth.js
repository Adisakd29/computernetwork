'use strict';
const crypto = require('crypto');
const db = require('./db');

const COOKIE = 'nl_sid';
const SESSION_HOURS = 12;

/* ---------- passwords (scrypt, built into Node) ---------- */
function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(String(pw), salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString('base64')}$${key.toString('base64')}`;
}
function verifyPassword(pw, stored) {
  try {
    const [alg, saltB64, keyB64] = String(stored).split('$');
    if (alg !== 'scrypt') return false;
    const key = Buffer.from(keyB64, 'base64');
    const test = crypto.scryptSync(String(pw), Buffer.from(saltB64, 'base64'), key.length, { N: 16384, r: 8, p: 1 });
    return crypto.timingSafeEqual(key, test);
  } catch (e) { return false; }
}
const PW_CHARS = 'abcdefghjkmnpqrstuvwxyz23456789';
function tempPassword(len = 8) {
  const b = crypto.randomBytes(len);
  return Array.from(b, x => PW_CHARS[x % PW_CHARS.length]).join('');
}
function passwordProblem(pw) {
  pw = String(pw || '');
  if (pw.length < 8) return 'รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร';
  if (pw.length > 100) return 'รหัสผ่านยาวเกินไป';
  if (!/[0-9]/.test(pw) || !/[^0-9]/.test(pw)) return 'รหัสผ่านต้องมีทั้งตัวอักษรและตัวเลข';
  return null;
}
function usernameProblem(u) {
  if (!/^[a-z0-9][a-z0-9._-]{2,29}$/.test(String(u || ''))) return 'ชื่อผู้ใช้ต้องเป็นภาษาอังกฤษตัวเล็ก ตัวเลข หรือ . _ - ยาว 3–30 ตัว';
  return null;
}

/* ---------- sessions ---------- */
const sha = s => crypto.createHash('sha256').update(s).digest('hex');
function parseCookies(header) {
  const out = {};
  String(header || '').split(';').forEach(p => {
    const i = p.indexOf('=');
    if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}
function cookieAttrs(req) {
  const secure = req.secure || req.headers['x-forwarded-proto'] === 'https';
  return `Path=/; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`;
}
async function createSession(req, res, userId) {
  const token = crypto.randomBytes(32).toString('base64url');
  await db.q(`INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2, now() + interval '${SESSION_HOURS} hours')`, [sha(token), userId]);
  await db.q('UPDATE users SET last_login_at=now() WHERE id=$1', [userId]);
  // no Max-Age: the cookie ends when the browser closes (shared lab computers)
  res.setHeader('Set-Cookie', `${COOKIE}=${token}; ${cookieAttrs(req)}`);
}
async function destroySession(req, res) {
  const token = parseCookies(req.headers.cookie)[COOKIE];
  if (token && db.enabled()) await db.q('DELETE FROM sessions WHERE token_hash=$1', [sha(token)]);
  res.setHeader('Set-Cookie', `${COOKIE}=; ${cookieAttrs(req)}; Max-Age=0`);
}

/* attaches req.user (or null) */
async function loadUser(req, res, next) {
  req.user = null;
  if (!db.enabled()) return next();
  const token = parseCookies(req.headers.cookie)[COOKIE];
  if (!token) return next();
  try {
    const r = await db.q(
      `SELECT u.id,u.username,u.display_name,u.role,u.class_id,u.student_no,u.must_change_pw,u.lb_public
         FROM sessions s JOIN users u ON u.id=s.user_id
        WHERE s.token_hash=$1 AND s.expires_at>now() AND NOT u.disabled`, [sha(token)]);
    req.user = r.rows[0] || null;
  } catch (e) { console.error('session lookup failed', e.message); }
  next();
}

const requireDb = (req, res, next) => db.enabled() ? next() : res.status(503).json({ error: 'no_db', message: 'ระบบสมาชิกยังไม่เปิดใช้งาน (ยังไม่ได้เชื่อมต่อฐานข้อมูล)' });
const requireUser = (req, res, next) => req.user ? next() : res.status(401).json({ error: 'login_required', message: 'กรุณาเข้าสู่ระบบ' });
const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'login_required', message: 'กรุณาเข้าสู่ระบบ' });
  return roles.includes(req.user.role) ? next() : res.status(403).json({ error: 'forbidden', message: 'ไม่มีสิทธิ์ใช้งานส่วนนี้' });
};

/* simple CSRF guard: state-changing requests must be JSON with our header */
function csrfGuard(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (req.get('X-NetLab') !== '1') return res.status(403).json({ error: 'csrf', message: 'คำขอไม่ถูกต้อง' });
  next();
}

/* login throttling: 8 failures per username+IP within 15 minutes locks for 15 minutes */
const fails = new Map();
function throttleKey(req, username) { return `${req.ip}|${String(username || '').toLowerCase()}`; }
function isLocked(key) {
  const f = fails.get(key);
  if (!f) return false;
  if (Date.now() - f.first > 15 * 60000) { fails.delete(key); return false; }
  return f.count >= 8;
}
function noteFail(key) {
  const f = fails.get(key);
  if (!f || Date.now() - f.first > 15 * 60000) fails.set(key, { count: 1, first: Date.now() });
  else f.count++;
}
const clearFails = key => fails.delete(key);

/* rate limit per logged-in user, or per IP for guests.
   A whole classroom often shares one school IP, so the guest/IP limit is set higher. */
function rateLimit(perMinute, perIpMinute = perMinute * 10) {
  const hits = new Map();
  return (req, res, next) => {
    const now = Date.now();
    const key = req.user ? 'u' + req.user.id : 'ip' + req.ip;
    const limit = req.user ? perMinute : perIpMinute;
    const h = hits.get(key) || { n: 0, t: now };
    if (now - h.t > 60000) { h.n = 0; h.t = now; }
    h.n++; hits.set(key, h);
    if (hits.size > 5000) for (const [k, v] of hits) if (now - v.t > 60000) hits.delete(k);
    if (h.n > limit) return res.status(429).json({ error: 'rate', message: 'ส่งคำขอถี่เกินไป กรุณารอสักครู่' });
    next();
  };
}

async function ensureAdmin() {
  if (!db.enabled()) return;
  const u = (process.env.ADMIN_USERNAME || '').trim().toLowerCase();
  const p = process.env.ADMIN_PASSWORD || '';
  if (!u || !p) {
    const r = await db.q("SELECT 1 FROM users WHERE role='admin' LIMIT 1");
    if (!r.rowCount) console.warn('No admin account. Set ADMIN_USERNAME and ADMIN_PASSWORD to create one.');
    return;
  }
  const ex = await db.q('SELECT id FROM users WHERE username=$1', [u]);
  if (!ex.rowCount) {
    await db.q("INSERT INTO users(username,password_hash,display_name,role) VALUES($1,$2,$3,'admin')", [u, hashPassword(p), 'ผู้ดูแลระบบ']);
    console.log(`Admin account "${u}" created.`);
  }
}

module.exports = {
  hashPassword, verifyPassword, tempPassword, passwordProblem, usernameProblem,
  createSession, destroySession, loadUser, requireDb, requireUser, requireRole, csrfGuard,
  throttleKey, isLocked, noteFail, clearFails, rateLimit, ensureAdmin, parseCookies
};

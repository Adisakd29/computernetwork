'use strict';
/* Simulators: mission lists, signed generated problems, server-side grading, best scores */
const express = require('express');
const crypto = require('crypto');
const db = require('./db');
const auth = require('./auth');

const SIMS = ['topology', 'subnet', 'crimp', 'terminal', 'troubleshoot'];
const MODS = {};
for (const id of SIMS) MODS[id] = require('./sims/' + id);

const SECRET = process.env.APP_SECRET ||
  crypto.createHash('sha256').update('netlab:' + (process.env.DATABASE_URL || '') + ':' + (process.env.ADMIN_PASSWORD || '')).digest('hex');
if (!process.env.APP_SECRET && !process.env.DATABASE_URL) console.warn('APP_SECRET not set: generated subnet problems use a weak default secret.');

/* only these mission fields are ever sent to the browser */
const PUBLIC_FIELDS = ['id', 'title', 'level', 'desc', 'max', 'hints', 'start'];
const publicMissions = id => MODS[id].missions.map(m => { const o = {}; PUBLIC_FIELDS.forEach(k => { if (m[k] !== undefined) o[k] = m[k]; }); return o; });
const PUBLIC = {};
for (const id of SIMS) PUBLIC[id] = { id, title: MODS[id].title, generated: typeof MODS[id].generate === 'function', missions: publicMissions(id) };

const sign = obj => { const body = Buffer.from(JSON.stringify(obj)).toString('base64url'); return body + '.' + crypto.createHmac('sha256', SECRET).update(body).digest('base64url'); };
function verify(token) {
  const [body, mac] = String(token || '').split('.');
  if (!body || !mac) return null;
  const want = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  if (want.length !== mac.length || !crypto.timingSafeEqual(Buffer.from(want), Buffer.from(mac))) return null;
  try { return JSON.parse(Buffer.from(body, 'base64url').toString()); } catch (e) { return null; }
}
function seededRand(seed) {
  let c = 0;
  return () => { const h = crypto.createHash('sha256').update(seed + ':' + (c++)).digest(); return h.readUInt32BE(0) / 4294967296; };
}

const router = express.Router();
const ok = (res, d) => res.json(d);
const fail = (res, code, error, message) => res.status(code).json({ error, message });
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

async function doneOf(userId) {
  const out = {};
  if (!userId || !db.enabled()) return out;
  const r = await db.q('SELECT sim,mission,best,max,attempts FROM sim_results WHERE user_id=$1', [userId]);
  r.rows.forEach(x => { (out[x.sim] = out[x.sim] || {})[x.mission] = { best: x.best, max: x.max, attempts: x.attempts }; });
  return out;
}

router.get('/', wrap(async (req, res) => {
  const done = await doneOf(req.user && req.user.id);
  ok(res, { sims: SIMS.map(id => ({ ...PUBLIC[id], done: done[id] || {} })) });
}));

router.get('/:sim', wrap(async (req, res) => {
  const id = req.params.sim; if (!MODS[id]) return fail(res, 404, 'no_sim', 'ไม่พบห้องจำลองนี้');
  const done = await doneOf(req.user && req.user.id);
  ok(res, { ...PUBLIC[id], done: done[id] || {} });
}));

router.post('/:sim/new', auth.rateLimit(60, 1200), wrap(async (req, res) => {
  const id = req.params.sim, m = MODS[id];
  if (!m || typeof m.generate !== 'function') return fail(res, 404, 'no_gen', 'ห้องจำลองนี้ไม่มีโจทย์สุ่ม');
  const mission = String(req.body.mission || '');
  if (!m.missions.some(x => x.id === mission)) return fail(res, 404, 'no_mission', 'ไม่พบภารกิจนี้');
  const seed = crypto.randomBytes(12).toString('hex');
  let problem;
  try { problem = m.generate(mission, seededRand(seed)); } catch (e) { console.error('generate failed', e); return fail(res, 500, 'gen', 'สร้างโจทย์ไม่สำเร็จ ลองใหม่'); }
  const token = sign({ s: id, m: mission, p: problem, u: req.user ? req.user.id : 0, exp: Date.now() + 6 * 3600e3 });
  ok(res, { problem, token });
}));

router.post('/:sim/submit', auth.rateLimit(60, 1200), wrap(async (req, res) => {
  const id = req.params.sim, m = MODS[id];
  if (!m) return fail(res, 404, 'no_sim', 'ไม่พบห้องจำลองนี้');
  const mission = String(req.body.mission || '');
  const ms = m.missions.find(x => x.id === mission);
  if (!ms) return fail(res, 404, 'no_mission', 'ไม่พบภารกิจนี้');
  if (JSON.stringify(req.body.payload || null).length > 300000) return fail(res, 413, 'too_big', 'ข้อมูลใหญ่เกินไป');
  let problem;
  if (typeof m.generate === 'function') {
    const t = verify(req.body.token);
    if (!t || t.s !== id || t.m !== mission || t.exp < Date.now() || (t.u && (!req.user || t.u !== req.user.id))) return fail(res, 400, 'bad_token', 'โจทย์นี้หมดอายุหรือไม่ถูกต้อง กด "โจทย์ใหม่" แล้วลองอีกครั้ง');
    problem = t.p;
  }
  let r;
  try { r = m.grade(mission, req.body.payload, problem); } catch (e) { console.error('grade failed', id, mission, e); r = null; }
  if (!r || typeof r.score !== 'number') return fail(res, 500, 'grade', 'ตรวจงานไม่สำเร็จ ลองใหม่อีกครั้ง');
  const max = r.max || ms.max || 10, score = Math.max(0, Math.min(max, Math.round(r.score)));
  let saved = false;
  if (req.user && db.enabled()) {
    await db.q(`INSERT INTO sim_results(user_id,sim,mission,best,max,last,attempts,first_full_at) VALUES($1,$2,$3,$4::int,$5::int,$4::int,1,CASE WHEN $4::int>=$5::int THEN now() END)
                ON CONFLICT (user_id,sim,mission) DO UPDATE SET best=GREATEST(sim_results.best,EXCLUDED.best), last=EXCLUDED.last, max=EXCLUDED.max,
                attempts=sim_results.attempts+1, first_full_at=COALESCE(sim_results.first_full_at, CASE WHEN EXCLUDED.best>=EXCLUDED.max THEN now() END), updated_at=now()`,
      [req.user.id, id, mission, score, max]);
    saved = true;
  }
  ok(res, { score, max, ok: score >= max, feedback: Array.isArray(r.feedback) ? r.feedback.slice(0, 40) : [], details: r.details, saved });
}));

module.exports = { router, SIMS, PUBLIC, doneOf };

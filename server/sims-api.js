'use strict';
/* Simulators: mission lists, signed generated problems, server-side grading, best scores */
const express = require('express');
const crypto = require('crypto');
const db = require('./db');
const auth = require('./auth');

const fs = require('fs'), path = require('path');
/* 3.0 labs (switching, ipv6, packets, netops; 3.0 Phase 4: wifi) are listed only once their module exists */
const SIMS = ['topology', 'subnet', 'crimp', 'terminal', 'troubleshoot', 'switching', 'ipv6', 'packets', 'netops', 'wifi'].filter(id => fs.existsSync(path.join(__dirname, 'sims', id + '.js')));
const MODS = Object.create(null);   // 3.0 P6: no prototype keys (/api/sims/__proto__, toString)
for (const id of SIMS) MODS[id] = require('./sims/' + id);

const SECRET = process.env.APP_SECRET ||
  crypto.createHash('sha256').update('netlab:' + (process.env.DATABASE_URL || '') + ':' + (process.env.ADMIN_PASSWORD || '')).digest('hex');
if (!process.env.APP_SECRET && !process.env.DATABASE_URL) console.warn('APP_SECRET not set: generated subnet problems use a weak default secret.');

/* only these mission fields are ever sent to the browser */
const PUBLIC_FIELDS = ['id', 'title', 'level', 'desc', 'max', 'hints', 'start', 'review', 'week', 'mode'];   // review = rubric criteria (no answers)
const publicMissions = id => MODS[id].missions.map(m => { const o = {}; PUBLIC_FIELDS.forEach(k => { if (m[k] !== undefined) o[k] = m[k]; }); return o; });
const PUBLIC = Object.create(null);
/* a sim may generate problems for only some missions (module.generatedMissions); others need no signed token */
const isGen = (m, mission) => typeof m.generate === 'function' && (!Array.isArray(m.generatedMissions) || m.generatedMissions.includes(mission));
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

const PRACTICE_MSG = "โจทย์นี้ส่งไปแล้ว ผลครั้งนี้เป็นการฝึก ไม่นับคะแนน กด 'โจทย์ใหม่' เพื่อทำข้อใหม่";
/* tokens live 6 h, so used nonces older than 7 h can go; swept at most once every 10 minutes */
let lastSweep = 0;
function sweepTokens() {
  if (Date.now() - lastSweep < 600e3) return;
  lastSweep = Date.now();
  db.q("DELETE FROM sim_tokens_used WHERE used_at < now() - interval '7 hours'").catch(e => console.error('sweep sim_tokens_used', e.message));
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

/* done map only (same shape as the per-sim `done` in GET /api/sims), for lesson pages */
router.get('/done', wrap(async (req, res) => {
  ok(res, { done: await doneOf(req.user && req.user.id) });
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
  if (!isGen(m, mission)) return fail(res, 404, 'no_gen', 'ภารกิจนี้ไม่มีโจทย์สุ่ม');
  const seed = crypto.randomBytes(12).toString('hex');
  let problem;
  try { problem = m.generate(mission, seededRand(seed)); } catch (e) { console.error('generate failed', e); return fail(res, 500, 'gen', 'สร้างโจทย์ไม่สำเร็จ ลองใหม่'); }
  /* n = one-time nonce: a logged-in submit records it in sim_tokens_used so a replayed token cannot raise the best score */
  const token = sign({ s: id, m: mission, p: problem, u: req.user ? req.user.id : 0, n: crypto.randomBytes(12).toString('base64url'), exp: Date.now() + 6 * 3600e3 });
  ok(res, { problem, token });
}));

router.post('/:sim/submit', auth.rateLimit(60, 1200), wrap(async (req, res) => {
  const id = req.params.sim, m = MODS[id];
  if (!m) return fail(res, 404, 'no_sim', 'ไม่พบห้องจำลองนี้');
  const mission = String(req.body.mission || '');
  const ms = m.missions.find(x => x.id === mission);
  if (!ms) return fail(res, 404, 'no_mission', 'ไม่พบภารกิจนี้');
  if (JSON.stringify(req.body.payload || null).length > 300000) return fail(res, 413, 'too_big', 'ข้อมูลใหญ่เกินไป');
  { // Progressive Unlock: a mission that only serves locked weeks is not scored for this student (server-side)
    const P = require('./path'), a = await P.missionAccess(req, id, mission);
    if (!a.ok) return P.lockedReply(res, a.week);
  }
  let problem, practice = false;
  if (isGen(m, mission)) {
    const t = verify(req.body.token);
    if (!t || t.s !== id || t.m !== mission || t.exp < Date.now() || (t.u && (!req.user || t.u !== req.user.id))) return fail(res, 400, 'bad_token', 'โจทย์นี้หมดอายุหรือไม่ถูกต้อง กด "โจทย์ใหม่" แล้วลองอีกครั้ง');
    if (req.user && !t.u) return fail(res, 400, 'bad_token', 'โจทย์นี้สร้างก่อนเข้าสู่ระบบ กด "โจทย์ใหม่" เพื่อรับโจทย์ที่บันทึกคะแนนได้');
    if (req.user && !t.n) return fail(res, 400, 'bad_token', 'โจทย์นี้เป็นรุ่นเก่า กด "โจทย์ใหม่" แล้วลองอีกครั้ง');
    problem = t.p;
    if (req.user && db.enabled()) {
      sweepTokens();
      const ins = await db.q('INSERT INTO sim_tokens_used(nonce,user_id) VALUES($1,$2) ON CONFLICT (nonce) DO NOTHING RETURNING nonce', [String(t.n), req.user.id]);
      practice = ins.rowCount === 0;   // this generated problem was already submitted once: grade it, but it does not count
    }
  }
  let r;
  try { r = m.grade(mission, req.body.payload, problem); } catch (e) { console.error('grade failed', id, mission, e); r = null; }
  if (!r || typeof r.score !== 'number') return fail(res, 500, 'grade', 'ตรวจงานไม่สำเร็จ ลองใหม่อีกครั้ง');
  const max = r.max || ms.max || 10, score = Math.max(0, Math.min(max, Math.round(r.score)));
  let saved = false, submission = null;
  if (req.user && db.enabled()) {
    if (practice) {   // replayed token: count the attempt and keep `last`, never raise best or first_full_at
      await db.q(`INSERT INTO sim_results(user_id,sim,mission,best,max,last,attempts) VALUES($1,$2,$3,0,$5::int,$4::int,1)
                  ON CONFLICT (user_id,sim,mission) DO UPDATE SET last=EXCLUDED.last, attempts=sim_results.attempts+1, updated_at=now()`,
        [req.user.id, id, mission, score, max]);
    } else await db.q(`INSERT INTO sim_results(user_id,sim,mission,best,max,last,attempts,first_full_at) VALUES($1,$2,$3,$4::int,$5::int,$4::int,1,CASE WHEN $4::int>=$5::int THEN now() END)
                ON CONFLICT (user_id,sim,mission) DO UPDATE SET best=GREATEST(sim_results.best,EXCLUDED.best), last=EXCLUDED.last, max=EXCLUDED.max,
                attempts=sim_results.attempts+1, first_full_at=COALESCE(sim_results.first_full_at, CASE WHEN EXCLUDED.best>=EXCLUDED.max THEN now() END), updated_at=now()`,
      [req.user.id, id, mission, score, max]);
    saved = true;
    if (ms.review) {   // keep the work so the teacher can review it with the rubric (5 latest per student and mission)
      const report = typeof (req.body.payload || {}).report === 'string' ? req.body.payload.report.slice(0, 6000) : null;
      const rub = Array.isArray(r.rubric) ? r.rubric.slice(0, 20).map(x => ({ id: String(x.id), title: String(x.title || x.id), score: Number(x.score) || 0, max: Number(x.max) || 0, note: x.note ? String(x.note).slice(0, 300) : undefined })) : [];
      const ins = await db.q(`INSERT INTO sim_submissions(user_id,sim,mission,payload,problem,auto_score,auto_max,rubric,report) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
        [req.user.id, id, mission, JSON.stringify(req.body.payload), problem ? JSON.stringify(problem) : null, score, max, JSON.stringify(rub), report]);
      submission = ins.rows[0].id;
      await db.q(`DELETE FROM sim_submissions WHERE user_id=$1 AND sim=$2 AND mission=$3 AND id NOT IN (SELECT id FROM sim_submissions WHERE user_id=$1 AND sim=$2 AND mission=$3 ORDER BY created_at DESC LIMIT 5)`, [req.user.id, id, mission]);
    }
  }
  const out = { score, max, ok: score >= max, feedback: Array.isArray(r.feedback) ? r.feedback.slice(0, 40) : [], details: r.details, rubric: r.rubric, saved, submission };
  if (practice) { out.practice = true; out.message = PRACTICE_MSG; }
  ok(res, out);
}));

/* my latest reviewed work for a mission (rubric + teacher feedback) */
router.get('/:sim/review/:mission', auth.requireDb, auth.requireUser, wrap(async (req, res) => {
  const r = (await db.q(`SELECT id, auto_score, auto_max, rubric, report, teacher_scores, teacher_comment, reviewed_at, created_at FROM sim_submissions
                         WHERE user_id=$1 AND sim=$2 AND mission=$3 ORDER BY created_at DESC LIMIT 1`, [req.user.id, req.params.sim, req.params.mission])).rows[0];
  const ms = MODS[req.params.sim] && MODS[req.params.sim].missions.find(x => x.id === req.params.mission);
  ok(res, { submission: r ? { ...r, created_at: +r.created_at, reviewed_at: r.reviewed_at ? +r.reviewed_at : null } : null, review: ms && ms.review || null });
}));

/* teacher: latest reviewable work of each student in a class, and saving rubric scores */
const teacher = express.Router();
async function ownClass(req, id) {
  const c = (await db.q('SELECT * FROM classes WHERE id=$1', [Number(id) || 0])).rows[0];
  return c && (req.user.role === 'admin' || c.teacher_id === req.user.id) ? c : null;
}
const reviewable = () => SIMS.flatMap(s => MODS[s].missions.filter(m => m.review).map(m => ({ sim: s, mission: m.id, title: m.title, simTitle: MODS[s].title, review: m.review, max: m.max })));
teacher.get('/classes/:id/submissions', wrap(async (req, res) => {
  const c = await ownClass(req, req.params.id); if (!c) return fail(res, 404, 'no_class', 'ไม่พบห้องเรียนนี้');
  const rows = (await db.q(`SELECT DISTINCT ON (s.user_id, s.sim, s.mission) s.id, s.user_id, u.display_name AS name, u.student_no AS no, s.sim, s.mission, s.auto_score, s.auto_max,
                                   s.rubric, s.report, s.payload, s.teacher_scores, s.teacher_comment, s.reviewed_at, s.created_at
                              FROM sim_submissions s JOIN users u ON u.id=s.user_id
                             WHERE u.class_id=$1 AND u.role='student' AND NOT u.disabled
                             ORDER BY s.user_id, s.sim, s.mission, s.created_at DESC`, [c.id])).rows;
  ok(res, { missions: reviewable(), submissions: rows.map(r => ({ ...r, created_at: +r.created_at, reviewed_at: r.reviewed_at ? +r.reviewed_at : null })) });
}));
teacher.post('/submissions/:sid/review', wrap(async (req, res) => {
  const s = (await db.q(`SELECT s.*, u.class_id FROM sim_submissions s JOIN users u ON u.id=s.user_id WHERE s.id=$1`, [Number(req.params.sid) || 0])).rows[0];
  if (!s || !(await ownClass(req, s.class_id))) return fail(res, 404, 'no_sub', 'ไม่พบงานนี้');
  const ms = MODS[s.sim] && MODS[s.sim].missions.find(x => x.id === s.mission);
  const crit = (ms && ms.review && ms.review.teacher) || [];
  const scores = {};
  for (const c of crit) {
    const v = Number((req.body.scores || {})[c.id]);
    if (!Number.isFinite(v) || v < 0 || v > c.max) return fail(res, 400, 'bad_score', `คะแนน "${c.title}" ต้องอยู่ระหว่าง 0–${c.max}`);
    scores[c.id] = Math.round(v * 2) / 2;
  }
  await db.q(`UPDATE sim_submissions SET teacher_scores=$2, teacher_comment=$3, reviewed_by=$4, reviewed_at=now() WHERE id=$1`,
    [s.id, JSON.stringify(scores), String(req.body.comment || '').slice(0, 2000) || null, req.user.id]);
  ok(res, { ok: true, scores });
}));

module.exports = { router, teacher, SIMS, PUBLIC, doneOf, MODS };

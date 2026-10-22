'use strict';
/*
 * NetLab 3.2: one practical session per week ("ฝึกปฏิบัติ").
 *
 * A session holds the three parts of a week in order (content/learning-path.js PARTS):
 *   guided       Guided Lab: the hands-on tasks of the week lab (content/labs.js task.practical, VM missions) and the
 *                Guided simulator missions (content/curriculum.js guided)
 *   independent  Independent Lab: curriculum independent missions
 *   trouble      Troubleshooting Lab: curriculum solve missions (an analysis mission in weeks where fault-finding does not fit)
 * ONE timer per session, kept on the server: deadline = started_at + minutes (minutes come from the real tasks and missions
 * of the week). Changing part, opening a simulator, going back to the lesson, reloading, or opening the lesson on another
 * device never restarts it: every client reads started_at/deadline and the server time from here.
 * Work is recorded per session as it happens (practical_items): an answer to a hands-on task (POST /api/check) and every
 * simulator submit (POST /api/sims/:sim/submit) of a mission in the running session. Nothing arriving after the deadline
 * counts for that session. At the deadline the session closes by itself (status 'timeout') and is scored from what was
 * recorded; "ส่งงานทั้งหมด" closes it earlier (status 'submitted').
 *
 * Score: each part = average of its items (a task: points/10 with the lab rule 10, hint -5, each distinct wrong answer -2,
 * minimum 2 when correct; a mission: best score/max in this session); the session total = the parts weighted by the class
 * weights (a part the week does not have is left out and the others scale up). Passed = total >= practical.passPct.
 * Attempts: practical.maxAttempts sessions, practical.cooldownMin minutes apart, the best session counts. A teacher can
 * void a session (it then gives the attempt back and no longer counts) and the record stays for history.
 * Earlier work (before 3.2) is kept as one 'legacy' session per student and week, built once from the stored best results
 * (migration practical-1); it counts like an attempt that was already made, but uses no attempt.
 */
const express = require('express');
const db = require('./db');
const auth = require('./auth');
const { WEEKS: CURR, MINUTES } = require('../content/curriculum');
const { PARTS, DEFAULTS } = require('../content/learning-path');
const C = require('./content');
const { check, pointsLeft, logAnswer } = require('./grading');

const ok = (res, d) => res.json(d);
const fail = (res, code, error, message, extra) => res.status(code).json(Object.assign({ error, message }, extra || {}));
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const ceil5 = m => Math.ceil(m / 5) * 5;
const TASK_MIN = 3, VM_BOOT = 5, MISSION_PASS = 0.7;
let MODS_ = null; const mods = () => MODS_ || (MODS_ = require('./sims-api').MODS);
let PATH_ = null; const pathMod = () => PATH_ || (PATH_ = require('./path'));

/* ---------- the set of a week (no database) ---------- */
const SETS = new Map();
function missionItem(part, ref) {
  const [sim, id] = ref.split(':'); const M = mods()[sim]; const m = M && M.missions.find(x => x.id === id);
  if (!m) throw new Error('practical: unknown mission ' + ref);
  return { part, kind: 'mission', key: ref, sim, mission: id, title: m.title, simTitle: M.title, level: m.level || 'medium',
    max: m.max || 10, minutes: MINUTES[m.level] || 15, href: `#/sim/${sim}/${id}` };
}
function setOf(wid) {
  if (SETS.has(wid)) return SETS.get(wid);
  const W = CURR.find(w => w.id === wid); if (!W) return null;
  const lab = C.LABS.get(wid), items = [];
  let vm = false;
  for (const key of lab ? C.labKeys(lab) : []) {
    const t = C.TASKS.get(key); if (t.vm) vm = true;
    items.push({ part: 'guided', kind: 'task', key, title: t.task.q, max: 10, minutes: TASK_MIN, vm: !!t.vm });
  }
  W.guided.forEach(r => items.push(missionItem('guided', r)));
  W.independent.forEach(r => items.push(missionItem('independent', r)));
  W.solve.forEach(r => items.push(missionItem('trouble', r)));
  const minutes = ceil5(items.reduce((a, i) => a + i.minutes, 0) + (vm ? VM_BOOT : 0));
  const parts = PARTS.filter(p => items.some(i => i.part === p.id)).map(p => ({ id: p.id, title: p.title, th: p.th, keys: items.filter(i => i.part === p.id).map(i => i.key) }));
  const set = { week: wid, minutes, vm, type: W.solveType || 'trouble', items, parts };
  SETS.set(wid, set);
  return set;
}
const IDS = CURR.map(w => w.id);
/* item key (task key or 'sim:mission') -> week whose session holds it (each key is in at most one week's session) */
const WEEK_OF = new Map();
function weekOfItem(key) {
  if (!WEEK_OF.size) for (const wid of IDS) for (const it of setOf(wid).items) {
    if (WEEK_OF.has(it.key)) throw new Error(`practical: ${it.key} is in the sessions of ${WEEK_OF.get(it.key)} and ${wid}`);
    WEEK_OF.set(it.key, wid);
  }
  return WEEK_OF.get(key) || null;
}
const isPracticalTask = key => { const t = C.TASKS.get(key); return !!(t && t.lab.exit && C.isActive(key)); };

/* ---------- scoring (no database) ---------- */
const policyOf = S => (S && S.practical) || DEFAULTS.practical;
function itemResult(it, r) {
  const done = !!r;
  if (it.kind === 'task') {
    const solved = !!(r && r.solved), score = solved ? Number(r.score) : 0;
    return { frac: score / 10, passed: solved, score, max: 10, done,
      reason: solved ? null : !done ? 'ยังไม่ได้ตอบในรอบนี้' : 'ยังตอบไม่ถูก ลองอ่านผลจากคำสั่งอีกครั้งหรือกดคำใบ้' };
  }
  const score = r ? Number(r.score) : 0, max = r && Number(r.max) ? Number(r.max) : it.max, frac = Math.min(1, score / max);
  return { frac, passed: frac >= MISSION_PASS, score, max, done,
    reason: frac >= MISSION_PASS ? null : !done ? 'ยังไม่ได้ส่งงานในรอบนี้' : `ได้ ${score}/${max} (${Math.round(frac * 100)}%) ต้องได้อย่างน้อย 70% อ่านคำแนะนำในห้องจำลองแล้วแก้ไขส่งใหม่` };
}
/* rows: Map item key -> { score, max, solved } of one session */
function evaluate(set, rows, policy) {
  const P = policy || DEFAULTS.practical;
  const parts = set.parts.map(p => {
    const items = p.keys.map(k => { const it = set.items.find(x => x.key === k), r = itemResult(it, rows.get(k));
      return { key: k, kind: it.kind, title: it.title, href: it.href || null, score: r.score, max: r.max, pct: Math.round(r.frac * 100), passed: r.passed, done: r.done, reason: r.reason }; });
    const pct = items.length ? Math.round(100 * items.reduce((a, i) => a + i.pct / 100, 0) / items.length) : 0;
    return { id: p.id, title: p.title, th: p.th, weight: P.weights[p.id] || 0, pct, passed: items.filter(i => i.passed).length, count: items.length, items };
  });
  let wsum = parts.reduce((a, p) => a + p.weight, 0);
  const total = wsum ? Math.round(parts.reduce((a, p) => a + p.weight * p.pct, 0) / wsum)
    : (parts.length ? Math.round(parts.reduce((a, p) => a + p.pct, 0) / parts.length) : 0);
  return { parts, total, passPct: P.passPct, passed: total >= P.passPct };
}

/* ---------- database ---------- */
async function itemsOf(sessionIds) {
  if (!sessionIds.length) return new Map();
  const rows = (await db.q('SELECT session_id, item, score, max, solved FROM practical_items WHERE session_id = ANY($1)', [sessionIds])).rows;
  const out = new Map(sessionIds.map(id => [id, new Map()]));
  rows.forEach(r => out.get(r.session_id).set(r.item, r));
  return out;
}
async function storeResult(id, wid, policy) {
  const rows = (await itemsOf([id])).get(id);
  const res = evaluate(setOf(wid), rows, policy);
  await db.q('UPDATE practical_sessions SET result=$2 WHERE id=$1', [id, JSON.stringify(res)]);
  return res;
}
/* close every session of this user whose time is up (scored from what was recorded before the deadline) */
async function closeExpired(userId) {
  const r = (await db.q(`UPDATE practical_sessions SET status='timeout', ended_at=deadline
                         WHERE user_id=$1 AND status='running' AND deadline <= now() RETURNING id, lesson_id`, [userId])).rows;
  if (r.length) { const S = await settingsOfUser(userId); for (const x of r) await storeResult(x.id, x.lesson_id, policyOf(S)); }
}
async function settingsOfUser(userId) {
  const u = (await db.q('SELECT id, class_id FROM users WHERE id=$1', [userId])).rows[0];
  return (await pathMod().settingsFor(u || { id: userId })).settings;
}
async function runningOf(userId) {
  await closeExpired(userId);
  return (await db.q("SELECT * FROM practical_sessions WHERE user_id=$1 AND status='running'", [userId])).rows[0] || null;
}
const FINISHED = ['submitted', 'timeout', 'legacy'];
const usesAttempt = s => (s.status === 'submitted' || s.status === 'timeout') && !s.voided_at;
/* every week of one student, current policy (used by the lesson lock and the lesson rail) */
async function factsOf(userId, policy) {
  await closeExpired(userId);
  const ss = (await db.q('SELECT * FROM practical_sessions WHERE user_id=$1 ORDER BY lesson_id, attempt, id', [userId])).rows;
  const items = await itemsOf(ss.map(s => s.id));
  const out = new Map();
  for (const wid of IDS) {
    const mine = ss.filter(s => s.lesson_id === wid), set = setOf(wid);
    const scored = mine.filter(s => FINISHED.includes(s.status) && !s.voided_at).map(s => ({ s, r: evaluate(set, items.get(s.id), policy) }));
    const best = scored.reduce((a, x) => (!a || x.r.total > a.r.total ? x : a), null);
    const run = mine.find(s => s.status === 'running');
    out.set(wid, { best: best ? best.r.total : null, passed: !!(best && best.r.passed), bestLegacy: !!(best && best.s.status === 'legacy'),
      running: run ? { id: run.id, deadline: +run.deadline } : null, attempts: mine.filter(usesAttempt).length, tried: scored.length > 0 });
  }
  return out;
}
async function stateOf(userId, wid, S) {
  const P = policyOf(S), set = setOf(wid);
  await closeExpired(userId);
  const ss = (await db.q('SELECT * FROM practical_sessions WHERE user_id=$1 AND lesson_id=$2 ORDER BY attempt, id', [userId, wid])).rows;
  const items = await itemsOf(ss.map(s => s.id));
  const sessions = ss.map(s => { const r = evaluate(set, items.get(s.id), P);
    return { id: s.id, attempt: s.attempt, status: s.status, legacy: s.status === 'legacy', voided: !!s.voided_at,
      startedAt: +s.started_at, deadline: +s.deadline, endedAt: s.ended_at ? +s.ended_at : null, total: r.total, passed: r.passed, result: r }; });
  const counted = sessions.filter(s => s.status !== 'running' && !s.voided);
  const best = counted.reduce((a, s) => (!a || s.total > a.total ? s : a), null);
  const used = ss.filter(usesAttempt).length;
  const lastEnd = Math.max(0, ...ss.filter(usesAttempt).map(s => +s.ended_at || 0));
  const nextAt = lastEnd && P.cooldownMin ? lastEnd + P.cooldownMin * 60000 : null;
  const run = sessions.find(s => s.status === 'running') || null;
  const other = run ? null : (await db.q("SELECT lesson_id, deadline FROM practical_sessions WHERE user_id=$1 AND status='running'", [userId])).rows[0];
  return {
    now: Date.now(), week: wid, minutes: set.minutes, type: set.type, vm: set.vm,
    parts: set.parts.map(p => ({ id: p.id, title: p.title, th: p.th, weight: P.weights[p.id] || 0,
      items: p.keys.map(k => { const it = set.items.find(x => x.key === k);
        return { key: it.key, kind: it.kind, title: it.title, minutes: it.minutes, max: it.max, href: it.href || null, sim: it.sim || null, mission: it.mission || null, level: it.level || null, simTitle: it.simTitle || null, vm: !!it.vm }; }) })),
    policy: { passPct: P.passPct, weights: P.weights, maxAttempts: P.maxAttempts, cooldownMin: P.cooldownMin },
    attempts: { used, max: P.maxAttempts, left: Math.max(0, P.maxAttempts - used), nextAt: nextAt && nextAt > Date.now() ? nextAt : null },
    running: run, otherRunning: other ? { week: other.lesson_id, deadline: +other.deadline } : null,
    sessions: sessions.filter(s => s.status !== 'running'),
    best: best ? { id: best.id, total: best.total, passed: best.passed, legacy: best.legacy, result: best.result } : null
  };
}

/* ---------- hooks used by the other APIs ---------- */
const SOURCES = new Map(); for (const [from, to] of C.TWINS) SOURCES.set(to.key, (SOURCES.get(to.key) || []).concat(from));   // kept key -> merged room copies
/* no running session at all: a late answer (time up, or already submitted) is told the round is closed, not to press start */
async function notRunning(user, wid, startMsg) {
  const last = (await db.q(`SELECT status FROM practical_sessions WHERE user_id=$1 AND lesson_id=$2 AND status IN ('submitted','timeout') AND voided_at IS NULL
                            ORDER BY id DESC LIMIT 1`, [user.id, wid])).rows[0];
  if (!last) return [409, 'not_started', startMsg];
  return [409, 'closed', last.status === 'timeout' ? 'หมดเวลาแล้ว ระบบไม่รับคำตอบเพิ่มในรอบนี้' : 'ส่งงานรอบนี้แล้ว ระบบไม่รับคำตอบเพิ่มในรอบนี้'];
}
/* a hands-on task answered (POST /api/check). Returns null when the key is not a practical task. */
async function answerTask(user, key, answer) {
  if (!isPracticalTask(key)) return null;
  const wid = weekOfItem(key), t = C.TASKS.get(key);
  const run = await runningOf(user.id);
  if (!run || run.lesson_id !== wid) return { error: run ? [409, 'not_started', `กำลังฝึกปฏิบัติสัปดาห์ที่ ${run.lesson_id.slice(1)} อยู่ ส่งงานหรือรอให้หมดเวลาก่อน`] : await notRunning(user, wid, 'กด "เริ่มฝึกปฏิบัติ" ก่อน จึงจะตอบได้') };
  const out = await db.tx(async cx => {
    await cx.query(`INSERT INTO practical_items(session_id,item,part,max) VALUES($1,$2,'guided',10) ON CONFLICT DO NOTHING`, [run.id, key]);
    const p = (await cx.query('SELECT attempts, wrong_seen, hint, solved, score FROM practical_items WHERE session_id=$1 AND item=$2 FOR UPDATE', [run.id, key])).rows[0];
    if ((await cx.query("SELECT 1 FROM practical_sessions WHERE id=$1 AND status='running' AND deadline > now()", [run.id])).rowCount === 0)
      return { error: [409, 'closed', 'หมดเวลาแล้ว ระบบไม่รับคำตอบเพิ่มในรอบนี้'] };
    if (p.solved) return { correct: true, already: true, attempts: p.attempts, hint: p.hint, points: Number(p.score) };
    const c = check(t.task, answer);
    if (c.empty) return { empty: true };
    await cx.query('INSERT INTO attempt_log(user_id,task_key,lab_id,correct,answer) VALUES($1,$2,$3,$4,$5)', [user.id, key, t.lab.id, c.correct, logAnswer(t.task, answer)]);
    if (c.correct) {
      const pts = pointsLeft(p.attempts, p.hint);
      await cx.query('UPDATE practical_items SET solved=true, score=$3, updated_at=now() WHERE session_id=$1 AND item=$2', [run.id, key, pts]);
      /* history and skills keep using task_progress: the first correct answer is stored there too (never lowered later) */
      const prev = (await cx.query('SELECT solved FROM task_progress WHERE user_id=$1 AND task_key=$2', [user.id, key])).rows[0];
      await cx.query(`INSERT INTO task_progress(user_id,task_key,lab_id,attempts,hint_used,solved,points,solved_at) VALUES($1,$2,$3,$4,$5,true,$6,now())
                      ON CONFLICT (user_id,task_key) DO UPDATE SET solved=true, points=GREATEST(task_progress.points, EXCLUDED.points),
                      solved_at=COALESCE(task_progress.solved_at, now()), updated_at=now() WHERE NOT task_progress.solved OR task_progress.points < EXCLUDED.points`,
        [user.id, key, t.lab.id, p.attempts, p.hint, pts]);
      /* 2.9 rule (as in api.js): a first solve of a question already solved as a merged room copy is a linked row, so its XP counts once */
      const src = SOURCES.get(key);
      if (src && !(prev && prev.solved)) await cx.query(`UPDATE task_progress d SET linked_from = s.task_key FROM task_progress s
                               WHERE d.user_id=$1 AND d.task_key=$2 AND s.user_id=$1 AND s.task_key = ANY($3) AND s.solved`, [user.id, key, src]);
      return { correct: true, attempts: p.attempts, hint: p.hint, points: pts, detail: c.detail, given: logAnswer(t.task, answer) };
    }
    let attempts = p.attempts; const seen = Array.isArray(p.wrong_seen) ? p.wrong_seen : [];
    if (!seen.includes(c.wrongKey)) { attempts++; seen.push(c.wrongKey);
      await cx.query('UPDATE practical_items SET attempts=$3, wrong_seen=$4, updated_at=now() WHERE session_id=$1 AND item=$2', [run.id, key, attempts, JSON.stringify(seen.slice(-50))]); }
    return { correct: false, attempts, hint: p.hint, detail: c.detail, pointsLeft: pointsLeft(attempts, p.hint) };
  });
  if (out.correct) out.explain = t.task.explain;
  out.practical = { session: run.id, week: wid, deadline: +run.deadline };
  return out;
}
/* a hint asked for a hands-on task (POST /api/hint). Returns null when the key is not a practical task. */
async function hintTask(user, key) {
  if (!isPracticalTask(key)) return null;
  const wid = weekOfItem(key), run = await runningOf(user.id);
  if (!run || run.lesson_id !== wid) return { error: run ? [409, 'not_started', 'กด "เริ่มฝึกปฏิบัติ" ก่อน จึงจะดูคำใบ้ได้'] : await notRunning(user, wid, 'กด "เริ่มฝึกปฏิบัติ" ก่อน จึงจะดูคำใบ้ได้') };
  await db.q(`INSERT INTO practical_items(session_id,item,part,max,hint) VALUES($1,$2,'guided',10,true)
              ON CONFLICT (session_id,item) DO UPDATE SET hint = practical_items.hint OR NOT practical_items.solved, updated_at=now()`, [run.id, key]);
  return { hint: C.TASKS.get(key).task.hint || '' };
}
/* a simulator submit (POST /api/sims/:sim/submit), after it was graded and stored in sim_results */
async function recordMission(user, sim, mission, score, max) {
  const ref = `${sim}:${mission}`, wid = weekOfItem(ref);
  if (!wid) return null;
  const run = await runningOf(user.id);
  if (!run || run.lesson_id !== wid) return { recorded: false, week: wid };
  const part = setOf(wid).items.find(i => i.key === ref).part;
  const r = await db.q(`INSERT INTO practical_items(session_id,item,part,score,max,solved) SELECT $1::int,$2::text,$3::text,$4::numeric,$5::numeric,$4::numeric>=$5::numeric
                        WHERE EXISTS (SELECT 1 FROM practical_sessions WHERE id=$1 AND status='running' AND deadline > now())
                        ON CONFLICT (session_id,item) DO UPDATE SET score=GREATEST(practical_items.score, EXCLUDED.score), max=EXCLUDED.max,
                        solved = practical_items.solved OR EXCLUDED.solved, updated_at=now() RETURNING score`, [run.id, ref, part, score, max]);
  return { recorded: r.rowCount > 0, week: wid, session: run.id, deadline: +run.deadline };
}

/* ---------- student API (/api/practical) ---------- */
const router = express.Router();
router.use(auth.requireDb, auth.requireUser);
router.get('/active', wrap(async (req, res) => {
  const r = await runningOf(req.user.id);
  ok(res, { now: Date.now(), session: r ? { id: r.id, week: r.lesson_id, attempt: r.attempt, startedAt: +r.started_at, deadline: +r.deadline, minutes: r.minutes } : null });
}));
const weekParam = (req, res) => { const wid = String(req.params.wid); if (!IDS.includes(wid)) { fail(res, 404, 'no_week', 'ไม่พบสัปดาห์นี้'); return null; } return wid; };
router.get('/:wid', pathGuard(), wrap(async (req, res) => {
  const wid = weekParam(req, res); if (!wid) return;
  ok(res, await stateOf(req.user.id, wid, (await pathMod().settingsFor(req.user)).settings));
}));
router.post('/:wid/start', pathGuard(), wrap(async (req, res) => {
  const wid = weekParam(req, res); if (!wid) return;
  if (req.user.role !== 'student') return fail(res, 403, 'students_only', 'การจับเวลาฝึกปฏิบัติใช้กับบัญชีนักเรียน ครูเปิดดูหน้าและลองภารกิจได้โดยไม่จับเวลา');
  const S = (await pathMod().settingsFor(req.user)).settings, P = policyOf(S), set = setOf(wid);
  const result = await db.tx(async cx => {
    await cx.query('SELECT pg_advisory_xact_lock(7311, $1)', [req.user.id]);   // one start at a time per student (double clicks, two devices)
    await cx.query(`UPDATE practical_sessions SET status='timeout', ended_at=deadline WHERE user_id=$1 AND status='running' AND deadline <= now()`, [req.user.id]);
    const ss = (await cx.query('SELECT * FROM practical_sessions WHERE user_id=$1 AND (lesson_id=$2 OR status=\'running\')', [req.user.id, wid])).rows;
    const run = ss.find(s => s.status === 'running');
    if (run && run.lesson_id === wid) return { already: true };
    if (run) return { error: [409, 'running_other', `กำลังฝึกปฏิบัติสัปดาห์ที่ ${run.lesson_id.slice(1)} อยู่ ส่งงานรอบนั้นหรือรอให้หมดเวลาก่อน`, { week: run.lesson_id }] };
    const mine = ss.filter(s => s.lesson_id === wid), used = mine.filter(usesAttempt).length;
    if (used >= P.maxAttempts) return { error: [409, 'no_attempts', `ใช้สิทธิ์ฝึกปฏิบัติครบ ${P.maxAttempts} รอบแล้ว ระบบนับรอบที่ดีที่สุด ถ้าต้องการทำเพิ่มให้ติดต่อครู`] };
    const lastEnd = Math.max(0, ...mine.filter(usesAttempt).map(s => +s.ended_at || 0));
    if (lastEnd && P.cooldownMin && Date.now() < lastEnd + P.cooldownMin * 60000) {
      const nextAt = lastEnd + P.cooldownMin * 60000;
      return { error: [429, 'cooldown', `เริ่มรอบใหม่ได้เวลา ${new Date(nextAt).toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' })} น. ระหว่างนี้ทบทวนสิ่งที่ยังไม่ผ่านได้`, { nextAt }] };
    }
    const attempt = Math.max(0, ...mine.filter(s => s.status !== 'legacy').map(s => s.attempt)) + 1;
    await cx.query(`INSERT INTO practical_sessions(user_id,lesson_id,attempt,deadline,status,minutes,policy)
                    VALUES($1,$2,$3, now() + make_interval(mins => $4), 'running', $4, $5)`, [req.user.id, wid, attempt, set.minutes, JSON.stringify(P)]);
    return { started: true };
  });
  if (result.error) return fail(res, ...result.error);
  ok(res, await stateOf(req.user.id, wid, S));
}));
router.post('/:wid/submit', pathGuard(), wrap(async (req, res) => {
  const wid = weekParam(req, res); if (!wid) return;
  const S = (await pathMod().settingsFor(req.user)).settings;
  const r = (await db.q(`UPDATE practical_sessions SET status='submitted', ended_at=now()
                         WHERE user_id=$1 AND lesson_id=$2 AND status='running' AND deadline > now() RETURNING id`, [req.user.id, wid])).rows[0];
  if (r) await storeResult(r.id, wid, policyOf(S));
  else await closeExpired(req.user.id);
  ok(res, Object.assign(await stateOf(req.user.id, wid, S), { submitted: !!r }));
}));
function pathGuard() { return (req, res, next) => pathMod().guard(r => r.params.wid)(req, res, next); }

/* ---------- teacher API (mounted under /api/teacher) ---------- */
const teacher = express.Router();
async function ownClass(req, res, id) {
  const c = (await db.q('SELECT * FROM classes WHERE id=$1', [Number(id) || 0])).rows[0];
  if (!c || (req.user.role !== 'admin' && c.teacher_id !== req.user.id)) { fail(res, 404, 'no_class', 'ไม่พบห้องเรียนนี้'); return null; }
  return c;
}
async function ownStudent(req, res, uid) {
  const s = (await db.q("SELECT u.id, u.display_name AS name, u.student_no AS no, u.class_id, c.teacher_id, c.path FROM users u JOIN classes c ON c.id=u.class_id WHERE u.id=$1 AND u.role='student'", [Number(uid) || 0])).rows[0];
  if (!s || (req.user.role !== 'admin' && s.teacher_id !== req.user.id)) { fail(res, 404, 'no_student', 'ไม่พบนักเรียนคนนี้'); return null; }
  return s;
}
/* class matrix: best practical result of every student and week, with the three part scores */
async function classMatrix(c) {
  const P = policyOf(pathMod().merge(c.path));
  const students = (await db.q(`SELECT id, display_name AS name, student_no AS no FROM users WHERE class_id=$1 AND role='student' AND NOT disabled
      ORDER BY NULLIF(regexp_replace(student_no,'\\D','','g'),'')::int NULLS LAST, display_name`, [c.id])).rows;
  const ss = students.length ? (await db.q('SELECT * FROM practical_sessions WHERE user_id = ANY($1)', [students.map(s => s.id)])).rows : [];
  for (const u of new Set(ss.filter(s => s.status === 'running' && +s.deadline <= Date.now()).map(s => s.user_id))) await closeExpired(u);
  const fresh = students.length ? (await db.q('SELECT * FROM practical_sessions WHERE user_id = ANY($1)', [students.map(s => s.id)])).rows : [];
  const items = await itemsOf(fresh.map(s => s.id));
  return { policy: P, weeks: IDS.map(wid => { const s = setOf(wid); return { id: wid, minutes: s.minutes, parts: s.parts.map(p => ({ id: p.id, title: p.title, count: p.keys.length })) }; }),
    students: students.map(st => ({ id: st.id, name: st.name, no: st.no, weeks: Object.fromEntries(IDS.map(wid => {
      const mine = fresh.filter(s => s.user_id === st.id && s.lesson_id === wid);
      const scored = mine.filter(s => FINISHED.includes(s.status) && !s.voided_at).map(s => ({ s, r: evaluate(setOf(wid), items.get(s.id), P) }));
      const best = scored.reduce((a, x) => (!a || x.r.total > a.r.total ? x : a), null);
      if (!mine.length) return [wid, null];
      return [wid, { best: best ? best.r.total : null, passed: !!(best && best.r.passed), legacy: !!(best && best.s.status === 'legacy'),
        parts: best ? Object.fromEntries(best.r.parts.map(p => [p.id, p.pct])) : null,
        attempts: mine.filter(usesAttempt).length, running: mine.some(s => s.status === 'running') }];
    })) })) };
}
teacher.get('/classes/:id/practical', wrap(async (req, res) => {
  const c = await ownClass(req, res, req.params.id); if (!c) return;
  ok(res, await classMatrix(c));
}));
teacher.get('/students/:uid/practical/:wid', wrap(async (req, res) => {
  const s = await ownStudent(req, res, req.params.uid); if (!s) return;
  const wid = String(req.params.wid); if (!IDS.includes(wid)) return fail(res, 404, 'no_week', 'ไม่พบสัปดาห์นี้');
  const st = await stateOf(s.id, wid, pathMod().merge(s.path));
  const v = (await db.q(`SELECT p.id, p.voided_at, p.void_reason, a.display_name AS by FROM practical_sessions p LEFT JOIN users a ON a.id=p.voided_by
                         WHERE p.user_id=$1 AND p.lesson_id=$2 AND p.voided_at IS NOT NULL`, [s.id, wid])).rows;
  st.sessions.forEach(x => { const y = v.find(z => z.id === x.id); if (y) Object.assign(x, { voidedAt: +y.voided_at, voidReason: y.void_reason, voidedBy: y.by }); });
  ok(res, Object.assign(st, { student: { id: s.id, name: s.name, no: s.no } }));
}));
/* give one attempt back: the session no longer counts (kept for history). A running session is stopped too. */
teacher.post('/practical/sessions/:sid/void', wrap(async (req, res) => {
  const x = (await db.q('SELECT user_id, lesson_id FROM practical_sessions WHERE id=$1', [Number(req.params.sid) || 0])).rows[0];
  if (!x) return fail(res, 404, 'no_session', 'ไม่พบรอบนี้');
  const s = await ownStudent(req, res, x.user_id); if (!s) return;
  const reason = String(req.body.reason || '').trim().slice(0, 200);
  if (!reason) return fail(res, 400, 'reason', 'ใส่เหตุผลก่อน เช่น เครื่องค้างระหว่างทำ');
  await db.q(`UPDATE practical_sessions SET voided_at=now(), voided_by=$2, void_reason=$3,
              status=CASE WHEN status='running' THEN 'submitted' ELSE status END, ended_at=COALESCE(ended_at, now())
              WHERE id=$1 AND voided_at IS NULL`, [Number(req.params.sid), req.user.id, reason]);
  ok(res, { ok: true });
}));

/* ---------- one-time migration: earlier work becomes a 'legacy' session (nothing is deleted or changed) ---------- */
async function migrate() {
  const ID = 'practical-1';
  if ((await db.q('SELECT 1 FROM app_migrations WHERE id=$1', [ID])).rowCount) return;
  let made = 0;
  const users = (await db.q("SELECT id FROM users WHERE role='student'")).rows.map(r => r.id);
  for (const uid of users) {
    const tp = new Map((await db.q('SELECT task_key, solved, points FROM task_progress WHERE user_id=$1', [uid])).rows.map(r => [r.task_key, r]));
    const sr = new Map((await db.q('SELECT sim, mission, best, max FROM sim_results WHERE user_id=$1', [uid])).rows.map(r => [`${r.sim}:${r.mission}`, r]));
    for (const wid of IDS) {
      const set = setOf(wid), rows = [];
      for (const it of set.items) {
        if (it.kind === 'task') { const r = tp.get(it.key); if (r && r.solved) rows.push([it.key, it.part, Number(r.points) || 0, 10, true]); }
        else { const r = sr.get(it.key); if (r && r.max) rows.push([it.key, it.part, Number(r.best) || 0, Number(r.max), r.best >= r.max]); }
      }
      if (!rows.length) continue;
      await db.tx(async cx => {
        const s = (await cx.query(`INSERT INTO practical_sessions(user_id,lesson_id,attempt,started_at,deadline,ended_at,status,minutes)
                                   VALUES($1,$2,0,now(),now(),now(),'legacy',$3) RETURNING id`, [uid, wid, set.minutes])).rows[0];
        for (const [item, part, score, max, solved] of rows)
          await cx.query('INSERT INTO practical_items(session_id,item,part,score,max,solved) VALUES($1,$2,$3,$4,$5,$6)', [s.id, item, part, score, max, solved]);
      });
      made++;
    }
  }
  await db.q('INSERT INTO app_migrations(id,info) VALUES($1,$2) ON CONFLICT DO NOTHING', [ID, JSON.stringify({ legacySessions: made, at: Date.now() })]);
  if (made) console.log(`Practical sessions: kept earlier work of ${made} student-week(s) as 'legacy' results`);
}

module.exports = { router, teacher, setOf, weekOfItem, evaluate, factsOf, stateOf, answerTask, hintTask, recordMission, isPracticalTask, migrate, classMatrix, policyOf, IDS };

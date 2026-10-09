'use strict';
const express = require('express');
const db = require('./db');
const auth = require('./auth');
const { TASKS, LABS, labKeys, mainKeys, PUBLIC } = require('./content');
const { check, pointsLeft, logAnswer } = require('./grading');

const router = express.Router();
router.use(express.json({ limit: '64kb' }));
// API responses are personal or change often: never stored by browsers or proxies (lesson routes override with no-cache)
router.use((req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
router.use(auth.csrfGuard);
router.use(auth.loadUser);
const gameApi = require('./game-api');
router.use(gameApi.activityTracker);
router.use(require('./account-api').router);

const ok = (res, data) => res.json(data);
const fail = (res, code, error, message) => res.status(code).json({ error, message });
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/* ---------- public ---------- */
router.get('/content', (req, res) => { res.type('json').set('Cache-Control', 'no-cache').send(PUBLIC); });

/* ---------- progress snapshot for one user ---------- */
async function progressOf(userId) {
  const P = { done: {}, att: {}, hints: {}, timers: {}, explain: {}, flags: {}, given: {} };
  const rows = (await db.q('SELECT task_key,attempts,hint_used,solved FROM task_progress WHERE user_id=$1', [userId])).rows;
  for (const r of rows) {
    if (r.attempts) P.att[r.task_key] = r.attempts;
    if (r.hint_used) P.hints[r.task_key] = true;
    if (r.solved) {
      P.done[r.task_key] = true;
      const t = TASKS.get(r.task_key);
      if (t && t.task.explain) P.explain[r.task_key] = t.task.explain;
    }
  }
  const given = (await db.q('SELECT DISTINCT ON (task_key) task_key, answer FROM attempt_log WHERE user_id=$1 AND correct ORDER BY task_key, id DESC', [userId])).rows;
  for (const g of given) if (P.done[g.task_key]) P.given[g.task_key] = g.answer;
  const runs = (await db.q('SELECT lab_id,started_at,deadline,ended_at,status FROM lab_runs WHERE user_id=$1', [userId])).rows;
  for (const r of runs) {
    const start = +r.started_at, limit = +r.deadline - start;
    let status = r.status, end = r.ended_at ? +r.ended_at : undefined;
    if (status === 'running' && Date.now() >= +r.deadline) { status = 'timeout'; end = +r.deadline; }
    P.timers[r.lab_id] = { start, limit, status, ...(end ? { end } : {}) };
  }
  for (const lab of LABS.values()) {
    if (mainKeys(lab).every(k => P.done[k])) P.flags[lab.id] = lab.flag;
  }
  return P;
}

async function assignmentsOf(user) {
  if (!user.class_id) return [];
  return (await db.q('SELECT lab_id,due_at FROM assignments WHERE class_id=$1 ORDER BY due_at NULLS LAST, id', [user.class_id]))
    .rows.map(a => ({ labId: a.lab_id, due: a.due_at ? +a.due_at : null }));
}

router.get('/me', wrap(async (req, res) => {
  if (!db.enabled()) return ok(res, { db: false, user: null });
  if (!req.user) return ok(res, { db: true, user: null });
  const u = req.user;
  let cls = null;
  if (u.class_id) {
    const c = (await db.q('SELECT c.id,c.name,c.code,t.display_name AS teacher FROM classes c JOIN users t ON t.id=c.teacher_id WHERE c.id=$1', [u.class_id])).rows[0];
    if (c) cls = { id: c.id, name: c.name, code: c.code, teacher: c.teacher };
  }
  ok(res, {
    db: true,
    now: Date.now(),
    user: { id: u.id, username: u.username, name: u.display_name, role: u.role, studentNo: u.student_no, mustChangePw: u.must_change_pw, class: cls },
    progress: await progressOf(u.id),
    lessons: await require('./lessons-api').lessonProgressOf(u.id),
    assignments: await assignmentsOf(u)
  });
}));

/* ---------- auth ---------- */
router.post('/auth/login', auth.requireDb, wrap(async (req, res) => {
  const username = String(req.body.username || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const key = auth.throttleKey(req, username);
  if (auth.isLocked(key)) return fail(res, 429, 'locked', 'ใส่รหัสผ่านผิดหลายครั้ง กรุณารอ 15 นาทีแล้วลองใหม่ หรือติดต่อครู');
  const u = (await db.q('SELECT id,password_hash,disabled FROM users WHERE username=$1', [username])).rows[0];
  if (!u || u.disabled || !auth.verifyPassword(password, u.password_hash)) {
    auth.noteFail(key);
    return fail(res, 401, 'bad_login', 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
  }
  auth.clearFails(key);
  await auth.createSession(req, res, u.id);
  ok(res, { ok: true });
}));

router.post('/auth/logout', wrap(async (req, res) => { await auth.destroySession(req, res); ok(res, { ok: true }); }));

router.post('/auth/register', auth.requireDb, auth.rateLimit(10, 80), wrap(async (req, res) => {
  const code = String(req.body.classCode || '').trim().toUpperCase();
  const username = String(req.body.username || '').trim().toLowerCase();
  const name = String(req.body.name || '').trim().slice(0, 80);
  const no = String(req.body.studentNo || '').trim().slice(0, 10);
  const password = String(req.body.password || '');
  const cls = (await db.q('SELECT id,join_open FROM classes WHERE code=$1', [code])).rows[0];
  if (!cls) return fail(res, 400, 'bad_code', 'ไม่พบรหัสห้องนี้ ตรวจสอบกับครูอีกครั้ง');
  if (!cls.join_open) return fail(res, 400, 'closed', 'ห้องนี้ปิดรับสมัครแล้ว ติดต่อครูผู้สอน');
  if (name.length < 2) return fail(res, 400, 'bad_name', 'กรุณากรอกชื่อ–นามสกุล');
  if (!/^\d{1,3}$/.test(no)) return fail(res, 400, 'bad_no', 'เลขที่ต้องเป็นตัวเลข');
  const up = auth.usernameProblem(username); if (up) return fail(res, 400, 'bad_username', up);
  const pp = auth.passwordProblem(password); if (pp) return fail(res, 400, 'bad_password', pp);
  const dupNo = await db.q("SELECT 1 FROM users WHERE class_id=$1 AND student_no=$2 AND role='student' AND NOT disabled", [cls.id, no]);
  if (dupNo.rowCount) return fail(res, 409, 'dup_no', 'เลขที่นี้มีบัญชีในห้องแล้ว ถ้าลืมรหัสผ่านให้ครูรีเซ็ตให้');
  try {
    const r = await db.q("INSERT INTO users(username,password_hash,display_name,role,class_id,student_no) VALUES($1,$2,$3,'student',$4,$5) RETURNING id",
      [username, auth.hashPassword(password), name, cls.id, no]);
    await auth.createSession(req, res, r.rows[0].id);
    ok(res, { ok: true });
  } catch (e) {
    if (e.code === '23505') return fail(res, 409, 'dup_username', 'ชื่อผู้ใช้นี้มีคนใช้แล้ว');
    throw e;
  }
}));

router.post('/auth/password', auth.requireDb, auth.requireUser, wrap(async (req, res) => {
  const u = (await db.q('SELECT password_hash FROM users WHERE id=$1', [req.user.id])).rows[0];
  if (!auth.verifyPassword(String(req.body.current || ''), u.password_hash)) return fail(res, 400, 'bad_current', 'รหัสผ่านเดิมไม่ถูกต้อง');
  const pp = auth.passwordProblem(req.body.next); if (pp) return fail(res, 400, 'bad_password', pp);
  await db.q('UPDATE users SET password_hash=$1, must_change_pw=false WHERE id=$2', [auth.hashPassword(req.body.next), req.user.id]);
  ok(res, { ok: true });
}));

/* ---------- labs: start / finish ---------- */
async function getRun(userId, labId) {
  const r = (await db.q('SELECT started_at,deadline,ended_at,status FROM lab_runs WHERE user_id=$1 AND lab_id=$2', [userId, labId])).rows[0];
  if (!r) return null;
  if (r.status === 'running' && Date.now() >= +r.deadline) {
    await db.q("UPDATE lab_runs SET status='timeout', ended_at=deadline WHERE user_id=$1 AND lab_id=$2 AND status='running'", [userId, labId]);
    r.status = 'timeout'; r.ended_at = r.deadline;
  }
  return r;
}
const timerJson = r => ({ start: +r.started_at, limit: +r.deadline - +r.started_at, status: r.status, ...(r.ended_at ? { end: +r.ended_at } : {}) });

router.post('/labs/:id/start', auth.requireDb, auth.requireUser, wrap(async (req, res) => {
  const lab = LABS.get(req.params.id); if (!lab) return fail(res, 404, 'no_lab', 'ไม่พบแล็บนี้');
  await db.q(`INSERT INTO lab_runs(user_id,lab_id,deadline) VALUES($1,$2, now() + make_interval(mins => $3)) ON CONFLICT DO NOTHING`, [req.user.id, lab.id, lab.minutes]);
  ok(res, { now: Date.now(), timer: timerJson(await getRun(req.user.id, lab.id)) });
}));

router.post('/labs/:id/finish', auth.requireDb, auth.requireUser, wrap(async (req, res) => {
  const lab = LABS.get(req.params.id); if (!lab) return fail(res, 404, 'no_lab', 'ไม่พบแล็บนี้');
  await getRun(req.user.id, lab.id);
  await db.q("UPDATE lab_runs SET status='finished', ended_at=now() WHERE user_id=$1 AND lab_id=$2 AND status='running'", [req.user.id, lab.id]);
  const r = await getRun(req.user.id, lab.id);
  ok(res, { now: Date.now(), timer: r ? timerJson(r) : null });
}));

/* ---------- hint ---------- */
router.post('/hint', auth.rateLimit(60, 1200), wrap(async (req, res) => {
  const t = TASKS.get(String(req.body.key || '')); if (!t) return fail(res, 404, 'no_task', 'ไม่พบโจทย์');
  if (req.user) {
    const run = await getRun(req.user.id, t.lab.id);
    if (!run) return fail(res, 409, 'not_started', 'กด Start ก่อนทำแล็บ');
    if (run.status !== 'running') return fail(res, 409, 'closed', 'แล็บนี้ส่งแล้วหรือหมดเวลาแล้ว');
    await db.q(`INSERT INTO task_progress(user_id,task_key,lab_id,hint_used) VALUES($1,$2,$3,true)
                ON CONFLICT (user_id,task_key) DO UPDATE SET hint_used = task_progress.hint_used OR NOT task_progress.solved, updated_at=now()`,
      [req.user.id, String(req.body.key), t.lab.id]);
  }
  ok(res, { hint: t.task.hint || '' });
}));

/* ---------- check an answer ---------- */
router.post('/check', auth.rateLimit(120, 2400), wrap(async (req, res) => {
  const key = String(req.body.key || '');
  const t = TASKS.get(key); if (!t) return fail(res, 404, 'no_task', 'ไม่พบโจทย์');
  const answer = req.body.answer;

  if (!req.user) { // guest: stateless check, nothing saved
    const c = check(t.task, answer);
    if (c.empty) return fail(res, 400, 'empty', 'ยังไม่ได้ตอบ');
    return ok(res, { correct: c.correct, detail: c.detail, given: c.correct ? logAnswer(t.task, answer) : undefined, explain: c.correct ? t.task.explain : undefined, flag: c.correct ? t.lab.flag : undefined, guest: true });
  }

  const uid = req.user.id;
  const run = await getRun(uid, t.lab.id);
  if (!run) return fail(res, 409, 'not_started', 'กด Start ก่อนทำแล็บ');
  if (run.status !== 'running') return fail(res, 409, 'closed', run.status === 'timeout' ? 'หมดเวลาแล้ว ระบบไม่รับคำตอบเพิ่ม' : 'ส่งงานแล้ว ระบบไม่รับคำตอบเพิ่ม');

  const out = await db.tx(async cx => {
    await cx.query('INSERT INTO task_progress(user_id,task_key,lab_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING', [uid, key, t.lab.id]);
    const p = (await cx.query('SELECT attempts,wrong_seen,hint_used,solved,points FROM task_progress WHERE user_id=$1 AND task_key=$2 FOR UPDATE', [uid, key])).rows[0];
    if (p.solved) { const g = (await cx.query('SELECT answer FROM attempt_log WHERE user_id=$1 AND task_key=$2 AND correct ORDER BY id DESC LIMIT 1', [uid, key])).rows[0]; return { correct: true, already: true, attempts: p.attempts, hint: p.hint_used, points: p.points, given: g && g.answer }; }
    const c = check(t.task, answer);
    if (c.empty) return { empty: true };
    await cx.query('INSERT INTO attempt_log(user_id,task_key,lab_id,correct,answer) VALUES($1,$2,$3,$4,$5)', [uid, key, t.lab.id, c.correct, logAnswer(t.task, answer)]);
    if (c.correct) {
      const pts = pointsLeft(p.attempts, p.hint_used);
      await cx.query('UPDATE task_progress SET solved=true, points=$3, solved_at=now(), updated_at=now() WHERE user_id=$1 AND task_key=$2', [uid, key, pts]);
      return { correct: true, attempts: p.attempts, hint: p.hint_used, points: pts, detail: c.detail, given: logAnswer(t.task, answer) };
    }
    let attempts = p.attempts;
    const seen = Array.isArray(p.wrong_seen) ? p.wrong_seen : [];
    if (!seen.includes(c.wrongKey)) {
      attempts++;
      seen.push(c.wrongKey);
      await cx.query('UPDATE task_progress SET attempts=$3, wrong_seen=$4, updated_at=now() WHERE user_id=$1 AND task_key=$2', [uid, key, attempts, JSON.stringify(seen.slice(-50))]);
    }
    return { correct: false, attempts, hint: p.hint_used, detail: c.detail, pointsLeft: pointsLeft(attempts, p.hint_used) };
  });
  if (out.empty) return fail(res, 400, 'empty', 'ยังไม่ได้ตอบ');

  if (out.correct) {
    out.explain = t.task.explain;
    const solved = new Set((await db.q('SELECT task_key FROM task_progress WHERE user_id=$1 AND lab_id=$2 AND solved', [uid, t.lab.id])).rows.map(r => r.task_key));
    if (mainKeys(t.lab).every(k => solved.has(k))) out.flag = t.lab.flag;
    if (labKeys(t.lab).every(k => solved.has(k))) {
      await db.q("UPDATE lab_runs SET status='finished', ended_at=now() WHERE user_id=$1 AND lab_id=$2 AND status='running'", [uid, t.lab.id]);
      out.finished = true;
    }
  }
  ok(res, out);
}));

router.use('/lessons', require('./lessons-api').router);
router.use('/sims', require('./sims-api').router);
const examsApi = require('./exams-api');
router.use('/practice', examsApi.practice);
router.use('/exams', examsApi.exams);
router.use('/teacher', auth.requireDb, auth.requireRole('teacher', 'admin'), require('./teacher'));
router.use('/teacher', auth.requireDb, auth.requireRole('teacher', 'admin'), examsApi.teacher);
router.use('/teacher', auth.requireDb, auth.requireRole('teacher', 'admin'), gameApi.teacher);
router.use('/game', gameApi.router);
router.use('/admin', auth.requireDb, auth.requireRole('admin'), require('./admin'));

router.use((req, res) => fail(res, 404, 'not_found', 'ไม่พบ API นี้'));
router.use((err, req, res, next) => {
  console.error('API error:', err);
  if (err.type === 'entity.parse.failed') return fail(res, 400, 'bad_json', 'ข้อมูลไม่ถูกต้อง');
  fail(res, 500, 'server', 'เกิดข้อผิดพลาดที่เซิร์ฟเวอร์ ลองใหม่อีกครั้ง');
});

module.exports = { router, progressOf };

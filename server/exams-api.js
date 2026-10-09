'use strict';
/* Practice mode (instant feedback) and exam mode (teacher exams, timed, graded on the server) */
const express = require('express');
const crypto = require('crypto');
const db = require('./db');
const auth = require('./auth');
const bank = require('./bank');
const { grade, answerText, givenText } = require('./bank-grade');

const ok = (res, d) => res.json(d);
const fail = (res, code, error, message) => res.status(code).json({ error, message });
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const TYPES = ['choice', 'multi', 'tf', 'match', 'order', 'fill', 'subnet', 'diagram', 'command', 'scenario'];
const nums = s => String(s || '').split(',').map(Number).filter(n => Number.isInteger(n) && n > 0);

/* ======================= practice ======================= */
const practice = express.Router();

practice.get('/info', (req, res) => ok(res, { units: bank.stats(), types: TYPES }));

practice.get('/questions', auth.rateLimit(60, 1200), (req, res) => {
  const units = nums(req.query.units).filter(u => u <= 10);
  const levels = String(req.query.levels || '').split(',').filter(l => ['easy', 'medium', 'hard'].includes(l));
  const types = String(req.query.types || '').split(',').filter(t => TYPES.includes(t));
  const ids = bank.draw({ units, levels, types, n: Math.min(30, Number(req.query.n) || 10) });
  ok(res, { questions: ids.map(id => bank.publicQ(bank.Q.get(id))) });
});

/* review mistakes: questions whose latest answer (practice or exam) was wrong */
practice.get('/mistakes', auth.requireDb, auth.requireUser, wrap(async (req, res) => {
  const uid = req.user.id, last = new Map();
  (await db.q('SELECT qid, correct, created_at FROM bank_log WHERE user_id=$1 ORDER BY created_at', [uid])).rows.forEach(r => last.set(r.qid, { ok: r.correct, t: +r.created_at }));
  (await db.q('SELECT results, submitted_at FROM exam_attempts WHERE user_id=$1 AND submitted_at IS NOT NULL', [uid])).rows.forEach(a => (a.results || []).forEach(x => {
    const p = last.get(x.id); if (!p || p.t < +a.submitted_at) last.set(x.id, { ok: !!x.correct, t: +a.submitted_at }); }));
  const ids = [...last.entries()].filter(([id, v]) => !v.ok && bank.Q.has(id)).map(([id]) => id);
  const n = Math.max(1, Math.min(30, Number(req.query.n) || 10));
  const pick = ids.sort(() => Math.random() - 0.5).slice(0, n);
  ok(res, { count: ids.length, questions: pick.map(id => bank.publicQ(bank.Q.get(id))) });
}));
/* guests keep their wrong ids in the browser and ask for those questions (public data only) */
practice.post('/byids', auth.rateLimit(30, 600), (req, res) => {
  const ids = (Array.isArray(req.body.ids) ? req.body.ids : []).map(String).filter(id => bank.Q.has(id)).slice(0, 30);
  ok(res, { questions: ids.map(id => bank.publicQ(bank.Q.get(id))) });
});

practice.post('/check', auth.rateLimit(240, 4800), wrap(async (req, res) => {
  const q = bank.Q.get(String(req.body.id || ''));
  if (!q) return fail(res, 404, 'no_q', 'ไม่พบข้อสอบนี้');
  const g = grade(q, req.body.answer);
  if (g.empty) return fail(res, 400, 'empty', 'ยังไม่ได้ตอบ');
  if (req.user && db.enabled()) await db.q('INSERT INTO bank_log(user_id,qid,correct,score) VALUES($1,$2,$3,$4)', [req.user.id, q.id, g.correct, g.score]);
  ok(res, { correct: g.correct, score: g.score, detail: g.detail, why: g.why, explain: q.explain, answer: answerText(q) });
}));

/* ======================= exams (students) ======================= */
const exams = express.Router();
exams.use(auth.requireDb, auth.requireUser);

function examState(e, now = Date.now()) {
  if (e.open_at && now < +e.open_at) return 'upcoming';
  if (e.close_at && now > +e.close_at) return 'closed';
  return 'open';
}
async function finalize(att, exam) {
  if (att.submitted_at) return att;
  const qs = att.qids.map(id => bank.Q.get(id)).filter(Boolean);
  const results = qs.map(q => { const g = grade(q, att.answers[q.id]); return { id: q.id, score: Math.round(g.score * 100) / 100, correct: g.correct, given: givenText(q, att.answers[q.id]) }; });
  const score = Math.round(results.reduce((a, r) => a + r.score, 0) * 100) / 100;
  const at = Math.min(Date.now(), +att.deadline);
  const r = await db.q(`UPDATE exam_attempts SET submitted_at=to_timestamp($3/1000.0), score=$4, max=$5, results=$6
                        WHERE exam_id=$1 AND user_id=$2 AND submitted_at IS NULL RETURNING *`,
    [att.exam_id, att.user_id, at, score, qs.length, JSON.stringify(results)]);
  return r.rows[0] || (await db.q('SELECT * FROM exam_attempts WHERE exam_id=$1 AND user_id=$2', [att.exam_id, att.user_id])).rows[0];
}
async function getAttempt(examId, userId) {
  let a = (await db.q('SELECT * FROM exam_attempts WHERE exam_id=$1 AND user_id=$2', [examId, userId])).rows[0];
  if (a && !a.submitted_at && Date.now() > +a.deadline) a = await finalize(a);
  return a;
}
const qText = q => String(q.q || q.context || '').replace(/\{\{\d+\}\}/g, '____');
const reviewOf = (att) => (att.results || []).map(r => { const q = bank.Q.get(r.id); return q ? { id: r.id, q: qText(q), type: q.type, correct: r.correct, score: r.score, given: r.given, answer: answerText(q), explain: q.explain } : null; }).filter(Boolean);

exams.get('/', wrap(async (req, res) => {
  if (!req.user.class_id) return ok(res, { exams: [] });
  const list = (await db.q('SELECT id,title,config,minutes,open_at,close_at,show_review FROM exams WHERE class_id=$1 ORDER BY COALESCE(open_at,created_at) DESC', [req.user.class_id])).rows;
  const out = [];
  for (const e of list) {
    const a = await getAttempt(e.id, req.user.id);
    out.push({ id: e.id, title: e.title, minutes: e.minutes, questions: (e.config.counts ? Object.values(e.config.counts).reduce((x, y) => x + (y | 0), 0) : 0),
      openAt: e.open_at ? +e.open_at : null, closeAt: e.close_at ? +e.close_at : null, state: examState(e),
      attempt: a ? { started: +a.started_at, deadline: +a.deadline, submitted: a.submitted_at ? +a.submitted_at : null, score: a.submitted_at ? a.score : null, max: a.max } : null });
  }
  ok(res, { exams: out, now: Date.now() });
}));

async function examForUser(req, res) {
  const e = (await db.q('SELECT * FROM exams WHERE id=$1', [Number(req.params.id) || 0])).rows[0];
  if (!e || e.class_id !== req.user.class_id) { fail(res, 404, 'no_exam', 'ไม่พบการสอบนี้'); return null; }
  return e;
}
function attemptView(e, a) {
  const done = !!a.submitted_at;
  const v = { exam: { id: e.id, title: e.title, minutes: e.minutes, showReview: e.show_review }, started: +a.started_at, deadline: +a.deadline, now: Date.now(), submitted: done ? +a.submitted_at : null };
  if (!done) { v.questions = a.qids.map(id => bank.Q.get(id)).filter(Boolean).map(bank.publicQ); v.answers = a.answers || {}; }
  else { v.score = a.score; v.max = a.max; if (e.show_review) v.review = reviewOf(a); }
  return v;
}

exams.post('/:id/start', wrap(async (req, res) => {
  const e = await examForUser(req, res); if (!e) return;
  let a = await getAttempt(e.id, req.user.id);
  if (!a) {
    const st = examState(e);
    if (st !== 'open') return fail(res, 409, st, st === 'upcoming' ? 'การสอบนี้ยังไม่เปิด' : 'การสอบนี้ปิดแล้ว');
    const qids = bank.draw({ units: e.config.units, types: e.config.types, counts: e.config.counts, seed: `${e.id}:${req.user.id}:${crypto.randomBytes(6).toString('hex')}` });
    if (!qids.length) return fail(res, 500, 'empty', 'ไม่มีข้อสอบตามเงื่อนไขนี้ แจ้งครูผู้สอน');
    let deadline = Date.now() + e.minutes * 60000;
    if (e.close_at) deadline = Math.min(deadline, +e.close_at);
    await db.q(`INSERT INTO exam_attempts(exam_id,user_id,qids,deadline) VALUES($1,$2,$3,to_timestamp($4/1000.0)) ON CONFLICT DO NOTHING`, [e.id, req.user.id, JSON.stringify(qids), deadline]);
    a = await getAttempt(e.id, req.user.id);
  }
  ok(res, attemptView(e, a));
}));

exams.put('/:id/answers', auth.rateLimit(120, 2400), wrap(async (req, res) => {
  const e = await examForUser(req, res); if (!e) return;
  const a = await getAttempt(e.id, req.user.id);
  if (!a) return fail(res, 409, 'not_started', 'ยังไม่ได้เริ่มสอบ');
  if (a.submitted_at) return fail(res, 409, 'submitted', Date.now() > +a.deadline ? 'หมดเวลาสอบแล้ว ระบบส่งคำตอบให้อัตโนมัติ' : 'ส่งข้อสอบไปแล้ว');
  const inc = req.body.answers && typeof req.body.answers === 'object' ? req.body.answers : {};
  const allowed = new Set(a.qids);
  const merged = Object.assign({}, a.answers);
  for (const k of Object.keys(inc)) if (allowed.has(k) && JSON.stringify(inc[k]).length < 4000) merged[k] = inc[k];
  await db.q('UPDATE exam_attempts SET answers=$3 WHERE exam_id=$1 AND user_id=$2 AND submitted_at IS NULL', [e.id, req.user.id, JSON.stringify(merged)]);
  ok(res, { saved: Object.keys(merged).length, at: Date.now() });
}));

exams.post('/:id/submit', wrap(async (req, res) => {
  const e = await examForUser(req, res); if (!e) return;
  let a = await getAttempt(e.id, req.user.id);
  if (!a) return fail(res, 409, 'not_started', 'ยังไม่ได้เริ่มสอบ');
  if (!a.submitted_at) {
    if (req.body.answers && typeof req.body.answers === 'object') {
      const allowed = new Set(a.qids), merged = Object.assign({}, a.answers);
      for (const k of Object.keys(req.body.answers)) if (allowed.has(k)) merged[k] = req.body.answers[k];
      await db.q('UPDATE exam_attempts SET answers=$3 WHERE exam_id=$1 AND user_id=$2 AND submitted_at IS NULL', [e.id, req.user.id, JSON.stringify(merged)]);
      a.answers = merged;
    }
    a = await finalize(a);
  }
  ok(res, attemptView(e, a));
}));

exams.get('/:id', wrap(async (req, res) => {
  const e = await examForUser(req, res); if (!e) return;
  const a = await getAttempt(e.id, req.user.id);
  if (!a) return ok(res, { exam: { id: e.id, title: e.title, minutes: e.minutes }, state: examState(e), notStarted: true });
  ok(res, attemptView(e, a));
}));

/* ======================= exams (teacher) ======================= */
const teacher = express.Router();
async function ownClass(req, res, id) {
  const c = (await db.q('SELECT * FROM classes WHERE id=$1', [Number(id) || 0])).rows[0];
  if (!c || (req.user.role !== 'admin' && c.teacher_id !== req.user.id)) { fail(res, 404, 'no_class', 'ไม่พบห้องเรียนนี้'); return null; }
  return c;
}
async function ownExam(req, res) {
  const e = (await db.q('SELECT e.*, c.teacher_id FROM exams e JOIN classes c ON c.id=e.class_id WHERE e.id=$1', [Number(req.params.eid) || 0])).rows[0];
  if (!e || (req.user.role !== 'admin' && e.teacher_id !== req.user.id)) { fail(res, 404, 'no_exam', 'ไม่พบการสอบนี้'); return null; }
  return e;
}
function parseConfig(b) {
  const units = (Array.isArray(b.units) ? b.units : []).map(Number).filter(u => u >= 1 && u <= 10);
  const counts = {}; ['easy', 'medium', 'hard'].forEach(l => { counts[l] = Math.max(0, Math.min(60, Number((b.counts || {})[l]) | 0)); });
  const types = (Array.isArray(b.types) ? b.types : []).filter(t => TYPES.includes(t));
  return { units, counts, types };
}
function validateExam(b) {
  const title = String(b.title || '').trim().slice(0, 120);
  if (title.length < 2) return { err: 'ตั้งชื่อการสอบ' };
  const config = parseConfig(b);
  if (!config.units.length) return { err: 'เลือกหน่วยการเรียนอย่างน้อย 1 หน่วย' };
  const total = config.counts.easy + config.counts.medium + config.counts.hard;
  if (total < 1 || total > 100) return { err: 'จำนวนข้อรวมต้องอยู่ระหว่าง 1–100 ข้อ' };
  const minutes = Number(b.minutes) | 0;
  if (minutes < 1 || minutes > 240) return { err: 'เวลาสอบต้องอยู่ระหว่าง 1–240 นาที' };
  const openAt = b.openAt ? new Date(b.openAt) : null, closeAt = b.closeAt ? new Date(b.closeAt) : null;
  if ((openAt && isNaN(openAt)) || (closeAt && isNaN(closeAt))) return { err: 'วันเวลาเปิด/ปิดไม่ถูกต้อง' };
  if (openAt && closeAt && closeAt <= openAt) return { err: 'เวลาปิดต้องอยู่หลังเวลาเปิด' };
  const pool = [...bank.Q.values()].filter(q => config.units.includes(q.unit) && (!config.types.length || config.types.includes(q.type)));
  if (pool.length < total) return { err: `คลังข้อสอบตามเงื่อนไขนี้มีเพียง ${pool.length} ข้อ ลดจำนวนข้อหรือเพิ่มหน่วย` };
  return { title, config, minutes, openAt, closeAt, showReview: b.showReview !== false };
}

teacher.get('/bank', (req, res) => ok(res, { units: bank.stats(), types: TYPES }));
teacher.get('/classes/:id/exams', wrap(async (req, res) => {
  const c = await ownClass(req, res, req.params.id); if (!c) return;
  const r = await db.q(`SELECT e.*, (SELECT count(*) FROM exam_attempts a WHERE a.exam_id=e.id)::int AS started,
      (SELECT count(*) FROM exam_attempts a WHERE a.exam_id=e.id AND (a.submitted_at IS NOT NULL OR a.deadline < now()))::int AS submitted,
      (SELECT round(avg(a.score/NULLIF(a.max,0))::numeric*100,1) FROM exam_attempts a WHERE a.exam_id=e.id AND a.submitted_at IS NOT NULL) AS avg_pct
      FROM exams e WHERE e.class_id=$1 ORDER BY e.created_at DESC`, [c.id]);
  ok(res, { exams: r.rows.map(e => ({ id: e.id, title: e.title, config: e.config, minutes: e.minutes, openAt: e.open_at ? +e.open_at : null, closeAt: e.close_at ? +e.close_at : null, showReview: e.show_review, started: e.started, submitted: e.submitted, avgPct: e.avg_pct == null ? null : Number(e.avg_pct), state: examState(e) })) });
}));
teacher.post('/classes/:id/exams', wrap(async (req, res) => {
  const c = await ownClass(req, res, req.params.id); if (!c) return;
  const v = validateExam(req.body); if (v.err) return fail(res, 400, 'bad', v.err);
  const r = await db.q('INSERT INTO exams(class_id,title,config,minutes,open_at,close_at,show_review,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id',
    [c.id, v.title, JSON.stringify(v.config), v.minutes, v.openAt, v.closeAt, v.showReview, req.user.id]);
  ok(res, { id: r.rows[0].id });
}));
teacher.patch('/exams/:eid', wrap(async (req, res) => {
  const e = await ownExam(req, res); if (!e) return;
  const started = (await db.q('SELECT count(*)::int n FROM exam_attempts WHERE exam_id=$1', [e.id])).rows[0].n;
  const merged = Object.assign({ title: e.title, units: e.config.units, counts: e.config.counts, types: e.config.types, minutes: e.minutes, openAt: e.open_at, closeAt: e.close_at, showReview: e.show_review }, req.body);
  if (started && ['units', 'counts', 'types'].some(k => req.body[k] !== undefined)) return fail(res, 409, 'started', 'มีนักเรียนเริ่มสอบแล้ว เปลี่ยนชุดข้อสอบไม่ได้ (แก้ชื่อ เวลา และการแสดงเฉลยได้)');
  const v = validateExam(merged); if (v.err) return fail(res, 400, 'bad', v.err);
  await db.q('UPDATE exams SET title=$2,config=$3,minutes=$4,open_at=$5,close_at=$6,show_review=$7 WHERE id=$1', [e.id, v.title, JSON.stringify(v.config), v.minutes, v.openAt, v.closeAt, v.showReview]);
  ok(res, { ok: true });
}));
teacher.delete('/exams/:eid', wrap(async (req, res) => {
  const e = await ownExam(req, res); if (!e) return;
  await db.q('DELETE FROM exams WHERE id=$1', [e.id]);
  ok(res, { ok: true });
}));

async function examReport(e) {
  const students = (await db.q(`SELECT id,display_name AS name,student_no AS no FROM users WHERE class_id=$1 AND role='student' AND NOT disabled
      ORDER BY NULLIF(regexp_replace(student_no,'\\D','','g'),'')::int NULLS LAST, display_name`, [e.class_id])).rows;
  const atts = (await db.q('SELECT * FROM exam_attempts WHERE exam_id=$1', [e.id])).rows;
  for (let i = 0; i < atts.length; i++) if (!atts[i].submitted_at && Date.now() > +atts[i].deadline) atts[i] = await finalize(atts[i]);
  const byUser = new Map(atts.map(a => [a.user_id, a]));
  const rows = students.map(s => {
    const a = byUser.get(s.id);
    return { id: s.id, no: s.no, name: s.name, status: !a ? 'none' : a.submitted_at ? 'submitted' : 'doing',
      score: a && a.submitted_at ? a.score : null, max: a ? a.max || a.qids.length : null,
      minutes: a && a.submitted_at ? Math.round((+a.submitted_at - +a.started_at) / 60000) : null };
  });
  const items = {};
  atts.filter(a => a.submitted_at).forEach(a => (a.results || []).forEach(r => {
    const it = (items[r.id] = items[r.id] || { id: r.id, n: 0, sum: 0, wrong: {} });
    it.n++; it.sum += r.score; if (!r.correct && r.given) it.wrong[r.given] = (it.wrong[r.given] || 0) + 1;
  }));
  const itemList = Object.values(items).map(it => { const q = bank.Q.get(it.id) || {};
    return { id: it.id, q: q.id ? qText(q) : '', type: q.type, level: q.level, unit: q.unit, n: it.n, pct: Math.round(it.sum / it.n * 100), answer: q.id ? answerText(q) : '',
      commonWrong: Object.entries(it.wrong).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([answer, n]) => ({ answer, n })) };
  }).sort((a, b) => a.pct - b.pct);
  const done = rows.filter(r => r.score != null);
  const avg = done.length ? Math.round(done.reduce((a, r) => a + r.score / r.max, 0) / done.length * 1000) / 10 : null;
  return { exam: { id: e.id, title: e.title, minutes: e.minutes, config: e.config, openAt: e.open_at ? +e.open_at : null, closeAt: e.close_at ? +e.close_at : null, showReview: e.show_review }, rows, items: itemList, avgPct: avg };
}
teacher.get('/exams/:eid/results', wrap(async (req, res) => {
  const e = await ownExam(req, res); if (!e) return;
  ok(res, await examReport(e));
}));
teacher.post('/exams/:eid/reset/:uid', wrap(async (req, res) => {
  const e = await ownExam(req, res); if (!e) return;
  await db.q('DELETE FROM exam_attempts WHERE exam_id=$1 AND user_id=$2', [e.id, Number(req.params.uid) || 0]);
  ok(res, { ok: true });
}));
teacher.post('/exams/:eid/extend/:uid', wrap(async (req, res) => {
  const e = await ownExam(req, res); if (!e) return;
  const mins = Math.max(1, Math.min(120, Number(req.body.minutes) | 0));
  const r = await db.q(`UPDATE exam_attempts SET deadline = GREATEST(deadline, now()) + make_interval(mins => $3) WHERE exam_id=$1 AND user_id=$2 AND submitted_at IS NULL RETURNING deadline`, [e.id, Number(req.params.uid) || 0, mins]);
  if (!r.rowCount) return fail(res, 409, 'no_attempt', 'นักเรียนคนนี้ไม่ได้กำลังสอบอยู่ (ส่งแล้วหรือยังไม่เริ่ม)');
  ok(res, { deadline: +r.rows[0].deadline });
}));
teacher.get('/exams/:eid/export.xlsx', wrap(async (req, res) => {
  const e = await ownExam(req, res); if (!e) return;
  const rep = await examReport(e);
  const ExcelJS = require('exceljs');
  const wb = new ExcelJS.Workbook(); wb.creator = 'NetLab';
  const ws = wb.addWorksheet('คะแนนสอบ');
  ws.addRow([rep.exam.title]).font = { bold: true, size: 14 };
  ws.addRow([`เวลาสอบ ${rep.exam.minutes} นาที · ค่าเฉลี่ย ${rep.avgPct == null ? '-' : rep.avgPct + '%'}`]);
  ws.addRow([]);
  const st = { none: 'ยังไม่สอบ', doing: 'กำลังสอบ', submitted: 'ส่งแล้ว' };
  ws.addRow(['เลขที่', 'ชื่อ–สกุล', 'สถานะ', 'คะแนน', 'เต็ม', 'ร้อยละ', 'เวลาที่ใช้ (นาที)']).font = { bold: true };
  rep.rows.forEach(r => ws.addRow([Number(r.no) || r.no, r.name, st[r.status], r.score ?? '', r.max ?? '', r.score != null ? Math.round(r.score / r.max * 1000) / 10 : '', r.minutes ?? '']));
  ws.columns.forEach((c, i) => { c.width = [8, 30, 12, 10, 8, 10, 16][i]; });
  const ws2 = wb.addWorksheet('วิเคราะห์รายข้อ');
  ws2.addRow(['รหัสข้อ', 'หน่วย', 'ระดับ', 'รูปแบบ', 'คำถาม', 'จำนวนคนทำ', 'ตอบถูก (%)', 'คำตอบที่ถูก', 'คำตอบผิดที่พบบ่อย']).font = { bold: true };
  rep.items.forEach(it => ws2.addRow([it.id, it.unit, it.level, it.type, it.q, it.n, it.pct, it.answer, it.commonWrong.map(w => `${w.answer} (${w.n})`).join(' ; ')]));
  ws2.columns.forEach((c, i) => { c.width = [10, 7, 9, 10, 60, 10, 10, 40, 40][i]; });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="netlab-exam-${e.id}.xlsx"`);
  await wb.xlsx.write(res); res.end();
}));

/* simulator results per class */
teacher.get('/classes/:id/sims', wrap(async (req, res) => {
  const c = await ownClass(req, res, req.params.id); if (!c) return;
  const { PUBLIC } = require('./sims-api');
  const students = (await db.q(`SELECT id,display_name AS name,student_no AS no FROM users WHERE class_id=$1 AND role='student' AND NOT disabled
      ORDER BY NULLIF(regexp_replace(student_no,'\\D','','g'),'')::int NULLS LAST, display_name`, [c.id])).rows;
  const ids = students.map(s => s.id);
  const r = ids.length ? (await db.q('SELECT user_id,sim,mission,best,max,attempts FROM sim_results WHERE user_id = ANY($1)', [ids])).rows : [];
  const map = {}; r.forEach(x => { (map[x.user_id] = map[x.user_id] || {})[x.sim + ':' + x.mission] = { best: x.best, max: x.max, attempts: x.attempts }; });
  ok(res, { sims: Object.values(PUBLIC).map(s => ({ id: s.id, title: s.title, missions: s.missions.map(m => ({ id: m.id, title: m.title, level: m.level, max: m.max })) })),
    students: students.map(s => ({ ...s, results: map[s.id] || {} })) });
}));

module.exports = { practice, exams, teacher };

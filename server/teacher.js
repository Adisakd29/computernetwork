'use strict';
const express = require('express');
const crypto = require('crypto');
const db = require('./db');
const auth = require('./auth');
const { TASKS, LABS, labKeys } = require('./content');

const router = express.Router();
const ok = (res, d) => res.json(d);
const fail = (res, code, error, message) => res.status(code).json({ error, message });
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const newCode = () => Array.from(crypto.randomBytes(6), b => CODE_CHARS[b % CODE_CHARS.length]).join('');

/* loads the class and checks the teacher owns it (admin can see all) */
async function ownClass(req, res, id) {
  const c = (await db.q('SELECT * FROM classes WHERE id=$1', [Number(id) || 0])).rows[0];
  if (!c || (req.user.role !== 'admin' && c.teacher_id !== req.user.id)) { fail(res, 404, 'no_class', 'ไม่พบห้องเรียนนี้'); return null; }
  return c;
}
async function ownStudent(req, res, uid) {
  const s = (await db.q("SELECT u.*, c.teacher_id, c.code FROM users u JOIN classes c ON c.id=u.class_id WHERE u.id=$1 AND u.role='student'", [Number(uid) || 0])).rows[0];
  if (!s || (req.user.role !== 'admin' && s.teacher_id !== req.user.id)) { fail(res, 404, 'no_student', 'ไม่พบนักเรียนคนนี้'); return null; }
  return s;
}

/* ---------- classes ---------- */
router.get('/classes', wrap(async (req, res) => {
  const all = req.user.role === 'admin';
  const r = await db.q(`SELECT c.id,c.name,c.code,c.join_open,c.created_at,t.display_name AS teacher,
      (SELECT count(*) FROM users u WHERE u.class_id=c.id AND u.role='student' AND NOT u.disabled)::int AS students,
      (SELECT count(*) FROM assignments a WHERE a.class_id=c.id)::int AS assignments,
      (SELECT count(*) FROM reset_requests r JOIN users u ON u.id=r.user_id WHERE u.class_id=c.id AND r.resolved_at IS NULL)::int AS reset_requests
      FROM classes c JOIN users t ON t.id=c.teacher_id ${all ? '' : 'WHERE c.teacher_id=$1'} ORDER BY c.created_at DESC`, all ? [] : [req.user.id]);
  ok(res, { classes: r.rows });
}));

router.post('/classes', wrap(async (req, res) => {
  const name = String(req.body.name || '').trim().slice(0, 80);
  if (name.length < 2) return fail(res, 400, 'bad_name', 'กรุณาตั้งชื่อห้องเรียน เช่น ปวช.2/1 เครือข่ายคอมพิวเตอร์');
  for (let i = 0; i < 5; i++) {
    try {
      const r = await db.q('INSERT INTO classes(name,code,teacher_id) VALUES($1,$2,$3) RETURNING id,code', [name, newCode(), req.user.id]);
      return ok(res, r.rows[0]);
    } catch (e) { if (e.code !== '23505') throw e; }
  }
  fail(res, 500, 'code', 'สร้างรหัสห้องไม่สำเร็จ ลองใหม่');
}));

router.patch('/classes/:id', wrap(async (req, res) => {
  const c = await ownClass(req, res, req.params.id); if (!c) return;
  const name = req.body.name != null ? String(req.body.name).trim().slice(0, 80) : c.name;
  const open = req.body.joinOpen != null ? !!req.body.joinOpen : c.join_open;
  if (name.length < 2) return fail(res, 400, 'bad_name', 'ชื่อห้องสั้นเกินไป');
  await db.q('UPDATE classes SET name=$2, join_open=$3 WHERE id=$1', [c.id, name, open]);
  ok(res, { ok: true });
}));

router.delete('/classes/:id', wrap(async (req, res) => {
  const c = await ownClass(req, res, req.params.id); if (!c) return;
  const n = (await db.q("SELECT count(*)::int n FROM users WHERE class_id=$1 AND role='student' AND NOT disabled", [c.id])).rows[0].n;
  if (n) return fail(res, 409, 'not_empty', `ห้องนี้ยังมีนักเรียน ${n} คน ลบนักเรียนออกก่อนจึงลบห้องได้`);
  await db.q('DELETE FROM classes WHERE id=$1', [c.id]);
  ok(res, { ok: true });
}));

router.get('/classes/:id', wrap(async (req, res) => {
  const c = await ownClass(req, res, req.params.id); if (!c) return;
  const students = (await db.q(`SELECT id,username,display_name AS name,student_no AS no,must_change_pw,last_login_at
      FROM users WHERE class_id=$1 AND role='student' AND NOT disabled
      ORDER BY NULLIF(regexp_replace(student_no,'\\D','','g'),'')::int NULLS LAST, display_name`, [c.id])).rows;
  const assignments = (await db.q('SELECT id,lab_id,due_at FROM assignments WHERE class_id=$1 ORDER BY due_at NULLS LAST,id', [c.id])).rows;
  const resetRequests = students.length ? (await db.q('SELECT r.id, r.user_id, r.note, r.created_at FROM reset_requests r WHERE r.resolved_at IS NULL AND r.user_id = ANY($1) ORDER BY r.created_at', [students.map(x => x.id)])).rows : [];
  ok(res, { class: { id: c.id, name: c.name, code: c.code, joinOpen: c.join_open, leaderboard: c.leaderboard }, students, assignments, resetRequests });
}));

/* ---------- students ---------- */
router.post('/classes/:id/students', wrap(async (req, res) => {
  const c = await ownClass(req, res, req.params.id); if (!c) return;
  const rows = Array.isArray(req.body.rows) ? req.body.rows.slice(0, 80) : [];
  const created = [], skipped = [];
  for (const row of rows) {
    const no = String(row.no || '').trim();
    const name = String(row.name || '').trim().slice(0, 80);
    if (!/^\d{1,3}$/.test(no) || name.length < 2) { skipped.push({ no, name, reason: 'เลขที่หรือชื่อไม่ถูกต้อง' }); continue; }
    const dup = await db.q("SELECT 1 FROM users WHERE class_id=$1 AND student_no=$2 AND role='student' AND NOT disabled", [c.id, no]);
    if (dup.rowCount) { skipped.push({ no, name, reason: 'เลขที่นี้มีบัญชีแล้ว' }); continue; }
    const username = `${c.code.toLowerCase()}-${no.padStart(2, '0')}`;
    const pw = auth.tempPassword();
    try {
      await db.q("INSERT INTO users(username,password_hash,display_name,role,class_id,student_no,must_change_pw,created_by) VALUES($1,$2,$3,'student',$4,$5,true,$6)",
        [username, auth.hashPassword(pw), name, c.id, no, req.user.id]);
      created.push({ no, name, username, password: pw });
    } catch (e) {
      if (e.code === '23505') skipped.push({ no, name, reason: `ชื่อผู้ใช้ ${username} มีอยู่แล้ว` }); else throw e;
    }
  }
  ok(res, { created, skipped });
}));

router.patch('/students/:uid', wrap(async (req, res) => {
  const s = await ownStudent(req, res, req.params.uid); if (!s) return;
  const name = req.body.name != null ? String(req.body.name).trim().slice(0, 80) : s.display_name;
  const no = req.body.no != null ? String(req.body.no).trim() : s.student_no;
  if (name.length < 2 || !/^\d{1,3}$/.test(no)) return fail(res, 400, 'bad', 'ชื่อหรือเลขที่ไม่ถูกต้อง');
  await db.q('UPDATE users SET display_name=$2, student_no=$3 WHERE id=$1', [s.id, name, no]);
  ok(res, { ok: true });
}));

router.post('/students/:uid/dismiss-reset', wrap(async (req, res) => {
  const s = await ownStudent(req, res, req.params.uid); if (!s) return;
  await db.q('UPDATE reset_requests SET resolved_at=now() WHERE user_id=$1 AND resolved_at IS NULL', [s.id]);
  ok(res, { ok: true });
}));
router.post('/students/:uid/reset-password', wrap(async (req, res) => {
  const s = await ownStudent(req, res, req.params.uid); if (!s) return;
  const pw = auth.tempPassword();
  await db.q('UPDATE users SET password_hash=$2, must_change_pw=true WHERE id=$1', [s.id, auth.hashPassword(pw)]);
  await db.q('DELETE FROM sessions WHERE user_id=$1', [s.id]);
  await db.q('UPDATE reset_requests SET resolved_at=now() WHERE user_id=$1 AND resolved_at IS NULL', [s.id]);
  ok(res, { username: s.username, password: pw });
}));

router.delete('/students/:uid', wrap(async (req, res) => {
  const s = await ownStudent(req, res, req.params.uid); if (!s) return;
  // keep scores for records: disable and rename so the username/number can be reused
  await db.q("UPDATE users SET disabled=true, username=username||'#'||id WHERE id=$1", [s.id]);
  await db.q('DELETE FROM sessions WHERE user_id=$1', [s.id]);
  ok(res, { ok: true });
}));

router.post('/students/:uid/labs/:lab/reset', wrap(async (req, res) => {
  const s = await ownStudent(req, res, req.params.uid); if (!s) return;
  const lab = LABS.get(req.params.lab); if (!lab) return fail(res, 404, 'no_lab', 'ไม่พบแล็บ');
  await db.tx(async cx => {
    await cx.query('DELETE FROM lab_runs WHERE user_id=$1 AND lab_id=$2', [s.id, lab.id]);
    await cx.query('DELETE FROM task_progress WHERE user_id=$1 AND lab_id=$2', [s.id, lab.id]);
  });
  ok(res, { ok: true });
}));

/* ---------- assignments ---------- */
router.post('/classes/:id/assignments', wrap(async (req, res) => {
  const c = await ownClass(req, res, req.params.id); if (!c) return;
  const labs = (Array.isArray(req.body.labIds) ? req.body.labIds : [req.body.labId]).filter(id => LABS.has(id));
  if (!labs.length) return fail(res, 400, 'no_lab', 'เลือกแล็บอย่างน้อย 1 แล็บ');
  let due = null;
  if (req.body.due) { due = new Date(req.body.due); if (isNaN(due)) return fail(res, 400, 'bad_due', 'วันส่งไม่ถูกต้อง'); }
  for (const id of labs) {
    await db.q('INSERT INTO assignments(class_id,lab_id,due_at) VALUES($1,$2,$3) ON CONFLICT (class_id,lab_id) DO UPDATE SET due_at=EXCLUDED.due_at', [c.id, id, due]);
  }
  ok(res, { ok: true, count: labs.length });
}));

router.delete('/assignments/:aid', wrap(async (req, res) => {
  const a = (await db.q('SELECT class_id FROM assignments WHERE id=$1', [Number(req.params.aid) || 0])).rows[0];
  if (!a) return fail(res, 404, 'no_assignment', 'ไม่พบงานนี้');
  const c = await ownClass(req, res, a.class_id); if (!c) return;
  await db.q('DELETE FROM assignments WHERE id=$1', [req.params.aid]);
  ok(res, { ok: true });
}));

/* ---------- reports ---------- */
async function buildReport(c) {
  const students = (await db.q(`SELECT id,username,display_name AS name,student_no AS no FROM users
      WHERE class_id=$1 AND role='student' AND NOT disabled
      ORDER BY NULLIF(regexp_replace(student_no,'\\D','','g'),'')::int NULLS LAST, display_name`, [c.id])).rows;
  const ids = students.map(s => s.id);
  const assignments = (await db.q('SELECT id,lab_id,due_at FROM assignments WHERE class_id=$1 ORDER BY due_at NULLS LAST,id', [c.id])).rows;
  const pts = ids.length ? (await db.q('SELECT user_id,lab_id,sum(points)::int pts,count(*) FILTER (WHERE solved)::int solved FROM task_progress WHERE user_id = ANY($1) GROUP BY user_id,lab_id', [ids])).rows : [];
  const runs = ids.length ? (await db.q('SELECT user_id,lab_id,started_at,deadline,ended_at,status,imported FROM lab_runs WHERE user_id = ANY($1)', [ids])).rows : [];
  const cell = {};
  const get = (u, l) => (cell[u + '|' + l] = cell[u + '|' + l] || { points: 0, solved: 0, status: 'none' });
  pts.forEach(r => { const x = get(r.user_id, r.lab_id); x.points = r.pts; x.solved = r.solved; });
  runs.forEach(r => {
    const x = get(r.user_id, r.lab_id);
    let status = r.status, end = r.ended_at;
    if (status === 'running' && Date.now() >= +r.deadline) { status = 'timeout'; end = r.deadline; }
    x.status = status; x.started = +r.started_at; if (end) x.ended = +end; if (r.imported) x.imported = true;
  });
  const labs = [...LABS.values()].map(l => ({ id: l.id, label: l.label, title: l.title, exit: !!l.exit, max: labKeys(l).length * 10, tasks: labKeys(l).length }));
  const due = {}; assignments.forEach(a => { due[a.lab_id] = a.due_at ? +a.due_at : null; });
  const rows = students.map(s => {
    const labsOut = {};
    let total = 0;
    labs.forEach(l => {
      const x = cell[s.id + '|' + l.id];
      if (!x) return;
      const late = due[l.id] && x.ended && x.ended > due[l.id];
      labsOut[l.id] = { ...x, late: !!late };
      total += x.points;
    });
    return { ...s, labs: labsOut, total };
  });
  const missing = assignments.map(a => ({
    labId: a.lab_id, due: a.due_at ? +a.due_at : null,
    notSubmitted: rows.filter(r => !r.labs[a.lab_id] || !['finished', 'timeout'].includes(r.labs[a.lab_id].status)).map(r => ({ id: r.id, no: r.no, name: r.name, status: r.labs[a.lab_id] ? r.labs[a.lab_id].status : 'none' }))
  }));
  return { class: { id: c.id, name: c.name, code: c.code }, labs, assignments: assignments.map(a => ({ id: a.id, labId: a.lab_id, due: a.due_at ? +a.due_at : null })), rows, missing };
}

router.get('/classes/:id/report', wrap(async (req, res) => {
  const c = await ownClass(req, res, req.params.id); if (!c) return;
  ok(res, await buildReport(c));
}));

router.get('/classes/:id/stats', wrap(async (req, res) => {
  const c = await ownClass(req, res, req.params.id); if (!c) return;
  const r = await db.q(`SELECT a.task_key,
        count(*) FILTER (WHERE NOT a.correct)::int AS wrong,
        count(DISTINCT a.user_id) FILTER (WHERE NOT a.correct)::int AS students_wrong,
        count(DISTINCT a.user_id)::int AS students
      FROM attempt_log a JOIN users u ON u.id=a.user_id
      WHERE u.class_id=$1 AND u.role='student' AND NOT u.disabled
      GROUP BY a.task_key HAVING count(*) FILTER (WHERE NOT a.correct) > 0
      ORDER BY students_wrong DESC, wrong DESC LIMIT 25`, [c.id]);
  const common = await db.q(`SELECT a.task_key, a.answer, count(*)::int n FROM attempt_log a JOIN users u ON u.id=a.user_id
      WHERE u.class_id=$1 AND NOT a.correct AND a.task_key = ANY($2) GROUP BY a.task_key,a.answer ORDER BY n DESC`, [c.id, r.rows.map(x => x.task_key)]);
  const top = {}; common.rows.forEach(x => { (top[x.task_key] = top[x.task_key] || []).length < 3 && top[x.task_key].push({ answer: x.answer, n: x.n }); });
  ok(res, {
    items: r.rows.map(x => {
      const t = TASKS.get(x.task_key);
      return { ...x, labId: t ? t.lab.id : null, label: t ? t.lab.label : '', title: t ? t.lab.title : '', no: t ? (t.vm ? 'VM' : '') + (t.i + 1) : '', q: t ? t.task.q : x.task_key, commonWrong: top[x.task_key] || [] };
    })
  });
}));

/* ---------- pre-test vs post-test ---------- */
async function buildPrePost(c) {
  const { LESSONS } = require('./lessons');
  const students = (await db.q(`SELECT id,display_name AS name,student_no AS no FROM users WHERE class_id=$1 AND role='student' AND NOT disabled
      ORDER BY NULLIF(regexp_replace(student_no,'\\D','','g'),'')::int NULLS LAST, display_name`, [c.id])).rows;
  const ids = students.map(s => s.id);
  const rows = ids.length ? (await db.q('SELECT user_id,lesson_id,kind,score,max FROM quiz_attempts WHERE user_id = ANY($1)', [ids])).rows : [];
  const map = {};
  rows.forEach(r => { (map[r.user_id + '|' + r.lesson_id] = map[r.user_id + '|' + r.lesson_id] || {})[r.kind] = r.score; });
  const lessons = [...LESSONS.values()].map(L => {
    const pre = [], post = [], gain = [];
    students.forEach(s => { const x = map[s.id + '|' + L.id] || {}; if (x.pre != null) pre.push(x.pre); if (x.post != null) post.push(x.post); if (x.pre != null && x.post != null) gain.push(x.post - x.pre); });
    const avg = a => a.length ? Math.round(a.reduce((p, v) => p + v, 0) / a.length * 10) / 10 : null;
    return { id: L.id, week: L.week, title: L.title, max: L.quiz.length, preCount: pre.length, postCount: post.length, preAvg: avg(pre), postAvg: avg(post), gainAvg: avg(gain), pairs: gain.length };
  });
  return { students: students.map(s => ({ ...s, scores: Object.fromEntries([...LESSONS.keys()].map(id => [id, map[s.id + '|' + id] || {}])) })), lessons };
}
router.get('/classes/:id/prepost', wrap(async (req, res) => {
  const c = await ownClass(req, res, req.params.id); if (!c) return;
  ok(res, await buildPrePost(c));
}));
router.post('/students/:uid/lessons/:lid/reset-quiz', wrap(async (req, res) => {
  const s = await ownStudent(req, res, req.params.uid); if (!s) return;
  const kind = ['pre', 'post'].includes(req.body.kind) ? req.body.kind : 'post';
  await db.q('DELETE FROM quiz_attempts WHERE user_id=$1 AND lesson_id=$2 AND kind=$3', [s.id, req.params.lid, kind]);
  ok(res, { ok: true });
}));

router.get('/classes/:id/export.xlsx', wrap(async (req, res) => {
  const c = await ownClass(req, res, req.params.id); if (!c) return;
  const rep = await buildReport(c);
  const ExcelJS = require('exceljs');
  const wb = new ExcelJS.Workbook();
  wb.creator = 'NetLab';
  const statusTh = { none: 'ยังไม่เริ่ม', running: 'กำลังทำ', finished: 'ส่งแล้ว', timeout: 'หมดเวลา' };
  const used = rep.labs.filter(l => rep.assignments.some(a => a.labId === l.id) || rep.rows.some(r => r.labs[l.id]));

  const ws = wb.addWorksheet('คะแนน');
  ws.addRow([`${rep.class.name} (รหัสห้อง ${rep.class.code})`]).font = { bold: true, size: 14 };
  ws.addRow([`ส่งออกเมื่อ ${new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })}`]);
  ws.addRow([]);
  const head = ['เลขที่', 'ชื่อ–สกุล', 'ชื่อผู้ใช้', ...used.map(l => `${l.label} (${l.max})`), 'รวม'];
  const hr = ws.addRow(head); hr.font = { bold: true }; hr.alignment = { wrapText: true, vertical: 'middle' };
  rep.rows.forEach(r => ws.addRow([Number(r.no) || r.no, r.name, r.username, ...used.map(l => r.labs[l.id] ? r.labs[l.id].points : ''), r.total]));
  ws.columns.forEach((col, i) => { col.width = i === 1 ? 28 : i === 2 ? 16 : 12; });
  ws.views = [{ state: 'frozen', xSplit: 2, ySplit: 4 }];

  const ws2 = wb.addWorksheet('สถานะงานที่มอบหมาย');
  const h2 = ws2.addRow(['แล็บ', 'กำหนดส่ง', 'เลขที่', 'ชื่อ–สกุล', 'สถานะ', 'คะแนน', 'เวลาที่ใช้ (นาที)', 'ส่งช้า']); h2.font = { bold: true };
  rep.assignments.forEach(a => {
    const l = rep.labs.find(x => x.id === a.labId);
    rep.rows.forEach(r => {
      const x = r.labs[a.labId];
      ws2.addRow([`${l.label} ${l.title}`, a.due ? new Date(a.due).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' }) : '-', Number(r.no) || r.no, r.name,
        statusTh[x ? x.status : 'none'], x ? x.points : 0, x && x.ended && x.started ? Math.round((x.ended - x.started) / 60000) : '', x && x.late ? 'ช้า' : '']);
    });
  });
  ws2.columns.forEach((col, i) => { col.width = [36, 20, 8, 28, 12, 10, 16, 8][i]; });

  const pp = await buildPrePost(c);
  const ws3 = wb.addWorksheet('ก่อนเรียน-หลังเรียน');
  const h3 = ws3.addRow(['สัปดาห์', 'บทเรียน', 'คะแนนเต็ม', 'ทำก่อนเรียน (คน)', 'เฉลี่ยก่อนเรียน', 'ทำหลังเรียน (คน)', 'เฉลี่ยหลังเรียน', 'พัฒนาการเฉลี่ย']); h3.font = { bold: true };
  pp.lessons.forEach(l => ws3.addRow([l.week, l.title, l.max, l.preCount, l.preAvg ?? '', l.postCount, l.postAvg ?? '', l.gainAvg ?? '']));
  ws3.addRow([]);
  const h4 = ws3.addRow(['เลขที่', 'ชื่อ–สกุล', ...pp.lessons.flatMap(l => [`ส.${l.week} ก่อน`, `ส.${l.week} หลัง`])]); h4.font = { bold: true };
  pp.students.forEach(st => ws3.addRow([Number(st.no) || st.no, st.name, ...pp.lessons.flatMap(l => [st.scores[l.id].pre ?? '', st.scores[l.id].post ?? ''])]));
  ws3.columns.forEach((col, i) => { col.width = i === 1 ? 40 : 12; });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="netlab-${c.code}.xlsx"`);
  await wb.xlsx.write(res);
  res.end();
}));

module.exports = router;

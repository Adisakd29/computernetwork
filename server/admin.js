'use strict';
const express = require('express');
const db = require('./db');
const auth = require('./auth');

const router = express.Router();
const ok = (res, d) => res.json(d);
const fail = (res, code, error, message) => res.status(code).json({ error, message });
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.get('/teachers', wrap(async (req, res) => {
  const r = await db.q(`SELECT u.id,u.username,u.display_name AS name,u.role,u.disabled,u.last_login_at,
      (SELECT count(*) FROM classes c WHERE c.teacher_id=u.id)::int AS classes,
      EXISTS(SELECT 1 FROM reset_requests r WHERE r.user_id=u.id AND r.resolved_at IS NULL) AS reset_request
      FROM users u WHERE u.role IN ('teacher','admin') ORDER BY u.role, u.display_name`);
  ok(res, { teachers: r.rows });
}));

router.post('/teachers', wrap(async (req, res) => {
  const username = String(req.body.username || '').trim().toLowerCase();
  const name = String(req.body.name || '').trim().slice(0, 80);
  const up = auth.usernameProblem(username); if (up) return fail(res, 400, 'bad_username', up);
  if (name.length < 2) return fail(res, 400, 'bad_name', 'กรุณากรอกชื่อครู');
  const pw = auth.tempPassword(10);
  try {
    await db.q("INSERT INTO users(username,password_hash,display_name,role,must_change_pw,created_by) VALUES($1,$2,$3,'teacher',true,$4)",
      [username, auth.hashPassword(pw), name, req.user.id]);
  } catch (e) {
    if (e.code === '23505') return fail(res, 409, 'dup', 'ชื่อผู้ใช้นี้มีอยู่แล้ว');
    throw e;
  }
  ok(res, { username, password: pw });
}));

router.post('/teachers/:id/reset-password', wrap(async (req, res) => {
  const t = (await db.q("SELECT id,username FROM users WHERE id=$1 AND role='teacher'", [Number(req.params.id) || 0])).rows[0];
  if (!t) return fail(res, 404, 'no_teacher', 'ไม่พบบัญชีครู');
  const pw = auth.tempPassword(10);
  await db.q('UPDATE users SET password_hash=$2, must_change_pw=true WHERE id=$1', [t.id, auth.hashPassword(pw)]);
  await db.q('DELETE FROM sessions WHERE user_id=$1', [t.id]);
  await db.q('UPDATE reset_requests SET resolved_at=now() WHERE user_id=$1 AND resolved_at IS NULL', [t.id]);
  ok(res, { username: t.username, password: pw });
}));

router.patch('/teachers/:id', wrap(async (req, res) => {
  const t = (await db.q("SELECT id FROM users WHERE id=$1 AND role='teacher'", [Number(req.params.id) || 0])).rows[0];
  if (!t) return fail(res, 404, 'no_teacher', 'ไม่พบบัญชีครู');
  await db.q('UPDATE users SET disabled=$2 WHERE id=$1', [t.id, !!req.body.disabled]);
  if (req.body.disabled) await db.q('DELETE FROM sessions WHERE user_id=$1', [t.id]);
  ok(res, { ok: true });
}));

/* full JSON backup (password hashes excluded) */
router.get('/backup', wrap(async (req, res) => {
  const out = { exportedAt: new Date().toISOString(), version: 1 };
  out.users = (await db.q('SELECT id,username,display_name,role,class_id,student_no,disabled,created_at,last_login_at FROM users ORDER BY id')).rows;
  out.classes = (await db.q('SELECT * FROM classes ORDER BY id')).rows;
  out.assignments = (await db.q('SELECT * FROM assignments ORDER BY id')).rows;
  out.lab_runs = (await db.q('SELECT * FROM lab_runs')).rows;
  out.task_progress = (await db.q('SELECT user_id,task_key,lab_id,attempts,hint_used,solved,points,solved_at FROM task_progress')).rows;
  out.attempt_log = (await db.q('SELECT * FROM attempt_log ORDER BY id')).rows;
  res.setHeader('Content-Disposition', `attachment; filename="netlab-backup-${new Date().toISOString().slice(0, 10)}.json"`);
  ok(res, out);
}));

module.exports = router;

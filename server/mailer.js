'use strict';
/* Outgoing e-mail for account links (verify address, reset password).
   Configure ONE of these on the server (Railway → Variables); secrets never go in the source code:
     SMTP_URL=smtps://USER:APP_PASSWORD@smtp.gmail.com:465      (any SMTP server, e.g. Gmail with an App Password)
     RESEND_API_KEY=re_xxx                                       (https://resend.com HTTP API)
   plus MAIL_FROM="NetLab <no-reply@your-domain>" and PUBLIC_URL=https://computernetwork.up.railway.app
   For local tests only (never in production): MAIL_DEV_DIR=/tmp/mails writes each message to a JSON file. */
const fs = require('fs');
const path = require('path');

const PROD = process.env.NODE_ENV === 'production';
const DEV_DIR = !PROD && process.env.MAIL_DEV_DIR ? process.env.MAIL_DEV_DIR : null;
let smtp = null;
function transport() {
  if (process.env.SMTP_URL) { if (!smtp) smtp = require('nodemailer').createTransport(process.env.SMTP_URL); return 'smtp'; }
  if (process.env.RESEND_API_KEY) return 'resend';
  if (DEV_DIR) return 'dev';
  return null;
}
const enabled = () => !!transport();
const from = () => process.env.MAIL_FROM || 'NetLab <no-reply@netlab.local>';

async function send({ to, subject, text, html }) {
  const t = transport();
  if (!t) throw Object.assign(new Error('mail not configured'), { code: 'no_mail' });
  if (t === 'dev') {
    fs.mkdirSync(DEV_DIR, { recursive: true });
    fs.writeFileSync(path.join(DEV_DIR, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.json`), JSON.stringify({ to, subject, text, html, at: Date.now() }));
    return;
  }
  if (t === 'smtp') { await smtp.sendMail({ from: from(), to, subject, text, html }); return; }
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST', headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: from(), to: [to], subject, text, html })
  });
  if (!r.ok) throw new Error('resend ' + r.status + ' ' + (await r.text()).slice(0, 200));
}

/* links always use PUBLIC_URL in production so a forged Host header cannot redirect a reset link elsewhere */
function baseUrl(req) {
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/+$/, '');
  if (PROD) throw Object.assign(new Error('PUBLIC_URL not set'), { code: 'no_public_url' });
  return `${req.protocol}://${req.get('host')}`;
}
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function layout(title, intro, button, link, foot) {
  const text = `${title}\n\n${intro}\n\n${link}\n\n${foot}\n\nNetLab ห้องปฏิบัติการเครือข่ายคอมพิวเตอร์`;
  const html = `<!doctype html><html lang="th"><body style="margin:0;background:#eef2f7;font-family:Tahoma,Arial,sans-serif;color:#1d2733">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:28px 12px">
<table role="presentation" width="100%" style="max-width:520px;background:#ffffff;border-radius:14px;border:1px solid #dbe3ec" cellpadding="0" cellspacing="0">
<tr><td style="padding:26px 28px 8px;font-size:20px;font-weight:bold;color:#1f5fbf">NetLab</td></tr>
<tr><td style="padding:4px 28px;font-size:18px;font-weight:bold">${esc(title)}</td></tr>
<tr><td style="padding:10px 28px;font-size:15px;line-height:1.7">${esc(intro)}</td></tr>
<tr><td style="padding:14px 28px"><a href="${esc(link)}" style="display:inline-block;background:#1f5fbf;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:10px">${esc(button)}</a></td></tr>
<tr><td style="padding:6px 28px 24px;font-size:13px;line-height:1.6;color:#5b6876">${esc(foot)}<br>ถ้ากดปุ่มไม่ได้ ให้คัดลอกลิงก์นี้ไปเปิดในเบราว์เซอร์: <span style="word-break:break-all">${esc(link)}</span></td></tr>
</table></td></tr></table></body></html>`;
  return { text, html };
}
function verifyMail(name, link) {
  return { subject: 'ยืนยันอีเมลเพื่อเริ่มใช้ NetLab', ...layout(`สวัสดี ${name}`, 'กดปุ่มด้านล่างเพื่อยืนยันว่าอีเมลนี้เป็นของคุณ แล้วบัญชี NetLab จะพร้อมใช้งาน', 'ยืนยันอีเมล', link, 'ลิงก์นี้ใช้ได้ภายใน 24 ชั่วโมงและใช้ได้ครั้งเดียว ถ้าคุณไม่ได้สมัคร NetLab ไม่ต้องทำอะไร บัญชีที่ไม่ยืนยันจะถูกลบอัตโนมัติ') };
}
function resetMail(name, link) {
  return { subject: 'ตั้งรหัสผ่าน NetLab ใหม่', ...layout(`สวัสดี ${name}`, 'มีคำขอตั้งรหัสผ่านใหม่สำหรับบัญชี NetLab ที่ใช้อีเมลนี้ กดปุ่มด้านล่างเพื่อตั้งรหัสผ่านใหม่', 'ตั้งรหัสผ่านใหม่', link, 'ลิงก์นี้ใช้ได้ภายใน 30 นาทีและใช้ได้ครั้งเดียว เมื่อเปลี่ยนรหัสผ่านแล้ว ทุกอุปกรณ์ที่เข้าสู่ระบบอยู่จะถูกออกจากระบบ ถ้าคุณไม่ได้ขอ ไม่ต้องทำอะไร รหัสผ่านเดิมยังใช้ได้') };
}
module.exports = { enabled, send, baseUrl, verifyMail, resetMail, transport };

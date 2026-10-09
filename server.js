// NetLab web server for Railway (or any Node host)
'use strict';
const express = require('express');
const path = require('path');
const fs = require('fs');
const db = require('./server/db');
const auth = require('./server/auth');

const app = express();
const PORT = process.env.PORT || 3000;
const PUBLIC = path.join(__dirname, 'public');

app.set('trust proxy', 1); // Railway sits behind a proxy (needed for req.ip and secure cookies)
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  next();
});

app.use('/api', require('./server/api').router);

// VM files are large and never change, so let browsers cache them
app.use('/v86', express.static(path.join(PUBLIC, 'v86'), {
  maxAge: '7d',
  setHeaders: (res, file) => {
    if (file.endsWith('.wasm')) res.setHeader('Content-Type', 'application/wasm');
  }
}));

app.get('/teacher', (req, res) => res.redirect('/teacher.html'));

/* service worker: the version is a hash of the app files, so every deploy that changes them installs a new one */
const SW_FILES = ['/', '/index.html', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png', '/icons/maskable-192.png', '/icons/apple-touch-icon.png', '/icons/favicon-32.png']
  .concat(['diagrams', 'diagrams2', 'widgets', 'widgets2', 'core', 'lab', 'practice', 'game', 'app', 'pwa'].map(n => `/js/${n}.js`))
  .concat(['netsim', 'topology', 'subnet', 'crimp', 'terminal', 'troubleshoot'].map(n => `/js/sim/${n}.js`));
let SW_BODY = null;
function swBody() {
  if (SW_BODY && process.env.NODE_ENV === 'production') return SW_BODY;
  const crypto = require('crypto'); const h = crypto.createHash('sha256');
  for (const f of SW_FILES) { const p = path.join(PUBLIC, f === '/' ? 'index.html' : f); try { h.update(fs.readFileSync(p)); } catch (e) { /* missing file */ } }
  const ver = require('./package.json').version + '-' + h.digest('hex').slice(0, 10);
  SW_BODY = fs.readFileSync(path.join(PUBLIC, 'sw.js'), 'utf8').replace('__VERSION__', ver).replace('__FILES__', JSON.stringify(SW_FILES));
  return SW_BODY;
}
app.get('/sw.js', (req, res) => {
  res.setHeader('Content-Type', 'text/javascript; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Service-Worker-Allowed', '/');
  res.send(swBody());
});

app.use(express.static(PUBLIC, {
  etag: true,
  setHeaders: (res, file) => {
    // หน้าเว็บต้องไม่ถูกแคช เพื่อให้นักเรียนได้เวอร์ชันล่าสุดเสมอ
    if (/\.(html|js|css|webmanifest)$/.test(file)) res.setHeader('Cache-Control', 'no-cache');
    if (file.endsWith('.webmanifest')) res.setHeader('Content-Type', 'application/manifest+json');
  }
}));

app.get('/healthz', (req, res) => res.send('ok'));

// ตรวจว่าไฟล์ VM ครบไหม เปิดดูได้ที่ /vm-status
const VM_FILES = ['libv86.js', 'v86.wasm', 'seabios.bin', 'vgabios.bin', 'buildroot-bzimage.bin'];
app.get('/vm-status', (req, res) => {
  const files = VM_FILES.map(name => {
    const f = path.join(PUBLIC, 'v86', name);
    const ok = fs.existsSync(f);
    return { name, ok, size: ok ? fs.statSync(f).size : 0 };
  });
  res.json({ ready: files.every(f => f.ok && f.size > 0), database: db.enabled(), files });
});

async function start() {
  try {
    await db.init();
    await auth.ensureAdmin();
  } catch (e) {
    console.error('Database connection failed, running in guest-only mode:', e.message);
    await db.close().catch(() => {});
  }
  return app.listen(PORT, () => console.log(`NetLab is running on port ${PORT}`));
}

if (require.main === module) start();
module.exports = { app, start };

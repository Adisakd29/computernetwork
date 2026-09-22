// NetLab web server for Railway (or any Node host)
const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const PUBLIC = path.join(__dirname, 'public');

// VM files are large and never change, so let browsers cache them
app.use('/v86', express.static(path.join(PUBLIC, 'v86'), {
  maxAge: '7d',
  setHeaders: (res, file) => {
    if (file.endsWith('.wasm')) res.setHeader('Content-Type', 'application/wasm');
  }
}));

app.use(express.static(PUBLIC, { maxAge: '5m' }));

app.get('/healthz', (req, res) => res.send('ok'));

// ตรวจว่าไฟล์ VM ครบไหม เปิดดูได้ที่ /vm-status
const VM_FILES = ['libv86.js', 'v86.wasm', 'seabios.bin', 'vgabios.bin', 'buildroot-bzimage.bin'];
app.get('/vm-status', (req, res) => {
  const files = VM_FILES.map(name => {
    const f = path.join(PUBLIC, 'v86', name);
    const ok = fs.existsSync(f);
    return { name, ok, size: ok ? fs.statSync(f).size : 0 };
  });
  res.json({ ready: files.every(f => f.ok && f.size > 0), files });
});

app.listen(PORT, () => {
  console.log(`NetLab is running on port ${PORT}`);
});

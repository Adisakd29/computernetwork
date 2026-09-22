// Prepares the files the Linux VM needs in public/v86/
// Runs automatically on Railway during "npm run build".
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'public', 'v86');
fs.mkdirSync(OUT, { recursive: true });

// 1) v86 emulator from node_modules
const v86Dir = path.dirname(require.resolve('v86/package.json'));
for (const f of ['libv86.js', 'v86.wasm']) {
  fs.copyFileSync(path.join(v86Dir, 'build', f), path.join(OUT, f));
  console.log('copied', f);
}

// 2) BIOS and Linux image (downloaded once; skipped if already present)
const DOWNLOADS = [
  ['seabios.bin', 'https://raw.githubusercontent.com/copy/v86/master/bios/seabios.bin'],
  ['vgabios.bin', 'https://raw.githubusercontent.com/copy/v86/master/bios/vgabios.bin'],
  ['buildroot-bzimage.bin', [
    process.env.VM_IMAGE_URL,                         // ครูกำหนดเองได้ (ถ้ามี)
    'https://i.copy.sh/buildroot-bzimage68.bin',      // ที่อยู่ปัจจุบันตาม README ของ v86
    'https://k.copy.sh/buildroot-bzimage.bin'         // ที่อยู่เก่า (สำรอง)
  ].filter(Boolean)]
];

(async () => {
  let failed = 0;
  for (const [name, urls] of DOWNLOADS) {
    const dest = path.join(OUT, name);
    if (fs.existsSync(dest) && fs.statSync(dest).size > 100000 || (fs.existsSync(dest) && !name.includes('bzimage') && fs.statSync(dest).size > 0)) {
      console.log('exists, skip', name);
      continue;
    }
    let ok = false;
    for (const url of [].concat(urls)) {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const buf = Buffer.from(await res.arrayBuffer());
        if (name.includes('bzimage') && buf.length < 100000) throw new Error('file too small (' + buf.length + ' bytes)');
        fs.writeFileSync(dest, buf);
        console.log('downloaded', name, 'from', url, buf.length, 'bytes');
        ok = true;
        break;
      } catch (e) {
        console.warn(`WARNING: could not download ${name} from ${url} (${e.message})`);
      }
    }
    if (!ok) failed++;
  }
  if (failed) {
    console.warn('Some VM files are missing. The site still works, but the Linux VM button will show an error.');
    console.warn('See README.md section "ถ้า VM เปิดไม่ได้".');
  }
})();

'use strict';
/* the app scripts share one global scope: a top-level const/let/function name declared in two files breaks the page */
const fs = require('fs'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
const files = [...html.matchAll(/<script[^>]+src="(js\/[^"?]+\.js)/g)].map(m => m[1]);
/* the figure files are loaded on demand by loadFigures() in js/app.js (FIG_FILES), not by script tags; they share the same global scope */
const appSrc = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'app.js'), 'utf8');
const figList = (appSrc.match(/const FIG_FILES=\[([^\]]*)\]/) || [])[1];
if (!figList) { console.log('  x FIG_FILES not found in js/app.js'); process.exit(1); }
const figs = [...figList.matchAll(/'([\w-]+)'/g)].map(m => `js/${m[1]}.js`);
for (const f of figs) { if (!fs.existsSync(path.join(__dirname, '..', 'public', f))) { console.log(`  x ${f} listed in FIG_FILES does not exist`); process.exit(1); } }
files.unshift(...figs.filter(f => !files.includes(f)));
const seen = new Map(); let bad = 0;
for (const f of files) {
  const src = fs.readFileSync(path.join(__dirname, '..', 'public', f), 'utf8');
  if (/^\s*\(function|^\s*\(\(\)|^'use strict';\s*\(function/m.test(src.slice(0, 400)) && !/^(const|let|function) /m.test(src)) continue;
  for (const m of src.matchAll(/^(?:const|let|class|function|async function)\s+([A-Za-z_$][\w$]*)/gm)) {
    const n = m[1];
    if (seen.has(n) && seen.get(n) !== f) { bad++; console.log(`  x ${n} declared in ${seen.get(n)} and ${f}`); }
    else seen.set(n, f);
  }
}
console.log(`globals: ${files.length} scripts, ${seen.size} top-level names, ${bad} clash(es)`);
process.exit(bad ? 1 : 0);

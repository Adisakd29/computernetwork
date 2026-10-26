// Every browser script must parse (the simulator unit tests load only the DOM-free engines, so a syntax error in the UI
// part of a module would otherwise surface only in the browser): node tests/syntax-check.js
'use strict';
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const dir = path.join(__dirname, '..', 'public', 'js');
const files = [];
(function walk(d) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else if (f.endsWith('.js')) files.push(p); } })(dir);
let bad = 0;
for (const f of files) { try { execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' }); } catch (e) { bad++; console.log('✗', path.relative(dir, f), String(e.stderr).split('\n').slice(0, 4).join('\n')); } }
console.log(`syntax: ${files.length} scripts, ${bad} error(s)`);
process.exit(bad ? 1 : 0);

// Validates lesson files against content/lessons/SPEC.md
// usage: node tests/lessons-check.js            (all lessons found)
//        node tests/lessons-check.js w1 w2 w3   (selected)
'use strict';
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'content', 'lessons');
const DIAGRAMS = ['net-components', 'lan-man-wan', 'p2p-vs-cs', 'topologies', 'network-devices', 'cable-types', 'connectors', 'osi-tcpip', 'encapsulation', 'ip-classes', 'utp-pinout', 'straight-cross', 'wifi-modes', 'wifi-bands', 'unc-share', 'nos-services', 'vm-layers', 'lab-network-plan', 'ping-ladder', 'firewall', 'defense-layers', 'users-groups', 'linux-perms',
  'wlan-devices', 'wifi-security-timeline', 'windows-ip-settings', 'nos-vs-os', 'hypervisor-types', 'vm-netmodes', 'rack-layout', 'routing-decision', 'troubleshoot-flow', 'malware-types', 'backup-321', 'firewall-profiles', 'cable-path-strip'];
const WIDGETS = ['topology-sim', 'hub-switch-sim', 'osi-explorer', 'encap-stepper', 'ip-calc', 'bandwidth-calc', 'pinout-viewer', 'wifi-security-check', 'ping-ladder', 'firewall-tester', 'caesar', 'perm-calc', 'port-lookup',
  'ipv6-tool', 'subnet-splitter', 'route-lookup', 'nic-config', 'share-ntfs', 'vm-netmode', 'threat-sorter', 'backup-321'];
// figures added in NetLab 2.6 (public/js/figs-*.js): discover registered names so new files need no list edits
for (const f of fs.readdirSync(path.join(__dirname, '..', 'public', 'js')).filter(f => /^figs-.*\.js$/.test(f))) {
  const src = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', f), 'utf8');
  for (const m of src.matchAll(/NL_FIG\(\s*'(diagram|widget)'\s*,\s*'([a-z0-9-]+)'/g)) (m[1] === 'diagram' ? DIAGRAMS : WIDGETS).push(m[2]);
}
const BLOCKS = ['p', 'list', 'steps', 'table', 'term', 'diagram', 'widget', 'example', 'note', 'check', 'photo', 'photos'];
const PHM = require('../content/photos');   // real photos: a block's ids must exist in content/photos.js and have both files
const photoErr = b => { const ids = PHM.photoIds(b); if (!ids.length) return 'photo block names no photo'; if (b.type === 'photos' && (ids.length < 2 || ids.length > 4)) return 'photos gallery needs 2-4 names';
  const miss = ids.find(id => !PHM.PHOTOS[id]); if (miss) return 'unknown photo id ' + miss;
  const nf = ids.find(id => ![PHM.PHOTOS[id].file, PHM.smallOf(PHM.PHOTOS[id].file)].every(f => fs.existsSync(path.join(PHM.PUBDIR, f)))); return nf ? 'missing photo file for ' + nf : null; };

function checkQ(q, where, errs) {
  const e = m => errs.push(`${where}: ${m}`);
  if (!q || typeof q !== 'object') return e('missing question object');
  if (!['easy', 'medium', 'hard'].includes(q.level)) e('level must be easy|medium|hard');
  if (!q.q || typeof q.q !== 'string') e('missing q text');
  if (!q.explain || q.explain.length < 10) e('missing/short explain');
  switch (q.type) {
    case 'choice':
      if (!Array.isArray(q.options) || q.options.length < 2) e('choice needs options');
      else {
        if (!Number.isInteger(q.correct) || q.correct < 0 || q.correct >= q.options.length) e('correct index out of range');
        if (new Set(q.options).size !== q.options.length) e('duplicate options');
        if (q.why && q.why.length !== q.options.length) e('why[] length must equal options length');
      }
      break;
    case 'multi':
      if (!Array.isArray(q.options) || q.options.length < 3) e('multi needs >=3 options');
      if (!Array.isArray(q.correct) || !q.correct.length || q.correct.some(i => !Number.isInteger(i) || i < 0 || i >= (q.options || []).length)) e('multi correct must be array of valid indexes');
      if (Array.isArray(q.correct) && q.correct.length === (q.options || []).length) e('multi: not all options may be correct');
      break;
    case 'tf':
      if (typeof q.answer !== 'boolean') e('tf answer must be boolean');
      break;
    case 'text':
      if (!Array.isArray(q.answers) || !q.answers.length) e('text needs answers[]');
      break;
    default: e('unknown type ' + q.type);
  }
}

function checkLesson(id) {
  const errs = [], warns = [];
  const file = path.join(DIR, id + '.js');
  let L;
  try { delete require.cache[require.resolve(file)]; L = require(file); } catch (err) { return { errs: ['cannot load: ' + err.message], warns }; }
  { // 2.8 supplementary sections (content/lessons/extra/wN.js) are checked with the same rules; ids must be x1, x2, ...
    const xf = path.join(DIR, 'extra', path.basename(file));
    if (fs.existsSync(xf)) {
      let X; try { delete require.cache[require.resolve(xf)]; X = require(xf); } catch (err) { return { errs: ['cannot load extra: ' + err.message], warns }; }
      if (!Array.isArray(X)) return { errs: ['extra file must export an array of sections'], warns };
      X.forEach((s, i) => { if (s.id !== 'x' + (i + 1)) warns.push(`extra section ${i + 1} id should be x${i + 1}`); });
      L = Object.assign({}, L, { sections: L.sections.concat(X) });
    }
  }
  const n = Number(id.slice(1));
  if (L.id !== id) errs.push('id mismatch');
  if (L.week !== n) errs.push('week mismatch');
  if (!Number.isInteger(L.unit)) errs.push('unit missing');
  if (!L.title) errs.push('title missing');
  if (!Array.isArray(L.objectives) || L.objectives.length < 3) errs.push('objectives: need >=3');
  if (!L.competency) errs.push('competency missing');
  if (!Array.isArray(L.keywords) || L.keywords.length < 3) errs.push('keywords: need >=3');
  if (!Array.isArray(L.summary) || L.summary.length < 4) errs.push('summary: need >=4');
  if (!Array.isArray(L.quiz) || L.quiz.length !== 10) errs.push(`quiz must have 10 items (has ${L.quiz ? L.quiz.length : 0})`);
  (L.quiz || []).forEach((q, i) => checkQ(q, `quiz#${i + 1}`, errs));
  const pos = (L.quiz || []).filter(q => q.type === 'choice').map(q => q.correct);
  if (pos.length >= 4 && new Set(pos).size < 3) warns.push('choice correct positions not varied: ' + pos.join(','));
  const longest = (L.quiz || []).filter(q => q.type === 'choice').filter(q => { const l = q.options.map(o => o.length); return q.options[q.correct].length === Math.max(...l) && l.filter(x => x === Math.max(...l)).length === 1; }).length;
  if (pos.length && longest / pos.length > 0.5) warns.push(`correct option is the single longest in ${longest}/${pos.length} choice items`);
  const lv = (L.quiz || []).map(q => q.level);
  ['easy', 'medium', 'hard'].forEach(x => { if (!lv.includes(x)) warns.push('quiz has no ' + x + ' items'); });
  if (!Array.isArray(L.sections) || L.sections.length < 4) errs.push('sections: need >=4');
  let checks = 0, diagrams = 0, examples = 0, notes = 0, widgets = 0, words = 0;
  const ids = new Set();
  (L.sections || []).forEach((s, si) => {
    const w = `section#${si + 1}`;
    if (!s.id || ids.has(s.id)) errs.push(w + ' needs unique id'); ids.add(s.id);
    if (!s.title) errs.push(w + ' title missing');
    if (!Array.isArray(s.blocks) || !s.blocks.length) errs.push(w + ' has no blocks');
    (s.blocks || []).forEach((b, bi) => {
      const bw = `${w} block#${bi + 1}`;
      if (!BLOCKS.includes(b.type)) return errs.push(bw + ' unknown type ' + b.type);
      const txt = [b.text, b.term, b.title, ...(b.items || []), ...((b.rows || []).flat()), ...(b.head || [])].filter(Boolean).join(' ');
      words += txt.length;
      if (/[<>]|\*\*|^#/.test(txt) && b.type !== 'table') warns.push(bw + ' contains markup characters');
      if (b.type === 'p' && !b.text) errs.push(bw + ' p without text');
      if ((b.type === 'list' || b.type === 'steps') && (!Array.isArray(b.items) || !b.items.length)) errs.push(bw + ' list without items');
      if (b.type === 'table' && (!Array.isArray(b.head) || !Array.isArray(b.rows) || b.rows.some(r => r.length !== b.head.length))) errs.push(bw + ' table rows must match head length');
      if (b.type === 'diagram') { diagrams++; if (!DIAGRAMS.includes(b.name)) errs.push(bw + ' unknown diagram ' + b.name); }
      if (PHM.isPhotoBlock(b)) { const pe = photoErr(b); if (pe) errs.push(bw + ' ' + pe); }
      if (b.type === 'widget') { widgets++; if (!WIDGETS.includes(b.name)) errs.push(bw + ' unknown widget ' + b.name); }
      if (b.type === 'example') examples++;
      if (b.type === 'note') { notes++; if (!['tip', 'warn'].includes(b.kind)) errs.push(bw + ' note kind must be tip|warn'); }
      if (b.type === 'check') { checks++; checkQ(b.q, bw + ' check', errs); }
    });
  });
  if (checks < 3) errs.push(`need >=3 check blocks (has ${checks})`);
  if (diagrams < 1) errs.push('need >=1 diagram');
  if (examples < 2) errs.push(`need >=2 example blocks (has ${examples})`);
  if (notes < 1) errs.push('need >=1 note');
  if (words < 3500) warns.push(`theory looks short (${words} characters)`);
  return { errs, warns, stats: { sections: (L.sections || []).length, checks, diagrams, widgets, examples, chars: words } };
}

const ids = process.argv.slice(2).length ? process.argv.slice(2) : fs.readdirSync(DIR).filter(f => /^w\d+\.js$/.test(f)).map(f => f.replace('.js', '')).sort((a, b) => a.slice(1) - b.slice(1));
let bad = 0;
for (const id of ids) {
  const r = checkLesson(id);
  console.log(`${id}: ${r.errs.length ? 'FAIL' : 'ok'} ${r.stats ? JSON.stringify(r.stats) : ''}`);
  r.errs.forEach(e => console.log('   ERROR', e));
  r.warns.forEach(w => console.log('   warn ', w));
  if (r.errs.length) bad++;
}
// extra visuals placed at load time (content/lessons/visuals.js): names must exist, anchors must resolve
{
  const V = require('../content/lessons/visuals.js').concat(...(fs.existsSync(path.join(DIR, 'visuals.d')) ? fs.readdirSync(path.join(DIR, 'visuals.d')).filter(f => f.endsWith('.js')).sort().map(f => require(path.join(DIR, 'visuals.d', f))) : []));
  const txt = b => [b.text, b.name, b.term, b.title, (b.items || []).join(' '), (b.head || []).join(' ')].filter(Boolean).join(' ');
  let vbad = 0;
  // 2.16: photo blocks name photo ids (content/photos.d); anchors are matched the way server/lessons.js placeVisuals() does,
  // i.e. against the section after the earlier placements, so a placement may anchor on (or replace) a block placed before it
  const placed = new Map();   // lesson/section -> working copy of the blocks
  for (const v of V) {
    const L0 = require(`../content/lessons/${v.lesson}.js`), XF = path.join(DIR, 'extra', v.lesson + '.js');
    const L = { sections: L0.sections.concat(fs.existsSync(XF) ? require(XF) : []) }, S0 = L.sections.find(x => x.id === v.section);
    const key = v.lesson + '/' + v.section;
    if (S0 && !placed.has(key)) placed.set(key, S0.blocks.slice());
    const B = placed.get(key);
    const nameOk = PHM.isPhotoBlock(v.block) ? (v.block.type === 'photos' || !!v.block.name) && !photoErr(v.block)
      : (v.block.type === 'diagram' ? DIAGRAMS : WIDGETS).includes(v.block.name);
    const i = B ? B.findIndex(b => b.type === v.anchor.type && txt(b).includes(v.anchor.match)) : -1;
    const problem = !nameOk ? (PHM.isPhotoBlock(v.block) ? photoErr(v.block) || 'photo block without a name' : 'unknown ' + v.block.type) : !B ? 'no section' : i < 0 ? 'anchor not found' : !v.block.caption ? 'no caption' : null;
    if (problem) { vbad++; console.log(`visuals ${v.lesson} ${v.section} ${v.block.name}: ERROR ${problem}`); }
    else if (!B.some(b => b.type === v.block.type && (b.name || (PHM.isPhotoBlock(b) && PHM.normBlock(b).name)) === (v.block.name || (PHM.isPhotoBlock(v.block) && PHM.normBlock(v.block).name)))) {
      if (v.mode === 'replace') B.splice(i, 1, v.block); else if (v.mode === 'before') B.splice(i, 0, v.block); else B.splice(i + 1, 0, v.block);
    }
  }
  console.log(`visuals: ${V.length} placements, ${vbad ? vbad + ' problems' : 'ok'}`);
  if (vbad) bad++;
}
process.exit(bad ? 1 : 0);

// Validates question-bank files against docs/BANK-SPEC.md
// usage: node tests/bank-check.js            (all)
//        node tests/bank-check.js unit3 unit6
'use strict';
const fs = require('fs');
const path = require('path');
const { grade, answerText, subnetFacts, ipToInt } = require('../server/bank-grade');
const DIR = path.join(__dirname, '..', 'content', 'bank');
const DIAGRAMS = ['net-components', 'lan-man-wan', 'p2p-vs-cs', 'topologies', 'network-devices', 'cable-types', 'connectors', 'osi-tcpip', 'encapsulation', 'ip-classes', 'utp-pinout', 'straight-cross', 'wifi-modes', 'wifi-bands', 'unc-share', 'nos-services', 'vm-layers', 'lab-network-plan', 'ping-ladder', 'firewall', 'defense-layers', 'users-groups', 'linux-perms'];
const TYPES = ['choice', 'multi', 'tf', 'match', 'order', 'fill', 'subnet', 'diagram', 'command', 'scenario'];
const UNIT_WEEKS = { 1: [1], 2: [2], 3: [3], 4: [4, 5], 5: [6, 7], 6: [8, 9], 7: [10, 11, 12], 8: [13, 14], 9: [15, 16], 10: [17, 18] };
let NetSim = null;
try { NetSim = require('../public/js/sim/netsim.js'); } catch (e) { /* engine not built yet */ }

function correctAnswer(q) {
  switch (q.type) {
    case 'choice': return q.correct;
    case 'multi': return q.correct;
    case 'tf': return q.answer;
    case 'match': return q.answer;
    case 'order': return q.items.slice();
    case 'fill': return q.blanks.map(b => b[0]);
    case 'subnet': { const f = subnetFacts(q.ip, q.prefix); const o = {}; q.ask.forEach(k => { o[k] = f[k]; }); return o; }
    case 'diagram': return q.correct;
    case 'command': return q.example;
    case 'scenario': return q.steps.map(s => s.correct);
  }
}
function wrongAnswer(q) {
  switch (q.type) {
    case 'choice': return (q.correct + 1) % q.options.length;
    case 'multi': return [...Array(q.options.length).keys()].filter(i => !q.correct.includes(i)).slice(0, 1);
    case 'tf': return !q.answer;
    case 'match': return q.answer.map((x, i, arr) => arr[(i + 1) % arr.length]).map((x, i) => q.answer.length > 1 ? x : (x + 1) % q.right.length);
    case 'order': return q.items.slice().reverse();
    case 'fill': return q.blanks.map(() => 'zzwrongzz');
    case 'subnet': { const o = {}; q.ask.forEach(k => { o[k] = '1.2.3.4'; }); return o; }
    case 'diagram': return (q.answerType || 'choice') === 'multi' ? [...Array(q.options.length).keys()].filter(i => !q.correct.includes(i)).slice(0, 1) : (q.correct + 1) % q.options.length;
    case 'command': return 'zzz-not-a-command';
    case 'scenario': return q.steps.map(s => (s.correct + 1) % s.options.length);
  }
}

function checkFile(name) {
  const errs = [], warns = [];
  const unit = Number(name.replace('unit', ''));
  let list;
  try { const f = path.join(DIR, name + '.js'); delete require.cache[require.resolve(f)]; list = require(f); }
  catch (e) { return { errs: ['cannot load: ' + e.message], warns, stats: {} }; }
  if (!Array.isArray(list)) return { errs: ['module.exports must be an array'], warns, stats: {} };
  const ids = new Set(); const types = {}; const levels = {}; const pos = [];
  let longest = 0, choiceN = 0;
  list.forEach((q, i) => {
    const w = (q && q.id) || `#${i + 1}`;
    const e = m => errs.push(`${w}: ${m}`);
    if (!q || typeof q !== 'object') return e('not an object');
    if (!/^u\d+-\d{3}$/.test(q.id || '')) e('id must look like u3-017');
    else if (!q.id.startsWith(`u${unit}-`)) e('id prefix must match unit');
    if (ids.has(q.id)) e('duplicate id'); ids.add(q.id);
    if (q.unit !== unit) e('unit mismatch');
    if (!(UNIT_WEEKS[unit] || []).includes(q.week)) e(`week ${q.week} not in unit ${unit}`);
    if (!['easy', 'medium', 'hard'].includes(q.level)) e('bad level');
    if (!TYPES.includes(q.type)) return e('bad type ' + q.type);
    if (q.type !== 'scenario' && (!q.q || typeof q.q !== 'string')) e('missing q');
    if (q.type === 'scenario' && !q.context) e('scenario needs context');
    if (!q.explain || q.explain.length < 10) e('missing/short explain');
    if (!Array.isArray(q.tags) || !q.tags.length) warns.push(w + ': no tags');
    types[q.type] = (types[q.type] || 0) + 1; levels[q.level] = (levels[q.level] || 0) + 1;
    const opts = o => Array.isArray(o) && o.length >= 2 && new Set(o).size === o.length;
    switch (q.type) {
      case 'choice': case 'diagram': {
        const at = q.type === 'diagram' ? (q.answerType || 'choice') : 'choice';
        if (!opts(q.options)) e('options missing/duplicate');
        if (at === 'choice') {
          if (!Number.isInteger(q.correct) || q.correct < 0 || q.correct >= (q.options || []).length) e('correct out of range');
          else { pos.push(q.correct); choiceN++; const L = q.options.map(o => o.length), mx = Math.max(...L); if (L[q.correct] === mx && L.filter(x => x === mx).length === 1) longest++; }
          if (q.why && q.why.length !== q.options.length) e('why[] length');
        } else if (!Array.isArray(q.correct) || q.correct.length < 2 || q.correct.some(x => x < 0 || x >= q.options.length)) e('multi correct invalid');
        if (q.type === 'diagram') {
          if (!q.topo && !q.diagram) e('diagram needs topo or diagram');
          if (q.diagram && !DIAGRAMS.includes(q.diagram)) e('unknown diagram ' + q.diagram);
          if (q.topo) {
            if (!Array.isArray(q.topo.devices) || !Array.isArray(q.topo.links)) e('topo needs devices[] and links[]');
            else {
              const dids = new Set(q.topo.devices.map(d => d.id));
              q.topo.links.forEach(l => { if (!l.a || !l.b || !dids.has(l.a.dev) || !dids.has(l.b.dev)) e('topo link references unknown device'); });
              q.topo.devices.forEach(d => (d.ifaces || []).forEach(f => { if (f.ip && ipToInt(f.ip) == null) e(`topo ${d.id} bad ip ${f.ip}`); }));
              if (q.topo.devices.length > 8) warns.push(w + ': topo has more than 8 devices');
              if (NetSim) { try { NetSim.create(q.topo); } catch (err) { e('NetSim.create failed: ' + err.message); } }
            }
          }
        }
        break;
      }
      case 'multi':
        if (!opts(q.options) || q.options.length < 3) e('multi needs >=3 distinct options');
        if (!Array.isArray(q.correct) || q.correct.length < 2 || q.correct.length >= (q.options || []).length || q.correct.some(x => !Number.isInteger(x) || x < 0 || x >= q.options.length)) e('multi correct must have 2+ valid indexes and leave 1+ wrong');
        break;
      case 'tf': if (typeof q.answer !== 'boolean') e('tf answer must be boolean'); break;
      case 'match':
        if (!Array.isArray(q.left) || q.left.length < 3 || q.left.length > 6) e('match needs 3-6 left items');
        if (!opts(q.right) || q.right.length < (q.left || []).length) e('match right[] too short/duplicates');
        if (!Array.isArray(q.answer) || q.answer.length !== (q.left || []).length || new Set(q.answer).size !== q.answer.length || q.answer.some(x => x < 0 || x >= q.right.length)) e('match answer must map each left to a distinct right index');
        break;
      case 'order': if (!Array.isArray(q.items) || q.items.length < 3 || q.items.length > 7 || new Set(q.items).size !== q.items.length) e('order needs 3-7 distinct items'); break;
      case 'fill': {
        const n = (q.q.match(/\{\{\d+\}\}/g) || []).length;
        if (!Array.isArray(q.blanks) || !q.blanks.length || q.blanks.some(b => !Array.isArray(b) || !b.length)) e('fill blanks invalid');
        else if (n !== q.blanks.length) e(`fill has ${n} {{n}} markers but ${q.blanks.length} blanks`);
        break;
      }
      case 'subnet':
        if (ipToInt(q.ip) == null) e('subnet bad ip');
        if (!Number.isInteger(q.prefix) || q.prefix < 1 || q.prefix > 30) e('subnet prefix 1-30');
        if (!Array.isArray(q.ask) || !q.ask.length || q.ask.some(k => !['network', 'broadcast', 'first', 'last', 'hosts', 'mask', 'prefix', 'wildcard'].includes(k))) e('subnet ask invalid');
        break;
      case 'command':
        if (!['windows', 'linux'].includes(q.os)) e('command os');
        if (!Array.isArray(q.accept) || !q.accept.length) e('command accept[]');
        else q.accept.forEach(rx => { try { new RegExp(rx, 'i'); } catch (err) { e('bad regex ' + rx); } });
        if (!q.example) e('command example missing');
        break;
      case 'scenario':
        if (!Array.isArray(q.steps) || q.steps.length < 2 || q.steps.length > 4) e('scenario needs 2-4 steps');
        else q.steps.forEach((s, k) => { if (!s.q || !opts(s.options) || !Number.isInteger(s.correct) || s.correct < 0 || s.correct >= s.options.length) e(`scenario step ${k + 1} invalid`); });
        break;
    }
    if (!errs.some(x => x.startsWith(w + ':'))) {
      const ok = grade(q, correctAnswer(q));
      if (!ok.correct) e('canonical correct answer is graded wrong (check accept regex / blanks / answer)');
      const bad = grade(q, wrongAnswer(q));
      if (bad.correct) e('a wrong answer is graded correct');
      if (!answerText(q)) e('answerText empty');
    }
  });
  const tcount = Object.keys(types).length;
  if (list.length < 32) errs.push(`need >= 32 questions (has ${list.length})`);
  if (tcount < 8) errs.push(`need >= 8 types (has ${tcount}: ${Object.keys(types).join(',')})`);
  if ((types.scenario || 0) < 2) errs.push('need >= 2 scenario items');
  if ([3, 6].includes(unit) && (types.subnet || 0) < 4) errs.push('need >= 4 subnet items');
  if (unit === 8 && list.filter(q => q.type === 'diagram' && q.topo).length < 3) errs.push('need >= 3 diagram items with topo');
  if ([6, 8, 10].includes(unit) && (types.command || 0) < 3) errs.push('need >= 3 command items');
  const n = list.length || 1;
  if ((levels.hard || 0) / n < 0.12) warns.push(`few hard items (${levels.hard || 0})`);
  if ((levels.easy || 0) / n > 0.55) warns.push(`too many easy items (${levels.easy || 0})`);
  if (pos.length >= 6 && Math.max(...[0, 1, 2, 3, 4].map(k => pos.filter(p => p === k).length)) / pos.length > 0.45) warns.push('correct option position not varied: ' + JSON.stringify([0, 1, 2, 3].map(k => pos.filter(p => p === k).length)));
  if (choiceN && longest / choiceN > 0.4) warns.push(`correct option is the single longest in ${longest}/${choiceN} choice items`);
  return { errs, warns, stats: { questions: list.length, types, levels } };
}

const names = process.argv.slice(2).length ? process.argv.slice(2) : (fs.existsSync(DIR) ? fs.readdirSync(DIR).filter(f => /^unit\d+\.js$/.test(f)).map(f => f.replace('.js', '')).sort((a, b) => a.slice(4) - b.slice(4)) : []);
let bad = 0;
for (const n of names) {
  const r = checkFile(n);
  console.log(`${n}: ${r.errs.length ? 'FAIL' : 'ok'} ${JSON.stringify(r.stats)}`);
  r.errs.forEach(e => console.log('   ERROR', e));
  r.warns.forEach(w => console.log('   warn ', w));
  if (r.errs.length) bad++;
}
if (!NetSim) console.log('(NetSim engine not found: topology diagrams checked for shape only)');
process.exit(bad ? 1 : 0);

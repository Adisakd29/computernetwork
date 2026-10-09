'use strict';
/* Grading for question-bank types (docs/BANK-SPEC.md). Returns { score: 0..1, correct: bool, empty, detail } */

const ipToInt = s => {
  const m = String(s || '').trim().match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return null;
  const p = m.slice(1).map(Number);
  if (p.some(x => x > 255)) return null;
  return ((p[0] << 24) >>> 0) + (p[1] << 16) + (p[2] << 8) + p[3];
};
const intToIp = n => [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');
const maskInt = p => p === 0 ? 0 : (0xFFFFFFFF << (32 - p)) >>> 0;

function subnetFacts(ip, prefix) {
  const a = ipToInt(ip), m = maskInt(prefix);
  const net = (a & m) >>> 0, bc = (net | (~m >>> 0)) >>> 0;
  const hosts = prefix >= 31 ? (prefix === 31 ? 2 : 1) : Math.pow(2, 32 - prefix) - 2;
  return {
    network: intToIp(net), broadcast: intToIp(bc), mask: intToIp(m),
    first: prefix >= 31 ? intToIp(net) : intToIp(net + 1), last: prefix >= 31 ? intToIp(bc) : intToIp(bc - 1),
    hosts: String(hosts), prefix: String(prefix), wildcard: intToIp((~m) >>> 0)
  };
}
const SUBNET_LABEL = { network: 'Network Address', broadcast: 'Broadcast Address', first: 'โฮสต์แรกที่ใช้ได้', last: 'โฮสต์สุดท้ายที่ใช้ได้', hosts: 'จำนวนโฮสต์ที่ใช้ได้', mask: 'Subnet Mask', prefix: 'Prefix (/n)', wildcard: 'Wildcard Mask' };

const norm = s => String(s == null ? '' : s).toLowerCase().replace(/\s+/g, '').replace(/[:\-_]/g, '');
const cmdNorm = s => String(s == null ? '' : s).trim().replace(/\s+/g, ' ');

function normSubnetAnswer(field, v) {
  v = String(v == null ? '' : v).trim().replace(/\s+/g, '');
  if (field === 'hosts') return v.replace(/,/g, '');
  if (field === 'prefix') return v.replace(/^\//, '');
  if (field === 'mask' && /^\/?\d{1,2}$/.test(v)) { const p = +v.replace('/', ''); return p <= 32 ? intToIp(maskInt(p)) : v; }
  const n = ipToInt(v); return n == null ? v : intToIp(n);
}

function grade(q, a) {
  const R = (score, extra) => Object.assign({ score, correct: score >= 0.999 }, extra || {});
  const empty = { score: 0, correct: false, empty: true };
  switch (q.type) {
    case 'choice': {
      const i = Number(a); if (a === null || a === '' || !Number.isInteger(i) || i < 0 || i >= q.options.length) return empty;
      return R(i === q.correct ? 1 : 0, { why: i !== q.correct && Array.isArray(q.why) ? q.why[i] || undefined : undefined });
    }
    case 'multi': {
      if (!Array.isArray(a) || !a.length) return empty;
      const s = [...new Set(a.map(Number))].filter(i => Number.isInteger(i) && i >= 0 && i < q.options.length).sort((x, y) => x - y);
      const w = [...q.correct].sort((x, y) => x - y);
      return R(s.length === w.length && s.every((v, i) => v === w[i]) ? 1 : 0);
    }
    case 'tf': {
      if (a !== true && a !== false && a !== 'true' && a !== 'false') return empty;
      return R(((a === true || a === 'true') === q.answer) ? 1 : 0);
    }
    case 'text': {
      const v = norm(a); if (!v) return empty;
      return R(q.answers.some(x => norm(x) === v) ? 1 : 0);
    }
    case 'match': {
      if (!Array.isArray(a) || a.length !== q.left.length) return empty;
      const right = q.answer.filter((x, i) => Number(a[i]) === x).length;
      return R(right === q.left.length ? 1 : 0, { detail: { right, total: q.left.length, perItem: q.answer.map((x, i) => Number(a[i]) === x) } });
    }
    case 'order': {
      if (!Array.isArray(a) || a.length !== q.items.length) return empty;
      const right = q.items.filter((t, i) => String(a[i]) === t).length;
      return R(right === q.items.length ? 1 : 0, { detail: { right, total: q.items.length } });
    }
    case 'fill': {
      if (!Array.isArray(a) || a.length !== q.blanks.length || a.every(x => !norm(x))) return empty;
      const per = q.blanks.map((acc, i) => acc.some(x => norm(x) === norm(a[i])));
      return R(per.every(Boolean) ? 1 : 0, { detail: { perBlank: per } });
    }
    case 'subnet': {
      if (!a || typeof a !== 'object') return empty;
      const f = subnetFacts(q.ip, q.prefix);
      const per = q.ask.map(k => normSubnetAnswer(k, a[k]) === f[k]);
      if (q.ask.every(k => !String(a[k] || '').trim())) return empty;
      const n = per.filter(Boolean).length;
      return { score: n / q.ask.length, correct: n === q.ask.length, detail: { perField: per } };
    }
    case 'diagram': {
      return grade({ type: q.answerType || 'choice', options: q.options, correct: q.correct, why: q.why }, a);
    }
    case 'command': {
      const v = cmdNorm(a); if (!v) return empty;
      const ok = q.accept.some(rx => { try { return new RegExp(rx, 'i').test(v); } catch (e) { return false; } });
      return R(ok ? 1 : 0);
    }
    case 'scenario': {
      if (!Array.isArray(a) || a.length !== q.steps.length || a.every(x => x === null || x === undefined || x === '')) return empty;
      const per = q.steps.map((s, i) => Number(a[i]) === s.correct);
      const n = per.filter(Boolean).length;
      return { score: n / q.steps.length, correct: n === q.steps.length, detail: { perStep: per } };
    }
    default: return empty;
  }
}

/* readable correct answer for review */
function answerText(q) {
  switch (q.type) {
    case 'choice': return q.options[q.correct];
    case 'multi': return q.correct.map(i => q.options[i]).join(' / ');
    case 'tf': return q.answer ? 'ถูก' : 'ผิด';
    case 'text': return q.answers[0];
    case 'match': return q.left.map((l, i) => `${l} → ${q.right[q.answer[i]]}`).join(' | ');
    case 'order': return q.items.map((t, i) => `${i + 1}. ${t}`).join(' | ');
    case 'fill': return q.blanks.map((b, i) => `(${i + 1}) ${b[0]}`).join('  ');
    case 'subnet': { const f = subnetFacts(q.ip, q.prefix); return q.ask.map(k => `${SUBNET_LABEL[k]} = ${f[k]}`).join(' | '); }
    case 'diagram': return answerText({ type: q.answerType || 'choice', options: q.options, correct: q.correct });
    case 'command': return q.example || '';
    case 'scenario': return q.steps.map((s, i) => `ขั้นที่ ${i + 1}: ${s.options[s.correct]}`).join(' | ');
    default: return '';
  }
}

/* short text of the student's answer for logs / review */
function givenText(q, a) {
  try {
    switch (q.type) {
      case 'choice': case 'diagram': if ((q.answerType || 'choice') === 'choice') return q.options[Number(a)] || ''; return (a || []).map(i => q.options[i]).join(' / ');
      case 'multi': return (a || []).map(i => q.options[i]).filter(Boolean).join(' / ');
      case 'tf': return a === true || a === 'true' ? 'ถูก' : 'ผิด';
      case 'match': return q.left.map((l, i) => `${l} → ${q.right[Number(a[i])] || '-'}`).join(' | ');
      case 'order': return (a || []).join(' | ');
      case 'fill': return (a || []).join(' , ');
      case 'subnet': return q.ask.map(k => `${k}=${(a || {})[k] || ''}`).join(' ');
      case 'scenario': return (a || []).map((x, i) => q.steps[i] && q.steps[i].options[x] || '-').join(' | ');
      default: return String(a == null ? '' : a).slice(0, 200);
    }
  } catch (e) { return ''; }
}

module.exports = { grade, answerText, givenText, subnetFacts, SUBNET_LABEL, ipToInt, intToIp };

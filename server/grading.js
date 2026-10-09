'use strict';
/* answer checking and scoring - the only place answers are compared */

const norm = s => String(s == null ? '' : s).toLowerCase().replace(/\s+/g, '').replace(/[:\-_]/g, '');
const exactNorm = s => String(s == null ? '' : s).toLowerCase().replace(/\s+/g, '');

/* returns { correct, empty, detail, wrongKey } ; wrongKey dedupes repeated identical wrong answers */
function check(task, answer) {
  switch (task.type) {
    case 'text': {
      const nf = task.exact ? exactNorm : norm;
      const v = nf(answer);
      if (!v) return { correct: false, empty: true };
      const ok = task.answers.some(a => task.contains ? v.includes(nf(a)) : nf(a) === v);
      return { correct: ok, wrongKey: 't:' + v };
    }
    case 'choice': {
      const i = Number(answer);
      if (!Number.isInteger(i) || i < 0 || i >= task.options.length) return { correct: false, empty: true };
      return { correct: i === task.correct, wrongKey: 'c:' + i };
    }
    case 'order': {
      if (!Array.isArray(answer) || answer.length !== task.items.length) return { correct: false, empty: true };
      const right = answer.filter((t, i) => String(t) === task.items[i].t).length;
      return { correct: right === task.items.length, detail: { right, total: task.items.length }, wrongKey: 'o:' + answer.join('|') };
    }
    case 'form': {
      if (!Array.isArray(answer) || answer.length !== task.fields.length) return { correct: false, empty: true };
      const fieldsOk = task.fields.map((f, i) => { try { return !!f.ok(String(answer[i] == null ? '' : answer[i])); } catch (e) { return false; } });
      return { correct: fieldsOk.every(Boolean), detail: { fieldsOk }, wrongKey: 'f:' + answer.join('|') };
    }
    case 'multi': {
      if (!Array.isArray(answer) || !answer.length) return { correct: false, empty: true };
      const picked = [...new Set(answer.map(Number))].filter(i => Number.isInteger(i) && i >= 0 && i < task.options.length).sort((a, b) => a - b);
      if (!picked.length) return { correct: false, empty: true };
      const want = [...task.correct].sort((a, b) => a - b);
      return { correct: picked.length === want.length && picked.every((v, i) => v === want[i]), wrongKey: 'm:' + picked.join(',') };
    }
    case 'tf': {
      if (answer !== true && answer !== false && answer !== 'true' && answer !== 'false') return { correct: false, empty: true };
      const v = answer === true || answer === 'true';
      return { correct: v === task.answer, wrongKey: 'b:' + v };
    }
    default:
      return { correct: false, empty: true };
  }
}

/* 10 points, hint -5, each distinct wrong answer -2, minimum 2 when solved */
const pointsLeft = (attempts, hint) => Math.max(2, 10 - (hint ? 5 : 0) - 2 * (attempts || 0));

/* short text kept in attempt_log (never the whole form password) */
function logAnswer(task, answer) {
  if (task.type === 'form') return JSON.stringify(task.fields.map((f, i) => /รหัสผ่าน|password/i.test(f.label) ? '***' : answer[i]));
  if (task.type === 'choice') return task.options[Number(answer)] || String(answer);
  if (task.type === 'multi' && Array.isArray(answer)) return answer.map(i => task.options[Number(i)]).filter(Boolean).join(' + ');
  if (task.type === 'tf') return (answer === true || answer === 'true') ? 'ถูก' : 'ผิด';
  if (Array.isArray(answer)) return answer.join(' | ').slice(0, 500);
  return String(answer).slice(0, 200);
}

module.exports = { check, pointsLeft, logAnswer, norm };

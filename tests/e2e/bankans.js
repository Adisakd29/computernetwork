// writes correct answers for every bank question to <dir>/bankans.json (test-only, never served)
const b=require('../../server/bank'),g=require('../../server/bank-grade');const o={};
for(const q of b.Q.values()){ const x={type:q.type,options:q.options,correct:q.correct,answer:q.answer,right:q.right,blanks:q.blanks,example:q.example,items:q.items,answerType:q.answerType};
  if(q.type==='subnet'){const f=g.subnetFacts(q.ip,q.prefix);x.sub={};q.ask.forEach(k=>x.sub[k]=String(f[k]));}
  if(q.type==='scenario') x.steps=q.steps.map(s=>s.options[s.correct]);
  o[q.id]=x;}
require('fs').writeFileSync(require('path').join(process.argv[2]||'.','bankans.json'),JSON.stringify(o));

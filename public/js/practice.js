'use strict';
/* Phase 4 pages: question renderer (10 types), practice mode, exam mode, simulator hub */

const TYPE_TH={choice:'ปรนัย',multi:'เลือกได้หลายข้อ',tf:'ถูก/ผิด',match:'จับคู่',order:'เรียงลำดับ',fill:'เติมคำ',subnet:'คำนวณ Subnet',diagram:'วิเคราะห์แผนผัง',command:'พิมพ์คำสั่ง',scenario:'สถานการณ์แก้ปัญหา'};
const SUBNET_TH={network:'Network Address',broadcast:'Broadcast Address',first:'โฮสต์แรกที่ใช้ได้',last:'โฮสต์สุดท้ายที่ใช้ได้',hosts:'จำนวนโฮสต์ที่ใช้ได้',mask:'Subnet Mask',prefix:'Prefix (/n)',wildcard:'Wildcard Mask'};
const LEVEL_TH={easy:'ง่าย',medium:'ปานกลาง',hard:'ยาก'};
const UNIT_SHORT=['พื้นฐานเครือข่าย','อุปกรณ์และสื่อ','มาตรฐานและโปรโตคอล','LAN ใช้สาย','LAN ไร้สาย','เครือข่ายใน Windows','ระบบปฏิบัติการเครือข่าย','ออกแบบและแก้ปัญหา','ความปลอดภัย','บัญชีผู้ใช้และสิทธิ์'];

/* ---------- script loader ---------- */
const _loaded={};
function loadJs(src){
  if(_loaded[src]) return _loaded[src];
  return (_loaded[src]=new Promise((res,rej)=>{ const s=document.createElement('script'); s.src=src; s.onload=res; s.onerror=()=>{ delete _loaded[src]; rej(new Error('โหลดไฟล์ '+src+' ไม่สำเร็จ')); }; document.head.append(s); }));
}

/* ---------- question renderer ---------- */
function bankQuestion(pq,{onChange}={}){
  const name='b'+Math.random().toString(36).slice(2,8);
  const ch=()=>onChange&&onChange();
  const box=el('div',{class:'bq bq-'+pq.type,'data-qid':pq.id});
  let get=()=>null,set=()=>{},lock=()=>{},mark=()=>{};
  const radios=(opts,key,multi)=>{ const order=seededOrder(opts.length,SEED+key); const ins=[]; const wrap=el('div',{class:'qin'});
    order.forEach(oi=>{ const i=el('input',{type:multi?'checkbox':'radio',name:name+key,value:String(oi)}); i.addEventListener('change',ch); ins.push(i); wrap.append(el('label',{class:'opt'},i,el('span',{},opts[oi]))); });
    return {wrap,ins,get:()=>multi?ins.filter(i=>i.checked).map(i=>+i.value):(ins.find(i=>i.checked)?+ins.find(i=>i.checked).value:null),
      set:v=>ins.forEach(i=>{ i.checked=multi?Array.isArray(v)&&v.includes(+i.value):v===+i.value; })}; };
  const qtext=t=>el('p',{class:'qq'},t);
  switch(pq.type){
    case 'choice': case 'multi': case 'tf': case 'diagram': {
      if(pq.type==='diagram'){
        const fig=el('figure',{class:'dgm bqfig'}); const d=el('div',{class:'dgmsvg'});
        if(pq.topo&&window.NetSim) d.innerHTML=NetSim.render(pq.topo,{showIp:true});
        else if(pq.diagram) d.innerHTML=(window.NL_DIAGRAMS||{})[pq.diagram]||'';
        fig.append(d); box.append(fig);
      }
      box.append(qtext(pq.q));
      if(pq.type==='tf'){
        const a=el('input',{type:'radio',name,value:'true'}), b=el('input',{type:'radio',name,value:'false'}); [a,b].forEach(i=>i.addEventListener('change',ch));
        box.append(el('div',{class:'tfrow'},el('label',{class:'opt'},a,el('span',{},'ถูก')),el('label',{class:'opt'},b,el('span',{},'ผิด'))));
        get=()=>a.checked?true:b.checked?false:null; set=v=>{a.checked=v===true;b.checked=v===false;}; lock=()=>{a.disabled=b.disabled=true;};
      }else{
        const multi=pq.type==='multi'||(pq.type==='diagram'&&pq.answerType==='multi');
        if(multi) box.append(el('p',{class:'muted small'},'เลือกได้มากกว่า 1 ข้อ'));
        const r=radios(pq.options,pq.id,multi); box.append(r.wrap); get=r.get; set=r.set; lock=()=>r.ins.forEach(i=>i.disabled=true);
      }
      break;
    }
    case 'match': {
      box.append(qtext(pq.q),el('p',{class:'muted small'},'เลือกคำตอบด้านขวาให้ตรงกับแต่ละข้อด้านซ้าย'));
      const order=seededOrder(pq.right.length,SEED+pq.id+'r');
      const sels=pq.left.map(()=>{ const s=el('select',{'aria-label':'คำตอบ'},el('option',{value:''},'— เลือก —'),order.map(i=>el('option',{value:String(i)},pq.right[i]))); s.addEventListener('change',ch); return s; });
      const rows=pq.left.map((l,i)=>el('div',{class:'mrow2'},el('span',{class:'ml'},l),sels[i]));
      box.append(el('div',{class:'matchgrid'},rows));
      get=()=>sels.every(s=>s.value==='')?null:sels.map(s=>s.value===''?-1:+s.value); set=v=>sels.forEach((s,i)=>{ s.value=Array.isArray(v)&&v[i]>=0?String(v[i]):''; });
      lock=()=>sels.forEach(s=>s.disabled=true);
      mark=res=>{ const per=res.detail&&res.detail.perItem; if(per) rows.forEach((r,i)=>r.classList.add(per[i]?'ok':'bad')); };
      break;
    }
    case 'order': {
      box.append(qtext(pq.q),el('p',{class:'muted small'},'ลากเพื่อสลับตำแหน่ง หรือใช้ปุ่มลูกศรขึ้น/ลง'));
      let items=pq.items.slice(); let locked=false;
      const ol=el('ol',{class:'orderlist'});
      const draw=()=>{ ol.replaceChildren(...items.map((t,i)=>{ const li=el('li',{class:'oitem','data-i':i},el('span',{class:'grip','aria-hidden':'true'},'⋮⋮'),el('span',{class:'ot'},t),
        el('span',{class:'obtns'},el('button',{type:'button',class:'obtn','aria-label':'เลื่อนขึ้น',disabled:locked||i===0?'':null,onclick:()=>{ [items[i-1],items[i]]=[items[i],items[i-1]]; draw(); ch(); }},'↑'),
          el('button',{type:'button',class:'obtn','aria-label':'เลื่อนลง',disabled:locked||i===items.length-1?'':null,onclick:()=>{ [items[i+1],items[i]]=[items[i],items[i+1]]; draw(); ch(); }},'↓')));
        li.addEventListener('pointerdown',e=>{ if(locked||e.target.closest('button')) return; startDrag(e,li,i); }); return li; })); };
      function startDrag(e,li,from){
        e.preventDefault(); li.setPointerCapture(e.pointerId); li.classList.add('drag');
        const mv=ev=>{ const lis=[...ol.children]; const to=lis.findIndex(x=>{ const r=x.getBoundingClientRect(); return ev.clientY<r.top+r.height/2; }); lis.forEach(x=>x.classList.remove('dropbefore')); const t=to<0?lis.length:to; if(lis[t]) lis[t].classList.add('dropbefore'); li.dataset.to=t; };
        const up=()=>{ li.removeEventListener('pointermove',mv); li.removeEventListener('pointerup',up); li.removeEventListener('pointercancel',up);
          let to=li.dataset.to==null?from:+li.dataset.to; if(to>from) to--; if(to!==from){ const [x]=items.splice(from,1); items.splice(to,0,x); ch(); } draw(); };
        li.addEventListener('pointermove',mv); li.addEventListener('pointerup',up); li.addEventListener('pointercancel',up);
      }
      draw(); box.append(ol);
      get=()=>items.slice(); set=v=>{ if(Array.isArray(v)&&v.length===items.length&&v.every(x=>pq.items.includes(x))){ items=v.slice(); draw(); } }; lock=()=>{ locked=true; draw(); };
      break;
    }
    case 'fill': {
      const parts=String(pq.q).split(/(\{\{\d+\}\})/); const ins=[];
      const p=el('p',{class:'qq fillq'},parts.map(t=>{ const m=t.match(/^\{\{(\d+)\}\}$/); if(!m) return t; const i=el('input',{type:'text',class:'blank','aria-label':'ช่องว่างที่ '+m[1],autocomplete:'off',autocapitalize:'off',spellcheck:'false'}); i.addEventListener('input',ch); ins[+m[1]-1]=i; return i; }));
      box.append(p);
      get=()=>ins.every(i=>!i.value.trim())?null:ins.map(i=>i.value); set=v=>ins.forEach((i,k)=>{ i.value=Array.isArray(v)?v[k]||'':''; }); lock=()=>ins.forEach(i=>i.disabled=true);
      mark=res=>{ const per=res.detail&&res.detail.perBlank; if(per) ins.forEach((i,k)=>i.classList.add(per[k]?'ok':'bad')); };
      break;
    }
    case 'subnet': {
      box.append(qtext(pq.q||'คำนวณค่าต่อไปนี้'),el('div',{class:'subnetgiven'},el('code',{},pq.mask?`${pq.ip}  Subnet Mask ${pq.mask}`:`${pq.ip}/${pq.prefix}`)));
      const ins={};
      box.append(el('div',{class:'subgrid'},pq.ask.map(k=>{ const i=el('input',{type:'text',autocomplete:'off',autocapitalize:'off',spellcheck:'false',inputmode:k==='hosts'?'numeric':null,placeholder:k==='hosts'?'จำนวน':k==='prefix'?'/n':'x.x.x.x'}); i.addEventListener('input',ch); ins[k]=i; return el('label',{class:'frow'},el('span',{},SUBNET_TH[k]||k),i); })));
      get=()=>Object.values(ins).every(i=>!i.value.trim())?null:Object.fromEntries(Object.entries(ins).map(([k,i])=>[k,i.value])); set=v=>Object.entries(ins).forEach(([k,i])=>{ i.value=v&&v[k]||''; });
      lock=()=>Object.values(ins).forEach(i=>i.disabled=true);
      mark=res=>{ const per=res.detail&&res.detail.perField; if(per) pq.ask.forEach((k,j)=>ins[k].classList.add(per[j]?'ok':'bad')); };
      break;
    }
    case 'command': {
      box.append(qtext(pq.q));
      const inp=el('input',{type:'text',class:'cmdin',autocomplete:'off',autocapitalize:'off',spellcheck:'false','aria-label':'พิมพ์คำสั่ง'}); inp.addEventListener('input',ch);
      box.append(el('div',{class:'cmdline '+(pq.os==='linux'?'linux':'win')},el('span',{class:'prompt'},pq.os==='linux'?'student@netlab:~$':'C:\\>'),inp));
      get=()=>inp.value.trim()?inp.value:null; set=v=>{inp.value=v||'';}; lock=()=>{inp.disabled=true;};
      break;
    }
    case 'scenario': {
      box.append(el('p',{class:'scctx'},pq.context)); if(pq.pre) box.append(el('pre',{class:'out'},pq.pre));
      const rs=pq.steps.map((s,k)=>{ const r=radios(s.options,pq.id+':'+k,false); box.append(el('div',{class:'scstep'},el('p',{class:'qq'},`${k+1}. ${s.q}`),r.wrap)); return r; });
      get=()=>rs.every(r=>r.get()==null)?null:rs.map(r=>r.get()); set=v=>rs.forEach((r,k)=>r.set(Array.isArray(v)?v[k]:null)); lock=()=>rs.forEach(r=>r.ins.forEach(i=>i.disabled=true));
      mark=res=>{ const per=res.detail&&res.detail.perStep; if(per) box.querySelectorAll('.scstep').forEach((x,k)=>x.classList.add(per[k]?'ok':'bad')); };
      break;
    }
  }
  const fb=el('div',{class:'bqfb','aria-live':'polite'});
  box.append(fb);
  const showResult=res=>{
    lock(); mark(res);
    box.classList.add(res.correct?'right':res.score>0?'partial':'wrong');
    R(fb,el('p',{class:'verdict'},res.correct?'ถูกต้อง':res.score>0?`ถูกบางส่วน (${Math.round(res.score*100)}%)`:'ยังไม่ถูก'),
      !res.correct&&res.why?el('p',{class:'why'},res.why):null,
      !res.correct&&res.answer?el('p',{class:'ans'},'คำตอบที่ถูก: ',el('b',{},res.answer)):null,
      res.explain?el('p',{class:'explain'},res.explain):null);
  };
  return {node:box,get,set,lock,showResult,q:pq};
}
const isAnswered=v=>v!=null&&!(Array.isArray(v)&&(!v.length||v.every(x=>x==null||x===''||x===-1)))&&!(typeof v==='object'&&!Array.isArray(v)&&Object.values(v).every(x=>!String(x||'').trim()));

/* ---------- practice ---------- */
const WRONGK='netlab-wrong';
function wrongIds(){ try{ return JSON.parse(localStorage.getItem(WRONGK)||'[]'); }catch(e){ return []; } }
function noteWrong(id,correct){ let a=wrongIds().filter(x=>x!==id); if(!correct) a.push(id); a=a.slice(-200); try{ localStorage.setItem(WRONGK,JSON.stringify(a)); }catch(e){} }
async function mistakesPanel(){
  const box=el('section',{class:'panel mistakes'},el('p',{class:'muted small'},'กำลังตรวจข้อที่เคยตอบผิด...'));
  (async()=>{
    let qs=[], count=0;
    try{
      if(ME){ const r=await api('GET','/api/practice/mistakes?n=10'); qs=r.questions; count=r.count; }
      else{ const ids=wrongIds(); count=ids.length; if(ids.length){ const r=await api('POST','/api/practice/byids',{ids:ids.slice(-10)}); qs=r.questions; } }
    }catch(e){ box.remove(); return; }
    if(!count){ R(box,el('h2',{},'ทบทวนข้อที่ตอบผิด'),el('p',{class:'muted'},'ยังไม่มีข้อที่ตอบผิดค้างอยู่ เมื่อฝึกหรือสอบแล้วตอบผิด ข้อนั้นจะมาอยู่ที่นี่จนกว่าจะตอบถูก')); return; }
    R(box,el('h2',{},'ทบทวนข้อที่ตอบผิด'),el('p',{},`มี ${count} ข้อที่ครั้งล่าสุดยังตอบผิด`+(ME?' (จากโหมดฝึกและการสอบ)':'')+' ตอบถูกแล้วข้อนั้นจะออกจากรายการ'),
      el('button',{class:'btn',type:'button',onclick:async()=>{ await loadJs('js/sim/netsim.js').catch(()=>{}); practiceRun(qs,{review:true}); }},`ทบทวน ${qs.length} ข้อ`));
  })();
  return box;
}
let PINFO=null;
async function practicePage(presetUnit){
  setTitle('ฝึกทำข้อสอบ');
  if(!PINFO) PINFO=await api('GET','/api/practice/info');
  const pref=(()=>{ try{ return JSON.parse(localStorage.getItem('netlab-practice')||'{}'); }catch(e){ return {}; } })();
  const units=new Set(presetUnit?[presetUnit]:(pref.units||[])), levels=new Set(presetUnit?['easy','medium','hard']:(pref.levels||['easy','medium','hard'])), types=new Set(presetUnit?[]:(pref.types||[]));
  const chip=(set,val,label,sub)=>{ const b=el('button',{type:'button',class:'fchip'+(set.has(val)?' on':''),'aria-pressed':String(set.has(val)),onclick:()=>{ set.has(val)?set.delete(val):set.add(val); b.classList.toggle('on'); b.setAttribute('aria-pressed',String(set.has(val))); if(set===units) drawLevels(); upd(); }},label,sub?el('small',{},sub):null); return b; };
  const lvCount=l=>PINFO.units.filter(u=>!units.size||units.has(u.unit)).reduce((a,u)=>a+(u[l]||0),0);
  const levelBox=el('div',{class:'chips',role:'group','aria-label':'ระดับความยาก'});
  const drawLevels=()=>{ const all=levels.size===3;
    R(levelBox,el('button',{type:'button',class:'fchip'+(all?' on':''),'aria-pressed':String(all),onclick:()=>{ levels.clear(); ['easy','medium','hard'].forEach(l=>levels.add(l)); drawLevels(); upd(); }},'ทุกระดับ',el('small',{},`${lvCount('easy')+lvCount('medium')+lvCount('hard')} ข้อ`)),
      ['easy','medium','hard'].map(l=>el('button',{type:'button',class:'fchip lv-'+l+(levels.has(l)&&!all?' on':''),'aria-pressed':String(levels.has(l)&&!all),
        onclick:()=>{ if(all){ levels.clear(); levels.add(l); } else if(levels.has(l)){ if(levels.size>1) levels.delete(l); } else levels.add(l); if(!levels.size) levels.add(l); drawLevels(); upd(); }},LEVEL_TH[l],el('small',{},`${lvCount(l)} ข้อ`))),
      el('span',{class:'muted small lvstate','aria-live':'polite'},all?'เลือกอยู่: ทุกระดับ':'เลือกอยู่: '+['easy','medium','hard'].filter(l=>levels.has(l)).map(l=>LEVEL_TH[l]).join(', ')));
  };
  const nSel=el('select',{'aria-label':'จำนวนข้อ'},[5,10,15,20].map(n=>el('option',{value:n,selected:(pref.n||10)===n?'':null},n+' ข้อ')));
  const info=el('p',{class:'muted small'});
  const upd=()=>{ const us=PINFO.units.filter(u=>!units.size||units.has(u.unit)); const n=us.reduce((a,u)=>a+[...levels].reduce((b,l)=>b+(u[l]||0),0),0); info.textContent=`มีข้อสอบตรงเงื่อนไขประมาณ ${n} ข้อ`+(types.size?' (ก่อนกรองรูปแบบ)':''); };
  const start=el('button',{class:'btn big',onclick:async()=>{
    const q={units:[...units].join(','),levels:[...levels].join(','),types:[...types].join(','),n:nSel.value};
    try{ localStorage.setItem('netlab-practice',JSON.stringify({units:[...units],levels:[...levels],types:[...types],n:+nSel.value})); }catch(e){}
    start.disabled=true;
    try{ const r=await api('GET',`/api/practice/questions?units=${q.units}&levels=${q.levels}&types=${q.types}&n=${q.n}`); if(!r.questions.length){ toast('ไม่มีข้อสอบตรงเงื่อนไข ลองเลือกเพิ่ม'); start.disabled=false; return; } await loadJs('js/sim/netsim.js').catch(()=>{}); practiceRun(r.questions); }
    catch(e){ toast(e.message); start.disabled=false; }
  }},'เริ่มฝึก');
  R(app,el('h1',{},'ฝึกทำข้อสอบ'),await mistakesPanel(),
    el('p',{class:'lede'},`คลังข้อสอบ ${PINFO.units.reduce((a,u)=>a+u.total,0)} ข้อ ${PINFO.types.length} รูปแบบ ตอบแล้วรู้ผลทันทีพร้อมคำอธิบาย ทำซ้ำได้ไม่จำกัด ไม่มีผลต่อคะแนนสอบ`),
    el('section',{class:'panel'},el('h2',{},'หน่วยการเรียน'),el('p',{class:'muted small'},'ไม่เลือก = ทุกหน่วย'),
      el('div',{class:'chips'},PINFO.units.map(u=>chip(units,u.unit,`หน่วย ${u.unit}`,UNIT_SHORT[u.unit-1]))),
      el('h2',{},'ระดับความยาก'),levelBox,
      el('h2',{},'รูปแบบข้อสอบ'),el('p',{class:'muted small'},'ไม่เลือก = ทุกรูปแบบ'),el('div',{class:'chips'},PINFO.types.map(t=>chip(types,t,TYPE_TH[t]))),
      el('div',{class:'row',style:'margin-top:14px'},nSel,start),info));
  drawLevels(); upd(); window.scrollTo(0,0);
}
function practiceRun(qs,opt){
  opt=opt||{};
  let i=0; const results=[];
  const draw=()=>{
    if(i>=qs.length) return practiceDone(qs,results);
    const pq=qs[i];
    const w=bankQuestion(pq,{onChange:()=>{ btn.disabled=!isAnswered(w.get()); }});
    const msg=el('div',{class:'msg bad'});
    const next=el('button',{class:'btn',hidden:'',onclick:()=>{ i++; draw(); }},i===qs.length-1?'ดูสรุปผล':'ข้อต่อไป');
    const btn=el('button',{class:'btn',disabled:'',onclick:async()=>{
      btn.disabled=true; msg.textContent='';
      try{ const r=await api('POST','/api/practice/check',{id:pq.id,answer:w.get()}); results[i]={id:pq.id,type:pq.type,unit:pq.unit,score:r.score,correct:r.correct,pq}; noteWrong(pq.id,r.correct); w.showResult(r); btn.hidden=true; next.hidden=false; next.focus(); }
      catch(e){ msg.textContent=e.offline?'ต้องเชื่อมต่ออินเทอร์เน็ตเพื่อตรวจคำตอบ':e.message; btn.disabled=false; }
    }},'ตรวจคำตอบ');
    R(app,el('div',{class:'pbar'},el('a',{href:'#/practice',class:'back'},'‹ เลือกชุดใหม่'),opt.review?el('span',{class:'tagt'},'ทบทวนข้อที่ผิด'):null,el('span',{},`ข้อ ${i+1} / ${qs.length}`),el('div',{class:'bar slim'},el('i',{style:`width:${Math.round(i/qs.length*100)}%`}))),
      el('article',{class:'qcard bqcard'},el('div',{class:'qhead'},el('span',{class:'qno'},i+1),el('span',{class:'lvl '+pq.level},LEVEL_TH[pq.level]),el('span',{class:'tagt'},TYPE_TH[pq.type]),el('span',{class:'muted small'},`หน่วย ${pq.unit}`)),
        w.node,el('div',{class:'row'},btn,next),msg));
    window.scrollTo(0,0);
  };
  draw();
}
function practiceDone(qs,results){
  const sc=results.reduce((a,r)=>a+(r?r.score:0),0);
  const byType={}; results.forEach(r=>{ if(!r) return; const t=(byType[r.type]=byType[r.type]||{n:0,s:0}); t.n++; t.s+=r.score; });
  R(app,el('h1',{},'สรุปผลการฝึก'),
    el('section',{class:'panel'},el('div',{class:'scorebig'},el('b',{},`${Math.round(sc*10)/10}/${qs.length}`),el('span',{},Math.round(sc/qs.length*100)+'%')),
      el('div',{class:'tablewrap'},el('table',{class:'btable'},el('thead',{},el('tr',{},el('th',{},'รูปแบบ'),el('th',{},'จำนวนข้อ'),el('th',{},'ถูก (%)'))),
        el('tbody',{},Object.entries(byType).map(([t,v])=>el('tr',{},el('td',{},TYPE_TH[t]),el('td',{class:'num'},v.n),el('td',{class:'num'},Math.round(v.s/v.n*100))))))),
      el('p',{class:'muted'},ME?'ผลการฝึกถูกบันทึกไว้ให้ครูดูภาพรวม แต่ไม่นับเป็นคะแนนสอบ':'ผลการฝึกแบบผู้เยี่ยมชมไม่ถูกบันทึก'),
      el('div',{class:'row'},results.some(r=>r&&!r.correct)?el('button',{class:'btn big',onclick:()=>practiceRun(results.filter(r=>r&&!r.correct).map(r=>r.pq),{review:true})},`ทบทวนข้อที่ผิดในชุดนี้ (${results.filter(r=>r&&!r.correct).length})`):null,
        el('button',{class:results.some(r=>r&&!r.correct)?'btn ghost':'btn big',onclick:()=>practicePage()},'ฝึกชุดใหม่'),el('a',{class:'btn ghost',href:'#/'},'กลับแดชบอร์ด'))));
  window.scrollTo(0,0);
}

/* ---------- exams ---------- */
let EXAM=null;   // running exam state
function stopExam(){ if(EXAM){ clearInterval(EXAM.tick); clearTimeout(EXAM.saveT); window.removeEventListener('beforeunload',EXAM.unload); EXAM=null; } }
async function examsPage(){
  setTitle('การสอบ');
  if(!ME){ R(app,el('h1',{},'การสอบ'),el('div',{class:'panel'},el('p',{},'การสอบใช้ได้เมื่อเข้าสู่ระบบเท่านั้น เพราะต้องบันทึกคะแนนให้ครู'),DBON?el('button',{class:'btn',onclick:loginModal},'เข้าสู่ระบบ'):null)); return; }
  const r=await api('GET','/api/exams'); if(r.now) SKEW=r.now-Date.now();
  const st=e=>e.attempt&&e.attempt.submitted?['done','ส่งแล้ว']:e.attempt?['doing','กำลังสอบ']:e.state==='upcoming'?['up','ยังไม่เปิด']:e.state==='closed'?['closed','ปิดแล้ว']:['open','เปิดสอบ'];
  R(app,el('h1',{},'การสอบ'),el('p',{class:'lede'},'การสอบที่ครูสร้างให้ห้องของคุณ ข้อสอบสุ่มจากคลังข้อสอบ แต่ละคนได้ข้อไม่เหมือนกัน ทำได้ครั้งเดียว ระบบจับเวลาและบันทึกคำตอบอัตโนมัติ'),
    !r.exams.length?el('div',{class:'panel'},el('p',{},'ยังไม่มีการสอบ')):
    el('ul',{class:'examlist'},r.exams.map(e=>{ const [k,t]=st(e);
      return el('li',{},el('a',{class:'examcard '+k,href:'#/exam/'+e.id},el('div',{},el('h2',{},e.title),
        el('p',{class:'muted small'},`${e.questions} ข้อ · ${e.minutes} นาที`+(e.openAt?` · เปิด ${fmtDate(e.openAt)}`:'')+(e.closeAt?` · ปิด ${fmtDate(e.closeAt)}`:''))),
        el('span',{class:'estate'},t,e.attempt&&e.attempt.submitted&&e.attempt.score!=null?el('b',{},` ${e.attempt.score}/${e.attempt.max}`):null))); })));
  window.scrollTo(0,0);
}
async function examPage(id){
  stopExam();
  setTitle('ทำข้อสอบ');
  if(!ME){ location.hash='#/exams'; return; }
  let v=await api('GET','/api/exams/'+id);
  if(v.notStarted){
    const s=v.state;
    R(app,el('a',{class:'back',href:'#/exams'},'‹ รายการสอบ'),el('h1',{},v.exam.title),
      el('section',{class:'panel'},el('p',{},`เวลาสอบ ${v.exam.minutes} นาที เมื่อกดเริ่มแล้วเวลาจะเดินต่อแม้ปิดหน้าเว็บ ระบบบันทึกคำตอบทุกครั้งที่ตอบ หมดเวลาแล้วระบบส่งให้อัตโนมัติ`),
        el('ul',{class:'blist'},el('li',{},'ทำได้ครั้งเดียว ข้อสอบของแต่ละคนสุ่มไม่เหมือนกัน'),el('li',{},'ระหว่างสอบจะไม่แสดงเฉลย'),el('li',{},'ถ้าอินเทอร์เน็ตหลุด ทำต่อได้ คำตอบเก็บไว้ในเครื่องและส่งเมื่อกลับมาออนไลน์')),
        s!=='open'?el('p',{class:'duehint'},s==='upcoming'?'การสอบนี้ยังไม่เปิด':'การสอบนี้ปิดแล้ว'):
        el('button',{class:'btn big start',onclick:async e=>{ e.target.disabled=true; try{ v=await api('POST',`/api/exams/${id}/start`); await loadJs('js/sim/netsim.js').catch(()=>{}); examRun(id,v); }catch(err){ toast(err.message); e.target.disabled=false; } }},'เริ่มทำข้อสอบ')));
    return;
  }
  if(v.submitted) return examResult(v);
  await loadJs('js/sim/netsim.js').catch(()=>{});
  examRun(id,v);
}
function examRun(id,v){
  if(v.submitted) return examResult(v);
  if(v.now) SKEW=v.now-Date.now();
  const lk='netlab-exam-'+id+'-'+ME.id;
  let local={}; try{ local=JSON.parse(localStorage.getItem(lk)||'{}'); }catch(e){}
  const answers=Object.assign({},v.answers||{},local);
  const dirty=new Set(Object.keys(local));
  const ws=v.questions.map(pq=>{ const w=bankQuestion(pq,{onChange:()=>{ answers[pq.id]=w.get(); dirty.add(pq.id); try{ localStorage.setItem(lk,JSON.stringify(Object.fromEntries([...dirty].map(k=>[k,answers[k]])))); }catch(e){} navUpd(); queueSave(); }}); if(answers[pq.id]!=null) w.set(answers[pq.id]); return w; });
  const clock=el('b',{class:'clock'}), saved=el('span',{class:'muted small'},'บันทึกแล้ว');
  const nav=el('div',{class:'qnav','aria-label':'ข้อสอบ'},ws.map((w,i)=>el('button',{type:'button',class:'qn',onclick:()=>document.getElementById('eq'+i).scrollIntoView({behavior:'smooth',block:'start'})},i+1)));
  const navUpd=()=>{ [...nav.children].forEach((b,i)=>b.classList.toggle('done',isAnswered(answers[v.questions[i].id]))); cnt.textContent=`ตอบแล้ว ${v.questions.filter(q=>isAnswered(answers[q.id])).length}/${v.questions.length}`; };
  const cnt=el('span',{});
  async function save(){
    if(!dirty.size) return;
    const batch=Object.fromEntries([...dirty].map(k=>[k,answers[k]]));
    saved.textContent='กำลังบันทึก...';
    try{ await api('PUT',`/api/exams/${id}/answers`,{answers:batch}); Object.keys(batch).forEach(k=>dirty.delete(k)); try{ localStorage.setItem(lk,JSON.stringify(Object.fromEntries([...dirty].map(k=>[k,answers[k]])))); }catch(e){} saved.textContent='บันทึกแล้ว '+new Date().toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit',second:'2-digit'}); }
    catch(e){ if(e.code==='submitted'){ stopExam(); const r=await api('GET','/api/exams/'+id); examResult(r); return; } saved.textContent=e.offline?'ออฟไลน์ คำตอบเก็บไว้ในเครื่อง จะบันทึกเมื่อออนไลน์':'บันทึกไม่สำเร็จ จะลองใหม่'; EXAM&&(EXAM.saveT=setTimeout(save,5000)); }
  }
  function queueSave(){ if(!EXAM) return; clearTimeout(EXAM.saveT); EXAM.saveT=setTimeout(save,1500); }
  async function submit(auto){
    if(!auto&&!confirm(`ส่งข้อสอบ? ตอบแล้ว ${v.questions.filter(q=>isAnswered(answers[q.id])).length} จาก ${v.questions.length} ข้อ ส่งแล้วแก้ไม่ได้`)) return;
    sendBtn.disabled=true;
    try{ const r=await api('POST',`/api/exams/${id}/submit`,{answers:Object.fromEntries([...dirty].map(k=>[k,answers[k]]))}); try{ localStorage.removeItem(lk); }catch(e){} stopExam(); examResult(r); }
    catch(e){ sendBtn.disabled=false; toast(e.offline?'ส่งไม่ได้เพราะออฟไลน์ คำตอบยังอยู่ในเครื่อง ลองส่งใหม่เมื่อออนไลน์':e.message); if(auto&&EXAM) EXAM.saveT=setTimeout(()=>submit(true),5000); }
  }
  const sendBtn=el('button',{class:'btn',onclick:()=>submit(false)},'ส่งข้อสอบ');
  const bar=el('div',{class:'timer exambar'},el('span',{},'เวลาที่เหลือ'),clock,cnt,saved,sendBtn);
  R(app,el('h1',{},v.exam.title),bar,nav,
    el('ol',{class:'quiz'},ws.map((w,i)=>el('li',{class:'qcard bqcard',id:'eq'+i},el('div',{class:'qhead'},el('span',{class:'qno'},i+1),el('span',{class:'tagt'},TYPE_TH[w.q.type])),w.node))),
    el('div',{class:'row',style:'margin:18px 0'},el('button',{class:'btn big',onclick:()=>submit(false)},'ส่งข้อสอบ')));
  EXAM={id};
  EXAM.unload=e=>{ if(dirty.size){ e.preventDefault(); e.returnValue=''; } };
  window.addEventListener('beforeunload',EXAM.unload);
  const tick=()=>{ const ms=v.deadline-now(); clock.textContent=fmt(ms); bar.classList.toggle('warn',ms<=5*60000); bar.classList.toggle('urgent',ms<=60000); if(ms<=0&&EXAM){ clearInterval(EXAM.tick); submit(true); } };
  EXAM.tick=setInterval(tick,1000); tick(); navUpd();
  if(dirty.size) queueSave();
  window.scrollTo(0,0);
}
function examResult(v){
  R(app,el('a',{class:'back',href:'#/exams'},'‹ รายการสอบ'),el('h1',{},v.exam.title),
    el('section',{class:'panel'},el('h2',{},'ส่งข้อสอบแล้ว'),el('div',{class:'scorebig'},el('b',{},`${v.score}/${v.max}`),el('span',{},Math.round(v.score/v.max*100)+'%')),
      el('p',{class:'muted small'},'ส่งเมื่อ '+fmtDate(v.submitted)+' · คะแนนบันทึกให้ครูแล้ว')),
    v.review?el('section',{class:'panel'},el('h2',{},'เฉลยและคำอธิบาย'),el('ol',{class:'review'},v.review.map(x=>el('li',{class:x.correct?'ok':'bad'},el('p',{class:'qq'},x.q),
      el('p',{class:'ans'},el('b',{},x.correct?'ตอบถูก':x.score>0?`ถูกบางส่วน (${Math.round(x.score*100)}%)`:'ตอบผิด'),x.given?` · คุณตอบ: ${x.given}`:' · ไม่ได้ตอบ'),
      x.correct?null:el('p',{class:'ans right'},'คำตอบที่ถูก: ',el('b',{},x.answer)),el('p',{class:'explain'},x.explain)))))
      :el('p',{class:'muted'},'ครูตั้งค่าไม่แสดงเฉลยสำหรับการสอบนี้'));
  window.scrollTo(0,0);
}

/* ---------- simulators ---------- */
const SIM_META={
  topology:{icon:'<rect x="2" y="3" width="7" height="5" rx="1"/><rect x="15" y="3" width="7" height="5" rx="1"/><rect x="8.5" y="16" width="7" height="5" rx="1"/><path d="M5.5 8v4h13V8M12 12v4"/>',sub:'ลากวางอุปกรณ์ เดินสาย ตั้ง IP แล้วทดสอบ Ping',units:'หน่วย 1, 3, 4, 8'},
  subnet:{icon:'<path d="M4 6h16M4 12h10M4 18h6"/><path d="M17 15l3 3-3 3"/>',sub:'ฝึกคำนวณ Network, Broadcast, Host และ VLSM พร้อมวิธีทำ',units:'หน่วย 3, 6'},
  crimp:{icon:'<path d="M4 14h6v6H4zM10 16h10M10 18h10"/><path d="M6 14V6l3-2 3 2v4"/>',sub:'เรียงสี T568A/T568B เข้าหัว RJ-45 และทดสอบด้วย LAN Tester',units:'หน่วย 4'},
  terminal:{icon:'<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M6 9l3 3-3 3M11 15h6"/>',sub:'ใช้คำสั่ง Windows และ Linux ตรวจสอบเครือข่ายจำลอง',units:'หน่วย 6, 8'},
  troubleshoot:{icon:'<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4M8 11h6M11 8v6"/>',sub:'วิเคราะห์สาเหตุ แก้ไขการตั้งค่า แล้วทดสอบให้ใช้งานได้',units:'หน่วย 8'}
};
let SIMI=null;
function stopSim(){ if(SIMI){ try{ SIMI.destroy&&SIMI.destroy(); }catch(e){} SIMI=null; } }
async function simsPage(){
  setTitle('ห้องจำลอง');
  const r=await api('GET','/api/sims');
  R(app,el('h1',{},'ห้องปฏิบัติการจำลอง'),el('p',{class:'lede'},'ฝึกลงมือทำในเครือข่ายจำลองที่ทำงานจริง ทุกภารกิจตรวจที่เซิร์ฟเวอร์และบันทึกคะแนนดีที่สุดให้ครูเห็น'),
    el('div',{class:'simgrid'},r.sims.map(s=>{ const m=SIM_META[s.id]||{}; const done=Object.values(s.done||{}).filter(x=>x.best>=x.max).length;
      const ic=el('span',{class:'simic','aria-hidden':'true'}); ic.innerHTML=`<svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${m.icon||''}</svg>`;
      return el('a',{class:'simcard',href:'#/sim/'+s.id},ic,el('div',{},el('h2',{},s.title),el('p',{},m.sub||''),el('p',{class:'muted small'},m.units||'')),
        el('div',{class:'simstat'},el('b',{},`${done}/${s.missions.length}`),el('small',{},'ภารกิจผ่าน'))); })));
  window.scrollTo(0,0);
}
async function simPage(id){
  const deps={topology:['js/sim/netsim.js'],terminal:['js/sim/netsim.js'],troubleshoot:['js/sim/netsim.js','js/sim/terminal.js'],subnet:[],crimp:[]}[id];
  if(!deps){ R(app,el('div',{class:'panel'},el('p',{},'ไม่พบห้องจำลองนี้'))); return; }
  R(app,el('p',{class:'loading'},'กำลังโหลดห้องจำลอง...'));
  const info=await api('GET','/api/sims/'+id);
  for(const d of deps) await loadJs(d);
  await loadJs('js/sim/'+id+'.js');
  if((location.hash||'')!=='#/sim/'+id) return;
  setTitle(info.title);
  const root=el('div',{class:'simroot'});
  R(app,el('a',{class:'back',href:'#/sims'},'‹ ห้องจำลองทั้งหมด'),root);   // each simulator renders its own heading and login notice
  const done=Object.assign({},info.done||{});
  const ctx={
    missions:info.missions, done, user:ME?{name:ME.name}:null, toast,
    newProblem:mission=>api('POST',`/api/sims/${id}/new`,{mission}),
    submit:async(mission,payload,extra)=>{
      const r=await api('POST',`/api/sims/${id}/submit`,Object.assign({mission,payload},extra||{}));
      if(ME){ const d=done[mission]||{best:0,max:r.max,attempts:0}; d.best=Math.max(d.best,r.score); d.max=r.max; d.attempts++; done[mission]=d; }
      return r;
    }
  };
  try{ SIMI=window.NL_SIMS[id].mount(root,ctx)||null; }catch(e){ console.error(e); R(root,el('p',{class:'msg bad'},'เปิดห้องจำลองไม่สำเร็จ: '+e.message)); }
  window.scrollTo(0,0);
}

'use strict';
/* ---------- 3.2 ฝึกปฏิบัติ (Practical Laboratory), #/lesson/wN/lab ----------
   ONE practical session per week with three parts (Guided Lab, Independent Lab, Troubleshooting Lab) under ONE timer.
   The timer lives on the server (server/practical.js): this page shows deadline - server clock and keeps nothing about
   the timer in the browser, so changing part, opening a simulator, going back, reloading or another device never restarts it.
   Hands-on tasks are answered here (POST /api/check). 3.3: simulator missions open on this page too, in an Embedded
   Virtual Lab workspace under their card (only that mission, no mission list, no free mode; see prOpenSim); a submit
   there is recorded into the running session by the server (POST /api/sims/:sim/submit) and the card updates at once.
   Guests see the plan and may try a mission (not recorded); teachers see the page and preview missions (starting is for students). */
let TICK=null;
const fmt=ms=>{ms=Math.max(0,ms);const t=Math.round(ms/1000);const m=Math.floor(t/60),sec=t%60;return String(m).padStart(2,'0')+':'+String(sec).padStart(2,'0');};
const prClockText=ms=>{ const t=Math.max(0,Math.ceil(ms/1000)); return String(Math.floor(t/60)).padStart(2,'0')+':'+String(t%60).padStart(2,'0'); };
let PR=null;                  // state of the open practical page (null elsewhere)
const PR_PART={};             // last part looked at, per week (this tab only; not timer state)
const PR_HINT={};             // hints already opened in a session: 'session:key'
const PR_DEF={passPct:70,weights:{guided:30,independent:40,trouble:30},maxAttempts:3,cooldownMin:10};
const PR_PARTS=[{id:'guided',title:'Guided Lab',th:'ฝึกตามขั้นตอน'},{id:'independent',title:'Independent Lab',th:'ฝึกด้วยตนเอง'},{id:'trouble',title:'Troubleshooting Lab',th:'ฝึกแก้ปัญหาเครือข่าย'}];
function stopTick(){
  if(TICK){ clearInterval(TICK); TICK=null; }
  if(PR&&PR.ws) prWsKill(PR.ws,'route');   // 3.3: leaving the page destroys the embedded simulator (drafts stay in the browser, scores on the server)
  if(PR){ if(PR.poll) clearInterval(PR.poll); if(PR.retry) clearTimeout(PR.retry); if(PR.vis) document.removeEventListener('visibilitychange',PR.vis); PR.dead=true; PR=null; }
}
const prNow=()=>Date.now()+(PR?PR.off:0);
const prAdd=(n,...k)=>{ n.append(...k.flat(Infinity).filter(x=>x!=null&&x!==false)); return n; };   // append that flattens arrays and skips null
const prCeil5=m=>Math.ceil(m/5)*5;
/* the plan of a week without the server (guests, no database, offline): same rules as server/practical.js setOf() */
function prLocalPlan(id){
  const c=typeof currOf==='function'?currOf(id):null, lab=labOf(id);
  const pol=(typeof PATH!=='undefined'&&PATH&&PATH.rules&&PATH.rules.practical)||PR_DEF;
  const task=(t,vm)=>({key:t.key,kind:'task',title:t.q,minutes:3,max:10,vm});
  const tasks=lab?lab.tasks.map(t=>task(t,false)).concat((lab.vmTasks||[]).map(t=>task(t,true))):[];
  const ms=a=>(a||[]).map(m=>({key:m.sim+':'+m.id,kind:'mission',title:m.title,minutes:m.minutes||15,max:m.max||10,href:`#/sim/${m.sim}/${m.id}`,sim:m.sim,mission:m.id,level:m.level,simTitle:m.simTitle}));
  const by={guided:tasks.concat(ms(c&&c.guided)),independent:ms(c&&c.independent),trouble:ms(c&&c.solve)};
  const vm=tasks.some(t=>t.vm);
  const all=[].concat(by.guided,by.independent,by.trouble);
  return {local:true,week:id,minutes:prCeil5(all.reduce((a,i)=>a+i.minutes,0)+(vm?5:0)),type:(c&&c.solveType)||'trouble',vm,
    parts:PR_PARTS.filter(p=>by[p.id].length).map(p=>Object.assign({},p,{weight:pol.weights[p.id]||0,items:by[p.id]})),
    policy:pol,attempts:null,running:null,otherRunning:null,sessions:[],best:null};
}
const prItems=st=>[].concat(...st.parts.map(p=>p.items));
const prPartTh=(p,st)=>p.id==='trouble'&&st&&st.type==='analysis'?'กิจกรรมวิเคราะห์':p.th;
function prKind(it){
  if(it.kind==='mission') return 'ภารกิจห้องจำลอง';
  const f=findTask(it.key);
  if(it.vm) return 'เครื่องจำลอง Linux (Terminal Simulator)';
  if(f.t&&f.t.type==='form') return 'ตั้งค่าอุปกรณ์';
  return f.r&&f.r.terminal?'Terminal Simulator':'โจทย์ลงมือ';
}
/* result of one item in the running session (or null) */
const prRes=(res,key)=>{ if(!res) return null; for(const p of res.parts) for(const i of p.items) if(i.key===key) return i; return null; };

async function practicalPage(L){
  stopTick();
  const id=L.id, m=metaOf(id);
  const me=PR={id,L,st:null,off:0,part:PR_PART[id]||null,view:null,net:false,poll:null,retry:null,term:null,vmBox:null,mode:null,busy:false};
  setTitle(`ฝึกปฏิบัติ สัปดาห์ ${m.week}`);
  me.root=el('div',{id:'prPage',class:'prpage','data-week':id});
  R(app,lessonRail(id,'lab'),me.root);
  window.scrollTo(0,0);
  if(!(ME&&DBON)){ me.st=prLocalPlan(id); me.mode='guest'; prDraw(); return; }
  R(me.root,el('p',{class:'loading'},'กำลังโหลดฝึกปฏิบัติ...'));
  me.vis=()=>{ if(document.visibilityState==='visible'&&PR===me) prLoad(); };
  document.addEventListener('visibilitychange',me.vis);
  TICK=setInterval(prTick,1000);
  await prLoad();
}
/* reads the session state from the server; on a network error keeps what is shown, says so and tries again */
async function prLoad(){
  const me=PR; if(!me||me.dead) return;
  if(me.retry){ clearTimeout(me.retry); me.retry=null; }
  const t0=Date.now();
  let st;
  try{ st=await api('GET','/api/practical/'+me.id); }
  catch(e){
    if(me.dead) return;
    if(e.code==='locked'&&typeof lockPage==='function'){ stopTick(); await loadPath(true); renderShell(); lockPage(me.id,e.body&&e.body.lock); return; }
    if(e.offline||!e.status||e.status>=500){
      prNet(true);
      if(!me.st){ me.st=prLocalPlan(me.id); me.mode='offline'; prDraw(); }
      me.retry=setTimeout(prLoad,5000); return;
    }
    if(!me.st) R(me.root,stateBox('error','เปิดหน้าฝึกปฏิบัติไม่สำเร็จ',[e.message||'เกิดข้อผิดพลาด'],[el('button',{class:'btn',type:'button',onclick:prLoad},'ลองใหม่')]));
    return;
  }
  if(me.dead) return;
  prSetState(st,t0);
}
function prSetState(st,t0){
  const me=PR; if(!me) return;
  me.off=st.now-(t0+Date.now())/2;
  const was=me.st, wasRun=was&&was.running?was.running.id:null, nowRun=st.running?st.running.id:null;
  me.st=st; prNet(false);
  const mode=ME&&ME.role!=='student'?'teacher':'student';
  if(was&&!was.local&&wasRun===nowRun&&me.mode===mode&&nowRun){ prUpdate(); return; }
  if(wasRun&&!nowRun){   // the session just closed (submitted here, on another device, or time is up): show its result
    const last=prLatest(st); me.view=last?last.id:null;
    if(me.ws&&me.ws.mode==='run'){ prWsKill(me.ws,'ended'); if(typeof toast==='function') toast(last&&last.status==='timeout'?'หมดเวลาฝึกปฏิบัติ ระบบส่งงานให้อัตโนมัติและปิดห้องจำลองแล้ว':'รอบฝึกปฏิบัตินี้ปิดแล้ว ปิดห้องจำลองแล้ว'); }
    if(typeof activeLoad==='function') activeLoad();
    loadPath(true).then(()=>{ if(PR===me){ const rail=app.querySelector('.lhead'); if(rail) rail.replaceWith(lessonRail(me.id,'lab')); renderShell(); } });
  }
  me.mode=mode;
  prDraw();
  if(nowRun&&!wasRun) window.scrollTo(0,0);
}
const prLatest=st=>(st.sessions||[]).slice().sort((a,b)=>(b.endedAt||b.startedAt||0)-(a.endedAt||a.startedAt||0))[0]||null;
function prNet(on){
  const me=PR; if(!me) return;
  me.net=on;
  const c=document.getElementById('prNet'); if(c) c.hidden=!on;
}
const prNetChip=()=>el('p',{id:'prNet',class:'prnet',role:'status',hidden:PR&&PR.net?null:''},icon('st_review'),el('span',{},'ขาดการเชื่อมต่อ กำลังลองใหม่ เวลายังเดินต่อที่เซิร์ฟเวอร์ งานที่บันทึกแล้วไม่หาย'));

function prDraw(){
  const me=PR; if(!me||me.dead) return;
  const st=me.st, run=!!st.running;
  if(me.ws&&!me.ws.it.extra&&me.ws.mode!==prWsModeOf()) prWsKill(me.ws,'mode');   // e.g. a session started or ended on another device
  me.root.dataset.mode=run?'run':me.mode==='guest'?'guest':(st.sessions&&st.sessions.length?'res':'pre');
  if(run){
    R(me.root,prHead(true),prRunUI(),prExtraBlock());
    prDrawPart(); prUpdate();
    if(!me.poll) me.poll=setInterval(()=>{ if(PR===me&&!me.busy) prLoad(); },20000);
  }else{
    if(me.poll){ clearInterval(me.poll); me.poll=null; }
    const hasRes=st.sessions&&st.sessions.length;
    R(me.root,prNetChip(),prHead(false),hasRes?[prResults(),prStartBlock(),prPlan(false)]:[prPlan(true),prStartBlock()],prExtraBlock());
  }
  if(me.ws) prWsReattach(me.ws);
  prTick();
}
/* lesson title, objectives and the facts students need before they start */
function prHead(compact){
  const me=PR, st=me.st, L=me.L, m=metaOf(me.id), c=typeof currOf==='function'?currOf(me.id):null;
  const can=c&&c.can&&c.can.length?c.can:(L.objectives||[]);
  const P=st.policy||PR_DEF, A=st.attempts;
  const fact=(k,v,id)=>el('div',{class:id==='prWeights'?'wide':null},el('dt',{},k),el('dd',{id},v));
  const box=el('section',{class:'panel prhead'+(compact?' compact':'')},
    el('p',{class:'contk'},'ขั้นที่ 3 ฝึกปฏิบัติ (Practical Laboratory)'),
    el('h2',{},`สัปดาห์ที่ ${m.week} ${L.title}`));
  if(compact){ prAdd(box,el('details',{class:'prcan'},el('summary',{},'วัตถุประสงค์และเกณฑ์'),prCanList(can),prFacts(st,P,A,fact))); return box; }
  prAdd(box,can.length?[el('h3',{},'เมื่อฝึกปฏิบัติครบ นักเรียนจะทำได้'),prCanList(can)]:null,prFacts(st,P,A,fact));
  return box;
}
const prCanList=can=>el('ul',{class:'checklist prcanlist'},can.map(t=>el('li',{},t)));
function prFacts(st,P,A,fact){
  return el('dl',{class:'prfacts'},
    fact('เวลารวม',`${st.minutes} นาที`,'prMinutes'),
    fact('เกณฑ์ผ่าน',`คะแนนรวมอย่างน้อย ${P.passPct}%`,'prPass'),
    fact('สัดส่วนคะแนน',st.parts.map(p=>`${p.title} ${p.weight}%`).join(' · '),'prWeights'),
    A?fact('สิทธิ์ทำ',`ใช้ไป ${A.used} จาก ${A.max} รอบ · เหลือ ${A.left} รอบ`,'prAttempts')
      :fact('สิทธิ์ทำ',`${P.maxAttempts} รอบ ระบบนับรอบที่ดีที่สุด`,'prAttempts'),
    fact('เว้นระยะระหว่างรอบ',P.cooldownMin?`${P.cooldownMin} นาที`:'ไม่ต้องรอ','prCool'),
    st.best?fact('ผลที่นับ (ดีที่สุด)',`${st.best.total}% ${st.best.passed?'ผ่านเกณฑ์':'ยังไม่ผ่านเกณฑ์'}`+(st.best.legacy?' (ผลจากงานเดิมก่อนปรับระบบ)':''),'prBestFact'):null);
}
/* the three parts with every activity, before starting (and folded under the results afterwards) */
function prPlan(open){
  const me=PR, st=me.st, btns=open||me.mode==='teacher'||me.mode==='guest';   // folded under the results, the result list has the buttons
  const sumMin=p=>p.items.reduce((a,i)=>a+i.minutes,0);
  const body=[
    el('p',{class:'small'},`ทำตามลำดับ ส่วนที่ 1 ถึง ${st.parts.length} ใช้เวลารวมชุดเดียว ${st.minutes} นาที`+(st.vm?' (รวมเวลาเปิดเครื่องจำลอง Linux ประมาณ 5 นาที)':'')+' เวลาไม่เริ่มใหม่เมื่อเปลี่ยนส่วนหรือเปิดห้องจำลอง'),
    st.parts.map((p,i)=>el('div',{class:'prplanpart','data-part':p.id},
      el('h3',{},el('span',{class:'prpn'},i+1),el('span',{},p.title,el('small',{},prPartTh(p,st))),el('span',{class:'prw'},`${p.weight}% · ${p.items.length} กิจกรรม · ประมาณ ${sumMin(p)} นาที`)),
      el('ol',{class:'prplanlist'},p.items.map(it=>el('li',{class:'prplanitem','data-key':it.key,'data-kind':it.kind},
        el('span',{class:'prpt'},it.title),
        el('small',{},`${prKind(it)}${it.kind==='mission'&&it.simTitle?' · '+it.simTitle:''} · ประมาณ ${it.minutes} นาที · เต็ม ${it.max}`),
        btns&&it.kind==='mission'?prOpenBtn(it,prOpenLabel(null),'ghost sm'):null))))),
    el('p',{class:'muted small'},'ภารกิจห้องจำลองตรวจจากเครือข่ายที่นักเรียนสร้างและตั้งค่าเอง โจทย์ลงมือใช้ Terminal Simulator หรือเครื่องจำลองในเบราว์เซอร์ ไม่ใช่เครื่องจริง คะแนนคิดที่เซิร์ฟเวอร์')];
  if(open) return el('section',{class:'panel prplan',id:'prPlan'},el('h2',{},`กิจกรรมทั้งหมด ${st.parts.length} ส่วน`),body);
  return el('details',{class:'panel prplan',id:'prPlan'},el('summary',{},`กิจกรรมทั้งหมด ${st.parts.length} ส่วน (${prItems(st).length} กิจกรรม · ${st.minutes} นาที)`),body);
}
/* start / retake, with every reason it cannot start yet */
/* 3.6: the practical step waits for the earlier steps of the week (pre-test, content, exercises); the server checks it too */
const prOrderLocked=()=>!!(PR&&PR.st&&PR.st.order&&PR.st.order.ok===false&&!PR.st.running);
function prOrderBox(missing){
  return el('section',{class:'panel prstart prorder',id:'prOrder',role:'status'},
    el('p',{class:'prnote'},icon('locked'),' ',el('b',{},'ยังเริ่มฝึกปฏิบัติไม่ได้: ทำขั้นก่อนหน้าให้ครบก่อน')),
    el('ul',{class:'prorderlist'},(missing||[]).map(m=>el('li',{'data-key':m.key},el('a',{href:m.link},m.label),m.detail?el('span',{class:'muted small'},` (${m.detail})`):null))),
    el('p',{class:'small muted'},'เรียนตามลำดับ: ก่อนเรียน → เนื้อหาและแบบฝึกหัด → ฝึกปฏิบัติ → หลังเรียน'));
}
function prStartBlock(){
  const me=PR, st=me.st, box=el('section',{class:'panel prstart',id:'prStartBox'});
  const msg=el('p',{class:'msg bad',id:'prStartMsg',role:'alert'});
  if(me.mode==='guest'){
    prAdd(box,el('p',{class:'prnote'},el('b',{},'เข้าสู่ระบบเพื่อเริ่มฝึกปฏิบัติ')),
      el('p',{class:'small'},DBON?'การฝึกปฏิบัติจับเวลาและบันทึกคะแนนที่เซิร์ฟเวอร์ จึงใช้กับบัญชีนักเรียนเท่านั้น ระหว่างนี้อ่านรายการกิจกรรมและเนื้อหาได้'
        :'เว็บไซต์นี้ยังไม่ได้เปิดระบบบัญชีผู้ใช้ จึงยังเริ่มฝึกปฏิบัติแบบจับเวลาไม่ได้'),
      DBON?el('div',{class:'row'},el('button',{class:'btn big',type:'button',id:'prLogin',onclick:loginModal},'เข้าสู่ระบบ'),el('a',{class:'btn ghost',href:`#/lesson/${me.id}/content`},'อ่านเนื้อหา')):null);
    return box;
  }
  if(me.mode==='offline'){ prAdd(box,el('p',{class:'prnote'},el('b',{},'ต้องเชื่อมต่ออินเทอร์เน็ตเพื่อเริ่มฝึกปฏิบัติ')),el('p',{class:'small'},'ระบบจะลองเชื่อมต่อใหม่เอง เมื่อเชื่อมต่อได้หน้านี้จะแสดงปุ่มเริ่ม')); return box; }
  if(prOrderLocked()) return prOrderBox(st.order.missing);
  const A=st.attempts, P=st.policy, used=A.used;
  const label=used?`เริ่มฝึกปฏิบัติรอบใหม่ (รอบที่ ${used+1} จาก ${A.max})`:'เริ่มฝึกปฏิบัติ';
  const btn=el('button',{class:'btn big prgo-start',type:'button',id:'prStart','data-retake':used?'1':null,onclick:()=>prStart(btn,msg)},label);
  const intro=el('p',{class:'small'},`กดแล้วเริ่มนับถอยหลัง ${st.minutes} นาทีทันที เวลาเดินต่อแม้เปลี่ยนส่วน เปิดห้องจำลอง ปิดหน้าเว็บ หรือเปิดจากเครื่องอื่น ทำเสร็จแล้วกด "ส่งงานทั้งหมด" ถ้าหมดเวลาระบบส่งให้อัตโนมัติและประเมินจากงานที่บันทึกไว้`);
  if(me.mode==='teacher'){
    prAdd(box,el('p',{class:'prnote'},el('b',{},'บัญชีครู: ดูรายการกิจกรรมและเปิดภารกิจในห้องจำลองได้ การจับเวลาฝึกปฏิบัติใช้กับบัญชีนักเรียน')),btn,msg);
    return box;
  }
  if(st.otherRunning){
    const o=st.otherRunning;
    prAdd(box,el('p',{class:'prnote prother'},el('b',{},`กำลังฝึกปฏิบัติสัปดาห์ที่ ${o.week.slice(1)} อยู่`),' เหลือเวลา ',el('b',{id:'prOtherLeft','data-deadline':String(o.deadline)},prClockText(o.deadline-prNow())),' ส่งงานรอบนั้นหรือรอให้หมดเวลาก่อน จึงจะเริ่มสัปดาห์นี้ได้'),
      el('div',{class:'row'},el('a',{class:'btn big',id:'prOtherLink',href:`#/lesson/${o.week}/lab`},`ไปฝึกปฏิบัติสัปดาห์ที่ ${o.week.slice(1)}`)));
    return box;
  }
  if(st.best&&st.best.passed) prAdd(box,el('p',{class:'msg ok'},`ผ่านฝึกปฏิบัติแล้ว (${st.best.total}%)`+(A.left?' ทำเพิ่มได้ ระบบนับรอบที่ดีที่สุด':'')));
  if(!A.left){ prAdd(box,el('p',{class:'prnote',id:'prNoAttempts'},el('b',{},`ใช้สิทธิ์ฝึกปฏิบัติครบ ${A.max} รอบแล้ว`),' ระบบนับรอบที่ดีที่สุด ถ้าต้องการทำเพิ่มให้ติดต่อครู')); return box; }
  if(A.nextAt&&A.nextAt>prNow()){
    btn.disabled=true;
    prAdd(box,el('p',{class:'cooldown',id:'prCooldown','data-next':String(A.nextAt)},''),btn,msg);
    return box;
  }
  prAdd(box,used?null:intro,used?el('p',{class:'small'},`ทำได้อีก ${A.left} รอบ ระบบนับรอบที่ดีที่สุด ก่อนเริ่มให้ดูสิ่งที่ยังไม่ผ่านด้านบนก่อน`):null,btn,msg);
  return box;
}
async function prStart(btn,msg){
  const me=PR; if(!me||me.busy) return;
  me.busy=true; btn.disabled=true; msg.textContent=''; msg.className='msg wait'; msg.textContent='กำลังเริ่ม...';
  const t0=Date.now();
  try{ const st=await api('POST',`/api/practical/${me.id}/start`); me.busy=false; prSetState(st,t0); if(typeof activeLoad==='function') activeLoad(); }
  catch(e){
    me.busy=false; if(me.dead) return;
    msg.className='msg bad';
    if(e.code==='locked'&&typeof lockPage==='function'){ stopTick(); lockPage(me.id,e.body&&e.body.lock); return; }
    if(e.code==='step_locked'){ if(me.st) me.st.order={ok:false,missing:(e.body&&e.body.missing)||[]}; prDraw(); return; }
    if(e.code==='cooldown'&&e.body&&e.body.nextAt){ me.st.attempts.nextAt=e.body.nextAt; prDraw(); return; }
    if(e.code==='running_other'||e.code==='no_attempts'){ await prLoad(); return; }
    msg.textContent=e.offline?'ขาดการเชื่อมต่อ ยังเริ่มไม่ได้ ลองกดอีกครั้งเมื่อเชื่อมต่อได้':(e.message||'เริ่มไม่สำเร็จ');
    btn.disabled=false;
  }
}

/* ---------- running session ---------- */
function prRunUI(){
  const me=PR, st=me.st, run=st.running;
  if(!me.part||!st.parts.some(p=>p.id===me.part)) me.part=st.parts[0].id;
  const timer=el('div',{class:'prtimer',id:'prTimer',role:'region','aria-label':'เวลาฝึกปฏิบัติ'},
    el('div',{class:'prtl'},el('span',{class:'prtlbl'},'เวลาที่เหลือ'),el('b',{id:'prClock',class:'prclock',role:'timer','aria-live':'off'},prClockText(run.deadline-prNow())),
      el('small',{},`จาก ${st.minutes} นาที · รอบที่ ${run.attempt}`)),
    el('div',{class:'prov'},el('span',{id:'prOverall'}),el('span',{class:'prline'},el('i',{id:'prOverallBar'}))),
    el('button',{class:'btn',type:'button',id:'prSubmit',onclick:prAskSubmit},'ส่งงานทั้งหมด'),
    prNetChip(),
    el('div',{id:'prConfirm',class:'prconfirm',hidden:'',role:'alertdialog','aria-labelledby':'prConfirmT'}));
  const tabs=el('div',{class:'prtabs',role:'tablist','aria-label':'ส่วนของฝึกปฏิบัติ'},st.parts.map((p,i)=>
    el('button',{class:'prpart','data-part':p.id,role:'tab',type:'button','aria-selected':p.id===me.part?'true':'false','aria-controls':'prPanel',onclick:()=>prGo(p.id)},
      el('span',{class:'prpn'},i+1),el('span',{class:'prpt'},p.title,el('small',{class:'prpc'},'')))));
  return [timer,tabs,el('section',{class:'prpanel',id:'prPanel',role:'tabpanel'})];
}
function prGo(pid){
  const me=PR; if(!me) return;
  me.part=PR_PART[me.id]=pid;
  app.querySelectorAll('.prtabs .prpart').forEach(b=>b.setAttribute('aria-selected',b.dataset.part===pid?'true':'false'));
  prDrawPart(); prUpdate();
  const tabs=app.querySelector('.prtabs'), t=document.getElementById('prTimer');
  if(tabs&&t&&tabs.getBoundingClientRect().top<t.getBoundingClientRect().bottom) tabs.scrollIntoView({block:'start'});   // scroll-margin-top keeps it below the sticky timer
}
const PR_INTRO={
  guided:'ทำตามขั้นตอน: ตอบโจทย์ลงมือในหน้านี้ (พิมพ์คำสั่งใน Terminal Simulator แล้วตอบจากผลที่เห็นจริง) และทำภารกิจในห้องจำลองที่มีคำแนะนำทีละขั้น',
  independent:'ทำภารกิจในห้องจำลองด้วยตนเอง ระบบไม่แสดงวิธีทำทั้งหมด ใช้สิ่งที่ฝึกในส่วนที่ 1',
  trouble:'หาสาเหตุจากอาการ แก้ที่ต้นเหตุ แล้วทดสอบยืนยันว่าใช้งานได้',
  analysis:'อ่านสถานการณ์และข้อมูลที่ให้มา วิเคราะห์ว่าโจทย์ต้องการอะไร เลือกวิธีที่เหมาะสม แล้วตรวจผลให้ตรงกับโจทย์'};
function prDrawPart(){
  const me=PR, st=me.st, panel=document.getElementById('prPanel'); if(!panel) return;
  const i=st.parts.findIndex(p=>p.id===me.part), p=st.parts[i], lab=labOf(me.id);
  const tasks=p.items.filter(x=>x.kind==='task'), hasMission=p.items.some(x=>x.kind==='mission');
  const termTasks=tasks.filter(x=>!x.vm), vmTasks=tasks.filter(x=>x.vm);
  if(termTasks.length&&lab&&lab.terminal&&!me.term) me.term=terminal(lab.quick);
  if(vmTasks.length&&lab&&!me.vmBox) me.vmBox=vmPanel(lab);
  const prev=st.parts[i-1], next=st.parts[i+1];
  const row=it=>it.kind==='task'?prTaskRow(it):prMissionRow(it);
  R(panel,
    el('div',{class:'prphead'},el('h3',{},`ส่วนที่ ${i+1} ${p.title}`,el('small',{},prPartTh(p,st))),el('p',{class:'prpprog','data-part':p.id})),
    el('p',{class:'small'},PR_INTRO[p.id==='trouble'&&st.type==='analysis'?'analysis':p.id]),
    hasMission?el('p',{class:'muted small'},'ภารกิจห้องจำลอง: กด "เปิดห้องจำลอง" ห้องจำลองของภารกิจนั้นเปิดในหน้านี้ ทำแล้วกดส่งในห้องจำลอง คะแนนบันทึกเข้ารอบนี้อัตโนมัติ เวลาเดินต่อเนื่อง ทำเสร็จกด "กลับไปยังรายการฝึกปฏิบัติ"'):null,
    termTasks.length&&me.term?me.term:null,
    el('ol',{class:'pritems'},termTasks.map(row)),
    vmTasks.length?[el('h4',{class:'vmhead'},'เครื่องจำลอง Linux (Terminal Simulator)'),
      el('p',{class:'vmnote'},'เครื่องจำลอง Linux ทำงานในเบราว์เซอร์นี้ (ไม่ใช่เครื่องจริง) กด "เปิดเครื่องจำลอง" รอจนเห็น prompt แล้วกด "เตรียมโจทย์" ครั้งแรกต้องดาวน์โหลดไฟล์ประมาณ 10 MB'),
      me.vmBox,el('ol',{class:'pritems'},vmTasks.map(row))]:null,
    el('ol',{class:'pritems'},p.items.filter(x=>x.kind==='mission').map(row)),
    el('div',{class:'prnav'},
      prev?el('button',{class:'btn ghost',type:'button',id:'prPrev',onclick:()=>prGo(prev.id)},'ก่อนหน้า: '+prev.title):el('span'),
      next?el('button',{class:'btn',type:'button',id:'prNext',onclick:()=>prGo(next.id)},'ถัดไป: '+next.title)
        :el('button',{class:'btn',type:'button',id:'prNextSubmit',onclick:prAskSubmit},'ส่งงานทั้งหมด')));
}
function prBadge(r){
  const st=r&&r.passed?'passed':r&&r.done?'done':'todo';
  return el('span',{class:'prbadge '+st},icon(st==='passed'?'completed':st==='done'?'st_review':'available'),el('span',{},st==='passed'?'ผ่าน':st==='done'?'ยังไม่ผ่าน':'ยังไม่ทำ'));
}
function prTaskRow(it){
  const r=prRes(PR.st.running.result,it.key);
  return el('li',{class:'pritem','data-key':it.key,'data-kind':'task','data-state':r&&r.passed?'passed':r&&r.done?'done':'todo'},
    el('div',{class:'prihead'},prBadge(r),el('small',{class:'prik'},`${prKind(it)} · ประมาณ ${it.minutes} นาที · เต็ม ${it.max}`)),
    prTaskCard(it,r));
}
function prMissionRow(it){
  const r=prRes(PR.st.running.result,it.key);
  return el('li',{class:'pritem','data-key':it.key,'data-kind':'mission','data-state':r&&r.passed?'passed':r&&r.done?'done':'todo'},
    el('div',{class:'prihead'},prBadge(r),el('small',{class:'prik'},`${it.simTitle||'ห้องจำลอง'} · ${MLEVEL_TH[it.level]||it.level||''} · ประมาณ ${it.minutes} นาที`)),
    el('b',{class:'prmt'},it.title),
    r&&r.done?el('p',{class:'prscore'},`รอบนี้ได้ ${r.score}/${r.max} (${r.pct}%)`):null,
    r&&r.done&&!r.passed&&r.reason?el('p',{class:'prreason'},r.reason):null,
    prOpenBtn(it,prOpenLabel(r),r&&r.passed?'ghost':''));
}
/* progress of every part and of the whole session, from the server's live result */
function prUpdate(){
  const me=PR; if(!me||!me.st||!me.st.running) return;
  const st=me.st, res=st.running.result;
  if(!res) return;
  let done=0,n=0;
  res.parts.forEach(p=>{
    const d=p.items.filter(i=>i.done).length; done+=d; n+=p.items.length;
    const txt=`ทำแล้ว ${d}/${p.count} · ผ่าน ${p.passed}/${p.count} · ${p.pct}%`;
    const tab=app.querySelector(`.prtabs .prpart[data-part="${p.id}"]`);
    if(tab){ tab.querySelector('.prpc').textContent=txt; tab.classList.toggle('pass',p.passed===p.count); tab.dataset.passed=String(p.passed); tab.dataset.done=String(d); }
    const pp=app.querySelector(`.prpprog[data-part="${p.id}"]`); if(pp) pp.textContent=txt+` · น้ำหนัก ${p.weight}%`;
  });
  const ov=document.getElementById('prOverall'); if(ov) ov.textContent=`รวม ${res.total}% (เกณฑ์ ${res.passPct}%) · ทำแล้ว ${done}/${n}`;
  const bar=document.getElementById('prOverallBar'); if(bar) bar.style.width=Math.min(100,res.total)+'%';
  app.querySelectorAll('#prPanel .pritem').forEach(li=>{
    const it=prItems(st).find(x=>x.key===li.dataset.key); if(!it) return;
    const r=prRes(res,it.key), s=r&&r.passed?'passed':r&&r.done?'done':'todo';
    if(li.dataset.state===s) return;
    if(it.kind==='mission'){ const n=prMissionRow(it); li.replaceWith(n); if(me.ws&&me.ws.card===li){ me.ws.card=n; prFocus(me.ws); } return; }
    li.dataset.state=s; const b=li.querySelector('.prbadge'); if(b) b.replaceWith(prBadge(r));
  });
  prWsStatus();
}
/* ---------- 3.3 Embedded Virtual Lab: a mission opens in a workspace under its card ----------
   Modes (#prWs[data-mode]): run = a running session of this week (timed by the session clock, recorded by the server),
   review = after the session ended (practice only, does not count for that round), preview = teacher (not timed, not
   recorded), guest = no account (practice, not recorded). Before starting, the button says to start first (the timer
   never starts by itself). One workspace at a time; the other activities are hidden while it is open (focus mode).
   Closing it destroys the simulator instance and draws the list again; the simulators keep drafts in this browser and the
   server keeps the scores, so nothing is lost. A route change destroys it too (stopTick). */
const prPlanItem=key=>PR&&PR.st?prItems(PR.st).find(x=>x.key===key&&x.kind==='mission')||prExtras().find(x=>x.key===key)||null:null;
/* 3.5: the week's optional extra missions (curriculum `more`, e.g. the course project t9 in week 18). The simulator menu is
   gone, so they open here in the same workspace (data-mode="extra"): any time (before, during and after the session, also
   for guests and teachers), never counted in the practical session or its progress; a logged-in student's submit keeps
   the best score of the mission (sim_results) as before. */
const PR_CAPSTONE='topology:t9';
function prExtras(){
  const me=PR, c=me&&typeof currOf==='function'?currOf(me.id):null;
  return ((c&&c.more)||[]).filter(m=>m&&m.sim&&m.id).map(m=>({key:m.sim+':'+m.id,kind:'mission',extra:true,title:m.title,minutes:m.minutes||15,max:m.max||10,sim:m.sim,mission:m.id,level:m.level,simTitle:m.simTitle}));
}
const prExtraBest=it=>{ const d=PR&&PR.extraDone&&PR.extraDone[it.sim]&&PR.extraDone[it.sim][it.mission]; return d&&d.max?`คะแนนดีที่สุด ${d.best}/${d.max}`+(d.attempts?` · ส่งแล้ว ${d.attempts} ครั้ง`:''):'ยังไม่เคยส่ง'; };
function prExtraBlock(){
  const me=PR, list=prExtras(); if(!list.length) return null;
  if(ME&&DBON&&!me.extraDone&&!me.extraLoading&&typeof loadSimDone==='function'){   // best scores of the extras (GET /api/sims/done)
    me.extraLoading=true;
    loadSimDone(true).then(d=>{ me.extraLoading=false; if(PR!==me||me.dead) return; me.extraDone=d||{};
      me.root.querySelectorAll('#prExtra .prextrabest[data-key]').forEach(n=>{ const it=list.find(x=>x.key===n.dataset.key); if(it) n.textContent=prExtraBest(it); }); }).catch(()=>{ me.extraLoading=false; });
  }
  const label=me.mode==='guest'?'ทดลองในห้องจำลอง':me.mode==='teacher'?'เปิดห้องจำลอง (ตัวอย่าง)':'เปิดห้องจำลอง';
  return el('section',{class:'panel prextra',id:'prExtra'},
    el('h2',{},'กิจกรรมเพิ่มเติม',el('small',{},'ไม่บังคับ ไม่นับคะแนนฝึกปฏิบัติ')),
    el('p',{class:'small'},'ฝึกเพิ่มได้ทุกเวลา ทั้งก่อนเริ่ม ระหว่างทำ และหลังส่งงาน ไม่ต้องกดเริ่มฝึกปฏิบัติ และไม่ใช้เวลาของรอบฝึกปฏิบัติ'+(ME&&DBON&&me.mode==='student'?' ระบบเก็บคะแนนดีที่สุดของแต่ละภารกิจไว้ให้':'')),
    el('ol',{class:'prextralist'},list.map(it=>el('li',{class:'prextraitem'+(it.key===PR_CAPSTONE?' capstone':''),'data-key':it.key,'data-kind':'mission'},
      it.key===PR_CAPSTONE?el('span',{class:'prcap'},'โครงงานปิดท้ายรายวิชา'):null,
      el('b',{class:'prmt'},it.title),
      el('small',{class:'prik'},[it.simTitle||'ห้องจำลอง',MLEVEL_TH[it.level]||it.level,`ประมาณ ${it.minutes} นาที`,`เต็ม ${it.max}`].filter(Boolean).join(' · ')),
      ME&&DBON&&me.mode==='student'?el('p',{class:'prextrabest','data-key':it.key},me.extraDone?prExtraBest(it):''):null,
      prOpenBtn(it,label,'ghost sm')))));
}
function prWsModeOf(){
  const me=PR; if(!me||!me.st) return null;
  if(me.mode==='guest') return 'guest';
  if(me.mode==='teacher') return 'preview';
  if(me.mode!=='student') return null;   // offline
  if(me.st.running) return 'run';
  return me.st.sessions&&me.st.sessions.length?'review':null;
}
function prOpenLabel(r){
  const m=prWsModeOf();
  if(m==='review') return 'เปิดห้องจำลองเพื่อทบทวน (ไม่นับคะแนน)';
  if(m==='preview') return 'เปิดห้องจำลอง (ตัวอย่าง)';
  if(m==='guest') return 'ทดลองในห้องจำลอง';
  return r&&r.done?'เปิดห้องจำลองอีกครั้ง':'เปิดห้องจำลอง';
}
const prOpenBtn=(it,label,cls)=>el('button',{class:'btn prOpenSim'+(cls?' '+cls:''),type:'button','data-key':it.key,onclick:e=>prOpenSim(it.key,e.currentTarget)},label);
/* the reason a mission cannot open yet, under its button (before starting, or offline) */
function prNeedStart(card,btn){
  const me=PR, st=me.st;
  let box;
  if(me.mode==='offline') box=el('p',{class:'msg bad prwsneed',role:'alert'},'ต้องเชื่อมต่ออินเทอร์เน็ตก่อน จึงจะเปิดห้องจำลองได้');
  else if(st.otherRunning) box=el('p',{class:'msg bad prwsneed',role:'alert'},`กำลังฝึกปฏิบัติสัปดาห์ที่ ${st.otherRunning.week.slice(1)} อยู่ ส่งงานรอบนั้นหรือรอให้หมดเวลาก่อน แล้วกดเริ่มฝึกปฏิบัติของสัปดาห์นี้`);
  else{
    const go=el('button',{class:'btn sm',type:'button',onclick:()=>{ const b=document.getElementById('prStart'); if(b){ b.scrollIntoView({block:'center'}); b.focus({preventScroll:true}); } }},'ไปที่ปุ่มเริ่มฝึกปฏิบัติ');
    box=el('div',{class:'prwsneed prnote',role:'status'},el('p',{},el('b',{},'กดเริ่มฝึกปฏิบัติก่อน'),` ภารกิจในห้องจำลองนับคะแนนเมื่ออยู่ในรอบฝึกปฏิบัติ เวลาเริ่มนับ ${st.minutes} นาทีเมื่อกดเริ่ม แล้วเปิดภารกิจนี้ได้จากหน้านี้`),go);
  }
  btn.after(box);
}
async function prOpenSim(key,btn){
  const me=PR; if(!me||!me.st||me.dead) return;
  const it=prPlanItem(key); if(!it) return;
  const card=btn.closest('li')||btn.parentElement;
  me.root.querySelectorAll('.prwsneed').forEach(x=>x.remove());
  if(prOrderLocked()&&me.mode!=='teacher'){ btn.after(el('p',{class:'msg bad prwsneed',role:'alert'},'ทำแบบทดสอบก่อนเรียน อ่านเนื้อหา และทำแบบฝึกหัดให้ครบก่อน จึงจะเปิดห้องจำลองได้')); return; }   // 3.6
  const mode=it.extra?(me.mode==='offline'?null:'extra'):prWsModeOf();   // extras need no session
  if(!mode){ prNeedStart(card,btn); return; }
  if(me.opening) return;
  if(me.ws) prWsKill(me.ws,'switch');   // only one workspace at a time
  me.opening=key; btn.disabled=true; btn.setAttribute('aria-busy','true');
  let data=null;
  try{ if(mode!=='guest'&&me.mode!=='guest') data=await api('GET',`/api/practical/${me.id}/mission/${it.sim}/${it.mission}`); }   // the server checks the week and that the mission belongs to it
  catch(e){
    me.opening=null; if(PR!==me||me.dead) return;
    btn.disabled=false; btn.removeAttribute('aria-busy');
    btn.after(el('p',{class:'msg bad prwsneed',role:'alert'},e.offline?'ขาดการเชื่อมต่อ เปิดห้องจำลองไม่ได้ ลองใหม่เมื่อเชื่อมต่อได้':(e.message||'เปิดห้องจำลองไม่สำเร็จ')));
    return;
  }
  me.opening=null; if(PR!==me||me.dead) return;
  btn.disabled=false; btn.removeAttribute('aria-busy');
  if(mode==='run'&&!(data.running&&data.running.week===me.id)){ prLoad(); return; }   // the session closed meanwhile: show the results
  if(!it.extra&&mode!==prWsModeOf()) return;
  prWsOpen(it,btn.closest('li')||card,mode,data);
}
const PR_WSMODE={
  run:'ทำในรอบฝึกปฏิบัติที่กำลังจับเวลา ส่งในห้องจำลองแล้วระบบบันทึกคะแนนเข้ารอบนี้ให้อัตโนมัติ',
  review:'ฝึกทบทวนหลังจบรอบ ไม่จับเวลา ผลครั้งนี้ไม่นับในฝึกปฏิบัติรอบที่ผ่านมา (ถ้ามีสิทธิ์ทำรอบใหม่ ให้กดเริ่มรอบใหม่เพื่อให้นับ)',
  preview:'บัญชีครู: ดูตัวอย่างภารกิจ ไม่จับเวลาและไม่บันทึกเป็นคะแนนฝึกปฏิบัติ',
  guest:'ทดลองฝึกโดยไม่เข้าสู่ระบบ ไม่จับเวลาและไม่บันทึกคะแนน',
  extra:'กิจกรรมเพิ่มเติม ไม่บังคับ ไม่นับคะแนนฝึกปฏิบัติ ส่งแล้วระบบเก็บคะแนนดีที่สุดของภารกิจนี้ไว้ให้',
  extraTeacher:'กิจกรรมเพิ่มเติม (บัญชีครู: ดูตัวอย่าง) ไม่นับคะแนนฝึกปฏิบัติ',
  extraGuest:'กิจกรรมเพิ่มเติม ทดลองฝึกโดยไม่เข้าสู่ระบบ ไม่บันทึกคะแนน'};
function prWsOpen(it,card,mode,data){
  const me=PR, st=me.st;
  const pi=st.parts.findIndex(p=>p.items.some(x=>x.key===it.key)), part=st.parts[pi];
  const ws={key:it.key,it,mode,data,card,part,dead:false,x:false,h:null};
  const run=mode==='run'||mode==='extra'?st.running:null;   // an extra keeps showing the practical time left while a session runs
  const clock=el('div',{class:'prwstime'},el('span',{class:'prtlbl'},run?'เวลาที่เหลือ':'เวลา'),
    el('b',{id:'prWsClock',class:'prwsclock',role:'timer','aria-live':'off','data-timed':run?'1':'0'},run?prClockText(run.deadline-prNow()):'ไม่จับเวลา'));
  const xb=el('button',{class:'btn ghost sm prwsx-btn',type:'button',id:'prWsExpand','aria-pressed':'false',onclick:()=>prWsExpand(ws,!ws.x)},icon('expand'),el('span',{},'ขยายพื้นที่'));
  const close=el('button',{class:'btn sm',type:'button',id:'prWsClose',onclick:prWsClose},'กลับไปยังรายการฝึกปฏิบัติ');
  const head=el('div',{class:'prwshead'},   // sticky: what, time left, status, back
    el('div',{class:'prwsinfo'},
      el('p',{class:'prwspart'},it.extra?(it.key===PR_CAPSTONE?'กิจกรรมเพิ่มเติม · โครงงานปิดท้ายรายวิชา':'กิจกรรมเพิ่มเติม (ไม่บังคับ)'):part?`ส่วนที่ ${pi+1} ${part.title} · ${prPartTh(part,st)}`:'ห้องจำลอง'),
      el('h3',{class:'prwst',id:'prWsTitle',title:it.title},it.title)),
    clock,
    el('div',{class:'prwsbar'},el('p',{class:'prwsstatus',id:'prWsStatus',role:'status'}),el('div',{class:'prwsbtns'},xb,close)),
    el('p',{class:'prwsnote',id:'prWsNote',role:'status','aria-live':'polite'}));
  const det=el('div',{class:'prwsdet'},
    el('p',{class:'prwsmeta'},[it.simTitle||(data&&data.sim&&data.sim.title)||'ห้องจำลอง',MLEVEL_TH[it.level]||it.level,`ประมาณ ${it.minutes} นาที`,`เต็ม ${it.max}`].filter(Boolean).join(' · ')),
    el('p',{class:'prwsmode'},PR_WSMODE[mode==='extra'?(me.mode==='teacher'?'extraTeacher':me.mode==='guest'?'extraGuest':'extra'):mode]));
  ws.sim=el('div',{id:'prWsSim',class:'prwssim'},el('p',{class:'loading'},'กำลังโหลดห้องจำลอง...'));
  ws.box=el('section',{id:'prWs',class:'prws','data-key':it.key,'data-mode':mode,'aria-labelledby':'prWsTitle'},head,det,ws.sim);
  ws.el=card.tagName==='LI'?el('li',{class:'prwsli'},ws.box):ws.box;
  card.after(ws.el);
  me.ws=ws; prFocus(ws); prWsStatus();
  ws.onKey=e=>{ if(e.key==='Escape'&&ws.x){ e.preventDefault(); prWsExpand(ws,false); } };
  ws.onPop=()=>{ if(ws.skipPop){ ws.skipPop=false; return; } if(ws.x) prWsExpand(ws,false,true); };   // the back button closes the expanded view, not the session
  document.addEventListener('keydown',ws.onKey); window.addEventListener('popstate',ws.onPop);
  card.scrollIntoView({block:'start'});
  const info=data?{title:data.sim.title,missions:data.sim.missions,done:data.done||{}}:null;
  mountSim(ws.sim,it.sim,it.mission,{embedded:true,info,alive:()=>!ws.dead&&PR===me,before:()=>ws.sim.replaceChildren(),onSubmit:r=>prWsSubmitted(ws,r)})
    .then(h=>{ if(!h) return; if(ws.dead){ h.destroy(); return; } ws.h=h; })
    .catch(e=>{ if(ws.dead) return; console.error(e);
      R(ws.sim,el('p',{class:'msg bad',role:'alert'},e.offline?'ขาดการเชื่อมต่อ โหลดห้องจำลองไม่ได้ กด "กลับไปยังรายการฝึกปฏิบัติ" แล้วลองใหม่':(e.message||'เปิดห้องจำลองไม่สำเร็จ'))); });
}
/* the focus mode: only the opened card and its workspace stay visible; the parents lose their padding so the
   workspace gets the full width of the content area */
function prFocus(ws){
  const me=PR; if(!me||!me.root) return;
  me.root.querySelectorAll('.prfhide,.prfpath,.prfcard').forEach(n=>n.classList.remove('prfhide','prfpath','prfcard'));
  me.root.classList.toggle('prfocus',!!ws);
  if(!ws) return;
  ws.card.classList.add('prfcard');
  for(let n=ws.card;n&&n!==me.root&&n.parentElement;n=n.parentElement){
    const p=n.parentElement;
    for(const c of p.children) if(c!==n&&c!==ws.el) c.classList.add('prfhide');
    if(p!==me.root) p.classList.add('prfpath');
  }
}
function prWsKill(ws,why){
  if(!ws||ws.dead) return;
  ws.dead=true;
  if(ws.h){ ws.h.destroy(); ws.h=null; }
  document.removeEventListener('keydown',ws.onKey); window.removeEventListener('popstate',ws.onPop);
  if(ws.x){ document.documentElement.classList.remove('prwsx-on'); if(why!=='route'&&history.state&&history.state.prws) history.back(); }   // drop the history entry of the expanded view
  ws.el.remove();
  if(PR&&PR.ws===ws){ PR.ws=null; prFocus(null); }
}
/* "กลับไปยังรายการฝึกปฏิบัติ": back to the list with the real statuses, at the same card */
function prWsClose(){
  const me=PR, ws=me&&me.ws; if(!ws) return;
  const key=ws.key;
  if(ws.mode==='run'&&ws.part) me.part=PR_PART[me.id]=ws.part.id;
  prWsKill(ws,'close');
  prDraw();
  if(me.st&&me.st.running&&!me.st.local) prLoad();
  const b=me.root.querySelector(`.prOpenSim[data-key="${CSS.escape(key)}"]`);
  if(b){ (b.closest('li')||b).scrollIntoView({block:'center'}); b.focus({preventScroll:true}); }
}
/* the list was drawn again (state from the server): put the open workspace back under its card */
function prWsReattach(ws){
  const me=PR, b=me.root.querySelector(`.prOpenSim[data-key="${CSS.escape(ws.key)}"]`);
  const card=b&&(b.closest('li')||b.parentElement);
  if(!card){ prWsKill(ws,'gone'); return; }
  ws.card=card; card.after(ws.el); prFocus(ws); prWsStatus();
}
/* this mission's status in the workspace header */
function prWsStatus(){
  const me=PR, ws=me&&me.ws; if(!ws) return;
  const box=ws.box.querySelector('#prWsStatus'); if(!box) return;
  const st=me.st, best=((ws.h&&ws.h.ctx.done)||(ws.data&&ws.data.done)||{})[ws.it.mission];
  const bestTxt=best&&best.max?` · คะแนนดีที่สุดในห้องจำลอง ${best.best}/${best.max}`:'';
  let r=null, txt, state='none';
  if(ws.mode==='run'){
    r=prRes(st.running&&st.running.result,ws.key);
    if(!r&&ws.data&&ws.data.item){ const i=ws.data.item; r={score:i.score,max:i.max,pct:i.max?Math.round(i.score/i.max*100):0,passed:i.passed,done:true}; }
    state=r&&r.passed?'passed':r&&r.done?'done':'todo';
    txt=state==='passed'?`รอบนี้ได้ ${r.score}/${r.max} (${r.pct}%)`:state==='done'?`รอบนี้ได้ ${r.score}/${r.max} (${r.pct}%) ต้องได้ 70% จึงผ่าน`:'ยังไม่ได้ส่งในรอบนี้';
    R(box,prBadge(r),el('span',{},txt));
  }else if(ws.mode==='review'){
    const s=(st.sessions||[]).find(x=>x.id===me.view)||prLatest(st);
    r=s&&s.result?prRes(s.result,ws.key):null;
    state=r&&r.passed?'passed':r&&r.done?'done':'todo';
    txt=s?(s.legacy?'ผลจากงานเดิม: ':`รอบที่ ${s.attempt}: `)+(r&&r.done?`${r.passed?'ผ่าน':'ยังไม่ผ่าน'} ${r.score}/${r.max}`:'ไม่ได้ทำ'):'ยังไม่มีผล';
    R(box,el('span',{},txt+bestTxt));
  }else if(ws.mode==='extra'&&me.mode==='student'){ R(box,el('span',{},(best&&best.max?`คะแนนดีที่สุด ${best.best}/${best.max}`:'ยังไม่เคยส่ง')+' · ไม่นับคะแนนฝึกปฏิบัติ')); }
  else R(box,el('span',{},(ws.mode==='preview'||me.mode==='teacher'?'ไม่บันทึกเป็นคะแนนฝึกปฏิบัติ':'ไม่บันทึกคะแนน')));
  box.dataset.state=state;
}
/* after a graded submit inside the workspace */
function prWsSubmitted(ws,r){
  const me=PR; if(!me||ws.dead||me.ws!==ws) return;
  const note=ws.box.querySelector('#prWsNote'), p=r&&r.practical, sc=r&&typeof r.score==='number'?`ได้ ${r.score}/${r.max} `:'';
  let txt, cls='prwsnote';
  if(p&&p.recorded){ cls+=' ok'; txt=p.week===me.id?'บันทึกผลลงฝึกปฏิบัติแล้ว':`บันทึกผลลงฝึกปฏิบัติสัปดาห์ ${p.week.slice(1)} แล้ว`; txt=sc+'· '+txt; }
  else if(r&&r.practice) { cls+=' warn'; txt=sc+'· โจทย์นี้ส่งไปแล้ว ครั้งนี้เป็นการฝึก ไม่บันทึกเพิ่ม กด "โจทย์ใหม่" เพื่อรับโจทย์ใหม่'; }
  else if(ws.mode==='extra'){ cls+=' warn'; txt=sc+'· '+(me.mode==='student'?'เก็บคะแนนดีที่สุดของภารกิจนี้แล้ว ไม่นับคะแนนฝึกปฏิบัติ':me.mode==='teacher'?'ไม่บันทึกเป็นคะแนนฝึกปฏิบัติ (บัญชีครู)':'ไม่บันทึกคะแนน เพราะยังไม่ได้เข้าสู่ระบบ');
    if(ws.h&&ws.h.ctx.done&&me.extraDone){ const d=ws.h.ctx.done[ws.it.mission]; if(d){ (me.extraDone[ws.it.sim]=me.extraDone[ws.it.sim]||{})[ws.it.mission]=Object.assign({},d); } } }
  else if(ws.mode==='run'){ cls+=' bad'; txt=sc+'· ผลครั้งนี้ไม่ได้บันทึกลงฝึกปฏิบัติ เพราะรอบนี้ปิดแล้ว (หมดเวลาหรือส่งงานแล้ว)'; }
  else if(ws.mode==='review'){ cls+=' warn'; txt=sc+'· ผลครั้งนี้ไม่นับในฝึกปฏิบัติ (ฝึกทบทวนหลังจบรอบ)'; }
  else if(ws.mode==='preview'){ cls+=' warn'; txt=sc+'· ไม่บันทึกเป็นคะแนนฝึกปฏิบัติ (บัญชีครู)'; }
  else { cls+=' warn'; txt=sc+'· ไม่บันทึกคะแนน เพราะยังไม่ได้เข้าสู่ระบบ'; }
  if(note){ note.className=cls; note.textContent=txt; }
  prWsStatus();
  if(ME&&DBON&&(ws.mode==='run'||(p&&p.recorded))) prLoad();   // refresh the session: the card and the part progress update now
}
/* "ขยายพื้นที่": the workspace fills the screen (header and time stay visible); Escape or the back button returns */
function prWsExpand(ws,on,fromPop){
  if(!ws||ws.dead||ws.x===on) return;
  ws.x=on;
  ws.box.classList.toggle('prwsx',on);
  document.documentElement.classList.toggle('prwsx-on',on);
  const b=ws.box.querySelector('#prWsExpand');
  if(b){ b.setAttribute('aria-pressed',String(on)); b.lastChild.textContent=on?'ย่อพื้นที่':'ขยายพื้นที่'; }
  if(on){ try{ history.pushState(Object.assign({},history.state||{},{prws:ws.key}),''); }catch(e){} ws.box.scrollTop=0; }
  else{
    if(!fromPop&&history.state&&history.state.prws){ ws.skipPop=true; history.back(); }
    ws.card.scrollIntoView({block:'start'});
  }
  window.dispatchEvent(new Event('resize'));   // canvases fit the new size
}
let PR_AFTER=null;
function prAfterAnswer(){ clearTimeout(PR_AFTER); PR_AFTER=setTimeout(()=>{ if(PR&&!PR.busy) prLoad(); },400); }
function prTick(){
  const me=PR; if(!me||me.dead||!me.st) return;
  const st=me.st;
  if(st.running){
    const ms=st.running.deadline-prNow();
    const c=document.getElementById('prClock'); if(c) c.textContent=prClockText(ms);
    const t=document.getElementById('prTimer'); if(t){ t.classList.toggle('warn',ms<=5*60000); t.classList.toggle('urgent',ms<=60000); }
    const ws=me.ws, wc=ws&&(ws.mode==='run'||ws.mode==='extra')?document.getElementById('prWsClock'):null;   // 3.3: the workspace shows the same clock
    if(wc){ if(wc.dataset.timed!=='1'){ wc.dataset.timed='1'; const l=ws.box.querySelector('.prwstime .prtlbl'); if(l) l.textContent='เวลาที่เหลือ'; }
      wc.textContent=prClockText(ms); ws.box.classList.toggle('warn',ms<=5*60000); ws.box.classList.toggle('urgent',ms<=60000); }
    if(ms<=0&&!me.ending){ me.ending=true; prLoad().then(()=>{ if(PR===me) setTimeout(()=>{ me.ending=false; },2000); }); }   // the server closes the session on this read
    return;
  }
  { const ws=me.ws, wc=ws&&ws.mode==='extra'?document.getElementById('prWsClock'):null;   // an extra stays open after the session ended: no time any more
    if(wc&&wc.dataset.timed==='1'){ wc.dataset.timed='0'; wc.textContent='ไม่จับเวลา'; ws.box.classList.remove('warn','urgent'); const l=ws.box.querySelector('.prwstime .prtlbl'); if(l) l.textContent='เวลา'; } }
  const cd=document.getElementById('prCooldown');
  if(cd){ const at=+cd.dataset.next, ms=at-prNow();
    if(ms<=0){ st.attempts.nextAt=null; prDraw(); return; }
    cd.textContent=`เริ่มรอบใหม่ได้เวลา ${hhmm(at)} น. (อีก ${waitText(ms)}) ระหว่างนี้ทบทวนสิ่งที่ยังไม่ผ่านได้`; }
  const ol=document.getElementById('prOtherLeft');
  if(ol){ const ms=+ol.dataset.deadline-prNow(); ol.textContent=prClockText(ms); if(ms<=-2000&&!me.ending){ me.ending=true; prLoad().then(()=>{ me.ending=false; }); } }
}
/* "ส่งงานทั้งหมด": confirmed on the page (not a browser dialog) */
function prAskSubmit(){
  const me=PR, box=document.getElementById('prConfirm'); if(!me||!box) return;
  const res=me.st.running.result, all=res?[].concat(...res.parts.map(p=>p.items)):[], left=all.filter(i=>!i.done).length;
  const yes=el('button',{class:'btn',type:'button',id:'prSubmitYes',onclick:()=>prSubmit(yes,msg)},'ยืนยันส่งงาน');
  const msg=el('p',{class:'msg',role:'status',id:'prSubmitMsg'});
  R(box,el('b',{id:'prConfirmT'},'ส่งงานทั้งหมดตอนนี้?'),
    el('p',{class:'small'},left?`ยังไม่ได้ทำ ${left} จาก ${all.length} กิจกรรม `:'ทำครบทุกกิจกรรมแล้ว ','หลังส่งจะแก้ไขรอบนี้ไม่ได้ ระบบประเมินผลทันที'),
    el('div',{class:'row'},yes,el('button',{class:'btn ghost',type:'button',id:'prSubmitNo',onclick:()=>{ box.hidden=true; }},'ทำต่อ')),msg);
  box.hidden=false; yes.focus({preventScroll:true});
}
async function prSubmit(btn,msg){
  const me=PR; if(!me||me.busy) return;
  me.busy=true; btn.disabled=true; msg.className='msg wait'; msg.textContent='กำลังส่งงาน...';
  const t0=Date.now();
  try{ const st=await api('POST',`/api/practical/${me.id}/submit`); me.busy=false; if(me.dead) return; prSetState(st,t0); window.scrollTo(0,0); }
  catch(e){
    me.busy=false; if(me.dead) return;
    if(e.offline||!e.status||e.status>=500){   // keep trying; the server closes the session at the deadline anyway
      prNet(true); msg.className='msg bad'; msg.textContent='ขาดการเชื่อมต่อ ยังส่งไม่ได้ กำลังลองใหม่ เวลายังเดินต่อที่เซิร์ฟเวอร์ ถ้าหมดเวลาก่อน ระบบส่งงานที่บันทึกไว้ให้อัตโนมัติ';
      setTimeout(()=>{ if(PR===me&&btn.isConnected) prSubmit(btn,msg); },5000); return; }
    msg.className='msg bad'; msg.textContent=e.message||'ส่งไม่สำเร็จ'; btn.disabled=false; prLoad();
  }
}

/* ---------- results ---------- */
const PR_STATUS={submitted:'ส่งงานแล้ว',timeout:'หมดเวลา ระบบส่งงานให้อัตโนมัติ',legacy:'ผลจากงานเดิมก่อนปรับระบบ'};
function prResults(){
  const me=PR, st=me.st, list=st.sessions||[];
  const s=list.find(x=>x.id===me.view)||prLatest(st); if(!s) return null;
  me.view=s.id;
  const r=s.result, wk=me.id;
  const box=el('section',{class:'panel prres',id:'prResult','data-session':String(s.id),'data-passed':String(!!r.passed),'data-status':s.status});
  const head=s.legacy?'ผลจากงานเดิมก่อนปรับระบบ':`รอบที่ ${s.attempt} · ${PR_STATUS[s.status]||s.status}`;
  prAdd(box,el('h2',{},'ผลการฝึกปฏิบัติ'),
    el('p',{class:'prresh'},head,s.endedAt&&!s.legacy?` · ${fmtDate(s.endedAt)}`:'',s.voided?el('b',{class:'prvoid'},' · ครูยกเลิกรอบนี้ (ไม่นับ)'):null),
    el('div',{class:'prbig'},el('b',{id:'prTotal'},`${r.total}%`),
      el('span',{class:'prverdict '+(r.passed?'ok':'bad')},r.passed?icon('completed'):icon('st_review'),el('span',{},r.passed?`ผ่านเกณฑ์ ${r.passPct}%`:`ยังไม่ผ่านเกณฑ์ ${r.passPct}%`))),
    el('p',{class:'muted small'},'คะแนนรวม = '+r.parts.map(p=>`${p.title} ${p.pct}% x ${p.weight}%`).join(' + ')+(r.parts.reduce((a,p)=>a+p.weight,0)!==100?' (คิดตามสัดส่วนของส่วนที่มีในสัปดาห์นี้)':'')),
    r.parts.map(p=>el('div',{class:'prrespart','data-part':p.id},
      el('h3',{},p.title,el('span',{class:'prw'},`${p.pct}% · น้ำหนัก ${p.weight}% · ผ่าน ${p.passed}/${p.count}`)),
      el('ul',{class:'prreslist'},p.items.map(i=>el('li',{class:'prresitem'+(i.passed?' ok':''),'data-key':i.key,'data-passed':String(!!i.passed)},
        i.passed?el('span',{class:'prmark ok','aria-hidden':'true'},icon('completed')):el('span',{class:'prmark','aria-hidden':'true'}),
        el('div',{},el('b',{},i.title),el('span',{class:'vh'},i.passed?' (ผ่าน)':' (ยังไม่ผ่าน)'),
          el('small',{class:'prsc'},i.kind==='task'?`${i.score}/${i.max} คะแนน`:`${i.score}/${i.max} (${i.pct}%)`),
          !i.passed&&i.reason?el('p',{class:'prreason'},i.reason):null,
          !i.passed?el('p',{class:'prfix'},'สิ่งที่ต้องแก้: ',i.kind==='mission'?'ทบทวนวิธีทำแล้วทำภารกิจนี้ให้ได้อย่างน้อย 70% ในรอบถัดไป ':'อ่านผลจากคำสั่งให้ละเอียดแล้วตอบใหม่ในรอบถัดไป ',
            el('a',{href:`#/lesson/${wk}/content`},'ทบทวนเนื้อหา'),
            ):null,
          i.kind==='mission'&&prPlanItem(i.key)?prOpenBtn(prPlanItem(i.key),prOpenLabel(null),'ghost sm'):null)))))));
  if(st.best&&st.best.id!==s.id) prAdd(box,el('p',{class:'prbest',id:'prBest'},'ผลที่นับ (รอบที่ดีที่สุด): ',el('b',{},`${st.best.total}%`),st.best.passed?' ผ่านเกณฑ์':' ยังไม่ผ่านเกณฑ์',st.best.legacy?' (ผลจากงานเดิมก่อนปรับระบบ)':''));
  else if(st.best) prAdd(box,el('p',{class:'prbest',id:'prBest'},'รอบนี้เป็นผลที่นับ (รอบที่ดีที่สุด)'));
  if(list.length>1||list.some(x=>x.legacy)) prAdd(box,el('h3',{},'ประวัติการทำ'),el('ol',{class:'prhist'},list.slice().sort((a,b)=>(a.legacy?-1:0)-(b.legacy?-1:0)||a.attempt-b.attempt).map(x=>
    el('li',{class:'prhistrow'+(x.id===s.id?' on':''),'data-session':String(x.id),'data-status':x.status},
      el('span',{},x.legacy?'ผลจากงานเดิมก่อนปรับระบบ':`รอบที่ ${x.attempt}`,el('small',{},` ${PR_STATUS[x.status]||x.status}${x.endedAt&&!x.legacy?' · '+fmtDate(x.endedAt):''}${x.voided?' · ครูยกเลิกรอบนี้ (ไม่นับ)':''}`)),
      el('b',{},`${x.total}% `,x.passed?'ผ่าน':'ไม่ผ่าน'),
      x.id===s.id?el('span',{class:'muted small'},'กำลังดู'):el('button',{class:'btn ghost sm',type:'button',onclick:()=>{ PR.view=x.id; prDraw(); document.getElementById('prResult').scrollIntoView({block:'start'}); }},'ดูผล')))));
  return box;
}

function seededOrder(n,key){
  let h=2166136261; for(const ch of key){h^=ch.codePointAt(0);h=Math.imul(h,16777619)>>>0;}
  const rnd=()=>{h^=h<<13;h>>>=0;h^=h>>>17;h^=h<<5;h>>>=0;return h/4294967296;};
  const a=[...Array(n).keys()]; for(let i=n-1;i>0;i--){const j=Math.floor(rnd()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a;
}
function shuffle(a){a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}
  if(a.length>1&&a.every((v,i)=>v===i)) return shuffle(a); return a;}

/* one hands-on task of the running session, answered inline (question types: text, choice, order, form).
   r = this item's result in the session (passed / done); answers go to POST /api/check, hints to POST /api/hint (-5) */
function prTaskCard(it,r){
  const id=it.key, f=findTask(id), t=f.t;
  if(!t) return el('p',{class:'muted small'},'โหลดโจทย์ข้อนี้ไม่ได้ ลองโหลดหน้าใหม่');
  const sid=PR.st.running.id;
  let solved=!!(r&&r.passed), busy=false;
  const card=el('div',{class:'task prtask'+(solved?' solved':''),id:'task-'+id});
  const msg=el('div',{class:'msg'+(solved?' ok':''),'aria-live':'polite'},solved?`ผ่านแล้ว ได้ ${r.score} คะแนน`:'');
  const q=el('div',{class:'qtext'},el('p',{},t.q));
  if(t.pre) q.append(el('pre',{class:'out'},t.pre));
  const draft=getDrafts()[id];
  const lockAll=()=>card.querySelectorAll('input,select,button').forEach(b=>{ b.disabled=true; });
  const markSolved=res=>{
    solved=true; card.classList.add('solved'); msg.className='msg ok';
    msg.textContent=`ถูกต้อง ได้ ${res.points!=null?res.points:'-'} คะแนน (เต็ม 10)`;
    card.querySelectorAll('.hint,.hintwrap').forEach(h=>h.remove());
    if(res.explain&&!card.querySelector('.explain')) q.append(el('div',{class:'explain'},res.explain));
    lockAll();
  };
  const showMsg=(text,kind)=>{ msg.className='msg '+(kind||'bad'); msg.textContent=text; };
  async function send(answer,onCorrect,onWrong){
    if(busy||solved) return; busy=true; showMsg('กำลังตรวจ...','wait');
    let res;
    try{ res=await api('POST','/api/check',{key:id,answer}); }
    catch(e){
      busy=false;
      if(e.offline||!e.status||e.status>=500){ prNet(true); showMsg('ขาดการเชื่อมต่อ คำตอบยังไม่ถูกส่ง (เก็บเป็นร่างไว้แล้ว) กดตรวจอีกครั้งเมื่อเชื่อมต่อได้ เวลายังเดินต่อที่เซิร์ฟเวอร์'); prLoad(); return; }
      if(e.code==='closed'||e.code==='not_started'){ showMsg(e.message||'รอบนี้ปิดแล้ว'); prLoad(); return; }
      showMsg(e.message||'ตรวจคำตอบไม่สำเร็จ ลองใหม่'); return;
    }
    busy=false; prNet(false);
    applyResult(id,answer,res);
    if(res.correct){ onCorrect&&onCorrect(res); markSolved(res); }
    else onWrong&&onWrong(res);
    prAfterAnswer();
  }
  const wrongText=(res,extra)=>`ยังไม่ถูก${extra?' '+extra:''} ลองใหม่อีกครั้ง`+(res&&res.pointsLeft!=null?` (ถ้าตอบถูกตอนนี้ ข้อนี้จะได้ ${res.pointsLeft} คะแนน)`:'');
  if(t.type==='text'){
    const inp=el('input',{placeholder:'พิมพ์คำตอบ',autocomplete:'off',autocapitalize:'off',spellcheck:'false','aria-label':'คำตอบ'});
    if(solved){ inp.value=S.given[id]||''; inp.disabled=true; }
    else if(typeof draft==='string') inp.value=draft;
    inp.addEventListener('input',()=>setDraft(id,inp.value));
    const check=()=>{ if(!inp.value.trim()){ showMsg('พิมพ์คำตอบก่อนกดตรวจ'); return; } send(inp.value,null,res=>showMsg(wrongText(res))); };
    inp.addEventListener('keydown',e=>{ if(e.key==='Enter') check(); });
    const btn=el('button',{class:'btn',type:'button',onclick:check},'ตรวจคำตอบ'); if(solved) btn.disabled=true;
    q.append(el('div',{class:'row'},inp,btn));
  }
  if(t.type==='choice'){
    const box=el('div',{class:'choices'});
    seededOrder(t.options.length,SEED+id).forEach(oi=>{
      const o=t.options[oi];
      const b=el('button',{class:'choice'+(solved&&S.given[id]===o?' picked-ok':''),type:'button'},o);
      if(solved) b.disabled=true;
      b.addEventListener('click',()=>{ if(solved||busy||b.classList.contains('picked-bad')) return;
        send(oi,()=>{ b.className='choice picked-ok'; },res=>{ b.className='choice picked-bad'; showMsg(wrongText(res)); }); });
      box.append(b);
    });
    q.append(box);
  }
  if(t.type==='order') q.append(orderWidget(id,t,()=>solved,send,showMsg,wrongText));
  if(t.type==='form'){
    const saved=solved?(()=>{ try{ return JSON.parse(S.given[id]||'[]'); }catch(e){ return []; } })():(Array.isArray(draft)?draft:[]);
    const ctrls=t.fields.map((fl,fi)=>{
      const c=fl.type==='select'
        ? el('select',{'aria-label':fl.label},el('option',{value:''},'— เลือก —'),fl.options.map(o=>el('option',{value:o},o)))
        : el('input',{placeholder:fl.ph||'',autocomplete:'off',autocapitalize:'off',spellcheck:'false','aria-label':fl.label});
      if(saved[fi]!=null) c.value=saved[fi];
      if(solved) c.disabled=true;
      c.addEventListener('input',()=>setDraft(id,ctrls.map(x=>x.value)));
      c.addEventListener('change',()=>setDraft(id,ctrls.map(x=>x.value)));
      return c;
    });
    const grid=el('div',{class:'form'},t.fields.map((fl,fi)=>el('label',{class:'frow'},el('span',{},fl.label),ctrls[fi])));
    const btn=el('button',{class:'btn',type:'button',onclick:()=>{
      ctrls.forEach(c=>c.classList.remove('bad'));
      send(ctrls.map(c=>c.value),null,res=>{
        const okf=(res.detail&&res.detail.fieldsOk)||[]; let bad=0;
        ctrls.forEach((c,fi)=>{ if(okf[fi]===false){ c.classList.add('bad'); bad++; } });
        showMsg(wrongText(res,bad?`มี ${bad} ช่องที่ไม่ถูกต้อง (กรอบสีแดง)`:''));
      });
    }},'บันทึกการตั้งค่า');
    if(solved) btn.disabled=true;
    q.append(grid,el('div',{class:'row'},btn));
  }
  q.append(msg);
  if(!solved){
    const hk=sid+':'+id, hb=el('div',{class:'hintwrap'});
    let armed=false;
    const hintBtn=el('button',{class:'hint',type:'button',onclick:async()=>{
      if(!PR_HINT[hk]&&!armed){ armed=true; hintBtn.textContent='กดอีกครั้งเพื่อยืนยัน: ดูคำใบ้แล้วข้อนี้หัก 5 คะแนน'; hintBtn.classList.add('armed'); return; }
      hintBtn.disabled=true;
      try{ const res=await api('POST','/api/hint',{key:id}); PR_HINT[hk]=true; S.hints[id]=true; R(hb,el('div',{class:'hinttext'},res.hint),el('p',{class:'muted small'},'ใช้คำใบ้แล้ว ข้อนี้หัก 5 คะแนน')); }
      catch(e){ hintBtn.disabled=false; showMsg(e.offline?'ขาดการเชื่อมต่อ ดูคำใบ้ไม่ได้ตอนนี้':e.message); if(e.offline) prNet(true); }
    }},PR_HINT[hk]?'ดูคำใบ้อีกครั้ง':'ดูคำใบ้ (หัก 5 คะแนน)');
    hb.append(hintBtn); q.append(hb);
  }
  card.append(q);
  return card;
}

function orderWidget(id,t,isSolved,send,showMsg,wrongText){
  const box=el('div');
  if(!orderState[id]){
    const d=getDrafts()[id];
    const picked=Array.isArray(d)?d.map(x=>t.items.findIndex(it=>it.t===x)).filter(x=>x>=0):[];
    orderState[id]={pool:shuffle(t.items.map((_,i)=>i)).filter(x=>!picked.includes(x)),picked};
  }
  const st=orderState[id];
  if(isSolved()){
    const g=String(S.given[id]||'').split(' | ');
    const p=g.map(x=>t.items.findIndex(it=>it.t===x));
    st.picked=p.every(x=>x>=0)&&p.length===t.items.length?p:t.items.map((_,i)=>i); st.pool=[];
  }
  const persist=()=>setDraft(id,st.picked.map(i=>t.items[i].t));
  const chipFace=it=>[it.sw?el('span',{class:'sw',style:`background:${it.sw}`}):null,it.t];
  function draw(){
    box.innerHTML='';
    const solved=isSolved();
    const slots=el('div',{class:'slots'});
    t.labels.forEach((lab,si)=>{
      const idx=st.picked[si];
      const s=el('button',{type:'button',class:'slot'+(idx!=null?' filled':'')+(t.wide?' wide':''),'aria-label':lab+(idx!=null?' '+t.items[idx].t+' แตะเพื่อเอาออก':' ว่าง')},
        el('span',{class:'pin'},lab), idx!=null?el('span',{style:'display:inline-flex;gap:8px;align-items:center'},chipFace(t.items[idx])):el('span',{style:'color:var(--muted);font-size:14px'},t.wide?'—':'แตะตัวเลือกด้านล่างเพื่อใส่'));
      if(idx!=null && !solved) s.addEventListener('click',()=>{st.picked.splice(si,1);st.pool.push(idx);persist();draw();});
      slots.append(s);
    });
    box.append(slots);
    if(!solved){
      box.append(el('div',{class:'pool'},st.pool.map(idx=>el('button',{type:'button',class:'chip',onclick:()=>{st.pool=st.pool.filter(x=>x!==idx);st.picked.push(idx);persist();draw();}},chipFace(t.items[idx])))));
      const full=st.picked.length===t.items.length;
      const chk=el('button',{type:'button',class:'btn',onclick:()=>{
        send(st.picked.map(i=>t.items[i].t),()=>setTimeout(draw,0),res=>{
          const d=res.detail||{}; showMsg(wrongText(res,d.total?`ถูกตำแหน่ง ${d.right} จาก ${d.total} ช่อง แตะช่องที่ผิดเพื่อเอาออก`:''));
        });
      }},'ตรวจลำดับ');
      if(!full) chk.disabled=true;
      box.append(el('div',{class:'row'},chk,
        el('button',{type:'button',class:'btn ghost',onclick:()=>{st.pool=shuffle(t.items.map((_,i)=>i));st.picked=[];persist();draw();}},'ล้าง')));
    }
  }
  draw();
  return box;
}

/* ---------- terminal ---------- */
function terminal(quickList){
  const screen=el('div',{class:'screen',role:'log','aria-live':'polite',tabindex:'0','aria-label':'ผลลัพธ์ของ Command Prompt จำลอง (เลื่อนดูได้)'});
  const inp=el('input',{autocomplete:'off',autocapitalize:'off',spellcheck:'false',enterkeyhint:'send','aria-label':'พิมพ์คำสั่ง'});
  /* long output lines (ipconfig /all, route print) are wider than a phone: show a cue, or let the student wrap the lines */
  const hint=el('span',{class:'thint',hidden:''},'เลื่อนดูด้านข้าง ›');
  const wrapBtn=el('button',{type:'button',class:'twrap','aria-pressed':'false',onclick:()=>{ const on=!screen.classList.contains('wrap'); screen.classList.toggle('wrap',on); wrapBtn.setAttribute('aria-pressed',String(on)); wrapBtn.textContent=on?'ไม่ตัดบรรทัด':'ตัดบรรทัด'; overflowCue(); }},'ตัดบรรทัด');
  const overflowCue=()=>{ hint.hidden=!(screen.scrollWidth>screen.clientWidth+2); };
  const hist=[];let hp=0,busy=false;
  const PROMPT='C:\\Users\\student>';
  const put=(txt,cls)=>{txt.split('\n').forEach(l=>screen.append(el('div',{class:'line'+(cls?' '+cls:'')},l||' ')));screen.scrollTop=screen.scrollHeight;overflowCue();};
  const slow=async lines=>{busy=true;for(const l of lines){await new Promise(r=>setTimeout(r,l.d||0));put(l.t);}busy=false;};

  const HOSTS={'192.168.20.1':[64,1],'192.168.20.10':[128,1],'192.168.20.57':[128,0],'127.0.0.1':[128,0],'localhost':[128,0],
    '8.8.8.8':[124,24],'203.0.113.80':[59,28],'www.netlab.test':[59,28]};   // TTL = initial (128 / 64) - routers listed by tracert
  const DNS={'www.netlab.test':'203.0.113.80','dns.google':'8.8.8.8','localhost':'127.0.0.1','lab-pc07':'192.168.20.57'};
  const isIP=s=>/^\d{1,3}(\.\d{1,3}){3}$/.test(s)&&s.split('.').every(n=>+n<256);

  function ping(target){
    if(!target) return put('Usage: ping <IP address หรือ ชื่อโฮสต์>');
    const t=target.toLowerCase();
    let ip=isIP(t)?t:DNS[t];
    if(!ip) return put(`Ping request could not find host ${target}. Please check the name and try again.`);
    const head=ip===t?`Pinging ${ip} with 32 bytes of data:`:`Pinging ${t} [${ip}] with 32 bytes of data:`;
    const lines=[{t:head}];let recv=4,times=[];
    if(HOSTS[ip]){
      const [ttl,base]=HOSTS[ip];
      for(let i=0;i<4;i++){const ms=base===0?0:base+Math.floor(Math.random()*3);times.push(ms);
        lines.push({t:`Reply from ${ip}: bytes=32 time${ms===0?'<1':'='+ms}ms TTL=${ttl}`,d:450});}
    }else if(ip.startsWith('192.168.20.')&&ip!=='192.168.20.99'){
      for(let i=0;i<4;i++) lines.push({t:`Reply from 192.168.20.57: Destination host unreachable.`,d:900});
    }else{
      recv=0;for(let i=0;i<4;i++) lines.push({t:'Request timed out.',d:900});
    }
    lines.push({t:'',d:100},{t:`Ping statistics for ${ip}:`},{t:`    Packets: Sent = 4, Received = ${recv}, Lost = ${4-recv} (${(4-recv)*25}% loss),`});
    if(times.length){const mn=Math.min(...times),mx=Math.max(...times),av=Math.round(times.reduce((a,b)=>a+b)/4);
      lines.push({t:'Approximate round trip times in milli-seconds:'},{t:`    Minimum = ${mn}ms, Maximum = ${mx}ms, Average = ${av}ms`});}
    return slow(lines);
  }
  function tracert(target){
    if(!target) return put('Usage: tracert <IP address หรือ ชื่อโฮสต์>');
    const t=target.toLowerCase(); const ip=isIP(t)?t:DNS[t];
    if(!ip) return put(`Unable to resolve target system name ${target}.`);
    const hops=[['192.168.20.1','gateway.lab.internal'],['10.10.0.1',''],['172.20.1.1',''],['198.51.100.9','']];
    if(ip==='8.8.8.8') hops.push(['8.8.8.8','dns.google']);
    else if(ip==='203.0.113.80'){hops.push(['198.51.100.30',''],['203.0.113.80','www.netlab.test']);}
    else if(ip.startsWith('192.168.20.')){hops.length=0;hops.push([ip,'']);}
    else {hops.push(['*','']);}
    const lines=[{t:`Tracing route to ${t===ip?ip:t+' ['+ip+']'}`},{t:'over a maximum of 30 hops:'},{t:''}];
    hops.forEach(([h,n],i)=>{
      const pad=String(i+1).padStart(3);
      if(h==='*') lines.push({t:`${pad}     *        *        *     Request timed out.`,d:1200});
      else{const b=i===0?1:4+i*5;const f=x=>(x<=1?'<1 ms':x+' ms').padStart(6);
        lines.push({t:`${pad}  ${f(b)}  ${f(b+1)}  ${f(b)}  ${n?n+' ['+h+']':h}`,d:600});}
    });
    lines.push({t:''},{t:'Trace complete.'});
    return slow(lines);
  }
  const CMDS={
    help:()=>put(`คำสั่งที่ใช้ได้:
  ipconfig          ดู IP, Subnet Mask, Default Gateway
  ipconfig /all     ดูรายละเอียดทั้งหมด (MAC, DNS, DHCP)
  netstat           ดูการเชื่อมต่อและพอร์ตที่เปิดอยู่
  ping <ปลายทาง>    ทดสอบการเชื่อมต่อ
  tracert <ปลายทาง> ดูเส้นทางที่ข้อมูลเดินทาง
  nslookup <ชื่อ>    ถาม DNS ว่าชื่อนี้คือ IP อะไร
  arp -a            ดูตาราง IP ↔ MAC ในวงเครือข่าย
  hostname          ดูชื่อเครื่อง
  getmac            ดู MAC Address
  whoami            ดูบัญชีที่ล็อกอินอยู่
  net user [ชื่อ]    ดูบัญชีผู้ใช้
  net localgroup [กลุ่ม] ดูกลุ่มผู้ใช้
  net share [ชื่อ]   ดูโฟลเดอร์ที่แชร์ (ใส่ชื่อเพื่อดูสิทธิ์ของแชร์)
  net use           ดูไดรฟ์ที่ Map ไว้กับโฟลเดอร์แชร์
  net view          ดูเครื่องที่มองเห็นในเครือข่าย
  icacls <path>     ดูสิทธิ์ NTFS ของโฟลเดอร์ เช่น icacls C:\Share\Homework
  route print       ดูตารางเส้นทาง (Routing table) ของเครื่อง
  netsh advfirewall show allprofiles state  ดูว่า Firewall แต่ละโปรไฟล์เปิดอยู่หรือไม่
  net config workstation  ดูชื่อ Workgroup (Workstation domain)
  cls               ล้างหน้าจอ`),
    whoami:()=>put('lab-pc07\\student'),
    net:a=>netCmd(a),
    ipconfig:a=>{
      if(a[0]&&a[0].toLowerCase()==='/all') return put(`
Windows IP Configuration

   Host Name . . . . . . . . . . . . : LAB-PC07
   Primary Dns Suffix  . . . . . . . : 

Ethernet adapter Ethernet:

   Connection-specific DNS Suffix  . : lab.internal
   Description . . . . . . . . . . . : Realtek PCIe GbE Family Controller
   Physical Address. . . . . . . . . : 00-1A-2B-3C-4D-5E
   DHCP Enabled. . . . . . . . . . . : Yes
   IPv4 Address. . . . . . . . . . . : 192.168.20.57(Preferred)
   Subnet Mask . . . . . . . . . . . : 255.255.255.0
   Lease Obtained. . . . . . . . . . : Tuesday, October 13, 2026 8:02:14 AM
   Lease Expires . . . . . . . . . . : Wednesday, October 14, 2026 8:02:14 AM
   Default Gateway . . . . . . . . . : 192.168.20.1
   DHCP Server . . . . . . . . . . . : 192.168.20.1
   DNS Servers . . . . . . . . . . . : 192.168.20.10
`);
      if(a[0]) return put(`Error: unrecognized or incomplete command line.`);
      put(`
Windows IP Configuration

Ethernet adapter Ethernet:

   Connection-specific DNS Suffix  . : lab.internal
   IPv4 Address. . . . . . . . . . . : 192.168.20.57
   Subnet Mask . . . . . . . . . . . : 255.255.255.0
   Default Gateway . . . . . . . . . : 192.168.20.1
`);
    },
    ping:a=>ping(a[0]),
    tracert:a=>tracert(a[0]),
    nslookup:a=>{
      const head='Server:  dns.lab.internal\nAddress:  192.168.20.10\n';
      if(!a[0]) return put(head+'\n(ในแล็บนี้ให้พิมพ์ชื่อต่อท้าย เช่น nslookup www.netlab.test)');
      const n=a[0].toLowerCase(), ip=DNS[n];
      if(!ip) return put(head+`\n*** dns.lab.internal can't find ${a[0]}: Non-existent domain`);
      put(head+`\nNon-authoritative answer:\nName:    ${n}\nAddress:  ${ip}`);
    },
    arp:a=>{
      if(!a[0]||a[0].toLowerCase()!=='-a') return put('Usage: arp -a');
      put(`
Interface: 192.168.20.57 --- 0xb
  Internet Address      Physical Address      Type
  192.168.20.1          00-50-56-c0-00-01     dynamic
  192.168.20.10         00-50-56-c0-00-0a     dynamic
  192.168.20.23         3c-52-82-1f-9a-10     dynamic
  192.168.20.255        ff-ff-ff-ff-ff-ff     static
  224.0.0.22            01-00-5e-00-00-16     static
`);
    },
    netstat:a=>put(`
Active Connections

  Proto  Local Address          Foreign Address        State
  TCP    0.0.0.0:135            0.0.0.0:0              LISTENING
  TCP    0.0.0.0:445            0.0.0.0:0              LISTENING
  TCP    0.0.0.0:3389           0.0.0.0:0              LISTENING
  TCP    192.168.20.57:49712    203.0.113.80:443       ESTABLISHED
  TCP    192.168.20.57:49718    192.168.20.10:53       TIME_WAIT
  TCP    192.168.20.57:49720    192.168.20.23:445      ESTABLISHED
  TCP    192.168.20.57:49725    198.51.100.44:80       CLOSE_WAIT
`),
    hostname:()=>put('LAB-PC07'),
    icacls:a=>{
      const p=a.join(' ').replace(/^"|"$/g,'').replace(/\\+$/,'');
      if(!p) return put('ICACLS name /save aclfile [/T] [/C] [/L] [/Q]\n    (ในแล็บนี้ให้พิมพ์ path ต่อท้าย เช่น icacls C:\\Share\\Homework)');
      if(/^\/(grant|deny|remove|reset|setowner)/i.test(a[1]||'')||a.some(x=>/^\/(grant|deny|remove|reset|setowner)/i.test(x))) return put(p.split(/\s+\//)[0]+': Access is denied.\nSuccessfully processed 0 files; Failed processing 1 files\n(บัญชี student ไม่มีสิทธิ์เปลี่ยน ACL ของโฟลเดอร์นี้)');
      const k=p.toLowerCase();
      const ACL={'c:\\share\\homework':['BUILTIN\\Administrators:(OI)(CI)(F)','NT AUTHORITY\\SYSTEM:(OI)(CI)(F)','LAB-PC07\\teacher:(OI)(CI)(F)','BUILTIN\\Users:(OI)(CI)(M)']};
      const acl=ACL[k];
      if(!acl) return put(p+': The system cannot find the file specified.\nSuccessfully processed 0 files; Failed processing 1 files');
      const pad=' '.repeat(p.length+1);
      put(acl.map((e,i)=>(i?pad:p+' ')+e).join('\n')+'\n\nSuccessfully processed 1 files; Failed processing 0 files');
    },
    route:a=>{
      if((a[0]||'').toLowerCase()!=='print') return put((a[0]||'').toLowerCase()==='add'||(a[0]||'').toLowerCase()==='delete'?'The requested operation requires elevation.':'Manipulates network routing tables.\n\nROUTE [-f] [-p] [-4|-6] command [destination]\n                  [MASK netmask]  [gateway] [METRIC metric]  [IF interface]\n\n(ในแล็บนี้ใช้ route print)');
      put(`===========================================================================
Interface List
 11...00 1a 2b 3c 4d 5e ......Realtek PCIe GbE Family Controller
  1...........................Software Loopback Interface 1
===========================================================================

IPv4 Route Table
===========================================================================
Active Routes:
Network Destination        Netmask          Gateway       Interface  Metric
          0.0.0.0          0.0.0.0     192.168.20.1    192.168.20.57     25
        127.0.0.0        255.0.0.0         On-link         127.0.0.1    331
        127.0.0.1  255.255.255.255         On-link         127.0.0.1    331
  127.255.255.255  255.255.255.255         On-link         127.0.0.1    331
     192.168.20.0    255.255.255.0         On-link     192.168.20.57    281
    192.168.20.57  255.255.255.255         On-link     192.168.20.57    281
   192.168.20.255  255.255.255.255         On-link     192.168.20.57    281
        224.0.0.0        240.0.0.0         On-link         127.0.0.1    331
        224.0.0.0        240.0.0.0         On-link     192.168.20.57    281
  255.255.255.255  255.255.255.255         On-link         127.0.0.1    331
  255.255.255.255  255.255.255.255         On-link     192.168.20.57    281
===========================================================================
Persistent Routes:
  None`);
    },
    netsh:a=>{
      const w=a.map(x=>x.toLowerCase());
      if(w[0]==='wlan') return put('There is no wireless interface on the system.\n(เครื่อง LAB-PC07 เป็นเครื่องตั้งโต๊ะที่ต่อสาย LAN ไม่มีการ์ด Wi-Fi)');
      if(w[0]==='advfirewall'&&w[1]==='set') return put('The requested operation requires elevation (Run as administrator).');
      if(w[0]==='advfirewall'&&w[1]==='show'&&(w[2]==='allprofiles'||w[2]==='currentprofile')){
        const P=[['Domain','ON'],['Private','OFF'],['Public','ON']].filter(x=>w[2]==='allprofiles'||x[0]==='Private');
        const full=w[3]!=='state';
        return put('\n'+P.map(([n,st])=>`${n} Profile Settings:\n----------------------------------------------------------------------\nState                                 ${st}`+(full?`\nFirewall Policy                       BlockInbound,AllowOutbound\nLocalFirewallRules                    N/A (GPO-store only)\nLocalConSecRules                      N/A (GPO-store only)\nInboundUserNotification               Enable\nRemoteManagement                      Disable\nUnicastResponseToMulticast            Enable\n\nLogging:\nLogAllowedConnections                 Disable\nLogDroppedConnections                 Disable\nFileName                              %systemroot%\\system32\\LogFiles\\Firewall\\pfirewall.log\nMaxFileSize                           4096`:'')).join('\n\n')+'\nOk.\n');
      }
      put('The following commands are available:\n\nnetsh advfirewall show allprofiles [state]\nnetsh advfirewall show currentprofile\nnetsh wlan show interfaces\n(คำสั่ง netsh อื่น ๆ ไม่ได้จำลองไว้ในแล็บนี้)');
    },
    getmac:()=>put(`
Physical Address    Transport Name
=================== ==========================================================
00-1A-2B-3C-4D-5E   \\Device\\Tcpip_{4F2A91C3-7B1E-4D22-9A60-11C0E5B7D3A8}`),
    cls:()=>{screen.innerHTML='';}
  };
  const OK='The command completed successfully.';
  const USERS={
    student:{full:'Student Lab',cmt:'Student account',act:'Yes',grp:'*Users'},
    teacher:{full:'Teacher NetLab',cmt:'Teacher account',act:'Yes',grp:'*Administrators       *Users'},
    administrator:{full:'',cmt:'Built-in account for administering the computer',act:'No',grp:'*Administrators'},
    guest:{full:'',cmt:'Built-in account for guest access',act:'No',grp:'*Guests'}
  };
  const GROUPS={administrators:['Administrator','teacher'],users:['student','teacher','NT AUTHORITY\\Authenticated Users'],guests:['Guest'],'remotedesktopusers':[]};
  const USE=[{st:'OK',dr:'Z:',rm:'\\\\TEACHER-PC\\Worksheets'},{st:'Unavailable',dr:'Y:',rm:'\\\\LAB-PC01\\Old'}];   // mapped drives of this terminal (per page)
  function netCmd(a){
    const sub=(a[0]||'').toLowerCase();
    if(sub==='user'){
      if(a.includes('/add')||a.includes('/delete')) return put('System error 5 has occurred.\n\nAccess is denied.\n(บัญชี student ไม่มีสิทธิ์ Administrator จึงสร้าง/ลบบัญชีไม่ได้)');
      if(!a[1]) return put(`\nUser accounts for \\\\LAB-PC07\n\n-------------------------------------------------------------------------------\nAdministrator            DefaultAccount           Guest\nstudent                  teacher                  WDAGUtilityAccount\n${OK}`);
      const u=USERS[a[1].toLowerCase()];
      if(!u) return put('The user name could not be found.\n\nMore help is available by typing NET HELPMSG 2221.');
      const nm=a[1].toLowerCase()==='administrator'?'Administrator':a[1].toLowerCase()==='guest'?'Guest':a[1].toLowerCase();
      return put(`User name                    ${nm}\nFull Name                    ${u.full}\nComment                      ${u.cmt}\nAccount active               ${u.act}\nAccount expires              Never\n\nPassword required            ${nm==='Guest'?'No':'Yes'}\nUser may change password     Yes\n\nLocal Group Memberships      ${u.grp}\nGlobal Group memberships     *None\n${OK}`);
    }
    if(sub==='localgroup'){
      if(!a[1]) return put(`\nAliases for \\\\LAB-PC07\n\n-------------------------------------------------------------------------------\n*Administrators\n*Guests\n*Remote Desktop Users\n*Users\n${OK}`);
      const key=a.slice(1).join('').toLowerCase(), g=GROUPS[key];
      if(!g) return put('There is no such global user or group.');
      const name={administrators:'Administrators',users:'Users',guests:'Guests',remotedesktopusers:'Remote Desktop Users'}[key];
      return put(`Alias name     ${name}\n\nMembers\n\n-------------------------------------------------------------------------------\n${g.join('\n')}\n${OK}`);
    }
    if(sub==='share'&&a[1]){
      if(a.slice(1).join(' ').includes('=')||a.some(x=>/^\/(delete|grant)/i.test(x))) return put('System error 5 has occurred.\n\nAccess is denied.\n(สร้างหรือลบแชร์ต้องใช้ Command Prompt แบบ Run as administrator)');
      const SH={homework:['Homework','C:\\Share\\Homework','Student homework','Everyone, CHANGE'],'c$':['C$','C:\\','Default share',''],'admin$':['ADMIN$','C:\\Windows','Remote Admin',''],'ipc$':['IPC$','','Remote IPC','']};
      const d=SH[a[1].toLowerCase()];
      if(!d) return put('This shared resource does not exist.\n\nMore help is available by typing NET HELPMSG 2310.');
      return put(`Share name        ${d[0]}\nPath              ${d[1]}\nRemark            ${d[2]}\nMaximum users     No limit\nUsers\nCaching           ${d[3]?'Manual caching of documents':'Caching disabled'}\nPermission        ${d[3]||'(สิทธิ์ของแชร์ระบบ: เฉพาะ Administrators)'}\n\n${OK}`);
    }
    if(sub==='use'){
      const rest=a.slice(1);
      if(!rest.length){
        const rows=USE.map(u=>`${u.st.padEnd(13)}${u.dr.padEnd(10)}${u.rm.padEnd(26)}Microsoft Windows Network`).join('\n');
        return put(`New connections will be remembered.\n\n\nStatus       Local     Remote                    Network\n\n-------------------------------------------------------------------------------\n${rows||'There are no entries in the list.'}\n${OK}`);
      }
      const dr=(rest[0]||'').toUpperCase();
      if(rest.some(x=>/^\/del(ete)?$/i.test(x))){
        const i=USE.findIndex(u=>u.dr===dr||u.rm.toLowerCase()===rest[0].toLowerCase());
        if(i<0) return put('The network connection could not be found.\n\nMore help is available by typing NET HELPMSG 2250.');
        const g=USE.splice(i,1)[0]; return put(`${g.dr||g.rm} was deleted successfully.`);
      }
      const rm=rest.find(x=>/^\\\\/.test(x));
      if(!rm||!/^[A-Z]:$/.test(dr)) return put('The syntax of this command is:\n\nNET USE\n[devicename | *] [\\\\computername\\sharename[\\volume] [password | *]]\n        [/PERSISTENT:{YES | NO}] [/DELETE]');
      if(USE.some(u=>u.dr===dr)) return put('System error 85 has occurred.\n\nThe local device name is already in use.');
      const known={'\\\\lab-pc07\\homework':'\\\\LAB-PC07\\Homework','\\\\teacher-pc\\worksheets':'\\\\TEACHER-PC\\Worksheets','\\\\192.168.20.57\\homework':'\\\\192.168.20.57\\Homework'}[rm.toLowerCase().replace(/\\+$/,'')];
      if(!known) return put('System error 67 has occurred.\n\nThe network name cannot be found.');
      USE.push({st:'OK',dr,rm:known}); return put(OK);
    }
    if(sub==='share') return put(`\nShare name   Resource                        Remark\n\n-------------------------------------------------------------------------------\nC$           C:\\                             Default share\nIPC$                                         Remote IPC\nADMIN$       C:\\Windows                      Remote Admin\nHomework     C:\\Share\\Homework               Student homework\n${OK}`);
    if(sub==='view') return put(`Server Name            Remark\n\n-------------------------------------------------------------------------------\n\\\\LAB-PC01\n\\\\LAB-PC07\n\\\\TEACHER-PC           Teacher\n${OK}`);
    if(sub==='config'&&(a[1]||'').toLowerCase().startsWith('workstation')) return put(`Computer name                        \\\\LAB-PC07\nFull Computer name                   LAB-PC07\nUser name                            student\n\nWorkstation active on\n        NetBT_Tcpip_{4F2A91C3-7B1E-4D22-9A60-11C0E5B7D3A8} (001A2B3C4D5E)\n\nSoftware version                     Windows 11 Pro\n\nWorkstation domain                   NETLAB\nLogon domain                         LAB-PC07\n\nCOM Open Timeout (sec)               0\nCOM Send Count (byte)                16\nCOM Send Timeout (msec)              250\n${OK}`);   // Workstation domain = the Workgroup name
    put('The syntax of this command is:\n\nNET [ CONFIG WORKSTATION | USER | LOCALGROUP | SHARE | USE | VIEW ]');
  }
  CMDS['tracert.exe']=CMDS.tracert; CMDS['ping.exe']=CMDS.ping;

  function run(raw){
    const line=raw.trim();
    put(PROMPT+line,'prompt');
    if(!line)return;
    hist.push(line);hp=hist.length;
    const [c,...args]=line.split(/\s+/);
    const f=CMDS[c.toLowerCase()];
    if(f) f(args);
    else put(`'${c}' is not recognized as an internal or external command,\noperable program or batch file.  (พิมพ์ help เพื่อดูคำสั่ง)`);
  }
  inp.addEventListener('keydown',e=>{
    if(e.key==='Enter'){if(busy)return;run(inp.value);inp.value='';clearTimer();}
    else if(e.key==='ArrowUp'){if(hp>0){hp--;inp.value=hist[hp];}e.preventDefault();}
    else if(e.key==='ArrowDown'){if(hp<hist.length-1){hp++;inp.value=hist[hp];}else{hp=hist.length;inp.value='';}e.preventDefault();}
  });
  const term=el('div',{class:'term'},
    el('div',{class:'tbar'},el('span',{},'Command Prompt — LAB-PC07'),el('span',{class:'ttools'},hint,wrapBtn,el('span',{},'จำลอง'))),
    screen,
    el('div',{class:'inrow'},el('span',{class:'prompt'},'C:\\>'),inp)
  );   // 3.6: no quick command buttons: students type every command themselves (help lists the commands)
  /* the practical timer is sticky: when the student starts typing, scroll so the terminal's top is just below it, not under it */
  function clearTimer(){
    const t=document.querySelector('.prtimer'); if(!t||getComputedStyle(t).position!=='sticky') return;
    const tb=t.getBoundingClientRect().bottom, top=term.getBoundingClientRect().top;
    if(top<tb+8&&term.getBoundingClientRect().bottom>tb) window.scrollBy(0,top-tb-8);
  }
  inp.addEventListener('focus',()=>setTimeout(clearTimer,60));
  screen.addEventListener('click',()=>{ if(!(window.getSelection&&String(window.getSelection()))) inp.focus(); });
  const onResize=()=>{ if(!term.isConnected) window.removeEventListener('resize',onResize); else overflowCue(); };
  window.addEventListener('resize',onResize);
  put('Microsoft Windows [Version 10.0.22631] (จำลองเพื่อการเรียนรู้)\n\nพิมพ์ help เพื่อดูคำสั่งที่ใช้ได้\n');
  return term;
}


/* ---------- เครื่องจำลอง Linux (v86 emulator in the student's browser; a simulator, not a real machine) ---------- */
let VM=null;
function stopVM(){ if(VM){ const v=VM; VM=null; try{ v.destroy(); }catch(e){} } }
function loadScript(src){
  return new Promise((res,rej)=>{
    if(window.V86){res();return;}
    const s=document.createElement('script'); s.src=src; s.onload=res; s.onerror=()=>rej(new Error('script')); document.head.append(s);
  });
}
function vmPanel(r){
  const status=el('div',{class:'vmstatus'},'เครื่องจำลองยังไม่ได้เปิด กด "เปิดเครื่องจำลอง" เพื่อบูต ครั้งแรกต้องดาวน์โหลดไฟล์ประมาณ 10 MB และบูตประมาณ 10–30 วินาที');
  const screen=el('div',{class:'vmscreen',title:'คลิกที่นี่แล้วพิมพ์คำสั่ง'},
    el('div',{style:'white-space:pre;font:14px/16px "JetBrains Mono",Consolas,monospace'}),
    el('canvas',{style:'display:none'}));
  const setStatus=(t,bad)=>{status.textContent=t;status.className='vmstatus'+(bad?' bad':'');};
  const setupBtn=el('button',{class:'btn ghost',onclick:async()=>{
    if(!VM)return;
    let setup=r.vmSetup; if(setup===true){ try{ setup=(await api('GET',`/api/labs/${r.id}/vmsetup`)).setup; r.vmSetup=setup; }catch(e){ setStatus('โหลดคำสั่งเตรียมโจทย์ไม่สำเร็จ ลองใหม่อีกครั้ง',true); return; } }
    VM.keyboard_send_text(setup+'\n');
    setStatus('ส่งคำสั่งเตรียมโจทย์แล้ว ถ้าหน้าจอยังค้างอยู่ที่บรรทัดคำสั่ง ให้คลิกหน้าจอแล้วกด Enter');
  }},'เตรียมโจทย์');
  const restartBtn=el('button',{class:'btn ghost',onclick:()=>{ if(VM){ VM.restart(); setStatus('กำลังรีสตาร์ท หลังบูตเสร็จต้องกด "เตรียมโจทย์" ใหม่'); } }},'รีสตาร์ท');
  const stopBtn=el('button',{class:'btn ghost',onclick:()=>{ stopVM(); lock(true); startBtn.disabled=false; setStatus('ปิดเครื่องจำลองแล้ว'); }},'ปิดเครื่องจำลอง');
  const lock=on=>[setupBtn,restartBtn,stopBtn].forEach(b=>b.disabled=on);
  lock(true);
  const startBtn=el('button',{class:'btn',onclick:async()=>{
    startBtn.disabled=true; setStatus('กำลังโหลดไฟล์เครื่องจำลอง...');
    try{
      const head=await fetch(VM_BASE+'buildroot-bzimage.bin',{method:'HEAD'});
      if(!head.ok) throw new Error('noimage');
      await loadScript(VM_BASE+'libv86.js');
      stopVM();
      VM=new V86({
        wasm_path:VM_BASE+'v86.wasm',
        memory_size:128*1024*1024,
        vga_memory_size:8*1024*1024,
        screen_container:screen,
        bios:{url:VM_BASE+'seabios.bin'},
        vga_bios:{url:VM_BASE+'vgabios.bin'},
        bzimage:{url:VM_BASE+'buildroot-bzimage.bin'},
        cmdline:'tsc=reliable mitigations=off random.trust_cpu=on',
        autostart:true
      });
      VM.add_listener('emulator-ready',()=>{
        lock(false);
        setStatus('กำลังบูต รอจนเห็น prompt ของ Linux (ถ้าถามชื่อผู้ใช้ให้พิมพ์ root) แล้วกด "เตรียมโจทย์" คลิกที่หน้าจอดำก่อนพิมพ์คำสั่ง');
      });
    }catch(e){
      startBtn.disabled=false;
      let missing='';
      try{ const st=await (await fetch('vm-status')).json(); missing=st.files.filter(f=>!f.ok||!f.size).map(f=>f.name).join(', '); }catch(_){}
      setStatus('เปิดเครื่องจำลองไม่ได้ เพราะไม่พบไฟล์เครื่องจำลองบนเซิร์ฟเวอร์'+(missing?' (ไฟล์ที่ขาด: '+missing+')':'')+' ครูตรวจได้ที่หน้า /vm-status และดูวิธีแก้ใน README',true);
    }
  }},'เปิดเครื่องจำลอง');
  return el('div',{class:'vm'},el('div',{class:'row',style:'margin-bottom:10px'},startBtn,setupBtn,restartBtn,stopBtn),status,screen);
}



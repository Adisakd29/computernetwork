'use strict';

/* ---------- constants ---------- */
const WIRE = {
  wo:'repeating-linear-gradient(135deg,var(--wo) 0 6px,var(--orange) 6px 10px)',
  o:'var(--orange)',
  wg:'repeating-linear-gradient(135deg,var(--wo) 0 6px,var(--green) 6px 10px)',
  bl:'var(--blue)',
  wb:'repeating-linear-gradient(135deg,var(--wo) 0 6px,var(--blue) 6px 10px)',
  g:'var(--green)',
  wbr:'repeating-linear-gradient(135deg,var(--wo) 0 6px,var(--brown) 6px 10px)',
  br:'var(--brown)'
};
const VM_BASE='v86/';
let ROOMS=[], WEEKS=[], ALL=[];

/* ---------- state ----------
   Guests keep progress in this browser (localStorage).
   Logged-in users get progress from the server; the server checks answers and keeps the score. */
const KEY='netlab-v2';
let ME=null, DBON=false, ASSIGN=[], SKEW=0;
const now=()=>Date.now()+SKEW;
const blank=()=>({name:'',done:{},hints:{},timers:{},att:{},explain:{},flags:{},given:{},wrong:{},lessons:{}});
let S=blank();
let SEED=(()=>{try{let s=localStorage.getItem('netlab-seed'); if(!s){ s=Math.random().toString(36).slice(2,10); localStorage.setItem('netlab-seed',s);} return s;}catch(e){return 'x';}})();
function loadGuest(){
  S=blank();
  try{const raw=localStorage.getItem(KEY); if(raw) Object.assign(S,JSON.parse(raw));}catch(e){}
  ['done','hints','timers','att','explain','flags','given','wrong','lessons'].forEach(k=>{ if(!S[k]) S[k]={}; });
}
function save(){ if(ME) return; try{localStorage.setItem(KEY,JSON.stringify(S));}catch(e){} }
const uidKey=()=>ME?('u'+ME.id):'guest';
const orderState={};

const tid=(r,i)=>r.id+'-'+i;
const vid=(r,i)=>r.id+'-vm'+i;
const roomDone=r=>r.tasks.filter((t,i)=>S.done[tid(r,i)]).length;
const vmDone=r=>(r.vmTasks||[]).filter((t,i)=>S.done[vid(r,i)]).length;
/* คะแนนต่อข้อ: เต็ม 10, ใช้คำใบ้ −5, ตอบผิดครั้งละ −2, ต่ำสุด 2 คะแนนเมื่อตอบถูก (เซิร์ฟเวอร์ใช้กติกาเดียวกัน) */
const ptsLeft=id=>Math.max(2,10-(S.hints[id]?5:0)-2*(S.att[id]||0));
const pts=id=>S.done[id]?ptsLeft(id):0;
const roomScore=r=>r.tasks.reduce((b,t,i)=>b+pts(tid(r,i)),0)+(r.vmTasks||[]).reduce((b,t,i)=>b+pts(vid(r,i)),0);
const roomMax=r=>(r.tasks.length+(r.vmTasks||[]).length)*10;
const listScore=L=>L.reduce((a,r)=>a+roomScore(r),0);
const listMax=L=>L.reduce((a,r)=>a+roomMax(r),0);
const score=()=>listScore(ALL);
const findTask=id=>{ for(const r of ALL){ const m=id.match(/^(.*)-(vm)?(\d+)$/); if(m&&m[1]===r.id){ const L=m[2]?r.vmTasks:r.tasks; return {r,t:L&&L[+m[3]]}; } } return {}; };

const app=document.getElementById('app');
function el(tag,attrs={},...kids){
  const e=document.createElement(tag);
  for(const k in attrs){
    if(attrs[k]==null) continue;
    if(k==='class')e.className=attrs[k];
    else if(k==='style')e.setAttribute('style',attrs[k]);
    else if(k.startsWith('on'))e.addEventListener(k.slice(2),attrs[k]);
    else e.setAttribute(k,attrs[k]);
  }
  kids.flat(Infinity).forEach(c=>{if(c==null||c===false)return;e.append(c.nodeType?c:document.createTextNode(c));});
  return e;
}

/* ---------- API ---------- */
async function api(method,path,body){
  let r;
  try{
    r=await fetch(path,{method,credentials:'same-origin',headers:{'Content-Type':'application/json','X-NetLab':'1'},body:body?JSON.stringify(body):undefined});
  }catch(e){ setOffline(true); const err=new Error('offline'); err.offline=true; throw err; }
  const fromCache=!!(r.headers&&r.headers.get&&r.headers.get('X-NetLab-Offline')==='1');           // served by the service worker's offline copy
  let j={}; try{ j=await r.json(); }catch(e){}
  if(r.status===503&&j.error==='offline'){ setOffline(true); const err=new Error('offline'); err.offline=true; throw err; }
  setOffline(fromCache);
  if(!r.ok){ const err=new Error(j.message||('HTTP '+r.status)); err.status=r.status; err.code=j.error; err.body=j; throw err; }
  if(method!=='GET'&&!path.startsWith('/api/game')&&!path.startsWith('/api/auth')) API_WRITES++;   // progress may have changed
  return j;
}
let API_WRITES=0;
function applyMe(me){
  DBON=!!me.db;
  if(me.now) SKEW=me.now-Date.now();
  if(me.user){
    ME=me.user; ASSIGN=me.assignments||[];
    S=Object.assign(blank(),me.progress||{}); S.name=ME.name; S.lessons=me.lessons||{};
  }else{ ME=null; ASSIGN=[]; loadGuest(); }
}
async function refreshMe(){ try{ applyMe(await api('GET','/api/me')); }catch(e){ if(!e.offline) console.warn(e); } }

/* ---------- offline queue + drafts ---------- */
let OFFLINE=false;
function setOffline(v){ if(OFFLINE===v) return; OFFLINE=v; const b=document.getElementById('netbar'); if(b) b.hidden=!v; }
const qKey=()=>'netlab-queue-'+uidKey();
const getQ=()=>{ try{ return JSON.parse(localStorage.getItem(qKey())||'[]'); }catch(e){ return []; } };
const setQ=q=>{ try{ localStorage.setItem(qKey(),JSON.stringify(q)); }catch(e){} };
function queuePush(id,answer){ const q=getQ().filter(x=>x.id!==id); q.push({id,answer,t:Date.now()}); setQ(q); }
let flushing=false;
async function flushQueue(){
  if(flushing) return; const q=getQ(); if(!q.length) return;
  flushing=true; let changed=false;
  try{
    for(const item of q){
      try{ const res=await api('POST','/api/check',{key:item.id,answer:item.answer}); applyResult(item.id,item.answer,res); changed=true; setQ(getQ().filter(x=>x.id!==item.id)); }
      catch(e){ if(e.offline) break; setQ(getQ().filter(x=>x.id!==item.id)); changed=true; }
    }
  } finally { flushing=false; }
  if(changed && CURRENT!=null) openRoom(CURRENT,true);
}
window.addEventListener('online',flushQueue);
setInterval(()=>{ if(getQ().length) flushQueue(); },20000);
const dKey=()=>'netlab-drafts-'+uidKey();
const getDrafts=()=>{ try{ return JSON.parse(localStorage.getItem(dKey())||'{}'); }catch(e){ return {}; } };
function setDraft(id,v){ const d=getDrafts(); if(v==null) delete d[id]; else d[id]=v; try{ localStorage.setItem(dKey(),JSON.stringify(d)); }catch(e){} }

/* applies a /api/check result to local state; returns the result */
function applyResult(id,answer,res){
  const {r}=findTask(id);
  if(res.correct){
    S.done[id]=true;
    if(res.explain) S.explain[id]=res.explain;
    if(res.given!=null) S.given[id]=res.given;
    if(!ME){ S.raw=S.raw||{}; S.raw[id]=answer; }   // kept so the work can be graded again when linked to an account
    if(ME){ S.att[id]=res.attempts||0; if(res.hint) S.hints[id]=true; }
    if(r && res.flag && (ME || roomDone(r)===r.tasks.length)) S.flags[r.id]=res.flag;
    if(r && res.finished && S.timers[r.id]){ S.timers[r.id].status='finished'; S.timers[r.id].end=now(); }
    setDraft(id,null);
  }else if(!res.queued){
    if(ME){ S.att[id]=res.attempts||0; }
    else{
      const k=JSON.stringify(answer); S.wrong[id]=S.wrong[id]||[];
      if(!S.wrong[id].includes(k)){ S.wrong[id].push(k); S.att[id]=(S.att[id]||0)+1; }
    }
  }
  save();
  return res;
}
async function submit(id,answer){
  try{ return applyResult(id,answer,await api('POST','/api/check',{key:id,answer})); }
  catch(e){
    if(e.offline){ queuePush(id,answer); return {queued:true}; }
    if(e.code==='closed'||e.code==='not_started'){ await refreshMe(); return {closed:true,message:e.message}; }
    return {error:true,message:e.message};
  }
}


/* ---------- modals, auth ---------- */
function modal(title,body,{closable=true}={}){
  const back=el('div',{class:'modal-back',role:'dialog','aria-modal':'true','aria-label':title});
  const opener=document.activeElement;
  const close=()=>{ back.remove(); document.removeEventListener('keydown',onKey,true); if(!document.querySelector('.modal-back')) document.documentElement.classList.remove('nl-modal'); if(opener&&opener.focus&&document.contains(opener)) opener.focus({preventScroll:true}); };
  const onKey=e=>{
    if(!document.contains(back)) return document.removeEventListener('keydown',onKey,true);
    if(e.key==='Escape'&&closable){ e.preventDefault(); e.stopPropagation(); close(); return; }
    if(e.key==='Tab'){ const f=[...back.querySelectorAll('button,input,select,textarea,a[href],[tabindex="0"]')].filter(x=>!x.disabled&&x.offsetParent!==null); if(!f.length) return;
      const i=f.indexOf(document.activeElement); if(i<0){ e.preventDefault(); f[0].focus(); return; } if(e.shiftKey&&(i<=0)){ e.preventDefault(); f[f.length-1].focus(); } else if(!e.shiftKey&&i===f.length-1){ e.preventDefault(); f[0].focus(); } }
  };
  document.addEventListener('keydown',onKey,true); document.documentElement.classList.add('nl-modal');
  const box=el('div',{class:'modal'},el('div',{class:'modal-head'},el('h2',{},title),closable?el('button',{class:'modal-x','aria-label':'ปิด',onclick:close},'×'):null),body);
  back.append(box);
  if(closable) back.addEventListener('click',e=>{ if(e.target===back) close(); });
  document.body.append(back);
  const f=box.querySelector('input'); if(f) setTimeout(()=>f.focus(),30);
  return close;
}
function formRows(defs){
  const inputs={};
  const rows=defs.map(d=>{ const i=el('input',{type:d.type||'text',autocomplete:d.ac||'off',autocapitalize:'off',spellcheck:'false',placeholder:d.ph||'',inputmode:d.im,'aria-describedby':null}); inputs[d.k]=i;
    const help=d.help?el('small',{},d.help):null, live=el('small',{class:'mlive','aria-live':'polite'});
    let field=i;
    if(d.type==='password'){
      const eye=el('button',{type:'button',class:'pweye','aria-label':'แสดงรหัสผ่าน','aria-pressed':'false',onclick:()=>{ const show=i.type==='password'; i.type=show?'text':'password'; eye.textContent=show?'ซ่อน':'แสดง'; eye.setAttribute('aria-pressed',String(show)); eye.setAttribute('aria-label',show?'ซ่อนรหัสผ่าน':'แสดงรหัสผ่าน'); i.focus(); }},'แสดง');
      field=el('span',{class:'pwwrap'},i,eye);
      const caps=e=>{ if(e.getModifierState) live.textContent=e.getModifierState('CapsLock')?'เปิด Caps Lock อยู่':''; };
      i.addEventListener('keyup',caps); i.addEventListener('keydown',caps);
    }
    if(d.upper) i.addEventListener('input',()=>{ const p=i.selectionStart; i.value=i.value.toUpperCase().replace(/\s/g,''); try{ i.setSelectionRange(p,p); }catch(e){} });
    if(d.check) i.addEventListener('input',()=>{ const m=i.value?d.check(i.value):''; live.textContent=m||''; live.className='mlive'+(m?' bad':''); i.setAttribute('aria-invalid',m?'true':'false'); });
    return el('label',{class:'mrow'},el('span',{},d.label),field,help,live); });
  return {rows,inputs};
}
function loginModal(){
  const {rows,inputs}=formRows([{k:'u',label:'ชื่อผู้ใช้',ac:'username'},{k:'p',label:'รหัสผ่าน',type:'password',ac:'current-password'}]);
  const msg=el('div',{class:'msg bad'});
  const btn=el('button',{class:'btn',type:'submit'},'เข้าสู่ระบบ');
  const form=el('form',{class:'mform'},...rows,msg,el('div',{class:'row'},btn),
    el('div',{class:'mlinks'},el('button',{type:'button',class:'linkbtn',onclick:()=>{ close(); forgotModal(inputs.u.value); }},'ลืมรหัสผ่าน?'),
      DBON?el('button',{type:'button',class:'linkbtn',onclick:()=>{ close(); registerModal(); }},'ยังไม่มีบัญชี สมัครด้วยรหัสห้อง'):null));
  const close=modal('เข้าสู่ระบบ',form);
  form.addEventListener('submit',async e=>{
    e.preventDefault(); btn.disabled=true; msg.textContent='';
    try{ await api('POST','/api/auth/login',{username:inputs.u.value,password:inputs.p.value}); close(); await afterAuth(); }
    catch(err){ msg.textContent=err.offline?'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้':err.message; btn.disabled=false; }
  });
}
const PW_RULE=v=>v.length<8?'ยังสั้นไป ต้องอย่างน้อย 8 ตัว':(!/[0-9]/.test(v)||!/[^0-9]/.test(v))?'ต้องมีทั้งตัวอักษรและตัวเลข':'';
function forgotModal(prefill){
  const {rows,inputs}=formRows([{k:'u',label:'ชื่อผู้ใช้ของคุณ',ac:'username'},{k:'note',label:'ข้อความถึงครู (ไม่บังคับ)',ph:'เช่น เลขที่ 12 ห้อง ปวช.2/1'}]);
  if(prefill) inputs.u.value=prefill;
  const msg=el('div',{class:'msg bad','aria-live':'polite'});
  const btn=el('button',{class:'btn',type:'submit'},'ส่งคำขอถึงครู');
  const form=el('form',{class:'mform'},el('p',{class:'mnote'},'ระบบไม่ใช้อีเมล การกู้คืนบัญชีจึงทำผ่านครูผู้สอน: ส่งคำขอนี้ ครูจะเห็นในแดชบอร์ดและตั้งรหัสผ่านชั่วคราวให้ แล้วคุณตั้งรหัสใหม่เองตอนเข้าใช้'),...rows,msg,el('div',{class:'row'},btn));
  const close=modal('ลืมรหัสผ่าน',form);
  form.addEventListener('submit',async e=>{ e.preventDefault(); msg.textContent=''; btn.disabled=true;
    try{ const r=await api('POST','/api/auth/forgot',{username:inputs.u.value,note:inputs.note.value}); R(form,el('p',{class:'msg ok'},r.message),el('div',{class:'row'},el('button',{class:'btn',type:'button',onclick:()=>{ close(); loginModal(); }},'กลับไปหน้าเข้าสู่ระบบ'))); }
    catch(err){ msg.textContent=err.offline?'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้':err.message; btn.disabled=false; } });
}
function registerModal(){
  const {rows,inputs}=formRows([
    {k:'code',label:'รหัสห้องเรียน (ได้จากครู)',ph:'เช่น K7Q2MP',upper:true,check:v=>/^[A-Z0-9]{6}$/.test(v)?'':'รหัสห้องมี 6 ตัว (ตัวอักษรอังกฤษและตัวเลข)'},
    {k:'no',label:'เลขที่',im:'numeric',check:v=>/^\d{1,3}$/.test(v)?'':'กรอกเป็นตัวเลข'},
    {k:'name',label:'ชื่อ–นามสกุล',check:v=>v.trim().length>=4?'':'กรอกชื่อและนามสกุล'},
    {k:'u',label:'ตั้งชื่อผู้ใช้ (ภาษาอังกฤษตัวเล็ก)',ac:'username',help:'ใช้ a–z ตัวเลข . _ - ยาว 3–30 ตัว เช่น somchai.j',check:v=>/^[a-z0-9][a-z0-9._-]{2,29}$/.test(v)?'':'ใช้ได้เฉพาะ a–z ตัวเลข . _ - และยาว 3–30 ตัว'},
    {k:'p',label:'ตั้งรหัสผ่าน',type:'password',ac:'new-password',help:'อย่างน้อย 8 ตัว มีทั้งตัวอักษรและตัวเลข',check:PW_RULE},
    {k:'p2',label:'ยืนยันรหัสผ่าน',type:'password',ac:'new-password',check:v=>v===inputs.p.value?'':'ยังไม่ตรงกับช่องรหัสผ่าน'}]);
  const msg=el('div',{class:'msg bad'});
  const btn=el('button',{class:'btn',type:'submit'},'สมัครและเข้าสู่ระบบ');
  const form=el('form',{class:'mform'},hasGuestWork()?el('p',{class:'mnote'},'พบงานที่ทำแบบผู้เยี่ยมชมในเบราว์เซอร์นี้ หลังสมัครเสร็จ คุณเลือกผูกเข้าบัญชีใหม่ได้'):null,...rows,msg,el('div',{class:'row'},btn),
    el('div',{class:'mlinks'},el('button',{type:'button',class:'linkbtn',onclick:()=>{ close(); loginModal(); }},'มีบัญชีแล้ว เข้าสู่ระบบ')));
  const close=modal('สมัครด้วยรหัสห้อง',form);
  form.addEventListener('submit',async e=>{
    e.preventDefault(); msg.textContent='';
    if(inputs.p.value!==inputs.p2.value){ msg.textContent='รหัสผ่านทั้งสองช่องไม่ตรงกัน'; return; }
    btn.disabled=true;
    try{ await api('POST','/api/auth/register',{classCode:inputs.code.value,studentNo:inputs.no.value,name:inputs.name.value,username:inputs.u.value,password:inputs.p.value}); close(); await afterAuth(); }
    catch(err){ msg.textContent=err.offline?'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้':err.message; btn.disabled=false; }
  });
}
function pwModal(forced){
  const {rows,inputs}=formRows([{k:'c',label:forced?'รหัสผ่านชั่วคราวที่ได้รับ':'รหัสผ่านเดิม',type:'password',ac:'current-password'},
    {k:'n',label:'รหัสผ่านใหม่',type:'password',ac:'new-password',help:'อย่างน้อย 8 ตัว มีทั้งตัวอักษรและตัวเลข'},{k:'n2',label:'ยืนยันรหัสผ่านใหม่',type:'password',ac:'new-password'}]);
  const msg=el('div',{class:'msg bad'});
  const btn=el('button',{class:'btn',type:'submit'},'บันทึกรหัสผ่าน');
  const form=el('form',{class:'mform'},forced?el('p',{class:'mnote'},'บัญชีนี้ใช้รหัสผ่านชั่วคราว กรุณาตั้งรหัสผ่านใหม่ของตัวเองก่อนเริ่มใช้งาน'):null,...rows,msg,el('div',{class:'row'},btn,forced?el('button',{class:'btn ghost',type:'button',onclick:logout},'ออกจากระบบ'):null));
  const close=modal(forced?'ตั้งรหัสผ่านใหม่':'เปลี่ยนรหัสผ่าน',form,{closable:!forced});
  form.addEventListener('submit',async e=>{
    e.preventDefault(); msg.textContent='';
    if(inputs.n.value!==inputs.n2.value){ msg.textContent='รหัสผ่านใหม่ทั้งสองช่องไม่ตรงกัน'; return; }
    btn.disabled=true;
    try{ await api('POST','/api/auth/password',{current:inputs.c.value,next:inputs.n.value}); close(); if(ME) ME.mustChangePw=false; toast('เปลี่ยนรหัสผ่านแล้ว'); }
    catch(err){ msg.textContent=err.message; btn.disabled=false; }
  });
}
async function logout(){ try{ await api('POST','/api/auth/logout'); }catch(e){} document.querySelectorAll('.modal-back').forEach(m=>m.remove()); await refreshMe(); renderShell(); route(); }
async function afterAuth(){ await refreshMe(); renderShell(); flushQueue(); route(); if(ME&&ME.mustChangePw) pwModal(true); else if(ME&&ME.role==='student'&&hasGuestWork()) importModal(); }
/* ---------- guest progress -> account ---------- */
function guestState(){ try{ const g=JSON.parse(localStorage.getItem(KEY)||'null'); return g&&typeof g==='object'?g:null; }catch(e){ return null; } }
function guestSummary(g){
  g=g||guestState(); if(!g) return {tasks:0,sections:0,checks:0,tests:0};
  const L=g.lessons||{};
  return {tasks:Object.keys(g.done||{}).filter(k=>g.done[k]).length,
    sections:Object.values(L).reduce((a,x)=>a+((x&&x.visited)||[]).length,0),
    checks:Object.values(L).reduce((a,x)=>a+((x&&x.checks)||[]).length,0),
    tests:Object.values(L).reduce((a,x)=>a+(x&&x.pre?1:0)+(x&&x.post?1:0),0)};
}
function hasGuestWork(){ try{ if(localStorage.getItem('netlab-guest-linked')) return false; }catch(e){} const s=guestSummary(); return s.tasks+s.sections+s.checks>0; }
function importModal(){
  const g=guestState(); if(!g) return; const sm=guestSummary(g);
  const msg=el('div',{class:'msg','aria-live':'polite'});
  const go=el('button',{class:'btn',type:'button'},'ผูกเข้าบัญชีนี้');
  const later=el('button',{class:'btn ghost',type:'button'},'ไม่ใช่ตอนนี้');
  const wipe=el('button',{class:'btn ghost',type:'button'},'ไม่ใช่งานของฉัน ล้างทิ้ง');
  const body=el('div',{class:'mform'},
    el('p',{},'เบราว์เซอร์นี้มีงานที่ทำแบบผู้เยี่ยมชม (ยังไม่ได้เข้าสู่ระบบ):'),
    el('ul',{class:'blist'},el('li',{},`ตอบโจทย์แล็บถูก ${sm.tasks} ข้อ`),el('li',{},`อ่านเนื้อหา ${sm.sections} หัวข้อ`),el('li',{},`แบบฝึกหัดในบทเรียน ${sm.checks} ข้อ`)),
    el('p',{class:'mnote'},'ระบบจะตรวจคำตอบทุกข้อใหม่ที่เซิร์ฟเวอร์ แล็บที่คุณเริ่มทำในบัญชีแล้วจะไม่ถูกแทนที่ ครูจะเห็นว่าเป็นงานที่นำเข้า'+(sm.tests?` แบบทดสอบก่อน/หลังเรียน (${sm.tests} ชุด) นำเข้าไม่ได้เพราะเป็นคะแนนทางการ ต้องทำใหม่ในบัญชี`:'')),
    el('p',{class:'mnote warnnote'},'ถ้าเป็นเครื่องที่ใช้ร่วมกับเพื่อน ให้ผูกเฉพาะเมื่อแน่ใจว่าเป็นงานของคุณเอง'),
    msg,el('div',{class:'row'},go,later,wipe));
  const close=modal('ผูกความคืบหน้าเข้าบัญชี',body);
  later.onclick=close;
  wipe.onclick=()=>{ if(!confirm('ล้างงานแบบผู้เยี่ยมชมในเบราว์เซอร์นี้?')) return; try{ localStorage.removeItem(KEY); }catch(e){} close(); toast('ล้างแล้ว'); };
  go.onclick=async()=>{
    go.disabled=true; msg.className='msg wait'; msg.textContent='กำลังตรวจและนำเข้า...';
    const labs={}; Object.keys(g.done||{}).filter(k=>g.done[k]).forEach(k=>{ labs[k]={a:g.raw&&g.raw[k]!==undefined?g.raw[k]:undefined,given:(g.given||{})[k],att:(g.att||{})[k]||0,hint:!!(g.hints||{})[k]}; });
    const visited={}, checks={}; Object.entries(g.lessons||{}).forEach(([id,x])=>{ if(x&&x.visited&&x.visited.length) visited[id]=x.visited; if(x&&x.checkAns) checks[id]=x.checkAns; });
    try{
      const r=await api('POST','/api/account/import-guest',{labs,visited,checks});
      try{ localStorage.setItem('netlab-guest-linked',String(Date.now())); localStorage.removeItem(KEY); }catch(e){}
      R(body,el('p',{class:'msg ok'},`นำเข้าแล้ว: แล็บ ${r.labs} ชุด (${r.tasks} ข้อ), เนื้อหา ${r.sections} หัวข้อ, แบบฝึกหัด ${r.checks} ข้อ`),
        r.skippedLabs.length?el('p',{class:'mnote'},`ข้าม ${r.skippedLabs.length} แล็บที่เริ่มทำในบัญชีอยู่แล้ว`):null,
        r.rejected?el('p',{class:'mnote'},`มี ${r.rejected} ข้อที่ตรวจซ้ำไม่ผ่านหรือข้อมูลไม่ครบ จึงไม่ได้นำเข้า`):null,
        el('div',{class:'row'},el('button',{class:'btn',type:'button',onclick:async()=>{ close(); await refreshMe(); renderShell(); route(); }},'เสร็จสิ้น')));
    }catch(e){ msg.className='msg bad'; msg.textContent=e.offline?'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้ง':e.message; go.disabled=false; }
  };
}
function toast(t){ const x=el('div',{class:'toast',role:'status'},t); document.body.append(x); setTimeout(()=>x.remove(),2600); }
const fmtDate=ms=>new Date(ms).toLocaleString('th-TH',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
const dueOf=id=>{ const a=ASSIGN.find(a=>a.labId===id); return a?a:null; };


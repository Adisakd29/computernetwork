'use strict';
/* 2.7 account pages: #/login #/register #/forgot #/verify/<t> #/reset/<t> #/auth-result/<code> #/profile #/terms #/privacy
   Uses el/api/R/toast from core.js and app.js. The old modal entry points now open these pages. */

const GOOGLE_G='<svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>';
const AV_COLORS=['#2A66CF','#7B5CE0','#12839E','#1B7A4B','#A34E0F','#B23A6B','#5A6878','#8A5A3B'];
let AUTHCFG=null;
async function authConfig(){ if(AUTHCFG) return AUTHCFG; try{ AUTHCFG=await api('GET','/api/auth/config'); }catch(e){ AUTHCFG={db:DBON,email:false,google:false,offline:true}; } return AUTHCFG; }

/* old modal entry points -> pages (remember where to come back to) */
function goAuth(kind,prefill){
  const h=location.hash||'#/';
  try{ if(!/^#\/(login|register|forgot|verify|reset|auth-result)/.test(h)) sessionStorage.setItem('netlab-return',h); if(prefill) sessionStorage.setItem('netlab-prefill',prefill); }catch(e){}
  location.hash='#/'+kind;
}
loginModal=function(){ goAuth('login'); };
registerModal=function(){ goAuth('register'); };
forgotModal=function(prefill){ goAuth('forgot',prefill); };
const returnHash=()=>{ try{ const r=sessionStorage.getItem('netlab-return'); sessionStorage.removeItem('netlab-return'); return r&&!/^#\/(login|register)/.test(r)?r:'#/'; }catch(e){ return '#/'; } };
async function signedIn(to){ const target=to||returnHash(); if(location.hash!==target) history.replaceState(null,'',target); await afterAuth(); }

function avatarEl(u,size){
  size=size||36;
  if(u&&u.avatarUrl){ const i=el('img',{class:'avatar',src:u.avatarUrl,alt:'',width:size,height:size,referrerpolicy:'no-referrer',loading:'lazy'}); i.onerror=()=>i.replaceWith(avatarEl(Object.assign({},u,{avatarUrl:null}),size)); return i; }
  const c=AV_COLORS[+String((u&&u.avatar)||'c0').slice(1)||0]||AV_COLORS[0];
  const ch=((u&&(u.name||u.displayName))||'?').trim().charAt(0).toUpperCase()||'?';
  return el('span',{class:'avatar',style:`width:${size}px;height:${size}px;background:${c};font-size:${Math.round(size*0.45)}px`,'aria-hidden':'true'},ch);
}

/* ---------- shared layout with the parallax background ---------- */
function authShell(card){
  document.body.classList.add('authmode');
  const brand=el('section',{class:'authbrand'},
    el('a',{class:'authlogo',href:'#/'},icon('logo'),el('span',{},'NetLab')),
    el('h2',{},'ห้องปฏิบัติการเครือข่ายคอมพิวเตอร์'),
    el('p',{},'เรียน 18 สัปดาห์ ฝึกในห้องจำลองที่ทำงานเหมือนเครือข่ายจริง และเก็บความก้าวหน้าไว้ในบัญชีของคุณเอง'),
    el('ul',{class:'authpoints'},
      el('li',{},icon('book'),el('span',{},'เรียนต่อได้ทุกอุปกรณ์ คะแนนไม่หายเมื่อเปลี่ยนเครื่อง')),
      el('li',{},icon('sim'),el('span',{},'ต่อเครือข่าย คำนวณ Subnet เข้าหัวสาย และแก้ปัญหาแบบลงมือทำ')),
      el('li',{},icon('chart'),el('span',{},'ครูเห็นความก้าวหน้าเฉพาะห้องที่คุณเข้าร่วม'))));
  const wrap=el('div',{class:'authwrap'},el('div',{class:'authgrid'},brand,el('section',{class:'authcard'},card)),
    el('p',{class:'authfoot'},el('a',{href:'#/terms'},'เงื่อนไขการใช้งาน'),' · ',el('a',{href:'#/privacy'},'นโยบายความเป็นส่วนตัว'),' · ',el('a',{href:'#/'},'ใช้งานต่อแบบผู้เยี่ยมชม')));
  R(app,wrap);
  if(window.NLParallax) NLParallax.mount(wrap,{strength:1});
  window.scrollTo(0,0);
  const f=wrap.querySelector('.authcard input:not([type=checkbox])'); if(f&&matchMedia('(pointer:fine)').matches) setTimeout(()=>f.focus(),60);
}
function googleBtn(mode,cfg){
  if(!cfg.google) return null;
  return el('a',{class:'gbtn',href:'/api/auth/google/start'+(mode==='link'?'?mode=link':''),onclick:()=>{ try{ if(mode!=='link'&&!sessionStorage.getItem('netlab-return')) sessionStorage.setItem('netlab-return','#/'); }catch(e){} }},
    el('span',{class:'gicon',html:GOOGLE_G}),el('span',{},mode==='link'?'เชื่อมบัญชี Google':'ดำเนินการต่อด้วย Google'));
}
const orLine=()=>el('div',{class:'orline'},el('span',{},'หรือ'));
const errBox=()=>el('div',{class:'msg bad authmsg',role:'alert','aria-live':'assertive'});
function setErr(box,err){ box.textContent=err&&err.offline?'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่':(err&&err.message)||String(err||''); }
function noDb(){ authShell(el('div',{},el('h1',{},'ระบบสมาชิกยังไม่เปิด'),el('p',{class:'muted'},'เซิร์ฟเวอร์นี้ยังไม่ได้เชื่อมต่อฐานข้อมูล จึงใช้ได้เฉพาะโหมดผู้เยี่ยมชม (คะแนนเก็บในเบราว์เซอร์นี้)'),el('a',{class:'btn',href:'#/'},'ใช้งานแบบผู้เยี่ยมชม'))); }

/* ---------- login ---------- */
async function loginPage(){
  setTitle('เข้าสู่ระบบ');
  if(ME) return signedIn();
  const cfg=await authConfig(); if(!cfg.db&&!cfg.offline) return noDb();
  let pre=''; try{ pre=sessionStorage.getItem('netlab-prefill')||''; sessionStorage.removeItem('netlab-prefill'); }catch(e){}
  const {rows,inputs}=formRows([{k:'u',label:cfg.email?'อีเมล หรือชื่อผู้ใช้':'ชื่อผู้ใช้',ac:'username',im:'email'},{k:'p',label:'รหัสผ่าน',type:'password',ac:'current-password'}]);
  inputs.u.value=pre;
  const msg=errBox(), extra=el('div',{});
  const btn=el('button',{class:'btn big wide',type:'submit'},'เข้าสู่ระบบ');
  const form=el('form',{class:'mform authform',novalidate:''},...rows,
    el('div',{class:'authrow'},el('a',{href:'#/forgot',class:'small',onclick:()=>{ try{ sessionStorage.setItem('netlab-prefill',inputs.u.value); }catch(e){} }},'ลืมรหัสผ่าน?')),
    msg,extra,btn);
  form.addEventListener('submit',async e=>{
    e.preventDefault(); msg.textContent=''; R(extra);
    if(!inputs.u.value.trim()||!inputs.p.value){ msg.textContent='กรอกอีเมล (หรือชื่อผู้ใช้) และรหัสผ่าน'; return; }
    btn.disabled=true; btn.textContent='กำลังเข้าสู่ระบบ...';
    try{ await api('POST','/api/auth/login',{username:inputs.u.value,password:inputs.p.value}); await signedIn(); }
    catch(err){ setErr(msg,err); btn.disabled=false; btn.textContent='เข้าสู่ระบบ';
      if(err.code==='unverified') R(extra,el('button',{class:'btn ghost sm',type:'button',onclick:async ev=>{ ev.target.disabled=true; try{ const r=await api('POST','/api/auth/resend-verify',{email:inputs.u.value}); R(extra,el('p',{class:'msg ok'},r.message)); }catch(e2){ setErr(msg,e2); } }},'ส่งลิงก์ยืนยันอีกครั้ง')); }
  });
  authShell(el('div',{},
    el('h1',{},'ยินดีต้อนรับกลับ'),el('p',{class:'muted'},'เข้าสู่ระบบเพื่อเรียนต่อจากที่ค้างไว้ ทุกอุปกรณ์'),
    googleBtn('login',cfg),cfg.google?orLine():null,form,
    el('p',{class:'authswitch'},'ยังไม่มีบัญชี? ',el('a',{href:'#/register'},'สมัครสมาชิก'))));
}

/* ---------- register: e-mail, or the class code from the teacher (older flow, kept) ---------- */
async function registerPage(mode){
  setTitle('สมัครสมาชิก');
  if(ME) return signedIn();
  const cfg=await authConfig(); if(!cfg.db&&!cfg.offline) return noDb();
  mode=mode||(cfg.email?'email':'code');
  const tabs=el('div',{class:'authtabs',role:'tablist','aria-label':'วิธีสมัคร'},
    el('button',{type:'button',role:'tab','aria-selected':String(mode==='email'),class:mode==='email'?'on':'',onclick:()=>registerPage('email')},'สมัครด้วยอีเมล'),
    el('button',{type:'button',role:'tab','aria-selected':String(mode==='code'),class:mode==='code'?'on':'',onclick:()=>registerPage('code')},'มีรหัสห้องจากครู'));
  const guestNote=hasGuestWork()?el('p',{class:'mnote'},'พบงานที่ทำแบบผู้เยี่ยมชมในเบราว์เซอร์นี้ หลังสมัครเสร็จ คุณเลือกผูกเข้าบัญชีใหม่ได้'):null;
  const msg=errBox();
  let body;
  if(mode==='email'){
    if(!cfg.email) body=el('div',{},el('p',{class:'msg'},'ระบบส่งอีเมลยังไม่ได้ตั้งค่าบนเซิร์ฟเวอร์นี้ จึงยังสมัครด้วยอีเมลไม่ได้'),el('p',{class:'muted small'},cfg.google?'ใช้ปุ่ม "ดำเนินการต่อด้วย Google" ด้านบน หรือสมัครด้วยรหัสห้องจากครู':'สมัครด้วยรหัสห้องจากครูแทน'));
    else{
      const {rows,inputs}=formRows([
        {k:'name',label:'ชื่อที่ใช้แสดงในระบบ',ph:'เช่น สมชาย หรือ สมชาย ใจดี',ac:'nickname',check:v=>v.trim().length>=2?'':'อย่างน้อย 2 ตัวอักษร'},
        {k:'email',label:'อีเมล',type:'email',ac:'email',im:'email',ph:'name@example.com',check:v=>/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim())?'':'รูปแบบอีเมลยังไม่ถูกต้อง'},
        {k:'p',label:'ตั้งรหัสผ่าน',type:'password',ac:'new-password',help:'อย่างน้อย 8 ตัว มีทั้งตัวอักษรและตัวเลข',check:PW_RULE},
        {k:'p2',label:'ยืนยันรหัสผ่าน',type:'password',ac:'new-password',check:v=>v===inputs.p.value?'':'ยังไม่ตรงกับช่องรหัสผ่าน'}]);
      const acc=el('input',{type:'checkbox',id:'acc'});
      const btn=el('button',{class:'btn big wide',type:'submit'},'สร้างบัญชี');
      body=el('form',{class:'mform authform',novalidate:''},...rows,
        el('label',{class:'chk',for:'acc'},acc,el('span',{},'ฉันอ่านและยอมรับ ',el('a',{href:'#/terms',target:'_blank'},'เงื่อนไขการใช้งาน'),' และ ',el('a',{href:'#/privacy',target:'_blank'},'นโยบายความเป็นส่วนตัว'))),
        msg,btn);
      body.addEventListener('submit',async e=>{
        e.preventDefault(); msg.textContent='';
        if(inputs.p.value!==inputs.p2.value){ msg.textContent='รหัสผ่านทั้งสองช่องไม่ตรงกัน'; return; }
        if(!acc.checked){ msg.textContent='กรุณาอ่านและยอมรับเงื่อนไขการใช้งานและนโยบายความเป็นส่วนตัว'; return; }
        btn.disabled=true; btn.textContent='กำลังสร้างบัญชี...';
        try{ const r=await api('POST','/api/auth/signup',{name:inputs.name.value,email:inputs.email.value,password:inputs.p.value,password2:inputs.p2.value,accept:true}); checkEmailPage(r.email,r.message); }
        catch(err){ setErr(msg,err); btn.disabled=false; btn.textContent='สร้างบัญชี'; }
      });
    }
  }else{
    const {rows,inputs}=formRows([
      {k:'code',label:'รหัสห้องเรียน (ได้จากครู)',ph:'เช่น K7Q2MP',upper:true,check:v=>/^[A-Z0-9]{6}$/.test(v)?'':'รหัสห้องมี 6 ตัว (ตัวอักษรอังกฤษและตัวเลข)'},
      {k:'no',label:'เลขที่',im:'numeric',check:v=>/^\d{1,3}$/.test(v)?'':'กรอกเป็นตัวเลข'},
      {k:'name',label:'ชื่อ–นามสกุล',check:v=>v.trim().length>=4?'':'กรอกชื่อและนามสกุล'},
      {k:'u',label:'ตั้งชื่อผู้ใช้ (ภาษาอังกฤษตัวเล็ก)',ac:'username',help:'ใช้ a–z ตัวเลข . _ - ยาว 3–30 ตัว เช่น somchai.j',check:v=>/^[a-z0-9][a-z0-9._-]{2,29}$/.test(v)?'':'ใช้ได้เฉพาะ a–z ตัวเลข . _ - และยาว 3–30 ตัว'},
      {k:'p',label:'ตั้งรหัสผ่าน',type:'password',ac:'new-password',help:'อย่างน้อย 8 ตัว มีทั้งตัวอักษรและตัวเลข',check:PW_RULE},
      {k:'p2',label:'ยืนยันรหัสผ่าน',type:'password',ac:'new-password',check:v=>v===inputs.p.value?'':'ยังไม่ตรงกับช่องรหัสผ่าน'}]);
    const btn=el('button',{class:'btn big wide',type:'submit'},'สมัครและเข้าสู่ระบบ');
    body=el('form',{class:'mform authform',novalidate:''},el('p',{class:'muted small'},'บัญชีแบบนี้ใช้ชื่อผู้ใช้แทนอีเมล และเข้าห้องเรียนของครูทันที ถ้าลืมรหัสผ่านให้ครูรีเซ็ตให้'),...rows,
      el('p',{class:'muted small'},'การสมัครถือว่ายอมรับ ',el('a',{href:'#/terms',target:'_blank'},'เงื่อนไขการใช้งาน'),' และ ',el('a',{href:'#/privacy',target:'_blank'},'นโยบายความเป็นส่วนตัว')),msg,btn);
    body.addEventListener('submit',async e=>{
      e.preventDefault(); msg.textContent='';
      if(inputs.p.value!==inputs.p2.value){ msg.textContent='รหัสผ่านทั้งสองช่องไม่ตรงกัน'; return; }
      btn.disabled=true;
      try{ await api('POST','/api/auth/register',{classCode:inputs.code.value,studentNo:inputs.no.value,name:inputs.name.value,username:inputs.u.value,password:inputs.p.value}); await signedIn(); }
      catch(err){ setErr(msg,err); btn.disabled=false; }
    });
  }
  authShell(el('div',{},el('h1',{},'สร้างบัญชี NetLab'),el('p',{class:'muted'},'บัญชีของคุณเอง คะแนนและความก้าวหน้าแยกจากเพื่อน เข้าร่วมห้องเรียนของครูได้ภายหลัง'),
    googleBtn('login',cfg),cfg.google?el('p',{class:'muted small center'},'การดำเนินการต่อด้วย Google ถือว่ายอมรับเงื่อนไขการใช้งานและนโยบายความเป็นส่วนตัว'):null,cfg.google?orLine():null,
    tabs,guestNote,body,el('p',{class:'authswitch'},'มีบัญชีแล้ว? ',el('a',{href:'#/login'},'เข้าสู่ระบบ'))));
}
function checkEmailPage(email,message){
  const msg=errBox(), btn=el('button',{class:'btn ghost',type:'button'},'ส่งลิงก์ยืนยันอีกครั้ง');
  btn.onclick=async()=>{ btn.disabled=true; try{ const r=await api('POST','/api/auth/resend-verify',{email}); toast(r.message); }catch(e){ setErr(msg,e); } setTimeout(()=>btn.disabled=false,30000); };
  authShell(el('div',{class:'authdone'},el('span',{class:'bigic',html:'<svg viewBox="0 0 24 24" width="44" height="44" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>'}),
    el('h1',{},'ตรวจสอบอีเมลของคุณ'),el('p',{},message),el('p',{class:'muted small'},'ยังเปิดใช้บัญชีไม่ได้จนกว่าจะกดลิงก์ยืนยัน ลิงก์ใช้ได้ 24 ชั่วโมง'),msg,
    el('div',{class:'row'},btn,el('a',{class:'btn',href:'#/login'},'ไปหน้าเข้าสู่ระบบ'))));
}

/* ---------- forgot / verify / reset ---------- */
async function forgotPage(){
  setTitle('ลืมรหัสผ่าน');
  const cfg=await authConfig();
  let pre=''; try{ pre=sessionStorage.getItem('netlab-prefill')||''; sessionStorage.removeItem('netlab-prefill'); }catch(e){}
  const byEmail=cfg.email;
  const {rows,inputs}=formRows([{k:'u',label:byEmail?'อีเมล หรือชื่อผู้ใช้ของคุณ':'ชื่อผู้ใช้ของคุณ',ac:'username'},{k:'note',label:'ข้อความถึงครู (ใช้เมื่อกรอกชื่อผู้ใช้ ไม่บังคับ)',ph:'เช่น เลขที่ 12 ห้อง ปวช.2/1'}]);
  inputs.u.value=pre;
  const msg=errBox(), btn=el('button',{class:'btn big wide',type:'submit'},'ส่งคำขอ');
  const form=el('form',{class:'mform authform',novalidate:''},
    el('p',{class:'mnote'},byEmail?'บัญชีที่สมัครด้วยอีเมล: ระบบส่งลิงก์ตั้งรหัสผ่านใหม่ไปที่อีเมล (ใช้ได้ 30 นาที) · บัญชีที่ครูสร้างให้หรือใช้ชื่อผู้ใช้: คำขอจะไปถึงครู และครูตั้งรหัสผ่านชั่วคราวให้':'การกู้คืนบัญชีทำผ่านครูผู้สอน: ส่งคำขอนี้ ครูจะเห็นในแดชบอร์ดและตั้งรหัสผ่านชั่วคราวให้'),
    ...rows,msg,btn);
  form.addEventListener('submit',async e=>{ e.preventDefault(); msg.textContent=''; const v=inputs.u.value.trim(); if(!v){ msg.textContent='กรอกอีเมลหรือชื่อผู้ใช้'; return; } btn.disabled=true;
    try{ const r=v.includes('@')?await api('POST','/api/auth/forgot-email',{email:v}):await api('POST','/api/auth/forgot',{username:v,note:inputs.note.value});
      const sw=form.parentElement&&form.parentElement.querySelector('.authswitch'); if(sw) sw.remove(); R(form,el('p',{class:'msg ok',role:'status'},r.message),el('a',{class:'btn',href:'#/login'},'กลับไปหน้าเข้าสู่ระบบ')); }
    catch(err){ setErr(msg,err); btn.disabled=false; } });
  authShell(el('div',{},el('h1',{},'ลืมรหัสผ่าน'),form,el('p',{class:'authswitch'},el('a',{href:'#/login'},'กลับไปหน้าเข้าสู่ระบบ'))));
}
function verifyPage(token){
  setTitle('ยืนยันอีเมล');
  const msg=errBox(), btn=el('button',{class:'btn big wide',type:'button'},'ยืนยันอีเมลและเริ่มใช้งาน');
  btn.onclick=async()=>{ btn.disabled=true; msg.textContent='';
    try{ const r=await api('POST','/api/auth/verify',{token}); toast(r.message); await signedIn('#/profile'); }
    catch(err){ setErr(msg,err); btn.disabled=false; } };
  authShell(el('div',{class:'authdone'},el('h1',{},'ยืนยันอีเมล'),el('p',{},'กดปุ่มด้านล่างเพื่อยืนยันว่าอีเมลนี้เป็นของคุณ แล้วระบบจะเข้าสู่ระบบให้อัตโนมัติ'),msg,btn,
    el('p',{class:'authswitch'},'ลิงก์หมดอายุ? ',el('a',{href:'#/login'},'เข้าสู่ระบบ'),' แล้วกด "ส่งลิงก์ยืนยันอีกครั้ง"')));
}
function resetPage(token){
  setTitle('ตั้งรหัสผ่านใหม่');
  const {rows,inputs}=formRows([{k:'p',label:'รหัสผ่านใหม่',type:'password',ac:'new-password',help:'อย่างน้อย 8 ตัว มีทั้งตัวอักษรและตัวเลข',check:PW_RULE},{k:'p2',label:'ยืนยันรหัสผ่านใหม่',type:'password',ac:'new-password',check:v=>v===inputs.p.value?'':'ยังไม่ตรงกับช่องรหัสผ่าน'}]);
  const msg=errBox(), btn=el('button',{class:'btn big wide',type:'submit'},'บันทึกรหัสผ่านใหม่');
  const form=el('form',{class:'mform authform',novalidate:''},...rows,msg,btn);
  form.addEventListener('submit',async e=>{ e.preventDefault(); msg.textContent='';
    if(inputs.p.value!==inputs.p2.value){ msg.textContent='รหัสผ่านทั้งสองช่องไม่ตรงกัน'; return; }
    btn.disabled=true;
    try{ const r=await api('POST','/api/auth/reset',{token,password:inputs.p.value,password2:inputs.p2.value}); toast(r.message); await signedIn('#/'); }
    catch(err){ setErr(msg,err); btn.disabled=false; } });
  authShell(el('div',{},el('h1',{},'ตั้งรหัสผ่านใหม่'),el('p',{class:'muted'},'เมื่อบันทึกแล้ว อุปกรณ์อื่นที่เคยเข้าสู่ระบบไว้จะถูกออกจากระบบทั้งหมด'),form));
}
const AUTH_RESULT={
  ok:['เข้าสู่ระบบด้วย Google แล้ว',null,true],
  new:['สร้างบัญชีด้วย Google เรียบร้อย','กรอกข้อมูลเพิ่มเติมและเข้าร่วมห้องเรียนของครูได้ที่หน้าโปรไฟล์',true,'#/profile'],
  linked:['เชื่อมบัญชี Google แล้ว','ต่อไปเข้าสู่ระบบได้ทั้งด้วยรหัสผ่านและด้วย Google',true,'#/profile'],
  cancelled:['ยกเลิกการเข้าสู่ระบบด้วย Google','ยังไม่มีการเปลี่ยนแปลงใด ๆ'],
  state:['ลิงก์เข้าสู่ระบบหมดอายุหรือไม่ถูกต้อง','กดปุ่ม "ดำเนินการต่อด้วย Google" ใหม่อีกครั้ง (ต้องทำให้เสร็จภายใน 10 นาที)'],
  google_error:['ยืนยันตัวตนกับ Google ไม่สำเร็จ','ลองใหม่อีกครั้ง ถ้ายังไม่ได้ ให้แจ้งครูผู้สอน'],
  email_taken:['อีเมลของบัญชี Google นี้มีบัญชี NetLab อยู่แล้ว','เพื่อความปลอดภัย ระบบไม่รวมบัญชีจากอีเมลอย่างเดียว ให้เข้าสู่ระบบด้วยอีเมลและรหัสผ่านก่อน แล้วไปที่ "โปรไฟล์ > เชื่อมบัญชี Google"'],
  link_conflict:['บัญชี Google นี้ผูกกับบัญชี NetLab อื่นอยู่แล้ว','ใช้บัญชี Google อื่น หรือเข้าสู่ระบบบัญชีนั้นแล้วยกเลิกการเชื่อมก่อน'],
  login_first:['ต้องเข้าสู่ระบบก่อนเชื่อมบัญชี Google',null],
  unverified_email:['Google ยังไม่ได้ยืนยันอีเมลของบัญชีนี้','ยืนยันอีเมลในบัญชี Google ก่อน หรือสมัครด้วยวิธีอื่น'],
  google_off:['การเข้าสู่ระบบด้วย Google ยังไม่ได้ตั้งค่าบนเซิร์ฟเวอร์นี้','ใช้อีเมลหรือรหัสห้องจากครูแทน'],
  disabled:['บัญชีนี้ถูกปิดใช้งาน','ติดต่อครูผู้สอนหรือผู้ดูแลระบบ']
};
async function authResultPage(code){
  const [title,sub,good,to]=AUTH_RESULT[code]||['เกิดข้อผิดพลาด','ลองใหม่อีกครั้ง'];
  if(good){ toast(title+(sub?' · '+sub:'')); await signedIn(to||returnHash()); return; }
  setTitle('เข้าสู่ระบบ');
  authShell(el('div',{class:'authdone'},el('h1',{},title),sub?el('p',{},sub):null,el('div',{class:'row'},el('a',{class:'btn',href:ME?'#/profile':'#/login'},ME?'ไปที่โปรไฟล์':'ไปหน้าเข้าสู่ระบบ'),el('a',{class:'btn ghost',href:'#/'},'หน้าแรก'))));
}

/* ---------- profile ---------- */
async function profilePage(){
  setTitle('โปรไฟล์ของฉัน');
  if(!ME){ goAuth('login'); return; }
  R(app,el('p',{class:'loading'},'กำลังโหลดโปรไฟล์...'));
  let P; try{ P=await api('GET','/api/account/profile'); }catch(e){ R(app,stateBox('error','โหลดโปรไฟล์ไม่สำเร็จ',[e.message],[el('button',{class:'btn',onclick:profilePage},'ลองใหม่')])); return; }
  const cfg=await authConfig();
  const student=P.role==='student';
  /* personal info */
  const {rows,inputs}=formRows([
    {k:'displayName',label:'ชื่อที่แสดง',help:'แสดงในเมนูและหน้าผลการเรียนของคุณ'},
    {k:'fullName',label:'ชื่อ–นามสกุล (ไม่บังคับ)',help:'ช่วยให้ครูรู้ว่าบัญชีนี้เป็นของใคร'},
    {k:'studentCode',label:'รหัสนักเรียน/นักศึกษา (ไม่บังคับ)',ph:'เช่น 66201-007'},
    {k:'gradeLevel',label:'ระดับชั้น (ไม่บังคับ)',ph:'เช่น ปวช.2'},
    {k:'roomName',label:'ห้อง (ไม่บังคับ)',ph:'เช่น 2/4'}]);
  for(const k in inputs) inputs[k].value=P[k]||'';
  let avatar=P.avatar||'c0';
  const avs=el('div',{class:'avpick',role:'radiogroup','aria-label':'รูปโปรไฟล์'});
  const drawAv=()=>R(avs,[...AV_COLORS.map((c,i)=>'c'+i),...(P.hasGooglePhoto?['google']:[])].map(a=>el('button',{type:'button',role:'radio','aria-checked':String(avatar===a),class:'avopt'+(avatar===a?' on':''),'aria-label':a==='google'?'ใช้รูปจากบัญชี Google':'สีพื้นหลัง '+(+a.slice(1)+1),onclick:()=>{ avatar=a; drawAv(); }},
    a==='google'?avatarEl({avatarUrl:P.avatarUrl||'data:,',name:P.displayName},40):avatarEl({avatar:a,name:inputs.displayName.value||P.displayName},40))));
  drawAv(); inputs.displayName.addEventListener('input',drawAv);
  const pmsg=errBox(), psave=el('button',{class:'btn',type:'submit'},'บันทึกข้อมูล');
  const pform=el('form',{class:'mform',novalidate:''},el('div',{class:'mrow'},el('span',{},'รูปโปรไฟล์'),avs,el('small',{},'เลือกสีพื้นหลังกับอักษรแรกของชื่อ'+(P.hasGooglePhoto?' หรือใช้รูปจาก Google':'')+' (ไม่มีการอัปโหลดรูปถ่ายเก็บไว้ในระบบ)')),...rows,pmsg,el('div',{class:'row'},psave));
  pform.addEventListener('submit',async e=>{ e.preventDefault(); pmsg.textContent=''; psave.disabled=true;
    try{ P=await api('PATCH','/api/account/profile',{displayName:inputs.displayName.value,fullName:inputs.fullName.value,studentCode:inputs.studentCode.value,gradeLevel:inputs.gradeLevel.value,roomName:inputs.roomName.value,avatar}); toast('บันทึกโปรไฟล์แล้ว'); await refreshMe(); renderShell(); }
    catch(err){ setErr(pmsg,err); } psave.disabled=false; });
  /* class */
  const cmsg=errBox();
  const classBox=el('section',{class:'panel'},el('h2',{},'ห้องเรียน'));
  if(!student) classBox.append(el('p',{class:'muted'},'บัญชีครูจัดการห้องเรียนได้ที่ ',el('a',{href:'/teacher.html'},'แดชบอร์ดครู')));
  else if(P.class) classBox.append(el('p',{},'อยู่ในห้อง ',el('b',{},P.class.name),P.studentNo?` · เลขที่ ${P.studentNo}`:''),el('p',{class:'muted small'},'ครูของห้องนี้เห็นความก้าวหน้าและคะแนนของคุณ'),
    el('button',{class:'btn ghost sm',type:'button',onclick:async()=>{ if(!confirm('ออกจากห้องนี้? คะแนนของคุณยังอยู่ครบ แต่ครูของห้องนี้จะไม่เห็นอีก')) return; try{ await api('POST','/api/account/class/leave'); await refreshMe(); profilePage(); }catch(e){ setErr(cmsg,e); } }},'ออกจากห้องเรียน'),cmsg);
  else{
    const {rows:cr,inputs:ci}=formRows([{k:'code',label:'รหัสห้องเรียนจากครู',ph:'เช่น K7Q2MP',upper:true,check:v=>/^[A-Z0-9]{6}$/.test(v)?'':'รหัสห้องมี 6 ตัว'},{k:'no',label:'เลขที่ (ไม่บังคับ)',im:'numeric'}]);
    const jb=el('button',{class:'btn',type:'submit'},'เข้าร่วมห้องเรียน');
    const jf=el('form',{class:'mform',novalidate:''},el('p',{class:'muted small'},'ยังไม่ได้อยู่ในห้องเรียนใด ถ้าครูให้รหัสห้องมา กรอกที่นี่เพื่อให้ครูเห็นความก้าวหน้าของคุณ คะแนนที่ทำไว้แล้วยังอยู่ครบ'),...cr,cmsg,el('div',{class:'row'},jb));
    jf.addEventListener('submit',async e=>{ e.preventDefault(); cmsg.textContent=''; jb.disabled=true;
      try{ const r=await api('POST','/api/account/class/join',{code:ci.code.value,studentNo:ci.no.value}); toast(r.message); await refreshMe(); renderShell(); profilePage(); }
      catch(err){ setErr(cmsg,err); jb.disabled=false; } });
    classBox.append(jf);
  }
  /* sign-in methods */
  const smsg=errBox();
  const methods=el('section',{class:'panel'},el('h2',{},'วิธีเข้าสู่ระบบ'),
    el('ul',{class:'methods'},
      P.email?el('li',{},el('b',{},'อีเมล: '),P.email,' ',el('span',{class:'pill '+(P.emailVerified?'ok':'')},P.emailVerified?'ยืนยันแล้ว':'ยังไม่ยืนยัน')):el('li',{},el('b',{},'ชื่อผู้ใช้: '),P.username),
      el('li',{},el('b',{},'รหัสผ่าน: '),P.hasPassword?'ตั้งไว้แล้ว':'ยังไม่ได้ตั้ง (เข้าสู่ระบบด้วย Google)'),
      el('li',{},el('b',{},'Google: '),P.google.length?['เชื่อมแล้ว',P.google[0].email?` (${P.google[0].email})`:'']:'ยังไม่เชื่อม')),
    el('div',{class:'row'},
      el('button',{class:'btn ghost sm',type:'button',onclick:()=>passwordForm(P,methods)},P.hasPassword?'เปลี่ยนรหัสผ่าน':'ตั้งรหัสผ่าน'),
      !P.google.length&&cfg.google?googleBtn('link',cfg):null,
      P.google.length?el('button',{class:'btn ghost sm',type:'button',onclick:async()=>{ if(!confirm('ยกเลิกการเชื่อมบัญชี Google? หลังจากนี้ต้องเข้าสู่ระบบด้วยรหัสผ่าน')) return; try{ await api('POST','/api/account/google/unlink'); toast('ยกเลิกการเชื่อมแล้ว'); profilePage(); }catch(e){ setErr(smsg,e); } }},'ยกเลิกการเชื่อม Google'):null),smsg);
  /* security & data */
  const dmsg=errBox();
  const data=el('section',{class:'panel'},el('h2',{},'ความปลอดภัยและข้อมูลของฉัน'),
    el('div',{class:'row'},
      el('button',{class:'btn ghost sm',type:'button',onclick:async()=>{ if(!confirm('ออกจากระบบในทุกอุปกรณ์ รวมเครื่องนี้?')) return; try{ await api('POST','/api/auth/logout-all'); await refreshMe(); renderShell(); location.hash='#/login'; }catch(e){ setErr(dmsg,e); } }},'ออกจากระบบทุกอุปกรณ์'),
      el('a',{class:'btn ghost sm',href:'/api/account/export',download:'netlab-my-data.json'},'ดาวน์โหลดข้อมูลของฉัน (JSON)')),
    el('p',{class:'muted small'},'อ่านว่าระบบเก็บข้อมูลอะไรและใครเห็นได้ที่ ',el('a',{href:'#/privacy'},'นโยบายความเป็นส่วนตัว')),
    student?deleteBox(P):el('p',{class:'muted small'},'บัญชีครูและผู้ดูแลลบได้โดยผู้ดูแลระบบเท่านั้น'),dmsg);
  R(app,typeof crumbs==='function'?crumbs([['หน้าแรก','#/'],['โปรไฟล์ของฉัน']]):null,
    el('div',{class:'profhead'},avatarEl({avatar:P.avatar,avatarUrl:P.avatarUrl,name:P.displayName},56),el('div',{},el('h1',{},P.displayName),el('p',{class:'muted'},({student:'นักเรียน',teacher:'ครู',admin:'ผู้ดูแลระบบ'})[P.role],P.class?' · '+P.class.name:''))),
    el('div',{class:'profgrid'},el('section',{class:'panel'},el('h2',{},'ข้อมูลส่วนตัว'),pform),el('div',{},classBox,methods,data)));
  window.scrollTo(0,0);
}
function passwordForm(P,host){
  const defs=[{k:'n',label:'รหัสผ่านใหม่',type:'password',ac:'new-password',help:'อย่างน้อย 8 ตัว มีทั้งตัวอักษรและตัวเลข',check:PW_RULE},{k:'n2',label:'ยืนยันรหัสผ่านใหม่',type:'password',ac:'new-password'}];
  if(P.hasPassword) defs.unshift({k:'c',label:'รหัสผ่านเดิม',type:'password',ac:'current-password'});
  const {rows,inputs}=formRows(defs);
  const msg=el('div',{class:'msg bad'}), btn=el('button',{class:'btn',type:'submit'},'บันทึกรหัสผ่าน');
  const form=el('form',{class:'mform'},...rows,msg,el('div',{class:'row'},btn));
  const close=modal(P.hasPassword?'เปลี่ยนรหัสผ่าน':'ตั้งรหัสผ่าน',form);
  form.addEventListener('submit',async e=>{ e.preventDefault(); msg.textContent='';
    if(inputs.n.value!==inputs.n2.value){ msg.textContent='รหัสผ่านใหม่ทั้งสองช่องไม่ตรงกัน'; return; }
    btn.disabled=true;
    try{ await api('POST','/api/account/password',{current:inputs.c?inputs.c.value:'',next:inputs.n.value}); close(); toast('บันทึกรหัสผ่านแล้ว'); refreshMe(); profilePage(); }
    catch(err){ msg.textContent=err.message; btn.disabled=false; } });
}
function deleteBox(P){
  const box=el('details',{class:'danger'},el('summary',{},'ลบบัญชีของฉัน'));
  const conf=el('input',{type:'text',autocomplete:'off','aria-label':'พิมพ์คำว่า ลบบัญชี'}), pw=el('input',{type:'password',autocomplete:'current-password','aria-label':'รหัสผ่าน'});
  const msg=el('div',{class:'msg bad',role:'alert'}), btn=el('button',{class:'btn danger',type:'submit'},'ลบบัญชีถาวร');
  const f=el('form',{class:'mform'},el('p',{},'ลบบัญชีพร้อมคะแนน ความก้าวหน้า และประวัติทั้งหมดทันที กู้คืนไม่ได้ ครูจะไม่เห็นข้อมูลของคุณอีก ควรดาวน์โหลดข้อมูลเก็บไว้ก่อน'),
    el('label',{class:'mrow'},el('span',{},'พิมพ์คำว่า ลบบัญชี'),conf),P.hasPassword?el('label',{class:'mrow'},el('span',{},'รหัสผ่าน'),pw):el('p',{class:'muted small'},'บัญชี Google: ต้องเข้าสู่ระบบด้วย Google มาไม่เกิน 15 นาที'),msg,btn);
  f.addEventListener('submit',async e=>{ e.preventDefault(); msg.textContent=''; btn.disabled=true;
    try{ const r=await api('POST','/api/account/delete',{confirm:conf.value,password:pw.value}); toast(r.message); await refreshMe(); renderShell(); location.hash='#/'; }
    catch(err){ msg.textContent=err.message; btn.disabled=false; } });
  box.append(f); return box;
}

/* ---------- terms and privacy (plain language for students) ---------- */
function legalPage(kind){
  setTitle(kind==='terms'?'เงื่อนไขการใช้งาน':'นโยบายความเป็นส่วนตัว');
  const S2=(h,...p)=>el('section',{},el('h2',{},h),...p.map(t=>Array.isArray(t)?el('ul',{},t.map(x=>el('li',{},x))):el('p',{},t)));
  const body=kind==='terms'?[
    el('h1',{},'เงื่อนไขการใช้งาน NetLab'),
    S2('NetLab คืออะไร','เว็บไซต์ฝึกเรียนวิชาระบบเครือข่ายคอมพิวเตอร์ สำหรับนักเรียน นักศึกษา และครู ใช้ได้ทั้งแบบผู้เยี่ยมชม (ข้อมูลเก็บในเบราว์เซอร์) และแบบมีบัญชี (ข้อมูลเก็บบนเซิร์ฟเวอร์)'),
    S2('บัญชีของคุณ',['ใช้บัญชีของตัวเองเท่านั้น ห้ามให้ผู้อื่นทำงานหรือสอบแทน','เก็บรหัสผ่านเป็นความลับ ถ้าใช้คอมพิวเตอร์ร่วมกันให้กด "ออกจากระบบ" ทุกครั้ง','บัญชีครูได้รับจากผู้ดูแลระบบเท่านั้น นักเรียนสมัครเป็นครูเองไม่ได้']),
    S2('การใช้งานที่เหมาะสม',['ใช้เพื่อการเรียนรู้ ไม่พยายามเข้าถึงข้อมูลของผู้อื่นหรือรบกวนระบบ','คะแนนตรวจที่เซิร์ฟเวอร์ การแก้ไขคะแนนด้วยวิธีอื่นถือเป็นการทุจริต','คำสั่งและเทคนิคในห้องจำลองใช้กับอุปกรณ์ที่ได้รับอนุญาตเท่านั้น']),
    S2('การเปลี่ยนแปลง','ผู้ดูแลอาจปรับปรุงบทเรียนและระบบเพื่อการเรียนการสอน คะแนนที่บันทึกไว้แล้วจะไม่ถูกลบโดยไม่แจ้ง'),
    el('p',{class:'muted small'},'อ่านเรื่องข้อมูลส่วนบุคคลได้ที่ ',el('a',{href:'#/privacy'},'นโยบายความเป็นส่วนตัว'))]:[
    el('h1',{},'นโยบายความเป็นส่วนตัว'),
    S2('ข้อมูลที่เก็บ',['ข้อมูลบัญชี: ชื่อที่แสดง อีเมล รหัสผ่านที่เข้ารหัสแบบทางเดียว (Argon2id) และข้อมูลที่คุณเลือกกรอกเอง เช่น ชื่อ–นามสกุล รหัสนักเรียน ระดับชั้น ห้อง','ถ้าใช้ Google: รหัสประจำตัวผู้ใช้จาก Google ชื่อ อีเมลที่ Google ยืนยันแล้ว และลิงก์รูปโปรไฟล์ ระบบไม่ได้รับรหัสผ่าน Google ของคุณ','ผลการเรียน: ความก้าวหน้า คะแนนแบบทดสอบ แล็บ ฝึกทบทวนเพิ่มเติม ข้อสอบ ห้องจำลอง และวันที่เข้าเรียน']),
    S2('ใช้ข้อมูลเพื่ออะไร',['ให้คุณเรียนต่อได้ทุกอุปกรณ์ และให้ครูของห้องที่คุณเข้าร่วมติดตามผลการเรียน','ไม่ใช้เพื่อโฆษณา ไม่ขายหรือส่งต่อข้อมูลให้บุคคลอื่น']),
    S2('ใครเห็นข้อมูล',['คุณเห็นข้อมูลของตัวเองทั้งหมด','ครูเห็นเฉพาะนักเรียนในห้องที่ครูดูแล และเห็นได้เฉพาะเมื่อคุณเข้าร่วมห้องนั้น','นักเรียนคนอื่นไม่เห็นคะแนนของคุณ กระดานคะแนน (ถ้าครูเปิด) แสดงชื่อเฉพาะคนที่เลือกเปิดเผยเอง','ผู้ดูแลระบบเข้าถึงได้เพื่อดูแลระบบเท่านั้น']),
    S2('คุกกี้และการเก็บในเครื่อง','ใช้คุกกี้ที่จำเป็นสำหรับการเข้าสู่ระบบเท่านั้น (หมดอายุเมื่อปิดเบราว์เซอร์หรือภายใน 12 ชั่วโมง) โหมดผู้เยี่ยมชมเก็บความก้าวหน้าในเบราว์เซอร์ของคุณเอง'),
    S2('ระยะเวลาเก็บ',['บัญชีที่สมัครด้วยอีเมลแต่ไม่ยืนยันภายใน 7 วัน จะถูกลบอัตโนมัติ','ข้อมูลอื่นเก็บจนกว่าคุณหรือผู้ดูแลจะลบบัญชี']),
    S2('สิทธิ์ของคุณ',['ดูและแก้ไขข้อมูลส่วนตัวได้ที่หน้าโปรไฟล์','ดาวน์โหลดข้อมูลทั้งหมดของคุณเป็นไฟล์ได้','ลบบัญชีพร้อมข้อมูลทั้งหมดได้ด้วยตัวเอง (บัญชีนักเรียน)']),
    S2('ผู้เรียนที่อายุยังน้อย','ระบบขอข้อมูลเท่าที่จำเป็นต่อการเรียน ช่องข้อมูลส่วนตัวส่วนใหญ่ไม่บังคับ ถ้าคุณยังไม่บรรลุนิติภาวะ ควรแจ้งผู้ปกครองให้ทราบ และสถานศึกษาอาจมีแนวปฏิบัติเรื่องความยินยอมเพิ่มเติม'),
    S2('ติดต่อ','สอบถามหรือขอให้ลบข้อมูลได้ที่ครูผู้สอนหรือผู้ดูแลระบบของสถานศึกษา')];
  R(app,el('article',{class:'panel legal'},...body,el('p',{},el('a',{class:'btn ghost',href:ME?'#/profile':'#/register'},ME?'กลับไปที่โปรไฟล์':'กลับไปหน้าสมัครสมาชิก'))));
  window.scrollTo(0,0);
}

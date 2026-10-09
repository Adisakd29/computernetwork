'use strict';
/* NetLab app shell: routing, sidebar, dashboard, lessons (pre-test, content, lab, post-test, summary), rooms, results */

let CURRENT=null;
/* replaceChildren that skips null/false and flattens arrays */
function R(parent,...kids){ parent.replaceChildren(...kids.flat(Infinity).filter(k=>k!=null&&k!==false)); return parent; }
let LMETA=[];                 // lesson list (18)
const LCACHE={};              // full lesson content by id
const UNITS=['ความรู้เกี่ยวกับระบบเครือข่ายคอมพิวเตอร์','อุปกรณ์และสื่อนำสัญญาณ','มาตรฐานและโปรโตคอลของระบบเครือข่าย','เครือข่าย LAN แบบใช้สาย','เครือข่าย LAN แบบไร้สาย','การใช้งานเครือข่ายในระบบปฏิบัติการวินโดวส์','ระบบปฏิบัติการเครือข่าย','การออกแบบ ติดตั้ง ตรวจสอบ และแก้ปัญหาเครือข่าย','ความปลอดภัยในระบบเครือข่าย','การสร้างบัญชีผู้ใช้และการใช้งาน'];
const UNIT_COLOR=u=>['var(--orange)','var(--green)','var(--blue)','var(--brown)'][(u-1)%4];
const ICON={
  home:'<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
  book:'<path d="M4 4h6a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4zM20 4h-6a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h7z"/>',
  lab:'<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.7 3h10.6A2 2 0 0 0 19 18l-5-9V3"/>',
  chart:'<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  moon:'<path d="M21 13A9 9 0 1 1 11 3a7 7 0 0 0 10 10z"/>',
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',
  search:'<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
  user:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  sim:'<rect x="2" y="3" width="7" height="5" rx="1"/><rect x="15" y="3" width="7" height="5" rx="1"/><rect x="8.5" y="16" width="7" height="5" rx="1"/><path d="M5.5 8v4h13V8M12 12v4"/>',
  quiz:'<path d="M9 4h10v16H5V8z"/><path d="M9 4v4H5M9 13l2 2 4-4"/>',
  exam:'<circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M9 2h6"/>',
  trophy:'<path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 21h8M9 21l1-4h4l1 4"/>',
  chevl:'<path d="M15 6l-6 6 6 6"/>',
  chevr:'<path d="M9 6l6 6-6 6"/>',
  close:'<path d="M6 6l12 12M18 6L6 18"/>',
  download:'<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>',
  logo:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="8.5" y="14" width="7" height="7" rx="1.5"/><path d="M6.5 10v2h11v-2M12 12v2"/>'
};
const icon=(n,cls)=>{ const s=el('span',{class:'ic'+(cls?' '+cls:''),'aria-hidden':'true'}); s.innerHTML=`<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICON[n]}</svg>`; return s; };
const labOf=id=>ALL.find(r=>r.id===id);
const metaOf=id=>LMETA.find(l=>l.id===id);
const LP=id=>{ S.lessons=S.lessons||{}; return (S.lessons[id]=S.lessons[id]||{visited:[],checks:[]}); };

/* ---------- theme ---------- */
function applyTheme(t){ if(t) document.documentElement.setAttribute('data-theme',t); else document.documentElement.removeAttribute('data-theme'); }
const savedTheme=()=>{ try{ return localStorage.getItem('netlab-theme'); }catch(e){ return null; } };
applyTheme(savedTheme());
function isDark(){ const t=document.documentElement.getAttribute('data-theme'); return t?t==='dark':!!(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches); }
function toggleTheme(){ const t=isDark()?'light':'dark'; try{ localStorage.setItem('netlab-theme',t); }catch(e){} applyTheme(t); renderShell(); }

/* ---------- lesson progress ---------- */
function stepState(id){
  const m=metaOf(id), p=LP(id), lab=labOf(id), t=lab&&S.timers[lab.id];
  const visited=(p.visited||[]).filter(s=>m&&m.sections.some(x=>x.id===s)).length;
  const st={
    pre:p.pre?'done':'todo',
    content:m&&visited>=m.sections.length?'done':visited?'doing':'todo',
    lab:t?(t.status==='running'&&now()<t.start+t.limit?'doing':'done'):'todo',
    post:p.post?'done':'todo',
    visited, sections:m?m.sections.length:0, checks:(p.checks||[]).length, checkTotal:m?m.checks:0
  };
  st.complete=st.post==='done'&&st.lab==='done';
  st.started=st.pre==='done'||visited>0||st.lab!=='todo'||st.post==='done';
  return st;
}
function nextStep(id){
  const s=stepState(id);
  if(s.pre!=='done') return {to:'pre',label:'ทำแบบทดสอบก่อนเรียน'};
  if(s.content!=='done') return {to:'content',label:s.visited?'อ่านเนื้อหาต่อ':'เริ่มอ่านเนื้อหา'};
  if(s.lab!=='done') return {to:'lab',label:s.lab==='doing'?'ทำแล็บต่อ':'ทำแล็บท้ายคาบ'};
  if(s.post!=='done') return {to:'post',label:'ทำแบบทดสอบหลังเรียน'};
  return {to:'summary',label:'ทบทวนสรุปบทเรียน'};
}

/* ---------- shell ---------- */
function renderShell(){
  const side=document.getElementById('side'), top=document.getElementById('mtop');
  const r=location.hash||'#/';
  const link=(href,ic,txt,active)=>el('a',{class:'nav'+(active?' on':''),href,onclick:closeDrawer},icon(ic),el('span',{},txt));
  const q=el('input',{type:'search',placeholder:'ค้นหาบทเรียนหรือแล็บ','aria-label':'ค้นหาบทเรียนหรือแล็บ',value:decodeURIComponent((r.match(/^#\/search\/(.*)$/)||[])[1]||'')});
  const search=el('form',{class:'sidesearch',role:'search'},icon('search'),q);
  search.addEventListener('submit',e=>{ e.preventDefault(); if(q.value.trim()){ location.hash='#/search/'+encodeURIComponent(q.value.trim()); closeDrawer(); } });
  const units=el('div',{class:'units'},UNITS.map((u,i)=>{
    const ls=LMETA.filter(l=>l.unit===i+1);
    const open=ls.some(l=>r.startsWith('#/lesson/'+l.id+'/')||r==='#/lesson/'+l.id);
    return el('details',{class:'unit',open:open?'':null},
      el('summary',{},el('span',{class:'udot',style:`background:${UNIT_COLOR(i+1)}`}),el('span',{},`หน่วยที่ ${i+1} ${u}`)),
      ls.map(l=>{ const s=stepState(l.id); const on=r==='#/lesson/'+l.id||r.startsWith('#/lesson/'+l.id+'/');
        return el('a',{class:'lnk'+(on?' on':''),href:'#/lesson/'+l.id,onclick:closeDrawer},el('span',{class:'led '+(s.complete?'g':s.started?'a':'')}),el('span',{},`สัปดาห์ ${l.week} `,el('small',{},l.title))); }));
  }));
  const acct=ME
    ? el('div',{class:'acct'},xpChip(),el('div',{class:'who'},icon('user'),el('div',{},el('b',{},ME.name),el('small',{},ME.class?ME.class.name:({teacher:'ครู',admin:'ผู้ดูแลระบบ',student:'นักเรียน'}[ME.role])))),
        el('div',{class:'acctbtns'},(ME.role==='teacher'||ME.role==='admin')?el('a',{class:'sbtn primary',href:'/teacher.html'},'แดชบอร์ดครู'):null,
          el('button',{class:'sbtn',onclick:()=>pwModal(false)},'เปลี่ยนรหัสผ่าน'),el('button',{class:'sbtn',onclick:logout},'ออกจากระบบ')))
    : DBON?el('div',{class:'acct'},el('p',{class:'muted small'},'เข้าสู่ระบบเพื่อบันทึกคะแนนให้ครูเห็น'),el('div',{class:'acctbtns'},el('button',{class:'sbtn primary',onclick:loginModal},'เข้าสู่ระบบ'),el('button',{class:'sbtn',onclick:registerModal},'สมัครด้วยรหัสห้อง'))):null;
  R(side,
    el('div',{class:'sidetop'},
      el('a',{class:'brand',href:'#/',onclick:closeDrawer,'aria-label':'NetLab หน้าแรก'},icon('logo'),el('span',{},'NetLab'),el('small',{},'ห้องปฏิบัติการเครือข่าย')),
      el('button',{class:'railbtn',type:'button',onclick:toggleRail,'aria-label':isRail()?'ขยายเมนู':'ย่อเมนู',title:isRail()?'ขยายเมนู':'ย่อเมนู','aria-expanded':String(!isRail())},icon(isRail()?'chevr':'chevl')),
      el('button',{class:'drawerclose',type:'button',onclick:closeDrawer,'aria-label':'ปิดเมนู'},icon('close'))),
    search,
    el('nav',{'aria-label':'เมนูหลัก'},
      link('#/','home','แดชบอร์ด',r==='#/'||r===''),
      link('#/learn','book','บทเรียน 18 สัปดาห์',r==='#/learn'),
      link('#/rooms','lab','ห้องฝึก 12 ห้อง',r==='#/rooms'||r.startsWith('#/room/')),
      link('#/sims','sim','ห้องปฏิบัติการจำลอง',r==='#/sims'||r.startsWith('#/sim/')),
      link('#/practice','quiz','ฝึกทำข้อสอบ',r==='#/practice'),
      ME?link('#/exams','exam','การสอบ',r==='#/exams'||r.startsWith('#/exam/')):null,
      ME&&DBON?link('#/me','trophy','ความก้าวหน้าของฉัน',r==='#/me'):null,
      link('#/results','chart','ผลการเรียน',r==='#/results'),
      link('#/app','download','ติดตั้งแอปและออฟไลน์',r==='#/app')),
    units,
    el('button',{class:'theme',onclick:toggleTheme,'aria-label':isDark()?'โหมดสว่าง':'โหมดมืด',title:isDark()?'โหมดสว่าง':'โหมดมืด'},icon(isDark()?'sun':'moon'),el('span',{},isDark()?'โหมดสว่าง':'โหมดมืด')),
    acct,
    ME?el('a',{class:'railacct',href:'#/me',title:ME.name+' · ความก้าวหน้าของฉัน','aria-label':'ความก้าวหน้าของฉัน'},icon('user')):DBON?el('button',{class:'railacct',type:'button',onclick:loginModal,title:'เข้าสู่ระบบ','aria-label':'เข้าสู่ระบบ'},icon('user')):null);
  // rail mode: give every nav link an accessible name/tooltip
  side.querySelectorAll('.nav').forEach(a=>{ const t=a.textContent.trim(); a.title=t; a.setAttribute('aria-label',t); });
  renderBnav(r);
  R(top,
    el('button',{class:'iconbtn',id:'hamb',onclick:openDrawer,'aria-label':'เปิดเมนู','aria-controls':'side','aria-expanded':'false'},icon('menu')),
    el('a',{class:'brand',href:'#/'},icon('logo'),el('span',{},'NetLab')),
    ME?el('span',{class:'mtopuser'},ME.name):DBON?el('button',{class:'sbtn primary',onclick:loginModal},'เข้าสู่ระบบ'):el('span'));
}
function openDrawer(){
  if(document.body.classList.contains('drawer')) return closeDrawer();
  document.body.classList.add('drawer'); document.documentElement.classList.add('nl-noscroll');
  const h=document.getElementById('hamb'); if(h) h.setAttribute('aria-expanded','true');
  const c=document.querySelector('#side .drawerclose'); if(c) setTimeout(()=>c.focus({preventScroll:true}),50);
  renderBnav(location.hash||'#/');
}
function closeDrawer(){
  const was=document.body.classList.contains('drawer');
  document.body.classList.remove('drawer'); document.documentElement.classList.remove('nl-noscroll');
  const h=document.getElementById('hamb'); if(h){ h.setAttribute('aria-expanded','false'); if(was&&document.activeElement&&document.getElementById('side').contains(document.activeElement)) h.focus({preventScroll:true}); }
  if(was) renderBnav(location.hash||'#/');
}
/* bottom navigation (phones) */
function renderBnav(r){
  const nav=document.getElementById('bnav'); if(!nav) return;
  const open=document.body.classList.contains('drawer');
  const it=(href,ic,txt,on)=>el('a',{href,class:on&&!open?'on':'','aria-current':on&&!open?'page':null,onclick:closeDrawer},icon(ic),el('span',{},txt));
  R(nav,
    it('#/','home','หน้าแรก',r==='#/'||r===''),
    it('#/learn','book','บทเรียน',r==='#/learn'||r.startsWith('#/lesson/')),
    it('#/sims','sim','จำลอง',r==='#/sims'||r.startsWith('#/sim/')),
    it('#/practice','quiz','ข้อสอบ',r.startsWith('#/practice')),
    el('button',{type:'button',class:open?'on':'',onclick:openDrawer,'aria-label':open?'ปิดเมนู':'เมนูทั้งหมด','aria-expanded':String(open),'aria-controls':'side'},icon(open?'close':'menu'),el('span',{},open?'ปิด':'เมนู')));
}
/* tablet/desktop: collapsible sidebar (icon rail), remembered per device */
function isRail(){ let v=null; try{ v=localStorage.getItem('netlab-rail'); }catch(e){} return v?v==='1':window.innerWidth<1024; }
const phoneLayout=()=>window.innerWidth<760||(window.innerHeight<=500&&window.innerWidth<=1000);
function applyRail(){ document.body.classList.toggle('siderail',!phoneLayout()&&isRail()); }
function toggleRail(){ const v=!isRail(); try{ localStorage.setItem('netlab-rail',v?'1':'0'); }catch(e){} applyRail(); renderShell(); }
window.addEventListener('resize',()=>{ if(!phoneLayout()&&document.body.classList.contains('drawer')) closeDrawer(); applyRail(); });
/* hide the bottom nav while typing on phones so it does not ride on top of the keyboard */
document.addEventListener('focusin',e=>{ if(window.innerWidth<760&&e.target.matches&&e.target.matches('input:not([type=checkbox]):not([type=radio]):not([type=range]),textarea,select,[contenteditable]')) document.body.classList.add('kbd'); });
document.addEventListener('focusout',()=>setTimeout(()=>{ const a=document.activeElement; if(!a||!a.matches||!a.matches('input:not([type=checkbox]):not([type=radio]):not([type=range]),textarea,select,[contenteditable]')) document.body.classList.remove('kbd'); },60));

/* ---------- router ---------- */
async function route(){
  stopVM(); stopTick(); stopSim(); stopExam(); CURRENT=null; closeDrawer();
  const h=location.hash||'#/';
  renderShell();
  if(ME&&DBON&&h!=='#/me'&&h!=='#/'&&h!=='') loadGame();   // refreshes the sidebar chip and announces new badges (cached 60 s)
  let m;
  try{
    if(h==='#/'||h==='') return await dashboard();
    if(h==='#/learn') return await lessonsPage();
    if(h==='#/rooms') return await roomsPage();
    if(h==='#/results') return await resultsPage();
    if(h==='#/sims') return await simsPage();
    if(h==='#/practice') return await practicePage();
    if((m=h.match(/^#\/practice\/u(\d+)$/))) return await practicePage(+m[1]);
    if(h==='#/me') return await progressPage();
    if(h==='#/app') return await appPage();
    if(h==='#/exams') return await examsPage();
    if((m=h.match(/^#\/sim\/(\w+)$/))) return await simPage(m[1]);
    if((m=h.match(/^#\/exam\/(\d+)$/))) return await examPage(+m[1]);
    if((m=h.match(/^#\/search\/(.*)$/))) return await searchPage(decodeURIComponent(m[1]));
    if((m=h.match(/^#\/room\/(r\d+)$/))){ const ri=ALL.findIndex(r=>r.id===m[1]); if(ri>=0){ openRoom(ri); return; } }
    if((m=h.match(/^#\/lesson\/(w\d+)(?:\/(pre|content|lab|post|summary))?(?:\/(s\w+))?$/))) return await lessonPage(m[1],m[2]||'overview',m[3]);
  }catch(e){
    if(e.offline){ R(app,el('div',{class:'panel'},el('h1',{},'ต้องเชื่อมต่ออินเทอร์เน็ต'),el('p',{},'หน้านี้ใช้ข้อมูลจากเซิร์ฟเวอร์ ตอนนี้อ่านบทเรียนที่เคยเปิดไว้ได้ระหว่างออฟไลน์'),el('div',{class:'row'},el('a',{class:'btn',href:'#/learn'},'ไปที่บทเรียน'),el('a',{class:'btn ghost',href:'#/app'},'ส่วนที่ใช้ออฟไลน์ได้')))); return; }
    console.error(e); R(app,el('div',{class:'panel'},el('p',{},'เปิดหน้านี้ไม่สำเร็จ: '+e.message),el('a',{class:'btn',href:'#/'},'กลับแดชบอร์ด'))); return; }
  R(app,el('div',{class:'panel'},el('h1',{},'ไม่พบหน้านี้'),el('a',{class:'btn',href:'#/'},'กลับแดชบอร์ด')));
}
window.addEventListener('hashchange',route);
const setTitle=t=>{ document.title=t?`${t} · NetLab`:'NetLab ห้องปฏิบัติการเครือข่ายคอมพิวเตอร์'; };

/* ---------- dashboard ---------- */
function ledStrip(){
  const done=LMETA.filter(l=>stepState(l.id).complete).length;
  const tester=el('div',{class:'tester',role:'list','aria-label':'ความคืบหน้า 18 สัปดาห์'},
    LMETA.map(l=>{ const s=stepState(l.id);
      return el('a',{class:'tled '+(s.complete?'g':s.started?'a':''),href:'#/lesson/'+l.id,role:'listitem',title:`สัปดาห์ ${l.week}: ${l.title} (${s.complete?'เรียนจบแล้ว':s.started?'กำลังเรียน':'ยังไม่เริ่ม'})`},
        el('i',{}),el('span',{},l.week)); }));
  return el('section',{class:'hero'},
    el('div',{class:'herotext'},el('h1',{},ME?`สวัสดี ${ME.name.split(' ')[0]}`:'ห้องปฏิบัติการเครือข่ายคอมพิวเตอร์'),
      el('p',{},`เรียนจบแล้ว ${done} จาก ${LMETA.length} สัปดาห์ ไฟแต่ละดวงคือหนึ่งสัปดาห์ เขียวคือเรียนจบ เหลืองคือกำลังเรียน`)),
    el('div',{class:'testerbox'},tester,el('div',{class:'testerlbl'},el('span',{},'LAN TESTER'),el('span',{},`${done}/${LMETA.length}`))));
}
function continueCard(){
  let target=LMETA.find(l=>{ const s=stepState(l.id); return s.started&&!s.complete; })||LMETA.find(l=>!stepState(l.id).complete);
  const asg=ME&&ASSIGN.filter(a=>a.labId.startsWith('w')&&!(S.timers[a.labId]&&S.timers[a.labId].status!=='running')).sort((a,b)=>(a.due||9e15)-(b.due||9e15))[0];
  if(asg) target=metaOf(asg.labId)||target;
  if(!target) return el('section',{class:'panel'},el('h2',{},'เรียนครบทุกสัปดาห์แล้ว'),el('p',{},'ทบทวนได้จากรายการบทเรียน หรือฝึกเพิ่มในห้องฝึก 12 ห้อง'));
  const n=nextStep(target.id), s=stepState(target.id);
  return el('section',{class:'cont',style:`--uc:${UNIT_COLOR(target.unit)}`},
    el('div',{},el('p',{class:'contk'},asg?'งานที่ครูมอบหมาย':(s.started?'เรียนต่อจากครั้งก่อน':'บทเรียนถัดไป')),
      el('h2',{},`สัปดาห์ ${target.week} ${target.title}`),
      el('p',{class:'muted'},`หน่วยที่ ${target.unit} ${UNITS[target.unit-1]}`),
      asg&&asg.due?el('p',{class:'duehint'},'ครูกำหนดส่งแล็บภายใน '+fmtDate(asg.due)):null,
      miniRail(target.id)),
    (()=>{ const ls=n.to==='content'&&lastOf(target.id); const sec=ls&&target.sections.find(x=>x.id===ls);
      return el('div',{class:'contbtns'},el('a',{class:'btn big',href:`#/lesson/${target.id}/${n.to}`+(sec?'/'+sec.id:'')},sec?'เรียนต่อ':n.label),
        sec?el('small',{class:'muted'},'จากหัวข้อ: '+sec.title):null); })());
}
function miniRail(id){
  const s=stepState(id);
  const seg=(k,txt)=>el('span',{class:'seg '+s[k]},txt);
  return el('div',{class:'minirail','aria-label':'ขั้นตอนบทเรียน'},seg('pre','ก่อนเรียน'),seg('content','เนื้อหา'),seg('lab','แล็บ'),seg('post','หลังเรียน'));
}
function guestBanner(where){
  if(ME) return null;
  let hid=false; try{ hid=sessionStorage.getItem('netlab-gb-'+where)==='1'; }catch(e){}
  if(hid) return null;
  const box=el('section',{class:'guestbar',role:'note','aria-label':'คำเตือนโหมดผู้เยี่ยมชม'},
    el('div',{class:'gbtext'},el('b',{},'โหมดผู้เยี่ยมชม: คะแนนเก็บเฉพาะในเบราว์เซอร์นี้'),
      el('span',{},DBON?'ถ้าล้างประวัติเว็บ เปลี่ยนเครื่อง หรือใช้โหมดไม่ระบุตัวตน งานจะหาย และครูไม่เห็นคะแนน เข้าสู่ระบบหรือสมัครด้วยรหัสห้อง แล้วผูกงานที่ทำไว้เข้าบัญชีได้':'ถ้าล้างประวัติเว็บหรือเปลี่ยนเครื่อง งานจะหาย ถ่ายภาพหน้าผลการเรียนส่งครู')),
    el('div',{class:'gbbtns'},DBON?el('button',{class:'sbtn primary',type:'button',onclick:loginModal},'เข้าสู่ระบบ'):null,DBON?el('button',{class:'sbtn',type:'button',onclick:registerModal},'สมัครด้วยรหัสห้อง'):null,
      el('button',{class:'sbtn',type:'button','aria-label':'ซ่อนคำเตือนนี้',onclick:()=>{ try{ sessionStorage.setItem('netlab-gb-'+where,'1'); }catch(e){} box.remove(); }},'ซ่อน')));
  return box;
}
function nameBox(){
  if(ME) return null;
  return el('section',{class:'panel namebox'},
    el('label',{for:'nm'},'ชื่อ–ชั้น–เลขที่'),
    el('input',{id:'nm',placeholder:'เช่น สมชาย ใจดี ปวช.2/1 เลขที่ 5',value:S.name,oninput:e=>{S.name=e.target.value;save();}}),
    el('p',{class:'muted small'},'ชื่อนี้ใช้แสดงในหน้าผลการเรียนสำหรับถ่ายภาพส่งครู'));
}
function assignPanel(){
  if(!ME||!ASSIGN.length) return null;
  return el('section',{class:'panel'},el('h2',{},'งานที่ครูมอบหมาย'),el('ul',{class:'asglist'},ASSIGN.map(a=>{ const r=labOf(a.labId); if(!r) return null;
    const t=S.timers[r.id]; const done=t&&t.status!=='running'; const over=a.due&&now()>a.due&&!done;
    return el('li',{},el('a',{class:'asg'+(done?' done':'')+(over?' over':''),href:r.exit?`#/lesson/${r.id}/lab`:`#/room/${r.id}`},
      el('span',{class:'asg-t'},r.label+' '+r.title),el('span',{class:'asg-d'},done?'ส่งแล้ว':a.due?(over?'เลยกำหนด ':'ส่งภายใน ')+fmtDate(a.due):'ไม่มีกำหนดส่ง'))); })));
}
function unitList(filter){
  return el('div',{class:'unitlist'},UNITS.map((u,i)=>{
    const ls=LMETA.filter(l=>l.unit===i+1&&(!filter||filter(l))); if(!ls.length) return null;
    return el('section',{class:'ublock',style:`--uc:${UNIT_COLOR(i+1)}`},
      el('h2',{},el('span',{class:'unum'},i+1),UNITS[i]),
      el('ul',{},ls.map(l=>{ const s=stepState(l.id); const due=dueOf(l.id);
        return el('li',{},el('a',{class:'lrow',href:'#/lesson/'+l.id},
          el('span',{class:'lweek'},'สัปดาห์ '+l.week),
          el('span',{class:'ltitle'},l.title,due&&due.due?el('small',{class:'due'},' · ส่งแล็บ '+fmtDate(due.due)):null),
          miniRail(l.id))); })));
  }));
}
function toolCards(){
  const c=(href,ic,t,d)=>el('a',{class:'tool',href},icon(ic),el('div',{},el('b',{},t),el('small',{},d)));
  return el('section',{class:'tools','aria-label':'เครื่องมือฝึก'},
    c('#/sims','sim','ห้องปฏิบัติการจำลอง','ต่อเครือข่าย คำนวณ Subnet เข้าหัว RJ-45 ใช้คำสั่ง และแก้ปัญหา'),
    c('#/practice','quiz','ฝึกทำข้อสอบ','คลังข้อสอบ 10 รูปแบบ รู้ผลทันทีพร้อมคำอธิบาย'),
    ME?c('#/exams','exam','การสอบ','การสอบที่ครูเปิดให้ห้องของคุณ'):null);
}
function dashboard(){
  setTitle('');
  R(app,guestBanner('home'),ledStrip(),nameBox(),gameStrip(),continueCard(),assignPanel(),toolCards(),el('h2',{class:'sech'},'บทเรียนทั้งหมด'),unitList());
  window.scrollTo(0,0);
}
function lessonsPage(){
  setTitle('บทเรียน 18 สัปดาห์');
  R(app,el('h1',{},'บทเรียน 18 สัปดาห์'),el('p',{class:'lede'},'แต่ละสัปดาห์มีแบบทดสอบก่อนเรียน เนื้อหาพร้อมแบบฝึกหัด แล็บท้ายคาบ และแบบทดสอบหลังเรียน ตามแผนการจัดการเรียนรู้วิชาระบบเครือข่ายคอมพิวเตอร์'),unitList());
  window.scrollTo(0,0);
}

/* ---------- rooms (12 practice rooms) ---------- */
function statusText(r){
  const t=S.timers[r.id];
  if(!t) return `${r.minutes} นาที`;
  if(t.status==='running') return now()>=t.start+t.limit?'หมดเวลา':'กำลังทำ';
  return t.status==='timeout'?'หมดเวลา':'ส่งแล้ว';
}
function roomCard(r){
  const d=roomDone(r), full=d===r.tasks.length;
  return el('li',{},el('a',{class:'room'+(full?' done':''),href:r.exit?`#/lesson/${r.id}/lab`:`#/room/${r.id}`},
    el('div',{class:'strip',style:`background:${r.color}`}),
    el('div',{class:'body'},el('div',{class:'num'},r.label,r.challengeRoom?el('span',{class:'tag'},'ห้องท้าทาย'):null,r.terminal?el('span',{class:'tag'},'เทอร์มินัล'):null,r.vmTasks?el('span',{class:'tag vm'},'Linux VM'):null),el('h2',{},r.title),r.blurb&&!r.exit?el('p',{},r.blurb):null),
    el('div',{class:'stat'},el('b',{},full?'✓':`${d}/${r.tasks.length}`),full?'ผ่านแล้ว':'ข้อ',el('span',{class:'tstat'},statusText(r)))));
}
function roomsPage(){
  setTitle('ห้องฝึก 12 ห้อง');
  const lt=ROOMS.reduce((a,r)=>a+r.tasks.length,0), ld=ROOMS.reduce((a,r)=>a+roomDone(r),0);
  R(app,el('h1',{},'ห้องฝึก 12 ห้อง'),
    el('p',{class:'lede'},'ห้องฝึกเพิ่มเติมตามหนังสือเรียนสองเล่ม ใช้ทบทวนก่อนสอบ ข้อที่มีป้ายท้าทายมาจากเล่มที่สอง'),
    el('div',{class:'progress'},el('span',{},`ทำแล้ว ${ld} จาก ${lt} ข้อ`),el('strong',{},listScore(ROOMS)+' / '+listMax(ROOMS)+' คะแนน')),
    el('div',{class:'bar'},el('i',{style:`width:${lt?Math.round(ld/lt*100):0}%`})),
    el('ul',{class:'rooms'},ROOMS.map(roomCard)));
  window.scrollTo(0,0);
}

/* ---------- search ---------- */
const SYN=[['subnet','ซับเน็ต','ซับเน็ท','เครือข่ายย่อย'],['firewall','ไฟร์วอลล์','ไฟวอล'],['router','เราเตอร์'],['switch','สวิตช์','สวิทช์'],['wifi','wi-fi','ไวไฟ','ไร้สาย','wireless'],
  ['ip','ไอพี','ip address'],['dns','ดีเอ็นเอส'],['dhcp','ดีเอชซีพี'],['osi','โอเอสไอ'],['tcp','ทีซีพี'],['utp','สายแลน','สาย lan','สายยูทีพี'],['rj-45','rj45','หัวแลน'],['topology','โทโพโลยี','โทโปโลยี'],
  ['lan','แลน'],['wan','แวน'],['ping','ปิง'],['vlan','วีแลน'],['ipv6','ไอพีวี6'],['share','แชร์','แบ่งปัน'],['user','ผู้ใช้','บัญชี','account'],['password','รหัสผ่าน'],['vm','virtual machine','เครื่องเสมือน'],['linux','ลินุกซ์'],['windows','วินโดวส์']];
function searchTerms(q){ const n=q.toLowerCase().trim(); const out=new Set([n]); SYN.forEach(g=>{ if(g.some(w=>n.includes(w)||w.includes(n)&&n.length>=3)) g.forEach(w=>out.add(w)); }); return [...out].filter(Boolean); }
function searchPage(q){
  setTitle('ค้นหา');
  const n=q.toLowerCase(), terms=searchTerms(q);
  const hit=t=>terms.some(w=>t.includes(w));
  const ls=LMETA.filter(l=>hit((l.title+' '+l.keywords.join(' ')+' '+l.text).toLowerCase()));
  const labs=ALL.filter(r=>hit((r.title+' '+r.label+' '+r.tasks.map(t=>t.q).join(' ')).toLowerCase()));
  R(app,el('h1',{},`ผลการค้นหา "${q}"`),terms.length>1?el('p',{class:'muted small'},'ค้นหารวมคำที่เกี่ยวข้อง: '+terms.slice(1,7).join(', ')):null,
    !ls.length&&!labs.length?el('div',{class:'panel'},el('p',{},'ไม่พบบทเรียนหรือแล็บที่ตรงกับคำค้น ลองใช้คำสั้นลง เช่น "Wi-Fi", "IP", "Firewall"')):null,
    ls.length?[el('h2',{class:'sech'},`บทเรียน (${ls.length})`),el('ul',{class:'reslist'},ls.map(l=>el('li',{},el('a',{href:'#/lesson/'+l.id},el('b',{},`สัปดาห์ ${l.week} ${l.title}`),el('small',{},l.sections.map(s=>s.title.replace(/^\d+\.\s*/,'')).filter(t=>hit(t.toLowerCase())).slice(0,3).join(' · ')||l.keywords.slice(0,5).join(', '))))))]:null,
    labs.length?[el('h2',{class:'sech'},`แล็บและห้องฝึก (${labs.length})`),el('ul',{class:'rooms'},labs.map(roomCard))]:null);
  window.scrollTo(0,0);
}

/* ---------- lesson pages ---------- */
async function getLesson(id){
  if(LCACHE[id]) return LCACHE[id];
  R(app,el('p',{class:'loading'},'กำลังโหลดบทเรียน...'));
  const L=await api('GET','/api/lessons/'+id);
  if(!L.offlineCopy) LCACHE[id]=L;      // offline copies have no tests; fetch again when back online
  return L;
}
function lessonRail(id,active){
  const m=metaOf(id), s=stepState(id);
  const step=(key,n,label,sub,state)=>el('a',{class:'rstep '+state+(active===key?' on':''),href:`#/lesson/${id}/${key}`,'aria-current':active===key?'step':null},
    el('span',{class:'rn'},state==='done'?'✓':n),el('span',{class:'rl'},label,el('small',{},sub)));
  return el('div',{class:'lhead',style:`--uc:${UNIT_COLOR(m.unit)}`},
    el('a',{class:'lcrumb',href:'#/lesson/'+id},`สัปดาห์ ${m.week} · หน่วยที่ ${m.unit} ${UNITS[m.unit-1]}`),
    el('h1',{},m.title),
    el('nav',{class:'rail','aria-label':'ขั้นตอนบทเรียน'},
      step('pre',1,'ก่อนเรียน',s.pre==='done'?`${LP(id).pre.score}/${LP(id).pre.max}`:'10 ข้อ',s.pre),
      step('content',2,'เนื้อหา',`${s.visited}/${s.sections} หัวข้อ`,s.content),
      step('lab',3,'แล็บท้ายคาบ',labOf(id)?`${labOf(id).minutes} นาที`:'',s.lab),
      step('post',4,'หลังเรียน',s.post==='done'?`${LP(id).post.score}/${LP(id).post.max}`:'10 ข้อ',s.post),
      step('summary',5,'สรุป','ทบทวน',s.complete?'done':'todo')));
}
async function lessonPage(id,tab,sec){
  if(!metaOf(id)) throw new Error('ไม่พบบทเรียน');
  setTitle(`สัปดาห์ ${metaOf(id).week}`);
  if(tab==='lab'){ const ri=ALL.findIndex(r=>r.id===id); openRoom(ri); return; }
  const L=await getLesson(id);
  if((location.hash||'').indexOf(id)<0) return; // navigated away while loading
  if(tab==='overview') return lessonOverview(L);
  if((tab==='pre'||tab==='post')&&!L.quiz){ R(app,lessonRail(L.id,tab),el('div',{class:'panel'},el('h2',{},'ต้องเชื่อมต่ออินเทอร์เน็ต'),el('p',{},'แบบทดสอบก่อนและหลังเรียนตรวจที่เซิร์ฟเวอร์ และไม่เก็บไว้ในเครื่อง เชื่อมต่ออินเทอร์เน็ตแล้วเปิดหน้านี้อีกครั้ง'),el('a',{class:'btn',href:`#/lesson/${L.id}/content`},'อ่านเนื้อหาระหว่างรอ'))); return; }
  if(tab==='pre'||tab==='post') return quizPage(L,tab);
  if(tab==='content') return contentPage(L,sec);
  if(tab==='summary') return summaryPage(L);
}
function lessonOverview(L){
  const s=stepState(L.id), n=nextStep(L.id), due=dueOf(L.id);
  R(app,lessonRail(L.id,'overview'),
    el('div',{class:'ovgrid'},
      el('section',{class:'panel'},el('h2',{},'จุดประสงค์การเรียนรู้'),el('ul',{class:'checklist'},L.objectives.map(o=>el('li',{},o)))),
      el('section',{class:'panel'},el('h2',{},'สมรรถนะที่คาดหวัง'),el('p',{},L.competency),
        el('h2',{},'ในบทนี้'),el('ol',{class:'toc'},L.sections.map(x=>el('li',{},x.title.replace(/^\d+\.\s*/,'')))),
        el('p',{class:'muted small'},`อ่านเนื้อหาประมาณ ${L.minutes} นาที · แบบฝึกหัดระหว่างเรียน ${metaOf(L.id).checks} ข้อ`))),
    due&&due.due?el('p',{class:'duehint'},'ครูกำหนดส่งแล็บท้ายคาบภายใน '+fmtDate(due.due)):null,
    el('div',{class:'row'},el('a',{class:'btn big',href:`#/lesson/${L.id}/${n.to}`},n.label),
      s.pre!=='done'?el('a',{class:'btn ghost',href:`#/lesson/${L.id}/content`},'ข้ามไปอ่านเนื้อหา'):null));
  window.scrollTo(0,0);
}

/* question widget shared by quiz and in-lesson checks; returns {node,get(),set(v),lock()} */
function questionInput(q,key,onChange){
  const name='q'+Math.random().toString(36).slice(2,8);
  const box=el('div',{class:'qin'});
  let get=()=>null, set=()=>{}, lock=()=>{};
  if(q.type==='choice'||q.type==='multi'){
    const order=seededOrder(q.options.length,SEED+key);
    const inputs=[];
    order.forEach(oi=>{
      const inp=el('input',{type:q.type==='multi'?'checkbox':'radio',name,value:String(oi)});
      inp.addEventListener('change',()=>onChange&&onChange());
      inputs.push(inp);
      box.append(el('label',{class:'opt'},inp,el('span',{},q.options[oi])));
    });
    if(q.type==='multi') box.prepend(el('p',{class:'muted small'},'เลือกได้มากกว่า 1 ข้อ'));
    get=()=>q.type==='multi'?inputs.filter(i=>i.checked).map(i=>+i.value):(inputs.find(i=>i.checked)?+inputs.find(i=>i.checked).value:null);
    set=v=>inputs.forEach(i=>{ i.checked=q.type==='multi'?Array.isArray(v)&&v.includes(+i.value):v===+i.value; });
    lock=()=>inputs.forEach(i=>i.disabled=true);
  }else if(q.type==='tf'){
    const a=el('input',{type:'radio',name,value:'true'}), b=el('input',{type:'radio',name,value:'false'});
    [a,b].forEach(i=>i.addEventListener('change',()=>onChange&&onChange()));
    box.append(el('div',{class:'tfrow'},el('label',{class:'opt'},a,el('span',{},'ถูก')),el('label',{class:'opt'},b,el('span',{},'ผิด'))));
    get=()=>a.checked?true:b.checked?false:null;
    set=v=>{ a.checked=v===true; b.checked=v===false; };
    lock=()=>{ a.disabled=b.disabled=true; };
  }else{
    const inp=el('input',{type:'text',class:'qtext-in',placeholder:'พิมพ์คำตอบ',autocomplete:'off',autocapitalize:'off',spellcheck:'false','aria-label':'คำตอบ'});
    inp.addEventListener('input',()=>onChange&&onChange());
    box.append(inp);
    get=()=>inp.value.trim()?inp.value:null;
    set=v=>{ inp.value=v||''; };
    lock=()=>{ inp.disabled=true; };
  }
  return {node:box,get,set,lock};
}
const LEVEL={easy:'ง่าย',medium:'ปานกลาง',hard:'ยาก'};

function quizPage(L,kind){
  const p=LP(L.id), done=p[kind];
  const wrap=el('div',{});
  R(app,lessonRail(L.id,kind),el('div',{class:'ltools'},fontBar()),wrap);
  if(done){ wrap.append(quizResult(L,kind)); window.scrollTo(0,0); return; }
  if(kind==='pre'&&p.post){ wrap.append(el('div',{class:'panel'},el('p',{},'ทำแบบทดสอบหลังเรียนไปแล้ว จึงไม่ต้องทำแบบทดสอบก่อนเรียน'))); return; }
  const dk='quiz:'+L.id+':'+kind, draft=getDrafts()[dk]||[];
  const QS=kind==='post'&&L.quizPost?L.quizPost:L.quiz;   // post-test = parallel form B (same objectives, different items)
  const items=QS.map((q,i)=>{
    const qi=questionInput(q,q.key,()=>{ setDraft(dk,items.map(x=>x.get())); upd(); });
    if(draft[i]!=null) qi.set(draft[i]);
    return Object.assign(qi,{q});
  });
  const counter=el('span',{});
  const send=el('button',{class:'btn big',onclick:submitQuiz},kind==='pre'?'ส่งแบบทดสอบก่อนเรียน':'ส่งแบบทดสอบหลังเรียน');
  const msg=el('div',{class:'msg bad'});
  function upd(){ const n=items.filter(x=>x.get()!=null&&!(Array.isArray(x.get())&&!x.get().length)).length; counter.textContent=`ตอบแล้ว ${n} จาก ${items.length} ข้อ`; send.disabled=n<items.length; }
  async function submitQuiz(){
    if(!confirm(kind==='pre'?'ส่งแบบทดสอบก่อนเรียน? ส่งได้ครั้งเดียว':'ส่งแบบทดสอบหลังเรียน? ส่งได้ครั้งเดียว และจะเห็นเฉลยหลังส่ง')) return;
    send.disabled=true; msg.textContent='';
    try{
      const res=await api('POST',`/api/lessons/${L.id}/quiz`,{kind,answers:items.map(x=>x.get())});
      p[kind]={score:res.score,max:res.max,at:res.at,review:res.review}; save(); setDraft(dk,null);
      quizPage(L,kind);
    }catch(e){
      if(e.code==='done'||e.code==='post_done'){ await refreshMe(); quizPage(L,kind); return; }
      msg.textContent=e.offline?'ส่งไม่ได้เพราะออฟไลน์ คำตอบถูกบันทึกเป็นร่างไว้แล้ว เชื่อมต่ออินเทอร์เน็ตแล้วกดส่งอีกครั้ง':e.message; send.disabled=false;
    }
  }
  wrap.append(
    el('section',{class:'panel quizintro'},
      el('h2',{},kind==='pre'?'แบบทดสอบก่อนเรียน':'แบบทดสอบหลังเรียน'),
      el('p',{},kind==='pre'
        ?'วัดความรู้เดิมก่อนเริ่มเรียน 10 ข้อ ไม่จับเวลา ตอบตามที่รู้จริงโดยไม่ต้องเปิดหาคำตอบ ระบบจะบอกคะแนนแต่ยังไม่เฉลย แบบทดสอบหลังเรียนเป็นข้อสอบคู่ขนาน วัดจุดประสงค์เดียวกันแต่เป็นคนละข้อ จึงเทียบพัฒนาการได้'
        :'แบบทดสอบชุดเดียวกับก่อนเรียน 10 ข้อ ใช้วัดว่าเรียนแล้วเข้าใจมากขึ้นแค่ไหน ส่งได้ครั้งเดียว หลังส่งจะเห็นเฉลยพร้อมคำอธิบายทุกข้อ'),
      kind==='post'&&stepState(L.id).lab==='todo'?el('p',{class:'duehint'},'ยังไม่ได้ทำแล็บท้ายคาบ แนะนำให้ทำแล็บก่อน'):null,
      el('p',{class:'muted small'},'คำตอบที่เลือกไว้ถูกบันทึกเป็นร่างอัตโนมัติ ปิดหน้าเว็บแล้วกลับมาทำต่อได้')),
    el('ol',{class:'quiz'},items.map((x,i)=>el('li',{class:'qcard'},
      el('div',{class:'qhead'},el('span',{class:'qno'},i+1),el('span',{class:'lvl '+x.q.level},LEVEL[x.q.level]||'')),
      el('p',{class:'qq'},x.q.q),x.node))),
    el('div',{class:'quizbar'},counter,send),msg);
  upd(); window.scrollTo(0,0);
}
function quizResult(L,kind){
  const p=LP(L.id), r=p[kind];
  const out=el('section',{class:'panel'});
  const pct=Math.round(r.score/r.max*100);
  out.append(el('h2',{},kind==='pre'?'ผลแบบทดสอบก่อนเรียน':'ผลแบบทดสอบหลังเรียน'),
    el('div',{class:'scorebig'},el('b',{},`${r.score}/${r.max}`),el('span',{},`${pct}%`)));
  if(kind==='pre'){
    out.append(el('p',{},'ระบบจะเฉลยหลังทำแบบทดสอบหลังเรียน (ข้อสอบคู่ขนาน วัดจุดประสงค์เดียวกัน) ต่อไปให้อ่านเนื้อหาและทำแบบฝึกหัดระหว่างเรียน'),
      el('a',{class:'btn big',href:`#/lesson/${L.id}/content`},'เริ่มอ่านเนื้อหา'));
    return out;
  }
  if(p.pre){ const g=r.score-p.pre.score;
    out.append(el('div',{class:'compare'},
      el('div',{},el('small',{},'ก่อนเรียน'),el('b',{},`${p.pre.score}/${p.pre.max}`)),
      el('div',{class:'arrowr','aria-hidden':'true'},'›'),
      el('div',{},el('small',{},'หลังเรียน'),el('b',{},`${r.score}/${r.max}`)),
      el('div',{class:'gain '+(g>0?'up':g<0?'down':'')},el('small',{},'พัฒนาการ'),el('b',{},(g>0?'+':'')+g)))); }
  if(Array.isArray(r.review)){
    const QS=kind==='post'&&L.quizPost?L.quizPost:L.quiz;
    out.append(el('h3',{},'เฉลยและคำอธิบาย'),el('ol',{class:'review'},r.review.map((v,i)=>{ v=v||{};
      return el('li',{class:v.correct?'ok':'bad'},el('p',{class:'qq'},v.q||(QS[i]&&QS[i].q)||''),
        el('p',{class:'ans'},el('b',{},v.correct?'ตอบถูก':'ตอบผิด'),v.given?` · คุณตอบ: ${v.given}`:''),
        v.correct?null:el('p',{class:'ans right'},'คำตอบที่ถูก: ',el('b',{},v.answer||'')),
        !v.correct&&v.why?el('p',{class:'why'},'ทำไมคำตอบที่เลือกจึงผิด: '+v.why):null,
        el('p',{class:'explain'},v.explain||'')); })));
  }
  out.append(el('div',{class:'row'},el('a',{class:'btn',href:`#/lesson/${L.id}/summary`},'ไปที่สรุปบทเรียน')));
  return out;
}

/* content */
function renderBlock(L,b){
  switch(b.type){
    case 'p': return el('p',{},b.text);
    case 'list': return el('ul',{class:'blist'},b.items.map(t=>el('li',{},t)));
    case 'steps': return el('ol',{class:'bsteps'},b.items.map(t=>el('li',{},t)));
    case 'table': return el('div',{class:'tablewrap'},el('table',{class:'btable'},el('thead',{},el('tr',{},b.head.map(h=>el('th',{},h)))),el('tbody',{},b.rows.map(r=>el('tr',{},r.map(c=>el('td',{},c)))))));
    case 'term': return el('dl',{class:'kterm'},el('dt',{},b.term),el('dd',{},b.text));
    case 'diagram': { const f=el('figure',{class:'dgm'}); const d=el('div',{class:'dgmsvg'}); d.innerHTML=(window.NL_DIAGRAMS||{})[b.name]||''; f.append(d); if(b.caption) f.append(el('figcaption',{},b.caption)); return f; }
    case 'widget': { const f=el('figure',{class:'wdg'}); const d=el('div',{}); f.append(el('div',{class:'wdglbl'},'สื่อ Interactive'),d); if(b.caption) f.append(el('figcaption',{},b.caption));
      try{ (window.NL_WIDGETS||{})[b.name](d); }catch(e){ d.textContent='โหลดสื่อนี้ไม่สำเร็จ'; } return f; }
    case 'example': return el('aside',{class:'example'},el('h4',{},b.title||'ตัวอย่างการใช้งานจริง'),el('p',{},b.text));
    case 'note': return el('aside',{class:'note '+(b.kind==='warn'?'warn':'tip')},el('b',{},b.kind==='warn'?'ข้อควรระวัง':'เกร็ดความรู้'),el('p',{},b.text));
    case 'check': return checkBlock(L,b);
    default: return null;
  }
}
function checkBlock(L,b){
  const p=LP(L.id); const idx=+b.key.split(':').pop();
  const solved=(p.checks||[]).includes(idx);
  const card=el('div',{class:'check'+(solved?' solved':'')});
  const msg=el('div',{class:'msg','aria-live':'polite'},solved?'ทำแบบฝึกหัดข้อนี้ถูกแล้ว':'');
  const dk='chk:'+b.key;   // answers being typed/selected are kept as a draft until checked correct
  const qi=questionInput(b.q,b.key,()=>{ if(!solved) setDraft(dk,qi.get()); });
  if(!solved){ const d=getDrafts()[dk]; if(d!=null) try{ qi.set(d); }catch(e){} }
  const btn=el('button',{class:'btn',onclick:async()=>{
    const v=qi.get(); if(v==null||(Array.isArray(v)&&!v.length)){ msg.className='msg bad'; msg.textContent='เลือกหรือพิมพ์คำตอบก่อน'; return; }
    btn.disabled=true; msg.className='msg wait'; msg.textContent='กำลังตรวจ...';
    try{
      const res=await api('POST',`/api/lessons/${L.id}/check`,{key:b.key,answer:v});
      if(res.correct){
        msg.className='msg ok'; msg.textContent='ถูกต้อง';
        card.classList.add('solved'); qi.lock();
        setDraft(dk,null);
        if(!(p.checks||[]).includes(idx)){ p.checks=(p.checks||[]).concat(idx); if(!ME){ p.checkAns=p.checkAns||{}; p.checkAns[idx]=v; } save(); }
        card.append(el('p',{class:'explain'},res.explain||''));
      }else{
        msg.className='msg bad'; msg.textContent='ยังไม่ถูก'+(res.why?` เพราะ${res.why.replace(/^เพราะ/,'')}`:'')+' ลองอ่านเนื้อหาด้านบนอีกครั้งแล้วตอบใหม่';
        btn.disabled=false;
      }
    }catch(e){ msg.className='msg bad'; msg.textContent=e.offline?'ต้องเชื่อมต่ออินเทอร์เน็ตเพื่อตรวจคำตอบ':e.message; btn.disabled=false; }
  }},'ตรวจคำตอบ');
  if(solved){ btn.disabled=true; qi.lock(); }
  card.append(el('div',{class:'checklbl'},'แบบฝึกหัดระหว่างเรียน',el('span',{class:'lvl '+b.q.level},LEVEL[b.q.level]||'')),el('p',{class:'qq'},b.q.q),qi.node,el('div',{class:'row'},btn),msg);
  return card;
}
/* reading position: remembered per lesson in this browser and (when logged in) on the server */
const LASTK='netlab-last';
function getLast(){ try{ return JSON.parse(localStorage.getItem(LASTK)||'{}'); }catch(e){ return {}; } }
function setLast(lid,sid){ const d=getLast(); d[lid]={s:sid,at:Date.now()}; d._recent={l:lid,s:sid,at:Date.now()}; try{ localStorage.setItem(LASTK,JSON.stringify(d)); }catch(e){} }
const lastOf=lid=>{ const p=LP(lid), loc=getLast()[lid]; return (loc&&loc.s)||p.last||null; };
function fontBar(){
  const cur=()=>+(document.documentElement.dataset.fs||1);
  const set=v=>{ v=Math.max(0.9,Math.min(1.3,Math.round(v*100)/100)); document.documentElement.dataset.fs=v; document.documentElement.style.setProperty('--fs',v); try{ localStorage.setItem('netlab-fs',String(v)); }catch(e){} lbl.textContent=Math.round(v*100)+'%'; };
  const lbl=el('span',{class:'fslbl','aria-live':'polite'},Math.round(cur()*100)+'%');
  return el('div',{class:'fsbar',role:'group','aria-label':'ขนาดตัวอักษร'},el('span',{class:'muted small'},'ขนาดตัวอักษร'),
    el('button',{type:'button',class:'fsbtn','aria-label':'ลดขนาดตัวอักษร',onclick:()=>set(cur()-0.1)},'ก−'),lbl,
    el('button',{type:'button',class:'fsbtn','aria-label':'เพิ่มขนาดตัวอักษร',onclick:()=>set(cur()+0.1)},'ก+'),
    el('button',{type:'button',class:'fsbtn small','aria-label':'ขนาดปกติ',onclick:()=>set(1)},'ปกติ'));
}
(function(){ let v=null; try{ v=localStorage.getItem('netlab-fs'); }catch(e){} if(v){ document.documentElement.dataset.fs=v; document.documentElement.style.setProperty('--fs',v); } })();
function contentPage(L,jump){
  const p=LP(L.id);
  const seen=sid=>(p.visited||[]).includes(sid);
  const tocList=()=>el('ol',{},L.sections.map(s=>el('li',{},el('a',{href:`#/lesson/${L.id}/content/${s.id}`,onclick:e=>{ e.preventDefault(); goSec(s.id); },'data-sec':s.id,class:seen(s.id)?'seen':''},s.title.replace(/^\d+\.\s*/,'')))));
  const toc=el('nav',{class:'ltoc','aria-label':'หัวข้อในบทนี้'},el('b',{},'สารบัญ'),tocList());
  const mtoc=el('details',{class:'mtoc'},el('summary',{},'สารบัญบทนี้ (',L.sections.length,' หัวข้อ)'),el('nav',{'aria-label':'สารบัญบทนี้'},tocList()));
  const bar=el('i',{}), barTxt=el('span',{});
  const prog=el('div',{class:'lprog',role:'progressbar','aria-label':'ความคืบหน้าการอ่าน','aria-valuemin':'0','aria-valuemax':String(L.sections.length)},el('span',{class:'lpbar'},bar),barTxt);
  const drawProg=()=>{ const n=L.sections.filter(s=>seen(s.id)).length; bar.style.width=Math.round(n/L.sections.length*100)+'%'; barTxt.textContent=`อ่านแล้ว ${n}/${L.sections.length} หัวข้อ`; prog.setAttribute('aria-valuenow',String(n)); };
  const last=lastOf(L.id), lastSec=last&&L.sections.find(s=>s.id===last);
  const resume=!jump&&lastSec&&lastSec!==L.sections[0]?el('div',{class:'resume'},el('span',{},'อ่านค้างไว้ที่: ',el('b',{},lastSec.title)),el('button',{class:'btn',type:'button',onclick:()=>{ resume.remove(); goSec(lastSec.id); }},'อ่านต่อ')):null;
  function goSec(sid){ const t=document.getElementById('sec-'+sid); if(!t) return; mtoc.open=false;   // close first: the list changes the page height
    const reduce=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
    requestAnimationFrame(()=>{ t.scrollIntoView({behavior:reduce?'auto':'smooth',block:'start'}); try{ t.querySelector('h2').focus({preventScroll:true}); }catch(e){} }); }
  const body=el('div',{class:'lbody'},resume,mtoc,L.sections.map(s=>el('section',{class:'lsec',id:'sec-'+s.id,'data-sec':s.id},
    el('h2',{tabindex:'-1'},s.title), s.blocks.map(b=>renderBlock(L,b)), el('div',{class:'secend','data-sec':s.id}))),
    el('div',{class:'panel endcard'},el('h2',{},'อ่านจบแล้ว'),el('p',{},'ต่อไปทำแล็บท้ายคาบเพื่อฝึกปฏิบัติ แล้วทำแบบทดสอบหลังเรียน'),
      el('div',{class:'row'},el('a',{class:'btn big',href:`#/lesson/${L.id}/lab`},'ไปทำแล็บท้ายคาบ'),el('a',{class:'btn ghost',href:`#/lesson/${L.id}/post`},'ไปแบบทดสอบหลังเรียน'))));
  R(app,lessonRail(L.id,'content'),el('div',{class:'ltools'},prog,fontBar()),el('div',{class:'lgrid'},body,toc));
  drawProg();
  if('IntersectionObserver' in window){
    // mark a section as read when its end comes into view
    const io=new IntersectionObserver(es=>es.forEach(e=>{
      if(!e.isIntersecting) return; const sid=e.target.dataset.sec; io.unobserve(e.target);
      if(seen(sid)) return;
      p.visited=(p.visited||[]).concat(sid); save();
      api('POST',`/api/lessons/${L.id}/visit`,{section:sid}).catch(()=>{});
      app.querySelectorAll(`.ltoc [data-sec="${sid}"],.mtoc [data-sec="${sid}"]`).forEach(a=>a.classList.add('seen'));
      drawProg();
      const rail=app.querySelector('.lhead'); if(rail) rail.replaceWith(lessonRail(L.id,'content'));
    }),{rootMargin:'0px 0px -10% 0px'});
    app.querySelectorAll('.secend').forEach(x=>io.observe(x));
    // remember the section the reader is in (top third of the screen)
    let cur=null, tmr=null;
    const io2=new IntersectionObserver(es=>es.forEach(e=>{
      if(!e.isIntersecting) return; const sid=e.target.dataset.sec; if(sid===cur) return; cur=sid;
      setLast(L.id,sid); p.last=sid;
      app.querySelectorAll('.ltoc a,.mtoc a').forEach(a=>a.classList.toggle('here',a.dataset.sec===sid));
      clearTimeout(tmr); if(ME) tmr=setTimeout(()=>api('POST',`/api/lessons/${L.id}/visit`,{section:sid,last:true}).catch(()=>{}),2500);
    }),{rootMargin:'-20% 0px -70% 0px'});
    app.querySelectorAll('section.lsec').forEach(x=>io2.observe(x));
  }
  if(jump&&L.sections.some(s=>s.id===jump)) setTimeout(()=>goSec(jump),60); else window.scrollTo(0,0);
}
function summaryPage(L){
  const p=LP(L.id), s=stepState(L.id);
  const nextL=LMETA.find(l=>l.week===L.week+1);
  R(app,lessonRail(L.id,'summary'),
    el('section',{class:'panel'},el('h2',{},'สรุปบทเรียน'),el('ul',{class:'checklist'},L.summary.map(t=>el('li',{},t)))),
    el('section',{class:'panel'},el('h2',{},'ผลของสัปดาห์นี้'),
      el('div',{class:'compare'},
        el('div',{},el('small',{},'ก่อนเรียน'),el('b',{},p.pre?`${p.pre.score}/${p.pre.max}`:'–')),
        el('div',{},el('small',{},'แบบฝึกหัด'),el('b',{},`${s.checks}/${s.checkTotal}`)),
        el('div',{},el('small',{},'แล็บ'),el('b',{},labOf(L.id)?`${roomScore(labOf(L.id))}/${roomMax(labOf(L.id))}`:'–')),
        el('div',{},el('small',{},'หลังเรียน'),el('b',{},p.post?`${p.post.score}/${p.post.max}`:'–'))),
      !s.complete?el('p',{class:'muted'},'ยังเหลือ: '+[s.pre!=='done'?'แบบทดสอบก่อนเรียน':null,s.content!=='done'?'อ่านเนื้อหาให้ครบ':null,s.lab!=='done'?'แล็บท้ายคาบ':null,s.post!=='done'?'แบบทดสอบหลังเรียน':null].filter(Boolean).join(', ')):null),
    el('div',{class:'row'},nextL?el('a',{class:'btn big',href:'#/lesson/'+nextL.id},`ไปสัปดาห์ ${nextL.week}`):el('a',{class:'btn big',href:'#/results'},'ดูผลการเรียนทั้งหมด')));
  window.scrollTo(0,0);
}

/* ---------- results ---------- */
function code(){
  const s=(S.name.trim()||'-')+'|'+score()+'|'+Object.keys(S.done).sort().join(',')+'|'+JSON.stringify(Object.keys(S.lessons||{}).map(k=>[k,(S.lessons[k].pre||{}).score,(S.lessons[k].post||{}).score]));
  let h=2166136261; for(const ch of s){h^=ch.codePointAt(0);h=Math.imul(h,16777619)>>>0;}
  return h.toString(36).toUpperCase().padStart(7,'0').slice(-7);
}
function resultsPage(){
  setTitle('ผลการเรียน');
  const preT=LMETA.reduce((a,l)=>a+(LP(l.id).pre?LP(l.id).pre.score:0),0), postT=LMETA.reduce((a,l)=>a+(LP(l.id).post?LP(l.id).post.score:0),0);
  const rows=LMETA.map(l=>{ const p=LP(l.id), s=stepState(l.id), r=labOf(l.id);
    return {l,s,title:`สัปดาห์ ${l.week}: ${l.title||'(ไม่มีชื่อบท)'}`,
      pre:p.pre?`${p.pre.score}/${p.pre.max}`:'–', content:s.sections?Math.round(s.visited/s.sections*100):0, contentTxt:`${s.visited}/${s.sections} หัวข้อ`,
      checks:`${s.checks}/${s.checkTotal}`, lab:r&&S.timers[r.id]?`${roomScore(r)}/${roomMax(r)}`:'–', post:p.post?`${p.post.score}/${p.post.max}`:'–',
      status:s.complete?['done','เรียนจบ']:s.started?['doing','กำลังเรียน']:['todo','ยังไม่เริ่ม']}; });
  const pill=x=>el('span',{class:'stpill '+x.status[0]},x.status[1]);
  const bar=x=>el('span',{class:'cbar',title:x.contentTxt},el('span',{class:'htrack'},el('i',{style:`width:${x.content}%`})),el('small',{},x.contentTxt));
  R(app,el('h1',{},'ผลการเรียน'),guestBanner('results'),
    el('p',{class:'lede'},'ชื่อ: ',el('b',{},S.name.trim()||'(ยังไม่ได้กรอกชื่อ)'),ME&&ME.class?' · '+ME.class.name:''),
    // phones: one card per week
    el('ol',{class:'rescards','aria-label':'ผลการเรียนรายสัปดาห์'},rows.map(x=>el('li',{class:'rescard'},
      el('div',{class:'rchead'},el('a',{href:'#/lesson/'+x.l.id},x.title),pill(x)),
      el('dl',{class:'rcgrid'},
        el('div',{},el('dt',{},'ก่อนเรียน'),el('dd',{},x.pre)),el('div',{},el('dt',{},'หลังเรียน'),el('dd',{},x.post)),
        el('div',{},el('dt',{},'แบบฝึกหัด'),el('dd',{},x.checks)),el('div',{},el('dt',{},'แล็บ'),el('dd',{},x.lab)),
        el('div',{class:'wide'},el('dt',{},'อ่านเนื้อหา'),el('dd',{},bar(x))))))),
    // tablets and computers: one table that scrolls inside its frame, header stays visible
    el('div',{class:'tablewrap restable',tabindex:'0','aria-label':'ตารางผลการเรียน เลื่อนดูได้'},el('table',{class:'btable results'},
      el('thead',{},el('tr',{},el('th',{scope:'col'},'สัปดาห์'),el('th',{scope:'col'},'ก่อนเรียน'),el('th',{scope:'col'},'เนื้อหา'),el('th',{scope:'col'},'แบบฝึกหัด'),el('th',{scope:'col'},'แล็บ'),el('th',{scope:'col'},'หลังเรียน'),el('th',{scope:'col'},'สถานะ'))),
      el('tbody',{},rows.map(x=>el('tr',{},el('th',{scope:'row'},el('a',{href:'#/lesson/'+x.l.id},x.title)),el('td',{class:'num'},x.pre),el('td',{},bar(x)),el('td',{class:'num'},x.checks),
          el('td',{class:'num'},x.lab),el('td',{class:'num'},x.post),el('td',{},pill(x))))))),
    el('div',{class:'compare'},el('div',{},el('small',{},'รวมก่อนเรียน'),el('b',{},preT)),el('div',{},el('small',{},'รวมหลังเรียน'),el('b',{},postT)),
      el('div',{},el('small',{},'แล็บท้ายคาบ'),el('b',{},listScore(WEEKS)+'/'+listMax(WEEKS))),el('div',{},el('small',{},'ห้องฝึก'),el('b',{},listScore(ROOMS)+'/'+listMax(ROOMS)))),
    ME?el('p',{class:'savednote'},'คะแนนทั้งหมดบันทึกในระบบแล้ว ครูดูได้จากแดชบอร์ดครูทันที ไม่ต้องถ่ายภาพหน้าจอส่ง')
      :el('div',{class:'panel'},el('p',{class:'muted'},'รหัสยืนยันสำหรับส่งครู'),el('div',{class:'code'},code()),el('p',{class:'muted small'},'คุณใช้งานแบบผู้เยี่ยมชม คะแนนอยู่ในเครื่องนี้เท่านั้น ถ่ายภาพหน้าจอนี้ส่งครู หรือเข้าสู่ระบบเพื่อให้คะแนนบันทึกอัตโนมัติ'),
        el('button',{class:'btn ghost',onclick:()=>{ if(confirm('ล้างความคืบหน้าทั้งหมดในเครื่องนี้?')){ const n=S.name; S=blank(); S.name=n; save(); route(); } }},'ล้างความคืบหน้าในเครื่องนี้')));
  window.scrollTo(0,0);
}

/* ---------- boot ---------- */
async function boot(){
  applyRail();
  R(app,el('p',{class:'loading'},'กำลังโหลดบทเรียน...'));
  let c;
  try{ [c,LMETA]=await Promise.all([api('GET','/api/content'),api('GET','/api/lessons')]); }
  catch(e){ R(app,el('div',{class:'panel'},el('p',{},'โหลดบทเรียนไม่สำเร็จ '+(e.offline?'กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ต':'')),el('button',{class:'btn',onclick:boot},'ลองใหม่'))); return; }
  ROOMS=c.rooms; WEEKS=c.weeks; ALL=ROOMS.concat(WEEKS);
  try{ applyMe(await api('GET','/api/me')); }catch(e){ loadGuest(); }
  document.getElementById('scrim').addEventListener('click',closeDrawer);
  document.addEventListener('keydown',e=>{ if(e.key==='Escape'&&document.body.classList.contains('drawer')) closeDrawer(); });
  applyRail();
  route(); flushQueue();
  setTimeout(()=>document.body.classList.add('ready'),400);   // animate the sidebar only after the first layout
  if(ME&&ME.mustChangePw) pwModal(true);
}
boot();

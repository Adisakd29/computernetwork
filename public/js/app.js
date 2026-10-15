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
  folder:'<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M8 13h8M8 16h5"/>',
  trophy:'<path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 21h8M9 21l1-4h4l1 4"/>',
  chevl:'<path d="M15 6l-6 6 6 6"/>',
  chevr:'<path d="M9 6l6 6-6 6"/>',
  close:'<path d="M6 6l12 12M18 6L6 18"/>',
  help:'<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14M12 17.5v.01"/>',
  target:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  abc:'<path d="M4 18l4-12 4 12M5.5 14h5M14 6h3.5a2.5 2.5 0 0 1 0 5H14zM14 11h4a3 3 0 0 1 0 6h-4z"/>',
  key:'<path d="M5 12l4 4 10-10"/>',
  download:'<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>',
  logo:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="8.5" y="14" width="7" height="7" rx="1.5"/><path d="M6.5 10v2h11v-2M12 12v2"/>',
  /* Progressive Unlock: the four week statuses (shape + text label, never colour alone) */
  locked:'<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7.5a4 4 0 0 1 8 0V11M12 15v2"/>',
  available:'<circle cx="12" cy="12" r="8"/>',
  in_progress:'<circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor"/>',
  completed:'<circle cx="12" cy="12" r="9"/><path d="M8 12.5l3 3 5-6"/>',
  unlock:'<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7.5a4 4 0 0 1 7.6-1.8M12 15v2"/>'
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
  const core=m?m.sections.filter(x=>!x.extra):[];   // supplementary sections (extra) do not count towards "content finished"
  const visited=(p.visited||[]).filter(s=>core.some(x=>x.id===s)).length;
  const st={
    pre:p.pre?'done':'todo',
    content:m&&visited>=core.length?'done':visited?'doing':'todo',
    lab:t?(t.status==='running'&&now()<t.start+t.limit?'doing':'done'):'todo',
    post:p.post?'done':'todo',
    challenge:challengeState(id),
    visited, sections:core.length, extras:m?m.sections.length-core.length:0, checks:(p.checks||[]).length, checkTotal:m?m.checks:0
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
      ls.map(l=>{ const st=weekStatus(l.id); const on=r==='#/lesson/'+l.id||r.startsWith('#/lesson/'+l.id+'/');
        return el('a',{class:'lnk'+(on?' on':'')+(st==='locked'?' lk':''),href:'#/lesson/'+l.id,onclick:closeDrawer},st==='locked'?icon('locked','lnklock'):el('span',{class:'led '+LED_OF[st]}),
          el('span',{},`สัปดาห์ ${l.week} `,el('small',{},l.title),st==='locked'?el('span',{class:'vh'},' (ล็อก)'):null)); }));
  }));
  const acct=ME
    ? el('div',{class:'acct'},xpChip(),el('a',{class:'who',href:'#/profile',title:'โปรไฟล์ของฉัน',onclick:closeDrawer},typeof avatarEl==='function'?avatarEl(ME,32):icon('user'),el('div',{},el('b',{},ME.name),el('small',{},ME.class?ME.class.name:({teacher:'ครู',admin:'ผู้ดูแลระบบ',student:'นักเรียน'}[ME.role])))),
        el('div',{class:'acctbtns'},(ME.role==='teacher'||ME.role==='admin')?el('a',{class:'sbtn primary',href:'/teacher.html'},'แดชบอร์ดครู'):null,
          el('a',{class:'sbtn',href:'#/profile',onclick:closeDrawer},'โปรไฟล์'),el('button',{class:'sbtn',onclick:logout},'ออกจากระบบ')))
    : DBON?el('div',{class:'acct'},el('p',{class:'muted small'},'เข้าสู่ระบบเพื่อบันทึกคะแนนให้ครูเห็น'),el('div',{class:'acctbtns'},el('button',{class:'sbtn primary',onclick:loginModal},'เข้าสู่ระบบ'),el('button',{class:'sbtn',onclick:registerModal},'สมัครสมาชิก'))):null;
  R(side,
    el('div',{class:'sidetop'},
      el('a',{class:'brand',href:'#/',onclick:closeDrawer,'aria-label':'NetLab หน้าแรก'},icon('logo'),el('span',{},'NetLab'),el('small',{},'ห้องปฏิบัติการเครือข่าย')),
      el('button',{class:'railbtn',type:'button',onclick:toggleRail,'aria-label':isRail()?'ขยายเมนู':'ย่อเมนู',title:isRail()?'ขยายเมนู':'ย่อเมนู','aria-expanded':String(!isRail())},icon(isRail()?'chevr':'chevl')),
      el('button',{class:'drawerclose',type:'button',onclick:()=>{ if(Date.now()-DRAWER_AT>250) closeDrawer(); },'aria-label':'ปิดเมนู'},icon('close'))),
    search,
    el('nav',{'aria-label':'เมนูหลัก'},
      link('#/','home','แดชบอร์ด',r==='#/'||r===''),
      link('#/learn','book','บทเรียน 18 สัปดาห์',r==='#/learn'),
      link('#/sims','sim','ห้องปฏิบัติการจำลอง',r==='#/sims'||r.startsWith('#/sim/')),
      link('#/practice','quiz','ฝึกทำข้อสอบ',r==='#/practice'),
      ME?link('#/exams','exam','การสอบ',r==='#/exams'||r.startsWith('#/exam/')):null,
      ME&&DBON?link('#/me','trophy','ความก้าวหน้าของฉัน',r==='#/me'):null,
      ME&&DBON?link('#/portfolio','folder','แฟ้มผลงานทักษะ',r==='#/portfolio'):null,
      link('#/glossary','abc','คำศัพท์',r==='#/glossary'),
      link('#/results','chart','ผลการเรียน',r==='#/results'),
      link('#/app','download','ติดตั้งแอปและออฟไลน์',r==='#/app'),
      link('#/help','help','วิธีใช้งาน',r==='#/help')),
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
    ME?el('a',{class:'mtopuser',href:'#/profile','aria-label':'โปรไฟล์ของฉัน'},typeof avatarEl==='function'?avatarEl(ME,28):null,el('span',{},ME.name)):DBON?el('button',{class:'sbtn primary',onclick:loginModal},'เข้าสู่ระบบ'):el('span'));
}
let DRAWER_AT=0;   // the close button sits under the menu button: a ghost click from the opening tap must not close the drawer again
function openDrawer(){
  if(document.body.classList.contains('drawer')) return closeDrawer();
  DRAWER_AT=Date.now(); document.body.classList.add('drawer'); document.documentElement.classList.add('nl-noscroll');
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
  stopVM(); stopTick(); stopSim(); stopExam(); stopPathTimer(); CURRENT=null; closeDrawer();
  document.body.classList.remove('authmode'); if(window.NLParallax) NLParallax.destroyAll();
  const h=location.hash||'#/';
  if(h.startsWith('#/sim/')) SIMDONE=null;   // simulator results change there: reload them for the lesson pages
  renderShell();
  /* Progressive Unlock: the week statuses come from the server (GET /api/path); the pages below show them */
  if(isStudent()&&(h==='#/'||h==='#/learn'||h.startsWith('#/lesson/')||h.startsWith('#/sim/'))){
    const before=PATH; await loadPath();
    if((location.hash||'#/')!==h) return;   // navigated away while loading
    if(PATH!==before) renderShell();
    pathAnnounce();
  }
  if(ME&&DBON&&h!=='#/me'&&h!=='#/'&&h!=='') loadGame();   // refreshes the sidebar chip and announces new badges (cached 60 s)
  let m;
  try{
    if(h==='#/'||h==='') return await dashboard();
    if(h==='#/learn') return await lessonsPage();
    if(h==='#/rooms'){ location.replace('#/learn'); return; }   // 2.9: the 12 practice rooms now live inside the weekly lessons
    if(h==='#/results') return await resultsPage();
    if(h==='#/sims') return await simsPage();
    if(h==='#/practice') return await practicePage();
    if((m=h.match(/^#\/practice\/u(\d+)$/))) return await practicePage(+m[1]);
    if(h==='#/me') return await progressPage();
    if(h==='#/portfolio'){ R(app,el('div',{id:'pfroot'})); return await NL_PORTFOLIO.render(document.getElementById('pfroot')); }   // 3.0 P5
    if(h==='#/app') return await appPage();
    if(h==='#/glossary') return await glossaryPage();
    if(h==='#/help') return helpPage();
    if(h==='#/login') return await loginPage();
    if(h==='#/register') return await registerPage();
    if(h==='#/forgot') return await forgotPage();
    if(h==='#/profile') return await profilePage();
    if(h==='#/terms'||h==='#/privacy') return legalPage(h.slice(2));
    if((m=h.match(/^#\/verify\/([A-Za-z0-9_-]{20,})$/))) return verifyPage(m[1]);
    if((m=h.match(/^#\/reset\/([A-Za-z0-9_-]{20,})$/))) return resetPage(m[1]);
    if((m=h.match(/^#\/auth-result\/([a-z_]+)$/))) return await authResultPage(m[1]);
    if(h==='#/exams') return await examsPage();
    if((m=h.match(/^#\/sim\/(\w+)(?:\/([a-z]+\d+))?$/))) return await simPage(m[1],m[2]);
    if((m=h.match(/^#\/exam\/(\d+)$/))) return await examPage(+m[1]);
    if((m=h.match(/^#\/search\/(.*)$/))) return await searchPage(decodeURIComponent(m[1]));
    if((m=h.match(/^#\/room\/(r\d+)$/))){ const rr=ALL.find(r=>r.id===m[1]); if(rr){ location.replace(labHref(rr)); return; } }   // old links -> the challenge in its week
    if((m=h.match(/^#\/lesson\/(w\d+)(?:\/(pre|content|lab|challenge|post|summary))?(?:\/([sx]\w+|r\d+))?$/))) return await lessonPage(m[1],m[2]||'overview',m[3]);
  }catch(e){
    if(e.offline){ R(app,el('div',{class:'panel'},el('h1',{},'ต้องเชื่อมต่ออินเทอร์เน็ต'),el('p',{},'หน้านี้ใช้ข้อมูลจากเซิร์ฟเวอร์ ตอนนี้อ่านบทเรียนที่เคยเปิดไว้ได้ระหว่างออฟไลน์'),el('div',{class:'row'},el('a',{class:'btn',href:'#/learn'},'ไปที่บทเรียน'),el('a',{class:'btn ghost',href:'#/app'},'ส่วนที่ใช้ออฟไลน์ได้')))); return; }
    console.error(e); R(app,stateBox('error','เปิดหน้านี้ไม่สำเร็จ',[e.message||'เกิดข้อผิดพลาดที่ไม่คาดคิด','ลองโหลดใหม่อีกครั้ง ถ้ายังไม่ได้ให้แจ้งครูผู้สอนพร้อมบอกว่ากดอะไรก่อนเกิดปัญหา'],
      [el('button',{class:'btn',type:'button',onclick:route},'ลองใหม่'),el('a',{class:'btn ghost',href:'#/'},'กลับแดชบอร์ด')])); return; }
  R(app,stateBox('empty','ไม่พบหน้านี้',['ลิงก์อาจพิมพ์ผิดหรือหน้านี้ถูกย้ายแล้ว ลองค้นหาจากช่องค้นหาหรือกลับไปที่บทเรียน'],
    [el('a',{class:'btn',href:'#/learn'},'ไปที่บทเรียน'),el('a',{class:'btn ghost',href:'#/'},'กลับแดชบอร์ด')]));
}
/* shared empty / error state: icon + title + explanation + next actions */
function stateBox(kind,title,lines,actions){
  const ic=kind==='error'?'<circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 16.5v.01"/>':'<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4M8.5 11h5"/>';
  const i=el('span',{class:'stateic '+kind,'aria-hidden':'true'}); i.innerHTML=`<svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ic}</svg>`;
  return el('section',{class:'panel statebox',role:kind==='error'?'alert':null},i,el('h1',{},title),(lines||[]).map(t=>el('p',{},t)),el('div',{class:'row'},actions||[]));
}
window.addEventListener('hashchange',route);
const setTitle=t=>{ document.title=t?`${t} · NetLab`:'NetLab ห้องปฏิบัติการเครือข่ายคอมพิวเตอร์'; };

/* ---------- dashboard ---------- */
function ledStrip(){
  const done=LMETA.filter(l=>weekStatus(l.id)==='completed').length;
  const tester=el('div',{class:'tester',role:'list','aria-label':'ความคืบหน้า 18 สัปดาห์'},
    LMETA.map(l=>{ const st=weekStatus(l.id);
      return el('a',{class:'tled '+LED_OF[st],href:'#/lesson/'+l.id,role:'listitem',title:`สัปดาห์ ${l.week}: ${l.title} (${STATUS_TH[st]})`},
        el('i',{}),el('span',{},l.week)); }));
  const sec=el('section',{class:'hero'},
    el('div',{class:'herotext'},el('h1',{},ME?`สวัสดี ${ME.name.split(' ')[0]}`:'ห้องปฏิบัติการเครือข่ายคอมพิวเตอร์'),
      el('p',{},`เรียนจบแล้ว ${done} จาก ${LMETA.length} สัปดาห์ ไฟแต่ละดวงคือหนึ่งสัปดาห์ เขียวคือเรียนจบ เหลืองคือกำลังเรียน`)),
    el('div',{class:'testerbox'},tester,el('div',{class:'testerlbl'},el('span',{},'LAN TESTER'),el('span',{},`${done}/${LMETA.length}`))));
  if(!ME) sec.querySelector('.herotext').append(el('div',{class:'herocta'},el('a',{class:'btn',href:'#/lesson/w1'},'เริ่มเรียนสัปดาห์ที่ 1'),
    DBON?el('a',{class:'btn ghost',href:'#/register',onclick:()=>{ try{ sessionStorage.setItem('netlab-return','#/'); }catch(e){} }},'สมัครสมาชิก'):null,DBON?el('a',{class:'btn ghost',href:'#/login'},'เข้าสู่ระบบ'):null));
  if(window.NLParallax) NLParallax.mount(sec,{strength:ME?0.6:0.9});   // welcome / dashboard hero only; lessons, exams and simulators stay still
  return sec;
}
/* first-visit onboarding: 4 short steps on the dashboard; can be skipped and reopened from #/help */
const ONB_STEPS=[
  ['เรียนทีละสัปดาห์ 6 ขั้น','แต่ละสัปดาห์เริ่มจากแบบทดสอบก่อนเรียน อ่านเนื้อหา (มีคำถามนำ ภาพ สื่อ Interactive และแบบฝึกหัดพร้อมเฉลย) ฝึกปฏิบัติในแล็บท้ายคาบ ทำภารกิจท้าทาย แล้วทำแบบทดสอบหลังเรียนและดูสรุปผล','#/lesson/w1','เปิดสัปดาห์ที่ 1'],
  ['ฝึกลงมือในบทเรียนและห้องจำลอง','ทุกสัปดาห์มีแล็บท้ายคาบและภารกิจท้าทายแบบจับเวลาอยู่ในบทเรียน ห้องปฏิบัติการจำลองให้ต่อเครือข่าย คำนวณ Subnet เข้าหัวสาย พิมพ์คำสั่ง และแก้ปัญหาเครือข่ายเหมือนของจริง','#/sims','ดูห้องปฏิบัติการจำลอง'],
  ['ค้นหาและคำศัพท์','ช่องค้นหาด้านบนค้นได้ทั้งชื่อบท เนื้อหาในหัวข้อ และคำศัพท์ หน้า "คำศัพท์" รวมคำศัพท์ทุกสัปดาห์พร้อมคำอ่านและตัวอย่าง','#/glossary','เปิดหน้าคำศัพท์'],
  ['ติดตามผลและทบทวน','เข้าสู่ระบบด้วยบัญชีที่ครูสร้างให้เพื่อบันทึกคะแนน หน้า "ความก้าวหน้าของฉัน" บอกหัวข้อที่ควรทบทวน งานค้าง และทักษะที่ทำได้ดี ถ้าใช้แบบผู้เยี่ยมชม ผลจะเก็บไว้ในเครื่องนี้เท่านั้น','#/results','ดูผลการเรียน']];
const onbDone=()=>{ try{ return localStorage.getItem('netlab-onboard')==='done'; }catch(e){ return true; } };
function onboardCard(force){
  if(!force&&onbDone()) return null;
  let i=0;
  const box=el('section',{class:'panel onboard','aria-label':'แนะนำการใช้งาน NetLab'});
  const finish=()=>{ try{ localStorage.setItem('netlab-onboard','done'); }catch(e){} if(force) location.hash='#/'; else box.remove(); };
  const draw=()=>{ const [t,d,href,go]=ONB_STEPS[i];
    R(box,el('div',{class:'onbhead'},el('span',{class:'contk'},`แนะนำการใช้งาน ${i+1}/${ONB_STEPS.length}`),el('button',{class:'btn ghost sm',type:'button',onclick:finish},'ข้าม')),
      el('h2',{tabindex:'-1'},t),el('p',{},d),
      el('div',{class:'onbdots','aria-hidden':'true'},ONB_STEPS.map((_,k)=>el('i',{class:k===i?'on':''}))),
      el('div',{class:'row'},i?el('button',{class:'btn ghost',type:'button',onclick:()=>{ i--; draw(); box.querySelector('h2').focus(); }},'ย้อนกลับ'):null,
        el('a',{class:'btn ghost',href,onclick:()=>{ if(i===ONB_STEPS.length-1) try{ localStorage.setItem('netlab-onboard','done'); }catch(e){} }},go),
        i<ONB_STEPS.length-1?el('button',{class:'btn',type:'button',onclick:()=>{ i++; draw(); box.querySelector('h2').focus(); }},'ถัดไป'):el('button',{class:'btn',type:'button',onclick:finish},'เริ่มเรียนเลย')));
  };
  draw(); return box;
}
function helpPage(){ setTitle('วิธีใช้งาน'); R(app,el('h1',{},'วิธีใช้งาน NetLab'),onboardCard(true)); window.scrollTo(0,0); }

function continueCard(){
  let target=LMETA.find(l=>{ const s=stepState(l.id); return s.started&&!s.complete; })||LMETA.find(l=>!stepState(l.id).complete);
  const asg=ME&&ASSIGN.filter(a=>a.labId.startsWith('w')&&!(S.timers[a.labId]&&S.timers[a.labId].status!=='running')).sort((a,b)=>(a.due||9e15)-(b.due||9e15))[0];
  if(asg) target=metaOf(asg.labId)||target;
  if(!target) return el('section',{class:'panel'},el('h2',{},'เรียนครบทุกสัปดาห์แล้ว'),el('p',{},'ทบทวนได้จากรายการบทเรียน หรือทำภารกิจท้าทายในแต่ละสัปดาห์'));
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
  return el('div',{class:'minirail','aria-label':'ขั้นตอนบทเรียน'},seg('pre','ก่อนเรียน'),seg('content','เนื้อหา'),seg('lab','แล็บ'),s.challenge!=='none'?seg('challenge','ท้าทาย'):null,seg('post','หลังเรียน'));
}
function guestBanner(where){
  if(ME) return null;
  let hid=false; try{ hid=sessionStorage.getItem('netlab-gb-'+where)==='1'; }catch(e){}
  if(hid) return null;
  const box=el('section',{class:'guestbar',role:'note','aria-label':'คำเตือนโหมดผู้เยี่ยมชม'},
    el('div',{class:'gbtext'},el('b',{},DBON?GUEST_PATH_TEXT:'โหมดผู้เยี่ยมชม: คะแนนเก็บเฉพาะในเบราว์เซอร์นี้'),
      el('span',{},DBON?'งานที่ลองทำระหว่างนี้ถูกเก็บเฉพาะในเบราว์เซอร์นี้ชั่วคราว ไม่ได้บันทึกในระบบ ครูไม่เห็นคะแนน ถ้าล้างประวัติเว็บ เปลี่ยนเครื่อง หรือใช้โหมดไม่ระบุตัวตน งานจะหาย เข้าสู่ระบบหรือสมัครสมาชิกแล้วผูกงานที่ทำไว้เข้าบัญชีได้':'ถ้าล้างประวัติเว็บหรือเปลี่ยนเครื่อง งานจะหาย ถ่ายภาพหน้าผลการเรียนส่งครู')),
    el('div',{class:'gbbtns'},DBON?el('button',{class:'sbtn primary',type:'button',onclick:loginModal},'เข้าสู่ระบบ'):null,DBON?el('button',{class:'sbtn',type:'button',onclick:registerModal},'สมัครสมาชิก'):null,
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
    return el('li',{},el('a',{class:'asg'+(done?' done':'')+(over?' over':''),href:labHref(r)},
      el('span',{class:'asg-t'},r.label+' '+r.title),el('span',{class:'asg-d'},done?'ส่งแล้ว':a.due?(over?'เลยกำหนด ':'ส่งภายใน ')+fmtDate(a.due):'ไม่มีกำหนดส่ง'))); })));
}
function unitList(filter){
  return el('div',{class:'unitlist'},UNITS.map((u,i)=>{
    const ls=LMETA.filter(l=>l.unit===i+1&&(!filter||filter(l))); if(!ls.length) return null;
    return el('section',{class:'ublock',style:`--uc:${UNIT_COLOR(i+1)}`},
      el('h2',{},el('span',{class:'unum'},i+1),UNITS[i]),
      el('ul',{},ls.map(l=>{ const s=stepState(l.id); const due=dueOf(l.id);
        const st=PATH?weekStatus(l.id):null;
        return el('li',{},el('a',{class:'lrow',href:'#/lesson/'+l.id},
          el('span',{class:'lweek'},'สัปดาห์ '+l.week),
          el('span',{class:'ltitle'},l.title,due&&due.due?el('small',{class:'due'},' · ส่งแล็บ '+fmtDate(due.due)):null,st?[' ',statusChip(st)]:null),
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
  R(app,guestBanner('home'),ledStrip(),nameBox(),gameStrip(),PATH?resumePanel():continueCard(),onboardCard(),assignPanel(),typeof planPanel==='function'?planPanel(true):null,toolCards(),el('h2',{class:'sech'},'บทเรียนทั้งหมด'),unitList());
  window.scrollTo(0,0);
}
function lessonsPage(){
  setTitle('บทเรียน 18 สัปดาห์');
  R(app,el('h1',{},'บทเรียน 18 สัปดาห์'),
    el('p',{class:'lede'},'เส้นทางการเรียน (Learning Path) ตามแผนการจัดการเรียนรู้วิชาระบบเครือข่ายคอมพิวเตอร์ แต่ละสัปดาห์มีแบบทดสอบก่อนเรียน เนื้อหาพร้อมแบบฝึกหัด แล็บท้ายคาบ และแบบทดสอบหลังเรียน'),
    pathPage());
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
  return el('li',{},el('a',{class:'room'+(full?' done':''),href:labHref(r)},
    el('div',{class:'strip',style:`background:${r.color}`}),
    el('div',{class:'body'},el('div',{class:'num'},r.label,r.challengeRoom?el('span',{class:'tag'},'ห้องท้าทาย'):null,r.terminal?el('span',{class:'tag'},'เทอร์มินัล'):null,r.vmTasks?el('span',{class:'tag vm'},'Linux VM'):null),el('h2',{},r.title),r.blurb&&!r.exit?el('p',{},r.blurb):null),
    el('div',{class:'stat'},el('b',{},full?'✓':`${d}/${r.tasks.length}`),full?'ผ่านแล้ว':'ข้อ',el('span',{class:'tstat'},statusText(r)))));
}
/* ---------- 2.9: challenges (the former 12 practice rooms) inside each week ---------- */
const challengesOf=id=>ROOMS.filter(r=>r.host===id);
const relatedOf=id=>ROOMS.filter(r=>r.host!==id&&(r.also||[]).includes(id));
function challengeState(id){
  const list=challengesOf(id); if(!list.length) return 'none';
  const st=list.map(r=>{ const t=S.timers[r.id]; return !t?'todo':(t.status==='running'&&now()<t.start+t.limit)?'doing':'done'; });
  return st.every(x=>x==='done')?'done':st.some(x=>x!=='todo')?'doing':'todo';
}
/* simulator missions that practise this week's objectives (step 3, Virtual Network Lab) */
/* 3.0: the practice plan of each week comes from content/curriculum.js (GET /api/curriculum) */
let CURR=null, SIMDONE=null;
const currOf=id=>CURR&&CURR.weeks.find(w=>w.id===id);
const MLEVEL_TH={easy:'ง่าย',medium:'ปานกลาง',hard:'ยาก'};
/* one rule everywhere (portfolio, post-test lock, lesson pages, simulator hub): a mission is passed at >= 70 % of its score */
const missionPassed=d=>!!(d&&d.max&&d.best/d.max>=0.7);
const missionFull=d=>!!(d&&d.max&&d.best>=d.max);
async function loadSimDone(force){
  if(!(ME&&DBON)) return {};
  if(SIMDONE&&!force) return SIMDONE;
  try{ const r=await api('GET','/api/sims/done'); SIMDONE=r&&r.done&&typeof r.done==='object'?r.done:{}; }   // {done:{sim:{mission:{best,max,attempts}}}} without the mission lists
  catch(e){
    if(e.offline){ SIMDONE=SIMDONE||{}; return SIMDONE; }
    try{ const r=await api('GET','/api/sims'); SIMDONE={}; r.sims.forEach(x=>{ SIMDONE[x.id]=x.done||{}; }); }catch(e2){ SIMDONE=SIMDONE||{}; }   // older server without /api/sims/done
  }
  return SIMDONE;
}
function missionList(list,done){
  return el('ul',{class:'simlist'},list.map(m=>{ const d=(done[m.sim]||{})[m.id];
    const st=d?(missionFull(d)?`ผ่านแล้ว · เต็ม ${d.best}/${d.max}`:missionPassed(d)?`ผ่านแล้ว ${d.best}/${d.max}`:`ได้ ${d.best}/${d.max} (ผ่านที่ 70%)`):(ME&&DBON?'ยังไม่ได้ทำ':'');
    return el('li',{},el('a',{href:`#/sim/${m.sim}/${m.id}`,class:missionFull(d)?'done full':missionPassed(d)?'done':null},icon('sim'),
      el('span',{},el('b',{},m.title),el('small',{},`${m.simTitle} · ${MLEVEL_TH[m.level]||m.level} · ~${m.minutes} นาที`+(st?' · '+st:'')))));
  }));
}
/* step 3 (ฝึกปฏิบัติ): Guided Lab = this end-of-class lab + guided missions; Independent Lab = missions done alone */
function weekSimsPanel(id){
  const c=currOf(id); if(!c||(!c.guided.length&&!c.independent.length)) return null;
  const box=el('section',{class:'panel simlinks'});
  const draw=done=>R(box,
    el('h2',{},'แผนฝึกปฏิบัติของสัปดาห์นี้'),
    el('p',{class:'muted small'},'ภารกิจในห้องจำลอง (Simulator) ตรวจผลจากเครือข่ายที่นักเรียนสร้างและตั้งค่าเอง คะแนนคิดที่เซิร์ฟเวอร์ ไม่ใช่เครื่องจริง'),
    el('h3',{class:'plh'},'1. Guided Lab (ฝึกตามขั้นตอน)'),
    el('p',{class:'small'},'แล็บท้ายคาบด้านล่าง'+(c.guided.length?' และภารกิจที่มีคำใบ้ทีละขั้น:':'')),
    c.guided.length?missionList(c.guided,done):null,
    c.independent.length?[el('h3',{class:'plh'},'2. Independent Lab (ทำเอง)'),missionList(c.independent,done)]:null,
    c.can&&c.can.length?el('p',{class:'muted small'},'เมื่อจบสัปดาห์นี้ควรทำได้: '+c.can.join(' · ')):null);
  draw({}); loadSimDone().then(draw);
  return box;
}
function troublePanel(id){
  const c=currOf(id); if(!c||!c.trouble.length) return null;
  const box=el('section',{class:'panel simlinks'});
  const draw=done=>R(box,el('h2',{},'ภารกิจแก้ปัญหาเครือข่าย (Troubleshooting Challenge)'),
    el('p',{class:'muted small'},'หาสาเหตุจากหลักฐาน แก้ที่ต้นเหตุ แล้วทดสอบยืนยัน ระบบตรวจจากสถานะเครือข่ายหลังแก้'),missionList(c.trouble,done));
  draw({}); loadSimDone().then(draw);
  return box;
}

function challengeCard(r,fromWeek){
  const t=S.timers[r.id], d=roomDone(r)+vmDone(r), n=r.tasks.length+(r.vmTasks||[]).length;
  const st=!t?'ยังไม่เริ่ม':(t.status==='running'&&now()<t.start+t.limit)?'กำลังทำ':t.status==='timeout'||(t.status==='running')?'หมดเวลา':'ส่งแล้ว';
  const host=metaOf(r.host);
  return el('li',{},el('a',{class:'room chal'+(d===n?' done':''),href:labHref(r)},
    el('div',{class:'strip',style:`background:${r.color}`}),
    el('div',{class:'body'},
      el('div',{class:'num'},r.label,r.challengeRoom?el('span',{class:'tag'},'ท้าทาย'):null,r.terminal?el('span',{class:'tag'},'เทอร์มินัล'):null,r.vmTasks?el('span',{class:'tag vm'},'Linux VM'):null,
        fromWeek&&host?el('span',{class:'tag'},'จากสัปดาห์ '+host.week):null),
      el('h2',{},r.title),r.blurb?el('p',{},r.blurb):null,
      el('p',{class:'chmeta'},`${n} ข้อ · ${r.minutes} นาที · เต็ม ${roomMax(r)} คะแนน`)),
    el('div',{class:'stat'},el('b',{},t?`${roomScore(r)}/${roomMax(r)}`:'–'),el('span',{},st))));
}
function challengePage(L){
  const own=challengesOf(L.id), rel=relatedOf(L.id);
  R(app,lessonRail(L.id,'challenge'),
    troublePanel(L.id),
    el('section',{class:'panel'},el('h2',{},'ภารกิจท้าทาย'),
      el('p',{},'ภารกิจจับเวลาที่ใช้ความรู้ของสัปดาห์นี้แก้โจทย์ที่ยากขึ้น (เดิมคือห้องฝึก) ทำได้หลังเรียนเนื้อหาและแล็บท้ายคาบ คะแนนบันทึกแยกจากแล็บท้ายคาบ ไม่บังคับก่อนทำแบบทดสอบหลังเรียน'),
      own.length?el('ul',{class:'rooms'},own.map(r=>challengeCard(r))):el('p',{class:'muted'},'สัปดาห์นี้ไม่มีภารกิจท้าทายแบบจับเวลาของตัวเอง ลองภารกิจที่เกี่ยวข้องด้านล่างและ Troubleshooting Challenge ด้านบน')),
    rel.length?el('section',{class:'panel'},el('h2',{},'ภารกิจท้าทายที่เกี่ยวข้อง'),el('p',{class:'muted small'},'ภารกิจเดียวกันกับที่อยู่ในสัปดาห์อื่น ทำครั้งเดียว คะแนนนับที่เดียว'),el('ul',{class:'rooms'},rel.map(r=>challengeCard(r,true)))):null,
    el('div',{class:'row'},el('a',{class:'btn big',href:`#/lesson/${L.id}/post`},'ไปทำแบบทดสอบหลังเรียน'),el('a',{class:'btn ghost',href:`#/lesson/${L.id}/lab`},'กลับไปแล็บท้ายคาบ')));
  window.scrollTo(0,0);
}

/* ---------- search ---------- */
const SYN=[['subnet','ซับเน็ต','ซับเน็ท','เครือข่ายย่อย'],['firewall','ไฟร์วอลล์','ไฟวอล'],['router','เราเตอร์'],['switch','สวิตช์','สวิทช์'],['wifi','wi-fi','ไวไฟ','ไร้สาย','wireless'],
  ['ip','ไอพี','ip address'],['dns','ดีเอ็นเอส'],['dhcp','ดีเอชซีพี'],['osi','โอเอสไอ'],['tcp','ทีซีพี'],['utp','สายแลน','สาย lan','สายยูทีพี'],['rj-45','rj45','หัวแลน'],['topology','โทโพโลยี','โทโปโลยี'],
  ['lan','แลน'],['wan','แวน'],['ping','ปิง'],['vlan','วีแลน'],['ipv6','ไอพีวี6'],['share','แชร์','แบ่งปัน'],['user','ผู้ใช้','บัญชี','account'],['password','รหัสผ่าน'],['vm','virtual machine','เครื่องเสมือน'],['linux','ลินุกซ์'],['windows','วินโดวส์']];
function searchTerms(q){ const n=q.toLowerCase().trim(); const out=new Set([n]); SYN.forEach(g=>{ if(g.some(w=>n.includes(w)||w.includes(n)&&n.length>=3)) g.forEach(w=>out.add(w)); }); return [...out].filter(Boolean); }
let GLOSS=null;
async function getGlossary(){ if(!GLOSS) GLOSS=await api('GET','/api/lessons/glossary'); return GLOSS; }
const glossHit=(g,terms)=>terms.some(w=>(g.en+' '+g.th+' '+g.say).toLowerCase().includes(w));
function markText(text,terms){   // highlight the first matching term in a snippet (text nodes only, no HTML injection)
  const low=text.toLowerCase(); let i=-1,t='';
  for(const w of terms){ const j=low.indexOf(w); if(j>=0&&(i<0||j<i)){ i=j; t=w; } }
  if(i<0) return [text];
  return [text.slice(0,i),el('mark',{},text.slice(i,i+t.length)),text.slice(i+t.length)];
}
async function searchPage(q){
  setTitle('ค้นหา');
  const terms=searchTerms(q);
  const hit=t=>terms.some(w=>t.includes(w));
  const ls=LMETA.filter(l=>hit((l.title+' '+l.keywords.join(' ')+' '+l.text).toLowerCase()));
  const labs=ALL.filter(r=>hit((r.title+' '+r.label+' '+r.tasks.map(t=>t.q).join(' ')).toLowerCase()));
  R(app,el('p',{class:'loading'},'กำลังค้นหา...'));
  let secs=[], gl=[], offline=false;
  try{ const [r,g]=await Promise.all([api('GET','/api/lessons/search?t='+encodeURIComponent(terms.join('|'))),getGlossary()]); secs=r.hits||[]; gl=g.filter(x=>glossHit(x,terms)).slice(0,12); }
  catch(e){ offline=true; }
  const none=!ls.length&&!labs.length&&!secs.length&&!gl.length;
  R(app,el('h1',{},`ผลการค้นหา "${q}"`),terms.length>1?el('p',{class:'muted small'},'ค้นหารวมคำที่เกี่ยวข้อง: '+terms.slice(1,7).join(', ')):null,
    offline?el('p',{class:'muted small'},'ค้นหาในเนื้อหาและคำศัพท์ไม่ได้ขณะออฟไลน์ แสดงเฉพาะชื่อบทเรียนและแล็บ'):null,
    none?el('div',{class:'panel'},el('p',{},'ไม่พบบทเรียน คำศัพท์ หรือแล็บที่ตรงกับคำค้น ลองใช้คำสั้นลง เช่น "Wi-Fi", "IP", "ping" หรือดู'),el('a',{class:'btn ghost',href:'#/glossary'},'คำศัพท์ทั้งหมด')):null,
    gl.length?[el('h2',{class:'sech'},`คำศัพท์ (${gl.length})`),el('dl',{class:'glist'},gl.map(glossItem))]:null,
    secs.length?[el('h2',{class:'sech'},`หัวข้อในบทเรียน (${secs.length})`),el('ul',{class:'reslist'},secs.map(h=>el('li',{},el('a',{href:`#/lesson/${h.lesson}/content/${h.section}`},
      el('b',{},h.stitle.replace(/^\d+\.\s*/,'')),el('small',{},`สัปดาห์ ${h.week} ${h.ltitle}`),el('span',{class:'snip'},...markText(h.snippet,terms))))))]:null,
    ls.length?[el('h2',{class:'sech'},`บทเรียน (${ls.length})`),el('ul',{class:'reslist'},ls.map(l=>el('li',{},el('a',{href:'#/lesson/'+l.id},el('b',{},`สัปดาห์ ${l.week} ${l.title}`),el('small',{},l.sections.map(s=>s.title.replace(/^\d+\.\s*/,'')).join(' · '))))))]:null,
    labs.length?[el('h2',{class:'sech'},`แล็บและภารกิจท้าทาย (${labs.length})`),el('ul',{class:'rooms'},labs.map(roomCard))]:null);
  window.scrollTo(0,0);
}
function glossItem(g){
  return el('div',{class:'gterm'},el('dt',{},el('span',{class:'gen',lang:'en'},g.en),el('span',{class:'gsay'},'อ่านว่า ',g.say)),
    el('dd',{},el('p',{},g.th),el('p',{class:'gex'},el('b',{},'ตัวอย่าง: '),g.ex),
      el('a',{class:'gsrc',href:`#/lesson/${g.lesson}/content/${g.section}`},`สัปดาห์ ${g.week} · ${g.title.replace(/^\d+\.\s*/,'')}`)));
}
async function glossaryPage(){
  setTitle('คำศัพท์เครือข่าย');
  R(app,el('p',{class:'loading'},'กำลังโหลดคำศัพท์...'));
  const all=await getGlossary();
  const q=el('input',{type:'search',class:'gfilter',placeholder:'พิมพ์คำศัพท์ภาษาอังกฤษหรือไทย เช่น DHCP, ซับเน็ต','aria-label':'กรองคำศัพท์',autocomplete:'off'});
  const wk=el('select',{'aria-label':'เลือกสัปดาห์'},el('option',{value:''},'ทุกสัปดาห์'),[...new Set(all.map(g=>g.week))].map(w=>el('option',{value:String(w)},'สัปดาห์ '+w)));
  const order=el('select',{'aria-label':'เรียงลำดับ'},el('option',{value:'week'},'เรียงตามสัปดาห์'),el('option',{value:'az'},'เรียง A–Z'));
  const count=el('p',{class:'muted small gcount',role:'status'}), list=el('div',{});
  function draw(){
    const terms=q.value.trim()?searchTerms(q.value):[];
    let xs=all.filter(g=>(!wk.value||String(g.week)===wk.value)&&(!terms.length||glossHit(g,terms)));
    if(order.value==='az') xs=xs.slice().sort((a,b)=>a.en.localeCompare(b.en,'en',{sensitivity:'base'}));
    count.textContent=`แสดง ${xs.length} จาก ${all.length} คำ`;
    if(!xs.length){ R(list,el('div',{class:'panel'},el('p',{},'ไม่พบคำศัพท์ที่ตรงกัน ลองพิมพ์สั้นลง หรือเลือก "ทุกสัปดาห์"'))); return; }
    if(order.value==='az'){ R(list,el('dl',{class:'glist'},xs.map(glossItem))); return; }
    const by={}; xs.forEach(g=>(by[g.week]=by[g.week]||[]).push(g));
    R(list,Object.keys(by).map(w=>el('section',{class:'gweek'},el('h2',{class:'sech'},`สัปดาห์ ${w} · ${(metaOf('w'+w)||{}).title||''}`),el('dl',{class:'glist'},by[w].map(glossItem)))));
  }
  let t; q.addEventListener('input',()=>{ clearTimeout(t); t=setTimeout(draw,150); }); wk.onchange=draw; order.onchange=draw;
  R(app,el('h1',{},'คำศัพท์เครือข่าย'),el('p',{class:'lede'},'รวมคำศัพท์เทคนิคจากทุกหัวข้อ พร้อมคำอ่าน ความหมาย ตัวอย่าง และลิงก์กลับไปยังหัวข้อที่สอนคำนั้น'),
    el('div',{class:'gtools'},q,wk,order),count,list);
  draw();
}

/* ---------- figures (lazy) ----------
   The 14 figure files (about 1.7 MB) are needed only by lesson content and by bank questions with a picture, so they are
   not in index.html. loadFigures() starts all downloads at once, runs them in the original order (diagrams.js defines
   NL_DIAGRAMS, later files add to it) and resolves once; a failed file is retried on the next call.
   The service worker still precaches them, so lessons read offline keep their figures. */
const FIG_FILES=['diagrams','diagrams2','widgets','widgets2','figs-a','figs-b','figs-c','figs-d','figs-e','figs-f','figs-g','figs-h','figs-i','figs-j'].map(n=>'js/'+n+'.js');
let FIGS_P=null;
function loadFigures(){
  if(!FIGS_P) FIGS_P=loadJsSeq(FIG_FILES).then(()=>true,e=>{ console.warn(e&&e.message); FIGS_P=null; return false; });
  return FIGS_P;
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
  const head=el('div',{class:'lhead',style:`--uc:${UNIT_COLOR(m.unit)}`},
    crumbs([['หน้าแรก','#/'],['บทเรียน','#/learn'],[`สัปดาห์ ${m.week}`,'#/lesson/'+id]].concat(active&&active!=='overview'?[[STEP_TH[active]]]:[]).map((x,i,a)=>i===a.length-1?[x[0]]:x)),
    el('a',{class:'lcrumb',href:'#/lesson/'+id},`สัปดาห์ ${m.week} · หน่วยที่ ${m.unit} ${UNITS[m.unit-1]}`),
    el('h1',{},m.title),
    el('nav',{class:'rail','aria-label':'ขั้นตอนบทเรียน'},
      step('pre',1,'ก่อนเรียน',s.pre==='done'?`${LP(id).pre.score}/${LP(id).pre.max}`:'10 ข้อ',s.pre),
      step('content',2,'เนื้อหา',`หลัก ${s.visited}/${s.sections}${s.extras?` (+เสริม ${s.extras})`:''} · ฝึก ${s.checks}/${s.checkTotal}`,s.content),
      step('lab',3,'ฝึกปฏิบัติ',labOf(id)?`แล็บ ${labOf(id).minutes} นาที`:'',s.lab),
      step('challenge',4,'ภารกิจท้าทาย',(()=>{ const c=challengesOf(id); const t=(currOf(id)||{trouble:[]}).trouble.length; return [c.length?`${c.length} ภารกิจจับเวลา`:null,t?`แก้ปัญหา ${t}`:null].filter(Boolean).join(' · ')||('เกี่ยวข้อง '+relatedOf(id).length); })(),s.challenge==='none'?'todo':s.challenge),
      step('post',5,'หลังเรียน',s.post==='done'?`${LP(id).post.score}/${LP(id).post.max}`:'10 ข้อ',s.post),
      step('summary',6,'สรุปผล','คะแนนและทบทวน',s.complete?'done':'todo')));
  requestAnimationFrame(()=>railCenter(head));
  return head;
}
/* phones: the step rail scrolls sideways; bring the current step to the middle. Only the rail's scrollLeft changes, never the page's vertical position */
function railCenter(head){
  const nav=head.querySelector('.rail'), on=nav&&nav.querySelector('.rstep.on');
  if(!on||!head.isConnected||nav.scrollWidth<=nav.clientWidth+1) return;
  const a=nav.getBoundingClientRect(), b=on.getBoundingClientRect();
  nav.scrollLeft+= (b.left+b.width/2)-(a.left+a.width/2);
}
async function lessonPage(id,tab,sec){
  if(!metaOf(id)) throw new Error('ไม่พบบทเรียน');
  setTitle(`สัปดาห์ ${metaOf(id).week}`);
  /* Progressive Unlock: a locked week shows only why it is locked (the server refuses its content anyway: 403 locked) */
  if(isStudent()&&PATH){
    let w=pathWeek(id);
    if(w&&!w.open&&Date.now()-PATH_AT>2000){ await loadPath(true); w=pathWeek(id); if((location.hash||'').indexOf(id)<0) return; }   // a teacher may have just unlocked it
    if(w&&!w.open) return lockPage(id,w.lock);
  }
  if(tab==='lab'){ const ri=ALL.findIndex(r=>r.id===id); openRoom(ri); return; }
  if(tab==='challenge'&&sec){ const ri=ALL.findIndex(r=>r.id===sec&&!r.exit);
    if(ri<0) throw new Error('ไม่พบภารกิจนี้');
    if(ALL[ri].host!==id){ location.replace(labHref(ALL[ri])); return; }   // a related challenge always opens in its own week
    openRoom(ri); return; }
  let L;
  try{ [L]=await Promise.all([getLesson(id),tab==='content'?loadFigures():null]); }   // lesson text and figure files download together
  catch(e){ if(e.code!=='locked') throw e; await loadPath(true); renderShell(); if((location.hash||'').indexOf(id)<0) return; return lockPage(id,e.body&&e.body.lock); }
  if((location.hash||'').indexOf(id)<0) return; // navigated away while loading
  if(tab==='overview') return lessonOverview(L);
  if((tab==='pre'||tab==='post')&&!L.quiz){ R(app,lessonRail(L.id,tab),el('div',{class:'panel'},el('h2',{},'ต้องเชื่อมต่ออินเทอร์เน็ต'),el('p',{},'แบบทดสอบก่อนและหลังเรียนตรวจที่เซิร์ฟเวอร์ และไม่เก็บไว้ในเครื่อง เชื่อมต่ออินเทอร์เน็ตแล้วเปิดหน้านี้อีกครั้ง'),el('a',{class:'btn',href:`#/lesson/${L.id}/content`},'อ่านเนื้อหาระหว่างรอ'))); return; }
  if(tab==='pre'||tab==='post') return quizPage(L,tab);
  if(tab==='content') return contentPage(L,sec);
  if(tab==='summary') return summaryPage(L);
  if(tab==='challenge') return challengePage(L);
}
function lessonOverview(L){
  const s=stepState(L.id), n=nextStep(L.id), due=dueOf(L.id);
  R(app,lessonRail(L.id,'overview'),
    el('div',{class:'ovgrid'},
      el('section',{class:'panel'},el('h2',{},'จุดประสงค์การเรียนรู้'),el('ul',{class:'checklist'},L.objectives.map(o=>el('li',{},o)))),
      el('section',{class:'panel'},el('h2',{},'สมรรถนะที่คาดหวัง'),el('p',{},L.competency),
        el('h2',{},'ในบทนี้'),el('p',{class:'muted small'},`หัวข้อหลัก ${L.sections.filter(x=>!x.extra).length} หัวข้อ`+(L.sections.some(x=>x.extra)?` + เนื้อหาเสริม ${L.sections.filter(x=>x.extra).length} หัวข้อ (ไม่นับในความคืบหน้าบังคับ)`:'')),el('ol',{class:'toc'},L.sections.map(x=>el('li',{},x.extra?el('span',{class:'xbadge'},'เสริม'):null,x.title.replace(/^\d+\.\s*/,'')))),
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

function quizPage(L,kind,opt){
  const p=LP(L.id), done=p[kind];
  const pi=kind==='post'?postInfo(L.id):null;   // Progressive Unlock: post-test attempts (logged-in students)
  const retake=!!(opt&&opt.retake&&pi&&pi.canRetake&&!pi.nextAt);
  const wrap=el('div',{});
  R(app,lessonRail(L.id,kind),el('div',{class:'ltools'},fontBar()),wrap);
  if(done&&!retake){ wrap.append(quizResult(L,kind,pi)); window.scrollTo(0,0); return; }
  if(kind==='post'&&DBON&&!ME){   // 3.0 P6: the server grades the post-test only for logged-in students
    wrap.append(el('section',{class:'panel quizintro'},el('h2',{},'แบบทดสอบหลังเรียน'),
      el('p',{},'ผลแบบทดสอบหลังเรียนและเฉลยผูกกับบัญชีของนักเรียน จึงต้องเข้าสู่ระบบก่อน ระหว่างนี้ฝึกทำข้อสอบในโหมดฝึกได้โดยไม่ต้องเข้าสู่ระบบ'),
      el('div',{class:'row'},el('button',{class:'btn',type:'button',onclick:loginModal},'เข้าสู่ระบบ'),el('a',{class:'btn ghost',href:'#/practice'},'ไปที่ฝึกทำข้อสอบ'))));
    return;
  }
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
  const msg=el('div',{class:'msg bad',role:'alert'});
  /* 3.0 P5: the teacher may require the week's Guided Lab before the post-test (checked again on the server) */
  const gateBox=el('div',{}); let locked=false;
  if(kind==='post'&&ME&&ME.role==='student') api('GET',`/api/lessons/${L.id}/gate`).then(g=>{
    if(!g.required||!g.missing.length) return;
    locked=true; upd();
    gateBox.replaceChildren(el('div',{class:'gatebox',role:'status'},
      el('b',{},'ครูกำหนดให้ผ่าน Guided Lab ของสัปดาห์นี้ก่อนทำแบบทดสอบหลังเรียน'),
      el('p',{class:'small'},'ผ่าน = ได้อย่างน้อย 70% ของคะแนนภารกิจ ยังเหลือ:'),
      el('ul',{},g.missing.map(m=>el('li',{},el('a',{href:`#/sim/${m.sim}/${m.mission}`},m.title),m.best!=null?` (ได้ ${m.best}/${m.max})`:' (ยังไม่ได้ทำ)')))));
  }).catch(()=>{});
  function upd(){ const n=items.filter(x=>x.get()!=null&&!(Array.isArray(x.get())&&!x.get().length)).length; counter.textContent=locked?'ยังส่งไม่ได้: ทำ Guided Lab ให้ผ่านก่อน':`ตอบแล้ว ${n} จาก ${items.length} ข้อ`; send.disabled=locked||n<items.length; }
  const attemptNo=pi?pi.attempts+1:1;
  async function submitQuiz(){
    const ask=kind==='pre'?'ส่งแบบทดสอบก่อนเรียน? ส่งได้ครั้งเดียว'
      :pi&&pi.max>1?`ส่งแบบทดสอบหลังเรียน ครั้งที่ ${attemptNo} จาก ${pi.max}?`:'ส่งแบบทดสอบหลังเรียน? ส่งได้ครั้งเดียว และจะเห็นเฉลยหลังส่ง';
    if(!confirm(ask)) return;
    send.disabled=true; msg.textContent='';
    try{
      const res=await api('POST',`/api/lessons/${L.id}/quiz`,{kind,answers:items.map(x=>x.get())});
      setDraft(dk,null);
      if(kind==='post'&&res.attempt){   // retake rules: the server's reply (and /api/me) is the record
        LASTPOST[L.id]={score:res.score,max:res.max,attempt:res.attempt,passed:res.passed,message:res.reviewLocked?res.message:null,nextAt:res.nextAt||null};
        await refreshMe(); await loadPath(true); renderShell();
        if((location.hash||'').indexOf(L.id)<0) return;
        quizPage(L,kind); pathAnnounce(); return;
      }
      p[kind]={score:res.score,max:res.max,at:res.at,review:res.review,form:res.form}; save();
      quizPage(L,kind);
    }catch(e){
      if(e.code==='locked'){ await loadPath(true); renderShell(); lockPage(L.id,e.body&&e.body.lock); return; }
      if(e.code==='done'||e.code==='post_done'){ await refreshMe(); quizPage(L,kind); return; }
      if(e.code==='passed'||e.code==='no_attempts'){ LASTPOST[L.id]=Object.assign({},LASTPOST[L.id],{notice:POST_ERR[e.code]}); await refreshMe(); await loadPath(true); if(LP(L.id).post){ quizPage(L,kind); return; } msg.textContent=POST_ERR[e.code]; send.disabled=false; return; }
      if(e.code==='cooldown'){ const at=e.body&&e.body.nextAt; LASTPOST[L.id]=Object.assign({},LASTPOST[L.id],{nextAt:at||null});
        msg.textContent=at?`ยังทำใหม่ไม่ได้ ต้องรอถึงเวลา ${hhmm(at)} น. (อีก ${waitText(at-now())}) ระหว่างนี้ทบทวนเนื้อหาและแบบฝึกหัด คำตอบถูกเก็บเป็นร่างไว้แล้ว`:'ยังอยู่ในช่วงเวลารอระหว่างการทำแต่ละครั้ง ลองใหม่ภายหลัง คำตอบถูกเก็บเป็นร่างไว้แล้ว';
        send.disabled=false; return; }
      msg.textContent=e.offline?'ส่งไม่ได้เพราะออฟไลน์ คำตอบถูกบันทึกเป็นร่างไว้แล้ว เชื่อมต่ออินเทอร์เน็ตแล้วกดส่งอีกครั้ง':e.message; send.disabled=false;
    }
  }
  const postText=!pi?'ข้อสอบคู่ขนาน 10 ข้อ วัดจุดประสงค์เดียวกับแบบทดสอบก่อนเรียนข้อต่อข้อ แต่เป็นคนละข้อ จึงเทียบได้ว่าเรียนแล้วเข้าใจมากขึ้นแค่ไหน ส่งได้ครั้งเดียว หลังส่งจะเห็นเฉลยพร้อมคำอธิบายทุกข้อ'
    :`ข้อสอบคู่ขนาน 10 ข้อ วัดจุดประสงค์เดียวกับแบบทดสอบก่อนเรียนข้อต่อข้อ แต่เป็นคนละข้อ ต้องได้อย่างน้อย ${pi.passPct}% จึงผ่าน `+
      (pi.max>1?`ทำได้ ${pi.max} ครั้ง${pi.cooldownMin?` เว้นระยะครั้งละ ${pi.cooldownMin} นาที`:''} ระบบนับคะแนนดีที่สุด `:'ส่งได้ครั้งเดียว ')+
      (pi.review==='always'?'หลังส่งจะเห็นเฉลยพร้อมคำอธิบายทุกข้อ':'เฉลยจะแสดงเมื่อผ่านเกณฑ์หรือใช้สิทธิ์ครบ');
  wrap.append(
    el('section',{class:'panel quizintro'},
      el('h2',{},kind==='pre'?'แบบทดสอบก่อนเรียน':'แบบทดสอบหลังเรียน'),
      pi&&pi.max>1?el('p',{class:'attline'},el('b',{},`ครั้งที่ ${attemptNo} จาก ${pi.max}`),pi.attempts?` · คะแนนดีที่สุดตอนนี้ ${pi.bestText}`:''):null,
      el('p',{},kind==='pre'
        ?'วัดความรู้เดิมก่อนเริ่มเรียน 10 ข้อ ไม่จับเวลา ตอบตามที่รู้จริงโดยไม่ต้องเปิดหาคำตอบ ระบบจะบอกคะแนนแต่ยังไม่เฉลย แบบทดสอบหลังเรียนเป็นข้อสอบคู่ขนาน วัดจุดประสงค์เดียวกันแต่เป็นคนละข้อ จึงเทียบพัฒนาการได้'
        :postText),
      kind==='post'&&stepState(L.id).lab==='todo'?el('p',{class:'duehint'},'ยังไม่ได้ทำแล็บท้ายคาบ แนะนำให้ทำแล็บก่อน'):null,
      gateBox,
      el('p',{class:'muted small'},'คำตอบที่เลือกไว้ถูกบันทึกเป็นร่างอัตโนมัติ ปิดหน้าเว็บแล้วกลับมาทำต่อได้')),
    el('ol',{class:'quiz'},items.map((x,i)=>el('li',{class:'qcard'},
      el('div',{class:'qhead'},el('span',{class:'qno'},i+1),el('span',{class:'lvl '+x.q.level},LEVEL[x.q.level]||'')),
      el('p',{class:'qq'},x.q.q),x.node))),
    el('div',{class:'quizbar'},counter,send),msg);
  upd(); window.scrollTo(0,0);
}
function quizResult(L,kind,pi){
  const p=LP(L.id), r=p[kind];
  const out=el('section',{class:'panel'});
  const pct=Math.round(r.score/r.max*100);
  const multi=kind==='post'&&pi&&pi.max>1;
  out.append(el('h2',{},kind==='pre'?'ผลแบบทดสอบก่อนเรียน':'ผลแบบทดสอบหลังเรียน'),
    multi?el('p',{class:'muted small'},'คะแนนดีที่สุด'):null,
    el('div',{class:'scorebig'},el('b',{},`${r.score}/${r.max}`),el('span',{},`${pct}%`)));
  if(kind==='pre'){
    out.append(el('p',{},'ระบบจะเฉลยหลังทำแบบทดสอบหลังเรียน (ข้อสอบคู่ขนาน วัดจุดประสงค์เดียวกัน) ต่อไปให้อ่านเนื้อหาและทำแบบฝึกหัดระหว่างเรียน'),
      el('a',{class:'btn big',href:`#/lesson/${L.id}/content`},'เริ่มอ่านเนื้อหา'));
    return out;
  }
  if(kind==='post'&&pi) out.append(attemptBox(L,pi));
  if(p.pre){ const g=r.score-p.pre.score;
    out.append(el('div',{class:'compare'},
      el('div',{},el('small',{},'ก่อนเรียน'),el('b',{},`${p.pre.score}/${p.pre.max}`)),
      el('div',{class:'arrowr','aria-hidden':'true'},'›'),
      el('div',{},el('small',{},multi?'หลังเรียน (ดีที่สุด)':'หลังเรียน'),el('b',{},`${r.score}/${r.max}`)),
      el('div',{class:'gain '+(g>0?'up':g<0?'down':'')},el('small',{},'พัฒนาการ'),el('b',{},(g>0?'+':'')+g)))); }
  if(kind==='post'&&r.form==='A'&&L.quizPost) out.append(el('p',{class:'muted small'},'ผลนี้ส่งก่อนระบบเปลี่ยนเป็นข้อสอบคู่ขนาน จึงใช้ข้อชุดเดียวกับก่อนเรียน คะแนนเดิมยังนับตามปกติ'));
  if(Array.isArray(r.review)){
    const QS=kind==='post'&&L.quizPost&&r.form!=='A'?L.quizPost:L.quiz;
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
/* post-test attempts of one week: attempt number, attempts left, best score, cooldown and the next attempt (server data only) */
const POST_ERR={passed:'ผ่านแบบทดสอบหลังเรียนของบทนี้แล้ว ไม่ต้องทำซ้ำ คะแนนที่ผ่านถูกบันทึกไว้แล้ว',
  no_attempts:'ใช้สิทธิ์ทำแบบทดสอบหลังเรียนครบทุกครั้งแล้ว ติดต่อครูผู้สอนเพื่อขอรีเซ็ตหรือขอปลดล็อก'};
let LASTPOST={};   // this session only: the latest post-test reply per week (server message, next attempt time)
function postInfo(id){
  if(!isStudent()) return null;
  const p=LP(id).post, w=pathWeek(id), R0=PATH&&PATH.rules?PATH.rules:null, last=LASTPOST[id]||{};
  const max=(p&&p.maxAttempts)||(w&&w.post.maxAttempts)||(R0&&R0.post.maxAttempts)||1;
  const attempts=Math.max(w?w.post.attempts:0,p?(p.attempts||1):0);
  const passPct=(p&&p.passPct)||(R0&&R0.passPct)||70;
  const passed=!!(p&&(p.passed!=null?p.passed:p.max&&100*p.score/p.max>=passPct));
  const cooldownMin=R0?R0.post.cooldownMin:0;
  let nextAt=last.nextAt||(w&&w.post.last&&cooldownMin?w.post.last+cooldownMin*60000:null);
  if(nextAt&&nextAt<=now()) nextAt=null;
  const left=Math.max(0,max-attempts);
  return {max,attempts,left,passPct,passed,cooldownMin,nextAt,review:R0?R0.post.review:'always',last,
    canRetake:!!p&&!passed&&left>0&&max>1, reviewLocked:!!(p&&p.reviewLocked),
    bestText:p?`${p.score}/${p.max} (${Math.round(100*p.score/p.max)}%)`:'-'};
}
const hhmm=ms=>new Date(ms).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'});
function waitText(ms){ const s=Math.max(0,Math.ceil(ms/1000)), m=Math.floor(s/60), h=Math.floor(m/60);
  return h?`${h} ชั่วโมง ${m%60} นาที`:m?`${m} นาที ${String(s%60).padStart(2,'0')} วินาที`:`${s} วินาที`; }
let PATH_TMR=null;
function stopPathTimer(){ if(PATH_TMR){ clearInterval(PATH_TMR); PATH_TMR=null; } }
function attemptBox(L,pi){
  const last=pi.last, box=el('div',{class:'attbox'});
  const lastLine=last.attempt?el('p',{},el('b',{},`ครั้งที่ ${last.attempt}: ได้ ${last.score}/${last.max}`),last.passed?' ผ่านเกณฑ์':` ยังไม่ถึงเกณฑ์ ${pi.passPct}%`):null;
  R(box,el('h3',{},'สิทธิ์การทำแบบทดสอบหลังเรียน'),
    el('ul',{class:'attfacts'},
      el('li',{},'ทำไปแล้ว ',el('b',{},`${pi.attempts} จาก ${pi.max} ครั้ง`)),
      el('li',{},'เหลืออีก ',el('b',{},`${pi.left} ครั้ง`)),
      el('li',{},'คะแนนดีที่สุด ',el('b',{},pi.bestText),` · เกณฑ์ผ่าน ${pi.passPct}%`)),
    lastLine,
    last.notice?el('p',{class:'msg bad',role:'alert'},last.notice):null);
  if(pi.passed){ box.append(el('p',{class:'msg ok'},'ผ่านเกณฑ์แล้ว ไม่ต้องทำซ้ำ')); return box; }
  if(pi.reviewLocked) box.append(el('p',{class:'revlock'},last.message||`ยังไม่ถึงเกณฑ์ ${pi.passPct}% ทบทวนเนื้อหาและแบบฝึกหัดของบทนี้แล้วทำใหม่ เฉลยจะแสดงเมื่อผ่านเกณฑ์หรือใช้สิทธิ์ครบ`));
  if(!pi.canRetake){
    if(pi.max>1&&pi.left===0) box.append(el('p',{class:'msg bad'},POST_ERR.no_attempts));
    return box;
  }
  const btn=el('button',{class:'btn big',type:'button',onclick:()=>quizPage(L,'post',{retake:true})},`ทำแบบทดสอบใหม่ (ครั้งที่ ${pi.attempts+1} จาก ${pi.max})`);
  const wait=el('p',{class:'cooldown'});
  const tick=()=>{ const ms=pi.nextAt?pi.nextAt-now():0;
    if(ms>0){ btn.disabled=true; wait.textContent=`ต้องรอก่อนทำครั้งถัดไป: ทำใหม่ได้เวลา ${hhmm(pi.nextAt)} น. (อีก ${waitText(ms)})`; }
    else{ btn.disabled=false; wait.textContent='ทำครั้งถัดไปได้แล้ว ทบทวนเนื้อหาก่อนทำจะช่วยให้ผ่านเกณฑ์'; pi.nextAt=null; stopPathTimer(); } };
  tick(); stopPathTimer(); if(pi.nextAt) PATH_TMR=setInterval(()=>{ if(!btn.isConnected) return stopPathTimer(); tick(); },1000);
  box.append(wait,el('div',{class:'row'},btn,el('a',{class:'btn ghost',href:`#/lesson/${L.id}/content`},'ทบทวนเนื้อหา')));
  return box;
}

/* breadcrumb: [[label,href],...,[label]] (last = current page) */
function crumbs(items){
  return el('nav',{class:'crumbs','aria-label':'เส้นทางนำทาง'},el('ol',{},items.map((x,i)=>el('li',{},
    i<items.length-1&&x[1]?el('a',{href:x[1]},x[0]):el('span',{'aria-current':'page'},x[0])))));
}
const STEP_TH={overview:'ภาพรวม',pre:'แบบทดสอบก่อนเรียน',content:'เนื้อหา',lab:'ฝึกปฏิบัติ (แล็บท้ายคาบ)',challenge:'ภารกิจท้าทาย',post:'แบบทดสอบหลังเรียน',summary:'สรุป'};

/* per-section learning guide: lead question + measurable goals at the top, glossary box, key points at the end */
function glossBox(items,open){
  return el('details',{class:'gloss',open:open?'':null},el('summary',{},icon('abc'),'คำศัพท์ในหัวข้อนี้ (',items.length,')'),
    el('dl',{},items.map(g=>el('div',{class:'gterm'},
      el('dt',{},el('span',{class:'gen',lang:'en'},g.en),el('span',{class:'gsay'},'อ่านว่า ',g.say)),
      el('dd',{},el('p',{},g.th),el('p',{class:'gex'},el('b',{},'ตัวอย่าง: '),g.ex))))));
}
function guideTop(s){
  if(!s.lead&&!(s.goals||[]).length&&!(s.gloss||[]).length) return null;
  return el('div',{class:'gtop'},
    s.lead?el('div',{class:'glead'},icon('help'),el('div',{},el('b',{},'ลองคิดก่อนอ่าน'),el('p',{},s.lead))):null,
    (s.goals||[]).length?el('div',{class:'ggoals'},icon('target'),el('div',{},el('b',{},'อ่านหัวข้อนี้จบแล้ว นักเรียนจะ'),el('ul',{},s.goals.map(t=>el('li',{},t))))):null,
    (s.gloss||[]).length?glossBox(s.gloss):null);
}
function guideEnd(s){
  if(!(s.keys||[]).length) return null;
  return el('aside',{class:'gkeys'},el('b',{},icon('key'),'สรุปสำคัญของหัวข้อนี้'),el('ul',{},s.keys.map(t=>el('li',{},t))));
}

/* diagrams: rendered when they come near the screen (lazy), with a full-size view for small screens */
let DGM_IO=null;
function diagramFig(b){
  const svg=(window.NL_DIAGRAMS||{})[b.name];
  const f=el('figure',{class:'dgm'}), d=el('div',{class:'dgmsvg'});
  if(!svg){ d.append(el('p',{class:'muted small'},'แสดงภาพนี้ไม่ได้ ลองโหลดหน้าใหม่')); f.append(d); return f; }
  const vb=(svg.match(/viewBox="0 0 (\d+) (\d+)"/)||[]).slice(1).map(Number);
  const dual=/^\s*<div class="nlfj-dual"/.test(svg);   // 3.0 P4 figures with a wide and a stacked variant: height depends on width, so no placeholder ratio
  if(vb.length===2 && !dual) d.style.aspectRatio=vb[0]+' / '+vb[1];          // keeps the page from jumping before the SVG is inserted
  const t=(svg.match(/<title[^>]*>([^<]*)<\/title>/)||[])[1]||b.caption||'แผนภาพ';
  d.setAttribute('role','img'); d.setAttribute('aria-label',t);
  const put=()=>{ if(d.dataset.done) return; d.dataset.done='1'; d.removeAttribute('role'); d.removeAttribute('aria-label'); d.innerHTML=svg; };
  if(dual) put();                                          // drawn at once so sections below do not move when it appears
  else if('IntersectionObserver' in window){
    if(!DGM_IO) DGM_IO=new IntersectionObserver(es=>es.forEach(e=>{ if(e.isIntersecting){ DGM_IO.unobserve(e.target); e.target._put&&e.target._put(); } }),{rootMargin:'600px 0px'});
    d._put=put; DGM_IO.observe(d);
  } else put();
  const zoom=el('button',{class:'btn ghost sm dgmzoom',type:'button','aria-label':'ขยายภาพ: '+t},'ขยายภาพ');
  zoom.onclick=()=>openDiagram(svg,t,zoom);
  f.append(d,el('div',{class:'dgmbar'},b.caption?el('figcaption',{},b.caption):el('span',{}),zoom));
  return f;
}
function openDiagram(svg,title,from){
  const box=el('div',{class:'dgmbig'}); box.innerHTML=svg;
  const close=()=>{ ov.remove(); document.documentElement.classList.remove('nl-noscroll'); document.removeEventListener('keydown',key); try{ from.focus(); }catch(e){} };
  const key=e=>{ if(e.key==='Escape') close(); };
  const w=el('div',{class:'dgmzoomw'}), sizes=[100,150,200]; let zi=0;
  const zbtn=el('button',{class:'btn ghost sm',type:'button'},'ขนาด 100%');
  const setZ=()=>{ box.style.width=`max(${Math.min(100,sizes[zi])}%, ${Math.round(664*sizes[zi]/100)}px)`; box.style.maxWidth=zi?'none':'1000px'; zbtn.textContent='ขนาด '+sizes[zi]+'%'; };
  zbtn.onclick=()=>{ zi=(zi+1)%sizes.length; setZ(); };
  const ov=el('div',{class:'dgmov',role:'dialog','aria-modal':'true','aria-label':title},
    el('div',{class:'dgmovbar'},el('b',{},title.length>70?title.slice(0,70)+'…':title),zbtn,el('button',{class:'btn sm',type:'button',onclick:close},'ปิด')),
    w);
  w.append(box); setZ();
  ov.addEventListener('click',e=>{ if(e.target===ov) close(); });
  document.addEventListener('keydown',key);
  document.body.append(ov); document.documentElement.classList.add('nl-noscroll');
  ov.querySelector('.dgmovbar .btn.sm:last-child').focus();
}

/* content */
function renderBlock(L,b){
  switch(b.type){
    case 'p': return el('p',{},b.text);
    case 'list': return el('ul',{class:'blist'},b.items.map(t=>el('li',{},t)));
    case 'steps': return el('ol',{class:'bsteps'},b.items.map(t=>el('li',{},t)));
    case 'table': return el('div',{class:'tablewrap'},el('table',{class:'btable'},el('thead',{},el('tr',{},b.head.map(h=>el('th',{},h)))),el('tbody',{},b.rows.map(r=>el('tr',{},r.map(c=>el('td',{},c)))))));
    case 'term': return el('dl',{class:'kterm'},el('dt',{},b.term),el('dd',{},b.text));
    case 'diagram': return diagramFig(b);
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
/* Focus Mode: hides menus, step rail and table of contents, keeps one comfortable reading column */
function setFocus(on){
  document.body.classList.toggle('focus',!!on);
  document.querySelectorAll('.focusbtn').forEach(b=>{ b.setAttribute('aria-pressed',on?'true':'false'); b.lastChild.textContent=on?'ออกจากโหมดอ่าน':'โหมดอ่าน'; });
  let x=document.getElementById('focusexit');
  if(on&&!x){ x=el('button',{id:'focusexit',class:'btn sm',type:'button',onclick:()=>setFocus(false)},'ออกจากโหมดอ่าน (Esc)'); document.body.append(x); }
  if(!on&&x) x.remove();
}
document.addEventListener('keydown',e=>{ if(e.key==='Escape'&&document.body.classList.contains('focus')&&!document.querySelector('.dgmov,.modal')) setFocus(false); });
window.addEventListener('hashchange',()=>{ if(!/\/content/.test(location.hash)) setFocus(false); });
function focusBtn(){
  const on=document.body.classList.contains('focus');
  return el('button',{type:'button',class:'fsbtn focusbtn','aria-pressed':on?'true':'false',title:'ซ่อนเมนูและสารบัญเพื่ออ่านอย่างมีสมาธิ',onclick:()=>setFocus(!document.body.classList.contains('focus'))},icon('book'),el('span',{},on?'ออกจากโหมดอ่าน':'โหมดอ่าน'));
}
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
  const CORE=L.sections.filter(s=>!s.extra), XTRA=L.sections.filter(s=>s.extra);
  const tocList=()=>el('ol',{},L.sections.map(s=>el('li',{class:s.extra?'xtra':null},el('a',{href:`#/lesson/${L.id}/content/${s.id}`,onclick:e=>{ e.preventDefault(); goSec(s.id); },'data-sec':s.id,class:seen(s.id)?'seen':''},s.extra?el('span',{class:'xbadge'},'เสริม'):null,s.title.replace(/^\d+\.\s*/,'')))));
  const toc=el('nav',{class:'ltoc','aria-label':'หัวข้อในบทนี้'},el('b',{},'สารบัญ'),tocList());
  const mtoc=el('details',{class:'mtoc'},el('summary',{},'สารบัญบทนี้ (หลัก ',CORE.length,' หัวข้อ',XTRA.length?` + เสริม ${XTRA.length}`:'',')'),el('nav',{'aria-label':'สารบัญบทนี้'},tocList()));
  const bar=el('i',{}), barTxt=el('span',{});
  const prog=el('div',{class:'lprog',role:'progressbar','aria-label':'ความคืบหน้าการอ่าน','aria-valuemin':'0','aria-valuemax':String(CORE.length)},el('span',{class:'lpbar'},bar),barTxt);
  const drawProg=()=>{ const n=CORE.filter(s=>seen(s.id)).length, nx=XTRA.filter(s=>seen(s.id)).length; bar.style.width=Math.round(n/CORE.length*100)+'%'; barTxt.textContent=`อ่านแล้ว ${n}/${CORE.length} หัวข้อ`+(XTRA.length?` · เสริม ${nx}/${XTRA.length}`:''); prog.setAttribute('aria-valuenow',String(n)); };
  const last=lastOf(L.id), lastSec=last&&L.sections.find(s=>s.id===last);
  const resume=!jump&&lastSec&&lastSec!==L.sections[0]?el('div',{class:'resume'},el('span',{},'อ่านค้างไว้ที่: ',el('b',{},lastSec.title)),el('button',{class:'btn',type:'button',onclick:()=>{ resume.remove(); goSec(lastSec.id); }},'อ่านต่อ')):null;
  function goSec(sid){ const t=document.getElementById('sec-'+sid); if(!t) return; mtoc.open=false;   // close first: the list changes the page height
    const reduce=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
    requestAnimationFrame(()=>{ t.scrollIntoView({behavior:reduce?'auto':'smooth',block:'start'}); try{ t.querySelector('h2').focus({preventScroll:true}); }catch(e){} }); }
  const body=el('div',{class:'lbody'},resume,mtoc,L.sections.map(s=>el('section',{class:'lsec',id:'sec-'+s.id,'data-sec':s.id},
    s.extra&&s===XTRA[0]?el('div',{class:'xdivider'},el('b',{},'เนื้อหาเสริม'),el('span',{},'ความรู้เพิ่มเติมของสัปดาห์นี้ ไม่นับในความคืบหน้าหลัก')):null,
    el('h2',{tabindex:'-1'},s.extra?el('span',{class:'xbadge'},'เนื้อหาเสริม'):null,s.title), guideTop(s), s.blocks.map(b=>renderBlock(L,b)), guideEnd(s), el('div',{class:'secend','data-sec':s.id}))),
    el('div',{class:'panel endcard'},el('h2',{},'อ่านจบแล้ว'),el('p',{},'ต่อไปทำแล็บท้ายคาบเพื่อฝึกปฏิบัติ แล้วทำแบบทดสอบหลังเรียน'),
      el('div',{class:'row'},el('a',{class:'btn big',href:`#/lesson/${L.id}/lab`},'ไปทำแล็บท้ายคาบ'),el('a',{class:'btn ghost',href:`#/lesson/${L.id}/post`},'ไปแบบทดสอบหลังเรียน'))));
  R(app,lessonRail(L.id,'content'),el('div',{class:'ltools'},prog,fontBar(),focusBtn()),el('div',{class:'lgrid'},body,toc));
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
/* summary: questions of this week's lab and challenges worth another look (unsolved, or solved after wrong answers / hints) */
function reviewPanel(L){
  const labs=[labOf(L.id)].concat(challengesOf(L.id)).filter(r=>r&&S.timers[r.id]);
  const items=[];
  labs.forEach(r=>r.tasks.concat(r.vmTasks||[]).forEach(t=>{ const k=t.key; if(!k) return;
    if(!S.done[k]) items.push([r,t,'ยังไม่ผ่าน']); else if((S.att[k]||0)>0||S.hints[k]) items.push([r,t,'ผ่านหลังตอบผิดหรือใช้คำใบ้']); }));
  if(!labs.length) return null;
  return el('section',{class:'panel'},el('h2',{},'หัวข้อที่ควรทบทวน'),
    items.length?el('ul',{class:'revlist'},items.slice(0,12).map(([r,t,why])=>el('li',{},el('a',{href:labHref(r)},t.q.length>110?t.q.slice(0,110)+'…':t.q),el('small',{},` · ${r.exit?'แล็บท้ายคาบ':r.label} · ${why}`))))
      :el('p',{},'ทำแล็บและภารกิจที่เริ่มไว้ได้ถูกต้องครบโดยไม่ต้องใช้คำใบ้'),
    items.length>12?el('p',{class:'muted small'},`และอีก ${items.length-12} ข้อ`):null);
}
const WEEK_SKILLS={w1:['design'],w2:['cabling'],w3:['ipconfig'],w4:['cabling','switching'],w5:['cabling'],w6:['wireless'],w7:['wireless','security'],w8:['ipconfig','subnetting'],w9:['ipconfig'],
  w10:['terminal'],w11:['terminal'],w12:['terminal'],w13:['design','routing'],w14:['troubleshooting'],w15:['security'],w16:['security'],w17:['security'],w18:['security','design']};
function weekSkillsPanel(L){
  if(!(ME&&DBON)) return null;
  const box=el('section',{class:'panel'},el('h2',{},'ทักษะที่เกี่ยวข้องกับสัปดาห์นี้'),el('p',{class:'muted small'},'กำลังโหลด...'));
  api('GET','/api/game/skills').then(d=>{
    const want=WEEK_SKILLS[L.id]||[], list=(d.skills||[]).filter(x=>want.includes(x.id));
    R(box,el('h2',{},'ทักษะที่เกี่ยวข้องกับสัปดาห์นี้'),
      el('ul',{class:'revlist'},list.map(x=>el('li',{},el('b',{},x.th+' '),(x.level?el('span',{class:'lvpill '+(typeof LV_CLASS!=='undefined'?LV_CLASS[x.level]:'l1')},d.levelTh[x.level],el('small',{},' '+x.level)):el('span',{class:'lvpill l0'},'ยังไม่มีหลักฐาน')),
        x.next?el('small',{},' · ถัดไป: '+x.next):null))),
      el('a',{class:'btn ghost sm',href:'#/me'},'ดูทักษะทั้งหมด'));
  }).catch(()=>box.remove());
  return box;
}
/* summary: hands-on evidence of the week (simulator missions graded on the server) */
function practiceSummary(L){
  const c=currOf(L.id); if(!c) return null;
  const all=[['Guided Lab',c.guided],['Independent Lab',c.independent],['Troubleshooting',c.trouble]].filter(x=>x[1].length);
  if(!all.length) return null;
  const box=el('section',{class:'panel'});
  const draw=done=>{ const row=([t,l])=>{ const ds=l.map(m=>(done[m.sim]||{})[m.id]); const p=ds.filter(missionPassed).length, f=ds.filter(missionFull).length;
      return el('div',{},el('small',{},t),el('b',{},ME&&DBON?`${p}/${l.length}`:`${l.length} ภารกิจ`),ME&&DBON&&p?el('small',{},`เต็ม ${f}`):null); };
    R(box,el('h2',{},'ผลการฝึกปฏิบัติ'),el('div',{class:'compare'},all.map(row)),
      el('p',{class:'muted small'},(ME&&DBON?'นับภารกิจที่ผ่าน (ได้อย่างน้อย 70% ของคะแนน) เกณฑ์เดียวกับแฟ้มผลงานและการล็อกแบบทดสอบหลังเรียน ':'เข้าสู่ระบบเพื่อบันทึกผลภารกิจ ')+'· เป้าหมายสัปดาห์นี้: '+c.can.join(' · '))); };
  draw({}); loadSimDone().then(draw);
  return box;
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
        challengesOf(L.id).length?el('div',{},el('small',{},'ภารกิจท้าทาย'),el('b',{},challengesOf(L.id).some(r=>S.timers[r.id])?`${listScore(challengesOf(L.id))}/${listMax(challengesOf(L.id))}`:'–')):null,
        el('div',{},el('small',{},'หลังเรียน'),el('b',{},p.post?`${p.post.score}/${p.post.max}`:'–'))),
      !s.complete?el('p',{class:'muted'},'ยังเหลือ: '+[s.pre!=='done'?'แบบทดสอบก่อนเรียน':null,s.content!=='done'?'อ่านเนื้อหาให้ครบ':null,s.lab!=='done'?'แล็บท้ายคาบ':null,s.post!=='done'?'แบบทดสอบหลังเรียน':null].filter(Boolean).join(', ')):null),
    practiceSummary(L),
    reviewPanel(L),
    weekSkillsPanel(L),
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
      checks:`${s.checks}/${s.checkTotal}`, lab:r&&S.timers[r.id]?`${roomScore(r)}/${roomMax(r)}`:'–', chal:challengesOf(l.id).some(c=>S.timers[c.id])?`${listScore(challengesOf(l.id))}/${listMax(challengesOf(l.id))}`:'–', post:p.post?`${p.post.score}/${p.post.max}`:'–',
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
        el('div',{},el('dt',{},'แบบฝึกหัด'),el('dd',{},x.checks)),el('div',{},el('dt',{},'แล็บ'),el('dd',{},x.lab)),el('div',{},el('dt',{},'ภารกิจท้าทาย'),el('dd',{},x.chal)),
        el('div',{class:'wide'},el('dt',{},'อ่านเนื้อหา'),el('dd',{},bar(x))))))),
    // tablets and computers: one table that scrolls inside its frame, header stays visible
    el('div',{class:'tablewrap restable',tabindex:'0','aria-label':'ตารางผลการเรียน เลื่อนดูได้'},el('table',{class:'btable results'},
      el('thead',{},el('tr',{},el('th',{scope:'col'},'สัปดาห์'),el('th',{scope:'col'},'ก่อนเรียน'),el('th',{scope:'col'},'เนื้อหา'),el('th',{scope:'col'},'แบบฝึกหัด'),el('th',{scope:'col'},'แล็บ'),el('th',{scope:'col'},'ท้าทาย'),el('th',{scope:'col'},'หลังเรียน'),el('th',{scope:'col'},'สถานะ'))),
      el('tbody',{},rows.map(x=>el('tr',{},el('th',{scope:'row'},el('a',{href:'#/lesson/'+x.l.id},x.title)),el('td',{class:'num'},x.pre),el('td',{},bar(x)),el('td',{class:'num'},x.checks),
          el('td',{class:'num'},x.lab),el('td',{class:'num'},x.chal),el('td',{class:'num'},x.post),el('td',{},pill(x))))))),
    el('div',{class:'compare'},el('div',{},el('small',{},'รวมก่อนเรียน'),el('b',{},preT)),el('div',{},el('small',{},'รวมหลังเรียน'),el('b',{},postT)),
      el('div',{},el('small',{},'แล็บท้ายคาบ'),el('b',{},listScore(WEEKS)+'/'+listMax(WEEKS))),el('div',{},el('small',{},'ภารกิจท้าทาย'),el('b',{},listScore(ROOMS)+'/'+listMax(ROOMS)))),
    ME?el('p',{class:'savednote'},'คะแนนทั้งหมดบันทึกในระบบแล้ว ครูดูได้จากแดชบอร์ดครูทันที ไม่ต้องถ่ายภาพหน้าจอส่ง')
      :el('div',{class:'panel'},el('p',{class:'muted'},'รหัสยืนยันสำหรับส่งครู'),el('div',{class:'code'},code()),el('p',{class:'muted small'},'คุณใช้งานแบบผู้เยี่ยมชม คะแนนอยู่ในเครื่องนี้เท่านั้น ถ่ายภาพหน้าจอนี้ส่งครู หรือเข้าสู่ระบบเพื่อให้คะแนนบันทึกอัตโนมัติ'),
        el('button',{class:'btn ghost',onclick:()=>{ if(confirm('ล้างความคืบหน้าทั้งหมดในเครื่องนี้?')){ const n=S.name; S=blank(); S.name=n; save(); route(); } }},'ล้างความคืบหน้าในเครื่องนี้')));
  window.scrollTo(0,0);
}

/* ---------- Progressive Unlock (learning path) ----------
   The server decides every week's status (GET /api/path, server/path.js); this code only shows it.
   Locked weeks still appear (with the reason), so a screen reader hears why; their content is never requested. */
const GUEST_PATH_TEXT='โหมดผู้เยี่ยมชม: อ่านบทเรียนได้ทุกสัปดาห์ แต่ความก้าวหน้าจะไม่ถูกบันทึกและไม่มีการปลดล็อก เข้าสู่ระบบเพื่อเรียนตามลำดับ';
const STATUS_TH={locked:'ล็อก',available:'พร้อมเรียน',in_progress:'กำลังเรียน',completed:'ผ่านแล้ว'};
const LED_OF={locked:'lk',available:'',in_progress:'a',completed:'g'};
let PATH=null, PATH_AT=0, PATH_W=-1, JUST_OPENED={ids:[],at:0};
const isStudent=()=>!!(ME&&DBON&&ME.role==='student');
const pathWeek=id=>PATH&&PATH.weeks?PATH.weeks.find(w=>w.id===id)||null:null;
async function loadPath(force){
  if(!isStudent()){ PATH=null; return null; }
  if(!force&&PATH&&PATH_W===API_WRITES&&Date.now()-PATH_AT<20000) return PATH;
  try{ const p=await api('GET','/api/path'); PATH=p&&Array.isArray(p.weeks)?p:null; PATH_AT=Date.now(); PATH_W=API_WRITES; }
  catch(e){ if(!e.offline) console.warn(e); }
  return PATH;
}
/* status of a week: the server's for a logged-in student; guests and teachers are never locked (derived from their own work) */
function weekStatus(id){
  const w=pathWeek(id); if(w) return w.status;
  const s=stepState(id); return s.complete?'completed':s.started?'in_progress':'available';
}
const statusIcon=(st,cls)=>icon(st,'stic '+(cls||''));
const statusChip=st=>el('span',{class:'stchip st-'+st},statusIcon(st),el('span',{},STATUS_TH[st]));
const thaiDate=d=>new Date(d+'T00:00:00+07:00').toLocaleDateString('th-TH',{day:'numeric',month:'long',year:'numeric'});
const justOpened=id=>Date.now()-JUST_OPENED.at<8000&&JUST_OPENED.ids.includes(id);
/* a week that opened since this device last looked: a short animation and a toast that announces itself and goes away */
function pathAnnounce(){
  if(!PATH||!ME) return;
  const k='netlab-path-open-u'+ME.id, open=PATH.weeks.filter(w=>w.open).map(w=>w.id);
  let prev=null; try{ prev=JSON.parse(localStorage.getItem(k)||'null'); }catch(e){}
  try{ localStorage.setItem(k,JSON.stringify(open)); }catch(e){}
  if(!Array.isArray(prev)) return;              // first look on this device: nothing to announce
  const fresh=open.filter(id=>!prev.includes(id)); if(!fresh.length) return;
  JUST_OPENED={ids:fresh,at:Date.now()};
  app.querySelectorAll('[data-week]').forEach(n=>{ if(fresh.includes(n.dataset.week)) n.classList.add('justopen'); });
  unlockToast(fresh);
}
function unlockToast(ids){
  document.querySelectorAll('.utoast').forEach(x=>x.remove());
  const wk=ids.map(id=>+id.slice(1)).sort((a,b)=>a-b);
  const txt=wk.length===1?`ปลดล็อกสัปดาห์ที่ ${wk[0]} แล้ว เริ่มเรียนได้เลย`:`ปลดล็อกแล้ว ${wk.length} สัปดาห์ (สัปดาห์ที่ ${wk.join(', ')})`;
  const t=el('span',{}), x=el('div',{class:'toast utoast',role:'status'},icon('unlock','uic'),t);
  document.body.append(x); setTimeout(()=>{ t.textContent=txt; },60);   // text set after insertion so screen readers announce it
  setTimeout(()=>x.remove(),5200);
}
const MISSION_TITLE=(wid,ref)=>{ const [sim,id]=ref.split(':'); const c=currOf(wid); const m=c&&c.guided.concat(c.independent||[],c.trouble||[]).find(x=>x.sim===sim&&x.id===id); return m?m.title:`${sim} ${id}`; };
/* the conditions of one week; missing ones link to the activity (links come from the server) */
function critList(w,onlyMissing,noMissions){
  const list=w.criteria.filter(c=>!onlyMissing||!c.done);
  return el('ul',{class:'critlist'},list.map(c=>el('li',{class:c.done?'done':'todo'},
    statusIcon(c.done?'completed':'available'),
    el('div',{},el('b',{},c.label),el('span',{class:'vh'},c.done?' (ผ่านแล้ว)':' (ยังไม่ผ่าน)'),el('small',{},c.detail),
      !noMissions&&c.key==='guided'&&c.missions&&c.missions.length?el('ul',{class:'mlist'},c.missions.map(m=>el('li',{},
        el('a',{href:`#/sim/${m.sim}/${m.mission}`},MISSION_TITLE(w.id,m.ref)),
        ` · ${m.best!=null?`ได้ ${m.best}/${m.max}`:'ยังไม่ได้ทำ'} · `,el('b',{},m.passed?'ผ่าน':'ยังไม่ผ่าน')))):null,
      !c.done?el('a',{class:'clink',href:c.link},'ไปทำ: '+c.label):null))));
}
/* #/lesson/wN of a locked week: the reason only, never the lesson content */
function lockPage(id,lock){
  lock=lock||{}; const m=metaOf(id), n=m?m.week:+String(id).slice(1);
  const cur=PATH&&PATH.summary.current, cm=cur&&metaOf(cur);
  const need=lock.needWeek?pathWeek('w'+lock.needWeek):null;
  const date=lock.openDate||(pathWeek(id)||{}).openDate;
  setTitle(`สัปดาห์ ${n} (ล็อก)`);
  R(app,crumbs([['หน้าแรก','#/'],['บทเรียน','#/learn'],[`สัปดาห์ ${n}`]]),
    el('section',{class:'panel lockpanel','aria-labelledby':'lockh'},
      el('div',{class:'lockic'},statusIcon('locked')),
      el('h1',{id:'lockh',tabindex:'-1'},`สัปดาห์ที่ ${n} ยังล็อกอยู่`),
      el('p',{class:'lockmsg'},lock.message||'บทเรียนนี้ยังไม่เปิด'),
      date?el('p',{class:'lockdate'},'วันเปิดบทเรียน: ',el('b',{},thaiDate(date))):null,
      need&&need.open&&need.missing.length?[el('h2',{},`สิ่งที่ยังต้องทำในสัปดาห์ที่ ${need.week}`),critList(need,true)]:null,
      el('div',{class:'row'},cm?el('a',{class:'btn big',href:'#/lesson/'+cur},`ไปเรียนสัปดาห์ที่ ${cm.week}`):null,
        el('a',{class:'btn ghost',href:'#/learn'},'ดูเส้นทางการเรียน'))));
  window.scrollTo(0,0);
  const h=document.getElementById('lockh'); if(h) h.focus({preventScroll:true});
}
/* dashboard: "เรียนต่อจากจุดล่าสุด" */
function resumePanel(){
  const P=PATH, s=P.summary, cur=s.current&&pathWeek(s.current), m=cur&&metaOf(cur.id), nx=s.next&&metaOf(s.next);
  const stat=(k,v)=>el('div',{},el('dt',{},k),el('dd',{},v));
  if(!cur){
    const lockedW=P.weeks.find(w=>w.status==='locked');
    return el('section',{class:'cont resumep'},el('div',{},el('p',{class:'contk'},'เรียนต่อจากจุดล่าสุด'),
      el('h2',{},s.completed>=s.total?'เรียนผ่านครบทุกสัปดาห์แล้ว':'ยังไม่มีสัปดาห์ที่เปิดให้เรียนตอนนี้'),
      lockedW&&lockedW.lock?el('p',{},`สัปดาห์ที่ ${lockedW.week}: ${lockedW.lock.message}`):null,
      el('dl',{class:'rpstats'},stat('ผ่านแล้ว',`${s.completed} สัปดาห์`),stat('เหลือ',`${s.remaining} สัปดาห์`))),
      el('div',{class:'contbtns'},el('a',{class:'btn big',href:'#/learn'},'ดูเส้นทางการเรียน')));
  }
  const n=nextStep(cur.id), post=cur.criteria.find(c=>c.key==='post'), guided=cur.criteria.find(c=>c.key==='guided');
  const bestPct=post&&post.pct!=null?post.pct:cur.post.bestPct;
  return el('section',{class:'cont resumep',style:`--uc:${UNIT_COLOR(m.unit)}`,'aria-labelledby':'resh'},
    el('div',{class:'rphead'},
      el('div',{},el('p',{class:'contk'},'เรียนต่อจากจุดล่าสุด'),
        el('h2',{id:'resh'},`สัปดาห์ที่ ${cur.week} ${m.title}`),statusChip(cur.status),
        cur.unlockedBy&&cur.unlockedBy.kind==='teacher'?el('p',{class:'muted small'},'ครูปลดล็อกสัปดาห์นี้ให้'+(cur.unlockedBy.reason?`: ${cur.unlockedBy.reason}`:'')):null),
      el('div',{class:'contbtns'},el('a',{class:'btn big',href:`#/lesson/${cur.id}/${n.to}`},`เรียนต่อสัปดาห์ที่ ${cur.week}`),el('small',{class:'muted'},'ขั้นต่อไป: '+n.label))),
    el('dl',{class:'rpstats'},
      stat('ผ่านแล้ว',`${s.completed} สัปดาห์`),stat('เหลือ',`${s.remaining} สัปดาห์`),
      stat('แบบทดสอบหลังเรียน',`${bestPct!=null?`ดีที่สุด ${bestPct}%`:'ยังไม่ได้ทำ'} (เกณฑ์ ${P.rules.passPct}%)`),
      stat('ปลดล็อกถัดไป',nx?`สัปดาห์ที่ ${nx.week}`:P.sequential?'–':'ไม่ได้บังคับเรียนตามลำดับ')),
    guided&&guided.missions&&guided.missions.length?el('div',{class:'rpguided'},el('h3',{},'Guided Lab / ภารกิจจำลอง'),
      el('ul',{class:'mlist'},guided.missions.map(x=>el('li',{},statusIcon(x.passed?'completed':x.best!=null?'in_progress':'available'),
        el('a',{href:`#/sim/${x.sim}/${x.mission}`},MISSION_TITLE(cur.id,x.ref)),` · ${x.best!=null?`ได้ ${x.best}/${x.max}`:'ยังไม่ได้ทำ'} · `,el('b',{},x.passed?'ผ่าน':`ยังไม่ผ่าน (เกณฑ์ ${P.rules.guidedPct}%)`))))):null,
    cur.missing.length?el('div',{class:'rpmiss'},el('h3',{},'เงื่อนไขที่ยังไม่ผ่าน'),critList(cur,true,true)):el('p',{class:'msg ok'},'ครบทุกเงื่อนไขของสัปดาห์นี้แล้ว'));
}
/* #/learn: the 18 weeks as a stepwise path (vertical with connectors on phones, a grid on wider screens) */
function pathPage(){
  const P=PATH, cur=P&&P.summary.current;
  const legend=el('ul',{class:'lplegend','aria-label':'ความหมายของสถานะ'},['completed','in_progress','available','locked'].filter(k=>k!=='locked'||(P&&P.sequential)).map(k=>el('li',{class:'st-'+k},statusIcon(k),STATUS_TH[k])));
  const note=!ME&&DBON?guestBanner('learn')
    :P&&!P.sequential?el('p',{class:'muted small'},'ห้องเรียนนี้ไม่ได้บังคับเรียนตามลำดับ เปิดเรียนได้ทุกสัปดาห์ สถานะบอกความคืบหน้าของแต่ละสัปดาห์')
    :ME&&!isStudent()?el('p',{class:'muted small'},'บัญชีครูเปิดได้ทุกสัปดาห์ นักเรียนในห้องที่เปิดการเรียนตามลำดับจะเห็นสัปดาห์ที่ยังไม่ผ่านเป็นล็อก'):null;
  const sum=P?el('p',{class:'lpsum'},`ผ่านแล้ว ${P.summary.completed} จาก ${P.summary.total} สัปดาห์`,cur?` · สัปดาห์ปัจจุบัน: สัปดาห์ที่ ${+cur.slice(1)}`:''):null;
  const card=l=>{
    const w=pathWeek(l.id), st=w?w.status:weekStatus(l.id), isCur=cur===l.id;
    const href=st==='completed'?`#/lesson/${l.id}/summary`:'#/lesson/'+l.id;
    return el('li',{class:`lpstep st-${st}${isCur?' cur':''}${justOpened(l.id)?' justopen':''}`,'data-week':l.id,style:`--uc:${UNIT_COLOR(l.unit)}`},
      el('a',{class:'lpcard',href,'aria-current':isCur?'step':null},
        el('span',{class:'lpic'},statusIcon(st)),
        el('span',{class:'lpbody'},
          el('span',{class:'lpwk'},`สัปดาห์ที่ ${l.week} · หน่วยที่ ${l.unit}`),
          el('b',{class:'lpt'},l.title),
          el('span',{class:'lpst'},el('span',{class:'vh'},'สถานะ: '),STATUS_TH[st],isCur?' · สัปดาห์ปัจจุบัน':''),
          st==='locked'&&w&&w.lock?el('span',{class:'lplock'},w.lock.message,w.lock.openDate?` (เปิด ${thaiDate(w.lock.openDate)})`:''):null,
          st!=='locked'&&w&&w.openDate&&st!=='completed'?el('span',{class:'lpnote'},`วันเปิดบทเรียน ${thaiDate(w.openDate)}`):null,
          w&&w.unlockedBy?el('span',{class:'lpnote'},w.unlockedBy.kind==='teacher'?'ครูปลดล็อกให้':'เปิดไว้เพราะเคยเรียนสัปดาห์นี้แล้ว'):null,
          w&&w.post.bestPct!=null?el('span',{class:'lpnote'},`หลังเรียนดีที่สุด ${w.post.bestPct}% (เกณฑ์ ${P.rules.passPct}%)`):null,
          isCur&&w&&w.missing.length?el('span',{class:'lpnote'},'ยังขาด: '+w.criteria.filter(c=>!c.done).map(c=>c.label).join(', ')):null,
          st==='completed'?el('span',{class:'lpgo'},'ทบทวน'):st!=='locked'?el('span',{class:'lpgo'},st==='in_progress'?'เรียนต่อ':'เริ่มเรียน'):null)));
  };
  return el('div',{class:'lpwrap'},note,legend,sum,el('ol',{class:'unitlist lpath','aria-label':'เส้นทางการเรียน 18 สัปดาห์'},LMETA.map(card)));
}

/* ---------- boot ---------- */
async function boot(){
  applyRail();
  R(app,el('p',{class:'loading'},'กำลังโหลดบทเรียน...'));
  let c;
  try{ [c,LMETA]=await Promise.all([api('GET','/api/content?v=29'),api('GET','/api/lessons')]); try{ CURR=await api('GET','/api/curriculum'); }catch(e){ CURR=null; } }
  catch(e){ R(app,el('div',{class:'panel'},el('p',{},'โหลดบทเรียนไม่สำเร็จ '+(e.offline?'กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ต':'')),el('button',{class:'btn',onclick:boot},'ลองใหม่'))); return; }
  ROOMS=c.rooms; WEEKS=c.weeks; ALL=ROOMS.concat(WEEKS);
  try{ applyMe(await api('GET','/api/me')); }catch(e){ loadGuest(); }
  mergeGuestCredit();   // 2.9: guests keep credit for merged questions too
  document.getElementById('scrim').addEventListener('click',closeDrawer);
  document.addEventListener('keydown',e=>{ if(e.key==='Escape'&&document.body.classList.contains('drawer')) closeDrawer(); });
  applyRail();
  route(); flushQueue();
  setTimeout(()=>document.body.classList.add('ready'),400);   // animate the sidebar only after the first layout
  if(ME&&ME.mustChangePw) pwModal(true);
}
boot();
window.addEventListener('beforeprint',()=>document.querySelectorAll('.dgmsvg').forEach(d=>d._put&&d._put()));

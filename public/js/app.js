'use strict';
/* NetLab app shell: routing, sidebar, dashboard, lessons (pre-test, content, practical, post-test, summary), results */

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
  unlock:'<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7.5a4 4 0 0 1 7.6-1.8M12 15v2"/>',
  /* lesson-step statuses: todo (empty ring), doing (half), done (check), review (redo arrow) */
  st_review:'<path d="M5 12a7 7 0 1 0 2.1-5"/><path d="M5 4.5V9h4.5"/>',
  st_extra:'<circle cx="12" cy="12" r="8.5" stroke-dasharray="3.2 2.6"/><path d="M12 8.5v7M8.5 12h7"/>'
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

/* ---------- lesson progress ----------
   3.2: five steps pre (ก่อนเรียน), content (เนื้อหา), lab (ฝึกปฏิบัติ), post (หลังเรียน), summary (สรุปผล); each is todo / doing / done / review.
   A logged-in student gets them from the server (GET /api/path, week.steps: learn -> content, practice -> lab); guests, teachers and
   offline use the same rules here:
     pre      taken
     content  every core section read AND every core in-lesson exercise correct
     lab      the week's practical session (Guided + Independent + Troubleshooting under one timer) passed; it is scored on the
              server, so without a student account it stays "todo"
     post     best score >= the pass mark (taken but below = review)
     summary  pre, content, lab and post all done */
const STEP_ST_TH={todo:'ยังไม่เริ่ม',doing:'กำลังทำ',done:'ผ่านแล้ว',review:'ต้องทบทวน'};
const STEP_IC={todo:'available',doing:'in_progress',done:'completed',review:'st_review'};
const stCls=(st,key)=>st==='review'?'needrev':key==='pre'&&st==='done'?'taken':st;   // class of a step state ('.review' is the post-test answer list; the pre-test has no pass mark, so it is 'taken', never 'done')
const stText=(st,key)=>key==='pre'&&st==='done'?'ทำแล้ว':STEP_ST_TH[st]||'';
const stepChip=(st,extra)=>el('span',{class:'sschip ss-'+st},icon(STEP_IC[st]||'available'),el('span',{},STEP_ST_TH[st]||st),extra?el('span',{class:'ssx'},extra):null);
const passPctOf=()=>(PATH&&PATH.rules&&PATH.rules.passPct)||70;
/* pass mark, weights and attempts of the practical step (the class settings; defaults for guests) */
const pracRules=()=>(PATH&&PATH.rules&&PATH.rules.practical)||{passPct:70,weights:{guided:30,independent:40,trouble:30},maxAttempts:3,cooldownMin:10};
/* number of in-lesson exercises in the core sections (supplementary sections come after them, so their indexes are 0..n-1) */
const CORECHK_K='netlab-corechecks';
function coreChecksOf(id){
  const m=metaOf(id); if(m&&m.coreChecks!=null) return m.coreChecks;
  const L=LCACHE[id];
  if(L&&L.sections){ let n=0; L.sections.forEach(s=>{ if(!s.extra) (s.blocks||[]).forEach(b=>{ if(b.type==='check') n++; }); });
    try{ const o=JSON.parse(localStorage.getItem(CORECHK_K)||'{}'); if(o[id]!==n){ o[id]=n; localStorage.setItem(CORECHK_K,JSON.stringify(o)); } }catch(e){}
    return n; }
  try{ const o=JSON.parse(localStorage.getItem(CORECHK_K)||'{}'); if(o[id]!=null) return o[id]; }catch(e){}
  return m?m.checks:0;   // unknown: count every exercise (stricter, never a false "done")
}
function stepState(id){
  const m=metaOf(id), p=LP(id);
  const core=m?m.sections.filter(x=>!x.extra):[];   // supplementary sections (extra) do not count towards "content finished"
  const visited=(p.visited||[]).filter(s=>core.some(x=>x.id===s)).length;
  const coreN=coreChecksOf(id), checksOk=(p.checks||[]).filter(i=>i<coreN).length;
  const post=p.post, postPct=post&&post.max?100*post.score/post.max:null;
  const local={
    pre:p.pre?'done':'todo',
    content:core.length&&visited>=core.length&&checksOk>=coreN?'done':(visited||(p.checks||[]).length)?'doing':'todo',
    lab:'todo',
    post:!post?'todo':(post.passed!=null?post.passed:postPct>=passPctOf())?'done':'review'
  };
  local.summary=['pre','content','lab','post'].every(k=>local[k]==='done')?'done':'todo';
  const w=pathWeek(id), ws=w&&w.steps;
  const st=ws?{pre:ws.pre,content:ws.learn,lab:ws.practice,post:ws.post,summary:ws.summary}:local;
  if(activeWeek()===id&&st.lab==='todo') st.lab='doing';
  Object.assign(st,{visited,sections:core.length,extras:m?m.sections.length-core.length:0,checks:checksOk,checkTotal:coreN,practice:w&&w.practice?w.practice:null});
  st.complete=st.summary==='done';
  st.started=['pre','content','lab','post'].some(k=>st[k]!=='todo');
  return st;
}
function nextStep(id){
  const s=stepState(id);
  if(s.pre!=='done') return {to:'pre',label:'ทำแบบทดสอบก่อนเรียน'};
  if(s.content!=='done') return {to:'content',label:s.visited?'เรียนเนื้อหาต่อ':'เริ่มเรียนเนื้อหา'};
  if(s.lab!=='done') return {to:'lab',label:activeWeek()===id?'ฝึกปฏิบัติต่อ (กำลังจับเวลา)':s.lab==='review'?'ทบทวนแล้วฝึกปฏิบัติอีกรอบ':s.lab==='doing'?'ฝึกปฏิบัติต่อ':'เริ่มฝึกปฏิบัติ'};
  if(s.post!=='done') return {to:'post',label:s.post==='review'?'ทบทวนแล้วทำแบบทดสอบหลังเรียนอีกครั้ง':'ทำแบบทดสอบหลังเรียน'};
  return {to:'summary',label:'ดูสรุปผล'};
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
  document.querySelectorAll('#prRecNote').forEach(x=>x.remove());
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
  if(isStudent()) activeLoad(); else if(ACT.s||ACT.over){ ACT.s=null; ACT.over=null; activeDraw(); }   // 3.2: the global practical timer bar
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
    if(h==='#/credits') return await creditsPage();
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
    if((m=h.match(/^#\/room\/(r\d+)$/))){ const rr=ALL.find(r=>r.id===m[1]); if(rr){ location.replace(labHref(rr)); return; } }   // old links -> the practical step of the host week
    if((m=h.match(/^#\/lesson\/(w\d+)(?:\/(pre|content|lab|solve|extra|challenge|post|summary))?(?:\/([sx]\w+|r\d+))?$/))) return await lessonPage(m[1],m[2]||'overview',m[3]);
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
  ['เรียนทีละสัปดาห์ 5 ขั้น','แต่ละสัปดาห์มี 5 ขั้น: 1 ก่อนเรียน (แบบทดสอบก่อนเรียน) 2 เนื้อหา (คำถามนำ ภาพ สื่อ Interactive และแบบฝึกหัด) 3 ฝึกปฏิบัติ 4 หลังเรียน (แบบทดสอบหลังเรียน) 5 สรุปผล','#/lesson/w1','เปิดสัปดาห์ที่ 1'],
  ['ฝึกปฏิบัติเวลาเดียว 3 ส่วน','ขั้นฝึกปฏิบัติมี 3 ส่วนต่อกัน: Guided Lab (ฝึกตามขั้นตอน) Independent Lab (ฝึกด้วยตนเอง) และ Troubleshooting Lab (ฝึกแก้ปัญหาเครือข่าย) กดเริ่มครั้งเดียว ใช้เวลารวมชุดเดียว เวลาเดินต่อแม้เปิดห้องจำลองหรือโหลดหน้าใหม่ ส่งงานแล้วได้คะแนนรวมครั้งเดียว','#/sims','ดูห้องปฏิบัติการจำลอง'],
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
function helpPage(){ setTitle('วิธีใช้งาน'); R(app,el('h1',{},'วิธีใช้งาน NetLab'),onboardCard(true),el('p',{class:'muted small'},'ภาพถ่ายอุปกรณ์ในบทเรียนเป็นภาพจริง ',el('a',{href:'#/credits'},'ดูที่มาและสัญญาอนุญาตของภาพ'))); window.scrollTo(0,0); }

function continueCard(){
  let target=LMETA.find(l=>{ const s=stepState(l.id); return s.started&&!s.complete; })||LMETA.find(l=>!stepState(l.id).complete);
  const asg=ME&&ASSIGN.filter(a=>a.labId.startsWith('w')&&!asgDone(a.labId)).sort((a,b)=>(a.due||9e15)-(b.due||9e15))[0];
  if(asg) target=metaOf(asg.labId)||target;
  if(!target) return el('section',{class:'panel'},el('h2',{},'เรียนครบทุกสัปดาห์แล้ว'),el('p',{},'ทบทวนได้จากรายการบทเรียน และฝึกทำข้อสอบในคลังข้อสอบ'));
  const n=nextStep(target.id), s=stepState(target.id);
  return el('section',{class:'cont',style:`--uc:${UNIT_COLOR(target.unit)}`},
    el('div',{},el('p',{class:'contk'},asg?'งานที่ครูมอบหมาย':(s.started?'เรียนต่อจากครั้งก่อน':'บทเรียนถัดไป')),
      el('h2',{},`สัปดาห์ ${target.week} ${target.title}`),
      el('p',{class:'muted'},`หน่วยที่ ${target.unit} ${UNITS[target.unit-1]}`),
      asg&&asg.due?el('p',{class:'duehint'},'ครูกำหนดส่งงานฝึกปฏิบัติภายใน '+fmtDate(asg.due)):null,
      miniRail(target.id)),
    (()=>{ const ls=n.to==='content'&&lastOf(target.id); const sec=ls&&target.sections.find(x=>x.id===ls);
      return el('div',{class:'contbtns'},el('a',{class:'btn big',href:`#/lesson/${target.id}/${n.to}`+(sec?'/'+sec.id:'')},sec?'เรียนต่อ':n.label),
        sec?el('small',{class:'muted'},'จากหัวข้อ: '+sec.title):null); })());
}
function miniRail(id){
  const s=stepState(id);
  /* icon + text per step (a check only for a step that is really done); the status word is read by screen readers */
  const seg=(k,txt)=>el('span',{class:'seg '+stCls(s[k],k),'data-step':k},icon(STEP_IC[s[k]]||'available','segic'),txt,el('span',{class:'vh'},` (${stText(s[k],k)})`));
  const pr=s.practice&&s.practice.best!=null?` ${s.practice.best}%`:'';
  return el('div',{class:'minirail',role:'group','aria-label':'ขั้นตอนบทเรียน 5 ขั้น'},seg('pre','ก่อนเรียน'),seg('content','เนื้อหา'),seg('lab','ฝึกปฏิบัติ'+pr),seg('post','หลังเรียน'),seg('summary','สรุปผล'));
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
/* an assignment of a week is done once its practical has a result (3.2); a former room counts its earlier timed run */
const asgDone=id=>{ const w=pathWeek(id); if(w&&w.practice) return w.practice.best!=null; const t=S.timers[id]; return !!(t&&t.status!=='running'); };
function assignPanel(){
  if(!ME||!ASSIGN.length) return null;
  return el('section',{class:'panel'},el('h2',{},'งานที่ครูมอบหมาย'),el('ul',{class:'asglist'},ASSIGN.map(a=>{ const r=labOf(a.labId); if(!r) return null;
    const done=asgDone(r.id); const over=a.due&&now()>a.due&&!done;
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
          el('span',{class:'ltitle'},l.title,due&&due.due?el('small',{class:'due'},' · ส่งงาน '+fmtDate(due.due)):null,st?[' ',statusChip(st)]:null),
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
    el('p',{class:'lede'},'เส้นทางการเรียน (Learning Path) ตามแผนการจัดการเรียนรู้วิชาระบบเครือข่ายคอมพิวเตอร์ แต่ละสัปดาห์มี 5 ขั้น: ก่อนเรียน เนื้อหา ฝึกปฏิบัติ (Guided Lab, Independent Lab และ Troubleshooting Lab ในเวลาชุดเดียว) หลังเรียน และสรุปผล'),
    pathPage());
  window.scrollTo(0,0);
}

/* ---------- search results: the week labs (their hands-on tasks are done in the week's practical step) ---------- */
function roomCard(r){
  const n=r.tasks.length+(r.vmTasks||[]).length;
  return el('li',{},el('a',{class:'room',href:labHref(r)},
    el('div',{class:'strip',style:`background:${r.color}`}),
    el('div',{class:'body'},el('div',{class:'num'},r.label,el('span',{class:'tag'},'ฝึกปฏิบัติ'),r.terminal?el('span',{class:'tag'},'Terminal Simulator'):null,r.vmTasks?el('span',{class:'tag vm'},'เครื่องจำลอง Linux'):null),el('h2',{},r.title)),
    el('div',{class:'stat'},el('b',{},String(n)),'โจทย์ลงมือ')));
}
/* 3.0: the practice plan of each week comes from content/curriculum.js (GET /api/curriculum) */
let CURR=null, SIMDONE=null;
const currOf=id=>CURR&&CURR.weeks.find(w=>w.id===id);
const MLEVEL_TH={easy:'ง่าย',medium:'ปานกลาง',hard:'ยาก'};
/* one rule everywhere (portfolio, simulator hub): a mission is passed at >= 70 % of its score */
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

/* ---------- 3.2 global practical timer bar ----------
   While a practical session runs (GET /api/practical/active), every page of the student app shows a compact sticky bar with
   the time left and a link back to the lab page. Server clock: offset from the reply's `now`; refreshed on every route change
   and every 60 s, counted down here every second. At 0 it asks again (the server closes the session) and says it was sent. */
const ACT={s:null,off:0,over:null,net:false,busy:false};
const activeWeek=()=>ACT.s&&ACT.s.deadline>Date.now()+ACT.off?ACT.s.week:null;
let ACT_POLL=null, ACT_TICK=null;
async function activeLoad(){
  if(!isStudent()){ ACT.s=null; ACT.over=null; activeDraw(); return; }
  if(ACT.busy) return; ACT.busy=true;
  const t0=Date.now();
  try{
    const r=await api('GET','/api/practical/active');
    ACT.off=r.now-(t0+Date.now())/2; ACT.net=false;
    const prev=ACT.s;
    ACT.s=r.session||null;
    if(prev&&!ACT.s&&prev.deadline<=Date.now()+ACT.off+3000) ACT.over={week:prev.week};   // closed by the timer, not by "ส่งงานทั้งหมด"
    if(ACT.s) ACT.over=null;
    if(prev&&(!ACT.s||ACT.s.id!==prev.id)) loadPath(true).then(()=>renderShell());
  }catch(e){ ACT.net=!!(e.offline||!e.status||e.status>=500); }
  ACT.busy=false;
  if(!ACT_POLL&&isStudent()) ACT_POLL=setInterval(activeLoad,60000);
  activeDraw();
}
function activeDraw(){
  let bar=document.getElementById('prBar');
  const h=location.hash||'#/', s=ACT.s, over=ACT.over;
  const onLab=wk=>h===`#/lesson/${wk}/lab`;
  const show=isStudent()&&!document.body.classList.contains('authmode')&&((s&&!onLab(s.week))||(over&&!onLab(over.week)));
  if(!show){ if(bar) bar.remove(); document.documentElement.style.setProperty('--nl-prbar','0px'); if(ACT_TICK){ clearInterval(ACT_TICK); ACT_TICK=null; } return; }
  if(!bar){ bar=el('div',{id:'prBar',class:'prbar',role:'status'}); app.before(bar); }
  if(s){
    bar.className='prbar'; bar.dataset.week=s.week;
    R(bar,el('span',{class:'prbt'},`ฝึกปฏิบัติ สัปดาห์ ${s.week.slice(1)}`),el('span',{class:'prbl'},'เหลือ ',el('b',{id:'prBarClock'},prClockText(s.deadline-Date.now()-ACT.off))),
      ACT.net?el('span',{class:'prbnet'},'ขาดการเชื่อมต่อ เวลายังเดินต่อที่เซิร์ฟเวอร์'):null,
      el('a',{id:'prBarLink',class:'prbgo',href:`#/lesson/${s.week}/lab`},'กลับไปทำต่อ'));
    if(!ACT_TICK) ACT_TICK=setInterval(activeTick,1000);
  }else{
    bar.className='prbar over'; bar.dataset.week=over.week;
    R(bar,el('span',{class:'prbt'},`ฝึกปฏิบัติ สัปดาห์ ${over.week.slice(1)}: หมดเวลา ระบบส่งงานให้อัตโนมัติ`),
      el('a',{id:'prBarLink',class:'prbgo',href:`#/lesson/${over.week}/lab`,onclick:()=>{ ACT.over=null; }},'ดูผล'),
      el('button',{class:'prbx',type:'button','aria-label':'ปิดข้อความนี้',onclick:()=>{ ACT.over=null; activeDraw(); }},icon('close')));
    if(ACT_TICK){ clearInterval(ACT_TICK); ACT_TICK=null; }
  }
  document.documentElement.style.setProperty('--nl-prbar',bar.offsetHeight+'px');
}
function activeTick(){
  const s=ACT.s; if(!s) return;
  const ms=s.deadline-Date.now()-ACT.off;
  const c=document.getElementById('prBarClock'); if(c) c.textContent=prClockText(ms);
  const bar=document.getElementById('prBar'); if(bar) bar.classList.toggle('warn',ms<=5*60000);
  if(ms<=0&&!ACT.busy&&!ACT.ending){ ACT.ending=true; activeLoad().then(()=>{ ACT.ending=false; if(ACT.s&&ACT.s.deadline-Date.now()-ACT.off<=0) setTimeout(activeLoad,3000); }); }
}
/* the simulator page: a submit of a mission that belongs to a practical session (POST /api/sims/:sim/submit -> practical) */
function prRecorded(p){
  if(!p||!p.week) return;
  document.querySelectorAll('#prRecNote').forEach(x=>x.remove());
  const n=p.week.slice(1);
  const note=p.recorded
    ?el('p',{id:'prRecNote',class:'prrec ok',role:'status','data-week':p.week},icon('completed'),el('span',{},`บันทึกลงฝึกปฏิบัติสัปดาห์ ${n} แล้ว `),el('a',{href:`#/lesson/${p.week}/lab`},'ดูความคืบหน้า'))
    :el('p',{id:'prRecNote',class:'prrec',role:'status','data-week':p.week},icon('help'),el('span',{},`ภารกิจนี้อยู่ในฝึกปฏิบัติสัปดาห์ ${n} ผลครั้งนี้ไม่นับในฝึกปฏิบัติ เพราะยังไม่ได้กดเริ่มฝึกปฏิบัติของสัปดาห์นั้นหรือหมดเวลาแล้ว `),el('a',{href:`#/lesson/${p.week}/lab`},'ไปหน้าฝึกปฏิบัติ'));
  app.prepend(note);
  if(p.recorded) activeLoad();
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
  const labs=WEEKS.filter(r=>hit((r.title+' '+r.label+' '+r.tasks.map(t=>t.q).join(' ')).toLowerCase()));
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
    labs.length?[el('h2',{class:'sech'},`ฝึกปฏิบัติ (${labs.length})`),el('ul',{class:'rooms'},labs.map(roomCard))]:null);
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
/* the 5-step rail; opt.crumbs replaces the last breadcrumb */
function lessonRail(id,active,opt){
  const m=metaOf(id), s=stepState(id), p=LP(id);
  const step=(key,n,label,sub,state)=>el('a',{class:'rstep '+stCls(state,key)+(active===key?' on':''),href:`#/lesson/${id}/${key}`,'data-step':key,'aria-current':active===key?'step':null},
    el('span',{class:'rn'},state==='done'?icon('completed'):state==='review'?icon('st_review'):el('span',{},n)),
    el('span',{class:'rl'},label,el('span',{class:'rst'},stText(state,key)),el('small',{},sub)));
  const pass=passPctOf(), pr=s.practice, prPass=(pr&&pr.passPct)||pracRules().passPct;
  const labSub=activeWeek()===id?'กำลังจับเวลา':pr&&pr.best!=null?`ดีที่สุด ${pr.best}% · เกณฑ์ ${prPass}%`:`${prLocalPlan(id).minutes} นาที · เกณฑ์ ${prPass}%`;
  const tail=opt&&opt.crumbs?opt.crumbs:active&&active!=='overview'?[[STEP_TH[active]]]:[];
  const head=el('div',{class:'lhead',style:`--uc:${UNIT_COLOR(m.unit)}`},
    crumbs([['หน้าแรก','#/'],['บทเรียน','#/learn'],[`สัปดาห์ ${m.week}`,'#/lesson/'+id]].concat(tail).map((x,i,a)=>i===a.length-1?[x[0]]:x)),
    el('a',{class:'lcrumb',href:'#/lesson/'+id},`สัปดาห์ ${m.week} · หน่วยที่ ${m.unit} ${UNITS[m.unit-1]}`),
    el('h1',{},m.title),
    el('nav',{class:'rail','aria-label':'ขั้นตอนบทเรียน 5 ขั้น'},
      step('pre',1,'ก่อนเรียน',p.pre?`${p.pre.score}/${p.pre.max}`:'10 ข้อ',s.pre),
      step('content',2,'เนื้อหา',`หลัก ${s.visited}/${s.sections}${s.extras?` (+เสริม ${s.extras})`:''} · ฝึก ${s.checks}/${s.checkTotal}`,s.content),
      step('lab',3,'ฝึกปฏิบัติ',labSub,s.lab),
      step('post',4,'หลังเรียน',p.post?`ดีที่สุด ${p.post.score}/${p.post.max} · เกณฑ์ ${pass}%`:`10 ข้อ · เกณฑ์ ${pass}%`,s.post),
      step('summary',5,'สรุปผล',s.summary==='done'?'ผ่านสัปดาห์นี้แล้ว':'สิ่งที่ยังต้องทำ',s.summary)));
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
  /* 3.2: the former step 4 (ฝึกแก้ปัญหา), the optional review sets and the challenge rooms are part of ฝึกปฏิบัติ now */
  if(tab==='solve'||tab==='extra'||tab==='challenge'){ location.replace(`#/lesson/${id}/lab`); return; }
  setTitle(`สัปดาห์ ${metaOf(id).week}`);
  /* Progressive Unlock: a locked week shows only why it is locked (the server refuses its content anyway: 403 locked) */
  if(isStudent()&&PATH){
    let w=pathWeek(id);
    if(w&&!w.open&&Date.now()-PATH_AT>2000){ await loadPath(true); w=pathWeek(id); if((location.hash||'').indexOf(id)<0) return; }   // a teacher may have just unlocked it
    if(w&&!w.open) return lockPage(id,w.lock);
  }
  if(tab==='lab'&&sec){ location.replace(`#/lesson/${id}/lab`); return; }
  let L;
  try{ [L]=await Promise.all([getLesson(id),tab==='content'?loadFigures():null]); }   // lesson text and figure files download together
  catch(e){ if(e.code!=='locked') throw e; await loadPath(true); renderShell(); if((location.hash||'').indexOf(id)<0) return; return lockPage(id,e.body&&e.body.lock); }
  if((location.hash||'').indexOf(id)<0) return; // navigated away while loading
  if(tab==='overview') return lessonOverview(L);
  if((tab==='pre'||tab==='post')&&!L.quiz){ R(app,lessonRail(L.id,tab),el('div',{class:'panel'},el('h2',{},'ต้องเชื่อมต่ออินเทอร์เน็ต'),el('p',{},'แบบทดสอบก่อนและหลังเรียนตรวจที่เซิร์ฟเวอร์ และไม่เก็บไว้ในเครื่อง เชื่อมต่ออินเทอร์เน็ตแล้วเปิดหน้านี้อีกครั้ง'),el('a',{class:'btn',href:`#/lesson/${L.id}/content`},'อ่านเนื้อหาระหว่างรอ'))); return; }
  if(tab==='pre'||tab==='post') return quizPage(L,tab);
  if(tab==='content') return contentPage(L,sec);
  if(tab==='summary') return summaryPage(L);
  if(tab==='lab') return practicalPage(L);
}
function lessonOverview(L){
  const s=stepState(L.id), n=nextStep(L.id), due=dueOf(L.id);
  R(app,lessonRail(L.id,'overview'),
    el('div',{class:'ovgrid'},
      el('section',{class:'panel'},el('h2',{},'จุดประสงค์การเรียนรู้'),el('ul',{class:'checklist'},L.objectives.map(o=>el('li',{},o)))),
      el('section',{class:'panel'},el('h2',{},'สมรรถนะที่คาดหวัง'),el('p',{},L.competency),
        el('h2',{},'ในบทนี้'),el('p',{class:'muted small'},`หัวข้อหลัก ${L.sections.filter(x=>!x.extra).length} หัวข้อ`+(L.sections.some(x=>x.extra)?` + เนื้อหาเสริม ${L.sections.filter(x=>x.extra).length} หัวข้อ (ไม่นับในความคืบหน้าบังคับ)`:'')),el('ol',{class:'toc'},L.sections.map(x=>el('li',{},x.extra?el('span',{class:'xbadge'},'เสริม'):null,x.title.replace(/^\d+\.\s*/,'')))),
        el('p',{class:'muted small'},`อ่านเนื้อหาประมาณ ${L.minutes} นาที · แบบฝึกหัดระหว่างเรียน ${metaOf(L.id).checks} ข้อ`))),
    due&&due.due?el('p',{class:'duehint'},'ครูกำหนดส่งงานฝึกปฏิบัติภายใน '+fmtDate(due.due)):null,
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
      el('b',{},'ครูกำหนดให้ผ่านฝึกปฏิบัติของสัปดาห์นี้ก่อนทำแบบทดสอบหลังเรียน'),
      el('ul',{},g.missing.map(m=>el('li',{},el('a',{href:m.href||`#/lesson/${L.id}/lab`},m.title||'ฝึกปฏิบัติรวมของสัปดาห์'),
        m.best!=null?` (ดีที่สุด ${m.best}%`:' (ยังไม่ได้ทำ',m.passPct?` ต้องได้อย่างน้อย ${m.passPct}%)`:')')))));
  }).catch(()=>{});
  function upd(){ const n=items.filter(x=>x.get()!=null&&!(Array.isArray(x.get())&&!x.get().length)).length; counter.textContent=locked?'ยังส่งไม่ได้: ผ่านฝึกปฏิบัติก่อน':`ตอบแล้ว ${n} จาก ${items.length} ข้อ`; send.disabled=locked||n<items.length; }
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
      kind==='post'&&(()=>{ const w=pathWeek(L.id); return !!(w&&w.practice&&w.practice.best==null); })()?el('p',{class:'duehint'},'ยังไม่ได้ฝึกปฏิบัติ แนะนำให้ทำขั้นฝึกปฏิบัติก่อน ',el('a',{href:`#/lesson/${L.id}/lab`},'ไปฝึกปฏิบัติ')):null,
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
const STEP_TH={overview:'ภาพรวม',pre:'แบบทดสอบก่อนเรียน',content:'เนื้อหา',lab:'ฝึกปฏิบัติ',post:'แบบทดสอบหลังเรียน',summary:'สรุปผล'};

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

/* 2.16 real photos of real devices: numbered labels on the photo + the same list below it, credit line, zoom */
function photoCredit(c){
  if(!c) return null;
  const bits=[]; const add=x=>{ if(x){ if(bits.length) bits.push(' · '); bits.push(x); } };
  const fname=c.file?String(c.file).replace(/^File:/,''):null;
  if(c.site) add('ภาพถ่าย: '+c.site); else if(c.author) add('ภาพถ่าย');
  if(c.page) add(el('a',{href:c.page,target:'_blank',rel:'noopener'},fname||'หน้าที่มาของภาพ'));
  if(c.author&&c.license) add(el('span',{},'โดย '+c.author+' · ',c.licenseUrl?el('a',{href:c.licenseUrl,target:'_blank',rel:'noopener'},c.license):c.license));
  else if(c.author) add('โดย '+c.author);
  else if(c.license) add(c.licenseUrl?el('a',{href:c.licenseUrl,target:'_blank',rel:'noopener'},c.license):c.license);
  if(!c.verified&&c.site==='Wikimedia Commons') bits.push(' (ดูชื่อผู้ถ่ายและสัญญาอนุญาตที่หน้าไฟล์)');
  if(c.changes) add(c.changes);
  return el('p',{class:'phcredit'},bits);
}
function photoMarks(p){ return (p.labels||[]).map((l,i)=>el('span',{class:'phmark',style:`left:${l.x}%;top:${l.y}%`,'aria-hidden':'true'},String(l.n||i+1))); }
function photoOne(p,big,grid){
  const img=el('img',{src:big?p.src:p.src800,alt:p.alt,width:p.w,height:p.h,loading:big?'eager':'lazy',decoding:'async'});
  const maxW=Math.round(PHOTO_MAX_H*p.w/p.h);   // a tall (portrait) photo is capped at PHOTO_MAX_H px high, centred
  if(!big){ const sw=Math.round(p.w*Math.min(1,800/Math.max(p.w,p.h)));   // real width of the -800 copy (800 is its LONG edge)
    img.srcset=`${p.src800} ${sw}w, ${p.src} ${p.w}w`; img.sizes=grid?'(max-width: 560px) 100vw, 360px':`(max-width: 760px) 100vw, ${Math.min(720,maxW)}px`; }
  img.onerror=()=>{ const b=img.parentNode; if(b&&!b.querySelector('.pherr')) b.append(el('p',{class:'pherr muted small'},'โหลดภาพไม่ได้ ลองโหลดหน้าใหม่')); img.remove(); };
  return el('div',{class:'phbox',style:`aspect-ratio:${p.w} / ${p.h}`+(big?'':`;max-width:${maxW}px`)},img,photoMarks(p));
}
const PHOTO_MAX_H=520;
function photoLegend(p){ return p.labels&&p.labels.length?el('ol',{class:'phlegend'},p.labels.map(l=>el('li',{},l.text))):null; }
function photoFig(b){
  const items=b.items||[]; if(!items.length) return null;
  const f=el('figure',{class:'photo '+(b.layout==='grid'?'phgrid':'phsingle')});
  f.append(el('div',{class:'phlbl'},'ภาพถ่ายอุปกรณ์จริง'));
  const wrap=el('div',{class:'phitems'});
  for(const p of items){
    const zoom=el('button',{class:'btn ghost sm phzoom',type:'button','aria-label':'ขยายภาพ: '+p.title},'ขยายภาพ');
    zoom.onclick=()=>openPhoto(p,zoom);
    const one=photoOne(p,false,b.layout==='grid'); one.classList.add('phtap'); one.onclick=()=>openPhoto(p,zoom);   // tap the photo = the zoom button (keyboard uses the button)
    wrap.append(el('div',{class:'phitem'},one,el('div',{class:'phhead'},el('b',{},p.title),zoom),photoLegend(p),photoCredit(p.credit)));
  }
  f.append(wrap); if(b.caption) f.append(el('figcaption',{},b.caption));
  return f;
}
function openPhoto(p,from){
  const close=()=>{ ov.remove(); document.documentElement.classList.remove('nl-noscroll'); document.removeEventListener('keydown',key); try{ from.focus(); }catch(e){} };
  const key=e=>{ if(e.key==='Escape'){ e.preventDefault(); close(); return; }
    if(e.key==='Tab'){ const f=[...ov.querySelectorAll('a[href],button')]; if(!f.length) return; const a=f[0],z=f[f.length-1];   // keep focus inside the dialog
      if(e.shiftKey&&document.activeElement===a){ e.preventDefault(); z.focus(); } else if(!e.shiftKey&&document.activeElement===z){ e.preventDefault(); a.focus(); } else if(!ov.contains(document.activeElement)){ e.preventDefault(); a.focus(); } } };
  const box=el('div',{class:'phbig'},photoOne(p,true),photoLegend(p),photoCredit(p.credit));
  const ov=el('div',{class:'dgmov phov',role:'dialog','aria-modal':'true','aria-label':p.title},
    el('div',{class:'dgmovbar'},el('b',{},p.title),el('button',{class:'btn sm phclose',type:'button','aria-label':'ปิดภาพขยาย',onclick:close},'ปิด')),
    el('div',{class:'dgmzoomw'},box));
  ov.addEventListener('click',e=>{ if(e.target===ov) close(); });
  document.addEventListener('keydown',key);
  document.body.append(ov); document.documentElement.classList.add('nl-noscroll');
  ov.querySelector('.dgmovbar .btn').focus();
}
async function creditsPage(){
  setTitle('ที่มาของภาพถ่าย');
  R(app,el('p',{class:'loading'},'กำลังโหลด...'));
  let d; try{ d=await api('GET','/api/photo-credits'); }catch(e){ R(app,el('h1',{},'ที่มาของภาพถ่าย'),el('p',{class:'muted'},e.offline?'ต้องต่ออินเทอร์เน็ตเพื่อดูหน้านี้':'โหลดไม่สำเร็จ')); return; }
  R(app,el('h1',{},'ที่มาของภาพถ่าย'),
    el('p',{class:'muted'},'ภาพถ่ายอุปกรณ์ในบทเรียนเป็นภาพจริง ใช้ตามสัญญาอนุญาตของผู้ถ่ายแต่ละภาพ ภาพบางภาพถูกครอปหรือย่อขนาดเพื่อใช้ในบทเรียน'),
    el('ul',{class:'phcredits'},d.photos.map(p=>{
      const c=p.credit||{};
      const who=c.verified?null:el('p',{class:'phcredit'},el('span',{class:'phunv'},'ผู้ถ่ายและสัญญาอนุญาต: ยังไม่ได้ตรวจ'));
      const used=(p.used||[]).length?el('p',{class:'phcredit'},'ใช้ใน: ',(p.used||[]).map((u,i)=>[i?', ':'',el('a',{href:`#/lesson/${u.lesson}/content/${u.section}`},`สัปดาห์ ${u.week} · ${u.title}`)])):null;
      return el('li',{},el('img',{src:p.src800,alt:'',loading:'lazy',decoding:'async',width:80,height:60}),el('div',{},el('b',{},p.title),photoCredit(c),who,used));
    })));
  window.scrollTo(0,0);
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
    case 'photo': case 'photos': return photoFig(b);
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
    el('div',{class:'panel endcard'},el('h2',{},'อ่านจบแล้ว'),el('p',{},'ต่อไปฝึกปฏิบัติ (Guided Lab, Independent Lab และ Troubleshooting Lab ในเวลาชุดเดียว) แล้วทำแบบทดสอบหลังเรียน'),
      el('div',{class:'row'},el('a',{class:'btn big',href:`#/lesson/${L.id}/lab`},'ไปฝึกปฏิบัติ'),el('a',{class:'btn ghost',href:`#/lesson/${L.id}/post`},'ไปแบบทดสอบหลังเรียน'))));
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
const WEEK_SKILLS={w1:['design'],w2:['cabling'],w3:['ipconfig'],w4:['cabling','switching'],w5:['cabling'],w6:['wireless'],w7:['wireless','security'],w8:['ipconfig','subnetting'],w9:['ipconfig'],
  w10:['terminal'],w11:['terminal'],w12:['terminal'],w13:['design','routing'],w14:['troubleshooting'],w15:['security'],w16:['security'],w17:['security'],w18:['security','design']};
/* same wording as the teacher's skill page */
const SKILL_NOTE='ระดับทักษะคำนวณจากภารกิจห้องจำลองและงานฝึกปฏิบัติ (รวมผลจากแล็บเดิมก่อนปรับระบบ) ที่ตรวจจากสภาพเครือข่ายจริง (70%) และผลข้อสอบ (30%) ไม่นับการเปิดอ่านบทเรียน';
function weekSkillsPanel(L){
  if(!(ME&&DBON)) return null;
  const box=el('section',{class:'panel'},el('h2',{},'ทักษะที่เกี่ยวข้องกับสัปดาห์นี้'),el('p',{class:'muted small'},'กำลังโหลด...'));
  api('GET','/api/game/skills').then(d=>{
    const want=WEEK_SKILLS[L.id]||[], list=(d.skills||[]).filter(x=>want.includes(x.id));
    R(box,el('h2',{},'ทักษะที่เกี่ยวข้องกับสัปดาห์นี้'),
      el('ul',{class:'revlist'},list.map(x=>el('li',{},el('b',{},x.th+' '),(x.level?el('span',{class:'lvpill '+(typeof LV_CLASS!=='undefined'?LV_CLASS[x.level]:'l1')},d.levelTh[x.level],el('small',{},' '+x.level)):el('span',{class:'lvpill l0'},'ยังไม่มีหลักฐาน')),
        x.next?el('small',{},' · ถัดไป: '+x.next):null))),
      el('p',{class:'muted small'},SKILL_NOTE),
      el('a',{class:'btn ghost sm',href:'#/me'},'ดูทักษะทั้งหมด'));
  }).catch(()=>box.remove());
  return box;
}
/* summary: the week's practical result: one combined score (best attempt), the part scores and what is not passed yet */
function practiceSummary(L){
  const box=el('section',{class:'panel prsum',id:'prSummary'}), head=el('h2',{},'ผลการฝึกปฏิบัติ');
  const go=(cls,t)=>el('a',{class:'btn '+cls,href:`#/lesson/${L.id}/lab`},t);
  if(!isStudent()){ R(box,head,el('p',{class:'muted small'},ME?'การฝึกปฏิบัติจับเวลาและให้คะแนนกับบัญชีนักเรียน':'เข้าสู่ระบบด้วยบัญชีนักเรียนเพื่อฝึกปฏิบัติและเก็บคะแนน'),go('ghost','ดูรายการกิจกรรมฝึกปฏิบัติ')); return box; }
  R(box,head,el('p',{class:'muted small'},'กำลังโหลด...'));
  api('GET','/api/practical/'+L.id).then(st=>{
    if(!box.isConnected) return;
    const b=st.best;
    if(!b){ R(box,head,el('p',{},st.running?'กำลังฝึกปฏิบัติอยู่ ยังไม่มีผล':'ยังไม่ได้ฝึกปฏิบัติ'),go('',st.running?'ฝึกปฏิบัติต่อ':'ไปฝึกปฏิบัติ')); return; }
    const r=b.result, miss=[].concat(...r.parts.map(p=>p.items)).filter(i=>!i.passed);
    R(box,head,
      el('div',{class:'compare'},el('div',{},el('small',{},'คะแนนรวม (รอบที่ดีที่สุด)'),el('b',{},`${b.total}%`)),
        r.parts.map(p=>el('div',{'data-part':p.id},el('small',{},`${p.title} (${p.weight}%)`),el('b',{},`${p.pct}%`)))),
      el('p',{class:b.passed?'msg ok':'msg bad'},b.passed?`ผ่านเกณฑ์ ${r.passPct}%`:`ยังไม่ผ่านเกณฑ์ ${r.passPct}%`,b.legacy?' (ผลจากงานเดิมก่อนปรับระบบ)':''),
      miss.length?[el('h3',{},'กิจกรรมที่ยังไม่ผ่าน'),el('ul',{class:'revlist'},miss.slice(0,10).map(i=>el('li',{},el('b',{},i.title),i.reason?el('small',{},' · '+i.reason):null))),
        miss.length>10?el('p',{class:'muted small'},`และอีก ${miss.length-10} กิจกรรม`):null]:null,
      go('ghost','เปิดหน้าฝึกปฏิบัติ'));
  }).catch(e=>{ if(box.isConnected) R(box,head,el('p',{class:'muted small'},e.offline?'ต้องเชื่อมต่ออินเทอร์เน็ตเพื่อดูผลฝึกปฏิบัติ':(e.message||'โหลดไม่สำเร็จ')),go('ghost','เปิดหน้าฝึกปฏิบัติ')); });
  return box;
}
/* "สิ่งที่ยังต้องทำ": the unmet conditions of this week. A student gets the server's criteria (with links); others the local step states */
function todoPanel(L){
  const w=pathWeek(L.id), s=stepState(L.id);
  const box=el('section',{class:'panel todop','aria-labelledby':'todoh'},el('h2',{id:'todoh'},'สิ่งที่ยังต้องทำ'));
  if(w&&Array.isArray(w.criteria)){
    const miss=w.criteria.filter(c=>!c.done);
    box.append(w.status==='completed'?el('p',{class:'msg ok'},'ผ่านสัปดาห์นี้แล้ว')
      :miss.length?critList(w,true):el('p',{class:'msg ok'},'ครบทุกเงื่อนไขของสัปดาห์นี้แล้ว'));
    if(w.status!=='completed'&&miss.length) box.append(el('p',{class:'muted small'},'สัปดาห์นี้จะนับว่าผ่านเมื่อทำครบทุกข้อด้านบน'+(PATH&&PATH.sequential?' แล้วสัปดาห์ถัดไปจะปลดล็อก':'')));
    return box;
  }
  const items=localTodos(L,s);
  box.append(!items.length?el('p',{class:'msg ok'},'ครบทุกขั้นหลักของสัปดาห์นี้แล้ว')
    :el('ul',{class:'critlist'},items.map(([t,href])=>el('li',{class:'todo'},icon('available','stic'),el('div',{},el('b',{},t),el('a',{class:'clink',href},'ไปทำ: '+t))))));
  if(!isStudent()) box.append(el('p',{class:'muted small'},ME?'บัญชีครู: ฝึกปฏิบัติจับเวลาและให้คะแนนกับบัญชีนักเรียน':'ผู้เยี่ยมชม: ฝึกปฏิบัติจับเวลาและให้คะแนนที่เซิร์ฟเวอร์กับบัญชีนักเรียน จึงยังนับขั้นฝึกปฏิบัติว่าไม่ผ่าน'));
  return box;
}
/* unmet conditions as [label, link]: the server's criteria for a student, the local step states otherwise */
function localTodos(L,s){
  return [
    s.pre!=='done'&&['ทำแบบทดสอบก่อนเรียน',`#/lesson/${L.id}/pre`],
    s.content!=='done'&&['อ่านเนื้อหาหลักครบทุกหัวข้อ และทำแบบฝึกหัดระหว่างเรียนถูกครบทุกข้อ',`#/lesson/${L.id}/content`],
    s.lab!=='done'&&[`ผ่านฝึกปฏิบัติรวมอย่างน้อย ${pracRules().passPct}%`,`#/lesson/${L.id}/lab`],
    s.post!=='done'&&[`แบบทดสอบหลังเรียนผ่านเกณฑ์ ${passPctOf()}%`,`#/lesson/${L.id}/post`]].filter(Boolean);
}
function weekTodos(L){
  const w=pathWeek(L.id);
  if(w&&Array.isArray(w.criteria)) return w.status==='completed'?[]:w.criteria.filter(c=>!c.done).map(c=>[c.label,c.link]);
  return localTodos(L,stepState(L.id));
}
/* summary buttons: a week that is not completed leads to its first unmet item; the next week is offered only when this week
   is completed or the next week is not locked (guests and teachers are never locked) */
function summaryNav(L){
  const s=stepState(L.id), w=pathWeek(L.id), nextL=LMETA.find(l=>l.week===L.week+1), nw=nextL&&pathWeek(nextL.id);
  const completed=w?w.status==='completed':s.complete, todo=completed?[]:weekTodos(L);
  const nextOpen=!!nextL&&(!nw||nw.open);
  const next=cls=>nextL?el('a',{class:'btn '+cls,href:'#/lesson/'+nextL.id},`ไปสัปดาห์ ${nextL.week}`):el('a',{class:'btn '+cls,href:'#/results'},'ดูผลการเรียนทั้งหมด');
  if(completed||!todo.length) return el('div',{class:'row sumnav'},completed||nextOpen||!nextL?next('big'):null,!completed&&nextL&&!nextOpen?el('p',{class:'muted'},`สัปดาห์ ${nextL.week} ยังล็อกอยู่`):null);
  return el('div',{class:'row sumnav'},el('a',{class:'btn big',href:todo[0][1]},'ไปทำ: '+todo[0][0]),
    nextOpen?next('ghost'):el('p',{class:'muted small'},nextL?`ทำสิ่งที่ยังต้องทำให้ครบก่อน แล้วสัปดาห์ ${nextL.week} จะปลดล็อก`:'ทำสิ่งที่ยังต้องทำให้ครบเพื่อจบบทเรียน'));
}
function summaryPage(L){
  const p=LP(L.id), s=stepState(L.id), pr=s.practice;
  R(app,lessonRail(L.id,'summary'),
    todoPanel(L),
    el('section',{class:'panel'},el('h2',{},'สรุปบทเรียน'),el('ul',{class:'checklist'},L.summary.map(t=>el('li',{},t)))),
    el('section',{class:'panel'},el('h2',{},'ผลของสัปดาห์นี้'),
      el('div',{class:'compare'},
        el('div',{},el('small',{},'ก่อนเรียน'),el('b',{},p.pre?`${p.pre.score}/${p.pre.max}`:'–')),
        el('div',{},el('small',{},'แบบฝึกหัด'),el('b',{},`${s.checks}/${s.checkTotal}`)),
        el('div',{'data-step':'lab'},el('small',{},'ฝึกปฏิบัติ'),el('b',{},pr&&pr.best!=null?`${pr.best}%`:'–')),
        el('div',{},el('small',{},'หลังเรียน'),el('b',{},p.post?`${p.post.score}/${p.post.max}`:'–')))),
    practiceSummary(L),
    weekSkillsPanel(L),
    summaryNav(L));
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
  const rows=LMETA.map(l=>{ const p=LP(l.id), s=stepState(l.id), pr=s.practice;
    return {l,s,title:`สัปดาห์ ${l.week}: ${l.title||'(ไม่มีชื่อบท)'}`,
      pre:p.pre?`${p.pre.score}/${p.pre.max}`:'–', content:s.sections?Math.round(s.visited/s.sections*100):0, contentTxt:`${s.visited}/${s.sections} หัวข้อ`,
      checks:`${s.checks}/${s.checkTotal}`, lab:pr&&pr.best!=null?`${pr.best}% ${pr.passed?'ผ่าน':'ไม่ผ่าน'}`:'–', post:p.post?`${p.post.score}/${p.post.max}`:'–',
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
        el('div',{},el('dt',{},'แบบฝึกหัด'),el('dd',{},x.checks)),el('div',{'data-step':'lab'},el('dt',{},'ฝึกปฏิบัติ'),el('dd',{},x.lab)),
        el('div',{class:'wide'},el('dt',{},'อ่านเนื้อหา'),el('dd',{},bar(x))))))),
    // tablets and computers: one table that scrolls inside its frame, header stays visible
    el('div',{class:'tablewrap restable',tabindex:'0','aria-label':'ตารางผลการเรียน เลื่อนดูได้'},el('table',{class:'btable results'},
      el('thead',{},el('tr',{},el('th',{scope:'col'},'สัปดาห์'),el('th',{scope:'col'},'ก่อนเรียน'),el('th',{scope:'col'},'เนื้อหา'),el('th',{scope:'col'},'แบบฝึกหัด'),el('th',{scope:'col'},'ฝึกปฏิบัติ',el('small',{},'คะแนนรวมรอบที่ดีที่สุด')),el('th',{scope:'col'},'หลังเรียน'),el('th',{scope:'col'},'สถานะ'))),
      el('tbody',{},rows.map(x=>el('tr',{'data-week':x.l.id},el('th',{scope:'row'},el('a',{href:'#/lesson/'+x.l.id},x.title)),el('td',{class:'num'},x.pre),el('td',{},bar(x)),el('td',{class:'num'},x.checks),
          el('td',{class:'num','data-step':'lab'},x.lab),el('td',{class:'num'},x.post),el('td',{},pill(x))))))),
    el('div',{class:'compare'},el('div',{},el('small',{},'รวมก่อนเรียน'),el('b',{},preT)),el('div',{},el('small',{},'รวมหลังเรียน'),el('b',{},postT)),
      el('div',{},el('small',{},`ผ่านฝึกปฏิบัติ (เกณฑ์ ${pracRules().passPct}%)`),el('b',{},isStudent()?`${rows.filter(x=>x.s.practice&&x.s.practice.passed).length}/${rows.length} สัปดาห์`:'–'))),
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
/* the conditions of one week; missing ones link to the activity (links come from the server) */
function critList(w,onlyMissing){
  const list=w.criteria.filter(c=>!onlyMissing||!c.done);
  return el('ul',{class:'critlist'},list.map(c=>el('li',{class:c.done?'done':'todo','data-crit':c.key},
    statusIcon(c.done?'completed':'available'),
    el('div',{},el('b',{},c.label),el('span',{class:'vh'},c.done?' (ผ่านแล้ว)':' (ยังไม่ผ่าน)'),el('small',{},c.detail),
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
  const n=nextStep(cur.id), post=cur.criteria.find(c=>c.key==='post'), pr=cur.practice, prPass=(pr&&pr.passPct)||pracRules().passPct;
  const bestPct=post&&post.pct!=null?post.pct:cur.post.bestPct;
  return el('section',{class:'cont resumep',style:`--uc:${UNIT_COLOR(m.unit)}`,'aria-labelledby':'resh'},
    el('div',{class:'rphead'},
      el('div',{},el('p',{class:'contk'},'เรียนต่อจากจุดล่าสุด'),
        el('h2',{id:'resh'},`สัปดาห์ที่ ${cur.week} ${m.title}`),statusChip(cur.status),miniRail(cur.id),
        cur.unlockedBy&&cur.unlockedBy.kind==='teacher'?el('p',{class:'muted small'},'ครูปลดล็อกสัปดาห์นี้ให้'+(cur.unlockedBy.reason?`: ${cur.unlockedBy.reason}`:'')):null),
      el('div',{class:'contbtns'},el('a',{class:'btn big',href:`#/lesson/${cur.id}/${n.to}`},`เรียนต่อสัปดาห์ที่ ${cur.week}`),el('small',{class:'muted'},'ขั้นต่อไป: '+n.label))),
    el('dl',{class:'rpstats'},
      stat('ผ่านแล้ว',`${s.completed} สัปดาห์`),stat('เหลือ',`${s.remaining} สัปดาห์`),
      stat('ฝึกปฏิบัติ',`${pr&&pr.best!=null?`ดีที่สุด ${pr.best}% ${pr.passed?'ผ่าน':'ยังไม่ผ่าน'}`:activeWeek()===cur.id?'กำลังจับเวลา':'ยังไม่ได้ทำ'} (เกณฑ์ ${prPass}%)`),
      stat('แบบทดสอบหลังเรียน',`${bestPct!=null?`ดีที่สุด ${bestPct}%`:'ยังไม่ได้ทำ'} (เกณฑ์ ${P.rules.passPct}%)`),
      stat('ปลดล็อกถัดไป',nx?`สัปดาห์ที่ ${nx.week}`:P.sequential?'–':'ไม่ได้บังคับเรียนตามลำดับ')),
    cur.missing.length?el('div',{class:'rpmiss'},el('h3',{},'เงื่อนไขที่ยังไม่ผ่าน'),critList(cur,true)):el('p',{class:'msg ok'},'ครบทุกเงื่อนไขของสัปดาห์นี้แล้ว'));
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
          w&&w.practice&&w.practice.best!=null?el('span',{class:'lpnote','data-step':'lab'},`ฝึกปฏิบัติดีที่สุด ${w.practice.best}% ${w.practice.passed?'ผ่าน':'ยังไม่ผ่าน'} (เกณฑ์ ${w.practice.passPct||pracRules().passPct}%)`):null,
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

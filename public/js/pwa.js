'use strict';
/* NetLab as an installable app (PWA): service worker, updates, install button, offline page */

let INSTALL_EVT=null;
const isStandalone=()=>(window.matchMedia&&matchMedia('(display-mode: standalone)').matches)||navigator.standalone===true;
const isIOS=()=>/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);

/* skip link: move focus to the main content without changing the route */
document.addEventListener('click',e=>{ const a=e.target.closest&&e.target.closest('a.skip'); if(!a) return; e.preventDefault(); app.setAttribute('tabindex','-1'); app.focus(); });

window.addEventListener('beforeinstallprompt',e=>{ e.preventDefault(); INSTALL_EVT=e; if((location.hash||'')==='#/app') appPage(); });
window.addEventListener('appinstalled',()=>{ INSTALL_EVT=null; toast('ติดตั้ง NetLab แล้ว เปิดได้จากหน้าจอหลัก'); });
window.addEventListener('online',async()=>{ setOffline(false); try{ await refreshMe(); }catch(e){} renderShell(); flushQueue(); });
window.addEventListener('offline',()=>setOffline(true));

if('serviceWorker' in navigator&&(location.protocol==='https:'||location.hostname==='localhost'||location.hostname==='127.0.0.1')){
  window.addEventListener('load',async()=>{
    try{
      const reg=await navigator.serviceWorker.register('/sw.js',{scope:'/'});
      const offer=w=>{ if(!w||!navigator.serviceWorker.controller) return; updateBar(w); };
      if(reg.waiting) offer(reg.waiting);
      reg.addEventListener('updatefound',()=>{ const w=reg.installing; if(w) w.addEventListener('statechange',()=>{ if(w.state==='installed') offer(w); }); });
      let reloaded=false;
      navigator.serviceWorker.addEventListener('controllerchange',()=>{ if(reloaded||!window.__nlUpdating) return; reloaded=true; location.reload(); });
      setInterval(()=>reg.update().catch(()=>{}),30*60*1000);   // labs keep the page open for hours
    }catch(e){ console.warn('service worker',e); }
  });
}
function updateBar(worker){
  if(document.querySelector('.updbar')) return;
  const bar=el('div',{class:'updbar',role:'status'},el('span',{},'มี NetLab เวอร์ชันใหม่'),
    el('button',{class:'btn',type:'button',onclick:()=>{ if(document.querySelector('.modal-back')||EXAM){ toast('ส่งงาน/ข้อสอบให้เสร็จก่อนแล้วค่อยอัปเดต'); return; } window.__nlUpdating=true; worker.postMessage('skipWaiting'); }},'อัปเดตตอนนี้'),
    el('button',{class:'btn ghost',type:'button','aria-label':'ภายหลัง',onclick:()=>bar.remove(),style:'color:var(--bg);border-color:var(--bg)'},'ภายหลัง'));
  document.body.append(bar);
}

async function lessonsOfflineCount(){
  if(!('caches' in window)) return 0;
  try{ const c=await caches.open('netlab-data-v1'); const ks=await c.keys(); return ks.filter(r=>/\/api\/lessons\/w\d+$/.test(new URL(r.url).pathname)).length; }catch(e){ return 0; }
}
async function appPage(){
  setTitle('ติดตั้งแอปและใช้งานออฟไลน์');
  const swOK='serviceWorker' in navigator;
  const ready=swOK&&!!navigator.serviceWorker.controller;
  const n=await lessonsOfflineCount();
  const prog=el('p',{class:'muted small','aria-live':'polite'},ready?`บทเรียนที่อ่านออฟไลน์ได้ตอนนี้: ${n} จาก ${LMETA.length} สัปดาห์`:'ระบบออฟไลน์จะพร้อมหลังเปิดเว็บครั้งแรกเสร็จ (รีโหลดหน้านี้หนึ่งครั้ง)');
  const dl=el('button',{class:'btn',type:'button',disabled:!ready||null,onclick:async()=>{
    dl.disabled=true; let ok=0;
    try{ await api('GET','/api/content'); await api('GET','/api/lessons'); }catch(e){}
    for(const l of LMETA){ try{ await api('GET','/api/lessons/'+l.id); ok++; }catch(e){} prog.textContent=`กำลังดาวน์โหลด ${ok}/${LMETA.length} สัปดาห์...`; }
    prog.textContent=`พร้อมอ่านออฟไลน์ ${await lessonsOfflineCount()} จาก ${LMETA.length} สัปดาห์`; dl.disabled=false; toast('ดาวน์โหลดบทเรียนแล้ว');
  }},'ดาวน์โหลดบทเรียนทั้ง 18 สัปดาห์ไว้อ่านออฟไลน์');
  const clr=el('button',{class:'btn ghost',type:'button',disabled:!ready||null,onclick:async()=>{ try{ await caches.delete('netlab-data-v1'); }catch(e){} prog.textContent='ลบบทเรียนที่เก็บไว้ในเครื่องแล้ว'; }},'ลบบทเรียนที่เก็บไว้');
  const install=isStandalone()?el('p',{class:'okc'},'กำลังใช้งานแบบแอปอยู่แล้ว')
    :INSTALL_EVT?el('button',{class:'btn big',type:'button',onclick:async()=>{ const e=INSTALL_EVT; INSTALL_EVT=null; e.prompt(); try{ await e.userChoice; }catch(err){} appPage(); }},'ติดตั้ง NetLab บนเครื่องนี้')
    :null;
  const row=(what,state,cls,note)=>el('tr',{},el('td',{},what),el('td',{},el('span',{class:cls},state),note?el('div',{class:'muted small'},note):null));
  R(app,el('h1',{},'ติดตั้งแอปและใช้งานออฟไลน์'),
    el('section',{class:'panel'},el('h2',{},'ติดตั้ง NetLab ลงหน้าจอหลัก'),
      el('p',{},'NetLab ติดตั้งเป็นแอปได้โดยไม่ต้องผ่าน App Store เปิดเต็มจอเหมือนแอปทั่วไป และอัปเดตเองเมื่อครูปรับปรุงเว็บ'),
      install,
      el('h3',{},'Android (Chrome)'),el('ol',{class:'installsteps'},el('li',{},'เปิดเว็บนี้ใน Chrome'),el('li',{},'แตะเมนู ⋮ มุมขวาบน'),el('li',{},'เลือก "ติดตั้งแอป" หรือ "เพิ่มลงในหน้าจอหลัก"')),
      el('h3',{},'iPhone และ iPad (Safari)'),el('ol',{class:'installsteps'},el('li',{},'เปิดเว็บนี้ใน Safari'),el('li',{},'แตะปุ่มแชร์ (สี่เหลี่ยมมีลูกศรชี้ขึ้น)'),el('li',{},'เลือก "เพิ่มไปยังหน้าจอโฮม" แล้วแตะ "เพิ่ม"')),
      el('h3',{},'คอมพิวเตอร์และ Chromebook (Chrome / Edge)'),el('ol',{class:'installsteps'},el('li',{},'คลิกไอคอนติดตั้งท้ายช่องที่อยู่เว็บ หรือเมนู ⋮ → "ติดตั้ง NetLab"')),
      isIOS()&&!isStandalone()?el('p',{class:'muted small'},'บน iPhone/iPad ต้องใช้ Safari จึงจะเพิ่มลงหน้าจอโฮมได้'):null),
    el('section',{class:'panel'},el('h2',{},'อะไรใช้ได้เมื่อไม่มีอินเทอร์เน็ต'),
      el('div',{class:'tablewrap'},el('table',{class:'offtable'},
        el('tr',{},el('th',{scope:'col'},'ส่วนของเว็บ'),el('th',{scope:'col'},'ออฟไลน์')),
        row('อ่านเนื้อหาบทเรียน แผนภาพ และสื่อโต้ตอบ','ใช้ได้','okc','เฉพาะสัปดาห์ที่เคยเปิดหรือกดดาวน์โหลดไว้'),
        row('แบบฝึกหัดระหว่างเรียน','ทำได้แต่ตรวจไม่ได้','partc','คำตอบถูกเก็บเป็นร่าง ตรวจเมื่อออนไลน์'),
        row('แล็บและห้องฝึก','บางส่วน','partc','ต้องออนไลน์ตอนกด Start ระหว่างทำถ้าเน็ตหลุด คำตอบจะรอส่งตรวจอัตโนมัติเมื่อกลับมาออนไลน์'),
        row('แบบทดสอบก่อน/หลังเรียน','ต้องออนไลน์','noc','ข้อสอบตรวจที่เซิร์ฟเวอร์และไม่เก็บไว้ในเครื่อง'),
        row('ฝึกทำข้อสอบ และการสอบ','ต้องออนไลน์','noc','การสอบบันทึกคำตอบไว้ในเครื่องถ้าเน็ตหลุดกลางคัน แล้วส่งเมื่อออนไลน์'),
        row('ห้องปฏิบัติการจำลอง','ต้องออนไลน์','noc','โจทย์และการตรวจภารกิจอยู่ที่เซิร์ฟเวอร์'),
        row('เข้าสู่ระบบ คะแนน XP แดชบอร์ดครู','ต้องออนไลน์','noc','ข้อมูลส่วนตัวไม่ถูกเก็บในแคชของแอป'),
        row('Linux VM','ต้องออนไลน์','noc','ไฟล์ VM ขนาดใหญ่ ไม่เก็บไว้ในเครื่อง'))),
      el('p',{class:'muted small'},'ความเป็นส่วนตัว: แอปเก็บเฉพาะหน้าเว็บ สคริปต์ และเนื้อหาบทเรียนที่ไม่มีเฉลยหรือข้อสอบ ไม่เก็บชื่อผู้ใช้ คะแนน หรือคำตอบของคุณไว้ในแคช'),
      el('div',{class:'row'},dl,clr),prog));
  window.scrollTo(0,0);
}

'use strict';
/* ---------- lab timer ---------- */
let TICK=null;
const fmt=ms=>{ms=Math.max(0,ms);const t=Math.round(ms/1000);const m=Math.floor(t/60),sec=t%60;return String(m).padStart(2,'0')+':'+String(sec).padStart(2,'0');};
const timerOf=r=>S.timers[r.id];
function stopTick(){ if(TICK){clearInterval(TICK);TICK=null;} }
async function startLab(ri){
  const r=ALL[ri];
  if(ME){
    try{ const res=await api('POST',`/api/labs/${r.id}/start`); if(res.now) SKEW=res.now-Date.now(); S.timers[r.id]=res.timer; }
    catch(e){ if(e.code==='locked'&&typeof lockPage==='function'){ lockPage(r.host||r.id,e.body&&e.body.lock); return; }   // Progressive Unlock
      alert(e.offline?'ต้องเชื่อมต่ออินเทอร์เน็ตเพื่อเริ่มแล็บ':e.message); return; }
  }else{
    S.timers[r.id]={start:now(),limit:r.minutes*60000,status:'running'}; save();
  }
  openRoom(ri);
}
async function finishLab(ri,status){
  const r=ALL[ri], t=timerOf(r); if(!t||t.status!=='running')return;
  if(ME){
    try{ const res=await api('POST',`/api/labs/${r.id}/finish`); if(res.timer) S.timers[r.id]=res.timer; }
    catch(e){ if(e.offline){ alert('ส่งงานไม่ได้เพราะออฟไลน์ ระบบจะปิดแล็บให้อัตโนมัติเมื่อหมดเวลา'); return; } }
  }else{
    t.status=status; t.end=status==='timeout'?t.start+t.limit:now(); save();
  }
  stopVM(); if(CURRENT===ri) openRoom(ri);
}
function allDone(r){ return roomDone(r)===r.tasks.length && vmDone(r)===(r.vmTasks||[]).length; }
function timerBar(r,ri){
  const t=timerOf(r);
  if(t.status!=='running'){
    return el('div',{class:'timer done'},
      el('span',{},t.status==='timeout'?'หมดเวลาแล้ว':'ส่งงานแล้ว'),
      el('b',{},'ใช้เวลา '+fmt((t.end||t.start+t.limit)-t.start)+' จาก '+r.minutes+' นาที'));
  }
  const left=el('b',{class:'clock'},fmt(t.start+t.limit-now()));
  const bar=el('div',{class:'timer'},
    el('span',{},'เวลาที่เหลือ'),left,
    el('button',{class:'btn ghost',onclick:()=>{ if(confirm('ส่งงานและหยุดจับเวลา? หลังส่งแล้วจะแก้คำตอบไม่ได้')) finishLab(ri,'finished'); }},'ส่งงาน'));
  stopTick();
  const upd=()=>{
    const ms=t.start+t.limit-now();
    left.textContent=fmt(ms);
    bar.classList.toggle('warn',ms<=5*60000); bar.classList.toggle('urgent',ms<=60000);
    if(ms<=0){ stopTick(); if(ME){ t.status='timeout'; t.end=t.start+t.limit; stopVM(); openRoom(ri); } else finishLab(ri,'timeout'); }
  };
  upd(); TICK=setInterval(upd,1000);
  return bar;
}
function startCard(r,ri){
  const n=r.tasks.length+(r.vmTasks||[]).length;
  const due=dueOf(r.id);
  return el('div',{class:'startcard'},
    el('p',{class:'big'},`เวลาทำแล็บ ${r.minutes} นาที`),
    due&&due.due?el('p',{class:'duehint'},'ครูกำหนดส่งภายใน '+fmtDate(due.due)):null,
    el('p',{},`มีทั้งหมด ${n} ข้อ${r.vmTasks?` (รวมภารกิจ Linux VM ${r.vmTasks.length} ข้อ)`:''} เมื่อกดเริ่ม ระบบจะเริ่มจับเวลาทันที ปิดหน้าเว็บแล้วเวลาก็ยังเดินต่อ เมื่อหมดเวลาหรือกดส่งงาน จะแก้คำตอบไม่ได้อีก`),
    el('button',{class:'btn start',onclick:()=>{
      if(!ME && !S.name.trim()){ alert('กรุณากรอก ชื่อ–ชั้น–เลขที่ ที่หน้าแดชบอร์ดก่อนเริ่มทำแล็บ หรือเข้าสู่ระบบ'); location.hash='#/'; setTimeout(()=>{const n=document.getElementById('nm'); if(n) n.focus();},150); return; }
      startLab(ri);
    }},'Start เริ่มทำแล็บ'));
}

/* ---------- room ---------- */
/* 2.9: say plainly where merged questions and Linux VM missions went, so nobody looks for them twice */
function mergedNote(r){
  const m=r.merged||[], v=r.vmMoved||[];
  if(!m.length&&!v.length) return null;
  const weeks=[...new Set(m.map(x=>x.into.split('-')[0]))];
  const wk=id=>{ const L=typeof metaOf==='function'?metaOf(id):null; return L?L.week:id.slice(1); };
  return el('div',{class:'mergenote'},
    m.length?el('p',{},`ข้อที่ซ้ำกับแล็บท้ายคาบ ${m.length} ข้อ รวมไว้ที่แล็บท้ายคาบ`,...weeks.map((w,i)=>[i?', ':' ',el('a',{href:`#/lesson/${w}/lab`},'สัปดาห์ '+wk(w))]),' แล้ว ถ้าเคยตอบถูกไว้ในห้องฝึกเดิม ระบบนับให้ที่แล็บนั้นโดยไม่ต้องทำซ้ำ'):null,
    v.length?el('p',{},`ภารกิจ Linux VM ${v.length} ข้อของภารกิจนี้อยู่ใน `,el('a',{href:`#/lesson/${r.vmShared}/lab`},'แล็บท้ายคาบสัปดาห์ '+wk(r.vmShared)),' (ตรวจคำตอบจาก VM เหมือนเดิม ทำครั้งเดียว)'):null);
}

function openRoom(ri,keepScroll){
  const y=window.scrollY;
  stopVM();
  const r=ALL[ri]; CURRENT=ri;
  app.innerHTML='';
  if(typeof lessonRail==='function'){ if(r.exit) app.append(lessonRail(r.id,'lab')); else if(r.host) app.append(lessonRail(r.host,'challenge')); }
  const host=typeof hostOf==='function'?hostOf(r):null;
  app.append(
    host?el('a',{class:'back',href:`#/lesson/${r.host}/challenge`},'‹ ภารกิจท้าทายทั้งหมดของสัปดาห์ '+host.week):document.createTextNode(''),
    el('div',{class:'roomhead'},el('div',{class:'rs',style:`background:${r.color}`}),el('div',{},
      el('div',{class:'num',style:'font:600 13px JetBrains Mono,monospace;color:var(--muted)'},r.label+(r.exit?' · แล็บท้ายคาบ':'')),
      el('h1',{},r.title),el('div',{class:'ref'},'อ้างอิง '+r.ref))),
    el('div',{class:'intro'},r.intro.map(p=>el('p',{},p))),
    mergedNote(r)||document.createTextNode("")
  );
  if(r.exit && typeof weekSimsPanel==='function'){ const sp=weekSimsPanel(r.id); if(sp) app.append(sp); }
  stopTick();
  const t=timerOf(r);
  if(!t){ app.append(startCard(r,ri)); window.scrollTo(0,0); return; }
  if(t.status==='running' && now()>=t.start+t.limit){ t.status='timeout'; t.end=t.start+t.limit; save(); }
  app.append(timerBar(r,ri));
  const pending=getQ().filter(x=>x.id.startsWith(r.id+'-')).length;
  if(pending) app.append(el('div',{class:'pendingbar'},`มีคำตอบ ${pending} ข้อรอส่งตรวจ ระบบจะส่งให้อัตโนมัติเมื่อเชื่อมต่ออินเทอร์เน็ตได้`));
  if(r.terminal) app.append(terminal(r.quick));
  r.tasks.forEach((tk,i)=>app.append(taskCard(r,ri,tk,i)));
  if(r.vmTasks){
    app.append(el('h2',{class:'vmhead'},'ภารกิจ Linux VM'),
      el('p',{class:'vmnote'},'ทำบนคอมพิวเตอร์ห้องแล็บ เปิด VM แล้วกด "เตรียมโจทย์" เมื่อเห็น prompt ของ Linux ภารกิจส่วนนี้ได้คะแนนเพิ่ม แต่ไม่บังคับสำหรับการผ่านห้อง'),
      vmPanel(r));
    r.vmTasks.forEach((tk,i)=>app.append(taskCard(r,ri,tk,i,vid(r,i))));
  }
  app.append(el('div',{id:'flagbox'}));
  renderFlag(r,ri);
  if(t.status!=='running'){
    app.querySelectorAll('.task input,.task button,.task select,.vm button').forEach(b=>b.disabled=true);
  }
  window.scrollTo(0,keepScroll?y:0);
}
function renderFlag(r,ri){
  const box=document.getElementById('flagbox'); if(!box)return;
  box.innerHTML='';
  if(roomDone(r)===r.tasks.length && S.flags[r.id]){
    box.append(el('div',{class:'flag'},
      el('p',{style:'margin:0 0 6px;font-weight:600'},r.exit?'ผ่านแล็บสัปดาห์นี้แล้ว นี่คือ flag ของคุณ':'ผ่านภารกิจท้าทายนี้แล้ว นี่คือ flag ของคุณ'),
      el('code',{},S.flags[r.id]),
      el('div',{style:'margin-top:12px'},
        r.exit?el('a',{class:'btn',href:'#/lesson/'+r.id+'/challenge'},'ไปภารกิจท้าทาย'):r.host?el('a',{class:'btn',href:'#/lesson/'+r.host+'/post'},'ไปทำแบบทดสอบหลังเรียน'):el('a',{class:'btn',href:'#/results'},'ดูผลการเรียน'))
    ));
  } else if(roomDone(r)===r.tasks.length && !ME && DBON){   // 3.0 P6: guests practise freely, the flag is given for logged-in work only
    box.append(el('div',{class:'flag'},el('p',{style:'margin:0'},'ตอบครบทุกข้อแล้วในโหมดผู้เยี่ยมชม (ไม่บันทึกคะแนน) เข้าสู่ระบบแล้วทำแล็บนี้อีกครั้งเพื่อบันทึกคะแนนและรับ flag')));
  }
}

function seededOrder(n,key){
  let h=2166136261; for(const ch of key){h^=ch.codePointAt(0);h=Math.imul(h,16777619)>>>0;}
  const rnd=()=>{h^=h<<13;h>>>=0;h^=h>>>17;h^=h<<5;h>>>=0;return h/4294967296;};
  const a=[...Array(n).keys()]; for(let i=n-1;i>0;i--){const j=Math.floor(rnd()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a;
}
function shuffle(a){a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}
  if(a.length>1&&a.every((v,i)=>v===i)) return shuffle(a); return a;}

function taskCard(r,ri,t,i,idOverride){
  const id=idOverride||tid(r,i), solved=!!S.done[id];
  const card=el('div',{class:'task'+(solved?' solved':''),id:'task-'+id});
  const msg=el('div',{class:'msg'+(solved?' ok':''),'aria-live':'polite'},solved?'ถูกต้อง ได้ '+ptsLeft(id)+' คะแนน':'');
  const q=el('div',{class:'qtext'},t.c?el('span',{class:'tag'},'ท้าทาย'):null,el('p',{},t.q));
  if(t.pre) q.append(el('pre',{class:'out'},t.pre));
  const draft=getDrafts()[id];
  let busy=false;

  const markSolved=()=>{
    card.classList.add('solved'); msg.className='msg ok'; msg.textContent='ถูกต้อง ได้ '+ptsLeft(id)+' คะแนน';
    card.querySelectorAll('.hint').forEach(h=>h.remove());
    if(S.explain[id] && !card.querySelector('.explain')) q.append(el('div',{class:'explain'},S.explain[id]));
    renderFlag(r,ri);
    if(allDone(r)){ if(ME) setTimeout(()=>{ if(CURRENT===ri) openRoom(ri,true); },1200); else setTimeout(()=>finishLab(ri,'finished'),1200); }
  };
  const showMsg=(text,kind)=>{ msg.className='msg '+(kind||'bad'); msg.textContent=text; };
  /* sends an answer and handles every outcome; onWrong gets the server result */
  async function send(answer,onCorrect,onWrong){
    if(busy||S.done[id]) return; busy=true; showMsg('กำลังตรวจ...','wait');
    const res=await submit(id,answer); busy=false;
    if(res.queued){ showMsg('ออฟไลน์อยู่ เก็บคำตอบไว้แล้ว ระบบจะส่งตรวจให้อัตโนมัติเมื่อกลับมาออนไลน์','wait'); return; }
    if(res.closed){ showMsg(res.message||'แล็บนี้ปิดแล้ว'); setTimeout(()=>openRoom(ri,true),1200); return; }
    if(res.error){ showMsg(res.message||'ตรวจคำตอบไม่สำเร็จ ลองใหม่'); return; }
    if(res.correct){ onCorrect&&onCorrect(res); markSolved(); }
    else { onWrong&&onWrong(res); }
  }
  const wrongText=extra=>`ยังไม่ถูก${extra?' '+extra:''} ลองใหม่อีกครั้ง (ถ้าตอบถูก ข้อนี้จะได้ ${ptsLeft(id)} คะแนน)`;

  if(t.type==='text'){
    const inp=el('input',{placeholder:'พิมพ์คำตอบ',autocomplete:'off',autocapitalize:'off',spellcheck:'false','aria-label':'คำตอบ'});
    if(solved){ inp.value=S.given[id]||''; inp.disabled=true; }
    else if(typeof draft==='string') inp.value=draft;
    inp.addEventListener('input',()=>setDraft(id,inp.value));
    const check=()=>{
      if(!inp.value.trim()){ showMsg('พิมพ์คำตอบก่อนกดตรวจ'); return; }
      send(inp.value,()=>{ inp.disabled=true; btn.disabled=true; },()=>showMsg(wrongText()));
    };
    inp.addEventListener('keydown',e=>{if(e.key==='Enter')check();});
    const btn=el('button',{class:'btn',onclick:check},'ตรวจคำตอบ'); if(solved)btn.disabled=true;
    q.append(el('div',{class:'row'},inp,btn));
  }
  if(t.type==='choice'){
    const box=el('div',{class:'choices'});
    seededOrder(t.options.length,SEED+id).forEach(oi=>{
      const o=t.options[oi];
      const b=el('button',{class:'choice'+(solved&&S.given[id]===o?' picked-ok':'')},o);
      b.addEventListener('click',()=>{
        if(S.done[id]||busy||b.classList.contains('picked-bad'))return;
        send(oi,()=>{ b.className='choice picked-ok'; },()=>{ b.className='choice picked-bad'; showMsg(wrongText()); });
      });
      box.append(b);
    });
    q.append(box);
  }
  if(t.type==='order') q.append(orderWidget(id,t,solved,send,showMsg,wrongText));
  if(t.type==='form'){
    const saved=solved?(()=>{ try{ return JSON.parse(S.given[id]||'[]'); }catch(e){ return []; } })():(Array.isArray(draft)?draft:[]);
    const ctrls=t.fields.map((f,fi)=>{
      const c=f.type==='select'
        ? el('select',{'aria-label':f.label},el('option',{value:''},'— เลือก —'),f.options.map(o=>el('option',{value:o},o)))
        : el('input',{placeholder:f.ph||'',autocomplete:'off',autocapitalize:'off',spellcheck:'false','aria-label':f.label});
      if(saved[fi]!=null) c.value=saved[fi];
      if(solved) c.disabled=true;
      c.addEventListener('input',()=>setDraft(id,ctrls.map(x=>x.value)));
      c.addEventListener('change',()=>setDraft(id,ctrls.map(x=>x.value)));
      return c;
    });
    const grid=el('div',{class:'form'},t.fields.map((f,fi)=>el('label',{class:'frow'},el('span',{},f.label),ctrls[fi])));
    const btn=el('button',{class:'btn',onclick:()=>{
      ctrls.forEach(c=>c.classList.remove('bad'));
      send(ctrls.map(c=>c.value),()=>{ ctrls.forEach(c=>c.disabled=true); btn.disabled=true; },res=>{
        const okf=(res.detail&&res.detail.fieldsOk)||[]; let bad=0;
        ctrls.forEach((c,fi)=>{ if(okf[fi]===false){ c.classList.add('bad'); bad++; } });
        showMsg(wrongText(bad?`มี ${bad} ช่องที่ไม่ถูกต้อง (กรอบสีแดง)`:''));
      });
    }},'บันทึกการตั้งค่า');
    if(solved) btn.disabled=true;
    q.append(grid,el('div',{class:'row'},btn));
  }
  q.append(msg);
  if(solved && S.explain[id]) q.append(el('div',{class:'explain'},S.explain[id]));
  if(!solved){
    const hb=el('div');
    const showHint=h=>{hb.innerHTML='';hb.append(el('div',{class:'hinttext'},h));};
    const hintBtn=el('button',{class:'hint',onclick:async()=>{
      if(!S.hints[id] && !confirm('ดูคำใบ้แล้วข้อนี้จะถูกหัก 5 คะแนน ต้องการดูไหม?')) return;
      hintBtn.disabled=true;
      try{ const res=await api('POST','/api/hint',{key:id}); S.hints[id]=true; save(); showHint(res.hint); }
      catch(e){ hintBtn.disabled=false; showMsg(e.offline?'ต้องเชื่อมต่ออินเทอร์เน็ตเพื่อดูคำใบ้':e.message); }
    }},S.hints[id]?'ดูคำใบ้อีกครั้ง':'ดูคำใบ้ (หัก 5 คะแนน)');
    hb.append(hintBtn);
    q.append(hb);
  }
  card.append(el('div',{class:'tq'},el('div',{class:'tn'},(idOverride?'VM':'')+String(i+1).padStart(2,'0')),q));
  return card;
}

function orderWidget(id,t,solved,send,showMsg,wrongText){
  const box=el('div');
  if(!orderState[id]){
    const d=getDrafts()[id];
    const picked=Array.isArray(d)?d.map(x=>t.items.findIndex(it=>it.t===x)).filter(x=>x>=0):[];
    orderState[id]={pool:shuffle(t.items.map((_,i)=>i)).filter(x=>!picked.includes(x)),picked};
  }
  const st=orderState[id];
  if(solved){
    const g=String(S.given[id]||'').split(' | ');
    const p=g.map(x=>t.items.findIndex(it=>it.t===x));
    st.picked=p.every(x=>x>=0)&&p.length===t.items.length?p:t.items.map((_,i)=>i); st.pool=[];
  }
  const persist=()=>setDraft(id,st.picked.map(i=>t.items[i].t));
  const chipFace=it=>[it.sw?el('span',{class:'sw',style:`background:${it.sw}`}):null,it.t];
  function draw(){
    box.innerHTML='';
    const slots=el('div',{class:'slots'});
    t.labels.forEach((lab,si)=>{
      const idx=st.picked[si];
      const s=el('button',{class:'slot'+(idx!=null?' filled':'')+(t.wide?' wide':''),'aria-label':lab+(idx!=null?' '+t.items[idx].t+' แตะเพื่อเอาออก':' ว่าง')},
        el('span',{class:'pin'},lab), idx!=null?el('span',{style:'display:inline-flex;gap:8px;align-items:center'},chipFace(t.items[idx])):el('span',{style:'color:var(--muted);font-size:14px'},t.wide?'—':'แตะตัวเลือกด้านล่างเพื่อใส่'));
      if(idx!=null && !S.done[id]) s.addEventListener('click',()=>{st.picked.splice(si,1);st.pool.push(idx);persist();draw();});
      slots.append(s);
    });
    box.append(slots);
    if(!S.done[id]){
      box.append(el('div',{class:'pool'},st.pool.map(idx=>el('button',{class:'chip',onclick:()=>{st.pool=st.pool.filter(x=>x!==idx);st.picked.push(idx);persist();draw();}},chipFace(t.items[idx])))));
      const full=st.picked.length===t.items.length;
      const chk=el('button',{class:'btn',onclick:()=>{
        send(st.picked.map(i=>t.items[i].t),()=>draw(),res=>{
          const d=res.detail||{}; showMsg(wrongText(d.total?`ถูกตำแหน่ง ${d.right} จาก ${d.total} ช่อง แตะช่องที่ผิดเพื่อเอาออก`:''));
        });
      }},'ตรวจลำดับ');
      if(!full) chk.disabled=true;
      box.append(el('div',{class:'row'},chk,
        el('button',{class:'btn ghost',onclick:()=>{st.pool=shuffle(t.items.map((_,i)=>i));st.picked=[];persist();draw();}},'ล้าง')));
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
  const quick=quickList||['help','ipconfig','cls'];
  const term=el('div',{class:'term'},
    el('div',{class:'tbar'},el('span',{},'Command Prompt — LAB-PC07'),el('span',{class:'ttools'},hint,wrapBtn,el('span',{},'จำลอง'))),
    screen,
    el('div',{class:'inrow'},el('span',{class:'prompt'},'C:\\>'),inp),
    el('div',{class:'quick'},quick.map(q=>el('button',{type:'button',onclick:()=>{if(!busy){run(q);}clearTimer();}},q)))
  );
  /* the lab timer is sticky: when the student starts typing, scroll so the terminal's top is just below it, not under it */
  function clearTimer(){
    const t=document.querySelector('.timer'); if(!t||getComputedStyle(t).position!=='sticky') return;
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


/* ---------- Linux VM (v86, runs in the student's browser) ---------- */
let VM=null;
function stopVM(){ if(VM){ const v=VM; VM=null; try{ v.destroy(); }catch(e){} } }
function loadScript(src){
  return new Promise((res,rej)=>{
    if(window.V86){res();return;}
    const s=document.createElement('script'); s.src=src; s.onload=res; s.onerror=()=>rej(new Error('script')); document.head.append(s);
  });
}
function vmPanel(r){
  const status=el('div',{class:'vmstatus'},'VM ยังไม่ได้เปิด กด "เปิด Linux VM" เพื่อบูตเครื่อง ครั้งแรกต้องดาวน์โหลดไฟล์ประมาณ 10 MB และบูตประมาณ 10–30 วินาที');
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
  const stopBtn=el('button',{class:'btn ghost',onclick:()=>{ stopVM(); lock(true); startBtn.disabled=false; setStatus('ปิด VM แล้ว'); }},'ปิด VM');
  const lock=on=>[setupBtn,restartBtn,stopBtn].forEach(b=>b.disabled=on);
  lock(true);
  const startBtn=el('button',{class:'btn',onclick:async()=>{
    startBtn.disabled=true; setStatus('กำลังโหลดไฟล์ VM...');
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
      setStatus('เปิด VM ไม่ได้ เพราะไม่พบไฟล์ VM บนเซิร์ฟเวอร์'+(missing?' (ไฟล์ที่ขาด: '+missing+')':'')+' ครูตรวจได้ที่หน้า /vm-status และดูวิธีแก้ใน README',true);
    }
  }},'เปิด Linux VM');
  return el('div',{class:'vm'},el('div',{class:'row',style:'margin-bottom:10px'},startBtn,setupBtn,restartBtn,stopBtn),status,screen);
}



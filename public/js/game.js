'use strict';
/* Phase 5: progress page (XP, level, streak, badges, weekly challenge, mastery, activity, leaderboard) */

let GAME=null, GAME_AT=0, GAME_W=-1;
const GROUP_ICON={
  'แล็บ':'<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.7 3h10.6A2 2 0 0 0 19 18l-5-9V3"/>',
  'บทเรียน':'<path d="M4 4h6a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4zM20 4h-6a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h7z"/>',
  'ห้องจำลอง':'<rect x="2" y="3" width="7" height="5" rx="1"/><rect x="15" y="3" width="7" height="5" rx="1"/><rect x="8.5" y="16" width="7" height="5" rx="1"/><path d="M5.5 8v4h13V8M12 12v4"/>',
  'ข้อสอบ':'<path d="M9 4h10v16H5V8z"/><path d="M9 4v4H5M9 13l2 2 4-4"/>',
  'ความสม่ำเสมอ':'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4M8 15l2 2 4-4"/>'
};
const svgIcon=(paths,size=22)=>{ const s=el('span',{class:'ic','aria-hidden':'true'}); s.innerHTML=`<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`; return s; };
const XP_NAME={labs:'แล็บและห้องฝึก',lessons:'บทเรียน',quizzes:'แบบทดสอบก่อน/หลังเรียน',sims:'ห้องจำลอง',practice:'ฝึกทำข้อสอบ',exams:'การสอบ',challenges:'ภารกิจประจำสัปดาห์'};

async function loadGame(force){
  if(!ME||!DBON) return null;
  if(GAME&&GAME._uid!==ME.id) GAME=null;
  if(!force&&GAME&&GAME_W===API_WRITES&&Date.now()-GAME_AT<60000) return GAME;
  try{ const g=await api('GET','/api/game/me'); g._uid=ME.id; GAME=g; GAME_AT=Date.now(); GAME_W=API_WRITES; }catch(e){ return GAME; }
  if(GAME.newBadges&&GAME.newBadges.length){
    const names=GAME.badges.filter(b=>GAME.newBadges.includes(b.id)).map(b=>b.title);
    toast('ได้รับเหรียญใหม่: '+names.join(', '));
  }
  const chip=document.getElementById('xpchip'); if(chip) chip.replaceWith(xpChip());
  return GAME;
}
/* small level/XP indicator for the sidebar */
function xpChip(){
  if(!ME||!GAME||GAME._uid!==ME.id) return el('span',{id:'xpchip'});
  const L=GAME.level, pct=Math.round((GAME.xp.total-L.from)/(L.to-L.from)*100);
  return el('a',{id:'xpchip',class:'xpchip',href:'#/me',onclick:closeDrawer,title:`เลเวล ${L.level} ${L.title} · ${GAME.xp.total} XP`},
    el('span',{class:'lvbadge'},L.level),el('span',{class:'xpt'},el('b',{},L.title),el('span',{class:'bar slim'},el('i',{style:`width:${pct}%`})),el('small',{},`${GAME.xp.total} XP`+(GAME.streak.current?` · ต่อเนื่อง ${GAME.streak.current} วัน`:''))));
}
function levelRing(L,xp,size=92){
  const r=size/2-7, c=2*Math.PI*r, p=Math.max(0,Math.min(1,(xp-L.from)/(L.to-L.from)));
  const w=el('div',{class:'lvring',style:`width:${size}px;height:${size}px`,role:'img','aria-label':`เลเวล ${L.level} ความคืบหน้าสู่เลเวลถัดไป ${Math.round(p*100)}%`});
  w.innerHTML=`<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}"><circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="var(--line)" stroke-width="7"/><circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="var(--blue)" stroke-width="7" stroke-linecap="round" stroke-dasharray="${c*p} ${c}" transform="rotate(-90 ${size/2} ${size/2})"/></svg>`;
  w.append(el('div',{class:'lvnum'},el('small',{},'เลเวล'),el('b',{},L.level)));
  return w;
}
/* dashboard strip */
function gameStrip(){
  if(!ME||!DBON) return null;
  const box=el('section',{class:'gstrip',id:'gstrip'},el('p',{class:'muted small'},'กำลังโหลดความก้าวหน้า...'));
  loadGame().then(g=>{ if(!g){ box.remove(); return; }
    const L=g.level, ch=g.challenge, done=ch.goals.filter(x=>x.done).length;
    R(box,levelRing(L,g.xp.total,76),
      el('div',{class:'gmain'},el('b',{},L.title),el('div',{class:'bar slim'},el('i',{style:`width:${Math.round((g.xp.total-L.from)/(L.to-L.from)*100)}%`})),
        el('small',{class:'muted'},`${g.xp.total} XP · อีก ${L.to-g.xp.total} XP ถึงเลเวล ${L.level+1} · สัปดาห์นี้ +${g.weekXp} XP`)),
      el('div',{class:'gstat'},el('b',{},g.streak.current),el('small',{},'วันต่อเนื่อง')),
      el('div',{class:'gstat'},el('b',{},`${done}/${ch.goals.length}`),el('small',{},'ภารกิจสัปดาห์')),
      el('div',{class:'gstat'},el('b',{},g.badges.filter(b=>b.earned).length),el('small',{},'เหรียญ')),
      el('a',{class:'btn ghost',href:'#/me'},'ดูความก้าวหน้า')); });
  return box;
}

/* ---------- progress page ---------- */
async function progressPage(){
  setTitle('ความก้าวหน้าของฉัน');
  if(!ME){ R(app,el('h1',{},'ความก้าวหน้าของฉัน'),el('div',{class:'panel'},el('p',{},'XP เลเวล เหรียญ และภารกิจประจำสัปดาห์ คิดจากคะแนนที่บันทึกในระบบ จึงใช้ได้เมื่อเข้าสู่ระบบเท่านั้น'),DBON?el('button',{class:'btn',onclick:loginModal},'เข้าสู่ระบบ'):el('p',{class:'muted small'},'ระบบนี้ยังไม่ได้เชื่อมต่อฐานข้อมูล'))); return; }
  R(app,el('p',{class:'loading'},'กำลังโหลด...'));
  const g=await loadGame(true);
  if(!g){ R(app,el('div',{class:'panel'},el('p',{},'โหลดข้อมูลไม่สำเร็จ'),el('button',{class:'btn',onclick:progressPage},'ลองใหม่'))); return; }
  if((location.hash||'')!=='#/me') return;
  const L=g.level;
  const hero=el('section',{class:'panel ghero'},levelRing(L,g.xp.total,112),
    el('div',{class:'gmain'},el('p',{class:'contk'},'เลเวล '+L.level),el('h2',{},L.title),
      el('div',{class:'bar'},el('i',{style:`width:${Math.round((g.xp.total-L.from)/(L.to-L.from)*100)}%`})),
      el('p',{class:'muted small'},`${g.xp.total} XP · อีก ${L.to-g.xp.total} XP ถึงเลเวล ${L.level+1}`)),
    el('div',{class:'gstats'},
      el('div',{class:'gstat'},el('b',{},'+'+g.weekXp),el('small',{},'XP สัปดาห์นี้')),
      el('div',{class:'gstat'},el('b',{},g.streak.current),el('small',{},'วันต่อเนื่อง'+(g.streak.activeToday?'':' (วันนี้ยังไม่ได้เรียน)'))),
      el('div',{class:'gstat'},el('b',{},g.streak.longest),el('small',{},'ต่อเนื่องนานสุด'))));
  const ch=g.challenge;
  const chall=el('section',{class:'panel'},el('div',{class:'phead'},el('h2',{},'ภารกิจประจำสัปดาห์'),el('span',{class:'muted small'},'ถึง '+new Date(ch.end-1).toLocaleDateString('th-TH',{weekday:'short',day:'numeric',month:'short'}))),
    el('ul',{class:'goals'},ch.goals.map(x=>el('li',{class:x.done?'done':''},
      el('div',{class:'gtop'},el('span',{class:'gcheck','aria-hidden':'true'},x.done?'✓':''),el('span',{class:'gtitle'},`${x.title} ${x.n} ${x.unit}`),el('span',{class:'gxp'},`+${x.xp} XP`)),
      el('div',{class:'gbar'},el('div',{class:'bar slim'},el('i',{style:`width:${Math.round(x.cur/x.n*100)}%`})),el('span',{class:'small'},`${x.cur}/${x.n}`),x.done?null:el('a',{class:'small',href:x.href},'ไปทำ'))))),
    el('p',{class:'muted small'},ch.allDone?`ทำครบทุกเป้าหมายแล้ว ได้โบนัส ${ch.bonus} XP`:`ทำครบทุกเป้าหมายรับโบนัสเพิ่ม ${ch.bonus} XP ภารกิจเปลี่ยนทุกวันจันทร์`));
  const sugg=g.suggestions.length?el('section',{class:'panel'},el('h2',{},'ภารกิจแนะนำสำหรับคุณ'),
    el('ul',{class:'sugg'},g.suggestions.map(s=>el('li',{},el('a',{href:s.href},el('b',{},s.title),el('small',{},s.why)))))):null;
  const groups=[...new Set(g.badges.map(b=>b.group))];
  const badges=el('section',{class:'panel'},el('div',{class:'phead'},el('h2',{},'เหรียญรางวัล'),el('span',{class:'muted small'},`ได้แล้ว ${g.badges.filter(b=>b.earned).length} จาก ${g.badges.length}`)),
    groups.map(gr=>[el('h3',{class:'bgroup'},gr),el('ul',{class:'badges'},g.badges.filter(b=>b.group===gr).map(b=>el('li',{class:'badge'+(b.earned?' got':''),title:b.earned?`ได้รับเมื่อ ${fmtDate(b.earnedAt)}`:`ความคืบหน้า ${b.cur}/${b.n}`},
      el('span',{class:'medal'},svgIcon(GROUP_ICON[b.group]||GROUP_ICON['แล็บ'],24)),
      el('div',{},el('b',{},b.title),el('small',{},b.desc),b.earned?el('small',{class:'got'},'ได้รับแล้ว'):el('div',{class:'bprog'},el('div',{class:'bar slim'},el('i',{style:`width:${Math.round(b.cur/b.n*100)}%`})),el('small',{},`${b.cur}/${b.n}`))))))]));
  const hbar=(label,sub,v,href)=>el('div',{class:'hrow'},el('span',{class:'hl'},href?el('a',{href},label):label,sub?el('small',{},sub):null),
    v&&v.n?el('span',{class:'htrack',title:`${v.pct}% จาก ${v.n} ข้อ`},el('i',{style:`width:${v.pct}%`})):el('span',{class:'htrack none'}),
    el('span',{class:'hv'},v&&v.n?`${v.pct}%`:'–',v&&v.n&&v.n<3?el('small',{},' ข้อมูลน้อย'):null));
  const mU=Object.fromEntries(g.mastery.map(m=>[m.unit,m]));
  const mastery=el('section',{class:'panel'},el('h2',{},'ความเข้าใจรายหน่วย'),
    el('p',{class:'muted small'},'คำนวณจากคำตอบล่าสุดในโหมดฝึก การสอบ แบบทดสอบหลังเรียน และแล็บท้ายคาบ ยิ่งทำมากยิ่งแม่นยำ'),
    el('div',{class:'hbars'},UNITS.map((u,i)=>hbar(`หน่วย ${i+1}`,u,mU[i+1],`#/practice/u${i+1}`))));
  const types=el('section',{class:'panel'},el('h2',{},'ความแม่นยำตามรูปแบบข้อสอบ'),
    !g.types.length?el('p',{class:'muted'},'ยังไม่มีข้อมูล ลองฝึกทำข้อสอบก่อน'):el('div',{class:'hbars'},g.types.map(t=>hbar(TYPE_TH[t.type]||t.type,null,t))));
  const act=activityGrid(g.days,g.today);
  const xpTable=el('section',{class:'panel'},el('h2',{},'ที่มาของ XP'),el('div',{class:'tablewrap'},el('table',{class:'btable'},
    el('thead',{},el('tr',{},el('th',{},'กิจกรรม'),el('th',{},'วิธีคิด'),el('th',{class:'num'},'XP'))),
    el('tbody',{},g.rules.map(([k,,how])=>el('tr',{},el('td',{},XP_NAME[k]),el('td',{class:'small'},how),el('td',{class:'num'},g.xp[k]||0))),
      el('tr',{class:'tot'},el('td',{},el('b',{},'รวม')),el('td',{}),el('td',{class:'num'},el('b',{},g.xp.total)))))),
    el('p',{class:'muted small'},'XP คิดจากคะแนนที่เซิร์ฟเวอร์ตรวจแล้วเท่านั้น'));
  const lb=await leaderboardPanel(g);
  R(app,el('h1',{},'ความก้าวหน้าของฉัน'),hero,el('div',{class:'g2'},chall,sugg||act),sugg?act:null,badges,el('div',{class:'g2'},mastery,types),lb,xpTable);
  window.scrollTo(0,0);
}
function activityGrid(days,today){
  const set=new Set(days); const t=new Date(today+'T00:00:00Z');
  const dow=(t.getUTCDay()+6)%7;                 // 0 = Monday
  const start=new Date(t.getTime()-((11*7)+dow)*86400e3);
  const cols=[]; let n=0;
  for(let w=0;w<12;w++){ const col=el('div',{class:'hcol'}); for(let d=0;d<7;d++){ const dt=new Date(start.getTime()+(w*7+d)*86400e3); const s=dt.toISOString().slice(0,10); const fut=dt>t; const on=set.has(s); if(on) n++;
    col.append(el('span',{class:'hday'+(on?' on':'')+(fut?' fut':'')+(s===today?' today':''),title:`${dt.toLocaleDateString('th-TH',{weekday:'short',day:'numeric',month:'short',timeZone:'UTC'})}: ${on?'เข้าเรียน':'ไม่ได้เข้าเรียน'}`})); } cols.push(col); }
  return el('section',{class:'panel'},el('div',{class:'phead'},el('h2',{},'วันที่เข้าเรียน 12 สัปดาห์'),el('span',{class:'muted small'},`${n} วัน`)),
    el('div',{class:'heat',role:'img','aria-label':`เข้าเรียน ${n} วันใน 12 สัปดาห์ล่าสุด`},el('div',{class:'hdl'},['จ','','พ','','ศ','','อา'].map(x=>el('span',{},x))),cols),
    el('p',{class:'muted small'},'ช่องสีคือวันที่ทำกิจกรรมในระบบ เช่น อ่านบทเรียน ตอบแล็บ ฝึกข้อสอบ หรือทำห้องจำลอง'));
}
async function leaderboardPanel(g){
  const priv=el('label',{class:'lbpriv'},el('input',{type:'checkbox',checked:g.leaderboard.public?'':null,onchange:async e=>{ try{ await api('POST','/api/game/prefs',{lbPublic:e.target.checked}); GAME.leaderboard.public=e.target.checked; toast(e.target.checked?'แสดงชื่อของคุณในกระดานคะแนนแล้ว':'ซ่อนชื่อของคุณจากเพื่อนแล้ว'); if(g.leaderboard.enabled) drawLb(scope); }catch(err){ toast(err.message); e.target.checked=!e.target.checked; } }}),'ให้เพื่อนในห้องเห็นชื่อของฉันในกระดานคะแนน');
  const note=el('p',{class:'muted small'},'ถ้าไม่เลือก เพื่อนจะเห็นเป็น "ไม่เปิดเผยชื่อ" ครูเห็นข้อมูลของทุกคนตามปกติ กระดานแสดงเฉพาะ XP ไม่แสดงคะแนนสอบ');
  if(!g.leaderboard.enabled) return el('section',{class:'panel'},el('h2',{},'กระดานคะแนนของห้อง'),el('p',{class:'muted'},ME.class?'ครูยังไม่ได้เปิดกระดานคะแนนสำหรับห้องนี้':'บัญชีนี้ไม่ได้อยู่ในห้องเรียน'),ME.class?priv:null,ME.class?note:null);
  let scope='week';
  const body=el('div',{});
  const tabs=el('div',{class:'segs',role:'tablist'},[['week','สัปดาห์นี้'],['all','ทั้งหมด']].map(([k,t])=>el('button',{type:'button',role:'tab',class:k===scope?'on':'','aria-selected':String(k===scope),onclick:e=>{ scope=k; [...tabs.children].forEach(b=>{ b.classList.toggle('on',b===e.target); b.setAttribute('aria-selected',String(b===e.target)); }); drawLb(k); }},t)));
  async function drawLb(k){
    R(body,el('p',{class:'muted small'},'กำลังโหลด...'));
    try{ const d=await api('GET','/api/game/leaderboard?scope='+k);
      const row=r=>el('tr',{class:r.me?'me':''},el('td',{class:'num'},r.rank),el('td',{},r.hidden?el('span',{class:'muted'},r.name):r.name,r.me?el('small',{class:'tag'},'คุณ'):null),el('td',{class:'num'},r.level),el('td',{class:'num'},r.xp));
      R(body,el('div',{class:'tablewrap'},el('table',{class:'btable lb'},el('thead',{},el('tr',{},el('th',{class:'num'},'อันดับ'),el('th',{},'ชื่อ'),el('th',{class:'num'},'เลเวล'),el('th',{class:'num'},k==='week'?'XP สัปดาห์นี้':'XP รวม'))),
        el('tbody',{},d.rows.map(row),d.me?[el('tr',{class:'gap'},el('td',{colspan:4},'…')),row(d.me)]:null))),
        el('p',{class:'muted small'},`ทั้งห้อง ${d.total} คน`+(k==='week'?' · XP สัปดาห์นี้ไม่รวมการอ่านเนื้อหา':'')));
    }catch(e){ R(body,el('p',{class:'msg bad'},e.message)); }
  }
  drawLb(scope);
  return el('section',{class:'panel'},el('div',{class:'phead'},el('h2',{},'กระดานคะแนนของห้อง'),tabs),body,priv,note);
}

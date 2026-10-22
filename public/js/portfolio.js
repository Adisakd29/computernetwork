/* NetLab 3.0 Phase 5: Student Network Skills Portfolio (one renderer for the student app and the teacher page).
   NL_PORTFOLIO.render(root, { uid, teacher, back })
     uid      undefined = my own portfolio (GET /api/portfolio); a number = a student of the teacher
     teacher  true on teacher.html: record class observations, comment, score the capstone defense
   Every number comes from the server (evidence graded there); this file only displays it and sends edits. */
(function () {
  'use strict';
  const h = (tag, attrs, ...kids) => {
    const e = document.createElement(tag);
    for (const k in attrs || {}) {
      const v = attrs[k]; if (v == null || v === false) continue;
      if (k === 'class') e.className = v; else if (k === 'style') e.setAttribute('style', v);
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? '' : v);
    }
    kids.flat(Infinity).forEach(c => { if (c == null || c === false) return; e.append(c.nodeType ? c : document.createTextNode(String(c))); });
    return e;
  };
  async function call(method, path, body) {
    const r = await fetch(path, { method, credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-NetLab': '1' }, body: body ? JSON.stringify(body) : undefined });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error(j.message || ('HTTP ' + r.status)); e.status = r.status; throw e; }
    return j;
  }
  const fmtD = ms => ms ? new Date(ms).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }) : '-';
  const LV = ['Beginner', 'Developing', 'Proficient', 'Advanced'];
  const KIND = { sim: 'ห้องจำลอง', lab: 'แล็บในบทเรียน', teacher: 'ครูบันทึกจากการปฏิบัติจริง' };

  const CSS = `
.pf{max-width:1100px;margin:0 auto}
.pf .pfhead{display:flex;flex-wrap:wrap;gap:12px;align-items:flex-start;justify-content:space-between}
.pf h1{margin:0 0 4px;font-size:clamp(22px,4vw,30px)} .pf h2{margin:0 0 8px} .pf h3{margin:14px 0 6px;font-size:17px}
.pf .pfmeta{color:var(--muted);margin:0}
.pf .pfcard{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:16px 18px;margin:0 0 14px}
.pf .pfnote{color:var(--muted);font-size:14px;margin:6px 0 0}
.pf .lvlchip{display:inline-block;padding:2px 10px;border-radius:999px;font-weight:700;font-size:13px;border:1.5px solid var(--line);white-space:nowrap}
.pf .lv0{border-color:var(--line);color:var(--muted)} .pf .lv1{border-color:var(--orange)} .pf .lv2{border-color:var(--blue)} .pf .lv3{border-color:var(--green)} .pf .lv4{border-color:var(--green);background:var(--green);color:var(--panel)}
.pf .pfgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:10px}
.pf .pfsk{display:block;text-decoration:none;color:var(--ink);border:1px solid var(--line);border-radius:12px;padding:10px 12px;background:var(--panel)}
.pf .pfsk b{display:block;margin-bottom:6px} .pf .pfsk small{display:block;color:var(--muted);margin-top:6px}
.pf .pfbar{height:6px;border-radius:4px;background:var(--field);overflow:hidden;margin-top:6px} .pf .pfbar i{display:block;height:100%;background:var(--blue)}
.pf table{border-collapse:collapse;width:100%;font-size:14.5px} .pf th,.pf td{border-bottom:1px solid var(--line);padding:7px 8px;text-align:left;vertical-align:top}
.pf th{background:var(--field)} .pf .tw{overflow-x:auto;border:1px solid var(--line);border-radius:10px;margin:6px 0}
.pf .rub td.on{outline:2px solid var(--green);outline-offset:-2px;font-weight:600}
.pf .rub td:first-child{white-space:nowrap;width:1%}
/* capstone defense rubric: the criterion column wraps so the four levels stay reachable inside the scroll box on phones */
.pf .rub.rubdef{min-width:640px;table-layout:fixed} .pf .rub.rubdef td:first-child,.pf .rub.rubdef th:first-child{white-space:normal;width:24%} .pf .rub.rubdef select{width:100%;margin-top:4px}
.pf .pfprint{display:none}
.pf h2[tabindex]{scroll-margin-top:70px} .pf h2[tabindex]:focus{outline:2px solid var(--blue);outline-offset:3px;border-radius:4px}
.pf .pferr .pfrow{margin-top:10px}
.pf .num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
.pf textarea,.pf input,.pf select{font:inherit;color:var(--ink);background:var(--field);border:1px solid var(--line);border-radius:8px;padding:7px 9px;max-width:100%}
.pf textarea{width:100%;min-height:84px;box-sizing:border-box}
.pf .pfrow{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:6px 0}
.pf .pfbtn{font:inherit;font-weight:600;cursor:pointer;border-radius:9px;padding:7px 14px;border:1px solid var(--ink);background:var(--ink);color:var(--panel)}
.pf .pfbtn.ghost{background:transparent;color:var(--ink);border-color:var(--line)} .pf .pfbtn.sm{padding:4px 10px;font-size:14px}
.pf .pfmsg{font-size:14px;color:var(--muted)} .pf .pfmsg.bad{color:var(--bad)} .pf .pfmsg.ok{color:var(--ok)}
.pf .pfsec{scroll-margin-top:70px}
.pf .pfobs{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:8px;margin:8px 0}
.pf .pfobs label{display:flex;flex-direction:column;gap:3px;font-size:14px}
.pf .pfquote{white-space:pre-wrap;border-left:3px solid var(--line);padding:4px 10px;margin:6px 0;color:var(--ink)}
.pf .muted{color:var(--muted)}
@media (max-width:560px){ .pf .pfcard{padding:12px} .pf table{font-size:13.5px} }
@media print{
  body *{visibility:hidden} .pf,.pf *{visibility:visible} .pf{position:absolute;left:0;top:0;width:100%;max-width:none}
  .pf .noprint{display:none!important} .pf .pfcard{break-inside:avoid-page;border-color:#999} .pf .pfsec{break-before:auto}
  .pf textarea{display:none!important} .pf .pfprint{display:block;white-space:pre-wrap;overflow-wrap:anywhere;border-left:3px solid #999;padding:4px 10px;margin:6px 0}
  .pf .pfprint.empty{color:#4A5868;font-style:italic} .pf .tw{overflow:visible} .pf .rub.rubdef{min-width:0}
  /* dark theme on screen still prints dark text on white paper */
  .pf{--ink:#1C2530;--panel:#FFFFFF;--muted:#4A5868;--line:#999999;--field:#F2F4F6;--blue:#2A66CF;--green:#1B7A4B;--orange:#A34E0F;--bad:#C23B3B;--ok:#1A7741;color-scheme:light;color:#1C2530;background:#FFFFFF}
  .pf .pfcard{background:#FFFFFF}
}`;
  function style() { if (!document.getElementById('nl-pf-css')) document.head.append(h('style', { id: 'nl-pf-css' }, CSS)); }
  const lvlIndex = l => l ? LV.indexOf(l) + 1 : 0;
  /* a textarea prints badly (clipped, placeholder shown as if it were an answer): print a full-text copy instead */
  function printCopy(ta, label) {
    const out = h('div', { class: 'pfprint', 'aria-hidden': 'true' });
    const sync = () => { const v = ta.value.trim(); out.className = 'pfprint' + (v ? '' : ' empty'); out.textContent = (label ? label + ': ' : '') + (v ? ta.value : 'ยังไม่ได้เขียน'); };
    ta.addEventListener('input', sync); sync();
    return out;
  }
  const chip = (l, th) => h('span', { class: 'lvlchip lv' + lvlIndex(l) }, l ? th[l] : 'ยังไม่มีหลักฐาน');

  async function render(root, opt) {
    opt = opt || {}; style();
    root.replaceChildren(h('div', { class: 'pf' }, h('p', { class: 'muted' }, 'กำลังรวบรวมหลักฐาน...')));
    let d;
    try { d = await call('GET', opt.uid ? `/api/teacher/students/${opt.uid}/portfolio` : '/api/portfolio'); }
    catch (e) {
      const offline = !e.status || (typeof navigator !== 'undefined' && navigator.onLine === false);
      const msg = e.status === 401 ? 'เข้าสู่ระบบก่อนจึงจะดูแฟ้มผลงานได้ เพราะหลักฐานมาจากผลงานที่บันทึกในบัญชี'
        : e.status === 403 || e.status === 404 ? 'ไม่พบแฟ้มนี้ หรือบัญชีนี้ไม่มีสิทธิ์เปิด'
        : offline ? 'ต้องเชื่อมต่ออินเทอร์เน็ตจึงจะเปิดแฟ้มผลงานได้ เพราะหลักฐานทุกชิ้นรวบรวมจากเซิร์ฟเวอร์ ตรวจสอบการเชื่อมต่อแล้วกด "ลองใหม่"'
        : 'เซิร์ฟเวอร์ขัดข้องชั่วคราว จึงโหลดแฟ้มผลงานไม่สำเร็จ ลองใหม่อีกครั้ง ถ้ายังไม่ได้ให้แจ้งครูผู้สอน';
      root.replaceChildren(h('div', { class: 'pf' }, h('div', { class: 'pfcard pferr', role: e.status === 401 ? null : 'alert' }, h('h1', {}, 'แฟ้มผลงานทักษะ'), h('p', {}, msg),
        e.status === 401 ? null : h('div', { class: 'pfrow' }, h('button', { class: 'pfbtn', type: 'button', onclick: () => render(root, opt) }, 'ลองใหม่'), opt.back || null))));
      return;
    }
    const T = !!opt.teacher, me = !opt.uid, th = d.levelTh, s = d.student;
    const reload = () => render(root, opt);
    const box = h('div', { class: 'pf' });

    /* ---------- header ---------- */
    box.append(h('div', { class: 'pfcard' },
      h('div', { class: 'pfhead' },
        h('div', {}, h('h1', {}, 'แฟ้มผลงานทักษะ'), h('p', { class: 'pfmeta' }, 'Student Network Skills Portfolio · ระบบเครือข่ายคอมพิวเตอร์ (21910-2013)'),
          h('p', { style: 'margin:8px 0 0;font-weight:600' }, `${s.name}${s.no ? ' · เลขที่ ' + s.no : ''}${s.class ? ' · ' + s.class : ''}`),
          h('p', { class: 'pfmeta' }, 'สร้างจากผลงานที่บันทึกในระบบ ณ ' + new Date(d.generatedAt).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' }))),
        h('div', { class: 'pfrow noprint' }, opt.back || null, h('button', { class: 'pfbtn', type: 'button', onclick: () => window.print() }, 'พิมพ์ / บันทึกเป็น PDF'))),
      h('p', { class: 'pfnote' }, 'ระดับทักษะคิดจากหลักฐานจริงเท่านั้น: งานลงมือทำในห้องจำลองและแล็บที่ตรวจที่เซิร์ฟเวอร์ และการปฏิบัติจริงที่ครูบันทึก (น้ำหนัก 70%) กับผลข้อสอบ (น้ำหนัก 30%) การเปิดอ่านหน้าเว็บไม่นับเป็นหลักฐาน'),
      h('div', { class: 'pfrow' }, LV.map(l => chip(l, th)))));

    /* ---------- summary ---------- */
    box.append(h('div', { class: 'pfcard' }, h('h2', {}, 'สรุปทักษะ 10 ด้าน'),
      h('div', { class: 'pfgrid' }, d.skills.map(k => h('a', { class: 'pfsk', href: '#pf-' + k.id, onclick: e => { e.preventDefault(); const t = document.getElementById('pf-' + k.id); if (!t) return; const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches; t.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' }); const hd = t.querySelector('h2'); if (hd) hd.focus({ preventScroll: true }); } },
        h('b', {}, k.th), chip(k.level, th),
        h('div', { class: 'pfbar', role: 'img', 'aria-label': `คะแนนรวม ${k.pct ?? 0}%` }, h('i', { style: `width:${k.pct ?? 0}%` })),
        h('small', {}, `หลักฐานลงมือทำ ${k.hands.length} · ข้อสอบ ${k.know.n} ข้อ`))))));

    /* ---------- capstone ---------- */
    box.append(capstoneCard(d, { T, me, reload }));

    /* ---------- per skill ---------- */
    d.skills.forEach(k => box.append(skillCard(d, k, { T, me, uid: opt.uid, reload })));

    /* ---------- weeks ---------- */
    box.append(h('div', { class: 'pfcard' }, h('h2', {}, 'ผลรายสัปดาห์'),
      h('p', { class: 'pfnote' }, 'ฝึกปฏิบัติรวม = คะแนนรอบที่ดีที่สุดของ Guided + Independent + Troubleshooting ตามสัดส่วนที่ครูกำหนด ภารกิจห้องจำลองนับว่าผ่านเมื่อได้อย่างน้อย 70% ของคะแนน'),
      h('div', { class: 'tw', tabindex: '0', 'aria-label': 'ตารางผลรายสัปดาห์ เลื่อนดูได้' }, h('table', {},
        h('thead', {}, h('tr', {}, ['สัปดาห์', 'หัวข้อ', 'ก่อนเรียน', 'หลังเรียน', 'ฝึกปฏิบัติรวม', 'โจทย์ลงมือที่ตอบถูก', 'ภารกิจในฝึกปฏิบัติที่ผ่าน', 'ภารกิจเสริม (ไม่บังคับ)'].map(x => h('th', {}, x)))),
        h('tbody', {}, d.weeks.map(w => h('tr', {},
          h('td', { class: 'num' }, w.week), h('td', {}, w.title),
          h('td', { class: 'num' }, w.pre ? `${w.pre.score}/${w.pre.max}` : '-'), h('td', { class: 'num' }, w.post ? `${w.post.score}/${w.post.max}` : '-'),
          h('td', { class: 'num' }, w.practical && w.practical.best != null ? `${w.practical.best}% ${w.practical.passed ? 'ผ่าน' : 'ยังไม่ผ่าน'}${w.practical.legacy ? ' (งานเดิม)' : ''}` : '-'),
          h('td', { class: 'num' }, w.lab.total ? `${w.lab.solved}/${w.lab.total} ข้อ` : '-'),
          h('td', { class: 'num' }, `${w.practice.passed}/${w.practice.total}`),
          h('td', { class: 'num' }, w.practice.optional && w.practice.optional.total ? `${w.practice.optional.passed}/${w.practice.optional.total}` : '-'))))))));

    /* ---------- overall ---------- */
    box.append(noteCard('overall', 'สะท้อนการเรียนรู้ทั้งรายวิชา', d.overall, { T, me, uid: opt.uid, reload, what: 'ทั้งรายวิชา', prompt: 'ตลอด 18 สัปดาห์ ฉันทำอะไรได้ดีขึ้นที่สุด หลักฐานคืองานใด และจะพัฒนาทักษะใดต่อ' }));
    root.replaceChildren(box);
  }

  function capstoneCard(d, o) {
    const c = d.capstone, R = c.defense.rubric, th = d.levelTh;
    const card = h('div', { class: 'pfcard pfsec', id: 'pf-capstone' }, h('h2', {}, 'โครงงานปิดท้าย (Capstone)'));
    const rows = [
      ['ภารกิจ ' + c.title + ' (ระบบตรวจ)', c.auto ? `${c.auto.score}/${c.auto.max}` : (c.best ? `${c.best.best}/${c.best.max}` : 'ยังไม่ส่ง')],
      ['รายงานเหตุผลการออกแบบ (ครูตรวจ)', c.report && c.report.score != null ? `${c.report.score}/${c.report.max}` : (c.report ? 'รอครูตรวจ' : '-')],
      [R.title + ' (ครูประเมิน)', c.defense.score != null ? `${c.defense.score}/${c.defense.max}` : 'ยังไม่ได้ประเมิน']
    ];
    card.append(h('div', { class: 'tw' }, h('table', {}, h('tbody', {}, rows.map(r => h('tr', {}, h('td', {}, r[0]), h('td', { class: 'num' }, r[1])))))));
    if (o.me) card.append(h('p', { class: 'noprint' }, h('a', { href: '#/sim/' + c.ref }, 'เปิดภารกิจโครงงานในห้องจำลอง')));
    if (c.auto && Array.isArray(c.auto.rubric) && c.auto.rubric.length) card.append(h('h3', {}, 'ผลตรวจอัตโนมัติรายเกณฑ์'),
      h('div', { class: 'tw' }, h('table', {}, h('tbody', {}, c.auto.rubric.map(x => h('tr', {}, h('td', {}, x.title, x.note ? h('div', { class: 'muted' }, x.note) : null), h('td', { class: 'num' }, `${x.score}/${x.max}`)))))));
    if (c.report && c.report.text) card.append(h('h3', {}, 'รายงานของนักเรียน'), h('div', { class: 'pfquote' }, c.report.text.length > 1500 ? c.report.text.slice(0, 1500) + ' ...' : c.report.text));
    if (c.report && c.report.comment) card.append(h('p', {}, h('b', {}, 'ความเห็นครูต่อรายงาน: '), c.report.comment));
    /* defense rubric: 1-4 per criterion */
    card.append(h('h3', {}, R.title), h('p', { class: 'pfnote' }, R.note));
    const sel = {};
    const tbl = h('table', { class: 'rub rubdef' }, h('thead', {}, h('tr', {}, h('th', {}, 'เกณฑ์'), [1, 2, 3, 4].map(n => h('th', {}, `ระดับ ${n}`)))),
      h('tbody', {}, R.criteria.map(cr => {
        const cur = c.defense.scores ? Number(c.defense.scores[cr.id]) || 0 : 0;
        return h('tr', {}, h('td', {}, h('b', {}, cr.title),
          o.T ? h('div', { class: 'noprint' }, (sel[cr.id] = h('select', { 'aria-label': 'ระดับ ' + cr.title }, h('option', { value: '' }, 'ยังไม่ประเมิน'), [1, 2, 3, 4].map(n => { const op = h('option', { value: String(n) }, 'ระดับ ' + n); if (n === cur) op.selected = true; return op; })))) : null),
          cr.levels.map((t, i) => h('td', { class: cur === i + 1 ? 'on' : null }, t)));
      })));
    card.append(h('div', { class: 'tw' }, tbl));
    if (c.defense.comment && !o.T) card.append(h('p', {}, h('b', {}, 'ความเห็นครู: '), c.defense.comment));   // the teacher edits it below
    if (c.defense.at) card.append(h('p', { class: 'pfnote' }, `ประเมินโดย ${c.defense.teacher || 'ครู'} เมื่อ ${fmtD(c.defense.at)}`));
    if (o.T) {
      const cm = h('textarea', { 'aria-label': 'ความเห็นครูต่อการนำเสนอ', placeholder: 'ความเห็นต่อการนำเสนอและการป้องกันโครงงาน' }); cm.value = c.defense.comment || '';
      const msg = h('span', { class: 'pfmsg', role: 'status' });
      card.append(printCopy(cm, 'ความเห็นครู'), h('div', { class: 'noprint' }, cm, h('div', { class: 'pfrow' }, h('button', { class: 'pfbtn', type: 'button', onclick: async () => {
        const scores = {}; for (const k in sel) if (sel[k].value) scores[k] = Number(sel[k].value);
        msg.className = 'pfmsg'; msg.textContent = 'กำลังบันทึก...';
        try { await call('PUT', `/api/teacher/students/${d.student.id}/capstone`, { scores, comment: cm.value }); o.reload(); }
        catch (e) { msg.className = 'pfmsg bad'; msg.textContent = e.message; }
      } }, 'บันทึกการประเมินการนำเสนอ'), msg)));
    }
    card.append(noteInline('capstone', c.note, { ...o, uid: d.student.id, what: 'โครงงานปิดท้าย', prompt: 'โครงงานนี้ฉันออกแบบอย่างไร ทดสอบอะไร เจอปัญหาอะไรและแก้อย่างไร' }));
    return card;
  }

  function skillCard(d, k, o) {
    const th = d.levelTh, li = lvlIndex(k.level);
    const card = h('div', { class: 'pfcard pfsec', id: 'pf-' + k.id },
      h('div', { class: 'pfhead' }, h('h2', { tabindex: '-1' }, `${k.th} `, h('span', { class: 'muted', style: 'font-weight:500;font-size:15px' }, k.name)), chip(k.level, th)),
      h('p', { class: 'pfnote' }, k.reasons.join(' · ') + (k.pct != null ? ` · คะแนนรวม ${k.pct}%` : '')),
      k.next ? h('p', {}, h('b', {}, 'ขั้นต่อไป: '), k.next) : null,
      h('h3', {}, 'เกณฑ์ (Rubric)'),
      h('div', { class: 'tw' }, h('table', { class: 'rub' }, h('tbody', {}, k.rubric.map((t, i) => h('tr', {}, h('td', { class: i + 1 === li ? 'on' : null }, th[LV[i]]), h('td', { class: i + 1 === li ? 'on' : null }, t)))))));
    card.append(h('h3', {}, `หลักฐานการลงมือทำ (${k.hands.length})`));
    if (!k.hands.length) card.append(h('p', { class: 'muted' }, 'ยังไม่มีหลักฐาน ทำภารกิจในห้องจำลองหรือแล็บของสัปดาห์ที่วัดทักษะนี้'));
    else card.append(h('div', { class: 'tw' }, h('table', {},
      h('thead', {}, h('tr', {}, ['วันที่', 'ประเภท', 'งาน', 'ผล', o.T ? '' : null].filter(x => x !== null).map(x => h('th', {}, x)))),
      h('tbody', {}, k.hands.map(x => h('tr', {},
        h('td', { class: 'num' }, fmtD(x.at)), h('td', {}, KIND[x.kind] || ''),
        h('td', {}, x.kind === 'sim' && o.me ? h('a', { href: '#/sim/' + x.src.replace(':', '/') }, x.title) : x.title, x.sim ? h('div', { class: 'muted' }, x.sim) : null,
          x.kind === 'teacher' ? h('div', { class: 'muted' }, [x.week ? `สัปดาห์ ${x.week}` : null, x.teacher ? `บันทึกโดย ${x.teacher}` : null, x.note || null].filter(Boolean).join(' · ')) : null),
        h('td', { class: 'num' }, x.kind === 'sim' ? `${x.best}/${x.max}` : x.kind === 'lab' ? `${x.solved}/${x.total} ข้อ` : `ระดับ ${x.obsLevel}/4`),
        o.T ? h('td', {}, x.kind === 'teacher' ? h('button', { class: 'pfbtn ghost sm noprint', type: 'button', onclick: async () => {
          if (!confirm('ลบหลักฐานนี้?')) return;
          try { await call('DELETE', `/api/teacher/observations/${x.id}`); o.reload(); } catch (e) { alert(e.message); }
        } }, 'ลบ') : null) : null))))));
    card.append(h('p', { class: 'pfnote' }, k.know.n ? `ความรู้จากข้อสอบ: ${k.know.n} ข้อ ถูกเฉลี่ย ${k.know.pct}%` : 'ยังไม่มีผลข้อสอบของทักษะนี้'));
    if (o.T) card.append(obsForm(d, k, o));
    card.append(noteInline(k.id, k.note, { ...o, uid: d.student.id, what: k.th, prompt: 'งานใดเป็นหลักฐานที่ดีที่สุดของทักษะนี้ ทำไม และฉันจะพัฒนาอะไรต่อ' }));
    return card;
  }

  function obsForm(d, k, o) {
    const lvl = h('select', { 'aria-label': 'ระดับที่สังเกต' }, d.obsLevels.map(x => h('option', { value: String(x.level) }, `${x.level} ${x.th}`)));
    const title = h('input', { 'aria-label': 'สิ่งที่นักเรียนทำ', placeholder: 'เช่น เข้าหัว RJ-45 จริง 2 เส้น ผ่านเครื่องทดสอบ', maxlength: '200' });
    const week = h('input', { type: 'number', min: '1', max: '18', 'aria-label': 'สัปดาห์', placeholder: '1–18' });
    const day = h('input', { type: 'date', 'aria-label': 'วันที่สังเกต' }); day.value = new Date().toISOString().slice(0, 10);
    const note = h('input', { 'aria-label': 'หมายเหตุ', placeholder: 'หมายเหตุ (ไม่บังคับ)', maxlength: '1000' });
    const msg = h('span', { class: 'pfmsg', role: 'status' });
    return h('details', { class: 'noprint' }, h('summary', {}, 'บันทึกหลักฐานจากการปฏิบัติจริงในห้องเรียน'),
      h('p', { class: 'pfnote' }, 'ใช้กับงานที่ระบบตรวจไม่ได้ เช่น เข้าหัวสายจริง ติดตั้งอุปกรณ์จริง หรือการตอบคำถามปากเปล่า ระดับ 3 ขึ้นไปนับเป็นงานที่ผ่านเต็ม ระดับ 4 นับเท่างานระดับยาก'),
      h('div', { class: 'pfobs' }, h('label', {}, 'ระดับ', lvl), h('label', { style: 'grid-column:span 2' }, 'สิ่งที่นักเรียนทำ', title), h('label', {}, 'สัปดาห์', week), h('label', {}, 'วันที่', day), h('label', { style: 'grid-column:1/-1' }, 'หมายเหตุ', note)),
      h('div', { class: 'pfrow' }, h('button', { class: 'pfbtn', type: 'button', onclick: async () => {
        msg.className = 'pfmsg'; msg.textContent = 'กำลังบันทึก...';
        try { await call('POST', `/api/teacher/students/${d.student.id}/observations`, { skill: k.id, level: Number(lvl.value), title: title.value, week: week.value || null, observed_on: day.value || null, note: note.value }); o.reload(); }
        catch (e) { msg.className = 'pfmsg bad'; msg.textContent = e.message; }
      } }, 'บันทึกหลักฐาน'), msg));
  }

  /* reflection (student writes) + teacher comment (teacher writes); both read-only for the other side */
  function noteInline(key, n, o) {
    n = n || {};
    const wrap = h('div', {}, h('h3', {}, 'สะท้อนการเรียนรู้'));
    if (o.me) {
      const ta = h('textarea', { 'aria-label': 'สะท้อนการเรียนรู้ของฉัน: ' + (o.what || ''), placeholder: o.prompt, maxlength: '2000' }); ta.value = n.reflection || '';
      const msg = h('span', { class: 'pfmsg', role: 'status' }, n.reflectedAt ? 'บันทึกล่าสุด ' + fmtD(n.reflectedAt) : '');
      wrap.append(ta, printCopy(ta), h('div', { class: 'pfrow noprint' }, h('button', { class: 'pfbtn ghost', type: 'button', onclick: async () => {
        msg.className = 'pfmsg'; msg.textContent = 'กำลังบันทึก...';
        try { await call('PUT', `/api/portfolio/notes/${key}`, { reflection: ta.value }); msg.className = 'pfmsg ok'; msg.textContent = 'บันทึกแล้ว'; }
        catch (e) { msg.className = 'pfmsg bad'; msg.textContent = e.message; }
      } }, 'บันทึก'), msg));
    } else wrap.append(n.reflection ? h('div', { class: 'pfquote' }, n.reflection) : h('p', { class: 'muted' }, 'นักเรียนยังไม่ได้เขียน'));
    if (o.T) {
      const ta = h('textarea', { 'aria-label': 'ความเห็นครู: ' + (o.what || ''), placeholder: 'ความเห็นและข้อแนะนำจากครู', maxlength: '2000' }); ta.value = n.comment || '';
      const msg = h('span', { class: 'pfmsg', role: 'status' });
      wrap.append(h('h3', {}, 'ความเห็นครู'), ta, printCopy(ta), h('div', { class: 'pfrow noprint' }, h('button', { class: 'pfbtn ghost', type: 'button', onclick: async () => {
        msg.className = 'pfmsg'; msg.textContent = 'กำลังบันทึก...';
        try { await call('PUT', `/api/teacher/students/${o.uid}/notes/${key}`, { comment: ta.value }); msg.className = 'pfmsg ok'; msg.textContent = 'บันทึกแล้ว'; }
        catch (e) { msg.className = 'pfmsg bad'; msg.textContent = e.message; }
      } }, 'บันทึกความเห็น'), msg));
    } else if (n.comment) wrap.append(h('p', {}, h('b', {}, 'ความเห็นครู: '), n.comment));
    return wrap;
  }
  function noteCard(key, title, n, o) { return h('div', { class: 'pfcard' }, h('h2', {}, title), noteInline(key, n, { ...o })); }

  window.NL_PORTFOLIO = { render };
})();

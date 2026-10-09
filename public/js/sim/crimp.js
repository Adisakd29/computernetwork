'use strict';
/*
 * NetLab - UTP Crimping Simulator (browser module, SIM-SPEC §1 + §4.3)
 * Registers window.NL_SIMS.crimp. Real logic: the LAN tester result is computed from the wiring of both ends.
 * Plug model (same as server/sims/crimp.js): plug inner length 22 mm; the strain-relief wedge grips the jacket
 * when the jacket edge is >= 8 mm inside the plug; the jacket cannot go deeper than 12 mm.
 */
(function () {
  const CSS = `
.nls-crimp{--nls-crimp-mono:"JetBrains Mono",Consolas,monospace;color:var(--ink);font-family:inherit;max-width:980px;margin:0 auto;min-width:0}
.nls-crimp *,.nls-crimp *::before,.nls-crimp *::after{box-sizing:border-box}
.nls-crimp h2{font-size:24px;line-height:1.25;margin:0 0 6px}
.nls-crimp h3{font-size:18px;margin:0 0 8px;line-height:1.35}
.nls-crimp p{margin:0 0 8px}
.nls-crimp-muted{color:var(--muted);font-size:15px}
.nls-crimp-card{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:14px 16px;margin:0 0 14px;min-width:0}
.nls-crimp-btn{background:var(--ink);color:var(--bg);border:1px solid var(--ink);border-radius:8px;padding:8px 14px;font:inherit;font-weight:600;font-size:15px;cursor:pointer;line-height:1.3;min-height:40px}
.nls-crimp-btn.nls-crimp-ghost{background:transparent;color:var(--ink);border-color:var(--line)}
.nls-crimp-btn[aria-pressed="true"]{background:var(--blue);border-color:var(--blue);color:var(--bg)}
.nls-crimp-btn:disabled{opacity:.45;cursor:default}
.nls-crimp-btn:focus-visible,.nls-crimp-slot:focus-visible,.nls-crimp-wire:focus-visible,.nls-crimp-step:focus-visible{outline:3px solid var(--blue);outline-offset:2px}
.nls-crimp-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.nls-crimp-howto summary{cursor:pointer;font-weight:600}
.nls-crimp-howto ol{margin:8px 0 0;padding-left:22px;font-size:15px}
.nls-crimp-missions{display:grid;grid-template-columns:repeat(auto-fill,minmax(145px,1fr));gap:8px;margin:0 0 14px}
.nls-crimp-mbtn{display:flex;flex-direction:column;align-items:flex-start;text-align:left;gap:2px;background:var(--panel);color:var(--ink);border:1px solid var(--line);border-radius:10px;padding:9px 12px;font:inherit;cursor:pointer;min-width:0}
.nls-crimp-mbtn b{font-size:15px;line-height:1.3}
.nls-crimp-mbtn span{font-size:13px;color:var(--muted)}
.nls-crimp-mbtn.nls-crimp-on{border-color:var(--blue);box-shadow:inset 0 0 0 2px var(--blue)}
.nls-crimp-mbtn .nls-crimp-best{color:var(--ok);font-weight:600}
.nls-crimp-lvl{font:600 11px var(--nls-crimp-mono);text-transform:uppercase;letter-spacing:.04em;color:var(--muted)}
.nls-crimp-rules{margin:6px 0 8px;padding-left:22px}
.nls-crimp-hints{margin:8px 0 0;padding-left:22px;font-size:15px}
.nls-crimp-orient{display:flex;gap:8px;align-items:flex-start;background:var(--field);border:1px dashed var(--line);border-radius:8px;padding:8px 10px;font-size:14px;margin:8px 0}
.nls-crimp-ends{display:flex;gap:8px;margin:0 0 10px;flex-wrap:wrap}
.nls-crimp-steps{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:4px;margin:0 0 12px;padding:0;list-style:none}
.nls-crimp-step{width:100%;border:1px solid var(--line);background:var(--field);color:var(--muted);border-radius:8px;padding:5px 2px;font:inherit;font-size:12px;line-height:1.2;cursor:pointer;display:flex;flex-direction:column;align-items:center;min-height:44px}
.nls-crimp-step b{font:600 14px var(--nls-crimp-mono)}
.nls-crimp-step.nls-crimp-cur{border-color:var(--blue);color:var(--ink);box-shadow:inset 0 0 0 2px var(--blue)}
.nls-crimp-step.nls-crimp-done{color:var(--ok)}
.nls-crimp-step:disabled{opacity:.45;cursor:default}
.nls-crimp-svgbox{background:var(--field);border:1px solid var(--line);border-radius:10px;padding:6px;margin:8px 0;overflow:hidden}
.nls-crimp-svgbox svg{display:block;width:100%;height:auto;max-height:400px;margin:0 auto}
.nls-crimp-svgbox svg.nls-crimp-wide{max-width:560px;max-height:none}
.nls-crimp-svg text{font-family:var(--nls-crimp-mono);fill:var(--ink)}
.nls-crimp-range{display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px;margin:8px 0}
.nls-crimp-range label{font-weight:600}
.nls-crimp-range input[type=range]{flex:1 1 180px;min-width:0;accent-color:var(--blue);height:32px}
.nls-crimp-range output{font:600 16px var(--nls-crimp-mono);min-width:64px}
.nls-crimp-pool{display:flex;flex-wrap:wrap;gap:6px;min-height:84px;padding:12px 8px 8px;border:1px dashed var(--line);border-radius:10px;background:var(--field);margin:6px 0 10px}
.nls-crimp-pool.nls-crimp-over{border-color:var(--blue);background:var(--panel)}
.nls-crimp-wire{position:relative;border:2px solid var(--line);background:var(--panel);border-radius:8px;padding:3px 3px 2px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;cursor:grab;touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;color:var(--ink);font:inherit;font-size:12px;line-height:1.1;width:70px;min-width:0}
.nls-crimp-wv svg{width:16px;height:52px;display:block}
.nls-crimp-wh{display:none}
.nls-crimp-wh svg{width:100%;max-width:64px;height:14px;display:block}
.nls-crimp-wname{font-weight:600;text-align:center;max-width:100%}
.nls-crimp-wname span{display:inline-block}
.nls-crimp-wire.nls-crimp-sel,.nls-crimp-wire[aria-pressed="true"]{border:3px solid var(--blue);outline:3px solid var(--blue);outline-offset:1px;background:color-mix(in srgb,var(--blue) 16%,var(--panel))}
.nls-crimp-selbadge{position:absolute;top:-11px;left:50%;transform:translateX(-50%);background:var(--blue);color:var(--bg);font-size:11px;font-weight:700;line-height:16px;border-radius:6px;padding:0 5px;white-space:nowrap;pointer-events:none;z-index:1}
.nls-crimp-slots{display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:4px;max-width:560px;margin:0 auto;padding-top:11px}
.nls-crimp-slot{position:relative;border:2px dashed var(--line);background:var(--panel);border-radius:8px;min-height:112px;padding:4px 0 3px;display:flex;flex-direction:column;align-items:center;justify-content:space-between;gap:2px;cursor:pointer;color:var(--ink);font:inherit;min-width:0;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none}
.nls-crimp-slot.nls-crimp-filled{touch-action:none}
.nls-crimp-slot b{font:700 16px var(--nls-crimp-mono);line-height:1.1}
.nls-crimp-slot small{font-size:12px;font-weight:600;color:var(--ink);line-height:1.15;text-align:center;min-height:28px;display:block;width:100%;padding:0 1px}
.nls-crimp-slot small span{display:inline-block}
.nls-crimp-slot small.nls-crimp-empty{color:var(--muted);font-weight:400}
.nls-crimp-slot svg{width:16px;height:52px;display:block;flex:none}
.nls-crimp-slot.nls-crimp-filled{border-style:solid}
.nls-crimp-picking .nls-crimp-slot:not(.nls-crimp-filled){border-color:var(--blue)}
.nls-crimp-slot.nls-crimp-over{border-color:var(--blue);box-shadow:0 0 0 2px var(--blue)}
.nls-crimp-slot.nls-crimp-sel{border:3px solid var(--blue);outline:3px solid var(--blue);outline-offset:1px;background:color-mix(in srgb,var(--blue) 16%,var(--panel))}
.nls-crimp-slotlab{display:flex;justify-content:space-between;align-items:center;gap:6px;max-width:560px;margin:0 auto 2px;font-size:13px;color:var(--muted)}
.nls-crimp-slotlab>span{white-space:nowrap}
.nls-crimp-zoombtn{display:none;align-items:center;gap:6px}
.nls-crimp-zoombtn svg,.nls-crimp-zclose svg{width:18px;height:18px;flex:none}
.nls-crimp-selbar{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:6px 8px;min-height:56px;padding:6px 8px;border:1px solid var(--line);border-left:5px solid var(--line);border-radius:10px;background:var(--panel);margin:0 0 6px;font-size:14px}
.nls-crimp-selbar.nls-crimp-on{border-color:var(--blue);border-left-color:var(--blue);background:color-mix(in srgb,var(--blue) 9%,var(--panel))}
.nls-crimp-seltext{flex:1 1 200px;min-width:0}
.nls-crimp-selbtns{display:flex;flex-wrap:wrap;gap:6px}
.nls-crimp-seltag{display:inline-block;background:var(--blue);color:var(--bg);border-radius:6px;padding:0 6px;font-weight:700;margin-right:4px}
.nls-crimp-poolhead{margin:4px 0 0;font-weight:600}
.nls-crimp.nls-crimp-zoom{position:fixed;inset:0;z-index:70;max-width:none;margin:0;background:var(--bg);display:flex;flex-direction:column;overflow:hidden}
.nls-crimp-zhead{flex:none;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:calc(6px + env(safe-area-inset-top,0px)) calc(12px + env(safe-area-inset-right,0px)) 6px calc(12px + env(safe-area-inset-left,0px));border-bottom:1px solid var(--line);background:var(--panel)}
.nls-crimp-zoom .nls-crimp-zhead h3{margin:0;font-size:16px;min-width:0}
.nls-crimp-zclose{display:inline-flex;align-items:center;gap:6px;min-height:44px;min-width:44px}
.nls-crimp-zbody{flex:1 1 auto;overflow:auto;overscroll-behavior:contain;width:100%;max-width:1100px;margin:0 auto;padding:8px calc(10px + env(safe-area-inset-right,0px)) calc(14px + env(safe-area-inset-bottom,0px)) calc(10px + env(safe-area-inset-left,0px));display:flex;flex-direction:column;gap:8px}
.nls-crimp-zhint{margin:0;font-size:14px;color:var(--muted);text-align:center}
.nls-crimp-plug{border:2px solid var(--ink);border-radius:14px 14px 26px 26px;background:var(--field);padding:6px 6px 8px}
.nls-crimp-plugend{text-align:center;font-size:12px;color:var(--muted);line-height:1.3;margin-top:4px}
.nls-crimp-zslots{max-width:none;gap:5px}
.nls-crimp-zslots .nls-crimp-slot{min-height:clamp(160px,38vh,320px);padding-top:0}
.nls-crimp-zslots .nls-crimp-slot b{font-size:20px}
.nls-crimp-zslots .nls-crimp-slot svg{width:22px;height:auto}
.nls-crimp-zshort{display:none}
.nls-crimp-ztall svg{width:24px;height:clamp(80px,22vh,150px)}
.nls-crimp-zslots .nls-crimp-slot small{font-size:13px;min-height:32px}
.nls-crimp-contact{display:block;width:62%;height:8px;border-radius:0 0 3px 3px;background:var(--orange);opacity:.85;flex:none}
.nls-crimp-zoom .nls-crimp-pool{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));min-height:0;margin:0}
.nls-crimp-zoom .nls-crimp-wire{width:auto;min-height:52px}
.nls-crimp-zoom .nls-crimp-wv{display:none}
.nls-crimp-zoom .nls-crimp-wh{display:block;width:100%}
.nls-crimp-zoom .nls-crimp-selbar{margin:0}
.nls-crimp-zpoolh{margin:0;font-weight:600;font-size:14px}
html.nls-crimp-noscroll,html.nls-crimp-noscroll body{overflow:hidden}
@media (min-width:600px){.nls-crimp-zoom .nls-crimp-pool{grid-template-columns:repeat(8,minmax(0,1fr))}}
@media (orientation:landscape){.nls-crimp-zrot{display:none}}
@media (max-height:520px){
  .nls-crimp-zhint,.nls-crimp-zpoolh{display:none}
  .nls-crimp-zslots .nls-crimp-slot{min-height:108px}
  .nls-crimp-ztall{display:none}
  .nls-crimp-zshort{display:block}
  .nls-crimp-zshort svg{width:20px;height:44px}
  .nls-crimp-zslots .nls-crimp-slot small{min-height:30px}
  .nls-crimp-plugend{font-size:11px}
  .nls-crimp-zbody{gap:6px;padding-top:6px}
  .nls-crimp-zoom .nls-crimp-selbar{min-height:48px;padding:2px 8px}
  .nls-crimp-zhead{padding-top:calc(2px + env(safe-area-inset-top,0px));padding-bottom:2px}
  .nls-crimp-zslots{padding-top:10px}
}
@media (max-width:900px),(pointer:coarse){.nls-crimp-zoombtn{display:inline-flex}}
.nls-crimp-ghost-wire{position:fixed;z-index:9999;pointer-events:none;transform:translate(-50%,-60%);opacity:.9}
.nls-crimp-ghost-wire svg{width:18px;height:60px;display:block;filter:drop-shadow(0 3px 4px var(--muted))}
.nls-crimp-status{list-style:none;padding:0;margin:8px 0;font-size:15px}
.nls-crimp-status li{padding:2px 0}
.nls-crimp-ok{color:var(--ok)}
.nls-crimp-bad{color:var(--bad)}
.nls-crimp-msg{min-height:1.4em;font-size:15px;margin:6px 0}
.nls-crimp-nav{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-top:12px;border-top:1px solid var(--line);padding-top:10px}
.nls-crimp-contacts{transition:transform .35s ease}
.nls-crimp-jaw{transition:transform .35s ease}
.nls-crimp-pressing .nls-crimp-contacts{transform:translateY(4px)}
.nls-crimp-pressing .nls-crimp-jaw{transform:translateY(20px)}
.nls-crimp-led{transition:fill .15s}
.nls-crimp-table{width:100%;border-collapse:collapse;font-size:14px;margin:8px 0}
.nls-crimp-table th,.nls-crimp-table td{border-bottom:1px solid var(--line);padding:4px 6px;text-align:left;vertical-align:top}
.nls-crimp-table td:first-child,.nls-crimp-table th:first-child{font-family:var(--nls-crimp-mono);white-space:nowrap}
.nls-crimp-tablewrap{overflow-x:auto;max-width:100%}
.nls-crimp-verdict{font-weight:700;font-size:17px;margin:6px 0}
.nls-crimp-score{font-size:22px;font-weight:700}
.nls-crimp-fb{margin:6px 0 0;padding-left:22px}
.nls-crimp-fb li{margin:2px 0}
.nls-crimp-ref{display:grid;grid-template-columns:auto repeat(8,minmax(0,1fr));gap:3px;font-size:11px;align-items:center;margin:8px 0;max-width:520px}
.nls-crimp-ref span{text-align:center}
.nls-crimp-ref svg{width:12px;height:36px;display:block;margin:0 auto}
.nls-crimp-cables{display:flex;flex-wrap:wrap;gap:8px;margin:6px 0 10px}
.nls-crimp-twoplugs{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.nls-crimp-twoplugs .nls-crimp-svgbox{margin:0}
.nls-crimp-twoplugs h4{margin:0 0 2px;font-size:14px;text-align:center}
.nls-crimp-diag{border:1px solid var(--line);border-radius:10px;padding:8px 10px;margin:8px 0}
.nls-crimp-diag legend{font-weight:700;padding:0 4px}
.nls-crimp-diag label{display:inline-flex;align-items:center;gap:4px;margin:2px 10px 2px 0;font-size:15px;min-height:32px}
.nls-crimp-pins{display:flex;flex-wrap:wrap;gap:2px 6px;margin-top:4px}
.nls-crimp-pins label{font-family:var(--nls-crimp-mono)}
.nls-crimp-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.nls-crimp-steps,.nls-crimp-testerpart{scroll-margin-top:72px}
.nls-crimp-verdict,.nls-crimp-score,.nls-crimp-btn{scroll-margin-bottom:calc(var(--nl-bnav,0px) + 12px)}
.nls-crimp-testgo{margin:4px 0 8px}
@media (max-width:760px){
  .nls-crimp-pool{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));min-height:136px;align-content:start}
  .nls-crimp-wire{width:auto;min-height:52px}
  .nls-crimp-wv{display:none}
  .nls-crimp-wh{display:block;width:100%}
  .nls-crimp-pool .nls-crimp-wire,.nls-crimp-slots .nls-crimp-slot.nls-crimp-filled{touch-action:manipulation}
  .nls-crimp-zoom .nls-crimp-pool .nls-crimp-wire,.nls-crimp-zoom .nls-crimp-slots .nls-crimp-slot.nls-crimp-filled{touch-action:none}
  .nls-crimp-wideonly{display:none}
  .nls-crimp-nav .nls-crimp-btn{flex:1 1 auto}
  .nls-crimp-table{font-size:13px}
  .nls-crimp-table th,.nls-crimp-table td{padding:4px 3px}
}
@media (max-width:520px){
  .nls-crimp-card{padding:12px 10px}
  .nls-crimp h2{font-size:20px}
  .nls-crimp-step span{font-size:11px}
  .nls-crimp-slots{gap:2px;margin:0 -7px}
  .nls-crimp-slots.nls-crimp-zslots{gap:3px;margin:0}
  .nls-crimp-twoplugs{grid-template-columns:1fr 1fr}
  .nls-crimp-orient{font-size:13px;padding:6px 8px}
}
@media (pointer:coarse){
  .nls-crimp-btn{min-height:44px;padding:10px 14px}
  .nls-crimp-mbtn{min-height:48px}
  .nls-crimp-howto summary{min-height:44px;display:flex;align-items:center}
  .nls-crimp-range input[type=range]{height:44px}
  .nls-crimp-diag label{min-height:44px}
  .nls-crimp-diag input{width:22px;height:22px}
  .nls-crimp-pins label{min-width:44px}
  .nls-crimp-wire{min-height:52px}
}
@media (prefers-reduced-motion:reduce){
  .nls-crimp-contacts,.nls-crimp-jaw,.nls-crimp-led{transition:none}
}
`;

  /* ---------------- wiring facts (same as server grader) ---------------- */
  const CODES = ['wo', 'o', 'wg', 'bl', 'wb', 'g', 'wbr', 'br'];
  const STD = {
    T568A: ['wg', 'g', 'wo', 'bl', 'wb', 'o', 'wbr', 'br'],
    T568B: ['wo', 'o', 'wg', 'bl', 'wb', 'g', 'wbr', 'br']
  };
  const NAME = { wo: 'ขาวส้ม', o: 'ส้ม', wg: 'ขาวเขียว', g: 'เขียว', bl: 'น้ำเงิน', wb: 'ขาวน้ำเงิน', wbr: 'ขาวน้ำตาล', br: 'น้ำตาล' };
  const FAMILY = { wo: 'o', o: 'o', wg: 'g', g: 'g', bl: 'b', wb: 'b', wbr: 'n', br: 'n' };
  const FAMCOL = { o: 'var(--orange)', g: 'var(--green)', b: 'var(--blue)', n: 'var(--brown)' };
  const FAMTH = { o: 'คู่ส้ม', g: 'คู่เขียว', b: 'คู่น้ำเงิน', n: 'คู่น้ำตาล' };
  const STRIPED = { wo: 1, wg: 1, wb: 1, wbr: 1 };
  const PAIRS = [[0, 1], [2, 5], [3, 4], [6, 7]];
  const CROSS = [2, 5, 0, 3, 4, 1, 6, 7];
  const UNTRIM_SHORT = [6, 7];
  const UNEVEN = [0, -0.5, -1, -0.5, -1.5, -1, -3, -3.5]; // mm offsets of wire tips when not trimmed (pins 7, 8 too short)
  const PLUG = 22, WEDGE = 8, JSTOP = 12, UMAX = 13, UMIN = 10;
  const POOL_START = [['bl', 'wb', 'wo', 'o', 'wbr', 'br', 'wg', 'g'], ['wg', 'g', 'bl', 'wb', 'br', 'wbr', 'o', 'wo']];
  const STEPS = ['มาตรฐาน', 'ปอกสาย', 'เรียงสาย', 'ตัดสาย', 'ใส่หัว', 'ย้ำหัว'];
  const FAULT_TH = { ok: 'ปกติ (straight-through ใช้งานได้)', open: 'วงจรขาด (open)', miswire: 'ต่อสลับขา (miswire)', split: 'สายคู่ถูกแยก (split pair)', reversed: 'เรียงกลับด้าน (reversed)' };
  const DRAFT_KEY = 'nl-sim-crimp-draft';

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const same = (a, b) => a.length === b.length && a.every((c, i) => c === b[i]);
  const pinList = arr => arr.map(i => i + 1).join(', ');

  /* LED tester: ends = { order, trimmed, pushed, crimped, short:[0-based] } */
  function openPinsOf(e) {
    const s = new Set();
    if (!e.pushed || !e.crimped) { for (let i = 0; i < 8; i++) s.add(i); return s; }
    e.order.forEach((c, i) => { if (!c) s.add(i); });
    if (!e.trimmed) UNTRIM_SHORT.forEach(i => s.add(i));
    (e.short || []).forEach(i => s.add(i));
    return s;
  }
  function testCable(e1, e2) {
    const o1 = openPinsOf(e1), o2 = openPinsOf(e2);
    const map = [];
    for (let i = 0; i < 8; i++) {
      const c = e1.order[i];
      if (!c || o1.has(i)) { map.push(-1); continue; }
      const j = e2.order.indexOf(c);
      map.push(j < 0 || o2.has(j) ? -1 : j);
    }
    const open = [], wrong = [];
    map.forEach((j, i) => { if (j < 0) open.push(i); });
    let verdict;
    if (open.length) verdict = 'open';
    else if (map.every((j, i) => j === i)) verdict = 'straight';
    else if (map.every((j, i) => j === CROSS[i])) verdict = 'crossover';
    else if (map.every((j, i) => j === 7 - i)) verdict = 'reversed';
    else verdict = 'miswire';
    let ref = null;
    if (verdict === 'miswire' || verdict === 'open') {
      const ds = map.filter((j, i) => j >= 0 && j !== i).length, dc = map.filter((j, i) => j >= 0 && j !== CROSS[i]).length;
      ref = dc < ds ? CROSS : null;
      map.forEach((j, i) => { if (j >= 0 && j !== (ref ? ref[i] : i)) wrong.push(i); });
    }
    const split = [];
    if (verdict === 'straight' || verdict === 'crossover') {
      for (const e of [e1, e2]) for (const [a, b] of PAIRS) {
        if (FAMILY[e.order[a]] !== FAMILY[e.order[b]]) { if (!split.includes(a)) split.push(a); if (!split.includes(b)) split.push(b); }
      }
      split.sort((a, b) => a - b);
    }
    return { map, open, wrong, verdict, split, o1, o2, expected: verdict === 'crossover' || ref ? CROSS : null };
  }

  /* ---------------- SVG helpers ---------------- */
  // vertical wire segment from y1 (top) to y2 (bottom)
  function wireV(code, x, y1, y2, w) {
    if (!code || y2 <= y1) return '';
    const col = FAMCOL[FAMILY[code]];
    let s = `<rect x="${x}" y="${y1}" width="${w}" height="${y2 - y1}" rx="${w / 2.5}" fill="${STRIPED[code] ? 'var(--wo)' : col}"/>`;
    if (STRIPED[code]) for (let y = y1 + 2; y < y2 - 1; y += 9) s += `<rect x="${x}" y="${y}" width="${w}" height="${Math.min(4, y2 - y)}" fill="${col}"/>`;
    s += `<rect x="${x}" y="${y1}" width="${w}" height="${y2 - y1}" rx="${w / 2.5}" fill="none" stroke="var(--muted)" stroke-opacity=".55" stroke-width=".7"/>`;
    return s;
  }
  const wireIcon = (code, w, h) => `<svg viewBox="0 0 ${w} ${h}" aria-hidden="true" focusable="false">${wireV(code, 2, 1, h - 1, w - 4)}</svg>`;
  // horizontal wire swatch (phone pool): white base with coloured bands for striped wires
  function wireIconH(code) {
    const w = 64, h = 14, col = FAMCOL[FAMILY[code]];
    let s = `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true" focusable="false"><rect x="1" y="2" width="${w - 2}" height="${h - 4}" rx="4" fill="${STRIPED[code] ? 'var(--wo)' : col}"/>`;
    if (STRIPED[code]) for (let x = 4; x < w - 4; x += 10) s += `<rect x="${x}" y="2" width="5" height="${h - 4}" fill="${col}"/>`;
    return s + `<rect x="1" y="2" width="${w - 2}" height="${h - 4}" rx="4" fill="none" stroke="var(--muted)" stroke-opacity=".6" stroke-width=".8"/></svg>`;
  }
  // colour name on two lines for striped wires (ขาว / ส้ม) so it fits a narrow slot
  const NAME_TOK = { wo: ['ขาว', 'ส้ม'], o: ['ส้ม'], wg: ['ขาว', 'เขียว'], g: ['เขียว'], bl: ['น้ำ', 'เงิน'], wb: ['ขาว', 'น้ำ', 'เงิน'], wbr: ['ขาว', 'น้ำ', 'ตาล'], br: ['น้ำ', 'ตาล'] };
  const nameHTML = c => NAME_TOK[c].map(t => `<span>${t}</span>`).join('');
  const ICON_ZOOM = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21M10.5 7.5v6M7.5 10.5h6"/></svg>';
  const ICON_CLOSE = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';

  // strip view: cable lying horizontally, jacket on the left, twisted pairs exposed on the right
  function stripSVG(strip) {
    const S = 6, x0 = 40, ex = Math.max(0, strip) * S, jx = 330 - ex;
    let s = `<svg class="nls-crimp-svg nls-crimp-wide" viewBox="0 0 340 150" role="img" aria-label="สาย UTP ปอกเปลือกออก ${strip} มิลลิเมตร">`;
    s += `<rect x="0" y="22" width="${jx}" height="74" rx="8" fill="var(--line)" stroke="var(--muted)"/>`;
    s += `<text x="${Math.max(6, jx / 2 - 30)}" y="64" font-size="11">เปลือกนอก</text>`;
    const fams = ['o', 'g', 'b', 'n'], ys = [34, 50, 66, 82];
    fams.forEach((f, k) => {
      if (ex <= 0) return;
      let d1 = `M${jx} ${ys[k]}`, d2 = `M${jx} ${ys[k]}`;
      for (let x = 0; x <= ex; x += 4) {
        const ph = x / 9 + k;
        d1 += ` L${jx + x} ${(ys[k] + Math.sin(ph) * 4).toFixed(1)}`;
        d2 += ` L${jx + x} ${(ys[k] - Math.sin(ph) * 4).toFixed(1)}`;
      }
      s += `<path d="${d1}" fill="none" stroke="${FAMCOL[f]}" stroke-width="4" stroke-linecap="round"/>`;
      s += `<path d="${d2}" fill="none" stroke="var(--wo)" stroke-width="4" stroke-linecap="round"/>`;
      s += `<path d="${d2}" fill="none" stroke="${FAMCOL[f]}" stroke-width="4" stroke-dasharray="3 6"/>`;
    });
    // ruler from the jacket edge
    s += `<line x1="${jx}" y1="112" x2="${jx + 50 * S > 340 ? 340 : jx + 50 * S}" y2="112" stroke="var(--muted)"/>`;
    for (let mm = 0; mm <= strip; mm++) {
      const x = jx + mm * S, big = mm % 10 === 0, mid = mm % 5 === 0;
      s += `<line x1="${x}" y1="112" x2="${x}" y2="${big ? 124 : mid ? 120 : 116}" stroke="var(--muted)"/>`;
      if (big) s += `<text x="${x}" y="137" font-size="10" text-anchor="middle">${mm}</text>`;
    }
    s += `<text x="${jx}" y="12" font-size="11" fill="var(--ink)">◀ ปอก ${strip} มม. ▶</text>`;
    s += `<text x="336" y="148" font-size="9" text-anchor="end" fill="var(--muted)">มม.</text>`;
    void x0;
    return s + '</svg>';
  }

  // trim view: top view of the arranged wires standing up from the jacket; dashed cut line
  function trimSVG(e) {
    const S = 4.4, base = 262, X0 = 66, CW = 15;
    const L = e.cut ? e.untwist : e.strip;
    let s = `<svg class="nls-crimp-svg" viewBox="0 0 240 300" role="img" aria-label="สายที่เรียงแล้ว ยาว ${L} มม. จากขอบเปลือกนอก">`;
    s += `<rect x="${X0 - 8}" y="${base}" width="${8 * CW + 12}" height="40" rx="6" fill="var(--line)" stroke="var(--muted)"/>`;
    s += `<text x="${X0 + 4 * CW - 2}" y="${base + 24}" font-size="11" text-anchor="middle">เปลือกนอก</text>`;
    // ok zone 10-13 mm
    s += `<rect x="${X0 - 8}" y="${base - UMAX * S}" width="${8 * CW + 12}" height="${(UMAX - UMIN) * S}" fill="var(--ok)" opacity=".12"/>`;
    for (let i = 0; i < 8; i++) {
      const c = e.order[i];
      const len = e.cut ? e.untwist : e.strip + UNEVEN[i];
      if (c) s += wireV(c, X0 + i * CW, base - len * S, base, 10);
      else s += `<rect x="${X0 + i * CW}" y="${base - 20}" width="10" height="20" fill="none" stroke="var(--bad)" stroke-dasharray="2 2"/>`;
      s += `<text x="${X0 + i * CW + 5}" y="${Math.max(10, base - Math.max(len, 4) * S - 4)}" font-size="9" text-anchor="middle">${i + 1}</text>`;
    }
    // ruler
    const rx = 34;
    s += `<line x1="${rx}" y1="${base}" x2="${rx}" y2="${base - 50 * S}" stroke="var(--muted)"/>`;
    for (let mm = 0; mm <= 50; mm++) {
      const y = base - mm * S, big = mm % 10 === 0, mid = mm % 5 === 0;
      if (y < 4) break;
      s += `<line x1="${rx}" y1="${y}" x2="${rx - (big ? 10 : mid ? 7 : 4)}" y2="${y}" stroke="var(--muted)"/>`;
      if (mid) s += `<text x="${rx - 12}" y="${y + 3}" font-size="9" text-anchor="end">${mm}</text>`;
    }
    s += `<text x="${rx - 26}" y="${base + 14}" font-size="9" fill="var(--muted)">มม.</text>`;
    if (!e.cut) {
      const y = base - e.untwist * S;
      s += `<line x1="${X0 - 14}" y1="${y}" x2="${X0 + 8 * CW + 10}" y2="${y}" stroke="var(--bad)" stroke-width="2" stroke-dasharray="6 4"/>`;
      s += `<text x="${X0 + 8 * CW + 12}" y="${y + 4}" font-size="10" fill="var(--bad)">✂ ${e.untwist}</text>`;
    }
    s += `<text x="${X0 + 8 * CW + 12}" y="${base - UMAX * S + 4}" font-size="9" fill="var(--ok)">13</text>`;
    return s + '</svg>';
  }

  // plug view: top view, contacts up, clip down, pin 1 on the left. depth = how far the wire tips are inside (mm)
  function plugSVG(e, opts) {
    opts = opts || {};
    const S = 8, front = 34, rear = front + PLUG * S, X0 = 50, CW = 15;
    const L = e.cut ? e.untwist : e.strip;
    const depth = e.depth;
    const jEdge = depth - L;
    const yJ = rear - jEdge * S;
    const pressed = e.crimped;
    let s = `<svg class="nls-crimp-svg" viewBox="0 0 230 ${opts.compact ? 300 : 360}" role="img" aria-label="${esc(opts.label || 'หัว RJ-45 มองจากด้านบน ขา 1 อยู่ซ้าย')}">`;
    // plug body (clear plastic)
    s += `<rect x="${X0 - 14}" y="${front - 6}" width="${8 * CW + 22}" height="${PLUG * S + 6}" rx="8" fill="var(--panel)" opacity=".85"/>`;
    // strain relief zone
    s += `<rect x="${X0 - 14}" y="${rear - JSTOP * S}" width="${8 * CW + 22}" height="${(JSTOP - WEDGE) * S}" fill="var(--muted)" opacity=".18"/>`;
    // jacket
    const jBot = opts.compact ? 300 : 330, jTop = Math.min(yJ, jBot - 6);
    s += `<rect x="${X0 - 6}" y="${jTop}" width="${8 * CW + 6}" height="${Math.max(0, jBot - jTop)}" rx="5" fill="var(--line)" fill-opacity=".8" stroke="var(--muted)"/>`;
    // wires
    for (let i = 0; i < 8; i++) {
      const c = e.order[i];
      if (!c) continue;
      let tip = depth + (e.cut ? 0 : UNEVEN[i]) - ((e.short || []).includes(i) ? 3 : 0);
      const yT = rear - tip * S;
      s += wireV(c, X0 + i * CW, Math.max(front, yT), Math.min(yJ, jBot), 10);
    }
    // contacts (gold) + jaw
    s += `<g class="nls-crimp-contacts" style="${pressed ? 'transform:translateY(4px)' : ''}">`;
    for (let i = 0; i < 8; i++) s += `<rect x="${X0 + i * CW + 1}" y="${front - 2}" width="8" height="${2.2 * S}" rx="1" fill="var(--orange)" opacity=".75" stroke="var(--brown)" stroke-width=".6"/>`;
    s += '</g>';
    for (let i = 0; i < 8; i++) s += `<text x="${X0 + i * CW + 5}" y="${front - 12}" font-size="10" text-anchor="middle" font-weight="600">${i + 1}</text>`;
    // wedge marker
    s += `<line x1="${X0 - 14}" y1="${rear - WEDGE * S}" x2="${X0 + 8 * CW + 8}" y2="${rear - WEDGE * S}" stroke="var(--muted)" stroke-width="2" stroke-dasharray="${pressed ? '0' : '4 3'}"/>`;
    s += `<text x="${X0 + 8 * CW + 10}" y="${rear - 9.5 * S}" font-size="9" fill="var(--muted)">ตัวล็อก</text><text x="${X0 + 8 * CW + 10}" y="${rear - 9.5 * S + 11}" font-size="9" fill="var(--muted)">สาย</text>`;
    // outline on top
    s += `<rect x="${X0 - 14}" y="${front - 6}" width="${8 * CW + 22}" height="${PLUG * S + 6}" rx="8" fill="none" stroke="var(--ink)" stroke-width="1.6"/>`;
    s += `<text x="${X0 - 18}" y="${front + 6}" font-size="9" text-anchor="end" fill="var(--muted)">ด้านหน้า</text>`;
    s += `<text x="${X0 - 18}" y="${rear}" font-size="9" text-anchor="end" fill="var(--muted)">ท้ายหัว</text>`;
    if (!opts.compact) {
      s += `<g class="nls-crimp-jaw" style="${opts.pressing ? 'transform:translateY(20px)' : ''}"><rect x="${X0 - 4}" y="0" width="${8 * CW}" height="10" rx="3" fill="var(--muted)" opacity="${opts.showJaw ? '.8' : '0'}"/></g>`;
      s += `<text x="115" y="350" font-size="10" text-anchor="middle" fill="var(--muted)">หน้าสัมผัสหงายขึ้น · clip คว่ำลง · ขา 1 อยู่ซ้าย</text>`;
    }
    return s + '</svg>';
  }

  // LAN tester drawing
  function testerSVG(map, step, mode) {
    let s = `<svg class="nls-crimp-svg nls-crimp-wide" viewBox="0 0 340 186" role="img" aria-label="เครื่องทดสอบสาย LAN สองชิ้น ไฟ LED 1 ถึง 8">`;
    const unit = (x, title) => {
      let u = `<rect x="${x}" y="20" width="155" height="104" rx="12" fill="var(--panel)" stroke="var(--ink)" stroke-width="1.5"/>`;
      u += `<text x="${x + 77}" y="40" font-size="11" text-anchor="middle" font-weight="600">${title}</text>`;
      u += `<rect x="${x + 57}" y="124" width="40" height="16" rx="2" fill="var(--line)" stroke="var(--muted)"/>`;
      return u;
    };
    s += unit(6, 'เครื่องหลัก (MAIN)') + unit(179, 'ปลายทาง (REMOTE)');
    const lit = new Set();
    const all = step > 8;
    for (let i = 0; i < 8; i++) if ((all || i === step - 1) && map[i] >= 0) lit.add(map[i]);
    for (let i = 0; i < 8; i++) {
      const xm = 6 + 15 + i * 17.5, xr = 179 + 15 + i * 17.5;
      s += `<circle class="nls-crimp-led" cx="${xm}" cy="72" r="6.5" fill="${all || step - 1 === i ? 'var(--ok)' : 'var(--field)'}" stroke="var(--muted)"/>`;
      s += `<text x="${xm}" y="98" font-size="13" font-weight="700" text-anchor="middle">${i + 1}</text>`;
      s += `<circle class="nls-crimp-led" cx="${xr}" cy="72" r="6.5" fill="${lit.has(i) ? 'var(--ok)' : 'var(--field)'}" stroke="var(--muted)"/>`;
      s += `<text x="${xr}" y="98" font-size="13" font-weight="700" text-anchor="middle">${i + 1}</text>`;
    }
    s += `<path d="M83 140 C 83 165, 256 165, 256 140" fill="none" stroke="var(--line)" stroke-width="5"/>`;
    s += `<text x="170" y="12" font-size="10" text-anchor="middle" fill="var(--muted)">${mode === 'advanced' ? 'เครื่องทดสอบขั้นสูง (cable certifier)' : 'เครื่องทดสอบสาย LAN แบบพื้นฐาน'}</text>`;
    if (step > 8) s += `<text x="170" y="181" font-size="10" text-anchor="middle" fill="var(--muted)">สรุป: ไฟที่ติดทั้งหมดหลังไล่ครบ 8 ขา</text>`;
    if (step > 0 && step <= 8) s += `<text x="170" y="181" font-size="10" text-anchor="middle" fill="var(--muted)">ขา ${step} → ${map[step - 1] >= 0 ? map[step - 1] + 1 : 'ไม่มีไฟ'}</text>`;
    return s + '</svg>';
  }

  function newEnd(k) {
    return { std: null, strip: 25, stripped: false, order: [null, null, null, null, null, null, null, null], pool: POOL_START[k || 0].slice(),
      untwist: 13, cut: false, depth: 0, crimped: false, step: 0 };
  }
  const effL = e => e.cut ? e.untwist : e.strip;
  const maxDepth = e => Math.min(PLUG, effL(e) + JSTOP);
  const endTest = e => ({ order: e.order, trimmed: e.cut, pushed: e.depth >= PLUG, crimped: e.crimped, short: e.short || [] });
  const jacketOk = e => e.depth - effL(e) >= WEDGE;

  /* ---------------- mount ---------------- */
  function mount(root, ctx) {
    if (!document.getElementById('nls-crimp-css')) {
      const st = document.createElement('style'); st.id = 'nls-crimp-css'; st.textContent = CSS; document.head.appendChild(st);
    }
    ctx = ctx || {};
    const missions = Array.isArray(ctx.missions) ? ctx.missions : [];
    const best = {};
    Object.keys(ctx.done || {}).forEach(k => { best[k] = Object.assign({}, ctx.done[k]); });
    const reduce = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    const timers = new Set();
    const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); fn(); }, ms); timers.add(t); return t; };
    const clearTimers = () => { timers.forEach(t => clearTimeout(t)); timers.clear(); };

    let S = freshState(missions[0] ? missions[0].id : null);
    try {
      const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
      if (d && d.v === 1 && Array.isArray(d.ends) && d.ends.length === 2 && (d.mid === null || missions.some(m => m.id === d.mid))) {
        S.mid = d.mid; S.free = !!d.free; S.ends = d.ends.map((e, k) => sanitizeEnd(e, k)); S.cur = d.cur === 1 ? 1 : 0;
        if (d.diag && typeof d.diag === 'object') S.diag = d.diag;
      }
    } catch (err) { /* ignore broken drafts */ }

    function freshState(mid) {
      return { mid, free: !mid, ends: [newEnd(0), newEnd(1)], cur: 0, sel: null, tst: null, tested: null, result: null, msg: '',
        hintsShown: 0, diag: {}, cable: null, busy: false, crimping: false, showRef: false, zoom: false };
    }
    function sanitizeEnd(e, k) {
      const n = newEnd(k);
      if (!e || typeof e !== 'object') return n;
      n.std = e.std === 'T568A' || e.std === 'T568B' ? e.std : null;
      const num = (v, lo, hi, d) => { v = Number(v); return isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : d; };
      n.strip = num(e.strip, 5, 50, 25); n.stripped = !!e.stripped; n.untwist = num(e.untwist, 5, 50, 13); n.cut = !!e.cut;
      n.depth = num(e.depth, 0, PLUG, 0); n.crimped = !!e.crimped; n.step = num(e.step, 0, 5, 0);
      if (Array.isArray(e.order) && e.order.length === 8 && Array.isArray(e.pool)) {
        const all = e.order.filter(Boolean).concat(e.pool);
        if (all.length === 8 && CODES.every(c => all.includes(c))) { n.order = e.order.map(c => c || null); n.pool = e.pool.slice(); }
      }
      return n;
    }
    function saveDraft() {
      try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ v: 1, mid: S.free ? null : S.mid, free: S.free, ends: S.ends, cur: S.cur, diag: S.diag })); } catch (err) { /* ignore */ }
    }

    const mission = () => S.free ? null : missions.find(m => m.id === S.mid) || null;
    const isDiag = () => { const m = mission(); return !!(m && m.start && m.start.kind === 'diagnose'); };
    const E = () => S.ends[S.cur];
    const invalidate = () => { S.tst = null; S.tested = null; S.result = null; clearTimers(); S.busy = false; };

    /* ---------- rendering ---------- */
    function render() {
      const fk = document.activeElement && root.contains(document.activeElement) ? document.activeElement.getAttribute('data-fk') : null;
      if (S.zoom && !zoomOpen()) S.zoom = false;
      const z = zoomOpen();
      const zb = root.querySelector('[data-part="zbody"]'), zTop = zb ? zb.scrollTop : 0;
      root.innerHTML = `<div class="nls-crimp"${z ? ' inert aria-hidden="true"' : ''}>${head()}${missionList()}${brief()}${isDiag() ? diagView() : buildView()}${testerCard()}${submitCard()}</div>${z ? zoomView() : ''}`;
      document.documentElement.classList.toggle('nls-crimp-noscroll', z);
      if (z && zTop) { const nb = root.querySelector('[data-part="zbody"]'); if (nb) nb.scrollTop = zTop; }
      if (fk) { const el = root.querySelector(`[data-fk="${fk}"]`); if (el && !el.disabled) el.focus({ preventScroll: true }); }
      saveDraft();
    }

    function head() {
      return `<div class="nls-crimp-card"><h2>จำลองการเข้าหัวสาย UTP (RJ-45)</h2>
<p class="nls-crimp-muted">ฝึกเข้าหัวสาย LAN ตามขั้นตอนจริง แล้วตรวจด้วยเครื่องทดสอบ ผลการทดสอบคำนวณจากการเรียงสายจริงของทั้งสองปลาย</p>
<details class="nls-crimp-howto"><summary>คำแนะนำการใช้งาน</summary><ol>
<li>เลือกภารกิจ หรือ "ฝึกอิสระ" แล้วทำ <b>ปลายที่ 1</b> และ <b>ปลายที่ 2</b> ทีละขั้น: เลือกมาตรฐาน → ปอกสาย → เรียงสาย → ตัดสาย → ใส่หัว → ย้ำหัว</li>
<li>เรียงสาย: <b>แตะ/กด Enter ที่สาย แล้วแตะช่อง</b> ขา 1–8 ที่ต้องการ หรือ<b>ลาก</b>สายลงช่อง (บนมือถือให้แตะค้างแล้วลาก) แตะสายในช่องแล้วแตะช่องอื่นเพื่อย้าย/สลับ แตะของเดิมซ้ำหรือกด "ยกเลิกการเลือก" เพื่อยกเลิก บนมือถือกด "ขยายหัว RJ-45" เพื่อดูช่องขนาดใหญ่</li>
<li>ภาพหัว RJ-45 มองจากด้านบน: หน้าสัมผัสทองแดงหงายขึ้น ตัวล็อก (clip) คว่ำลง ปลายหัวชี้ขึ้น ขา 1 อยู่ซ้ายสุด</li>
<li>ย้ำหัวครบสองปลายแล้วกด "ทดสอบ" ดูไฟ LED ทั้งสองเครื่อง จากนั้นกด "ตรวจคำตอบ / ส่งงาน"</li>
<li>ปุ่ม "เริ่มใหม่" ล้างงานของภารกิจนี้ ปุ่ม "ตัดหัวทิ้ง" ทำปลายนั้นใหม่</li></ol></details></div>`;
    }

    function missionList() {
      let s = '<nav class="nls-crimp-missions" aria-label="รายการภารกิจ">';
      for (const m of missions) {
        const b = best[m.id];
        const st = b && b.attempts !== 0 && b.best != null ? `<span class="nls-crimp-best">คะแนนดีที่สุด ${b.best}/${b.max || m.max}</span>` : '<span>ยังไม่ทำ</span>';
        s += `<button type="button" class="nls-crimp-mbtn${!S.free && S.mid === m.id ? ' nls-crimp-on' : ''}" data-act="mission" data-id="${esc(m.id)}" data-fk="m-${esc(m.id)}" aria-current="${!S.free && S.mid === m.id ? 'true' : 'false'}">
<span class="nls-crimp-lvl">${esc(m.id)} · ${m.level === 'easy' ? 'ง่าย' : m.level === 'medium' ? 'ปานกลาง' : 'ยาก'}</span><b>${esc(m.title)}</b>${st}</button>`;
      }
      s += `<button type="button" class="nls-crimp-mbtn${S.free ? ' nls-crimp-on' : ''}" data-act="free" data-fk="m-free"><span class="nls-crimp-lvl">free</span><b>ฝึกอิสระ</b><span>ทดลองทำสายแบบใดก็ได้</span></button>`;
      return s + '</nav>';
    }

    function brief() {
      const m = mission();
      if (!m) {
        return `<section class="nls-crimp-card"><h3>ฝึกอิสระ</h3><p>เลือกมาตรฐานของแต่ละปลายได้ตามต้องการ ลองทำทั้งสายตรง สายไขว้ หรือทำผิดโดยตั้งใจแล้วดูผลที่เครื่องทดสอบ</p>
<div class="nls-crimp-row"><button type="button" class="nls-crimp-btn nls-crimp-ghost" data-act="ref" data-fk="ref" aria-expanded="${S.showRef}">${S.showRef ? 'ซ่อน' : 'แสดง'}ตารางสีอ้างอิง</button>
<button type="button" class="nls-crimp-btn nls-crimp-ghost" data-act="reset-all" data-fk="reset-all">เริ่มใหม่ทั้งหมด</button></div>${S.showRef ? refTable() : ''}</section>`;
      }
      const hints = (m.hints || []).slice(0, S.hintsShown);
      const rules = m.start && m.start.rules ? `<p><b>กฎห้องแล็บ</b></p><ol class="nls-crimp-rules">${m.start.rules.map(r => `<li>${esc(r)}</li>`).join('')}</ol>` : '';
      return `<section class="nls-crimp-card"><h3>${esc(m.id)}: ${esc(m.title)}</h3><p>${esc(m.desc)}</p>${rules}
<div class="nls-crimp-row"><button type="button" class="nls-crimp-btn nls-crimp-ghost" data-act="hint" data-fk="hint" ${S.hintsShown >= (m.hints || []).length ? 'disabled' : ''}>คำใบ้ (${S.hintsShown}/${(m.hints || []).length})</button>
<button type="button" class="nls-crimp-btn nls-crimp-ghost" data-act="reset-all" data-fk="reset-all">เริ่มใหม่</button></div>
${hints.length ? `<ol class="nls-crimp-hints">${hints.map(h => `<li>${esc(h)}</li>`).join('')}</ol>` : ''}</section>`;
    }

    function refTable() {
      let s = '<div class="nls-crimp-ref" aria-label="ตารางสีมาตรฐาน"><span></span>';
      for (let i = 1; i <= 8; i++) s += `<span><b>${i}</b></span>`;
      for (const k of ['T568A', 'T568B']) {
        s += `<span><b>${k}</b></span>`;
        STD[k].forEach(c => { s += `<span title="${NAME[c]}">${wireIcon(c, 12, 36)}${NAME[c]}</span>`; });
      }
      return s + '</div>';
    }

    function stepDone(e, k) {
      return [!!e.std, e.stripped, e.order.every(Boolean), e.cut, e.depth >= PLUG && jacketOk(e), e.crimped][k];
    }
    function stepAllowed(e, k) {
      if (e.crimped && k < 5) return false;
      if (k === 0) return true;
      if (k === 1) return !!e.std;
      if (k <= 4) return !!e.std && e.stripped;
      return !!e.std && e.stripped && e.depth > 0;
    }

    function buildView() {
      const e = E();
      let s = '<section class="nls-crimp-card" aria-label="ทำสาย">';
      s += '<div class="nls-crimp-ends" role="group" aria-label="เลือกปลายสาย">';
      S.ends.forEach((x, k) => {
        s += `<button type="button" class="nls-crimp-btn nls-crimp-ghost" data-act="end" data-i="${k}" data-fk="end-${k}" aria-pressed="${S.cur === k}">ปลายที่ ${k + 1}${x.crimped ? ' ✓ ย้ำแล้ว' : ''}${x.std ? ' · ' + x.std : ''}</button>`;
      });
      s += '</div><ol class="nls-crimp-steps" aria-label="ขั้นตอน">';
      STEPS.forEach((t, k) => {
        s += `<li><button type="button" class="nls-crimp-step${e.step === k ? ' nls-crimp-cur' : ''}${stepDone(e, k) ? ' nls-crimp-done' : ''}" data-act="step" data-s="${k}" data-fk="step-${k}" ${stepAllowed(e, k) ? '' : 'disabled'} aria-current="${e.step === k ? 'step' : 'false'}"><b>${stepDone(e, k) ? '✓' : k + 1}</b><span>${t}</span></button></li>`;
      });
      s += '</ol>';
      s += `<div data-part="step">${stepBody(e)}</div>`;
      s += `<p class="nls-crimp-msg" role="status" aria-live="polite">${esc(S.msg)}</p>`;
      const nextOk = e.step < 5 && stepAllowed(e, e.step + 1);
      s += `<div class="nls-crimp-nav"><button type="button" class="nls-crimp-btn nls-crimp-ghost" data-act="prev" data-fk="prev" ${e.step > 0 && stepAllowed(e, e.step - 1) ? '' : 'disabled'}>← ย้อนกลับ</button>`;
      if (e.crimped) s += `<button type="button" class="nls-crimp-btn nls-crimp-ghost" data-act="reset-end" data-fk="reset-end">✂ ตัดหัวทิ้ง ทำปลายนี้ใหม่</button>`;
      if (e.step < 5) s += `<button type="button" class="nls-crimp-btn" data-act="next" data-fk="next" ${nextOk ? '' : 'disabled'}>ถัดไป →</button>`;
      else if (e.crimped && !S.ends[1 - S.cur].crimped) s += `<button type="button" class="nls-crimp-btn" data-act="end" data-i="${1 - S.cur}" data-fk="goto-other">ไปทำปลายที่ ${2 - S.cur} →</button>`;
      s += '</div></section>';
      return s;
    }

    function stepBody(e) {
      const k = e.step;
      const lock = e.crimped && k < 5 ? '<p class="nls-crimp-muted">ปลายนี้ย้ำหัวแล้ว แก้ไขไม่ได้ ถ้าผิดต้อง "ตัดหัวทิ้ง" แล้วทำใหม่</p>' : '';
      if (k === 0) {
        const m = mission();
        return `<h3>1. เลือกมาตรฐานของปลายที่ ${S.cur + 1}</h3>${lock}
<p class="nls-crimp-muted">${m && m.start && m.start.target === 'crossover' ? 'สายไขว้: ปลายหนึ่งใช้ T568A อีกปลายใช้ T568B' : 'สายตรง: ใช้มาตรฐานเดียวกันทั้งสองปลาย'}</p>
<div class="nls-crimp-row" role="group" aria-label="มาตรฐาน">${['T568A', 'T568B'].map(v => `<button type="button" class="nls-crimp-btn nls-crimp-ghost" data-act="std" data-v="${v}" data-fk="std-${v}" aria-pressed="${e.std === v}" ${e.crimped ? 'disabled' : ''}>${v}</button>`).join('')}</div>`;
      }
      if (k === 1) {
        return `<h3>2. ปอกเปลือกนอก</h3>${lock}<p class="nls-crimp-muted">ปอกให้ยาวพอจะคลายเกลียวและเรียงสายได้สะดวก (แนะนำ 20–30 มม.) ระวังอย่าให้คมมีดบาดฉนวนสายด้านใน</p>
<div class="nls-crimp-range"><label for="nls-crimp-strip-${S.cur}">ความยาวที่ปอก</label><input id="nls-crimp-strip-${S.cur}" type="range" min="5" max="50" step="1" value="${e.strip}" data-in="strip" data-fk="in-strip" ${e.crimped ? 'disabled' : ''}><output data-out="strip">${e.strip} มม.</output></div>
<div class="nls-crimp-svgbox" data-part="vis">${stripSVG(e.strip)}</div>
<div class="nls-crimp-row"><button type="button" class="nls-crimp-btn" data-act="strip" data-fk="act-strip" ${e.crimped ? 'disabled' : ''}>ปอกสาย</button><span data-out="stripmsg" class="nls-crimp-muted">${e.stripped ? 'ปอกแล้ว ' + e.strip + ' มม.' : ''}</span></div>`;
      }
      if (k === 2) return arrangeBody(e, lock);
      if (k === 3) {
        return `<h3>4. ตัดปลายสายให้เสมอกัน</h3>${lock}<p class="nls-crimp-muted">เลื่อนเส้นตัด (✂) เพื่อกำหนดความยาวส่วนที่คลายเกลียวนับจากขอบเปลือกนอก มาตรฐานกำหนดไม่เกิน 13 มม. (ครึ่งนิ้ว) แถบสีเขียวคือช่วง 10–13 มม.</p>
<div class="nls-crimp-range"><label for="nls-crimp-ut-${S.cur}">ความยาวหลังตัด</label><input id="nls-crimp-ut-${S.cur}" type="range" min="5" max="${Math.max(5, e.strip)}" step="1" value="${Math.min(e.untwist, e.strip)}" data-in="untwist" data-fk="in-untwist" ${e.cut || e.crimped ? 'disabled' : ''}><output data-out="untwist">${Math.min(e.untwist, e.strip)} มม.</output></div>
<div class="nls-crimp-svgbox" data-part="vis">${trimSVG(e)}</div>
<div class="nls-crimp-row"><button type="button" class="nls-crimp-btn" data-act="cut" data-fk="act-cut" ${e.cut || e.crimped ? 'disabled' : ''}>✂ ตัดสาย</button>
${e.cut && !e.crimped ? '<button type="button" class="nls-crimp-btn nls-crimp-ghost" data-act="uncut" data-fk="act-uncut">ตัดใหม่ (ตัดให้สั้นลงได้เท่านั้น)</button>' : ''}</div>
<p class="nls-crimp-muted" data-out="trimmsg">${e.cut ? `ตัดแล้ว เหลือส่วนที่คลายเกลียว ${e.untwist} มม. ${e.untwist > UMAX ? '— ยาวเกิน 13 มม.!' : e.untwist < UMIN ? '— สั้นเกินไป สายอาจไม่ถึงหน้าสัมผัส' : '✓'}` : 'ยังไม่ได้ตัด: ปลายสายยาวไม่เท่ากัน'}</p>`;
      }
      if (k === 4) {
        const md = maxDepth(e);
        return `<h3>5. ใส่สายเข้าหัว RJ-45</h3>${lock}<p class="nls-crimp-muted">ถือหัวให้หน้าสัมผัสหงายขึ้น ตัวล็อก (clip) คว่ำลง แล้วดันสายเข้าไปจนปลายทองแดงทุกเส้นชนด้านหน้า เปลือกนอกต้องเลยแนวตัวล็อกสาย (เส้นประ) เข้าไป</p>
<div class="nls-crimp-range"><label for="nls-crimp-dp-${S.cur}">ดันสายเข้าหัว</label><input id="nls-crimp-dp-${S.cur}" type="range" min="0" max="${md}" step="1" value="${Math.min(e.depth, md)}" data-in="depth" data-fk="in-depth" ${e.crimped ? 'disabled' : ''}><output data-out="depth">${e.depth} มม.</output></div>
<div class="nls-crimp-row"><button type="button" class="nls-crimp-btn" data-act="push" data-fk="act-push" ${e.crimped ? 'disabled' : ''}>ดันสายจนสุด</button><button type="button" class="nls-crimp-btn nls-crimp-ghost" data-act="pull" data-fk="act-pull" ${e.crimped ? 'disabled' : ''}>ดึงสายออก</button></div>
<div class="nls-crimp-svgbox" data-part="vis">${plugSVG(e)}</div><ul class="nls-crimp-status" data-out="insert">${insertStatus(e)}</ul>`;
      }
      // crimp
      return `<h3>6. ย้ำหัว (crimp)</h3><p class="nls-crimp-muted">ใส่หัวในคีมย้ำแล้วบีบจนสุด หน้าสัมผัสทองแดงจะกดทะลุฉนวนลงบนสาย และตัวล็อกสายจะกดเปลือกนอกไว้ ย้ำแล้วแก้ไขไม่ได้</p>
<div class="nls-crimp-svgbox" data-part="vis">${plugSVG(e, { showJaw: !e.crimped })}</div><ul class="nls-crimp-status">${insertStatus(e)}</ul>
<div class="nls-crimp-row"><button type="button" class="nls-crimp-btn" data-act="crimp" data-fk="act-crimp" ${e.crimped || S.crimping ? 'disabled' : ''}>${e.crimped ? '✓ ย้ำหัวแล้ว' : 'บีบคีมย้ำหัว'}</button></div>`;
    }

    function insertStatus(e) {
      const L = effL(e);
      const items = [];
      const reach = e.depth >= PLUG;
      items.push([reach, reach ? 'ปลายสายชนด้านหน้าของหัว ถึงหน้าสัมผัสทองแดง' : (maxDepth(e) < PLUG ? `ดันไม่สุด: สายสั้นเกินไป (${L} มม.) เปลือกนอกชนช่องสายก่อน` : 'ปลายสายยังไม่ถึงหน้าสัมผัส ดันต่อให้สุด')]);
      if (!e.cut) items.push([false, 'ไม่ได้ตัดปลายให้เสมอกัน: สายขา 7, 8 สั้นกว่าเส้นอื่นจะไม่ถึงหน้าสัมผัส']);
      const jo = jacketOk(e);
      items.push([jo, jo ? 'เปลือกนอกอยู่ใต้ตัวล็อกสาย (strain relief) ✓' : (e.depth - L < 0 ? `เปลือกนอกยังอยู่นอกหัว (ห่าง ${L - e.depth} มม.) — ดึงแล้วสายหลุดได้` : 'เปลือกนอกยังไม่ถึงตัวล็อกสาย')]);
      const empty = e.order.map((c, i) => c ? -1 : i).filter(i => i >= 0);
      if (empty.length) items.push([false, `ช่องขา ${pinList(empty)} ไม่มีสาย`]);
      return items.map(([ok, t]) => `<li class="${ok ? 'nls-crimp-ok' : 'nls-crimp-bad'}">${ok ? '✓' : '✗'} ${esc(t)}</li>`).join('');
    }

    function arrangeBody(e, lock) {
      let s = `<h3>3. คลายเกลียวและเรียงสาย 8 เส้น</h3>${lock}<p class="nls-crimp-muted">แตะสายแล้วแตะช่องขา (หรือลากสายลงช่อง / ใช้แป้น Tab + Enter) มาตรฐานที่เลือก: <b>${esc(e.std || '-')}</b></p>
<div class="nls-crimp-orient"><span aria-hidden="true">ⓘ</span><span>มองหัว RJ-45 จากด้านบน: หน้าสัมผัสทองแดงหงายขึ้น ตัวล็อก (clip) คว่ำลง ปลายหัวชี้ออกจากตัว — <b>ขา 1 อยู่ซ้ายสุด</b> ขา 8 อยู่ขวาสุด</span></div>
<p class="nls-crimp-poolhead">กองสาย (${e.pool.length} เส้น)</p>${poolHTML(e, false)}${selbarHTML(e, false)}
<div class="nls-crimp-slotlab"><span>← ขา 1<span class="nls-crimp-wideonly"> (ซ้าย)</span></span><button type="button" class="nls-crimp-btn nls-crimp-ghost nls-crimp-zoombtn" data-act="zoom" data-fk="act-zoom" aria-haspopup="dialog" ${e.crimped ? 'disabled' : ''}>${ICON_ZOOM}ขยายหัว RJ-45</button><span>ขา 8<span class="nls-crimp-wideonly"> (ขวา)</span> →</span></div>
${slotsHTML(e, false)}<div class="nls-crimp-row" style="margin-top:10px">`;
      s += `<button type="button" class="nls-crimp-btn nls-crimp-ghost" data-act="clear" data-fk="act-clear" ${e.crimped || e.order.every(c => !c) ? 'disabled' : ''}>เอาสายออกทั้งหมด</button></div>`;
      if (e.strip < 15) s += '<p class="nls-crimp-bad">ปอกสายสั้นมาก จัดเรียงสายได้ยาก (ควรปอกอย่างน้อย 20 มม.)</p>';
      return s;
    }

    // z = true for the enlarged RJ-45 overlay (same state, separate focus keys)
    function poolHTML(e, z) {
      const sel = S.sel, p = z ? 'z-' : '';
      let s = `<div class="nls-crimp-pool" data-act="pool" data-drop="pool" role="group" aria-label="กองสายที่ยังไม่ได้ใส่ ${e.pool.length} เส้น">`;
      e.pool.forEach(c => {
        const on = !!(sel && sel.from === 'pool' && sel.code === c);
        s += `<button type="button" class="nls-crimp-wire${on ? ' nls-crimp-sel' : ''}" data-act="wire" data-code="${c}" data-drag="pool" data-fk="${p}w-${c}" aria-pressed="${on}" aria-label="สาย${NAME[c]}${on ? ' (เลือกอยู่)' : ''}" ${e.crimped ? 'disabled' : ''}>${on ? '<span class="nls-crimp-selbadge" aria-hidden="true">เลือก</span>' : ''}<span class="nls-crimp-wv">${wireIcon(c, 16, 52)}</span><span class="nls-crimp-wh">${wireIconH(c)}</span><span class="nls-crimp-wname">${STRIPED[c] ? `<span>ขาว</span><span>${NAME[c].slice(3)}</span>` : `<span>${NAME[c]}</span>`}</span></button>`;
      });
      if (!e.pool.length) s += '<span class="nls-crimp-muted">ใส่ครบ 8 เส้นแล้ว</span>';
      return s + '</div>';
    }

    function slotsHTML(e, z) {
      const sel = S.sel, p = z ? 'z-' : '';
      let s = `<div class="nls-crimp-slots${sel ? ' nls-crimp-picking' : ''}${z ? ' nls-crimp-zslots' : ''}" role="group" aria-label="ช่องขา 1 ถึง 8 (ซ้ายไปขวา)">`;
      e.order.forEach((c, i) => {
        const on = !!(sel && sel.from === 'slot' && sel.idx === i);
        s += `<button type="button" class="nls-crimp-slot${c ? ' nls-crimp-filled' : ''}${on ? ' nls-crimp-sel' : ''}" data-act="slot" data-i="${i}" data-drop="slot" data-fk="${p}s-${i}" ${c ? `data-drag="slot" data-code="${c}"` : ''} aria-label="ช่องขา ${i + 1}: ${c ? 'สาย' + NAME[c] : 'ว่าง'}${on ? ' (เลือกอยู่)' : ''}" ${e.crimped ? 'disabled' : ''}>`
          + (on ? '<span class="nls-crimp-selbadge" aria-hidden="true">เลือก</span>' : '')
          + (z ? '<i class="nls-crimp-contact" aria-hidden="true"></i>' : '')
          + `<b>${i + 1}</b>${z ? `<span class="nls-crimp-ztall">${c ? wireIcon(c, 16, 100) : '<svg viewBox="0 0 16 100" aria-hidden="true"></svg>'}</span><span class="nls-crimp-zshort">${c ? wireIcon(c, 16, 44) : '<svg viewBox="0 0 16 44" aria-hidden="true"></svg>'}</span>` : c ? wireIcon(c, 16, 52) : '<svg viewBox="0 0 16 52" aria-hidden="true"></svg>'}`
          + `<small${c ? '' : ' class="nls-crimp-empty"'}>${c ? nameHTML(c) : '<span>ว่าง</span>'}</small></button>`;
      });
      return s + '</div>';
    }

    function selbarHTML(e, z) {
      const sel = S.sel, p = z ? 'z-' : '';
      let txt;
      if (sel) {
        txt = `<span class="nls-crimp-seltag">เลือกอยู่</span><b>สาย${NAME[sel.code]}</b> `
          + (sel.from === 'slot' ? `จากขา ${sel.idx + 1} → แตะช่องอื่นเพื่อย้าย/สลับ` : '→ แตะช่องขาที่จะใส่');
      } else {
        txt = `<span class="nls-crimp-muted">${z && S.msg ? esc(S.msg) : 'แตะสายในกองสาย แล้วแตะช่องขา · แตะสายในช่องแล้วแตะช่องอื่นเพื่อสลับ'}</span>`;
      }
      let s = `<div class="nls-crimp-selbar${sel ? ' nls-crimp-on' : ''}"><div class="nls-crimp-seltext"${z ? ' role="status" aria-live="polite"' : ''}>${txt}</div><div class="nls-crimp-selbtns">`;
      if (sel && sel.from === 'slot') s += `<button type="button" class="nls-crimp-btn nls-crimp-ghost" data-act="unslot" data-fk="${p}act-unslot">นำออกจากช่อง</button>`;
      s += `<button type="button" class="nls-crimp-btn nls-crimp-ghost" data-act="unsel" data-fk="${p}act-unsel" ${sel ? '' : 'disabled'}>ยกเลิกการเลือก</button></div></div>`;
      return s;
    }

    const zoomOpen = () => !!(S.zoom && !isDiag() && E().step === 2 && !E().crimped);
    function zoomView() {
      const e = E();
      return `<div class="nls-crimp nls-crimp-zoom" role="dialog" aria-modal="true" aria-label="หัว RJ-45 แบบขยาย ปลายที่ ${S.cur + 1}" data-part="zoom">
<div class="nls-crimp-zhead"><h3>หัว RJ-45 (ขยาย) · ปลายที่ ${S.cur + 1}${e.std ? ' · ' + esc(e.std) : ''}</h3><button type="button" class="nls-crimp-btn nls-crimp-zclose" data-act="zoom-close" data-fk="z-close">${ICON_CLOSE}ปิด</button></div>
<div class="nls-crimp-zbody" data-part="zbody">
<p class="nls-crimp-zhint">หน้าสัมผัสหงายขึ้น · ขา 1 อยู่ซ้ายสุด<span class="nls-crimp-zrot"> · หมุนจอเป็นแนวนอนเพื่อให้ช่องกว้างขึ้น</span></p>
<div class="nls-crimp-plug"><div class="nls-crimp-plugend">ด้านหน้าหัว (หน้าสัมผัสทองแดง)</div>${slotsHTML(e, true)}<div class="nls-crimp-plugend">ท้ายหัว · ด้านสาย</div></div>
${selbarHTML(e, true)}<p class="nls-crimp-zpoolh">กองสาย (${e.pool.length} เส้น)</p>${poolHTML(e, true)}
</div></div>`;
    }

    /* ---------- c4 diagnose view ---------- */
    function diagView() {
      const m = mission();
      const cables = m.start.cables || [];
      if (!S.cable || !cables.some(c => c.id === S.cable)) S.cable = cables[0] ? cables[0].id : null;
      const c = cables.find(x => x.id === S.cable);
      let s = '<section class="nls-crimp-card" aria-label="สายที่ต้องตรวจ"><h3>เลือกสายที่จะตรวจ</h3><div class="nls-crimp-cables" role="group">';
      cables.forEach(x => {
        const d = S.diag[x.id];
        s += `<button type="button" class="nls-crimp-btn nls-crimp-ghost" data-act="cable" data-id="${esc(x.id)}" data-fk="cab-${esc(x.id)}" aria-pressed="${x.id === S.cable}">${esc(x.label)}${d && d.fault ? ' ✓' : ''}</button>`;
      });
      s += '</div>';
      if (c) {
        const toEnd = en => ({ order: en.order, cut: true, untwist: en.untwist_mm || 12, strip: en.strip_mm || 25, depth: PLUG, crimped: true, short: (en.short || []).map(p => p - 1) });
        s += `<p class="nls-crimp-muted">${esc(c.note || '')}</p><div class="nls-crimp-twoplugs">
<div><h4>ปลายที่ 1</h4><div class="nls-crimp-svgbox">${plugSVG(toEnd(c.end1), { compact: true, label: 'หัวปลายที่ 1 ของ' + c.label })}</div></div>
<div><h4>ปลายที่ 2</h4><div class="nls-crimp-svgbox">${plugSVG(toEnd(c.end2), { compact: true, label: 'หัวปลายที่ 2 ของ' + c.label })}</div></div></div>
<p class="nls-crimp-muted">ภาพมองจากด้านบน หน้าสัมผัสหงายขึ้น clip คว่ำลง ขา 1 อยู่ซ้าย</p>`;
      }
      s += '</section><section class="nls-crimp-card"><h3>ผลการวินิจฉัย</h3>';
      cables.forEach(x => {
        const d = S.diag[x.id] || { fault: null, pins: [] };
        s += `<fieldset class="nls-crimp-diag"><legend>${esc(x.label)}</legend>`;
        (m.start.faults || []).forEach(f => {
          s += `<label><input type="radio" name="nls-crimp-f-${esc(x.id)}" data-chg="fault" data-cable="${esc(x.id)}" value="${esc(f.id)}" data-fk="f-${esc(x.id)}-${esc(f.id)}" ${d.fault === f.id ? 'checked' : ''}> ${esc(f.label)}</label>`;
        });
        if (d.fault === 'open' || d.fault === 'miswire') {
          s += `<div class="nls-crimp-pins" role="group" aria-label="ขาที่มีปัญหา"><span class="nls-crimp-muted">ขาที่มีปัญหา:</span>`;
          for (let p = 1; p <= 8; p++) s += `<label><input type="checkbox" data-chg="pin" data-cable="${esc(x.id)}" value="${p}" data-fk="p-${esc(x.id)}-${p}" ${(d.pins || []).includes(p) ? 'checked' : ''}> ${p}</label>`;
          s += '</div>';
        }
        s += '</fieldset>';
      });
      return s + '</section>';
    }

    /* ---------- tester ---------- */
    function currentCable() {
      if (isDiag()) {
        const m = mission();
        const c = (m.start.cables || []).find(x => x.id === S.cable);
        if (!c) return null;
        const te = en => ({ order: en.order, trimmed: en.trimmed !== false, pushed: en.pushed !== false, crimped: en.crimped !== false, short: (en.short || []).map(p => p - 1) });
        return { e1: te(c.end1), e2: te(c.end2), label: c.label, srcEnds: null };
      }
      if (!S.ends[0].crimped || !S.ends[1].crimped) return null;
      return { e1: endTest(S.ends[0]), e2: endTest(S.ends[1]), label: 'สายของคุณ', srcEnds: S.ends };
    }

    function testerCard() {
      const cab = currentCable();
      let s = '<section class="nls-crimp-card" aria-label="เครื่องทดสอบสาย LAN"><h3>ทดสอบสายด้วยเครื่องทดสอบ (LAN tester)</h3>';
      if (!cab) {
        s += `<p class="nls-crimp-muted">ต้องย้ำหัวให้ครบทั้งสองปลายก่อนจึงจะเสียบเครื่องทดสอบได้ (ปลายที่ 1: ${S.ends[0].crimped ? 'ย้ำแล้ว' : 'ยังไม่เสร็จ'}, ปลายที่ 2: ${S.ends[1].crimped ? 'ย้ำแล้ว' : 'ยังไม่เสร็จ'})</p>`;
        return s + '</section>';
      }
      s += `<div class="nls-crimp-row"><button type="button" class="nls-crimp-btn" data-act="test" data-v="basic" data-fk="test-basic" ${S.busy ? 'disabled' : ''}>▶ ทดสอบ (เครื่องพื้นฐาน)</button>
<button type="button" class="nls-crimp-btn nls-crimp-ghost" data-act="test" data-v="advanced" data-fk="test-adv" ${S.busy ? 'disabled' : ''}>▶ เครื่องทดสอบขั้นสูง</button></div>`;
      s += `<div data-part="tester" class="nls-crimp-testerpart" tabindex="-1">${testerBody()}</div>`;
      return s + '</section>';
    }

    function testerBody() {
      const t = S.tst;
      if (!t) return `<div class="nls-crimp-svgbox">${testerSVG(new Array(8).fill(-1), 0, 'basic')}</div><p class="nls-crimp-muted">เครื่องพื้นฐานไล่ไฟทีละขา 1–8 ดูว่าขาแต่ละขาของเครื่องหลักไปติดที่ขาใดของเครื่องปลายทาง (ตรวจได้เฉพาะความต่อเนื่องของสาย) เครื่องขั้นสูงตรวจการจับคู่สายบิดเกลียว (split pair) ได้ด้วย</p>`;
      let s = `<div class="nls-crimp-svgbox">${testerSVG(t.res.map, t.done ? 9 : t.step, t.mode)}</div>`;
      s += `<p class="nls-crimp-sr" aria-live="polite">${t.done ? 'ทดสอบเสร็จ' : t.step > 0 ? `ขา ${t.step} ไปที่ ${t.res.map[t.step - 1] >= 0 ? 'ขา ' + (t.res.map[t.step - 1] + 1) : 'ไม่มีไฟ'}` : ''}</p>`;
      if (!t.done) return s + '<p class="nls-crimp-muted">กำลังทดสอบ…</p>';
      return s + testerReport(t);
    }

    function openReason(i, which, cab) {
      const src = cab.srcEnds;
      const e = which === 1 ? cab.e1 : cab.e2;
      const who = 'ปลายที่ ' + which;
      if (!e.crimped) return who + ' ยังไม่ย้ำหัว';
      if (!e.pushed) return who + ' ดันสายไม่สุดหัว';
      if (!e.order[i]) return `${who} ช่องขา ${i + 1} ไม่มีสาย`;
      if (!e.trimmed && UNTRIM_SHORT.includes(i)) return `${who} ไม่ได้ตัดปลายให้เสมอกัน สายขา ${i + 1} สั้นไม่ถึงหน้าสัมผัส`;
      if ((e.short || []).includes(i)) return `${who} สายขา ${i + 1} สั้น/ขาด ไม่ถึงหน้าสัมผัส`;
      void src;
      return who + ' สายไม่ต่อถึงกัน';
    }

    function testerReport(t) {
      const r = t.res, cab = t.cab;
      const V = {
        straight: ['nls-crimp-ok', 'สายแบบตรง (straight-through): ไฟติด 1→1, 2→2 … 8→8'],
        crossover: ['nls-crimp-ok', 'สายแบบไขว้ (crossover): 1→3, 2→6, 3→1, 6→2 (4, 5, 7, 8 ตรงกัน)'],
        open: ['nls-crimp-bad', `วงจรขาด (open): ขา ${pinList(r.open)} ไฟไม่ติด`],
        miswire: ['nls-crimp-bad', `ต่อสลับขา (miswire): ขา ${r.wrong.map(i => `${i + 1}→${r.map[i] + 1}`).join(', ')}`],
        reversed: ['nls-crimp-bad', 'เรียงกลับด้าน (reversed): 1→8, 2→7 … 8→1']
      };
      let s = `<p class="nls-crimp-verdict ${V[r.verdict][0]}">${t.mode === 'advanced' ? 'ผลเครื่องทดสอบขั้นสูง' : 'ผลการทดสอบ'}: ${esc(V[r.verdict][1])}</p>`;
      if (r.verdict === 'open' && r.wrong.length) s += `<p class="nls-crimp-bad">และมีขาที่ไปผิดตำแหน่ง: ${r.wrong.map(i => `${i + 1}→${r.map[i] + 1}`).join(', ')}</p>`;
      if (mission() && !isDiag()) s += `<div class="nls-crimp-row nls-crimp-testgo"><button type="button" class="nls-crimp-btn" data-act="submit" data-fk="submit-t" ${S.sending ? 'disabled' : ''}>ตรวจคำตอบ / ส่งงาน</button><span class="nls-crimp-muted">หรือดูผลทีละขาด้านล่างก่อน</span></div>`;
      if (t.mode === 'advanced') {
        if (r.verdict === 'straight' || r.verdict === 'crossover') {
          s += r.split.length
            ? `<p class="nls-crimp-bad"><b>⚠ สายคู่ถูกแยก (split pair) ที่ขา ${pinList(r.split)}</b> — ไฟติดครบตามลำดับ แต่สายที่บิดเกลียวเป็นคู่เดียวกันไม่ได้อยู่ที่ขา 1-2, 3-6, 4-5, 7-8 สัญญาณคู่เดียวกันจึงวิ่งบนสายต่างคู่ เกิดสัญญาณรบกวนข้ามคู่ (crosstalk) ใช้ความเร็วสูงไม่ได้ เครื่องทดสอบพื้นฐานตรวจไม่พบ</p>`
            : '<p class="nls-crimp-ok">✓ การจับคู่สาย (1-2, 3-6, 4-5, 7-8) ถูกต้อง ไม่มี split pair</p>';
        } else s += '<p class="nls-crimp-muted">ต้องแก้ความต่อเนื่องของสายให้ถูกก่อน จึงจะตรวจการจับคู่สายได้</p>';
      } else if (r.verdict === 'straight' || r.verdict === 'crossover') {
        s += '<p class="nls-crimp-muted">หมายเหตุ: เครื่องพื้นฐานตรวจแค่ความต่อเนื่องทีละขา ถ้าสายคู่ถูกแยก (split pair) ไฟก็ยังติดครบ ลองใช้เครื่องทดสอบขั้นสูงเพื่อตรวจการจับคู่สาย</p>';
      }
      s += '<div class="nls-crimp-tablewrap"><table class="nls-crimp-table"><thead><tr><th>ขา</th><th>สี (ปลาย 1)</th><th>ไปติดที่ปลายทาง</th><th>ผล</th></tr></thead><tbody>';
      for (let i = 0; i < 8; i++) {
        const j = r.map[i], c = cab.e1.order[i];
        let res, cls;
        if (j < 0) {
          cls = 'nls-crimp-bad';
          if (r.o1.has(i)) res = 'ไม่มีไฟ: ' + openReason(i, 1, cab);
          else if (c && cab.e2.order.indexOf(c) < 0) res = `ไม่มีไฟ: ไม่มีสาย${NAME[c]} ในหัวปลายที่ 2`;
          else res = 'ไม่มีไฟ: ' + openReason(cab.e2.order.indexOf(c), 2, cab);
        } else if ((r.verdict === 'miswire' || r.verdict === 'open') && r.wrong.includes(i)) {
          res = `ผิดขา: สาย${NAME[c]} อยู่ขา ${i + 1} ที่ปลาย 1 แต่อยู่ขา ${j + 1} ที่ปลาย 2`; cls = 'nls-crimp-bad';
        } else if (r.verdict === 'reversed') { res = 'กลับด้าน'; cls = 'nls-crimp-bad'; }
        else { res = '✓'; cls = 'nls-crimp-ok'; }
        s += `<tr><td>${i + 1}</td><td>${c ? NAME[c] : '-'}</td><td>${j >= 0 ? 'ขา ' + (j + 1) : '—'}</td><td class="${cls}">${esc(res)}</td></tr>`;
      }
      s += '</tbody></table></div>';
      if (S.free && !isDiag()) s += selfCheck();
      return s;
    }

    function selfCheck() {
      const rows = [];
      S.ends.forEach((e, k) => {
        const who = 'ปลายที่ ' + (k + 1);
        const L = effL(e);
        const isA = same(e.order, STD.T568A), isB = same(e.order, STD.T568B);
        rows.push([isA || isB, isA || isB ? `${who}: เรียงสีตาม ${isA ? 'T568A' : 'T568B'}${e.std && e.std !== (isA ? 'T568A' : 'T568B') ? ' (แต่เลือกมาตรฐาน ' + e.std + ')' : ''}` : `${who}: ลำดับสีไม่ตรงทั้ง T568A และ T568B`]);
        rows.push([L <= UMAX && L >= UMIN, `${who}: ส่วนที่คลายเกลียว ${L} มม. ${L > UMAX ? '(เกิน 13 มม. เกิด crosstalk)' : L < UMIN ? '(สั้นเกินไป)' : ''}`]);
        rows.push([jacketOk(e), `${who}: ${jacketOk(e) ? 'เปลือกนอกอยู่ใต้ตัวล็อกสาย' : 'เปลือกนอกไม่ถึงตัวล็อกสาย สายหลุดง่าย'}`]);
        rows.push([e.cut && e.depth >= PLUG, `${who}: ${e.cut ? (e.depth >= PLUG ? 'ตัดเสมอกันและดันสุดหัว' : 'ดันสายไม่สุดหัว') : 'ไม่ได้ตัดปลายให้เสมอกัน'}`]);
      });
      return `<h3 style="margin-top:10px">ตรวจคุณภาพการเข้าหัว (โหมดฝึก)</h3><ul class="nls-crimp-status">${rows.map(([ok, t]) => `<li class="${ok ? 'nls-crimp-ok' : 'nls-crimp-bad'}">${ok ? '✓' : '✗'} ${esc(t)}</li>`).join('')}</ul>`;
    }

    function runTest(mode) {
      const cab = currentCable();
      if (!cab) return;
      clearTimers();
      const res = testCable(cab.e1, cab.e2);
      S.tst = { mode, res, cab, step: 0, done: false };
      S.busy = true;
      if (!isDiag()) S.tested = mode === 'advanced' || S.tested === 'advanced' ? 'advanced' : 'basic';
      render();
      const upd = () => { const el = root.querySelector('[data-part="tester"]'); if (el) el.innerHTML = testerBody(); };
      if (reduce()) { S.tst.done = true; S.busy = false; render(); revealTester(false); return; }
      revealTester(false);
      const tick = () => {
        if (!S.tst) return;
        S.tst.step++;
        if (S.tst.step > 8) { S.tst.done = true; S.busy = false; render(); revealTester(true); return; }
        upd(); later(tick, 380);
      };
      later(tick, 250);
    }

    function submitCard() {
      const m = mission();
      if (!m) return '';
      let s = '<section class="nls-crimp-card" aria-label="ส่งงาน"><h3>ตรวจคำตอบ / ส่งงาน</h3>';
      const ready = isDiag() ? true : S.ends[0].crimped && S.ends[1].crimped;
      if (!ready) s += '<p class="nls-crimp-muted">ย้ำหัวให้ครบทั้งสองปลายก่อนส่งงาน</p>';
      if (!ctx.user) s += '<p class="nls-crimp-muted">ยังไม่ได้เข้าสู่ระบบ: ตรวจคะแนนได้แต่จะไม่บันทึก</p>';
      s += `<button type="button" class="nls-crimp-btn" data-act="submit" data-fk="submit" ${ready && !S.sending ? '' : 'disabled'}>${S.sending ? 'กำลังตรวจ…' : 'ตรวจคำตอบ / ส่งงาน'}</button>`;
      s += '<div role="status" aria-live="polite">';
      if (S.result) {
        const r = S.result;
        if (r.error) s += `<p class="nls-crimp-bad">${esc(r.error)}</p>`;
        else {
          s += `<p class="nls-crimp-score ${r.ok ? 'nls-crimp-ok' : ''}">คะแนน ${r.score}/${r.max}${r.saved ? ' · บันทึกแล้ว' : ''}</p>`;
          if (Array.isArray(r.feedback) && r.feedback.length) s += `<ul class="nls-crimp-fb">${r.feedback.map(f => `<li>${esc(f)}</li>`).join('')}</ul>`;
        }
      }
      return s + '</div></section>';
    }

    function payloadEnd(e) {
      return { standardChoice: e.std, order: e.order.slice(), strip_mm: e.strip, untwist_mm: effL(e), jacketInside: jacketOk(e), trimmed: e.cut, pushed: e.depth >= PLUG, crimped: e.crimped };
    }

    async function submit() {
      const m = mission();
      if (!m || S.sending || typeof ctx.submit !== 'function') return;
      const payload = isDiag() ? { diagnosis: JSON.parse(JSON.stringify(S.diag)) } : { end1: payloadEnd(S.ends[0]), end2: payloadEnd(S.ends[1]), tested: S.tested };
      S.sending = true; render();
      try {
        const r = await ctx.submit(m.id, payload);
        if (!alive) return;
        S.result = r || { error: 'ไม่ได้รับผลการตรวจ' };
        if (r && typeof r.score === 'number') {
          const b = best[m.id] || { best: 0, max: r.max, attempts: 0 };
          b.attempts = (b.attempts || 0) + 1; b.best = Math.max(b.best || 0, r.score); b.max = r.max; best[m.id] = b;
        }
      } catch (err) {
        if (!alive) return;
        S.result = { error: 'ส่งงานไม่สำเร็จ: ' + (err && err.message ? err.message : 'เกิดข้อผิดพลาด') };
      }
      S.sending = false; render();
      const el = root.querySelector('.nls-crimp-score') || root.querySelector('[data-act="submit"]');
      if (el) el.scrollIntoView({ block: 'nearest', behavior: scrollBehavior() });
    }

    /* ---------- actions ---------- */
    function placeSel(slot) {
      const e = E(), sel = S.sel;
      if (!sel || e.crimped) return;
      const existing = e.order[slot];
      if (sel.from === 'pool') {
        const pi = e.pool.indexOf(sel.code); if (pi < 0) { S.sel = null; return; }
        e.pool.splice(pi, 1);
        if (existing) e.pool.push(existing);
        e.order[slot] = sel.code;
        S.msg = `ใส่สาย${NAME[sel.code]} ที่ขา ${slot + 1}` + (existing ? ` (สาย${NAME[existing]} กลับไปที่กองสาย)` : '');
      } else {
        if (sel.idx === slot) { S.sel = null; return; }
        e.order[sel.idx] = existing || null;
        e.order[slot] = sel.code;
        S.msg = `ย้ายสาย${NAME[sel.code]} ไปขา ${slot + 1}` + (existing ? ` และสลับสาย${NAME[existing]} ไปขา ${sel.idx + 1}` : '');
      }
      S.sel = null; invalidate();
    }
    function unslot(idx) {
      const e = E(); const c = e.order[idx];
      if (!c || e.crimped) return;
      e.order[idx] = null; e.pool.push(c); S.sel = null; invalidate();
      S.msg = `นำสาย${NAME[c]} ออกจากขา ${idx + 1}`;
    }

    let suppressClick = false;
    function onClick(ev) {
      if (suppressClick) { suppressClick = false; ev.preventDefault(); return; }
      const t = ev.target.closest('[data-act]');
      if (!t || !root.contains(t) || t.disabled) return;
      const act = t.getAttribute('data-act');
      const e = E();
      switch (act) {
        case 'mission': {
          const id = t.getAttribute('data-id');
          if (!S.free && S.mid === id) return;
          clearTimers();
          S = freshState(id); S.free = false; S.msg = '';
          break;
        }
        case 'free': if (S.free) return; clearTimers(); S = freshState(null); S.free = true; break;
        case 'hint': S.hintsShown++; break;
        case 'ref': S.showRef = !S.showRef; break;
        case 'reset-all': { const id = S.mid, f = S.free; clearTimers(); S = freshState(id); S.free = f; S.msg = 'เริ่มใหม่แล้ว'; break; }
        case 'end': S.cur = Number(t.getAttribute('data-i')) === 1 ? 1 : 0; S.sel = null; S.msg = ''; break;
        case 'step': e.step = Number(t.getAttribute('data-s')); S.sel = null; S.msg = ''; break;
        case 'prev': e.step = Math.max(0, e.step - 1); S.sel = null; S.msg = ''; break;
        case 'next': {
          if (e.step === 2 && e.order.some(c => !c)) S.msg = `คำเตือน: ยังมีช่องว่าง ${e.order.filter(c => !c).length} ช่อง ขานั้นจะไม่มีสาย (วงจรขาด)`;
          else if (e.step === 3 && !e.cut) S.msg = 'คำเตือน: ยังไม่ได้ตัดปลายสาย สายจะยาวไม่เท่ากันและยาวเกินไป';
          else if (e.step === 4 && (e.depth < PLUG || !jacketOk(e))) S.msg = 'คำเตือน: ยังใส่สายไม่ถูกต้อง ถ้าย้ำตอนนี้สายจะเสีย';
          else S.msg = '';
          e.step = Math.min(5, e.step + 1); S.sel = null;
          break;
        }
        case 'std': if (e.crimped) return; e.std = t.getAttribute('data-v'); invalidate(); S.msg = `ปลายที่ ${S.cur + 1} ใช้มาตรฐาน ${e.std}`; break;
        case 'strip':
          if (e.crimped) return;
          e.stripped = true; e.cut = false; e.untwist = Math.min(e.untwist, e.strip); e.depth = 0; invalidate();
          S.msg = `ปอกเปลือกออก ${e.strip} มม. แล้ว` + (e.strip < 15 ? ' (สั้นมาก จัดสายยาก)' : '');
          break;
        case 'wire': {
          const code = t.getAttribute('data-code');
          S.sel = S.sel && S.sel.from === 'pool' && S.sel.code === code ? null : { from: 'pool', code };
          S.msg = S.sel ? `เลือกสาย${NAME[code]} แล้ว เลือกช่องขาที่จะใส่` : 'ยกเลิกการเลือกแล้ว';
          break;
        }
        case 'slot': {
          const i = Number(t.getAttribute('data-i'));
          if (S.sel) placeSel(i);
          else if (e.order[i]) { S.sel = { from: 'slot', idx: i, code: e.order[i] }; S.msg = `เลือกสาย${NAME[e.order[i]]} ที่ขา ${i + 1} แตะช่องอื่นเพื่อย้าย/สลับ`; }
          break;
        }
        case 'pool': if (S.sel && S.sel.from === 'slot') unslot(S.sel.idx); else return; break;
        case 'unslot': if (S.sel && S.sel.from === 'slot') unslot(S.sel.idx); break;
        case 'unsel': S.sel = null; S.msg = 'ยกเลิกการเลือกแล้ว'; break;
        case 'clear':
          if (e.crimped) return;
          e.order.forEach(c => { if (c) e.pool.push(c); }); e.order = e.order.map(() => null); S.sel = null; invalidate(); S.msg = 'นำสายออกทั้งหมดแล้ว';
          break;
        case 'cut': {
          if (e.crimped) return;
          e.untwist = Math.min(e.untwist, e.strip); e.cut = true; e.depth = 0; invalidate();
          S.msg = `ตัดสายแล้ว เหลือ ${e.untwist} มม.`;
          break;
        }
        case 'uncut': if (e.crimped) return; e.cut = false; e.strip = e.untwist; e.depth = 0; invalidate(); S.msg = 'เลื่อนเส้นตัดใหม่ได้ (ตัดให้สั้นลงเท่านั้น)'; break;
        case 'push': if (e.crimped) return; e.depth = maxDepth(e); invalidate(); S.msg = e.depth >= PLUG ? 'ดันสายจนชนด้านหน้าหัวแล้ว' : 'ดันได้ไม่สุด สายสั้นเกินไป'; break;
        case 'pull': if (e.crimped) return; e.depth = 0; invalidate(); S.msg = 'ดึงสายออกจากหัวแล้ว'; break;
        case 'crimp': {
          if (e.crimped || S.crimping) return;
          S.crimping = true;
          const k = S.cur;
          later(() => {
            S.crimping = false; S.ends[k].crimped = true; invalidate();
            S.msg = `ย้ำหัวปลายที่ ${k + 1} แล้ว` + (S.ends[1 - k].crimped ? ' ทั้งสองปลายเสร็จแล้ว ทดสอบสายได้เลย' : ` ต่อไปทำปลายที่ ${2 - k}`);
            render();
          }, reduce() ? 0 : 650);
          render();
          const box2 = root.querySelector('[data-part="vis"]');
          if (box2 && !reduce()) requestAnimationFrame(() => box2.classList.add('nls-crimp-pressing'));
          return;
        }
        case 'reset-end': {
          const k = S.cur; S.ends[k] = newEnd(k); invalidate(); S.msg = `ตัดหัวปลายที่ ${k + 1} ทิ้งแล้ว เริ่มทำใหม่`;
          break;
        }
        case 'zoom': {
          if (e.crimped || isDiag()) return;
          S.zoom = true; render();
          const c = root.querySelector('[data-act="zoom-close"]'); if (c) c.focus();
          return;
        }
        case 'zoom-close': {
          S.zoom = false; render();
          const b = root.querySelector('[data-act="zoom"]'); if (b) b.focus({ preventScroll: true });
          return;
        }
        case 'test': runTest(t.getAttribute('data-v') === 'advanced' ? 'advanced' : 'basic'); return;
        case 'cable': S.cable = t.getAttribute('data-id'); clearTimers(); S.tst = null; S.busy = false; break;
        case 'submit': submit(); return;
        default: return;
      }
      render();
      if (act === 'next' || act === 'prev' || act === 'step' || act === 'end') revealSteps();
    }

    const scrollBehavior = () => reduce() ? 'auto' : 'smooth';
    // after changing step on a phone, bring the step bar back into view when it scrolled off the top
    function revealSteps() {
      const ol = root.querySelector('.nls-crimp-steps');
      if (!ol || typeof ol.scrollIntoView !== 'function') return;
      const top = ol.getBoundingClientRect().top;
      if (top < 56 || top > window.innerHeight * 0.6) ol.scrollIntoView({ block: 'start', behavior: scrollBehavior() });
    }
    function revealTester(done) {
      const part = root.querySelector('[data-part="tester"]');
      if (!part || typeof part.scrollIntoView !== 'function') return;
      if (!done) { part.scrollIntoView({ block: 'start', behavior: scrollBehavior() }); return; }
      // result is now taller: put the tester drawing at the top so the verdict and the submit button follow it
      const top = part.getBoundingClientRect().top;
      if (top < 56 || top > 120) part.scrollIntoView({ block: 'start', behavior: scrollBehavior() });
    }

    function onKeyDown(ev) {
      if (ev.key === 'Escape') {
        if (zoomOpen()) { ev.preventDefault(); S.zoom = false; render(); const b = root.querySelector('[data-act="zoom"]'); if (b) b.focus({ preventScroll: true }); return; }
        if (S.sel) { ev.preventDefault(); S.sel = null; S.msg = 'ยกเลิกการเลือกแล้ว'; render(); }
        return;
      }
      if (ev.key === 'Tab' && zoomOpen()) {
        // keep focus inside the enlarged view
        const z = root.querySelector('[data-part="zoom"]');
        if (!z) return;
        const f = Array.from(z.querySelectorAll('button:not([disabled])'));
        if (!f.length) return;
        const i = f.indexOf(document.activeElement);
        if (ev.shiftKey && (i <= 0)) { ev.preventDefault(); f[f.length - 1].focus(); }
        else if (!ev.shiftKey && (i === f.length - 1 || i < 0)) { ev.preventDefault(); f[0].focus(); }
      }
    }

    function onChange(ev) {
      const t = ev.target;
      const kind = t.getAttribute && t.getAttribute('data-chg');
      if (!kind) return;
      const id = t.getAttribute('data-cable');
      const d = S.diag[id] || (S.diag[id] = { fault: null, pins: [] });
      if (kind === 'fault') { d.fault = t.value; if (d.fault !== 'open' && d.fault !== 'miswire') d.pins = []; }
      else {
        const p = Number(t.value);
        d.pins = (d.pins || []).filter(x => x !== p);
        if (t.checked) d.pins.push(p);
        d.pins.sort((a, b) => a - b);
      }
      S.result = null;
      render();
    }

    function onInput(ev) {
      const t = ev.target;
      const kind = t.getAttribute && t.getAttribute('data-in');
      if (!kind) return;
      const e = E();
      if (e.crimped) return;
      const v = Number(t.value);
      const out = q => root.querySelector(`[data-out="${q}"]`);
      const vis = root.querySelector('[data-part="vis"]');
      if (kind === 'strip') {
        e.strip = v; e.stripped = false; e.cut = false; e.depth = 0; e.untwist = Math.min(e.untwist, v);
        out('strip').textContent = v + ' มม.'; out('stripmsg').textContent = 'กด "ปอกสาย" เพื่อยืนยัน';
        if (vis) vis.innerHTML = stripSVG(v);
      } else if (kind === 'untwist') {
        e.untwist = v; out('untwist').textContent = v + ' มม.';
        if (vis) vis.innerHTML = trimSVG(e);
      } else if (kind === 'depth') {
        e.depth = v; out('depth').textContent = v + ' มม.';
        if (vis) vis.innerHTML = plugSVG(e);
        out('insert').innerHTML = insertStatus(e);
      }
      S.tst = null; S.tested = null; S.result = null;
      saveDraft();
    }
    function onSliderDone(ev) {
      // re-render step markers / buttons after a slider is released
      const t = ev.target;
      if (t.getAttribute && t.getAttribute('data-in')) render();
    }

    /* ---------- drag & drop with Pointer Events ---------- */
    let drag = null;
    const HOLD_MS = 280;
    function onPointerDown(ev) {
      if (ev.button !== undefined && ev.button !== 0) return;
      const w = ev.target.closest('[data-drag]');
      if (!w || !root.contains(w) || w.disabled || E().crimped) return;
      if (drag) { endDrag(); drag = null; }
      const from = w.getAttribute('data-drag');
      // touch on an element that lets the page scroll (phone layout): drag starts only after a short hold,
      // so a normal swipe still scrolls the page. touch-action:none elements drag immediately (as before).
      const hold = ev.pointerType === 'touch' && getComputedStyle(w).touchAction !== 'none';
      drag = { from, code: w.getAttribute('data-code'), idx: from === 'slot' ? Number(w.getAttribute('data-i')) : -1, x: ev.clientX, y: ev.clientY, id: ev.pointerId, active: false, armed: !hold, ghost: null, over: null, timer: 0, el: w };
      if (hold) {
        drag.timer = setTimeout(() => {
          if (!drag || drag.active || drag.armed) return;
          drag.armed = true;
          showGhost(drag.x, drag.y);
          if (navigator.vibrate) { try { navigator.vibrate(12); } catch (err) { /* ignore */ } }
        }, HOLD_MS);
      }
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
      window.addEventListener('pointercancel', onPointerCancel);
    }
    function showGhost(x, y) {
      if (!drag || drag.ghost) return;
      const g = document.createElement('div');
      g.className = 'nls-crimp-ghost-wire'; g.innerHTML = wireIcon(drag.code, 18, 60);
      g.style.left = x + 'px'; g.style.top = y + 'px';
      (root.querySelector('[data-part="zoom"]') || root).appendChild(g); drag.ghost = g;
    }
    function onTouchMove(ev) {
      if (drag && (drag.armed || drag.active) && ev.cancelable) ev.preventDefault();
    }
    function onContextMenu(ev) {
      const w = ev.target && ev.target.closest ? ev.target.closest('[data-drag]') : null;
      if (w && root.contains(w)) ev.preventDefault();
    }
    function dropTarget(x, y) {
      const el = document.elementFromPoint(x, y);
      const d = el && el.closest ? el.closest('[data-drop]') : null;
      return d && root.contains(d) ? d : null;
    }
    function onPointerMove(ev) {
      if (!drag || ev.pointerId !== drag.id) return;
      if (!drag.active) {
        const dist = Math.hypot(ev.clientX - drag.x, ev.clientY - drag.y);
        if (!drag.armed) {
          // finger moved before the hold finished: it is a scroll, not a drag
          if (dist > 8) { endDrag(); drag = null; }
          return;
        }
        if (dist < 6) return;
        drag.active = true;
        showGhost(ev.clientX, ev.clientY);
        S.sel = null;
      }
      ev.preventDefault();
      drag.ghost.style.left = ev.clientX + 'px'; drag.ghost.style.top = ev.clientY + 'px';
      const over = dropTarget(ev.clientX, ev.clientY);
      if (over !== drag.over) {
        if (drag.over) drag.over.classList.remove('nls-crimp-over');
        if (over) over.classList.add('nls-crimp-over');
        drag.over = over;
      }
    }
    function endDrag() {
      if (drag && drag.timer) clearTimeout(drag.timer);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerCancel);
      if (drag && drag.ghost) drag.ghost.remove();
      if (drag && drag.over) drag.over.classList.remove('nls-crimp-over');
    }
    function onPointerUp(ev) {
      if (!drag || ev.pointerId !== drag.id) return;
      const d = drag;
      endDrag(); drag = null;
      if (!d.active) return; // a tap: the click handler does the select/place
      suppressClick = true; setTimeout(() => { suppressClick = false; }, 0);
      const tgt = dropTarget(ev.clientX, ev.clientY);
      if (!tgt) { S.msg = 'ปล่อยสายนอกช่อง ลองใหม่อีกครั้ง'; render(); return; }
      if (tgt.getAttribute('data-drop') === 'slot') {
        S.sel = d.from === 'pool' ? { from: 'pool', code: d.code } : { from: 'slot', idx: d.idx, code: d.code };
        placeSel(Number(tgt.getAttribute('data-i')));
      } else if (d.from === 'slot') unslot(d.idx);
      render();
    }
    function onPointerCancel() { endDrag(); drag = null; }

    let alive = true;
    root.addEventListener('click', onClick);
    root.addEventListener('input', onInput);
    root.addEventListener('change', onChange);
    root.addEventListener('change', onSliderDone);
    root.addEventListener('pointerdown', onPointerDown);
    root.addEventListener('keydown', onKeyDown);
    root.addEventListener('touchmove', onTouchMove, { passive: false });
    root.addEventListener('contextmenu', onContextMenu);
    render();

    return {
      destroy() {
        alive = false;
        clearTimers();
        endDrag(); drag = null;
        root.removeEventListener('click', onClick);
        root.removeEventListener('input', onInput);
        root.removeEventListener('change', onChange);
        root.removeEventListener('change', onSliderDone);
        root.removeEventListener('pointerdown', onPointerDown);
        root.removeEventListener('keydown', onKeyDown);
        root.removeEventListener('touchmove', onTouchMove);
        root.removeEventListener('contextmenu', onContextMenu);
        document.documentElement.classList.remove('nls-crimp-noscroll');
        root.innerHTML = '';
      }
    };
  }

  window.NL_SIMS = window.NL_SIMS || {};
  window.NL_SIMS['crimp'] = { title: 'จำลองการเข้าหัวสาย UTP (RJ-45)', mount };
})();

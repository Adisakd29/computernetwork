'use strict';
/*
 * NetLab - Network Topology Simulator (browser module, SIM-SPEC §1 + §4.1)
 * Registers window.NL_SIMS.topology. All networking logic comes from window.NetSim (public/js/sim/netsim.js):
 * the canvas is drawn with NetSim.render, problems come from net.problems(), pings from net.ping().
 * This module only edits the topology JSON (SIM-SPEC §3.1) and shows the engine's results.
 */
(function () {
  const SIM = 'topology';
  const DRAFT_KEY = 'nl-sim-topology-draft';
  const MAX_DEV = 60;
  const MAX_LINK = 150;
  const MAX_UNDO = 60;

  const CSS = `
.nls-topology{container-type:inline-size;color:var(--ink);font-family:inherit;min-width:0;--nls-topology-mono:"JetBrains Mono",Consolas,monospace}
.nls-topology *,.nls-topology *::before,.nls-topology *::after{box-sizing:border-box}
.nls-topology h2{font-size:24px;line-height:1.25;margin:0 0 4px}
.nls-topology h3{font-size:17px;margin:0 0 8px;line-height:1.35}
.nls-topology h4{font-size:15px;margin:12px 0 6px}
.nls-topology p{margin:0 0 8px}
.nls-topology-muted{color:var(--muted);font-size:14px}
.nls-topology-card{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:12px 14px;margin:0 0 12px;min-width:0}
.nls-topology-btn{background:var(--ink);color:var(--bg);border:1px solid var(--ink);border-radius:8px;padding:6px 12px;font:inherit;font-weight:600;font-size:14.5px;cursor:pointer;line-height:1.3;min-height:38px}
.nls-topology-btn.nls-topology-ghost{background:var(--panel);color:var(--ink);border-color:var(--line)}
.nls-topology-btn.nls-topology-small{min-height:32px;padding:3px 9px;font-size:13.5px}
.nls-topology-btn.nls-topology-danger{color:var(--bad);border-color:var(--bad);background:var(--panel)}
.nls-topology-btn.nls-topology-go{background:var(--green);border-color:var(--green);color:var(--panel)}
.nls-topology-btn[aria-pressed="true"]{background:var(--blue);border-color:var(--blue);color:var(--panel)}
.nls-topology-btn:disabled{opacity:.45;cursor:default}
.nls-topology button:focus-visible,.nls-topology input:focus-visible,.nls-topology select:focus-visible,.nls-topology summary:focus-visible{outline:3px solid var(--blue);outline-offset:2px}
.nls-topology-row{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.nls-topology-howto summary{cursor:pointer;font-weight:600}
.nls-topology-howto ol{margin:8px 0 0;padding-left:22px;font-size:14.5px}
.nls-topology-howto li{margin-bottom:3px}
.nls-topology-missions{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px;margin:0 0 12px}
.nls-topology-mbtn{display:flex;flex-direction:column;align-items:flex-start;text-align:left;gap:2px;background:var(--panel);color:var(--ink);border:1px solid var(--line);border-radius:10px;padding:8px 11px;font:inherit;cursor:pointer;min-width:0}
.nls-topology-mbtn b{font-size:14.5px;line-height:1.3}
.nls-topology-mbtn span{font-size:12.5px;color:var(--muted)}
.nls-topology-mbtn.nls-topology-on{border-color:var(--blue);box-shadow:inset 0 0 0 2px var(--blue)}
.nls-topology-mbtn .nls-topology-best{color:var(--ok);font-weight:600}
.nls-topology-lv{display:inline-block;font-size:12px;font-weight:600;border:1px solid currentColor;border-radius:4px;padding:0 6px;margin-left:6px;vertical-align:middle}
.nls-topology-lv-easy{color:var(--green)}.nls-topology-lv-medium{color:var(--orange)}.nls-topology-lv-hard{color:var(--bad)}
.nls-topology-hints{margin:6px 0 0;padding-left:20px;font-size:14.5px;color:var(--muted)}
.nls-topology-hints li{border-left:3px solid var(--blue);padding-left:8px;margin:0 0 4px;list-style:none;margin-left:-20px}
.nls-topology-result{margin-top:10px;border-top:1px solid var(--line);padding-top:10px}
.nls-topology-score{font-size:26px;font-weight:700}
.nls-topology-score.nls-topology-full{color:var(--ok)}
.nls-topology-checks{list-style:none;padding:0;margin:6px 0;font-size:14.5px}
.nls-topology-checks li{display:flex;gap:8px;align-items:baseline;padding:2px 0}
.nls-topology-checks i{font-style:normal;font-weight:700;width:1.2em;flex:none}
.nls-topology-checks .nls-topology-y{color:var(--ok)}.nls-topology-checks .nls-topology-n{color:var(--bad)}
.nls-topology-checks em{margin-left:auto;font-style:normal;color:var(--muted);font-family:var(--nls-topology-mono);font-size:13px;flex:none}
.nls-topology-fb{margin:6px 0 0;padding-left:20px;font-size:14.5px}
.nls-topology-fb li{margin-bottom:4px}
.nls-topology-work{display:grid;gap:12px;grid-template-columns:minmax(0,1fr);align-items:start}
.nls-topology-stage{min-width:0}
.nls-topology-side{min-width:0}
.nls-topology-toolbar{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px}
.nls-topology-sep{width:1px;background:var(--line);align-self:stretch;margin:0 2px}
.nls-topology-chk{display:inline-flex;align-items:center;gap:6px;font-size:14px;cursor:pointer}
.nls-topology-palette{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;margin-bottom:8px}
.nls-topology-pbtn{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0;padding:4px 2px 5px;border:1px solid var(--line);border-radius:10px;background:var(--panel);color:var(--ink);font:inherit;font-size:12.5px;line-height:1.2;touch-action:none;user-select:none;-webkit-user-select:none;cursor:grab;min-width:0;min-height:56px}
.nls-topology-pbtn svg{width:42px;height:34px;pointer-events:none}
.nls-topology-pbtn span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%}
.nls-topology-pbtn[aria-pressed="true"]{border-color:var(--blue);box-shadow:inset 0 0 0 2px var(--blue)}
.nls-topology-ghost-dev{position:fixed;z-index:1000;width:56px;height:46px;pointer-events:none;opacity:.85;background:var(--panel);border:2px dashed var(--blue);border-radius:10px}
.nls-topology-ghost-dev svg{width:100%;height:100%}
.nls-topology-status{font-size:14px;min-height:1.5em;margin:0 0 6px;color:var(--muted)}
.nls-topology-status.nls-topology-bad{color:var(--bad)}
.nls-topology-selbar{display:flex;flex-wrap:wrap;gap:6px;align-items:center;font-size:14px;background:var(--field);border:1px solid var(--line);border-radius:10px;padding:5px 8px;margin:0 0 6px;min-height:44px}
.nls-topology-selbar .nls-topology-grow{flex:1 1 160px;min-width:0;overflow-wrap:anywhere}
.nls-topology-canvaswrap{position:relative;border:1px solid var(--line);border-radius:12px;overflow:hidden;background:var(--panel)}
.nls-topology-canvas{display:block;width:100%;height:440px;touch-action:none;user-select:none;-webkit-user-select:none;cursor:grab;outline:none}
.nls-topology-canvas.nls-topology-panning{cursor:grabbing}
.nls-topology-canvas.nls-topology-placing,.nls-topology-canvas.nls-topology-wiring{cursor:crosshair}
.nls-topology-canvaswrap:focus-within{box-shadow:0 0 0 3px var(--blue)}
.nls-topology-canvas .netsim-links{pointer-events:none}
.nls-topology-canvas [data-id]{cursor:pointer}
.nls-topology-canvas [data-link]{cursor:pointer}
.nls-topology-zoom{position:absolute;right:8px;bottom:8px;display:flex;gap:4px}
.nls-topology-zoom button{min-width:38px;height:38px;border-radius:8px;border:1px solid var(--line);background:var(--panel);color:var(--ink);font:inherit;font-weight:700;font-size:16px;cursor:pointer;padding:0 8px}
.nls-topology-zoom button.nls-topology-fit{font-size:13px;font-weight:600}
.nls-topology-empty{position:absolute;inset:0 0 50px 0;display:flex;align-items:center;justify-content:center;text-align:center;padding:20px;color:var(--muted);pointer-events:none;font-size:15px}
.nls-topology-empty[hidden]{display:none}
.nls-topology-field{margin:0 0 8px;min-width:0}
.nls-topology-field label{display:block;min-width:0}
.nls-topology-field label>span{display:block;font-size:13.5px;color:var(--muted);margin-bottom:2px}
.nls-topology-field input[type=text],.nls-topology-field select,.nls-topology-in{width:100%;min-width:0;background:var(--field);color:var(--ink);border:1px solid var(--line);border-radius:8px;padding:6px 9px;font-family:var(--nls-topology-mono);font-size:14.5px;min-height:38px}
.nls-topology-field select,.nls-topology-sel{font-family:inherit}
.nls-topology-sel{background:var(--field);color:var(--ink);border:1px solid var(--line);border-radius:8px;padding:6px 8px;font:inherit;font-size:14.5px;min-height:38px;max-width:100%;min-width:0}
.nls-topology-field input[aria-invalid="true"]{border-color:var(--bad);box-shadow:inset 0 0 0 1px var(--bad)}
.nls-topology-field .nls-topology-chk{min-height:32px}
.nls-topology-fmsg{font-size:13px;margin-top:2px;line-height:1.4}
.nls-topology-fmsg:empty{display:none}
.nls-topology-fmsg.nls-topology-m-bad{color:var(--bad)}
.nls-topology-fmsg.nls-topology-m-ok{color:var(--ok)}
.nls-topology-fmsg.nls-topology-m-info{color:var(--muted)}
.nls-topology-grid2{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:0 8px}
.nls-topology-grid3{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(0,1fr) minmax(0,1fr) auto;gap:0 6px;align-items:start}
.nls-topology-box{border:1px solid var(--line);border-radius:10px;padding:8px 10px;margin:0 0 8px;min-width:0}
.nls-topology-box>b{display:block;font-size:14px;margin-bottom:4px}
.nls-topology-eff{font-family:var(--nls-topology-mono);font-size:13px;background:var(--field);border:1px solid var(--line);border-radius:8px;padding:8px 10px;margin:0 0 8px;white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.5}
.nls-topology-conns{list-style:none;padding:0;margin:0 0 8px;font-size:14px}
.nls-topology-conns li{display:flex;flex-wrap:wrap;gap:6px;align-items:center;padding:5px 0;border-bottom:1px solid var(--line)}
.nls-topology-conns li span{flex:1 1 150px;min-width:0;overflow-wrap:anywhere}
.nls-topology-dot{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:4px;vertical-align:baseline}
.nls-topology-dot.nls-topology-up{background:var(--ok)}.nls-topology-dot.nls-topology-down{background:var(--bad)}
.nls-topology-probs{list-style:none;padding:0;margin:0;font-size:14px;max-height:320px;overflow:auto}
.nls-topology-probs li{margin:0 0 6px}
.nls-topology-probs button,.nls-topology-probs div{display:block;width:100%;text-align:left;background:var(--field);color:var(--ink);border:1px solid var(--line);border-left:4px solid var(--orange);border-radius:8px;padding:6px 9px;font:inherit;font-size:14px;line-height:1.45}
.nls-topology-probs .nls-topology-err{border-left-color:var(--bad)}
.nls-topology-probs b{font-size:12.5px;margin-right:4px}
.nls-topology-probs .nls-topology-err b{color:var(--bad)}.nls-topology-probs .nls-topology-warn b{color:var(--orange)}
.nls-topology-allok{color:var(--ok);font-weight:600;font-size:14.5px}
.nls-topology-pres{border-radius:8px;padding:8px 10px;margin:8px 0;font-size:14.5px;border:1px solid var(--line);background:var(--field)}
.nls-topology-pres.nls-topology-ok{border-color:var(--ok)}
.nls-topology-pres.nls-topology-no{border-color:var(--bad)}
.nls-topology-pres b{display:block}
.nls-topology-pres.nls-topology-ok b{color:var(--ok)}.nls-topology-pres.nls-topology-no b{color:var(--bad)}
.nls-topology-out{font-family:var(--nls-topology-mono);font-size:12.5px;line-height:1.45;background:var(--field);color:var(--ink);border:1px solid var(--line);border-radius:8px;padding:8px 10px;margin:0;overflow-x:auto;white-space:pre;max-width:100%}
.nls-topology-count{display:inline-block;min-width:1.6em;text-align:center;border-radius:10px;padding:0 6px;font-size:13px;margin-left:6px;background:var(--field);border:1px solid var(--line)}
.nls-topology-count.nls-topology-err{color:var(--bad);border-color:var(--bad)}
.nls-topology-note{font-size:13.5px;color:var(--muted);margin:6px 0 0}
.nls-topology-msg{font-size:14.5px;margin-top:8px}
.nls-topology-msg.nls-topology-bad{color:var(--bad)}
@container (min-width:620px){
  .nls-topology-palette{grid-template-columns:repeat(8,minmax(0,1fr))}
  .nls-topology-canvas{height:460px}
}
@container (min-width:900px){
  .nls-topology-work{grid-template-columns:minmax(0,1fr) 340px}
  .nls-topology-canvas{height:560px}
  .nls-topology-side{max-height:none}
}
.nls-topology-zoom button.nls-topology-reset{font-size:13px;font-weight:600}
.nls-topology-btn.nls-topology-fsbtn{border-color:var(--blue);color:var(--blue);background:var(--panel)}
.nls-topology-sheethead{display:none}
html.nls-topology-noscroll,html.nls-topology-noscroll body{overflow:hidden}
/* full-screen work area */
.nls-topology-stage.nls-topology-fs{position:fixed;inset:0;z-index:70;background:var(--bg);display:flex;flex-direction:column;margin:0;
  padding:max(8px,env(safe-area-inset-top)) max(8px,env(safe-area-inset-right)) max(8px,env(safe-area-inset-bottom)) max(8px,env(safe-area-inset-left));overflow:hidden}
.nls-topology-fs .nls-topology-toolbar{margin-bottom:6px;flex:none}
.nls-topology-fs .nls-topology-palette{margin-bottom:6px;flex:none}
.nls-topology-fs .nls-topology-status{margin:0 0 4px;flex:none;font-size:13.5px}
.nls-topology-fs .nls-topology-selbar{margin:0 0 6px;flex:none;flex-wrap:nowrap;min-height:0;padding:3px 6px}
.nls-topology-fs .nls-topology-selbar .nls-topology-grow{flex:1 1 auto;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.nls-topology-fs .nls-topology-selbar .nls-topology-btn{flex:none}
.nls-topology-fs .nls-topology-canvaswrap{flex:1 1 auto;min-height:0}
.nls-topology-stage.nls-topology-fs .nls-topology-canvas{height:100%}
.nls-topology-fs .nls-topology-fsbtn{order:-1;background:var(--blue);color:var(--panel)}
@media (orientation:landscape) and (max-height:520px){
  .nls-topology-stage.nls-topology-fs{display:grid;grid-template-columns:auto minmax(0,1fr);grid-template-rows:auto auto auto minmax(0,1fr);column-gap:8px}
  .nls-topology-fs .nls-topology-toolbar{grid-column:1/-1;flex-wrap:nowrap;overflow-x:auto;overscroll-behavior-x:contain;scrollbar-width:thin}
  .nls-topology-fs .nls-topology-toolbar>*{flex:none}
  .nls-topology-fs .nls-topology-palette{grid-column:1;grid-row:2/-1;grid-template-columns:repeat(2,60px);align-content:start;overflow-y:auto;margin:0;min-height:0}
  .nls-topology-fs .nls-topology-pbtn{min-height:50px}
  .nls-topology-fs .nls-topology-pbtn svg{width:34px;height:26px}
  .nls-topology-fs .nls-topology-pbtn span{font-size:11px}
  .nls-topology-fs .nls-topology-status{grid-column:2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .nls-topology-fs .nls-topology-selbar{grid-column:2;min-height:0;padding:2px 6px}
  .nls-topology-fs .nls-topology-canvaswrap{grid-column:2}
}
/* settings panel as bottom sheet (narrow screens) or side drawer (full screen on wide screens) */
.nls-topology-card.nls-topology-sheet{position:fixed;left:0;right:0;margin:0 auto;max-width:760px;bottom:max(var(--nl-bnav,0px),var(--nls-topology-kb,0px));z-index:39;
  border-radius:16px 16px 0 0;border-bottom:0;padding:0;display:flex;flex-direction:column;max-height:calc(var(--vvh,100dvh) * .7);box-shadow:0 -8px 28px rgba(0,0,0,.28)}
.nls-topology-card.nls-topology-sheet:not(.nls-topology-open){display:none}
.nls-topology-sheet.nls-topology-kbopen{max-height:calc(var(--vvh,100dvh) - 16px)}
.nls-topology-sheet.nls-topology-sheet-fs{z-index:71;bottom:var(--nls-topology-kb,0px);max-height:calc(var(--vvh,100dvh) * .55)}
.nls-topology-sheet.nls-topology-sheet-fs.nls-topology-kbopen{max-height:calc(var(--vvh,100dvh) - 16px)}
.nls-topology-stage.nls-topology-fs.nls-topology-siding{padding-right:calc(min(380px,48vw) + 8px)}
.nls-topology-fs.nls-topology-editing .nls-topology-palette,.nls-topology-fs.nls-topology-editing .nls-topology-status{display:none}
.nls-topology-card.nls-topology-sheet.nls-topology-sheet-side{left:auto;right:0;top:0;bottom:var(--nls-topology-kb,0px);width:min(380px,48vw);max-height:none;border-radius:16px 0 0 16px;border-bottom:1px solid var(--line);box-shadow:-8px 0 28px rgba(0,0,0,.28)}
.nls-topology-sheet .nls-topology-sheethead{display:flex;align-items:center;justify-content:flex-end;position:relative;flex:none;min-height:46px;padding:4px 8px;border-bottom:1px solid var(--line);touch-action:none;cursor:grab}
.nls-topology-sheethead i{position:absolute;left:50%;top:7px;width:44px;height:5px;margin-left:-22px;border-radius:3px;background:var(--muted);opacity:.55}
.nls-topology-sheethead b{position:absolute;left:14px;top:50%;transform:translateY(-50%);font-size:14px;color:var(--muted);font-weight:600}
.nls-topology-sheet-side .nls-topology-sheethead i{display:none}
.nls-topology-sheet .nls-topology-propsbody{overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;flex:1 1 auto;min-height:0;padding:10px 14px calc(16px + env(safe-area-inset-bottom))}
@media (max-width:760px){
  .nls-topology-missions{display:flex;flex-wrap:nowrap;overflow-x:auto;overscroll-behavior-x:contain;scroll-snap-type:x proximity;gap:8px;padding:2px 2px 6px;position:relative;scrollbar-width:thin}
  .nls-topology-mbtn{flex:0 0 auto;width:min(210px,62vw);scroll-snap-align:start;padding:6px 10px;min-height:48px}
  .nls-topology-mbtn b{font-size:13.5px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;max-width:100%}
  .nls-topology-mbtn span{font-size:12px}
  .nls-topology-canvas{height:min(60vh,520px);min-height:260px}
  /* fixed heights so the canvas does not jump under the finger while the status text changes */
  .nls-topology-status{font-size:13.5px;line-height:1.45;height:2.9em;min-height:0;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
  .nls-topology-selbar{flex-wrap:nowrap;height:52px;min-height:0;padding:3px 6px}
  .nls-topology-selbar .nls-topology-grow{flex:1 1 auto;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .nls-topology-selbar .nls-topology-btn{flex:none;padding:3px 8px}
}
@media (pointer:coarse){
  .nls-topology-canvas{height:min(60vh,520px);min-height:260px}
  .nls-topology-btn,.nls-topology-btn.nls-topology-small{min-height:44px}
  .nls-topology-btn.nls-topology-small{min-width:44px}
  .nls-topology-toolbar .nls-topology-btn{min-width:44px;padding:6px 11px}
  .nls-topology-chk{min-height:44px}
  .nls-topology-pbtn{min-height:56px}
  .nls-topology-zoom{gap:6px}
  .nls-topology-zoom button{min-width:44px;height:44px;font-size:20px}
  .nls-topology-zoom button.nls-topology-fit,.nls-topology-zoom button.nls-topology-reset{font-size:13px}
  .nls-topology-mbtn{min-height:48px}
  .nls-topology-field input[type=text],.nls-topology-field select,.nls-topology-in,.nls-topology-sel{min-height:44px;font-size:16px}
}
@media (prefers-reduced-motion:no-preference){
  .nls-topology-sheet.nls-topology-open{animation:nls-topology-up .18s ease-out}
  @keyframes nls-topology-up{from{transform:translateY(24px);opacity:.6}to{transform:none;opacity:1}}
}
`;

  const TYPES = [
    { type: 'pc', label: 'PC' }, { type: 'laptop', label: 'Laptop' }, { type: 'server', label: 'Server' },
    { type: 'printer', label: 'Printer' }, { type: 'switch', label: 'Switch' }, { type: 'router', label: 'Router' },
    { type: 'ap', label: 'Access Point' }, { type: 'internet', label: 'Internet' }
  ];
  const TYPE_TH = {
    pc: 'คอมพิวเตอร์ (PC)', laptop: 'โน้ตบุ๊ก (Laptop)', server: 'เครื่องแม่ข่าย (Server)', printer: 'เครื่องพิมพ์ (Printer)',
    switch: 'สวิตช์ (Switch)', router: 'เราเตอร์ (Router)', ap: 'จุดกระจาย Wi-Fi (Access Point)', internet: 'อินเทอร์เน็ต / ISP'
  };
  const ID_PREFIX = { pc: 'pc', laptop: 'laptop', server: 'srv', printer: 'prn', switch: 'sw', router: 'r', ap: 'ap', internet: 'net' };
  const NAME_PREFIX = { pc: 'PC', laptop: 'Laptop', server: 'Server', printer: 'Printer', switch: 'Switch', router: 'Router', ap: 'AP', internet: 'Internet' };
  const HOST = { pc: 1, laptop: 1, server: 1, printer: 1 };
  const LEVEL_TH = { easy: 'ง่าย', medium: 'ปานกลาง', hard: 'ยาก' };
  const MEDIUM_TH = { utp: 'UTP', fiber: 'ไฟเบอร์', wifi: 'Wi-Fi' };
  const LINK_REASON_TH = {
    ok: 'ใช้งานได้', down: 'สายถูกถอด/ขาด', iface_down: 'Adapter ถูกปิด', ssid: 'SSID ไม่ตรงกับ AP',
    wifi_wrong_end: 'Wi-Fi ต่อผิดปลาย', port_in_use: 'พอร์ตซ้ำ', bad_link: 'สายต่อผิด'
  };
  const TOOL_HELP = {
    select: 'ลากอุปกรณ์เพื่อย้าย • คลิกอุปกรณ์หรือสายเพื่อตั้งค่า • ลากพื้นที่ว่างเพื่อเลื่อนมุมมอง',
    utp: 'สาย UTP: คลิกอุปกรณ์ต้นทาง แล้วคลิกอุปกรณ์ปลายทาง (ระบบเลือกพอร์ตว่างให้)',
    fiber: 'สายไฟเบอร์: คลิกอุปกรณ์ต้นทาง แล้วคลิกอุปกรณ์ปลายทาง (ระบบเลือกพอร์ตว่างให้)',
    wifi: 'Wi-Fi: คลิกเครื่องลูกข่าย (เช่น Laptop) แล้วคลิก Access Point',
    ping: 'ส่ง Ping: คลิกเครื่องต้นทาง แล้วคลิกเครื่องปลายทาง (หรือกรอกในแผง "ส่ง Ping")'
  };

  let uid = 0;
  const isObj = (x) => !!x && typeof x === 'object' && !Array.isArray(x);
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const esc = (s) => String(s === undefined || s === null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const natCmp = (a, b) => String(a).localeCompare(String(b), 'en', { numeric: true });

  // make sure a device has the fields the editor expects
  function ensureDev(d) {
    if (!isObj(d)) return null;
    d.id = String(d.id || ''); d.type = String(d.type || 'pc');
    if (!NAME_PREFIX[d.type]) d.type = 'pc';
    d.name = String(d.name || d.id);
    d.x = Number.isFinite(+d.x) ? +d.x : 200; d.y = Number.isFinite(+d.y) ? +d.y : 200;
    if (HOST[d.type]) {
      if (!Array.isArray(d.ifaces) || !d.ifaces.length || !isObj(d.ifaces[0])) d.ifaces = [{ name: d.type === 'laptop' ? 'wlan0' : 'eth0', ip: '', prefix: '' }];
      d.ifaces = d.ifaces.slice(0, 1);
      const f = d.ifaces[0]; if (f.ip === undefined) f.ip = ''; if (f.prefix === undefined) f.prefix = f.mask !== undefined ? f.mask : ''; delete f.mask;
      if (typeof d.gateway !== 'string') d.gateway = '';
      if (!Array.isArray(d.dns)) d.dns = typeof d.dns === 'string' && d.dns ? d.dns.split(/[\s,;]+/) : [];
      d.dhcp = d.dhcp === true;
      if (!isObj(d.services)) d.services = {};
      if (d.type === 'laptop' && d.ssid === undefined) d.ssid = '';
    } else if (d.type === 'router') {
      if (!Array.isArray(d.ifaces)) d.ifaces = [];
      for (let i = 0; i < 4; i++) if (!isObj(d.ifaces[i])) d.ifaces[i] = { name: 'g0/' + i, ip: '', prefix: '' };
      d.ifaces.forEach((f, i) => { if (!f.name) f.name = 'g0/' + i; if (f.ip === undefined) f.ip = ''; if (f.prefix === undefined) f.prefix = ''; });
      if (!Array.isArray(d.routes)) d.routes = [];
    } else if (d.type === 'internet') {
      if (!Array.isArray(d.ifaces) || !d.ifaces.length) d.ifaces = [{ name: 'wan', ip: '100.64.0.1', prefix: 30 }];
      if (!isObj(d.hosts)) d.hosts = { '8.8.8.8': 'dns.google', '1.1.1.1': 'one.one.one.one', '203.0.113.80': 'www.netlab.test' };
    } else if (d.type === 'ap') {
      if (typeof d.ssid !== 'string') d.ssid = 'NETLAB';
      if (!d.security) d.security = 'WPA2';
      d.ports = 1;
    } else if (d.type === 'switch') {
      const n = Math.floor(+d.ports); d.ports = Number.isFinite(n) && n >= 1 && n <= 96 ? n : 24;
    }
    return d;
  }
  function ensureTopo(t) {
    const o = isObj(t) ? t : {};
    const devices = (Array.isArray(o.devices) ? o.devices : []).slice(0, MAX_DEV).map(ensureDev).filter((d) => d && d.id);
    const ids = new Set(devices.map((d) => d.id));
    const links = (Array.isArray(o.links) ? o.links : []).slice(0, MAX_LINK).filter((l) => isObj(l) && isObj(l.a) && isObj(l.b) && ids.has(l.a.dev) && ids.has(l.b.dev))
      .map((l) => ({ id: String(l.id || ''), a: { dev: l.a.dev, port: String(l.a.port || '') }, b: { dev: l.b.dev, port: String(l.b.port || '') }, medium: l.medium || 'utp', up: l.up !== false }));
    links.forEach((l, i) => { if (!l.id) l.id = 'l' + (i + 1); });
    return { devices, links };
  }
  function validTopo(t) {
    return isObj(t) && Array.isArray(t.devices) && Array.isArray(t.links) && t.devices.length <= MAX_DEV && t.links.length <= MAX_LINK;
  }

  function mount(root, ctx) {
    ctx = ctx || {};
    const NS = window.NetSim;
    const IPH = NS.ip;
    const missions = Array.isArray(ctx.missions) ? ctx.missions : [];
    const best = {};
    Object.keys(ctx.done || {}).forEach((k) => { best[k] = Object.assign({}, ctx.done[k]); });
    const U = ++uid;
    const gridId = 'nls-topology-grid-' + U, dlId = 'nls-topology-dl-' + U, ssidDl = 'nls-topology-ssid-' + U;
    const reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

    if (!document.getElementById('nls-topology-css')) {
      const st = document.createElement('style'); st.id = 'nls-topology-css'; st.textContent = CSS; document.head.appendChild(st);
    }

    const S = {
      cur: 'free', works: {}, topo: { devices: [], links: [] }, net: null,
      sel: null, tool: 'select', pending: null, armed: null,
      vb: { x: 0, y: 0, w: 1200, h: 600 }, undo: [], redo: [],
      hints: {}, results: {}, showPorts: true, busy: false,
      pingPath: null, pingSrc: '', status: '', statusBad: false,
      fs: false, sheet: false, home: null
    };
    let destroyed = false, rafDraw = 0, rafAnim = 0, ro = null, drag = null, pd = null;
    const timers = [];
    const listeners = [];
    const on = (el, ev, fn, opt) => { el.addEventListener(ev, fn, opt); listeners.push([el, ev, fn, opt]); };
    const missionById = (id) => missions.find((m) => m.id === id) || null;
    const startOf = (id) => { const m = missionById(id); return ensureTopo(m && m.start ? clone(m.start) : { devices: [], links: [] }); };
    const devById = (id) => S.topo.devices.find((d) => d.id === id) || null;
    const linkById = (id) => S.topo.links.find((l) => l.id === id) || null;

    // ------------------------------------------------------------ draft
    function loadDraft() {
      let d = null;
      try { d = JSON.parse(window.localStorage.getItem(DRAFT_KEY) || 'null'); } catch (e) { d = null; }
      if (d && d.v === 1 && isObj(d.works)) {
        Object.keys(d.works).forEach((k) => { if ((k === 'free' || missionById(k)) && validTopo(d.works[k])) S.works[k] = ensureTopo(d.works[k]); });
        if (d.cur === 'free' || missionById(d.cur)) S.cur = d.cur;
        if (isObj(d.hints)) Object.keys(d.hints).forEach((k) => { const n = Math.floor(+d.hints[k]); if (n > 0 && n < 20) S.hints[k] = n; });
        return true;
      }
      return false;
    }
    function saveDraft() {
      try {
        const s = JSON.stringify({ v: 1, cur: S.cur, works: S.works, hints: S.hints });
        if (s.length < 2000000) window.localStorage.setItem(DRAFT_KEY, s);
      } catch (e) { /* storage full or blocked: ignore */ }
    }
    if (!loadDraft()) S.cur = missions.length ? missions[0].id : 'free';
    S.topo = S.works[S.cur] || startOf(S.cur);
    S.works[S.cur] = S.topo;

    // ------------------------------------------------------------ static DOM
    const icons = {};
    TYPES.forEach((t) => { icons[t.type] = iconSvg(t.type); });
    function iconSvg(type) {
      try {
        const str = NS.render({ devices: [{ id: 'x', type, name: 'x', x: 0, y: 0 }], links: [] }, { showIp: false });
        const doc = new DOMParser().parseFromString(str, 'image/svg+xml');
        const el = doc.documentElement;
        el.querySelectorAll('text,title').forEach((n) => n.remove());
        el.setAttribute('viewBox', type === 'switch' ? '-36 -30 72 60' : '-32 -28 64 56');
        ['width', 'height', 'style', 'role', 'aria-label'].forEach((a) => el.removeAttribute(a));
        el.setAttribute('aria-hidden', 'true'); el.setAttribute('focusable', 'false');
        return new XMLSerializer().serializeToString(el);
      } catch (e) { return ''; }
    }

    root.innerHTML = `
<div class="nls-topology">
  <h2>จำลองการออกแบบเครือข่าย</h2>
  <p class="nls-topology-muted">วางอุปกรณ์ ต่อสาย ตั้งค่า IP แล้วทดสอบด้วย Ping เหมือนทำในห้องแล็บจริง ระบบจำลองคำนวณผลจากการตั้งค่าของคุณจริง ๆ</p>
  <details class="nls-topology-card nls-topology-howto"><summary>คำแนะนำการใช้งาน</summary><ol>
    <li>เลือกภารกิจด้านล่าง (หรือ <b>โหมดอิสระ</b>) แล้วอ่านโจทย์ให้เข้าใจ</li>
    <li><b>วางอุปกรณ์:</b> ลากปุ่มอุปกรณ์มาวางบนพื้นที่วาด หรือแตะปุ่มอุปกรณ์หนึ่งครั้งแล้วแตะตำแหน่งที่ต้องการ (แตะปุ่มซ้ำหรือกด Enter เพื่อวางกลางจอ)</li>
    <li><b>ต่อสาย:</b> เลือก "สาย UTP" "ไฟเบอร์" หรือ "Wi-Fi" แล้วคลิกอุปกรณ์ต้นทางและปลายทาง ระบบเลือกพอร์ตว่างให้และแสดงชื่อพอร์ตบนสาย</li>
    <li><b>ตั้งค่า:</b> เลือกเครื่องมือ "เลือก/ย้าย" แล้วคลิกอุปกรณ์ แก้ค่าในแผง "ตั้งค่าอุปกรณ์" (IP, Subnet mask, Gateway, DNS …) คลิกสายเพื่อถอด/เสียบหรือลบ</li>
    <li><b>ตรวจสอบ:</b> ดูแผง "ปัญหาที่พบ" แล้วทดสอบด้วย "ส่ง Ping" ระบบจะแสดงผลแบบ Command Prompt และบอกสาเหตุเป็นภาษาไทย</li>
    <li>กด <b>ตรวจงาน</b> เพื่อรับคะแนนและคำอธิบาย งานบันทึกอัตโนมัติในเครื่องนี้ ย้อนกลับ/ทำซ้ำได้ (Ctrl+Z / Ctrl+Y)</li>
    <li>ลากพื้นที่ว่างเพื่อเลื่อนมุมมอง ใช้ปุ่ม + / − / พอดีจอ เพื่อซูม เมื่อเลือกอุปกรณ์แล้วกดลูกศรเพื่อขยับ หรือ Delete เพื่อลบ</li>
  </ol></details>
  <div class="nls-topology-missions" data-r="missions"></div>
  <section class="nls-topology-card" data-r="mission" aria-live="polite"></section>
  <div class="nls-topology-work">
    <div class="nls-topology-stage" data-r="stage" aria-label="พื้นที่ทำงาน">
      <div class="nls-topology-toolbar" role="toolbar" aria-label="เครื่องมือ">
        <button type="button" class="nls-topology-btn nls-topology-ghost" data-tool="select">เลือก/ย้าย</button>
        <button type="button" class="nls-topology-btn nls-topology-ghost" data-tool="utp">สาย UTP</button>
        <button type="button" class="nls-topology-btn nls-topology-ghost" data-tool="fiber">ไฟเบอร์</button>
        <button type="button" class="nls-topology-btn nls-topology-ghost" data-tool="wifi">Wi-Fi</button>
        <button type="button" class="nls-topology-btn nls-topology-ghost" data-tool="ping">ส่ง Ping</button>
        <span class="nls-topology-sep" aria-hidden="true"></span>
        <button type="button" class="nls-topology-btn nls-topology-ghost" data-act="undo" title="Ctrl+Z">ย้อนกลับ</button>
        <button type="button" class="nls-topology-btn nls-topology-ghost" data-act="redo" title="Ctrl+Y">ทำซ้ำ</button>
        <label class="nls-topology-chk"><input type="checkbox" data-act="ports" checked> แสดงชื่อพอร์ต</label>
        <button type="button" class="nls-topology-btn nls-topology-fsbtn" data-act="fs" aria-pressed="false">เต็มจอ</button>
      </div>
      <div class="nls-topology-palette" data-r="palette" aria-label="อุปกรณ์ (ลากมาวาง หรือแตะแล้วแตะบนพื้นที่วาด)">
        ${TYPES.map((t) => `<button type="button" class="nls-topology-pbtn" data-type="${t.type}" aria-pressed="false" title="${esc(TYPE_TH[t.type])}">${icons[t.type]}<span>${esc(t.label)}</span></button>`).join('')}
      </div>
      <div class="nls-topology-status" data-r="status" role="status" aria-live="polite"></div>
      <div class="nls-topology-selbar" data-r="selbar"></div>
      <div class="nls-topology-canvaswrap">
        <svg class="nls-topology-canvas" data-r="svg" tabindex="0" role="application" aria-label="พื้นที่วาดแผนผังเครือข่าย (เลือกอุปกรณ์แล้วกดลูกศรเพื่อขยับ, Delete เพื่อลบ)" xmlns="http://www.w3.org/2000/svg">
          <defs><pattern id="${gridId}" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="var(--line)" stroke-width="1" opacity="0.6"/></pattern></defs>
          <rect x="-20000" y="-20000" width="40000" height="40000" fill="url(#${gridId})" data-r="bg"/>
          <g data-r="hits"></g><g data-r="netl"></g><g data-r="over"></g><g data-r="anim"></g>
        </svg>
        <div class="nls-topology-empty" data-r="empty">ยังไม่มีอุปกรณ์ — ลากอุปกรณ์จากแถบด้านบนมาวางที่นี่<br>หรือแตะปุ่มอุปกรณ์แล้วแตะบนพื้นที่นี้</div>
        <div class="nls-topology-zoom">
          <button type="button" data-act="zin" aria-label="ซูมเข้า">+</button>
          <button type="button" data-act="zout" aria-label="ซูมออก">−</button>
          <button type="button" class="nls-topology-fit" data-act="fit" title="ซูมให้เห็นอุปกรณ์ทั้งหมด">พอดีจอ</button>
          <button type="button" class="nls-topology-reset" data-act="vreset" title="กลับไปมุมมองเริ่มต้นของแผนผังนี้">รีเซ็ตมุมมอง</button>
        </div>
      </div>
    </div>
    <div class="nls-topology-side">
      <section class="nls-topology-card nls-topology-props" data-r="sheet" aria-label="ตั้งค่าอุปกรณ์">
        <div class="nls-topology-sheethead" data-r="sheethead"><i aria-hidden="true"></i><b>ตั้งค่า</b><button type="button" class="nls-topology-btn nls-topology-ghost nls-topology-small" data-act="sheet-close">ปิด</button></div>
        <div class="nls-topology-propsbody" data-r="props"></div>
      </section>
      <section class="nls-topology-card" data-r="ping">
        <h3>ส่ง Ping</h3>
        <div class="nls-topology-field"><label><span>เครื่องต้นทาง</span><select data-p="src"></select></label></div>
        <div class="nls-topology-field"><label><span>ปลายทาง (IP หรือชื่อ เช่น 192.168.1.11, srv.lab.local)</span><input type="text" data-p="dst" list="${dlId}" autocomplete="off" spellcheck="false"></label></div>
        <datalist id="${dlId}"></datalist><datalist id="${ssidDl}"></datalist>
        <button type="button" class="nls-topology-btn nls-topology-go" data-act="ping">ส่ง Ping</button>
        <div data-r="pres" aria-live="polite"></div>
      </section>
      <section class="nls-topology-card" data-r="probs"></section>
    </div>
  </div>
</div>`;

    const q = (sel) => root.querySelector(sel);
    const el = {
      missions: q('[data-r=missions]'), mission: q('[data-r=mission]'), palette: q('[data-r=palette]'), status: q('[data-r=status]'),
      selbar: q('[data-r=selbar]'), svg: q('[data-r=svg]'), hits: q('[data-r=hits]'), netl: q('[data-r=netl]'), over: q('[data-r=over]'),
      anim: q('[data-r=anim]'), empty: q('[data-r=empty]'), props: q('[data-r=props]'), ping: q('[data-r=ping]'), probs: q('[data-r=probs]'),
      pSrc: q('[data-p=src]'), pDst: q('[data-p=dst]'), pres: q('[data-r=pres]'), dl: root.querySelector('#' + dlId), ssidDl: root.querySelector('#' + ssidDl),
      stage: q('[data-r=stage]'), sheet: q('[data-r=sheet]'), sheethead: q('[data-r=sheethead]'), wrap: root.firstElementChild, fsBtn: q('[data-act=fs]')
    };
    const svg = el.svg;
    const SVGNS = 'http://www.w3.org/2000/svg';

    // ------------------------------------------------------------ undo / commit
    const snap = () => JSON.stringify(S.topo);
    function setTopo(t) { S.topo = t; S.works[S.cur] = t; }
    function commit(fn) {
      const before = snap();
      fn();
      if (snap() === before) { refreshLight(); return false; }
      pushUndo(before);
      return true;
    }
    function pushUndo(before) {
      S.undo.push(before); if (S.undo.length > MAX_UNDO) S.undo.shift();
      S.redo = [];
      afterChange();
    }
    function afterChange() {
      S.works[S.cur] = S.topo;
      S.pingPath = null;
      saveDraft();
      refreshLight();
    }
    function undo() {
      if (!S.undo.length) return;
      S.redo.push(snap()); setTopo(JSON.parse(S.undo.pop()));
      fixSel(); afterChange(); buildProps(); setStatus('ย้อนกลับแล้ว');
    }
    function redo() {
      if (!S.redo.length) return;
      S.undo.push(snap()); setTopo(JSON.parse(S.redo.pop()));
      fixSel(); afterChange(); buildProps(); setStatus('ทำซ้ำแล้ว');
    }
    function fixSel() {
      if (S.sel && S.sel.kind === 'dev' && !devById(S.sel.id)) S.sel = null;
      if (S.sel && S.sel.kind === 'link' && !linkById(S.sel.id)) S.sel = null;
      if (S.pending && !devById(S.pending)) S.pending = null;
    }

    // ------------------------------------------------------------ status
    function setStatus(text, bad) { S.status = text || ''; S.statusBad = !!bad; renderStatus(); }
    function renderStatus() {
      let t = S.status;
      if (!t) {
        if (S.armed) t = `แตะ/คลิกบนพื้นที่วาดเพื่อวาง ${NAME_PREFIX[S.armed]} (แตะปุ่มเดิมอีกครั้งเพื่อวางกลางจอ)`;
        else if (S.pending && S.tool === 'ping') t = `ต้นทาง: ${(devById(S.pending) || {}).name} — คลิกเครื่องปลายทาง (คลิกที่ว่างเพื่อยกเลิก)`;
        else if (S.pending) t = `ต้นทาง: ${(devById(S.pending) || {}).name} — คลิกอุปกรณ์ปลายทาง (คลิกที่ว่างเพื่อยกเลิก)`;
        else t = TOOL_HELP[S.tool];
      }
      el.status.textContent = t;
      el.status.classList.toggle('nls-topology-bad', !!S.status && S.statusBad);
    }

    // ------------------------------------------------------------ view box
    function applyVB() {
      const cw = svg.clientWidth || 800, ch = svg.clientHeight || 400;
      S.vb.h = S.vb.w * ch / cw;
      svg.setAttribute('viewBox', `${S.vb.x.toFixed(1)} ${S.vb.y.toFixed(1)} ${S.vb.w.toFixed(1)} ${S.vb.h.toFixed(1)}`);
    }
    function zoom(f) {
      const cx = S.vb.x + S.vb.w / 2, cy = S.vb.y + S.vb.h / 2;
      const w = Math.max(320, Math.min(4800, S.vb.w * f));
      const h = S.vb.h * w / S.vb.w;
      S.vb.w = w; S.vb.x = cx - w / 2; S.vb.y = cy - h / 2; applyVB();
    }
    function fit() {
      const ds = S.topo.devices;
      const cw = svg.clientWidth || 800, ch = svg.clientHeight || 400, ar = cw / ch;
      if (!ds.length) { S.vb.w = Math.max(640, Math.min(1200, cw * 1.3)); S.vb.x = 0; S.vb.y = 0; applyVB(); return; }
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      ds.forEach((d) => { x0 = Math.min(x0, d.x); y0 = Math.min(y0, d.y); x1 = Math.max(x1, d.x); y1 = Math.max(y1, d.y); });
      const padX = cw < 500 ? 70 : 110;
      x0 -= padX; x1 += padX; y0 -= 60; y1 += 100;
      const w = Math.max(x1 - x0, (y1 - y0) * ar, cw < 500 ? 380 : 520);
      const h = w / ar;
      S.vb.w = w; S.vb.x = (x0 + x1) / 2 - w / 2; S.vb.y = (y0 + y1) / 2 - h / 2; applyVB();
    }
    // the default view of the current topology (set when a mission/topology is opened); "รีเซ็ตมุมมอง" returns here
    function homeView() { fit(); S.home = { cx: S.vb.x + S.vb.w / 2, cy: S.vb.y + S.vb.h / 2, w: S.vb.w }; }
    function resetView() {
      if (!S.home) { homeView(); return; }
      S.vb.w = S.home.w; applyVB();
      S.vb.x = S.home.cx - S.vb.w / 2; S.vb.y = S.home.cy - S.vb.h / 2; applyVB();
    }
    // keep the centre of the view when the canvas changes size (full screen, rotation)
    // ...and keep the zoom level when its width changes (side drawer in full screen, rotation)
    let lastCH = 0, lastCW = 0;
    function resized() {
      const ch = svg.clientHeight || 0, cw = svg.clientWidth || 0;
      const cx = S.vb.x + S.vb.w / 2, cy = S.vb.y + S.vb.h / 2;
      if (lastCW && cw && Math.abs(cw - lastCW) > 1) { S.vb.w = S.vb.w * cw / lastCW; S.vb.x = cx - S.vb.w / 2; }
      applyVB();
      if (lastCH && ch && Math.abs(ch - lastCH) > 1) { S.vb.y = cy - S.vb.h / 2; applyVB(); }
      if (ch) lastCH = ch;
      if (cw) lastCW = cw;
    }
    function svgPt(e) {
      const m = svg.getScreenCTM(); if (!m) return { x: 0, y: 0 };
      const p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY;
      const r = p.matrixTransform(m.inverse()); return { x: r.x, y: r.y };
    }

    // ------------------------------------------------------------ drawing
    function scheduleDraw() { if (!rafDraw) rafDraw = requestAnimationFrame(() => { rafDraw = 0; if (!destroyed) draw(); }); }
    function mk(tag, attrs) { const n = document.createElementNS(SVGNS, tag); Object.keys(attrs).forEach((k) => n.setAttribute(k, attrs[k])); return n; }
    function draw() {
      const net = NS.create(S.topo); S.net = net;
      const pos = new Map(S.topo.devices.map((d) => [d.id, d]));
      // link hit areas (below the drawing) + selection glow
      el.hits.replaceChildren();
      if (S.pingPath && S.pingPath.ids.length > 1) {
        const pts = S.pingPath.ids.map((id) => pos.get(id)).filter(Boolean).map((d) => d.x + ',' + d.y).join(' ');
        el.hits.appendChild(mk('polyline', { points: pts, fill: 'none', stroke: S.pingPath.ok ? 'var(--ok)' : 'var(--bad)', 'stroke-width': '9', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: '0.35' }));
      }
      S.topo.links.forEach((l) => {
        const a = pos.get(l.a.dev), b = pos.get(l.b.dev); if (!a || !b) return;
        if (S.sel && S.sel.kind === 'link' && S.sel.id === l.id) el.hits.appendChild(mk('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, stroke: 'var(--orange)', 'stroke-width': '12', 'stroke-linecap': 'round', opacity: '0.45' }));
        const hit = mk('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, stroke: 'transparent', 'stroke-width': '18', 'data-link': l.id });
        const t = mk('title', {}); t.textContent = `สาย ${l.id}: ${a.name} ${l.a.port} — ${b.name} ${l.b.port}`; hit.appendChild(t);
        el.hits.appendChild(hit);
      });
      // engine drawing
      el.netl.replaceChildren();
      if (S.topo.devices.length) {
        const hl = [];
        if (S.sel && S.sel.kind === 'dev') hl.push(S.sel.id);
        if (S.pending) hl.push(S.pending);
        try {
          const str = NS.render(net, { showIp: true, showPorts: S.showPorts, highlight: hl, title: 'แผนผังเครือข่าย' });
          const doc = new DOMParser().parseFromString(str, 'image/svg+xml');
          const node = doc.documentElement;
          const vb = (node.getAttribute('viewBox') || '0 0 0 0').split(/\s+/);
          node.setAttribute('x', vb[0]); node.setAttribute('y', vb[1]);
          node.setAttribute('overflow', 'visible');
          ['style', 'role', 'aria-label'].forEach((a) => node.removeAttribute(a));
          const t = node.querySelector(':scope > title'); if (t) t.remove();
          el.netl.appendChild(document.importNode(node, true));
        } catch (e) { /* render failure: keep the canvas empty */ }
      }
      el.empty.hidden = S.topo.devices.length > 0;
      svg.classList.toggle('nls-topology-placing', !!S.armed);
      svg.classList.toggle('nls-topology-wiring', S.tool !== 'select');
    }
    function drawRubber(pt) {
      el.over.replaceChildren();
      const a = S.pending && devById(S.pending);
      if (!a || !pt) return;
      el.over.appendChild(mk('line', { x1: a.x, y1: a.y, x2: pt.x, y2: pt.y, stroke: S.tool === 'ping' ? 'var(--green)' : 'var(--blue)', 'stroke-width': '2.5', 'stroke-dasharray': '6 5', 'pointer-events': 'none' }));
    }

    // ------------------------------------------------------------ device / link editing
    function nextId(prefix, used) { let n = 1; while (used.has(prefix + n)) n++; return prefix + n; }
    function newDevice(type, x, y) {
      const ids = new Set(S.topo.devices.map((d) => d.id));
      const names = new Set(S.topo.devices.map((d) => d.name));
      const id = nextId(ID_PREFIX[type], ids);
      let n = 1; while (names.has(NAME_PREFIX[type] + n)) n++;
      const name = type === 'internet' && !names.has('Internet') ? 'Internet' : NAME_PREFIX[type] + n;
      const d = { id, type, name, x: Math.round(x), y: Math.round(y) };
      if (type === 'switch') d.ports = 24;
      if (type === 'ap') { d.ssid = 'NETLAB'; d.security = 'WPA2'; d.ports = 1; }
      return ensureDev(d);
    }
    function placeDevice(type, x, y) {
      if (S.topo.devices.length >= MAX_DEV) { setStatus(`วางอุปกรณ์ได้สูงสุด ${MAX_DEV} ชิ้น`, true); return; }
      const d = newDevice(type, Math.max(-1500, Math.min(5000, x)), Math.max(-1500, Math.min(4000, y)));
      commit(() => { S.topo.devices.push(d); });
      S.sel = { kind: 'dev', id: d.id };
      setStatus(`วาง ${d.name} แล้ว — ตั้งค่าได้ที่แผง "ตั้งค่าอุปกรณ์"`);
      refreshLight(); buildProps();
    }
    function placeCenter(type) {
      let x = S.vb.x + S.vb.w / 2, y = S.vb.y + S.vb.h / 2;
      for (let k = 0; k < 40 && S.topo.devices.some((d) => Math.hypot(d.x - x, d.y - y) < 70); k++) { x += 90; if (k % 4 === 3) { x -= 360; y += 90; } }
      placeDevice(type, x, y);
    }
    function usedPorts(id) {
      const s = new Set();
      S.topo.links.forEach((l) => { if (l.a.dev === id) s.add(l.a.port); if (l.b.dev === id) s.add(l.b.port); });
      return s;
    }
    // -> { port } or { err }
    function freePort(d, medium) {
      const used = usedPorts(d.id);
      if (HOST[d.type]) {
        if (used.size) return { err: `${d.name} มีพอร์ตเครือข่ายพอร์ตเดียวและต่ออยู่แล้ว (ลบสายเดิมก่อน)` };
        return { port: medium === 'wifi' ? 'wlan0' : 'eth0' };
      }
      if (d.type === 'switch' || d.type === 'ap') {
        if (d.type === 'ap' && medium === 'wifi') return { port: 'wifi' };
        for (let i = 1; i <= (d.ports || 24); i++) if (!used.has('p' + i)) return { port: 'p' + i };
        return { err: d.type === 'ap' ? `${d.name} มีพอร์ต LAN พอร์ตเดียวและต่ออยู่แล้ว` : `พอร์ตของ ${d.name} เต็มแล้ว (${d.ports} พอร์ต)` };
      }
      const f = (d.ifaces || []).find((x) => !used.has(x.name));
      if (f) return { port: f.name };
      return { err: d.type === 'router' ? `${d.name} ใช้ครบทุกขา (interface) แล้ว` : `${d.name} ต่อสายได้เส้นเดียว` };
    }
    function connect(aId, bId, medium) {
      const A = devById(aId), B = devById(bId);
      if (!A || !B || A === B) return false;
      if (S.topo.links.length >= MAX_LINK) { setStatus(`ต่อสายได้สูงสุด ${MAX_LINK} เส้น`, true); return false; }
      if (medium === 'wifi') {
        const ok = (HOST[A.type] && B.type === 'ap') || (HOST[B.type] && A.type === 'ap');
        if (!ok) { setStatus('Wi-Fi ต่อได้เฉพาะระหว่างเครื่องลูกข่าย (PC/Laptop/Server/Printer) กับ Access Point', true); return false; }
      }
      if (S.topo.links.some((l) => (l.a.dev === aId && l.b.dev === bId) || (l.a.dev === bId && l.b.dev === aId))) {
        setStatus(`${A.name} กับ ${B.name} มีสายเชื่อมกันอยู่แล้ว`, true); return false;
      }
      const pa = freePort(A, medium), pb = freePort(B, medium);
      if (pa.err || pb.err) { setStatus(pa.err || pb.err, true); return false; }
      const lid = nextId('l', new Set(S.topo.links.map((l) => l.id)));
      commit(() => {
        [[A, pa.port], [B, pb.port]].forEach(([d, p]) => { if (HOST[d.type]) d.ifaces[0].name = p; });
        S.topo.links.push({ id: lid, a: { dev: A.id, port: pa.port }, b: { dev: B.id, port: pb.port }, medium, up: true });
      });
      const st = S.net && S.net.linkState(lid);
      const extra = st && !st.active ? ` — แต่ยังใช้งานไม่ได้: ${LINK_REASON_TH[st.reason] || st.reason}` : '';
      setStatus(`ต่อสาย ${MEDIUM_TH[medium]}: ${A.name} (${pa.port}) ↔ ${B.name} (${pb.port})${extra}`, !!extra);
      return true;
    }
    function deleteDevice(id) {
      const d = devById(id); if (!d) return;
      commit(() => {
        S.topo.devices = S.topo.devices.filter((x) => x.id !== id);
        S.topo.links = S.topo.links.filter((l) => l.a.dev !== id && l.b.dev !== id);
      });
      if (S.sel && S.sel.id === id) S.sel = null;
      if (S.pending === id) S.pending = null;
      setStatus(`ลบ ${d.name} แล้ว (กด "ย้อนกลับ" เพื่อเอาคืน)`);
      refreshLight(); buildProps();
    }
    function deleteLink(id) {
      const l = linkById(id); if (!l) return;
      commit(() => { S.topo.links = S.topo.links.filter((x) => x.id !== id); });
      if (S.sel && S.sel.kind === 'link' && S.sel.id === id) S.sel = null;
      setStatus(`ลบสาย ${id} แล้ว`);
      refreshLight(); buildProps();
    }
    function toggleLink(id) {
      const l = linkById(id); if (!l) return;
      commit(() => { l.up = l.up === false; });
      setStatus(l.up ? `เสียบสาย ${id} กลับแล้ว` : `ถอดสาย ${id} แล้ว (จำลองสายหลุด/ขาด)`);
      buildProps();
    }
    // openSheet: on narrow screens / full screen the settings panel is a sheet; open it for an explicit selection
    function select(sel, openSheet) {
      S.sel = sel;
      if (sel) S.status = '';
      if (!sel) S.sheet = false;
      else if (openSheet !== false) S.sheet = true;
      refreshLight(); buildProps();
    }
    function linkText(l) {
      const a = devById(l.a.dev), b = devById(l.b.dev);
      return `${a ? a.name : l.a.dev} ${l.a.port} ↔ ${b ? b.name : l.b.dev} ${l.b.port}`;
    }
    function linkStateOf(id) { return (S.net && S.net.linkState(id)) || { active: false, reason: 'bad_link' }; }

    // ------------------------------------------------------------ canvas pointer handling
    // Mouse/pen: actions happen on pointerdown (as before). Touch: actions run on a tap (pointerup without moving),
    // one finger on empty space pans, one finger on a device (tool เลือก/ย้าย) moves it, two fingers pinch-zoom + pan.
    const ptrs = new Map();
    let pinch = null, gestureLock = false;
    const isTouch = (e) => e.pointerType === 'touch';
    function hitOf(e) {
      const dEl = e.target.closest ? e.target.closest('[data-id]') : null;
      const lEl = e.target.closest ? e.target.closest('[data-link]') : null;
      return { devId: dEl && el.netl.contains(dEl) ? dEl.getAttribute('data-id') : null, linkId: lEl ? lEl.getAttribute('data-link') : null };
    }
    function startPinch() {
      // a pinch never moves or selects a device: undo whatever the first finger started
      if (drag) {
        const g = drag; drag = null;
        if (g.mode === 'move') {
          const d = devById(g.id);
          if (g.moved && d) { d.x = g.ox; d.y = g.oy; }
          if (g.selected) { S.sel = g.prevSel; S.sheet = g.prevSheet; refreshLight(); buildProps(); } else scheduleDraw();
        }
      }
      svg.classList.remove('nls-topology-panning');
      const [a, b] = Array.from(ptrs.entries()).slice(0, 2);
      const r = svg.getBoundingClientRect();
      pinch = { ids: [a[0], b[0]], d0: Math.max(10, Math.hypot(a[1].x - b[1].x, a[1].y - b[1].y)), mx: (a[1].x + b[1].x) / 2 - r.left, my: (a[1].y + b[1].y) / 2 - r.top,
        vx: S.vb.x, vy: S.vb.y, vw: S.vb.w, left: r.left, top: r.top };
    }
    function movePinch() {
      const a = ptrs.get(pinch.ids[0]), b = ptrs.get(pinch.ids[1]);
      if (!a || !b) return;
      const cw = svg.clientWidth || 1;
      const d = Math.max(10, Math.hypot(a.x - b.x, a.y - b.y));
      const mx = (a.x + b.x) / 2 - pinch.left, my = (a.y + b.y) / 2 - pinch.top;
      const w = Math.max(320, Math.min(4800, pinch.vw * pinch.d0 / d)); // same limits as zoom()
      const wx = pinch.vx + pinch.mx * pinch.vw / cw, wy = pinch.vy + pinch.my * pinch.vw / cw; // world point under the start midpoint
      S.vb.w = w; S.vb.x = wx - mx * w / cw; S.vb.y = wy - my * w / cw; applyVB();
    }
    on(svg, 'pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      try { svg.focus({ preventScroll: true }); } catch (err) { /* old browsers */ }
      const touch = isTouch(e);
      if (touch) {
        e.preventDefault();
        ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
        try { svg.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
        if (ptrs.size >= 2) { if (!pinch && ptrs.size === 2) startPinch(); return; }
        if (gestureLock) return;
      }
      const pt = svgPt(e);
      const hit = hitOf(e), devId = hit.devId, linkId = hit.linkId;
      if (touch) {
        if (devId && S.tool === 'select' && !S.armed) {
          const d = devById(devId);
          drag = { mode: 'move', touch: true, id: devId, pid: e.pointerId, sx: pt.x, sy: pt.y, ox: d.x, oy: d.y, cx: e.clientX, cy: e.clientY, before: snap(), moved: false, selected: false, prevSel: S.sel, prevSheet: S.sheet };
          return;
        }
        let tap = null;
        if (S.armed) { const t = S.armed; tap = () => { S.armed = null; updatePalette(); placeDevice(t, pt.x, pt.y); }; }
        else if (devId) tap = () => { if (S.tool === 'ping') pingClick(devId); else cableClick(devId); };
        else if (linkId) tap = () => select({ kind: 'link', id: linkId });
        drag = { mode: 'pan', touch: true, pid: e.pointerId, cx: e.clientX, cy: e.clientY, vx: S.vb.x, vy: S.vb.y, moved: false, tap };
        return;
      }
      if (S.armed) {
        const t = S.armed; S.armed = null; updatePalette();
        placeDevice(t, pt.x, pt.y); e.preventDefault(); return;
      }
      if (devId) {
        e.preventDefault();
        if (S.tool === 'select') {
          const d = devById(devId);
          if (!S.sel || S.sel.id !== devId) select({ kind: 'dev', id: devId }, false);
          drag = { mode: 'move', id: devId, pid: e.pointerId, sx: pt.x, sy: pt.y, ox: d.x, oy: d.y, before: snap(), moved: false };
          try { svg.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
        } else if (S.tool === 'ping') pingClick(devId);
        else cableClick(devId);
        return;
      }
      if (linkId) { e.preventDefault(); select({ kind: 'link', id: linkId }); return; }
      drag = { mode: 'pan', pid: e.pointerId, cx: e.clientX, cy: e.clientY, vx: S.vb.x, vy: S.vb.y, moved: false };
      try { svg.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    });
    on(svg, 'pointermove', (e) => {
      if (ptrs.has(e.pointerId)) ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch) { if (pinch.ids.includes(e.pointerId)) { e.preventDefault(); movePinch(); } return; }
      if (drag && e.pointerId === drag.pid) {
        if (drag.mode === 'move') {
          const pt = svgPt(e);
          const dx = pt.x - drag.sx, dy = pt.y - drag.sy;
          if (!drag.moved) {
            if (drag.touch ? Math.hypot(e.clientX - drag.cx, e.clientY - drag.cy) < 8 : Math.hypot(dx, dy) < 4) return;
            if (drag.touch && !drag.selected) {
              drag.selected = true;
              if (!S.sel || S.sel.id !== drag.id) select({ kind: 'dev', id: drag.id }, false);
            }
          }
          drag.moved = true;
          const d = devById(drag.id); if (!d) return;
          d.x = Math.round(Math.max(-1500, Math.min(5000, drag.ox + dx)));
          d.y = Math.round(Math.max(-1500, Math.min(4000, drag.oy + dy)));
          scheduleDraw();
        } else {
          const sc = S.vb.w / (svg.clientWidth || 1);
          const dx = e.clientX - drag.cx, dy = e.clientY - drag.cy;
          if (!drag.moved && Math.hypot(dx, dy) < (drag.touch ? 8 : 4)) return;
          drag.moved = true; svg.classList.add('nls-topology-panning');
          S.vb.x = drag.vx - dx * sc; S.vb.y = drag.vy - dy * sc; applyVB();
        }
      } else if (S.pending && !isTouch(e)) drawRubber(svgPt(e));
    });
    function endDrag(e, cancel) {
      if (e && ptrs.has(e.pointerId)) {
        ptrs.delete(e.pointerId);
        if (pinch) {
          if (pinch.ids.includes(e.pointerId)) { pinch = null; gestureLock = ptrs.size > 0; }
          return;
        }
        if (gestureLock) { if (!ptrs.size) gestureLock = false; return; }
      }
      if (!drag || (e && e.pointerId !== drag.pid)) return;
      const g = drag; drag = null;
      svg.classList.remove('nls-topology-panning');
      if (g.mode === 'move' && g.moved) {
        if (cancel) { const d = devById(g.id); if (d) { d.x = g.ox; d.y = g.oy; } scheduleDraw(); return; }
        pushUndo(g.before);
      } else if (g.mode === 'move' && !cancel) {
        // a tap/click on a device: select it and open the settings sheet
        if (g.touch) select({ kind: 'dev', id: g.id });
        else { S.sheet = true; renderSheet(); }
      } else if (g.mode === 'pan' && !g.moved && !cancel) {
        if (g.tap) g.tap();
        else if (S.pending) { S.pending = null; el.over.replaceChildren(); setStatus(''); draw(); }
        else if (S.sel) select(null);
      }
    }
    on(svg, 'pointerup', (e) => endDrag(e, false));
    on(svg, 'pointercancel', (e) => endDrag(e, true));
    // a tap that opens the settings sheet must not produce a "ghost" click on whatever the sheet now shows under the finger
    // (touchstart, not touchend: the touched device node is redrawn on pointerup, so touchend would not reach the svg)
    on(svg, 'touchstart', (e) => { if (e.cancelable) e.preventDefault(); }, { passive: false });
    on(svg, 'wheel', (e) => { if (!e.ctrlKey) return; e.preventDefault(); zoom(e.deltaY > 0 ? 1.15 : 1 / 1.15); }, { passive: false });
    on(svg, 'keydown', (e) => {
      const d = S.sel && S.sel.kind === 'dev' ? devById(S.sel.id) : null;
      const step = e.shiftKey ? 5 : 20;
      const mv = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
      if (mv && d) { e.preventDefault(); commit(() => { d.x += mv[0]; d.y += mv[1]; }); return; }
      if (mv && !d) { e.preventDefault(); S.vb.x += mv[0] * 2; S.vb.y += mv[1] * 2; applyVB(); return; }
      if ((e.key === 'Delete' || e.key === 'Backspace') && S.sel) { e.preventDefault(); if (S.sel.kind === 'dev') deleteDevice(S.sel.id); else deleteLink(S.sel.id); return; }
      if (e.key === 'Escape') { S.pending = null; S.armed = null; updatePalette(); el.over.replaceChildren(); setTool('select'); }
      if (e.key === '+' || e.key === '=') zoom(1 / 1.2);
      if (e.key === '-') zoom(1.2);
    });

    function cableClick(id) {
      if (!S.pending) { S.pending = id; setStatus(''); draw(); return; }
      if (S.pending === id) { S.pending = null; el.over.replaceChildren(); setStatus(''); draw(); return; }
      const a = S.pending; S.pending = null; el.over.replaceChildren();
      if (!connect(a, id, S.tool)) draw();
    }
    function targetIpOf(d) {
      const c = S.net && S.net.config(d.id);
      if (!c) return null;
      if (c.ip) return c.ip;
      return null;
    }
    function pingClick(id) {
      const d = devById(id); if (!d) return;
      if (!S.pending) {
        if (!HOST[d.type] && d.type !== 'router') { setStatus(`${d.name} เป็นอุปกรณ์ที่ส่ง ping เองไม่ได้ เลือก PC/Laptop/Server/Router เป็นต้นทาง`, true); return; }
        S.pending = id; setStatus(''); draw(); return;
      }
      if (S.pending === id) { S.pending = null; el.over.replaceChildren(); setStatus(''); draw(); return; }
      const ip = targetIpOf(d);
      if (!ip) {
        setStatus(d.type === 'switch' || d.type === 'ap' ? `${d.name} ไม่มี IP ให้ ping (ทำงานชั้น 2 ส่งต่อเฟรมเท่านั้น) เลือกเครื่องอื่น` : `${d.name} ยังไม่มี IP address ที่ใช้งานได้`, true);
        return;
      }
      const src = S.pending; S.pending = null; el.over.replaceChildren();
      el.pSrc.value = src; el.pDst.value = ip; S.pingSrc = src;
      runPing(src, ip);
    }

    // ------------------------------------------------------------ palette
    el.palette.querySelectorAll('[data-type]').forEach((btn) => {
      const type = btn.getAttribute('data-type');
      on(btn, 'pointerdown', (e) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        e.preventDefault();
        pd = { type, pid: e.pointerId, x: e.clientX, y: e.clientY, ghost: null };
        try { btn.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      });
      on(btn, 'pointermove', (e) => {
        if (!pd || pd.pid !== e.pointerId) return;
        if (!pd.ghost && Math.hypot(e.clientX - pd.x, e.clientY - pd.y) > 6) {
          pd.ghost = document.createElement('div'); pd.ghost.className = 'nls-topology-ghost-dev';
          pd.ghost.innerHTML = icons[type]; root.firstElementChild.appendChild(pd.ghost);
        }
        if (pd.ghost) { pd.ghost.style.left = (e.clientX - 28) + 'px'; pd.ghost.style.top = (e.clientY - 23) + 'px'; }
      });
      on(btn, 'pointerup', (e) => {
        if (!pd || pd.pid !== e.pointerId) return;
        const p = pd; pd = null;
        btn.__ptrUp = performance.now(); // the click that follows a pointer tap must not also place the device
        if (p.ghost) {
          p.ghost.remove();
          const r = svg.getBoundingClientRect();
          if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) { const pt = svgPt(e); S.armed = null; updatePalette(); placeDevice(type, pt.x, pt.y); }
          else setStatus('ปล่อยนอกพื้นที่วาด จึงยกเลิกการวาง', true);
          return;
        }
        if (S.armed === type) { S.armed = null; updatePalette(); placeCenter(type); }
        else { S.armed = type; S.status = ''; updatePalette(); renderStatus(); draw(); }
      });
      on(btn, 'pointercancel', () => { if (pd && pd.ghost) pd.ghost.remove(); pd = null; });
      on(btn, 'click', (e) => { if (e.detail === 0 && !(btn.__ptrUp && performance.now() - btn.__ptrUp < 1000)) { S.armed = null; updatePalette(); placeCenter(type); } });
    });
    function updatePalette() {
      el.palette.querySelectorAll('[data-type]').forEach((b) => b.setAttribute('aria-pressed', String(b.getAttribute('data-type') === S.armed)));
      renderStatus();
      svg.classList.toggle('nls-topology-placing', !!S.armed);
    }

    // ------------------------------------------------------------ toolbar
    function setTool(t) {
      S.tool = t; S.pending = null; el.over.replaceChildren(); S.status = '';
      root.querySelectorAll('[data-tool]').forEach((b) => b.setAttribute('aria-pressed', String(b.getAttribute('data-tool') === t)));
      renderStatus(); draw();
    }
    root.querySelectorAll('[data-tool]').forEach((b) => on(b, 'click', () => setTool(b.getAttribute('data-tool'))));
    function updateToolbar() {
      q('[data-act=undo]').disabled = !S.undo.length;
      q('[data-act=redo]').disabled = !S.redo.length;
    }
    on(root, 'click', (e) => {
      const b = e.target.closest ? e.target.closest('[data-act]') : null;
      if (!b || !root.contains(b)) return;
      const act = b.getAttribute('data-act');
      if (act === 'undo') undo();
      else if (act === 'redo') redo();
      else if (act === 'zin') zoom(1 / 1.25);
      else if (act === 'zout') zoom(1.25);
      else if (act === 'fit') fit();
      else if (act === 'vreset') resetView();
      else if (act === 'fs') setFs(!S.fs);
      else if (act === 'sheet-close') select(null);
      else if (act === 'ping') { S.pingSrc = el.pSrc.value; runPing(el.pSrc.value, el.pDst.value); }
      else if (act === 'sel-del') { if (S.sel && S.sel.kind === 'dev') deleteDevice(S.sel.id); else if (S.sel) deleteLink(S.sel.id); }
      else if (act === 'sel-toggle') { if (S.sel && S.sel.kind === 'link') toggleLink(S.sel.id); }
      else if (act === 'sel-edit' && sheetMode()) { S.sheet = true; renderSheet(); }
      else if (act === 'sel-edit') { const f = el.props.querySelector('input,select'); el.props.scrollIntoView({ block: 'start', behavior: reduceMotion ? 'auto' : 'smooth' }); if (f) f.focus({ preventScroll: true }); }
      else if (act === 'sel-none') select(null);
    });
    on(q('[data-act=ports]'), 'change', (e) => { S.showPorts = e.target.checked; draw(); });
    on(root, 'keydown', (e) => {
      const tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'select' || tag === 'textarea') return;
      if ((e.ctrlKey || e.metaKey) && !e.altKey) {
        const k = e.key.toLowerCase();
        if (k === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
        else if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); redo(); }
      }
    });

    // ------------------------------------------------------------ full screen work area + settings sheet
    const mqNarrow = window.matchMedia ? window.matchMedia('(max-width:760px)') : null;
    const mqCoarse = window.matchMedia ? window.matchMedia('(pointer:coarse)') : null;
    const isNarrow = () => !!(mqNarrow && mqNarrow.matches);
    // null = normal card beside/below the canvas, 'bottom' = bottom sheet, 'side' = drawer at the right (full screen, wide)
    function sheetMode() { return isNarrow() ? 'bottom' : S.fs ? 'side' : null; }
    function renderSheet() {
      const mode = sheetMode();
      const sh = el.sheet;
      if (!S.sel) S.sheet = false;
      const open = !!mode && S.sheet && !!S.sel;
      sh.classList.toggle('nls-topology-sheet', !!mode);
      sh.classList.toggle('nls-topology-sheet-side', mode === 'side');
      sh.classList.toggle('nls-topology-sheet-fs', !!mode && S.fs);
      sh.classList.toggle('nls-topology-open', open);
      if (mode) { sh.setAttribute('role', 'dialog'); sh.setAttribute('aria-modal', 'false'); } else { sh.removeAttribute('role'); sh.removeAttribute('aria-modal'); }
      sh.style.transform = '';
      if (!open && autoPan) {
        // sheet closed: give back the view the student had, unless they panned/zoomed meanwhile
        const a = autoPan; autoPan = null;
        if (Math.abs(S.vb.x - a.vb.x) < 0.5 && Math.abs(S.vb.y - a.vb.y) < 0.5 && Math.abs(S.vb.w - a.vb.w) < 0.5) { S.vb.x -= a.dx; S.vb.y -= a.dy; applyVB(); }
      }
      el.stage.classList.toggle('nls-topology-siding', open && mode === 'side');
      const editing = open && mode === 'bottom';
      if (editing !== el.stage.classList.contains('nls-topology-editing')) {
        // full screen hides the palette while the sheet is open; keep the drawing still on screen while the canvas grows/shrinks
        const t0 = svg.getBoundingClientRect().top;
        el.stage.classList.toggle('nls-topology-editing', editing);
        if (S.fs) {
          const t1 = svg.getBoundingClientRect().top, k = (svg.clientWidth || 1) / S.vb.w;
          S.vb.y += (t1 - t0) / k; applyVB(); lastCH = svg.clientHeight || lastCH;
        }
      }
      const key = open ? S.sel.kind + ':' + S.sel.id : '';
      if (open && key !== sheetKey) {
        if (mode === 'bottom') requestAnimationFrame(() => { if (!destroyed) showSelAboveSheet(); });
        else requestAnimationFrame(() => requestAnimationFrame(() => { if (!destroyed) showSelAboveSheet(); })); // after the canvas got narrower
      }
      sheetKey = key;
    }
    let sheetKey = '';
    // bottom sheet just opened: make sure the canvas and the selected item stay visible above the sheet
    function showSelAboveSheet() {
      if (!el.sheet.classList.contains('nls-topology-open')) return;
      const sr = el.sheet.getBoundingClientRect();
      let topBar = 0;
      if (!S.fs) {
        // height of a sticky/fixed app header at the top of the screen, if any
        let n = document.elementFromPoint(window.innerWidth / 2, 2);
        while (n && n !== document.body && n !== document.documentElement) {
          const p = getComputedStyle(n).position;
          if (p === 'fixed' || p === 'sticky') { topBar = Math.max(0, n.getBoundingClientRect().bottom); break; }
          n = n.parentElement;
        }
        const cr = svg.getBoundingClientRect();
        const room = sr.top - topBar;
        // scroll so the canvas starts just under the header (only when it is mostly hidden)
        if (cr.top < topBar - 4 || cr.top > topBar + Math.max(40, room * 0.35)) window.scrollBy(0, cr.top - topBar - 6);
      }
      const cr = svg.getBoundingClientRect();
      const side = el.sheet.classList.contains('nls-topology-sheet-side');
      const top = Math.max(cr.top, topBar) + 10, bot = (side ? cr.bottom : Math.min(cr.bottom, sr.top)) - 10;
      if (bot - top < 40) return;
      let wx = null, wy = null;
      if (S.sel.kind === 'dev') { const d = devById(S.sel.id); if (d) { wx = d.x; wy = d.y; } }
      else { const l = linkById(S.sel.id); const a = l && devById(l.a.dev), b = l && devById(l.b.dev); if (a && b) { wx = (a.x + b.x) / 2; wy = (a.y + b.y) / 2; } }
      if (wx === null) return;
      const k = (svg.clientWidth || 1) / S.vb.w;
      const sx = cr.left + (wx - S.vb.x) * k, sy = cr.top + (wy - S.vb.y) * k;
      if (sy >= top + 20 && sy <= bot - 20 && sx >= cr.left + 20 && sx <= cr.right - 20) return;
      const wantY = (top + bot) / 2;
      const dy = (sy - wantY) / k, dx = (sx < cr.left + 20 || sx > cr.right - 20) ? (sx - (cr.left + cr.right) / 2) / k : 0;
      S.vb.y += dy; S.vb.x += dx; applyVB();
      autoPan = autoPan ? { dx: autoPan.dx + dx, dy: autoPan.dy + dy, vb: Object.assign({}, S.vb) } : { dx, dy, vb: Object.assign({}, S.vb) };
    }
    let autoPan = null;
    let fsScroll = 0;
    function setFs(v) {
      v = !!v;
      if (v === S.fs) return;
      if (v) { fsScroll = window.scrollY || 0; if (!isNarrow()) S.sheet = false; }
      S.fs = v;
      el.stage.classList.toggle('nls-topology-fs', v);
      document.documentElement.classList.toggle('nls-topology-noscroll', v);
      el.stage.setAttribute('role', v ? 'dialog' : 'region');
      if (v) el.stage.setAttribute('aria-modal', 'true'); else el.stage.removeAttribute('aria-modal');
      el.fsBtn.textContent = v ? 'ออกจากเต็มจอ' : 'เต็มจอ';
      el.fsBtn.setAttribute('aria-pressed', String(v));
      renderSheet();
      if (!v) { try { window.scrollTo(0, fsScroll); } catch (e) { /* ignore */ } }
      try { el.fsBtn.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
    }
    on(document, 'keydown', (e) => { if (e.key === 'Escape' && S.fs) { e.preventDefault(); setFs(false); } });
    if (mqNarrow) {
      const mqFn = () => renderSheet();
      if (mqNarrow.addEventListener) on(mqNarrow, 'change', mqFn); else if (mqNarrow.addListener) { mqNarrow.addListener(mqFn); listeners.push([{ removeEventListener: (ev, fn) => mqNarrow.removeListener(fn) }, 'change', mqFn]); }
    }
    // swipe the sheet handle down to close it
    let shDrag = null;
    on(el.sheethead, 'pointerdown', (e) => {
      if (!el.sheet.classList.contains('nls-topology-sheet') || el.sheet.classList.contains('nls-topology-sheet-side')) return;
      if (e.target.closest('button')) return;
      shDrag = { pid: e.pointerId, y: e.clientY, dy: 0 };
      try { el.sheethead.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    });
    on(el.sheethead, 'pointermove', (e) => {
      if (!shDrag || shDrag.pid !== e.pointerId) return;
      shDrag.dy = Math.max(0, e.clientY - shDrag.y);
      el.sheet.style.transform = shDrag.dy ? `translateY(${shDrag.dy}px)` : '';
    });
    const shEnd = (e) => {
      if (!shDrag || shDrag.pid !== e.pointerId) return;
      const dy = shDrag.dy; shDrag = null;
      el.sheet.style.transform = '';
      if (dy > 70 && e.type === 'pointerup') select(null);
    };
    on(el.sheethead, 'pointerup', shEnd);
    on(el.sheethead, 'pointercancel', shEnd);
    // on-screen keyboard: keep the sheet above it and the focused field visible
    const vv = window.visualViewport || null;
    function onVV() {
      if (!vv) return;
      const kb = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
      el.wrap.style.setProperty('--vvh', Math.round(vv.height) + 'px');
      el.wrap.style.setProperty('--nls-topology-kb', kb + 'px');
      el.sheet.classList.toggle('nls-topology-kbopen', kb > 80);
      const a = document.activeElement;
      if (kb > 80 && a && el.sheet.contains(a) && a.matches('input[type=text],select')) keepVisible(a, 0);
    }
    let kvTimer = 0;
    function keepVisible(inp, delay) {
      if (kvTimer) clearTimeout(kvTimer);
      kvTimer = setTimeout(() => {
        kvTimer = 0;
        if (destroyed || document.activeElement !== inp) return;
        // only scroll when the field is (partly) hidden: by the keyboard, the screen edge or the sheet's own scroll box
        const r = inp.getBoundingClientRect();
        let top = vv ? vv.offsetTop : 0, bot = vv ? vv.offsetTop + vv.height : window.innerHeight;
        if (el.sheet.contains(inp) && el.sheet.classList.contains('nls-topology-sheet')) { const b = el.props.getBoundingClientRect(); top = Math.max(top, b.top); bot = Math.min(bot, b.bottom); }
        if (r.top >= top + 4 && r.bottom <= bot - 4) return;
        try { inp.scrollIntoView({ block: 'center', inline: 'nearest' }); } catch (e) { inp.scrollIntoView(); }
      }, delay);
      timers.push(kvTimer);
    }
    if (vv) { on(vv, 'resize', onVV); on(vv, 'scroll', onVV); onVV(); }
    on(root, 'focusin', (e) => {
      const t = e.target;
      if (!t.matches || !t.matches('input[type=text],input:not([type]),select')) return;
      if (!(sheetMode() || S.fs || (mqCoarse && mqCoarse.matches))) return; // desktop: unchanged behaviour
      keepVisible(t, 300);
    });

    // ------------------------------------------------------------ selection bar
    function renderSelbar() {
      let h = '';
      if (S.sel && S.sel.kind === 'dev') {
        const d = devById(S.sel.id);
        if (d) h = `<span class="nls-topology-grow">เลือก: <b>${esc(d.name)}</b> <span class="nls-topology-muted">${esc(TYPE_TH[d.type])}</span></span>
          <button type="button" class="nls-topology-btn nls-topology-ghost nls-topology-small" data-act="sel-edit">ตั้งค่า</button>
          <button type="button" class="nls-topology-btn nls-topology-danger nls-topology-small" data-act="sel-del">ลบอุปกรณ์</button>`;
      } else if (S.sel && S.sel.kind === 'link') {
        const l = linkById(S.sel.id);
        if (l) {
          const st = linkStateOf(l.id);
          h = `<span class="nls-topology-grow"><span class="nls-topology-dot ${st.active ? 'nls-topology-up' : 'nls-topology-down'}"></span>สาย ${esc(MEDIUM_TH[l.medium] || l.medium)}: <b>${esc(linkText(l))}</b> — ${esc(st.blocked ? 'ถูกปิดกันวงวน (STP)' : LINK_REASON_TH[st.reason] || st.reason)}</span>
            <button type="button" class="nls-topology-btn nls-topology-ghost nls-topology-small" data-act="sel-toggle">${l.up === false ? 'เสียบสาย' : 'ถอดสาย'}</button>
            <button type="button" class="nls-topology-btn nls-topology-danger nls-topology-small" data-act="sel-del">ลบสาย</button>`;
        }
      }
      if (!h) h = '<span class="nls-topology-grow nls-topology-muted">ยังไม่ได้เลือกอุปกรณ์หรือสาย</span>';
      else h += '<button type="button" class="nls-topology-btn nls-topology-ghost nls-topology-small" data-act="sel-none" aria-label="ยกเลิกการเลือก">✕</button>';
      if (el.selbar.__h !== h) { el.selbar.innerHTML = h; el.selbar.__h = h; }
    }

    // ------------------------------------------------------------ validation helpers
    const R = (cls, text) => ({ cls, text });
    const bad = (t) => R('bad', t), okm = (t) => R('ok', t), info = (t) => R('info', t);
    const pfxOf = (v) => (v === '' || v === null || v === undefined) ? null : IPH.toPrefix(typeof v === 'number' ? v : String(v));
    const maskDisp = (v) => { if (v === '' || v === null || v === undefined) return ''; const p = typeof v === 'number' ? v : (/^\/?\d{1,2}$/.test(String(v).trim()) ? IPH.toPrefix(String(v)) : null); return p !== null && p !== undefined ? (IPH.mask(p) || String(v)) : String(v); };
    const maskStore = (v) => { const s = String(v).trim(); if (!s) return ''; const p = IPH.toPrefix(s); return p !== null ? p : s; };
    function vIp(v, p, need) {
      v = String(v || '').trim();
      if (!v) return need ? bad(typeof need === 'string' ? need : 'ยังไม่ได้ใส่ IP address') : null;
      const n = IPH.parse(v);
      if (n === null) return bad('รูปแบบ IP ไม่ถูกต้อง: ต้องเป็นตัวเลข 4 ชุด (0–255) คั่นด้วยจุด เช่น 192.168.1.10');
      const o = n >>> 24;
      if (o === 0 || o === 127 || o >= 224) return bad('IP นี้ใช้ตั้งให้อุปกรณ์ไม่ได้ (เป็นที่อยู่สงวน / loopback / multicast)');
      if (p === null || p === undefined) return info('ใส่ Subnet mask ด้วย');
      if (p <= 30 && IPH.network(v, p) === IPH.str(n)) return bad(`เป็น Network address ของวง ${IPH.network(v, p)}/${p} ใช้ตั้งให้อุปกรณ์ไม่ได้`);
      if (p <= 30 && IPH.broadcast(v, p) === IPH.str(n)) return bad(`เป็น Broadcast address ของวง ${IPH.network(v, p)}/${p} ใช้ตั้งให้อุปกรณ์ไม่ได้`);
      return okm(`อยู่ในวงเครือข่าย ${IPH.network(v, p)}/${p}`);
    }
    function vMask(v, ip) {
      const s = String(v === undefined || v === null ? '' : v).trim();
      if (!s) return String(ip || '').trim() ? bad('ยังไม่ได้ใส่ Subnet mask') : null;
      const p = IPH.toPrefix(s);
      if (p === null) return bad('Subnet mask ไม่ถูกต้อง ใส่ได้ทั้ง 255.255.255.0, /24 หรือ 24 (บิต 1 ต้องเรียงติดกัน)');
      return info(`= /${p} ใช้กับอุปกรณ์ได้ ${IPH.hostsIn(p)} เครื่อง`);
    }
    function vGw(v, ip, p) {
      v = String(v || '').trim();
      if (!v) return info('ไม่ใส่ก็ได้ถ้าคุยกันเฉพาะในวงเดียวกัน (ออกนอกวงต้องมี gateway)');
      if (IPH.parse(v) === null) return bad('รูปแบบ IP ของ Gateway ไม่ถูกต้อง');
      if (ip && IPH.parse(ip) !== null && IPH.parse(ip) === IPH.parse(v)) return bad('ห้ามใช้ IP ของตัวเองเป็น Gateway ต้องเป็น IP ของ Router');
      if (ip && IPH.parse(ip) !== null && p !== null && !IPH.inSubnet(v, ip, p)) return bad(`Gateway ต้องอยู่วงเดียวกับ IP ของเครื่อง (วง ${IPH.network(ip, p)}/${p})`);
      return null;
    }
    function vDns(list) {
      const arr = Array.isArray(list) ? list : String(list || '').split(/[\s,;]+/).filter(Boolean);
      if (!arr.length) return info('ใส่ IP ของ DNS server (คั่นหลายตัวด้วยจุลภาค) เพื่อเรียกเครื่องด้วยชื่อ');
      const badOne = arr.find((x) => IPH.parse(x) === null);
      if (badOne) return bad(`"${badOne}" ไม่ใช่ IP address — DNS server ต้องใส่เป็น IP เช่น 192.168.1.5 หรือ 8.8.8.8`);
      return null;
    }
    const validName = (n) => /^[a-z0-9_]([a-z0-9_-]*[a-z0-9_])?(\.[a-z0-9_]([a-z0-9_-]*[a-z0-9_])?)*$/i.test(n);

    // ------------------------------------------------------------ property panel
    let reg = {};
    function fld(k, label, value, o) {
      o = o || {};
      reg[k] = { set: o.set, validate: o.validate, rebuild: o.rebuild };
      return `<div class="nls-topology-field"><label><span>${esc(label)}</span><input type="text" data-k="${k}" value="${esc(value)}"${o.ph ? ` placeholder="${esc(o.ph)}"` : ''}${o.list ? ` list="${o.list}"` : ''} autocomplete="off" spellcheck="false"${o.im ? ` inputmode="${o.im}"` : ''}></label><div class="nls-topology-fmsg" data-m="${k}"></div></div>`;
    }
    function chk(k, label, checked, o) {
      o = o || {};
      reg[k] = { set: o.set, rebuild: o.rebuild };
      return `<div class="nls-topology-field"><label class="nls-topology-chk"><input type="checkbox" data-k="${k}"${checked ? ' checked' : ''}> ${esc(label)}</label></div>`;
    }
    function sel(k, label, value, opts, o) {
      o = o || {};
      reg[k] = { set: o.set, rebuild: o.rebuild };
      return `<div class="nls-topology-field"><label><span>${esc(label)}</span><select data-k="${k}">${opts.map(([v, t]) => `<option value="${esc(v)}"${String(v) === String(value) ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select></label></div>`;
    }
    function buildProps(keepFocus) {
      const ae = document.activeElement;
      const focusKey = keepFocus !== false && ae && el.props.contains(ae) ? (ae.getAttribute('data-k') ? '[data-k="' + ae.getAttribute('data-k') + '"]' : ae.getAttribute('data-act') ? '[data-act="' + ae.getAttribute('data-act') + '"]' : null) : null;
      reg = {};
      const devs = S.topo.devices.slice().sort((a, b) => natCmp(a.name, b.name));
      const cur = S.sel && S.sel.kind === 'dev' ? devById(S.sel.id) : null;
      let h = `<h3>ตั้งค่าอุปกรณ์</h3><div class="nls-topology-field"><label><span>อุปกรณ์ที่เลือก</span><select class="nls-topology-sel" data-act="pick" style="width:100%"><option value="">— เลือกอุปกรณ์ —</option>${devs.map((d) => `<option value="${esc(d.id)}"${cur && cur.id === d.id ? ' selected' : ''}>${esc(d.name)} (${esc(NAME_PREFIX[d.type])})</option>`).join('')}</select></label></div>`;
      if (!cur) {
        if (S.sel && S.sel.kind === 'link' && linkById(S.sel.id)) {
          const l = linkById(S.sel.id), st = linkStateOf(l.id);
          h += `<div class="nls-topology-box"><b>สาย ${esc(l.id)} (${esc(MEDIUM_TH[l.medium] || l.medium)})</b><p>${esc(linkText(l))}</p><p><span class="nls-topology-dot ${st.active ? 'nls-topology-up' : 'nls-topology-down'}"></span>${esc(st.blocked ? 'ถูกปิดเพื่อกันวงวน (STP)' : LINK_REASON_TH[st.reason] || st.reason)}</p>
            <div class="nls-topology-row"><button type="button" class="nls-topology-btn nls-topology-ghost nls-topology-small" data-act="ltog" data-lid="${esc(l.id)}">${l.up === false ? 'เสียบสาย' : 'ถอดสาย'}</button><button type="button" class="nls-topology-btn nls-topology-danger nls-topology-small" data-act="ldel" data-lid="${esc(l.id)}">ลบสาย</button></div></div>`;
        } else h += '<p class="nls-topology-muted">คลิกอุปกรณ์บนพื้นที่วาด (เครื่องมือ "เลือก/ย้าย") หรือเลือกจากรายการด้านบน เพื่อแก้ค่า</p>';
        el.props.innerHTML = h;
        restoreFocus(focusKey);
        return;
      }
      const d = cur, id = d.id;
      const D = () => devById(id) || d;
      h += `<p class="nls-topology-muted">${esc(TYPE_TH[d.type])} • id: <code>${esc(d.id)}</code></p>`;
      h += fld('name', 'ชื่ออุปกรณ์', d.name, {
        set: (v) => { D().name = String(v).trim().slice(0, 40) || D().id; },
        validate: () => { const n = D().name; return S.topo.devices.some((x) => x !== D() && x.name === n) ? bad('ชื่อซ้ำกับอุปกรณ์อื่น ควรตั้งชื่อไม่ให้ซ้ำ') : null; }
      });
      if (HOST[d.type]) h += hostFields(d, D);
      else if (d.type === 'router') h += routerFields(d, D);
      else if (d.type === 'switch') {
        h += sel('ports', 'จำนวนพอร์ต', d.ports, [[8, '8 พอร์ต'], [16, '16 พอร์ต'], [24, '24 พอร์ต'], [48, '48 พอร์ต']], { set: (v) => { D().ports = +v; } });
        h += '<p class="nls-topology-note">Switch ทำงานชั้น 2 (Data link) ส่งต่อเฟรมตาม MAC address จึงไม่ต้องตั้ง IP</p>';
      } else if (d.type === 'ap') {
        h += fld('apssid', 'SSID (ชื่อเครือข่าย Wi-Fi)', d.ssid, { set: (v) => { D().ssid = String(v).trim().slice(0, 32); }, validate: () => D().ssid ? null : bad('ควรตั้ง SSID ให้เครื่องลูกข่ายเลือกเชื่อมต่อได้') });
        h += sel('sec', 'การเข้ารหัส', d.security, [['WPA2', 'WPA2'], ['WPA3', 'WPA3'], ['Open', 'ไม่เข้ารหัส (Open)']], { set: (v) => { D().security = v; } });
        h += '<p class="nls-topology-note">Access Point เชื่อม Wi-Fi เข้ากับเครือข่ายสาย ต้องต่อสาย UTP จากพอร์ต p1 เข้า Switch</p>';
      } else if (d.type === 'internet') {
        const f = d.ifaces[0];
        h += fld('wip', 'IP ฝั่ง ISP (wan)', f.ip, { set: (v) => { D().ifaces[0].ip = String(v).trim(); }, validate: () => vIp(D().ifaces[0].ip, pfxOf(D().ifaces[0].prefix), true), im: 'decimal' });
        h += fld('wmask', 'Subnet mask', maskDisp(f.prefix), { set: (v) => { D().ifaces[0].prefix = maskStore(v); }, validate: () => vMask(D().ifaces[0].prefix, D().ifaces[0].ip) });
        h += `<div class="nls-topology-box"><b>ปลายทางบนอินเทอร์เน็ตที่จำลองไว้</b><div class="nls-topology-eff">${Object.keys(d.hosts || {}).map((k) => esc(k + '  ' + d.hosts[k])).join('\n') || '-'}</div><p class="nls-topology-note">8.8.8.8 และ 1.1.1.1 เป็น DNS สาธารณะ ใช้แปลงชื่อเว็บบนอินเทอร์เน็ตได้</p></div>`;
      }
      h += connFields(d);
      h += `<button type="button" class="nls-topology-btn nls-topology-danger" data-act="ddel">ลบ ${esc(d.name)}</button>`;
      el.props.innerHTML = h;
      updateValidation(); updateEff();
      restoreFocus(focusKey);
    }
    function restoreFocus(key) {
      if (!key) return;
      const n = el.props.querySelector(key);
      if (n) { try { n.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
    }
    function hostFields(d, D) {
      const f = d.ifaces[0];
      const F = () => D().ifaces[0];
      let h = chk('up', 'เปิดใช้งาน Network adapter', f.up !== false, { set: (v) => { F().up = !!v; } });
      h += sel('mode', 'วิธีได้ IP address', d.dhcp ? 'dhcp' : 'static', [['static', 'กำหนดเอง (Static)'], ['dhcp', 'รับอัตโนมัติ (DHCP)']], { set: (v) => { D().dhcp = v === 'dhcp'; }, rebuild: true });
      if (!d.dhcp) {
        h += `<div class="nls-topology-grid2">${fld('ip', 'IP address', f.ip, { set: (v) => { F().ip = String(v).trim(); }, validate: () => vIp(F().ip, pfxOf(F().prefix), 'ยังไม่ได้ใส่ IP address'), ph: '192.168.1.10', im: 'decimal' })}
          ${fld('mask', 'Subnet mask', maskDisp(f.prefix), { set: (v) => { F().prefix = maskStore(v); }, validate: () => vMask(F().prefix, F().ip), ph: '255.255.255.0' })}</div>`;
        h += fld('gw', 'Default gateway', d.gateway, { set: (v) => { D().gateway = String(v).trim(); }, validate: () => vGw(D().gateway, F().ip, pfxOf(F().prefix)), ph: '192.168.1.1', im: 'decimal' });
        h += fld('dns', 'DNS server', (d.dns || []).join(', '), { set: (v) => { D().dns = String(v).split(/[\s,;]+/).filter(Boolean).slice(0, 4); }, validate: () => vDns(D().dns), ph: '192.168.1.5, 8.8.8.8' });
      } else h += '<p class="nls-topology-note">เครื่องจะขอ IP, Subnet mask, Gateway และ DNS จาก DHCP server ในวงเดียวกัน ถ้าไม่พบจะได้ 169.254.x.x (APIPA)</p>';
      const wifiLinked = S.topo.links.some((l) => l.medium === 'wifi' && (l.a.dev === d.id || l.b.dev === d.id));
      if (d.type === 'laptop' || wifiLinked || d.ssid) {
        h += fld('ssid', 'SSID ของ Wi-Fi ที่จะเชื่อมต่อ', d.ssid || '', {
          set: (v) => { D().ssid = String(v).trim().slice(0, 32); }, list: ssidDl, ph: 'ชื่อ Wi-Fi ของ AP',
          validate: () => {
            const v = D().ssid || ''; const aps = S.topo.devices.filter((x) => x.type === 'ap').map((x) => x.ssid);
            if (!v) return info(aps.length ? 'เลือก SSID ให้ตรงกับ Access Point: ' + aps.join(', ') : 'ยังไม่มี Access Point ในแผนผัง');
            return aps.includes(v) ? okm('ตรงกับ SSID ของ Access Point') : bad('ไม่ตรงกับ SSID ของ Access Point ใดในแผนผัง (ตัวพิมพ์เล็ก/ใหญ่มีผล)');
          }
        });
      }
      h += chk('icmp', 'ตอบกลับ Ping (อนุญาต ICMP ผ่านไฟร์วอลล์)', !(d.firewall && d.firewall.icmp === false), { set: (v) => { D().firewall = Object.assign({}, D().firewall || {}, { icmp: !!v }); } });
      h += '<div class="nls-topology-eff" data-r="eff"></div>';
      if (d.type === 'server') h += serviceFields(d, D);
      return h;
    }
    function serviceFields(d, D) {
      const sv = d.services || {};
      const pool = Array.isArray(sv.dhcp) ? sv.dhcp[0] : sv.dhcp;
      const P = () => { const s = D().services; return Array.isArray(s.dhcp) ? s.dhcp[0] : s.dhcp; };
      const srvIp = () => D().ifaces[0].ip, srvP = () => pfxOf(D().ifaces[0].prefix);
      const inSrv = (v) => { const p = srvP(); return !srvIp() || p === null || IPH.parse(srvIp()) === null || IPH.inSubnet(v, srvIp(), p); };
      let h = '<h4>บริการบน Server</h4>';
      h += `<div class="nls-topology-box">${chk('dhcpOn', 'เปิดบริการ DHCP (แจก IP อัตโนมัติ)', !!pool, {
        set: (v) => {
          const s = D().services;
          if (v) {
            const ip = srvIp(), p = srvP();
            const net = ip && p !== null && IPH.parse(ip) !== null ? IPH.network(ip, p) : null;
            const base = net ? net.split('.').slice(0, 3).join('.') : '192.168.1';
            s.dhcp = { start: base + '.100', end: base + '.150', prefix: p !== null ? p : 24, gateway: '', dns: [] };
          } else delete s.dhcp;
        }, rebuild: true })}`;
      if (pool) {
        const pv = (k) => () => { const v = String(P()[k] || '').trim(); if (!v) return bad('ต้องกรอก'); if (IPH.parse(v) === null) return bad('รูปแบบ IP ไม่ถูกต้อง'); if (!inSrv(v)) return bad('ต้องอยู่วงเดียวกับ IP ของ Server'); if (k === 'end' && IPH.parse(P().start) !== null && IPH.parse(v) < IPH.parse(P().start)) return bad('IP สิ้นสุดต้องมากกว่าหรือเท่ากับ IP เริ่มต้น'); return null; };
        h += `<div class="nls-topology-grid2">${fld('pstart', 'แจกตั้งแต่ IP', pool.start, { set: (v) => { P().start = String(v).trim(); }, validate: pv('start'), im: 'decimal' })}${fld('pend', 'ถึง IP', pool.end, { set: (v) => { P().end = String(v).trim(); }, validate: pv('end'), im: 'decimal' })}</div>`;
        h += fld('pmask', 'Subnet mask ที่แจก', maskDisp(pool.prefix), { set: (v) => { P().prefix = maskStore(v); }, validate: () => vMask(P().prefix, P().start) });
        h += fld('pgw', 'Default gateway ที่แจก (ถ้ามี Router)', pool.gateway || '', { set: (v) => { P().gateway = String(v).trim(); }, validate: () => { const v = String(P().gateway || '').trim(); if (!v) return info('เว้นว่างได้ถ้าไม่มี Router'); return IPH.parse(v) === null ? bad('รูปแบบ IP ไม่ถูกต้อง') : !inSrv(v) ? bad('ต้องอยู่วงเดียวกับ IP ของ Server') : null; }, im: 'decimal' });
        h += fld('pdns', 'DNS server ที่แจก', (pool.dns || []).join(', '), { set: (v) => { P().dns = String(v).split(/[\s,;]+/).filter(Boolean).slice(0, 4); }, validate: () => (P().dns || []).length ? vDns(P().dns) : info('เว้นว่างได้') });
      }
      h += '</div>';
      const dns = sv.dns;
      h += `<div class="nls-topology-box">${chk('dnsOn', 'เปิดบริการ DNS (แปลงชื่อเป็น IP)', !!dns, {
        set: (v) => { const s = D().services; if (v) s.dns = { records: {} }; else delete s.dns; }, rebuild: true })}`;
      if (dns) {
        const recs = Object.keys(dns.records || {});
        const RE = () => { const s = D().services; if (!isObj(s.dns.records)) s.dns.records = {}; return s.dns.records; };
        const rename = (i, v) => {
          const r = RE(), keys = Object.keys(r), name = String(v).trim().toLowerCase().slice(0, 80);
          if (keys.some((k, j) => j !== i && k === name)) { setStatus(`มีระเบียนชื่อ ${name} อยู่แล้ว`, true); return; }
          const out = {}; keys.forEach((k, j) => { out[j === i ? name : k] = r[k]; });
          D().services.dns.records = out;
        };
        h += '<p class="nls-topology-note">ระเบียน (record) ชนิด A: ชื่อ → IP address</p>';
        recs.forEach((k, i) => {
          h += `<div class="nls-topology-grid3">${fld('rn' + i, 'ชื่อ', k, { set: (v) => rename(i, v), validate: () => { const n = Object.keys(RE())[i]; return !n ? bad('ใส่ชื่อ เช่น srv.lab.local') : validName(n) ? null : bad('ชื่อไม่ถูกต้อง (ใช้ a-z 0-9 - และจุด)'); }, ph: 'srv.lab.local' })}
            ${fld('ri' + i, 'IP', dns.records[k], { set: (v) => { const r = RE(); r[Object.keys(r)[i]] = String(v).trim(); }, validate: () => { const v = RE()[Object.keys(RE())[i]]; return IPH.parse(v) === null ? bad('IP ไม่ถูกต้อง') : null; }, im: 'decimal' })}
            <div></div><div class="nls-topology-field"><label><span>&nbsp;</span><button type="button" class="nls-topology-btn nls-topology-danger nls-topology-small" data-act="rdel" data-i="${i}" aria-label="ลบระเบียน ${esc(k)}">ลบ</button></label></div></div>`;
        });
        if (!recs.length) h += '<p class="nls-topology-muted">ยังไม่มีระเบียน</p>';
        h += '<button type="button" class="nls-topology-btn nls-topology-ghost nls-topology-small" data-act="radd">+ เพิ่มระเบียน</button>';
        h += '<p class="nls-topology-note">ชื่อที่ไม่มีในระเบียน DNS server จะส่งต่อไปถามอินเทอร์เน็ต (ถ้า Server ออกอินเทอร์เน็ตได้)</p>';
      }
      h += '</div>';
      return h;
    }
    function routerFields(d, D) {
      let h = '<h4>Interface (ขาของ Router)</h4><p class="nls-topology-note">แต่ละขาต้องอยู่คนละวงเครือข่าย IP ของขาที่ต่อกับ LAN คือ Default gateway ของเครื่องในวงนั้น</p>';
      d.ifaces.forEach((f, i) => {
        const F = () => D().ifaces[i];
        const l = S.topo.links.find((x) => (x.a.dev === d.id && x.a.port === f.name) || (x.b.dev === d.id && x.b.port === f.name));
        const other = l ? devById(l.a.dev === d.id ? l.b.dev : l.a.dev) : null;
        h += `<div class="nls-topology-box"><b>${esc(f.name)} <span class="nls-topology-muted">${other ? '— ต่อกับ ' + esc(other.name) : '— ยังไม่ได้ต่อสาย'}</span></b>
          <div class="nls-topology-grid2">${fld('ifip' + i, 'IP address', f.ip, { set: (v) => { F().ip = String(v).trim(); }, validate: () => vIp(F().ip, pfxOf(F().prefix), l ? 'ขานี้ต่อสายอยู่ ควรตั้ง IP' : false), im: 'decimal' })}
          ${fld('ifmask' + i, 'Subnet mask', maskDisp(f.prefix), { set: (v) => { F().prefix = maskStore(v); }, validate: () => vMask(F().prefix, F().ip) })}</div>
          ${chk('ifup' + i, 'เปิดใช้งาน (no shutdown)', f.up !== false, { set: (v) => { F().up = !!v; } })}</div>`;
      });
      h += '<h4>Static route (เส้นทางที่กำหนดเอง)</h4>';
      d.routes.forEach((r, i) => {
        const Rt = () => D().routes[i];
        h += `<div class="nls-topology-grid3">${fld('rtn' + i, 'Network ปลายทาง', r.net, { set: (v) => { Rt().net = String(v).trim(); }, validate: () => { const rr = Rt(); const p = pfxOf(rr.prefix); if (IPH.parse(rr.net) === null) return bad('IP ไม่ถูกต้อง'); if (p !== null && IPH.network(rr.net, p) !== IPH.str(IPH.parse(rr.net))) return bad(`ต้องเป็น Network address (${IPH.network(rr.net, p)})`); return rr.net === '0.0.0.0' && p === 0 ? info('Default route') : null; }, im: 'decimal' })}
          ${fld('rtm' + i, 'Mask', maskDisp(r.prefix), { set: (v) => { Rt().prefix = maskStore(v); }, validate: () => pfxOf(Rt().prefix) === null ? bad('Mask ไม่ถูกต้อง') : null })}
          ${fld('rtv' + i, 'Next hop', r.via || '', { set: (v) => { Rt().via = String(v).trim(); }, validate: () => IPH.parse(Rt().via) === null ? bad('ใส่ IP ของ Router ถัดไป') : null, im: 'decimal' })}
          <div class="nls-topology-field"><label><span>&nbsp;</span><button type="button" class="nls-topology-btn nls-topology-danger nls-topology-small" data-act="rtdel" data-i="${i}" aria-label="ลบเส้นทางที่ ${i + 1}">ลบ</button></label></div></div>`;
      });
      if (!d.routes.length) h += '<p class="nls-topology-muted">ยังไม่มี static route (Router รู้จักเฉพาะวงที่ต่อตรง)</p>';
      h += `<div class="nls-topology-row" style="margin-bottom:8px"><button type="button" class="nls-topology-btn nls-topology-ghost nls-topology-small" data-act="rtadd">+ เพิ่มเส้นทาง</button><button type="button" class="nls-topology-btn nls-topology-ghost nls-topology-small" data-act="rtdef">+ Default route (0.0.0.0/0)</button></div>`;
      h += '<b style="font-size:14px">ตารางเส้นทางที่ใช้งานจริง (show ip route)</b><div class="nls-topology-eff" data-r="eff"></div>';
      return h;
    }
    function connFields(d) {
      const ls = S.topo.links.filter((l) => l.a.dev === d.id || l.b.dev === d.id);
      let h = '<h4>การเชื่อมต่อ</h4>';
      if (ls.length) {
        h += '<ul class="nls-topology-conns">' + ls.map((l) => {
          const mine = l.a.dev === d.id ? l.a : l.b, oth = l.a.dev === d.id ? l.b : l.a;
          const od = devById(oth.dev), st = linkStateOf(l.id);
          return `<li><span><span class="nls-topology-dot ${st.active ? 'nls-topology-up' : 'nls-topology-down'}"></span>${esc(mine.port)} ↔ ${esc(od ? od.name : oth.dev)} ${esc(oth.port)} (${esc(MEDIUM_TH[l.medium] || l.medium)}) — ${esc(st.blocked ? 'ปิดกันวงวน' : LINK_REASON_TH[st.reason] || st.reason)}</span>
            <button type="button" class="nls-topology-btn nls-topology-ghost nls-topology-small" data-act="ltog" data-lid="${esc(l.id)}">${l.up === false ? 'เสียบสาย' : 'ถอดสาย'}</button>
            <button type="button" class="nls-topology-btn nls-topology-danger nls-topology-small" data-act="ldel" data-lid="${esc(l.id)}">ลบ</button></li>`;
        }).join('') + '</ul>';
      } else h += '<p class="nls-topology-muted">ยังไม่ได้ต่อสาย</p>';
      const others = S.topo.devices.filter((x) => x.id !== d.id).sort((a, b) => natCmp(a.name, b.name));
      if (others.length) {
        h += `<div class="nls-topology-row" style="margin-bottom:10px"><select class="nls-topology-sel" data-c="to" aria-label="ต่อสายไปยังอุปกรณ์">${others.map((x) => `<option value="${esc(x.id)}">${esc(x.name)}</option>`).join('')}</select>
          <select class="nls-topology-sel" data-c="medium" aria-label="ชนิดสาย"><option value="utp">UTP</option><option value="fiber">ไฟเบอร์</option><option value="wifi">Wi-Fi</option></select>
          <button type="button" class="nls-topology-btn nls-topology-ghost nls-topology-small" data-act="conn">ต่อสาย</button></div>`;
      }
      return h;
    }
    function updateValidation() {
      Object.keys(reg).forEach((k) => {
        const r = reg[k]; if (!r.validate) return;
        const m = el.props.querySelector(`[data-m="${k}"]`), inp = el.props.querySelector(`[data-k="${k}"]`);
        if (!m) return;
        let res = null; try { res = r.validate(); } catch (e) { res = null; }
        m.textContent = res ? res.text : '';
        m.className = 'nls-topology-fmsg' + (res ? ' nls-topology-m-' + res.cls : '');
        if (inp) { if (res && res.cls === 'bad') inp.setAttribute('aria-invalid', 'true'); else inp.removeAttribute('aria-invalid'); }
      });
    }
    function updateEff() {
      const box = el.props.querySelector('[data-r=eff]');
      const d = S.sel && S.sel.kind === 'dev' ? devById(S.sel.id) : null;
      if (!box || !d || !S.net) return;
      if (HOST[d.type]) {
        const c = S.net.config(d.id) || {};
        const src = !d.dhcp ? 'กำหนดเอง (Static)' : c.apipa ? 'APIPA — ไม่พบ DHCP server' : c.leaseFrom ? `DHCP จาก ${(devById(c.leaseFrom) || {}).name || c.leaseFrom}` : 'DHCP (ยังไม่ได้ IP)';
        box.textContent = [
          'ค่าที่ใช้งานจริง (ipconfig /all)',
          'Media State . . . : ' + (c.up === false ? 'Adapter ถูกปิด' : c.linked ? 'เชื่อมต่อแล้ว' : 'Media disconnected (ไม่ได้ต่อสาย)'),
          'Physical Address  : ' + (c.mac || '-'),
          'IPv4 Address . .  : ' + (c.ip || '-'),
          'Subnet Mask . . . : ' + (c.mask || '-'),
          'Default Gateway . : ' + (c.gateway || '-'),
          'DNS Servers . . . : ' + ((c.dns || []).join(', ') || '-'),
          'ที่มาของ IP . . . : ' + src
        ].join('\n');
      } else if (d.type === 'router') {
        const rt = S.net.routes(d.id);
        box.textContent = rt.length ? rt.map((r) => `${r.type === 'S' && r.prefix === 0 ? 'S*' : r.type}  ${r.net}/${r.prefix}  ${r.via ? 'via ' + r.via : 'is directly connected'}, ${r.iface}`).join('\n') : '(ว่าง: ยังไม่มีขาที่ตั้ง IP และต่อสายใช้งานได้)';
      }
    }
    on(el.props, 'change', (e) => {
      const t = e.target;
      if (t.getAttribute('data-act') === 'pick') { select(t.value ? { kind: 'dev', id: t.value } : null); return; }
      const k = t.getAttribute('data-k'); if (!k || !reg[k] || !reg[k].set) return;
      const r = reg[k];
      const v = t.type === 'checkbox' ? t.checked : t.value;
      commit(() => r.set(v));
      // show a valid mask in dotted form right away (students type /24, 24 or 255.255.255.0)
      if (/^(mask|wmask|pmask|ifmask\d+|rtm\d+)$/.test(k)) { const m = maskStore(v); if (typeof m === 'number') t.value = maskDisp(m); }
      if (r.rebuild) buildProps();
    });
    on(el.props, 'keydown', (e) => {
      if (e.key === 'Enter' && e.target.matches('input[type=text]')) { e.preventDefault(); e.target.dispatchEvent(new Event('change', { bubbles: true })); }
    });
    on(el.props, 'click', (e) => {
      const b = e.target.closest ? e.target.closest('[data-act]') : null;
      if (!b) return;
      const act = b.getAttribute('data-act');
      const d = S.sel && S.sel.kind === 'dev' ? devById(S.sel.id) : null;
      const i = +b.getAttribute('data-i');
      if (act === 'ltog') toggleLink(b.getAttribute('data-lid'));
      else if (act === 'ldel') deleteLink(b.getAttribute('data-lid'));
      else if (act === 'ddel' && d) deleteDevice(d.id);
      else if (act === 'conn' && d) {
        const to = el.props.querySelector('[data-c=to]').value, m = el.props.querySelector('[data-c=medium]').value;
        if (connect(d.id, to, m)) buildProps();
      } else if (act === 'rtadd' && d) { commit(() => { d.routes.push({ net: '', prefix: 24, via: '' }); }); buildProps(); }
      else if (act === 'rtdef' && d) {
        if (d.routes.some((r) => r.net === '0.0.0.0' && pfxOf(r.prefix) === 0)) { setStatus('มี Default route อยู่แล้ว', true); return; }
        commit(() => { d.routes.push({ net: '0.0.0.0', prefix: 0, via: '' }); }); buildProps();
        const n = el.props.querySelector(`[data-k="rtv${d.routes.length - 1}"]`); if (n) n.focus();
      } else if (act === 'rtdel' && d) { commit(() => { d.routes.splice(i, 1); }); buildProps(); }
      else if (act === 'radd' && d) {
        const r = d.services.dns.records;
        if (Object.prototype.hasOwnProperty.call(r, '')) { setStatus('กรอกชื่อของระเบียนว่างก่อน', true); return; }
        commit(() => { r[''] = ''; }); buildProps();
        const n = el.props.querySelector(`[data-k="rn${Object.keys(r).length - 1}"]`); if (n) n.focus();
      } else if (act === 'rdel' && d) {
        commit(() => { const r = d.services.dns.records; const k = Object.keys(r)[i]; if (k !== undefined) delete r[k]; }); buildProps();
      }
    });

    // ------------------------------------------------------------ problems panel
    function renderProblems() {
      const ps = S.net ? S.net.problems() : [];
      ps.sort((a, b) => (a.level === b.level ? 0 : a.level === 'error' ? -1 : 1));
      const ne = ps.filter((p) => p.level === 'error').length;
      let h = `<h3>ปัญหาที่พบ <span class="nls-topology-count${ne ? ' nls-topology-err' : ''}">${ps.length}</span></h3>`;
      if (!S.topo.devices.length) h += '<p class="nls-topology-muted">ยังไม่มีอุปกรณ์</p>';
      else if (!ps.length) h += '<p class="nls-topology-allok">ไม่พบปัญหาการตั้งค่า ✓ ลองทดสอบด้วย "ส่ง Ping"</p>';
      else {
        h += '<ul class="nls-topology-probs">' + ps.slice(0, 40).map((p) => {
          const cls = p.level === 'error' ? 'nls-topology-err' : 'nls-topology-warn';
          const lab = `<b>${p.level === 'error' ? 'ผิดพลาด' : 'คำเตือน'}</b>${esc(p.msg)}`;
          if (p.dev && devById(p.dev)) return `<li><button type="button" class="${cls}" data-pdev="${esc(p.dev)}">${lab}</button></li>`;
          if (p.link && linkById(p.link)) return `<li><button type="button" class="${cls}" data-plink="${esc(p.link)}">${lab}</button></li>`;
          return `<li><div class="${cls}">${lab}</div></li>`;
        }).join('') + '</ul>';
        if (ps.length > 40) h += `<p class="nls-topology-muted">…และอีก ${ps.length - 40} รายการ</p>`;
        h += '<p class="nls-topology-note">คลิกที่รายการเพื่อเลือกอุปกรณ์ที่มีปัญหา</p>';
      }
      if (el.probs.__h !== h) { el.probs.innerHTML = h; el.probs.__h = h; }
    }
    on(el.probs, 'click', (e) => {
      const b = e.target.closest ? e.target.closest('[data-pdev],[data-plink]') : null;
      if (!b) return;
      if (b.hasAttribute('data-pdev')) select({ kind: 'dev', id: b.getAttribute('data-pdev') });
      else select({ kind: 'link', id: b.getAttribute('data-plink') });
    });

    // ------------------------------------------------------------ ping
    function refreshPingSources() {
      const srcs = S.topo.devices.filter((d) => HOST[d.type] || d.type === 'router').sort((a, b) => natCmp(a.name, b.name));
      const want = S.pingSrc && srcs.some((d) => d.id === S.pingSrc) ? S.pingSrc : el.pSrc.value;
      const html = srcs.map((d) => `<option value="${esc(d.id)}">${esc(d.name)}</option>`).join('') || '<option value="">(ยังไม่มีเครื่อง)</option>';
      if (el.pSrc.innerHTML !== html) el.pSrc.innerHTML = html;
      if (want && srcs.some((d) => d.id === want)) el.pSrc.value = want;
      const opts = new Set();
      S.topo.devices.forEach((d) => {
        const c = S.net && S.net.config(d.id);
        if (c && c.ip) opts.add(c.ip);
        if (c && c.ifaces) c.ifaces.forEach((f) => { if (f.ip) opts.add(f.ip); });
        const rec = d.services && d.services.dns && d.services.dns.records;
        if (isObj(rec)) Object.keys(rec).forEach((k) => { if (k) opts.add(k); });
        if (d.type === 'internet' && isObj(d.hosts)) Object.keys(d.hosts).forEach((k) => { opts.add(k); if (d.hosts[k]) opts.add(d.hosts[k]); });
      });
      el.dl.innerHTML = Array.from(opts).map((o) => `<option value="${esc(o)}"></option>`).join('');
      el.ssidDl.innerHTML = S.topo.devices.filter((d) => d.type === 'ap' && d.ssid).map((d) => `<option value="${esc(d.ssid)}"></option>`).join('');
    }
    function runPing(src, dst) {
      dst = String(dst || '').trim();
      const sd = devById(src);
      if (!sd) { el.pres.innerHTML = '<p class="nls-topology-msg nls-topology-bad">เลือกเครื่องต้นทางก่อน</p>'; return; }
      if (!dst) { el.pres.innerHTML = '<p class="nls-topology-msg nls-topology-bad">กรอก IP หรือชื่อปลายทางก่อน</p>'; el.pDst.focus(); return; }
      const net = NS.create(S.topo);
      const r = net.ping(src, dst.slice(0, 120), { count: 4 });
      const fail = r.failAt && devById(r.failAt) && r.failAt !== src ? `<div class="nls-topology-muted">จุดที่ติดปัญหา: ${esc(devById(r.failAt).name)}</div>` : '';
      const prompt = sd.type === 'router' ? `${sd.name}# ping ${dst}` : `C:\\Users\\${sd.name}> ping ${dst}`;
      el.pres.innerHTML = `<div class="nls-topology-pres ${r.ok ? 'nls-topology-ok' : 'nls-topology-no'}"><b>${r.ok ? '✓ Ping สำเร็จ' : '✗ Ping ไม่สำเร็จ'}</b>
        <div>${esc(sd.name)} → ${esc(dst)}${r.resolved && r.resolved !== dst ? ' [' + esc(r.resolved) + ']' : ''}: ${r.ok ? `ได้รับคำตอบ ${r.replies}/4` : 'สาเหตุ: ' + esc(r.reasonText || r.reason)}</div>${r.ok ? '' : fail}</div>
        <pre class="nls-topology-out" aria-label="ผลลัพธ์แบบ Command Prompt">${esc([prompt, ''].concat(r.win).join('\n'))}</pre>`;
      const ids = [];
      (r.path || []).forEach((id) => { if (ids[ids.length - 1] !== id) ids.push(id); });
      S.pingPath = { ids, ok: r.ok };
      setStatus(`Ping ${sd.name} → ${dst}: ${r.ok ? `สำเร็จ (ได้รับคำตอบ ${r.replies}/4)` : 'ไม่สำเร็จ — ' + (r.reasonText || r.reason)}`, !r.ok);
      draw();
      animate(ids, r.ok);
    }
    function animate(ids, ok) {
      if (rafAnim) cancelAnimationFrame(rafAnim);
      rafAnim = 0;
      el.anim.replaceChildren();
      const pts = ids.map((id) => devById(id)).filter(Boolean).map((d) => ({ x: d.x, y: d.y }));
      if (pts.length < 1) return;
      const dot = mk('circle', { r: '8', fill: 'var(--orange)', stroke: 'var(--panel)', 'stroke-width': '2', 'pointer-events': 'none' });
      const last = pts[pts.length - 1];
      const endMark = () => {
        el.anim.replaceChildren();
        if (!ok) {
          const g = mk('g', { transform: `translate(${last.x} ${last.y - 42})`, 'pointer-events': 'none' });
          g.appendChild(mk('circle', { r: '11', fill: 'var(--panel)', stroke: 'var(--bad)', 'stroke-width': '2' }));
          g.appendChild(mk('path', { d: 'M-5 -5 L5 5 M5 -5 L-5 5', stroke: 'var(--bad)', 'stroke-width': '3', 'stroke-linecap': 'round' }));
          el.anim.appendChild(g);
        }
      };
      if (reduceMotion || pts.length < 2) { endMark(); return; }
      const route = ok ? pts.concat(pts.slice(0, -1).reverse()) : pts;
      const seg = []; let total = 0;
      for (let i = 1; i < route.length; i++) { const L = Math.hypot(route[i].x - route[i - 1].x, route[i].y - route[i - 1].y); seg.push(L); total += L; }
      const outLen = seg.slice(0, pts.length - 1).reduce((a, b) => a + b, 0);
      const dur = Math.min(4000, 500 + total * 1.6);
      el.anim.appendChild(dot);
      const t0 = performance.now();
      const step = (now) => {
        if (destroyed) return;
        const k = Math.min(1, (now - t0) / dur);
        let dist = k * total, i = 0;
        while (i < seg.length - 1 && dist > seg[i]) { dist -= seg[i]; i++; }
        const a = route[i], b = route[i + 1] || a, f = seg[i] ? Math.min(1, dist / seg[i]) : 1;
        dot.setAttribute('cx', a.x + (b.x - a.x) * f); dot.setAttribute('cy', a.y + (b.y - a.y) * f);
        dot.setAttribute('fill', k * total > outLen ? 'var(--ok)' : 'var(--orange)');
        if (k < 1) rafAnim = requestAnimationFrame(step); else { rafAnim = 0; endMark(); }
      };
      rafAnim = requestAnimationFrame(step);
    }
    on(el.pDst, 'keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); S.pingSrc = el.pSrc.value; runPing(el.pSrc.value, el.pDst.value); } });
    on(el.pSrc, 'change', () => { S.pingSrc = el.pSrc.value; });

    // ------------------------------------------------------------ missions
    function statusOf(m) {
      const b = best[m.id];
      return b && b.best !== undefined && b.best !== null && b.attempts !== 0 ? `<span class="nls-topology-best">คะแนนดีที่สุด ${b.best}/${b.max || m.max || 10}</span>` : '<span>ยังไม่ทำ</span>';
    }
    function renderMissionList() {
      el.missions.innerHTML = missions.map((m, i) => `<button type="button" class="nls-topology-mbtn${S.cur === m.id ? ' nls-topology-on' : ''}" data-mid="${esc(m.id)}" aria-pressed="${S.cur === m.id}"><b>${i + 1}. ${esc(m.title)}</b><span>${esc(LEVEL_TH[m.level] || m.level || '')} • ${statusOf(m)}</span></button>`).join('') +
        `<button type="button" class="nls-topology-mbtn${S.cur === 'free' ? ' nls-topology-on' : ''}" data-mid="free" aria-pressed="${S.cur === 'free'}"><b>โหมดอิสระ</b><span>ออกแบบได้ตามใจ ไม่มีคะแนน</span></button>`;
      // phones: the list is one scrolling row of chips; bring the current one into view (without scrolling the page)
      const on1 = el.missions.querySelector('.nls-topology-on');
      if (on1 && el.missions.scrollWidth > el.missions.clientWidth + 1) el.missions.scrollLeft = Math.max(0, on1.offsetLeft - 12);
    }
    on(el.missions, 'click', (e) => {
      const b = e.target.closest ? e.target.closest('[data-mid]') : null;
      if (!b) return;
      switchMission(b.getAttribute('data-mid'));
    });
    function switchMission(id) {
      if (id === S.cur) return;
      S.works[S.cur] = S.topo;
      S.cur = id;
      setTopo(S.works[id] || startOf(id));
      S.undo = []; S.redo = []; S.sel = null; S.pending = null; S.pingPath = null; S.armed = null;
      el.pres.innerHTML = ''; el.anim.replaceChildren();
      saveDraft();
      renderMissionList(); renderMission(); refreshLight(); buildProps(); homeView();
      setStatus(id === 'free' ? 'โหมดอิสระ: ทดลองออกแบบเครือข่ายได้ตามใจ' : `เปิดภารกิจ: ${(missionById(id) || {}).title || id}`);
    }
    function renderMission() {
      if (S.cur === 'free') {
        el.mission.innerHTML = `<h3>โหมดอิสระ</h3><p class="nls-topology-muted">ทดลองวางอุปกรณ์ ต่อสาย ตั้งค่า และส่ง Ping ได้ตามใจ ไม่มีการตรวจคะแนน งานบันทึกอัตโนมัติในเครื่องนี้</p>
          <div class="nls-topology-row"><button type="button" class="nls-topology-btn nls-topology-ghost" data-m="reset">ล้างแผนผัง</button></div>`;
        return;
      }
      const m = missionById(S.cur); if (!m) return;
      const n = S.hints[m.id] || 0, hints = Array.isArray(m.hints) ? m.hints : [];
      const res = S.results[m.id];
      let h = `<h3>${esc(m.title)}<span class="nls-topology-lv nls-topology-lv-${esc(m.level)}">${esc(LEVEL_TH[m.level] || m.level || '')}</span></h3><p>${esc(m.desc)}</p>`;
      if (n) h += '<ul class="nls-topology-hints">' + hints.slice(0, n).map((x) => `<li>${esc(x)}</li>`).join('') + '</ul>';
      h += '<div class="nls-topology-row" style="margin-top:8px">';
      h += `<button type="button" class="nls-topology-btn nls-topology-go" data-m="submit"${S.busy ? ' disabled' : ''}>${S.busy ? 'กำลังตรวจ…' : 'ตรวจงาน'}</button>`;
      if (n < hints.length) h += `<button type="button" class="nls-topology-btn nls-topology-ghost" data-m="hint">ขอคำใบ้ (${n + 1}/${hints.length})</button>`;
      h += '<button type="button" class="nls-topology-btn nls-topology-ghost" data-m="reset">เริ่มภารกิจใหม่</button></div>';
      if (!ctx.user) h += '<p class="nls-topology-note">ยังไม่ได้เข้าสู่ระบบ: ตรวจคะแนนได้แต่จะไม่บันทึก</p>';
      if (res && res.error) h += `<p class="nls-topology-msg nls-topology-bad">ส่งงานไม่สำเร็จ: ${esc(res.error)}</p>`;
      else if (res) {
        const full = res.score >= res.max;
        h += `<div class="nls-topology-result"><div class="nls-topology-score${full ? ' nls-topology-full' : ''}">คะแนน ${esc(res.score)}/${esc(res.max)}</div>`;
        if (res.saved === false && ctx.user) h += '<p class="nls-topology-note">ยังไม่ได้บันทึกคะแนน</p>';
        const checks = res.details && Array.isArray(res.details.checks) ? res.details.checks : [];
        if (checks.length) h += '<ul class="nls-topology-checks">' + checks.map((c) => `<li><i class="${c.ok ? 'nls-topology-y' : 'nls-topology-n'}" aria-hidden="true">${c.ok ? '✓' : '✗'}</i><span>${esc(c.label)}<span class="nls-topology-sr" style="position:absolute;left:-9999px">${c.ok ? ' ผ่าน' : ' ไม่ผ่าน'}</span></span><em>${esc(c.score)}/${esc(c.max)}</em></li>`).join('') + '</ul>';
        const fb = Array.isArray(res.feedback) ? res.feedback : [];
        if (fb.length) h += '<ul class="nls-topology-fb">' + fb.map((x) => `<li>${esc(x)}</li>`).join('') + '</ul>';
        h += '</div>';
      }
      el.mission.innerHTML = h;
    }
    on(el.mission, 'click', async (e) => {
      const b = e.target.closest ? e.target.closest('[data-m]') : null;
      if (!b) return;
      const a = b.getAttribute('data-m');
      if (a === 'hint') { const m = missionById(S.cur); S.hints[S.cur] = Math.min((S.hints[S.cur] || 0) + 1, (m.hints || []).length); saveDraft(); renderMission(); }
      else if (a === 'reset') {
        const fresh = S.cur === 'free' ? { devices: [], links: [] } : startOf(S.cur);
        const before = snap(); setTopo(fresh);
        if (snap() !== before) pushUndo(before);
        S.sel = null; S.sheet = false; S.pending = null; refreshLight(); buildProps(); homeView();
        setStatus(S.cur === 'free' ? 'ล้างแผนผังแล้ว (กด "ย้อนกลับ" เพื่อเอาคืน)' : 'เริ่มภารกิจใหม่แล้ว (กด "ย้อนกลับ" เพื่อเอางานเดิมคืน)');
      } else if (a === 'submit') submit();
    });
    async function submit() {
      const mid = S.cur;
      if (S.busy || mid === 'free' || typeof ctx.submit !== 'function') return;
      S.busy = true; renderMission();
      try {
        const r = await ctx.submit(mid, { topo: clone(S.topo) });
        if (destroyed) return;
        S.results[mid] = r || { score: 0, max: 10, feedback: [] };
        const b = best[mid] || { best: null, max: r.max, attempts: 0 };
        b.attempts = (b.attempts || 0) + 1; b.max = r.max;
        if (b.best === null || b.best === undefined || r.score > b.best) b.best = r.score;
        best[mid] = b;
      } catch (err) {
        if (destroyed) return;
        S.results[mid] = { error: (err && err.message) || 'เกิดข้อผิดพลาด' };
      }
      S.busy = false;
      renderMission(); renderMissionList();
      const sc = el.mission.querySelector('.nls-topology-result,.nls-topology-msg');
      if (sc) sc.scrollIntoView({ block: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' });
    }

    // ------------------------------------------------------------ refresh
    function refreshLight() {
      if (destroyed) return;
      draw();
      renderProblems();
      refreshPingSources();
      updateValidation();
      updateEff();
      renderSelbar();
      updateToolbar();
      renderStatus();
      renderSheet();
    }

    // ------------------------------------------------------------ init
    renderMissionList(); renderMission();
    setTool('select');
    refreshLight(); buildProps();
    applyVB();
    if (typeof ResizeObserver === 'function') {
      let first = true;
      ro = new ResizeObserver(() => { if (first) { first = false; homeView(); lastCH = svg.clientHeight || 0; lastCW = svg.clientWidth || 0; } else resized(); });
      ro.observe(svg);
    } else timers.push(setTimeout(homeView, 0));
    on(window, 'resize', resized);

    return {
      destroy() {
        destroyed = true;
        if (rafDraw) cancelAnimationFrame(rafDraw);
        if (rafAnim) cancelAnimationFrame(rafAnim);
        timers.forEach(clearTimeout);
        if (ro) ro.disconnect();
        listeners.forEach(([n, ev, fn, opt]) => n.removeEventListener(ev, fn, opt));
        listeners.length = 0;
        if (pd && pd.ghost) pd.ghost.remove();
        document.documentElement.classList.remove('nls-topology-noscroll');
        ptrs.clear(); pinch = null; drag = null;
        root.innerHTML = '';
      }
    };
  }

  window.NL_SIMS = window.NL_SIMS || {};
  window.NL_SIMS[SIM] = { title: 'จำลองการออกแบบเครือข่าย', mount };
})();

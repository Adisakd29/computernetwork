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
/* guided tutorial (t8) */
.nls-topology-tutentry{display:flex;flex-wrap:wrap;gap:8px 12px;align-items:center;justify-content:space-between;background:var(--panel);border:1px solid var(--blue);border-left:5px solid var(--blue);border-radius:12px;padding:10px 12px;margin:0 0 10px}
.nls-topology-tutentry[hidden]{display:none}
.nls-topology-tutentry b{display:block;font-size:15.5px}
.nls-topology-tutentry span{font-size:13.5px;color:var(--muted)}
.nls-topology-tutentry>div{flex:1 1 220px;min-width:0}
.nls-topology-tut h3{display:flex;flex-wrap:wrap;gap:4px 8px;align-items:baseline}
.nls-topology-dots{display:flex;flex-wrap:wrap;gap:6px;margin:4px 0 10px;padding:0;list-style:none}
.nls-topology-dots button{min-width:40px;height:40px;border-radius:20px;border:2px solid var(--line);background:var(--panel);color:var(--ink);font:inherit;font-weight:700;font-size:14px;cursor:pointer;padding:0 6px}
.nls-topology-dots button.nls-topology-d-done{border-color:var(--ok);color:var(--ok)}
.nls-topology-dots button[aria-current="step"]{background:var(--blue);border-color:var(--blue);color:var(--panel)}
.nls-topology-dots button:disabled{opacity:.4;cursor:default}
.nls-topology-why{font-size:14px;color:var(--muted);border-left:3px solid var(--line);padding-left:8px;margin:0 0 8px}
.nls-topology-todo{list-style:none;padding:0;margin:6px 0 8px;font-size:15px}
.nls-topology-todo li{display:flex;gap:8px;align-items:flex-start;padding:5px 8px;border-radius:8px;margin-bottom:3px;border:1px solid transparent}
.nls-topology-todo i{font-style:normal;font-weight:700;flex:none;width:1.4em;height:1.4em;line-height:1.3em;text-align:center;border-radius:50%;border:2px solid var(--line);font-size:13px}
.nls-topology-todo li.nls-topology-t-ok i{border-color:var(--ok);background:var(--ok);color:var(--panel)}
.nls-topology-todo li.nls-topology-t-ok{color:var(--muted)}
.nls-topology-todo li.nls-topology-t-next{border-color:var(--blue);background:var(--field)}
.nls-topology-todo li.nls-topology-t-next i{border-color:var(--blue)}
.nls-topology-passed{color:var(--ok);font-weight:700;font-size:15px;margin:4px 0 8px}
.nls-topology-regress{font-size:14px;color:var(--orange);margin:4px 0 8px}
.nls-topology-coach{display:flex;flex-wrap:wrap;gap:4px 8px;align-items:center;background:var(--field);border:1px solid var(--blue);border-radius:10px;padding:5px 8px;margin:0 0 6px;font-size:14px;min-width:0}
.nls-topology-coach[hidden]{display:none}
.nls-topology-coach .nls-topology-grow{flex:1 1 180px;min-width:0;overflow-wrap:anywhere;line-height:1.4}
.nls-topology-coach .nls-topology-grow b{color:var(--blue)}
.nls-topology-coach .nls-topology-cok{color:var(--ok);font-weight:700}
.nls-topology-coachhint{flex-basis:100%;font-size:13.5px;color:var(--ink);border-left:3px solid var(--blue);padding-left:8px}
.nls-topology-coachhint:empty{display:none}
.nls-topology-fs .nls-topology-coach{flex:none;flex-wrap:nowrap;padding:2px 6px;margin:0 0 4px}
.nls-topology-fs .nls-topology-coach .nls-topology-grow{flex:1 1 auto;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.nls-topology-fs .nls-topology-coach .nls-topology-btn{flex:none}
.nls-topology-fs .nls-topology-coach .nls-topology-coachhint{display:none}
.nls-topology-fs.nls-topology-editing .nls-topology-coach{display:none}
.nls-topology-fs .nls-topology-coach:not([hidden])~.nls-topology-status{display:none}
/* packet trace */
.nls-topology-reason{margin:4px 0 0;font-size:14.5px;line-height:1.5}
.nls-topology-reason .nls-topology-rt{font-weight:700;color:var(--bad)}
.nls-topology-hops{list-style:none;counter-reset:hop;padding:0;margin:8px 0;font-size:13.5px;line-height:1.45}
.nls-topology-hops li{counter-increment:hop;display:flex;gap:6px;align-items:flex-start;padding:4px 6px;border-radius:6px;border-left:4px solid var(--line);margin-bottom:3px;background:var(--field);overflow-wrap:anywhere}
.nls-topology-hops li::before{content:counter(hop) ".";font-weight:700;flex:none;min-width:1.6em;color:var(--muted)}
.nls-topology-hops li.nls-topology-h-arp{border-left-color:var(--blue)}
.nls-topology-hops li.nls-topology-h-req{border-left-color:var(--orange)}
.nls-topology-hops li.nls-topology-h-rep{border-left-color:var(--ok)}
.nls-topology-hops li.nls-topology-h-fail{border-left-color:var(--bad);color:var(--bad);font-weight:600}
.nls-topology-hops li.nls-topology-h-fail::before{content:"✗";color:var(--bad)}
.nls-topology-hops li.nls-topology-h-now{outline:2px solid var(--blue)}
.nls-topology-hops li.nls-topology-h-wait{opacity:.45}
.nls-topology-legend{display:flex;flex-wrap:wrap;gap:4px 12px;font-size:12.5px;color:var(--muted);margin:2px 0 0}
.nls-topology-legend span::before{content:"";display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:4px;vertical-align:-1px;background:var(--c)}
.nls-topology-out-wrap summary{cursor:pointer;font-size:14px;font-weight:600;min-height:32px;display:flex;align-items:center}
@media (pointer:coarse){.nls-topology-dots button{min-width:44px;height:44px;border-radius:22px}}
/* 2.8: test panel tabs, simulation controls, frame inspector, MAC table, capstone */
.nls-topology-tablist{display:flex;gap:4px;border-bottom:1px solid var(--line);margin:-4px -4px 10px;padding:0 0 0 0;overflow-x:auto;scrollbar-width:thin}
.nls-topology-tablist [role=tab]{flex:1 0 auto;background:none;border:0;border-bottom:3px solid transparent;color:var(--muted);font:inherit;font-weight:600;font-size:14.5px;padding:8px 10px;min-height:44px;cursor:pointer;white-space:nowrap}
.nls-topology-tablist [role=tab][aria-selected=true]{color:var(--ink);border-bottom-color:var(--blue)}
.nls-topology-tabs [role=tabpanel][hidden]{display:none}
.nls-topology-simctl{display:flex;flex-wrap:wrap;gap:6px 10px;align-items:center;margin:10px 0 4px;padding:6px 8px;border:1px dashed var(--line);border-radius:10px;font-size:14px}
.nls-topology-simctl label{display:inline-flex;align-items:center;gap:6px}
.nls-topology-simctl .nls-topology-sel{min-height:36px;padding:3px 6px}
.nls-topology-frame:empty{display:none}
.nls-topology-frame{border:1px solid var(--blue);border-left:5px solid var(--blue);border-radius:10px;padding:8px 10px;margin:8px 0;background:var(--field);font-size:13.5px}
.nls-topology-frame dl{display:grid;grid-template-columns:minmax(0,1fr);gap:2px;margin:6px 0 0}
.nls-topology-frame dl>div{display:grid;grid-template-columns:minmax(110px,38%) minmax(0,1fr);gap:6px;border-bottom:1px solid var(--line);padding:2px 0}
.nls-topology-frame dt{color:var(--muted)}
.nls-topology-frame dd{margin:0;font-family:var(--nls-topology-mono);font-size:12.5px;overflow-wrap:anywhere}
.nls-topology-hops li[data-hop]:not([data-hop=end]){cursor:pointer}
.nls-topology-hops li[data-hop]:focus-visible{outline:3px solid var(--blue)}
.nls-topology-trhops{margin:4px 0 8px;padding-left:20px;font-family:var(--nls-topology-mono);font-size:13px;list-style:none}
.nls-topology-mac{width:100%;border-collapse:collapse;font-size:13px;margin:6px 0}
.nls-topology-mac th,.nls-topology-mac td{border-bottom:1px solid var(--line);padding:3px 4px;text-align:left;overflow-wrap:anywhere}
.nls-topology-mac td:nth-child(2){font-family:var(--nls-topology-mono);font-size:12px}
.nls-topology-loglist{list-style:none;padding:0;margin:0 0 8px;font-size:13.5px;max-height:320px;overflow:auto}
.nls-topology-loglist li{border-left:4px solid var(--line);padding:4px 8px;margin-bottom:4px;background:var(--field);border-radius:6px;overflow-wrap:anywhere}
.nls-topology-loglist li.nls-topology-l-ok{border-left-color:var(--ok)}.nls-topology-loglist li.nls-topology-l-bad{border-left-color:var(--bad)}
.nls-topology-saveinfo{font-size:12.5px;color:var(--muted);align-self:center;min-width:0}
.nls-topology-offtag{display:inline-block;font-size:12px;font-weight:700;color:var(--bad);border:1px solid var(--bad);border-radius:4px;padding:0 5px}
.nls-topology-btn.nls-topology-pwroff{border-color:var(--ok);color:var(--ok)}
.nls-topology-capsteps{display:flex;flex-wrap:wrap;gap:6px;list-style:none;padding:0;margin:4px 0 10px}
.nls-topology-capsteps li{flex:1 1 150px;border:1px solid var(--line);border-radius:10px;padding:6px 10px;font-size:14px;color:var(--muted);background:var(--field)}
.nls-topology-capsteps li.nls-topology-cs-now{border-color:var(--blue);color:var(--ink);font-weight:700;box-shadow:inset 0 0 0 1px var(--blue)}
.nls-topology-capsteps li.nls-topology-cs-done{border-color:var(--ok);color:var(--ok)}
.nls-topology-capsec{border:1px solid var(--line);border-radius:10px;padding:8px 10px;margin:0 0 10px}
.nls-topology-capsec summary{cursor:pointer;font-weight:700;min-height:32px;display:flex;align-items:center}
.nls-topology-capreq{margin:6px 0 0;padding-left:20px;font-size:14.5px}
.nls-topology-capblk{border-top:1px solid var(--line);padding-top:8px;margin-top:10px}
.nls-topology-plan{display:grid;gap:8px}
.nls-topology-prow{border:1px solid var(--line);border-radius:10px;padding:6px 10px 8px;margin:0;min-width:0}
.nls-topology-prow legend{font-size:14px;padding:0 4px}
.nls-topology-pgrid{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(0,0.8fr) minmax(0,1.3fr);gap:6px}
.nls-topology-pgrid label>span{display:block;font-size:12.5px;color:var(--muted)}
.nls-topology-capbar{height:10px;border-radius:5px;background:var(--field);border:1px solid var(--line);overflow:hidden;margin:4px 0}
.nls-topology-capbar i{display:block;height:100%;background:var(--ok)}
.nls-topology-capsum{font-size:14px;margin:4px 0 8px}
.nls-topology-req{border:1px solid var(--line);border-radius:10px;margin:0 0 6px;background:var(--panel)}
.nls-topology-req>summary{display:flex;gap:8px;align-items:center;cursor:pointer;padding:6px 10px;min-height:44px;font-weight:600;font-size:14.5px}
.nls-topology-req>summary i{font-style:normal;flex:none;width:1.4em;height:1.4em;line-height:1.3em;text-align:center;border-radius:50%;border:2px solid var(--line);font-size:13px}
.nls-topology-req.nls-topology-req-ok>summary i{border-color:var(--ok);background:var(--ok);color:var(--panel)}
.nls-topology-req>summary em{margin-left:auto;font-style:normal;font-family:var(--nls-topology-mono);font-size:13px;color:var(--muted)}
.nls-topology-req>.nls-topology-todo,.nls-topology-req>.nls-topology-mxwrap,.nls-topology-req>.nls-topology-note{margin-left:10px;margin-right:10px}
.nls-topology-todo small{color:var(--muted);font-size:13px;line-height:1.4}
.nls-topology-mxwrap{overflow-x:auto;max-width:100%;margin:4px 0}
.nls-topology-mx{border-collapse:collapse;font-size:13px;min-width:100%}
.nls-topology-mx caption{text-align:left;font-size:13px;color:var(--muted);padding:2px 0 4px}
.nls-topology-mx th,.nls-topology-mx td{border:1px solid var(--line);padding:4px 6px;text-align:center;white-space:nowrap}
.nls-topology-mx th[scope=row]{text-align:left}
.nls-topology-mx td small{display:block;font-size:11px;color:var(--muted)}
.nls-topology-mx-ok{color:var(--ok);font-weight:700}
.nls-topology-mx-bad{color:var(--bad);font-weight:700}
.nls-topology-mx-na{color:var(--muted)}
.nls-topology-reqtab td,.nls-topology-reqtab th{white-space:normal;text-align:left}
.nls-topology-ticket{border:1px solid var(--orange);border-left:5px solid var(--orange);border-radius:10px;padding:8px 10px;margin:6px 0;background:var(--field)}
.nls-topology-ticket.nls-topology-ticket-ok{border-color:var(--ok)}
.nls-topology-report{width:100%;min-height:220px;background:var(--field);color:var(--ink);border:1px solid var(--line);border-radius:8px;padding:8px 10px;font:inherit;font-size:15px;line-height:1.55;resize:vertical}
.nls-topology-confirm{display:inline-flex;flex-wrap:wrap;gap:6px;align-items:center;font-size:14px;color:var(--bad)}
.nls-topology-review{border-top:1px solid var(--line);margin-top:10px;padding-top:8px}
.nls-topology-tcomment{margin:6px 0;padding:6px 10px;border-left:4px solid var(--blue);background:var(--field);border-radius:6px;white-space:pre-wrap}
@container (min-width:620px){.nls-topology-palette{grid-template-columns:repeat(9,minmax(0,1fr))}}
@media (max-width:760px){
  .nls-topology-pgrid{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}
  .nls-topology-pgrid label:first-child{grid-column:1/-1}
  .nls-topology-palette{grid-template-columns:repeat(5,minmax(0,1fr))}
  .nls-topology-pbtn{min-height:58px}
  .nls-topology-toolbar{flex-wrap:nowrap;overflow-x:auto;overscroll-behavior-x:contain;scrollbar-width:thin;padding-bottom:4px;margin-left:-2px;margin-right:-2px}
  .nls-topology-toolbar>*{flex:none}
  .nls-topology-saveinfo{display:none}
  .nls-topology-tablist [role=tab]{font-size:14px;padding:8px 8px}
  .nls-topology-report{font-size:16px}
}
@media (pointer:coarse){
  .nls-topology-simctl .nls-topology-sel{min-height:44px}
  .nls-topology-pgrid .nls-topology-in{min-height:44px;font-size:16px}
  .nls-topology-hops li[data-hop]{padding:8px 8px;min-height:44px}
}
/* 3.1: NAT / ACL panels, port test results, live checklist of t10–t13 */
.nls-topology-rule{border:1px solid var(--line);border-left:4px solid var(--ok);border-radius:8px;padding:6px 8px 2px;margin:0 0 6px;background:var(--field);min-width:0}
.nls-topology-rule.nls-topology-rdeny{border-left-color:var(--bad)}
.nls-topology-rule.nls-topology-implicit{border-left-color:var(--bad);border-style:dashed;color:var(--muted);font-family:var(--nls-topology-mono);font-size:13px;padding:6px 8px}
.nls-topology-rule>b{display:flex;flex-wrap:wrap;gap:4px 8px;align-items:center;font-size:13.5px;margin-bottom:4px}
.nls-topology-rule>b .nls-topology-row{margin-left:auto}
.nls-topology-acltext{font-family:var(--nls-topology-mono);font-size:12.5px;color:var(--muted);overflow-wrap:anywhere;margin:0 0 6px}
.nls-topology-aclres{list-style:none;margin:4px 0 8px;padding:0;font-size:13.5px}
.nls-topology-aclres li{border-left:4px solid var(--line);background:var(--field);border-radius:6px;padding:4px 8px;margin-bottom:4px;overflow-wrap:anywhere}
.nls-topology-aclres li.nls-topology-p{border-left-color:var(--ok)}.nls-topology-aclres li.nls-topology-d{border-left-color:var(--bad)}
.nls-topology-aclres li.nls-topology-x{border-left-color:var(--blue)}
.nls-topology-nattab{min-width:540px}
.nls-topology-nattab td{font-family:var(--nls-topology-mono);font-size:12px;white-space:nowrap}
.nls-topology-cells{list-style:none;padding:0;margin:6px 10px 8px;font-size:13.5px}
.nls-topology-cells li{border:1px solid var(--line);border-left:4px solid var(--bad);border-radius:8px;padding:5px 8px;margin-bottom:5px;overflow-wrap:anywhere}
.nls-topology-cells li.nls-topology-cpass{border-left-color:var(--ok)}
.nls-topology-cells small{display:block;color:var(--muted);line-height:1.4}
@media (max-width:760px){.nls-topology-selbar{max-width:100%;overflow-x:auto;overscroll-behavior-x:contain;scrollbar-width:none}}
.nls-topology-tag{display:inline-block;font-size:12px;font-weight:700;border:1px solid currentColor;border-radius:4px;padding:0 5px;margin-left:4px}
/* Phase 4: mission mode/week tags and the observation quiz of t15/t16 */
.nls-topology-mtags{display:flex;flex-wrap:wrap;gap:4px 6px;margin:-2px 0 6px;font-size:12.5px;color:var(--muted)}
.nls-topology-mtags span{border:1px solid var(--line);border-radius:999px;padding:1px 8px;background:var(--field)}
.nls-topology-hints.nls-topology-steps{list-style:none;padding-left:0}
.nls-topology-quiz{border:1px solid var(--line);border-radius:10px;padding:8px 10px;margin:8px 0;background:var(--field);min-width:0}
.nls-topology-quiz h4{margin:0 0 4px;font-size:14.5px}
.nls-topology-quiz fieldset{border:0;margin:0 0 8px;padding:0;min-width:0}
.nls-topology-quiz legend{font-size:14px;font-weight:600;padding:0;margin-bottom:4px;overflow-wrap:anywhere;white-space:normal}
.nls-topology-quiz label{display:flex;align-items:flex-start;gap:8px;min-height:36px;padding:4px 6px;border-radius:8px;font-size:14px;cursor:pointer;overflow-wrap:anywhere}
.nls-topology-quiz label:hover{background:var(--panel)}
.nls-topology-quiz input{margin-top:3px;flex:none;width:18px;height:18px}
@media (prefers-reduced-motion:no-preference){
  .nls-topology-sheet.nls-topology-open{animation:nls-topology-up .18s ease-out}
  @keyframes nls-topology-up{from{transform:translateY(24px);opacity:.6}to{transform:none;opacity:1}}
}
`;

  const TYPES = [
    { type: 'pc', label: 'PC' }, { type: 'laptop', label: 'Laptop' }, { type: 'server', label: 'Server' },
    { type: 'printer', label: 'Printer' }, { type: 'switch', label: 'Switch' }, { type: 'hub', label: 'Hub' }, { type: 'router', label: 'Router' },
    { type: 'ap', label: 'Access Point' }, { type: 'internet', label: 'Internet' }
  ];
  const TYPE_TH = {
    pc: 'คอมพิวเตอร์ (PC)', laptop: 'โน้ตบุ๊ก (Laptop)', server: 'เครื่องแม่ข่าย (Server)', printer: 'เครื่องพิมพ์ (Printer)',
    switch: 'สวิตช์ (Switch)', hub: 'ฮับ (Hub) — อุปกรณ์รุ่นเก่า ชั้น Physical', router: 'เราเตอร์ (Router)', ap: 'จุดกระจาย Wi-Fi (Access Point)', internet: 'อินเทอร์เน็ต / ISP'
  };
  const ID_PREFIX = { pc: 'pc', laptop: 'laptop', server: 'srv', printer: 'prn', switch: 'sw', hub: 'hub', router: 'r', ap: 'ap', internet: 'net' };
  const NAME_PREFIX = { pc: 'PC', laptop: 'Laptop', server: 'Server', printer: 'Printer', switch: 'Switch', hub: 'Hub', router: 'Router', ap: 'AP', internet: 'Internet' };
  const L2 = { switch: 1, hub: 1, ap: 1 };
  const HOST = { pc: 1, laptop: 1, server: 1, printer: 1 };
  const LEVEL_TH = { easy: 'ง่าย', medium: 'ปานกลาง', hard: 'ยาก' };
  const MODE_TH = { guided: 'ฝึกตามขั้นตอน (Guided Lab)', independent: 'ฝึกเอง (Independent Lab)', trouble: 'แก้ปัญหา (Troubleshooting Challenge)' };
  const MEDIUM_TH = { utp: 'UTP', fiber: 'ไฟเบอร์', wifi: 'Wi-Fi' };
  const LINK_REASON_TH = {
    ok: 'ใช้งานได้', down: 'สายถูกถอด/ขาด', off: 'อุปกรณ์ปลายสายปิดอยู่', auth: 'รหัสผ่าน Wi-Fi ไม่ถูกต้อง', iface_down: 'Adapter ถูกปิด', ssid: 'SSID ไม่ตรงกับ AP',
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
      if (d.wifiKey !== undefined && typeof d.wifiKey !== 'string') d.wifiKey = String(d.wifiKey);
    } else if (d.type === 'router') {
      if (!Array.isArray(d.ifaces)) d.ifaces = [];
      for (let i = 0; i < 4; i++) if (!isObj(d.ifaces[i])) d.ifaces[i] = { name: 'g0/' + i, ip: '', prefix: '' };
      d.ifaces.forEach((f, i) => { if (!f.name) f.name = 'g0/' + i; if (f.ip === undefined) f.ip = ''; if (f.prefix === undefined) f.prefix = ''; });
      if (!Array.isArray(d.routes)) d.routes = [];
      if (d.filters !== undefined && !Array.isArray(d.filters)) d.filters = [];
      if (d.nat !== undefined && !isObj(d.nat)) delete d.nat;
      if (d.acls !== undefined && !Array.isArray(d.acls)) d.acls = [];
      if (Array.isArray(d.acls)) d.acls = d.acls.filter(isObj).map((a) => Object.assign(a, { rules: Array.isArray(a.rules) ? a.rules.filter(isObj) : [] }));
    } else if (d.type === 'internet') {
      if (!Array.isArray(d.ifaces) || !d.ifaces.length) d.ifaces = [{ name: 'wan', ip: '100.64.0.1', prefix: 30 }];
      if (!isObj(d.hosts)) d.hosts = { '8.8.8.8': 'dns.google', '1.1.1.1': 'one.one.one.one', '203.0.113.80': 'www.netlab.test' };
    } else if (d.type === 'ap') {
      if (typeof d.ssid !== 'string') d.ssid = 'NETLAB';
      if (!d.security) d.security = 'WPA2';
      d.ports = 1;
    } else if (d.type === 'switch' || d.type === 'hub') {
      const n = Math.floor(+d.ports); d.ports = Number.isFinite(n) && n >= 1 && n <= 96 ? n : (d.type === 'hub' ? 8 : 24);
    }
    if (d.power !== false) delete d.power;
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
    const gridId = 'nls-topology-grid-' + U, dlId = 'nls-topology-dl-' + U, ssidDl = 'nls-topology-ssid-' + U, tabId = 'nls-topology-tab-' + U;
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
      fs: false, sheet: false, home: null,
      sim: null, log: [], speed: 1, stepMode: false, stepIdx: 0, tab: 'test', savedAt: null,
      cap: { plan: {}, report: '', fault: null }, review: null, resetAsk: false, quiz: {}
    };
    let destroyed = false, rafDraw = 0, rafAnim = 0, ro = null, drag = null, pd = null;
    const timers = [];
    const listeners = [];
    const on = (el, ev, fn, opt) => { el.addEventListener(ev, fn, opt); listeners.push([el, ev, fn, opt]); };
    const missionById = (id) => missions.find((m) => m.id === id) || null;
    // Phase 4: observation questions travel in start.quiz (questions and options only; the grader holds the key)
    const quizOf = (id) => { const m = missionById(id); return m && m.start && Array.isArray(m.start.quiz) ? m.start.quiz.filter((q) => isObj(q) && q.id && Array.isArray(q.options)) : []; };
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
        if (isObj(d.tut)) S.tutDraft = d.tut;
        if (isObj(d.quiz)) Object.keys(d.quiz).forEach((k) => { const q = quizOf(k); if (q.length && isObj(d.quiz[k])) { S.quiz[k] = {}; q.forEach((x) => { const n = Math.floor(+d.quiz[k][x.id]); if (n >= 0 && n < x.options.length) S.quiz[k][x.id] = n; }); } });
        if (isObj(d.cap)) {
          const c = d.cap;
          if (isObj(c.plan)) ['lab', 'teachers', 'office'].forEach((k) => { const r = c.plan[k]; if (isObj(r)) S.cap.plan[k] = { net: String(r.net || '').slice(0, 40), prefix: String(r.prefix || '').slice(0, 20), gateway: String(r.gateway || '').slice(0, 40) }; });
          if (typeof c.report === 'string') S.cap.report = c.report.slice(0, 6000);
          if (isObj(c.fault) && typeof c.fault.kind === 'string' && validTopo(c.fault.baseline)) S.cap.fault = c.fault;
        }
        if (Array.isArray(d.log)) S.log = d.log.filter(isObj).slice(-30).map((x) => ({ at: String(x.at || ''), kind: String(x.kind || ''), src: String(x.src || ''), dst: String(x.dst || ''), ok: x.ok === true, note: String(x.note || '').slice(0, 200) }));
        return true;
      }
      return false;
    }
    function saveDraft() {
      try {
        const s = JSON.stringify({ v: 1, cur: S.cur, works: S.works, hints: S.hints, tut: S.tut, cap: S.cap, log: S.log, quiz: S.quiz });
        if (s.length < 2000000) { window.localStorage.setItem(DRAFT_KEY, s); S.savedAt = nowHM(); }
      } catch (e) { /* storage full or blocked: ignore */ }
      try { if (el.saveInfo) el.saveInfo.textContent = S.savedAt ? 'บันทึกในเครื่องนี้แล้ว ' + S.savedAt : 'ยังไม่ได้บันทึก (เบราว์เซอร์ไม่อนุญาตให้เก็บข้อมูล)'; } catch (e) { /* called before the DOM exists */ }
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
    <li>ผู้เริ่มต้นให้กด <b>เริ่มฝึกทีละขั้น</b> ระบบจะบอกทีละขั้นว่าต้องทำอะไร และติ๊กให้เองเมื่อเครือข่ายถูกต้อง</li>
    <li>เมื่อส่ง Ping จะเห็นแพ็กเก็ตวิ่งไปทีละจุด (ARP สีน้ำเงิน, Echo Request สีส้ม, Echo Reply สีเขียว) ถ้าไม่สำเร็จแพ็กเก็ตจะหยุดตรงจุดที่มีปัญหาพร้อมบอกสาเหตุ</li>
    <li>ลากพื้นที่ว่างเพื่อเลื่อนมุมมอง ใช้ปุ่ม + / − / พอดีจอ เพื่อซูม เมื่อเลือกอุปกรณ์แล้วกดลูกศรเพื่อขยับ หรือ Delete เพื่อลบ</li>
  </ol></details>
  <div class="nls-topology-tutentry" data-r="tutentry" hidden><div><b>เพิ่งเริ่มต้น? ลองโหมดฝึกทีละขั้น</b><span>7 ขั้นสั้น ๆ ตั้งแต่วาง PC จนถึง ping ข้ามวงด้วย Router ระบบตรวจจากเครือข่ายจริงและบอกทันทีเมื่อทำถูก</span></div><button type="button" class="nls-topology-btn nls-topology-go" data-act="tut-open">เริ่มฝึกทีละขั้น</button></div>
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
        <button type="button" class="nls-topology-btn nls-topology-ghost" data-act="save" title="งานบันทึกอัตโนมัติในเครื่องนี้ทุกครั้งที่แก้ไข">บันทึกงาน</button>
        <label class="nls-topology-chk"><input type="checkbox" data-act="ports" checked> แสดงชื่อพอร์ต</label>
        <button type="button" class="nls-topology-btn nls-topology-fsbtn" data-act="fs" aria-pressed="false">เต็มจอ</button>
        <span class="nls-topology-saveinfo" data-r="saveinfo" aria-live="polite"></span>
      </div>
      <div class="nls-topology-palette" data-r="palette" aria-label="อุปกรณ์ (ลากมาวาง หรือแตะแล้วแตะบนพื้นที่วาด)">
        ${TYPES.map((t) => `<button type="button" class="nls-topology-pbtn" data-type="${t.type}" aria-pressed="false" title="${esc(TYPE_TH[t.type])}">${icons[t.type]}<span>${esc(t.label)}</span></button>`).join('')}
      </div>
      <div class="nls-topology-coach" data-r="coach" hidden></div>
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
      <section class="nls-topology-card nls-topology-tabs" data-r="ping" aria-label="แผงทดสอบและผลลัพธ์">
        <div class="nls-topology-tablist" role="tablist" aria-label="แผงทดสอบ">
          <button type="button" role="tab" id="${tabId}-test" aria-controls="${tabId}-p-test" data-tab="test" aria-selected="true">ทดสอบ (Terminal)</button>
          <button type="button" role="tab" id="${tabId}-req" aria-controls="${tabId}-p-req" data-tab="req" aria-selected="false" tabindex="-1" hidden>เช็กลิสต์งาน <span class="nls-topology-count" data-r="reqcount">0</span></button>
          <button type="button" role="tab" id="${tabId}-probs" aria-controls="${tabId}-p-probs" data-tab="probs" aria-selected="false" tabindex="-1">ปัญหา <span class="nls-topology-count" data-r="probcount">0</span></button>
          <button type="button" role="tab" id="${tabId}-log" aria-controls="${tabId}-p-log" data-tab="log" aria-selected="false" tabindex="-1">บันทึกผลทดสอบ</button>
        </div>
        <div role="tabpanel" id="${tabId}-p-test" aria-labelledby="${tabId}-test" data-panel="test">
          <h3>ทดสอบเครือข่าย</h3>
          <div class="nls-topology-field"><label><span>เครื่องต้นทาง</span><select data-p="src"></select></label></div>
          <div class="nls-topology-field"><label><span>ปลายทาง (IP หรือชื่อ เช่น 192.168.1.11, www.netlab.test)</span><input type="text" data-p="dst" list="${dlId}" autocomplete="off" spellcheck="false"></label></div>
          <datalist id="${dlId}"></datalist><datalist id="${ssidDl}"></datalist>
          <div class="nls-topology-grid2">
            <div class="nls-topology-field"><label><span>ทดสอบด้วย</span><select data-p="svc">
              <option value="icmp">Ping (ICMP)</option><option value="tcp:80">เว็บ HTTP (TCP 80)</option><option value="tcp:443">เว็บ HTTPS (TCP 443)</option>
              <option value="udp:53">DNS (UDP 53)</option><option value="tcp:22">SSH (TCP 22)</option><option value="tcp:3389">Remote Desktop (TCP 3389)</option>
              <option value="tcp:445">แชร์ไฟล์ SMB (TCP 445)</option><option value="tcp:">TCP พอร์ตอื่น…</option><option value="udp:">UDP พอร์ตอื่น…</option></select></label></div>
            <div class="nls-topology-field" data-r="portwrap" hidden><label><span>พอร์ตปลายทาง</span><input type="text" data-p="port" inputmode="numeric" autocomplete="off" placeholder="เช่น 8080"></label></div>
          </div>
          <div class="nls-topology-row">
            <button type="button" class="nls-topology-btn nls-topology-go" data-act="ping" data-r="gobtn">ส่ง Ping</button>
            <button type="button" class="nls-topology-btn nls-topology-ghost" data-act="tracert">Traceroute</button>
          </div>
          <div class="nls-topology-simctl" role="group" aria-label="ควบคุมการจำลองแพ็กเก็ต">
            <label><span>ความเร็ว</span><select class="nls-topology-sel" data-sim="speed"><option value="0.5">ช้า</option><option value="1" selected>ปกติ</option><option value="2">เร็ว</option></select></label>
            <label class="nls-topology-chk"><input type="checkbox" data-sim="step"> ทีละขั้น</label>
            <button type="button" class="nls-topology-btn nls-topology-ghost nls-topology-small" data-act="sim-prev" disabled aria-label="ขั้นก่อนหน้า">‹ ก่อนหน้า</button>
            <button type="button" class="nls-topology-btn nls-topology-ghost nls-topology-small" data-act="sim-next" disabled aria-label="ขั้นถัดไป">ถัดไป ›</button>
            <button type="button" class="nls-topology-btn nls-topology-ghost nls-topology-small" data-act="sim-clear" title="ล้างตาราง ARP ของทุกเครื่องและตาราง MAC ของ Switch">ล้างตาราง ARP/MAC</button>
          </div>
          <div data-r="pres" aria-live="polite"></div>
        </div>
        <div role="tabpanel" id="${tabId}-p-req" aria-labelledby="${tabId}-req" data-panel="req" hidden><section data-r="capfault"></section><section data-r="capcheck"></section></div>
        <div role="tabpanel" id="${tabId}-p-probs" aria-labelledby="${tabId}-probs" data-panel="probs" hidden><div data-r="probs"></div></div>
        <div role="tabpanel" id="${tabId}-p-log" aria-labelledby="${tabId}-log" data-panel="log" hidden><div data-r="log"></div></div>
      </section>
    </div>
  </div>
</div>`;

    const q = (sel) => root.querySelector(sel);
    const el = {
      missions: q('[data-r=missions]'), mission: q('[data-r=mission]'), palette: q('[data-r=palette]'), status: q('[data-r=status]'),
      selbar: q('[data-r=selbar]'), svg: q('[data-r=svg]'), hits: q('[data-r=hits]'), netl: q('[data-r=netl]'), over: q('[data-r=over]'),
      anim: q('[data-r=anim]'), empty: q('[data-r=empty]'), props: q('[data-r=props]'), ping: q('[data-r=ping]'), probs: q('[data-r=probs]'),
      pSrc: q('[data-p=src]'), pDst: q('[data-p=dst]'), pSvc: q('[data-p=svc]'), pPort: q('[data-p=port]'), portWrap: q('[data-r=portwrap]'), goBtn: q('[data-r=gobtn]'), pres: q('[data-r=pres]'), dl: root.querySelector('#' + dlId), ssidDl: root.querySelector('#' + ssidDl),
      coach: q('[data-r=coach]'), tutentry: q('[data-r=tutentry]'), log: q('[data-r=log]'), probcount: q('[data-r=probcount]'),
      saveInfo: q('[data-r=saveinfo]'),
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
      if (type === 'hub') d.ports = 8;
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
      if (L2[d.type]) {
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
    function setPower(d, onState) {
      commit(() => { if (onState) delete d.power; else d.power = false; });
      setStatus(onState ? `เปิดเครื่อง ${d.name} แล้ว` : `ปิดเครื่อง ${d.name} แล้ว (จำลองไฟดับ/ปิดสวิตช์ไฟ) — สายทุกเส้นที่ต่อกับ ${d.name} จะไม่มีสัญญาณ ลอง Ping ผ่านเครื่องนี้ดู`, !onState);
      buildProps();
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
      let tg = e.target;
      // the drawing may have been rebuilt during this event (a settings field committed on blur): hit-test again
      if (tg && !tg.isConnected && typeof document.elementFromPoint === 'function') tg = document.elementFromPoint(e.clientX, e.clientY) || tg;
      const dEl = tg.closest ? tg.closest('[data-id]') : null;
      const lEl = tg.closest ? tg.closest('[data-link]') : null;
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
      // commit a half-edited settings field to the device it belongs to before the selection changes
      const ae = document.activeElement;
      if (ae && ae !== svg && (el.props.contains(ae) || el.mission.contains(ae)) && typeof ae.blur === 'function') ae.blur();
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
      const hit = hitOf(e);
      // touch: a fingertip is wide; prefer a device whose icon centre is within ~26 screen px over a cable or empty space
      if (touch && !hit.devId) {
        const k = S.vb.w / (svg.clientWidth || 1), lim = 26 * k;
        let best = null, bd = Infinity;
        S.topo.devices.forEach((d) => { const dd = Math.hypot(d.x - pt.x, d.y - pt.y); if (dd < bd) { bd = dd; best = d; } });
        if (best && bd <= Math.max(lim, 30)) { hit.devId = best.id; hit.linkId = null; }
      }
      const devId = hit.devId, linkId = hit.linkId;
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
        setStatus(L2[d.type] ? `${d.name} ไม่มี IP ให้ ping (ทำงานชั้น 2 ส่งต่อเฟรมเท่านั้น) เลือกเครื่องอื่น` : `${d.name} ยังไม่มี IP address ที่ใช้งานได้`, true);
        return;
      }
      const src = S.pending; S.pending = null; el.over.replaceChildren();
      el.pSrc.value = src; el.pDst.value = ip; S.pingSrc = src;
      runPing(src, ip, d.id);
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
      else if (act === 'ping') { S.pingSrc = el.pSrc.value; runTest(el.pSrc.value, el.pDst.value); }
      else if (act === 'tracert') { S.pingSrc = el.pSrc.value; runTracert(el.pSrc.value, el.pDst.value); }
      else if (act === 'sim-prev') { S.stepIdx = Math.max(0, S.stepIdx - 1); showStep(); }
      else if (act === 'sim-next') { S.stepIdx++; showStep(); }
      else if (act === 'sim-clear') { simNet().clearArp(); simNet().clearMac(); updateMac(); setStatus('ล้างตาราง ARP และตาราง MAC แล้ว — Ping ครั้งถัดไปจะเห็น ARP และการเรียนรู้ MAC ใหม่'); }
      else if (act === 'macclear') { const d = S.sel && devById(S.sel.id); if (d) { simNet().clearMac(d.id); updateMac(); setStatus(`ล้างตาราง MAC ของ ${d.name} แล้ว`); } }
      else if (act === 'log-clear') { S.log = []; renderLog(); }
      else if (act === 'save') { saveDraft(); setStatus('บันทึกงานไว้ในเครื่องนี้แล้ว (บันทึกอัตโนมัติทุกครั้งที่แก้ไขด้วย)'); if (ctx.toast) ctx.toast('บันทึกงานแล้ว'); }
      else if (act === 'sel-power') { const d = S.sel && S.sel.kind === 'dev' ? devById(S.sel.id) : null; if (d) setPower(d, d.power === false); }
      else if (act === 'sel-test') { const d = S.sel && S.sel.kind === 'dev' ? devById(S.sel.id) : null; if (d) { S.pingSrc = d.id; refreshPingSources(); el.pSrc.value = d.id; setTab('test'); S.sheet = false; renderSheet(); try { el.pDst.focus({ preventScroll: true }); root.querySelector('[data-panel=test]').scrollIntoView({ block: 'start', behavior: reduceMotion ? 'auto' : 'smooth' }); } catch (err) { /* ignore */ } } }
      else if (act === 'sel-del') { if (S.sel && S.sel.kind === 'dev') deleteDevice(S.sel.id); else if (S.sel) deleteLink(S.sel.id); }
      else if (act === 'sel-toggle') { if (S.sel && S.sel.kind === 'link') toggleLink(S.sel.id); }
      else if (act === 'sel-edit' && sheetMode()) { S.sheet = true; renderSheet(); }
      else if (act === 'sel-edit') { const f = el.props.querySelector('input,select'); el.props.scrollIntoView({ block: 'start', behavior: reduceMotion ? 'auto' : 'smooth' }); if (f) f.focus({ preventScroll: true }); }
      else if (act === 'sel-none') select(null);
      else if (act === 'tut-open') { switchMission('t8'); try { el.mission.scrollIntoView({ block: 'start', behavior: reduceMotion ? 'auto' : 'smooth' }); } catch (err) { /* ignore */ } }
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
        if (d) h = `<span class="nls-topology-grow">เลือก: <b>${esc(d.name)}</b>${d.power === false ? ' <span class="nls-topology-offtag">ปิดอยู่</span>' : ''} <span class="nls-topology-muted">${esc(TYPE_TH[d.type])}</span></span>
          <button type="button" class="nls-topology-btn nls-topology-ghost nls-topology-small" data-act="sel-edit">ตั้งค่า</button>
          ${d.type !== 'internet' ? `<button type="button" class="nls-topology-btn nls-topology-ghost nls-topology-small${d.power === false ? ' nls-topology-pwroff' : ''}" data-act="sel-power" aria-pressed="${d.power !== false}" title="จำลองการเปิด/ปิดเครื่อง">${d.power === false ? 'เปิดเครื่อง' : 'ปิดเครื่อง'}</button>` : ''}
          ${HOST[d.type] || d.type === 'router' ? '<button type="button" class="nls-topology-btn nls-topology-ghost nls-topology-small" data-act="sel-test">ทดสอบจากเครื่องนี้</button>' : ''}
          <button type="button" class="nls-topology-btn nls-topology-danger nls-topology-small" data-act="sel-del">ลบ</button>`;
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
      if (d.locked) h += '<p class="nls-topology-note"><span class="nls-topology-tag">อุปกรณ์ของโจทย์</span> เป็นอุปกรณ์ฝั่งผู้ให้บริการ/ภายนอกสำหรับทดสอบ ระบบตรวจงานใช้ค่าเดิมของภารกิจเสมอ (แก้ที่นี่ไม่มีผลต่อคะแนน)</p>';
      h += fld('name', 'ชื่ออุปกรณ์', d.name, {
        set: (v) => { D().name = String(v).trim().slice(0, 40) || D().id; },
        validate: () => { const n = D().name; return S.topo.devices.some((x) => x !== D() && x.name === n) ? bad('ชื่อซ้ำกับอุปกรณ์อื่น ควรตั้งชื่อไม่ให้ซ้ำ') : null; }
      });
      if (d.type !== 'internet') h += chk('power', 'เปิดเครื่อง (Power on)', d.power !== false, { set: (v) => { if (v) delete D().power; else D().power = false; } });
      if (HOST[d.type]) h += hostFields(d, D);
      else if (d.type === 'router') h += routerFields(d, D);
      else if (d.type === 'switch' || d.type === 'hub') {
        h += sel('ports', 'จำนวนพอร์ต', d.ports, [[4, '4 พอร์ต'], [8, '8 พอร์ต'], [16, '16 พอร์ต'], [24, '24 พอร์ต'], [48, '48 พอร์ต']], { set: (v) => { D().ports = +v; } });
        h += d.type === 'hub' ? '<p class="nls-topology-note">Hub ทำงานชั้น 1 (Physical) ทวนสัญญาณที่ได้รับออกทุกพอร์ต ไม่ดู MAC address ทุกเครื่องที่ต่อ Hub จึงได้รับทุกเฟรมและแย่งกันใช้สาย (Collision domain เดียวกัน) ในอดีตใช้กันมาก ปัจจุบันใช้ Switch แทน — ลองเปลี่ยนเป็น Switch แล้วเทียบผลในตัวตรวจเฟรม</p>'
          : '<p class="nls-topology-note">Switch ทำงานชั้น 2 (Data link) เรียนรู้ MAC address ของเครื่องที่ต่ออยู่แต่ละพอร์ต แล้วส่งเฟรมไปเฉพาะพอร์ตปลายทาง จึงไม่ต้องตั้ง IP</p>';
        h += '<div class="nls-topology-box" data-r="mac"></div>';
      } else if (d.type === 'ap') {
        h += fld('apssid', 'SSID (ชื่อเครือข่าย Wi-Fi)', d.ssid, { set: (v) => { D().ssid = String(v).trim().slice(0, 32); }, validate: () => D().ssid ? null : bad('ควรตั้ง SSID ให้เครื่องลูกข่ายเลือกเชื่อมต่อได้') });
        h += sel('sec', 'การเข้ารหัส (Security)', d.security, [['WPA3', 'WPA3-Personal (แนะนำ)'], ['WPA2/WPA3', 'WPA2/WPA3-Personal (รองรับเครื่องรุ่นเก่า)'], ['WPA2', 'WPA2-Personal'], ['Open', 'ไม่เข้ารหัส (Open) — ไม่ปลอดภัย']], { set: (v) => { D().security = v; }, rebuild: true });
        if (d.security !== 'Open') h += fld('appsk', 'รหัสผ่าน Wi-Fi (Pre-shared key)', d.passphrase || '', { set: (v) => { const k = String(v).slice(0, 63); if (k) D().passphrase = k; else delete D().passphrase; },
          validate: () => { const k = D().passphrase || ''; if (!k) return info('ยังไม่ได้ตั้งรหัสผ่าน: ระบบจำลองจะยอมให้เครื่องเชื่อมต่อได้โดยไม่ถามรหัส'); if (k.length < 8) return bad('WPA2/WPA3-Personal ต้องใช้รหัสผ่านยาว 8–63 ตัวอักษร'); if (k.length < 12) return info('ใช้ได้ แต่ควรยาว 12 ตัวขึ้นไปและผสมตัวอักษร ตัวเลข สัญลักษณ์'); return okm('รหัสผ่านยาวพอ'); }, ph: 'อย่างน้อย 8 ตัวอักษร' });
        else h += '<p class="nls-topology-fmsg nls-topology-m-bad">Wi-Fi แบบ Open ไม่เข้ารหัส ใครก็เชื่อมต่อและดักฟังข้อมูลได้</p>';
        h += chk('apiso', 'แยกเครื่องลูกข่าย Wi-Fi ออกจากกัน (Client/Guest isolation)', d.isolation === true, { set: (v) => { if (v) D().isolation = true; else delete D().isolation; } });
        h += '<p class="nls-topology-note">Access Point เชื่อม Wi-Fi เข้ากับเครือข่ายสาย ต้องต่อสาย UTP จากพอร์ต p1 เข้า Switch</p>';
        h += '<div class="nls-topology-box" data-r="mac"></div>';
      } else if (d.type === 'internet') {
        const f = d.ifaces[0];
        h += fld('wip', 'IP ฝั่ง ISP (wan)', f.ip, { set: (v) => { D().ifaces[0].ip = String(v).trim(); }, validate: () => vIp(D().ifaces[0].ip, pfxOf(D().ifaces[0].prefix), true), im: 'decimal' });
        h += fld('wmask', 'Subnet mask', maskDisp(f.prefix), { set: (v) => { D().ifaces[0].prefix = maskStore(v); }, validate: () => vMask(D().ifaces[0].prefix, D().ifaces[0].ip) });
        if (d.requireNat) h += '<p class="nls-topology-fmsg nls-topology-m-info">ISP นี้ไม่รับแพ็กเก็ตที่ IP ต้นทางเป็น Private IP (10.x, 172.16–31.x, 192.168.x) และไม่ส่งต่อไปยัง Private IP — เครือข่ายภายในต้องทำ NAT ที่ Router</p>';
        if (d.ifaces.length > 1) h += `<div class="nls-topology-eff">${d.ifaces.map((x) => esc(`${x.name}  ${x.ip || '-'}/${x.prefix === undefined ? '' : x.prefix}`)).join('\n')}</div>`;
        h += `<div class="nls-topology-box"><b>ปลายทางบนอินเทอร์เน็ตที่จำลองไว้</b><div class="nls-topology-eff">${Object.keys(d.hosts || {}).map((k) => esc(k + '  ' + d.hosts[k])).join('\n') || '-'}</div><p class="nls-topology-note">8.8.8.8 และ 1.1.1.1 เป็น DNS สาธารณะ ใช้แปลงชื่อเว็บบนอินเทอร์เน็ตได้</p></div>`;
      }
      h += connFields(d);
      h += `<button type="button" class="nls-topology-btn nls-topology-danger" data-act="ddel">ลบ ${esc(d.name)}</button>`;
      el.props.innerHTML = h;
      updateValidation(); updateEff(); updateMac();
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
      if (d.type === 'laptop' || wifiLinked || d.ssid) {
        h += fld('wkey', 'รหัสผ่าน Wi-Fi', d.wifiKey || '', { set: (v) => { const k = String(v).slice(0, 63); if (k) D().wifiKey = k; else delete D().wifiKey; },
          validate: () => { const ap = S.topo.devices.find((x) => x.type === 'ap' && x.ssid && x.ssid === D().ssid); if (!ap || !ap.passphrase || ap.security === 'Open') return null; return (D().wifiKey || '') === ap.passphrase ? okm('รหัสผ่านถูกต้อง') : bad(`รหัสผ่านไม่ตรงกับ ${ap.name} จึงเชื่อมต่อไม่ได้`); } });
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
      const svc = (k, label) => chk('sv_' + k, label, !!sv[k], { set: (v) => { const s2 = D().services; if (v) s2[k] = true; else delete s2[k]; } });
      h += `<div class="nls-topology-box">${svc('web', 'เว็บเซิร์ฟเวอร์ (HTTP TCP 80 / HTTPS TCP 443)')}${svc('file', 'แชร์ไฟล์ (File server, SMB TCP 445)')}${svc('ssh', 'SSH (TCP 22) — ผู้ดูแลระบบเข้าจัดการระยะไกล')}${svc('rdp', 'Remote Desktop (TCP 3389)')}
        <p class="nls-topology-note">บริการที่เปิดคือพอร์ตที่เครื่องนี้รอรับการเชื่อมต่อ ทดสอบได้ที่แผงทดสอบ (เลือกชนิดการทดสอบเป็นพอร์ต)</p></div>`;
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
          <div class="nls-topology-grid2">${chk('ifup' + i, 'เปิดใช้งาน (no shutdown)', f.up !== false, { set: (v) => { F().up = !!v; } })}
          ${sel('ifnat' + i, 'NAT (ip nat …)', f.nat || '', [['', '— ไม่ใช้ NAT'], ['inside', 'inside (ฝั่งภายใน)'], ['outside', 'outside (ฝั่งต่อ ISP)']], { set: (v) => { if (v) F().nat = v; else delete F().nat; } })}</div></div>`;
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
      h += natFields(d, D) + aclFields(d, D);
      if (!(d.filters || []).length && !['t9', 'free'].includes(S.cur)) return h + '<p class="nls-topology-note">กฎไฟร์วอลล์แบบง่ายของ Router ทั้งตัว (Packet filter) ใช้ในโครงงานปิดท้ายและโหมดอิสระ ภารกิจนี้ใช้ ACL ด้านบนแทน</p>';
      h += '<h4>กฎไฟร์วอลล์ (Packet filter)</h4><p class="nls-topology-note">ตรวจแพ็กเก็ตที่ Router ส่งต่อ ทีละข้อจากบนลงล่าง ข้อแรกที่ตรงจะถูกใช้ ถ้าไม่ตรงข้อใดเลยจะอนุญาต (ระบบจำลองนี้ไม่มี implicit deny แบบ ACL ของ Cisco) และไม่จำสถานะการเชื่อมต่อ (stateless) คำตอบกลับจึงถูกตรวจด้วย</p>';
      (d.filters || []).forEach((r, i) => {
        const Fr = () => D().filters[i];
        const vNet = (k) => () => { const v = String(Fr()[k] || '').trim().toLowerCase(); if (!v || v === 'any') return info('any = ทุกเครือข่าย'); const m = /^(\d+\.\d+\.\d+\.\d+)(?:\/(\d{1,2}))?$/.exec(v); if (!m || IPH.parse(m[1]) === null || (m[2] && +m[2] > 32)) return bad('ใส่เป็น Network/prefix เช่น 172.16.10.0/26 หรือ any'); const p = m[2] ? +m[2] : 32; return IPH.network(m[1], p) !== m[1] ? info(`จะเทียบทั้งวง ${IPH.network(m[1], p)}/${p}`) : null; };
        h += `<div class="nls-topology-box"><b>กฎข้อที่ ${i + 1}</b><div class="nls-topology-grid2">${sel('fa' + i, 'การกระทำ', r.action === 'permit' ? 'permit' : 'deny', [['deny', 'deny (บล็อก)'], ['permit', 'permit (อนุญาต)']], { set: (v) => { Fr().action = v; } })}
          ${sel('fp' + i, 'โปรโตคอล', r.proto || 'any', [['any', 'ทั้งหมด (any)'], ['icmp', 'ICMP (ping)'], ['udp', 'UDP (เช่น DNS)'], ['tcp', 'TCP (เช่น เว็บ แชร์ไฟล์)']], { set: (v) => { Fr().proto = v; } })}</div>
          <div class="nls-topology-grid2">${fld('fs' + i, 'ต้นทาง (Network/prefix)', r.src || '', { set: (v) => { Fr().src = String(v).trim(); }, validate: vNet('src'), ph: '172.16.10.0/26' })}
          ${fld('fd' + i, 'ปลายทาง (Network/prefix)', r.dst || '', { set: (v) => { Fr().dst = String(v).trim(); }, validate: vNet('dst'), ph: 'any' })}</div>
          <button type="button" class="nls-topology-btn nls-topology-danger nls-topology-small" data-act="fdel" data-i="${i}" aria-label="ลบกฎข้อที่ ${i + 1}">ลบกฎ</button></div>`;
      });
      if (!(d.filters || []).length) h += '<p class="nls-topology-muted">ยังไม่มีกฎ (อนุญาตทุกแพ็กเก็ต)</p>';
      h += '<button type="button" class="nls-topology-btn nls-topology-ghost nls-topology-small" data-act="fadd">+ เพิ่มกฎไฟร์วอลล์</button>';
      return h;
    }
    // 3.1: NAT / PAT / port forwarding of a router
    const ifOpts = (d) => d.ifaces.map((f) => [f.name, `${f.name}${f.ip ? ' (' + f.ip + ')' : ''}${f.nat ? ' — ' + f.nat : ''}`]);
    function vAddr(v, req) {
      const s0 = String(v || '').trim();
      if (!s0) return req ? bad('ต้องกรอก เช่น 192.168.1.0/24 หรือ 192.168.1.0 0.0.0.255') : info('ว่าง = any (ทุกเครื่อง)');
      const a = NS.acl.parseAddr(s0);
      if (!a) return bad('ใช้ any, host 192.168.1.10, 192.168.1.0/24 หรือ 192.168.1.0 0.0.0.255 (Network + Wildcard)');
      if (a.maskLike) { const m = s0.split(/\s+/)[1]; return bad(`${m} เป็น Subnet mask ไม่ใช่ Wildcard — Router จะตีความเป็น "${a.text}" (Wildcard ของ ${m} คือ ${IPH.wildcard(IPH.toPrefix(m))})`); }
      return info('Router ตีความเป็น ' + a.text + (a.cidr && a.cidr !== s0 ? ` (= ${a.cidr})` : ''));
    }
    function vPort(v, need) {
      const s0 = String(v || '').trim();
      if (!s0) return need ? bad('ต้องระบุพอร์ต เช่น 443') : info('ว่าง = ทุกพอร์ต');
      const p = NS.acl.parsePort(s0);
      return p.err ? bad(p.err) : info('พอร์ต ' + p.port);
    }
    function natFields(d, D) {
      const N = () => { const x = D(); if (!isObj(x.nat)) x.nat = {}; return x.nat; };
      const tidy = () => { const x = D(); if (isObj(x.nat) && !x.nat.pat && !(x.nat.statics || []).length) delete x.nat; };
      const nat = isObj(d.nat) ? d.nat : {};
      const pat = isObj(nat.pat) ? nat.pat : null;
      let h = '<h4>NAT / PAT (แปลง Private IP ↔ Public IP)</h4><p class="nls-topology-note">ตั้งขาฝั่ง LAN เป็น <b>inside</b> และขาที่ต่อ ISP เป็น <b>outside</b> (ช่อง NAT ในกล่องของแต่ละขาด้านบน) แพ็กเก็ตที่วิ่งจาก inside ไป outside จะถูกแปลง IP ต้นทาง ส่วนคำตอบที่กลับมาจะถูกแปลงกลับตามตาราง NAT</p>';
      h += `<div class="nls-topology-box">${chk('paton', 'เปิด PAT (NAT overload) — ทุกเครื่องใช้ Public IP ของขา outside ร่วมกัน แยกกันด้วยหมายเลขพอร์ต', !!pat, {
        set: (v) => {
          if (v) { const o = D().ifaces.find((f) => f.nat === 'outside'); const lan = D().ifaces.find((f) => f.nat === 'inside' && f.ip && pfxOf(f.prefix) !== null && IPH.parse(f.ip) !== null);
            N().pat = { iface: o ? o.name : '', src: lan ? IPH.network(lan.ip, pfxOf(lan.prefix)) + '/' + pfxOf(lan.prefix) : '' }; }
          else { delete N().pat; tidy(); }
        }, rebuild: true })}`;
      if (pat) {
        h += `<div class="nls-topology-grid2">${sel('patif', 'ใช้ IP ของขา (overload)', pat.iface || '', [['', '— เลือกขา —']].concat(ifOpts(d)), { set: (v) => { N().pat.iface = v; }, rebuild: true })}
          ${fld('patsrc', 'เครือข่ายภายในที่ให้แปลง (access-list)', pat.src || '', { set: (v) => { N().pat.src = String(v).trim().slice(0, 40); }, validate: () => vAddr(N().pat.src, true), ph: '192.168.1.0/24' })}</div>`;
        const pi = d.ifaces.find((f) => f.name === pat.iface);
        if (pi && pi.nat !== 'outside') h += '<p class="nls-topology-fmsg nls-topology-m-bad">ขาที่ใช้ทำ PAT ต้องเป็นขา outside (ขาที่ต่อ ISP)</p>';
      }
      h += '</div><b style="font-size:14px">Static NAT / Port forwarding</b><p class="nls-topology-note">ให้คนภายนอกเชื่อมต่อมาที่ Public IP:พอร์ต แล้ว Router ส่งต่อไปยังเครื่องภายใน (เปิดเฉพาะพอร์ตที่จำเป็น)</p>';
      (Array.isArray(nat.statics) ? nat.statics : []).forEach((x, i) => {
        const X = () => N().statics[i];
        const all = x.proto === 'ip';
        h += `<div class="nls-topology-box"><b>ข้อที่ ${i + 1}${all ? ' — Static NAT 1:1 (ทุกพอร์ต)' : ' — Port forwarding'}</b>
          <div class="nls-topology-grid2">${sel('snp' + i, 'โปรโตคอล', x.proto || 'tcp', [['tcp', 'TCP'], ['udp', 'UDP'], ['ip', 'ทุกพอร์ต (1:1)']], { set: (v) => { X().proto = v; }, rebuild: true })}
          ${fld('sng' + i, 'IP ภายนอก (inside global)', x.global || '', { set: (v) => { X().global = String(v).trim(); }, validate: () => X().global && IPH.parse(X().global) === null ? bad('รูปแบบ IP ไม่ถูกต้อง') : !X().global ? info('ว่าง = IP ของขา outside') : null, im: 'decimal' })}</div>
          <div class="nls-topology-grid2">${fld('snl' + i, 'IP ภายใน (inside local)', x.local || '', { set: (v) => { X().local = String(v).trim(); }, validate: () => IPH.parse(X().local) === null ? bad('ใส่ IP ของเครื่องภายใน') : null, im: 'decimal' })}
          ${all ? '' : fld('sngp' + i, 'พอร์ตภายนอก', x.gport || '', { set: (v) => { X().gport = String(v).trim(); }, validate: () => vPort(X().gport, false), ph: '443', im: 'numeric' })}</div>
          ${all ? '<p class="nls-topology-fmsg nls-topology-m-bad">ส่งต่อทุกพอร์ต: คนภายนอกเข้าถึงทุกบริการของเครื่องนี้ได้ (เสี่ยง)</p>' : `<div class="nls-topology-grid2">${fld('snlp' + i, 'พอร์ตภายใน', x.lport || '', { set: (v) => { X().lport = String(v).trim(); }, validate: () => vPort(X().lport, true), ph: '443', im: 'numeric' })}<div></div></div>`}
          <button type="button" class="nls-topology-btn nls-topology-danger nls-topology-small" data-act="sndel" data-i="${i}">ลบข้อนี้</button></div>`;
      });
      h += '<div class="nls-topology-row" style="margin-bottom:8px"><button type="button" class="nls-topology-btn nls-topology-ghost nls-topology-small" data-act="snadd">+ เพิ่ม Port forwarding</button></div>';
      h += '<b style="font-size:14px">ตาราง NAT (show ip nat translations)</b><div data-r="nat"></div>';
      return h;
    }
    // 3.1: interface ACLs (ordered rules, first match, implicit deny shown at the end)
    function aclFields(d, D) {
      const A = (ai) => D().acls[ai];
      let h = '<h4>ACL (Access Control List)</h4><p class="nls-topology-note">ตรวจทีละข้อจากบนลงล่าง <b>ข้อแรกที่ตรงจะถูกใช้</b> และท้าย ACL ทุกอันมี <b>implicit deny</b> (deny ip any any) ซ่อนอยู่ ผูกกับขาได้ทิศละ 1 ACL: <b>in</b> = แพ็กเก็ตที่เข้ามาทางขานั้น, <b>out</b> = แพ็กเก็ตที่ออกไปทางขานั้น ACL ไม่จำสถานะ (คำตอบกลับก็ถูกตรวจถ้าผ่านขา/ทิศที่ผูกไว้)</p>';
      (d.acls || []).forEach((a, ai) => {
        h += `<div class="nls-topology-box"><b>ACL ${esc(a.name || '(ไม่มีชื่อ)')}</b>${fld('an' + ai, 'ชื่อ ACL', a.name || '', { set: (v) => { A(ai).name = String(v).trim().slice(0, 32); }, ph: 'STUDENT-IN' })}
          <div class="nls-topology-grid2">${sel('ai' + ai, 'ผูกกับขา (ip access-group)', a.iface || '', [['', '— ยังไม่ผูก —']].concat(ifOpts(d)), { set: (v) => { A(ai).iface = v; } })}
          ${sel('ad' + ai, 'ทิศ', a.dir === 'out' ? 'out' : 'in', [['in', 'in (ขาเข้า)'], ['out', 'out (ขาออก)']], { set: (v) => { A(ai).dir = v; } })}</div>`;
        (a.rules || []).forEach((r, ri) => {
          const Rr = () => A(ai).rules[ri];
          const k = ai + '_' + ri;
          const parsed = NS.acl.parseRule(r);
          const portOk = r.proto === 'tcp' || r.proto === 'udp';
          h += `<div class="nls-topology-rule${r.action === 'deny' ? ' nls-topology-rdeny' : ''}"><b>ข้อที่ ${ri + 1}<span class="nls-topology-row">
            <button type="button" class="nls-topology-btn nls-topology-ghost nls-topology-small" data-act="arup" data-a="${ai}" data-i="${ri}" aria-label="เลื่อนกฎข้อที่ ${ri + 1} ขึ้น"${ri ? '' : ' disabled'}>↑</button>
            <button type="button" class="nls-topology-btn nls-topology-ghost nls-topology-small" data-act="ardn" data-a="${ai}" data-i="${ri}" aria-label="เลื่อนกฎข้อที่ ${ri + 1} ลง"${ri < a.rules.length - 1 ? '' : ' disabled'}>↓</button>
            <button type="button" class="nls-topology-btn nls-topology-danger nls-topology-small" data-act="ardel" data-a="${ai}" data-i="${ri}" aria-label="ลบกฎข้อที่ ${ri + 1}">ลบ</button></span></b>
            <div class="nls-topology-grid2">${sel('ara' + k, 'การกระทำ', r.action === 'deny' ? 'deny' : 'permit', [['permit', 'permit (อนุญาต)'], ['deny', 'deny (บล็อก)']], { set: (v) => { Rr().action = v; }, rebuild: true })}
            ${sel('arp' + k, 'โปรโตคอล', ['icmp', 'tcp', 'udp'].includes(r.proto) ? r.proto : 'ip', [['ip', 'ip (ทุกโปรโตคอล)'], ['icmp', 'icmp (ping)'], ['tcp', 'tcp'], ['udp', 'udp']], { set: (v) => { Rr().proto = v; if (v !== 'tcp' && v !== 'udp') Rr().port = ''; }, rebuild: true })}</div>
            <div class="nls-topology-grid2">${fld('ars' + k, 'ต้นทาง (source)', r.src || '', { set: (v) => { Rr().src = String(v).trim().slice(0, 40); }, validate: () => vAddr(Rr().src, false), ph: '192.168.10.0 0.0.0.255' })}
            ${fld('ard' + k, 'ปลายทาง (destination)', r.dst || '', { set: (v) => { Rr().dst = String(v).trim().slice(0, 40); }, validate: () => vAddr(Rr().dst, false), ph: 'host 192.168.30.10' })}</div>
            ${portOk ? fld('arpt' + k, 'พอร์ตปลายทาง (eq)', r.port || '', { set: (v) => { Rr().port = String(v).trim().slice(0, 12); }, validate: () => vPort(Rr().port, false), ph: '443 หรือ https', im: 'numeric' }) : ''}
            <p class="nls-topology-acltext">${esc(parsed.err ? 'กฎนี้ยังใช้ไม่ได้: ' + parsed.err : parsed.text)}</p></div>`;
        });
        h += `<div class="nls-topology-rule nls-topology-implicit">ข้อสุดท้าย (มีเสมอ ไม่ต้องเพิ่ม): deny ip any any — implicit deny</div>
          <div class="nls-topology-row"><button type="button" class="nls-topology-btn nls-topology-ghost nls-topology-small" data-act="aradd" data-a="${ai}">+ เพิ่มกฎ</button><button type="button" class="nls-topology-btn nls-topology-danger nls-topology-small" data-act="acldel" data-a="${ai}">ลบ ACL นี้</button></div></div>`;
      });
      if (!(d.acls || []).length) h += '<p class="nls-topology-muted">ยังไม่มี ACL (Router ส่งต่อทุกแพ็กเก็ต)</p>';
      h += '<div class="nls-topology-row" style="margin-bottom:8px"><button type="button" class="nls-topology-btn nls-topology-ghost nls-topology-small" data-act="acladd">+ สร้าง ACL</button></div>';
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
        const nb = el.props.querySelector('[data-r=nat]');
        if (nb) { const hh = natTableHtml(d, true); if (nb.__h !== hh) { nb.innerHTML = hh; nb.__h = hh; } }
      }
    }
    on(el.props, 'change', (e) => {
      const t = e.target;
      if (t.getAttribute('data-act') === 'pick') { select(t.value ? { kind: 'dev', id: t.value } : null); return; }
      const k = t.getAttribute('data-k'); if (!k || !reg[k] || !reg[k].set || !t.isConnected) return;
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
      else if (act === 'fadd' && d) { commit(() => { if (!Array.isArray(d.filters)) d.filters = []; d.filters.push({ action: 'deny', src: '', dst: '', proto: 'any' }); }); buildProps(); const n = el.props.querySelector(`[data-k="fs${d.filters.length - 1}"]`); if (n) n.focus(); }
      else if (act === 'fdel' && d) { commit(() => { d.filters.splice(i, 1); if (!d.filters.length) delete d.filters; }); buildProps(); }
      else if (act === 'snadd' && d) {
        const o = d.ifaces.find((f) => f.nat === 'outside');
        commit(() => { if (!isObj(d.nat)) d.nat = {}; if (!Array.isArray(d.nat.statics)) d.nat.statics = []; d.nat.statics.push({ proto: 'tcp', local: '', lport: '443', global: o && o.ip ? o.ip : '', gport: '443' }); });
        buildProps(); const n = el.props.querySelector(`[data-k="snl${d.nat.statics.length - 1}"]`); if (n) n.focus();
      } else if (act === 'sndel' && d && isObj(d.nat)) { commit(() => { d.nat.statics.splice(i, 1); if (!d.nat.statics.length) delete d.nat.statics; if (!d.nat.pat && !d.nat.statics) delete d.nat; }); buildProps(); }
      else if (act === 'acladd' && d) {
        const used = new Set((d.acls || []).map((a) => a.name));
        let n = 1; while (used.has('ACL' + n)) n++;
        commit(() => { if (!Array.isArray(d.acls)) d.acls = []; d.acls.push({ name: 'ACL' + n, iface: '', dir: 'in', rules: [{ action: 'permit', proto: 'tcp', src: '', dst: '', port: '' }] }); });
        buildProps(); const f = el.props.querySelector(`[data-k="ai${d.acls.length - 1}"]`); if (f) f.focus();
      } else if (/^(acldel|aradd|ardel|arup|ardn)$/.test(act) && d && Array.isArray(d.acls)) {
        const ai = +b.getAttribute('data-a'), a = d.acls[ai]; if (!a) return;
        let focus = null;
        commit(() => {
          if (act === 'acldel') { d.acls.splice(ai, 1); if (!d.acls.length) delete d.acls; }
          else if (act === 'aradd') { a.rules.push({ action: 'permit', proto: 'tcp', src: '', dst: '', port: '' }); focus = `ars${ai}_${a.rules.length - 1}`; }
          else if (act === 'ardel') a.rules.splice(i, 1);
          else { const j = act === 'arup' ? i - 1 : i + 1; if (j >= 0 && j < a.rules.length) { const x = a.rules[i]; a.rules[i] = a.rules[j]; a.rules[j] = x; focus = `[data-act="${act}"][data-a="${ai}"][data-i="${j}"]`; } }
        });
        buildProps();
        const n = focus ? el.props.querySelector(focus.charAt(0) === '[' ? focus : `[data-k="${focus}"]`) : null; if (n && !n.disabled) n.focus();
        if (act === 'arup' || act === 'ardn') setStatus('เปลี่ยนลำดับกฎแล้ว — ACL ตรวจจากบนลงล่าง ข้อแรกที่ตรงจะถูกใช้');
      }
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
      if (el.probcount) { el.probcount.textContent = String(ps.length); el.probcount.classList.toggle('nls-topology-err', ne > 0); }
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
    // owner of an IP in the current drawing (the device the student most likely means)
    function devOfIp(ip) {
      if (!ip || !S.net) return null;
      const hit = S.topo.devices.filter((d) => { const c = S.net.config(d.id); return c && (c.ip === ip || (c.ifaces || []).some((f) => f.ip === ip)); });
      return hit.length ? hit.sort((a, b) => natCmp(a.id, b.id))[0].id : null;
    }
    // persistent network instance for the test panel: ARP caches and switch MAC tables fill up as the student
    // tests (like real equipment) and are kept until the wiring/settings change (moving icons does not reset them)
    function topoKey() { return JSON.stringify(S.topo, (k, v) => (k === 'x' || k === 'y') ? undefined : v); }
    function simNet() {
      const k = topoKey();
      if (!S.sim || S.sim.key !== k) S.sim = { key: k, net: NS.create(S.topo) };
      return S.sim.net;
    }
    function nowHM() { const d = new Date(); return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2) + ':' + ('0' + d.getSeconds()).slice(-2); }
    function logTest(entry) {
      S.log.push(Object.assign({ at: nowHM() }, entry));
      if (S.log.length > 30) S.log.shift();
      renderLog();
    }
    function renderLog() {
      if (!el.log) return;
      let h = '<h3>บันทึกผลการทดสอบ</h3>';
      if (!S.log.length) h += '<p class="nls-topology-muted">ยังไม่มีผลทดสอบ ลองส่ง Ping หรือ Traceroute จากแท็บ "ทดสอบ"</p>';
      else h += '<ol class="nls-topology-loglist">' + S.log.slice().reverse().map((x) => `<li class="${x.ok ? 'nls-topology-l-ok' : 'nls-topology-l-bad'}"><span class="nls-topology-muted">${esc(x.at)}</span> <b>${esc(x.kind)}</b> ${esc(x.src)} → ${esc(x.dst)}: ${x.ok ? 'สำเร็จ' : 'ไม่สำเร็จ'}${x.note ? ' — ' + esc(x.note) : ''}</li>`).join('') + '</ol>' +
        '<div class="nls-topology-row"><button type="button" class="nls-topology-btn nls-topology-ghost nls-topology-small" data-act="log-clear">ล้างบันทึก</button></div>';
      if (el.log.__h !== h) { el.log.innerHTML = h; el.log.__h = h; }
    }
    function logText(n) { return S.log.slice(-(n || 8)).map((x) => `${x.at} ${x.kind} ${x.src} -> ${x.dst}: ${x.ok ? 'สำเร็จ' : 'ไม่สำเร็จ'}${x.note ? ' (' + x.note + ')' : ''}`); }

    function prepTest(src, dst) {
      dst = String(dst || '').trim();
      const sd = devById(src);
      if (!sd) { el.pres.innerHTML = '<p class="nls-topology-msg nls-topology-bad">เลือกเครื่องต้นทางก่อน</p>'; return null; }
      if (!dst) { el.pres.innerHTML = '<p class="nls-topology-msg nls-topology-bad">กรอก IP หรือชื่อปลายทางก่อน</p>'; el.pDst.focus(); return null; }
      if (sd.power === false) { el.pres.innerHTML = `<p class="nls-topology-msg nls-topology-bad">${esc(sd.name)} ปิดเครื่องอยู่ (Power off) จึงสั่งงานไม่ได้ — เปิดเครื่องก่อน (แผงตั้งค่าอุปกรณ์ หรือปุ่ม "เปิดเครื่อง" ในแถบที่เลือก)</p>`; setStatus(`${sd.name} ปิดเครื่องอยู่`, true); return null; }
      setTab('test');
      return { sd, dst, target: dst.slice(0, 120) };
    }
    function hopRows(t, bad, expect) {
      const name = (id) => { const d = devById(id); return d ? d.name : id; };
      const rows = t.hops.map((h, i) => {
        const failRow = bad && i === t.failHop && !h.ok;
        const cls = failRow ? 'nls-topology-h-fail' : h.proto === 'arp' ? 'nls-topology-h-arp' : h.phase === 'reply' ? 'nls-topology-h-rep' : 'nls-topology-h-req';
        return `<li class="${cls}" data-hop="${i}" tabindex="0" role="button" aria-label="ขั้นที่ ${i + 1}: ${esc(h.text)} (แตะเพื่อดูเฟรม)">${esc(h.text)}</li>`;
      });
      if (bad && t.wrongResponder) rows.push(`<li class="nls-topology-h-fail" data-hop="end">${esc(name(t.responder))} ตอบแทน ${esc(name(expect))}: ${esc(t.title)}</li>`);
      else if (bad) rows.push(`<li class="nls-topology-h-fail" data-hop="end">หยุดที่ ${esc(name(t.stopAt))}: ${esc(t.title)}</li>`);
      else rows.push(`<li class="nls-topology-h-rep" data-hop="end">${esc(t.msg)}</li>`);
      return rows.join('');
    }
    function reasonHtml(t, bad) {
      return bad ? `<p class="nls-topology-reason"><span class="nls-topology-rt">สาเหตุ: ${esc(t.title)}</span><br>${esc(t.msg)}</p>${t.hint ? `<p class="nls-topology-reason"><b>วิธีแก้:</b> ${esc(t.hint)}</p>` : ''}` : (t.warn ? `<p class="nls-topology-reason" style="color:var(--orange)">คำเตือน: ${esc(t.warn)}</p>` : '');
    }
    const LEGEND = '<div class="nls-topology-legend" aria-hidden="true"><span style="--c:var(--blue)">ARP</span><span style="--c:var(--orange)">Echo Request</span><span style="--c:var(--ok)">Echo Reply</span><span style="--c:var(--bad)">จุดที่ล้มเหลว</span><span style="--c:var(--muted)">สำเนาเฟรม (flood)</span></div>';
    function runPing(src, dst, expectId) {
      const T = prepTest(src, dst); if (!T) return;
      const { sd, target } = T; dst = T.dst;
      const r = NS.create(S.topo).ping(src, target, { count: 4 });
      const expect = expectId || devOfIp(r.resolved);
      const t = simNet().trace(src, target, { expect });
      const bad = !t.ok || t.code === 'dup_ip';
      const prompt = sd.type === 'router' ? `${sd.name}# ping ${dst}` : `C:\\Users\\${sd.name}> ping ${dst}`;
      el.pres.innerHTML = `<div class="nls-topology-pres ${bad ? 'nls-topology-no' : 'nls-topology-ok'}" role="status"><b>${bad ? '✗ Ping ไม่สำเร็จ' : '✓ Ping สำเร็จ'}</b>
        <div>${esc(sd.name)} → ${esc(dst)}${t.resolved && t.resolved !== dst ? ' [' + esc(t.resolved) + ']' : ''}${bad ? '' : `: ได้รับคำตอบ ${r.replies}/4`}</div>${reasonHtml(t, bad)}</div>
        ${aclNatHtml(t)}
        <div class="nls-topology-row" style="justify-content:space-between"><b style="font-size:14px">เส้นทางของแพ็กเก็ต (แตะแต่ละขั้นเพื่อดูเฟรม)</b>${t.hops.length && !reduceMotion ? '<button type="button" class="nls-topology-btn nls-topology-ghost nls-topology-small" data-act="replay">เล่นซ้ำ</button>' : ''}</div>
        ${LEGEND}
        <ol class="nls-topology-hops" data-r="hops">${hopRows(t, bad, expect)}</ol>
        <div class="nls-topology-frame" data-r="frame" aria-live="polite"></div>
        <details class="nls-topology-out-wrap"${S.fs || isNarrow() ? '' : ' open'}><summary>ผลลัพธ์แบบ Command Prompt</summary><pre class="nls-topology-out" aria-label="ผลลัพธ์แบบ Command Prompt">${esc([prompt, ''].concat(r.win).join('\n'))}</pre></details>`;
      finishTest(src, t, bad, `Ping ${sd.name} → ${dst}: ${bad ? 'ไม่สำเร็จ — ' + t.title : `สำเร็จ (ได้รับคำตอบ ${r.replies}/4)`}`, () => tutRecordPing(src, expect, t, bad));
      updateEff();
      logTest({ kind: 'ping', src: sd.name, dst: dst + (t.resolved && t.resolved !== dst ? ' [' + t.resolved + ']' : ''), ok: !bad, note: bad ? t.title : `Reply ${r.replies}/4 TTL=${r.ttl}` });
    }
    function runTracert(src, dst) {
      const T = prepTest(src, dst); if (!T) return;
      const { sd, target } = T; dst = T.dst;
      const r = NS.create(S.topo).traceroute(src, target);
      const t = simNet().trace(src, target, { expect: devOfIp(r.resolved) });
      const bad = !r.ok;
      const linux = sd.type === 'router' || (sd.type !== 'pc' && sd.type !== 'laptop' && sd.os === 'linux');
      const prompt = sd.type === 'router' ? `${sd.name}# traceroute ${dst}` : linux ? `${sd.name}:~$ traceroute ${dst}` : `C:\\Users\\${sd.name}> tracert ${dst}`;
      const devName = (id) => { const d = devById(id); return d ? d.name : ''; };
      const hops = r.hops.map((h, i) => `<li>${i + 1}. ${h.timeout ? '* * * (ไม่ตอบ)' : `${esc(h.ip)} <span class="nls-topology-muted">${esc(devName(h.devId) || (h.devId ? h.devId : ''))}${h.unreachable ? ' — แจ้งว่าไปต่อไม่ได้' : ''}</span>`}</li>`).join('');
      el.pres.innerHTML = `<div class="nls-topology-pres ${bad ? 'nls-topology-no' : 'nls-topology-ok'}" role="status"><b>${bad ? '✗ Traceroute ไปไม่ถึงปลายทาง' : '✓ Traceroute ถึงปลายทาง'}</b>
        <div>${esc(sd.name)} → ${esc(dst)}${r.resolved && r.resolved !== dst ? ' [' + esc(r.resolved) + ']' : ''}: ${r.hops.length} hop</div>${bad ? reasonHtml(t, !t.ok) : ''}</div>
        <b style="font-size:14px">Router ที่ผ่าน (hop)</b><ol class="nls-topology-trhops">${hops || '<li>-</li>'}</ol>
        <p class="nls-topology-note">Traceroute ส่งแพ็กเก็ตโดยตั้ง TTL = 1, 2, 3 … ทีละรอบ Router ที่ทำให้ TTL หมดจะตอบกลับ (ICMP Time Exceeded) จึงรู้ว่าแพ็กเก็ตผ่าน Router ใดบ้าง (Switch ไม่ลด TTL จึงไม่ปรากฏ)</p>
        ${LEGEND}
        <ol class="nls-topology-hops" data-r="hops">${hopRows(t, !t.ok, null)}</ol>
        <div class="nls-topology-frame" data-r="frame" aria-live="polite"></div>
        <details class="nls-topology-out-wrap"${S.fs || isNarrow() ? '' : ' open'}><summary>ผลลัพธ์แบบ Command Prompt</summary><pre class="nls-topology-out">${esc([prompt, ''].concat(linux ? r.linux : r.win).join('\n'))}</pre></details>`;
      finishTest(src, t, !t.ok, `Traceroute ${sd.name} → ${dst}: ${bad ? 'ไปไม่ถึงปลายทาง' : `ถึงปลายทาง ${r.hops.length} hop`}`, null);
      logTest({ kind: 'traceroute', src: sd.name, dst, ok: !bad, note: r.hops.map((h) => h.timeout ? '*' : h.ip).join(' > ') });
    }
    // 3.1: ACL decisions and NAT translations of one test + the NAT tables of every NAT router
    const devName = (id) => { const d = devById(id); return d ? d.name : id; };
    function aclNatHtml(t) {
      let h = '';
      if (t.acl && t.acl.length) {
        h += '<b style="font-size:14px">กฎ ACL ที่ตรง</b><ul class="nls-topology-aclres">' + t.acl.map((a) => `<li class="${a.permit ? 'nls-topology-p' : 'nls-topology-d'}">${a.phase === 'reply' ? 'ขากลับ' : 'ขาไป'} ${esc(a.pkt)}: ${esc(devName(a.dev))} ACL "${esc(a.acl)}" ขา ${esc(a.iface)} ${a.dir === 'in' ? 'in' : 'out'} — ${a.implicit ? 'ไม่ตรงกฎข้อใด → <b>implicit deny</b>' : `ข้อ ${a.n}: <code>${esc(a.text)}</code>`} → <b>${a.permit ? 'permit (ผ่าน)' : 'deny (ทิ้ง)'}</b></li>`).join('') + '</ul>';
      }
      if (t.nat && t.nat.length) {
        h += '<b style="font-size:14px">การแปลง NAT ในการทดสอบนี้</b><ul class="nls-topology-aclres">' + t.nat.map((x) => `<li class="nls-topology-x">${x.phase === 'reply' ? 'ขากลับ' : 'ขาไป'}: ${esc(devName(x.dev))} (${x.kind === 'PAT' ? 'PAT' : 'Static NAT'}) แปลง${x.field === 'src' ? 'ต้นทาง' : 'ปลายทาง'} <code>${esc(x.from)}</code> → <code>${esc(x.to)}</code></li>`).join('') + '</ul>';
      }
      const rs = S.topo.devices.filter((d) => d.type === 'router' && (isObj(d.nat) || d.ifaces.some((f) => f.nat)));
      rs.forEach((d) => { h += `<details class="nls-topology-out-wrap"${t.nat && t.nat.length ? ' open' : ''}><summary>ตาราง NAT ของ ${esc(d.name)} (show ip nat translations)</summary>${natTableHtml(d)}</details>`; });
      return h;
    }
    function natTableHtml(d, compact) {
      const rows = simNet().natTable(d.id);
      if (!rows.length) return `<p class="nls-topology-note">${isObj(d.nat) ? 'ยังไม่มีรายการแปลง — ทดสอบจากเครื่องภายในออกไปอินเทอร์เน็ต (หรือจากภายนอกเข้ามา) แล้วรายการจะปรากฏ' : 'ยังไม่ได้ตั้ง PAT / Static NAT'}</p>`;
      const show = compact ? rows.slice(-12) : rows.slice(-40);
      return `<div class="nls-topology-mxwrap"><table class="nls-topology-mac nls-topology-nattab"><thead><tr><th>Pro</th><th>Inside global</th><th>Inside local</th><th>Outside local</th><th>Outside global</th></tr></thead><tbody>${show.map((r) => `<tr><td>${esc(r.proto)}${r.type === 'static' ? ' <small>(static)</small>' : ''}</td><td>${esc(r.insideGlobal)}</td><td>${esc(r.insideLocal)}</td><td>${esc(r.outsideLocal || '---')}</td><td>${esc(r.outsideGlobal || '---')}</td></tr>`).join('')}</tbody></table></div>
        <p class="nls-topology-note">Inside local = IP จริงของเครื่องภายใน • Inside global = IP:พอร์ตที่คนภายนอกเห็น${rows.length > show.length ? ` • แสดง ${show.length} จาก ${rows.length} รายการล่าสุด` : ''}</p>`;
    }
    const LEGEND_L4 = '<div class="nls-topology-legend" aria-hidden="true"><span style="--c:var(--blue)">ARP</span><span style="--c:var(--orange)">ขาไป (SYN / Request)</span><span style="--c:var(--ok)">ขากลับ (SYN-ACK / Reply)</span><span style="--c:var(--bad)">จุดที่ล้มเหลว</span></div>';
    function runConnect(src, dst, proto, port) {
      const T = prepTest(src, dst); if (!T) return;
      const { sd, target } = T; dst = T.dst;
      const t = simNet().trace(src, target, { proto, port });
      const bad = !t.ok || t.code === 'dup_ip';
      const P = proto.toUpperCase(), pn = t.port || port;
      const win = sd.type === 'pc' || sd.type === 'laptop' || (sd.type !== 'router' && sd.os !== 'linux');
      const ip = t.resolved || dst;
      const cfg = simNet().config(src) || {};
      const out = proto === 'tcp' && win
        ? [`PS C:\\Users\\${sd.name}> Test-NetConnection ${dst} -Port ${pn}`, '', `ComputerName     : ${dst}`, `RemoteAddress    : ${ip}`, `RemotePort       : ${pn}`, `SourceAddress    : ${cfg.ip || '-'}`, `TcpTestSucceeded : ${bad ? 'False' : 'True'}`].concat(bad ? ['', `WARNING: TCP connect to ${ip}:${pn} failed`] : [])
        : [`${sd.type === 'router' ? sd.name + '#' : sd.name + ':~$'} nc -${proto === 'udp' ? 'u' : ''}zv ${dst} ${pn}`,
          !bad ? `Connection to ${ip} ${pn} port [${proto}] succeeded!` : t.code === 'refused' ? `nc: connect to ${ip} port ${pn} (${proto}) failed: Connection refused` : t.code === 'port_unreachable' ? `nc: ${ip} ${pn} (${proto}): port unreachable` : `nc: connect to ${ip} port ${pn} (${proto}) failed: Connection timed out`];
      el.pres.innerHTML = `<div class="nls-topology-pres ${bad ? 'nls-topology-no' : 'nls-topology-ok'}" role="status"><b>${bad ? `✗ เชื่อมต่อ ${P} ${esc(pn)} ไม่สำเร็จ` : `✓ เชื่อมต่อ ${P} ${esc(pn)} สำเร็จ`}</b>
        <div>${esc(sd.name)} → ${esc(dst)}${t.resolved && t.resolved !== dst ? ' [' + esc(t.resolved) + ']' : ''}:${esc(pn)}${!bad && t.responder ? ' — ตอบโดย ' + esc(devName(t.responder)) : ''}</div>${reasonHtml(t, bad)}${!bad ? `<p class="nls-topology-reason">${esc(t.msg)}</p>` : ''}</div>
        ${aclNatHtml(t)}
        <div class="nls-topology-row" style="justify-content:space-between"><b style="font-size:14px">เส้นทางของแพ็กเก็ต (แตะแต่ละขั้นเพื่อดูเฟรม)</b>${t.hops.length && !reduceMotion ? '<button type="button" class="nls-topology-btn nls-topology-ghost nls-topology-small" data-act="replay">เล่นซ้ำ</button>' : ''}</div>
        ${LEGEND_L4}
        <ol class="nls-topology-hops" data-r="hops">${hopRows(t, bad, null)}</ol>
        <div class="nls-topology-frame" data-r="frame" aria-live="polite"></div>
        <details class="nls-topology-out-wrap"${S.fs || isNarrow() ? '' : ' open'}><summary>ผลลัพธ์แบบ Command line</summary><pre class="nls-topology-out">${esc(out.join('\n'))}</pre></details>`;
      finishTest(src, t, bad, `ทดสอบ ${P} ${pn}: ${sd.name} → ${dst}: ${bad ? 'ไม่สำเร็จ — ' + t.title : 'สำเร็จ'}`, null);
      logTest({ kind: `${proto} ${pn}`, src: sd.name, dst: dst + (t.resolved && t.resolved !== dst ? ' [' + t.resolved + ']' : ''), ok: !bad, note: bad ? t.title : 'ตอบโดย ' + devName(t.responder) });
      updateEff();
    }
    function finishTest(src, t, bad, statusText, onDone) {
      const ids = [];
      t.hops.filter((h) => h.phase === 'request' && h.proto !== 'arp').forEach((h) => h.path.forEach((id) => { if (ids[ids.length - 1] !== id) ids.push(id); }));
      if (!ids.length) ids.push(src);
      S.pingPath = { ids, ok: !bad };
      S.lastTrace = { t, bad };
      setStatus(statusText, bad);
      draw();
      updateMac();
      if (S.stepMode) { if (onDone) onDone(); startStep(); }
      else animateTrace(t, bad, onDone);   // the tutorial counts the ping when the student has seen the packet arrive
    }

    // ---- packet animation + simulation controls (speed, step-by-step) + Ethernet frame inspector
    let animDone = null;
    const posOf = (id) => { const d = devById(id); return d ? { x: d.x, y: d.y } : null; };
    function hopMark(i) {
      const list = el.pres.querySelector('[data-r=hops]');
      if (!list) return;
      list.querySelectorAll('li').forEach((li) => {
        const k = li.getAttribute('data-hop'), n = k === 'end' ? Infinity : +k;
        li.classList.toggle('nls-topology-h-now', i !== null && n === i);
        li.classList.toggle('nls-topology-h-wait', i !== null && n > i);
      });
    }
    function endMark(t, bad) {
      el.anim.replaceChildren();
      hopMark(null);
      if (animDone) { const f = animDone; animDone = null; f(); }
      const at = posOf(t.stopAt) || posOf(t.src);
      if (!at) return;
      const g = mk('g', { transform: `translate(${at.x} ${at.y - 46})`, 'pointer-events': 'none' });
      const col = bad ? 'var(--bad)' : 'var(--ok)';
      g.appendChild(mk('circle', { r: '11', fill: 'var(--panel)', stroke: col, 'stroke-width': '2' }));
      g.appendChild(mk('path', { d: bad ? 'M-5 -5 L5 5 M5 -5 L-5 5' : 'M-5 0 L-1 4 L6 -4', stroke: col, 'stroke-width': '3', 'stroke-linecap': 'round', fill: 'none' }));
      const txt = mk('text', { x: '18', y: '5', 'font-size': '14', 'font-weight': '700', fill: col });
      txt.textContent = bad ? t.title : 'ตอบกลับสำเร็จ';
      const bg = mk('rect', { x: '12', y: '-12', height: '24', rx: '6', fill: 'var(--panel)', stroke: col, 'stroke-width': '1.5' });
      g.appendChild(bg); g.appendChild(txt);
      el.anim.appendChild(g);
      let w = 0; try { w = txt.getComputedTextLength(); } catch (e) { w = 0; }
      const bw = Math.max(40, (w || txt.textContent.length * 8) + 14);
      bg.setAttribute('width', String(bw));
      // keep the label inside the visible canvas
      const right = S.vb.x + S.vb.w - 8, left = S.vb.x + 8;
      let gx = at.x;
      if (gx + 12 + bw > right) gx = Math.max(left + 12, right - 12 - bw);
      let gy = at.y - 46; if (gy - 14 < S.vb.y) gy = at.y + 46;
      g.setAttribute('transform', `translate(${gx} ${gy})`);
    }
    function hopsShown(t, bad) { return t.hops.filter((h, i) => !bad || i <= t.failHop || t.failHop < 0); }
    function segsOf(t, bad) {
      const segs = [];
      hopsShown(t, bad).forEach((h) => {
        const i = t.hops.indexOf(h);
        const pts = h.path.map(posOf).filter(Boolean);
        const color = h.proto === 'arp' ? 'var(--blue)' : h.phase === 'reply' ? 'var(--ok)' : 'var(--orange)';
        if (!h.ok || pts.length < 2) { segs.push({ i, pulse: pts[0] || posOf(h.from), color: h.ok ? color : 'var(--bad)', dur: 900 }); return; }
        let L = 0; for (let k = 1; k < pts.length; k++) L += Math.hypot(pts[k].x - pts[k - 1].x, pts[k].y - pts[k - 1].y);
        segs.push({ i, pts, L, color, dur: Math.max(380, Math.min(1300, (h.proto === 'arp' ? 220 : 320) + L * (h.proto === 'arp' ? 0.9 : 1.3))) });
      });
      return segs;
    }
    // faint copies of the frame at devices that also received it (hub repeat / unknown-unicast flood / ARP broadcast)
    function drawFlood(h) {
      (h.flood || []).forEach((id) => {
        const p = posOf(id); if (!p) return;
        el.anim.appendChild(mk('circle', { cx: p.x, cy: p.y, r: '24', fill: 'none', stroke: 'var(--muted)', 'stroke-width': '2.5', 'stroke-dasharray': '4 4', 'pointer-events': 'none', 'data-flood': '1' }));
        const tx = mk('text', { x: p.x, y: p.y - 30, 'font-size': '11', 'text-anchor': 'middle', fill: 'var(--muted)', stroke: 'var(--panel)', 'stroke-width': '3', 'paint-order': 'stroke', 'pointer-events': 'none', 'data-flood': '1' });
        tx.textContent = h.proto === 'arp' ? 'ได้รับ broadcast' : 'ได้สำเนา (ทิ้ง)';
        el.anim.appendChild(tx);
      });
    }
    function animateTrace(t, bad, onDone) {
      if (rafAnim) cancelAnimationFrame(rafAnim);
      rafAnim = 0;
      if (animDone) { const f = animDone; animDone = null; f(); }
      animDone = onDone || null;
      el.anim.replaceChildren();
      const segs = segsOf(t, bad);
      if (reduceMotion || !segs.length) { endMark(t, bad); showFrame(t, segs.length ? segs[segs.length - 1].i : -1); return; }
      const dot = mk('circle', { r: '9', fill: 'var(--orange)', stroke: 'var(--panel)', 'stroke-width': '2.5', 'pointer-events': 'none' });
      const tag = mk('text', { 'font-size': '12', 'font-weight': '700', 'text-anchor': 'middle', fill: 'var(--ink)', stroke: 'var(--panel)', 'stroke-width': '3', 'paint-order': 'stroke', 'pointer-events': 'none' });
      const ring = mk('circle', { r: '10', fill: 'none', 'stroke-width': '3', 'pointer-events': 'none' });
      el.anim.append(dot, tag, ring);
      let si = 0, t0 = performance.now();
      const enter = (k) => { hopMark(segs[k].i); showFrame(t, segs[k].i); el.anim.querySelectorAll('[data-flood]').forEach((n) => n.remove()); drawFlood(t.hops[segs[k].i]); };
      enter(0);
      const step = (now) => {
        if (destroyed) return;
        const sg = segs[si];
        const k = Math.min(1, (now - t0) / (sg.dur / (S.speed || 1)));
        drawSeg(sg, k, t, dot, tag, ring);
        if (k < 1) { rafAnim = requestAnimationFrame(step); return; }
        si++;
        if (si >= segs.length) { rafAnim = 0; endMark(t, bad); return; }
        t0 = now; enter(si);
        rafAnim = requestAnimationFrame(step);
      };
      rafAnim = requestAnimationFrame(step);
    }
    function drawSeg(sg, k, t, dot, tag, ring) {
      if (sg.pulse) {
        dot.setAttribute('cx', sg.pulse.x); dot.setAttribute('cy', sg.pulse.y); dot.setAttribute('fill', sg.color);
        ring.setAttribute('cx', sg.pulse.x); ring.setAttribute('cy', sg.pulse.y); ring.setAttribute('r', String(10 + k * 50));
        ring.setAttribute('stroke', sg.color); ring.setAttribute('opacity', String(1 - k));
        tag.setAttribute('x', sg.pulse.x); tag.setAttribute('y', sg.pulse.y - 16); tag.textContent = t.hops[sg.i] && t.hops[sg.i].proto === 'arp' ? 'ARP ?' : '✗';
        return;
      }
      ring.setAttribute('opacity', '0');
      let dist = k * sg.L, j = 0;
      while (j < sg.pts.length - 2 && dist > Math.hypot(sg.pts[j + 1].x - sg.pts[j].x, sg.pts[j + 1].y - sg.pts[j].y)) { dist -= Math.hypot(sg.pts[j + 1].x - sg.pts[j].x, sg.pts[j + 1].y - sg.pts[j].y); j++; }
      const a = sg.pts[j], b = sg.pts[j + 1] || a, Lj = Math.hypot(b.x - a.x, b.y - a.y) || 1, f = Math.min(1, dist / Lj);
      const x = a.x + (b.x - a.x) * f, y = a.y + (b.y - a.y) * f;
      dot.setAttribute('cx', x); dot.setAttribute('cy', y); dot.setAttribute('fill', sg.color);
      const h = t.hops[sg.i];
      tag.setAttribute('x', x); tag.setAttribute('y', y - 15); tag.textContent = h.proto === 'arp' ? 'ARP' : h.phase === 'reply' ? 'Reply' : 'Request';
    }
    // step-by-step mode: the student moves the packet one hop at a time and reads the frame of each hop
    function startStep() {
      if (rafAnim) { cancelAnimationFrame(rafAnim); rafAnim = 0; }
      if (animDone) { const f = animDone; animDone = null; f(); }
      S.stepIdx = 0; showStep();
    }
    function showStep() {
      const L = S.lastTrace; if (!L) return;
      const segs = segsOf(L.t, L.bad);
      updateSimCtl();
      if (!segs.length || S.stepIdx >= segs.length) { endMark(L.t, L.bad); showFrame(L.t, segs.length ? segs[segs.length - 1].i : -1); return; }
      el.anim.replaceChildren();
      const sg = segs[S.stepIdx];
      const dot = mk('circle', { r: '9', fill: 'var(--orange)', stroke: 'var(--panel)', 'stroke-width': '2.5', 'pointer-events': 'none' });
      const tag = mk('text', { 'font-size': '12', 'font-weight': '700', 'text-anchor': 'middle', fill: 'var(--ink)', stroke: 'var(--panel)', 'stroke-width': '3', 'paint-order': 'stroke', 'pointer-events': 'none' });
      const ring = mk('circle', { r: '10', fill: 'none', 'stroke-width': '3', 'pointer-events': 'none' });
      if (sg.pts) el.anim.appendChild(mk('polyline', { points: sg.pts.map((p) => p.x + ',' + p.y).join(' '), fill: 'none', stroke: sg.color, 'stroke-width': '5', opacity: '0.5', 'stroke-linecap': 'round', 'pointer-events': 'none' }));
      drawFlood(L.t.hops[sg.i]);
      el.anim.append(dot, tag, ring);
      drawSeg(sg, sg.pulse ? 0.35 : 1, L.t, dot, tag, ring);
      hopMark(sg.i); showFrame(L.t, sg.i);
    }
    function updateSimCtl() {
      const L = S.lastTrace, n = L ? segsOf(L.t, L.bad).length : 0;
      const prev = root.querySelector('[data-act=sim-prev]'), next = root.querySelector('[data-act=sim-next]');
      if (prev) prev.disabled = !S.stepMode || !L || S.stepIdx <= 0;
      if (next) next.disabled = !S.stepMode || !L || S.stepIdx >= n;
    }
    // Ethernet frame inspector for hop i of trace t
    function showFrame(t, i) {
      const box = el.pres.querySelector('[data-r=frame]');
      if (!box) return;
      const h = t && i >= 0 ? t.hops[i] : null;
      if (!h || !h.frame) { box.innerHTML = ''; return; }
      const f = h.frame;
      const nm = (id) => { const d = devById(id); return d ? d.name : id; };
      const macOwner = (mac) => {
        if (!mac || /^FF-FF/.test(mac)) return 'ทุกเครื่อง (Broadcast)';
        const n = simNet();
        for (const d of S.topo.devices) { const c = n.config(d.id); if (!c) continue; if (c.mac === mac) return d.name; const fi = (c.ifaces || []).find((x) => x.mac === mac); if (fi) return d.name + ' ' + fi.iface; }
        return '';
      };
      const via = h.path.slice(1, -1).map(nm);
      let rows;
      if (/ARP/.test(f.type)) {
        rows = [['ชนิด (EtherType)', f.type], ['MAC ต้นทาง', `${f.srcMac} (${macOwner(f.srcMac)})`], ['MAC ปลายทาง', `${f.dstMac} (Broadcast)`],
          ['คำถาม ARP', `ใครใช้ IP ${f.targetIp}? บอก ${f.senderIp}`], ['คำตอบ', f.replyMac ? `${f.targetIp} อยู่ที่ ${f.replyMac} (${macOwner(f.replyMac)})` : 'ไม่มีใครตอบ']];
      } else {
        rows = [['ชนิด (EtherType)', f.type], ['MAC ต้นทาง', `${f.srcMac} (${macOwner(f.srcMac)})`], ['MAC ปลายทาง', `${f.dstMac} (${macOwner(f.dstMac)})`],
          ['IP ต้นทาง → ปลายทาง', f.srcPort ? `${f.srcIp}:${f.srcPort} → ${f.dstIp}:${f.dstPort}` : `${f.srcIp} → ${f.dstIp}`], ['TTL', String(f.ttl)],
          ['โปรโตคอล', f.proto === 'TCP' ? (h.phase === 'reply' ? 'TCP SYN-ACK (ตอบรับ) / RST (ปฏิเสธ)' : 'TCP SYN (ขอเชื่อมต่อ)') : f.proto === 'UDP' ? 'UDP' : f.proto + (h.phase === 'reply' ? ' Echo Reply' : ' Echo Request')]];
      }
      rows.push(['ผ่านอุปกรณ์ชั้น 2', via.length ? via.join(' → ') : 'ไม่ผ่าน (ต่อตรง)']);
      let note = '';
      const hubs = h.path.slice(1, -1).map(devById).filter((d) => d && d.type === 'hub');
      if (h.flood && h.flood.length) {
        note = h.proto === 'arp' ? `ARP request เป็น Broadcast: ${h.flood.map(nm).join(', ')} ได้รับด้วย แต่ไม่ตอบเพราะไม่ใช่ IP ของตัวเอง`
          : hubs.length ? `${hubs.map((d) => d.name).join(', ')} เป็น Hub: ทวนสัญญาณออกทุกพอร์ต ${h.flood.map(nm).join(', ')} ได้รับสำเนาด้วยและทิ้งไปเพราะ MAC ปลายทางไม่ใช่ของตัวเอง (เปลืองแบนด์วิดท์และชนกันได้)`
          : `Switch ยังไม่มี MAC ปลายทางในตาราง จึงส่งออกทุกพอร์ต (Unknown unicast flooding): ${h.flood.map(nm).join(', ')} ได้รับสำเนาด้วย`;
      } else if (h.proto !== 'arp' && via.length) note = 'Switch รู้จัก MAC ปลายทางในตารางแล้ว จึงส่งออกเฉพาะพอร์ตเดียว เครื่องอื่นไม่ได้รับเฟรมนี้';
      if (h.natNote) note += (note ? ' • ' : '') + h.natNote + ' — NAT เปลี่ยน IP/พอร์ตในส่วนหัว IP ส่วน MAC เปลี่ยนทุกช่วงอยู่แล้ว';
      else if (h.proto !== 'arp' && i > 0 && t.hops.slice(0, i).some((x) => x.proto !== 'arp' && x.phase === h.phase)) note += (note ? ' • ' : '') + 'เมื่อผ่าน Router: MAC ต้นทาง/ปลายทางเปลี่ยนทุกช่วง แต่ IP ต้นทาง/ปลายทางคงเดิม และ TTL ลดลง 1';
      box.innerHTML = `<b>เฟรม Ethernet ขั้นที่ ${i + 1}: ${esc(nm(h.from))} → ${esc(h.to ? nm(h.to) : '?')}</b><dl>${rows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>${note ? `<p class="nls-topology-note">${esc(note)}</p>` : ''}`;
    }
    on(el.pres, 'click', (e) => {
      const b = e.target.closest ? e.target.closest('[data-act=replay]') : null;
      if (b && S.lastTrace) { if (S.stepMode) startStep(); else animateTrace(S.lastTrace.t, S.lastTrace.bad); return; }
      const li = e.target.closest ? e.target.closest('[data-hop]') : null;
      if (li && S.lastTrace && li.getAttribute('data-hop') !== 'end') {
        const i = +li.getAttribute('data-hop');
        const segs = segsOf(S.lastTrace.t, S.lastTrace.bad), k = segs.findIndex((x) => x.i === i);
        if (k >= 0) { if (rafAnim) { cancelAnimationFrame(rafAnim); rafAnim = 0; } if (animDone) { const f = animDone; animDone = null; f(); } S.stepIdx = k; showStep(); }
      }
    });
    on(el.pres, 'keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[data-hop]')) { e.preventDefault(); e.target.click(); } });
    on(el.pDst, 'keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); S.pingSrc = el.pSrc.value; runTest(el.pSrc.value, el.pDst.value); } });
    on(el.pPort, 'keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); S.pingSrc = el.pSrc.value; runTest(el.pSrc.value, el.pDst.value); } });
    function svcOf() {
      const v = String(el.pSvc.value || 'icmp'); if (v === 'icmp') return { proto: 'icmp', port: null, custom: false };
      const [proto, port] = v.split(':');
      return { proto, port: port ? +port : String(el.pPort.value || '').trim(), custom: !port };
    }
    function updateSvc() {
      const sv = svcOf();
      el.portWrap.hidden = !sv.custom;
      el.goBtn.textContent = sv.proto === 'icmp' ? 'ส่ง Ping' : `ทดสอบ ${sv.proto.toUpperCase()}${sv.custom ? '' : ' ' + sv.port}`;
    }
    on(el.pSvc, 'change', updateSvc);
    function runTest(src, dst) {
      const sv = svcOf();
      if (sv.proto === 'icmp') { runPing(src, dst); return; }
      if (sv.custom && !NS.acl.parsePort(sv.port).port) { el.pres.innerHTML = '<p class="nls-topology-msg nls-topology-bad">ใส่พอร์ตปลายทาง 1–65535 (เช่น 8080)</p>'; el.pPort.focus(); return; }
      runConnect(src, dst, sv.proto, sv.port);
    }
    root.querySelectorAll('[data-sim]').forEach((n) => on(n, 'change', () => {
      if (n.getAttribute('data-sim') === 'speed') S.speed = +n.value || 1;
      else { S.stepMode = n.checked; if (S.stepMode && S.lastTrace) startStep(); updateSimCtl(); }
    }));
    function setTab(name, focus) {
      root.querySelectorAll('[data-tab]').forEach((b) => { const on1 = b.getAttribute('data-tab') === name; b.setAttribute('aria-selected', String(on1)); b.tabIndex = on1 ? 0 : -1; if (on1 && focus) b.focus(); });
      root.querySelectorAll('[data-panel]').forEach((p) => { p.hidden = p.getAttribute('data-panel') !== name; });
      S.tab = name;
    }
    root.querySelectorAll('[data-tab]').forEach((b) => {
      on(b, 'click', () => setTab(b.getAttribute('data-tab')));
      on(b, 'keydown', (e) => {
        const tabs = Array.from(root.querySelectorAll('[data-tab]')), i = tabs.indexOf(b);
        const k = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (k) { e.preventDefault(); setTab(tabs[(i + k + tabs.length) % tabs.length].getAttribute('data-tab'), true); }
      });
    });
    // MAC address table / collision domains of the selected switch, hub or access point (from the persistent network)
    function updateMac() {
      const box = el.props.querySelector('[data-r=mac]');
      const d = S.sel && S.sel.kind === 'dev' ? devById(S.sel.id) : null;
      if (!box || !d || !L2[d.type]) return;
      const n = simNet();
      const owner = new Map();
      S.topo.devices.forEach((x) => { const c = n.config(x.id); if (!c) return; if (c.mac) owner.set(c.mac, x.name); (c.ifaces || []).forEach((f) => { if (f.mac) owner.set(f.mac, x.name + ' ' + f.iface); }); });
      const doms = n.collisionDomains().filter((c) => c.via === d.id || S.topo.links.some((l) => c.links.includes(l.id) && (l.a.dev === d.id || l.b.dev === d.id)));
      let h;
      if (d.type === 'hub') {
        const dm = doms[0];
        h = `<b>ตาราง MAC</b><p class="nls-topology-note">Hub ไม่มีตาราง MAC: ทำงานชั้น Physical ทวนสัญญาณทุกเฟรมออกทุกพอร์ต (ไม่ดู MAC address)</p>
          <p class="nls-topology-note">Collision domain: <b>1 โดเมนร่วมกัน</b>${dm ? ` (${dm.devs.length} อุปกรณ์: ${esc(dm.devs.map((id) => (devById(id) || {}).name || id).join(', '))})` : ''} — ส่งพร้อมกันได้ทีละเครื่อง (Half-duplex, CSMA/CD) ยิ่งเครื่องมากยิ่งช้า</p>`;
      } else {
        const rows = n.macTable(d.id);
        h = `<b>ตาราง MAC (show mac address-table)</b>`;
        h += rows.length ? `<table class="nls-topology-mac"><thead><tr><th>พอร์ต</th><th>MAC address</th><th>อุปกรณ์</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${esc(r.port)}</td><td>${esc(r.mac)}</td><td>${esc(owner.get(r.mac) || '-')}</td></tr>`).join('')}</tbody></table>`
          : `<p class="nls-topology-note">ตารางยังว่าง — ${esc(d.type === 'ap' ? 'AP' : 'Switch')} เรียนรู้ MAC ต้นทางของทุกเฟรมที่ผ่าน ลองส่ง Ping ผ่านอุปกรณ์นี้แล้วดูตารางเติมเอง</p>`;
        if (d.type === 'switch') h += `<p class="nls-topology-note">Collision domain: แยกทุกพอร์ต (ตอนนี้ใช้งาน ${doms.length} โดเมน) แต่ละพอร์ตส่ง-รับพร้อมกันได้ (Full-duplex)</p>`;
        else if (d.type === 'ap') { const w = doms.find((c) => c.kind === 'wifi'); if (w) h += `<p class="nls-topology-note">คลื่น Wi-Fi เป็นสื่อกลางที่ใช้ร่วมกัน: เครื่อง Wi-Fi ${w.devs.filter((id) => id !== d.id).length} เครื่องผลัดกันส่ง (CSMA/CA)</p>`; }
        h += '<button type="button" class="nls-topology-btn nls-topology-ghost nls-topology-small" data-act="macclear">ล้างตาราง MAC</button>';
      }
      if (box.__h !== h) { box.innerHTML = h; box.__h = h; }
    }
    on(el.pSrc, 'change', () => { S.pingSrc = el.pSrc.value; });

    // ------------------------------------------------------------ guided tutorial (mission t8)
    // Every checklist item is computed from the NetSim state of the current drawing (S.topo); ping items also need a
    // ping the student really ran (recorded from NetSim.trace) AND a fresh ping that still succeeds now.
    const TUT_ID = 't8';
    const hasTut = !!missionById(TUT_ID);
    const TUT_STEPS = [
      { title: 'วาง PC 2 เครื่อง', text: 'วาง PC 2 เครื่องลงบนพื้นที่วาด: แตะปุ่ม PC แล้วแตะบนพื้นที่วาด (หรือลากปุ่มมาวาง) ทำ 2 ครั้ง',
        why: 'เครือข่ายเริ่มจากเครื่องอย่างน้อย 2 เครื่องที่ต้องการสื่อสารกัน',
        hints: ['ปุ่ม PC อยู่แถวแรกของแถบอุปกรณ์ แตะปุ่มซ้ำ 2 ครั้งติดกันเพื่อวางกลางจอได้เลย'] },
      { title: 'วาง Switch', text: 'วาง Switch 1 ตัว ไว้ระหว่าง PC ทั้งสองเครื่อง',
        why: 'Switch เป็นจุดรวมสาย ส่งต่อเฟรมไปยังพอร์ตของเครื่องปลายทางตาม MAC address',
        hints: ['ปุ่ม Switch อยู่ในแถบอุปกรณ์เดียวกับ PC (ไอคอนกล่องมีหลายพอร์ต)'] },
      { title: 'ต่อสายเข้า Switch', text: 'เลือกเครื่องมือ "สาย UTP" แตะ PC แล้วแตะ Switch ทำให้ครบทั้งสองเครื่อง',
        why: 'ถ้าไม่มีสาย สัญญาณไฟฟ้าก็ไปไม่ถึงกัน ไม่ว่าตั้งค่าถูกแค่ไหน (ชั้น Physical)',
        hints: ['หลังเลือก "สาย UTP" แตะ PC1 (มีวงสีส้มล้อม) แล้วแตะ Switch ระบบเลือกพอร์ตว่างให้เอง', 'ทำแบบเดียวกันกับ PC2 สายที่ใช้งานได้จะไม่มีกากบาทสีแดง'] },
      { title: 'ตั้ง IP / Subnet mask', text: 'เลือกเครื่องมือ "เลือก/ย้าย" แตะ PC แต่ละเครื่อง แล้วใส่ IP และ Subnet mask ให้อยู่วงเดียวกัน เช่น 192.168.1.10 และ 192.168.1.11 ใช้ mask 255.255.255.0',
        why: 'เครื่องในวงเดียวกันคุยกันได้โดยตรงผ่าน Switch โดยดูจาก Network address (IP AND Subnet mask) ที่ต้องเท่ากัน และ IP ห้ามซ้ำกัน',
        hints: ['Subnet mask พิมพ์ได้ทั้ง 255.255.255.0, /24 หรือ 24', 'สองเครื่องต้องต่างกันเฉพาะตัวเลขชุดสุดท้าย (เมื่อใช้ /24) เช่น .10 กับ .11'] },
      { title: 'สั่ง Ping ให้สำเร็จ', text: 'เลือกเครื่องมือ "ส่ง Ping" แตะ PC เครื่องที่ 1 แล้วแตะ PC เครื่องที่ 2 ดูแพ็กเก็ตวิ่งไปและกลับ',
        why: 'Ping ส่ง ICMP Echo Request ไปและรอ Echo Reply กลับมา เป็นวิธีพื้นฐานที่สุดในการทดสอบว่าเครือข่ายใช้งานได้',
        hints: ['สังเกตว่าก่อนส่ง Ping จริง เครื่องต้องถาม MAC ของปลายทางด้วย ARP (จุดสีน้ำเงิน) ก่อน'] },
      { title: 'หาสาเหตุเมื่อ IP ผิดวง', text: 'ระบบแอบเปลี่ยน IP ของ PC เครื่องหนึ่งให้อยู่คนละวง ให้ลอง Ping ดูสาเหตุที่ล้มเหลว แล้วแก้ IP ให้กลับมาอยู่วงเดียวกัน และ Ping อีกครั้ง',
        why: 'ปัญหาที่พบบ่อยที่สุดในห้องแล็บคือพิมพ์ IP ผิดวง เมื่อปลายทางอยู่ต่างวง เครื่องจะไม่ส่งตรงแต่ส่งหา Default Gateway ถ้าไม่ได้ตั้งไว้ก็ส่งไม่ออกเลย',
        hints: ['อ่านกล่อง "สาเหตุ" ใต้ปุ่ม ส่ง Ping แพ็กเก็ตจะหยุดที่เครื่องต้นทางเพราะไม่รู้จะส่งไปทางไหน', 'เปิดการตั้งค่าของเครื่องที่ถูกเปลี่ยน แล้วแก้ตัวเลขชุดที่ 3 ให้ตรงกับอีกเครื่อง'] },
      { title: 'ขยายเป็น 2 วงเครือข่าย', text: 'วาง Router ต่อขาหนึ่งเข้า Switch วงที่ 1 วาง PC เครื่องที่ 3 ต่อเข้า Router อีกขาหนึ่ง (วงที่ 2) ตั้ง IP ขา Router ทั้งสองขา ตั้ง IP และ Default gateway ให้ทุกเครื่อง แล้ว Ping ข้ามวง',
        why: 'Switch เชื่อมเครื่องในวงเดียวกัน ส่วน Router เชื่อมต่างวงเครือข่าย (ชั้น Network) เครื่องจะส่งแพ็กเก็ตที่ไปต่างวงให้ Default gateway คือ IP ของ Router ขาที่อยู่วงเดียวกับเครื่อง',
        hints: ['ตัวอย่าง: Router g0/0 = 192.168.1.1/24 (วงที่ 1), g0/1 = 192.168.2.1/24 (วงที่ 2), PC3 = 192.168.2.10/24',
          'Default gateway ของ PC1 และ PC2 = 192.168.1.1 ส่วน PC3 = 192.168.2.1 (ขาของ Router ที่อยู่วงเดียวกับเครื่อง)',
          'ต่อสาย UTP จาก Router ไป PC3 ได้โดยตรง หรือจะใช้ Switch ตัวที่ 2 ก็ได้'] }
    ];
    function tutFresh() { return { step: 0, max: 0, injected: null, sawFail: false, failMark: -1, pings: [], hints: {}, enteredDone: false }; }
    function tutClean(t) {
      const o = tutFresh();
      if (!isObj(t)) return o;
      const n = Math.floor(+t.step); o.step = n >= 0 && n <= TUT_STEPS.length ? n : 0;
      const m = Math.floor(+t.max); o.max = m >= o.step && m <= TUT_STEPS.length ? m : o.step;
      if (isObj(t.injected) && typeof t.injected.dev === 'string') o.injected = { dev: t.injected.dev, from: String(t.injected.from || ''), to: String(t.injected.to || '') };
      o.sawFail = t.sawFail === true;
      o.pings = Array.isArray(t.pings) ? t.pings.filter(isObj).slice(-40).map((p) => ({ src: String(p.src || ''), dev: String(p.dev || ''), ok: p.ok === true, code: String(p.code || ''), n: Math.floor(+p.n) || 0 })) : [];
      o.failMark = Number.isFinite(+t.failMark) ? Math.floor(+t.failMark) : -1;
      if (isObj(t.hints)) Object.keys(t.hints).forEach((k) => { const v = Math.floor(+t.hints[k]); if (v > 0 && v < 9) o.hints[k] = v; });
      o.enteredDone = t.enteredDone === true;
      return o;
    }
    S.tut = tutClean(S.tutDraft);
    let tutSeq = S.tut.pings.reduce((a, p) => Math.max(a, p.n), 0);
    let tutTimer = 0, tutLast = null, tutHtml = '', coachHtml = '';
    const pcsOf = () => S.topo.devices.filter((d) => d.type === 'pc').sort((a, b) => natCmp(a.id, b.id));
    function tutRecordPing(src, dev, t, bad) {
      if (S.cur !== TUT_ID) return;
      tutSeq++;
      S.tut.pings.push({ src, dev: t.responder && !t.wrongResponder ? t.responder : (dev || ''), ok: !bad, code: t.code, n: tutSeq });
      if (S.tut.pings.length > 40) S.tut.pings.shift();
      if (S.tut.step === 5 && S.tut.injected && bad) {
        const [A, B] = pcsOf();
        if (A && B && [A.id, B.id].includes(src) && [A.id, B.id].includes(dev)) { S.tut.sawFail = true; S.tut.failMark = tutSeq; }
      }
      saveDraft();
      tutUpdate();
    }
    // a recorded successful ping between x and y (either direction) after mark, which still works now
    function pingedOk(net0, x, y, after) {
      if (!x || !y) return false;
      const rec = S.tut.pings.some((p) => p.ok && p.n > (after || 0) && ((p.src === x.id && p.dev === y.id) || (p.src === y.id && p.dev === x.id)));
      if (!rec) return false;
      const ip = net0.config(y.id) && net0.config(y.id).ip;
      return !!ip && NS.create(S.topo).ping(x.id, ip, { count: 1 }).ok;
    }
    const pingedAny = (x, y) => !!x && !!y && S.tut.pings.some((p) => (p.src === x.id && p.dev === y.id) || (p.src === y.id && p.dev === x.id));
    function tutEval() {
      const net0 = NS.create(S.topo);
      const probs = net0.problems();
      const pcs = pcsOf(), A = pcs[0], B = pcs[1];
      const nm = (d, fb) => d ? d.name : fb;
      const sw = S.topo.devices.filter((d) => d.type === 'switch');
      const rs = S.topo.devices.filter((d) => d.type === 'router');
      const cfg = (d) => (d && net0.config(d.id)) || {};
      const toSwitch = (d) => !!d && S.topo.links.some((l) => (l.a.dev === d.id || l.b.dev === d.id) && (devById(l.a.dev === d.id ? l.b.dev : l.a.dev) || {}).type === 'switch' && (net0.linkState(l.id) || {}).active);
      const l2 = (d) => d ? net0.l2Domain(d.id) : [];
      const ipOk = (d) => { if (!d || d.dhcp) return false; const c = cfg(d); return !!c.ip && !c.apipa && !probs.some((p) => p.level === 'error' && p.dev === d.id && p.code !== 'gw_not_in_subnet' && p.code !== 'gw_self'); };
      const netOf = (d) => { const c = cfg(d); return c.ip ? c.network + '/' + c.prefix : null; };
      const dup = (a, b) => !!a && !!b && !!cfg(a).ip && cfg(a).ip === cfg(b).ip;
      const sameNet = A && B && ipOk(A) && ipOk(B) && netOf(A) === netOf(B) && !dup(A, B);
      const st = [];
      st.push([{ label: 'มี PC เครื่องที่ 1', ok: pcs.length >= 1 }, { label: 'มี PC เครื่องที่ 2', ok: pcs.length >= 2 }]);
      st.push([{ label: 'มี Switch 1 ตัว', ok: sw.length >= 1 }]);
      st.push([{ label: `${nm(A, 'PC เครื่องที่ 1')} ต่อสายเข้า Switch และสายใช้งานได้`, ok: toSwitch(A) },
        { label: `${nm(B, 'PC เครื่องที่ 2')} ต่อสายเข้า Switch และสายใช้งานได้`, ok: toSwitch(B) },
        { label: 'ทั้งสองเครื่องอยู่ในเครือข่ายสายเดียวกัน (Switch เดียวกัน)', ok: !!A && !!B && l2(A).includes(B.id) }]);
      st.push([{ label: `${nm(A, 'PC1')} มี IP และ Subnet mask ที่ถูกต้อง`, ok: ipOk(A) }, { label: `${nm(B, 'PC2')} มี IP และ Subnet mask ที่ถูกต้อง`, ok: ipOk(B) },
        { label: 'IP ไม่ซ้ำกัน', ok: !!A && !!B && ipOk(A) && ipOk(B) && !dup(A, B) }, { label: 'อยู่วงเครือข่ายเดียวกัน (Network address เท่ากัน)', ok: !!sameNet }]);
      st.push([{ label: `สั่ง Ping ระหว่าง ${nm(A, 'PC1')} กับ ${nm(B, 'PC2')}`, ok: pingedAny(A, B) },
        { label: 'ได้รับคำตอบ (Reply) สำเร็จ', ok: pingedOk(net0, A, B) }]);
      const inj = S.tut.injected, victim = inj ? devById(inj.dev) : B, other = victim === A ? B : A;
      st.push([{ label: `Ping ระหว่าง ${nm(A, 'PC1')} กับ ${nm(B, 'PC2')} แล้วเห็นว่าล้มเหลวพร้อมสาเหตุ`, ok: !!inj && S.tut.sawFail },
        { label: `แก้ IP ของ ${nm(victim, 'PC2')} ให้กลับมาอยู่วงเดียวกับ ${nm(other, 'PC1')}`, ok: !!inj && S.tut.sawFail && !!sameNet },
        { label: 'Ping อีกครั้งจนสำเร็จ', ok: !!inj && S.tut.sawFail && !!sameNet && pingedOk(net0, A, B, S.tut.failMark) }]);
      // step 7: router + network 2
      const R = rs.find((r) => A && l2(A).includes(r.id)) || rs[0] || null;
      const n1 = netOf(A);
      const rIfs = R ? (cfg(R).ifaces || []).filter((f) => f.ip && f.up && f.linked) : [];
      const rNets = rIfs.map((f) => f.network + '/' + f.prefix);
      const Cpc = pcs.slice(2).find((p) => R && l2(p).includes(R.id) && !(A && l2(p).includes(A.id))) || null;
      const Cnet = netOf(Cpc);
      const overlap = R && probs.some((p) => p.code === 'router_overlap' && p.dev === R.id);
      const legsOk = !!R && !overlap && new Set(rNets).size >= 2 && rNets.includes(n1);
      const cIpOk = !!Cpc && ipOk(Cpc) && !!Cnet && Cnet !== n1 && rNets.includes(Cnet);
      const gwOk = (d) => { const c = cfg(d); return !!d && !!c.gateway && rIfs.some((f) => f.ip === c.gateway && f.network === c.network && f.prefix === c.prefix); };
      st.push([{ label: 'วาง Router', ok: rs.length >= 1 },
        { label: `ต่อ Router เข้ากับ Switch ของวงที่ 1`, ok: !!R && !!A && l2(A).includes(R.id) },
        { label: 'วาง PC เครื่องที่ 3 แล้วต่อสายเข้า Router อีกขาหนึ่ง (วงที่ 2)', ok: !!Cpc },
        { label: 'ตั้ง IP ขา Router ทั้ง 2 ขา ให้อยู่คนละวง (ขาหนึ่งอยู่วงเดียวกับ PC วงที่ 1)', ok: legsOk },
        { label: `ตั้ง IP ของ ${nm(Cpc, 'PC เครื่องที่ 3')} ให้อยู่วงเดียวกับขา Router ฝั่งวงที่ 2`, ok: legsOk && cIpOk },
        { label: `ตั้ง Default gateway ของ ${[A, B, Cpc].filter(Boolean).map((d) => d.name).join(', ') || 'ทุกเครื่อง'} เป็น IP ของ Router ขาในวงตัวเอง`, ok: !!A && !!B && !!Cpc && gwOk(A) && gwOk(B) && gwOk(Cpc) },
        { label: `Ping จาก ${nm(A, 'PC1')} หรือ ${nm(B, 'PC2')} ไปยัง ${nm(Cpc, 'PC เครื่องที่ 3')} สำเร็จ`, ok: !!Cpc && (pingedOk(net0, A, Cpc) || pingedOk(net0, B, Cpc)) }]);
      return st.map((items) => ({ items, done: items.every((x) => x.ok) }));
    }
    function tutInject() {
      const [A, B] = pcsOf();
      if (!A || !B || B.dhcp) return false;
      const f = B.ifaces[0], p = IPH.toPrefix(String(f.prefix));
      const n = IPH.parse(f.ip);
      if (n === null || p === null || p < 8 || p > 30) return false;
      let to = (n + Math.pow(2, 32 - p)) >>> 0;
      if ((to >>> 24) !== (n >>> 24)) to = (n - Math.pow(2, 32 - p)) >>> 0;
      const from = f.ip, toS = IPH.str(to);
      commit(() => { devById(B.id).ifaces[0].ip = toS; });
      S.tut.injected = { dev: B.id, from, to: toS }; S.tut.sawFail = false; S.tut.failMark = -1;
      setStatus(`โหมดฝึก: ระบบเปลี่ยน IP ของ ${B.name} จาก ${from} เป็น ${toS} (คนละวงกับ ${A.name}) ลอง Ping ดูว่าเกิดอะไรขึ้น`);
      return true;
    }
    function tutGo(n, opts) {
      opts = opts || {};
      if (tutTimer) { clearTimeout(tutTimer); tutTimer = 0; }
      n = Math.max(0, Math.min(TUT_STEPS.length, n));
      S.tut.step = n; S.tut.max = Math.max(S.tut.max, n);
      if (n === 5 && (!S.tut.injected || opts.reinject)) tutInject();
      const ev = tutEval();
      S.tut.enteredDone = n < TUT_STEPS.length && ev[n].done;
      saveDraft();
      tutHtml = ''; coachHtml = '';
      tutUpdate(true);
      if (opts.focus) { const h = el.mission.querySelector('h3'); if (h) { h.setAttribute('tabindex', '-1'); try { h.focus({ preventScroll: true }); } catch (e) { /* ignore */ } } }
    }
    function tutUpdate(force) {
      if (S.cur !== TUT_ID || destroyed) { el.coach.hidden = true; return; }
      const ev = tutEval();
      tutLast = ev;
      const n = S.tut.step;
      if (n < TUT_STEPS.length) {
        if (!ev[n].done && S.tut.enteredDone) S.tut.enteredDone = false;
        if (ev[n].done && !S.tut.enteredDone && !tutTimer) {
          tutTimer = setTimeout(() => { tutTimer = 0; if (destroyed || S.cur !== TUT_ID || S.tut.step !== n) return; const e2 = tutEval(); if (e2[n].done) tutGo(n + 1, { focus: false }); }, 1300);
          timers.push(tutTimer);
        } else if (!ev[n].done && tutTimer) { clearTimeout(tutTimer); tutTimer = 0; }
      }
      renderTutorial(ev, force);
      renderCoach(ev);
    }
    function renderCoach(ev) {
      const n = S.tut.step;
      let h;
      if (n >= TUT_STEPS.length) h = '<span class="nls-topology-grow"><b>ฝึกครบ 7 ขั้นแล้ว</b> — กด "ส่งผลการฝึก" ในกล่องโหมดฝึกเพื่อบันทึกคะแนน</span><button type="button" class="nls-topology-btn nls-topology-ghost nls-topology-small" data-act="tut-show">ดูขั้นตอน</button>';
      else {
        const it = ev[n].items, okN = it.filter((x) => x.ok).length, next = it.find((x) => !x.ok);
        const hn = S.tut.hints[n] || 0, hs = TUT_STEPS[n].hints;
        h = `<span class="nls-topology-grow"><b>ขั้น ${n + 1}/${TUT_STEPS.length}: ${esc(TUT_STEPS[n].title)}</b> · ${okN}/${it.length} · ${next ? 'ต่อไป: ' + esc(next.label) : '<span class="nls-topology-cok">✓ ผ่านขั้นนี้แล้ว</span>'}</span>
          ${hn < hs.length ? `<button type="button" class="nls-topology-btn nls-topology-ghost nls-topology-small" data-act="tut-hint">คำใบ้</button>` : ''}
          <button type="button" class="nls-topology-btn nls-topology-ghost nls-topology-small" data-act="tut-show">ดูขั้นตอน</button>
          <div class="nls-topology-coachhint">${hn ? esc(hs[hn - 1]) : ''}</div>`;
      }
      if (h !== coachHtml) { el.coach.innerHTML = h; coachHtml = h; }
      el.coach.hidden = false;
    }
    function renderTutorial(ev, force) {
      const n = S.tut.step, N = TUT_STEPS.length;
      const m = missionById(TUT_ID);
      let h = `<div class="nls-topology-tut"><h3>โหมดฝึกทีละขั้น<span class="nls-topology-lv nls-topology-lv-easy">ผู้เริ่มต้น</span></h3>`;
      h += '<ol class="nls-topology-dots" aria-label="ขั้นตอน">' + TUT_STEPS.map((x, i) => `<li><button type="button" data-tgo="${i}"${i === n ? ' aria-current="step"' : ''} class="${ev[i].done && i !== n ? 'nls-topology-d-done' : ''}"${i > S.tut.max ? ' disabled' : ''} aria-label="ขั้นที่ ${i + 1}: ${esc(x.title)}${ev[i].done ? ' (ผ่าน)' : ''}">${i + 1}</button></li>`).join('') +
        `<li><button type="button" data-tgo="${N}"${n === N ? ' aria-current="step"' : ''}${S.tut.max < N ? ' disabled' : ''} aria-label="สรุปและส่งผล">✓</button></li></ol>`;
      if (n < N) {
        const st = TUT_STEPS[n], it = ev[n].items, next = it.find((x) => !x.ok);
        h += `<h4>ขั้นที่ ${n + 1}: ${esc(st.title)}</h4><p>${esc(st.text)}</p><p class="nls-topology-why"><b>ทำไม:</b> ${esc(st.why)}</p>`;
        if (n === 5 && S.tut.injected) h += `<p class="nls-topology-note">ระบบเปลี่ยน IP ของ ${esc((devById(S.tut.injected.dev) || {}).name || S.tut.injected.dev)} จาก ${esc(S.tut.injected.from)} เป็น ${esc(S.tut.injected.to)} แล้ว</p>`;
        h += '<ul class="nls-topology-todo" aria-label="เช็กลิสต์">' + it.map((x) => `<li class="${x.ok ? 'nls-topology-t-ok' : x === next ? 'nls-topology-t-next' : ''}"><i aria-hidden="true">${x.ok ? '✓' : ''}</i><span>${esc(x.label)}<span style="position:absolute;left:-9999px">${x.ok ? ' (เสร็จแล้ว)' : ' (ยังไม่เสร็จ)'}</span></span></li>`).join('') + '</ul>';
        if (ev[n].done) h += `<p class="nls-topology-passed" role="status">✓ ผ่านขั้นนี้แล้ว${S.tut.enteredDone ? '' : ' กำลังไปขั้นถัดไป…'}</p>`;
        const regress = n !== 5 ? ev.slice(0, Math.min(n, 3)).map((e, i) => (e.done ? -1 : i)).filter((i) => i >= 0) : [];
        if (regress.length) h += `<p class="nls-topology-regress">ขั้นที่ ${regress.map((i) => i + 1).join(', ')} ไม่ผ่านแล้ว (อาจลบอุปกรณ์หรือถอดสาย) <button type="button" class="nls-topology-btn nls-topology-ghost nls-topology-small" data-tgo="${regress[0]}">กลับไปแก้</button></p>`;
        const hn = S.tut.hints[n] || 0;
        if (hn) h += '<ul class="nls-topology-hints">' + st.hints.slice(0, hn).map((x) => `<li>${esc(x)}</li>`).join('') + '</ul>';
        h += '<div class="nls-topology-row" style="margin-top:8px">';
        h += `<button type="button" class="nls-topology-btn nls-topology-ghost" data-act="tut-back"${n === 0 ? ' disabled' : ''}>ย้อนกลับ</button>`;
        h += `<button type="button" class="nls-topology-btn${ev[n].done ? ' nls-topology-go' : ' nls-topology-ghost'}" data-act="tut-next"${ev[n].done ? '' : ' disabled'}>ถัดไป</button>`;
        if (hn < st.hints.length) h += `<button type="button" class="nls-topology-btn nls-topology-ghost" data-act="tut-hint">ขอคำใบ้</button>`;
        if (n === 5) h += '<button type="button" class="nls-topology-btn nls-topology-ghost" data-act="tut-redo">ทำขั้นนี้ใหม่</button>';
        h += '<button type="button" class="nls-topology-btn nls-topology-ghost" data-act="tut-restart">เริ่มฝึกใหม่ทั้งหมด</button></div>';
      } else {
        h += '<h4>ฝึกครบทุกขั้นแล้ว</h4><p>คุณสร้างเครือข่าย 2 วงที่เชื่อมด้วย Router ได้แล้ว กด <b>ส่งผลการฝึก</b> เพื่อให้เซิร์ฟเวอร์ตรวจแผนผังสุดท้ายและ Ping ซ้ำอีกครั้ง (คะแนนบันทึกเป็นภารกิจ "' + esc(m ? m.title : 'โหมดฝึกทีละขั้น') + '")</p>';
        h += '<div class="nls-topology-row" style="margin-top:8px">';
        h += `<button type="button" class="nls-topology-btn nls-topology-go" data-m="submit"${S.busy ? ' disabled' : ''}>${S.busy ? 'กำลังตรวจ…' : 'ส่งผลการฝึก'}</button>`;
        h += '<button type="button" class="nls-topology-btn nls-topology-ghost" data-act="tut-back">ย้อนกลับ</button>';
        h += '<button type="button" class="nls-topology-btn nls-topology-ghost" data-act="tut-restart">เริ่มฝึกใหม่ทั้งหมด</button></div>';
        if (!ctx.user) h += '<p class="nls-topology-note">ยังไม่ได้เข้าสู่ระบบ: ตรวจคะแนนได้แต่จะไม่บันทึก</p>';
        h += resultHtml(TUT_ID);
      }
      h += '</div>';
      if (!force && h === tutHtml) return;
      tutHtml = h;
      const ae = document.activeElement, key = ae && el.mission.contains(ae) ? (ae.getAttribute('data-act') || (ae.getAttribute('data-tgo') !== null ? 'tgo' + ae.getAttribute('data-tgo') : '')) : '';
      el.mission.innerHTML = h;
      if (key) {
        const nx = key.startsWith('tgo') ? el.mission.querySelector(`[data-tgo="${key.slice(3)}"]`) : el.mission.querySelector(`[data-act="${key}"]`);
        if (nx && !nx.disabled) { try { nx.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
      }
    }
    function tutAction(act, tgo) {
      if (act === 'tut-back') tutGo(S.tut.step - 1, { focus: true });
      else if (act === 'tut-next') { const ev = tutEval(); if (S.tut.step < TUT_STEPS.length && ev[S.tut.step].done) tutGo(S.tut.step + 1, { focus: true }); }
      else if (act === 'tut-hint') { const n = S.tut.step; if (n < TUT_STEPS.length) { S.tut.hints[n] = Math.min((S.tut.hints[n] || 0) + 1, TUT_STEPS[n].hints.length); saveDraft(); tutHtml = ''; coachHtml = ''; tutUpdate(true); } }
      else if (act === 'tut-redo') { if (S.tut.injected) { const d = devById(S.tut.injected.dev); if (d && !d.dhcp) commit(() => { d.ifaces[0].ip = S.tut.injected.from; }); } S.tut.injected = null; tutGo(5, { reinject: true }); }
      else if (act === 'tut-restart') {
        const before = snap(); setTopo({ devices: [], links: [] });
        if (snap() !== before) pushUndo(before);
        S.tut = tutFresh(); S.sel = null; S.sheet = false; S.pending = null; S.pingPath = null;
        el.pres.innerHTML = ''; el.anim.replaceChildren();
        refreshLight(); buildProps(); homeView();
        tutGo(0, { focus: true });
        setStatus('เริ่มโหมดฝึกใหม่แล้ว (กด "ย้อนกลับ" ในแถบเครื่องมือเพื่อเอาแผนผังเดิมคืน)');
      } else if (act === 'tut-show') {
        try { el.mission.scrollIntoView({ block: 'start', behavior: reduceMotion ? 'auto' : 'smooth' }); } catch (e) { el.mission.scrollIntoView(); }
        if (S.fs) setFs(false);
      } else if (act === 'tgo' && tgo !== null) { const k = +tgo; if (k <= S.tut.max) tutGo(k, { focus: false }); }
    }
    on(el.mission, 'click', (e) => {
      const b = e.target.closest ? e.target.closest('[data-act^="tut-"],[data-tgo]') : null;
      if (!b || S.cur !== TUT_ID) return;
      tutAction(b.hasAttribute('data-tgo') ? 'tgo' : b.getAttribute('data-act'), b.getAttribute('data-tgo'));
    });
    on(el.coach, 'click', (e) => {
      const b = e.target.closest ? e.target.closest('[data-act]') : null;
      if (b) tutAction(b.getAttribute('data-act'), null);
    });

    // ------------------------------------------------------------ Final Network Capstone (mission t9)
    // The requirement checklist is NetSim.capstone.evaluate() on the current drawing (the same code the server grades with).
    const CAP_ID = 't9';
    const CAPS = NS.capstone || null;
    const hasCap = !!CAPS && !!missionById(CAP_ID);
    const CAPA = CAPS ? CAPS.CAP : null;
    const REPORT_TEMPLATE = CAPA ? CAPA.REPORT_SECTIONS.map((x) => x.title + '\n').join('\n') : '';
    let capTimer = 0, capLast = null, capSaveTimer = 0;
    function capFaultPayload() {
      const f = S.cap.fault;
      return f ? { kind: f.kind, dev: f.dev, link: f.link || '', plan: f.plan, baseline: f.baseline } : null;
    }
    function capPayload() { return { topo: clone(S.topo), plan: clone(S.cap.plan), report: String(S.cap.report || '').slice(0, 6000), fault: capFaultPayload() }; }
    function capEval() { try { capLast = CAPS.evaluate(S.topo, { plan: S.cap.plan, report: S.cap.report, fault: capFaultPayload() }); } catch (e) { capLast = null; } return capLast; }
    function capSchedule() {
      if (S.cur !== CAP_ID || !hasCap) return;
      if (capTimer) clearTimeout(capTimer);
      capTimer = setTimeout(() => { capTimer = 0; if (!destroyed && S.cur === CAP_ID) { capEval(); capRenderLive(); } }, 220);
    }
    function capSaveSoon() { if (capSaveTimer) clearTimeout(capSaveTimer); capSaveTimer = setTimeout(() => { capSaveTimer = 0; if (!destroyed) saveDraft(); }, 600); }
    const CAP_FIELDS = [['net', 'Network address', 'x.x.x.x'], ['prefix', 'Prefix / Mask', '/xx'], ['gateway', 'Gateway (ขา Router)', 'x.x.x.x']];
    function capRowMsg(a) {
      const r = S.cap.plan[a.id] || {};
      const netS = String(r.net || '').trim().split('/')[0];
      let p = String(r.prefix || '').trim(); if (!p && String(r.net || '').includes('/')) p = String(r.net).split('/')[1];
      const pf = p ? IPH.toPrefix(p) : null;
      if (!netS && !p) return info(`ต้องใช้ ${a.hosts + 1} IP (เครื่อง ${a.hosts} + Gateway 1)`);
      if (IPH.parse(netS) === null) return bad('Network address ไม่ถูกต้อง');
      if (pf === null) return bad('ใส่ Prefix เช่น /27 หรือ Mask เช่น 255.255.255.224');
      const cap = pf >= 31 ? 0 : Math.pow(2, 32 - pf) - 2;
      const nw = IPH.network(netS, pf);
      const range = `${nw} – ${IPH.broadcast(netS, pf)} (Mask ${IPH.mask(pf)})`;
      if (nw !== netS) return bad(`${netS} ไม่ใช่ Network address ของ /${pf} (${range})`);
      if (cap < a.hosts + 1) return bad(`/${pf} ใช้ได้ ${cap} IP ไม่พอ (ต้องการ ${a.hosts + 1})`);
      const g = String(r.gateway || '').trim();
      if (g && (!IPH.inSubnet(g, netS, pf) || g === nw || g === IPH.broadcast(netS, pf))) return bad(`Gateway ${g} ไม่ใช่ IP ที่ใช้ได้ในวงนี้`);
      return okm(`${range} ใช้ได้ ${cap} IP`);
    }
    function capPlanHtml() {
      let h = `<p class="nls-topology-note">บล็อกที่ได้รับ <b>${CAPA.block}/${CAPA.blockPrefix}</b> — กรอกแผนก่อนตั้งค่าอุปกรณ์ ระบบใช้แผนนี้ระบุว่าเครื่องใดอยู่ห้องไหน (ตาม IP) แล้วตรวจขนาด Subnet การซ้อนทับ และการตั้งค่าจริง</p><div class="nls-topology-plan">`;
      CAPA.areas.forEach((a) => {
        const r = S.cap.plan[a.id] || {};
        h += `<fieldset class="nls-topology-prow"><legend><b>${esc(a.th)}</b> <span class="nls-topology-muted">${esc(a.detail)} • ต้องใช้ ${a.hosts + 1} IP</span></legend><div class="nls-topology-pgrid">` +
          CAP_FIELDS.map(([k, lab, ph]) => `<label><span>${esc(lab)}</span><input type="text" class="nls-topology-in" data-cplan="${a.id}.${k}" value="${esc(r[k] || '')}" placeholder="${esc(ph)}" autocomplete="off" spellcheck="false" inputmode="${k === 'prefix' ? 'text' : 'decimal'}"></label>`).join('') +
          `</div><div class="nls-topology-fmsg" data-cmsg="${a.id}"></div></fieldset>`;
      });
      return h + `</div><p class="nls-topology-note">อินเทอร์เน็ต: ISP ใช้ ${CAPA.isp}/${CAPA.wanPrefix} ให้ตั้งขา WAN ของ Router เป็น ${CAPA.wan}/${CAPA.wanPrefix} • DNS ใช้ 8.8.8.8 (DNS สาธารณะ) หรือตั้ง DNS server ภายในก็ได้</p>`;
    }
    function capPlanMsgs() {
      CAPA.areas.forEach((a) => {
        const m = el.mission.querySelector(`[data-cmsg="${a.id}"]`); if (!m) return;
        const res = capRowMsg(a);
        m.textContent = res ? res.text : ''; m.className = 'nls-topology-fmsg' + (res ? ' nls-topology-m-' + res.cls : '');
      });
    }
    const MX_ROWS = [['lab', 'ห้องแล็บ'], ['teachers', 'ห้องครู (PC)'], ['wifi', 'Wi-Fi ครู'], ['office', 'สำนักงาน']];
    const MX_COLS = [['lab', 'ห้องแล็บ'], ['teachers', 'ห้องครู'], ['printer', 'เครื่องพิมพ์'], ['office', 'สำนักงาน'], ['internet', '8.8.8.8'], ['dns', 'ชื่อเว็บ']];
    function capMatrixHtml(ev) {
      const cell = (r, c) => ev.matrix.find((x) => x.from === r && x.to === c);
      let h = '<div class="nls-topology-mxwrap"><table class="nls-topology-mx"><caption>ผลทดสอบการเชื่อมต่อ (ต้นทาง → ปลายทาง) คำนวณจากเครือข่ายจริงในแผนผัง</caption><thead><tr><th scope="col">จาก \\ ถึง</th>' + MX_COLS.map(([, t]) => `<th scope="col">${esc(t)}</th>`).join('') + '</tr></thead><tbody>';
      MX_ROWS.forEach(([r, rt]) => {
        h += `<tr><th scope="row">${esc(rt)}</th>`;
        MX_COLS.forEach(([c]) => {
          const x = cell(r, c);
          if (!x) { h += '<td class="nls-topology-mx-na">–</td>'; return; }
          const tested = x.tests.length > 0;
          const txt = !tested ? 'ยังไม่ได้ทดสอบ' : x.want ? (x.pass ? 'ได้' : 'ไม่ได้') : (x.pass ? 'บล็อกแล้ว' : x.ok ? 'ยังเข้าได้' : 'ไม่ได้*');
          const cls = x.pass ? 'nls-topology-mx-ok' : 'nls-topology-mx-bad';
          h += `<td class="${cls}" title="${esc(x.msg || (x.want ? 'ต้องติดต่อได้' : 'นโยบาย: ต้องบล็อกด้วยกฎไฟร์วอลล์'))}">${x.want ? '' : '<small>ต้องบล็อก</small>'}${esc(txt)}</td>`;
        });
        h += '</tr>';
      });
      return h + '</tbody></table></div><p class="nls-topology-note">สีเขียว = เป็นไปตามข้อกำหนด • ห้องแล็บกับสำนักงานต้องติดต่อกันไม่ได้เพราะกฎไฟร์วอลล์ (ถ้าไม่ได้เพราะสาเหตุอื่นจะแสดง "ไม่ได้*") • แตะ/ชี้ช่องเพื่อดูสาเหตุ</p>';
    }
    function capCheckHtml(ev) {
      if (!ev) return '<p class="nls-topology-msg nls-topology-bad">ตรวจความคืบหน้าไม่ได้</p>';
      const done = ev.items.filter((x) => x.score >= x.max).length;
      let h = `<h3>เช็กลิสต์ข้อกำหนด</h3><p class="nls-topology-note">อัปเดตทันทีจากเครือข่ายในแผนผัง</p><div class="nls-topology-capbar" role="img" aria-label="ผ่าน ${done} จาก ${ev.items.length} เกณฑ์"><i style="width:${Math.round(ev.score / ev.max * 100)}%"></i></div>
        <p class="nls-topology-capsum">ผ่าน <b>${done}/${ev.items.length}</b> เกณฑ์ • คะแนนอัตโนมัติโดยประมาณ <b>${esc(ev.score)}/${esc(ev.max)}</b> <span class="nls-topology-muted">(คะแนนจริงคำนวณที่เซิร์ฟเวอร์เมื่อส่งงาน และครูให้คะแนนรายงานเพิ่มอีก 2 เกณฑ์)</span></p><div class="nls-topology-reqs">`;
      ev.items.forEach((it) => {
        const ok = it.score >= it.max;
        const firstBad = it.checks.find((c) => !c.ok);
        h += `<details class="nls-topology-req${ok ? ' nls-topology-req-ok' : ''}" data-req="${it.id}"${capOpen[it.id] ? ' open' : ''}><summary><i aria-hidden="true">${ok ? '✓' : ''}</i><span>${esc(it.title)}</span><em>${esc(it.score)}/${esc(it.max)}</em></summary>` +
          (it.id === 'matrix' ? capMatrixHtml(ev) : '') +
          '<ul class="nls-topology-todo">' + it.checks.map((c) => `<li class="${c.ok ? 'nls-topology-t-ok' : c === firstBad ? 'nls-topology-t-next' : ''}"><i aria-hidden="true">${c.ok ? '✓' : ''}</i><span>${esc(c.label)}${!c.ok && c.msg ? `<br><small>${esc(c.msg)}</small>` : ''}<span style="position:absolute;left:-9999px">${c.ok ? ' (ผ่าน)' : ' (ยังไม่ผ่าน)'}</span></span></li>`).join('') + '</ul></details>';
      });
      return h + '</div>';
    }
    const capOpen = {};
    function capFaultHtml(ev) {
      const f = S.cap.fault;
      const mx = ev ? ev.items.find((x) => x.id === 'matrix') : null;
      if (!f) {
        if (!ev || !ev.buildOk) return `<h4>ขั้นที่ 2: แก้เหตุขัดข้อง</h4><p class="nls-topology-muted">จะเริ่มเมื่อเครือข่ายต่อสายครบและผ่านการทดสอบการเชื่อมต่อทุกช่อง (ตอนนี้ ${mx ? `${mx.checks.filter((c) => c.ok).length}/${mx.checks.length}` : '-'} ช่อง)</p>`;
        return `<h4>ขั้นที่ 2: แก้เหตุขัดข้อง</h4><p class="nls-topology-passed">✓ เครือข่ายใช้งานได้ครบทุกข้อทดสอบแล้ว</p><p>ในงานจริง เมื่อเปิดใช้งานแล้วมักมีผู้ใช้แจ้งปัญหาเข้ามา กดปุ่มด้านล่างเพื่อรับเรื่อง ระบบจะทำให้เกิดเหตุขัดข้อง 1 อย่างในเครือข่ายของคุณ (เลือกจากเครือข่ายของคุณเอง) แล้วให้หาสาเหตุและแก้ไข</p>
          <div class="nls-topology-row"><button type="button" class="nls-topology-btn nls-topology-go" data-cap="inject">รับแจ้งปัญหาจากผู้ใช้</button></div><p class="nls-topology-note">ระบบจะล้างประวัติ "ย้อนกลับ" เมื่อเริ่มเหตุขัดข้อง ต้องแก้ด้วยการหาสาเหตุจริง</p>`;
      }
      const fixed = !!(ev && ev.fault && ev.fault.fixed);
      let h = `<h4>ขั้นที่ 2: แก้เหตุขัดข้อง</h4><div class="nls-topology-ticket${fixed ? ' nls-topology-ticket-ok' : ''}" role="status"><b>ใบแจ้งปัญหา</b><p>${esc(f.symptom || 'มีผู้ใช้แจ้งว่าใช้งานเครือข่ายไม่ได้')}</p>`;
      h += fixed ? `<p class="nls-topology-passed">✓ แก้ไขแล้ว — สาเหตุคือ: ${esc(ev.fault.title)} ทุกอย่างกลับมาใช้งานได้ บันทึกวิธีหาสาเหตุลงในรายงานหัวข้อ 4</p>`
        : '<p class="nls-topology-regress">ยังไม่ได้แก้ — ใช้ Ping / Traceroute จากเครื่องที่แจ้งปัญหา ดูตัวตรวจเฟรม แผง "ปัญหา" และการตั้งค่าของอุปกรณ์ เพื่อหาสาเหตุ</p>';
      h += '</div><div class="nls-topology-row"><button type="button" class="nls-topology-btn nls-topology-ghost nls-topology-small" data-cap="refault">เริ่มสถานการณ์ใหม่ (คืนสภาพตอนเกิดปัญหา)</button></div>';
      return h;
    }
    function capReportHtml() {
      const n = String(S.cap.report || '').length;
      return `<p class="nls-topology-note">เขียนใต้หัวข้อทั้ง 4 (หัวข้อละอย่างน้อย 40 ตัวอักษร) หัวข้อ 3 ต้องมีหลักฐานการทดสอบ เช่น ping/traceroute ไปที่ใด ได้ผลอย่างไร</p>
        <label class="nls-topology-field" style="display:block"><span class="nls-topology-muted" style="font-size:13.5px">รายงาน (สูงสุด 6000 ตัวอักษร)</span><textarea class="nls-topology-report" data-cap-report rows="12" maxlength="6000" spellcheck="false">${esc(S.cap.report || REPORT_TEMPLATE)}</textarea></label>
        <div class="nls-topology-row"><span class="nls-topology-muted" data-cap-count>${n}/6000</span>
        <button type="button" class="nls-topology-btn nls-topology-ghost nls-topology-small" data-cap="insert">แทรกผลการทดสอบล่าสุดลงหัวข้อ 3</button>
        <button type="button" class="nls-topology-btn nls-topology-ghost nls-topology-small" data-cap="template">เติมหัวข้อที่ขาด</button></div>`;
    }
    function capReviewHtml() {
      const m = missionById(CAP_ID);
      const crit = (m && m.review && m.review.teacher) || [];
      let h = `<div class="nls-topology-review"><h4>ผลตรวจจากครู</h4><p class="nls-topology-note">ครูให้คะแนนเพิ่มจากรายงาน: ${crit.map((c) => `${esc(c.title)} (${c.max} คะแนน)`).join(', ')}</p>`;
      const R = S.review;
      if (!ctx.user) h += '<p class="nls-topology-muted">เข้าสู่ระบบก่อนส่งงาน ครูจึงจะเห็นงานและให้คะแนนได้ (ผู้เยี่ยมชมตรวจคะแนนอัตโนมัติได้แต่ไม่บันทึก)</p>';
      else if (!R) h += '<p class="nls-topology-muted">กำลังโหลด…</p>';
      else if (R.error) h += '<p class="nls-topology-muted">โหลดผลตรวจจากครูไม่สำเร็จ ลองเปิดภารกิจนี้ใหม่</p>';
      else if (!R.submission) h += '<p class="nls-topology-muted">ยังไม่มีงานที่ส่งในระบบ</p>';
      else {
        const sb = R.submission;
        h += `<p>ส่งล่าสุด: คะแนนอัตโนมัติ <b>${esc(sb.auto_score)}/${esc(sb.auto_max)}</b>${sb.created_at ? ` <span class="nls-topology-muted">(${esc(new Date(sb.created_at).toLocaleString('th-TH'))})</span>` : ''}</p>`;
        if (!sb.reviewed_at) h += '<p class="nls-topology-muted">ครูยังไม่ได้ตรวจรายงาน</p>';
        else {
          const ts = sb.teacher_scores || {};
          h += '<ul class="nls-topology-checks">' + crit.map((c) => `<li><i class="nls-topology-y" aria-hidden="true">•</i><span>${esc(c.title)}</span><em>${esc(ts[c.id] !== undefined ? ts[c.id] : '-')}/${esc(c.max)}</em></li>`).join('') + '</ul>';
          if (sb.teacher_comment) h += `<blockquote class="nls-topology-tcomment">${esc(sb.teacher_comment)}</blockquote>`;
          h += `<p class="nls-topology-muted">ตรวจเมื่อ ${esc(new Date(sb.reviewed_at).toLocaleString('th-TH'))}</p>`;
        }
      }
      return h + '</div>';
    }
    function capLoadReview() {
      if (!hasCap || typeof ctx.review !== 'function' || !ctx.user) return;
      S.review = null;
      Promise.resolve().then(() => ctx.review(CAP_ID)).then((r) => { if (destroyed) return; S.review = r || { submission: null }; capRenderReview(); })
        .catch(() => { if (destroyed) return; S.review = { error: true }; capRenderReview(); });
    }
    function capRenderReview() { const b = el.mission.querySelector('[data-r=caprev]'); if (b) b.innerHTML = capReviewHtml(); }
    function capTabVis(onCap) {
      const t = root.querySelector('[data-tab=req]'); if (!t) return;
      const nl = isNL(S.cur);
      t.hidden = !((onCap && hasCap) || nl);
      if (onCap && hasCap) { setTab('req'); capEval(); capRenderLive(true); }
      else if (nl) { const a = root.querySelector('[data-r=capfault]'); if (a) { a.innerHTML = ''; a.__h = ''; } nlRun(); nlRender(true); }
      else { if (S.tab === 'req') setTab('test'); const a = root.querySelector('[data-r=capfault]'), b = root.querySelector('[data-r=capcheck]'); if (a) { a.innerHTML = ''; a.__h = ''; } if (b) { b.innerHTML = ''; b.__h = ''; } }
    }
    function capStage(ev) { return !S.cap.fault ? 1 : !(ev && ev.fault && ev.fault.fixed) ? 2 : 3; }
    function capRenderAll() {
      const m = missionById(CAP_ID);
      const ev = capEval();
      const n = S.hints[m.id] || 0, hints = Array.isArray(m.hints) ? m.hints : [];
      const st = capStage(ev);
      let h = `<h3>${esc(m.title)}<span class="nls-topology-lv nls-topology-lv-${esc(m.level)}">${esc(LEVEL_TH[m.level] || m.level)}</span></h3>
        <ol class="nls-topology-capsteps" data-r="capsteps">${['ออกแบบและสร้างเครือข่าย', 'แก้เหตุขัดข้อง', 'เขียนรายงานและส่งงาน'].map((x, i) => `<li class="${i + 1 < st ? 'nls-topology-cs-done' : i + 1 === st ? 'nls-topology-cs-now' : ''}"${i + 1 === st ? ' aria-current="step"' : ''}>${i + 1}. ${esc(x)}</li>`).join('')}</ol>
        <details class="nls-topology-capsec"${isNarrow() || Object.keys(S.cap.plan).length ? '' : ' open'}><summary>สถานการณ์และข้อกำหนด (คำสั่งงาน)</summary><p>${esc(m.desc)}</p>
        <div class="nls-topology-mxwrap"><table class="nls-topology-mx nls-topology-reqtab"><thead><tr><th scope="col">ส่วน</th><th scope="col">ต้องรองรับ</th><th scope="col">IP ที่ต้องใช้</th><th scope="col">ในแผนผังวางอย่างน้อย</th></tr></thead><tbody>
          <tr><th scope="row">ห้องปฏิบัติการคอมพิวเตอร์</th><td>PC 30</td><td>31</td><td>Switch + PC 2</td></tr>
          <tr><th scope="row">ห้องพักครู</th><td>PC 12 + Printer 1 + Wi-Fi 10</td><td>24</td><td>Switch + PC 2 + Printer + AP + Laptop 1</td></tr>
          <tr><th scope="row">สำนักงาน</th><td>PC 8 + File server 1</td><td>10</td><td>Switch + PC 2 + Server (เปิด File server)</td></tr></tbody></table></div>
        <ul class="nls-topology-capreq"><li>บล็อก IP ที่ได้รับ: <b>${CAPA.block}/${CAPA.blockPrefix}</b> แบ่ง Subnet ห้องละวงด้วย VLSM (พอดี ไม่ซ้อนทับ)</li>
          <li>อินเทอร์เน็ต: Router ขา WAN ${CAPA.wan}/${CAPA.wanPrefix} ต่อ ISP ${CAPA.isp} พร้อม Default route</li>
          <li>Wi-Fi ครู: ตั้ง SSID ใช้ WPA2/WPA3-Personal พร้อมรหัสผ่าน (ห้าม Open)</li>
          <li>นโยบายความปลอดภัย: ห้องแล็บนักเรียนกับสำนักงานติดต่อกันไม่ได้ (ใช้กฎไฟร์วอลล์บน Router) ส่วนอื่นติดต่อกันได้และออกอินเทอร์เน็ตได้ทุกห้อง</li>
          <li>ทุกเครื่องตั้ง Default gateway และ DNS (แปลงชื่อ ${CAPA.publicName} ได้)</li></ul></details>`;
      if (n) h += '<ul class="nls-topology-hints">' + hints.slice(0, n).map((x) => `<li>${esc(x)}</li>`).join('') + '</ul>';
      if (n < hints.length) h += `<div class="nls-topology-row"><button type="button" class="nls-topology-btn nls-topology-ghost nls-topology-small" data-m="hint">ขอคำใบ้ (${n + 1}/${hints.length})</button></div>`;
      h += `<details class="nls-topology-capsec" open><summary>ขั้นที่ 1: แผนการแจก IP</summary><section data-r="capplan">${capPlanHtml()}</section></details>`;
      h += `<p class="nls-topology-capgo" data-r="capgo"></p>`;
      h += `<details class="nls-topology-capsec" data-r="caprepd"${st >= 2 || S.cap.reportOpen ? ' open' : ''}><summary>ขั้นที่ 3: รายงานการออกแบบ</summary><section data-r="capreport">${capReportHtml()}</section></details>`;
      h += '<div class="nls-topology-row" style="margin-top:8px">';
      h += `<button type="button" class="nls-topology-btn nls-topology-go" data-m="submit"${S.busy ? ' disabled' : ''}>${S.busy ? 'กำลังตรวจ…' : 'ส่งงานโครงงาน'}</button>`;
      h += S.resetAsk ? `<span class="nls-topology-confirm" role="alert">รีเซ็ตแผนผังและเหตุขัดข้องกลับเป็นค่าเริ่มต้น? (แผน IP และรายงานยังอยู่) <button type="button" class="nls-topology-btn nls-topology-danger nls-topology-small" data-cap="reset-yes">ยืนยันรีเซ็ต</button> <button type="button" class="nls-topology-btn nls-topology-ghost nls-topology-small" data-cap="reset-no">ยกเลิก</button></span>`
        : '<button type="button" class="nls-topology-btn nls-topology-ghost" data-cap="reset">รีเซ็ตแล็บ</button>';
      h += '</div>';
      if (!ctx.user) h += '<p class="nls-topology-note">ยังไม่ได้เข้าสู่ระบบ: ตรวจคะแนนอัตโนมัติได้แต่จะไม่บันทึกและครูจะไม่เห็นงาน</p>';
      h += resultHtml(CAP_ID);
      h += `<div data-r="caprev">${capReviewHtml()}</div>`;
      el.mission.innerHTML = h;
      capPlanMsgs();
      capRenderLive(true);
    }
    // live parts only (inputs and the report textarea keep focus and caret)
    function capRenderLive(force) {
      if (S.cur !== CAP_ID) return;
      const ev = capLast;
      const put = (sel, html) => { const b = root.querySelector(sel); if (b && (force || b.__h !== html)) { b.innerHTML = html; b.__h = html; } };
      const chk0 = root.querySelector('[data-r=capcheck]');
      if (chk0) chk0.querySelectorAll('details[data-req]').forEach((d) => { capOpen[d.getAttribute('data-req')] = d.open; });
      put('[data-r=capcheck]', capCheckHtml(ev));
      put('[data-r=capfault]', capFaultHtml(ev));
      if (ev) {
        const done = ev.items.filter((x) => x.score >= x.max).length;
        const rc = root.querySelector('[data-r=reqcount]'); if (rc) { rc.textContent = done + '/' + ev.items.length; rc.classList.toggle('nls-topology-err', !!S.cap.fault && !(ev.fault && ev.fault.fixed)); }
        put('[data-r=capgo]', `เช็กลิสต์ข้อกำหนดอยู่ในแท็บ <b>"เช็กลิสต์งาน"</b> ข้างพื้นที่ทำงาน (ผ่าน ${done}/${ev.items.length} เกณฑ์${S.cap.fault && !(ev.fault && ev.fault.fixed) ? ' • มีใบแจ้งปัญหารอแก้' : ''}) <button type="button" class="nls-topology-btn nls-topology-ghost nls-topology-small" data-cap="showreq">เปิดเช็กลิสต์</button>`);
      }
      const st = capStage(ev), steps = el.mission.querySelector('[data-r=capsteps]');
      if (steps) steps.querySelectorAll('li').forEach((li, i) => { li.className = i + 1 < st ? 'nls-topology-cs-done' : i + 1 === st ? 'nls-topology-cs-now' : ''; if (i + 1 === st) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current'); });
    }
    function capInject() {
      const base = clone(S.topo);
      const f = CAPS.pickFault(base, S.cap.plan);
      if (!f) { setStatus('ยังสร้างเหตุขัดข้องไม่ได้ (ต้องมี PC ที่ตั้ง IP แบบ Static หรือ Switch ของแต่ละห้อง)', true); return; }
      const a = CAPS.applyFault(base, f, S.cap.plan);
      S.cap.fault = Object.assign({}, a.fault, { plan: clone(S.cap.plan), baseline: base, at: nowHM() });
      setTopo(ensureTopo(a.topo));
      S.undo = []; S.redo = []; S.sel = null; S.sheet = false; S.pingPath = null;
      el.pres.innerHTML = ''; el.anim.replaceChildren();
      afterChange(); buildProps();
      capEval(); capRenderLive();
      setTab('req');
      setStatus('มีผู้ใช้แจ้งปัญหาเข้ามา: ' + (a.fault.symptom || ''), true);
      if (ctx.toast) ctx.toast('มีใบแจ้งปัญหาใหม่ ดูที่แท็บ "เช็กลิสต์งาน"');
    }
    function capRefault() {
      const f = S.cap.fault; if (!f || !validTopo(f.baseline)) return;
      const a = CAPS.applyFault(f.baseline, f, f.plan);
      const before = snap(); setTopo(ensureTopo(a.topo)); if (snap() !== before) { S.undo = []; S.redo = []; }
      S.sel = null; afterChange(); buildProps(); capEval(); capRenderLive();
      setStatus('คืนสภาพเครือข่ายตอนเกิดปัญหาแล้ว ลองหาสาเหตุอีกครั้ง');
    }
    function capInsertTests() {
      const ev = capLast || capEval();
      const lines = ['ผลทดสอบจากระบบจำลอง (' + nowHM() + '):'];
      if (ev) ev.matrix.forEach((c) => {
        if (!c.tests.length) return;
        const th = (k) => ({ lab: 'ห้องแล็บ', teachers: 'ห้องครู', office: 'สำนักงาน', wifi: 'Wi-Fi ครู', internet: '8.8.8.8', dns: CAPA.publicName, printer: 'เครื่องพิมพ์' }[k] || k);
        lines.push(`- ping ${th(c.from)} -> ${th(c.to)}${c.target ? ' (' + c.target + ')' : ''}: ${c.ok ? 'สำเร็จ' : c.blocked ? 'ถูกบล็อกตามนโยบาย' : 'ไม่สำเร็จ (' + (c.tests.find((t) => !t.ok) || {}).title + ')'}`);
      });
      logText(6).forEach((x) => lines.push('- ' + x));
      const txt = lines.join('\n');
      let r = String(S.cap.report || REPORT_TEMPLATE);
      const m = /^\s*#*\s*3\s*[).:].*$/m.exec(r);
      if (m) { const at = m.index + m[0].length; r = r.slice(0, at) + '\n' + txt + r.slice(at); }
      else r += '\n3) ผลการทดสอบ\n' + txt + '\n';
      S.cap.report = r.slice(0, 6000);
      const ta = el.mission.querySelector('[data-cap-report]'); if (ta) { ta.value = S.cap.report; const c = el.mission.querySelector('[data-cap-count]'); if (c) c.textContent = S.cap.report.length + '/6000'; }
      saveDraft(); capSchedule();
      setStatus('แทรกผลการทดสอบลงหัวข้อ 3 แล้ว อย่าลืมเขียนอธิบายผลด้วยคำของตัวเอง');
    }
    function capFillTemplate() {
      let r = String(S.cap.report || '');
      CAPA.REPORT_SECTIONS.forEach((sec, k) => { if (!new RegExp('^\\s*#*\\s*' + (k + 1) + '\\s*[).:]', 'm').test(r)) r += (r && !r.endsWith('\n') ? '\n' : '') + sec.title + '\n'; });
      S.cap.report = r.slice(0, 6000);
      const ta = el.mission.querySelector('[data-cap-report]'); if (ta) ta.value = S.cap.report;
      saveDraft(); capSchedule();
    }
    on(el.mission, 'input', (e) => {
      if (S.cur !== CAP_ID) return;
      const t = e.target;
      const k = t.getAttribute('data-cplan');
      if (k) {
        const [a, f] = k.split('.');
        S.cap.plan[a] = Object.assign({ net: '', prefix: '', gateway: '' }, S.cap.plan[a] || {}, { [f]: String(t.value).slice(0, 40) });
        capPlanMsgs(); capSaveSoon(); capSchedule();
      } else if (t.hasAttribute('data-cap-report')) {
        S.cap.reportOpen = true;
        S.cap.report = String(t.value).slice(0, 6000);
        const c = el.mission.querySelector('[data-cap-count]'); if (c) c.textContent = S.cap.report.length + '/6000';
        capSaveSoon(); capSchedule();
      }
    });
    on(root, 'click', (e) => {
      const b = e.target.closest ? e.target.closest('[data-cap]') : null;
      if (!b || S.cur !== CAP_ID) return;
      const a = b.getAttribute('data-cap');
      if (a === 'inject') capInject();
      else if (a === 'refault') capRefault();
      else if (a === 'insert') capInsertTests();
      else if (a === 'template') capFillTemplate();
      else if (a === 'showreq') { setTab('req'); try { root.querySelector('[data-panel=req]').scrollIntoView({ block: 'start', behavior: reduceMotion ? 'auto' : 'smooth' }); } catch (err) { /* ignore */ } }
      else if (a === 'reset') { S.resetAsk = true; capRenderAll(); const y = el.mission.querySelector('[data-cap=reset-yes]'); if (y) y.focus(); }
      else if (a === 'reset-no') { S.resetAsk = false; capRenderAll(); }
      else if (a === 'reset-yes') {
        S.resetAsk = false; S.cap.fault = null;
        setTopo(startOf(CAP_ID)); S.undo = []; S.redo = []; S.sel = null; S.sheet = false; S.pending = null; S.pingPath = null;
        el.pres.innerHTML = ''; el.anim.replaceChildren();
        afterChange(); buildProps(); homeView(); capRenderAll();
        setStatus('รีเซ็ตแล็บแล้ว: แผนผังกลับเป็นค่าเริ่มต้น (แผน IP และรายงานยังเก็บไว้)');
      }
    });
    on(root, 'toggle', (e) => { const d = e.target; if (d && d.getAttribute && d.getAttribute('data-req')) capOpen[d.getAttribute('data-req')] = d.open; }, true);

    // ------------------------------------------------------------ 3.1: live checklist of the NAT/ACL missions (t10–t13)
    // NetSim.natlab.evaluate runs the same test matrix as the server grader on the current drawing.
    const NLM = NS.natlab || null;
    const isNL = (id) => !!NLM && NLM.missions.includes(id) && !!missionById(id);
    let nlLast = null, nlTimer = 0;
    const nlOpen = {};
    function nlRun() { try { nlLast = NLM.evaluate(S.cur, S.topo); } catch (e) { nlLast = null; } return nlLast; }
    function nlSchedule() {
      if (!isNL(S.cur)) return;
      if (nlTimer) clearTimeout(nlTimer);
      nlTimer = setTimeout(() => { nlTimer = 0; if (!destroyed && isNL(S.cur)) { nlRun(); nlRender(); } }, 260);
    }
    const WANT_TH = { ok: 'ต้องใช้งานได้', deny: 'ต้องถูก ACL บล็อก', noreach: 'ต้องเข้าไม่ถึง' };
    function nlHtml(ev) {
      if (!ev || !ev.items.length) return '<p class="nls-topology-msg nls-topology-bad">ตรวจความคืบหน้าไม่ได้</p>';
      const done = ev.items.filter((x) => x.score >= x.max).length;
      let h = `<h3>เช็กลิสต์ข้อกำหนด</h3><p class="nls-topology-note">คำนวณทันทีจากเครือข่ายในแผนผังด้วยชุดทดสอบเดียวกับตอนตรวจงาน (ISP และเครื่องภายนอกใช้ค่าของโจทย์เสมอ)</p>
        <div class="nls-topology-capbar" role="img" aria-label="ผ่าน ${done} จาก ${ev.items.length} เกณฑ์"><i style="width:${Math.round(Math.max(0, ev.score) / ev.max * 100)}%"></i></div>
        <p class="nls-topology-capsum">ผ่าน <b>${done}/${ev.items.length}</b> เกณฑ์ • คะแนนโดยประมาณ <b>${esc(ev.score)}/${esc(ev.max)}</b> <span class="nls-topology-muted">(คะแนนจริงคำนวณที่เซิร์ฟเวอร์เมื่อกดตรวจงาน)</span></p>`;
      if (ev.penalty) h += `<p class="nls-topology-msg nls-topology-bad">${esc(ev.penalty.msg)} (−${esc(ev.penalty.points)})</p>`;
      h += '<div class="nls-topology-reqs">';
      ev.items.forEach((it) => {
        const ok = it.score >= it.max, firstBad = it.checks.find((c) => !c.ok);
        h += `<details class="nls-topology-req${ok ? ' nls-topology-req-ok' : ''}" data-nlreq="${esc(it.id)}"${nlOpen[it.id] ? ' open' : ''}><summary><i aria-hidden="true">${ok ? '✓' : ''}</i><span>${esc(it.title)}</span><em>${esc(it.score)}/${esc(it.max)}</em></summary>` +
          '<ul class="nls-topology-todo">' + it.checks.map((c) => `<li class="${c.ok ? 'nls-topology-t-ok' : c === firstBad ? 'nls-topology-t-next' : ''}"><i aria-hidden="true">${c.ok ? '✓' : ''}</i><span>${esc(c.label)}${!c.ok && c.msg ? `<br><small>${esc(c.msg)}</small>` : ''}<span style="position:absolute;left:-9999px">${c.ok ? ' (ผ่าน)' : ' (ยังไม่ผ่าน)'}</span></span></li>`).join('') + '</ul></details>';
      });
      h += '</div>';
      if (ev.cells.length) {
        h += `<details class="nls-topology-req" data-nlreq="__cells"${nlOpen.__cells ? ' open' : ''}><summary><i aria-hidden="true"></i><span>ผลทดสอบทั้งหมด (Test matrix)</span><em>${ev.cells.filter((c) => c.pass).length}/${ev.cells.length}</em></summary><ul class="nls-topology-cells">` +
          ev.cells.map((c) => `<li class="${c.pass ? 'nls-topology-cpass' : ''}"><b>${c.pass ? '✓' : '✗'} ${esc(c.label)}</b> <span class="nls-topology-muted">(${esc(WANT_TH[c.want] || c.want)})</span>` +
            c.tests.map((t) => `<small>${esc(t.srcName)}: ${t.ok ? 'สำเร็จ' + (t.responder ? ' (ตอบโดย ' + esc(t.responder) + ')' : '') : esc(t.title)}${t.acl ? ' • ' + esc(t.acl) : ''}</small>`).join('') + '</li>').join('') + '</ul></details>';
      }
      return h;
    }
    function nlRender(force) {
      if (!isNL(S.cur)) return;
      const b = root.querySelector('[data-r=capcheck]');
      if (b) { const hh = nlHtml(nlLast); if (force || b.__h !== hh) { b.innerHTML = hh; b.__h = hh; } }
      const rc = root.querySelector('[data-r=reqcount]');
      if (rc && nlLast) { const done = nlLast.items.filter((x) => x.score >= x.max).length; rc.textContent = done + '/' + nlLast.items.length; rc.classList.toggle('nls-topology-err', done < nlLast.items.length); }
      const g = el.mission.querySelector('[data-r=nlgo]');
      if (g && nlLast) g.innerHTML = `เช็กลิสต์และผลทดสอบอัตโนมัติอยู่ในแท็บ <b>"เช็กลิสต์งาน"</b> (ผ่าน ${nlLast.items.filter((x) => x.score >= x.max).length}/${nlLast.items.length} เกณฑ์) <button type="button" class="nls-topology-btn nls-topology-ghost nls-topology-small" data-nl="showreq">เปิดเช็กลิสต์</button>`;
    }
    on(root, 'toggle', (e) => { const d = e.target; if (d && d.getAttribute && d.getAttribute('data-nlreq')) nlOpen[d.getAttribute('data-nlreq')] = d.open; }, true);
    on(root, 'click', (e) => {
      const b = e.target.closest ? e.target.closest('[data-nl]') : null;
      if (!b || !isNL(S.cur)) return;
      setTab('req');
      try { root.querySelector('[data-panel=req]').scrollIntoView({ block: 'start', behavior: reduceMotion ? 'auto' : 'smooth' }); } catch (err) { /* ignore */ }
    });

    // ------------------------------------------------------------ missions
    function statusOf(m) {
      const b = best[m.id];
      return b && b.best !== undefined && b.best !== null && b.attempts !== 0 ? `<span class="nls-topology-best">คะแนนดีที่สุด ${b.best}/${b.max || m.max || 10}</span>` : '<span>ยังไม่ทำ</span>';
    }
    function renderMissionList() {
      el.missions.innerHTML = missions.map((m, i) => `<button type="button" class="nls-topology-mbtn${S.cur === m.id ? ' nls-topology-on' : ''}" data-mid="${esc(m.id)}" aria-pressed="${S.cur === m.id}"><b>${i + 1}. ${esc(m.title)}</b><span>${esc(LEVEL_TH[m.level] || m.level || '')} • ${statusOf(m)}</span></button>`).join('') +
        `<button type="button" class="nls-topology-mbtn${S.cur === 'free' ? ' nls-topology-on' : ''}" data-mid="free" aria-pressed="${S.cur === 'free'}"><b>โหมดอิสระ</b><span>ออกแบบได้ตามใจ ไม่มีคะแนน</span></button>`;
      // phones: the list is one scrolling row of chips; bring the current one into view (without scrolling the page)
      el.tutentry.hidden = !hasTut || S.cur === TUT_ID;
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
      if (tutTimer) { clearTimeout(tutTimer); tutTimer = 0; }
      if (id === TUT_ID) { S.tut.enteredDone = false; }
      S.resetAsk = false; S.sim = null;
      renderMissionList(); renderMission(); refreshLight(); buildProps(); homeView();
      capTabVis(id === CAP_ID);
      if (id === CAP_ID) capLoadReview();
      setStatus(id === TUT_ID ? 'โหมดฝึกทีละขั้น: ทำตามเช็กลิสต์ในกล่องด้านบน ระบบจะติ๊กให้เมื่อเครือข่ายถูกต้อง' : id === 'free' ? 'โหมดอิสระ: ทดลองออกแบบเครือข่ายได้ตามใจ' : `เปิดภารกิจ: ${(missionById(id) || {}).title || id}`);
    }
    function renderMission() {
      if (S.cur === 'free') {
        el.mission.innerHTML = `<h3>โหมดอิสระ</h3><p class="nls-topology-muted">ทดลองวางอุปกรณ์ ต่อสาย ตั้งค่า และส่ง Ping ได้ตามใจ ไม่มีการตรวจคะแนน งานบันทึกอัตโนมัติในเครื่องนี้</p>
          <div class="nls-topology-row"><button type="button" class="nls-topology-btn nls-topology-ghost" data-m="reset">ล้างแผนผัง</button></div>`;
        return;
      }
      if (S.cur === TUT_ID) { tutHtml = ''; tutUpdate(true); return; }
      if (S.cur === CAP_ID && hasCap) { capRenderAll(); return; }
      const m = missionById(S.cur); if (!m) return;
      const n = S.hints[m.id] || 0, hints = Array.isArray(m.hints) ? m.hints : [];
      let h = `<h3>${esc(m.title)}<span class="nls-topology-lv nls-topology-lv-${esc(m.level)}">${esc(LEVEL_TH[m.level] || m.level || '')}</span></h3>`;
      if (MODE_TH[m.mode] || m.week) h += `<div class="nls-topology-mtags">${MODE_TH[m.mode] ? `<span>${esc(MODE_TH[m.mode])}</span>` : ''}${m.week ? `<span>สัปดาห์ที่ ${esc(m.week)}</span>` : ''}</div>`;
      h += `<p>${esc(m.desc)}</p>`;
      const guided = m.mode === 'guided';
      if (n) h += `<ul class="nls-topology-hints${guided ? ' nls-topology-steps' : ''}">` + hints.slice(0, n).map((x) => `<li>${esc(x)}</li>`).join('') + '</ul>';
      h += quizHtml(m.id);
      h += '<div class="nls-topology-row" style="margin-top:8px">';
      h += `<button type="button" class="nls-topology-btn nls-topology-go" data-m="submit"${S.busy ? ' disabled' : ''}>${S.busy ? 'กำลังตรวจ…' : 'ตรวจงาน'}</button>`;
      if (n < hints.length) h += `<button type="button" class="nls-topology-btn nls-topology-ghost" data-m="hint">${guided ? 'ดูขั้นตอนถัดไป' : 'ขอคำใบ้'} (${n + 1}/${hints.length})</button>`;
      h += '<button type="button" class="nls-topology-btn nls-topology-ghost" data-m="reset" title="แผนผังกลับเป็นค่าเริ่มต้นของภารกิจ (กด ย้อนกลับ เพื่อเอาคืนได้)">รีเซ็ตแล็บ</button></div>';
      if (isNL(m.id)) h += '<p class="nls-topology-note" data-r="nlgo"></p>';
      if (!ctx.user) h += '<p class="nls-topology-note">ยังไม่ได้เข้าสู่ระบบ: ตรวจคะแนนได้แต่จะไม่บันทึก</p>';
      h += resultHtml(m.id);
      el.mission.innerHTML = h;
      if (isNL(m.id)) nlRender();
    }
    function quizHtml(mid) {
      const qs = quizOf(mid);
      if (!qs.length) return '';
      const a = S.quiz[mid] || {};
      return `<div class="nls-topology-quiz"><h4>คำถามท้ายภารกิจ (คำตอบส่งไปพร้อมการตรวจงาน)</h4>` + qs.map((q, i) =>
        `<fieldset><legend>${i + 1}. ${esc(q.q)}</legend>` + q.options.map((o, j) =>
          `<label><input type="radio" name="nls-topology-q-${U}-${esc(mid)}-${esc(q.id)}" data-quiz="${esc(q.id)}" value="${j}"${a[q.id] === j ? ' checked' : ''}><span>${esc(o)}</span></label>`).join('') + '</fieldset>').join('') + '</div>';
    }
    on(el.mission, 'change', (e) => {
      const t = e.target;
      if (!t || !t.getAttribute || !t.getAttribute('data-quiz')) return;
      const q = quizOf(S.cur).find((x) => x.id === t.getAttribute('data-quiz'));
      const v = Math.floor(+t.value);
      if (!q || !(v >= 0 && v < q.options.length)) return;
      (S.quiz[S.cur] = S.quiz[S.cur] || {})[q.id] = v;
      saveDraft();
    });
    function resultHtml(mid) {
      const res = S.results[mid];
      let h = '';
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
      return h;
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
        const r = await ctx.submit(mid, mid === CAP_ID && hasCap ? capPayload() : Object.assign({ topo: clone(S.topo) }, quizOf(mid).length ? { answers: Object.assign({}, S.quiz[mid] || {}) } : {}));
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
      if (mid === CAP_ID) capLoadReview();
      const sc = el.mission.querySelector('.nls-topology-result,.nls-topology-msg');
      if (sc) sc.scrollIntoView({ block: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' });
    }

    // ------------------------------------------------------------ refresh
    function saveInfoInit() { if (el.saveInfo) el.saveInfo.textContent = 'บันทึกอัตโนมัติในเครื่องนี้'; }
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
      if (S.cur === TUT_ID) tutUpdate(); else el.coach.hidden = true;
      if (S.cur === CAP_ID) capSchedule();
      if (isNL(S.cur)) nlSchedule();
      updateMac();
    }

    // ------------------------------------------------------------ init
    renderMissionList(); renderMission(); renderLog(); saveInfoInit();
    capTabVis(S.cur === CAP_ID);
    if (S.cur === CAP_ID) capLoadReview();
    setTool('select');
    refreshLight(); buildProps();
    applyVB();
    if (ctx.initial && missionById(ctx.initial)) switchMission(ctx.initial);   // deep link: same as clicking the mission (keeps its saved draft)
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
        if (tutTimer) clearTimeout(tutTimer);
        if (capTimer) clearTimeout(capTimer);
        if (nlTimer) clearTimeout(nlTimer);
        if (capSaveTimer) { clearTimeout(capSaveTimer); capSaveTimer = 0; saveDraft(); }
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

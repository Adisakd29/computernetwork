'use strict';
// Subnetting Simulator — browser module (docs/SIM-SPEC.md §1 and §4.2)
// Problems come from the server (signed); the browser never receives answers. After grading, the
// step-by-step solution is computed here from the problem itself.
(function () {
  const CSS = `
.nls-subnet{--nls-mono:"JetBrains Mono",Consolas,monospace;color:var(--ink);font-family:inherit;max-width:100%;min-width:0;container-type:inline-size;container-name:nlsroot}
.nls-subnet *{box-sizing:border-box}
.nls-subnet button,.nls-subnet input,.nls-subnet select{font:inherit;color:inherit}
.nls-subnet-head{display:flex;flex-wrap:wrap;align-items:center;gap:10px 16px;margin-bottom:12px}
.nls-subnet-head h2{margin:0;font-size:1.3em;line-height:1.3;flex:1 1 220px}
.nls-subnet-tabs{display:flex;gap:4px;background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:4px;flex:1 1 320px;max-width:520px}
.nls-subnet-tab{flex:1;border:0;background:transparent;border-radius:8px;padding:9px 8px;font-weight:600;color:var(--muted);cursor:pointer;min-height:44px}
.nls-subnet-tab[aria-selected="true"]{background:var(--ink);color:var(--bg)}
.nls-subnet-box{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:14px 16px;margin-bottom:14px;min-width:0}
.nls-subnet-help summary{cursor:pointer;font-weight:600;min-height:32px;display:flex;align-items:center}
.nls-subnet-help ol{margin:8px 0 0;padding-left:22px;font-size:.93em}
.nls-subnet-help li{margin:3px 0}
.nls-subnet-grid{display:grid;grid-template-columns:minmax(220px,280px) minmax(0,1fr);gap:14px;align-items:start}
.nls-subnet-missions{display:flex;flex-direction:column;gap:8px;margin:0;padding:0;list-style:none}
.nls-subnet-mbtn{display:flex;flex-direction:column;align-items:flex-start;gap:2px;width:100%;text-align:left;background:var(--panel);border:1px solid var(--line);border-left:5px solid var(--line);border-radius:10px;padding:9px 12px;cursor:pointer;min-height:44px}
.nls-subnet-mbtn[data-level="easy"]{border-left-color:var(--green)}
.nls-subnet-mbtn[data-level="medium"]{border-left-color:var(--orange)}
.nls-subnet-mbtn[data-level="hard"]{border-left-color:var(--bad)}
.nls-subnet-mbtn[aria-current="true"]{outline:2px solid var(--blue);outline-offset:-1px;background:var(--field)}
.nls-subnet-mbtn b{font-size:.95em;line-height:1.35}
.nls-subnet-mstat{font-size:.8em;color:var(--muted)}
.nls-subnet-mstat.full{color:var(--ok);font-weight:600}
.nls-subnet-lv{display:inline-block;font-size:.75em;font-weight:700;border-radius:4px;padding:0 6px;border:1px solid currentColor;margin-right:6px;vertical-align:1px}
.nls-subnet-lv.easy{color:var(--green)}.nls-subnet-lv.medium{color:var(--orange)}.nls-subnet-lv.hard{color:var(--bad)}
.nls-subnet-mtitle{margin:0 0 4px;font-size:1.1em;line-height:1.4}
.nls-subnet-desc{margin:0 0 10px;color:var(--muted);font-size:.93em}
.nls-subnet-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.nls-subnet-btn{background:var(--ink);color:var(--bg);border:0;border-radius:8px;padding:10px 16px;font-weight:600;cursor:pointer;min-height:44px}
.nls-subnet-btn.go{background:var(--green);color:var(--on-accent,#fff)}
.nls-subnet-btn.ghost{background:transparent;color:var(--ink);border:1px solid var(--line)}
.nls-subnet-btn:disabled{opacity:.5;cursor:default}
.nls-subnet-btn:focus-visible,.nls-subnet-tab:focus-visible,.nls-subnet-mbtn:focus-visible,.nls-subnet-bit:focus-visible,.nls-subnet input:focus-visible,.nls-subnet select:focus-visible,.nls-subnet summary:focus-visible{outline:3px solid var(--blue);outline-offset:2px}
.nls-subnet-hints{margin:10px 0 0;padding-left:22px;font-size:.93em}
.nls-subnet-hints li{margin:4px 0;background:var(--field);border-radius:6px;padding:4px 8px}
.nls-subnet-q{background:var(--field);border:1px solid var(--line);border-radius:10px;padding:12px 14px;margin:12px 0}
.nls-subnet-q p{margin:0 0 6px}
.nls-subnet-big{font-family:var(--nls-mono);font-size:1.25em;font-weight:700;word-break:break-all;color:var(--blue)}
.nls-subnet-mono{font-family:var(--nls-mono)}
.nls-subnet-fields{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:10px 14px;margin:12px 0}
.nls-subnet-f{display:flex;flex-direction:column;gap:4px;min-width:0}
.nls-subnet-f span{font-size:.88em;font-weight:600}
.nls-subnet-f input,.nls-subnet-f select{width:100%;min-width:0;background:var(--field);border:1px solid var(--line);border-radius:8px;padding:9px 10px;font-family:var(--nls-mono);font-size:15px;min-height:44px}
.nls-subnet-f select{font-family:inherit}
.nls-subnet-f.ok input,.nls-subnet-f.ok select{border:2px solid var(--ok)}
.nls-subnet-f.bad input,.nls-subnet-f.bad select{border:2px solid var(--bad)}
.nls-subnet-f .nls-subnet-mark{font-size:.8em;font-weight:700}
.nls-subnet-f.ok .nls-subnet-mark{color:var(--ok)}.nls-subnet-f.bad .nls-subnet-mark{color:var(--bad)}
.nls-subnet-vrow{border:1px solid var(--line);border-radius:10px;padding:10px 12px;background:var(--panel)}
.nls-subnet-vrow h4{margin:0 0 6px;font-size:.95em}
.nls-subnet-vrow .nls-subnet-fields{margin:0;grid-template-columns:repeat(auto-fill,minmax(160px,1fr))}
.nls-subnet-vlist{display:grid;gap:10px;margin:12px 0}
.nls-subnet-msg{margin:8px 0 0;font-size:.93em}
.nls-subnet-msg.err{color:var(--bad);font-weight:600}
.nls-subnet-msg.warn{border-left:4px solid var(--orange);background:var(--field);padding:8px 10px;border-radius:8px;font-weight:600}
.nls-subnet-ex{display:flex;flex-wrap:wrap;gap:6px 10px;align-items:center;border:1px dashed var(--orange);border-radius:10px;padding:8px 10px;margin:0 0 10px;font-size:.92em}
.nls-subnet-ex b{color:var(--ink)}
.nls-subnet-ex .nls-subnet-mono{overflow-wrap:anywhere}
.nls-subnet-result{border:2px solid var(--line);border-radius:12px;padding:12px 14px;margin:12px 0}
.nls-subnet-result.full{border-color:var(--ok)}.nls-subnet-result.part{border-color:var(--orange)}.nls-subnet-result.zero{border-color:var(--bad)}
.nls-subnet-score{font-size:1.5em;font-weight:800;margin:0}
.nls-subnet-result ul{margin:6px 0 0;padding-left:20px;font-size:.93em}
.nls-subnet-result li{margin:3px 0}
.nls-subnet-sol>summary{cursor:pointer;font-weight:700;font-size:1.05em;min-height:40px;display:flex;align-items:center}
.nls-subnet-steps{list-style:none;margin:8px 0 0;padding:0;counter-reset:st}
.nls-subnet-steps>li{position:relative;padding:0;border-top:1px dashed var(--line);counter-increment:st;min-width:0}
.nls-subnet-stepd>summary{list-style:none;display:flex;align-items:center;gap:10px;cursor:pointer;padding:8px 0;min-height:44px;border-radius:8px;touch-action:manipulation}
.nls-subnet-stepd>summary::-webkit-details-marker{display:none}
.nls-subnet-stepd>summary,.nls-subnet-sol>summary,.nls-subnet-help summary{-webkit-tap-highlight-color:transparent}
.nls-subnet-stepd>summary:active{background:var(--field)}
.nls-subnet-stepd>summary::before{content:counter(st);flex:0 0 28px;width:28px;height:28px;border-radius:50%;background:var(--blue);color:#fff;font-weight:700;display:flex;align-items:center;justify-content:center;font-size:.9em}
.nls-subnet-stepd>summary::after{content:"";flex:0 0 auto;margin-left:auto;width:9px;height:9px;border-right:2px solid var(--muted);border-bottom:2px solid var(--muted);transform:translateY(-2px) rotate(45deg);transition:transform .15s}
.nls-subnet-stepd[open]>summary::after{transform:translateY(2px) rotate(-135deg)}
.nls-subnet-stepd>summary h4{margin:0;font-size:1em;flex:1 1 auto;min-width:0}
.nls-subnet-stepb{padding:0 0 10px 38px;min-width:0}
.nls-subnet-steps p{margin:4px 0}
.nls-subnet-stepbar{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0 0}
.nls-subnet-stepbar .nls-subnet-btn{min-height:36px;padding:6px 12px;font-size:.88em}
.nls-subnet-eq{font-family:var(--nls-mono);background:var(--field);border-radius:6px;padding:4px 8px;display:inline-block;max-width:100%;overflow-wrap:anywhere}
.nls-subnet-bits{display:inline-grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:3px;margin:6px 0;max-width:100%;width:340px}
.nls-subnet-bits .pv{font-size:11px;color:var(--muted);text-align:center;font-family:var(--nls-mono)}
.nls-subnet-bits .b{text-align:center;font-family:var(--nls-mono);font-weight:700;border-radius:5px;padding:4px 0;background:var(--field);border:1px solid var(--line)}
.nls-subnet-bits .b.n{background:var(--blue);color:#fff;border-color:var(--blue)}
.nls-subnet-legend{font-size:.82em;color:var(--muted);display:flex;gap:12px;flex-wrap:wrap;align-items:center}
.nls-subnet-legend i{display:inline-block;width:14px;height:14px;border-radius:3px;vertical-align:-2px;margin-right:4px;border:1px solid var(--line);background:var(--field)}
.nls-subnet-legend i.n{background:var(--blue);border-color:var(--blue)}
.nls-subnet-oct4{display:flex;flex-wrap:wrap;gap:4px 10px;font-family:var(--nls-mono);font-size:.95em;margin:6px 0}
.nls-subnet-oct4 span{white-space:nowrap}
.nls-subnet-oct4 u{text-decoration:none;color:#fff;background:var(--blue);border-radius:3px;padding:0 1px}
.nls-subnet-chips{display:flex;flex-wrap:wrap;gap:4px;margin:6px 0}
.nls-subnet-chips span{font-family:var(--nls-mono);font-size:.85em;border:1px solid var(--line);border-radius:12px;padding:1px 8px}
.nls-subnet-chips span.hit{background:var(--orange);color:#fff;border-color:var(--orange);font-weight:700}
.nls-subnet-tw{overflow-x:auto;max-width:100%;margin:6px 0;-webkit-overflow-scrolling:touch;overscroll-behavior-x:contain;
  background:linear-gradient(to right,var(--panel) 30%,transparent) left/24px 100% no-repeat local,linear-gradient(to left,var(--panel) 30%,transparent) right/24px 100% no-repeat local,
  radial-gradient(farthest-side at 0 50%,rgba(0,0,0,.18),transparent) left/10px 100% no-repeat scroll,radial-gradient(farthest-side at 100% 50%,rgba(0,0,0,.18),transparent) right/10px 100% no-repeat scroll}
.nls-subnet-tw:focus-visible{outline:3px solid var(--blue);outline-offset:2px}
.nls-subnet-table{border-collapse:collapse;font-size:.88em;min-width:100%}
.nls-subnet-table th,.nls-subnet-table td{border:1px solid var(--line);padding:5px 8px;text-align:left;white-space:nowrap}
.nls-subnet-table th{background:var(--field);font-weight:600}
.nls-subnet-table td.m{font-family:var(--nls-mono)}
.nls-subnet-table tr.hit td{background:var(--field);font-weight:700}
.nls-subnet-side{display:flex;flex-direction:column;gap:14px;min-width:0}
.nls-subnet-nav{min-width:0}
.nls-subnet-main{min-width:0}
.nls-subnet-bin{margin-bottom:0;container-type:inline-size;container-name:nlsbin}
.nls-subnet-bin h3{margin:0 0 6px;font-size:1em}
.nls-subnet-binrow{display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:3px;max-width:520px}
.nls-subnet-bit{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0;border:1px solid var(--line);background:var(--field);border-radius:8px;padding:4px 0;cursor:pointer;min-height:48px;min-width:0;touch-action:manipulation}
.nls-subnet-bit small{font-size:11px;color:var(--muted);font-family:var(--nls-mono)}
.nls-subnet-bit b{font-family:var(--nls-mono);font-size:1.15em}
.nls-subnet-bit[aria-pressed="true"]{background:var(--blue);border-color:var(--blue);color:#fff}
.nls-subnet-bit[aria-pressed="true"] small{color:#fff}
.nls-subnet-binout{display:flex;flex-wrap:wrap;gap:6px 12px;align-items:center;margin-top:8px;font-size:.93em}
.nls-subnet-binout input{width:84px;background:var(--field);border:1px solid var(--line);border-radius:8px;padding:6px 8px;font-family:var(--nls-mono);min-height:40px}
.nls-subnet-binout [data-el="bsum"]{font-size:1.05em;font-weight:600;overflow-wrap:anywhere;min-width:0}
.nls-subnet-calcin{display:grid;grid-template-columns:minmax(0,2fr) minmax(0,1.3fr);gap:10px 14px}
.nls-subnet-calcblk{display:grid;grid-template-columns:minmax(0,1fr) 88px;gap:10px;min-width:0}
.nls-subnet-sub{display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap}
.nls-subnet-sub button[aria-pressed="true"]{background:var(--ink);color:var(--bg)}
.nls-subnet-empty{color:var(--muted);font-size:.93em;margin:8px 0}
.nls-subnet-hide{display:none!important}
.nls-subnet input,.nls-subnet select,.nls-subnet button{scroll-margin-bottom:calc(var(--nl-bnav, 0px) + 72px);scroll-margin-top:72px}
@media (max-width:760px){
  .nls-subnet{padding-bottom:calc(var(--nl-bnav, 0px) + 12px)}
  .nls-subnet-grid{grid-template-columns:minmax(0,1fr)}
  .nls-subnet-side{display:contents}
  .nls-subnet-nav{order:1}.nls-subnet-main{order:2}.nls-subnet-bin{order:3}
  .nls-subnet-missions{flex-direction:row;overflow-x:auto;padding-bottom:4px;-webkit-overflow-scrolling:touch;scroll-snap-type:x proximity}
  .nls-subnet-missions li{flex:0 0 200px;scroll-snap-align:start}
  .nls-subnet-mbtn{height:100%}
  .nls-subnet-calcin{grid-template-columns:minmax(0,1fr)}
  .nls-subnet-box{padding:12px}
}
@media (max-width:600px){
  .nls-subnet-fields,.nls-subnet-vrow .nls-subnet-fields{grid-template-columns:minmax(0,1fr)}
  .nls-subnet-f input,.nls-subnet-f select{font-size:16px}
  .nls-subnet-submitrow .nls-subnet-btn{flex:1 1 auto}
  .nls-subnet-stepb{padding-left:0}
  .nls-subnet-table{font-size:.85em}
}
@media (max-width:480px){
  .nls-subnet-binrow{grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}
  .nls-subnet-bit{flex-direction:row;gap:8px;min-height:48px}
  .nls-subnet-bit small{font-size:12px}
  .nls-subnet-bits{width:100%}
}
@media (max-width:420px){
  .nls-subnet-tab{font-size:.88em;padding:8px 4px}
}
@media (pointer:coarse){
  .nls-subnet-bit,.nls-subnet-btn,.nls-subnet-mbtn,.nls-subnet-tab{min-height:48px}
  .nls-subnet-bit{min-width:44px}
  .nls-subnet-f input,.nls-subnet-f select,.nls-subnet-binout input{min-height:48px;font-size:16px}
  .nls-subnet-help summary,.nls-subnet-sol>summary{min-height:48px}
  .nls-subnet-stepd>summary{min-height:48px}
  .nls-subnet-stepbar .nls-subnet-btn{min-height:44px}
}
/* the sim column can be narrow even on wide screens (app sidebar / rail): stack missions, main and helper by real width */
@container nlsroot (max-width:719px){
  .nls-subnet-grid{grid-template-columns:minmax(0,1fr)}
  .nls-subnet-side{display:contents}
  .nls-subnet-nav{order:1}.nls-subnet-main{order:2}.nls-subnet-bin{order:3}
  .nls-subnet-missions{flex-direction:row;overflow-x:auto;padding-bottom:4px;-webkit-overflow-scrolling:touch;scroll-snap-type:x proximity}
  .nls-subnet-missions li{flex:0 0 200px;scroll-snap-align:start}
  .nls-subnet-mbtn{height:100%}
  .nls-subnet-calcin{grid-template-columns:minmax(0,1fr)}
}
/* bit row: wrap by the width the helper panel really has (side column, full width, rail/sidebar open or closed) */
@container nlsbin (max-width:229px){
  .nls-subnet-binrow{grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}
}
@container nlsbin (max-width:379px){
  @media (pointer:coarse){
    .nls-subnet-binrow{grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}
  }
}
@container nlsbin (max-width:259px){
  .nls-subnet-bit{flex-direction:column;gap:0}
}
@container nlsbin (max-width:199px){
  .nls-subnet-binrow{grid-template-columns:repeat(2,minmax(0,1fr))}
  .nls-subnet-bit{flex-direction:row;gap:8px}
}
@media (prefers-reduced-motion:reduce){.nls-subnet-stepd>summary::after{transition:none}}
/* ---- 2.6: 32-bit visualiser */
.nls-subnet-sr{position:absolute!important;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}
.nls-subnet-fold{border:1px solid var(--line);border-radius:10px;margin:12px 0;background:var(--panel);min-width:0}
.nls-subnet-fold>summary{cursor:pointer;font-weight:700;padding:10px 12px;min-height:44px;display:flex;align-items:center;gap:8px}
.nls-subnet-fold>summary small{font-weight:400;color:var(--muted)}
.nls-subnet-foldb{padding:0 12px 12px;min-width:0}
.nls-subnet-viz{container-type:inline-size;container-name:nlsviz;min-width:0}
.nls-subnet-pctl{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:4px 0 10px}
.nls-subnet-pbtn{width:44px;height:44px;border-radius:10px;border:1px solid var(--line);background:var(--field);font-size:1.4em;font-weight:700;cursor:pointer;line-height:1;touch-action:manipulation}
.nls-subnet-pbtn:disabled{opacity:.4;cursor:default}
.nls-subnet-pctl input[type=range]{flex:1 1 140px;min-width:0;height:44px;accent-color:var(--blue);cursor:pointer}
.nls-subnet-pout{font-family:var(--nls-mono);font-weight:700;flex:1 1 100%;font-size:1.05em}
.nls-subnet-pctl select{background:var(--field);border:1px solid var(--line);border-radius:8px;padding:8px;min-height:44px;max-width:100%}
.nls-subnet-bg{display:flex;flex-direction:column;gap:10px;min-width:0}
.nls-subnet-half{display:grid;grid-template-columns:3.3em repeat(8,minmax(0,1fr)) 7px repeat(8,minmax(0,1fr));gap:2px 1px;min-width:0;align-items:stretch}
.nls-subnet-half .lb{font-size:.78em;font-weight:700;display:flex;align-items:center;padding-right:4px;white-space:nowrap}
.nls-subnet-half .oh{grid-column:span 8;text-align:center;font-size:.72em;color:var(--muted);border-bottom:1px solid var(--line)}
.nls-subnet-half .nh{text-align:center;font-size:.66em;font-weight:700;color:var(--muted);font-family:var(--nls-mono)}
.nls-subnet-half .nh.n{color:var(--blue)}
.nls-subnet-half .c{font-family:var(--nls-mono);font-size:13px;text-align:center;padding:3px 0;border-radius:3px;min-width:0;border:1px solid var(--line);line-height:1.2}
.nls-subnet-half .c.n{background:var(--blue);border-color:var(--blue);color:#fff}
.nls-subnet-half .c.h{background:repeating-linear-gradient(135deg,var(--field) 0 3px,var(--panel) 3px 6px);border-style:dashed;border-color:var(--muted)}
.nls-subnet-half .c.f{font-weight:800;color:var(--ok);background:var(--field);border-style:solid;border-color:var(--ok)}
.nls-subnet-half .c.bd{box-shadow:-3px 0 0 0 var(--orange)}
.nls-subnet-half .c.be{box-shadow:3px 0 0 0 var(--orange)}
.nls-subnet-half .nh.bd{border-left:3px solid var(--orange)}
.nls-subnet-half .sp{min-width:0}
.nls-subnet-half .rowsep{grid-column:1/-1;height:0;border-top:1px dashed var(--line);margin:2px 0}
.nls-subnet-vleg{display:flex;flex-wrap:wrap;gap:6px 14px;font-size:.8em;color:var(--muted);margin:8px 0 4px;align-items:center}
.nls-subnet-vleg i{display:inline-block;width:16px;height:16px;border-radius:3px;vertical-align:-3px;margin-right:4px;border:1px solid var(--line)}
.nls-subnet-vleg i.n{background:var(--blue);border-color:var(--blue)}
.nls-subnet-vleg i.h{background:repeating-linear-gradient(135deg,var(--field) 0 3px,var(--panel) 3px 6px);border-style:dashed;border-color:var(--muted)}
.nls-subnet-vleg i.b{width:4px;background:var(--orange);border-color:var(--orange)}
.nls-subnet-vleg i.f{border-color:var(--ok);background:var(--field)}
.nls-subnet-vtab{border-collapse:collapse;font-size:.9em;margin:8px 0 0;width:100%}
.nls-subnet-vtab th,.nls-subnet-vtab td{border:1px solid var(--line);padding:4px 8px;text-align:left;vertical-align:top}
.nls-subnet-vtab th{background:var(--field);font-weight:600;width:48%}
.nls-subnet-vtab td{font-family:var(--nls-mono);overflow-wrap:anywhere}
.nls-subnet-vnote{margin:8px 0 0;font-size:.9em;background:var(--field);border-left:4px solid var(--orange);border-radius:6px;padding:6px 10px}
@container nlsviz (min-width:640px){
  .nls-subnet-bg{flex-direction:row;gap:0}
  .nls-subnet-bg>.nls-subnet-half{flex:1 1 0}
  .nls-subnet-bg>.nls-subnet-half.h2{grid-template-columns:7px repeat(8,minmax(0,1fr)) 7px repeat(8,minmax(0,1fr))}
  .nls-subnet-half.h2 .lb{visibility:hidden;overflow:hidden;padding:0}
  .nls-subnet-half .c{font-size:14px;padding:4px 0}
}
@container nlsviz (max-width:300px){
  .nls-subnet-half{grid-template-columns:2.6em repeat(8,minmax(0,1fr)) 4px repeat(8,minmax(0,1fr))}
  .nls-subnet-half .c{font-size:11px}
  .nls-subnet-half .lb{font-size:.7em}
}
/* ---- 2.6: step-by-step teaching mode */
.nls-subnet-tlist{list-style:none;margin:0;padding:0;display:grid;gap:8px}
.nls-subnet-ts{border:1px solid var(--line);border-left:5px solid var(--line);border-radius:10px;padding:8px 12px;background:var(--panel);min-width:0}
.nls-subnet-ts.cur{border-left-color:var(--blue)}
.nls-subnet-ts.ok{border-left-color:var(--ok)}
.nls-subnet-ts.shown{border-left-color:var(--orange)}
.nls-subnet-ts.lock{color:var(--muted);background:transparent}
.nls-subnet-ts h4{margin:0 0 4px;font-size:.98em}
.nls-subnet-ts .st{font-size:.8em;font-weight:700;margin-left:6px}
.nls-subnet-ts.ok .st{color:var(--ok)}.nls-subnet-ts.shown .st{color:var(--orange)}
.nls-subnet-ts p{margin:4px 0;font-size:.93em}
.nls-subnet-tin{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:8px;margin:6px 0}
.nls-subnet-tin.wide{grid-template-columns:minmax(0,1fr)}
.nls-subnet-tfb{margin:6px 0 0;font-size:.92em;border-radius:6px;padding:6px 10px}
.nls-subnet-tfb.good{background:var(--field);border-left:4px solid var(--ok)}
.nls-subnet-tfb.bad{background:var(--field);border-left:4px solid var(--bad)}
.nls-subnet-tfb:empty{display:none}
.nls-subnet-chk{width:100%;border-collapse:collapse;font-size:.88em;margin:8px 0}
.nls-subnet-chk th,.nls-subnet-chk td{border:1px solid var(--line);padding:4px 5px;text-align:center;font-size:.92em}
.nls-subnet-chk th{background:var(--field);font-weight:600;line-height:1.25}
.nls-subnet-chk td.y,.nls-subnet-chk td.x{font-size:1.1em;position:relative}
.nls-subnet-chk th:first-child,.nls-subnet-chk td:first-child{text-align:left}
.nls-subnet-chk td.y{color:var(--ok);font-weight:700}.nls-subnet-chk td.x{color:var(--bad);font-weight:700}
@media (max-width:600px){.nls-subnet-tin{grid-template-columns:minmax(0,1fr)}.nls-subnet-tin input{font-size:16px}}`;

  // ------------------------------------------------------------------------------------------
  // IPv4 math (browser copy, independent of the server)
  const ipToInt = (s) => {
    const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(String(s || '').replace(/\s+/g, ''));
    if (!m) return null; let n = 0;
    for (let i = 1; i <= 4; i++) { const o = Number(m[i]); if (o > 255) return null; n = n * 256 + o; }
    return n;
  };
  const oct = (n, i) => Math.floor(n / Math.pow(256, 3 - i)) % 256;
  const octs = (n) => [0, 1, 2, 3].map((i) => oct(n, i));
  const ipStr = (n) => octs(n).join('.');
  const maskInt = (p) => (p <= 0 ? 0 : (0xFFFFFFFF << (32 - p)) >>> 0);
  const netOf = (ip, p) => (ip & maskInt(p)) >>> 0;
  const pow2 = (h) => Math.pow(2, h);
  const prefixFromMask = (m) => { const inv = (~m) >>> 0; if ((inv & (inv + 1)) !== 0) return null; let p = 0; for (let i = 31; i >= 0 && ((m >>> i) & 1); i--) p++; return p; };
  const parseMaskOrPrefix = (s) => {
    s = String(s || '').replace(/\s+/g, '');
    const m = /^\/?(\d{1,2})$/.exec(s); if (m) { const p = Number(m[1]); return p <= 32 ? p : null; }
    const mi = ipToInt(s); return mi === null ? null : prefixFromMask(mi);
  };
  const classOf = (ip) => { const o = oct(ip, 0); return o < 128 ? 'A' : o < 192 ? 'B' : o < 224 ? 'C' : o < 240 ? 'D' : 'E'; };
  const needH = (n) => { let h = 2; while (pow2(h) - 2 < n) h++; return h; };
  const fmt = (n) => Number(n).toLocaleString('en-US');
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const bin8 = (v) => ('00000000' + v.toString(2)).slice(-8);
  const ORD = ['แรก', 'ที่ 2', 'ที่ 3', 'ที่ 4'];

  // ------------------------------------------------------------------------------------------
  // Solution renderers (return HTML)
  function bitsRow(v, netBits) {
    let h = '<div class="nls-subnet-bits" aria-hidden="true">';
    [128, 64, 32, 16, 8, 4, 2, 1].forEach((pv) => { h += `<span class="pv">${pv}</span>`; });
    bin8(v).split('').forEach((b, i) => { h += `<span class="b${i < netBits ? ' n' : ''}">${b}</span>`; });
    return h + '</div><span class="nls-subnet-legend"><span><i class="n"></i>บิต network</span><span><i></i>บิต host</span></span>';
  }
  function oct4(n, p) { // dotted binary with first p bits highlighted
    const b = octs(n).map(bin8).join('');
    let out = '<div class="nls-subnet-oct4" aria-label="' + esc(ipStr(n)) + '">';
    for (let i = 0; i < 4; i++) {
      out += '<span>';
      for (let j = 0; j < 8; j++) { const k = i * 8 + j; out += k < p ? `<u>${b[k]}</u>` : b[k]; }
      out += '</span>' + (i < 3 ? '.' : '');
    }
    return out + '</div>';
  }
  // each step is its own disclosure (accordion); the caller decides which ones start open
  const step = (title, body) => `<li><details class="nls-subnet-stepd" open><summary><h4>${title}</h4></summary><div class="nls-subnet-stepb">${body}</div></details></li>`;
  const eq = (s) => `<span class="nls-subnet-eq">${s}</span>`;
  function blockChips(v, B) {
    if (B >= 256) return '';
    const starts = []; for (let s = 0; s < 256; s += B) starts.push(s);
    let list = starts;
    const hitIdx = Math.floor(v / B);
    if (starts.length > 16) list = starts.slice(Math.max(0, hitIdx - 3), hitIdx + 4);
    const pre = list[0] > 0 ? '<span>…</span>' : ''; const post = list[list.length - 1] + B < 256 ? '<span>…</span>' : '';
    return '<div class="nls-subnet-chips">' + pre + list.map((s) => `<span class="${s === hitIdx * B ? 'hit' : ''}">${s}–${s + B - 1}</span>`).join('') + post + '</div>';
  }

  function hostSteps(ip, p, how) {
    how = how || {};
    const h = 32 - p, mask = maskInt(p), net = netOf(ip, p), bc = net + pow2(h) - 1;
    const io = Math.min(3, Math.floor(p / 8)); // octet index containing the boundary (or first all-host octet)
    const mo = oct(mask, io), v = oct(ip, io), B = 256 - mo, q = Math.floor(v / B), nv = q * B;
    const netBitsHere = p - io * 8;
    let s = '';
    if (how.classful) {
      const c = classOf(ip), o1 = oct(ip, 0);
      s += step('ดู Class จาก octet แรก', `<p>octet แรก = <b>${o1}</b> → ` + (c === 'A' ? 'อยู่ช่วง 1–126' : c === 'B' ? 'อยู่ช่วง 128–191' : 'อยู่ช่วง 192–223') +
        ` จึงเป็น <b>Class ${c}</b> ใช้ default mask <b>/${p}</b></p>`);
    }
    if (how.maskGiven) {
      const mo4 = octs(mask);
      s += step('แปลง Subnet mask เป็น prefix', oct4(mask, p) + '<p>' + mo4.map((o) => `${o} = ${bin8(o).split('').filter((c) => c === '1').length} บิต`).join(', ') +
        `</p><p>${eq(mo4.map((o) => bin8(o).split('').filter((c) => c === '1').length).join(' + ') + ' = /' + p)}</p>`);
    }
    s += step('เขียน Subnet mask เป็นเลขฐานสอง', oct4(mask, p) + `<p>บิต 1 จำนวน <b>${p}</b> บิต = ส่วน network, บิต 0 จำนวน <b>${h}</b> บิต = ส่วน host</p><p>Subnet mask = ${eq(ipStr(mask) + '  (/' + p + ')')}</p>`);
    s += step('หา octet ที่สนใจ', (netBitsHere === 0
      ? `<p>/${p} ลงตัวที่ 8 บิตพอดี → octet ${ORD[io]} เป็นส่วน host ทั้งหมด (mask = 0)</p>`
      : `<p>ขอบเขต network/host อยู่ใน octet ${ORD[io]} (mask ใน octet นี้ = <b>${mo}</b>) มีบิต network ${netBitsHere} บิต</p>`) +
      `<p>octet ${ORD[io]} ของ IP = <b>${v}</b> = ${eq(bin8(v))}</p>` + bitsRow(v, netBitsHere));
    s += step('หา Block size', `<p>${eq('256 − ' + mo + ' = ' + B)}${B === 256 ? ' (ทั้ง octet)' : ''}</p>` +
      (B < 256 ? `<p>วงย่อยใน octet นี้เริ่มที่ ${[0, B, 2 * B, 3 * B].filter((x) => x < 256).join(', ')}${4 * B < 256 ? ', …' : ''} → เลข ${v} อยู่ในวงที่ไฮไลต์</p>` + blockChips(v, B) : ''));
    s += step('หา Network address', `<p>${eq('⌊' + v + ' ÷ ' + B + '⌋ × ' + B + ' = ' + q + ' × ' + B + ' = ' + nv)}</p>` +
      `<p>octet ทางซ้ายคงเดิม, octet ทางขวาเป็น 0 → Network = <b class="nls-subnet-mono">${ipStr(net)}</b></p>` +
      (netBitsHere > 0 ? `<p>(เทียบแบบ AND: ${eq(bin8(v) + ' AND ' + bin8(mo) + ' = ' + bin8(nv))})</p>` : ''));
    s += step('หา Broadcast address', `<p>network ถัดไป ${eq(nv + ' + ' + B + ' = ' + (nv + B))} → broadcast ${eq((nv + B) + ' − 1 = ' + (nv + B - 1))}</p>` +
      `<p>octet ทางขวาเป็น 255 → Broadcast = <b class="nls-subnet-mono">${ipStr(bc)}</b></p>`);
    s += step('หา Host แรกและ Host สุดท้าย', `<p>Host แรก = network + 1 = <b class="nls-subnet-mono">${ipStr(net + 1)}</b></p><p>Host สุดท้าย = broadcast − 1 = <b class="nls-subnet-mono">${ipStr(bc - 1)}</b></p>`);
    s += step('นับจำนวน Host ที่ใช้ได้', `<p>h = 32 − ${p} = ${h} บิต → ${eq('2^' + h + ' − 2 = ' + fmt(pow2(h)) + ' − 2 = ' + fmt(pow2(h) - 2))}</p><p>(ลบ 2 เพราะ network address และ broadcast address ใช้กับเครื่องไม่ได้)</p>`);
    const rows = [['Class', how.classful ? classOf(ip) : null], ['Subnet mask', ipStr(mask) + ' (/' + p + ')'], ['Network', ipStr(net)], ['Broadcast', ipStr(bc)],
      ['Host แรก', ipStr(net + 1)], ['Host สุดท้าย', ipStr(bc - 1)], ['จำนวน host', fmt(pow2(h) - 2)]].filter((r) => r[1] !== null);
    s += step('สรุป', '<div class="nls-subnet-tw" tabindex="0" role="region" aria-label="ตาราง (เลื่อนซ้าย-ขวาได้)"><table class="nls-subnet-table"><tbody>' + rows.map((r) => `<tr><th>${r[0]}</th><td class="m">${esc(r[1])}</td></tr>`).join('') + '</tbody></table></div>');
    return '<ol class="nls-subnet-steps">' + s + '</ol>';
  }

  function netQuick(label, ip, p) {
    const io = Math.min(3, Math.floor(p / 8)), mo = oct(maskInt(p), io), v = oct(ip, io), B = 256 - mo, nv = Math.floor(v / B) * B;
    return `<p><b>${label}</b> ${eq(ipStr(ip))}: octet ${ORD[io]} = ${v} → ${eq('⌊' + v + ' ÷ ' + B + '⌋ × ' + B + ' = ' + nv)} → network <b class="nls-subnet-mono">${ipStr(netOf(ip, p))}</b></p>` + bitsRow(v, p - io * 8);
  }
  function sameSteps(a, b, p) {
    const io = Math.min(3, Math.floor(p / 8)), mo = oct(maskInt(p), io), B = 256 - mo;
    const na = netOf(a, p), nb = netOf(b, p);
    let s = step('หา mask และ block size', `<p>/${p} → mask ${eq(ipStr(maskInt(p)))}, octet ที่สนใจคือ octet ${ORD[io]} (mask = ${mo}) → block size ${eq('256 − ' + mo + ' = ' + B)}</p>`);
    s += step('หา network ของ IP A', netQuick('IP A', a, p));
    s += step('หา network ของ IP B', netQuick('IP B', b, p));
    s += step('เปรียบเทียบ', `<p>${eq(ipStr(na))} ${na === nb ? '=' : '≠'} ${eq(ipStr(nb))} → <b>${na === nb ? 'อยู่ subnet เดียวกัน (ส่งหากันได้ตรง ๆ ผ่าน switch)' : 'อยู่คนละ subnet (ต้องผ่าน router / default gateway)'}</b></p>`);
    return '<ol class="nls-subnet-steps">' + s + '</ol>';
  }

  function hostsTable(n) {
    const h0 = needH(n); let rows = '';
    for (let h = Math.max(2, h0 - 3); h <= h0; h++) rows += `<tr class="${h === h0 ? 'hit' : ''}"><td class="m">${h}</td><td class="m">2^${h} − 2 = ${fmt(pow2(h) - 2)}</td><td>${pow2(h) - 2 >= n ? 'พอ ✔' : 'ไม่พอ'}</td><td class="m">/${32 - h}</td></tr>`;
    return '<div class="nls-subnet-tw" tabindex="0" role="region" aria-label="ตาราง (เลื่อนซ้าย-ขวาได้)"><table class="nls-subnet-table"><thead><tr><th>h (บิต host)</th><th>host ที่ใช้ได้</th><th>' + fmt(n) + ' hosts?</th><th>prefix</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
  }
  function sizeInOctets(size) {
    if (size < 256) return `${size} ใน octet ที่ 4`;
    if (size < 65536) return `${size / 256} ใน octet ที่ 3 (เพราะ ${fmt(size)} = ${size / 256} × 256)`;
    return `${size / 65536} ใน octet ที่ 2 (เพราะ ${fmt(size)} = ${size / 65536} × 65,536)`;
  }
  function countSteps(pr) {
    const blk = ipToInt(pr.block), y = pr.prefix, x = pr.x, k = pr.k, n = pr.n, d = x - y, size = pow2(32 - x);
    let s = step('จำนวน subnet', `<p>ยืมบิต host มา ${eq(x + ' − ' + y + ' = ' + d)} บิต → ${eq('2^' + d + ' = ' + fmt(pow2(d)))} subnet</p>`);
    s += step('จำนวน host ต่อ subnet', `<p>h = 32 − ${x} = ${32 - x} → ${eq('2^' + (32 - x) + ' − 2 = ' + fmt(size - 2))}</p>`);
    let list = '';
    const show = []; for (let i = 1; i <= Math.min(3, k); i++) show.push(i); if (show.indexOf(k) < 0) show.push(k);
    show.forEach((i, j) => {
      if (j > 0 && i !== show[j - 1] + 1) list += '<tr><td colspan="3">…</td></tr>';
      const nn = blk + (i - 1) * size;
      list += `<tr class="${i === k ? 'hit' : ''}"><td>${i}</td><td class="m">${ipStr(nn)}/${x}</td><td class="m">${ipStr(nn + size - 1)}</td></tr>`;
    });
    s += step('Network ของ subnet ลำดับที่ ' + k, `<p>ขนาด block ของ /${x} = 2^${32 - x} = ${fmt(size)} addresses = เพิ่มทีละ ${sizeInOctets(size)}</p>` +
      `<p>${eq('network ที่ ' + k + ' = ' + pr.block + ' + (' + k + ' − 1) × ' + fmt(size) + ' = ' + ipStr(blk + (k - 1) * size))}</p>` +
      '<div class="nls-subnet-tw" tabindex="0" role="region" aria-label="ตาราง (เลื่อนซ้าย-ขวาได้)"><table class="nls-subnet-table"><thead><tr><th>ลำดับ</th><th>Network</th><th>Broadcast</th></tr></thead><tbody>' + list + '</tbody></table></div>');
    s += step('Prefix สำหรับ ' + fmt(n) + ' hosts', `<p>หา h ที่น้อยที่สุดที่ 2^h − 2 ≥ ${fmt(n)}</p>` + hostsTable(n) + `<p>→ h = ${needH(n)} → prefix ${eq('32 − ' + needH(n) + ' = /' + (32 - needH(n)))} (mask ${ipStr(maskInt(32 - needH(n)))})</p>`);
    return '<ol class="nls-subnet-steps">' + s + '</ol>';
  }

  function vlsmPlan(blk, b, reqs) {
    const order = reqs.map((r, i) => ({ i, name: r.name, hosts: r.hosts })).sort((p, q) => q.hosts - p.hosts || p.i - q.i);
    let next = netOf(blk, b); const end = netOf(blk, b) + pow2(32 - b);
    order.forEach((o) => { o.h = needH(o.hosts); o.p = 32 - o.h; o.size = pow2(o.h); o.net = next; o.bc = next + o.size - 1; o.fits = o.bc < end; next += o.size; });
    return { order, next, end };
  }
  function vlsmSteps(blk, b, reqs) {
    const plan = vlsmPlan(blk, b, reqs);
    let s = step('เรียงจาก host มากไปน้อย', '<p>' + plan.order.map((o) => `${esc(o.name)} (${fmt(o.hosts)})`).join(' → ') + '</p><p class="nls-subnet-legend">ถ้าจำนวนเท่ากัน ให้จัดตามลำดับในโจทย์</p>');
    s += step('เลือกขนาด block ของแต่ละห้อง', '<div class="nls-subnet-tw" tabindex="0" role="region" aria-label="ตาราง (เลื่อนซ้าย-ขวาได้)"><table class="nls-subnet-table"><thead><tr><th>ห้อง</th><th>ต้องการ</th><th>h</th><th>2^h − 2</th><th>block</th><th>prefix</th></tr></thead><tbody>' +
      plan.order.map((o) => `<tr><td>${esc(o.name)}</td><td class="m">${fmt(o.hosts)}</td><td class="m">${o.h}</td><td class="m">${fmt(o.size - 2)}</td><td class="m">${fmt(o.size)}</td><td class="m">/${o.p}</td></tr>`).join('') + '</tbody></table></div>');
    s += step('วางต่อกันตั้งแต่ต้น block ' + ipStr(netOf(blk, b)) + '/' + b, '<p>network ถัดไป = network ก่อนหน้า + ขนาด block ก่อนหน้า</p><div class="nls-subnet-tw" tabindex="0" role="region" aria-label="ตาราง (เลื่อนซ้าย-ขวาได้)"><table class="nls-subnet-table"><thead><tr><th>ห้อง</th><th>Network/prefix</th><th>Host แรก – สุดท้าย</th><th>Broadcast</th></tr></thead><tbody>' +
      plan.order.map((o) => `<tr><td>${esc(o.name)}</td><td class="m">${o.fits ? ipStr(o.net) + '/' + o.p : 'ไม่พอ!'}</td><td class="m">${o.fits ? ipStr(o.net + 1) + ' – ' + ipStr(o.bc - 1) : '-'}</td><td class="m">${o.fits ? ipStr(o.bc) : '-'}</td></tr>`).join('') + '</tbody></table></div>' +
      (plan.next <= plan.end ? `<p>ใช้ไป ${fmt(plan.next - netOf(blk, b))} จาก ${fmt(pow2(32 - b))} addresses เหลือตั้งแต่ <span class="nls-subnet-mono">${ipStr(plan.next)}</span> ไว้ขยายภายหลัง</p>` : '<p class="nls-subnet-msg err">block นี้มีขนาดไม่พอสำหรับทุกห้อง</p>'));
    return '<ol class="nls-subnet-steps">' + s + '</ol>';
  }

  function solutionFor(pr) {
    try {
      if (pr.kind === 'host') {
        const ip = ipToInt(pr.ip); if (ip === null) return '';
        if (pr.mission === 's1') return hostSteps(ip, { A: 8, B: 16, C: 24 }[classOf(ip)] || 24, { classful: true });
        if (pr.mask) return hostSteps(ip, prefixFromMask(ipToInt(pr.mask)), { maskGiven: true });
        return hostSteps(ip, pr.prefix, {});
      }
      if (pr.kind === 'same') return sameSteps(ipToInt(pr.ipA), ipToInt(pr.ipB), pr.prefix);
      if (pr.kind === 'count') return countSteps(pr);
      if (pr.kind === 'vlsm') {
        const base = vlsmSteps(ipToInt(pr.block), pr.prefix, pr.reqs);
        if (pr.mission !== 's9') return base;
        return '<p class="nls-subnet-vnote">ภารกิจนี้ตรวจตามเงื่อนไข (ใหญ่พอ, ไม่เปลือง, aligned, ไม่ทับกัน, อยู่ใน block) ด้านล่างคือคำตอบแบบ largest-first ซึ่งเป็นแบบหนึ่งที่ถูก — ถ้าจัดวางต่างออกไปแต่ผ่านทุกเงื่อนไขก็ได้คะแนนเต็ม' +
          (pr.reqs.some((r) => r.link) ? ' · ลิงก์ Router–Router ใช้ /31 (RFC 3021) แทน /30 ได้' : '') + '</p>' + base;
      }
      if (pr.kind === 'special') return specialSteps(pr);
    } catch (e) { /* fall through */ }
    return '<p class="nls-subnet-empty">แสดงวิธีทำของโจทย์นี้ไม่ได้</p>';
  }

  function statementFor(pr) {
    if (pr.kind === 'host') {
      if (pr.mission === 's1') return `<p>IP Address</p><p class="nls-subnet-big">${esc(pr.ip)}</p><p class="nls-subnet-desc">ไม่บอก mask — ใช้ default mask ตาม Class</p>`;
      if (pr.mask) return `<p>IP Address <span class="nls-subnet-big">${esc(pr.ip)}</span></p><p>Subnet mask <span class="nls-subnet-big">${esc(pr.mask)}</span></p>`;
      const pn = pr.mission === 's8' ? privNote(ipToInt(pr.ip)) : '';
      return `<p>IP Address / prefix</p><p class="nls-subnet-big">${esc(pr.ip)}/${esc(pr.prefix)}</p>` + (pn ? `<p class="nls-subnet-desc">${esc(pn)}</p>` : '');
    }
    if (pr.kind === 'special') return specialStatement(pr);
    if (pr.kind === 'same') return `<p>IP A <span class="nls-subnet-big">${esc(pr.ipA)}/${esc(pr.prefix)}</span></p><p>IP B <span class="nls-subnet-big">${esc(pr.ipB)}/${esc(pr.prefix)}</span></p>`;
    if (pr.kind === 'count') return `<p>Block <span class="nls-subnet-big">${esc(pr.block)}/${esc(pr.prefix)}</span> แบ่งเป็น subnet ย่อยขนาด <span class="nls-subnet-big">/${esc(pr.x)}</span></p>` +
      `<p>ตอบ: จำนวน subnet, host ต่อ subnet, network ของ subnet ลำดับที่ <b>${esc(pr.k)}</b> (subnet แรก = ลำดับที่ 1) และ prefix ที่เล็กที่สุดที่รองรับ <b>${fmt(pr.n)}</b> hosts</p>`;
    if (pr.kind === 'vlsm') return `<p>Block ที่ได้รับ <span class="nls-subnet-big">${esc(pr.block)}/${esc(pr.prefix)}</span></p><p>ความต้องการ (ยังไม่เรียง):</p>` +
      '<div class="nls-subnet-tw" tabindex="0" role="region" aria-label="ตาราง (เลื่อนซ้าย-ขวาได้)"><table class="nls-subnet-table"><thead><tr><th>ห้อง / ลิงก์</th><th>จำนวน host</th></tr></thead><tbody>' +
      pr.reqs.map((r) => `<tr><td>${esc(r.name)}</td><td class="m">${fmt(r.hosts)}</td></tr>`).join('') + '</tbody></table></div>' +
      (pr.mission === 's9' ? '<p class="nls-subnet-desc">ระบบตรวจแต่ละ subnet ว่า: network ถูกต้องและ aligned, อยู่ใน block, host พอ, ไม่เปลือง (prefix เล็กที่สุดที่พอ) และไม่ทับกับ subnet อื่น — แนะนำให้จัดแบบ largest-first' +
        (pr.reqs.some((r) => r.link) ? ' · ลิงก์ Router–Router ใช้ /30 หรือ /31 ก็ได้' : '') + '</p>'
        : '<p class="nls-subnet-desc">จัดสรรจากห้องที่ต้องการ host มากที่สุดก่อน ถ้าเท่ากันให้จัดตามลำดับในตาราง</p>');
    return '';
  }

  // ------------------------------------------------------------------------------------------
  // 2.6: special prefixes (s10), private-range note (s8), VLSM rule-check table (s9)
  function privNote(ip) {
    const a = oct(ip, 0), b = oct(ip, 1);
    if (a === 10) return 'IP นี้อยู่ในช่วง private 10.0.0.0/8 (ขนาดเท่า Class A ทั้งก้อน)';
    if (a === 172 && b >= 16 && b <= 31) return 'IP นี้อยู่ในช่วง private 172.16.0.0/12 (172.16.0.0 – 172.31.255.255 = 16 วงขนาด Class B)';
    if (a === 192 && b === 168) return 'IP นี้อยู่ในช่วง private 192.168.0.0/16 (256 วงขนาด Class C)';
    return '';
  }
  const LINK_TXT = {
    legacy: 'router รุ่นเก่า <b>ไม่รองรับ RFC 3021 (/31)</b> ต้องมี network และ broadcast ตามแบบดั้งเดิม เลือก prefix ที่ประหยัดที่สุด',
    rfc3021: 'router ทั้งสองตัว <b>รองรับ RFC 3021</b> และต้องการ <b>ประหยัด address มากที่สุด</b>'
  };
  function specialStatement(pr) {
    return '<p>เครือข่าย WAN ของวิทยาลัยมี router 4 ตัว (R1–R4):</p><ol class="nls-subnet-hints" style="list-style:decimal">' +
      `<li>ลิงก์ R1–R2 (point-to-point): ${LINK_TXT[pr.variant] || ''}</li>` +
      '<li>R1 มี interface <b>Loopback0</b> ใช้เป็น Router ID ต้องการ address เดียว</li>' +
      `<li>ลิงก์ R2–R3 ใช้ /30 — R2 ใช้ IP <span class="nls-subnet-big">${esc(pr.ip30)}/30</span></li>` +
      `<li>ลิงก์ R3–R4 ใช้ /31 (RFC 3021) — R3 ใช้ IP <span class="nls-subnet-big">${esc(pr.ip31)}/31</span></li></ol>`;
  }
  function specialSteps(pr) {
    const a = ipToInt(pr.ip30), c = ipToInt(pr.ip31); const n30 = netOf(a, 30), n31 = netOf(c, 31);
    const peer30 = a === n30 + 1 ? n30 + 2 : n30 + 1, peer31 = c === n31 ? n31 + 1 : n31;
    let s = step('เลือก prefix ของลิงก์ R1–R2', pr.variant === 'legacy'
      ? '<p>ลิงก์มี 2 เครื่อง แบบดั้งเดิมต้องมี network + broadcast → ต้องการ 2 + 2 = 4 address → h = 2 → <b>/30</b> (255.255.255.252)</p>'
      : '<p>RFC 3021 อนุญาตให้ลิงก์ point-to-point ใช้ /31: มี 2 address ใช้กับ router ได้ทั้งคู่ ไม่เสีย address ให้ network/broadcast → <b>/31</b> (255.255.255.254) ประหยัดกว่า /30 ครึ่งหนึ่ง</p>');
    s += step('Loopback0 ใช้ address เดียว', '<p>h = 0 → 2^0 = 1 address → <b>/32</b> (255.255.255.255) ใช้กับ loopback / Router ID / host route</p>');
    s += step('ลิงก์ /30 ของ R2–R3', `<p>/30 → block size = 256 − 252 = 4 → octet สุดท้ายของ R2 = ${oct(a, 3)} → ${eq('⌊' + oct(a, 3) + ' ÷ 4⌋ × 4 = ' + oct(n30, 3))}</p>` +
      `<p>Network <b class="nls-subnet-mono">${ipStr(n30)}</b>, host ${ipStr(n30 + 1)} และ ${ipStr(n30 + 2)}, Broadcast <b class="nls-subnet-mono">${ipStr(n30 + 3)}</b></p>` +
      `<p>R2 ใช้ ${ipStr(a)} → R3 ได้ <b class="nls-subnet-mono">${ipStr(peer30)}</b></p>` + oct4(a, 30));
    s += step('ลิงก์ /31 ของ R3–R4', `<p>/31 → block size 2 → คู่ของ address คือเลขคู่กับเลขคี่ถัดไป: ${ipStr(n31)} และ ${ipStr(n31 + 1)}</p>` +
      `<p>R3 ใช้ ${ipStr(c)} → R4 ได้ <b class="nls-subnet-mono">${ipStr(peer31)}</b> (ไม่มี network/broadcast ให้กันไว้)</p>` + oct4(c, 31));
    s += step('จำนวน address ที่ใช้ได้', '<p>/31: สูตร 2^1 − 2 = 0 ใช้ไม่ได้ เพราะ RFC 3021 ให้ใช้ทั้ง 2 address → <b>2</b></p><p>/32: 2^0 = <b>1</b> address คือตัว IP เอง</p>');
    return '<ol class="nls-subnet-steps">' + s + '</ol>';
  }
  function vlsmCheckTable(res) {
    const subs = res && res.details && Array.isArray(res.details.subnets) ? res.details.subnets : null;
    if (!subs) return '';
    const cols = [['valid', 'aligned'], ['inside', 'ใน block'], ['enough', 'host พอ'], ['minimal', 'ไม่เปลือง'], ['noOverlap', 'ไม่ทับ']];
    const cell = (v) => v ? '<td class="y">✔<span class="nls-subnet-sr"> ผ่าน</span></td>' : '<td class="x">✘<span class="nls-subnet-sr"> ไม่ผ่าน</span></td>';
    return '<div class="nls-subnet-tw" tabindex="0" role="region" aria-label="ผลตรวจแต่ละ subnet (เลื่อนซ้าย-ขวาได้)"><table class="nls-subnet-chk"><thead><tr><th>ห้อง / ลิงก์</th>' +
      cols.map((c) => `<th>${c[1]}</th>`).join('') + '</tr></thead><tbody>' +
      subs.map((x) => `<tr><td>${esc(x.name)} (${fmt(x.hosts)})</td>` + cols.map((c) => cell(x.checks && x.checks[c[0]])).join('') + '</tr>').join('') + '</tbody></table></div>';
  }

  // ------------------------------------------------------------------------------------------
  // 2.6: 32-bit visualiser (IP, mask, AND → network, NOT mask, OR → broadcast)
  const bits32 = (n) => octs(n).map(bin8).join('');
  function vizSources(pr, graded) {
    if (!pr) return [];
    const S = (label, ip, p, known) => ({ label, ip: ipToInt(ip), p, known });
    if (pr.kind === 'host') {
      const ip = ipToInt(pr.ip); if (ip === null) return [];
      if (pr.mission === 's1') return [S('IP ' + pr.ip, pr.ip, { A: 8, B: 16, C: 24 }[classOf(ip)] || 24, graded)];
      if (pr.mask) return [S('IP ' + pr.ip, pr.ip, prefixFromMask(ipToInt(pr.mask)), graded)];
      return [S('IP ' + pr.ip, pr.ip, pr.prefix, true)];
    }
    if (pr.kind === 'same') return [S('IP A ' + pr.ipA, pr.ipA, pr.prefix, true), S('IP B ' + pr.ipB, pr.ipB, pr.prefix, true)];
    if (pr.kind === 'count') return [S('Block ' + pr.block, pr.block, pr.prefix, true)];
    if (pr.kind === 'vlsm') return [S('Block ' + pr.block, pr.block, pr.prefix, true)];
    if (pr.kind === 'special') return [S('R2 ' + pr.ip30, pr.ip30, 30, true), S('R3 ' + pr.ip31, pr.ip31, 31, true), S('Loopback (ตัวอย่าง R2)', pr.ip30, 32, true)];
    return [];
  }
  function vizShell(scope, srcs, srcIdx, revealable, reveal) {
    let h = `<div class="nls-subnet-viz" data-viz="${scope}">`;
    if (srcs.length > 1) h += `<div class="nls-subnet-pctl"><label class="nls-subnet-f" style="flex:1 1 100%"><span>ดูค่าของ</span><select data-el="vizsrc">` +
      srcs.map((s, i) => `<option value="${i}"${i === srcIdx ? ' selected' : ''}>${esc(s.label)}</option>`).join('') + '</select></label></div>';
    h += '<div class="nls-subnet-pctl" role="group" aria-label="ปรับ prefix">' +
      '<button type="button" class="nls-subnet-pbtn" data-act="vizminus" aria-label="ลด prefix 1 บิต">−</button>' +
      '<input type="range" min="1" max="32" step="1" value="24" data-el="vizp" aria-label="Prefix length (เลื่อนเพื่อเปลี่ยนจำนวนบิต network)">' +
      '<button type="button" class="nls-subnet-pbtn" data-act="vizplus" aria-label="เพิ่ม prefix 1 บิต">+</button>' +
      '<output class="nls-subnet-pout" data-el="vizout" aria-live="polite"></output></div>';
    if (revealable) h += `<button type="button" class="nls-subnet-btn ghost" data-act="vizreveal" aria-pressed="${reveal ? 'true' : 'false'}">${reveal ? 'ซ่อนผล AND / OR' : 'แสดงผล AND / OR (Network, Broadcast)'}</button>`;
    return h + '<div data-el="vizbody"></div></div>';
  }
  function vizHalf(half, rows, p) {
    let h = `<div class="nls-subnet-half${half ? ' h2' : ''}" aria-hidden="true">`;
    const o0 = half * 2;
    h += `<span class="lb"></span><span class="oh">octet ${o0 + 1}</span><span class="sp"></span><span class="oh">octet ${o0 + 2}</span>`;
    // N / H marker row with the prefix boundary
    h += '<span class="lb">ส่วน</span>';
    for (let j = 0; j < 16; j++) {
      const k = half * 16 + j; if (j === 8) h += '<span class="sp"></span>';
      h += `<span class="nh${k < p ? ' n' : ''}${k === p ? ' bd' : ''}">${k < p ? 'N' : 'H'}</span>`;
    }
    rows.forEach((r, ri) => {
      if (r.sep && ri) h += '<span class="rowsep"></span>';
      h += `<span class="lb">${r.short}</span>`;
      for (let j = 0; j < 16; j++) {
        const k = half * 16 + j; if (j === 8) h += '<span class="sp"></span>';
        const forced = r.forced && k >= p;
        h += `<span class="c ${forced ? 'f' : k < p ? 'n' : 'h'}${k === p ? ' bd' : ''}${p === 32 && k === 31 ? ' be' : ''}">${r.bits[k]}</span>`;
      }
    });
    return h + '</div>';
  }
  function vizBody(ip, p, reveal) {
    const mask = maskInt(p), wild = (~mask) >>> 0, net = netOf(ip, p), bc = (net + pow2(32 - p) - 1) >>> 0, h = 32 - p;
    const rows = [{ short: 'IP', name: 'IP address', v: ip }, { short: 'Mask', name: 'Subnet mask /' + p, v: mask }];
    if (reveal) rows.push({ short: 'AND', name: 'Network = IP AND Mask', v: net, sep: true, forced: true },
      { short: 'NOT', name: 'Wildcard = NOT Mask', v: wild, sep: true }, { short: 'OR', name: 'Broadcast = IP OR Wildcard', v: bc, forced: true });
    rows.forEach((r) => { r.bits = bits32(r.v); });
    let out = '<div class="nls-subnet-bg">' + vizHalf(0, rows, p) + vizHalf(1, rows, p) + '</div>';
    out += '<div class="nls-subnet-vleg" aria-hidden="true"><span><i class="n"></i>N = บิต network (ทึบ)</span><span><i class="h"></i>H = บิต host (ลายเส้น)</span><span><i class="b"></i>เส้นแบ่ง /' + p + '</span>' +
      (reveal ? '<span><i class="f"></i>บิต host ที่ถูกบังคับ (AND → 0, OR → 1)</span>' : '') + '</div>';
    // text equivalent for screen readers: each row split at the prefix
    const split = (b) => { const a = b.slice(0, p), c = b.slice(p); const dot = (s, off) => s.replace(/./g, (ch, i) => ((off + i) % 8 === 0 && off + i > 0 ? '.' : '') + ch); return 'ส่วน network ' + (a ? dot(a, 0) : 'ไม่มี') + ', ส่วน host ' + (c ? dot(c, p) : 'ไม่มี'); };
    out += '<div class="nls-subnet-sr">' + rows.map((r) => `<p>${esc(r.name)} = ${ipStr(r.v)} ฐานสอง ${split(r.bits)}</p>`).join('') + '</div>';
    out += '<table class="nls-subnet-vtab"><tbody>' + rows.map((r) => `<tr><th scope="row">${esc(r.name)}</th><td>${ipStr(r.v)}</td></tr>`).join('');
    if (reveal) out += `<tr><th scope="row">จำนวน address / host</th><td>${p === 32 ? '1 address' : p === 31 ? '2 (RFC 3021)' : fmt(pow2(h)) + ' / ' + fmt(pow2(h) - 2)}</td></tr>`;
    out += '</tbody></table>';
    const io = Math.min(3, Math.floor(p / 8)), mo = oct(mask, io);
    let note = '';
    if (p === 32) note = '/32: มี address เดียว (h = 0) Network = Broadcast = IP เดียวกัน ใช้กับ loopback / Router ID / host route';
    else if (p === 31) note = '/31 (RFC 3021): ลิงก์ point-to-point ใช้ได้ทั้ง 2 address ไม่มี network/broadcast — สูตร 2^h − 2 ใช้ไม่ได้';
    else note = `h = 32 − ${p} = ${h} บิต → host ที่ใช้ได้ 2^${h} − 2 = ${fmt(pow2(h) - 2)} · octet ที่สนใจ: octet ${io + 1} (mask = ${mo}) → block size 256 − ${mo} = ${256 - mo}`;
    out += `<p class="nls-subnet-vnote">${note}</p>`;
    if (!reveal) out += '<p class="nls-subnet-legend">ลองทำ AND เอง: บิตไหน mask เป็น 1 ให้คงบิตของ IP ไว้ บิตไหน mask เป็น 0 ให้เป็น 0 แล้วกดปุ่มด้านบนเพื่อเทียบ</p>';
    return out;
  }

  // ------------------------------------------------------------------------------------------
  // 2.6: step-by-step teaching mode ("สอนทีละขั้น") — checked locally, never sent for grading
  function teachSteps(ip, p, pre) {
    const mask = maskInt(p), h = 32 - p, io = Math.min(3, Math.floor(p / 8)), mo = oct(mask, io), B = 256 - mo, v = oct(ip, io);
    const net = netOf(ip, p), bc = net + pow2(h) - 1;
    const steps = [];
    const ipCheck = (got, exp, what) => {
      const g = ipToInt(got); if (g === null) return 'รูปแบบไม่ถูกต้อง: ใส่เลข 4 ชุด (0–255) คั่นด้วยจุด เช่น 192.168.1.64';
      const msgs = [];
      for (let i = 0; i < 4; i++) {
        if (oct(g, i) === oct(exp, i)) continue;
        if (what === 'first' || what === 'last') { msgs.push(what === 'first' ? 'Host แรก = Network + 1 (บวกที่ octet สุดท้าย)' : 'Host สุดท้าย = Broadcast − 1 (ลบที่ octet สุดท้าย)'); break; }
        if (i < io) msgs.push(`octet ที่ ${i + 1} อยู่ทางซ้ายของ octet ที่สนใจ ต้องคงเดิมเหมือน IP (${oct(ip, i)})`);
        else if (i === io) msgs.push(what === 'net' ? `octet ที่ ${i + 1}: ปัด ${v} ลงเป็นพหุคูณของ ${B} (⌊${v} ÷ ${B}⌋ × ${B})` : `octet ที่ ${i + 1}: ค่าของ network ใน octet นี้ + ${B} − 1`);
        else msgs.push(`octet ที่ ${i + 1} อยู่ทางขวาของ octet ที่สนใจ ต้องเป็น ${what === 'net' ? '0' : '255'}`);
      }
      return msgs.length ? Array.from(new Set(msgs)).join(' · ') : '';
    };
    if (pre && pre.kind === 'class') {
      const c = classOf(ip);
      steps.push({ title: 'หา prefix จาก Class', prompt: `octet แรกของ IP = <b>${oct(ip, 0)}</b> → เป็น Class อะไร และ default prefix คือเท่าไร`,
        inputs: [{ k: 'p0', label: 'Default prefix', ph: 'เช่น 24 หรือ /24', mode: 'numeric' }],
        check: (x) => parseMaskOrPrefix(x.p0) === p ? '' : 'ดู octet แรก: 1–126 = Class A → /8, 128–191 = Class B → /16, 192–223 = Class C → /24',
        answer: () => ({ p0: '/' + p }), explain: `octet แรก ${oct(ip, 0)} → Class ${c} → default mask /${p} (${ipStr(mask)})` });
    } else if (pre && pre.kind === 'mask') {
      const cnt = octs(mask).map((o) => bin8(o).split('').filter((ch) => ch === '1').length);
      steps.push({ title: 'แปลง Subnet mask เป็น prefix', prompt: `นับบิต 1 ใน mask <b class="nls-subnet-mono">${ipStr(mask)}</b> ทีละ octet แล้วรวมกัน`,
        inputs: [{ k: 'p0', label: 'Prefix', ph: 'เช่น 26 หรือ /26', mode: 'numeric' }],
        check: (x) => { const g = parseMaskOrPrefix(x.p0); return g === p ? '' : g !== null && /\./.test(x.p0 || '') ? 'ใส่เป็นตัวเลข prefix เช่น /26 ไม่ใช่ mask' : 'นับทีละ octet: 255 = 8, 254 = 7, 252 = 6, 248 = 5, 240 = 4, 224 = 3, 192 = 2, 128 = 1, 0 = 0 แล้วบวกกัน'; },
        answer: () => ({ p0: '/' + p }), explain: `${cnt.join(' + ')} = /${p}` });
    }
    steps.push({ title: 'เขียน Subnet mask เป็นเลขฐานสอง', prompt: `/${p} = บิต 1 จำนวน ${p} ตัวเรียงจากซ้าย ตามด้วยบิต 0 จำนวน ${h} ตัว (รวม 32 บิต คั่นทุก 8 บิตด้วยจุดหรือเว้นวรรคได้)`,
      inputs: [{ k: 'mbin', label: 'Mask ฐานสอง 32 บิต', ph: '11111111.11111111.11111111.00000000', mode: 'decimal', wide: true }],
      check: (x) => {
        const s = String(x.mbin || '').replace(/[\s.]/g, '');
        if (!/^[01]+$/.test(s)) return 'ใช้เฉพาะเลข 0 และ 1 (คั่นด้วยจุดหรือเว้นวรรคได้)';
        if (s.length !== 32) return `ต้องมี 32 บิตพอดี (ตอนนี้ ${s.length} บิต)`;
        const ones = s.split('').filter((ch) => ch === '1').length;
        if (ones !== p) return `ต้องมีบิต 1 ทั้งหมด ${p} บิตตาม prefix (ตอนนี้ ${ones} บิต)`;
        if (s !== '1'.repeat(p) + '0'.repeat(h)) return 'บิต 1 ต้องเรียงติดกันจากซ้ายสุด แล้วตามด้วยบิต 0 ทั้งหมด (subnet mask ไม่มี 0 แทรกระหว่าง 1)';
        return '';
      },
      answer: () => ({ mbin: octs(mask).map(bin8).join('.') }), explain: `${octs(mask).map(bin8).join('.')} = <b class="nls-subnet-mono">${ipStr(mask)}</b>` });
    steps.push({ title: 'หา octet ที่สนใจ และ Block size', prompt: 'octet ที่สนใจ = octet ที่บิต 1 กับ 0 ของ mask มาเจอกัน (ถ้า prefix ลงตัวที่ 8 พอดี ให้ใช้ octet ถัดไปที่ mask = 0) แล้ว block size = 256 − ค่า mask ใน octet นั้น',
      inputs: [{ k: 'oi', label: 'octet ที่ (1–4)', ph: '1–4', mode: 'numeric' }, { k: 'bs', label: 'Block size', ph: 'ตัวเลข', mode: 'numeric' }],
      check: (x) => {
        const m = []; const oi = Number(String(x.oi || '').replace(/\D/g, '')), bs = Number(String(x.bs || '').replace(/[\s,]/g, ''));
        if (oi !== io + 1) m.push(`octet ที่สนใจผิด: /${p} → ${p} ÷ 8 = ${Math.floor(p / 8)} octet เต็ม เหลือ ${p % 8} บิต → รอยต่ออยู่ใน octet ที่ ${Math.floor(p / 8)} + 1`);
        if (bs !== B) m.push(oi === io + 1 ? `block size = 256 − (ค่า mask ใน octet ที่ ${io + 1})` : 'block size = 256 − ค่า mask ใน octet ที่สนใจ');
        return m.join(' · ');
      },
      answer: () => ({ oi: String(io + 1), bs: String(B) }), explain: `octet ที่ ${io + 1}: mask = ${mo} (${bin8(mo)}) → block size = 256 − ${mo} = <b>${B}</b>` });
    steps.push({ title: 'หา Network address', prompt: `IP = <b class="nls-subnet-mono">${ipStr(ip)}</b>: ปัด octet ที่สนใจลงเป็นพหุคูณของ block size, octet ทางซ้ายคงเดิม, octet ทางขวาเป็น 0`,
      inputs: [{ k: 'net', label: 'Network address', ph: 'x.x.x.x', mode: 'decimal' }],
      check: (x) => ipCheck(x.net, net, 'net'), answer: () => ({ net: ipStr(net) }),
      explain: `⌊${v} ÷ ${B}⌋ × ${B} = ${oct(net, io)} → <b class="nls-subnet-mono">${ipStr(net)}</b> (เหมือน IP AND Mask)` });
    steps.push({ title: 'หา Broadcast address', prompt: 'Broadcast = network ถัดไป − 1: octet ที่สนใจ = ค่าของ network + block size − 1, octet ทางขวาเป็น 255',
      inputs: [{ k: 'bc', label: 'Broadcast address', ph: 'x.x.x.x', mode: 'decimal' }],
      check: (x) => ipCheck(x.bc, bc, 'bc'), answer: () => ({ bc: ipStr(bc) }),
      explain: `${oct(net, io)} + ${B} − 1 = ${oct(bc, io)} → <b class="nls-subnet-mono">${ipStr(bc)}</b> (เหมือน IP OR Wildcard)` });
    steps.push({ title: 'หา Host แรก และ Host สุดท้าย', prompt: 'Host แรก = Network + 1, Host สุดท้าย = Broadcast − 1',
      inputs: [{ k: 'first', label: 'Host แรก', ph: 'x.x.x.x', mode: 'decimal' }, { k: 'last', label: 'Host สุดท้าย', ph: 'x.x.x.x', mode: 'decimal' }],
      check: (x) => [ipCheck(x.first, net + 1, 'first'), ipCheck(x.last, bc - 1, 'last')].filter(Boolean).join(' · '),
      answer: () => ({ first: ipStr(net + 1), last: ipStr(bc - 1) }), explain: `<b class="nls-subnet-mono">${ipStr(net + 1)}</b> ถึง <b class="nls-subnet-mono">${ipStr(bc - 1)}</b>` });
    steps.push({ title: 'นับจำนวน Host ที่ใช้ได้', prompt: `h = 32 − ${p} = จำนวนบิต host แล้วใช้สูตร 2^h − 2`,
      inputs: [{ k: 'hosts', label: 'จำนวน host', ph: 'ตัวเลข', mode: 'numeric' }],
      check: (x) => {
        const g = Number(String(x.hosts || '').replace(/[\s,]/g, ''));
        if (!/^\d+$/.test(String(x.hosts || '').replace(/[\s,]/g, ''))) return 'ใส่เป็นตัวเลข';
        if (g === pow2(h) - 2) return '';
        if (g === pow2(h)) return 'เกือบแล้ว! อย่าลืมลบ 2 (network address และ broadcast address ใช้กับเครื่องไม่ได้)';
        return `h = 32 − ${p} = ${h} → ลองคำนวณ 2^${h} − 2 อีกครั้ง`;
      },
      answer: () => ({ hosts: String(pow2(h) - 2) }),
      explain: `2^${h} − 2 = ${fmt(pow2(h))} − 2 = <b>${fmt(pow2(h) - 2)}</b><br>ข้อยกเว้น: <b>/31</b> (RFC 3021) ใช้กับลิงก์ point-to-point ได้ทั้ง 2 address เพราะไม่ต้องมี network/broadcast · <b>/32</b> มี address เดียว (2^0 = 1) ใช้กับ loopback / host route` });
    return steps;
  }
  function teachContext(pr) {
    if (!pr) return null;
    if (pr.kind === 'host') {
      const ip = ipToInt(pr.ip); if (ip === null) return null;
      if (pr.mission === 's1') return { ip, p: { A: 8, B: 16, C: 24 }[classOf(ip)] || 24, pre: { kind: 'class' } };
      if (pr.mask) { const p = prefixFromMask(ipToInt(pr.mask)); return p === null ? null : { ip, p, pre: { kind: 'mask' } }; }
      return { ip, p: pr.prefix, pre: null };
    }
    if (pr.kind === 'same') return { ip: ipToInt(pr.ipA), p: pr.prefix, pre: null, note: 'ใช้ IP A เป็นตัวอย่าง (ทำแบบเดียวกันกับ IP B)' };
    if (pr.kind === 'special') return { ip: ipToInt(pr.ip30), p: 30, pre: null, note: 'ฝึกกับลิงก์ R2–R3 (/30)' };
    return null;
  }
  // 6.x: before the live problem is graded, the visualiser and the teaching mode work on a separate practice example
  // generated here (different IP/prefix), so they can never show the graded answer of the live problem
  function exampleFor(pr) {
    if (!pr) return null;
    const R = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
    const rip = () => { const t = R(0, 2); return t === 0 ? [10, R(0, 255), R(0, 255), R(1, 254)] : t === 1 ? [172, R(16, 31), R(0, 255), R(1, 254)] : [192, 168, R(0, 255), R(1, 254)]; };
    const toInt = (a) => ipToInt(a.join('.'));
    const near = (p0) => { const band = Math.floor((Math.max(9, Math.min(30, Number(p0) || 24)) - 1) / 8); let p; let n = 0; do { p = Math.min(30, Math.max(8, band * 8 + R(1, 8))); } while (p === p0 && ++n < 20); return p; };
    const hostIn = (net, p) => { const size = pow2(32 - p); return (net + (size > 2 ? R(1, size - 2) : 0)) >>> 0; };
    for (let tries = 0; tries < 30; tries++) {
      let ex = null;
      if (pr.kind === 'host' && pr.mission === 's1') {
        const live = ipToInt(pr.ip); const cls = ['A', 'B', 'C'].filter((c) => c !== classOf(live))[R(0, 1)];
        const o1 = cls === 'A' ? [R(1, 126), 10][R(0, 1)] : cls === 'B' ? [R(128, 191), 172][R(0, 1)] : [R(192, 223), 192][R(0, 1)];
        ex = { kind: 'host', mission: 's1', ip: [o1, R(0, 255), R(0, 255), R(1, 254)].join('.') };
      } else if (pr.kind === 'host' && pr.mask) {
        const lp = prefixFromMask(ipToInt(pr.mask)); const p = near(lp);
        ex = { kind: 'host', mission: pr.mission, ip: rip().join('.'), mask: ipStr(maskInt(p)) };
      } else if (pr.kind === 'host') ex = { kind: 'host', mission: pr.mission, ip: rip().join('.'), prefix: near(pr.prefix) };
      else if (pr.kind === 'same') {
        const p = near(pr.prefix), a = toInt(rip()); const b = R(0, 1) ? hostIn(netOf(a, p), p) : toInt(rip());
        ex = { kind: 'same', mission: pr.mission, ipA: ipStr(a), ipB: ipStr(b), prefix: p };
      } else if (pr.kind === 'count' || pr.kind === 'vlsm') {
        const p = Math.min(29, near(pr.prefix)); ex = { kind: pr.kind, mission: pr.mission, block: ipStr(netOf(toInt(rip()), p)), prefix: p };
      } else if (pr.kind === 'special') {
        const n30 = netOf(toInt(rip()), 30), n31 = netOf(toInt(rip()), 31);
        ex = { kind: 'special', mission: pr.mission, variant: pr.variant, ip30: ipStr(n30 + R(1, 2)), ip31: ipStr(n31 + R(0, 1)) };
      }
      if (!ex) return null;
      const same = ['ip', 'ipA', 'ipB', 'block', 'ip30', 'ip31'].some((k) => ex[k] && pr[k] && ex[k] === pr[k]) || (ex.prefix != null && ex.prefix === pr.prefix && pr.kind !== 'host');
      if (!same) return ex;
    }
    return null;
  }
  function exampleLabel(ex) {
    if (!ex) return '';
    const v = ex.kind === 'host' ? ex.ip + (ex.mask ? ' mask ' + ex.mask : ex.prefix != null ? '/' + ex.prefix : ' (หา prefix จาก Class)')
      : ex.kind === 'same' ? 'IP A ' + ex.ipA + '/' + ex.prefix + ', IP B ' + ex.ipB + '/' + ex.prefix
      : ex.kind === 'special' ? 'R2 ' + ex.ip30 + '/30, R3 ' + ex.ip31 + '/31' : 'Block ' + ex.block + '/' + ex.prefix;
    return `<div class="nls-subnet-ex" role="note"><span><b>ตัวอย่างฝึก (ไม่ใช่โจทย์ที่ส่งตรวจ)</b>: <span class="nls-subnet-mono">${esc(v)}</span></span>` +
      '<button type="button" class="nls-subnet-btn ghost" data-act="exnew">ตัวอย่างใหม่</button></div>';
  }
  function teachHtml(steps, t, note) {
    let h = (note ? `<p class="nls-subnet-desc">${esc(note)}</p>` : '') + '<p class="nls-subnet-desc">พิมพ์ค่าของแต่ละขั้นแล้วกด <b>ตรวจขั้นนี้</b> (ตรวจทันทีในเครื่อง ไม่นับคะแนน) ผ่านแล้วจะเปิดขั้นถัดไป ก่อนส่งตรวจ ขั้นเหล่านี้ใช้ตัวอย่างฝึก ให้ทำวิธีเดียวกันกับโจทย์จริงแล้วกรอกในช่องคำตอบด้านล่าง</p><ol class="nls-subnet-tlist">';
    steps.forEach((s, i) => {
      const st = t.st[i]; const cur = i === t.step; const lock = i > t.step;
      const cls = st === 'ok' ? 'ok' : st === 'shown' ? 'shown' : cur ? 'cur' : 'lock';
      h += `<li class="nls-subnet-ts ${cls}" data-ti="${i}"><h4>ขั้นที่ ${i + 1}: ${s.title}${st === 'ok' ? '<span class="st">✔ ถูก</span>' : st === 'shown' ? '<span class="st">ดูเฉลยแล้ว</span>' : lock ? '<span class="st">(ล็อก — ทำขั้นก่อนหน้าให้ผ่านก่อน)</span>' : ''}</h4>`;
      if (!lock) {
        h += `<p>${s.prompt}</p><div class="nls-subnet-tin${s.inputs.some((x) => x.wide) ? ' wide' : ''}">` + s.inputs.map((x) => {
          const id = 'nls-subnet-t-' + i + '-' + x.k + '-' + Math.random().toString(36).slice(2, 7);
          return `<label class="nls-subnet-f" for="${id}"><span>${esc(x.label)}</span><input id="${id}" data-tk="${x.k}" data-ti="${i}" type="text" inputmode="${x.mode}" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" maxlength="48" enterkeyhint="done" placeholder="${esc(x.ph)}" value="${esc(t.vals[x.k] || '')}"${st ? ' disabled' : ''}></label>`;
        }).join('') + '</div>';
        if (cur) h += `<div class="nls-subnet-row"><button type="button" class="nls-subnet-btn go" data-act="tcheck" data-ti="${i}">ตรวจขั้นนี้</button>` +
          (t.wrong[i] ? `<button type="button" class="nls-subnet-btn ghost" data-act="tshow" data-ti="${i}">ดูเฉลยขั้นนี้</button>` : '') + '</div>';
        const fb = t.fb[i];
        h += `<p class="nls-subnet-tfb ${fb ? fb.cls : ''}" role="status" aria-live="polite">${fb ? fb.html : ''}</p>`;
      }
      h += '</li>';
    });
    h += '</ol>';
    if (t.step >= steps.length) h += '<p class="nls-subnet-tfb good" role="status">ครบทุกขั้นแล้ว! ใช้วิธีเดียวกันกับโจทย์จริง แล้วกรอกในช่องคำตอบด้านล่าง กด <b>ตรวจคำตอบ</b> (ตรวจที่เซิร์ฟเวอร์และนับคะแนน)</p>';
    h += '<div class="nls-subnet-row" style="margin-top:8px"><button type="button" class="nls-subnet-btn ghost" data-act="treset">เริ่มสอนใหม่</button></div>';
    return h;
  }

  // phone keyboards: dotted values (IP / mask, which also accepts a bare prefix number) -> decimal keypad with ".";
  // counts and prefix numbers ("/" is optional everywhere) -> digit keypad
  const INPUTMODE = { ip: 'decimal', mask: 'decimal', num: 'numeric', prefix: 'numeric' };
  const INPUT_ATTRS = 'type="text" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false"';
  function fieldHtml(f) {
    const id = 'nls-subnet-f-' + Math.random().toString(36).slice(2, 9);
    let ctl;
    if (f.type === 'yesno') ctl = `<select id="${id}" data-key="${esc(f.key)}"><option value="">— เลือก —</option><option value="ใช่">ใช่ (วงเดียวกัน)</option><option value="ไม่ใช่">ไม่ใช่ (คนละวง)</option></select>`;
    else if (f.type === 'cls') ctl = `<select id="${id}" data-key="${esc(f.key)}"><option value="">— เลือก —</option><option>A</option><option>B</option><option>C</option></select>`;
    else ctl = `<input id="${id}" data-key="${esc(f.key)}" data-type="${esc(f.type || '')}" ${INPUT_ATTRS} maxlength="40" inputmode="${INPUTMODE[f.type] || 'text'}" enterkeyhint="${f.last ? 'done' : 'next'}" placeholder="${esc(f.type === 'prefix' ? 'n เช่น 26' : f.type === 'mask' && /\/n/.test(f.ph || '') ? (f.ph || '').replace('/n', 'n') : (f.ph || ''))}">`;
    return `<label class="nls-subnet-f" for="${id}" data-field="${esc(f.key)}"><span>${esc(f.label)} <em class="nls-subnet-mark" aria-live="polite"></em></span>${ctl}</label>`;
  }
  function fieldsHtml(pr) {
    const fs0 = Array.isArray(pr.fields) ? pr.fields : [];
    const fs = fs0.map((f, i) => Object.assign({}, f, { last: i === fs0.length - 1 }));
    if (pr.kind === 'vlsm') {
      return '<div class="nls-subnet-vlist">' + pr.reqs.map((r, i) => `<div class="nls-subnet-vrow"><h4>${esc(r.name)} — ${fmt(r.hosts)} hosts</h4><div class="nls-subnet-fields">` +
        fs.filter((f) => f.row === i).map((f) => fieldHtml(Object.assign({}, f, { label: /^net/.test(f.key) ? 'Network address' : 'Prefix (/n หรือ mask)' }))).join('') + '</div></div>').join('') + '</div>';
    }
    return '<div class="nls-subnet-fields">' + fs.map(fieldHtml).join('') + '</div>';
  }

  // ------------------------------------------------------------------------------------------
  window.NL_SIMS = window.NL_SIMS || {};
  window.NL_SIMS['subnet'] = {
    title: 'จำลองการคำนวณ Subnet',
    mount(root, ctx) {
      ctx = ctx || {};
      if (!document.getElementById('nls-subnet-css')) {
        const st = document.createElement('style'); st.id = 'nls-subnet-css'; st.textContent = CSS; document.head.appendChild(st);
      }
      const missions = Array.isArray(ctx.missions) ? ctx.missions : [];
      const done = Object.assign({}, ctx.done || {});
      const state = { tab: 'practice', cur: missions[0] ? missions[0].id : null, work: {}, calcMode: 'ip', bits: 0, alive: true };
      const toast = (t) => { try { if (typeof ctx.toast === 'function') ctx.toast(t); } catch (e) { /* ignore */ } };
      const mq = (q) => { try { return !!(window.matchMedia && window.matchMedia(q).matches); } catch (e) { return false; } };
      const narrow = () => mq('(max-width:600px)');
      const coarse = () => mq('(pointer:coarse)');
      const timers = new Set();
      const later = (fn, ms) => { const id = setTimeout(() => { timers.delete(id); if (state.alive) fn(); }, ms); timers.add(id); return id; };

      const el = document.createElement('div');
      el.className = 'nls-subnet';
      el.innerHTML = `
<div class="nls-subnet-head"><h2>จำลองการคำนวณ Subnet</h2>
  <div class="nls-subnet-tabs" role="tablist" aria-label="โหมด">
    <button type="button" class="nls-subnet-tab" role="tab" data-tab="practice" aria-selected="true">ฝึกทำโจทย์</button>
    <button type="button" class="nls-subnet-tab" role="tab" data-tab="calc" aria-selected="false">เครื่องคิดเลขช่วยคิด</button>
  </div></div>
<details class="nls-subnet-box nls-subnet-help"><summary>คำแนะนำการใช้งาน</summary><ol>
  <li>เลือกภารกิจทางซ้าย (มือถือ: เลื่อนแถบภารกิจไปทางขวา) แล้วกด <b>โจทย์ใหม่</b></li>
  <li>กรอกคำตอบทุกช่อง: IP เขียนแบบ 192.168.1.64, mask ตอบได้ทั้ง 255.255.255.192 หรือ /26, จำนวน host ใส่ตัวเลขอย่างเดียว (เว้นวรรคได้)</li>
  <li>กด <b>ตรวจคำตอบ</b> (หรือกด Enter) ระบบให้คะแนนทีละช่อง เต็ม 10 แล้วแสดง <b>วิธีทำทีละขั้น</b></li>
  <li>ติดตรงไหนกด <b>คำใบ้</b> หรือใช้ <b>ตัวช่วยเลขฐานสอง</b> ด้านล่าง (คลิกบิตเพื่อเปิด/ปิด)</li>
  <li><b>ภาพ IP และ Mask แบบ 32 บิต</b>: เลื่อนแถบ prefix หรือกด − / + เพื่อดูว่าบิตไหนเป็น network (ทึบ, N) บิตไหนเป็น host (ลายเส้น, H) และผล AND → network, OR → broadcast</li>
  <li><b>สอนทีละขั้น</b>: พิมพ์ค่าทีละขั้น (mask ฐานสอง → block size → network → broadcast → host แรก/สุดท้าย → จำนวน host) ระบบบอกทันทีว่าถูกหรือผิด</li>
  <li>แท็บ <b>เครื่องคิดเลขช่วยคิด</b> ใช้ทดลองคำนวณ IP/prefix หรือ VLSM ได้อิสระ (ไม่นับคะแนน)</li></ol></details>
<div class="nls-subnet-grid">
<aside class="nls-subnet-side">
  <nav aria-label="รายการภารกิจ" data-pane="practice" class="nls-subnet-nav"><ul class="nls-subnet-missions" data-el="mlist"></ul></nav>
  <section class="nls-subnet-box nls-subnet-bin" aria-label="ตัวช่วยเลขฐานสอง">
  <h3>ตัวช่วยเลขฐานสอง (แตะ/คลิกบิตเพื่อเปิด/ปิด)</h3>
  <div class="nls-subnet-binrow" data-el="bits"></div>
  <div class="nls-subnet-binout"><label>ฐานสิบ <input data-el="bdec" type="text" inputmode="numeric" enterkeyhint="done" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" maxlength="3" value="0" aria-label="ค่าฐานสิบ 0 ถึง 255"></label>
    <span data-el="bsum" class="nls-subnet-mono"></span>
    <button type="button" class="nls-subnet-btn ghost" data-act="bclear">ล้าง</button></div>
</section>
</aside>
<div class="nls-subnet-main">
<section class="nls-subnet-box" data-pane="practice" data-el="work" aria-live="off"></section>
<div data-pane="calc" class="nls-subnet-hide"><section class="nls-subnet-box">
  <div class="nls-subnet-sub" role="group" aria-label="ชนิดการคำนวณ">
    <button type="button" class="nls-subnet-btn ghost" data-calcmode="ip" aria-pressed="true">IP / prefix</button>
    <button type="button" class="nls-subnet-btn ghost" data-calcmode="vlsm" aria-pressed="false">VLSM</button>
  </div>
  <div data-calc="ip"><div class="nls-subnet-calcin">
    <label class="nls-subnet-f"><span>IP Address (พิมพ์ 192.168.1.77/26 ได้)</span><input data-el="cip" type="text" inputmode="decimal" enterkeyhint="next" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" value="192.168.10.77/26"></label>
    <label class="nls-subnet-f"><span>Prefix หรือ Subnet mask</span><input data-el="cmask" type="text" inputmode="decimal" enterkeyhint="done" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="26 หรือ 255.255.255.192"></label>
  </div>
  <details class="nls-subnet-fold" data-el="cvizd" open><summary>ภาพ IP และ Mask แบบ 32 บิต <small>(AND / OR)</small></summary><div class="nls-subnet-foldb">${vizShell('calc', [], 0, false, true)}</div></details></div>
  <div data-calc="vlsm" class="nls-subnet-hide"><div class="nls-subnet-calcin">
    <div class="nls-subnet-calcblk"><label class="nls-subnet-f"><span>Block (network)</span><input data-el="vblk" type="text" inputmode="decimal" enterkeyhint="next" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" value="192.168.1.0"></label>
    <label class="nls-subnet-f"><span>Prefix</span><input data-el="vpre" type="text" inputmode="numeric" enterkeyhint="next" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" maxlength="3" value="24" placeholder="24"></label></div>
    <label class="nls-subnet-f"><span>จำนวน host แต่ละห้อง (คั่นด้วย , หรือ . หรือเว้นวรรค)</span><input data-el="vreq" type="text" inputmode="decimal" enterkeyhint="done" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" value="60, 28, 12, 2"></label>
  </div></div>
  <div data-el="cout" aria-live="polite"></div>
</section></div>
</div></div>`;
      root.appendChild(el);
      const $ = (sel) => el.querySelector(sel);

      // ---------------- missions
      function statusText(id) {
        const d = done[id]; const m = missions.find((x) => x.id === id);
        if (!d || !d.attempts && d.best == null) return { t: 'ยังไม่ทำ', full: false };
        const max = d.max || (m && m.max) || 10;
        return { t: `คะแนนดีที่สุด ${d.best || 0}/${max}`, full: (d.best || 0) >= max };
      }
      const LV = { easy: 'ง่าย', medium: 'ปานกลาง', hard: 'ยาก' };
      function renderMissions() {
        $('[data-el="mlist"]').innerHTML = missions.map((m) => {
          const st = statusText(m.id);
          return `<li><button type="button" class="nls-subnet-mbtn" data-mission="${esc(m.id)}" data-level="${esc(m.level)}" aria-current="${m.id === state.cur}">` +
            `<b><span class="nls-subnet-lv ${esc(m.level)}">${LV[m.level] || esc(m.level)}</span>${esc(m.title)}</b><span class="nls-subnet-mstat${st.full ? ' full' : ''}">${esc(st.t)}</span></button></li>`;
        }).join('') || '<li class="nls-subnet-empty">ไม่มีภารกิจ</li>';
      }
      const W = (id) => state.work[id] || (state.work[id] = { problem: null, token: null, hints: 0, result: null, answers: {}, busy: false, err: '',
        viz: { src: 0, p: null, reveal: false }, teach: null, ex: null, ui: { viz: !narrow(), teach: false } });
      // the problem the visualiser and teaching mode use: a practice example until the live problem is graded
      const helpPr = (w) => { if (!w.problem) return null; if (w.result) return w.problem; if (!w.ex) w.ex = exampleFor(w.problem); return w.ex; };

      function renderWork() {
        const box = $('[data-el="work"]');
        const m = missions.find((x) => x.id === state.cur);
        if (!m) { box.innerHTML = '<p class="nls-subnet-empty">เลือกภารกิจ</p>'; return; }
        const w = W(m.id); const hints = Array.isArray(m.hints) ? m.hints : [];
        let h = `<h3 class="nls-subnet-mtitle"><span class="nls-subnet-lv ${esc(m.level)}">${LV[m.level] || ''}</span>${esc(m.title)}</h3><p class="nls-subnet-desc">${esc(m.desc)}</p>`;
        h += '<div class="nls-subnet-row">' +
          `<button type="button" class="nls-subnet-btn${w.problem ? ' ghost' : ' go'}" data-act="new"${w.busy ? ' disabled' : ''}>โจทย์ใหม่</button>` +
          (hints.length ? `<button type="button" class="nls-subnet-btn ghost" data-act="hint"${w.hints >= hints.length ? ' disabled' : ''}>คำใบ้ (${w.hints}/${hints.length})</button>` : '') + '</div>';
        if (w.hints) h += '<ol class="nls-subnet-hints">' + hints.slice(0, w.hints).map((t) => `<li>${esc(t)}</li>`).join('') + '</ol>';
        if (w.err) h += `<p class="nls-subnet-msg err" role="alert">${esc(w.err)}</p>`;
        if (!w.problem) {
          h += '<p class="nls-subnet-empty">กด <b>โจทย์ใหม่</b> เพื่อรับโจทย์ (แต่ละครั้งได้ตัวเลขไม่ซ้ำกัน)</p>';
        } else {
          const locked = !!w.result;
          h += `<div class="nls-subnet-q">${statementFor(w.problem)}</div>`;
          const hp = helpPr(w); const exTag = w.result ? '' : exampleLabel(hp);
          const srcs = vizSources(hp, !!w.result);
          if (srcs.length) {
            h += `<details class="nls-subnet-fold" data-fold="viz"${w.ui.viz ? ' open' : ''}><summary>ภาพ IP และ Mask แบบ 32 บิต <small>(AND / OR${w.result ? '' : ' · ตัวอย่างฝึก'})</small></summary><div class="nls-subnet-foldb">` + exTag +
              vizShell('work', srcs, Math.min(w.viz.src, srcs.length - 1), !w.result, !!w.result || w.viz.reveal) + '</div></details>';
          }
          if (teachContext(hp)) h += `<details class="nls-subnet-fold" data-fold="teach"${w.ui.teach ? ' open' : ''}><summary>สอนทีละขั้น <small>(${w.result ? 'โจทย์ที่ตรวจแล้ว' : 'ตัวอย่างฝึก'} · ตรวจทันที ไม่นับคะแนน)</small></summary><div class="nls-subnet-foldb">${exTag}<div data-el="teach"></div></div></details>`;
          h += `<form data-el="form" novalidate><p class="nls-subnet-desc" style="margin:12px 0 0"><b>ช่องคำตอบ</b> (ส่งตรวจที่เซิร์ฟเวอร์)</p>${fieldsHtml(w.problem)}` +
            `<div class="nls-subnet-row nls-subnet-submitrow"><button type="submit" class="nls-subnet-btn go"${locked || w.busy ? ' disabled' : ''}>${w.busy ? 'กำลังตรวจ…' : 'ตรวจคำตอบ'}</button>` +
            (locked ? '' : '<button type="button" class="nls-subnet-btn ghost" data-act="clear">ล้างคำตอบ</button>') + '</div></form>';
          if (w.result) {
            const r = w.result; const cls = r.score >= r.max ? 'full' : r.score > 0 ? 'part' : 'zero';
            h += `<div class="nls-subnet-result ${cls}" role="status"><p class="nls-subnet-score">คะแนน ${esc(r.score)}/${esc(r.max)}</p>` +
              (r.practice ? `<p class="nls-subnet-msg warn" role="alert">${esc(r.message || 'โจทย์นี้ส่งไปแล้ว ผลครั้งนี้เป็นการฝึก ไม่นับคะแนน')}</p>` : '') +
              '<ul>' + (r.feedback || []).map((t) => `<li>${esc(t)}</li>`).join('') + '</ul>' + (w.problem.mission === 's9' ? vlsmCheckTable(r) : '') +
              (r.saved === false && !ctx.user ? '<p class="nls-subnet-legend">โหมดผู้เยี่ยมชม: ตรวจได้แต่ไม่บันทึกคะแนน</p>' : '') +
              '<div class="nls-subnet-row" style="margin-top:8px"><button type="button" class="nls-subnet-btn go" data-act="new">ทำโจทย์ใหม่</button></div></div>';
            h += `<details class="nls-subnet-sol" open><summary>วิธีทำทีละขั้น</summary><div class="nls-subnet-stepbar"><button type="button" class="nls-subnet-btn ghost" data-act="stepsall" data-open="1">เปิดทุกขั้น</button><button type="button" class="nls-subnet-btn ghost" data-act="stepsall" data-open="0">ปิดทุกขั้น</button></div>${solutionFor(w.problem)}</details>`;
          }
        }
        box.innerHTML = h;
        updateViz('work'); renderTeach();
        // phones: start the step accordion with only the first step open (desktop keeps every step open as before)
        if (narrow()) box.querySelectorAll('.nls-subnet-sol .nls-subnet-stepd').forEach((d, i) => { d.open = i === 0; });
        // restore answers and marks
        box.querySelectorAll('[data-key]').forEach((inp) => {
          const k = inp.getAttribute('data-key');
          if (w.answers[k] != null) inp.value = w.answers[k];
          if (w.result) {
            inp.disabled = true;
            const f = w.result.details && w.result.details.fields;
            if (f && k in f) {
              const lab = inp.closest('.nls-subnet-f'); lab.classList.add(f[k] ? 'ok' : 'bad');
              lab.querySelector('.nls-subnet-mark').textContent = f[k] ? '✔ ถูก' : '✘ ผิด';
            }
          }
        });
      }

      async function newProblem() {
        const id = state.cur; const w = W(id);
        if (w.busy) return;
        if (typeof ctx.newProblem !== 'function') { w.err = 'ไม่สามารถขอโจทย์ได้ในขณะนี้'; renderWork(); return; }
        w.busy = true; w.err = ''; renderWork();
        try {
          const res = await ctx.newProblem(id);
          if (!state.alive) return;
          if (!res || !res.problem) throw new Error('ไม่ได้รับโจทย์');
          Object.assign(w, { problem: res.problem, token: res.token, result: null, answers: {}, viz: { src: 0, p: null, reveal: false }, teach: null, ex: null });
        } catch (e) { w.err = 'ขอโจทย์ไม่สำเร็จ: ' + ((e && e.message) || 'ลองใหม่อีกครั้ง'); }
        w.busy = false;
        if (!state.alive) return;
        renderWork();
        if (state.cur === id) { const first = $('[data-el="work"] [data-key]'); if (first && w.problem && !w.err) first.focus({ preventScroll: true }); }
      }

      async function submit() {
        const id = state.cur; const w = W(id);
        if (!w.problem || w.busy || w.result) return;
        if (typeof ctx.submit !== 'function') { w.err = 'ส่งคำตอบไม่ได้ในขณะนี้'; renderWork(); return; }
        const answers = {};
        $('[data-el="work"]').querySelectorAll('[data-key]').forEach((inp) => { answers[inp.getAttribute('data-key')] = inp.value.trim(); });
        w.answers = answers;
        if (Object.values(answers).every((v) => v === '')) { w.err = 'กรอกคำตอบอย่างน้อย 1 ช่องก่อนกดตรวจ'; renderWork(); return; }
        w.busy = true; w.err = ''; renderWork();
        try {
          const r = await ctx.submit(id, { answers }, { problem: w.problem, token: w.token });
          if (!state.alive) return;
          w.result = r || { score: 0, max: 10, feedback: ['ไม่ได้รับผลการตรวจ'] };
          w.viz = { src: 0, p: null, reveal: false }; w.teach = null; // the helpers now switch from the practice example to the graded problem
          const d = done[id] || { best: 0, max: w.result.max, attempts: 0 };
          done[id] = { best: w.result.practice ? (d.best || 0) : Math.max(d.best || 0, Number(w.result.score) || 0), max: w.result.max || d.max, attempts: (d.attempts || 0) + 1 };
          toast(w.result.practice ? (w.result.message || 'ผลครั้งนี้เป็นการฝึก ไม่นับคะแนน') : `ได้ ${w.result.score}/${w.result.max} คะแนน`);
        } catch (e) { w.err = 'ส่งคำตอบไม่สำเร็จ: ' + ((e && e.message) || 'ลองใหม่อีกครั้ง'); }
        w.busy = false;
        if (!state.alive) return;
        renderMissions(); renderWork();
        if (w.result) { const r = $('[data-el="work"] .nls-subnet-result'); if (r && r.scrollIntoView) r.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
      }

      // ---------------- 32-bit visualiser (practice + calculator)
      function vizState(scope) {
        if (scope === 'calc') return state.cviz || null;
        const w = W(state.cur); if (!w.problem) return null;
        const srcs = vizSources(helpPr(w), !!w.result); if (!srcs.length) return null;
        const s = srcs[Math.min(w.viz.src, srcs.length - 1)];
        const p = w.viz.p != null ? w.viz.p : (s.known && s.p ? s.p : 24);
        return { ip: s.ip, p, reveal: !!w.result || w.viz.reveal,
          hint: !s.known ? 'ตัวอย่างนี้ไม่ได้บอก prefix ตรง ๆ (ต้องหาเองเหมือนในโจทย์) แถบเริ่มที่ /24 — ลองเลื่อนหา prefix ที่ถูกเอง แล้วกดแสดงผล AND / OR เพื่อเทียบ' : '' };
      }
      function updateViz(scope) {
        const box = el.querySelector(`[data-viz="${scope}"]`); if (!box) return;
        const v = vizState(scope);
        const body = box.querySelector('[data-el="vizbody"]'), rng = box.querySelector('[data-el="vizp"]'), outp = box.querySelector('[data-el="vizout"]');
        const minus = box.querySelector('[data-act="vizminus"]'), plus = box.querySelector('[data-act="vizplus"]');
        if (!v || v.ip == null || !(v.p >= 1 && v.p <= 32)) {
          body.innerHTML = '<p class="nls-subnet-empty">ใส่ IP และ prefix ที่ถูกต้องเพื่อดูภาพบิต</p>'; outp.textContent = '';
          rng.disabled = true; minus.disabled = true; plus.disabled = true; return;
        }
        rng.disabled = false;
        if (String(rng.value) !== String(v.p)) rng.value = String(v.p);
        rng.setAttribute('aria-valuetext', '/' + v.p + ' mask ' + ipStr(maskInt(v.p)));
        outp.textContent = '/' + v.p + ' = ' + ipStr(maskInt(v.p));
        minus.disabled = v.p <= 1; plus.disabled = v.p >= 32;
        body.innerHTML = (v.hint ? `<p class="nls-subnet-legend">${esc(v.hint)}</p>` : '') + vizBody(v.ip, v.p, v.reveal);
      }
      function setVizP(scope, np) {
        np = Math.max(1, Math.min(32, Math.round(Number(np) || 0))); if (!np) return;
        if (scope === 'calc') { const m = $('[data-el="cmask"]'); m.value = String(np); renderCalc(); return; }
        W(state.cur).viz.p = np; updateViz('work');
      }

      // ---------------- step-by-step teaching
      function renderTeach() {
        const box = $('[data-el="work"] [data-el="teach"]'); if (!box) return;
        const w = W(state.cur); const c = teachContext(helpPr(w)); if (!c) return;
        if (!w.teach) w.teach = { step: 0, vals: {}, st: {}, wrong: {}, fb: {} };
        box.innerHTML = teachHtml(teachSteps(c.ip, c.p, c.pre), w.teach, c.note);
      }
      function teachCheck(i, show) {
        const w = W(state.cur); const c = teachContext(helpPr(w)); const t = w.teach;
        if (!c || !t || i !== t.step) return;
        const s = teachSteps(c.ip, c.p, c.pre)[i]; if (!s) return;
        $('[data-el="work"]').querySelectorAll(`[data-tk][data-ti="${i}"]`).forEach((inp) => { t.vals[inp.getAttribute('data-tk')] = inp.value; });
        if (show) { Object.assign(t.vals, s.answer()); t.st[i] = 'shown'; t.fb[i] = { cls: 'good', html: 'เฉลย: ' + s.explain }; t.step++; }
        else if (s.inputs.some((x) => !String(t.vals[x.k] || '').trim())) t.fb[i] = { cls: 'bad', html: 'กรอกให้ครบทุกช่องของขั้นนี้ก่อน' };
        else {
          const msg = s.check(t.vals);
          if (!msg) { t.st[i] = 'ok'; t.fb[i] = { cls: 'good', html: '✔ ถูกต้อง: ' + s.explain }; t.step++; }
          else { t.wrong[i] = (t.wrong[i] || 0) + 1; t.fb[i] = { cls: 'bad', html: '✘ ยังไม่ถูก — ' + esc(msg) }; }
        }
        renderTeach();
        const box = $('[data-el="work"] [data-el="teach"]'); if (!box) return;
        // re-announce the feedback (the live region was just re-created)
        const fbEl = box.querySelector(`li[data-ti="${i}"] .nls-subnet-tfb`);
        if (fbEl) { const html = fbEl.innerHTML; fbEl.innerHTML = ''; later(() => { fbEl.innerHTML = html; }, 60); }
        const nx = box.querySelector(`input[data-ti="${t.step}"]:not([disabled])`) || box.querySelector(`input[data-ti="${i}"]:not([disabled])`);
        if (nx) nx.focus({ preventScroll: false }); else { const b = box.querySelector('[data-act="treset"]'); if (b) b.focus({ preventScroll: true }); }
      }

      // ---------------- calculator
      function renderCalc() {
        el.querySelectorAll('[data-calcmode]').forEach((b) => b.setAttribute('aria-pressed', String(b.getAttribute('data-calcmode') === state.calcMode)));
        el.querySelectorAll('[data-calc]').forEach((d) => d.classList.toggle('nls-subnet-hide', d.getAttribute('data-calc') !== state.calcMode));
        const out = $('[data-el="cout"]');
        const prevOpen = Array.from(out.querySelectorAll('.nls-subnet-stepd')).map((d) => d.open); // keep the student's accordion state while typing
        const keepOpen = () => { if (prevOpen.length) out.querySelectorAll('.nls-subnet-stepd').forEach((d, i) => { if (i < prevOpen.length) d.open = prevOpen[i]; }); };
        const err = (t) => { out.innerHTML = `<p class="nls-subnet-msg err">${esc(t)}</p>`; if (state.calcMode === 'ip') { state.cviz = null; updateViz('calc'); } };
        if (state.calcMode === 'ip') {
          let ipS = $('[data-el="cip"]').value.replace(/\s+/g, ''); let pS = $('[data-el="cmask"]').value;
          const sl = ipS.indexOf('/'); if (sl >= 0) { if (!pS.trim()) pS = ipS.slice(sl); ipS = ipS.slice(0, sl); }
          const ip = ipToInt(ipS);
          if (ip === null) return err('IP ไม่ถูกต้อง: ต้องเป็นเลข 4 ชุด (0–255) คั่นด้วยจุด เช่น 192.168.1.77');
          let p = pS.trim() ? parseMaskOrPrefix(pS) : null; let classful = false;
          if (!pS.trim()) { const c = classOf(ip); if (!{ A: 1, B: 1, C: 1 }[c]) return err('IP Class D/E ไม่มี default mask กรุณาใส่ prefix'); p = { A: 8, B: 16, C: 24 }[c]; classful = true; }
          if (p === null) return err('Prefix/mask ไม่ถูกต้อง: ใส่ /1–/30 หรือ mask ที่บิต 1 ต่อเนื่อง เช่น 255.255.255.192');
          if (p < 1) return err('Prefix ต้องอยู่ระหว่าง /1 ถึง /32');
          state.cviz = { ip, p, reveal: true }; updateViz('calc');
          if (p >= 31) {
            const n = netOf(ip, p);
            out.innerHTML = p === 31
              ? `<p class="nls-subnet-vnote"><b>/31 (RFC 3021)</b>: มี 2 address คือ <span class="nls-subnet-mono">${ipStr(n)}</span> และ <span class="nls-subnet-mono">${ipStr(n + 1)}</span> ใช้กับ router 2 ฝั่งของลิงก์ point-to-point ได้ทั้งคู่ ไม่มี network/broadcast (สูตร 2^h − 2 ใช้ไม่ได้)</p>`
              : `<p class="nls-subnet-vnote"><b>/32</b>: มี address เดียวคือ <span class="nls-subnet-mono">${ipStr(ip)}</span> (mask 255.255.255.255) ใช้กับ loopback / Router ID / host route</p>`;
            return;
          }
          out.innerHTML = (classful ? '<p class="nls-subnet-legend">ไม่ได้ใส่ prefix — ใช้ default mask ตาม Class</p>' : '') +
            hostSteps(ip, p, { classful, maskGiven: !classful && /\./.test(pS) });
          keepOpen();
        } else {
          let bS = $('[data-el="vblk"]').value.replace(/\s+/g, '');
          if (bS.indexOf('/') < 0) bS += '/' + $('[data-el="vpre"]').value.replace(/[\s/]+/g, ''); // separate prefix box (phones have no "/" on the number pad)
          const m = /^([\d.]+)\/(\d{1,2})$/.exec(bS);
          const blk = m ? ipToInt(m[1]) : null; const b = m ? Number(m[2]) : NaN;
          if (blk === null || !(b >= 8 && b <= 29)) return err('Block ต้องเป็น network เช่น 192.168.1.0 และ prefix 8–29 (หรือพิมพ์ 192.168.1.0/24 ในช่องเดียว)');
          const nums = $('[data-el="vreq"]').value.split(/[,.;\s]+/).filter(Boolean);
          if (!nums.length || nums.length > 12 || nums.some((x) => !/^\d{1,8}$/.test(x) || Number(x) < 1)) return err('ใส่จำนวน host เป็นตัวเลข 1 ขึ้นไป คั่นด้วยเครื่องหมาย , (ไม่เกิน 12 ห้อง)');
          const reqs = nums.map((x, i) => ({ name: 'ห้อง ' + String.fromCharCode(65 + i), hosts: Number(x) }));
          out.innerHTML = (netOf(blk, b) !== blk ? `<p class="nls-subnet-legend">ปรับ block เป็น network ที่ถูกต้อง: ${ipStr(netOf(blk, b))}/${b}</p>` : '') + vlsmSteps(blk, b, reqs);
          keepOpen();
        }
      }

      // ---------------- binary helper
      function renderBits() {
        const v = state.bits;
        $('[data-el="bits"]').innerHTML = [128, 64, 32, 16, 8, 4, 2, 1].map((pv) =>
          `<button type="button" class="nls-subnet-bit" data-bit="${pv}" aria-pressed="${(v & pv) ? 'true' : 'false'}" aria-label="บิตค่า ${pv}"><small>${pv}</small><b>${(v & pv) ? 1 : 0}</b></button>`).join('');
        const on = [128, 64, 32, 16, 8, 4, 2, 1].filter((pv) => v & pv);
        $('[data-el="bsum"]').textContent = `${bin8(v)} = ${on.length ? on.join(' + ') : '0'} = ${v}` + (isMaskOctet(v) ? `  (ถ้าเป็น mask: block = ${256 - v})` : '');
        const d = $('[data-el="bdec"]'); if (document.activeElement !== d) d.value = String(v);
      }
      const isMaskOctet = (v) => [128, 192, 224, 240, 248, 252, 254, 255].indexOf(v) >= 0;

      // ---------------- events (delegated; removed in destroy)
      function setTab(t) {
        state.tab = t;
        el.querySelectorAll('[data-tab]').forEach((b) => b.setAttribute('aria-selected', String(b.getAttribute('data-tab') === t)));
        el.querySelectorAll('[data-pane]').forEach((p) => p.classList.toggle('nls-subnet-hide', p.getAttribute('data-pane') !== t));
        if (t === 'calc') renderCalc();
      }
      function selectMission(id) { // keep typed answers of the mission being left, then show the chosen one
        const w0 = W(state.cur);
        if (w0.problem && !w0.result) { const a = {}; $('[data-el="work"]').querySelectorAll('[data-key]').forEach((i) => { a[i.getAttribute('data-key')] = i.value; }); w0.answers = a; }
        state.cur = id; renderMissions(); renderWork();
      }
      function onClick(e) {
        const t = e.target.closest('button'); if (!t || !el.contains(t)) return;
        if (t.hasAttribute('data-tab')) return setTab(t.getAttribute('data-tab'));
        if (t.hasAttribute('data-mission')) {
          selectMission(t.getAttribute('data-mission'));
          const b = el.querySelector(`[data-mission="${state.cur}"]`); if (b) b.focus({ preventScroll: true });
          return;
        }
        if (t.hasAttribute('data-bit')) { state.bits ^= Number(t.getAttribute('data-bit')); renderBits(); const nb = el.querySelector(`[data-bit="${t.getAttribute('data-bit')}"]`); if (nb) nb.focus(); return; }
        if (t.hasAttribute('data-calcmode')) { state.calcMode = t.getAttribute('data-calcmode'); renderCalc(); return; }
        const act = t.getAttribute('data-act');
        if (act === 'vizminus' || act === 'vizplus') {
          const sc = t.closest('[data-viz]').getAttribute('data-viz'); const v = vizState(sc);
          if (v) setVizP(sc, v.p + (act === 'vizplus' ? 1 : -1));
          return;
        }
        if (act === 'vizreveal') {
          const w = W(state.cur); w.viz.reveal = !w.viz.reveal;
          t.setAttribute('aria-pressed', String(w.viz.reveal)); t.textContent = w.viz.reveal ? 'ซ่อนผล AND / OR' : 'แสดงผล AND / OR (Network, Broadcast)';
          updateViz('work'); return;
        }
        if (act === 'exnew') {
          const w = W(state.cur); if (!w.problem || w.result) return;
          w.ex = exampleFor(w.problem); w.viz = { src: 0, p: null, reveal: false }; w.teach = null; renderWork();
          const b = $('[data-el="work"] [data-act="exnew"]'); if (b) b.focus({ preventScroll: true });
          return;
        }
        if (act === 'tcheck' || act === 'tshow') { teachCheck(Number(t.getAttribute('data-ti')), act === 'tshow'); return; }
        if (act === 'treset') {
          W(state.cur).teach = null; renderTeach();
          const f = $('[data-el="work"] [data-el="teach"] input[data-tk]'); if (f) f.focus();
          return;
        }
        if (act === 'new') newProblem();
        else if (act === 'hint') { const w = W(state.cur); w.hints++; renderWork(); }
        else if (act === 'clear') { W(state.cur).answers = {}; $('[data-el="work"]').querySelectorAll('[data-key]').forEach((i) => { i.value = ''; }); }
        else if (act === 'bclear') { state.bits = 0; renderBits(); }
        else if (act === 'stepsall') { const sol = t.closest('.nls-subnet-sol'); if (sol) sol.querySelectorAll('.nls-subnet-stepd').forEach((d) => { d.open = t.getAttribute('data-open') === '1'; }); }
      }
      function onSubmit(e) { if (e.target && e.target.getAttribute && e.target.getAttribute('data-el') === 'form') { e.preventDefault(); submit(); } }
      function onInput(e) {
        const t = e.target; const k = t.getAttribute && t.getAttribute('data-el');
        if (k === 'vizp') { const sc = t.closest('[data-viz]').getAttribute('data-viz'); setVizP(sc, t.value); return; }
        if (k === 'vizsrc') { const w = W(state.cur); w.viz.src = Number(t.value) || 0; w.viz.p = null; updateViz('work'); return; }
        if (t.hasAttribute && t.hasAttribute('data-tk')) { const w = W(state.cur); if (w.teach) w.teach.vals[t.getAttribute('data-tk')] = t.value; return; }
        if (k === 'cip' || k === 'cmask' || k === 'vblk' || k === 'vpre' || k === 'vreq') renderCalc();
        else if (k === 'bdec') { const s = t.value.replace(/\D/g, ''); if (s !== '' && Number(s) <= 255) { state.bits = Number(s); renderBits(); } }
        else if (t.hasAttribute && t.hasAttribute('data-key')) { const w = W(state.cur); w.answers[t.getAttribute('data-key')] = t.value; }
      }
      function onKey(e) { // arrow keys move between tabs and missions
        const t = e.target; if (!t.closest) return;
        if (e.key === 'Enter' && !e.isComposing && t.tagName === 'INPUT' && t.hasAttribute('data-tk')) { e.preventDefault(); teachCheck(Number(t.getAttribute('data-ti')), false); return; }
        if (e.key === 'Enter' && !e.isComposing && coarse() && t.tagName === 'INPUT' && t.hasAttribute('data-key')) {
          // phone keyboards show "next": jump to the next empty answer; when all are filled Enter submits as on desktop
          const all = Array.from($('[data-el="work"]').querySelectorAll('[data-key]:not([disabled])')); const i = all.indexOf(t);
          const nx = all.slice(i + 1).find((x) => !x.value.trim());
          if (nx) { e.preventDefault(); nx.focus(); }
          return;
        }
        if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && t.hasAttribute('data-tab')) {
          e.preventDefault(); const nt = t.getAttribute('data-tab') === 'practice' ? 'calc' : 'practice'; setTab(nt); el.querySelector(`[data-tab="${nt}"]`).focus();
        } else if (t.hasAttribute('data-mission') && /^Arrow(Up|Down|Left|Right)$/.test(e.key)) {
          const all = Array.from(el.querySelectorAll('[data-mission]')); const i = all.indexOf(t);
          const n = all[(i + (e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : all.length - 1)) % all.length];
          if (n) { e.preventDefault(); n.focus(); }
        }
      }
      el.addEventListener('click', onClick);
      el.addEventListener('submit', onSubmit);
      el.addEventListener('input', onInput);
      el.addEventListener('keydown', onKey);
      function onToggle(e) {
        const d = e.target; if (!d || !d.getAttribute) return;
        const f = d.getAttribute('data-fold'); if (f) W(state.cur).ui[f] = d.open;
      }
      el.addEventListener('toggle', onToggle, true);
      // on-screen keyboard: keep the focused field in view (visual viewport) and expose its height as --vvh
      const vv = window.visualViewport || null;
      let focused = null;
      const ensureVisible = () => {
        if (!focused || document.activeElement !== focused || !el.contains(focused)) return;
        const r = focused.getBoundingClientRect(); const top = vv ? vv.offsetTop : 0; const h = vv ? vv.height : window.innerHeight;
        if (r.top < top + 8 || r.bottom > top + h - 8) { try { focused.scrollIntoView({ block: 'center', inline: 'nearest' }); } catch (e2) { focused.scrollIntoView(); } }
      };
      const onVv = () => { if (vv) el.style.setProperty('--vvh', Math.round(vv.height) + 'px'); ensureVisible(); };
      function onFocusIn(e) {
        const t = e.target; if (!t || !/^(INPUT|SELECT)$/.test(t.tagName)) return;
        focused = t; if (coarse()) later(ensureVisible, 300);
      }
      el.addEventListener('focusin', onFocusIn);
      if (vv) { vv.addEventListener('resize', onVv); vv.addEventListener('scroll', onVv); onVv(); }

      renderMissions(); renderWork(); renderBits();
      if (ctx.initial && ctx.initial !== state.cur && missions.some((m) => m.id === ctx.initial)) selectMission(ctx.initial); // deep link: same as clicking the mission
      return {
        destroy() {
          state.alive = false;
          el.removeEventListener('click', onClick); el.removeEventListener('submit', onSubmit);
          el.removeEventListener('input', onInput); el.removeEventListener('keydown', onKey);
          el.removeEventListener('focusin', onFocusIn); el.removeEventListener('toggle', onToggle, true);
          if (vv) { vv.removeEventListener('resize', onVv); vv.removeEventListener('scroll', onVv); }
          timers.forEach((id) => clearTimeout(id)); timers.clear(); focused = null;
          if (el.parentNode) el.parentNode.removeChild(el);
        }
      };
    }
  };
})();

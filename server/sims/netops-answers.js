'use strict';
/*
 * NetOps lab - SERVER-ONLY answer key (Phase 6 leak fix).
 *
 * The shared engine (public/js/sim/netops.js) builds the scenario's incidents and simulates the dashboard, counters
 * and syslog in the browser, but it no longer writes an answer object (S.answer) or marks which syslog lines belong
 * to the incident (log.inc). This module derives both on the server from the HMAC-signed seed:
 *   answerFor(mission, seed) -> o2 { cause, devs[], t0 } | o3 { cause, bottleneck[[dev, if]], talker[[dev, if]], host, t0, t1 }
 *   incidentLogIds(mission, seed, sim) -> Set of syslog line ids that are evidence of the o2 incident
 * This file is never sent to the browser.
 */
const path = require('path');
const N = require(path.join(__dirname, '../../public/js/sim/netops.js'));

const NET = N.network();
const LINKS = NET.links;   // [{ a, ia, b, ib, speed }] (same order as the engine's link indexes)

function answerFor(mission, seed) {
  const S = N.scenario(mission, seed);
  if (mission === 'o2') {
    const inc = S.incidents[0];
    const two = inc.kind === 'flapping' || inc.kind === 'bad_cable';   // either end of the faulty link counts
    return { cause: inc.kind, devs: two ? [inc.dev, LINKS[inc.link].a] : [inc.dev], t0: inc.t0 };
  }
  if (mission === 'o3') {
    const inc = S.incidents.find((x) => x.kind === 'top_talker');
    const host = /^PC-/.test(inc.dst) ? inc.dst : inc.src;
    const hl = LINKS.find((l) => l.b === host);                 // the access-switch port of the talker
    const acc = hl.a, port = hl.ia;
    const wan = inc.src === 'ISP';                               // internet download fills the 300 Mbps WAN link
    const up = LINKS.find((l) => l.b === acc && l.ib === 'Gi0/24');
    const bottleneck = wan ? [['R1', 'Gi0/0']] : [[acc, 'Gi0/24'], [up.a, up.ia]];
    return { cause: 'high_util', bottleneck, talker: [[acc, port]], host, t0: inc.t0, t1: inc.t1 };
  }
  return null;
}

/* syslog lines produced by the o2 incident (everything else is background noise or a distractor) */
const LONG = (n) => n.replace(/^Gi/, 'GigabitEthernet');
const BOOT_FAC = new Set(['SYS-5-RESTART', 'SYS-6-BOOTTIME', 'SYS-6-LOGGINGHOST_STARTSTOP', 'kernel']);
const SVC_FAC = /^(kernel|systemd\[1\]|sudo)$/;
function incidentLogIds(mission, seed, sim) {
  const S = N.scenario(mission, seed);
  const inc = S.incidents[0], ids = new Set();
  if (mission !== 'o2' || !inc) return ids;
  const lk = inc.link != null ? LINKS[inc.link] : null;
  const ends = lk ? [[lk.a, LONG(lk.ia)], [lk.b, LONG(lk.ib)]] : [];
  sim.logs.forEach((x) => {
    let rel = false;
    if ((x.fac === 'LINK-3-UPDOWN' || x.fac === 'LINEPROTO-5-UPDOWN') && ends.some(([d, i]) => d === x.dev && x.msg.includes('Interface ' + i + ','))) rel = true;
    else if (x.dev === inc.dev && inc.kind === 'device_down' && BOOT_FAC.has(x.fac)) rel = true;
    else if (x.dev === inc.dev && inc.kind === 'service_down' && (SVC_FAC.test(x.fac) || (/^smbd\[/.test(x.fac) && /write failure/.test(x.msg)))) rel = true;
    if (rel) ids.add(x.id);
  });
  return ids;
}

module.exports = { answerFor, incidentLogIds };

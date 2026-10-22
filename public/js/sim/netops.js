'use strict';
/*!
 * NetOps — NetLab "Network Monitoring และ Automation" lab
 * One file, two parts:
 *   1) UMD engine (no dependencies, deterministic per seed) shared by the browser and server/sims/netops.js,
 *      so the server re-runs the student's monitors / template / playbook itself when grading.
 *   2) Browser UI (registered as window.NL_SIMS.netops) — skipped when loaded by Node.
 *
 * EVERYTHING HERE IS A SIMULATION of a small school network. Nothing contacts real hosts: "ping", "TCP check",
 * "SNMP polling", "push" and "playbook" only read/change JavaScript objects.
 *
 * ENGINE API (NetOps)
 *   NetOps.STEP (10 s), DURATION (3600 s), NSTEP, DAY0 (08:00:00 as seconds), fmtTime(t), parseTime('08:23')
 *   NetOps.network()                         -> { devices:[{id,type,role,ip,ports,snmp,area,model}], ifaces:{dev:[{name,desc,speed,peer}]}, links }
 *   NetOps.scenario(mission, seed)           -> scenario (incidents, story) — o1 fixed, o2 outage, o3 top talker. It holds no answer
 *                                              key: the server derives it from the signed seed (server/sims/netops-answers.js)
 *   NetOps.simulate(scenario)                -> sim (per-10s step rates/errors/oper state, syslog lines); pure function of the scenario
 *   NetOps.validateMonitor(m)                -> { ok, monitor | error }   (sanitised copy, Thai error)
 *   NetOps.poll(sim, monitor, tEnd?)         -> [{ t, status:'up'|'warn'|'down', value, ...measurement }] at every interval
 *   NetOps.evaluate(monitor, measurement)    -> 'up' | 'warn' | 'down'
 *   NetOps.ifaceRows(sim, dev, t)            -> interface counters at simulated time t
 *   NetOps.filterLogs(sim, { dev, sev, from, to, text, until })
 *   NetOps.tpl.render(src, vars)             -> { ok, text } | { ok:false, error:{ line, msg } }  (safe mini Jinja subset, no eval)
 *   NetOps.parseInventory(csv)               -> { ok, rows:[vars], errors:[{line,msg}] }
 *   NetOps.dev.blank(id) / apply(state, text) / show(state, what) / reachable(state, ip) / equal(a, b)
 *   NetOps.push(inventoryCsv, template)      -> a1: render + apply to fresh simulated access switches
 *   NetOps.a2Setup(seed, override?)          -> a2: inventory, change template, original device states, failing device
 *   NetOps.runPlaybook(setup, playbook)      -> per-device report (backup/apply/verify/save/rollback)
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.NetOps = api;
})(typeof self !== 'undefined' ? self : this, function () {
  const VERSION = '1.0.0';
  const STEP = 10, DURATION = 3600, NSTEP = DURATION / STEP, DAY0 = 8 * 3600;
  const own = (o, k) => o != null && Object.prototype.hasOwnProperty.call(o, k);
  const clone = (o) => JSON.parse(JSON.stringify(o));

  /* ------------------------------------------------------------------ deterministic random */
  function hashStr(s) {
    s = String(s);
    let h = 1779033703 ^ s.length;
    for (let i = 0; i < s.length; i++) { h = Math.imul(h ^ s.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
    h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^ (h >>> 16)) >>> 0;
  }
  function rng(seed) {
    let a = hashStr(seed);
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const noise = (seed, key, i) => { let h = hashStr(seed + '|' + key + '|' + i); h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0; return h / 4294967296; };
  const ri = (r, a, b) => a + Math.floor(r() * (b - a + 1));
  const pick = (r, arr) => arr[Math.floor(r() * arr.length)];

  const pad2 = (n) => (n < 10 ? '0' : '') + n;
  function fmtTime(t, short) {
    const s = DAY0 + Math.max(0, Math.round(t));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
    return pad2(h) + ':' + pad2(m) + (short ? '' : ':' + pad2(x));
  }
  /* '08:23' or '8:23:40' -> seconds since 08:00 (may be outside the timeline: caller checks) | null */
  function parseTime(v) {
    const m = /^\s*(\d{1,2})[:.](\d{2})(?:[:.](\d{2}))?\s*(?:น\.?)?\s*$/.exec(String(v == null ? '' : v).slice(0, 20));
    if (!m) return null;
    const h = +m[1], mi = +m[2], s = m[3] ? +m[3] : 0;
    if (h > 23 || mi > 59 || s > 59) return null;
    return h * 3600 + mi * 60 + s - DAY0;
  }

  /* ------------------------------------------------------------------ the simulated school network */
  const DEVICES = [
    { id: 'R1', type: 'router', role: 'router', ip: '10.10.99.1', ports: [22], model: 'ISR4331', area: 'ห้อง Server' },
    { id: 'CORE-SW1', type: 'switch', role: 'core', ip: '10.10.99.2', ports: [22], model: 'C9300-24T', area: 'ห้อง Server' },
    { id: 'ACC-SW1', type: 'switch', role: 'access', ip: '10.10.99.11', ports: [22], model: 'WS-C2960X', area: 'ห้อง LAB1' },
    { id: 'ACC-SW2', type: 'switch', role: 'access', ip: '10.10.99.12', ports: [22], model: 'WS-C2960X', area: 'ห้องสมุด' },
    { id: 'ACC-SW3', type: 'switch', role: 'access', ip: '10.10.99.13', ports: [22], model: 'WS-C2960X', area: 'ห้อง LAB3' },
    { id: 'ACC-SW4', type: 'switch', role: 'access', ip: '10.10.99.14', ports: [22], model: 'WS-C2960X', area: 'ห้องพักครู' },
    { id: 'ACC-SW5', type: 'switch', role: 'access', ip: '10.10.99.15', ports: [22], model: 'WS-C2960X', area: 'ห้อง LAB5' },
    { id: 'SRV-WEB', type: 'server', role: 'server', ip: '10.10.20.10', ports: [22, 80, 443], model: 'Ubuntu 24.04 (nginx)', area: 'ห้อง Server' },
    { id: 'SRV-FILE', type: 'server', role: 'server', ip: '10.10.20.11', ports: [22, 445], model: 'Ubuntu 24.04 (Samba)', area: 'ห้อง Server' },
    { id: 'SRV-DNS', type: 'server', role: 'server', ip: '10.10.20.12', ports: [22, 53], model: 'Ubuntu 24.04 (BIND + ISC DHCP)', area: 'ห้อง Server' },
    { id: 'NMS', type: 'server', role: 'nms', ip: '10.10.20.50', ports: [22, 443], model: 'เครื่อง Monitoring (ตัว poller)', area: 'ห้อง Server' },
    { id: 'AP-1', type: 'ap', role: 'ap', ip: '10.10.99.21', ports: [22, 443], model: 'Wi-Fi 6 AP', area: 'ห้องสมุด' },
    { id: 'AP-2', type: 'ap', role: 'ap', ip: '10.10.99.22', ports: [22, 443], model: 'Wi-Fi 6 AP', area: 'ห้องพักครู' },
    { id: 'PRN-1', type: 'printer', role: 'printer', ip: '10.10.20.31', ports: [80, 9100], model: 'Laser printer', area: 'ห้อง LAB1' },
    { id: 'PRN-2', type: 'printer', role: 'printer', ip: '10.10.20.32', ports: [80, 9100], model: 'Laser printer', area: 'ห้อง LAB3' }
  ];
  const DEV = {}; DEVICES.forEach((d) => { DEV[d.id] = d; });
  const G = 1e9, M = 1e6;
  /* links: [devA, ifA, devB, ifB, speed]; hosts (PC-*, ISP) are endpoints that are not monitored */
  const LINKS = [['R1', 'Gi0/0', 'ISP', 'wan', 300 * M], ['R1', 'Gi0/1', 'CORE-SW1', 'Gi1/0/1', G]];
  for (let k = 1; k <= 5; k++) LINKS.push(['CORE-SW1', 'Gi1/0/' + (k + 1), 'ACC-SW' + k, 'Gi0/24', G]);
  LINKS.push(['CORE-SW1', 'Gi1/0/10', 'SRV-WEB', 'eth0', G], ['CORE-SW1', 'Gi1/0/11', 'SRV-FILE', 'eth0', G],
    ['CORE-SW1', 'Gi1/0/12', 'SRV-DNS', 'eth0', G], ['CORE-SW1', 'Gi1/0/13', 'NMS', 'eth0', G]);
  const SPECIAL = { 'ACC-SW2|Gi0/6': ['AP-1', 'Gi0', G], 'ACC-SW4|Gi0/6': ['AP-2', 'Gi0', G], 'ACC-SW1|Gi0/5': ['PRN-1', 'eth0', 100 * M], 'ACC-SW3|Gi0/5': ['PRN-2', 'eth0', 100 * M] };
  const PCS = [];
  for (let k = 1; k <= 5; k++) {
    for (let j = 1; j <= 6; j++) {
      const sp = SPECIAL['ACC-SW' + k + '|Gi0/' + j];
      if (sp) LINKS.push(['ACC-SW' + k, 'Gi0/' + j, sp[0], sp[1], sp[2]]);
      else { const pc = 'PC-' + (k === 2 ? 'LIB' : k === 4 ? 'TCH' : 'LAB' + k) + '-0' + j; PCS.push(pc); LINKS.push(['ACC-SW' + k, 'Gi0/' + j, pc, 'eth0', G]); }
    }
  }
  const IFACES = {};   // dev -> [{ name, desc, speed, link }]
  const ADJ = {};      // node -> [{ node, link, dir }]  dir 0: a->b
  LINKS.forEach((l, i) => {
    const [a, ia, b, ib, sp] = l;
    const descOf = (dev, peer, pif) => {
      if (peer === 'ISP') return 'WAN to ISP 300Mbps';
      if (DEV[dev] && DEV[dev].role === 'access' && peer === 'CORE-SW1') return 'Uplink to CORE-SW1';
      return (DEV[peer] ? 'to ' + peer + ' ' + pif : peer);
    };
    if (DEV[a]) (IFACES[a] = IFACES[a] || []).push({ name: ia, desc: descOf(a, b, ib), speed: sp, link: i, peer: b, peerIf: ib });
    if (DEV[b]) (IFACES[b] = IFACES[b] || []).push({ name: ib, desc: descOf(b, a, ia), speed: sp, link: i, peer: a, peerIf: ia });
    (ADJ[a] = ADJ[a] || []).push({ node: b, link: i, dir: 0 });
    (ADJ[b] = ADJ[b] || []).push({ node: a, link: i, dir: 1 });
  });
  const ifaceOf = (dev, name) => (IFACES[dev] || []).find((x) => x.name === name) || null;
  /* path in the tree: [{ link, dir }] from a to b */
  const PATHS = {};
  function path(a, b) {
    const key = a + '>' + b;
    if (PATHS[key]) return PATHS[key];
    const prev = {}; prev[a] = null; const q = [a];
    while (q.length) { const n = q.shift(); if (n === b) break; for (const e of ADJ[n] || []) if (!own(prev, e.node)) { prev[e.node] = { from: n, link: e.link, dir: e.dir }; q.push(e.node); } }
    const out = [];
    if (!own(prev, b)) return (PATHS[key] = null);
    for (let n = b; prev[n]; n = prev[n].from) out.unshift({ link: prev[n].link, dir: prev[n].dir, from: prev[n].from, to: n });
    return (PATHS[key] = out);
  }
  function network() {
    return { devices: clone(DEVICES), ifaces: clone(IFACES), links: LINKS.map((l) => ({ a: l[0], ia: l[1], b: l[2], ib: l[3], speed: l[4] })) };
  }
  const longIf = (n) => n.replace(/^Gi/, 'GigabitEthernet');

  /* ------------------------------------------------------------------ scenarios */
  const CAUSES = [
    { id: 'device_down', th: 'อุปกรณ์ดับ / ไม่ตอบสนองทั้งตัว (device down)' },
    { id: 'flapping', th: 'ลิงก์/พอร์ตขึ้น-ลงซ้ำ ๆ (interface flapping)' },
    { id: 'service_down', th: 'บริการหยุดทำงาน แต่เครื่องยัง ping ได้ (service down)' },
    { id: 'bad_cable', th: 'สายหรือหัวต่อเสีย มี CRC / input errors (bad cable)' },
    { id: 'high_util', th: 'แบนด์วิดท์เต็มจาก top talker (high utilization)' }
  ];
  const SVC = { 'SRV-WEB': { ports: [80, 443], name: 'nginx', what: 'เว็บไซต์โรงเรียน' }, 'SRV-FILE': { ports: [445], name: 'smbd', what: 'แชร์ไฟล์ (SMB)' }, 'SRV-DNS': { ports: [53], name: 'named', what: 'DNS' } };
  const uplinkOf = (acc) => LINKS.findIndex((l) => l[2] === acc && l[3] === 'Gi0/24');
  const linkOfDev = (dev) => LINKS.findIndex((l) => l[2] === dev);  // the link towards the parent switch

  function scenario(mission, seed) {
    seed = String(seed || 'demo').slice(0, 40);
    const r = rng('scn|' + mission + '|' + seed);
    const S = { mission, seed, incidents: [], story: '', speeds: {} };
    if (mission === 'o2') {
      const kind = pick(r, ['device_down', 'flapping', 'service_down', 'bad_cable']);
      const t0 = ri(r, 66, 210) * STEP;   // 08:11 .. 08:35
      if (kind === 'device_down') {
        const dev = pick(r, ['ACC-SW2', 'ACC-SW3', 'ACC-SW4', 'ACC-SW5', 'AP-1', 'AP-2']);
        const t1 = r() < 0.5 ? DURATION : t0 + ri(r, 48, 90) * STEP;
        S.incidents.push({ kind, dev, link: linkOfDev(dev), t0, t1 });
        S.story = DEV[dev].type === 'ap' ? `ผู้ใช้ใน${DEV[dev].area} แจ้งว่าเชื่อมต่อ Wi-Fi ไม่ได้เลยตั้งแต่ช่วงเช้า` : `ครูใน${DEV[dev].area} แจ้งว่าเครื่องทั้งห้องเข้าเว็บและแชร์ไฟล์ไม่ได้ตั้งแต่ช่วงเช้า`;
      } else if (kind === 'flapping') {
        const dev = pick(r, ['ACC-SW1', 'ACC-SW3', 'ACC-SW5', 'AP-1', 'AP-2']);
        const link = linkOfDev(dev), downs = [];
        let t = t0; const n = ri(r, 6, 9);
        for (let i = 0; i < n; i++) { const d = ri(r, 1, 3) * STEP; downs.push([t, t + d]); t += d + ri(r, 2, 6) * STEP; }
        S.incidents.push({ kind, dev, link, t0, t1: t, downs });
        S.story = `ผู้ใช้ใน${DEV[dev].area} แจ้งว่าเน็ต "หลุด ๆ ติด ๆ" เป็นช่วง ๆ`;
      } else if (kind === 'service_down') {
        const dev = pick(r, ['SRV-WEB', 'SRV-FILE', 'SRV-DNS']);
        const t1 = r() < 0.4 ? DURATION : t0 + ri(r, 60, 120) * STEP;
        S.incidents.push({ kind, dev, ports: SVC[dev].ports, t0, t1 });
        S.story = dev === 'SRV-DNS' ? 'ผู้ใช้หลายห้องแจ้งว่าเปิดเว็บไม่ได้ ขึ้นว่า "หาชื่อเว็บไม่พบ" แต่ใช้ IP ตรง ๆ ได้' : `ครูแจ้งว่าใช้${SVC[dev].what}ไม่ได้ ทั้งที่เครือข่ายส่วนอื่นปกติ`;
      } else {
        const dev = pick(r, ['ACC-SW1', 'ACC-SW3', 'ACC-SW5', 'SRV-FILE']);
        const link = linkOfDev(dev);
        S.incidents.push({ kind, dev, link, t0, t1: DURATION, flaps: [t0, t0 + ri(r, 60, 120) * STEP] });
        S.story = dev === 'SRV-FILE' ? 'ครูแจ้งว่าเปิดไฟล์จาก file server ช้ามาก บางครั้งค้าง' : `ผู้ใช้ใน${DEV[dev].area} แจ้งว่าเน็ตช้า โหลดไฟล์ค้างเป็นบางครั้ง`;
      }
    } else if (mission === 'o3') {
      const variant = pick(r, ['wan', 'uplink100']);
      const k = pick(r, variant === 'wan' ? [1, 3, 5] : [1, 3, 5]);
      const host = 'PC-LAB' + k + '-0' + pick(r, k === 1 || k === 3 ? [1, 2, 3, 4, 6] : [1, 2, 3, 4, 5, 6]);
      const port = 'Gi0/' + host.slice(-1);
      const t0 = ri(r, 60, 150) * STEP, t1 = t0 + ri(r, 100, 160) * STEP;
      if (variant === 'wan') {
        S.incidents.push({ kind: 'top_talker', src: 'ISP', dst: host, demand: 420 * M, t0, t1 });
        S.incidents.push({ kind: 'extra_flow', src: 'SRV-FILE', dst: 'NMS', demand: 430 * M, t0: ri(r, 20, 50) * STEP, t1: ri(r, 230, 300) * STEP });
        S.story = 'ช่วงเช้ามีผู้ใช้ทั้งโรงเรียนแจ้งว่าอินเทอร์เน็ตช้ามาก แต่เปิดไฟล์ใน file server ได้ปกติ';
      } else {
        const ul = uplinkOf('ACC-SW' + k);
        S.speeds[ul] = 100 * M;
        S.incidents.push({ kind: 'top_talker', src: host, dst: 'SRV-FILE', demand: 400 * M, t0, t1 });
        S.incidents.push({ kind: 'extra_flow', src: 'ISP', dst: 'AP-1', demand: 110 * M, t0: ri(r, 20, 50) * STEP, t1: ri(r, 230, 300) * STEP });
        S.story = `ผู้ใช้ใน${DEV['ACC-SW' + k].area} แจ้งว่าเน็ตและแชร์ไฟล์ช้ามาก ส่วนห้องอื่นใช้งานได้ปกติ`;
      }
    } else {
      // o1 / free practice: a lively but fixed timeline so every status colour can be seen
      S.incidents.push({ kind: 'device_down', dev: 'PRN-2', link: linkOfDev('PRN-2'), t0: 1500, t1: 1980 });
      S.incidents.push({ kind: 'top_talker', src: 'ISP', dst: 'PC-LAB5-03', demand: 290 * M, t0: 2400, t1: 2880 });
      S.incidents.push({ kind: 'service_down', dev: 'SRV-WEB', ports: [80, 443], t0: 3000, t1: 3240 });
      S.story = 'เครือข่ายของโรงเรียนในเช้าวันปกติ (ช่วง 08:00–09:00) มีเหตุการณ์เล็ก ๆ เกิดขึ้นบ้าง';
    }
    return S;
  }

  /* ------------------------------------------------------------------ simulation */
  const DIURNAL = (s) => 0.55 + 0.45 * Math.min(1, s / 90) - 0.12 * Math.max(0, Math.sin((s - 150) / 70));
  function simulate(S) {
    const seed = S.seed + '|' + S.mission;
    const r = rng('sim|' + seed);
    const nL = LINKS.length;
    const speed = LINKS.map((l, i) => (S.speeds && S.speeds[i]) || l[4]);
    const linkUp = LINKS.map(() => new Uint8Array(NSTEP).fill(1));
    const devUp = {}; DEVICES.forEach((d) => { devUp[d.id] = new Uint8Array(NSTEP).fill(1); });
    const svcUp = {};
    DEVICES.forEach((d) => d.ports.forEach((p) => { svcUp[d.id + ':' + p] = new Uint8Array(NSTEP).fill(1); }));
    const badLink = LINKS.map(() => new Uint8Array(NSTEP));
    const logs = [];
    // log lines carry no incident marker: which lines are evidence is decided on the server (server/sims/netops-answers.js)
    const L = (t, dev, sev, fac, msg) => logs.push({ t: Math.max(0, Math.min(DURATION - 1, Math.round(t))), dev, sev, fac, msg });
    const setRange = (arr, t0, t1, v) => { for (let s = Math.max(0, Math.floor(t0 / STEP)); s < Math.min(NSTEP, Math.ceil(t1 / STEP)); s++) arr[s] = v; };
    const linkLogs = (li, t, up, inc) => {
      const [a, ia, b, ib] = LINKS[li];
      [[a, ia], [b, ib]].forEach(([d, i], n) => {
        if (!DEV[d] || DEV[d].type === 'printer' || DEV[d].type === 'server' || DEV[d].type === 'ap') return;
        if (!devUp[d][Math.min(NSTEP - 1, Math.floor(t / STEP))]) return;   // a dead device logs nothing
        L(t + n, d, 3, 'LINK-3-UPDOWN', `Interface ${longIf(i)}, changed state to ${up ? 'up' : 'down'}`, inc);
        L(t + n + 1, d, 5, 'LINEPROTO-5-UPDOWN', `Line protocol on Interface ${longIf(i)}, changed state to ${up ? 'up' : 'down'}`, inc);
      });
    };
    /* PCs boot between 08:00 and 08:10: their access ports come up (normal background log lines) */
    LINKS.forEach((l, i) => {
      if (!/^PC-/.test(l[2])) return;
      const tb = ri(r, 0, 55) * STEP;
      if (tb > 0) { setRange(linkUp[i], 0, tb, 0); linkLogs(i, tb, true, -1); }
    });
    /* incidents */
    const extraFlows = [];
    S.incidents.forEach((inc, n) => {
      if (inc.kind === 'device_down') {
        setRange(devUp[inc.dev], inc.t0, inc.t1, 0);
        if (DEV[inc.dev].type === 'switch') {
          // its own access ports also go down; the core side logs the uplink loss
          LINKS.forEach((l, i) => { if (l[0] === inc.dev) setRange(linkUp[i], inc.t0, inc.t1, 0); });
        }
        setRange(linkUp[inc.link], inc.t0, inc.t1, 0);
        linkLogs(inc.link, inc.t0, false, n);
        if (inc.t1 < DURATION) {
          linkLogs(inc.link, inc.t1 + 40, true, n);
          setRange(linkUp[inc.link], inc.t1, inc.t1 + 40, 0);
          if (DEV[inc.dev].type === 'switch') {
            L(inc.t1 + 52, inc.dev, 5, 'SYS-5-RESTART', 'System restarted -- Cisco IOS Software, C2960X Software, Version 15.2(7)E8', n);
            L(inc.t1 + 53, inc.dev, 6, 'SYS-6-BOOTTIME', 'Time taken to reboot after reload = 52 seconds', n);
            L(inc.t1 + 60, inc.dev, 6, 'SYS-6-LOGGINGHOST_STARTSTOP', 'Logging to host 10.10.20.50 port 514 started - reconnection', n);
          } else {
            L(inc.t1 + 52, inc.dev, 5, 'kernel', 'system boot: AP firmware 6.2.1 started (reason: power-on)', n);
          }
        }
      } else if (inc.kind === 'flapping') {
        inc.downs.forEach(([a, b]) => { setRange(linkUp[inc.link], a, b, 0); linkLogs(inc.link, a, false, n); linkLogs(inc.link, b, true, n); });
      } else if (inc.kind === 'service_down') {
        inc.ports.forEach((p) => setRange(svcUp[inc.dev + ':' + p], inc.t0, inc.t1, 0));
        const sv = SVC[inc.dev] || { name: 'nginx' };
        const pid = 1000 + ri(r, 100, 8000);
        if (inc.dev === 'SRV-FILE') L(inc.t0 - 30, inc.dev, 3, 'smbd[' + pid + ']', 'write_data: write failure. Error = No space left on device', n);
        L(inc.t0, inc.dev, 3, 'kernel', `Out of memory: Killed process ${pid} (${sv.name}) total-vm:812344kB`, n);
        L(inc.t0 + 1, inc.dev, 3, 'systemd[1]', `${sv.name}.service: Main process exited, code=killed, status=9/KILL`, n);
        L(inc.t0 + 1, inc.dev, 4, 'systemd[1]', `${sv.name}.service: Failed with result 'signal'.`, n);
        if (inc.t1 < DURATION) { L(inc.t1, inc.dev, 5, 'sudo', `admin : COMMAND=/usr/bin/systemctl restart ${sv.name}`, n); L(inc.t1 + 2, inc.dev, 6, 'systemd[1]', `Started ${sv.name}.service.`, n); }
      } else if (inc.kind === 'bad_cable') {
        setRange(badLink[inc.link], inc.t0, inc.t1, 1);
        inc.flaps.forEach((t) => { setRange(linkUp[inc.link], t, t + STEP, 0); linkLogs(inc.link, t, false, n); linkLogs(inc.link, t + STEP, true, n); });
      } else if (inc.kind === 'top_talker' || inc.kind === 'extra_flow') {
        extraFlows.push(inc);
      }
    });
    /* background log lines (noise and distractors) */
    const bgDevs = ['R1', 'CORE-SW1', 'ACC-SW1', 'ACC-SW2', 'ACC-SW3', 'ACC-SW4', 'ACC-SW5'];
    for (let i = 0, n = ri(r, 4, 7); i < n; i++) L(ri(r, 10, 3500), pick(r, bgDevs), 5, 'SEC_LOGIN-5-LOGIN_SUCCESS', 'Login Success [user: admin] [Source: 10.10.20.50] [localport: 22]');
    L(ri(r, 300, 3400), 'R1', 5, 'SYS-5-CONFIG_I', 'Configured from console by admin on vty0 (10.10.20.50)');
    for (let i = 0, n = ri(r, 10, 16); i < n; i++) {
      const ap = pick(r, ['AP-1', 'AP-2']); const mac = ['3c', '22', 'fb', ri(r, 16, 255).toString(16), ri(r, 16, 255).toString(16), ri(r, 16, 255).toString(16)].join(':');
      L(ri(r, 5, 3590), ap, 6, 'hostapd', `wlan0: STA ${mac} IEEE 802.11: associated (SSID SCHOOL-WIFI)`);
    }
    const prn = pick(r, ['PRN-1', 'PRN-2']);
    L(ri(r, 200, 1200), prn, 4, 'printer', 'Toner low (Black) 12% remaining');
    const jam = ri(r, 1300, 3000); L(jam, 'PRN-1', 4, 'printer', 'Paper jam in Tray 2'); L(jam + ri(r, 60, 240), 'PRN-1', 6, 'printer', 'Paper jam cleared, ready');
    for (let i = 0, n = ri(r, 4, 8); i < n; i++) L(ri(r, 60, 3500), 'SRV-FILE', 6, 'smbd[' + ri(r, 2000, 9000) + ']', `connect to service Teachers initially as user teacher${pad2(ri(r, 1, 30))} (uid=1${ri(r, 100, 999)})`);
    for (let i = 0, n = ri(r, 2, 4); i < n; i++) L(ri(r, 60, 3500), 'SRV-WEB', 6, 'CRON[' + ri(r, 2000, 9000) + ']', '(www-data) CMD (php /var/www/moodle/admin/cli/cron.php)');
    L(ri(r, 100, 3500), 'SRV-DNS', 6, 'named[812]', 'zone school.local/IN: loaded serial 2026101301');
    L(ri(r, 100, 3500), 'NMS', 6, 'nms', 'poller: polling cycle completed, 15 devices');
    // DHCP leases handed out by the school's DHCP server (ISC dhcpd on SRV-DNS, requests relayed by the gateway 10.10.10.1)
    for (let i = 0, n = ri(r, 3, 6); i < n; i++) {
      const t = ri(r, 30, 3500), ip = ri(r, 20, 220), pc = ri(r, 100, 999);
      const mac = ['3c', '22', 'fb'].concat([1, 2, 3].map((j) => (16 + Math.floor(noise(seed, 'dhcp' + i, j) * 240)).toString(16))).join(':');
      L(t, 'SRV-DNS', 6, 'dhcpd[640]', `DHCPACK on 10.10.10.${ip} to ${mac} (PC-${pc}) via 10.10.10.1`);
    }
    logs.sort((a, b) => a.t - b.t || (a.dev < b.dev ? -1 : a.dev > b.dev ? 1 : 0));
    logs.forEach((x, i) => { x.id = i + 1; });

    /* traffic flows */
    const flows = [];
    PCS.forEach((pc) => {
      const m = (1.2 + r() * 2.6) * M;
      flows.push({ src: 'ISP', dst: pc, mean: m, key: pc + 'd' }, { src: pc, dst: 'ISP', mean: m / 6, key: pc + 'u' });
      flows.push({ src: 'SRV-FILE', dst: pc, mean: (0.4 + r() * 1.6) * M, key: pc + 'f', bursty: true });
      flows.push({ src: 'SRV-WEB', dst: pc, mean: 0.3 * M, key: pc + 'w' });
    });
    ['AP-1', 'AP-2'].forEach((ap) => { const m = (10 + r() * 10) * M; flows.push({ src: 'ISP', dst: ap, mean: m, key: ap + 'd' }, { src: ap, dst: 'ISP', mean: m / 5, key: ap + 'u' }); });
    ['PRN-1', 'PRN-2'].forEach((p) => flows.push({ src: 'SRV-FILE', dst: p, mean: 0.2 * M, key: p + 'p', bursty: true }));
    flows.push({ src: 'SRV-DNS', dst: 'R1', mean: 0.4 * M, key: 'dns' });
    extraFlows.forEach((f, i) => flows.push({ src: f.src, dst: f.dst, mean: f.demand, key: 'x' + i, t0: f.t0, t1: f.t1, flat: true }));
    flows.forEach((f) => { f.path = path(f.src, f.dst) || []; });
    const nodeUp = (n, s) => !devUp[n] || devUp[n][s];
    const inB = {}, outB = {}, errs = {};
    DEVICES.forEach((d) => (IFACES[d.id] || []).forEach((x) => { const k = d.id + '|' + x.name; inB[k] = new Float64Array(NSTEP); outB[k] = new Float64Array(NSTEP); errs[k] = new Float64Array(NSTEP); }));
    const util = LINKS.map(() => [new Float32Array(NSTEP), new Float32Array(NSTEP)]);
    const dem = new Float64Array(flows.length), load = LINKS.map(() => [0, 0]);
    for (let s = 0; s < NSTEP; s++) {
      const t = s * STEP;
      load.forEach((x) => { x[0] = 0; x[1] = 0; });
      flows.forEach((f, i) => {
        let d = 0;
        if (f.flat) { if (t >= f.t0 && t < f.t1) d = f.mean * (0.96 + 0.08 * noise(seed, f.key, s)); }
        else {
          const nz = noise(seed, f.key, s);
          d = f.mean * DIURNAL(s) * (f.bursty ? (nz < 0.8 ? 0.3 : 3.5) : 0.6 + 0.8 * nz);
        }
        if (d > 0 && !(nodeUp(f.src, s) && nodeUp(f.dst, s) && f.path.every((e) => linkUp[e.link][s] && nodeUp(e.from, s) && nodeUp(e.to, s)))) d = 0;
        dem[i] = d;
        if (d) f.path.forEach((e) => { load[e.link][e.dir] += d; });
      });
      flows.forEach((f, i) => {
        if (!dem[i]) return;
        let fac = 1;
        f.path.forEach((e) => { const c = speed[e.link] * 0.97; if (load[e.link][e.dir] > c) fac = Math.min(fac, c / load[e.link][e.dir]); });
        const a = dem[i] * fac;
        f.path.forEach((e) => {
          const [da, ia, db, ib] = LINKS[e.link];
          const [sd, si, rd, rI] = e.dir === 0 ? [da, ia, db, ib] : [db, ib, da, ia];
          if (outB[sd + '|' + si]) outB[sd + '|' + si][s] += a;
          if (inB[rd + '|' + rI]) inB[rd + '|' + rI][s] += a;
        });
      });
      LINKS.forEach((l, i) => {
        const up = linkUp[i][s] && nodeUp(l[0], s) && nodeUp(l[2], s);
        [[l[0], l[1]], [l[2], l[3]]].forEach(([d, x]) => {
          const k = d + '|' + x; if (!inB[k]) return;
          if (up) { inB[k][s] += 12e3 + 6e3 * noise(seed, k + 'i', s); outB[k][s] += 12e3 + 6e3 * noise(seed, k + 'o', s); }
          if (up && badLink[i][s]) errs[k][s] = Math.floor(25 + 160 * noise(seed, k + 'e', s));
        });
        const ka = l[0] + '|' + l[1], kb = l[2] + '|' + l[3];
        const ab = outB[ka] ? outB[ka][s] : inB[kb] ? inB[kb][s] : 0, ba = inB[ka] ? inB[ka][s] : outB[kb] ? outB[kb][s] : 0;
        util[i][0][s] = ab / speed[i]; util[i][1][s] = ba / speed[i];
      });
    }
    const cumErr = {};
    Object.keys(errs).forEach((k) => { const c = new Float64Array(NSTEP); let a = 0; for (let s = 0; s < NSTEP; s++) { a += errs[k][s]; c[s] = a; } cumErr[k] = c; });
    return { seed, speed, linkUp, devUp, svcUp, badLink, inB, outB, errs, cumErr, util, logs };
  }
  const stepOf = (t) => Math.max(0, Math.min(NSTEP - 1, Math.floor(t / STEP)));
  function ifaceOper(sim, dev, name, s) {
    const x = ifaceOf(dev, name); if (!x) return 0;
    const l = LINKS[x.link];
    return sim.linkUp[x.link][s] && (!sim.devUp[l[0]] || sim.devUp[l[0]][s]) && (!sim.devUp[l[2]] || sim.devUp[l[2]][s]) ? 1 : 0;
  }
  /* reachability of a device from the NMS (the poller) at step s */
  function reach(sim, dev, s) {
    if (dev === 'NMS') return { ok: !!sim.devUp.NMS[s], lat: 0.05, loss: 0 };
    const p = path('NMS', dev);
    if (!p) return { ok: false };
    let lat = 0.08, loss = 0;
    for (const e of p) {
      if (!sim.linkUp[e.link][s]) return { ok: false, at: e.link };
      if (sim.devUp[e.from] && !sim.devUp[e.from][s]) return { ok: false };
      if (sim.devUp[e.to] && !sim.devUp[e.to][s]) return { ok: false };
      const u = Math.max(sim.util[e.link][0][s], sim.util[e.link][1][s]);
      lat += 0.15 + (u > 0.7 ? Math.pow((Math.min(u, 1) - 0.7) / 0.3, 2) * 45 : 0);
      if (sim.badLink[e.link][s]) loss += 0.09;
    }
    return { ok: true, lat, loss };
  }

  /* ------------------------------------------------------------------ monitors */
  const MON_TYPES = ['icmp', 'tcp', 'snmp'];
  const LIM = { interval: [5, 3600], latWarn: [1, 10000], lossWarn: [0, 100], utilWarn: [1, 100] };
  function numIn(v, lo, hi) { if (v === '' || v == null) return null; const n = Number(v); return Number.isFinite(n) && n >= lo && n <= hi ? n : NaN; }
  function validateMonitor(m) {
    if (!m || typeof m !== 'object') return { ok: false, error: 'ข้อมูล monitor ไม่ถูกต้อง' };
    const type = String(m.type || '');
    if (!MON_TYPES.includes(type)) return { ok: false, error: 'เลือกชนิดการตรวจ (ICMP ping / TCP port / SNMP interface)' };
    const target = String(m.target || '');
    if (!own(DEV, target)) return { ok: false, error: 'เลือกอุปกรณ์เป้าหมาย' };
    const o = { type, target };
    if (type === 'tcp') {
      const p = numIn(m.port, 1, 65535);
      if (p == null || !Number.isInteger(p)) return { ok: false, error: 'TCP check ต้องระบุพอร์ต 1–65535' };
      o.port = p;
    }
    if (type === 'snmp') {
      const i = String(m.iface || '');
      if (!ifaceOf(target, i)) return { ok: false, error: `ไม่พบ interface "${i.slice(0, 20)}" บน ${target}` };
      o.iface = i;
    }
    const iv = numIn(m.interval, LIM.interval[0], LIM.interval[1]);
    if (iv == null || Number.isNaN(iv) || !Number.isInteger(iv)) return { ok: false, error: 'Poll interval ต้องเป็นจำนวนเต็ม 5–3600 วินาที' };
    o.interval = iv;
    const need = type === 'icmp' ? ['latWarn', 'lossWarn'] : type === 'tcp' ? ['latWarn'] : ['utilWarn'];
    const TH = { latWarn: 'threshold latency (ms)', lossWarn: 'threshold packet loss (%)', utilWarn: 'threshold utilization (%)' };
    for (const k of need) {
      const v = numIn(m[k], LIM[k][0], LIM[k][1]);
      if (v == null) return { ok: false, error: `กรอก ${TH[k]}` };
      if (Number.isNaN(v)) return { ok: false, error: `${TH[k]} ต้องอยู่ระหว่าง ${LIM[k][0]}–${LIM[k][1]}` };
      o[k] = v;
    }
    o.name = String(m.name || '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 40) || monName(o);
    return { ok: true, monitor: o };
  }
  function monName(o) { return o.type === 'icmp' ? `Ping ${o.target}` : o.type === 'tcp' ? `TCP ${o.port} ${o.target}` : `SNMP ${o.target} ${o.iface}`; }
  function measure(sim, mon, t, prevT) {
    const s = stepOf(t), key = mon.type + mon.target + (mon.port || '') + (mon.iface || '');
    const rc = reach(sim, mon.target, s);
    if (mon.type === 'icmp') {
      if (!rc.ok) return { loss: 100, lat: null, note: 'Request timed out' };
      let lost = 0, sum = 0;
      for (let i = 0; i < 5; i++) { if (noise(sim.seed, 'p' + key, t * 5 + i) < rc.loss) lost++; else sum += rc.lat * (0.85 + 0.3 * noise(sim.seed, 'l' + key, t * 5 + i)) + 0.1; }
      return { loss: lost * 20, lat: lost === 5 ? null : Math.round((sum / (5 - lost)) * 10) / 10 };
    }
    if (mon.type === 'tcp') {
      if (!rc.ok) return { open: false, lat: null, note: 'timeout (ไม่มีการตอบกลับ)' };
      const open = DEV[mon.target].ports.includes(mon.port) && (!sim.svcUp[mon.target + ':' + mon.port] || sim.svcUp[mon.target + ':' + mon.port][s]);
      if (!open) return { open: false, lat: null, note: 'connection refused (พอร์ตปิด / ไม่มีบริการ)' };
      let lat = rc.lat + 0.9 + 0.8 * noise(sim.seed, 't' + key, t);
      if (noise(sim.seed, 'r' + key, t) < rc.loss) lat += 1000;   // SYN retransmission after loss
      return { open: true, lat: Math.round(lat * 10) / 10 };
    }
    // snmp: average over the poll interval from counter deltas (like a real poller)
    if (!rc.ok) return { reach: false, util: null, note: 'SNMP timeout' };
    const oper = ifaceOper(sim, mon.target, mon.iface, s);
    const k = mon.target + '|' + mon.iface, x = ifaceOf(mon.target, mon.iface), sp = sim.speed[x.link];
    const s0 = prevT == null ? s : Math.min(s, stepOf(prevT) + 1);
    let si = 0, so = 0;
    for (let i = s0; i <= s; i++) { si += sim.inB[k][i]; so += sim.outB[k][i]; }
    const n = s - s0 + 1, inBps = si / n, outBps = so / n;
    const errDelta = sim.cumErr[k][s] - (prevT == null ? (s ? sim.cumErr[k][s - 1] : 0) : sim.cumErr[k][stepOf(prevT)]);
    return { reach: true, oper, inBps, outBps, util: Math.round((Math.max(inBps, outBps) / sp) * 1000) / 10, errDelta };
  }
  function evaluate(mon, m) {
    if (mon.type === 'icmp') { if (m.loss >= 100) return 'down'; return m.loss >= mon.lossWarn || m.lat >= mon.latWarn ? 'warn' : 'up'; }
    if (mon.type === 'tcp') { if (!m.open) return 'down'; return m.lat >= mon.latWarn ? 'warn' : 'up'; }
    if (!m.reach || !m.oper) return 'down';
    return m.util >= mon.utilWarn || m.errDelta > 0 ? 'warn' : 'up';
  }
  function poll(sim, mon, tEnd) {
    const end = Math.min(DURATION - 1, tEnd == null ? DURATION - 1 : tEnd), out = [];
    let prev = null;
    for (let t = 0; t <= end && out.length < 800; t += mon.interval) {
      const m = measure(sim, mon, t, prev);
      m.t = t; m.status = evaluate(mon, m);
      m.value = mon.type === 'snmp' ? m.util : m.lat;
      out.push(m); prev = t;
    }
    return out;
  }
  function ifaceRows(sim, dev, t) {
    const s = stepOf(t);
    const up = !sim.devUp[dev] || sim.devUp[dev][s];
    return (IFACES[dev] || []).map((x) => {
      const k = dev + '|' + x.name, sp = sim.speed[x.link];
      let ib = 0, ob = 0; for (let i = 0; i <= s; i++) { ib += sim.inB[k][i]; ob += sim.outB[k][i]; }
      return { name: x.name, desc: x.desc, speed: sp, oper: up ? ifaceOper(sim, dev, x.name, s) : null, inBps: up ? sim.inB[k][s] : null, outBps: up ? sim.outB[k][s] : null,
        util: up ? Math.round((Math.max(sim.inB[k][s], sim.outB[k][s]) / sp) * 1000) / 10 : null,
        inErr: up ? sim.cumErr[k][s] : null, inMB: up ? Math.round((ib * STEP) / 8 / 1e5) / 10 : null, outMB: up ? Math.round((ob * STEP) / 8 / 1e5) / 10 : null };
    });
  }
  function ifaceSeries(sim, dev, name) {
    const k = dev + '|' + name, x = ifaceOf(dev, name); if (!x) return null;
    const sp = sim.speed[x.link];
    const a = [], b = [];
    for (let s = 0; s < NSTEP; s++) { const up = !sim.devUp[dev] || sim.devUp[dev][s]; a.push(up ? (sim.inB[k][s] / sp) * 100 : null); b.push(up ? (sim.outB[k][s] / sp) * 100 : null); }
    return { inPct: a, outPct: b, speed: sp };
  }
  const SEV = ['emerg', 'alert', 'crit', 'err', 'warning', 'notice', 'info', 'debug'];
  function filterLogs(sim, f) {
    f = f || {};
    const text = String(f.text || '').toLowerCase().slice(0, 60);
    const sev = f.sev == null || f.sev === '' ? 7 : Number(f.sev);
    return sim.logs.filter((x) => (f.until == null || x.t <= f.until) && (!f.dev || x.dev === f.dev) && x.sev <= sev &&
      (f.from == null || x.t >= f.from) && (f.to == null || x.t <= f.to) && (!text || (x.dev + ' ' + x.fac + ' ' + x.msg).toLowerCase().includes(text)));
  }
  const logLine = (x) => `${fmtTime(x.t)} ${x.dev} ${/^[A-Z_]+-\d-/.test(x.fac) ? '%' + x.fac + ':' : x.fac + ':'} ${x.msg}`;

  /* ------------------------------------------------------------------ mini template engine (Jinja-like subset, no eval) */
  const TPL = { MAX_SRC: 8000, MAX_OUT: 20000, MAX_ITER: 1000, MAX_DEPTH: 6 };
  const BAD_NAMES = ['__proto__', 'prototype', 'constructor'];
  function TErr(line, msg) { const e = new Error(msg); e.tpl = true; e.line = line; return e; }
  function tplLex(src) {
    const toks = []; let i = 0, line = 1;
    const lines = (s) => { let n = 0; for (let k = 0; k < s.length; k++) if (s.charCodeAt(k) === 10) n++; return n; };
    while (i < src.length) {
      const j = src.slice(i).search(/\{[{%#]/);
      if (j < 0) { toks.push({ k: 'text', v: src.slice(i), line }); break; }
      let text = src.slice(i, i + j);
      const st = i + j, kind = src[st + 1];
      const close = kind === '{' ? '}}' : kind === '%' ? '%}' : '#}';
      const end = src.indexOf(close, st + 2);
      if (end < 0) throw TErr(line + lines(text), kind === '{' ? 'พบ {{ แต่ไม่มี }} ปิด' : kind === '%' ? 'พบ {% แต่ไม่มี %} ปิด' : 'พบ {# แต่ไม่มี #} ปิด');
      const inner = src.slice(st + 2, end);
      let after = end + 2;
      if (kind !== '{') {   // a block tag alone on its line removes the whole line (trim_blocks + lstrip_blocks)
        const nl = text.lastIndexOf('\n');
        const head = nl < 0 ? text : text.slice(nl + 1);
        const tail = /^[ \t]*(\n|$)/.exec(src.slice(after));
        const lineStart = st - head.length;
        if (/^[ \t]*$/.test(head) && tail && (lineStart === 0 || src[lineStart - 1] === '\n')) {
          text = text.slice(0, text.length - head.length); after += tail[0].length;
        }
      }
      if (text) toks.push({ k: 'text', v: text, line });
      line += lines(text);
      const tagLine = line;
      if (kind === '%' && /^\s*raw\s*$/.test(inner)) {
        const m = /\{%\s*endraw\s*%\}/.exec(src.slice(after));
        if (!m) throw TErr(tagLine, 'ไม่ได้ปิด {% raw %} (ต้องมี {% endraw %})');
        const raw = src.slice(after, after + m.index);
        toks.push({ k: 'text', v: raw, line: tagLine });
        const consumed = src.slice(st, after + m.index + m[0].length);
        line += lines(consumed);
        i = after + m.index + m[0].length;
        continue;
      }
      if (kind === '{') toks.push({ k: 'out', v: inner, line: tagLine });
      else if (kind === '%') toks.push({ k: 'tag', v: inner, line: tagLine });
      line += lines(src.slice(st, after));
      i = after;
    }
    return toks;
  }
  /* expression tokenizer + recursive-descent parser */
  function exLex(s, line) {
    const out = []; let i = 0;
    while (i < s.length) {
      const c = s[i];
      if (/\s/.test(c)) { i++; continue; }
      if (c === '"' || c === "'") {
        let j = i + 1, v = '';
        while (j < s.length && s[j] !== c) { if (s[j] === '\\' && j + 1 < s.length) { v += s[j + 1]; j += 2; } else v += s[j++]; }
        if (j >= s.length) throw TErr(line, 'ข้อความในเครื่องหมายคำพูดไม่ได้ปิด');
        out.push({ t: 'str', v }); i = j + 1; continue;
      }
      const num = /^\d+(\.\d+)?/.exec(s.slice(i)); if (num) { out.push({ t: 'num', v: Number(num[0]) }); i += num[0].length; continue; }
      const id = /^[A-Za-z_][A-Za-z0-9_]*/.exec(s.slice(i)); if (id) { out.push({ t: 'id', v: id[0] }); i += id[0].length; continue; }
      const op = /^(==|!=|<=|>=|<|>|\(|\)|\.|\||,)/.exec(s.slice(i)); if (op) { out.push({ t: 'op', v: op[0] }); i += op[0].length; continue; }
      throw TErr(line, `ใช้ตัวอักษร "${c}" ในนิพจน์ไม่ได้ (ใช้ได้: ชื่อตัวแปร, "ข้อความ", ตัวเลข, == != < > and or not in |filter)`);
    }
    return out;
  }
  const FILTERS = ['upper', 'lower', 'trim', 'default', 'join', 'length', 'first', 'last', 'replace'];
  function exParse(src, line) {
    const T = exLex(src, line); let p = 0;
    const peek = () => T[p], next = () => T[p++];
    const isKw = (w) => T[p] && T[p].t === 'id' && T[p].v === w;
    const isOp = (w) => T[p] && T[p].t === 'op' && T[p].v === w;
    const fail = () => TErr(line, T[p] ? `ไวยากรณ์ไม่ถูกต้อง: ไม่คาดว่าจะพบ "${T[p].v}"` : 'นิพจน์ไม่ครบ (จบกลางคัน)');
    function or() { let a = and(); while (isKw('or')) { next(); a = { t: 'or', a, b: and() }; } return a; }
    function and() { let a = not(); while (isKw('and')) { next(); a = { t: 'and', a, b: not() }; } return a; }
    function not() { if (isKw('not')) { next(); return { t: 'not', e: not() }; } return cmp(); }
    function cmp() {
      const a = fil();
      const x = peek();
      if (x && x.t === 'op' && ['==', '!=', '<', '>', '<=', '>='].includes(x.v)) { next(); return { t: 'cmp', op: x.v, a, b: fil() }; }
      if (isKw('in')) { next(); return { t: 'cmp', op: 'in', a, b: fil() }; }
      if (isKw('not') && T[p + 1] && T[p + 1].t === 'id' && T[p + 1].v === 'in') { p += 2; return { t: 'cmp', op: 'not in', a, b: fil() }; }
      return a;
    }
    function fil() {
      let e = prim();
      while (isOp('|')) {
        next(); const f = next();
        if (!f || f.t !== 'id') throw fail();
        if (!FILTERS.includes(f.v)) throw TErr(line, `ไม่รู้จัก filter "${f.v}" (ใช้ได้: ${FILTERS.join(', ')})`);
        const args = [];
        if (isOp('(')) {
          next();
          while (!isOp(')')) { const a = next(); if (!a || (a.t !== 'str' && a.t !== 'num')) throw TErr(line, `argument ของ filter "${f.v}" ต้องเป็นข้อความหรือตัวเลข`); args.push(a.v); if (isOp(',')) next(); else if (!isOp(')')) throw fail(); }
          next();
        }
        e = { t: 'filter', name: f.v, e, args };
      }
      return e;
    }
    function prim() {
      const x = next();
      if (!x) throw fail();
      if (x.t === 'str' || x.t === 'num') return { t: 'lit', v: x.v };
      if (x.t === 'op' && x.v === '(') { const e = or(); if (!isOp(')')) throw fail(); next(); return e; }
      if (x.t === 'id') {
        if (x.v === 'true' || x.v === 'True') return { t: 'lit', v: true };
        if (x.v === 'false' || x.v === 'False') return { t: 'lit', v: false };
        if (x.v === 'none' || x.v === 'None') return { t: 'lit', v: null };
        if (['and', 'or', 'not', 'in'].includes(x.v)) { p--; throw fail(); }
        const pathArr = [x.v];
        while (isOp('.')) { next(); const y = next(); if (!y || y.t !== 'id') throw fail(); pathArr.push(y.v); }
        if (isOp('(')) throw TErr(line, 'เรียกใช้ฟังก์ชันใน template ไม่ได้ (ใช้ได้เฉพาะตัวแปรและ filter)');
        for (const n of pathArr) if (BAD_NAMES.includes(n) || /^__/.test(n)) throw TErr(line, `ไม่อนุญาตให้ใช้ชื่อ "${n}"`);
        return { t: 'var', path: pathArr };
      }
      p--; throw fail();
    }
    if (!T.length) throw TErr(line, 'นิพจน์ว่างเปล่า');
    const e = or();
    if (p < T.length) throw fail();
    return e;
  }
  function tplParse(toks) {
    let i = 0;
    function block(ends, depth, openTag) {
      const nodes = [];
      while (i < toks.length) {
        const t = toks[i];
        if (t.k === 'text') { nodes.push({ k: 'text', v: t.v }); i++; continue; }
        if (t.k === 'out') {
          if (!t.v.trim()) throw TErr(t.line, '{{ }} ว่างเปล่า ต้องใส่ชื่อตัวแปร เช่น {{ hostname }}');
          nodes.push({ k: 'out', e: exParse(t.v, t.line), line: t.line }); i++; continue;
        }
        const m = /^\s*([A-Za-z_]+)\s*([\s\S]*?)\s*$/.exec(t.v);
        const kw = m ? m[1] : '';
        if (ends.includes(kw)) return { nodes, end: kw, tok: t, rest: m[2] };
        if (kw === 'for') {
          const f = /^([A-Za-z_][A-Za-z0-9_]*)\s+in\s+([\s\S]+)$/.exec(m[2]);
          if (!f) throw TErr(t.line, 'รูปแบบ for ไม่ถูกต้อง ต้องเป็น {% for v in vlans %}');
          if (BAD_NAMES.includes(f[1]) || f[1] === 'loop') throw TErr(t.line, `ใช้ชื่อตัวแปร "${f[1]}" ใน for ไม่ได้`);
          if (depth + 1 > TPL.MAX_DEPTH) throw TErr(t.line, `ซ้อน for/if ลึกเกิน ${TPL.MAX_DEPTH} ชั้น`);
          const it = exParse(f[2], t.line);
          i++;
          const body = block(['endfor'], depth + 1, t);
          if (!body.end) throw TErr(t.line, `ไม่ได้ปิด {% for %} ที่เปิดไว้ในบรรทัด ${t.line} (ต้องมี {% endfor %})`);
          i++;
          nodes.push({ k: 'for', v: f[1], it, body: body.nodes, line: t.line });
          continue;
        }
        if (kw === 'if') {
          if (depth + 1 > TPL.MAX_DEPTH) throw TErr(t.line, `ซ้อน for/if ลึกเกิน ${TPL.MAX_DEPTH} ชั้น`);
          const branches = []; let cond = exParse(m[2], t.line), els = null;
          i++;
          for (;;) {
            const b = block(['elif', 'else', 'endif'], depth + 1, t);
            if (!b.end) throw TErr(t.line, `ไม่ได้ปิด {% if %} ที่เปิดไว้ในบรรทัด ${t.line} (ต้องมี {% endif %})`);
            i++;
            if (cond === 'else') els = b.nodes; else branches.push({ c: cond, body: b.nodes });
            if (b.end === 'endif') break;
            if (cond === 'else') throw TErr(b.tok.line, 'หลัง {% else %} ต้องปิดด้วย {% endif %}');
            cond = b.end === 'else' ? 'else' : exParse(b.rest, b.tok.line);
          }
          nodes.push({ k: 'if', branches, els, line: t.line });
          continue;
        }
        if (['endfor', 'endif', 'elif', 'else', 'endraw'].includes(kw)) {
          if (openTag) { const ok2 = /^\s*(for|if)/.exec(openTag.v)[1]; throw TErr(openTag.line, `ไม่ได้ปิด {% ${ok2} %} ที่เปิดไว้ในบรรทัด ${openTag.line} ก่อนถึง {% ${kw} %} ในบรรทัด ${t.line} (ต้องมี {% end${ok2} %})`); }
          throw TErr(t.line, `พบ {% ${kw} %} โดยไม่มีคำสั่งเปิดคู่กัน`);
        }
        throw TErr(t.line, `ไม่รู้จักคำสั่ง {% ${(kw || t.v.trim()).slice(0, 20)} %} (ใช้ได้: for/endfor, if/elif/else/endif, raw/endraw)`);
      }
      return { nodes, end: null, open: openTag };
    }
    const b = block([], 0, null);
    return b.nodes;
  }
  const UNDEF = { undef: true };
  function tplRun(nodes, vars) {
    const scopes = [vars];
    let out = '', iter = 0;
    function lookup(pathArr, line) {
      let v = UNDEF;
      for (let k = scopes.length - 1; k >= 0; k--) if (own(scopes[k], pathArr[0])) { v = scopes[k][pathArr[0]]; break; }
      if (v === UNDEF) return { miss: pathArr[0], line };
      for (let j = 1; j < pathArr.length; j++) {
        if (v && typeof v === 'object' && !Array.isArray(v) && own(v, pathArr[j])) v = v[pathArr[j]];
        else return { miss: pathArr.slice(0, j + 1).join('.'), line };
      }
      return v;
    }
    const isMiss = (v) => v && typeof v === 'object' && own(v, 'miss');
    const missErr = (v) => TErr(v.line, `ไม่พบตัวแปร "${v.miss}" (ตรวจการสะกด หรือเพิ่มคอลัมน์ใน inventory)`);
    const numish = (v) => typeof v === 'number' || (typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v.trim()));
    const eq = (a, b) => (numish(a) && numish(b) ? Number(a) === Number(b) : String(a) === String(b));
    const truthy = (v) => !(v == null || v === false || v === '' || v === 0 || (Array.isArray(v) && !v.length));
    function ev(e, line) {
      switch (e.t) {
        case 'lit': return e.v;
        case 'var': { const v = lookup(e.path, line); if (isMiss(v)) throw missErr(v); return v; }
        case 'not': return !truthy(ev(e.e, line));
        case 'and': return truthy(ev(e.a, line)) && truthy(ev(e.b, line));
        case 'or': return truthy(ev(e.a, line)) || truthy(ev(e.b, line));
        case 'cmp': {
          const a = ev(e.a, line), b = ev(e.b, line);
          if (e.op === '==') return eq(a, b);
          if (e.op === '!=') return !eq(a, b);
          if (e.op === 'in' || e.op === 'not in') {
            const r = Array.isArray(b) ? b.some((x) => eq(x, a)) : typeof b === 'string' ? b.includes(String(a)) : false;
            return e.op === 'in' ? r : !r;
          }
          const x = numish(a) && numish(b) ? Number(a) : String(a), y = numish(a) && numish(b) ? Number(b) : String(b);
          return e.op === '<' ? x < y : e.op === '>' ? x > y : e.op === '<=' ? x <= y : x >= y;
        }
        case 'filter': {
          let v;
          if (e.name === 'default' && e.e.t === 'var') { v = lookup(e.e.path, line); if (isMiss(v) || v == null || v === '') return e.args.length ? e.args[0] : ''; return v; }
          v = ev(e.e, line);
          const s = () => (Array.isArray(v) ? v.join(',') : v == null ? '' : String(v));
          switch (e.name) {
            case 'upper': return s().toUpperCase();
            case 'lower': return s().toLowerCase();
            case 'trim': return s().trim();
            case 'default': return v == null || v === '' ? (e.args.length ? e.args[0] : '') : v;
            case 'join': return Array.isArray(v) ? v.join(e.args.length ? String(e.args[0]) : ',') : s();
            case 'length': return Array.isArray(v) ? v.length : s().length;
            case 'first': return Array.isArray(v) ? (v.length ? v[0] : '') : s().slice(0, 1);
            case 'last': return Array.isArray(v) ? (v.length ? v[v.length - 1] : '') : s().slice(-1);
            case 'replace': if (e.args.length < 2) throw TErr(line, 'filter replace ต้องมี 2 argument เช่น replace("-", "_")'); return s().split(String(e.args[0])).join(String(e.args[1]));
          }
        }
      }
      throw TErr(line, 'นิพจน์ไม่ถูกต้อง');
    }
    const clean = (v) => String(v).replace(/[\r\n\u2028\u2029]+/g, ' ').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '');
    function emit(s) { out += s; if (out.length > TPL.MAX_OUT) throw TErr(0, `ผลลัพธ์ของ template ยาวเกิน ${TPL.MAX_OUT} ตัวอักษร (วนลูปมากเกินไปหรือไม่?)`); }
    function run(list) {
      for (const n of list) {
        if (n.k === 'text') emit(n.v);
        else if (n.k === 'out') {
          const v = ev(n.e, n.line);
          if (v != null && typeof v === 'object' && !Array.isArray(v)) throw TErr(n.line, 'แสดงค่าที่เป็นกลุ่มข้อมูล (object) ตรง ๆ ไม่ได้ ให้เลือก field เช่น {{ row.hostname }}');
          emit(clean(Array.isArray(v) ? v.join(',') : v == null ? '' : v));
        } else if (n.k === 'for') {
          let list2 = ev(n.it, n.line);
          if (list2 == null || list2 === '') list2 = [];
          if (!Array.isArray(list2)) { if (typeof list2 === 'object') throw TErr(n.line, 'วนลูปได้เฉพาะรายการ (list) เช่น vlans'); list2 = [list2]; }
          const frame = Object.create(null); scopes.push(frame);
          for (let k = 0; k < list2.length; k++) {
            if (++iter > TPL.MAX_ITER) throw TErr(n.line, `วนลูปรวมเกิน ${TPL.MAX_ITER} รอบ`);
            frame[n.v] = list2[k];
            const loop = Object.create(null); loop.index = k + 1; loop.index0 = k; loop.first = k === 0; loop.last = k === list2.length - 1; loop.length = list2.length;
            frame.loop = loop;
            run(n.body);
          }
          scopes.pop();
        } else if (n.k === 'if') {
          let done = false;
          for (const b of n.branches) if (truthy(ev(b.c, n.line))) { run(b.body); done = true; break; }
          if (!done && n.els) run(n.els);
        }
      }
    }
    run(nodes);
    return out;
  }
  function tplRender(src, vars) {
    try {
      if (typeof src !== 'string') return { ok: false, error: { line: 0, msg: 'template ต้องเป็นข้อความ' } };
      if (src.length > TPL.MAX_SRC) return { ok: false, error: { line: 0, msg: `template ยาวเกิน ${TPL.MAX_SRC} ตัวอักษร` } };
      const nodes = tplParse(tplLex(src.replace(/\r\n?/g, '\n')));
      const v = Object.create(null);
      if (vars) Object.keys(vars).forEach((k) => { if (!BAD_NAMES.includes(k)) v[k] = vars[k]; });
      return { ok: true, text: tplRun(nodes, v) };
    } catch (e) {
      if (e && e.tpl) return { ok: false, error: { line: e.line || 0, msg: e.message } };
      return { ok: false, error: { line: 0, msg: 'template ไม่ถูกต้อง' } };
    }
  }
  function tplCheck(src) { try { tplParse(tplLex(String(src).replace(/\r\n?/g, '\n'))); return { ok: true }; } catch (e) { return { ok: false, error: { line: e.line || 0, msg: e.tpl ? e.message : 'template ไม่ถูกต้อง' } }; } }

  /* ------------------------------------------------------------------ inventory (CSV) */
  const INV = { MAX_SRC: 4000, MAX_ROWS: 30, MAX_COLS: 10, MAX_CELL: 120 };
  function csvSplit(line) {
    const out = []; let cur = '', q = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (q) { if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
      else if (c === '"') q = true; else if (c === ',') { out.push(cur); cur = ''; } else cur += c;
    }
    out.push(cur);
    return { cells: out.map((x) => x.trim()), open: q };
  }
  function parseInventory(src) {
    const errors = [], rows = [];
    if (typeof src !== 'string') return { ok: false, rows, errors: [{ line: 0, msg: 'inventory ต้องเป็นข้อความ' }], cols: [] };
    if (src.length > INV.MAX_SRC) return { ok: false, rows, errors: [{ line: 0, msg: `inventory ยาวเกิน ${INV.MAX_SRC} ตัวอักษร` }], cols: [] };
    const lines = src.replace(/\r\n?/g, '\n').split('\n');
    let cols = null;
    lines.forEach((raw, idx) => {
      const ln = idx + 1;
      if (!raw.trim() || /^\s*#/.test(raw)) return;
      const { cells, open } = csvSplit(raw);
      if (open) { errors.push({ line: ln, msg: 'เครื่องหมาย " ไม่ได้ปิด' }); return; }
      if (!cols) {
        cols = cells.map((c) => c.toLowerCase());
        if (cols.length > INV.MAX_COLS) errors.push({ line: ln, msg: `มีคอลัมน์ได้ไม่เกิน ${INV.MAX_COLS} คอลัมน์` });
        cols.forEach((c) => { if (!/^[a-z_][a-z0-9_]{0,30}$/.test(c) || BAD_NAMES.includes(c)) errors.push({ line: ln, msg: `ชื่อคอลัมน์ "${c.slice(0, 30)}" ใช้ไม่ได้ (ใช้ a-z, 0-9, _ และขึ้นต้นด้วยตัวอักษร)` }); });
        ['hostname', 'mgmt_ip'].forEach((c) => { if (!cols.includes(c)) errors.push({ line: ln, msg: `บรรทัดหัวตารางต้องมีคอลัมน์ ${c}` }); });
        if (new Set(cols).size !== cols.length) errors.push({ line: ln, msg: 'ชื่อคอลัมน์ซ้ำกัน' });
        return;
      }
      if (rows.length >= INV.MAX_ROWS) { if (rows.length === INV.MAX_ROWS) errors.push({ line: ln, msg: `inventory มีได้ไม่เกิน ${INV.MAX_ROWS} แถว` }); rows.length++; return; }
      if (cells.length !== cols.length) { errors.push({ line: ln, msg: `มี ${cells.length} ช่อง แต่หัวตารางมี ${cols.length} คอลัมน์ (vlans ให้คั่นด้วย ; เช่น 10;20;99)` }); return; }
      const v = Object.create(null);
      let bad = false;
      cols.forEach((c, k) => {
        let x = cells[k].slice(0, INV.MAX_CELL).replace(/[\u0000-\u001f\u007f]/g, '');
        if (c === 'vlans') {
          const parts = x.split(/[;|\s]+/).filter(Boolean);
          const nums = [];
          parts.forEach((p) => { if (/^\d{1,4}$/.test(p) && +p >= 1 && +p <= 4094) nums.push(+p); else { errors.push({ line: ln, msg: `VLAN "${p.slice(0, 10)}" ไม่ถูกต้อง (ต้องเป็นเลข 1–4094 คั่นด้วย ;)` }); bad = true; } });
          v.vlans = nums; v.vlan_list = nums.join(',');
        } else if (x.includes(';')) v[c] = x.split(';').map((s) => s.trim()).filter(Boolean);
        else v[c] = x;
      });
      if (!v.hostname) { errors.push({ line: ln, msg: 'ช่อง hostname ว่าง' }); bad = true; }
      if (v.mgmt_ip != null && !/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.test(String(v.mgmt_ip))) { errors.push({ line: ln, msg: `mgmt_ip "${String(v.mgmt_ip).slice(0, 20)}" ไม่ใช่ IPv4` }); bad = true; }
      if (rows.some((r) => r.hostname === v.hostname)) { errors.push({ line: ln, msg: `hostname ${v.hostname} ซ้ำกับแถวก่อนหน้า` }); bad = true; }
      if (!own(v, 'vlans')) { v.vlans = []; v.vlan_list = ''; }
      v.inventory_hostname = v.hostname;
      v._line = ln;
      if (!bad) rows.push(v);
    });
    if (rows.length > INV.MAX_ROWS) rows.length = INV.MAX_ROWS;
    if (!cols) errors.push({ line: 0, msg: 'inventory ว่าง: บรรทัดแรกต้องเป็นหัวตาราง เช่น hostname,mgmt_ip,role,vlans' });
    return { ok: errors.length === 0, rows, errors, cols: cols || [] };
  }
  const GLOBALS = { gateway: '10.10.99.1', mgmt_mask: '255.255.255.0', mgmt_vlan: 99, domain: 'school.local' };
  function varsFor(row) { const v = Object.create(null); Object.keys(GLOBALS).forEach((k) => { v[k] = GLOBALS[k]; }); Object.keys(row).forEach((k) => { if (k !== '_line') v[k] = row[k]; }); return v; }

  /* ------------------------------------------------------------------ simulated switch configuration (IOS-like subset) */
  const ACCESS = ['ACC-SW1', 'ACC-SW2', 'ACC-SW3', 'ACC-SW4', 'ACC-SW5'];
  const SW_IFS = ['Gi0/1', 'Gi0/2', 'Gi0/3', 'Gi0/4', 'Gi0/5', 'Gi0/6', 'Gi0/24'];
  function blank(id, model) {
    const ifaces = {};
    SW_IFS.forEach((n) => { ifaces[n] = { desc: '', shutdown: false, mode: null, accessVlan: 1, allowed: null, portfast: false }; });
    ifaces.Vlan1 = { desc: '', ip: null, mask: null, shutdown: true };
    return { id, model: model || 'WS-C2960X', hostname: 'Switch', vlans: { 1: 'default' }, ifaces, gateway: null, extra: [] };
  }
  const ipRe = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;
  const MASKS = ['255.255.255.0', '255.255.255.128', '255.255.255.192', '255.255.255.224', '255.255.255.240', '255.255.255.248', '255.255.255.252', '255.255.254.0', '255.255.252.0', '255.255.0.0', '255.0.0.0'];
  function normIf(s) {
    const m = /^(gigabitethernet|gigabit|gig|gi|g)\s*(\d+\/\d+)$/i.exec(s.replace(/\s+/g, ''));
    if (m) return 'Gi' + m[2];
    const v = /^(vlan|vl)\s*(\d{1,4})$/i.exec(s.replace(/\s+/g, ''));
    if (v && +v[2] >= 1 && +v[2] <= 4094) return 'Vlan' + (+v[2]);
    return null;
  }
  function vlanList(s) {
    const out = new Set();
    for (const part of String(s).split(',')) {
      const m = /^\s*(\d{1,4})(?:\s*-\s*(\d{1,4}))?\s*$/.exec(part);
      if (!m) return null;
      const a = +m[1], b = m[2] ? +m[2] : a;
      if (a < 1 || b > 4094 || b < a || b - a > 4094) return null;
      for (let x = a; x <= b; x++) out.add(x);
    }
    return [...out].sort((x, y) => x - y);
  }
  const OK_EXTRA = [/^no ip domain-lookup$/i, /^ip domain-name [\w.-]{1,60}$/i, /^service password-encryption$/i, /^spanning-tree mode (pvst|rapid-pvst|mst)$/i,
    /^logging host \d+\.\d+\.\d+\.\d+$/i, /^ntp server \d+\.\d+\.\d+\.\d+$/i, /^snmp-server community \S{1,30} (ro|rw)$/i, /^ip ssh version 2$/i,
    /^username \S{1,30} (privilege \d{1,2} )?secret \S{1,60}$/i, /^banner motd (\S)[^]{0,120}\1$/i, /^enable secret \S{1,60}$/i];
  const LINE_SUB = [/^login( local)?$/i, /^transport input (ssh|telnet|ssh telnet|none|all)$/i, /^password \S{1,40}$/i, /^exec-timeout \d{1,3}( \d{1,2})?$/i, /^logging synchronous$/i];
  const INVALID = "% Invalid input detected at '^' marker.";
  function apply(state, text, opts) {
    const st = state; const errors = [];
    const maxLines = (opts && opts.maxLines) || 400;
    const lines = String(text || '').replace(/\r\n?/g, '\n').split('\n');
    if (lines.length > maxLines) { errors.push({ line: 0, cmd: '', msg: `config ยาวเกิน ${maxLines} บรรทัด` }); return { state: st, errors }; }
    let mode = 'global', ctx = null;
    const err = (ln, cmd, msg) => { if (errors.length < 50) errors.push({ line: ln, cmd: cmd.slice(0, 80), msg }); };
    const global = (c, ln, raw) => {
      let m;
      if (/^(end|exit|configure terminal|conf t)$/i.test(c)) { mode = 'global'; return true; }
      if ((m = /^hostname (\S+)$/i.exec(c))) {
        if (!/^[A-Za-z][A-Za-z0-9-]{0,62}$/.test(m[1]) || /-$/.test(m[1])) { err(ln, raw, '% hostname ใช้ได้เฉพาะ A-Z a-z 0-9 และ - (ขึ้นต้นด้วยตัวอักษร)'); return true; }
        st.hostname = m[1]; mode = 'global'; return true;
      }
      if ((m = /^vlan (\d{1,4})$/i.exec(c))) { const n = +m[1]; if (n < 1 || n > 4094) { err(ln, raw, '% VLAN ต้องอยู่ระหว่าง 1–4094'); return true; } if (!own(st.vlans, n)) st.vlans[n] = n === 1 ? 'default' : 'VLAN' + String(n).padStart(4, '0'); mode = 'vlan'; ctx = n; return true; }
      if ((m = /^no vlan (\d{1,4})$/i.exec(c))) { const n = +m[1]; if (n === 1) { err(ln, raw, '% Default VLAN 1 may not be deleted.'); return true; } delete st.vlans[n]; mode = 'global'; return true; }
      if ((m = /^interface (.+)$/i.exec(c))) {
        const n = normIf(m[1]);
        if (!n || (!own(st.ifaces, n) && !/^Vlan/.test(n))) { err(ln, raw, `% Invalid interface "${m[1].slice(0, 30)}" (พอร์ตบน switch นี้: Gi0/1–Gi0/6, Gi0/24 และ interface VlanN)`); mode = 'skip'; return true; }
        if (!own(st.ifaces, n)) st.ifaces[n] = { desc: '', ip: null, mask: null, shutdown: false };
        mode = 'if'; ctx = n; return true;
      }
      if ((m = /^ip default-gateway (\S+)$/i.exec(c))) { if (!ipRe.test(m[1])) { err(ln, raw, '% IP address ไม่ถูกต้อง'); return true; } st.gateway = m[1]; mode = 'global'; return true; }
      if (/^no ip default-gateway$/i.test(c)) { st.gateway = null; mode = 'global'; return true; }
      if ((m = /^line (vty \d{1,2}( \d{1,2})?|con(sole)? 0)$/i.exec(c))) { mode = 'line'; ctx = m[1].toLowerCase(); addExtra('line ' + ctx); return true; }
      if (OK_EXTRA.some((re) => re.test(c))) { addExtra(c); mode = 'global'; return true; }
      return false;
    };
    function addExtra(l) { if (!st.extra.includes(l) && st.extra.length < 40) st.extra.push(l); }
    lines.forEach((raw, idx) => {
      const ln = idx + 1;
      const c = raw.trim().replace(/\s+/g, ' ');
      if (!c || /^!/.test(c)) { if (c) mode = 'global'; return; }
      let m;
      if (mode === 'vlan') {
        if ((m = /^name (\S{1,32})$/i.exec(c))) { st.vlans[ctx] = m[1]; return; }
        if (/^name /i.test(c)) { err(ln, raw, '% ชื่อ VLAN ต้องไม่มีช่องว่างและยาวไม่เกิน 32 ตัวอักษร'); return; }
      } else if (mode === 'if') {
        const f = st.ifaces[ctx], svi = /^Vlan/.test(ctx);
        if ((m = /^description (.{1,80})$/i.exec(c))) { f.desc = m[1]; return; }
        if (/^no description$/i.test(c)) { f.desc = ''; return; }
        if (/^shutdown$/i.test(c)) { f.shutdown = true; return; }
        if (/^no shutdown$/i.test(c)) { f.shutdown = false; return; }
        if ((m = /^ip address (\S+) (\S+)$/i.exec(c))) {
          if (!svi) { err(ln, raw, '% พอร์ต switch (Layer 2) ใส่ IP ไม่ได้ ให้ใส่ที่ interface VlanN'); return; }
          if (!ipRe.test(m[1]) || !MASKS.includes(m[2])) { err(ln, raw, '% IP address หรือ subnet mask ไม่ถูกต้อง'); return; }
          f.ip = m[1]; f.mask = m[2]; return;
        }
        if (/^no ip address$/i.test(c)) { if (svi) { f.ip = null; f.mask = null; } return; }
        if (!svi) {
          if ((m = /^switchport mode (access|trunk)$/i.exec(c))) { f.mode = m[1].toLowerCase(); return; }
          if ((m = /^switchport access vlan (\d{1,4})$/i.exec(c))) { const n = +m[1]; if (n < 1 || n > 4094) { err(ln, raw, INVALID); return; } f.accessVlan = n; if (!own(st.vlans, n)) st.vlans[n] = 'VLAN' + String(n).padStart(4, '0'); return; }
          if ((m = /^switchport trunk allowed vlan (add |remove )?(.+)$/i.exec(c))) {
            if (/^all$/i.test(m[2]) && !m[1]) { f.allowed = null; return; }
            const l = vlanList(m[2]); if (!l) { err(ln, raw, '% รายการ VLAN ไม่ถูกต้อง (เช่น 10,20,99)'); return; }
            const cur = f.allowed == null ? null : f.allowed.slice();
            if (!m[1]) f.allowed = l;
            else if (/add/i.test(m[1])) f.allowed = cur == null ? null : [...new Set(cur.concat(l))].sort((a, b) => a - b);
            else f.allowed = (cur == null ? vlanList('1-4094') : cur).filter((x) => !l.includes(x));
            return;
          }
          if ((m = /^switchport trunk native vlan (\d{1,4})$/i.exec(c))) { f.native = +m[1]; return; }
          if (/^spanning-tree portfast( edge)?$/i.test(c)) {
            if (/edge/i.test(c) && st.model === 'WS-C2950') { err(ln, raw, INVALID + ' (IOS รุ่นเก่าของ WS-C2950 ไม่รู้จัก "portfast edge")'); return; }
            f.portfast = true; return;
          }
          if (/^spanning-tree bpduguard enable$/i.test(c)) { f.bpduguard = true; return; }
          if (/^switchport/i.test(c)) { err(ln, raw, INVALID); return; }
        } else if (/^switchport/i.test(c)) { err(ln, raw, '% interface Vlan ไม่ใช่ switchport'); return; }
      } else if (mode === 'line') {
        if (LINE_SUB.some((re) => re.test(c))) { addExtra(' ' + c.toLowerCase().replace(/^password \S+/, 'password *****')); return; }
      } else if (mode === 'skip') {
        if (/^ /.test(raw)) return;   // sub-commands of an invalid interface are ignored (already reported)
      }
      if (global(c, ln, raw)) return;
      err(ln, raw, INVALID + ' (ไม่รู้จักคำสั่งนี้ในระบบจำลอง)');
    });
    return { state: st, errors };
  }
  function canon(o) {
    if (Array.isArray(o)) return '[' + o.map(canon).join(',') + ']';
    if (o && typeof o === 'object') return '{' + Object.keys(o).sort().map((k) => JSON.stringify(k) + ':' + canon(o[k])).join(',') + '}';
    return JSON.stringify(o === undefined ? null : o);
  }
  const equal = (a, b) => canon(a) === canon(b);
  function reachable(st, ip) {
    const svi = st.ifaces.Vlan99;
    const up = st.ifaces['Gi0/24'];
    return !!(svi && !svi.shutdown && svi.ip === ip && svi.mask === '255.255.255.0' && own(st.vlans, 99) && up && !up.shutdown && up.mode !== 'access' && (up.allowed == null || up.allowed.includes(99)));
  }
  const vlanSort = (st) => Object.keys(st.vlans).map(Number).sort((a, b) => a - b);
  const ifSort = (st) => Object.keys(st.ifaces).sort((a, b) => { const va = /^Vlan/.test(a), vb = /^Vlan/.test(b); if (va !== vb) return va ? 1 : -1; const na = a.match(/\d+/g).map(Number), nb = b.match(/\d+/g).map(Number); for (let i = 0; i < Math.max(na.length, nb.length); i++) if ((na[i] || 0) !== (nb[i] || 0)) return (na[i] || 0) - (nb[i] || 0); return 0; });
  function show(st, what) {
    const L = [];
    if (what === 'vlan') {
      L.push('VLAN Name                             Status    Ports', '---- -------------------------------- --------- -------------------------------');
      vlanSort(st).forEach((v) => {
        const ports = SW_IFS.filter((n) => st.ifaces[n].mode !== 'trunk' && st.ifaces[n].accessVlan === v && !(n === 'Gi0/24' && st.ifaces[n].mode !== 'access'));
        L.push(String(v).padEnd(5) + String(st.vlans[v]).padEnd(33) + 'active    ' + ports.join(', '));
      });
      return L.join('\n');
    }
    if (what === 'ipint') {
      L.push('Interface              IP-Address      OK? Method Status                Protocol');
      ifSort(st).forEach((n) => {
        const f = st.ifaces[n], svi = /^Vlan/.test(n);
        const status = f.shutdown ? 'administratively down' : svi ? (own(st.vlans, +n.slice(4)) ? 'up' : 'down') : 'up';
        L.push(n.padEnd(23) + String(svi && f.ip ? f.ip : 'unassigned').padEnd(16) + 'YES ' + (svi && f.ip ? 'manual ' : 'unset  ') + status.padEnd(22) + (status === 'up' ? 'up' : 'down'));
      });
      return L.join('\n');
    }
    L.push('! ระบบจำลอง: running-config ของ ' + st.id + ' (' + st.model + ')', 'hostname ' + st.hostname, '!');
    st.extra.filter((x) => !/^line |^ /.test(x)).forEach((x) => L.push(x));
    vlanSort(st).forEach((v) => { if (v !== 1) L.push('vlan ' + v, ' name ' + st.vlans[v], '!'); });
    ifSort(st).forEach((n) => {
      const f = st.ifaces[n], svi = /^Vlan/.test(n);
      L.push('interface ' + n);
      if (f.desc) L.push(' description ' + f.desc);
      if (svi) { L.push(f.ip ? ' ip address ' + f.ip + ' ' + f.mask : ' no ip address'); }
      else {
        if (f.mode) L.push(' switchport mode ' + f.mode);
        if (f.accessVlan !== 1) L.push(' switchport access vlan ' + f.accessVlan);
        if (f.allowed) L.push(' switchport trunk allowed vlan ' + compress(f.allowed));
        if (f.native) L.push(' switchport trunk native vlan ' + f.native);
        if (f.portfast) L.push(' spanning-tree portfast' + (st.model === 'WS-C2950' ? '' : ' edge'));
        if (f.bpduguard) L.push(' spanning-tree bpduguard enable');
      }
      if (f.shutdown) L.push(' shutdown');
      L.push('!');
    });
    if (st.gateway) L.push('ip default-gateway ' + st.gateway, '!');
    st.extra.filter((x) => /^line |^ /.test(x)).forEach((x) => L.push(x));
    L.push('end');
    return L.join('\n');
  }
  function compress(list) {
    const out = []; let i = 0;
    while (i < list.length) { let j = i; while (j + 1 < list.length && list[j + 1] === list[j] + 1) j++; out.push(j > i + 1 ? list[i] + '-' + list[j] : j === i + 1 ? list[i] + ',' + list[j] : String(list[i])); i = j + 1; }
    return out.join(',');
  }

  /* ------------------------------------------------------------------ a1: push template + inventory to the 5 access switches */
  const A1 = {
    gateway: '10.10.99.1',
    vlans: { 10: 'STUDENT', 20: 'TEACHER', 99: 'MGMT' },
    uplink: 'Gi0/24', uplinkDesc: 'Uplink to CORE-SW1',
    devices: ACCESS.map((id, i) => ({ id, ip: '10.10.99.' + (11 + i) }))
  };
  function push(invSrc, template, opts) {
    const inv = parseInventory(invSrc);
    const res = { inventory: inv, devices: [], errors: inv.errors.slice(0, 20) };
    const t0 = tplCheck(template);
    if (!t0.ok) { res.templateError = t0.error; }
    const seen = new Set();
    inv.rows.forEach((row) => {
      const id = String(row.hostname);
      if (!ACCESS.includes(id)) { res.errors.push({ line: row._line, msg: `ไม่พบอุปกรณ์ "${id.slice(0, 30)}" ในระบบจำลอง (push ได้เฉพาะ ${ACCESS.join(', ')})` }); return; }
      seen.add(id);
      const st = blank(id, opts && opts.models && opts.models[id]);
      const r = res.templateError ? { ok: false, error: res.templateError } : tplRender(template, varsFor(row));
      if (!r.ok) { res.devices.push({ id, ok: false, renderError: r.error, state: st, config: '' }); return; }
      const a = apply(st, r.text);
      res.devices.push({ id, ok: a.errors.length === 0, config: r.text, errors: a.errors, state: a.state });
    });
    res.missing = ACCESS.filter((id) => !seen.has(id));
    return res;
  }

  /* ------------------------------------------------------------------ a2: playbook over all access switches */
  const A2_TEMPLATE = [
    '{# change: add VLAN 30 for IoT devices on two access ports #}',
    'vlan 30',
    ' name LAB-IOT',
    'interface Gi0/24',
    ' switchport trunk allowed vlan {{ vlan_list }}',
    '{% for p in iot_ports %}',
    'interface {{ p }}',
    ' description IoT device',
    ' switchport mode access',
    ' switchport access vlan 30',
    ' spanning-tree portfast edge',
    '{% endfor %}'
  ].join('\n');
  const ACTIONS = ['backup', 'apply', 'verify_ping', 'verify_port', 'save', 'rollback'];
  const WHENS = ['success', 'failure', 'always'];
  function configured(id, ip, model, vlanNames) {
    const st = blank(id, model);
    st.hostname = id;
    Object.keys(vlanNames).forEach((v) => { st.vlans[v] = vlanNames[v]; });
    st.ifaces.Vlan99 = { desc: 'Management', ip, mask: '255.255.255.0', shutdown: false };
    const u = st.ifaces['Gi0/24']; u.desc = 'Uplink to CORE-SW1'; u.mode = 'trunk'; u.allowed = Object.keys(vlanNames).map(Number).sort((a, b) => a - b);
    ['Gi0/1', 'Gi0/2', 'Gi0/3', 'Gi0/4', 'Gi0/5', 'Gi0/6'].forEach((n) => { const f = st.ifaces[n]; f.mode = 'access'; f.accessVlan = 10; });
    st.gateway = '10.10.99.1';
    st.extra = ['ip ssh version 2', 'line vty 0 15', ' login local', ' transport input ssh'];
    return st;
  }
  function a2Setup(seed, override) {
    const r = rng('a2|' + String(seed || 'demo').slice(0, 40));
    const failIdx = ri(r, 0, 4), type = pick(r, ['mgmt_lost', 'cmd_reject']);
    const fail = override || { dev: ACCESS[failIdx], type };
    const rows = ['hostname,mgmt_ip,model,vlans,iot_ports'];
    const originals = {};
    ACCESS.forEach((id, i) => {
      const ip = '10.10.99.' + (11 + i);
      const model = fail.type === 'cmd_reject' && fail.dev === id ? 'WS-C2950' : 'WS-C2960X';
      const vl = fail.type === 'mgmt_lost' && fail.dev === id ? '10;20;30' : '10;20;30;99';
      rows.push([id, ip, model, vl, 'Gi0/3;Gi0/4'].join(','));
      originals[id] = configured(id, ip, model, { 10: 'STUDENT', 20: 'TEACHER', 99: 'MGMT' });
    });
    return { seed: String(seed || ''), inventory: rows.join('\n'), template: A2_TEMPLATE, originals, fail };
  }
  function validatePlaybook(pb) {
    if (!pb || typeof pb !== 'object' || !Array.isArray(pb.tasks)) return { ok: false, error: 'playbook ต้องมีรายการ task' };
    if (pb.tasks.length > 15) return { ok: false, error: 'playbook มีได้ไม่เกิน 15 task' };
    const tasks = [];
    for (const t of pb.tasks) {
      if (!t || typeof t !== 'object' || !ACTIONS.includes(t.action)) return { ok: false, error: 'มี task ที่ไม่รู้จัก' };
      const o = { action: t.action, when: WHENS.includes(t.when) ? t.when : 'success' };
      if (t.action === 'verify_ping') o.target = t.target === 'gateway' ? 'gateway' : 'mgmt';
      if (t.action === 'verify_port') { const p = Number(t.port); if (!Number.isInteger(p) || p < 1 || p > 65535) return { ok: false, error: 'verify_port ต้องระบุพอร์ต 1–65535' }; o.port = p; }
      tasks.push(o);
    }
    return { ok: true, playbook: { tasks, anyErrorsFatal: pb.anyErrorsFatal === true } };
  }
  const ACTION_TH = { backup: 'สำรอง running-config (backup)', apply: 'ใช้ template กับอุปกรณ์ (apply)', verify_ping: 'ตรวจด้วย ping (verify)', verify_port: 'ตรวจพอร์ต TCP (verify)', save: 'บันทึกลง startup-config (save)', rollback: 'ย้อนกลับเป็น backup (rollback)' };
  function runPlaybook(setup, pbIn) {
    const v = validatePlaybook(pbIn);
    if (!v.ok) return { ok: false, error: v.error };
    const pb = v.playbook;
    const inv = parseInventory(setup.inventory);
    const out = { ok: true, devices: [], stopped: false };
    let stop = false;
    for (const row of inv.rows) {
      const id = row.hostname, orig = setup.originals[id];
      const D = { id, ip: row.mgmt_ip, running: clone(orig), startup: clone(orig), backup: null, tasks: [], status: 'ok' };
      if (stop) { D.status = 'skipped'; D.tasks = pb.tasks.map((t) => ({ action: t.action, when: t.when, result: 'skipped', msg: 'ไม่ได้ทำเพราะ any_errors_fatal หยุด playbook แล้ว' })); out.devices.push(finish(D, orig)); continue; }
      let failed = false, rescued = false;
      for (const t of pb.tasks) {
        const runIt = t.when === 'always' || (t.when === 'success' && !failed) || (t.when === 'failure' && failed);
        const rec = { action: t.action, when: t.when, result: 'skipped', msg: '' };
        D.tasks.push(rec);
        if (!runIt) { rec.msg = failed ? 'ข้าม (มี task ก่อนหน้าล้มเหลว)' : 'ข้าม (ไม่มีอะไรล้มเหลว)'; continue; }
        let ok = true;
        if (t.action === 'backup') { D.backup = clone(D.running); rec.result = 'ok'; rec.msg = 'เก็บ running-config ไว้แล้ว (' + show(D.running).split('\n').length + ' บรรทัด)'; }
        else if (t.action === 'apply') {
          const r = tplRender(setup.template, varsFor(row));
          if (!r.ok) { ok = false; rec.msg = 'render ไม่สำเร็จ: ' + r.error.msg; }
          else {
            const a = apply(D.running, r.text);
            if (a.errors.length) { ok = false; rec.msg = `บรรทัด ${a.errors[0].line} "${a.errors[0].cmd.trim()}": ${a.errors[0].msg}`; }
            else { rec.result = 'changed'; rec.msg = 'ใช้ config ' + r.text.split('\n').filter((x) => x.trim()).length + ' บรรทัด'; }
          }
        } else if (t.action === 'verify_ping') {
          const tgt = t.target === 'gateway' ? '10.10.99.1' : row.mgmt_ip;
          if (reachable(D.running, row.mgmt_ip)) { rec.result = 'ok'; rec.msg = `ping ${tgt}: 5/5 replies`; }
          else { ok = false; rec.msg = t.target === 'gateway' ? `เชื่อมต่อ ${id} ไม่ได้ จึงสั่ง ping ${tgt} ไม่ได้ (timeout)` : `ping ${tgt}: Request timed out (100% loss)`; }
        } else if (t.action === 'verify_port') {
          if (t.port === 22 && reachable(D.running, row.mgmt_ip)) { rec.result = 'ok'; rec.msg = `TCP ${row.mgmt_ip}:22 เปิด (SSH)`; }
          else { ok = false; rec.msg = `TCP ${row.mgmt_ip}:${t.port} ` + (reachable(D.running, row.mgmt_ip) ? 'connection refused (พอร์ตนี้ไม่มีบริการบน switch)' : 'timeout'); }
        } else if (t.action === 'save') { D.startup = clone(D.running); rec.result = 'changed'; rec.msg = 'copy running-config startup-config'; }
        else if (t.action === 'rollback') {
          if (!D.backup) { ok = false; rec.msg = 'ไม่มี backup ให้ย้อนกลับ (ต้องมี task backup ก่อน apply)'; }
          else { D.running = clone(D.backup); rec.result = 'changed'; rec.msg = 'คืนค่า running-config จาก backup ผ่าน console server (out-of-band)'; if (failed) rescued = true; }
        }
        if (!ok) { rec.result = 'failed'; if (failed) rescued = false; failed = true; }
      }
      D.status = !failed ? 'ok' : rescued ? 'rolled_back' : 'failed';
      out.devices.push(finish(D, orig));
      if (pb.anyErrorsFatal && D.status === 'failed') { stop = true; out.stopped = true; }
    }
    return out;
    function finish(D, orig) {
      D.reachable = reachable(D.running, D.ip);
      D.hasChange = own(D.running.vlans, 30) && D.running.vlans[30] === 'LAB-IOT' && D.running.ifaces['Gi0/3'].accessVlan === 30 && D.running.ifaces['Gi0/4'].accessVlan === 30;
      D.sameAsOriginal = equal(D.running, orig);
      D.startupOriginal = equal(D.startup, orig);
      D.startupSaved = equal(D.startup, D.running);
      return D;
    }
  }

  return {
    VERSION, STEP, DURATION, NSTEP, DAY0, fmtTime, parseTime, rng, hashStr, noise,
    network, DEVICES: DEVICES.map((d) => d.id), CAUSES, SVC, SEV, ACCESS, A1, ACTIONS, WHENS, ACTION_TH, GLOBALS,
    scenario, simulate, validateMonitor, measure, evaluate, poll, monName, ifaceRows, ifaceSeries, ifaceOper, reach, filterLogs, logLine, stepOf,
    tpl: { render: tplRender, check: tplCheck, LIMITS: TPL },
    parseInventory, varsFor, INV_LIMITS: INV,
    dev: { blank, apply, show, reachable, equal, configured, normIf, vlanList },
    push, a2Setup, validatePlaybook, runPlaybook
  };
});
/* ======================================================================================================
 * Browser UI: window.NL_SIMS.netops (not run under Node)
 * ====================================================================================================== */
(function () {
  if (typeof window === 'undefined' || typeof document === 'undefined' || !window.NetOps) return;
  const N = window.NetOps;
  const P = 'nls-netops';
  const CSS = `
.${P}{--${P}-mono:"JetBrains Mono",Consolas,monospace;color:var(--ink);font-family:inherit;max-width:1100px;margin:0 auto;min-width:0}
.${P} *,.${P} *::before,.${P} *::after{box-sizing:border-box}
.${P} h2{font-size:24px;line-height:1.25;margin:0 0 6px}
.${P} h3{font-size:18px;margin:0 0 8px;line-height:1.35}
.${P} h4{font-size:16px;margin:12px 0 6px}
.${P} p{margin:0 0 8px}
.${P}-muted{color:var(--muted);font-size:15px}
.${P}-small{font-size:13px}
.${P}-card{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:14px 16px;margin:0 0 14px;min-width:0}
.${P}-simnote{border:1px solid var(--line);border-left:5px solid var(--blue);background:var(--field);border-radius:8px;padding:8px 12px;font-size:15px;margin:8px 0 0}
.${P}-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;background:var(--ink);color:var(--bg);border:1px solid var(--ink);border-radius:8px;padding:8px 14px;font:inherit;font-weight:600;font-size:15px;cursor:pointer;line-height:1.25;min-height:44px;min-width:44px}
.${P}-btn.${P}-ghost{background:transparent;color:var(--ink);border-color:var(--line)}
.${P}-btn.${P}-sm{padding:6px 10px;font-size:14px}
.${P}-btn[aria-pressed="true"]{background:var(--blue);border-color:var(--blue);color:var(--on-accent,#fff)}
.${P}-btn:disabled{opacity:.45;cursor:default}
.${P} :focus-visible{outline:3px solid var(--blue);outline-offset:2px}
.${P}-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.${P}-missions{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:8px;margin:0 0 14px}
.${P}-mbtn{display:flex;flex-direction:column;align-items:flex-start;text-align:left;gap:2px;background:var(--panel);color:var(--ink);border:1px solid var(--line);border-radius:10px;padding:9px 12px;font:inherit;cursor:pointer;min-width:0;min-height:44px}
.${P}-mbtn b{font-size:15px;line-height:1.3}
.${P}-mbtn span{font-size:13px;color:var(--muted)}
.${P}-mbtn.${P}-on{border-color:var(--blue);box-shadow:inset 0 0 0 2px var(--blue)}
.${P}-mbtn .${P}-best{color:var(--ok);font-weight:600}
.${P}-lvl{font-size:13px;font-weight:600;color:var(--muted)}
.${P}-tag{display:inline-block;border:1px solid var(--line);border-radius:999px;padding:1px 8px;font-size:13px;color:var(--muted);margin:0 4px 4px 0}
.${P}-story{border-left:4px solid var(--orange);background:var(--field);padding:8px 12px;border-radius:6px;margin:8px 0}
.${P}-list{margin:6px 0 8px;padding-left:22px}
.${P}-list li{margin:2px 0}
.${P}-clock{display:flex;flex-wrap:wrap;align-items:center;gap:8px 10px;background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:8px 12px;margin:0 0 10px}
.${P}-time{font:700 22px var(--${P}-mono);min-width:6.2em}
.${P}-clock input[type=range]{flex:1 1 200px;min-width:0;height:44px;accent-color:var(--blue)}
.${P}-tabs{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 10px;border-bottom:1px solid var(--line);padding-bottom:8px}
.${P}-tab{background:transparent;color:var(--ink);border:1px solid var(--line);border-radius:8px;padding:8px 12px;font:inherit;font-size:15px;font-weight:600;min-height:44px;cursor:pointer}
.${P}-tab[aria-selected="true"]{background:var(--blue);border-color:var(--blue);color:var(--on-accent,#fff)}
.${P}-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:10px}
.${P}-mon{border:1px solid var(--line);border-left:6px solid var(--muted);border-radius:10px;padding:8px 10px;background:var(--panel);min-width:0}
.${P}-mon.${P}-s-up{border-left-color:var(--ok)}
.${P}-mon.${P}-s-warn{border-left-color:var(--orange)}
.${P}-mon.${P}-s-down{border-left-color:var(--bad)}
.${P}-monhead{display:flex;justify-content:space-between;gap:8px;align-items:flex-start}
.${P}-monhead b{font-size:15px;overflow-wrap:anywhere}
.${P}-pill{display:inline-flex;align-items:center;gap:4px;border-radius:999px;padding:1px 9px;font-size:13px;font-weight:700;white-space:nowrap;border:1px solid currentColor}
.${P}-pill.${P}-s-up{color:var(--ok)}
.${P}-pill.${P}-s-warn{color:var(--orange)}
.${P}-pill.${P}-s-down{color:var(--bad)}
.${P}-pill.${P}-s-none{color:var(--muted)}
.${P}-pill.${P}-s-ok{color:var(--ok)}.${P}-pill.${P}-s-rolled_back{color:var(--orange)}.${P}-pill.${P}-s-failed{color:var(--bad)}.${P}-pill.${P}-s-skipped{color:var(--muted)}
.${P}-sum{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 10px}
.${P}-sum span{border:1px solid var(--line);border-radius:8px;padding:6px 10px;font-weight:600}
.${P}-svgbox{background:var(--field);border:1px solid var(--line);border-radius:8px;padding:4px;margin:6px 0 0;overflow:hidden}
.${P}-svgbox svg{display:block;width:100%;height:auto}
.${P}-mapbox{overflow-x:auto;-webkit-overflow-scrolling:touch;overscroll-behavior-x:contain}
.${P}-mapbox svg.${P}-map{min-width:640px}
.${P}-maphint{display:none;font-size:13px;color:var(--muted);margin:4px 0 0}
.${P}-gloss{margin:6px 0 0;padding-left:22px;font-size:15px}
.${P}-gloss li{margin:2px 0}
.${P}-chart text,.${P}-map text{font-family:var(--${P}-mono);fill:var(--muted)}
.${P}-ax{stroke:var(--line);stroke-width:1}
.${P}-ln{fill:none;stroke:var(--blue);stroke-width:2.2;stroke-linejoin:round}
.${P}-ln2{fill:none;stroke:var(--green);stroke-width:2;stroke-dasharray:6 3}
.${P}-th{stroke:var(--orange);stroke-width:1.5;stroke-dasharray:6 4}
.${P}-now{stroke:var(--ink);stroke-width:1.5;opacity:.55}
.${P}-b-up{fill:var(--ok)}.${P}-b-warn{fill:var(--orange)}.${P}-b-down{fill:var(--bad)}
.${P}-map .${P}-lk{stroke:var(--muted);stroke-width:2;opacity:.7}
.${P}-node rect{fill:var(--panel);stroke:var(--muted);stroke-width:2;stroke-dasharray:4 3}
.${P}-node text{fill:var(--ink);font-size:12px;font-weight:700}
.${P}-node.${P}-s-up rect{stroke:var(--ok);stroke-dasharray:none;fill:color-mix(in srgb,var(--ok) 14%,var(--panel))}
.${P}-node.${P}-s-warn rect{stroke:var(--orange);stroke-dasharray:none;fill:color-mix(in srgb,var(--orange) 18%,var(--panel))}
.${P}-node.${P}-s-down rect{stroke:var(--bad);stroke-dasharray:none;stroke-width:3;fill:color-mix(in srgb,var(--bad) 18%,var(--panel))}
.${P}-node{cursor:pointer}
.${P}-node:focus-visible rect,.${P}-node.${P}-sel rect{stroke:var(--blue);stroke-width:4}
.${P}-node:focus{outline:none}
.${P}-legend{display:flex;flex-wrap:wrap;gap:6px 14px;font-size:13px;color:var(--muted);margin:6px 0}
.${P}-legend i{display:inline-block;width:12px;height:12px;border-radius:3px;margin-right:4px;vertical-align:-1px}
.${P}-form{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:8px 12px;align-items:end;margin:6px 0 8px}
.${P}-form label,.${P}-fld{display:flex;flex-direction:column;gap:3px;font-size:14px;font-weight:600;min-width:0}
.${P} input[type=text],.${P} input[type=number],.${P} select,.${P} textarea{font:inherit;font-size:16px;font-weight:400;color:var(--ink);background:var(--field);border:1px solid var(--line);border-radius:8px;padding:8px 10px;min-height:44px;width:100%;min-width:0}
.${P} textarea{font-family:var(--${P}-mono);font-size:14px;line-height:1.45;resize:vertical;white-space:pre;overflow-wrap:normal;overflow-x:auto}
.${P}-tablewrap{overflow-x:auto;max-width:100%;-webkit-overflow-scrolling:touch}
.${P}-table{width:100%;border-collapse:collapse;font-size:14px;margin:6px 0}
.${P}-table th,.${P}-table td{border-bottom:1px solid var(--line);padding:5px 6px;text-align:left;vertical-align:top}
.${P}-table td.${P}-num,.${P}-table th.${P}-num{text-align:right;font-family:var(--${P}-mono);white-space:nowrap}
.${P}-table tr.${P}-hl td{background:color-mix(in srgb,var(--blue) 12%,transparent)}
.${P}-pre{font:13px/1.45 var(--${P}-mono);background:var(--term-bg,var(--field));color:var(--term-ink,var(--ink));border-radius:8px;padding:10px 12px;margin:6px 0;overflow:auto;max-height:420px;white-space:pre}
.${P}-logs{list-style:none;margin:6px 0;padding:0;font:13px/1.45 var(--${P}-mono);max-height:520px;overflow:auto;border:1px solid var(--line);border-radius:8px}
.${P}-logs li{display:flex;gap:8px;align-items:flex-start;padding:4px 8px;border-bottom:1px solid var(--line);overflow-wrap:anywhere;min-width:0}
.${P}-logs li.${P}-sev0,.${P}-logs li.${P}-sev1,.${P}-logs li.${P}-sev2,.${P}-logs li.${P}-sev3{color:var(--bad)}
.${P}-logs li.${P}-sev4{color:var(--orange)}
.${P}-logs li.${P}-picked{background:color-mix(in srgb,var(--blue) 14%,transparent)}
.${P}-logs label{display:inline-flex;align-items:center;justify-content:center;min-width:44px;min-height:40px;margin:-4px 0;cursor:pointer;flex:none}
.${P}-logs input{width:20px;height:20px;accent-color:var(--blue)}
.${P}-logid{color:var(--muted);flex:none}
.${P}-chips{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0}
.${P}-chip{display:inline-flex;align-items:center;gap:4px;border:1px solid var(--line);border-radius:999px;padding:0 0 0 10px;font:13px var(--${P}-mono);max-width:100%}
.${P}-chip span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:260px}
.${P}-chip button{min-width:44px;min-height:36px;border:0;background:transparent;color:var(--ink);font:inherit;cursor:pointer;border-radius:999px}
.${P}-radios{display:grid;gap:4px;margin:4px 0}
.${P}-radios label{display:flex;align-items:center;gap:8px;min-height:44px;font-weight:400;font-size:15px;flex-direction:row;cursor:pointer}
.${P}-radios input{width:20px;height:20px;flex:none;accent-color:var(--blue)}
.${P}-check{display:inline-flex;align-items:center;gap:8px;min-height:44px;cursor:pointer}
.${P}-check input{width:20px;height:20px;accent-color:var(--blue)}
.${P}-err{color:var(--bad);font-weight:600}
.${P}-ok{color:var(--ok);font-weight:600}
.${P}-warn{color:var(--orange);font-weight:600}
.${P}-score{font-size:22px;font-weight:700;margin:8px 0 4px}
.${P}-fb{margin:6px 0 0;padding-left:22px}
.${P}-fb li{margin:3px 0}
.${P}-task{display:grid;grid-template-columns:32px minmax(0,1.4fr) minmax(0,1fr) minmax(0,1fr) auto;gap:6px;align-items:center;border:1px solid var(--line);border-radius:10px;padding:6px 8px;margin:0 0 6px;background:var(--panel)}
.${P}-task b{font-family:var(--${P}-mono);text-align:center}
.${P}-taskbtns{display:flex;gap:4px}
.${P}-two{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:12px}
.${P}-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
@media (max-width:760px){
  .${P}-two{grid-template-columns:minmax(0,1fr)}
  .${P}-task{grid-template-columns:28px minmax(0,1fr) minmax(0,1fr);}
  .${P}-task .${P}-targ{grid-column:2/4}
  .${P}-task .${P}-taskbtns{grid-column:1/4;justify-content:flex-end}
  .${P}-grid{grid-template-columns:minmax(0,1fr)}
  .${P}-table{font-size:13px}
}
@media (max-width:700px){
  .${P}-maphint{display:block}
}
@media (max-width:520px){
  .${P}-card{padding:12px 10px}
  .${P} h2{font-size:20px}
  .${P}-time{font-size:18px}
  .${P}-tab{padding:8px 10px;font-size:14px}
  .${P}-missions{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}
}
`;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const LV = { easy: 'ง่าย', medium: 'ปานกลาง', hard: 'ยาก' };
  const MODE = { guided: 'ฝึกตามขั้นตอน (Guided Lab)', troubleshooting: 'ฝึกแก้ปัญหา (Troubleshooting)', independent: 'ฝึกเอง (Independent Lab)' };   // same labels as the other labs
  const ST = { up: 'Up', warn: 'Warning', down: 'Down', none: 'ไม่ได้ monitor' };
  const STM = { up: '●', warn: '▲', down: '■', none: '○' };
  const PB_ST = { ok: 'สำเร็จ (ok)', rolled_back: 'ย้อนกลับแล้ว (rolled back)', failed: 'ล้มเหลว (failed)', skipped: 'ไม่ได้ทำ (skipped)' };
  const PORTS = [[22, 'SSH'], [53, 'DNS'], [80, 'HTTP'], [139, 'NetBIOS'], [443, 'HTTPS'], [445, 'SMB'], [3389, 'RDP'], [9100, 'Printer RAW']];
  const TYPE_TH = { icmp: 'ICMP ping', tcp: 'TCP port', snmp: 'SNMP interface' };
  const NET = N.network();
  const DEVS = NET.devices;
  const DEVINFO = {}; DEVS.forEach((d) => { DEVINFO[d.id] = d; });
  const fmtBps = (b) => (b == null ? '–' : b >= 1e9 ? (b / 1e9).toFixed(2) + ' Gbps' : b >= 1e6 ? (b / 1e6).toFixed(1) + ' Mbps' : Math.round(b / 1e3) + ' kbps');
  const fmtSpeed = (b) => (b >= 1e9 ? b / 1e9 + ' Gbps' : b / 1e6 + ' Mbps');
  const DRAFT = 'netlab-netops-v1';
  const TABS_MON = [['map', 'แผนผัง'], ['monitors', 'Monitors'], ['dash', 'Dashboard'], ['ifaces', 'Interfaces'], ['logs', 'Syslog']];
  const TABS = { o1: TABS_MON, o2: TABS_MON, o3: TABS_MON, a1: [['inv', 'Inventory'], ['tpl', 'Template'], ['push', 'Push และอุปกรณ์']], a2: [['change', 'Change และ Inventory'], ['pb', 'Playbook'], ['run', 'ผลการรัน']] };
  const LIVE_TABS = ['map', 'dash', 'ifaces', 'logs'];
  const isMon = (mid) => mid === 'o1' || mid === 'o2' || mid === 'o3';
  const GEN = ['o2', 'o3', 'a2'];
  function defaultMonitors(mid) {
    if (mid === 'o1') return [];
    const l = ['R1', 'CORE-SW1', 'ACC-SW1', 'ACC-SW2', 'ACC-SW3', 'ACC-SW4', 'ACC-SW5', 'AP-1', 'AP-2', 'SRV-WEB', 'SRV-FILE', 'SRV-DNS']
      .map((d) => ({ type: 'icmp', target: d, interval: 30, latWarn: 100, lossWarn: 20, name: 'Ping ' + d }));
    l.push({ type: 'snmp', target: 'R1', iface: 'Gi0/0', interval: 60, utilWarn: 80, name: 'อินเทอร์เน็ต R1 Gi0/0' });
    return l;
  }
  const blankForm = () => ({ type: 'icmp', target: 'R1', port: '443', iface: '', interval: '60', latWarn: '', lossWarn: '', utilWarn: '', name: '', edit: -1, err: '' });

  function mount(root, ctx) {
    if (!document.getElementById(P + '-css')) { const st = document.createElement('style'); st.id = P + '-css'; st.textContent = CSS; document.head.appendChild(st); }
    ctx = ctx || {};
    const missions = Array.isArray(ctx.missions) ? ctx.missions : [];
    const best = {}; Object.keys(ctx.done || {}).forEach((k) => { best[k] = Object.assign({}, ctx.done[k]); });
    const MS = (id) => missions.find((m) => m.id === id) || null;
    let alive = true, playT = null, typingT = null;
    const S = { mid: missions[0] ? missions[0].id : 'o1', work: {}, sending: false };
    try {
      const d = JSON.parse(localStorage.getItem(DRAFT) || 'null');
      if (d && d.v === 1 && d.work && typeof d.work === 'object') {
        Object.keys(d.work).forEach((k) => { if (MS(k)) S.work[k] = d.work[k]; });
        if (MS(d.mid)) S.mid = d.mid;
      }
    } catch (e) { /* ignore broken draft */ }
    if (ctx.initial && MS(ctx.initial)) S.mid = ctx.initial;

    function W(mid) {
      mid = mid || S.mid;
      const m = MS(mid), st = (m && m.start) || {};
      const w = S.work[mid] || (S.work[mid] = {});
      const def = {
        tab: TABS[mid] ? TABS[mid][0][0] : 'map', problem: null, token: null, hints: 0, clock: mid === 'o1' ? 0 : N.DURATION - N.STEP,
        monitors: isMon(mid) ? defaultMonitors(mid) : [], form: blankForm(), mapSel: null, ifDev: 'R1', ifSel: 'Gi0/0',
        logF: { dev: '', sev: '', from: '', to: '', text: '' }, answer: {}, evidence: [],
        inventory: st.inventory || '', template: st.template || '', tplDev: '', devSel: 'ACC-SW1', devShow: 'run',
        playbook: st.playbook ? JSON.parse(JSON.stringify(st.playbook)) : { tasks: [], anyErrorsFatal: false }, a2Dev: '', result: null, err: ''
      };
      Object.keys(def).forEach((k) => { if (w[k] === undefined) w[k] = def[k]; });
      if (!Array.isArray(w.monitors)) w.monitors = [];
      if (!Array.isArray(w.evidence)) w.evidence = [];
      if (!w.form || typeof w.form !== 'object') w.form = blankForm();
      if (!w.playbook || !Array.isArray(w.playbook.tasks)) w.playbook = { tasks: [], anyErrorsFatal: false };
      return w;
    }
    function save() {
      try {
        const work = {};
        Object.keys(S.work).forEach((k) => { const w = S.work[k]; work[k] = {}; Object.keys(w).forEach((x) => { if (!['result', 'err', 'pushRes', 'runRes', 'busy'].includes(x)) work[k][x] = w[x]; }); });
        localStorage.setItem(DRAFT, JSON.stringify({ v: 1, mid: S.mid, work }));
      } catch (e) { /* storage unavailable */ }
    }

    /* ---------- simulation caches ---------- */
    const simCache = {}, pollCache = {};
    function seedOf(mid) { const w = W(mid); return mid === 'o1' ? 'o1-fixed' : w.problem && w.problem.seed; }
    function simFor(mid) {
      const seed = seedOf(mid); if (!seed) return null;
      const k = mid + '|' + seed;
      // keep only what the page shows (the story and the simulated data), not the scenario's incident list
      if (!simCache[k]) { const sc = N.scenario(mid, seed); simCache[k] = { S: { story: sc.story }, sim: N.simulate(sc) }; }
      return simCache[k];
    }
    function samples(mid, mon) {
      const k = mid + '|' + seedOf(mid) + '|' + JSON.stringify(mon);
      if (!pollCache[k]) { const sc = simFor(mid); pollCache[k] = sc ? N.poll(sc.sim, mon) : []; }
      return pollCache[k];
    }
    function statusAt(list, t) { let s = null; for (const x of list) { if (x.t <= t) s = x; else break; } return s; }
    function devStatus(mid, dev, t) {
      const order = { none: 0, up: 1, warn: 2, down: 3 };
      let st = 'none';
      W(mid).monitors.forEach((m) => { if (m.target !== dev) return; const s = statusAt(samples(mid, m), t); if (s && order[s.status] > order[st]) st = s.status; });
      return st;
    }
    const a2SetupCache = {};
    function a2Setup() { const p = W('a2').problem; if (!p) return null; return a2SetupCache[p.seed] || (a2SetupCache[p.seed] = N.a2Setup(p.seed)); }

    /* ---------- rendering ---------- */
    function render() {
      const fk = document.activeElement && root.contains(document.activeElement) ? document.activeElement.getAttribute('data-fk') : null;
      const w = W();
      root.innerHTML = `<div class="${P}">${head()}${missionList()}${brief()}${needsProblem() ? problemCard() : (isMon(S.mid) ? clockBar() : '') + tabs() + `<div role="tabpanel" id="${P}-panel" aria-labelledby="${P}-tab-${esc(w.tab)}" data-part="panel">${panel()}</div>` + submitCard()}</div>`;
      if (fk) { const el = root.querySelector(`[data-fk="${CSS_ESC(fk)}"]`); if (el && !el.disabled) el.focus({ preventScroll: true }); }
      save();
    }
    const CSS_ESC = (s) => (window.CSS && CSS.escape ? CSS.escape(s) : String(s).replace(/"/g, '\\"'));
    /* time-dependent parts only (clock ticks, slider): keeps form fields and focus untouched */
    function renderLive() {
      const w = W();
      const tEl = root.querySelector('[data-part="time"]'); if (tEl) tEl.textContent = N.fmtTime(w.clock);
      const rg = root.querySelector('[data-in="clock"]'); if (rg && document.activeElement !== rg) rg.value = String(w.clock);
      if (rg) rg.setAttribute('aria-valuetext', N.fmtTime(w.clock));
      const live = root.querySelector('[data-part="live"]');
      if (live && LIVE_TABS.includes(w.tab)) live.innerHTML = liveBody();
      const pl = root.querySelector('[data-act="clk-play"]'); if (pl) { pl.textContent = playT ? 'หยุด' : 'เล่น'; pl.setAttribute('aria-pressed', playT ? 'true' : 'false'); }
      save();
    }

    function head() {
      return `<div class="${P}-card"><h2>ห้องปฏิบัติการ Network Monitoring และ Automation</h2>
<p class="${P}-muted">เฝ้าระวังเครือข่าย (ping, TCP port, SNMP, syslog) และทำงานอัตโนมัติด้วย inventory, template และ playbook บนเครือข่ายโรงเรียนขนาดเล็ก</p>
<p class="${P}-simnote"><b>นี่คือการจำลองทั้งหมด:</b> เครือข่ายโรงเรียน (router, core switch, access switch, server, AP, printer) และนาฬิกา 08:00–09:00 เป็นข้อมูลจำลอง ping, TCP check, SNMP polling, push และ playbook ไม่ได้ติดต่ออุปกรณ์หรือเครื่องจริงใด ๆ</p>
<details><summary class="${P}-muted" style="cursor:pointer;min-height:44px;display:flex;align-items:center">วิธีใช้งาน</summary><ol class="${P}-list">
<li><b>Monitoring (o1–o3):</b> เพิ่ม monitor ในแท็บ Monitors แล้วเลื่อนเวลาจำลองด้วยแถบนาฬิกา (เล่น, +1 นาที, +10 นาที หรือลากแถบเวลา) ระบบคำนวณผลการ poll ทุกช่วง interval ให้อัตโนมัติ ผลเหมือนเดิมทุกครั้งสำหรับสถานการณ์เดียวกัน</li>
<li>Dashboard แสดงสถานะ Up / Warning / Down และกราฟตามเวลา, Interfaces แสดง counter (bps, utilization, errors), Syslog กรองตามอุปกรณ์ ความรุนแรง และเวลาได้</li>
<li><b>Automation (a1–a2):</b> เขียน inventory และ template แล้ว Push (จำลอง) หรือสร้าง playbook แล้วกด Run ดูผลรายอุปกรณ์ และดู running-config ของ switch จำลองได้</li>
<li>กด "ตรวจคำตอบ / ส่งงาน" ด้านล่าง เซิร์ฟเวอร์จะคำนวณผลใหม่จากงานของคุณเองเพื่อให้คะแนน</li></ol></details>
<p style="margin:8px 0 0"><b>คำศัพท์ที่ใช้ในแลปนี้</b></p><ul class="${P}-gloss">
<li><b>Poll interval</b> = รอบเวลาที่ระบบ monitoring เข้าไปตรวจอุปกรณ์ซ้ำ เช่น ทุก 60 วินาที</li>
<li><b>Threshold</b> = ค่าขีดจำกัดที่ตั้งไว้ ถ้าค่าที่วัดได้ถึงค่านี้ระบบจะแจ้งเตือน (Warning) เช่น latency ≥ 100 ms</li>
<li><b>Top talker</b> = เครื่องหรือพอร์ตที่รับ/ส่งข้อมูลมากที่สุดในช่วงเวลานั้น</li>
<li><b>Playbook</b> = รายการขั้นตอนอัตโนมัติ (task) ที่สั่งให้ทำกับอุปกรณ์ทีละตัวตามลำดับ เช่น สำรอง config → ตั้งค่า → ตรวจสอบ → ย้อนกลับเมื่อผิดพลาด</li></ul></div>`;
    }
    function missionList() {
      let s = `<nav class="${P}-missions" aria-label="รายการภารกิจ">`;
      for (const m of missions) {
        const b = best[m.id], st = m.start || {};
        const sc = b && b.best != null && b.attempts !== 0 ? `<span class="${P}-best">คะแนนดีที่สุด ${b.best}/${b.max || m.max}</span>` : '<span>ยังไม่ทำ</span>';
        s += `<button type="button" class="${P}-mbtn${S.mid === m.id ? ' ' + P + '-on' : ''}" data-act="mission" data-id="${esc(m.id)}" data-fk="m-${esc(m.id)}" aria-current="${S.mid === m.id}">
<span class="${P}-lvl">${esc(m.id)} · ${LV[m.level] || ''} · ${esc(MODE[st.mode] || '')}${st.week ? ' · สัปดาห์ ' + st.week : ''}</span><b>${esc(m.title)}</b>${sc}</button>`;
      }
      return s + '</nav>';
    }
    function brief() {
      const m = MS(S.mid); if (!m) return '';
      const w = W(), st = m.start || {};
      let s = `<section class="${P}-card"><h3>${esc(m.id)}: ${esc(m.title)}</h3><p>${esc(m.desc)}</p>`;
      s += `<p><span class="${P}-tag">${LV[m.level]}</span><span class="${P}-tag">${esc(MODE[st.mode] || '')}</span>${st.week ? `<span class="${P}-tag">สัปดาห์ที่ ${st.week}</span>` : ''}<span class="${P}-tag">${m.max} คะแนน</span></p>`;
      if (S.mid === 'o1' && st.services) s += `<p><b>บริการสำคัญ 6 รายการที่ต้อง monitor</b></p><ol class="${P}-list">${st.services.map((x) => `<li>${esc(x.th)}</li>`).join('')}</ol>`;
      if (st.rules) s += `<p><b>ข้อกำหนด</b></p><ul class="${P}-list">${st.rules.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`;
      if ((S.mid === 'o2' || S.mid === 'o3') && w.problem) { const sc = simFor(S.mid); if (sc) s += `<div class="${P}-story"><b>เรื่องที่ได้รับแจ้ง:</b> ${esc(sc.S.story)}<br><span class="${P}-muted">ตอนนี้เวลา 09:00 ย้อนเวลาดูข้อมูลที่เก็บไว้ได้ตั้งแต่ 08:00 (monitor ที่เพิ่มใหม่จะเห็นข้อมูลย้อนหลังด้วย เพื่อให้ฝึกได้ในเวลาสั้น)</span></div>`; }
      if (S.mid === 'a1' && st.devices) {
        s += `<p><b>ผลลัพธ์ที่ต้องได้บน switch แต่ละตัว</b></p><ul class="${P}-list"><li>hostname ตามชื่ออุปกรณ์ และ management IP ที่ interface Vlan99 (mask 255.255.255.0, no shutdown)</li>
<li>VLAN ${Object.keys(st.vlans).map((v) => `${v} (${esc(st.vlans[v])})`).join(', ')} พร้อมชื่อ VLAN</li><li>uplink ${esc(st.uplink)}: description "${esc(st.uplinkDesc)}", เป็น trunk ที่อนุญาต VLAN 10,20,99</li><li>ip default-gateway ${esc(st.gateway)}</li></ul>
<div class="${P}-tablewrap"><table class="${P}-table"><thead><tr><th>อุปกรณ์</th><th>Management IP</th></tr></thead><tbody>${st.devices.map((d) => `<tr><td>${esc(d.id)}</td><td>${esc(d.ip)}</td></tr>`).join('')}</tbody></table></div>`;
      }
      const hints = (m.hints || []).slice(0, w.hints);
      s += `<div class="${P}-row"><button type="button" class="${P}-btn ${P}-ghost" data-act="hint" data-fk="hint" ${w.hints >= (m.hints || []).length ? 'disabled' : ''}>คำใบ้ (${w.hints}/${(m.hints || []).length})</button>
${GEN.includes(S.mid) && w.problem ? `<button type="button" class="${P}-btn ${P}-ghost" data-act="newp" data-fk="newp">สถานการณ์ใหม่</button>` : ''}
<button type="button" class="${P}-btn ${P}-ghost" data-act="reset" data-fk="reset">เริ่มภารกิจนี้ใหม่</button></div>`;
      if (hints.length) s += `<ol class="${P}-list">${hints.map((h) => `<li>${esc(h)}</li>`).join('')}</ol>`;
      return s + '</section>';
    }
    const needsProblem = () => GEN.includes(S.mid) && !W().problem;
    function problemCard() {
      const w = W();
      return `<section class="${P}-card" aria-live="polite"><h3>สถานการณ์ของคุณ</h3><p>ภารกิจนี้สุ่มสถานการณ์เฉพาะของแต่ละคน ระบบจะสร้างให้อัตโนมัติ</p>
${w.err ? `<p class="${P}-err">${esc(w.err)}</p>` : `<p class="${P}-muted">${w.busy ? 'กำลังสร้างสถานการณ์…' : ''}</p>`}
<button type="button" class="${P}-btn" data-act="newp" data-fk="newp" ${w.busy ? 'disabled' : ''}>${w.err ? 'ลองอีกครั้ง' : 'สร้างสถานการณ์'}</button></section>`;
    }
    function clockBar() {
      const w = W();
      return `<div class="${P}-clock" role="group" aria-label="นาฬิกาจำลอง"><span class="${P}-muted ${P}-small">เวลาจำลอง</span><b class="${P}-time" data-part="time" aria-live="off">${N.fmtTime(w.clock)}</b>
<button type="button" class="${P}-btn ${P}-ghost ${P}-sm" data-act="clk-reset" data-fk="clk-reset" aria-label="กลับไป 08:00">08:00</button>
<button type="button" class="${P}-btn ${P}-sm" data-act="clk-play" data-fk="clk-play" aria-pressed="${playT ? 'true' : 'false'}">${playT ? 'หยุด' : 'เล่น'}</button>
<button type="button" class="${P}-btn ${P}-ghost ${P}-sm" data-act="clk-add" data-v="60" data-fk="clk-1">+1 นาที</button>
<button type="button" class="${P}-btn ${P}-ghost ${P}-sm" data-act="clk-add" data-v="600" data-fk="clk-10">+10 นาที</button>
<button type="button" class="${P}-btn ${P}-ghost ${P}-sm" data-act="clk-end" data-fk="clk-end">09:00</button>
<label class="${P}-sr" for="${P}-range">เลื่อนเวลาจำลอง</label><input id="${P}-range" type="range" min="0" max="${N.DURATION - N.STEP}" step="${N.STEP}" value="${w.clock}" data-in="clock" data-fk="clock" aria-valuetext="${N.fmtTime(w.clock)}"></div>`;
    }
    function tabs() {
      const w = W(); const list = TABS[S.mid] || [];
      return `<div class="${P}-tabs" role="tablist" aria-label="ส่วนของห้องปฏิบัติการ">${list.map(([id, th]) => `<button type="button" role="tab" id="${P}-tab-${id}" class="${P}-tab" aria-selected="${w.tab === id}" aria-controls="${P}-panel" tabindex="${w.tab === id ? 0 : -1}" data-act="tab" data-id="${id}" data-fk="tab-${id}">${esc(th)}${id === 'monitors' ? ' (' + w.monitors.length + ')' : ''}</button>`).join('')}</div>`;
    }
    function panel() {
      const w = W();
      switch (w.tab) {
        case 'monitors': return monitorsPanel();
        case 'map': case 'dash': case 'ifaces': case 'logs': return `<section class="${P}-card">${liveCtl()}<div data-part="live">${liveBody()}</div></section>`;
        case 'inv': return invPanel();
        case 'tpl': return tplPanel();
        case 'push': return pushPanel();
        case 'change': return changePanel();
        case 'pb': return pbPanel();
        case 'run': return runPanel();
      }
      return '';
    }

    /* ---------- monitoring: controls that do not depend on time ---------- */
    const devOptions = (sel, filter, blank) => (blank ? `<option value="">${esc(blank)}</option>` : '') + DEVS.filter(filter || (() => true)).map((d) => `<option value="${esc(d.id)}"${d.id === sel ? ' selected' : ''}>${esc(d.id)} (${esc(d.ip)})</option>`).join('');
    const ifOptions = (dev, sel, blank) => (blank ? `<option value="">${esc(blank)}</option>` : '') + (NET.ifaces[dev] || []).map((x) => `<option value="${esc(x.name)}"${x.name === sel ? ' selected' : ''}>${esc(x.name)} — ${esc(x.desc)}</option>`).join('');
    function liveCtl() {
      const w = W();
      if (w.tab === 'map') return `<h3>แผนผังเครือข่ายโรงเรียน (จำลอง)</h3><p class="${P}-muted">สีของอุปกรณ์มาจาก monitor ของคุณ ณ เวลาจำลองปัจจุบัน อุปกรณ์ที่ยังไม่มี monitor เป็นเส้นประสีเทา แตะ/กด Enter ที่อุปกรณ์เพื่อดูรายละเอียด</p>`;
      if (w.tab === 'dash') return `<h3>Dashboard</h3>`;
      if (w.tab === 'ifaces') return `<h3>Interface counters (SNMP)</h3><div class="${P}-form"><label>อุปกรณ์<select data-in="ifdev" data-fk="ifdev">${devOptions(w.ifDev)}</select></label></div>`;
      if (w.tab === 'logs') {
        const f = w.logF;
        return `<h3>Syslog</h3><p class="${P}-muted">log จากอุปกรณ์ทุกตัวส่งมาที่เครื่อง NMS แสดงเฉพาะที่เกิดก่อนเวลาจำลองปัจจุบัน${S.mid === 'o2' ? ' · กดช่องสี่เหลี่ยมหน้าบรรทัดเพื่อเลือกเป็นหลักฐาน' : ''}</p>
<div class="${P}-form"><label>อุปกรณ์<select data-lf="dev" data-fk="lf-dev">${devOptions(f.dev, null, 'ทุกอุปกรณ์')}</select></label>
<label>ความรุนแรง (severity)<select data-lf="sev" data-fk="lf-sev"><option value="">ทุกระดับ (0–7)</option>${N.SEV.map((n, i) => `<option value="${i}"${String(f.sev) === String(i) ? ' selected' : ''}>${i} ${n} หรือรุนแรงกว่า</option>`).join('')}</select></label>
<label>ตั้งแต่เวลา<input type="text" inputmode="numeric" placeholder="08:00" data-lf="from" data-fk="lf-from" value="${esc(f.from)}"></label>
<label>ถึงเวลา<input type="text" inputmode="numeric" placeholder="09:00" data-lf="to" data-fk="lf-to" value="${esc(f.to)}"></label>
<label>ค้นหาข้อความ<input type="text" data-lf="text" data-fk="lf-text" value="${esc(f.text)}" placeholder="เช่น UPDOWN"></label>
<div class="${P}-fld"><button type="button" class="${P}-btn ${P}-ghost" data-act="lf-clear" data-fk="lf-clear">ล้างตัวกรอง</button></div></div>`;
      }
      return '';
    }
    function liveBody() {
      const w = W(), sc = simFor(S.mid);
      if (!sc) return '';
      if (w.tab === 'map') return mapView(sc);
      if (w.tab === 'dash') return dashView();
      if (w.tab === 'ifaces') return ifaceView(sc);
      if (w.tab === 'logs') return logView(sc);
      return '';
    }
    /* ---------- topology map ---------- */
    const POS = { ISP: [320, 22], R1: [320, 72], 'CORE-SW1': [320, 140], 'SRV-WEB': [560, 92], 'SRV-FILE': [560, 136], 'SRV-DNS': [560, 180], NMS: [560, 224],
      'ACC-SW1': [64, 228], 'ACC-SW2': [168, 228], 'ACC-SW3': [272, 228], 'ACC-SW4': [376, 228], 'ACC-SW5': [470, 280], 'PRN-1': [44, 300], 'AP-1': [148, 300], 'PRN-2': [252, 300], 'AP-2': [356, 300] };
    function mapView() {
      const w = W(), t = w.clock;
      // on a phone the map keeps its native size (readable 12px labels, 92x28 nodes) and scrolls sideways inside its own box
      let s = `<p class="${P}-maphint">เลื่อนแผนผังไปทางซ้าย-ขวาได้ (แสดงขนาดจริงเพื่อให้อ่านชื่ออุปกรณ์ได้)</p><div class="${P}-svgbox ${P}-mapbox" tabindex="0" role="region" aria-label="แผนผังเครือข่าย (เลื่อนซ้าย-ขวาได้)"><svg class="${P}-map" viewBox="0 0 640 342" width="640" height="342" role="group" aria-label="แผนผังเครือข่ายจำลอง">`;
      NET.links.forEach((l) => { const a = POS[l.a], b = POS[l.b]; if (a && b) s += `<line class="${P}-lk" x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}"/>`; });
      s += `<text x="${POS.ISP[0]}" y="${POS.ISP[1] + 4}" text-anchor="middle" font-size="13">Internet (ISP)</text>`;
      DEVS.forEach((d) => {
        const p = POS[d.id]; if (!p) return;
        const st = devStatus(S.mid, d.id, t);
        s += `<g class="${P}-node ${P}-s-${st}${w.mapSel === d.id ? ' ' + P + '-sel' : ''}" tabindex="0" role="button" data-act="map-dev" data-id="${esc(d.id)}" data-fk="map-${esc(d.id)}" aria-label="${esc(d.id)} ${esc(d.ip)} สถานะ ${ST[st]}">
<rect x="${p[0] - 46}" y="${p[1] - 14}" width="92" height="28" rx="6"/><text x="${p[0]}" y="${p[1] + 4}" text-anchor="middle">${STM[st]} ${esc(d.id)}</text></g>`;
      });
      s += `<text x="20" y="336" font-size="11">PC ในแต่ละห้องต่อกับพอร์ต Gi0/1–Gi0/6 ของ access switch (ไม่ได้วาด)</text></svg></div>`;
      s += `<div class="${P}-legend"><span><i style="background:var(--ok)"></i>${STM.up} Up</span><span><i style="background:var(--orange)"></i>${STM.warn} Warning</span><span><i style="background:var(--bad)"></i>${STM.down} Down</span><span><i style="border:2px dashed var(--muted)"></i>${STM.none} ไม่ได้ monitor</span></div>`;
      if (w.mapSel && DEVINFO[w.mapSel]) {
        const d = DEVINFO[w.mapSel];
        const mons = w.monitors.filter((m) => m.target === d.id);
        s += `<div class="${P}-card" style="margin-top:8px"><h4 style="margin-top:0">${esc(d.id)}</h4><p>${esc(d.model)} · ${esc(d.area)} · management/IP ${esc(d.ip)}</p>
<p>monitor บนอุปกรณ์นี้: ${mons.length ? mons.map((m) => { const x = statusAt(samples(S.mid, m), t); return `${esc(m.name)} = <b>${x ? ST[x.status] : 'ยังไม่ได้ poll'}</b>`; }).join(', ') : 'ยังไม่มี'}</p>
<div class="${P}-row"><button type="button" class="${P}-btn ${P}-ghost ${P}-sm" data-act="goto-if" data-id="${esc(d.id)}" data-fk="goto-if">ดู Interfaces</button><button type="button" class="${P}-btn ${P}-ghost ${P}-sm" data-act="goto-log" data-id="${esc(d.id)}" data-fk="goto-log">ดู Syslog ของอุปกรณ์นี้</button><button type="button" class="${P}-btn ${P}-ghost ${P}-sm" data-act="goto-mon" data-id="${esc(d.id)}" data-fk="goto-mon">เพิ่ม monitor</button></div></div>`;
      }
      return s;
    }
    /* ---------- charts (inline SVG, theme via CSS variables) ---------- */
    function niceMax(v) { if (!(v > 0)) return 1; const p = Math.pow(10, Math.floor(Math.log10(v))); for (const k of [1, 2, 2.5, 5, 10]) if (k * p >= v) return k * p; return 10 * p; }
    function chart(o) {
      const Wd = 600, H = 160, L = 46, R = 10, T = 10, B = 40, pw = Wd - L - R, ph = H - T - B;
      const X = (t) => L + (t / N.DURATION) * pw;
      const vis = (arr) => (arr || []).filter((p) => p.t <= o.clock);
      const all = vis(o.pts).concat(vis(o.pts2)).map((p) => p.v).filter((v) => v != null);
      const max = o.fixedMax || niceMax(Math.max(o.minMax || 1, o.thr ? o.thr * 1.2 : 0, ...all.map((v) => v * 1.1)));
      const Y = (v) => T + ph - (Math.min(v, max) / max) * ph;
      let s = `<svg class="${P}-chart" viewBox="0 0 ${Wd} ${H}" role="img" aria-label="${esc(o.label)}"><title>${esc(o.label)}</title>`;
      [0, 0.5, 1].forEach((f) => { const y = T + ph - f * ph; s += `<line class="${P}-ax" x1="${L}" x2="${Wd - R}" y1="${y}" y2="${y}"/><text x="${L - 6}" y="${y + 4}" text-anchor="end" font-size="12">${+(max * f).toFixed(max * f < 10 && f ? 1 : 0)}</text>`; });
      [0, 900, 1800, 2700, 3600].forEach((t) => { s += `<text x="${X(t)}" y="${H - 4}" text-anchor="${t === 0 ? 'start' : t === 3600 ? 'end' : 'middle'}" font-size="12">${N.fmtTime(t, true)}</text>`; });
      s += `<text x="${L + 4}" y="${T + 12}" font-size="12">${esc(o.unit || '')}</text>`;
      if (o.thr) s += `<line class="${P}-th" x1="${L}" x2="${Wd - R}" y1="${Y(o.thr)}" y2="${Y(o.thr)}"><title>threshold ${o.thr}</title></line>`;
      const line = (arr, cls) => {
        let d = '', pen = false;
        vis(arr).forEach((p) => { if (p.v == null) { pen = false; return; } d += (pen ? 'L' : 'M') + X(p.t).toFixed(1) + ' ' + Y(p.v).toFixed(1) + ' '; pen = true; });
        return d ? `<path class="${cls}" d="${d}"/>` : '';
      };
      s += line(o.pts, P + '-ln') + (o.pts2 ? line(o.pts2, P + '-ln2') : '');
      if (o.band) { const iv = o.interval || N.STEP; vis(o.pts).forEach((p) => { if (p.status) s += `<rect class="${P}-b-${p.status}" x="${X(p.t).toFixed(1)}" y="${H - B + 6}" width="${Math.max(1.2, X(p.t + iv) - X(p.t)).toFixed(1)}" height="9"/>`; }); }
      s += `<line class="${P}-now" x1="${X(o.clock)}" x2="${X(o.clock)}" y1="${T}" y2="${H - B + 16}"/>`;
      return s + '</svg>';
    }
    function monLast(m) { return statusAt(samples(S.mid, m), W().clock); }
    function valText(m, x) {
      if (!x) return 'ยังไม่ได้ poll';
      if (m.type === 'icmp') return x.loss >= 100 ? 'ไม่ตอบ (loss 100%)' : `latency ${x.lat} ms · loss ${x.loss}%`;
      if (m.type === 'tcp') return x.open ? `เชื่อมต่อได้ ${x.lat} ms` : x.note;
      return !x.reach ? 'SNMP timeout' : !x.oper ? 'interface down' : `util ${x.util}% · in ${fmtBps(x.inBps)} · out ${fmtBps(x.outBps)}${x.errDelta > 0 ? ` · errors +${x.errDelta}` : ''}`;
    }
    function dashView() {
      const w = W(), t = w.clock;
      if (!w.monitors.length) return `<p>ยังไม่มี monitor ไปที่แท็บ <b>Monitors</b> เพื่อเพิ่ม</p>`;
      const c = { up: 0, warn: 0, down: 0, none: 0 };
      const cards = w.monitors.map((m, i) => {
        const list = samples(S.mid, m), x = statusAt(list, t), st = x ? x.status : 'none'; c[st]++;
        const thr = m.type === 'snmp' ? m.utilWarn : m.latWarn;
        const pts = list.map((p) => ({ t: p.t, v: m.type === 'snmp' ? p.util : p.lat, status: p.status }));
        return `<article class="${P}-mon ${P}-s-${st}"><div class="${P}-monhead"><b>${esc(m.name)}</b><span class="${P}-pill ${P}-s-${st}">${STM[st]} ${ST[st]}</span></div>
<p class="${P}-muted ${P}-small">${TYPE_TH[m.type]} · ${esc(m.target)}${m.port ? ':' + m.port : ''}${m.iface ? ' ' + esc(m.iface) : ''} · ทุก ${m.interval} วินาที · เตือนเมื่อ ${m.type === 'snmp' ? 'util ≥ ' + m.utilWarn + '% หรือมี errors' : 'latency ≥ ' + m.latWarn + ' ms' + (m.type === 'icmp' ? ' หรือ loss ≥ ' + m.lossWarn + '%' : '')}</p>
<p class="${P}-small">${x ? N.fmtTime(x.t) + ' — ' : ''}${esc(valText(m, x))}</p>
<div class="${P}-svgbox">${chart({ pts, thr, clock: t, band: true, interval: m.interval, unit: m.type === 'snmp' ? 'util %' : 'ms', minMax: m.type === 'snmp' ? 100 : 2, fixedMax: m.type === 'snmp' ? 100 : 0, label: `กราฟ ${m.name}: ${m.type === 'snmp' ? 'utilization' : 'latency'} ตามเวลา แถบล่างคือสถานะแต่ละรอบ poll` })}</div></article>`;
      });
      return `<div class="${P}-sum" role="status"><span class="${P}-ok">${STM.up} Up ${c.up}</span><span class="${P}-warn">${STM.warn} Warning ${c.warn}</span><span class="${P}-err">${STM.down} Down ${c.down}</span>${c.none ? `<span>${STM.none} ยังไม่ได้ poll ${c.none}</span>` : ''}</div><div class="${P}-grid">${cards.join('')}</div>`;
    }
    function ifaceView(sc) {
      const w = W(), t = w.clock;
      const rows = N.ifaceRows(sc.sim, w.ifDev, t);
      const reach = N.reach(sc.sim, w.ifDev, N.stepOf(t));
      let s = `<p class="${P}-muted">${esc(w.ifDev)} · ${esc(DEVINFO[w.ifDev].model)} · ค่า ณ ${N.fmtTime(t)} (bps เฉลี่ย 10 วินาทีล่าสุด, errors และ MB นับสะสมตั้งแต่ 08:00)</p>`;
      if (!reach.ok) return s + `<p class="${P}-err">SNMP timeout: NMS ติดต่อ ${esc(w.ifDev)} ไม่ได้ในเวลานี้ จึงอ่าน counter ไม่ได้</p>`;
      s += `<div class="${P}-tablewrap"><table class="${P}-table"><thead><tr><th>Interface</th><th>Description</th><th class="${P}-num">Speed</th><th>Status</th><th class="${P}-num">In</th><th class="${P}-num">Out</th><th class="${P}-num">Util %</th><th class="${P}-num">In errors (CRC)</th><th class="${P}-num">รับ/ส่งรวม (MB)</th><th>กราฟ</th></tr></thead><tbody>`;
      rows.forEach((r) => {
        s += `<tr class="${r.name === w.ifSel ? P + '-hl' : ''}"><td><b>${esc(r.name)}</b></td><td>${esc(r.desc)}</td><td class="${P}-num">${fmtSpeed(r.speed)}</td><td>${r.oper ? '<span class="' + P + '-ok">up</span>' : '<span class="' + P + '-err">down</span>'}</td>
<td class="${P}-num">${fmtBps(r.inBps)}</td><td class="${P}-num">${fmtBps(r.outBps)}</td><td class="${P}-num${r.util >= 90 ? ' ' + P + '-err' : r.util >= 70 ? ' ' + P + '-warn' : ''}">${r.util}</td><td class="${P}-num${r.inErr ? ' ' + P + '-err' : ''}">${r.inErr}</td><td class="${P}-num">${r.inMB} / ${r.outMB}</td>
<td><button type="button" class="${P}-btn ${P}-ghost ${P}-sm" data-act="ifsel" data-id="${esc(r.name)}" data-fk="ifsel-${esc(r.name)}" aria-pressed="${r.name === w.ifSel}">ดู</button></td></tr>`;
      });
      s += '</tbody></table></div>';
      const ser = N.ifaceSeries(sc.sim, w.ifDev, w.ifSel);
      if (ser) {
        const pts = [], pts2 = [];
        for (let i = 0; i < N.NSTEP; i++) { pts.push({ t: i * N.STEP, v: ser.inPct[i] == null ? null : Math.round(ser.inPct[i] * 10) / 10 }); pts2.push({ t: i * N.STEP, v: ser.outPct[i] == null ? null : Math.round(ser.outPct[i] * 10) / 10 }); }
        s += `<h4>${esc(w.ifDev)} ${esc(w.ifSel)} — utilization ตามเวลา (ความเร็ว ${fmtSpeed(ser.speed)})</h4><div class="${P}-svgbox">${chart({ pts, pts2, clock: t, unit: '%', fixedMax: 100, label: `utilization ขาเข้าและขาออกของ ${w.ifDev} ${w.ifSel}` })}</div>
<div class="${P}-legend"><span><i style="background:var(--blue)"></i>In (ขาเข้า) เส้นทึบ</span><span><i style="background:var(--green)"></i>Out (ขาออก) เส้นประ</span></div>`;
      }
      return s;
    }
    function logView(sc) {
      const w = W(), f = w.logF;
      const tf = (v) => { const x = N.parseTime(v); return x == null ? null : x; };
      const list = N.filterLogs(sc.sim, { dev: f.dev, sev: f.sev, from: f.from ? tf(f.from) : null, to: f.to ? tf(f.to) + (/:\d\d:\d\d/.test(f.to) ? 0 : 59) : null, text: f.text, until: w.clock });
      const shown = list.slice(-300);
      const pick = S.mid === 'o2';
      let s = `<p class="${P}-muted" role="status">พบ ${list.length} บรรทัด${list.length > shown.length ? ' (แสดง 300 บรรทัดล่าสุด)' : ''}${(f.from && tf(f.from) == null) || (f.to && tf(f.to) == null) ? ' · <span class="' + P + '-err">รูปแบบเวลาไม่ถูกต้อง (ใช้ ชช:นน)</span>' : ''}</p>`;
      if (!shown.length) return s;
      s += `<ul class="${P}-logs">`;
      shown.forEach((x) => {
        const on = w.evidence.includes(x.id);
        s += `<li class="${P}-sev${x.sev}${on ? ' ' + P + '-picked' : ''}">${pick ? `<label><span class="${P}-sr">เลือกบรรทัด ${x.id} เป็นหลักฐาน</span><input type="checkbox" data-ev="${x.id}" data-fk="ev-${x.id}"${on ? ' checked' : ''}></label>` : ''}<span class="${P}-logid">#${x.id}</span><span>${esc(N.logLine(x))} <span class="${P}-muted ${P}-small">[${x.sev} ${N.SEV[x.sev]}]</span></span></li>`;
      });
      return s + '</ul>';
    }
    /* ---------- monitors tab ---------- */
    function monitorsPanel() {
      const w = W(), f = w.form;
      const tgt = DEVINFO[f.target] ? f.target : 'R1';
      const ifs = NET.ifaces[tgt] || [];
      let s = `<section class="${P}-card"><h3>${f.edit >= 0 ? 'แก้ไข monitor' : 'เพิ่ม monitor'}</h3><div class="${P}-form">
<label>ชนิดการตรวจ<select data-mf="type" data-fk="mf-type">${Object.keys(TYPE_TH).map((k) => `<option value="${k}"${f.type === k ? ' selected' : ''}>${TYPE_TH[k]}</option>`).join('')}</select></label>
<label>อุปกรณ์เป้าหมาย<select data-mf="target" data-fk="mf-target">${devOptions(tgt)}</select></label>`;
      if (f.type === 'tcp') s += `<label>พอร์ต TCP<select data-mf="port" data-fk="mf-port">${PORTS.map(([p, n]) => `<option value="${p}"${String(f.port) === String(p) ? ' selected' : ''}>${p} (${n})</option>`).join('')}</select></label>`;
      if (f.type === 'snmp') s += `<label>Interface<select data-mf="iface" data-fk="mf-iface">${ifOptions(tgt, f.iface || (ifs[0] && ifs[0].name))}</select></label>`;
      s += `<label>Poll interval (วินาที: ตรวจซ้ำทุกกี่วินาที)<input type="number" min="5" max="3600" step="1" inputmode="numeric" data-mf="interval" data-fk="mf-interval" value="${esc(f.interval)}"></label>`;
      if (f.type !== 'snmp') s += `<label>เตือนเมื่อ latency ≥ (ms)<input type="number" min="1" max="10000" inputmode="decimal" placeholder="เช่น ${f.type === 'tcp' ? 500 : 100}" data-mf="latWarn" data-fk="mf-lat" value="${esc(f.latWarn)}"></label>`;
      if (f.type === 'icmp') s += `<label>เตือนเมื่อ packet loss ≥ (%)<input type="number" min="0" max="100" inputmode="decimal" placeholder="เช่น 20" data-mf="lossWarn" data-fk="mf-loss" value="${esc(f.lossWarn)}"></label>`;
      if (f.type === 'snmp') s += `<label>เตือนเมื่อ utilization ≥ (%)<input type="number" min="1" max="100" inputmode="decimal" placeholder="เช่น 80" data-mf="utilWarn" data-fk="mf-util" value="${esc(f.utilWarn)}"></label>`;
      s += `<label>ชื่อ (ไม่บังคับ)<input type="text" maxlength="40" data-mf="name" data-fk="mf-name" value="${esc(f.name)}"></label></div>
<p class="${P}-muted ${P}-small">${f.type === 'icmp' ? 'ICMP ping: Down เมื่อไม่ตอบเลย (loss 100%), Warning เมื่อ latency หรือ loss ถึง threshold' : f.type === 'tcp' ? 'TCP port check: ลองเชื่อมต่อพอร์ต (TCP handshake) Down เมื่อ refused/timeout, Warning เมื่อตอบช้าถึง threshold' + (String(f.port) === '53' ? ' — หมายเหตุ: DNS ทั่วไปถามชื่อด้วย UDP 53 การตรวจ TCP 53 ในแลปนี้เป็นการตรวจแบบง่าย ระบบจริงควรส่ง DNS query แล้วดูว่าได้คำตอบ' : '') : 'SNMP: อ่าน counter ของ interface ทุก interval แล้วคำนวณ bps เฉลี่ย Down เมื่อ interface ลงหรือ SNMP timeout, Warning เมื่อ utilization ถึง threshold หรือมี input errors เพิ่ม'}</p>
${f.err ? `<p class="${P}-err" role="alert">${esc(f.err)}</p>` : ''}
<div class="${P}-row"><button type="button" class="${P}-btn" data-act="mon-save" data-fk="mon-save">${f.edit >= 0 ? 'บันทึกการแก้ไข' : 'เพิ่ม monitor'}</button>${f.edit >= 0 ? `<button type="button" class="${P}-btn ${P}-ghost" data-act="mon-cancel" data-fk="mon-cancel">ยกเลิก</button>` : ''}</div></section>`;
      s += `<section class="${P}-card"><h3>Monitor ทั้งหมด (${w.monitors.length})</h3>`;
      if (!w.monitors.length) s += '<p class="' + P + '-muted">ยังไม่มี monitor</p>';
      else {
        s += `<div class="${P}-tablewrap"><table class="${P}-table"><thead><tr><th>ชื่อ</th><th>ชนิด</th><th>เป้าหมาย</th><th class="${P}-num">Interval</th><th>Threshold</th><th>จัดการ</th></tr></thead><tbody>`;
        w.monitors.forEach((m, i) => {
          s += `<tr><td>${esc(m.name)}</td><td>${TYPE_TH[m.type]}</td><td>${esc(m.target)}${m.port ? ' TCP ' + m.port : ''}${m.iface ? ' ' + esc(m.iface) : ''}</td><td class="${P}-num">${m.interval} s</td>
<td>${m.type === 'snmp' ? 'util ≥ ' + m.utilWarn + '%' : 'latency ≥ ' + m.latWarn + ' ms' + (m.type === 'icmp' ? ', loss ≥ ' + m.lossWarn + '%' : '')}</td>
<td><div class="${P}-row"><button type="button" class="${P}-btn ${P}-ghost ${P}-sm" data-act="mon-edit" data-i="${i}" data-fk="mon-edit-${i}" aria-label="แก้ไข ${esc(m.name)}">แก้ไข</button><button type="button" class="${P}-btn ${P}-ghost ${P}-sm" data-act="mon-del" data-i="${i}" data-fk="mon-del-${i}" aria-label="ลบ ${esc(m.name)}">ลบ</button></div></td></tr>`;
        });
        s += '</tbody></table></div>';
      }
      return s + '</section>';
    }
    /* ---------- automation: a1 ---------- */
    function invPanel() {
      const w = W(), inv = N.parseInventory(w.inventory);
      return `<section class="${P}-card"><h3>Inventory (CSV)</h3><p class="${P}-muted">แถวแรกเป็นหัวตาราง ต้องมี hostname และ mgmt_ip · VLAN หลายค่าคั่นด้วย ; (เช่น 10;20;99) · บรรทัดที่ขึ้นต้นด้วย # เป็นหมายเหตุ</p>
<label class="${P}-fld">ข้อความ inventory<textarea rows="9" spellcheck="false" autocapitalize="off" autocomplete="off" data-in="inv" data-fk="inv">${esc(w.inventory)}</textarea></label>
<div data-part="invprev">${invPreview(inv)}</div></section>`;
    }
    function invPreview(inv) {
      let s = inv.errors.length ? `<ul class="${P}-fb">${inv.errors.slice(0, 8).map((e) => `<li class="${P}-err">บรรทัด ${e.line}: ${esc(e.msg)}</li>`).join('')}</ul>` : `<p class="${P}-ok">อ่าน inventory ได้ ${inv.rows.length} อุปกรณ์</p>`;
      if (inv.rows.length) {
        const cols = inv.cols.filter((c) => c !== 'vlans').concat(inv.cols.includes('vlans') ? ['vlans', 'vlan_list'] : []);
        s += `<div class="${P}-tablewrap"><table class="${P}-table"><caption class="${P}-sr">ตัวแปรของแต่ละอุปกรณ์</caption><thead><tr>${cols.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${inv.rows.map((r) => `<tr>${cols.map((c) => `<td>${esc(Array.isArray(r[c]) ? '[' + r[c].join(', ') + ']' : r[c])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
      }
      return s;
    }
    function tplPanel() {
      const w = W(), inv = N.parseInventory(w.inventory);
      const devs = inv.rows.map((r) => r.hostname);
      if (!devs.includes(w.tplDev)) w.tplDev = devs[0] || '';
      return `<section class="${P}-card"><h3>Configuration template</h3>
<details><summary style="cursor:pointer;min-height:44px;display:flex;align-items:center"><b>ไวยากรณ์ที่ใช้ได้ (mini template engine ของระบบจำลอง)</b></summary><ul class="${P}-list ${P}-small">
<li><code>{{ hostname }}</code> แทนค่าตัวแปรจาก inventory · <code>{{ vlan_list }}</code> = VLAN คั่นด้วย , · ตัวแปรกลาง: <code>{{ gateway }}</code> (10.10.99.1), <code>{{ mgmt_mask }}</code> (255.255.255.0)</li>
<li>filter: <code>{{ hostname | lower }}</code>, <code>upper</code>, <code>trim</code>, <code>default("x")</code>, <code>join(",")</code>, <code>length</code>, <code>replace("a","b")</code></li>
<li>ลูป: <code>{% for v in vlans %} ... {{ v }} ... {% endfor %}</code> (มี <code>loop.index</code>, <code>loop.first</code>, <code>loop.last</code>)</li>
<li>เงื่อนไข: <code>{% if role == "access" %} ... {% elif v == 20 %} ... {% else %} ... {% endif %}</code> ใช้ <code>== != &lt; &gt; in not and or</code> ได้</li>
<li>หมายเหตุ <code>{# ... #}</code> · ข้อความตามตัว <code>{% raw %}...{% endraw %}</code> · บรรทัดที่มีแค่ {% %} จะถูกตัดออกจากผลลัพธ์</li>
<li>ปลอดภัย: ไม่มีการรันโค้ด เรียกฟังก์ชันไม่ได้ ค่าที่มีขึ้นบรรทัดใหม่จะถูกแทนด้วยช่องว่าง (กันการแทรกคำสั่ง) และจำกัดความยาว/จำนวนรอบลูป</li></ul></details>
<label class="${P}-fld">ข้อความ template<textarea rows="16" spellcheck="false" autocapitalize="off" autocomplete="off" data-in="tpl" data-fk="tpl">${esc(w.template)}</textarea></label>
<div class="${P}-form"><label>ดูผล render สำหรับ<select data-in="tpldev" data-fk="tpldev">${devs.length ? devs.map((d) => `<option${d === w.tplDev ? ' selected' : ''}>${esc(d)}</option>`).join('') : '<option value="">(inventory ยังว่าง)</option>'}</select></label></div>
<div data-part="tplprev" aria-live="polite">${tplPreview()}</div></section>`;
    }
    function tplPreview() {
      const w = W(), inv = N.parseInventory(w.inventory);
      const row = inv.rows.find((r) => r.hostname === w.tplDev) || inv.rows[0];
      if (!row) return `<p class="${P}-muted">เพิ่มอุปกรณ์ใน inventory ก่อนเพื่อดูผล render</p>`;
      const r = N.tpl.render(w.template, N.varsFor(row));
      if (!r.ok) return `<p class="${P}-err" role="alert">render ไม่สำเร็จ${r.error.line ? ' (บรรทัด ' + r.error.line + ')' : ''}: ${esc(r.error.msg)}</p>`;
      return `<p class="${P}-muted">ผล render ของ ${esc(row.hostname)} (${r.text.split('\n').length} บรรทัด)</p><pre class="${P}-pre" tabindex="0" aria-label="ผล render">${esc(r.text)}</pre>`;
    }
    function a1Checks(d, st) {
      const u = st.ifaces['Gi0/24'], s = st.ifaces.Vlan99;
      return [['hostname', st.hostname === d.id], ['Mgmt IP (Vlan99)', !!(s && s.ip === d.ip && s.mask === '255.255.255.0' && !s.shutdown)],
        ['VLAN 10/20/99 + ชื่อ', [10, 20, 99].every((v) => st.vlans[v] && String(st.vlans[v]).toUpperCase() === N.A1.vlans[v])],
        ['Uplink description', String(u.desc).trim().toLowerCase() === N.A1.uplinkDesc.toLowerCase()],
        ['Trunk 10,20,99', u.mode === 'trunk' && !u.shutdown && (u.allowed == null || [10, 20, 99].every((v) => u.allowed.includes(v)))], ['Default gateway', st.gateway === N.A1.gateway]];
    }
    function pushPanel() {
      const w = W(), r = w.pushRes;
      let s = `<section class="${P}-card"><h3>Push config ไปยัง access switch (จำลอง)</h3><p class="${P}-muted">ระบบจำลองรีเซ็ต switch ทั้ง 5 ตัวเป็นค่าเริ่มต้นแล้วส่ง config ที่ render จาก template ให้แต่ละตัว (เลือกอุปกรณ์จากคอลัมน์ hostname) ผลจึงตรงกับที่เซิร์ฟเวอร์ใช้ตรวจ</p>
<button type="button" class="${P}-btn" data-act="push" data-fk="push">Push (จำลอง)</button></section>`;
      if (!r) return s;
      s += `<section class="${P}-card" aria-live="polite"><h3>ผลการ push</h3>`;
      if (r.templateError) s += `<p class="${P}-err">template ผิดที่บรรทัด ${r.templateError.line}: ${esc(r.templateError.msg)}</p>`;
      r.errors.slice(0, 6).forEach((e) => { s += `<p class="${P}-err">inventory บรรทัด ${e.line}: ${esc(e.msg)}</p>`; });
      if (r.missing.length) s += `<p class="${P}-warn">ยังไม่ได้ push: ${r.missing.map(esc).join(', ')}</p>`;
      s += `<div class="${P}-tablewrap"><table class="${P}-table"><thead><tr><th>อุปกรณ์</th><th>ผล</th>${a1Checks(N.A1.devices[0], N.dev.blank('x')).map((c) => `<th>${esc(c[0])}</th>`).join('')}</tr></thead><tbody>`;
      N.A1.devices.forEach((d) => {
        const x = r.devices.find((y) => y.id === d.id);
        if (!x) { s += `<tr><td>${esc(d.id)}</td><td class="${P}-muted">ไม่ได้ push</td>${'<td>–</td>'.repeat(6)}</tr>`; return; }
        const res = x.renderError ? `<span class="${P}-err">render ผิด</span>` : x.errors && x.errors.length ? `<span class="${P}-warn">มีคำสั่งผิด ${x.errors.length}</span>` : `<span class="${P}-ok">สำเร็จ</span>`;
        s += `<tr><td>${esc(d.id)}</td><td>${res}</td>${a1Checks(d, x.state).map((c) => `<td>${c[1] ? '<span class="' + P + '-ok">ผ่าน</span>' : '<span class="' + P + '-err">ยังไม่ผ่าน</span>'}</td>`).join('')}</tr>`;
      });
      s += '</tbody></table></div>';
      const errs = r.devices.filter((x) => x.errors && x.errors.length).slice(0, 3);
      errs.forEach((x) => { s += `<p class="${P}-small ${P}-err">${esc(x.id)} บรรทัด ${x.errors[0].line} "${esc(x.errors[0].cmd.trim())}": ${esc(x.errors[0].msg)}</p>`; });
      const dv = r.devices.find((x) => x.id === w.devSel) || r.devices[0];
      if (dv) {
        s += `<h4>ตรวจสถานะอุปกรณ์</h4><div class="${P}-row"><label class="${P}-fld" style="min-width:160px">อุปกรณ์<select data-in="devsel" data-fk="devsel">${r.devices.map((x) => `<option${x.id === dv.id ? ' selected' : ''}>${esc(x.id)}</option>`).join('')}</select></label>
${[['run', 'show running-config'], ['vlan', 'show vlan brief'], ['ipint', 'show ip interface brief']].map(([k, t]) => `<button type="button" class="${P}-btn ${P}-ghost ${P}-sm" data-act="show" data-v="${k}" aria-pressed="${w.devShow === k}" data-fk="show-${k}">${t}</button>`).join('')}</div>
<pre class="${P}-pre" tabindex="0" aria-label="ผลคำสั่ง">${esc(dv.state.hostname + '# show ' + ({ run: 'running-config', vlan: 'vlan brief', ipint: 'ip interface brief' }[w.devShow] || 'running-config') + '\n' + N.dev.show(dv.state, w.devShow))}</pre>`;
      }
      return s + '</section>';
    }
    /* ---------- automation: a2 ---------- */
    function changePanel() {
      const su = a2Setup(); if (!su) return '';
      return `<section class="${P}-card"><h3>Change ที่ต้องทำ: เพิ่ม VLAN 30 (LAB-IOT)</h3><p>template นี้กำหนดไว้แล้ว (แก้ไม่ได้) งานของคุณคือ playbook ที่ใช้มันอย่างปลอดภัยกับทุก switch</p>
<pre class="${P}-pre" tabindex="0" aria-label="template ของ change">${esc(su.template)}</pre>
<h4>Inventory</h4><pre class="${P}-pre" tabindex="0" aria-label="inventory">${esc(su.inventory)}</pre>
<p class="${P}-muted">อุปกรณ์ทุกตัวตอนนี้ทำงานปกติ (running-config = startup-config) ในระบบจำลองนี้ rollback ทำผ่าน console server (out-of-band) จึงย้อนค่าได้แม้ switch จะหลุดจาก management network · ทุกอย่างเป็นการจำลอง ไม่มีการเชื่อมต่ออุปกรณ์จริง</p></section>`;
    }
    function pbPanel() {
      const w = W(), pb = w.playbook;
      let s = `<section class="${P}-card"><h3>Playbook (ทำทีละ task ตามลำดับ กับอุปกรณ์ทีละตัวตาม inventory)</h3>`;
      if (!pb.tasks.length) s += `<p class="${P}-muted">ยังไม่มี task เพิ่มด้วยปุ่มด้านล่าง</p>`;
      s += '<ol style="list-style:none;padding:0;margin:0">';
      pb.tasks.forEach((t, i) => {
        s += `<li class="${P}-task"><b aria-hidden="true">${i + 1}</b>
<label class="${P}-fld"><span class="${P}-sr">task ${i + 1} action</span><select data-pb="action" data-i="${i}" data-fk="pb-a-${i}">${N.ACTIONS.map((a) => `<option value="${a}"${t.action === a ? ' selected' : ''}>${esc(N.ACTION_TH[a])}</option>`).join('')}</select></label>
<label class="${P}-fld"><span class="${P}-sr">task ${i + 1} ทำเมื่อ</span><select data-pb="when" data-i="${i}" data-fk="pb-w-${i}">${[['success', 'when: success (ยังไม่มีอะไรล้มเหลว)'], ['failure', 'when: failure (มีขั้นล้มเหลว)'], ['always', 'when: always (ทุกครั้ง)']].map(([k, th]) => `<option value="${k}"${(t.when || 'success') === k ? ' selected' : ''}>${th}</option>`).join('')}</select></label>
<div class="${P}-targ">${t.action === 'verify_ping' ? `<label class="${P}-fld"><span class="${P}-sr">ปลายทาง ping</span><select data-pb="target" data-i="${i}" data-fk="pb-t-${i}"><option value="mgmt"${t.target !== 'gateway' ? ' selected' : ''}>ping mgmt IP ของ switch</option><option value="gateway"${t.target === 'gateway' ? ' selected' : ''}>จาก switch ping gateway</option></select></label>` : t.action === 'verify_port' ? `<label class="${P}-fld"><span class="${P}-sr">พอร์ต TCP</span><input type="number" min="1" max="65535" inputmode="numeric" data-pb="port" data-i="${i}" data-fk="pb-p-${i}" value="${esc(t.port == null ? 22 : t.port)}" aria-label="พอร์ต TCP"></label>` : ''}</div>
<div class="${P}-taskbtns"><button type="button" class="${P}-btn ${P}-ghost ${P}-sm" data-act="pb-up" data-i="${i}" data-fk="pb-up-${i}" ${i === 0 ? 'disabled' : ''} aria-label="เลื่อน task ${i + 1} ขึ้น">ขึ้น</button><button type="button" class="${P}-btn ${P}-ghost ${P}-sm" data-act="pb-down" data-i="${i}" data-fk="pb-down-${i}" ${i === pb.tasks.length - 1 ? 'disabled' : ''} aria-label="เลื่อน task ${i + 1} ลง">ลง</button><button type="button" class="${P}-btn ${P}-ghost ${P}-sm" data-act="pb-del" data-i="${i}" data-fk="pb-del-${i}" aria-label="ลบ task ${i + 1}">ลบ</button></div></li>`;
      });
      s += `</ol><p style="margin-top:8px"><b>เพิ่ม task</b></p><div class="${P}-row">${N.ACTIONS.map((a) => `<button type="button" class="${P}-btn ${P}-ghost ${P}-sm" data-act="pb-add" data-v="${a}" data-fk="pb-add-${a}" ${pb.tasks.length >= 15 ? 'disabled' : ''}>+ ${a}</button>`).join('')}</div>
<label class="${P}-check"><input type="checkbox" data-in="fatal" data-fk="fatal"${pb.anyErrorsFatal ? ' checked' : ''}> any_errors_fatal (หยุดทั้ง playbook เมื่ออุปกรณ์ใดล้มเหลว)</label>
<div class="${P}-row"><button type="button" class="${P}-btn" data-act="pb-run" data-fk="pb-run" ${pb.tasks.length ? '' : 'disabled'}>Run playbook (จำลอง)</button></div></section>`;
      return s;
    }
    function runPanel() {
      const w = W(), rep = w.runRes;
      if (!rep) return `<section class="${P}-card"><p>ยังไม่ได้รัน playbook ไปที่แท็บ <b>Playbook</b> แล้วกด "Run playbook (จำลอง)"</p></section>`;
      if (!rep.ok) return `<section class="${P}-card"><p class="${P}-err">${esc(rep.error)}</p></section>`;
      let s = `<section class="${P}-card" aria-live="polite"><h3>ผลการรันรายอุปกรณ์</h3>${rep.stopped ? `<p class="${P}-warn">any_errors_fatal: playbook หยุดก่อนครบทุกอุปกรณ์</p>` : ''}
<div class="${P}-tablewrap"><table class="${P}-table"><thead><tr><th>อุปกรณ์</th><th>สถานะ</th><th>Mgmt ping หลังจบ</th><th>มี VLAN 30</th><th>startup-config</th></tr></thead><tbody>`;
      rep.devices.forEach((d) => {
        s += `<tr><td>${esc(d.id)}</td><td><span class="${P}-pill ${P}-s-${d.status}">${esc(PB_ST[d.status])}</span></td><td>${d.reachable ? '<span class="' + P + '-ok">ตอบ</span>' : '<span class="' + P + '-err">ไม่ตอบ (หลุด)</span>'}</td><td>${d.hasChange ? 'มี' : 'ไม่มี'}</td><td>${d.startupSaved ? 'ตรงกับ running' : d.startupOriginal ? 'ค่าเดิม (ยังไม่ save)' : '<span class="' + P + '-err">ไม่ตรงกับ running และไม่ใช่ค่าเดิม</span>'}</td></tr>`;
      });
      s += '</tbody></table></div>';
      const dv = rep.devices.find((d) => d.id === w.a2Dev) || rep.devices[0];
      s += `<h4>รายละเอียดราย task</h4><label class="${P}-fld" style="max-width:240px">อุปกรณ์<select data-in="a2dev" data-fk="a2dev">${rep.devices.map((d) => `<option${d.id === dv.id ? ' selected' : ''}>${esc(d.id)}</option>`).join('')}</select></label>
<div class="${P}-tablewrap"><table class="${P}-table"><thead><tr><th>#</th><th>Task</th><th>when</th><th>ผล</th><th>รายละเอียด</th></tr></thead><tbody>${dv.tasks.map((t, i) => `<tr><td>${i + 1}</td><td>${esc(t.action)}</td><td>${esc(t.when)}</td><td class="${t.result === 'failed' ? P + '-err' : t.result === 'skipped' ? P + '-muted' : P + '-ok'}">${esc(t.result)}</td><td>${esc(t.msg)}</td></tr>`).join('')}</tbody></table></div>
<pre class="${P}-pre" tabindex="0" aria-label="running-config หลังรัน">${esc(N.dev.show(dv.running))}</pre></section>`;
      return s;
    }
    /* ---------- submit ---------- */
    function submitCard() {
      const w = W(), m = MS(S.mid); if (!m) return '';
      let s = `<section class="${P}-card" aria-label="ส่งงาน"><h3>${S.mid === 'o2' || S.mid === 'o3' ? 'คำตอบและส่งงาน' : 'ตรวจคำตอบ / ส่งงาน'}</h3>`;
      const a = w.answer;
      if (S.mid === 'o1') s += `<p>ส่งชุด monitor ทั้งหมด ${w.monitors.length} รายการให้เซิร์ฟเวอร์ตรวจ</p>`;
      if (S.mid === 'o2') {
        s += `<div class="${P}-form"><label>อุปกรณ์ที่เป็นต้นเหตุ<select data-ans="device" data-fk="ans-device">${devOptions(a.device, null, '— เลือก —')}</select></label>
<label>เวลาที่ปัญหาเริ่ม (ชช:นน)<input type="text" inputmode="numeric" placeholder="เช่น 08:25" data-ans="time" data-fk="ans-time" value="${esc(a.time || '')}"></label>
<div class="${P}-fld"><button type="button" class="${P}-btn ${P}-ghost" data-act="ans-clock" data-fk="ans-clock">ใช้เวลาของนาฬิกา (${N.fmtTime(w.clock, true)})</button></div></div>
<fieldset style="border:1px solid var(--line);border-radius:10px;padding:6px 10px;margin:6px 0"><legend><b>สาเหตุ</b></legend><div class="${P}-radios">${(m.start.causes || []).map((c) => `<label><input type="radio" name="${P}-cause" value="${esc(c.id)}" data-ans="cause" data-fk="cause-${esc(c.id)}"${a.cause === c.id ? ' checked' : ''}>${esc(c.th)}</label>`).join('')}</div></fieldset>
<p><b>หลักฐานจาก Syslog (${w.evidence.length})</b> <span class="${P}-muted ${P}-small">เลือกได้ในแท็บ Syslog</span></p>`;
        const sc = simFor('o2');
        s += w.evidence.length && sc ? `<div class="${P}-chips">${w.evidence.map((id) => { const x = sc.sim.logs[id - 1]; return x ? `<span class="${P}-chip"><span>#${id} ${esc(N.fmtTime(x.t))} ${esc(x.dev)} ${esc(x.fac)}</span><button type="button" data-act="ev-del" data-id="${id}" data-fk="evdel-${id}" aria-label="เอาบรรทัด ${id} ออก">ลบ</button></span>` : ''; }).join('')}</div>` : `<p class="${P}-muted">ยังไม่ได้เลือก</p>`;
      }
      if (S.mid === 'o3') {
        const ifSel = (k, dk) => `<select data-ans="${k}" data-fk="ans-${k}">${a[dk] ? ifOptions(a[dk], a[k], '— เลือก interface —') : '<option value="">เลือกอุปกรณ์ก่อน</option>'}</select>`;
        s += `<div class="${P}-two"><fieldset style="border:1px solid var(--line);border-radius:10px;padding:6px 10px;margin:0;min-width:0"><legend><b>คอขวด (bottleneck)</b></legend><div class="${P}-form"><label>อุปกรณ์<select data-ans="bdev" data-fk="ans-bdev">${devOptions(a.bdev, (d) => (NET.ifaces[d.id] || []).length, '— เลือก —')}</select></label><label>Interface${ifSel('biface', 'bdev')}</label></div></fieldset>
<fieldset style="border:1px solid var(--line);border-radius:10px;padding:6px 10px;margin:0;min-width:0"><legend><b>พอร์ตของ top talker</b></legend><div class="${P}-form"><label>อุปกรณ์<select data-ans="tdev" data-fk="ans-tdev">${devOptions(a.tdev, (d) => (NET.ifaces[d.id] || []).length, '— เลือก —')}</select></label><label>Interface${ifSel('tiface', 'tdev')}</label></div></fieldset></div>
<p style="margin-top:8px"><b>หลักฐาน</b></p><div class="${P}-form"><label>เวลาที่พบคอขวด (ชช:นน)<input type="text" inputmode="numeric" placeholder="เช่น 08:30" data-ans="time" data-fk="ans-time" value="${esc(a.time || '')}"></label>
<label>utilization ของคอขวดที่อ่านได้ (%)<input type="number" min="0" max="100" inputmode="decimal" data-ans="util" data-fk="ans-util" value="${esc(a.util == null ? '' : a.util)}"></label>
<div class="${P}-fld"><button type="button" class="${P}-btn ${P}-ghost" data-act="ans-clock" data-fk="ans-clock">ใช้เวลาของนาฬิกา (${N.fmtTime(w.clock, true)})</button></div></div>`;
      }
      if (S.mid === 'a1') s += `<p>ส่ง inventory และ template ปัจจุบัน เซิร์ฟเวอร์จะ render และ push ไปยัง switch จำลองชุดใหม่ แล้วตรวจสถานะของ switch</p>`;
      if (S.mid === 'a2') s += `<p>ส่ง playbook (${w.playbook.tasks.length} task) เซิร์ฟเวอร์จะรันกับสถานการณ์ของคุณ และกับความผิดพลาดอีกแบบที่ซ่อนไว้</p>`;
      if (!ctx.user) s += `<p class="${P}-muted">ยังไม่ได้เข้าสู่ระบบ: ตรวจคะแนนได้แต่จะไม่บันทึก</p>`;
      s += `<button type="button" class="${P}-btn" data-act="submit" data-fk="submit" ${S.sending ? 'disabled' : ''}>${S.sending ? 'กำลังตรวจ…' : 'ตรวจคำตอบ / ส่งงาน'}</button><div role="status" aria-live="polite">`;
      const r = w.result;
      if (r) {
        if (r.error) s += `<p class="${P}-err">${esc(r.error)}</p>`;
        else s += `<p class="${P}-score ${r.ok ? P + '-ok' : ''}">คะแนน ${r.score}/${r.max}${r.saved ? ' · บันทึกแล้ว' : ''}</p>${Array.isArray(r.feedback) && r.feedback.length ? `<ul class="${P}-fb">${r.feedback.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>` : ''}`;
      }
      return s + '</div></section>';
    }
    function payload() {
      const w = W(), a = w.answer;
      if (S.mid === 'o1') return { monitors: w.monitors };
      if (S.mid === 'o2') return { answer: { device: a.device || '', cause: a.cause || '', time: a.time || '', evidence: w.evidence.slice(0, 20) } };
      if (S.mid === 'o3') return { answer: { bottleneck: { dev: a.bdev || '', iface: a.biface || '' }, talker: { dev: a.tdev || '', iface: a.tiface || '' }, time: a.time || '', util: a.util == null ? '' : a.util } };
      if (S.mid === 'a1') return { inventory: w.inventory, template: w.template };
      return { playbook: w.playbook };
    }
    async function submit() {
      const mid = S.mid, w = W(mid);
      if (S.sending || typeof ctx.submit !== 'function') return;
      S.sending = true; render();
      try {
        const r = await ctx.submit(mid, payload(), GEN.includes(mid) ? { problem: w.problem, token: w.token } : undefined);
        if (!alive) return;
        w.result = r || { error: 'ไม่ได้รับผลการตรวจ' };
        if (r && typeof r.score === 'number') {
          const b = best[mid] || { best: 0, max: r.max, attempts: 0 };
          b.attempts = (b.attempts || 0) + 1; if (!r.practice) b.best = Math.max(b.best || 0, r.score); b.max = r.max; best[mid] = b;   // practice = a reused problem (3.0 P6)
          if (typeof ctx.toast === 'function') ctx.toast(`ได้ ${r.score}/${r.max} คะแนน`);
        }
      } catch (e) {
        if (!alive) return;
        w.result = { error: 'ส่งงานไม่สำเร็จ: ' + (e && e.message ? e.message : 'เกิดข้อผิดพลาด') };
      }
      S.sending = false; render();
      const el = root.querySelector('.' + P + '-score') || root.querySelector('[data-act="submit"]');
      if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
    }
    async function newProblem() {
      const mid = S.mid, w = W(mid);
      if (w.busy) return;
      if (typeof ctx.newProblem !== 'function') { w.err = 'ขอสถานการณ์ไม่ได้ในขณะนี้'; render(); return; }
      w.busy = true; w.err = ''; render();
      try {
        const res = await ctx.newProblem(mid);
        if (!alive) return;
        if (!res || !res.problem || typeof res.problem.seed !== 'string') throw new Error('ไม่ได้รับสถานการณ์');
        Object.assign(w, { problem: res.problem, token: res.token, result: null, answer: {}, evidence: [], runRes: null, clock: N.DURATION - N.STEP });
        if (mid !== 'a2') { w.monitors = defaultMonitors(mid); w.tab = 'dash'; }
        else { w.tab = 'change'; }
      } catch (e) { if (!alive) return; w.err = 'ขอสถานการณ์ไม่สำเร็จ: ' + ((e && e.message) || 'ลองใหม่อีกครั้ง'); }
      w.busy = false;
      if (alive) render();
    }
    function openMission(id) {
      stopPlay();
      S.mid = id; render();
      if (GEN.includes(id) && !W(id).problem && !W(id).err) newProblem();
    }

    /* ---------- clock ---------- */
    function setClock(t) { const w = W(); w.clock = Math.max(0, Math.min(N.DURATION - N.STEP, Math.round(t / N.STEP) * N.STEP)); renderLive(); }
    function stopPlay() { if (playT) { clearInterval(playT); playT = null; } }
    function togglePlay() {
      if (playT) { stopPlay(); renderLive(); return; }
      const w = W(); if (w.clock >= N.DURATION - N.STEP) w.clock = 0;
      playT = setInterval(() => { if (!alive) return stopPlay(); const x = W(); if (x.clock >= N.DURATION - N.STEP) { stopPlay(); renderLive(); return; } setClock(x.clock + 30); }, 250);
      renderLive();
    }

    /* ---------- events ---------- */
    function onClick(ev) {
      const b = ev.target.closest('[data-act]'); if (!b || !root.contains(b) || b.disabled) return;
      const act = b.getAttribute('data-act'), w = W(), id = b.getAttribute('data-id'), i = Number(b.getAttribute('data-i'));
      switch (act) {
        case 'mission': if (id !== S.mid) openMission(id); return;
        case 'hint': w.hints = Math.min((MS(S.mid).hints || []).length, w.hints + 1); break;
        case 'newp': if (w.problem && !confirm('เริ่มสถานการณ์ใหม่? งานของสถานการณ์เดิมจะหายไป')) return; newProblem(); return;
        case 'reset':
          if (!confirm('เริ่มภารกิจนี้ใหม่? งานที่ทำไว้ในภารกิจนี้จะถูกล้าง (สถานการณ์เดิมยังอยู่)')) return;
          { const keep = { problem: w.problem, token: w.token }; S.work[S.mid] = keep; const x = W(); if (x.problem && S.mid !== 'a2') x.tab = 'dash'; }
          stopPlay(); break;
        case 'tab': w.tab = id; stopPlay(); render(); { const t = root.querySelector(`[data-fk="tab-${id}"]`); if (t) t.focus({ preventScroll: true }); } return;
        case 'clk-reset': setClock(0); return;
        case 'clk-end': stopPlay(); setClock(N.DURATION - N.STEP); return;
        case 'clk-add': setClock(w.clock + Number(b.getAttribute('data-v'))); return;
        case 'clk-play': togglePlay(); return;
        case 'map-dev': w.mapSel = w.mapSel === id ? null : id; renderLive(); { const n = root.querySelector(`[data-fk="map-${CSS_ESC(id)}"]`); if (n) n.focus({ preventScroll: true }); } return;
        case 'goto-if': w.ifDev = id; w.ifSel = (NET.ifaces[id] || [{}])[0].name; w.tab = 'ifaces'; break;
        case 'goto-log': w.logF = { dev: id, sev: '', from: '', to: '', text: '' }; w.tab = 'logs'; break;
        case 'goto-mon': w.form = Object.assign(blankForm(), { target: id }); w.tab = 'monitors'; break;
        case 'ifsel': w.ifSel = id; renderLive(); { const n = root.querySelector(`[data-fk="ifsel-${CSS_ESC(id)}"]`); if (n) n.focus({ preventScroll: true }); } return;
        case 'lf-clear': w.logF = { dev: '', sev: '', from: '', to: '', text: '' }; break;
        case 'mon-save': {
          const f = w.form;
          const src = { type: f.type, target: f.target, interval: f.interval, name: f.name };
          if (f.type === 'tcp') src.port = f.port;
          if (f.type === 'snmp') src.iface = f.iface || ((NET.ifaces[f.target] || [])[0] || {}).name;
          if (f.type !== 'snmp') src.latWarn = f.latWarn;
          if (f.type === 'icmp') src.lossWarn = f.lossWarn;
          if (f.type === 'snmp') src.utilWarn = f.utilWarn;
          const v = N.validateMonitor(src);
          if (!v.ok) { f.err = v.error; break; }
          if (f.edit < 0 && w.monitors.length >= 40) { f.err = 'มี monitor ได้ไม่เกิน 40 รายการ'; break; }
          if (f.edit >= 0 && w.monitors[f.edit]) w.monitors[f.edit] = v.monitor; else w.monitors.push(v.monitor);
          w.form = Object.assign(blankForm(), { type: f.type, target: f.target, interval: f.interval });
          if (typeof ctx.toast === 'function') ctx.toast('บันทึก monitor แล้ว: ' + v.monitor.name);
          break;
        }
        case 'mon-cancel': w.form = blankForm(); break;
        case 'mon-edit': { const m = w.monitors[i]; if (!m) return; w.form = { type: m.type, target: m.target, port: String(m.port || 443), iface: m.iface || '', interval: String(m.interval), latWarn: m.latWarn == null ? '' : String(m.latWarn), lossWarn: m.lossWarn == null ? '' : String(m.lossWarn), utilWarn: m.utilWarn == null ? '' : String(m.utilWarn), name: m.name, edit: i, err: '' }; render(); const n = root.querySelector('[data-fk="mf-type"]'); if (n) n.focus(); return; }
        case 'mon-del': w.monitors.splice(i, 1); if (w.form.edit === i) w.form = blankForm(); else if (w.form.edit > i) w.form.edit--; break;
        case 'ev-del': w.evidence = w.evidence.filter((x) => x !== Number(id)); break;
        case 'ans-clock': w.answer.time = N.fmtTime(w.clock, true); break;
        case 'push': w.pushRes = N.push(w.inventory, w.template); if (!w.pushRes.devices.some((d) => d.id === w.devSel) && w.pushRes.devices[0]) w.devSel = w.pushRes.devices[0].id; break;
        case 'show': w.devShow = b.getAttribute('data-v'); break;
        case 'pb-add': if (w.playbook.tasks.length < 15) { const a = b.getAttribute('data-v'); const t = { action: a, when: a === 'rollback' ? 'failure' : 'success' }; if (a === 'verify_ping') t.target = 'mgmt'; if (a === 'verify_port') t.port = 22; w.playbook.tasks.push(t); } break;
        case 'pb-up': if (i > 0) { const t = w.playbook.tasks; [t[i - 1], t[i]] = [t[i], t[i - 1]]; render(); const n = root.querySelector(`[data-fk="pb-up-${i - 1}"]`) || root.querySelector(`[data-fk="pb-down-${i - 1}"]`); if (n) n.focus(); return; } break;
        case 'pb-down': { const t = w.playbook.tasks; if (i < t.length - 1) { [t[i + 1], t[i]] = [t[i], t[i + 1]]; render(); const n = root.querySelector(`[data-fk="pb-down-${i + 1}"]`) || root.querySelector(`[data-fk="pb-up-${i + 1}"]`); if (n) n.focus(); return; } break; }
        case 'pb-del': w.playbook.tasks.splice(i, 1); break;
        case 'pb-run': { const su = a2Setup(); if (!su) return; w.runRes = N.runPlaybook(su, w.playbook); w.a2Dev = ''; w.tab = 'run'; render(); const t = root.querySelector('[data-fk="tab-run"]'); if (t) t.focus({ preventScroll: true }); return; }
        case 'submit': submit(); return;
        default: return;
      }
      render();
    }
    function onInput(ev, fromChange) {
      const el = ev.target, w = W();
      if (!fromChange && (el.tagName === 'SELECT' || el.type === 'checkbox' || el.type === 'radio')) return;   // handled once, on change
      if (el.matches('[data-in="clock"]')) { stopPlay(); setClock(Number(el.value)); return; }
      if (el.matches('[data-mf]')) { const k = el.getAttribute('data-mf'); w.form[k] = el.value; if (k === 'type' || k === 'target') { if (k === 'target') w.form.iface = ''; render(); } save(); return; }
      if (el.matches('[data-lf]')) { w.logF[el.getAttribute('data-lf')] = el.value.slice(0, 60); if (el.tagName === 'SELECT') { renderLive(); return; } clearTimeout(typingT); typingT = setTimeout(() => { if (alive) renderLive(); }, 250); return; }
      if (el.matches('[data-ans]')) {
        const k = el.getAttribute('data-ans');
        w.answer[k] = el.type === 'radio' ? el.value : el.value.slice(0, 40);
        if (k === 'bdev') w.answer.biface = ''; if (k === 'tdev') w.answer.tiface = '';
        if (k === 'bdev' || k === 'tdev') render(); else save();
        return;
      }
      if (el.matches('[data-in="inv"]')) { w.inventory = el.value.slice(0, 4000); const p = root.querySelector('[data-part="invprev"]'); if (p) p.innerHTML = invPreview(N.parseInventory(w.inventory)); w.pushRes = null; save(); return; }
      if (el.matches('[data-in="tpl"]')) { w.template = el.value.slice(0, 8000); clearTimeout(typingT); typingT = setTimeout(() => { if (!alive) return; const p = root.querySelector('[data-part="tplprev"]'); if (p) p.innerHTML = tplPreview(); }, 200); w.pushRes = null; save(); return; }
      if (el.matches('[data-in="tpldev"]')) { w.tplDev = el.value; const p = root.querySelector('[data-part="tplprev"]'); if (p) p.innerHTML = tplPreview(); save(); return; }
      if (el.matches('[data-in="ifdev"]')) { w.ifDev = el.value; w.ifSel = ((NET.ifaces[w.ifDev] || [])[0] || {}).name; renderLive(); return; }
      if (el.matches('[data-in="devsel"]')) { w.devSel = el.value; render(); return; }
      if (el.matches('[data-in="a2dev"]')) { w.a2Dev = el.value; render(); return; }
      if (el.matches('[data-in="fatal"]')) { w.playbook.anyErrorsFatal = el.checked; save(); return; }
      if (el.matches('[data-pb]')) {
        const t = w.playbook.tasks[Number(el.getAttribute('data-i'))]; if (!t) return;
        const k = el.getAttribute('data-pb');
        if (k === 'port') { t.port = Number(el.value); save(); return; }
        t[k] = el.value;
        if (k === 'action') { delete t.target; delete t.port; if (t.action === 'verify_ping') t.target = 'mgmt'; if (t.action === 'verify_port') t.port = 22; render(); return; }
        save(); return;
      }
      if (el.matches('[data-ev]')) {
        const id = Number(el.getAttribute('data-ev'));
        if (el.checked) { if (w.evidence.length >= 20) { el.checked = false; if (ctx.toast) ctx.toast('เลือกหลักฐานได้ไม่เกิน 20 บรรทัด'); return; } if (!w.evidence.includes(id)) w.evidence.push(id); }
        else w.evidence = w.evidence.filter((x) => x !== id);
        el.closest('li').classList.toggle(P + '-picked', el.checked);
        const sub = root.querySelector('section[aria-label="ส่งงาน"]');
        if (sub) { const tmp = document.createElement('div'); tmp.innerHTML = submitCard(); sub.replaceWith(tmp.firstElementChild); }
        save();
      }
    }
    function onChange(ev) {
      const el = ev.target;
      if (el.tagName === 'SELECT' || el.type === 'radio' || el.type === 'checkbox') onInput(ev, true);
    }
    function onKeyDown(ev) {
      const t = ev.target;
      if (t.getAttribute && t.getAttribute('role') === 'tab' && ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(ev.key)) {
        const list = TABS[S.mid] || []; const k = list.findIndex(([id]) => id === t.getAttribute('data-id'));
        const n = ev.key === 'Home' ? 0 : ev.key === 'End' ? list.length - 1 : (k + (ev.key === 'ArrowRight' ? 1 : -1) + list.length) % list.length;
        ev.preventDefault(); W().tab = list[n][0]; stopPlay(); render();
        const f = root.querySelector(`[data-fk="tab-${list[n][0]}"]`); if (f) f.focus();
        return;
      }
      if ((ev.key === 'Enter' || ev.key === ' ') && t.getAttribute && t.getAttribute('role') === 'button' && t.tagName !== 'BUTTON') { ev.preventDefault(); t.dispatchEvent(new MouseEvent('click', { bubbles: true })); }
    }
    root.addEventListener('click', onClick);
    root.addEventListener('input', onInput);
    root.addEventListener('change', onChange);
    root.addEventListener('keydown', onKeyDown);
    openMission(S.mid);
    return {
      destroy() {
        alive = false; stopPlay(); clearTimeout(typingT);
        root.removeEventListener('click', onClick); root.removeEventListener('input', onInput);
        root.removeEventListener('change', onChange); root.removeEventListener('keydown', onKeyDown);
        root.innerHTML = '';
      }
    };
  }

  window.NL_SIMS = window.NL_SIMS || {};
  window.NL_SIMS.netops = { title: 'ห้องปฏิบัติการ Network Monitoring และ Automation', mount };
})();

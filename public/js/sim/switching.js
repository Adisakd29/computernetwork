'use strict';
/*!
 * NetLab - Switching & VLAN lab (ห้องปฏิบัติการ Switching และ VLAN)
 *
 * One file, two parts:
 *   1) SwitchSim engine (UMD): pure, deterministic, no DOM. The server requires this file
 *      (server/sims/switching.js -> require('../../public/js/sim/switching.js')) and re-runs the student's
 *      configuration + action log with exactly the same code the browser used.
 *   2) Browser UI: window.NL_SIMS.switching = { mount(root, ctx) } (only defined in a browser).
 *
 * ENGINE MODEL (Layer 2 only, no routers, no inter-VLAN routing)
 *   devices: pc  { id, name, mac, ip, prefix, x, y }           one NIC 'eth0', untagged frames only
 *            hub { id, name, ports:n }                          repeats every frame out all other ports
 *            switch { id, name, mac, ports:{fa:n, gi:m}, vlans:{id:name}, ifs:{port:{mode,vlan,allowed,native,cost,shutdown}},
 *                     stp:{ off:[vlan], prio:{vlan:priority} } }
 *   links:   { id, a, ap, b, bp }
 *   Switch forwarding: classify ingress VLAN (access: untagged -> access VLAN, tagged -> dropped;
 *   trunk: tag -> VLAN if allowed and created, untagged -> native VLAN), drop on STP-blocked ports, learn source MAC
 *   per (VLAN, port), known unicast -> one port (filtered when it is the ingress port), unknown unicast / broadcast ->
 *   flood inside the VLAN except the ingress port; egress on a trunk is tagged unless VLAN == native VLAN.
 *   STP: PVST+-style, one 802.1D instance per VLAN, bridge ID = priority + sys-id-ext (VLAN) + MAC, converged result
 *   (root bridge, root port by lowest root path cost -> sender bridge ID -> sender port ID -> local port ID,
 *   designated / alternate / backup ports). Short-mode default costs: 100 Mb/s = 19, 1 Gb/s = 4. Switches with STP off
 *   and hubs are transparent to BPDUs. PVST+ consistency checks: native VLAN mismatch on a trunk -> the port is
 *   blocked for both native VLANs (PVID_Inc); trunk facing an access port -> the access side is blocked (Type_Inc).
 *   Without STP, a loop makes a broadcast circulate forever (Ethernet has no TTL): the run stops at MAX_EVENTS and the
 *   network is flagged as in a broadcast storm until the configuration changes.
 *   ARP/ICMP: ping = ARP request (broadcast) -> ARP reply (unicast) -> ICMP echo request -> echo reply,
 *   ARP caches on the PCs. Different subnet -> fails at the source (no default gateway / router in this lab).
 */
(function (root) {
  function engine() {
    const VERSION = '1.0.0';
    const BCAST = 'ffff.ffff.ffff';
    const MAX_EVENTS = 3000;          // frame receptions per action before we call it a broadcast storm
    const MAX_TRACE = 400;            // trace entries kept per action
    const DEF_PRIO = 32768;
    const isObj = x => !!x && typeof x === 'object' && !Array.isArray(x);
    const clone = o => JSON.parse(JSON.stringify(o));
    const isInt = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;

    /* ---------- small helpers ---------- */
    function normMac(s) {
      const h = String(s == null ? '' : s).toLowerCase().replace(/[^0-9a-f]/g, '');
      return h.length === 12 ? h.slice(0, 4) + '.' + h.slice(4, 8) + '.' + h.slice(8) : null;
    }
    function ipInt(s) {
      const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(String(s == null ? '' : s).trim());
      if (!m) return null;
      const p = m.slice(1).map(Number);
      if (p.some(x => x > 255)) return null;
      return ((p[0] << 24) >>> 0) + (p[1] << 16) + (p[2] << 8) + p[3];
    }
    const maskInt = pfx => pfx === 0 ? 0 : (0xffffffff << (32 - pfx)) >>> 0;
    const maskStr = pfx => { const m = maskInt(pfx); return [m >>> 24, (m >>> 16) & 255, (m >>> 8) & 255, m & 255].join('.'); };
    function sameSubnet(a, b, pfx) {
      const x = ipInt(a), y = ipInt(b);
      if (x === null || y === null) return false;
      const m = maskInt(pfx);
      return ((x & m) >>> 0) === ((y & m) >>> 0);
    }
    const shortPort = n => String(n).replace(/^fa/, 'Fa').replace(/^gi/, 'Gi');
    const longPort = n => String(n).replace(/^fa/, 'FastEthernet').replace(/^gi/, 'GigabitEthernet');
    const defCost = speed => speed >= 1000 ? 4 : speed >= 100 ? 19 : 100;
    function vlanListStr(arr) {
      if (arr == null) return '1-4094';
      if (!arr.length) return 'none';
      const a = arr.slice().sort((x, y) => x - y), out = [];
      for (let i = 0; i < a.length; i++) {
        let j = i; while (j + 1 < a.length && a[j + 1] === a[j] + 1) j++;
        out.push(j > i + 1 ? a[i] + '-' + a[j] : j === i + 1 ? a[i] + ',' + a[j] : String(a[i]));
        i = j;
      }
      return out.join(',');
    }
    /* "10,20,30-32" -> [10,20,30,31,32] | null when malformed */
    function parseVlanList(s) {
      const t = String(s == null ? '' : s).replace(/\s+/g, '');
      if (!t) return null;
      const out = new Set();
      for (const part of t.split(',')) {
        const m = /^(\d{1,4})(?:-(\d{1,4}))?$/.exec(part);
        if (!m) return null;
        const a = Number(m[1]), b = m[2] ? Number(m[2]) : a;
        if (!isInt(a, 1, 4094) || !isInt(b, 1, 4094) || b < a || b - a > 4094) return null;
        for (let v = a; v <= b; v++) out.add(v);
      }
      return [...out].sort((x, y) => x - y);
    }

    /* ---------- topology normalisation ---------- */
    function portsOf(d) {
      if (d.type === 'pc') return [{ name: 'eth0', speed: 100 }];
      if (d.type === 'hub') { const n = isInt(d.ports, 2, 24) ? d.ports : 4; return Array.from({ length: n }, (_, i) => ({ name: 'p' + (i + 1), speed: 10 })); }
      const p = isObj(d.ports) ? d.ports : { fa: 8, gi: 2 };
      const fa = isInt(p.fa, 0, 48) ? p.fa : 8, gi = isInt(p.gi, 0, 4) ? p.gi : 2;
      const out = [];
      for (let i = 1; i <= fa; i++) out.push({ name: 'fa0/' + i, speed: 100 });
      for (let i = 1; i <= gi; i++) out.push({ name: 'gi0/' + i, speed: 1000 });
      return out;
    }
    function defIf() { return { mode: 'access', vlan: 1, allowed: null, native: 1, cost: null, shutdown: false }; }
    function normalize(topo) {
      const t = isObj(topo) ? topo : {};
      const devices = [], seen = new Set();
      for (const d0 of Array.isArray(t.devices) ? t.devices : []) {
        if (!isObj(d0) || typeof d0.id !== 'string' || seen.has(d0.id) || !['pc', 'hub', 'switch'].includes(d0.type)) continue;
        seen.add(d0.id);
        const d = { id: d0.id, type: d0.type, name: String(d0.name || d0.id).slice(0, 24), x: Number(d0.x) || 0, y: Number(d0.y) || 0 };
        d.portList = portsOf(d0);
        if (d0.type === 'hub') d.ports = d.portList.length;
        if (d0.type === 'pc') {
          d.mac = normMac(d0.mac) || '0050.7966.' + ('0000' + devices.length.toString(16)).slice(-4);
          d.ip = ipInt(d0.ip) !== null ? String(d0.ip).trim() : '';
          d.prefix = isInt(d0.prefix, 1, 32) ? d0.prefix : 24;
          if (d0.group) d.group = String(d0.group).slice(0, 24);
        }
        if (d0.type === 'switch') {
          d.ports = isObj(d0.ports) ? { fa: d0.ports.fa, gi: d0.ports.gi } : { fa: 8, gi: 2 };
          d.mac = normMac(d0.mac) || '0019.e800.' + ('0000' + devices.length.toString(16)).slice(-4);
          d.vlans = { 1: 'default' };
          if (isObj(d0.vlans)) for (const k of Object.keys(d0.vlans)) { const v = Number(k); if (isInt(v, 2, 4094)) d.vlans[v] = String(d0.vlans[k]).slice(0, 32); }
          d.ifs = {};
          for (const p of d.portList) {
            const s = isObj(d0.ifs) && isObj(d0.ifs[p.name]) ? d0.ifs[p.name] : {};
            const f = defIf();
            if (s.mode === 'trunk') f.mode = 'trunk';
            if (isInt(s.vlan, 1, 4094)) f.vlan = s.vlan;
            if (Array.isArray(s.allowed)) f.allowed = [...new Set(s.allowed.filter(v => isInt(v, 1, 4094)))].sort((a, b) => a - b);
            if (isInt(s.native, 1, 4094)) f.native = s.native;
            if (isInt(s.cost, 1, 65535)) f.cost = s.cost;
            f.shutdown = s.shutdown === true;
            d.ifs[p.name] = f;
          }
          const st = isObj(d0.stp) ? d0.stp : {};
          d.stp = { off: Array.isArray(st.off) ? [...new Set(st.off.filter(v => isInt(v, 1, 4094)))].sort((a, b) => a - b) : [], prio: {} };
          if (isObj(st.prio)) for (const k of Object.keys(st.prio)) { const v = Number(k), p = st.prio[k]; if (isInt(v, 1, 4094) && isInt(p, 0, 61440) && p % 4096 === 0) d.stp.prio[v] = p; }
        }
        devices.push(d);
      }
      const byId = Object.create(null); devices.forEach(d => { byId[d.id] = d; });
      const links = [], used = new Set();
      for (const l of Array.isArray(t.links) ? t.links : []) {
        if (!isObj(l)) continue;
        const A = byId[l.a], B = byId[l.b];
        if (!A || !B || A === B) continue;
        if (!A.portList.some(p => p.name === l.ap) || !B.portList.some(p => p.name === l.bp)) continue;
        const ka = l.a + '|' + l.ap, kb = l.b + '|' + l.bp;
        if (used.has(ka) || used.has(kb)) continue;
        used.add(ka); used.add(kb);
        links.push({ id: String(l.id || 'l' + (links.length + 1)), a: l.a, ap: l.ap, b: l.b, bp: l.bp });
      }
      return { devices, links };
    }
    /* the editable part of a topology (what the student submits) */
    function exportConfig(topo) {
      const out = {};
      for (const d of topo.devices) {
        if (d.type !== 'switch') continue;
        const ifs = {};
        for (const p of d.portList) { const f = d.ifs[p.name]; ifs[p.name] = { mode: f.mode, vlan: f.vlan, allowed: f.allowed == null ? 'all' : f.allowed.slice(), native: f.native, cost: f.cost, shutdown: f.shutdown }; }
        out[d.id] = { vlans: Object.keys(d.vlans).map(Number).sort((a, b) => a - b).map(id => ({ id, name: d.vlans[id] })), ifs, stp: { off: d.stp.off.slice(), prio: Object.assign({}, d.stp.prio) } };
      }
      return out;
    }
    const NAME_RE = /^[\x21-\x7e][\x20-\x7e]{0,31}$/;
    /* apply a submitted config to a trusted (normalised) start topology.
       Strict: anything malformed -> { ok:false, error } (Thai). Unknown switches / ports are ignored. */
    function applyConfig(start, cfg) {
      const topo = clone(start);
      if (cfg == null) return { ok: true, topo };
      if (!isObj(cfg)) return { ok: false, error: 'ข้อมูลการตั้งค่า (config) ไม่ถูกต้อง' };
      for (const d of topo.devices) {
        if (d.type !== 'switch' || !Object.prototype.hasOwnProperty.call(cfg, d.id)) continue;
        const c = cfg[d.id], who = d.name;
        if (!isObj(c)) return { ok: false, error: `การตั้งค่าของ ${who} ไม่ถูกต้อง` };
        if (c.vlans !== undefined) {
          if (!Array.isArray(c.vlans) || c.vlans.length > 64) return { ok: false, error: `VLAN database ของ ${who} ไม่ถูกต้อง (สูงสุด 64 VLAN)` };
          const vl = { 1: 'default' };
          for (const v of c.vlans) {
            if (!isObj(v) || !isInt(v.id, 1, 4094)) return { ok: false, error: `VLAN database ของ ${who}: หมายเลข VLAN ต้องอยู่ระหว่าง 1–4094` };
            if (v.id === 1) continue;
            const name = v.name == null || v.name === '' ? 'VLAN' + ('000' + v.id).slice(-4) : v.name;
            if (typeof name !== 'string' || !NAME_RE.test(name)) return { ok: false, error: `ชื่อ VLAN ${v.id} บน ${who} ไม่ถูกต้อง (ใช้ตัวอักษรภาษาอังกฤษ/ตัวเลข ไม่เกิน 32 ตัว)` };
            vl[v.id] = name;
          }
          d.vlans = vl;
        }
        if (c.ifs !== undefined) {
          if (!isObj(c.ifs)) return { ok: false, error: `การตั้งค่าพอร์ตของ ${who} ไม่ถูกต้อง` };
          for (const p of d.portList) {
            if (!Object.prototype.hasOwnProperty.call(c.ifs, p.name)) continue;
            const s = c.ifs[p.name], f = d.ifs[p.name], pn = `${who} ${shortPort(p.name)}`;
            if (!isObj(s)) return { ok: false, error: `การตั้งค่าพอร์ต ${pn} ไม่ถูกต้อง` };
            if (s.mode !== undefined) { if (s.mode !== 'access' && s.mode !== 'trunk') return { ok: false, error: `${pn}: mode ต้องเป็น access หรือ trunk` }; f.mode = s.mode; }
            if (s.vlan !== undefined) { if (!isInt(s.vlan, 1, 4094)) return { ok: false, error: `${pn}: access VLAN ต้องอยู่ระหว่าง 1–4094` }; f.vlan = s.vlan; }
            if (s.native !== undefined) { if (!isInt(s.native, 1, 4094)) return { ok: false, error: `${pn}: native VLAN ต้องอยู่ระหว่าง 1–4094` }; f.native = s.native; }
            if (s.allowed !== undefined) {
              if (s.allowed === 'all' || s.allowed === null) f.allowed = null;
              else if (Array.isArray(s.allowed) && s.allowed.length <= 4094 && s.allowed.every(v => isInt(v, 1, 4094))) f.allowed = [...new Set(s.allowed)].sort((a, b) => a - b);
              else return { ok: false, error: `${pn}: allowed VLAN list ไม่ถูกต้อง` };
            }
            if (s.cost !== undefined) { if (s.cost === null) f.cost = null; else if (isInt(s.cost, 1, 65535)) f.cost = s.cost; else return { ok: false, error: `${pn}: spanning-tree cost ต้องอยู่ระหว่าง 1–65535` }; }
            if (s.shutdown !== undefined) { if (typeof s.shutdown !== 'boolean') return { ok: false, error: `${pn}: shutdown ไม่ถูกต้อง` }; f.shutdown = s.shutdown; }
          }
        }
        if (c.stp !== undefined) {
          if (!isObj(c.stp)) return { ok: false, error: `การตั้งค่า spanning-tree ของ ${who} ไม่ถูกต้อง` };
          if (c.stp.off !== undefined) {
            if (!Array.isArray(c.stp.off) || c.stp.off.length > 4094 || !c.stp.off.every(v => isInt(v, 1, 4094))) return { ok: false, error: `spanning-tree ของ ${who}: รายการ VLAN ที่ปิด STP ไม่ถูกต้อง` };
            d.stp.off = [...new Set(c.stp.off)].sort((a, b) => a - b);
          }
          if (c.stp.prio !== undefined) {
            if (!isObj(c.stp.prio)) return { ok: false, error: `spanning-tree priority ของ ${who} ไม่ถูกต้อง` };
            const pr = {};
            const keys = Object.keys(c.stp.prio);
            if (keys.length > 64) return { ok: false, error: `spanning-tree priority ของ ${who} มีมากเกินไป` };
            for (const k of keys) {
              const v = Number(k), p = c.stp.prio[k];
              if (!isInt(v, 1, 4094)) return { ok: false, error: `spanning-tree priority ของ ${who}: VLAN ${k} ไม่ถูกต้อง` };
              if (!isInt(p, 0, 61440) || p % 4096 !== 0) return { ok: false, error: `${who}: bridge priority ของ VLAN ${v} ต้องเป็น 0–61440 และเป็นผลคูณของ 4096 (ได้ ${String(p).slice(0, 12)})` };
              pr[v] = p;
            }
            d.stp.prio = pr;
          }
        }
      }
      return { ok: true, topo };
    }

    /* ---------- the network instance ---------- */
    function create(topo) {
      const T = normalize(topo);
      const dev = Object.create(null); T.devices.forEach(d => { dev[d.id] = d; });
      const peer = Object.create(null);
      for (const l of T.links) { peer[l.a + '|' + l.ap] = { dev: l.b, port: l.bp, link: l.id }; peer[l.b + '|' + l.bp] = { dev: l.a, port: l.ap, link: l.id }; }
      const macT = Object.create(null), arp = Object.create(null), counters = Object.create(null);
      T.devices.forEach(d => { if (d.type === 'switch') macT[d.id] = new Map(); if (d.type === 'pc') arp[d.id] = new Map(); });
      T.links.forEach(l => { counters[l.id] = 0; });
      const stpCache = {};
      const net = { topo: T, storm: null, totalFrames: 0, counters, frameSeq: 0 };

      const vlanExists = (sw, v) => sw.vlans[v] !== undefined;
      const portIndex = (sw, p) => sw.portList.findIndex(x => x.name === p) + 1;
      const portCost = (sw, p) => { const f = sw.ifs[p]; if (f.cost) return f.cost; const pp = sw.portList.find(x => x.name === p); return defCost(pp ? pp.speed : 100); };
      function carries(sw, p, v) {
        const f = sw.ifs[p];
        if (!f || f.shutdown || !vlanExists(sw, v)) return false;
        if (f.mode === 'access') return f.vlan === v;
        return f.allowed == null || f.allowed.includes(v);
      }
      const stpOn = (sw, v) => vlanExists(sw, v) && !sw.stp.off.includes(v);
      const prioOf = (sw, v) => sw.stp.prio[v] !== undefined ? sw.stp.prio[v] : DEF_PRIO;
      const bid = (sw, v) => ({ prio: prioOf(sw, v) + v, mac: sw.mac, id: sw.id });
      const cmpBid = (a, b) => a.prio !== b.prio ? a.prio - b.prio : a.mac < b.mac ? -1 : a.mac > b.mac ? 1 : 0;
      function linkUp(dId, p) {
        const pr = peer[dId + '|' + p];
        if (!pr) return false;
        const a = dev[dId], b = dev[pr.dev];
        if (a.type === 'switch' && a.ifs[p].shutdown) return false;
        if (b.type === 'switch' && b.ifs[pr.port].shutdown) return false;
        return true;
      }

      /* ---- spanning tree (per VLAN) ---- */
      function stp(v) {
        if (stpCache[v]) return stpCache[v];
        const parent = {};
        const find = x => { if (parent[x] === undefined) parent[x] = x; while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
        const uni = (x, y) => { const a = find(x), b = find(y); if (a !== b) parent[a] = b; };
        for (const l of T.links) if (linkUp(l.a, l.ap)) uni(l.a + '|' + l.ap, l.b + '|' + l.bp);
        for (const d of T.devices) {
          let carry = null;
          if (d.type === 'hub') carry = d.portList.map(p => p.name);
          else if (d.type === 'switch' && !stpOn(d, v)) carry = d.portList.map(p => p.name).filter(p => carries(d, p, v));   // BPDUs flooded like data
          if (carry) for (let i = 1; i < carry.length; i++) uni(d.id + '|' + carry[0], d.id + '|' + carry[i]);
        }
        const bridges = T.devices.filter(d => d.type === 'switch' && stpOn(d, v));
        const parts = [];      // { sw, port, seg, pid, cost }
        for (const b of bridges) for (const p of b.portList) {
          if (!carries(b, p.name, v) || !linkUp(b.id, p.name)) continue;
          parts.push({ sw: b, port: p.name, seg: find(b.id + '|' + p.name), pid: portIndex(b, p.name), cost: portCost(b, p.name) });
        }
        const bySeg = {}; parts.forEach(x => { (bySeg[x.seg] = bySeg[x.seg] || []).push(x); });
        const st = {}; bridges.forEach(b => { st[b.id] = { root: bid(b, v), cost: 0, rp: null }; });
        const cmpVec = (a, b) => { for (let i = 0; i < a.length; i++) { const c = typeof a[i] === 'object' ? cmpBid(a[i], b[i]) : a[i] - b[i]; if (c) return c; } return 0; };
        for (let it = 0; it < 200; it++) {
          let changed = false;
          const next = {};
          for (const b of bridges) {
            let best = null, bestPort = null;
            for (const p of parts) {
              if (p.sw !== b) continue;
              for (const q of bySeg[p.seg]) {
                if (q.sw === b) continue;
                const s = st[q.sw.id];
                const vec = [s.root, s.cost + p.cost, bid(q.sw, v), q.pid, p.pid];
                if (!best || cmpVec(vec, best) < 0) { best = vec; bestPort = p.port; }
              }
            }
            const own = bid(b, v);
            next[b.id] = best && cmpBid(best[0], own) < 0 ? { root: best[0], cost: best[1], rp: bestPort } : { root: own, cost: 0, rp: null };
            const o = st[b.id], n = next[b.id];
            if (cmpBid(o.root, n.root) !== 0 || o.cost !== n.cost || o.rp !== n.rp) changed = true;
          }
          Object.assign(st, next);
          if (!changed) break;
        }
        const ports = {};
        for (const p of parts) {
          const s = st[p.sw.id];
          const offered = x => [st[x.sw.id].root, st[x.sw.id].cost, bid(x.sw, v), x.pid];
          let role;
          if (s.rp === p.port) role = 'root';
          else {
            const mine = offered(p);
            let bestOther = null;
            for (const q of bySeg[p.seg]) { if (q === p) continue; if (!bestOther || cmpVec(offered(q), offered(bestOther)) < 0) bestOther = q; }
            if (!bestOther || cmpVec(mine, offered(bestOther)) < 0) role = 'designated';
            else role = bestOther.sw === p.sw ? 'backup' : 'alternate';
          }
          ports[p.sw.id + '|' + p.port] = { sw: p.sw.id, port: p.port, role, state: role === 'root' || role === 'designated' ? 'FWD' : 'BLK', cost: p.cost, pid: p.pid, inc: null };
        }
        // PVST+ consistency checks on direct switch-to-switch links
        for (const l of T.links) {
          const A = dev[l.a], B = dev[l.b];
          if (A.type !== 'switch' || B.type !== 'switch' || !linkUp(l.a, l.ap)) continue;
          const fa = A.ifs[l.ap], fb = B.ifs[l.bp];
          const mark = (sw, port, why) => { const k = sw.id + '|' + port; if (ports[k]) { ports[k].inc = why; ports[k].state = 'BLK'; } };
          if (fa.mode === 'trunk' && fb.mode === 'trunk' && fa.native !== fb.native && (v === fa.native || v === fb.native)) { mark(A, l.ap, 'PVID_Inc'); mark(B, l.bp, 'PVID_Inc'); }
          if (fa.mode !== fb.mode) {
            const [acc, accP, trk] = fa.mode === 'access' ? [A, l.ap, B] : [B, l.bp, A];
            if (acc.ifs[accP].vlan === v && Object.keys(trk.vlans).some(x => stpOn(trk, Number(x)))) mark(acc, accP, 'Type_Inc');
          }
        }
        const bridgesOut = {};
        for (const b of bridges) {
          const s = st[b.id];
          bridgesOut[b.id] = { bid: bid(b, v), prio: prioOf(b, v), root: s.root, rootId: s.root.id, cost: s.cost, rootPort: s.rp, isRoot: s.root.id === b.id };
        }
        const roots = [...new Set(bridges.map(b => st[b.id].root.id))];
        return (stpCache[v] = { vlan: v, bridges: bridgesOut, ports, roots });
      }
      function fwd(sw, p, v) {
        if (!stpOn(sw, v)) return true;
        const i = stp(v).ports[sw.id + '|' + p];
        return !i || i.state === 'FWD';
      }

      /* ---- frame engine ---- */
      function classify(sw, p, tag) {
        const f = sw.ifs[p];
        if (f.shutdown) return { drop: 'shutdown' };
        if (f.mode === 'access') {
          if (tag != null) return { drop: 'tagged_on_access', tag };
          if (!vlanExists(sw, f.vlan)) return { drop: 'vlan_missing', vlan: f.vlan };
          return { vlan: f.vlan };
        }
        const v = tag != null ? tag : f.native;
        if (!vlanExists(sw, v)) return { drop: 'vlan_missing', vlan: v, tagged: tag != null };
        if (f.allowed != null && !f.allowed.includes(v)) return { drop: 'not_allowed', vlan: v, tagged: tag != null };
        return { vlan: v };
      }
      const egressTag = (sw, p, v) => sw.ifs[p].mode === 'trunk' && v !== sw.ifs[p].native ? v : null;

      function newCtx() { return { q: [], qi: 0, entries: [], events: 0, storm: false, truncated: false, got: {} }; }
      function record(ctx, e) { e.n = ctx.entries.length + 1; if (ctx.entries.length < MAX_TRACE) ctx.entries.push(e); else ctx.truncated = true; }
      function send(ctx, dId, p, frame, tag) {
        const pr = peer[dId + '|' + p];
        if (!pr || !linkUp(dId, p)) return false;
        counters[pr.link]++; net.totalFrames++;
        ctx.q.push({ dev: pr.dev, port: pr.port, frame, tag, fromDev: dId, fromPort: p, link: pr.link });
        return true;
      }
      function summary(f) { return { id: f.id, kind: f.kind, src: f.src, dst: f.dst, sip: f.sip, tip: f.tip }; }
      function hostSend(ctx, pc, frame) {
        frame.id = ++net.frameSeq;
        record(ctx, { dev: pc.id, port: null, frame: summary(frame), tag: null, action: 'send', out: ['eth0'], outTags: { eth0: null } });
        send(ctx, pc.id, 'eth0', frame, null);
      }
      function drain(ctx) {
        while (ctx.qi < ctx.q.length) {
          if (ctx.events >= MAX_EVENTS) { ctx.storm = true; ctx.q.length = 0; ctx.qi = 0; return; }
          const it = ctx.q[ctx.qi++]; ctx.events++;
          const d = dev[it.dev], f = it.frame;
          const base = { dev: d.id, port: it.port, frame: summary(f), tag: it.tag, from: it.fromDev, fromPort: it.fromPort, link: it.link };
          if (d.type === 'hub') {
            const out = d.portList.map(p => p.name).filter(p => p !== it.port && peer[d.id + '|' + p]);
            const outTags = {}; out.forEach(p => { outTags[p] = it.tag; });
            record(ctx, Object.assign(base, { action: 'repeat', out, outTags }));
            out.forEach(p => send(ctx, d.id, p, f, it.tag));
          } else if (d.type === 'pc') {
            if (it.tag != null) { record(ctx, Object.assign(base, { action: 'drop', reason: 'tagged_to_pc' })); continue; }
            if (f.dst !== d.mac && f.dst !== BCAST) { record(ctx, Object.assign(base, { action: 'ignore', reason: 'not_mine' })); continue; }
            record(ctx, Object.assign(base, { action: 'accept' }));
            hostReceive(ctx, d, f);
          } else {
            const c = classify(d, it.port, it.tag);
            if (c.drop) { record(ctx, Object.assign(base, { action: 'drop', reason: c.drop, vlan: c.vlan })); continue; }
            const v = c.vlan;
            if (!fwd(d, it.port, v)) { record(ctx, Object.assign(base, { action: 'drop', reason: 'stp_blocked', vlan: v })); continue; }
            const T2 = macT[d.id];
            let learned = null;
            if (f.src !== BCAST) {
              const key = v + '|' + f.src, prev = T2.get(key);
              if (!prev || prev.port !== it.port) learned = { mac: f.src, port: it.port, vlan: v, moved: prev ? prev.port : null };
              else learned = { mac: f.src, port: it.port, vlan: v, refresh: true };
              T2.set(key, { vlan: v, mac: f.src, port: it.port });
            }
            const known = f.dst === BCAST ? null : T2.get(v + '|' + f.dst);
            let out, action;
            if (!known) {
              out = d.portList.map(p => p.name).filter(p => p !== it.port && peer[d.id + '|' + p] && linkUp(d.id, p) && carries(d, p, v) && fwd(d, p, v));
              action = f.dst === BCAST ? 'flood' : 'flood_unknown';
            } else if (known.port === it.port) { out = []; action = 'filter'; }
            else if (carries(d, known.port, v) && fwd(d, known.port, v) && linkUp(d.id, known.port)) { out = [known.port]; action = 'forward'; }
            else { out = []; action = 'drop'; }
            const outTags = {}; out.forEach(p => { outTags[p] = egressTag(d, p, v); });
            record(ctx, Object.assign(base, { action, vlan: v, out, outTags, learned, reason: action === 'drop' ? 'egress_down' : undefined }));
            out.forEach(p => send(ctx, d.id, p, f, outTags[p]));
          }
        }
      }
      function hostReceive(ctx, pc, f) {
        if (f.kind === 'arp-req') {
          if (f.tip === pc.ip && pc.ip) {
            arp[pc.id].set(f.sip, f.src);
            ctx.got['arpreq:' + pc.id] = true;
            hostSend(ctx, pc, { kind: 'arp-rep', src: pc.mac, dst: f.src, sip: pc.ip, tip: f.sip });
          }
        } else if (f.kind === 'arp-rep') {
          if (f.dst === pc.mac && f.tip === pc.ip) arp[pc.id].set(f.sip, f.src);
        } else if (f.kind === 'icmp-req') {
          if (f.tip === pc.ip) ctx.got.req = ctx.got.req || pc.id;
        } else if (f.kind === 'icmp-rep') {
          if (f.tip === pc.ip) ctx.got.rep = pc.id;
        } else if (f.kind === 'test') {
          (ctx.got.test = ctx.got.test || []).push(pc.id);
        }
      }
      function finish(ctx, r) {
        r.entries = ctx.entries; r.truncated = ctx.truncated; r.events = ctx.events;
        r.reasonText = REASON_TEXT[r.reason] || '';
        return r;
      }
      function resolve(ctx, pc, ip) {
        if (arp[pc.id].has(ip)) return true;
        hostSend(ctx, pc, { kind: 'arp-req', src: pc.mac, dst: BCAST, sip: pc.ip, tip: ip });
        drain(ctx);
        return !ctx.storm && arp[pc.id].has(ip);
      }
      net.ping = function (srcId, dstIp) {
        const s = dev[srcId];
        const r = { op: 'ping', src: srcId, dst: String(dstIp || ''), ok: false, reason: '', arp: false, storm: false, dstId: null };
        const ctx = newCtx();
        if (!s || s.type !== 'pc') { r.reason = 'bad_src'; return finish(ctx, r); }
        if (!s.ip) { r.reason = 'no_ip'; return finish(ctx, r); }
        if (ipInt(dstIp) === null) { r.reason = 'bad_target'; return finish(ctx, r); }
        if (dstIp === s.ip) { r.ok = true; r.reason = 'self'; r.dstId = s.id; return finish(ctx, r); }
        if (!sameSubnet(s.ip, dstIp, s.prefix)) { r.reason = 'diff_subnet'; return finish(ctx, r); }
        if (net.storm) { r.reason = 'storm'; r.storm = true; return finish(ctx, r); }
        const fail = why => { if (ctx.storm) { why = 'storm'; r.storm = true; net.storm = { frames: ctx.events }; } r.reason = why; return finish(ctx, r); };
        r.arp = !arp[s.id].has(dstIp);
        if (!resolve(ctx, s, dstIp)) return fail('arp_fail');
        hostSend(ctx, s, { kind: 'icmp-req', src: s.mac, dst: arp[s.id].get(dstIp), sip: s.ip, tip: dstIp });
        drain(ctx);
        if (ctx.storm) return fail('storm');
        const d = ctx.got.req ? dev[ctx.got.req] : null;
        if (!d) return fail('icmp_lost');
        r.dstId = d.id;
        if (!resolve(ctx, d, s.ip)) return fail('reply_fail');
        hostSend(ctx, d, { kind: 'icmp-rep', src: d.mac, dst: arp[d.id].get(s.ip), sip: d.ip, tip: s.ip });
        drain(ctx);
        if (ctx.storm) return fail('storm');
        if (ctx.got.rep !== s.id) return fail('reply_fail');
        r.ok = true; r.reason = 'ok';
        return finish(ctx, r);
      };
      /* a broadcast test frame from one PC (does not touch ARP caches) */
      net.broadcast = function (srcId) {
        const s = dev[srcId], ctx = newCtx();
        const r = { op: 'bcast', src: srcId, ok: false, reached: [], storm: false };
        if (!s || s.type !== 'pc') { r.reason = 'bad_src'; return finish(ctx, r); }
        if (net.storm) { r.reason = 'storm'; r.storm = true; return finish(ctx, r); }
        hostSend(ctx, s, { kind: 'test', src: s.mac, dst: BCAST, sip: s.ip, tip: '' });
        drain(ctx);
        if (ctx.storm) { r.storm = true; net.storm = { frames: ctx.events }; r.reason = 'storm'; }
        else { r.ok = true; r.reason = 'ok'; }
        r.reached = [...new Set(ctx.got.test || [])].filter(x => x !== srcId);
        return finish(ctx, r);
      };
      net.clear = function (what) {
        if (!what || what === 'mac') Object.values(macT).forEach(m => m.clear());
        if (!what || what === 'arp') Object.values(arp).forEach(m => m.clear());
        if (!what) { net.storm = null; Object.keys(counters).forEach(k => { counters[k] = 0; }); net.totalFrames = 0; }
      };
      net.macTable = id => macT[id] ? [...macT[id].values()].sort((a, b) => a.vlan - b.vlan || (portIndex(dev[id], a.port) - portIndex(dev[id], b.port)) || (a.mac < b.mac ? -1 : 1)).map(e => Object.assign({}, e)) : [];
      net.arp = id => arp[id] ? [...arp[id].entries()].map(([ip, mac]) => ({ ip, mac })) : [];
      net.stp = v => stp(Number(v));
      net.stpOn = (id, v) => !!dev[id] && dev[id].type === 'switch' && stpOn(dev[id], v);
      net.carries = (id, p, v) => !!dev[id] && dev[id].type === 'switch' && carries(dev[id], p, v);
      net.forwarding = (id, p, v) => fwd(dev[id], p, v);
      net.portCost = (id, p) => portCost(dev[id], p);
      net.peer = (id, p) => peer[id + '|' + p] || null;
      net.linkUp = (id, p) => linkUp(id, p);
      net.dev = id => dev[id] || null;
      /* VLANs that actually exist somewhere (for STP views) */
      net.vlans = () => { const s = new Set(); T.devices.forEach(d => { if (d.type === 'switch') Object.keys(d.vlans).forEach(v => s.add(Number(v))); }); return [...s].sort((a, b) => a - b); };
      /* native VLAN mismatches on direct trunks (what CDP reports) */
      net.nativeMismatches = () => T.links.filter(l => dev[l.a].type === 'switch' && dev[l.b].type === 'switch').map(l => ({ l, A: dev[l.a], B: dev[l.b] }))
        .filter(x => x.A.ifs[x.l.ap].mode === 'trunk' && x.B.ifs[x.l.bp].mode === 'trunk' && x.A.ifs[x.l.ap].native !== x.B.ifs[x.l.bp].native)
        .map(x => ({ a: x.A.id, ap: x.l.ap, an: x.A.ifs[x.l.ap].native, b: x.B.id, bp: x.l.bp, bn: x.B.ifs[x.l.bp].native }));
      /* collision domains: every link is one segment, a hub joins all segments attached to it */
      net.collisionDomains = function (aroundId) {
        const parent = {};
        const find = x => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
        T.links.forEach(l => { parent[l.id] = l.id; });
        for (const d of T.devices) if (d.type === 'hub') {
          const ls = T.links.filter(l => l.a === d.id || l.b === d.id).map(l => l.id);
          for (let i = 1; i < ls.length; i++) parent[find(ls[i])] = find(ls[0]);
        }
        let links = T.links;
        if (aroundId) {   // only the physically connected part around a device
          const comp = new Set([aroundId]); let grew = true;
          while (grew) { grew = false; for (const l of T.links) { if (comp.has(l.a) !== comp.has(l.b)) { comp.add(l.a); comp.add(l.b); grew = true; } } }
          links = T.links.filter(l => comp.has(l.a));
        }
        const groups = {};
        links.forEach(l => { const r = find(l.id); (groups[r] = groups[r] || []).push(l.id); });
        return Object.values(groups);
      };
      return net;
    }

    /* replay an action log on a fresh network built from topo */
    const MAX_ACTIONS = 80;
    function run(topo, actions) {
      const net = create(topo);
      const results = [];
      for (const a of (Array.isArray(actions) ? actions : []).slice(0, MAX_ACTIONS)) {
        if (!isObj(a)) { results.push(null); continue; }
        if (a.op === 'ping') results.push(net.ping(String(a.src || '').slice(0, 40), String(a.dst || '').slice(0, 40)));
        else if (a.op === 'bcast') results.push(net.broadcast(String(a.src || '').slice(0, 40)));
        else if (a.op === 'clear') {
          const what = a.what === 'mac' || a.what === 'arp' ? a.what : 'both';
          if (what !== 'arp') net.clear('mac');
          if (what !== 'mac') net.clear('arp');
          results.push({ op: 'clear', what });
        }
        else results.push(null);
      }
      return { net, results };
    }

    const REASON_TEXT = {
      ok: 'สำเร็จ: ได้รับ Echo Reply กลับมา',
      self: 'ping IP ของตัวเอง (loopback) สำเร็จโดยไม่มีเฟรมออกสาย',
      bad_src: 'ไม่พบเครื่องต้นทาง',
      no_ip: 'เครื่องต้นทางยังไม่มี IP',
      bad_target: 'IP ปลายทางไม่ถูกต้อง',
      diff_subnet: 'ปลายทางอยู่คนละ subnet (คนละวงเครือข่าย) เครื่องต้องส่งผ่าน Default gateway (Router) แต่แล็บนี้ไม่มี Router และไม่มี inter-VLAN routing จึงส่งไม่ได้ตั้งแต่ต้นทาง (ไม่ส่ง ARP ออกไปเลย)',
      arp_fail: 'ส่ง ARP request (broadcast) แล้วไม่มีใครตอบ: เครื่องปลายทางไม่ได้อยู่ใน broadcast domain (VLAN) เดียวกัน หรือทาง Layer 2 ถูกตัด เช่น VLAN ของพอร์ตไม่ตรง ไม่ได้อนุญาต VLAN บน trunk ยังไม่ได้สร้าง VLAN หรือพอร์ตถูก block',
      icmp_lost: 'Echo Request ไปไม่ถึงเครื่องปลายทาง',
      reply_fail: 'ปลายทางได้รับ Echo Request แล้ว แต่ Echo Reply กลับมาไม่ถึง',
      storm: 'เกิด broadcast storm: เฟรม broadcast วนซ้ำไม่รู้จบใน loop (เฟรม Ethernet ไม่มี TTL) ลิงก์และ CPU ของสวิตช์เต็ม ตาราง MAC กระโดดไปมา เครือข่ายใช้งานไม่ได้ ต้องเปิด Spanning Tree หรือถอดสายที่ทำให้เกิด loop'
    };
    const DROP_TEXT = {
      shutdown: 'พอร์ตถูก shutdown',
      tagged_on_access: 'เฟรมมี 802.1Q tag แต่พอร์ตนี้เป็น access จึงทิ้ง',
      vlan_missing: 'VLAN นี้ยังไม่ได้สร้างใน VLAN database ของสวิตช์ จึงทิ้งเฟรม',
      not_allowed: 'VLAN นี้ไม่อยู่ใน allowed VLAN list ของ trunk จึงทิ้งเฟรม',
      stp_blocked: 'พอร์ตอยู่สถานะ Blocking ของ STP จึงทิ้งเฟรมข้อมูล',
      tagged_to_pc: 'เฟรมมี 802.1Q tag ซึ่ง PC ไม่รู้จัก จึงทิ้ง',
      not_mine: 'MAC ปลายทางไม่ใช่ของเครื่องนี้ NIC จึงทิ้งเฟรม',
      egress_down: 'พอร์ตปลายทางใช้ส่งไม่ได้'
    };
    const KIND_TEXT = { 'arp-req': 'ARP Request', 'arp-rep': 'ARP Reply', 'icmp-req': 'ICMP Echo Request', 'icmp-rep': 'ICMP Echo Reply', test: 'Broadcast ทดสอบ' };

    /* Thai one-line description of a trace entry */
    function describe(e, net) {
      const nm = id => { const d = net.dev(id); return d ? d.name : id; };
      const P = p => shortPort(p);
      const tagT = t => t == null ? 'ไม่มี tag' : '802.1Q tag VLAN ' + t;
      const k = KIND_TEXT[e.frame.kind] || e.frame.kind;
      const outs = (e.out || []).map(p => P(p) + (e.outTags && e.outTags[p] != null ? ' (tag ' + e.outTags[p] + ')' : '')).join(', ');
      switch (e.action) {
        case 'send': return `${nm(e.dev)} ส่ง ${k} จาก ${e.frame.src} ถึง ${e.frame.dst}` + (e.frame.kind === 'arp-req' ? ` ถามว่า "ใครคือ ${e.frame.tip}"` : e.frame.kind === 'arp-rep' ? ` ตอบว่า "${e.frame.sip} อยู่ที่ ${e.frame.src}"` : '');
        case 'repeat': return `${nm(e.dev)} (Hub) รับสัญญาณที่ ${e.port} แล้วทวนสัญญาณออกทุกพอร์ตที่เหลือ: ${(e.out || []).join(', ') || '-'}`;
        case 'accept': return `${nm(e.dev)} รับ ${k} (MAC ปลายทาง ${e.frame.dst === BCAST ? 'broadcast' : 'ตรงกับตัวเอง'})`;
        case 'ignore': return `${nm(e.dev)} เห็นเฟรม ${k} แต่ ${DROP_TEXT.not_mine}`;
        case 'drop': return `${nm(e.dev)} ${e.port && net.dev(e.dev).type === 'switch' ? P(e.port) + ' ' : ''}ทิ้ง ${k}: ${DROP_TEXT[e.reason] || e.reason}${e.vlan ? ' (VLAN ' + e.vlan + ')' : ''}`;
        default: {
          let s = `${nm(e.dev)} รับ ${k} ที่ ${P(e.port)} (${tagT(e.tag)} -> VLAN ${e.vlan})`;
          if (e.learned && !e.learned.refresh) s += e.learned.moved ? ` · MAC ${e.learned.mac} ย้ายจาก ${P(e.learned.moved)} มาที่ ${P(e.learned.port)}` : ` · เรียนรู้ ${e.learned.mac} อยู่ที่ ${P(e.learned.port)}`;
          if (e.action === 'flood') s += ` · broadcast จึง flood ใน VLAN ${e.vlan} ออก ${outs || '(ไม่มีพอร์ตอื่น)'}`;
          else if (e.action === 'flood_unknown') s += ` · ยังไม่รู้จัก ${e.frame.dst} (unknown unicast) จึง flood ออก ${outs || '(ไม่มีพอร์ตอื่น)'}`;
          else if (e.action === 'forward') s += ` · รู้จัก ${e.frame.dst} ในตาราง MAC จึงส่งออกพอร์ตเดียว ${outs}`;
          else if (e.action === 'filter') s += ` · ปลายทางอยู่พอร์ตเดียวกับที่รับเข้ามา จึงไม่ส่งต่อ (filter)`;
          return s;
        }
      }
    }

    /* ---------------- IOS-like CLI (subset) ----------------
       cli(topo, swId, session, line, net) -> { out:[lines], changed:bool }
       session = { mode:'exec'|'config'|'if'|'vlan', ifs:[ports], vlan:n } (mutated)
       topo is the editable normalised topology (mutated on config commands); net is the running network for show. */
    function newSession() { return { mode: 'exec', ifs: [], vlan: 0 }; }
    function prompt(sw, ses) {
      return sw.name + ({ exec: '#', config: '(config)#', if: ses.ifs.length > 1 ? '(config-if-range)#' : '(config-if)#', vlan: '(config-vlan)#' }[ses.mode] || '#');
    }
    function parsePort(sw, s) {
      const m = /^(f|fa|fas|fast|faste|fastet|fastethernet|g|gi|gig|giga|gigabit|gigabitethernet)\s*(\d+)\/(\d+)$/i.exec(String(s).trim());
      if (!m) return null;
      const n = (m[1][0].toLowerCase() === 'f' ? 'fa' : 'gi') + m[2] + '/' + m[3];
      return sw.portList.some(p => p.name === n) ? n : null;
    }
    function parseRange(sw, s) {
      // "fa0/1 - 3", "fa0/1-3", "fa0/1 - fa0/3", comma separated parts
      const out = [];
      for (const part of String(s).split(',')) {
        const m = /^\s*([a-z]+)\s*(\d+)\/(\d+)\s*(?:-\s*(?:[a-z]+\s*\d+\/)?(\d+))?\s*$/i.exec(part);
        if (!m) return null;
        const a = Number(m[3]), b = m[4] ? Number(m[4]) : a;
        if (b < a || b - a > 48) return null;
        for (let i = a; i <= b; i++) { const p = parsePort(sw, m[1] + m[2] + '/' + i); if (!p) return null; out.push(p); }
      }
      return out.length ? [...new Set(out)] : null;
    }
    const KW = (tok, word, min) => !!tok && tok.length >= (min || 1) && word.startsWith(tok.toLowerCase());
    function cli(topo, swId, ses, line, net) {
      const sw = topo.devices.find(d => d.id === swId);
      const out = [];
      let changed = false;
      if (!sw || sw.type !== 'switch') return { out: ['% ไม่พบสวิตช์'], changed };
      const raw = String(line == null ? '' : line).slice(0, 200).trim();
      if (!raw) return { out, changed };
      let t = raw.split(/\s+/);
      const bad = () => out.push('% Invalid input detected.');
      const incomplete = () => out.push('% Incomplete command.');
      if (KW(t[0], 'do', 2) && ses.mode !== 'exec') t = t.slice(1);
      else if (KW(t[0], 'show', 2) && ses.mode !== 'exec') { /* IOS needs "do" in config modes; accept anyway like many simulators */ }
      const w0 = (t[0] || '').toLowerCase();
      // ---- global navigation ----
      if (KW(w0, 'end', 2) || w0 === '\u001a') { ses.mode = 'exec'; ses.ifs = []; return { out, changed }; }
      if (KW(w0, 'exit', 2)) { ses.mode = ses.mode === 'if' || ses.mode === 'vlan' ? 'config' : 'exec'; ses.ifs = []; return { out, changed }; }
      if (KW(w0, 'show', 2)) { out.push(...show(sw, t.slice(1), net)); return { out, changed }; }
      if (KW(w0, 'enable', 2)) return { out, changed };
      if (KW(w0, 'clear', 3)) {
        if (KW(t[1], 'mac', 1) && KW(t[2], 'address-table', 1)) { if (net) net.clear('mac'); out.push('(ล้างตาราง MAC ของทุกสวิตช์ในแบบจำลองแล้ว)'); return { out, changed, cleared: true }; }
        bad(); return { out, changed };
      }
      if (ses.mode === 'exec') {
        if (KW(w0, 'configure', 4)) { if (t[1] && !KW(t[1], 'terminal', 1)) { bad(); return { out, changed }; } ses.mode = 'config'; out.push('Enter configuration commands, one per line.  End with CNTL/Z.'); return { out, changed }; }
        bad(); return { out, changed };
      }
      const no = KW(w0, 'no', 2);
      const a = no ? t.slice(1) : t;
      const w = (a[0] || '').toLowerCase();
      // ---- vlan <id> / no vlan <id> (config + sub modes) ----
      if (KW(w, 'vlan', 2) && ses.mode !== 'if') {
        const ids = parseVlanList(a[1]);
        if (!a[1]) { incomplete(); return { out, changed }; }
        if (!ids || ids.length > 64) { bad(); return { out, changed }; }
        if (no) {
          for (const id of ids) {
            if (id === 1) { out.push('%Default VLAN 1 may not be deleted.'); continue; }
            if (sw.vlans[id] !== undefined) { delete sw.vlans[id]; changed = true; }
          }
          ses.mode = 'config';
          return { out, changed };
        }
        for (const id of ids) if (id !== 1 && sw.vlans[id] === undefined) { sw.vlans[id] = 'VLAN' + ('000' + id).slice(-4); changed = true; }
        if (ids.includes(1) && ids.length === 1) { out.push('(VLAN 1 คือ default VLAN มีอยู่แล้วและเปลี่ยนชื่อไม่ได้)'); }
        ses.mode = 'vlan'; ses.vlan = ids.length === 1 ? ids[0] : 0; ses.ifs = [];
        return { out, changed };
      }
      if (ses.mode === 'vlan' && KW(w, 'name', 2)) {
        if (!ses.vlan || ses.vlan === 1) { out.push('%Default VLAN 1 may not have its name changed.'); return { out, changed }; }
        if (no) { sw.vlans[ses.vlan] = 'VLAN' + ('000' + ses.vlan).slice(-4); return { out, changed: true }; }
        const name = raw.replace(/^\s*(do\s+)?\S+\s+/i, '').trim();
        if (!name) { incomplete(); return { out, changed }; }
        if (!NAME_RE.test(name)) { out.push('% ชื่อ VLAN ใช้ได้เฉพาะตัวอักษรภาษาอังกฤษ ตัวเลข และสัญลักษณ์ ไม่เกิน 32 ตัว'); return { out, changed }; }
        sw.vlans[ses.vlan] = name; return { out, changed: true };
      }
      // ---- interface / interface range ----
      if (KW(w, 'interface', 3) && !no) {
        let ports;
        if (KW(a[1], 'range', 1) && a[1].length >= 1 && !/\d/.test(a[1])) ports = parseRange(sw, a.slice(2).join(' '));
        else { const p = parsePort(sw, a.slice(1).join('')); ports = p ? [p] : null; }
        if (!ports) { out.push('% Invalid interface (สวิตช์นี้มีพอร์ต ' + shortPort(sw.portList[0].name) + ' ถึง ' + shortPort(sw.portList[sw.portList.length - 1].name) + ')'); return { out, changed }; }
        ses.mode = 'if'; ses.ifs = ports;
        return { out, changed };
      }
      // ---- spanning-tree (global) ----
      if (KW(w, 'spanning-tree', 3) && ses.mode !== 'if') {
        if (!KW(a[1], 'vlan', 1)) { if (KW(a[1], 'mode', 1)) { out.push('(แบบจำลองนี้ใช้ PVST+ เสมอ)'); return { out, changed }; } bad(); return { out, changed }; }
        const ids = parseVlanList(a[2]);
        if (!ids || ids.length > 64) { bad(); return { out, changed }; }
        if (!a[3]) {
          for (const id of ids) {
            const has = sw.stp.off.includes(id);
            if (no && !has) { sw.stp.off.push(id); changed = true; }
            if (!no && has) { sw.stp.off = sw.stp.off.filter(x => x !== id); changed = true; }
          }
          sw.stp.off.sort((x, y) => x - y);
          return { out, changed };
        }
        if (KW(a[3], 'priority', 2)) {
          if (no) { ids.forEach(id => { if (sw.stp.prio[id] !== undefined) { delete sw.stp.prio[id]; changed = true; } }); return { out, changed }; }
          const p = Number(a[4]);
          if (a[4] === undefined) { incomplete(); return { out, changed }; }
          if (!/^\d+$/.test(a[4]) || !isInt(p, 0, 61440) || p % 4096 !== 0) {
            out.push('% Bridge Priority must be in increments of 4096.', '% Allowed values are:', '  0     4096  8192  12288 16384 20480 24576 28672', '  32768 36864 40960 45056 49152 53248 57344 61440');
            return { out, changed };
          }
          ids.forEach(id => { sw.stp.prio[id] = p; }); return { out, changed: true };
        }
        if (KW(a[3], 'root', 2)) {
          // root primary: 24576, or 4096 below the current root (like Cisco's macro)
          if (!KW(a[4], 'primary', 1) && !KW(a[4], 'secondary', 1)) { incomplete(); return { out, changed }; }
          for (const id of ids) {
            if (KW(a[4], 'secondary', 1)) sw.stp.prio[id] = 28672;
            else {
              let p = 24576;
              if (net) { const s = net.stp(id), rb = s.bridges[sw.id]; if (rb && !rb.isRoot && rb.root.prio - id <= p) p = Math.max(0, Math.floor((rb.root.prio - id - 1) / 4096) * 4096); }
              sw.stp.prio[id] = p;
            }
          }
          return { out, changed: true };
        }
        bad(); return { out, changed };
      }
      if (ses.mode === 'if') {
        const F = ses.ifs.map(p => sw.ifs[p]);
        const set = fn => { F.forEach(fn); changed = true; };
        if (KW(w, 'shutdown', 2)) { set(f => { f.shutdown = !no; }); return { out, changed }; }
        if (KW(w, 'description', 2)) return { out, changed };
        if (KW(w, 'spanning-tree', 3)) {
          if (KW(a[1], 'cost', 2)) {
            if (no) { set(f => { f.cost = null; }); return { out, changed }; }
            const c = Number(a[2]);
            if (!/^\d+$/.test(a[2] || '') || !isInt(c, 1, 65535)) { out.push('% cost ต้องเป็นตัวเลข 1–65535 (แบบจำลองนี้ใช้ cost แบบ short ของ 802.1D)'); return { out, changed }; }
            set(f => { f.cost = c; }); return { out, changed };
          }
          if (KW(a[1], 'portfast', 2)) { out.push('(แบบจำลองนี้แสดงผล STP หลัง converge แล้ว จึงไม่มีผลต่างของ PortFast)'); return { out, changed }; }
          bad(); return { out, changed };
        }
        if (KW(w, 'switchport', 2)) {
          const b = (a[1] || '').toLowerCase();
          if (KW(b, 'mode', 1)) {
            if (no) { set(f => { f.mode = 'access'; }); return { out, changed }; }
            if (KW(a[2], 'access', 1)) { set(f => { f.mode = 'access'; }); return { out, changed }; }
            if (KW(a[2], 'trunk', 1)) { set(f => { f.mode = 'trunk'; }); return { out, changed }; }
            if (KW(a[2], 'dynamic', 1)) { out.push('(แบบจำลองนี้ไม่จำลอง DTP: ให้ตั้ง mode access หรือ trunk ให้ชัดเจน)'); return { out, changed }; }
            incomplete(); return { out, changed };
          }
          if (KW(b, 'access', 1)) {
            if (!KW(a[2], 'vlan', 1)) { incomplete(); return { out, changed }; }
            if (no) { set(f => { f.vlan = 1; }); return { out, changed }; }
            const v = Number(a[3]);
            if (!/^\d+$/.test(a[3] || '') || !isInt(v, 1, 4094)) { bad(); return { out, changed }; }
            if (sw.vlans[v] === undefined) { sw.vlans[v] = 'VLAN' + ('000' + v).slice(-4); out.push('% Access VLAN does not exist. Creating vlan ' + v); }
            set(f => { f.vlan = v; }); return { out, changed };
          }
          if (KW(b, 'trunk', 1)) {
            const c = (a[2] || '').toLowerCase();
            if (KW(c, 'encapsulation', 1)) { if (KW(a[3], 'dot1q', 1)) return { out, changed }; out.push('% แบบจำลองนี้รองรับเฉพาะ 802.1Q (dot1q)'); return { out, changed }; }
            if (KW(c, 'native', 1)) {
              if (!KW(a[3], 'vlan', 1)) { incomplete(); return { out, changed }; }
              if (no) { set(f => { f.native = 1; }); return { out, changed }; }
              const v = Number(a[4]);
              if (!/^\d+$/.test(a[4] || '') || !isInt(v, 1, 4094)) { bad(); return { out, changed }; }
              set(f => { f.native = v; }); return { out, changed };
            }
            if (KW(c, 'allowed', 1)) {
              if (!KW(a[3], 'vlan', 1)) { incomplete(); return { out, changed }; }
              if (no) { set(f => { f.allowed = null; }); return { out, changed }; }
              const op = (a[4] || '').toLowerCase();
              if (op === 'all') { set(f => { f.allowed = null; }); return { out, changed }; }
              if (op === 'none') { set(f => { f.allowed = []; }); return { out, changed }; }
              if (op === 'add' || op === 'remove' || op === 'except') {
                const ids = parseVlanList(a.slice(5).join(''));
                if (!ids) { bad(); return { out, changed }; }
                set(f => {
                  const cur = new Set(f.allowed == null ? Array.from({ length: 4094 }, (_, i) => i + 1) : f.allowed);
                  if (op === 'add') ids.forEach(v => cur.add(v));
                  else if (op === 'remove') ids.forEach(v => cur.delete(v));
                  else { cur.clear(); for (let v = 1; v <= 4094; v++) if (!ids.includes(v)) cur.add(v); }
                  f.allowed = cur.size === 4094 ? null : [...cur].sort((x, y) => x - y);
                });
                return { out, changed };
              }
              const ids = parseVlanList(a.slice(4).join(''));
              if (!ids) { bad(); return { out, changed }; }
              set(f => { f.allowed = ids; }); return { out, changed };
            }
            incomplete(); return { out, changed };
          }
          if (KW(b, 'nonegotiate', 2)) return { out, changed };
          bad(); return { out, changed };
        }
      }
      bad();
      return { out, changed };
    }
    function pad(s, n) { s = String(s); return s.length >= n ? s + ' ' : s + ' '.repeat(n - s.length); }
    function show(sw, args, net) {
      const a = (args[0] || '').toLowerCase();
      const out = [];
      if (!a) return ['% Incomplete command.'];
      if (KW(a, 'mac', 1) || KW(a, 'mac-address-table', 4)) {
        const rows = net ? net.macTable(sw.id) : [];
        out.push('          Mac Address Table', '-------------------------------------------', '', 'Vlan    Mac Address       Type        Ports', '----    -----------       --------    -----');
        rows.forEach(r => out.push(pad(String(r.vlan).padStart(4), 8) + pad(r.mac, 18) + pad('DYNAMIC', 12) + shortPort(r.port)));
        out.push('Total Mac Addresses for this criterion: ' + rows.length);
        return out;
      }
      if (KW(a, 'vlan', 1)) {
        out.push('VLAN Name                             Status    Ports', '---- -------------------------------- --------- -------------------------------');
        const ids = Object.keys(sw.vlans).map(Number).sort((x, y) => x - y);
        for (const id of ids) {
          const ports = sw.portList.filter(p => sw.ifs[p.name].mode === 'access' && sw.ifs[p.name].vlan === id).map(p => shortPort(p.name));
          const lines = []; for (let i = 0; i < ports.length; i += 4) lines.push(ports.slice(i, i + 4).join(', '));
          out.push(pad(id, 5) + pad(sw.vlans[id], 33) + pad('active', 10) + (lines[0] || ''));
          for (let i = 1; i < lines.length; i++) out.push(' '.repeat(48) + lines[i]);
        }
        const orphan = [...new Set(sw.portList.filter(p => sw.ifs[p.name].mode === 'access' && sw.vlans[sw.ifs[p.name].vlan] === undefined).map(p => sw.ifs[p.name].vlan))];
        orphan.forEach(v => out.push(`(พอร์ตใน VLAN ${v} ไม่แสดง เพราะยังไม่มี VLAN ${v} ใน database: พอร์ตเหล่านี้ inactive)`));
        return out;
      }
      if (KW(a, 'interfaces', 2) || KW(a, 'int', 3)) {
        if (!KW(args[1], 'trunk', 1)) return ['% แบบจำลองนี้รองรับ "show interfaces trunk"'];
        const tr = sw.portList.filter(p => sw.ifs[p.name].mode === 'trunk');
        if (!tr.length) return ['(ไม่มีพอร์ตที่เป็น trunk)'];
        out.push('', 'Port        Mode         Encapsulation  Status        Native vlan');
        tr.forEach(p => out.push(pad(shortPort(p.name), 12) + pad('on', 13) + pad('802.1q', 15) + pad(net && net.linkUp(sw.id, p.name) ? 'trunking' : 'not-connect', 14) + sw.ifs[p.name].native));
        out.push('', 'Port        Vlans allowed on trunk');
        tr.forEach(p => out.push(pad(shortPort(p.name), 12) + vlanListStr(sw.ifs[p.name].allowed)));
        out.push('', 'Port        Vlans allowed and active in management domain');
        const active = p => Object.keys(sw.vlans).map(Number).filter(v => sw.ifs[p.name].allowed == null || sw.ifs[p.name].allowed.includes(v));
        tr.forEach(p => out.push(pad(shortPort(p.name), 12) + (vlanListStr(active(p)) === 'none' ? 'none' : vlanListStr(active(p)))));
        out.push('', 'Port        Vlans in spanning tree forwarding state and not pruned');
        tr.forEach(p => out.push(pad(shortPort(p.name), 12) + (net ? (vlanListStr(active(p).filter(v => net.forwarding(sw.id, p.name, v))) || 'none') : '')));
        if (net) net.nativeMismatches().filter(m => m.a === sw.id || m.b === sw.id).forEach(m => {
          const me = m.a === sw.id ? [m.ap, m.an, m.b, m.bp, m.bn] : [m.bp, m.bn, m.a, m.ap, m.an];
          out.push('', `%CDP-4-NATIVE_VLAN_MISMATCH: Native VLAN mismatch discovered on ${longPort(me[0])} (${me[1]}), with ${net.dev(me[2]).name} ${longPort(me[3])} (${me[4]}).`);
        });
        return out;
      }
      if (KW(a, 'spanning-tree', 2)) {
        let ids = Object.keys(sw.vlans).map(Number).sort((x, y) => x - y);
        if (args[1]) {
          if (!KW(args[1], 'vlan', 1)) return ['% Invalid input detected.'];
          const v = Number(args[2]);
          if (!isInt(v, 1, 4094)) return ['% Incomplete command.'];
          ids = [v];
        }
        ids = ids.filter(v => net && net.stpOn(sw.id, v));
        if (!ids.length) return [args[1] ? `Spanning tree instance(s) for vlan ${args[2]} does not exist.` : 'No spanning tree instance exists.'];
        for (const v of ids) {
          const s = net.stp(v), me = s.bridges[sw.id];
          const rootSw = net.dev(me.root.id);
          out.push('', 'VLAN' + ('000' + v).slice(-4), '  Spanning tree enabled protocol ieee');
          out.push('  Root ID    Priority    ' + me.root.prio, '             Address     ' + me.root.mac);
          if (me.isRoot) out.push('             This bridge is the root');
          else out.push('             Cost        ' + me.cost, '             Port        ' + portIndexOf(sw, me.rootPort) + ' (' + longPort(me.rootPort) + ')' + (rootSw ? '   [root = ' + rootSw.name + ']' : ''));
          out.push('', '  Bridge ID  Priority    ' + me.bid.prio + '  (priority ' + me.prio + ' sys-id-ext ' + v + ')', '             Address     ' + sw.mac, '');
          out.push('Interface           Role Sts Cost      Prio.Nbr Type', '------------------- ---- --- --------- -------- --------------------------------');
          sw.portList.forEach(p => {
            const i = s.ports[sw.id + '|' + p.name];
            if (!i) return;
            const role = { root: 'Root', designated: 'Desg', alternate: 'Altn', backup: 'Back' }[i.role];
            const sts = i.inc ? 'BKN*' : i.state;
            out.push(pad(shortPort(p.name), 20) + pad(role, 5) + pad(sts, 4) + pad(i.cost, 10) + pad('128.' + i.pid, 9) + 'P2p' + (i.inc ? ' *' + i.inc : ''));
          });
        }
        return out;
      }
      if (KW(a, 'running-config', 1)) {
        out.push('hostname ' + sw.name, '!');
        Object.keys(sw.stp.prio).forEach(v => out.push(`spanning-tree vlan ${v} priority ${sw.stp.prio[v]}`));
        sw.stp.off.forEach(v => out.push(`no spanning-tree vlan ${v}`));
        out.push('!');
        Object.keys(sw.vlans).map(Number).filter(v => v !== 1).sort((x, y) => x - y).forEach(v => out.push('vlan ' + v, ' name ' + sw.vlans[v], '!'));
        sw.portList.forEach(p => {
          const f = sw.ifs[p.name];
          out.push('interface ' + longPort(p.name));
          if (f.mode === 'trunk') {
            if (f.native !== 1) out.push(' switchport trunk native vlan ' + f.native);
            if (f.allowed != null) out.push(' switchport trunk allowed vlan ' + vlanListStr(f.allowed));
            out.push(' switchport mode trunk');
          } else {
            if (f.vlan !== 1) out.push(' switchport access vlan ' + f.vlan);
            out.push(' switchport mode access');
          }
          if (f.cost) out.push(' spanning-tree cost ' + f.cost);
          if (f.shutdown) out.push(' shutdown');
          out.push('!');
        });
        out.push('end');
        return out;
      }
      return ['% Invalid input detected.'];
    }
    function portIndexOf(sw, p) { return sw.portList.findIndex(x => x.name === p) + 1; }

    return {
      version: VERSION, BCAST, MAX_EVENTS, MAX_ACTIONS,
      normalize, create, run, applyConfig, exportConfig, describe, cli, newSession, prompt, show,
      normMac, ipInt, sameSubnet, maskStr, parseVlanList, vlanListStr, shortPort, longPort,
      REASON_TEXT, DROP_TEXT, KIND_TEXT
    };
  }

  const SW = engine();
  if (typeof module === 'object' && module.exports) { module.exports = SW; return; }
  root.SwitchSim = SW;

  /* =====================================================================================
   * Browser UI
   * ===================================================================================== */
  const TITLE = 'ห้องปฏิบัติการ Switching และ VLAN';
  const DRAFT_KEY = 'nls-switching-v1';
  const LV = { easy: 'ง่าย', medium: 'ปานกลาง', hard: 'ยาก' };
  const CSS = `
.nls-switching{color:var(--ink);max-width:980px;margin:0 auto;min-width:0}
.nls-switching *,.nls-switching *::before,.nls-switching *::after{box-sizing:border-box}
.nls-switching h2{font-size:24px;line-height:1.25;margin:0 0 6px}
.nls-switching h3{font-size:18px;line-height:1.35;margin:0 0 8px}
.nls-switching h4{font-size:16px;margin:12px 0 6px}
.nls-switching p{margin:0 0 8px}
.nls-switching-muted{color:var(--muted);font-size:15px}
.nls-switching-card{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:14px 16px;margin:0 0 14px;min-width:0}
.nls-switching-btn{background:var(--ink);color:var(--bg);border:1px solid var(--ink);border-radius:8px;padding:8px 14px;font:inherit;font-weight:600;font-size:15px;cursor:pointer;line-height:1.3;min-height:44px;min-width:44px}
.nls-switching-btn.nls-switching-ghost{background:transparent;color:var(--ink);border-color:var(--line)}
.nls-switching-btn[aria-pressed="true"]{background:var(--blue);border-color:var(--blue);color:var(--on-accent)}
.nls-switching-btn:disabled{opacity:.45;cursor:default}
.nls-switching :focus-visible{outline:3px solid var(--blue);outline-offset:2px}
.nls-switching-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.nls-switching-howto summary{cursor:pointer;font-weight:600;min-height:32px}
.nls-switching-howto ol{margin:8px 0 0;padding-left:22px;font-size:15px}
.nls-switching-missions{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px;margin:0 0 14px;padding:0;list-style:none}
.nls-switching-mbtn{width:100%;height:100%;display:flex;flex-direction:column;align-items:flex-start;text-align:left;gap:2px;background:var(--panel);color:var(--ink);border:1px solid var(--line);border-left:4px solid var(--line);border-radius:10px;padding:9px 12px;font:inherit;cursor:pointer;min-height:44px}
.nls-switching-mbtn[data-level="easy"]{border-left-color:var(--green)}
.nls-switching-mbtn[data-level="medium"]{border-left-color:var(--orange)}
.nls-switching-mbtn[data-level="hard"]{border-left-color:var(--bad)}
.nls-switching-mbtn b{font-size:15px;line-height:1.3}
.nls-switching-mbtn span{font-size:13px;color:var(--muted)}
.nls-switching-mbtn[aria-current="true"]{border-color:var(--blue);box-shadow:inset 0 0 0 2px var(--blue)}
.nls-switching-mbtn .nls-switching-best{color:var(--ok);font-weight:600}
.nls-switching-lvl{font:600 12px "JetBrains Mono",Consolas,monospace;text-transform:uppercase;letter-spacing:.04em}
.nls-switching-hints{margin:8px 0 0;padding-left:22px;font-size:15px}
.nls-switching-hints li{margin:4px 0;background:var(--field);border-radius:6px;padding:4px 8px}
.nls-switching-grid{display:grid;grid-template-columns:minmax(0,1fr);gap:0 14px}
@media (min-width:920px){.nls-switching-grid{grid-template-columns:minmax(0,1.25fr) minmax(0,1fr)}}
.nls-switching-svgbox{background:var(--field);border:1px solid var(--line);border-radius:10px;overflow:hidden;margin:0 0 10px}
.nls-switching-svgbox svg{display:block;width:100%;height:auto}
.nls-switching-svg text{font-family:"JetBrains Mono",Consolas,monospace;fill:var(--ink)}
.nls-switching-svg .nls-switching-lbl{font-size:12px;paint-order:stroke;stroke:var(--field);stroke-width:3px}
.nls-switching-svg .nls-switching-name{font-size:14px;font-weight:600;font-family:inherit}
.nls-switching-svg .nls-switching-sub{font-size:11px;fill:var(--muted)}
@media (max-width:600px){.nls-switching-svg .nls-switching-lbl{font-size:17px}.nls-switching-svg .nls-switching-name{font-size:17px}.nls-switching-svg .nls-switching-sub{font-size:12px}.nls-switching-badge text{font-size:15px}}
.nls-switching-link{stroke:var(--muted);stroke-width:2.5}
.nls-switching-link.nls-switching-hot{stroke:var(--blue);stroke-width:5}
.nls-switching-link.nls-switching-in{stroke:var(--blue);stroke-width:3;stroke-dasharray:6 5;opacity:.7}
.nls-switching-link.nls-switching-storm{stroke:var(--bad);stroke-width:5}
.nls-switching-node{cursor:pointer}
.nls-switching-node rect.nls-switching-box{fill:var(--panel);stroke:var(--ink);stroke-width:1.5}
.nls-switching-node.nls-switching-switch rect.nls-switching-box{stroke:var(--blue);stroke-width:2}
.nls-switching-node.nls-switching-hub rect.nls-switching-box{stroke:var(--orange);stroke-width:2;stroke-dasharray:5 3}
.nls-switching-node.nls-switching-sel rect.nls-switching-box{stroke-width:4}
.nls-switching-node.nls-switching-act rect.nls-switching-box{fill:color-mix(in srgb,var(--blue) 22%,var(--panel))}
.nls-switching-node:focus-visible{outline:none}
.nls-switching-node:focus-visible rect.nls-switching-box{stroke:var(--blue);stroke-width:4}
.nls-switching-fwd{fill:var(--ok)}
.nls-switching-blk{stroke:var(--bad);stroke-width:3}
.nls-switching-badge rect{fill:var(--blue)}
.nls-switching-badge text{fill:var(--on-accent);font-size:12px;font-weight:600}
.nls-switching-chips{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 6px}
.nls-switching-chip{min-height:44px;padding:6px 12px;border-radius:22px;border:1px solid var(--line);background:var(--field);color:var(--ink);font:inherit;font-size:15px;cursor:pointer}
.nls-switching-chip[aria-pressed="true"]{border-color:var(--blue);background:var(--blue);color:var(--on-accent);font-weight:600}
.nls-switching-legend{font-size:13px;color:var(--muted);margin:4px 0 0}
.nls-switching-field{display:flex;flex-direction:column;gap:2px;min-width:0;flex:1 1 140px}
.nls-switching-field>span{font-size:14px;color:var(--muted)}
.nls-switching select,.nls-switching input[type=text],.nls-switching input[type=number]{font:inherit;font-size:16px;color:var(--ink);background:var(--field);border:1px solid var(--line);border-radius:8px;padding:6px 8px;min-height:44px;width:100%;min-width:0}
.nls-switching input[type=checkbox],.nls-switching input[type=radio]{width:22px;height:22px;accent-color:var(--blue);flex:none;margin:0}
.nls-switching-check{display:flex;align-items:center;gap:8px;min-height:44px;padding:0 4px;cursor:pointer}
.nls-switching-checks{display:flex;flex-wrap:wrap;gap:0 14px}
.nls-switching-res{padding:8px 10px;border-radius:8px;border:1px solid var(--line);border-left:5px solid var(--line);background:var(--field);margin:8px 0 0;font-size:15px}
.nls-switching-res.nls-switching-good{border-left-color:var(--ok)}
.nls-switching-res.nls-switching-fail{border-left-color:var(--bad)}
.nls-switching-ok{color:var(--ok);font-weight:600}
.nls-switching-bad{color:var(--bad);font-weight:600}
.nls-switching-storm-box{border:2px solid var(--bad);border-radius:10px;padding:10px 12px;margin:8px 0;background:color-mix(in srgb,var(--bad) 10%,var(--panel))}
.nls-switching-storm-box b{font-size:22px;font-family:"JetBrains Mono",Consolas,monospace;color:var(--bad)}
.nls-switching-steps{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:8px 0}
.nls-switching-now{background:var(--field);border:1px solid var(--blue);border-left:5px solid var(--blue);border-radius:8px;padding:8px 10px;font-size:15px;margin:0 0 8px;min-height:3.2em}
.nls-switching-kind{display:inline-block;font:600 12px "JetBrains Mono",Consolas,monospace;border-radius:6px;padding:1px 6px;margin-right:6px;border:1px solid var(--line);background:var(--panel)}
.nls-switching-trace{list-style:none;margin:0;padding:0;max-height:340px;overflow:auto;border:1px solid var(--line);border-radius:8px}
.nls-switching-trace li{padding:6px 8px;border-bottom:1px solid var(--line);font-size:14px;line-height:1.45}
.nls-switching-trace li:last-child{border-bottom:0}
.nls-switching-trace li[aria-current="true"]{background:color-mix(in srgb,var(--blue) 14%,var(--panel))}
.nls-switching-trace li.nls-switching-future{color:var(--muted)}
.nls-switching-tablewrap{overflow-x:auto;max-width:100%}
.nls-switching table{border-collapse:collapse;width:100%;font-size:14px}
.nls-switching th,.nls-switching td{border-bottom:1px solid var(--line);padding:5px 6px;text-align:left;vertical-align:middle}
.nls-switching th{color:var(--muted);font-weight:600}
.nls-switching td.nls-switching-mono,.nls-switching .nls-switching-mono{font-family:"JetBrains Mono",Consolas,monospace;font-size:13px}
.nls-switching-port{border:1px solid var(--line);border-radius:10px;padding:8px 10px;margin:0 0 8px;background:var(--field)}
.nls-switching-port h5{margin:0 0 6px;font-size:15px;display:flex;flex-wrap:wrap;gap:4px 10px;align-items:baseline}
.nls-switching-port h5 small{font-weight:400;color:var(--muted);font-size:13px}
.nls-switching-pgrid{display:flex;flex-wrap:wrap;gap:6px 10px;align-items:flex-end}
.nls-switching-pgrid .nls-switching-field{flex:1 1 120px}
.nls-switching-cli{background:var(--term-bg);color:var(--term-ink);border-radius:10px;padding:8px 10px;margin:6px 0 0}
.nls-switching-cli pre{margin:0;font:13px/1.45 "JetBrains Mono",Consolas,monospace;white-space:pre;overflow:auto;max-height:300px;min-height:60px}
.nls-switching-cliform{display:flex;gap:6px;align-items:center;margin-top:6px;flex-wrap:wrap}
.nls-switching-cliform label{font:600 13px "JetBrains Mono",Consolas,monospace;color:var(--term-ink);flex:none}
.nls-switching-cliform input[type=text]{flex:1 1 160px;width:auto;background:var(--term-bg);color:var(--term-ink);border-color:var(--term-dim);font-family:"JetBrains Mono",Consolas,monospace}
.nls-switching-cliform .nls-switching-btn{background:var(--term-ink);color:var(--term-bg);border-color:var(--term-ink)}
.nls-switching-msg{min-height:1.4em;font-size:15px;margin:6px 0 0}
.nls-switching-q{border-top:1px solid var(--line);padding:10px 0 4px}
.nls-switching-q:first-of-type{border-top:0}
.nls-switching-q legend,.nls-switching-q>p{font-weight:600;margin:0 0 4px;padding:0}
.nls-switching fieldset{border:0;margin:0;padding:0;min-width:0}
.nls-switching-fb{margin:8px 0 0;padding-left:22px;font-size:15px}
.nls-switching-fb li{margin:4px 0}
.nls-switching-score{font-size:20px;font-weight:700;margin:8px 0 0}
.nls-switching-tag{display:inline-block;font-size:12px;border-radius:6px;padding:0 6px;border:1px solid var(--line);color:var(--muted);margin-left:4px}
`;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clone = o => JSON.parse(JSON.stringify(o));
  const P = SW.shortPort;
  const KSHORT = { 'arp-req': 'ARP Req', 'arp-rep': 'ARP Reply', 'icmp-req': 'Echo Req', 'icmp-rep': 'Echo Reply', test: 'Broadcast' };

  function mount(root, ctx) {
    if (!document.getElementById('nls-switching-css')) {
      const st = document.createElement('style'); st.id = 'nls-switching-css'; st.textContent = CSS; document.head.appendChild(st);
    }
    ctx = ctx || {};
    const missions = (Array.isArray(ctx.missions) ? ctx.missions : []).filter(m => m && m.start && m.start.topo);
    const best = {};
    Object.keys(ctx.done || {}).forEach(k => { best[k] = Object.assign({}, ctx.done[k]); });
    const reduce = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    const work = {};
    let cur = missions[0] ? missions[0].id : null;
    let alive = true, raf = 0;
    let draft = null;
    try { draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'); } catch (e) { draft = null; }
    if (!draft || draft.v !== 1 || typeof draft.work !== 'object' || !draft.work) draft = { v: 1, mid: null, work: {} };
    if (draft.mid && missions.some(m => m.id === draft.mid)) cur = draft.mid;
    if (ctx.initial && missions.some(m => m.id === ctx.initial)) cur = ctx.initial;

    const mission = () => missions.find(m => m.id === cur) || null;
    function W() {
      const m = mission();
      if (!m) return null;
      if (work[m.id]) return work[m.id];
      const start = SW.normalize(m.start.topo);
      const w = { topo: start, net: null, actions: [], last: null, step: 0, all: false, sel: m.start.focus || null, answers: {}, cli: {}, hints: 0,
        result: null, sending: false, msg: '', pingSrc: '', pingDst: '', allPorts: false, stormShown: 0 };
      const d = draft.work[m.id];
      if (d && typeof d === 'object') {
        if (!m.start.lock && d.config) { const a = SW.applyConfig(start, d.config); if (a.ok) w.topo = a.topo; }
        if (Array.isArray(d.actions)) w.actions = d.actions.filter(x => x && typeof x === 'object').slice(0, SW.MAX_ACTIONS);
        if (d.answers && typeof d.answers === 'object') w.answers = d.answers;
      }
      const r = SW.run(w.topo, w.actions);
      w.net = r.net;
      for (let i = r.results.length - 1; i >= 0; i--) if (r.results[i] && (r.results[i].op === 'ping' || r.results[i].op === 'bcast')) { w.last = r.results[i]; w.step = 0; break; }
      const pcs = w.topo.devices.filter(x => x.type === 'pc');
      const rq = m.start.required && m.start.required[0];
      w.pingSrc = rq ? rq.src : pcs[0] ? pcs[0].id : '';
      w.pingDst = rq ? rq.dst : pcs[1] ? pcs[1].id : '';
      work[m.id] = w;
      return w;
    }
    function saveDraft() {
      try {
        draft.mid = cur;
        Object.keys(work).forEach(id => {
          const w = work[id], m = missions.find(x => x.id === id);
          draft.work[id] = { config: m && m.start.lock ? null : SW.exportConfig(w.topo), actions: w.actions, answers: w.answers };
        });
        localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      } catch (e) { /* storage unavailable */ }
    }
    const devOf = (w, id) => w.topo.devices.find(d => d.id === id) || null;
    const nameOf = (w, id) => { const d = devOf(w, id); return d ? d.name : id; };
    const pcs = w => w.topo.devices.filter(d => d.type === 'pc');
    const switches = w => w.topo.devices.filter(d => d.type === 'switch');
    const locked = () => { const m = mission(); return !!(m && m.start.lock); };
    const hideMac = () => { const m = mission(), w = W(); return !!(m && m.start.hideMac && !(w.result && typeof w.result.score === 'number')); };
    const linkOf = (w, id, p) => w.topo.links.find(l => (l.a === id && l.ap === p) || (l.b === id && l.bp === p)) || null;
    const peerOf = (w, id, p) => { const l = linkOf(w, id, p); return l ? (l.a === id ? { dev: l.b, port: l.bp } : { dev: l.a, port: l.ap }) : null; };

    /* ---------- rendering ---------- */
    function render() {
      const ae = document.activeElement;
      const fk = ae && root.contains(ae) ? ae.getAttribute('data-fk') : null;
      const pre = root.querySelector('.nls-switching-cli pre'), preTop = pre ? pre.scrollTop : 0;
      const tr = root.querySelector('.nls-switching-trace'), trTop = tr ? tr.scrollTop : 0;
      const m = mission();
      root.innerHTML = `<div class="nls-switching">${head()}${nav()}${m ? brief(m) + body(m) : '<p class="nls-switching-muted">ยังไม่มีภารกิจ</p>'}</div>`;
      const pre2 = root.querySelector('.nls-switching-cli pre'); if (pre2) pre2.scrollTop = pre2.dataset.bottom ? pre2.scrollHeight : preTop;
      const tr2 = root.querySelector('.nls-switching-trace'); if (tr2) { const c = tr2.querySelector('[aria-current="true"]'); if (c && tr2.dataset.follow) tr2.scrollTop = Math.max(0, c.offsetTop - tr2.clientHeight / 2); else tr2.scrollTop = trTop; }
      if (fk) { const el = root.querySelector(`[data-fk="${fk}"]`); if (el && !el.disabled) el.focus({ preventScroll: true }); }
      startStormAnim();
      saveDraft();
    }
    function head() {
      return `<div class="nls-switching-card"><h2>${TITLE}</h2>
<p class="nls-switching-muted">จำลองการทำงานของ Switch ที่ Layer 2: การเรียนรู้ MAC, ARP, VLAN, Trunk 802.1Q และ Spanning Tree ทุกผลลัพธ์คำนวณจากเฟรมที่วิ่งจริงในแบบจำลอง และตรวจซ้ำที่เซิร์ฟเวอร์</p>
<details class="nls-switching-howto"><summary>วิธีใช้</summary><ol>
<li>เลือกภารกิจ อ่านโจทย์ แล้วแตะอุปกรณ์ (ปุ่มชื่ออุปกรณ์ใต้ภาพ หรือแตะในภาพ) เพื่อดูและตั้งค่า</li>
<li>ตั้งค่าสวิตช์ได้สองทาง: แผงตั้งค่า หรือช่องคำสั่งแบบ Cisco IOS (เช่น conf t, vlan 10, name LAB, interface fa0/1, switchport access vlan 10, show vlan brief) ทั้งสองทางแก้ค่าชุดเดียวกัน</li>
<li>ทดสอบด้วย Ping แล้วกด "ถัดไป" ในแผงติดตามเฟรมเพื่อดูทีละขั้นว่าเฟรมออกพอร์ตใด มี VLAN tag หรือไม่ และสวิตช์เรียนรู้ MAC อะไร</li>
<li>ทุกครั้งที่เปลี่ยนการตั้งค่า แบบจำลองจะล้างตาราง MAC/ARP และประวัติการ ping (ให้ทดสอบใหม่หลังตั้งค่าเสร็จ)</li>
<li>แล็บนี้ไม่มี Router: เครื่องต่าง subnet หรือต่าง VLAN จะคุยกันไม่ได้ (ไม่มี inter-VLAN routing)</li></ol></details>${ctx.user ? '' : '<p class="nls-switching-muted">ยังไม่ได้เข้าสู่ระบบ: ตรวจคะแนนได้แต่จะไม่บันทึก</p>'}</div>`;
    }
    function nav() {
      return '<ul class="nls-switching-missions" aria-label="รายการภารกิจ">' + missions.map(m => {
        const b = best[m.id];
        const st = b && b.best != null && (b.attempts || 0) > 0 ? `<span class="nls-switching-best">คะแนนดีที่สุด ${b.best}/${b.max || m.max}</span>` : '<span>ยังไม่ส่ง</span>';
        return `<li><button type="button" class="nls-switching-mbtn" data-act="mission" data-id="${esc(m.id)}" data-fk="m-${esc(m.id)}" data-level="${esc(m.level)}" aria-current="${m.id === cur}">` +
          `<span class="nls-switching-lvl">${esc(m.id)} · ${LV[m.level] || esc(m.level)}</span><b>${esc(m.title)}</b>${st}</button></li>`;
      }).join('') + '</ul>';
    }
    function brief(m) {
      const w = W(), hints = Array.isArray(m.hints) ? m.hints : [];
      return `<section class="nls-switching-card" aria-labelledby="nls-switching-mt"><h3 id="nls-switching-mt">${esc(m.id)} · ${esc(m.title)} <span class="nls-switching-tag">${LV[m.level] || ''}</span></h3>
<p>${esc(m.desc)}</p><div class="nls-switching-row">` +
        (hints.length ? `<button type="button" class="nls-switching-btn nls-switching-ghost" data-act="hint" data-fk="hint"${w.hints >= hints.length ? ' disabled' : ''}>คำใบ้ (${w.hints}/${hints.length})</button>` : '') +
        `<button type="button" class="nls-switching-btn nls-switching-ghost" data-act="reset" data-fk="reset">เริ่มภารกิจนี้ใหม่</button></div>` +
        (w.hints ? '<ol class="nls-switching-hints">' + hints.slice(0, w.hints).map(t => `<li>${esc(t)}</li>`).join('') + '</ol>' : '') + '</section>';
    }
    function body(m) {
      return `<div class="nls-switching-grid"><div>${diagramCard()}${pingCard()}${traceCard()}</div><div>${devicePanel()}${tablesCard()}</div></div>${answersCard(m)}${submitCard(m)}`;
    }

    /* ---------- diagram ---------- */
    function curEntry() { const w = W(); return w.last && w.last.entries && w.last.entries.length ? w.last.entries[Math.min(w.step, w.last.entries.length - 1)] : null; }
    function portMark(w, d, p) {
      // STP marker for a switch port on a switch-to-switch (or hub) link: blocked in any VLAN it carries with STP on
      const pr = peerOf(w, d.id, p); if (!pr || devOf(w, pr.dev).type === 'pc') return null;
      let any = false, blk = false;
      for (const v of w.net.vlans()) {
        if (!w.net.stpOn(d.id, v) || !w.net.carries(d.id, p, v)) continue;
        const i = w.net.stp(v).ports[d.id + '|' + p];
        if (!i) continue;
        any = true; if (i.state === 'BLK') blk = true;
      }
      return any ? (blk ? 'blk' : 'fwd') : null;
    }
    function diagramCard() {
      const w = W(), T = w.topo, e = curEntry(), storm = !!w.net.storm;
      const xs = T.devices.map(d => d.x), ys = T.devices.map(d => d.y);
      const x0 = Math.min(...xs) - 64, x1 = Math.max(...xs) + 64, y0 = Math.min(...ys) - 40, y1 = Math.max(...ys) + 58;
      const pos = id => { const d = devOf(w, id); return [d.x, d.y]; };
      const half = d => d.type === 'switch' ? [46, 20] : d.type === 'hub' ? [38, 17] : [24, 18];
      let links = '', labels = '', badges = '';
      const hot = new Set(), inLink = e && e.link ? e.link : null;
      if (e && e.out) e.out.forEach(p => { const l = linkOf(w, e.dev, p); if (l) hot.add(l.id); });
      for (const l of T.links) {
        const [ax, ay] = pos(l.a), [bx, by] = pos(l.b);
        const cls = storm && w.net.counters[l.id] > 0 && devOf(w, l.a).type !== 'pc' && devOf(w, l.b).type !== 'pc' ? ' nls-switching-storm' : hot.has(l.id) ? ' nls-switching-hot' : l.id === inLink ? ' nls-switching-in' : '';
        links += `<line class="nls-switching-link${cls}" x1="${ax}" y1="${ay}" x2="${bx}" y2="${by}"/>`;
        const len = Math.hypot(bx - ax, by - ay) || 1, ux = (bx - ax) / len, uy = (by - ay) / len;
        for (const [id, p, sx, sy, sgn] of [[l.a, l.ap, ax, ay, 1], [l.b, l.bp, bx, by, -1]]) {
          const d = devOf(w, id);
          if (d.type === 'pc') continue;
          const h = half(d), other = devOf(w, id === l.a ? l.b : l.a);
          // a port facing a PC is labelled near the PC end (many PC links converge at the switch)
          const dist = other.type === 'pc' ? Math.max(len * 0.5, len - 44) : Math.min(len * 0.42, Math.abs(ux) * h[0] + Math.abs(uy) * h[1] + 22);
          const px = sx + sgn * ux * dist, py = sy + sgn * uy * dist;
          const ox = -uy * 11, oy = ux * 11;
          labels += `<text class="nls-switching-lbl" x="${(px + ox).toFixed(1)}" y="${(py + oy + 4).toFixed(1)}" text-anchor="middle">${esc(d.type === 'hub' ? p : P(p))}</text>`;
          if (d.type === 'switch') {
            const mk = portMark(w, d, p);
            if (mk === 'fwd') labels += `<circle class="nls-switching-fwd" cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="5"><title>${esc(d.name + ' ' + P(p))}: Forwarding</title></circle>`;
            if (mk === 'blk') labels += `<g class="nls-switching-blk"><title>${esc(d.name + ' ' + P(p))}: Blocking (STP)</title><path d="M${px - 6} ${py - 6}l12 12M${px + 6} ${py - 6}l-12 12"/></g>`;
          }
        }
        if (hot.has(l.id) && e) {
          const from = e.dev, p = e.out.find(pp => { const ll = linkOf(w, from, pp); return ll && ll.id === l.id; });
          const tag = e.outTags ? e.outTags[p] : null;
          const txt = KSHORT[e.frame.kind] + (tag != null ? ' · tag ' + tag : '');
          const [fx, fy] = pos(from), [tx, ty] = from === l.a ? [bx, by] : [ax, ay];
          const mx = fx + (tx - fx) * 0.55, my = fy + (ty - fy) * 0.55, wd = txt.length * 7.2 + 12;
          badges += `<g class="nls-switching-badge"><rect x="${(mx - wd / 2).toFixed(1)}" y="${(my - 10).toFixed(1)}" width="${wd.toFixed(1)}" height="20" rx="6"/><text x="${mx.toFixed(1)}" y="${(my + 4).toFixed(1)}" text-anchor="middle">${esc(txt)}</text></g>`;
        }
        if (storm && w.net.counters[l.id] > 0) {
          const mx = (ax + bx) / 2, my = (ay + by) / 2;
          badges += `<text class="nls-switching-lbl" x="${mx}" y="${my - 8}" text-anchor="middle">${w.net.counters[l.id]}</text>`;
        }
      }
      let nodes = '';
      for (const d of T.devices) {
        const [hx, hy] = half(d);
        const cls = `nls-switching-node nls-switching-${d.type}${w.sel === d.id ? ' nls-switching-sel' : ''}${e && e.dev === d.id ? ' nls-switching-act' : ''}`;
        let shape;
        if (d.type === 'pc') shape = `<rect class="nls-switching-box" x="${d.x - hx}" y="${d.y - hy}" width="${hx * 2}" height="${hy * 2 - 6}" rx="3"/><path d="M${d.x - 8} ${d.y + hy + 2}h16M${d.x} ${d.y + hy - 6}v8" stroke="var(--ink)" stroke-width="2"/>` +
          `<text class="nls-switching-name" x="${d.x}" y="${d.y + hy + 18}" text-anchor="middle">${esc(d.name)}</text><text class="nls-switching-sub" x="${d.x}" y="${d.y + hy + 32}" text-anchor="middle">${esc(d.ip)}</text>`;
        else shape = `<rect class="nls-switching-box" x="${d.x - hx}" y="${d.y - hy}" width="${hx * 2}" height="${hy * 2}" rx="6"/><text class="nls-switching-name" x="${d.x}" y="${d.y + 5}" text-anchor="middle">${esc(d.name)}</text>` +
          (d.type === 'switch' && w.net.stpOn(d.id, 1) && w.net.stp(1).roots.includes(d.id) && switches(w).length > 1 ? `<text class="nls-switching-sub" x="${d.x}" y="${d.y - hy - 6}" text-anchor="middle">Root (VLAN 1)</text>` : '');
        nodes += `<g class="${cls}" data-act="sel" data-id="${esc(d.id)}" tabindex="-1" role="presentation">${shape}</g>`;
      }
      const label = `แผนผังเครือข่าย: ${T.devices.map(d => d.name).join(', ')}` + (e ? ` · ขั้นปัจจุบัน: ${SW.describe(e, w.net)}` : '');
      return `<section class="nls-switching-card" aria-label="แผนผังเครือข่าย"><h3>แผนผังเครือข่าย</h3>
<div class="nls-switching-svgbox"><svg class="nls-switching-svg" viewBox="${x0} ${y0} ${x1 - x0} ${y1 - y0}" role="img" aria-label="${esc(label)}">${links}${labels}${nodes}${badges}</svg></div>
<div class="nls-switching-chips" role="group" aria-label="เลือกอุปกรณ์">${T.devices.map(d => `<button type="button" class="nls-switching-chip" data-act="sel" data-id="${esc(d.id)}" data-fk="chip-${esc(d.id)}" aria-pressed="${w.sel === d.id}">${esc(d.name)}</button>`).join('')}</div>
<p class="nls-switching-legend">เส้นน้ำเงินหนา = เฟรมในขั้นปัจจุบันกำลังออกจากอุปกรณ์ · วงกลมเขียว = พอร์ต STP Forwarding · กากบาทแดง = พอร์ตถูก Block · ป้าย tag = เฟรมมี 802.1Q tag บน trunk</p>
${storm ? stormBox() : ''}</section>`;
    }
    function stormBox() {
      const w = W();
      return `<div class="nls-switching-storm-box" role="alert"><p><b data-storm="${w.net.totalFrames}">${w.stormShown >= w.net.totalFrames || reduce() ? w.net.totalFrames.toLocaleString('en-US') : '0'}</b> เฟรมบนสาย</p>
<p>Broadcast storm: เฟรม broadcast วนรอบ loop ซ้ำไม่รู้จบ (Ethernet ไม่มี TTL) แบบจำลองหยุดเมื่อมีเฟรมประมาณ ${SW.MAX_EVENTS.toLocaleString('en-US')} เฟรม ในเครือข่ายจริงจะเพิ่มขึ้นเรื่อย ๆ จนลิงก์และ CPU ของสวิตช์เต็ม ตาราง MAC กระโดดไปมา และทุกเครื่องใช้งานไม่ได้ ตัวเลขบนสายคือจำนวนเฟรมที่ผ่านสายนั้น</p>
<p>วิธีแก้: เปิด Spanning Tree (spanning-tree vlan 1) หรือถอดสายที่ทำให้เกิด loop (การเปลี่ยนการตั้งค่าจะล้างสถานะ storm)</p></div>`;
    }
    function startStormAnim() {
      cancelAnimationFrame(raf);
      const el = root.querySelector('[data-storm]'), w = mission() ? W() : null;
      if (!el || !w || reduce() || w.stormShown >= w.net.totalFrames) return;
      const goal = Number(el.getAttribute('data-storm')), t0 = performance.now();
      const tick = t => {
        if (!alive) return;
        const k = Math.min(1, (t - t0) / 1400), v = Math.round(goal * k * k);
        el.textContent = v.toLocaleString('en-US');
        if (k < 1) raf = requestAnimationFrame(tick); else w.stormShown = goal;
      };
      raf = requestAnimationFrame(tick);
    }

    /* ---------- ping / trace ---------- */
    function pingCard() {
      const w = W(), list = pcs(w);
      const opt = (sel, withIp) => list.map(d => `<option value="${esc(d.id)}"${d.id === sel ? ' selected' : ''}>${esc(d.name)}${withIp ? ' (' + esc(d.ip) + ')' : ''}</option>`).join('');
      const L = w.last;
      let res = '';
      if (L) {
        const who = nameOf(w, L.src), dst = L.op === 'ping' ? L.dst : 'broadcast';
        if (L.op === 'bcast') res = `<div class="nls-switching-res ${L.ok ? 'nls-switching-good' : 'nls-switching-fail'}" role="status">Broadcast ทดสอบจาก ${esc(who)}: ${L.ok ? 'ไปถึง ' + esc(L.reached.map(id => nameOf(w, id)).join(', ') || 'ไม่มีเครื่องใดเลย') : esc(SW.REASON_TEXT[L.reason] || L.reason)}</div>`;
        else res = `<div class="nls-switching-res ${L.ok ? 'nls-switching-good' : 'nls-switching-fail'}" role="status"><span class="${L.ok ? 'nls-switching-ok' : 'nls-switching-bad'}">${L.ok ? 'Ping สำเร็จ' : 'Ping ไม่สำเร็จ'}</span> ${esc(who)} → ${esc(dst)}: ${esc(L.reasonText)}</div>`;
      }
      const m = mission();
      const req = m.start.required ? `<p class="nls-switching-muted">ลำดับที่ต้องทำ: ${m.start.required.map((r, i) => `${i + 1}) ${esc(nameOf(w, r.src))} ping ${esc(nameOf(w, r.dst))}`).join('  ')}</p>` : '';
      const hist = w.actions.length ? `<p class="nls-switching-muted">ทำไปแล้ว ${w.actions.length} ครั้ง: ${w.actions.slice(-6).map(a => a.op === 'ping' ? esc(nameOf(w, a.src)) + '→' + esc(a.dst) : a.op === 'bcast' ? esc(nameOf(w, a.src)) + '→broadcast' : 'ล้างตาราง').join(', ')}${w.actions.length > 6 ? ' …' : ''}</p>` : '';
      return `<section class="nls-switching-card" aria-label="ทดสอบ"><h3>ทดสอบด้วย Ping</h3>${req}
<div class="nls-switching-row"><label class="nls-switching-field"><span>จาก</span><select data-act="pingsrc" data-fk="pingsrc">${opt(w.pingSrc)}</select></label>
<label class="nls-switching-field"><span>ไปยัง</span><select data-act="pingdst" data-fk="pingdst">${opt(w.pingDst, true)}</select></label></div>
<div class="nls-switching-row" style="margin-top:8px"><button type="button" class="nls-switching-btn" data-act="ping" data-fk="ping">Ping</button>
<button type="button" class="nls-switching-btn nls-switching-ghost" data-act="bcast" data-fk="bcast">ส่ง Broadcast ทดสอบ</button>
<button type="button" class="nls-switching-btn nls-switching-ghost" data-act="clear" data-fk="clear">ล้างตาราง MAC/ARP</button></div>
${res}${hist}<p class="nls-switching-msg" role="status" aria-live="polite">${esc(w.msg)}</p></section>`;
    }
    function traceCard() {
      const w = W(), L = w.last;
      if (!L || !L.entries || !L.entries.length) return `<section class="nls-switching-card" aria-label="ติดตามเฟรม"><h3>ติดตามเฟรม (Frame trace)</h3><p class="nls-switching-muted">${L ? 'การทดสอบล่าสุดไม่มีเฟรมออกจากเครื่อง (เช่น ปลายทางอยู่คนละ subnet เครื่องจึงไม่ส่งเลย)' : 'กด Ping แล้วดูเฟรมทีละขั้นที่นี่'}</p></section>`;
      const n = L.entries.length, i = Math.min(w.step, n - 1), e = L.entries[i];
      const kind = x => `<span class="nls-switching-kind">${esc(KSHORT[x.frame.kind] || x.frame.kind)}</span>`;
      const from = w.all ? 0 : Math.max(0, i - 8), to = w.all ? n : i + 1;
      const items = L.entries.slice(from, to).map((x, k) => `<li${from + k === i ? ' aria-current="true"' : ''}>${from + k + 1}. ${kind(x)}${esc(SW.describe(x, w.net))}</li>`).join('');
      return `<section class="nls-switching-card" aria-label="ติดตามเฟรม"><h3>ติดตามเฟรม (Frame trace)</h3>
<div class="nls-switching-now" aria-live="polite"><b>ขั้นที่ ${i + 1}/${n}${L.truncated ? '+' : ''}</b> ${kind(e)}${esc(SW.describe(e, w.net))}</div>
<div class="nls-switching-steps"><button type="button" class="nls-switching-btn nls-switching-ghost" data-act="step0" data-fk="step0"${i === 0 ? ' disabled' : ''} aria-label="ไปขั้นแรก">|&lt;</button>
<button type="button" class="nls-switching-btn nls-switching-ghost" data-act="prev" data-fk="prev"${i === 0 ? ' disabled' : ''}>ก่อนหน้า</button>
<button type="button" class="nls-switching-btn" data-act="next" data-fk="next"${i >= n - 1 ? ' disabled' : ''}>ถัดไป</button>
<button type="button" class="nls-switching-btn nls-switching-ghost" data-act="stepN" data-fk="stepN"${i >= n - 1 ? ' disabled' : ''} aria-label="ไปขั้นสุดท้าย">&gt;|</button>
<button type="button" class="nls-switching-btn nls-switching-ghost" data-act="all" data-fk="all" aria-pressed="${w.all}">แสดงทุกขั้น</button></div>
<ol class="nls-switching-trace" data-follow="1" aria-label="รายการขั้นของเฟรม">${items}</ol>${L.truncated ? '<p class="nls-switching-muted">แสดงเฉพาะ 400 ขั้นแรก</p>' : ''}</section>`;
    }

    /* ---------- device panel ---------- */
    function devicePanel() {
      const w = W(), d = devOf(w, w.sel);
      if (!d) return `<section class="nls-switching-card" aria-label="อุปกรณ์"><h3>อุปกรณ์</h3><p class="nls-switching-muted">แตะอุปกรณ์เพื่อดูรายละเอียดและตั้งค่า</p></section>`;
      if (d.type === 'pc') {
        const pr = peerOf(w, d.id, 'eth0');
        const pd = pr ? devOf(w, pr.dev) : null;
        const arp = w.net.arp(d.id);
        const where = pd ? `${esc(pd.name)} ${esc(pd.type === 'hub' ? pr.port : P(pr.port))}` + (pd.type === 'switch' ? ` (${pd.ifs[pr.port].mode === 'trunk' ? 'trunk' : 'access VLAN ' + pd.ifs[pr.port].vlan})` : '') : 'ไม่ได้ต่อสาย';
        return `<section class="nls-switching-card" aria-label="อุปกรณ์ ${esc(d.name)}"><h3>${esc(d.name)} <span class="nls-switching-tag">PC</span></h3>
<table><tbody><tr><th scope="row">IP</th><td class="nls-switching-mono">${esc(d.ip)}/${d.prefix} (${SW.maskStr(d.prefix)})</td></tr><tr><th scope="row">MAC</th><td class="nls-switching-mono">${esc(d.mac)}</td></tr>
<tr><th scope="row">ต่อกับ</th><td>${where}</td></tr>${d.group ? `<tr><th scope="row">กลุ่ม</th><td>${esc(d.group)}</td></tr>` : ''}</tbody></table>
<h4>ARP cache (arp -a)</h4>${arp.length ? `<div class="nls-switching-tablewrap"><table><thead><tr><th>IP</th><th>MAC</th><th>ชนิด</th></tr></thead><tbody>${arp.map(a => `<tr><td class="nls-switching-mono">${esc(a.ip)}</td><td class="nls-switching-mono">${esc(a.mac)}</td><td>dynamic</td></tr>`).join('')}</tbody></table></div>` : '<p class="nls-switching-muted">ว่าง (ยังไม่เคยคุยกับเครื่องใด)</p>'}
<div class="nls-switching-row" style="margin-top:8px"><button type="button" class="nls-switching-btn nls-switching-ghost" data-act="pingfrom" data-id="${esc(d.id)}" data-fk="pingfrom">ใช้เป็นต้นทาง Ping</button></div></section>`;
      }
      if (d.type === 'hub') {
        return `<section class="nls-switching-card" aria-label="อุปกรณ์ ${esc(d.name)}"><h3>${esc(d.name)} <span class="nls-switching-tag">Hub</span></h3>
<p>Hub ทำงานที่ Layer 1: รับสัญญาณที่พอร์ตหนึ่งแล้วทวนออกทุกพอร์ตที่เหลือ ไม่มีตาราง MAC ไม่รู้จัก VLAN ทุกพอร์ตจึงอยู่ใน collision domain เดียวกัน</p>
<ul>${d.portList.map(p => { const pr = peerOf(w, d.id, p.name); return `<li>${esc(p.name)}: ${pr ? esc(nameOf(w, pr.dev)) : 'ว่าง'}</li>`; }).join('')}</ul></section>`;
      }
      return switchPanel(w, d);
    }
    function vlanOptions(d, sel) {
      const ids = Object.keys(d.vlans).map(Number).sort((a, b) => a - b);
      let s = ids.map(v => `<option value="${v}"${v === sel ? ' selected' : ''}>${v} ${esc(d.vlans[v])}</option>`).join('');
      if (!ids.includes(sel)) s += `<option value="${sel}" selected>${sel} (ยังไม่ได้สร้าง)</option>`;
      return s;
    }
    function switchPanel(w, d) {
      const lk = locked(), dis = lk ? ' disabled' : '';
      const ids = Object.keys(d.vlans).map(Number).sort((a, b) => a - b);
      let s = `<section class="nls-switching-card" aria-label="อุปกรณ์ ${esc(d.name)}"><h3>${esc(d.name)} <span class="nls-switching-tag">Switch</span></h3>
<p class="nls-switching-muted">MAC (Base) <span class="nls-switching-mono">${esc(d.mac)}</span>${lk ? ' · ภารกิจนี้ล็อกการตั้งค่า (ใช้คำสั่ง show ได้)' : ''}</p>
<h4>VLAN database</h4><div class="nls-switching-tablewrap"><table><thead><tr><th>VLAN</th><th>ชื่อ</th><th><span class="nls-switching-muted">ลบ</span></th></tr></thead><tbody>`;
      for (const v of ids) {
        s += `<tr><td class="nls-switching-mono">${v}</td><td>${v === 1 || lk ? esc(d.vlans[v]) : `<input type="text" aria-label="ชื่อ VLAN ${v}" data-act="vname" data-v="${v}" data-fk="vname-${v}" value="${esc(d.vlans[v])}" maxlength="32" autocomplete="off" spellcheck="false">`}</td>` +
          `<td>${v === 1 || lk ? '' : `<button type="button" class="nls-switching-btn nls-switching-ghost" data-act="vdel" data-v="${v}" data-fk="vdel-${v}" aria-label="ลบ VLAN ${v}">ลบ</button>`}</td></tr>`;
      }
      s += '</tbody></table></div>';
      if (!lk) s += `<div class="nls-switching-row" style="margin-top:6px"><label class="nls-switching-field" style="flex:0 1 110px"><span>VLAN ID</span><input type="number" min="2" max="4094" inputmode="numeric" data-f="vid" data-fk="vid"></label>
<label class="nls-switching-field"><span>ชื่อ (ภาษาอังกฤษ)</span><input type="text" data-f="vname" data-fk="vnew" maxlength="32" autocomplete="off" spellcheck="false"></label>
<button type="button" class="nls-switching-btn" data-act="vadd" data-fk="vadd" style="align-self:flex-end">เพิ่ม VLAN</button></div>`;
      // ports
      s += `<h4>พอร์ต</h4><label class="nls-switching-check"><input type="checkbox" data-act="allports" data-fk="allports"${w.allPorts ? ' checked' : ''}> แสดงพอร์ตที่ไม่ได้ต่อสายด้วย</label>`;
      for (const p of d.portList) {
        const pr = peerOf(w, d.id, p.name);
        if (!pr && !w.allPorts) continue;
        const f = d.ifs[p.name], k = esc(p.name);
        const role = [];
        for (const v of w.net.vlans()) {
          if (!w.net.stpOn(d.id, v) || !w.net.carries(d.id, p.name, v)) continue;
          const i = w.net.stp(v).ports[d.id + '|' + p.name];
          if (i && pr && devOf(w, pr.dev).type !== 'pc') role.push(`VLAN ${v}: ${{ root: 'Root', designated: 'Desg', alternate: 'Altn', backup: 'Back' }[i.role]} ${i.inc ? 'BKN* ' + i.inc : i.state}`);
        }
        s += `<div class="nls-switching-port"><h5>${esc(P(p.name))} <small>${pr ? 'ต่อ ' + esc(nameOf(w, pr.dev)) + (devOf(w, pr.dev).type === 'pc' ? '' : ' ' + esc(devOf(w, pr.dev).type === 'hub' ? pr.port : P(pr.port))) : 'ไม่ได้ต่อสาย'}${f.shutdown ? ' · shutdown' : ''}</small>${role.length ? `<small>STP ${esc(role.join(' · '))}</small>` : ''}</h5><div class="nls-switching-pgrid">
<label class="nls-switching-field"><span>Mode</span><select data-act="pmode" data-port="${k}" data-fk="pmode-${k}"${dis}><option value="access"${f.mode === 'access' ? ' selected' : ''}>access</option><option value="trunk"${f.mode === 'trunk' ? ' selected' : ''}>trunk (802.1Q)</option></select></label>`;
        if (f.mode === 'access') s += `<label class="nls-switching-field"><span>Access VLAN</span><select data-act="pvlan" data-port="${k}" data-fk="pvlan-${k}"${dis}>${vlanOptions(d, f.vlan)}</select></label>`;
        else s += `<label class="nls-switching-field"><span>Allowed VLAN (all หรือ 10,20)</span><input type="text" data-act="pallowed" data-port="${k}" data-fk="pallowed-${k}" value="${esc(f.allowed == null ? 'all' : SW.vlanListStr(f.allowed))}" autocomplete="off" spellcheck="false"${dis}></label>
<label class="nls-switching-field" style="flex:0 1 110px"><span>Native VLAN</span><input type="number" min="1" max="4094" inputmode="numeric" data-act="pnative" data-port="${k}" data-fk="pnative-${k}" value="${f.native}"${dis}></label>`;
        s += `<label class="nls-switching-field" style="flex:0 1 120px"><span>STP cost (${w.net.portCost(d.id, p.name)})</span><input type="number" min="1" max="65535" inputmode="numeric" placeholder="auto" data-act="pcost" data-port="${k}" data-fk="pcost-${k}" value="${f.cost == null ? '' : f.cost}"${dis}></label>
<label class="nls-switching-check"><input type="checkbox" data-act="pshut" data-port="${k}" data-fk="pshut-${k}"${f.shutdown ? ' checked' : ''}${dis}> shutdown</label></div></div>`;
      }
      // STP
      s += '<h4>Spanning Tree (PVST+)</h4>';
      for (const v of ids) {
        const on = w.net.stpOn(d.id, v), info = on ? w.net.stp(v).bridges[d.id] : null;
        const prio = d.stp.prio[v] !== undefined ? d.stp.prio[v] : 32768;
        let opts = ''; for (let p = 0; p <= 61440; p += 4096) opts += `<option value="${p}"${p === prio ? ' selected' : ''}>${p}</option>`;
        s += `<div class="nls-switching-port"><h5>VLAN ${v} <small>${on ? `Bridge ID ${info.bid.prio}.${esc(d.mac)} · ${info.isRoot ? 'เป็น Root Bridge' : 'Root = ' + esc(nameOf(w, info.rootId)) + ' (cost ' + info.cost + ', root port ' + esc(P(info.rootPort)) + ')'}` : 'ปิด STP'}</small></h5><div class="nls-switching-pgrid">
<label class="nls-switching-check"><input type="checkbox" data-act="stpon" data-v="${v}" data-fk="stpon-${v}"${on ? ' checked' : ''}${dis}> เปิด STP</label>
<label class="nls-switching-field"><span>Bridge priority</span><select data-act="stpprio" data-v="${v}" data-fk="stpprio-${v}"${dis}>${opts}</select></label></div></div>`;
      }
      // CLI
      const c = cliOf(w, d);
      s += `<h4>คำสั่ง (CLI)</h4><p class="nls-switching-muted">ตัวอย่าง: conf t · vlan 10 · name LAB · interface range fa0/1 - 3 · switchport access vlan 10 · show vlan brief · show interfaces trunk · show spanning-tree · show mac address-table</p>
<div class="nls-switching-cli"><pre tabindex="0" aria-label="ผลลัพธ์คำสั่งของ ${esc(d.name)}" data-bottom="1">${esc(c.lines.join('\n'))}</pre>
<form class="nls-switching-cliform" data-act="cli"><label for="nls-switching-cli-in">${esc(SW.prompt(d, c.ses))}</label><input id="nls-switching-cli-in" type="text" data-f="cli" data-fk="cli" value="${esc(c.draft)}" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="send" aria-label="พิมพ์คำสั่งสำหรับ ${esc(d.name)}"><button type="submit" class="nls-switching-btn" data-fk="clirun">Enter</button></form></div></section>`;
      return s;
    }
    function cliOf(w, d) {
      if (!w.cli[d.id]) w.cli[d.id] = { ses: SW.newSession(), lines: [d.name + '#'], hist: [], hi: 0, draft: '' };
      return w.cli[d.id];
    }

    /* ---------- tables ---------- */
    function tablesCard() {
      const w = W();
      let s = '<section class="nls-switching-card" aria-label="ตาราง MAC และ STP"><h3>ตาราง MAC (MAC address table)</h3>';
      const owner = mac => { const d = w.topo.devices.find(x => x.mac === mac); return d ? d.name : ''; };
      for (const d of switches(w)) {
        s += `<h4>${esc(d.name)}</h4>`;
        if (hideMac()) { s += '<p class="nls-switching-muted">ซ่อนไว้ในภารกิจนี้: คิดจากเส้นทางเฟรมใน trace แล้วกรอกคำตอบด้านล่าง (จะแสดงหลังส่งงาน)</p>'; continue; }
        const t = w.net.macTable(d.id);
        s += t.length ? `<div class="nls-switching-tablewrap"><table><thead><tr><th>VLAN</th><th>MAC Address</th><th>Port</th></tr></thead><tbody>${t.map(e => `<tr><td>${e.vlan}</td><td class="nls-switching-mono">${esc(e.mac)} <span class="nls-switching-muted">${esc(owner(e.mac))}</span></td><td>${esc(P(e.port))}</td></tr>`).join('')}</tbody></table></div>`
          : '<p class="nls-switching-muted">ว่าง</p>';
      }
      const sws = switches(w);
      if (sws.length > 1) {
        s += '<h3 style="margin-top:14px">Spanning Tree</h3>';
        const vl = w.net.vlans().filter(v => sws.some(d => w.net.stpOn(d.id, v)));
        if (!vl.length) s += '<p class="nls-switching-bad">STP ปิดอยู่บนทุกสวิตช์ ถ้ามี loop จะเกิด broadcast storm</p>';
        for (const v of vl) {
          const st = w.net.stp(v);
          const off = sws.filter(d => Object.prototype.hasOwnProperty.call(d.vlans, v) && !w.net.stpOn(d.id, v));
          const ports = Object.values(st.ports).filter(p => { const pr = peerOf(w, p.sw, p.port); return pr && devOf(w, pr.dev).type !== 'pc'; });
          s += `<p><b>VLAN ${v}</b>: Root Bridge = ${st.roots.map(id => esc(nameOf(w, id))).join(', ')}${off.length ? ` <span class="nls-switching-bad">(ปิด STP: ${off.map(d => esc(d.name)).join(', ')})</span>` : ''}</p>`;
          if (ports.length) s += `<div class="nls-switching-tablewrap"><table><thead><tr><th>Switch</th><th>Port</th><th>Role</th><th>Sts</th><th>Cost</th></tr></thead><tbody>${ports.map(p => `<tr><td>${esc(nameOf(w, p.sw))}</td><td>${esc(P(p.port))}</td><td>${{ root: 'Root', designated: 'Desg', alternate: 'Altn', backup: 'Back' }[p.role]}</td><td class="${p.state === 'BLK' ? 'nls-switching-bad' : ''}">${p.inc ? 'BKN* ' + esc(p.inc) : p.state}</td><td>${p.cost}</td></tr>`).join('')}</tbody></table></div>`;
        }
      }
      return s + '</section>';
    }

    /* ---------- answers ---------- */
    function answersCard(m) {
      const w = W(), a = w.answers, k = m.start.kind;
      const chk = (key, val, label, list) => `<label class="nls-switching-check"><input type="checkbox" data-act="ans" data-k="${key}" data-v="${esc(val)}" data-fk="a-${key}-${esc(val)}"${(list || []).includes(val) ? ' checked' : ''}> ${esc(label)}</label>`;
      const rad = (key, val, label, curv) => `<label class="nls-switching-check"><input type="radio" name="nls-switching-${key}" data-act="ans" data-k="${key}" data-v="${esc(val)}" data-fk="a-${key}-${esc(val)}"${curv === val ? ' checked' : ''}> ${esc(label)}</label>`;
      let s = '';
      if (k === 'mac') {
        const swd = devOf(w, 'sw1'), t = a.table || {};
        s = `<p>กรอกตาราง MAC ของ ${esc(swd.name)} หลังทำครบทั้ง 3 ขั้น: MAC ของแต่ละเครื่องอยู่ที่พอร์ตใด</p><div class="nls-switching-tablewrap"><table><thead><tr><th>เครื่อง</th><th>MAC</th><th>พอร์ตใน ${esc(swd.name)}</th></tr></thead><tbody>` +
          pcs(w).map(d => `<tr><td>${esc(d.name)}</td><td class="nls-switching-mono">${esc(d.mac)}</td><td><select data-act="ans" data-k="table" data-id="${esc(d.id)}" data-fk="a-t-${esc(d.id)}" aria-label="พอร์ตของ ${esc(d.name)}"><option value="">-- เลือก --</option><option value="none"${t[d.id] === 'none' ? ' selected' : ''}>ไม่มีในตาราง</option>${swd.portList.map(p => `<option value="${esc(p.name)}"${t[d.id] === p.name ? ' selected' : ''}>${esc(P(p.name))}</option>`).join('')}</select></td></tr>`).join('') + '</tbody></table></div>';
      } else if (k === 'arp') {
        const q = m.start.ask, swd = devOf(w, q.sw), A = devOf(w, q.from), B = devOf(w, q.to);
        const linked = swd.portList.filter(p => peerOf(w, swd.id, p.name)).map(p => p.name);
        const others = pcs(w).filter(d => d.id !== A.id);
        const macs = [B.mac].concat(pcs(w).filter(d => d.id !== A.id && d.id !== B.id).map(d => d.mac), [swd.mac, SW.BCAST]).sort();
        s = `<fieldset class="nls-switching-q"><legend>1) ARP request ของ ${esc(A.name)} ถูกส่งออกจาก ${esc(swd.name)} ทางพอร์ตใดบ้าง</legend><div class="nls-switching-checks">${linked.map(p => chk('reqPorts', p, P(p), a.reqPorts)).join('')}</div></fieldset>
<fieldset class="nls-switching-q"><legend>2) เครื่องใดบ้างที่ได้รับ ARP request นี้</legend><div class="nls-switching-checks">${others.map(d => chk('reqHosts', d.id, d.name, a.reqHosts)).join('')}</div></fieldset>
<fieldset class="nls-switching-q"><legend>3) ARP reply ถูกส่งออกจาก ${esc(swd.name)} ทางพอร์ตใด</legend><div class="nls-switching-checks">${linked.map(p => rad('repPort', p, P(p), a.repPort)).join('')}${rad('repPort', 'none', 'ไม่ได้ส่งออก (filter)', a.repPort)}</div></fieldset>
<div class="nls-switching-q"><label class="nls-switching-field"><span style="color:var(--ink);font-weight:600">4) หลัง ping แล้ว ARP cache ของ ${esc(A.name)} มี ${esc(B.ip)} คู่กับ MAC ใด</span><select data-act="ans" data-k="arpMac" data-fk="a-arpMac"><option value="">-- เลือก --</option>${macs.map(x => `<option value="${esc(x)}"${a.arpMac === x ? ' selected' : ''}>${esc(x)}</option>`).join('')}<option value="none"${a.arpMac === 'none' ? ' selected' : ''}>ไม่มี entry</option></select></label></div>
<fieldset class="nls-switching-q"><legend>5) ${esc(B.name)} มี entry ของ ${esc(A.name)} ใน ARP cache หรือไม่</legend><div class="nls-switching-checks">${rad('bHasA', 'yes', 'มี', a.bHasA === true ? 'yes' : a.bHasA === false ? 'no' : '')}${rad('bHasA', 'no', 'ไม่มี', a.bHasA === true ? 'yes' : a.bHasA === false ? 'no' : '')}</div></fieldset>`;
      } else if (k === 'stp') {
        const opts = [];
        for (const l of w.topo.links) { const A = devOf(w, l.a), B = devOf(w, l.b); if (A.type === 'switch' && B.type === 'switch') { opts.push([l.a + '|' + l.ap, A.name + ' ' + P(l.ap)], [l.b + '|' + l.bp, B.name + ' ' + P(l.bp)]); } }
        opts.sort((x, y) => x[1].localeCompare(y[1]));
        s = `<label class="nls-switching-field"><span style="color:var(--ink);font-weight:600">พอร์ตที่ STP block (Alternate) หลังตั้งค่าเสร็จ</span><select data-act="ans" data-k="blocked" data-fk="a-blocked"><option value="">-- เลือก --</option>${opts.map(([v, t]) => `<option value="${esc(v)}"${a.blocked === v ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select></label>`;
      } else if (k === 'hub') {
        const H = m.start.hub, S = m.start.sw;
        const side = id => pcs(w).filter(d => w.topo.links.some(l => (l.a === d.id && l.b === id) || (l.b === d.id && l.a === id)));
        const src1 = m.start.required[0].src, src2 = m.start.required[1].src;
        s = `<div class="nls-switching-row"><label class="nls-switching-field"><span style="color:var(--ink);font-weight:600">จำนวน collision domain ฝั่ง ${esc(nameOf(w, H))}</span><input type="number" min="0" max="20" inputmode="numeric" data-act="ans" data-k="cdHub" data-fk="a-cdHub" value="${a.cdHub != null ? esc(a.cdHub) : ''}"></label>
<label class="nls-switching-field"><span style="color:var(--ink);font-weight:600">จำนวน collision domain ฝั่ง ${esc(nameOf(w, S))}</span><input type="number" min="0" max="20" inputmode="numeric" data-act="ans" data-k="cdSw" data-fk="a-cdSw" value="${a.cdSw != null ? esc(a.cdSw) : ''}"></label></div>
<fieldset class="nls-switching-q"><legend>Echo Request ของ ${esc(nameOf(w, src1))} ping ${esc(nameOf(w, m.start.required[0].dst))} ไปถึงการ์ดแลนของเครื่องใดบ้าง</legend><div class="nls-switching-checks">${side(H).filter(d => d.id !== src1).map(d => chk('recvHub', d.id, d.name, a.recvHub)).join('')}</div></fieldset>
<fieldset class="nls-switching-q"><legend>Echo Request ของ ${esc(nameOf(w, src2))} ping ${esc(nameOf(w, m.start.required[1].dst))} ไปถึงการ์ดแลนของเครื่องใดบ้าง</legend><div class="nls-switching-checks">${side(S).filter(d => d.id !== src2).map(d => chk('recvSw', d.id, d.name, a.recvSw)).join('')}</div></fieldset>`;
      } else {
        s = '<p class="nls-switching-muted">ภารกิจนี้ตรวจจากการตั้งค่าสวิตช์ของคุณ: เซิร์ฟเวอร์จะสร้างเครือข่ายใหม่จากค่าที่ตั้ง แล้วทดสอบ ping และ broadcast ระหว่างทุกคู่เครื่องเอง</p>';
      }
      return `<section class="nls-switching-card" aria-label="คำตอบ"><h3>คำตอบ</h3>${s}</section>`;
    }
    function submitCard(m) {
      const w = W();
      let s = `<section class="nls-switching-card" aria-label="ส่งงาน"><h3>ตรวจคำตอบ / ส่งงาน</h3><button type="button" class="nls-switching-btn" data-act="submit" data-fk="submit"${w.sending ? ' disabled' : ''}>${w.sending ? 'กำลังตรวจ…' : 'ตรวจคำตอบ / ส่งงาน'}</button><div role="status" aria-live="polite">`;
      const r = w.result;
      if (r) {
        if (r.error) s += `<p class="nls-switching-bad">${esc(r.error)}</p>`;
        else {
          s += `<p class="nls-switching-score ${r.score >= r.max ? 'nls-switching-ok' : ''}">คะแนน ${r.score}/${r.max}${r.saved ? ' · บันทึกแล้ว' : ''}</p>`;
          if (Array.isArray(r.feedback) && r.feedback.length) s += `<ul class="nls-switching-fb">${r.feedback.map(f => `<li>${esc(f)}</li>`).join('')}</ul>`;
        }
      }
      return s + '</div></section>';
    }

    /* ---------- state changes ---------- */
    function commit(text) {
      const w = W();
      w.net = SW.create(w.topo);
      w.actions = []; w.last = null; w.step = 0; w.stormShown = 0;
      w.msg = (text ? text + ' · ' : '') + 'การตั้งค่าเปลี่ยน: ล้างตาราง MAC/ARP และประวัติการทดสอบแล้ว';
    }
    function doAction(a) {
      const w = W();
      if (w.actions.length >= SW.MAX_ACTIONS) { w.msg = `ทดสอบได้สูงสุด ${SW.MAX_ACTIONS} ครั้งต่อการตั้งค่าหนึ่งชุด: กด "ล้างตาราง" ไม่ช่วย ให้กด "เริ่มภารกิจนี้ใหม่" หรือเปลี่ยนการตั้งค่า`; return; }
      w.actions.push(a);
      let r = null;
      if (a.op === 'ping') r = w.net.ping(a.src, a.dst);
      else if (a.op === 'bcast') r = w.net.broadcast(a.src);
      else { w.net.clear('mac'); w.net.clear('arp'); w.msg = 'ล้างตาราง MAC ของสวิตช์และ ARP cache ของทุกเครื่องแล้ว' + (w.net.storm ? ' (แต่ storm ยังวนอยู่เพราะ loop ยังอยู่)' : ''); return; }
      w.last = r; w.step = 0; w.msg = '';
    }
    function runCli(line) {
      const w = W(), d = devOf(w, w.sel); if (!d || d.type !== 'switch') return;
      const c = cliOf(w, d);
      const pr = SW.prompt(d, c.ses);
      c.lines.push(pr + ' ' + line);
      if (line.trim()) { c.hist.push(line); if (c.hist.length > 50) c.hist.shift(); }
      c.hi = c.hist.length; c.draft = '';
      const t = (line.trim().split(/\s+/)[0] || '').toLowerCase();
      if (hideMac() && /^(sh|sho|show|do)$/.test(t) && /\bmac/i.test(line)) { c.lines.push('% ซ่อนไว้ในภารกิจนี้: ให้คิดจาก trace (จะดูได้หลังส่งงาน)'); return; }
      const T2 = clone(w.topo);
      const res = SW.cli(T2, d.id, c.ses, line, w.net);
      if (res.changed && locked()) { c.lines.push('% ภารกิจนี้ล็อกการตั้งค่า ใช้ได้เฉพาะคำสั่ง show'); }
      else {
        c.lines.push(...res.out);
        if (res.changed) { w.topo = T2; commit(''); }
        if (res.cleared) { w.actions.push({ op: 'clear', what: 'mac' }); }
      }
      if (c.lines.length > 400) c.lines.splice(0, c.lines.length - 400);
    }
    function setPort(port, fn, text) {
      const w = W(), d = devOf(w, w.sel);
      if (!d || d.type !== 'switch' || locked() || !d.ifs[port]) return;
      fn(d.ifs[port], d);
      commit(`${d.name} ${P(port)}: ${text}`);
    }
    const NAME_OK = /^[\x21-\x7e][\x20-\x7e]{0,31}$/;

    function onClick(ev) {
      const t = ev.target.closest('[data-act]');
      if (!t || !root.contains(t)) return;
      const act = t.getAttribute('data-act');
      if (t.tagName === 'SELECT' || (t.tagName === 'INPUT' && t.type !== 'button') || t.tagName === 'FORM') return;
      const w = mission() ? W() : null;
      if (act === 'mission') { cur = t.getAttribute('data-id'); render(); const h = root.querySelector('#nls-switching-mt'); if (h) h.scrollIntoView({ block: 'start', behavior: reduce() ? 'auto' : 'smooth' }); return; }
      if (!w) return;
      if (act === 'hint') { w.hints++; }
      else if (act === 'reset') {
        if (!window.confirm('เริ่มภารกิจนี้ใหม่? การตั้งค่า การทดสอบ และคำตอบของภารกิจนี้จะถูกล้าง')) return;
        delete work[cur]; delete draft.work[cur]; W();
      }
      else if (act === 'sel') { w.sel = t.getAttribute('data-id'); }
      else if (act === 'ping') { const d = devOf(w, w.pingDst); doAction({ op: 'ping', src: w.pingSrc, dst: d ? d.ip : '' }); }
      else if (act === 'bcast') doAction({ op: 'bcast', src: w.pingSrc });
      else if (act === 'clear') doAction({ op: 'clear', what: 'both' });
      else if (act === 'pingfrom') { w.pingSrc = t.getAttribute('data-id'); w.msg = 'ตั้ง ' + nameOf(w, w.pingSrc) + ' เป็นต้นทาง Ping แล้ว'; }
      else if (act === 'step0') w.step = 0;
      else if (act === 'prev') w.step = Math.max(0, w.step - 1);
      else if (act === 'next') w.step = Math.min(w.last.entries.length - 1, w.step + 1);
      else if (act === 'stepN') w.step = w.last.entries.length - 1;
      else if (act === 'all') w.all = !w.all;
      else if (act === 'vdel') {
        const d = devOf(w, w.sel), v = Number(t.getAttribute('data-v'));
        if (!d || locked() || v === 1) return;
        const users = d.portList.filter(p => d.ifs[p.name].mode === 'access' && d.ifs[p.name].vlan === v).map(p => P(p.name));
        delete d.vlans[v];
        commit(`ลบ VLAN ${v} จาก ${d.name}` + (users.length ? ` (พอร์ต ${users.join(', ')} ยังอยู่ใน VLAN ${v} จึงกลายเป็น inactive)` : ''));
      }
      else if (act === 'vadd') {
        const d = devOf(w, w.sel); if (!d || locked()) return;
        const idEl = root.querySelector('[data-f="vid"]'), nmEl = root.querySelector('[data-f="vname"]');
        const v = Number(idEl && idEl.value), nm = (nmEl && nmEl.value || '').trim();
        if (!Number.isInteger(v) || v < 2 || v > 4094) { w.msg = 'VLAN ID ต้องเป็นตัวเลข 2–4094 (VLAN 1 มีอยู่แล้ว)'; }
        else if (nm && !NAME_OK.test(nm)) { w.msg = 'ชื่อ VLAN ใช้ได้เฉพาะตัวอักษรภาษาอังกฤษ ตัวเลข และสัญลักษณ์ ไม่เกิน 32 ตัว (เหมือนในสวิตช์จริง)'; }
        else { d.vlans[v] = nm || 'VLAN' + ('000' + v).slice(-4); commit(`${d.name}: สร้าง VLAN ${v} ชื่อ ${d.vlans[v]}`); }
      }
      else if (act === 'submit') { submit(); return; }
      else return;
      render();
    }
    function onChange(ev) {
      const t = ev.target, act = t.getAttribute && t.getAttribute('data-act');
      if (!act || !mission()) return;
      const w = W(), port = t.getAttribute('data-port'), d = devOf(w, w.sel);
      if (act === 'pingsrc') { w.pingSrc = t.value; return; }
      if (act === 'pingdst') { w.pingDst = t.value; return; }
      if (act === 'allports') w.allPorts = t.checked;
      else if (act === 'pmode') setPort(port, f => { f.mode = t.value === 'trunk' ? 'trunk' : 'access'; }, 'switchport mode ' + t.value);
      else if (act === 'pvlan') setPort(port, f => { f.vlan = Number(t.value); }, 'switchport access vlan ' + t.value);
      else if (act === 'pallowed') {
        const raw = t.value.trim().toLowerCase();
        const list = raw === 'all' || raw === '' ? null : SW.parseVlanList(raw);
        if (raw !== 'all' && raw !== '' && !list) { w.msg = 'รูปแบบ allowed VLAN ไม่ถูกต้อง: ใช้ all หรือรายการเช่น 10,20,99 หรือ 10-20'; }
        else setPort(port, f => { f.allowed = list; }, 'switchport trunk allowed vlan ' + (list ? SW.vlanListStr(list) : 'all'));
      }
      else if (act === 'pnative') {
        const v = Number(t.value);
        if (!Number.isInteger(v) || v < 1 || v > 4094) w.msg = 'native VLAN ต้องเป็นตัวเลข 1–4094';
        else setPort(port, f => { f.native = v; }, 'switchport trunk native vlan ' + v);
      }
      else if (act === 'pcost') {
        const raw = t.value.trim(), v = Number(raw);
        if (raw !== '' && (!Number.isInteger(v) || v < 1 || v > 65535)) w.msg = 'STP cost ต้องเป็นตัวเลข 1–65535 หรือเว้นว่าง (auto)';
        else setPort(port, f => { f.cost = raw === '' ? null : v; }, raw === '' ? 'no spanning-tree cost' : 'spanning-tree cost ' + v);
      }
      else if (act === 'pshut') setPort(port, f => { f.shutdown = t.checked; }, t.checked ? 'shutdown' : 'no shutdown');
      else if (act === 'vname') {
        const v = Number(t.getAttribute('data-v')), nm = t.value.trim();
        if (!d || locked() || v === 1) return;
        if (!NAME_OK.test(nm)) { w.msg = 'ชื่อ VLAN ใช้ได้เฉพาะตัวอักษรภาษาอังกฤษ ตัวเลข และสัญลักษณ์ ไม่เกิน 32 ตัว'; }
        else { d.vlans[v] = nm; commit(`${d.name}: VLAN ${v} name ${nm}`); }
      }
      else if (act === 'stpon') {
        const v = Number(t.getAttribute('data-v')); if (!d || locked()) return;
        d.stp.off = t.checked ? d.stp.off.filter(x => x !== v) : d.stp.off.concat([v]).sort((a, b) => a - b);
        commit(`${d.name}: ${t.checked ? '' : 'no '}spanning-tree vlan ${v}`);
      }
      else if (act === 'stpprio') {
        const v = Number(t.getAttribute('data-v')), p = Number(t.value); if (!d || locked()) return;
        if (p === 32768) delete d.stp.prio[v]; else d.stp.prio[v] = p;
        commit(`${d.name}: spanning-tree vlan ${v} priority ${p}`);
      }
      else if (act === 'ans') {
        const k = t.getAttribute('data-k'), v = t.getAttribute('data-v'), a = w.answers;
        if (k === 'table') { a.table = a.table || {}; a.table[t.getAttribute('data-id')] = t.value || undefined; }
        else if (t.type === 'checkbox') { const s = new Set(Array.isArray(a[k]) ? a[k] : []); if (t.checked) s.add(v); else s.delete(v); a[k] = [...s]; }
        else if (k === 'bHasA') a.bHasA = v === 'yes';
        else if (t.type === 'radio') a[k] = v;
        else if (t.type === 'number') a[k] = t.value === '' ? undefined : Number(t.value);
        else a[k] = t.value || undefined;
        saveDraft();
        return;
      }
      else return;
      render();
    }
    function onSubmit(ev) {
      const f = ev.target;
      if (!f.matches || !f.matches('form[data-act="cli"]')) return;
      ev.preventDefault();
      const inp = f.querySelector('[data-f="cli"]');
      runCli(inp ? inp.value : '');
      render();
      const n = root.querySelector('[data-f="cli"]'); if (n) n.focus({ preventScroll: true });
    }
    function onInput(ev) {
      const t = ev.target;
      if (t.getAttribute && t.getAttribute('data-f') === 'cli') { const w = W(), d = devOf(w, w.sel); if (d && d.type === 'switch') cliOf(w, d).draft = t.value; }
    }
    function onKey(ev) {
      const t = ev.target;
      if (t.getAttribute && t.getAttribute('data-f') === 'cli' && (ev.key === 'ArrowUp' || ev.key === 'ArrowDown')) {
        const w = W(), d = devOf(w, w.sel); if (!d) return;
        const c = cliOf(w, d);
        if (!c.hist.length) return;
        ev.preventDefault();
        c.hi = Math.max(0, Math.min(c.hist.length, c.hi + (ev.key === 'ArrowUp' ? -1 : 1)));
        t.value = c.draft = c.hist[c.hi] || '';
        return;
      }
      // keyboard step-through when focus is in the trace card (not in a field)
      if ((ev.key === 'ArrowRight' || ev.key === 'ArrowLeft') && t.closest && t.closest('[aria-label="ติดตามเฟรม"]') && t.tagName === 'BUTTON') {
        const b = root.querySelector(`[data-act="${ev.key === 'ArrowRight' ? 'next' : 'prev'}"]`);
        if (b && !b.disabled) { ev.preventDefault(); b.click(); const nb = root.querySelector(`[data-act="${ev.key === 'ArrowRight' ? 'next' : 'prev'}"]`); if (nb && !nb.disabled) nb.focus(); }
      }
    }
    async function submit() {
      const m = mission(), w = W();
      if (!m || w.sending || typeof ctx.submit !== 'function') return;
      const payload = { actions: w.actions.slice(), answers: clone(w.answers) };
      if (!m.start.lock) payload.config = SW.exportConfig(w.topo);
      w.sending = true; render();
      try {
        const r = await ctx.submit(m.id, payload);
        if (!alive) return;
        w.result = r || { error: 'ไม่ได้รับผลการตรวจ' };
        if (r && typeof r.score === 'number') {
          const b = best[m.id] || { best: 0, max: r.max, attempts: 0 };
          b.attempts = (b.attempts || 0) + 1; b.best = Math.max(b.best || 0, r.score); b.max = r.max; best[m.id] = b;
        }
      } catch (err) {
        if (!alive) return;
        w.result = { error: 'ส่งงานไม่สำเร็จ: ' + (err && err.message ? err.message : 'เกิดข้อผิดพลาด') };
      }
      w.sending = false; render();
      const el = root.querySelector('.nls-switching-score') || root.querySelector('[data-act="submit"]');
      if (el) el.scrollIntoView({ block: 'nearest', behavior: reduce() ? 'auto' : 'smooth' });
    }

    root.addEventListener('click', onClick);
    root.addEventListener('change', onChange);
    root.addEventListener('submit', onSubmit);
    root.addEventListener('input', onInput);
    root.addEventListener('keydown', onKey);
    render();
    return {
      destroy() {
        alive = false;
        cancelAnimationFrame(raf);
        root.removeEventListener('click', onClick);
        root.removeEventListener('change', onChange);
        root.removeEventListener('submit', onSubmit);
        root.removeEventListener('input', onInput);
        root.removeEventListener('keydown', onKey);
        root.innerHTML = '';
      }
    };
  }

  root.NL_SIMS = root.NL_SIMS || {};
  root.NL_SIMS.switching = { title: TITLE, mount };
})(typeof self !== 'undefined' ? self : this);

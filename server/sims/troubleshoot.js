'use strict';
/*
 * Network Troubleshooting Lab - server grader (NetLab, SIM-SPEC §2 + §4.5)
 *
 * Mission start (public): { story, symptoms:[], topo (with the injected fault), causes:[{id,text}], focusHost,
 *                           hosts:[devIds the student may sit at], successPings:[[src, target], ...] }
 * Server only: the correct cause, the allowed edits and the fault checks.
 *
 * Payload: { cause: string, topo: Topology }
 * Score (max 10) = cause 4 + fix 6.
 *   Fix: the submitted topology must be the scenario topology (same devices, same links, same endpoints) where only
 *   "editable fields" changed and every changed field is in the mission's allowed list (otherwise "แก้ไขเกินขอบเขต").
 *   Then fix = 3 x (success pings passing in NetSim) + 3 x (fault checks passing: the fault itself is repaired,
 *   not worked around).
 *
 * Editable fields (field keys):  <dev>.ip  <dev>.prefix  <dev>.gateway  <dev>.dns  <dev>.dhcp  <dev>.up (adapter enabled)
 *   <dev>.ssid  <dev>.icmp (host firewall allows ping)  <router>.routes  link.<linkId>.up (cable plugged)
 *   (2.6) <dev>.fw (host firewall switched on)  <dev>.smb (firewall allows SMB 445)  <dev>.dnsSvc (DNS Server service running)
 *         <router>.if:<iface> (interface "ip/prefix")
 *
 * EVIDENCE MISSIONS (x9 onwards, start.mode === 'evidence') — no list of causes, nothing to pick.
 *   Payload: { topo, actions: [{ k:'cmd'|'inspect'|'svc'|'test', host, cmd, dev, target, port, ph:'b'|'a' }] }
 *   The actions are replayed on the server with the shared helpers of public/js/sim/troubleshoot.js:
 *   'b' actions (before the first change) on the original faulty network = diagnostic evidence, 'a' actions on the
 *   submitted network = verification. Score (max 10):
 *     4  problem solved: the mission checks (ping / TCP service tests) pass on the submitted network
 *     2  root cause repaired (fault checks; a workaround that makes the checks pass does not earn these)
 *     3  diagnostic evidence collected before changing anything (scenario-specific evidence items, 1 point each)
 *     1  verified after the change (own ping / service test of a mission check, or the test button, passing)
 *   minus 2 per regression (a "keep" check that worked in the original network no longer works),
 *   minus 1 per change outside the fault, and minus 1 more per destructive change (unplugging, disabling an adapter,
 *   removing a route, switching a firewall off, stopping a service); score never below 0.
 *   After grading, details.evidence = [{ text, area, got:true } | { area, got:false }] (the text of a missing item is
 *   never sent). details.explain = { cause, evidence[], fix } only once every fault is repaired and every check passes
 *   (evidence[] stays empty until all evidence items were collected); otherwise null. Fault messages that name the
 *   faulty setting are shown only when the student already changed that setting (FAULT_KEYS), else a generic hint.
 */
const path = require('path');
const NetSim = require(path.join(__dirname, '../../public/js/sim/netsim.js'));
const TS = require(path.join(__dirname, '../../public/js/sim/troubleshoot.js'));
const IP = NetSim.ip;

const MAX = 10, CAUSE_PTS = 4, PING_PTS = 3, FAULT_PTS = 3;
const LIM = { devices: 60, links: 150, routes: 30, dns: 4, str: 60 };

// ------------------------------------------------------------------ topology helpers
const clone = x => JSON.parse(JSON.stringify(x));
const L = (id, a, ap, b, bp, extra) => Object.assign({ id, a: { dev: a, port: ap }, b: { dev: b, port: bp }, medium: 'utp', up: true }, extra || {});
const host = (id, type, name, ip, prefix, gw, dns, mac, extra) => Object.assign({
  id, type, name, ifaces: [{ name: type === 'laptop' ? 'wlan0' : 'eth0', ip, prefix, mac, up: true }], gateway: gw || '', dns: dns || [], dhcp: false
}, extra || {});
const sw = (id, name, x, y) => ({ id, type: 'switch', name, x, y, ports: 24 });
const inet = (ip, x, y) => ({ id: 'net', type: 'internet', name: 'Internet', x, y, ifaces: [{ name: 'wan', ip, prefix: 30, up: true }],
  hosts: { '8.8.8.8': 'dns.google', '1.1.1.1': 'one.one.one.one', '203.0.113.80': 'www.netlab.test' } });
const dev = (t, id) => t.devices.find(d => d.id === id);
const lnk = (t, id) => t.links.find(l => l.id === id);

// Room 3: 192.168.3.0/24, SRV-ROOM3 (DNS + web), Router -> Internet
function room3() {
  return {
    devices: [
      host('pc7', 'pc', 'PC7', '192.168.3.27', 24, '192.168.3.1', ['192.168.3.5'], '3C-52-82-03-00-27', { x: 80, y: 330 }),
      host('pc8', 'pc', 'PC8', '192.168.3.28', 24, '192.168.3.1', ['192.168.3.5'], '3C-52-82-03-00-28', { x: 190, y: 360 }),
      host('pc15', 'pc', 'PC15', '192.168.3.35', 24, '192.168.3.1', ['192.168.3.5'], '3C-52-82-03-00-35', { x: 300, y: 370 }),
      host('pc21', 'pc', 'PC21', '192.168.3.41', 24, '192.168.3.1', ['192.168.3.5'], '3C-52-82-03-00-41', { x: 410, y: 360 }),
      host('srv', 'server', 'SRV-ROOM3', '192.168.3.5', 24, '192.168.3.1', ['8.8.8.8'], '00-15-5D-03-00-05', { x: 520, y: 330,
        services: { dns: { records: { 'dns.lab.local': '192.168.3.5', 'srv.lab.local': '192.168.3.5' } }, web: true } }),
      sw('sw1', 'SW-ROOM3', 300, 220),
      { id: 'r1', type: 'router', name: 'R-ROOM3', x: 480, y: 120,
        ifaces: [{ name: 'g0/0', ip: '192.168.3.1', prefix: 24, mac: '00-1E-7A-03-00-01', up: true }, { name: 'g0/1', ip: '203.0.113.2', prefix: 30, up: true }],
        routes: [{ net: '0.0.0.0', prefix: 0, via: '203.0.113.1' }] },
      inet('203.0.113.1', 660, 120)
    ],
    links: [L('l1', 'pc7', 'eth0', 'sw1', 'p7'), L('l2', 'pc8', 'eth0', 'sw1', 'p8'), L('l3', 'pc15', 'eth0', 'sw1', 'p15'),
      L('l4', 'pc21', 'eth0', 'sw1', 'p21'), L('l5', 'srv', 'eth0', 'sw1', 'p1'), L('l6', 'r1', 'g0/0', 'sw1', 'p24'),
      L('l7', 'r1', 'g0/1', 'net', 'wan', { medium: 'fiber' })]
  };
}

// 3.1 week 1: an office LAN in a Star, no router, no IP knowledge needed (PC1-PC4 + FileServer -> SW-OFFICE)
function office1() {
  const pc = (n, x, y) => host('pc' + n, 'pc', 'PC' + n, '192.168.1.1' + n, 24, '', [], '3C-52-82-01-00-1' + n, { x, y });
  return {
    devices: [pc(1, 80, 320), pc(2, 200, 360), pc(3, 330, 370), pc(4, 460, 350),
      host('srv', 'server', 'FileServer', '192.168.1.5', 24, '', [], '00-15-5D-01-00-05', { x: 520, y: 170, services: { web: true } }),
      sw('sw1', 'SW-OFFICE', 280, 200)],
    links: [L('l1', 'pc1', 'eth0', 'sw1', 'p1'), L('l2', 'pc2', 'eth0', 'sw1', 'p2'), L('l3', 'pc3', 'eth0', 'sw1', 'p3'),
      L('l4', 'pc4', 'eth0', 'sw1', 'p4'), L('l5', 'srv', 'eth0', 'sw1', 'p24')]
  };
}

// ------------------------------------------------------------------ scenarios
const COMMON_HINT = 'เริ่มจากเครื่องที่มีปัญหา: ipconfig /all → ping gateway → ping server → ping 8.8.8.8 → ping ด้วยชื่อ (เช่น ping www.netlab.test) แล้วดูว่าขั้นไหนเริ่มล้มเหลว';
const SCENARIOS = [
  {
    id: 'x1', level: 'easy', title: 'PC7 เข้าเว็บไม่ได้ แต่เพื่อนเข้าได้',
    desc: 'หาสาเหตุที่ PC7 ใช้เครือข่ายไม่ได้ แก้ไข แล้วทดสอบ',
    story: 'ห้องคอม 3: นักเรียนที่นั่ง PC7 แจ้งว่าเปิดเว็บและเข้า server ไม่ได้เลย ขณะที่ PC8 ข้าง ๆ ใช้งานได้ปกติ',
    symptoms: ['PC7 เปิดเว็บ www.netlab.test ไม่ได้', 'PC7 เข้า \\\\srv.lab.local ไม่ได้', 'PC8 ใช้งานได้ปกติ'],
    hints: [COMMON_HINT, 'ถ้า ipconfig ขึ้น Media disconnected หรือ ping ขึ้น General failure ให้ดูสถานะสายสัญญาณของเครื่อง'],
    build() { const t = room3(); lnk(t, 'l1').up = false; return t; },
    focusHost: 'pc7', hosts: ['pc7', 'pc8'],
    successPings: [['pc7', '192.168.3.5'], ['pc7', 'www.netlab.test']],
    causes: [
      ['cable', 'สาย LAN ของ PC7 หลุดหรือขาด (ไม่มี link)'], ['ip', 'IP address ของ PC7 ซ้ำกับเครื่องอื่น'],
      ['dns', 'DNS server ของ PC7 ตั้งค่าผิด'], ['router', 'Router ไม่มีเส้นทางออกอินเทอร์เน็ต'],
      ['srvdown', 'SRV-ROOM3 ปิดเครื่องอยู่'], ['gw', 'Default gateway ของ PC7 ผิด']
    ],
    cause: 'cable',
    allowed: ['link.l1.up'],
    faults: [(t) => lnk(t, 'l1') && lnk(t, 'l1').up !== false ? null : 'สายของ PC7 ยังไม่ได้เสียบ (link down)'],
    explain: 'ping ขึ้น "General failure" และ ipconfig ขึ้น "Media disconnected" แปลว่าการ์ดแลนไม่มีสัญญาณ (layer 1) ต้องตรวจสายก่อนเสมอ'
  },
  {
    id: 'x2', level: 'easy', title: 'Notebook ต่อ Wi-Fi ห้องสมุดไม่ได้',
    desc: 'NB-LIB04 เชื่อมต่อ Wi-Fi ไม่ได้ ขณะที่เครื่องอื่นต่อได้',
    story: 'ห้องสมุดมี Access Point ชื่อ AP-LIB ปล่อย Wi-Fi ให้ notebook ของนักเรียน (ทุกเครื่องรับ IP แบบ DHCP จาก Router) NB-LIB04 เพิ่งตั้งค่าใหม่และเข้าอินเทอร์เน็ตไม่ได้ ส่วน NB-LIB01 ใช้ได้ปกติ',
    symptoms: ['NB-LIB04 ไม่มี IP (ipconfig ขึ้น Media disconnected)', 'NB-LIB01 ใช้งานได้ปกติ', 'ไฟสถานะ AP ปกติ'],
    hints: ['คลิกที่ AP และ NB-LIB04 ในแผนผังเพื่อเปรียบเทียบชื่อเครือข่าย Wi-Fi (SSID) เครื่องจะเชื่อมต่อได้เมื่อ SSID ตรงกับ AP', COMMON_HINT],
    build() {
      const t = {
        devices: [
          host('nb1', 'laptop', 'NB-LIB01', '', 24, '', [], 'F4-8C-50-0A-00-01', { dhcp: true, ssid: 'NETLAB-LIB', x: 90, y: 330 }),
          host('nb4', 'laptop', 'NB-LIB04', '', 24, '', [], 'F4-8C-50-0A-00-04', { dhcp: true, ssid: 'NETLAB-GUEST', x: 230, y: 360 }),
          { id: 'ap1', type: 'ap', name: 'AP-LIB', x: 170, y: 200, ssid: 'NETLAB-LIB', security: 'WPA2', ports: 1 },
          sw('sw1', 'SW-LIB', 330, 200),
          host('srv', 'server', 'SRV-LIB', '192.168.40.5', 24, '192.168.40.1', ['8.8.8.8'], '00-15-5D-40-00-05', { x: 420, y: 340,
            services: { dns: { records: { 'dns.lib.local': '192.168.40.5', 'opac.lib.local': '192.168.40.5' } }, web: true } }),
          { id: 'r1', type: 'router', name: 'R-LIB', x: 470, y: 110,
            ifaces: [{ name: 'g0/0', ip: '192.168.40.1', prefix: 24, up: true }, { name: 'g0/1', ip: '203.0.113.6', prefix: 30, up: true }],
            routes: [{ net: '0.0.0.0', prefix: 0, via: '203.0.113.5' }],
            services: { dhcp: { start: '192.168.40.100', end: '192.168.40.200', prefix: 24, gateway: '192.168.40.1', dns: ['192.168.40.5'] } } },
          inet('203.0.113.5', 640, 110)
        ],
        links: [L('w1', 'nb1', 'wlan0', 'ap1', 'wifi', { medium: 'wifi' }), L('w2', 'nb4', 'wlan0', 'ap1', 'wifi', { medium: 'wifi' }),
          L('l1', 'ap1', 'p1', 'sw1', 'p1'), L('l2', 'srv', 'eth0', 'sw1', 'p2'), L('l3', 'r1', 'g0/0', 'sw1', 'p24'),
          L('l4', 'r1', 'g0/1', 'net', 'wan', { medium: 'fiber' })]
      };
      return t;
    },
    focusHost: 'nb4', hosts: ['nb4', 'nb1'],
    successPings: [['nb4', '192.168.40.5'], ['nb4', 'www.netlab.test']],
    causes: [
      ['ssid', 'NB-LIB04 ตั้งชื่อ Wi-Fi (SSID) ไม่ตรงกับ AP-LIB'], ['dhcp', 'Router ไม่แจก IP (DHCP ไม่ทำงาน)'],
      ['ap', 'Access Point เสีย'], ['dns', 'DNS server ของ notebook ผิด'], ['fw', 'Firewall ของ NB-LIB04 บล็อกอินเทอร์เน็ต'],
      ['cable', 'สาย LAN ระหว่าง AP กับ Switch หลุด']
    ],
    cause: 'ssid',
    allowed: ['nb4.ssid'],
    faults: [(t) => { const n = dev(t, 'nb4'), a = dev(t, 'ap1'); return n && a && String(n.ssid || '').trim() === a.ssid ? null : 'SSID ของ NB-LIB04 ยังไม่ตรงกับ AP-LIB'; }],
    explain: 'Wi-Fi จะเชื่อมต่อ (associate) ได้เมื่อ SSID และรหัสผ่านตรงกับ AP เท่านั้น ถ้าไม่ได้เชื่อมต่อก็ไม่ได้ IP จาก DHCP'
  },
  {
    id: 'x3', level: 'medium', title: 'PC21 ใช้ในห้องได้ แต่ออกอินเทอร์เน็ตไม่ได้',
    desc: 'PC21 ping server ในห้องได้ แต่ออกนอกวงไม่ได้',
    story: 'ห้องคอม 3: ช่างเพิ่งตั้งค่า IP แบบ Static ให้ PC21 ใหม่ นักเรียนแจ้งว่าเข้า server ในห้อง (srv.lab.local) ได้ แต่เปิดเว็บภายนอกไม่ได้เลย',
    symptoms: ['ping 192.168.3.5 จาก PC21 ได้', 'ping 8.8.8.8 จาก PC21 ไม่ได้', 'เครื่องอื่นในห้องออกอินเทอร์เน็ตได้'],
    hints: [COMMON_HINT, 'ติดต่อในวงได้แต่ออกนอกวงไม่ได้ มักเกี่ยวกับ Default gateway: ลอง ping gateway ของเครื่อง และเทียบกับ IP ของ Router'],
    build() { const t = room3(); dev(t, 'pc21').gateway = '192.168.3.254'; return t; },
    focusHost: 'pc21', hosts: ['pc21', 'pc8'],
    successPings: [['pc21', '8.8.8.8'], ['pc21', 'www.netlab.test']],
    causes: [
      ['gw', 'Default gateway ของ PC21 ตั้งเป็น IP ที่ไม่มีอยู่จริง (ไม่ใช่ Router)'], ['dns', 'DNS server ของ PC21 ผิด'],
      ['mask', 'Subnet mask ของ PC21 ผิด'], ['cable', 'สาย LAN ของ PC21 หลุด'], ['isp', 'อินเทอร์เน็ตของวิทยาลัยล่ม'],
      ['fw', 'Firewall ของ PC21 บล็อก ping']
    ],
    cause: 'gw',
    allowed: ['pc21.gateway', 'pc21.dns'],
    faults: [(t) => dev(t, 'pc21') && dev(t, 'pc21').gateway === '192.168.3.1' ? null : 'Default gateway ของ PC21 ยังไม่ใช่ IP ของ Router ในวงนี้'],
    explain: 'Default gateway ต้องเป็น IP ของ Router ในวงเดียวกัน ถ้าตั้งเป็น IP ที่ไม่มีเครื่องใช้ ping ออกนอกวงจะได้ "Destination host unreachable" จาก IP ของตัวเอง'
  },
  {
    id: 'x4', level: 'medium', title: 'ครูเข้า File server อาคาร 2 ไม่ได้',
    desc: 'PC-T05 ออกอินเทอร์เน็ตได้ แต่เข้า server วง 192.168.20.0/24 ไม่ได้',
    story: 'ห้องพักครู (192.168.10.0/24) เชื่อมกับห้อง server (192.168.20.0/24) ผ่าน R-CORE เครื่อง PC-T05 ของครูเพิ่งลงวินโดวส์ใหม่ เปิดเว็บภายนอกได้ แต่เข้า File server fs.school.local ไม่ได้ ขณะที่ PC-T01 เข้าได้',
    symptoms: ['PC-T05 ping 8.8.8.8 ได้', 'PC-T05 ping 192.168.20.10 ได้ "Destination host unreachable"', 'PC-T01 เข้า File server ได้'],
    hints: [COMMON_HINT, 'เปรียบเทียบ ipconfig ของ PC-T05 กับ PC-T01 ทีละบรรทัด', 'ถ้า Subnet mask กว้างเกินไป เครื่องจะคิดว่าปลายทางอยู่วงเดียวกัน จึงไม่ส่งผ่าน gateway'],
    build() {
      return {
        devices: [
          host('t01', 'pc', 'PC-T01', '192.168.10.41', 24, '192.168.10.1', ['192.168.20.53'], '50-9A-4C-10-00-41', { x: 80, y: 330 }),
          host('t05', 'pc', 'PC-T05', '192.168.10.45', 16, '192.168.10.1', ['192.168.20.53'], '50-9A-4C-10-00-45', { x: 210, y: 360 }),
          sw('sw1', 'SW-TEACHER', 150, 210),
          { id: 'r1', type: 'router', name: 'R-CORE', x: 330, y: 120,
            ifaces: [{ name: 'g0/0', ip: '192.168.10.1', prefix: 24, up: true }, { name: 'g0/1', ip: '192.168.20.1', prefix: 24, up: true },
              { name: 'g0/2', ip: '203.0.113.10', prefix: 30, up: true }],
            routes: [{ net: '0.0.0.0', prefix: 0, via: '203.0.113.9' }] },
          sw('sw2', 'SW-SERVER', 470, 210),
          host('fs', 'server', 'FS-SCHOOL', '192.168.20.10', 24, '192.168.20.1', ['192.168.20.53'], '00-15-5D-20-00-10', { x: 420, y: 350, services: { file: true } }),
          host('dns', 'server', 'DNS-SCHOOL', '192.168.20.53', 24, '192.168.20.1', ['8.8.8.8'], '52-54-00-20-00-53', { os: 'linux', x: 570, y: 350,
            services: { dns: { records: { 'dns.school.local': '192.168.20.53', 'fs.school.local': '192.168.20.10' } } } }),
          Object.assign(inet('203.0.113.9', 330, 0))
        ],
        links: [L('l1', 't01', 'eth0', 'sw1', 'p1'), L('l2', 't05', 'eth0', 'sw1', 'p5'), L('l3', 'r1', 'g0/0', 'sw1', 'p24'),
          L('l4', 'r1', 'g0/1', 'sw2', 'p24'), L('l5', 'fs', 'eth0', 'sw2', 'p1'), L('l6', 'dns', 'eth0', 'sw2', 'p2'),
          L('l7', 'r1', 'g0/2', 'net', 'wan', { medium: 'fiber' })]
      };
    },
    focusHost: 't05', hosts: ['t05', 't01'],
    successPings: [['t05', '192.168.20.10'], ['t05', 'fs.school.local']],
    causes: [
      ['mask', 'Subnet mask ของ PC-T05 ผิด (กว้างเกินวงจริง)'], ['gw', 'Default gateway ของ PC-T05 ผิด'],
      ['route', 'R-CORE ไม่มีเส้นทางไปวง 192.168.20.0/24'], ['fs', 'File server ปิดเครื่อง'],
      ['dns', 'DNS server ของ PC-T05 ผิด'], ['dup', 'IP ของ PC-T05 ซ้ำกับเครื่องอื่น']
    ],
    cause: 'mask',
    allowed: ['t05.prefix'],
    faults: [(t) => { const d = dev(t, 't05'); return d && IP.toPrefix(d.ifaces[0].prefix) === 24 ? null : 'Subnet mask ของ PC-T05 ยังไม่ตรงกับวงเครือข่ายห้องพักครู (ดู mask ของ Router g0/0)'; }],
    explain: 'mask /16 (255.255.0.0) ทำให้ PC-T05 เข้าใจว่า 192.168.20.x อยู่วงเดียวกัน จึง ARP หาเองแทนที่จะส่งให้ gateway ทั้งที่ 8.8.8.8 ยังออกได้ตามปกติ'
  },
  {
    id: 'x5', level: 'medium', title: 'ping IP ได้ แต่เรียกชื่อไม่ได้',
    desc: 'PC15 ping 8.8.8.8 ได้ แต่เปิดเว็บด้วยชื่อไม่ได้',
    story: 'ห้องคอม 3: PC15 เปิดเว็บไม่ได้ทุกเว็บ ขึ้นข้อความ "DNS_PROBE_FINISHED_NXDOMAIN / ไม่พบเซิร์ฟเวอร์" แต่ครูลอง ping 8.8.8.8 แล้วได้ Reply ปกติ',
    symptoms: ['ping 8.8.8.8 จาก PC15 ได้', 'ping www.netlab.test จาก PC15 ขึ้น could not find host', 'เครื่องอื่นในห้องเปิดเว็บได้'],
    hints: [COMMON_HINT, 'ping ด้วย IP ได้ แต่ด้วยชื่อไม่ได้ = ปัญหาการแปลงชื่อ (DNS) ดู DNS Servers ใน ipconfig /all เทียบกับเครื่องอื่น และใช้ nslookup'],
    build() { const t = room3(); dev(t, 'pc15').dns = ['192.168.3.50']; return t; },
    focusHost: 'pc15', hosts: ['pc15', 'pc8'],
    successPings: [['pc15', 'www.netlab.test'], ['pc15', 'srv.lab.local']],
    causes: [
      ['dns', 'DNS server ของ PC15 ตั้งเป็น IP ที่ไม่ใช่ DNS server'], ['gw', 'Default gateway ของ PC15 ผิด'],
      ['web', 'เว็บไซต์ปลายทางล่ม'], ['cable', 'สาย LAN ของ PC15 หลวม'], ['isp', 'อินเทอร์เน็ตของวิทยาลัยล่ม'],
      ['browser', 'เบราว์เซอร์ของ PC15 เสีย']
    ],
    cause: 'dns',
    allowed: ['pc15.dns'],
    faults: [(t) => { const d = dev(t, 'pc15'); const dns = d && Array.isArray(d.dns) ? d.dns : []; return dns.includes('192.168.3.50') ? 'ยังมี DNS server ที่ไม่มีอยู่จริงค้างอยู่ในรายการ DNS ของ PC15' : null; }],
    explain: 'ping IP ได้แปลว่าเครือข่าย (IP, gateway, สาย) ปกติ แต่เรียกชื่อไม่ได้แปลว่า DNS server ผิดหรือติดต่อไม่ได้ (nslookup จะขึ้น DNS request timed out)'
  },
  {
    id: 'x6', level: 'medium', title: 'ping server ไม่ได้ แต่เปิดเว็บได้',
    desc: 'ทุกเครื่อง ping SRV-ROOM3 ไม่ได้ แต่เปิดเว็บและ DNS ใช้ได้ — เครือข่ายเสียจริงหรือ?',
    story: 'หลังติดตั้งอัปเดต Windows Server เมื่อคืน ทุกเครื่องในห้องคอม 3 ping SRV-ROOM3 ได้ "Request timed out" แต่เปิดเว็บ http://srv.lab.local และเรียกชื่อเว็บ (DNS) ได้ปกติ ครูให้ตรวจและเปิดให้ ping ได้เพื่อใช้ระบบ monitor',
    symptoms: ['ping 192.168.3.5 จากทุกเครื่องได้ Request timed out', 'เปิดเว็บ http://srv.lab.local ได้ปกติ', 'nslookup ผ่าน SRV-ROOM3 ได้ปกติ'],
    hints: [COMMON_HINT, 'ถ้าบริการอื่นของ server ใช้ได้แต่ ping อย่างเดียวไม่ได้ ให้คิดถึง Firewall ของปลายทางที่บล็อก ICMP Echo'],
    build() { const t = room3(); dev(t, 'srv').firewall = { icmp: false }; return t; },
    focusHost: 'pc8', hosts: ['pc8', 'srv'],
    successPings: [['pc8', '192.168.3.5'], ['pc7', 'srv.lab.local']],
    causes: [
      ['fw', 'Firewall ของ SRV-ROOM3 บล็อก ping (ICMP) — เครือข่ายไม่ได้เสีย'], ['cable', 'สาย LAN ของ SRV-ROOM3 หลุด'],
      ['ip', 'IP ของ SRV-ROOM3 เปลี่ยนไป'], ['sw', 'Switch เสีย'], ['dns', 'DNS ของเครื่องลูกข่ายผิด'], ['gw', 'Default gateway ของ server ผิด']
    ],
    cause: 'fw',
    allowed: ['srv.icmp'],
    faults: [(t) => { const d = dev(t, 'srv'); return d && !(d.firewall && (d.firewall.icmp === false || d.firewall.icmp === 'false')) ? null : 'Firewall ของ SRV-ROOM3 ยังบล็อก ICMP (ping) อยู่'; }],
    explain: 'ping ไม่ได้ไม่ได้แปลว่าเครือข่ายเสียเสมอไป Windows Firewall บล็อก ICMP Echo ได้ ขณะที่บริการอื่น (เว็บ, DNS) ยังใช้ได้ตามปกติ'
  },
  {
    id: 'x7', level: 'hard', title: 'ทั้งห้องได้ IP 169.254.x.x',
    desc: 'ทุกเครื่องในห้องคอม 4 (DHCP) ได้ IP แบบ APIPA',
    story: 'เช้าวันจันทร์ ทุกเครื่องในห้องคอม 4 ใช้งานเครือข่ายไม่ได้ ipconfig ขึ้น Autoconfiguration IPv4 Address 169.254.x.x ทุกเครื่อง เมื่อวันศุกร์ช่างเพิ่งเข้ามาตั้งค่า server ของห้อง (SRV-DHCP ทำหน้าที่ DHCP และ DNS)',
    symptoms: ['ทุกเครื่องได้ IP 169.254.x.x และไม่มี Default gateway', 'ไฟที่ Switch ของ PC ทุกเครื่องติดปกติ', 'Router ทำงานปกติ'],
    hints: [COMMON_HINT, '169.254.x.x (APIPA) = เครื่องขอ IP จาก DHCP แล้วไม่มีใครตอบ ให้ตรวจเครื่องที่เป็น DHCP server ว่าเชื่อมต่อเครือข่ายอยู่หรือไม่'],
    build() {
      return {
        devices: [
          host('pc1', 'pc', 'PC4-01', '', 24, '', [], '3C-52-82-04-00-01', { dhcp: true, x: 80, y: 330 }),
          host('pc2', 'pc', 'PC4-02', '', 24, '', [], '3C-52-82-04-00-02', { dhcp: true, x: 190, y: 360 }),
          host('pc3', 'pc', 'PC4-03', '', 24, '', [], '3C-52-82-04-00-03', { dhcp: true, x: 300, y: 370 }),
          host('dhcp', 'server', 'SRV-DHCP', '192.168.4.10', 24, '192.168.4.1', ['8.8.8.8'], '00-15-5D-04-00-10', { x: 450, y: 350,
            services: { dhcp: { start: '192.168.4.100', end: '192.168.4.180', prefix: 24, gateway: '192.168.4.1', dns: ['192.168.4.10'] },
              dns: { records: { 'dns.room4.local': '192.168.4.10', 'srv.room4.local': '192.168.4.10' } } } }),
          sw('sw1', 'SW-ROOM4', 280, 220),
          { id: 'r1', type: 'router', name: 'R-ROOM4', x: 470, y: 120,
            ifaces: [{ name: 'g0/0', ip: '192.168.4.1', prefix: 24, up: true }, { name: 'g0/1', ip: '203.0.113.14', prefix: 30, up: true }],
            routes: [{ net: '0.0.0.0', prefix: 0, via: '203.0.113.13' }] },
          inet('203.0.113.13', 650, 120)
        ],
        links: [L('l1', 'pc1', 'eth0', 'sw1', 'p1'), L('l2', 'pc2', 'eth0', 'sw1', 'p2'), L('l3', 'pc3', 'eth0', 'sw1', 'p3'),
          L('l4', 'dhcp', 'eth0', 'sw1', 'p23'), L('l5', 'r1', 'g0/0', 'sw1', 'p24'), L('l6', 'r1', 'g0/1', 'net', 'wan', { medium: 'fiber' })]
      };
    },
    fault(t) { dev(t, 'dhcp').ifaces[0].up = false; },
    focusHost: 'pc1', hosts: ['pc1', 'pc2', 'dhcp'],
    successPings: [['pc1', '192.168.4.10'], ['pc2', 'www.netlab.test'], ['pc3', '8.8.8.8']],
    causes: [
      ['dhcpdown', 'DHCP server (SRV-DHCP) ไม่ได้เชื่อมต่อเครือข่าย — Network adapter ถูกปิด'], ['router', 'Router เสีย'],
      ['dns', 'DNS server ผิด'], ['pcs', 'การ์ดแลนของ PC ทุกเครื่องเสีย'], ['pool', 'DHCP pool เต็ม'], ['switch', 'Switch ของห้องเสีย']
    ],
    cause: 'dhcpdown',
    allowed: ['dhcp.up', 'link.l4.up'],
    faults: [
      (t) => { const d = dev(t, 'dhcp'); return d && d.ifaces[0].up !== false ? null : 'Network adapter ของ SRV-DHCP ยังถูกปิดอยู่'; },
      (t, net) => ['pc1', 'pc2', 'pc3'].every(id => dev(t, id) && dev(t, id).dhcp === true && net.config(id) && !net.config(id).apipa && net.config(id).ip) ? null : 'PC ในห้องต้องยังรับ IP แบบ DHCP และได้ IP จาก SRV-DHCP (ไม่ใช่ตั้ง Static แก้ขัด)'
    ],
    explain: 'IP 169.254.x.x (APIPA) แปลว่าเครื่องหา DHCP server ไม่เจอ ปัญหาจึงอยู่ที่ DHCP server ไม่ใช่ที่ PC ทุกเครื่อง เมื่อ server กลับมา PC ใช้ ipconfig /renew ขอ IP ใหม่ได้'
  },
  {
    id: 'x8', level: 'hard', title: 'สองปัญหาซ้อน: PC12 และ server อาคาร 2',
    desc: 'มีความผิดพลาด 2 จุด: ต้องหาให้ครบและแก้ทั้งสองจุด',
    story: 'อาคาร 1 (192.168.1.0/24) ต่อกับอาคาร 2 (192.168.20.0/24) ผ่าน R-BLD1 และ R-BLD2 วันนี้ (1) ทุกเครื่องในอาคาร 1 เข้า server งานทะเบียน SRV-REG (192.168.20.10) ไม่ได้ และ (2) PC12 ที่เพิ่งติดตั้งใหม่ (ตั้ง IP โดยลอกค่าจากเครื่องข้าง ๆ) ใช้งานได้บ้างไม่ได้บ้าง และ PC3 ขึ้นเตือน IP ชนกัน',
    symptoms: ['PC3 ping 192.168.20.10 ได้ Destination net unreachable', 'Windows บน PC3 แจ้ง "IP address conflict"', 'ping จาก R-BLD2 ฝั่งอาคาร 2 ไปอาคาร 1 ได้ปกติ'],
    hints: [COMMON_HINT, '"Destination net unreachable" ตอบมาจาก Router = Router ไม่มี route ไปวงนั้น คลิกดู Routing table ของ Router',
      'ใช้ ipconfig บน PC3 และ PC12 เทียบกัน แล้วเลือก IP ว่างในวงเดียวกันให้ PC12'],
    build() {
      return {
        devices: [
          host('pc3', 'pc', 'PC3', '192.168.1.13', 24, '192.168.1.1', [], 'B4-2E-99-01-00-03', { x: 80, y: 330 }),
          host('pc12', 'pc', 'PC12', '192.168.1.13', 24, '192.168.1.1', [], 'B4-2E-99-01-00-12', { x: 210, y: 360 }),
          host('pc20', 'pc', 'PC20', '192.168.1.20', 24, '192.168.1.1', [], 'B4-2E-99-01-00-20', { x: 330, y: 370 }),
          sw('sw1', 'SW-BLD1', 200, 220),
          { id: 'r1', type: 'router', name: 'R-BLD1', x: 330, y: 120,
            ifaces: [{ name: 'g0/0', ip: '192.168.1.1', prefix: 24, up: true }, { name: 'g0/1', ip: '10.0.0.1', prefix: 30, up: true }], routes: [] },
          { id: 'r2', type: 'router', name: 'R-BLD2', x: 520, y: 120,
            ifaces: [{ name: 'g0/0', ip: '10.0.0.2', prefix: 30, up: true }, { name: 'g0/1', ip: '192.168.20.1', prefix: 24, up: true }],
            routes: [{ net: '192.168.1.0', prefix: 24, via: '10.0.0.1' }] },
          sw('sw2', 'SW-BLD2', 600, 230),
          host('reg', 'server', 'SRV-REG', '192.168.20.10', 24, '192.168.20.1', [], '00-15-5D-20-00-10', { x: 560, y: 360, services: { web: true } })
        ],
        links: [L('l1', 'pc3', 'eth0', 'sw1', 'p3'), L('l2', 'pc12', 'eth0', 'sw1', 'p12'), L('l3', 'pc20', 'eth0', 'sw1', 'p20'),
          L('l4', 'r1', 'g0/0', 'sw1', 'p24'), L('l5', 'r1', 'g0/1', 'r2', 'g0/0', { medium: 'fiber' }), L('l6', 'r2', 'g0/1', 'sw2', 'p24'),
          L('l7', 'reg', 'eth0', 'sw2', 'p1')]
      };
    },
    focusHost: 'pc12', hosts: ['pc12', 'pc3'],
    successPings: [['pc3', '192.168.20.10'], ['pc12', '192.168.20.10'], ['pc12', '192.168.1.20']],
    causes: [
      ['dup', 'IP ของ PC12 ซ้ำกับ PC3 เพียงอย่างเดียว'], ['route', 'R-BLD1 ไม่มีเส้นทางไปวง 192.168.20.0/24 เพียงอย่างเดียว'],
      ['both', 'IP ของ PC12 ซ้ำกับ PC3 และ R-BLD1 ไม่มีเส้นทางไปวง 192.168.20.0/24'], ['fw', 'SRV-REG บล็อก ping'],
      ['cable', 'สายระหว่าง R-BLD1 กับ R-BLD2 ขาด'], ['gw', 'Default gateway ของ PC12 ผิด และ SRV-REG ปิดเครื่อง']
    ],
    cause: 'both',
    allowed: ['pc12.ip', 'r1.routes'],
    faults: [
      (t, net) => {
        const d = dev(t, 'pc12'); const ip = d && d.ifaces[0].ip;
        if (!ip || !IP.inSubnet(ip, '192.168.1.0', 24)) return 'IP ของ PC12 ต้องอยู่ในวง 192.168.1.0/24 ของอาคาร 1';
        if (net.problems().some(p => p.code === 'dup_ip' || p.code === 'ip_is_network' || p.code === 'ip_is_broadcast' || (p.code === 'bad_ip' && p.dev === 'pc12'))) return 'IP ของ PC12 ยังซ้ำกับอุปกรณ์อื่น หรือใช้ไม่ได้';
        return null;
      },
      (t, net) => net.routes('r1').some(r => r.type === 'S' && r.via === '10.0.0.2' && IP.inSubnet('192.168.20.10', r.net, r.prefix)) ? null
        : 'R-BLD1 ยังไม่มี static route ไปวง 192.168.20.0/24 ผ่าน next hop 10.0.0.2 (R-BLD2)'
    ],
    explain: 'ปัญหาซ้อนกัน: route ที่หายไปทำให้ทั้งอาคาร 1 ไปอาคาร 2 ไม่ได้ ส่วน IP ซ้ำทำให้คำตอบที่ส่งกลับมาหา 192.168.1.13 ไปผิดเครื่อง ต้องแก้ทั้งสองจุด'
  },

  // ================================================================ evidence missions (no cause list)
  {
    id: 'x9', mode: 'evidence', level: 'easy', title: 'สั่งพิมพ์ไม่ออกตั้งแต่มีเครื่องใหม่',
    desc: 'ทั้งห้องธุรการสั่งพิมพ์ไม่ได้ หาหลักฐานว่าเกิดจากอะไร แล้วแก้ที่ต้นเหตุ',
    story: 'ห้องธุรการ (192.168.5.0/24) เช้านี้ช่างนำเครื่องใหม่ ADM-09 มาติดตั้ง โดยตั้ง IP แบบ Static ตามกระดาษโน้ตที่ติดอยู่ข้างโต๊ะ หลังจากนั้นทุกเครื่องสั่งพิมพ์ไปที่ PRN-ADMIN (192.168.5.20) ไม่ออกเลย ทั้งที่ไฟเครื่องพิมพ์ปกติ ส่วน ADM-09 เปิดเว็บได้ปกติ',
    symptoms: ['ADM-01 และ ADM-02 สั่งพิมพ์ไป 192.168.5.20 ไม่ออก (งานค้างในคิว)', 'ไฟสถานะและสายของ PRN-ADMIN ปกติ', 'ADM-09 เปิดเว็บและเข้า server ได้ แต่ตอนเปิดเครื่องมีหน้าต่างแจ้งเตือนเรื่องเครือข่ายขึ้นมาแวบหนึ่ง'],
    hints: [COMMON_HINT, 'ลอง ping 192.168.5.20 จาก ADM-01 แล้วดูค่า TTL ในคำตอบ: เครื่อง Windows ตอบ TTL=128 ส่วนเครื่องพิมพ์ (ระบบแบบ Linux) ตอบ TTL=64',
      'หลัง ping ให้ใช้ arp -a ดูว่า 192.168.5.20 ผูกกับ MAC address ใด แล้วเทียบกับ MAC ของเครื่องพิมพ์ในหน้าค่าตั้ง',
      'เครื่องมือ "ทดสอบบริการ" พอร์ต 9100 ใช้ตรวจว่าเครื่องพิมพ์รับงานพิมพ์ได้หรือไม่'],
    build() {
      return {
        devices: [
          host('pc1', 'pc', 'ADM-01', '192.168.5.11', 24, '192.168.5.1', ['192.168.5.5'], '3C-52-82-05-00-11', { x: 80, y: 330 }),
          host('pc2', 'pc', 'ADM-02', '192.168.5.12', 24, '192.168.5.1', ['192.168.5.5'], '3C-52-82-05-00-12', { x: 190, y: 365 }),
          host('pc9', 'pc', 'ADM-09', '192.168.5.20', 24, '192.168.5.1', ['192.168.5.5'], 'D8-BB-C1-05-00-09', { x: 300, y: 375 }),
          host('prn', 'printer', 'PRN-ADMIN', '192.168.5.20', 24, '192.168.5.1', [], '00-80-77-05-00-20', { x: 420, y: 360 }),
          host('srv', 'server', 'SRV-ADMIN', '192.168.5.5', 24, '192.168.5.1', ['8.8.8.8'], '00-15-5D-05-00-05', { x: 540, y: 330,
            services: { dns: { records: { 'dns.admin.local': '192.168.5.5', 'files.admin.local': '192.168.5.5' } }, file: true } }),
          sw('sw1', 'SW-ADMIN', 300, 220),
          { id: 'r1', type: 'router', name: 'R-ADMIN', x: 480, y: 110,
            ifaces: [{ name: 'g0/0', ip: '192.168.5.1', prefix: 24, up: true }, { name: 'g0/1', ip: '203.0.113.22', prefix: 30, up: true }],
            routes: [{ net: '0.0.0.0', prefix: 0, via: '203.0.113.21' }] },
          inet('203.0.113.21', 660, 110)
        ],
        links: [L('l1', 'pc1', 'eth0', 'sw1', 'p1'), L('l2', 'pc2', 'eth0', 'sw1', 'p2'), L('l3', 'pc9', 'eth0', 'sw1', 'p9'),
          L('l4', 'prn', 'eth0', 'sw1', 'p20'), L('l5', 'srv', 'eth0', 'sw1', 'p5'), L('l6', 'r1', 'g0/0', 'sw1', 'p24'),
          L('l7', 'r1', 'g0/1', 'net', 'wan', { medium: 'fiber' })]
      };
    },
    focusHost: 'pc1', hosts: ['pc1', 'pc2', 'pc9'], svcPorts: [9100, 445, 80],
    checks: [{ kind: 'tcp', src: 'pc1', target: '192.168.5.20', port: 9100 }, { kind: 'tcp', src: 'pc2', target: '192.168.5.20', port: 9100 }],
    keep: [{ kind: 'ping', src: 'pc9', target: '192.168.5.5' }, { kind: 'ping', src: 'pc9', target: 'www.netlab.test' },
      { kind: 'ping', src: 'pc2', target: 'www.netlab.test' }, { kind: 'tcp', src: 'pc1', target: 'files.admin.local', port: 445 }],
    allowed: ['pc9.ip'],
    faults: [(t, net) => {
      const d = dev(t, 'pc9'); const ip = d && d.ifaces[0] && d.ifaces[0].ip;
      if (!ip || !IP.inSubnet(ip, '192.168.5.0', 24)) return 'IP ของ ADM-09 ต้องยังอยู่ในวง 192.168.5.0/24 ของห้องธุรการ';
      const pr = dev(t, 'prn'); if (!pr || !pr.ifaces[0] || sv(pr.ifaces[0].ip) !== '192.168.5.20') return 'เครื่องพิมพ์ต้องคง IP 192.168.5.20 ไว้ (ทุกเครื่องตั้งค่าพิมพ์ไปที่ IP นี้) ต้องแก้ที่เครื่องที่ตั้ง IP ซ้ำ';
      if (net.problems().some(p => p.code === 'dup_ip' || ((p.code === 'ip_is_network' || p.code === 'ip_is_broadcast' || p.code === 'bad_ip') && p.dev === 'pc9'))) return 'ยังมี IP ซ้ำในเครือข่าย หรือ IP ของ ADM-09 ใช้ไม่ได้';
      return null;
    }],
    evidence: [
      { area: 'การทดสอบการเชื่อมต่อ (ping) และผู้ที่ตอบกลับ', text: 'ping 192.168.5.20 จากเครื่องอื่น (ไม่ใช่ ADM-09) แล้วได้คำตอบ TTL=128 ซึ่งเป็นค่าของเครื่อง Windows ไม่ใช่เครื่องพิมพ์ (TTL=64)',
        test: log => log.some(r => r.type === 'ping' && r.host !== 'pc9' && r.resolved === '192.168.5.20' && r.ok && r.responder === 'pc9') },
      { area: 'ตาราง ARP (IP คู่กับ MAC)', text: 'ใช้ arp -a หลัง ping แล้วเห็นว่า 192.168.5.20 ผูกกับ MAC D8-BB-C1-05-00-09 ซึ่งเป็นของ ADM-09 ไม่ใช่ MAC ของเครื่องพิมพ์',
        test: log => log.some(r => r.type === 'arp' && r.host !== 'pc9' && (r.arp || []).some(e => e.ip === '192.168.5.20' && e.mac === 'D8-BB-C1-05-00-09')) },
      { area: 'การตั้งค่า IP ของอุปกรณ์ที่เกี่ยวข้อง', text: 'ตรวจค่า IP ของทั้งเครื่องพิมพ์และ ADM-09 (ดูค่าตั้งของ PRN-ADMIN และ ipconfig/ค่าตั้งของ ADM-09) จึงเห็นว่าใช้ 192.168.5.20 เหมือนกัน',
        test: log => log.some(r => r.k === 'inspect' && r.dev === 'prn') && log.some(r => (r.k === 'inspect' && r.dev === 'pc9') || (r.type === 'ipconfig' && r.host === 'pc9')) }
    ],
    explainFull: {
      cause: 'ADM-09 ถูกตั้ง IP 192.168.5.20 ซ้ำกับเครื่องพิมพ์ PRN-ADMIN (IP ซ้ำ / IP conflict) เมื่อเครื่องอื่นส่ง ARP ถามหา 192.168.5.20 คำตอบจาก ADM-09 จึงถูกจำไว้ งานพิมพ์ทั้งหมดถูกส่งไปที่ ADM-09 ซึ่งไม่ได้เป็นเครื่องพิมพ์',
      evidence: ['ping 192.168.5.20 ได้ แต่ TTL=128 (Windows) แทนที่จะเป็น 64 (เครื่องพิมพ์) = เครื่องที่ตอบไม่ใช่เครื่องพิมพ์',
        'arp -a แสดง 192.168.5.20 คู่กับ MAC ของ ADM-09', 'ค่าตั้งของ PRN-ADMIN และ ADM-09 ใช้ IP เดียวกัน (Windows บน ADM-09 จึงแจ้งเตือน IP conflict)',
        'ทดสอบบริการพอร์ต 9100 ไป 192.168.5.20 ไม่ผ่าน (เครื่องที่ตอบไม่ได้เปิดบริการพิมพ์)'],
      fix: 'เปลี่ยน IP ของ ADM-09 (เครื่องที่ตั้งผิดทีหลัง) เป็น IP ที่ยังว่างในวง 192.168.5.0/24 โดยไม่ซ้ำ Router, server และเครื่องพิมพ์ ห้ามย้าย IP ของเครื่องพิมพ์เพราะทุกเครื่องตั้งค่าพิมพ์ไปที่ 192.168.5.20 ไว้แล้ว'
    }
  },
  {
    id: 'x10', mode: 'evidence', level: 'medium', title: 'เปิดเว็บด้วยชื่อไม่ได้ทั้งอาคาร',
    desc: 'ทุกเครื่องในอาคารอำนวยการเรียกเว็บด้วยชื่อไม่ได้ หาให้ได้ว่าเสียที่ส่วนไหน แล้วแก้ที่ต้นเหตุ',
    story: 'อาคารอำนวยการ (192.168.8.0/24) ใช้ SRV-DC01 เป็น DNS server ของทุกเครื่อง เมื่อคืนผู้ดูแลระบบติดตั้งอัปเดตและรีสตาร์ต SRV-DC01 เช้านี้ทุกเครื่องเปิดเว็บไม่ได้ ทั้งเว็บภายนอกและระบบงาน intranet.school.local เจ้าหน้าที่บางคนแนะนำให้เปลี่ยน DNS ทุกเครื่องเป็น 8.8.8.8',
    symptoms: ['เบราว์เซอร์ทุกเครื่องขึ้น "DNS_PROBE_FINISHED_NO_INTERNET" หรือ "ไม่พบเซิร์ฟเวอร์"', 'ไฟสายแลนทุกเครื่องปกติ', 'SRV-DC01 เปิดเครื่องอยู่ หน้าจอ server ปกติ'],
    hints: [COMMON_HINT, 'แยกให้ออกว่าปัญหาอยู่ที่ "เส้นทาง" หรือ "การแปลงชื่อ": ping ด้วย IP กับ ping ด้วยชื่อให้ผลต่างกันหรือไม่',
      'ถ้า ping DNS server ได้ แต่ nslookup ขึ้น DNS request timed out แปลว่าเครื่อง server ยังอยู่ แต่บริการ DNS ไม่ตอบ ให้ดูสถานะบริการในหน้าค่าตั้งของ server',
      'ถ้าเปลี่ยน DNS ทุกเครื่องเป็น 8.8.8.8 ชื่อภายใน เช่น intranet.school.local จะยังใช้ไม่ได้ เพราะมีอยู่ใน DNS ของโรงเรียนเท่านั้น'],
    build() {
      const pc = (id, name, n) => host(id, 'pc', name, '192.168.8.' + n, 24, '192.168.8.1', ['192.168.8.10'], '3C-52-82-08-00-' + n, {});
      return {
        devices: [
          Object.assign(pc('pc1', 'OFF-01', 21), { x: 80, y: 330 }), Object.assign(pc('pc2', 'OFF-02', 22), { x: 200, y: 365 }),
          Object.assign(pc('pc3', 'OFF-03', 23), { x: 320, y: 375 }),
          host('srv', 'server', 'SRV-DC01', '192.168.8.10', 24, '192.168.8.1', ['8.8.8.8'], '00-15-5D-08-00-10', { x: 470, y: 340,
            services: { dns: { enabled: false, records: { 'dc01.school.local': '192.168.8.10', 'intranet.school.local': '192.168.8.10' } }, web: true } }),
          sw('sw1', 'SW-OFFICE', 290, 220),
          { id: 'r1', type: 'router', name: 'R-OFFICE', x: 480, y: 110,
            ifaces: [{ name: 'g0/0', ip: '192.168.8.1', prefix: 24, up: true }, { name: 'g0/1', ip: '203.0.113.26', prefix: 30, up: true }],
            routes: [{ net: '0.0.0.0', prefix: 0, via: '203.0.113.25' }] },
          inet('203.0.113.25', 660, 110)
        ],
        links: [L('l1', 'pc1', 'eth0', 'sw1', 'p1'), L('l2', 'pc2', 'eth0', 'sw1', 'p2'), L('l3', 'pc3', 'eth0', 'sw1', 'p3'),
          L('l4', 'srv', 'eth0', 'sw1', 'p10'), L('l5', 'r1', 'g0/0', 'sw1', 'p24'), L('l6', 'r1', 'g0/1', 'net', 'wan', { medium: 'fiber' })]
      };
    },
    focusHost: 'pc1', hosts: ['pc1', 'pc2', 'srv'], svcPorts: [53, 80],
    checks: [{ kind: 'ping', src: 'pc1', target: 'intranet.school.local' }, { kind: 'ping', src: 'pc2', target: 'www.netlab.test' },
      { kind: 'tcp', src: 'pc3', target: 'intranet.school.local', port: 80 }],
    keep: [{ kind: 'ping', src: 'pc1', target: '8.8.8.8' }, { kind: 'ping', src: 'pc2', target: '192.168.8.10' },
      { kind: 'tcp', src: 'pc1', target: '192.168.8.10', port: 80 }],
    allowed: ['srv.dnsSvc'],
    faults: [(t) => { const d = dev(t, 'srv'); const s = d && d.services && d.services.dns; return s && s.enabled !== false && s.enabled !== 'false' ? null : 'บริการ DNS Server บน SRV-DC01 ยังหยุดทำงานอยู่'; }],
    evidence: [
      { area: 'การทดสอบด้วยชื่อ (hostname)', text: 'ทดสอบด้วยชื่อแล้วล้มเหลวเพราะแปลงชื่อไม่ได้ (nslookup ขึ้น DNS request timed out หรือ ping ชื่อขึ้น could not find host)',
        test: log => log.some(r => r.host !== 'srv' && ((r.type === 'nslookup' && !r.ok && r.reason === 'dns_fail') || (r.type === 'ping' && r.reason === 'dns_fail'))) },
      { area: 'การทดสอบด้วย IP address', text: 'ping ด้วย IP ออกนอกวงได้ (เช่น ping 8.8.8.8) แสดงว่า IP, gateway และ Router ยังปกติ',
        test: log => log.some(r => r.type === 'ping' && r.host !== 'srv' && r.ok && IP.parse(r.target) !== null && !IP.inSubnet(r.target, '192.168.8.0', 24)) },
      { area: 'สถานะของเครื่องและบริการปลายทาง', text: 'ยืนยันว่าเครื่อง DNS server ยังติดต่อได้ (ping 192.168.8.10 ได้) และตรวจพบว่าบริการ DNS บนเครื่องนั้นหยุดอยู่ (ดูค่าตั้งของ SRV-DC01 หรือทดสอบบริการพอร์ต 53)',
        test: log => log.some(r => r.host !== 'srv' && ((r.type === 'ping' && r.ok && r.resolved === '192.168.8.10') || (r.type === 'svc' && r.l3 && r.resolved === '192.168.8.10'))) &&
          log.some(r => (r.k === 'inspect' && r.dev === 'srv') || (r.type === 'svc' && r.port === 53 && r.resolved === '192.168.8.10' && !r.tcp)) }
    ],
    explainFull: {
      cause: 'บริการ DNS Server บน SRV-DC01 ไม่ได้เริ่มทำงานหลังรีสตาร์ต (DNS server ล่ม) เครื่องลูกข่ายทุกเครื่องตั้ง DNS เป็น 192.168.8.10 จึงแปลงชื่อเป็น IP ไม่ได้ ทั้งที่เครือข่ายส่วนอื่นปกติ',
      evidence: ['ping 8.8.8.8 ได้ แต่ ping www.netlab.test ไม่ได้ = เส้นทางปกติ ปัญหาอยู่ที่การแปลงชื่อ (DNS)',
        'ping 192.168.8.10 ได้ = เครื่อง server ยังเปิดและต่อเครือข่ายอยู่', 'nslookup ขึ้น DNS request timed out และพอร์ต 53 ของ server ไม่ตอบ = บริการ DNS ไม่ทำงาน',
        'ค่าตั้งของ SRV-DC01: บริการ DNS Server หยุดอยู่ (Stopped)'],
      fix: 'เปิด (Start) บริการ DNS Server บน SRV-DC01 แล้วทดสอบด้วย nslookup/ping ชื่อ การเปลี่ยน DNS ของทุกเครื่องเป็น 8.8.8.8 เป็นการแก้อ้อมที่ทำให้ชื่อภายใน (intranet.school.local) ใช้ไม่ได้และต้องแก้ทุกเครื่อง'
    }
  },
  {
    id: 'x11', mode: 'evidence', level: 'medium', title: 'ping ได้ แต่เปิดแชร์ไฟล์ไม่ได้',
    desc: 'ห้องบัญชีเปิดโฟลเดอร์แชร์บน FS-ACC ไม่ได้ ทั้งที่ ping ได้ปกติ หาหลักฐานและแก้ให้ปลอดภัย',
    story: 'ห้องปฏิบัติการบัญชี (192.168.12.0/24) เก็บงานนักเรียนไว้ที่แชร์ \\\\fs.acc.local\\งานบัญชี บน FS-ACC เมื่อวานช่างรันสคริปต์ "เพิ่มความปลอดภัย" ที่ตั้งกฎ Windows Firewall ใหม่ วันนี้นักเรียนทุกเครื่องเปิดแชร์ไม่ได้ ขึ้น "Windows cannot access \\\\fs.acc.local" ครูลอง ping FS-ACC แล้วได้ Reply ปกติ',
    symptoms: ['เปิด \\\\fs.acc.local\\งานบัญชี ไม่ได้: Error code 0x80070035 The network path was not found', 'ping fs.acc.local ได้ Reply ปกติ', 'เครื่องอื่น ๆ ในห้องเข้าอินเทอร์เน็ตได้'],
    hints: [COMMON_HINT, 'ping ใช้ ICMP แต่การแชร์ไฟล์ใช้ SMB (TCP พอร์ต 445) ping ผ่านจึงไม่ได้แปลว่าบริการผ่าน ใช้เครื่องมือ "ทดสอบบริการ" ตรวจพอร์ต 445',
      'ถ้า ping ได้แต่พอร์ตไม่ผ่าน ให้ดูกฎ Firewall ของเครื่องปลายทางในหน้าค่าตั้ง', 'การปิด Firewall ทั้งเครื่องทำให้ใช้ได้ก็จริง แต่ไม่ปลอดภัย ให้เปิดเฉพาะกฎที่จำเป็น'],
    build() {
      return {
        devices: [
          host('pc1', 'pc', 'ACC-01', '192.168.12.31', 24, '192.168.12.1', ['192.168.12.5'], '3C-52-82-12-00-31', { x: 80, y: 330 }),
          host('pc2', 'pc', 'ACC-02', '192.168.12.32', 24, '192.168.12.1', ['192.168.12.5'], '3C-52-82-12-00-32', { x: 200, y: 365 }),
          host('fs', 'server', 'FS-ACC', '192.168.12.10', 24, '192.168.12.1', ['192.168.12.5'], '00-15-5D-12-00-10', { x: 370, y: 370,
            services: { file: true }, firewall: { icmp: true, smb: false } }),
          host('dns', 'server', 'DNS-ACC', '192.168.12.5', 24, '192.168.12.1', ['8.8.8.8'], '52-54-00-12-00-05', { os: 'linux', x: 520, y: 340,
            services: { dns: { records: { 'ns1.acc.local': '192.168.12.5', 'fs.acc.local': '192.168.12.10' } } } }),
          sw('sw1', 'SW-ACC', 290, 220),
          { id: 'r1', type: 'router', name: 'R-ACC', x: 480, y: 110,
            ifaces: [{ name: 'g0/0', ip: '192.168.12.1', prefix: 24, up: true }, { name: 'g0/1', ip: '203.0.113.30', prefix: 30, up: true }],
            routes: [{ net: '0.0.0.0', prefix: 0, via: '203.0.113.29' }] },
          inet('203.0.113.29', 660, 110)
        ],
        links: [L('l1', 'pc1', 'eth0', 'sw1', 'p1'), L('l2', 'pc2', 'eth0', 'sw1', 'p2'), L('l3', 'fs', 'eth0', 'sw1', 'p10'),
          L('l4', 'dns', 'eth0', 'sw1', 'p5'), L('l5', 'r1', 'g0/0', 'sw1', 'p24'), L('l6', 'r1', 'g0/1', 'net', 'wan', { medium: 'fiber' })]
      };
    },
    focusHost: 'pc1', hosts: ['pc1', 'pc2', 'fs'], svcPorts: [445, 80, 53],
    checks: [{ kind: 'tcp', src: 'pc1', target: 'fs.acc.local', port: 445 }, { kind: 'tcp', src: 'pc2', target: '192.168.12.10', port: 445 }],
    keep: [{ kind: 'ping', src: 'pc1', target: '192.168.12.10' }, { kind: 'ping', src: 'pc2', target: 'www.netlab.test' },
      { kind: 'tcp', src: 'pc1', target: '192.168.12.5', port: 53 }],
    allowed: ['fs.smb'],
    faults: [
      (t) => { const d = dev(t, 'fs'); return d && TS.fwAllows(d, 445) ? null : 'กฎ Firewall ของ FS-ACC ยังบล็อก SMB (TCP 445)'; },
      (t) => { const d = dev(t, 'fs'); return d && TS.fwOn(d) ? null : 'Firewall ของ FS-ACC ถูกปิดทั้งเครื่อง (ใช้ได้แต่ไม่ปลอดภัย) ควรเปิด Firewall ไว้และอนุญาตเฉพาะ SMB'; }
    ],
    evidence: [
      { area: 'การทดสอบการเชื่อมต่อ (ping)', text: 'ping FS-ACC (ชื่อหรือ IP) ได้ แสดงว่าเครือข่ายถึงเครื่องปลายทางปกติ',
        test: log => log.some(r => r.type === 'ping' && r.host !== 'fs' && r.ok && r.resolved === '192.168.12.10') },
      { area: 'การทดสอบบริการ (พอร์ต TCP)', text: 'ทดสอบบริการพอร์ต 445 ไป FS-ACC แล้วไม่ผ่าน (TcpTestSucceeded : False) ทั้งที่ ping ผ่าน',
        test: log => log.some(r => r.type === 'svc' && r.host !== 'fs' && r.port === 445 && r.resolved === '192.168.12.10' && !r.tcp && r.l3) },
      { area: 'การตั้งค่าของเครื่องปลายทาง', text: 'ตรวจกฎ Firewall ในค่าตั้งของ FS-ACC และพบว่าบล็อก File and Printer Sharing (SMB)',
        test: log => log.some(r => r.k === 'inspect' && r.dev === 'fs') }
    ],
    explainFull: {
      cause: 'กฎ Windows Firewall บน FS-ACC บล็อกการเชื่อมต่อขาเข้าของ File and Printer Sharing (SMB, TCP 445) ส่วน ICMP ยังอนุญาตอยู่ จึง ping ได้แต่เปิดแชร์ไม่ได้ (กลับด้านกับภารกิจ x6)',
      evidence: ['ping 192.168.12.10 ได้ = สาย IP gateway ปกติ', 'Test-NetConnection -Port 445 ได้ PingSucceeded : True แต่ TcpTestSucceeded : False = พอร์ตบริการถูกกั้น',
        'กฎ Firewall ของ FS-ACC: SMB (445) ถูกบล็อก'],
      fix: 'เปิดกฎ "File and Printer Sharing (SMB-In)" บน Firewall ของ FS-ACC โดยไม่ปิด Firewall ทั้งเครื่อง แล้วทดสอบพอร์ต 445 ซ้ำจากเครื่องนักเรียน'
    }
  },
  {
    id: 'x12', mode: 'evidence', level: 'hard', title: 'ห้องคอม 2 ออกนอกวงไม่ได้หลังเปลี่ยน Router',
    desc: 'หลังเปลี่ยน Router ตัวใหม่ ห้องคอม 2 ใช้งานกันเองในห้องได้ แต่ไปที่อื่นไม่ได้เลย',
    story: 'แผนกเปลี่ยน Router หลักเป็นตัวใหม่ (R-CORE) โดยช่างพิมพ์ค่าตั้งใหม่ตามเอกสารเดิม ห้องคอม 1 (192.168.10.0/24) ใช้งานได้ปกติ แต่ห้องคอม 2 (192.168.20.0/24, gateway 192.168.20.1) ไปที่ server ห้องคอม 1 และออกอินเทอร์เน็ตไม่ได้ทุกเครื่อง ส่วนการแชร์ไฟล์ภายในห้องคอม 2 ยังใช้ได้',
    symptoms: ['LAB2-01 และ LAB2-02 ping กันเองได้', 'ห้องคอม 2 เข้า SRV-LAB (192.168.10.5) และอินเทอร์เน็ตไม่ได้', 'ห้องคอม 1 ใช้งานได้ปกติ แต่ ping เครื่องในห้องคอม 2 ไม่ได้'],
    hints: [COMMON_HINT, 'ถ้าในห้องคุยกันได้แต่ ping gateway ไม่ได้ ให้ตรวจว่า gateway ที่เครื่องตั้งไว้ มีอุปกรณ์ใดใช้ IP นั้นจริงหรือไม่',
      'แตะ R-CORE ในแผนผังแล้วดูตาราง Interfaces: IP ของ interface ที่ต่อกับห้องคอม 2 ตรงกับ gateway ของเครื่องในห้องหรือไม่'],
    build() {
      return {
        devices: [
          host('a1', 'pc', 'LAB1-01', '192.168.10.11', 24, '192.168.10.1', ['192.168.10.5'], '3C-52-82-10-00-11', { x: 60, y: 330 }),
          host('srv', 'server', 'SRV-LAB', '192.168.10.5', 24, '192.168.10.1', ['8.8.8.8'], '00-15-5D-10-00-05', { x: 200, y: 360,
            services: { dns: { records: { 'dns.lab.local': '192.168.10.5', 'srv.lab.local': '192.168.10.5' } }, web: true, file: true } }),
          sw('sw1', 'SW-LAB1', 130, 220),
          host('b1', 'pc', 'LAB2-01', '192.168.20.21', 24, '192.168.20.1', ['192.168.10.5'], '3C-52-82-20-00-21', { x: 470, y: 330 }),
          host('b2', 'pc', 'LAB2-02', '192.168.20.22', 24, '192.168.20.1', ['192.168.10.5'], '3C-52-82-20-00-22', { x: 600, y: 360 }),
          sw('sw2', 'SW-LAB2', 530, 220),
          { id: 'r1', type: 'router', name: 'R-CORE', x: 330, y: 120,
            ifaces: [{ name: 'g0/0', ip: '192.168.10.1', prefix: 24, up: true }, { name: 'g0/1', ip: '192.168.21.1', prefix: 24, up: true },
              { name: 'g0/2', ip: '203.0.113.34', prefix: 30, up: true }],
            routes: [{ net: '0.0.0.0', prefix: 0, via: '203.0.113.33' }] },
          inet('203.0.113.33', 330, 0)
        ],
        links: [L('l1', 'a1', 'eth0', 'sw1', 'p1'), L('l2', 'srv', 'eth0', 'sw1', 'p2'), L('l3', 'r1', 'g0/0', 'sw1', 'p24'),
          L('l4', 'b1', 'eth0', 'sw2', 'p1'), L('l5', 'b2', 'eth0', 'sw2', 'p2'), L('l6', 'r1', 'g0/1', 'sw2', 'p24'),
          L('l7', 'r1', 'g0/2', 'net', 'wan', { medium: 'fiber' })]
      };
    },
    focusHost: 'b1', hosts: ['b1', 'b2', 'a1'], svcPorts: [80, 445],
    checks: [{ kind: 'ping', src: 'b1', target: '192.168.10.5' }, { kind: 'ping', src: 'b2', target: 'www.netlab.test' },
      { kind: 'ping', src: 'a1', target: '192.168.20.21' }],
    keep: [{ kind: 'ping', src: 'a1', target: 'www.netlab.test' }, { kind: 'ping', src: 'b1', target: '192.168.20.22' },
      { kind: 'tcp', src: 'a1', target: 'srv.lab.local', port: 445 }],
    allowed: ['r1.if:g0/1'],
    faults: [(t) => {
      const r = dev(t, 'r1'); const f = r && Array.isArray(r.ifaces) ? r.ifaces.find(x => x && x.name === 'g0/1') : null;
      return f && sv(f.ip) === '192.168.20.1' && IP.toPrefix(f.prefix) === 24 ? null : 'IP ของ R-CORE interface g0/1 (ฝั่งห้องคอม 2) ยังไม่ตรงกับ gateway ที่ทุกเครื่องในห้องคอม 2 ใช้';
    }],
    evidence: [
      { area: 'การทดสอบไปยัง default gateway', text: 'จากเครื่องในห้องคอม 2 ping gateway 192.168.20.1 แล้วได้ Destination host unreachable (ไม่มีอุปกรณ์ใดตอบ ARP)',
        test: log => log.some(r => r.type === 'ping' && (r.host === 'b1' || r.host === 'b2') && r.resolved === '192.168.20.1' && !r.ok && /unreachable/.test(r.reason)) },
      { area: 'การทดสอบภายในวงเดียวกัน', text: 'ping เครื่องอื่นในห้องคอม 2 ได้ แสดงว่าสาย Switch และ IP ของเครื่องในห้องปกติ',
        test: log => log.some(r => r.type === 'ping' && (r.host === 'b1' || r.host === 'b2') && r.ok && IP.inSubnet(r.resolved || '', '192.168.20.0', 24) && r.responder !== r.host) },
      { area: 'การตั้งค่าของอุปกรณ์ที่อยู่ระหว่างทาง', text: 'ตรวจตาราง Interfaces ของ R-CORE แล้วพบว่า g0/1 เป็น 192.168.21.1 ไม่ใช่ 192.168.20.1',
        test: log => log.some(r => r.k === 'inspect' && r.dev === 'r1') }
    ],
    explainFull: {
      cause: 'Interface g0/1 ของ R-CORE (ฝั่งห้องคอม 2) ถูกพิมพ์ IP ผิดเป็น 192.168.21.1/24 Router จึงไม่ได้อยู่ในวง 192.168.20.0/24 ไม่มีใครตอบ ARP ของ gateway 192.168.20.1 และ Router ก็ไม่มีเส้นทางต่อตรงกลับมาที่ห้องคอม 2',
      evidence: ['ping กันเองในห้องคอม 2 ได้ = Layer 1-2 ในห้องปกติ', 'ping 192.168.20.1 ได้ Destination host unreachable จาก IP ของตัวเอง = ไม่มีอุปกรณ์ใช้ IP gateway นี้',
        'ตาราง Interfaces ของ R-CORE: g0/1 = 192.168.21.1/24 และ Routing table ไม่มีวง 192.168.20.0/24'],
      fix: 'แก้ IP ของ R-CORE g0/1 เป็น 192.168.20.1/24 ให้ตรงกับ gateway ที่ทุกเครื่องในห้องคอม 2 ใช้ (แก้จุดเดียวที่ Router ไม่ต้องแก้ทุกเครื่อง)'
    }
  },
  {
    id: 'x13', mode: 'evidence', level: 'hard', title: 'ใช้งานได้กับบางเครื่องเท่านั้น',
    desc: 'LIB-07 ติดต่อเครื่องพิมพ์ได้ แต่เข้า server ห้องสมุดและอินเทอร์เน็ตไม่ได้ หาสาเหตุจากหลักฐาน',
    story: 'ห้องสมุด (192.168.30.0/24) นักเรียนฝึกงานตั้ง IP แบบ Static ให้ LIB-07 เอง ตอนนี้ LIB-07 สั่งพิมพ์ไปที่ PRN-LIB ได้ และเปิดแชร์ของเครื่องบางเครื่องได้ แต่เข้าระบบสืบค้น opac.lib.local และอินเทอร์เน็ตไม่ได้ ส่วน LIB-08 ข้าง ๆ ใช้งานได้ทุกอย่าง',
    symptoms: ['LIB-07 พิมพ์งานไป PRN-LIB (192.168.30.210) ได้', 'LIB-07 เปิด opac.lib.local และเว็บภายนอกไม่ได้', 'LIB-08 ใช้งานได้ปกติทุกอย่าง'],
    hints: [COMMON_HINT, 'จดว่าปลายทางไหน ping ได้และไม่ได้ แล้วดูว่าปลายทางที่ได้มี IP อยู่ช่วงไหน', 'เปรียบเทียบ Subnet mask ของ LIB-07 กับ LIB-08 และลองคำนวณช่วง IP ของวงจาก mask นั้น',
      'Windows ขึ้น "PING: transmit failed. General failure." เมื่อเครื่องต้องส่งผ่าน gateway แต่ gateway ไม่อยู่ในวงเดียวกับตัวเอง'],
    build() {
      return {
        devices: [
          host('p7', 'pc', 'LIB-07', '192.168.30.200', 25, '192.168.30.1', ['192.168.30.10'], '3C-52-82-30-00-07', { x: 70, y: 330 }),
          host('p8', 'pc', 'LIB-08', '192.168.30.201', 24, '192.168.30.1', ['192.168.30.10'], '3C-52-82-30-00-08', { x: 190, y: 365 }),
          host('p2', 'pc', 'LIB-02', '192.168.30.150', 24, '192.168.30.1', ['192.168.30.10'], '3C-52-82-30-00-02', { x: 310, y: 375, services: { file: true } }),
          host('prn', 'printer', 'PRN-LIB', '192.168.30.210', 24, '192.168.30.1', [], '00-80-77-30-02-10', { x: 430, y: 365 }),
          host('srv', 'server', 'SRV-LIB', '192.168.30.10', 24, '192.168.30.1', ['8.8.8.8'], '00-15-5D-30-00-10', { x: 550, y: 330,
            services: { dns: { records: { 'dns.lib.local': '192.168.30.10', 'opac.lib.local': '192.168.30.10' } }, web: true } }),
          sw('sw1', 'SW-LIB', 300, 220),
          { id: 'r1', type: 'router', name: 'R-LIB', x: 480, y: 110,
            ifaces: [{ name: 'g0/0', ip: '192.168.30.1', prefix: 24, up: true }, { name: 'g0/1', ip: '203.0.113.38', prefix: 30, up: true }],
            routes: [{ net: '0.0.0.0', prefix: 0, via: '203.0.113.37' }] },
          inet('203.0.113.37', 660, 110)
        ],
        links: [L('l1', 'p7', 'eth0', 'sw1', 'p7'), L('l2', 'p8', 'eth0', 'sw1', 'p8'), L('l3', 'p2', 'eth0', 'sw1', 'p2'),
          L('l4', 'prn', 'eth0', 'sw1', 'p20'), L('l5', 'srv', 'eth0', 'sw1', 'p10'), L('l6', 'r1', 'g0/0', 'sw1', 'p24'),
          L('l7', 'r1', 'g0/1', 'net', 'wan', { medium: 'fiber' })]
      };
    },
    focusHost: 'p7', hosts: ['p7', 'p8'], svcPorts: [80, 9100, 445],
    checks: [{ kind: 'ping', src: 'p7', target: '192.168.30.10' }, { kind: 'ping', src: 'p7', target: 'www.netlab.test' },
      { kind: 'tcp', src: 'p7', target: 'opac.lib.local', port: 80 }],
    keep: [{ kind: 'tcp', src: 'p7', target: '192.168.30.210', port: 9100 }, { kind: 'ping', src: 'p8', target: 'www.netlab.test' },
      { kind: 'tcp', src: 'p8', target: '192.168.30.150', port: 445 }],
    allowed: ['p7.prefix'],
    faults: [(t) => { const d = dev(t, 'p7'); return d && d.ifaces[0] && IP.toPrefix(d.ifaces[0].prefix) === 24 ? null : 'Subnet mask ของ LIB-07 ยังไม่ตรงกับวงของห้องสมุด (ดู mask ของ LIB-08 หรือ R-LIB)'; }],
    evidence: [
      { area: 'การทดสอบปลายทางที่ยังติดต่อได้', text: 'จาก LIB-07 ping บางปลายทางได้ (เช่น 192.168.30.210 หรือ .201) แสดงว่าสายและการ์ดแลนปกติ',
        test: log => log.some(r => r.type === 'ping' && r.host === 'p7' && r.ok && r.responder && r.responder !== 'p7') },
      { area: 'การทดสอบปลายทางที่ติดต่อไม่ได้', text: 'จาก LIB-07 ping gateway, server หรือ IP ภายนอกแล้วขึ้น General failure (ส่งผ่าน gateway ไม่ได้)',
        test: log => log.some(r => r.type === 'ping' && r.host === 'p7' && !r.ok && r.reason === 'no_gateway') },
      { area: 'การเปรียบเทียบการตั้งค่า IP กับเครื่องที่ใช้งานได้', text: 'เปรียบเทียบ Subnet mask ของ LIB-07 (255.255.255.128) กับเครื่องที่ใช้งานได้ (255.255.255.0)',
        test: log => log.some(r => (r.k === 'inspect' && r.dev === 'p7') || (r.type === 'ipconfig' && r.host === 'p7')) &&
          log.some(r => (r.k === 'inspect' && ['p8', 'p2', 'srv', 'r1', 'prn'].includes(r.dev)) || (r.type === 'ipconfig' && r.host === 'p8')) }
    ],
    explainFull: {
      cause: 'LIB-07 ตั้ง Subnet mask เป็น 255.255.255.128 (/25) ทำให้เครื่องเข้าใจว่าวงของตัวเองคือ 192.168.30.128–255 เท่านั้น ปลายทางในช่วงนี้ (เครื่องพิมพ์ .210, LIB-02 .150) จึงติดต่อได้ตรง แต่ gateway 192.168.30.1 และ server 192.168.30.10 อยู่นอกวง /25 จึงออกนอกวงไม่ได้เลย',
      evidence: ['ping 192.168.30.210 ได้ แต่ ping 192.168.30.10 / 192.168.30.1 / 8.8.8.8 ขึ้น General failure', 'ipconfig ของ LIB-07 แสดง Subnet Mask 255.255.255.128 ขณะที่ LIB-08 เป็น 255.255.255.0',
        'Default gateway 192.168.30.1 ไม่อยู่ในช่วง 192.168.30.128/25 ของ LIB-07'],
      fix: 'แก้ Subnet mask ของ LIB-07 เป็น 255.255.255.0 (/24) ให้ตรงกับวงจริง การย้าย IP ไปครึ่งล่าง (เช่น .100/25) ทำให้ ping ผ่านได้แต่เป็นการแก้อ้อม mask ยังผิดอยู่'
    }
  },
  {
    // 3.1: week 1 step 4. Uses only week 1 ideas (Star topology, status lights at the port, Client-Server); no commands needed
    id: 'x15', level: 'easy', basic: true, title: 'PC3 ใช้เครือข่ายไม่ได้หลังย้ายโต๊ะ',
    desc: 'หาว่าทำไม PC3 เครื่องเดียวเปิดไฟล์จาก FileServer ไม่ได้ แก้ไข แล้วทดสอบ',
    story: 'ห้องธุรการต่อเครือข่ายแบบดาว (Star): PC1 ถึง PC4 และ FileServer (เครื่องแม่ข่าย) ต่อสายเข้า SW-OFFICE คนละเส้น เมื่อวานภารโรงย้ายโต๊ะของ PC3 วันนี้ PC3 เปิดโฟลเดอร์งานบน FileServer ไม่ได้เลย ส่วนเครื่องอื่นใช้ได้ปกติ',
    symptoms: ['PC3 เปิดโฟลเดอร์งานบน FileServer ไม่ได้', 'PC1, PC2 และ PC4 เปิดไฟล์บน FileServer ได้ปกติ', 'FileServer เปิดเครื่องอยู่'],
    hints: [
      'เทียบก่อนว่าเสียเครื่องเดียวหรือทุกเครื่อง: แบบดาว (Star) สายเส้นหนึ่งเสียกระทบแค่เครื่องเดียว แต่ถ้า Switch ซึ่งเป็นอุปกรณ์ศูนย์กลางเสีย ทุกเครื่องจะใช้ไม่ได้',
      'แตะ SW-OFFICE และ PC3 ในแผนผังแล้วดูสถานะสายของแต่ละพอร์ต พอร์ตที่มีสัญญาณไฟจะติด พอร์ตที่ไม่มีสัญญาณไฟจะดับ',
      'ตรวจสายทั้งสองปลาย คือปลายที่ PC และปลายที่ Switch แล้วเสียบให้แน่น'],
    build() { const t = office1(); lnk(t, 'l3').up = false; return t; },
    focusHost: 'pc3', hosts: ['pc3', 'pc2'],
    successPings: [['pc3', '192.168.1.5']],
    causes: [
      ['cable', 'สาย LAN ของ PC3 หลุดหรือไม่ได้เสียบ (สื่อนำข้อมูลของ PC3 ขาด)'],
      ['switch', 'Switch ซึ่งเป็นอุปกรณ์ศูนย์กลางเสีย'],
      ['server', 'FileServer (เครื่องแม่ข่าย) ปิดเครื่องอยู่'],
      ['pc4', 'สายของ PC4 ที่นั่งติดกันหลุด จึงทำให้ PC3 ใช้ไม่ได้ไปด้วย'],
      ['bus', 'ห้องนี้ต่อแบบบัส (Bus) และสายหลัก (Backbone) ขาด'],
      ['protocol', 'PC3 ใช้โปรโตคอลคนละชุดกับเครื่องอื่น']],
    cause: 'cable',
    allowed: ['link.l3.up'],
    faults: [(t) => lnk(t, 'l3') && lnk(t, 'l3').up !== false ? null : 'สายของ PC3 ยังไม่ได้เสียบ (พอร์ตยังไม่มีสัญญาณ)'],
    explain: 'ไฟสถานะที่พอร์ตการ์ดเครือข่ายของ PC3 และพอร์ตที่ต่อกับ PC3 บน Switch ดับ ขณะที่เครื่องอื่นใช้งานได้ แปลว่าสื่อนำข้อมูลของ PC3 เส้นเดียวขาด ข้อมูลจึงไปไม่ถึงผู้รับ ในแบบดาว (Star) สายเส้นหนึ่งเสียกระทบเพียงเครื่องเดียว จึงไม่ใช่ Switch หรือ FileServer ที่ถ้าเสียทุกเครื่องจะใช้ไม่ได้ ควรตรวจสายและไฟสถานะก่อนเสมอ'
  }
];

// ------------------------------------------------------------------ field extraction (normalised editable values)
const sv = v => (typeof v === 'string' || typeof v === 'number') ? String(v).trim().slice(0, LIM.str) : '';
const isObj = x => !!x && typeof x === 'object' && !Array.isArray(x);
const isHostType = t => ['pc', 'laptop', 'server', 'printer'].includes(String(t));
function hostFields(d, gen) {
  const f = Array.isArray(d.ifaces) && isObj(d.ifaces[0]) ? d.ifaces[0] : {};
  let dns = d.dns; if (typeof dns === 'string') dns = dns.split(/[\s,;]+/);
  const pf = IP.toPrefix(f.prefix !== undefined && f.prefix !== '' && f.prefix !== null ? f.prefix : f.mask);
  return {
    ip: sv(f.ip), prefix: pf === null ? sv(f.prefix) : String(pf), gateway: sv(d.gateway),
    dns: (Array.isArray(dns) ? dns : []).map(sv).filter(Boolean).join(','),
    dhcp: String(d.dhcp === true || d.dhcp === 'true'), up: String(!(f.up === false || f.up === 'false')),
    ssid: sv(d.ssid), icmp: String(!(isObj(d.firewall) && (d.firewall.icmp === false || d.firewall.icmp === 'false'))),
    fw: String(TS.fwOn(d)), smb: String(!(isObj(d.firewall) && (d.firewall.smb === false || d.firewall.smb === 'false'))),
    dnsSvc: isObj(d.services) && isObj(d.services.dns) ? String(!(d.services.dns.enabled === false || d.services.dns.enabled === 'false')) : '',
    // x14 only: HTTP firewall rule and the DHCP Server service
    ...(gen ? {
      fwweb: String(!(isObj(d.firewall) && (d.firewall.web === false || d.firewall.web === 'false'))),
      dhcpSvc: isObj(d.services) && isObj(d.services.dhcp) ? String(!(d.services.dhcp.enabled === false || d.services.dhcp.enabled === 'false')) : ''
    } : {})
  };
}
function routerFields(d) {
  const rs = Array.isArray(d.routes) ? d.routes.filter(isObj) : [];
  const o = { routes: rs.map(r => `${sv(r.net)}/${IP.toPrefix(r.prefix) === null ? sv(r.prefix) : IP.toPrefix(r.prefix)}>${sv(r.via)}|${sv(r.iface)}`).sort().join(';') };
  (Array.isArray(d.ifaces) ? d.ifaces : []).forEach(f => {
    if (!isObj(f) || typeof f.name !== 'string') return;
    const p = IP.toPrefix(f.prefix !== undefined && f.prefix !== '' && f.prefix !== null ? f.prefix : f.mask);
    o['if:' + f.name.slice(0, 10)] = `${sv(f.ip)}/${p === null ? sv(f.prefix) : p}`;
  });
  return o;
}
// everything else must stay identical (positions ignored)
function frozen(d, gen) {
  const c = clone(d);
  delete c.x; delete c.y;
  if (isHostType(c.type)) {
    if (Array.isArray(c.ifaces) && isObj(c.ifaces[0])) { delete c.ifaces[0].ip; delete c.ifaces[0].prefix; delete c.ifaces[0].mask; delete c.ifaces[0].up; }
    delete c.gateway; delete c.dns; delete c.dhcp; delete c.ssid;
    if (isObj(c.firewall)) { delete c.firewall.icmp; delete c.firewall.smb; delete c.firewall.enabled; if (gen) delete c.firewall.web; if (!Object.keys(c.firewall).length) delete c.firewall; }
    if (isObj(c.services) && isObj(c.services.dns)) delete c.services.dns.enabled;
    if (gen && isObj(c.services) && isObj(c.services.dhcp)) delete c.services.dhcp.enabled;
  }
  if (c.type === 'router') {
    delete c.routes;
    if (Array.isArray(c.ifaces)) c.ifaces.forEach(f => { if (isObj(f)) { delete f.ip; delete f.prefix; delete f.mask; } });
  }
  return stable(c);
}
function stable(x) {
  if (Array.isArray(x)) return '[' + x.map(stable).join(',') + ']';
  if (isObj(x)) return '{' + Object.keys(x).sort().filter(k => x[k] !== undefined).map(k => JSON.stringify(k) + ':' + stable(x[k])).join(',') + '}';
  return JSON.stringify(x === undefined ? null : x);
}
const FIELD_TH = { ip: 'IP address', prefix: 'Subnet mask', gateway: 'Default gateway', dns: 'DNS server', dhcp: 'DHCP', up: 'การเปิด/ปิด Network adapter',
  ssid: 'SSID Wi-Fi', icmp: 'Firewall (ICMP)', routes: 'Static route', fw: 'การเปิด/ปิด Firewall ทั้งเครื่อง', smb: 'Firewall (SMB 445)', dnsSvc: 'บริการ DNS Server',
  fwweb: 'Firewall (HTTP 80/443)', dhcpSvc: 'บริการ DHCP Server' };

// compare submitted topo with the mission topo -> { ok, changed:[keys], structural:[msgs] }
function diffTopo(base, sub, gen) {
  const structural = [];
  const changed = [];
  const vals = {};
  const names = {};
  base.devices.forEach(d => { names[d.id] = d.name; });
  const subDevs = new Map();
  for (const d of sub.devices) {
    if (!isObj(d) || typeof d.id !== 'string') { structural.push('ข้อมูลอุปกรณ์บางรายการไม่ถูกต้อง'); return { changed, structural, names, vals }; }
    if (subDevs.has(d.id)) { structural.push(`มีอุปกรณ์ id ซ้ำ (${d.id})`); return { changed, structural, names, vals }; }
    subDevs.set(d.id, d);
  }
  if (subDevs.size !== base.devices.length || base.devices.some(d => !subDevs.has(d.id))) structural.push('มีการเพิ่มหรือลบอุปกรณ์ (โจทย์ให้แก้การตั้งค่าเท่านั้น)');
  base.devices.forEach(b => {
    const d = subDevs.get(b.id); if (!d) return;
    if (frozen(d, gen) !== frozen(b, gen)) { structural.push(`${b.name}: มีการเปลี่ยนค่าที่ไม่ใช่การตั้งค่าที่แก้ได้ (เช่น ชนิดอุปกรณ์ MAC หรือบริการ)`); return; }
    const fa = isHostType(b.type) ? hostFields(b, gen) : b.type === 'router' ? routerFields(b) : {};
    const fb = isHostType(b.type) ? hostFields(d, gen) : b.type === 'router' ? routerFields(d) : {};
    Object.keys(fa).forEach(k => { if (fa[k] !== fb[k]) { changed.push(b.id + '.' + k); vals[b.id + '.' + k] = [fa[k], fb[k]]; } });
  });
  const subLinks = new Map();
  for (const l of sub.links) {
    if (!isObj(l) || typeof l.id !== 'string' || subLinks.has(l.id)) { structural.push('ข้อมูลสายสัญญาณไม่ถูกต้อง'); return { changed, structural, names, vals }; }
    subLinks.set(l.id, l);
  }
  if (subLinks.size !== base.links.length || base.links.some(l => !subLinks.has(l.id))) structural.push('มีการเพิ่มหรือลบสายสัญญาณ (โจทย์ให้เสียบ/ถอดสายเดิมเท่านั้น)');
  base.links.forEach(b => {
    const l = subLinks.get(b.id); if (!l) return;
    const fx = x => { const c = clone(x); delete c.up; return stable(c); };
    if (fx(l) !== fx(b)) { structural.push(`สาย ${b.id}: ปลายสายหรือชนิดสายถูกเปลี่ยน`); return; }
    const ua = !(b.up === false || b.up === 'false'), ub = !(l.up === false || l.up === 'false');
    if (ua !== ub) { changed.push('link.' + b.id + '.up'); vals['link.' + b.id + '.up'] = [String(ua), String(ub)]; }
  });
  return { changed, structural, names, vals };
}
function describeKey(k, names) {
  if (k.startsWith('link.')) return `สาย ${k.split('.')[1]} (เสียบ/ถอดสาย)`;
  const j = k.indexOf('.if:');
  if (j > 0) return `IP/Subnet mask ของ interface ${k.slice(j + 4)} บน ${names[k.slice(0, j)] || k.slice(0, j)}`;
  const i = k.lastIndexOf('.'); const id = k.slice(0, i), f = k.slice(i + 1);
  return `${FIELD_TH[f] || f} ของ ${names[id] || id}`;
}
// changes that switch something off / remove something: they cost an extra point when they were not needed
function destructive(k, v) {
  if (!v) return false;
  const [a, b] = v, f = k.slice(k.lastIndexOf('.') + 1);
  if (k.startsWith('link.') || f === 'up' || f === 'fw' || f === 'dnsSvc' || f === 'icmp' || f === 'smb' || f === 'fwweb' || f === 'dhcpSvc') return a === 'true' && b === 'false';
  if (f === 'routes') { const B = new Set(String(b).split(';').filter(Boolean)); return String(a).split(';').filter(Boolean).some(x => !B.has(x)); }
  if (f === 'dns' || f === 'gateway' || f === 'ip') return !!a && !b;
  return false;
}

// ------------------------------------------------------------------ build missions
const PRIVATE = {};
/* Fault feedback must not hand out the answer (Phase 6 leak fix). A fault's specific message (which names the faulty
 * device/setting) is shown only when the student already changed a field of that fault; otherwise a generic hint. */
const FAULT_KEYS = { x1: [['link.l1.up']], x2: [['nb4.ssid']], x3: [['pc21.gateway']], x4: [['t05.prefix']], x5: [['pc15.dns']], x6: [['srv.icmp']], x7: [['dhcp.up', 'link.l4.up'], ['pc1.dhcp', 'pc2.dhcp', 'pc3.dhcp']], x8: [['pc12.ip'], ['r1.routes']], x9: [['pc9.ip']], x10: [['srv.dnsSvc']], x11: [['fs.smb'], ['fs.fw']], x12: [['r1.if:g0/1']], x13: [['p7.prefix']], x15: [['link.l3.up']] };
const GENERIC_FAULT = 'ยังมีต้นเหตุที่ยังไม่ได้แก้ให้ถูกต้อง — ย้อนดูว่าการทดสอบขั้นใดเริ่มล้มเหลว แล้วตรวจค่าตั้งของอุปกรณ์ในเส้นทางนั้น';
function faultMsgs(sc, fres, changed) {
  const keys = FAULT_KEYS[sc.id] || [];
  const out = []; let generic = 0;
  fres.forEach((m, i) => { if (!m) return; if ((keys[i] || []).some(k => changed.includes(k))) out.push(m); else generic++; });
  if (generic) out.push(generic > 1 ? GENERIC_FAULT + ` (${generic} จุด)` : GENERIC_FAULT);
  return out;
}
const checkText = (c, names) => c.kind === 'tcp'
  ? `ทดสอบบริการ ${TS.SVC[c.port] ? TS.SVC[c.port].name : ''} (TCP ${c.port}) จาก ${names[c.src] || c.src} ไป ${c.target}`
  : `ping จาก ${names[c.src] || c.src} ไป ${c.target}`;
const missions = SCENARIOS.map(sc => {
  const topo = sc.build();
  if (sc.fault) sc.fault(topo);
  sc.topo = topo;
  PRIVATE[sc.id] = sc;
  if (sc.mode === 'evidence') {
    return {
      id: sc.id, title: sc.title, level: sc.level, desc: sc.desc, max: MAX, hints: sc.hints.slice(),
      start: {
        mode: 'evidence', story: sc.story, symptoms: sc.symptoms.slice(), topo: clone(topo),
        focusHost: sc.focusHost, hosts: sc.hosts.slice(), checks: sc.checks.map(c => Object.assign({}, c)), svcPorts: sc.svcPorts.slice()
      }
    };
  }
  return {
    id: sc.id, title: sc.title, level: sc.level, desc: sc.desc, max: MAX, hints: sc.hints.slice(),
    start: {
      story: sc.story, symptoms: sc.symptoms.slice(), topo: clone(topo),
      causes: sc.causes.map(([id, text]) => ({ id, text })),
      focusHost: sc.focusHost, hosts: sc.hosts.slice(), successPings: sc.successPings.map(p => p.slice()),
      basic: !!sc.basic
    }
  };
});

function runPings(net, list) {
  return list.map(([src, dst]) => { const r = net.ping(src, dst, { count: 1 }); return { src, dst, ok: r.ok, reason: r.reason, reasonText: r.reasonText }; });
}

// ------------------------------------------------------------------ grade
const r2 = x => Math.round(x * 100) / 100;
// ------------------------------------------------------------------ evidence missions
const E = { SOLVE: 4, ROOT: 2, EVID: 3, VERIFY: 1, REGRESS: 2, EXTRA: 1, DESTROY: 1, DEDUCT_CAP: 4, ACTIONS: 300 };
function topoProblem(t) {
  if (!isObj(t) || !Array.isArray(t.devices) || !Array.isArray(t.links)) return 'ไม่พบผลการแก้ไขเครือข่าย (topo) — แก้ไขการตั้งค่าแล้วกดส่งงานอีกครั้ง';
  if (t.devices.length > LIM.devices || t.links.length > LIM.links) return 'ข้อมูลเครือข่ายมีขนาดใหญ่เกินกำหนด';
  for (const d of t.devices) {
    if (isObj(d) && Array.isArray(d.routes) && d.routes.length > LIM.routes) return 'Static route มากเกินกำหนด';
    if (isObj(d) && Array.isArray(d.dns) && d.dns.length > LIM.dns) return 'DNS server มากเกินกำหนด (ไม่เกิน 4)';
  }
  return null;
}
function cleanActions(a) {
  if (!Array.isArray(a)) return [];
  return a.slice(0, E.ACTIONS).filter(isObj).map(x => ({
    k: sv(x.k).slice(0, 8), host: sv(x.host).slice(0, 20), dev: sv(x.dev).slice(0, 20), cmd: typeof x.cmd === 'string' ? x.cmd.slice(0, 200) : '',
    target: sv(x.target).slice(0, 80), port: Math.floor(+x.port) || 0, ph: x.ph === 'a' ? 'a' : 'b'
  }));
}
const sameTarget = (a, b) => String(a || '').trim().toLowerCase().replace(/\.$/, '') === String(b || '').trim().toLowerCase().replace(/\.$/, '');
function gradeEvidence(sc, p) {
  const feedback = [];
  const names = {}; sc.topo.devices.forEach(d => { names[d.id] = d.name; });
  const details = { mode: 'evidence', solved: 0, root: 0, evidence: [], verified: false, regressions: [], outOfScope: [], destructive: [], checks: [], explain: null };
  const actions = cleanActions(p.actions);
  // ---- evidence: 'b' actions replayed on the ORIGINAL faulty network
  const before = TS.replay(NetSim, sc.topo, actions.filter(x => x.ph === 'b'), { hosts: sc.hosts });
  let evPts = 0;
  sc.evidence.forEach(ev => {
    let got = false; try { got = !!ev.test(before); } catch (e) { got = false; }
    // the text of an evidence item is returned only once the student has earned it; a missing one shows its area only
    details.evidence.push(got ? { text: ev.text, area: ev.area, got } : { area: ev.area, got });
    if (got) evPts += E.EVID / sc.evidence.length;
  });
  const t = p.topo;
  const tp = topoProblem(t);
  const finish = (score, extra) => {
    const nEv = details.evidence.filter(x => x.got).length;
    feedback.push(nEv ? `หลักฐานการวินิจฉัยก่อนแก้ไข ${nEv}/${sc.evidence.length} รายการ (+${r2(evPts)})` : 'ไม่พบหลักฐานการวินิจฉัยก่อนแก้ไข (ควรทดสอบด้วยคำสั่งและตรวจค่าตั้งก่อนแก้)');
    details.evidence.forEach(x => feedback.push(x.got ? 'หลักฐาน ✓ ' + x.text : 'ยังขาดหลักฐานด้าน' + x.area));
    if (extra) extra.forEach(m => feedback.push(m));
    const s = Math.max(0, Math.min(MAX, r2(score)));
    return { score: s, max: MAX, ok: s === MAX, feedback, details };
  };
  if (tp) { feedback.push(tp); return finish(evPts); }
  const diff = diffTopo(sc.topo, t);
  if (diff.structural.length) {
    diff.structural.slice(0, 4).forEach(m => feedback.push('แก้ไขเกินขอบเขต: ' + m));
    details.outOfScope = diff.structural.slice(0, 10);
    return finish(evPts);
  }
  if (!diff.changed.length) {
    feedback.push(`ยังไม่ได้แก้ไขเครือข่าย (ส่วนการแก้ปัญหาได้ 0/${E.SOLVE + E.ROOT + E.VERIFY})`);
    return finish(evPts);
  }
  // ---- the submitted network
  const net = NetSim.create(TS.effTopo(t));
  const res = sc.checks.map(c => Object.assign({ c }, TS.runCheck(NetSim, t, c, net)));
  details.checks = res.map(x => ({ text: checkText(x.c, names), ok: x.ok }));
  const passed = res.filter(x => x.ok).length;
  const solvePts = E.SOLVE * passed / res.length;
  details.solved = r2(solvePts);
  res.forEach(x => feedback.push(x.ok ? `${checkText(x.c, names)}: ผ่าน ✓` : `${checkText(x.c, names)}: ยังไม่ผ่าน — ${x.c.kind === 'tcp' ? TS.TCP_WHY[x.why] || x.why : (x.reasonText || x.reason)}`));
  const fres = sc.faults.map(f => { try { return f(t, net); } catch (e) { return 'ตรวจสอบการแก้ไขไม่ได้'; } });
  const fixedN = fres.filter(m => !m).length;
  const rootPts = E.ROOT * fixedN / fres.length;
  details.root = r2(rootPts);
  faultMsgs(sc, fres, diff.changed).forEach(m => feedback.push('ต้นเหตุยังไม่ได้รับการแก้ไขอย่างถูกต้อง: ' + m));
  if (passed === res.length && fixedN < fres.length) feedback.push('ทดสอบผ่านแล้วแต่เป็นการแก้แบบอ้อม (workaround) ไม่ได้แก้ที่ต้นเหตุ');
  // ---- regressions: what worked in the original network must still work
  sc.keep.forEach(c => {
    const r = TS.runCheck(NetSim, t, c, net);
    if (!r.ok) details.regressions.push(checkText(c, names));
  });
  // ---- changes outside the fault / destructive changes
  const extra = diff.changed.filter(k => !sc.allowed.includes(k));
  details.outOfScope = extra;
  details.destructive = diff.changed.filter(k => destructive(k, diff.vals[k]));
  let deduct = 0;
  details.regressions.forEach(x => { deduct += E.REGRESS; feedback.push(`ทำให้ส่วนที่เคยใช้งานได้เสีย (-${E.REGRESS}): ${x} ใช้ไม่ได้แล้ว`); });
  let side = 0;
  extra.forEach(k => { side += E.EXTRA + (details.destructive.includes(k) ? E.DESTROY : 0); });
  details.destructive.filter(k => sc.allowed.includes(k)).forEach(() => { side += E.DESTROY; });
  side = Math.min(side, E.DEDUCT_CAP);
  if (extra.length) feedback.push(`แก้ไขเกินจำเป็น: ${extra.map(k => describeKey(k, diff.names)).join(', ')} — ค่าเหล่านี้ไม่ใช่ต้นเหตุ`);
  if (details.destructive.length) feedback.push(`การเปลี่ยนแปลงที่ปิด/ถอด/ลบของเดิม: ${details.destructive.map(k => describeKey(k, diff.names)).join(', ')} — ควรหลีกเลี่ยงถ้าไม่จำเป็น`);
  if (side) feedback.push(`หักคะแนนการแก้ไขเกินจำเป็น -${side}`);
  deduct += side;
  // ---- verification: 'a' actions replayed on the submitted network
  const after = TS.replay(NetSim, t, actions.filter(x => x.ph === 'a'), { hosts: sc.hosts });
  const allOk = passed === res.length;
  details.verified = after.some(r => (r.k === 'test' && allOk) ||
    (r.ok === true && r.type === 'ping' && sc.checks.some(c => c.kind === 'ping' && c.src === r.host && sameTarget(c.target, r.target))) ||
    (r.type === 'svc' && r.tcp && sc.checks.some(c => c.kind === 'tcp' && c.src === r.host && c.port === r.port && sameTarget(c.target, r.target))));
  const verPts = details.verified ? E.VERIFY : 0;
  const tail = [];
  // explanation (x14 pattern): only once every fault is repaired at its root and every check passes; the list of
  // evidence that points at the cause only when the student has also collected all of it (it would give away the
  // missing evidence items otherwise)
  if (allOk && fixedN === fres.length) {
    const allEv = details.evidence.every(x => x.got);
    details.explain = { cause: sc.explainFull.cause, evidence: allEv ? sc.explainFull.evidence.slice() : [], fix: sc.explainFull.fix };
  }
  if (allOk && fixedN === fres.length && !details.regressions.length) tail.push(`แก้ปัญหาได้ถูกต้องที่ต้นเหตุ ✓ (+${E.SOLVE + E.ROOT})`);
  tail.push(details.verified ? `ทดสอบยืนยันผลหลังแก้ไข ✓ (+${E.VERIFY})` : 'ยังไม่ได้ทดสอบยืนยันหลังแก้ไข (ใช้ ping/ทดสอบบริการ หรือปุ่มทดสอบ หลังบันทึกการแก้ไข)');
  if (evPts === 0 && allOk) tail.push('แก้ได้แต่ไม่มีหลักฐานว่าวินิจฉัยอย่างไร จึงได้คะแนนบางส่วน — ช่างที่ดีต้องอธิบายได้ว่ารู้ได้อย่างไรว่าเสียที่จุดนั้น');
  return finish(solvePts + rootPts + verPts + evPts - deduct, tail);
}

// ================================================================== x14: random faults (generated, rubric-reviewed)
/*
 * x14 "สุ่มเหตุขัดข้อง" (week 17). generate('x14', rand) picks a public NONCE from rand and returns only public data:
 *   { v, n: nonce, title, story, symptoms, topo (faulty state), focusHost, hosts, checks, svcPorts }.
 * The scenario (template, parameters, injected faults) is derived from HMAC-SHA256(KEY, nonce), where KEY comes from
 * the server secret (APP_SECRET, same derivation as server/sims-api.js). The problem, and therefore the signed token
 * (whose body is readable base64url JSON), contain the nonce but never the faults; without the secret the nonce
 * cannot be turned into the fault list. grade() re-derives the whole scenario from the nonce, checks that the signed
 * topology is exactly the derived one, and grades against the derived faults.
 *
 * Payload: { topo, actions (same format as x9-x13), report: string (<= 6000), rpt: { symptom, evidence, cause, fix, verify,
 *            causes: [{ cat, dev }] } }.  Score (max 20, rubric items sum to the score):
 *   solve 5  checks that failed in the faulty network pass now      root 4  every injected fault repaired at its root
 *   evidence 4  before-change actions whose result differs when the fault alone is repaired (symptom) + locating the
 *               faulty device (inspect / ipconfig / arp result that changes with the fault), 2 items per fault
 *   verify 1  report 2 (5 fields filled)  rca 4 (root-cause category 3 + device 1 per fault, halved for faults not fixed;
 *   -1 per wrong extra cause)   deductions: -2 per regression, -1 per change outside the faults (+1 if destructive), cap 4.
 * Answers (fault descriptions, evidence texts, explanation) are only returned once every fault is repaired at its root.
 */
const crypto = require('crypto');
const X14 = 'x14', GMAX = 20;
const G = { SOLVE: 5, ROOT: 4, EVID: 4, VERIFY: 1, REPORT: 2, RCA: 4, REGRESS: 2, EXTRA: 1, DESTROY: 1, DEDUCT_CAP: 4 };
const CATS = [
  ['physical', 'สายสัญญาณ / การ์ดแลน (Physical: สายหลุด พอร์ตไม่มีสัญญาณ หรือ Network adapter ถูกปิด)'],
  ['ip', 'การตั้งค่า IP address / Subnet mask (รวมถึง IP ซ้ำ)'],
  ['gateway', 'Default gateway ของเครื่องตั้งค่าผิด'],
  ['dns', 'DNS (ตั้ง DNS server ผิด หรือบริการ DNS Server หยุด)'],
  ['dhcp', 'DHCP Server ไม่แจก IP'],
  ['firewall', 'Firewall บล็อกบริการ'],
  ['router', 'Router (Routing table หรือ IP ของ interface ผิด)']
];
function serverKey() {
  const s = process.env.APP_SECRET ||
    crypto.createHash('sha256').update('netlab:' + (process.env.DATABASE_URL || '') + ':' + (process.env.ADMIN_PASSWORD || '')).digest('hex');
  return crypto.createHmac('sha256', s).update('troubleshoot/x14/fault-seed/v1').digest();
}
function mkRand(seed) {
  let c = 0;
  const f = () => crypto.createHash('sha256').update(seed + ':' + (c++)).digest().readUInt32BE(0) / 4294967296;
  const R = {
    f, int: (a, b) => a + Math.floor(f() * (b - a + 1)), pick: arr => arr[Math.floor(f() * arr.length)],
    shuffle: arr => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(f() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  };
  R.distinct = (n, a, b) => R.shuffle(Array.from({ length: b - a + 1 }, (_, i) => a + i)).slice(0, n);
  return R;
}
const two = n => (n < 10 ? '0' : '') + n;
const rIf = (id, name, ifaces, routes, x, y) => ({ id, type: 'router', name, x, y, ifaces, routes });

// ---------------------------------------------------------------- base network templates
// each returns { key, title, story, topo, hosts, focusHost, checks, svcPorts, lans:{devId:{net,prefix,gw,dns}}, slots, names }
function tplLab(R) {
  const N = R.pick([3, 4, 6, 7, 9, 11]), B = `192.168.${N}.`, dom = R.pick(['lab.local', 'comlab.local', 'itlab.local']);
  const seats = R.distinct(3, 1, 30).sort((a, b) => a - b), prnN = R.int(240, 250), isp = 4 * R.int(10, 40);
  const pc = (id, s, x, y) => host(id, 'pc', `LAB${N}-PC${two(s)}`, B + (20 + s), 24, B + '1', [B + '10'], `3C-52-82-${two(N)}-00-${two(20 + s)}`, { x, y });
  const topo = {
    devices: [
      pc('p1', seats[0], 70, 340), pc('p2', seats[1], 190, 370), pc('p3', seats[2], 310, 380),
      host('prn', 'printer', `PRN-LAB${N}`, B + prnN, 24, B + '1', [], `00-80-77-${two(N)}-02-${two(prnN - 200)}`, { x: 430, y: 365 }),
      host('srv', 'server', `SRV-LAB${N}`, B + '10', 24, B + '1', ['8.8.8.8'], `00-15-5D-${two(N)}-00-10`, { x: 550, y: 330,
        services: { dns: { records: { ['dns.' + dom]: B + '10', ['intranet.' + dom]: B + '10', ['files.' + dom]: B + '10' } }, web: true, file: true }, firewall: { icmp: true } }),
      sw('sw1', `SW-LAB${N}`, 300, 220),
      rIf('r1', `R-LAB${N}`, [{ name: 'g0/0', ip: B + '1', prefix: 24, up: true }, { name: 'g0/1', ip: '203.0.113.' + (isp + 2), prefix: 30, up: true }],
        [{ net: '0.0.0.0', prefix: 0, via: '203.0.113.' + (isp + 1) }], 480, 110),
      inet('203.0.113.' + (isp + 1), 660, 110)
    ],
    links: [L('l1', 'p1', 'eth0', 'sw1', 'p' + seats[0]), L('l2', 'p2', 'eth0', 'sw1', 'p' + seats[1]), L('l3', 'p3', 'eth0', 'sw1', 'p' + seats[2]),
      L('l4', 'prn', 'eth0', 'sw1', 'p23'), L('l5', 'srv', 'eth0', 'sw1', 'p22'), L('l6', 'r1', 'g0/0', 'sw1', 'p24'),
      L('l7', 'r1', 'g0/1', 'net', 'wan', { medium: 'fiber' })]
  };
  const lan = { net: B + '0', prefix: 24, gw: B + '1', dns: [B + '10'] };
  return {
    key: 'lab', title: `ห้องปฏิบัติการคอมพิวเตอร์ ${N}`,
    story: `ห้องปฏิบัติการคอมพิวเตอร์ ${N} (${B}0/24) ใช้ SRV-LAB${N} เป็น DNS server, เว็บระบบงาน intranet.${dom} และแชร์ไฟล์ files.${dom} ` +
      `เช้านี้ครูและนักเรียนแจ้งปัญหาเข้ามาที่ helpdesk คุณเป็นช่างเครือข่ายประจำวัน ต้องหาสาเหตุจากหลักฐาน แก้ที่ต้นเหตุ ทดสอบยืนยัน และเขียนรายงานการแก้ปัญหาส่งหัวหน้างาน`,
    topo, hosts: ['p1', 'p2', 'p3', 'srv'], focusHost: 'p1', svcPorts: [80, 445, 9100, 53],
    checks: [{ kind: 'ping', src: 'p1', target: 'www.netlab.test' }, { kind: 'tcp', src: 'p1', target: B + prnN, port: 9100 },
      { kind: 'tcp', src: 'p2', target: 'intranet.' + dom, port: 80 }, { kind: 'ping', src: 'p2', target: '8.8.8.8' },
      { kind: 'tcp', src: 'p3', target: 'files.' + dom, port: 445 }, { kind: 'ping', src: 'p3', target: 'www.netlab.test' }],
    lans: { p1: lan, p2: lan, p3: lan, srv: Object.assign({}, lan, { dns: ['8.8.8.8'] }), prn: lan },
    slots: {
      cable: [['p1', 'l1'], ['p2', 'l2'], ['p3', 'l3'], ['srv', 'l5'], ['prn', 'l4']], nic: ['p1', 'p2', 'p3'],
      ip: ['p1', 'p2', 'p3'], mask: ['p1', 'p2', 'p3'], gw: ['p1', 'p2', 'p3', 'srv'], dnsw: ['p1', 'p2', 'p3'],
      dup: [['p1', 'prn'], ['p2', 'prn'], ['p3', 'prn'], ['p2', 'srv'], ['p3', 'srv']],
      dnsstop: ['srv'], dhcp: [], fw: [['srv', 80], ['srv', 445]],
      route: [['r1', 0, 'default']], rif: [['r1', 'g0/0']]
    }
  };
}
function tplOffice(R) {
  const M = R.pick([8, 12, 16, 20]), B = `192.168.${M}.`, dom = R.pick(['office.local', 'admin.local', 'school.local']);
  const admN = R.int(30, 49), isp = 4 * R.int(41, 60), o = R.distinct(2, 1, 20).sort((a, b) => a - b);
  const dpc = (id, n, x, y) => host(id, 'pc', `OFF-${two(n)}`, '', 24, '', [], `F4-8C-50-${two(M)}-00-${two(n)}`, { dhcp: true, x, y });
  const topo = {
    devices: [
      host('adm', 'pc', `ADMIN-${two(admN)}`, B + admN, 24, B + '1', [B + '10'], `3C-52-82-${two(M)}-00-${two(admN)}`, { x: 70, y: 340 }),
      host('fs', 'server', `FS-OFFICE`, B + '11', 24, B + '1', [B + '10'], `00-15-5D-${two(M)}-00-11`, { x: 560, y: 370,
        services: { file: true }, firewall: { icmp: true, smb: true } }),
      dpc('o1', o[0], 190, 375), dpc('o2', o[1], 310, 385),
      host('srv', 'server', 'SRV-DC', B + '10', 24, B + '1', ['8.8.8.8'], `00-15-5D-${two(M)}-00-10`, { x: 440, y: 380,
        services: { dns: { records: { ['dc.' + dom]: B + '10', ['intranet.' + dom]: B + '10', ['files.' + dom]: B + '11' } }, web: true,
          dhcp: { start: B + '100', end: B + '150', prefix: 24, gateway: B + '1', dns: [B + '10'] } }, firewall: { icmp: true } }),
      sw('sw1', `SW-OFFICE`, 300, 230),
      rIf('r1', 'R-OFFICE', [{ name: 'g0/0', ip: B + '1', prefix: 24, up: true }, { name: 'g0/1', ip: '203.0.113.' + (isp + 2), prefix: 30, up: true }],
        [{ net: '0.0.0.0', prefix: 0, via: '203.0.113.' + (isp + 1) }], 480, 110),
      inet('203.0.113.' + (isp + 1), 660, 110)
    ],
    links: [L('l1', 'adm', 'eth0', 'sw1', 'p1'), L('l2', 'o1', 'eth0', 'sw1', 'p' + (2 + o[0])), L('l3', 'o2', 'eth0', 'sw1', 'p' + (2 + o[1])),
      L('l4', 'fs', 'eth0', 'sw1', 'p23'), L('l5', 'srv', 'eth0', 'sw1', 'p22'), L('l6', 'r1', 'g0/0', 'sw1', 'p24'),
      L('l7', 'r1', 'g0/1', 'net', 'wan', { medium: 'fiber' })]
  };
  const lan = { net: B + '0', prefix: 24, gw: B + '1', dns: [B + '10'] };
  return {
    key: 'office', title: 'อาคารสำนักงาน',
    story: `อาคารสำนักงาน (${B}0/24) เครื่องของเจ้าหน้าที่ (OFF-xx) รับ IP แบบ DHCP จาก SRV-DC ซึ่งเป็น DNS server และเว็บ intranet.${dom} ด้วย ` +
      `ส่วน ADMIN-${two(admN)} ตั้ง IP แบบ Static และมี FS-OFFICE เป็นเครื่องแชร์ไฟล์ files.${dom} วันนี้มีผู้ใช้แจ้งปัญหาหลายจุด คุณต้องหาสาเหตุจากหลักฐาน แก้ที่ต้นเหตุ ทดสอบยืนยัน และเขียนรายงานการแก้ปัญหา`,
    topo, hosts: ['o1', 'o2', 'adm', 'srv'], focusHost: 'o1', svcPorts: [80, 445, 53],
    checks: [{ kind: 'ping', src: 'o1', target: 'www.netlab.test' }, { kind: 'tcp', src: 'o1', target: 'files.' + dom, port: 445 },
      { kind: 'tcp', src: 'o2', target: 'intranet.' + dom, port: 80 }, { kind: 'ping', src: 'o2', target: '8.8.8.8' },
      { kind: 'ping', src: 'adm', target: 'www.netlab.test' }, { kind: 'tcp', src: 'adm', target: 'intranet.' + dom, port: 80 }],
    lans: { adm: lan, fs: lan, srv: Object.assign({}, lan, { dns: ['8.8.8.8'] }) },
    slots: {
      cable: [['adm', 'l1'], ['o1', 'l2'], ['o2', 'l3'], ['fs', 'l4'], ['srv', 'l5']], nic: ['adm', 'o1', 'o2'],
      ip: ['adm'], mask: ['adm'], gw: ['adm', 'srv'], dnsw: ['adm'], dup: [['adm', 'fs'], ['adm', 'srv']],
      dnsstop: ['srv'], dhcp: ['srv'], fw: [['fs', 445], ['srv', 80]],
      route: [['r1', 0, 'default']], rif: [['r1', 'g0/0']]
    }
  };
}
function tplCampus(R) {
  const A = R.pick([10, 30, 50]), S = A + 10, BA = `192.168.${A}.`, BS = `192.168.${S}.`, T = `10.${A}.0.`, dom = R.pick(['campus.local', 'school.local', 'tech.local']);
  const seats = R.distinct(3, 11, 49).sort((a, b) => a - b), isp = 4 * R.int(11, 40), prnN = R.int(240, 250);
  const pc = (id, n, x, y) => host(id, 'pc', `BLDA-${two(n)}`, BA + n, 24, BA + '1', [BS + '10'], `3C-52-82-${two(A)}-00-${two(n)}`, { x, y });
  const topo = {
    devices: [
      pc('a1', seats[0], 60, 360), pc('a2', seats[1], 170, 390), pc('a3', seats[2], 280, 390),
      host('prn', 'printer', 'PRN-BLDA', BA + prnN, 24, BA + '1', [], `00-80-77-${two(A)}-02-${two(prnN - 200)}`, { x: 60, y: 250 }),
      sw('sw1', 'SW-BLDA', 170, 260),
      rIf('ra', 'R-BLDA', [{ name: 'g0/0', ip: BA + '1', prefix: 24, up: true }, { name: 'g0/1', ip: T + '1', prefix: 30, up: true },
        { name: 'g0/2', ip: '203.0.113.' + (isp + 2), prefix: 30, up: true }],
        [{ net: '0.0.0.0', prefix: 0, via: '203.0.113.' + (isp + 1) }, { net: BS + '0', prefix: 24, via: T + '2' }], 250, 120),
      rIf('rb', 'R-BLDB', [{ name: 'g0/0', ip: BS + '1', prefix: 24, up: true }, { name: 'g0/1', ip: T + '2', prefix: 30, up: true }],
        [{ net: '0.0.0.0', prefix: 0, via: T + '1' }], 470, 120),
      sw('sw2', 'SW-BLDB', 520, 260),
      host('srv', 'server', 'SRV-DATA', BS + '10', 24, BS + '1', ['8.8.8.8'], `00-15-5D-${two(S)}-00-10`, { x: 560, y: 380,
        services: { dns: { records: { ['dns.' + dom]: BS + '10', ['intranet.' + dom]: BS + '10', ['files.' + dom]: BS + '10' } }, web: true, file: true }, firewall: { icmp: true } }),
      inet('203.0.113.' + (isp + 1), 250, 0)
    ],
    links: [L('l1', 'a1', 'eth0', 'sw1', 'p' + seats[0]), L('l2', 'a2', 'eth0', 'sw1', 'p' + seats[1]), L('l3', 'a3', 'eth0', 'sw1', 'p' + seats[2]),
      L('l4', 'prn', 'eth0', 'sw1', 'p1'), L('l5', 'ra', 'g0/0', 'sw1', 'p24'), L('l6', 'ra', 'g0/1', 'rb', 'g0/1', { medium: 'fiber' }),
      L('l7', 'rb', 'g0/0', 'sw2', 'p24'), L('l8', 'srv', 'eth0', 'sw2', 'p10'), L('l9', 'ra', 'g0/2', 'net', 'wan', { medium: 'fiber' })]
  };
  const lanA = { net: BA + '0', prefix: 24, gw: BA + '1', dns: [BS + '10'] };
  return {
    key: 'campus', title: 'เครือข่ายสองอาคาร',
    story: `วิทยาลัยมีอาคาร A (${BA}0/24, Router R-BLDA ออกอินเทอร์เน็ต) และอาคาร B (${BS}0/24, Router R-BLDB) ต่อถึงกันด้วยสาย Fiber วง ${T}0/30 ` +
      `SRV-DATA ในอาคาร B เป็น DNS server, เว็บ intranet.${dom} และแชร์ไฟล์ files.${dom} ของทั้งวิทยาลัย วันนี้ผู้ใช้ในอาคาร A แจ้งปัญหาหลายเรื่อง คุณต้องหาสาเหตุจากหลักฐาน แก้ที่ต้นเหตุ ทดสอบยืนยัน และเขียนรายงานการแก้ปัญหา`,
    topo, hosts: ['a1', 'a2', 'a3', 'srv'], focusHost: 'a1', svcPorts: [80, 445, 9100, 53],
    checks: [{ kind: 'ping', src: 'a1', target: 'www.netlab.test' }, { kind: 'tcp', src: 'a1', target: 'intranet.' + dom, port: 80 },
      { kind: 'tcp', src: 'a2', target: 'files.' + dom, port: 445 }, { kind: 'ping', src: 'a2', target: '8.8.8.8' },
      { kind: 'ping', src: 'a3', target: BS + '10' }, { kind: 'tcp', src: 'a3', target: BA + prnN, port: 9100 }],
    lans: { a1: lanA, a2: lanA, a3: lanA, prn: lanA, srv: { net: BS + '0', prefix: 24, gw: BS + '1', dns: ['8.8.8.8'] } },
    slots: {
      cable: [['a1', 'l1'], ['a2', 'l2'], ['a3', 'l3'], ['srv', 'l8'], ['prn', 'l4']], nic: ['a1', 'a2', 'a3', 'srv'],
      ip: ['a1', 'a2', 'a3'], mask: ['a1', 'a2', 'a3'], gw: ['a1', 'a2', 'a3', 'srv'], dnsw: ['a1', 'a2', 'a3'],
      dup: [['a1', 'prn'], ['a2', 'prn'], ['a3', 'prn']], dnsstop: ['srv'], dhcp: [], fw: [['srv', 80], ['srv', 445]],
      route: [['ra', 1, 'static'], ['ra', 0, 'default'], ['rb', 0, 'default']], rif: [['ra', 'g0/0'], ['rb', 'g0/0']]
    }
  };
}
const TEMPLATES = [tplLab, tplOffice, tplCampus];

// ---------------------------------------------------------------- fault catalogue
// f = { type, cat, dev, devs (devices accepted as "the faulty device"), keys (allowed field keys), ...params, orig }
const H = (t, id) => dev(t, id);
const ifc = (t, id) => { const d = H(t, id); return d && Array.isArray(d.ifaces) && isObj(d.ifaces[0]) ? d.ifaces[0] : {}; };
const rIface = (t, r, n) => { const d = H(t, r); return d && Array.isArray(d.ifaces) ? d.ifaces.find(x => isObj(x) && x.name === n) || null : null; };
const allIps = (t, except) => { const s = new Set(); t.devices.forEach(d => (d.ifaces || []).forEach(f => { if (isObj(f) && f.ip && !(except && except === d.id)) s.add(String(f.ip).trim()); })); return s; };
const nameOf = (t, id) => (H(t, id) || {}).name || id;
function validHostIp(t, id, lan) {
  const f = ifc(t, id), ip = sv(f.ip), p = IP.toPrefix(f.prefix);
  if (!ip || IP.parse(ip) === null || p !== lan.prefix || !IP.inSubnet(ip, lan.net, lan.prefix)) return false;
  if (ip === IP.network(ip, p) || ip === IP.broadcast(ip, p)) return false;
  return !allIps(t, id).has(ip);
}
const FT = {
  cable: {
    cat: 'physical',
    apply(t, f) { lnk(t, f.link).up = false; },
    fix(t, f) { lnk(t, f.link).up = true; },
    ok: (t, f) => { const l = lnk(t, f.link); return !!l && !(l.up === false || l.up === 'false'); },
    cause: (t, f) => `สายแลนของ ${nameOf(t, f.dev)} หลุดหรือขาด (สาย ${f.link} ไม่มี link) จึงสื่อสารไม่ได้ในระดับ Physical layer`,
    fixText: (t, f) => `เสียบสาย/เปลี่ยนสาย ${f.link} ของ ${nameOf(t, f.dev)} ให้มีสัญญาณ`
  },
  nic: {
    cat: 'physical',
    apply(t, f) { ifc(t, f.dev).up = false; },
    fix(t, f) { ifc(t, f.dev).up = true; },
    ok: (t, f) => { const u = ifc(t, f.dev).up; return !(u === false || u === 'false'); },
    cause: (t, f) => `Network adapter ของ ${nameOf(t, f.dev)} ถูกปิดใช้งาน (Disabled) ทั้งที่สายปกติ`,
    fixText: (t, f) => `เปิดใช้งาน (Enable) Network adapter ของ ${nameOf(t, f.dev)}`
  },
  ip: {
    cat: 'ip',
    apply(t, f) { ifc(t, f.dev).ip = f.bad; },
    fix(t, f) { ifc(t, f.dev).ip = f.orig; },
    ok: (t, f, sc) => validHostIp(t, f.dev, sc.lans[f.dev]),
    cause: (t, f, sc) => `IP address ของ ${nameOf(t, f.dev)} ถูกตั้งเป็น ${f.bad} ซึ่งไม่อยู่ในวง ${sc.lans[f.dev].net}/${sc.lans[f.dev].prefix} ของจุดนั้น จึงติดต่อ gateway และเครื่องในวงไม่ได้`,
    fixText: (t, f, sc) => `แก้ IP ของ ${nameOf(t, f.dev)} ให้อยู่ในวง ${sc.lans[f.dev].net}/${sc.lans[f.dev].prefix} และไม่ซ้ำเครื่องอื่น (เช่น ${f.orig})`
  },
  dup: {
    cat: 'ip',
    apply(t, f) { ifc(t, f.dev).ip = f.bad; },
    fix(t, f) { ifc(t, f.dev).ip = f.orig; },
    ok: (t, f, sc) => validHostIp(t, f.dev, sc.lans[f.dev]) && sv(ifc(t, f.victim).ip) === f.bad,
    cause: (t, f) => `${nameOf(t, f.dev)} ถูกตั้ง IP ${f.bad} ซ้ำกับ ${nameOf(t, f.victim)} (IP conflict) ARP ของ ${f.bad} จึงถูกตอบโดยเครื่องที่ไม่ใช่ ${nameOf(t, f.victim)}`,
    fixText: (t, f) => `เปลี่ยน IP ของ ${nameOf(t, f.dev)} (เครื่องที่ตั้งผิด) เป็น IP ที่ว่างในวงเดียวกัน (เช่น ${f.orig}) โดยไม่ย้าย IP ของ ${nameOf(t, f.victim)}`
  },
  mask: {
    cat: 'ip',
    apply(t, f) { ifc(t, f.dev).prefix = f.bad; },
    fix(t, f) { ifc(t, f.dev).prefix = f.orig; },
    ok: (t, f) => IP.toPrefix(ifc(t, f.dev).prefix) === f.orig,
    cause: (t, f) => `Subnet mask ของ ${nameOf(t, f.dev)} เป็น ${IP.mask(f.bad)} (/${f.bad}) แคบกว่าวงจริง /${f.orig} ทำให้ Default gateway อยู่นอกวงของเครื่อง ส่งข้อมูลออกนอกวงไม่ได้`,
    fixText: (t, f) => `แก้ Subnet mask ของ ${nameOf(t, f.dev)} เป็น ${IP.mask(f.orig)} (/${f.orig})`
  },
  gw: {
    cat: 'gateway',
    apply(t, f) { H(t, f.dev).gateway = f.bad; },
    fix(t, f) { H(t, f.dev).gateway = f.orig; },
    ok: (t, f) => sv(H(t, f.dev).gateway) === f.orig,
    cause: (t, f) => `Default gateway ของ ${nameOf(t, f.dev)} ตั้งเป็น ${f.bad} ซึ่งไม่มี Router ใช้ IP นี้ จึงออกนอกวงไม่ได้`,
    fixText: (t, f) => `แก้ Default gateway ของ ${nameOf(t, f.dev)} เป็น ${f.orig} (IP ของ Router ฝั่งวงนั้น)`
  },
  dnsw: {
    cat: 'dns',
    apply(t, f) { H(t, f.dev).dns = [f.bad]; },
    fix(t, f) { H(t, f.dev).dns = f.orig.slice(); },
    ok: (t, f) => { const d = (H(t, f.dev).dns || []).map(sv).filter(Boolean); return d.length > 0 && d[0] === f.orig[0] && !d.includes(f.bad); },
    cause: (t, f) => `DNS server ของ ${nameOf(t, f.dev)} ตั้งเป็น ${f.bad} ซึ่งไม่ได้ให้บริการ DNS จึงแปลงชื่อเป็น IP ไม่ได้ (ping ด้วย IP ได้ แต่ด้วยชื่อไม่ได้)`,
    fixText: (t, f) => `แก้ DNS server ของ ${nameOf(t, f.dev)} เป็น ${f.orig.join(', ')}`
  },
  dnsstop: {
    cat: 'dns',
    apply(t, f) { H(t, f.dev).services.dns.enabled = false; },
    fix(t, f) { delete H(t, f.dev).services.dns.enabled; },
    ok: (t, f) => { const s = (H(t, f.dev).services || {}).dns; return isObj(s) && !(s.enabled === false || s.enabled === 'false'); },
    cause: (t, f) => `บริการ DNS Server บน ${nameOf(t, f.dev)} หยุดทำงาน (Stopped) เครื่องยังเปิดและ ping ได้ แต่ไม่ตอบการแปลงชื่อ`,
    fixText: (t, f) => `เปิด (Start) บริการ DNS Server บน ${nameOf(t, f.dev)}`
  },
  dhcp: {
    cat: 'dhcp',
    apply(t, f) { H(t, f.dev).services.dhcp.enabled = false; },
    fix(t, f) { delete H(t, f.dev).services.dhcp.enabled; },
    ok: (t, f) => { const s = (H(t, f.dev).services || {}).dhcp; return isObj(s) && !(s.enabled === false || s.enabled === 'false'); },
    cause: (t, f) => `บริการ DHCP Server บน ${nameOf(t, f.dev)} หยุดทำงาน เครื่องที่ตั้งรับ IP อัตโนมัติจึงได้ IP แบบ APIPA (169.254.x.x) ไม่มี gateway และ DNS`,
    fixText: (t, f) => `เปิด (Start) บริการ DHCP Server บน ${nameOf(t, f.dev)} แล้วให้เครื่องลูกข่ายขอ IP ใหม่ (ipconfig /renew)`
  },
  fw: {
    cat: 'firewall',
    apply(t, f) { const d = H(t, f.dev); d.firewall = Object.assign({}, d.firewall || {}, { [f.port === 445 ? 'smb' : 'web']: false }); },
    fix(t, f) { const k = f.port === 445 ? 'smb' : 'web'; if (f.origVal === undefined) delete H(t, f.dev).firewall[k]; else H(t, f.dev).firewall[k] = f.origVal; },
    ok: (t, f) => { const d = H(t, f.dev); return !!d && TS.fwOn(d) && TS.fwAllows(d, f.port); },
    cause: (t, f) => `กฎ Firewall ขาเข้าของ ${nameOf(t, f.dev)} บล็อก ${f.port === 445 ? 'SMB (TCP 445)' : 'HTTP (TCP 80/443)'} ping ได้แต่ใช้บริการไม่ได้`,
    fixText: (t, f) => `อนุญาตกฎ ${f.port === 445 ? 'File and Printer Sharing (SMB-In)' : 'World Wide Web Services (HTTP-In)'} บน Firewall ของ ${nameOf(t, f.dev)} โดยไม่ปิด Firewall ทั้งเครื่อง`
  },
  route: {
    cat: 'router',
    apply(t, f) { const r = H(t, f.dev); if (f.mode === 'del') r.routes.splice(f.idx, 1); else r.routes[f.idx].via = f.bad; },
    fix(t, f) { const r = H(t, f.dev); if (f.mode === 'del') r.routes.splice(f.idx, 0, Object.assign({}, f.orig)); else r.routes[f.idx].via = f.orig.via; },
    ok: (t, f) => {
      const r = H(t, f.dev); const rs = r && Array.isArray(r.routes) ? r.routes.filter(isObj) : [];
      return rs.some(x => { const p = IP.toPrefix(x.prefix); if (p === null || sv(x.via) !== f.orig.via) return false;
        return f.orig.prefix === 0 ? p === 0 && sv(x.net) === '0.0.0.0' : p >= 8 && p <= f.orig.prefix && IP.inSubnet(f.orig.net, sv(x.net), p); });
    },
    cause: (t, f) => `Routing table ของ ${nameOf(t, f.dev)} ${f.mode === 'del' ? 'ไม่มี' : 'มี next hop ผิด (' + f.bad + ') ใน'}เส้นทาง ${f.orig.prefix === 0 ? 'default route (0.0.0.0/0)' : f.orig.net + '/' + f.orig.prefix} Router จึงส่งต่อแพ็กเก็ตไปปลายทางนั้นไม่ได้`,
    fixText: (t, f) => `${f.mode === 'del' ? 'เพิ่ม' : 'แก้'} static route ${f.orig.net}/${f.orig.prefix} via ${f.orig.via} บน ${nameOf(t, f.dev)}`
  },
  rif: {
    cat: 'router',
    apply(t, f) { rIface(t, f.dev, f.iface).ip = f.bad; },
    fix(t, f) { rIface(t, f.dev, f.iface).ip = f.orig.ip; },
    ok: (t, f) => { const x = rIface(t, f.dev, f.iface); return !!x && sv(x.ip) === f.orig.ip && IP.toPrefix(x.prefix) === f.orig.prefix; },
    cause: (t, f) => `IP ของ interface ${f.iface} บน ${nameOf(t, f.dev)} ถูกตั้งเป็น ${f.bad} ไม่ตรงกับ gateway ${f.orig.ip} ที่เครื่องในวงนั้นใช้ จึงไม่มีอุปกรณ์ตอบ ARP ของ gateway`,
    fixText: (t, f) => `แก้ IP ของ ${nameOf(t, f.dev)} ${f.iface} เป็น ${f.orig.ip}/${f.orig.prefix}`
  }
};
const FTYPES = Object.keys(FT);
const keysOf = f => f.type === 'cable' ? ['link.' + f.link + '.up'] : f.type === 'nic' ? [f.dev + '.up'] : f.type === 'ip' || f.type === 'dup' ? [f.dev + '.ip']
  : f.type === 'mask' ? [f.dev + '.prefix'] : f.type === 'gw' ? [f.dev + '.gateway'] : f.type === 'dnsw' ? [f.dev + '.dns'] : f.type === 'dnsstop' ? [f.dev + '.dnsSvc']
    : f.type === 'dhcp' ? [f.dev + '.dhcpSvc'] : f.type === 'fw' ? [f.dev + (f.port === 445 ? '.smb' : '.fwweb')] : f.type === 'route' ? [f.dev + '.routes'] : [f.dev + '.if:' + f.iface];

// pick a concrete fault of a type on the healthy topology (null when the template has no slot for it)
function makeFault(type, R, sc, t) {
  const S = sc.slots, used = allIps(t);
  const freeIn = (lan, cands) => cands.map(n => IP.str(IP.parse(lan.net) + n)).filter(ip => !used.has(ip));
  if (type === 'cable') { if (!S.cable.length) return null; const [d, l] = R.pick(S.cable); return { type, dev: d, devs: [d, lnk(t, l).b.dev], link: l }; }
  if (type === 'nic') { if (!S.nic.length) return null; const d = R.pick(S.nic); return { type, dev: d, devs: [d] }; }
  if (type === 'ip') {
    if (!S.ip.length) return null; const d = R.pick(S.ip), lan = sc.lans[d], ip = sv(ifc(t, d).ip), o = ip.split('.');
    const third = +o[2], alt = R.pick([third + 1, third > 1 ? third - 1 : third + 2, third === 1 ? 10 : 1]);
    return { type, dev: d, devs: [d], orig: ip, bad: `${o[0]}.${o[1]}.${alt}.${o[3]}`, lan };
  }
  if (type === 'dup') { if (!S.dup.length) return null; const [d, v] = R.pick(S.dup); return { type, dev: d, devs: [d], victim: v, orig: sv(ifc(t, d).ip), bad: sv(ifc(t, v).ip) }; }
  if (type === 'mask') {
    if (!S.mask.length) return null; const d = R.pick(S.mask), ip = sv(ifc(t, d).ip), gw = sv(H(t, d).gateway);
    const ps = [25, 26, 27, 28, 29].filter(p => !IP.inSubnet(gw, IP.network(ip, p), p) && ip !== IP.broadcast(ip, p) && ip !== IP.network(ip, p));
    return ps.length ? { type, dev: d, devs: [d], orig: IP.toPrefix(ifc(t, d).prefix), bad: R.pick(ps) } : null;
  }
  if (type === 'gw') {
    if (!S.gw.length) return null; const d = R.pick(S.gw), lan = sc.lans[d], c = freeIn(lan, [254, 2, 3, 100, 200]);
    return c.length ? { type, dev: d, devs: [d], orig: sv(H(t, d).gateway), bad: R.pick(c) } : null;
  }
  if (type === 'dnsw') {
    if (!S.dnsw.length) return null; const d = R.pick(S.dnsw), lan = sc.lans[d];
    const c = freeIn(lan, [53, 5, 9, 250]).concat([lan.gw, '8.8.4.8']);
    return { type, dev: d, devs: [d], orig: (H(t, d).dns || []).slice(), bad: R.pick(c) };
  }
  if (type === 'dnsstop') { if (!S.dnsstop.length) return null; const d = R.pick(S.dnsstop); return { type, dev: d, devs: [d] }; }
  if (type === 'dhcp') { if (!S.dhcp.length) return null; const d = R.pick(S.dhcp); return { type, dev: d, devs: [d] }; }
  if (type === 'fw') {
    if (!S.fw.length) return null; const [d, port] = R.pick(S.fw), fw = H(t, d).firewall;
    return { type, dev: d, devs: [d], port, origVal: isObj(fw) ? fw[port === 445 ? 'smb' : 'web'] : undefined };
  }
  if (type === 'route') {
    if (!S.route.length) return null; const [r, idx] = R.pick(S.route), orig = clone(H(t, r).routes[idx]);
    orig.prefix = IP.toPrefix(orig.prefix);
    const mode = R.pick(['del', 'via']);
    const o = orig.via.split('.'); const bad = `${o[0]}.${o[1]}.${o[2]}.${(+o[3] + 4) % 250 + 1}`;
    return { type, dev: r, devs: [r], idx, mode, orig, bad };
  }
  if (type === 'rif') {
    if (!S.rif.length) return null; const [r, n] = R.pick(S.rif), x = rIface(t, r, n), o = x.ip.split('.');
    const bad = R.pick([`${o[0]}.${o[1]}.${+o[2] + 1}.${o[3]}`, `${o[0]}.${o[1]}.${o[2]}.254`]);
    return used.has(bad) ? null : { type, dev: r, devs: [r], iface: n, orig: { ip: x.ip, prefix: IP.toPrefix(x.prefix) }, bad };
  }
  return null;
}
const checkResults = (t, checks) => { const net = NetSim.create(TS.effTopo(t)); return checks.map(c => !!TS.runCheck(NetSim, t, c, net).ok); };
function applyFaults(t, faults, skip) { faults.forEach(f => { if (f !== skip) FT[f.type].apply(t, f); }); return t; }
// the network with every fault injected except `except` (= that fault alone repaired)
const withoutFault = (healthy, faults, except) => applyFaults(clone(healthy), faults, except);
function validScenario(sc, healthy, faults) {
  if (!checkResults(healthy, sc.checks).every(Boolean)) return false;
  const keys = faults.flatMap(keysOf);
  if (new Set(keys).size !== keys.length || new Set(faults.map(f => f.dev)).size !== faults.length) return false;
  const faulty = applyFaults(clone(healthy), faults);
  const base = checkResults(faulty, sc.checks);
  if (base.every(Boolean)) return false;
  if (base.filter(x => !x).length > 5) return false;               // keep some things working (realistic, gives contrast)
  for (const f of faults) {
    if (FT[f.type].ok(faulty, f, sc)) return false;                   // the fault really is there
    const only = withoutFault(healthy, faults, f);                    // fault f alone repaired
    const r = checkResults(only, sc.checks);
    if (r.every((x, i) => x === base[i])) return false;               // f must be observable before any change
    if (faults.length > 1) {                                           // and still needed once the others are repaired
      const just = applyFaults(clone(healthy), [f]);
      if (checkResults(just, sc.checks).every(Boolean)) return false;
    }
  }
  const fixed = clone(faulty); faults.slice().reverse().forEach(f => FT[f.type].fix(fixed, f));
  if (stable(fixed) !== stable(healthy)) return false;
  return faults.every(f => FT[f.type].ok(healthy, f, sc));
}
const SYM = {
  ping: (c, n) => c.target === '8.8.8.8' ? `${n(c.src)} ใช้อินเทอร์เน็ตไม่ได้ (ping 8.8.8.8 ไม่ผ่าน)` : /^www\./.test(c.target) ? `${n(c.src)} เปิดเว็บ ${c.target} ไม่ได้` : `${n(c.src)} ติดต่อ ${c.target} ไม่ได้`,
  80: (c, n) => `${n(c.src)} เปิดระบบงาน http://${c.target} ไม่ได้`,
  445: (c, n) => `${n(c.src)} เปิดโฟลเดอร์แชร์ \\\\${c.target} ไม่ได้`,
  9100: (c, n) => `${n(c.src)} สั่งพิมพ์ไปที่เครื่องพิมพ์ ${c.target} ไม่ออก`
};
const OKSYM = {
  ping: (c, n) => c.target === '8.8.8.8' ? `${n(c.src)} ใช้อินเทอร์เน็ตได้ตามปกติ` : `${n(c.src)} เข้า ${c.target} ได้ตามปกติ`,
  80: (c, n) => `${n(c.src)} เปิด http://${c.target} ได้ตามปกติ`, 445: (c, n) => `${n(c.src)} เปิดแชร์ \\\\${c.target} ได้ตามปกติ`,
  9100: (c, n) => `${n(c.src)} สั่งพิมพ์ได้ตามปกติ`
};
// nonce -> full scenario (server only). Deterministic for a given nonce and key.
const SCACHE = new Map();
function scenarioFor(nonce, key) {
  const k = key || serverKey();
  const ck = k.toString('hex').slice(0, 16) + ':' + nonce;
  if (SCACHE.has(ck)) return SCACHE.get(ck);
  const seed = crypto.createHmac('sha256', k).update('x14|' + nonce).digest('hex');
  const R = mkRand(seed);
  let out = null;
  for (let attempt = 0; attempt < 80 && !out; attempt++) {
    const sc = R.pick(TEMPLATES)(R);
    const healthy = sc.topo;
    const nf = R.f() < 0.35 ? 1 : 2;
    // category first (so every category is equally likely), then a fault type of that category; two faults = two categories
    const faults = [];
    for (const cat of R.shuffle(CATS.map(c => c[0]))) {
      if (faults.length >= nf) break;
      for (const ty of R.shuffle(FTYPES.filter(x => FT[x].cat === cat))) {
        const f = makeFault(ty, R, sc, healthy); if (!f) continue;
        f.cat = cat; f.keys = keysOf(f);
        faults.push(f); break;
      }
    }
    if (faults.length !== nf || !validScenario(sc, healthy, faults)) continue;
    sc.healthy = healthy; sc.faults = faults;
    sc.topo = applyFaults(clone(healthy), faults);
    out = sc;
  }
  if (!out) throw new Error('x14: no valid scenario');
  const names = {}; out.topo.devices.forEach(d => { names[d.id] = d.name; });
  const n = id => names[id] || id;
  const base = checkResults(out.topo, out.checks);
  out.base = base;
  out.names = names;
  out.symptoms = out.checks.map((c, i) => base[i] ? null : (SYM[c.kind === 'tcp' ? c.port : 'ping'] || SYM.ping)(c, n)).filter(Boolean);
  const okOnes = out.checks.filter((c, i) => base[i]);
  if (okOnes.length) out.symptoms.push('ส่วนที่ยังใช้ได้: ' + okOnes.slice(0, 2).map(c => (OKSYM[c.kind === 'tcp' ? c.port : 'ping'] || OKSYM.ping)(c, n)).join(' / '));
  out.allowed = out.faults.flatMap(f => f.keys);
  if (SCACHE.size > 200) SCACHE.clear();
  SCACHE.set(ck, out);
  return out;
}
function publicProblem(nonce) {
  const sc = scenarioFor(nonce);
  return { v: 1, n: nonce, title: sc.title, story: sc.story, symptoms: sc.symptoms.slice(), topo: clone(sc.topo),
    focusHost: sc.focusHost, hosts: sc.hosts.slice(), checks: sc.checks.map(c => Object.assign({}, c)), svcPorts: sc.svcPorts.slice() };
}
function generate(missionId, rand) {
  const r = typeof rand === 'function' ? rand : Math.random;
  if (missionId !== X14) return null;   // only x14 is generated (see generatedMissions)
  let nonce = '';
  for (let i = 0; i < 4; i++) nonce += ('00000000' + Math.floor(r() * 4294967296).toString(16)).slice(-8);
  return publicProblem(nonce);
}

// ---------------------------------------------------------------- grading x14
const RPT_FIELDS = [['symptom', 'อาการที่พบ'], ['evidence', 'หลักฐาน/คำสั่งที่ใช้'], ['cause', 'สาเหตุ (อธิบาย)'], ['fix', 'วิธีแก้ไข'], ['verify', 'การทดสอบยืนยัน']];
const txt = (v, n) => typeof v === 'string' ? v.trim().slice(0, n || 2000) : '';
const meaningful = s => s.replace(/[\s.\-_,;:()]/g, '').length >= 12;
// an action result "shows" something when it differs between two networks
const resKey = r => r.type === 'ping' || r.type === 'tracert' ? String(!!r.ok) + (r.reason || '') : r.type === 'nslookup' ? String(!!r.ok) + (r.ip || '')
  : r.type === 'svc' ? String(!!r.tcp) : r.type === 'ipconfig' ? stable(r.cfg || null) : r.type === 'arp' ? stable(r.arp || []) : r.type === 'route' ? stable(r.routes || []) : '';
function gradeGen(p, problem) {
  const bad = m => ({ score: 0, max: GMAX, ok: false, feedback: [m], details: {}, rubric: [] });
  if (!isObj(problem) || typeof problem.n !== 'string' || !/^[0-9a-f]{16,64}$/.test(problem.n)) return bad('ไม่พบโจทย์ที่สุ่มไว้ — กด "สุ่มสถานการณ์ใหม่" แล้วทำใหม่');
  let sc;
  try { sc = scenarioFor(problem.n); } catch (e) { return bad('สร้างสถานการณ์ของโจทย์นี้ไม่ได้ — กด "สุ่มสถานการณ์ใหม่"'); }
  if (!isObj(problem.topo) || stable(problem.topo) !== stable(sc.topo)) return bad('โจทย์ไม่ตรงกับที่ระบบสร้างไว้ — กด "สุ่มสถานการณ์ใหม่"');
  const feedback = [], names = sc.names, nf = sc.faults.length;
  const details = { mode: 'gen', solved: 0, root: 0, evidence: [], verified: false, regressions: [], outOfScope: [], destructive: [], checks: [], explain: null };
  const actions = cleanActions(p.actions);
  const bActs = actions.filter(x => x.ph === 'b');
  // ---- evidence (before any change), judged against the derived faults
  const before = TS.replay(NetSim, sc.topo, bActs, { hosts: sc.hosts });
  const evItems = [];
  sc.faults.forEach(f => {
    const alt = TS.replay(NetSim, withoutFault(sc.healthy, sc.faults, f), bActs, { hosts: sc.hosts });
    const same = before.length === alt.length;
    const symptom = same && before.some((r, i) => ['ping', 'tracert', 'nslookup', 'svc'].includes(r.type) && resKey(r) !== resKey(alt[i]));
    const locate = before.some(r => r.k === 'inspect' && f.devs.includes(r.dev)) ||
      (same && before.some((r, i) => ['ipconfig', 'arp', 'route'].includes(r.type) && resKey(r) !== resKey(alt[i])));
    evItems.push({ text: `ทดสอบแล้วเห็นอาการที่เกิดจากจุดเสีย: ${FT[f.type].cause(sc.topo, f, sc)}`, got: symptom });
    evItems.push({ text: `ระบุตำแหน่ง: ตรวจค่าตั้ง/ipconfig/arp ที่แสดงความผิดปกติของ ${names[f.dev] || f.dev}`, got: locate });
  });
  const evGot = evItems.filter(x => x.got).length;
  const evPts = G.EVID * evGot / evItems.length;
  // ---- report
  const rp = isObj(p.rpt) ? p.rpt : {};
  const filled = RPT_FIELDS.filter(([k]) => meaningful(txt(rp[k])));
  const repPts = G.REPORT * filled.length / RPT_FIELDS.length;
  const rows = (Array.isArray(rp.causes) ? rp.causes : []).slice(0, 3).filter(isObj).map(x => ({ cat: txt(x.cat, 20), dev: txt(x.dev, 20) })).filter(x => CATS.some(c => c[0] === x.cat));
  // ---- network
  const t = p.topo, tp = topoProblem(t);
  let fixedFlags = sc.faults.map(() => false), solvePts = 0, rootPts = 0, verPts = 0, deduct = 0, diff = null;
  const failing = sc.checks.map((c, i) => i).filter(i => !sc.base[i]);
  if (tp) feedback.push(tp);
  else {
    diff = diffTopo(sc.topo, t, true);
    if (diff.structural.length) { diff.structural.slice(0, 4).forEach(m => feedback.push('แก้ไขเกินขอบเขต: ' + m)); details.outOfScope = diff.structural.slice(0, 10); }
    else if (!diff.changed.length) feedback.push('ยังไม่ได้แก้ไขเครือข่าย (ส่วนการแก้ปัญหาได้ 0)');
    else {
      const net = NetSim.create(TS.effTopo(t));
      const res = sc.checks.map(c => Object.assign({ c }, TS.runCheck(NetSim, t, c, net)));
      details.checks = res.map((x, i) => ({ text: checkText(x.c, names), ok: !!x.ok, before: sc.base[i] }));
      const nowOk = failing.filter(i => res[i].ok).length;
      solvePts = G.SOLVE * nowOk / failing.length;
      details.solved = r2(solvePts);
      res.forEach((x, i) => { if (!sc.base[i] || !x.ok) feedback.push(x.ok ? `${checkText(x.c, names)}: ผ่าน ✓` : `${checkText(x.c, names)}: ยังไม่ผ่าน — ${x.c.kind === 'tcp' ? TS.TCP_WHY[x.why] || x.why : (x.reasonText || x.reason)}`); });
      fixedFlags = sc.faults.map(f => { try { return !!FT[f.type].ok(t, f, sc); } catch (e) { return false; } });
      rootPts = G.ROOT * fixedFlags.filter(Boolean).length / nf;
      details.root = r2(rootPts);
      res.forEach((x, i) => { if (sc.base[i] && !x.ok) details.regressions.push(checkText(x.c, names)); });
      const extra = diff.changed.filter(k => !sc.allowed.includes(k));
      details.outOfScope = extra;
      // replacing a faulty value (e.g. a route with a wrong next hop) is not destructive when that fault is now repaired
      const repairedKeys = new Set(sc.faults.filter((f, i) => fixedFlags[i]).flatMap(f => f.keys));
      details.destructive = diff.changed.filter(k => destructive(k, diff.vals[k]) && !repairedKeys.has(k));
      details.regressions.forEach(x => { deduct += G.REGRESS; feedback.push(`ทำให้ส่วนที่เคยใช้งานได้เสีย (-${G.REGRESS}): ${x} ใช้ไม่ได้แล้ว`); });
      let side = 0;
      extra.forEach(k => { side += G.EXTRA + (details.destructive.includes(k) ? G.DESTROY : 0); });
      details.destructive.filter(k => sc.allowed.includes(k)).forEach(() => { side += G.DESTROY; });
      side = Math.min(side, G.DEDUCT_CAP);
      deduct += side;
      if (side) feedback.push(`มีการแก้ไขที่ไม่ใช่ต้นเหตุหรือปิด/ลบของเดิม ${extra.length + details.destructive.filter(k => sc.allowed.includes(k)).length} รายการ (-${side}) — แก้เฉพาะจุดที่หลักฐานชี้`);
      const allOk = res.every(x => x.ok);
      const after = TS.replay(NetSim, t, actions.filter(x => x.ph === 'a'), { hosts: sc.hosts });
      details.verified = after.some(r => (r.k === 'test' && allOk) ||
        (r.ok === true && r.type === 'ping' && sc.checks.some(c => c.kind === 'ping' && c.src === r.host && sameTarget(c.target, r.target))) ||
        (r.type === 'svc' && r.tcp && sc.checks.some(c => c.kind === 'tcp' && c.src === r.host && c.port === r.port && sameTarget(c.target, r.target))));
      verPts = details.verified ? G.VERIFY : 0;
      const nFixed = fixedFlags.filter(Boolean).length;
      if (nFixed === nf) feedback.push(`แก้ที่ต้นเหตุครบทุกจุด ✓ (+${G.ROOT})`);
      else feedback.push(`ต้นเหตุยังแก้ไม่ครบ: แก้ที่ต้นเหตุแล้ว ${nFixed} จาก ${nf} จุด${allOk ? ' (ทดสอบผ่านแต่บางจุดเป็นการแก้อ้อม/workaround)' : ''}`);
      feedback.push(details.verified ? `ทดสอบยืนยันผลหลังแก้ไข ✓ (+${G.VERIFY})` : 'ยังไม่ได้ทดสอบยืนยันหลังแก้ไข (ใช้ ping/ทดสอบบริการ หรือปุ่มทดสอบ หลังบันทึกการแก้ไข)');
    }
  }
  // ---- root-cause analysis in the report (category select + device select)
  const used = new Set();
  let rcaPts = 0;
  const rcaNotes = [];
  sc.faults.forEach((f, fi) => {
    let j = rows.findIndex((r, i) => !used.has(i) && r.cat === f.cat && f.devs.includes(r.dev));
    if (j < 0) j = rows.findIndex((r, i) => !used.has(i) && r.cat === f.cat);
    if (j < 0) { rcaNotes.push(false); return; }
    used.add(j);
    const w = fixedFlags[fi] ? 1 : 0.5;
    rcaPts += w * ((G.RCA - 1) + (f.devs.includes(rows[j].dev) ? 1 : 0)) / nf;
    rcaNotes.push(true);
  });
  const wrongRows = rows.filter((r, i) => !used.has(i)).length;
  rcaPts = Math.max(0, rcaPts - wrongRows);
  const nCat = rcaNotes.filter(Boolean).length;
  feedback.push(rows.length ? `สาเหตุที่ระบุในรายงาน: ตรงกับต้นเหตุจริง ${nCat} หมวด${wrongRows ? `, ไม่ตรง ${wrongRows} รายการ (-${wrongRows})` : ''} (${r2(rcaPts)}/${G.RCA})` : 'รายงานยังไม่ได้เลือกหมวดสาเหตุ (Root cause)');
  feedback.push(`รายงาน: กรอกครบ ${filled.length}/${RPT_FIELDS.length} หัวข้อ${filled.length < RPT_FIELDS.length ? ' — ยังขาด ' + RPT_FIELDS.filter(x => !filled.includes(x)).map(x => x[1]).join(', ') : ' ✓'}`);
  feedback.push(evGot ? `หลักฐานการวินิจฉัยก่อนแก้ไข ${evGot}/${evItems.length} รายการ (+${r2(evPts)})` : 'ไม่พบหลักฐานการวินิจฉัยก่อนแก้ไข (ทดสอบด้วยคำสั่งและตรวจค่าตั้งก่อนเปลี่ยนค่าใด ๆ)');
  const allFixed = fixedFlags.every(Boolean);
  if (allFixed) {
    details.evidence = evItems;
    details.explain = {
      cause: sc.faults.map(f => FT[f.type].cause(sc.topo, f, sc)).join(' และ '),
      evidence: sc.faults.map(f => `${CATS.find(c => c[0] === f.cat)[1]} ที่ ${names[f.dev] || f.dev}`),
      fix: sc.faults.map(f => FT[f.type].fixText(sc.topo, f, sc)).join(' / ')
    };
    details.faults = sc.faults.map(f => ({ cat: f.cat, dev: f.dev }));
  } else details.evidence = evItems.map(x => ({ got: x.got }));
  // ---- total + rubric (items sum to the score)
  const raw = solvePts + rootPts + evPts + verPts + repPts + rcaPts - deduct;
  const score = r2(Math.max(0, Math.min(GMAX, raw)));
  const rub = [
    { id: 'solve', title: 'แก้ปัญหาให้ใช้งานได้ (ผลทดสอบเงื่อนไข)', score: r2(solvePts), max: G.SOLVE, note: details.checks.length ? `เงื่อนไขที่เคยล้มเหลวผ่านแล้ว ${failing.filter(i => details.checks[i] && details.checks[i].ok).length}/${failing.length}` : 'ยังไม่ได้แก้ไขเครือข่าย' },
    { id: 'root', title: 'แก้ที่ต้นเหตุ (ไม่ใช่ workaround)', score: r2(rootPts), max: G.ROOT, note: allFixed ? 'ต้นเหตุจริง: ' + details.explain.cause : `แก้ที่ต้นเหตุแล้ว ${fixedFlags.filter(Boolean).length}/${nf} จุด` },
    { id: 'evidence', title: 'หลักฐานการวินิจฉัยก่อนแก้ไข', score: r2(evPts), max: G.EVID, note: `${evGot}/${evItems.length} รายการ` },
    { id: 'verify', title: 'ทดสอบยืนยันหลังแก้ไข', score: verPts, max: G.VERIFY },
    { id: 'report', title: 'รายงานครบทุกหัวข้อ', score: r2(repPts), max: G.REPORT, note: `${filled.length}/${RPT_FIELDS.length} หัวข้อ` },
    { id: 'rca', title: 'ระบุหมวดสาเหตุและอุปกรณ์ต้นเหตุได้ตรง', score: r2(rcaPts), max: G.RCA, note: `ตรง ${nCat}/${nf} หมวด${wrongRows ? `, ไม่ตรง ${wrongRows}` : ''}` }
  ];
  const sum = rub.reduce((a, x) => a + x.score, 0);
  if (Math.abs(sum - score) > 1e-9) rub.push({ id: 'deduct', title: 'หักคะแนน (ทำส่วนอื่นเสีย / แก้เกินจำเป็น)', score: r2(score - sum), max: 0, note: details.regressions.length ? `ทำให้เสีย ${details.regressions.length} รายการ` : undefined });
  if (allFixed && !details.regressions.length && solvePts === G.SOLVE) feedback.unshift('แก้ปัญหาได้ถูกต้องที่ต้นเหตุ ✓');
  return { score, max: GMAX, ok: score === GMAX, feedback, details, rubric: rub };
}

function grade(missionId, payload, problem) {
  if (missionId === X14) {
    try { return gradeGen(isObj(payload) ? payload : {}, problem); }
    catch (e) { return { score: 0, max: GMAX, ok: false, feedback: ['ข้อมูลที่ส่งมาไม่ถูกต้อง'], details: {}, rubric: [] }; }
  }
  const sc = PRIVATE[missionId];
  if (!sc) return { score: 0, max: MAX, ok: false, feedback: ['ไม่พบภารกิจนี้'], details: {} };
  if (sc.mode === 'evidence') {
    try { return gradeEvidence(sc, isObj(payload) ? payload : {}); }
    catch (e) { return { score: 0, max: MAX, ok: false, feedback: ['ข้อมูลที่ส่งมาไม่ถูกต้อง'], details: {} }; }
  }
  try {
    const p = isObj(payload) ? payload : {};
    const feedback = [];
    const details = { cause: false, outOfScope: [], pings: [], faults: [] };
    let score = 0;
    // ---- cause
    const cause = typeof p.cause === 'string' ? p.cause.slice(0, 40) : '';
    if (!cause) feedback.push('ยังไม่ได้เลือกสาเหตุของปัญหา');
    else if (!sc.causes.some(c => c[0] === cause)) feedback.push('สาเหตุที่เลือกไม่อยู่ในรายการ');
    else if (cause === sc.cause) { score += CAUSE_PTS; details.cause = true; feedback.push(`สาเหตุถูกต้อง ✓ (+${CAUSE_PTS}) — ${sc.explain}`); }
    else feedback.push('สาเหตุที่เลือกยังไม่ใช่สาเหตุหลัก — ลองไล่ตรวจตามขั้นตอนอีกครั้ง (ดูว่าขั้นใดเริ่มล้มเหลว)');
    // ---- topology
    const t = p.topo;
    if (!isObj(t) || !Array.isArray(t.devices) || !Array.isArray(t.links)) {
      feedback.push('ไม่พบผลการแก้ไขเครือข่าย (topo) — แก้ไขการตั้งค่าแล้วกดส่งงานอีกครั้ง');
      return { score: r2(score), max: MAX, ok: false, feedback, details };
    }
    if (t.devices.length > LIM.devices || t.links.length > LIM.links) {
      feedback.push('ข้อมูลเครือข่ายมีขนาดใหญ่เกินกำหนด');
      return { score: r2(score), max: MAX, ok: false, feedback, details };
    }
    for (const d of t.devices) {
      if (isObj(d) && Array.isArray(d.routes) && d.routes.length > LIM.routes) { feedback.push('Static route มากเกินกำหนด'); return { score: r2(score), max: MAX, ok: false, feedback, details }; }
      if (isObj(d) && Array.isArray(d.dns) && d.dns.length > LIM.dns) { feedback.push('DNS server มากเกินกำหนด (ไม่เกิน 4)'); return { score: r2(score), max: MAX, ok: false, feedback, details }; }
    }
    const diff = diffTopo(sc.topo, t);
    if (diff.structural.length) {
      diff.structural.slice(0, 4).forEach(m => feedback.push('แก้ไขเกินขอบเขต: ' + m));
      details.outOfScope = diff.structural.slice(0, 10);
      return { score: r2(score), max: MAX, ok: false, feedback, details };
    }
    if (!diff.changed.length) {
      feedback.push('ยังไม่ได้แก้ไขการตั้งค่าใด ๆ (ส่วนการแก้ไขได้ 0/' + (PING_PTS + FAULT_PTS) + ')');
      return { score: r2(score), max: MAX, ok: false, feedback, details };
    }
    const out = diff.changed.filter(k => !sc.allowed.includes(k));
    if (out.length) {
      details.outOfScope = out;
      feedback.push('แก้ไขเกินขอบเขต: ' + out.map(k => describeKey(k, diff.names)).join(', ') + ' — ค่าเหล่านี้ไม่ได้เป็นสาเหตุของปัญหา ให้แก้เฉพาะจุดที่ผิดจริง (กด "เริ่มใหม่" แล้วลองอีกครั้ง)');
      return { score: r2(score), max: MAX, ok: false, feedback, details };
    }
    // ---- verify with NetSim
    const net = NetSim.create(t);
    const pings = runPings(net, sc.successPings);
    details.pings = pings.map(x => ({ src: x.src, dst: x.dst, ok: x.ok, reason: x.reason }));
    const passed = pings.filter(x => x.ok).length;
    const pingScore = PING_PTS * passed / pings.length;
    score += pingScore;
    pings.forEach(x => {
      const nm = diff.names[x.src] || x.src;
      feedback.push(x.ok ? `ทดสอบ ping จาก ${nm} ไป ${x.dst}: ผ่าน ✓` : `ทดสอบ ping จาก ${nm} ไป ${x.dst}: ยังไม่ผ่าน — ${x.reasonText}`);
    });
    const fres = sc.faults.map(f => { try { return f(t, net); } catch (e) { return 'ตรวจสอบการแก้ไขไม่ได้'; } });
    details.faults = fres.map(m => !m);
    const fixedN = fres.filter(m => !m).length;
    score += FAULT_PTS * fixedN / fres.length;
    faultMsgs(sc, fres, diff.changed).forEach(m => feedback.push('จุดที่ผิดยังไม่ได้รับการแก้ไขอย่างถูกต้อง: ' + m));
    if (fixedN === fres.length && passed === pings.length) feedback.push(`แก้ไขถูกจุดและทดสอบผ่านทั้งหมด ✓ (+${PING_PTS + FAULT_PTS})`);
    else if (passed === pings.length && fixedN < fres.length) feedback.push('ping ผ่านแล้วแต่ยังเป็นการแก้แบบอ้อม (workaround) ไม่ได้แก้ที่ต้นเหตุ');
    score = Math.min(MAX, r2(score));
    return { score, max: MAX, ok: score === MAX, feedback, details };
  } catch (e) {
    return { score: 0, max: MAX, ok: false, feedback: ['ข้อมูลที่ส่งมาไม่ถูกต้อง'], details: {} };
  }
}

// x14 is appended after x1-x13 (public data only: no faults, no answers)
missions.push({
  id: X14, title: 'สุ่มเหตุขัดข้อง', level: 'hard', max: GMAX,
  desc: 'ระบบสุ่มเครือข่ายและเหตุขัดข้อง 1–2 จุด สืบหาสาเหตุจากหลักฐาน แก้ที่ต้นเหตุ ทดสอบยืนยัน แล้วเขียนรายงานการแก้ปัญหา (ครูตรวจรายงานเพิ่ม)',
  hints: [COMMON_HINT,
    'ไล่ตามชั้น: สาย/การ์ดแลน → IP/mask → gateway → DNS → บริการและ Firewall ปลายทาง → Router ใช้เครื่องที่ใช้งานได้เป็นตัวเปรียบเทียบ',
    'อาการเดียวอาจมีหลายสาเหตุ และอาจมีเหตุขัดข้องมากกว่าหนึ่งจุด หลังแก้จุดแรกให้ทดสอบทุกเงื่อนไขอีกครั้ง',
    'เก็บหลักฐานก่อนแก้ไขเสมอ (ping, nslookup, ipconfig, arp, ทดสอบบริการ, ดูค่าตั้งของอุปกรณ์ต้นเหตุ) และจดผลไว้ใช้เขียนรายงาน'],
  start: { mode: 'evidence', gen: true, cats: CATS.map(([id, text]) => ({ id, text })),
    report: RPT_FIELDS.map(([id, title]) => ({ id, title })) },
  review: { teacher: [
    { id: 'quality', title: 'คุณภาพรายงานและการให้เหตุผล', max: 5,
      desc: 'อาการ หลักฐาน สาเหตุ วิธีแก้ และการทดสอบยืนยัน สอดคล้องกันเป็นลำดับเหตุผล อ้างผลคำสั่งจริงประกอบ อธิบายได้ว่าทำไมหลักฐานชี้ไปที่ต้นเหตุ และตัดสาเหตุอื่นออกอย่างไร' },
    { id: 'comm', title: 'ความเป็นมืออาชีพและการสื่อสาร', max: 3,
      desc: 'เขียนชัดเจน เป็นลำดับ ใช้ศัพท์เทคนิคถูกต้อง ผู้อ่าน (หัวหน้างาน/ผู้ใช้) เข้าใจได้ บอกผลกระทบและข้อแนะนำป้องกันไม่ให้เกิดซ้ำ' }
  ] }
});

/* 3.1: x15 (week 1) is listed after x14 so the numbers of x1-x14 shown to students stay the same */
missions.push(missions.splice(missions.findIndex(m => m.id === 'x15'), 1)[0]);
module.exports = { id: 'troubleshoot', title: 'ห้องปฏิบัติการแก้ไขปัญหาเครือข่าย', missions, generate, generatedMissions: [X14], grade, _scenarios: PRIVATE, _diffTopo: diffTopo,
  _x14: { scenarioFor, publicProblem, FT, CATS, keysOf, withoutFault, serverKey } };

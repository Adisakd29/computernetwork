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
 */
const path = require('path');
const NetSim = require(path.join(__dirname, '../../public/js/sim/netsim.js'));
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

// ------------------------------------------------------------------ scenarios
const COMMON_HINT = 'เริ่มจากเครื่องที่มีปัญหา: ipconfig /all → ping gateway → ping server → ping 8.8.8.8 → nslookup ชื่อ แล้วดูว่าขั้นไหนเริ่มล้มเหลว';
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
    hints: [COMMON_HINT, 'คลิกที่ AP และ NB-LIB04 ในแผนผังเพื่อเปรียบเทียบชื่อเครือข่าย Wi-Fi (SSID)'],
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
  }
];

// ------------------------------------------------------------------ field extraction (normalised editable values)
const sv = v => (typeof v === 'string' || typeof v === 'number') ? String(v).trim().slice(0, LIM.str) : '';
const isObj = x => !!x && typeof x === 'object' && !Array.isArray(x);
const isHostType = t => ['pc', 'laptop', 'server', 'printer'].includes(String(t));
function hostFields(d) {
  const f = Array.isArray(d.ifaces) && isObj(d.ifaces[0]) ? d.ifaces[0] : {};
  let dns = d.dns; if (typeof dns === 'string') dns = dns.split(/[\s,;]+/);
  const pf = IP.toPrefix(f.prefix !== undefined && f.prefix !== '' && f.prefix !== null ? f.prefix : f.mask);
  return {
    ip: sv(f.ip), prefix: pf === null ? sv(f.prefix) : String(pf), gateway: sv(d.gateway),
    dns: (Array.isArray(dns) ? dns : []).map(sv).filter(Boolean).join(','),
    dhcp: String(d.dhcp === true || d.dhcp === 'true'), up: String(!(f.up === false || f.up === 'false')),
    ssid: sv(d.ssid), icmp: String(!(isObj(d.firewall) && (d.firewall.icmp === false || d.firewall.icmp === 'false')))
  };
}
function routerFields(d) {
  const rs = Array.isArray(d.routes) ? d.routes.filter(isObj) : [];
  return { routes: rs.map(r => `${sv(r.net)}/${IP.toPrefix(r.prefix) === null ? sv(r.prefix) : IP.toPrefix(r.prefix)}>${sv(r.via)}|${sv(r.iface)}`).sort().join(';') };
}
// everything else must stay identical (positions ignored)
function frozen(d) {
  const c = clone(d);
  delete c.x; delete c.y;
  if (isHostType(c.type)) {
    if (Array.isArray(c.ifaces) && isObj(c.ifaces[0])) { delete c.ifaces[0].ip; delete c.ifaces[0].prefix; delete c.ifaces[0].mask; delete c.ifaces[0].up; }
    delete c.gateway; delete c.dns; delete c.dhcp; delete c.ssid;
    if (isObj(c.firewall)) { delete c.firewall.icmp; if (!Object.keys(c.firewall).length) delete c.firewall; }
  }
  if (c.type === 'router') delete c.routes;
  return stable(c);
}
function stable(x) {
  if (Array.isArray(x)) return '[' + x.map(stable).join(',') + ']';
  if (isObj(x)) return '{' + Object.keys(x).sort().filter(k => x[k] !== undefined).map(k => JSON.stringify(k) + ':' + stable(x[k])).join(',') + '}';
  return JSON.stringify(x === undefined ? null : x);
}
const FIELD_TH = { ip: 'IP address', prefix: 'Subnet mask', gateway: 'Default gateway', dns: 'DNS server', dhcp: 'DHCP', up: 'การเปิด/ปิด Network adapter',
  ssid: 'SSID Wi-Fi', icmp: 'Firewall (ICMP)', routes: 'Static route' };

// compare submitted topo with the mission topo -> { ok, changed:[keys], structural:[msgs] }
function diffTopo(base, sub) {
  const structural = [];
  const changed = [];
  const names = {};
  base.devices.forEach(d => { names[d.id] = d.name; });
  const subDevs = new Map();
  for (const d of sub.devices) {
    if (!isObj(d) || typeof d.id !== 'string') { structural.push('ข้อมูลอุปกรณ์บางรายการไม่ถูกต้อง'); return { changed, structural, names }; }
    if (subDevs.has(d.id)) { structural.push(`มีอุปกรณ์ id ซ้ำ (${d.id})`); return { changed, structural, names }; }
    subDevs.set(d.id, d);
  }
  if (subDevs.size !== base.devices.length || base.devices.some(d => !subDevs.has(d.id))) structural.push('มีการเพิ่มหรือลบอุปกรณ์ (โจทย์ให้แก้การตั้งค่าเท่านั้น)');
  base.devices.forEach(b => {
    const d = subDevs.get(b.id); if (!d) return;
    if (frozen(d) !== frozen(b)) { structural.push(`${b.name}: มีการเปลี่ยนค่าที่ไม่ใช่การตั้งค่าที่แก้ได้ (เช่น ชนิดอุปกรณ์ MAC หรือบริการ)`); return; }
    const fa = isHostType(b.type) ? hostFields(b) : b.type === 'router' ? routerFields(b) : {};
    const fb = isHostType(b.type) ? hostFields(d) : b.type === 'router' ? routerFields(d) : {};
    Object.keys(fa).forEach(k => { if (fa[k] !== fb[k]) changed.push(b.id + '.' + k); });
  });
  const subLinks = new Map();
  for (const l of sub.links) {
    if (!isObj(l) || typeof l.id !== 'string' || subLinks.has(l.id)) { structural.push('ข้อมูลสายสัญญาณไม่ถูกต้อง'); return { changed, structural, names }; }
    subLinks.set(l.id, l);
  }
  if (subLinks.size !== base.links.length || base.links.some(l => !subLinks.has(l.id))) structural.push('มีการเพิ่มหรือลบสายสัญญาณ (โจทย์ให้เสียบ/ถอดสายเดิมเท่านั้น)');
  base.links.forEach(b => {
    const l = subLinks.get(b.id); if (!l) return;
    const fx = x => { const c = clone(x); delete c.up; return stable(c); };
    if (fx(l) !== fx(b)) { structural.push(`สาย ${b.id}: ปลายสายหรือชนิดสายถูกเปลี่ยน`); return; }
    const ua = !(b.up === false || b.up === 'false'), ub = !(l.up === false || l.up === 'false');
    if (ua !== ub) changed.push('link.' + b.id + '.up');
  });
  return { changed, structural, names };
}
function describeKey(k, names) {
  if (k.startsWith('link.')) return `สาย ${k.split('.')[1]} (เสียบ/ถอดสาย)`;
  const i = k.lastIndexOf('.'); const id = k.slice(0, i), f = k.slice(i + 1);
  return `${FIELD_TH[f] || f} ของ ${names[id] || id}`;
}

// ------------------------------------------------------------------ build missions
const PRIVATE = {};
const missions = SCENARIOS.map(sc => {
  const topo = sc.build();
  if (sc.fault) sc.fault(topo);
  sc.topo = topo;
  PRIVATE[sc.id] = sc;
  return {
    id: sc.id, title: sc.title, level: sc.level, desc: sc.desc, max: MAX, hints: sc.hints.slice(),
    start: {
      story: sc.story, symptoms: sc.symptoms.slice(), topo: clone(topo),
      causes: sc.causes.map(([id, text]) => ({ id, text })),
      focusHost: sc.focusHost, hosts: sc.hosts.slice(), successPings: sc.successPings.map(p => p.slice())
    }
  };
});

function runPings(net, list) {
  return list.map(([src, dst]) => { const r = net.ping(src, dst, { count: 1 }); return { src, dst, ok: r.ok, reason: r.reason, reasonText: r.reasonText }; });
}

// ------------------------------------------------------------------ grade
const r2 = x => Math.round(x * 100) / 100;
function grade(missionId, payload) {
  const sc = PRIVATE[missionId];
  if (!sc) return { score: 0, max: MAX, ok: false, feedback: ['ไม่พบภารกิจนี้'], details: {} };
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
    fres.forEach(m => { if (m) feedback.push('จุดที่ผิดยังไม่ได้รับการแก้ไขอย่างถูกต้อง: ' + m); });
    if (fixedN === fres.length && passed === pings.length) feedback.push(`แก้ไขถูกจุดและทดสอบผ่านทั้งหมด ✓ (+${PING_PTS + FAULT_PTS})`);
    else if (passed === pings.length && fixedN < fres.length) feedback.push('ping ผ่านแล้วแต่ยังเป็นการแก้แบบอ้อม (workaround) ไม่ได้แก้ที่ต้นเหตุ');
    score = Math.min(MAX, r2(score));
    return { score, max: MAX, ok: score === MAX, feedback, details };
  } catch (e) {
    return { score: 0, max: MAX, ok: false, feedback: ['ข้อมูลที่ส่งมาไม่ถูกต้อง'], details: {} };
  }
}

module.exports = { id: 'troubleshoot', title: 'ห้องปฏิบัติการแก้ไขปัญหาเครือข่าย', missions, grade, _scenarios: PRIVATE, _diffTopo: diffTopo };

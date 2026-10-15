'use strict';
/*
 * Network Terminal Simulator - server grader (NetLab, SIM-SPEC §2 + §4.4)
 *
 * Each mission is an investigation scenario. `start` (public) = { story, topo, hosts:[{id, os, user}], netstat?, questions:[{id, q}] }.
 * The answer keys live ONLY here and are computed from the scenario topology with the NetSim engine when this module
 * loads (see buildKeys), so they can never drift from what the browser terminal shows.
 *
 * Payload: { answers: { [questionId]: string }, commandsUsed: [string],
 *            commandLog?: [{ h: hostId, c: commandLine }]   (in order; { h:'*', c:'#reset' } = the student reset the network)
 *            mode?: 'guided' | 'challenge' }
 * Score (max 10): 9 points shared by the items (questions + practical tasks) + up to 1 bonus point for having used the
 * appropriate commands (commandsUsed). Answers are normalised: IPs (spaces, leading zeros, trailing /prefix),
 * MACs (case, '-' ':' '.' separators), masks (dotted or /prefix), ports (":3389"), commands (spaces, sudo).
 *
 * Evidence (missions m9+): the server REPLAYS commandLog against the scenario network with NetSim (pings and traceroutes
 * fill ARP caches, `ip route add` / `route add` / `ip link set` change the host, '#reset' restores the start state).
 * A correct answer whose evidence is missing from the replay (e.g. a MAC that never appeared in any `arp -a` / `ip neigh`
 * the student ran) earns half of that item; practical tasks (e.g. "add the default route and prove it with ping") are
 * graded only from the replay. m1-m8 keep their original grading (answers + command bonus) unchanged.
 *
 * Modes: 'guided' (โหมดแนะนำ: step list, exact commands, explanations) is capped at GUIDED_CAP x max = 7/10 inside the
 * same max (max stays 10 for every mission, so stored best scores keep their meaning and the app keeps the best score).
 * 'challenge' (โหมดท้าทาย) can reach 10/10. A payload without `mode` (older clients) is graded as before, i.e. like
 * 'challenge'. The mode is declared by the browser (the UI resets the attempt when switching guided -> challenge);
 * the server cannot see which panel was on screen, so the cap is a learning incentive, not an anti-cheat measure.
 * 6.x: therefore only Guided Labs (mission mode 'guided': m12, m15, m18) publish the literal fix commands in their steps;
 * other missions publish a non-literal goal for each fixing step (`act`), and the command bonus is derived from the
 * replayed commandLog, not from a client-sent list.
 */
const path = require('path');
const NetSim = require(path.join(__dirname, '../../public/js/sim/netsim.js'));
// NL_SYS: accounts, groups, shares, NTFS ACLs and Linux rwx (the same code the browser terminal runs; m12+)
const SYS = require(path.join(__dirname, '../../public/js/sim/terminal.js'));

const MAX = 10;
const BONUS = 1;
const MAX_ANSWER = 120;
const MAX_CMDS = 300;
const GUIDED_CAP = 0.7;

// ------------------------------------------------------------------ topology helpers
const L = (id, a, ap, b, bp, extra) => Object.assign({ id, a: { dev: a, port: ap }, b: { dev: b, port: bp }, medium: 'utp', up: true }, extra || {});
const host = (id, type, name, ip, prefix, gw, dns, mac, extra) => Object.assign({
  id, type, name, ifaces: [{ name: type === 'laptop' ? 'wlan0' : 'eth0', ip, prefix, mac, up: true }], gateway: gw || '', dns: dns || [], dhcp: false
}, extra || {});
const sw = (id, name, x, y) => ({ id, type: 'switch', name, x, y, ports: 24 });
const router = (id, name, ifaces, routes, extra) => Object.assign({ id, type: 'router', name, ifaces, routes: routes || [] }, extra || {});
const inet = (id, ip, prefix, x, y) => ({ id, type: 'internet', name: 'Internet', x, y, ifaces: [{ name: 'wan', ip, prefix, up: true }],
  hosts: { '8.8.8.8': 'dns.google', '1.1.1.1': 'one.one.one.one', '203.0.113.80': 'www.netlab.test' } });
const clone = x => JSON.parse(JSON.stringify(x));

// ------------------------------------------------------------------ scenarios
// q.type: ip | mask | mac | num | port | dhcp | iface | cmd | yesno
// q.key(net, topo, sc) -> expected value (computed with NetSim); q.tip: Thai hint shown when wrong (never the answer)
const SCENARIOS = [
  {
    id: 'm1', level: 'easy', title: 'ตรวจค่า IP ของเครื่องในห้องคอม 2',
    desc: 'นั่งที่ PC05 (Windows) ใช้คำสั่ง ipconfig ตรวจค่าการตั้งค่า IP แล้วตอบคำถาม',
    story: 'ครูประจำห้องคอม 2 ขอให้คุณจดค่าการตั้งค่าเครือข่ายของเครื่อง PC05 ลงในแบบฟอร์มสำรวจ เครื่องนี้ตั้งค่า IP แบบ Static',
    hints: ['พิมพ์ ipconfig เพื่อดู IPv4 Address, Subnet Mask และ Default Gateway', 'DNS Servers ไม่แสดงใน ipconfig ธรรมดา ต้องใช้ ipconfig /all'],
    hosts: [{ id: 'pc05', os: 'windows', user: 'student' }],
    topo: {
      devices: [
        host('pc05', 'pc', 'PC05', '192.168.2.25', 24, '192.168.2.1', ['192.168.2.5', '8.8.8.8'], '3C-52-82-1A-07-25', { x: 90, y: 240 }),
        host('pc06', 'pc', 'PC06', '192.168.2.26', 24, '192.168.2.1', ['192.168.2.5', '8.8.8.8'], '3C-52-82-1A-07-26', { x: 200, y: 320 }),
        host('srv', 'server', 'SRV-ROOM2', '192.168.2.5', 24, '192.168.2.1', ['8.8.8.8'], '00-15-5D-02-00-05', { x: 340, y: 320,
          services: { dns: { records: { 'dns.room2.local': '192.168.2.5', 'srv.room2.local': '192.168.2.5' } }, file: true } }),
        sw('sw1', 'SW-ROOM2', 220, 200),
        router('r1', 'R-ROOM2', [{ name: 'g0/0', ip: '192.168.2.1', prefix: 24, mac: '00-1E-7A-55-02-01' }, { name: 'g0/1', ip: '203.0.113.10', prefix: 30, mac: '00-1E-7A-55-02-02' }],
          [{ net: '0.0.0.0', prefix: 0, via: '203.0.113.9' }], { x: 400, y: 200 }),
        inet('net', '203.0.113.9', 30, 580, 200)
      ],
      links: [L('l1', 'pc05', 'eth0', 'sw1', 'p5'), L('l2', 'pc06', 'eth0', 'sw1', 'p6'), L('l3', 'srv', 'eth0', 'sw1', 'p1'),
        L('l4', 'r1', 'g0/0', 'sw1', 'p24'), L('l5', 'r1', 'g0/1', 'net', 'wan', { medium: 'fiber' })]
    },
    questions: [
      { id: 'ip', q: 'IPv4 Address ของเครื่อง PC05 คืออะไร', type: 'ip', key: n => n.config('pc05').ip, tip: 'ดูบรรทัด IPv4 Address ในผลของ ipconfig' },
      { id: 'mask', q: 'Subnet Mask ของเครื่องนี้คืออะไร', type: 'mask', key: n => n.config('pc05').mask, tip: 'ดูบรรทัด Subnet Mask' },
      { id: 'gw', q: 'Default Gateway ของเครื่องนี้คือ IP ใด', type: 'ip', key: n => n.config('pc05').gateway, tip: 'ดูบรรทัด Default Gateway' },
      { id: 'dns', q: 'DNS Server ตัวแรก (Preferred) ของเครื่องนี้คือ IP ใด', type: 'ip', key: n => n.config('pc05').dns[0], tip: 'DNS Servers แสดงเฉพาะใน ipconfig /all (ตัวบนสุดคือตัวแรก)' }
    ],
    good: [{ re: /^ipconfig\s+\/all\b/i, label: 'ipconfig /all' }],
    steps: [
      { cmd: 'ipconfig', match: '^ipconfig\\s*$', say: 'พิมพ์ ipconfig แล้วกด Enter',
        why: 'ipconfig แบบไม่มีตัวเลือกแสดงค่าพื้นฐาน 3 ค่าที่ต้องจด: IPv4 Address, Subnet Mask, Default Gateway',
        explain: 'บรรทัดที่ไฮไลต์: IPv4 Address = IP ของเครื่องนี้ (ข้อ 1), Subnet Mask บอกขนาดวงเครือข่าย (ข้อ 2), Default Gateway = Router ที่ใช้ออกนอกวง (ข้อ 3) สังเกตว่าไม่มีบรรทัด DNS', mark: 'IPv4 Address|Subnet Mask|Default Gateway' },
      { cmd: 'ipconfig /all', match: '^ipconfig\\s+/all\\b', say: 'พิมพ์ ipconfig /all',
        why: 'ค่า DNS Server, MAC และ DHCP แสดงเฉพาะในแบบเต็ม (/all)',
        explain: 'DNS Servers บรรทัดแรกคือ DNS ตัวหลัก (Preferred) ใช้ตอบข้อ 4 บรรทัดที่ย่อหน้าต่อลงมาคือ DNS สำรอง', mark: 'DNS Servers|^\\s{30,}\\d' }
    ]
  },
  {
    id: 'm2', level: 'easy', title: 'เครื่องนี้ได้ IP จาก DHCP หรือไม่',
    desc: 'นั่งที่ PC12 (Windows) ตรวจว่าเครื่องรับ IP แบบ DHCP หรือ Static และ DHCP Server คือเครื่องใด',
    story: 'ห้องปฏิบัติการ 5 ใช้ Windows Server ชื่อ SRV-DC01 แจก IP อัตโนมัติ (DHCP) ให้ทุกเครื่อง คุณนั่งที่ PC12 ตรวจสอบว่าเครื่องได้รับ IP จาก DHCP จริงหรือไม่',
    hints: ['ipconfig /all จะแสดง DHCP Enabled, DHCP Server และเวลา Lease', 'MAC address ของการ์ดแลนคือ Physical Address (หรือใช้ getmac)'],
    hosts: [{ id: 'pc12', os: 'windows', user: 'student' }],
    topo: {
      devices: [
        host('pc03', 'pc', 'PC03', '', 24, '', [], 'D4-BE-D9-11-05-03', { dhcp: true, x: 90, y: 330 }),
        host('pc12', 'pc', 'PC12', '', 24, '', [], 'D4-BE-D9-11-05-12', { dhcp: true, x: 200, y: 340 }),
        host('dc01', 'server', 'SRV-DC01', '192.168.5.10', 24, '192.168.5.1', ['127.0.0.1'], '00-15-5D-05-00-10', { x: 360, y: 340,
          services: { dhcp: { start: '192.168.5.100', end: '192.168.5.199', prefix: 24, gateway: '192.168.5.1', dns: ['192.168.5.10', '8.8.8.8'] },
            dns: { records: { 'dc01.lab5.local': '192.168.5.10', 'srv.lab5.local': '192.168.5.10' } } } }),
        sw('sw1', 'SW-LAB5', 230, 210),
        router('r1', 'R-LAB5', [{ name: 'g0/0', ip: '192.168.5.1', prefix: 24, mac: '00-1E-7A-55-05-01' }, { name: 'g0/1', ip: '203.0.113.14', prefix: 30 }],
          [{ net: '0.0.0.0', prefix: 0, via: '203.0.113.13' }], { x: 420, y: 210 }),
        inet('net', '203.0.113.13', 30, 600, 210)
      ],
      links: [L('l1', 'pc03', 'eth0', 'sw1', 'p3'), L('l2', 'pc12', 'eth0', 'sw1', 'p12'), L('l3', 'dc01', 'eth0', 'sw1', 'p1'),
        L('l4', 'r1', 'g0/0', 'sw1', 'p24'), L('l5', 'r1', 'g0/1', 'net', 'wan', { medium: 'fiber' })]
    },
    questions: [
      { id: 'mode', q: 'เครื่อง PC12 ได้ IP แบบใด (ตอบ DHCP หรือ Static)', type: 'dhcp', key: n => n.config('pc12').dhcp ? 'dhcp' : 'static', tip: 'ดูบรรทัด DHCP Enabled ใน ipconfig /all' },
      { id: 'ip', q: 'IPv4 Address ที่ PC12 ได้รับคืออะไร', type: 'ip', key: n => n.config('pc12').ip, tip: 'ดูบรรทัด IPv4 Address (ไม่ต้องพิมพ์คำว่า Preferred)' },
      { id: 'dhcpsrv', q: 'DHCP Server ที่แจก IP ให้เครื่องนี้คือ IP ใด', type: 'ip', key: n => leaseServerIp(n, 'pc12'), tip: 'ดูบรรทัด DHCP Server ใน ipconfig /all' },
      { id: 'mac', q: 'MAC address (Physical Address) ของการ์ดแลนเครื่องนี้คืออะไร', type: 'mac', key: n => n.config('pc12').mac, tip: 'ดูบรรทัด Physical Address หรือใช้คำสั่ง getmac' }
    ],
    good: [{ re: /^ipconfig\s+\/all\b/i, label: 'ipconfig /all' }],
    steps: [
      { cmd: 'ipconfig /all', match: '^ipconfig\\s+/all\\b', say: 'พิมพ์ ipconfig /all',
        why: 'ต้องดูว่า DHCP เปิดอยู่หรือไม่ และใครเป็นผู้แจก IP ข้อมูลนี้มีเฉพาะในแบบเต็ม',
        explain: 'DHCP Enabled = Yes แปลว่ารับ IP อัตโนมัติ (ข้อ 1) IPv4 Address คือ IP ที่ได้รับ (ข้อ 2) DHCP Server คือเครื่องที่แจก (ข้อ 3) Physical Address คือ MAC ของการ์ดแลน (ข้อ 4) และมี Lease Obtained/Expires บอกอายุการเช่า IP',
        mark: 'DHCP Enabled|IPv4 Address|DHCP Server|Physical Address|Lease' },
      { cmd: 'getmac', match: '^getmac\\b', say: '(ทางเลือก) พิมพ์ getmac เพื่อตรวจ MAC อีกครั้ง',
        why: 'getmac แสดงเฉพาะ MAC ของแต่ละการ์ด ใช้ยืนยันคำตอบข้อ 4',
        explain: 'คอลัมน์ Physical Address คือ MAC 48 บิต เขียนเป็นเลขฐานสิบหก 6 คู่ ต้องตรงกับ Physical Address ใน ipconfig /all', mark: '^[0-9A-F]{2}-' }
    ]
  },
  {
    id: 'm3', level: 'medium', title: 'ARP กับ TTL: ใครตอบ ping ของเรา',
    desc: 'นั่งที่ PC-ACC07 (Windows) ใช้ ping และ arp -a หา MAC ของ Gateway และอ่านค่า TTL',
    story: 'ฝ่ายบัญชีแจ้งว่ามีอุปกรณ์แปลกปลอมในเครือข่าย ครูให้คุณจด MAC address ของ Default Gateway ตัวจริงไว้เป็นหลักฐาน และสังเกตค่า TTL ของอุปกรณ์แต่ละชนิด (Windows / Linux / อินเทอร์เน็ต)',
    hints: ['ตาราง ARP จะมีข้อมูลก็ต่อเมื่อเครื่องเคยติดต่อ IP นั้นแล้ว: ping gateway ก่อน แล้วค่อย arp -a',
      'ค่า TTL ดูได้จากบรรทัด Reply from ... TTL=xx (เครื่อง Linux/Printer เริ่มที่ 64, Windows 128)'],
    hosts: [{ id: 'acc07', os: 'windows', user: 'somchai' }],
    topo: {
      devices: [
        host('acc07', 'pc', 'PC-ACC07', '10.10.1.37', 24, '10.10.1.1', ['10.10.1.1'], '70-85-C2-4A-10-37', { x: 90, y: 300 }),
        host('prn1', 'printer', 'PRN-ACC', '10.10.1.50', 24, '10.10.1.1', [], '00-80-77-3D-21-50', { x: 330, y: 330 }),
        sw('sw1', 'SW-ACC', 220, 200),
        router('r1', 'GW-ACC', [{ name: 'g0/0', ip: '10.10.1.1', prefix: 24, mac: '00-1E-7A-A1-B2-C3' }, { name: 'g0/1', ip: '203.0.113.18', prefix: 30 }],
          [{ net: '0.0.0.0', prefix: 0, via: '203.0.113.17' }], { x: 400, y: 200,
            services: { dns: { records: { 'gw.acc.local': '10.10.1.1' } } } }),
        inet('net', '203.0.113.17', 30, 580, 200)
      ],
      links: [L('l1', 'acc07', 'eth0', 'sw1', 'p7'), L('l2', 'prn1', 'eth0', 'sw1', 'p20'), L('l3', 'r1', 'g0/0', 'sw1', 'p24'),
        L('l4', 'r1', 'g0/1', 'net', 'wan', { medium: 'fiber' })]
    },
    questions: [
      { id: 'gwmac', q: 'MAC address ของ Default Gateway (ดูจาก arp -a หลัง ping gateway)', type: 'mac',
        key: n => { const g = n.config('acc07').gateway; n.ping('acc07', g); const e = n.arp('acc07').find(x => x.ip === g); return e && e.mac; },
        tip: 'ping gateway ก่อน แล้วดู Physical Address ของ IP gateway ใน arp -a' },
      { id: 'prnmac', q: 'MAC address ของเครื่องพิมพ์ 10.10.1.50', type: 'mac',
        key: n => { n.ping('acc07', '10.10.1.50'); const e = n.arp('acc07').find(x => x.ip === '10.10.1.50'); return e && e.mac; },
        tip: 'ping 10.10.1.50 แล้วดู arp -a' },
      { id: 'prnttl', q: 'ค่า TTL ที่ได้รับเมื่อ ping เครื่องพิมพ์ 10.10.1.50', type: 'num', key: n => n.ping('acc07', '10.10.1.50').ttl,
        tip: 'ดูตัวเลขหลัง TTL= ในบรรทัด Reply from 10.10.1.50' },
      { id: 'netttl', q: 'ค่า TTL ที่ได้รับเมื่อ ping 8.8.8.8', type: 'num', key: n => n.ping('acc07', '8.8.8.8').ttl,
        tip: 'ping 8.8.8.8 แล้วดูค่า TTL (ค่าจะลดลง 1 ทุกครั้งที่ผ่าน Router)' }
    ],
    good: [{ re: /^arp\s+-a\b/i, label: 'arp -a' }, { re: /^ping\b/i, label: 'ping' }],
    steps: [
      { cmd: 'ipconfig', match: '^ipconfig\\b', say: 'พิมพ์ ipconfig เพื่อหา IP ของ Default Gateway',
        why: 'ต้องรู้ IP ของ gateway ก่อนจึงจะ ping และค้นหา MAC ของมันในตาราง ARP ได้',
        explain: 'Default Gateway คือ IP ของ Router ในวงนี้ จำไว้ใช้ในขั้นต่อไป', mark: 'Default Gateway' },
      { cmd: 'ping ', fill: true, match: '^ping\\s+(-n\\s+\\d+\\s+)?10\\.10\\.1\\.1\\s*$', say: 'พิมพ์ ping ตามด้วย IP ของ Default Gateway',
        why: 'การ ping ทำให้เครื่องต้องส่ง ARP ถามหา MAC ของ gateway ก่อน ตาราง ARP จึงมีข้อมูล',
        explain: 'Reply from ... แปลว่า gateway ตอบกลับ TTL=255 เพราะ Router ตั้งค่า TTL เริ่มต้น 255', mark: 'Reply from|TTL=' },
      { cmd: 'arp -a', match: '^arp\\s+-a\\b', say: 'พิมพ์ arp -a',
        why: 'ตาราง ARP จับคู่ IP กับ MAC ของเครื่องที่เพิ่งติดต่อในวงเดียวกัน',
        explain: 'แถวชนิด dynamic คือเครื่องที่เรียนรู้มาจากการติดต่อจริง (ข้อ 1: แถวของ IP gateway) แถว static เป็นที่อยู่ broadcast/multicast ที่ระบบกำหนดไว้', mark: 'dynamic' },
      { cmd: 'ping 10.10.1.50', match: '^ping\\s+(-n\\s+\\d+\\s+)?10\\.10\\.1\\.50\\b', say: 'พิมพ์ ping 10.10.1.50 (เครื่องพิมพ์)',
        why: 'ดูค่า TTL ของเครื่องพิมพ์ และให้ MAC ของเครื่องพิมพ์เข้าไปอยู่ในตาราง ARP',
        explain: 'TTL=64 แสดงว่าเป็นอุปกรณ์ที่ใช้ Linux/ระบบฝังตัว (Windows เริ่ม 128) อยู่วงเดียวกันจึงไม่ลดลง (ข้อ 3) จากนั้นใช้ arp -a อีกครั้งเพื่อดู MAC (ข้อ 2)', mark: 'TTL=' },
      { cmd: 'ping 8.8.8.8', match: '^ping\\s+(-n\\s+\\d+\\s+)?8\\.8\\.8\\.8\\b', say: 'พิมพ์ ping 8.8.8.8',
        why: 'เปรียบเทียบ TTL ของปลายทางบนอินเทอร์เน็ตซึ่งผ่าน Router หลายตัว',
        explain: 'TTL ที่ได้ = TTL เริ่มต้นของปลายทาง ลบจำนวน Router ที่ผ่าน (ข้อ 4)', mark: 'TTL=' }
    ]
  },
  {
    id: 'm4', level: 'medium', title: 'สำรวจ Linux server srv-lab09',
    desc: 'ล็อกอินที่ srv-lab09 (Ubuntu) ใช้ ip a, ip route, /etc/resolv.conf และ nslookup/dig ตอบคำถาม',
    story: 'คุณเป็นผู้ช่วยดูแลระบบของแผนกคอมพิวเตอร์ ได้รับมอบหมายให้ตรวจ server ใหม่ srv-lab09 ที่ติดตั้ง Ubuntu Server ว่าตั้งค่าเครือข่ายไว้อย่างไร (ล็อกอินเป็นผู้ใช้ student)',
    hints: ['ip a (หรือ ip addr) แสดง IP แบบ 172.16.9.20/26 คือ IP/prefix', 'ip route บรรทัด default via ... คือ Default gateway',
      'DNS server ของ Linux ดูจาก cat /etc/resolv.conf (บรรทัด nameserver)', 'nslookup ชื่อ หรือ dig +short ชื่อ เพื่อแปลงชื่อเป็น IP'],
    hosts: [{ id: 'lab09', os: 'linux', user: 'student' }],
    topo: {
      devices: [
        host('lab09', 'server', 'srv-lab09', '172.16.9.20', 26, '172.16.9.1', ['172.16.9.53'], '52-54-00-9A-09-20', { os: 'linux', x: 90, y: 320 }),
        host('ns1', 'server', 'ns1', '172.16.9.53', 26, '172.16.9.1', ['8.8.8.8'], '52-54-00-9A-09-53', { os: 'linux', x: 250, y: 340,
          services: { dns: { records: { 'ns1.lab.local': '172.16.9.53', 'srv.lab.local': '172.16.9.20', 'moodle.lab.local': '172.16.9.30' } } } }),
        host('moodle', 'server', 'moodle', '172.16.9.30', 26, '172.16.9.1', ['172.16.9.53'], '52-54-00-9A-09-30', { os: 'linux', x: 400, y: 340, services: { web: true } }),
        sw('sw1', 'SW-SRV', 240, 210),
        router('r1', 'R-CORE', [{ name: 'g0/0', ip: '172.16.9.1', prefix: 26, mac: '00-1E-7A-17-09-01' }, { name: 'g0/1', ip: '203.0.113.22', prefix: 30 }],
          [{ net: '0.0.0.0', prefix: 0, via: '203.0.113.21' }], { x: 430, y: 200 }),
        inet('net', '203.0.113.21', 30, 600, 200)
      ],
      links: [L('l1', 'lab09', 'eth0', 'sw1', 'p9'), L('l2', 'ns1', 'eth0', 'sw1', 'p2'), L('l3', 'moodle', 'eth0', 'sw1', 'p3'),
        L('l4', 'r1', 'g0/0', 'sw1', 'p24'), L('l5', 'r1', 'g0/1', 'net', 'wan', { medium: 'fiber' })]
    },
    questions: [
      { id: 'ip', q: 'IP address ของ eth0 (ไม่ต้องใส่ /prefix)', type: 'ip', key: n => n.config('lab09').ip, tip: 'ดูบรรทัด inet ของ eth0 ใน ip a' },
      { id: 'prefix', q: 'Prefix length ของ eth0 (เช่น /24) หรือ Subnet mask', type: 'mask', key: n => n.config('lab09').mask, tip: 'ตัวเลขหลังเครื่องหมาย / ในบรรทัด inet' },
      { id: 'gw', q: 'Default gateway ของ server นี้', type: 'ip', key: n => (n.routes('lab09').find(r => r.prefix === 0) || {}).via, tip: 'ใช้ ip route ดูบรรทัด default via' },
      { id: 'dns', q: 'DNS server (nameserver) ที่ server นี้ใช้', type: 'ip', key: n => n.config('lab09').dns[0], tip: 'cat /etc/resolv.conf' },
      { id: 'moodle', q: 'ชื่อ moodle.lab.local แปลงเป็น IP ใด', type: 'ip', key: n => n.nslookup('lab09', 'moodle.lab.local').ip, tip: 'ใช้ nslookup moodle.lab.local หรือ dig +short moodle.lab.local' }
    ],
    good: [{ re: /^(sudo\s+)?ip\s+(-\d\s+)?a(ddr?)?\b/i, label: 'ip a' }, { re: /^(sudo\s+)?ip\s+r(oute?)?\b/i, label: 'ip route' },
      { re: /^(sudo\s+)?(nslookup|dig|cat\s+\/etc\/resolv\.conf)\b/i, label: 'nslookup / dig / cat /etc/resolv.conf' }],
    steps: [
      { cmd: 'ip a', match: '^(sudo\\s+)?ip\\s+(-\\S+\\s+)*a(ddr?|ddress)?(\\s+show)?\\s*$', say: 'พิมพ์ ip a',
        why: 'ip a (ip address) คือคำสั่งดู IP บน Linux สมัยใหม่ (แทน ifconfig ในอดีต)',
        explain: 'บรรทัด inet ของ eth0 อยู่ในรูป IP/prefix: ส่วนหน้า / คือ IP (ข้อ 1) ตัวเลขหลัง / คือ prefix length (ข้อ 2) ส่วน state UP แปลว่า interface ทำงาน', mark: 'inet .*eth0|state UP' },
      { cmd: 'ip route', match: '^(sudo\\s+)?ip\\s+r(o|ou|out|oute)?(\\s+show)?\\s*$', say: 'พิมพ์ ip route',
        why: 'Linux แสดง Default gateway ในตารางเส้นทาง ไม่ได้อยู่ใน ip a',
        explain: 'บรรทัด default via ... คือ Default gateway (ข้อ 3) บรรทัดที่มี proto kernel scope link คือวงเครือข่ายที่ต่อตรง', mark: '^default' },
      { cmd: 'cat /etc/resolv.conf', match: '^cat\\s+/etc/resolv\\.conf', say: 'พิมพ์ cat /etc/resolv.conf',
        why: 'ไฟล์นี้เก็บรายชื่อ DNS server ที่เครื่อง Linux ใช้',
        explain: 'บรรทัด nameserver คือ IP ของ DNS server (ข้อ 4)', mark: '^nameserver' },
      { cmd: 'nslookup moodle.lab.local', match: '^(nslookup|dig|host)\\b.*moodle\\.lab\\.local', say: 'พิมพ์ nslookup moodle.lab.local',
        why: 'ถาม DNS server ว่าชื่อนี้คือ IP ใด',
        explain: 'Server/Address ส่วนบนคือ DNS server ที่ตอบ ส่วน Name/Address ด้านล่างคือคำตอบ (ข้อ 5)', mark: '^Name:|^Address: ' }
    ]
  },
  {
    id: 'm5', level: 'medium', title: 'เส้นทางออกอินเทอร์เน็ตของอาคาร B',
    desc: 'นั่งที่ PC-B204 (Windows) ใช้ tracert และ nslookup ตรวจเส้นทางไป 8.8.8.8',
    story: 'อาคาร B ต่ออินเทอร์เน็ตผ่าน Router 2 ตัว (Router ชั้น 2 และ Core router ของวิทยาลัย) ครูให้คุณตรวจว่าแพ็กเก็ตจาก PC-B204 วิ่งผ่าน Router ตัวใดบ้างก่อนถึง 8.8.8.8',
    hints: ['tracert 8.8.8.8 แสดงทีละ hop: บรรทัดที่ 1 คือ Router ตัวแรก (Default gateway)', 'nslookup ชื่อเว็บ จะบอก IP ของชื่อนั้น (ดูบรรทัด Address ใต้ Name)'],
    hosts: [{ id: 'b204', os: 'windows', user: 'student' }],
    topo: {
      devices: [
        host('b204', 'pc', 'PC-B204', '10.20.4.37', 24, '10.20.4.1', ['10.20.0.53'], '18-C0-4D-20-04-37', { x: 80, y: 260 }),
        sw('sw1', 'SW-B2', 200, 160),
        router('r1', 'R-B2', [{ name: 'g0/0', ip: '10.20.4.1', prefix: 24, mac: '00-1E-7A-20-04-01' }, { name: 'g0/1', ip: '10.20.255.2', prefix: 30 }],
          [{ net: '0.0.0.0', prefix: 0, via: '10.20.255.1' }], { x: 340, y: 160 }),
        router('r2', 'R-CORE', [{ name: 'g0/0', ip: '10.20.255.1', prefix: 30 }, { name: 'g0/1', ip: '203.0.113.6', prefix: 30 }, { name: 'g0/2', ip: '10.20.0.1', prefix: 24 }],
          [{ net: '10.20.4.0', prefix: 24, via: '10.20.255.2' }, { net: '0.0.0.0', prefix: 0, via: '203.0.113.5' }], { x: 500, y: 160 }),
        host('dns', 'server', 'DNS-CORE', '10.20.0.53', 24, '10.20.0.1', ['8.8.8.8'], '52-54-00-20-00-53', { os: 'linux', x: 500, y: 320,
          services: { dns: { records: { 'dns.college.local': '10.20.0.53', 'reg.college.local': '10.20.0.80' } } } }),
        inet('net', '203.0.113.5', 30, 680, 160)
      ],
      links: [L('l1', 'b204', 'eth0', 'sw1', 'p4'), L('l2', 'r1', 'g0/0', 'sw1', 'p24'), L('l3', 'r1', 'g0/1', 'r2', 'g0/0', { medium: 'fiber' }),
        L('l4', 'r2', 'g0/1', 'net', 'wan', { medium: 'fiber' }), L('l5', 'r2', 'g0/2', 'dns', 'eth0')]
    },
    questions: [
      { id: 'hop1', q: 'Hop ที่ 1 ของเส้นทางไปยัง 8.8.8.8 คือ IP ใด', type: 'ip', key: n => hopIp(n, 'b204', '8.8.8.8', 1), tip: 'ใช้ tracert 8.8.8.8 แล้วดูบรรทัดหมายเลข 1' },
      { id: 'hop2', q: 'Hop ที่ 2 ของเส้นทางไปยัง 8.8.8.8 คือ IP ใด', type: 'ip', key: n => hopIp(n, 'b204', '8.8.8.8', 2), tip: 'ใช้ tracert 8.8.8.8 แล้วดูบรรทัดหมายเลข 2' },
      { id: 'hops', q: 'ต้องผ่านทั้งหมดกี่ hop จึงถึง 8.8.8.8 (นับรวม hop สุดท้าย)', type: 'num', key: n => n.traceroute('b204', '8.8.8.8').hops.length, tip: 'นับจำนวนบรรทัด hop ของ tracert จนถึงบรรทัดที่เป็น 8.8.8.8' },
      { id: 'www', q: 'www.netlab.test มี IP address ใด', type: 'ip', key: n => n.nslookup('b204', 'www.netlab.test').ip, tip: 'ใช้ nslookup www.netlab.test ดูบรรทัด Address ใต้ Name' }
    ],
    good: [{ re: /^tracert\b/i, label: 'tracert' }, { re: /^nslookup\b/i, label: 'nslookup' }],
    steps: [
      { cmd: 'tracert 8.8.8.8', match: '^tracert\\s+(-\\S+\\s+(\\d+\\s+)?)*8\\.8\\.8\\.8\\b', say: 'พิมพ์ tracert 8.8.8.8',
        why: 'tracert ส่งแพ็กเก็ตโดยเพิ่ม TTL ทีละ 1 Router แต่ละตัวที่ทำ TTL หมดจะตอบกลับ จึงเห็นเส้นทางทีละ hop',
        explain: 'แต่ละบรรทัดที่มีหมายเลขคือ 1 hop: hop 1 คือ Default gateway (ข้อ 1) hop 2 คือ Router ตัวถัดไป (ข้อ 2) นับบรรทัดจนถึง 8.8.8.8 (ข้อ 3) เวลา 3 ช่องคือเวลาตอบกลับ 3 ครั้ง', mark: '^\\s+\\d+\\s' },
      { cmd: 'nslookup www.netlab.test', match: '^nslookup\\s+www\\.netlab\\.test', say: 'พิมพ์ nslookup www.netlab.test',
        why: 'แปลงชื่อเว็บเป็น IP ผ่าน DNS server ขององค์กร',
        explain: 'Non-authoritative answer แปลว่า DNS ขององค์กรไปถามต่อจากที่อื่น บรรทัด Address ใต้ Name คือ IP ของชื่อนั้น (ข้อ 4)', mark: '^Name:|^Address:|Non-authoritative' }
    ]
  },
  {
    id: 'm6', level: 'hard', title: 'netstat: ใครกำลัง Remote Desktop เข้ามา',
    desc: 'สลับระหว่าง SRV-APP01 และ PC-HR03 (Windows) ใช้ netstat -an ดูพอร์ตที่เปิดรอและการเชื่อมต่อ',
    story: 'ผู้ดูแลระบบสงสัยว่ามีคนเข้าใช้ server SRV-APP01 ผ่าน Remote Desktop (RDP) อยู่ คุณเข้าได้ทั้ง SRV-APP01 และเครื่อง PC-HR03 ของฝ่ายบุคคล ให้ใช้ netstat -an ตรวจว่าพอร์ตใดเปิดรอ (LISTENING) และใครเชื่อมต่ออยู่ (ESTABLISHED)',
    hints: ['netstat -an: Local Address คือฝั่งเครื่องเรา, Foreign Address คืออีกฝั่ง', 'พอร์ตมาตรฐาน: RDP 3389, HTTP 80, HTTPS 443, SMB 445, SQL Server 1433',
      'สลับเครื่องได้จากปุ่มเลือกเครื่องเหนือ terminal'],
    hosts: [{ id: 'app01', os: 'windows', user: 'Administrator' }, { id: 'hr03', os: 'windows', user: 'hr' }],
    topo: {
      devices: [
        host('app01', 'server', 'SRV-APP01', '192.168.30.10', 24, '192.168.30.1', ['192.168.30.10'], '00-15-5D-30-00-10', { x: 380, y: 320,
          services: { web: true, dns: { records: { 'app01.office.local': '192.168.30.10', 'hr03.office.local': '192.168.30.45' } } } }),
        host('hr03', 'pc', 'PC-HR03', '192.168.30.45', 24, '192.168.30.1', ['192.168.30.10'], 'E4-54-E8-30-00-45', { x: 90, y: 320, firewall: { icmp: false } }),
        sw('sw1', 'SW-OFFICE', 230, 200),
        router('r1', 'R-OFFICE', [{ name: 'g0/0', ip: '192.168.30.1', prefix: 24 }], [], { x: 420, y: 160 })
      ],
      links: [L('l1', 'app01', 'eth0', 'sw1', 'p1'), L('l2', 'hr03', 'eth0', 'sw1', 'p13'), L('l3', 'r1', 'g0/0', 'sw1', 'p24')]
    },
    netstat: {
      app01: [
        ['TCP', '0.0.0.0:80', '0.0.0.0:0', 'LISTENING'], ['TCP', '0.0.0.0:135', '0.0.0.0:0', 'LISTENING'],
        ['TCP', '0.0.0.0:443', '0.0.0.0:0', 'LISTENING'], ['TCP', '0.0.0.0:445', '0.0.0.0:0', 'LISTENING'],
        ['TCP', '0.0.0.0:1433', '0.0.0.0:0', 'LISTENING'], ['TCP', '0.0.0.0:3389', '0.0.0.0:0', 'LISTENING'],
        ['TCP', '0.0.0.0:49664', '0.0.0.0:0', 'LISTENING'], ['TCP', '0.0.0.0:49665', '0.0.0.0:0', 'LISTENING'],
        ['TCP', '{ip}:139', '0.0.0.0:0', 'LISTENING'],
        ['TCP', '{ip}:445', '192.168.30.62:50112', 'ESTABLISHED'],
        ['TCP', '{ip}:3389', '192.168.30.45:51744', 'ESTABLISHED'],
        ['TCP', '{ip}:49712', '192.168.30.1:443', 'TIME_WAIT'],
        ['UDP', '0.0.0.0:123', '*:*', ''], ['UDP', '0.0.0.0:500', '*:*', ''], ['UDP', '{ip}:137', '*:*', '']
      ],
      hr03: [
        ['TCP', '0.0.0.0:135', '0.0.0.0:0', 'LISTENING'], ['TCP', '0.0.0.0:445', '0.0.0.0:0', 'LISTENING'],
        ['TCP', '0.0.0.0:5040', '0.0.0.0:0', 'LISTENING'], ['TCP', '0.0.0.0:49664', '0.0.0.0:0', 'LISTENING'],
        ['TCP', '{ip}:139', '0.0.0.0:0', 'LISTENING'],
        ['TCP', '{ip}:51744', '192.168.30.10:3389', 'ESTABLISHED'],
        ['TCP', '{ip}:51790', '192.168.30.10:443', 'ESTABLISHED'],
        ['UDP', '0.0.0.0:5353', '*:*', ''], ['UDP', '{ip}:137', '*:*', '']
      ]
    },
    questions: [
      { id: 'rdp', q: 'บน SRV-APP01 พอร์ต (local port) ใดที่ LISTENING รอรับ Remote Desktop (RDP)', type: 'port',
        key: (n, t, sc) => portOf(sc.netstat.app01.find(r => r[3] === 'LISTENING' && /:3389$/.test(r[1]))[1]), tip: 'RDP ใช้พอร์ตมาตรฐานของ Remote Desktop ดูในคอลัมน์ Local Address ที่สถานะ LISTENING' },
      { id: 'who', q: 'IP ของเครื่องที่กำลังเชื่อมต่อ RDP เข้ามาที่ SRV-APP01 (ESTABLISHED)', type: 'ip',
        key: (n, t, sc) => sc.netstat.app01.find(r => r[3] === 'ESTABLISHED' && /:3389$/.test(r[1]))[2].split(':')[0], tip: 'หาแถว ESTABLISHED ที่ Local Address ลงท้ายด้วยพอร์ต RDP แล้วดู Foreign Address' },
      { id: 'sql', q: 'SRV-APP01 เปิดพอร์ตใดรอรับ Microsoft SQL Server', type: 'port',
        key: (n, t, sc) => portOf(sc.netstat.app01.find(r => r[3] === 'LISTENING' && /:1433$/.test(r[1]))[1]), tip: 'SQL Server ใช้พอร์ตมาตรฐาน 4 หลัก ดูรายการ LISTENING' },
      { id: 'srcport', q: 'บน PC-HR03 พอร์ตต้นทาง (local port) ของการเชื่อมต่อ RDP ไปยัง SRV-APP01 คือพอร์ตใด', type: 'port',
        key: (n, t, sc) => portOf(sc.netstat.hr03.find(r => r[3] === 'ESTABLISHED' && /:3389$/.test(r[2]))[1]), tip: 'สลับไป PC-HR03 แล้ว netstat -an หาแถวที่ Foreign Address ลงท้ายด้วย :3389' }
    ],
    good: [{ re: /^netstat\b/i, label: 'netstat -an' }],
    steps: [
      { host: 'app01', cmd: 'netstat -an', match: '^netstat\\s+-\\w*a\\w*', say: 'บน SRV-APP01 พิมพ์ netstat -an',
        why: '-a แสดงทั้งพอร์ตที่รอรับ (LISTENING) และการเชื่อมต่อ, -n แสดงเป็นตัวเลข ไม่แปลงเป็นชื่อ',
        explain: 'แถว LISTENING ที่ Local Address เป็น 0.0.0.0:พอร์ต คือบริการที่เปิดรอทุก IP (ข้อ 1, 3) แถว ESTABLISHED บอกว่าใครเชื่อมต่ออยู่: Foreign Address คือ IP:พอร์ตของอีกฝั่ง (ข้อ 2)', mark: ':3389\\b|:1433\\b' },
      { host: 'hr03', cmd: 'netstat -an', match: '^netstat\\s+-\\w*a\\w*', say: 'กดปุ่มเลือกเครื่อง PC-HR03 แล้วพิมพ์ netstat -an',
        why: 'ดูการเชื่อมต่อเดียวกันจากฝั่ง client',
        explain: 'ฝั่ง client ใช้พอร์ตต้นทางชั่วคราว (ephemeral port เลขสูง) ต่อไปยังพอร์ต 3389 ของ server: Local Address คือพอร์ตต้นทาง (ข้อ 4)', mark: ':3389\\b' }
    ]
  },
  {
    id: 'm7', level: 'hard', title: 'Linux: interface ดาวน์ ต้องเปิดเอง',
    desc: 'ล็อกอิน root ที่ ws-lab07 (Linux, DHCP) หา interface ที่ปิดอยู่ เปิดใช้งาน แล้วตรวจ IP ที่ได้',
    story: 'เครื่อง ws-lab07 (Ubuntu Desktop ตั้งรับ IP แบบ DHCP) ใช้เน็ตไม่ได้ตั้งแต่เช้า สายแลนเสียบอยู่และไฟที่สวิตช์ไม่ติด คุณล็อกอินเป็น root แล้ว ให้หาว่า interface ใดถูกปิดอยู่ เปิดมันด้วยคำสั่ง แล้วตรวจค่าที่ได้จาก DHCP',
    hints: ['ip a: interface ที่ถูกปิดจะไม่มีคำว่า UP ใน <...> และแสดง state DOWN', 'คำสั่งเปิด interface: ip link set <ชื่อ> up (ต้องเป็น root)',
      'หลังเปิดแล้ว DHCP จะให้ IP ดูด้วย ip a และ ip route'],
    hosts: [{ id: 'ws07', os: 'linux', user: 'root' }],
    topo: {
      devices: [
        Object.assign(host('ws07', 'pc', 'ws-lab07', '', 24, '', [], '08-00-27-07-AA-07', { os: 'linux', dhcp: true, x: 90, y: 320 }), {}),
        host('pc01', 'pc', 'ws-lab01', '', 24, '', [], '08-00-27-07-AA-01', { os: 'linux', dhcp: true, x: 230, y: 340 }),
        sw('sw1', 'SW-LAB7', 240, 210),
        router('r1', 'R-LAB7', [{ name: 'g0/0', ip: '172.20.7.1', prefix: 24, mac: '00-1E-7A-20-07-01' }, { name: 'g0/1', ip: '203.0.113.26', prefix: 30 }],
          [{ net: '0.0.0.0', prefix: 0, via: '203.0.113.25' }], { x: 420, y: 210,
            services: { dhcp: { start: '172.20.7.50', end: '172.20.7.150', prefix: 24, gateway: '172.20.7.1', dns: ['8.8.8.8'] } } }),
        inet('net', '203.0.113.25', 30, 600, 210)
      ],
      links: [L('l1', 'ws07', 'eth0', 'sw1', 'p7'), L('l2', 'pc01', 'eth0', 'sw1', 'p1'), L('l3', 'r1', 'g0/0', 'sw1', 'p24'),
        L('l4', 'r1', 'g0/1', 'net', 'wan', { medium: 'fiber' })]
    },
    setup: t => { t.devices.find(d => d.id === 'ws07').ifaces[0].up = false; },
    questions: [
      { id: 'iface', q: 'Interface ใดที่ถูกปิด (state DOWN)', type: 'iface', key: (n, t) => t.devices.find(d => d.id === 'ws07').ifaces.find(f => f.up === false).name,
        tip: 'ใช้ ip a ดูว่า interface ใดไม่มี UP' },
      { id: 'cmd', q: 'คำสั่งที่ใช้เปิด interface นั้น (พิมพ์คำสั่งเต็ม)', type: 'cmd', key: (n, t) => 'ip link set ' + t.devices.find(d => d.id === 'ws07').ifaces[0].name + ' up',
        tip: 'รูปแบบคำสั่งคือ ip link set <interface> up' },
      { id: 'ip', q: 'หลังเปิด interface แล้ว เครื่องได้ IP ใดจาก DHCP', type: 'ip', key: (n, t) => fixedNet(t, 'ws07').config('ws07').ip, tip: 'หลังเปิด interface ใช้ ip a ดูบรรทัด inet ... dynamic' },
      { id: 'gw', q: 'หลังเปิด interface แล้ว Default gateway ที่ได้จาก DHCP คือ IP ใด', type: 'ip', key: (n, t) => fixedNet(t, 'ws07').config('ws07').gateway, tip: 'ip route ดูบรรทัด default via' }
    ],
    good: [{ re: /^(sudo\s+)?ip\s+(-\d\s+)?(a(ddr?)?|l(ink)?)(\s+(show|list))?\s*$/i, label: 'ip a / ip link' }, { re: /^(sudo\s+)?ip\s+l(ink)?\s+set\s+(dev\s+)?\S+\s+up\b/i, label: 'ip link set ... up' }],
    steps: [
      { cmd: 'ip a', match: '^(sudo\\s+)?ip\\s+(-\\S+\\s+)*(a(ddr?|ddress)?|l(ink)?)(\\s+show)?\\s*$', say: 'พิมพ์ ip a',
        why: 'ดูสถานะของทุก interface ว่าเปิด (UP) หรือปิด (DOWN)',
        explain: 'interface ที่ถูกปิดจะไม่มีคำว่า UP ในวงเล็บ <...> และขึ้น state DOWN (ข้อ 1) และยังไม่มีบรรทัด inet เพราะยังไม่ได้ IP', mark: 'state DOWN' },
      { act: 'เปิด interface ที่ปิดอยู่ด้วยคำสั่งชุด ip link (ใช้ชื่อ interface ที่หาได้จากขั้นก่อน)', cmd: 'ip link set eth0 up', match: '^(sudo\\s+)?ip\\s+l(i|in|ink)?\\s+set\\s+(dev\\s+)?\\S+\\s+up\\b', say: 'เปิด interface ด้วย ip link set <ชื่อ interface> up',
        why: 'เป็นคำสั่งของชุด iproute2 ต้องใช้สิทธิ์ root (ข้อ 2)',
        explain: 'ถ้าคำสั่งสำเร็จ Linux จะไม่แสดงอะไรเลย (ไม่มีข่าวคือข่าวดี) จากนั้นเครื่องจะขอ IP จาก DHCP ใหม่', mark: '$^' },
      { cmd: 'ip a', match: '^(sudo\\s+)?ip\\s+(-\\S+\\s+)*a(ddr?|ddress)?(\\s+show)?\\s*$', after: 1, say: 'พิมพ์ ip a อีกครั้ง',
        why: 'ตรวจว่า interface ขึ้นแล้วและได้ IP จาก DHCP',
        explain: 'บรรทัด inet ... dynamic แปลว่า IP ได้มาจาก DHCP (ข้อ 3) valid_lft คืออายุ lease ที่เหลือเป็นวินาที', mark: 'inet .*dynamic|state UP' },
      { cmd: 'ip route', match: '^(sudo\\s+)?ip\\s+r(o|ou|out|oute)?(\\s+show)?\\s*$', after: 1, say: 'พิมพ์ ip route',
        why: 'DHCP ให้ Default gateway มาด้วย ดูได้จากตารางเส้นทาง',
        explain: 'default via ... proto dhcp คือ gateway ที่ได้จาก DHCP (ข้อ 4)', mark: '^default' }
    ]
  },
  {
    id: 'm8', level: 'hard', title: 'ข้ามวงเครือข่าย: Windows ↔ Linux',
    desc: 'สลับระหว่าง PC-A (Windows) และ srv-b (Linux) ต่างวงเครือข่ายกัน ใช้ ping, arp, traceroute อธิบายการส่งข้อมูลผ่าน Router',
    story: 'ห้อง A (192.168.1.0/24) กับห้อง server B (192.168.2.0/24) เชื่อมกันด้วย Router1 คุณเข้าได้ทั้ง PC-A (Windows) และ srv-b (Linux, ผู้ใช้ student) ทดลองส่งข้อมูลข้ามวงแล้วตอบคำถาม',
    hints: ['ARP ใช้ได้เฉพาะในวงเครือข่ายเดียวกัน เมื่อส่งไปต่างวง เครื่องจะ ARP หา MAC ของ Default gateway แทน',
      'TTL ที่ได้รับ = TTL เริ่มต้นของปลายทาง (Linux 64, Windows 128) ลบจำนวน Router ที่ผ่าน', 'บน Linux ใช้ traceroute (ไม่ใช่ tracert)'],
    hosts: [{ id: 'pca', os: 'windows', user: 'student' }, { id: 'srvb', os: 'linux', user: 'student' }],
    topo: {
      devices: [
        host('pca', 'pc', 'PC-A', '192.168.1.10', 24, '192.168.1.1', ['192.168.2.20'], 'A4-BB-6D-01-00-10', { x: 80, y: 300 }),
        host('pca2', 'pc', 'PC-A2', '192.168.1.11', 24, '192.168.1.1', ['192.168.2.20'], 'A4-BB-6D-01-00-11', { x: 200, y: 330 }),
        sw('swa', 'SW-A', 160, 190),
        router('r1', 'Router1', [{ name: 'g0/0', ip: '192.168.1.1', prefix: 24, mac: '00-1E-7A-0A-01-01' }, { name: 'g0/1', ip: '192.168.2.1', prefix: 24, mac: '00-1E-7A-0A-02-01' }],
          [], { x: 340, y: 190 }),
        sw('swb', 'SW-B', 520, 190),
        host('srvb', 'server', 'srv-b', '192.168.2.20', 24, '192.168.2.1', ['127.0.0.1'], '52-54-00-0B-02-20', { os: 'linux', x: 600, y: 320,
          services: { dns: { records: { 'srv-b.lab.local': '192.168.2.20', 'pc-a.lab.local': '192.168.1.10', 'files.lab.local': '192.168.2.21' } }, web: true } }),
        host('files', 'server', 'files', '192.168.2.21', 24, '192.168.2.1', ['192.168.2.20'], '52-54-00-0B-02-21', { os: 'linux', x: 470, y: 330, services: { file: true } })
      ],
      links: [L('l1', 'pca', 'eth0', 'swa', 'p1'), L('l2', 'pca2', 'eth0', 'swa', 'p2'), L('l3', 'r1', 'g0/0', 'swa', 'p24'),
        L('l4', 'r1', 'g0/1', 'swb', 'p24'), L('l5', 'srvb', 'eth0', 'swb', 'p1'), L('l6', 'files', 'eth0', 'swb', 'p2')]
    },
    questions: [
      { id: 'ttl', q: 'จาก PC-A ping 192.168.2.20 (srv-b) ได้ค่า TTL เท่าไร', type: 'num', key: n => n.ping('pca', '192.168.2.20').ttl, tip: 'ping จาก PC-A แล้วอ่านค่า TTL=' },
      { id: 'arpmac', q: 'หลัง ping srv-b แล้ว ใน arp -a ของ PC-A มี MAC address ใดที่ PC-A ใช้ส่งแพ็กเก็ตไป srv-b', type: 'mac',
        key: n => { n.ping('pca', '192.168.2.20'); const g = n.config('pca').gateway; const e = n.arp('pca').find(x => x.ip === g); return e && e.mac; },
        tip: 'srv-b อยู่ต่างวง PC-A จึงไม่ ARP หา srv-b โดยตรง ดูว่าใน arp -a มี IP ใดบ้าง' },
      { id: 'hop1', q: 'จาก srv-b ใช้ traceroute ไปยัง 192.168.1.10 (PC-A) hop แรกคือ IP ใด', type: 'ip', key: n => hopIp(n, 'srvb', '192.168.1.10', 1),
        tip: 'สลับไป srv-b แล้วพิมพ์ traceroute 192.168.1.10' },
      { id: 'files', q: 'จาก PC-A ชื่อ files.lab.local แปลงเป็น IP ใด', type: 'ip', key: n => n.nslookup('pca', 'files.lab.local').ip, tip: 'ใช้ nslookup files.lab.local บน PC-A' }
    ],
    good: [{ re: /^arp\s+-a\b/i, label: 'arp -a' }, { re: /^traceroute\b/i, label: 'traceroute (บน srv-b)' }, { re: /^(nslookup|ping)\b/i, label: 'nslookup / ping' }],
    steps: [
      { host: 'pca', cmd: 'ping 192.168.2.20', match: '^ping\\s+(-n\\s+\\d+\\s+)?192\\.168\\.2\\.20\\b', say: 'บน PC-A พิมพ์ ping 192.168.2.20',
        why: 'ส่งข้อมูลข้ามวงผ่าน Router1 แล้วสังเกตค่า TTL',
        explain: 'srv-b เป็น Linux เริ่ม TTL ที่ 64 ผ่าน Router 1 ตัวจึงลดลง 1 (ข้อ 1)', mark: 'TTL=' },
      { host: 'pca', cmd: 'arp -a', match: '^arp\\s+-a\\b', say: 'พิมพ์ arp -a',
        why: 'ดูว่า PC-A รู้ MAC ของใครบ้างหลังส่งข้อมูลไปต่างวง',
        explain: 'ไม่มี IP ของ srv-b ในตาราง เพราะ ARP ใช้ได้ในวงเดียวกันเท่านั้น แถว dynamic ที่เห็นคือ gateway ซึ่ง PC-A ส่งเฟรมไปหา (ข้อ 2)', mark: 'dynamic' },
      { host: 'srvb', cmd: 'traceroute 192.168.1.10', match: '^traceroute\\s+(-\\S+\\s+)*192\\.168\\.1\\.10\\b', say: 'กดเลือกเครื่อง srv-b แล้วพิมพ์ traceroute 192.168.1.10',
        why: 'Linux ใช้ traceroute (Windows ใช้ tracert)',
        explain: 'บรรทัดหมายเลข 1 คือ gateway ของ srv-b ฝั่งวง 192.168.2.0/24 (ข้อ 3) แสดงว่า Router มีคนละ IP ในแต่ละวง', mark: '^\\s*1\\s' },
      { host: 'pca', cmd: 'nslookup files.lab.local', match: '^nslookup\\s+files\\.lab\\.local', say: 'กลับไป PC-A แล้วพิมพ์ nslookup files.lab.local',
        why: 'PC-A ใช้ DNS server ที่อยู่อีกวง (srv-b)',
        explain: 'บรรทัด Address ใต้ Name คือ IP ของ files.lab.local (ข้อ 4)', mark: '^Name:|^Address:' }
    ]
  },
  // ---------------------------------------------------------------- new missions (2.6): graded with evidence from the replayed commandLog
  {
    id: 'm9', level: 'medium', title: 'IP ชน: ใครแย่ง IP เครื่องพิมพ์',
    desc: 'นั่งที่ PC-ADM01 (Windows) ใช้ ping และ arp -a หาว่าเครื่องใดใช้ IP เดียวกับเครื่องพิมพ์ 192.168.10.50',
    story: 'ฝ่ายธุรการสั่งพิมพ์ไปที่เครื่องพิมพ์ PRN-ADM (192.168.10.50) แล้วงานหายไปเฉย ๆ ทั้งที่ ping 192.168.10.50 ยังตอบ ครูสงสัยว่ามีเครื่องอื่นตั้ง IP ซ้ำกับเครื่องพิมพ์ ให้ตรวจจาก PC-ADM01 โดยเทียบ MAC กับทะเบียนอุปกรณ์ด้านล่าง',
    hints: ['ping 192.168.10.50 แล้วสังเกต TTL: เครื่องพิมพ์ (ระบบฝังตัว/Linux) เริ่มที่ 64 แต่ Windows เริ่มที่ 128',
      'หลัง ping แล้วใช้ arp -a ดูว่า IP 192.168.10.50 จับคู่กับ MAC ใด แล้วเทียบกับทะเบียนอุปกรณ์',
      'เมื่อ IP ชนกัน เครื่องที่ตอบ ARP ก่อนจะได้รับข้อมูลแทน เครื่องจริงจึงไม่ได้รับงาน'],
    hosts: [{ id: 'adm01', os: 'windows', user: 'staff' }],
    facts: [['PRN-ADM (เครื่องพิมพ์)', '00-80-77-3D-10-50'], ['NB-T07 (โน้ตบุ๊กครู)', 'B4-2E-99-5A-07-77'], ['PC-ADM02', '3C-52-82-10-00-22'],
      ['R-ADM (Router)', '00-1E-7A-10-10-01'], ['PC-ADM01 (เครื่องนี้)', '3C-52-82-10-00-21']],
    topo: {
      devices: [
        host('adm01', 'pc', 'PC-ADM01', '192.168.10.21', 24, '192.168.10.1', ['192.168.10.1'], '3C-52-82-10-00-21', { x: 80, y: 320 }),
        host('adm02', 'pc', 'PC-ADM02', '192.168.10.22', 24, '192.168.10.1', ['192.168.10.1'], '3C-52-82-10-00-22', { x: 190, y: 340 }),
        host('nbt07', 'pc', 'NB-T07', '192.168.10.50', 24, '192.168.10.1', ['192.168.10.1'], 'B4-2E-99-5A-07-77', { x: 330, y: 340 }),
        host('prn1', 'printer', 'PRN-ADM', '192.168.10.50', 24, '192.168.10.1', [], '00-80-77-3D-10-50', { x: 440, y: 330 }),
        sw('sw1', 'SW-ADM', 260, 210),
        router('r1', 'R-ADM', [{ name: 'g0/0', ip: '192.168.10.1', prefix: 24, mac: '00-1E-7A-10-10-01' }, { name: 'g0/1', ip: '203.0.113.34', prefix: 30 }],
          [{ net: '0.0.0.0', prefix: 0, via: '203.0.113.33' }], { x: 440, y: 190, services: { dns: { records: { 'prn-adm.office.local': '192.168.10.50' } } } }),
        inet('net', '203.0.113.33', 30, 620, 190)
      ],
      links: [L('l1', 'adm01', 'eth0', 'sw1', 'p1'), L('l2', 'adm02', 'eth0', 'sw1', 'p2'), L('l3', 'nbt07', 'eth0', 'sw1', 'p7'), L('l4', 'prn1', 'eth0', 'sw1', 'p20'),
        L('l5', 'r1', 'g0/0', 'sw1', 'p24'), L('l6', 'r1', 'g0/1', 'net', 'wan', { medium: 'fiber' })]
    },
    questions: [
      { id: 'ttl', q: 'ping 192.168.10.50 ได้ค่า TTL เท่าไร', type: 'num', key: n => n.ping('adm01', '192.168.10.50').ttl,
        tip: 'ping 192.168.10.50 แล้วอ่านตัวเลขหลัง TTL=', ev: (st, k) => st.pings.some(p => p.h === 'adm01' && p.dst === '192.168.10.50' && p.ok && String(p.ttl) === k),
        evTip: 'ต้อง ping 192.168.10.50 จากเครื่องนี้จริง' },
      { id: 'os', q: 'จากค่า TTL เครื่องที่ตอบน่าจะใช้ระบบปฏิบัติการใด (Windows หรือ Linux)', type: 'os',
        key: n => { const r = n.ping('adm01', '192.168.10.50'); return r.ttl > 64 ? 'windows' : 'linux'; },
        tip: 'Windows เริ่ม TTL ที่ 128, Linux/อุปกรณ์ฝังตัวเริ่มที่ 64 (อยู่วงเดียวกันค่าไม่ลด)', ev: st => st.pings.some(p => p.h === 'adm01' && p.dst === '192.168.10.50' && p.ok),
        evTip: 'ต้อง ping 192.168.10.50 เพื่อดู TTL ก่อน' },
      { id: 'mac', q: 'MAC address ที่ตอบให้ IP 192.168.10.50 (จาก arp -a)', type: 'mac',
        key: n => { n.ping('adm01', '192.168.10.50'); const e = n.arp('adm01').find(x => x.ip === '192.168.10.50'); return e && e.mac; },
        tip: 'ping 192.168.10.50 ก่อน แล้วดูแถว 192.168.10.50 ใน arp -a', ev: (st, k) => st.arp.some(s => s.h === 'adm01' && s.list.some(e => e.ip === '192.168.10.50' && norm.mac(e.mac) === norm.mac(k))),
        evTip: 'ต้องเห็น MAC นี้ในผลของ arp -a ที่คุณรัน (ping ก่อนแล้วจึง arp -a)' },
      { id: 'who', q: 'เครื่องที่ตั้ง IP ซ้ำกับเครื่องพิมพ์คือเครื่องใด (ตอบชื่อตามทะเบียนอุปกรณ์)', type: 'name',
        key: n => { n.ping('adm01', '192.168.10.50'); const e = n.arp('adm01').find(x => x.ip === '192.168.10.50'); const d = e && n.topo.devices.find(x => x.ifaces && x.ifaces.some(f => norm.mac(f.mac) === norm.mac(e.mac))); return d && d.name; },
        tip: 'นำ MAC ที่ได้จาก arp -a ไปเทียบกับทะเบียนอุปกรณ์', ev: (st, k, sc) => { const f = sc.facts.find(x => norm.name(x[0].split(' ')[0]) === norm.name(k)); return !!f && st.arp.some(s => s.h === 'adm01' && s.list.some(e => e.ip === '192.168.10.50' && norm.mac(e.mac) === norm.mac(f[1]))); },
        evTip: 'ต้องเห็น MAC ของเครื่องนั้นใน arp -a ที่คุณรันจริง' }
    ],
    good: [{ re: /^ping\b.*192\.168\.10\.50/i, label: 'ping 192.168.10.50' }, { re: /^arp\s+-a\b/i, label: 'arp -a' }],
    steps: [
      { cmd: 'ping 192.168.10.50', match: '^ping\\s+(-n\\s+\\d+\\s+)?192\\.168\\.10\\.50\\b', say: 'พิมพ์ ping 192.168.10.50',
        why: 'ตรวจว่ามีเครื่องตอบที่ IP นี้หรือไม่ และดู TTL เพื่อเดาชนิดเครื่อง',
        explain: 'มีการตอบกลับ แต่ดู TTL ให้ดี: เครื่องพิมพ์ควรได้ TTL=64 ถ้าได้ 128 แปลว่าเครื่อง Windows เป็นคนตอบ (ข้อ 1, 2)', mark: 'TTL=' },
      { cmd: 'arp -a', match: '^arp\\s+-a\\b', say: 'พิมพ์ arp -a',
        why: 'ดูว่า IP 192.168.10.50 ถูกจับคู่กับ MAC ใด (เครื่องที่ตอบ ARP)',
        explain: 'แถวที่ไฮไลต์คือ IP ของเครื่องพิมพ์ ให้นำ Physical Address ไปเทียบกับทะเบียนอุปกรณ์ (ข้อ 3, 4) ถ้าไม่ตรงกับ MAC ของเครื่องพิมพ์ แปลว่ามีเครื่องอื่นแย่ง IP', mark: '^\\s+192\\.168\\.10\\.50\\s' }
    ]
  },
  {
    id: 'm10', level: 'hard', title: 'ss / netstat: เว็บแอปเปิดพอร์ตไว้ที่ไหน',
    desc: 'ใช้ ss -tulpn บน srv-web (Linux) และ netstat -ano บน PC-IT45 (Windows) หาพอร์ต, IP ที่ผูกไว้ และ PID ของโปรแกรม',
    story: 'เว็บแอป intranet ของแผนก (โปรแกรม node) รันอยู่บน srv-web แต่เครื่องอื่นเปิดไม่ได้ ผู้ดูแลระบบเชื่อมต่อ SSH จาก PC-IT45 เข้า srv-web ไว้แล้ว ให้ตรวจว่า node เปิดพอร์ตใด ผูกไว้กับ IP ใด และหา PID ของโปรแกรมที่เกี่ยวข้อง (บน srv-web ล็อกอินเป็น student ใช้ sudo ได้)',
    hints: ['ss -tulpn: t=TCP u=UDP l=เฉพาะที่รอรับ (LISTEN) p=แสดงโปรแกรม n=แสดงเป็นตัวเลข',
      'ผู้ใช้ธรรมดาจะไม่เห็นชื่อโปรแกรมของผู้ใช้อื่นในคอลัมน์ Process ต้องใช้ sudo ss -tulpn',
      'Local Address 127.0.0.1:พอร์ต = รับเฉพาะจากเครื่องตัวเอง (localhost) เครื่องอื่นต่อเข้ามาไม่ได้; 0.0.0.0:พอร์ต = รับทุก IP',
      'บน Windows ใช้ netstat -ano: คอลัมน์สุดท้ายคือ PID'],
    hosts: [{ id: 'srvweb', os: 'linux', user: 'student' }, { id: 'pcit', os: 'windows', user: 'itadmin' }],
    topo: {
      devices: [
        host('srvweb', 'server', 'srv-web', '10.30.0.20', 24, '10.30.0.1', ['10.30.0.1'], '52-54-00-30-00-20', { os: 'linux', x: 400, y: 330, services: { web: true } }),
        host('pcit', 'pc', 'PC-IT45', '10.30.0.45', 24, '10.30.0.1', ['10.30.0.1'], '18-C0-4D-30-00-45', { x: 90, y: 330 }),
        sw('sw1', 'SW-IT', 240, 210),
        router('r1', 'R-IT', [{ name: 'g0/0', ip: '10.30.0.1', prefix: 24, mac: '00-1E-7A-30-00-01' }], [], { x: 420, y: 170,
          services: { dns: { records: { 'srv-web.it.local': '10.30.0.20', 'pc-it45.it.local': '10.30.0.45' } } } })
      ],
      links: [L('l1', 'srvweb', 'eth0', 'sw1', 'p20'), L('l2', 'pcit', 'eth0', 'sw1', 'p5'), L('l3', 'r1', 'g0/0', 'sw1', 'p24')]
    },
    // [proto, local, foreign, state (Windows wording), pid, process]; the same rows feed ss (Linux) and netstat (Windows)
    netstat: {
      srvweb: [
        ['TCP', '0.0.0.0:22', '0.0.0.0:0', 'LISTENING', 901, 'sshd'],
        ['TCP', '127.0.0.53:53', '0.0.0.0:0', 'LISTENING', 640, 'systemd-resolve'],
        ['TCP', '127.0.0.1:3306', '0.0.0.0:0', 'LISTENING', 1187, 'mysqld'],
        ['TCP', '127.0.0.1:8080', '0.0.0.0:0', 'LISTENING', 2310, 'node'],
        ['TCP', '{ip}:22', '10.30.0.45:52114', 'ESTABLISHED', 3120, 'sshd'],
        ['TCP', '127.0.0.1:41822', '127.0.0.1:3306', 'ESTABLISHED', 2310, 'node'],
        ['TCP', '127.0.0.1:3306', '127.0.0.1:41822', 'ESTABLISHED', 1187, 'mysqld'],
        ['UDP', '127.0.0.53:53', '*:*', '', 640, 'systemd-resolve']
      ],
      pcit: [
        ['TCP', '0.0.0.0:135', '0.0.0.0:0', 'LISTENING', 1016, 'svchost.exe'], ['TCP', '0.0.0.0:445', '0.0.0.0:0', 'LISTENING', 4, 'System'],
        ['TCP', '0.0.0.0:5040', '0.0.0.0:0', 'LISTENING', 6844, 'svchost.exe'], ['TCP', '0.0.0.0:49664', '0.0.0.0:0', 'LISTENING', 712, 'lsass.exe'],
        ['TCP', '{ip}:139', '0.0.0.0:0', 'LISTENING', 4, 'System'],
        ['TCP', '{ip}:52114', '10.30.0.20:22', 'ESTABLISHED', 7424, 'ssh.exe'],
        ['TCP', '{ip}:52160', '10.30.0.1:53', 'TIME_WAIT', 0, ''],
        ['UDP', '0.0.0.0:5353', '*:*', '', 2140, 'svchost.exe'], ['UDP', '{ip}:137', '*:*', '', 4, 'System']
      ]
    },
    questions: [
      { id: 'port', q: 'โปรแกรม node (เว็บแอป) LISTEN รอรับที่พอร์ตใด', type: 'port',
        key: (n, t, sc) => portOf(sc.netstat.srvweb.find(r => r[5] === 'node' && r[3] === 'LISTENING')[1]),
        tip: 'ใช้ sudo ss -tulpn แล้วหาแถวที่คอลัมน์ Process เป็น node', ev: st => st.runs.some(r => r.h === 'srvweb' && r.cmd === 'ss' && r.fl.l && r.fl.p && r.root),
        evTip: 'ต้องรัน ss แบบมี -l และ -p ด้วยสิทธิ์ root (sudo) บน srv-web จึงจะเห็นว่าแถวไหนเป็นของ node' },
      { id: 'bind', q: 'node ผูก (bind) พอร์ตนั้นไว้กับ IP ใด', type: 'ip',
        key: (n, t, sc) => sc.netstat.srvweb.find(r => r[5] === 'node' && r[3] === 'LISTENING')[1].split(':')[0],
        tip: 'ดูส่วนหน้าเครื่องหมาย : ในคอลัมน์ Local Address ของแถว node', ev: st => st.runs.some(r => r.h === 'srvweb' && r.cmd === 'ss' && (r.fl.l || r.fl.a)),
        evTip: 'ต้องรัน ss -tulpn (หรือ ss -l) บน srv-web' },
      { id: 'pid', q: 'PID ของโปรแกรม node บน srv-web', type: 'num',
        key: (n, t, sc) => sc.netstat.srvweb.find(r => r[5] === 'node' && r[3] === 'LISTENING')[4],
        tip: 'ดูตัวเลข pid= ใน users:(("node",pid=...)) ของ sudo ss -tulpn', ev: st => st.runs.some(r => r.h === 'srvweb' && r.cmd === 'ss' && r.fl.p && r.root),
        evTip: 'PID ของโปรแกรมผู้ใช้อื่นจะเห็นเฉพาะเมื่อรัน ss -p ด้วย sudo' },
      { id: 'sshpid', q: 'บน PC-IT45 PID ของโปรแกรมที่เชื่อมต่อ SSH (ESTABLISHED) ไปยัง srv-web คือเท่าใด', type: 'num',
        key: (n, t, sc) => sc.netstat.pcit.find(r => r[3] === 'ESTABLISHED' && /:22$/.test(r[2]))[4],
        tip: 'สลับไป PC-IT45 ใช้ netstat -ano หาแถว ESTABLISHED ที่ Foreign Address ลงท้าย :22 แล้วดูคอลัมน์ PID', ev: st => st.runs.some(r => r.h === 'pcit' && r.cmd === 'netstat' && r.fl.o),
        evTip: 'ต้องรัน netstat แบบมี -o (เช่น netstat -ano) บน PC-IT45 จึงจะเห็น PID' }
    ],
    good: [{ re: /^(sudo\s+)?ss\s+.*-\w*p/i, label: 'sudo ss -tulpn' }, { re: /^netstat\s+.*-\w*o/i, label: 'netstat -ano' }],
    steps: [
      { host: 'srvweb', cmd: 'ss -tulpn', match: '^ss\\s+-\\w*l', say: 'บน srv-web พิมพ์ ss -tulpn',
        why: 'ss (socket statistics) แทน netstat ใน Linux ปัจจุบัน: -t TCP, -u UDP, -l เฉพาะที่รอรับ, -p โปรแกรม, -n ตัวเลข',
        explain: 'เห็นพอร์ตที่ LISTEN แต่คอลัมน์ Process ว่าง เพราะผู้ใช้ธรรมดาดูข้อมูลโปรแกรมของผู้ใช้อื่นไม่ได้ สังเกต Local Address: 0.0.0.0 = รับทุก IP, 127.0.0.1 = รับเฉพาะเครื่องตัวเอง', mark: 'LISTEN' },
      { host: 'srvweb', cmd: 'sudo ss -tulpn', match: '^sudo\\s+ss\\s+-\\w*p', say: 'พิมพ์ sudo ss -tulpn',
        why: 'sudo ให้สิทธิ์ root ชั่วคราวจึงเห็นชื่อโปรแกรมและ PID ทุกตัว',
        explain: 'แถวของ node: ตัวเลขหลัง : คือพอร์ต (ข้อ 1) ส่วนหน้า : คือ IP ที่ผูกไว้ (ข้อ 2) pid= คือ PID (ข้อ 3) ถ้าผูกกับ 127.0.0.1 เครื่องอื่นจะต่อเข้ามาไม่ได้ นี่คือสาเหตุที่เว็บใช้จากเครื่องอื่นไม่ได้', mark: '"node"' },
      { host: 'pcit', cmd: 'netstat -ano', match: '^netstat\\s+-\\w*o', say: 'กดเลือก PC-IT45 แล้วพิมพ์ netstat -ano',
        why: '-o เพิ่มคอลัมน์ PID ของโปรแกรมเจ้าของการเชื่อมต่อ (ใช้คู่กับ Task Manager / tasklist)',
        explain: 'แถว ESTABLISHED ที่ Foreign Address เป็น IP ของ srv-web พอร์ต 22 (SSH) คอลัมน์สุดท้ายคือ PID (ข้อ 4) สังเกตว่าพอร์ตต้นทางตรงกับแถว ESTABLISHED ใน ss ของ srv-web', mark: ':22\\s' }
    ]
  },
  {
    id: 'm11', level: 'hard', title: 'Linux ไม่มี Default route ออกเน็ตไม่ได้',
    desc: 'ล็อกอิน root ที่ srv-mon (Linux) หาสาเหตุที่ ping 8.8.8.8 ไม่ได้ เทียบกับ PC-NOC (Windows) แล้วเพิ่ม default route และพิสูจน์ด้วย ping',
    story: 'server เฝ้าระบบ srv-mon ส่งการแจ้งเตือนออกอินเทอร์เน็ตไม่ได้ ทั้งที่ ping เครื่องในวงเดียวกันได้ ผู้ติดตั้งลืมตั้งค่าบางอย่างหลังย้ายเครื่อง คุณเข้าได้ทั้ง srv-mon (root) และ PC-NOC (Windows) ที่อยู่วงเดียวกันและใช้งานได้ปกติ',
    hints: ['ping: connect: Network is unreachable แปลว่าเครื่องไม่รู้ว่าจะส่งแพ็กเก็ตไปทางไหน (ไม่มีเส้นทาง) ยังไม่ได้ส่งออกไปเลย',
      'ip route ที่ถูกต้องควรมีบรรทัด default via <gateway>', 'ดู Default gateway ที่ถูกต้องได้จากเครื่องอื่นในวงเดียวกัน (ipconfig / route print บน PC-NOC)',
      'คำสั่งเพิ่ม: ip route add default via <IP gateway> (ต้องเป็น root) แล้ว ping 8.8.8.8 อีกครั้ง'],
    hosts: [{ id: 'srvmon', os: 'linux', user: 'root' }, { id: 'pcnoc', os: 'windows', user: 'noc' }],
    topo: {
      devices: [
        host('srvmon', 'server', 'srv-mon', '10.50.0.20', 24, '', ['8.8.8.8'], '52-54-00-50-00-20', { os: 'linux', x: 400, y: 330 }),
        host('pcnoc', 'pc', 'PC-NOC', '10.50.0.31', 24, '10.50.0.1', ['8.8.8.8'], '18-C0-4D-50-00-31', { x: 90, y: 330 }),
        sw('sw1', 'SW-NOC', 240, 210),
        router('r1', 'R-NOC', [{ name: 'g0/0', ip: '10.50.0.1', prefix: 24, mac: '00-1E-7A-50-00-01' }, { name: 'g0/1', ip: '203.0.113.42', prefix: 30 }],
          [{ net: '0.0.0.0', prefix: 0, via: '203.0.113.41' }], { x: 430, y: 190 }),
        inet('net', '203.0.113.41', 30, 620, 190)
      ],
      links: [L('l1', 'srvmon', 'eth0', 'sw1', 'p20'), L('l2', 'pcnoc', 'eth0', 'sw1', 'p3'), L('l3', 'r1', 'g0/0', 'sw1', 'p24'), L('l4', 'r1', 'g0/1', 'net', 'wan', { medium: 'fiber' })]
    },
    questions: [
      { id: 'hasdef', q: 'ตอนเริ่มต้น ตารางเส้นทาง (ip route) ของ srv-mon มีเส้นทาง default หรือไม่ (ตอบ มี / ไม่มี)', type: 'yesno',
        key: n => n.routes('srvmon').some(r => r.prefix === 0) ? 'yes' : 'no',
        tip: 'ใช้ ip route บน srv-mon ดูว่ามีบรรทัดที่ขึ้นต้นด้วย default หรือไม่', ev: st => st.runs.some(r => r.h === 'srvmon' && r.kind === 'iproute_show' && r.hadDefault === false),
        evTip: 'ต้องรัน ip route บน srv-mon ก่อนแก้ไข' },
      { id: 'gw', q: 'Default gateway ที่ถูกต้องของวงนี้คือ IP ใด', type: 'ip', key: n => n.config('pcnoc').gateway,
        tip: 'ดู Default Gateway ของ PC-NOC ซึ่งอยู่วงเดียวกันและใช้งานได้', ev: (st, k) => st.runs.some(r => r.h === 'pcnoc' && /^(ipconfig|route|tracert|netstat)$/.test(r.cmd)) || st.routeAdds.some(a => a.h === 'srvmon' && a.ok && a.via === k),
        evTip: 'ควรตรวจจาก ipconfig / route print บน PC-NOC (หรือเพิ่ม route ด้วย IP นี้แล้วใช้ได้จริง)' },
      { id: 'ttl', q: 'หลังแก้ไขแล้ว ping 8.8.8.8 จาก srv-mon ได้ค่า ttl เท่าไร', type: 'num', key: (n, t) => fixedRouteNet(t, 'srvmon', '10.50.0.1').ping('srvmon', '8.8.8.8').ttl,
        tip: 'แก้ไขให้เสร็จก่อน แล้ว ping -c 4 8.8.8.8 อ่านค่า ttl=', ev: (st, k) => st.pings.some(p => p.h === 'srvmon' && p.dst === '8.8.8.8' && p.ok && String(p.ttl) === k),
        evTip: 'ต้อง ping 8.8.8.8 สำเร็จจาก srv-mon หลังแก้ไข' }
    ],
    tasks: [
      { id: 'fix', label: 'เพิ่ม default route บน srv-mon ให้ถูกต้อง แล้ว ping ออกอินเทอร์เน็ตได้จริง (ตรวจจากคำสั่งที่รัน)',
        check: st => st.routeAdds.some(a => a.h === 'srvmon' && a.ok) && st.pings.some(p => p.h === 'srvmon' && p.ok && p.external && p.afterFix),
        tip: 'ใช้ ip route add default via <gateway> บน srv-mon แล้ว ping -c 4 8.8.8.8 ให้ได้ reply (ถ้ากดรีเซ็ตเครือข่าย ต้องทำใหม่หลังรีเซ็ต)' }
    ],
    good: [{ re: /^(sudo\s+)?ip\s+r(o|ou|out|oute)?(\s+show)?\s*$/i, label: 'ip route' }, { re: /^(sudo\s+)?ip\s+r\S*\s+(add|replace)\s/i, label: 'ip route add default via ...' }],
    steps: [
      { host: 'srvmon', cmd: 'ping -c 4 8.8.8.8', match: '^ping\\s+.*8\\.8\\.8\\.8', say: 'บน srv-mon พิมพ์ ping -c 4 8.8.8.8',
        why: 'ยืนยันอาการก่อนแก้ไข',
        explain: 'Network is unreachable ขึ้นทันทีโดยไม่มีการส่งแพ็กเก็ต แปลว่าเครื่องไม่มีเส้นทางไปปลายทางนี้ ต่างจาก Request timed out ที่ส่งออกไปแล้วแต่ไม่มีคำตอบ', mark: 'unreachable' },
      { host: 'srvmon', cmd: 'ip route', match: '^(sudo\\s+)?ip\\s+r(o|ou|out|oute)?(\\s+show)?\\s*$', say: 'พิมพ์ ip route',
        why: 'ดูตารางเส้นทางว่ามี default หรือไม่',
        explain: 'มีเพียงเส้นทางของวงที่ต่อตรง (proto kernel scope link) ไม่มีบรรทัด default via ... (ข้อ 1) จึงไปนอกวงไม่ได้', mark: '.' },
      { host: 'pcnoc', cmd: 'ipconfig', match: '^(ipconfig|route\\s+print)\\b', say: 'กดเลือก PC-NOC แล้วพิมพ์ ipconfig',
        why: 'เครื่องในวงเดียวกันที่ใช้งานได้ ใช้ gateway ตัวที่ถูกต้อง',
        explain: 'Default Gateway ของ PC-NOC คือ Router ของวงนี้ (ข้อ 2)', mark: 'Default Gateway' },
      { act: 'เพิ่มเส้นทาง default ไปยัง gateway ที่ถูกต้องของวงนี้ (ใช้คำสั่งชุด ip route ต้องเป็น root)', host: 'srvmon', cmd: 'ip route add default via ', fill: true, match: '^(sudo\\s+)?ip\\s+r\\S*\\s+(add|replace)\\s+(default|0\\.0\\.0\\.0/0)\\s+via\\s+\\S+', say: 'กลับไป srv-mon พิมพ์ ip route add default via <IP gateway>',
        why: 'เพิ่มเส้นทาง default ชี้ไปที่ Router (ต้องเป็น root)',
        explain: 'ถ้าสำเร็จจะไม่มีข้อความ ถ้า gateway ไม่อยู่ในวงเดียวกันจะขึ้น Error: Nexthop has invalid gateway', mark: 'Error|RTNETLINK' },
      { host: 'srvmon', cmd: 'ip route', match: '^(sudo\\s+)?ip\\s+r(o|ou|out|oute)?(\\s+show)?\\s*$', after: 3, say: 'พิมพ์ ip route อีกครั้ง',
        why: 'ตรวจว่ามีบรรทัด default แล้ว', explain: 'บรรทัด default via ... คือเส้นทางที่เพิ่มเข้าไป (หายเมื่อรีบูต ถ้าต้องการถาวรต้องตั้งใน netplan)', mark: '^default' },
      { host: 'srvmon', cmd: 'ping -c 4 8.8.8.8', match: '^ping\\s+.*8\\.8\\.8\\.8', after: 3, say: 'พิมพ์ ping -c 4 8.8.8.8 อีกครั้ง',
        why: 'พิสูจน์ว่าแก้ได้จริง (ระบบตรวจงานจากคำสั่งนี้)',
        explain: 'ได้ 64 bytes from 8.8.8.8 แปลว่าออกอินเทอร์เน็ตได้แล้ว ค่า ttl= ใช้ตอบข้อ 3', mark: 'ttl=' }
    ]
  },
  // ---------------------------------------------------------------- 4.0: accounts, shares and permissions (w9, w17, w18)
  // Graded from the machine STATE after replaying the student's real commands with NL_SYS (public/js/sim/terminal.js).
  // No question to type: `tasks` only. Windows missions that change accounts/shares/ACLs start in an elevated prompt
  // (user Administrator = "Run as administrator"); client PCs run as a normal user, so admin commands there give
  // "System error 5 ... Access is denied." Linux missions log in as student with sudo rights.
  {
    id: 'm12', level: 'easy', week: 9, mode: 'guided', title: 'สร้างแชร์ Homework ให้กลุ่ม Students',
    desc: 'ที่ LAB-PC07 (Command Prompt แบบ Run as administrator) แชร์ C:\\Share\\Homework ชื่อ Homework ให้กลุ่ม Students ด้วยสิทธิ์ Change แล้วตรวจด้วย net share',
    story: 'ครูเตรียมเครื่อง LAB-PC07 เป็นที่ส่งงานของห้อง โฟลเดอร์ C:\\Share\\Homework สร้างไว้แล้วและตั้ง NTFS permission ให้นักเรียนสร้างไฟล์ได้ แต่ยังไม่ได้แชร์ งานของคุณ: สร้างแชร์ชื่อ Homework ให้เฉพาะกลุ่ม Students เข้าได้ด้วย Share permission แบบ Change (ไม่ใช่ Everyone และไม่ใช่ Full) แล้วตรวจผลด้วยคำสั่ง (คุณเปิด Command Prompt แบบ Run as administrator ไว้แล้ว)',
    hints: ['net share แสดงแชร์ทั้งหมด แชร์ที่ลงท้ายด้วย $ เป็นแชร์ของระบบ', 'รูปแบบ: net share ชื่อแชร์=ไดรฟ์:\\path /grant:ผู้ใช้หรือกลุ่ม,READ|CHANGE|FULL',
      'ถ้าไม่ใส่ /grant ระบบจะให้ Everyone แบบ READ ถ้าสร้างผิดให้ลบด้วย net share ชื่อ /delete แล้วสร้างใหม่', 'ตรวจผลด้วย net share Homework ดูบรรทัด Permission'],
    hosts: [{ id: 'lab07', os: 'windows', user: 'Administrator' }],
    topo: {
      devices: [
        host('lab07', 'pc', 'LAB-PC07', '192.168.20.57', 24, '192.168.20.1', ['192.168.20.10'], '00-1A-2B-3C-4D-5E', { x: 120, y: 320, services: { file: true },
          sys: SYS.WIN.make({ host: 'LAB-PC07', users: [{ name: 'teacher', full: 'Teacher NetLab', groups: ['Administrators'] }, { name: 'std01', groups: ['Students'] }, { name: 'std02', groups: ['Students'] }, { name: 'std03', groups: ['Students'] }],
            groups: [{ name: 'Students', comment: 'นักเรียนห้องคอม 2' }],
            dirs: [{ path: 'C:\\Share' }, { path: 'C:\\Share\\Homework', protect: true, acl: ['BUILTIN\\Administrators:(OI)(CI)(F)', 'NT AUTHORITY\\SYSTEM:(OI)(CI)(F)', 'CREATOR OWNER:(OI)(CI)(IO)(M)', 'LAB-PC07\\Students:(OI)(CI)(RX,W)'] }] }, 'Administrator') }),
        host('pc21', 'pc', 'LAB-PC21', '192.168.20.21', 24, '192.168.20.1', ['192.168.20.10'], '00-1A-2B-3C-4D-21', { x: 300, y: 330 }),
        sw('sw1', 'SW-LAB2', 220, 200),
        router('r1', 'R-LAB2', [{ name: 'g0/0', ip: '192.168.20.1', prefix: 24 }], [], { x: 420, y: 180 })
      ],
      links: [L('l1', 'lab07', 'eth0', 'sw1', 'p7'), L('l2', 'pc21', 'eth0', 'sw1', 'p21'), L('l3', 'r1', 'g0/0', 'sw1', 'p24')]
    },
    questions: [],
    tasks: [
      { id: 'share', label: 'มีแชร์ชื่อ Homework ที่ชี้ไปยัง C:\\Share\\Homework', check: st => !!homeworkShare(st),
        tip: st => win(st, 'lab07').shares.some(x => /^c:\\share\\homework$/i.test(x.path)) ? 'มีแชร์ของโฟลเดอร์นี้แล้วแต่ชื่อไม่ใช่ Homework' : 'ยังไม่มีแชร์ของ C:\\Share\\Homework ใช้ net share ชื่อ=path (ต้องรันใน Command Prompt แบบ administrator)' },
      { id: 'perm', label: 'Share permission: Students = Change เท่านั้น (ไม่ให้ Everyone และไม่ให้ Full)', check: st => { const sh = homeworkShare(st); return !!sh && shareOk12(sh) && netBits(st, 'lab07', 'std01', sh.name, 'C:\\Share\\Homework') === 7; },
        tip: st => { const sh = homeworkShare(st); if (!sh) return 'สร้างแชร์ Homework ก่อน'; if (sh.grants.some(g => /^everyone$/i.test(g[0]))) return 'แชร์นี้ยังให้ Everyone อยู่ (ค่าเริ่มต้นเมื่อไม่ใส่ /grant) ลบแชร์แล้วสร้างใหม่โดยใส่ /grant'; if (sh.grants.some(g => g[1] === 'FULL' && !/administrators$/i.test(g[0]))) return 'ให้สิทธิ์ FULL มากเกินจำเป็น ใช้ CHANGE'; return 'ต้องให้กลุ่ม Students แบบ CHANGE'; } },
      { id: 'verify', label: 'ตรวจผลด้วย net share หลังสร้างแชร์', check: st => verifiedAfter(st, ['lab07'], /^net\s+share\b/i), tip: 'หลังสร้างหรือแก้แชร์ครั้งสุดท้าย ให้รัน net share หรือ net share Homework เพื่อตรวจผล' }
    ],
    good: [{ re: /^net\s+share\s*$/i, label: 'net share' }, { re: /^net\s+share\s+\S+=/i, label: 'net share ชื่อ=path /grant:...' }, { re: /^icacls\b/i, label: 'icacls' }],
    quick: [['net share', 1], ['net localgroup Students', 1], ['icacls C:\\Share\\Homework', 1], ['net share ', 0], ['net share /?', 1], ['cls', 1]],
    steps: [
      { cmd: 'net share', match: '^net\\s+share\\s*$', say: 'พิมพ์ net share ดูแชร์ที่มีอยู่',
        why: 'ก่อนสร้างแชร์ควรดูว่ามีแชร์อะไรอยู่แล้วบ้าง',
        explain: 'C$, ADMIN$ และ IPC$ เป็นแชร์ซ่อนของระบบ (ลงท้ายด้วย $) ยังไม่มีแชร์ Homework', mark: '\\$\\s' },
      { cmd: 'icacls C:\\Share\\Homework', match: '^icacls\\s+"?c:\\\\share\\\\homework"?\\s*$', say: 'พิมพ์ icacls C:\\Share\\Homework ดู NTFS permission',
        why: 'สิทธิ์จริงผ่านเครือข่าย = ค่าที่จำกัดกว่าระหว่าง Share permission กับ NTFS permission จึงต้องรู้ NTFS ก่อน',
        explain: 'Students มี (RX,W) = อ่าน สร้างไฟล์ใหม่ และเขียนทับไฟล์ได้ แต่ไม่มีสิทธิ์ลบ: W ส่งต่อไปถึงทุกไฟล์ด้วย (OI) นักเรียนจึงเขียนทับไฟล์งานของเพื่อนได้ แม้จะลบไม่ได้ ส่วน CREATOR OWNER:(IO)(M) บน Windows จริงทำให้ผู้สร้างไฟล์ได้ Modify กับไฟล์ของตัวเอง (แก้และลบไฟล์ตัวเองได้) ถ้าแชร์ให้ Change สิทธิ์จริงผ่านเครือข่ายก็เป็นไปตาม NTFS นี้ หมายเหตุ: เครื่องจำลองนี้ไม่ได้จำลองสิทธิ์ CREATOR OWNER', mark: 'Students' },
      { cmd: 'net share Homework=C:\\Share\\Homework /grant:Students,CHANGE', match: '^net\\s+share\\s+"?homework"?=', say: 'สร้างแชร์: net share Homework=C:\\Share\\Homework /grant:Students,CHANGE',
        why: '/grant กำหนด Share permission ถ้าไม่ใส่ Windows จะให้ Everyone แบบ Read',
        explain: 'Homework was shared successfully แปลว่าสร้างสำเร็จ เครื่องอื่นเปิดได้ที่ \\\\LAB-PC07\\Homework', mark: 'successfully' },
      { cmd: 'net share Homework', match: '^net\\s+share\\s+"?homework"?\\s*$', after: 2, say: 'ตรวจผลด้วย net share Homework',
        why: 'ยืนยัน path และ Share permission ที่ตั้งไว้ (ระบบตรวจงานจากขั้นนี้ด้วย)',
        explain: 'บรรทัด Permission แสดง LAB-PC07\\Students, CHANGE และไม่มี Everyone', mark: '^Permission|^Path' }
    ]
  },
  {
    id: 'm13', level: 'medium', week: 9, mode: 'independent', title: 'Map network drive ด้วย net use',
    desc: 'ที่ PC-STD12 (ผู้ใช้ student) ใช้ net view หาแชร์ของ LAB-PC07 แล้วผูกไดรฟ์ Z: กับแชร์ส่งงานแบบถาวร W: กับแชร์ใบงาน และยกเลิกไดรฟ์ Y: ที่เสีย',
    story: 'นักเรียนที่นั่ง PC-STD12 ต้องใช้ไดรฟ์เครือข่ายสองไดรฟ์: Z: = โฟลเดอร์ส่งงาน และ W: = โฟลเดอร์ใบงาน ซึ่งครูแชร์ไว้บนเครื่อง LAB-PC07 (192.168.20.57) แต่ไม่ได้บอกชื่อแชร์ไว้ ให้ค้นหาเอง ไดรฟ์ Z: ต้องกลับมาเองทุกครั้งที่ล็อกอิน (persistent) นอกจากนี้เครื่องนี้ยังมีไดรฟ์ Y: ที่ผูกกับเครื่องเก่าที่ปลดระวางแล้ว ให้ยกเลิกออก (คุณล็อกอินเป็น student ไม่ใช่ผู้ดูแล)',
    hints: ['net view \\\\LAB-PC07 แสดงแชร์ที่ไม่ซ่อนของเครื่องนั้น ดูคอลัมน์ Comment ว่าแชร์ไหนใช้ทำอะไร', 'net use ไม่ใส่พารามิเตอร์ แสดงไดรฟ์ที่ผูกอยู่และสถานะ (OK / Unavailable)',
      'ผูกไดรฟ์: net use Z: \\\\เครื่อง\\แชร์ /persistent:yes', 'ยกเลิก: net use <ไดรฟ์>: /delete', 'System error 85 = ตัวอักษรไดรฟ์ถูกใช้อยู่แล้ว'],
    hosts: [{ id: 'std12', os: 'windows', user: 'student' }],
    topo: {
      devices: [
        host('std12', 'pc', 'PC-STD12', '192.168.20.112', 24, '192.168.20.1', ['192.168.20.10'], '3C-52-82-20-01-12', { x: 90, y: 320,
          sys: SYS.WIN.make({ host: 'PC-STD12', users: [{ name: 'student' }], persist: false, drives: [{ local: 'Y:', remote: '\\\\OLD-SRV\\Homework', persistent: true }] }, 'student') }),
        host('lab07', 'pc', 'LAB-PC07', '192.168.20.57', 24, '192.168.20.1', ['192.168.20.10'], '00-1A-2B-3C-4D-5E', { x: 380, y: 330, services: { file: true },
          sys: SYS.WIN.make({ host: 'LAB-PC07', users: [{ name: 'teacher', groups: ['Administrators'] }, { name: 'student', groups: ['Students'] }, { name: 'std01', groups: ['Students'] }],
            groups: [{ name: 'Students' }],
            dirs: [{ path: 'C:\\Share\\Homework', protect: true, acl: ['BUILTIN\\Administrators:(OI)(CI)(F)', 'NT AUTHORITY\\SYSTEM:(OI)(CI)(F)', 'CREATOR OWNER:(OI)(CI)(IO)(M)', 'LAB-PC07\\Students:(OI)(CI)(RX,W)'] },
              { path: 'C:\\Share\\Worksheets', protect: true, acl: ['BUILTIN\\Administrators:(OI)(CI)(F)', 'NT AUTHORITY\\SYSTEM:(OI)(CI)(F)', 'LAB-PC07\\Students:(OI)(CI)(RX)'] },
              { path: 'C:\\Share\\Answers', protect: true, acl: ['BUILTIN\\Administrators:(OI)(CI)(F)', 'NT AUTHORITY\\SYSTEM:(OI)(CI)(F)'] }],
            files: [{ path: 'C:\\Share\\Worksheets\\ws08-sharing.pdf', size: 182344 }, { path: 'C:\\Share\\Worksheets\\ws09-netuse.pdf', size: 96512 }, { path: 'C:\\Share\\Answers\\ws09-key.pdf', size: 40211 }],
            shares: [{ name: 'Homework', path: 'C:\\Share\\Homework', remark: 'ส่งงาน', grants: [['Students', 'CHANGE']] }, { name: 'Worksheets', path: 'C:\\Share\\Worksheets', remark: 'ใบงาน', grants: [['Students', 'READ']] },
              { name: 'Answer$', path: 'C:\\Share\\Answers', remark: '', grants: [['teacher', 'FULL']] }, { name: 'LabPrinter', path: '', remark: 'HP LaserJet ห้องคอม 2', print: true, grants: [['Everyone', 'READ']] }] }) }),
        sw('sw1', 'SW-LAB2', 230, 200),
        router('r1', 'R-LAB2', [{ name: 'g0/0', ip: '192.168.20.1', prefix: 24 }], [], { x: 430, y: 170 })
      ],
      links: [L('l1', 'std12', 'eth0', 'sw1', 'p12'), L('l2', 'lab07', 'eth0', 'sw1', 'p7'), L('l3', 'r1', 'g0/0', 'sw1', 'p24')]
    },
    questions: [],
    tasks: [
      { id: 'z', label: 'Z: ผูกกับแชร์ส่งงานบน LAB-PC07 แบบถาวร (persistent) และสถานะ OK', check: st => driveOk(st, 'std12', 'Z:', 'lab07', 'Homework', true),
        tip: st => { const d = drive(st, 'std12', 'Z:'); if (!d) return 'ยังไม่มีไดรฟ์ Z: ใช้ net view \\\\LAB-PC07 หาชื่อแชร์ส่งงาน แล้ว net use Z: ...'; if (!driveOk(st, 'std12', 'Z:', 'lab07', 'Homework', false)) return 'Z: ไม่ได้ชี้ไปที่แชร์ส่งงาน (ดู Comment ใน net view)'; return 'Z: ยังไม่ถาวร ใช้ /persistent:yes (ยกเลิกแล้วผูกใหม่)'; } },
      { id: 'w', label: 'W: ผูกกับแชร์ใบงานบน LAB-PC07 และสถานะ OK', check: st => driveOk(st, 'std12', 'W:', 'lab07', 'Worksheets', false), tip: 'ใช้ net use W: \\\\เครื่อง\\ชื่อแชร์ใบงาน (ชื่อแชร์ดูจาก net view)' },
      { id: 'y', label: 'ยกเลิกไดรฟ์ Y: ที่ชี้ไปเครื่องที่ไม่มีแล้ว', check: st => !drive(st, 'std12', 'Y:'), tip: 'net use Y: /delete' },
      { id: 'verify', label: 'ตรวจผลด้วย net use หลังแก้ไขครั้งสุดท้าย', check: st => verifiedAfter(st, ['std12'], /^net\s+use\s*$/i), tip: 'หลังผูก/ยกเลิกไดรฟ์ครั้งสุดท้าย ให้รัน net use (ไม่มีพารามิเตอร์) เพื่อตรวจสถานะ' }
    ],
    good: [{ re: /^net\s+view\s+\\\\/i, label: 'net view \\\\เครื่อง' }, { re: /^net\s+use\s+[a-z*]:?\s+\\\\/i, label: 'net use X: \\\\เครื่อง\\แชร์' }, { re: /^net\s+use\s+[a-z]:\s+\/d/i, label: 'net use Y: /delete' }],
    quick: [['net use', 1], ['net view \\\\LAB-PC07', 1], ['net use ', 0], ['ping 192.168.20.57', 1], ['cls', 1]],
    steps: [
      { cmd: 'net use', match: '^net\\s+use\\s*$', say: 'พิมพ์ net use ดูไดรฟ์เครือข่ายที่ผูกอยู่',
        why: 'ตรวจสภาพก่อนแก้: ไดรฟ์ไหนใช้ได้ ไดรฟ์ไหนเสีย',
        explain: 'Y: มีสถานะ Unavailable เพราะเครื่อง OLD-SRV ไม่มีในเครือข่ายแล้ว', mark: '^Unavailable' },
      { cmd: 'net view \\\\LAB-PC07', match: '^net\\s+view\\s+\\\\\\\\(lab-pc07|192\\.168\\.20\\.57)\\b', say: 'พิมพ์ net view \\\\LAB-PC07 หาชื่อแชร์',
        why: 'net view แสดงแชร์ที่ไม่ซ่อนของเครื่องปลายทาง (แชร์ที่ลงท้าย $ จะไม่แสดง)',
        explain: 'คอลัมน์ Comment บอกว่าแชร์ไหนคือส่งงาน ไหนคือใบงาน แชร์ชนิด Print คือเครื่องพิมพ์ที่แชร์ไว้', mark: '\\sDisk\\s' },
      { act: 'ผูก Z: กับแชร์ส่งงานแบบถาวร (ดูชื่อแชร์จากผล net view ขั้นก่อน)', cmd: 'net use Z: \\\\LAB-PC07\\', fill: true, match: '^net\\s+use\\s+z:\\s+\\\\\\\\', say: 'ผูก Z: กับแชร์ส่งงานแบบถาวร (เติมชื่อแชร์และ /persistent:yes)',
        why: 'persistent:yes ทำให้ Windows ผูกไดรฟ์ให้ใหม่ทุกครั้งที่ล็อกอิน (เหมือนติ๊ก Reconnect at sign-in)',
        explain: 'The command completed successfully แปลว่าผูกสำเร็จ ถ้าขึ้น System error 67 แปลว่าชื่อแชร์ผิด', mark: 'successfully|error' },
      { act: 'ผูก W: กับแชร์ใบงาน (ดูชื่อแชร์จากคอลัมน์ Comment)', cmd: 'net use W: \\\\LAB-PC07\\', fill: true, match: '^net\\s+use\\s+w:\\s+\\\\\\\\', say: 'ผูก W: กับแชร์ใบงาน',
        why: 'ไดรฟ์ใบงานเปิดอ่านอย่างเดียวก็พอ', explain: 'ผูกสำเร็จแล้ว ลองเปิดด้วย dir W:\\ ได้', mark: 'successfully|error' },
      { act: 'ยกเลิกไดรฟ์ที่เสีย (net use ไดรฟ์: พร้อมตัวเลือกลบ)', cmd: 'net use Y: /delete', match: '^net\\s+use\\s+y:\\s+/d', say: 'ยกเลิก Y: ด้วย net use Y: /delete',
        why: 'ไดรฟ์ที่ชี้ไปเครื่องที่ไม่มีแล้วทำให้ล็อกอินช้าและสับสน', explain: 'Y: was deleted successfully แปลว่ายกเลิกแล้ว', mark: 'deleted' },
      { cmd: 'net use', match: '^net\\s+use\\s*$', after: 4, say: 'ตรวจผลด้วย net use อีกครั้ง',
        why: 'ยืนยันว่าทุกไดรฟ์สถานะ OK (ระบบตรวจงานจากขั้นนี้ด้วย)', explain: 'ควรเห็น W: และ Z: สถานะ OK และไม่มี Y: แล้ว', mark: '^OK' }
    ]
  },
  {
    id: 'm14', level: 'hard', week: 9, mode: 'troubleshooting', title: 'เปิดแชร์ได้ แต่บันทึกไฟล์ไม่ได้',
    desc: 'ฝ่ายขายบันทึกไฟล์ลง \\\\LAB-SRV\\Reports ไม่ได้ (Access is denied) หาสาเหตุจาก Share permission และ NTFS permission แล้วแก้ตามหลักสิทธิ์น้อยที่สุด และพิสูจน์จาก PC-SALES03',
    story: 'คุณสมศักดิ์ (ผู้ใช้ somsak ฝ่ายขาย) นั่งที่ PC-SALES03 ผูกไดรฟ์ R: ไว้กับ \\\\LAB-SRV\\Reports เปิดดูไฟล์ได้ แต่บันทึกรายงานใหม่ลงไปไม่ได้ ขึ้น Access is denied ผู้ดูแลคนก่อนสร้างแชร์นี้ไว้แบบรีบ ๆ คุณเข้าได้ทั้ง PC-SALES03 (ในฐานะ somsak) และ LAB-SRV (Command Prompt แบบ Run as administrator) ให้แก้ให้ตรงตามความต้องการในตาราง โดยไม่ให้สิทธิ์เกินจำเป็น แล้วทดลองบันทึกไฟล์จาก PC-SALES03 ให้สำเร็จ',
    hints: ['สิทธิ์จริงเมื่อเข้าผ่านเครือข่าย = ค่าที่จำกัดกว่าระหว่าง Share permission (net share ชื่อแชร์) กับ NTFS permission (icacls โฟลเดอร์)', 'net user somsak บอกว่าเขาอยู่กลุ่มใด',
      'net share แก้สิทธิ์ของแชร์ที่มีอยู่ไม่ได้ ต้อง net share ชื่อ /delete แล้วสร้างใหม่พร้อม /grant (ใส่ /grant ได้หลายครั้ง)', 'NTFS: icacls path /grant กลุ่ม:(OI)(CI)M — (OI)(CI) ทำให้ไฟล์และโฟลเดอร์ย่อยได้สิทธิ์ด้วย',
      'ทดสอบเขียนจาก PC-SALES03: echo test > R:\\test.txt (ถ้าสำเร็จจะไม่มีข้อความ)'],
    hosts: [{ id: 'sales03', os: 'windows', user: 'somsak' }, { id: 'srv', os: 'windows', user: 'Administrator' }],
    factsTitle: 'ความต้องการของแชร์ Reports',
    facts: [['ฝ่ายขาย (กลุ่ม Sales)', 'อ่าน + สร้าง/แก้ไขไฟล์'], ['ฝ่ายบัญชี (กลุ่ม Accounting)', 'อ่านอย่างเดียว'], ['พนักงานอื่น', 'อ่านอย่างเดียว'], ['ผู้ดูแล (Administrators)', 'Full control']],
    topo: {
      devices: [
        host('sales03', 'pc', 'PC-SALES03', '10.20.1.53', 24, '10.20.1.1', ['10.20.1.10'], '18-C0-4D-01-00-53', { x: 90, y: 330,
          sys: SYS.WIN.make({ host: 'PC-SALES03', users: [{ name: 'somsak' }], drives: [{ local: 'R:', remote: '\\\\LAB-SRV\\Reports', persistent: true }] }, 'somsak') }),
        host('srv', 'server', 'LAB-SRV', '10.20.1.10', 24, '10.20.1.1', ['10.20.1.10'], '00-15-5D-01-00-10', { x: 400, y: 330, services: { file: true },
          sys: SYS.WIN.make({ host: 'LAB-SRV', server: true, vols: ['C:', 'D:'],
            users: [{ name: 'somsak', full: 'Somsak Jaidee', groups: ['Sales'] }, { name: 'malee', groups: ['Sales'] }, { name: 'somchai', groups: ['Accounting'] }, { name: 'niran', comment: 'ฝ่ายบุคคล' }],
            groups: [{ name: 'Sales', comment: 'ฝ่ายขาย' }, { name: 'Accounting', comment: 'ฝ่ายบัญชี' }],
            dirs: [{ path: 'D:\\Reports', protect: true, acl: ['BUILTIN\\Administrators:(OI)(CI)(F)', 'NT AUTHORITY\\SYSTEM:(OI)(CI)(F)', 'LAB-SRV\\Accounting:(OI)(CI)(RX)', 'BUILTIN\\Users:(OI)(CI)(RX)'] }],
            files: [{ path: 'D:\\Reports\\sales-2026-09.xlsx', size: 24576 }, { path: 'D:\\Reports\\sales-2026-08.xlsx', size: 23040 }],
            shares: [{ name: 'Reports', path: 'D:\\Reports', remark: 'รายงานฝ่ายขาย', grants: [['Everyone', 'READ']] }] }, 'Administrator') }),
        sw('sw1', 'SW-OFFICE', 240, 210),
        router('r1', 'R-OFFICE', [{ name: 'g0/0', ip: '10.20.1.1', prefix: 24 }], [], { x: 430, y: 170 })
      ],
      links: [L('l1', 'sales03', 'eth0', 'sw1', 'p3'), L('l2', 'srv', 'eth0', 'sw1', 'p1'), L('l3', 'r1', 'g0/0', 'sw1', 'p24')]
    },
    questions: [],
    tasks: [
      { id: 'sales', label: 'สมาชิก Sales อ่าน สร้าง และแก้ไขไฟล์ใน \\\\LAB-SRV\\Reports ได้ (แต่ไม่ได้ Full control)',
        check: st => salesOk14(st),
        tip: st => { const sh = shareOf(st, 'srv', 'Reports'); if (!sh) return 'ไม่มีแชร์ชื่อ Reports แล้ว ไดรฟ์ R: จะใช้ไม่ได้ สร้างแชร์ชื่อเดิมกลับมา'; const sb = SYS.WIN.shareBits(sh, SYS.WIN.tokenOf(win(st, 'srv'), 'somsak', 'network')); if ((sb & 15) !== 15) return 'Share permission ยังไม่ให้ฝ่ายขายเขียน (ดู net share Reports)'; if (sb & 16 || netBits(st, 'srv', 'somsak', 'Reports', 'D:\\Reports') & 16) return 'ฝ่ายขายได้ Full control เกินจำเป็น'; return 'NTFS permission ยังไม่ให้ฝ่ายขายแก้ไขไฟล์ (ดู icacls D:\\Reports และอย่าลืม (OI)(CI) เพื่อให้ไฟล์ข้างในได้สิทธิ์ด้วย)'; } },
      { id: 'least', label: 'แก้แล้วโดยไม่ให้สิทธิ์เกิน: ฝ่ายบัญชีและพนักงานอื่นยังอ่านได้ แต่เขียน/ลบไม่ได้',
        check: st => salesOk14(st) && ['somchai', 'niran'].every(u => { const f = netBits(st, 'srv', u, 'Reports', 'D:\\Reports'), n = netBits(st, 'srv', u, 'Reports', 'D:\\Reports', true); return (f & 1) && (n & 1) && !(f & 12) && !(n & 12) && !(localBits(st, 'srv', u, 'D:\\Reports') & 12) && !(localBits(st, 'srv', u, 'D:\\Reports', true) & 12); }),
        tip: st => !salesOk14(st) ? 'แก้งานข้อแรก (ฝ่ายขาย) ให้ผ่านก่อน' : ['somchai', 'niran'].some(u => !(netBits(st, 'srv', u, 'Reports', 'D:\\Reports') & 1)) ? 'ฝ่ายบัญชีหรือพนักงานอื่นเปิดแชร์ไม่ได้แล้ว (ต้องอ่านได้)' : 'มีคนนอกฝ่ายขายเขียนหรือลบไฟล์ได้ เช่นให้ Everyone/Users เขียน ให้สิทธิ์เฉพาะกลุ่ม Sales' },
      { id: 'proof', label: 'somsak บันทึกไฟล์ใหม่ลง R: จาก PC-SALES03 ได้สำเร็จ', check: st => Object.values(win(st, 'srv').fs).some(e => !e.dir && e.by === 'somsak' && e.viaNet && /^d:\\reports\\/i.test(e.path)),
        tip: 'หลังแก้สิทธิ์แล้ว สลับไป PC-SALES03 และทดสอบเช่น echo test > R:\\test.txt จนสำเร็จ (ถ้ากดรีเซ็ตเครือข่ายต้องทำใหม่)' }
    ],
    good: [{ re: /^net\s+share\s+"?reports"?\s*$/i, label: 'net share Reports' }, { re: /^icacls\s+"?d:\\reports"?\s*$/i, label: 'icacls D:\\Reports' }, { re: /^net\s+user\s+\S+\s*$/i, label: 'net user ชื่อ' }],
    quick: { sales03: [['net use', 1], ['dir R:\\', 1], ['echo test > R:\\test.txt', 1], ['whoami', 1], ['cls', 1]], srv: [['net share', 1], ['net share Reports', 1], ['icacls D:\\Reports', 1], ['net user somsak', 1], ['net share ', 0], ['icacls ', 0], ['cls', 1]] },
    steps: [
      { host: 'sales03', cmd: 'echo test > R:\\test.txt', match: '^echo\\b.*>\\s*"?r:', say: 'บน PC-SALES03 ทดลองบันทึกไฟล์: echo test > R:\\test.txt',
        why: 'ยืนยันอาการก่อนแก้', explain: 'Access is denied = เข้าแชร์ได้แต่ไม่มีสิทธิ์เขียน ปัญหาจึงอยู่ที่สิทธิ์ ไม่ใช่เครือข่าย', mark: 'denied' },
      { host: 'srv', cmd: 'net share Reports', match: '^net\\s+share\\s+"?reports"?\\s*$', say: 'กดเลือก LAB-SRV แล้วพิมพ์ net share Reports',
        why: 'ดู Share permission ชั้นแรก', explain: 'บรรทัด Permission บอกว่าใครได้สิทธิ์ใดผ่านแชร์ ถ้าได้แค่ READ จะเขียนผ่านเครือข่ายไม่ได้เลยไม่ว่า NTFS จะให้อะไร', mark: '^Permission' },
      { host: 'srv', cmd: 'icacls D:\\Reports', match: '^icacls\\s+"?d:\\\\reports"?\\s*$', say: 'พิมพ์ icacls D:\\Reports',
        why: 'ดู NTFS permission ชั้นที่สอง', explain: 'ดูว่ากลุ่มของ somsak มีบรรทัดของตัวเองหรือไม่ และได้สิทธิ์ระดับใด', mark: '\\((F|M|RX)\\)' },
      { host: 'srv', cmd: 'net user somsak', match: '^net\\s+user\\s+somsak\\s*$', say: 'พิมพ์ net user somsak',
        why: 'สิทธิ์ส่วนใหญ่ได้มาจากกลุ่ม ต้องรู้ว่า somsak อยู่กลุ่มใด', explain: 'ดูบรรทัด Local Group Memberships', mark: '^Local Group' },
      { act: 'แก้ Share permission ของ Reports ให้ตรงตามตาราง (ลบแชร์เดิมแล้วสร้างใหม่พร้อม /grant)', host: 'srv', cmd: 'net share ', fill: true, match: '^net\\s+share\\s+"?reports"?=', say: 'แก้ Share permission (ลบแชร์เดิมแล้วสร้างใหม่พร้อม /grant ตามตาราง)',
        why: 'net share เปลี่ยนสิทธิ์ของแชร์ที่มีอยู่ไม่ได้', explain: 'ตรวจผลด้วย net share Reports', mark: 'successfully' },
      { act: 'ให้ NTFS permission ที่จำเป็นกับกลุ่มที่ต้องเขียน ด้วย icacls ... /grant', host: 'srv', cmd: 'icacls D:\\Reports /grant ', fill: true, match: '^icacls\\s+"?d:\\\\reports"?\\s+.*/grant', say: 'ให้ NTFS permission ที่จำเป็นด้วย icacls ... /grant',
        why: 'ทั้งสองชั้นต้องอนุญาต สิทธิ์จริงจึงจะได้', explain: 'processed file แปลว่าสำเร็จ ตรวจด้วย icacls D:\\Reports อีกครั้ง', mark: 'processed' },
      { host: 'sales03', cmd: 'echo test > R:\\test.txt', match: '^echo\\b.*>\\s*"?r:', after: 5, say: 'กลับไป PC-SALES03 แล้วบันทึกไฟล์อีกครั้ง',
        why: 'พิสูจน์ว่าแก้ได้จริง (ระบบตรวจงานจากไฟล์ที่บันทึกได้)', explain: 'ไม่มีข้อความ = บันทึกสำเร็จ ตรวจด้วย dir R:\\', mark: '.' }
    ]
  },
  {
    id: 'm15', level: 'easy', week: 17, mode: 'guided', title: 'สร้างบัญชีผู้ใช้และกลุ่ม Accounting',
    desc: 'ที่ PC-ACC01 (Run as administrator) สร้างบัญชี somchai และ malee สร้างกลุ่ม Accounting เพิ่มทั้งสองคนเข้ากลุ่ม แล้วตรวจด้วย net localgroup',
    story: 'ฝ่ายบัญชีรับพนักงานใหม่ 2 คน คือ สมชาย (somchai) และ มาลี (malee) ซึ่งจะใช้เครื่อง PC-ACC01 ร่วมกัน ให้สร้างบัญชีผู้ใช้มาตรฐาน (ไม่ใช่ผู้ดูแล) ให้ทั้งสองคน ตั้งรหัสผ่านเริ่มต้น สร้างกลุ่ม Accounting แล้วเพิ่มทั้งสองคนเข้ากลุ่ม เพื่อใช้กำหนดสิทธิ์โฟลเดอร์บัญชีต่อไป (คุณเปิด Command Prompt แบบ Run as administrator ไว้แล้ว)',
    hints: ['net user ชื่อ รหัสผ่าน /add สร้างบัญชี (ใช้ * แทนรหัสผ่านเพื่อไม่ให้รหัสค้างบนจอ)', 'net localgroup ชื่อกลุ่ม /add สร้างกลุ่ม', 'net localgroup ชื่อกลุ่ม ชื่อผู้ใช้ /add เพิ่มสมาชิก',
      'บัญชีใหม่อยู่ในกลุ่ม Users อัตโนมัติ ไม่ต้องเพิ่มเข้า Administrators'],
    hosts: [{ id: 'acc01', os: 'windows', user: 'Administrator' }],
    topo: {
      devices: [
        host('acc01', 'pc', 'PC-ACC01', '10.10.1.21', 24, '10.10.1.1', ['10.10.1.1'], '70-85-C2-4A-10-21', { x: 90, y: 330,
          sys: SYS.WIN.make({ host: 'PC-ACC01', users: [{ name: 'itadmin', full: 'IT Admin', groups: ['Administrators'] }] }, 'Administrator') }),
        sw('sw1', 'SW-ACC', 240, 210),
        router('r1', 'GW-ACC', [{ name: 'g0/0', ip: '10.10.1.1', prefix: 24 }], [], { x: 420, y: 180 })
      ],
      links: [L('l1', 'acc01', 'eth0', 'sw1', 'p1'), L('l2', 'r1', 'g0/0', 'sw1', 'p24')]
    },
    questions: [],
    tasks: [
      { id: 'users', label: 'มีบัญชี somchai และ malee และเปิดใช้งาน (Account active = Yes)', check: st => ['somchai', 'malee'].every(n => { const u = wuser(st, 'acc01', n); return u && u.active; }),
        tip: st => ['somchai', 'malee'].filter(n => !wuser(st, 'acc01', n)).length ? 'ยังขาดบัญชี ' + ['somchai', 'malee'].filter(n => !wuser(st, 'acc01', n)).join(', ') + ' (net user ชื่อ รหัสผ่าน /add)' : 'มีบัญชีที่ถูกปิดใช้งาน ตรวจด้วย net user ชื่อ' },
      { id: 'group', label: 'มีกลุ่ม Accounting และมีทั้ง somchai และ malee เป็นสมาชิก', check: st => ['somchai', 'malee'].every(n => inWinGroup(st, 'acc01', n, 'Accounting')),
        tip: st => !wgroup(st, 'acc01', 'Accounting') ? 'ยังไม่มีกลุ่ม Accounting (net localgroup Accounting /add)' : 'ยังมีคนที่ไม่ได้อยู่ในกลุ่ม Accounting (net localgroup Accounting ชื่อ /add)' },
      { id: 'least', label: 'ทั้งสองบัญชีเป็นผู้ใช้มาตรฐาน: อยู่ใน Users และไม่อยู่ใน Administrators', check: st => ['somchai', 'malee'].every(n => wuser(st, 'acc01', n) && inWinGroup(st, 'acc01', n, 'Users') && !inWinGroup(st, 'acc01', n, 'Administrators')),
        tip: 'พนักงานบัญชีไม่ควรเป็นผู้ดูแลเครื่อง (หลักสิทธิ์น้อยที่สุด) ถ้าเพิ่มผิดให้เอาออกด้วย net localgroup Administrators ชื่อ /delete' },
      { id: 'verify', label: 'ตรวจสมาชิกด้วย net localgroup Accounting หลังแก้ไขครั้งสุดท้าย', check: st => verifiedAfter(st, ['acc01'], /^net\s+localgroup\s+"?accounting"?\s*$/i), tip: 'รัน net localgroup Accounting หลังเพิ่มสมาชิกเสร็จ' }
    ],
    good: [{ re: /^net\s+user\s+\S+\s+\S+\s+\/add/i, label: 'net user ชื่อ รหัส /add' }, { re: /^net\s+localgroup\s+\S+\s+\/add/i, label: 'net localgroup กลุ่ม /add' }, { re: /^net\s+user\s+\S+\s*$/i, label: 'net user ชื่อ (ตรวจ)' }],
    quick: [['net user', 1], ['net localgroup', 1], ['net user ', 0], ['net localgroup ', 0], ['cls', 1]],
    steps: [
      { cmd: 'net user', match: '^net\\s+users?\\s*$', say: 'พิมพ์ net user ดูบัญชีที่มีอยู่', why: 'ตรวจว่ายังไม่มีบัญชีชื่อซ้ำ', explain: 'นอกจากบัญชีที่สร้างเอง ยังมีบัญชี built-in เช่น Administrator, Guest, DefaultAccount', mark: 'Administrator|Guest' },
      { cmd: 'net user somchai * /add', match: '^net\\s+user\\s+somchai\\s+\\S+\\s+/add', say: 'สร้างบัญชี somchai: net user somchai * /add',
        why: 'ใส่ * แทนรหัสผ่าน ระบบจะถามรหัสโดยไม่แสดงบนจอ (ปลอดภัยกว่าพิมพ์รหัสต่อท้าย)', explain: 'The command completed successfully แปลว่าสร้างแล้ว บัญชีใหม่อยู่กลุ่ม Users อัตโนมัติ', mark: 'successfully' },
      { cmd: 'net user malee * /add', match: '^net\\s+user\\s+malee\\s+\\S+\\s+/add', say: 'สร้างบัญชี malee แบบเดียวกัน', why: 'พนักงานแต่ละคนต้องมีบัญชีของตัวเอง ตรวจสอบย้อนหลังได้ว่าใครทำอะไร', explain: 'สร้างสำเร็จแล้ว', mark: 'successfully' },
      { cmd: 'net localgroup Accounting /add', match: '^net\\s+localgroup\\s+"?accounting"?\\s+/add', say: 'สร้างกลุ่ม: net localgroup Accounting /add', why: 'กำหนดสิทธิ์ให้กลุ่มแทนรายคน จัดการง่ายเมื่อคนเข้า-ออก', explain: 'สร้างกลุ่มสำเร็จ ตอนนี้ยังไม่มีสมาชิก', mark: 'successfully' },
      { cmd: 'net localgroup Accounting somchai malee /add', match: '^net\\s+localgroup\\s+"?accounting"?\\s+\\S+.*/add', say: 'เพิ่มสมาชิก: net localgroup Accounting somchai malee /add', why: 'ใส่ชื่อผู้ใช้หลายคนในคำสั่งเดียวได้', explain: 'เพิ่มสมาชิกสำเร็จ', mark: 'successfully' },
      { cmd: 'net localgroup Accounting', match: '^net\\s+localgroup\\s+"?accounting"?\\s*$', after: 4, say: 'ตรวจด้วย net localgroup Accounting', why: 'ยืนยันสมาชิก (ระบบตรวจงานจากขั้นนี้ด้วย)', explain: 'ใต้ Members ต้องมี somchai และ malee', mark: '^(somchai|malee)$' }
    ]
  },
  {
    id: 'm16', level: 'medium', week: 17, mode: 'troubleshooting', title: 'ตรวจบัญชีเสี่ยงบน PC-OFFICE02',
    desc: 'ที่ PC-OFFICE02 (Run as administrator) ตรวจบัญชีและกลุ่ม Administrators เทียบกับรายชื่อพนักงาน แล้วแก้บัญชีที่เป็นความเสี่ยงตามหลักสิทธิ์น้อยที่สุด',
    story: 'ก่อนการตรวจสอบความปลอดภัยประจำปี หัวหน้าให้คุณตรวจเครื่อง PC-OFFICE02 ซึ่งหลายคนใช้ร่วมกัน เทียบบัญชีในเครื่องกับรายชื่อพนักงานด้านล่าง แล้วแก้ทุกจุดที่เสี่ยง: บัญชีที่ไม่ควรใช้งานได้ ต้องปิด (ฝ่ายบุคคลขอให้เก็บบัญชีของคนที่ลาออกไว้ 90 วันเพื่อตรวจไฟล์ จึงห้ามลบ) และกลุ่ม Administrators ต้องมีเฉพาะผู้ดูแลระบบ (คุณเปิด Command Prompt แบบ Run as administrator ไว้แล้ว)',
    hints: ['net user แสดงบัญชีทั้งหมด net user ชื่อ ดู Account active และกลุ่มที่สังกัด', 'net localgroup Administrators แสดงสมาชิกกลุ่มผู้ดูแล',
      'ปิดบัญชี: net user ชื่อ /active:no', 'เอาออกจากกลุ่ม: net localgroup Administrators ชื่อ /delete', 'บัญชี Guest ควรปิดไว้เสมอ'],
    hosts: [{ id: 'off02', os: 'windows', user: 'Administrator' }],
    factsTitle: 'รายชื่อพนักงานที่ใช้เครื่องนี้ (จากฝ่ายบุคคล)',
    facts: [['itadmin', 'ผู้ดูแลระบบ (IT)'], ['somchai', 'พนักงานบัญชี'], ['malee', 'พนักงานขาย'], ['kanya', 'ลาออกแล้ว (เก็บบัญชีไว้ 90 วัน)']],
    topo: {
      devices: [
        host('off02', 'pc', 'PC-OFFICE02', '192.168.30.62', 24, '192.168.30.1', ['192.168.30.10'], 'E4-54-E8-30-00-62', { x: 90, y: 330,
          sys: SYS.WIN.make({ host: 'PC-OFFICE02', users: [{ name: 'itadmin', full: 'IT Admin', groups: ['Administrators'] }, { name: 'somchai', full: 'Somchai Rakdee', groups: ['Administrators'] }, { name: 'malee', full: 'Malee Sukjai' },
            { name: 'kanya', full: 'Kanya Meesuk', groups: ['Administrators', 'Remote Desktop Users'] }, { name: 'Guest', active: true }] }, 'Administrator') }),
        sw('sw1', 'SW-OFFICE', 240, 210),
        router('r1', 'R-OFFICE', [{ name: 'g0/0', ip: '192.168.30.1', prefix: 24 }], [], { x: 420, y: 180 })
      ],
      links: [L('l1', 'off02', 'eth0', 'sw1', 'p2'), L('l2', 'r1', 'g0/0', 'sw1', 'p24')]
    },
    questions: [],
    tasks: [
      { id: 'guest', label: 'บัญชี Guest ถูกปิดใช้งาน', check: st => { const u = wuser(st, 'off02', 'Guest'); return !!u && !u.active; }, tip: 'ดู Account active ของบัญชี Guest แล้วปิดด้วย /active:no' },
      { id: 'kanya', label: 'บัญชีของคนที่ลาออกถูกปิดใช้งาน (ไม่ลบ) และไม่มีสิทธิ์ผู้ดูแลหรือ Remote Desktop แล้ว',
        check: st => { const u = wuser(st, 'off02', 'kanya'); return !!u && !u.active && !inWinGroup(st, 'off02', 'kanya', 'Administrators') && !inWinGroup(st, 'off02', 'kanya', 'Remote Desktop Users'); },
        tip: st => !wuser(st, 'off02', 'kanya') ? 'บัญชี kanya ถูกลบไปแล้ว แต่ฝ่ายบุคคลขอให้เก็บไว้ (กดรีเซ็ตเครือข่ายเพื่อเริ่มใหม่ แล้วใช้ /active:no แทนการลบ)' : wuser(st, 'off02', 'kanya').active ? 'บัญชี kanya ยังเปิดใช้งานอยู่' : 'kanya ยังอยู่ในกลุ่มที่มีสิทธิ์พิเศษ ดูบรรทัด Local Group Memberships ของ net user kanya' },
      { id: 'admins', label: 'Administrators มีเฉพาะ Administrator และ itadmin ส่วนพนักงานทั่วไปยังใช้งานได้ตามปกติ (active, อยู่ใน Users)',
        check: st => { const g = wgroup(st, 'off02', 'Administrators'); const mem = g ? g.members.map(m => m.toLowerCase().replace(/^.*\\/, '')).sort().join(',') : ''; return mem === 'administrator,itadmin' && ['somchai', 'malee', 'itadmin'].every(n => { const u = wuser(st, 'off02', n); return u && u.active && (n === 'itadmin' || inWinGroup(st, 'off02', n, 'Users')); }); },
        tip: st => { const g = wgroup(st, 'off02', 'Administrators'); if (g && !g.members.some(m => /itadmin$/i.test(m))) return 'itadmin ต้องยังเป็นผู้ดูแล อย่าเอาออก'; if (['somchai', 'malee'].some(n => !wuser(st, 'off02', n) || !wuser(st, 'off02', n).active)) return 'พนักงานที่ยังทำงานอยู่ต้องใช้บัญชีได้ตามปกติ'; return 'ยังมีพนักงานทั่วไปอยู่ในกลุ่ม Administrators (เทียบกับรายชื่อพนักงาน)'; } },
      { id: 'verify', label: 'ตรวจด้วย net localgroup Administrators หลังแก้ไขครั้งสุดท้าย', check: st => verifiedAfter(st, ['off02'], /^net\s+localgroup\s+"?administrators"?\s*$/i), tip: 'รัน net localgroup Administrators หลังแก้เสร็จเพื่อยืนยัน' }
    ],
    good: [{ re: /^net\s+localgroup\s+"?administrators"?\s*$/i, label: 'net localgroup Administrators' }, { re: /^net\s+user\s+\S+\s*$/i, label: 'net user ชื่อ' }, { re: /\/active:no/i, label: 'net user ชื่อ /active:no' }],
    quick: [['net user', 1], ['net localgroup Administrators', 1], ['net user ', 0], ['net localgroup ', 0], ['cls', 1]],
    steps: [
      { cmd: 'net user', match: '^net\\s+users?\\s*$', say: 'พิมพ์ net user ดูบัญชีทั้งหมด', why: 'เทียบรายชื่อบัญชีกับรายชื่อพนักงาน', explain: 'มีบัญชีของทุกคนในรายชื่อ และบัญชี built-in ต่อไปให้ตรวจทีละบัญชีที่น่าสงสัย', mark: 'kanya|Guest' },
      { cmd: 'net localgroup Administrators', match: '^net\\s+localgroup\\s+"?administrators"?\\s*$', say: 'พิมพ์ net localgroup Administrators', why: 'ผู้ดูแลทำได้ทุกอย่างกับเครื่อง ต้องมีเฉพาะคนที่จำเป็น', explain: 'เทียบรายชื่อใต้ Members กับตารางพนักงาน ใครไม่ใช่ผู้ดูแลระบบไม่ควรอยู่ที่นี่', mark: '^(itadmin|somchai|kanya|Administrator)$' },
      { cmd: 'net user Guest', match: '^net\\s+user\\s+guest\\s*$', say: 'พิมพ์ net user Guest', why: 'Guest เป็นบัญชี built-in ที่ไม่มีรหัสผ่าน ควรปิดเสมอ', explain: 'ดูบรรทัด Account active และ Password required', mark: '^Account active|^Password required' },
      { cmd: 'net user kanya', match: '^net\\s+user\\s+kanya\\s*$', say: 'พิมพ์ net user kanya', why: 'ดูสถานะและกลุ่มของคนที่ลาออก', explain: 'ดู Account active และ Local Group Memberships (มีกลุ่มอะไรบ้างที่ต้องเอาออก)', mark: '^Account active|^Local Group|^\\s{29}\\*' },
      { act: 'ปิดบัญชีที่ไม่ควรใช้งาน (ตัดสินจากรายชื่อพนักงานและผลที่ตรวจ)', cmd: 'net user ', fill: true, match: '^net\\s+user\\s+\\S+\\s+/active:no', say: 'ปิดบัญชีที่ไม่ควรใช้งานด้วย net user ชื่อ /active:no', why: 'ปิดแทนการลบ: กลับมาเปิดได้ถ้าจำเป็น และไฟล์ยังอยู่', explain: 'ปิดแล้ว ตรวจด้วย net user ชื่อ', mark: 'successfully' },
      { act: 'เอาคนที่ไม่ใช่ผู้ดูแลออกจากกลุ่ม Administrators', cmd: 'net localgroup Administrators ', fill: true, match: '^net\\s+localgroup\\s+"?administrators"?\\s+\\S+.*/delete', say: 'เอาคนที่ไม่ใช่ผู้ดูแลออกจาก Administrators', why: 'หลักสิทธิ์น้อยที่สุด', explain: 'เอาออกแล้ว บัญชียังใช้งานได้ในฐานะผู้ใช้มาตรฐาน (กลุ่ม Users)', mark: 'successfully' },
      { cmd: 'net localgroup Administrators', match: '^net\\s+localgroup\\s+"?administrators"?\\s*$', after: 5, say: 'ตรวจด้วย net localgroup Administrators อีกครั้ง', why: 'ยืนยันผล (ระบบตรวจงานจากขั้นนี้ด้วย)', explain: 'ควรเหลือ Administrator และ itadmin', mark: '^(itadmin|Administrator)$' }
    ]
  },
  {
    id: 'm17', level: 'medium', week: 17, mode: 'independent', title: 'Linux: สร้างผู้ใช้และจัดกลุ่ม staff',
    desc: 'ที่ srv-files (Ubuntu, ผู้ใช้ student ใช้ sudo ได้) สร้างผู้ใช้ nida พร้อม home และรหัสผ่านในกลุ่ม staff และเพิ่ม arthit เข้า staff โดยไม่ให้กลุ่มเดิมหาย',
    story: 'เซิร์ฟเวอร์ไฟล์ srv-files (Ubuntu Server) ใช้กลุ่ม staff กำหนดสิทธิ์โฟลเดอร์งานกลาง ให้คุณ (1) สร้างผู้ใช้ใหม่ชื่อ nida ที่มีโฟลเดอร์ home ตั้งรหัสผ่านให้ และให้อยู่ในกลุ่ม staff (2) เพิ่มผู้ใช้ arthit ที่มีอยู่แล้วเข้ากลุ่ม staff ด้วย ระวัง: arthit ยังต้องอยู่ในกลุ่ม developers ตามเดิม (คุณล็อกอินเป็น student ซึ่งใช้ sudo ได้)',
    hints: ['id ชื่อ หรือ groups ชื่อ แสดงกลุ่มที่ผู้ใช้สังกัด', 'รูปแบบ: sudo useradd -m -G <กลุ่มเสริม> <ชื่อผู้ใช้> (-m สร้าง home, -G กลุ่มเสริม) หรือ sudo adduser <ชื่อผู้ใช้> แล้ว sudo adduser <ชื่อผู้ใช้> <กลุ่ม>',
      'sudo passwd <ชื่อผู้ใช้> ตั้งรหัสผ่าน (useradd อย่างเดียวยังล็อกอินไม่ได้)', 'usermod -G โดยไม่มี -a จะแทนที่กลุ่มเสริมทั้งหมด ต้องใช้ -aG (append) เพื่อเพิ่มโดยไม่ลบกลุ่มเดิม', 'ถ้าสร้างผิด ลบด้วย sudo userdel -r <ชื่อผู้ใช้> แล้วสร้างใหม่'],
    hosts: [{ id: 'files', os: 'linux', user: 'student' }],
    topo: {
      devices: [
        host('files', 'server', 'srv-files', '172.16.20.15', 24, '172.16.20.1', ['172.16.20.1'], '52-54-00-16-20-15', { os: 'linux', x: 400, y: 330, services: { file: true, ssh: true },
          sys: SYS.LX.make({ host: 'srv-files', groups: [{ name: 'developers', gid: 1100 }], users: [{ name: 'arthit', groups: ['developers'] }, { name: 'kanda', groups: ['staff'] }] }, 'student') }),
        host('pc1', 'pc', 'PC-ADMIN', '172.16.20.31', 24, '172.16.20.1', ['172.16.20.1'], '18-C0-4D-16-20-31', { x: 90, y: 330 }),
        sw('sw1', 'SW-SRV', 240, 210),
        router('r1', 'R-SRV', [{ name: 'g0/0', ip: '172.16.20.1', prefix: 24 }], [], { x: 420, y: 170 })
      ],
      links: [L('l1', 'files', 'eth0', 'sw1', 'p1'), L('l2', 'pc1', 'eth0', 'sw1', 'p5'), L('l3', 'r1', 'g0/0', 'sw1', 'p24')]
    },
    questions: [],
    tasks: [
      { id: 'nida', label: 'มีผู้ใช้ nida ที่มีโฟลเดอร์ home ของตัวเอง และตั้งรหัสผ่านแล้ว', check: st => { const s = lsys(st, 'files'); const u = SYS.LX.user(s, 'nida'); const h = u && s.fs[u.home]; return !!u && !!h && h.dir && h.owner === 'nida' && u.pw === 'set'; },
        tip: st => { const s = lsys(st, 'files'); const u = SYS.LX.user(s, 'nida'); if (!u) return 'ยังไม่มีผู้ใช้ nida'; if (!s.fs[u.home]) return 'nida ยังไม่มีโฟลเดอร์ home (useradd ต้องใส่ -m) ลบแล้วสร้างใหม่ หรือใช้ adduser'; if (u.pw !== 'set') return 'nida ยังไม่มีรหัสผ่าน (sudo passwd nida)'; return 'โฟลเดอร์ home ต้องเป็นของ nida'; } },
      { id: 'nidastaff', label: 'nida อยู่ในกลุ่ม staff', check: st => lnxInGroup(st, 'files', 'nida', 'staff'), tip: 'ตรวจด้วย id nida แล้วเพิ่มเข้า staff' },
      { id: 'arthit', label: 'arthit อยู่ในกลุ่ม staff และยังอยู่ในกลุ่ม developers', check: st => lnxInGroup(st, 'files', 'arthit', 'staff') && lnxInGroup(st, 'files', 'arthit', 'developers'),
        tip: st => !lnxInGroup(st, 'files', 'arthit', 'developers') ? 'arthit หลุดจากกลุ่ม developers (usermod -G โดยไม่มี -a แทนที่กลุ่มเดิม) เพิ่มกลับให้ถูกต้อง' : 'arthit ยังไม่อยู่ในกลุ่ม staff' },
      { id: 'verify', label: 'ตรวจด้วย id / groups / getent group หลังแก้ไขครั้งสุดท้าย', check: st => verifiedAfter(st, ['files'], /^(sudo\s+)?(id|groups|getent\s+group|cat\s+\/etc\/group)\b/), tip: 'รัน id nida และ id arthit (หรือ getent group staff) หลังแก้เสร็จ' }
    ],
    good: [{ re: /^(sudo\s+)?(useradd|adduser)\b/, label: 'useradd / adduser' }, { re: /^(sudo\s+)?(usermod\s+.*-a|gpasswd\s+-a|adduser\s+\S+\s+\S+\s*$)/, label: 'usermod -aG (หรือ gpasswd -a)' }, { re: /^(sudo\s+)?(id|groups)\b/, label: 'id / groups' }],
    quick: [['id arthit', 1], ['getent group staff', 1], ['id ', 0], ['sudo useradd ', 0], ['sudo usermod ', 0], ['ls -l /home', 1], ['clear', 1]],
    steps: [
      { cmd: 'id arthit', match: '^id\\s+arthit\\s*$', say: 'พิมพ์ id arthit', why: 'ดูกลุ่มเดิมของ arthit ก่อนแก้', explain: 'groups= แสดงทุกกลุ่ม: กลุ่มชื่อเดียวกับผู้ใช้คือกลุ่มหลัก developers คือกลุ่มเสริมที่ต้องคงไว้', mark: 'groups=' },
      { cmd: 'getent group staff', match: '^getent\\s+group\\s+staff\\s*$', say: 'พิมพ์ getent group staff', why: 'ดูสมาชิกปัจจุบันของ staff', explain: 'รูปแบบ ชื่อกลุ่ม:x:GID:สมาชิก (คั่นด้วย ,)', mark: '^staff:' },
      { act: 'สร้างผู้ใช้ nida พร้อม home และกลุ่มเสริมตามโจทย์ (useradd หรือ adduser)', cmd: 'sudo useradd -m -G staff -s /bin/bash nida', match: '^sudo\\s+(useradd|adduser)\\b.*nida', say: 'สร้าง nida: sudo useradd -m -G staff -s /bin/bash nida',
        why: '-m สร้าง /home/nida, -G staff กลุ่มเสริม, -s shell ที่ใช้', explain: 'Linux ไม่แสดงข้อความเมื่อสำเร็จ', mark: '$^' },
      { act: 'ตั้งรหัสผ่านให้บัญชีที่เพิ่งสร้าง', cmd: 'sudo passwd nida', match: '^sudo\\s+passwd\\s+nida\\s*$', say: 'ตั้งรหัสผ่าน: sudo passwd nida', why: 'บัญชีที่สร้างด้วย useradd ยังไม่มีรหัสผ่าน จึงล็อกอินไม่ได้', explain: 'password updated successfully แปลว่าตั้งแล้ว', mark: 'successfully' },
      { act: 'เพิ่ม arthit เข้ากลุ่มตามโจทย์ โดยไม่ให้กลุ่มเดิมหาย', cmd: 'sudo usermod -aG staff arthit', match: '^sudo\\s+(usermod\\s+.*arthit|gpasswd\\s+-a\\s+arthit|adduser\\s+arthit\\s+staff)', say: 'เพิ่ม arthit: sudo usermod -aG staff arthit', why: '-a (append) สำคัญมาก ถ้าไม่มีกลุ่ม developers จะหายไป', explain: 'สำเร็จโดยไม่มีข้อความ', mark: '$^' },
      { cmd: 'id arthit', match: '^(id|groups)\\s+arthit\\s*$', after: 4, say: 'ตรวจด้วย id arthit และ id nida', why: 'ยืนยันผล (ระบบตรวจงานจากขั้นนี้ด้วย)', explain: 'arthit ต้องมีทั้ง developers และ staff', mark: 'groups=' }
    ]
  },
  {
    id: 'm18', level: 'easy', week: 18, mode: 'guided', title: 'Linux: ตั้งสิทธิ์โฟลเดอร์โครงการ 750',
    desc: 'ที่ srv-proj (Ubuntu) ตั้ง /srv/project ให้เป็นของ root กลุ่ม staff สิทธิ์ 750 และไฟล์ budget.ods เป็น 640 กลุ่ม staff แล้วตรวจด้วย ls -l',
    story: 'โฟลเดอร์ /srv/project ถูกตั้งสิทธิ์เป็น 777 (ทุกคนอ่าน เขียน ลบได้) ซึ่งอันตราย ตามหลักสิทธิ์น้อยที่สุดต้องเป็น: เจ้าของ root ทำได้ทุกอย่าง กลุ่ม staff เข้าไปอ่านได้ คนอื่นห้ามเข้า (750) และไฟล์ budget.ods ให้ nida (เจ้าของ) อ่านเขียน กลุ่ม staff อ่านได้ คนอื่นไม่มีสิทธิ์ (640) (คุณล็อกอินเป็น student ใช้ sudo ได้)',
    hints: ['ls -ld /srv/project ดูสิทธิ์ของโฟลเดอร์เอง ls -l /srv/project ดูไฟล์ข้างใน', 'rwx = 4+2+1: rwxr-x--- = 750, rw-r----- = 640',
      'sudo chown root:staff path เปลี่ยนเจ้าของและกลุ่ม sudo chgrp staff path เปลี่ยนเฉพาะกลุ่ม', 'ทดสอบในฐานะผู้ใช้อื่น: sudo -u arthit ls /srv/project'],
    hosts: [{ id: 'proj', os: 'linux', user: 'student' }],
    topo: {
      devices: [
        host('proj', 'server', 'srv-proj', '172.16.30.20', 24, '172.16.30.1', ['172.16.30.1'], '52-54-00-16-30-20', { os: 'linux', x: 400, y: 330, services: { ssh: true },
          sys: SYS.LX.make({ host: 'srv-proj', users: [{ name: 'nida', groups: ['staff'] }, { name: 'arthit' }],
            files: [{ path: '/srv/project', dir: true, mode: 0o777 }, { path: '/srv/project/budget.ods', mode: 0o666, owner: 'nida', group: 'nida', size: 18234 }, { path: '/srv/project/readme.txt', mode: 0o644, size: 64, content: 'Project files - staff only\n' }] }, 'student') }),
        sw('sw1', 'SW-SRV', 240, 210),
        router('r1', 'R-SRV', [{ name: 'g0/0', ip: '172.16.30.1', prefix: 24 }], [], { x: 420, y: 170 })
      ],
      links: [L('l1', 'proj', 'eth0', 'sw1', 'p1'), L('l2', 'r1', 'g0/0', 'sw1', 'p24')]
    },
    questions: [],
    tasks: [
      { id: 'owner', label: '/srv/project เจ้าของ root กลุ่ม staff', check: st => { const e = lsys(st, 'proj').fs['/srv/project']; return !!e && e.owner === 'root' && e.group === 'staff'; }, tip: 'ใช้ ls -ld /srv/project ดูเจ้าของและกลุ่ม แล้วแก้ด้วย chown หรือ chgrp (ต้องใช้ sudo)' },
      { id: 'mode', label: '/srv/project มีสิทธิ์ rwxr-x--- (750)', check: st => { const e = lsys(st, 'proj').fs['/srv/project']; return !!e && (e.mode & 0o777) === 0o750 && !(e.mode & 0o5000); }, tip: st => { const e = lsys(st, 'proj').fs['/srv/project']; return e ? `ตอนนี้เป็น ${SYS.LX.modeStr(e)} ยังไม่ใช่ rwxr-x---` : 'ไม่พบ /srv/project'; } },
      { id: 'file', label: 'budget.ods เป็น rw-r----- (640) กลุ่ม staff และยังเป็นของ nida', check: st => { const e = lsys(st, 'proj').fs['/srv/project/budget.ods']; return !!e && (e.mode & 0o7777) === 0o640 && e.group === 'staff' && e.owner === 'nida'; },
        tip: st => { const e = lsys(st, 'proj').fs['/srv/project/budget.ods']; if (!e) return 'ไม่พบ budget.ods'; if (e.owner !== 'nida') return 'เจ้าของไฟล์ต้องยังเป็น nida'; return `ตอนนี้เป็น ${SYS.LX.modeStr(e)} ${e.owner} ${e.group}`; } },
      { id: 'verify', label: 'ตรวจด้วย ls -l / ls -ld หลังแก้ไขครั้งสุดท้าย', check: st => verifiedAfter(st, ['proj'], /^(sudo\s+(-u\s+\S+\s+)?)?ls\s+.*-\w*l/), tip: 'รัน ls -ld /srv/project และ sudo ls -l /srv/project หลังแก้เสร็จ' }
    ],
    good: [{ re: /^(sudo\s+)?ls\s+.*-\w*d/, label: 'ls -ld' }, { re: /^(sudo\s+)?chmod\b/, label: 'chmod' }, { re: /^(sudo\s+)?(chown|chgrp)\b/, label: 'chown / chgrp' }],
    quick: [['ls -ld /srv/project', 1], ['sudo ls -l /srv/project', 1], ['id nida', 1], ['sudo chmod ', 0], ['sudo chown ', 0], ['clear', 1]],
    steps: [
      { cmd: 'ls -ld /srv/project', match: '^(sudo\\s+)?ls\\s+-\\w*d\\w*\\s+/srv/project/?\\s*$', say: 'พิมพ์ ls -ld /srv/project', why: '-d แสดงสิทธิ์ของโฟลเดอร์เอง (ไม่ใช่ไฟล์ข้างใน)', explain: 'drwxrwxrwx = ทุกคนอ่าน เขียน และเข้าโฟลเดอร์ได้ (777) เจ้าของ root กลุ่ม root', mark: '^d' },
      { cmd: 'sudo chown root:staff /srv/project', match: '^sudo\\s+(chown\\s+(root)?:staff|chgrp\\s+staff)\\s+/srv/project/?\\s*$', say: 'เปลี่ยนกลุ่ม: sudo chown root:staff /srv/project', why: 'ให้กลุ่ม staff เป็นกลุ่มของโฟลเดอร์ สิทธิ์ชุดกลาง (g) จะใช้กับสมาชิก staff', explain: 'สำเร็จโดยไม่มีข้อความ', mark: '$^' },
      { cmd: 'sudo chmod 750 /srv/project', match: '^sudo\\s+chmod\\s+\\S+\\s+/srv/project/?\\s*$', say: 'ตั้งสิทธิ์: sudo chmod 750 /srv/project', why: '7 = rwx (เจ้าของ), 5 = r-x (กลุ่ม), 0 = --- (คนอื่น)', explain: 'สำเร็จโดยไม่มีข้อความ', mark: '$^' },
      { cmd: 'sudo chgrp staff /srv/project/budget.ods', match: '^sudo\\s+(chgrp\\s+staff|chown\\s+(nida)?:staff)\\s+/srv/project/budget\\.ods\\s*$', say: 'เปลี่ยนกลุ่มไฟล์: sudo chgrp staff /srv/project/budget.ods', why: 'กลุ่ม staff ต้องอ่านไฟล์นี้ได้ เจ้าของ (nida) คงเดิม', explain: 'สำเร็จ', mark: '$^' },
      { cmd: 'sudo chmod 640 /srv/project/budget.ods', match: '^sudo\\s+chmod\\s+\\S+\\s+/srv/project/budget\\.ods\\s*$', say: 'ตั้งสิทธิ์ไฟล์: sudo chmod 640 /srv/project/budget.ods', why: '6 = rw- (เจ้าของ), 4 = r-- (กลุ่ม), 0 = --- (คนอื่น)', explain: 'สำเร็จ', mark: '$^' },
      { cmd: 'sudo ls -l /srv/project', match: '^(sudo\\s+)?ls\\s+-\\w*l\\w*\\s+/srv/project/?\\s*$', after: 4, say: 'ตรวจด้วย sudo ls -l /srv/project และ ls -ld /srv/project', why: 'student ไม่อยู่กลุ่ม staff จึงเข้าโฟลเดอร์ 750 ไม่ได้ ต้องใช้ sudo (ระบบตรวจงานจากขั้นนี้ด้วย)', explain: 'budget.ods ต้องเป็น -rw-r----- nida staff', mark: 'budget' }
    ]
  },
  {
    id: 'm19', level: 'medium', week: 18, mode: 'independent', title: 'icacls: ให้ Accounting แก้ไข D:\\Projects และเอา Everyone ออก',
    desc: 'ที่ FS-01 (Windows Server, Run as administrator) ให้กลุ่ม Accounting มีสิทธิ์ Modify ที่ D:\\Projects ทั้งโฟลเดอร์และไฟล์ข้างใน เอา Everyone ออก และตรวจด้วย icacls',
    story: 'โฟลเดอร์ D:\\Projects บน FS-01 ถูกตั้งค่าให้ Everyone มี Full control ทำให้ทุกบัญชีในเครื่องลบหรือเปลี่ยนสิทธิ์ไฟล์ได้ ให้แก้ NTFS permission ตามหลักสิทธิ์น้อยที่สุด: กลุ่ม Accounting ต้องอ่าน สร้าง แก้ไข และลบไฟล์ได้ทั้งในโฟลเดอร์และโฟลเดอร์ย่อย (Modify) คนอื่นที่ไม่ใช่ Accounting ไม่ต้องมีสิทธิ์ ส่วน Administrators และ SYSTEM ต้องคง Full control ไว้ (คุณเปิด Command Prompt แบบ Run as administrator ไว้แล้ว)',
    hints: ['icacls D:\\Projects แสดง ACE ทีละบรรทัด (OI)(CI) = ส่งต่อให้ไฟล์และโฟลเดอร์ย่อย', 'รูปแบบการให้สิทธิ์: icacls <path> /grant <กลุ่ม>:(OI)(CI)<สิทธิ์> (F = Full control, M = Modify, RX = Read & execute)',
      'รูปแบบการเอาออก: icacls <path> /remove <ชื่อผู้ใช้หรือกลุ่ม>', 'ถ้าไม่ใส่ (OI)(CI) สิทธิ์จะมีผลกับตัวโฟลเดอร์อย่างเดียว ไฟล์ข้างในไม่ได้สิทธิ์', 'ตรวจไฟล์ข้างในด้วย icacls D:\\Projects\\*'],
    hosts: [{ id: 'fs01', os: 'windows', user: 'Administrator' }],
    topo: {
      devices: [
        host('fs01', 'server', 'FS-01', '192.168.50.10', 24, '192.168.50.1', ['192.168.50.10'], '00-15-5D-50-00-10', { x: 400, y: 330, services: { file: true },
          sys: SYS.WIN.make({ host: 'FS-01', server: true, vols: ['C:', 'D:'],
            users: [{ name: 'somchai', groups: ['Accounting'] }, { name: 'malee', groups: ['Accounting'] }, { name: 'somsak', groups: ['Sales'] }],
            groups: [{ name: 'Accounting', comment: 'ฝ่ายบัญชี' }, { name: 'Sales', comment: 'ฝ่ายขาย' }],
            dirs: [{ path: 'D:\\Projects', protect: true, acl: ['BUILTIN\\Administrators:(OI)(CI)(F)', 'NT AUTHORITY\\SYSTEM:(OI)(CI)(F)', 'CREATOR OWNER:(OI)(CI)(IO)(F)', 'Everyone:(OI)(CI)(F)'] }, { path: 'D:\\Projects\\2027' }],
            files: [{ path: 'D:\\Projects\\plan-2027.xlsx', size: 51200 }, { path: 'D:\\Projects\\2027\\budget.xlsx', size: 30720 }] }, 'Administrator') }),
        sw('sw1', 'SW-SRV', 240, 210),
        router('r1', 'R-SRV', [{ name: 'g0/0', ip: '192.168.50.1', prefix: 24 }], [], { x: 420, y: 170 })
      ],
      links: [L('l1', 'fs01', 'eth0', 'sw1', 'p1'), L('l2', 'r1', 'g0/0', 'sw1', 'p24')]
    },
    questions: [],
    tasks: [
      { id: 'acct', label: 'Accounting มี Modify ที่ D:\\Projects และส่งต่อถึงไฟล์และโฟลเดอร์ย่อย (ไม่ใช่ Full control)',
        check: st => acct19(st),
        tip: st => { const b = localBits(st, 'fs01', 'somchai', 'D:\\Projects'); if (b & 16) return 'Accounting (หรือ Everyone) ยังได้ Full control เกินจำเป็น'; if ((b & 15) === 15 && (localBits(st, 'fs01', 'somchai', 'D:\\Projects', true) & 15) !== 15) return 'สิทธิ์ยังไม่ส่งต่อถึงไฟล์ข้างใน: ต้องใส่ (OI)(CI)'; return 'Accounting ยังไม่มีสิทธิ์ Modify (M)'; } },
      { id: 'everyone', label: 'ไม่มี Everyone ใน ACL และผู้ที่ไม่ใช่ Accounting (เช่น somsak) เข้าโฟลเดอร์ไม่ได้', check: st => !SYS.WIN.aclOf(win(st, 'fs01'), 'd:\\projects').some(a => /^everyone$/i.test(a.sid)) && localBits(st, 'fs01', 'somsak', 'D:\\Projects') === 0 && localBits(st, 'fs01', 'somsak', 'D:\\Projects', true) === 0,
        tip: st => SYS.WIN.aclOf(win(st, 'fs01'), 'd:\\projects').some(a => /^everyone$/i.test(a.sid)) ? 'ยังมี Everyone อยู่ใน ACL' : 'ยังมีกลุ่มอื่นที่ทำให้ somsak เข้าถึงได้ (เช่น Users หรือ Authenticated Users)' },
      { id: 'admin', label: 'หลังแก้ไข Administrators และ SYSTEM ยังมี Full control', check: st => acct19(st) && adminFull(st, 'fs01', 'D:\\Projects'), tip: st => !acct19(st) ? 'แก้งานข้อแรก (Accounting) ให้ผ่านก่อน' : 'อย่าเอา Administrators หรือ SYSTEM ออก ไม่อย่างนั้นผู้ดูแลจะจัดการโฟลเดอร์ไม่ได้' },
      { id: 'verify', label: 'ตรวจด้วย icacls D:\\Projects หลังแก้ไขครั้งสุดท้าย', check: st => verifiedAfter(st, ['fs01'], /^icacls\s+"?d:\\projects(\\\*)?"?\s*$/i), tip: 'รัน icacls D:\\Projects หลังแก้เสร็จ' }
    ],
    good: [{ re: /^icacls\s+"?d:\\projects"?\s*$/i, label: 'icacls D:\\Projects' }, { re: /\/grant(:r)?\s+\S*accounting\S*:\(oi\)\(ci\)/i, label: '/grant Accounting:(OI)(CI)...' }, { re: /\/remove(:g)?\s+"?everyone/i, label: '/remove Everyone' }],
    quick: [['icacls D:\\Projects', 1], ['icacls D:\\Projects\\*', 1], ['net localgroup Accounting', 1], ['icacls D:\\Projects ', 0], ['icacls /?', 1], ['cls', 1]],
    steps: [
      { cmd: 'icacls D:\\Projects', match: '^icacls\\s+"?d:\\\\projects"?\\s*$', say: 'พิมพ์ icacls D:\\Projects', why: 'ดู ACL ปัจจุบันก่อนแก้', explain: 'Everyone:(OI)(CI)(F) = ทุกบัญชีได้ Full control และส่งต่อถึงทุกไฟล์ (เปลี่ยนสิทธิ์ได้ด้วย) อันตรายมาก', mark: 'Everyone' },
      { act: 'ให้สิทธิ์กลุ่มตามโจทย์ ให้มีผลทั้งโฟลเดอร์และไฟล์ข้างใน (icacls ... /grant)', cmd: 'icacls D:\\Projects /grant Accounting:(OI)(CI)M', match: '^icacls\\s+"?d:\\\\projects"?\\s+.*/grant', say: 'ให้สิทธิ์: icacls D:\\Projects /grant Accounting:(OI)(CI)M', why: 'M = Modify (อ่าน เขียน ลบ แต่เปลี่ยนสิทธิ์ไม่ได้) (OI)(CI) ส่งต่อให้ไฟล์และโฟลเดอร์ย่อย', explain: 'processed file แปลว่าสำเร็จ', mark: 'processed' },
      { act: 'เอา ACE ที่ให้สิทธิ์เกินออก (icacls ... /remove)', cmd: 'icacls D:\\Projects /remove Everyone', match: '^icacls\\s+"?d:\\\\projects"?\\s+.*/remove', say: 'เอา Everyone ออก: icacls D:\\Projects /remove Everyone', why: '/remove ลบทุก ACE ของชื่อนั้นที่ตั้งไว้ตรง ๆ (ไม่ลบ ACE ที่สืบทอดมา)', explain: 'สำเร็จ', mark: 'processed' },
      { cmd: 'icacls D:\\Projects', match: '^icacls\\s+"?d:\\\\projects(\\\\\\*)?"?\\s*$', after: 2, say: 'ตรวจด้วย icacls D:\\Projects (และ icacls D:\\Projects\\*)', why: 'ยืนยันผล (ระบบตรวจงานจากขั้นนี้ด้วย)', explain: 'ต้องเห็น FS-01\\Accounting:(OI)(CI)(M) และไม่มี Everyone ไฟล์ข้างในจะแสดง (I)(M)', mark: 'Accounting' }
    ]
  },
  {
    id: 'm20', level: 'hard', week: 18, mode: 'troubleshooting', title: 'สิทธิ์สืบทอดเกิน: พนักงานลบรายงานการเงินได้',
    desc: 'malee ควรอ่านรายงานใน \\\\FS-02\\Finance\\Reports ได้อย่างเดียวแต่กลับลบไฟล์ได้ หา ACE ที่ให้สิทธิ์เกิน (สืบทอดผ่านกลุ่ม) แก้ที่ต้นทางตามหลักสิทธิ์น้อยที่สุด แล้วพิสูจน์จาก PC-HR05',
    story: 'พนักงานฝ่ายบุคคล มาลี (malee) แจ้งว่าเผลอลบไฟล์ในไดรฟ์ F:\\Reports ได้ ทั้งที่ควรเปิดอ่านได้อย่างเดียว ข้อกำหนดของโฟลเดอร์ D:\\Finance บน FS-02 อยู่ในตารางด้านล่าง แชร์ Finance ให้ Everyone แบบ Full เพราะตั้งใจคุมสิทธิ์ที่ NTFS คุณเข้าได้ทั้ง PC-HR05 (ในฐานะ malee) และ FS-02 (Command Prompt แบบ Run as administrator) ให้หาว่าสิทธิ์เกินมาจากไหน แก้ให้ถูกที่ (ห้ามใช้ Deny) แล้วพิสูจน์จาก PC-HR05 ว่า malee ลบไฟล์ไม่ได้แล้ว',
    hints: ['icacls D:\\Finance\\Reports: ACE ที่มี (I) สืบทอดมาจากโฟลเดอร์แม่ แก้หรือ /remove ที่โฟลเดอร์ลูกไม่ได้', 'ดูว่า malee อยู่กลุ่มใดด้วย net user malee แล้วหาบรรทัดของกลุ่มนั้นใน icacls D:\\Finance',
      'แทนที่สิทธิ์เดิมทั้งหมดของกลุ่มด้วย /grant:r เช่น icacls path /grant:r กลุ่ม:(OI)(CI)RX', 'อย่าใช้ Deny: Deny ชนะ Allow และจะตัดสิทธิ์สมาชิกที่อยู่หลายกลุ่ม (เช่นฝ่ายบัญชี) ไปด้วย',
      'พิสูจน์: บน PC-HR05 ลองลบไฟล์ด้วย del F:\\Reports\\ชื่อไฟล์ ต้องขึ้น Access is denied'],
    hosts: [{ id: 'hr05', os: 'windows', user: 'malee' }, { id: 'fs02', os: 'windows', user: 'Administrator' }],
    factsTitle: 'ข้อกำหนดสิทธิ์ของ D:\\Finance (ทุกโฟลเดอร์ย่อย)',
    facts: [['กลุ่ม Staff (พนักงานทุกคน)', 'อ่านอย่างเดียว (RX)'], ['กลุ่ม Accounting', 'แก้ไข (M)'], ['Administrators, SYSTEM', 'Full control (F)']],
    topo: {
      devices: [
        host('hr05', 'pc', 'PC-HR05', '192.168.60.25', 24, '192.168.60.1', ['192.168.60.10'], 'E4-54-E8-60-00-25', { x: 90, y: 330,
          sys: SYS.WIN.make({ host: 'PC-HR05', users: [{ name: 'malee' }], drives: [{ local: 'F:', remote: '\\\\FS-02\\Finance', persistent: true }] }, 'malee') }),
        host('fs02', 'server', 'FS-02', '192.168.60.10', 24, '192.168.60.1', ['192.168.60.10'], '00-15-5D-60-00-10', { x: 400, y: 330, services: { file: true },
          sys: SYS.WIN.make({ host: 'FS-02', server: true, vols: ['C:', 'D:'],
            users: [{ name: 'malee', groups: ['Staff'] }, { name: 'niran', groups: ['Staff'] }, { name: 'somchai', groups: ['Staff', 'Accounting'] }],
            groups: [{ name: 'Staff', comment: 'พนักงานทุกคน' }, { name: 'Accounting', comment: 'ฝ่ายบัญชี' }],
            dirs: [{ path: 'D:\\Finance', protect: true, acl: ['BUILTIN\\Administrators:(OI)(CI)(F)', 'NT AUTHORITY\\SYSTEM:(OI)(CI)(F)', 'FS-02\\Accounting:(OI)(CI)(M)', 'FS-02\\Staff:(OI)(CI)(F)'] },
              { path: 'D:\\Finance\\Reports' }, { path: 'D:\\Finance\\Budget' }],
            files: [{ path: 'D:\\Finance\\Reports\\q2-summary.xlsx', size: 40960 }, { path: 'D:\\Finance\\Reports\\q3-summary.xlsx', size: 43008 }, { path: 'D:\\Finance\\Budget\\budget-2027.xlsx', size: 61440 }],
            shares: [{ name: 'Finance', path: 'D:\\Finance', remark: 'การเงิน', grants: [['Everyone', 'FULL']] }] }, 'Administrator') }),
        sw('sw1', 'SW-HQ', 240, 210),
        router('r1', 'R-HQ', [{ name: 'g0/0', ip: '192.168.60.1', prefix: 24 }], [], { x: 420, y: 170 })
      ],
      links: [L('l1', 'hr05', 'eth0', 'sw1', 'p5'), L('l2', 'fs02', 'eth0', 'sw1', 'p1'), L('l3', 'r1', 'g0/0', 'sw1', 'p24')]
    },
    questions: [],
    tasks: [
      { id: 'staff', label: 'Staff (เช่น malee, niran) อ่านได้ แต่เขียน ลบ หรือเปลี่ยนสิทธิ์ไม่ได้ ทั้ง D:\\Finance และโฟลเดอร์ย่อย',
        check: st => staff20(st),
        tip: st => { const b = localBits(st, 'fs02', 'malee', 'D:\\Finance\\Reports', true); if (!(b & 1)) return 'malee อ่านรายงานไม่ได้แล้ว (Staff ต้องอ่านได้)'; return 'malee ยังเขียนหรือลบไฟล์ได้: ดูว่าสิทธิ์ (I) ใน Reports สืบทอดมาจาก ACE ใดของ D:\\Finance'; } },
      { id: 'acct', label: 'หลังแก้ไข Accounting ยังแก้ไขได้ (M), Administrators/SYSTEM ยัง Full control และไม่มี ACE แบบ Deny',
        check: st => staff20(st) && ['D:\\Finance', 'D:\\Finance\\Reports'].every(p => [false, true].every(nf => (localBits(st, 'fs02', 'somchai', p, nf) & 15) === 15)) && adminFull(st, 'fs02', 'D:\\Finance') && adminFull(st, 'fs02', 'D:\\Finance\\Reports') && !Object.keys(win(st, 'fs02').fs).filter(k => /^d:\\finance(\\|$)/.test(k)).some(k => (win(st, 'fs02').fs[k].acl || []).some(a => a.deny)),
        tip: st => !staff20(st) && !Object.keys(win(st, 'fs02').fs).some(k => /^d:\\finance(\\|$)/.test(k) && (win(st, 'fs02').fs[k].acl || []).some(a => a.deny)) ? 'แก้งานข้อแรก (Staff) ให้ผ่านก่อน' : Object.keys(win(st, 'fs02').fs).filter(k => /^d:\\finance(\\|$)/.test(k)).some(k => (win(st, 'fs02').fs[k].acl || []).some(a => a.deny)) ? 'มี ACE แบบ Deny: Deny ชนะ Allow และตัดสิทธิ์ somchai (อยู่ทั้ง Staff และ Accounting) ไปด้วย เอา Deny ออก (icacls path /remove:d ชื่อ)' : 'Accounting หรือผู้ดูแลเสียสิทธิ์ที่ต้องมี' },
      { id: 'proof', label: 'หลังแก้ไข malee ลองลบไฟล์ผ่านไดรฟ์ F: จาก PC-HR05 แล้วขึ้น Access is denied', check: st => deniedAfterFix(st), tip: 'หลังแก้สิทธิ์ครั้งสุดท้าย สลับไป PC-HR05 แล้วลอง del F:\\Reports\\ชื่อไฟล์ (ต้องถูกปฏิเสธ)' }
    ],
    good: [{ re: /^icacls\s+"?d:\\finance\\reports"?\s*$/i, label: 'icacls D:\\Finance\\Reports' }, { re: /^icacls\s+"?d:\\finance"?\s*$/i, label: 'icacls D:\\Finance' }, { re: /^net\s+user\s+malee\s*$/i, label: 'net user malee' }],
    quick: { hr05: [['net use', 1], ['dir F:\\Reports', 1], ['del F:\\Reports\\', 0], ['type F:\\Reports\\q3-summary.xlsx', 1], ['cls', 1]], fs02: [['icacls D:\\Finance\\Reports', 1], ['icacls D:\\Finance', 1], ['net user malee', 1], ['net share Finance', 1], ['icacls ', 0], ['cls', 1]] },
    steps: [
      { host: 'fs02', cmd: 'icacls D:\\Finance\\Reports', match: '^icacls\\s+"?d:\\\\finance\\\\reports"?\\s*$', say: 'บน FS-02 พิมพ์ icacls D:\\Finance\\Reports', why: 'ดูสิทธิ์ของโฟลเดอร์ที่มีปัญหา', explain: 'ทุกบรรทัดมี (I) = สืบทอดมาจาก D:\\Finance ต้องไปดูที่โฟลเดอร์แม่', mark: '\\(I\\)' },
      { host: 'fs02', cmd: 'net user malee', match: '^net\\s+user\\s+malee\\s*$', say: 'พิมพ์ net user malee', why: 'malee ได้สิทธิ์ผ่านกลุ่มใด', explain: 'ดู Local Group Memberships แล้วหาบรรทัดของกลุ่มนั้นใน ACL', mark: '^Local Group' },
      { host: 'fs02', cmd: 'icacls D:\\Finance', match: '^icacls\\s+"?d:\\\\finance"?\\s*$', say: 'พิมพ์ icacls D:\\Finance', why: 'ACE ที่ตั้งไว้ตรง ๆ (ไม่มี (I)) อยู่ที่นี่', explain: 'เทียบกับตารางข้อกำหนด: บรรทัดไหนให้สิทธิ์มากกว่าที่ควร', mark: '\\(F\\)' },
      { act: 'แก้ ACE ที่ผิดที่ D:\\Finance ตามหลักสิทธิ์น้อยที่สุด (ไม่ใช้ Deny)', host: 'fs02', cmd: 'icacls D:\\Finance ', fill: true, match: '^icacls\\s+"?d:\\\\finance"?\\s+.*/(grant|remove)', say: 'แก้ ACE ที่ผิดที่ D:\\Finance (ไม่ใช้ Deny)', why: 'แก้ที่ต้นทาง โฟลเดอร์ย่อยทั้งหมดจะได้สิทธิ์ที่ถูกต้องผ่านการสืบทอด', explain: 'processed file แปลว่าสำเร็จ ตรวจด้วย icacls D:\\Finance\\Reports อีกครั้ง', mark: 'processed' },
      { host: 'hr05', cmd: 'del F:\\Reports\\', fill: true, match: '^(del|erase)\\s+"?f:', after: 3, say: 'สลับไป PC-HR05 แล้วลองลบไฟล์ใน F:\\Reports', why: 'พิสูจน์ว่า malee ลบไม่ได้แล้ว (ระบบตรวจงานจากขั้นนี้)', explain: 'Access is denied = แก้สำเร็จ', mark: 'denied' }
    ]
  }
];

// ------------------------------------------------------------------ key helpers (all use NetSim)
function leaseServerIp(n, id) {
  const c = n.config(id); if (!c || !c.leaseFrom) return null;
  const s = n.config(c.leaseFrom); if (!s) return null;
  if (s.ifaces) { const f = s.ifaces.find(x => x.ip && NetSim.ip.inSubnet(c.ip, x.ip, x.prefix)); return f ? f.ip : s.ip; }
  return s.ip;
}
function hopIp(n, src, dst, k) { const h = n.traceroute(src, dst).hops[k - 1]; return h && !h.timeout ? h.ip : null; }
function portOf(addr) { const m = /:(\d+)$/.exec(String(addr)); return m ? m[1] : null; }
function fixedNet(t, id) { const c = clone(t); c.devices.find(d => d.id === id).ifaces.forEach(f => { f.up = true; }); return NetSim.create(c); }
function fixedRouteNet(t, id, gw) { const c = clone(t); c.devices.find(d => d.id === id).gateway = gw; return NetSim.create(c); }

// ------------------------------------------------------------------ answer normalisation
const s = v => (typeof v === 'string' || typeof v === 'number') ? String(v).slice(0, MAX_ANSWER).trim() : '';
const norm = {
  ip(v) {
    const t = s(v).replace(/\s+/g, '').replace(/\(preferred\)$/i, '').replace(/\/\d{1,2}$/, '');
    const n = NetSim.ip.parse(t); return n === null ? null : NetSim.ip.str(n);
  },
  mask(v) { const t = s(v).replace(/\s+/g, ''); const p = NetSim.ip.toPrefix(t); return p === null ? null : p; },
  mac(v) { const h = s(v).replace(/[\s:\-.]/g, '').toLowerCase(); return /^[0-9a-f]{12}$/.test(h) ? h : null; },
  num(v) { const t = s(v).replace(/\s+/g, '').replace(/^(ttl|pid)[=:]?/i, ''); return /^\d{1,7}$/.test(t) ? String(+t) : null; },
  port(v) { const t = s(v).replace(/\s+/g, '').replace(/^(tcp|udp)?:?/i, '').replace(/^.*:/, ''); return /^\d{1,5}$/.test(t) ? String(+t) : null; },
  dhcp(v) {
    const t = s(v).toLowerCase().replace(/\s+/g, '');
    if (/^(dhcp|auto|automatic|อัตโนมัติ|yes|ใช่|ได้|dhcpenabled|dhcpenabled:yes)$/.test(t)) return 'dhcp';
    if (/^(static|manual|fixed|no|ไม่|ไม่ใช่|กำหนดเอง|คงที่|สแตติก)$/.test(t)) return 'static';
    return null;
  },
  iface(v) { const t = s(v).toLowerCase().replace(/\s+/g, '').replace(/:$/, ''); return /^[a-z][a-z0-9/.]{1,15}$/.test(t) ? t : null; },
  cmd(v) { return s(v).toLowerCase().replace(/^\$\s*|^#\s*/, '').replace(/\s+/g, ' ').replace(/^sudo /, '').trim() || null; },
  yesno(v) {
    const t = s(v).toLowerCase().replace(/\s+/g, '');
    if (/^(มี|ใช่|yes|y|true|มีครับ|มีค่ะ)$/.test(t)) return 'yes';
    if (/^(ไม่มี|ไม่|ไม่ใช่|no|n|false|none|ไม่มีครับ|ไม่มีค่ะ)$/.test(t)) return 'no';
    return null;
  },
  os(v) {
    const t = s(v).toLowerCase().replace(/\s+/g, '');
    if (/^(windows|win|วินโดวส์|วินโดว์|windows10|windows11|microsoftwindows)$/.test(t)) return 'windows';
    if (/^(linux|ลินุกซ์|ลีนุกซ์|ubuntu|unix|linux\/unix)$/.test(t)) return 'linux';
    return null;
  },
  name(v) { const t = s(v).toLowerCase().replace(/[^a-z0-9ก-๙]/g, ''); return t.length >= 2 ? t : null; }
};
function sameAnswer(type, given, key) {
  if (type === 'mask') return given !== null && given === NetSim.ip.toPrefix(key);
  if (type === 'mac') return given !== null && given === norm.mac(key);
  if (type === 'cmd') {
    if (!given) return false;
    const m = /^ip link set (\S+) up$/.exec(key);
    if (m) {
      const ifn = m[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(`^(ip (link|l|li|lin) set (dev )?${ifn} up|ifup ${ifn}|ifconfig ${ifn} up|nmcli (dev|device) connect ${ifn})$`).test(given);
    }
    return given === norm.cmd(key);
  }
  return given !== null && given === norm[type](key);
}

// ------------------------------------------------------------------ command replay (evidence for m9+)
// Mirrors the browser terminal (public/js/sim/terminal.js): the same NetSim calls in the same order, so ARP caches and
// host changes match what the student saw. Only the first stage of a pipeline ("netstat -ano | findstr 22") counts.
function tokens(line) { return String(line).split('|')[0].trim().split(/\s+/).filter(Boolean); }
function flagSet(args) {
  const f = {};
  args.forEach(a => { if (/^[-/][A-Za-z?]+$/.test(a) && !/^--/.test(a)) a.slice(1).split('').forEach(ch => { f[ch.toLowerCase()] = true; }); });
  return f;
}
function pingTarget(args, os) {
  for (let i = 0; i < args.length; i++) {
    const a = args[i], al = a.toLowerCase();
    if (os === 'windows') {
      if (al === '-t' || al === '/t') return null;
      if (/^[-/](n|l|w|i|v|r|s|j|k|c)$/i.test(a)) { i++; continue; }
      if (/^[-/]/.test(a)) continue;
    } else {
      if (/^-(c|i|W|w|s|t|I)$/.test(a)) { i++; continue; }
      if (/^-/.test(a)) continue;
    }
    return a;
  }
  return null;
}
function firstArg(args, valueOpts) {
  for (let i = 0; i < args.length; i++) {
    if (valueOpts.test(args[i])) { i++; continue; }
    if (/^[-/+@]/.test(args[i])) continue;
    return args[i];
  }
  return null;
}
/** Shared rule for `ip route add default via X` / `route add 0.0.0.0 mask 0.0.0.0 X` (browser has the same code). */
function routeAddCheck(net, id, via, replace) {
  const c = net.config(id);
  const v = NetSim.ip.parse(String(via || ''));
  if (v === null) return { ok: false, err: 'bad' };
  const vs = NetSim.ip.str(v);
  if (!c || !c.ip || c.up === false || c.apipa) return { ok: false, err: 'nexthop', via: vs };
  if (c.dhcp) return { ok: false, err: 'dhcp', via: vs };
  if (vs === c.ip || !NetSim.ip.inSubnet(vs, c.ip, c.prefix)) return { ok: false, err: 'nexthop', via: vs };
  if (!replace && net.routes(id).some(r => r.prefix === 0)) return { ok: false, err: 'exists', via: vs };
  return { ok: true, via: vs };
}
function replay(sc, log) {
  const st = { runs: [], pings: [], arp: [], routeAdds: [], sys: [], lines: [] };
  const hosts = new Map(sc.hosts.map(h => [h.id, h]));
  let topo = clone(sc.topo);
  let net = NetSim.create(clone(topo));
  const fixedSince = new Set();
  const dev = id => topo.devices.find(d => d.id === id);
  const rebuild = () => { net = NetSim.create(clone(topo)); };
  // NL_SYS mutates net.topo in place; keep the replay topology in step so a later rebuild() keeps the state
  const syncSys = () => { net.topo.devices.forEach(d => { if (d.sys) { const t = dev(d.id); if (t) t.sys = clone(d.sys); } }); };
  for (const e of log) {
    const c = e.c;
    if (e.h === '*' && c === '#reset') { topo = clone(sc.topo); rebuild(); fixedSince.clear(); st.runs.push({ reset: true }); st.sys.push({ reset: true }); continue; }
    const h = hosts.get(e.h); if (!h || !c) continue;
    st.lines.push(c);
    // accounts / groups / shares / permissions: the same engine as the browser terminal (m12+)
    if (SYS.handles(h.os, c)) {
      const r = SYS.run({ net, hostId: h.id, os: h.os, user: h.user, admin: h.os === 'windows' && /^administrator$/i.test(h.user) }, c);
      syncSys();
      st.sys.push({ h: h.id, line: c.trim(), cmd: r.cmd, view: !!r.view, changed: !!r.changed, ev: Array.isArray(r.ev) ? r.ev : [], asUser: r.asUser || h.user });
      st.runs.push({ h: h.id, cmd: r.cmd, sys: true });
      continue;
    }
    let t = tokens(c); let root = h.user === 'root';
    if (h.os === 'linux' && t[0] === 'sudo') { t = t.slice(1); root = true; }
    if (!t.length) continue;
    const cmd = h.os === 'windows' ? t[0].toLowerCase().replace(/\.exe$/, '') : t[0];
    const args = t.slice(1);
    const admin = h.os === 'windows' && /^administrator$/i.test(h.user);
    const run = { h: h.id, cmd, args, root, admin, fl: flagSet(args), kind: cmd };
    st.runs.push(run);
    const doPing = target => {
      const r = net.ping(h.id, target, { count: 1 });
      const cfg = net.config(h.id) || {};
      const dst = r.resolved || target;
      const external = !!(cfg.ip && NetSim.ip.parse(dst) !== null && !NetSim.ip.inSubnet(dst, cfg.ip, cfg.prefix));
      st.pings.push({ h: h.id, dst, ok: !!r.ok, ttl: r.ttl, external, afterFix: fixedSince.has(h.id) });
    };
    const snapArp = () => {
      const cfg = net.config(h.id) || {};
      const list = h.os === 'windows' && (!cfg.ip || cfg.up === false || !cfg.linked) ? [] : net.arp(h.id);
      st.arp.push({ h: h.id, list: list.map(x => ({ ip: x.ip, mac: x.mac })) });
    };
    const setGw = gw => { const d = dev(h.id); if (d) { d.gateway = gw; rebuild(); } };
    if (h.os === 'windows') {
      if (cmd === 'ping') { const tg = pingTarget(args, 'windows'); if (tg) doPing(tg); }
      else if (cmd === 'tracert') { const tg = firstArg(args, /^[-/](h|w|j|s)$/i); if (tg) net.traceroute(h.id, tg); }
      else if (cmd === 'nslookup') { const a = args.filter(x => !/^-/.test(x)); if (a.length) net.nslookup(h.id, a[0], a[1]); }
      else if (cmd === 'arp') {
        const a = (args[0] || '').toLowerCase();
        if (a === '-a' || a === '/a' || a === '-g') { run.kind = 'arp_show'; snapArp(); }
        else if ((a === '-d' || a === '/d') && admin) net.clearArp(h.id);
      } else if (cmd === 'route') {
        const a = args.filter(x => !/^-[pf46]$/i.test(x)).map(x => x.toLowerCase());
        if (a[0] === 'print') run.kind = 'route_print';
        else if (a[0] === 'add' && admin && a[1] === '0.0.0.0' && a[2] === 'mask' && a[3] === '0.0.0.0') {
          const chk = routeAddCheck(net, h.id, a[4], false);
          st.routeAdds.push({ h: h.id, ok: chk.ok, via: chk.via });
          if (chk.ok) { setGw(chk.via); fixedSince.add(h.id); }
        } else if (a[0] === 'delete' && admin && a[1] === '0.0.0.0') setGw('');
      } else if (cmd === 'ipconfig') {
        const a = (args[0] || '').toLowerCase();
        const d = dev(h.id); const cfg = net.config(h.id) || {};
        if ((a === '/release' || a === '/renew') && d && cfg.up !== false && (cfg.dhcp || d._released) && cfg.linked) {
          if (a === '/release') { d._released = true; d.dhcp = false; d.ifaces[0].ip = ''; d.ifaces[0].prefix = ''; }
          else { delete d._released; d.dhcp = true; d.ifaces[0].ip = ''; d.ifaces[0].prefix = 24; }
          rebuild();
        }
      }
    } else {
      if (cmd === 'ping') { const tg = pingTarget(args, 'linux'); if (tg) doPing(tg); }
      else if (cmd === 'traceroute') { const tg = firstArg(args, /^-(m|f|q|w|p|s|i)$/); if (tg) net.traceroute(h.id, tg); }
      else if (cmd === 'nslookup' || cmd === 'host') { const a = args.filter(x => !/^-/.test(x)); if (a.length) net.nslookup(h.id, a[0], a[1]); }
      else if (cmd === 'dig') { const nm = args.find(x => !/^[+@-]/.test(x) && !/^(A|IN)$/i.test(x)); const sv = (args.find(x => /^@/.test(x)) || '').slice(1) || undefined; if (nm) net.nslookup(h.id, nm, sv); }
      else if (cmd === 'ss') run.kind = 'ss';
      else if (cmd === 'dhclient' && root) {
        const d = dev(h.id); const cfg = net.config(h.id) || {};
        if (d && (cfg.dhcp || d._released)) {
          if (args.includes('-r')) { d._released = true; d.dhcp = false; d.ifaces[0].ip = ''; d.ifaces[0].prefix = ''; }
          else { delete d._released; d.dhcp = true; d.ifaces[0].ip = ''; d.ifaces[0].prefix = 24; }
          rebuild();
        }
      } else if (cmd === 'ip') {
        const a = args.filter(x => !/^-(4|6|br|brief|c|color|s|d)$/.test(x));
        const obj = (a[0] || '').toLowerCase(), sub = (a[1] || 'show').toLowerCase();
        const is = (w, full) => w.length >= 1 && full.startsWith(w);
        if (obj && (is(obj, 'route') || obj === 'r')) {
          if (is(sub, 'show') || is(sub, 'list')) { run.kind = 'iproute_show'; run.hadDefault = net.routes(h.id).some(r => r.prefix === 0); }
          else if ((sub === 'add' || sub === 'replace') && root && (a[2] === 'default' || a[2] === '0.0.0.0/0')) {
            const vi = a.indexOf('via');
            const chk = routeAddCheck(net, h.id, vi > 0 ? a[vi + 1] : null, sub === 'replace');
            run.kind = 'iproute_add';
            st.routeAdds.push({ h: h.id, ok: chk.ok, via: chk.via });
            if (chk.ok) { setGw(chk.via); fixedSince.add(h.id); }
          } else if ((sub === 'del' || sub === 'delete') && root && (a[2] === 'default' || a[2] === '0.0.0.0/0')) { setGw(''); fixedSince.delete(h.id); }
        } else if (obj && (is(obj, 'neighbour') || is(obj, 'neighbor'))) {
          if (sub === 'flush') { if (root) net.clearArp(h.id); }
          else if (is(sub, 'show') || is(sub, 'list')) {
            run.kind = 'neigh';
            const cfg = net.config(h.id) || {};
            if (cfg.up === false || !cfg.linked) st.arp.push({ h: h.id, list: [] }); else snapArp();
          }
        }
        else if (obj && is(obj, 'link') && sub === 'set' && root) {
          let i = 2; if (a[i] === 'dev') i++;
          const ifn = a[i], s2 = (a[i + 1] || '').toLowerCase(); const d = dev(h.id);
          if (d && (s2 === 'up' || s2 === 'down') && d.ifaces.some(f => f.name === ifn)) { d.ifaces.forEach(f => { if (f.name === ifn) f.up = s2 === 'up'; }); rebuild(); }
        }
      }
    }
  }
  st.net = net;
  st.users = {}; sc.hosts.forEach(x => { st.users[x.id] = x.user; });
  return st;
}

// ------------------------------------------------------------------ state helpers for the 4.0 missions (m12+)
const win = (st, id) => SYS.sysOf(st.net, id, 'windows');
const lsys = (st, id) => SYS.sysOf(st.net, id, 'linux');
const wuser = (st, id, n) => win(st, id).users.find(u => u.name.toLowerCase() === n.toLowerCase());
const wgroup = (st, id, n) => win(st, id).groups.find(g => g.name.toLowerCase() === n.toLowerCase());
function inWinGroup(st, id, user, group) {
  const s = win(st, id), g = wgroup(st, id, group); if (!g) return false;
  return g.members.some(m => m.toLowerCase() === user.toLowerCase() || m.toLowerCase() === (s.host + '\\' + user).toLowerCase());
}
const shareOf = (st, id, name) => SYS.WIN.findShare(win(st, id), name);
const homeworkShare = st => { const sh = shareOf(st, 'lab07', 'Homework'); return sh && /^c:\\share\\homework$/i.test(sh.path) ? sh : null; };
function shareOk12(sh) {
  const g = sh.grants.map(x => [x[0].toLowerCase(), x[1]]);
  if (g.some(x => x[0] === 'everyone' || /authenticated users|\\users$/.test(x[0]))) return false;
  if (g.some(x => x[1] === 'FULL' && x[0] !== 'builtin\\administrators')) return false;
  return g.some(x => /\\students$/.test(x[0]) && x[1] === 'CHANGE');
}
// NTFS bits of a local account on a folder (or on a NEW file created in it: what inheritance gives to files)
function probeKey(s, path, newFile) {
  const key = path.toLowerCase();
  if (!newFile) return { s, key };
  const c = clone(s); const k = key.replace(/\\$/, '') + '\\__probe__.txt';
  c.fs[k] = { path: k, dir: false, acl: [], protect: false, size: 0 };
  return { s: c, key: k };
}
function localBits(st, id, user, path, newFile) {
  const p = probeKey(win(st, id), path, newFile);
  if (!p.s.fs[p.key]) return 0;
  return SYS.WIN.ntfsBits(p.s, p.key, SYS.WIN.tokenOf(p.s, user, 'local'));
}
function netBits(st, id, user, share, path, newFile) {
  const s = win(st, id); const sh = SYS.WIN.findShare(s, share); if (!sh) return 0;
  const p = probeKey(s, path, newFile);
  if (!p.s.fs[p.key]) return 0;
  const sids = SYS.WIN.tokenOf(p.s, user, 'network');
  return SYS.WIN.shareBits(sh, sids) & SYS.WIN.ntfsBits(p.s, p.key, sids);
}
function adminFull(st, id, path) {
  return [false, true].every(nf => { const p = probeKey(win(st, id), path, nf); return !!p.s.fs[p.key] && ['builtin\\administrators', 'nt authority\\system'].every(sid => SYS.WIN.ntfsBits(p.s, p.key, new Set([sid])) === 63); });
}
// task bodies shared by a main task and the "without over-granting" guard task that depends on it
function salesOk14(st) {
  return ['somsak', 'malee'].every(u => { const f = netBits(st, 'srv', u, 'Reports', 'D:\\Reports'), n = netBits(st, 'srv', u, 'Reports', 'D:\\Reports', true); return (f & 7) === 7 && (n & 15) === 15 && !(f & 16) && !(n & 16); });
}
function acct19(st) {
  return ['somchai', 'malee'].every(u => ['D:\\Projects', 'D:\\Projects\\2027'].every(p => localBits(st, 'fs01', u, p) === 15 && localBits(st, 'fs01', u, p, true) === 15));
}
function staff20(st) {
  return ['malee', 'niran'].every(u => ['D:\\Finance', 'D:\\Finance\\Reports', 'D:\\Finance\\Budget'].every(p => [false, true].every(nf => { const b = localBits(st, 'fs02', u, p, nf); return (b & 3) === 3 && !(b & 60); })));
}
const drive = (st, id, letter) => win(st, id).drives.find(d => d.local === letter.toUpperCase());
function driveOk(st, id, letter, targetId, share, needPersistent) {
  const d = drive(st, id, letter); if (!d) return false;
  const m = /^\\\\([^\\]+)\\([^\\]+)$/.exec(d.remote || ''); if (!m) return false;
  const t = st.net.topo.devices.find(x => x.id === targetId); if (!t) return false;
  const ip = (st.net.config(targetId) || {}).ip;
  if (m[1].toLowerCase() !== String(t.name).toLowerCase() && m[1] !== ip) return false;
  if (m[2].toLowerCase() !== share.toLowerCase()) return false;
  if (needPersistent && !d.persistent) return false;
  return SYS.WIN.driveStatus(st.net, id, (st.users || {})[id], d) === 'OK';
}
function lnxInGroup(st, id, user, group) {
  const s = lsys(st, id); const u = SYS.LX.user(s, user); if (!u) return false;
  return SYS.LX.memberOf(s, u).some(g => g.name === group);
}
// the last state change (on one of hostIds) was followed by a matching read-only check command
function verifiedAfter(st, hostIds, re) {
  const L = st.sys; let from = 0; L.forEach((e, i) => { if (e.reset) from = i + 1; });
  const list = L.slice(from); let last = -1;
  list.forEach((e, i) => { if (e.changed && hostIds.includes(e.h)) last = i; });
  if (last < 0) return false;
  return list.slice(last + 1).some(e => e.view && hostIds.includes(e.h) && re.test(e.line));
}
// m20: after the last ACL/share change on FS-02, malee's delete or write through the share was refused
function deniedAfterFix(st) {
  const L = st.sys; let from = 0; L.forEach((e, i) => { if (e.reset) from = i + 1; });
  const list = L.slice(from); let last = -1;
  list.forEach((e, i) => { if (e.changed && e.h === 'fs02') last = i; });
  if (last < 0) return false;
  return list.slice(last + 1).some(e => e.h === 'hr05' && e.ev.some(v => (v.op === 'delete' || v.op === 'write') && v.remote && v.ok === false && /^d:\\finance\\/i.test(v.path)));
}

// ------------------------------------------------------------------ build missions + keys at load time
const KEYS = {};
const PRIVATE = {};
const STEP_FIELDS = ['host', 'cmd', 'fill', 'match', 'after', 'say', 'why', 'explain', 'mark'];
const missions = SCENARIOS.map(sc => {
  const topo = clone(sc.topo);
  if (sc.setup) sc.setup(topo);
  sc.topo = topo;
  sc.tasks = sc.tasks || [];
  const keys = {};
  sc.questions.forEach(q => {
    const net = NetSim.create(clone(topo)); // fresh instance per question (ARP caches start empty)
    let v = null;
    try { v = q.key(net, topo, sc); } catch (e) { v = null; }
    if (v === null || v === undefined || v === '') throw new Error(`terminal grader: answer key for ${sc.id}.${q.id} could not be computed`);
    keys[q.id] = String(v);
  });
  KEYS[sc.id] = keys;
  PRIVATE[sc.id] = sc;
  const start = {
    story: sc.story,
    topo: clone(topo),
    hosts: sc.hosts.map(h => ({ id: h.id, os: h.os, user: h.user })),
    questions: sc.questions.map(q => ({ id: q.id, q: q.q, type: q.type })),
    // Guided mode (โหมดแนะนำ): what to type, why, and how to read the output. Never contains answer values.
    // 6.x: in missions that are not Guided Labs a step that performs the fix (`act`) is published without its literal
    // command: only the non-literal goal (act) remains, so following the published steps cannot complete the tasks
    steps: (sc.steps || []).map(st => {
      const o = {}; STEP_FIELDS.forEach(k => { if (st[k] !== undefined) o[k] = st[k]; });
      if (st.act && sc.mode !== 'guided') { delete o.cmd; delete o.fill; o.say = st.act; o.self = true; }
      return o;
    })
  };
  if (sc.netstat) start.netstat = clone(sc.netstat);
  if (sc.facts) start.facts = clone(sc.facts);
  if (sc.factsTitle) start.factsTitle = sc.factsTitle;
  if (sc.quick) start.quick = clone(sc.quick);
  if (sc.tasks.length) start.tasks = sc.tasks.map(t => ({ id: t.id, label: t.label }));
  const m = { id: sc.id, title: sc.title, level: sc.level, desc: sc.desc, max: MAX, hints: sc.hints.slice(), start };
  if (sc.week) m.week = sc.week;           // 4.0 missions: curriculum week and lab kind (guided | independent | troubleshooting)
  if (sc.mode) m.mode = sc.mode;
  return m;
});

// ------------------------------------------------------------------ grade
const r2 = x => Math.round(x * 100) / 100;
function readLog(p) {
  if (!Array.isArray(p.commandLog)) return [];
  return p.commandLog.slice(0, MAX_CMDS).filter(e => e && typeof e === 'object' && typeof e.h === 'string' && typeof e.c === 'string')
    .map(e => ({ h: e.h.slice(0, 40), c: e.c.replace(/[\r\n]+/g, ' ').slice(0, 200).trim() }));
}
function grade(missionId, payload) {
  const sc = PRIVATE[missionId];
  if (!sc) return { score: 0, max: MAX, ok: false, feedback: ['ไม่พบภารกิจนี้'], details: {} };
  try {
    const p = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : null;
    let answers = p && p.answers && typeof p.answers === 'object' && !Array.isArray(p.answers) ? p.answers : null;
    if (!answers && p && !sc.questions.length) answers = {};   // task-only missions (m12+) have nothing to type
    if (!answers) return { score: 0, max: MAX, ok: false, feedback: ['ไม่พบคำตอบ กรุณากรอกคำตอบแล้วกดส่งอีกครั้ง'], details: { questions: {} } };
    const mode = p.mode === 'guided' ? 'guided' : 'challenge';
    const log = readLog(p);
    // 6.x: the "appropriate commands" bonus comes from the server replay of commandLog (commands run on this mission's
    // hosts), never from the client's own commandsUsed claim
    const items = sc.questions.length + sc.tasks.length;
    const each = (MAX - BONUS) / items;
    let score = 0;
    const feedback = [mode === 'guided' ? 'ส่งในโหมดแนะนำ (Guided)' : 'ส่งในโหมดท้าทาย (Challenge)'];
    const details = { mode, questions: {}, commands: [] };
    const st = replay(sc, log);
    const cmds = st.lines;
    sc.questions.forEach((q, i) => {
      const raw = s(answers[q.id]);
      const label = `ข้อ ${i + 1}`;
      if (!raw) { details.questions[q.id] = false; feedback.push(`${label}: ยังไม่ได้ตอบ — ${q.tip}`); return; }
      const given = norm[q.type](raw);
      const ok = sameAnswer(q.type, given, KEYS[sc.id][q.id]);
      if (ok && q.ev && !q.ev(st, KEYS[sc.id][q.id], sc)) {
        details.questions[q.id] = 'partial'; score += each / 2;
        feedback.push(`${label}: คำตอบตรง แต่ไม่พบหลักฐานจากคำสั่งที่คุณรัน (ได้ครึ่งคะแนน) — ${q.evTip}`);
        return;
      }
      details.questions[q.id] = ok;
      if (ok) { score += each; feedback.push(`${label}: ถูกต้อง ✓`); }
      else if (given === null && q.type !== 'cmd') feedback.push(`${label}: รูปแบบคำตอบไม่ถูกต้อง (${fmtName(q.type)}) — ${q.tip}`);
      else feedback.push(`${label}: ยังไม่ถูกต้อง — ${q.tip}`);
    });
    if (sc.tasks.length) {
      details.tasks = {};
      sc.tasks.forEach(t => {
        let ok = false; try { ok = !!t.check(st); } catch (e) { ok = false; }
        details.tasks[t.id] = ok;
        if (ok) { score += each; feedback.push(`งานปฏิบัติ: ${t.label} — ทำสำเร็จ ✓`); }
        else {
          let tip = t.tip; if (typeof tip === 'function') { try { tip = tip(st); } catch (e) { tip = ''; } }
          feedback.push(sc.questions.length ? `งานปฏิบัติ: ยังไม่ผ่าน — ${tip}` : `งานปฏิบัติ: ยังไม่ผ่าน — ${t.label}${tip ? ' — ' + tip : ''}`);
        }
      });
    }
    // bonus: appropriate commands
    const hits = sc.good.map(g => cmds.some(c => g.re.test(c)));
    details.commands = sc.good.map((g, i) => ({ label: g.label, used: hits[i] }));
    const nHit = hits.filter(Boolean).length;
    const anyRight = Object.values(details.questions).some(Boolean) || Object.values(details.tasks || {}).some(Boolean);
    const bonus = !anyRight ? 0 : nHit === hits.length ? BONUS : nHit ? BONUS / 2 : 0; // no bonus without at least one correct answer
    score += bonus;
    if (!anyRight) feedback.push('คะแนนการใช้คำสั่งจะได้เมื่อตอบถูกอย่างน้อย 1 ข้อ');
    else if (nHit === hits.length) feedback.push(`ใช้คำสั่งที่เหมาะสมครบ (${sc.good.map(g => g.label).join(', ')}) +${BONUS}`);
    else feedback.push(`คะแนนการใช้คำสั่ง ${bonus}/${BONUS}: ควรใช้ ${sc.good.filter((g, i) => !hits[i]).map(g => g.label).join(', ')} ในการตรวจสอบ`);
    score = Math.min(MAX, r2(score));
    details.rawScore = score;
    if (mode === 'guided') {
      const cap = r2(MAX * GUIDED_CAP);
      if (score > cap) score = cap;
      feedback.push(`โหมดแนะนำให้คะแนนสูงสุด ${cap}/${MAX} (ทำได้ ${details.rawScore}/${MAX}) — ลองโหมดท้าทายเพื่อรับคะแนนเต็ม`);
    }
    return { score, max: MAX, ok: score === MAX, feedback, details };
  } catch (e) {
    return { score: 0, max: MAX, ok: false, feedback: ['ข้อมูลที่ส่งมาไม่ถูกต้อง'], details: {} };
  }
}
function fmtName(t) {
  return { ip: 'ต้องเป็น IP เช่น 192.168.1.10', mask: 'ต้องเป็น Subnet mask เช่น 255.255.255.0 หรือ /24', mac: 'ต้องเป็น MAC 12 หลักฐานสิบหก เช่น 00-1A-2B-3C-4D-5E',
    num: 'ต้องเป็นตัวเลข', port: 'ต้องเป็นหมายเลขพอร์ต', dhcp: 'ตอบ DHCP หรือ Static', iface: 'ต้องเป็นชื่อ interface เช่น eth0',
    yesno: 'ตอบ มี หรือ ไม่มี', os: 'ตอบ Windows หรือ Linux', name: 'ต้องเป็นชื่อเครื่อง' }[t] || '';
}

module.exports = { id: 'terminal', title: 'จำลองการใช้คำสั่งเครือข่าย (Terminal)', missions, grade, GUIDED_CAP, _keys: KEYS, _scenarios: PRIVATE, _replay: replay, _routeAddCheck: routeAddCheck };

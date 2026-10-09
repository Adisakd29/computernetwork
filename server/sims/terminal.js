'use strict';
/*
 * Network Terminal Simulator - server grader (NetLab, SIM-SPEC §2 + §4.4)
 *
 * Each mission is an investigation scenario. `start` (public) = { story, topo, hosts:[{id, os, user}], netstat?, questions:[{id, q}] }.
 * The answer keys live ONLY here and are computed from the scenario topology with the NetSim engine when this module
 * loads (see buildKeys), so they can never drift from what the browser terminal shows.
 *
 * Payload: { answers: { [questionId]: string }, commandsUsed: [string] }
 * Score (max 10): 9 points shared by the questions (credit per question) + up to 1 bonus point for having used the
 * appropriate commands (commandsUsed). Answers are normalised: IPs (spaces, leading zeros, trailing /prefix),
 * MACs (case, '-' ':' '.' separators), masks (dotted or /prefix), ports (":3389"), commands (spaces, sudo).
 */
const path = require('path');
const NetSim = require(path.join(__dirname, '../../public/js/sim/netsim.js'));

const MAX = 10;
const BONUS = 1;
const MAX_ANSWER = 120;
const MAX_CMDS = 300;

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
    good: [{ re: /^ipconfig\s+\/all\b/i, label: 'ipconfig /all' }]
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
    good: [{ re: /^ipconfig\s+\/all\b/i, label: 'ipconfig /all' }]
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
    good: [{ re: /^arp\s+-a\b/i, label: 'arp -a' }, { re: /^ping\b/i, label: 'ping' }]
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
      { re: /^(sudo\s+)?(nslookup|dig|cat\s+\/etc\/resolv\.conf)\b/i, label: 'nslookup / dig / cat /etc/resolv.conf' }]
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
    good: [{ re: /^tracert\b/i, label: 'tracert' }, { re: /^nslookup\b/i, label: 'nslookup' }]
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
    good: [{ re: /^netstat\b/i, label: 'netstat -an' }]
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
    good: [{ re: /^(sudo\s+)?ip\s+(-\d\s+)?(a(ddr?)?|l(ink)?)(\s+(show|list))?\s*$/i, label: 'ip a / ip link' }, { re: /^(sudo\s+)?ip\s+l(ink)?\s+set\s+(dev\s+)?\S+\s+up\b/i, label: 'ip link set ... up' }]
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
    good: [{ re: /^arp\s+-a\b/i, label: 'arp -a' }, { re: /^traceroute\b/i, label: 'traceroute (บน srv-b)' }, { re: /^(nslookup|ping)\b/i, label: 'nslookup / ping' }]
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

// ------------------------------------------------------------------ build missions + keys at load time
const KEYS = {};
const PRIVATE = {};
const missions = SCENARIOS.map(sc => {
  const topo = clone(sc.topo);
  if (sc.setup) sc.setup(topo);
  sc.topo = topo;
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
    questions: sc.questions.map(q => ({ id: q.id, q: q.q, type: q.type }))
  };
  if (sc.netstat) start.netstat = clone(sc.netstat);
  return { id: sc.id, title: sc.title, level: sc.level, desc: sc.desc, max: MAX, hints: sc.hints.slice(), start };
});

// ------------------------------------------------------------------ answer normalisation
const s = v => (typeof v === 'string' || typeof v === 'number') ? String(v).slice(0, MAX_ANSWER).trim() : '';
const norm = {
  ip(v) {
    const t = s(v).replace(/\s+/g, '').replace(/\(preferred\)$/i, '').replace(/\/\d{1,2}$/, '');
    const n = NetSim.ip.parse(t); return n === null ? null : NetSim.ip.str(n);
  },
  mask(v) { const t = s(v).replace(/\s+/g, ''); const p = NetSim.ip.toPrefix(t); return p === null ? null : p; },
  mac(v) { const h = s(v).replace(/[\s:\-.]/g, '').toLowerCase(); return /^[0-9a-f]{12}$/.test(h) ? h : null; },
  num(v) { const t = s(v).replace(/\s+/g, '').replace(/^ttl=/i, ''); return /^\d{1,5}$/.test(t) ? String(+t) : null; },
  port(v) { const t = s(v).replace(/\s+/g, '').replace(/^(tcp|udp)?:?/i, '').replace(/^.*:/, ''); return /^\d{1,5}$/.test(t) ? String(+t) : null; },
  dhcp(v) {
    const t = s(v).toLowerCase().replace(/\s+/g, '');
    if (/^(dhcp|auto|automatic|อัตโนมัติ|yes|ใช่|ได้|dhcpenabled|dhcpenabled:yes)$/.test(t)) return 'dhcp';
    if (/^(static|manual|fixed|no|ไม่|ไม่ใช่|กำหนดเอง|คงที่|สแตติก)$/.test(t)) return 'static';
    return null;
  },
  iface(v) { const t = s(v).toLowerCase().replace(/\s+/g, '').replace(/:$/, ''); return /^[a-z][a-z0-9/.]{1,15}$/.test(t) ? t : null; },
  cmd(v) { return s(v).toLowerCase().replace(/^\$\s*|^#\s*/, '').replace(/\s+/g, ' ').replace(/^sudo /, '').trim() || null; }
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

// ------------------------------------------------------------------ grade
const r2 = x => Math.round(x * 100) / 100;
function grade(missionId, payload) {
  const sc = PRIVATE[missionId];
  if (!sc) return { score: 0, max: MAX, ok: false, feedback: ['ไม่พบภารกิจนี้'], details: {} };
  try {
    const p = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : null;
    const answers = p && p.answers && typeof p.answers === 'object' && !Array.isArray(p.answers) ? p.answers : null;
    if (!answers) return { score: 0, max: MAX, ok: false, feedback: ['ไม่พบคำตอบ กรุณากรอกคำตอบแล้วกดส่งอีกครั้ง'], details: { questions: {} } };
    const cmds = Array.isArray(p.commandsUsed) ? p.commandsUsed.slice(0, MAX_CMDS).filter(c => typeof c === 'string').map(c => c.slice(0, 200).trim()) : [];
    const each = (MAX - BONUS) / sc.questions.length;
    let score = 0;
    const feedback = [];
    const details = { questions: {}, commands: [] };
    sc.questions.forEach((q, i) => {
      const raw = s(answers[q.id]);
      const label = `ข้อ ${i + 1}`;
      if (!raw) { details.questions[q.id] = false; feedback.push(`${label}: ยังไม่ได้ตอบ — ${q.tip}`); return; }
      const given = norm[q.type](raw);
      const ok = sameAnswer(q.type, given, KEYS[sc.id][q.id]);
      details.questions[q.id] = ok;
      if (ok) { score += each; feedback.push(`${label}: ถูกต้อง ✓`); }
      else if (given === null && q.type !== 'cmd') feedback.push(`${label}: รูปแบบคำตอบไม่ถูกต้อง (${fmtName(q.type)}) — ${q.tip}`);
      else feedback.push(`${label}: ยังไม่ถูกต้อง — ${q.tip}`);
    });
    // bonus: appropriate commands
    const hits = sc.good.map(g => cmds.some(c => g.re.test(c)));
    details.commands = sc.good.map((g, i) => ({ label: g.label, used: hits[i] }));
    const nHit = hits.filter(Boolean).length;
    const anyRight = Object.values(details.questions).some(Boolean);
    const bonus = !anyRight ? 0 : nHit === hits.length ? BONUS : nHit ? BONUS / 2 : 0; // no bonus without at least one correct answer
    score += bonus;
    if (!anyRight) feedback.push('คะแนนการใช้คำสั่งจะได้เมื่อตอบถูกอย่างน้อย 1 ข้อ');
    else if (nHit === hits.length) feedback.push(`ใช้คำสั่งที่เหมาะสมครบ (${sc.good.map(g => g.label).join(', ')}) +${BONUS}`);
    else feedback.push(`คะแนนการใช้คำสั่ง ${bonus}/${BONUS}: ควรใช้ ${sc.good.filter((g, i) => !hits[i]).map(g => g.label).join(', ')} ในการตรวจสอบ`);
    score = Math.min(MAX, r2(score));
    return { score, max: MAX, ok: score === MAX, feedback, details };
  } catch (e) {
    return { score: 0, max: MAX, ok: false, feedback: ['ข้อมูลที่ส่งมาไม่ถูกต้อง'], details: {} };
  }
}
function fmtName(t) {
  return { ip: 'ต้องเป็น IP เช่น 192.168.1.10', mask: 'ต้องเป็น Subnet mask เช่น 255.255.255.0 หรือ /24', mac: 'ต้องเป็น MAC 12 หลักฐานสิบหก เช่น 00-1A-2B-3C-4D-5E',
    num: 'ต้องเป็นตัวเลข', port: 'ต้องเป็นหมายเลขพอร์ต', dhcp: 'ตอบ DHCP หรือ Static', iface: 'ต้องเป็นชื่อ interface เช่น eth0' }[t] || '';
}

module.exports = { id: 'terminal', title: 'จำลองการใช้คำสั่งเครือข่าย (Terminal)', missions, grade, _keys: KEYS, _scenarios: PRIVATE };

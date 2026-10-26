'use strict';
// Network Monitoring & Automation lab — server grader.
// The engine (public/js/sim/netops.js, UMD) is the same code the browser runs, so grading re-runs the student's
// monitors / template + inventory / playbook on the simulated school network. Client scores are never trusted.
// generate(missionId, rand) returns { v:1, mission, seed } for o2, o3 and a2; the API signs it and grade() rebuilds
// the scenario from the seed. o1 and a1 use one fixed network and need no generated problem.
// Everything is a SIMULATION: nothing here contacts a real host.
const path = require('path');
const N = require(path.join(__dirname, '../../public/js/sim/netops.js'));
const ANS = require('./netops-answers.js');   // server-only answer key (the browser engine holds none)

const MAX = 10;
const MAX_PAYLOAD = 60000;

/* o1: the six critical services (public: shown to the student; the expected check type/port is NOT published) */
const O1_REQ = [
  { id: 'gw', th: 'Router R1 (default gateway ของทั้งโรงเรียน) ต้องตอบสนองตลอด', dev: 'R1', type: 'icmp' },
  { id: 'web', th: 'เว็บไซต์โรงเรียนแบบ HTTPS บน SRV-WEB (10.10.20.10)', dev: 'SRV-WEB', type: 'tcp', port: 443 },
  { id: 'file', th: 'บริการแชร์ไฟล์ของครู (SMB) บน SRV-FILE (10.10.20.11)', dev: 'SRV-FILE', type: 'tcp', port: 445 },
  { id: 'dns', th: 'บริการ DNS ของโรงเรียนบน SRV-DNS (10.10.20.12)', dev: 'SRV-DNS', type: 'tcp', port: 53 },   // see the UDP note in the o1 hints
  { id: 'ap', th: 'Access Point AP-1 ห้องสมุด (10.10.99.21) ต้องออนไลน์', dev: 'AP-1', type: 'icmp' },
  { id: 'wan', th: 'ปริมาณการใช้ลิงก์อินเทอร์เน็ต (utilization) ที่พอร์ต R1 Gi0/0', dev: 'R1', type: 'snmp', iface: 'Gi0/0' }
];
const O1_LIMITS = { icmp: [10, 120], tcp: [10, 120], snmp: [30, 300] };
const O1_TH = { latIcmp: [5, 300], loss: [1, 50], latTcp: [10, 2000], util: [50, 95] };

const MISSIONS = [
  { id: 'o1', level: 'easy', mode: 'guided', week: 14, title: 'ตั้ง Monitoring ให้ 6 บริการสำคัญ',
    desc: 'เพิ่ม monitor ให้บริการสำคัญ 6 รายการของโรงเรียน เลือกชนิดการตรวจให้เหมาะ (ICMP ping, TCP port หรือ SNMP interface) ตั้ง poll interval (รอบเวลาที่ระบบเข้าไปตรวจซ้ำ) และ threshold (ค่าขีดจำกัดที่ถ้าถึงแล้วจะแจ้งเตือน) ที่สมเหตุสมผล แล้วดูผลบน dashboard ตามเวลาจำลอง ระบบตรวจชุด monitor ของคุณที่เซิร์ฟเวอร์',
    hints: ['ping (ICMP) บอกได้แค่ว่าเครื่องยังตอบ แต่ไม่ได้บอกว่าบริการ (เว็บ, แชร์ไฟล์, DNS) ทำงาน ให้ใช้ TCP port check กับบริการ',
      'พอร์ตที่ควรรู้: HTTPS = 443, HTTP = 80, SMB = 445, DNS = 53, SSH = 22',
      'DNS: การถามชื่อทั่วไปใช้ UDP พอร์ต 53 (TCP 53 ใช้เมื่อคำตอบมีขนาดใหญ่และใช้ทำ zone transfer) ในแลปนี้ให้ตรวจ DNS ด้วย TCP port check พอร์ต 53 ซึ่งเป็นการตรวจแบบง่าย (บอกได้แค่ว่าบริการรับการเชื่อมต่อ) ระบบ monitoring จริงควรส่ง DNS query แล้วตรวจว่าได้คำตอบถูกต้อง',
      'utilization ของลิงก์ต้องอ่านจาก counter ของ interface ด้วย SNMP polling: เลือกอุปกรณ์ R1 แล้วเลือก interface Gi0/0',
      'poll interval: ping/TCP 10–120 วินาที, SNMP 30–300 วินาที (ถี่เกินไปเพิ่มภาระให้อุปกรณ์ ห่างเกินไปจะเห็นปัญหาช้า)',
      'threshold ที่สมเหตุสมผลใน LAN: latency เตือนที่ 5–300 ms (TCP 10–2000 ms), packet loss 1–50%, utilization 50–95%'],
    start: { mode: 'guided', week: 14, services: O1_REQ.map((r) => ({ id: r.id, th: r.th })),
      rules: ['ICMP ping และ TCP port: poll interval 10–120 วินาที',
        'DNS: ในแลปนี้ใช้ TCP port check พอร์ต 53 เป็นการตรวจแบบง่าย (DNS ทั่วไปถามด้วย UDP 53 การตรวจจริงควรส่ง DNS query)', 'SNMP interface: poll interval 30–300 วินาที',
        'threshold: latency (ping) 5–300 ms, packet loss 1–50%, latency (TCP) 10–2000 ms, utilization 50–95%'] } },
  { id: 'o2', level: 'medium', mode: 'troubleshooting', week: 14, title: 'สืบหาสาเหตุเครือข่ายล่ม จาก Dashboard และ Syslog',
    desc: 'มีผู้ใช้แจ้งปัญหา (สถานการณ์สุ่มเฉพาะของคุณ) ใช้ dashboard, interface counters และ syslog หาว่าอุปกรณ์หรือบริการใดเสีย สาเหตุคืออะไร เริ่มเมื่อเวลาใด แล้วเลือกบรรทัด log ที่เป็นหลักฐาน ระบบสร้างสถานการณ์เดิมขึ้นใหม่ที่เซิร์ฟเวอร์เพื่อตรวจ',
    hints: ['เริ่มจาก dashboard: monitor ไหนเป็น Down หรือ Warning และเริ่มเมื่อไร (เลื่อนเวลาจำลองดูได้)',
      'ถ้า ping ยังได้แต่ TCP check ของบริการ Down แปลว่าเครื่องยังอยู่ แต่บริการหยุด (ดู log ของ server ตัวนั้น)',
      'LINK-3-UPDOWN ขึ้น/ลงหลายรอบในเวลาสั้น ๆ = flapping, ลงครั้งเดียวแล้วอุปกรณ์ไม่ตอบเลย = device down',
      'สายเสียมักไม่ทำให้ลิงก์ล่มถาวร แต่ input errors / CRC ใน interface counters จะเพิ่มขึ้นเรื่อย ๆ',
      'กรอง syslog ตามอุปกรณ์และระดับความรุนแรง (severity) แล้วเลือกบรรทัดที่เกิดตรงกับเวลาที่ปัญหาเริ่ม อย่าเลือก log ที่ไม่เกี่ยว เช่น toner ใกล้หมด'],
    start: { mode: 'troubleshooting', week: 14, causes: N.CAUSES.filter((c) => c.id !== 'high_util') } },
  { id: 'o3', level: 'medium', mode: 'independent', week: 14, title: 'หา Top Talker และคอขวด (bottleneck)',
    desc: 'เครือข่ายช้าในบางช่วงเวลา (สถานการณ์สุ่มเฉพาะของคุณ) ใช้กราฟ utilization และ interface counters หา interface ที่เป็นคอขวด (ใช้งานเต็มความเร็ว) และพอร์ตของเครื่องที่ส่ง/รับข้อมูลมากที่สุด (top talker) พร้อมหลักฐาน: เวลาและค่า utilization ที่อ่านได้',
    hints: ['utilization (%) = bps ÷ ความเร็วของ interface × 100 ลิงก์ 100 Mbps เต็มง่ายกว่าลิงก์ 1 Gbps มาก (ดูคอลัมน์ Speed)',
      'คอขวดคือ interface ที่ utilization ใกล้ 100% ส่วน top talker คือพอร์ตปลายทางที่ต่อกับเครื่องผู้ใช้ซึ่งมีปริมาณข้อมูลสูงสุด',
      'ไล่ตามเส้นทาง: ลิงก์อินเทอร์เน็ต R1 Gi0/0 → CORE-SW1 → uplink ของ access switch → พอร์ตของเครื่อง',
      'ระวังตัวหลอก: interface ที่ใช้งาน 40–70% ยังไม่ใช่คอขวด'],
    start: { mode: 'independent', week: 14 } },
  { id: 'a1', level: 'medium', mode: 'guided', week: 12, title: 'Template + Inventory ตั้งค่า Access Switch 5 ตัว',
    desc: 'เขียน inventory (ตารางแบบ CSV) และ configuration template ที่มีตัวแปร {{ ... }}, ลูป {% for %} และเงื่อนไข {% if %} เพื่อตั้งค่า access switch ทั้ง 5 ตัว แล้วกด Push (จำลอง) ระบบตรวจจาก "สถานะของอุปกรณ์หลังได้รับ config" ไม่ได้เทียบข้อความ template ที่เขียนต่างกันแต่ได้ผลเหมือนกันได้คะแนนเท่ากัน',
    hints: ['inventory: บรรทัดแรกเป็นหัวตาราง เช่น hostname,mgmt_ip,role,vlans และ vlans คั่นด้วย ; เช่น 10;20;99',
      'ใน template ใช้ {{ hostname }}, {{ mgmt_ip }}, {{ vlan_list }} (ได้ "10,20,99") และวนลูป {% for v in vlans %} ... {% endfor %}',
      'ตั้งชื่อ VLAN ด้วยเงื่อนไข: {% if v == 10 %} name STUDENT {% elif v == 20 %} ... {% endif %}',
      'management IP อยู่ที่ interface Vlan99: ip address {{ mgmt_ip }} 255.255.255.0 และ no shutdown',
      'uplink คือ Gi0/24: description Uplink to CORE-SW1, switchport mode trunk, switchport trunk allowed vlan {{ vlan_list }} และอย่าลืม ip default-gateway 10.10.99.1'],
    start: { mode: 'guided', week: 12, devices: N.A1.devices, vlans: N.A1.vlans, gateway: N.A1.gateway, uplink: N.A1.uplink, uplinkDesc: N.A1.uplinkDesc,
      inventory: 'hostname,mgmt_ip,role,vlans\nACC-SW1,10.10.99.11,access,10;20;99\n',
      template: '{# ตัวอย่างเริ่มต้น: เติมส่วนที่เหลือให้ครบตามข้อกำหนด #}\nhostname {{ hostname }}\n!\n{% for v in vlans %}\nvlan {{ v }}\n{% endfor %}\n' } },
  { id: 'a2', level: 'hard', mode: 'independent', week: 12, title: 'Playbook: backup → apply → verify → rollback',
    desc: 'ต้องเพิ่ม VLAN 30 (LAB-IOT) ให้ access switch ทั้ง 5 ตัวด้วย template ที่กำหนด แต่จะมีอุปกรณ์ 1 ตัวที่ change นี้ใช้ไม่ได้ (สุ่มเฉพาะของคุณ) สร้าง playbook (รายการขั้นตอนอัตโนมัติที่สั่งให้ทำกับอุปกรณ์ทีละตัวตามลำดับ) ให้ทำงานกับทุกอุปกรณ์: สำรอง config, apply, ตรวจสอบ และ rollback อัตโนมัติเมื่อผิดพลาด โดยอุปกรณ์อื่นต้องสำเร็จ ระบบตรวจด้วยการรัน playbook ของคุณบนเครือข่ายจำลองที่เซิร์ฟเวอร์ (และทดสอบซ้ำกับความผิดพลาดอีกแบบที่ซ่อนไว้)',
    hints: ['ลำดับพื้นฐาน: backup → apply → verify (ping mgmt IP และ/หรือ TCP 22) → rollback เฉพาะเมื่อมีขั้นใดล้มเหลว',
      'when = success ทำต่อเมื่อยังไม่มีอะไรล้มเหลว, when = failure ทำเฉพาะเมื่อมีขั้นก่อนหน้าล้มเหลว (เหมือน rescue ของ Ansible), when = always ทำทุกครั้ง',
      'apply สำเร็จไม่ได้แปลว่าใช้งานได้: config ที่ตัด VLAN 99 ออกจาก trunk ทำให้ switch หลุดจาก management ต้อง verify จึงจะรู้',
      'save (copy running-config startup-config) ควรทำหลัง verify ผ่านเท่านั้น ถ้า save ก่อน ค่าที่เสียจะถูกบันทึกถาวร',
      'any_errors_fatal = หยุดทั้ง playbook เมื่ออุปกรณ์ตัวใดล้มเหลว จะทำให้อุปกรณ์ที่เหลือไม่ได้รับ change'],
    start: { mode: 'independent', week: 12, template: N.a2Setup('x').template, actions: N.ACTIONS, whens: N.WHENS,
      playbook: { tasks: [{ action: 'apply', when: 'success' }], anyErrorsFatal: false } } }
].map((m) => Object.assign({ max: MAX }, m));

const fail = (msg, extra) => ({ score: 0, max: MAX, ok: false, feedback: [msg], details: extra || {} });
const r1 = (x) => Math.round(x * 10) / 10;
function finalScore(raw, perfect) { return perfect ? MAX : Math.max(0, Math.min(MAX - 1, Math.round(raw))); }
const goodProblem = (mission, p) => !!(p && typeof p === 'object' && p.v === 1 && p.mission === mission && typeof p.seed === 'string' && /^[0-9a-f]{8,40}$/.test(p.seed));

function generate(missionId, rand) {
  if (typeof rand !== 'function') rand = Math.random;
  if (!['o2', 'o3', 'a2'].includes(missionId)) return null;
  let seed = '';
  for (let i = 0; i < 12; i++) seed += Math.floor(rand() * 16).toString(16);
  return { v: 1, mission: missionId, seed };
}

/* ---------------------------------------------------------------- o1 */
function gradeO1(payload) {
  const list = payload && Array.isArray(payload.monitors) ? payload.monitors : null;
  if (!list) return fail('ยังไม่มี monitor ให้ตรวจ: เพิ่ม monitor ในแท็บ "Monitors" ก่อนส่ง');
  if (list.length > 40) return fail('มี monitor มากเกินไป (ได้ไม่เกิน 40 รายการ)');
  const mons = [], bad = [];
  list.forEach((m, i) => { const v = N.validateMonitor(m); if (v.ok) mons.push(v.monitor); else bad.push(`monitor ลำดับที่ ${i + 1}: ${v.error}`); });
  if (!mons.length) return fail(bad.length ? 'monitor ทุกรายการไม่ถูกต้อง: ' + bad[0] : 'ยังไม่มี monitor ให้ตรวจ');
  const fb = [], per = {};
  let sum = 0, perfect = true;
  const inR = (v, [a, b]) => v >= a && v <= b;
  for (const q of O1_REQ) {
    const exact = mons.filter((m) => m.target === q.dev && m.type === q.type && (q.type !== 'tcp' || m.port === q.port) && (q.type !== 'snmp' || m.iface === q.iface));
    let f = 0, note = '';
    if (exact.length) {
      // the best of the matching monitors counts
      let best = -1;
      for (const m of exact) {
        const ivOk = inR(m.interval, O1_LIMITS[m.type]);
        const thOk = m.type === 'icmp' ? inR(m.latWarn, O1_TH.latIcmp) && inR(m.lossWarn, O1_TH.loss) : m.type === 'tcp' ? inR(m.latWarn, O1_TH.latTcp) : inR(m.utilWarn, O1_TH.util);
        const s = 0.6 + (ivOk ? 0.15 : 0) + (thOk ? 0.25 : 0);
        if (s > best) {
          best = s;
          note = [];
          if (!ivOk) note.push(`poll interval ${m.interval} วินาทีไม่เหมาะ (${m.type === 'snmp' ? 'SNMP ควรอยู่ระหว่าง 30–300' : 'ping/TCP ควรอยู่ระหว่าง 10–120'} วินาที${m.interval < O1_LIMITS[m.type][0] ? ' ถี่เกินไปจะเพิ่มภาระให้อุปกรณ์และเครือข่าย' : ' ห่างเกินไปจะรู้ปัญหาช้า'})`);
          if (!thOk) {
            if (m.type === 'icmp') note.push(`threshold ไม่สมเหตุสมผล (latency ${m.latWarn} ms, loss ${m.lossWarn}%) ใน LAN ควรเตือนที่ latency 5–300 ms และ loss 1–50%`);
            else if (m.type === 'tcp') note.push(`threshold latency ${m.latWarn} ms ไม่สมเหตุสมผล ควรอยู่ระหว่าง 10–2000 ms`);
            else note.push(`threshold utilization ${m.utilWarn}% ไม่สมเหตุสมผล ควรเตือนที่ 50–95% (${m.utilWarn > 95 ? 'สูงเกินไปจะเตือนเมื่อสายเต็มแล้ว' : 'ต่ำเกินไปจะเตือนบ่อยจนไม่มีใครสนใจ'})`);
          }
          note = note.join(' และ ');
        }
      }
      f = best;
      if (f < 1) fb.push(`${q.th}: มี monitor แล้ว แต่ ${note}`);
    } else {
      perfect = false;
      const onDev = mons.filter((m) => m.target === q.dev);
      if (q.type === 'tcp' && onDev.some((m) => m.type === 'tcp')) {
        const p = onDev.find((m) => m.type === 'tcp').port;
        f = 0.2;
        fb.push(`${q.th}: ตรวจ TCP ผิดพอร์ต (${p}) ` + (q.port === 443 && p === 80 ? 'พอร์ต 80 คือ HTTP ที่ไม่เข้ารหัส เว็บ HTTPS ใช้พอร์ต 443' : q.port === 445 && p === 139 ? 'พอร์ต 139 คือ NetBIOS รุ่นเก่า SMB ปัจจุบันใช้พอร์ต 445' : 'ดูคำใบ้เรื่องหมายเลขพอร์ตของบริการ'));
      } else if (q.type === 'tcp' && onDev.some((m) => m.type === 'icmp')) {
        f = 0.2;
        fb.push(`${q.th}: ใช้ ping อย่างเดียวไม่พอ เพราะ server อาจยังตอบ ping ทั้งที่บริการหยุดทำงาน ให้ใช้ TCP port check`);
      } else if (q.type === 'snmp' && onDev.some((m) => m.type === 'snmp')) {
        f = 0.2;
        fb.push(`${q.th}: ตรวจ SNMP ผิด interface (${onDev.find((m) => m.type === 'snmp').iface}) ลิงก์อินเทอร์เน็ตคือ Gi0/0`);
      } else if (q.type === 'snmp' && onDev.length) {
        f = 0.2;
        fb.push(`${q.th}: ping/TCP ไม่บอกปริมาณการใช้ลิงก์ ต้องใช้ SNMP interface polling`);
      } else if (q.type === 'icmp' && onDev.length) {
        f = 0.4;
        fb.push(`${q.th}: เป้าหมายนี้ต้องการรู้ว่าอุปกรณ์ออนไลน์หรือไม่ ใช้ ICMP ping`);
      } else fb.push(`ยังไม่ได้ monitor: ${q.th}`);
    }
    if (f < 1) perfect = false;
    per[q.id] = r1(f);
    sum += f;
  }
  const raw = (MAX * sum) / O1_REQ.length;
  const score = finalScore(raw, perfect);
  if (bad.length) fb.push(`มี monitor ที่ไม่ถูกต้อง ${bad.length} รายการ (ไม่นับ): ${bad[0]}`);
  fb.unshift(perfect ? 'ครบทั้ง 6 บริการ ชนิดการตรวจ interval และ threshold เหมาะสม เยี่ยมมาก!' : `ได้ ${score}/${MAX} ดูรายการที่ต้องแก้ด้านล่าง`);
  return { score, max: MAX, ok: score === MAX, feedback: fb, details: { per, monitors: mons.length } };
}

/* ---------------------------------------------------------------- o2 */
const CAUSE_WHY = {   // what each cause looks like in the data (shown for the cause the student CHOSE)
  device_down: 'ถ้าอุปกรณ์ดับทั้งตัว ping จะไม่ตอบเลยช่วงหนึ่ง และ log จะมีพอร์ตฝั่งตรงข้ามลง (LINK-3-UPDOWN) ครั้งเดียว อาจตามด้วย SYS-5-RESTART เมื่อไฟกลับมา',
  flapping: 'ถ้าเป็น flapping จะเห็น LINK-3-UPDOWN ลง/ขึ้นสลับกันหลายรอบในเวลาไม่กี่นาที และ ping หายเป็นช่วง ๆ',
  service_down: 'ถ้าเป็น service down ping จะยังตอบตามปกติ แต่ TCP port check ของบริการ Down และ log ของ server บอกว่า process หยุด',
  bad_cable: 'ถ้าเป็นสายเสีย ลิงก์จะยังขึ้นอยู่เกือบตลอด แต่ input errors / CRC ใน interface counters เพิ่มขึ้นเรื่อย ๆ และมี packet loss เล็กน้อย'
};
function gradeO2(payload, problem) {
  if (!goodProblem('o2', problem)) return fail('โจทย์ไม่ถูกต้องหรือถูกแก้ไข กด "สถานการณ์ใหม่" แล้วลองอีกครั้ง');
  const a = payload && payload.answer;
  if (!a || typeof a !== 'object') return fail('ยังไม่ได้ตอบ: เลือกอุปกรณ์ สาเหตุ เวลา และหลักฐานในแท็บ "คำตอบ"');
  const sim = N.simulate(N.scenario('o2', problem.seed)), key = ANS.answerFor('o2', problem.seed);
  const fb = []; let raw = 0;
  const cause = String(a.cause || ''), dev = String(a.device || '').slice(0, 20);
  const det = { cause: false, device: false, time: 0, evidence: 0 };
  if (cause === key.cause) { raw += 4; det.cause = true; }
  // describe the CHOSEN cause's signature, never the real one (Phase 6 leak fix)
  else fb.push(cause ? `สาเหตุยังไม่ถูก: ${CAUSE_WHY[cause] ? CAUSE_WHY[cause] + ' ลองเทียบกับข้อมูลที่เห็นอีกครั้ง' : 'เลือกจากรายการสาเหตุ'}` : 'ยังไม่ได้เลือกสาเหตุ');
  if (key.devs.includes(dev)) { raw += 2; det.device = true; }
  else if (!dev) fb.push('ยังไม่ได้เลือกอุปกรณ์ที่เป็นต้นเหตุ');
  else fb.push(`อุปกรณ์ ${dev} ยังไม่ใช่ต้นเหตุ (ดูว่า monitor และ log ของอุปกรณ์ใดเริ่มผิดปกติก่อน switch ที่บันทึกว่าพอร์ตลงอาจเป็นแค่ฝั่งที่ "เห็น" ปัญหา ต้นเหตุอาจอยู่ปลายสายอีกด้าน)`);
  const t = N.parseTime(a.time);
  if (t == null) fb.push('ยังไม่ได้ระบุเวลาที่ปัญหาเริ่ม (รูปแบบ ชช:นน เช่น 08:25)');
  else {
    const d = Math.abs(t - key.t0);
    if (d <= 120) { raw += 2; det.time = 2; }
    else if (d <= 300) { raw += 1; det.time = 1; fb.push(`เวลาที่ตอบ (${N.fmtTime(t, true)}) ใกล้เคียงแต่คลาดเกิน 2 นาที ให้ดูบรรทัด log แรกของเหตุการณ์`); }
    else fb.push(`เวลาที่ตอบ (${N.fmtTime(t, true)}) ไม่ตรงกับช่วงที่ปัญหาเริ่ม`);
  }
  const ev = Array.isArray(a.evidence) ? [...new Set(a.evidence.slice(0, 30).map(Number).filter((x) => Number.isInteger(x) && x > 0))].slice(0, 20) : [];
  const rel = ANS.incidentLogIds('o2', problem.seed, sim);
  const hit = ev.filter((x) => rel.has(x)).length;
  if (hit >= 2 && hit / ev.length >= 0.5) { raw += 2; det.evidence = 2; }
  else if (hit >= 1) { raw += 1; det.evidence = 1; fb.push(hit < 2 ? 'หลักฐานยังน้อยไป: เลือกบรรทัด log ที่เกี่ยวกับเหตุการณ์อย่างน้อย 2 บรรทัด' : 'เลือก log ที่ไม่เกี่ยวข้องมากเกินไป (เช่น login, Wi-Fi associated, toner) เลือกเฉพาะบรรทัดของเหตุการณ์'); }
  else fb.push(ev.length ? 'บรรทัด log ที่เลือกไม่ใช่หลักฐานของเหตุการณ์นี้' : 'ยังไม่ได้เลือกบรรทัด log เป็นหลักฐาน (กดช่องเลือกหน้าบรรทัดใน Syslog)');
  const perfect = raw === 10;
  const score = finalScore(raw, perfect);
  fb.unshift(perfect ? 'วิเคราะห์ถูกต้องครบ ทั้งสาเหตุ อุปกรณ์ เวลา และหลักฐาน เยี่ยมมาก!' : `ได้ ${score}/${MAX}`);
  return { score, max: MAX, ok: perfect, feedback: fb, details: det };
}

/* ---------------------------------------------------------------- o3 */
function gradeO3(payload, problem) {
  if (!goodProblem('o3', problem)) return fail('โจทย์ไม่ถูกต้องหรือถูกแก้ไข กด "สถานการณ์ใหม่" แล้วลองอีกครั้ง');
  const a = payload && payload.answer;
  if (!a || typeof a !== 'object') return fail('ยังไม่ได้ตอบ: เลือก interface ที่เป็นคอขวด พอร์ต top talker เวลา และค่า utilization');
  const sim = N.simulate(N.scenario('o3', problem.seed)), key = ANS.answerFor('o3', problem.seed);
  // feedback on a wrong pick describes the PICKED port (its role in the network), never the real answer
  const userPort = (p) => /^ACC-SW\d$/.test(p[0]) && /^Gi0\/[1-6]$/.test(p[1]);
  const pair = (x) => (x && typeof x === 'object' ? [String(x.dev || '').slice(0, 20), String(x.iface || '').slice(0, 20)] : ['', '']);
  const same = (p, q) => p[0] === q[0] && p[1] === q[1];
  const b = pair(a.bottleneck), tk = pair(a.talker);
  const fb = []; let raw = 0; const det = { bottleneck: false, talker: false, time: false, util: false };
  if (key.bottleneck.some((q) => same(q, b))) { raw += 4; det.bottleneck = true; }
  else if (!b[0]) fb.push('ยังไม่ได้เลือก interface ที่เป็นคอขวด');
  else if (userPort(b)) fb.push(`${b[0]} ${b[1]} เป็นพอร์ตที่ต่อกับเครื่องผู้ใช้ คอขวดคือ interface ระหว่างทาง (uplink หรือลิงก์อินเทอร์เน็ต) ที่ utilization ใกล้ 100%`);
  else fb.push(`${b[0]} ${b[1]} ยังไม่ใช่คอขวด: หา interface ที่ utilization ใกล้ 100% ในช่วงที่ช้า (ดูความเร็ว Speed ของแต่ละพอร์ตด้วย)`);
  if (key.talker.some((q) => same(q, tk))) { raw += 3; det.talker = true; }
  else if (!tk[0]) fb.push('ยังไม่ได้เลือกพอร์ตของ top talker');
  else if (!userPort(tk)) fb.push('พอร์ต top talker ต้องเป็นพอร์ตที่ต่อกับเครื่องผู้ใช้ (Gi0/1–Gi0/6 บน access switch) ไม่ใช่ uplink หรือลิงก์อินเทอร์เน็ต');
  else fb.push(`${tk[0]} ${tk[1]} ยังไม่ใช่ top talker: ดู counter ของพอร์ตเครื่องผู้ใช้ (Gi0/1–Gi0/6) บน access switch ที่อยู่บนเส้นทางของคอขวด`);
  const t = N.parseTime(a.time);
  if (t != null && t >= key.t0 && t <= key.t1) {
    raw += 2; det.time = true;
    const ref = det.bottleneck ? b : key.bottleneck[0];
    const ser = N.ifaceSeries(sim, ref[0], ref[1]);
    const u = Number(String(a.util == null ? '' : a.util).replace('%', '').trim());
    if (String(a.util == null ? '' : a.util).trim() !== '' && Number.isFinite(u)) {
      const s0 = Math.max(0, N.stepOf(t - 60)), s1 = Math.min(N.NSTEP - 1, N.stepOf(t + 120));
      let lo = Infinity, hi = -Infinity;
      for (let s = s0; s <= s1; s++) { const v = Math.max(ser.inPct[s] || 0, ser.outPct[s] || 0); lo = Math.min(lo, v); hi = Math.max(hi, v); }
      if (u >= lo - 10 && u <= hi + 10) { raw += 1; det.util = true; }
      else fb.push(det.bottleneck ? `ค่า utilization ${u}% ไม่ตรงกับที่ ${ref[0]} ${ref[1]} วัดได้ในเวลานั้น (อ่านจากคอลัมน์ Util ในแท็บ Interfaces ณ เวลาที่ตอบ)` : `ค่า utilization ${u}% ไม่ตรงกับค่าที่คอขวดจริงวัดได้ในเวลานั้น (อ่านจากคอลัมน์ Util ของ interface ที่เป็นคอขวด ณ เวลาที่ตอบ)`);
    } else fb.push('ยังไม่ได้ใส่ค่า utilization (%) ที่อ่านได้เป็นหลักฐาน');
  } else fb.push(t == null ? 'ยังไม่ได้ระบุเวลาที่พบปัญหา (รูปแบบ ชช:นน)' : `เวลา ${N.fmtTime(t, true)} ไม่อยู่ในช่วงที่คอขวดเกิดขึ้น`);
  const perfect = raw === 10;
  const score = finalScore(raw, perfect);
  fb.unshift(perfect ? 'ถูกต้องครบ: คอขวด top talker และหลักฐาน เยี่ยมมาก!' : `ได้ ${score}/${MAX}`);
  return { score, max: MAX, ok: perfect, feedback: fb, details: det };
}

/* ---------------------------------------------------------------- a1 */
function gradeA1(payload) {
  if (!payload || typeof payload.inventory !== 'string' || typeof payload.template !== 'string') return fail('ต้องส่งทั้ง inventory และ template');
  if (payload.inventory.length > N.INV_LIMITS.MAX_SRC) return fail(`inventory ยาวเกิน ${N.INV_LIMITS.MAX_SRC} ตัวอักษร`);
  if (payload.template.length > N.tpl.LIMITS.MAX_SRC) return fail(`template ยาวเกิน ${N.tpl.LIMITS.MAX_SRC} ตัวอักษร`);
  const res = N.push(payload.inventory, payload.template);
  const fb = []; const det = {};
  if (res.templateError) fb.push(`template ผิดที่บรรทัด ${res.templateError.line}: ${res.templateError.msg}`);
  res.errors.slice(0, 4).forEach((e) => fb.push(`inventory บรรทัด ${e.line}: ${e.msg}`));
  const W = { hostname: 0.4, mgmt: 0.4, vlans: 0.3, names: 0.2, desc: 0.3, trunk: 0.2, gw: 0.2 };
  const TH = { hostname: 'hostname', mgmt: 'management IP ที่ interface Vlan99 (IP/mask ถูกต้องและ no shutdown)', vlans: 'มี VLAN 10, 20, 99', names: 'ชื่อ VLAN (STUDENT, TEACHER, MGMT)', desc: 'description ของ uplink Gi0/24 = "Uplink to CORE-SW1"', trunk: 'Gi0/24 เป็น trunk และอนุญาต VLAN 10,20,99', gw: 'ip default-gateway 10.10.99.1' };
  const miss = {}; Object.keys(W).forEach((k) => { miss[k] = []; });
  let raw = 0;
  for (const d of N.A1.devices) {
    const r = res.devices.find((x) => x.id === d.id);
    const st = r ? r.state : null;
    const c = {};
    if (!r) { Object.keys(W).forEach((k) => { c[k] = false; }); }
    else {
      c.hostname = st.hostname === d.id;
      const s = st.ifaces.Vlan99;
      c.mgmt = !!(s && s.ip === d.ip && s.mask === '255.255.255.0' && !s.shutdown);
      c.vlans = [10, 20, 99].every((v) => Object.prototype.hasOwnProperty.call(st.vlans, v));
      c.names = c.vlans && [10, 20, 99].every((v) => String(st.vlans[v]).toUpperCase() === N.A1.vlans[v]);
      const u = st.ifaces['Gi0/24'];
      c.desc = String(u.desc).trim().toLowerCase() === N.A1.uplinkDesc.toLowerCase();
      c.trunk = u.mode === 'trunk' && !u.shutdown && (u.allowed == null || [10, 20, 99].every((v) => u.allowed.includes(v)));
      c.gw = st.gateway === N.A1.gateway;
      if (r.renderError && !res.templateError) fb.push(`${d.id}: render ไม่สำเร็จ บรรทัด ${r.renderError.line}: ${r.renderError.msg}`);
      (r.errors || []).slice(0, 2).forEach((e) => fb.push(`${d.id}: config บรรทัด ${e.line} "${e.cmd.trim()}" ${e.msg}`));
      if (!c.mgmt && r.state.ifaces.Vlan99 && r.state.ifaces.Vlan99.ip && r.state.ifaces.Vlan99.ip !== d.ip) fb.push(`${d.id}: management IP เป็น ${r.state.ifaces.Vlan99.ip} แต่ต้องเป็น ${d.ip} (ตรวจคอลัมน์ mgmt_ip ใน inventory)`);
    }
    Object.keys(W).forEach((k) => { if (c[k]) raw += W[k]; else miss[k].push(d.id); });
    det[d.id] = c;
  }
  if (res.missing.length) fb.push(`inventory ยังไม่มีอุปกรณ์: ${res.missing.join(', ')}`);
  Object.keys(W).forEach((k) => { if (miss[k].length && miss[k].length > res.missing.length) fb.push(`ยังไม่ถูกต้อง — ${TH[k]}: ${miss[k].filter((x) => !res.missing.includes(x)).join(', ')}`); });
  const perfect = Object.values(miss).every((x) => !x.length);
  const score = finalScore(raw, perfect);
  fb.unshift(perfect ? 'switch ทั้ง 5 ตัวได้ config ครบถูกต้อง เยี่ยมมาก!' : `ได้ ${score}/${MAX} (ตรวจจากสถานะของ switch หลัง push)`);
  return { score, max: MAX, ok: perfect, feedback: fb.slice(0, 20), details: det };
}

/* ---------------------------------------------------------------- a2 */
function judgeRun(rep, setup) {
  const failDev = setup.fail.dev;
  let good = 0; const goodBad = []; let f = { restored: false, startup: false, applied: false, status: '' };
  for (const d of rep.devices) {
    const appliedRan = d.tasks.some((t) => t.action === 'apply' && t.result !== 'skipped');
    if (d.id === failDev) {
      f = { applied: appliedRan, restored: appliedRan && d.sameAsOriginal && d.reachable, startup: appliedRan && d.startupOriginal, status: d.status, reachable: d.reachable };
    } else if (d.status === 'ok' && d.hasChange && d.reachable) good++;
    else goodBad.push(d);
  }
  return { good, goodBad, f };
}
function gradeA2(payload, problem) {
  if (!goodProblem('a2', problem)) return fail('โจทย์ไม่ถูกต้องหรือถูกแก้ไข กด "สถานการณ์ใหม่" แล้วลองอีกครั้ง');
  const pb = payload && payload.playbook;
  const v = N.validatePlaybook(pb);
  if (!v.ok) return fail(v.error);
  const tasks = v.playbook.tasks;
  if (!tasks.length) return fail('playbook ยังไม่มี task');
  const setup = N.a2Setup(problem.seed);
  const rep = N.runPlaybook(setup, v.playbook);
  const J = judgeRun(rep, setup);
  const fb = []; let raw = 0;
  raw += 1.5 * J.good;
  if (J.f.restored) raw += 2;
  if (J.f.startup) raw += 1;
  // robustness: the same playbook against the other kind of failure on another device
  const other = { dev: N.ACCESS[(N.ACCESS.indexOf(setup.fail.dev) + 2) % 5], type: setup.fail.type === 'mgmt_lost' ? 'cmd_reject' : 'mgmt_lost' };
  const setup2 = N.a2Setup(problem.seed, other);
  const J2 = judgeRun(N.runPlaybook(setup2, v.playbook), setup2);
  const robust = J2.good === 4 && J2.f.restored && J2.f.startup;
  if (robust) raw += 1;
  /* feedback on typical mistakes */
  const idx = (a, w) => tasks.findIndex((t) => t.action === a && (!w || w.includes(t.when)));
  const iApply = idx('apply', ['success', 'always']), iBackup = idx('backup'), iRb = idx('rollback');
  const iVer = tasks.findIndex((t, i) => i > iApply && /^verify/.test(t.action) && t.when !== 'failure');
  if (iApply < 0) fb.push('ไม่มี task apply ที่ทำงานตามปกติ (when = success) อุปกรณ์จึงไม่ได้รับ change');
  if (iBackup < 0 || (iApply >= 0 && iBackup > iApply)) fb.push('ต้อง backup ก่อน apply ไม่อย่างนั้นจะไม่มีค่าเดิมให้ rollback');
  if (iApply >= 0 && iVer < 0) fb.push('ไม่มีขั้น verify หลัง apply: config ที่ apply ได้แต่ทำให้ switch หลุดจาก management จะไม่ถูกตรวจพบ');
  if (iRb < 0) fb.push('ไม่มี task rollback เมื่อเกิดความผิดพลาด');
  else if (!tasks.some((t) => t.action === 'rollback' && t.when === 'failure')) fb.push('rollback ควรตั้ง when = failure (ทำเฉพาะเมื่อขั้นก่อนหน้าล้มเหลว) ไม่อย่างนั้นอุปกรณ์ที่สำเร็จจะถูกย้อนกลับด้วย');
  const iSave = idx('save', ['success', 'always']);
  if (iSave >= 0 && iVer >= 0 && iSave < iVer) fb.push('save ก่อน verify ทำให้ config ที่เสียถูกบันทึกลง startup-config ควร save หลัง verify ผ่าน');
  if (iSave >= 0 && tasks[iSave].when === 'always') fb.push('save ตั้งเป็น always จะบันทึกแม้ change ล้มเหลว');
  if (tasks.some((t) => t.action === 'verify_port' && t.port !== 22)) fb.push('switch เปิดเฉพาะ SSH (TCP 22) การ verify พอร์ตอื่นจะล้มเหลวทุกตัว');
  if (v.playbook.anyErrorsFatal && rep.stopped) fb.push('any_errors_fatal หยุด playbook ทันทีที่มีอุปกรณ์ล้มเหลว อุปกรณ์ที่เหลือจึงไม่ได้รับ change');
  if (J.good < 4) fb.push(`อุปกรณ์ที่ควรสำเร็จ สำเร็จจริง ${J.good}/4 ตัว` + (J.goodBad.length ? ` (ยังไม่สำเร็จ: ${J.goodBad.map((d) => d.id + ' = ' + d.status).join(', ')})` : ''));
  if (!J.f.restored) fb.push(`${setup.fail.dev} (อุปกรณ์ที่ change ใช้ไม่ได้) ` + (!J.f.applied ? 'ไม่ได้ถูก apply เลย' : J.f.reachable ? 'ยังค้าง config ครึ่ง ๆ กลาง ๆ ไม่ได้ย้อนกลับเป็นค่าเดิม' : 'หลุดจาก management และไม่ได้ rollback'));
  if (J.f.applied && !J.f.startup) fb.push(`${setup.fail.dev}: startup-config ถูกบันทึกค่าที่เสียไว้ ถ้ารีบูตจะกลับมาเสียอีก`);
  if (!robust && J.good === 4 && J.f.restored && J.f.startup) fb.push('playbook นี้ผ่านกรณีของคุณ แต่ยังไม่ผ่านความผิดพลาดอีกแบบที่ระบบทดสอบซ้ำ (เช่น apply ได้แต่ switch หลุด หรือ switch รุ่นเก่าไม่รับคำสั่ง) ตรวจว่ามีทั้ง verify และ rollback เมื่อ failure');
  const perfect = J.good === 4 && J.f.restored && J.f.startup && robust;
  const score = finalScore(raw, perfect);
  fb.unshift(perfect ? 'playbook ทำงานถูกต้อง: อุปกรณ์ปกติได้ change ครบ และตัวที่ผิดพลาดถูก rollback อัตโนมัติ เยี่ยมมาก!' : `ได้ ${score}/${MAX} (ตรวจจากการรัน playbook บนเครือข่ายจำลอง)`);
  return { score, max: MAX, ok: perfect, feedback: fb.slice(0, 20), details: { good: J.good, failDev: setup.fail.dev, restored: J.f.restored, startup: J.f.startup, robust,
    report: rep.devices.map((d) => ({ id: d.id, status: d.status, reachable: d.reachable })) } };
}

function grade(missionId, payload, problem) {
  try {
    if (!MISSIONS.some((m) => m.id === missionId)) return fail('ไม่พบภารกิจนี้');
    let size = 0;
    try { size = JSON.stringify(payload === undefined ? null : payload).length; } catch (e) { return fail('ข้อมูลที่ส่งมาไม่ถูกต้อง'); }
    if (size > MAX_PAYLOAD) return fail('ข้อมูลที่ส่งมีขนาดใหญ่เกินไป');
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return fail('ข้อมูลที่ส่งมาไม่ถูกต้อง');
    if (missionId === 'o1') return gradeO1(payload);
    if (missionId === 'o2') return gradeO2(payload, problem);
    if (missionId === 'o3') return gradeO3(payload, problem);
    if (missionId === 'a1') return gradeA1(payload);
    return gradeA2(payload, problem);
  } catch (e) {
    return fail('ตรวจงานไม่ได้ (ข้อมูลไม่ถูกต้อง)');
  }
}

module.exports = {
  id: 'netops',
  title: 'ห้องปฏิบัติการ Network Monitoring และ Automation',
  missions: MISSIONS.map((m) => ({ id: m.id, title: m.title, level: m.level, desc: m.desc, max: m.max, hints: m.hints, start: m.start })),
  generatedMissions: ['o2', 'o3', 'a2'],
  generate,
  grade,
  _internal: { O1_REQ, O1_LIMITS, O1_TH, goodProblem }
};

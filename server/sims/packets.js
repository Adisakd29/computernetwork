'use strict';
/*
 * Packet Analysis lab (ห้องวิเคราะห์แพ็กเก็ต) - server side.
 * generate(missionId, rand) -> { v: 1, mission, seed }   (public; the API HMAC-signs it)
 * grade(missionId, payload, problem) rebuilds the SAME simulated capture from the signed seed with the shared
 * library (public/js/sim/packets.js) and grades against the answers derived from that capture by the server-only
 * module server/sims/packets-answers.js (the browser library holds no answer object).
 * Payload: { answers: { <fieldKey>: string } }   (p5: { conclusion, evidence: "12, 15" }, p6: { f0..f4: filter })
 * Never trusts client scores; malformed/oversized payloads -> 0 with a Thai message; never throws.
 */
const path = require('path');
const PK = require(path.join(__dirname, '..', '..', 'public', 'js', 'sim', 'packets.js'));
const ANS = require('./packets-answers.js');
/* the public build + the server-side answers (b.facts) for grading */
function buildGraded(problem) {
  const b = PK.buildMission(problem);
  if (b) b.facts = ANS.factsFor(b);
  return b;
}

const MAX = 10;
const missions = [
  { id: 'p1', level: 'easy', mode: 'guided', week: 3, title: 'Encapsulation: แกะ header ทีละชั้น',
    desc: 'โหมดแนะนำ (Guided) · สัปดาห์ที่ 3 — เลือกแพ็กเก็ตที่โจทย์กำหนด ระบุว่า header แต่ละส่วน (Ethernet II, IPv4, TCP/UDP, ข้อมูลแอปพลิเคชัน) อยู่ชั้นใดของ OSI และอ่านค่าสำคัญ: MAC address, IP address และหมายเลขพอร์ต',
    hints: ['ข้อมูลถูกห่อจากชั้นบนลงล่าง (encapsulation): Application → Transport → Network → Data Link ใน capture จึงเห็น header ของชั้นล่างสุดอยู่นอกสุด (บนสุดของแผงรายละเอียด)',
      'MAC address ใช้ส่งเฟรมภายในวง LAN เดียวกันทีละ hop ส่วน IP address บอกต้นทางและปลายทางจริงตลอดเส้นทาง',
      'หมายเลขพอร์ตบอกว่าเป็นบริการ/โปรแกรมใด เช่น HTTP ใช้ 80, DNS ใช้ 53 ฝั่ง client ใช้พอร์ตสุ่ม (ephemeral port)'] },
  { id: 'p2', level: 'medium', mode: 'guided', week: 10, title: 'TCP 3-way handshake และการคำนวณ ACK',
    desc: 'โหมดแนะนำ (Guided) · สัปดาห์ที่ 10 — หาแพ็กเก็ต SYN, SYN-ACK, ACK ของการเชื่อมต่อที่โจทย์กำหนด ระบุพอร์ตของ client และ server อ่านค่า Acknowledgment number (raw) และคำนวณ ACK ที่ server ต้องตอบหลังได้รับ HTTP GET',
    hints: ['ตัวกรอง tcp.flags.syn == 1 จะเหลือเฉพาะ SYN และ SYN-ACK ส่วน ip.addr == <IP ของเว็บ> ช่วยแยกการเชื่อมต่อที่สนใจ',
      'ACK ในขั้นที่ 3 = Sequence number (raw) ของ SYN-ACK + 1 เพราะบิต SYN นับเป็นข้อมูล 1 ไบต์',
      'ACK ถัดไป = Sequence number (raw) ของแพ็กเก็ตที่ได้รับ + จำนวนไบต์ข้อมูล (TCP Segment Len)'] },
  { id: 'p3', level: 'easy', mode: 'independent', week: 10, title: 'DNS over UDP: Query และ Response',
    desc: 'ทำเอง (Independent) · สัปดาห์ที่ 10 — มีการถาม DNS หลายชื่อพร้อมกัน หา query และ response ของชื่อที่โจทย์กำหนด Transaction ID, IP ที่ได้ และ transport/พอร์ตที่ DNS ใช้',
    hints: ['ตัวกรอง dns หรือ udp.port == 53 หรือ dns.qry.name == "ชื่อเว็บ"',
      'query และ response คู่เดียวกันมี Transaction ID ตรงกัน (response อาจไม่ได้มาตามลำดับเดียวกับ query)',
      'IP ที่ได้อยู่ในส่วน Answers ของ response (record A) ไม่ใช่ IP ของ DNS server'] },
  { id: 'p4', level: 'medium', mode: 'independent', week: 10, title: 'DHCP DORA: ขอ IP อัตโนมัติ',
    desc: 'ทำเอง (Independent) · สัปดาห์ที่ 10 — มีสองเครื่องขอ IP พร้อมกัน เรียงและระบุข้อความ Discover, Offer, Request, ACK ของเครื่องที่โจทย์กำหนด แล้วอ่าน IP ที่ได้รับ, DHCP server, lease time และ Transaction ID',
    hints: ['ตัวกรอง dhcp (หรือ bootp) แล้วดู Client MAC address ในแต่ละข้อความ',
      'ข้อความทั้ง 4 ของรอบเดียวกันมี Transaction ID เดียวกัน ชนิดข้อความดูที่ Option (53) DHCP Message Type',
      'IP ที่ได้รับอยู่ในช่อง Your (client) IP address, DHCP server ดูที่ Option (54), lease time ดูที่ Option (51)'] },
  { id: 'p5', level: 'medium', mode: 'troubleshooting', week: 14, title: 'แก้ปัญหา "เปิดเว็บไม่ได้" จาก capture',
    desc: 'แก้ปัญหา (Troubleshooting Challenge) · สัปดาห์ที่ 14 — วิเคราะห์ capture ขณะผู้ใช้เปิดเว็บไม่ได้ ตัดสินว่าเป็นปัญหา DNS, พอร์ตปิด (TCP RST) หรือถูก firewall กรอง แล้วอ้างหมายเลขแพ็กเก็ตเป็นหลักฐาน (ข้อสรุป 6 คะแนน หลักฐาน 4 คะแนน)',
    hints: ['ไล่ทีละขั้น: DNS ได้ IP หรือไม่ → มี TCP SYN ไปยัง IP นั้นหรือไม่ → SYN ได้อะไรตอบกลับ',
      'ได้ RST, ACK = เครื่องปลายทางปฏิเสธ (พอร์ตปิด) / SYN ถูกส่งซ้ำ (TCP Retransmission) โดยไม่มีคำตอบ หรือได้ ICMP type 3 code 13 = ถูกกรอง',
      'DNS response ที่ Reply code เป็น No such name หรือ query ที่ไม่มี response เลย = DNS ล้มเหลว',
      'หลักฐานคือแพ็กเก็ตที่ยืนยันข้อสรุปโดยตรง อย่าใส่แพ็กเก็ตที่ไม่เกี่ยว เช่น ARP, ping หรือ NTP'] },
  { id: 'p6', level: 'medium', mode: 'independent', week: 14, title: 'Display Filter Challenge',
    desc: 'ทำเอง (Independent) · สัปดาห์ที่ 10/14 — เขียน display filter 5 ข้อให้แสดงเฉพาะแพ็กเก็ตที่โจทย์ต้องการ ระบบรันตัวกรองของนักเรียนกับ capture เดียวกันที่เซิร์ฟเวอร์ ตัวกรองที่เขียนต่างกันแต่ได้ชุดแพ็กเก็ตเดียวกันถือว่าถูก (ข้อละ 2 คะแนน)',
    hints: ['ชื่อโปรโตคอลอย่างเดียวก็เป็นตัวกรองได้ เช่น dns, arp, icmp, dhcp, http',
      '&& (and) = และ, || (or) = หรือ, ! (not) = ไม่ใช่ เช่น udp && !dns',
      'ip.addr ตรงได้ทั้งต้นทางหรือปลายทาง ส่วน ip.src / ip.dst เจาะจงฝั่ง; tcp.port, tcp.srcport, tcp.dstport ก็เช่นกัน',
      'กดปุ่ม "ทดลอง" ข้างแต่ละข้อเพื่อดูผลกับ capture ก่อนส่ง'] }
].map((m) => Object.assign({ max: MAX }, m));

/* ------------------------------------------------------------------ helpers */
const zero = (msg) => ({ score: 0, max: MAX, ok: false, feedback: [msg] });
const BAD_PROBLEM = 'โจทย์ไม่ถูกต้องหรือหมดอายุ กรุณากด "โจทย์ใหม่" แล้วลองอีกครั้ง';
const str = (v) => (typeof v === 'string' || typeof v === 'number') ? String(v).slice(0, 400).trim() : '';
const parse = {
  frame(v) { const s = str(v).replace(/^#\s*/, ''); if (!s) return undefined; return /^\d{1,5}$/.test(s) ? Number(s) : null; },
  num(v) { const s = str(v).replace(/[,\s]/g, ''); if (!s) return undefined; return /^\d{1,10}$/.test(s) ? Number(s) : null; },
  ip(v) { const s = str(v).replace(/\s/g, ''); if (!s) return undefined; const n = PK.ipToInt(s); return n === null ? null : PK.intToIp(n); },
  mac(v) { const s = str(v); if (!s) return undefined; return PK.normMac(s); },
  /* Transaction IDs: "0x1a2b", "1a2b" (hex) or plain decimal digits; returns candidate values */
  id(v) {
    const s = str(v).replace(/\s/g, '').toLowerCase(); if (!s) return undefined;
    if (/^0x[0-9a-f]{1,8}$/.test(s)) return [parseInt(s.slice(2), 16)];
    if (/^[0-9a-f]{1,8}$/.test(s)) return /^\d+$/.test(s) ? [Number(s), parseInt(s, 16)] : [parseInt(s, 16)];
    return null;
  },
  sel(v, allowed) { const s = str(v).toLowerCase(); if (!s) return undefined; return allowed.includes(s) ? s : null; }
};
const FORMAT = { frame: 'ใส่หมายเลขแพ็กเก็ต เช่น 7', num: 'ใส่เป็นตัวเลข เช่น 80', ip: 'เช่น 192.168.1.10', mac: 'เช่น aa:bb:cc:dd:ee:ff', id: 'เช่น 0x1a2b', sel: 'เลือกจากรายการ' };

function getAnswers(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  let size = 0;
  try { size = JSON.stringify(payload).length; } catch (e) { return null; }
  if (size > 20000) return 'big';
  const a = payload.answers;
  return a && typeof a === 'object' && !Array.isArray(a) ? a : null;
}
const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

/* field-by-field grading: spec = [{ key, label, type, want, allowed?, mistakes(got) -> message | null, why }] */
function gradeFields(answers, spec, opt) {
  const fields = {}, feedback = [];
  let correct = 0, empty = 0;
  for (const f of spec) {
    const raw = has(answers, f.key) ? answers[f.key] : undefined;
    const got = f.type === 'sel' ? parse.sel(raw, f.allowed) : parse[f.type](raw);
    let ok = false;
    if (got === undefined) { empty++; feedback.push('ยังไม่ได้ตอบ: ' + f.label); }
    else if (got === null) feedback.push(f.label + ': รูปแบบไม่ถูกต้อง (' + FORMAT[f.type] + ')');
    else {
      ok = f.type === 'id' ? got.includes(f.want) : got === f.want;
      if (ok) correct++;
      else {
        const g = f.type === 'id' ? got[got.length - 1] : got;
        const m = f.mistakes ? f.mistakes(g, got) : null;
        feedback.push(f.label + ' ไม่ถูกต้อง — ' + (m || f.why));
      }
    }
    fields[f.key] = ok;
  }
  const total = spec.length;
  let score = correct === total ? MAX : Math.min(MAX - 1, Math.round(MAX * correct / total));
  if (empty === total) { score = 0; feedback.unshift('ยังไม่ได้ตอบเลย'); }
  else if (correct === total) feedback.unshift((opt && opt.perfect) || 'ถูกต้องทุกช่อง เยี่ยมมาก!');
  else feedback.unshift(`ถูก ${correct} จาก ${total} ข้อ ดูคำอธิบายข้อที่ผิดด้านล่าง`);
  return { score, max: MAX, ok: score === MAX, feedback, details: { fields, correct, total } };
}

/* ------------------------------------------------------------------ p1 encapsulation */
const LAYERS = ['2', '3', '4', '7'];
function gradeP1(answers, b) {
  const F = b.facts, a = F.a, bb = F.b;
  const lay = (key, label, want, why) => ({ key, label, type: 'sel', allowed: LAYERS, want, why,
    mistakes: (g) => g === '7' && want === '4' ? 'TCP ไม่ใช่ข้อมูลของแอปพลิเคชัน มันคือส่วนหัวที่บอกพอร์ตและลำดับข้อมูล' : null });
  return gradeFields(answers, [
    lay('a_eth', `#${a} Ethernet II`, '2', 'header ที่มี MAC address ใช้ส่งเฟรมภายในวง LAN ทีละ hop อยู่ชั้นเดียวกับสวิตช์ (ชั้นล่างที่ติดกับ Physical)'),
    lay('a_ip', `#${a} IPv4`, '3', 'header ที่มี IP address ใช้หาเส้นทาง (routing) ข้ามเครือข่าย อยู่ชั้นเดียวกับ router'),
    lay('a_tcp', `#${a} TCP`, '4', 'header ที่มีหมายเลขพอร์ต, Seq/Ack ดูแลการส่งข้อมูลระหว่างโปรแกรมต้นทาง-ปลายทาง (end-to-end)'),
    lay('a_http', `#${a} HTTP`, '7', 'HTTP คือข้อความของโปรแกรมเว็บเบราว์เซอร์/เว็บเซิร์ฟเวอร์เอง อยู่ชั้นบนสุด'),
    { key: 'a_smac', label: `#${a} Source MAC`, type: 'mac', want: F.a_smac, why: 'เปิดหัวข้อ Ethernet II ของแพ็กเก็ตนี้ แล้วดูบรรทัด Source',
      mistakes: (g) => g === F.a_dmac ? 'นั่นคือ Destination MAC (MAC ของ gateway) Source คือ MAC ของเครื่องที่ส่งเฟรมนี้ออกมา' : null },
    { key: 'a_dip', label: `#${a} Destination IP`, type: 'ip', want: F.a_dip, why: 'เปิดหัวข้อ Internet Protocol Version 4 แล้วดู Destination Address',
      mistakes: (g) => g === F.a_sip ? 'นั่นคือ Source IP (เครื่อง PC) ปลายทางคือเว็บเซิร์ฟเวอร์' : g === b.env.gw ? 'นั่นคือ IP ของ gateway: IP ปลายทางเป็นเครื่องปลายทางจริง ส่วน gateway ปรากฏแค่ใน MAC' : g === b.env.dns ? 'นั่นคือ IP ของ DNS server ดูแพ็กเก็ต HTTP GET' : null },
    { key: 'a_dport', label: `#${a} Destination port`, type: 'num', want: F.a_dport, why: 'เปิดหัวข้อ Transmission Control Protocol แล้วดู Destination Port',
      mistakes: (g) => g === 53 ? 'พอร์ต 53 คือ DNS แพ็กเก็ตนี้เป็น HTTP' : g > 1023 ? 'นั่นน่าจะเป็นพอร์ตฝั่ง client (ephemeral port) ปลายทางคือพอร์ตของบริการเว็บ' : null },
    { key: 'b_l4', label: `#${bb} Transport protocol`, type: 'sel', allowed: ['udp', 'tcp'], want: 'udp', why: 'ดูหัวข้อที่อยู่ถัดจาก IPv4 ในแพ็กเก็ต DNS query: DNS query ทั่วไปไม่ต้องจับมือก่อนส่ง' },
    { key: 'b_sport', label: `#${bb} Source port`, type: 'num', want: F.b_sport, why: 'เปิดหัวข้อ User Datagram Protocol ของ DNS query แล้วดู Source Port',
      mistakes: (g) => g === 53 ? '53 คือ Destination port (พอร์ตของ DNS server) Source port ของ client เป็นพอร์ตสุ่ม' : null },
    { key: 'b_dmac', label: `#${bb} Destination MAC`, type: 'mac', want: F.b_dmac, why: 'เปิด Ethernet II ของ DNS query: DNS server อยู่นอกวง LAN เฟรมจึงต้องส่งไปที่ next hop',
      mistakes: (g) => g === F.b_smac ? 'นั่นคือ Source MAC (เครื่อง PC เอง)' : g === 'ff:ff:ff:ff:ff:ff' ? 'DNS query เป็น unicast ไม่ใช่ broadcast' : null }
  ], { perfect: 'ถูกต้องทุกข้อ! เห็นแล้วว่าแต่ละ header อยู่ชั้นใด และ MAC ปลายทางเป็นของ gateway (hop ถัดไป) ส่วน IP ปลายทางเป็นเครื่องปลายทางจริง' });
}

/* ------------------------------------------------------------------ p2 handshake */
function gradeP2(answers, b) {
  const F = b.facts, O = F.other;
  const other = (g, name) => g === O.syn || g === O.synack || g === O.ack ? `แพ็กเก็ตนี้เป็นของการเชื่อมต่อไปยังพอร์ต 443 (อีกเว็บหนึ่ง) ไม่ใช่การเชื่อมต่อที่โจทย์ถาม` : null;
  return gradeFields(answers, [
    { key: 'syn', label: 'แพ็กเก็ต SYN', type: 'frame', want: F.syn, why: 'SYN คือแพ็กเก็ตแรกจาก client ที่ตั้งบิต SYN อย่างเดียว (ยังไม่มี ACK)',
      mistakes: (g) => other(g) || (g === F.synack ? 'นั่นคือ SYN-ACK (ตอบกลับจาก server)' : null) },
    { key: 'synack', label: 'แพ็กเก็ต SYN-ACK', type: 'frame', want: F.synack, why: 'SYN-ACK ส่งจาก server และตั้งทั้งบิต SYN และ ACK',
      mistakes: (g) => other(g) || (g === F.syn ? 'นั่นคือ SYN จาก client' : g === F.ack ? 'นั่นคือ ACK ขั้นที่ 3' : null) },
    { key: 'ack', label: 'แพ็กเก็ต ACK ขั้นที่ 3', type: 'frame', want: F.ack, why: 'ACK ขั้นที่ 3 ส่งจาก client ตั้งบิต ACK อย่างเดียวและไม่มีข้อมูล (Len=0) ก่อน HTTP GET',
      mistakes: (g) => other(g) || (g === F.get ? 'นั่นคือ HTTP GET (มีข้อมูล) ซึ่งมาหลังจาก handshake ครบแล้ว' : null) },
    { key: 'cport', label: 'Client port', type: 'num', want: F.cport, why: 'ดู Source Port ของแพ็กเก็ต SYN',
      mistakes: (g) => g === F.sport ? 'นั่นคือพอร์ตของ server (สลับกัน)' : g === O.cport ? 'นั่นคือพอร์ตของการเชื่อมต่ออีกอัน (ไปพอร์ต 443)' : null },
    { key: 'sport', label: 'Server port', type: 'num', want: F.sport, why: 'ดู Destination Port ของแพ็กเก็ต SYN',
      mistakes: (g) => g === F.cport ? 'นั่นคือพอร์ตของ client (สลับกัน)' : g === 443 ? 'พอร์ต 443 เป็นของอีกการเชื่อมต่อ ดู URL ในโจทย์' : null },
    { key: 'ack3', label: 'Acknowledgment number (raw) ขั้นที่ 3', type: 'num', want: F.ack3, why: 'ACK = Sequence number (raw) ของ SYN-ACK + 1',
      mistakes: (g) => g === 1 ? 'ค่า 1 คือ relative ack number โจทย์ถามค่า raw (บรรทัด Acknowledgment number (raw))'
        : g === F.isnS ? 'เกือบถูก! ลืม +1: บิต SYN นับเป็นข้อมูล 1 ไบต์ จึงต้องตอบรับ Seq ของ SYN-ACK + 1'
          : g === ((F.isnC + 1) >>> 0) ? 'นั่นคือค่าของฝั่ง client (Seq ถัดไปของ PC) ACK ของ client ต้องอ้างถึง Seq ของ server' : null },
    { key: 'nextack', label: 'ACK (raw) ที่ server จะตอบหลังได้รับ GET', type: 'num', want: F.nextack, why: 'ACK ถัดไป = Sequence number (raw) ของ HTTP GET + TCP Segment Len ของ GET',
      mistakes: (g) => g === F.getLen + 1 ? 'นั่นคือค่า relative โจทย์ถามค่า raw: ใช้ Sequence number (raw) ของ GET + Len'
        : g === ((F.isnC + 1) >>> 0) ? 'นั่นคือ Seq ของ GET เอง ยังไม่ได้บวกจำนวนไบต์ข้อมูล (Len)'
          : g === ((F.nextack + 1) >>> 0) ? 'บวกเกินมา 1: +1 ใช้เฉพาะตอนมีบิต SYN หรือ FIN ข้อมูล HTTP นับตาม Len เท่านั้น'
            : g === ((F.ack3 + F.getLen) >>> 0) ? 'ใช้ Seq ของฝั่ง server ผิดฝั่ง ต้องใช้ Seq ของ client (ผู้ส่ง GET)' : null }
  ], { perfect: 'ถูกต้องทุกข้อ! เข้าใจทั้งลำดับ SYN → SYN-ACK → ACK และการคำนวณ ACK = Seq + Len' });
}

/* ------------------------------------------------------------------ p3 DNS */
function gradeP3(answers, b) {
  const F = b.facts, cap = b.capture;
  const dnsPk = cap.filter((p) => p.dns);
  const otherQ = dnsPk.filter((p) => !p.dns.qr && p.dns.qname !== F.name).map((p) => p.no);
  const otherR = dnsPk.filter((p) => p.dns.qr && p.dns.qname !== F.name).map((p) => p.no);
  const otherIds = dnsPk.filter((p) => p.dns.qname !== F.name).map((p) => p.dns.id);
  const otherIps = dnsPk.filter((p) => p.dns.qr && p.dns.qname !== F.name).map((p) => p.dns.answers[0] && p.dns.answers[0].addr);
  return gradeFields(answers, [
    { key: 'q', label: 'DNS query', type: 'frame', want: F.q, why: 'query คือแพ็กเก็ตจาก PC ไปยัง DNS server ที่ถามชื่อนี้ (Info: Standard query ...)',
      mistakes: (g) => g === F.r ? 'นั่นคือ response (สลับกัน)' : otherQ.includes(g) ? 'นั่นคือ query ของชื่ออื่น ดูชื่อในส่วน Queries' : null },
    { key: 'r', label: 'DNS response', type: 'frame', want: F.r, why: 'response ที่ตอบ query นี้มี Transaction ID ตรงกับ query',
      mistakes: (g) => g === F.q ? 'นั่นคือ query (สลับกัน)' : otherR.includes(g) ? 'นั่นคือ response ของชื่ออื่น (Transaction ID ไม่ตรงกับ query)' : null },
    { key: 'id', label: 'Transaction ID', type: 'id', want: F.id, why: 'ดูบรรทัด Transaction ID ในหัวข้อ Domain Name System',
      mistakes: (g) => otherIds.includes(g) ? 'นั่นคือ Transaction ID ของชื่ออื่น' : null },
    { key: 'addr', label: 'IP ที่ได้ (record A)', type: 'ip', want: F.addr, why: 'ดูส่วน Answers ของ response: บรรทัด Address',
      mistakes: (g) => g === F.dnsIp ? 'นั่นคือ IP ของ DNS server (ผู้ตอบ) ไม่ใช่คำตอบ' : otherIps.includes(g) ? 'นั่นคือ IP ของชื่ออื่น' : g === b.env.pc ? 'นั่นคือ IP ของเครื่อง PC' : null },
    { key: 'l4', label: 'Transport protocol', type: 'sel', allowed: ['udp', 'tcp'], want: 'udp', why: 'ดูหัวข้อที่อยู่ระหว่าง IPv4 กับ Domain Name System (DNS query ทั่วไปใช้ UDP เพราะสั้นและไม่ต้องจับมือ)' },
    { key: 'port', label: 'พอร์ตของ DNS server', type: 'num', want: F.port, why: 'ดู Destination Port ของ query (หรือ Source Port ของ response)',
      mistakes: (g) => g === F.cport ? 'นั่นคือพอร์ตของ client (ephemeral port)' : null }
  ], { perfect: 'ถูกต้องทุกข้อ! DNS ใช้ UDP พอร์ต 53 และจับคู่ query/response ด้วย Transaction ID' });
}

/* ------------------------------------------------------------------ p4 DHCP */
function gradeP4(answers, b) {
  const F = b.facts, cap = b.capture;
  const otherDhcp = cap.filter((p) => p.dhcp && p.dhcp.xid !== F.xid).map((p) => p.no);
  const mine = (n) => { const p = cap[n - 1]; return p && p.dhcp && p.dhcp.xid === F.xid ? p.dhcp.type : null; };
  const TH = { 1: 'Discover', 2: 'Offer', 3: 'Request', 5: 'ACK' };
  const fr = (key, label, want, why) => ({ key, label, type: 'frame', want, why,
    mistakes: (g) => otherDhcp.includes(g) ? 'นั่นคือข้อความของอีกเครื่อง (Transaction ID / Client MAC address ไม่ตรง)' : mine(g) ? `นั่นคือ DHCP ${TH[mine(g)]} ดู Option (53) DHCP Message Type` : null });
  return gradeFields(answers, [
    fr('d', 'DHCP Discover', F.d, 'Discover คือข้อความแรกจาก client (0.0.0.0 → 255.255.255.255) เพื่อค้นหา DHCP server'),
    fr('o', 'DHCP Offer', F.o, 'Offer คือข้อความจาก server ที่เสนอ IP ให้'),
    fr('r', 'DHCP Request', F.r, 'Request คือข้อความจาก client ที่ขอใช้ IP ที่ได้รับการเสนอ'),
    fr('a', 'DHCP ACK', F.a, 'ACK คือข้อความยืนยันจาก server เป็นข้อความสุดท้าย'),
    { key: 'yiaddr', label: 'IP ที่ได้รับ', type: 'ip', want: F.yiaddr, why: 'ดูช่อง Your (client) IP address ใน Offer หรือ ACK',
      mistakes: (g) => g === F.server ? 'นั่นคือ IP ของ DHCP server' : g === F.otherIp ? 'นั่นคือ IP ที่อีกเครื่องได้รับ' : g === '0.0.0.0' || g === '255.255.255.255' ? 'นั่นคือ address ที่ใช้ตอนยังไม่มี IP / broadcast' : g === F.mask ? 'นั่นคือ subnet mask' : null },
    { key: 'server', label: 'DHCP server', type: 'ip', want: F.server, why: 'ดู Option (54) DHCP Server Identifier',
      mistakes: (g) => g === F.yiaddr ? 'นั่นคือ IP ที่ client ได้รับ' : g === '255.255.255.255' ? 'นั่นคือ broadcast address' : null },
    { key: 'lease', label: 'Lease time', type: 'num', want: F.lease, why: 'ดู Option (51) IP Address Lease Time (หน่วยวินาที)',
      mistakes: (g) => g === Math.floor(F.lease / 2) ? 'นั่นคือ Renewal Time (T1 = ครึ่งหนึ่งของ lease)' : g === Math.floor(F.lease * 7 / 8) ? 'นั่นคือ Rebinding Time (T2)' : (g * 3600 === F.lease || g * 86400 === F.lease) ? 'ตอบเป็นหน่วยวินาที' : null },
    { key: 'xid', label: 'Transaction ID', type: 'id', want: F.xid, why: 'ดูบรรทัด Transaction ID ในหัวข้อ Dynamic Host Configuration Protocol',
      mistakes: (g) => g === F.otherXid ? 'นั่นคือ Transaction ID ของอีกเครื่อง' : null }
  ], { perfect: 'ถูกต้องทุกข้อ! Discover → Offer → Request → ACK ใช้ Transaction ID เดียวกัน' });
}

/* ------------------------------------------------------------------ p5 web fails */
const CONC = { dns: 'DNS ล้มเหลว', closed: 'พอร์ตปิด (RST)', filtered: 'ถูก firewall กรอง' };
function parseFrames(v) {
  if (Array.isArray(v)) v = v.slice(0, 41).join(',');
  const s = str(v);
  if (!s) return [];
  const parts = s.split(/[\s,;]+/).filter(Boolean);
  if (parts.length > 40) return null;
  const out = [];
  for (const x of parts) { const m = /^#?(\d{1,5})$/.exec(x); if (!m) return null; out.push(Number(m[1])); }
  return Array.from(new Set(out)).sort((a, b) => a - b);
}
function gradeP5(answers, b) {
  const F = b.facts, truth = F.conclusion;
  const got = parse.sel(answers.conclusion, ['dns', 'closed', 'filtered']);
  const ev = parseFrames(answers.evidence);
  if (got === undefined && ev && !ev.length) return zero('ยังไม่ได้ตอบเลย: เลือกสาเหตุและใส่หมายเลขแพ็กเก็ตที่เป็นหลักฐาน');
  const feedback = [];
  let score = 0, conclusionOk = false;
  if (got === undefined) feedback.push('ยังไม่ได้เลือกสาเหตุ');
  else if (got === null) feedback.push('สาเหตุที่เลือกไม่อยู่ในรายการ');
  else if (got === truth) { score += 6; conclusionOk = true; feedback.push(`ข้อสรุปถูกต้อง: ${CONC[truth]} (6/6)`); }
  else {
    // describe what the CHOSEN conclusion would look like in a capture, never the real cause (Phase 6 leak fix)
    const why = {
      dns: 'ถ้าเป็นปัญหา DNS จะไม่มี IP ของเว็บกลับมาใน DNS response (Reply code เป็น No such name หรือ query ไม่มี response) ตรวจส่วน Answers อีกครั้ง',
      closed: 'ถ้าพอร์ตปิด เว็บเซิร์ฟเวอร์จะตอบ SYN ด้วย RST, ACK ทันที ตรวจว่ามีแพ็กเก็ตแบบนั้นจริงหรือไม่',
      filtered: 'ถ้าถูก firewall กรอง SYN จะไม่ได้คำตอบเลย (ถูกส่งซ้ำ) หรือได้ ICMP Destination unreachable (administratively filtered) ตรวจว่ามีแพ็กเก็ตแบบนั้นจริงหรือไม่'
    }[got];
    feedback.push(`ข้อสรุป "${CONC[got]}" ยังไม่ถูก — ${why} (0/6)`);
  }
  let evPts = 0;
  if (ev === null) feedback.push('หลักฐาน: รูปแบบไม่ถูกต้อง ใส่หมายเลขแพ็กเก็ตคั่นด้วย , เช่น 12, 15 (ไม่เกิน 40 หมายเลข)');
  else if (!ev.length) feedback.push('ยังไม่ได้อ้างหลักฐาน (หมายเลขแพ็กเก็ต) (0/4)');
  else {
    const key = new Set(F.key), allowed = new Set(F.allowed);
    const hits = ev.filter((n) => key.has(n)).length, need = F.need || 1;
    const extra = ev.filter((n) => !allowed.has(n));
    const keyPts = hits >= need ? 3 : hits > 0 ? 1 : 0;
    const cleanPts = extra.length === 0 ? 1 : 0;
    evPts = keyPts + cleanPts;
    const what = { 'dns-nx': 'DNS response ที่ Reply code เป็น No such name', 'dns-timeout': 'DNS query ที่ถูกส่งซ้ำโดยไม่มี response (อย่างน้อย 2 แพ็กเก็ต)',
      closed: 'แพ็กเก็ต RST, ACK ที่ตอบกลับ SYN', filtered: 'SYN ที่ถูกส่งซ้ำ (TCP Retransmission) โดยไม่มีคำตอบ (อย่างน้อย 2 แพ็กเก็ต)',
      'filtered-icmp': 'ICMP Destination unreachable (administratively filtered) ที่ตอบกลับ SYN' }[F.variant];
    // the kind of evidence packet is named only once the conclusion is right (it would give the cause away otherwise)
    if (keyPts === 3) feedback.push('หลักฐานยืนยันข้อสรุปได้ตรง');
    else if (keyPts === 1) feedback.push(conclusionOk ? `หลักฐานยังไม่พอ: แพ็กเก็ตเดียวยืนยันไม่ได้ ต้องอ้าง${what}` : 'หลักฐานยังไม่พอ: แพ็กเก็ตเดียวยืนยันไม่ได้ ต้องอ้างแพ็กเก็ตที่แสดงอาการซ้ำอย่างน้อย 2 แพ็กเก็ต');
    else feedback.push(conclusionOk ? `หลักฐานยังไม่ตรง: แพ็กเก็ตที่ยืนยันสาเหตุจริงคือ${what}` : 'หลักฐานยังไม่ตรง: เลือกแพ็กเก็ตที่แสดงจุดที่การเปิดเว็บล้มเหลวโดยตรง');
    if (extra.length) feedback.push(`แพ็กเก็ต #${extra.slice(0, 6).join(', #')} ไม่เกี่ยวกับการเปิดเว็บนี้ (เช่น ARP, ping, NTP หรือไม่มีหมายเลขนี้) อย่าใส่เป็นหลักฐาน`);
    feedback.push(`คะแนนหลักฐาน ${evPts}/4`);
  }
  score += evPts;
  if (score === MAX) feedback.unshift('ยอดเยี่ยม! สรุปสาเหตุถูกต้องและอ้างหลักฐานได้ตรงประเด็น');
  else feedback.unshift(`ได้ ${score}/${MAX}: ข้อสรุป ${conclusionOk ? 6 : 0}/6, หลักฐาน ${evPts}/4`);
  return { score, max: MAX, ok: score === MAX, feedback, details: { fields: { conclusion: conclusionOk, evidence: evPts === 4 }, conclusion: conclusionOk, evidence: evPts } };
}

/* ------------------------------------------------------------------ p6 filter challenge */
const REF = {
  dns: () => 'dns', icmp: () => 'icmp', rst: () => 'tcp.flags.reset == 1', http: () => 'http', dhcp: () => 'dhcp',
  synall: () => 'tcp.flags.syn == 1', synonly: () => 'tcp.flags.syn == 1 && tcp.flags.ack == 0',
  host: (t) => 'ip.addr == ' + t.ip, udpnodns: () => 'udp && !dns', notarp: () => '!arp', tcpport: (t) => 'tcp.port == ' + t.port,
  pcweb: (t) => 'ip.src == ' + t.ip + ' && tcp.dstport == 80', echoreq: () => 'icmp.type == 8',
  frames: (t) => 'frame.number == ' + t.a + ' || frame.number == ' + t.b, todns: (t) => 'udp && ip.dst == ' + t.ip
};
function expectedSet(b, task) { const r = PK.runFilter(b.capture, REF[task.kind](task)); return r.ok ? r.set : null; }
function gradeP6(answers, b) {
  const feedback = [], fields = {};
  let score = 0, answered = 0;
  const per = MAX / b.tasks.length;
  b.tasks.forEach((task, i) => {
    const key = 'f' + i, raw = has(answers, key) ? answers[key] : undefined;
    const text = typeof raw === 'string' ? raw : '';
    const tag = `ข้อ ${i + 1}`;
    fields[key] = false;
    if (!text.trim()) { feedback.push(`${tag}: ยังไม่ได้เขียนตัวกรอง`); return; }
    answered++;
    if (text.length > 300) { feedback.push(`${tag}: ตัวกรองยาวเกินไป (ไม่เกิน 300 ตัวอักษร)`); return; }
    const want = expectedSet(b, task);
    const r = PK.runFilter(b.capture, text);
    if (!r.ok) { feedback.push(`${tag}: ตัวกรองผิดรูปแบบ — ${r.error}`); return; }
    const got = r.set, W = new Set(want), G = new Set(got);
    const missing = want.filter((n) => !G.has(n)), extra = got.filter((n) => !W.has(n));
    if (!missing.length && !extra.length) { score += per; fields[key] = true; feedback.push(`${tag}: ถูกต้อง (ได้ ${got.length} แพ็กเก็ตตรงตามโจทย์)`); return; }
    const proto = (n) => { const p = b.capture[n - 1]; return p ? p.proto : '?'; };
    const desc = [];
    if (missing.length) desc.push(`ขาด ${missing.length} แพ็กเก็ต (เช่น #${missing[0]} ที่เป็น ${proto(missing[0])})`);
    if (extra.length) desc.push(`เกิน ${extra.length} แพ็กเก็ต (เช่น #${extra[0]} ที่เป็น ${proto(extra[0])})`);
    const near = got.length > 0 && (!missing.length || !extra.length) && missing.length + extra.length <= Math.max(2, Math.ceil(want.length / 2));
    if (near) score += per / 2;
    feedback.push(`${tag}: ได้ ${got.length} แพ็กเก็ต ` + desc.join(' และ ') + (near ? ' — ใกล้แล้ว (ได้ครึ่งคะแนน)' : ''));
  });
  if (!answered) return zero('ยังไม่ได้เขียนตัวกรองเลย');
  score = Math.round(score * 2) / 2;
  if (score === MAX) feedback.unshift('ถูกต้องทุกข้อ! ใช้ display filter ได้คล่องแล้ว');
  else feedback.unshift(`ได้ ${score}/${MAX} (ข้อละ ${per} คะแนน ถูกบางส่วนได้ครึ่งหนึ่ง)`);
  return { score, max: MAX, ok: score === MAX, feedback, details: { fields } };
}

/* ------------------------------------------------------------------ API */
function generate(missionId, rand) {
  if (!missions.some((m) => m.id === missionId)) return null;
  if (typeof rand !== 'function') rand = Math.random;
  let seed = '';
  for (let i = 0; i < 16; i++) seed += Math.floor(rand() * 16).toString(16);
  return { v: 1, mission: missionId, seed };
}

function grade(missionId, payload, problem) {
  try {
    if (!missions.some((m) => m.id === missionId)) return zero('ไม่พบภารกิจนี้');
    if (!problem || typeof problem !== 'object' || problem.mission !== missionId) return zero(BAD_PROBLEM);
    const b = buildGraded(problem);
    if (!b) return zero(BAD_PROBLEM);
    const answers = getAnswers(payload);
    if (answers === 'big') return zero('ข้อมูลที่ส่งมาใหญ่เกินไป');
    if (!answers) return zero('ไม่พบคำตอบที่ส่งมา กรุณากรอกคำตอบแล้วกด "ตรวจคำตอบ"');
    const fn = { p1: gradeP1, p2: gradeP2, p3: gradeP3, p4: gradeP4, p5: gradeP5, p6: gradeP6 }[missionId];
    return fn(answers, b);
  } catch (e) {
    return zero('ตรวจคำตอบไม่ได้ (ข้อมูลไม่ถูกต้อง)');
  }
}

module.exports = {
  id: 'packets',
  title: 'ห้องวิเคราะห์แพ็กเก็ต (Packet Analysis)',
  missions,
  generate,
  grade,
  // exported for tests/tools only
  _lib: PK, _ref: REF, _build: buildGraded, _expectedSet: expectedSet, _parseFrames: parseFrames
};

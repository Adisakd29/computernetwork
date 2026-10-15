'use strict';
/*
 * Wi-Fi Planning Lab "วางแผน Wi-Fi" - server grader (NetLab).
 * The engine lives in public/js/sim/wifi.js (UMD; under Node it exports only the engine WF), so the browser and this
 * grader compute RSSI, coverage and interference with the same code. grade() never trusts client numbers: it rebuilds
 * the AP list from the mission's trusted start + whitelisted fields of the submission (WF.applyConfig) and recomputes.
 *
 * Payloads
 *   wf1-wf5: { aps: [{ id, x, y, band:'2.4'|'5', ch, width, tx, name? }], answers?: {...}, report?: string }
 *   wf4 is generated: problem { v:1, mission:'wf4', floor, target, minWidth, dfs, budget } (signed by sims-api)
 *   wf6:     { sec: { staff:{ssid,sec,pass,hidden}, guest:{on,ssid,sec,pass,isolation,lan,hidden}, wps, adminPass, remote } }
 * Pure, no I/O, never throws.
 */
const WF = require('../../public/js/sim/wifi.js');

const MAX = 10;
const isObj = x => !!x && typeof x === 'object' && !Array.isArray(x);
const r1 = x => Math.round(x * 10) / 10;
const tooBig = (p, n) => { try { return JSON.stringify(p === undefined ? null : p).length > n; } catch (e) { return true; } };
const zero = (msg, max) => ({ score: 0, max: max || MAX, ok: false, feedback: [msg], details: { error: true } });
function done(score, max, feedback, details, good, extra) {
  score = Math.max(0, Math.min(max, r1(score)));
  if (score >= max) feedback.unshift(good);
  else feedback.unshift(`ได้ ${score} จาก ${max} คะแนน ดูรายละเอียดด้านล่างแล้วปรับแก้`);
  return Object.assign({ score, max, ok: score >= max, feedback, details }, extra || {});
}
const AP = (id, name, x, y, band, ch, width, tx) => ({ id, name, x, y, band, ch, width, tx });
const nameOf = (aps, id) => { const a = aps.find(x => x.id === id); return a ? a.name : id; };

/* ============================================================== missions */
const NEIGHBOURS_CAFE = [
  AP('n1', 'ร้านซ้าย 2.4', 2.5, 4.5, '2.4', 1, 20, 17), AP('n2', 'ร้านขวา 2.4', 27.5, 5.5, '2.4', 6, 20, 17),
  AP('n3', 'ศูนย์การค้า 2.4', 15.5, 14.5, '2.4', 11, 20, 17),
  AP('n4', 'ร้านซ้าย 5G', 2.5, 9.5, '5', 36, 80, 17), AP('n5', 'ร้านขวา 5G', 27.5, 9.5, '5', 149, 40, 17)
];
const CAFE_CLIENTS = 48, CLIENTS_PER_AP = 30;
const WF5_CAUSES = [
  { id: 'overlap', th: 'AP-1, AP-2 และ AP-3 ใช้ช่อง 1, 3 และ 6: ช่อง 1 กับ 6 ไม่เหลื่อมกัน แต่ช่อง 3 ห่างจากทั้งช่อง 1 และช่อง 6 ไม่ถึง 5 ช่อง สัญญาณของ AP ช่อง 3 จึงเหลื่อมกับทั้งสองตัว (adjacent-channel interference)' },
  { id: 'power', th: 'AP-1 กับ AP-4 ใช้ช่องเดียวกันและตั้งกำลังส่งสูงเกินไป จนได้ยินกันและรบกวนกัน (co-channel interference)' },
  { id: 'elevator', th: 'AP-4 ติดตั้งหลังปล่องลิฟต์ซึ่งเป็นโลหะ สัญญาณไปไม่ถึงฝ่ายบริการลูกค้าและปลายทางเดิน' },
  { id: 'few', th: 'จำนวน AP ไม่พอสำหรับพื้นที่นี้ ต้องซื้อ AP เพิ่มเท่านั้นจึงแก้ได้' },
  { id: 'ssid', th: 'AP แต่ละตัวตั้ง SSID ไม่ตรงกัน เครื่องจึงโรมมิ่งไม่ได้' },
  { id: 'band', th: 'ย่าน 2.4 GHz ทะลุผนังไม่ได้ จึงต้องเปลี่ยนเป็น 5 GHz ทั้งหมด' }
];
const WF5_TRUE = ['overlap', 'elevator'];
const SEC_MODES = ['open', 'wep', 'wpa', 'wpa2-tkip', 'wpa2', 'mixed', 'wpa3'];
const CAFE_SHOP = { name: 'Kafe Dee', phone: '0812345678' };
const WF3_Q = {
  band: { q: 'ทำไมร้านนี้ไม่ควรใช้ย่าน 2.4 GHz', options: [
    { id: 'a', th: '2.4 GHz ทะลุกระจกหน้าร้านไม่ได้' },
    { id: 'b', th: 'ช่องที่ไม่เหลื่อมกันมีเพียง 1, 6, 11 และ AP ข้างเคียงใช้ครบทั้งสามช่องโดยได้ยินแรงกว่า -82 dBm ทุกจุดในร้าน' },
    { id: 'c', th: 'มือถือรุ่นใหม่ไม่รองรับ 2.4 GHz แล้ว' },
    { id: 'd', th: '2.4 GHz ตั้งรหัสผ่าน WPA2 ไม่ได้' }] },
  width: { q: 'ทำไมร้านนี้จึงไม่ใช้ช่องกว้าง 80 MHz', options: [
    { id: 'a', th: 'ช่อง 80 MHz ส่งได้ระยะสั้นกว่าจึงไม่ครอบคลุม' },
    { id: 'b', th: 'ช่อง 80 MHz ใช้ได้เฉพาะ 2.4 GHz' },
    { id: 'c', th: '80 MHz ต้องรวม 4 ช่องย่อย บล็อกที่ไม่ใช่ DFS (36–48 และ 149–161) ทับกับ AP ข้างเคียงทั้งคู่ ส่วนช่องที่เหลือพอสำหรับ 20/40 MHz เท่านั้น' },
    { id: 'd', th: 'ยิ่งช่องแคบ สัญญาณยิ่งแรงขึ้นเป็นสองเท่า' }] }
};
const WF3_A = { band: 'b', width: 'c' };

const missions = [
  { id: 'wf1', level: 'easy', mode: 'guided', week: 6, max: MAX, title: 'จัดช่องสัญญาณ 2.4 GHz ให้ AP ในทางเดิน',
    desc: 'ฝึกตามขั้นตอน (Guided Lab) สัปดาห์ที่ 6: ทางเดินชั้น 2 ของอาคารเรียนมี Access Point 3 ตัวติดตั้งอยู่แล้ว (ตำแหน่งและกำลังส่งล็อกไว้) ทุกตัวใช้ย่าน 2.4 GHz ช่องกว้าง 20 MHz ' +
      'และได้ยินกันเองแรงกว่า -82 dBm ให้เลือกช่องสัญญาณ (channel) ของแต่ละตัวไม่ให้มีคู่ใดเหลื่อมกัน แล้วส่งตรวจ',
    hints: ['ขั้นที่ 1: แตะ AP แต่ละตัวในแผนผัง แล้วดูรายการ "การรบกวนระหว่าง AP" ว่าตอนนี้คู่ไหนเหลื่อมกันและได้ยินกันแรงเท่าไร',
      'ขั้นที่ 2: ความถี่กลางของช่อง 2.4 GHz ห่างกันช่องละ 5 MHz แต่สัญญาณกว้างราว 22 MHz (ตามสเปกตรัมของ 802.11b แบบ DSSS) จึงต้องห่างกันอย่างน้อย 5 ช่อง (25 MHz) ถ้าห่างกันน้อยกว่านั้นจะเหลื่อมกัน',
      'ขั้นที่ 3: ชุดช่องที่ไม่เหลื่อมกันที่นิยมใช้คือ 1, 6 และ 11 (ประเทศไทยใช้ช่อง 1–13 ได้)',
      'ขั้นที่ 4: AP ที่อยู่ติดกันต้องคนละช่องในชุดนั้น ดูให้รายการการรบกวนเหลือ 0 คู่ก่อนส่ง'],
    start: { kind: 'channels', floor: 'corridor', target: null,
      aps: [AP('ap1', 'AP-1', 7.5, 7.5, '2.4', 6, 20, 17), AP('ap2', 'AP-2', 21.5, 7.5, '2.4', 6, 20, 17), AP('ap3', 'AP-3', 35.5, 7.5, '2.4', 9, 20, 17)],
      rules: { lockPos: true, lockBand: true, lockTx: true, lockWidth: true, lockSet: true, maxAps: 3, minAps: 3, bands: ['2.4'] } } },
  { id: 'wf2', level: 'medium', mode: 'guided', week: 6, max: MAX, title: 'วาง AP 2 ตัวในอาคารแล็บผนังคอนกรีต',
    desc: 'ฝึกตามขั้นตอน (Guided Lab) สัปดาห์ที่ 6: อาคารปฏิบัติการมีแล็บคอมพิวเตอร์ 2 ห้อง กั้นด้วยผนังคอนกรีต นักเรียนทุกคนใช้ 5 GHz ดูวิดีโอการสอนและประชุมออนไลน์ ' +
      'จึงต้องการสัญญาณอย่างน้อย -67 dBm ให้วาง AP 2 ตัว (ย่าน 5 GHz) ให้พื้นที่แล็บทั้งสองห้องได้ -67 dBm ขึ้นไปอย่างน้อย 95% และสอง AP ต้องไม่รบกวนกัน ' +
      'ตอนนี้ช่างติดตั้ง AP ไว้ที่ทางเดินทั้งสองตัวและใช้ช่องเดียวกัน',
    hints: ['ขั้นที่ 1: เปิดแผนที่สัญญาณดูว่าตอนนี้ส่วนไหนของแล็บยังเป็นจุดที่มีเครื่องหมายจุด (ต่ำกว่าเป้า)',
      'ขั้นที่ 2: แตะจุดในห้องแล้วดูว่าสัญญาณผ่านผนังอะไรบ้าง ผนังคอนกรีตลดสัญญาณประมาณ 10–15 dB ต่อชั้นที่ผ่าน',
      'ขั้นที่ 3: ลาก AP เข้าไปไว้ในห้องที่ต้องการใช้งาน (ห้องละตัว) แทนการติดที่ทางเดิน',
      'ขั้นที่ 4: AP สองตัวยังได้ยินกันผ่านผนัง ตั้งช่อง 5 GHz คนละช่องที่ไม่ทับกัน เช่น 36 กับ 44'],
    start: { kind: 'place', floor: 'lab', target: -67,
      aps: [AP('ap1', 'AP-1', 8.5, 13.5, '5', 36, 20, 17), AP('ap2', 'AP-2', 24.5, 13.5, '5', 36, 20, 17)],
      rules: { lockBand: true, lockSet: true, maxAps: 2, minAps: 2, bands: ['5'] } } },
  { id: 'wf3', level: 'medium', mode: 'independent', week: 6, max: MAX, title: 'ร้านกาแฟคนแน่น: เลือกย่านและความกว้างช่อง',
    desc: 'ฝึกเอง (Independent Lab) สัปดาห์ที่ 6: ร้านกาแฟในศูนย์การค้ามีลูกค้าใช้ Wi-Fi พร้อมกันประมาณ 48 เครื่อง (ประชุมวิดีโอ ต้องการ -67 dBm) ร้านข้างเคียงและศูนย์การค้ามี AP ของตัวเองอยู่แล้ว (แก้ไขไม่ได้) ' +
      'เจ้าของร้านขอไม่ใช้ช่อง DFS เพราะเมื่อ AP ตรวจพบเรดาร์ต้องย้ายช่องทันทีและลูกค้าหลุด วาง AP ของร้านได้ไม่เกิน 3 ตัว เลือกย่านความถี่ ช่อง และความกว้างช่อง ' +
      'ให้พื้นที่นั่งได้ -67 dBm อย่างน้อย 95% ไม่มี AP คู่ใดรบกวนกัน (รวม AP ข้างเคียง) และ AP แต่ละตัวรับลูกค้าไม่เกินประมาณ 30 เครื่อง จากนั้นตอบคำถามและเขียนเหตุผลจากผลที่ได้',
    hints: ['ลองตั้ง AP เป็น 2.4 GHz ทุกช่องก่อน แล้วดูรายการการรบกวนกับ AP ข้างเคียง',
      'ช่องที่ไม่ใช่ DFS ในย่าน 5 GHz คือ 36–48 และ 149–165 ดูว่า AP ข้างเคียงใช้บล็อกไหนไปแล้ว',
      'ช่องกว้างขึ้นเร็วขึ้นต่อเครื่อง แต่กินช่องย่อยมากขึ้น ในที่คนแน่นช่องแคบ (20/40 MHz) ทำให้วาง AP หลายตัวได้โดยไม่ทับกัน',
      'จำนวนลูกค้าต่อ AP ประมาณจากพื้นที่ที่ AP นั้นให้สัญญาณแรงที่สุด วาง AP ให้แบ่งพื้นที่กันใกล้เคียงกัน'],
    review: { teacher: [
      { id: 'reason', title: 'เหตุผลการเลือกย่าน ช่อง และความกว้างช่อง', max: 5, desc: 'อ้างอิงผลในแบบจำลอง เช่น ค่า RSSI ของ AP ข้างเคียง จำนวนช่องที่ว่าง และพื้นที่ครอบคลุม' },
      { id: 'capacity', title: 'การคิดเรื่องจำนวนผู้ใช้ต่อ AP', max: 3, desc: 'อธิบายว่าทำไมต้องใช้ AP มากกว่าหนึ่งตัวและแบ่งพื้นที่อย่างไร' }] },
    start: { kind: 'cafe', floor: 'cafe', target: -67, neighbours: NEIGHBOURS_CAFE, noDfs: true, clients: CAFE_CLIENTS, perAp: CLIENTS_PER_AP,
      questions: WF3_Q, report: true,
      aps: [AP('ap1', 'CAFE-1', 15.5, 6.5, '2.4', 1, 20, 17)],
      rules: { addRemove: true, maxAps: 3, minAps: 1 } } },
  { id: 'wf4', level: 'hard', mode: 'independent', week: 6, max: MAX, title: 'ออกแบบ Wi-Fi สำนักงานด้วย AP น้อยที่สุด',
    desc: 'ฝึกเอง (Independent Lab) สัปดาห์ที่ 6, โจทย์สุ่ม: ออกแบบ Wi-Fi ให้สำนักงานหนึ่งชั้น ใช้ AP ย่าน 5 GHz ไม่เกินจำนวนที่กำหนดในโจทย์ ' +
      'ให้พื้นที่ทำงานทุกห้องและทางเดินได้สัญญาณตามเป้าอย่างน้อย 95% ไม่มี AP คู่ใดรบกวนกัน (co-channel หรือช่องที่ bonding ทับกัน) และทำตามข้อกำหนดเรื่องความกว้างช่องและช่อง DFS ในโจทย์',
    hints: ['เริ่มจากวาง AP ห่างกันพอประมาณ แล้วดูแผนที่สัญญาณว่าจุดไหนยังต่ำกว่าเป้า',
      'ปล่องลิฟต์ (โลหะ) และแกนคอนกรีตกั้นสัญญาณมาก อย่าวาง AP ให้แกนนี้ขวางห้องที่ต้องการบริการ',
      'ถ้า AP ได้ยินกันแรงกว่า -82 dBm ต้องใช้ช่องที่ไม่ทับกัน หรือลดกำลังส่งเมื่อพื้นที่ยังได้ตามเป้า',
      'ช่อง 40 MHz ที่ไม่ทับกันมี 36–40, 44–48, 149–153, 157–161 และถ้าใช้ DFS ได้จะมีเพิ่มอีกหลายคู่'],
    start: { kind: 'office', generated: true, rules: { addRemove: true, minAps: 1, bands: ['5'] } } },
  { id: 'wf5', level: 'medium', mode: 'trouble', week: 7, max: MAX, title: 'ผู้ใช้บ่นว่า Wi-Fi ช้าและหลุด',
    desc: 'แก้ปัญหา (Troubleshooting Challenge) สัปดาห์ที่ 7: สำนักงานชั้น 4 ใช้ AP รุ่นเก่า 4 ตัว (ย่าน 2.4 GHz อย่างเดียว) SSID เดียวกันทุกตัว พนักงานแจ้งว่า "ฝ่ายบัญชีและฝ่ายจัดซื้อช้ามากตอนคนเยอะ" ' +
      'และ "ฝ่ายบริการลูกค้าโทร VoIP ผ่าน Wi-Fi แล้วหลุด" เป้าหมายคือ -67 dBm อย่างน้อย 95% ของพื้นที่ทำงาน ใช้แผนที่สัญญาณและรายการการรบกวนหาสาเหตุ เลือกสาเหตุที่พบจริง ' +
      'แล้วแก้ไขด้วยการเปลี่ยนช่อง กำลังส่ง หรือย้ายตำแหน่ง AP (ห้ามเพิ่มหรือลบ AP)',
    hints: ['ดูรายการการรบกวนก่อน คู่ไหนเหลื่อมกันและได้ยินกันแรงเท่าไร',
      'แตะจุดที่สัญญาณอ่อนในฝ่ายบริการลูกค้า ดูว่าเส้นทางจาก AP ที่ใกล้ที่สุดผ่านผนังอะไร',
      'ย่าน 2.4 GHz มีช่องที่ไม่เหลื่อมกันเพียง 3 ช่อง แต่มี AP 4 ตัว ต้องมีสองตัวใช้ช่องซ้ำกัน ให้เลือกคู่ที่อยู่ไกลกันและมีผนังกั้นจนได้ยินกันต่ำกว่า -82 dBm',
      'ถ้าคู่ที่ใช้ช่องซ้ำยังได้ยินกันอยู่ ลองลดกำลังส่ง แล้วตรวจว่าพื้นที่ยังได้ตามเป้า'],
    start: { kind: 'trouble', floor: 'wing', target: -67, causes: WF5_CAUSES,
      aps: [AP('ap1', 'AP-1', 6.5, 3.5, '2.4', 1, 20, 17), AP('ap2', 'AP-2', 18.5, 14.5, '2.4', 3, 20, 17),
        AP('ap3', 'AP-3', 30.5, 3.5, '2.4', 6, 20, 17), AP('ap4', 'AP-4', 32.5, 15.5, '2.4', 11, 20, 17)],
      rules: { lockBand: true, lockWidth: true, lockSet: true, maxAps: 4, minAps: 4, bands: ['2.4'] } } },
  { id: 'wf6', level: 'medium', mode: 'independent', week: 7, max: MAX, title: 'ตั้งค่าความปลอดภัยและ Guest network ให้ร้าน',
    desc: `ฝึกเอง (Independent Lab) สัปดาห์ที่ 7: ร้าน ${CAFE_SHOP.name} (เบอร์ร้าน ${CAFE_SHOP.phone}) ใช้ Wi-Fi Router ที่ตั้งค่าจากโรงงานไว้ทั้งหมด พนักงานใช้ Wi-Fi กับเครื่อง POS แท็บเล็ต และเครื่องพิมพ์ใบเสร็จ ` +
      '(เครื่องพิมพ์รุ่นนี้รองรับแค่ WPA2) ลูกค้าใช้มือถือหลายรุ่นทั้งเก่าและใหม่ ให้ตั้งค่า Router ให้ปลอดภัยตามที่เรียน: แยกเครือข่ายลูกค้าออกจากเครือข่ายพนักงาน ' +
      'เลือกโหมดความปลอดภัยที่เหมาะกับอุปกรณ์ ตั้งรหัสผ่านที่แข็งแรง ป้องกันตัว Router เอง แล้วส่งตรวจ',
    hints: ['Guest network ต้องมี SSID แยกจากเครือข่ายพนักงาน และไม่ให้แขกเข้าถึงเครือข่ายภายใน (LAN) รวมถึงเปิด Client isolation',
      'ถ้ามีอุปกรณ์รองรับแค่ WPA2 ให้ใช้ WPA2/WPA3 Transition (หรืออย่างน้อย WPA2-AES) ไม่ใช้ TKIP หรือ WEP',
      'รหัสผ่านควรยาวอย่างน้อย 12 ตัว ไม่ใช่เบอร์โทรหรือชื่อร้าน และรหัสของแขกต้องไม่ซ้ำกับรหัสพนักงาน',
      'ตัว Router: เปลี่ยนรหัสผู้ดูแลจากค่าเริ่มต้น (ไม่ซ้ำกับรหัส Wi-Fi) ปิด WPS และปิด Remote management'],
    start: { kind: 'security', shop: CAFE_SHOP, modes: SEC_MODES,
      sec: { staff: { ssid: 'TP-Link_8A2C', sec: 'wpa2-tkip', pass: CAFE_SHOP.phone, hidden: false },
        guest: { on: false, ssid: '', sec: 'open', pass: '', isolation: false, lan: true, hidden: false },
        wps: true, adminPass: 'admin', remote: true } } }
];

/* ============================================================== generated office (wf4) */
function shuffle(rand, a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
/* greedy set cover: how many 5 GHz APs at 17 dBm reach `target` on >= 95 % of the required cells */
function greedyPlan(floor, target) {
  const req = WF.requiredMask(floor), cells = [];
  for (let c = 0; c < req.length; c++) if (req[c]) cells.push([c % floor.W + 0.5, Math.floor(c / floor.W) + 0.5]);
  const cand = [];
  for (let y = 1.5; y < floor.H; y += 3) for (let x = 1.5; x < floor.W; x += 3) if (WF.placeOk(floor, x, y)) cand.push({ x, y });
  const cov = cand.map(p => {
    const ap = { x: p.x, y: p.y, band: '5', tx: 17 };
    const s = new Set();
    cells.forEach(([x, y], k) => { if (WF.rssiAt(floor, ap, x, y).rssi >= target) s.add(k); });
    return s;
  });
  const need = Math.ceil(0.95 * cells.length), got = new Set(), picks = [];
  while (got.size < need && picks.length < 12) {
    let best = -1, gain = 0;
    cov.forEach((s, k) => { let g = 0; s.forEach(c => { if (!got.has(c)) g++; }); if (g > gain) { gain = g; best = k; } });
    if (best < 0) break;
    picks.push(cand[best]); cov[best].forEach(c => got.add(c));
  }
  return { picks, ok: got.size >= need };
}
/* channel blocks a width allows (one per non-overlapping block) */
function blocksFor(width, dfs) {
  const list = width === 80 ? WF.G80 : width === 40 ? WF.G40 : WF.CH5.map(c => [c]);
  return list.filter(b => dfs || !b.some(c => WF.DFS.includes(c)));
}
/* can the greedy positions get non-overlapping channels at full power? (greedy graph colouring) */
function colourable(floor, picks, width, dfs) {
  const n = picks.length, blocks = blocksFor(width, dfs);
  const hear = (a, b) => Math.max(WF.rssiAt(floor, { x: a.x, y: a.y, band: '5', tx: 17 }, b.x, b.y, WF.AP_GAIN).rssi,
    WF.rssiAt(floor, { x: b.x, y: b.y, band: '5', tx: 17 }, a.x, a.y, WF.AP_GAIN).rssi) >= WF.CCA;
  const adj = picks.map((a, i) => picks.map((b, j) => i !== j && hear(a, b)));
  const order = picks.map((_, i) => i).sort((i, j) => adj[j].filter(Boolean).length - adj[i].filter(Boolean).length);
  const col = new Array(n).fill(-1);
  for (const i of order) {
    const used = new Set(col.filter((c, j) => c >= 0 && adj[i][j]));
    const c = blocks.findIndex((_, k) => !used.has(k));
    if (c < 0) return false;
    col[i] = c;
  }
  return true;
}
function genWf4(rand) {
  for (let tries = 0; tries < 8; tries++) {
    const floor = WF.genOffice(rand);
    const target = rand() < 0.5 ? WF.TARGET.voice : WF.TARGET.data;
    let minWidth = [20, 40, 80][Math.floor(rand() * 3)], dfs = rand() < 0.5;
    const g = greedyPlan(floor, target);
    if (!g.ok || g.picks.length < 2) continue;
    while (!colourable(floor, g.picks, minWidth, dfs)) { if (!dfs) dfs = true; else if (minWidth > 20) minWidth /= 2; else break; }
    if (!colourable(floor, g.picks, minWidth, dfs)) continue;
    return { v: 1, mission: 'wf4', floor, target, minWidth, dfs, budget: g.picks.length };
  }
  // fallback (should not happen): a fixed small office
  const floor = WF.genOffice(() => 0.5);
  return { v: 1, mission: 'wf4', floor, target: WF.TARGET.data, minWidth: 20, dfs: true, budget: greedyPlan(floor, WF.TARGET.data).picks.length };
}
function generate(missionId, rand) {
  if (typeof rand !== 'function') rand = Math.random;
  if (missionId === 'wf4') return genWf4(rand);
  return null;
}
function checkWf4Problem(p) {
  if (!isObj(p) || p.mission !== 'wf4' || p.v !== 1 || !WF.checkFloor(p.floor)) return null;
  if (![WF.TARGET.voice, WF.TARGET.data].includes(p.target) || ![20, 40, 80].includes(p.minWidth) || typeof p.dfs !== 'boolean') return null;
  if (!Number.isInteger(p.budget) || p.budget < 1 || p.budget > 12) return null;
  return p;
}

/* ============================================================== grading helpers */
const floorOf = m => WF.FLOORS[m.start.floor];
function build(m, p, startOverride) {
  if (!isObj(p)) return { err: 'ข้อมูลที่ส่งมาไม่ถูกต้อง (ต้องเป็น object ที่มีรายการ aps)' };
  if (tooBig(p, 20000)) return { err: 'ข้อมูลที่ส่งมาใหญ่เกินไป' };
  const start = startOverride || { floor: floorOf(m), aps: m.start.aps, rules: m.start.rules };
  const r = WF.applyConfig(start, { aps: p.aps });
  if (!r.ok) return { err: r.error };
  return { aps: r.aps, floor: start.floor };
}
const kindTh = c => c.kind === 'co' ? 'ช่องเดียวกัน (co-channel)' : 'ช่องเหลื่อม/ทับกัน';
function conflictText(all, c) {
  const A = all.find(x => x.id === c.a), B = all.find(x => x.id === c.b);
  const hear = Math.max(c.hearAB, c.hearBA);
  const gap = A.band === '2.4' && c.kind === 'overlap' ? ` ห่างกัน ${c.gap} ช่อง (น้อยกว่า 5)` : '';
  return `${A.name} (${WF.chLabel(A)}) กับ ${B.name} (${WF.chLabel(B)}): ${kindTh(c)}${gap} และได้ยินกันที่ ${hear} dBm (แรงกว่า ${WF.CCA} dBm) จึงต้องผลัดกันส่งหรือรบกวนกัน`;
}
function covText(cov, target) {
  const rooms = Object.entries(cov.byRoom).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([n, k]) => `${n} ${k} ตร.ม.`).join(', ');
  return `พื้นที่ที่ต้องการได้ ${target} dBm ขึ้นไป ${cov.pct}% (${cov.ok}/${cov.total} ตร.ม.) ต้องได้อย่างน้อย 95%` + (rooms ? ` จุดที่ยังไม่ถึงเป้ามากที่สุด: ${rooms}` : '');
}
const covPts = (pct, max) => pct >= 95 ? max : Math.max(0, Math.min(max - 1, max * (pct - 60) / 35));
const pub = aps => aps.map(a => ({ id: a.id, x: a.x, y: a.y, band: a.band, ch: a.ch, width: a.width, tx: a.tx }));

/* ---------- wf1 ---------- */
function gradeWf1(m, p) {
  const b = build(m, p); if (b.err) return zero(b.err);
  const cf = WF.conflicts(b.floor, b.aps);
  const fb = [];
  let score = 0;
  const per = MAX / cf.length;
  cf.forEach(c => { if (!c.conflict) score += per; else fb.push(conflictText(b.aps, c)); });
  const nBad = cf.filter(c => c.conflict).length;
  return done(score, MAX, fb, { aps: pub(b.aps), conflicts: cf, nConflicts: nBad },
    `ยอดเยี่ยม! ไม่มี AP คู่ใดเหลื่อมกัน (ช่อง ${b.aps.map(a => a.ch).join(', ')}) ช่องที่ห่างกันตั้งแต่ 5 ช่องขึ้นไปไม่ทับกันในย่าน 2.4 GHz`);
}
/* ---------- wf2 ---------- */
function gradeWf2(m, p) {
  const b = build(m, p); if (b.err) return zero(b.err);
  const t = m.start.target, cov = WF.coverage(b.floor, b.aps, t), cf = WF.conflicts(b.floor, b.aps);
  const fb = [];
  let score = covPts(cov.pct, 7);
  if (cov.pct < 95) fb.push(covText(cov, t));
  const bad = cf.filter(c => c.conflict);
  if (!bad.length) score += 3; else bad.forEach(c => fb.push(conflictText(b.aps, c)));
  return done(score, MAX, fb, { aps: pub(b.aps), coverage: { pct: cov.pct, ok: cov.ok, total: cov.total, byRoom: cov.byRoom }, conflicts: cf },
    `ยอดเยี่ยม! แล็บทั้งสองห้องได้ ${t} dBm ขึ้นไป ${cov.pct}% และ AP สองตัวใช้ช่องที่ไม่ทับกัน: วาง AP ไว้ในห้องที่ใช้งานดีกว่าติดหลังผนังคอนกรีต`);
}
/* ---------- wf3 ---------- */
function gradeWf3(m, p) {
  const b = build(m, p); if (b.err) return zero(b.err);
  const S = m.start, t = S.target, cov = WF.coverage(b.floor, b.aps, t);
  const cf = WF.conflicts(b.floor, b.aps, S.neighbours), all = b.aps.concat(S.neighbours);
  const fb = [], rub = [];
  const cp = covPts(cov.pct, 2);
  if (cov.pct < 95) fb.push(covText(cov, t));
  rub.push({ id: 'coverage', title: `พื้นที่นั่ง ${t} dBm ขึ้นไป ≥ 95%`, score: r1(cp), max: 2, note: `${cov.pct}%` });
  const bad = cf.filter(c => c.conflict);
  bad.slice(0, 6).forEach(c => fb.push(conflictText(all, c)));
  if (bad.length > 6) fb.push(`…และอีก ${bad.length - 6} คู่`);
  const ip = bad.length ? 0 : 3;
  rub.push({ id: 'interference', title: 'ไม่มีการรบกวนกับ AP ของร้านและ AP ข้างเคียง', score: ip, max: 3, note: `${bad.length} คู่` });
  const dfsAps = b.aps.filter(a => WF.isDfs(a.band, a.ch, a.width));
  dfsAps.forEach(a => fb.push(`${a.name} ใช้ ${WF.chLabel(a)} ซึ่งเป็นช่อง DFS: เจ้าของร้านขอไม่ใช้ เพราะเมื่อตรวจพบเรดาร์ AP ต้องย้ายช่องทันทีและลูกค้าหลุด`));
  const covered = cov.per.reduce((s, x) => s + x, 0) || 1;
  const load = cov.per.map(x => Math.round(S.clients * x / covered));
  const over = b.aps.map((a, i) => ({ a, n: load[i] })).filter(x => x.n > S.perAp);
  if (over.length) fb.push(over.map(x => `${x.a.name} ต้องรับลูกค้าประมาณ ${x.n} เครื่อง (เกิน ${S.perAp})`).join(', ') + ': ใช้ AP มากกว่าหนึ่งตัวและแบ่งพื้นที่ให้ใกล้เคียงกัน');
  const kp = (dfsAps.length ? 0 : 1) + (over.length ? 0 : 2);
  rub.push({ id: 'constraints', title: 'ไม่ใช้ช่อง DFS และไม่มี AP ใดรับเกิน 30 เครื่อง', score: kp, max: 3 });
  const A = isObj(p.answers) ? p.answers : {};
  let qp = 0;
  for (const k of Object.keys(WF3_A)) {
    const v = typeof A[k] === 'string' ? A[k] : '';
    if (v === WF3_A[k]) qp++;
    else if (!v) fb.push(`ยังไม่ได้ตอบคำถาม: ${WF3_Q[k].q}`);
    else fb.push(`คำถาม "${WF3_Q[k].q}" ยังไม่ถูก: ดูผลในแบบจำลองของคุณ ${k === 'band' ? '(ลองตั้ง AP เป็น 2.4 GHz แล้วดูรายการการรบกวนกับ AP ข้างเคียง)' : '(ดูว่าบล็อก 80 MHz ที่ไม่ใช่ DFS ทับกับ AP ข้างเคียงหรือไม่)'}`);
  }
  rub.push({ id: 'questions', title: 'ตอบคำถามจากผลการจำลอง', score: qp, max: 2 });
  const score = cp + ip + kp + qp;
  return done(score, MAX, fb, { aps: pub(b.aps), coverage: { pct: cov.pct, ok: cov.ok, total: cov.total, byRoom: cov.byRoom }, load, conflicts: cf.filter(c => c.overlap) },
    'ยอดเยี่ยม! ใช้ 5 GHz ช่องที่ว่างจริง ความกว้างช่องพอดีกับจำนวน AP พื้นที่นั่งได้สัญญาณตามเป้า และแบ่งลูกค้าให้ AP แต่ละตัวพอดี', { rubric: rub });
}
/* ---------- wf4 ---------- */
function gradeWf4(m, p, problem) {
  const pr = checkWf4Problem(problem);
  if (!pr) return zero('โจทย์ไม่ถูกต้องหรือหมดอายุ กด "โจทย์ใหม่" แล้วลองอีกครั้ง');
  const b = build(m, p, { floor: pr.floor, aps: [], rules: { addRemove: true, minAps: 1, maxAps: 12, bands: ['5'] } });
  if (b.err) return zero(b.err);
  const t = pr.target, cov = WF.coverage(b.floor, b.aps, t), cf = WF.conflicts(b.floor, b.aps);
  const fb = [];
  let score = covPts(cov.pct, 5);
  if (cov.pct < 95) fb.push(covText(cov, t));
  const bad = cf.filter(c => c.conflict);
  bad.slice(0, 6).forEach(c => fb.push(conflictText(b.aps, c)));
  score += Math.max(0, 3 - 1.5 * bad.length);
  let kp = 2;
  if (b.aps.length > pr.budget) { kp -= b.aps.length > pr.budget + 1 ? 2 : 1; fb.push(`ใช้ AP ${b.aps.length} ตัว เกินงบที่กำหนด ${pr.budget} ตัว`); }
  const narrow = b.aps.filter(a => a.width < pr.minWidth);
  if (narrow.length) { kp -= 1; fb.push(`${narrow.map(a => a.name).join(', ')} ใช้ช่องกว้างน้อยกว่า ${pr.minWidth} MHz ที่โจทย์กำหนด`); }
  const dfsAps = pr.dfs ? [] : b.aps.filter(a => WF.isDfs(a.band, a.ch, a.width));
  if (dfsAps.length) { kp -= 1; fb.push(`${dfsAps.map(a => a.name + ' (' + WF.chLabel(a) + ')').join(', ')} ใช้ช่อง DFS ซึ่งโจทย์ไม่อนุญาต`); }
  score += Math.max(0, kp);
  return done(score, MAX, fb, { aps: pub(b.aps), coverage: { pct: cov.pct, ok: cov.ok, total: cov.total, byRoom: cov.byRoom }, conflicts: cf.filter(c => c.overlap), budget: pr.budget },
    `ยอดเยี่ยม! ใช้ AP ${b.aps.length} ตัว (งบ ${pr.budget}) พื้นที่ได้ ${t} dBm ขึ้นไป ${cov.pct}% และไม่มีคู่ใดรบกวนกัน`);
}
/* ---------- wf5 ---------- */
function gradeWf5(m, p) {
  const b = build(m, p); if (b.err) return zero(b.err);
  const t = m.start.target, cov = WF.coverage(b.floor, b.aps, t), cf = WF.conflicts(b.floor, b.aps);
  const fb = [];
  const A = isObj(p.answers) ? p.answers : {};
  const sel = Array.isArray(A.causes) ? [...new Set(A.causes.filter(x => typeof x === 'string' && WF5_CAUSES.some(c => c.id === x)))].slice(0, 6) : [];
  let dp = 0;
  WF5_TRUE.forEach(id => { if (sel.includes(id)) dp += 2; });
  const wrong = sel.filter(x => !WF5_TRUE.includes(x));
  dp = Math.max(0, dp - wrong.length);
  if (!sel.length) fb.push('ยังไม่ได้เลือกสาเหตุที่พบ');
  else if (dp < 4) {
    const miss = WF5_TRUE.filter(x => !sel.includes(x)).length;
    fb.push(`การวิเคราะห์สาเหตุยังไม่ครบหรือมีข้อที่ไม่จริง (ขาด ${miss} ข้อ เลือกเกิน ${wrong.length} ข้อ): ตรวจทุกข้อกับหลักฐานในแบบจำลองของเครือข่ายเดิม เช่น รายการการรบกวน และเส้นทางสัญญาณที่ผ่านผนัง`);
  }
  let cp = cov.pct >= 95 ? 3 : Math.max(0, Math.min(2, 2 * (cov.pct - 80) / 15));
  if (cov.pct < 95) fb.push(covText(cov, t));
  const bad = cf.filter(c => c.conflict);
  bad.forEach(c => fb.push(conflictText(b.aps, c)));
  const ip = Math.max(0, 3 - 1.5 * bad.length);
  return done(dp + cp + ip, MAX, fb, { aps: pub(b.aps), coverage: { pct: cov.pct, ok: cov.ok, total: cov.total, byRoom: cov.byRoom }, conflicts: cf.filter(c => c.overlap), causes: sel },
    'ยอดเยี่ยม! พบทั้งสองสาเหตุ (ช่อง 1/3/6 เหลื่อมกัน และ AP หลังปล่องลิฟต์) แก้จนพื้นที่ได้ตามเป้าและไม่มี AP คู่ใดรบกวนกัน');
}
/* ---------- wf6 ---------- */
const COMMON_PW = ['12345678', '123456789', '1234567890', '123456789012', 'password', 'password1', 'password123', 'qwerty123', 'qwertyuiop', '11111111', '00000000', '88888888',
  '87654321', 'iloveyou', 'admin123', 'abc12345', 'abcd1234', '1q2w3e4r', 'wifi1234', 'wifipassword', 'passw0rd', 'administrator', 'admin', 'guest', 'guest1234', 'welcome1', 'welcome123'];
const VENDOR = /^(tp-?link|tplink|asus|netgear|linksys|d-?link|huawei|zte|tenda|xiaomi|mi_|cisco|ais|3bb|true_?|dlink|totolink|mercusys|fiberhome)/i;
const utf8len = s => Buffer.byteLength(s, 'utf8');
const sstr = (v, n) => (typeof v === 'string' ? v : '').slice(0, n);
function pwIssues(pw, shop) {
  const out = [];
  if (pw.length < 8 || pw.length > 63) { out.push(`ยาว ${pw.length} ตัว: passphrase ของ WPA2/WPA3-Personal ต้องยาว 8–63 ตัวอักษร`); return out; }
  if (pw.length < 12) out.push(`ยาวเพียง ${pw.length} ตัว ควรยาวอย่างน้อย 12 ตัว`);
  const low = pw.toLowerCase(), digits = pw.replace(/\D/g, '');
  if (COMMON_PW.includes(low)) out.push('เป็นรหัสยอดนิยมที่อยู่ในรายการเดา');
  if (/^\d+$/.test(pw)) out.push('เป็นตัวเลขล้วน เดาง่าย');
  if (shop && (low.replace(/\s/g, '').includes(shop.name.toLowerCase().replace(/\s/g, '')) || (digits.length >= 6 && shop.phone.includes(digits)) || pw.includes(shop.phone))) out.push('มีชื่อร้านหรือเบอร์โทรร้านอยู่ในรหัส ซึ่งเป็นสิ่งแรกที่ผู้บุกรุกจะลอง');
  if (/^(.)\1+$/.test(pw)) out.push('เป็นตัวอักษรซ้ำกันทั้งหมด');
  return out;
}
const SEC_TH = { open: 'Open (ไม่มีรหัส)', wep: 'WEP', wpa: 'WPA (TKIP)', 'wpa2-tkip': 'WPA2 (TKIP/AES)', wpa2: 'WPA2-Personal (AES)', mixed: 'WPA2/WPA3 Transition', wpa3: 'WPA3-Personal (SAE)' };
function gradeWf6(m, p) {
  if (!isObj(p) || !isObj(p.sec)) return zero('ไม่พบการตั้งค่า Router ที่ส่งมา');
  if (tooBig(p, 6000)) return zero('ข้อมูลที่ส่งมาใหญ่เกินไป');
  const S = p.sec, shop = m.start.shop;
  const st = isObj(S.staff) ? S.staff : {}, gu = isObj(S.guest) ? S.guest : {};
  const staff = { ssid: sstr(st.ssid, 64), sec: SEC_MODES.includes(st.sec) ? st.sec : null, pass: sstr(st.pass, 80) };
  const guest = { on: gu.on === true, ssid: sstr(gu.ssid, 64), sec: SEC_MODES.includes(gu.sec) ? gu.sec : null, pass: sstr(gu.pass, 80), isolation: gu.isolation === true, lan: gu.lan !== false };
  if (!staff.sec || (guest.on && !guest.sec)) return zero('โหมดความปลอดภัยที่ส่งมาไม่ถูกต้อง');
  const wps = S.wps !== false, remote = S.remote !== false, admin = sstr(S.adminPass, 80);
  const fb = [], rub = [];
  const add = (id, title, score, max, note) => { rub.push({ id, title, score: r1(score), max, note }); return score; };
  let score = 0;
  // 1. separate guest SSID, sensible names
  let p1 = 0;
  const ssidOk = s => s.length > 0 && utf8len(s) <= 32;
  if (!ssidOk(staff.ssid)) fb.push('SSID ของพนักงานต้องมี 1–32 ไบต์');
  else if (VENDOR.test(staff.ssid)) fb.push(`SSID ของพนักงาน "${staff.ssid}" ยังเป็นชื่อจากโรงงานที่บอกยี่ห้อ Router ควรตั้งชื่อใหม่ที่ไม่บอกยี่ห้อหรือรุ่น`);
  else p1 += 0.5;
  if (!guest.on) fb.push('ยังไม่ได้เปิด Guest network: ลูกค้าจะอยู่เครือข่ายเดียวกับ POS และเครื่องพิมพ์ของร้าน');
  else if (!ssidOk(guest.ssid)) fb.push('SSID ของ Guest network ต้องมี 1–32 ไบต์');
  else if (guest.ssid === staff.ssid) fb.push('Guest network ต้องใช้ SSID แยกจากเครือข่ายพนักงาน');
  else if (VENDOR.test(guest.ssid)) { p1 += 0.5; fb.push(`SSID ของแขก "${guest.ssid}" บอกยี่ห้อ Router ควรตั้งชื่อใหม่`); }
  else p1 += 1;
  score += add('ssid', 'แยก SSID ของแขก และไม่ใช้ชื่อจากโรงงาน', p1, 1.5);
  // 2. staff security
  let p2 = 0;
  if (staff.sec === 'mixed') p2 = 1.5;
  else if (staff.sec === 'wpa2') { p2 = 1; fb.push('เครือข่ายพนักงานใช้ WPA2-AES ได้ แต่ WPA2/WPA3 Transition ให้เครื่องใหม่ (POS แท็บเล็ต) ได้ WPA3 พร้อมกับให้เครื่องพิมพ์ใช้ WPA2'); }
  else if (staff.sec === 'wpa3') fb.push('เครือข่ายพนักงานเป็น WPA3 อย่างเดียว เครื่องพิมพ์ใบเสร็จ (รองรับแค่ WPA2) จะเชื่อมต่อไม่ได้: ใช้ WPA2/WPA3 Transition');
  else fb.push(`เครือข่ายพนักงานใช้ ${SEC_TH[staff.sec]} ซึ่งไม่ปลอดภัย (Open/WEP/TKIP เลิกใช้แล้ว) ให้ใช้ WPA2/WPA3 Transition หรืออย่างน้อย WPA2-AES`);
  score += add('staffsec', 'โหมดความปลอดภัยของเครือข่ายพนักงาน', p2, 1.5, SEC_TH[staff.sec]);
  // 3. guest security
  let p3 = 0;
  if (guest.on) {
    if (guest.sec === 'mixed' || guest.sec === 'wpa2') p3 = 1;
    else if (guest.sec === 'wpa3') { p3 = 0.5; fb.push('Guest network เป็น WPA3 อย่างเดียว มือถือรุ่นเก่าของลูกค้าที่ยังไม่รองรับ WPA3 จะเชื่อมต่อไม่ได้: ใช้ Transition mode'); }
    else fb.push(`Guest network ใช้ ${SEC_TH[guest.sec]}: ${guest.sec === 'open' ? 'ไม่มีการเข้ารหัส ใครอยู่ใกล้ร้านก็ดักอ่านข้อมูลได้' : 'การเข้ารหัสแบบเก่าที่ไม่ปลอดภัย'} ให้ใช้ WPA2/WPA3 Transition`);
  }
  score += add('guestsec', 'โหมดความปลอดภัยของ Guest network', p3, 1);
  // 4. passphrases
  let p4 = 0;
  const encOk = s => s && s !== 'open' && s !== 'wep';
  const si = pwIssues(staff.pass, shop);
  if (!encOk(staff.sec)) fb.push('รหัสผ่านพนักงานไม่มีผลถ้าไม่ได้ใช้ WPA2/WPA3');
  else if (si.length) fb.push('รหัสผ่าน Wi-Fi พนักงาน: ' + si.join('; '));
  else p4 += 1;
  if (guest.on && encOk(guest.sec)) {
    const gi = pwIssues(guest.pass, shop);
    if (guest.pass && guest.pass === staff.pass) fb.push('รหัสผ่านของแขกซ้ำกับรหัสพนักงาน: ลูกค้าที่รู้รหัสแขกจะเข้าเครือข่ายพนักงานได้');
    else if (gi.length) fb.push('รหัสผ่าน Guest network: ' + gi.join('; '));
    else p4 += 1;
  }
  score += add('pass', 'รหัสผ่าน Wi-Fi แข็งแรงและไม่ซ้ำกัน', p4, 2);
  // 5. guest isolation
  let p5 = 0;
  if (guest.on) {
    if (!guest.lan) p5 += 0.75; else fb.push('Guest network ยังอนุญาตให้เข้าถึงเครือข่ายภายใน (LAN) ลูกค้าจะมองเห็น POS และเครื่องพิมพ์ ให้ปิด');
    if (guest.isolation) p5 += 0.75; else fb.push('ยังไม่ได้เปิด Client isolation ใน Guest network: มือถือลูกค้ายังมองเห็นกันเองได้');
  }
  score += add('isolate', 'แขกเข้า LAN ไม่ได้ และเปิด Client isolation', p5, 1.5);
  // 6. WPS
  if (!wps) score += add('wps', 'ปิด WPS', 1, 1); else { add('wps', 'ปิด WPS', 0, 1); fb.push('WPS ยังเปิดอยู่: PIN 8 หลักถูกตรวจทีละครึ่ง เดาได้ในราว 11,000 ครั้ง แล้ว Router จะส่งรหัส Wi-Fi ให้ทันที'); }
  // 7. admin password
  let p7 = 0;
  if (!admin || admin.toLowerCase() === 'admin' || admin.toLowerCase() === 'password' || COMMON_PW.includes(admin.toLowerCase())) fb.push('รหัสผู้ดูแล Router ยังเป็นค่าเริ่มต้นหรือเดาง่าย (เช่น admin) ใครเข้า Wi-Fi ได้ก็เข้าไปแก้ค่า Router ได้');
  else if (admin === staff.pass || admin === guest.pass) fb.push('รหัสผู้ดูแล Router ต้องไม่ซ้ำกับรหัส Wi-Fi');
  else if (admin.length < 12) { p7 = 0.5; fb.push(`รหัสผู้ดูแลยาว ${admin.length} ตัว ควรยาวอย่างน้อย 12 ตัว`); }
  else p7 = 1;
  score += add('admin', 'เปลี่ยนรหัสผู้ดูแล Router', p7, 1);
  // 8. remote management
  if (!remote) score += add('remote', 'ปิด Remote management', 0.5, 0.5); else { add('remote', 'ปิด Remote management', 0, 0.5); fb.push('Remote management ยังเปิด: ร้านไม่ได้ใช้ ควรปิดเพื่อไม่ให้หน้าตั้งค่าเปิดรับจากอินเทอร์เน็ต'); }
  if (S.staff && S.staff.hidden === true) fb.push('หมายเหตุ: การซ่อน SSID ไม่เพิ่มความปลอดภัยจริง (ชื่อยังถูกดักจับได้) ไม่มีผลต่อคะแนน');
  return done(score, MAX, fb, { items: rub.map(x => ({ id: x.id, ok: x.score >= x.max })) },
    'ยอดเยี่ยม! เครือข่ายพนักงานใช้ Transition mode รองรับเครื่องพิมพ์ แขกแยก SSID เข้า LAN ไม่ได้ รหัสแข็งแรง และ Router ปิด WPS กับ Remote management แล้ว', { rubric: rub });
}

const GRADERS = { wf1: gradeWf1, wf2: gradeWf2, wf3: gradeWf3, wf4: gradeWf4, wf5: gradeWf5, wf6: gradeWf6 };
function grade(missionId, payload, problem) {
  const m = missions.find(x => x.id === missionId);
  if (!m) return zero('ไม่พบภารกิจนี้');
  try { return GRADERS[m.id](m, payload, problem); }
  catch (e) { return zero('ข้อมูลที่ส่งมาไม่ถูกต้อง ตรวจงานไม่ได้', m.max); }
}

module.exports = {
  id: 'wifi', title: 'ห้องปฏิบัติการวางแผน Wi-Fi', missions, grade, generate, generatedMissions: ['wf4'],
  _lib: { WF, greedyPlan, colourable, checkWf4Problem, pwIssues, WF5_TRUE, WF3_A }
};

'use strict';
/*
 * NetLab - Wi-Fi Planning Lab "วางแผน Wi-Fi" (browser module + shared engine)
 *   1) Engine WF (DOM-free). Under Node (require) this file exports only WF; server/sims/wifi.js grades with it.
 *   2) Browser UI: window.NL_SIMS.wifi = { title, mount(root, ctx) } (only defined in a browser).
 *
 * MODEL (teaching approximations, labelled "ค่าประมาณ" in the UI)
 *   Floor plan in metres, sampled on a 1 m grid (cell centres at i+0.5, j+0.5). Walls are segments on integer
 *   coordinates with a material; each wall the straight path crosses adds that material's loss once.
 *   RSSI(dBm) = Ptx + Gap + Grx - PL(d)  - sum(walls)
 *   PL(d)     = PL0(band) + 10 * n * log10(max(d, 1 m))      PL0(1 m): 2.4 GHz 40 dB, 5 GHz 47 dB (free space at 1 m), n = 3 (indoor)
 *   Gap = 3 dBi (AP antenna), Grx = 0 dBi for a client, 3 dBi when another AP listens.
 *   Ptx choices 5/8/11/14/17 dBm: 17 dBm + 3 dBi = 20 dBm EIRP (100 mW, the 2.4 GHz limit in Thailand).
 *   Noise floor -95 dBm (20 MHz), SNR = RSSI - noise floor (wider channels raise the noise floor 3 dB per doubling).
 *   Channels: 2.4 GHz 1-13 (Thailand), 20 MHz only; two channels overlap when they are fewer than 5 apart (1/6/11 do not).
 *            5 GHz 36-48, 52-64 (DFS), 100-140 (DFS), 149-165 with 20/40/80 MHz bonding; two APs overlap when their
 *            bonded 20 MHz sets share a channel.
 *   Interference: two APs (or an AP and a neighbour's AP) whose channels overlap and where either one hears the other at
 *   or above -82 dBm (approximate CCA signal-detect threshold for 20 MHz). Same channel = co-channel; partial = overlap.
 *   One radio per AP. The client joins the strongest AP (best server).
 */
(function (root) {
  function engine() {
    const isObj = x => !!x && typeof x === 'object' && !Array.isArray(x);
    const r1 = x => Math.round(x * 10) / 10;

    /* ------------------------------------------------------------ constants */
    const MAT = {
      drywall: { db: 4, th: 'ผนังเบา/ยิปซัม (drywall)', range: '3–5' },
      glass: { db: 3, th: 'กระจก (glass)', range: '2–4' },
      brick: { db: 8, th: 'ผนังก่ออิฐ (brick)', range: '6–10' },
      concrete: { db: 12, th: 'ผนังคอนกรีต (concrete)', range: '10–15' },
      metal: { db: 25, th: 'โลหะ/ปล่องลิฟต์ (metal)', range: '20 ขึ้นไป' }
    };
    const PL0 = { '2.4': 40, '5': 47 };
    const N_EXP = 3, AP_GAIN = 3, CLIENT_GAIN = 0, NOISE = -95, CCA = -82;
    const TX = [5, 8, 11, 14, 17];
    const TARGET = { voice: -67, data: -70 };
    const CH24 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
    const CH5 = [36, 40, 44, 48, 52, 56, 60, 64, 100, 104, 108, 112, 116, 120, 124, 128, 132, 136, 140, 149, 153, 157, 161, 165];
    const DFS = [52, 56, 60, 64, 100, 104, 108, 112, 116, 120, 124, 128, 132, 136, 140];
    const G40 = [[36, 40], [44, 48], [52, 56], [60, 64], [100, 104], [108, 112], [116, 120], [124, 128], [132, 136], [149, 153], [157, 161]];
    const G80 = [[36, 40, 44, 48], [52, 56, 60, 64], [100, 104, 108, 112], [116, 120, 124, 128], [149, 153, 157, 161]];
    const WIDTHS = { '2.4': [20], '5': [20, 40, 80] };
    const MAX_APS = 12;
    const BINS = [   // heatmap classes, strongest first; k = css variable suffix
      { min: -60, k: 5, label: '-60 ขึ้นไป' }, { min: -67, k: 4, label: '-67 ถึง -61' }, { min: -70, k: 3, label: '-70 ถึง -68' },
      { min: -75, k: 2, label: '-75 ถึง -71' }, { min: -82, k: 1, label: '-82 ถึง -76' }, { min: -Infinity, k: 0, label: 'ต่ำกว่า -82' }];
    const binOf = v => { for (const b of BINS) if (v >= b.min) return b.k; return 0; };

    /* ------------------------------------------------------------ channels */
    function freq(band, ch) { return band === '2.4' ? 2407 + 5 * ch : 5000 + 5 * ch; }
    /* the 20 MHz channels an AP occupies, or null when the combination does not exist */
    function bonded(band, ch, width) {
      if (band === '2.4') return CH24.includes(ch) && width === 20 ? [ch] : null;
      if (band !== '5' || !CH5.includes(ch)) return null;
      if (width === 20) return [ch];
      const G = width === 40 ? G40 : width === 80 ? G80 : null;
      if (!G) return null;
      const g = G.find(x => x.includes(ch));
      return g ? g.slice() : null;
    }
    /* channels valid as the (primary) channel for a band+width, for the UI and the validator */
    function channelsFor(band, width) {
      if (band === '2.4') return width === 20 ? CH24.slice() : [];
      return CH5.filter(c => bonded('5', c, width));
    }
    const isDfs = (band, ch, width) => band === '5' && (bonded(band, ch, width) || []).some(c => DFS.includes(c));
    function chLabel(ap) {
      const b = bonded(ap.band, ap.ch, ap.width);
      if (!b) return `ช่อง ${ap.ch}`;
      if (b.length === 1) return `ช่อง ${ap.ch} (${ap.width} MHz)`;
      return `ช่อง ${ap.ch} · ${ap.width} MHz (${b[0]}–${b[b.length - 1]})`;
    }
    /* do two channel settings overlap? kind: 'co' same channel and width, 'overlap' partial */
    function overlap(a, b) {
      if (a.band !== b.band) return { overlap: false, kind: null, gap: null };
      if (a.band === '2.4') {
        const d = Math.abs(a.ch - b.ch);
        return { overlap: d < 5, kind: d === 0 ? 'co' : d < 5 ? 'overlap' : null, gap: d };
      }
      const A = bonded(a.band, a.ch, a.width) || [], B = bonded(b.band, b.ch, b.width) || [];
      const shared = A.filter(c => B.includes(c));
      if (!shared.length) return { overlap: false, kind: null, gap: null, shared };
      const same = A.length === B.length && A.every((c, i) => c === B[i]);
      return { overlap: true, kind: same ? 'co' : 'overlap', gap: null, shared };
    }

    /* ------------------------------------------------------------ geometry */
    /* walls crossed by the straight path (x1,y1)->(x2,y2). Hits at the same point (a wall junction) count once. */
    function wallsCrossed(floor, x1, y1, x2, y2) {
      const hits = [];
      const dx = x2 - x1, dy = y2 - y1;
      for (const w of floor.walls) {
        const [ax, ay, bx, by, mat] = w;
        const ex = bx - ax, ey = by - ay;
        const den = dx * ey - dy * ex;
        if (Math.abs(den) < 1e-12) continue;          // parallel or collinear: the path runs along the wall, not through it
        const t = ((ax - x1) * ey - (ay - y1) * ex) / den;   // along the path
        const u = ((ax - x1) * dy - (ay - y1) * dx) / den;   // along the wall
        if (t <= 1e-9 || t >= 1 - 1e-9 || u < -1e-9 || u > 1 + 1e-9) continue;
        const px = x1 + t * dx, py = y1 + t * dy;
        const prev = hits.find(h => Math.abs(h.x - px) < 1e-6 && Math.abs(h.y - py) < 1e-6);
        const db = MAT[mat] ? MAT[mat].db : 0;
        if (prev) { if (db > prev.db) { prev.db = db; prev.mat = mat; } }
        else hits.push({ x: px, y: py, t, mat, db });
      }
      return hits.sort((p, q) => p.t - q.t);
    }
    function pathLoss(band, d) { return PL0[band] + 10 * N_EXP * Math.log10(Math.max(d, 1)); }
    /* received power at (x,y) from ap; rxGain 0 for a client, AP_GAIN for another AP */
    function rssiAt(floor, ap, x, y, rxGain) {
      const d = Math.hypot(x - ap.x, y - ap.y);
      const walls = wallsCrossed(floor, ap.x, ap.y, x, y);
      const wl = walls.reduce((s, h) => s + h.db, 0);
      return { rssi: ap.tx + AP_GAIN + (rxGain == null ? CLIENT_GAIN : rxGain) - pathLoss(ap.band, d) - wl, d, walls, wallLoss: wl };
    }
    const inRect = (r, x, y) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
    function roomAt(floor, x, y) { return (floor.rooms || []).find(r => inRect(r, x, y)) || null; }
    /* cells whose centre lies in a required room */
    function requiredMask(floor) {
      const m = new Uint8Array(floor.W * floor.H);
      for (let j = 0; j < floor.H; j++) for (let i = 0; i < floor.W; i++) {
        const x = i + 0.5, y = j + 0.5;
        if ((floor.rooms || []).some(r => r.req && inRect(r, x, y) && !(r.skip && inRect(r.skip, x, y)))) m[j * floor.W + i] = 1;
      }
      return m;
    }
    /* best-server heatmap: strongest RSSI per cell and which AP gives it (-1 when none) */
    function heatmap(floor, aps) {
      const n = floor.W * floor.H, best = new Float32Array(n).fill(-Infinity), who = new Int16Array(n).fill(-1);
      aps.forEach((ap, k) => {
        for (let j = 0; j < floor.H; j++) for (let i = 0; i < floor.W; i++) {
          const v = rssiAt(floor, ap, i + 0.5, j + 0.5).rssi, c = j * floor.W + i;
          if (v > best[c]) { best[c] = v; who[c] = k; }
        }
      });
      return { W: floor.W, H: floor.H, best, who };
    }
    /* share of required cells at or above target */
    function coverage(floor, aps, target, hm) {
      hm = hm || heatmap(floor, aps);
      const req = requiredMask(floor);
      let total = 0, ok = 0;
      const per = aps.map(() => 0);
      const holes = [];
      for (let c = 0; c < req.length; c++) {
        if (!req[c]) continue;
        total++;
        if (hm.best[c] >= target) ok++;
        else holes.push(c);
        if (hm.who[c] >= 0 && hm.best[c] >= target) per[hm.who[c]]++;
      }
      const pct = total ? Math.floor(1000 * ok / total) / 10 : 0;   // rounded down to 0.1 %: 94.96 % is not 95 %
      // where are the holes? count per room
      const byRoom = {};
      holes.forEach(c => { const x = c % floor.W + 0.5, y = Math.floor(c / floor.W) + 0.5; const r = roomAt(floor, x, y); const k = r ? r.n : '?'; byRoom[k] = (byRoom[k] || 0) + 1; });
      return { total, ok, pct, per, holes: holes.length, byRoom, hm };
    }
    /* AP-to-AP interference among aps (and against fixed neighbour APs, which never conflict with each other) */
    function conflicts(floor, aps, neighbours) {
      const all = aps.map((a, i) => ({ ap: a, own: true, i })).concat((neighbours || []).map((a, i) => ({ ap: a, own: false, i })));
      const out = [];
      for (let p = 0; p < all.length; p++) for (let q = p + 1; q < all.length; q++) {
        const A = all[p], B = all[q];
        if (!A.own && !B.own) continue;
        const o = overlap(A.ap, B.ap);
        const ab = rssiAt(floor, A.ap, B.ap.x, B.ap.y, AP_GAIN).rssi;   // B hears A
        const ba = rssiAt(floor, B.ap, A.ap.x, A.ap.y, AP_GAIN).rssi;   // A hears B
        const hear = Math.max(ab, ba);
        out.push({ a: A.ap.id, b: B.ap.id, neighbour: !B.own || !A.own, overlap: o.overlap, kind: o.kind, gap: o.gap, hearAB: r1(ab), hearBA: r1(ba),
          hears: hear >= CCA, conflict: o.overlap && hear >= CCA });
      }
      return out;
    }
    const snr = (rssi, width) => rssi - (NOISE + 10 * Math.log10((width || 20) / 20));

    /* ------------------------------------------------------------ config validation (shared by browser and grader) */
    const ID_RE = /^[A-Za-z0-9_-]{1,12}$/;
    const NAME_RE = /^[A-Za-z0-9 _.-]{1,16}$/;
    /* is (x,y) a legal AP spot? inside the building and not inside a no-AP area (elevator shaft, outside) */
    function placeOk(floor, x, y) {
      if (!(x > 0 && y > 0 && x < floor.W && y < floor.H)) return false;
      return !(floor.noAp || []).some(r => inRect(r, x, y));
    }
    const snap = v => Math.floor(v) + 0.5;
    /*
     * applyConfig(start, cfg) -> { ok, aps } | { ok:false, error }
     * start: { floor, aps:[{id,name,x,y,band,ch,width,tx}], rules:{ maxAps, minAps, lockPos, lockBand, lockTx, lockWidth, addRemove, bands } }
     * cfg:   { aps:[{ id, x, y, band, ch, width, tx, name? }] }  (only whitelisted fields; locked fields come from start)
     */
    function applyConfig(start, cfg) {
      const R = start.rules || {}, floor = start.floor;
      if (!isObj(cfg) || !Array.isArray(cfg.aps)) return { ok: false, error: 'ไม่พบรายการ Access Point ที่ส่งมา' };
      const maxAps = Math.min(MAX_APS, R.maxAps || MAX_APS), minAps = R.minAps || 1;
      if (cfg.aps.length > maxAps) return { ok: false, error: `ภารกิจนี้ใช้ Access Point ได้ไม่เกิน ${maxAps} ตัว` };
      if (cfg.aps.length < minAps) return { ok: false, error: `ต้องมี Access Point อย่างน้อย ${minAps} ตัว` };
      const base = {}; (start.aps || []).forEach(a => { base[a.id] = a; });
      const seen = new Set(), out = [];
      for (const raw of cfg.aps) {
        if (!isObj(raw) || typeof raw.id !== 'string' || !ID_RE.test(raw.id)) return { ok: false, error: 'รหัส Access Point ไม่ถูกต้อง' };
        if (seen.has(raw.id)) return { ok: false, error: `มี Access Point รหัส ${raw.id} ซ้ำ` };
        seen.add(raw.id);
        const b = base[raw.id];
        if (!b && !R.addRemove) return { ok: false, error: `ภารกิจนี้ห้ามเพิ่ม Access Point (${raw.id})` };
        const num = (v, d) => (typeof v === 'number' && isFinite(v) ? v : d);
        const ap = {
          id: raw.id,
          name: b ? b.name : (typeof raw.name === 'string' && NAME_RE.test(raw.name) ? raw.name : raw.id.toUpperCase()),
          x: R.lockPos && b ? b.x : num(raw.x, NaN), y: R.lockPos && b ? b.y : num(raw.y, NaN),
          band: R.lockBand && b ? b.band : raw.band,
          ch: num(raw.ch, NaN),
          width: R.lockWidth && b ? b.width : num(raw.width, NaN),
          tx: R.lockTx && b ? b.tx : num(raw.tx, NaN)
        };
        if (!isFinite(ap.x) || !isFinite(ap.y)) return { ok: false, error: `ตำแหน่งของ ${ap.name} ไม่ถูกต้อง` };
        ap.x = snap(ap.x); ap.y = snap(ap.y);
        if (!placeOk(floor, ap.x, ap.y)) return { ok: false, error: `${ap.name} อยู่นอกอาคารหรืออยู่ในจุดที่ติดตั้งไม่ได้ (เช่น ในปล่องลิฟต์)` };
        const bands = R.bands || ['2.4', '5'];
        if (!bands.includes(ap.band)) return { ok: false, error: `ย่านความถี่ของ ${ap.name} ไม่ถูกต้อง (ภารกิจนี้ใช้ ${bands.map(x => x + ' GHz').join(' หรือ ')})` };
        if (!WIDTHS[ap.band].includes(ap.width)) return { ok: false, error: `ความกว้างช่องของ ${ap.name} ไม่ถูกต้องสำหรับย่าน ${ap.band} GHz` };
        if (!bonded(ap.band, ap.ch, ap.width)) return { ok: false, error: `${ap.name}: ช่อง ${ap.ch} ใช้กับความกว้าง ${ap.width} MHz ในย่าน ${ap.band} GHz ไม่ได้` };
        if (!TX.includes(ap.tx)) return { ok: false, error: `กำลังส่งของ ${ap.name} ต้องเป็น ${TX.join('/')} dBm` };
        out.push(ap);
      }
      if (R.lockSet) {   // fixed set of APs: none may be removed
        const miss = (start.aps || []).filter(a => !seen.has(a.id));
        if (miss.length) return { ok: false, error: `ห้ามลบ Access Point (${miss.map(a => a.name).join(', ')})` };
      }
      return { ok: true, aps: out };
    }
    /* minimal checks on a floor that came from a signed problem */
    function checkFloor(f) {
      if (!isObj(f) || !Number.isInteger(f.W) || !Number.isInteger(f.H) || f.W < 8 || f.H < 6 || f.W > 60 || f.H > 40) return false;
      if (!Array.isArray(f.walls) || f.walls.length > 200 || !Array.isArray(f.rooms) || f.rooms.length > 40) return false;
      if (!f.walls.every(w => Array.isArray(w) && w.length === 5 && w.slice(0, 4).every(v => Number.isFinite(v)) && MAT[w[4]])) return false;
      if (!f.rooms.every(r => isObj(r) && ['x', 'y', 'w', 'h'].every(k => Number.isFinite(r[k])) && typeof r.n === 'string')) return false;
      return true;
    }

    /* ------------------------------------------------------------ floors */
    const box = (x, y, w, h, mat) => [[x, y, x + w, y, mat], [x + w, y, x + w, y + h, mat], [x + w, y + h, x, y + h, mat], [x, y + h, x, y, mat]];
    /* a horizontal wall from x1 to x2 at y with 1 m door gaps starting at each x in doors */
    function hwall(x1, x2, y, mat, doors) {
      const out = []; let x = x1;
      (doors || []).slice().sort((a, b) => a - b).forEach(d => { if (d > x) out.push([x, y, d, y, mat]); x = d + 1; });
      if (x < x2) out.push([x, y, x2, y, mat]);
      return out;
    }
    function vwall(x, y1, y2, mat, doors) {
      const out = []; let y = y1;
      (doors || []).slice().sort((a, b) => a - b).forEach(d => { if (d > y) out.push([x, y, x, d, mat]); y = d + 1; });
      if (y < y2) out.push([x, y, x, y2, mat]);
      return out;
    }
    const FLOORS = {};
    /* wf1: classroom building corridor, 42 x 14 m, brick partitions */
    FLOORS.corridor = {
      id: 'corridor', name: 'อาคารเรียน ชั้น 2 (ทางเดิน)', W: 42, H: 14,
      walls: [].concat(box(0, 0, 42, 14, 'concrete'),
        hwall(0, 42, 6, 'brick', [11, 25, 39]), hwall(0, 42, 9, 'brick', [3, 17, 31]),
        vwall(14, 0, 6, 'brick'), vwall(28, 0, 6, 'brick'), vwall(14, 9, 14, 'brick'), vwall(28, 9, 14, 'brick')),
      rooms: [{ n: 'ห้อง 201', x: 0, y: 0, w: 14, h: 6 }, { n: 'ห้อง 202', x: 14, y: 0, w: 14, h: 6 }, { n: 'ห้อง 203', x: 28, y: 0, w: 14, h: 6 },
        { n: 'ทางเดิน', x: 0, y: 6, w: 42, h: 3, req: true },
        { n: 'ห้อง 204', x: 0, y: 9, w: 14, h: 5 }, { n: 'ห้อง 205', x: 14, y: 9, w: 14, h: 5 }, { n: 'ห้อง 206', x: 28, y: 9, w: 14, h: 5 }]
    };
    /* wf2: lab building, two computer labs separated by a concrete wall, concrete corridor wall */
    FLOORS.lab = {
      id: 'lab', name: 'อาคารปฏิบัติการคอมพิวเตอร์', W: 32, H: 20,
      walls: [].concat(box(0, 0, 32, 20, 'concrete'),
        vwall(16, 0, 12, 'concrete'), hwall(0, 32, 12, 'concrete', [13, 17]),
        hwall(0, 32, 15, 'brick', [4, 27]), vwall(9, 15, 20, 'brick'), vwall(23, 15, 20, 'brick')),
      rooms: [{ n: 'แล็บคอมพิวเตอร์ 1', x: 0, y: 0, w: 16, h: 12, req: true }, { n: 'แล็บคอมพิวเตอร์ 2', x: 16, y: 0, w: 16, h: 12, req: true },
        { n: 'ทางเดิน', x: 0, y: 12, w: 32, h: 3 }, { n: 'ห้องน้ำ', x: 0, y: 15, w: 9, h: 5 }, { n: 'ห้องเก็บของ', x: 9, y: 15, w: 14, h: 5 }, { n: 'บันได', x: 23, y: 15, w: 9, h: 5 }]
    };
    /* wf3: coffee shop in a mall; the shop is x 6..24, y 0..12; neighbours left/right and the mall walkway below */
    FLOORS.cafe = {
      id: 'cafe', name: 'ร้านกาแฟในศูนย์การค้า', W: 30, H: 16,
      walls: [].concat([[0, 0, 30, 0, 'concrete']],
        vwall(6, 0, 12, 'drywall'), vwall(24, 0, 12, 'drywall'),
        hwall(0, 6, 12, 'glass', [2]), hwall(6, 24, 12, 'glass', [14, 15]), hwall(24, 30, 12, 'glass', [27]),
        hwall(6, 11, 5, 'drywall', [9]), vwall(11, 0, 5, 'drywall')),
      rooms: [{ n: 'ร้านข้างเคียง (ซ้าย)', x: 0, y: 0, w: 6, h: 12, out: true }, { n: 'เคาน์เตอร์/ครัว', x: 6, y: 0, w: 5, h: 5 },
        { n: 'พื้นที่นั่งของร้าน', x: 6, y: 0, w: 18, h: 12, req: true, skip: { x: 6, y: 0, w: 5, h: 5 } },
        { n: 'ร้านข้างเคียง (ขวา)', x: 24, y: 0, w: 6, h: 12, out: true }, { n: 'ทางเดินศูนย์การค้า', x: 0, y: 12, w: 30, h: 4, out: true }],
      noAp: [{ x: 0, y: 0, w: 6, h: 12 }, { x: 24, y: 0, w: 6, h: 12 }, { x: 0, y: 12, w: 30, h: 4 }]
    };
    /* wf5: office wing with an elevator shaft; 4 old 2.4 GHz APs */
    FLOORS.wing = {
      id: 'wing', name: 'สำนักงาน ชั้น 4', W: 48, H: 18,
      walls: [].concat(box(0, 0, 48, 18, 'concrete'),
        hwall(0, 48, 7, 'brick', [5, 17, 29, 41]), hwall(0, 34, 11, 'brick', [5, 17, 28]), hwall(38, 48, 11, 'brick', [41]),
        vwall(12, 0, 7, 'brick'), vwall(24, 0, 7, 'brick'), vwall(36, 0, 7, 'brick'),
        vwall(12, 11, 18, 'brick'), vwall(24, 11, 18, 'brick'), box(34, 11, 4, 7, 'metal')),
      rooms: [{ n: 'ฝ่ายบุคคล', x: 0, y: 0, w: 12, h: 7, req: true }, { n: 'ฝ่ายบัญชี', x: 12, y: 0, w: 12, h: 7, req: true },
        { n: 'ห้องประชุม', x: 24, y: 0, w: 12, h: 7, req: true }, { n: 'ฝ่ายขาย', x: 36, y: 0, w: 12, h: 7, req: true },
        { n: 'ทางเดิน', x: 0, y: 7, w: 48, h: 4, req: true },
        { n: 'ฝ่ายไอที', x: 0, y: 11, w: 12, h: 7, req: true }, { n: 'ฝ่ายจัดซื้อ', x: 12, y: 11, w: 12, h: 7, req: true },
        { n: 'ห้องพักพนักงาน', x: 24, y: 11, w: 10, h: 7, req: true }, { n: 'ลิฟต์', x: 34, y: 11, w: 4, h: 7 },
        { n: 'ฝ่ายบริการลูกค้า', x: 38, y: 11, w: 10, h: 7, req: true }],
      noAp: [{ x: 34, y: 11, w: 4, h: 7 }]
    };

    /* ------------------------------------------------------------ generated office floors (wf4) */
    /* rand: () => [0,1). Returns a floor: corridor across the middle, offices above and below with drywall partitions,
       a glass meeting room, a concrete core (stairs + server room) and an elevator (metal). */
    function genOffice(rand) {
      const ri = (a, b) => a + Math.floor(rand() * (b - a + 1));
      const W = ri(48, 58), H = ri(22, 28);
      const part = rand() < 0.5 ? 'brick' : 'drywall';            // partition walls between rooms
      const cy = ri(8, H - 12), CH = 3;                 // corridor occupies y in [cy, cy + 3]
      const walls = box(0, 0, W, H, 'concrete'), rooms = [], noAp = [];
      // core below the corridor: stairs + electrical room (concrete) with the elevator shaft (metal) inside
      const coreW = 8, coreX = ri(8, W - coreW - 8), coreY = cy + CH, coreH = H - coreY;
      walls.push(...box(coreX, coreY, coreW, coreH, 'concrete'), ...box(coreX + 4, coreY, 4, 4, 'metal'));
      rooms.push({ n: 'บันได/ห้องไฟฟ้า', x: coreX, y: coreY, w: coreW, h: coreH }, { n: 'ลิฟต์', x: coreX + 4, y: coreY, w: 4, h: 4 });
      noAp.push({ x: coreX, y: coreY, w: coreW, h: coreH });
      const names = ['ฝ่ายขาย', 'ฝ่ายบัญชี', 'ฝ่ายบุคคล', 'ฝ่ายการตลาด', 'ฝ่ายจัดซื้อ', 'ฝ่ายบริการ', 'ผู้จัดการ', 'ฝ่ายผลิต', 'ฝ่ายไอที', 'ฝ่ายวางแผน'];
      let ni = ri(0, names.length - 1);
      const meetTop = rand() < 0.5;
      // a row of rooms between xa and xb, y0..y1; the wall facing the corridor is at yc (with one door per room)
      function row(xa, xb, y0, y1, yc, withMeet) {
        const cuts = [];
        let x = xa;
        while (x < xb) {
          let w = ri(7, 12);
          if (xb - (x + w) < 6) w = xb - x;
          cuts.push([x, w]); x += w;
        }
        const meet = withMeet && cuts.length > 1 ? 1 : -1;
        cuts.forEach(([x0, w], k) => {
          const glass = k === meet;
          if (k > 0) walls.push(...vwall(x0, y0, y1, glass || k - 1 === meet ? 'glass' : part));
          const door = x0 + ri(1, Math.max(1, w - 2));
          walls.push(...hwall(x0, x0 + w, yc, glass ? 'glass' : part, [Math.min(door, x0 + w - 2)]));
          rooms.push({ n: glass ? 'ห้องประชุม' : names[ni++ % names.length], x: x0, y: y0, w, h: y1 - y0, req: true });
        });
      }
      row(0, W, 0, cy, cy, meetTop);
      row(0, coreX, coreY, H, coreY, !meetTop);
      row(coreX + coreW, W, coreY, H, coreY, false);
      rooms.push({ n: 'ทางเดิน', x: 0, y: cy, w: W, h: CH, req: true });
      return { id: 'office', name: 'สำนักงาน (โจทย์สุ่ม)', W, H, walls, rooms, noAp };
    }

    return {
      MAT, PL0, N_EXP, AP_GAIN, CLIENT_GAIN, NOISE, CCA, TX, TARGET, CH24, CH5, DFS, G40, G80, WIDTHS, MAX_APS, BINS, FLOORS,
      binOf, freq, bonded, channelsFor, isDfs, chLabel, overlap, wallsCrossed, pathLoss, rssiAt, roomAt,
      requiredMask, heatmap, coverage, conflicts, snr, applyConfig, checkFloor, placeOk, snap, genOffice, inRect
    };
  }

  const WF = engine();
  if (typeof module === 'object' && module.exports) { module.exports = WF; return; }
  root.WifiPlan = WF;
  /* =====================================================================================
   * Browser UI
   * ===================================================================================== */
  const TITLE = 'ห้องปฏิบัติการวางแผน Wi-Fi';
  const DRAFT_KEY = 'nls-wifi-v1';
  const LV = { easy: 'ง่าย', medium: 'ปานกลาง', hard: 'ยาก' };
  const MODE = { guided: 'ฝึกตามขั้นตอน (Guided Lab)', independent: 'ฝึกเอง (Independent Lab)', trouble: 'ฝึกแก้ปัญหา (Troubleshooting)' };
  const PX = 8;   // canvas pixels per metre
  const SEC_TH = { open: 'Open (ไม่มีรหัสผ่าน)', wep: 'WEP', wpa: 'WPA-Personal (TKIP)', 'wpa2-tkip': 'WPA2-Personal (TKIP/AES)', wpa2: 'WPA2-Personal (AES)', mixed: 'WPA2/WPA3-Personal (Transition)', wpa3: 'WPA3-Personal (SAE)' };
  const WALL_STYLE = { concrete: 'stroke:var(--ink);stroke-width:4', brick: 'stroke:var(--brown);stroke-width:3', drywall: 'stroke:var(--muted);stroke-width:2',
    glass: 'stroke:var(--blue);stroke-width:2.5;stroke-dasharray:5 3', metal: 'stroke:var(--orange);stroke-width:6' };
  const CSS = `
.nls-wifi{color:var(--ink);max-width:1080px;margin:0 auto;min-width:0;
  --wf-h5:#FDE725;--wf-h4:#7AD151;--wf-h3:#22A884;--wf-h2:#2A788E;--wf-h1:#414487;--wf-dot:#C23B3B;--wf-dim:.38}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]) .nls-wifi{--wf-dot:#FF8A8A;--wf-dim:.3}}
:root[data-theme="dark"] .nls-wifi{--wf-dot:#FF8A8A;--wf-dim:.3}
.nls-wifi *,.nls-wifi *::before,.nls-wifi *::after{box-sizing:border-box}
.nls-wifi h2{font-size:24px;line-height:1.25;margin:0 0 6px}
.nls-wifi h3{font-size:18px;line-height:1.35;margin:0 0 8px}
.nls-wifi h4{font-size:16px;margin:12px 0 6px}
.nls-wifi p{margin:0 0 8px}
.nls-wifi-muted{color:var(--muted);font-size:15px}
.nls-wifi-small{font-size:14px}
.nls-wifi-card{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:14px 16px;margin:0 0 14px;min-width:0}
.nls-wifi-btn{background:var(--ink);color:var(--bg);border:1px solid var(--ink);border-radius:8px;padding:8px 14px;font:inherit;font-weight:600;font-size:15px;cursor:pointer;line-height:1.3;min-height:44px;min-width:44px}
.nls-wifi-btn.nls-wifi-ghost{background:transparent;color:var(--ink);border-color:var(--line)}
.nls-wifi-btn:disabled{opacity:.45;cursor:default}
.nls-wifi :focus-visible{outline:3px solid var(--blue);outline-offset:2px}
.nls-wifi-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.nls-wifi-howto summary,.nls-wifi details>summary{cursor:pointer;font-weight:600;min-height:32px}
.nls-wifi-howto ol{margin:8px 0 0;padding-left:22px;font-size:15px}
.nls-wifi-missions{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:8px;margin:0 0 14px;padding:0;list-style:none}
.nls-wifi-mbtn{width:100%;height:100%;display:flex;flex-direction:column;align-items:flex-start;text-align:left;gap:2px;background:var(--panel);color:var(--ink);border:1px solid var(--line);border-left:4px solid var(--line);border-radius:10px;padding:9px 12px;font:inherit;cursor:pointer;min-height:44px}
.nls-wifi-mbtn[data-level="easy"]{border-left-color:var(--green)}
.nls-wifi-mbtn[data-level="medium"]{border-left-color:var(--orange)}
.nls-wifi-mbtn[data-level="hard"]{border-left-color:var(--bad)}
.nls-wifi-mbtn b{font-size:15px;line-height:1.3}
.nls-wifi-mbtn span{font-size:13px;color:var(--muted)}
.nls-wifi-mbtn[aria-current="true"]{border-color:var(--blue);box-shadow:inset 0 0 0 2px var(--blue)}
.nls-wifi-mbtn .nls-wifi-best{color:var(--ok);font-weight:600}
.nls-wifi-lvl{font:600 12px "JetBrains Mono",Consolas,monospace;text-transform:uppercase;letter-spacing:.03em}
.nls-wifi-hints{margin:8px 0 0;padding-left:22px;font-size:15px}
.nls-wifi-hints li{margin:4px 0;background:var(--field);border-radius:6px;padding:4px 8px}
.nls-wifi-grid{display:grid;grid-template-columns:minmax(0,1fr);gap:0 14px}
@media (min-width:940px){.nls-wifi-grid{grid-template-columns:minmax(0,1.6fr) minmax(0,1fr)}}
.nls-wifi-scroll{overflow-x:auto;max-width:100%;-webkit-overflow-scrolling:touch}
.nls-wifi-scrollhint{display:none}
@media (max-width:640px){.nls-wifi-plan{min-width:var(--wf-minw,100%)}.nls-wifi-scrollhint{display:block}}
.nls-wifi-plan{position:relative;width:100%;background:var(--field);border:1px solid var(--line);border-radius:8px;overflow:hidden;user-select:none;-webkit-user-select:none}
.nls-wifi-plan canvas,.nls-wifi-plan svg{position:absolute;inset:0;width:100%;height:100%;display:block}
.nls-wifi-plan canvas{image-rendering:pixelated;image-rendering:crisp-edges}
.nls-wifi-room{position:absolute;font-size:12px;line-height:1.15;color:var(--ink);text-align:center;pointer-events:none;padding:2px;overflow:hidden;display:flex;align-items:flex-start;justify-content:center}
.nls-wifi-room span{background:color-mix(in srgb,var(--panel) 78%,transparent);border-radius:4px;padding:0 3px}
.nls-wifi-room.nls-wifi-out span{color:var(--muted)}
@media (max-width:640px){.nls-wifi-room{font-size:10px}}
.nls-wifi-ap{position:absolute;width:30px;height:30px;margin:-15px 0 0 -15px;border-radius:50%;border:3px solid var(--blue);background:var(--panel);color:var(--ink);font:700 11px/1 "JetBrains Mono",Consolas,monospace;
  display:flex;align-items:center;justify-content:center;padding:0;cursor:grab;touch-action:none;z-index:2}
.nls-wifi-ap::before{content:"";position:absolute;inset:-8px;border-radius:50%}
.nls-wifi-ap[data-band="2.4"]{border-color:var(--orange);border-style:double;border-width:4px}
.nls-wifi-ap[aria-pressed="true"]{box-shadow:0 0 0 3px var(--panel),0 0 0 6px var(--ink)}
.nls-wifi-ap.nls-wifi-locked{cursor:pointer}
.nls-wifi-ap.nls-wifi-drag{cursor:grabbing}
.nls-wifi-aplbl{position:absolute;transform:translate(-50%,0);margin-top:17px;font:600 11px/1.2 "JetBrains Mono",Consolas,monospace;white-space:nowrap;background:var(--panel);border:1px solid var(--line);border-radius:4px;padding:1px 4px;pointer-events:none;z-index:1}
.nls-wifi-nb{position:absolute;width:16px;height:16px;margin:-8px 0 0 -8px;border:2px solid var(--muted);background:var(--panel);transform:rotate(45deg);pointer-events:none}
.nls-wifi-nblbl{position:absolute;transform:translate(-50%,0);margin-top:10px;font:11px/1.2 "JetBrains Mono",Consolas,monospace;color:var(--muted);white-space:nowrap;pointer-events:none}
@media (max-width:640px){.nls-wifi-aplbl,.nls-wifi-nblbl{font-size:10px}.nls-wifi-ap{width:26px;height:26px;margin:-13px 0 0 -13px;font-size:10px}}
.nls-wifi-legend{display:flex;flex-wrap:wrap;gap:4px 12px;margin:8px 0 0;padding:0;list-style:none;font-size:13px}
.nls-wifi-legend li{display:flex;align-items:center;gap:5px}
.nls-wifi-sw{display:inline-block;width:18px;height:12px;border:1px solid var(--line);border-radius:2px;flex:none}
.nls-wifi-wl{display:inline-block;width:22px;height:0;flex:none}
.nls-wifi-dotk{display:inline-block;width:12px;height:12px;border:1px solid var(--line);border-radius:2px;background:radial-gradient(circle,var(--wf-dot) 0 2px,transparent 2.5px);flex:none}
.nls-wifi-chips{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 8px}
.nls-wifi-chip{min-height:44px;padding:6px 12px;border-radius:22px;border:1px solid var(--line);background:var(--field);color:var(--ink);font:inherit;font-size:15px;cursor:pointer}
.nls-wifi-chip[aria-pressed="true"]{border-color:var(--blue);background:var(--blue);color:var(--on-accent);font-weight:600}
.nls-wifi-form{display:flex;flex-wrap:wrap;gap:8px 10px;align-items:flex-end}
.nls-wifi-field{display:flex;flex-direction:column;gap:2px;min-width:0;flex:1 1 130px}
.nls-wifi-field>span{font-size:14px;color:var(--muted)}
.nls-wifi select,.nls-wifi input[type=text],.nls-wifi input[type=number],.nls-wifi input[type=password],.nls-wifi textarea{font:inherit;font-size:16px;color:var(--ink);background:var(--field);border:1px solid var(--line);border-radius:8px;padding:6px 8px;min-height:44px;width:100%;min-width:0}
.nls-wifi textarea{min-height:120px;resize:vertical}
.nls-wifi input[type=checkbox],.nls-wifi input[type=radio]{width:22px;height:22px;accent-color:var(--blue);flex:none;margin:2px 0 0}
.nls-wifi-check{display:flex;align-items:flex-start;gap:8px;min-height:44px;padding:8px 4px;cursor:pointer;font-size:15px}
.nls-wifi-pad{display:grid;grid-template-columns:repeat(3,44px);grid-template-rows:repeat(3,44px);gap:2px;flex:none}
.nls-wifi-pad button{padding:0;display:flex;align-items:center;justify-content:center}
.nls-wifi-pad svg{width:20px;height:20px;stroke:currentColor;fill:none;stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round}
.nls-wifi-big{font:700 28px/1.1 "JetBrains Mono",Consolas,monospace}
.nls-wifi-bar{height:10px;border-radius:5px;background:var(--field);border:1px solid var(--line);overflow:hidden;margin:4px 0 6px}
.nls-wifi-bar i{display:block;height:100%;background:var(--blue)}
.nls-wifi-bar i.nls-wifi-pass{background:var(--ok)}
.nls-wifi-list{margin:4px 0 0;padding-left:20px;font-size:14px}
.nls-wifi-list li{margin:3px 0}
.nls-wifi-ok{color:var(--ok);font-weight:600}
.nls-wifi-bad{color:var(--bad);font-weight:600}
.nls-wifi-practice{border-left:4px solid var(--orange);background:var(--panel);padding:8px 10px;border-radius:8px;font-weight:600;margin:8px 0}
.nls-wifi-mono{font-family:"JetBrains Mono",Consolas,monospace;font-size:13px}
.nls-wifi-probe{background:var(--field);border:1px solid var(--line);border-left:4px solid var(--blue);border-radius:8px;padding:8px 10px;font-size:14px;margin:8px 0 0}
.nls-wifi-msg{min-height:1.4em;font-size:14px;margin:6px 0 0;color:var(--muted)}
.nls-wifi-q{border-top:1px solid var(--line);padding:10px 0 4px}
.nls-wifi-q:first-of-type{border-top:0}
.nls-wifi fieldset{border:1px solid var(--line);border-radius:10px;margin:0 0 10px;padding:8px 12px;min-width:0}
.nls-wifi fieldset.nls-wifi-plain{border:0;padding:0}
.nls-wifi legend{font-weight:600;padding:0 4px}
.nls-wifi-fb{margin:8px 0 0;padding-left:22px;font-size:15px}
.nls-wifi-fb li{margin:4px 0}
.nls-wifi-score{font-size:20px;font-weight:700;margin:8px 0 0}
.nls-wifi-tag{display:inline-block;font-size:12px;border-radius:6px;padding:0 6px;border:1px solid var(--line);color:var(--muted);margin-left:4px;font-weight:400}
.nls-wifi table{border-collapse:collapse;width:100%;font-size:14px}
.nls-wifi th,.nls-wifi td{border-bottom:1px solid var(--line);padding:5px 6px;text-align:left;vertical-align:top}
.nls-wifi th{color:var(--muted);font-weight:600}
.nls-wifi td small{display:block;color:var(--muted)}
.nls-wifi-tablewrap{overflow-x:auto;max-width:100%}
.nls-wifi-sec{display:grid;grid-template-columns:minmax(0,1fr);gap:0 14px}
@media (min-width:760px){.nls-wifi-sec{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}}
.nls-wifi-sec .nls-wifi-field{flex-basis:100%}
`;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clone = o => JSON.parse(JSON.stringify(o));
  const fx = (v, d) => (Math.round(v * Math.pow(10, d || 1)) / Math.pow(10, d || 1)).toFixed(d == null ? 1 : d);
  const ARROW = { up: '<path d="M6 15l6-6 6 6"/>', down: '<path d="M6 9l6 6 6-6"/>', left: '<path d="M15 6l-6 6 6 6"/>', right: '<path d="M9 6l6 6-6 6"/>' };

  function mount(rootEl, ctx) {
    if (!document.getElementById('nls-wifi-css')) {
      const st = document.createElement('style'); st.id = 'nls-wifi-css'; st.textContent = CSS; document.head.appendChild(st);
    }
    ctx = ctx || {};
    const missions = (Array.isArray(ctx.missions) ? ctx.missions : []).filter(m => m && m.start && m.start.kind);
    const best = {};
    Object.keys(ctx.done || {}).forEach(k => { best[k] = Object.assign({}, ctx.done[k]); });
    const reduce = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    const work = {};
    let cur = missions[0] ? missions[0].id : null;
    let alive = true, drag = null, lastMid = null;
    let draft = null;
    try { draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'); } catch (e) { draft = null; }
    if (!draft || draft.v !== 1 || typeof draft.work !== 'object' || !draft.work) draft = { v: 1, mid: null, work: {} };
    if (draft.mid && missions.some(m => m.id === draft.mid)) cur = draft.mid;
    if (ctx.initial && missions.some(m => m.id === ctx.initial)) cur = ctx.initial;
    // 3.3 embedded mode (practical page): only the given mission, no mission list; the standalone's current mission (draft.mid) is kept
    const EMB = !!ctx.embedded && missions.length > 0;
    if (EMB && !missions.some(m => m.id === ctx.initial)) cur = missions[0].id;
    const timers = new Set();
    const later = (fn, ms) => { const id = setTimeout(() => { timers.delete(id); if (alive) fn(); }, ms); timers.add(id); return id; };
    const mission = () => missions.find(m => m.id === cur) || null;

    /* ---------- per-mission work ---------- */
    function W() {
      const m = mission(); if (!m) return null;
      if (work[m.id]) return work[m.id];
      const S = m.start;
      const w = { aps: clone(S.aps || []), sel: null, probe: null, answers: {}, report: '', sec: S.sec ? clone(S.sec) : null, problem: null, token: null,
        result: null, sending: false, hints: 0, msg: '', busy: false, err: '', review: null };
      const d = draft.work[m.id];
      if (d && typeof d === 'object') {
        if (S.generated && d.problem && d.token) { w.problem = d.problem; w.token = d.token; }
        if (Array.isArray(d.aps) && floorOf(m, w)) {
          const r = WF.applyConfig(startOf(m, w), { aps: d.aps });
          if (r.ok) w.aps = d.aps.map((a, i) => Object.assign({}, r.aps[i], { name: r.aps[i].name }));
        }
        if (d.answers && typeof d.answers === 'object') w.answers = d.answers;
        if (typeof d.report === 'string') w.report = d.report.slice(0, 6000);
        if (S.sec && d.sec && typeof d.sec === 'object') w.sec = Object.assign(clone(S.sec), d.sec, { staff: Object.assign({}, S.sec.staff, d.sec.staff || {}), guest: Object.assign({}, S.sec.guest, d.sec.guest || {}) });
      }
      w.sel = w.aps[0] ? w.aps[0].id : null;
      work[m.id] = w;
      return w;
    }
    function floorOf(m, w) { return m.start.floor ? WF.FLOORS[m.start.floor] : (w && w.problem ? w.problem.floor : null); }
    function rulesOf(m) { return Object.assign({}, m.start.rules || {}, m.start.generated ? { maxAps: 12 } : {}); }
    function startOf(m, w) { return { floor: floorOf(m, w), aps: m.start.aps || [], rules: rulesOf(m) }; }
    const targetOf = (m, w) => m.start.generated ? (w.problem ? w.problem.target : null) : m.start.target;
    const neighboursOf = m => m.start.neighbours || [];
    function saveDraft() {
      try {
        if (!EMB) draft.mid = cur;
        Object.keys(work).forEach(id => {
          const w = work[id];
          draft.work[id] = { aps: w.aps, answers: w.answers, report: w.report, sec: w.sec, problem: w.problem, token: w.token };
        });
        localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      } catch (e) { /* storage unavailable */ }
    }
    const selAp = w => w.aps.find(a => a.id === w.sel) || null;

    /* ---------- model cache ---------- */
    let calc = null;
    function compute() {
      const m = mission(), w = W(), floor = floorOf(m, w);
      if (!floor) { calc = null; return null; }
      const aps = w.aps.filter(a => WF.bonded(a.band, a.ch, a.width));
      const t = targetOf(m, w);
      const hm = WF.heatmap(floor, aps);
      const cov = t != null ? WF.coverage(floor, aps, t, hm) : null;
      const nb = neighboursOf(m);
      const cf = WF.conflicts(floor, aps, nb);
      calc = { floor, aps, hm, cov, cf, t, nb, req: WF.requiredMask(floor) };
      return calc;
    }

    /* ---------- rendering ---------- */
    function render() {
      const ae = document.activeElement;
      const fk = ae && rootEl.contains(ae) ? ae.getAttribute('data-fk') : null;
      const m = mission();
      const w = m ? W() : null;
      const sc0 = rootEl.querySelector('.nls-wifi-scroll'), keep = sc0 && lastMid === cur ? sc0.scrollLeft : null;
      if (m && m.start.generated && !w.problem && !w.busy && !w.err) later(newProblem, 0);
      if (m && m.start.kind !== 'security') compute(); else calc = null;
      rootEl.innerHTML = `<div class="nls-wifi${EMB ? ' nls-embedded' : ''}">${head()}${nav()}${m ? brief(m) + body(m) : '<p class="nls-wifi-muted">ยังไม่มีภารกิจ</p>'}</div>`;
      drawCanvas();
      const sc = rootEl.querySelector('.nls-wifi-scroll');
      if (sc && sc.scrollWidth > sc.clientWidth) {
        if (keep != null) sc.scrollLeft = keep;
        else { const b = rootEl.querySelector('.nls-wifi-ap[aria-pressed="true"]'); if (b) sc.scrollLeft = Math.max(0, b.offsetLeft - sc.clientWidth / 2); }
      }
      lastMid = cur;
      if (fk) { const el = rootEl.querySelector(`[data-fk="${fk}"]`); if (el && !el.disabled) el.focus({ preventScroll: true }); }
      saveDraft();
    }
    function head() {
      return `<div class="nls-wifi-card"><h2>${TITLE}</h2>
<p class="nls-wifi-muted">วางตำแหน่ง Access Point (AP) เลือกย่านความถี่ ช่องสัญญาณ (channel) ความกว้างช่อง และกำลังส่ง แล้วดูแผนที่ความแรงสัญญาณ (heatmap) และการรบกวนระหว่าง AP ที่คำนวณจากแบบจำลองการลดทอนของสัญญาณ ทุกภารกิจตรวจซ้ำที่เซิร์ฟเวอร์จากการตั้งค่าของคุณ</p>
<details class="nls-wifi-howto"><summary>วิธีใช้และแบบจำลองที่ใช้คำนวณ</summary><ol>
<li>${EMB ? 'อ่านโจทย์ของภารกิจนี้' : 'เลือกภารกิจ อ่านโจทย์'} แล้วแตะ AP (วงกลมในแผนผัง หรือปุ่มชื่อ AP) เพื่อเลือก ลาก AP เพื่อย้าย หรือใช้ปุ่มลูกศร/ปุ่มลูกศรบนแป้นพิมพ์เมื่อเลือก AP อยู่ (ย้ายทีละ 1 เมตร)</li>
<li>แตะจุดว่างบนแผนผังเพื่อดูค่าสัญญาณ ณ จุดนั้น พร้อมวิธีคำนวณและผนังที่สัญญาณผ่าน</li>
<li>ความแรงสัญญาณที่รับได้ (RSSI) = กำลังส่ง + อัตราขยายเสา AP (3 dBi) + เสาเครื่องลูกข่าย (0 dBi) − การสูญเสียตามระยะ − การสูญเสียจากผนัง</li>
<li>การสูญเสียตามระยะใช้แบบ log-distance: PL(1 m) ประมาณ 40 dB ที่ 2.4 GHz และ 47 dB ที่ 5 GHz บวก 10 × n × log10(ระยะเป็นเมตร) โดย n = 3 สำหรับในอาคาร (ค่าประมาณ)</li>
<li>AP สองตัวรบกวนกันเมื่อใช้ช่องที่ทับ/เหลื่อมกัน และตัวใดตัวหนึ่งได้ยินอีกตัวแรงกว่า -82 dBm (ค่าประมาณของเกณฑ์ CCA ที่ช่อง 20 MHz) เครื่องลูกข่ายเลือกเกาะ AP ที่แรงที่สุด</li>
<li>แบบจำลองนี้ไม่คิดการสะท้อนและการเลี้ยวเบน ค่าจริงในอาคารต้องวัดด้วยการสำรวจหน้างาน (site survey)</li></ol></details>${ctx.user ? '' : '<p class="nls-wifi-muted">ยังไม่ได้เข้าสู่ระบบ: ตรวจคะแนนได้แต่จะไม่บันทึก</p>'}</div>`;
    }
    function nav() {
      if (EMB) return '';   // embedded: no mission list
      return '<ul class="nls-wifi-missions" aria-label="รายการภารกิจ">' + missions.map(m => {
        const b = best[m.id];
        const st = b && b.best != null && (b.attempts || 0) > 0 ? `<span class="nls-wifi-best">คะแนนดีที่สุด ${b.best}/${b.max || m.max}</span>` : '<span>ยังไม่ส่ง</span>';
        return `<li><button type="button" class="nls-wifi-mbtn" data-act="mission" data-id="${esc(m.id)}" data-fk="m-${esc(m.id)}" data-level="${esc(m.level)}" aria-current="${m.id === cur}">` +
          `<span class="nls-wifi-lvl">${esc(m.id)} · ${LV[m.level] || esc(m.level)} · ส.${esc(m.week)}</span><b>${esc(m.title)}</b>${st}</button></li>`;
      }).join('') + '</ul>';
    }
    function brief(m) {
      const w = W(), hints = Array.isArray(m.hints) ? m.hints : [];
      return `<section class="nls-wifi-card" aria-labelledby="nls-wifi-mt"><h3 id="nls-wifi-mt">${esc(m.id)} · ${esc(m.title)} <span class="nls-wifi-tag">${LV[m.level] || ''}</span><span class="nls-wifi-tag">${MODE[m.mode] || esc(m.mode || '')}</span><span class="nls-wifi-tag">สัปดาห์ที่ ${esc(m.week)}</span></h3>
<p>${esc(m.desc)}</p>${problemBox(m)}<div class="nls-wifi-row">` +
        (hints.length ? `<button type="button" class="nls-wifi-btn nls-wifi-ghost" data-act="hint" data-fk="hint"${w.hints >= hints.length ? ' disabled' : ''}>คำใบ้ (${w.hints}/${hints.length})</button>` : '') +
        `<button type="button" class="nls-wifi-btn nls-wifi-ghost" data-act="reset" data-fk="reset">เริ่มภารกิจนี้ใหม่</button></div>` +
        (w.hints ? '<ol class="nls-wifi-hints">' + hints.slice(0, w.hints).map(t => `<li>${esc(t)}</li>`).join('') + '</ol>' : '') + '</section>';
    }
    function problemBox(m) {
      if (!m.start.generated) return '';
      const w = W(), p = w.problem;
      let s = '<div class="nls-wifi-probe" aria-live="polite">';
      if (w.busy) s += '<p>กำลังขอโจทย์...</p>';
      else if (w.err) s += `<p class="nls-wifi-bad">${esc(w.err)}</p>`;
      else if (p) s += `<p><b>โจทย์ของคุณ:</b> ${esc(p.floor.name)} ขนาด ${p.floor.W} × ${p.floor.H} ม. · เป้าสัญญาณ <b>${p.target} dBm</b> (${p.target === WF.TARGET.voice ? 'เสียง/วิดีโอ' : 'ข้อมูลทั่วไป'}) · ใช้ AP ได้ไม่เกิน <b>${p.budget} ตัว</b> · ความกว้างช่องอย่างน้อย <b>${p.minWidth} MHz</b> · ช่อง DFS: <b>${p.dfs ? 'ใช้ได้' : 'ห้ามใช้'}</b></p>`;
      s += `<button type="button" class="nls-wifi-btn nls-wifi-ghost" data-act="new" data-fk="new"${w.busy ? ' disabled' : ''}>โจทย์ใหม่</button></div>`;
      return s;
    }
    function body(m) {
      if (m.start.kind === 'security') return securityCard(m) + submitCard(m);
      const w = W();
      if (!floorOf(m, w)) return submitCard(m);
      return `<div class="nls-wifi-grid"><div>${planCard(m)}</div><div>${apCard(m)}${statsCard(m)}</div></div>${answersCard(m)}${submitCard(m)}`;
    }

    /* ---------- the floor plan ---------- */
    function planCard(m) {
      const w = W(), c = calc, f = c.floor;
      const pct = (v, n) => fx(100 * v / n, 3) + '%';
      let svg = '';
      // required area: thin outline of required rooms
      for (const wl of f.walls) svg += `<line x1="${wl[0]}" y1="${wl[1]}" x2="${wl[2]}" y2="${wl[3]}" style="${WALL_STYLE[wl[4]]}" vector-effect="non-scaling-stroke" stroke-linecap="square"/>`;
      // interference lines
      for (const x of c.cf) {
        if (!x.conflict) continue;
        const A = c.aps.concat(c.nb).find(a => a.id === x.a), B = c.aps.concat(c.nb).find(a => a.id === x.b);
        if (A && B) svg += `<line x1="${A.x}" y1="${A.y}" x2="${B.x}" y2="${B.y}" style="stroke:var(--bad);stroke-width:2.5;stroke-dasharray:7 5" vector-effect="non-scaling-stroke"/>`;
      }
      if (w.probe) {
        const p = w.probe, k = c.hm.who[Math.floor(p.y) * f.W + Math.floor(p.x)], A = c.aps[k];
        if (A) svg += `<line x1="${A.x}" y1="${A.y}" x2="${p.x}" y2="${p.y}" style="stroke:var(--ink);stroke-width:1.5" vector-effect="non-scaling-stroke"/>`;
        svg += `<g style="stroke:var(--ink);stroke-width:2" vector-effect="non-scaling-stroke"><line x1="${p.x - 0.8}" y1="${p.y}" x2="${p.x + 0.8}" y2="${p.y}" vector-effect="non-scaling-stroke"/><line x1="${p.x}" y1="${p.y - 0.8}" x2="${p.x}" y2="${p.y + 0.8}" vector-effect="non-scaling-stroke"/></g>`;
      }
      let html = '';
      for (const r of f.rooms) {
        html += `<div class="nls-wifi-room${r.out ? ' nls-wifi-out' : ''}" style="left:${pct(r.x, f.W)};top:${pct(r.y, f.H)};width:${pct(r.w, f.W)};height:${pct(r.h, f.H)}"><span>${esc(r.n)}</span></div>`;
      }
      for (const n of c.nb) {
        html += `<span class="nls-wifi-nb" style="left:${pct(n.x, f.W)};top:${pct(n.y, f.H)}" aria-hidden="true"></span><span class="nls-wifi-nblbl" style="left:${pct(n.x, f.W)};top:${pct(n.y, f.H)}" aria-hidden="true">${esc(n.band === '2.4' ? 'ch ' + n.ch : 'ch ' + n.ch + '/' + n.width)}</span>`;
      }
      const R = rulesOf(m);
      w.aps.forEach((a, i) => {
        const label = `${a.name} ${a.band} GHz ช่อง ${a.ch} ${a.width} MHz ${a.tx} dBm ที่ตำแหน่ง x ${a.x} y ${a.y} เมตร` + (R.lockPos ? ' (ตำแหน่งล็อก)' : ' กดลูกศรเพื่อย้าย');
        html += `<button type="button" class="nls-wifi-ap${R.lockPos ? ' nls-wifi-locked' : ''}" data-act="ap" data-id="${esc(a.id)}" data-fk="ap-${esc(a.id)}" data-band="${esc(a.band)}" aria-pressed="${w.sel === a.id}" aria-label="${esc(label)}" style="left:${pct(a.x, f.W)};top:${pct(a.y, f.H)}">${i + 1}</button>` +
          `<span class="nls-wifi-aplbl" style="left:${pct(a.x, f.W)};top:${pct(a.y, f.H)}" aria-hidden="true">${esc(a.name)} · ${esc(a.band === '2.4' ? 'ch ' + a.ch : 'ch ' + a.ch + '/' + a.width)}</span>`;
      });
      const desc = `แผนผัง ${f.name} ขนาด ${f.W} × ${f.H} เมตร มี AP ${w.aps.length} ตัว` + (c.cov ? ` พื้นที่ที่ต้องการได้ ${c.t} dBm ขึ้นไป ${c.cov.pct}%` : '');
      return `<section class="nls-wifi-card" aria-label="แผนผังและแผนที่สัญญาณ"><h3>${esc(f.name)} <span class="nls-wifi-tag">${f.W} × ${f.H} ม. · ช่องละ 1 ม.</span></h3>
<p class="nls-wifi-muted nls-wifi-small nls-wifi-scrollhint">เลื่อนแผนผังไปทางซ้าย/ขวาเพื่อดูส่วนที่เหลือ</p><div class="nls-wifi-scroll"><div class="nls-wifi-plan" data-plan style="aspect-ratio:${f.W} / ${f.H};--wf-minw:${Math.max(320, f.W * 12)}px" role="group" aria-label="${esc(desc)}"><canvas width="${f.W * PX}" height="${f.H * PX}" aria-hidden="true"></canvas>
<svg viewBox="0 0 ${f.W} ${f.H}" preserveAspectRatio="none" aria-hidden="true">${svg}</svg>${html}</div></div>
${legend(m)}<p class="nls-wifi-msg" role="status" aria-live="polite">${esc(w.msg || 'แตะจุดว่างบนแผนผังเพื่อดูค่าสัญญาณ ณ จุดนั้น')}</p>${probeBox()}</section>`;
    }
    function legend(m) {
      const c = calc;
      const bins = WF.BINS.filter(b => b.k > 0).map(b => `<li><span class="nls-wifi-sw" style="background:var(--wf-h${b.k})"></span>${esc(b.label)}</li>`).join('') +
        '<li><span class="nls-wifi-sw" style="background:var(--field)"></span>ต่ำกว่า -82</li>';
      const used = [...new Set(c.floor.walls.map(x => x[4]))];
      const walls = used.map(k => `<li><span class="nls-wifi-wl" style="border-top:${k === 'glass' ? '3px dashed var(--blue)' : k === 'concrete' ? '4px solid var(--ink)' : k === 'brick' ? '3px solid var(--brown)' : k === 'metal' ? '6px solid var(--orange)' : '2px solid var(--muted)'}"></span>${esc(WF.MAT[k].th)} ${WF.MAT[k].db} dB</li>`).join('');
      return `<ul class="nls-wifi-legend" aria-label="คำอธิบายสีแผนที่สัญญาณ (dBm)"><li><b>RSSI (dBm):</b></li>${bins}</ul>
<ul class="nls-wifi-legend" aria-label="คำอธิบายผนัง"><li><b>ผนัง (ลดสัญญาณต่อการผ่าน 1 ครั้ง, ค่าประมาณ):</b></li>${walls}</ul>
<ul class="nls-wifi-legend"><li><span class="nls-wifi-sw" style="background:var(--wf-h4);opacity:var(--wf-dim)"></span>พื้นที่จาง = ไม่นับในเป้า</li>${c.t != null ? `<li><span class="nls-wifi-dotk"></span>จุด = พื้นที่ที่ต้องการแต่ยังต่ำกว่า ${c.t} dBm</li>` : ''}<li><span class="nls-wifi-wl" style="border-top:2.5px dashed var(--bad)"></span>AP ที่รบกวนกัน</li>${c.nb.length ? '<li><span class="nls-wifi-sw" style="transform:rotate(45deg);width:11px;height:11px;border:2px solid var(--muted)"></span>AP ข้างเคียง (แก้ไขไม่ได้)</li>' : ''}<li>วงกลมเส้นคู่สีส้ม = 2.4 GHz · เส้นเดี่ยวสีน้ำเงิน = 5 GHz</li></ul>`;
    }
    function probeBox() {
      const w = W(), c = calc;
      if (!w.probe || !c.aps.length) return '';
      const p = w.probe, rows = c.aps.map(a => ({ a, r: WF.rssiAt(c.floor, a, p.x, p.y) })).sort((x, y) => y.r.rssi - x.r.rssi);
      const b = rows[0], a = b.a, r = b.r;
      const wallTxt = r.walls.length ? r.walls.map(h => `${WF.MAT[h.mat].th} ${h.db} dB`).join(', ') : 'ไม่ผ่านผนัง';
      const room = WF.roomAt(c.floor, p.x, p.y);
      const pl = WF.pathLoss(a.band, r.d);
      return `<div class="nls-wifi-probe" aria-live="polite"><p><b>จุด (${p.x}, ${p.y}) ม.${room ? ' · ' + esc(room.n) : ''}</b>: แรงที่สุดจาก <b>${esc(a.name)}</b> = <b class="nls-wifi-mono">${fx(r.rssi)} dBm</b> · SNR ประมาณ ${fx(WF.snr(r.rssi, a.width))} dB` +
        (c.t != null ? ` · ${r.rssi >= c.t ? `<span class="nls-wifi-ok">ถึงเป้า ${c.t}</span>` : `<span class="nls-wifi-bad">ต่ำกว่าเป้า ${c.t}</span>`}` : '') + `</p>
<p class="nls-wifi-mono">${a.tx} + ${WF.AP_GAIN} + ${WF.CLIENT_GAIN} − [${WF.PL0[a.band]} + 10×${WF.N_EXP}×log10(${fx(Math.max(r.d, 1), 1)})] − ${r.wallLoss} = ${a.tx + WF.AP_GAIN} − ${fx(pl)} − ${r.wallLoss} = ${fx(r.rssi)} dBm</p>
<p class="nls-wifi-small">ระยะ ${fx(r.d)} ม. · ผนังที่ผ่าน: ${esc(wallTxt)}` + (rows.length > 1 ? ` · AP อื่น: ${rows.slice(1, 4).map(x => esc(x.a.name) + ' ' + fx(x.r.rssi) + ' dBm').join(', ')}` : '') + ` · noise floor ${WF.NOISE} dBm ที่ 20 MHz (ค่าประมาณ)</p></div>`;
    }
    function drawCanvas() {
      const cv = rootEl.querySelector('.nls-wifi-plan canvas'); if (!cv || !calc) return;
      const g = cv.getContext('2d'); if (!g) return;
      const host = rootEl.querySelector('.nls-wifi');
      const cs = getComputedStyle(host);
      const col = {}; for (let k = 1; k <= 5; k++) col[k] = cs.getPropertyValue('--wf-h' + k).trim() || '#888';
      const dot = cs.getPropertyValue('--wf-dot').trim() || '#c00', dim = parseFloat(cs.getPropertyValue('--wf-dim')) || 0.35;
      const c = calc, f = c.floor;
      g.clearRect(0, 0, cv.width, cv.height);
      for (let j = 0; j < f.H; j++) for (let i = 0; i < f.W; i++) {
        const k = j * f.W + i, v = c.hm.best[k], b = WF.binOf(v);
        const out = (f.noAp || []).some(r => r.x <= i && i < r.x + r.w && r.y <= j && j < r.y + r.h) && !c.req[k];
        if (b > 0) { g.globalAlpha = c.req[k] ? 1 : dim * (out ? 0.7 : 1); g.fillStyle = col[b]; g.fillRect(i * PX, j * PX, PX, PX); }
        if (c.t != null && c.req[k] && !(v >= c.t)) { g.globalAlpha = 1; g.fillStyle = dot; g.fillRect(i * PX + 3, j * PX + 3, 2, 2); }
      }
      g.globalAlpha = 1;
    }
    /* live update while dragging: canvas + svg + AP buttons + stats, without rebuilding the page */
    function live() {
      const m = mission(); if (!m) return;
      compute();
      const plan = rootEl.querySelector('.nls-wifi-plan');
      if (!plan) return;
      const tmp = document.createElement('div');
      tmp.innerHTML = planCard(m);
      const nplan = tmp.querySelector('.nls-wifi-plan');
      plan.querySelector('svg').innerHTML = nplan.querySelector('svg').innerHTML;
      const W0 = W();
      W0.aps.forEach(a => {
        const b = plan.querySelector(`.nls-wifi-ap[data-id="${a.id}"]`), nb = nplan.querySelector(`.nls-wifi-ap[data-id="${a.id}"]`);
        if (b && nb) { b.style.left = nb.style.left; b.style.top = nb.style.top; b.setAttribute('aria-label', nb.getAttribute('aria-label')); }
      });
      const lbls = plan.querySelectorAll('.nls-wifi-aplbl'), nl = nplan.querySelectorAll('.nls-wifi-aplbl');
      lbls.forEach((l, i) => { if (nl[i]) { l.style.left = nl[i].style.left; l.style.top = nl[i].style.top; l.textContent = nl[i].textContent; } });
      const pb = rootEl.querySelector('.nls-wifi-scroll ~ .nls-wifi-probe'), npb = tmp.querySelector('.nls-wifi-probe');
      if (pb && npb) pb.innerHTML = npb.innerHTML;
      else if (!pb && npb) { const msgEl = rootEl.querySelector('.nls-wifi-scroll ~ .nls-wifi-msg'); if (msgEl) msgEl.insertAdjacentHTML('afterend', npb.outerHTML); }
      const st = rootEl.querySelector('[data-stats]');
      if (st) { const t2 = document.createElement('div'); t2.innerHTML = statsCard(m); st.innerHTML = t2.firstElementChild.innerHTML; }
      drawCanvas();
    }

    /* ---------- AP panel ---------- */
    function apCard(m) {
      const w = W(), R = rulesOf(m), a = selAp(w);
      const max = Math.min(WF.MAX_APS, R.maxAps || WF.MAX_APS);
      let s = `<section class="nls-wifi-card" aria-label="ตั้งค่า Access Point"><h3>Access Point <span class="nls-wifi-tag">${w.aps.length}${R.addRemove ? '/' + max : ''} ตัว</span></h3>
<div class="nls-wifi-chips" role="group" aria-label="เลือก AP">${w.aps.map((x, i) => `<button type="button" class="nls-wifi-chip" data-act="sel" data-id="${esc(x.id)}" data-fk="chip-${esc(x.id)}" aria-pressed="${w.sel === x.id}">${i + 1}. ${esc(x.name)}</button>`).join('')}</div>`;
      if (R.addRemove) s += `<div class="nls-wifi-row" style="margin:0 0 8px"><button type="button" class="nls-wifi-btn nls-wifi-ghost" data-act="add" data-fk="add"${w.aps.length >= max ? ' disabled' : ''}>เพิ่ม AP</button><button type="button" class="nls-wifi-btn nls-wifi-ghost" data-act="del" data-fk="del"${!a || w.aps.length <= (R.minAps || 1) ? ' disabled' : ''}>ลบ AP ที่เลือก</button></div>`;
      if (!a) return s + '<p class="nls-wifi-muted">ยังไม่ได้เลือก AP</p></section>';
      const bands = R.bands || ['2.4', '5'];
      const widths = WF.WIDTHS[a.band];
      const chs = WF.channelsFor(a.band, a.width);
      const opt = (v, cur2, txt) => `<option value="${esc(v)}"${String(v) === String(cur2) ? ' selected' : ''}>${esc(txt)}</option>`;
      const dis = k => R[k] ? ' disabled' : '';
      s += `<div class="nls-wifi-form">
<label class="nls-wifi-field"><span>ย่านความถี่</span><select data-act="band" data-fk="f-band"${dis('lockBand')}>${bands.map(b => opt(b, a.band, b + ' GHz')).join('')}</select></label>
<label class="nls-wifi-field"><span>ความกว้างช่อง</span><select data-act="width" data-fk="f-width"${dis('lockWidth')}>${widths.map(x => opt(x, a.width, x + ' MHz')).join('')}</select></label>
<label class="nls-wifi-field"><span>ช่อง (channel)</span><select data-act="ch" data-fk="f-ch">${chs.map(c => { const b = WF.bonded(a.band, c, a.width); return opt(c, a.ch, `${c}${b.length > 1 ? ` (${b[0]}–${b[b.length - 1]})` : ''} · ${WF.freq(a.band, c)} MHz${WF.isDfs(a.band, c, a.width) ? ' · DFS' : ''}`); }).join('')}</select></label>
<label class="nls-wifi-field"><span>กำลังส่ง</span><select data-act="tx" data-fk="f-tx"${dis('lockTx')}>${WF.TX.map(x => opt(x, a.tx, `${x} dBm`)).join('')}</select></label>
</div>`;
      if (!R.lockPos) {
        const btn = (dir, lbl) => `<button type="button" class="nls-wifi-btn nls-wifi-ghost" data-act="move" data-dir="${dir}" data-fk="mv-${dir}" aria-label="${lbl}"><svg viewBox="0 0 24 24" aria-hidden="true">${ARROW[dir]}</svg></button>`;
        s += `<div class="nls-wifi-row" style="margin-top:10px;align-items:center"><div class="nls-wifi-pad" role="group" aria-label="ย้าย ${esc(a.name)} ทีละ 1 เมตร"><span></span>${btn('up', 'ย้ายขึ้น 1 เมตร')}<span></span>${btn('left', 'ย้ายซ้าย 1 เมตร')}<span></span>${btn('right', 'ย้ายขวา 1 เมตร')}<span></span>${btn('down', 'ย้ายลง 1 เมตร')}<span></span></div>
<div class="nls-wifi-form" style="flex:1 1 150px"><label class="nls-wifi-field"><span>x (ม.)</span><input type="number" inputmode="decimal" step="1" min="0.5" data-act="pos" data-k="x" data-fk="f-x" value="${a.x}"></label><label class="nls-wifi-field"><span>y (ม.)</span><input type="number" inputmode="decimal" step="1" min="0.5" data-act="pos" data-k="y" data-fk="f-y" value="${a.y}"></label></div></div>`;
      } else s += `<p class="nls-wifi-muted" style="margin-top:8px">ตำแหน่ง (${a.x}, ${a.y}) ม. ล็อกไว้ในภารกิจนี้</p>`;
      if (R.lockTx || R.lockBand) s += `<p class="nls-wifi-muted nls-wifi-small">ภารกิจนี้ล็อก${[R.lockBand ? 'ย่านความถี่' : '', R.lockWidth ? 'ความกว้างช่อง' : '', R.lockTx ? 'กำลังส่ง' : ''].filter(Boolean).join(' ')}ไว้</p>`;
      s += '<p class="nls-wifi-muted nls-wifi-small">กำลังส่งสูงสุดในแล็บ 17 dBm + เสา 3 dBi = EIRP 20 dBm (100 mW) ซึ่งเป็นขีดจำกัดย่าน 2.4 GHz ในประเทศไทย ช่อง 2.4 GHz ใช้ 20 MHz ตามแนวปฏิบัติ</p>';
      return s + '</section>';
    }

    /* ---------- stats ---------- */
    function statsCard(m) {
      const w = W(), c = calc;
      let s = '<section class="nls-wifi-card" aria-label="ผลการวิเคราะห์" data-stats><h3>ผลการวิเคราะห์</h3>';
      if (c.cov) {
        const pass = c.cov.pct >= 95;
        s += `<p>พื้นที่ที่ต้องการได้ ${c.t} dBm ขึ้นไป</p><p class="nls-wifi-big ${pass ? 'nls-wifi-ok' : ''}">${c.cov.pct}%</p>
<div class="nls-wifi-bar" role="img" aria-label="${c.cov.pct}% เป้าหมาย 95%"><i class="${pass ? 'nls-wifi-pass' : ''}" style="width:${Math.min(100, c.cov.pct)}%"></i></div>
<p class="nls-wifi-small">${c.cov.ok}/${c.cov.total} ตร.ม. · เป้าหมาย 95% ขึ้นไป ${pass ? '<span class="nls-wifi-ok">ผ่าน</span>' : '<span class="nls-wifi-bad">ยังไม่ผ่าน</span>'}</p>`;
        const holes = Object.entries(c.cov.byRoom).sort((a, b) => b[1] - a[1]).slice(0, 3);
        if (holes.length) s += `<p class="nls-wifi-small">ยังต่ำกว่าเป้า: ${holes.map(([n, k]) => `${esc(n)} ${k} ตร.ม.`).join(', ')}</p>`;
      }
      if (m.start.kind === 'cafe' && c.cov) {
        const covered = c.cov.per.reduce((a, b) => a + b, 0) || 1;
        s += `<h4>ลูกค้าโดยประมาณต่อ AP (รวม ${m.start.clients} เครื่อง, ไม่เกิน ${m.start.perAp})</h4><ul class="nls-wifi-list">${c.aps.map((a, i) => { const n = Math.round(m.start.clients * c.cov.per[i] / covered); return `<li>${esc(a.name)}: ${n} เครื่อง ${n > m.start.perAp ? '<span class="nls-wifi-bad">เกิน</span>' : ''}</li>`; }).join('')}</ul>
<p class="nls-wifi-muted nls-wifi-small">ประมาณจากสัดส่วนพื้นที่ที่ AP แต่ละตัวให้สัญญาณแรงที่สุดและถึงเป้า (แนวปฏิบัติราว 25–30 อุปกรณ์ที่ใช้งานพร้อมกันต่อ radio เป็นค่าประมาณ)</p>`;
      }
      const ov = c.cf.filter(x => x.overlap);
      const all = c.aps.concat(c.nb), nm = id => { const a = all.find(x => x.id === id); return a ? a.name : id; };
      const bad = ov.filter(x => x.conflict);
      s += `<h4>การรบกวนระหว่าง AP ${bad.length ? `<span class="nls-wifi-bad">${bad.length} คู่</span>` : '<span class="nls-wifi-ok">ไม่มี</span>'}</h4>`;
      if (ov.length) s += `<div class="nls-wifi-tablewrap"><table><thead><tr><th>คู่ AP</th><th>ช่อง</th><th>ได้ยินกัน</th></tr></thead><tbody>${ov.slice(0, 14).map(x => {
        const A = all.find(a => a.id === x.a), B = all.find(a => a.id === x.b), h = Math.max(x.hearAB, x.hearBA);
        return `<tr><td>${esc(nm(x.a))} – ${esc(nm(x.b))}${x.neighbour ? '<small>AP ข้างเคียง</small>' : ''}</td><td>${esc(A.band === '2.4' ? A.ch + ' / ' + B.ch : WF.chLabel(A).replace('ช่อง ', '') + ' / ' + WF.chLabel(B).replace('ช่อง ', ''))}<small>${x.kind === 'co' ? 'ช่องเดียวกัน' : A.band === '2.4' ? 'เหลื่อมกัน (ห่าง ' + x.gap + ' ช่อง)' : 'bonding ทับกัน'}</small></td><td class="nls-wifi-mono">${fx(h)} dBm${x.conflict ? ' <span class="nls-wifi-bad">รบกวน</span>' : ' <small>ต่ำกว่า -82 ไม่รบกวน</small>'}</td></tr>`;
      }).join('')}</tbody></table></div>`;
      else s += '<p class="nls-wifi-muted nls-wifi-small">ไม่มี AP คู่ใดใช้ช่องที่ทับหรือเหลื่อมกัน</p>';
      return s + '</section>';
    }

    /* ---------- answers ---------- */
    function answersCard(m) {
      const w = W(), S = m.start;
      if (S.kind === 'cafe') {
        const q = S.questions || {};
        let s = '<section class="nls-wifi-card" aria-label="คำถาม"><h3>ตอบคำถามจากผลในแบบจำลอง</h3>';
        Object.keys(q).forEach(k => {
          s += `<fieldset class="nls-wifi-q nls-wifi-plain"><legend>${esc(q[k].q)}</legend>${q[k].options.map(o => `<label class="nls-wifi-check"><input type="radio" name="wf-q-${esc(k)}" data-act="ans" data-k="${esc(k)}" data-v="${esc(o.id)}" data-fk="q-${esc(k)}-${esc(o.id)}"${w.answers[k] === o.id ? ' checked' : ''}><span>${esc(o.th)}</span></label>`).join('')}</fieldset>`;
        });
        s += `<label class="nls-wifi-field" style="margin-top:8px"><span>เหตุผลประกอบ (ครูตรวจ): อธิบายการเลือกย่าน ช่อง ความกว้างช่อง และจำนวน AP โดยอ้างตัวเลขจากแบบจำลอง เช่น RSSI ของ AP ข้างเคียง และ % พื้นที่</span><textarea data-act="report" data-fk="report" maxlength="6000">${esc(w.report)}</textarea></label>
<div class="nls-wifi-review" aria-live="polite">${reviewHtml(m)}</div></section>`;
        return s;
      }
      if (S.kind === 'trouble') {
        const sel = Array.isArray(w.answers.causes) ? w.answers.causes : [];
        return `<section class="nls-wifi-card" aria-label="สาเหตุที่พบ"><h3>สาเหตุที่พบ (เลือกทุกข้อที่มีหลักฐานจริงในเครือข่ายเดิม)</h3>${(S.causes || []).map(c => `<label class="nls-wifi-check"><input type="checkbox" data-act="cause" data-v="${esc(c.id)}" data-fk="c-${esc(c.id)}"${sel.includes(c.id) ? ' checked' : ''}><span>${esc(c.th)}</span></label>`).join('')}
<p class="nls-wifi-muted nls-wifi-small">ถ้าแก้ไขไปแล้วและอยากดูสภาพเดิม กด "เริ่มภารกิจนี้ใหม่" (คำตอบที่เลือกจะถูกล้างด้วย)</p></section>`;
      }
      return '';
    }
    function reviewHtml(m) {
      if (!m.review) return '';
      const crit = m.review.teacher || [];
      const list = `<ul class="nls-wifi-list">${crit.map(c => `<li><b>${esc(c.title)}</b> (${esc(c.max)} คะแนน): ${esc(c.desc || '')}</li>`).join('')}</ul>`;
      const w = W(), r = w.review;
      if (!ctx.user) return `<h4>ครูตรวจเหตุผล</h4><p class="nls-wifi-muted">เข้าสู่ระบบเพื่อส่งเหตุผลให้ครูตรวจ (ผู้เยี่ยมชมตรวจคะแนนอัตโนมัติได้แต่ไม่บันทึก)</p>${list}`;
      if (!r) return `<h4>ครูตรวจเหตุผล</h4><p class="nls-wifi-muted">กำลังโหลดผลการตรวจ...</p>${list}`;
      const sub = r.submission;
      if (!sub) return `<h4>ครูตรวจเหตุผล</h4><p class="nls-wifi-muted">ยังไม่มีงานที่ส่ง เมื่อส่งงานแล้วครูจะให้คะแนนเพิ่มตามเกณฑ์นี้</p>${list}`;
      const when = x => { try { return new Date(x).toLocaleString('th-TH'); } catch (_) { return ''; } };
      if (!sub.reviewed_at) return `<h4>ครูตรวจเหตุผล</h4><p>ส่งล่าสุด ${esc(when(sub.created_at))}: คะแนนอัตโนมัติ ${esc(sub.auto_score)}/${esc(sub.auto_max)} · <b>รอครูตรวจ</b></p>${list}`;
      const ts = sub.teacher_scores || {}, cr = (r.review && r.review.teacher) || crit;
      const tot = cr.reduce((a, c) => a + (Number(ts[c.id]) || 0), 0), tmax = cr.reduce((a, c) => a + (Number(c.max) || 0), 0);
      return `<h4>ผลการตรวจจากครู</h4><p class="nls-wifi-muted">ตรวจเมื่อ ${esc(when(sub.reviewed_at))}</p><table><thead><tr><th>เกณฑ์ของครู</th><th>คะแนน</th></tr></thead><tbody>${cr.map(c => `<tr><td>${esc(c.title)}</td><td class="nls-wifi-mono">${esc(ts[c.id] !== undefined ? ts[c.id] : '-')}/${esc(c.max)}</td></tr>`).join('')}<tr><th>รวม</th><th class="nls-wifi-mono">${esc(tot)}/${esc(tmax)}</th></tr></tbody></table>${sub.teacher_comment ? `<p><b>ความเห็นของครู:</b> ${esc(sub.teacher_comment)}</p>` : ''}`;
    }
    function loadReview() {
      const m = mission(); if (!m || !m.review || !ctx.user || typeof ctx.review !== 'function') return;
      const w = W(), id = m.id;
      if (w.review) return;
      Promise.resolve().then(() => ctx.review(id)).then(r => { if (!alive) return; w.review = r || { submission: null }; const box = rootEl.querySelector('.nls-wifi-review'); if (box && cur === id) box.innerHTML = reviewHtml(m); })
        .catch(() => { if (!alive) return; w.review = { submission: null }; });
    }

    /* ---------- security (wf6) ---------- */
    function securityCard(m) {
      const w = W(), S = w.sec, modes = m.start.modes || Object.keys(SEC_TH);
      const opt = (v, cur2) => `<option value="${esc(v)}"${v === cur2 ? ' selected' : ''}>${esc(SEC_TH[v] || v)}</option>`;
      const txt = (path, val, label, fk, extra) => `<label class="nls-wifi-field"><span>${label}</span><input type="text" autocomplete="off" spellcheck="false" data-act="sec" data-path="${path}" data-fk="${fk}" value="${esc(val)}" maxlength="64"${extra || ''}></label>`;
      const chk = (path, val, label, fk) => `<label class="nls-wifi-check"><input type="checkbox" data-act="sec" data-path="${path}" data-fk="${fk}"${val ? ' checked' : ''}><span>${label}</span></label>`;
      const gdis = S.guest.on ? '' : ' disabled';
      return `<section class="nls-wifi-card" aria-label="หน้าตั้งค่า Router"><h3>หน้าตั้งค่า Wi-Fi Router ของร้าน <span class="nls-wifi-tag">จำลอง</span></h3>
<p class="nls-wifi-muted">อุปกรณ์ของร้าน: เครื่อง POS แท็บเล็ต (รองรับ WPA3) · เครื่องพิมพ์ใบเสร็จ (รองรับ WPA2 เท่านั้น) · ลูกค้า: มือถือหลายรุ่นทั้งเก่าและใหม่ · รหัสผ่านในแล็บนี้เป็นค่าฝึก อย่าใช้รหัสจริงของคุณ</p>
<div class="nls-wifi-sec"><fieldset><legend>เครือข่ายพนักงาน (Main network)</legend><div class="nls-wifi-form">
${txt('staff.ssid', S.staff.ssid, 'ชื่อเครือข่าย (SSID)', 's-ssid')}
<label class="nls-wifi-field"><span>โหมดความปลอดภัย</span><select data-act="sec" data-path="staff.sec" data-fk="s-sec">${modes.map(v => opt(v, S.staff.sec)).join('')}</select></label>
${txt('staff.pass', S.staff.pass, 'รหัสผ่าน Wi-Fi (passphrase)', 's-pass')}</div>
${chk('staff.hidden', S.staff.hidden, 'ซ่อน SSID (ไม่ประกาศชื่อใน Beacon)', 's-hid')}</fieldset>
<fieldset><legend>Guest network (สำหรับลูกค้า)</legend>
${chk('guest.on', S.guest.on, 'เปิดใช้ Guest network', 'g-on')}<div class="nls-wifi-form">
${txt('guest.ssid', S.guest.ssid, 'ชื่อเครือข่ายแขก (SSID)', 'g-ssid', gdis)}
<label class="nls-wifi-field"><span>โหมดความปลอดภัย</span><select data-act="sec" data-path="guest.sec" data-fk="g-sec"${gdis}>${modes.map(v => opt(v, S.guest.sec)).join('')}</select></label>
${txt('guest.pass', S.guest.pass, 'รหัสผ่าน Wi-Fi แขก', 'g-pass', gdis)}</div>
${chk('guest.lan', S.guest.lan, 'อนุญาตให้แขกเข้าถึงเครือข่ายภายใน (Allow guests to access local network)', 'g-lan')}
${chk('guest.isolation', S.guest.isolation, 'Client isolation (เครื่องแขกมองไม่เห็นกันเอง)', 'g-iso')}</fieldset></div>
<fieldset><legend>ตัว Router</legend><div class="nls-wifi-form">${txt('adminPass', S.adminPass, 'รหัสผ่านผู้ดูแล (admin password)', 'r-admin')}</div>
${chk('wps', S.wps, 'เปิด WPS (Wi-Fi Protected Setup: PIN และปุ่มกด)', 'r-wps')}
${chk('remote', S.remote, 'เปิด Remote management (จัดการ Router จากอินเทอร์เน็ต)', 'r-remote')}</fieldset></section>`;
    }

    /* ---------- submit ---------- */
    function submitCard(m) {
      const w = W();
      const wait = m.start.generated && !w.problem;
      let s = `<section class="nls-wifi-card" aria-label="ส่งงาน"><h3>ตรวจคำตอบ / ส่งงาน</h3><button type="button" class="nls-wifi-btn" data-act="submit" data-fk="submit"${w.sending || wait ? ' disabled' : ''}>${w.sending ? 'กำลังตรวจ…' : 'ตรวจคำตอบ / ส่งงาน'}</button><div role="status" aria-live="polite">`;
      const r = w.result;
      if (r) {
        if (r.error) s += `<p class="nls-wifi-bad">${esc(r.error)}</p>`;
        else {
          s += `<p class="nls-wifi-score ${r.score >= r.max ? 'nls-wifi-ok' : ''}">คะแนน ${r.score}/${r.max}${r.score >= r.max ? ' · ผ่าน' : ''}${r.saved && !r.practice ? ' · บันทึกแล้ว' : ''}</p>`;
          if (r.practice) s += `<p class="nls-wifi-practice" role="alert">${esc(r.message || 'โจทย์นี้ส่งไปแล้ว ผลครั้งนี้เป็นการฝึก ไม่นับคะแนน')}</p>`;
          else if (m.start.generated && ctx.user) s += '<p class="nls-wifi-muted">คะแนนของโจทย์สุ่มนับเฉพาะการส่งครั้งแรก ส่งซ้ำได้เพื่อฝึก ถ้าต้องการคะแนนใหม่ให้กด "โจทย์ใหม่"</p>';
          if (Array.isArray(r.feedback) && r.feedback.length) s += `<ul class="nls-wifi-fb">${r.feedback.map(f => `<li>${esc(f)}</li>`).join('')}</ul>`;
          if (Array.isArray(r.rubric) && r.rubric.length) s += `<div class="nls-wifi-tablewrap"><table><thead><tr><th>เกณฑ์ (ตรวจอัตโนมัติ)</th><th>คะแนน</th></tr></thead><tbody>${r.rubric.map(x => `<tr><td>${esc(x.title)}${x.note ? `<small>${esc(x.note)}</small>` : ''}</td><td class="nls-wifi-mono">${esc(x.score)}/${esc(x.max)}</td></tr>`).join('')}</tbody></table></div>`;
        }
      }
      return s + '</div></section>';
    }
    function payloadOf(m, w) {
      if (m.start.kind === 'security') return { sec: clone(w.sec) };
      const p = { aps: w.aps.map(a => ({ id: a.id, name: a.name, x: a.x, y: a.y, band: a.band, ch: a.ch, width: a.width, tx: a.tx })) };
      if (m.start.kind === 'cafe') { p.answers = clone(w.answers); p.report = w.report || ''; }
      if (m.start.kind === 'trouble') p.answers = { causes: Array.isArray(w.answers.causes) ? w.answers.causes.slice() : [] };
      return p;
    }
    async function submit() {
      const m = mission(), w = W();
      if (!m || w.sending || typeof ctx.submit !== 'function') return;
      if (m.start.generated && !w.problem) return;
      const payload = payloadOf(m, w);
      const extra = m.start.generated ? { token: w.token } : undefined;
      w.sending = true; render();
      try {
        const r = await ctx.submit(m.id, payload, extra);
        if (!alive) return;
        w.result = r || { error: 'ไม่ได้รับผลการตรวจ' };
        if (r && typeof r.score === 'number') {
          const b = best[m.id] || { best: 0, max: r.max, attempts: 0 };
          b.attempts = (b.attempts || 0) + 1; if (!r.practice) b.best = Math.max(b.best || 0, r.score); b.max = r.max; best[m.id] = b;
          if (typeof ctx.toast === 'function') ctx.toast(r.practice ? (r.message || 'ผลครั้งนี้เป็นการฝึก ไม่นับคะแนน') : `ได้ ${r.score}/${r.max} คะแนน`);
          if (m.review) w.review = null;
        }
      } catch (err) {
        if (!alive) return;
        w.result = { error: 'ส่งงานไม่สำเร็จ: ' + (err && err.message ? err.message : 'เกิดข้อผิดพลาด') };
      }
      w.sending = false; render(); loadReview();
      const el = rootEl.querySelector('.nls-wifi-score') || rootEl.querySelector('[data-act="submit"]');
      if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest', behavior: reduce() ? 'auto' : 'smooth' });
    }
    async function newProblem() {
      const m = mission(); if (!m || !m.start.generated) return;
      const id = m.id, w = W();
      if (w.busy) return;
      if (typeof ctx.newProblem !== 'function') { w.err = 'ขอโจทย์ไม่ได้ในขณะนี้'; render(); return; }
      w.busy = true; w.err = ''; render();
      try {
        const res = await ctx.newProblem(id);
        if (!alive) return;
        if (!res || !res.problem || !WF.checkFloor(res.problem.floor)) throw new Error('ไม่ได้รับโจทย์');
        Object.assign(w, { problem: res.problem, token: res.token, result: null, probe: null, msg: '' });
        const f = res.problem.floor;
        w.aps = []; addAp(m, w, f); lastMid = null;
      } catch (e) { w.err = 'ขอโจทย์ไม่สำเร็จ: ' + ((e && e.message) || 'ลองใหม่อีกครั้ง'); }
      w.busy = false;
      if (!alive) return;
      if (cur === id) render();
    }

    /* ---------- edits ---------- */
    function freeSpot(f, aps) {
      const cx = f.W / 2, cy = f.H / 2, cand = [];
      for (let y = 0.5; y < f.H; y += 1) for (let x = 0.5; x < f.W; x += 1) if (WF.placeOk(f, x, y) && !aps.some(a => a.x === x && a.y === y)) cand.push([Math.hypot(x - cx, y - cy), x, y]);
      cand.sort((a, b) => a[0] - b[0]);
      return cand.length ? { x: cand[0][1], y: cand[0][2] } : null;
    }
    function addAp(m, w, f) {
      const R = rulesOf(m), max = Math.min(WF.MAX_APS, R.maxAps || WF.MAX_APS);
      if (w.aps.length >= max) return;
      let n = 1; while (w.aps.some(a => a.id === 'ap' + n)) n++;
      const spot = freeSpot(f, w.aps); if (!spot) return;
      const band = (R.bands || ['5', '2.4']).includes('5') ? '5' : '2.4';
      const width = w.problem && band === '5' ? w.problem.minWidth : 20;
      const used = new Set(w.aps.map(a => a.band + ':' + a.ch));
      const ch = WF.channelsFor(band, width).find(c => !used.has(band + ':' + c) && (band !== '5' || !w.problem || w.problem.dfs || !WF.isDfs(band, c, width))) || WF.channelsFor(band, width)[0];
      const pre = m.start.kind === 'cafe' ? 'CAFE-' : 'AP-';
      w.aps.push({ id: 'ap' + n, name: pre + n, x: spot.x, y: spot.y, band, ch, width, tx: 17 });
      w.sel = 'ap' + n;
      w.msg = `เพิ่ม ${pre + n} ที่ (${spot.x}, ${spot.y}) ม. ลากไปวางตำแหน่งที่ต้องการ`;
    }
    function moveAp(w, a, x, y, f) {
      x = WF.snap(Math.max(0.01, Math.min(f.W - 0.01, x))); y = WF.snap(Math.max(0.01, Math.min(f.H - 0.01, y)));
      if (!WF.placeOk(f, x, y)) { w.msg = 'ติดตั้ง AP ตรงนั้นไม่ได้ (นอกอาคาร พื้นที่ร้านอื่น หรือในปล่องลิฟต์/แกนอาคาร)'; return false; }
      if (a.x === x && a.y === y) return false;
      a.x = x; a.y = y; w.result = null;
      w.msg = `${a.name} อยู่ที่ (${x}, ${y}) ม.`;
      return true;
    }
    function setBand(a, band) {
      a.band = band;
      if (!WF.WIDTHS[band].includes(a.width)) a.width = 20;
      if (!WF.bonded(band, a.ch, a.width)) a.ch = WF.channelsFor(band, a.width)[0];
    }

    function onClick(ev) {
      const t = ev.target.closest('[data-act]');
      if (!t || !rootEl.contains(t)) return;
      const act = t.getAttribute('data-act');
      if (t.tagName === 'SELECT' || (t.tagName === 'INPUT') || t.tagName === 'TEXTAREA') return;
      if (act === 'mission') {
        if (EMB) return;
        cur = t.getAttribute('data-id'); render(); loadReview();
        const h = rootEl.querySelector('#nls-wifi-mt'); if (h) h.scrollIntoView({ block: 'start', behavior: reduce() ? 'auto' : 'smooth' });
        return;
      }
      const m = mission(); if (!m) return;
      const w = W();
      if (act === 'hint') w.hints++;
      else if (act === 'reset') {
        if (!window.confirm('เริ่มภารกิจนี้ใหม่? การตั้งค่าและคำตอบของภารกิจนี้จะกลับเป็นค่าเริ่มต้น')) return;
        const keep = m.start.generated ? { problem: w.problem, token: w.token } : null;
        delete work[cur]; delete draft.work[cur];
        const w2 = W();
        if (keep && keep.problem) { Object.assign(w2, keep); w2.aps = []; addAp(m, w2, keep.problem.floor); w2.msg = ''; }
      }
      else if (act === 'new') { newProblem(); return; }
      else if (act === 'sel' || act === 'ap') { if (drag && drag.moved) return; w.sel = t.getAttribute('data-id'); const a = selAp(w); w.msg = a ? `เลือก ${a.name} (${WF.chLabel(a)}, ${a.tx} dBm)` : ''; }
      else if (act === 'add') { addAp(m, w, floorOf(m, w)); w.result = null; }
      else if (act === 'del') {
        const R = rulesOf(m); if (!R.addRemove || w.aps.length <= (R.minAps || 1)) return;
        const a = selAp(w); if (!a) return;
        w.aps = w.aps.filter(x => x !== a); w.sel = w.aps[0] ? w.aps[0].id : null; w.msg = `ลบ ${a.name} แล้ว`; w.result = null;
      }
      else if (act === 'move') {
        const a = selAp(w), R = rulesOf(m); if (!a || R.lockPos) return;
        const d = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[t.getAttribute('data-dir')];
        moveAp(w, a, a.x + d[0], a.y + d[1], floorOf(m, w));
      }
      else if (act === 'submit') { submit(); return; }
      else return;
      render();
    }
    function onChange(ev) {
      const t = ev.target, act = t.getAttribute && t.getAttribute('data-act');
      const m = mission(); if (!act || !m) return;
      const w = W(), a = selAp(w), R = rulesOf(m);
      if (act === 'band' && a && !R.lockBand) { setBand(a, t.value); w.result = null; w.msg = `${a.name}: ย่าน ${a.band} GHz ${WF.chLabel(a)}`; }
      else if (act === 'width' && a && !R.lockWidth) { const v = Number(t.value); if (WF.WIDTHS[a.band].includes(v)) { a.width = v; if (!WF.bonded(a.band, a.ch, v)) a.ch = WF.channelsFor(a.band, v).find(c => WF.bonded(a.band, a.ch, 20) && WF.bonded(a.band, c, v).includes(a.ch)) || WF.channelsFor(a.band, v)[0]; w.result = null; w.msg = `${a.name}: ${WF.chLabel(a)}`; } }
      else if (act === 'ch' && a) { const v = Number(t.value); if (WF.bonded(a.band, v, a.width)) { a.ch = v; w.result = null; w.msg = `${a.name}: ${WF.chLabel(a)}`; } }
      else if (act === 'tx' && a && !R.lockTx) { const v = Number(t.value); if (WF.TX.includes(v)) { a.tx = v; w.result = null; w.msg = `${a.name}: กำลังส่ง ${v} dBm`; } }
      else if (act === 'pos' && a && !R.lockPos) {
        const v = Number(t.value), k = t.getAttribute('data-k');
        if (!isFinite(v)) { w.msg = 'ตำแหน่งต้องเป็นตัวเลข (เมตร)'; }
        else moveAp(w, a, k === 'x' ? v : a.x, k === 'y' ? v : a.y, floorOf(m, w));
      }
      else if (act === 'ans') { w.answers[t.getAttribute('data-k')] = t.getAttribute('data-v'); saveDraft(); return; }
      else if (act === 'cause') {
        const s = new Set(Array.isArray(w.answers.causes) ? w.answers.causes : []), v = t.getAttribute('data-v');
        if (t.checked) s.add(v); else s.delete(v);
        w.answers.causes = [...s]; saveDraft(); return;
      }
      else if (act === 'sec') {
        const path = t.getAttribute('data-path').split('.');
        let o = w.sec; for (let i = 0; i < path.length - 1; i++) o = o[path[i]];
        const k = path[path.length - 1];
        o[k] = t.type === 'checkbox' ? t.checked : String(t.value).slice(0, 64);
        w.result = null;
        if (path.join('.') === 'guest.on') { render(); return; }
        saveDraft(); return;
      }
      else return;
      render();
    }
    function onInput(ev) {
      const t = ev.target, act = t.getAttribute && t.getAttribute('data-act');
      const m = mission(); if (!m) return;
      if (act === 'report') { W().report = t.value.slice(0, 6000); saveDraft(); }
      else if (act === 'sec' && t.type === 'text') { const w = W(), path = t.getAttribute('data-path').split('.'); let o = w.sec; for (let i = 0; i < path.length - 1; i++) o = o[path[i]]; o[path[path.length - 1]] = t.value.slice(0, 64); saveDraft(); }
    }
    function onKey(ev) {
      const t = ev.target;
      if (!t.classList || !t.classList.contains('nls-wifi-ap')) return;
      const d = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }[ev.key];
      if (!d) return;
      const m = mission(), w = W(), R = rulesOf(m);
      ev.preventDefault();
      w.sel = t.getAttribute('data-id');
      const a = selAp(w);
      if (!a) return;
      if (R.lockPos) { w.msg = 'ตำแหน่ง AP ล็อกไว้ในภารกิจนี้'; render(); return; }
      moveAp(w, a, a.x + d[0], a.y + d[1], floorOf(m, w));
      render();
    }
    /* pointer: drag APs, tap the plan to probe */
    function planXY(ev) {
      const plan = rootEl.querySelector('.nls-wifi-plan'); if (!plan) return null;
      const r = plan.getBoundingClientRect(), f = calc && calc.floor; if (!f || !r.width) return null;
      return { x: (ev.clientX - r.left) / r.width * f.W, y: (ev.clientY - r.top) / r.height * f.H };
    }
    function onDown(ev) {
      const m = mission(); if (!m || m.start.kind === 'security') return;
      const apBtn = ev.target.closest && ev.target.closest('.nls-wifi-ap');
      const plan = ev.target.closest && ev.target.closest('.nls-wifi-plan');
      if (!plan) return;
      const w = W();
      if (apBtn) {
        const R = rulesOf(m);
        w.sel = apBtn.getAttribute('data-id');
        if (R.lockPos) return;
        drag = { id: w.sel, x0: ev.clientX, y0: ev.clientY, moved: false, pid: ev.pointerId, el: apBtn };
        try { apBtn.setPointerCapture(ev.pointerId); } catch (e) { /* ignore */ }
        apBtn.classList.add('nls-wifi-drag');
        return;
      }
      if (ev.button !== undefined && ev.button !== 0) return;
      const p = planXY(ev); if (!p) return;
      const f = calc.floor;
      w.probe = { x: WF.snap(Math.max(0.01, Math.min(f.W - 0.01, p.x))), y: WF.snap(Math.max(0.01, Math.min(f.H - 0.01, p.y))) };
      w.msg = '';
      live();
    }
    function onMove(ev) {
      if (!drag || ev.pointerId !== drag.pid) return;
      if (!drag.moved && Math.hypot(ev.clientX - drag.x0, ev.clientY - drag.y0) < 5) return;
      drag.moved = true;
      ev.preventDefault();
      const m = mission(), w = W(), a = w.aps.find(x => x.id === drag.id), p = planXY(ev);
      if (!a || !p) return;
      if (moveAp(w, a, p.x, p.y, calc.floor)) live();
    }
    function onUp(ev) {
      if (!drag || ev.pointerId !== drag.pid) return;
      const d = drag;
      try { d.el.releasePointerCapture(d.pid); } catch (e) { /* ignore */ }
      if (d.moved) { later(() => { drag = null; }, 0); render(); const b = rootEl.querySelector(`.nls-wifi-ap[data-id="${d.id}"]`); if (b) b.focus({ preventScroll: true }); }
      else { drag = null; }
    }

    rootEl.addEventListener('click', onClick);
    rootEl.addEventListener('change', onChange);
    rootEl.addEventListener('input', onInput);
    rootEl.addEventListener('keydown', onKey);
    rootEl.addEventListener('pointerdown', onDown);
    rootEl.addEventListener('pointermove', onMove);
    rootEl.addEventListener('pointerup', onUp);
    rootEl.addEventListener('pointercancel', onUp);
    render();
    loadReview();
    return {
      destroy() {
        alive = false;
        timers.forEach(id => clearTimeout(id)); timers.clear(); drag = null;
        rootEl.removeEventListener('click', onClick);
        rootEl.removeEventListener('change', onChange);
        rootEl.removeEventListener('input', onInput);
        rootEl.removeEventListener('keydown', onKey);
        rootEl.removeEventListener('pointerdown', onDown);
        rootEl.removeEventListener('pointermove', onMove);
        rootEl.removeEventListener('pointerup', onUp);
        rootEl.removeEventListener('pointercancel', onUp);
        rootEl.innerHTML = '';
      }
    };
  }

  root.NL_SIMS = root.NL_SIMS || {};
  root.NL_SIMS.wifi = { title: TITLE, mount };
})(typeof window !== 'undefined' ? window : this);

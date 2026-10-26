'use strict';
/*
 * NL_SYS - accounts, groups, shared folders and permissions for the terminal simulator (UMD, no DOM).
 * Browser: window.NL_SYS (used by NL_TERM below). Node: require('public/js/sim/terminal.js') returns this object, so the
 * server grader (server/sims/terminal.js) replays the student's commands with exactly the same code.
 *
 * State lives on the topology device: device.sys = { kind:'windows'|'linux', ... } (created on first use when a mission
 * does not define it). Commands mutate net.topo in place; a network reset rebuilds the topology, so the state resets too.
 *
 * Windows (cmd.exe): net user | net localgroup | net share | net use | net view | net helpmsg, icacls, cd/chdir, X:, dir,
 *   type, del/erase, echo text > file.  Effective access over the network = Share permission AND NTFS permission (the
 *   more restrictive wins). NTFS evaluation walks the ACL in canonical order (explicit deny, explicit allow, inherited
 *   deny, inherited allow); each right is decided by the first ACE that mentions it. Inheritance follows (OI)(CI)(IO)(NP).
 * Linux (bash): useradd, adduser, usermod, userdel, deluser, groupadd, groupdel, gpasswd, passwd, id, groups, getent,
 *   chmod, chown, chgrp, ls, mkdir, touch, cd, pwd, cat /etc/passwd|group|shadow, sudo [-u user].
 * Simplifications (said in the UI hints where they matter): passwords are not stored (only "set or not"), interactive
 *   prompts are answered automatically, no ACL on Linux (rwx + owner/group only), no UAC remote token filtering,
 *   no CREATOR OWNER evaluation, no Windows file attributes.
 */
(function (root, factory) {
  const E = factory();
  if (typeof module === 'object' && module.exports) module.exports = E;
  else if (root) root.NL_SYS = E;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const VERSION = '1.0.0';
  const clone = x => JSON.parse(JSON.stringify(x));
  const lc = s => String(s == null ? '' : s).toLowerCase();
  const padE = (s, n) => { s = String(s); return s.length >= n ? s + ' ' : s + ' '.repeat(n - s.length); };
  const padS = (s, n) => { s = String(s); return s.length >= n ? s : ' '.repeat(n - s.length) + s; };
  const HINT = t => ({ t, cls: 'nls-terminal-hint' });
  const OK = 'The command completed successfully.';
  const BASE = '2026-09-01T08:00:00';
  const isIp = s => /^\d{1,3}(\.\d{1,3}){3}$/.test(s) && s.split('.').every(n => +n < 256);
  const nowIso = () => { try { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 19); } catch (e) { return BASE; } };
  const dayNo = iso => Math.floor(Date.parse(String(iso || BASE).slice(0, 10) + 'T00:00:00Z') / 86400000);
  const comma = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  // ------------------------------------------------------------------ tokenizers
  // cmd.exe: whitespace outside double quotes separates arguments; the quotes themselves are removed
  function cmdSplit(line) {
    const out = []; let cur = '', q = false, has = false;
    for (const ch of String(line || '')) {
      if (ch === '"') { q = !q; has = true; continue; }
      if (!q && /\s/.test(ch)) { if (has) out.push(cur); cur = ''; has = false; continue; }
      cur += ch; has = true;
    }
    if (has) out.push(cur);
    return out;
  }
  // bash: '...' and "..." quoting, backslash escapes outside single quotes
  function shSplit(line) {
    const out = []; let cur = '', q = null, has = false; const s = String(line || '');
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (q === "'") { if (ch === "'") q = null; else cur += ch; continue; }
      if (q === '"') { if (ch === '"') q = null; else if (ch === '\\' && i + 1 < s.length && /["\\$`]/.test(s[i + 1])) cur += s[++i]; else cur += ch; continue; }
      if (ch === "'" || ch === '"') { q = ch; has = true; continue; }
      if (ch === '\\' && i + 1 < s.length) { cur += s[++i]; has = true; continue; }
      if (/\s/.test(ch)) { if (has) out.push(cur); cur = ''; has = false; continue; }
      cur += ch; has = true;
    }
    if (has) out.push(cur);
    return out;
  }
  function firstStage(line) {
    let q = null; const s = String(line || '');
    for (let i = 0; i < s.length; i++) { const ch = s[i]; if (q) { if (ch === q) q = null; continue; } if (ch === '"' || ch === "'") q = ch; else if (ch === '|') return s.slice(0, i).trim(); }
    return s.trim();
  }
  // "sudo [-u user] cmd ..." -> { t: tokens of cmd, root, user, sudo, err }
  function sudoSplit(t, user) {
    if (t[0] !== 'sudo') return { t, root: user === 'root', user, sudo: false };
    let i = 1, as = 'root';
    while (i < t.length && /^-/.test(t[i])) {
      if (t[i] === '-u' && t[i + 1]) { as = t[i + 1]; i += 2; continue; }
      const m = /^-u(.+)$/.exec(t[i]); if (m) { as = m[1]; i++; continue; }
      i++;
    }
    return { t: t.slice(i), root: as === 'root', user: as, sudo: true };
  }

  // ------------------------------------------------------------------ devices / state
  function devOf(net, id) { return net && net.topo && Array.isArray(net.topo.devices) ? net.topo.devices.find(d => d.id === id) : null; }
  function hostIpOf(net, d) {
    const c = net && typeof net.config === 'function' ? net.config(d.id) : null;
    if (c && c.ip) return c.ip;
    const f = (d.ifaces || []).find(x => x && x.ip); return f ? f.ip : null;
  }
  function osOfDev(d) { return d && /linux|ubuntu|debian/.test(lc(d.os)) ? 'linux' : (d && d.type === 'printer' ? 'linux' : 'windows'); }
  function sysOf(net, id, os, user) {
    const d = devOf(net, id); if (!d) return null;
    const kind = os || osOfDev(d);
    if (!d.sys || typeof d.sys !== 'object' || d.sys.kind !== kind) d.sys = kind === 'linux' ? LX.make({ host: d.name || id }, user) : WIN.make({ host: d.name || id, server: d.type === 'server' }, user);
    return d.sys;
  }

  // ================================================================== WINDOWS
  const WIN = {};
  const BUILTIN_GROUPS = [
    ['Access Control Assistance Operators', ''], ['Administrators', 'Administrators have complete and unrestricted access to the computer/domain'],
    ['Backup Operators', 'Backup Operators can override security restrictions for the sole purpose of backing up or restoring files'],
    ['Cryptographic Operators', ''], ['Device Owners', ''], ['Distributed COM Users', ''], ['Event Log Readers', ''],
    ['Guests', 'Guests have the same access as members of the Users group by default, except for the Guest account which is further restricted'],
    ['Hyper-V Administrators', ''], ['IIS_IUSRS', 'Built-in group used by Internet Information Services.'], ['Network Configuration Operators', ''],
    ['Performance Log Users', ''], ['Performance Monitor Users', ''], ['Power Users', 'Power Users are included for backwards compatibility and possess limited administrative powers'],
    ['Remote Desktop Users', 'Members in this group are granted the right to logon remotely'], ['Remote Management Users', ''], ['Replicator', 'Supports file replication in a domain'],
    ['System Managed Accounts Group', ''], ['Users', 'Users are prevented from making accidental or intentional system-wide changes and can run most applications']
  ];
  const BUILTIN_USERS = [
    { name: 'Administrator', comment: 'Built-in account for administering the computer/domain', active: false, builtin: true },
    { name: 'DefaultAccount', comment: 'A user account managed by the system.', active: false, builtin: true, pwReq: false, pwNever: true },
    { name: 'Guest', comment: 'Built-in account for guest access to the computer/domain', active: false, builtin: true, pwReq: false, pwNever: true, chg: false },
    { name: 'WDAGUtilityAccount', comment: 'A user account managed and used by the system for Windows Defender Application Guard scenarios.', active: false, builtin: true }
  ];
  // well-known principals (canonical display name)
  const WELL = { 'everyone': 'Everyone', 'creator owner': 'CREATOR OWNER', 'system': 'NT AUTHORITY\\SYSTEM', 'nt authority\\system': 'NT AUTHORITY\\SYSTEM',
    'authenticated users': 'NT AUTHORITY\\Authenticated Users', 'nt authority\\authenticated users': 'NT AUTHORITY\\Authenticated Users',
    'interactive': 'NT AUTHORITY\\INTERACTIVE', 'nt authority\\interactive': 'NT AUTHORITY\\INTERACTIVE', 'network': 'NT AUTHORITY\\NETWORK', 'nt authority\\network': 'NT AUTHORITY\\NETWORK',
    '*s-1-1-0': 'Everyone', '*s-1-5-18': 'NT AUTHORITY\\SYSTEM', '*s-1-5-11': 'NT AUTHORITY\\Authenticated Users', '*s-1-3-0': 'CREATOR OWNER',
    '*s-1-5-32-544': 'BUILTIN\\Administrators', '*s-1-5-32-545': 'BUILTIN\\Users', '*s-1-5-32-546': 'BUILTIN\\Guests' };
  // NTFS rights as bits: R read/list 1, X execute/traverse 2, W write/create 4, D delete 8, P change permissions 16, O take ownership 32
  const RB = { F: 63, M: 15, RX: 3, R: 1, W: 4, D: 8, N: 0, X: 2, DE: 8, RD: 1, WD: 4, AD: 4, WDAC: 16, WO: 32, GR: 1, GW: 4, GE: 2, GA: 63 };
  const SHARE_BITS = { READ: 3, CHANGE: 15, FULL: 63 };
  const bitsOf = rights => (rights || []).reduce((a, r) => a | (RB[r] || 0), 0);

  WIN.make = function (spec, sessionUser) {
    spec = spec || {};
    const host = String(spec.host || 'PC').toUpperCase();
    const s = { kind: 'windows', v: 1, host, server: !!spec.server, users: [], groups: [], shares: [], fs: {}, drives: [], persist: true, cwd: null, vols: spec.vols || ['C:'] };
    BUILTIN_USERS.forEach(u => s.users.push(Object.assign({ full: '', active: false, pwReq: true, chg: true, pwSet: BASE }, clone(u))));
    BUILTIN_GROUPS.forEach(([n, c]) => s.groups.push({ name: n, comment: c, builtin: true, members: [] }));
    const G = n => s.groups.find(g => lc(g.name) === lc(n));
    G('Administrators').members.push('Administrator');
    G('Guests').members.push('Guest');
    G('Users').members.push('NT AUTHORITY\\INTERACTIVE', 'NT AUTHORITY\\Authenticated Users');
    G('System Managed Accounts Group').members.push('DefaultAccount');
    (spec.groups || []).forEach(g => {
      let x = G(g.name);
      if (!x) { x = { name: g.name, comment: g.comment || '', builtin: false, members: [] }; s.groups.push(x); }
      else if (g.comment !== undefined) x.comment = g.comment;
    });
    const addUser = u => {
      let x = s.users.find(y => lc(y.name) === lc(u.name));
      if (!x) { x = { name: u.name, full: '', comment: '', active: true, pwReq: true, chg: true, pwSet: BASE }; s.users.push(x); G('Users').members.push(u.name); }
      ['full', 'comment', 'active', 'pwReq', 'chg', 'pwSet', 'pwNever'].forEach(k => { if (u[k] !== undefined) x[k] = u[k]; });
      (u.groups || []).forEach(gn => { const g = G(gn); if (g && !g.members.some(m => lc(m) === lc(u.name))) g.members.push(x.name); });
    };
    (spec.users || []).forEach(addUser);
    if (sessionUser && !s.users.some(u => lc(u.name) === lc(sessionUser))) addUser({ name: sessionUser, groups: /^administrator$/i.test(sessionUser) ? [] : [] });
    if (sessionUser && /^administrator$/i.test(sessionUser)) s.users.find(u => u.name === 'Administrator').active = true;
    // volumes: C: always; D: when listed
    const vols = s.vols.map(v => v.toUpperCase());
    s.vols = vols;
    const put = (p, o) => { const k = lc(p); s.fs[k] = Object.assign({ path: p, dir: true, acl: [], protect: false, mtime: BASE }, s.fs[k] || {}, o); };
    put('C:\\', { protect: true, acl: ['BUILTIN\\Administrators:(OI)(CI)(F)', 'NT AUTHORITY\\SYSTEM:(OI)(CI)(F)', 'BUILTIN\\Users:(OI)(CI)(RX)'].map(parseAceText) });
    put('C:\\Windows', { protect: true, acl: ['NT AUTHORITY\\SYSTEM:(OI)(CI)(F)', 'BUILTIN\\Administrators:(OI)(CI)(F)', 'BUILTIN\\Users:(OI)(CI)(RX)'].map(parseAceText) });
    put('C:\\Windows\\System32', {});
    put('C:\\Users', { protect: true, acl: ['NT AUTHORITY\\SYSTEM:(OI)(CI)(F)', 'BUILTIN\\Administrators:(OI)(CI)(F)', 'BUILTIN\\Users:(RX)', 'Everyone:(RX)'].map(parseAceText) });
    if (vols.includes('D:')) put('D:\\', { protect: true, acl: ['NT AUTHORITY\\Authenticated Users:(OI)(CI)(M)', 'NT AUTHORITY\\SYSTEM:(OI)(CI)(F)', 'BUILTIN\\Administrators:(OI)(CI)(F)', 'BUILTIN\\Users:(OI)(CI)(RX)'].map(parseAceText) });
    s.users.filter(u => !u.builtin && u.name !== 'Administrator').concat(sessionUser ? [{ name: sessionUser }] : []).forEach(u => {
      put('C:\\Users\\' + u.name, { protect: true, acl: ['NT AUTHORITY\\SYSTEM:(OI)(CI)(F)', 'BUILTIN\\Administrators:(OI)(CI)(F)', host + '\\' + u.name + ':(OI)(CI)(F)'].map(parseAceText) });
    });
    if (sessionUser && /^administrator$/i.test(sessionUser)) put('C:\\Users\\Administrator', { protect: true, acl: ['NT AUTHORITY\\SYSTEM:(OI)(CI)(F)', 'BUILTIN\\Administrators:(OI)(CI)(F)'].map(parseAceText) });
    (spec.dirs || []).forEach(d => {
      const parts = d.path.split('\\'); for (let i = 2; i < parts.length; i++) { const p = parts.slice(0, i).join('\\'); if (!s.fs[lc(p)]) put(p, {}); }
      put(d.path, { protect: !!d.protect, acl: (d.acl || []).map(parseAceText), mtime: d.mtime || BASE });
    });
    (spec.files || []).forEach(f => { s.fs[lc(f.path)] = { path: f.path, dir: false, acl: (f.acl || []).map(parseAceText), protect: !!f.protect, size: f.size || 0, mtime: f.mtime || BASE, owner: f.owner || 'Administrators', content: f.content || '' }; });
    s.shares.push({ name: 'ADMIN$', path: 'C:\\Windows', remark: 'Remote Admin', special: true, grants: [['BUILTIN\\Administrators', 'FULL']] });
    vols.forEach(v => s.shares.push({ name: v[0] + '$', path: v + '\\', remark: 'Default share', special: true, grants: [['BUILTIN\\Administrators', 'FULL']] }));
    s.shares.push({ name: 'IPC$', path: '', remark: 'Remote IPC', special: true, ipc: true, grants: [['Everyone', 'READ']] });
    (spec.shares || []).forEach(sh => s.shares.push({ name: sh.name, path: sh.path, remark: sh.remark || '', grants: (sh.grants || [['Everyone', 'READ']]).map(g => [canonPrincipal(s, g[0]) || g[0], g[1]]), print: !!sh.print }));
    (spec.drives || []).forEach(dv => s.drives.push({ local: dv.local ? dv.local.toUpperCase() : '', remote: dv.remote, persistent: dv.persistent !== false }));
    if (spec.persist === false) s.persist = false;
    return s;
  };

  // ---- principals
  const userOf = (s, n) => s.users.find(u => lc(u.name) === lc(n));
  const groupOf = (s, n) => s.groups.find(g => lc(g.name) === lc(n));
  function canonPrincipal(s, raw) {
    let n = String(raw || '').trim(); if (!n) return null;
    const k = lc(n);
    if (WELL[k]) return WELL[k];
    let m = /^(builtin)\\(.+)$/i.exec(n);
    if (m) { const g = groupOf(s, m[2]); return g && g.builtin ? 'BUILTIN\\' + g.name : null; }
    m = /^([^\\]+)\\(.+)$/.exec(n);
    if (m) { if (m[1] === '.' || lc(m[1]) === lc(s.host)) n = m[2]; else return null; }
    const u = userOf(s, n); if (u) return s.host + '\\' + u.name;
    const g = groupOf(s, n); if (g) return (g.builtin ? 'BUILTIN\\' : s.host + '\\') + g.name;
    return null;
  }
  const shortName = (s, sid) => { const m = /^([^\\]+)\\(.+)$/.exec(sid); return m && (lc(m[1]) === lc(s.host) || m[1] === 'BUILTIN') ? m[2] : sid; };
  // every SID in the access token of a local account. logon: 'local' | 'network'; elevated: false drops Administrators (UAC)
  function tokenOf(s, user, logon, elevated) {
    const u = userOf(s, user); if (!u) return new Set(['everyone']);
    const sids = new Set(['everyone', 'nt authority\\authenticated users', lc(s.host + '\\' + u.name)]);
    sids.add(logon === 'network' ? 'nt authority\\network' : 'nt authority\\interactive');
    s.groups.forEach(g => {
      const hit = g.members.some(m => lc(m) === lc(u.name) || lc(m) === lc(s.host + '\\' + u.name) || sids.has(lc(WELL[lc(m)] || m)));
      if (hit) sids.add(lc((g.builtin ? 'BUILTIN\\' : s.host + '\\') + g.name));
    });
    if (elevated === false) sids.delete('builtin\\administrators');
    return sids;
  }

  // ---- ACEs: { sid, deny, rights:[tokens], oi, ci, io, np, inh }
  function parseAceText(txt) {
    const m = /^(.*?):((?:\((?:OI|CI|IO|NP|I|DENY)\))*)\(?([A-Z,]+)\)?$/i.exec(String(txt).trim());
    if (!m) throw new Error('bad ACE ' + txt);
    const fl = lc(m[2]);
    return { sid: m[1], deny: fl.includes('(deny)'), rights: m[3].toUpperCase().split(','), oi: fl.includes('(oi)'), ci: fl.includes('(ci)'), io: fl.includes('(io)'), np: fl.includes('(np)'), inh: fl.includes('(i)') };
  }
  const aceText = a => `${a.sid}:${a.inh ? '(I)' : ''}${a.oi ? '(OI)' : ''}${a.ci ? '(CI)' : ''}${a.io ? '(IO)' : ''}${a.np ? '(NP)' : ''}${a.deny ? '(DENY)' : ''}(${a.rights.join(',')})`;
  const sameFlags = (a, b) => !!a.oi === !!b.oi && !!a.ci === !!b.ci && !!a.io === !!b.io && !!a.np === !!b.np;
  function canonical(list) {
    const cat = a => (a.inh ? 2 : 0) + (a.deny ? 0 : 1);
    return list.map((a, i) => [a, i]).sort((x, y) => cat(x[0]) - cat(y[0]) || x[1] - y[1]).map(x => x[0]);
  }
  const parentKey = k => { const i = k.lastIndexOf('\\'); if (i < 0) return null; if (/^[a-z]:\\$/.test(k)) return null; const p = k.slice(0, i); return /^[a-z]:$/.test(p) ? p + '\\' : p; };
  function aclOf(s, key) {
    const e = s.fs[key]; if (!e) return [];
    const own = (e.acl || []).map(a => Object.assign({}, a, { inh: false }));
    let inh = [];
    const pk = parentKey(key);
    if (!e.protect && pk && s.fs[pk]) {
      aclOf(s, pk).forEach(p => {
        if (e.dir) {
          // CREATOR OWNER / CREATOR GROUP stay inherit-only placeholders on every child container
          if (p.ci) inh.push({ sid: p.sid, deny: p.deny, rights: p.rights.slice(), oi: p.np ? false : p.oi, ci: !p.np, io: /^creator (owner|group)$/i.test(p.sid) && !p.np, np: false, inh: true });
          else if (p.oi && !p.np) inh.push({ sid: p.sid, deny: p.deny, rights: p.rights.slice(), oi: true, ci: false, io: true, np: false, inh: true });
        } else if (p.oi) inh.push({ sid: p.sid, deny: p.deny, rights: p.rights.slice(), oi: false, ci: false, io: false, np: false, inh: true });
      });
    }
    return canonical(own.concat(inh));
  }
  // NTFS effective bits for a token (Set of lower-case SIDs)
  function ntfsBits(s, key, sids) {
    let decided = 0, allow = 0;
    for (const a of aclOf(s, key)) {
      if (a.io) continue;
      if (!sids.has(lc(a.sid))) continue;
      const b = bitsOf(a.rights) & ~decided;
      if (!b) continue;
      if (!a.deny) allow |= b;
      decided |= b;
    }
    return allow;
  }
  function shareBits(sh, sids) {
    let b = 0; (sh.grants || []).forEach(g => { if (sids.has(lc(g[0]))) b |= SHARE_BITS[String(g[1]).toUpperCase()] || 0; });
    return b;
  }
  WIN.aclOf = aclOf; WIN.ntfsBits = ntfsBits; WIN.shareBits = shareBits; WIN.tokenOf = tokenOf; WIN.canonPrincipal = canonPrincipal; WIN.bitsOf = bitsOf; WIN.RB = RB;
  WIN.findShare = (s, name) => s.shares.find(x => lc(x.name) === lc(name));
  // access of a local account to a path through a share (network) or locally
  WIN.access = function (s, user, path, viaShare) {
    const key = lc(path);
    if (viaShare) {
      const sh = WIN.findShare(s, viaShare); if (!sh) return 0;
      const sids = tokenOf(s, user, 'network');
      return shareBits(sh, sids) & ntfsBits(s, key, sids);
    }
    return ntfsBits(s, key, tokenOf(s, user, 'local'));
  };

  // ---- paths
  function winNorm(p) {
    const parts = String(p).replace(/\//g, '\\').split('\\');
    const out = [];
    parts.forEach((x, i) => { if (i > 0 && (x === '' || x === '.')) return; if (x === '..') { if (out.length > 1) out.pop(); return; } out.push(x); });
    let r = out.join('\\');
    if (/^[a-z]:$/i.test(r)) r += '\\';
    return r;
  }
  // -> { kind:'local', path, key } | { kind:'unc', host, share, rest, disp } | { kind:'bad' }
  function winResolve(E, raw) {
    let p = String(raw || '').trim().replace(/\//g, '\\');
    if (!p) return { kind: 'bad' };
    const m = /^\\\\([^\\]+)\\([^\\]+)(\\.*)?$/.exec(p);
    if (m) return { kind: 'unc', host: m[1], share: m[2], rest: winNorm('x' + (m[3] || '')).slice(1).replace(/^\\/, ''), disp: p.replace(/\\$/, '') };
    if (/^\\\\/.test(p)) return { kind: 'bad' };
    const cwd = winCwd(E);
    if (/^[a-z]:/i.test(p)) {
      const L = p.slice(0, 2).toUpperCase(); let rest = p.slice(2);
      const dv = E.sys.drives.find(d => d.local === L);
      if (dv) { const r = winResolve(E, dv.remote + (rest ? '\\' + rest.replace(/^\\/, '') : '')); r.disp = L + (rest.startsWith('\\') ? rest : '\\' + rest); r.letter = L; return r; }
      if (rest && !rest.startsWith('\\')) rest = (lc(cwd.slice(0, 2)) === lc(L) ? cwd.replace(/\\$/, '') : L) + '\\' + rest; else rest = L + (rest || '\\');
      const path = winNorm(rest); return { kind: 'local', path, key: lc(path) };
    }
    if (p.startsWith('\\')) { const path = winNorm(cwd.slice(0, 2) + p); return { kind: 'local', path, key: lc(path) }; }
    if (/^[A-Z]:\\/i.test(cwd) && E.sys.drives.some(d => d.local === cwd.slice(0, 2).toUpperCase())) return winResolve(E, cwd.replace(/\\$/, '') + '\\' + p);
    const path = winNorm(cwd.replace(/\\$/, '') + '\\' + p); return { kind: 'local', path, key: lc(path) };
  }
  function winCwd(E) { return E.sys.cwd || (E.admin ? 'C:\\Windows\\system32' : 'C:\\Users\\' + E.user); }
  const dispPath = (s, key) => s.fs[key] ? s.fs[key].path : key;

  // ---- remote hosts (UNC): name or IP of a device in the topology, reachable on TCP 445
  function findHost(E, name) {
    const n = lc(String(name).replace(/^\\\\/, ''));
    return E.net.topo.devices.find(d => lc(d.name) === n || (d.ifaces || []).some(f => f && f.ip === n) || hostIpOf(E.net, d) === n) || null;
  }
  function reach(E, d) {
    if (d.id === E.hostId) return true;
    const ip = hostIpOf(E.net, d); if (!ip) return false;
    try { const r = E.net.trace(E.hostId, ip, { proto: 'tcp', port: 445 }); return !!(r && r.ok); } catch (e) { return false; }
  }
  // opens \\host\share: -> { err: lines } | { d, s, sh, user, sids }
  function openShare(E, host, share, asUser) {
    const d = findHost(E, host);
    if (!d || osOfDev(d) !== 'windows' || !reach(E, d)) return { err: sysErr(53, 'The network path was not found.'), code: 53 };
    const s = sysOf(E.net, d.id, 'windows');
    const who = asUser || E.user;
    const u = userOf(s, String(who).replace(/^.*\\/, ''));
    if (!u || (u.name === 'Guest')) return { err: sysErr(1326, 'The user name or password is incorrect.'), code: 1326 };
    if (!u.active) return { err: sysErr(1331, "This user can't sign in because this account is currently disabled."), code: 1331 };
    const sh = share === undefined ? null : WIN.findShare(s, share);
    if (share !== undefined && !sh) return { err: sysErr(67, 'The network name cannot be found.'), code: 67 };
    const sids = tokenOf(s, u.name, 'network');
    return { d, s, sh, user: u.name, sids };
  }
  function remoteBits(o, rest) {
    if (o.sh.ipc) return 0;
    const key = lc(winNorm(o.sh.path.replace(/\\$/, '') + (rest ? '\\' + rest : '')));
    if (!o.s.fs[key]) return { missing: true };
    return shareBits(o.sh, o.sids) & ntfsBits(o.s, key, o.sids);
  }
  const sysErr = (n, msg) => [`System error ${n} has occurred.`, '', msg, ''];
  const helpErr = (msg, n) => [msg, '', `More help is available by typing NET HELPMSG ${n}.`, ''];
  const optOf = (tok) => { const m = /^\/([a-z?]+)(?::(.*))?$/i.exec(tok); return m ? { k: lc(m[1]), v: m[2] } : null; };
  const isOpt = (o, full, min) => o && o.k.length >= (min || 1) && full.startsWith(o.k);

  const NET_SYNTAX = ['The syntax of this command is:', '', 'NET', '    [ ACCOUNTS | COMPUTER | CONFIG | CONTINUE | FILE | GROUP | HELP |', '      HELPMSG | LOCALGROUP | PAUSE | SESSION | SHARE | START |', '      STATISTICS | STOP | TIME | USE | USER | VIEW ]', ''];
  const USER_SYNTAX = ['The syntax of this command is:', '', 'NET USER', '[username [password | *] [options]] [/DOMAIN]', '         username {password | *} /ADD [options] [/DOMAIN]', '         username [/DELETE] [/DOMAIN]', '         username [/TIMES:{times | ALL}]', '         username [/ACTIVE: {YES | NO}]', '', 'More help is available by typing NET HELPMSG 3505.', ''];
  const LG_SYNTAX = ['The syntax of this command is:', '', 'NET LOCALGROUP', '[groupname [/COMMENT:"text"]] [/DOMAIN]', '              groupname {/ADD [/COMMENT:"text"] | /DELETE}  [/DOMAIN]', '              groupname name [...] {/ADD | /DELETE} [/DOMAIN]', '', 'More help is available by typing NET HELPMSG 3505.', ''];
  const SHARE_SYNTAX = ['The syntax of this command is:', '', 'NET SHARE', 'sharename', '          sharename=drive:path [/GRANT:user,[READ | CHANGE | FULL]]', '                               [/USERS:number | /UNLIMITED]', '                               [/REMARK:"text"]', '                               [/CACHE:Manual | Documents| Programs | BranchCache | None]', '          sharename [/USERS:number | /UNLIMITED]', '                    [/REMARK:"text"]', '                    [/CACHE:Manual | Documents | Programs | BranchCache | None]', '          {sharename | devicename | drive:path} /DELETE', '          sharename \\\\computername /DELETE', '', 'More help is available by typing NET HELPMSG 3505.', ''];
  const USE_SYNTAX = ['The syntax of this command is:', '', 'NET USE', '[devicename | *] [\\\\computername\\sharename[\\volume] [password | *]]', '        [/USER:[domainname\\]username]', '        [/USER:[dotted domain name\\]username]', '        [/USER:[username@dotted domain name]', '        [/SMARTCARD]', '        [/SAVECRED]', '        [/REQUIREINTEGRITY]', '        [/REQUIREPRIVACY]', '        [/WRITETHROUGH]', '        [[/DELETE] | [/PERSISTENT:{YES | NO}]]', '', 'NET USE {devicename | *} [password | *] /HOME', '', 'NET USE [/PERSISTENT:{YES | NO}]', '', 'More help is available by typing NET HELPMSG 3505.', ''];
  const HELPMSG = { 2221: 'The user name could not be found.', 2224: 'The account already exists.', 2116: 'The device or directory does not exist.', 2118: 'The name has already been shared.',
    2250: 'The network connection could not be found.', 2310: 'This shared resource does not exist.', 3505: 'You used an option with an invalid value.', 3783: 'The name provided is not a properly formed account name.',
    5: 'Access is denied.', 53: 'The network path was not found.', 67: 'The network name cannot be found.', 85: 'The local device name is already in use.', 1326: 'The user name or password is incorrect.',
    1376: 'The specified local group does not exist.', 1377: 'The specified account name is not a member of the group.', 1378: 'The specified account name is already a member of the group.', 1379: 'The specified local group already exists.' };

  function fmtWinDate(iso, dateOnly) {
    const d = new Date(String(iso || BASE).replace(/Z?$/, ''));
    if (isNaN(d)) return '';
    let h = d.getHours(); const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12;
    const p2 = n => ('0' + n).slice(-2);
    const ds = `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
    return dateOnly ? ds : `${ds} ${h}:${p2(d.getMinutes())}:${p2(d.getSeconds())} ${ap}`;
  }
  const addDays = (iso, n) => { const d = new Date(String(iso || BASE)); d.setDate(d.getDate() + n); const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000); return z.toISOString().slice(0, 19); };

  // ---------------- net user
  function netUser(E, a) {
    const pos = [], opts = [];
    for (const t of a) { const o = optOf(t); if (o) opts.push(Object.assign(o, { raw: t })); else pos.push(t); }
    const s = E.sys;
    if (opts.some(o => o.k === '?' || o.k === 'help')) return { out: USER_SYNTAX };
    if (!pos.length && !opts.length) {
      const names = s.users.map(u => u.name).sort((x, y) => lc(x) < lc(y) ? -1 : 1);
      const L = ['', `User accounts for \\\\${s.host}`, '', '-'.repeat(79)];
      for (let i = 0; i < names.length; i += 3) L.push(names.slice(i, i + 3).map((n, j) => j < 2 ? padE(n, 25) : n).join('').replace(/\s+$/, ''));
      L.push(OK, '');
      return { out: L, view: true };
    }
    const known = { add: 'add', delete: 'delete', active: 'active', passwordreq: 'passwordreq', passwordchg: 'passwordchg', fullname: 'fullname', comment: 'comment', domain: 'domain' };
    const unsupported = ['logonpasswordchg', 'expires', 'times', 'homedir', 'profilepath', 'scriptpath', 'usercomment', 'workstations', 'countrycode'];
    const O = {};
    for (const o of opts) {
      const full = Object.keys(known).find(k => isOpt(o, k, k === 'delete' || k === 'domain' ? 2 : 1) && (k !== 'add' || o.k.length >= 1));
      if (o.k === 'add') { O.add = true; continue; }
      if (full === 'delete' || o.k === 'del' || o.k === 'delete') { O.delete = true; continue; }
      if (full === 'domain') return { out: sysErr(1355, 'The specified domain either does not exist or could not be contacted.') };
      if (full) { O[full] = o.v === undefined ? '' : o.v; continue; }
      if (unsupported.some(k => k.startsWith(o.k) && o.k.length >= 3)) return { out: [HINT(`(ระบบจำลองยังไม่รองรับตัวเลือก ${o.raw} — ใช้ /active, /passwordreq, /passwordchg, /fullname, /comment, /add, /delete)`)] };
      return { out: [`The option ${o.raw.toUpperCase().split(':')[0]} is unknown.`, ''].concat(USER_SYNTAX) };
    }
    const name = pos[0], pw = pos[1];
    if (!name || pos.length > 2) return { out: USER_SYNTAX };
    const yn = (v, def) => { const t = lc(v); if (t === '' || t === 'yes' || t === 'y') return true; if (t === 'no' || t === 'n') return false; return def === undefined ? null : def; };
    const u = userOf(s, name);
    const nothingToDo = !O.add && !O.delete && pw === undefined && Object.keys(O).length === 0;
    if (nothingToDo) { if (!u) return { out: helpErr('The user name could not be found.', 2221) }; return { out: userInfo(s, u), view: true }; }
    if (!E.admin) return { out: sysErr(5, 'Access is denied.'), denied: true };
    for (const k of ['active', 'passwordreq', 'passwordchg']) if (O[k] !== undefined && yn(O[k]) === null) return { out: [`You entered an invalid value for the /${k.toUpperCase()} option.`, '', 'More help is available by typing NET HELPMSG 3952.', ''] };
    const pre = [];
    if (pw === '*') pre.push('Type a password for the user:', 'Retype the password to confirm:', HINT('(ระบบจำลอง: สมมติว่าพิมพ์รหัสผ่านแล้วและตรงกันทั้งสองครั้ง รหัสจะไม่แสดงบนจอ)'));
    if (O.add) {
      if (u) return { out: helpErr('The account already exists.', 2224) };
      if (!/^[^"/\\[\]:;|=,+*?<>@]{1,20}$/.test(name) || /^\.+$/.test(name)) return { out: USER_SYNTAX };
      if (groupOf(s, name)) return { out: helpErr('The account already exists.', 2224) };
      if (s.server && pw !== '*' && !complexOk(pw || '', name)) return { out: ['The password does not meet the password policy requirements. Check the minimum password length, password complexity and password history requirements.', '', 'More help is available by typing NET HELPMSG 2245.', ''] };
      const nu = { name, full: O.fullname || '', comment: O.comment || '', active: O.active !== undefined ? yn(O.active) : true, pwReq: O.passwordreq !== undefined ? yn(O.passwordreq) : true, chg: O.passwordchg !== undefined ? yn(O.passwordchg) : true, pwSet: nowIso(), created: true };
      s.users.push(nu);
      groupOf(s, 'Users').members.push(name);
      return { out: pre.concat([OK, '']), changed: true };
    }
    if (!u) return { out: helpErr('The user name could not be found.', 2221) };
    if (O.delete) {
      if (u.builtin) return { out: [HINT('(ระบบจำลอง: บัญชี built-in ลบไม่ได้ ให้ปิดด้วย /active:no แทน)')] };
      s.users = s.users.filter(x => x !== u);
      s.groups.forEach(g => { g.members = g.members.filter(m => lc(m) !== lc(u.name) && lc(m) !== lc(s.host + '\\' + u.name)); });
      return { out: [OK, ''], changed: true };
    }
    if (pw !== undefined) { if (s.server && pw !== '*' && !complexOk(pw, u.name)) return { out: ['The password does not meet the password policy requirements. Check the minimum password length, password complexity and password history requirements.', '', 'More help is available by typing NET HELPMSG 2245.', ''] }; u.pwSet = nowIso(); }
    if (O.active !== undefined) u.active = yn(O.active);
    if (O.passwordreq !== undefined) u.pwReq = yn(O.passwordreq);
    if (O.passwordchg !== undefined) u.chg = yn(O.passwordchg);
    if (O.fullname !== undefined) u.full = O.fullname;
    if (O.comment !== undefined) u.comment = O.comment;
    return { out: pre.concat([OK, '']), changed: true };
  }
  function complexOk(pw, name) {
    if (pw.length < 7) return false;
    if (name && name.length >= 3 && lc(pw).includes(lc(name))) return false;
    return [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter(r => r.test(pw)).length >= 3;
  }
  function userInfo(s, u) {
    const L = (k, v) => padE(k, 29) + (v == null ? '' : v);
    const set = u.pwSet || BASE;
    const groups = s.groups.filter(g => g.members.some(m => lc(m) === lc(u.name) || lc(m) === lc(s.host + '\\' + u.name))).map(g => '*' + g.name);
    const out = [L('User name', u.name), L('Full Name', u.full), L('Comment', u.comment), L("User's comment", ''), L('Country/region code', '000 (System Default)'),
      L('Account active', u.active ? 'Yes' : 'No'), L('Account expires', 'Never'), '',
      L('Password last set', fmtWinDate(set)), L('Password expires', u.pwNever || !u.pwReq ? 'Never' : fmtWinDate(addDays(set, 42))), L('Password changeable', fmtWinDate(set)),
      L('Password required', u.pwReq === false ? 'No' : 'Yes'), L('User may change password', u.chg === false ? 'No' : 'Yes'), '',
      L('Workstations allowed', 'All'), L('Logon script', ''), L('User profile', ''), L('Home directory', ''), L('Last logon', u.lastLogon ? fmtWinDate(u.lastLogon) : 'Never'), '',
      L('Logon hours allowed', 'All'), ''];
    const gl = groups.length ? groups : ['*None'];
    for (let i = 0; i < gl.length; i += 2) out.push((i === 0 ? padE('Local Group Memberships', 29) : ' '.repeat(29)) + gl.slice(i, i + 2).map((g, j) => j === 0 && gl[i + 1] ? padE(g, 22) : g).join(''));
    out.push(L('Global Group memberships', '*None'), OK, '');
    return out.map(x => typeof x === 'string' ? x.replace(/\s+$/, '') : x);
  }

  // ---------------- net localgroup
  function netLocalgroup(E, a) {
    const pos = [], O = {}; const s = E.sys;
    for (const t of a) {
      const o = optOf(t);
      if (!o) { pos.push(t); continue; }
      if (o.k === '?' || o.k === 'help') return { out: LG_SYNTAX };
      if (o.k === 'add') O.add = true; else if (isOpt(o, 'delete', 2)) O.delete = true; else if (isOpt(o, 'comment', 1)) O.comment = o.v || ''; else if (isOpt(o, 'domain', 2)) return { out: sysErr(1355, 'The specified domain either does not exist or could not be contacted.') };
      else return { out: [`The option ${t.toUpperCase().split(':')[0]} is unknown.`, ''].concat(LG_SYNTAX) };
    }
    if (!pos.length && !O.add && !O.delete) {
      const L = ['', `Aliases for \\\\${s.host}`, '', '-'.repeat(79)];
      s.groups.map(g => g.name).sort((x, y) => lc(x) < lc(y) ? -1 : 1).forEach(n => L.push('*' + n));
      L.push(OK, '');
      return { out: L, view: true };
    }
    const name = pos[0]; if (!name) return { out: LG_SYNTAX };
    const g = groupOf(s, name);
    const members = pos.slice(1);
    if (!O.add && !O.delete) {
      if (members.length) return { out: LG_SYNTAX };
      if (O.comment !== undefined) { if (!E.admin) return { out: sysErr(5, 'Access is denied.'), denied: true }; if (!g) return { out: sysErr(1376, 'The specified local group does not exist.') }; g.comment = O.comment; return { out: [OK, ''], changed: true }; }
      if (!g) return { out: sysErr(1376, 'The specified local group does not exist.') };
      const L = [padE('Alias name', 15) + g.name, padE('Comment', 15) + (g.comment || ''), '', 'Members', '', '-'.repeat(79)];
      g.members.forEach(m => L.push(m));
      L.push(OK, '');
      return { out: L.map(x => x.replace(/\s+$/, '')), view: true };
    }
    if (!E.admin) return { out: sysErr(5, 'Access is denied.'), denied: true };
    if (!members.length) {
      if (O.add) {
        if (g) return { out: sysErr(1379, 'The specified local group already exists.') };
        if (userOf(s, name)) return { out: sysErr(1379, 'The specified local group already exists.') };
        if (!/^[^"/\\[\]:;|=,+*?<>@]{1,256}$/.test(name)) return { out: LG_SYNTAX };
        s.groups.push({ name, comment: O.comment || '', builtin: false, members: [], created: true });
        return { out: [OK, ''], changed: true };
      }
      if (!g) return { out: sysErr(1376, 'The specified local group does not exist.') };
      if (g.builtin) return { out: [HINT('(ระบบจำลอง: กลุ่ม built-in ลบไม่ได้)')] };
      s.groups = s.groups.filter(x => x !== g);
      return { out: [OK, ''], changed: true };
    }
    if (!g) return { out: sysErr(1376, 'The specified local group does not exist.') };
    for (const raw of members) {
      const sid = canonPrincipal(s, raw);
      const isGroup = sid && /^(BUILTIN|[^\\]+)\\/.test(sid) && groupOf(s, shortName(s, sid)) && !userOf(s, shortName(s, sid));
      if (!sid || (isGroup && !/^NT AUTHORITY/.test(sid))) return { out: helpErr(`There is no such global user or group: ${raw}.`, 3783) };
      const stored = /^NT AUTHORITY|^Everyone$/.test(sid) ? sid : shortName(s, sid);
      const has = g.members.some(m => lc(m) === lc(stored) || lc(m) === lc(sid));
      if (O.add) { if (has) return { out: sysErr(1378, 'The specified account name is already a member of the group.') }; g.members.push(stored); }
      else { if (!has) return { out: sysErr(1377, 'The specified account name is not a member of the group.') }; g.members = g.members.filter(m => lc(m) !== lc(stored) && lc(m) !== lc(sid)); }
    }
    return { out: [OK, ''], changed: true };
  }

  // ---------------- net share
  function shareList(s) {
    const L = ['', padE('Share name', 13) + padE('Resource', 32) + 'Remark', '', '-'.repeat(79)];
    const order = sh => sh.special ? (sh.ipc ? 1 : /^[A-Z]\$$/.test(sh.name) ? 0 : 2) : 3;
    s.shares.map((x, i) => [x, i]).sort((a, b) => order(a[0]) - order(b[0]) || a[1] - b[1]).forEach(([sh]) => {
      const res = sh.print ? 'Spooled' : sh.path;
      if (sh.name.length > 12) { L.push(sh.name); L.push((' '.repeat(13) + padE(res, 32) + sh.remark).replace(/\s+$/, '')); }
      else L.push((padE(sh.name, 13) + (res.length > 31 ? res + '\n' + ' '.repeat(45) : padE(res, 32)) + sh.remark).replace(/\s+$/, ''));
    });
    L.push(OK, '');
    return [].concat(...L.map(x => x.split('\n')));
  }
  function shareInfo(s, sh) {
    const L = k => padE(k, 18);
    const out = [L('Share name') + sh.name, L('Path') + sh.path, L('Remark') + sh.remark, L('Maximum users') + 'No limit', L('Users'), L('Caching') + (sh.special ? 'Caching disabled' : 'Manual caching of documents')];
    (sh.grants || []).forEach((g, i) => out.push((i === 0 ? L('Permission') : ' '.repeat(18)) + `${g[0]}, ${String(g[1]).toUpperCase()}`));
    out.push('', OK, '');
    return out.map(x => x.replace(/\s+$/, ''));
  }
  function netShare(E, a) {
    const s = E.sys; const pos = [], opts = [];
    for (const t of a) { const o = optOf(t); if (o) opts.push(Object.assign(o, { raw: t })); else pos.push(t); }
    if (opts.some(o => o.k === '?' || o.k === 'help')) return { out: SHARE_SYNTAX };
    if (!pos.length && !opts.length) return { out: shareList(s), view: true };
    const del = opts.some(o => o.k.length >= 1 && 'delete'.startsWith(o.k));
    const first = pos[0] || '';
    if (del) {
      if (!E.admin) return { out: sysErr(5, 'Access is denied.'), denied: true };
      let hit = WIN.findShare(s, first);
      let list = hit ? [hit] : s.shares.filter(x => x.path && lc(winNorm(x.path)) === lc(winNorm(first)) && /^[a-z]:/i.test(first));
      if (!list.length) return { out: helpErr('This shared resource does not exist.', 2310) };
      s.shares = s.shares.filter(x => !list.includes(x));
      return { out: list.map(x => `${x.name} was deleted successfully.`).concat(['']), changed: true };
    }
    const eq = first.indexOf('=');
    if (eq < 0) {
      if (pos.length !== 1) return { out: SHARE_SYNTAX };
      const sh = WIN.findShare(s, first);
      if (!sh) return { out: helpErr('This shared resource does not exist.', 2310) };
      if (!opts.length) return { out: shareInfo(s, sh), view: true };
      if (!E.admin) return { out: sysErr(5, 'Access is denied.'), denied: true };
      for (const o of opts) {
        if (isOpt(o, 'remark', 1)) sh.remark = o.v || '';
        else if (isOpt(o, 'users', 1) || isOpt(o, 'unlimited', 2) || isOpt(o, 'cache', 1)) { /* accepted, not modelled */ }
        else if (isOpt(o, 'grant', 1)) return { out: SHARE_SYNTAX };
        else return { out: [`The option ${o.raw.toUpperCase().split(':')[0]} is unknown.`, ''].concat(SHARE_SYNTAX) };
      }
      return { out: [OK, ''], changed: true };
    }
    const name = first.slice(0, eq), rawPath = first.slice(eq + 1);
    if (!name || !rawPath || pos.length > 1) return { out: SHARE_SYNTAX };
    const grants = []; let remark = '';
    for (const o of opts) {
      if (isOpt(o, 'grant', 1)) {
        const m = /^(.+),\s*(read|change|full)$/i.exec(o.v || '');
        if (!m) return { out: SHARE_SYNTAX };
        grants.push([m[1].trim(), m[2].toUpperCase()]);
      } else if (isOpt(o, 'remark', 1)) remark = o.v || '';
      else if (isOpt(o, 'users', 1) || isOpt(o, 'unlimited', 2) || isOpt(o, 'cache', 1)) { /* accepted, not modelled */ }
      else return { out: [`The option ${o.raw.toUpperCase().split(':')[0]} is unknown.`, ''].concat(SHARE_SYNTAX) };
    }
    if (!E.admin) return { out: sysErr(5, 'Access is denied.'), denied: true };
    if (!/^[^"/\\[\]:|<>+=;,?*]{1,80}$/.test(name)) return { out: SHARE_SYNTAX };
    if (WIN.findShare(s, name)) return { out: helpErr('The name has already been shared.', 2118) };
    if (!/^[a-z]:/i.test(rawPath)) return { out: helpErr('The device or directory does not exist.', 2116) };
    const key = lc(winNorm(rawPath));
    const e = s.fs[key];
    if (!e || !e.dir) return { out: helpErr('The device or directory does not exist.', 2116) };
    const gl = [];
    for (const g of grants) {
      const sid = canonPrincipal(s, g[0]);
      if (!sid || lc(sid) === 'creator owner') return { out: sysErr(1332, 'No mapping between account names and security IDs was done.') };
      const ex = gl.find(x => lc(x[0]) === lc(sid));
      if (ex) { if (SHARE_BITS[g[1]] > SHARE_BITS[ex[1]]) ex[1] = g[1]; } else gl.push([sid, g[1]]);
    }
    s.shares.push({ name, path: e.path, remark, grants: gl.length ? gl : [['Everyone', 'READ']], created: true });
    return { out: [`${name} was shared successfully.`, ''], changed: true };
  }

  // ---------------- net use / net view
  function driveStatus(E, dv) {
    const m = /^\\\\([^\\]+)\\([^\\]+)/.exec(dv.remote || '');
    if (!m) return 'Unavailable';
    const o = openShare(E, m[1], m[2], dv.user);
    return o.err ? (o.code === 53 ? 'Unavailable' : 'Disconnected') : 'OK';
  }
  function netUse(E, a) {
    const s = E.sys; const pos = [], opts = [];
    for (const t of a) { const o = optOf(t); if (o) opts.push(Object.assign(o, { raw: t })); else pos.push(t); }
    if (opts.some(o => o.k === '?' || o.k === 'help')) return { out: USE_SYNTAX };
    let del = false, persist, user, yes = false;
    for (const o of opts) {
      if (o.k.length >= 1 && 'delete'.startsWith(o.k)) del = true;
      else if (isOpt(o, 'persistent', 1)) { const v = lc(o.v); if (v === 'yes' || v === 'y') persist = true; else if (v === 'no' || v === 'n') persist = false; else return { out: [`You entered an invalid value for the /PERSISTENT option.`, '', 'More help is available by typing NET HELPMSG 3952.', ''] }; }
      else if (isOpt(o, 'user', 1)) user = o.v || '';
      else if (o.k === 'y' || o.k === 'yes') yes = true;
      else if (o.k === 'n' || o.k === 'no') yes = false;
      else if (isOpt(o, 'savecred', 2) || isOpt(o, 'smartcard', 2) || isOpt(o, 'writethrough', 1) || isOpt(o, 'requireintegrity', 4) || isOpt(o, 'requireprivacy', 4)) { /* accepted */ }
      else return { out: [`The option ${o.raw.toUpperCase().split(':')[0]} is unknown.`, ''].concat(USE_SYNTAX) };
    }
    if (!pos.length) {
      if (del) return { out: USE_SYNTAX };
      if (persist !== undefined) { s.persist = persist; return { out: [OK, ''], changed: true, persistChange: true }; }
      const L = [s.persist ? 'New connections will be remembered.' : 'New connections will not be remembered.', ''];
      if (!s.drives.length) { L.push('There are no entries in the list.', ''); return { out: L, view: true }; }
      L.push('', padE('Status', 13) + padE('Local', 10) + padE('Remote', 26) + 'Network', '', '-'.repeat(79));
      s.drives.forEach(dv => {
        const st = driveStatus(E, dv);
        const rem = dv.remote.length > 25 ? dv.remote + '\n' + ' '.repeat(49) : padE(dv.remote, 26);
        L.push(...(padE(st, 13) + padE(dv.local || '', 10) + rem + 'Microsoft Windows Network').split('\n'));
      });
      L.push(OK, '');
      return { out: L, view: true };
    }
    let dev = pos[0], remote = pos[1];
    if (/^\\\\/.test(dev)) { remote = dev; dev = ''; }
    if (dev && dev !== '*' && !/^[a-z]:$/i.test(dev)) return { out: USE_SYNTAX };
    dev = dev === '*' ? '*' : dev.toUpperCase();
    if (del) {
      if (dev === '*') {
        if (!s.drives.length) return { out: ['There are no entries in the list.', ''] };
        if (!yes) {
          const L = ['You have these remote connections:', ''];
          s.drives.forEach(dv => L.push(`    ${padE(dv.local || '', 15)}${dv.remote}`));
          L.push('Continue with this operation? (Y/N) [N]: ');
          return { out: L.concat([HINT('(ระบบจำลองตอบโต้แบบถาม-ตอบไม่ได้ ถือว่าตอบ N — พิมพ์ net use * /delete /y เพื่อยืนยันในบรรทัดเดียว)')]) };
        }
        const n = s.drives.length; s.drives = [];
        return { out: [OK, ''], changed: n > 0 };
      }
      const target = dev || (remote || '');
      const hit = s.drives.filter(dv => dev ? dv.local === dev : lc(dv.remote) === lc(target.replace(/\\$/, '')));
      if (!hit.length) return { out: helpErr('The network connection could not be found.', 2250) };
      s.drives = s.drives.filter(dv => !hit.includes(dv));
      return { out: [`${dev || hit[0].remote} was deleted successfully.`, ''], changed: true };
    }
    if (!remote) {
      if (dev && dev !== '*') { const dv = s.drives.find(x => x.local === dev); if (!dv) return { out: helpErr('The network connection could not be found.', 2250) }; return { out: [padE('Local name', 18) + dv.local, padE('Remote name', 18) + dv.remote, padE('Resource type', 18) + 'Disk', padE('Status', 18) + driveStatus(E, dv), padE('# Opens', 18) + '0', padE('# Connections', 18) + '1', OK, ''], view: true }; }
      return { out: USE_SYNTAX };
    }
    const m = /^\\\\([^\\]+)\\([^\\]+)\\?$/.exec(remote);
    if (!m) return { out: sysErr(67, 'The network name cannot be found.') };
    if (dev === '*') {
      const used = new Set(s.drives.map(d => d.local).concat(s.vols));
      const free = 'ZYXWVUTSRQPONMLKJIHGFED'.split('').map(c => c + ':').find(x => !used.has(x));
      if (!free) return { out: sysErr(85, 'The local device name is already in use.') };
      dev = free;
    }
    if (dev && (s.drives.some(d => d.local === dev) || s.vols.includes(dev))) return { out: sysErr(85, 'The local device name is already in use.') };
    const pre = [];
    if (pos[2] === '*') pre.push(`Enter the password for '${user || E.user}' to connect to '${m[1]}':`, HINT('(ระบบจำลอง: สมมติว่าพิมพ์รหัสผ่านแล้ว)'));
    const o = openShare(E, m[1], m[2], user);
    if (o.err) return { out: o.err, fail: o.code };
    if (o.sh.print && dev) return { out: sysErr(66, 'The network resource type is not correct.'), fail: 66 };
    if (!o.sh.ipc && !o.sh.print) {
      const b = remoteBits(o, '');
      if (!(typeof b === 'number' && (b & 1))) return { out: sysErr(5, 'Access is denied.'), fail: 5 };
    }
    const remoteStr = `\\\\${m[1]}\\${m[2]}`;
    const nd = { local: dev || '', remote: remoteStr, persistent: persist !== undefined ? persist : s.persist };
    if (user) nd.user = user;
    s.drives.push(nd);
    if (persist !== undefined) s.persist = persist;
    const out = dev && pos[0] === '*' ? [`Drive ${dev} is now connected to ${remoteStr}.`, '', OK, ''] : [OK, ''];
    return { out: pre.concat(out), changed: true, mapped: { local: dev, remote: remoteStr } };
  }
  function netView(E, a) {
    const pos = a.filter(t => !optOf(t)); const opts = a.map(optOf).filter(Boolean);
    if (opts.some(o => o.k === '?' || o.k === 'help')) return { out: ['The syntax of this command is:', '', 'NET VIEW', '[\\\\computername [/CACHE] | [/ALL] | /DOMAIN[:domainname]]', 'NET VIEW /NETWORK:NW [\\\\computername]', ''] };
    if (!pos.length) return { out: sysErr(6118, 'The list of servers for this workgroup is not currently available') };
    const all = opts.some(o => isOpt(o, 'all', 1));
    const host = pos[0].replace(/^\\\\/, '').replace(/\\.*$/, '');
    const o = openShare(E, host);
    if (o.err) return { out: o.err, fail: o.code };
    const L = [`Shared resources at \\\\${host}`, '', '', '', padE('Share name', 12) + padE('Type', 6) + padE('Used as', 9) + 'Comment', '', '-'.repeat(79)];
    o.s.shares.filter(sh => all || !/\$$/.test(sh.name)).forEach(sh => {
      const used = E.sys.drives.find(d => lc(d.remote) === lc(`\\\\${host}\\${sh.name}`));
      L.push((padE(sh.name, 12) + padE(sh.ipc ? 'IPC' : sh.print ? 'Print' : 'Disk', 6) + padE(used ? used.local : '', 9) + sh.remark).replace(/\s+$/, ''));
    });
    L.push(OK, '');
    return { out: L, view: true };
  }

  // ---------------- icacls
  const ICACLS_USAGE = ['', 'ICACLS name /save aclfile [/T] [/C] [/L] [/Q]', '    stores the DACLs for the files and folders that match the name', '    into aclfile for later use with /restore.', '',
    "ICACLS name [/grant[:r] Sid:perm[...]]", '       [/deny Sid:perm [...]]', '       [/remove[:g|:d]] Sid[...]] [/T] [/C] [/L] [/Q]', '       [/setintegritylevel Level:policy[...]]', '',
    '    /grant[:r] Sid:perm grants the specified user access rights. With :r,', '        the permissions replace any previously granted explicit permissions.', '        Without :r, the permissions are added to any previously granted', '        explicit permissions.', '',
    '    /deny Sid:perm explicitly denies the specified user access rights.', '    /remove[:[g|d]] Sid removes all occurrences of Sid in the ACL. With', '        :g, it removes all occurrences of granted rights to that Sid. With', '        :d, it removes all occurrences of denied rights to that Sid.', '',
    '    /inheritance:e|d|r', '        e - enables inheritance', '        d - disables inheritance and copy the ACEs', '        r - remove all inherited ACEs', '', 'ICACLS name /reset [/T] [/C] [/L] [/Q]', '    replaces ACLs with default inherited ACLs for all matching files.', '',
    '    perm is a permission mask and can be specified in one of two forms:', '        a sequence of simple rights:', '                N - no access', '                F - full access', '                M - modify access', '                RX - read and execute access', '                R - read-only access', '                W - write-only access', '                D - delete access',
    '        inheritance rights may precede either form and are applied', '        only to directories:', '                (OI) - object inherit', '                (CI) - container inherit', '                (IO) - inherit only', '                (NP) - don\'t propagate inherit', '                (I) - permission inherited from parent container', '',
    'Examples:', '        icacls c:\\windows\\* /save AclFile /T', '        icacls file /grant Administrator:(D,WDAC)', '        icacls dir /grant Accounting:(OI)(CI)M', ''];
  // "Sid:perm" -> { sid, ace } | { err }
  function parseGrant(s, tok) {
    const m = /^(.+?):((?:\((?:OI|CI|IO|NP)\))*)(\((?:[A-Z]+)(?:,[A-Z]+)*\)|[A-Z]+)$/i.exec(tok);
    if (!m) return { bad: true };
    const rights = m[3].replace(/[()]/g, '').toUpperCase().split(',');
    if (!rights.every(r => RB[r] !== undefined)) return { bad: true };
    const fl = lc(m[2]);
    const sid = canonPrincipal(s, m[1]);
    if (!sid) return { nomap: m[1] };
    return { ace: { sid, deny: false, rights: rights.includes('F') ? ['F'] : rights, oi: fl.includes('(oi)'), ci: fl.includes('(ci)'), io: fl.includes('(io)'), np: fl.includes('(np)'), inh: false } };
  }
  function normRights(bits, toks) {
    for (const k of ['F', 'M', 'RX', 'R', 'W', 'D']) if (RB[k] === bits) return [k];
    return toks;
  }
  function icacls(E, a) {
    const s = E.sys;
    if (!a.length || a.some(t => t === '/?')) return { out: ICACLS_USAGE };
    const target = a[0];
    if (/^\//.test(target)) return { out: [`Invalid parameter "${target}"`] };
    const ops = []; let q = false, tflag = false;
    for (let i = 1; i < a.length; i++) {
      const t = a[i], tl = lc(t);
      const mGrant = /^\/grant(:r)?$/.exec(tl), mRem = /^\/remove(:[gd])?$/.exec(tl), mInh = /^\/inheritance:([edr])$/.exec(tl);
      if (mGrant || tl === '/deny') {
        const list = []; while (i + 1 < a.length && !/^\//.test(a[i + 1])) list.push(a[++i]);
        if (!list.length) return { out: [`Invalid parameter "${t}"`] };
        ops.push({ op: tl === '/deny' ? 'deny' : 'grant', replace: !!(mGrant && mGrant[1]), list });
      } else if (mRem) {
        const list = []; while (i + 1 < a.length && !/^\//.test(a[i + 1])) list.push(a[++i]);
        if (!list.length) return { out: [`Invalid parameter "${t}"`] };
        ops.push({ op: 'remove', which: mRem[1] ? mRem[1][1] : 'all', list });
      } else if (mInh) ops.push({ op: 'inherit', v: mInh[1] });
      else if (tl === '/reset') ops.push({ op: 'reset' });
      else if (tl === '/t') tflag = true;
      else if (tl === '/q') q = true;
      else if (tl === '/c' || tl === '/l') { /* accepted */ }
      else return { out: [`Invalid parameter "${t}"`] };
    }
    // targets
    let wild = false, base = target;
    if (/\\\*$/.test(target)) { wild = true; base = target.slice(0, -2) || target; }
    const r = winResolve(E, base);
    if (r.kind !== 'local') return { out: [HINT('(ระบบจำลอง: icacls ใช้กับโฟลเดอร์บนเครื่องนี้ เช่น D:\\Projects — ถ้าเป็นเครื่องอื่นให้สลับไปที่เครื่องนั้น)')] };
    const fail = (p, msg) => ({ out: [`${p}: ${msg}`, 'Successfully processed 0 files; Failed processing 1 files'] });
    const e = s.fs[r.key];
    if (!e) return fail(target, 'The system cannot find the file specified.');
    let keys = [r.key];
    if (wild) keys = Object.keys(s.fs).filter(k => parentKey(k) === r.key).sort();
    if (!ops.length) {
      if (!E.admin && !(ntfsBits(s, r.key, tokenOf(s, E.user, 'local', false)) & 1)) return fail(target, 'Access is denied.');
      const out = [];
      keys.forEach(k => {
        const disp = wild ? (target.slice(0, -1) + s.fs[k].path.split('\\').pop()) : target;
        const acl = aclOf(s, k);
        acl.forEach((ace, i) => out.push((i === 0 ? disp + ' ' : ' '.repeat(disp.length + 1)) + aceText(ace)));
        if (!acl.length) out.push(disp + ' ');
        out.push('');
      });
      out.push(`Successfully processed ${keys.length} files; Failed processing 0 files`);
      return { out, view: true, path: e.path };
    }
    if (!E.admin) return fail(target, 'Access is denied.');
    // validate every Sid first (icacls stops on the first bad one)
    for (const o of ops) {
      if (o.op === 'grant' || o.op === 'deny') {
        o.aces = [];
        for (const tok of o.list) {
          const g = parseGrant(s, tok);
          if (g.bad) return { out: [`Invalid parameter "${tok}"`] };
          if (g.nomap) return fail(g.nomap, 'No mapping between account names and security IDs was done.');
          g.ace.deny = o.op === 'deny';
          o.aces.push(g.ace);
        }
      } else if (o.op === 'remove') {
        o.sids = [];
        for (const tok of o.list) { const sid = canonPrincipal(s, tok); if (!sid) return fail(tok, 'No mapping between account names and security IDs was done.'); o.sids.push(sid); }
      }
    }
    let targets = keys.slice();
    if (tflag) keys.forEach(k => Object.keys(s.fs).forEach(x => { if (x.startsWith(k.replace(/\\$/, '') + '\\') && !targets.includes(x)) targets.push(x); }));
    targets.forEach(k => applyOps(s, k, ops));
    const out = q ? [] : targets.map(k => `processed file: ${wild || tflag ? s.fs[k].path : target}`);
    out.push(`Successfully processed ${targets.length} files; Failed processing 0 files`);
    return { out, changed: true, path: e.path };
  }
  function applyOps(s, key, ops) {
    const e = s.fs[key];
    for (const o of ops) {
      if (o.op === 'grant' || o.op === 'deny') {
        o.aces.forEach(ace => {
          if (o.replace) e.acl = e.acl.filter(x => !(lc(x.sid) === lc(ace.sid) && !x.deny));
          if (ace.deny) {   // an explicit deny also removes the same rights from explicit grants of that Sid
            const db = bitsOf(ace.rights);
            e.acl = e.acl.map(x => { if (lc(x.sid) !== lc(ace.sid) || x.deny) return x; const nb = bitsOf(x.rights) & ~db; return nb ? Object.assign({}, x, { rights: normRights(nb, x.rights) }) : null; }).filter(Boolean);
          }
          const same = e.acl.find(x => lc(x.sid) === lc(ace.sid) && !!x.deny === !!ace.deny && sameFlags(x, ace));
          if (same) { const nb = bitsOf(same.rights) | bitsOf(ace.rights); same.rights = normRights(nb, Array.from(new Set(same.rights.concat(ace.rights)))); }
          else e.acl.push(Object.assign({}, ace));
        });
      } else if (o.op === 'remove') {
        e.acl = e.acl.filter(x => !o.sids.some(sid => lc(sid) === lc(x.sid) && (o.which === 'all' || (o.which === 'g' && !x.deny) || (o.which === 'd' && x.deny))));
      } else if (o.op === 'inherit') {
        if (o.v === 'e') e.protect = false;
        else if (o.v === 'd') { if (!e.protect) { const inh = aclOf(s, key).filter(x => x.inh).map(x => Object.assign({}, x, { inh: false })); e.acl = e.acl.concat(inh); e.protect = true; } }
        else if (o.v === 'r') e.protect = true;
      } else if (o.op === 'reset') { e.acl = []; e.protect = false; }
      e.acl = canonical(e.acl);
    }
  }

  // ---------------- cd, dir, type, del, echo >
  function winCd(E, a, raw) {
    const s = E.sys;
    let args = a.slice();
    let dflag = false;
    if (args[0] && lc(args[0]) === '/d') { dflag = true; args = args.slice(1); }
    let p = args.join(' ') || (raw && raw.replace(/^\s*(cd|chdir)(\s+\/d)?\s*/i, '').replace(/"/g, '').trim());
    if (!p) return { out: [winCwd(E)] };
    if (p === '/?') return { out: ['Displays the name of or changes the current directory.', '', 'CHDIR [/D] [drive:][path]', 'CHDIR [..]', 'CD [/D] [drive:][path]', 'CD [..]'] };
    if (/^[a-z]:$/i.test(p)) { if (!dflag) return { out: [p.toUpperCase() + '\\'] }; p = p + '\\'; }
    const cur = winCwd(E);
    if (/^[a-z]:/i.test(p) && lc(p.slice(0, 2)) !== lc(cur.slice(0, 2)) && !dflag) {
      // real cmd changes the remembered directory of the other drive but stays on the current drive
      const r0 = winResolve(E, p); if (r0.kind === 'local' && (!s.fs[r0.key] || !s.fs[r0.key].dir)) return { out: ['The system cannot find the path specified.'] };
      if (r0.kind === 'local') { s.dcwd = s.dcwd || {}; s.dcwd[p.slice(0, 2).toUpperCase()] = s.fs[r0.key].path; }
      return { out: [] };
    }
    const r = winResolve(E, p);
    if (r.kind === 'unc') return { out: ['CMD does not support UNC paths as current directories.'] };
    if (r.kind !== 'local') return { out: ['The system cannot find the path specified.'] };
    if (r.letter) { s.cwd = r.letter + '\\'; return { out: [] }; }
    const e = s.fs[r.key];
    if (!e) return { out: ['The system cannot find the path specified.'] };
    if (!e.dir) return { out: ['The directory name is invalid.'] };
    s.cwd = e.path;
    return { out: [] };
  }
  function winDrive(E, L) {
    L = L.toUpperCase();
    const s = E.sys;
    if (s.drives.some(d => d.local === L)) { s.cwd = L + '\\'; return { out: [] }; }
    if (!s.vols.includes(L)) return { out: ['The system cannot find the drive specified.'] };
    const cur = winCwd(E); s.dcwd = s.dcwd || {}; s.dcwd[cur.slice(0, 2).toUpperCase()] = cur;
    s.cwd = s.dcwd[L] && s.fs[lc(s.dcwd[L])] ? s.dcwd[L] : L + '\\';
    return { out: [] };
  }
  const dirDate = iso => { const d = new Date(String(iso || BASE)); const p2 = n => ('0' + n).slice(-2); let h = d.getHours(); const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12; return `${p2(d.getMonth() + 1)}/${p2(d.getDate())}/${d.getFullYear()}  ${p2(h)}:${p2(d.getMinutes())} ${ap}`; };
  // locate a path for file commands: { s (owner sys), key, bits, disp } | { err }
  function locate(E, raw) {
    const r = winResolve(E, raw);
    if (r.kind === 'bad') return { err: ['The filename, directory name, or volume label syntax is incorrect.'] };
    if (r.kind === 'unc') {
      const o = openShare(E, r.host, r.share);
      if (o.err) return { err: o.code === 53 ? ['The network path was not found.'] : o.code === 67 ? ['The network name cannot be found.'] : ['Access is denied.'], code: o.code };
      const key = lc(winNorm(o.sh.path.replace(/\\$/, '') + (r.rest ? '\\' + r.rest : '')));
      const parent = parentKey(key);
      const bitsFor = k => o.s.fs[k] ? (shareBits(o.sh, o.sids) & ntfsBits(o.s, k, o.sids)) : 0;
      return { s: o.s, key, parent, bitsFor, disp: r.disp || raw, remote: true, user: o.user, host: o.d.name, share: o.sh.name };
    }
    const sids = tokenOf(E.sys, E.user, 'local', E.admin ? true : false);
    const bitsFor = k => E.sys.fs[k] ? ntfsBits(E.sys, k, sids) : 0;
    return { s: E.sys, key: r.key, parent: parentKey(r.key), bitsFor, disp: r.path, remote: false, user: E.user };
  }
  function winDir(E, a) {
    const s0 = E.sys;
    const paths = a.filter(t => !/^\//.test(t));
    const raw = paths[0] || winCwd(E);
    const L0 = locate(E, raw);
    if (L0.err) return { out: L0.err };
    const s = L0.s; const e = s.fs[L0.key];
    if (!e) {
      if (L0.parent && s.fs[L0.parent]) return { out: [` Volume in drive ${volLetter(E, raw)} is Data`, ' Volume Serial Number is 6A3C-1F2E', '', ` Directory of ${dispDir(L0.disp, true)}`, '', 'File Not Found'] };
      return { out: ['The system cannot find the path specified.'] };
    }
    const dirKey = e.dir ? L0.key : L0.parent;
    if (!(L0.bitsFor(dirKey) & 1)) return { out: ['Access is denied.'], denied: true, view: true };
    const kids = e.dir ? Object.keys(s.fs).filter(k => parentKey(k) === L0.key).sort().map(k => s.fs[k]) : [e];
    const out = [` Volume in drive ${volLetter(E, raw)} is ${/^c:/i.test(s.fs[dirKey].path) ? 'Windows' : 'Data'}`, ' Volume Serial Number is 6A3C-1F2E', '', ` Directory of ${e.dir ? dispDir(L0.disp) : dispDir(L0.disp, true)}`, ''];
    const isRoot = /^[a-z]:\\$/i.test(e.path) && !L0.remote;
    let nf = 0, nd = 0, bytes = 0;
    if (e.dir && !isRoot) {
      out.push(dirDate(e.mtime) + '    <DIR>          .', dirDate(e.mtime) + '    <DIR>          ..'); nd += 2;
    }
    kids.forEach(k => {
      const nm = k.path.split('\\').pop();
      if (k.dir) { out.push(dirDate(k.mtime) + '    <DIR>          ' + nm); nd++; }
      else { out.push(dirDate(k.mtime) + padS(comma(k.size || 0), 18) + ' ' + nm); nf++; bytes += k.size || 0; }
    });
    out.push(padS(nf, 16) + ' File(s) ' + padS(comma(bytes), 14) + ' bytes', padS(nd, 16) + ' Dir(s)  ' + padS(comma(402123456512), 14) + ' bytes free');
    return { out, view: true };
  }
  const dispDir = (p, parent) => { let x = String(p).replace(/\//g, '\\'); if (parent) x = x.replace(/\\[^\\]*$/, '') || x; if (/^[a-z]:$/i.test(x)) x += '\\'; return x; };
  const volLetter = (E, raw) => { const m = /^([a-z]):/i.exec(raw) || /^([a-z]):/i.exec(winCwd(E)); return /^\\\\/.test(raw) ? raw.replace(/^(\\\\[^\\]+\\[^\\]+).*$/, '$1') : (m ? m[1].toUpperCase() : 'C'); };
  function winType(E, a) {
    if (!a.length) return { out: ['The syntax of the command is incorrect.'] };
    const L0 = locate(E, a[0]); if (L0.err) return { out: L0.err };
    const e = L0.s.fs[L0.key];
    if (!e) return { out: ['The system cannot find the file specified.'] };
    if (e.dir) return { out: ['Access is denied.'] };
    if (!(L0.bitsFor(L0.key) & 1)) return { out: ['Access is denied.'], denied: true };
    return { out: String(e.content || '').split('\n'), view: true };
  }
  function winDel(E, a) {
    const files = a.filter(t => !/^\//.test(t));
    if (!files.length) return { out: ['The syntax of the command is incorrect.'] };
    const out = []; let changed = false; const ev = [];
    for (const f of files) {
      const L0 = locate(E, f); if (L0.err) { out.push(...L0.err); continue; }
      const e = L0.s.fs[L0.key];
      if (!e) { out.push(`Could Not Find ${L0.remote ? L0.disp : (winResolve(E, f).path || f)}`); continue; }
      if (e.dir) { out.push(`${L0.disp}\\*, Are you sure (Y/N)? `, HINT('(ระบบจำลองไม่รองรับการลบทั้งโฟลเดอร์ ให้ระบุชื่อไฟล์)')); continue; }
      const can = (L0.bitsFor(L0.key) & 8) || (L0.bitsFor(L0.parent) === 63);
      ev.push({ op: 'delete', path: e.path, ok: !!can, user: L0.user, remote: L0.remote });
      if (!can) { out.push(L0.disp, 'Access is denied.'); continue; }
      delete L0.s.fs[L0.key]; changed = true;
    }
    return { out, changed, ev };
  }
  function winEcho(E, raw) {
    const m = /^\s*echo\s?(.*?)\s*(>>?)\s*(.+?)\s*$/i.exec(raw);
    if (!m) return null;
    const text = m[1], append = m[2] === '>>', target = m[3].replace(/^"|"$/g, '');
    const L0 = locate(E, target);
    if (L0.err) return { out: L0.err };
    const s = L0.s; const e = s.fs[L0.key];
    if (!L0.parent || !s.fs[L0.parent] || !s.fs[L0.parent].dir) return { out: ['The system cannot find the path specified.'] };
    if (e && e.dir) return { out: ['Access is denied.'] };
    const can = e ? (L0.bitsFor(L0.key) & 4) : (L0.bitsFor(L0.parent) & 4);
    const ev = [{ op: 'write', path: e ? e.path : s.fs[L0.parent].path + '\\' + L0.key.split('\\').pop(), ok: !!can, user: L0.user, remote: L0.remote, created: !e }];
    if (!can) return { out: ['Access is denied.'], ev, denied: true };
    const line = (text === '' ? 'ECHO is on.' : text) + '\r\n';
    if (e) { e.content = append ? (e.content || '') + line : line; e.size = e.content.length; e.mtime = nowIso(); }
    else {
      const name = target.replace(/\//g, '\\').split('\\').pop();
      s.fs[L0.key] = { path: s.fs[L0.parent].path.replace(/\\$/, '') + '\\' + name, dir: false, acl: [], protect: false, size: line.length, mtime: nowIso(), owner: L0.user, content: line, by: L0.user, viaNet: L0.remote };
    }
    return { out: [], changed: true, ev };
  }

  WIN.driveStatus = (net, hostId, user, dv) => { const s = sysOf(net, hostId, 'windows', user); return driveStatus({ net, hostId, user, sys: s }, dv); };
  WIN.handles = function (line) {
    const t = cmdSplit(firstStage(line)); const c = lc(t[0] || '').replace(/\.exe$/, '');
    if (['net', 'icacls', 'cd', 'chdir', 'dir', 'type', 'del', 'erase'].includes(c)) return true;
    if (/^[a-z]:\\?$/i.test(t[0] || '') && t.length === 1) return true;
    if (/^cd[\\.]/i.test(t[0] || '')) return true;
    if (c === 'echo' && /^[^"]*(?:"[^"]*"[^"]*)*>/.test(String(line).replace(/^\s*echo/i, ''))) return true;
    return false;
  };
  WIN.run = function (E, line) {
    const st = firstStage(line);
    const t = cmdSplit(st);
    let c = lc(t[0] || '').replace(/\.exe$/, '');
    const a = t.slice(1);
    if (/^cd[\\.]/i.test(t[0] || '')) return Object.assign({ cmd: 'cd' }, winCd(E, [t[0].slice(2)].concat(a)));
    if (/^[a-z]:\\?$/i.test(t[0] || '') && t.length === 1) return Object.assign({ cmd: 'drive' }, winDrive(E, t[0].slice(0, 2)));
    if (c === 'echo') return Object.assign({ cmd: 'echo' }, winEcho(E, st) || { out: [] });
    if (c === 'cd' || c === 'chdir') return Object.assign({ cmd: 'cd' }, winCd(E, a, st));
    if (c === 'dir') return Object.assign({ cmd: 'dir' }, winDir(E, a));
    if (c === 'type') return Object.assign({ cmd: 'type' }, winType(E, a));
    if (c === 'del' || c === 'erase') return Object.assign({ cmd: 'del' }, winDel(E, a));
    if (c === 'icacls') return Object.assign({ cmd: 'icacls' }, icacls(E, a));
    // net
    const sub = lc(a[0] || '');
    const rest = a.slice(1);
    let r;
    if (sub === 'user' || sub === 'users') r = Object.assign({ cmd: 'net user' }, netUser(E, rest));
    else if (sub === 'localgroup') r = Object.assign({ cmd: 'net localgroup' }, netLocalgroup(E, rest));
    else if (sub === 'share') r = Object.assign({ cmd: 'net share' }, netShare(E, rest));
    else if (sub === 'use') r = Object.assign({ cmd: 'net use' }, netUse(E, rest));
    else if (sub === 'view') r = Object.assign({ cmd: 'net view' }, netView(E, rest));
    else if (sub === 'helpmsg') { const n = parseInt(rest[0], 10); r = { cmd: 'net helpmsg', out: HELPMSG[n] ? ['', HELPMSG[n], ''] : [`${rest[0] || ''} is not a valid Windows network message number.`, '', 'More help is available by typing NET HELPMSG 3871.', ''] }; }
    else if (!sub || sub === '/?' || sub === 'help') r = { cmd: 'net', out: sub === 'help' && rest[0] ? [HINT(`(ระบบจำลอง: ใช้ net ${rest[0]} /? เพื่อดูรูปแบบคำสั่ง)`)] : NET_SYNTAX };
    else if (['accounts', 'computer', 'config', 'continue', 'file', 'group', 'pause', 'session', 'start', 'statistics', 'stop', 'time'].includes(sub)) r = { cmd: 'net', out: [HINT('(ระบบจำลองรองรับ net user, net localgroup, net share, net use, net view และ net helpmsg)')] };
    else r = { cmd: 'net', out: NET_SYNTAX };
    return r;
  };

  // ================================================================== LINUX
  const LX = {};
  LX.make = function (spec, sessionUser) {
    spec = spec || {};
    const s = { kind: 'linux', v: 1, host: spec.host || 'linux', users: [], groups: [], fs: {}, cwd: null };
    const U = (name, uid, gid, gecos, home, shell, pw) => s.users.push({ name, uid, gid, gecos, home, shell, pw: pw || '*', chg: dayNo(BASE) });
    U('root', 0, 0, 'root', '/root', '/bin/bash', 'set'); U('daemon', 1, 1, 'daemon', '/usr/sbin', '/usr/sbin/nologin'); U('bin', 2, 2, 'bin', '/bin', '/usr/sbin/nologin');
    U('sys', 3, 3, 'sys', '/dev', '/usr/sbin/nologin'); U('www-data', 33, 33, 'www-data', '/var/www', '/usr/sbin/nologin'); U('nobody', 65534, 65534, 'nobody', '/nonexistent', '/usr/sbin/nologin');
    const G = (name, gid, members) => s.groups.push({ name, gid, members: members || [] });
    G('root', 0); G('daemon', 1); G('bin', 2); G('sys', 3); G('adm', 4); G('sudo', 27); G('www-data', 33); G('shadow', 42); G('staff', 50); G('users', 100); G('nogroup', 65534);
    const put = (p, o) => { s.fs[p] = Object.assign({ path: p, dir: true, mode: 0o755, owner: 'root', group: 'root', mtime: BASE, size: 4096 }, o || {}); };
    put('/'); put('/root', { mode: 0o700 }); put('/home'); put('/etc'); put('/srv'); put('/tmp', { mode: 0o1777 }); put('/var'); put('/usr');
    put('/etc/passwd', { dir: false, mode: 0o644, size: 0 }); put('/etc/group', { dir: false, mode: 0o644, size: 0 }); put('/etc/shadow', { dir: false, mode: 0o640, group: 'shadow', size: 0 });
    const addUser = (u) => {
      if (s.users.some(x => x.name === u.name)) return;
      const uid = u.uid || nextId(s.users.map(x => x.uid));
      let gid = s.groups.some(g => g.gid === uid) ? nextId(s.groups.map(g => g.gid)) : uid;
      if (!s.groups.some(g => g.name === u.name)) G(u.name, gid); else gid = s.groups.find(g => g.name === u.name).gid;
      s.users.push({ name: u.name, uid, gid, gecos: u.gecos !== undefined ? u.gecos : ',,,', home: '/home/' + u.name, shell: u.shell || '/bin/bash', pw: u.pw || 'set', chg: dayNo(BASE) });
      if (u.home !== false) put('/home/' + u.name, { mode: 0o750, owner: u.name, group: u.name });
      (u.groups || []).forEach(gn => { const g = s.groups.find(x => x.name === gn); if (g && !g.members.includes(u.name)) g.members.push(u.name); });
    };
    if (sessionUser && sessionUser !== 'root') addUser({ name: sessionUser, uid: 1000, groups: ['adm', 'sudo'] });
    (spec.groups || []).forEach(g => { const ex = s.groups.find(x => x.name === g.name); if (ex) { (g.members || []).forEach(m => { if (!ex.members.includes(m)) ex.members.push(m); }); } else G(g.name, g.gid || nextId(s.groups.map(x => x.gid).concat(s.users.map(x => x.uid))), (g.members || []).slice()); });
    (spec.users || []).forEach(addUser);
    (spec.files || []).forEach(f => {
      const parts = f.path.split('/'); for (let i = 2; i < parts.length; i++) { const p = parts.slice(0, i).join('/'); if (!s.fs[p]) put(p); }
      put(f.path, { dir: !!f.dir, mode: f.mode, owner: f.owner || 'root', group: f.group || 'root', size: f.dir ? 4096 : (f.size || 0), mtime: f.mtime || BASE, content: f.content });
    });
    return s;
  };
  // Debian/Ubuntu shadow accepts relaxed names; only these are refused
  const validName = n => !!n && n.length <= 32 && !/^[-+~]/.test(n) && !/[:,\s/\\]/.test(n) && !/^\d+$/.test(n) && n !== '.' && n !== '..';
  const nextId = ids => { let n = 1000; ids.filter(x => x >= 1000 && x < 60000).forEach(x => { if (x >= n) n = x + 1; }); return n; };
  const lUser = (s, n) => s.users.find(u => u.name === n);
  const lGroup = (s, n) => s.groups.find(g => g.name === n || (/^\d+$/.test(n) && g.gid === +n));
  const lGroupById = (s, gid) => s.groups.find(g => g.gid === gid);
  const memberOf = (s, u) => s.groups.filter(g => g.gid === u.gid || g.members.includes(u.name));
  function lnxNorm(cwd, p) {
    let path = String(p || '');
    if (!path.startsWith('/')) path = (cwd === '/' ? '' : cwd) + '/' + path;
    const out = [];
    path.split('/').forEach(x => { if (!x || x === '.') return; if (x === '..') out.pop(); else out.push(x); });
    return '/' + out.join('/');
  }
  const lParent = p => p === '/' ? null : (p.slice(0, p.lastIndexOf('/')) || '/');
  function lCwd(E) { const s = E.sys; if (s.cwd && s.fs[s.cwd]) return s.cwd; const u = lUser(s, E.user); return u ? u.home : '/'; }
  function lExpand(E, p) { if (p === '~' || p.startsWith('~/')) { const u = lUser(E.sys, E.user); return (u ? u.home : '/root') + p.slice(1); } return p; }
  // permission check for user u on entry e: want 4 r, 2 w, 1 x
  function lCan(s, user, e, want) {
    if (user === 'root') return want !== 1 || e.dir || (e.mode & 0o111) !== 0;
    const u = lUser(s, user); if (!u) return false;
    let sh;
    if (e.owner === user) sh = 6; else if (memberOf(s, u).some(g => g.name === e.group)) sh = 3; else sh = 0;
    return ((e.mode >> sh) & want) === want;
  }
  function lTraverse(s, user, path) {
    let p = lParent(path);
    const chain = [];
    while (p) { chain.unshift(p); p = lParent(p); }
    return chain.every(x => !s.fs[x] || lCan(s, user, s.fs[x], 1));
  }
  function modeStr(e) {
    const m = e.mode, t = e.dir ? 'd' : '-';
    const tri = (r, w, x, special, ch) => (r ? 'r' : '-') + (w ? 'w' : '-') + (special ? (x ? ch : ch.toUpperCase()) : (x ? 'x' : '-'));
    return t + tri(m & 0o400, m & 0o200, m & 0o100, m & 0o4000, 's') + tri(m & 0o40, m & 0o20, m & 0o10, m & 0o2000, 's') + tri(m & 4, m & 2, m & 1, m & 0o1000, 't');
  }
  const MONS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const lsDate = iso => { const d = new Date(String(iso || BASE)); const p2 = n => ('0' + n).slice(-2); return `${MONS[d.getMonth()]} ${padS(d.getDate(), 2)} ${p2(d.getHours())}:${p2(d.getMinutes())}`; };
  const kids = (s, p) => Object.keys(s.fs).filter(k => k !== p && lParent(k) === p).sort((a, b) => lc(a.split('/').pop()) < lc(b.split('/').pop()) ? -1 : 1);
  function lsLong(s, rows) {
    const nl = e => e.dir ? 2 + kids(s, e.path).filter(k => s.fs[k].dir).length : 1;
    const w = { n: 1, o: 1, g: 1, z: 1 };
    rows.forEach(([e]) => { w.n = Math.max(w.n, String(nl(e)).length); w.o = Math.max(w.o, e.owner.length); w.g = Math.max(w.g, e.group.length); w.z = Math.max(w.z, String(e.dir ? 4096 : e.size || 0).length); });
    return rows.map(([e, name]) => `${modeStr(e)} ${padS(nl(e), w.n)} ${e.owner.padEnd(w.o)} ${e.group.padEnd(w.g)} ${padS(e.dir ? 4096 : e.size || 0, w.z)} ${lsDate(e.mtime)} ${name}`);
  }
  function lnxLs(E, a) {
    const s = E.sys; const fl = {}; const paths = [];
    for (const t of a) {
      if (t === '--help') return { out: ['Usage: ls [OPTION]... [FILE]...', 'List information about the FILEs (the current directory by default).', '', '  -a, --all                  do not ignore entries starting with .', '  -d, --directory            list directories themselves, not their contents', '  -l                         use a long listing format', '  -h, --human-readable       with -l, print sizes like 1K 234M 2G etc.'] };
      if (/^--/.test(t)) { if (t === '--all') fl.a = true; else if (t === '--directory') fl.d = true; continue; }
      if (/^-[a-zA-Z]+$/.test(t)) { for (const ch of t.slice(1)) { if (!/[ladhAF1tr]/.test(ch)) return { out: [`ls: invalid option -- '${ch}'`, "Try 'ls --help' for more information."] }; fl[ch] = true; } continue; }
      paths.push(t);
    }
    if (!paths.length) paths.push('.');
    const out = []; const files = []; const dirs = [];
    let err = false;
    for (const p of paths) {
      const full = lnxNorm(lCwd(E), lExpand(E, p));
      const e = s.fs[full];
      if (!e || !lTraverse(s, E.user, full)) { out.push(`ls: cannot access '${p}': ${!e && lTraverse(s, E.user, full) ? 'No such file or directory' : 'Permission denied'}`); err = true; continue; }
      if (e.dir && !fl.d) dirs.push([p, full, e]); else files.push([e, p]);
    }
    if (files.length) { if (fl.l) out.push(...lsLong(s, files)); else out.push(files.map(f => f[1]).join('  ')); }
    dirs.forEach(([p, full, e], i) => {
      if (paths.length > 1) { if (files.length || i > 0 || out.length) out.push(''); out.push(p + ':'); }
      if (!lCan(s, E.user, e, 4)) { out.push(`ls: cannot open directory '${p}': Permission denied`); err = true; return; }
      let ks = kids(s, full).map(k => [s.fs[k], k.split('/').pop()]);
      if (!fl.a) ks = ks.filter(x => !x[1].startsWith('.'));
      if (fl.a) { const par = s.fs[lParent(full) || '/']; ks = [[e, '.'], [par || e, '..']].concat(ks); }
      if (fl.l) {
        if (!lCan(s, E.user, e, 1) && E.user !== 'root') { ks.forEach(x => out.push(`ls: cannot access '${(p === '.' ? '' : p.replace(/\/$/, '') + '/') + x[1]}': Permission denied`)); return; }
        out.push('total ' + ks.reduce((n, x) => n + (x[0].dir ? 4 : Math.ceil((x[0].size || 0) / 4096) * 4), 0));
        out.push(...lsLong(s, ks));
      } else if (ks.length) out.push(ks.map(x => x[1]).join('  '));
    });
    return { out, view: true, err };
  }
  function lnxCd(E, a) {
    const s = E.sys;
    const p = a[0] === undefined ? '~' : a[0];
    if (a.length > 1) return { out: ['-bash: cd: too many arguments'] };
    const full = lnxNorm(lCwd(E), lExpand(E, p));
    const e = s.fs[full];
    if (!e) return { out: [`-bash: cd: ${p}: No such file or directory`] };
    if (!e.dir) return { out: [`-bash: cd: ${p}: Not a directory`] };
    if (!lTraverse(s, E.user, full) || !lCan(s, E.user, e, 1)) return { out: [`-bash: cd: ${p}: Permission denied`] };
    if (E.sessionUser === E.user) s.cwd = full;
    return { out: [] };
  }
  const umaskOf = (E) => E.user === 'root' ? 0o022 : 0o002;
  function lCreate(E, p, dir, cmdName) {
    const s = E.sys; const full = lnxNorm(lCwd(E), lExpand(E, p)); const par = lParent(full);
    const q = cmdName === 'mkdir' ? `‘${p}’` : `'${p}'`;
    if (s.fs[full]) { if (dir) return [`mkdir: cannot create directory ${q}: File exists`]; if (!lCan(s, E.user, s.fs[full], 2) && s.fs[full].owner !== E.user && E.user !== 'root') return [`touch: cannot touch ${q}: Permission denied`]; s.fs[full].mtime = nowIso(); return []; }
    if (!par || !s.fs[par]) return [`${cmdName}: cannot ${dir ? 'create directory' : 'touch'} ${q}: No such file or directory`];
    if (!lTraverse(s, E.user, full) || !lCan(s, E.user, s.fs[par], 2) || !lCan(s, E.user, s.fs[par], 1)) return [`${cmdName}: cannot ${dir ? 'create directory' : 'touch'} ${q}: Permission denied`];
    const u = lUser(s, E.user) || { gid: 0 };
    const g = (s.fs[par].mode & 0o2000) ? s.fs[par].group : ((lGroupById(s, u.gid) || { name: E.user }).name);
    s.fs[full] = { path: full, dir, mode: (dir ? 0o777 : 0o666) & ~umaskOf(E) | (dir && (s.fs[par].mode & 0o2000) ? 0o2000 : 0), owner: E.user, group: g, mtime: nowIso(), size: dir ? 4096 : 0 };
    return null;
  }
  function lnxMkdir(E, a) {
    const p = a.includes('-p'); const list = a.filter(x => !/^-/.test(x));
    if (!list.length) return { out: ['mkdir: missing operand', "Try 'mkdir --help' for more information."] };
    const out = []; let changed = false;
    list.forEach(x => {
      if (p) { const full = lnxNorm(lCwd(E), lExpand(E, x)); const parts = full.split('/').filter(Boolean); let cur = ''; for (const part of parts) { cur += '/' + part; if (!E.sys.fs[cur]) { const r = lCreate(E, cur, true, 'mkdir'); if (r) { out.push(...r); return; } changed = true; } } return; }
      const r = lCreate(E, x, true, 'mkdir'); if (r) out.push(...r); else changed = true;
    });
    return { out, changed };
  }
  function lnxTouch(E, a) {
    const list = a.filter(x => !/^-/.test(x));
    if (!list.length) return { out: ['touch: missing file operand', "Try 'touch --help' for more information."] };
    const out = []; let changed = false;
    list.forEach(x => { const r = lCreate(E, x, false, 'touch'); if (r && r.length) out.push(...r); else changed = true; });
    return { out, changed };
  }
  function eachTarget(E, list, rec, fn) {
    const s = E.sys; const out = []; let changed = false;
    list.forEach(p => {
      const full = lnxNorm(lCwd(E), lExpand(E, p));
      const e = s.fs[full];
      if (!e || !lTraverse(s, E.user, full)) { out.push(`${E.cmd}: cannot access '${p}': ${e ? 'Permission denied' : 'No such file or directory'}`); return; }
      const all = [full].concat(rec && e.dir ? Object.keys(s.fs).filter(k => k.startsWith(full === '/' ? '/' : full + '/') && k !== full).sort() : []);
      all.forEach((k, i) => { const r = fn(s.fs[k], i === 0 ? p : k); if (r) out.push(r); else changed = true; });
    });
    return { out, changed };
  }
  function parseSymbolic(spec, e, umask) {
    let mode = e.mode;
    for (const clause of spec.split(',')) {
      const m = /^([ugoa]*)([-+=])([rwxXst]*)$/.exec(clause);
      if (!m) return null;
      const who = m[1] || 'a'; const noWho = !m[1];
      let bits = 0;
      for (const ch of m[3]) {
        if (ch === 'r') bits |= 0o444; else if (ch === 'w') bits |= 0o222; else if (ch === 'x') bits |= 0o111;
        else if (ch === 'X') { if (e.dir || (e.mode & 0o111)) bits |= 0o111; }
        else if (ch === 's') bits |= 0o6000; else if (ch === 't') bits |= 0o1000;
      }
      let mask = 0;
      if (/[ua]/.test(who)) mask |= 0o4700; if (/[ga]/.test(who)) mask |= 0o2070; if (/[oa]/.test(who)) mask |= 0o1007;
      let affect = (mask & 0o777) | (bits & 0o7000 ? mask & 0o7000 : 0);
      if (noWho) affect &= ~umask;
      if (m[2] === '+') mode |= bits & affect;
      else if (m[2] === '-') mode &= ~(bits & affect);
      else mode = (mode & ~affect) | (bits & affect);
    }
    return mode;
  }
  function lnxChmod(E, a) {
    E.cmd = 'chmod';
    const rec = a.some(x => x === '-R' || x === '--recursive');
    const args = a.filter(x => x !== '-R' && x !== '--recursive' && x !== '-v' && x !== '-c');
    if (args.some(x => x === '--help')) return { out: ['Usage: chmod [OPTION]... MODE[,MODE]... FILE...', '  or:  chmod [OPTION]... OCTAL-MODE FILE...', 'Change the mode of each FILE to MODE.', '', '  -R, --recursive        change files and directories recursively', '', 'Each MODE is of the form \'[ugoa]*([-+=]([rwxXst]*|[ugo]))+|[-+=][0-7]+\'.'] };
    if (!args.length) return { out: ['chmod: missing operand', "Try 'chmod --help' for more information."] };
    const spec = args[0];
    if (args.length < 2) return { out: [`chmod: missing operand after ‘${spec}’`, "Try 'chmod --help' for more information."] };
    const numeric = /^[0-7]{1,4}$/.test(spec);
    if (!numeric && !/^([ugoa]*[-+=][rwxXst]*)(,[ugoa]*[-+=][rwxXst]*)*$/.test(spec)) return { out: [`chmod: invalid mode: ‘${spec}’`, "Try 'chmod --help' for more information."] };
    const r = eachTarget(E, args.slice(1), rec, (e, disp) => {
      if (E.user !== 'root' && e.owner !== E.user) return `chmod: changing permissions of '${disp}': Operation not permitted`;
      let nm;
      if (numeric) { const v = parseInt(spec, 8); nm = e.dir ? (e.mode & 0o6000) | v : v; }
      else nm = parseSymbolic(spec, e, umaskOf(E));
      e.mode = nm; e.ctime = nowIso();
      return null;
    });
    return r;
  }
  function lnxChown(E, a, grpOnly) {
    E.cmd = grpOnly ? 'chgrp' : 'chown';
    const rec = a.some(x => x === '-R' || x === '--recursive');
    const args = a.filter(x => !/^-/.test(x));
    if (a.includes('--help')) return { out: grpOnly ? ['Usage: chgrp [OPTION]... GROUP FILE...', 'Change the group of each FILE to GROUP.'] : ['Usage: chown [OPTION]... [OWNER][:[GROUP]] FILE...', 'Change the owner and/or group of each FILE to OWNER and/or GROUP.', '', '  -R, --recursive        operate on files and directories recursively'] };
    if (!args.length) return { out: [`${E.cmd}: missing operand`, `Try '${E.cmd} --help' for more information.`] };
    if (args.length < 2) return { out: [`${E.cmd}: missing operand after ‘${args[0]}’`, `Try '${E.cmd} --help' for more information.`] };
    const s = E.sys; const spec = args[0];
    let owner = null, group = null;
    if (grpOnly) { group = spec; }
    else {
      const m = /^([^:.]*)(?:[:.](.*))?$/.exec(spec);
      owner = m[1] || null; group = m[2] !== undefined ? (m[2] || (owner ? '' : null)) : null;
      if (owner && !lUser(s, owner)) return { out: [`chown: invalid user: ‘${spec}’`] };
      if (group === '' && owner) group = (lGroupById(s, lUser(s, owner).gid) || {}).name;
    }
    if (group && !lGroup(s, group)) return { out: grpOnly ? [`chgrp: invalid group: ‘${group}’`] : [`chown: invalid group: ‘${spec}’`] };
    if (group) group = lGroup(s, group).name;
    return eachTarget(E, args.slice(1), rec, (e, disp) => {
      if (E.user !== 'root') {
        const u = lUser(s, E.user);
        const ownerOk = !owner || owner === e.owner;
        const grpOk = !group || (u && memberOf(s, u).some(g => g.name === group));
        if (!(e.owner === E.user && ownerOk && grpOk)) return grpOnly ? `chgrp: changing group of '${disp}': Operation not permitted` : `chown: changing ownership of '${disp}': Operation not permitted`;
      }
      if (owner) e.owner = owner;
      if (group) e.group = group;
      if (!e.dir) e.mode &= ~0o6000;   // the kernel clears setuid/setgid on chown of a regular file
      return null;
    });
  }
  const USERADD_USAGE = ['Usage: useradd [options] LOGIN', '       useradd -D', '       useradd -D [options]', '', 'Options:', '  -c, --comment COMMENT         GECOS field of the new account', '  -d, --home-dir HOME_DIR       home directory of the new account',
    '  -g, --gid GROUP               name or ID of the primary group of the new', '                                account', '  -G, --groups GROUPS           list of supplementary groups of the new', '                                account', '  -m, --create-home             create the user\'s home directory',
    '  -M, --no-create-home          do not create the user\'s home directory', '  -N, --no-user-group           do not create a group with the same name as', '                                the user', '  -s, --shell SHELL             login shell of the new account', '  -u, --uid UID                 user ID of the new account', ''];
  const USERMOD_USAGE = ['Usage: usermod [options] LOGIN', '', 'Options:', '  -a, --append                  append the user to the supplemental GROUPS', '                                mentioned by the -G option without removing', '                                the user from other groups',
    '  -c, --comment COMMENT         new value of the GECOS field', '  -d, --home HOME_DIR           new home directory for the user account', '  -G, --groups GROUPS           new list of supplementary GROUPS', '  -L, --lock                    lock the user account', '  -s, --shell SHELL             new login shell for the user account', '  -U, --unlock                  unlock the user account', ''];
  function parseOpts(a, withVal, long) {
    const o = {}; const pos = []; let bad = null;
    for (let i = 0; i < a.length; i++) {
      let t = a[i];
      if (long && /^--/.test(t)) { const [k, v] = t.slice(2).split('='); const sh = long[k]; if (!sh) { bad = { long: t }; break; } if (withVal.includes(sh)) o[sh] = v !== undefined ? v : a[++i]; else o[sh] = true; continue; }
      if (/^-[A-Za-z]+$/.test(t)) {
        for (let j = 1; j < t.length; j++) {
          const ch = t[j];
          if (withVal.includes(ch)) { o[ch] = j < t.length - 1 ? t.slice(j + 1) : a[++i]; if (o[ch] === undefined) bad = { missing: ch }; break; }
          o[ch] = true;
        }
        if (bad) break;
        continue;
      }
      pos.push(t);
    }
    return { o, pos, bad };
  }
  const NOT_ROOT = n => [`${n}: Permission denied.`, `${n}: cannot lock /etc/passwd; try again later.`];
  function lnxUseradd(E, a) {
    const s = E.sys;
    const { o, pos, bad } = parseOpts(a, ['c', 'd', 'g', 'G', 's', 'u'], { comment: 'c', 'home-dir': 'd', gid: 'g', groups: 'G', 'create-home': 'm', 'no-create-home': 'M', 'no-user-group': 'N', shell: 's', uid: 'u', help: 'h' });
    if (o.h) return { out: USERADD_USAGE };
    if (bad) return { out: (bad.long ? [`useradd: unrecognized option '${bad.long}'`] : bad.missing ? [`useradd: option requires an argument -- '${bad.missing}'`] : []).concat(USERADD_USAGE) };
    const unk = Object.keys(o).find(k => !'cdgGsumMNh'.includes(k)); if (unk) return { out: [`useradd: invalid option -- '${unk}'`].concat(USERADD_USAGE) };
    if (pos.length !== 1) return { out: USERADD_USAGE };
    if (!E.root) return { out: NOT_ROOT('useradd') };
    const name = pos[0];
    if (!validName(name)) return { out: [`useradd: invalid user name '${name}'`] };
    if (lUser(s, name)) return { out: [`useradd: user '${name}' already exists`] };
    const sup = o.G ? String(o.G).split(',').filter(Boolean) : [];
    for (const g of sup) if (!lGroup(s, g)) return { out: [`useradd: group '${g}' does not exist`] };
    if (o.g && !lGroup(s, o.g)) return { out: [`useradd: group '${o.g}' does not exist`] };
    if (!o.g && !o.N && lGroup(s, name)) return { out: [`useradd: group ${name} exists - if you want to add this user to that group, use -g.`] };
    const uid = o.u ? +o.u : nextId(s.users.map(x => x.uid));
    let gid;
    if (o.g) gid = lGroup(s, o.g).gid;
    else if (o.N) gid = 100;
    else { gid = s.groups.some(g => g.gid === uid) ? nextId(s.groups.map(g => g.gid)) : uid; s.groups.push({ name, gid, members: [] }); }
    const home = o.d || '/home/' + name;
    s.users.push({ name, uid, gid, gecos: o.c || '', home, shell: o.s || '/bin/sh', pw: '!', chg: dayNo(nowIso()), created: true });
    sup.forEach(g => { const G = lGroup(s, g); if (!G.members.includes(name)) G.members.push(name); });
    if (o.m) {
      if (s.fs[home]) return { out: [`useradd: warning: the home directory ${home} already exists.`, 'useradd: Not copying any file from skel directory into it.'], changed: true };
      s.fs[home] = { path: home, dir: true, mode: 0o750, owner: name, group: (lGroupById(s, gid) || { name }).name, mtime: nowIso(), size: 4096 };
    }
    return { out: [], changed: true };
  }
  function lnxAdduser(E, a) {
    const s = E.sys; const pos = a.filter(x => !/^-/.test(x));
    if (a.includes('--help') || a.includes('-h')) return { out: ['adduser [--home DIR] [--shell SHELL] [--no-create-home] [--uid ID]', '[--firstuid ID] [--lastuid ID] [--gecos GECOS] [--ingroup GROUP | --gid ID]', '[--disabled-password] [--disabled-login] [--add_extra_groups] USER', '   Add a normal user', '', 'adduser USER GROUP', '   Add an existing user to an existing group'] };
    if (!E.root) return { out: ['adduser: Only root may add a user or group to the system.'] };
    if (pos.length === 2) {
      const [un, gn] = pos;
      if (!lUser(s, un)) return { out: [`adduser: The user \`${un}' does not exist.`] };
      const g = lGroup(s, gn); if (!g) return { out: [`adduser: The group \`${gn}' does not exist.`] };
      if (g.members.includes(un) || g.gid === lUser(s, un).gid) return { out: [`The user \`${un}' is already a member of \`${gn}'.`] };
      g.members.push(un);
      return { out: [`Adding user \`${un}' to group \`${gn}' ...`, `Adding user ${un} to group ${gn}`, 'Done.'], changed: true };
    }
    if (pos.length !== 1) return { out: ['adduser: Only one or two names allowed.'] };
    const name = pos[0];
    if (!/^[a-z][-a-z0-9_]*$/.test(name)) return { out: [`adduser: Please enter a username matching the regular expression configured`, 'via the NAME_REGEX configuration variable.  Use the `--force-badname\'', 'option to relax this check or reconfigure NAME_REGEX.'] };
    if (lUser(s, name)) return { out: [`adduser: The user \`${name}' already exists.`] };
    const uid = nextId(s.users.map(x => x.uid));
    const gid = s.groups.some(g => g.gid === uid) ? nextId(s.groups.map(g => g.gid)) : uid;
    s.groups.push({ name, gid, members: [] });
    s.users.push({ name, uid, gid, gecos: ',,,', home: '/home/' + name, shell: '/bin/bash', pw: 'set', chg: dayNo(nowIso()), created: true });
    s.fs['/home/' + name] = { path: '/home/' + name, dir: true, mode: 0o750, owner: name, group: name, mtime: nowIso(), size: 4096 };
    return { out: [`Adding user \`${name}' ...`, `Adding new group \`${name}' (${gid}) ...`, `Adding new user \`${name}' (${uid}) with group \`${name}' ...`, `Creating home directory \`/home/${name}' ...`, "Copying files from `/etc/skel' ...",
      'New password: ', 'Retype new password: ', 'passwd: password updated successfully', `Changing the user information for ${name}`, 'Enter the new value, or press ENTER for the default', '\tFull Name []: ', '\tRoom Number []: ', '\tWork Phone []: ', '\tHome Phone []: ', '\tOther []: ', 'Is the information correct? [Y/n] ',
      HINT('(ระบบจำลอง: ตอบคำถามให้อัตโนมัติ — รหัสผ่านถูกตั้งแล้ว ข้อมูลอื่นเว้นว่าง)')], changed: true };
  }
  function lnxUsermod(E, a) {
    const s = E.sys;
    const { o, pos, bad } = parseOpts(a, ['c', 'd', 'G', 's', 'g', 'l'], { append: 'a', comment: 'c', home: 'd', groups: 'G', lock: 'L', shell: 's', unlock: 'U', gid: 'g', move: 'm', help: 'h' });
    if (o.h) return { out: USERMOD_USAGE };
    if (bad) return { out: (bad.long ? [`usermod: unrecognized option '${bad.long}'`] : [`usermod: option requires an argument -- '${bad.missing}'`]).concat(USERMOD_USAGE) };
    const unk = Object.keys(o).find(k => !'acdGLsUgmlh'.includes(k)); if (unk) return { out: [`usermod: invalid option -- '${unk}'`].concat(USERMOD_USAGE) };
    if (o.a && o.G === undefined) return { out: ['usermod: -a flag is ONLY allowed with the -G flag'].concat(USERMOD_USAGE) };
    if (pos.length !== 1 || !Object.keys(o).length) return { out: USERMOD_USAGE };
    if (!E.root) return { out: NOT_ROOT('usermod') };
    const u = lUser(s, pos[0]); if (!u) return { out: [`usermod: user '${pos[0]}' does not exist`] };
    if (o.G !== undefined) {
      const list = String(o.G).split(',').filter(Boolean);
      for (const g of list) if (!lGroup(s, g)) return { out: [`usermod: group '${g}' does not exist`] };
      if (!o.a) s.groups.forEach(g => { g.members = g.members.filter(m => m !== u.name); });
      list.forEach(g => { const G = lGroup(s, g); if (!G.members.includes(u.name) && G.gid !== u.gid) G.members.push(u.name); });
    }
    if (o.g) { const G = lGroup(s, o.g); if (!G) return { out: [`usermod: group '${o.g}' does not exist`] }; u.gid = G.gid; }
    if (o.c !== undefined) u.gecos = o.c;
    if (o.s) u.shell = o.s;
    if (o.L) u.pw = u.pw === 'set' ? 'locked' : u.pw;
    if (o.U) { if (u.pw === 'locked') u.pw = 'set'; else if (u.pw === '!') return { out: ["usermod: unlocking the user's password would result in a passwordless account.", 'You should set a password with usermod -p to unlock this user\'s password.'] }; }
    return { out: [], changed: true };
  }
  function lnxUserdel(E, a, deluser) {
    const s = E.sys; const pos = a.filter(x => !/^-/.test(x)); const rm = a.includes('-r') || a.includes('--remove') || a.includes('--remove-home');
    const n = deluser ? 'deluser' : 'userdel';
    if (!pos.length) return { out: deluser ? ['deluser: Only one or two names allowed.'] : ['Usage: userdel [options] LOGIN', '', 'Options:', '  -r, --remove                  remove home directory and mail spool'] };
    if (!E.root) return { out: deluser ? ['deluser: Only root may remove a user or group from the system.'] : [`${n}: Permission denied.`, `${n}: cannot lock /etc/passwd; try again later.`] };
    if (deluser && pos.length === 2) {
      const g = lGroup(s, pos[1]); if (!g || !g.members.includes(pos[0])) return { out: [`deluser: The user \`${pos[0]}' is not a member of group \`${pos[1]}'.`] };
      g.members = g.members.filter(m => m !== pos[0]);
      return { out: [`Removing user \`${pos[0]}' from group \`${pos[1]}' ...`, 'Done.'], changed: true };
    }
    const u = lUser(s, pos[0]); if (!u) return { out: deluser ? [`deluser: The user \`${pos[0]}' does not exist.`] : [`userdel: user '${pos[0]}' does not exist`] };
    s.users = s.users.filter(x => x !== u);
    s.groups.forEach(g => { g.members = g.members.filter(m => m !== u.name); });
    const own = s.groups.find(g => g.gid === u.gid && g.name === u.name && !g.members.length); if (own) s.groups = s.groups.filter(g => g !== own);
    if (rm) Object.keys(s.fs).forEach(k => { if (k === u.home || k.startsWith(u.home + '/')) delete s.fs[k]; });
    return { out: deluser ? [`Removing user \`${u.name}' ...`, 'Done.'] : [], changed: true };
  }
  function lnxGroupadd(E, a, del) {
    const s = E.sys; const pos = a.filter(x => !/^-/.test(x)); const n = del ? 'groupdel' : 'groupadd';
    if (pos.length !== 1) return { out: [`Usage: ${n} [options] GROUP`] };
    if (!E.root) return { out: [`${n}: Permission denied.`, `${n}: cannot lock /etc/group; try again later.`] };
    const g = lGroup(s, pos[0]);
    if (del) { if (!g) return { out: [`groupdel: group '${pos[0]}' does not exist`] }; if (s.users.some(u => u.gid === g.gid)) return { out: [`groupdel: cannot remove the primary group of user '${s.users.find(u => u.gid === g.gid).name}'`] }; s.groups = s.groups.filter(x => x !== g); return { out: [], changed: true }; }
    if (g) return { out: [`groupadd: group '${pos[0]}' already exists`] };
    if (!validName(pos[0])) return { out: [`groupadd: '${pos[0]}' is not a valid group name`] };
    s.groups.push({ name: pos[0], gid: nextId(s.groups.map(x => x.gid)), members: [] });
    return { out: [], changed: true };
  }
  function lnxGpasswd(E, a) {
    const s = E.sys;
    const op = a[0], un = a[1], gn = a[2];
    if (!(op === '-a' || op === '-d') || !un || !gn) return { out: ['Usage: gpasswd [option] GROUP', '', 'Options:', '  -a, --add USER                add USER to GROUP', '  -d, --delete USER             remove USER from GROUP'] };
    const g = lGroup(s, gn); if (!g) return { out: [`gpasswd: group '${gn}' does not exist in /etc/group`] };
    if (!E.root) return { out: ['gpasswd: Permission denied.'] };
    if (!lUser(s, un)) return { out: [`gpasswd: user '${un}' does not exist`] };
    if (op === '-a') { if (!g.members.includes(un)) g.members.push(un); return { out: [`Adding user ${un} to group ${gn}`], changed: true }; }
    if (!g.members.includes(un)) return { out: [`gpasswd: user '${un}' is not a member of '${gn}'`] };
    g.members = g.members.filter(m => m !== un);
    return { out: [`Removing user ${un} from group ${gn}`], changed: true };
  }
  const daysToDate = d => { const x = new Date(d * 86400000); return `${('0' + (x.getUTCMonth() + 1)).slice(-2)}/${('0' + x.getUTCDate()).slice(-2)}/${x.getUTCFullYear()}`; };
  function lnxPasswd(E, a) {
    const s = E.sys;
    const flags = a.filter(x => /^-/.test(x)); const pos = a.filter(x => !/^-/.test(x));
    const target = pos[0] || E.user;
    const u = lUser(s, target);
    if (flags.some(f => !['-S', '--status'].includes(f))) return { out: ['Usage: passwd [options] [LOGIN]', '', 'Options:', '  -S, --status                  report password status on the named account', HINT('(ระบบจำลองรองรับ passwd ชื่อผู้ใช้ และ passwd -S ชื่อผู้ใช้ — ล็อกบัญชีใช้ usermod -L)')] };
    if (!u) return { out: [`passwd: user '${target}' does not exist`] };
    if (target !== E.user && !E.root) return { out: [`passwd: You may not view or modify password information for ${target}.`] };
    if (flags.length) {
      const st = u.pw === 'set' ? 'P' : u.pw === 'locked' ? 'L' : u.pw === '' ? 'NP' : 'L';
      return { out: [`${u.name} ${st} ${daysToDate(u.chg || dayNo(BASE))} 0 99999 7 -1`], view: true };
    }
    const out = [];
    if (!E.root) out.push(`Changing password for ${target}.`, 'Current password: ');
    out.push('New password: ', 'Retype new password: ', 'passwd: password updated successfully', HINT('(ระบบจำลอง: สิ่งที่พิมพ์เป็นรหัสผ่านจะไม่แสดงบนจอ ระบบถือว่าพิมพ์ตรงกันทั้งสองครั้ง)'));
    u.pw = 'set'; u.chg = dayNo(nowIso());
    return { out, changed: true };
  }
  function idLine(s, u) {
    const pg = lGroupById(s, u.gid);
    const sup = s.groups.filter(g => g.members.includes(u.name) && g.gid !== u.gid);
    return `uid=${u.uid}(${u.name}) gid=${u.gid}(${pg ? pg.name : u.gid}) groups=` + [pg ? `${pg.gid}(${pg.name})` : String(u.gid)].concat(sup.map(g => `${g.gid}(${g.name})`)).join(',');
  }
  function lnxId(E, a) {
    const s = E.sys; const pos = a.filter(x => !/^-/.test(x));
    const n = pos[0] || E.user; const u = lUser(s, n);
    if (!u) return { out: [`id: ‘${n}’: no such user`] };
    if (a.includes('-Gn') || (a.includes('-G') && a.includes('-n'))) return { out: [memberOf(s, u).sort((x, y) => (x.gid === u.gid ? -1 : y.gid === u.gid ? 1 : 0)).map(g => g.name).join(' ')], view: true, who: u.name };
    return { out: [idLine(s, u)], view: true, who: u.name };
  }
  function lnxGroups(E, a) {
    const s = E.sys;
    if (!a.length) { const u = lUser(s, E.user); return { out: [u ? [lGroupById(s, u.gid)].concat(s.groups.filter(g => g.members.includes(u.name) && g.gid !== u.gid)).filter(Boolean).map(g => g.name).join(' ') : E.user], view: true }; }
    const out = []; const who = [];
    a.forEach(n => { const u = lUser(s, n); if (!u) { out.push(`groups: ‘${n}’: no such user`); return; } who.push(n); out.push(`${n} : ` + [lGroupById(s, u.gid)].concat(s.groups.filter(g => g.members.includes(u.name) && g.gid !== u.gid)).filter(Boolean).map(g => g.name).join(' ')); });
    return { out, view: true, who: who[0] };
  }
  const passwdLine = u => `${u.name}:x:${u.uid}:${u.gid}:${u.gecos}:${u.home}:${u.shell}`;
  const groupLine = g => `${g.name}:x:${g.gid}:${g.members.join(',')}`;
  function lnxGetent(E, a) {
    const s = E.sys; const db = a[0]; const keys = a.slice(1);
    if (db === 'passwd') return { out: (keys.length ? keys.map(k => s.users.find(u => u.name === k || String(u.uid) === k)).filter(Boolean) : s.users).map(passwdLine), view: true, who: keys[0] };
    if (db === 'group') return { out: (keys.length ? keys.map(k => lGroup(s, k)).filter(Boolean) : s.groups).map(groupLine), view: true };
    if (!db) return { out: ['getent: wrong number of arguments', "Try `getent --help' or `getent --usage' for more information."] };
    return { out: [`Unknown database: ${db}`, "Try `getent --help' or `getent --usage' for more information."] };
  }
  function lnxCat(E, a) {
    const s = E.sys; const out = []; let view = false;
    a.forEach(f => {
      const full = lnxNorm(lCwd(E), lExpand(E, f));
      if (full === '/etc/passwd') { out.push(...s.users.map(passwdLine)); view = true; return; }
      if (full === '/etc/group') { out.push(...s.groups.map(groupLine)); view = true; return; }
      if (full === '/etc/shadow') {
        if (E.user !== 'root') { out.push('cat: /etc/shadow: Permission denied'); return; }
        out.push(...s.users.map(u => `${u.name}:${u.pw === 'set' ? '$y$j9T$' + (u.name + 'netlabsim').slice(0, 8) + '$(ระบบจำลอง)' : u.pw === 'locked' ? '!$y$j9T$' + (u.name + 'netlabsim').slice(0, 8) + '$(ระบบจำลอง)' : u.pw === '' ? '' : u.pw}:${u.chg || dayNo(BASE)}:0:99999:7:::`)); view = true; return;
      }
      const e = s.fs[full];
      if (!e) { out.push(`cat: ${f}: No such file or directory`); return; }
      if (e.dir) { out.push(`cat: ${f}: Is a directory`); return; }
      if (!lTraverse(s, E.user, full) || !lCan(s, E.user, e, 4)) { out.push(`cat: ${f}: Permission denied`); return; }
      if (e.content) out.push(...String(e.content).replace(/\n$/, '').split('\n'));
    });
    return { out, view };
  }
  LX.handles = function (line, cmdOnly) {
    const t = shSplit(firstStage(line)); const sp = sudoSplit(t, 'x');
    const c = sp.t[0] || '';
    if (['useradd', 'adduser', 'usermod', 'userdel', 'deluser', 'groupadd', 'groupdel', 'gpasswd', 'passwd', 'id', 'groups', 'getent', 'chmod', 'chown', 'chgrp', 'ls', 'mkdir', 'touch', 'cd', 'pwd'].includes(c)) return true;
    if (c === 'cat') return sp.t.slice(1).some(x => /^\/etc\/(passwd|group|shadow)$/.test(x) || !/^\/etc\/(resolv\.conf|hosts|hostname)$/.test(x));
    return false;
  };
  LX.run = function (E, line) {
    const t0 = shSplit(firstStage(line));
    const sp = sudoSplit(t0, E.user);
    const E2 = Object.assign({}, E, { user: sp.sudo ? sp.user : E.user, root: sp.sudo ? sp.root : E.user === 'root', sessionUser: E.user });
    if (sp.sudo && !lUser(E.sys, E2.user)) return { cmd: 'sudo', out: [`sudo: unknown user ${E2.user}`, 'sudo: error initializing audit plugin sudoers_audit'] };
    const c = sp.t[0] || ''; const a = sp.t.slice(1);
    if (sp.sudo && c === 'cd') return { cmd: 'cd', out: ['sudo: cd: command not found'] };
    if (sp.sudo && !c) return { cmd: 'sudo', out: ['usage: sudo -h | -K | -k | -V', 'usage: sudo [-u user] command'] };
    let r;
    switch (c) {
      case 'useradd': r = lnxUseradd(E2, a); break;
      case 'adduser': r = lnxAdduser(E2, a); break;
      case 'usermod': r = lnxUsermod(E2, a); break;
      case 'userdel': r = lnxUserdel(E2, a, false); break;
      case 'deluser': r = lnxUserdel(E2, a, true); break;
      case 'groupadd': r = lnxGroupadd(E2, a, false); break;
      case 'groupdel': r = lnxGroupadd(E2, a, true); break;
      case 'gpasswd': r = lnxGpasswd(E2, a); break;
      case 'passwd': r = lnxPasswd(E2, a); break;
      case 'id': r = lnxId(E2, a); break;
      case 'groups': r = lnxGroups(E2, a); break;
      case 'getent': r = lnxGetent(E2, a); break;
      case 'chmod': r = lnxChmod(E2, a); break;
      case 'chown': r = lnxChown(E2, a, false); break;
      case 'chgrp': r = lnxChown(E2, a, true); break;
      case 'ls': r = lnxLs(E2, a); break;
      case 'mkdir': r = lnxMkdir(E2, a); break;
      case 'touch': r = lnxTouch(E2, a); break;
      case 'cd': r = lnxCd(E2, a); break;
      case 'pwd': r = { out: [lCwd(E2)] }; break;
      case 'cat': r = lnxCat(E2, a); break;
      default: r = { out: [`${c}: command not found`] };
    }
    return Object.assign({ cmd: c, asUser: E2.user, root: E2.root }, r);
  };
  LX.cwd = lCwd; LX.modeStr = modeStr; LX.user = lUser; LX.group = lGroup; LX.memberOf = memberOf; LX.can = lCan; LX.traverse = lTraverse; LX.idLine = idLine;

  // ================================================================== public
  function run(env, line) {
    const os = env.os === 'linux' ? 'linux' : 'windows';
    const sys = sysOf(env.net, env.hostId, os, env.user);
    if (!sys) return { out: [], cmd: '' };
    const E = Object.assign({}, env, { sys });
    try {
      const r = os === 'linux' ? LX.run(E, line) : WIN.run(E, line);
      r.out = r.out || [];
      return r;
    } catch (e) { return { out: ['(ระบบจำลองเกิดข้อผิดพลาด: ' + (e && e.message) + ')'], cmd: '' }; }
  }
  function handles(os, line) { return os === 'linux' ? LX.handles(line) : WIN.handles(line); }
  function cwd(net, hostId, os, user, admin) {
    const d = devOf(net, hostId);
    const kind = os === 'linux' ? 'linux' : 'windows';
    const s = d && d.sys && d.sys.kind === kind ? d.sys : null;
    if (kind === 'windows') return (s && s.cwd) || (admin ? 'C:\\Windows\\system32' : 'C:\\Users\\' + user);
    if (s) return lCwd({ sys: s, user });
    return user === 'root' ? '/root' : '/home/' + user;
  }
  return { version: VERSION, run, handles, cwd, sysOf, cmdSplit, shSplit, firstStage, sudoSplit, WIN, LX, parseAceText, aceText };
});

/*
 * NetLab - Network Terminal Simulator (browser module, SIM-SPEC §1 + §4.4)
 *
 * Registers window.NL_SIMS.terminal (missions UI) and exposes a reusable terminal component:
 *   window.NL_TERM.create(container, { net, hostId, os, user, onCommand, onNetChange, netstat, quick, instant, height })
 *     -> { run(cmd) -> Promise, focus(), destroy(), setNet(net), setHost(hostId, os, user), getNet(), clear(), el }
 *   net      : a NetSim instance (window.NetSim.create(topo)); every network answer comes from it
 *   os       : 'windows' | 'linux' (default: the host's os in the topology)
 *   user     : login name ('student', 'root', 'Administrator', ...)
 *   onCommand(cmdLine, hostId)   called for every command the student runs
 *   onNetChange(newNet)          called when a command changes the network (ipconfig /release|/renew, ip link set, dhclient)
 *   netstat  : { [hostId]: [[proto, local, foreign, state], ...] } ('{ip}' in an address = the host's current IP)
 * Commands that change the host rebuild the NetSim instance from a modified copy of net.topo.
 */
(function () {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;   // Node (server grader) only needs NL_SYS above
  const CSS = `
.nls-terminal{--nls-terminal-mono:"JetBrains Mono",Consolas,monospace;color:var(--ink);font-family:inherit;max-width:1200px;margin:0 auto;min-width:0}
.nls-terminal *,.nls-terminal *::before,.nls-terminal *::after{box-sizing:border-box}
.nls-terminal h2{font-size:24px;line-height:1.25;margin:0 0 6px}
.nls-terminal h3{font-size:18px;margin:0 0 8px;line-height:1.35}
.nls-terminal p{margin:0 0 8px}
.nls-terminal-muted{color:var(--muted);font-size:15px}
.nls-terminal-card{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:14px 16px;margin:0 0 14px;min-width:0}
.nls-terminal-btn{background:var(--ink);color:var(--bg);border:1px solid var(--ink);border-radius:8px;padding:8px 14px;font:inherit;font-weight:600;font-size:15px;cursor:pointer;line-height:1.3;min-height:40px}
.nls-terminal-btn.nls-terminal-ghost{background:transparent;color:var(--ink);border-color:var(--line)}
.nls-terminal-btn[aria-pressed="true"]{background:var(--blue);border-color:var(--blue);color:var(--bg)}
.nls-terminal-btn:disabled{opacity:.5;cursor:default}
.nls-terminal-btn:focus-visible,.nls-terminal-mbtn:focus-visible,.nls-terminal-q:focus-visible,.nls-terminal-in:focus-visible{outline:3px solid var(--blue);outline-offset:2px}
.nls-terminal-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.nls-terminal-howto summary,.nls-terminal-map summary{cursor:pointer;font-weight:600}
.nls-terminal-howto ol{margin:8px 0 0;padding-left:22px;font-size:15px}
.nls-terminal-missions{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:8px;margin:0 0 14px}
.nls-terminal-mbtn{display:flex;flex-direction:column;align-items:flex-start;text-align:left;gap:2px;background:var(--panel);color:var(--ink);border:1px solid var(--line);border-radius:10px;padding:9px 12px;font:inherit;cursor:pointer;min-width:0}
.nls-terminal-mbtn b{font-size:15px;line-height:1.3}
.nls-terminal-mbtn span{font-size:13px;color:var(--muted)}
.nls-terminal-mbtn.nls-terminal-on{border-color:var(--blue);box-shadow:inset 0 0 0 2px var(--blue)}
.nls-terminal-mbtn .nls-terminal-best{color:var(--ok);font-weight:600}
.nls-terminal-lvl{font:600 11px var(--nls-terminal-mono);text-transform:uppercase;letter-spacing:.04em;color:var(--muted)}
.nls-terminal-layout{display:grid;grid-template-columns:minmax(0,1.45fr) minmax(0,1fr);gap:14px;align-items:start}
.nls-terminal-layout>*{min-width:0}
.nls-terminal-hosts{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 8px}
.nls-terminal-os{font:600 11px var(--nls-terminal-mono);border:1px solid currentColor;border-radius:6px;padding:1px 6px;margin-left:6px;color:inherit}
.nls-terminal-map svg{display:block;width:100%;height:auto;max-height:300px}
.nls-terminal-mapbox{background:var(--field);border:1px solid var(--line);border-radius:10px;padding:6px;margin-top:8px;overflow:auto}
.nls-terminal-qs{list-style:none;margin:0;padding:0;counter-reset:q}
.nls-terminal-qs li{margin:0 0 12px}
.nls-terminal-qs label{display:block;font-size:15px;line-height:1.45;margin-bottom:4px}
.nls-terminal-qs label b{font-family:var(--nls-terminal-mono);color:var(--muted);margin-right:4px}
.nls-terminal-q{width:100%;background:var(--field);color:var(--ink);border:1px solid var(--line);border-radius:8px;padding:8px 10px;font:15px var(--nls-terminal-mono);min-height:40px}
.nls-terminal-q.nls-terminal-right{border-color:var(--ok);box-shadow:inset 0 0 0 1px var(--ok)}
.nls-terminal-q.nls-terminal-wrong{border-color:var(--bad);box-shadow:inset 0 0 0 1px var(--bad)}
.nls-terminal-hints{margin:8px 0 0;padding-left:22px;font-size:15px}
.nls-terminal-score{font-size:22px;font-weight:700;margin:4px 0}
.nls-terminal-fb{margin:6px 0 0;padding-left:22px;font-size:15px}
.nls-terminal-fb li{margin:2px 0}
.nls-terminal-msg{min-height:1.3em;font-size:15px;margin:6px 0 0}
.nls-terminal-ok{color:var(--ok)}
.nls-terminal-bad{color:var(--bad)}
.nls-terminal-cmds{font:13px var(--nls-terminal-mono);color:var(--muted);word-break:break-word}
/* ---- terminal component ---- */
.nls-terminal-term,.nls-terminal-term *,.nls-terminal-term *::before,.nls-terminal-term *::after{box-sizing:border-box}
.nls-terminal-term{--nls-terminal-mono:"JetBrains Mono",Consolas,monospace;--nls-terminal-tbg:var(--term-bg,#0F1A24);--nls-terminal-tink:var(--term-ink,#CFE3D6);--nls-terminal-tdim:var(--term-dim,#7C93A6);--nls-terminal-tpu:var(--term-green,#3DB474);--nls-terminal-tpp:var(--term-blue,#5B8EEA);
  border:1px solid var(--line);border-radius:10px;overflow:hidden;background:var(--nls-terminal-tbg);min-width:0;display:flex;flex-direction:column}
.nls-terminal-bar{display:flex;align-items:center;gap:8px;background:var(--panel);border-bottom:1px solid var(--line);padding:5px 10px;font-size:13px;color:var(--ink);min-width:0}
.nls-terminal-bar span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:var(--nls-terminal-mono)}
.nls-terminal-dots{display:flex;gap:5px}
.nls-terminal-dots i{width:10px;height:10px;border-radius:50%;background:var(--line);display:block}
.nls-terminal-linux .nls-terminal-dots i:nth-child(1){background:var(--bad)}
.nls-terminal-linux .nls-terminal-dots i:nth-child(2){background:var(--orange)}
.nls-terminal-linux .nls-terminal-dots i:nth-child(3){background:var(--green)}
.nls-terminal-win .nls-terminal-dots{order:2}
.nls-terminal-win .nls-terminal-dots i{border-radius:1px;width:11px;height:2px;background:var(--muted)}
.nls-terminal-screen{flex:0 0 auto;overflow:auto;padding:8px 10px 10px;font:14px/1.45 var(--nls-terminal-mono);color:var(--nls-terminal-tink);cursor:text;min-height:200px;overscroll-behavior:contain;-webkit-overflow-scrolling:touch}
.nls-terminal-out{white-space:pre;tab-size:8;margin:0;min-width:max-content}
.nls-terminal-out div{min-height:1.45em}
.nls-terminal-out .nls-terminal-hint{color:var(--nls-terminal-tdim);white-space:pre-wrap;min-width:0;max-width:60ch}
.nls-terminal-out .nls-terminal-echo{color:var(--nls-terminal-tink)}
/* the terminal is dark in both themes: prompt colours are terminal tokens (>= 6.6:1 on #0F1A24 and #0A1118), not the page --green/--blue */
.nls-terminal-linux .nls-terminal-pu{color:var(--nls-terminal-tpu);font-weight:600}
.nls-terminal-linux .nls-terminal-pp{color:var(--nls-terminal-tpp);font-weight:600}
.nls-terminal-inrow{display:flex;align-items:baseline;white-space:pre;min-width:0}
.nls-terminal-inrow[hidden]{display:none}
.nls-terminal-prompt{flex:0 0 auto}
.nls-terminal-in{flex:1;min-width:4ch;background:transparent;border:0;outline:0;color:var(--nls-terminal-tink);font:inherit;padding:0;margin:0;caret-color:var(--nls-terminal-tink);border-radius:2px}
.nls-terminal-quick{display:flex;flex-wrap:wrap;gap:6px;padding:8px;background:var(--panel);border-top:1px solid var(--line)}
.nls-terminal-qb{background:var(--field);color:var(--ink);border:1px solid var(--line);border-radius:7px;padding:5px 9px;font:13px var(--nls-terminal-mono);cursor:pointer;min-height:34px;white-space:nowrap;flex:0 0 auto;touch-action:manipulation}
.nls-terminal-qb.nls-terminal-arg::after{content:"…";color:var(--muted);margin-left:1px}
.nls-terminal-qb:focus-visible,.nls-terminal-tb:focus-visible{outline:3px solid var(--blue);outline-offset:1px}
.nls-terminal-qb:disabled,.nls-terminal-tb:disabled{opacity:.5;cursor:default}
.nls-terminal-tools{position:relative;display:flex;flex-wrap:wrap;align-items:center;gap:6px;padding:6px 8px;background:var(--panel);border-top:1px solid var(--line);min-width:0}
.nls-terminal-tb{display:inline-flex;align-items:center;justify-content:center;gap:5px;background:var(--field);color:var(--ink);border:1px solid var(--line);border-radius:7px;padding:4px 10px;font:inherit;font-size:14px;font-weight:600;cursor:pointer;min-height:32px;min-width:36px;white-space:nowrap;touch-action:manipulation}
.nls-terminal-tb svg{width:16px;height:16px;flex:0 0 auto}
.nls-terminal-tb.nls-terminal-run{background:var(--green);border-color:var(--green);color:var(--on-accent,#fff)}
.nls-terminal-tb.nls-terminal-copied{border-color:var(--ok);color:var(--ok)}
.nls-terminal-tsp{flex:1 1 auto}
.nls-terminal-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.nls-terminal-out .nls-terminal-mark{background:color-mix(in srgb,var(--orange) 34%,transparent);box-shadow:inset 3px 0 0 var(--orange);border-radius:2px}
.nls-terminal-out .nls-terminal-note{white-space:pre-wrap;min-width:0;max-width:62ch;margin:4px 0 8px;padding:6px 10px;border-left:3px solid var(--blue);background:color-mix(in srgb,var(--blue) 16%,transparent);color:var(--nls-terminal-tink);font-family:inherit;border-radius:0 6px 6px 0}
.nls-terminal-out .nls-terminal-note b{color:var(--nls-terminal-tink)}
.nls-terminal-modes{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.nls-terminal-mode{display:flex;flex-direction:column;align-items:flex-start;gap:2px;text-align:left;background:var(--field);color:var(--ink);border:1px solid var(--line);border-radius:10px;padding:10px 12px;font:inherit;cursor:pointer;min-height:56px;min-width:0}
.nls-terminal-mode b{font-size:15px}
.nls-terminal-mode span{font-size:13px;color:var(--muted)}
.nls-terminal-mode.nls-terminal-on{border-color:var(--blue);box-shadow:inset 0 0 0 2px var(--blue)}
.nls-terminal-mode:focus-visible{outline:3px solid var(--blue);outline-offset:2px}
.nls-terminal-confirm{margin:10px 0 0;padding:10px 12px;border:1px solid var(--orange);border-radius:10px}
.nls-terminal-confirm[hidden]{display:none}
.nls-terminal-goal{margin:10px 0 0;font-size:15px}
.nls-terminal-goal[hidden]{display:none}
.nls-terminal-next{border:1px solid var(--blue);border-radius:10px;padding:8px 10px;margin:0 0 8px;font-size:15px;display:flex;flex-wrap:wrap;gap:6px 10px;align-items:center;justify-content:space-between}
.nls-terminal-next[hidden]{display:none}
.nls-terminal-next p{margin:0;flex:1 1 220px;min-width:0}
.nls-terminal-next code,.nls-terminal-steps code{font-family:var(--nls-terminal-mono);font-size:13px}
.nls-terminal-stepcard{margin:0 0 14px}
.nls-terminal-stepcard[hidden]{display:none}
.nls-terminal-steps{list-style:none;margin:0;padding:0}
.nls-terminal-steps li{border:1px solid var(--line);border-radius:10px;padding:8px 10px;margin:0 0 8px;font-size:15px;min-width:0}
.nls-terminal-steps li.nls-terminal-scur{border-color:var(--blue);box-shadow:inset 3px 0 0 var(--blue)}
.nls-terminal-steps li.nls-terminal-sdone{border-color:var(--ok)}
.nls-terminal-shead{display:flex;gap:8px;align-items:baseline}
.nls-terminal-sno{flex:0 0 auto;font:600 13px var(--nls-terminal-mono);min-width:1.6em;text-align:center;border:1px solid currentColor;border-radius:999px;padding:0 4px;color:var(--muted)}
.nls-terminal-sdone .nls-terminal-sno{color:var(--ok)}
.nls-terminal-why{margin:4px 0;color:var(--muted);font-size:14px}
.nls-terminal-sexp{margin:4px 0;padding:6px 8px;border-left:3px solid var(--ok);background:var(--field);font-size:14px}
.nls-terminal-sfill,.nls-terminal-nfill{font-weight:500;max-width:100%;white-space:normal;text-align:left}
.nls-terminal-facts{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:2px 12px;font-size:14px;background:var(--field);border:1px solid var(--line);border-radius:10px;padding:8px 10px;margin:4px 0 8px;max-width:520px}
.nls-terminal-facts code{font-family:var(--nls-terminal-mono)}
.nls-terminal-facth{grid-column:1/-1;font-size:14px;margin-bottom:2px}
.nls-terminal-tasks{margin:0 0 12px;padding-left:20px;font-size:15px}
.nls-terminal-tstat{font-size:13px;font-weight:600;color:var(--muted)}
.nls-terminal-q.nls-terminal-part{border-color:var(--orange);box-shadow:inset 0 0 0 1px var(--orange)}
.nls-terminal-warn{color:var(--orange)}
.nls-terminal-modebadge{display:inline-block;font-size:14px;font-weight:600;border:1px solid var(--blue);color:var(--blue);border-radius:999px;padding:2px 10px;margin:6px 0 0}
.nls-terminal-modebadge[data-mode="guided"]{border-color:var(--orange);color:var(--orange)}
@media (max-width:520px){.nls-terminal-modes{grid-template-columns:minmax(0,1fr)}}
@media (max-width:980px){.nls-terminal-layout{grid-template-columns:minmax(0,1fr)}}
@media (max-width:760px){
  .nls-terminal{padding-bottom:calc(var(--nl-bnav, 0px) + 8px)}
  .nls-terminal-screen{min-height:140px;max-height:calc(var(--vvh, 100dvh) - 170px)}
  .nls-terminal-out{white-space:pre-wrap;overflow-wrap:anywhere;min-width:0}
  .nls-terminal-quick{flex-wrap:nowrap;overflow-x:auto;overscroll-behavior-x:contain;-webkit-overflow-scrolling:touch;scrollbar-width:thin;scroll-padding:0 8px}
}
@media (max-width:520px){
  .nls-terminal-card{padding:12px 10px}
  .nls-terminal h2{font-size:20px}
  .nls-terminal-screen{font-size:13px;line-height:1.45;padding:6px 8px}
  .nls-terminal-missions{grid-template-columns:repeat(2,minmax(0,1fr))}
  .nls-terminal-mbtn{padding:7px 9px}
  .nls-terminal-in{font-size:16px}
}
@media (pointer:coarse){
  .nls-terminal-screen{max-height:calc(var(--vvh, 100dvh) - 170px);min-height:140px}
  .nls-terminal-in{font-size:16px}
  .nls-terminal-qb,.nls-terminal-tb{min-height:44px;min-width:44px}
  .nls-terminal-qb{padding:6px 12px;font-size:14px}
  .nls-terminal-btn,.nls-terminal-mbtn{min-height:44px}
  .nls-terminal-q{min-height:44px;font-size:16px}
  .nls-terminal-howto summary,.nls-terminal-map summary{min-height:44px;display:flex;align-items:center}
  .nls-terminal-quick{flex-wrap:nowrap;overflow-x:auto;overscroll-behavior-x:contain}
}
@media (prefers-reduced-motion:reduce){.nls-terminal-screen{scroll-behavior:auto}}
`;
  const injectCss = () => {
    if (document.getElementById('nls-terminal-css')) return;
    const st = document.createElement('style'); st.id = 'nls-terminal-css'; st.textContent = CSS; document.head.appendChild(st);
  };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const reduced = () => { try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; } };
  const clone = x => JSON.parse(JSON.stringify(x));
  const padE = (s, n) => { s = String(s); return s.length >= n ? s + ' ' : s + ' '.repeat(n - s.length); };
  const padS = (s, n) => { s = String(s); return s.length >= n ? s : ' '.repeat(n - s.length) + s; };
  const hashStr = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

  // ------------------------------------------------------------------ host facts
  function NS() { return window.NetSim; }
  function topoDev(net, id) { return net && net.topo ? net.topo.devices.find(d => d.id === id) : null; }
  function hostInfo(net, id) {
    const c = net.config(id) || {};
    const d = topoDev(net, id) || {};
    const released = d._released === true;
    const wifi = /^wl/.test(c.iface || '') || d.type === 'laptop';
    return { c, d, released, dhcp: !!c.dhcp || released, wifi, name: d.name || id, type: d.type };
  }
  function leaseServerIp(net, c) {
    if (!c || !c.leaseFrom) return null;
    const s = net.config(c.leaseFrom); if (!s) return null;
    if (s.ifaces) { const f = s.ifaces.find(x => x.ip && NS().ip.inSubnet(c.ip, x.ip, x.prefix)); return f ? f.ip : s.ip; }
    return s.ip;
  }
  // same rule as routeAddCheck() in server/sims/terminal.js (the grader replays the student's commands with it)
  function routeAddCheck(net, id, via, replace) {
    const ip = NS().ip, c = net.config(id);
    const v = ip.parse(String(via || ''));
    if (v === null) return { ok: false, err: 'bad' };
    const vs = ip.str(v);
    if (!c || !c.ip || c.up === false || c.apipa) return { ok: false, err: 'nexthop', via: vs };
    if (c.dhcp) return { ok: false, err: 'dhcp', via: vs };
    if (vs === c.ip || !ip.inSubnet(vs, c.ip, c.prefix)) return { ok: false, err: 'nexthop', via: vs };
    if (!replace && net.routes(id).some(r => r.prefix === 0)) return { ok: false, err: 'exists', via: vs };
    return { ok: true, via: vs };
  }
  function ll6(mac) {
    const b = String(mac || '00-00-00-00-00-00').split(/[-:]/).map(h => parseInt(h, 16) || 0);
    b[0] ^= 2;
    const h = (x, y) => ((x << 8) | y).toString(16);
    return `fe80::${h(b[0], b[1])}:${h(b[2], 0xff)}:${h(0xfe, b[3])}:${h(b[4], b[5])}`;
  }
  const WDAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  function winDate(d) {
    let h = d.getHours(); const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12;
    const p2 = n => ('0' + n).slice(-2);
    return `${WDAY[d.getDay()]}, ${MON[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()} ${h}:${p2(d.getMinutes())}:${p2(d.getSeconds())} ${ap}`;
  }
  function linuxDate(d) {
    const p2 = n => ('0' + n).slice(-2);
    return `${WDAY[d.getDay()].slice(0, 3)} ${MON[d.getMonth()].slice(0, 3)} ${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())} +07 ${d.getFullYear()}`;
  }
  function nicDesc(info) {
    const mac = String(info.c.mac || '');
    if (info.wifi) return 'Intel(R) Wi-Fi 6 AX201 160MHz';
    if (/^00-15-5D/i.test(mac)) return 'Microsoft Hyper-V Network Adapter';
    if (info.type === 'server') return 'Intel(R) Ethernet Server Adapter I350-T2';
    return 'Intel(R) Ethernet Connection (7) I219-V';
  }

  // ------------------------------------------------------------------ Windows commands
  const WL = {
    host: 'Host Name . . . . . . . . . . . . :', pdns: 'Primary Dns Suffix  . . . . . . . :', node: 'Node Type . . . . . . . . . . . . :',
    iprout: 'IP Routing Enabled. . . . . . . . :', wins: 'WINS Proxy Enabled. . . . . . . . :', media: 'Media State . . . . . . . . . . . :',
    suffix: 'Connection-specific DNS Suffix  . :', desc: 'Description . . . . . . . . . . . :', phys: 'Physical Address. . . . . . . . . :',
    dhcpEn: 'DHCP Enabled. . . . . . . . . . . :', autoEn: 'Autoconfiguration Enabled . . . . :', ll6: 'Link-local IPv6 Address . . . . . :',
    ipv4: 'IPv4 Address. . . . . . . . . . . :', apipa: 'Autoconfiguration IPv4 Address. . :', mask: 'Subnet Mask . . . . . . . . . . . :',
    leaseO: 'Lease Obtained. . . . . . . . . . :', leaseE: 'Lease Expires . . . . . . . . . . :', gw: 'Default Gateway . . . . . . . . . :',
    dhcpSrv: 'DHCP Server . . . . . . . . . . . :', dns: 'DNS Servers . . . . . . . . . . . :', netbios: 'NetBIOS over Tcpip. . . . . . . . :'
  };
  const wl = (k, v) => '   ' + WL[k] + ' ' + (v == null ? '' : v);
  const DNS_IND = ' '.repeat(39);

  function winAdapterBlock(T, info, all) {
    const { c } = info;
    const out = ['', (info.wifi ? 'Wireless LAN adapter Wi-Fi:' : 'Ethernet adapter Ethernet:'), ''];
    if (!c.linked) {
      out.push(wl('media', 'Media disconnected'), wl('suffix', ''));
      if (all) out.push(wl('desc', nicDesc(info)), wl('phys', c.mac), wl('dhcpEn', info.dhcp ? 'Yes' : 'No'), wl('autoEn', 'Yes'));
      return out;
    }
    const idx = info.wifi ? 18 : 12;
    out.push(wl('suffix', info.dhcp && c.ip && !c.apipa ? 'lab.local' : ''));
    if (all) out.push(wl('desc', nicDesc(info)), wl('phys', c.mac), wl('dhcpEn', info.dhcp ? 'Yes' : 'No'), wl('autoEn', 'Yes'));
    out.push(wl('ll6', ll6(c.mac) + '%' + idx + (all ? '(Preferred) ' : '')));
    if (c.ip) {
      if (c.apipa) out.push(wl('apipa', c.ip + (all ? '(Preferred) ' : '')));
      else out.push(wl('ipv4', c.ip + (all ? '(Preferred) ' : '')));
      out.push(wl('mask', c.mask));
      if (all && info.dhcp && !c.apipa && c.leaseFrom) {
        const o = new Date(T.t0 - 72 * 60000);
        out.push(wl('leaseO', winDate(o)), wl('leaseE', winDate(new Date(o.getTime() + 8 * 86400000))));
      }
    }
    out.push(wl('gw', c.gateway || ''));
    if (all) {
      if (info.dhcp && c.ip && !c.apipa) { const s = leaseServerIp(T.net, c); if (s) out.push(wl('dhcpSrv', s)); }
      const dns = (c.dns || []).length ? c.dns : ['fec0:0:0:ffff::1%1', 'fec0:0:0:ffff::2%1', 'fec0:0:0:ffff::3%1'];
      out.push(wl('dns', dns[0])); dns.slice(1).forEach(x => out.push(DNS_IND + x));
      out.push(wl('netbios', 'Enabled'));
    }
    return out;
  }
  function winIpconfig(T, args) {
    const net = T.net, info = hostInfo(net, T.hostId);
    const a = (args[0] || '').toLowerCase();
    const head = ['', 'Windows IP Configuration', ''];
    const adapterPresent = info.c.up !== false;
    const block = (all, inf) => adapterPresent ? winAdapterBlock(T, inf || info, all) : [];
    if (!a) return head.concat([''], block(false).slice(1));
    if (a === '/all') {
      const L = head.concat([wl('host', info.name), wl('pdns', ''), wl('node', 'Hybrid'), wl('iprout', 'No'), wl('wins', 'No')]);
      return L.concat(block(true));
    }
    if (a === '/flushdns') return head.concat(['Successfully flushed the DNS Resolver Cache.']);
    if (a === '/displaydns') return head.concat(['Could not display the DNS Resolver Cache.']);
    const nm = info.wifi ? 'Wi-Fi' : 'Ethernet';
    if (a === '/release' || a === '/renew') {
      if (!adapterPresent || !info.dhcp) return head.concat(['The operation failed as no adapter is in the state permissible for', 'this operation.']);
      if (!info.c.linked) return head.concat([`No operation can be performed on ${nm} while it has its media disconnected.`]);
      if (a === '/release') {
        T.mutate(d => { d._released = true; d.dhcp = false; d.ifaces[0].ip = ''; d.ifaces[0].prefix = ''; });
        return head.concat([''], block(false, hostInfo(T.net, T.hostId)).slice(1)).concat(T.hint('(ระบบจำลอง: คืน IP ให้ DHCP server แล้ว เครื่องนี้ไม่มี IPv4 จนกว่าจะสั่ง ipconfig /renew)'));
      }
      T.mutate(d => { if (d._released) { delete d._released; } d.dhcp = true; d.ifaces[0].ip = ''; d.ifaces[0].prefix = 24; });
      T.net.clearArp(T.hostId);
      const ni = hostInfo(T.net, T.hostId);
      const L = head.slice();
      if (ni.c.apipa || !ni.c.ip) L.push(`An error occurred while renewing interface ${nm} : unable to contact your DHCP server. Request has timed out.`);
      return L.concat(winAdapterBlock(T, ni, false));
    }
    if (a === '/?' || a === '-?') return ['', 'USAGE:', '    ipconfig [/allcompartments] [/? | /all | /renew [adapter] | /release [adapter] |', '              /flushdns | /displaydns | /registerdns ]', '', 'Options:', '    /?               Display this help message', '    /all             Display full configuration information.', '    /release         Release the IPv4 address for the specified adapter.', '    /renew           Renew the IPv4 address for the specified adapter.', '    /flushdns        Purges the DNS Resolver cache.'];
    return ['', 'Error: unrecognized or incomplete command line.', '', 'USAGE:', '    ipconfig [/? | /all | /renew [adapter] | /release [adapter] | /flushdns]'];
  }
  const isHelp = args => args.some(x => x === '/?' || x === '-?');
  const WIN_PING_USAGE = ['', 'Usage: ping [-t] [-a] [-n count] [-l size] [-f] [-i TTL] [-v TOS]', '            [-r count] [-s count] [[-j host-list] | [-k host-list]]',
    '            [-w timeout] [-R] [-S srcaddr] [-c compartment] [-p]', '            [-4] [-6] target_name', '', 'Options:',
    '    -t             Ping the specified host until stopped.', '    -a             Resolve addresses to hostnames.', '    -n count       Number of echo requests to send.',
    '    -l size        Send buffer size.', '    -i TTL         Time To Live.', '    -w timeout     Timeout in milliseconds to wait for each reply.'];
  function winPing(T, args) {
    if (isHelp(args)) return WIN_PING_USAGE;
    let count = 4, target = null;
    for (let i = 0; i < args.length; i++) {
      const a = args[i], al = a.toLowerCase();
      if (al === '-t' || al === '/t') return T.hint('ระบบจำลองไม่รองรับ ping -t (ping ต่อเนื่องไม่หยุด) — ใช้ ping -n <จำนวนครั้ง> <ปลายทาง> แทน เช่น ping -n 10 8.8.8.8');
      if (al === '-n' || al === '/n') {
        const v = args[++i];
        if (!/^\d+$/.test(v || '') || +v < 1) return [`Bad value for option -n, valid range is from 1 to 4294967295.`];
        count = +v; continue;
      }
      if (/^[-/](l|w|i|v|r|s|j|k|S|c)$/i.test(a)) { i++; continue; }
      if (/^[-/]/.test(a)) continue;
      if (!target) target = a;
    }
    if (!target) return WIN_PING_USAGE.slice(0, 5);
    const extra = [];
    if (count > 10) { extra.push(...T.hint('(ระบบจำลองส่งได้สูงสุด 10 ครั้ง)')); count = 10; }
    const r = T.net.ping(T.hostId, target, { count });
    return extra.concat(r.win.map(l => ({ t: l, d: /^Reply from|^PING: transmit/.test(l) ? 320 : /^Request timed out/.test(l) ? 700 : 0 })));
  }
  function winTracert(T, args) {
    if (isHelp(args)) return ['', 'Usage: tracert [-d] [-h maximum_hops] [-j host-list] [-w timeout]', '               [-R] [-S srcaddr] [-4] [-6] target_name', '', 'Options:',
      '    -d                 Do not resolve addresses to hostnames.', '    -h maximum_hops    Maximum number of hops to search for target.', '    -w timeout         Wait timeout milliseconds for each reply.'];
    let target = null, max = 30;
    for (let i = 0; i < args.length; i++) {
      const al = args[i].toLowerCase();
      if (al === '-h') { const v = +args[++i]; if (v >= 1 && v <= 255) max = Math.min(30, v); continue; }
      if (al === '-w' || al === '-j' || al === '-s') { i++; continue; }
      if (/^[-/]/.test(al)) continue;
      if (!target) target = args[i];
    }
    if (!target) return ['', 'Usage: tracert [-d] [-h maximum_hops] [-j host-list] [-w timeout]', '               [-R] [-S srcaddr] [-4] [-6] target_name'];
    const r = T.net.traceroute(T.hostId, target, { maxHops: max });
    return r.win.map(l => ({ t: l, d: /^\s+\d+\s+\*\s+\*/.test(l) ? 800 : /^\s+\d+ /.test(l) ? 380 : 0 }));
  }
  function nsDefaultServer(T) {
    const c = T.net.config(T.hostId) || {};
    const s = (c.dns || [])[0];
    if (!s) return null;
    const r = T.net.nslookup(T.hostId, s, s);
    return { ip: s, name: r.ok && r.name ? r.name : (r.serverName || 'UnKnown') };
  }
  function winNslookup(T, args) {
    if (isHelp(args) || args.includes('-help')) return ['Usage:', '   nslookup [-opt ...]             # interactive mode using default server',
      '   nslookup [-opt ...] - server    # interactive mode using \'server\'', '   nslookup [-opt ...] host        # just look up \'host\' using default server',
      '   nslookup [-opt ...] host server # just look up \'host\' using \'server\''];
    const a = args.filter(x => !/^-/.test(x));
    if (!a.length) {
      const d = nsDefaultServer(T);
      const L = d ? [`Default Server:  ${d.name}`, `Address:  ${d.ip}`] : ['*** Default servers are not available', 'Default Server:  UnKnown', 'Address:  127.0.0.1'];
      return L.concat(T.hint('(ระบบจำลองไม่รองรับโหมดโต้ตอบของ nslookup — พิมพ์ nslookup <ชื่อ> [server] ในบรรทัดเดียว)'));
    }
    const r = T.net.nslookup(T.hostId, a[0], a[1]);
    return r.win.map(l => ({ t: l, d: /timed out/.test(l) ? 500 : 0 }));
  }
  function winArp(T, args) {
    const a = (args[0] || '').toLowerCase();
    if (a === '-a' || a === '/a' || a === '-g') {
      const c = T.net.config(T.hostId) || {};
      if (!c.ip || c.up === false || !c.linked) return ['No ARP Entries Found.'];
      const only = args.slice(1).find(x => NS().ip.parse(x) !== null);
      let rows = T.net.arp(T.hostId).map(e => [e.ip, e.mac.toLowerCase(), 'dynamic']);
      rows.push([c.broadcast, 'ff-ff-ff-ff-ff-ff', 'static'], ['224.0.0.22', '01-00-5e-00-00-16', 'static'], ['224.0.0.251', '01-00-5e-00-00-fb', 'static'],
        ['239.255.255.250', '01-00-5e-7f-ff-fa', 'static'], ['255.255.255.255', 'ff-ff-ff-ff-ff-ff', 'static']);
      if (only) { rows = rows.filter(r => r[0] === NS().ip.str(NS().ip.parse(only))); if (!rows.length) return ['No ARP Entries Found.']; }
      return ['', `Interface: ${c.ip} --- 0x${(hostInfo(T.net, T.hostId).wifi ? 18 : 12).toString(16)}`, '  Internet Address      Physical Address      Type']
        .concat(rows.map(r => '  ' + padE(r[0], 22) + padE(r[1], 22) + r[2]));
    }
    if (a === '-d' || a === '/d') {
      if (!T.admin()) return ['The ARP entry deletion failed: The requested operation requires elevation.'];
      T.net.clearArp(T.hostId); return [];
    }
    return ['', 'Displays and modifies the IP-to-Physical address translation tables used by', 'address resolution protocol (ARP).', '', 'ARP -s inet_addr eth_addr [if_addr]', 'ARP -d inet_addr [if_addr]', 'ARP -a [inet_addr] [-N if_addr] [-v]', '',
      '  -a            Displays current ARP entries by interrogating the current', '                protocol data.'];
  }
  function winRoute(T, args) {
    const al = args.filter(x => !/^-[pf46]$/i.test(x)).map(x => x.toLowerCase());
    const a = al[0] || '';
    if (a === 'add' || a === 'delete' || a === 'change') {
      if (!T.admin()) return ['The requested operation requires elevation.'];
      if (a === 'add') {
        if (al[1] !== '0.0.0.0' || al[2] !== 'mask' || al[3] !== '0.0.0.0' || !al[4]) {
          if (al.length < 2) return ['The syntax of this command is:', '', 'ROUTE ADD destination MASK netmask gateway [METRIC metric] [IF interface]'];
          return T.hint('(ระบบจำลองรองรับเฉพาะ default route: route add 0.0.0.0 mask 0.0.0.0 <gateway>)');
        }
        const chk = routeAddCheck(T.net, T.hostId, al[4], false);
        if (!chk.ok) {
          if (chk.err === 'dhcp') return T.hint('(เครื่องนี้รับ gateway จาก DHCP ระบบจำลองไม่รองรับการเพิ่ม route ซ้อน)');
          if (chk.err === 'exists') return ['The route addition failed: The object already exists.', ''];
          if (chk.err === 'nexthop') return ['The route addition failed: Either the interface index is wrong or the gateway does not lie on the same network as the interface. Check the IP Address Table for the machine.', ''];
          return [`route: bad gateway address ${al[4]}`];
        }
        T.mutate(d => { d.gateway = chk.via; });
        return [' OK!'];
      }
      if (a === 'delete' && al[1] === '0.0.0.0') {
        if (!T.net.routes(T.hostId).some(r => r.prefix === 0)) return ['The route deletion failed: Element not found.', ''];
        if ((T.net.config(T.hostId) || {}).dhcp) return T.hint('(เครื่องนี้รับ gateway จาก DHCP ระบบจำลองไม่รองรับการลบ)');
        T.mutate(d => { d.gateway = ''; });
        return [' OK!'];
      }
      return T.hint('(ระบบจำลองรองรับเฉพาะ route add/delete ของ default route 0.0.0.0)');
    }
    if (a !== 'print') return ['', 'Manipulates network routing tables.', '', 'ROUTE [-f] [-p] [-4|-6] command [destination]', '                  [MASK netmask]  [gateway] [METRIC metric]  [IF interface]', '', '  command      One of these:', '                 PRINT     Prints  a route', '                 ADD       Adds    a route', '                 DELETE    Deletes a route'];
    const info = hostInfo(T.net, T.hostId), c = info.c;
    const sep = '='.repeat(75);
    const L = [sep, 'Interface List'];
    if (c.up !== false) L.push(` ${info.wifi ? 18 : 12}...${String(c.mac || '').toLowerCase().replace(/-/g, ' ')} ......${nicDesc(info)}`);
    L.push('  1...........................Software Loopback Interface 1', sep, '', 'IPv4 Route Table', sep, 'Active Routes:',
      'Network Destination        Netmask          Gateway       Interface  Metric');
    const row = (d, m, g, i, met) => padS(d, 17) + padS(m, 17) + padS(g, 17) + padS(i, 17) + padS(met, 7);
    const rs = T.net.routes(T.hostId);
    const ip = c.ip;
    const def = rs.find(r => r.prefix === 0);
    if (def && ip) L.push(row('0.0.0.0', '0.0.0.0', def.via, ip, 25));
    L.push(row('127.0.0.0', '255.0.0.0', 'On-link', '127.0.0.1', 331), row('127.0.0.1', '255.255.255.255', 'On-link', '127.0.0.1', 331),
      row('127.255.255.255', '255.255.255.255', 'On-link', '127.0.0.1', 331));
    if (ip && rs.length) {
      L.push(row(c.network, c.mask, 'On-link', ip, 281), row(ip, '255.255.255.255', 'On-link', ip, 281), row(c.broadcast, '255.255.255.255', 'On-link', ip, 281));
    }
    L.push(row('224.0.0.0', '240.0.0.0', 'On-link', '127.0.0.1', 331));
    if (ip && rs.length) L.push(row('224.0.0.0', '240.0.0.0', 'On-link', ip, 281));
    L.push(row('255.255.255.255', '255.255.255.255', 'On-link', '127.0.0.1', 331));
    if (ip && rs.length) L.push(row('255.255.255.255', '255.255.255.255', 'On-link', ip, 281));
    L.push(sep, 'Persistent Routes:', '  None');
    return L;
  }
  // ---- sockets: ONE table per host feeds netstat (Windows) and ss (Linux), so every command shows the same connections.
  // row = [proto, local, foreign, state (Windows wording), pid?, process?]; '{ip}' = the host's current IP.
  // Hosts without scenario data get a default table derived from their OS and services (web/dns/dhcp/file).
  const WIN_PROC = { 135: 'svchost.exe', 445: 'System', 139: 'System', 137: 'System', 138: 'System', 3389: 'svchost.exe', 1433: 'sqlservr.exe', 80: 'System', 443: 'System',
    53: 'dns.exe', 67: 'svchost.exe', 5040: 'svchost.exe', 49664: 'lsass.exe', 49665: 'wininit.exe', 123: 'svchost.exe', 500: 'svchost.exe', 5353: 'svchost.exe' };
  const WIN_CLIENT = { 3389: 'mstsc.exe', 443: 'msedge.exe', 80: 'msedge.exe', 22: 'ssh.exe', 445: 'System', 53: 'svchost.exe' };
  const LNX_PROC = { 22: 'sshd', 80: 'nginx', 443: 'nginx', 53: 'named', 67: 'dhcpd', 445: 'smbd', 139: 'smbd', 3306: 'mysqld', 8080: 'node' };
  const SVC_NAME = { 22: 'ssh', 53: 'domain', 67: 'bootps', 68: 'bootpc', 80: 'http', 123: 'ntp', 135: 'epmap', 137: 'netbios-ns', 139: 'netbios-ssn', 443: 'https',
    445: 'microsoft-ds', 1433: 'ms-sql-s', 3306: 'mysql', 3389: 'ms-wbt-server', 5353: 'mdns', 8080: 'http-alt' };
  const portNum = a => { const m = /:(\d+)$/.exec(String(a)); return m ? +m[1] : null; };
  function connRows(T) {
    const own = T.netstat && T.netstat[T.hostId];
    const d = topoDev(T.net, T.hostId) || {};
    const lin = T.os === 'linux';
    let rows;
    if (Array.isArray(own)) rows = own.filter(r => Array.isArray(r) && r.length >= 3).map(r => r.slice());
    else {
      const sv = d.services || {};
      rows = lin
        ? [['TCP', '127.0.0.53:53', '0.0.0.0:0', 'LISTENING', null, 'systemd-resolve'], ['UDP', '127.0.0.53:53', '*:*', '', null, 'systemd-resolve']]
        : [['TCP', '0.0.0.0:135', '0.0.0.0:0', 'LISTENING'], ['TCP', '0.0.0.0:445', '0.0.0.0:0', 'LISTENING'], ['TCP', '0.0.0.0:5040', '0.0.0.0:0', 'LISTENING'],
          ['TCP', '0.0.0.0:49664', '0.0.0.0:0', 'LISTENING'], ['TCP', '{ip}:139', '0.0.0.0:0', 'LISTENING']];
      if (lin && d.type === 'server') rows.unshift(['TCP', '0.0.0.0:22', '0.0.0.0:0', 'LISTENING']);
      if (sv.web) rows.push(['TCP', '0.0.0.0:80', '0.0.0.0:0', 'LISTENING'], ['TCP', '0.0.0.0:443', '0.0.0.0:0', 'LISTENING']);
      if (sv.dns) rows.push(['TCP', '{ip}:53', '0.0.0.0:0', 'LISTENING'], ['UDP', '{ip}:53', '*:*', '']);
      if (sv.dhcp) rows.push(['UDP', '0.0.0.0:67', '*:*', '']);
      if (sv.file && lin) rows.push(['TCP', '0.0.0.0:445', '0.0.0.0:0', 'LISTENING'], ['TCP', '0.0.0.0:139', '0.0.0.0:0', 'LISTENING']);
      if (!lin) rows.push(['UDP', '0.0.0.0:5353', '*:*', ''], ['UDP', '{ip}:137', '*:*', '']);
    }
    // fill missing process names / PIDs deterministically (same process -> same PID on this host)
    return rows.map(r => {
      const lp = portNum(r[1]), fp = portNum(r[2]);
      const client = /ESTABLISHED|SYN_SENT|TIME_WAIT|CLOSE_WAIT/.test(r[3] || '') && lp > 49151 && fp && fp < 49152;
      let proc = r[5];
      if (!proc && proc !== '') proc = lin ? (LNX_PROC[client ? fp : lp] || (client ? 'curl' : 'systemd')) : ((client ? WIN_CLIENT[fp] : WIN_PROC[lp]) || 'svchost.exe');
      let pid = r[4];
      if (pid === undefined || pid === null) pid = (r[3] === 'TIME_WAIT') ? 0 : proc === 'System' ? 4 : lin ? 300 + hashStr(T.hostId + '|' + proc) % 2700 : 4 * (150 + hashStr(T.hostId + '|' + proc) % 2200);
      return [r[0], r[1], r[2], r[3] || '', pid, proc || ''];
    });
  }
  function liveRows(T) {
    const c = T.net.config(T.hostId) || {};
    const ip = c.up !== false && c.linked ? c.ip : null;
    const f = s => String(s).replace(/\{ip\}/g, ip || '0.0.0.0');
    return connRows(T).filter(r => !((/\{ip\}/.test(r[1] + r[2]) || /ESTABLISHED|TIME_WAIT|SYN|CLOSE/.test(r[3])) && !ip))
      .map(r => [r[0], f(r[1]), f(r[2]), r[3], r[4], r[5]]);
  }
  function winNetstat(T, args) {
    const raw = args.map(x => x.toLowerCase());
    let proto = null; const fl = [];
    for (let i = 0; i < raw.length; i++) {
      if (raw[i] === '-p' || raw[i] === '/p') { proto = (raw[++i] || '').toUpperCase(); continue; }
      if (/^\d+$/.test(raw[i])) continue; // interval: the simulator prints once
      fl.push(raw[i].replace(/^[-/]/, ''));
    }
    const flags = fl.join('');
    if (/[^anobefoprstxq]/.test(flags) || (proto !== null && !/^(TCP|UDP|TCPV6|UDPV6)$/.test(proto))) return ['', 'Displays protocol statistics and current TCP/IP network connections.', '',
      'NETSTAT [-a] [-b] [-e] [-f] [-n] [-o] [-p proto] [-r] [-s] [-x] [-t] [interval]', '',
      '  -a            Displays all connections and listening ports.', '  -b            Displays the executable involved in creating each connection or', '                listening port. (requires elevation)',
      '  -n            Displays addresses and port numbers in numerical form.', '  -o            Displays the owning process ID associated with each connection.',
      '  -p proto      Shows connections for the protocol specified by proto; proto', '                may be any of: TCP, UDP, TCPv6, or UDPv6.', '  -r            Displays the routing table.'];
    if (flags.includes('r')) return winRoute(T, ['print']);
    if (flags.includes('b') && !T.admin()) return ['The requested operation requires elevation.'];
    const all = flags.includes('a'), numeric = flags.includes('n'), pidCol = flags.includes('o'), exe = flags.includes('b');
    const nameOf = ipS => { const dv = T.net.topo.devices.find(x => (x.ifaces || []).some(i => i.ip === ipS)); return dv ? dv.name : ipS; };
    const fmt = (addr, local) => {
      if (numeric) return addr;
      const m = /^(.*):(\d+|\*)$/.exec(addr); if (!m) return addr;
      const p = m[2] === '*' ? '*' : (SVC_NAME[+m[2]] || m[2]);
      let h = m[1];
      if (h === '*') return addr;
      if (h === '127.0.0.1') h = T.hostname();
      else if (h !== '0.0.0.0') h = local ? T.hostname() : nameOf(h);
      return `${h}:${p}`;
    };
    const L = ['', 'Active Connections', '', '  Proto  Local Address          Foreign Address        State' + (pidCol ? '           PID' : '')];
    liveRows(T).forEach(r => {
      if (proto && r[0] !== proto.replace(/V6$/, '')) return;
      if (/V6$/.test(proto || '')) return;
      if (!all && (r[3] === 'LISTENING' || r[0] === 'UDP')) return;
      const state = r[0] === 'UDP' ? '' : r[3];
      let line = '  ' + padE(r[0], 7) + padE(fmt(r[1], true), 23) + padE(fmt(r[2], false), 23);
      line += pidCol ? padE(state, 16) + r[4] : state;
      L.push(line.replace(/\s+$/, ''));
      if (exe) L.push(r[5] ? ` [${r[5]}]` : ' Can not obtain ownership information');
    });
    return L;
  }
  const SS_STATE = { LISTENING: 'LISTEN', ESTABLISHED: 'ESTAB', TIME_WAIT: 'TIME-WAIT', SYN_SENT: 'SYN-SENT', CLOSE_WAIT: 'CLOSE-WAIT', '': 'UNCONN' };
  const SS_BACKLOG = { sshd: 128, mysqld: 151, node: 511, nginx: 511 };
  function lnxSs(T, args) {
    if (args.some(a => a === '-h' || a === '--help')) return ['Usage: ss [ OPTIONS ]', '       ss [ OPTIONS ] [ FILTER ]',
      '   -h, --help          this message', '   -n, --numeric       don\'t resolve service names', '   -a, --all           display all sockets',
      '   -l, --listening     display listening sockets', '   -p, --processes     show process using socket', '   -t, --tcp           display only TCP sockets',
      '   -u, --udp           display only UDP sockets', '   -4, --ipv4          display only IP version 4 sockets'];
    const fl = {};
    const LONG = { '--numeric': 'n', '--all': 'a', '--listening': 'l', '--processes': 'p', '--tcp': 't', '--udp': 'u', '--ipv4': '4' };
    for (const a of args) {
      if (LONG[a]) { fl[LONG[a]] = true; continue; }
      if (/^-[a-zA-Z46]+$/.test(a)) { for (const ch of a.slice(1)) { if (!/[ntulpa4oeHrsx6]/.test(ch)) return [`ss: invalid option -- '${ch}'`, 'Usage: ss [ OPTIONS ]']; fl[ch] = true; } continue; }
      break; // FILTER expressions are ignored by the simulator
    }
    let want = [];
    if (fl.t) want.push('TCP'); if (fl.u) want.push('UDP');
    if (!want.length) want = ['TCP', 'UDP'];
    const rows = liveRows(T).filter(r => want.includes(r[0]) && (fl.a ? true : fl.l ? (r[3] === 'LISTENING' || r[0] === 'UDP') : (r[3] !== 'LISTENING' && r[0] !== 'UDP')));
    const port = p => fl.n || p === '*' ? p : (SVC_NAME[+p] || p);
    const loc = a => { const m = /^(.*):(\d+|\*)$/.exec(a); let h = m ? m[1] : a; const p = m ? m[2] : '*'; if (h === '127.0.0.53') h = '127.0.0.53%lo'; if (h === '*') h = '0.0.0.0'; return [h, port(p === '0' ? '*' : p)]; };
    const cols = rows.map(r => {
      const st = SS_STATE[r[0] === 'UDP' ? '' : r[3]] || r[3];
      const sendQ = st === 'LISTEN' ? (SS_BACKLOG[r[5]] || 4096) : 0;
      const proc = fl.p && T.root() && r[5] ? `users:(("${r[5]}",pid=${r[4]},fd=${3 + hashStr(r[1] + r[2]) % 20}))` : '';
      return { net: r[0].toLowerCase(), st, rq: '0', sq: String(sendQ), l: loc(r[1]), p: loc(r[2]), proc };
    });
    const showNet = want.length > 1;
    const wl = Math.max(13, ...cols.map(c => c.l[0].length + 1)), wlp = Math.max(4, ...cols.map(c => c.l[1].length));
    const wp = Math.max(12, ...cols.map(c => c.p[0].length + 1)), wpp = Math.max(4, ...cols.map(c => c.p[1].length));
    const head = (showNet ? 'Netid ' : '') + 'State  Recv-Q Send-Q ' + padS('Local Address', wl) + ':' + padE('Port', wlp) + padS('Peer Address', wp) + ':' + padE('Port', wpp) + 'Process';
    const L = [head];
    cols.forEach(c => {
      L.push(((showNet ? padE(c.net, 5) : '') + padE(c.st, 6) + padE(c.rq, 6) + padE(c.sq, 6) + padS(c.l[0], wl) + ':' + padE(c.l[1], wlp) + padS(c.p[0], wp) + ':' + padE(c.p[1], wpp) + c.proc).replace(/\s+$/, ''));
    });
    if (fl.p && !T.root() && rows.length) L.push(...T.hint('(ผู้ใช้ธรรมดาไม่เห็นชื่อโปรแกรมของผู้ใช้อื่น ถ้าต้องการดูคอลัมน์ Process ให้ใช้ sudo)'));
    return L;
  }
  function winGetmac(T) {
    const info = hostInfo(T.net, T.hostId), c = info.c;
    const tn = c.up === false ? 'Disabled' : !c.linked ? 'Media disconnected' : '\\Device\\Tcpip_{' + ((hashStr(c.mac || '') >>> 0).toString(16).toUpperCase() + '0000000').slice(0, 8) + '-6D2C-4E7A-9B3F-1C2D' + String(c.mac || '').replace(/-/g, '').slice(4) + '}';
    return ['', 'Physical Address    Transport Name', '=================== ==========================================================', padE(c.mac || 'N/A', 20) + tn];
  }
  const WIN_HELP = [
    'คำสั่งที่ใช้ได้ในระบบจำลอง (Windows Command Prompt):',
    '  ipconfig                 ดู IPv4 / Subnet mask / Default gateway',
    '  ipconfig /all            ดูข้อมูลเต็ม: MAC, DHCP, DNS Servers',
    '  ipconfig /release        คืน IP ที่ได้จาก DHCP',
    '  ipconfig /renew          ขอ IP ใหม่จาก DHCP',
    '  ipconfig /flushdns       ล้าง DNS cache',
    '  ping [-n N] ปลายทาง       ทดสอบการติดต่อ (IP หรือชื่อ)',
    '  tracert ปลายทาง           ดูเส้นทาง (Router ที่ผ่าน)',
    '  nslookup ชื่อ [server]     แปลงชื่อเป็น IP ผ่าน DNS',
    '  arp -a                   ดูตาราง ARP (IP ↔ MAC)',
    '  route print              ดูตารางเส้นทาง',
    '  netstat -an              ดูพอร์ตที่เปิดและการเชื่อมต่อ',
    '  netstat -ano             เหมือน -an และแสดง PID ของโปรแกรม',
    '  route add 0.0.0.0 mask 0.0.0.0 <gw>   เพิ่ม default route (Administrator)',
    '  คำสั่ง | findstr ข้อความ    กรองเฉพาะบรรทัดที่มีข้อความ',
    '  hostname / getmac / whoami / cls / help',
    'บัญชีผู้ใช้ กลุ่ม การแชร์ และสิทธิ์ (คำสั่งที่แก้ไขต้องเปิด Command Prompt แบบ Run as administrator):',
    '  net user [ชื่อ]                       ดูบัญชีทั้งหมด / รายละเอียดบัญชี',
    '  net user ชื่อ รหัสผ่าน|* /add            สร้างบัญชี (/delete ลบ, /active:no ปิดใช้งาน)',
    '  net localgroup [กลุ่ม]                 ดูกลุ่มทั้งหมด / สมาชิกของกลุ่ม',
    '  net localgroup กลุ่ม /add               สร้างกลุ่ม',
    '  net localgroup กลุ่ม ชื่อ /add|/delete    เพิ่ม/เอาสมาชิกออกจากกลุ่ม',
    '  net share [ชื่อแชร์]                    ดูแชร์ทั้งหมด / รายละเอียดและ Share permission',
    '  net share ชื่อ=ไดรฟ์:\\path /grant:ผู้ใช้,READ|CHANGE|FULL   สร้างแชร์',
    '  net share ชื่อ /delete                  ยกเลิกการแชร์ (ไฟล์ไม่ถูกลบ)',
    '  net view \\\\เครื่อง [/all]                  ดูแชร์ของเครื่องอื่น (/all รวมแชร์ซ่อน $)',
    '  net use [Z: \\\\เครื่อง\\แชร์ [/persistent:yes]]   ดู/ผูกไดรฟ์เครือข่าย',
    '  net use Z: /delete                     ยกเลิกไดรฟ์เครือข่าย',
    '  icacls path                            ดู NTFS permission ((I) = สืบทอดมา)',
    '  icacls path /grant กลุ่ม:(OI)(CI)M      ให้สิทธิ์ (/remove ชื่อ เอาออก, /grant:r แทนที่)',
    '  cd / dir / type / del / echo ข้อความ > ไฟล์   ทำงานกับโฟลเดอร์และไฟล์ (ใช้ทดสอบสิทธิ์)',
    '  ดูวิธีใช้ของแต่ละคำสั่ง: พิมพ์ชื่อคำสั่งตามด้วย /?  เช่น ping /?  net share /?  icacls /?'
  ];

  // ------------------------------------------------------------------ Linux commands
  function lnxIface(T) {
    const info = hostInfo(T.net, T.hostId), c = info.c;
    return { info, c, name: c.iface || (info.wifi ? 'wlan0' : 'eth0') };
  }
  function lnxFlags(c) { return c.up === false ? ['<BROADCAST,MULTICAST>', 'DOWN'] : !c.linked ? ['<NO-CARRIER,BROADCAST,MULTICAST,UP>', 'DOWN'] : ['<BROADCAST,MULTICAST,UP,LOWER_UP>', 'UP']; }
  const lmac = m => String(m || '00-00-00-00-00-00').toLowerCase().replace(/-/g, ':');
  function lnxIpAddr(T, opts) {
    const { info, c, name } = lnxIface(T);
    const [fl, st] = lnxFlags(c);
    const qd = info.wifi ? 'noqueue' : 'fq_codel';
    if (opts.brief) {
      const ip = c.ip ? `${c.ip}/${c.prefix}` : '';
      return [padE('lo', 16) + padE('UNKNOWN', 14) + '127.0.0.1/8 ::1/128', padE(name, 16) + padE(st, 14) + (ip + (c.ip && c.linked && c.up !== false ? ' ' + ll6(c.mac) + '/64' : '')).trim()];
    }
    const L = ['1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN group default qlen 1000',
      '    link/loopback 00:00:00:00:00:00 brd 00:00:00:00:00:00', '    inet 127.0.0.1/8 scope host lo', '       valid_lft forever preferred_lft forever'];
    if (!opts.v4) L.push('    inet6 ::1/128 scope host noprefixroute', '       valid_lft forever preferred_lft forever');
    L.push(`2: ${name}: ${fl} mtu 1500 qdisc ${qd} state ${st} group default qlen 1000`, `    link/ether ${lmac(c.mac)} brd ff:ff:ff:ff:ff:ff`);
    if (c.ip) {
      if (c.apipa) L.push(`    inet ${c.ip}/16 brd 169.254.255.255 scope link ${name}`, '       valid_lft forever preferred_lft forever');
      else if (info.dhcp) L.push(`    inet ${c.ip}/${c.prefix} brd ${c.broadcast} scope global dynamic noprefixroute ${name}`, `       valid_lft ${86400 - 4317}sec preferred_lft ${86400 - 4317}sec`);
      else L.push(`    inet ${c.ip}/${c.prefix} brd ${c.broadcast} scope global ${name}`, '       valid_lft forever preferred_lft forever');
    }
    if (!opts.v4 && c.up !== false && c.linked) L.push(`    inet6 ${ll6(c.mac)}/64 scope link`, '       valid_lft forever preferred_lft forever');
    return L;
  }
  function lnxIpLink(T) {
    const { c, name, info } = lnxIface(T);
    const [fl, st] = lnxFlags(c);
    return ['1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN mode DEFAULT group default qlen 1000', '    link/loopback 00:00:00:00:00:00 brd 00:00:00:00:00:00',
      `2: ${name}: ${fl} mtu 1500 qdisc ${info.wifi ? 'noqueue' : 'fq_codel'} state ${st} mode DEFAULT group default qlen 1000`, `    link/ether ${lmac(c.mac)} brd ff:ff:ff:ff:ff:ff`];
  }
  function lnxIpRoute(T) {
    const { c, name, info } = lnxIface(T);
    const rs = T.net.routes(T.hostId);
    const L = [];
    rs.filter(r => r.prefix === 0).forEach(r => L.push(info.dhcp ? `default via ${r.via} dev ${name} proto dhcp src ${c.ip} metric 100` : `default via ${r.via} dev ${name} proto static`));
    rs.filter(r => r.prefix !== 0).forEach(r => L.push(`${r.net}/${r.prefix} dev ${name} proto ${info.dhcp && !c.apipa ? 'dhcp' : 'kernel'} scope link src ${c.ip}${info.dhcp && !c.apipa ? ' metric 100' : ''}`));
    return L;
  }
  function lnxIp(T, args) {
    const opts = { v4: false, brief: false };
    const a = [];
    args.forEach(x => { if (x === '-4') opts.v4 = true; else if (x === '-br' || x === '-brief') opts.brief = true; else if (x === '-6' || x === '-c' || x === '-color') { /* ignore */ } else a.push(x); });
    const obj = (a[0] || '').toLowerCase();
    const sub = (a[1] || 'show').toLowerCase();
    const is = (w, full) => w.length >= 1 && full.startsWith(w);
    if (!obj) return ['Usage: ip [ OPTIONS ] OBJECT { COMMAND | help }', '       ip [ -force ] -batch filename', 'where  OBJECT := { address | link | neigh | route | rule | ... }', '       OPTIONS := { -4 | -6 | -br[ief] | -c[olor] | ... }'];
    if (is(obj, 'address') || obj === 'addr') {
      if (is(sub, 'show') || is(sub, 'list')) {
        const dev = a[2] === 'dev' ? a[3] : a[2];
        if (dev && dev !== lnxIface(T).name && dev !== 'lo') return [`Device "${dev}" does not exist.`];
        return lnxIpAddr(T, opts);
      }
      if (sub === 'add' || sub === 'del' || sub === 'flush') return T.root() ? T.hint('(ระบบจำลองไม่รองรับการเปลี่ยน IP ด้วยคำสั่ง — ใช้เพื่อการตรวจสอบเท่านั้น)') : ['RTNETLINK answers: Operation not permitted'];
      return [`Command "${a[1]}" is unknown, try "ip address help".`];
    }
    if (obj === 'help' || obj === '--help' || obj === '-h') return ['Usage: ip [ OPTIONS ] OBJECT { COMMAND | help }', 'where  OBJECT := { address | link | neigh | route | ... }',
      '       OPTIONS := { -4 | -6 | -br[ief] | -c[olor] | ... }', '', 'ตัวอย่าง: ip a, ip route, ip neigh, ip link set eth0 up, ip route add default via <gateway>'];
    if (is(obj, 'route') || obj === 'r') {
      if (is(sub, 'show') || is(sub, 'list')) return lnxIpRoute(T);
      if (sub === 'help') return ['Usage: ip route { list | flush } SELECTOR', '       ip route { add | del | change | append | replace } ROUTE', 'ROUTE := NODE_SPEC [ INFO_SPEC ]', 'ตัวอย่าง: ip route add default via 192.168.1.1'];
      if (sub === 'add' || sub === 'replace' || sub === 'del' || sub === 'delete') {
        if (!T.root()) return ['RTNETLINK answers: Operation not permitted'];
        const dst = a[2];
        if (dst !== 'default' && dst !== '0.0.0.0/0') return T.hint('(ระบบจำลองรองรับเฉพาะ default route เช่น ip route add default via <gateway>)');
        if (sub === 'del' || sub === 'delete') {
          if (!T.net.routes(T.hostId).some(r => r.prefix === 0)) return ['RTNETLINK answers: No such process'];
          if ((T.net.config(T.hostId) || {}).dhcp) return T.hint('(เครื่องนี้รับ gateway จาก DHCP ระบบจำลองไม่รองรับการลบ)');
          T.mutate(d => { d.gateway = ''; });
          return [];
        }
        const vi = a.indexOf('via');
        if (vi < 0 || !a[vi + 1]) return T.hint('(รูปแบบคำสั่ง: ip route add default via <IP gateway> [dev eth0])');
        const devI = a.indexOf('dev');
        if (devI > 0 && a[devI + 1] && a[devI + 1] !== lnxIface(T).name) return [`Cannot find device "${a[devI + 1]}"`];
        const chk = routeAddCheck(T.net, T.hostId, a[vi + 1], sub === 'replace');
        if (!chk.ok) {
          if (chk.err === 'bad') return [`Error: inet address is expected rather than "${a[vi + 1]}".`];
          if (chk.err === 'exists') return ['RTNETLINK answers: File exists'];
          if (chk.err === 'dhcp') return T.hint('(เครื่องนี้รับ gateway จาก DHCP ระบบจำลองไม่รองรับการเพิ่ม route ซ้อน)');
          return ['Error: Nexthop has invalid gateway.'];
        }
        T.mutate(d => { d.gateway = chk.via; });
        return [];
      }
      return [`Command "${a[1]}" is unknown, try "ip route help".`];
    }
    if (is(obj, 'link')) {
      if (sub === 'set') {
        let i = 2; if (a[i] === 'dev') i++;
        const dev = a[i], st = (a[i + 1] || '').toLowerCase();
        const { name } = lnxIface(T);
        if (!dev) return ['Not enough information: "dev" argument is required.'];
        if (dev !== name && dev !== 'lo') return [`Cannot find device "${dev}"`];
        if (st !== 'up' && st !== 'down') return st ? [`Error: either "dev" is duplicate, or "${st}" is a garbage.`] : [];
        if (!T.root()) return ['RTNETLINK answers: Operation not permitted'];
        if (dev === 'lo') return [];
        T.mutate(d => { d.ifaces.forEach(f => { if (f.name === name) f.up = st === 'up'; }); });
        return [];
      }
      if (is(sub, 'show') || is(sub, 'list')) return lnxIpLink(T);
      return [`Command "${a[1]}" is unknown, try "ip link help".`];
    }
    if (is(obj, 'neighbour') || is(obj, 'neighbor')) {
      const { name, c } = lnxIface(T);
      if (sub === 'flush') { if (!T.root()) return ['Failed to send flush request: Operation not permitted']; T.net.clearArp(T.hostId); return []; }
      if (!(is(sub, 'show') || is(sub, 'list'))) return [`Command "${a[1]}" is unknown, try "ip neigh help".`];
      if (c.up === false || !c.linked) return [];
      return T.net.arp(T.hostId).map(e => `${e.ip} dev ${name} lladdr ${lmac(e.mac)} REACHABLE`);
    }
    return [`Object "${a[0]}" is unknown, try "ip help".`];
  }
  function lnxPing(T, args) {
    if (args.includes('--help') || args.includes('-h')) return ['', 'Usage', '  ping [options] <destination>', '', 'Options:', '  <destination>      dns name or ip address',
      '  -c <count>         stop after <count> replies', '  -i <interval>      seconds between sending each packet', '  -n                 no dns name resolution',
      '  -t <ttl>           define time to live', '  -W <timeout>       time to wait for response', '', 'For more details see ping(8).'];
    let count = null, target = null;
    for (let i = 0; i < args.length; i++) {
      const a = args[i];
      if (a === '-c') { const v = args[++i]; if (!/^\d+$/.test(v || '') || +v < 1) return [`ping: invalid argument: '${v === undefined ? '' : v}'`]; count = +v; continue; }
      const m = /^-c(\d+)$/.exec(a); if (m) { count = +m[1]; continue; }
      if (/^-(i|W|w|s|t|I)$/.test(a)) { i++; continue; }
      if (/^-/.test(a)) continue;
      if (!target) target = a;
    }
    if (!target) return ['ping: usage error: Destination address required'];
    const extra = [];
    if (count === null) { count = 4; extra.push(...T.hint('(ระบบจำลอง: ไม่ได้ใส่ -c จึงส่ง 4 ครั้งแล้วหยุดให้ — บน Linux จริงต้องกด Ctrl+C)')); }
    if (count > 10) { extra.push(...T.hint('(ระบบจำลองส่งได้สูงสุด 10 ครั้ง)')); count = 10; }
    const r = T.net.ping(T.hostId, target, { count });
    const silent = !r.linux.some(l => /^64 bytes|^From /.test(l));
    return r.linux.map((l, i) => ({ t: l, d: /^64 bytes|^From /.test(l) ? 320 : (silent && i === 1 && l === '' ? 300 * count : 0) })).concat(extra);
  }
  function lnxTraceroute(T, args) {
    if (args.includes('--help')) return ['Usage:', '  traceroute [ -46dFITnreAUDV ] [ -f first_ttl ] [ -m max_ttl ] host [ packetlen ]', 'Options:',
      '  -m max_ttl  --max-hops=max_ttl', '                              Set the max number of hops (max TTL to be', '                              reached). Default is 30',
      '  -n                          Do not resolve IP addresses to their domain names', '  --help                      Read this help and exit'];
    let target = null, max = 30;
    for (let i = 0; i < args.length; i++) {
      if (args[i] === '-m') { const v = +args[++i]; if (v >= 1) max = Math.min(30, v); continue; }
      if (/^-/.test(args[i])) continue;
      if (!target) target = args[i];
    }
    if (!target) return ['Usage:', '  traceroute [ -46dFITnreAUDV ] [ -f first_ttl ] [ -m max_ttl ] host [ packetlen ]'];
    const r = T.net.traceroute(T.hostId, target, { maxHops: max });
    return r.linux.map(l => ({ t: l, d: /^\s*\d+\s+\*/.test(l) ? 800 : /^\s*\d+\s/.test(l) ? 380 : 0 }));
  }
  function lnxNslookup(T, args) {
    const a = args.filter(x => !/^-/.test(x));
    if (!a.length) return T.hint('(ระบบจำลองไม่รองรับโหมดโต้ตอบ — พิมพ์ nslookup <ชื่อ> [server])');
    return T.net.nslookup(T.hostId, a[0], a[1]).linux.map(l => ({ t: l, d: /timed out/.test(l) ? 500 : 0 }));
  }
  function lnxDig(T, args) {
    if (args.includes('-h') || args.includes('--help')) return ['Usage:  dig [@global-server] [domain] [q-type] [q-class] {q-opt}', '            {global-d-opt} host [@local-server] {local-d-opt}',
      'Use "dig -h" (with no arguments) for help on dig options. ตัวอย่าง: dig +short www.netlab.test, dig @8.8.8.8 www.netlab.test'];
    let name = null, server, short = false;
    args.forEach(x => { if (x === '+short') short = true; else if (/^@/.test(x)) server = x.slice(1); else if (/^[+-]/.test(x) || /^(A|IN)$/i.test(x)) { /* ignore */ } else if (!name) name = x; });
    if (!name) name = '.';
    const r = T.net.nslookup(T.hostId, name === '.' ? '' : name, server);
    const timeout = /timed out|no servers/.test((r.linux || []).join(' '));
    const srv = r.server || '127.0.0.53';
    if (timeout) return [{ t: `;; communications error to ${srv}#53: timed out`, d: 600 }, { t: `;; communications error to ${srv}#53: timed out`, d: 600 }, ';; no servers could be reached'];
    if (short) return r.ok ? [r.ip] : [];
    const st = r.ok ? 'NOERROR' : /SERVFAIL/.test(r.linux.join(' ')) ? 'SERVFAIL' : 'NXDOMAIN';
    const id = (hashStr(name) % 60000) + 1000;
    const q = name.replace(/\.$/, '') + '.';
    const L = ['', `; <<>> DiG 9.18.28-0ubuntu0.22.04.1-Ubuntu <<>> ${args.join(' ')}`, ';; global options: +cmd', ';; Got answer:',
      `;; ->>HEADER<<- opcode: QUERY, status: ${st}, id: ${id}`, `;; flags: qr${r.authoritative ? ' aa' : ''} rd ra; QUERY: 1, ANSWER: ${r.ok ? 1 : 0}, AUTHORITY: 0, ADDITIONAL: 1`, '',
      ';; QUESTION SECTION:', `;${q}\t\t\tIN\tA`, ''];
    if (r.ok) L.push(';; ANSWER SECTION:', `${q}\t\t${r.authoritative ? 3600 : 300}\tIN\tA\t${r.ip}`, '');
    L.push(';; Query time: ' + (r.authoritative ? 0 : 24) + ' msec', `;; SERVER: ${srv}#53(${srv}) (UDP)`, `;; WHEN: ${linuxDate(new Date())}`, `;; MSG SIZE  rcvd: ${r.ok ? 46 + q.length : 30 + q.length}`, '');
    return L;
  }
  function lnxHost(T, args) {
    const name = args.find(x => !/^-/.test(x));
    if (!name) return ['Usage: host [-aCdilrTvVw] [-c class] [-N ndots] [-t type] [-W time]', '            [-R number] [-m flag] [-p port] hostname [server]'];
    const r = T.net.nslookup(T.hostId, name, args[args.indexOf(name) + 1]);
    if (r.ok) return [r.name ? `${r.ip.split('.').reverse().join('.')}.in-addr.arpa domain name pointer ${r.name}.` : `${name} has address ${r.ip}`];
    if (/timed out|no servers/.test(r.linux.join(' '))) return [{ t: ';; connection timed out; no servers could be reached', d: 600 }];
    return [`Host ${name} not found: ${/SERVFAIL/.test(r.linux.join(' ')) ? '2(SERVFAIL)' : '3(NXDOMAIN)'}`];
  }
  function lnxCat(T, args) {
    if (!args.length) return [];
    const out = [];
    const { c, info } = lnxIface(T);
    args.forEach(f => {
      if (f === '/etc/resolv.conf') {
        out.push('# Generated by NetworkManager');
        if (info.dhcp && c.ip && !c.apipa) out.push('search lab.local');
        (c.dns || []).forEach(s => out.push('nameserver ' + s));
      } else if (f === '/etc/hostname') out.push(T.hostname());
      else if (f === '/etc/hosts') out.push('127.0.0.1\tlocalhost', `127.0.1.1\t${T.hostname()}`, '', '# The following lines are desirable for IPv6 capable hosts', '::1     ip6-localhost ip6-loopback');
      else out.push(`cat: ${f}: No such file or directory`);
    });
    return out;
  }
  function lnxDhclient(T, args) {
    if (!T.root()) return ['dhclient: Operation not permitted'];
    const info = hostInfo(T.net, T.hostId);
    if (!info.dhcp) return T.hint('(เครื่องนี้ตั้ง IP แบบ Static ไม่ได้ใช้ DHCP)');
    if (args.includes('-r')) { T.mutate(d => { d._released = true; d.dhcp = false; d.ifaces[0].ip = ''; d.ifaces[0].prefix = ''; }); return []; }
    T.mutate(d => { delete d._released; d.dhcp = true; d.ifaces[0].ip = ''; d.ifaces[0].prefix = 24; });
    const c = T.net.config(T.hostId);
    return c && c.ip && !c.apipa ? [] : [{ t: 'No DHCPOFFERS received.', d: 900 }];
  }
  const LNX_HELP = [
    'คำสั่งที่ใช้ได้ในระบบจำลอง (Linux bash):',
    '  ip a | ip addr            ดู IP address ของแต่ละ interface',
    '  ip -br a                  ดูแบบย่อ',
    '  ip route                  ดูตารางเส้นทาง / default gateway',
    '  ip link                   ดูสถานะ interface (UP/DOWN)',
    '  ip link set eth0 up|down  เปิด/ปิด interface (ต้องเป็น root หรือใช้ sudo)',
    '  ip neigh                  ดูตาราง ARP (IP ↔ MAC ที่เพิ่งติดต่อ)',
    '  ip route add default via <gw>   เพิ่ม default route (root/sudo)',
    '  ss -tulpn                 ดูพอร์ตที่เปิดรอ (sudo ss -tulpn เพื่อเห็นชื่อโปรแกรม/PID)',
    '  ss -tan                   ดูการเชื่อมต่อ TCP ทั้งหมด',
    '  ping -c N ปลายทาง          ทดสอบการติดต่อ',
    '  traceroute ปลายทาง         ดูเส้นทาง',
    '  nslookup ชื่อ | dig ชื่อ | dig +short ชื่อ | host ชื่อ',
    '  cat /etc/resolv.conf      ดู DNS server (nameserver)',
    '  คำสั่ง | grep ข้อความ      กรองเฉพาะบรรทัดที่มีข้อความ',
    '  hostname / whoami / clear / help',
    'ผู้ใช้ กลุ่ม และสิทธิ์ไฟล์ (คำสั่งที่แก้ไขต้องใช้ sudo):',
    '  id [ชื่อ] / groups [ชื่อ]   ดู uid, gid และกลุ่มที่สังกัด',
    '  sudo useradd -m -G กลุ่ม ชื่อ   สร้างผู้ใช้พร้อม home และกลุ่มเสริม (หรือ sudo adduser ชื่อ)',
    '  sudo passwd ชื่อ            ตั้งรหัสผ่าน',
    '  sudo usermod -aG กลุ่ม ชื่อ   เพิ่มเข้ากลุ่ม (ต้องมี -a ไม่งั้นกลุ่มเดิมหาย)',
    '  sudo groupadd กลุ่ม / getent group กลุ่ม / cat /etc/group',
    '  ls -l [path] / ls -ld โฟลเดอร์   ดูสิทธิ์ rwx เจ้าของ และกลุ่ม',
    '  sudo chmod 750 path | chmod g-w,o= path   ตั้งสิทธิ์ (เลขฐานแปด หรือตัวอักษร)',
    '  sudo chown ผู้ใช้:กลุ่ม path / sudo chgrp กลุ่ม path   เปลี่ยนเจ้าของ/กลุ่ม',
    '  sudo -u ชื่อ ls path         ทดสอบสิทธิ์ในฐานะผู้ใช้อื่น',
    '  cd / pwd / mkdir / touch',
    '  ดูวิธีใช้ของแต่ละคำสั่ง: พิมพ์ชื่อคำสั่งตามด้วย --help  เช่น ping --help'
  ];
  const NOT_INSTALLED = { ifconfig: 'net-tools', arp: 'net-tools', route: 'net-tools', netstat: 'net-tools', nmap: 'nmap', tracepath: 'iputils-tracepath' };

  // ------------------------------------------------------------------ output explanations (guided mode / free play)
  // Reads the actual output text, so the explanation matches what happened (reply, timeout, unreachable, empty table ...).
  function explainOutput(os, cmdLine, text) {
    const t = String(text || '');
    let tok = String(cmdLine || '').split('|')[0].trim().split(/\s+/);
    if (tok[0] === 'sudo') tok = tok.slice(1);
    const cmd = os === 'windows' ? (tok[0] || '').toLowerCase().replace(/\.exe$/, '') : (tok[0] || '');
    const args = tok.slice(1).join(' ').toLowerCase();
    const R = (x, mark) => ({ text: x, mark: mark || null });
    if (/is not recognized as an internal|command not found|not found, but can be installed/.test(t))
      return R('คำสั่งนี้ไม่มีในระบบนี้: Windows กับ Linux ใช้คำสั่งต่างกัน (เช่น ipconfig/ip a, tracert/traceroute, netstat/ss) พิมพ์ help เพื่อดูรายการคำสั่ง');
    if (/requires elevation|Operation not permitted/.test(t)) return R('คำสั่งนี้ต้องใช้สิทธิ์ผู้ดูแลระบบ: บน Linux ใส่ sudo นำหน้า บน Windows ต้องเปิด Command Prompt แบบ Run as administrator', 'elevation|not permitted');
    if (cmd === 'ipconfig') {
      if (/\/all/.test(args)) return R('ipconfig /all แสดงข้อมูลเต็ม: Physical Address = MAC, DHCP Enabled = รับ IP อัตโนมัติหรือไม่, DHCP Server = เครื่องที่แจก IP, DNS Servers = เครื่องที่ใช้แปลงชื่อเป็น IP', 'Physical Address|DHCP Enabled|DHCP Server|DNS Servers|IPv4 Address');
      if (/Media disconnected/.test(t)) return R('Media disconnected = ไม่มีสัญญาณที่การ์ดแลน (สายหลุด/สายเสีย/พอร์ตปิด) จึงไม่มี IP', 'Media');
      if (/Autoconfiguration IPv4/.test(t)) return R('IP ขึ้นต้น 169.254 (APIPA) แปลว่าขอ IP จาก DHCP ไม่สำเร็จ เครื่องจึงตั้ง IP ให้ตัวเองและไม่มี gateway', 'Autoconfiguration');
      return R('IPv4 Address = IP ของเครื่อง, Subnet Mask = ขนาดวงเครือข่าย, Default Gateway = Router ที่ใช้ส่งข้อมูลออกนอกวง (ถ้าว่างจะออกนอกวงไม่ได้)', 'IPv4 Address|Subnet Mask|Default Gateway');
    }
    if (cmd === 'ping') {
      if (/Reply from .*TTL=|bytes from .*ttl=/i.test(t)) return R('ปลายทางตอบกลับ (Reply) แปลว่าไปและกลับได้ time คือเวลาไป-กลับ ค่า TTL บอกระบบปฏิบัติการปลายทาง (Windows 128, Linux 64, Router 255) ลบด้วยจำนวน Router ที่ผ่าน', 'TTL=|ttl=');
      if (/Destination host unreachable|Destination Host Unreachable/.test(t)) return R('Destination host unreachable จาก IP ของเครื่องตัวเอง แปลว่าส่ง ARP หา MAC ของปลายทาง (หรือของ gateway) แล้วไม่มีใครตอบ: ปลายทางปิด/ไม่อยู่ในวงนี้ หรือ gateway ผิด', 'unreachable');
      if (/Destination net unreachable|Destination Net Unreachable/.test(t)) return R('Destination net unreachable มาจาก Router: Router ไม่มีเส้นทางไปวงเครือข่ายปลายทาง', 'unreachable');
      if (/TTL expired|Time to live exceeded/.test(t)) return R('TTL expired in transit: แพ็กเก็ตวนอยู่ระหว่าง Router (routing loop) จน TTL หมด', 'TTL expired|Time to live');
      if (/General failure|Network is unreachable|transmit failed/.test(t)) return R('ส่งออกไม่ได้เลยตั้งแต่เครื่องตัวเอง: ไม่มีเส้นทาง/ไม่มี Default gateway สำหรับปลายทางต่างวง หรือการ์ดแลนไม่มีสัญญาณ', 'General failure|unreachable');
      if (/could not find host|Name or service not known|Temporary failure in name resolution/.test(t)) return R('แปลงชื่อเป็น IP ไม่ได้ (DNS): ตรวจ DNS server ด้วย ipconfig /all หรือ cat /etc/resolv.conf แล้วลอง nslookup', 'could not find|not known|name resolution');
      if (/Request timed out|100% packet loss/.test(t)) return R('ส่งออกไปแล้วแต่ไม่มีคำตอบภายในเวลาที่กำหนด: ปลายทางอาจปิด ไฟร์วอลล์บล็อก ping หรือทางกลับมีปัญหา (ping ไม่ได้ไม่ได้แปลว่าเครือข่ายเสียเสมอไป)', 'timed out|packet loss');
      return R('ping ส่ง ICMP Echo Request แล้วรอ Echo Reply เพื่อทดสอบการติดต่อ');
    }
    if (cmd === 'tracert' || cmd === 'traceroute') {
      if (/Network is unreachable|General failure|Unable to resolve|Name or service not known/.test(t)) return R('ส่งไม่ได้ตั้งแต่ต้นทาง (ไม่มีเส้นทาง/แปลงชื่อไม่ได้) จึงไม่มี hop ใดเลย', 'unreachable|failure|resolve|not known');
      return R('แต่ละบรรทัดที่มีหมายเลขคือ 1 hop (Router ที่ผ่าน) hop 1 คือ Default gateway บรรทัด * หรือ Request timed out คือ hop ที่ไม่ตอบกลับ', os === 'windows' ? '^\\s+\\d+\\s' : '^\\s*\\d+\\s');
    }
    if (cmd === 'nslookup' || cmd === 'dig' || cmd === 'host') {
      if (/timed out|no servers could be reached/.test(t)) return R('ติดต่อ DNS server ไม่ได้: ตรวจว่า DNS server ถูกต้องและ ping ถึงหรือไม่', 'timed out|no servers');
      if (/Non-existent domain|NXDOMAIN|can't find|not found/.test(t)) return R('DNS server ตอบว่าไม่มีชื่อนี้ (NXDOMAIN): ชื่อผิด หรือ DNS server ไม่มีระเบียนของชื่อนี้', "can't find|NXDOMAIN|not found");
      return R('Server/Address ส่วนแรกคือ DNS server ที่ตอบ ส่วน Name/Address ด้านล่างคือคำตอบ Non-authoritative answer แปลว่า DNS server ไปถามต่อจากที่อื่น', '^Name:|^Address:|has address|IN\\s+A\\s|^\\d+\\.\\d+\\.\\d+\\.\\d+$');
    }
    if ((cmd === 'arp' && /-a|-g/.test(args)) || (cmd === 'ip' && /^n/.test(args))) {
      if (!/dynamic|lladdr/.test(t)) return R('ตาราง ARP ยังว่าง: เครื่องจะรู้ MAC ของเครื่องอื่นก็ต่อเมื่อได้ติดต่อกันแล้ว ลอง ping เครื่องในวงเดียวกันก่อน แล้วดูใหม่');
      return R('แต่ละแถวจับคู่ IP กับ MAC ของเครื่องที่เพิ่งติดต่อในวงเดียวกัน (dynamic/REACHABLE) ปลายทางต่างวงจะไม่อยู่ในตาราง เพราะส่งผ่าน MAC ของ gateway แทน', 'dynamic|lladdr');
    }
    if (cmd === 'netstat' && !/-r|\/r/.test(args)) return R('LISTENING = พอร์ตที่เปิดรอรับ, ESTABLISHED = กำลังเชื่อมต่ออยู่ (Foreign Address คืออีกฝั่ง), Local Address 0.0.0.0 = รับทุก IP' + (/o/.test(args) ? ' คอลัมน์ PID คือหมายเลขโปรแกรมเจ้าของการเชื่อมต่อ' : ''), 'LISTENING|ESTABLISHED');
    if (cmd === 'ss') return R('LISTEN = เปิดรอรับ, ESTAB = เชื่อมต่ออยู่, UNCONN = UDP ที่รอรับ, Local Address 127.0.0.1 = รับเฉพาะจากเครื่องตัวเอง, 0.0.0.0 = รับทุก IP' + (/users:/.test(t) ? ' คอลัมน์ Process บอกชื่อโปรแกรมและ pid' : ''), 'LISTEN|ESTAB');
    if ((cmd === 'route' && /print/.test(args)) || (cmd === 'netstat' && /r/.test(args))) {
      if (!/^\s+0\.0\.0\.0\s+0\.0\.0\.0/m.test(t)) return R('ไม่มีแถว 0.0.0.0 / 0.0.0.0 (default route) เครื่องนี้จึงส่งข้อมูลออกนอกวงไม่ได้');
      return R('แถว Network Destination 0.0.0.0 Netmask 0.0.0.0 คือ default route: ปลายทางที่ไม่อยู่ในวงใดจะส่งไปที่ Gateway ในแถวนี้', '^\\s+0\\.0\\.0\\.0\\s+0\\.0\\.0\\.0');
    }
    if (cmd === 'ip' && /^r/.test(args)) {
      if (/^(r|ro|rou|rout|route)\s+(add|replace|del)/.test(args)) return R(t.trim() ? 'คำสั่งเพิ่ม/ลบเส้นทางไม่สำเร็จ อ่านข้อความ error เพื่อหาสาเหตุ' : 'สำเร็จ (Linux ไม่แสดงข้อความเมื่อทำสำเร็จ) ตรวจผลด้วย ip route', 'Error|RTNETLINK');
      if (!/^default/m.test(t)) return R('ไม่มีบรรทัด default via ... แปลว่าไม่มี Default gateway เครื่องนี้จึงส่งข้อมูลออกนอกวงไม่ได้ (ping จะขึ้น Network is unreachable)');
      return R('default via ... คือ Default gateway บรรทัดที่มี scope link คือวงเครือข่ายที่ต่อตรงกับ interface', '^default');
    }
    if (cmd === 'ip' && /^(a|addr|address|-)/.test(args)) return R('บรรทัด inet คือ IPv4 ในรูป IP/prefix, state UP/DOWN บอกสถานะ interface, link/ether คือ MAC' + (/dynamic/.test(t) ? ' คำว่า dynamic แปลว่าได้ IP จาก DHCP' : ''), 'inet |state |link/ether');
    if (cmd === 'ip' && /^l/.test(args)) return R(/set/.test(args) ? (t.trim() ? 'คำสั่งไม่สำเร็จ อ่านข้อความ error' : 'สำเร็จ (ไม่แสดงข้อความ) ตรวจผลด้วย ip a') : 'state UP = เปิดใช้งาน, DOWN = ปิดอยู่ (ไม่มีคำว่า UP ใน <...>) หรือไม่มีสัญญาณ (NO-CARRIER)', 'state |NO-CARRIER');
    if (cmd === 'cat' && /resolv/.test(args)) return R('บรรทัด nameserver คือ DNS server ที่เครื่อง Linux ใช้', '^nameserver');
    if (cmd === 'getmac') return R('Physical Address คือ MAC ของการ์ดแลน (48 บิต เลขฐานสิบหก 6 คู่)', '^[0-9A-F]{2}-');
    // accounts, shares and permissions (NL_SYS)
    if (/^System error 5 has occurred|Access is denied\.|Permission denied|cannot lock \/etc\/passwd|Only root may/m.test(t) && !/^(dir|ls|type|cat|del|echo|icacls)$/.test(cmd))
      return R(os === 'windows' ? 'Access is denied (System error 5): ต้องเปิด Command Prompt แบบ Run as administrator จึงจะสร้าง/แก้บัญชี กลุ่ม แชร์ หรือสิทธิ์ได้' : 'ต้องใช้สิทธิ์ root: ใส่ sudo นำหน้าคำสั่ง', 'denied|Permission|lock|root');
    if (cmd === 'net' && /^share/.test(args)) {
      if (/Permission\s/.test(t)) return R('Permission คือ Share permission (Read / Change / Full) มีผลเฉพาะเมื่อเข้าผ่านเครือข่าย สิทธิ์จริง = ค่าที่จำกัดกว่าระหว่าง Share กับ NTFS (ดู NTFS ด้วย icacls)', '^Permission|^\\s{18}\\S');
      if (/^Share name\s+Resource/m.test(t)) return R('รายการแชร์ของเครื่องนี้: ชื่อที่ลงท้ายด้วย $ เป็นแชร์ซ่อน (C$, ADMIN$, IPC$ เป็นแชร์ของระบบ) Resource คือ path จริงบนดิสก์', '\\$\\s');
      if (/shared successfully|deleted successfully/.test(t)) return R('สำเร็จ ตรวจผลด้วย net share ชื่อแชร์ (ถ้าไม่ใส่ /grant ระบบให้ Everyone แบบ READ)', 'successfully');
    }
    if (cmd === 'net' && /^use/.test(args)) {
      if (/^Status\s+Local/m.test(t)) return R('Status OK = ใช้งานได้, Unavailable = ติดต่อเครื่องปลายทางไม่ได้ Local คือตัวอักษรไดรฟ์ Remote คือ UNC path (\\\\เครื่อง\\แชร์)', '^(OK|Unavailable|Disconnected)\\s');
      if (/System error 53/.test(t)) return R('System error 53 = หาเครื่องหรือเส้นทางไม่พบ: ตรวจชื่อ/IP ของเครื่อง และ ping ดูก่อน', 'error 53');
      if (/System error 67/.test(t)) return R('System error 67 = เจอเครื่องแล้วแต่ไม่มีแชร์ชื่อนี้: ดูชื่อแชร์ด้วย net view \\\\เครื่อง', 'error 67');
      if (/System error 85/.test(t)) return R('System error 85 = ตัวอักษรไดรฟ์นี้ถูกใช้อยู่แล้ว: เลือกตัวอื่น หรือยกเลิกของเดิมด้วย net use X: /delete', 'error 85');
    }
    if (cmd === 'net' && /^user/.test(args) && /^User name/m.test(t)) return R('Account active บอกว่าบัญชีเปิดใช้งานหรือไม่ Local Group Memberships คือกลุ่มที่บัญชีนี้สังกัด (สิทธิ์ส่วนใหญ่ได้มาจากกลุ่ม)', '^Account active|^Local Group|^\\s{29}\\*');
    if (cmd === 'net' && /^localgroup/.test(args) && /^Members/m.test(t)) return R('รายชื่อใต้เส้นประคือสมาชิกของกลุ่มนี้ สมาชิกทุกคนได้สิทธิ์ที่ให้กับกลุ่ม', '^Alias name');
    if (cmd === 'icacls' && /Successfully processed/.test(t) && !/processed file/.test(t)) return R('แต่ละบรรทัดคือ ACE: ชื่อผู้ใช้/กลุ่ม:(สิทธิ์) F=Full control, M=Modify, RX=Read & execute, R=Read, W=Write (I)=สืบทอดจากโฟลเดอร์แม่ (OI)(CI)=ส่งต่อให้ไฟล์และโฟลเดอร์ย่อย', '\\((F|M|RX|R|W)\\)');
    if (cmd === 'icacls' && /processed file/.test(t)) return R('แก้สิทธิ์สำเร็จ ตรวจผลด้วย icacls path อีกครั้ง (ACE ที่มี (I) สืบทอดมา แก้ที่โฟลเดอร์แม่ หรือเอาออกด้วย /remove ไม่ได้)', 'processed');
    if ((cmd === 'id' || cmd === 'groups') && /uid=|\s:\s/.test(t)) return R('uid = หมายเลขผู้ใช้, gid = กลุ่มหลัก, groups = ทุกกลุ่มที่สังกัด (กลุ่มเสริมให้สิทธิ์ของกลุ่มนั้นกับไฟล์)', 'uid=|:');
    if (cmd === 'ls' && /^[-d][rwxsStT-]{9}/m.test(t)) return R('ตัวอักษร 10 ตัว: ตัวแรก d = โฟลเดอร์ แล้วเป็น rwx ของเจ้าของ (u) กลุ่ม (g) และคนอื่น (o) คอลัมน์ถัดไปคือเจ้าของและกลุ่ม เช่น rwxr-x--- = 750', '^[-d][rwxsStT-]{9}');
    return null;
  }

  // ------------------------------------------------------------------ terminal component
  const WIN_CMDS = ['ipconfig', 'ping', 'tracert', 'nslookup', 'arp', 'route', 'netstat', 'hostname', 'getmac', 'cls', 'help', 'whoami', 'ver', 'echo', 'exit', 'findstr', 'net', 'icacls', 'cd', 'dir', 'type', 'del'];
  const LNX_CMDS = ['ip', 'ping', 'traceroute', 'nslookup', 'dig', 'host', 'cat', 'ss', 'hostname', 'whoami', 'clear', 'help', 'sudo', 'pwd', 'ls', 'echo', 'exit', 'dhclient', 'grep',
    'id', 'groups', 'getent', 'useradd', 'adduser', 'usermod', 'userdel', 'groupadd', 'gpasswd', 'passwd', 'chmod', 'chown', 'chgrp', 'cd', 'mkdir', 'touch'];
  const OPTS = {
    ipconfig: ['/all', '/release', '/renew', '/flushdns'], arp: ['-a', '-d'], route: ['print', 'add', 'delete'], netstat: ['-an', '-ano', '-a', '-r'],
    ip: ['addr', 'address', 'route', 'link', 'neigh'], cat: ['/etc/resolv.conf', '/etc/hosts', '/etc/hostname', '/etc/passwd', '/etc/group'], dig: ['+short'], ping: ['-n', '-c'], ss: ['-tulpn', '-tan', '-tlpn'],
    net: ['user', 'localgroup', 'share', 'use', 'view'], icacls: ['/grant', '/remove', '/inheritance:'], getent: ['group', 'passwd'], ls: ['-l', '-ld', '-la'], usermod: ['-aG']
  };
  const WIN_CONFUSE = { chmod: 'บน Windows ใช้ icacls', chown: 'บน Windows ใช้ icacls /setowner (ในงานนี้ใช้ icacls /grant)', useradd: 'บน Windows ใช้ net user ชื่อ รหัสผ่าน /add', adduser: 'บน Windows ใช้ net user ชื่อ รหัสผ่าน /add', usermod: 'บน Windows ใช้ net localgroup กลุ่ม ชื่อ /add', id: 'บน Windows ใช้ whoami หรือ net user ชื่อ', groups: 'บน Windows ใช้ net user ชื่อ (ดู Local Group Memberships)', traceroute: 'บน Windows ใช้ tracert', ifconfig: 'บน Windows ใช้ ipconfig', clear: 'บน Windows ใช้ cls', ip: 'บน Windows ใช้ ipconfig / route print / arp -a', dig: 'บน Windows ใช้ nslookup',
    ls: 'บน Windows ใช้ dir', ss: 'บน Windows ใช้ netstat -ano', grep: 'บน Windows ใช้ findstr', sudo: 'บน Windows ต้องเปิด Command Prompt แบบ Run as administrator' };
  const LNX_CONFUSE = { net: 'บน Linux ใช้ useradd / usermod / groupadd / id แทน net user / net localgroup', icacls: 'บน Linux ใช้ chmod / chown / ls -l', dir: 'บน Linux ใช้ ls -l', ipconfig: 'บน Linux ใช้ ip a', tracert: 'บน Linux ใช้ traceroute', cls: 'บน Linux ใช้ clear', getmac: 'บน Linux ดู MAC ด้วย ip link', ifconfig: 'ใช้ ip a แทน',
    netstat: 'Linux ปัจจุบันใช้ ss -tulpn แทน netstat', arp: 'Linux ปัจจุบันใช้ ip neigh แทน arp', route: 'Linux ปัจจุบันใช้ ip route แทน route', findstr: 'บน Linux ใช้ grep' };

  function createTerminal(container, opts) {
    injectCss();
    opts = opts || {};
    const T = {
      net: opts.net, hostId: opts.hostId, os: null, user: opts.user || 'student', netstat: opts.netstat || null,
      t0: Date.now(), history: [], hIdx: -1, draft: '', busy: false, cancel: null, timers: new Set(), destroyed: false, saved: new Map(), sudoOk: new Set()
    };
    // optional per-session history (opts.historyKey): one list per host, kept in sessionStorage so a reload in the same tab keeps it
    const HKEY = opts.historyKey ? 'nl-term-hist|' + String(opts.historyKey) : null;
    const loadHist = hostId => {
      if (!HKEY) return null;
      try { const a = JSON.parse(sessionStorage.getItem(HKEY + '|' + hostId) || '[]'); return Array.isArray(a) ? a.filter(x => typeof x === 'string').slice(-200) : []; } catch (e) { return []; }
    };
    const saveHist = () => { if (!HKEY) return; try { sessionStorage.setItem(HKEY + '|' + T.hostId, JSON.stringify(T.history.slice(-200))); } catch (e) { /* ignore */ } };
    const coarse = () => { try { return !!(window.matchMedia && window.matchMedia('(pointer:coarse)').matches); } catch (e) { return false; } };
    const ICON = {
      up: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>',
      down: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12l7 7 7-7"/></svg>',
      run: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M7 4.5v15l12-7.5z"/></svg>',
      copy: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/></svg>'
    };
    const instant = () => !!opts.instant || reduced();
    const el = document.createElement('div');
    el.className = 'nls-terminal-term';
    el.innerHTML = `<div class="nls-terminal-bar"><span class="nls-terminal-title"></span><div class="nls-terminal-dots" aria-hidden="true"><i></i><i></i><i></i></div></div>
<div class="nls-terminal-screen"><div class="nls-terminal-out" role="log" aria-live="polite" aria-label="ผลลัพธ์ของคำสั่ง"></div>
<div class="nls-terminal-inrow"><span class="nls-terminal-prompt"></span><input class="nls-terminal-in" type="text" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="send" aria-label="พิมพ์คำสั่ง แล้วกด Enter"></div></div>
<div class="nls-terminal-tools" role="toolbar" aria-label="เครื่องมือ terminal">
<button type="button" class="nls-terminal-tb nls-terminal-hup" aria-label="คำสั่งก่อนหน้า" title="คำสั่งก่อนหน้า (↑)">${ICON.up}</button>
<button type="button" class="nls-terminal-tb nls-terminal-hdown" aria-label="คำสั่งถัดไป" title="คำสั่งถัดไป (↓)">${ICON.down}</button>
<button type="button" class="nls-terminal-tb nls-terminal-run" aria-label="รันคำสั่ง">${ICON.run}<span>รัน</span></button>
<span class="nls-terminal-tsp"></span>
<button type="button" class="nls-terminal-tb nls-terminal-copy">${ICON.copy}<span class="nls-terminal-copylbl">คัดลอกผลลัพธ์</span></button>
<span class="nls-terminal-sr" role="status" aria-live="polite"></span>
</div>
<div class="nls-terminal-quick" role="group" aria-label="ปุ่มคำสั่งด่วน"></div>`;
    container.appendChild(el);
    const $ = s => el.querySelector(s);
    const screen = $('.nls-terminal-screen'), out = $('.nls-terminal-out'), input = $('.nls-terminal-in'), promptEl = $('.nls-terminal-prompt'),
      inrow = $('.nls-terminal-inrow'), quick = $('.nls-terminal-quick'), title = $('.nls-terminal-title'),
      tools = $('.nls-terminal-tools'), bUp = $('.nls-terminal-hup'), bDown = $('.nls-terminal-hdown'), bRun = $('.nls-terminal-run'),
      bCopy = $('.nls-terminal-copy'), copyLbl = $('.nls-terminal-copylbl'), live = tools.querySelector('[role="status"]');
    if (opts.height) screen.style.height = typeof opts.height === 'number' ? opts.height + 'px' : opts.height;
    else screen.style.height = '420px';
    if (opts.quick === false) quick.remove();

    T.root = () => T.user === 'root' || T.sudo === true;
    T.admin = () => /^administrator$/i.test(T.user);
    T.hostname = () => { const d = topoDev(T.net, T.hostId); return String(d ? d.name : T.hostId).replace(/\s+/g, '-'); };
    T.hint = text => [{ t: text, cls: 'nls-terminal-hint' }];
    T.mutate = fn => {
      const topo = clone(T.net.topo);
      const d = topo.devices.find(x => x.id === T.hostId);
      if (!d) return;
      fn(d);
      T.net = NS().create(topo);
      if (typeof opts.onNetChange === 'function') { try { opts.onNetChange(T.net); } catch (e) { /* ignore */ } }
    };

    function promptParts() {
      const SY = window.NL_SYS;
      if (T.os === 'windows') return [{ t: (SY ? SY.cwd(T.net, T.hostId, 'windows', T.user, T.admin()) : (T.admin() ? 'C:\\Windows\\system32' : `C:\\Users\\${T.user}`)) + '>' }];
      const r = T.user === 'root';
      const home = r ? '/root' : '/home/' + T.user;
      const cwd = SY ? SY.cwd(T.net, T.hostId, 'linux', T.user) : home;
      const shown = cwd === home ? '~' : cwd.startsWith(home + '/') ? '~' + cwd.slice(home.length) : cwd;
      return [{ t: `${T.user}@${T.hostname()}`, c: 'nls-terminal-pu' }, { t: ':' }, { t: shown, c: 'nls-terminal-pp' }, { t: r ? '# ' : '$ ' }];
    }
    // accounts, groups, shares and permissions (NL_SYS, shared with the server grader)
    function sysRun(line) {
      const r = window.NL_SYS.run({ net: T.net, hostId: T.hostId, os: T.os, user: T.user, admin: T.admin() }, line);
      return (r.out || []).map(x => typeof x === 'string' ? x : { t: x.t, cls: x.cls });
    }
    function renderPrompt(target) {
      target.textContent = '';
      promptParts().forEach(p => { const s = document.createElement('span'); s.textContent = p.t; if (p.c) s.className = p.c; target.appendChild(s); });
    }
    function line(text, cls) {
      const d = document.createElement('div');
      d.textContent = text === '' ? '' : text;
      if (cls) d.className = cls;
      out.appendChild(d);
      if (T.made) T.made.push(d);
      while (out.childNodes.length > 1500) out.removeChild(out.firstChild);
      screen.scrollTop = screen.scrollHeight;
      return d;
    }
    function echo(cmd) {
      const d = document.createElement('div'); d.className = 'nls-terminal-echo';
      renderPrompt(d);
      d.appendChild(document.createTextNode(cmd));
      out.appendChild(d);
    }
    function banner() {
      const d = topoDev(T.net, T.hostId) || {};
      if (T.os === 'windows') {
        title.textContent = (T.admin() ? 'Administrator: ' : '') + 'Command Prompt — ' + (d.name || T.hostId);
        line(d.type === 'server' ? 'Microsoft Windows [Version 10.0.20348.2582]' : 'Microsoft Windows [Version 10.0.19045.4651]');
        line('(c) Microsoft Corporation. All rights reserved.'); line('');
      } else {
        title.textContent = `${T.user}@${T.hostname()}: ~`;
        line(`Welcome to Ubuntu 22.04.4 LTS (GNU/Linux 5.15.0-112-generic x86_64)`); line('');
        line(`Last login: ${linuxDate(new Date(T.t0 - 3600 * 1000 * 3)).replace(' +07', '')} from 10.0.0.5`);
      }
      line('พิมพ์ help เพื่อดูคำสั่งที่ใช้ได้', 'nls-terminal-hint');
      if (T.os === 'windows') line('');
    }
    function quickButtons() {
      if (opts.quick === false) return;
      const c = T.net && T.net.config(T.hostId) || {};
      const gw = c.gateway || '';
      // [command, runs immediately?]  commands that still need an argument only fill the input
      const custom = typeof opts.quickList === 'function' ? opts.quickList(T.hostId, T.os) : null;
      const list = Array.isArray(custom) && custom.length ? custom : T.os === 'windows'
        ? [['ipconfig', 1], ['ipconfig /all', 1], ['ping ' + (gw || ''), !!gw], ['ping 8.8.8.8', 1], ['ping ', 0], ['tracert 8.8.8.8', 1], ['nslookup ', 0], ['arp -a', 1], ['netstat -ano', 1], ['netstat -an', 1], ['route print', 1], ['cls', 1]]
        : [['ip a', 1], ['ip route', 1], ['cat /etc/resolv.conf', 1], ['ping -c 4 ' + (gw || ''), !!gw], ['ping -c 4 8.8.8.8', 1], ['ping -c 4 ', 0], ['traceroute 8.8.8.8', 1], ['nslookup ', 0], ['dig +short ', 0], ['ip neigh', 1], ['ss -tulpn', 1], ['sudo ss -tulpn', 1], ['ip link', 1], ['clear', 1]];
      const keep = quick.scrollLeft;
      quick.innerHTML = '';
      const seen = new Set();
      list.forEach(([cmd, run]) => {
        if (seen.has(cmd)) return; seen.add(cmd);
        const b = document.createElement('button'); b.type = 'button'; b.className = 'nls-terminal-qb' + (run ? '' : ' nls-terminal-arg'); b.textContent = cmd.trim() || cmd;
        b.dataset.cmd = cmd;
        if (!run) b.setAttribute('aria-label', cmd.trim() + ' (ใส่ปลายทางต่อเอง)');
        b.addEventListener('click', () => {
          if (T.busy) return;
          if (run) api.run(cmd);
          else { input.value = cmd; input.focus(); try { input.setSelectionRange(cmd.length, cmd.length); } catch (e) { /* ignore */ } }
        });
        quick.appendChild(b);
      });
      quick.scrollLeft = keep;
    }
    function setBusy(b) {
      if (b) T.refocus = document.activeElement === input; // hiding the input row drops focus; give it back afterwards
      T.busy = b; inrow.hidden = b;
      quick.querySelectorAll('button').forEach(x => { x.disabled = b; });
      [bUp, bDown, bRun].forEach(x => { x.disabled = b; });
      if (!b) {
        renderPrompt(promptEl); screen.scrollTop = screen.scrollHeight;
        if (T.refocus && !T.destroyed) { T.refocus = false; try { input.focus({ preventScroll: true }); } catch (e) { input.focus(); } }
      }
    }
    function wait(ms) {
      return new Promise(res => {
        if (ms <= 0 || instant()) return res(true);
        const id = setTimeout(() => { T.timers.delete(id); res(true); }, ms);
        T.timers.add(id);
        T.cancel = () => { clearTimeout(id); T.timers.delete(id); res(false); };
      });
    }
    function tokenize(s) {
      const out = []; const re = /"([^"]*)"|'([^']*)'|(\S+)/g; let m;
      while ((m = re.exec(s))) out.push(m[1] !== undefined ? m[1] : m[2] !== undefined ? m[2] : m[3]);
      return out;
    }
    function execWin(cmdLine) {
      if (window.NL_SYS && window.NL_SYS.handles('windows', cmdLine)) return sysRun(cmdLine);
      const tok = tokenize(cmdLine);
      let cmd = (tok[0] || '').toLowerCase().replace(/\.exe$/, '');
      const args = tok.slice(1);
      switch (cmd) {
        case 'ipconfig': return winIpconfig(T, args);
        case 'ping': return winPing(T, args);
        case 'tracert': return winTracert(T, args);
        case 'nslookup': return winNslookup(T, args);
        case 'arp': return winArp(T, args);
        case 'route': return winRoute(T, args);
        case 'netstat': return winNetstat(T, args);
        case 'hostname': return [T.hostname()];
        case 'getmac': return winGetmac(T);
        case 'whoami': return [`${T.hostname().toLowerCase()}\\${T.user.toLowerCase()}`];
        case 'ver': return ['', (topoDev(T.net, T.hostId) || {}).type === 'server' ? 'Microsoft Windows [Version 10.0.20348.2582]' : 'Microsoft Windows [Version 10.0.19045.4651]'];
        case 'echo': return [args.length ? cmdLine.replace(/^\s*echo\s?/i, '') : 'ECHO is on.'];
        case 'help':
          if (args[0]) return [`This command is not supported by the help utility.  Try "${args[0]} /?".`];
          return WIN_HELP.map(t => ({ t, cls: 'nls-terminal-hint' }));
        case 'exit': return T.hint('(ระบบจำลอง: ไม่สามารถปิดหน้าต่างนี้ได้)');
        case 'cls': out.textContent = ''; return [];
        default: {
          const L = [`'${tok[0]}' is not recognized as an internal or external command,`, 'operable program or batch file.'];
          if (WIN_CONFUSE[cmd]) L.push(...T.hint('(คำใบ้: ' + WIN_CONFUSE[cmd] + ')'));
          return L;
        }
      }
    }
    function execLinux(cmdLine) {
      let tok = tokenize(cmdLine);
      T.sudo = false;
      const pre = [];
      if (tok[0] === 'sudo') {
        tok = tok.slice(1);
        if (!tok.length) return ['usage: sudo -h | -K | -k | -V', 'usage: sudo [-u user] command'];
        // sudo asks for the password once, then remembers it for a while (timestamp cache)
        const ck = T.hostId + '|' + T.user;
        if (T.user !== 'root' && !T.sudoOk.has(ck)) { pre.push(`[sudo] password for ${T.user}: `); pre.push(...T.hint('(ระบบจำลอง: ยอมรับรหัสผ่านอัตโนมัติ และจำไว้ คำสั่ง sudo ถัดไปจะไม่ถามซ้ำ)')); T.sudoOk.add(ck); }
        T.sudo = true;
        if (tok[0] === '-u' && tok[1]) { T.sudo = tok[1] === 'root'; tok = tok.slice(2); }
      }
      if (window.NL_SYS && window.NL_SYS.handles('linux', cmdLine)) { T.sudo = false; return pre.concat(sysRun(cmdLine)); }
      const cmd = tok[0] || '', args = tok.slice(1);
      let r;
      switch (cmd) {
        case 'ip': r = lnxIp(T, args); break;
        case 'ping': r = lnxPing(T, args); break;
        case 'traceroute': r = lnxTraceroute(T, args); break;
        case 'nslookup': r = lnxNslookup(T, args); break;
        case 'dig': r = lnxDig(T, args); break;
        case 'host': r = lnxHost(T, args); break;
        case 'cat': r = lnxCat(T, args); break;
        case 'dhclient': r = lnxDhclient(T, args); break;
        case 'ss': r = lnxSs(T, args); break;
        case 'man': r = args[0] ? T.hint(`(ระบบจำลองไม่มีคู่มือ man — ลองพิมพ์ ${args[0]} --help หรือ help)`) : ['What manual page do you want?', 'For example, try \'man man\'.']; break;
        case 'hostname': {
          if (args[0] === '-I') { const c = T.net.config(T.hostId) || {}; r = [c.ip && c.linked && c.up !== false ? c.ip + ' ' : '']; }
          else r = [T.hostname()];
          break;
        }
        case 'whoami': r = [T.sudo ? 'root' : T.user]; break;
        case 'pwd': r = [T.user === 'root' ? '/root' : '/home/' + T.user]; break;
        case 'ls': case 'cd': r = []; break;
        case 'echo': r = [args.join(' ')]; break;
        case 'help': r = LNX_HELP.map(t => ({ t, cls: 'nls-terminal-hint' })); break;
        case 'exit': case 'logout': r = T.hint('(ระบบจำลอง: ไม่สามารถออกจากระบบได้)'); break;
        case 'clear': out.textContent = ''; r = []; break;
        default: {
          if (NOT_INSTALLED[cmd]) r = [`Command '${cmd}' not found, but can be installed with:`, '', `${T.root() ? '' : 'sudo '}apt install ${NOT_INSTALLED[cmd]}`, ''];
          else r = [`${cmd}: command not found`];
          if (LNX_CONFUSE[cmd]) r.push(...T.hint('(คำใบ้: ' + LNX_CONFUSE[cmd] + ')'));
        }
      }
      T.sudo = false;
      return pre.concat(r);
    }
    async function run(cmdLine) {
      if (T.destroyed) return;
      if (T.busy) return;
      cmdLine = String(cmdLine == null ? '' : cmdLine).replace(/[\r\n]+/g, ' ').slice(0, 300);
      input.value = '';
      echo(cmdLine);
      const trimmed = cmdLine.trim();
      if (!trimmed) { if (T.os === 'windows') { /* real cmd just reprints the prompt */ } screen.scrollTop = screen.scrollHeight; return; }
      if (T.history[T.history.length - 1] !== trimmed) T.history.push(trimmed);
      if (T.history.length > 200) T.history.shift();
      T.hIdx = -1; T.draft = '';
      saveHist();
      if (typeof opts.onCommand === 'function') { try { opts.onCommand(trimmed, T.hostId); } catch (e) { /* ignore */ } }
      let items;
      const stages = splitPipe(trimmed);
      try {
        items = T.os === 'windows' ? execWin(stages[0]) : execLinux(stages[0]);
        for (const st of stages.slice(1)) items = pipeFilter(st, items);
      } catch (e) { items = ['(ระบบจำลองเกิดข้อผิดพลาด: ' + (e && e.message) + ')']; }
      const hostAtRun = T.hostId, osAtRun = T.os;
      T.made = [];
      setBusy(true);
      try {
        for (const it of items || []) {
          if (T.destroyed) return;
          const o = typeof it === 'string' ? { t: it } : it;
          if (o.d) { const go = await wait(o.d); if (!go) { line('^C'); break; } }
          line(o.t, o.cls);
        }
        if (T.os === 'windows' && trimmed.toLowerCase() !== 'cls') line('');
      } finally {
        T.cancel = null;
        const made = T.made || []; T.made = null;
        if (!T.destroyed) {
          setBusy(false); quickButtons();
          if (typeof opts.onDone === 'function') { try { opts.onDone(trimmed, hostAtRun, made, osAtRun); } catch (e) { /* ignore */ } }
        }
      }
    }
    // "cmd | findstr x" (Windows) / "cmd | grep x" (Linux): simple line filters on the first command's output
    function splitPipe(line) {
      const parts = []; let cur = '', q = null;
      for (const ch of line) {
        if (q) { if (ch === q) q = null; cur += ch; continue; }
        if (ch === '"' || ch === "'") { q = ch; cur += ch; continue; }
        if (ch === '|') { parts.push(cur.trim()); cur = ''; continue; }
        cur += ch;
      }
      parts.push(cur.trim());
      return parts;
    }
    function pipeFilter(stage, items) {
      const tok = tokenize(stage);
      const cmd = T.os === 'windows' ? (tok[0] || '').toLowerCase().replace(/\.exe$/, '') : (tok[0] || '');
      let words = [], ci = false, inv = false;
      if (T.os === 'windows' && (cmd === 'findstr' || cmd === 'find')) {
        tok.slice(1).forEach(x => {
          if (/^\/i$/i.test(x)) ci = true; else if (/^\/v$/i.test(x)) inv = true;
          else if (/^\/c:/i.test(x)) words.push(x.slice(3).replace(/^"|"$/g, ''));
          else if (/^\//.test(x)) { /* other switches ignored */ } else if (cmd === 'find') words.push(x); else words.push(...x.split(/\s+/));
        });
        if (!words.length) return [cmd === 'find' ? 'FIND: Parameter format not correct' : 'FINDSTR: Bad command line'];
      } else if (T.os === 'linux' && cmd === 'grep') {
        tok.slice(1).forEach(x => { if (x === '-i') ci = true; else if (x === '-v') inv = true; else if (/^-/.test(x)) { /* ignored */ } else if (!words.length) words.push(x); });
        if (!words.length) return ['Usage: grep [OPTION]... PATTERNS [FILE]...', "Try 'grep --help' for more information."];
      } else if (T.os === 'windows') {
        return [`'${tok[0] || ''}' is not recognized as an internal or external command,`, 'operable program or batch file.'];
      } else return [`${tok[0] || ''}: command not found`];
      const has = t => words.some(w => ci ? t.toLowerCase().includes(w.toLowerCase()) : t.includes(w));
      return (items || []).filter(it => { const o = typeof it === 'string' ? { t: it } : it; if (o.cls) return true; return has(o.t) !== inv; });
    }
    function histMove(dir) {
      if (!T.history.length) return;
      if (T.hIdx === -1) { if (dir > 0) return; T.draft = input.value; T.hIdx = T.history.length - 1; }
      else T.hIdx += dir;
      if (T.hIdx < 0) T.hIdx = 0;
      if (T.hIdx >= T.history.length) { T.hIdx = -1; input.value = T.draft; return; }
      input.value = T.history[T.hIdx];
      requestAnimationFrame(() => { try { input.setSelectionRange(input.value.length, input.value.length); } catch (e) { /* ignore */ } });
    }
    function complete() {
      const v = input.value;
      const parts = v.split(/\s+/);
      const cmds = T.os === 'windows' ? WIN_CMDS : LNX_CMDS;
      let pool, cur, base;
      if (parts.length <= 1) { cur = parts[0] || ''; pool = cmds; base = ''; }
      else {
        const c0 = (parts[0] === 'sudo' ? parts[1] : parts[0] || '').toLowerCase();
        if (parts[0] === 'sudo' && parts.length === 2) { cur = parts[1]; pool = cmds; base = 'sudo '; }
        else { cur = parts[parts.length - 1]; pool = OPTS[c0] || []; base = v.slice(0, v.length - cur.length); }
      }
      if (!cur && parts.length <= 1) return;
      const m = pool.filter(x => x.toLowerCase().startsWith(cur.toLowerCase()));
      if (!m.length) return;
      if (m.length === 1) { input.value = base + m[0] + ' '; return; }
      let pre = m[0];
      m.forEach(x => { while (!x.toLowerCase().startsWith(pre.toLowerCase())) pre = pre.slice(0, -1); });
      if (pre.length > cur.length) input.value = base + pre;
      else { echo(v); line(m.join('  ')); }
    }
    const onKey = e => {
      if (e.key === 'Enter') { e.preventDefault(); run(input.value); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); histMove(-1); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); histMove(1); }
      else if (e.key === 'Tab') { if (input.value.trim()) { e.preventDefault(); complete(); } }
      else if ((e.key === 'l' || e.key === 'L') && e.ctrlKey && T.os === 'linux') { e.preventDefault(); out.textContent = ''; }
      else if ((e.key === 'c' || e.key === 'C') && e.ctrlKey && !window.getSelection().toString()) { e.preventDefault(); echo(input.value + '^C'); input.value = ''; }
    };
    const onDocKey = e => { if (T.busy && e.ctrlKey && (e.key === 'c' || e.key === 'C') && T.cancel && el.contains(document.activeElement || el)) { e.preventDefault(); T.cancel(); } };
    const onScreenClick = () => { const sel = window.getSelection && window.getSelection(); if (sel && sel.toString()) return; if (!T.busy) input.focus({ preventScroll: true }); };
    // ---- copy output (Clipboard API with a hidden-textarea fallback)
    function outputText() {
      return Array.from(out.childNodes).filter(n => !(n.dataset && n.dataset.note)).map(n => n.textContent).join('\n').replace(/\s+$/, '') + '\n';
    }
    function legacyCopy(text) {
      const ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', ''); ta.setAttribute('aria-hidden', 'true');
      ta.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none;font-size:16px';
      document.body.appendChild(ta);
      const prev = document.activeElement;
      ta.select(); try { ta.setSelectionRange(0, text.length); } catch (e) { /* ignore */ }
      let ok = false; try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      ta.remove();
      if (prev && prev !== document.body && typeof prev.focus === 'function') { try { prev.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
      return ok;
    }
    let copyTimer = null;
    function copyFeedback(ok) {
      copyLbl.textContent = ok ? 'คัดลอกแล้ว' : 'คัดลอกไม่ได้';
      bCopy.classList.toggle('nls-terminal-copied', ok);
      live.textContent = ok ? 'คัดลอกผลลัพธ์แล้ว' : 'คัดลอกไม่ได้ ลองเลือกข้อความแล้วคัดลอกเอง';
      if (copyTimer) { clearTimeout(copyTimer); T.timers.delete(copyTimer); }
      copyTimer = setTimeout(() => { T.timers.delete(copyTimer); copyTimer = null; if (T.destroyed) return; copyLbl.textContent = 'คัดลอกผลลัพธ์'; bCopy.classList.remove('nls-terminal-copied'); }, 1800);
      T.timers.add(copyTimer);
    }
    async function copyOutput() {
      const text = outputText();
      let ok = false;
      try { if (navigator.clipboard && window.isSecureContext !== false && typeof navigator.clipboard.writeText === 'function') { await navigator.clipboard.writeText(text); ok = true; } } catch (e) { ok = false; }
      if (!ok) ok = legacyCopy(text);
      if (!T.destroyed) copyFeedback(ok);
      return ok;
    }
    // tool buttons: keep the focus where it is (so the phone keyboard does not close/open on every tap)
    const keepFocus = e => { if (e.button === 0 || e.pointerType === 'touch') e.preventDefault(); };
    [bUp, bDown, bRun].forEach(b => b.addEventListener('mousedown', keepFocus));
    const onUp = () => { histMove(-1); if (!coarse()) input.focus(); };
    const onDown = () => { histMove(1); if (!coarse()) input.focus(); };
    const onRun = () => { if (!T.busy) run(input.value); };
    bUp.addEventListener('click', onUp);
    bDown.addEventListener('click', onDown);
    bRun.addEventListener('click', onRun);
    bCopy.addEventListener('click', copyOutput);
    // ---- on-screen keyboard: follow the visual viewport and keep the input line visible
    const vv = window.visualViewport || null;
    let focusTimer = null;
    const setVvh = () => { if (vv) el.style.setProperty('--vvh', Math.round(vv.height) + 'px'); };
    const keepInputVisible = () => {
      if (T.destroyed || document.activeElement !== input) return;
      screen.scrollTop = screen.scrollHeight;
      const r = input.getBoundingClientRect();
      const top = vv ? vv.offsetTop : 0, h = vv ? vv.height : window.innerHeight;
      if (r.bottom > top + h - 8 || r.top < top + 8) { try { input.scrollIntoView({ block: 'center', inline: 'nearest' }); } catch (e) { input.scrollIntoView(); } }
    };
    const onVv = () => { setVvh(); keepInputVisible(); };
    const onFocus = () => {
      if (!coarse()) return;
      if (focusTimer) { clearTimeout(focusTimer); T.timers.delete(focusTimer); }
      focusTimer = setTimeout(() => { T.timers.delete(focusTimer); focusTimer = null; setVvh(); keepInputVisible(); }, 300);
      T.timers.add(focusTimer);
    };
    if (vv) { vv.addEventListener('resize', onVv); vv.addEventListener('scroll', onVv); setVvh(); }
    input.addEventListener('focus', onFocus);
    input.addEventListener('keydown', onKey);
    el.addEventListener('keydown', onDocKey);
    screen.addEventListener('click', onScreenClick);
    el.tabIndex = -1;

    function applyHost(hostId, os, user, fresh) {
      T.hostId = hostId;
      if (HKEY) { T.history = loadHist(hostId); T.hIdx = -1; T.draft = ''; }
      const c = T.net && T.net.config(hostId);
      T.os = os === 'linux' || os === 'windows' ? os : (c && c.os === 'linux' ? 'linux' : 'windows');
      if (user) T.user = user; else if (!T.user) T.user = 'student';
      el.classList.toggle('nls-terminal-win', T.os === 'windows');
      el.classList.toggle('nls-terminal-linux', T.os === 'linux');
      out.textContent = '';
      const saved = !fresh && T.saved.get(hostId + '|' + T.user);
      if (saved) { out.appendChild(saved.frag); title.textContent = saved.title; }
      else banner();
      renderPrompt(promptEl);
      quickButtons();
      screen.scrollTop = screen.scrollHeight;
    }
    const api = {
      el,
      run(cmd) { return run(cmd); },
      focus() { try { input.focus({ preventScroll: true }); } catch (e) { input.focus(); } },
      clear() { out.textContent = ''; },
      getNet() { return T.net; },
      setNet(net, o) {
        T.net = net;
        if (o && o.reset) { T.saved.clear(); applyHost(T.hostId, T.os, T.user, true); }
        else { renderPrompt(promptEl); quickButtons(); }
      },
      setHost(hostId, os, user) {
        if (T.busy && T.cancel) T.cancel();
        const frag = document.createDocumentFragment();
        while (out.firstChild) frag.appendChild(out.firstChild);
        T.saved.set(T.hostId + '|' + T.user, { frag, title: title.textContent });
        applyHost(hostId, os, user || T.user, false);
      },
      setNetstat(ns) { T.netstat = ns || null; },
      getHost() { return { id: T.hostId, os: T.os, user: T.user }; },
      fill(cmd, focus) {
        input.value = String(cmd || '');
        if (focus !== false) { try { input.focus({ preventScroll: true }); } catch (e) { input.focus(); } try { input.setSelectionRange(input.value.length, input.value.length); } catch (e) { /* ignore */ } }
      },
      // explanation block inside the output (guided mode); not included in "copy output"
      note(text, title) {
        const d = document.createElement('div'); d.className = 'nls-terminal-note'; d.dataset.note = '1';
        if (title) { const b = document.createElement('b'); b.textContent = title + ' '; d.appendChild(b); }
        d.appendChild(document.createTextNode(text));
        out.appendChild(d); screen.scrollTop = screen.scrollHeight;
        return d;
      },
      copy() { return copyOutput(); },
      getText() { return outputText(); },
      getHistory() { return T.history.slice(); },
      destroy() {
        T.destroyed = true;
        T.timers.forEach(id => clearTimeout(id)); T.timers.clear();
        input.removeEventListener('keydown', onKey);
        input.removeEventListener('focus', onFocus);
        el.removeEventListener('keydown', onDocKey);
        screen.removeEventListener('click', onScreenClick);
        bUp.removeEventListener('click', onUp); bDown.removeEventListener('click', onDown);
        bRun.removeEventListener('click', onRun); bCopy.removeEventListener('click', copyOutput);
        if (vv) { vv.removeEventListener('resize', onVv); vv.removeEventListener('scroll', onVv); }
        el.remove();
      }
    };
    applyHost(T.hostId, opts.os, opts.user, true);
    return api;
  }
  window.NL_TERM = { create: createTerminal, version: '1.2.0', explain: (os, cmd, text) => explainOutput(os, cmd, text) };

  // ------------------------------------------------------------------ simulator (missions UI)
  const DRAFT_KEY = 'nl-sim-terminal-draft';
  // phone keyboard per answer type: dotted values -> decimal keypad (has "."), counts/ports -> digits
  const QMODE = { ip: 'decimal', mask: 'decimal', num: 'numeric', port: 'numeric' };
  const LV = { easy: 'ง่าย', medium: 'ปานกลาง', hard: 'ยาก' };
  const L2 = (id, a, ap, b, bp, x) => Object.assign({ id, a: { dev: a, port: ap }, b: { dev: b, port: bp }, medium: 'utp', up: true }, x || {});
  const FREE = {
    id: '__free', title: 'ฝึกอิสระ', level: 'easy', desc: 'ทดลองพิมพ์คำสั่งได้อย่างอิสระ (ไม่มีคะแนน)',
    hints: ['ลอง ipconfig /all, ping 192.168.1.1, tracert 8.8.8.8, nslookup srv.lab.local บน PC-01', 'สลับไป srv-lab (Linux) แล้วลอง ip a, ip route, dig +short www.netlab.test'],
    start: {
      story: 'ห้องปฏิบัติการจำลองสำหรับฝึกคำสั่ง: PC-01 (Windows, Static), NB-02 (Windows notebook, Wi-Fi + DHCP), srv-lab (Ubuntu, DNS server), เครื่องพิมพ์ และ Router ที่ต่ออินเทอร์เน็ต',
      hosts: [{ id: 'pc1', os: 'windows', user: 'student' }, { id: 'nb2', os: 'windows', user: 'student' }, { id: 'srv', os: 'linux', user: 'student' }],
      questions: [],
      topo: {
        devices: [
          { id: 'pc1', type: 'pc', name: 'PC-01', x: 80, y: 330, ifaces: [{ name: 'eth0', ip: '192.168.1.21', prefix: 24, mac: '3C-52-82-01-00-21' }], gateway: '192.168.1.1', dns: ['192.168.1.5'] },
          { id: 'nb2', type: 'laptop', name: 'NB-02', x: 120, y: 120, ifaces: [{ name: 'wlan0', mac: 'F4-8C-50-01-00-02' }], dhcp: true, ssid: 'NETLAB' },
          { id: 'ap1', type: 'ap', name: 'AP-LAB', x: 250, y: 120, ssid: 'NETLAB' },
          { id: 'srv', type: 'server', name: 'srv-lab', os: 'linux', x: 300, y: 340, ifaces: [{ name: 'eth0', ip: '192.168.1.5', prefix: 24, mac: '52-54-00-01-00-05' }], gateway: '192.168.1.1', dns: ['8.8.8.8'],
            services: { dns: { records: { 'srv.lab.local': '192.168.1.5', 'dns.lab.local': '192.168.1.5', 'printer.lab.local': '192.168.1.50' } }, web: true } },
          { id: 'prn', type: 'printer', name: 'PRN-01', x: 420, y: 340, ifaces: [{ name: 'eth0', ip: '192.168.1.50', prefix: 24 }], gateway: '192.168.1.1' },
          { id: 'sw1', type: 'switch', name: 'SW-LAB', x: 260, y: 230 },
          { id: 'r1', type: 'router', name: 'R-LAB', x: 460, y: 200, ifaces: [{ name: 'g0/0', ip: '192.168.1.1', prefix: 24 }, { name: 'g0/1', ip: '203.0.113.2', prefix: 30 }],
            routes: [{ net: '0.0.0.0', prefix: 0, via: '203.0.113.1' }],
            services: { dhcp: { start: '192.168.1.100', end: '192.168.1.150', prefix: 24, gateway: '192.168.1.1', dns: ['192.168.1.5'] } } },
          { id: 'net', type: 'internet', name: 'Internet', x: 630, y: 200, ifaces: [{ name: 'wan', ip: '203.0.113.1', prefix: 30 }],
            hosts: { '8.8.8.8': 'dns.google', '1.1.1.1': 'one.one.one.one', '203.0.113.80': 'www.netlab.test' } }
        ],
        links: [L2('l1', 'pc1', 'eth0', 'sw1', 'p1'), L2('l2', 'nb2', 'wlan0', 'ap1', 'wifi', { medium: 'wifi' }), L2('l3', 'ap1', 'p1', 'sw1', 'p2'),
          L2('l4', 'srv', 'eth0', 'sw1', 'p3'), L2('l5', 'prn', 'eth0', 'sw1', 'p4'), L2('l6', 'r1', 'g0/0', 'sw1', 'p24'), L2('l7', 'r1', 'g0/1', 'net', 'wan', { medium: 'fiber' })]
      }
    }
  };

  const coarse = () => { try { return !!(window.matchMedia && window.matchMedia('(pointer:coarse)').matches); } catch (e) { return false; } };
  function mount(root, ctx) {
    injectCss();
    ctx = ctx || {};
    const missions = Array.isArray(ctx.missions) ? ctx.missions.filter(m => m && m.start && m.start.topo) : [];
    const done = Object.assign({}, ctx.done || {});
    // 3.3 embedded mode (practical page): only the given mission, no mission list, no free practice
    const EMB = !!ctx.embedded && missions.length > 0;
    const EMB_M = EMB ? (missions.find(m => m.id === ctx.initial) || missions[0]) : null;
    // cmds: command strings (bonus); log: [{h, c}] in order, replayed by the server for evidence ('#reset' = network reset)
    const S = { mission: null, hostIdx: 0, term: null, net: null, cmds: {}, log: {}, steps: {}, mode: {}, confirm: false };
    let draft = {};
    try { draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch (e) { draft = {}; }
    const saveDraft = () => { try { localStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); } catch (e) { /* ignore */ } };
    const MAX_LOG = 300;

    const wrap = document.createElement('div');
    wrap.className = 'nls-terminal' + (EMB ? ' nls-embedded' : '');
    wrap.innerHTML = `
<h2>จำลองการใช้คำสั่งเครือข่าย (Terminal)</h2>
<p class="nls-terminal-muted">นั่งที่เครื่องในสถานการณ์จำลอง พิมพ์คำสั่งจริงของ Windows / Linux เพื่อตรวจสอบเครือข่าย แล้วตอบคำถาม</p>
<details class="nls-terminal-card nls-terminal-howto"><summary>คำแนะนำการใช้งาน</summary><ol>
<li>${EMB ? 'อ่านสถานการณ์ของภารกิจนี้' : 'เลือกภารกิจ (หรือ "ฝึกอิสระ") อ่านสถานการณ์'} และดูว่าคุณนั่งที่เครื่องใด (บางภารกิจสลับเครื่องได้)</li>
<li>เลือกโหมด: <b>โหมดแนะนำ (Guided)</b> บอกขั้นตอน คำสั่งที่ควรพิมพ์ เหตุผล และอธิบายผลลัพธ์พร้อมไฮไลต์บรรทัดสำคัญ ได้คะแนนสูงสุด 7/10 — <b>โหมดท้าทาย (Challenge)</b> เห็นเฉพาะเป้าหมาย ต้องเลือกคำสั่งเอง ได้คะแนนเต็ม 10/10</li>
<li>คลิกในหน้าจอ terminal แล้วพิมพ์คำสั่ง กด Enter — พิมพ์ <b>help</b> เพื่อดูคำสั่งที่ใช้ได้ ปุ่ม ↑/↓ เรียกคำสั่งเก่า ปุ่ม Tab เติมชื่อคำสั่ง ใส่ /? หรือ --help หลังคำสั่งเพื่อดูวิธีใช้</li>
<li>บนมือถือใช้ปุ่มคำสั่งด่วนใต้ terminal ได้ ผลลัพธ์ทั้งหมดคำนวณจากเครือข่ายจำลองจริง (ไม่ได้เขียนตายตัว)</li>
<li>กรอกคำตอบ แล้วกด <b>ส่งคำตอบ</b> เซิร์ฟเวอร์ตรวจจากคำตอบและคำสั่งที่คุณรันจริง (ภารกิจ 9 ขึ้นไป: ต้องรันคำสั่งที่แสดงข้อมูลนั้นจริง จึงได้คะแนนเต็มข้อ) ระบบเก็บคะแนนดีที่สุดไว้เสมอ</li>
</ol></details>
${EMB ? '' : '<div class="nls-terminal-missions" role="list"></div>'}
<div class="nls-terminal-main"></div>`;
    root.appendChild(wrap);
    const mlist = wrap.querySelector('.nls-terminal-missions');
    const main = wrap.querySelector('.nls-terminal-main');

    function statusText(m) {
      if (m.id === FREE.id) return 'ไม่มีคะแนน';
      const d = done[m.id];
      return d && typeof d.best === 'number' ? `<span class="nls-terminal-best">คะแนนดีที่สุด ${d.best}/${d.max || m.max || 10}</span>` : 'ยังไม่ทำ';
    }
    function renderList() {
      if (!mlist) return;   // embedded: no mission list
      mlist.innerHTML = '';
      missions.concat([FREE]).forEach((m, i) => {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'nls-terminal-mbtn' + (S.mission && S.mission.id === m.id ? ' nls-terminal-on' : '');
        b.setAttribute('role', 'listitem');
        b.innerHTML = `<span class="nls-terminal-lvl">${m.id === FREE.id ? 'FREE' : esc((i + 1) + ' · ' + (LV[m.level] || m.level || ''))}</span><b>${esc(m.title)}</b><span>${statusText(m)}</span>`;
        b.addEventListener('click', () => openMission(m));
        mlist.appendChild(b);
      });
    }
    function destroyTerm() { if (S.term) { S.term.destroy(); S.term = null; } }
    const modeOf = m => m.id === FREE.id ? 'free' : (S.mode[m.id] || (draft[m.id] && draft[m.id].mode) || 'challenge');   // default = challenge: same scoring as before 2.6; guided help is opt-in (max 7/10)
    function setMode(m, mode) { S.mode[m.id] = mode; draft[m.id] = draft[m.id] || { answers: {} }; draft[m.id].mode = mode; saveDraft(); }
    const logOf = m => (S.log[m.id] = S.log[m.id] || []);
    const toRe = (src, fl) => { if (!src) return null; try { return new RegExp(src, fl || 'i'); } catch (e) { return null; } };

    function openMission(m) {
      if (EMB && m !== EMB_M) return;   // embedded: never leave the given mission
      destroyTerm();
      S.mission = m; S.hostIdx = 0; S.confirm = false;
      S.net = window.NetSim.create(m.start.topo);
      S.cmds[m.id] = S.cmds[m.id] || [];
      const log = logOf(m);
      if (log.length && !(log[log.length - 1].h === '*')) log.push({ h: '*', c: '#reset' }); // the network starts fresh again
      S.steps[m.id] = new Set();
      renderList();
      const st = m.start, hosts = st.hosts && st.hosts.length ? st.hosts : [{ id: st.topo.devices[0].id }];
      const qs = Array.isArray(st.questions) ? st.questions : [];
      const steps = Array.isArray(st.steps) ? st.steps : [];
      const tasks = Array.isArray(st.tasks) ? st.tasks : [];
      const facts = Array.isArray(st.facts) ? st.facts : [];
      const isFree = m.id === FREE.id;
      const a = (draft[m.id] && draft[m.id].answers) || {};
      const hostName = id => ((st.topo.devices.find(x => x.id === id) || {}).name || id);
      main.innerHTML = `
<section class="nls-terminal-card">
  <span class="nls-terminal-lvl">${esc(LV[m.level] || '')}</span>
  <h3>${esc(m.title)}</h3>
  <p>${esc(st.story || m.desc || '')}</p>
  ${facts.length ? `<div class="nls-terminal-facts"><b class="nls-terminal-facth">${esc(st.factsTitle || 'ทะเบียนอุปกรณ์ (MAC address)')}</b>${facts.map(f => `<span>${esc(f[0])}</span><code>${esc(f[1])}</code>`).join('')}</div>` : ''}
  <details class="nls-terminal-map"><summary>ดูแผนผังเครือข่าย</summary><div class="nls-terminal-mapbox"></div></details>
</section>
${isFree ? '' : `<section class="nls-terminal-card nls-terminal-modecard">
  <div class="nls-terminal-modes" role="radiogroup" aria-label="เลือกโหมดการทำภารกิจ">
    <button type="button" role="radio" class="nls-terminal-mode" data-mode="guided"><b>โหมดแนะนำ (Guided)</b><span>${steps.some(x => x.self) ? 'มีขั้นตอนและคำอธิบายผลลัพธ์ (ขั้นที่ใช้แก้ไขต้องเลือกคำสั่งเอง)' : 'มีขั้นตอน คำสั่ง และคำอธิบายผลลัพธ์'} · คะแนนสูงสุด 7/10</span></button>
    <button type="button" role="radio" class="nls-terminal-mode" data-mode="challenge"><b>โหมดท้าทาย (Challenge)</b><span>เห็นเฉพาะเป้าหมาย เลือกคำสั่งเอง · คะแนนเต็ม 10/10</span></button>
  </div>
  <div class="nls-terminal-confirm" role="alert" hidden><p>เปลี่ยนเป็นโหมดท้าทายจะเริ่มภารกิจใหม่: ล้างคำตอบ ประวัติคำสั่งที่บันทึก และรีเซ็ตเครือข่าย</p>
    <div class="nls-terminal-row"><button type="button" class="nls-terminal-btn nls-terminal-cyes">เริ่มใหม่ในโหมดท้าทาย</button><button type="button" class="nls-terminal-btn nls-terminal-ghost nls-terminal-cno">ยกเลิก</button></div></div>
  <p class="nls-terminal-goal"><b>เป้าหมาย:</b> ${esc(m.desc || '')}</p>
</section>`}
<div class="nls-terminal-layout">
  <section class="nls-terminal-card nls-terminal-tcard">
    <div class="nls-terminal-row" style="justify-content:space-between;margin-bottom:6px"><h3 style="margin:0">เครื่องที่คุณนั่ง</h3>
      <button type="button" class="nls-terminal-btn nls-terminal-ghost nls-terminal-reset">เริ่มใหม่ (รีเซ็ตเครือข่าย)</button></div>
    <div class="nls-terminal-hosts" role="group" aria-label="เลือกเครื่อง"></div>
    <div class="nls-terminal-next" aria-live="polite" hidden></div>
    <div class="nls-terminal-termbox"></div>
  </section>
  <section class="nls-terminal-card nls-terminal-qcard">
    ${steps.length ? `<div class="nls-terminal-stepcard" hidden><h3>ขั้นตอน (โหมดแนะนำ)</h3><ol class="nls-terminal-steps"></ol></div>` : ''}
    ${tasks.length ? `<h3>งานปฏิบัติ</h3><ul class="nls-terminal-tasks">${tasks.map(t => `<li data-task="${esc(t.id)}"><span class="nls-terminal-tstat">ยังไม่ตรวจ</span> ${esc(t.label)}</li>`).join('')}</ul>` : ''}
    ${isFree || qs.length ? `<h3>${isFree ? 'โหมดฝึกอิสระ' : 'คำถาม'}</h3>` : '<p class="nls-terminal-muted">ภารกิจนี้ไม่มีคำถามให้พิมพ์ตอบ ระบบตรวจจากสถานะของเครื่องหลังคำสั่งที่คุณรันจริง ทำงานให้ครบแล้วกด <b>ตรวจงาน</b></p>'}
    ${isFree ? '<p class="nls-terminal-muted">ไม่มีคำถามและไม่มีคะแนน ลองคำสั่งต่าง ๆ ได้ตามสบาย ระบบจะอธิบายผลลัพธ์ของแต่ละคำสั่งให้</p>' : !qs.length ? '' : `<ol class="nls-terminal-qs">${qs.map((q, i) => `<li><label for="nls-terminal-q-${esc(q.id)}"><b>${i + 1}.</b>${esc(q.q)}</label><input class="nls-terminal-q" id="nls-terminal-q-${esc(q.id)}" data-q="${esc(q.id)}" type="text" autocomplete="off" spellcheck="false" autocapitalize="off" autocorrect="off"${QMODE[q.type] ? ` inputmode="${QMODE[q.type]}"` : ''} enterkeyhint="${i < qs.length - 1 ? 'next' : 'send'}" value="${esc(a[q.id] || '')}"></li>`).join('')}</ol>`}
    <div class="nls-terminal-row"><button type="button" class="nls-terminal-btn nls-terminal-ghost nls-terminal-hintbtn" aria-expanded="false">คำใบ้</button>
    ${isFree ? '' : '<button type="button" class="nls-terminal-btn nls-terminal-submit">ส่งคำตอบ</button>'}</div>
    <ul class="nls-terminal-hints" hidden>${(m.hints || []).map(h => `<li>${esc(h)}</li>`).join('')}</ul>
    <p class="nls-terminal-cmds" aria-live="polite"></p>
    <div class="nls-terminal-msg" role="status"></div>
    <div class="nls-terminal-result" aria-live="polite"></div>
  </section>
</div>`;
      const $ = s => main.querySelector(s);
      const mapDet = $('.nls-terminal-map');
      mapDet.addEventListener('toggle', () => { if (mapDet.open) drawMap(); });
      const hostBox = $('.nls-terminal-hosts');
      function selectHost(i) {
        const h = hosts[i]; if (!h) return;
        S.hostIdx = i;
        hostBox.querySelectorAll('button').forEach((x, j) => x.setAttribute('aria-pressed', j === i ? 'true' : 'false'));
        S.term.setHost(h.id, h.os, h.user || 'student');
        if (mapDet.open) drawMap();
      }
      hosts.forEach((h, i) => {
        const b = document.createElement('button'); b.type = 'button'; b.className = 'nls-terminal-btn nls-terminal-ghost';
        b.setAttribute('aria-pressed', i === 0 ? 'true' : 'false');
        b.innerHTML = `${esc(hostName(h.id))}<span class="nls-terminal-os">${h.os === 'linux' ? 'Linux' : 'Windows'}</span>`;
        b.addEventListener('click', () => { selectHost(i); S.term.focus(); });
        hostBox.appendChild(b);
      });
      const h0 = hosts[0];
      S.term = createTerminal($('.nls-terminal-termbox'), {
        net: S.net, hostId: h0.id, os: h0.os, user: h0.user || 'student', netstat: st.netstat || null, historyKey: m.id,
        quick: EMB ? false : undefined,   // 3.6: no quick command buttons in the lesson: students type every command themselves
        // mission quick chips: start.quick = [[cmd, runNow]] or { hostId: [[cmd, runNow]] } (never contains an answer)
        quickList: st.quick ? (hid => (Array.isArray(st.quick) ? st.quick : st.quick[hid]) || null) : null,
        onCommand: (cmd, hostId) => {
          const list = S.cmds[m.id];
          if (list.length < MAX_LOG) list.push(cmd);
          const lg = logOf(m);
          if (lg.length < MAX_LOG) lg.push({ h: hostId, c: cmd });
          showCmds();
        },
        onDone: (cmd, hostId, made, os) => afterCommand(cmd, hostId, made, os),
        onNetChange: n => { S.net = n; }
      });
      function drawMap() {
        const h = hosts[S.hostIdx];
        $('.nls-terminal-mapbox').innerHTML = window.NetSim.render(st.topo, { showIp: isFree, highlight: [h.id], title: 'แผนผังเครือข่าย (วงสีส้ม = เครื่องที่คุณนั่ง)' });
      }
      function showCmds() {
        const list = S.cmds[m.id] || [];
        let t = list.length ? `คำสั่งที่ใช้แล้ว ${list.length} ครั้ง: ` + Array.from(new Set(list)).slice(-8).join(' · ') : '';
        if (logOf(m).length >= MAX_LOG) t += ' (บันทึกคำสั่งครบ 300 แล้ว คำสั่งหลังจากนี้จะไม่ถูกตรวจ)';
        $('.nls-terminal-cmds').textContent = t;
      }
      showCmds();

      // ---------------- guided mode
      const stepDone = S.steps[m.id];
      const nextBox = $('.nls-terminal-next'), stepCard = $('.nls-terminal-stepcard'), stepList = $('.nls-terminal-steps');
      const firstOpen = () => steps.findIndex((x, i) => !stepDone.has(i));
      function fillStep(i) {
        const sp = steps[i]; if (!sp) return;
        if (sp.host) { const hi = hosts.findIndex(h => h.id === sp.host); if (hi >= 0 && hi !== S.hostIdx) selectHost(hi); }
        if (sp.self || typeof sp.cmd !== 'string') { S.term.focus(); return; }   // 6.x: fixing step of an Independent/Troubleshooting lab: no literal command
        S.term.fill(sp.cmd || '', !coarse());
        if (coarse()) { try { $('.nls-terminal-termbox').scrollIntoView({ block: 'nearest' }); } catch (e) { /* ignore */ } }
      }
      function renderSteps() {
        if (!steps.length) return;
        const cur = firstOpen();
        stepList.innerHTML = steps.map((sp, i) => {
          const dn = stepDone.has(i), on = i === cur;
          return `<li class="${dn ? 'nls-terminal-sdone' : ''}${on ? ' nls-terminal-scur' : ''}"${on ? ' aria-current="step"' : ''}>
<div class="nls-terminal-shead"><span class="nls-terminal-sno">${dn ? '✓' : i + 1}</span><b>${esc(sp.say || '')}</b></div>
${sp.host ? `<span class="nls-terminal-muted">เครื่อง: ${esc(hostName(sp.host))}</span>` : ''}
<p class="nls-terminal-why">${esc(sp.why || '')}</p>
${dn && sp.explain ? `<p class="nls-terminal-sexp">${esc(sp.explain)}</p>` : ''}
${sp.self ? '<p class="nls-terminal-muted nls-terminal-self">ขั้นนี้เลือกคำสั่งเอง (ภารกิจฝึกเองและแก้ปัญหาไม่บอกคำสั่งที่ใช้แก้)</p>' : `<button type="button" class="nls-terminal-btn nls-terminal-ghost nls-terminal-sfill" data-i="${i}"><code>${esc((sp.cmd || '').trim())}${sp.fill ? ' …' : ''}</code> ใส่คำสั่ง</button>`}</li>`;
        }).join('');
        stepList.querySelectorAll('.nls-terminal-sfill').forEach(b => b.addEventListener('click', () => fillStep(+b.dataset.i)));
        if (cur < 0) nextBox.innerHTML = qs.length ? `<p><b>ทำครบทุกขั้นตอนแล้ว</b> ตรวจคำตอบในช่องคำถาม แล้วกดส่งคำตอบ</p>` : `<p><b>ทำครบทุกขั้นตอนแล้ว</b> กดตรวจงาน</p>`;
        else {
          const sp = steps[cur];
          nextBox.innerHTML = `<p><b>ขั้นที่ ${cur + 1}/${steps.length}:</b> ${esc(sp.say || '')}${sp.host && sp.host !== hosts[S.hostIdx].id ? ` <span class="nls-terminal-muted">(เครื่อง ${esc(hostName(sp.host))})</span>` : ''}</p>
${sp.self ? '<p class="nls-terminal-muted nls-terminal-self">ขั้นนี้เลือกคำสั่งเอง (ภารกิจฝึกเองและแก้ปัญหาไม่บอกคำสั่งที่ใช้แก้)</p>' : `<button type="button" class="nls-terminal-btn nls-terminal-nfill"><code>${esc((sp.cmd || '').trim())}${sp.fill ? ' …' : ''}</code> ใส่คำสั่ง</button>`}`;
          const nb = nextBox.querySelector('.nls-terminal-nfill'); if (nb) nb.addEventListener('click', () => fillStep(cur));
        }
      }
      function highlight(made, re) {
        if (!re) return;
        made.forEach(d => { if (d.classList && !d.classList.contains('nls-terminal-hint') && !d.classList.contains('nls-terminal-echo') && re.test(d.textContent)) d.classList.add('nls-terminal-mark'); });
      }
      function afterCommand(cmd, hostId, made, os) {
        const mode = modeOf(m);
        if (mode === 'challenge') return;
        if (/^(cls|clear)$/i.test(cmd.trim())) return;
        let idx = -1;
        if (mode === 'guided') {
          idx = steps.findIndex((sp, i) => !stepDone.has(i) && (!sp.host || sp.host === hostId) && (sp.after === undefined || stepDone.has(sp.after)) && (toRe(sp.match) || { test: () => false }).test(cmd));
        }
        const text = made.map(d => d.textContent).join('\n');
        if (idx >= 0) {
          stepDone.add(idx);
          const sp = steps[idx];
          highlight(made, toRe(sp.mark));
          if (sp.explain) S.term.note(sp.explain, `คำอธิบาย (ขั้นที่ ${idx + 1}):`);
          renderSteps();
          return;
        }
        const g = explainOutput(os, cmd, text);
        if (g) { highlight(made, toRe(g.mark, 'im')); S.term.note(g.text, 'คำอธิบาย:'); }
      }

      // ---------------- mode switch
      const submitBtn = $('.nls-terminal-submit');
      function renderMode() {
        if (isFree) return;
        const mode = modeOf(m);
        main.querySelectorAll('.nls-terminal-mode').forEach(b => { const on = b.dataset.mode === mode; b.setAttribute('aria-checked', on ? 'true' : 'false'); b.classList.toggle('nls-terminal-on', on); });
        $('.nls-terminal-confirm').hidden = !S.confirm;
        const g = mode === 'guided';
        nextBox.hidden = !g || !steps.length;
        if (stepCard) stepCard.hidden = !g;
        $('.nls-terminal-goal').hidden = g;
        const verb = qs.length ? 'ส่งคำตอบ' : 'ตรวจงาน';
        if (submitBtn) submitBtn.textContent = g ? verb + ' (โหมดแนะนำ · สูงสุด 7/10)' : verb + ' (โหมดท้าทาย)';
        renderSteps();
      }
      function resetAttempt() {
        S.cmds[m.id] = []; S.log[m.id] = [];
        stepDone.clear();
        draft[m.id] = { answers: {}, mode: modeOf(m) }; saveDraft();
        main.querySelectorAll('.nls-terminal-q').forEach(inp => { inp.value = ''; inp.classList.remove('nls-terminal-right', 'nls-terminal-wrong', 'nls-terminal-part'); });
        S.net = window.NetSim.create(st.topo);
        S.term.setNet(S.net, { reset: true });
        if (S.hostIdx !== 0) selectHost(0);
        $('.nls-terminal-result').innerHTML = '';
        showCmds();
      }
      main.querySelectorAll('.nls-terminal-mode').forEach(b => b.addEventListener('click', () => {
        const want = b.dataset.mode, cur = modeOf(m);
        if (want === cur) { S.confirm = false; renderMode(); return; }
        if (want === 'challenge') {
          const used = logOf(m).some(e => e.h !== '*') || Array.from(main.querySelectorAll('.nls-terminal-q')).some(i => i.value.trim());
          if (used) { S.confirm = true; renderMode(); const y = $('.nls-terminal-cyes'); if (y) y.focus(); return; }
        }
        S.confirm = false; setMode(m, want); renderMode();
        $('.nls-terminal-msg').textContent = want === 'guided' ? 'เปลี่ยนเป็นโหมดแนะนำแล้ว (คะแนนสูงสุด 7/10)' : 'เปลี่ยนเป็นโหมดท้าทายแล้ว';
      }));
      if (!isFree) {
        $('.nls-terminal-cyes').addEventListener('click', () => {
          S.confirm = false; setMode(m, 'challenge'); resetAttempt(); renderMode();
          $('.nls-terminal-msg').textContent = 'เริ่มภารกิจใหม่ในโหมดท้าทายแล้ว';
          S.term.focus();
        });
        $('.nls-terminal-cno').addEventListener('click', () => { S.confirm = false; renderMode(); });
      }
      renderMode();

      $('.nls-terminal-reset').addEventListener('click', () => {
        S.net = window.NetSim.create(st.topo);
        S.term.setNet(S.net, { reset: true });
        const lg = logOf(m);
        if (lg.length && lg[lg.length - 1].h !== '*' && lg.length < MAX_LOG) lg.push({ h: '*', c: '#reset' });
        stepDone.clear(); renderSteps();
        $('.nls-terminal-msg').textContent = 'รีเซ็ตเครือข่ายกลับเป็นค่าเริ่มต้นแล้ว (การแก้ไขที่ทำไว้ต้องทำใหม่)';
      });
      const hb = $('.nls-terminal-hintbtn'), hl = $('.nls-terminal-hints');
      hb.addEventListener('click', () => { hl.hidden = !hl.hidden; hb.setAttribute('aria-expanded', String(!hl.hidden)); });
      main.querySelectorAll('.nls-terminal-q').forEach(inp => {
        inp.addEventListener('input', () => {
          draft[m.id] = draft[m.id] || { answers: {} };
          draft[m.id].answers = draft[m.id].answers || {};
          draft[m.id].answers[inp.dataset.q] = inp.value.slice(0, 120);
          inp.classList.remove('nls-terminal-right', 'nls-terminal-wrong', 'nls-terminal-part');
          saveDraft();
        });
        inp.addEventListener('keydown', e => {
          if (e.key !== 'Enter' || e.isComposing) return;
          e.preventDefault();
          // phones: the keyboard's "next" key moves to the next empty answer; desktop (and the last field) submits as before
          if (coarse()) {
            const all = Array.from(main.querySelectorAll('.nls-terminal-q')); const i = all.indexOf(inp);
            const nx = all.slice(i + 1).find(x => !x.value.trim());
            if (nx) { nx.focus(); return; }
          }
          if (submitBtn) submitBtn.click();
        });
        inp.addEventListener('focus', () => { if (coarse()) setTimeout(() => { if (document.activeElement === inp) inp.scrollIntoView({ block: 'center', inline: 'nearest' }); }, 300); });
      });
      if (submitBtn) submitBtn.addEventListener('click', async () => {
        const answers = {};
        main.querySelectorAll('.nls-terminal-q').forEach(inp => { answers[inp.dataset.q] = inp.value.trim().slice(0, 120); });
        const msg = $('.nls-terminal-msg'), res = $('.nls-terminal-result');
        if (typeof ctx.submit !== 'function') { msg.textContent = 'ระบบส่งงานยังไม่พร้อม'; return; }
        const mode = modeOf(m);
        submitBtn.disabled = true; msg.textContent = qs.length ? 'กำลังตรวจคำตอบ...' : 'กำลังตรวจงาน...';
        try {
          const r = await ctx.submit(m.id, { answers, commandsUsed: (S.cmds[m.id] || []).slice(-MAX_LOG), commandLog: logOf(m).slice(0, MAX_LOG), mode });
          msg.textContent = '';
          const q = (r && r.details && r.details.questions) || {};
          main.querySelectorAll('.nls-terminal-q').forEach(inp => {
            inp.classList.toggle('nls-terminal-right', q[inp.dataset.q] === true);
            inp.classList.toggle('nls-terminal-part', q[inp.dataset.q] === 'partial');
            inp.classList.toggle('nls-terminal-wrong', q[inp.dataset.q] === false);
          });
          const tk = (r && r.details && r.details.tasks) || {};
          main.querySelectorAll('.nls-terminal-tasks li').forEach(li => {
            const v = tk[li.dataset.task]; const s = li.querySelector('.nls-terminal-tstat');
            if (v === undefined) return;
            s.textContent = v ? 'ผ่าน ✓' : 'ยังไม่ผ่าน'; s.className = 'nls-terminal-tstat ' + (v ? 'nls-terminal-ok' : 'nls-terminal-bad');
          });
          const used = (r.details && r.details.mode) || mode;
          res.innerHTML = `<p class="nls-terminal-modebadge" data-mode="${esc(used)}">${used === 'guided' ? 'โหมดแนะนำ (Guided) · คะแนนสูงสุด 7/10' : 'โหมดท้าทาย (Challenge) · คะแนนเต็ม 10/10'}</p>` +
            `<p class="nls-terminal-score ${r.score === r.max ? 'nls-terminal-ok' : ''}">คะแนน ${esc(r.score)}/${esc(r.max)}</p>` +
            (r.saved === false ? '<p class="nls-terminal-muted">(ยังไม่ได้บันทึกคะแนน — เข้าสู่ระบบเพื่อบันทึก)</p>' : '<p class="nls-terminal-muted">ระบบเก็บคะแนนดีที่สุดของภารกิจนี้ไว้</p>') +
            `<ul class="nls-terminal-fb">${(r.feedback || []).map(f => `<li class="${/✓/.test(f) ? 'nls-terminal-ok' : /ครึ่งคะแนน/.test(f) ? 'nls-terminal-warn' : ''}">${esc(f)}</li>`).join('')}</ul>`;
          const prev = done[m.id];
          if (!prev || typeof prev.best !== 'number' || r.score > prev.best) done[m.id] = { best: r.score, max: r.max, attempts: ((prev && prev.attempts) || 0) + 1 };
          renderList();
        } catch (e) {
          msg.textContent = 'ส่งคำตอบไม่สำเร็จ: ' + (e && e.message ? e.message : 'เกิดข้อผิดพลาด');
        } finally { submitBtn.disabled = false; }
      });
    }
    renderList();
    const first = EMB ? EMB_M : missions.find(m => m.id === ctx.initial) || missions[0];   // deep link #/sim/terminal/<id> opens that mission, as if clicked
    if (first) openMission(first); else openMission(FREE);
    return {
      destroy() { destroyTerm(); wrap.remove(); }
    };
  }

  window.NL_SIMS = window.NL_SIMS || {};
  window.NL_SIMS.terminal = { title: 'จำลองการใช้คำสั่งเครือข่าย (Terminal)', mount };
})();

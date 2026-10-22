'use strict';
/* A small local OpenID Connect provider that behaves like Google's endpoints, for automated tests only.
   It really signs id_tokens (RS256), checks client_secret, redirect_uri and the PKCE code_verifier,
   so NetLab's whole sign-in path runs unchanged. Choose who "signs in" next with POST /_next {sub,email,name,email_verified}.
   usage: node tests/fake-google.js 4555     (or require() and call start(port)) */
const http = require('http');
const crypto = require('crypto');
const { URL, URLSearchParams } = require('url');

function start(port, { clientId = 'test-client.apps.googleusercontent.com', clientSecret = 'test-secret' } = {}) {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const kid = 'k' + crypto.randomBytes(4).toString('hex');
  const jwk = { ...publicKey.export({ format: 'jwk' }), kid, alg: 'RS256', use: 'sig' };
  const issuer = `http://127.0.0.1:${port}`;
  const codes = new Map();
  let next = { sub: '100000000000000000001', email: 'student.c@gmail.com', email_verified: true, name: 'นักเรียน ซี', picture: null };
  const log = [];
  const b64u = x => Buffer.from(x).toString('base64url');
  const sign = claims => {
    const h = b64u(JSON.stringify({ alg: 'RS256', kid, typ: 'JWT' })), p = b64u(JSON.stringify(claims));
    return `${h}.${p}.${crypto.sign('RSA-SHA256', Buffer.from(h + '.' + p), privateKey).toString('base64url')}`;
  };
  const srv = http.createServer((req, res) => {
    const u = new URL(req.url, issuer);
    const send = (code, obj, type = 'application/json') => { res.writeHead(code, { 'Content-Type': type }); res.end(typeof obj === 'string' ? obj : JSON.stringify(obj)); };
    if (u.pathname === '/jwks') return send(200, { keys: [jwk] });
    if (u.pathname === '/auth') {
      const q = u.searchParams; log.push({ path: '/auth', q: Object.fromEntries(q) });
      if (q.get('client_id') !== clientId || q.get('response_type') !== 'code' || q.get('code_challenge_method') !== 'S256' || !q.get('nonce') || !q.get('state')) return send(400, 'bad request');
      if (next.cancel) { const r = new URL(q.get('redirect_uri')); r.searchParams.set('error', 'access_denied'); r.searchParams.set('state', q.get('state')); res.writeHead(302, { Location: r.toString() }); return res.end(); }
      const code = crypto.randomBytes(12).toString('hex');
      codes.set(code, { who: { ...next }, challenge: q.get('code_challenge'), nonce: q.get('nonce'), redirect: q.get('redirect_uri') });
      const r = new URL(q.get('redirect_uri')); r.searchParams.set('code', code); r.searchParams.set('state', q.get('state'));
      res.writeHead(302, { Location: r.toString() }); return res.end();
    }
    let body = ''; req.on('data', c => { body += c; }); req.on('end', () => {
      if (u.pathname === '/_next' && req.method === 'POST') { next = Object.assign({ email_verified: true, picture: null }, JSON.parse(body || '{}')); return send(200, { ok: true }); }
      if (u.pathname === '/token' && req.method === 'POST') {
        const f = new URLSearchParams(body); log.push({ path: '/token', grant: f.get('grant_type') });
        const c = codes.get(f.get('code')); codes.delete(f.get('code'));
        if (!c || f.get('client_id') !== clientId || f.get('client_secret') !== clientSecret || f.get('redirect_uri') !== c.redirect) return send(400, { error: 'invalid_grant' });
        if (crypto.createHash('sha256').update(f.get('code_verifier') || '').digest('base64url') !== c.challenge) return send(400, { error: 'invalid_grant', error_description: 'PKCE' });
        const now = Math.floor(Date.now() / 1000);
        const claims = { iss: issuer, aud: clientId, sub: c.who.sub, email: c.who.email, email_verified: c.who.email_verified, name: c.who.name, iat: now, exp: now + 3600, nonce: c.nonce };
        if (c.who.picture) claims.picture = c.who.picture;
        if (c.who.tamper === 'nonce') claims.nonce = 'wrong';
        if (c.who.tamper === 'aud') claims.aud = 'someone-else';
        let idt = sign(claims);
        if (c.who.tamper === 'sig') idt = idt.slice(0, -4) + 'AAAA';
        return send(200, { access_token: 'x', token_type: 'Bearer', expires_in: 3600, id_token: idt });
      }
      send(404, 'not found', 'text/plain');
    });
  });
  return new Promise(r => srv.listen(port, '127.0.0.1', () => r({
    server: srv, issuer, clientId, clientSecret, log,
    env: { GOOGLE_CLIENT_ID: clientId, GOOGLE_CLIENT_SECRET: clientSecret, GOOGLE_AUTH_URL: issuer + '/auth', GOOGLE_TOKEN_URL: issuer + '/token', GOOGLE_JWKS_URL: issuer + '/jwks', GOOGLE_ISSUER: issuer },
    setNext: w => { next = Object.assign({ email_verified: true, picture: null }, w); },
    close: () => new Promise(x => srv.close(x))
  })));
}
module.exports = { start };
if (require.main === module) start(Number(process.argv[2]) || 4555).then(f => console.log('fake google on', f.issuer));

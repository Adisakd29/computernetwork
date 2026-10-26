'use strict';
/* Google sign-in: OAuth 2.0 authorization-code flow + OpenID Connect, done on the server.
   - PKCE (S256), state and nonce kept in a short-lived HMAC-signed HttpOnly cookie
   - the code is exchanged with the client secret on the server (the secret never reaches the browser)
   - the id_token signature is checked against Google's published keys (JWKS), plus iss / aud / exp / nonce
   Settings (Railway → Variables): GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, PUBLIC_URL.
   GOOGLE_*_URL / GOOGLE_ISSUER overrides exist ONLY for automated tests against a local fake provider and are ignored in production. */
const crypto = require('crypto');

const PROD = process.env.NODE_ENV === 'production';
const ov = (k, d) => (!PROD && process.env[k]) || d;
const CFG = () => ({
  id: process.env.GOOGLE_CLIENT_ID || '',
  secret: process.env.GOOGLE_CLIENT_SECRET || '',
  authUrl: ov('GOOGLE_AUTH_URL', 'https://accounts.google.com/o/oauth2/v2/auth'),
  tokenUrl: ov('GOOGLE_TOKEN_URL', 'https://oauth2.googleapis.com/token'),
  jwksUrl: ov('GOOGLE_JWKS_URL', 'https://www.googleapis.com/oauth2/v3/certs'),
  issuers: ov('GOOGLE_ISSUER', '') ? [process.env.GOOGLE_ISSUER] : ['https://accounts.google.com', 'accounts.google.com']
});
const enabled = () => { const c = CFG(); return !!(c.id && c.secret); };

const b64u = b => Buffer.from(b).toString('base64url');
const SECRET = process.env.APP_SECRET || crypto.randomBytes(32).toString('hex');
const sign = s => crypto.createHmac('sha256', SECRET).update(s).digest('base64url');
const STATE_COOKIE = 'nl_oauth';

function packState(obj) { const body = b64u(JSON.stringify(obj)); return body + '.' + sign(body); }
function unpackState(v) {
  if (!v || typeof v !== 'string') return null;
  const [body, mac] = v.split('.');
  if (!body || !mac) return null;
  const a = Buffer.from(sign(body)), b = Buffer.from(mac);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try { const o = JSON.parse(Buffer.from(body, 'base64url').toString()); return o.exp > Date.now() ? o : null; } catch (e) { return null; }
}

/* builds the Google URL and the state cookie value */
function begin({ redirectUri, mode, uid }) {
  const c = CFG();
  const verifier = b64u(crypto.randomBytes(32));
  const st = { state: b64u(crypto.randomBytes(16)), nonce: b64u(crypto.randomBytes(16)), verifier, mode, uid: uid || null, exp: Date.now() + 10 * 60000 };
  const q = new URLSearchParams({
    client_id: c.id, redirect_uri: redirectUri, response_type: 'code', scope: 'openid email profile',
    state: st.state, nonce: st.nonce, code_challenge: b64u(crypto.createHash('sha256').update(verifier).digest()), code_challenge_method: 'S256',
    prompt: 'select_account'
  });
  return { url: `${c.authUrl}?${q}`, cookie: packState(st) };
}

let JWKS = { keys: [], at: 0 };
async function keyFor(kid) {
  const c = CFG();
  const find = () => JWKS.keys.find(k => k.kid === kid);
  if (!find() && Date.now() - JWKS.at > 60000) {
    const r = await fetch(c.jwksUrl); if (!r.ok) throw new Error('jwks ' + r.status);
    JWKS = { keys: (await r.json()).keys || [], at: Date.now() };
  }
  const k = find(); if (!k) throw new Error('unknown signing key');
  return crypto.createPublicKey({ key: k, format: 'jwk' });
}
async function verifyIdToken(idToken, nonce) {
  const c = CFG();
  const parts = String(idToken || '').split('.');
  if (parts.length !== 3) throw new Error('bad id_token');
  const head = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
  if (head.alg !== 'RS256') throw new Error('unexpected alg');
  const ok = crypto.verify('RSA-SHA256', Buffer.from(parts[0] + '.' + parts[1]), await keyFor(head.kid), Buffer.from(parts[2], 'base64url'));
  if (!ok) throw new Error('bad signature');
  const p = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
  const now = Math.floor(Date.now() / 1000);
  if (!c.issuers.includes(p.iss)) throw new Error('bad iss');
  if ((Array.isArray(p.aud) ? !p.aud.includes(c.id) : p.aud !== c.id)) throw new Error('bad aud');
  if (!(p.exp > now - 60) || (p.iat && p.iat > now + 300)) throw new Error('expired');
  if (p.nonce !== nonce) throw new Error('bad nonce');
  if (!p.sub) throw new Error('no sub');
  return p;
}

/* code -> verified claims { sub, email, email_verified, name, picture } */
async function finish({ code, verifier, nonce, redirectUri }) {
  const c = CFG();
  const r = await fetch(c.tokenUrl, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code, client_id: c.id, client_secret: c.secret, redirect_uri: redirectUri, grant_type: 'authorization_code', code_verifier: verifier })
  });
  if (!r.ok) throw new Error('token ' + r.status);
  const tok = await r.json();
  return verifyIdToken(tok.id_token, nonce);
}

module.exports = { enabled, begin, finish, unpackState, STATE_COOKIE, verifyIdToken };

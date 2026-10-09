/* NetLab service worker.
   What is cached (so lessons can be read offline):
     - the app shell: pages, scripts, icons (precached on install, refreshed in the background)
     - public course data that contains NO answers and NO personal data: /api/content (lab questions) and
       /api/lessons, /api/lessons/:id with the pre/post-test items REMOVED before storing
   Never cached: logins, /api/me, scores, practice and exam questions, simulators, teacher pages' data, the VM files.
   The server also sends "Cache-Control: no-store" on every other /api response. */
'use strict';
const VERSION = '__VERSION__';
const SHELL = 'netlab-shell-' + VERSION;
const DATA = 'netlab-data-v1';           // public course data (sanitised); survives app updates
const SHELL_FILES = __FILES__;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(SHELL_FILES)));
});
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('netlab-shell-') && k !== SHELL) await caches.delete(k);
    await self.clients.claim();
  })());
});
self.addEventListener('message', e => {
  if (e.data === 'skipWaiting') self.skipWaiting();
  if (e.data === 'clearData') e.waitUntil(caches.delete(DATA));
});

const PUBLIC_DATA = /^\/api\/(content|lessons|lessons\/w\d+)$/;
const isShell = p => p === '/' || p === '/index.html' || p === '/teacher.html' || p === '/manifest.webmanifest' || /^\/(js|icons)\//.test(p);

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;                                    // answers, logins, submissions: always network
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;                          // fonts etc.: browser default
  if (url.pathname.startsWith('/api/')) {
    if (PUBLIC_DATA.test(url.pathname)) e.respondWith(publicData(req, url));
    return;                                                            // every other API call: network only
  }
  if (url.pathname.startsWith('/v86/') || url.pathname === '/sw.js') return;
  if (req.mode === 'navigate') { e.respondWith(page(req)); return; }
  if (isShell(url.pathname)) e.respondWith(staleWhileRevalidate(req));
});

/* pages: network first (always newest when online), cached shell when offline */
async function page(req) {
  try {
    const res = await fetch(req);
    if (res.ok && !res.headers.get('set-cookie')) (await caches.open(SHELL)).put(new URL(req.url).pathname === '/teacher.html' ? '/teacher.html' : '/index.html', res.clone());
    return res;
  } catch (err) {
    const c = await caches.open(SHELL);
    return (await c.match(new URL(req.url).pathname === '/teacher.html' ? '/teacher.html' : '/index.html')) || Response.error();
  }
}
async function staleWhileRevalidate(req) {
  const c = await caches.open(SHELL);
  const hit = await c.match(req, { ignoreSearch: true });
  const net = fetch(req).then(res => { if (res.ok && res.type === 'basic') c.put(req, res.clone()); return res; }).catch(() => null);
  return hit || (await net) || Response.error();
}
/* public course data: network first; store a copy with quiz items stripped so no test content sits in the cache */
async function publicData(req, url) {
  const c = await caches.open(DATA);
  try {
    const res = await fetch(req);
    if (res.ok) {
      let body = await res.clone().json();
      if (/^\/api\/lessons\/w\d+$/.test(url.pathname)) { delete body.quiz; delete body.quizPost; body.offlineCopy = true; }
      await c.put(url.pathname, new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json', 'X-NetLab-Offline': '1' } }));
    }
    return res;
  } catch (err) {
    const hit = await c.match(url.pathname);
    return hit || new Response(JSON.stringify({ error: 'offline', message: 'ออฟไลน์อยู่ และยังไม่เคยเปิดข้อมูลนี้ขณะออนไลน์' }), { status: 503, headers: { 'Content-Type': 'application/json' } });
  }
}

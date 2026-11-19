/*
 * Maa Collection — offline helper (plan v18).
 *
 * Keeps the counter screen (/pos) and the app's own files on the phone, so a
 * salesman can open the counter and keep selling without internet. The sales
 * themselves wait in the app's storage (IndexedDB) and are sent by the app —
 * nothing here touches money or stock.
 *
 * - App files (/_next/static/…, named by their content): from the phone first.
 * - The counter page: from the internet first; the last copy when there is none.
 * - Other pages: from the internet; a small "No internet" page when there is none.
 * - Everything else (data, actions, photos): straight to the internet, untouched.
 */
const PAGES = 'maa-pages-v1';
const FILES = 'maa-files-v1';
const COUNTER = '/pos';
const MAX_FILES = 800;
/** A slow line: after this, show the saved counter (the fresh one is kept when it arrives). */
const COUNTER_WAIT_MS = 6000;
/** The saved counter is refreshed in the background when older than this. */
const FRESH_MS = 6 * 60 * 60 * 1000;

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([PAGES, FILES]);
      for (const key of await caches.keys()) {
        if (key.startsWith('maa-') && !keep.has(key)) await caches.delete(key);
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(appFile(request));
    return;
  }
  if (request.mode === 'navigate') event.respondWith(page(event, url));
});

self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'keep') event.waitUntil(keep(Array.isArray(data.files) ? data.files : []));
  if (data.type === 'forget') event.waitUntil(caches.delete(PAGES));
});

const fileMatch = { ignoreSearch: true, ignoreVary: true };

async function appFile(request) {
  const cache = await caches.open(FILES);
  const saved = await cache.match(request, fileMatch);
  if (saved) return saved;
  const response = await fetch(request);
  if (response.ok && response.type === 'basic') {
    cache.put(request, response.clone()).then(trimFiles, () => {});
  }
  return response;
}

async function trimFiles() {
  const cache = await caches.open(FILES);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - MAX_FILES; i++) await cache.delete(keys[i]);
}

async function savedCounter() {
  const cache = await caches.open(PAGES);
  return cache.match(COUNTER, { ignoreSearch: true, ignoreVary: true });
}

/** Only the plain counter page of a logged-in person (no redirect, no ?code=). */
function worthSaving(url, response) {
  return url.pathname === COUNTER && !url.search && response.ok && response.type === 'basic' && !response.redirected;
}

async function page(event, url) {
  const network = fetch(event.request);
  if (url.pathname === COUNTER) {
    const saving = network.then(
      (response) => (worthSaving(url, response) ? savePage(response.clone()) : undefined),
      () => undefined,
    );
    event.waitUntil(saving);
    const saved = await savedCounter();
    if (saved) {
      // Internet first, but never leave the salesman waiting on a dead line.
      const timeout = new Promise((resolve) => setTimeout(() => resolve(null), COUNTER_WAIT_MS));
      const fresh = await Promise.race([network.catch(() => null), timeout]);
      return fresh || saved;
    }
  }
  try {
    return await network;
  } catch {
    return offline(url);
  }
}

/** No internet: the saved counter where it makes sense, otherwise a short page. */
async function offline(url) {
  const counter = await savedCounter();
  if (counter) {
    if (url.pathname === COUNTER) return counter;
    // The app opens on /login; a tag's QR code opens /i/<code>: both go to the counter.
    if (url.pathname === '/' || url.pathname === '/login') return Response.redirect(new URL(COUNTER, self.location.origin).href, 302);
    const item = /^\/i\/([^/]+)\/?$/.exec(url.pathname);
    if (item) return Response.redirect(new URL(`${COUNTER}?code=${item[1]}`, self.location.origin).href, 302);
  }
  return new Response(offlineHtml(Boolean(counter)), {
    status: 503,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

/** Keeps a copy of the counter page and every app file it names. */
async function savePage(response) {
  const html = await response.text();
  const headers = new Headers(response.headers);
  for (const name of ['content-encoding', 'content-length', 'vary', 'set-cookie']) headers.delete(name);
  headers.set('x-maa-saved', String(Date.now()));
  const cache = await caches.open(PAGES);
  await cache.put(COUNTER, new Response(html, { status: 200, headers }));
  await saveFiles(filesIn(html));
}

/** App files named in a page: script and style tags, and the chunks listed in its data. */
function filesIn(html) {
  const found = new Set();
  for (const match of html.matchAll(/(?:\/_next\/)?static\/(?:chunks|css|media)\/[^"'\s\\)<>]+/g)) {
    const path = match[0].replace(/&amp;/g, '&');
    found.add(path.startsWith('/_next/') ? path : `/_next/${path}`);
  }
  return [...found];
}

async function saveFiles(files) {
  const cache = await caches.open(FILES);
  await Promise.all(
    files.map(async (file) => {
      try {
        const url = new URL(file, self.location.origin);
        if (url.origin !== self.location.origin || !url.pathname.startsWith('/_next/static/')) return;
        if (await cache.match(url.href, fileMatch)) return;
        const response = await fetch(url.href, { credentials: 'same-origin' });
        if (response.ok) await cache.put(url.href, response);
      } catch {
        // Kept next time.
      }
    }),
  );
  await trimFiles();
}

/** From the app: keep these files, and refresh the saved counter when it is old. */
async function keep(files) {
  await saveFiles(files);
  const saved = await savedCounter();
  const age = saved ? Date.now() - Number(saved.headers.get('x-maa-saved') || 0) : Infinity;
  if (age < FRESH_MS) return;
  try {
    const response = await fetch(COUNTER, { credentials: 'same-origin', redirect: 'manual', cache: 'no-store', headers: { Accept: 'text/html' } });
    if (response.ok && response.type === 'basic') await savePage(response);
  } catch {
    // Offline now: next time.
  }
}

function offlineHtml(hasCounter) {
  const action = hasCounter
    ? '<a href="/pos">Open the counter · काउंटर खोलें</a>'
    : '<p>Open the app once with internet; after that the counter works without it.</p><p lang="hi">एक बार इंटरनेट के साथ ऐप खोलें; उसके बाद काउंटर बिना इंटरनेट भी चलेगा।</p>';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Maa Collection · No internet</title><style>
body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f4f4f7;color:#18181b;font-family:system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:22rem;padding:2rem 1.25rem;text-align:center}h1{margin:.75rem 0 .5rem;font-size:1.5rem}p{margin:.5rem 0;color:#52525b;line-height:1.5}
a{display:inline-block;margin-top:1.25rem;padding:.9rem 1.5rem;border-radius:999px;background:#4c3cce;color:#fff;font-weight:700;text-decoration:none}
@media (prefers-color-scheme:dark){body{background:#0f0f14;color:#f4f4f5}p{color:#a1a1aa}}
</style></head><body><main data-offline-page><svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#4c3cce" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M2 8.8a15 15 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0"/><path d="M12 20h.01"/><path d="M3 3l18 18"/></svg>
<h1>No internet</h1><p>This screen needs internet. The counter works without it: sales wait on this phone and are sent when internet is back.</p>
<p lang="hi">इस स्क्रीन को इंटरनेट चाहिए। काउंटर बिना इंटरनेट चलता है: बिक्री फ़ोन में रहती है और इंटरनेट आने पर भेज दी जाती है।</p>
${action}</main><script>addEventListener('online',function(){location.reload()})</script></body></html>`;
}

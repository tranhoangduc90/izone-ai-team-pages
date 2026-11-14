const BUILD = 'reading-retake-20261114-retake-log-v1';
const PREVIOUS_CACHE = 'reading-retake:reading-retake-20261112-reconciliation';
const COHORT_CACHE = 'reading-retake:reading-retake-20261111-cohort';
const LEGACY_CACHE = 'reading-retake:reading-retake-20261106-v1';
const CACHE = 'reading-retake:' + BUILD;
const BASE = new URL('./', self.location).href;
const REVIEW = new URL('../ic2311-retake-review/?skill=reading', BASE).href;
const BRIDGE = new URL('review-redirect.mjs?v=20261111-cohort', BASE).href;
const BRIDGE_CACHE = 'ic2311-reading-review-bridge-v4';
const VERIFIED = new URL('./.verified-shell', BASE).href;

function savedAttempt() {
  return new Promise(resolve => {
    const request = indexedDB.open('izone-reading-retake-v1', 1);
    request.onupgradeneeded = () => request.transaction.abort();
    request.onerror = request.onblocked = () => resolve(null);
    request.onsuccess = () => {
      const db = request.result;
      try {
        const transaction = db.transaction('records');
        const row = transaction.objectStore('records').get('current');
        row.onsuccess = () => resolve(row.result ?? null);
        row.onerror = () => resolve(null);
        transaction.oncomplete = transaction.onabort = () => db.close();
      } catch {
        db.close();
        resolve(null);
      }
    };
  });
}

function isExamPage(url) {
  return url.origin + url.pathname === BASE || url.origin + url.pathname === BASE + 'index.html';
}

function canOpen(url) {
  return isExamPage(url) && url.searchParams.get('result') !== '0' && self.navigator.onLine !== false;
}

function isConfirmed(state) {
  return state?.phase === 'submitted' && state.serverConfirmed === true && !state.pending &&
    typeof state.receipt === 'string' && state.permit && /^IC\d{4,6}$/.test(state.identity?.classCode ?? '');
}

async function withReviewBridge(page) {
  if (!page.ok || !page.headers.get('Content-Type')?.includes('text/html')) return page;
  const html = await page.clone().text();
  if (html.includes('review-redirect.mjs?v=20261111-cohort')) return page;
  const shell = html.replace(/<script type="module" src="review-redirect\.mjs[^"]*"><\/script>/, '');
  const headers = new Headers(page.headers);
  for (const key of ['Content-Length', 'Content-Encoding', 'ETag', 'Last-Modified']) headers.delete(key);
  headers.set('Cache-Control', 'no-store');
  return new Response(shell.replace('</body>', '<script type="module" src="' + BRIDGE + '"></script></body>'), {
    status: page.status, headers,
  });
}

// Keep the original pinned shell and its verification protocol. The additional
// script is attached to navigation responses, never to the bytes in the exam cache.
self.addEventListener('install', event => event.waitUntil((async () => {
  const cache = await caches.open(BRIDGE_CACHE);
  await cache.add(new Request(BRIDGE, { cache: 'reload' }));
  await self.skipWaiting();
})()));

self.addEventListener('activate', event => event.waitUntil((async () => {
  await self.clients.claim();
  if (!isConfirmed(await savedAttempt())) return;
  const clients = await self.clients.matchAll({ type: 'window' });
  await Promise.allSettled(clients.filter(client => canOpen(new URL(client.url))).map(client => client.navigate(REVIEW)));
})()));

self.addEventListener('message', event => {
  if (event.data?.type === 'VERIFY') event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const ok = event.data.build === BUILD && (await Promise.all(event.data.paths.map(path => cache.match(path)))).every(Boolean);
    if (ok) await cache.put(VERIFIED, new Response('verified'));
    event.ports[0]?.postMessage({ ok, build: BUILD });
  })());
  if (event.data?.type === 'ACTIVATE_WHEN_IDLE') self.skipWaiting();
});

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || !url.href.startsWith(BASE) || url.pathname.includes('/teacher')) return;
  event.respondWith((async () => {
    if (url.href === BRIDGE) {
      const cache = await caches.open(BRIDGE_CACHE);
      return await cache.match(BRIDGE) || fetch(request);
    }
    const navigation = request.mode === 'navigate';
    if (navigation && canOpen(url) && isConfirmed(await savedAttempt())) return Response.redirect(REVIEW, 302);
    if (self.navigator.onLine !== false) {
      try {
        const page = await fetch(request);
        if (page.ok) return navigation && isExamPage(url) ? withReviewBridge(page) : page;
      } catch {
        // Fall back to the latest complete offline shell.
      }
    }
    const cache = await caches.open(CACHE);
    const previous = await caches.open(PREVIOUS_CACHE);
    const cohort = await caches.open(COHORT_CACHE);
    const offlineCache = await cache.match(VERIFIED) ? cache
      : await previous.match(VERIFIED) ? previous
      : await cohort.match(VERIFIED) ? cohort : await caches.open(LEGACY_CACHE);
    const page = await offlineCache.match(navigation ? BASE + 'index.html' : url.href);
    if (!page) return Response.error();
    return navigation && isExamPage(url) ? withReviewBridge(page) : page;
  })());
});

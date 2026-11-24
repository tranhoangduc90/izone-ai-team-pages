import {BUILD, ASSETS} from './offline-assets-confirmed-departure-v1.mjs';

const base = new URL('./', self.location.href);
const url = file => new URL(file, base);
const cacheName = 'term1-k56-paper-departure-' + BUILD;
const entry = 'index-confirmed-departure-v1.html';
const paths = new Set(Object.keys(ASSETS).map(file => url(file).pathname));

self.addEventListener('install', event => event.waitUntil((async () => {
  const cache = await caches.open(cacheName);
  const files = Object.entries(ASSETS);
  for (let i=0; i<files.length; i+=6) {
    await Promise.all(files.slice(i,i+6).map(async ([file, hash]) => {
      const request = url(file);
      request.searchParams.set('examBuild', BUILD);
      const response = await fetch(request, {cache:'reload'});
      if (!response.ok) throw Error('Chưa tải đủ tài nguyên phiếu.');
      const bytes = await response.clone().arrayBuffer();
      const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
      if (Array.from(digest,x=>x.toString(16).padStart(2,'0')).join('') !== hash)
        throw Error('Tài nguyên phiếu chưa khớp bản đã ghim.');
      await cache.put(url(file), response);
    }));
  }
  await self.skipWaiting();
})()));
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', event => {
  const request = event.request, target = new URL(request.url);
  if (request.method !== 'GET' || target.origin !== base.origin) return;
  const navigation = request.mode === 'navigate' &&
    (target.pathname === base.pathname || target.pathname === url('index.html').pathname);
  if (!navigation && !paths.has(target.pathname)) return;
  event.respondWith((async () => {
    const cache = await caches.open(cacheName);
    if (navigation) {
      try {
        const online = await fetch(request, {cache:'no-store',signal:AbortSignal.timeout(3000)});
        if (online.ok) return online;
      } catch {}
      return await cache.match(url(entry)) || Response.error();
    }
    return await cache.match(request, {ignoreSearch:true}) || fetch(request);
  })());
});

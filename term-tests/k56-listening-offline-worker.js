/* Chỉ giữ vỏ trang công khai; không cache API, audio, khóa, token hoặc bài làm. */
'use strict';
const cacheName = 'k56-listening-shell-20261023-master170-v3:' + self.registration.scope;
const shell = new URL(self.registration.scope);
const publicRoot = new URL('../', shell).pathname;
function publicFile(url) {
  const designAsset = ['SourceSans3-Variable.woff2', 'izone-logo-color.png']
    .some(name => url.pathname === publicRoot + 'k56-design/assets/' + name);
  return url.origin === shell.origin && url.pathname.startsWith(publicRoot)
    && (designAsset || ((/\.(?:js|css|html)$/.test(url.pathname) || url.pathname === shell.pathname)
      && !url.pathname.includes('/assets/')));
}
self.addEventListener('install', event => event.waitUntil((async () => {
  const cache = await caches.open(cacheName);
  const response = await fetch(shell.href, { cache: 'reload' });
  if (!response.ok) throw new Error('Chưa lấy được vỏ trang Listening.');
  const html = await response.clone().text();
  await cache.put(shell.href, response);
  const urls = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
    .map(match => new URL(match[1], shell)).filter(publicFile);
  await Promise.all(urls.map(async url => {
    const result = await fetch(url.href, { cache: 'reload' });
    if (!result.ok) throw new Error('Thiếu tài nguyên vỏ trang.');
    await cache.put(url.href, result);
  }));
  await self.skipWaiting();
})()));
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || !publicFile(url)) return;
  const key = event.request.mode === 'navigate' ? shell.href : event.request;
  event.respondWith((async () => {
    const cache = await caches.open(cacheName);
    try {
      const response = await fetch(event.request);
      if (response.ok) await cache.put(key, response.clone());
      return response;
    } catch (error) {
      const cached = await cache.match(key);
      if (cached) return cached;
      throw error;
    }
  })());
});

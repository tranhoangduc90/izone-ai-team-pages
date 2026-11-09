// Retire the old cache-first worker on this scope. Existing caches and exam data are left intact.
self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));

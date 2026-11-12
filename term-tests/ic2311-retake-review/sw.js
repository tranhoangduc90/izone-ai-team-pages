const CACHE = 'ic2311-retake-review-static-20261112-v5';
const index = new URL('index.html', self.location).href;
const paths = [
  'index.html', 'student-review-entry.mjs?v=1', 'review.css?v=20261107-1', 'review.mjs?v=20261112-submission-reconciliation', 'answer-explanations.js?v=20261107-1',
  '../../shared/izone-favicon.svg', '../../recordings/assets/fonts/SourceSansPro-Regular.ttf',
  '../../recordings/assets/fonts/SourceSansPro-Bold.ttf', '../substitute-shared/izone-logo-color.png',
  '../substitute-shared/brand.css?v=20261014-exam-source-v1', '../substitute-k56-shared/styles.css?rev=20261003-writing-save-cas-v1',
  '../substitute-test-1-k56-computer-based/styles.css?v=20261030-reading-heading-scroll',
  '../substitute-test-1-k56-computer-based/layout-updates.css', '../k67-shared/answer-explanations.css?v=20261021-substitute-v1',
  '../k67-shared/review-audio.js?v=20261026-term1-replay1',
  '../ic2311-reading-retake-substitute1-k56/config.mjs', '../ic2311-reading-retake-substitute1-k56/storage.mjs',
  '../ic2311-listening-retake-substitute1-k56/config.mjs', '../ic2311-listening-retake-substitute1-k56/storage.mjs',
  '../ic2311-listening-retake-substitute1-k56/audio.mjs', '../ic2311-listening-retake-substitute1-k56/assets/kinney-hotel-plan.png',
];
const assets = new Set(paths.map(path => new URL(path, self.location).href));

self.addEventListener('install', event => event.waitUntil((async () => {
  const cache = await caches.open(CACHE);
  await cache.addAll([...assets]);
  await self.skipWaiting();
})()));
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  const navigation = request.mode === 'navigate' &&
    (url.origin + url.pathname === index || url.origin + url.pathname === new URL('./', index).href);
  if (!navigation && !assets.has(url.href)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    return await cache.match(navigation ? index : url.href) || fetch(request);
  })());
});

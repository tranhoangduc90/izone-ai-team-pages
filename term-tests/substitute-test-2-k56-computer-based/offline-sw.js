const CACHE='substitute-test-2-k56-shell-cloud-v1';
const PREVIOUS_CACHE='substitute-test-2-k56-shell-t4-v1';
const LEGACY_CACHE='substitute-test-2-k56-shell-20261110-listening-observations-v1';
const STATIC=["./", "../../shared/izone-favicon.svg?v=20261105", "../shared/exam-journal/bridge-audio-status-v1.mjs?v=20261024-startup-v2&resilience=20261027-v1&diagnostics=20261105-v2&eofLog=20261108-v1&continuity=20261110-listening-observations-v1", "../substitute-test-2-k56-shared/styles.css?rev=20261003-writing-save-cas-v1", "styles.css?v=20261030-reading-heading-scroll", "demo-reset.css", "layout-updates.css", "../substitute-shared/brand.css?v=20261014-exam-source-v1&uiRestore=20261108-v2", "../substitute-shared/exam-controls.css?v=20261031-reading-workspace-v1", "../substitute-shared/exam-controls.js?v=20261031-reading-workspace-v1", "../../shared/red-focus-glow.js?v=20261102-r1", "../shared/cbt-audio-download-status.css?v=20261111-audio-status-v1", "../substitute-shared/izone-logo-color.png", "../shared/desktop-exam-guard.css?v=20261027-v1&resilience=20261027-v1", "../shared/desktop-exam-guard.js?v=20261027-v1&resilience=20261027-v1", "../shared/exam-clock.js?v=20261026-v1&resilience=20261027-v1", "../substitute-test-2-k56-shared/config.js?v=20261018-identity-v1&ej=20261024-production-r1", "../substitute-test-2-k56/test-config.js?v=20261014-exam-source-v1&journal=20261024-startup-v2&diagnostics=20261107-v3&eofLog=20261108-v1", "content.js?v=20260917-layout", "audio-loader-audio-status-v1.js?v=20261024-cf512-1&journal=20261024-startup-v2&resilience=20261027-v1&audio=20261111-audio-status-v1&diagnostics=20261105-v2", "../substitute-shared/state.js?v=20261019-cleanup-real-classes-v1&recovery=20261026-v1&examGuard=20261028-v1&demoEntry=20261030-v1&selectiveReset=20261031-v1&offline=20261107-v2", "../substitute-shared/exam-timing-t4-v1.js", "../shared/cbt-audio-start-label.js?rev=20261109-preview-10s-v1", "../substitute-shared/listening-flow-v1.css?v=20261117-start-scroll-v1", "bootstrap-substitute2-k56-cloud-v1.js", "audio-report-substitute2-k56-v1.css", "demo-reset.js?v=20261013-demo-reset-only-v2", "../substitute-shared/native-exam-ui.mjs", "offline-submission-t4-v1.mjs", "../substitute-shared/backup-export-t4-v1.mjs", "../substitute-shared/listening-outbox-t4-v1.mjs", "../substitute-shared/submission-recovery-t4-v1.mjs", "../substitute-test-2-k56-shared/app-substitute2-k56-cloud-v1.js", "../substitute-shared/exam-view-substitute2-k56-audio-report-v1.js", "annotations.js", "../substitute-shared/listening-report-v1.mjs", "../substitute-shared/listening-report-maps-v1.mjs", "../substitute-shared/listening-report-evidence-v1.mjs", "../substitute-shared/listening-report-outbox-v1.mjs", "../substitute-shared/listening-prepare-v1.mjs", "../substitute-shared/audio-preparation-audio-status-v1.mjs?v=20261111-audio-status-v1", "../../shared/audio/direct.mjs?v=20261111-audio-status-v1", "../../shared/audio/catalog.mjs?v=20261107-r2-direct1", "../../shared/audio/direct-cache.mjs?v=20261107-r2-direct1", "../shared/writing-submission.mjs", "../../shared/substitute-student-identity.js", "../../shared/student-identity.js", "../../shared/student-identity-migration.js", "../../shared/teacher-entry.js", "../../shared/master170/question-layout-v1.1.mjs", "../shared/audio-source-choice-audio-status-v1.js?v=20261027-v1&audio=20261028-part-rescue-v1&status=20261111-audio-status-v1", "../shared/cbt-audio-download-status.mjs?v=20261111-audio-status-v1", "../../shared/audio/transport-audio-status-v1.mjs", "../shared/exam-journal/outbox.mjs", "../shared/exam-journal/recorder.mjs?v=20261109-term1-writing-v1", "../shared/exam-journal/audio-delivery-audio-status-v1.mjs?v=20261111-audio-milestones-v2", "../../recordings/assets/fonts/SourceSansPro-Regular.ttf", "../../recordings/assets/fonts/SourceSansPro-Bold.ttf", "../k67-shared/listening-report-choices-v2.mjs", "annotations.js?v=20261018-identity-v1&recovery=20261026-v1", "../../shared/substitute-student-identity.js?v=20261018-identity-v1", "../shared/writing-submission.mjs?v=20261105-writing-submit-v1", "../shared/exam-journal/bridge-substitute2-k56-cloud-v1.mjs", "../../shared/audio/direct-audio-status-v1.mjs?v=20261111-audio-milestones-v2", "../../shared/student-identity.js?v=20261018-identity-v1", "../../shared/student-identity-migration.js?v=20261018-identity-v1", "../../shared/audio/catalog.mjs?v=20261101-natural-dyes1", "../../shared/audio/chunks-audio-status-v1.mjs?v=20261111-audio-milestones-v2", "../../shared/audio/protocol.mjs", "../../shared/audio/config.mjs?v=20261026-term1-replay1", "../term-test-2-computer-based/listening-report-evidence-v1.mjs", "../shared/exam-journal/audio-delivery.mjs?v=20261024-startup-v2", "../shared/exam-journal/pilot-browser-dispatch-log-renewal-v1.mjs", "../../shared/audio/exam-audio-milestones-audio-status-v1.mjs?v=20261111-audio-milestones-v2", "../shared/exam-journal/k67-pilot-browser-transport-log-renewal-v1.mjs", "../shared/exam-journal/k67-pilot-legacy-drain-log-renewal-v1.mjs", "../shared/exam-journal/bootstrap-capture-audio-status-v1.mjs?v=20261111-audio-milestones-v2", "../shared/exam-journal/sealed-batch-log-renewal-v1.mjs", "../shared/exam-journal/k67-pilot-browser-policy.mjs", "../shared/exam-journal/sealed-batch.mjs", "../shared/exam-journal/bridge-audio-status-v1.mjs?v=20261024-startup-v2&resilience=20261027-v1&diagnostics=20261105-v2&miniAudio=20261108-v1&termEof=20261108-v1&termK56Audio=20261108-v1&audioStatus=20261111-audio-milestones-v2"];
const SHELL=new URL('./',self.location.href);
async function tellCacheDecision(event,outcome){
 try{
  const client=event.clientId?await self.clients.get(event.clientId):null;
  client?.postMessage({type:'SUBSTITUTE_SHELL_CACHE_DECISION',outcome,workerRevision:'substitute2-k56-cloud-v1'});
 }catch{}
}

self.addEventListener('install',event=>{
 event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(STATIC.map(path=>
  new Request(new URL(path,SHELL),{cache:'reload'})))).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
 event.waitUntil(Promise.all([caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('substitute-test-2-k56-shell-')&&key!==CACHE&&key!==PREVIOUS_CACHE&&key!==LEGACY_CACHE)
  .map(key=>caches.delete(key)))),self.clients.claim()]));
});
self.addEventListener('message',event=>{
 if(event.data?.type==='SUBSTITUTE_SHELL_BUILD'&&event.ports[0]){
  event.ports[0].postMessage(CACHE);
  return;
 }
 if(event.data?.type!=='PRECACHE'||!Array.isArray(event.data.urls))return;
 const urls=event.data.urls.filter(value=>{try{const url=new URL(value,SHELL);return url.origin===SHELL.origin&&
  !/\.(?:mp3|wav|m4a|enc)$/i.test(url.pathname);}catch{return false;}}).slice(0,80);
 event.waitUntil(caches.open(CACHE).then(async cache=>{
  const results=await Promise.allSettled(urls.map(url=>cache.add(new Request(url,{cache:'reload'}))));
  event.source?.postMessage({type:'PRECACHE_RESULT',ok:results.every(result=>result.status==='fulfilled'),
   cached:results.filter(result=>result.status==='fulfilled').length,total:results.length});
 }));
});
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);
 if(url.origin!==SHELL.origin||event.request.method!=='GET'||/\.(?:mp3|wav|m4a|enc)$/i.test(url.pathname)
  ||url.pathname.includes('/api/')||url.pathname.includes('/webhook/'))return;
 event.respondWith((async()=>{
  const cache=await caches.open(CACHE);
  try{const response=await fetch(event.request);
   if(response.ok)void cache.put(event.request,response.clone());
   return response;
  }catch(error){
   const exact=await cache.match(event.request)||await caches.match(event.request,{cacheName:PREVIOUS_CACHE})||await caches.match(event.request,{cacheName:LEGACY_CACHE});
   const cached=exact||await cache.match(event.request,{ignoreSearch:true})
    ||await caches.match(event.request,{cacheName:PREVIOUS_CACHE,ignoreSearch:true})
    ||await caches.match(event.request,{cacheName:LEGACY_CACHE,ignoreSearch:true});
   if(cached){
    void tellCacheDecision(event,exact?'cached_exact':'cached_other_revision');
    return cached;
   }
   if(event.request.mode==='navigate'){
    const shell=await cache.match(SHELL.href);
    void tellCacheDecision(event,shell?'cached_shell':'cache_miss');
    return shell;
   }
   throw error;
  }
 })());
});

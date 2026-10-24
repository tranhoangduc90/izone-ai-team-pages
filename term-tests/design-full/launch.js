// Chọn bản làm thử gốc hoặc bản đọc bài chấm; không chạy bootstrap ghi trong bản chỉ đọc.
(()=>{
 const load=src=>new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=reject;document.body.append(s);});
 (async()=>{
  if(new URLSearchParams(location.search).get('mode')==='saved'){await load('../design-full/history.js?v=full-20261014');return;}
  if(document.body.dataset.demoPaper==='true'){await load('../shared/attempt-review.js?rev=20260909-k67-update-v1');await load('../shared/app.js?v=20261018-identity-v1&journal=20261024-audio-v1&ej=20261024-production-r1');}
  else{await load('../term-test-2-computer-based/audio-loader.js?rev=20260823-multi-test-v1&journal=20261024-audio-v1');await load('../term-test-2-computer-based/bootstrap.js?v=20261018-identity-v1&journal=20261024-audio-v1');}
 })().catch(()=>{document.getElementById('app').textContent='Chưa tải được bài. Hãy tải lại trang.';});
})();

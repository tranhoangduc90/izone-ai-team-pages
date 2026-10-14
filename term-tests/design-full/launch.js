// Chọn bản làm thử gốc hoặc bản đọc bài chấm; không chạy bootstrap ghi trong bản chỉ đọc.
(()=>{
 const load=src=>new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=reject;document.body.append(s);});
 (async()=>{
  if(new URLSearchParams(location.search).get('mode')==='saved'){await load('../design-full/history.js?v=full-20261014');return;}
  if(document.body.dataset.demoPaper==='true'){await load('../shared/attempt-review.js?rev=20260909-k67-update-v1');await load('../shared/app.js?rev=20261007-mini-login-v1-20261009-feedback-v1-20261011-toggle-v1');}
  else{await load('../term-test-2-computer-based/audio-loader.js?rev=20260823-multi-test-v1');await load('../term-test-2-computer-based/bootstrap.js?rev=20261007-demo-reopen-v1-20261009-feedback-v1-20261011-toggle-v1');}
 })().catch(()=>{document.getElementById('app').textContent='Chưa tải được bài. Hãy tải lại trang.';});
})();

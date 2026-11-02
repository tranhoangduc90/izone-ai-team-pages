// Dùng renderer gốc; adapter chỉ đọc chặn mọi thao tác lưu/nộp của bài lịch sử.
(async()=>{
 const load=src=>new Promise((r,j)=>{const s=document.createElement('script');s.src=src;s.onload=r;s.onerror=j;document.body.append(s);});
 try{
  window.REAL_DEMO=parent.getSavedDemoContext(window);if(window.REAL_DEMO.mode!=='saved')throw Error('Chỉ đọc bài đã chấm.');
  const test=window.REAL_DEMO.content.baseTestSlug;
  if(!['term-test-1','term-test-2','mini-test-lesson-5'].includes(test))throw Error('Sai bài test.');
  await load('../'+test+'/test-config.js?journal=20261024-startup-v2');await load('saved-runtime.js?v=full-20261014');await load('../shared/attempt-review.js');await load('../shared/writing-planning.js');await load('../shared/app.js?v=20261018-identity-v1&journal=20261024-startup-v2&ej=ej-a176e4d58d3089a76456&resilience=20261027-v1&writing_ack=20261029-v1');
  await load('../term-test-2-computer-based/enhance.js?v=20261018-identity-v1&resilience=20261027-v1');await load('../term-test-2-computer-based/interaction-tools.js?v=20261018-identity-v1');await load('../design-demo/presentation.js');await load('../design-demo/real-ui.js?v=clean-audio-20261014');
 }catch(e){document.getElementById('app').textContent='Chưa mở được bài: '+e.message;}
})();

// Dùng lại renderer sản phẩm; adapter demo giữ bài thử trong bộ nhớ iframe/cha.
(async()=>{
 const load=src=>new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=()=>reject(new Error('Không tải được '+src));document.body.append(s);});
 try{
  window.REAL_DEMO=parent.getRealDemoContext(window);
  const tools=window.REAL_DEMO.toolsEnabled;
  async function lab(){if(!tools)return;const css=document.createElement('link');css.rel='stylesheet';css.href='color-lab.css?v=split-demo-20261012';document.head.append(css);await load('color-lab.js?v=split-demo-20261012');await load('color-locator.js?v=split-demo-20261012');}
  await load('../term-test-2/test-config.js?journal=20261024-startup-v2&ej=ej-a176e4d58d3089a76456');await load('real-runtime.js');
  if(window.REAL_DEMO.screen==='lobby'){await load('real-lobby.js?v=continuous-audio-20261014');await lab();return;}
  await load('../shared/attempt-review.js');await load('../shared/writing-planning.js');await load('../shared/app.js?v=20261018-identity-v1&journal=20261024-startup-v2&ej=ej-a176e4d58d3089a76456&resilience=20261027-v1&writing_ack=20261029-v1');
  await load('../term-test-2-computer-based/enhance.js?v=20261018-identity-v1&resilience=20261027-v1');await load('../term-test-2-computer-based/interaction-tools.js?v=20261018-identity-v1');
  await load('presentation.js');await load('real-ui.js?v=continuous-audio-20261014');await load('real-compact.js?v=split-demo-20261012');
  // Chỉ demo sạch có audio gọn; lab giữ player và bảng màu hiện tại.
  if(!tools&&window.REAL_DEMO.screen==='listening'){const css=document.createElement('link');css.rel='stylesheet';css.href='clean-audio.css?v=continuous-audio-20261014';document.head.append(css);await load('clean-audio.js?v=continuous-audio-20261014');}
  await lab();
 }catch(e){document.getElementById('app').textContent='Hãy mở demo từ trang chính. '+e.message;}
})();

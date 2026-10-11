// Dùng lại renderer sản phẩm; adapter demo giữ bài thử trong bộ nhớ iframe/cha.
(async()=>{
 const load=src=>new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=()=>reject(new Error('Không tải được '+src));document.body.append(s);});
 try{
  window.REAL_DEMO=parent.getRealDemoContext(window);
  await load('../term-test-2/test-config.js');await load('real-runtime.js');
  await load('../shared/attempt-review.js');await load('../shared/writing-planning.js');await load('../shared/app.js');
  await load('../term-test-2-computer-based/enhance.js');await load('../term-test-2-computer-based/interaction-tools.js');
  await load('presentation.js');await load('real-ui.js');await load('color-lab.js');await load('color-locator.js');
 }catch(e){document.getElementById('app').textContent='Hãy mở demo từ màn đăng nhập. '+e.message;}
})();

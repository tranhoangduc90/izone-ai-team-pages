import {installBanner,loadScript,feedbackHtml} from './common.mjs';
export async function mount(data){
 let reset=()=>{};installBanner(()=>reset());
 window.IzoneReadingHomeworkDemo={content:data.content,
  showFeedback:show=>show('Ví dụ góp ý — không phải lượt chấm',feedbackHtml(),'<button class="primary" data-close-modal>Về bài để sửa thử</button>'),
  decorate(ctx){reset=ctx.reset;
   document.querySelectorAll('.learner').forEach(n=>n.textContent='Giảng viên · Thao tác thử');
   document.querySelectorAll('.reading-practice-overlay').forEach(n=>n.hidden=true);
   document.querySelectorAll('.reading-practice-content[inert]').forEach(n=>n.inert=false);
   document.querySelectorAll('.reading-practice-gate').forEach(n=>n.dataset.locked='false');
   const status=document.querySelector('#practice-status');if(status)status.textContent='Bản demo đã mở sẵn bài đọc. Bài học viên thật yêu cầu hoàn thành phần luyện ChatGPT trước.';
   const check=document.querySelector('#practice-check');if(check){check.textContent='Xem ví dụ xác nhận';check.onclick=()=>ctx.showModal('Xác nhận luyện ChatGPT — minh họa','<p>Ở bài thật, hệ thống đọc hội thoại Share và xác nhận đã hoàn thành luyện tập trước khi mở bài đọc.</p><p>Bản demo mở sẵn nội dung để giảng viên xem và trình chiếu.</p>','<button class="primary" data-close-modal>Đóng</button>');}
   const grade=document.querySelector('#grade-button');if(grade){grade.textContent='Xem ví dụ góp ý';grade.setAttribute('aria-label','Xem ví dụ góp ý minh họa');}
  }};
 const renderer=data.content.type==='tfng'?'tfng':data.content.type==='green-roofs'?'green-roofs':data.content.type==='matching_people'?'people':data.content.type==='sentence_completion'?'sentence':data.content.type==='matching_headings'?'headings':null;
 if(renderer)await loadScript(new URL(`../reading-skills67/${renderer}-renderer.js`,import.meta.url).href);
 await loadScript(new URL('../reading-skills67/prototype.js?v=20261030-cta31-demo1',import.meta.url).href);
 await loadScript(new URL('../reading-practice/annotations.js?v=20261024-master170-notes6',import.meta.url).href);
 await new Promise((resolve,reject)=>{let tries=0;const check=()=>{if(document.querySelector('[data-target]'))resolve();else if(++tries>100)reject(Error('Chưa dựng được bài Reading.'));else setTimeout(check,40);};check();});
}

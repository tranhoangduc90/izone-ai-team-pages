// Nhận mã lesson từ route; đọc cấu hình công khai từ backend và cùng một mẫu Lesson 5.
// Chỉ sau khi đủ cấu hình mới mở app. Thiếu bài hoặc lỗi mạng hiện cách tải lại, không mở nhầm bài.
// Chỉ máy xem thử tại loopback dùng API cùng origin; trang phát hành giữ API HTTPS.
const localPreview=['127.0.0.1','localhost'].includes(location.hostname)&&['3199','3211'].includes(location.port);
import {lessonEntryClass} from './test-class-entry.mjs?v=20261102-lesson-scope-v1';
import {installTeacherEntry} from '../../shared/teacher-entry.js?v=20261019-v1';
const handoff=globalThis.handout67WritingHandoff;
const apiBase=handoff?.apiBase||(localPreview?location.origin+'/api/handout67/v1':'https://ducizone.ddns.net/api/handout67/v1');
if(localPreview)globalThis.handout67ApiBase=apiBase;
async function boot(){
 const activity=document.body.dataset.activity,view=document.body.dataset.view;
 const fromVerifiedDocs=['lesson3','lesson4'].includes(activity)&&view==='student'&&!!handoff?.verifiedDocsStudent;
 try{
  if(!/^lesson[1-9]\d*$/.test(activity)||!['student','teacher'].includes(view))throw new Error('ROUTE_INVALID');
  const [response,template]=await Promise.all([(handoff?.request||fetch)(apiBase+'/lessons/'+encodeURIComponent(activity),{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000)}),fetch(new URL('./'+view+'.html?v=20261026-startup2',import.meta.url),{redirect:'error',signal:AbortSignal.timeout(15000)})]);
  const value=await response.json();
  if(!response.ok||!value.ok||value.lesson?.activity!==activity||!template.ok)throw Object.assign(Error('LESSON_UNAVAILABLE'),{status:response.status});
  const lesson=value.lesson;
  globalThis.handout67Lesson=Object.freeze(lesson);
  const entryClass=lessonEntryClass(lesson,location.search);
  if(entryClass)document.body.dataset.classRef=entryClass;
  const html=await template.text();
  if(fromVerifiedDocs){
   const layout=document.createElement('template');
   layout.innerHTML=html;
   layout.content.getElementById('identity').hidden=true;
   const opening=document.createElement('section');
   opening.id='verified-handout-opening';
   opening.className='login-shell';
   const status=document.createElement('p');
   status.setAttribute('role','status');
   status.textContent='Đang mở dàn ý của bạn…';
   opening.append(status);
   layout.content.getElementById('workspace').before(opening);
   document.getElementById('lesson-access-style')?.remove();
   document.body.replaceChildren(layout.content);
  }else document.body.innerHTML=html;
  if(view==='student'&&activity==='lesson15')document.querySelector('[data-lesson-text="classLesson"]')?.remove();
  if(view==='student'&&activity!=='lesson4')installTeacherEntry({product:'handout67',teacherPath:handoff?'../lesson3/teacher.html':'./teacher.html',context:{class:entryClass},hosts:[document.querySelector('.topbar')]});
  if(lesson.workflowMode==='whole-chain-v1'&&view==='student'){
   document.querySelector('.login-description').textContent='Giải thích vì sao người ta theo thời trang. Nhập cả A–X–B và Check chung từng ý.';
   document.querySelector('.journey h2').textContent='Thân bài 1 · WHY';document.querySelector('.lesson-tag').textContent='Thân bài 1';
   document.querySelector('.journey-note p').textContent='Đọc cả chuỗi để kiểm quan hệ nguyên nhân – kết quả.';
   const help=document.createElement('details');help.className='why-guide';
   const summary=document.createElement('summary');summary.textContent='Ba cách triển khai WHY · Xem khi cần';help.append(summary);
   const list=document.createElement('ol');for(const text of lesson.whyOptions||lesson.helpItems||[]){const li=document.createElement('li');li.textContent=text;list.append(li);}help.append(list);
   const note=document.createElement('p');note.textContent='Chọn cách phù hợp với nội dung. Không cần chọn tên phương án trước khi Check; không bắt mọi điểm B có cùng vai trò.';help.append(note);document.getElementById('prompt').after(help);
  }
  if(lesson.handoutMode==='two-bodies-v1'&&view==='student'){
   document.querySelector('.login-description').textContent=lesson.description;
   document.querySelector('.journey h2').textContent='Hai thân bài';document.querySelector('.lesson-tag').textContent='Hai thân bài';
   document.querySelector('.journey-note p').textContent='Mỗi thân bài có Topic, hai chuỗi và bảng từ vựng riêng.';
   document.querySelector('.why-guide summary').textContent=lesson.helpTitle;
   document.querySelector('.why-guide>p').textContent='Đọc cả chuỗi để kiểm quan hệ giữa A, X và B; tự chọn hai ý phù hợp với từng quan điểm.';
   if(lesson.preparationMode==='ideas-first-v1'){
    document.querySelector('.journey-note p').textContent='Chốt idea cả hai thân bài trước, rồi viết Topic và phát triển từng chuỗi A → X → B.';
    document.querySelector('.why-guide>p').textContent=(lesson.preparationKind==='discussion-v1'?lesson.helpItems[1]:lesson.preparationKind==='opinion-v1'?'Thân bài 1 bàn phương án không ủng hộ; thân bài 2 bảo vệ phương án ủng hộ. Đồng ý một phần vẫn cần phía nghiêng về và điều kiện rõ.':'Chê phương án không chọn và khen phương án chọn trên cùng khía cạnh giúp hai đoạn liên hệ rõ hơn; đây là gợi ý, không bắt buộc.');
    document.querySelector('.work-content>.page-title p:last-child').textContent='Chốt hướng so sánh và idea trước, rồi lần lượt phát triển từng thân bài.';
   }
  }
  if(lesson.outlineOnly&&view==='student'){
   document.querySelector('[data-lesson-text="classLesson"]')?.remove();
   document.querySelector('.why-guide').remove();
   document.querySelector('.journey-note p').textContent='Check từng thân bài, rồi đối chiếu với quan điểm của cả bài.';
   document.querySelector('.work-content>.page-title p:last-child').textContent=lesson.ideaHint;
  }
  if(activity==='lesson4'&&view==='student'){
   document.querySelector('.journey-note').remove();
   document.querySelector('.page-footer').remove();
   document.querySelector('.brand-product span').textContent='Homework';
   document.querySelector('.work-content>.page-title [data-lesson-text="writingLesson"]').textContent='WRITING HOMEWORK';
   document.querySelector('.work-content>.page-title [data-lesson-text="writingLesson"]').removeAttribute('data-lesson-text');
  }
  if(localPreview){const banner=document.createElement('aside');banner.className='preview-banner';banner.innerHTML='<b>Bản xem thử riêng · Dữ liệu mẫu</b><p>Không ghi vào bài học viên thật. Check dùng Cổng AI thật; bài và góp ý lưu trong kho thử trên máy này.</p><a href="/writing-handouts/'+activity+'/">Trang học viên</a> · <a href="/writing-handouts/'+activity+'/teacher.html">Trang giảng viên</a>';document.body.prepend(banner);}
  const texts={...lesson,classLesson:(entryClass||lesson.classes.join(', '))+' · Lesson '+lesson.number,courseLesson:'Khóa 6–7 · Writing lesson '+lesson.number,writingLesson:'Writing · Lesson '+lesson.number,contextLesson:'Khóa 67 · Lesson '+lesson.number,teacherTopic:lesson.title+(lesson.handoutMode==='two-bodies-v1'?' · Hai thân bài':' · Thân bài '+lesson.body),teacherTitle:'Theo dõi Lesson '+lesson.number,promptTitle:'Đề bài · '+lesson.title};
  for(const el of document.querySelectorAll('[data-lesson-text]'))el.textContent=texts[el.dataset.lessonText];
  document.querySelector('[data-lesson-brand]')?.setAttribute('aria-label','IZONE Writing Lesson '+lesson.number);
  document.title=view==='teacher'?'Theo dõi Lesson '+lesson.number+' · IZONE Writing':activity==='lesson4'?lesson.title:'Lesson '+lesson.number+' · Writing · IZONE';
  const editorVersion=lesson.outlineOnly||['opinion-v1','discussion-v1'].includes(lesson.preparationKind)
   ?(activity==='lesson4'?'20261114-lesson4-check':'20261113-save-log-v1'):'20261109-l3-v1&check=20261101-v1&poll=20261104-v1';
  await import(view==='teacher'?'../lesson5/teacher.js?v=20261109-l3-v1&startup=20261026-v2':'../lesson5-thu/app.js?v='+editorVersion);
 }catch(error){
  if(fromVerifiedDocs){
   handoff.showOpeningError(document.getElementById('lesson-access')||document.getElementById('verified-handout-opening')||document.body,error,()=>location.reload());
   return;
  }
  document.body.textContent='Chưa mở được bài học. Hãy tải lại trang khi kết nối ổn định; bài đã lưu vẫn được giữ.';
 }
}
void boot();

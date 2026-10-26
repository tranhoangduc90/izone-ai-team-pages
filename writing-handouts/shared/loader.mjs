// Nhận mã lesson từ route; đọc cấu hình công khai từ backend và cùng một mẫu Lesson 5.
// Chỉ sau khi đủ cấu hình mới mở app. Thiếu bài hoặc lỗi mạng hiện cách tải lại, không mở nhầm bài.
// Chỉ máy xem thử tại loopback dùng API cùng origin; trang phát hành giữ API HTTPS.
const localPreview=['127.0.0.1','localhost'].includes(location.hostname)&&['3199','3211'].includes(location.port);
import {lessonEntryClass} from './test-class-entry.mjs?v=20261018-test-class-v1';
import {installTeacherEntry} from '../../shared/teacher-entry.js?v=20261019-v1';
const apiBase=localPreview?location.origin+'/api/handout67/v1':'https://ducizone.ddns.net/api/handout67/v1';
if(localPreview)globalThis.handout67ApiBase=apiBase;
async function boot(){
 const activity=document.body.dataset.activity,view=document.body.dataset.view;
 try{
  if(!/^lesson[1-9]\d*$/.test(activity)||!['student','teacher'].includes(view))throw new Error('ROUTE_INVALID');
  const [response,template]=await Promise.all([fetch(apiBase+'/lessons/'+encodeURIComponent(activity),{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000)}),fetch(new URL('./'+view+'.html?v=20261026-startup2',import.meta.url),{redirect:'error',signal:AbortSignal.timeout(15000)})]);
  const value=await response.json();
  if(!response.ok||!value.ok||value.lesson?.activity!==activity||!template.ok)throw new Error('LESSON_UNAVAILABLE');
  const lesson=value.lesson;
  globalThis.handout67Lesson=Object.freeze(lesson);
  const entryClass=lessonEntryClass(lesson,location.search);
  if(entryClass)document.body.dataset.classRef=entryClass;
  document.body.innerHTML=await template.text();
  if(view==='student')installTeacherEntry({product:'handout67',teacherPath:'./teacher.html',context:{class:entryClass},hosts:[document.querySelector('.topbar')]});
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
    document.querySelector('.why-guide>p').textContent='Chê phương án không chọn và khen phương án chọn trên cùng khía cạnh giúp hai đoạn liên hệ rõ hơn; đây là gợi ý, không bắt buộc.';
    document.querySelector('.work-content>.page-title p:last-child').textContent='Chốt hướng so sánh và idea trước, rồi lần lượt phát triển từng thân bài.';
   }
  }
  if(localPreview){const banner=document.createElement('aside');banner.className='preview-banner';banner.innerHTML='<b>Bản xem thử riêng · Dữ liệu mẫu</b><p>Không ghi vào bài học viên thật. Check dùng Cổng AI thật; bài và góp ý lưu trong kho thử trên máy này.</p><a href="/writing-handouts/'+activity+'/">Trang học viên</a> · <a href="/writing-handouts/'+activity+'/teacher.html">Trang giảng viên</a>';document.body.prepend(banner);}
  const texts={...lesson,classLesson:(entryClass||lesson.classes.join(', '))+' · Lesson '+lesson.number,courseLesson:'Khóa 6–7 · Writing lesson '+lesson.number,writingLesson:'Writing · Lesson '+lesson.number,contextLesson:'Khóa 67 · Lesson '+lesson.number,teacherTopic:lesson.title+(lesson.handoutMode==='two-bodies-v1'?' · Hai thân bài':' · Thân bài '+lesson.body),teacherTitle:'Theo dõi Lesson '+lesson.number,promptTitle:'Đề bài · '+lesson.title};
  for(const el of document.querySelectorAll('[data-lesson-text]'))el.textContent=texts[el.dataset.lessonText];
  document.querySelector('[data-lesson-brand]')?.setAttribute('aria-label','IZONE Writing Lesson '+lesson.number);
  document.title=view==='teacher'?'Theo dõi Lesson '+lesson.number+' · IZONE Writing':'Lesson '+lesson.number+' · Writing · IZONE';
  await import(view==='teacher'?'../lesson5/teacher.js?v=20261025-l11-ideas-v4&startup=20261026-v2':'../lesson5-thu/app.js?v=20261025-l11-ideas-v4');
 }catch{
  document.body.textContent='Chưa mở được bài học. Hãy tải lại trang khi kết nối ổn định; bài đã lưu vẫn được giữ.';
 }
}
void boot();

// Nhận mã lesson từ route; đọc cấu hình công khai từ backend và cùng một mẫu Lesson 5.
// Chỉ sau khi đủ cấu hình mới mở app. Thiếu bài hoặc lỗi mạng hiện cách tải lại, không mở nhầm bài.
const apiBase='https://ducizone.ddns.net/api/handout67/v1';
async function boot(){
 const activity=document.body.dataset.activity,view=document.body.dataset.view;
 try{
  if(!/^lesson[1-9]\d*$/.test(activity)||!['student','teacher'].includes(view))throw new Error('ROUTE_INVALID');
  const [response,template]=await Promise.all([fetch(apiBase+'/lessons/'+encodeURIComponent(activity),{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000)}),fetch(new URL('./'+view+'.html?v=20261011-1',import.meta.url),{redirect:'error',signal:AbortSignal.timeout(15000)})]);
  const value=await response.json();
  if(!response.ok||!value.ok||value.lesson?.activity!==activity||!template.ok)throw new Error('LESSON_UNAVAILABLE');
  const lesson=value.lesson;
  globalThis.handout67Lesson=Object.freeze(lesson);
  if(lesson.defaultClass)document.body.dataset.classRef=lesson.defaultClass;
  document.body.innerHTML=await template.text();
  const texts={...lesson,classLesson:(lesson.defaultClass||lesson.classes.join(', '))+' · Lesson '+lesson.number,courseLesson:'Khóa 6–7 · Writing lesson '+lesson.number,writingLesson:'Writing · Lesson '+lesson.number,contextLesson:'Khóa 67 · Lesson '+lesson.number,teacherTopic:lesson.title+' · Thân bài '+lesson.body,teacherTitle:'Theo dõi Lesson '+lesson.number,promptTitle:'Đề bài · '+lesson.title};
  for(const el of document.querySelectorAll('[data-lesson-text]'))el.textContent=texts[el.dataset.lessonText];
  document.querySelector('[data-lesson-brand]')?.setAttribute('aria-label','IZONE Writing Lesson '+lesson.number);
  document.title=view==='teacher'?'Theo dõi Lesson '+lesson.number+' · IZONE Writing':'Lesson '+lesson.number+' · Writing · IZONE';
  await import(view==='teacher'?'../lesson5/teacher.js?v=20261011-1':'../lesson5-thu/app.js?v=20261011-1');
 }catch{
  document.body.textContent='Chưa mở được bài học. Hãy tải lại trang khi kết nối ổn định; bài đã lưu vẫn được giữ.';
 }
}
void boot();

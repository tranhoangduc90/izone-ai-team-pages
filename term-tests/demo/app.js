import {COURSES,demoContext,loadStudents,resetStudent,resetSignal,clearStudentStorage} from './model.js?v=20261020-v1';

// Tải danh sách thật của lớp giả, mở trang thi hiện hành và reset theo từng người.
// Khi mạng lỗi, giữ thông tin lỗi tại học viên; không biến reset một phần thành hoàn tất.
const $=id=>document.getElementById(id);
const course=$('course'),test=$('test'),order=$('order'),status=$('status'),list=$('students');
course.value=new URLSearchParams(location.search).get('course')==='56'?'56':'67';
let epoch=0,resetting=false;
function storageList(){const out=[];for(const get of [()=>localStorage,()=>sessionStorage])try{out.push(get());}catch{}return out;}
function links(context,enabled){
  const query=new URLSearchParams({class:context.code,mode:order.value});
  for(const [id,path] of [['openExam',`${context.slug}-computer-based`],['openPaper',context.slug],['openTeacher',context.teacher]]){
    const target=$(id),params=new URLSearchParams(query);if(id==='openTeacher')params.set('test',context.slug);
    if(enabled){target.href=`../${path}/?${params}`;target.removeAttribute('aria-disabled');}else{target.removeAttribute('href');target.setAttribute('aria-disabled','true');}
  }
  $('classCode').textContent=`Lớp ${context.code} · Đề và thời gian thi như bản đang dùng. Giảng viên cần đăng nhập để xem kết quả.`;
}
function lock(value){resetting=value;course.disabled=test.disabled=order.disabled=$('refresh').disabled=value;list.querySelectorAll('button').forEach(b=>b.disabled=value);links(demoContext(course.value,test.value),!value&&list.children.length>0);}
function render(students,context){
  list.replaceChildren();
  for(const student of students){
    const row=document.createElement('article');row.className='student';
    const name=document.createElement('h3');name.textContent=student.name;
    const actions=document.createElement('div');actions.className='student-actions';
    const message=document.createElement('p');message.className='student-status';message.setAttribute('role','status');
    for(const [all,label] of [[false,'Reset bài đang chọn'],[true,'Reset cả 3 bài']]){
      const button=document.createElement('button');button.type='button';button.className=`button${all?' reset-all':''}`;button.textContent=label;
      button.addEventListener('click',async()=>{
        if(resetting||!confirm(`Reset ${all?'cả 3 bài':test.selectedOptions[0].textContent} của ${student.name}? Chỉ dữ liệu của học viên này bị xóa. Hãy đóng các tab làm bài của học viên này trước khi tiếp tục.`))return;
        lock(true);message.dataset.error='false';message.textContent='Đang reset…';
        const completed=[];
        try{
          for(const key of all?Object.keys(COURSES[course.value].tests):[test.value]){
            const target=demoContext(course.value,key);
            // Xác minh lại cùng định danh trong từng bài trước khi xóa.
            if(all){const roster=await loadStudents(target);if(!roster.some(s=>s.ref===student.ref&&s.name===student.name))throw new Error('Học viên không khớp danh sách của cả ba bài.');}
            await resetStudent(target,student.ref);completed.push(key);
            clearStudentStorage(target,student.ref,storageList());
            try{localStorage.setItem(resetSignal(target,student.ref),crypto.randomUUID());}catch{}
          }
          message.textContent=`Đã reset ${all?'cả 3 bài':'bài đang chọn'}. Có thể mở bài và chọn lại ${student.name}.`;
        }catch(error){message.dataset.error='true';message.textContent=`${completed.length?`Đã reset ${completed.length} bài; phần còn lại chưa xác nhận. `:''}${error.message}`;}
        finally{lock(false);}
      });
      actions.append(button);
    }
    row.append(name,actions,message);list.append(row);
  }
}
async function reload(){
  const version=++epoch,context=demoContext(course.value,test.value);list.replaceChildren();links(context,false);
  status.dataset.error='false';status.textContent='Đang tải danh sách học viên…';
  try{const students=await loadStudents(context);if(version!==epoch)return;render(students,context);links(context,true);status.textContent=`${students.length} học viên demo · Mỗi người có dữ liệu riêng.`;}
  catch(error){if(version!==epoch)return;status.dataset.error='true';status.textContent=error.message;}
}
course.addEventListener('change',()=>{const url=new URL(location.href);url.searchParams.set('course',course.value);history.replaceState(null,'',url);reload();});
test.addEventListener('change',reload);order.addEventListener('change',()=>links(demoContext(course.value,test.value),list.children.length>0));$('refresh').addEventListener('click',reload);
reload();

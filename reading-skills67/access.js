/* Nhận diện kế thừa Reading: chỉ nhớ mã ERP, token riêng trong tab.
   API kiểm lại quyền. Chọn/đổi người không đọc nháp trước xác nhận máy chủ. */
(function(){
 'use strict';
 const prefix=window.READING67_API_BASE||new URL('../api/reading-skills67',location.href).pathname,params=new URLSearchParams(location.search);
 let token='',person=null,config=null,course=null,key='',teacher=params.get('teacher')==='1';
 const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const errors={STUDENT_ACCESS_DENIED:'Học viên không còn quyền ở lớp này.',ACCESS_DENIED:'Tài khoản chưa có quyền lớp.',TEACHER_LOGIN_REQUIRED:'Giảng viên cần đăng nhập Google.',CONTEXT_UNAVAILABLE:'Chưa kiểm được danh sách lớp. Hãy thử lại.',CONTEXT_INVALID:'Nguồn quyền chưa hợp lệ hoặc đã cũ.'};
 async function request(route,options={}){
  const r=await fetch(prefix+route,{credentials:'include',...options,headers:{'Content-Type':'application/json',...(token&&!teacher?{Authorization:'Bearer '+token}:{}),...options.headers},signal:AbortSignal.timeout(30000)});
  const value=await r.json();if(!r.ok)throw Object.assign(new Error(errors[value.error]||value.error||'Chưa mở được bài.'),{status:r.status,code:value.error});return value;
 }
 const post=(route,value)=>request(route,{method:'POST',body:JSON.stringify(value)});
 async function login(classId,studentRef,selection){
  const classes=(await request('/classes')).classes,chosen=classes.find(c=>c.id===classId);
  if(!chosen)throw Error('Lớp không còn được phép mở.');
  const prepared=selection?course.automaticContext(selection):course.prepare(studentRef,chosen.classCode);
  const value=await post('/student/login',{classId,studentRef});
  if(selection&&!course.isCurrent(selection))throw Error('Người đã nhớ vừa đổi. Chưa dùng phản hồi cũ.');
  if(value.identity?.ownerId!==studentRef||value.identity.courseId!==classId||!value.token)throw Error('Phiên trả về chưa đúng người/lớp.');
  person=value.identity;token=value.token;sessionStorage.setItem(key,JSON.stringify({token,person}));course.pin(studentRef,{classRef:classId});
  if(!config.demo){const remembered=await course.commit(prepared,{automatic:!!selection});if(!['ok','empty'].includes(remembered.status))window.dispatchEvent(new CustomEvent('reading67:access-warning',{detail:'Bài đã mở; chưa ghi nhớ được cho bài tiếp theo.'}));}
  return value;
 }
 async function choose(){
  const app=document.querySelector('#app'),classes=(await request('/classes')).classes;
  app.innerHTML='<section class="access-card"><p class="kicker">READING 67 · VÀO BÀI</p><h1>'+escape(config.title)+'</h1><p>Chọn lớp và tên của bạn. Bài và nhận xét sẽ được lưu riêng.</p><label for="entry-class">Lớp học</label><select id="entry-class"><option value="">Chọn lớp…</option>'+classes.map(c=>'<option value="'+escape(c.id)+'">'+escape(c.classCode)+'</option>').join('')+'</select><label for="entry-student">Học viên</label><select id="entry-student" disabled><option>Chọn lớp trước</option></select><p id="entry-error" role="alert"></p><button class="primary" id="entry-open" disabled>Vào bài</button>'+(config.demo?'<p class="minimum-note">Tài khoản giả để thử giao diện; không ghi nhớ vào danh tính học viên thật.</p>':'<p class="minimum-note">Trình duyệt chỉ ghi nhớ mã người học cho các bài tiếp theo.</p>')+'</section>';
  let generation=0;const classInput=app.querySelector('#entry-class'),studentInput=app.querySelector('#entry-student'),button=app.querySelector('#entry-open'),error=app.querySelector('#entry-error');
  classInput.onchange=async()=>{const version=++generation;studentInput.disabled=true;button.disabled=true;error.textContent='';try{const data=await request('/classes/'+encodeURIComponent(classInput.value)+'/students');if(version!==generation)return;studentInput.innerHTML='<option value="">Chọn tên của bạn…</option>'+data.students.map(s=>'<option value="'+s.studentRef+'">'+escape(s.name)+'</option>').join('');studentInput.disabled=false;}catch(e){if(version===generation)error.textContent=e.message;}};
  studentInput.onchange=()=>button.disabled=!studentInput.value;
  return new Promise(resolve=>{button.onclick=async()=>{button.disabled=true;error.textContent='';try{await login(classInput.value,studentInput.value);resolve();}catch(e){error.textContent=e.message;button.disabled=false;}};});
 }
 async function open(){
  try{config=await request('/config');}catch(e){if(e.status===404)return {legacy:true};throw e;}
  if(params.get('assignmentCode')&&params.get('assignmentCode')!==config.code)throw Error('Mã trong link không khớp bài đang mở. Hãy dùng lại CTA trong Homework.');
  key='reading67:session:'+config.code;
  if(teacher){
   const classId=params.get('classId'),studentRef=params.get('studentRef');if(!classId||!studentRef)throw Error('Mở từ trang Giảng viên để chọn đúng lớp và học viên.');
   try{return {teacher:true,work:await request('/teacher/work/'+encodeURIComponent(classId)+'/'+encodeURIComponent(studentRef)),config};}
   catch(error){if(error.status!==401)throw error;const login=new URL('teacher.html',location.href);login.searchParams.set('returnTo',location.pathname+location.search);location.replace(login.href);return new Promise(()=>{});}
  }
  const {createCourseStudentIdentity}=await import('../shared/course-student-identity.js?v=20261018-identity-v1');
  course=createCourseStudentIdentity({product:'reading-skills67',entry:config.code,requestIdentity:value=>post('/identity/resolve',value)});
  course.subscribe(()=>{if(person)window.dispatchEvent(new CustomEvent('reading67:access-warning',{detail:'Người đã nhớ ở tab khác vừa đổi. Bài tại tab này vẫn giữ đúng người.'}));});
  let saved;try{saved=JSON.parse(sessionStorage.getItem(key)||'null');}catch{saved=null;}
  if(saved&&course.canRestoreSession()){
   token=saved.token;
   try{const check=await request('/lesson');if(check.identity.ownerId!==saved.person.ownerId||check.identity.courseId!==saved.person.courseId)throw Error('Chủ phiên không khớp.');person=check.identity;return {config};}
   catch(e){token='';if(e.status!==401&&e.status!==403)throw e;sessionStorage.removeItem(key);}
  }
  if(config.demo&&params.get('demoReview')==='1'){await login(config.demoStudent.classId,config.demoStudent.studentRef);return {config};}
  if(!config.demo){const classes=(await request('/classes')).classes,selection=await course.resolve({allowedClassCodes:classes.map(c=>c.classCode)}).catch(()=>({status:'unavailable'}));if(selection.status==='unique'){await login(selection.alias.classId,selection.alias.studentRef,selection);return {config};}}
  await choose();return {config};
 }
 async function change(){
  if(!config.demo){const forgotten=await course.forget();if(forgotten.status!=='empty')throw Error('Chưa đổi được người; nháp vẫn được giữ.');}
  await post('/student/logout',{});sessionStorage.removeItem(key);token='';person=null;location.href=location.pathname+'?server=1';
 }
 window.Reading67Access={open,request,change,get config(){return config;},get person(){return person;},get headers(){return token&&!teacher?{Authorization:'Bearer '+token}:{};},get teacherPath(){return '/teacher/work/'+encodeURIComponent(params.get('classId'))+'/'+encodeURIComponent(params.get('studentRef'));},get teacher(){return teacher;}};
}());

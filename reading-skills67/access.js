/* Nhận diện kế thừa Reading: chỉ nhớ mã ERP, token riêng trong tab.
   API kiểm lại quyền. Chọn/đổi người không đọc nháp trước xác nhận máy chủ. */
(function(){
 'use strict';
 const prefix=window.READING67_API_BASE||new URL('../api/reading-skills67',location.href).pathname,params=new URLSearchParams(location.search);
 let token='',person=null,config=null,course=null,key='',teacher=params.get('teacher')==='1',entryContext=null,entryDocument='';
 const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const errors={STUDENT_ACCESS_DENIED:'Học viên không còn quyền ở lớp này.',ACCESS_DENIED:'Tài khoản chưa có quyền lớp.',TEACHER_LOGIN_REQUIRED:'Giảng viên cần đăng nhập Google.',CONTEXT_UNAVAILABLE:'Chưa kiểm được danh sách lớp. Hãy thử lại.',CONTEXT_INVALID:'Nguồn quyền chưa hợp lệ hoặc đã cũ.'};
 const entryErrors={HOMEWORK_ENTRY_NOT_FOUND:'Chưa xác nhận được chủ của link Homework này. Hãy mở lại từ bản Homework của bạn.',HOMEWORK_ENTRY_OWNER_MISMATCH:'Người đang mở không khớp chủ của link Homework. Chưa đọc hoặc ghi bài của người khác.'};
 const entryHeaders=()=>entryDocument&&!teacher?{'X-Reading-Homework-Document':entryDocument}:{};
 const sameEntry=(classId,studentRef)=>!entryContext||entryContext.classId===classId&&entryContext.studentRef===studentRef;
 async function request(route,options={}){
  const r=await fetch(prefix+route,{credentials:'include',...options,headers:{'Content-Type':'application/json',...entryHeaders(),...(token&&!teacher?{Authorization:'Bearer '+token}:{}),...options.headers},signal:AbortSignal.timeout(30000)});
  const value=await r.json();if(!r.ok)throw Object.assign(new Error(errors[value.error]||entryErrors[value.error]||value.error||'Chưa mở được bài.'),{status:r.status,code:value.error});return value;
 }
 const post=(route,value)=>request(route,{method:'POST',body:JSON.stringify(value)});
 async function login(classId,studentRef,selection,classes){
  if(!sameEntry(classId,studentRef))throw Error(entryErrors.HOMEWORK_ENTRY_OWNER_MISMATCH);
  // Danh sách chỉ sống trong lượt mở này; POST vẫn kiểm quyền lớp hiện hành.
  const chosen=classes.find(c=>c.id===classId);
  if(!chosen)throw Error('Lớp không còn được phép mở.');
  const prepared=selection?course.automaticContext(selection):course.prepare(studentRef,chosen.classCode);
  const value=await post('/student/login',{classId,studentRef});
  if(selection&&!course.isCurrent(selection))throw Error('Người đã nhớ vừa đổi. Chưa dùng phản hồi cũ.');
  if(value.identity?.ownerId!==studentRef||value.identity.courseId!==classId||!value.token)throw Error('Phiên trả về chưa đúng người/lớp.');
  person=value.identity;token=value.token;
  try{sessionStorage.setItem(key,JSON.stringify({token,person}));}catch{window.dispatchEvent(new CustomEvent('reading67:access-warning',{detail:'Bài đã mở; không giữ được phiên khi đóng hoặc tải lại tab này.'}));}
  course.pin(studentRef,{classRef:classId});
  if(!config.demo){const remembered=await course.commit(prepared,{automatic:!!selection});if(!['ok','empty'].includes(remembered.status))window.dispatchEvent(new CustomEvent('reading67:access-warning',{detail:'Bài đã mở; chưa ghi nhớ được cho bài tiếp theo.'}));}
  return value;
 }
 async function choose(classes){
  if(entryContext)classes=classes.filter(c=>c.id===entryContext.classId);
  const app=document.querySelector('#app');
  app.innerHTML='<section class="access-card"><p class="kicker">READING 67 · VÀO BÀI</p><h1>'+escape(config.title)+'</h1><p>Chọn lớp và tên của bạn. Bài và nhận xét sẽ được lưu riêng.</p><label for="entry-class">Lớp học</label><select id="entry-class"><option value="">Chọn lớp…</option>'+classes.map(c=>'<option value="'+escape(c.id)+'">'+escape(c.classCode)+'</option>').join('')+'</select><label for="entry-student">Học viên</label><select id="entry-student" disabled><option>Chọn lớp trước</option></select><p id="entry-error" role="alert"></p><button class="primary" id="entry-open" disabled>Vào bài</button>'+(config.demo?'<p class="minimum-note">Tài khoản giả để thử giao diện; không ghi nhớ vào danh tính học viên thật.</p>':'<p class="minimum-note">Trình duyệt chỉ ghi nhớ mã người học cho các bài tiếp theo.</p>')+'</section>';
  let generation=0;const classInput=app.querySelector('#entry-class'),studentInput=app.querySelector('#entry-student'),button=app.querySelector('#entry-open'),error=app.querySelector('#entry-error');
  if(entryContext){const notice=document.createElement('p');notice.id='entry-owner';notice.setAttribute('role','status');notice.textContent='Link Homework này thuộc '+entryContext.name+' · '+entryContext.classCode+'. Hãy chọn đúng tên để tiếp tục; bài của người đang nhớ được giữ nguyên.';classInput.before(notice);}
  classInput.onchange=async()=>{const version=++generation;studentInput.disabled=true;button.disabled=true;error.textContent='';try{const data=await request('/classes/'+encodeURIComponent(classInput.value)+'/students');if(version!==generation)return;const empty=config.type==='tfng'&&!data.students.length;studentInput.innerHTML='<option value="">'+(empty?'Chưa có tên học viên được đồng bộ':'Chọn tên của bạn…')+'</option>'+data.students.map(s=>'<option value="'+s.studentRef+'">'+escape(s.name)+'</option>').join('');studentInput.disabled=empty;if(empty)error.textContent='Lớp đã mở bài. Danh sách học viên đang chờ đồng bộ; bạn hãy quay lại sau.';}catch(e){if(version===generation)error.textContent=e.message;}};
  const loadRoster=classInput.onchange;
  classInput.onchange=async()=>{await loadRoster();if(entryContext){for(const option of [...studentInput.options])if(option.value&&option.value!==entryContext.studentRef)option.remove();}};
  studentInput.onchange=()=>button.disabled=!studentInput.value;
  if(entryContext){classInput.value=entryContext.classId;classInput.disabled=true;classInput.onchange();}
  return new Promise(resolve=>{button.onclick=async()=>{button.disabled=true;error.textContent='';try{await login(classInput.value,studentInput.value,null,classes);resolve();}catch(e){error.textContent=e.message;button.disabled=false;}};});
 }
 // Reading thực chiến: đăng nhập ngay tại link Homework, giữ đúng học viên/lượt.
 async function teacherLogin(classId,studentRef){
  const app=document.querySelector('#app');
  app.innerHTML='<section class="access-card"><p class="kicker">GIẢNG VIÊN · READING 67</p><h1>Đăng nhập để xem bài</h1><p>Dùng tài khoản Google đã có quyền lớp. Đăng nhập xong sẽ mở ngay bài trong link Homework này.</p><label class="remember"><input type="checkbox" id="teacher-remember" checked> Tự đăng nhập Google trên thiết bị này</label><div id="google-button"></div><p id="teacher-error" role="status"></p>'+(config.demoGoogle?'<button class="primary" id="demo-teacher">Vào vai giảng viên thử</button>':'')+'</section>';
  window.MaterialsTeacherLogin?.render(app,config);
  return new Promise(resolve=>{
   const error=message=>{app.querySelector('#teacher-error').textContent=message;};
   const enter=async credential=>{try{
    await post('/teacher/login',{credential,remember:app.querySelector('#teacher-remember').checked});
    const work=await request('/teacher/work/'+encodeURIComponent(classId)+'/'+encodeURIComponent(studentRef));
    window.MaterialsTeacherLogin?.clear();
    resolve({teacher:true,work,config});
   }catch(e){error(e.message);}};
   if(config.demoGoogle){app.querySelector('#demo-teacher').onclick=()=>enter('demo-teacher-allowed');return;}
   const start=()=>{window.google.accounts.id.initialize({client_id:config.googleClientId,callback:value=>enter(value.credential)});window.google.accounts.id.renderButton(app.querySelector('#google-button'),{theme:'outline',size:'large',text:'signin_with'});};
   if(window.google?.accounts?.id)start();else{const script=document.createElement('script');script.src='https://accounts.google.com/gsi/client';script.onload=start;script.onerror=()=>error('Chưa tải được đăng nhập Google. Hãy tải lại trang.');document.head.append(script);}
  });
 }
 async function open(){
  try{config=await request('/config');}catch(e){if(e.status===404)return {legacy:true};throw e;}
  if(params.get('assignmentCode')&&params.get('assignmentCode')!==config.code)throw Error('Mã trong link không khớp bài đang mở. Hãy dùng lại CTA trong Homework.');
  key='reading67:session:'+config.code;
  const teacherIntent=teacher||params.get('mode')==='teacher'||params.has('classId')||params.has('studentRef');
  const studentIntent=!!config.ownerEntry&&!teacherIntent;
  if(studentIntent&&params.has('documentId')){
   entryDocument=params.get('documentId');
   const value=await request('/entry?'+new URLSearchParams({documentId:entryDocument}));entryContext=value.entry;
   const entryClasses=config.ownerEntry.classes||[config.ownerEntry];
   if(!entryContext||entryContext.documentId!==entryDocument||entryContext.code!==config.code||!entryClasses.some(c=>c.classId===entryContext.classId&&c.classCode===entryContext.classCode))throw Error(entryErrors.HOMEWORK_ENTRY_NOT_FOUND);
  }
  // Phiên máy chủ quyết định vai trò; query cũ không cấp quyền hoặc đổi người học.
  if(config.autoRole&&!studentIntent){
   const classId=params.get('classId'),studentRef=params.get('studentRef');
   const studentEntry=!teacher&&params.get('mode')!=='teacher'&&!classId&&!studentRef;
   teacher=true;
   try{
    if(classId&&studentRef)return {teacher:true,work:await request('/teacher/work/'+encodeURIComponent(classId)+'/'+encodeURIComponent(studentRef)),config};
    await request('/teacher/classes');
    location.replace('teacher.html');return new Promise(()=>{});
   }catch(error){
    // A denied teacher probe does not revoke separate student access. Explicit
    // teacher links stay denied; the student path still verifies membership.
    if(error.status!==401&&!(error.status===403&&studentEntry))throw error;
    teacher=false;
    if(params.get('mode')==='teacher'||config.ownerEntry&&teacherIntent){
     teacher=true;
     if(classId&&studentRef)return teacherLogin(classId,studentRef);
     location.replace('teacher.html');return new Promise(()=>{});
    }
   }
  }
  if(teacher){
   const classId=params.get('classId'),studentRef=params.get('studentRef');if(!classId||!studentRef)throw Error('Mở từ trang Giảng viên để chọn đúng lớp và học viên.');
   try{return {teacher:true,work:await request('/teacher/work/'+encodeURIComponent(classId)+'/'+encodeURIComponent(studentRef)),config};}
   catch(error){if(error.status!==401)throw error;return teacherLogin(classId,studentRef);}
  }
  if(config.studentsOpen===false)throw Error('Bài này đang được giảng viên chuẩn bị, chưa mở cho học viên. Bạn hãy quay lại khi lớp nhận Homework Lesson '+(config.lesson||10)+'.');
  const {createCourseStudentIdentity}=await import('../shared/course-student-identity.js?v=20261018-identity-v1');
  course=createCourseStudentIdentity({product:'reading-skills67',entry:config.code,requestIdentity:value=>post('/identity/resolve',value)});
  course.subscribe(()=>{if(person)window.dispatchEvent(new CustomEvent('reading67:access-warning',{detail:'Người đã nhớ ở tab khác vừa đổi. Bài tại tab này vẫn giữ đúng người.'}));});
  let saved;try{saved=JSON.parse(sessionStorage.getItem(key)||'null');}catch{saved=null;}
  if(saved&&sameEntry(saved.person?.courseId,saved.person?.ownerId)&&course.canRestoreSession()){
   token=saved.token;
   try{const check=await request('/lesson');if(check.identity.ownerId!==saved.person.ownerId||check.identity.courseId!==saved.person.courseId)throw Error('Chủ phiên không khớp.');person=check.identity;return {config};}
   catch(e){token='';if(e.status!==401&&e.status!==403)throw e;sessionStorage.removeItem(key);}
  }
  const classes=(await request('/classes')).classes;
  if(config.demo&&params.get('demoReview')==='1'){await login(config.demoStudent.classId,config.demoStudent.studentRef,null,classes);return {config};}
  if(!config.demo){const selection=await course.resolve({...(entryContext?{classCode:entryContext.classCode}:{}),allowedClassCodes:classes.map(c=>c.classCode)}).catch(()=>({status:'unavailable'}));if(selection.status==='unique'&&sameEntry(selection.alias.classId,selection.alias.studentRef)){await login(selection.alias.classId,selection.alias.studentRef,selection,classes);return {config};}}
  await choose(classes);return {config};
 }
 function teacherEntryUrl(){
  if(!entryContext)return null;
  const target=new URL(location.href);target.searchParams.set('teacher','1');target.searchParams.set('mode','teacher');target.searchParams.set('classId',entryContext.classId);target.searchParams.set('studentRef',entryContext.studentRef);target.searchParams.delete('fresh');return target.href;
 }
 async function change(){
  if(!config.demo){const forgotten=await course.forget();if(forgotten.status!=='empty')throw Error('Chưa đổi được người; nháp vẫn được giữ.');}
  await post('/student/logout',{});sessionStorage.removeItem(key);token='';person=null;
  if(entryContext){const target=new URL(location.href);target.searchParams.set('mode','student');target.searchParams.set('documentId',entryDocument);target.searchParams.set('fresh','1');location.href=target.href;}
  else location.href=location.pathname+'?server=1';
 }
 window.Reading67Access={open,request,change,get config(){return config;},get person(){return person;},get headers(){return token&&!teacher?{...entryHeaders(),Authorization:'Bearer '+token}:entryHeaders();},get teacherEntryUrl(){return teacherEntryUrl();},get teacherPath(){return '/teacher/work/'+encodeURIComponent(params.get('classId'))+'/'+encodeURIComponent(params.get('studentRef'));},get teacher(){return teacher;}};
}());

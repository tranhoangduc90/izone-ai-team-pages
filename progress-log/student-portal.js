import {createCourseStudentIdentity,requestMappingStudentIdentity} from '../shared/course-student-identity.js?v=20261018-identity-v1';
import {stampProgressStudent,markProgressLogout,progressPinWasLoggedOut} from './student-session-memory.js?rev=20261030-the20-v2';
const config=window.PROGRESS_LOG_CONFIG,byId=id=>document.getElementById(id);
const [status,identityView,home,classSelect,studentSelect,remember,enter,retry,logout]=['portalStatus','portalIdentity','portalHome','portalClass','portalStudent','portalRemember','portalContinue','portalRetry','portalLogout'].map(byId);
const identity=createCourseStudentIdentity({product:'progress-log',entry:'portal',requestIdentity:input=>requestMappingStudentIdentity(input,config.API_BASE_URL)});
let classes=[],context=null,generation=0,bootGeneration=0,controller=null,busy=false,currentStudent=null;
const notice=text=>{status.textContent=text;};
async function request(path,body,signal){
  const response=await fetch(config.API_BASE_URL+'/api/learning'+path,{method:body?'POST':'GET',headers:body?{'content-type':'application/json'}:{},
    ...(body?{body:JSON.stringify(body)}:{}),cache:'no-store',referrerPolicy:'no-referrer',signal});
  const data=await response.json().catch(()=>null);if(!response.ok||!data?.ok)throw Error(data?.message||'Chưa đọc được dữ liệu học viên.');return data;
}
function chooseView(){home.hidden=true;identityView.hidden=false;logout.hidden=true;currentStudent=null;}
function lastClass(){try{return localStorage.getItem('izone:progress-log:class:v1')||'';}catch{return '';}}
function rememberClass(id){try{localStorage.setItem('izone:progress-log:class:v1',id);}catch{/* Lựa chọn phiên hiện tại vẫn dùng được. */}}
function validStudent(value){return value&&/^[0-9a-f-]{36}$/iu.test(value.studentRef)&&/^[0-9a-f-]{36}$/iu.test(value.publicToken)&&typeof value.name==='string';}
async function loadClass(){
  controller?.abort();const version=++generation;controller=new AbortController();const current=()=>version===generation;
  context=null;studentSelect.replaceChildren(new Option('Chọn tên của em',''));studentSelect.disabled=true;enter.disabled=true;
  if(!classSelect.value)return;
  notice('Đang đọc danh sách học viên…');const activeController=controller,timer=setTimeout(()=>activeController.abort(),15000);
  try{
    const data=await request('/student/portal-context',{classId:classSelect.value},activeController.signal);
    if(!current())return;
    if(String(data.class?.classId)!==classSelect.value||!Array.isArray(data.students)||data.students.some(s=>!validStudent(s)))throw Error('Danh sách học viên chưa khớp lớp.');
    context=data;studentSelect.replaceChildren(new Option('Chọn tên của em',''),...data.students.map(student=>new Option(student.name+(student.discriminator?' · '+student.discriminator:''),student.studentRef)));
    studentSelect.disabled=false;notice('Chọn đúng tên của em để tiếp tục.');
  }catch(error){if(current()){notice(activeController.signal.aborted?'Quá thời gian chờ danh sách. Em có thể thử lại.':error.message);retry.hidden=false;}}
  finally{clearTimeout(timer);}
}
async function openStudent({selection=null}={}){
  if(busy||!context)return;
  const student=context.students.find(s=>s.studentRef===studentSelect.value);if(!student)return;
  const selectedContext=context,version=generation,snapshot=selection?identity.automaticContext(selection):identity.prepare(student.studentRef,selectedContext.class.name);
  const current=()=>version===generation&&context===selectedContext&&studentSelect.value===student.studentRef;
  busy=true;enter.disabled=true;classSelect.disabled=studentSelect.disabled=true;notice('Đang mở Progress Log của em…');
  const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),15000);
  try{
    const {journey}=await request('/student/course-journey',{publicToken:student.publicToken,studentRef:student.studentRef,identityConfirmed:true},abort.signal);
    if(!current())return;
    if(journey.student?.studentRef!==student.studentRef||String(journey.class?.classId)!==String(selectedContext.class.classId))throw Error('Hành trình chưa khớp người và lớp.');
    if(selection&&!identity.isCurrent(selection))throw Error('Người đã nhớ vừa đổi. Em hãy chọn lại tên.');
    const saved=await identity.commit(snapshot,{automatic:Boolean(selection),remember:remember.checked});
    if(!current()||saved.status==='changed')return;
    identity.pin(student.studentRef,{classRef:selectedContext.class.classId});stampProgressStudent();rememberClass(selectedContext.class.classId);
    currentStudent=student;byId('portalName').textContent=student.name;byId('portalClassName').textContent=journey.class.name;
    for(const [id,view] of [['portalSessions','sessions'],['portalJourney','journey']]){
      const url=new URL('./thuy.html',location.href);url.hash=new URLSearchParams({assignment:student.publicToken,student:student.studentRef,view});byId(id).href=url.href;
    }
    identityView.hidden=true;home.hidden=false;logout.hidden=false;retry.hidden=true;
    notice(['ok','empty'].includes(saved.status)?'':'Em đã vào đúng người. Thiết bị chưa lưu được ghi nhớ cho lần sau.');
  }catch(error){if(current()){chooseView();notice(abort.signal.aborted?'Quá thời gian chờ. Em hãy thử lại.':error.message);retry.hidden=false;}}
  finally{clearTimeout(timer);if(current()){busy=false;classSelect.disabled=false;studentSelect.disabled=false;enter.disabled=!studentSelect.value;}}
}
async function boot(){
  controller?.abort();generation++;const bootVersion=++bootGeneration;busy=false;home.hidden=identityView.hidden=logout.hidden=true;currentStudent=null;retry.hidden=true;classSelect.disabled=true;notice('Đang kiểm tra người đã ghi nhớ…');
  const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),15000);
  try{
    const data=await request('/student/portal-classes',null,abort.signal);if(bootVersion!==bootGeneration)return;classes=data.classes;
    if(!Array.isArray(classes)||classes.some(c=>!/^\d{1,19}$/u.test(c.classId)||typeof c.name!=='string'))throw Error('Danh sách lớp chưa hợp lệ.');
    classSelect.replaceChildren(new Option('Chọn lớp của em',''),...classes.map(c=>new Option(c.name,c.classId)));classSelect.disabled=false;
    const previous=classes.find(c=>c.classId===lastClass());if(previous)classSelect.value=previous.classId;
    let selection=null;
    if(!progressPinWasLoggedOut())try{selection=await identity.resolve({classCode:previous?.name||'',allowedClassCodes:classes.map(c=>c.name)});}catch{notice('Chưa kiểm được người đã nhớ. Em vẫn có thể chọn lớp và tên.');}
    if(bootVersion!==bootGeneration)return;
    if(selection?.status==='unique'){
      const match=classes.find(c=>c.classId===selection.alias.classId);if(match){classSelect.value=match.classId;await loadClass();
        if(context?.students.some(s=>s.studentRef===selection.alias.studentRef)){studentSelect.value=selection.alias.studentRef;await openStudent({selection});return;}}
    }
    identityView.hidden=false;if(classSelect.value)await loadClass();else notice(classes.length?'Chọn lớp và tên của em để tiếp tục.':'Chưa có lớp được giao phiếu Progress Log.');
  }catch(error){if(bootVersion===bootGeneration){chooseView();notice(abort.signal.aborted?'Quá thời gian chờ mở Progress Log.':error.message);retry.hidden=false;}}
  finally{clearTimeout(timer);if(bootVersion===bootGeneration&&home.hidden)identityView.hidden=false;}
}
classSelect.addEventListener('change',()=>{identity.invalidate();void loadClass();});
studentSelect.addEventListener('change',()=>{identity.invalidate();enter.disabled=!studentSelect.value;});
enter.addEventListener('click',()=>void openStudent());retry.addEventListener('click',()=>void boot());
logout.addEventListener('click',async()=>{
  if(busy)return;busy=true;const result=await identity.forget();
  if(result.status!=='empty'){busy=false;notice('Chưa xóa được ghi nhớ. Em hãy thử lại.');return;}
  markProgressLogout();generation++;bootGeneration++;controller?.abort();chooseView();studentSelect.value='';enter.disabled=true;busy=false;notice('Đã đăng xuất. Em hãy chọn lại lớp và tên.');
});
identity.subscribe(()=>{if(currentStudent)notice('Người đã ghi nhớ vừa đổi ở tab khác. Màn này vẫn giữ người đang xem; chọn Đăng xuất để đổi người.');});
window.addEventListener('pageshow',event=>{if(event.persisted&&progressPinWasLoggedOut())void boot();});
void boot();

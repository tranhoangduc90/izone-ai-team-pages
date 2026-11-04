import {createStudentIdentityMemory} from '../shared/student-identity.js?v=20261018-identity-v1';
import {createStudentIdentityClient} from '../shared/student-identity-client.js?v=20261018-identity-v1';
import {requestMappingStudentIdentity} from '../shared/course-student-identity.js?v=20261018-identity-v1';

const api='https://ducizone.ddns.net/rl67-cta-confirmation-api/v1';
const $=id=>document.getElementById(id);
const id=location.hash.slice(1);
const uuid=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const identity=createStudentIdentityClient({memory:createStudentIdentityMemory(),requestIdentity:requestMappingStudentIdentity});
const dialog=$('confirmation');
let offer, selected, snapshot, busy=false;

async function request(path,input) {
  const response=await fetch(api+'/'+path,{
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,...input}),
    cache:'no-store',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(path==='confirm'?41000:28000),
  });
  const data=await response.json();
  if(!response.ok||data.ok!==true) throw new Error(data.message||'Chưa kiểm được bài. Hãy thử tải lại.');
  return data;
}

function navigate(value) {
  const url=new URL(value);
  if(url.origin!==location.origin||!/^\/izone-ai-team-pages\/(reading-skills67|listening-homework|reading-practice|listening-practice)\//.test(url.pathname))
    throw new Error('Link bài chưa hợp lệ. Hãy mở lại từ Classroom.');
  location.replace(url.href);
}

function openConfirm(event) {
  event.preventDefault();
  if(busy||dialog.open) return;
  selected=offer?.students.find(person=>person.studentRef===$('student').value);
  if(!selected) return;
  snapshot=identity.captureSelection();
  $('summary').textContent=`Bạn xác nhận tài khoản Google ${offer.account} là của bạn, với họ và tên ${selected.name}, lớp ${offer.classCode}?`;
  dialog.showModal();
  $('back').focus();
}

$('selection').addEventListener('submit',openConfirm);
$('student').addEventListener('change',()=>{$('next').disabled=!$('student').value;});
$('back').addEventListener('click',()=>dialog.close());
dialog.addEventListener('close',()=>$('next').focus());
$('confirm').addEventListener('click',async()=>{
  if(!selected||busy) return;
  busy=true;
  $('confirm').disabled=true;
  $('next').disabled=true;
  dialog.close();
  $('status').textContent='Đang ghi nhớ thông tin đăng nhập của bạn…';
  try {
    const result=await request('confirm',{studentRef:selected.studentRef,token:selected.token});
    if(result.state!=='linked'||result.studentRef!==selected.studentRef||result.classCode!==offer.classCode)
      throw new Error('Kết quả xác nhận chưa khớp hồ sơ đã chọn.');
    await identity.rememberSelection({studentRef:result.studentRef,classHint:result.classCode},snapshot).catch(()=>{});
    navigate(result.entryUrl);
  } catch(error) {
    $('status').textContent=error.message;
  } finally {
    busy=false;
    $('confirm').disabled=false;
    $('next').disabled=!$('student').value;
  }
});

try {
  if(!uuid.test(id)) throw new Error('Hãy mở link xác nhận từ bản bài được giao trong Classroom.');
  offer=await request('form');
  if(offer.state==='linked') navigate(offer.entryUrl);
  else if(offer.state==='choose'&&Array.isArray(offer.students)) {
    $('status').textContent=offer.students.length?`Lớp ${offer.classCode}`:'Bạn có thể chọn tên từ danh sách lớp.';
    const fallback=$('fallback');
    fallback.hidden=false;
    fallback.href='#';
    fallback.addEventListener('click',event=>{event.preventDefault();if(!busy)navigate(offer.fallbackUrl);});
    if(offer.students.length) {
      $('account').textContent='Bài này được giao cho tài khoản Google '+offer.account;
      for(const person of offer.students) $('student').add(new Option(person.name,person.studentRef));
      $('selection').hidden=false;
    }
  } else throw new Error('Chưa nhận được màn xác nhận hợp lệ.');
} catch(error) { $('status').textContent=error.message; }

// Controller vẫn giữ danh sách học viên; phần này không cấp quyền hoặc tạo lượt thi.
// Xử lý sự kiện tại cùng một nơi để thao tác thật và sự kiện mô phỏng đi cùng luồng.
export function createRosterFeedback(student,reload,status){
 const rosterStatus=status??document.createElement('span'),retry=document.createElement('button');
 rosterStatus.setAttribute('role','status');
 retry.type='button';
 retry.className='button button-secondary';
 retry.textContent='Thử lại tải danh sách';
 retry.hidden=true;
 retry.onclick=reload;
 const field=student.closest('label')??student;
 if(status)field.after(retry);
 else field.after(rosterStatus,retry);
 return (message='',canRetry=false)=>{
  rosterStatus.textContent=message;
  retry.hidden=!canRetry;
 };
}

export function restorePreparedSelection(state,classSelect,studentSelect){
 if(!state?.prepareOperation||state.startedAt||state.sealed||classSelect.value||studentSelect.value)return;
 const classCode=state.identity?.classCode??state.classCode;
 const studentRef=state.identity?.studentRef??state.studentRef;
 if(!classCode||!studentRef)return;
 classSelect.replaceChildren(new Option(classCode,classCode));
 studentSelect.replaceChildren(new Option(state.name||'Học viên đã xác nhận',studentRef));
 classSelect.value=classCode;
 studentSelect.value=studentRef;
 classSelect.disabled=studentSelect.disabled=true;
}

export function bindIdentitySelection({loadRoster,onRoster,onConfirm,isBusy=()=>false}){
 const $=id=>document.getElementById(id),classSelect=$('class'),student=$('student'),prepare=$('prepare'),dialog=$('confirm-identity');
 const feedback=createRosterFeedback(student,chooseClass);
 let request=0,currentClass=classSelect.value,students=[],confirmedRef='';
 const selected=()=>students.find(person=>person.studentRef===student.value);
 function clearSelection(){
  student.value='';prepare.disabled=true;confirmedRef='';
 }
 function cancel(){
  dialog.close();clearSelection();student.focus();
 }
 function confirmSelection(){
  if(isBusy())return;
  const person=selected();prepare.disabled=!person;
  if(!person)return;
  $('confirm-name').textContent=person.name;$('confirm-class').textContent=currentClass;
  if(!dialog.open)dialog.showModal();
 }
 async function chooseClass(){
  if(isBusy()){classSelect.value=currentClass;return;}
  currentClass=classSelect.value;const code=currentClass,version=++request;
  if(dialog.open)dialog.close();
  students=[];onRoster(students);clearSelection();
  feedback(code?'Đang tải danh sách học viên…':'');
  student.replaceChildren(new Option(code?'Đang tải danh sách…':'Chọn lớp trước',''));student.disabled=true;
  $('start').disabled=true;$('preview').disabled=true;$('heard').checked=false;
  if(!code)return;
  try{
   const rows=await loadRoster(code);
   if(version!==request||classSelect.value!==code)return;
   if(!Array.isArray(rows))throw new Error('ROSTER_RESPONSE_INVALID');
   students=rows;onRoster(rows);
   student.replaceChildren(new Option(rows.length?'Chọn họ tên':'Không có học viên đủ điều kiện',''));
   for(const person of rows)student.add(new Option(person.name,person.studentRef));
   student.disabled=!rows.length;
   feedback(rows.length?'':'Không có học viên đủ điều kiện trong lớp này.');
  }catch(error){
   if(version!==request||classSelect.value!==code)return;
   student.replaceChildren(new Option('Chưa tải được danh sách',''));
   if(error?.code==='CLASS_NOT_ELIGIBLE'){
    feedback('Lớp này chưa có quyền dự thi bài này. Hãy chọn lớp khác.');
    return;
   }
   feedback('Không tải được danh sách học viên.',true);
  }
 }
 classSelect.onchange=chooseClass;
 student.onchange=()=>{
  if(isBusy()){student.value=confirmedRef;return;}
  prepare.disabled=!selected();confirmSelection();
 };
 prepare.onclick=confirmSelection;
 $('confirm-no').onclick=cancel;
 dialog.addEventListener('cancel',event=>{event.preventDefault();cancel();});
 $('confirm-yes').onclick=()=>{
  if(isBusy()||!dialog.open||!selected())return;
  confirmedRef=student.value;dialog.close();void onConfirm();
 };
}

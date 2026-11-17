// Controller vẫn giữ danh sách học viên; phần này không cấp quyền hoặc tạo lượt thi.
// Xử lý sự kiện tại cùng một nơi để thao tác thật và sự kiện mô phỏng đi cùng luồng.
export function bindIdentitySelection({loadRoster,onRoster,onConfirm,onError,isBusy=()=>false}){
 const $=id=>document.getElementById(id),classSelect=$('class'),student=$('student'),prepare=$('prepare'),dialog=$('confirm-identity');
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
 classSelect.onchange=async()=>{
  if(isBusy()){classSelect.value=currentClass;return;}
  currentClass=classSelect.value;const code=currentClass,version=++request;
  if(dialog.open)dialog.close();
  students=[];onRoster(students);clearSelection();
  student.replaceChildren(new Option(code?'Chọn họ tên':'Chọn lớp trước',''));student.disabled=true;
  $('start').disabled=true;$('preview').disabled=true;$('heard').checked=false;
  if(!code)return;
  try{
   const rows=await loadRoster(code);
   if(version!==request||classSelect.value!==code)return;
   students=rows;onRoster(rows);
   for(const person of rows)student.add(new Option(person.name,person.studentRef));
   student.disabled=false;
   if(!rows.length){$('notice').textContent='Không còn học viên đủ điều kiện trong lớp này.';$('notice').hidden=false;}
  }catch(error){if(version===request&&classSelect.value===code)onError(error);}
 };
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

/* Nhận kết quả và nháp đúng chủ từ client; giữ nhận xét cũ khi sửa, không tự
   chấm đạt từ thao tác nhập. Giảng viên đổi cách xem vẫn chỉ đọc. */
(function(){
 'use strict';
 let bridge,repair=null,cursor=0,studentView=new URLSearchParams(location.search).get('view')==='student';
 const shown=new Set();
 const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function progress(attempt,content){
  if(attempt?.status!=='done')return null;
  if(attempt.progress)return attempt.progress;
  const rows=content.targets.map(t=>({id:t.id,status:attempt.result?.feedback?.[t.id]?.status}));
  if(rows.length!==20||new Set(rows.map(t=>t.id)).size!==20||rows.some(t=>!['correct','partial','incorrect','blank'].includes(t.status)))return null;
  const sections=new Set(content.questions.map(q=>q.targets.section));
  const matching=rows.filter(t=>sections.has(t.id)),compression=rows.filter(t=>!sections.has(t.id));
  const needsRepair=rows.filter(t=>t.status!=='correct').map(t=>t.id);
  return {matchingCorrect:matching.filter(t=>t.status==='correct').length,matchingTotal:matching.length,
   compressionCorrect:compression.filter(t=>t.status==='correct').length,compressionTotal:compression.length,
   total:rows.length,remainingCount:needsRepair.length,needsRepair,allCorrect:!needsRepair.length};
 }
 function description(p){return `Matching Information: đúng ${p.matchingCorrect}/${p.matchingTotal} câu. Phần nén: ${p.compressionCorrect}/${p.compressionTotal} phần đạt.`;}
 function next(){
  if(!repair?.progress.needsRepair.length)return;
  const ids=repair.progress.needsRepair;bridge.jump(ids[cursor++%ids.length]);
 }
 function decorate(){
  if(!bridge)return;
  const {state,teacher}=bridge.current();
  document.querySelectorAll('.repair-highlight').forEach(el=>el.classList.remove('repair-highlight'));
  document.querySelectorAll('.repair-field-note,.repair-banner,.attempt-context').forEach(el=>el.remove());
  document.body.classList.toggle('materials-student-view',teacher&&studentView);
  let role=document.querySelector('#materials-role-label');
  if(!role){role=document.createElement('span');role.id='materials-role-label';role.className='materials-role-label';document.querySelector('#teacher')?.before(role);}
  role.textContent=teacher?(studentView?'Giảng viên đang xem như học viên · Chỉ xem':'Giao diện giảng viên'):'Giao diện học viên';
  const grade=document.querySelector('#grade-button');if(grade&&state.status==='draft')grade.textContent=repair?'Nộp lại bài':'Nộp bài';
  const edit=document.querySelector('[data-action="edit"]');if(edit)edit.textContent='Tôi sẽ sửa';
  const selected=state.serverAttempt;
  if(selected){
   const notice=document.createElement('div');notice.className='notice attempt-context';
   const history=bridge.history()||[],latest=history[0];
   notice.append(document.createTextNode('Đang xem bản nộp lúc '+new Date(selected.createdAt).toLocaleString('vi-VN')+' · Lượt '+(selected.runNo||1)+'. '));
   if(latest&&latest.attemptId!==selected.attemptId&&(latest.runNo>selected.runNo||latest.draftRevision>selected.draftRevision)){const b=document.createElement('button');b.className='quiet';b.textContent='Xem bản mới nhất';b.onclick=()=>bridge.openAttempt(latest.attemptId);notice.append('Đã có bản nộp mới hơn. ',b);}
   const lastSubmitted=Math.max(selected.draftRevision,...history.map(a=>a.draftRevision||0));
   if(bridge.draftRevision()>lastSubmitted)notice.append(' Nháp hiện tại có thay đổi đã lưu, chưa nộp lại.');
   document.querySelector('.lesson-head')?.after(notice);
  }
  const current=selected?.status==='done'?{attempt:selected,progress:progress(selected,bridge.current().content)}:state.status==='draft'?repair:null;
  if(!current?.progress)return;
  const p=current.progress,banner=document.createElement('div');banner.className='notice repair-banner';banner.dataset.state=p.allCorrect?'success':'attention';banner.setAttribute('role','status');
  if(edit&&p.allCorrect)edit.textContent='Sửa bài';
  banner.append(document.createTextNode((p.allCorrect?'Đã đạt toàn bộ bài. ':`Còn ${p.remainingCount} phần cần sửa theo lần chấm gần nhất. `)+description(p)));
  if(!teacher&&!p.allCorrect){
   const button=document.createElement('button');button.className='secondary';button.textContent=state.status==='draft'?'Phần cần sửa tiếp theo':'Tôi sẽ sửa';
   button.onclick=()=>state.status==='draft'?next():bridge.edit();banner.append(' ',button);
  }
  document.querySelector('.lesson-head')?.after(banner);
  if(state.status!=='draft'||!repair)return;
  for(const id of p.needsRepair){
   const input=[...document.querySelectorAll('[data-target]')].find(el=>el.dataset.target===id);if(!input)continue;
   const field=input.closest('.answer-field,.selection-field')||input.parentElement;field.classList.add('repair-highlight');
   const note=document.createElement('p');note.className='repair-field-note';
   const changed=(state.answers[id]||'')!==(repair.attempt.snapshot.answers[id]||'');
   const label=document.createElement('span');label.textContent=changed?'Đã sửa — chờ chấm lại':'Cần sửa · '+(repair.attempt.result?.feedback?.[id]?.reason||'Đối chiếu lại câu trả lời.');note.append(label);
   field.append(note);
   if(repair.attempt.result?.feedback?.[id]){const b=document.createElement('button');b.className='quiet';b.textContent='Xem giải thích lần chấm trước';b.onclick=()=>bridge.explain(id,repair.attempt);note.append(' ',b);}
  }
 }
 function outcome(attempt,{announce=false}={}){
  const p=progress(attempt,bridge.current().content);if(!p)return;
  repair={attempt,progress:p};cursor=0;decorate();
  if(bridge.current().teacher||!announce||shown.has(attempt.attemptId))return;
  shown.add(attempt.attemptId);
  bridge.modal(p.allCorrect?'Chúc mừng! Bạn đã sửa đúng toàn bộ bài.':`Còn ${p.remainingCount} phần cần sửa`,
   '<p>Bài đã được lưu và chấm.</p><p>'+escape(description(p))+'</p>',
   p.allCorrect?'<button class="primary" data-close-modal>Xem kết quả</button>':'<button class="secondary" data-close-modal>Xem nhận xét</button><button class="primary" data-action="repair-edit">Tôi sẽ sửa</button>');
 }
 async function restore(history){
  const start=bridge.current().state;
  const latest=history.find(a=>a.runNo===bridge.runNo()&&a.status==='done');if(!latest)return;
  const attempt=await bridge.fetchAttempt(latest.attemptId);
  if(attempt.runNo!==bridge.runNo()||bridge.current().state!==start)return;
  const p=progress(attempt,bridge.current().content);if(p){repair={attempt,progress:p};decorate();}
 }
 async function menu(){
  if(!bridge){
   // Giữ đích bài ban đầu qua Google; teacher.js vẫn kiểm cùng origin/đúng trang.
   const target=new URL(location.href),login=new URL('teacher.html',location.href);
   if(target.searchParams.get('classId')&&target.searchParams.get('studentRef')){
    target.searchParams.set('server','1');target.searchParams.set('teacher','1');target.searchParams.set('mode','teacher');
    login.searchParams.set('returnTo',target.href);
   }
   location.href=login.href;return;
  }
  const {teacher}=bridge.current();
  bridge.modal('Chuyển giao diện',teacher?'<p>Phiên giảng viên vẫn chỉ có quyền xem. Chọn cách hiển thị bài đang mở.</p>':'<p>Bài đang mở thuộc học viên hiện tại. Vào giao diện giảng viên bằng tài khoản Google có quyền.</p>',
   teacher?'<button class="secondary" data-materials-view="teacher">Giao diện giảng viên</button><button class="primary" data-materials-view="student">Xem như học viên · Chỉ xem</button><button class="quiet" data-materials-dashboard>Danh sách học viên</button><button class="quiet" data-materials-logout>Đăng xuất giảng viên</button>':'<button class="primary" data-materials-login>Đăng nhập giảng viên</button><button class="secondary" data-close-modal>Tiếp tục giao diện học viên</button>');
 }
 document.addEventListener('click',async event=>{
  const b=event.target.closest('button');if(!b)return;
  try{
   if(b.dataset.materialsView){studentView=b.dataset.materialsView==='student';const url=new URL(location.href);url.searchParams.set('view',studentView?'student':'teacher');window.history.replaceState(null,'',url);bridge.close();decorate();}
   if(b.hasAttribute('data-materials-dashboard'))location.href='teacher.html';
   if(b.hasAttribute('data-materials-login')){await bridge.flush();const url=new URL(location.href),person=bridge.identity();const linked=url.searchParams.get('teacher')==='1'&&url.searchParams.get('classId')&&url.searchParams.get('studentRef');url.searchParams.set('mode','teacher');url.searchParams.set('teacher','1');if(!linked){url.searchParams.set('classId',person.courseId);url.searchParams.set('studentRef',person.ownerId);}location.href=url.href;}
   if(b.hasAttribute('data-materials-logout')){await window.IzoneTeacherSso.logout();location.href=location.pathname+'?server=1';}
  }catch(error){bridge.toast('Chưa chuyển được giao diện: '+error.message);}
 });
 window.ReadingMaterialsExperience={bind(value){bridge=value;},decorate,outcome,restore,menu,next,
  get repair(){return repair;},clear(){repair=null;},progress};
}());

/* Nhận kết quả và nháp đúng chủ từ client; giữ nhận xét cũ khi sửa, không tự
   chấm đạt từ thao tác nhập. Giảng viên đổi cách xem vẫn chỉ đọc. */
(function(){
 'use strict';
 let bridge,repair=null,cursor=-1,navigationScope='',studentView=new URLSearchParams(location.search).get('view')==='student';
 const shown=new Set();
 const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function progress(attempt,content){
  if(attempt?.status!=='done')return null;
  if(attempt.progress)return attempt.progress;
  const rows=content.targets.map(t=>({id:t.id,status:attempt.result?.feedback?.[t.id]?.status}));
  if(rows.length!==content.targets.length||new Set(rows.map(t=>t.id)).size!==content.targets.length||rows.some(t=>!['correct','partial','incorrect','blank'].includes(t.status)))return null;
  const sections=new Set(content.type==='matching_people'?content.targets.filter(t=>!['compressed_level_1','compressed_statement'].includes(t.kind)).map(t=>t.id):content.questions.map(q=>q.targets.section||q.targets.answer));
  const matching=rows.filter(t=>sections.has(t.id)),compression=rows.filter(t=>!sections.has(t.id));
  const needsRepair=rows.filter(t=>t.status!=='correct').map(t=>t.id);
  return {kind:content.type==='green-roofs'?'green-roofs':undefined,matchingCorrect:matching.filter(t=>t.status==='correct').length,matchingTotal:matching.length,
   compressionCorrect:compression.filter(t=>t.status==='correct').length,compressionTotal:compression.length,
   total:rows.length,remainingCount:needsRepair.length,needsRepair,allCorrect:!needsRepair.length};
 }
 function description(p){if(p.kind==='sentence_completion')return `Đáp án: ${p.matchingCorrect}/4. Phân tích từ khóa: ${p.analysisCorrect}/20. Nén hai cấp: ${p.paragraphCorrect}/4 phần đạt.`;if(p.kind==='tfng')return `Kết luận toàn câu: ${p.conclusionCorrect}/${p.conclusionTotal}. T/F/NG theo mảnh: ${p.labelCorrect}/${p.labelTotal}. Nội dung đối chiếu: ${p.evidenceCorrect}/${p.evidenceTotal}.`;return `${bridge?.current().content.type==='matching_people'?'Chọn người, đoạn và câu khớp':p.kind==='green-roofs'?'Multiple choice':bridge?.current().content.type==='matching_headings'?'Matching Headings':'Matching Information'}: đúng ${p.matchingCorrect}/${p.matchingTotal} ${bridge?.current().content.type==='matching_people'?'phần':'câu'}. Phần nén: ${p.compressionCorrect}/${p.compressionTotal} phần đạt.`;}
 function navigation(){
  if(!bridge)return null;
  const {state,content}=bridge.current();
  const attempt=state.serverAttempt?.status==='done'?state.serverAttempt:state.status==='draft'?repair?.attempt:null;
  const p=progress(attempt,content);if(!p)return null;
  const needed=new Set(p.needsRepair);
  return {attempt,progress:p,items:content.targets.filter(t=>needed.has(t.id))};
 }
 function move(offset=0){
  const nav=navigation();if(!nav?.items.length)return;
  if(navigationScope!==nav.attempt.attemptId){navigationScope=nav.attempt.attemptId;cursor=-1;}
  cursor=cursor<0?0:Math.max(0,Math.min(nav.items.length-1,cursor+offset));
  decorate();bridge.jump(nav.items[cursor].id);window.MaterialsRepairWorkspace?.afterMove();
 }
 function start(){cursor=-1;move();}
 function next(){move(1);}
 function previous(){move(-1);}
 function targetLabel(id,content){
  if(['tfng','green-roofs','matching_headings','matching_people','sentence_completion'].includes(content.type))return content.targets.find(t=>t.id===id)?.label||'Phần trả lời';
  const paragraph=content.paragraphs.find(p=>p.target===id);if(paragraph)return 'Nén cấp 1 đoạn '+paragraph.id;
  const question=content.questions.find(q=>Object.values(q.targets).includes(id));
  if(!question)return content.targets.find(t=>t.id===id)?.label||'Phần trả lời';
  return (question.targets.radar===id?'Nén thông tin câu hỏi ':question.targets.section===id?'Đáp án câu ':'Nén dẫn chứng câu ')+question.number;
 }
 function navigationBar(anchor,nav,content){
  if(window.MaterialsRepairWorkspace){
   window.MaterialsRepairWorkspace.render({bridge,nav,content,cursor,label:targetLabel,move,go:id=>{const index=nav.items.findIndex(t=>t.id===id);if(index>=0){cursor=index;move();}}});return;
  }
  if(cursor<0||!nav.items.length)return;
  cursor=Math.min(cursor,nav.items.length-1);
  const bar=document.createElement('nav');bar.className='repair-navigation';bar.setAttribute('aria-label','Điều hướng phần cần sửa');
  const back=document.createElement('button');back.type='button';back.className='secondary';back.textContent='← Trước';back.setAttribute('aria-label','Phần cần sửa trước');back.disabled=cursor===0;back.onclick=previous;
  const position=document.createElement('strong');position.id='repair-position';position.setAttribute('role','status');position.setAttribute('aria-live','polite');position.textContent='Phần cần sửa '+(cursor+1)+'/'+nav.items.length;
  const forward=document.createElement('button');forward.type='button';forward.className='secondary';forward.textContent='Tiếp →';forward.setAttribute('aria-label','Phần cần sửa tiếp theo');forward.disabled=cursor===nav.items.length-1;forward.onclick=next;
  const label=document.createElement('span');label.className='repair-current-label';label.textContent=targetLabel(nav.items[cursor].id,content);
  bar.append(back,position,forward,label);anchor.after(bar);
  const input=[...document.querySelectorAll('[data-target]')].find(el=>el.dataset.target===nav.items[cursor].id);
  const field=input?.closest('.answer-field,.selection-field');
  if(field){field.classList.add('repair-current');field.dataset.repairTarget=nav.items[cursor].id;field.setAttribute('aria-current','step');}
 }
 function editLabel(){return 'Sửa bài';}
 function decorate(){
  if(!bridge)return;
  const {state,teacher}=bridge.current();
  window.MaterialsRepairWorkspace?.detachSync();
  document.querySelectorAll('.repair-highlight').forEach(el=>el.classList.remove('repair-highlight'));
  document.querySelectorAll('.repair-current').forEach(el=>{el.classList.remove('repair-current');delete el.dataset.repairTarget;el.removeAttribute('aria-current');});
  document.querySelectorAll('.repair-field-note,.repair-banner,.attempt-context,.repair-navigation:not(.repair-docked)').forEach(el=>el.remove());
  document.body.classList.toggle('materials-student-view',teacher&&studentView);
  let role=document.querySelector('#materials-role-label');
  if(!role){role=document.createElement('span');role.id='materials-role-label';role.className='materials-role-label';document.querySelector('#teacher')?.before(role);}
  role.textContent=teacher?(studentView?'Giảng viên đang xem như học viên · Chỉ xem':'Giao diện giảng viên'):'Giao diện học viên';
  role.hidden=!teacher&&document.body.classList.contains('homework-concise');
  const grade=document.querySelector('#grade-button');if(grade&&state.status==='draft')grade.textContent=repair?'Nộp lại bài':'Nộp bài';
  const edit=document.querySelector('[data-action="edit"]');if(edit)edit.textContent=editLabel();
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
  if(!current?.progress){window.MaterialsRepairWorkspace?.deactivate();return;}
  if(navigationScope!==current.attempt.attemptId){navigationScope=current.attempt.attemptId;cursor=-1;}
  const nav=navigation();
  if(nav){const restored=window.MaterialsRepairWorkspace?.prepare(nav,bridge);if(restored!==null&&restored!==undefined)cursor=restored;}
  const trigger=document.querySelector('[data-action="repair-start"]');if(trigger)trigger.hidden=cursor>=0;
  const p=current.progress,banner=document.createElement('div');banner.className='notice repair-banner';banner.dataset.state=p.allCorrect?'success':'attention';banner.setAttribute('role','status');
  if(edit&&p.allCorrect)edit.textContent='Sửa bài';
  const headline=p.allCorrect?'Đã đạt toàn bộ bài. ':`Còn ${p.remainingCount} phần cần sửa theo lần chấm gần nhất. `;
  banner.append(document.createTextNode(headline+(document.body.classList.contains('homework-concise')?'':description(p))));
  if(document.body.classList.contains('homework-concise')){
   const detail=document.createElement('details');detail.className='repair-summary-detail';
   const title=document.createElement('summary');title.textContent='Chi tiết kết quả';
   const text=document.createElement('p');text.textContent=description(p);detail.append(title,text);banner.append(detail);
  }
  if(!teacher&&!p.allCorrect&&!(state.status==='draft'&&cursor>=0)){
   const button=document.createElement('button');button.className='secondary';button.textContent=state.status==='draft'?'Phần cần sửa tiếp theo':editLabel();
   button.onclick=()=>state.status==='draft'?next():bridge.edit();banner.append(' ',button);
  }
  document.querySelector('.lesson-head')?.after(banner);
  if(nav)navigationBar(banner,nav,bridge.current().content);
  if(state.status!=='draft'||!repair)return;
  for(const id of p.needsRepair){
   const input=[...document.querySelectorAll('[data-target]')].find(el=>el.dataset.target===id);if(!input)continue;
   const field=input.closest('.answer-field,.selection-field')||input.parentElement;field.classList.add('repair-highlight');
   const note=document.createElement('p');note.className='repair-field-note';
   const changed=(state.answers[id]||'')!==(repair.attempt.snapshot.answers[id]||'');
   const label=document.createElement('span');label.textContent=changed?'Đã sửa — chờ chấm lại':'Chưa chỉnh · Cần sửa';note.append(label);
   const reason=document.createElement('p');reason.className='repair-previous-reason';reason.textContent='Nhận xét lần chấm trước: '+(repair.attempt.result?.feedback?.[id]?.reason||'Đối chiếu lại câu trả lời.');note.append(reason);
   field.append(note);
   if(repair.attempt.result?.feedback?.[id]){const b=document.createElement('button');b.className='quiet';b.textContent='Xem giải thích lần chấm trước';b.onclick=()=>bridge.explain(id,repair.attempt);note.append(' ',b);}
  }
 }
 function outcome(attempt,{announce=false}={}){
  const p=progress(attempt,bridge.current().content);if(!p)return;
  repair={attempt,progress:p};decorate();
  if(bridge.current().teacher||!announce||shown.has(attempt.attemptId))return;
  shown.add(attempt.attemptId);
  bridge.modal(p.allCorrect?'Chúc mừng! Bạn đã sửa đúng toàn bộ bài.':`Còn ${p.remainingCount} phần cần sửa`,
   '<p>Bài đã được lưu và chấm.</p><p>'+escape(description(p))+'</p>',
   p.allCorrect?'<button class="primary" data-close-modal>Xem kết quả</button>':'<button class="secondary" data-close-modal>Xem nhận xét</button><button class="primary" data-action="repair-edit">'+escape(editLabel())+'</button>');
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
   const ownerLink=window.Reading67Access?.teacherEntryUrl;
   if(ownerLink){location.href=ownerLink;return;}
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
   if(b.dataset.materialsView){studentView=b.dataset.materialsView==='student';const url=new URL(location.href);url.searchParams.set('view',studentView?'student':'teacher');window.history.replaceState(null,'',url);bridge.close();decorate();if(cursor>=0)move();}
   if(b.hasAttribute('data-materials-dashboard'))location.href='teacher.html';
   if(b.hasAttribute('data-materials-login')){await bridge.flush();const url=new URL(location.href),person=bridge.identity();const linked=url.searchParams.get('teacher')==='1'&&url.searchParams.get('classId')&&url.searchParams.get('studentRef');url.searchParams.set('mode','teacher');url.searchParams.set('teacher','1');if(!linked){url.searchParams.set('classId',person.courseId);url.searchParams.set('studentRef',person.ownerId);}location.href=url.href;}
   if(b.hasAttribute('data-materials-logout')){await window.IzoneTeacherSso.logout();location.href=location.pathname+'?server=1';}
  }catch(error){bridge.toast('Chưa chuyển được giao diện: '+error.message);}
 });
 window.ReadingMaterialsExperience={bind(value){bridge=value;},decorate,outcome,restore,menu,start,next,previous,focusCurrent:()=>move(),
  get repair(){return repair;},clear(){repair=null;cursor=-1;navigationScope='';window.MaterialsRepairWorkspace?.deactivate();},progress};
}());

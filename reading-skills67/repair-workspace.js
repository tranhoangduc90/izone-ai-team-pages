/* Bố trí sửa bài và nhớ vị trí riêng trên thiết bị. Không ghi câu trả lời,
   không gọi API, không thay kết quả chấm hoặc quyền của người đang xem. */
(function(){
 'use strict';
 let current=null,key='',record={},pending=null,restoring=false,scrollTimer,explanationTarget=null;
 const $=selector=>document.querySelector(selector);
 const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const setText=(element,value)=>{if(element&&element.textContent!==value)element.textContent=value;};
 const offset=value=>Number.isFinite(value)&&value>=0?Math.min(value,10000000):0;
 const viewport=()=>({width:innerWidth,height:innerHeight,scale:parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--reading-scale'))||1});
 function field(id){return [...document.querySelectorAll('[data-target]')].find(el=>el.dataset.target===id);}
 function edits(){
  if(!current)return [];
  const {state,teacher}=current.bridge.current();
  return state.status==='draft'&&!teacher?current.nav.items.filter(t=>(state.answers[t.id]||'')!==(current.nav.attempt.snapshot.answers[t.id]||'')).map(t=>t.id):[];
 }
 function prepare(nav,bridge){
  const person=bridge.identity(),{content,teacher}=bridge.current();
  const next='izone:materials:repair-view:v1:'+JSON.stringify([person.ownerId,person.courseId,content.code,content.version,nav.attempt.runNo,nav.attempt.attemptId,teacher?'teacher':'student']);
  if(key===next)return null;
  key=next;record={};pending=null;explanationTarget=null;
  try{record=JSON.parse(localStorage.getItem(key)||'{}')||{};}catch{record={};}
  if(typeof record!=='object'||Array.isArray(record))record={};
  const index=nav.items.findIndex(t=>t.id===record.target);
  if(index>=0)pending={...record,key};
  return index;
 }
 function remember(){
  if(!current||!key||restoring)return;
  const item=current.nav.items[current.cursor];
  if(item){
   record.target=item.id;
   record.windowY=offset(window.scrollY);
   record.viewport=viewport();
   record.panes=Object.fromEntries(['passage','questions'].map(name=>[name,offset($('#scroll-'+name)?.scrollTop||0)]));
  }
  try{localStorage.setItem(key,JSON.stringify(record));}catch{/* Không nhớ được vị trí vẫn cho phép làm bài. */}
 }
 function afterMove(){requestAnimationFrame(()=>requestAnimationFrame(remember));}
 function hide(){
  document.body.classList.remove('has-repair-workspace');
  const footer=$('.study-footer'),tools=footer?.querySelector('.footer-tools');
  if(footer?.querySelector('.repair-actions')){
   const primary=footer.querySelector('.repair-primary-slot button');if(primary&&tools)tools.append(primary);
   const progress=footer.querySelector('.progress-area'),save=footer.querySelector('#save-state');
   if(progress){progress.hidden=false;footer.append(progress);}if(save)footer.append(save);if(tools)footer.append(tools);
   footer.querySelectorAll('.repair-actions,.repair-secondary').forEach(el=>el.remove());
  }
  const sync=$('.repair-sync .homework-sync');if(sync)$('.lesson-head')?.after(sync);
  $('.repair-sync')?.remove();
  document.querySelectorAll('.repair-source-context').forEach(el=>el.remove());
 }
 function updateSync(){
  if(!document.body.classList.contains('has-repair-workspace'))return;
  const notice=$('.homework-sync'),banner=$('.repair-banner');if(!notice||!banner)return;
  let details=banner.querySelector('.repair-sync');
  if(!details){details=document.createElement('details');details.className='repair-sync';const summary=document.createElement('summary');summary.textContent='Trạng thái Homework';details.append(summary);banner.append(details);}
  if(notice.parentElement!==details)details.append(notice);
 }
 function detachSync(){const notice=$('.repair-sync .homework-sync');if(notice)$('.lesson-head')?.after(notice);}
 function context(){
  document.querySelectorAll('.repair-source-context').forEach(el=>{if(el.dataset.repairContextFor!==current.nav.items[current.cursor]?.id)el.remove();});
  const item=current.nav.items[current.cursor],input=field(item?.id);if(!input)return;
  const {content,state}=current.bridge.current(),paragraph=content.paragraphs.find(p=>p.target===item.id||content.type==='matching_headings'&&p.id===item.paragraph||Object.values(p.targets||{}).includes(item.id)),question=content.questions.find(q=>Object.values(q.targets).includes(item.id));
  const chosen=question&&content.paragraphs.find(p=>p.id===(question.sourceParagraph||state.answers[question.targets.location||question.targets.section]));
  const signature=item.id+':'+(chosen?.id||'');
  let box=input.closest('.answer-field,.selection-field')?.querySelector('.repair-source-context');
  if(box?.dataset.signature===signature)return;
  const wasOpen=box?.querySelector('details')?.open||record.openSources?.[item.id];box?.remove();
  box=document.createElement('div');box.className='repair-source-context';box.dataset.repairContextFor=item.id;box.dataset.signature=signature;
  if(question){const q=document.createElement('p');q.className='repair-question-context';q.textContent='Câu '+question.number+': '+question.text;box.append(q);}
  const source=paragraph||chosen;
  if(source){
   const details=document.createElement('details'),summary=document.createElement('summary'),body=document.createElement('div');
   summary.textContent=paragraph?'Đối chiếu đoạn '+source.id:'Đối chiếu đoạn '+source.id+' bạn đã chọn';
   body.className='repair-source-text';body.textContent=source.text;body.tabIndex=0;body.setAttribute('role','region');body.setAttribute('aria-label','Nội dung đoạn '+source.id);details.append(summary,body);details.open=!!wasOpen;
   details.addEventListener('toggle',()=>{record.openSources={...record.openSources,[item.id]:details.open};remember();});box.append(details);
  }
  input.before(box);
 }
 function ensureDock(){
  const footer=$('.study-footer');if(!footer)return null;
  let dock=footer.querySelector('.repair-docked');if(dock)return dock;
  const tools=footer.querySelector('.footer-tools'),save=footer.querySelector('#save-state'),progress=footer.querySelector('.progress-area');
  if(progress)progress.hidden=true;
  const actions=document.createElement('div');actions.className='repair-actions';
  dock=document.createElement('nav');dock.className='repair-navigation repair-docked';dock.setAttribute('aria-label','Điều hướng phần cần sửa');
  dock.innerHTML='<button type="button" class="secondary" data-repair-direction="-1" aria-label="Phần cần sửa trước">← Trước</button><button type="button" class="quiet repair-counter" data-repair-list aria-label="Danh sách phần cần sửa"><strong id="repair-position" role="status" aria-live="polite"></strong><span class="repair-current-label"></span></button><button type="button" class="secondary" data-repair-direction="1" aria-label="Phần cần sửa tiếp theo">Tiếp →</button>';
  const primary=document.createElement('div');primary.className='repair-primary-slot';
  const hint=document.createElement('span');hint.className='repair-end-hint';primary.append(hint);
  const action=footer.querySelector('#grade-button,[data-action="edit"]');if(action)primary.append(action);
  actions.append(dock,primary);
  const secondary=document.createElement('div');secondary.className='repair-secondary';
  const status=document.createElement('div');status.className='repair-status';
  const changed=document.createElement('span');changed.className='repair-edit-progress';status.append(changed);if(save)status.append(save);
  secondary.append(status);if(tools)secondary.append(tools);footer.append(actions,secondary);
  return dock;
 }
 function render(value){
  current=value;
  if(value.cursor<0||!value.nav.items.length){hide();return;}
  const dock=ensureDock();if(!dock)return;
  document.body.classList.add('has-repair-workspace');
  const {state,teacher}=value.bridge.current(),changed=edits(),count=value.nav.items.length,item=value.nav.items[value.cursor];
  const answer=field(item.id),activeField=answer?.closest('.answer-field,.selection-field');
  if(activeField){activeField.classList.add('repair-current');activeField.dataset.repairTarget=item.id;activeField.setAttribute('aria-current','step');}
  const previous=dock.querySelector('[data-repair-direction="-1"]'),next=dock.querySelector('[data-repair-direction="1"]');
  previous.disabled=value.cursor===0;next.disabled=value.cursor===count-1;
  setText($('#repair-position'),(value.cursor+1)+'/'+count);
  $('#repair-position').setAttribute('aria-label','Phần cần sửa '+(value.cursor+1)+'/'+count);
  setText(dock.querySelector('.repair-current-label'),value.label(item.id,value.content));
  const progress=$('.repair-edit-progress');
  setText(progress,state.status==='draft'&&!teacher?'Đã chỉnh '+changed.length+'/'+count:count+' phần chưa đạt');
  progress.setAttribute('aria-label',state.status==='draft'&&!teacher?'Đã chỉnh '+changed.length+'/'+count+' phần, chờ nộp lại để chấm':count+' phần chưa đạt trong bản chấm');
  const primary=$('.repair-primary-slot');primary.hidden=!primary.querySelector('button');
  $('.repair-actions').classList.toggle('without-primary',primary.hidden);
  setText($('.repair-end-hint'),state.status==='draft'?(value.cursor===count-1?'Đã đến phần cuối':'Chấm bản sửa'):(value.cursor===count-1?'Đã xem phần cuối':'Mở nháp để sửa'));
  context();updateSync();
  if(pending){
   const saved=pending,savedKey=key;pending=null;restoring=true;
   value.bridge.jump(item.id);
   requestAnimationFrame(()=>requestAnimationFrame(()=>{
    const size=viewport();
    if(key===savedKey&&saved.viewport?.width===size.width&&saved.viewport?.height===size.height&&saved.viewport?.scale===size.scale){for(const name of ['passage','questions']){const pane=$('#scroll-'+name);if(pane)pane.scrollTop=offset(saved.panes?.[name]);}window.scrollTo({top:offset(saved.windowY),behavior:'instant'});}
    restoring=false;remember();
   }));
  }
 }
 function review(onlyUnchanged=false){
  if(!current?.nav.items.length)return false;
  const {state,teacher}=current.bridge.current(),changed=new Set(edits()),draft=state.status==='draft'&&!teacher;
  if(!['draft','review'].includes(state.status))return false;
  if(state.serverAttempt&&state.serverAttempt.attemptId!==current.nav.attempt.attemptId)return false;
  const items=current.nav.items.filter(t=>!onlyUnchanged||!changed.has(t.id));
  const summary=draft?'Đã chỉnh '+changed.size+'/'+current.nav.items.length+' phần. Các thay đổi vẫn cần nộp lại để chấm.':'Các phần chưa đạt theo bản chấm đang xem.';
  const rows=items.map(t=>'<button type="button" class="repair-list-item secondary" data-repair-go="'+esc(t.id)+'"><strong>'+esc(current.label(t.id,current.content))+'</strong><span>'+esc(draft?(changed.has(t.id)?'Đã chỉnh · Chờ chấm lại':'Chưa chỉnh'):'Cần sửa theo bản chấm')+'</span></button>').join('');
  const remaining=current.nav.items.filter(t=>!changed.has(t.id));
  current.bridge.modal('Rà soát phần cần sửa','<p class="repair-review-summary">'+esc(summary)+'</p><div class="repair-review-list">'+(rows||'<p>Mọi phần đã có thay đổi; chưa xác nhận đúng cho đến khi chấm lại.</p>')+'</div>',
   (draft&&remaining.length?'<button type="button" class="secondary" data-repair-go="'+esc(remaining[0].id)+'">Tới phần chưa chỉnh</button>':'')+(onlyUnchanged?'<button type="button" class="secondary" data-repair-list>Xem toàn bộ phần cần sửa</button>':'')+'<button type="button" class="secondary" data-close-modal>Quay lại bài</button>');
  return true;
 }
 const explanationSelectors=['.explanation-dialog-columns','.explanation-dialog-passage-scroll','.explanation-dialog-detail-scroll'];
 function rememberExplanation(persist=true){
  if(!key||!explanationTarget||!$('#explanation-dialog')?.open)return;
  record.explanations={...record.explanations,[explanationTarget]:explanationSelectors.map(selector=>offset($('#explanation-dialog '+selector)?.scrollTop||0))};if(persist)remember();
 }
 function restoreExplanation(id){
  explanationTarget=id;const saved=record.explanations?.[id];if(!Array.isArray(saved))return false;
  requestAnimationFrame(()=>explanationSelectors.forEach((selector,i)=>{const el=$('#explanation-dialog '+selector);if(el)el.scrollTop=offset(saved[i]);}));return true;
 }
 document.addEventListener('click',event=>{
  const button=event.target.closest('button');if(!button||!current)return;
  if(button.hasAttribute('data-close-explanation'))rememberExplanation();
  if(button.dataset.repairDirection)current.move(Number(button.dataset.repairDirection));
  if(button.hasAttribute('data-repair-list'))review();
  if(button.dataset.repairGo){const id=button.dataset.repairGo;if(current.nav.items.some(t=>t.id===id)){current.bridge.close();current.go(id);}}
 });
 document.addEventListener('scroll',event=>{if(event.target.closest?.('#explanation-dialog'))rememberExplanation(false);clearTimeout(scrollTimer);scrollTimer=setTimeout(remember,140);},true);
 $('#explanation-dialog')?.addEventListener('cancel',()=>rememberExplanation());
 window.addEventListener('beforeunload',()=>{rememberExplanation();remember();});
 window.MaterialsRepairWorkspace={prepare,render,review,hide,deactivate(){current=null;hide();},detachSync,updateSync,afterMove,rememberExplanation,restoreExplanation};
}());

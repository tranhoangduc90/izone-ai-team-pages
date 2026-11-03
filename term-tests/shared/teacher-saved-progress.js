// Chỉ dựng bản đã lưu do API giảng viên trả về; không mở phiên hoặc lấy audio.
// Mỗi lượt giữ riêng; đổi người/lớp/đăng xuất loại phản hồi cũ và xóa nội dung hộp xem.
import {patchReadingView} from '../../shared/reading-view.mjs?v=20261103-term-tracking1';
import {createTermTeacherDashboardTracking} from './teacher-state-tracking.mjs?v=20261103-t4r1';
let active=null,serial=0;
const node=(tag,text='',className='')=>{const el=document.createElement(tag);el.textContent=text;if(className)el.className=className;return el;};
const stamp=value=>value&&Number.isFinite(Date.parse(value))?new Date(value).toLocaleString('vi-VN'):'Chưa có';

export function clearTeacherSavedProgress(){
 serial++;if(!active)return;clearTimeout(active.timer);active.tracking?.close();active.controller.abort();active.cache.clear();document.removeEventListener('visibilitychange',active.visibility);
 active.dialog.close();active.dialog.replaceChildren();active.dialog.remove();active=null;
}

export function openTeacherSavedProgress({student,className,testSlug,testTitle=testSlug,request,isCurrent,compact=false,apiBaseUrl=''}){
 clearTeacherSavedProgress();const generation=serial;
 const dialog=node('dialog','','teacher-saved-progress-dialog');
 const header=node('header'),title=node('h2',student.name),close=node('button','Đóng','button button-secondary');close.type='button';
 const context=node('p',className+' · '+testTitle,'muted'),notice=node('p','','muted'),body=node('div'),refresh=node('button','Cập nhật bản đã lưu','button button-secondary');refresh.type='button';
 header.append(title,close);dialog.append(header,context,node('p','Chỉ hiện nội dung đã lưu lên hệ thống. Phần học viên còn đang gõ trên thiết bị có thể chưa xuất hiện.','muted'),refresh,notice,body);
 const current={dialog,timer:null,sequence:0,chosen:'',displayed:'',data:null,index:null,cache:new Map(),controller:new AbortController(),needsRetry:false,
  visibility(){clearTimeout(current.timer);if(document.hidden)current.tracking?.close();else void load({quiet:false});}};active=current;
 const valid=()=>active===current&&serial===generation&&isCurrent();
 const schedule=()=>{clearTimeout(current.timer);if(valid()&&!document.hidden)current.timer=setTimeout(()=>void load(),30000);};
 function render(data){
  current.data=data;const next=document.createDocumentFragment();
  if(!data.attempts.length){next.append(node('p','Chưa có lượt làm hoặc bản lưu trên hệ thống. Việc xem không tạo lượt mới.'));patchReadingView(body,next);return;}
  const latest=data.attempts.filter(a=>!a.superseded).at(-1)||data.attempts.at(-1);
  const selected=data.attempts.find(a=>a.viewId===current.chosen)||latest;current.chosen=selected.viewId;current.displayed=selected.viewId;
  const label=node('label','Lượt làm'),select=node('select');select.setAttribute('aria-label','Lượt làm');
  data.attempts.forEach((a,i)=>{const option=node('option',`Lượt ${i+1} · ${stamp(a.createdAt)}${a.superseded?' · Đã được thay thế':''}`);option.value=a.viewId;option.selected=a.viewId===selected.viewId;select.append(option);});
  label.dataset.readingKey='selector';label.append(select);next.append(label);
  select.addEventListener('change',event=>{current.chosen=event.currentTarget.value;
   if(compact)void selectCompact().catch(report);else render(current.data);});
  const metadata=node('p',`${selected.order==='read_first'?'Reading trước':'Listening trước'} · ${selected.delivery==='answer_sheet'?'Làm trên giấy':'Làm trên máy'} · Đề phiên bản ${selected.definitionVersion}`,'muted');metadata.dataset.readingKey='metadata';next.append(metadata);
  for(const [key,title] of [['listening','Listening'],['reading','Reading']]){
   const section=node('section'),part=selected[key]||{},entries=Object.entries(part.answers||{}).sort((a,b)=>Number(a[0])-Number(b[0]));
   section.dataset.readingKey=key;section.dataset.viewId=selected.viewId;
   section.append(node('h3',title),node('p',part.submittedAt?'Đã nộp · '+stamp(part.submittedAt):part.startedAt||entries.length?'Chưa nộp · Bản lưu '+stamp(part.savedAt):'Chưa bắt đầu','muted'));
   if(!entries.length)section.append(node('p','Chưa có câu trả lời đã lưu.'));
   else{const table=node('table'),head=node('tr');head.append(node('th','Câu'),node('th','Câu trả lời đã lưu'));table.append(head);
    for(const [number,answer] of entries){const row=node('tr');row.append(node('td',number),node('td',String(answer||'Chưa nhập')));table.append(row);}section.append(table);}
   next.append(section);
  }
  const writing=selected.writing||{},section=node('section');section.dataset.readingKey='writing';section.dataset.viewId=selected.viewId;
  section.append(node('h3','Writing'),node('p',writing.submittedAt?'Đã nộp · '+stamp(writing.submittedAt):writing.startedAt?'Chưa nộp · Bản lưu '+stamp(writing.savedAt):'Chưa bắt đầu','muted'));
  for(const [key,title] of [['task1','Task 1'],['task2','Task 2']])if(writing[key]){
   const heading=node('h4',title),content=node('pre',writing[key]);heading.dataset.readingKey=key+'-heading';content.dataset.readingKey=key;
   section.append(heading,content);
  }
  if(!writing.task1&&!writing.task2)section.append(node('p','Chưa có nội dung Writing đã lưu.'));next.append(section);
  patchReadingView(body,next,{nodeKey:n=>n.dataset?.readingKey||'',boundary:(before,after)=>
   before.dataset?.viewId!==after.dataset?.viewId?'replace':before.isEqualNode(after)?'keep':undefined});
  body.querySelector('select').value=selected.viewId;
 }
 const params=extra=>new URLSearchParams({class:className,test:testSlug,student:student.ref,...extra});
 const read=(extra,signal=current.controller.signal)=>request('/api/term-tests/teacher/saved-progress?'+params(extra),{signal});
 const check=(data,legacy=false)=>{
  if(data.student?.ref!==student.ref||data.test?.slug!==testSlug||!Array.isArray(data.attempts))throw Error('Dữ liệu trả về chưa khớp học viên và bài đang chọn.');
  const ids=new Set();for(const item of data.attempts){
   if(!/^[a-f0-9]{64}$/.test(item.viewId)||(!legacy&&!/^[a-f0-9]{32}$/.test(item.revision))||ids.has(item.viewId))throw Error('Danh mục lượt làm chưa hợp lệ.');
   ids.add(item.viewId);
  }
 };
 // Chỉ đổi giao thức sau khi API cũ trả bản đầy đủ đúng người/bài/lượt.
 // Lỗi tạm hoặc mất quyền không được coi là tín hiệu tắt chế độ gọn.
 async function tryLegacy(error,sequence){
  if(![400,404,405].includes(error.status))return false;
  const data=await read({});if(!valid()||sequence!==current.sequence)return true;
  check(data,true);if(data.format)throw Error('Bản đọc đầy đủ chưa đúng phiên bản.');
  compact=false;current.tracking?.close();current.tracking=null;current.index=null;current.cache.clear();current.needsRetry=false;
  render(data);synchronized();schedule();return true;
 }
 async function showCompact(index,sequence){
  const latest=index.attempts.filter(a=>!a.superseded).at(-1)||index.attempts.at(-1);
  const selected=index.attempts.find(a=>a.viewId===current.chosen)||latest;
  if(!selected){current.chosen='';current.displayed='';current.cache.clear();render(index);return;}
  let detail=current.cache.get(selected.viewId);
  if(!detail||detail.revision!==selected.revision){
   const result=await read({mode:'view',viewId:selected.viewId});if(!valid()||sequence!==current.sequence)return;
   check(result);if(result.format!=='saved-progress-view-v1'||result.attempts.length!==1||result.attempts[0].viewId!==selected.viewId)throw Error('Nội dung trả về chưa khớp lượt làm đang chọn.');
   detail=result.attempts[0];current.cache.set(selected.viewId,detail);
  }
  if(!valid()||sequence!==current.sequence)return;
  current.chosen=selected.viewId;render({...index,attempts:index.attempts.map(a=>a.viewId===selected.viewId?detail:a)});
 }
 async function selectCompact(){
  const sequence=++current.sequence;if(!valid()||!current.index)return;
  try{
   await showCompact(current.index,sequence);if(!valid()||sequence!==current.sequence)return;
   current.needsRetry=false;synchronized();schedule();
  }catch(error){if(valid()&&sequence===current.sequence&&!await tryLegacy(error,sequence))throw error;}
 }
 async function loadCompact(){
  const sequence=++current.sequence;
  try{
   const index=await read({mode:'index'});if(!valid()||sequence!==current.sequence)return;
   check(index);if(index.format!=='saved-progress-index-v1')throw Error('Danh mục lượt làm chưa đúng phiên bản.');
   current.index=index;const ids=new Set(index.attempts.map(a=>a.viewId));for(const id of current.cache.keys())if(!ids.has(id))current.cache.delete(id);
   await showCompact(index,sequence);if(!valid()||sequence!==current.sequence)return;
   current.needsRetry=false;schedule();
  }catch(error){if(valid()&&sequence===current.sequence&&!await tryLegacy(error,sequence))throw error;}
 }
 function synchronized(){if(valid())notice.textContent='Đã đọc lúc '+new Date().toLocaleTimeString('vi-VN')+(compact?' · Theo dõi thay đổi mỗi 30 giây khi trang đang mở.':' · Tự đọc lại sau 30 giây khi trang đang mở.');}
 function report(error){
  if(!valid()||current.controller.signal.aborted)return;current.needsRetry=true;
  if([401,403,423].includes(error.status)){body.replaceChildren();current.cache.clear();current.index=null;current.tracking?.close();}
  else if(current.displayed){current.chosen=current.displayed;const select=body.querySelector('select');if(select)select.value=current.displayed;}
  notice.textContent='Chưa cập nhật được: '+error.message;schedule();
 }
 current.tracking=compact?createTermTeacherDashboardTracking({
  current:()=>valid()&&compact?{enabled:true,generation,apiBase:apiBaseUrl,className,testSlug,studentRef:student.ref}:null,
  request,loadContent:loadCompact,onError:report,
  onUnavailable:()=>{if(valid())notice.textContent='Chưa kiểm tra được thay đổi. Nội dung đã đọc vẫn được giữ; hệ thống sẽ thử lại.';},
  onSynchronized:synchronized
 }):null;
 async function load(options={quiet:true}){
  if(compact){
   if(!valid()){if(active===current)clearTeacherSavedProgress();return;}
   if(!current.data)notice.textContent='Đang đọc lại bản đã lưu…';
   try{await current.tracking.load({...options,quiet:options.quiet&&!current.needsRetry});if(valid())schedule();}catch(error){report(error);}return;
  }
  if(!valid()){if(active===current)clearTeacherSavedProgress();return;}const sequence=++current.sequence;clearTimeout(current.timer);if(!current.data)notice.textContent='Đang đọc lại bản đã lưu…';
  try{
   const data=await request('/api/term-tests/teacher/saved-progress?'+new URLSearchParams({class:className,test:testSlug,student:student.ref}));
   if(!valid()||sequence!==current.sequence)return;
   if(data.student?.ref!==student.ref)throw new Error('Dữ liệu trả về chưa khớp học viên đang chọn.');
   render(data);notice.textContent='Đã đọc lúc '+new Date().toLocaleTimeString('vi-VN')+' · Tự đọc lại sau 30 giây khi trang đang mở.';schedule();
  }catch(error){
   if(!valid()||sequence!==current.sequence)return;
   if([401,403,423].includes(error.status))body.replaceChildren();
   notice.textContent='Chưa cập nhật được: '+error.message;schedule();
  }
 }
 close.addEventListener('click',clearTeacherSavedProgress);dialog.addEventListener('cancel',event=>{event.preventDefault();clearTeacherSavedProgress();});
 refresh.addEventListener('click',()=>void load({quiet:false}));document.addEventListener('visibilitychange',current.visibility);
 document.body.append(dialog);dialog.showModal();void load();return dialog;
}

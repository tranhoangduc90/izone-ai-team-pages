import {ORDER,FIELDS,createState,canEdit,available,ideaPassed} from '../lesson5-demo/core.mjs';
import {createClient} from './client.mjs';
import {renderJourney,renderProcessing,renderRecap} from './recovery-ui.mjs';

// Nhận bài của người đã xác nhận, lưu ở backend riêng và hiển thị nhận xét đọc lại.
// Backend quyết định khóa/mở bước. Lỗi mạng giữ nháp; lỗi hai tab yêu cầu đọc bản mới.
const $=id=>document.getElementById(id);
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const api=createClient('https://ducizone.ddns.net/api/handout67/v1');
const names={};let classes=[],state=createState(),student='',generation=0,busy=false,conflict=false,editingLocked=false;
let mutationVersion=0;
let dirty={},saveTimer,pollTimer,toastTimer,serial=Promise.resolve();
const labels={idea1:'Idea 1',idea2:'Idea 2',topicSentence:'Topic sentence của thân bài 2',b1:'Điểm cuối B · Ý 1',a1:'Điểm đầu A · Ý 1',x1:'Cầu nối X · Ý 1',b2:'Điểm cuối B · Ý 2',a2:'Điểm đầu A · Ý 2',x2:'Cầu nối X · Ý 2'};
const descriptions={topic:{title:'Chốt idea và Topic sentence',kicker:'01 · Chuẩn bị thân bài 2',instruction:'Topic sentence = Trọng tâm bàn luận + Tóm tắt ngắn gọn toàn bộ idea của đoạn văn.',button:'Check chất lượng Topic Sentence'},b:{title:'Chốt điểm cuối (B)',instruction:'Có cụ thể không? Nêu kết quả cuối cùng mà ý này muốn chứng minh, để người đọc hình dung rõ.',button:'Check chất lượng Điểm cuối'},a:{title:'Check điểm đầu (A)',instruction:'Có bám sát đề không? Tả rõ việc mua đồ không cần thiết hoặc tình tiết xảy ra ngay sau việc mua.',button:'Check chất lượng điểm đầu A'},x:{title:'Xây X · Cầu nối từ A sang B',instruction:'Vì sao A dẫn đến B? Giải thích một cơ chế nối hai điểm đã đạt; không chỉ diễn đạt lại A hoặc B.',button:'Check chất lượng cầu nối X'}};
const statusLabels={draft:'Chưa check',revision:'Cần sửa',passed:'Đã đạt',pending:'Đang chấm…',technical_error:'Chưa chấm xong'};
function field(name,disabled){
  const isTopic=name==='topicSentence',idea=/^idea/.test(name);
  const placeholder=idea?'Ghi ngắn gọn ý bạn muốn triển khai…':isTopic?'Viết câu chủ đề bao quát cả hai idea…':'Bạn có thể ghi ý bằng tiếng Việt hoặc tiếng Anh…';
  return `<label class="student-field">${labels[name]}<textarea id="field-${name}" data-field="${name}" maxlength="4000" ${disabled?'disabled':''} placeholder="${placeholder}" ${isTopic?'lang="en"':''}>${escape(state.responses[name])}</textarea>${idea?'<small>Chọn tác hại bạn sẽ bàn luận trong thân bài này.</small>':''}</label>`;
}
function snapshot(history,key){return FIELDS[key].map(f=>labels[f]+': '+history.snapshot[f]).join('\n\n');}
function comments(key){
  const step=state.steps[key],hist=[...step.history].reverse();
  let body=hist.length?hist.map((h,index)=>index===0?`<article class="comment"><div class="comment-header"><span>Comment lần ${h.number}</span><span class="badge ${h.status}">${statusLabels[h.status]}</span></div><div class="comment-body"><p>${escape(h.feedback)}</p><details><summary>Xem nội dung đã gửi</summary><div class="snapshot">${escape(snapshot(h,key))}</div></details></div></article>`:`<details class="comment history"><summary>Comment lần ${h.number} · ${statusLabels[h.status]}</summary><div class="comment-body"><p>${escape(h.feedback)}</p><div class="snapshot">${escape(snapshot(h,key))}</div></div></details>`).join(''):'<p class="empty-comments">Nhận xét sẽ xuất hiện ở đây sau khi bạn nhấn Check.<br>Mỗi lần sửa đều được giữ lại.</p>';
  body=renderProcessing(state,key)+body;
  const teacherNotes=(state.teacherComments||[]).filter(c=>c.section===key).reverse();
  body=teacherNotes.map(c=>`<article class="comment"><div class="comment-header"><span>Giảng viên · ${escape(c.authorName)}</span></div><div class="comment-body"><p>${escape(c.feedback)}</p><details><summary>Xem nội dung lúc góp ý</summary><div class="snapshot">${escape(snapshot(c,key))}</div></details></div></article>`).join('')+body;
  const fails=step.history.filter(h=>h.status==='revision').length;
  if(fails>0&&fails%3===0&&step.status!=='passed')body+='<p class="support">Bạn đã sửa 3 lần trong vòng này. Hãy nhờ giảng viên giúp làm rõ điểm đang vướng trước khi thử tiếp.</p>';
  return `<aside class="comments" aria-label="Nhận xét ${escape(key)}"><div class="comments-heading"><h3>Dòng thời gian · Comment</h3><span>${hist.length} lượt</span></div><div aria-live="polite">${body}</div></aside>`;
}
function chain(key){
  if(key==='topic')return '';
  const n=key.at(-1),type=key[0];
  if(type==='a'||type==='x')return renderJourney(state,key);
  const items=type==='b'?[['Idea',state.responses['idea'+n]],...(n==='2'?[['B1',state.responses.b1]]:[])]:type==='a'?[['Đề','Mua đồ không cần thiết'],['B',state.responses['b'+n]]]:[['A',state.responses['a'+n]],['B',state.responses['b'+n]]];
  return `<div class="context-chain">${items.map(([label,value])=>`<div><b>${label}</b><span>${escape(value)}</span></div>`).join('')}</div>`;
}
function stepCard(key){
  const step=state.steps[key],type=key==='topic'?'topic':key[0],n=key.at(-1),def=descriptions[type];
  const title=def.title+(key==='topic'?'':` · Ý ${n}`);
  if(!available(state,key))return `<div id="step-${key}" class="lock-note"><span aria-hidden="true">◌</span><span><strong>${title}</strong><br>Mở sau khi ${key==='b1'?'Topic sentence':key[0]==='a'?'điểm cuối B':'điểm đầu A'} đạt.</span></div>`;
  const disabled=!canEdit(state,key);
  let form=key==='topic'?`<h3>Chốt idea cho thân bài 2</h3><div class="field-grid">${field('idea1',disabled)}${field('idea2',disabled)}</div>${field('topicSentence',disabled)}`:field(key,disabled);
  const words=FIELDS[key].reduce((total,f)=>total+state.responses[f].trim().split(/\s+/).filter(Boolean).length,0);
  const current=`<div class="step-grid"><article class="answer-card"><div class="step-heading"><div><p class="kicker">${key==='topic'?'Chuẩn bị nội dung':`Ý ${n} · ${type.toUpperCase()} trong A–X–B`}</p><h3>${def.title}</h3></div><span class="badge ${step.status}">${statusLabels[step.status]}</span></div><p class="instruction">${def.instruction}</p>${chain(key)}${form}<p class="error" id="error-${key}" role="alert" hidden></p><div class="section-actions"><span class="word-count" data-count="${key}">${words} từ</span><button data-check="${key}" class="primary" ${disabled?'disabled':''}>${step.status==='passed'?'Đã đạt · giữ nguyên':step.status==='pending'?'Đang chấm…':def.button+(type==='b'?` ${n}`:'')}</button></div></article>${comments(key)}</div>`;
  return step.status==='passed'?`<details class="prior-step" id="step-${key}" data-status="passed"><summary><span>${title}</span><span class="badge passed">✓ Đã đạt</span><span class="prior-chevron">Xem bài & Comment ↓</span></summary>${current}</details>`:`<section id="step-${key}" class="step" data-status="${step.status}" aria-label="${title}">${current}</section>`;
}
function vocabulary(n){
  if(n===2)return ''; // Bảng cuối nằm trong recap, gồm từ vựng của cả hai ý.
  if(!ideaPassed(state,n))return '';
  const value=state.vocabulary?.[n];
  const content=value?.status==='ready'?`<div class="vocab-grid">${Object.entries(value.groups).map(([point,entries])=>`<div class="vocab-col"><h4>${point} words · ${point==='A'?'Điểm đầu':point==='X'?'Cầu nối':'Điểm cuối'}</h4>${entries.map(entry=>`<div class="vocab-entry"><strong lang="en">${escape(entry.phrase)}</strong><span>${escape(entry.meaningVi)}</span></div>`).join('')}</div>`).join('')}</div>`:value?.status==='failed'?`<p class="error">Chưa lấy được từ vựng. Ba điểm đã đạt vẫn được giữ.</p><button class="secondary" data-vocab-retry="${n}">Thử lấy từ vựng lại</button>`:'<p role="status">Đang tìm cụm từ phù hợp với chính ý của bạn…</p>';
  return `<section class="vocabulary" id="vocab-${n}" aria-label="Gợi ý từ vựng ý ${n}"><div class="vocab-header"><div><p class="kicker red">B–A–X đều đã đạt</p><h3>Gợi ý từ vựng · Ý ${n}</h3><p>Bạn tự chọn cách diễn đạt từ các cụm phù hợp với ý đã chốt.</p></div></div>${content}</section>`;
}

function render(){
  $('sections').innerHTML=`<section class="section-group" id="topic"><div class="group-header"><div><h2>01. Ý tưởng & Topic sentence</h2><p>Chốt cả hai idea trước khi phát triển từng ý.</p></div></div>${stepCard('topic')}</section><section class="section-group" id="idea1"><div class="group-header"><div><h2>02. Hoàn thiện ý 1</h2><p>Chốt B → kiểm A → xây X → mở từ vựng.</p></div><span class="badge ${ideaPassed(state,1)?'passed':''}">${ideaPassed(state,1)?'✓ Đã đạt':'Làm từng bước'}</span></div>${['b1','a1','x1'].map(stepCard).join('')}${vocabulary(1)}${ideaPassed(state,1)&&!state.idea2Open?'<div class="next-idea"><div><strong>Ý 1 đã hoàn thiện.</strong><p>Giữ nguyên ba điểm đã đạt và bắt đầu ý tiếp theo.</p></div><button class="primary" id="next-idea">Tiếp tục với ý 2 →</button></div>':''}</section>${state.idea2Open?`<section class="section-group" id="idea2"><div class="group-header"><div><h2>03. Hoàn thiện ý 2</h2><p>Tiếp tục quy trình B → A → X với idea thứ hai.</p></div></div>${['b2','a2','x2'].map(stepCard).join('')}${vocabulary(2)}</section>`:'<div id="idea2" class="lock-note">◌ &nbsp; Ý 2 sẽ mở sau khi bạn hoàn thiện ý 1 và nhấn tiếp tục.</div>'}`;
  const topicDone=state.steps.topic.status==='passed',oneDone=ideaPassed(state,1),twoDone=ideaPassed(state,2);
  $('journey-nav').innerHTML=[['prompt','Đề bài','Đọc đề','?',false,true],['topic','Ý tưởng & Topic','Chốt cả hai idea','1',topicDone,true],['idea1','Lập luận ý 1','B → A → X','2',oneDone,topicDone],['idea2','Lập luận ý 2','B → A → X','3',twoDone,state.idea2Open]].map(([id,title,sub,num,done,enabled])=>`<button class="nav-item ${done?'done':''} ${id==='topic'&&!topicDone||id==='idea1'&&topicDone&&!oneDone||id==='idea2'&&state.idea2Open?'active':''}" data-target="${id}" ${enabled?'':'disabled'}><span>${done?'✓':num}</span><span>${title}<small>${sub}</small></span></button>`).join('');
  $('completion').hidden=!twoDone;
  if(twoDone)$('completion').innerHTML=renderRecap(state);
}
function focusSection(key){const el=$('step-'+key)||$(key);if(el){el.scrollIntoView({behavior:'auto',block:'start'});const text=el.querySelector('textarea:not(:disabled)');text?.focus({preventScroll:true});}}

function message(text){clearTimeout(toastTimer);$('toast').textContent=text;$('toast').hidden=false;toastTimer=setTimeout(()=>{$('toast').hidden=true;},6000);}
function note(text){$('connection-note').textContent=text;$('connection-note').hidden=!text;}
function show(view){for(const id of ['identity','confirm','workspace'])$(id).hidden=id!==view;window.scrollTo({top:0});}
function draftKey(){return 'izone-handout67:draft:'+state.ref;}
function keepDraft(){try{localStorage.setItem(draftKey(),JSON.stringify({ref:state.ref,changes:{...dirty},responses:{...state.responses},savedAt:Date.now()}));}catch{message('Thiết bị chưa giữ được nháp. Hãy sao chép nội dung trước khi đóng trang.');}}
function enqueue(action){const result=serial.then(action);serial=result.catch(()=>{});return result;}
function apply(value){state=value;render();}
function failure(error){
 if(error.status===409){conflict=true;note('Bài đã thay đổi ở tab khác. Nháp của bạn được giữ trên thiết bị. Đọc bản đã lưu trước khi tiếp tục.');$('read-latest').hidden=false;}
 else if(error.status===401){note('Phiên đã hết hạn. Hãy chọn lại tên để mở bài đã lưu.');message('Bài đã lưu trên máy chủ vẫn được giữ.');}
 else {note('Chưa kết nối được máy chủ. Nháp vẫn được giữ trên thiết bị; bạn có thể thử lại.');}
 $('save-state').textContent='Có nháp chưa lưu';
}
async function flush(){
 clearTimeout(saveTimer);
 const epoch=generation;
 return enqueue(async()=>{
  if(epoch!==generation||!state.ref||conflict||!Object.keys(dirty).length)return !conflict;
  const changes={...dirty};busy=true;mutationVersion++;
  try {
   const result=await api.save(state.ref,{baseVersion:state.version,requestId:crypto.randomUUID(),responses:changes});
   if(epoch!==generation)return false;
   state.version=result.session.version;
   for(const [key,value] of Object.entries(changes))if(dirty[key]===value)delete dirty[key];
   // Không render khi nhập để giữ con trỏ; đọc lại trạng thái nghiệp vụ khi không còn nháp.
   $('save-state').textContent=Object.keys(dirty).length?'Đang lưu…':'Đã lưu trên máy chủ';
   if(!Object.keys(dirty).length){try{localStorage.removeItem(draftKey());}catch{}note('');}
   return true;
  }catch(error){if(epoch===generation)failure(error);return false;}
  finally{if(epoch===generation)busy=false;}
 });
}
function schedulePoll(){clearTimeout(pollTimer);if(!student)return;pollTimer=setTimeout(poll,4000);}
async function poll(){
 const epoch=generation,watermark=mutationVersion,ref=state.ref;
 try {
  if(!busy&&!conflict&&!Object.keys(dirty).length&&state.ref){
   const next=(await api.read(state.ref)).session;
   if(epoch===generation&&watermark===mutationVersion&&ref===state.ref&&!busy&&!conflict&&!Object.keys(dirty).length&&JSON.stringify(next)!==JSON.stringify(state)){apply(next);note('');}
  }
 }catch(error){if(epoch===generation){note('Kết nối đang gián đoạn. Bài đã gửi vẫn được giữ; trang sẽ kiểm lại.');}}
 finally{if(epoch===generation)schedulePoll();}
}
async function enter(){
 const epoch=++generation;const button=$('confirm-button');button.disabled=true;
 try {
  const result=await api.open({activity:'lesson5',classRef:$('class-select').value,studentRef:student});
  if(epoch!==generation)return;
  api.setToken(result.token);dirty={};conflict=false;busy=false;editingLocked=false;serial=Promise.resolve();state=result.session;
  if($('remember').checked){try{localStorage.setItem('izone-handout67:identity',JSON.stringify({classRef:state.classRef,studentRef:student}));}catch{}}
  else {try{localStorage.removeItem('izone-handout67:identity');}catch{}}
  $('learner-label').textContent=names[student];show('workspace');render();note('');$('read-latest').hidden=true;
  $('save-state').textContent='Đã mở bài từ máy chủ';
  try{$('restore-draft').hidden=!localStorage.getItem(draftKey());}catch{$('restore-draft').hidden=true;}
  schedulePoll();
 }catch(error){message('Chưa mở được bài. Hãy thử lại; bài đã lưu vẫn được giữ.');}
 finally{button.disabled=false;}
}
function students(){
 const row=classes.find(c=>c.classRef===$('class-select').value);
 $('student-select').innerHTML='<option value="">Chọn tên của bạn</option>'+(row?.students||[]).map(s=>`<option value="${escape(s.studentRef)}">${escape(s.displayName)}</option>`).join('');
}
async function bootstrap(){
 try {
  const classRef=document.body?.dataset?.classRef;
  classes=(await api.roster()).classes.filter(c=>!classRef||c.classRef===classRef);
  if(!classes.length)throw new Error('CLASS_NOT_OPEN');
  for(const c of classes)for(const s of c.students)names[s.studentRef]=s.displayName;
  $('class-select').innerHTML=classes.map(c=>`<option value="${escape(c.classRef)}">${escape(c.className)}</option>`).join('');students();
  try{const remembered=JSON.parse(localStorage.getItem('izone-handout67:identity'));if(classes.some(c=>c.classRef===remembered?.classRef)){$('class-select').value=remembered.classRef;students();$('student-select').value=remembered.studentRef;}}catch{}
 }catch{message('Chưa tải được lớp. Hãy tải lại trang khi kết nối ổn định.');}
}
$('class-select').addEventListener('change',students);
$('login-form').addEventListener('submit',event=>{event.preventDefault();const val=$('student-select').value;if(!names[val])return;student=val;$('confirm-title').textContent=names[val];$('confirm-class').textContent=classes.find(c=>c.classRef===$('class-select').value)?.className;show('confirm');$('confirm-button').focus();});
$('back').addEventListener('click',()=>show('identity'));
$('confirm-button').addEventListener('click',enter);
$('logout').addEventListener('click',async()=>{await flush();generation++;clearTimeout(pollTimer);clearTimeout(saveTimer);api.setToken('');student='';dirty={};state=createState();show('identity');});
$('read-latest').addEventListener('click',async()=>{
 if(busy||editingLocked)return;
 const epoch=generation,ref=state.ref;keepDraft();busy=true;editingLocked=true;mutationVersion++;
 document.querySelectorAll('textarea[data-field]').forEach(el=>el.disabled=true);
 try{const result=await api.read(ref);if(epoch!==generation||ref!==state.ref)return;dirty={};conflict=false;busy=false;apply(result.session);note('');$('read-latest').hidden=true;$('restore-draft').hidden=false;$('save-state').textContent='Đã đọc bản mới từ máy chủ';}
 catch(error){if(epoch===generation&&ref===state.ref)failure(error);}
 finally{if(epoch===generation&&ref===state.ref){busy=false;editingLocked=false;document.querySelectorAll('textarea[data-field]').forEach(el=>{const key=ORDER.find(k=>FIELDS[k].includes(el.dataset.field));el.disabled=conflict||!canEdit(state,key);});}}
});
$('restore-draft').addEventListener('click',()=>{try{const saved=JSON.parse(localStorage.getItem(draftKey()));for(const [field,value] of Object.entries(saved.changes||saved.responses)){const key=ORDER.find(k=>FIELDS[k].includes(field));if(typeof value==='string'&&canEdit(state,key)&&state.responses[field]!==value){state.responses[field]=value;dirty[field]=value;}}render();$('restore-draft').hidden=true;if(Object.keys(dirty).length){keepDraft();void flush();}}catch{message('Chưa đọc được nháp trên thiết bị.');}});
$('workspace').addEventListener('input',event=>{
 const field=event.target.dataset.field,key=ORDER.find(k=>FIELDS[k].includes(field));if(!field||editingLocked||conflict||!canEdit(state,key))return;
 state.responses[field]=event.target.value;dirty[field]=event.target.value;keepDraft();$('save-state').textContent='Đang lưu…';clearTimeout(saveTimer);saveTimer=setTimeout(()=>void flush(),600);
 const count=document.querySelector(`[data-count="${key}"]`);if(count)count.textContent=FIELDS[key].reduce((total,f)=>total+state.responses[f].trim().split(/\s+/).filter(Boolean).length,0)+' từ';
});
$('workspace').addEventListener('click',async event=>{
 const button=event.target.closest('button');if(!button)return;
 if(button.dataset.target){$(button.dataset.target)?.scrollIntoView({behavior:'auto'});return;}
 const key=button.dataset.check;
 if(!key&&button.id!=='next-idea'&&!button.dataset.vocabRetry)return;
 if(busy||conflict||button.disabled)return;
 if(key){const empty=FIELDS[key].find(f=>!state.responses[f].trim());if(empty){const el=$('error-'+key);el.hidden=false;el.textContent='Hãy nhập nội dung vào các ô màu vàng trước khi Check.';$('field-'+empty)?.focus();return;}}
 button.disabled=true;editingLocked=true;const epoch=generation;
 document.querySelectorAll('textarea[data-field]').forEach(el=>el.disabled=true);
 if(!await flush()||epoch!==generation){if(epoch===generation){editingLocked=false;button.disabled=false;document.querySelectorAll('textarea[data-field]').forEach(el=>{const section=ORDER.find(k=>FIELDS[k].includes(el.dataset.field));el.disabled=conflict||!canEdit(state,section);});}return;}
 busy=true;mutationVersion++;
 try {
  const result=key?await api.check(state.ref,{section:key,baseVersion:state.version,requestId:crypto.randomUUID()}):button.id==='next-idea'?await api.idea2(state.ref):await api.vocabulary(state.ref,Number(button.dataset.vocabRetry));
  if(epoch!==generation)return;busy=false;apply(result.session);note('');if(button.id==='next-idea')focusSection('b2');
 }catch(error){if(epoch===generation){failure(error);button.disabled=false;}}
 finally{if(epoch===generation){busy=false;editingLocked=false;document.querySelectorAll('textarea[data-field]').forEach(el=>{const section=ORDER.find(k=>FIELDS[k].includes(el.dataset.field));el.disabled=conflict||!canEdit(state,section);});schedulePoll();}}
});
window.addEventListener('pagehide',()=>{if(student&&Object.keys(dirty).length)keepDraft();});
window.addEventListener('beforeunload',event=>{if(Object.keys(dirty).length){keepDraft();event.preventDefault();event.returnValue='';}});
void bootstrap();

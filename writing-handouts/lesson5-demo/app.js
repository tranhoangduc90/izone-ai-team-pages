import {ORDER,FIELDS,EXAMPLE,VOCAB,createState,canEdit,available,ideaPassed,setField,beginCheck,finishCheck,openIdea2,fixture,restore} from './core.mjs';

// Nhận thao tác trên bản xem thử, hiển thị bài/nhận xét và giữ nháp local.
// Không gọi n8n/AI. Kết quả Check theo lựa chọn demo; lỗi lưu hiện đúng trên thanh trạng thái.
const $=id=>document.getElementById(id);
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const names={'student-a':'Học viên mẫu A','student-b':'Học viên mẫu B','student-c':'Học viên mẫu C'};
const labels={idea1:'Idea 1',idea2:'Idea 2',topicSentence:'Topic sentence của thân bài 2',b1:'Điểm cuối B · Ý 1',a1:'Điểm đầu A · Ý 1',x1:'Cầu nối X · Ý 1',b2:'Điểm cuối B · Ý 2',a2:'Điểm đầu A · Ý 2',x2:'Cầu nối X · Ý 2'};
const descriptions={topic:{title:'Chốt idea và Topic sentence',kicker:'01 · Chuẩn bị thân bài 2',instruction:'Topic sentence = Trọng tâm bàn luận + Tóm tắt ngắn gọn toàn bộ idea của đoạn văn.',button:'Check chất lượng Topic Sentence'},b:{title:'Chốt điểm cuối (B)',instruction:'Có cụ thể không? Nêu kết quả cuối cùng mà ý này muốn chứng minh, để người đọc hình dung rõ.',button:'Check chất lượng Điểm cuối'},a:{title:'Check điểm đầu (A)',instruction:'Có bám sát đề không? Tả rõ việc mua đồ không cần thiết hoặc tình tiết xảy ra ngay sau việc mua.',button:'Check chất lượng điểm đầu A'},x:{title:'Xây X · Cầu nối từ A sang B',instruction:'Vì sao A dẫn đến B? Giải thích một cơ chế nối hai điểm đã đạt; không chỉ diễn đạt lại A hoặc B.',button:'Check chất lượng cầu nối X'}};
const statusLabels={draft:'Chưa check',revision:'Cần sửa',passed:'Đã đạt',pending:'Đang chấm…',technical_error:'Chưa chấm xong'};
let generation=1, state=createState(generation), student='',sampleRequested=false,saveTimer,toastTimer;
function storageKey(){return 'izone-lesson5-demo:v1:demo67:'+student;}
function save(){
  try{localStorage.setItem(storageKey(),JSON.stringify(state));$('save-state').textContent='Đã giữ trên thiết bị';}
  catch{$('save-state').textContent='Chưa lưu được · giữ trang này mở';}
}
function message(text){clearTimeout(toastTimer);$('toast').textContent=text;$('toast').hidden=false;toastTimer=setTimeout(()=>{$('toast').hidden=true;},4000);}
function show(view){for(const id of ['identity','confirm','workspace'])$(id).hidden=id!==view;window.scrollTo({top:0});}
function confirmStudent(value){student=value;$('confirm-title').textContent=names[student];show('confirm');$('confirm-button').focus();}
function enter(){
  generation++;try{state=restore(localStorage.getItem(storageKey()),generation);}catch{state=createState(generation);}
  if($('remember').checked){try{localStorage.setItem('izone-lesson5-demo:remember',student);}catch{}}
  else {try{localStorage.removeItem('izone-lesson5-demo:remember');}catch{}}
  if(sampleRequested&&!Object.values(state.responses).some(Boolean)){state=fixture('sample',generation);save();}
  sampleRequested=false;
  $('learner-label').textContent=names[student];show('workspace');render();
  $('save-state').textContent=Object.values(state.responses).some(Boolean)?'Nháp trên thiết bị đã được mở':'Chưa có thay đổi';
}
$('login-form').addEventListener('submit',event=>{event.preventDefault();sampleRequested=false;const val=$('student-select').value;if(names[val])confirmStudent(val);});
$('back').addEventListener('click',()=>{show('identity');$('student-select').focus();});
$('confirm-button').addEventListener('click',enter);
$('sample').addEventListener('click',()=>{sampleRequested=true;student='student-a';$('student-select').value=student;confirmStudent(student);});
$('logout').addEventListener('click',()=>{clearTimeout(saveTimer);save();generation++;state=createState(generation);student='';show('identity');$('student-select').focus();});
$('load-case').addEventListener('click',()=>{generation++;state=fixture($('scenario').value,generation);render();save();focusSection('topic');});
try{const value=localStorage.getItem('izone-lesson5-demo:remember');if(names[value])$('student-select').value=value;}catch{}

function field(name,disabled){
  const isTopic=name==='topicSentence',idea=/^idea/.test(name);
  const placeholder=idea?'Ghi ngắn gọn ý bạn muốn triển khai…':isTopic?'Viết câu chủ đề bao quát cả hai idea…':'Bạn có thể ghi ý bằng tiếng Việt hoặc tiếng Anh…';
  return `<label class="student-field">${labels[name]}<textarea id="field-${name}" data-field="${name}" maxlength="4000" ${disabled?'disabled':''} placeholder="${placeholder}" ${isTopic?'lang="en"':''}>${escape(state.responses[name])}</textarea>${idea?'<small>Chọn tác hại bạn sẽ bàn luận trong thân bài này.</small>':''}</label>`;
}
function snapshot(history,key){return FIELDS[key].map(f=>labels[f]+': '+history.snapshot[f]).join('\n\n');}
function comments(key){
  const step=state.steps[key],hist=[...step.history].reverse();
  let body=hist.length?hist.map((h,index)=>index===0?`<article class="comment"><div class="comment-header"><span>Comment lần ${h.number}</span><span class="badge ${h.status}">${statusLabels[h.status]}</span></div><div class="comment-body"><p>${escape(h.feedback)}</p><details><summary>Xem nội dung đã gửi</summary><div class="snapshot">${escape(snapshot(h,key))}</div></details></div></article>`:`<details class="comment history"><summary>Comment lần ${h.number} · ${statusLabels[h.status]}</summary><div class="comment-body"><p>${escape(h.feedback)}</p><div class="snapshot">${escape(snapshot(h,key))}</div></div></details>`).join(''):'<p class="empty-comments">Nhận xét sẽ xuất hiện ở đây sau khi bạn nhấn Check.<br>Mỗi lần sửa đều được giữ lại.</p>';
  if(step.status==='pending')body='<p class="empty-comments" role="status">Đang đọc nội dung bạn vừa gửi…<br>Giữ trang mở, bạn không cần bấm lại.</p>'+body;
  if(step.status==='technical_error')body=`<p class="error" role="alert">${escape(step.error)} Thử lại bằng nút Check ở ô bên cạnh.</p>`+body;
  const fails=step.history.filter(h=>h.status==='revision').length;
  if(fails>0&&fails%3===0&&step.status!=='passed')body+='<p class="support">Bạn đã sửa 3 lần trong vòng này. Hãy nhờ giảng viên giúp làm rõ điểm đang vướng trước khi thử tiếp.</p>';
  return `<aside class="comments" aria-label="Nhận xét ${escape(key)}"><div class="comments-heading"><h3>Dòng thời gian · Comment</h3><span>${hist.length} lượt</span></div><div aria-live="polite">${body}</div></aside>`;
}
function chain(key){
  if(key==='topic')return '';
  const n=key.at(-1),type=key[0];
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
  if(!ideaPassed(state,n))return '';
  return `<section class="vocabulary" id="vocab-${n}" aria-label="Gợi ý từ vựng ý ${n}"><div class="vocab-header"><div><p class="kicker red">B–A–X đều đã đạt</p><h3>Gợi ý từ vựng · Ý ${n}</h3><p>Cụm từ minh họa cho ý mẫu trong demo. Bạn tự chọn cách diễn đạt.</p></div><span class="badge passed">Đã mở</span></div><div class="vocab-grid">${Object.entries(VOCAB[n]).map(([point,entries])=>`<div class="vocab-col"><h4>${point} words · ${point==='A'?'Điểm đầu':point==='X'?'Cầu nối':'Điểm cuối'}</h4>${entries.map(([phrase,meaning])=>`<div class="vocab-entry"><strong lang="en">${phrase}</strong><span>${meaning}</span></div>`).join('')}</div>`).join('')}</div></section>`;
}
function render(){
  $('sections').innerHTML=`<section class="section-group" id="topic"><div class="group-header"><div><h2>01. Ý tưởng & Topic sentence</h2><p>Chốt cả hai idea trước khi phát triển từng ý.</p></div></div>${stepCard('topic')}</section><section class="section-group" id="idea1"><div class="group-header"><div><h2>02. Hoàn thiện ý 1</h2><p>Chốt B → kiểm A → xây X → mở từ vựng.</p></div><span class="badge ${ideaPassed(state,1)?'passed':''}">${ideaPassed(state,1)?'✓ Đã đạt':'Làm từng bước'}</span></div>${['b1','a1','x1'].map(stepCard).join('')}${vocabulary(1)}${ideaPassed(state,1)&&!state.idea2Open?'<div class="next-idea"><div><strong>Ý 1 đã hoàn thiện.</strong><p>Giữ nguyên ba điểm đã đạt và bắt đầu ý tiếp theo.</p></div><button class="primary" id="next-idea">Tiếp tục với ý 2 →</button></div>':''}</section>${state.idea2Open?`<section class="section-group" id="idea2"><div class="group-header"><div><h2>03. Hoàn thiện ý 2</h2><p>Tiếp tục quy trình B → A → X với idea thứ hai.</p></div></div>${['b2','a2','x2'].map(stepCard).join('')}${vocabulary(2)}</section>`:'<div id="idea2" class="lock-note">◌ &nbsp; Ý 2 sẽ mở sau khi bạn hoàn thiện ý 1 và nhấn tiếp tục.</div>'}`;
  const topicDone=state.steps.topic.status==='passed',oneDone=ideaPassed(state,1),twoDone=ideaPassed(state,2);
  $('journey-nav').innerHTML=[['prompt','Đề bài','Đọc đề','?',false,true],['topic','Ý tưởng & Topic','Chốt cả hai idea','1',topicDone,true],['idea1','Lập luận ý 1','B → A → X','2',oneDone,topicDone],['idea2','Lập luận ý 2','B → A → X','3',twoDone,state.idea2Open]].map(([id,title,sub,num,done,enabled])=>`<button class="nav-item ${done?'done':''} ${id==='topic'&&!topicDone||id==='idea1'&&topicDone&&!oneDone||id==='idea2'&&state.idea2Open?'active':''}" data-target="${id}" ${enabled?'':'disabled'}><span>${done?'✓':num}</span><span>${title}<small>${sub}</small></span></button>`).join('');
  $('completion').hidden=!twoDone;
  if(twoDone)$('completion').innerHTML=`<article class="completed"><span class="badge passed">✓ Cả hai ý đã đạt</span><h2>Bạn đã hoàn thiện khung lập luận.</h2><p>Topic sentence và hai chuỗi A–X–B đã sẵn sàng để bạn tự viết thân bài 2.</p><details><summary>Xem toàn bộ khung lập luận của bạn</summary><div class="context-chain"><div><b>TS</b><span>${escape(state.responses.topicSentence)}</span></div></div>${[1,2].map(n=>`<h3>Ý ${n}</h3><div class="context-chain">${['a','x','b'].map(k=>`<div><b>${k.toUpperCase()}</b><span>${escape(state.responses[k+n])}</span></div>`).join('')}</div>`).join('')}</details></article>`;
}
function focusSection(key){const el=$('step-'+key)||$(key);if(el){el.scrollIntoView({behavior:'auto',block:'start'});const text=el.querySelector('textarea:not(:disabled)');text?.focus({preventScroll:true});}}
function feedbackFor(key,passed){
  if(key==='topic')return passed?'Câu chủ đề đã bám việc mua đồ không cần thiết và bao quát cả tác hại tài chính lẫn môi trường. Giữ nguyên câu và bắt đầu chốt điểm cuối của ý 1.':'Câu chủ đề cần cho thấy cả hai idea, thay vì chỉ nói chung rằng việc này không tốt. Hai tác hại em đã chọn là gì? Hãy tự viết lại câu để người đọc thấy cả hai.';
  const n=key.at(-1);
  const data={b:passed?'Điểm cuối đã cụ thể: người đọc hình dung được kết quả mà ý này muốn chứng minh. Giữ B và kiểm điểm đầu A.':'Điểm cuối còn chung nên người đọc khó hình dung điều xảy ra. Ai chịu tác động, và tác động cụ thể đó là gì? Hãy chốt một kết quả rõ hơn.',a:passed?'Điểm đầu đã tả đúng việc mua hoặc thay đồ không cần thiết, bám trọng tâm đề. Giữ A và B, rồi tìm cầu nối X.':'Điểm đầu chưa tả rõ việc mua đồ không cần thiết. Chi tiết nào cho thấy món đồ mới không thật sự cần dùng? Hãy tự làm rõ điểm bắt đầu này.',x:passed?'X đã giải thích được cơ chế từ hành động ở A tới kết quả ở B. Giữ nguyên chuỗi A–X–B; em có thể xem từ vựng cho ý này.':'Giữa A và B vẫn thiếu một bước giải thích. Việc ở A làm điều gì thay đổi ngay trước khi B xảy ra? Hãy viết rõ cơ chế đó, giữ nguyên A và B.'};
  return `Ý ${n}: ${data[key[0]]}`;
}
$('workspace').addEventListener('input',event=>{
  const f=event.target.dataset.field;if(!f)return;
  const key=ORDER.find(k=>FIELDS[k].includes(f));
  if(setField(state,key,f,event.target.value)) {
    $('save-state').textContent='Đang giữ nháp…';clearTimeout(saveTimer);saveTimer=setTimeout(save,500);
    const count=document.querySelector(`[data-count="${key}"]`);if(count)count.textContent=FIELDS[key].reduce((total,field)=>total+state.responses[field].trim().split(/\s+/).filter(Boolean).length,0)+' từ';
  }
});
$('workspace').addEventListener('click',event=>{
  const button=event.target.closest('button');if(!button)return;
  if(button.dataset.target){$(button.dataset.target)?.scrollIntoView({behavior:'auto'});return;}
  if(button.id==='next-idea'){if(openIdea2(state)){render();save();focusSection('b2');}return;}
  const key=button.dataset.check;if(!key)return;
  const response=beginCheck(state,key,crypto.randomUUID());
  if(!response.ok){const error=$('error-'+key);if(error){error.hidden=false;error.textContent=response.error==='EMPTY'?'Hãy nhập nội dung vào các ô màu vàng trước khi Check.':'Bước này chưa sẵn sàng để chấm.';}if(response.field)$('field-'+response.field)?.focus();return;}
  let result=$('demo-result').value;
  if(result==='script')result=state.steps[key].history.length?'passed':'revision';
  render();save();
  // Giả lập thời gian chờ; vé chứa generation để kết quả muộn không ghi sang người/bài khác.
  setTimeout(()=>{
    if(finishCheck(state,response.ticket,result,feedbackFor(key,result==='passed'))){render();save();message(result==='passed'?'Đã đạt · phần tiếp theo được mở':result==='revision'?'Có nhận xét mới · hãy sửa ô đang làm':'Chưa chấm xong · bài của bạn vẫn được giữ');}
  },1100);
});
window.addEventListener('pagehide',()=>{if(student){clearTimeout(saveTimer);save();}});

// Nhận bản chụp từ máy chủ cục bộ, dựng giao diện theo preset Thủy.
// Mọi nút ghi chỉ gọi /api/demo; nháp được gắn đúng người, buổi và lần giao bài.
import {SKILLS,itemsOf,applicable,personJourney,priority,quizScore,practiceReport,speakingSummary} from './model.mjs';
import {localAPI,preparePages,pagesAPI} from './pages-adapter.mjs';
import {journeyScenarios,scenarioSummary} from './journey-scenarios.mjs';
import {testScenario} from './test-scenarios.mjs';
import {loadEditor,sourceDraft,toDefinition} from './editor-bridge.mjs';
const {reviewItems}=await import(localAPI?'/shared/answer-review.js':'../answer-review.js');
if(!localAPI)await preparePages();

const app=document.querySelector('#app'), dialog=document.querySelector('#dialog');
const q=new URLSearchParams(location.hash.includes('view=')?location.hash.slice(1):location.search), isStudent=q.get('view')==='student';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date=v=>v?new Date(`${String(v).slice(0,10)}T12:00:00+07:00`).toLocaleDateString('vi-VN',{day:'2-digit',month:'2-digit'}):'—';
const time=v=>v?new Date(v).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',hour:'2-digit',minute:'2-digit',day:'2-digit',month:'2-digit',year:'numeric'}):'—';
const pct=v=>Number.isFinite(v)?`${Math.round(v*10)/10}%`:'—';
const initials=name=>name.trim().split(/\s+/).slice(-2).map(s=>s[0]).join('').toUpperCase();
const badge=(text,type='')=>`<span class="badge ${type}">${esc(text)}</span>`;
const studentURL=(ref='demo-a',number=10)=>`./${localAPI?'?':'#'}view=student&ref=${encodeURIComponent(ref)}&number=${number}`;
let toastTimer;
function toast(message){const e=document.querySelector('#toast');e.textContent=message;e.className='show';clearTimeout(toastTimer);toastTimer=setTimeout(()=>e.className='',5000);}
async function api(path,body){if(!localAPI)return pagesAPI(path,body);const r=await fetch(path,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{});const data=await r.json();if(!r.ok)throw new Error(data.error||'Không tải được dữ liệu.');return data;}
function modal(title,body,foot=''){dialog.innerHTML=`<div class="dialogHead"><h2 id="dialog-title">${esc(title)}</h2><button class="iconBtn" data-close-dialog aria-label="Đóng">×</button></div><div class="dialogBody">${body}</div>${foot?`<div class="dialogFoot">${foot}</div>`:''}`;dialog.showModal();}
function empty(title,text){return `<div class="empty"><h3>${esc(title)}</h3><p>${esc(text)}</p></div>`;}
function allCourse(){return [...t.data.sessions,...(t.data.courseSessions||[])].sort((a,b)=>b.number-a.number);}
function testRecord(ref,slug){return t.data.testResults?.find(v=>v.studentRef===ref&&v.result.testSlug===slug)?.result||(t.showTestScenarios?testScenario(ref,slug):null);}
const testTypes=[['mini-test-lesson-5','Mini Test'],['term-test-1','Term Test 1'],['term-test-2','Term Test 2']];
function testCell(ref,slug,skill){const result=testRecord(ref,slug),score=result?.[skill];return score?`<b>${esc(score.correct)} / ${esc(score.total)}</b>${score.band!=null?`<div class="nameMeta">Band ${esc(score.band)}</div>`:''}${result.synthetic?`<div>${badge('Dữ liệu giả','amber')}</div>`:''}`:'<small>Chưa có điểm</small>';}
function writingCell(ref,slug){const record=testRecord(ref,slug),result=record?.writing;return `<b>${result?.score!=null?esc(result.score)+' / 9':'Chưa có điểm'}</b>${record?.synthetic?`<div>${badge('Dữ liệu giả','amber')}</div>`:''}${[1,2].map(task=>{const text=result?.tasks?.[task]?.feedback;return `<div class="writingTask"><small>Task ${task}</small>${text?`<p class="originalExcerpt">${esc(text)}</p><button class="rowLink" data-read-writing="${esc(ref)}" data-test="${slug}" data-task="${task}">Đọc đủ</button>`:'<p class="caption">Chưa có nhận xét</p>'}</div>`;}).join('')}`;}
function saveLibrary(value,status,render=true){const saved=window.ProgressLogLibraryModel.saveForm(t.library,value,status);if(status==='published')toDefinition(saved.form);t.library=saved.state;t.editing=false;if(render)renderTeacher();return saved.form;}
async function editLibrary(value){await loadEditor();t.page='library';renderTeacher();t.editing=true;window.ProgressLogExerciseEditor.open(value||window.ProgressLogLibraryModel.createDraft(),{cancel:()=>{saveLibrary(window.ProgressLogExerciseEditor.current(),'draft');toast('Đã giữ nháp trong phiên demo.');},save:(draft,status)=>{saveLibrary(draft,status);toast(status==='draft'?'Đã giữ nháp trong phiên demo':'Đã xuất bản vào Của tôi trong demo');}});}
function readonly(detail,blocks=detail.definition.blocks){
  const definition={...detail.definition,blocks:blocks.map(b=>({...b,items:b.items.map(i=>({...i,required:false}))}))};
  const responses={...detail.responses};
  for(const item of blocks.flatMap(b=>b.items))if(item.interactionType==='matching'&&responses[item.itemVersionId]){const pairs=item.interactionConfig.pairs||[],value=responses[item.itemVersionId];responses[item.itemVersionId]=pairs.map((pair,n)=>`${pair.left} → ${value[n]!==undefined&&value[n]!==''?pairs[Number(value[n])]?.right||'Chưa trả lời':'Chưa trả lời'}`).join('\n');}
  let output=reviewItems({...detail,definition,responses}),index=0;
  const key=detail.answerKey||(!isStudent?allCourse().find(v=>v.number===detail.sessionNumber)?.answerKey||activeSession()?.answerKey:{}),items=blocks.flatMap(b=>b.items);
  output=output.replaceAll('</article>',()=>{const item=items[index++],answer=key?.[item.itemVersionId],label=answer?.graderType==='exact_option'?item.options?.find(o=>o.id===answer.expectedOptionId)?.label:answer?.graderType==='exact_options'?answer.expectedOptions.map(id=>item.options.find(o=>o.id===id)?.label||id).join(' · '):answer?.graderType==='exact_text'?answer.expectedText:answer?.graderType==='exact_matching'?answer.pairs.map(p=>p.left+' → '+p.right).join('\n'):'';return (label&&applicable(item,detail.responses||{})?`<p class="correctAnswer"><b>Đáp án chuẩn:</b> ${esc(label)}</p>`:'')+'</article>';});
  return output;
}
function progress(p,session){return `${p.checkpoints.length}/${session.definition.blocks.length} phần`;}
const t={data:null,number:Number(q.get('number')||10),tab:'session',skill:'listening',page:'class',selected:null,search:'',filter:'all',showFixture:false,showScenarios:true,showTestScenarios:true,drafts:new Map(),pending:null,timer:null,saveError:false,library:{version:1,forms:[],assignments:[]},editing:false};
const s={data:null,number:Number(q.get('number')||10),ref:q.get('ref')||'demo-a',tab:'session',responses:{},expanded:new Set(),pending:null,timer:null,dirty:false,saveError:false,failNext:false,showTestScenarios:true,identityStage:'choose',identityChoice:null};
const activeSession=()=>t.data.sessions.find(v=>v.number===t.number)||t.data.sessions[0];
const feedbackKey=(session,ref)=>`${session.number}:${session.generation}:${ref}`;
function teacherFeedback(session,ref){const key=feedbackKey(session,ref),published=session.students.find(p=>p.studentRef===ref)?.publishedFeedback||'';return t.data.feedback[key]||{draft:published,published};}
async function refreshTeacher(){t.data=await api('/api/teacher');if(!t.data.sessions.some(v=>v.number===t.number))t.number=t.data.sessions[0].number;renderTeacher();}
async function teacherSave(publish=false){
  clearTimeout(t.timer);if(t.pending)await t.pending;
  const session=activeSession(),ref=t.selected;if(!ref)return;
  const key=feedbackKey(session,ref),text=t.drafts.get(key);
  if(text===undefined)return;
  if(!publish && text===teacherFeedback(session,ref).draft){t.saveError=false;return;}
  const body={action:publish?'feedbackPublish':'feedbackDraft',number:session.number,generation:session.generation,ref,text};
  t.pending=api('/api/demo',body).then(result=>{t.data.feedback[key]=result;t.saveError=false;const label=document.querySelector('#feedback-state');if(label)label.textContent=publish?'Đã hiển thị cho học viên trong demo':'Đã giữ nháp riêng · Chưa hiển thị cho học viên';}).catch(error=>{t.saveError=true;const label=document.querySelector('#feedback-state');if(label){label.textContent=error.message;label.classList.add('saveError');}throw error;}).finally(()=>t.pending=null);
  await t.pending;
  if(publish){toast('Đã hiển thị nhận xét trong demo.');renderTeacher();}
}
async function changeTeacher(fn){
  if(t.editing){const draft=window.ProgressLogExerciseEditor.current();saveLibrary(draft,'draft',false);t.editing=false;}
  const focus=document.activeElement,tabGroup=focus?.closest('[role="tablist"]')?.getAttribute('aria-label'),selected=t.selected;
  const closing=focus?.dataset.action==='close-detail';
  await teacherSave();fn();renderTeacher();
  if(tabGroup)document.querySelector(`[role="tablist"][aria-label="${tabGroup}"] [aria-selected="true"]`)?.focus({preventScroll:true});
  if(closing&&selected)document.querySelector(`button[data-person="${selected}"]`)?.focus({preventScroll:true});
}
function attendanceState(p){
  const received=Boolean(p.checkpoints.length||p.submitted);
  const confirmed=p.portal?.status==='complete'&&Boolean(p.portal.readbackAt)&&!p.portal.reviewRequired;
  return {received,confirmed,label:confirmed?'Đã điểm danh':received?'Đã nhận bài':'Chưa nhận bài'};
}
function attendanceLabel(p){
  const state=attendanceState(p);
  return `<button class="attendanceStatus" data-attendance-ref="${esc(p.studentRef)}" aria-label="${esc(p.name)}: ${state.label}. Xem chi tiết điểm danh">${badge(state.label,state.confirmed?'green':state.received?'blue':'')}${p.portal?.reviewRequired?'<small>Cần kiểm tra</small>':''}</button>`;
}
// Chỉ hiện dấu nhắc khi bảng còn hàng nằm dưới màn hình; tính lại khi cuộn/lọc/đổi kích thước.
let peopleScrollFrame;
function updatePeopleScrollCue(){
  cancelAnimationFrame(peopleScrollFrame);
  peopleScrollFrame=requestAnimationFrame(()=>{
    const cue=document.querySelector('[data-scroll-people]'),table=document.querySelector('.progressTable');
    if(!cue||!table)return;
    const remaining=[...table.querySelectorAll('tbody tr')].filter(row=>row.getBoundingClientRect().bottom>innerHeight-64).length;
    cue.hidden=!remaining||table.getBoundingClientRect().top>=innerHeight||table.getBoundingClientRect().bottom<=0;
    cue.textContent=`Còn ${remaining} học viên phía dưới ↓`;
  });
}
window.addEventListener('scroll',updatePeopleScrollCue,{passive:true});
window.addEventListener('resize',updatePeopleScrollCue);
// Hai việc cùng một trang: lối vào có mô tả, thanh chuyển nhanh khi cuộn; không dựng lại bài/nháp.
let resultsNavigationFrame;
function updateResultsNavigation(){
  cancelAnimationFrame(resultsNavigationFrame);
  resultsNavigationFrame=requestAnimationFrame(()=>{
    const entries=document.querySelector('.resultsEntries'),bar=document.querySelector('.resultsQuickBar');
    if(!entries||!bar){document.body.classList.remove('results-nav-pinned');return;}
    const rect=entries.getBoundingClientRect(),pinned=rect.top<8;
    bar.style.left=`${rect.left}px`;bar.style.width=`${rect.width}px`;bar.hidden=!pinned;
    entries.classList.toggle('isPast',pinned);document.body.classList.toggle('results-nav-pinned',pinned);
    if(pinned)document.documentElement.style.setProperty('--results-nav-offset',`${bar.offsetHeight+24}px`);
    const active=document.querySelector('#results-people').getBoundingClientRect().top<=(pinned?bar.getBoundingClientRect().bottom+32:rect.bottom+32)?'people':'questions';
    for(const button of document.querySelectorAll('[data-results-jump]')){
      if(button.dataset.resultsJump===active)button.setAttribute('aria-current','location');else button.removeAttribute('aria-current');
    }
  });
}
function scrollToResults(section){
  const target=document.querySelector(section==='people'?'#results-people':'#results-questions'),bar=document.querySelector('.resultsQuickBar'),entries=document.querySelector('.resultsEntries');
  if(!target||!bar||!entries)return;
  const rect=entries.getBoundingClientRect();bar.style.left=`${rect.left}px`;bar.style.width=`${rect.width}px`;bar.hidden=false;
  const offset=bar.offsetHeight+24;document.documentElement.style.setProperty('--results-nav-offset',`${offset}px`);
  target.focus({preventScroll:true});
  window.scrollTo({top:scrollY+target.getBoundingClientRect().top-offset,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
  updateResultsNavigation();
}
window.addEventListener('scroll',updateResultsNavigation,{passive:true});
window.addEventListener('resize',updateResultsNavigation);
function teacherShell(content){
  return `<aside class="side"><div class="brand"><div class="logo">IZONE</div><small>IELTS CHIẾN LƯỢC</small></div><div class="navLabel">PROGRESS LOG</div><button class="navButton ${t.page==='class'?'active':''}" data-page="class">Quản lý lớp</button><button class="navButton ${t.page==='library'?'active':''}" data-page="library">Quản lý bài tập</button><a class="navButton" target="_blank" rel="noopener" href="${studentURL('demo-a',t.number)}">Cổng học viên ↗</a><div class="sideFoot"><small>Không gian giảng viên</small><p>Thủy · IZONE</p></div></aside><header class="topbar"><span>Quản lý lớp / IC2305${t.tab==='session'?` / Buổi ${t.number}`:''}</span><span>Giảng viên · Thủy</span></header><main class="workspace">${content}</main>`;
}
function renderTeacher(){
  document.body.className='teacher-screen';
  const session=activeSession(),union=t.data.people.length;
  const footer=`<footer class="demoFooter"><span>IZONE · Progress Log · Bản chụp thật ${time(t.data.capturedAt)}</span><details><summary>Thông tin bản demo</summary><div><p>Theo dõi buổi 8–10; Hành trình dùng ${t.data.sessions.length+(t.data.courseSessions?.length||0)} phiếu đang có của khóa. Thao tác thử chỉ giữ trong phiên demo, không ghi lớp thật hoặc Portal. ${localAPI?'':'Đóng trang cuối sẽ bỏ các thao tác thử; file dữ liệu gốc vẫn giữ nguyên.'}</p><button class="btn small" data-action="coverage">Nguồn dữ liệu và phần còn thiếu</button><div class="actions"><button class="btn small quiet" data-action="answers">${session.showAnswers?'Ẩn':'Mở'} đáp án trong demo</button><button class="btn small" data-action="history">Lịch sử thu hồi${session.retired.length?` (${session.retired.length})`:''}</button><button class="btn small" data-action="reset">Đặt lại demo</button></div></div></details></footer>`;
  if(t.page==='library'){
    const values=t.data.sessions.filter(v=>!t.search||v.title.toLocaleLowerCase('vi').includes(t.search.toLocaleLowerCase('vi')));
    app.innerHTML=teacherShell(`<div id="libraryView"><div class="pageHeading"><h1>Quản lý bài tập</h1><button class="btn primary" data-editor-new>+ Tạo bài tập</button></div><section class="panel"><div class="repoSources"><button aria-pressed="true">Phiếu đã dùng <span>3</span></button><button data-library-mine>Của tôi <span>${t.library.forms.length}</span></button></div><div class="tableTools"><input class="search" data-search aria-label="Tìm bài tập" placeholder="Tìm bài tập" value="${esc(t.search)}"><span class="caption">${values.length} bài tập · Nội dung thật</span></div><div class="tableScroll"><table class="repoTable"><thead><tr><th>Tên bài tập</th><th>Kỹ năng</th><th></th></tr></thead><tbody>${values.map(v=>`<tr><td><button class="rowLink" data-library="${v.number}">${esc(v.title)}</button><div class="nameMeta">Buổi ${v.number} · ${date(v.date)} · ${itemsOf(v.definition).length} câu</div></td><td><div class="inline">${[...new Set(itemsOf(v.definition).flatMap(i=>i.skillCodes||[]))].filter(k=>SKILLS[k]).map(k=>badge(SKILLS[k],'blue')).join('')}</div></td><td><button class="btn small" data-library="${v.number}">Xem phiếu</button><button class="btn small" data-editor-copy="${v.number}">Tạo bản riêng</button></td></tr>`).join('')}</tbody></table></div></section><section class="panel ownForms" id="own-forms"><div class="panelHead"><h2>Của tôi · Bài soạn trong demo</h2></div>${t.library.forms.length?`<div class="tableScroll"><table><thead><tr><th>Bài tập</th><th>Trạng thái</th><th></th></tr></thead><tbody>${t.library.forms.map(form=>`<tr><td>${esc(form.title)}<div class="nameMeta">${form.questions.length} câu · Bản ${form.revision}</div></td><td>${badge(form.status==='draft'?'Nháp':'Đã xuất bản trong demo',form.status==='draft'?'':'green')}</td><td><button class="btn small" data-editor-form="${form.id}">Sửa</button><button class="btn small" data-preview-form="${form.id}">Xem trước</button></td></tr>`).join('')}</tbody></table></div>`:empty('Chưa có bài riêng','Tạo bài mới hoặc tạo bản riêng từ phiếu thật. Không có bài mẫu được tự thêm.')}</section></div>${footer}`);return;
  }
  const context=`<div class="classContextToolbar"><div class="classContext"><select class="select" aria-label="Chọn lớp"><option>IC2305</option></select>${t.tab==='session'?`<select class="select sessionSelect" aria-label="Chọn buổi học" data-teacher-session>${t.data.sessions.map(v=>`<option value="${v.number}" ${v.number===t.number?'selected':''}>Buổi ${v.number}</option>`).join('')}</select>`:''}<span class="caption">${t.tab==='session'?session.students.length:union} học viên${t.tab==='journey'?' · Đến buổi 10':''}</span></div><div class="managementTabs" role="tablist" aria-label="Quản lý lớp"><button role="tab" tabindex="${t.tab==='session'?0:-1}" aria-selected="${t.tab==='session'}" data-tab="session">Theo dõi buổi học</button><button role="tab" tabindex="${t.tab==='journey'?0:-1}" aria-selected="${t.tab==='journey'}" data-tab="journey">Hành trình lớp</button></div></div>`;
  app.innerHTML=teacherShell(context+(t.tab==='session'?sessionView(session):journeyView())+footer);
  updatePeopleScrollCue();
  updateResultsNavigation();
}
function sessionView(session){
  const mode=t.mode||'progress';
  const header=`<div class="lessonHeaderGrid"><section class="lessonOverview"><h1>${esc(session.title)}</h1><div class="lessonDeadline"><strong>${sourceDeadline(session.number)}</strong><span>Nộp phần đầu thành công được ghi nhận tham gia</span></div><div class="actions"><button class="btn small danger" data-action="replace">Thay bài tập</button><a class="btn small quiet" target="_blank" rel="noopener" href="${studentURL('demo-a',session.number)}">Xem phía học viên ↗</a></div></section><div class="teacherParts">${session.definition.blocks.map((block,index)=>{
    const open=session.releases.find(r=>r.blockId===block.blockId)?.status==='open',submitted=session.students.filter(p=>p.submitted||p.checkpoints.some(c=>c.blockId===block.blockId)).length;
    const started=session.students.filter(p=>p.submitted||p.checkpoints.some(c=>c.blockId===block.blockId)||block.items.some(i=>p.draftResponses[i.itemVersionId]!=null)).length;
    return `<section class="teacherPart"><div class="partHead"><div><h3>${esc(block.title)}</h3><p>${open?`${started}/${session.students.length} đã bắt đầu · ${submitted}/${session.students.length} đã nộp`:'Đang đóng'}</p></div><button class="btn small ${open?'':'primary'}" data-release="${esc(block.blockId)}" aria-pressed="${open}" aria-label="${open?'Đóng':'Mở'} phần ${index+1}">${open?'Đóng':'Mở'}</button></div><div class="track"><i style="width:${submitted/session.students.length*100}%"></i></div></section>`;
  }).join('')}</div></div>`;
  const tabs=`<div class="sessionTabs" role="tablist" aria-label="Kết quả và tiến độ buổi học"><button role="tab" aria-selected="${mode==='progress'}" tabindex="${mode==='progress'?0:-1}" data-session-mode="progress">Tiến độ</button><button role="tab" aria-selected="${mode==='results'}" tabindex="${mode==='results'?0:-1}" data-session-mode="results">Kết quả</button></div>`;
  const tools=`<div class="inline"><select class="select" aria-label="Lọc trạng thái" data-filter><option value="all" ${t.filter==='all'?'selected':''}>Tất cả học viên</option><option value="final" ${t.filter==='final'?'selected':''}>Đã nộp cuối</option><option value="pending" ${t.filter==='pending'?'selected':''}>Chưa nộp cuối</option></select><input class="search" aria-label="Tìm học viên" placeholder="Tìm học viên" value="${esc(t.search)}" data-search></div>`;
  const progressPanel=`<section class="panel"><div class="panelHead"><h2>Tiến độ học viên</h2>${tools}</div><div class="tableScroll"><table class="progressTable"><thead><tr><th>Học viên</th>${session.definition.blocks.map((b,i)=>`<th>Phần ${i+1}</th>`).join('')}<th>Điểm danh</th></tr></thead><tbody>${visiblePeople().map(p=>`<tr><td><b>${esc(p.name)}</b></td>${session.definition.blocks.map(b=>`<td>${p.submitted||p.checkpoints.some(c=>c.blockId===b.blockId)?badge('Đã nộp','green'):b.items.some(i=>p.draftResponses[i.itemVersionId]!=null)?badge('Đang làm','blue'):badge('Chưa bắt đầu')}</td>`).join('')}<td>${attendanceLabel(p)}</td></tr>`).join('')}</tbody></table></div><div class="tableFoot">${visiblePeople().length}/${session.students.length} học viên trong danh sách · ${session.students.filter(p=>p.submitted).length}/${session.students.length} đã nộp cuối · Bấm trạng thái điểm danh để xem chi tiết.</div><button class="peopleScrollCue" data-scroll-people hidden></button></section>`;
  const entries=`<nav class="resultsEntries" aria-label="Hai cách xem kết quả buổi học"><button class="resultsEntry" data-results-jump="questions"><strong>Thống kê câu hỏi <span aria-hidden="true">↓</span></strong></button><button class="resultsEntry" data-results-jump="people"><strong>Kết quả từng học viên <span aria-hidden="true">↓</span></strong></button></nav><nav class="resultsQuickBar" aria-label="Chuyển nhanh giữa hai phần kết quả" hidden><button data-results-jump="questions">Thống kê câu hỏi</button><button data-results-jump="people">Kết quả từng học viên</button></nav>`;
  const results=`${entries}${questionSummary(session)}<div class="split ${t.selected?'hasDetail':''}" id="results-people" tabindex="-1"><section class="panel listPanel"><div class="panelHead"><h2>Kết quả từng học viên</h2>${tools}</div>${sessionTable(session)}</section>${t.selected?detailPanel():''}</div>`;
  return header+(session.replacement?'<div class="notice simulated">Đã thay bài trong demo. Bài cũ chỉ ở Lịch sử thu hồi của giảng viên.</div>':'')+tabs+(mode==='progress'?progressPanel:results);
}
function questionSummary(session){
  const values=session.analytics.filter(i=>i.objective).sort((a,b)=>(b.counts.incorrect/(b.counts.correct+b.counts.incorrect)||0)-(a.counts.incorrect/(a.counts.correct+a.counts.incorrect)||0));
  if(!values.some(v=>v.id===t.question))t.question=values[0]?.id;
  const selected=values.find(v=>v.id===t.question),flat=itemsOf(session.definition),item=flat.find(v=>v.itemVersionId===t.question);
  const list=values.length?[true,false].map(wrong=>`<div class="questionGroup"><h3>${wrong?'Các câu sai cần chữa':'Các câu lớp đã làm đúng'} ${badge(values.filter(v=>(v.counts.incorrect>0)===wrong).length+' câu')}</h3>${values.filter(v=>(v.counts.incorrect>0)===wrong).map(v=>{const i=flat.find(i=>i.itemVersionId===v.id),index=i.displayNumber??i.position??flat.indexOf(i)+1,block=session.definition.blocks.find(b=>b.items.includes(i)),total=v.counts.correct+v.counts.incorrect;return `<button class="questionRow ${t.question===v.id?'selected':''}" data-select-question="${esc(v.id)}"><span>Câu ${index}</span><span class="questionLabel">${esc(v.prompt)}<small>Phần ${session.definition.blocks.indexOf(block)+1} · ${(i?.skillCodes||[]).map(k=>SKILLS[k]).filter(Boolean).join(' · ')} · Trắc nghiệm</small></span><span class="questionMetric ${wrong?'wrong':'correct'}">${v.counts.incorrect}/${total} sai<small>${pct(total?v.counts.incorrect/total*100:null)} sai</small></span></button>`;}).join('')}</div>`).join(''):empty('Chưa có kết quả','Bài thay thế bắt đầu mới.');
  const answer=session.answerKey?.[item?.itemVersionId]?.expectedOptionId;
  const detail=selected?`<section class="questionDetailFrame"><div class="questionDetailActions"><button class="btn primary small" data-question="${esc(selected.id)}">Xem phân bố và học viên</button><span class="caption">${selected.counts.incorrect}/${selected.counts.correct+selected.counts.incorrect} sai · ${pct(selected.counts.incorrect/(selected.counts.correct+selected.counts.incorrect)*100)}</span></div><div class="questionDetail" tabindex="0" aria-label="Nội dung câu hỏi, cuộn để đọc đủ"><div class="inline"><small>Câu ${item.displayNumber??item.position??flat.indexOf(item)+1} · Trắc nghiệm</small>${badge(selected.counts.incorrect?'Cần chữa':'Cả lớp đã làm đúng')}</div><h3>${esc(item.prompt)}</h3>${item.helpText?`<p class="reviewInstructions">${esc(item.helpText)}</p>`:''}<div class="answerOptions">${item.options.map(o=>`<div class="${answer===o.id?'correctOption':''}">${esc(o.label)}${answer===o.id?' <b>✓ Đáp án chuẩn</b>':''}</div>`).join('')}</div>${!answer?'<p class="caption">Nguồn chưa có khóa đáp án cho câu này; không suy từ lượt chọn.</p>':''}<details class="calculationHelp"><summary>Cách thống kê</summary><p>Chỉ dùng câu đã có kết quả chấm. Chưa chấm và câu không áp dụng không vào mẫu số; câu áp dụng để trống tính sai.</p></details></div></section>`:'';
  return `<section class="panel questionPanel" id="results-questions" tabindex="-1"><div class="panelHead"><h2>Thống kê theo câu hỏi</h2></div><div class="questionWorkspace"><div class="questionList">${list}</div>${detail}</div></section>`;
}
function visiblePeople(){const session=activeSession();return session.students.filter(p=>(!t.search||p.name.toLocaleLowerCase('vi').includes(t.search.toLocaleLowerCase('vi')))&&(t.filter==='all'||(t.filter==='final'?p.submitted:!p.submitted)));}
function sessionTable(session){
  const people=visiblePeople(),reportSkills=['listening','reading'].filter(skill=>itemsOf(session.definition).some(i=>i.interactionType==='number_score'&&i.skillCodes?.includes(skill)));
  return `<div class="tableScroll" id="people-scroll" tabindex="0" aria-label="Kết quả từng học viên, cuộn ngang để xem đủ cột"><table><thead><tr><th>Học viên</th>${reportSkills.map(k=>`<th class="scoreCell">${SKILLS[k]}<div class="nameMeta">Tự báo số câu đúng</div></th>`).join('')}<th class="scoreCell">Quiz<div class="nameMeta">Điểm tự chấm phiếu</div></th><th>Speaking</th></tr></thead><tbody>${people.map(p=>{const feedback=teacherFeedback(session,p.studentRef).published;return `<tr data-person="${esc(p.studentRef)}" class="${t.selected===p.studentRef?'selected':''}"><td>${nameCell(p)}</td>${reportSkills.map(k=>`<td class="scoreCell">${p.reports[k]?`<b>${p.reports[k].correct}</b> / ${p.reports[k].total}`:'<small>Chưa có số liệu</small>'}</td>`).join('')}<td class="scoreCell">${p.quiz?`<b>${p.quiz.earned}</b> / ${p.quiz.max}`:'<small>Chưa có kết quả</small>'}</td><td>${feedback?`<div class="feedbackPreview">${esc(feedback)}</div>`:'<small>Chưa có nhận xét</small>'}</td></tr>`;}).join('')}</tbody></table>${!people.length?'<p class="noResults">Không có học viên khớp bộ lọc.</p>':''}</div>`;
}
function nameCell(p){return `<button class="rowLink" data-person="${esc(p.studentRef)}">${esc(p.name)}</button>${p.synthetic?`<div>${badge('Dữ liệu giả','amber')}</div>`:''}${p.discriminator?`<div class="nameMeta">${esc(p.discriminator)}</div>`:''}`;}
function journeyPeople(){
  const real=t.data.people.map(p=>({...p,summary:personJourney(t.data,p.studentRef,t.skill)}));
  return t.showScenarios&&['listening','reading'].includes(t.skill)?[...real,...journeyScenarios.map(p=>({...p,summary:scenarioSummary(p,t.skill)}))]:real;
}
function journeyView(){
  const lr=['listening','reading'].includes(t.skill),all=journeyPeople();
  let rows=all.filter(p=>(!t.search||p.name.toLocaleLowerCase('vi').includes(t.search.toLocaleLowerCase('vi')))&&(!t.group||t.group==='all'||(t.group==='priority'?p.summary.flagged:p.summary.count===0)));
  rows.sort((a,b)=>Number(b.summary.flagged)-Number(a.summary.flagged)||Number(a.summary.count===0)-Number(b.summary.count===0)||(t.order==='score'?(a.summary.average??101)-(b.summary.average??101):a.name.localeCompare(b.name,'vi')));
  const skills=`<div class="skillTabs" role="tablist" aria-label="Kỹ năng của lớp">${Object.entries(SKILLS).map(([k,name])=>`<button class="skillTab ${t.skill===k?'active':''}" role="tab" aria-selected="${t.skill===k}" tabindex="${t.skill===k?0:-1}" data-skill="${k}">${name}</button>`).join('')}</div>`;
  const header=`<div class="panelHead"><h2>${SKILLS[t.skill]} · Kết quả lớp</h2><label class="sortLabel">Sắp xếp <select class="select" data-journey-order aria-label="Sắp xếp học viên"><option value="name" ${t.order!=='score'?'selected':''}>Tên A–Z</option><option value="score" ${t.order==='score'?'selected':''}>Tỷ lệ tăng dần</option></select></label></div>`;
  const filters=lr?`<div class="journeyFilters">${[['all',`Tất cả (${all.length})`],['priority',`Ưu tiên xem (${all.filter(p=>p.summary.flagged).length})`],['missing',`Chưa có dữ liệu (${all.filter(p=>!p.summary.count).length})`]].map(([key,label])=>`<button class="btn small" data-journey-group="${key}" aria-pressed="${(t.group||'all')===key}">${label}</button>`).join('')}<span class="caption">Ưu tiên xem trước</span></div>`:'';
  let body;
  if(lr)body=`${filters}<div class="tableScroll" id="people-scroll" tabindex="0" aria-label="Kết quả ${SKILLS[t.skill]} của lớp"><table class="journeyScores"><thead><tr><th>Học viên</th><th>TB tỷ lệ đúng<br>Progress Log cả khóa</th><th>Mini Test</th><th>Term Test 1</th><th>Term Test 2</th></tr></thead><tbody>${rows.map(p=>`<tr data-person="${esc(p.studentRef)}" class="${t.selected===p.studentRef?'selected':''}"><td>${nameCell(p)}${p.summary.flagged?`<span class="priorityLabel">Ưu tiên xem</span><div class="nameMeta">TB ${pct(p.summary.recentAverage)} · ${p.summary.recent.map(v=>'B'+v.sessionNumber).join(', ')}</div>`:''}</td><td><b class="numeric">${pct(p.summary.average)}</b><div class="nameMeta">${p.summary.count} buổi hợp lệ${p.summary.count<3?' · Chưa đủ 3 buổi để xét ưu tiên':''}</div></td>${testTypes.map(([slug])=>`<td>${testCell(p.studentRef,slug,t.skill)}</td>`).join('')}</tr>`).join('')}</tbody></table></div><details class="calculationHelp"><summary>Cách tính và phạm vi dữ liệu</summary><p>TB cả khóa lấy các phiếu hiện có từ buổi 2 đến 10; chưa có phiếu buổi 1 và 7. Mỗi buổi có số tự báo hợp lệ có trọng số bằng nhau. Nhãn ưu tiên xét TB ba buổi gần nhất cùng kỹ năng dưới 60%, chưa đủ ba lần thì chưa đánh dấu. Chưa nộp không thành 0%; không lấy quiz hoặc Test thay số tự báo.</p><p>Nguồn buổi 4 có tên bài Listening nhưng hai ô tự báo được gắn kỹ năng Reading. Demo giữ mã kỹ năng của nguồn và ghi rõ bất nhất này, chưa tự sửa dữ liệu.</p><button class="btn small" data-action="fixture">Xem tình huống nhãn ưu tiên</button></details>${t.showFixture?fixture():''}`;
  else if(t.skill==='writing')body=`<p class="caption dataNote">Kho Test chưa có roster hoặc kết quả của IC2305 tại thời điểm chụp. Không dùng điểm quiz Writing để thay Test. Khi có nhận xét gốc: hiện tối đa hai dòng và Đọc đủ, không viết lại bằng AI.</p><div class="tableScroll" id="people-scroll"><table class="writingScores"><thead><tr><th>Học viên</th><th>Mini Test</th><th>Term Test 1</th><th>Term Test 2</th></tr></thead><tbody>${rows.map(p=>`<tr data-person="${esc(p.studentRef)}"><td>${nameCell(p)}</td>${testTypes.map(([slug])=>`<td>${writingCell(p.studentRef,slug)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  else body=speakingView(rows);
  return skills+testScenarioControl(t.showTestScenarios,lr)+`<div class="split ${t.selected?'hasDetail':''}"><section class="panel listPanel classResultPanel">${header}<div class="journeyBody">${body}</div></section>${t.selected?detailPanel():''}</div>`;
}
function testScenarioControl(visible,people=false){return `<div class="scenarioTools">${people?`<label><input type="checkbox" data-journey-scenarios ${t.showScenarios?'checked':''}> Hiện ${journeyScenarios.length} học viên giả</label>`:''}<label><input type="checkbox" data-test-scenarios ${visible?'checked':''}> Hiện điểm Test giả</label><span>${people?`${t.data.people.length} học viên thật${t.showScenarios?' + 7 học viên giả' : ''}. `:''}Điểm và nhận xét Test giả chỉ để xem giao diện, không phải kết quả thi thật.</span></div>`;}
function scenarioDetail(person){
  const summary=scenarioSummary(person,t.skill);
  return `<aside class="panel detailPanel" aria-label="Chi tiết học viên"><div class="detailHead"><div class="inline">${badge('Dữ liệu giả','amber')}<button class="iconBtn" data-action="close-detail" aria-label="Đóng chi tiết">×</button></div><h2 class="detailName">${esc(person.name)}</h2><p class="caption">Tình huống thử ${SKILLS[t.skill]} · Không thuộc lớp IC2305</p></div><div class="detailBody"><p>${esc(person.note)}</p><div class="miniGrid"><div class="stat"><small>TB cả khóa mô phỏng</small><strong>${pct(summary.average)}</strong></div><div class="stat"><small>TB ba buổi hợp lệ gần nhất</small><strong>${pct(summary.recentAverage)}</strong></div></div><p>${summary.flagged?badge('Ưu tiên xem','red'):summary.count<3?'Chưa đủ 3 buổi để xét ưu tiên':'Không có nhãn ưu tiên'} · ${summary.count} buổi hợp lệ</p><div class="tableScroll"><table><thead><tr><th>Buổi mô phỏng</th><th>Tỷ lệ đúng</th><th>Dùng xét nhãn</th></tr></thead><tbody>${person.reports.slice().reverse().map(r=>`<tr><td>Buổi ${r.sessionNumber}</td><td>${pct(r.percent)}${r.percent===null?' · Chưa có dữ liệu':''}</td><td>${summary.recent.some(v=>v.sessionNumber===r.sessionNumber)?'Có':'—'}</td></tr>`).join('')}</tbody></table></div><p class="caption">Listening và Reading dùng cùng bộ số giả để đối chiếu quy tắc. Chưa tạo điểm Test, bài nộp, nhận xét hoặc điểm danh cho các học viên giả này.</p></div></aside>`;
}
function personalOverview(ref){
  const speaking=speakingSummary(allCourse(),ref,(session)=>teacherFeedback(session,ref).published);
  const writing=testTypes.slice().reverse().map(([slug])=>testRecord(ref,slug)).find(result=>[1,2].some(task=>result?.writing?.tasks?.[task]?.feedback));
  const cards=Object.entries(SKILLS).map(([skill,label])=>{
    let content;
    if(['listening','reading'].includes(skill)){
      const report=personJourney(t.data,ref,skill);
      content=`<strong>${pct(report.average)}</strong><p>TB tỷ lệ đúng · ${report.count} buổi hợp lệ</p><dl class="overviewTests">${testTypes.map(([slug,name])=>`<div><dt>${name}</dt><dd>${testCell(ref,slug,skill)}</dd></div>`).join('')}</dl>`;
    }else if(skill==='speaking'){
      const latest=speaking.latest,session=latest&&allCourse().find(v=>v.number===latest.number),trial=latest&&t.data.feedback[feedbackKey(session,ref)]?.published===latest.text;
      content=`<p class="overviewLabel">Tự nhận xét thường gặp</p>${speaking.frequencies.length?`<dl class="overviewReflections">${speaking.frequencies.map(v=>`<div><dt>${esc(v.label)}</dt><dd>${v.count} lần</dd></div>`).join('')}</dl>`:'<p>Chưa có tự nhận xét đã nộp</p>'}<p class="overviewLabel">Nhận xét mới nhất${latest?` · Buổi ${latest.number}`:''}</p><p class="overviewFeedbackText">${esc(latest?.text||'Chưa có nhận xét đã công bố')}</p>${latest?`<small>${trial?'Nhận xét công bố trong demo':'Nhận xét nguồn cũ · Chưa xác minh người viết'}</small>`:''}`;
    }else{
      content=`<dl class="overviewTests">${testTypes.map(([slug,name])=>{const record=testRecord(ref,slug),value=record?.writing?.score;return `<div><dt>${name}</dt><dd>${value!=null?`<b>${esc(value)} / 9</b>`:'<small>Chưa có điểm</small>'}${record?.synthetic?`<div>${badge('Dữ liệu giả','amber')}</div>`:''}</dd></div>`;}).join('')}</dl><p class="overviewLabel">${esc(writing?.title||'Writing Test')} · Nhận xét</p>${[1,2].map(task=>{const text=writing?.writing?.tasks?.[task]?.feedback;return `<div class="overviewWritingTask"><b>Task ${task}</b><p class="originalExcerpt">${esc(text||'Chưa có nhận xét')}</p>${text?`<button class="rowLink" data-read-writing="${esc(ref)}" data-test="${esc(writing.testSlug)}" data-task="${task}">Đọc đủ</button>`:''}</div>`;}).join('')}`;
    }
    return `<section class="stat overviewSkill" aria-label="Tổng quan ${label}"><h3>${label}</h3>${content}</section>`;
  }).join('');
  return `<div class="miniGrid personalOverview">${cards}</div><button class="btn small overviewHistoryButton" data-overview-history>Xem chi tiết theo buổi ↓</button>`;
}
function journeyCell(session,ref,skill){const person=session.students.find(p=>p.studentRef===ref);if(!person)return '<span class="caption">Ngoài danh sách buổi</span>';if(['listening','reading'].includes(skill)){const r=person.reports[skill];return r?`<b class="numeric">${r.correct}/${r.total}</b><div class="nameMeta">${pct(r.percent)}</div>`:'<span class="caption">Chưa có số liệu</span>';}
  if(skill==='writing')return '<span class="caption">Chưa có điểm Test</span>';
  const reflection=reflectionText(session.definition,person.detail.responses,'speaking');return reflection?`<div class="textClip">${esc(reflection)}</div>`:'<span class="caption">Chưa có tự nhận xét</span>';
}
function reflectionText(definition,responses,skill){return itemsOf(definition).filter(i=>i.skillCodes?.includes(skill)&&i.graderType==='none'&&i.interactionType!=='number_score'&&applicable(i,responses||{})).flatMap(i=>{const v=responses?.[i.itemVersionId];return v?[i.options?.find(o=>o.id===v)?.label||(typeof v==='string'?v:'')]:[];}).filter(Boolean).join(' · ');}
function fixture(){const report=priority([{sessionNumber:8,percent:40},{sessionNumber:9,percent:55},{sessionNumber:10,percent:50}]);return `<section class="fixture"><div class="inline">${badge('Tình huống mô phỏng','amber')}<h2>Học viên minh họa · ${SKILLS[t.skill]}</h2>${badge('Ưu tiên xem','red')}</div><p>Buổi 8: 40% · Buổi 9: 55% · Buổi 10: 50%. TB ba buổi = <b>${pct(report.recentAverage)}</b>, dưới 60%. Không phải bài làm của học viên IC2305 và không được cộng vào bảng lớp.</p><div class="spark">${report.recent.slice().reverse().map(r=>`<div class="sparkItem"><span>${pct(r.percent)}</span><div class="sparkBar low" style="height:${r.percent*.6}px"></div><small>B${r.sessionNumber}</small></div>`).join('')}</div><p>TB 60% trở lên: bỏ nhãn. Chỉ có hai buổi: hiện “Chưa đủ 3 buổi”. Giá trị 0% hợp lệ vẫn được tính; ô thiếu không được coi là 0%.</p></section>`;}
function archiveBody(archive){
  const actual=archive.students.filter(p=>p.started).map(p=>`<details class="panel part"><summary><h2>${esc(p.name)}</h2>${badge(p.submitted?'Đã nộp':'Có nháp')}</summary><div class="partBody">${readonly({...p.detail,definition:archive.definition,answerKey:archive.answerKey,responses:p.submitted?p.detail.responses:p.draftResponses})}</div></details>`).join('');
  const simulated=archive.fake.map(([key,state])=>`<details class="panel part"><summary><h2>${esc(key.endsWith('demo-a')?'Học viên thử A':'Học viên thử B')}</h2>${badge('Dữ liệu mô phỏng','amber')}</summary><div class="partBody">${readonly({definition:archive.definition,responses:state.responses,gradingItems:state.gradingItems,submissionId:state.submitted?'demo':null})}</div></details>`).join('');
  return `<p><b>${esc(archive.title)}</b></p><p class="caption">Nội dung giữ nguyên, không tính vào bài hiện tại.</p>${actual||empty('Chưa có bài làm thật','Bài thử được giữ riêng bên dưới.')}<h2 style="margin:20px 0 12px">Nháp và bài nộp thử đã giữ</h2>${simulated||'<p class="caption">Không có bản thử ở lần giao này.</p>'}`;
}
function detailPanel(){
  const scenario=t.tab==='journey'&&t.showScenarios&&['listening','reading'].includes(t.skill)&&journeyScenarios.find(p=>p.studentRef===t.selected);
  if(scenario)return scenarioDetail(scenario);
  const session=activeSession(),person=session.students.find(p=>p.studentRef===t.selected),overall=t.data.people.find(p=>p.studentRef===t.selected);
  if(!overall)return '';
  const feedback=teacherFeedback(session,t.selected),draft=t.drafts.get(feedbackKey(session,t.selected))??feedback.draft;
  const list=t.tab==='session'?visiblePeople():t.data.people,index=list.findIndex(v=>v.studentRef===t.selected);
  const top=`<div class="detailHead"><div class="inline"><span class="eyebrow">${t.tab==='session'?`KẾT QUẢ BUỔI ${session.number}`:'HÀNH TRÌNH HỌC VIÊN'}</span><div class="detailNav"><button class="iconBtn" data-person-step="-1" ${index<=0?'disabled':''} aria-label="Học viên trước">‹</button><span class="caption">${index+1}/${list.length}</span><button class="iconBtn" data-person-step="1" ${index>=list.length-1?'disabled':''} aria-label="Học viên tiếp theo">›</button><button class="iconBtn" data-action="close-detail" aria-label="Đóng chi tiết">×</button></div></div><div class="nameCell"><span class="avatar">${esc(initials(overall.name))}</span><div><h2 class="detailName">${esc(overall.name)}</h2><small>IC2305 · ${t.tab==='session'?`Buổi ${session.number} · ${date(session.date)}`:'Tổng quan bốn kỹ năng'}</small></div></div></div>`;
  if(t.tab==='journey')return `<aside class="panel detailPanel" aria-label="Chi tiết học viên">${top}<div class="detailBody">${personalOverview(t.selected)}<div class="divider"></div><h2 id="overview-history" tabindex="-1">Lịch sử các phiếu đã có</h2><div class="journeyTimeline" style="margin-top:12px">${allCourse().map(v=>{const p=v.students.find(p=>p.studentRef===t.selected);return `<div class="panel journeyItem" style="margin:0"><div><b>Buổi ${v.number} · ${date(v.date)}</b><p class="caption">${esc(v.title)}</p><div class="nameMeta">${p?(p.submitted?'Đã nộp cuối':progress(p,v)):'Ngoài danh sách buổi'}</div></div>${p?`<button class="btn small" ${t.data.sessions.includes(v)?`data-open-detail-session="${v.number}"`:`data-course-history="${v.number}"`}>Xem bài</button>`:''}</div>`;}).join('')}</div><div class="divider"></div><p class="caption">Tổng hợp các phiếu hiện có của khóa. Không suy điểm Speaking hoặc Writing từ bài tự nhận xét; chưa có phiếu buổi 1 và 7.</p></div></aside>`;
  if(!person)return `<aside class="panel detailPanel">${top}${empty('Ngoài danh sách buổi này','Học viên vẫn có lịch sử ở các buổi khác.')}</aside>`;
  return `<aside class="panel detailPanel" aria-label="Chi tiết học viên">${top}<div class="detailBody"><section class="feedback"><div class="inline"><h2>Nhận xét Speaking</h2>${badge('Thao tác thử','amber')}</div><label for="teacher-feedback" class="caption">Nháp riêng của giảng viên · Buổi ${session.number}</label><textarea id="teacher-feedback" placeholder="Ghi nhận xét cho ${esc(overall.name)}…">${esc(draft)}</textarea><div class="inline"><small id="feedback-state" class="${t.saveError?'saveError':''}">${draft!==feedback.published?'Đã giữ nháp riêng · Chưa hiển thị cho học viên':feedback.published?'Bản này đang hiển thị trong demo':'Chưa có nhận xét đã công bố'}</small><button class="btn primary small" data-action="publish-feedback">Lưu và hiển thị cho học viên</button></div>${feedback.published?`<div class="published"><b>Học viên đang thấy:</b><br>${esc(feedback.published)}</div>`:''}</section><div class="divider"></div><div class="toolbar"><h2>Bài làm buổi ${session.number}</h2><a class="btn small" target="_blank" rel="noopener" href="${studentURL(person.studentRef,session.number)}">Xem như học viên ↗</a></div><p class="readOnly">${person.submitted?'Bài đã nộp · Chỉ đọc':person.started?'Chưa nộp cuối · Hiển thị nội dung đã lưu':'Chưa có bài làm'} · Đáp án chưa được mở cho học viên trong dữ liệu gốc.</p>${readonly({...person.detail,responses:person.submitted?person.detail.responses:person.draftResponses})}</div></aside>`;
}
async function teacherAction(button){
  const action=button.dataset.action,session=activeSession();
  if(action==='coverage'){modal('Nguồn dữ liệu và phần còn thiếu',`<p>Bản chụp chỉ đọc lúc ${time(t.data.capturedAt)} · IC2305.</p><ul><li>Theo dõi buổi: 8, 9, 10. Hành trình: các phiếu buổi 2, 3, 4, 5, 6, 8, 9, 10.</li><li>Chưa có phiếu buổi 1 và 7 trong nguồn đang đọc; không tính thành vắng hoặc 0 điểm.</li><li>Kho Test có ba định nghĩa bài, nhưng chưa có roster hoặc kết quả IC2305. Không tự gán Test vào lịch.</li><li>Listening và Reading mỗi kỹ năng chỉ có hai buổi tự báo. Chưa đủ ba buổi để có nhãn ưu tiên thật; tình huống minh họa được tách riêng.</li><li>Buổi 4: tên bài có Listening nhưng hai ô tự báo gắn Reading. Giữ theo mã nguồn, cần người quản lý xác minh.</li><li>Nhận xét gốc giữ đúng trạng thái ẩn/hiển thị; nhận xét thử có nhãn riêng. Hộp AI chỉ tách nội dung bạn dán, chưa kết nối mô hình AI.</li></ul><p>Thao tác tạo/sửa/xuất bản/thay bài và nộp thử chỉ trong demo. Đây là lựa chọn danh tính mô phỏng, chưa xác thực ERP hoặc phân quyền production.</p>`);return;}
  if(action==='publish-feedback')return teacherSave(true);
  if(action==='close-detail')return changeTeacher(()=>t.selected=null);
  if(action==='fixture'){t.showFixture=!t.showFixture;renderTeacher();return;}
  if(action==='answers'){await teacherSave();await api('/api/demo',{action:'showAnswers',number:session.number,generation:session.generation,open:!session.showAnswers});await refreshTeacher();toast('Đã đổi quyền xem kết quả trong demo.');return;}
  if(action==='history'){
    modal('Lịch sử thu hồi · Chỉ giảng viên xem',session.retired.length?session.retired.map((r,i)=>`<section class="panel"><div class="panelBody"><h2>${esc(r.title)}</h2><p class="caption">Thu hồi lúc ${time(r.retiredAt)} · Đã ngừng nhận bài</p><p>${r.students.filter(p=>p.submitted).length} bài nộp cuối · ${r.students.filter(p=>p.started).length} người đã bắt đầu. Nháp và nội dung bài nộp được giữ, không trộn vào bài mới.</p><button class="btn small" data-archive="${i}">Xem bài làm và nháp cũ</button></div></section>`).join(''):empty('Chưa có bài thu hồi trong demo','Thử “Thay bài đang giao” để xem cách giữ lịch sử.'));
    return;
  }
  if(action==='replace'){
    await teacherSave();modal('Thay bài đang giao trong demo',`<p><b>Buổi ${session.number}: ${esc(session.title)}</b></p><p>Bài hiện tại ngừng nhận bài. Nháp và bài đã nộp được giữ cho giảng viên xem trong lịch sử; học viên chuyển sang bài mới.</p><p>Kết quả cũ không được tính vào bài mới. Điểm danh thật không bị thay đổi.</p><label for="replace-template">Chọn một phiếu làm bài thay thế để thử</label><select id="replace-template" class="select" style="display:block;margin-top:8px;width:100%">${t.data.sessions.filter(v=>v.number!==session.number).map(v=>`<option value="${v.number}">Phiếu buổi ${v.number} · ${esc(v.title)}</option>`).join('')}${t.library.forms.filter(f=>f.status==='published').map(f=>`<option value="${f.id}">${esc(f.title)} · Của tôi (demo)</option>`).join('')}</select>`,`<button class="btn" data-close-dialog>Hủy</button><button class="btn primary" data-confirm-replace>Thu hồi, giữ lịch sử và giao bài mới</button>`);return;
  }
  if(action==='reset')modal('Đặt lại demo',`<p>Đưa demo về bản chụp dữ liệu thật ban đầu. Các nhận xét, bài nộp thử và thay bài trong demo sẽ được bỏ.</p><p>Dữ liệu thật ở hệ thống đang chạy không thay đổi.</p>`,`<button class="btn" data-close-dialog>Hủy</button><button class="btn primary" data-confirm-reset>Đặt lại demo</button>`);
}
async function openStudent(number=s.number,ref=s.ref){
  const data=await api(`/api/student?number=${number}&ref=${encodeURIComponent(ref)}`);
  const historyResults=await Promise.allSettled(data.sessions.filter(v=>v.available&&v.number!==number).map(v=>api(`/api/student?number=${v.number}&ref=${encodeURIComponent(ref)}`)));
  s.history=[data,...historyResults.filter(v=>v.status==='fulfilled').map(v=>v.value)];
  s.historyError=historyResults.some(v=>v.status==='rejected');
  s.data=data;s.number=number;s.ref=ref;s.responses=structuredClone(data.responses||{});s.dirty=false;s.saveError=false;s.expanded.clear();
  const url=new URL(location.href),params=new URLSearchParams(localAPI?url.search:url.hash.slice(1));params.set('view','student');params.set('number',number);params.set('ref',ref);if(localAPI)url.search=params.toString();else{url.search='';url.hash=params.toString();}history.replaceState(null,'',url);renderStudent();
}
async function saveStudent(){
  clearTimeout(s.timer);if(s.pending)await s.pending;
  if(!s.data?.isFake||!s.dirty||s.data.submitted)return;
  const body={action:'draft',number:s.number,generation:s.data.generation,ref:s.ref,responses:structuredClone(s.responses),failSave:s.failNext};s.failNext=false;
  const revision=JSON.stringify(s.responses);setSaveLabel('Đang giữ nháp…');
  s.pending=api('/api/demo',body).then(()=>{if(JSON.stringify(s.responses)===revision)s.dirty=false;s.saveError=false;setSaveLabel('Đã giữ nháp riêng cho người học này');}).catch(error=>{s.saveError=true;setSaveLabel(error.message,true);throw error;}).finally(()=>s.pending=null);
  await s.pending;
}
function setSaveLabel(text,error=false){for(const label of document.querySelectorAll('[data-save-status]')){label.textContent=text;label.classList.toggle('saveError',error);}}
function renderStudent(){
  const d=s.data;document.body.className='student-screen';
  if(s.identityStage!=='ready'){
    const selected=d.roster.find(p=>p.studentRef===(s.identityChoice||s.ref));
    app.innerHTML=`<header class="studentHeader"><div class="brand"><div class="logo">IZONE</div><small>PROGRESS LOG</small></div><span class="caption">IC2305</span></header><main class="studentMain"><section class="identityEntry"><h1>${s.identityStage==='choose'?'Chọn tên của em':'Xác nhận người học'}</h1><p>${d.isFake?'Bản thử · Danh tính mô phỏng, không ghi vào lớp thật.':'Bản chụp dữ liệu thật · Chỉ xem lại. Chọn tên ở đây chưa thay xác thực ERP.'}</p>${s.identityStage==='choose'?`<label for="entry-person">Người học</label><select id="entry-person" class="select">${d.roster.map(p=>`<option value="${esc(p.studentRef)}" ${p.studentRef===(s.identityChoice||s.ref)?'selected':''}>${esc(p.name)}</option>`).join('')}</select><button class="btn primary" data-identity-next>Tiếp tục</button>`:`<h2 style="margin-top:24px">${esc(selected.name)}</h2><p>Lớp IC2305 · Buổi ${d.number}</p><button class="btn primary" data-identity-start>Đúng, bắt đầu</button><button class="btn quiet" data-identity-back>Chọn lại tên</button>`}</section></main>`;
    return;
  }
  const lessonIcon='<svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="4" y="3" width="16" height="18" rx="2" stroke="currentColor" stroke-width="1.6"/><path d="M8 8h8M8 12h8M8 16h5" stroke="currentColor" stroke-width="1.6"/></svg>';
  const resultsIcon='<svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 20V9h4v11m3 0V4h4v16m3 0v-8h4v8M2 20h21" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>';
  app.innerHTML=`<header class="studentHeader"><div class="brand"><div class="logo">IZONE</div><small>PROGRESS LOG</small></div><span class="caption">Lớp IC2305</span></header><nav class="studentNav" aria-label="Trang học viên"><button class="btn ${s.tab==='session'?'active':''}" data-student-tab="session"><span aria-hidden="true">▤</span>Buổi học</button><button class="btn ${s.tab==='journey'?'active':''}" data-student-tab="journey"><span aria-hidden="true">▥</span>Kết quả học tập</button></nav><main class="studentMain"><div class="studentInner"><h1 class="studentGreeting">Xin chào, ${esc(d.person.name)}</h1><div class="studentDemoTools"><span>${d.isFake?'Bản thử · Danh tính mô phỏng, không ghi vào lớp thật':'Bản chụp thật · Chỉ xem lại, không sửa bài thật'}</span><div><button class="btn quiet small" data-student-action="identity">Đổi người học</button>${!d.isFake?`<a class="btn quiet small" target="_blank" rel="noopener" href="${studentURL('demo-a',s.number)}">Thử làm phiếu</a>`:''}<select class="select" aria-label="Chọn buổi học" data-student-session>${d.sessions.map(v=>`<option value="${v.number}" ${v.number===s.number?'selected':''} ${!v.available?'disabled':''}>Buổi ${v.number} · ${date(v.date)}</option>`).join('')}</select></div></div>${s.tab==='session'?studentSession():studentJourney()}<footer class="demoFooter"><span>Bản chụp · ${time(d.capturedAt)}</span><details><summary>Mô phỏng</summary><div><p>Thao tác chỉ được giữ trong phiên demo; không đổi bài hay điểm danh thật.</p><a href="./?number=${s.number}">Về màn giảng viên</a>${d.isFake?'<button class="btn quiet small" data-student-action="fail">Thử lỗi lưu kế tiếp</button>':''}</div></details></footer></div></main>`;
  document.querySelector('[data-student-tab="session"]>span')?.replaceWith(document.createRange().createContextualFragment(lessonIcon));
  document.querySelector('[data-student-tab="journey"]>span')?.replaceWith(document.createRange().createContextualFragment(resultsIcon));
  updateConditionals();
}
function studentSession(){
  const d=s.data,completion=d.submitted?(d.completeness==='partial'?'Đã nộp · còn câu trống':'Đã nộp phiếu'):`Đã nộp ${d.checkpoints.length}/${d.definition.blocks.length} phần`;
  return `<div class="studentHeading"><p>IC2305 · BUỔI ${d.number} · ${date(d.date)}</p><h1>${esc(d.title)}</h1></div>${d.replacement?'<div class="notice warn">Bài cũ đã thu hồi. Đây là bài hiện tại; bài cũ không cần làm tiếp.</div>':''}<section class="currentCard"><div class="currentHeading"><div class="lessonMeta"><span>${sourceDeadline(d.number)}</span>${badge(d.participated?'Đã ghi nhận tham gia'+(d.isFake?' · thử':''):'Chưa ghi nhận tham gia',d.participated?'green':'')}</div><div class="lessonProgress"><span>${completion}</span>${!d.isFake?'<small>Chỉ xem lại bài thật</small>':'<small>Nộp phần đầu thành công ghi nhận tham gia</small>'}</div></div>${d.definition.blocks.map((block,index)=>studentPart(block,index)).join('')}</section>${d.isFake&&!d.submitted?`<div class="bottomActions"><small data-save-status>${s.saveError?'Chưa giữ được nháp. Hãy thử lại.':s.dirty?'Đang có thay đổi chưa lưu':'Nháp riêng theo người học và buổi'}</small><button class="btn primary" data-student-action="final">Nộp toàn bộ phiếu</button></div>`:''}<section class="currentFeedback"><h2>Nhận xét của giáo viên</h2><div class="feedbackCard"><b>Speaking</b><p>${d.publishedFeedback?esc(d.publishedFeedback):'Chưa có nhận xét đã công bố.'}</p></div></section>`;
}
function studentPart(block,index){
  const d=s.data,checkpoint=d.checkpoints.find(c=>c.blockId===block.blockId),submitted=d.submitted||Boolean(checkpoint),open=d.releases.find(r=>r.blockId===block.blockId)?.status==='open',editable=d.isFake&&!submitted,expanded=s.expanded.has(block.blockId);
  let content='';
  if(!editable){const review=readonly({definition:d.definition,responses:s.responses,gradingItems:d.gradingItems,submissionId:submitted?'submitted':null,answerKey:d.answerKey},[block]),grades=d.gradingItems.filter(g=>g.maxScore>0&&block.items.some(i=>i.itemVersionId===g.itemVersionId)),correct=grades.filter(g=>g.verdict==='correct').length;content=`<p class="readOnly">${submitted?'Đã nộp · Chỉ xem lại':'Nội dung đã lưu · Chưa nộp phần này'}${!d.answersVisible?' · Kết quả chấm đang ẩn':''}</p>${d.answersVisible&&grades.length?`<p class="partScore"><b>${correct} đúng</b> · ${grades.length-correct} sai / ${grades.length} câu có đáp án</p>`:''}${d.answersVisible?review:review.replace(/<p class="reviewVerdict (?!not_applicable)[^"]*">[^<]*<\/p>/g,'')}`;}
  else if(!open)content='<p class="muted">Giảng viên chưa mở phần này. Nháp vẫn được giữ.</p>';
  else content=`${block.instructions?`<p class="exerciseInstructions">${esc(block.instructions)}</p>`:''}${block.items.map((item,i)=>field(item,i+1)).join('')}<div class="partFoot"><small data-save-status>${s.dirty?'Đang có thay đổi chưa lưu':'Nộp được khi còn câu trống'}</small><button class="btn primary" data-submit-block="${esc(block.blockId)}">Nộp phần ${index+1}</button></div>`;
  const title=block.title.replace(/^phần\s*\d+\s*[:：.]?\s*/i,'');
  return `<section class="studentPart" data-part="${esc(block.blockId)}"><div class="studentPartTop"><div><small>PHẦN ${index+1}</small><h2>${esc(title)}</h2></div>${badge(submitted?'Đã nộp':open?'Đã mở':'Chưa mở',submitted?'green':open?'blue':'')}</div>${!expanded?`<button class="btn ${editable&&open?'primary':''} partStart" data-start-part="${esc(block.blockId)}" ${editable&&!open?'disabled':''}>${submitted?'Xem kết quả':editable?'Bắt đầu làm':'Xem nội dung đã lưu'}</button>`:`<button class="btn quiet small collapsePart" data-collapse-part="${esc(block.blockId)}">Thu gọn ⌃</button><div class="partBody">${content}</div>`}</section>`;
}
function field(item,index){const id=item.itemVersionId,value=s.responses[id],c=item.interactionConfig||{};
  const label=`<span class="caption">CÂU ${esc(item.displayNumber??index)}</span><br>${esc(item.prompt)}`;
  const help=item.helpText||item.instructions;
  let control;
  if(['single_choice','multiple_choice'].includes(item.interactionType))control=`<fieldset><legend>${label}</legend>${help?`<p class="help">${esc(help)}</p>`:''}<div class="options">${item.options.map(o=>`<label class="option"><input type="${item.interactionType==='multiple_choice'?'checkbox':'radio'}" name="item-${esc(id)}" data-item="${esc(id)}" value="${esc(o.id)}" ${(Array.isArray(value)?value.includes(o.id):value===o.id)?'checked':''}><span>${esc(o.label)}</span></label>`).join('')}</div></fieldset>`;
  else{const input=item.interactionType==='matching'?`<div class="matchingFields">${(c.pairs||[]).map((pair,n)=>`<label>${esc(pair.left)}<select data-item="${esc(id)}" data-pair-index="${n}"><option value="">Chọn vế phải</option>${(c.pairs||[]).map((p,j)=>`<option value="${j}" ${String(value?.[n])===String(j)?'selected':''}>${esc(p.right)}</option>`).join('')}</select></label>`).join('')}</div>`:item.interactionType==='long_text'?`<textarea id="item-${esc(id)}" data-item="${esc(id)}" placeholder="Viết câu trả lời của em…">${esc(value||'')}</textarea>`:item.interactionType==='number_score'?`<div class="scoreInput"><input id="item-${esc(id)}" data-item="${esc(id)}" type="number" inputmode="numeric" min="0" max="${c.max}" step="1" value="${esc(value?.correct??'')}" placeholder="—"><span>/ ${c.max} câu</span></div>`:item.interactionType==='short_text'?`<input id="item-${esc(id)}" data-item="${esc(id)}" type="text" value="${esc(value||'')}" placeholder="Nhập câu trả lời…">`:'<p role="alert">Loại câu hỏi chưa được hỗ trợ trong demo.</p>';
    control=`<label for="item-${esc(id)}">${label}</label>${help?`<p class="help">${esc(help)}</p>`:''}${input}`;
  }
  control=control.replaceAll('data-item=',`aria-describedby="error-${esc(id)}" data-item=`);
  return `<div class="field" data-field="${esc(id)}">${control}<p class="fieldError" id="error-${esc(id)}" role="alert" hidden></p></div>`;
}
function updateConditionals(){if(!s.data)return;for(const element of document.querySelectorAll('[data-field]')){const item=itemsOf(s.data.definition).find(i=>i.itemVersionId===element.dataset.field);element.hidden=!applicable(item,s.responses);}}
function studentJourney(){
  const d=s.data;
  const ownTests=new Map((d.testResults||[]).map(v=>[v.result.testSlug,v.result]));
  if(s.showTestScenarios)for(const [slug] of testTypes)if(!ownTests.has(slug))ownTests.set(slug,testScenario(s.ref,slug));
  const own=new Map([...(d.courseHistory||[]),...(s.history||[d])].map(v=>[v.number,v]));
  const history=[...own.values()].sort((a,b)=>b.number-a.number);
  const latest=history.find(v=>v.publishedFeedback?.trim());
  const cards=Object.entries(SKILLS).map(([key,label])=>{
    let body;
    if(['listening','reading'].includes(key)){
      const records=history.flatMap(v=>{const report=practiceReport(v.definition,{submissionId:v.submitted?'observed':null,responses:v.responses},key);return report?[{...report,sessionNumber:v.number}]:[];});
      const summary=priority(records);
      body=`<strong>${pct(summary.average)}</strong><p>TB Progress Log từ các phiếu hiện có</p><p class="caption">${summary.count} buổi tự báo hợp lệ · Chưa có phiếu buổi 1 và 7</p>`;
    }else if(key==='speaking')body=`<p>${latest?esc(latest.publishedFeedback):'Chưa có nhận xét đã công bố'}</p>${latest?`<p class="caption">Buổi ${latest.number} · ${date(latest.date)}</p>`:''}`;
    else body='<p>Điểm và nhận xét từ bài Test</p>';
    const tests=key==='speaking'?'':`<dl>${testTypes.map(([slug,name])=>{const record=ownTests.get(slug),value=record?.[key];return `<div><dt>${name}</dt><dd>${record?.synthetic?`<p>${badge('Dữ liệu giả','amber')}</p>`:''}${key==='writing'?`${value?.score!=null?`<b>${esc(value.score)} / 9</b>`:'Chưa có điểm'}${[1,2].map(task=>`<p class="fullFeedback"><small>Task ${task}</small><br>${esc(value?.tasks?.[task]?.feedback||'Chưa có nhận xét')}</p>`).join('')}`:value?`${esc(value.correct)} / ${esc(value.total)}${value.band!=null?` · Band ${esc(value.band)}`:''}`:'Chưa có điểm'}</dd></div>`;}).join('')}</dl>`;
    return `<section class="studentSkillCard"><h2>${label}</h2>${body}${tests}</section>`;
  }).join('');
  return `<div class="studentHeading"><h1>Kết quả học tập</h1><p>Dữ liệu của em từ các phiếu hiện có; buổi chưa có nguồn và điểm Test được ghi riêng.</p></div>${testScenarioControl(s.showTestScenarios)}${s.historyError?'<p class="notice warn">Chưa tải đủ lịch sử. Dữ liệu đang xem vẫn được giữ; mở lại trang để thử tải lại.</p>':''}<div class="studentSkillGrid">${cards}</div><section class="studentHistory"><h2>Lịch sử buổi học</h2><div class="panel">${history.map(v=>`<button class="studentSessionRow" ${d.sessions.some(item=>item.number===v.number)?`data-student-open="${v.number}"`:`data-own-history="${v.number}"`}><span><strong>Buổi ${v.number}</strong><small>${esc(v.title)}</small></span><span>${date(v.date)} <b>›</b></span></button>`).join('')}</div></section>`;
}
async function studentAction(action){
  if(action==='fail'){s.failNext=true;toast('Lần lưu kế tiếp sẽ báo lỗi thử. Người học và nháp sẽ được giữ tại chỗ.');return;}
  if(action==='identity'){
    await saveStudent();modal('Đổi người học',`<p>Nháp được giữ riêng cho từng người và từng buổi. Bạn chỉ chuyển người sau khi lưu nháp thành công.</p><label for="identity-select">Chọn người học ${s.data.isFake?'thử':'để xem bài thật'}</label><select id="identity-select" class="select" style="display:block;margin-top:8px;width:100%">${s.data.roster.map(p=>`<option value="${esc(p.studentRef)}" ${p.studentRef===s.ref?'selected':''}>${esc(p.name)}</option>`).join('')}</select>`,`<button class="btn" data-close-dialog>Hủy</button><button class="btn primary" data-confirm-identity>Đổi người học</button>`);return;
  }
  if(action==='final'){
    await saveStudent();modal('Nộp toàn bộ phiếu?',`<p>Em có thể nộp dù còn câu trống. Các câu chấm tự động còn trống được tính 0; phần tự nhận xét không chấm điểm.</p><p>Sau khi nộp, phiếu chỉ được xem lại. Việc nộp trong demo không ghi vào lớp thật.</p>`,`<button class="btn" data-close-dialog>Tiếp tục làm</button><button class="btn primary" data-confirm-final>Nộp phiếu</button>`);
  }
}

// Hạn nộp được chép từ submissionWindow của bản chụp, không suy từ đồng hồ người xem.
function sourceDeadline(number){
  const closes=(isStudent?s.data:activeSession())?.closesAt||({10:'2026-10-19T15:00:00.000Z',9:'2026-10-15T15:00:00.000Z',8:null})[number];
  return closes?'Hạn nộp: '+new Date(closes).toLocaleTimeString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',hour:'2-digit',minute:'2-digit'})+' · '+date(closes):'Hạn nộp: chưa có mốc đóng trong nguồn';
}
function speakingView(rows){
  const counts=new Map();
  for(const session of allCourse()) for(const p of session.students.filter(p=>p.submitted)){
    for(const item of itemsOf(session.definition).filter(i=>i.skillCodes?.includes('speaking')&&i.options?.length)){
      const value=p.detail.responses[item.itemVersionId],label=item.options.find(o=>o.id===value)?.label;
      if(label)counts.set(label,(counts.get(label)||0)+1);
    }
  }
  const max=Math.max(1,...counts.values()),commentSessions=allCourse().filter(v=>v.students.some(p=>teacherFeedback(v,p.studentRef).published));
  const chart=`<h3>Tự phản ánh của học viên</h3><p class="caption dataNote">Số lần chọn trong các phiếu hiện có · Một học viên có thể đóng góp ở nhiều buổi</p><div class="reflectionChartScroll"><div class="reflectionChart">${[...counts].map(([label,count])=>`<div class="reflectionColumn"><div class="reflectionTrack"><div style="height:${count/max*160}px"><b>${count}</b></div></div><p>${esc(label)}</p></div>`).join('')}</div></div>`;
  const table=commentSessions.length?`<div class="tableScroll" id="people-scroll"><table class="speakingComments"><thead><tr><th>Học viên</th>${commentSessions.map(v=>`<th>Buổi ${v.number}</th>`).join('')}</tr></thead><tbody>${rows.map(p=>`<tr data-person="${esc(p.studentRef)}"><td>${nameCell(p)}</td>${commentSessions.map(v=>`<td>${esc(teacherFeedback(v,p.studentRef).published)||'—'}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`:empty('Chưa có nhận xét đã công bố','Nhận xét được thêm ở chi tiết từng buổi; không phụ thuộc học viên đã nộp bài.');
  return chart+`<h3 class="speakingHeading">Nhận xét của giảng viên</h3><p class="caption dataNote">Lịch sử có nhận xét nguồn cũ chưa xác minh người viết; demo giữ nguyên nội dung, không tự gán cho Thủy. Nhận xét ẩn vẫn được giữ ẩn.</p>`+table;
}

// Sự kiện giữ định danh ngay từ lúc nhập; chuyển màn chờ lần lưu đang chạy hoàn tất.
document.addEventListener('input',event=>{
  const element=event.target;
  if(element.id==='teacher-feedback'){const key=feedbackKey(activeSession(),t.selected);t.drafts.set(key,element.value);clearTimeout(t.timer);const status=document.querySelector('#feedback-state');status.textContent='Đang giữ nháp riêng…';t.timer=setTimeout(()=>teacherSave().catch(e=>toast(e.message)),700);return;}
  if(element.matches('[data-search]')){t.search=element.value;const start=element.selectionStart;renderTeacher();const search=document.querySelector('[data-search]');search.focus();search.setSelectionRange(start,start);return;}
  if(element.matches('[data-item]')){
    const item=itemsOf(s.data.definition).find(i=>i.itemVersionId===element.dataset.item);
    s.responses[item.itemVersionId]=item.interactionType==='multiple_choice'?[...document.querySelectorAll(`[data-item="${item.itemVersionId}"]:checked`)].map(input=>input.value):item.interactionType==='matching'?{...(s.responses[item.itemVersionId]||{}),[element.dataset.pairIndex]:element.value}:item.interactionType==='number_score'?(element.value===''?'':{correct:Number(element.value),total:item.interactionConfig.max}):element.value;
    if(item.interactionType==='number_score'){
      const value=element.value===''?null:Number(element.value),invalid=value!==null&&(!Number.isInteger(value)||value<0||value>item.interactionConfig.max);
      const error=document.getElementById('error-'+item.itemVersionId),message=`Nhập số nguyên từ 0 đến ${item.interactionConfig.max}, hoặc để trống.`;
      element.setAttribute('aria-invalid',String(invalid));element.setCustomValidity(invalid?message:'');
      if(error){error.textContent=invalid?message:'';error.hidden=!invalid;}
    }
    s.dirty=true;setSaveLabel('Đang giữ nháp…');updateConditionals();clearTimeout(s.timer);s.timer=setTimeout(()=>saveStudent().catch(e=>toast(e.message)),700);
  }
});
document.addEventListener('change',event=>{(async()=>{
  const e=event.target;
  if(e.matches('[data-filter]'))await changeTeacher(()=>t.filter=e.value);
  if(e.matches('[data-teacher-session]'))await changeTeacher(()=>{t.number=Number(e.value);t.selected=null;t.question=null;});
  if(e.matches('[data-journey-order]'))await changeTeacher(()=>t.order=e.value);
  if(e.matches('[data-journey-scenarios]'))await changeTeacher(()=>{t.showScenarios=e.checked;if(t.selected?.startsWith('journey-scenario-'))t.selected=null;});
  if(e.matches('[data-test-scenarios]')){if(isStudent){s.showTestScenarios=e.checked;renderStudent();}else await changeTeacher(()=>t.showTestScenarios=e.checked);}
  if(e.matches('[data-student-session]')){const number=Number(e.value);e.value=String(s.number);await saveStudent();await openStudent(number);}
})().catch(error=>toast(error.message));});
document.addEventListener('toggle',event=>{const e=event.target;if(e.matches?.('[data-part]')){if(e.open)s.expanded.add(e.dataset.part);else s.expanded.delete(e.dataset.part);}},true);
document.addEventListener('click',event=>{(async()=>{
  const button=event.target.closest('button'),row=event.target.closest('tr[data-person]');
  if(button?.disabled)return;
  if(button?.hasAttribute('data-reload')){location.reload();return;}
  if(button?.hasAttribute('data-close-dialog')){dialog.close();return;}
  if(button?.hasAttribute('data-results-jump')){scrollToResults(button.dataset.resultsJump);return;}
  if(button?.hasAttribute('data-scroll-people')){window.scrollBy({top:Math.round(innerHeight*.65),behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});return;}
  if(button?.hasAttribute('data-attendance-ref')){
    const person=activeSession().students.find(p=>p.studentRef===button.dataset.attendanceRef),state=attendanceState(person);
    modal(`Điểm danh · ${person.name}`,`<p><b>Đã nhận bài:</b> Progress Log đã nhận lần nộp phần đầu thành công và ghi nhận tham gia. Chưa có xác nhận từ Portal thì chưa gọi là đã điểm danh.</p><p><b>Đã điểm danh:</b> đã có xác nhận điểm danh thành công từ Portal.</p><div class="notice"><p>Progress Log: <b>${state.received?'Đã nhận bài':'Chưa nhận bài'}</b>.</p><p>Portal: <b>${state.confirmed?'Đã điểm danh':person.portal?.reviewRequired?'Cần kiểm tra, chưa xác nhận thành công':'Chưa xác nhận điểm danh'}</b>${state.confirmed?` · Đối chiếu lúc ${time(person.portal.readbackAt)}`:''}.</p></div><p class="caption">Trạng thái theo bản chụp dữ liệu. Thao tác thử không ghi điểm danh thật.</p>`);return;
  }
  if(button?.hasAttribute('data-identity-next')){s.identityChoice=document.querySelector('#entry-person').value;s.identityStage='confirm';renderStudent();return;}
  if(button?.hasAttribute('data-identity-back')){s.identityStage='choose';renderStudent();return;}
  if(button?.hasAttribute('data-identity-start')){s.identityStage='ready';await openStudent(s.number,s.identityChoice||s.ref);return;}
  if(button?.hasAttribute('data-confirm-identity')){const ref=document.querySelector('#identity-select').value,person=s.data.roster.find(p=>p.studentRef===ref);await saveStudent();dialog.close();modal('Xác nhận người học',`<p>Bạn sẽ mở <b>${esc(person.name)}</b> · IC2305 · Buổi ${s.number}.</p><p>${s.data.isFake?'Đây là người học thử. Bài làm chỉ được giữ trong demo.':'Đây là bản chụp thật chỉ đọc; lựa chọn tên trong demo không thay xác thực ERP.'}</p>`,`<button class="btn" data-close-dialog>Quay lại</button><button class="btn primary" data-identity-use="${esc(ref)}">Đúng, tiếp tục</button>`);return;}
  if(button?.hasAttribute('data-identity-use')){await saveStudent();await openStudent(s.number,button.dataset.identityUse);dialog.close();return;}
  if(button?.hasAttribute('data-editor-new'))return editLibrary();
  if(button?.hasAttribute('data-editor-copy'))return editLibrary(sourceDraft(t.data.sessions.find(v=>v.number===Number(button.dataset.editorCopy))));
  if(button?.hasAttribute('data-editor-form'))return editLibrary(t.library.forms.find(v=>v.id===button.dataset.editorForm));
  if(button?.hasAttribute('data-library-mine')){document.querySelector('#own-forms')?.scrollIntoView({block:'start'});return;}
  if(button?.hasAttribute('data-preview-form')){await loadEditor();const form=t.library.forms.find(v=>v.id===button.dataset.previewForm);modal(form.title,`<p class="notice simulated">Bài soạn trong demo · ${form.status==='draft'?'Nháp':'Đã xuất bản'} · Không ghi vào lớp thật.</p>${window.ProgressLogWorksheet.normalize(form).parts.map(p=>`<section class="exercise-part"><h2>${esc(p.title)}</h2>${window.ProgressLogExerciseEditor.previewPartContent(p)}</section>`).join('')}`);return;}
  if(button?.hasAttribute('data-read-writing')){event.stopPropagation();const person=t.data.people.find(p=>p.studentRef===button.dataset.readWriting),result=testRecord(person.studentRef,button.dataset.test),task=button.dataset.task,text=result?.writing?.tasks?.[task]?.feedback;modal(`${person.name} · ${result.title} · Task ${task}`,`<p class="fullFeedback">${esc(text||'Chưa có nhận xét')}</p><p class="caption">Nhận xét gốc; không tóm tắt bằng AI.</p>`);return;}
  if(button?.hasAttribute('data-overview-history')){const heading=document.querySelector('#overview-history'),panel=heading.closest('.detailPanel');heading.focus({preventScroll:true});if(getComputedStyle(panel).position==='sticky')panel.scrollTo({top:panel.scrollTop+heading.getBoundingClientRect().top-panel.getBoundingClientRect().top-16,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});else heading.scrollIntoView({block:'start',behavior:'smooth'});return;}
  if(button?.hasAttribute('data-course-history')){const session=allCourse().find(v=>v.number===Number(button.dataset.courseHistory)),person=session.students.find(p=>p.studentRef===t.selected);modal(`${person.name} · Buổi ${session.number}`,`<p class="caption">${esc(session.title)} · ${date(session.date)} · Bản chụp chỉ đọc</p>${readonly(person.detail)}`);return;}
  if(button?.hasAttribute('data-own-history')){const v=s.data.courseHistory.find(v=>v.number===Number(button.dataset.ownHistory));modal(`Buổi ${v.number} · ${v.title}`,`<p class="readOnly">Bản chụp chỉ đọc · Đáp án giữ ẩn theo nguồn</p>${readonly({...v,submissionId:v.submitted?'observed':null})}`);return;}
  if(button?.hasAttribute('data-confirm-final')){await saveStudent();await api('/api/demo',{action:'final',number:s.number,generation:s.data.generation,ref:s.ref,responses:s.responses});dialog.close();await openStudent();s.expanded=new Set(s.data.definition.blocks.map(b=>b.blockId));renderStudent();toast('Đã nộp phiếu thử. Em có thể xem lại từng phần.');return;}
  if(button?.hasAttribute('data-confirm-replace')){const chosen=document.querySelector('#replace-template').value,form=t.library.forms.find(f=>f.id===chosen),custom=form?{title:form.title,...toDefinition(form)}:{};await api('/api/demo',{action:'replace',number:t.number,generation:activeSession().generation,template:Number(chosen),...custom});t.selected=null;dialog.close();await refreshTeacher();toast('Đã thay bài trong demo; bài cũ vẫn ở Lịch sử thu hồi.');return;}
  if(button?.hasAttribute('data-confirm-reset')){await api('/api/demo',{action:'reset'});dialog.close();t.selected=null;t.drafts.clear();t.library={version:1,forms:[],assignments:[]};await refreshTeacher();toast('Đã trở về dữ liệu chụp ban đầu.');return;}
  if(button?.hasAttribute('data-archive')){const archive=activeSession().retired[Number(button.dataset.archive)];dialog.close();modal('Bài đã thu hồi · Chỉ đọc',archiveBody(archive));return;}
  if(button?.hasAttribute('data-library')){const v=t.data.sessions.find(v=>v.number===Number(button.dataset.library));modal(`Phiếu buổi ${v.number} · Nội dung gốc`,readonly({definition:v.definition,responses:{},gradingItems:[]}));return;}
  if(button?.hasAttribute('data-question')){const v=activeSession().analytics.find(i=>i.id===button.dataset.question);modal('Chi tiết câu hỏi',`<h2 style="white-space:pre-wrap;margin-bottom:16px">${esc(v.prompt)}</h2><p>${v.counts.correct} đúng · ${v.counts.incorrect} sai · ${v.counts.unanswered} để trống</p>${v.choices.map(c=>`<details class="panelBody" style="border-top:1px solid var(--line)"><summary><b>${c.count}</b> học viên · ${esc(c.label)}</summary><ul>${(v.students||[]).filter(p=>p.optionIds?.includes(c.optionId)).map(p=>`<li>${esc(p.name)} · ${p.verdict==='correct'?'Đúng':'Sai'}</li>`).join('')}</ul></details>`).join('')}<p class="caption">Số liệu gốc tại thời điểm chụp; không gồm các bài làm thử.</p>`);return;}
  if(button?.hasAttribute('data-page'))return changeTeacher(()=>{t.page=button.dataset.page;t.selected=null;});
  if(button?.hasAttribute('data-session-mode'))return changeTeacher(()=>{t.mode=button.dataset.sessionMode;t.selected=null;});
  if(button?.hasAttribute('data-select-question')){t.question=button.dataset.selectQuestion;renderTeacher();return;}
  if(button?.hasAttribute('data-journey-group'))return changeTeacher(()=>{t.group=button.dataset.journeyGroup;t.selected=null;});
  if(button?.hasAttribute('data-start-part')){s.expanded.add(button.dataset.startPart);renderStudent();const field=document.querySelector(`[data-part="${button.dataset.startPart}"] .partBody`);field?.scrollIntoView({block:'nearest'});field?.querySelector('input,textarea')?.focus({preventScroll:true});return;}
  if(button?.hasAttribute('data-collapse-part')){const id=button.dataset.collapsePart;await saveStudent();s.expanded.delete(id);renderStudent();document.querySelector(`[data-start-part="${id}"]`)?.focus({preventScroll:true});return;}
  if(button?.hasAttribute('data-tab'))return changeTeacher(()=>{t.tab=button.dataset.tab;t.selected=null;});
  if(button?.hasAttribute('data-session'))return changeTeacher(()=>{t.number=Number(button.dataset.session);t.selected=null;t.filter='all';});
  if(button?.hasAttribute('data-skill'))return changeTeacher(()=>{t.skill=button.dataset.skill;t.group='all';if(t.selected?.startsWith('journey-scenario-')&&!['listening','reading'].includes(t.skill))t.selected=null;});
  if(button?.hasAttribute('data-open-detail-session'))return changeTeacher(()=>{t.number=Number(button.dataset.openDetailSession);t.tab='session';t.mode='results';});
  if(button?.hasAttribute('data-person-step')){const list=t.tab==='session'?visiblePeople():t.data.people;const index=list.findIndex(v=>v.studentRef===t.selected)+Number(button.dataset.personStep);if(list[index])return changeTeacher(()=>t.selected=list[index].studentRef);return;}
  if(row||button?.hasAttribute('data-person')){const ref=button?.dataset.person||row.dataset.person;const previous=document.querySelector('#people-scroll');const scroll={x:previous?.scrollLeft||0,y:previous?.scrollTop||0};const wasOpen=Boolean(t.selected);await changeTeacher(()=>t.selected=ref);const list=document.querySelector('#people-scroll');if(list){list.scrollLeft=scroll.x;list.scrollTop=scroll.y;}if(!wasOpen){if(t.tab==='session')scrollToResults('people');else document.querySelector('.split')?.scrollIntoView({block:'start'});}return;}
  if(button?.hasAttribute('data-action'))return teacherAction(button);
  if(button?.hasAttribute('data-release')){await teacherSave();const session=activeSession(),release=session.releases.find(r=>r.blockId===button.dataset.release);await api('/api/demo',{action:'release',number:t.number,generation:session.generation,blockId:release.blockId,open:release.status!=='open'});await refreshTeacher();toast('Đã đổi phần mở trong demo.');return;}
  if(button?.hasAttribute('data-student-tab')){await saveStudent();s.tab=button.dataset.studentTab;renderStudent();return;}
  if(button?.hasAttribute('data-student-open')){await saveStudent();s.tab='session';await openStudent(Number(button.dataset.studentOpen));return;}
  if(button?.hasAttribute('data-student-action'))return studentAction(button.dataset.studentAction);
  if(button?.hasAttribute('data-submit-block')){const id=button.dataset.submitBlock;await saveStudent();await api('/api/demo',{action:'checkpoint',number:s.number,generation:s.data.generation,ref:s.ref,blockId:id,responses:s.responses});const expanded=new Set(s.expanded);await openStudent();s.expanded=expanded;renderStudent();const part=document.querySelector(`[data-part="${id}"]`);if(part){part.tabIndex=-1;part.scrollIntoView({block:'start'});part.focus({preventScroll:true});}toast('Đã nộp phần này và ghi nhận tham gia trong demo.');return;}
})().catch(error=>toast(error.message));});
window.addEventListener('beforeunload',event=>{if(s.dirty||t.pending||s.pending||t.saveError||t.editing){event.preventDefault();event.returnValue='';}});
// Đóng bằng nền chỉ khi cả điểm nhấn xuống và nhả đều ở ngoài khung, tránh đóng khi kéo chọn chữ.
let dialogPointerOutside=false;
const outsideDialog=event=>{const r=dialog.getBoundingClientRect();return event.target===dialog&&(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom);};
dialog.addEventListener('pointerdown',event=>{dialogPointerOutside=outsideDialog(event);});
dialog.addEventListener('click',event=>{if(dialog.open&&dialogPointerOutside&&outsideDialog(event))dialog.close();dialogPointerOutside=false;});
window.addEventListener('focus',()=>{
  if(!isStudent||!s.data||s.identityStage!=='ready'||s.dirty||s.pending)return;
  const expanded=new Set(s.expanded);openStudent().then(()=>{s.expanded=expanded;renderStudent();}).catch(error=>toast(error.message));
});
document.addEventListener('keydown',event=>{
  const current=event.target.closest('[role="tab"]'),group=current?.closest('[role="tablist"]');
  if(group&&['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){
    event.preventDefault();const tabs=[...group.querySelectorAll('[role="tab"]')],index=tabs.indexOf(current);
    const next=event.key==='Home'?tabs[0]:event.key==='End'?tabs.at(-1):tabs[(index+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length];
    next.click();
  }
  if(event.key==='Escape'&&!dialog.open&&t.selected&&!isStudent){event.preventDefault();changeTeacher(()=>t.selected=null).catch(error=>toast(error.message));}
});
(isStudent?openStudent():refreshTeacher()).catch(error=>{app.innerHTML=`<div class="fixedError"><h1>Chưa mở được demo</h1><p style="margin:16px 0">${esc(error.message)}</p><button class="btn" data-reload>Thử tải lại</button></div>`;});

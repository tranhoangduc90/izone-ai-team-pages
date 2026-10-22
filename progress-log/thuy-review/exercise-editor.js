/* Reusable exercise authoring in the local prototype. No portal writes. */
(function(){
 const M=ProgressLogLibraryModel,T=M.questionTypes,W=ProgressLogWorksheet;
 let draft,host,callbacks,previewing=false;
 function questionsFor(sectionId){return draft.questions.map((q,i)=>({q,i})).filter(({q})=>!draft.sections.length||q.section===sectionId)}
 const numeric=p=>['listening','reading'].includes(p.skill);
 const field=(name,label,value='',type='text',extra='')=>`<label class="repo-field"><span>${label}</span><input data-edit="${name}" type="${type}" value="${esc(value)}" ${extra}></label>`;
 const area=(name,label,value='',rows=3)=>`<label class="repo-field"><span>${label}</span><textarea data-edit="${name}" rows="${rows}" maxlength="12000">${esc(value)}</textarea></label>`;
 const part=()=>draft;
 function reflectionQuestion(){const q=M.newQuestion('multi','reflection');q.prompt='Những mô tả nào phù hợp với phần Speaking của em?';q.options=[...ProgressLogJourneyModel.speakingReflectionOptions];return q}
 const safeUrl=value=>{try{const u=new URL(value);return ['http:','https:'].includes(u.protocol)?esc(u.href):''}catch{return ''}};
 function previewPartContent(p){
  return `${p.instructions?`<p class="exercise-instructions">${esc(p.instructions)}</p>`:''}${p.passage?`<details class="exercise-passage"><summary>Nội dung chung</summary><p>${esc(p.passage)}</p></details>`:''}${safeUrl(p.audioUrl)?`<a class="exercise-audio" href="${safeUrl(p.audioUrl)}" target="_blank" rel="noopener">Mở bài nghe ↗</a>`:''}${(p.questions||[]).map((q,i)=>{
   const choice=['mcq','multi'].includes(q.type),answer=choice?(q.answers||[]).map(a=>`${String.fromCharCode(65+a)}. ${q.options[a]||''}`).join('; '):q.type==='matching'?(q.pairs||[]).map(p=>`${p.left} → ${p.right}`).join('; '):q.answer||'';
   return `<section class="exercise-preview-question"><h4>Câu ${i+1} · ${T[q.type]||''}${q.type==='score'?' · Tự báo':!W.graded(q)?' · Tự nhận xét':''}</h4><p>${esc(q.prompt)}</p>${choice?(q.options||[]).map((o,j)=>`<label class="exercise-preview-choice"><input type="${q.type==='mcq'?'radio':'checkbox'}" name="preview-${p.skill}-${i}"> <span>${String.fromCharCode(65+j)}. ${esc(o)}</span></label>`).join(''):q.type==='matching'?window.ProgressLogMatchingMarkup(q.pairs||[]):q.type==='score'?window.ProgressLogScoreMarkup(q.total,{previewId:q.id}):`<textarea aria-label="Trả lời câu ${i+1}" rows="${q.type==='gap'?1:3}" placeholder="${q.type==='gap'?'Điền câu trả lời':'Nhập câu trả lời'}"></textarea>`}${q.type==='open'?window.ProgressLogHintMarkup(q.answer):''}${W.graded(q)&&(answer||q.explanation)?`<details class="exercise-answer"><summary>Xem đáp án</summary><p>${esc(answer)}</p>${q.explanation?`<p>${esc(q.explanation)}</p>`:''}</details>`:''}</section>`;
  }).join('')}`;
 }
 function questionTags(q,i){return `<div class="question-tags"><select class="question-tag skill-tag" data-q="skill" aria-label="Kỹ năng câu ${i+1}">${(q.type==='score'?[['','Kỹ năng'],['listening','Listening'],['reading','Reading']]:Object.entries(W.skills)).map(([id,name])=>`<option value="${id}" ${(q.skill||'general')===id?'selected':''}>${name}</option>`).join('')}</select>${draft.sections.length?`<select class="question-tag section-tag is-grouped" data-q="section" aria-label="Phần câu ${i+1}">${draft.sections.map(p=>`<option value="${p.id}" ${q.section===p.id?'selected':''}>${esc(p.title||'Chưa đặt tên')}</option>`).join('')}</select>`:'<span class="question-tag ungrouped-tag">Một phiếu</span>'}</div>`}
 function divisionSettings(){return `<section class="panel exercise-division"><div class="division-head"><h2>Cấu trúc bài tập</h2><div class="division-mode"><button type="button" data-editor-division="single" aria-pressed="${!draft.sections.length}">Không chia phần</button><button type="button" data-editor-division="split" aria-pressed="${!!draft.sections.length}">Chia phần</button></div></div>${draft.sections.length?`<div class="division-fields"><label class="repo-field"><span>Số phần</span><select id="exerciseSectionCount" aria-label="Số phần">${Array.from({length:9},(_,i)=>i+2).map(n=>`<option value="${n}" ${draft.sections.length===n?'selected':''}>${n}</option>`).join('')}</select></label><div class="section-names">${draft.sections.map((p,i)=>`<label class="repo-field"><span>Phần ${i+1}</span><input type="text" data-section-title="${p.id}" aria-label="Tên phần ${i+1}" maxlength="80" value="${esc(p.title)}" placeholder="Đặt tên phần"></label>`).join('')}</div></div>`:''}</section>`}
 function resizeSections(count){
  if(!Number.isInteger(count)||count<2||count>10){error('Số phần từ 2 đến 10.');return}
  if(count<draft.sections.length&&draft.questions.some(q=>draft.sections.slice(count).some(p=>p.id===q.section))){render('#exerciseSectionCount');error('Phần cần bỏ đang có câu hỏi. Chuyển các câu sang phần khác trước.');return}
  while(draft.sections.length<count){const i=draft.sections.length;draft.sections.push({id:crypto.randomUUID(),title:i===0?'Ôn tập':i===1?'Bài mới':'Phần '+(i+1)})}
  draft.sections=draft.sections.slice(0,count);
  for(const q of draft.questions)if(!draft.sections.some(p=>p.id===q.section))q.section=draft.sections[0].id;
  render('#exerciseSectionCount');
 }
 function questionEditor(q,i){
  const choices=['mcq','multi'].includes(q.type),visible=questionsFor(q.section),position=visible.findIndex(item=>item.i===i),first=position===0,last=position===visible.length-1;
  return `<article class="exercise-question" data-question="${i}"><div class="exercise-question-head"><h3>Câu ${i+1} <span>${T[q.type]}</span></h3>${questionTags(q,i)}<div class="actions"><button type="button" data-question-move="${i}" data-direction="-1" aria-label="Đưa câu ${i+1} lên" ${first?'disabled':''}>↑</button><button type="button" data-question-move="${i}" data-direction="1" aria-label="Đưa câu ${i+1} xuống" ${last?'disabled':''}>↓</button><button type="button" data-question-remove="${i}" aria-label="Bỏ câu ${i+1}">Bỏ</button></div></div>${choices&&['listening','reading'].includes(q.skill)?`<label class="repo-field exercise-purpose"><span>Mục đích</span><select data-q="purpose"><option value="practice" ${q.purpose==='practice'?'selected':''}>Luyện tập</option><option value="reflection" ${!W.graded(q)?'selected':''}>Phản hồi · Không chấm điểm</option></select></label>`:''}${area('questionPrompt','Nội dung câu hỏi',q.prompt,2)}${choices?`<div class="exercise-options"><div class="exercise-options-label">${!W.graded(q)?'Các lựa chọn':'Các lựa chọn · Đánh dấu đáp án đúng'}</div>${q.options.map((o,j)=>`<div class="exercise-option">${!W.graded(q)?`<span>${String.fromCharCode(65+j)}</span>`:`<input data-answer="${j}" type="${q.type==='mcq'?'radio':'checkbox'}" name="answer-${i}" aria-label="Đáp án đúng ${String.fromCharCode(65+j)} câu ${i+1}" ${(q.answers||[]).includes(j)?'checked':''}>`}<input data-option="${j}" aria-label="Lựa chọn ${String.fromCharCode(65+j)} câu ${i+1}" value="${esc(o)}" placeholder="Lựa chọn ${String.fromCharCode(65+j)}"><button type="button" data-option-remove="${j}" aria-label="Bỏ lựa chọn ${String.fromCharCode(65+j)} câu ${i+1}" ${q.options.length<=2?'disabled':''}>×</button></div>`).join('')}${q.options.length<8?`<button class="ghost" type="button" data-option-add>+ Thêm lựa chọn</button>`:''}</div>`:''}${q.type==='score'?field('questionTotal','Tổng số câu của bài trên lớp',q.total||20,'number','min="1" max="100"'):''}${q.type==='gap'&&W.graded(q)?area('questionAnswer','Đáp án chấp nhận · Mỗi dòng một đáp án',q.answer,2):''}${q.type==='open'?area('questionAnswer','Gợi ý trả lời',q.answer||'',2):''}${q.type==='matching'?`<div class="exercise-pairs">${q.pairs.map((v,j)=>`<div class="exercise-pair"><input data-pair-left="${j}" aria-label="Vế trái cặp ${j+1} câu ${i+1}" value="${esc(v.left)}" placeholder="Vế trái"><span>→</span><input data-pair-right="${j}" aria-label="Vế phải cặp ${j+1} câu ${i+1}" value="${esc(v.right)}" placeholder="Vế phải"><button type="button" data-pair-remove="${j}" aria-label="Bỏ cặp ${j+1} câu ${i+1}" ${q.pairs.length<=2?'disabled':''}>×</button></div>`).join('')}<button class="ghost" type="button" data-pair-add>+ Thêm cặp</button></div>`:''}${W.graded(q)?`<details class="exercise-explanation"><summary>Giải thích đáp án</summary>${area('explanation','Giải thích',q.explanation,2)}</details>`:''}</article>`;
 }
 function toolbar(){return `<header class="exercise-toolbar"><div><button type="button" class="ghost" data-editor-exit>← Quản lý bài tập</button><h1>${draft.id?'Sửa bài tập':'Tạo bài tập'}</h1></div><div class="actions"><small data-editor-draft-state role="status"></small><button type="button" data-editor-preview ${!draft.questions.length?'disabled':''}>${previewing?'Tiếp tục soạn':'Xem trước'}</button><button type="button" data-editor-save="draft">Lưu nháp</button><button type="button" class="primary" data-editor-save="published">${draft.id&&draft.status!=='draft'?'Lưu thay đổi':'Xuất bản'}</button></div></header>`}
 function render(focus){
  const info=`<section class="panel exercise-info"><div class="exercise-meta">${field('title','Tên bài tập',draft.title,'text','maxlength="150" placeholder="Nhập tên bài tập"')}<label class="repo-field"><span>Trình độ</span><select data-edit="level"><option value="" ${!draft.level?'selected':''} disabled>Chọn trình độ</option>${M.levels.map(l=>`<option ${draft.level===l?'selected':''}>${l}</option>`).join('')}</select></label></div><details><summary>Hướng dẫn toàn bài</summary>${area('instructions','Hướng dẫn',draft.instructions||'')}${field('audioUrl','Liên kết bài nghe (nếu có)',draft.audioUrl||'','url','placeholder="https://…"')}</details></section>`;
  let content;
  if(previewing){
   content='<section class="panel exercise-student-preview">'+window.ProgressLogInstructionsMarkup(draft.instructions)+W.normalize(draft).parts.map(p=>'<div class="exercise-part"><h2>'+esc(p.title)+'</h2>'+previewPartContent(p)+'</div>').join('')+'</section>';
  }else{
   const sections=draft.sections.length?draft.sections:[{id:'',title:'Bài tập'}];
   content=info+divisionSettings()+`<div id="exerciseQuestions" class="exercise-all-sections">${sections.map((section,index)=>{
    const questions=questionsFor(section.id);
    return `<section class="exercise-part exercise-section-block" data-editor-part="${section.id}" aria-label="${esc(section.title)}"><header class="exercise-section-heading"><div><h2 tabindex="-1">${draft.sections.length?`Phần ${index+1} · `:''}${esc(section.title)}</h2><span>${questions.length} câu hỏi</span></div><button type="button" class="exercise-ai-launch" data-editor-ai data-target-section="${section.id}" aria-label="Tạo bằng AI cho ${esc(section.title)}">${ProgressLogExerciseAI.icon} Tạo bằng AI</button></header><div class="exercise-add-question"><div>${Object.entries(T).map(([id,name])=>`<button type="button" data-question-add="${id}" data-target-section="${section.id}">+ ${name}</button>`).join('')}</div></div><div class="exercise-section-questions">${questions.length?questions.map(({q,i})=>questionEditor(q,i)).join(''):'<p class="exercise-part-empty">Chưa có câu hỏi.</p>'}</div></section>`;
   }).join('')}</div>`;
  }
  host.innerHTML=`<div class="exercise-editor">${toolbar()}<p id="exerciseError" class="repo-error" role="alert" tabindex="-1" hidden></p>${content}</div>`;


  callbacks.change?.(structuredClone(draft));
  if(focus)(host.querySelector(focus)||host.querySelector('[data-editor-part] h2'))?.focus({preventScroll:true});
 }
 function capture(){
  if(previewing)return;
  const get=name=>host.querySelector(`[data-edit="${name}"]`)?.value;
  if(host.querySelector('[data-edit="title"]')){draft.title=get('title');draft.level=get('level');draft.instructions=get('instructions');draft.audioUrl=get('audioUrl')||''}const p=draft;
  host.querySelectorAll('[data-section-title]').forEach(el=>{const part=draft.sections.find(p=>p.id===el.dataset.sectionTitle);if(part)part.title=el.value});
  host.querySelectorAll('[data-question]').forEach(el=>{
   const q=p.questions[Number(el.dataset.question)],value=name=>el.querySelector(`[data-edit="${name}"]`)?.value;
   q.prompt=value('questionPrompt');q.explanation=value('explanation')||'';
   q.skill=el.querySelector('[data-q="skill"]')?.value|| (q.type==='score'?'':'general');q.section=el.querySelector('[data-q="section"]')?.value||'';
   if(el.querySelector('[data-q="purpose"]'))q.purpose=el.querySelector('[data-q="purpose"]').value;
   if(q.type==='score')q.total=Number(value('questionTotal'));
   if(q.options){q.options=Array.from(el.querySelectorAll('[data-option]')).map(v=>v.value);q.answers=Array.from(el.querySelectorAll('[data-answer]:checked')).map(v=>Number(v.dataset.answer));}
   if(['gap','open'].includes(q.type))q.answer=value('questionAnswer');
   if(q.pairs)q.pairs=Array.from(el.querySelectorAll('[data-pair-left]')).map((v,i)=>({left:v.value,right:el.querySelector(`[data-pair-right="${i}"]`).value}));
  });
 }
 function error(message){const el=host.querySelector('#exerciseError');el.hidden=false;el.textContent=message;el.focus();el.scrollIntoView({block:'nearest'})}
 function open(value,options){
  draft=W.toDraft(value);if(!M.levels.includes(draft.level))draft.level='';host=$('libraryView');callbacks=options;previewing=false;
  render();host.querySelector('h1').setAttribute('tabindex','-1');host.querySelector('h1').focus();
 }
 document.addEventListener('click',e=>{
  const b=e.target.closest('.exercise-editor button');if(!b)return;
  const d=b.dataset;
  capture();
  if('editorAi'in d){const target=d.targetSection||'',sectionTitle=draft.sections.find(p=>p.id===target)?.title;ProgressLogExerciseAI.open({draftKey:JSON.stringify([draft.id,target]),skill:'general',sectionTitle,apply:(items,title)=>{draft=ProgressLogExerciseAIModel.merge(draft,items,title,target);previewing=false;render(`[data-question="${draft.questions.length-items.length}"] textarea`);toast(`Đã thêm ${items.length} câu${sectionTitle?' vào '+sectionTitle:''}.`)}});return}
  if('editorDivision'in d){if(d.editorDivision==='single'){draft.sections=[];draft.questions.forEach(q=>q.section='');render('[data-editor-division="single"]')}else if(!draft.sections.length)resizeSections(2);return}
  if('editorExit'in d){callbacks.cancel();return}
  if('editorSave'in d){try{callbacks.save(structuredClone(draft),d.editorSave)}catch(err){error(err.message)}return}
  if('editorPreview'in d){previewing=!previewing;render();return}
  const p=part(),el=b.closest('[data-question]'),i=el?Number(el.dataset.question):null,q=el?p.questions[i]:null;
  if('questionAdd'in d){if(p.questions.length>=200){error('Mỗi bài có tối đa 200 câu hỏi.');return}p.questions.push({...M.newQuestion(d.questionAdd),skill:d.questionAdd==='score'?'':'general',section:d.targetSection||''});render(`[data-question="${p.questions.length-1}"] textarea`);host.querySelector(`[data-question="${p.questions.length-1}"]`).scrollIntoView({block:'start'});return}
  if('reflectionTemplate'in d){p.questions.push({...reflectionQuestion(),skill:'speaking',section:d.targetSection||''});render();return}
  let moveTo=null;
  if('questionRemove'in d)p.questions.splice(i,1);
  if('questionMove'in d){const visible=questionsFor(q.section),position=visible.findIndex(item=>item.i===i),j=visible[position+Number(d.direction)]?.i;if(j===undefined)return;moveTo=j;[p.questions[i],p.questions[j]]=[p.questions[j],p.questions[i]]}
  if('optionAdd'in d)q.options.push('');
  if('optionRemove'in d){const j=Number(d.optionRemove);q.options.splice(j,1);q.optionIds?.splice(j,1);q.answers=q.answers.filter(v=>v!==j).map(v=>v>j?v-1:v)}
  if('pairAdd'in d)q.pairs.push({left:'',right:''});
  if('pairRemove'in d)q.pairs.splice(Number(d.pairRemove),1);
  const target='optionAdd'in d?`[data-question="${i}"] [data-option="${q.options.length-1}"]`:
   'optionRemove'in d?`[data-question="${i}"] [data-option="${Math.min(Number(d.optionRemove),q.options.length-1)}"]`:
   'pairAdd'in d?`[data-question="${i}"] [data-pair-left="${q.pairs.length-1}"]`:
   'pairRemove'in d?`[data-question="${i}"] [data-pair-left="${Math.min(Number(d.pairRemove),q.pairs.length-1)}"]`:
   'questionMove'in d?`[data-question="${moveTo}"] textarea`:
   'questionRemove'in d?(p.questions.length?`[data-question="${Math.min(i,p.questions.length-1)}"] textarea`:'[data-question-add="mcq"]'):null;
  render(target);
 });
 document.addEventListener('input',e=>{
  if(e.target.matches('.exercise-editor [data-preview-score]')){window.ProgressLogScoreValidity(e.target,Number(e.target.max),document.getElementById(e.target.getAttribute('aria-describedby')));return;}
  if(previewing||!e.target.closest('.exercise-editor'))return;
  capture();callbacks.change?.(structuredClone(draft));
  if(!e.target.matches('.exercise-editor [data-section-title]'))return;
  capture();
  draft.sections.forEach((section,index)=>{
   const title=section.title||'Chưa đặt tên',block=host.querySelector(`[data-editor-part="${section.id}"]`);
   if(block){block.setAttribute('aria-label',title);block.querySelector('h2').textContent=`Phần ${index+1} · ${title}`;block.querySelector('[data-editor-ai]').setAttribute('aria-label',`Tạo bằng AI cho ${title}`)}
   host.querySelectorAll('[data-q="section"] option').forEach(option=>{if(option.value===section.id)option.textContent=title});
  });
 });
 document.addEventListener('change',e=>{
  if(previewing||!e.target.closest('.exercise-editor'))return;
  capture();callbacks.change?.(structuredClone(draft));
  if(e.target.matches('#exerciseSectionCount')){capture();resizeSections(Number(e.target.value));return}
  if(!e.target.matches('.exercise-editor [data-q]'))return;
  const el=e.target.closest('[data-question]'),index=Number(el.dataset.question),kind=e.target.dataset.q;
  capture();render(`[data-question="${index}"] [data-q="${kind}"]`);
 });
 window.ProgressLogExerciseEditor={open,previewPartContent,current:()=>{capture();return structuredClone(draft)}};
})();

/* AI authoring flow prototype. Local analysis only; no external AI request. */
(function(){
 const model=ProgressLogExerciseAIModel,skills=ProgressLogWorksheet.skills;
 let dialog,settings,source='',fallback='',result=null,selected=[],returnFocus,scopeKey;
 const drafts=new Map();
 function remember(){if(scopeKey)drafts.set(scopeKey,{source,fallback,result:structuredClone(result),selected:[...selected]});}
 const icon='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>';
 function ensure(){
  if(dialog)return;
  dialog=document.createElement('dialog');dialog.id='exerciseAiDialog';dialog.setAttribute('aria-labelledby','exerciseAiTitle');document.body.append(dialog);
  dialog.addEventListener('close',()=>{remember();if(returnFocus?.isConnected)returnFocus.focus({preventScroll:true});else document.querySelector('[data-editor-ai]')?.focus({preventScroll:true})});
  let pointerOutside=false;
  const outside=e=>{const r=dialog.getBoundingClientRect();return e.target===dialog&&(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)};
  dialog.addEventListener('pointerdown',e=>{pointerOutside=outside(e)});
  dialog.addEventListener('click',e=>{
   if(e.target===dialog){if(pointerOutside&&outside(e))dialog.close();pointerOutside=false;return}
   pointerOutside=false;
   const b=e.target.closest('button');if(!b)return;
   const d=b.dataset;
   if('aiClose'in d)dialog.close();
   if('aiSample'in d){dialog.querySelector('#aiSource').value=model.sample;dialog.querySelector('#aiSource').focus();updateInputCount()}
   if('aiAnalyze'in d){
    source=dialog.querySelector('#aiSource').value;fallback=dialog.querySelector('#aiTargetSkill').value;
    try{result=model.parse(source,fallback);selected=result.items.map(()=>true);render()}catch(err){showError(err.message)}
   }
   if('aiBack'in d){result=null;render();dialog.querySelector('#aiSource').focus()}
   if('aiApply'in d){
    try{const included=result.items.filter((_,i)=>selected[i]);settings.apply(included,result.title);drafts.delete(scopeKey);scopeKey=null;dialog.close();document.querySelector('[data-editor-ai]')?.focus({preventScroll:true})}catch(err){showError(err.message)}
   }
  });
  dialog.addEventListener('input',e=>{if(e.target.id==='aiSource'){source=e.target.value;updateInputCount();remember()}});
  dialog.addEventListener('change',e=>{
   if(e.target.id==='aiTargetSkill')fallback=e.target.value;
   if(e.target.matches('[data-ai-include]')){selected[Number(e.target.dataset.aiInclude)]=e.target.checked;updateSelection()}
   if(e.target.matches('[data-ai-skill]'))result.items[Number(e.target.dataset.aiSkill)].skill=e.target.value;
   if(e.target.id==='aiSelectAll'){selected=result.items.map(()=>e.target.checked);dialog.querySelectorAll('[data-ai-include]').forEach(c=>c.checked=e.target.checked);updateSelection()}
   remember();
  });
 }
 function showError(message){const el=dialog.querySelector('#aiError');el.hidden=false;el.textContent=message;el.focus();el.scrollIntoView({block:'nearest'})}
 function updateInputCount(){const field=dialog.querySelector('#aiSource'),n=field.value.length;dialog.querySelector('#aiCharacterCount').textContent=`${n.toLocaleString('vi-VN')} / 24.000 ký tự`;dialog.querySelector('[data-ai-analyze]').disabled=!field.value.trim()}
 function updateSelection(){const count=selected.filter(Boolean).length,b=dialog.querySelector('[data-ai-apply]'),all=dialog.querySelector('#aiSelectAll');b.textContent=`Thêm ${count} câu vào bài`;b.disabled=count===0;all.checked=count===selected.length;all.indeterminate=count>0&&count<selected.length;dialog.querySelector('#aiSelectedCount').textContent=`Đã chọn ${count} / ${selected.length} câu`}
 function render(){
  const warnings=result?.items.filter(i=>i.warnings.length).length||0;
  dialog.innerHTML=`<header class="exercise-ai-head"><div><h2 id="exerciseAiTitle" tabindex="-1">${icon} Tạo câu hỏi bằng AI${settings.sectionTitle?' · '+esc(settings.sectionTitle):''}</h2><p>Chưa kết nối AI · Chỉ tách nội dung bạn dán, không sinh câu hoặc đáp án</p></div><button type="button" data-ai-close aria-label="Đóng tạo bài bằng AI">×</button></header><div class="exercise-ai-body"><div class="exercise-ai-steps" aria-label="Bước hiện tại"><span ${result?'':'aria-current="step"'}>1. Nội dung</span><span ${result?'aria-current="step"':''}>2. Kiểm tra câu hỏi</span></div><p id="aiError" class="repo-error" role="alert" tabindex="-1" hidden></p>${result?`<div class="exercise-ai-review-head"><label><input type="checkbox" id="aiSelectAll" checked> Chọn tất cả</label><span id="aiSelectedCount" role="status"></span></div>${warnings?`<p class="exercise-ai-warning">${warnings} câu cần bổ sung đáp án hoặc lựa chọn trong màn soạn bài.</p>`:''}<div class="exercise-ai-review">${result.items.map((item,i)=>`<article class="exercise-ai-card"><div class="exercise-ai-card-head"><label><input type="checkbox" data-ai-include="${i}" checked aria-label="Dùng câu ${i+1}"><strong>Câu ${i+1}</strong><span>${ProgressLogLibraryModel.questionTypes[item.question.type]}${item.question.purpose==='reflection'?' · Tự nhận xét':''}</span></label><select data-ai-skill="${i}" aria-label="Kỹ năng câu ${i+1}">${Object.entries(skills).map(([id,name])=>`<option value="${id}" ${item.skill===id?'selected':''}>${name}</option>`).join('')}</select></div>${ProgressLogExerciseEditor.previewPartContent({skill:'ai-'+i,questions:[{...item.question,skill:item.skill}]}).replace(/<h4>.*?<\/h4>/,'').replace(/Trả lời câu 1/g,`Trả lời câu ${i+1}`)}${item.warnings.map(message=>`<p class="exercise-ai-question-warning">${esc(message)}</p>`).join('')}</article>`).join('')}</div>`:`<div class="exercise-ai-input-head"><label for="aiSource">Nội dung đề bài</label></div><textarea id="aiSource" rows="11" maxlength="24000" placeholder="Dán câu hỏi, các lựa chọn và đáp án…">${esc(source)}</textarea><div class="exercise-ai-input-meta"><label for="aiTargetSkill">Kỹ năng khi đề không ghi rõ <select id="aiTargetSkill"><option value="" ${!fallback?'selected':''}>Chọn kỹ năng</option>${Object.entries(skills).map(([id,name])=>`<option value="${id}" ${fallback===id?'selected':''}>${name}</option>`).join('')}</select></label><span id="aiCharacterCount"></span></div>`}</div><footer class="exercise-ai-foot"><button type="button" ${result?'data-ai-back':'data-ai-close'}>${result?'Sửa nội dung':'Hủy'}</button><button type="button" class="primary" ${result?'data-ai-apply':'data-ai-analyze'}>${result?'Thêm câu vào bài':'Phân tích nội dung'}</button></footer>`;
  if(result){dialog.querySelectorAll('[data-ai-include]').forEach((input,i)=>input.checked=selected[i]);updateSelection();}else updateInputCount();
  dialog.scrollTop=0;dialog.querySelector('#exerciseAiTitle').focus({preventScroll:true});
 }
 function open(options){ensure();settings=options;scopeKey=options.draftKey;const saved=drafts.get(scopeKey);fallback=saved?.fallback??options.skill??'';source=saved?.source||'';result=structuredClone(saved?.result||null);selected=[...(saved?.selected||[])];returnFocus=document.activeElement;render();dialog.showModal();dialog.querySelector('#aiSource')?.focus()}
 window.ProgressLogExerciseAI={open,icon};
})();

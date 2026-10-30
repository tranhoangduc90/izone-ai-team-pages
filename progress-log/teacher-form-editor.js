/* Nhận lớp, phiếu nguồn và API của phiên giảng viên. Soạn đúng 8 dạng đang dùng,
 * lưu nháp ở máy chủ, đối chiếu khi xung đột, xem thử tách biệt rồi duyệt/phát hành.
 * Đáp án chỉ giữ trong bộ nhớ tab; lỗi mạng giữ phần đang soạn và không báo đã lưu. */
import {createFormLibrary} from './teacher-form-library.js?rev=20261030-the22-23-v1';
import {bindDialogDismiss} from './session-comments.js';
import {openWorksheetPreview} from './worksheet-preview.js?rev=20261030-personal-assign-v1';
import {importReviewCard} from './docs-import-review.js?rev=20261025-docs-import-v1';
import {createDocsBatchImporter} from './docs-batch-import.js?rev=20261029-authoring-actions-v2';
import {PART_TYPES,PART_SKILLS,selectedLimit,preparePartItem,missingSkills} from './authoring-parts.js?rev=20261028-the15-v1';
import {editorItemKind} from './item-kind.js?rev=20261028-the15-v1';
import {changeQuestionKind,incompleteAnswerRows} from './authoring-answers.js?rev=20261028-the15-v1';
import {mountGapAuthoring,mountSlotAnswers} from './gap-authoring.js?rev=20261030-the22-23-v1';
import {createAssignmentDialog} from './teacher-assignment-dialog.js?rev=20261030-the22-23-v1';
import {authoringAction} from './authoring-action.js?rev=20261029-authoring-actions-v2';
import {collectPublishIssues,schemaFieldIssues,showAuthoringIssues} from './authoring-validation.js?rev=20261030-the22-23-v1';
import {AI_IMPORT_EXAMPLE} from './ai-import-example.js?rev=20261030-the22-23-v1';
export const EDITOR_TYPES=[['reflection','Câu trả lời mở'],['mcq','Chọn một phương án'],
  ['multi','Chọn nhiều đáp án'],['matching','Nối cặp'],['short_answer','Điền từ — đáp án chấp nhận'],
  ['dropdown','Dropdown Matching Headings'],['gapfill','Điền từ trong câu / chuỗi lập luận'],
  ['numbered_short_texts','Nhóm ô ngắn đánh số'],['speaking_checklist','Checklist Speaking'],
  ['conditional_explanation','Ô giải thích có điều kiện'],['self_reported_score','Số câu đúng tự khai']];

const uuid=()=>crypto.randomUUID();
const clone=value=>structuredClone(value);
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
function el(tag,text,attributes={}) {
  const node=document.createElement(tag);if(text!==undefined)node.textContent=text;
  Object.assign(node,attributes);return node;
}
function button(text,action,disabled=false) {
  const node=el('button',text,{type:'button',className:'button',disabled});
  node.addEventListener('click',action);return node;
}
const addButton=(text,action,disabled=false)=>authoringAction(button(text,action,disabled),'add');
const removeButton=(text,action,disabled=false,label)=>authoringAction(button(text,action,disabled),'remove',{iconOnly:text==='×',label});
export function editorType(item) {
  if(item.layoutType==='multiple_choice_cards')return 'multi';
  if(item.layoutType==='matching_pairs')return 'matching';
  if(item.interactionType==='short_text'&&item.layoutType==='plain_prompt')return 'short_answer';
  if(item.interactionType==='multi_choice_group'&&item.layoutType==='keyword_selection')return 'keyword_selection';
  if(item.layoutType==='matching_heading_dropdown')return 'dropdown';
  if(item.layoutType==='choice_cards')return 'mcq';
  if(item.layoutType==='speaking_issue_checklist')return 'speaking_checklist';
  if(['conditional_other_text','inline_option_text'].includes(item.layoutType))return 'conditional_explanation';
  if(item.layoutType==='score_fraction')return 'self_reported_score';
  if(item.layoutType==='reasoning_chain_completion'||item.interactionConfig.sentenceLines)return 'gapfill';
  if(item.layoutType==='numbered_short_texts')return 'numbered_short_texts';
  return item.interactionType==='long_text'&&item.layoutType==='plain_prompt'?'reflection':null;
}
export function newEditorItem(type,position=1) {
  if(!EDITOR_TYPES.some(([code])=>code===type))throw new Error('Dạng bài chưa được hỗ trợ.');
  const item={itemFamilyId:uuid(),itemVersionId:uuid(),position,prompt:'Câu hỏi mới',helpText:'',required:true,
    interactionType:'long_text',pedagogicalTypeCode:'reflection',layoutType:'plain_prompt',graderType:'none',
    maxScore:0,options:[],interactionConfig:{},skillCodes:[],evidenceSource:'student_self_report',releasePolicy:'inherit'};
  if(['mcq','dropdown','speaking_checklist','multi','matching'].includes(type))item.options=[{id:'A',label:'Phương án A'},{id:'B',label:'Phương án B'}];
  if(type==='multi')Object.assign(item,{interactionType:'multi_choice_group',layoutType:'multiple_choice_cards',graderType:'exact_option_set',maxScore:1,interactionConfig:{maxSelections:2}});
  if(type==='matching')Object.assign(item,{interactionType:'multi_choice_group',layoutType:'matching_pairs',graderType:'exact_sequence',maxScore:1,interactionConfig:{matchingPrompts:['Vế trái 1','Vế trái 2']}});
  if(type==='short_answer')Object.assign(item,{interactionType:'short_text',graderType:'accepted_text',maxScore:1});
  if(['mcq','dropdown'].includes(type))Object.assign(item,{interactionType:'single_choice',
    pedagogicalTypeCode:type==='mcq'?'multiple_choice':'matching_headings',layoutType:type==='mcq'?'choice_cards':'matching_heading_dropdown',graderType:'exact_option',maxScore:1});
  if(['gapfill','numbered_short_texts'].includes(type))Object.assign(item,{interactionType:'short_text',pedagogicalTypeCode:'sentence_completion',
    layoutType:'numbered_short_texts',interactionConfig:type==='gapfill'?{responseCount:2,sentenceLines:[{title:'',parts:['',' và ','.']}]}:{responseCount:2}});
  if(type==='speaking_checklist')Object.assign(item,{interactionType:'multi_choice_group',layoutType:'speaking_issue_checklist',pedagogicalTypeCode:'speaking_reflection',interactionConfig:{maxSelections:2}});
  if(type==='keyword_selection')Object.assign(item,{interactionType:'multi_choice_group',layoutType:'keyword_selection',
    pedagogicalTypeCode:'keyword_identification',options:[{id:'word-1',label:'Văn'},{id:'word-2',label:'bản'}],interactionConfig:{maxSelections:2},
    helpText:'Bấm vào từ cần gạch chân; bấm lại để bỏ chọn. Không tự chấm đúng/sai.'});
  if(type==='conditional_explanation')Object.assign(item,{interactionType:'short_text',layoutType:'conditional_other_text',required:false,
    interactionConfig:{requiredWhenVisible:true}});
  if(type==='self_reported_score')Object.assign(item,{interactionType:'number_score',layoutType:'score_fraction',pedagogicalTypeCode:'score_self_report',interactionConfig:{min:0,max:40,step:1}});
  return item;
}
export function newEditorPayload(title='Phiếu học tập mới') {
  const version=uuid();return {definition:{schemaVersion:'FormDefinitionV1',formVersionId:version,title,kind:'mixed',answerReleasePolicy:'hidden',
    blocks:[{blockId:uuid(),checkpoint:1,title:'Đầu buổi',instructions:'',items:[newEditorItem('reflection')]}]},
    gradingKey:{schemaVersion:'FormGradingKeyV1',formVersionId:version,graderVersion:1,items:{},groups:{}}};
}

export function createFormDraftEditor({host,apiRequest,onPublished=()=>{},onManagementChanged=()=>{},libraryEnabled=false}) {
  let classes=[],assignments=[],draft=null,dirty=false,busy=false,backgroundBusy=false,generation=0,reviewMode=false,
    publishOperationId=null,conflict=null,importPreview=null,importText='',docsUrl='',importOpen=false,aiPopupOpen=false,importTargetBlockId=null,list=[];
  const lockedControls=new Map(),librarySaves=new Map(),publishedByDraft=new Map();let library,authoring=!libraryEnabled,autosaveTimer,saveFailed=false,docsBatch;
  let gapWidgets=[],thuyActionButtons,backgroundCompletion,queuedForeground=false,aiView=null,aiApplied=null;const previews=new Set();
  const skillErrors=new Set();
  let publishAttempted=false;
  function checkPublishFields(){
    publishAttempted=true;
    const issues=collectPublishIssues(payload());if(!issues.length)return;
    showAuthoringIssues(editor,issues,{focus:true,getIssues:()=>collectPublishIssues(payload())});const error=Error('Cần bổ sung thông tin ở các trường được đánh dấu.');error.editorValidation=true;throw error;
  }
  function checkSkills({focus=true}={}) {
    const positions=missingSkills(draft.definition);if(!positions.length)return;
    for(const item of draft.definition.blocks.flatMap(b=>b.items))if(positions.includes(item.position)){
      skillErrors.add(item.itemVersionId);
      const card=editor.querySelector('[data-question="'+item.itemVersionId+'"]'),select=card?.querySelector('select[aria-label="Kỹ năng câu '+item.position+'"]'),error=card?.querySelector('.thuy-skill-error');
      select?.setAttribute('aria-invalid','true');if(error)error.hidden=false;
    }
    if(focus)requestAnimationFrame(()=>{const select=editor.querySelector('select[aria-invalid=true]');select?.focus({preventScroll:true});select?.scrollIntoView({block:'center'});});
    const error=Error('Chọn kỹ năng ở câu được đánh dấu.');error.editorValidation=true;throw error;
  }
  function removeItemKeys(id){for(const name of ['items','explanations','referenceAnswers','referenceAnswersBySlot','authoringState','savedExerciseKeys','importReviews','importSources'])delete draft.gradingKey[name]?.[id];}
  function checkAnswerRows(){const first=draft&&incompleteAnswerRows(draft.gradingKey)[0];if(!first)return;
    requestAnimationFrame(()=>{const input=editor.querySelector('[data-answer-row="'+first.rowId+'"]');input?.focus();input?.setAttribute('aria-invalid','true');const error=input?.parentElement.querySelector('.thuy-answer-error');if(error)error.hidden=false;});
    throw Error('Câu '+draft.definition.blocks.flatMap(b=>b.items).find(i=>i.itemVersionId===first.itemId)?.position+': hãy nhập đáp án hoặc bỏ ô đáp án còn trống.');
  }
  const status=el('p','Chọn lớp để soạn phiếu.',{role:'status'}),saveState=el('small','',{className:'thuy-editor-save-state'}),classSelect=el('select'),session=el('input',undefined,{type:'number',min:'1',max:'100',value:'1'}),
    sourceSelect=el('select'),draftList=el('div'),editor=el('div'),actions=el('div',undefined,{className:'editor-actions'});
  const assignmentDialog=createAssignmentDialog({request,getClasses:()=>classes,getPreferredClass:()=>classSelect.value,onAssigned:value=>{onPublished(value);library?.setUsed(assignments);}});
  const notice=message=>{status.textContent=message;status.hidden=libraryEnabled&&/^(Đã lưu nháp|Có thay đổi chưa lưu|Chọn lớp để soạn)/u.test(message);if(saveFailed&&libraryEnabled){status.append(' ',button('Thử lưu lại',()=>{clearTimeout(autosaveTimer);void run(save);}));}if(libraryEnabled)paintSaveState();};
  function paintSaveState(){saveState.textContent=!draft?'':busy?(backgroundBusy?'Đang lưu…':'Đang xử lý…'):saveFailed?'Lưu lỗi':draft.status==='published'?'Đã xuất bản':dirty?'Chưa lưu':'Đã lưu';}
  function field(parent,label,value,onChange,{kind='text',options=null,min,max,disabled=false}={}) {
    const wrap=el('label',undefined,{className:'field'});wrap.append(el('span',label));
    const input=options?el('select'):el(kind==='textarea'?'textarea':'input');
    if(options)for(const [id,name]of options)input.append(el('option',name,{value:id}));
    else if(kind!=='textarea')input.type=kind;
    if(kind==='checkbox')input.checked=Boolean(value);else input.value=value??'';
    if(min!==undefined)input.min=String(min);if(max!==undefined)input.max=String(max);
    input.disabled=disabled;input.setAttribute('aria-label',label);
    const validationField=label==='Tên bài tập'?'title':label==='Trình độ'?'courseCode':label==='Nội dung câu hỏi'?'prompt':label==='Tổng số câu của bài trên lớp'?'config.max':/^Kỹ năng câu/u.test(label)?'skillCodes':/^Tên phần/u.test(label)?'blockTitle':null;
    if(validationField)input.dataset.validationField=validationField;
    input.addEventListener(options||kind==='checkbox'?'change':'input',()=>{onChange(kind==='checkbox'?input.checked:kind==='number'?Number(input.value):input.value);markDirty();});
    wrap.append(input);parent.append(wrap);return input;
  }
  function markDirty() {dirty=true;importPreview=null;notice(libraryEnabled?'Có thay đổi chưa lưu.':'Có thay đổi chưa lưu. Đáp án đang giữ trong phiên này.');
    const ids=new Set(draft?.definition.blocks.flatMap(b=>b.items).map(i=>i.itemVersionId)||[]);
    for(const name of ['importReviews','importSources'])if(draft?.gradingKey[name])for(const id of Object.keys(draft.gradingKey[name]))if(!ids.has(id))delete draft.gradingKey[name][id];
    if(libraryEnabled){clearTimeout(autosaveTimer);const current=generation;autosaveTimer=setTimeout(()=>{
      if(current!==generation||busy||!dirty||!draft||reviewMode||draft.status==='published')return;
      void run(()=>save({background:true}),{background:true});
    },1800);}
  }
  function canDiscard() {return !dirty||window.confirm('Bỏ thay đổi chưa lưu để mở bản khác?');}
  function lockControls() {
    if(busy&&backgroundBusy)return;
    for(const widget of gapWidgets)widget.setBusy?.(busy);
    // Giữ trạng thái khóa sẵn có của bản chỉ đọc; khi đang ghi, không cho gõ thêm bị response xóa mất.
    if(busy)for(const node of host.querySelectorAll('input,textarea,select,button')) {
      if(!lockedControls.has(node))lockedControls.set(node,node.disabled);node.disabled=true;
    }
    else {
      for(const [node,disabled]of lockedControls)if(node.isConnected)node.disabled=disabled;
      lockedControls.clear();session.disabled=Boolean(draft&&(reviewMode||draft.status==='published'));
    }
  }
  async function run(action,{background=false}={}) {
    if(busy){
      if(!libraryEnabled||!backgroundBusy||background||queuedForeground)return false;
      const waitingGeneration=generation,queued={generation};queuedForeground=queued;paintActions();await backgroundCompletion;if(queuedForeground===queued)queuedForeground=false;
      if(waitingGeneration!==generation||!draft)return false;
      return run(action);
    }
    let releaseBackground;if(background)backgroundCompletion=new Promise(done=>{releaseBackground=done;});
    busy=true;backgroundBusy=background;paintActions();lockControls();const current=generation,requestedDefinition=draft&&JSON.stringify(draft.definition);
    try {await action(current);} catch(error) {if(current===generation){saveFailed=!error.editorValidation&&(background||action===save||error.editorSaveFailure)&&!conflict;notice(error.name==='AbortError'?'Thao tác quá lâu. Nội dung vẫn còn; hãy thử lại.':error.message);
      const issues=draft&&(!background||requestedDefinition===JSON.stringify(draft.definition))?schemaFieldIssues(error.issues,draft.definition):[];
      if(issues.length)showAuthoringIssues(editor,issues,{focus:!background,getIssues:()=>collectPublishIssues(payload())});
      else if(!background&&!error.editorValidation)requestAnimationFrame(()=>(editor.querySelector('.editor-conflict')||status).scrollIntoView({block:'center'}));}}
    finally {if(current===generation){busy=false;backgroundBusy=false;lockControls();paintActions();if(background&&dirty&&!conflict&&!saveFailed){clearTimeout(autosaveTimer);autosaveTimer=setTimeout(()=>void run(()=>save({background:true}),{background:true}),1800);}}releaseBackground?.();}
  }
  async function request(path,options={}) {
    const {timeoutMs=25000,...rest}=options,controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),timeoutMs);
    try{return await apiRequest(path,{...rest,signal:controller.signal});}finally{clearTimeout(timeout);}
  }
  function resequence() {draft.definition.blocks.flatMap(block=>block.items).forEach((item,index)=>{item.position=index+1;});}
  function move(values,index,delta) {
    const target=index+delta;if(target<0||target>=values.length)return;
    [values[index],values[target]]=[values[target],values[index]];resequence();
    const positions=new Map(draft.definition.blocks.flatMap(block=>block.items).map(item=>[item.itemVersionId,item.position]));
    if(draft.definition.blocks.flatMap(block=>block.items).some(item=>
      item.interactionConfig.visibleWhenItemVersionId&&positions.get(item.interactionConfig.visibleWhenItemVersionId)>=item.position)) {
      [values[index],values[target]]=[values[target],values[index]];resequence();
      notice('Ô giải thích phải đứng sau câu điều khiển. Hãy đổi quan hệ trước khi đổi thứ tự.');return;
    }
    markDirty();paint();
  }
  function adopt(value,{review=false}={}) {publishAttempted=false;saveFailed=false;skillErrors.clear();draft=clone(value);if(publishedByDraft.has(value.id)){draft.publication=publishedByDraft.get(value.id);draft.status='published';}dirty=false;reviewMode=review;publishOperationId=null;conflict=null;importPreview=null;session.value=String(value.sessionNumber);if(value.classId)classSelect.value=String(value.classId);authoring=true;paint();}
  function payload() {return {definition:clone(draft.definition),gradingKey:clone(draft.gradingKey),sessionNumber:Number(session.value)};}
  async function refreshList() {
    const classId=classSelect.value,current=generation;if(!classId)return;
    const [own,queue,publications]=await Promise.all([request('/teacher/form-drafts?classId='+classId),request('/teacher/form-drafts/review-queue?classId='+classId),...(libraryEnabled?[request('/teacher/form-publications')]:[Promise.resolve({publications:[]})])]);
    if(current!==generation||classId!==classSelect.value)return;
    publishedByDraft.clear();for(const row of publications.publications||[])if(row.draftId)publishedByDraft.set(row.draftId,row);library?.setPublications?.(publications.publications||[]);
    list=own.drafts||[];library?.setDrafts([...list,...(queue.drafts||[]).filter(d=>!list.some(v=>v.id===d.id)).map(d=>({...d,reviewMode:true}))]);draftList.replaceChildren();
    draftList.append(el('h3','Nháp của tôi'));
    for(const row of list)draftList.append(button(`${row.definition?.title||row.title||'Phiếu'} · buổi ${row.sessionNumber} · ${statusLabel(row.status)}`,()=>void run(async current=>{
      if(!canDiscard())return;const result=await request('/teacher/form-drafts/'+row.id);if(current===generation)adopt(result.draft);
    })));
    if(!list.length)draftList.append(el('p','Chưa có nháp của bạn ở lớp này.'));
    if(queue.drafts?.length){draftList.append(el('h3','Nháp đang chờ bạn duyệt'));for(const row of queue.drafts)draftList.append(button(`${row.definition?.title||'Phiếu'} · buổi ${row.sessionNumber}`,()=>void run(async current=>{
      if(!canDiscard())return;const result=await request('/teacher/form-drafts/'+row.id+'/review');if(current===generation)adopt(result.draft,{review:true});
    })));}
  }
  function statusLabel(value) {return {draft:'Đang soạn',pending_review:'Chờ duyệt',approved:'Đã duyệt',published:'Đã phát hành'}[value]||value;}
  async function save(options={}) {
    if(!draft||reviewMode||draft.status==='published')return;
    if(libraryEnabled)checkSkills({focus:!options?.background});
    const local=payload(),current=generation;
    try {
      let result;
      if(draft.id)result=await request('/teacher/form-drafts/'+draft.id,{method:'PUT',body:{...local,expectedRevision:draft.revision}});
      else{
        // Khi mất phản hồi tạo nháp, gửi lại đúng gói cũ; phần gõ thêm được lưu sau bằng revision vừa nhận.
        pendingCreate??={...clone(local),classId:draft.classId,operationId:uuid()};const operation=pendingCreate;
        result=await request('/teacher/form-drafts',{method:'POST',body:operation});if(current!==generation)return;
        if(JSON.stringify([operation.definition,operation.gradingKey,operation.sessionNumber])!==JSON.stringify([local.definition,local.gradingKey,local.sessionNumber]))
          result=await request('/teacher/form-drafts/'+result.draft.id,{method:'PUT',body:{...local,expectedRevision:result.draft.revision}});
      }
      if(current!==generation)return;
      pendingCreate=null;
      if(options?.background){
        // Request cũ không thay cây câu hỏi/handler và không xóa nội dung gõ thêm khi đang lưu.
        const unchanged=JSON.stringify(local)===JSON.stringify(payload());
        for(const key of ['id','revision','status','contentHash','approvedRevision','classId','sessionNumber'])if(key in result.draft)draft[key]=result.draft[key];
        dirty=!unchanged;saveFailed=false;notice(unchanged?`Đã lưu nháp · bản ${result.draft.revision}.`:'Đã lưu bản trước; đang giữ nội dung vừa gõ để lưu tiếp.');
      }else{adopt(result.draft);notice(`Đã lưu nháp · bản ${result.draft.revision}.`);}
    } catch(error) {
      if(error.status===409&&current===generation){
        const result=await request('/teacher/form-drafts/'+draft.id);if(current!==generation)return;
        conflict=result.draft;paint();notice('Máy chủ đã có bản mới. Nội dung đang soạn vẫn được giữ bên dưới để đối chiếu.');
      } else {error.editorSaveFailure=true;throw error;}
      throw new Error('Chưa lưu được. Hãy đối chiếu và chọn bản cần dùng.');
    }
  }
  function paintActions() {
    if(libraryEnabled){if(draft)paintThuyActions();else actions.replaceChildren();return;}
    actions.replaceChildren();if(!draft)return;
    const readonly=reviewMode||draft.status==='published';
    actions.append(button('Lưu nháp',()=>void run(save),busy||readonly));
    if(libraryEnabled&&!reviewMode)for(const [scope,label]of [['personal','Lưu vào Của tôi'],['izone','Đưa vào Kho IZONE']])actions.append(button(label,()=>void run(async()=>{
      if(dirty)await save();const key=draft.id+':'+draft.revision+':'+scope;if(!librarySaves.has(key))librarySaves.set(key,uuid());
      await request('/teacher/form-library',{method:'POST',body:{draftId:draft.id,expectedRevision:draft.revision,expectedHash:draft.contentHash,scope,operationId:librarySaves.get(key)}});
      notice('Đã lưu bản chụp vào '+(scope==='izone'?'Kho IZONE':'Của tôi')+'. Phiếu lớp không thay đổi.');
    }),busy||(scope==='izone'&&!['approved','published'].includes(draft.status))));
    if(!reviewMode)actions.append(button('Xem thử như học viên',()=>{
      const tab=window.open('about:blank','_blank');void run(async current=>{
        try {
          if(dirty)await save();
          const result=await request('/teacher/form-drafts/'+draft.id+'/preview-grant',{method:'POST',body:{expectedRevision:draft.revision}});
          if(current!==generation){tab?.close();return;}
          const url=new URL(window.location.pathname.endsWith('/teacher-thuy.html')?'./demo/thuy.html':'./demo/',window.location.href);url.hash=new URLSearchParams({grant:result.grant}).toString();
          if(tab){tab.opener=null;tab.location.replace(url.toString());}else window.location.assign(url.toString());
        }catch(error){tab?.close();throw error;}
      });
    },busy||(libraryEnabled&&!draft.definition.blocks.some(b=>b.items.length))));
    if(!readonly)actions.append(button('Gửi duyệt',()=>void run(async current=>{
      if(dirty)await save();const result=await request('/teacher/form-drafts/'+draft.id+'/request-review',{method:'POST',body:{expectedRevision:draft.revision}});
      if(current===generation){adopt(result.draft);notice('Đã gửi duyệt. Người có quyền của đúng khóa có thể mở trong danh sách chờ duyệt.');}
    }),busy));
    if(draft.status!=='published')actions.append(button('Duyệt bản này',()=>void run(async current=>{
      if(dirty)await save();
      if(!window.confirm(`Duyệt nội dung, đáp án và cách mở đáp án của “${draft.definition.title}” · buổi ${draft.sessionNumber}?`))return;
      const result=await request('/teacher/form-drafts/'+draft.id+'/approve',{method:'POST',body:{expectedRevision:draft.revision,expectedHash:draft.contentHash}});
      if(current===generation){adopt(result.draft,{review:reviewMode});notice('Đã duyệt đúng bản này. Sửa nội dung sẽ cần duyệt lại.');}
    }),busy));
    if(!reviewMode&&draft.status==='approved')actions.append(button('Phát hành phiếu cho lớp',()=>void run(async current=>{
      if(dirty)await save();if(draft.status!=='approved')throw new Error('Bản vừa sửa cần duyệt lại.');
      if(!publishOperationId&&!window.confirm(`Phát hành “${draft.definition.title}” cho ${classSelect.selectedOptions[0]?.textContent} · buổi ${draft.sessionNumber}?`))return;
      publishOperationId??=uuid();notice('Đang phát hành và kiểm lại phiếu…');
      const result=await request('/teacher/form-drafts/'+draft.id+'/publish',{method:'POST',body:{expectedRevision:draft.revision,operationId:publishOperationId}});
      if(current!==generation)return;
      draft.status='published';draft.publicToken=result.published.publicToken;dirty=false;paint();
      notice(`Đã phát hành và đối chiếu ${result.published.rosterCount} học viên. Phiếu đã khóa nội dung.`);
      onPublished({...result.published,classId:draft.classId,sessionNumber:draft.sessionNumber,title:draft.definition.title});
    }),busy));
    if(draft.status==='published'&&draft.publicToken) {
      const url=new URL(window.location.pathname.endsWith('/teacher-thuy.html')?'./thuy.html':'./',window.location.href);url.hash=new URLSearchParams({assignment:draft.publicToken}).toString();
      actions.append(el('a','Mở phiếu vừa phát hành',{href:url.toString(),target:'_blank',rel:'noopener'}));
    }
    if(libraryEnabled){
      const extra=el('details',undefined,{className:'thuy-editor-publish-tools'});extra.append(el('summary','Duyệt và lưu vào kho'));
      for(const control of [...actions.children])if(['Lưu vào Của tôi','Đưa vào Kho IZONE','Gửi duyệt','Duyệt bản này'].includes(control.textContent))extra.append(control);
      actions.append(extra);
      if(draft.status!=='published'&&draft.status!=='approved'){const publish=button('Xuất bản',()=>{extra.open=true;notice('Kiểm nội dung và chọn Duyệt bản này trước khi phát hành cho lớp.');},busy);publish.classList.add('primary');actions.append(publish);}
    }
  }
  function paintThuyActions(){
    const readonly=reviewMode||draft.status==='published';
    if(!thuyActionButtons){const preview=button('Xem trước',()=>{
      if(busy&&!backgroundBusy||queuedForeground||!draft)return;
      void run(async current=>{
        checkSkills();
        if(dirty||!draft.id)await save();
        if(current!==generation)return;
        const id=draft.id,revision=draft.revision;
        previews.add(openWorksheetPreview({title:draft.definition.title,current:()=>current===generation&&draft?.id===id&&draft.revision===revision,
          prepare:async()=>{const reply=await request('/teacher/form-drafts/'+id+'/preview-grant',{method:'POST',body:{expectedRevision:revision}});return reply.grant;}}));
      });
    });
    const saveButton=button('Lưu nháp',()=>void run(save),busy||readonly);
    const publish=button('Xuất bản',()=>void run(async current=>{
      checkPublishFields();
      checkAnswerRows();
      checkSkills();
      if(dirty||!draft.id)await save();
      if(draft.status!=='approved'){
        const approved=await request('/teacher/form-drafts/'+draft.id+'/approve',{method:'POST',body:{expectedRevision:draft.revision,expectedHash:draft.contentHash,libraryOnly:true}});
        if(current!==generation)return;draft=clone(approved.draft);
      }
      publishOperationId??=uuid();
      const reply=await request('/teacher/form-drafts/'+draft.id+'/publish-library',{method:'POST',body:{expectedRevision:draft.revision,operationId:publishOperationId}});
      if(current!==generation)return;publishedByDraft.set(draft.id,reply.publication);draft.publication=reply.publication;draft.status='published';dirty=false;
      const publishedId=draft.id;authoring=false;paint();library.showPersonal(publishedId);
      notice('Đã xuất bản vào kho.');
      const reload=async()=>{await refreshList();const loaded=await library.refresh();if(loaded===false)throw Error('Danh sách kho chưa tải được.');if(current===generation&&!authoring)library.showPersonal(publishedId,{published:true});};
      try{await reload();}
      catch(error){if(current===generation&&!authoring)library.showPersonal(publishedId,{published:true,error:error.message,retry:reload});}
    }));publish.classList.add('primary');thuyActionButtons={preview,saveButton,publish};}
    const {preview,saveButton,publish}=thuyActionButtons;
    if(preview.parentElement!==actions)actions.replaceChildren(preview,saveButton,publish);
    const blocked=busy&&!backgroundBusy||queuedForeground;
    preview.disabled=blocked||reviewMode||!draft.definition.blocks.some(b=>b.items.length);
    saveButton.disabled=publish.disabled=blocked||readonly;
    actions.setAttribute('aria-busy',String(busy));
    paintSaveState();
    for(const control of [preview,saveButton,publish])control.title=readonly&&control!==preview?'Bản chỉ đọc; tạo bản riêng để chỉnh sửa.':busy?'Đang xử lý, vui lòng chờ.':'';
  }
  function paintItem(parent,item,block,readonly) {
    if(libraryEnabled){paintThuyItem(parent,item,block,readonly);return;}
    paintLegacyItem(parent,item,block,readonly);
  }
  function paintLegacyItem(parent,item,block,readonly) {
    const card=el('fieldset',undefined,{className:'editor-item',disabled:readonly});card.append(el('legend',`Câu ${item.position} · ${EDITOR_TYPES.find(([id])=>id===editorType(item))?.[1]||'Dạng không hỗ trợ'}`));
    const importReview=draft.gradingKey.importReviews?.[item.itemVersionId];if(importReview)card.append(importReviewCard(importReview,{item,gradingKey:draft.gradingKey,readonly,onChange:()=>{markDirty();paint();}}));
    field(card,'Dạng bài',editorType(item),type=>{
      const next=newEditorItem(type,item.position);next.itemVersionId=item.itemVersionId;next.itemFamilyId=item.itemFamilyId;next.prompt=item.prompt;next.helpText=item.helpText;
      for(const key of Object.keys(item))delete item[key];Object.assign(item,next);
      delete draft.gradingKey.items[item.itemVersionId];delete draft.gradingKey.referenceAnswers?.[item.itemVersionId];delete draft.gradingKey.explanations?.[item.itemVersionId];paint();
    },{options:EDITOR_TYPES});
    field(card,'Câu hỏi',item.prompt,value=>{item.prompt=value;},{kind:'textarea'});
    field(card,'Hướng dẫn',item.helpText,value=>{item.helpText=value;},{kind:'textarea'});
    field(card,'Số hiển thị',item.displayNumber||'',value=>{if(value)item.displayNumber=value;else delete item.displayNumber;});
    field(card,'Kỹ năng (cách nhau bằng dấu phẩy)',item.skillCodes.join(', '),value=>{item.skillCodes=value.split(',').map(v=>v.trim()).filter(Boolean);});
    if(editorType(item)!=='conditional_explanation')field(card,'Bắt buộc trả lời',item.required,value=>{item.required=value;},{kind:'checkbox'});
    field(card,'Khi nào mở đáp án',item.releasePolicy||'inherit',value=>{item.releasePolicy=value;},{options:[['inherit','Theo cả phiếu'],['hidden','Ẩn'],['immediate','Sau khi nộp'],['teacher_release','Giảng viên mở']]});
    if(editorType(item)==='keyword_selection'){
      field(card,'Văn bản để gạch chân (2–40 từ)',item.options.map(o=>o.label).join(' '),value=>{
        const words=value.trim().split(/\s+/u).filter(Boolean);item.options=words.map((label,index)=>({id:'word-'+(index+1),label}));
        item.interactionConfig.maxSelections=Math.max(1,Math.min(item.interactionConfig.maxSelections||2,10,words.length));
      },{kind:'textarea'});
      field(card,'Số từ được gạch chân tối đa',item.interactionConfig.maxSelections,value=>{item.interactionConfig.maxSelections=value;},{kind:'number',min:1,max:Math.min(10,item.options.length)});
      card.append(el('p','Học viên chọn từ ngay trên văn bản. Mỗi từ có vị trí riêng kể cả khi trùng chữ; không có đáp án đúng/sai mặc định.'));
    }else if(item.options.length){
      const options=el('div');card.append(options);options.append(el('h4','Phương án'));
      for(const option of item.options){const row=el('div',undefined,{className:'field-grid'});
        field(row,'Mã phương án',option.id,value=>{option.id=value;});field(row,'Nội dung phương án',option.label,value=>{option.label=value;});
        row.append(addButton('Thêm ô giải thích cho phương án này',()=>{
          if(draft.definition.blocks.flatMap(value=>value.items).some(value=>value.interactionConfig.visibleWhenItemVersionId===item.itemVersionId
            &&value.interactionConfig.visibleWhenValue===option.id)){notice('Phương án này đã có ô giải thích.');return;}
          const child=newEditorItem('conditional_explanation');child.prompt='Giải thích thêm khi chọn '+option.label;
          child.interactionConfig.visibleWhenItemVersionId=item.itemVersionId;child.interactionConfig.visibleWhenValue=option.id;
          if(item.interactionType==='multi_choice_group'){child.interactionType='long_text';child.layoutType='inline_option_text';}
          block.items.splice(block.items.indexOf(item)+1,0,child);resequence();markDirty();paint();
        },readonly||draft.definition.blocks.flatMap(value=>value.items).length>=100));
        row.append(removeButton('Bỏ phương án',()=>{item.options=item.options.filter(o=>o!==option);markDirty();paint();},readonly||item.options.length<=2));options.append(row);}
      options.append(addButton('Thêm phương án',()=>{item.options.push({id:'option-'+(item.options.length+1),label:'Phương án mới'});markDirty();paint();},readonly||item.options.length>=40));
    }
    const config=item.interactionConfig,type=editorType(item);
    if(type==='reflection')field(card,'Gợi ý trả lời (học viên bấm để xem khi làm)',config.hintText||'',value=>{if(value.trim())config.hintText=value;else delete config.hintText;},{kind:'textarea'});
    if(type==='multi'){
      field(card,'Số lựa chọn tối đa',config.maxSelections,value=>{config.maxSelections=value;},{kind:'number',min:1,max:Math.min(10,item.options.length)});
      card.append(el('p','Đánh dấu các đáp án đúng. Học viên sẽ dùng ô vuông để chọn nhiều.'));
      for(const option of item.options)field(card,'Đáp án đúng · '+option.id+' · '+option.label,draft.gradingKey.items[item.itemVersionId]?.expectedOptionIds.includes(option.id),checked=>{
        const ids=new Set(draft.gradingKey.items[item.itemVersionId]?.expectedOptionIds||[]);if(checked)ids.add(option.id);else ids.delete(option.id);
        if(ids.size)draft.gradingKey.items[item.itemVersionId]={graderType:'exact_option_set',expectedOptionIds:[...ids]};else delete draft.gradingKey.items[item.itemVersionId];
      },{kind:'checkbox'});
    }
    if(type==='matching'){
      field(card,'Các vế trái — mỗi dòng một vế',config.matchingPrompts.join('\n'),value=>{config.matchingPrompts=value.split('\n');delete draft.gradingKey.items[item.itemVersionId];},{kind:'textarea'});
      field(card,'Đáp án theo thứ tự vế trái — mỗi dòng một mã phương án',(draft.gradingKey.items[item.itemVersionId]?.expectedOptionIds||[]).join('\n'),value=>{
        if(value.trim())draft.gradingKey.items[item.itemVersionId]={graderType:'exact_sequence',expectedOptionIds:value.split('\n').map(v=>v.trim())};else delete draft.gradingKey.items[item.itemVersionId];
      },{kind:'textarea'});card.append(el('p','Mỗi vế trái ghép với một phương án phải; số vế trái và phải phải bằng nhau (2–10 cặp).'));
    }
    if(type==='short_answer')field(card,'Đáp án chấp nhận — mỗi dòng một cách viết',(draft.gradingKey.items[item.itemVersionId]?.accepted||[]).join('\n'),value=>{
      if(value.trim())draft.gradingKey.items[item.itemVersionId]={graderType:'accepted_text',accepted:value.split('\n').map(v=>v.trim()),normalization:{caseInsensitive:true,collapseWhitespace:true}};
      else delete draft.gradingKey.items[item.itemVersionId];
    },{kind:'textarea'});
    if(['mcq','dropdown'].includes(type)){
      field(card,'Chấm đáp án khách quan',item.graderType==='exact_option',value=>{item.graderType=value?'exact_option':'none';item.maxScore=value?1:0;if(!value)delete draft.gradingKey.items[item.itemVersionId];paint();},{kind:'checkbox'});
      if(item.graderType==='exact_option'){
        field(card,'Đáp án đúng',draft.gradingKey.items[item.itemVersionId]?.expectedOptionId||'',value=>{
          if(value)draft.gradingKey.items[item.itemVersionId]={graderType:'exact_option',expectedOptionId:value};else delete draft.gradingKey.items[item.itemVersionId];
        },{options:[['','Chưa chọn đáp án'],...item.options.map(option=>[option.id,option.id+' · '+option.label])]});
        field(card,'Điểm tối đa',item.maxScore,value=>{item.maxScore=value;},{kind:'number',min:1,max:100});
      }
    }
    if(type==='gapfill'){
      const chain=item.layoutType==='reasoning_chain_completion';
      field(card,'Bố cục điền từ',chain?'chain':'sentences',value=>{
        item.layoutType=value==='chain'?'reasoning_chain_completion':'numbered_short_texts';
        item.interactionConfig=value==='chain'?{beforeText:'Phần trước ô trống',afterText:'Phần sau ô trống'}:{responseCount:2,sentenceLines:[{title:'',parts:['',' và ','.']}]};paint();
      },{options:[['sentences','Các ô nằm trong câu'],['chain','Một ô trong chuỗi lập luận']]});
      if(chain){field(card,'Trước ô trống',config.beforeText,value=>{config.beforeText=value;},{kind:'textarea'});field(card,'Sau ô trống',config.afterText,value=>{config.afterText=value;},{kind:'textarea'});}
      else{
        card.append(el('p','Dùng [___] ở mỗi vị trí cần điền. Giữ nguyên chữ và dấu câu giữa các ô.'));
        for(const line of config.sentenceLines||[]){field(card,'Tiêu đề dòng',line.title||'',value=>{line.title=value;});field(card,'Câu có ô trống',line.parts.join('[___]'),value=>{
          line.parts=value.split('[___]');config.responseCount=config.sentenceLines.reduce((n,l)=>n+l.parts.length-1,0);
        },{kind:'textarea'});card.append(removeButton('Bỏ dòng',()=>{config.sentenceLines=config.sentenceLines.filter(l=>l!==line);config.responseCount=config.sentenceLines.reduce((n,l)=>n+l.parts.length-1,0);markDirty();paint();},readonly||config.sentenceLines.length<=1));}
        card.append(addButton('Thêm dòng điền từ',()=>{config.sentenceLines.push({title:'',parts:['','']});config.responseCount+=1;markDirty();paint();},readonly));
      }
    }
    if(type==='numbered_short_texts'){
      field(card,'Số ô trả lời',config.responseCount,value=>{config.responseCount=value;},{kind:'number',min:2,max:10});
      field(card,'Nhãn các ô (mỗi dòng một nhãn)',(config.responseLabels||[]).join('\n'),value=>{if(value)config.responseLabels=value.split('\n');else delete config.responseLabels;},{kind:'textarea'});
    }
    if(type==='speaking_checklist'){
      field(card,'Số lựa chọn tối đa',config.maxSelections,value=>{config.maxSelections=value;},{kind:'number',min:1,max:40});
      field(card,'Phương án không đi cùng phương án khác',config.exclusiveOptionId||'',value=>{if(value)config.exclusiveOptionId=value;else delete config.exclusiveOptionId;},{options:[['','Không có'],...item.options.map(o=>[o.id,o.label])]});
    }
    if(type==='conditional_explanation'){
      const parents=draft.definition.blocks.flatMap(b=>b.items).filter(i=>i.position<item.position&&['single_choice','multi_choice_group'].includes(i.interactionType));
      field(card,'Hiện khi trả lời câu',config.visibleWhenItemVersionId||'',value=>{config.visibleWhenItemVersionId=value;
        const selected=parents.find(i=>i.itemVersionId===value);item.interactionType=selected?.interactionType==='multi_choice_group'?'long_text':'short_text';item.layoutType=item.interactionType==='long_text'?'inline_option_text':'conditional_other_text';paint();
      },{options:[['','Chọn câu đứng trước'],...parents.map(i=>[i.itemVersionId,'Câu '+i.position+' · '+i.prompt.slice(0,60)])]});
      const chosen=parents.find(i=>i.itemVersionId===config.visibleWhenItemVersionId);
      field(card,'Phương án làm hiện ô',config.visibleWhenValue||'',value=>{config.visibleWhenValue=value;},{options:[['','Chọn phương án'],...(chosen?.options||[]).map(o=>[o.id,o.label])]});
    }
    if(type==='self_reported_score')for(const [key,label,min]of [['min','Số nhỏ nhất',0],['max','Tổng số câu',1],['step','Bước tăng',1]])field(card,label,config[key]??(key==='step'?1:0),value=>{config[key]=value;},{kind:'number',min,max:10000});
    if(item.graderType!=='none')field(card,'Giải thích đáp án (chỉ hiện khi mở đáp án)',draft.gradingKey.explanations?.[item.itemVersionId]||'',value=>{
      if(value.trim()){draft.gradingKey.explanations??={};draft.gradingKey.explanations[item.itemVersionId]=value;}
      else delete draft.gradingKey.explanations?.[item.itemVersionId];
    },{kind:'textarea'});
    field(card,'Đáp án tham khảo (không tự chấm; mỗi dòng một đáp án)',(draft.gradingKey.referenceAnswers?.[item.itemVersionId]||[]).join('\n'),value=>{
      if(value){draft.gradingKey.referenceAnswers??={};draft.gradingKey.referenceAnswers[item.itemVersionId]=value.split('\n');}
      else {delete draft.gradingKey.referenceAnswers?.[item.itemVersionId];if(draft.gradingKey.referenceAnswers&&!Object.keys(draft.gradingKey.referenceAnswers).length)delete draft.gradingKey.referenceAnswers;}
    },{kind:'textarea'});
    const itemIndex=block.items.indexOf(item);
    card.append(button('Đưa câu lên',()=>move(block.items,itemIndex,-1),readonly||itemIndex===0),
      button('Đưa câu xuống',()=>move(block.items,itemIndex,1),readonly||itemIndex===block.items.length-1));
    card.append(removeButton('Bỏ câu',()=>{
      if(draft.definition.blocks.flatMap(b=>b.items).some(i=>i.interactionConfig.visibleWhenItemVersionId===item.itemVersionId)){notice('Cần đổi hoặc bỏ ô phụ thuộc trước khi bỏ câu này.');return;}
      block.items=block.items.filter(i=>i!==item);removeItemKeys(item.itemVersionId);resequence();markDirty();paint();
    },readonly||block.items.length<=1));parent.append(card);
  }
  // Bản trình bày Thủy dùng chính draft/revision và các lệnh lưu/duyệt/phát ở trên.
  // Không chuyển qua mô hình demo, vì chuyển đổi có thể làm mất dạng câu hoặc ID nguồn cũ.
  const thuyNames={mcq:'Trắc nghiệm',multi:'Chọn nhiều đáp án',short_answer:'Điền từ',dropdown:'Danh sách xổ xuống',reflection:'Trả lời mở',matching:'Nối cặp',self_reported_score:'Ghi số câu đúng',keyword_selection:'Gạch chân từ khóa'};
  function paintThuyItem(parent,item,block,readonly){
    if(!['mcq','multi','dropdown','reflection','short_answer','keyword_selection','self_reported_score','matching','speaking_checklist','gapfill','numbered_short_texts'].includes(editorType(item))){paintLegacyItem(parent,item,block,readonly);return;}
    const type=editorType(item),kind=editorItemKind(item,block),index=block.items.indexOf(item),card=el('fieldset',undefined,{className:'editor-item thuy-editor-question',disabled:readonly}),head=el('div',undefined,{className:'thuy-editor-question-head'}),title=el('h3',`Câu ${item.position}`);
    card.dataset.question=item.itemVersionId;card.dataset.kind=kind;
    title.append(el('small',thuyNames[type]||EDITOR_TYPES.find(([id])=>id===type)?.[1]||'Câu từ nguồn cũ'));head.append(title);
    const modes=el('div',undefined,{className:'thuy-question-mode'});modes.dataset.validationField='kind';modes.setAttribute('role','group');modes.setAttribute('aria-label','Chế độ câu '+item.position);modes.append(el('span','Chế độ câu hỏi',{className:'thuy-question-mode-label'}));
    const choices=el('div',undefined,{className:'thuy-mode-buttons'});
    for(const [value,label]of [['exercise','Bài tập'],['survey','Khảo sát']]){const choice=button(label,()=>{
      if(kind===value)return;try{changeQuestionKind(item,draft.gradingKey,value,type);markDirty();paint();if(value==='exercise'&&!draft.gradingKey.items[item.itemVersionId])notice('Đã chuyển câu '+item.position+' sang Bài tập. Hãy kiểm và nhập đáp án cho nội dung hiện tại.');}catch(error){notice(error.message);}
    },readonly);choice.setAttribute('aria-pressed',String(kind===value));choices.append(choice);}modes.append(choices);
    const importReview=draft.gradingKey.importReviews?.[item.itemVersionId];if(importReview)card.append(importReviewCard(importReview,{item,gradingKey:draft.gradingKey,readonly,onChange:()=>{markDirty();paint();}}));
    const skill=field(head,'Kỹ năng câu '+item.position,item.skillCodes?.[0]||'',value=>{
      item.skillCodes=value?[value]:[];if(value){skillErrors.delete(item.itemVersionId);skill.removeAttribute('aria-invalid');skillError.hidden=true;}
    },{options:PART_SKILLS});
    const skillError=el('p','Chọn kỹ năng, hoặc chọn Chung nếu câu không thuộc kỹ năng riêng.',{className:'thuy-skill-error',id:'skill-error-'+item.itemVersionId,hidden:!skillErrors.has(item.itemVersionId)});
    skill.setAttribute('aria-describedby',skillError.id);if(!skillError.hidden)skill.setAttribute('aria-invalid','true');
    const moves=el('div',undefined,{className:'thuy-editor-question-moves'});
    moves.append(button('↑',()=>move(block.items,index,-1),readonly||index===0),button('↓',()=>move(block.items,index,1),readonly||index===block.items.length-1),removeButton('Bỏ',()=>{
      if(draft.definition.blocks.flatMap(b=>b.items).some(i=>i.interactionConfig.visibleWhenItemVersionId===item.itemVersionId)){notice('Cần bỏ hoặc đổi ô phụ thuộc trước.');return;}
      block.items.splice(index,1);removeItemKeys(item.itemVersionId);resequence();markDirty();paint();
    },readonly));for(const [i,b]of [...moves.children].entries())b.setAttribute('aria-label',(i===0?'Đưa câu lên ':i===1?'Đưa câu xuống ':'Bỏ câu ')+item.position);head.append(moves);card.append(head,skillError,modes);
    const config=item.interactionConfig;
    const gap=type==='short_answer'||Boolean(config.sentenceLines);
    if(gap&&!readonly&&['short_answer','gapfill'].includes(type))item.kind??=kind;
    if(gap)gapWidgets.push(mountGapAuthoring(card,{item,key:draft.gradingKey,kind,readonly,onChange:markDirty,onError:notice}));
    else field(card,'Nội dung câu hỏi',item.prompt,value=>{item.prompt=value;},{kind:'textarea'});
    if(['mcq','multi','dropdown','speaking_checklist'].includes(type)){
      const objective=['exact_option','exact_option_set'].includes(item.graderType);
      const answerLabel=el('p',objective?'Các lựa chọn · Đánh dấu đáp án đúng':'Các lựa chọn',{className:'thuy-editor-options-label'});answerLabel.dataset.validationField='answer';card.append(answerLabel);
      for(const [j,option]of item.options.entries()){
        const row=el('div',undefined,{className:'thuy-editor-option'}),single=['mcq','dropdown'].includes(type),checked=single?draft.gradingKey.items[item.itemVersionId]?.expectedOptionId===option.id:draft.gradingKey.items[item.itemVersionId]?.expectedOptionIds?.includes(option.id);
        if(objective){const input=el('input',undefined,{type:single?'radio':'checkbox',name:'key-'+item.itemVersionId,checked:Boolean(checked)});input.setAttribute('aria-label','Đáp án đúng '+String.fromCharCode(65+j)+' câu '+item.position);input.addEventListener('change',()=>{
          if(single)draft.gradingKey.items[item.itemVersionId]={graderType:'exact_option',expectedOptionId:option.id};
          else{const selected=new Set(draft.gradingKey.items[item.itemVersionId]?.expectedOptionIds||[]);if(input.checked)selected.add(option.id);else selected.delete(option.id);if(selected.size)draft.gradingKey.items[item.itemVersionId]={graderType:'exact_option_set',expectedOptionIds:[...selected]};else delete draft.gradingKey.items[item.itemVersionId];}
          selectedLimit(item,draft.gradingKey.items[item.itemVersionId],kind);markDirty();
        });row.append(input);}else row.append(el('span',String.fromCharCode(65+j)));
        const text=el('input',undefined,{type:'text',value:option.label,placeholder:'Phương án '+(j+1)});text.className='thuy-option-content';text.dataset.option=option.id;text.setAttribute('aria-label','Lựa chọn '+String.fromCharCode(65+j)+' câu '+item.position);text.addEventListener('input',()=>{option.label=text.value;markDirty();});row.append(text,removeButton('×',()=>{
          if(draft.definition.blocks.flatMap(b=>b.items).some(i=>i.interactionConfig.visibleWhenItemVersionId===item.itemVersionId&&i.interactionConfig.visibleWhenValue===option.id)){notice('Phương án có ô giải thích. Đổi quan hệ trước khi bỏ.');return;}
          item.options.splice(j,1);const key=draft.gradingKey.items[item.itemVersionId];if(key?.expectedOptionId===option.id)delete draft.gradingKey.items[item.itemVersionId];if(key?.expectedOptionIds){key.expectedOptionIds=key.expectedOptionIds.filter(id=>id!==option.id);if(!key.expectedOptionIds.length)delete draft.gradingKey.items[item.itemVersionId];}selectedLimit(item,draft.gradingKey.items[item.itemVersionId],kind);markDirty();paint();
        },readonly||item.options.length<=2,'Xóa phương án '+String.fromCharCode(65+j)+' câu '+item.position));card.append(row);
      }
      card.append(addButton('+ Thêm lựa chọn',()=>{item.options.push({id:uuid(),label:''});markDirty();paint();},readonly||item.options.length>=40));
    }else if(type==='reflection')field(card,'Gợi ý trả lời',config.hintText||'',value=>{if(value.trim())config.hintText=value;else delete config.hintText;},{kind:'textarea'});
    else if(type==='keyword_selection'){
      field(card,'Văn bản để gạch chân (2–40 từ)',item.options.map(o=>o.label).join(' '),value=>{item.options=value.trim().split(/\s+/u).filter(Boolean).map((label,i)=>({id:'word-'+(i+1),label}));},{kind:'textarea'});
      field(card,'Số từ được gạch chân tối đa',config.maxSelections||2,value=>{config.maxSelections=value;},{kind:'number',min:1,max:10});
    }else if(type==='self_reported_score')field(card,'Tổng số câu của bài trên lớp',config.max,value=>{config.max=value;},{kind:'number',min:1,max:10000});
    else if(type==='matching'){
      const expected=draft.gradingKey.items[item.itemVersionId]?.expectedOptionIds||item.options.map(o=>o.id);
      config.matchingPrompts.forEach((prompt,j)=>{const option=item.options.find(o=>o.id===expected[j])||item.options[j],row=el('div',undefined,{className:'thuy-editor-pair'}),left=el('input',undefined,{value:prompt}),right=el('input',undefined,{value:option?.label||''});left.setAttribute('aria-label','Vế trái cặp '+(j+1)+' câu '+item.position);right.setAttribute('aria-label','Vế phải cặp '+(j+1)+' câu '+item.position);
        left.addEventListener('input',()=>{config.matchingPrompts[j]=left.value;markDirty();});right.addEventListener('input',()=>{option.label=right.value;draft.gradingKey.items[item.itemVersionId]={graderType:'exact_sequence',expectedOptionIds:expected};markDirty();});
        row.append(left,el('span','→'),right,removeButton('×',()=>{config.matchingPrompts.splice(j,1);item.options=item.options.filter(o=>o.id!==option.id);draft.gradingKey.items[item.itemVersionId]={graderType:'exact_sequence',expectedOptionIds:expected.filter((_,i)=>i!==j)};markDirty();paint();},readonly||config.matchingPrompts.length<=2,'Bỏ cặp '+(j+1)+' câu '+item.position));card.append(row);
      });card.append(addButton('+ Thêm cặp',()=>{const id=uuid();config.matchingPrompts.push('');item.options.push({id,label:''});draft.gradingKey.items[item.itemVersionId]={graderType:'exact_sequence',expectedOptionIds:[...expected,id]};markDirty();paint();},readonly||config.matchingPrompts.length>=10));
    }else if(type==='numbered_short_texts'&&!gap)gapWidgets.push(mountSlotAnswers(card,{item,key:draft.gradingKey,kind,readonly,onChange:markDirty,onError:notice}));
    if(kind==='survey'&&!gap&&type!=='numbered_short_texts')field(card,'Đáp án tham khảo (tùy chọn)',(draft.gradingKey.referenceAnswers?.[item.itemVersionId]||[]).join('\n'),value=>{
      if(PART_TYPES.survey.some(([code])=>code===type))item.kind??=kind;
      draft.gradingKey.referenceAnswers??={};if(value.trim())draft.gradingKey.referenceAnswers[item.itemVersionId]=value.split('\n').map(s=>s.trim()).filter(Boolean);else delete draft.gradingKey.referenceAnswers[item.itemVersionId];
    },{kind:'textarea'});
    const details=el('details');details.append(el('summary','Giải thích đáp án'));const explanation=field(details,'',draft.gradingKey.explanations?.[item.itemVersionId]||'',value=>{draft.gradingKey.explanations??={};if(value.trim())draft.gradingKey.explanations[item.itemVersionId]=value;else delete draft.gradingKey.explanations[item.itemVersionId];},{kind:'textarea'});explanation.setAttribute('aria-label','Giải thích đáp án câu '+item.position);card.append(details);
    parent.append(card);
  }
  function paintThuyEditor(){
    const readonly=reviewMode||draft.status==='published';editorTitle.textContent=draft.id?'Sửa bài tập':'Tạo bài tập';
    const info=el('section',undefined,{className:'thuy-editor-info'}),meta=el('div',undefined,{className:'thuy-editor-meta'});info.append(meta);
    field(meta,'Tên bài tập',draft.definition.title,value=>{draft.definition.title=value;},{disabled:readonly});
    field(meta,'Trình độ',draft.definition.courseCode||'',value=>{if(value)draft.definition.courseCode=value;else delete draft.definition.courseCode;},{disabled:readonly,options:[['','Chọn trình độ'],['34','3.0–4.0'],['45','4.0–5.0'],['56','5.0–6.0'],['67','6.0–7.0']]});
    const instructions=el('details');instructions.append(el('summary','Hướng dẫn toàn bài'));field(instructions,'Hướng dẫn',draft.definition.instructions||'',value=>{draft.definition.instructions=value;},{kind:'textarea',disabled:readonly});info.append(instructions);editor.append(info);
    const division=el('section',undefined,{className:'thuy-editor-division'});division.append(el('h2','Cấu trúc bài tập'));
    const undivided=button('Không chia phần',()=>{if(draft.definition.blocks.length===1)return;if(draft.definition.blocks.slice(1).some(b=>b.items.length)){notice('Chuyển các câu về phần đầu trước khi bỏ các phần còn lại.');return;}draft.definition.blocks=draft.definition.blocks.slice(0,1);draft.definition.blocks[0].title='Bài tập';markDirty();paint();},readonly);
    const divided=button('Chia phần',()=>{if(draft.definition.blocks.length>1)return;draft.definition.blocks[0].title='Ôn tập buổi trước';draft.definition.blocks.push({blockId:uuid(),kind:'exercise',checkpoint:2,title:'Bài học hôm nay',instructions:'',items:[]});markDirty();paint();},readonly);
    undivided.setAttribute('aria-pressed',String(draft.definition.blocks.length===1));divided.setAttribute('aria-pressed',String(draft.definition.blocks.length>1));division.append(undivided,divided);
    if(draft.definition.blocks.length>1){field(division,'Số phần',String(draft.definition.blocks.length),value=>{
      const count=Number(value);if(count<draft.definition.blocks.length&&draft.definition.blocks.slice(count).some(b=>b.items.length)){notice('Phần cần bỏ đang có câu hỏi. Chuyển câu sang phần khác trước.');paint();return;}
      while(draft.definition.blocks.length<count)draft.definition.blocks.push({blockId:uuid(),kind:'exercise',checkpoint:Math.min(3,draft.definition.blocks.length+1),title:'Phần '+(draft.definition.blocks.length+1),instructions:'',items:[]});draft.definition.blocks=draft.definition.blocks.slice(0,count);markDirty();paint();
    },{disabled:readonly,options:Array.from({length:9},(_,i)=>[String(i+2),String(i+2)])});}
    editor.append(division);
    for(const [index,block]of draft.definition.blocks.entries()){
      const section=el('section',undefined,{className:'thuy-editor-section'}),top=el('header',undefined,{className:'thuy-editor-section-head'}),ai=button('Tạo bài tập bằng AI',()=>{importTargetBlockId=block.blockId;aiPopupOpen=true;paint();},readonly);section.dataset.block=block.blockId;section.dataset.validationField='items';ai.dataset.aiTargetBlock=block.blockId;top.append(el('h2',(draft.definition.blocks.length>1?'Phần '+(index+1)+' · ':'')+block.title),ai);section.append(top);
      if(draft.definition.blocks.length>1)field(section,'Tên phần '+(index+1),block.title,value=>{block.title=value;},{disabled:readonly});
      const add=el('div',undefined,{className:'thuy-editor-add'});for(const [type,label]of PART_TYPES.survey)add.append(addButton('+ '+label,()=>{const kind=['reflection','self_reported_score'].includes(type)?'survey':'exercise';block.items.push(preparePartItem(newEditorItem(type),kind));resequence();markDirty();paint();},readonly));section.append(add);
      for(const item of block.items)paintThuyItem(section,item,block,readonly);if(!block.items.length)section.append(el('p','Chưa có câu hỏi.'));editor.append(section);
    }
    if(!readonly){paintImport();editor.lastElementChild.classList.add('thuy-import');if(aiPopupOpen)paintImport({aiOnly:true});}
  }
  function paint() {
    for(const widget of gapWidgets)widget.dispose();gapWidgets=[];
    editor.replaceChildren();paintActions();paintWorkspace();session.disabled=false;if(!draft)return;
    const readonly=reviewMode||draft.status==='published';session.disabled=readonly;
    if(!libraryEnabled)editor.append(el('h3',`${statusLabel(draft.status)} · bản ${draft.revision}${dirty?' · chưa lưu':''}`));
    if(conflict){const compare=el('section',undefined,{className:'editor-conflict'});
      compare.append(el('h4','Đối chiếu bản mới trên máy chủ'),el('p',`Bản máy chủ ${conflict.revision}: ${conflict.definition.title} · buổi ${conflict.sessionNumber}`));
      const details=el('details');details.append(el('summary','Xem nội dung bản mới'));
      for(const block of conflict.definition.blocks){details.append(el('h4',block.title));for(const item of block.items)details.append(el('p',`${item.position}. ${item.prompt} · ${item.options.map(o=>o.label).join(' / ')}`));}compare.append(details);
      compare.append(button('Dùng bản mới từ máy chủ',()=>{if(window.confirm('Bỏ phần đang soạn để dùng bản máy chủ?'))adopt(conflict);}),
        button('Giữ phần đang soạn và lưu trên bản mới',()=>void run(async()=>{
          if(!window.confirm('Dùng phần đang soạn thay cho bản máy chủ vừa đối chiếu?'))return;
          draft.revision=conflict.revision;conflict=null;dirty=true;await save();
        })));editor.append(compare);
    }
    if(libraryEnabled){paintThuyEditor();lockControls();return;}
    field(editor,'Tên phiếu',draft.definition.title,value=>{draft.definition.title=value;},{disabled:readonly});
    field(editor,'Mã khóa (theo các phiếu của lớp)',draft.definition.courseCode||'',value=>{if(value)draft.definition.courseCode=value.trim();else delete draft.definition.courseCode;},{disabled:readonly});
    field(editor,'Cấu trúc phiếu',draft.definition.kind,value=>{draft.definition.kind=value;},{disabled:readonly,options:[['mixed','Phiếu hỗn hợp'],['quiz','Phiếu câu hỏi'],['reflection','Phiếu nhìn lại bài học']]});
    field(editor,'Mở đáp án của cả phiếu',draft.definition.answerReleasePolicy,value=>{draft.definition.answerReleasePolicy=value;},{disabled:readonly,options:[['hidden','Ẩn'],['immediate','Sau khi nộp'],['teacher_release','Giảng viên mở']]});
    field(editor,'Thời gian dự kiến (phút; để trống nếu không dùng)',draft.definition.estimatedMinutes||'',value=>{if(value)draft.definition.estimatedMinutes=value;else delete draft.definition.estimatedMinutes;},{kind:'number',min:1,max:120,disabled:readonly});
    const structure=el('div',undefined,{className:'editor-structure'}),outline=el('nav',undefined,{className:'editor-outline'}),sections=el('div',undefined,{className:'editor-sections'});
    outline.setAttribute('aria-label','Các phần của phiếu');outline.append(el('h4','Các phần của phiếu'));
    structure.append(outline,sections);editor.append(structure);
    for(const block of draft.definition.blocks){const section=el('section',undefined,{className:'editor-block'});
      outline.append(button(`Phần ${draft.definition.blocks.indexOf(block)+1} · ${block.title}`,()=>{
        section.scrollIntoView({behavior:'smooth',block:'start'});section.querySelector('input,select')?.focus({preventScroll:true});
      }));
      const blockIndex=draft.definition.blocks.indexOf(block);
      section.append(button('Đưa phần lên',()=>move(draft.definition.blocks,blockIndex,-1),readonly||blockIndex===0),
        button('Đưa phần xuống',()=>move(draft.definition.blocks,blockIndex,1),readonly||blockIndex===draft.definition.blocks.length-1),
        removeButton('Bỏ phần',()=>{
          if(libraryEnabled&&block.items.length){notice('Phần này đang có câu hỏi. Chuyển các câu sang phần khác trước khi bỏ phần.');return;}
          const ids=new Set(block.items.map(item=>item.itemVersionId));
          if(draft.definition.blocks.filter(value=>value!==block).flatMap(value=>value.items).some(item=>ids.has(item.interactionConfig.visibleWhenItemVersionId))) {
            notice('Cần đổi ô phụ thuộc ở phần khác trước khi bỏ phần này.');return;
          }
          for(const id of ids)removeItemKeys(id);
          draft.definition.blocks=draft.definition.blocks.filter(value=>value!==block);resequence();markDirty();paint();
        },readonly||draft.definition.blocks.length<=1));
      field(section,'Tên phần',block.title,value=>{block.title=value;},{disabled:readonly});field(section,'Hướng dẫn phần',block.instructions,value=>{block.instructions=value;},{kind:'textarea',disabled:readonly});
      field(section,'Chặng làm bài',block.checkpoint,value=>{block.checkpoint=Number(value);},{disabled:readonly,options:[['1','Đầu buổi'],['2','Trong buổi'],['3','Cuối buổi']]});
      for(const item of block.items)paintItem(section,item,block,readonly);
      const type=el('select');type.setAttribute('aria-label','Dạng câu mới');for(const [code,label]of EDITOR_TYPES)type.append(el('option',label,{value:code}));section.append(type,addButton('Thêm câu vào phần',()=>{
        block.items.push(newEditorItem(type.value));resequence();markDirty();paint();
      },readonly||draft.definition.blocks.flatMap(b=>b.items).length>=100));sections.append(section);
    }
    editor.append(addButton('Thêm phần',()=>{draft.definition.blocks.push({blockId:uuid(),checkpoint:3,title:'Phần mới',instructions:'',items:[newEditorItem('reflection')]});resequence();markDirty();paint();},readonly||draft.definition.blocks.length>=20));
    if(!readonly)paintImport();lockControls();
    if(publishAttempted)showAuthoringIssues(editor,collectPublishIssues(payload()),{getIssues:()=>collectPublishIssues(payload())});
  }
  function paintAiImport(){
    if(aiView?.open)return;
    const dialog=el('dialog',undefined,{className:'thuy-management-dialog thuy-editor-ai'}),head=el('header',undefined,{className:'thuy-management-head'}),body=el('div',undefined,{className:'thuy-management-body'});
    const close=button('×',()=>dialog.close());close.setAttribute('aria-label','Đóng AI');head.append(el('h2','Tạo bài tập bằng AI'),close);
    const input=el('textarea',undefined,{rows:12,value:importText,placeholder:AI_IMPORT_EXAMPLE});input.setAttribute('aria-label','Nội dung câu hỏi có sẵn');
    const status=el('p','',{role:'status',className:'notice'}),details=el('div');let applied=false,running=false;
    const create=button('Tạo bài',()=>{
      if(running||applied)return;running=true;input.disabled=create.disabled=true;status.textContent=input.value.length>6000?'Nội dung dài: AI đang xử lý, có thể cần tới 4–5 phút kể cả một lần thử lại. Bạn có thể đóng cửa sổ để hủy nhận kết quả.':'AI đang tạo câu; hệ thống tự thử lại một lần nếu gặp lỗi. Nội dung của bạn đang được giữ nguyên…';
      void run(async current=>{
        try{
          const raw=input.value;importText=raw;if(!raw.trim()||raw.length>60000)throw Error('Dán từ 1 đến 60.000 ký tự để AI nhận dạng; nội dung dài hơn hãy chia thành các lượt nhỏ.');
          if(aiApplied?.text===raw&&aiApplied.draftId===draft.id)throw Error('Nội dung này đã được thêm vào phiếu. Kiểm các câu trong bộ soạn trước khi nhập tiếp.');
          if(dirty||!draft.id)await save();if(current!==generation||!dialog.open)return;
          const before=draft,id=draft.id,revision=draft.revision,targetId=importTargetBlockId;
          const {preview}=await requestAiImport(id,raw,revision);
          if(current!==generation||!dialog.open||draft!==before||draft.id!==id||draft.revision!==revision)return;
          if(!preview?.payload||preview.baseRevision!==revision||(preview.errors||[]).length)throw Error((preview?.errors||[]).map(e=>e.message).join(' ')||'Kết quả chưa hợp lệ; bản nháp chưa thay đổi.');
          const next=clone(preview.payload),existing=new Map(draft.definition.blocks.flatMap(b=>b.items).map(i=>[i.itemVersionId,i])),nextItems=next.definition.blocks.flatMap(b=>b.items);
          if([...existing].some(([key,item])=>JSON.stringify(canonical(nextItems.find(i=>i.itemVersionId===key)))!==JSON.stringify(canonical(item))))throw Error('Kết quả làm đổi câu đã có; giữ nguyên nháp để đối chiếu.');
          const added=nextItems.filter(i=>!existing.has(i.itemVersionId)),target=next.definition.blocks.find(b=>b.blockId===targetId);
          if(!target||!added.length||new Set(nextItems.map(i=>i.itemVersionId)).size!==nextItems.length)throw Error('Phần nhận hoặc định danh câu chưa khớp; chưa thêm câu nào.');
          for(const block of next.definition.blocks)block.items=block.items.filter(i=>existing.has(i.itemVersionId));
          for(const item of added){if(!['exercise','survey'].includes(item.kind))throw Error('AI chưa xác định Bài tập/Khảo sát cho từng câu; chưa thêm câu nào.');if(!item.skillCodes?.length)item.skillCodes=['general'];}
          target.items.push(...added);const oldBlocks=new Set(draft.definition.blocks.map(b=>b.blockId));next.definition.blocks=next.definition.blocks.filter(b=>oldBlocks.has(b.blockId));
          draft.definition=next.definition;draft.gradingKey=next.gradingKey;resequence();dirty=true;applied=true;aiApplied={text:raw,draftId:id};aiPopupOpen=false;paint();
          status.textContent='Đã thêm '+added.length+' câu. Đang lưu nháp…';
          const warning=(preview.warnings||[]).join('\n'),remaining=preview.unmappedText?.trim();
          details.replaceChildren();if(warning)details.append(el('p',warning,{className:'notice error'}));
          if(remaining){details.append(el('h3','Nội dung nguồn chưa được chuyển'),el('pre',remaining));}
          await save();
          const message='Đã thêm và lưu '+added.length+' câu trong phiếu.'+(remaining?' Còn nội dung chưa chuyển; hãy đối chiếu phần bên dưới.':'')+(warning?' Kiểm các cảnh báo ở từng câu trước khi xuất bản.':'');
          status.textContent=message;notice(message);if(!remaining&&!warning)dialog.close();
        }catch(error){status.textContent=(applied?'Các câu đã được giữ trong nháp. Chưa lưu được: ':'Chưa tạo được: ')+error.message;
          if(applied){const retry=button('Thử lưu nháp',()=>void run(async()=>{await save();status.textContent='Đã lưu các câu vừa tạo. Bạn có thể đóng để kiểm nội dung.';retry.remove();}));details.append(retry);}
          throw error;
        }
      }).finally(()=>{running=false;input.disabled=false;create.disabled=applied;});
    });
    create.classList.add('primary');input.addEventListener('input',()=>{importText=input.value;});
    body.append(el('p','Dán câu hỏi, các phương án và đáp án rõ ràng. Có thể dán nhiều bài cùng lúc'),input,create,status,details);
    dialog.append(head,body);document.body.append(dialog);aiView=dialog;bindDialogDismiss(dialog);
    dialog.addEventListener('close',()=>{importText=input.value;aiPopupOpen=false;if(aiView===dialog)aiView=null;dialog.remove();editor.querySelector('[data-ai-target-block="'+importTargetBlockId+'"]')?.focus({preventScroll:true});},{once:true});dialog.showModal();
  }
  async function requestAiImport(id,text,revision){
    try{return await request('/teacher/form-drafts/'+id+'/ai-import-preview',{method:'POST',body:{text,expectedRevision:revision},timeoutMs:300000});}
    catch(error){
      if(error.name==='AbortError'||error.name==='TimeoutError')throw Error('Đã hết thời gian chờ AI. Nội dung nguồn và nháp được giữ nguyên; bạn có thể thử lại hoặc chia nội dung thành lượt nhỏ.');
      if(error.name==='TypeError')throw Error('Không kết nối được máy chủ. Nội dung nguồn và nháp được giữ nguyên; hãy kiểm tra kết nối mạng rồi bấm Tạo bài để thử lại.');
      throw error;
    }
  }
  function paintImport({aiOnly=false}={}) {
    if(aiOnly){paintAiImport();return;}
    const section=el('details',undefined,{open:importOpen});section.append(el('summary','Nhập câu hỏi từ CSV / văn bản chia cột'));
    if(!aiOnly)section.addEventListener('toggle',()=>{importOpen=section.open;});
    section.append(el('p',aiOnly?'Dán nguyên câu hỏi và đáp án đã có. AI chỉ nhận dạng cấu trúc; bạn kiểm và chọn thêm vào phần đang soạn.':'Các cột: type, prompt, checkpoint, block_title, options, answer, required, config, display_number, skill, alias, depends_on, when, graded. Nhập chưa phát hành phiếu.'));
    section.append(button('Nhập file tổng hợp / nhiều Docs',()=>void run(async()=>{
      if(dirty)await save();if(!draft||reviewMode||draft.status==='published')return;
      aiPopupOpen=false;for(const popup of editor.querySelectorAll('dialog.thuy-editor-ai'))popup.close();
      const getContext=()=>draft&&!reviewMode&&draft.status!=='published'?{draftId:draft.id,revision:draft.revision,contextKey:generation+':'+draft.id,
        targetBlockId:importTargetBlockId,blocks:draft.definition.blocks.map(b=>({blockId:b.blockId,title:b.title}))}:null;
      docsBatch??=createDocsBatchImporter({apiRequest:request,getContext,
        refreshDraft:async()=>{if(dirty)throw Error('Bản đang gõ có thay đổi chưa lưu. Lưu hoặc đối chiếu nháp trước khi xem đề xuất nhập.');
          const before=getContext();if(!before)throw Error('Ngữ cảnh soạn nháp đã đổi.');const value=await request('/teacher/form-drafts/'+before.draftId);
          if(getContext()?.contextKey!==before.contextKey)throw Error('Đã chuyển nháp; không áp dụng phản hồi cũ.');
          if(dirty)throw Error('Giữ bản đang gõ; đối chiếu trước khi tải nháp mới.');adopt(value.draft);return getContext();},
        onApplied:(reply,context)=>{if(getContext()?.contextKey!==context.contextKey)return;
          if(dirty){notice('Lô nhập đã được lưu trên máy chủ. Giữ bản đang gõ; hãy đối chiếu phiên bản mới trước khi lưu tiếp.');return;}
          adopt(reply.draft);void refreshList();const r=reply.receipt;
          notice(`${reply.replayed?'Đã đối chiếu lần thêm trước':'Đã thêm'} ${r.appliedQuestions} câu vào nháp; ${r.excludedByTeacher} câu được loại bởi giảng viên. `+
            `${r.keyProblems} cảnh báo key theo câu và ${r.sourceKeyWarnings||0} cảnh báo ghép key nguồn cần đối chiếu; ${r.needsReviewQuestions} câu cần xử lý; ${r.incompleteDocuments} tài liệu chưa đọc; ${r.manualRegions} vùng nguồn cần xem riêng. Phiếu lớp chưa thay đổi.`);
        }});docsBatch.open();
    })));
    const docs=el('input',undefined,{type:'url',placeholder:'https://docs.google.com/document/d/…',value:docsUrl});docs.setAttribute('aria-label','Link Google Docs câu hỏi');
    docs.addEventListener('input',()=>{docsUrl=docs.value;importPreview=null;});
    const docsRead=button('Đọc Google Docs và đề xuất câu hỏi',()=>void run(async current=>{
      docsUrl=docs.value;if(!docsUrl.trim())throw Error('Dán link Google Docs cần nhập.');if(dirty)await save();
      importPreview=null;notice('Đang đọc cấu trúc Docs. Key chỉ là đề xuất; chưa thay đổi phiếu.');
      const reply=await request('/teacher/form-drafts/'+draft.id+'/docs-import-preview',{method:'POST',body:{url:docsUrl,
        expectedRevision:draft.revision,...(importTargetBlockId?{targetBlockId:importTargetBlockId}:{})},timeoutMs:25000});
      if(current!==generation)return;importPreview=reply.preview;importOpen=true;paint();notice('Đã đọc Docs. Kiểm cảnh báo key từng câu trước khi thêm vào nháp.');
    }));section.append(el('p','Nhập một Docs theo buổi. Màu đáp án và key cuối được giữ riêng để giảng viên đối chiếu.'),docs,docsRead);
    const text=el('textarea',undefined,{rows:7});text.setAttribute('aria-label',aiOnly?'Nội dung câu hỏi có sẵn':'CSV hoặc văn bản nhập câu hỏi');
    text.value=importText;text.addEventListener('input',()=>{importText=text.value;importPreview=null;});
    text.placeholder='type,prompt\nreflection,Em muốn luyện thêm điều gì?';const file=el('input',undefined,{type:'file',accept:'.csv,.tsv,.txt'});
    file.setAttribute('aria-label','Chọn file câu hỏi');file.addEventListener('change',()=>void run(async()=>{
      const chosen=file.files?.[0];if(!chosen)return;if(chosen.size>240000)throw new Error('File lớn hơn 240 KB.');text.value=await chosen.text();importText=text.value;importPreview=null;
    }));const result=el('div');
    section.append(file,text,button('Xem trước lô câu hỏi',()=>void run(async current=>{
      const raw=text.value;importText=raw;if(dirty)await save();
      const reply=await request('/teacher/form-drafts/'+draft.id+'/import-preview',{method:'POST',body:{text:raw,expectedRevision:draft.revision}});
      if(current!==generation)return;importPreview=reply.preview;importOpen=true;paint();
    })),button('Tạo bài tập bằng AI',()=>void run(async current=>{
      const raw=text.value;importText=raw;if(!raw.trim()||raw.length>60000)throw new Error('Dán từ 1 đến 60.000 ký tự để AI nhận dạng; nội dung dài hơn hãy chia thành các lượt nhỏ.');
      if(dirty)await save();notice('AI đang nhận dạng nội dung. Chưa thêm câu hoặc phát hành phiếu…');
      const reply=await requestAiImport(draft.id,raw,draft.revision);
      if(current!==generation)return;importPreview=reply.preview;
      if(libraryEnabled&&importTargetBlockId&&importPreview.payload){
        const existing=new Set(draft.definition.blocks.flatMap(b=>b.items).map(i=>i.itemVersionId)),blockIds=new Set(draft.definition.blocks.map(b=>b.blockId)),blocks=importPreview.payload.definition.blocks,target=blocks.find(b=>b.blockId===importTargetBlockId);
        if(!target)throw Error('Phần nhận câu đã thay đổi. Mở lại AI từ đúng phần.');
        const added=blocks.flatMap(b=>b.items).filter(i=>!existing.has(i.itemVersionId));for(const item of added)item.kind??=item.graderType==='none'?'survey':'exercise';
        for(const block of blocks)block.items=block.items.filter(i=>existing.has(i.itemVersionId));target.items.push(...added);
        importPreview.payload.definition.blocks=blocks.filter(b=>blockIds.has(b.blockId)||b.items.length);importPreview.payload.definition.blocks.flatMap(b=>b.items).forEach((item,index)=>{item.position=index+1;});
      }
      importOpen=true;paint();notice('AI đã tạo bản đề xuất. Đối chiếu nguồn, đáp án và phần chưa nhận dạng trước khi thêm.');
    })),el('p','Với AI: dán nguyên đề có sẵn, không cần chia cột. AI không tự soạn câu mới, đoán đáp án hoặc giao bài. Với CSV: dùng Xem trước lô câu hỏi.'),result);
    if(libraryEnabled)for(const control of section.querySelectorAll('button'))if(control.textContent==='Tạo bài tập bằng AI')control.hidden=true;
    if(importPreview){
      if(importPreview.source)result.append(el('p','Nguồn: '+importPreview.source.title+' · Đọc cấu trúc Docs, chưa gọi AI · Key chưa được tự động duyệt.'));
      if(importPreview.coverage){const c=importPreview.coverage;result.append(el('p',`Đã chuyển ${c.convertedQuestions}/${c.sourceQuestions} câu nguồn thành ${c.generatedControls} trường nhập. `+
        (c.deferredQuestions?`Còn ${c.deferredQuestions} câu CHƯA CHUYỂN, cần xử lý riêng; không được coi là đã nhập đủ.`:'Không có câu nguồn bị bỏ khỏi đề xuất.'),{className:c.deferredQuestions?'notice error':'notice',role:c.deferredQuestions?'alert':'status'}));}
      for(const row of importPreview.rows||[])if(row.keyStatus&&row.keyStatus!=='not_required')result.append(importReviewCard(row));
      for(const warning of importPreview.warnings||[])result.append(el('p',warning,{className:'notice error'}));
      if(importPreview.unmappedText){const remaining=el('details');remaining.append(el('summary','Nội dung nguồn chưa được chuyển — cần đối chiếu'),el('pre',importPreview.unmappedText));result.append(remaining);}
      for(const row of importPreview.rows)result.append(el('p',`Dòng ${row.line} · ${row.type} · chặng ${row.checkpoint} · ${row.slotCount} ô · ${row.optionCount} phương án · ${row.required?'bắt buộc':'không bắt buộc'} · ${row.graderType==='none'?'không tự chấm':'chấm đáp án'}: ${row.prompt}`));
      for(const error of importPreview.errors)result.append(el('p',`Dòng ${error.line}: ${error.message}`,{className:'notice error'}));
      result.append(addButton(importPreview.coverage?.deferredQuestions?'Xác nhận thêm các câu đã chuyển vào nháp':'Xác nhận thêm lô này vào nháp',()=>void run(async()=>{
        if(!importPreview?.payload||importPreview.baseRevision!==draft.revision)throw new Error('Lô nhập đã cũ. Hãy xem trước lại.');
        const deferred=importPreview.coverage?.deferredQuestions||0;
        const existing=new Set(draft.definition.blocks.flatMap(block=>block.items).map(item=>item.itemVersionId));
        draft.definition=clone(importPreview.payload.definition);draft.gradingKey=clone(importPreview.payload.gradingKey);
        if(libraryEnabled)for(const block of draft.definition.blocks)for(const item of block.items)if(!existing.has(item.itemVersionId)){
          const kind=item.graderType==='none'?'survey':'exercise',type=editorType(item);if(PART_TYPES[kind].some(([code])=>code===type||code==='short_answer'&&type==='gapfill'))item.kind??=kind;
        }
        dirty=true;aiPopupOpen=false;paint();await save();
        notice(deferred?`Đã thêm các câu đã chuyển vào nháp. Còn ${deferred} câu cần xử lý riêng; phiếu lớp chưa thay đổi.`:'Đã thêm cả lô vào nháp; phiếu lớp chưa thay đổi.');
      }),Boolean(importPreview.errors.length)||!importPreview.payload));
    }
    if(aiOnly){
      section.open=true;section.querySelector('summary').hidden=true;file.hidden=true;
      for(const control of section.querySelectorAll('button'))if(control.textContent==='Xem trước lô câu hỏi')control.hidden=true;
      const dialog=el('dialog',undefined,{className:'thuy-management-dialog thuy-editor-ai'}),head=el('header',undefined,{className:'thuy-management-head'}),close=button('×',()=>dialog.close());close.setAttribute('aria-label','Đóng AI');
      head.append(el('h2','Tạo bài tập bằng AI'),close);dialog.append(head,section);editor.append(dialog);bindDialogDismiss(dialog);
      dialog.addEventListener('close',()=>{importText=text.value;aiPopupOpen=false;editor.querySelector('[data-ai-target-block="'+importTargetBlockId+'"]')?.focus({preventScroll:true});});dialog.showModal();
    }else editor.append(section);
  }
  const header=el('section',undefined,{className:'editor-toolbar'}),editorTitle=el('h2',libraryEnabled?'Sửa bài tập':'Soạn và duyệt phiếu học tập');header.append(editorTitle);
  const grid=el('div',undefined,{className:'field-grid'});
  for(const [label,input]of [['Lớp soạn phiếu',classSelect],['Buổi của nháp',session],['Phiếu nguồn để sao chép',sourceSelect]]){const wrap=el('label',undefined,{className:'field'});wrap.append(el('span',label),input);grid.append(wrap);}
  session.addEventListener('input',()=>{if(draft&&!reviewMode&&draft.status!=='published')markDirty();});
  let pendingCreate=null,pendingCopy=null;
  const newButton=addButton('Tạo nháp mới',()=>void run(async current=>{
    if(!canDiscard())return;pendingCreate??={...newEditorPayload(),classId:classSelect.value,sessionNumber:Number(session.value),operationId:uuid()};
    const result=await request('/teacher/form-drafts',{method:'POST',body:pendingCreate});if(current!==generation)return;
    pendingCreate=null;adopt(result.draft);await refreshList();notice('Đã tạo nháp trên máy chủ.');
  }));
  const copyButton=button('Sao chép phiếu đã chọn',()=>void run(async current=>{
    if(!canDiscard())return;if(!sourceSelect.value)throw new Error('Chọn một phiếu nguồn được cấp quyền.');
    pendingCopy??={assignmentId:sourceSelect.value,classId:classSelect.value,sessionNumber:Number(session.value),operationId:uuid()};
    const result=await request('/teacher/form-drafts/copy',{method:'POST',body:pendingCopy});if(current!==generation)return;
    pendingCopy=null;adopt(result.draft);await refreshList();notice('Đã sao chép với định danh mới; phiếu nguồn giữ nguyên.');
  }));header.append(grid,newButton,copyButton,button('Đọc lại danh sách nháp',()=>void run(refreshList)));
  classSelect.addEventListener('change',()=>{
    if(!canDiscard()){classSelect.value=draft?.classId||'';return;}
    generation+=1;busy=false;backgroundBusy=false;queuedForeground=false;draft=null;dirty=false;pendingCreate=null;pendingCopy=null;paint();void run(refreshList);
  });
  const libraryRoot=el('section',undefined,{className:'editor-form-library'});
  const authorRoot=el('div',undefined,{className:'thuy-authoring'}),back=button('← Quản lý bài tập',()=>{
    if(!canDiscard())return;generation+=1;clearTimeout(autosaveTimer);busy=false;backgroundBusy=false;queuedForeground=false;lockControls();
    draft=null;dirty=false;pendingCreate=null;pendingCopy=null;skillErrors.clear();authoring=false;paint();void run(refreshList);void library?.refresh();
  });
  if(libraryEnabled){
    const titlebar=el('div',undefined,{className:'thuy-editor-titlebar'});
    back.textContent='←';back.setAttribute('aria-label','Quay lại Quản lý bài tập');back.title='Quay lại Quản lý bài tập';back.classList.add('thuy-editor-back');
    const titleGroup=el('div',undefined,{className:'thuy-editor-title'});titleGroup.append(editorTitle,saveState);
    titlebar.append(back,titleGroup,actions);authorRoot.append(titlebar,header,status,draftList,editor);
  }else authorRoot.append(back,header,status,draftList,editor,actions);
  function paintWorkspace(){if(!libraryEnabled)return;libraryRoot.hidden=authoring;authorRoot.hidden=!authoring;draftList.hidden=Boolean(draft);}
  host.replaceChildren(...(libraryEnabled?[libraryRoot,authorRoot]:[header,status,draftList,actions,editor]));
  if(libraryEnabled){
    // Ngữ cảnh lớp/buổi vẫn phục vụ quyền và lưu nháp, chỉ chọn đích giao trong Giao bài.
    header.hidden=true;
    const copies=new Map();library=createFormLibrary({host:libraryRoot,request,onAssign:entry=>assignmentDialog.open(entry),onRefresh:refreshList,
      getClassContext:()=>({classId:classSelect.value,className:classes.find(c=>String(c.class_id)===classSelect.value)?.class_name||''}),onManagementChanged,onCreate:()=>{
    if(!canDiscard())return;const value=newEditorPayload('Bài tập chưa đặt tên');value.definition.blocks[0].title='Bài tập';value.definition.blocks[0].kind='exercise';value.definition.blocks[0].items=[];
    adopt({...value,id:null,classId:classSelect.value,sessionNumber:Number(session.value),status:'draft',revision:0});markDirty();paint();
  },onOpenDraft:async entry=>{
    if(!canDiscard())return false;let opened=false;await run(async current=>{const review=Boolean(entry.draft?.reviewMode);let result=await request('/teacher/form-drafts/'+entry.id+(review?'/review':''));
      if(!review){
        const key='published:'+entry.id+':'+classSelect.value+':'+session.value;if(!copies.has(key))copies.set(key,uuid());
        result=await request('/teacher/form-drafts/'+entry.id+'/edit',{method:'POST',body:{operationId:copies.get(key)}});copies.delete(key);
      }if(current===generation){adopt(result.draft,{review});opened=true;}});return opened;
  },onCopyUsed:async entry=>{
    if(!canDiscard())return false;let opened=false;await run(async current=>{
      const key='assigned:'+entry.id;if(!copies.has(key))copies.set(key,uuid());
      try{const reply=await request('/teacher/form-drafts/from-assignment/'+entry.id+'/edit',{method:'POST',body:{operationId:copies.get(key)}});
        if(current!==generation)return;copies.delete(key);adopt(reply.draft);await refreshList();opened=true;notice('Đã mở cùng phiếu trong kho để chỉnh sửa. Bản đã giao được giữ nguyên.');
      }catch(error){if(error.code!=='WORKSHEET_SOURCE_NOT_OWNED')throw error;
        const reply=await request('/teacher/form-drafts/copy',{method:'POST',body:{assignmentId:entry.id,classId:classSelect.value,sessionNumber:Number(session.value),operationId:copies.get(key)}});
        if(current!==generation)return;copies.delete(key);adopt(reply.draft);await refreshList();opened=true;notice('Đã tạo bản riêng trong Kho cá nhân. Phiếu nguồn thuộc người khác được giữ nguyên.');
      }
    });return opened;
  },onCopy:async entry=>{
    if(!canDiscard())return false;let copied=false;await run(async current=>{
      const key=entry.id+':'+classSelect.value+':'+session.value;if(!copies.has(key))copies.set(key,uuid());
      const reply=await request(entry.source==='personal'?'/teacher/form-drafts/'+entry.sourceDraftId+'/edit':'/teacher/form-library/'+entry.id+'/copy',{method:'POST',body:entry.source==='personal'?{operationId:copies.get(key)}:{classId:classSelect.value,sessionNumber:Number(session.value),operationId:copies.get(key)}});
      if(current!==generation)return;copies.delete(key);adopt(reply.draft);await refreshList();copied=true;notice(entry.source==='personal'?'Đã mở phiếu để chỉnh sửa.':'Đã mở bản nháp riêng để sửa.');
    });return copied;
  }});paintWorkspace();}
  window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
  return {
    hasUnsavedChanges:()=>dirty,
    confirmDiscard:canDiscard,
    setWorkspace({classes:newClasses,assignments:newAssignments,classId,sessionNumber}) {
      const selectedClass=draft?.classId||classId||classSelect.value,selectedSource=sourceSelect.value;
      classes=newClasses;assignments=newAssignments;classSelect.replaceChildren();sourceSelect.replaceChildren(el('option','Chọn phiếu nguồn',{value:''}));
      for(const value of classes)classSelect.append(el('option',value.class_name,{value:String(value.class_id)}));
      for(const value of assignments)sourceSelect.append(el('option',`${value.class_name} · buổi ${value.session_number} · ${value.title}`,{value:value.assignment_id}));
      if(classes.some(value=>String(value.class_id)===String(selectedClass)))classSelect.value=String(selectedClass);
      if(!draft&&sessionNumber)session.value=String(sessionNumber);
      library?.setUsed(assignments);
      if(assignments.some(value=>value.assignment_id===selectedSource))sourceSelect.value=selectedSource;
      void run(refreshList);
      if(libraryEnabled)void library.refresh();
    },
    setContext({classId,sessionNumber}){if(draft||dirty||busy)return;classSelect.value=String(classId);if(sessionNumber)session.value=String(sessionNumber);library?.setUsed(assignments);void run(refreshList);},
    clear() {generation+=1;clearTimeout(autosaveTimer);docsBatch?.dispose();authoring=!libraryEnabled;draft=null;dirty=false;busy=false;backgroundBusy=false;queuedForeground=false;lockControls();conflict=null;importPreview=null;pendingCreate=null;pendingCopy=null;
      aiView?.close();aiApplied=null;for(const preview of previews)preview.close();previews.clear();library?.clear();assignmentDialog.clear();
      importText='';importOpen=false;classSelect.replaceChildren();sourceSelect.replaceChildren();draftList.replaceChildren();paint();notice('Đăng nhập để soạn phiếu.');},
    // Dùng cùng đường render thật trong kiểm thử để đối chiếu definition/key trước và sau khi soạn.
    openDraft:value=>adopt(value),getPayload:()=>draft?payload():null
  };
}

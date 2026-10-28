// Giảng viên chọn nguồn/buổi/phần; server giữ snapshot, ID câu và biên nhận. Không lưu key vào browser storage.
import {bindDialogDismiss} from './session-comments.js';
import {authoringAction} from './authoring-action.js?rev=20261029-authoring-actions-v2';
import {importReviewCard} from './docs-import-review.js?rev=20261025-docs-import-v1';
const el=(tag,text='',props={})=>{const node=document.createElement(tag);node.textContent=text;Object.assign(node,props);return node;};
const caption={pending:'Chưa đọc',reading:'Đang đọc',ready:'Đã đọc',error:'Đọc lỗi'};
const resultCaption={ready:'Chuyển được',needs_review:'Cần xử lý',error:'Chuyển lỗi',already_imported:'Đã có trong nháp',source_changed:'Nguồn đã đổi — cần đối chiếu',duplicate_source:'Trùng nguồn — không thêm lần hai'};
export function createDocsBatchImporter({apiRequest,getContext,refreshDraft,onApplied}){
 let dialog,body,status,context,session,plan,urls='',recent=[],busy=false,epoch=0,pendingCreate=null,pendingApply=null,preserveParts=true;
 const selectedUnits=new Set(),excludedQuestions=new Set(),readErrors=new Map();
 const path=()=>'/teacher/form-drafts/'+context.draftId+'/docs-import-sessions';
 const current=token=>token===epoch&&getContext()?.contextKey===context?.contextKey;
 const message=(text,error=false)=>{if(status){status.textContent=text;status.className='notice'+(error?' error':'');status.setAttribute('role',error?'alert':'status');}};
 const button=(text,action,disabled=false)=>{const b=el('button',text,{type:'button',className:'button',disabled});b.addEventListener('click',()=>void act(action));return b;};
 async function act(action){if(busy)return;const token=epoch;busy=true;paint();
  try{await action(token);}catch(error){if(current(token))message(error.message||'Chưa hoàn tất thao tác. Nháp cũ được giữ.',true);}
  finally{if(current(token)){busy=false;paint();}}
 }
 function reconcile(value){
  if(session&&value.id===session.id&&value.catalogRevision<session.catalogRevision)return;
  session=value;const valid=new Set(value.documents.filter(d=>d.status==='ready').flatMap(d=>d.catalog?.units.map(u=>u.unitId)||[]));
  for(const id of selectedUnits)if(!valid.has(id))selectedUnits.delete(id);
  if(!plan||plan.catalogRevision!==value.catalogRevision||plan.baseRevision!==getContext()?.revision)plan=null;
 }
 async function readOne(documentKey,token){
  try{const value=await apiRequest(path()+'/'+session.id+'/documents/'+documentKey+'/read',{method:'POST',body:{}});
   if(!current(token))return;readErrors.delete(documentKey);reconcile(value.session);paint();
  }catch(error){if(current(token)){readErrors.set(documentKey,error.message);paint();}}
 }
 async function readPending(token){
  const queue=session.documents.filter(d=>d.status!=='ready'&&d.canRead).map(d=>d.documentKey);
  const worker=async()=>{while(queue.length&&current(token))await readOne(queue.shift(),token);};
  await Promise.all([worker(),worker()]);if(!current(token))return;
  const latest=await apiRequest(path()+'/'+session.id);if(!current(token))return;
  reconcile(latest.session);message('Đã cập nhật nguồn. Chọn rõ buổi/phần cần chuyển; tài liệu lỗi có nút thử lại riêng.');
 }
 function readyIds(){return plan?.results.filter(r=>r.status==='ready'&&!excludedQuestions.has(r.questionId)).map(r=>r.questionId)||[];}
 function updatePlanChoice(){
  const count=readyIds().length,apply=body.querySelector('[data-docs-apply]');if(apply)apply.disabled=busy||(!count&&!pendingApply);
  const info=body.querySelector('[data-docs-selected-count]');if(info)info.textContent=`Đang chọn ${count} câu; ${plan.stats.convertedQuestions-count} câu được giảng viên loại khỏi lần thêm này.`;
 }
 function paint(){if(!body||!context)return;const top=dialog.scrollTop;body.replaceChildren();
  const explanation=el('p','Dán 1–5 link Docs, mỗi dòng một link. Phiên nguồn giữ 24 giờ; chỉ đọc cấu trúc, chưa gọi AI và chưa phát bài. Mỗi giảng viên tối đa ba lượt đọc Docs/nhập AI mỗi phút.');body.append(explanation);
  const input=el('textarea','',{rows:4,value:urls,disabled:busy||Boolean(pendingApply)});input.setAttribute('aria-label','Các link Google Docs');
  input.addEventListener('input',()=>{urls=input.value;pendingCreate=null;});body.append(input);
  const structure=el('label','',{className:'docs-batch-unit'}),preserve=el('input','',{type:'checkbox',checked:preserveParts,disabled:busy||Boolean(pendingApply)});
  preserve.setAttribute('aria-label','Giữ các phần nguồn riêng');preserve.addEventListener('change',()=>{preserveParts=preserve.checked;pendingCreate=null;});
  structure.append(preserve,el('span','Giữ mỗi phần nguồn thành phần riêng. Phần trống đang chọn được dùng cho phần nguồn đầu tiên; phần đã có câu được giữ.'));body.append(structure);
  body.append(button('Tạo phiên và đọc các tài liệu',async token=>{
   const links=urls.split(/\r?\n/u).map(v=>v.trim()).filter(Boolean);if(!links.length||links.length>5)throw Error('Dán từ 1 đến 5 link Docs, mỗi dòng một link.');
   const fresh=await refreshDraft();if(!current(token))return;context=fresh;
   pendingCreate??={documents:links.map(url=>({url})),expectedRevision:context.revision,operationId:crypto.randomUUID(),preserveSourceParts:preserveParts,...(context.targetBlockId?{targetBlockId:context.targetBlockId}:{})};
   const value=await apiRequest(path(),{method:'POST',body:pendingCreate});if(!current(token))return;
   session=null;plan=null;selectedUnits.clear();excludedQuestions.clear();readErrors.clear();pendingApply=null;reconcile(value.session);pendingCreate=null;
   message(value.deduplicatedDocuments?'Đã bỏ link trùng; đang đọc các tài liệu riêng.':'Đang đọc các tài liệu…');paint();await readPending(token);
  },busy||Boolean(pendingApply)));
  if(recent.length){const choose=el('select','',{disabled:busy});choose.setAttribute('aria-label','Phiên nhập gần đây');choose.append(el('option','Mở lại phiên nguồn đã lưu',{value:''}));
   for(const item of recent){const instant=typeof item.created_at==='string'&&/(?:Z|[+-]\d{2}:\d{2})$/u.test(item.created_at)?Date.parse(item.created_at):NaN;
    const time=Number.isFinite(instant)?new Date(instant).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'}):'Thời gian chưa xác minh';
    choose.append(el('option',`${item.documents} tài liệu · ${time}`,{value:item.id}));}
   choose.addEventListener('change',()=>{if(!choose.value)return;void act(async token=>{
    const value=await apiRequest(path()+'/'+choose.value);if(!current(token))return;session=null;plan=null;selectedUnits.clear();excludedQuestions.clear();pendingApply=null;reconcile(value.session);
    if(value.session.plan?.baseRevision===getContext()?.revision)plan=value.session.plan;
    message('Đã mở lại nguồn đã đọc. Chọn buổi/phần rồi xem trước; không cần đọc lại toàn bộ tài liệu.');});});body.append(choose);
  }
  if(!session){dialog.scrollTop=top;return;}
  const ready=session.documents.filter(d=>d.status==='ready').length,errors=session.documents.filter(d=>d.status==='error'||readErrors.has(d.documentKey)).length;
  body.append(el('p',`${ready}/${session.documents.length} tài liệu đã đọc; ${errors} tài liệu đọc lỗi. `+
   (session.preserveSourceParts?'Phiên này giữ các phần nguồn thành phần riêng.':session.targetBlockId?'Thêm vào phần: '+(context.blocks.find(b=>b.blockId===session.targetBlockId)?.title||'phần cũ — cần kiểm lại'):'Giữ các phần nguồn thành phần riêng.'),{className:errors?'notice error':'notice',role:errors?'alert':'status'}));
  body.append(button('Làm mới trạng thái phiên',async token=>{const value=await apiRequest(path()+'/'+session.id);if(current(token))reconcile(value.session);},busy));
  const sources=el('div','',{className:'docs-batch-sources'});
  for(const [index,doc]of session.documents.entries()){
   const card=el('section','',{className:'docs-batch-source'}),title=doc.catalog?.source.title||'Tài liệu '+(index+1);card.append(el('h3',title+' · '+caption[doc.status]));
   const link=el('a','Mở Docs nguồn',{href:'https://docs.google.com/document/d/'+encodeURIComponent(doc.documentId)+'/edit'+(doc.tabId?'?tab='+encodeURIComponent(doc.tabId):''),target:'_blank',rel:'noopener noreferrer'});card.append(link);
   const error=readErrors.get(doc.documentKey)||doc.error?.message;if(error)card.append(el('p',error,{className:'notice error',role:'alert'}));
   card.append(button(doc.status==='ready'?'Đọc lại riêng tài liệu này':'Thử đọc tài liệu này',async token=>{plan=null;await readOne(doc.documentKey,token);},busy||!doc.canRead||Boolean(pendingApply)));
   if(doc.catalog){card.append(el('p',`${doc.catalog.characterCount.toLocaleString('vi-VN')} ký tự · ${doc.catalog.questionCount} câu nhận dạng · ${doc.catalog.units.length} phần. Bản nguồn theo revision đã đọc.`));
    for(const warning of doc.catalog.warnings||[])card.append(el('p',warning,{className:'notice error',role:'alert'}));
    for(const region of doc.catalog.manualRegions||[]){const detail=el('details','',{className:'notice error'});detail.append(el('summary','CẦN XỬ LÝ · '+region.label));
     detail.append(el('p',`Vùng nguồn ${region.characters} ký tự chưa được chuyển thành câu. Phần trích để đối chiếu:`),el('pre',region.excerpt));card.append(detail);}
    for(const unit of doc.catalog.units){const label=el('label','',{className:'docs-batch-unit'}),check=el('input','',{type:'checkbox',checked:selectedUnits.has(unit.unitId),disabled:busy||Boolean(pendingApply)||doc.status!=='ready'});
     check.dataset.docsUnitId=unit.unitId;check.addEventListener('change',()=>{if(check.checked)selectedUnits.add(unit.unitId);else selectedUnits.delete(unit.unitId);plan=null;
      body.querySelector('[data-docs-plan]')?.replaceChildren();const preview=body.querySelector('[data-docs-preview]');if(preview)preview.disabled=!selectedUnits.size;message('Đã đổi lựa chọn; xem trước lại trước khi thêm.');});
     label.append(check,el('span',unit.label+` · ${unit.questionCount} câu`));card.append(label);}
   }sources.append(card);
  }body.append(sources);
  const previewButton=button(pendingApply?'Đọc lại nháp và xem trước lại':'Xem trước các buổi/phần đã chọn',async token=>{
   if(!selectedUnits.size)throw Error('Chọn ít nhất một buổi/phần đã đọc.');
   const fresh=await refreshDraft();if(!current(token))return;context=fresh;pendingApply=null;
   const value=await apiRequest(path()+'/'+session.id+'/preview',{method:'POST',body:{unitIds:[...selectedUnits],expectedRevision:context.revision}});
   if(!current(token))return;plan=value.plan;message('Đã tạo đề xuất theo từng câu. Kiểm cảnh báo key và loại các câu bạn chưa muốn thêm.');
  },busy||!selectedUnits.size);previewButton.dataset.docsPreview='';body.append(previewButton);
  const results=el('section','',{className:'docs-batch-plan'});results.dataset.docsPlan='';body.append(results);
  if(plan){const s=plan.stats;results.append(el('h3','Đề xuất nhập theo câu'),el('p',`Đã chọn ${s.selectedQuestions} câu: ${s.convertedQuestions} chuyển được; ${s.needsReviewQuestions} cần xử lý; `+
   `${s.alreadyImportedQuestions} đã có trong nháp; ${s.duplicateSourceQuestions} trùng nguồn.`,{className:s.needsReviewQuestions?'notice error':'notice',role:s.needsReviewQuestions?'alert':'status'}));
   if(s.incompleteDocuments)results.append(el('p',`Còn ${s.incompleteDocuments} tài liệu chưa đọc được; đề xuất này chưa bao phủ cả lô.`,{className:'notice error',role:'alert'}));
   if(s.keyProblems)results.append(el('p',`Có ${s.keyProblems} cảnh báo key thiếu/mâu thuẫn/không khớp. Giảng viên phải đối chiếu từng câu; chưa tự dùng key chấm bài.`,{className:'notice error',role:'alert'}));
   if(s.sourceKeyWarnings)results.append(el('p',`Ngoài ra có ${s.sourceKeyWarnings} vùng key nguồn chưa ghép chắc với câu/buổi; cần xem các cảnh báo nguồn bên dưới.`,{className:'notice error',role:'alert'}));
   for(const warning of plan.warnings||[])results.append(el('p',warning,{className:'notice error',role:'alert'}));
   for(const result of plan.results){const card=el('article','',{className:'docs-batch-result'}),label=el('label','',{className:'docs-batch-question'}),check=el('input','',{
     type:'checkbox',checked:result.status==='ready'&&!excludedQuestions.has(result.questionId),disabled:busy||Boolean(pendingApply)||result.status!=='ready'});
    check.dataset.docsQuestionId=result.questionId;check.addEventListener('change',()=>{if(check.checked)excludedQuestions.delete(result.questionId);else excludedQuestions.add(result.questionId);updatePlanChoice();});
    label.append(check,el('strong',result.label+' · '+resultCaption[result.status]));card.append(label,el('p',result.prompt));
    for(const warning of result.warnings||[])card.append(el('p',warning,{className:'notice error',role:'alert'}));
    for(const review of result.reviews||[])card.append(importReviewCard(review));
    if(result.unmappedText){const detail=el('details');detail.append(el('summary','Nội dung câu cần đối chiếu'),el('pre',result.unmappedText));card.append(detail);}results.append(card);
   }
   const selected=el('p');selected.dataset.docsSelectedCount='';results.append(selected);
   const apply=button(pendingApply?'Kiểm tra lại lần thêm vừa rồi':'Thêm các câu đã chọn vào nháp',async token=>{
    pendingApply??={planId:plan.planId,questionIds:readyIds(),expectedRevision:plan.baseRevision,operationId:crypto.randomUUID()};
    if(!pendingApply.questionIds.length){pendingApply=null;throw Error('Chọn ít nhất một câu đã chuyển.');}
    const reply=await apiRequest(path()+'/'+session.id+'/apply',{method:'POST',body:pendingApply});if(!current(token))return;
    pendingApply=null;plan=null;session.plan=null;session.draftRevision=reply.draft.revision;dialog.close();onApplied(reply,context);
   },busy||(!readyIds().length&&!pendingApply));authoringAction(apply,'add');apply.dataset.docsApply='';results.append(apply);
   if(pendingApply)results.append(el('p','Lần thêm trước chưa được xác nhận. Thử lại dùng cùng thao tác để tránh thêm trùng, hoặc đọc lại nháp và xem trước lại.',{className:'notice error',role:'alert'}));
   updatePlanChoice();
  }dialog.scrollTop=top;
 }
 return {
  open(){const next=getContext();if(!next)return;
   if(context?.contextKey!==next.contextKey){session=null;plan=null;urls='';recent=[];selectedUnits.clear();excludedQuestions.clear();readErrors.clear();pendingCreate=null;pendingApply=null;epoch++;busy=false;}
   context=next;
   if(!dialog){dialog=el('dialog','',{className:'thuy-management-dialog docs-batch-dialog'});const header=el('header','',{className:'docs-batch-head'}),close=el('button','×',{type:'button',className:'button'});close.setAttribute('aria-label','Đóng nhập Docs');close.addEventListener('click',()=>dialog.close());
    header.append(el('h2','Nhập file tổng hợp / nhiều Docs'),close);status=el('p','Chọn nguồn và buổi/phần trước khi thêm vào nháp.',{className:'notice'});status.setAttribute('role','status');body=el('div','',{className:'docs-batch-body'});
    dialog.append(header,status,body);document.body.append(dialog);bindDialogDismiss(dialog);}
   paint();if(!dialog.open)dialog.showModal();void act(async token=>{const value=await apiRequest(path());if(!current(token))return;recent=value.sessions||[];
    if(session){const id=session.id,latest=await apiRequest(path()+'/'+id);if(current(token)&&session?.id===id)reconcile(latest.session);}});
  },
  dispose(){epoch++;dialog?.remove();dialog=body=status=context=session=plan=null;urls='';recent=[];busy=false;pendingCreate=pendingApply=null;selectedUnits.clear();excludedQuestions.clear();readErrors.clear();}
 };
}

import {appendFeedback,criterionModel,sameFeedback,element as el} from './writing-feedback.mjs';

const views=new WeakMap();
const band=value=>value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value))?Number(value).toFixed(1):'—';
const nonempty=value=>value!==null&&value!==undefined&&value!=='';
const list=value=>Array.isArray(value)?value:[];
function reference(value){const text=String(value||'').trim();if(text.startsWith('#')){try{return decodeURIComponent(text).toLowerCase();}catch{return text.toLowerCase();}}try{return new URL(text).href;}catch{return text;}}
function register(map,key,value){const ref=reference(key);if(!ref)return;if(map.has(ref)&&map.get(ref)!==value)map.set(ref,null);else map.set(ref,value);}
function bindLink(link,callback){const activate=event=>{event.preventDefault();callback();};link.addEventListener('click',activate);link.addEventListener('auxclick',event=>{if(event.button===1)activate(event);});}
function taskCriteria(task){const value=task.browserResult?.criteria??task.criteria;return list(value).filter(c=>c&&typeof c==='object').map(criterionModel);}
function taskDetails(task){const value=task.browserResult?.details??task.details??[];return Array.isArray(value)?value:Object.entries(value).map(([key,data])=>typeof data==='string'?{code:key,markdown:data}:{code:key,...data});}
function createDialog(){
 const dialog=el('dialog',undefined,'writing-detail-dialog');dialog.setAttribute('aria-labelledby','writing-detail-title');dialog.setAttribute('aria-describedby','writing-detail-context');
 const shell=el('div',undefined,'writing-detail-shell'),header=el('header',undefined,'writing-detail-head'),copy=el('div'),context=el('p',undefined,'writing-detail-context'),title=el('h2'),close=el('button','×','writing-detail-close'),body=el('div',undefined,'writing-detail-body writing-feedback-richtext'),footer=el('footer','Phân tích chi tiết của mục bạn đang xem.','writing-detail-footer');context.id='writing-detail-context';title.id='writing-detail-title';close.type='button';close.setAttribute('aria-label','Đóng phân tích chi tiết');copy.append(context,title);header.append(copy,close);shell.append(header,body,footer);dialog.append(shell);document.body.append(dialog);let opener=null,disposed=false;
 close.addEventListener('click',()=>dialog.close());dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();});dialog.addEventListener('close',()=>{if(!disposed&&opener?.isConnected)opener.focus({preventScroll:true});});
 return{
  open(entry,source,onLink){if(disposed)return;opener=source;context.textContent=(entry.criterionName?entry.criterionName+' · ':'')+'Task '+entry.taskNumber;title.textContent=String(entry.title||'Phân tích chi tiết').replace(/^\d+[.)]\s*/,'');body.replaceChildren();dialog.dataset.taskNumber=String(entry.taskNumber);dialog.dataset.componentKey=entry.key||'';
   if(entry.missing){body.append(el('p','Chưa tìm thấy nội dung của liên kết này trong kết quả đã nhận. Bạn không cần nộp hoặc chấm lại bài; hãy liên hệ giảng viên để kiểm tra phần nhận xét.'));}
   else{const detail=entry.detail||'',extras=entry.extras||{};if(nonempty(detail))appendFeedback(body,detail,{onLink});for(const[key,value]of Object.entries(extras))if(nonempty(value)&&!sameFeedback(detail,value))appendFeedback(body,{[key]:value},{onLink});if(!body.childNodes.length)appendFeedback(body,entry.summary||'Chưa có nội dung nhận xét cho mục này.',{onLink});}
   body.scrollTop=0;if(!dialog.open)dialog.showModal();close.focus({preventScroll:true});
  },
  dispose(){disposed=true;if(dialog.open)dialog.close();dialog.remove();opener=null;}
 };
}
function sourcePane(task,options){
 const number=Number(task.taskNumber),config=list(options.writingConfig?.tasks).find(t=>Number(t.taskNumber??String(t.id).match(/[12]/)?.[0])===number),id=config?.id||'task'+number,essay=typeof options.drafts?.[id]==='string'?options.drafts[id]:'',pane=el('aside',undefined,'writing-source-paper'),header=el('header',undefined,'writing-source-head');header.append(el('h3','Đề bài và bài viết'),el('span','Task '+number));pane.append(header);const body=el('div',undefined,'writing-source-scroll');
 if(config?.prompt){body.append(el('p','Đề bài','writing-source-label'),el('div',config.prompt,'writing-source-prompt'));if(config.followUp)body.append(el('p',config.followUp,'writing-source-followup'));}
 if(number===1&&config?.image){const value=typeof config.image==='object'?config.image.src:config.image;try{const url=new URL(value,document.baseURI);if(url.origin===location.origin||/^data:image\/(?:png|jpeg|webp|gif);base64,/i.test(url.href)){const image=el('img');image.src=url.href;image.alt=typeof config.image==='object'&&config.image.alt?config.image.alt:'Hình minh họa Writing Task 1';image.className='writing-source-image';body.append(image);}}catch{}}
 const essayHead=el('div',undefined,'writing-source-essay-head');essayHead.append(el('h4','Bài viết của học viên'));if(essay.trim())essayHead.append(el('span',essay.trim().split(/\s+/u).length+' từ'));body.append(essayHead);const writing=el('div',undefined,'writing-source-essay');writing.lang='en';if(essay.trim())for(const paragraph of essay.split(/\n{2,}/))writing.append(el('p',paragraph));else writing.append(el('p','Không có nội dung bài viết trên thiết bị này. Điểm và nhận xét đã nhận vẫn được giữ.','writing-source-empty'));body.append(writing);pane.append(body);return pane;
}
function componentView(item,index,open,onLink,resolve){
 const section=el('section',undefined,'writing-feedback-component'),heading=el('h5',/^\d+[.)]\s/.test(item.title)?item.title:(index+1)+'. '+item.title);section.append(heading);const summary=el('div',undefined,'writing-component-summary writing-feedback-richtext');if(nonempty(item.summary))appendFeedback(summary,item.summary,{onLink});else if(!item.hasDetail&&nonempty(item.detail))appendFeedback(summary,item.detail,{onLink});section.append(summary);
 const ownRefs=new Set(['#'+item.key,...(item.aliases||[]).map(key=>'#'+key),...(item.urls||[])].map(reference)),linked=[...summary.querySelectorAll('[data-feedback-href]')].some(a=>ownRefs.has(reference(a.dataset.feedbackHref))&&resolve(a.dataset.feedbackHref)===item);
 if(item.hasDetail&&!linked){const link=el('a','Xem phân tích chi tiết và cách sửa','writing-detail-link');link.href='#'+item.key;link.dataset.feedbackHref='#'+item.key;link.setAttribute('aria-haspopup','dialog');link.setAttribute('aria-label','Xem phân tích: '+item.title);bindLink(link,()=>open(item,link));section.append(link);}
 return section;
}
function criterionView(model,index,open,onLink,resolve){
 const card=el('section',undefined,'writing-criterion-card'),header=el('header',undefined,'writing-criterion-heading'),name=el('div',undefined,'writing-criterion-name'),score=el('span',band(model.band),'writing-criterion-score');name.append(el('span',String(index+1).padStart(2,'0'),'writing-criterion-number'),el('h4',model.name));score.append(el('small',' / 9'));header.append(name,score);card.append(header);const body=el('div',undefined,'writing-criterion-content');
 if(nonempty(model.intro)){const intro=el('div',undefined,'writing-feedback-richtext writing-criterion-intro');appendFeedback(intro,model.intro,{onLink});body.append(intro);}
 model.items.forEach((item,i)=>body.append(componentView(item,i,open,onLink,resolve)));
 if(nonempty(model.conclusion)){const conclusion=el('div',undefined,'writing-criterion-conclusion writing-feedback-richtext');conclusion.append(el('strong','Kết luận · '));appendFeedback(conclusion,model.conclusion,{onLink});body.append(conclusion);}
 if(Object.keys(model.extra).length){const link=el('a','Xem nhận xét bổ sung','writing-detail-link writing-extra-link');link.href='#'+model.code.toLowerCase()+'_extra';link.setAttribute('aria-haspopup','dialog');bindLink(link,()=>open({key:model.code.toLowerCase()+'_extra',title:'Nhận xét bổ sung',criterionName:model.name,extras:model.extra},link));body.append(link);}
 if(!body.childNodes.length)body.append(el('p','Chưa có nội dung nhận xét cho tiêu chí này.','writing-empty-feedback'));card.append(body);return card;
}
export function renderCompleteWritingResult(target,result,options={}){
 views.get(target)?.();const dialog=createDialog(),fragment=document.createDocumentFragment(),tasks=list(result.tasks).slice().sort((a,b)=>Number(a.taskNumber)-Number(b.taskNumber));
 if(options.overviewTarget){options.overviewTarget.replaceChildren();const models=tasks.length===1?taskCriteria(tasks[0]):[];options.overviewTarget.hidden=!models.length;for(const model of models){const score=el('div',undefined,'writing-mini-score');score.append(el('span',model.name),el('strong',band(model.band)));options.overviewTarget.append(score);}}
 for(const task of tasks){
  const number=Number(task.taskNumber),section=el('section',undefined,'writing-task-result');section.dataset.taskNumber=String(number);if(tasks.length>1)section.append(el('h3','Task '+number+' · '+band(task.taskScore)+' / 9','writing-task-result-title'));const workspace=el('div',undefined,'writing-result-workspace'),feedback=el('section',undefined,'writing-task-feedback'),heading=el('header',undefined,'writing-task-feedback-head');heading.append(el('h3','Nhận xét theo tiêu chí'),el('p','Bấm vào liên kết dưới mỗi nhận xét để xem phân tích chi tiết và cách sửa.'));feedback.append(heading);const models=taskCriteria(task),registry=new Map(),extraDetails=[];
  const open=(entry,opener)=>dialog.open({...entry,taskNumber:number},opener,onLink),onLink=(href,label,opener)=>{const entry=registry.get(reference(href));open(entry||{missing:true,title:'Phân tích chi tiết',key:href},opener);};
  for(const model of models)for(const item of model.items){item.criterionName=model.name;for(const key of new Set([item.key,...(item.aliases||[])]))register(registry,'#'+key,item);for(const url of item.urls)register(registry,url,item);}
  for(const[detailIndex,detail]of taskDetails(task).entries()){if(!detail||typeof detail!=='object')continue;const key=detail.stageKey?'task1-stage-'+detail.stageKey:detail.code||detail.id||'detail_'+detailIndex,entry={key,title:detail.name||detail.label||'Phân tích chi tiết',detail:detail.markdown??detail.feedback??detail.content??detail.body??'',extras:{},summary:detail.summary||''};register(registry,'#'+key,entry);if(detail.url)register(registry,detail.url,entry);extraDetails.push({entry,refs:['#'+key,detail.url].filter(Boolean)});}
  if(task.gradingMethod==='blank_rule')feedback.append(el('p','Task để trống khi hết giờ. Áp dụng quy tắc bài trống của đề gốc.','writing-blank-result'));
  if(models.length)models.forEach((model,i)=>feedback.append(criterionView(model,i,open,onLink,href=>registry.get(reference(href)))));
  else{const report=task.report?.html??task.browserResult?.report??task.report;if(nonempty(report)){const fallback=el('div',undefined,'writing-feedback-richtext writing-report-fallback');appendFeedback(fallback,report,{onLink});feedback.append(fallback);}else if(task.gradingMethod!=='blank_rule')feedback.append(el('p','Chưa có nội dung nhận xét.'));}
  // report tổng hợp không được trải lại khi tiêu chí đã có; phần chi tiết Task 1
  // giữ theo URL/stageKey riêng, kể cả bộ chấm không chèn link vào nhận xét.
  const referenced=new Set([...feedback.querySelectorAll('[data-feedback-href]')].map(a=>reference(a.dataset.feedbackHref))),unlinked=extraDetails.filter(d=>!d.refs.some(ref=>referenced.has(reference(ref))));
  // Gắn khối chi tiết chưa được trỏ tới sau các tiêu chí để mọi phân tích đều còn đường đọc.
  if(unlinked.length){const more=el('section',undefined,'writing-task-extra-details');more.append(el('h4','Phân tích bổ sung'));for(const{entry}of unlinked){const link=el('a',entry.title,'writing-detail-link');link.href='#'+entry.key;link.setAttribute('aria-haspopup','dialog');bindLink(link,()=>open(entry,link));more.append(link);}feedback.append(more);}
  workspace.append(sourcePane(task,options),feedback);section.append(workspace);fragment.append(section);
 }
 target.replaceChildren(fragment);const dispose=()=>dialog.dispose();views.set(target,dispose);return dispose;
}

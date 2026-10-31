// Nhận payload/ID thật của câu, trả vị trí trường; không dò thông báo tiếng Việt để đoán lỗi.
export function collectPublishIssues({definition,gradingKey}){
 const issues=[],add=(field,item,extra={})=>issues.push({field,itemVersionId:item?.itemVersionId,...extra,message:'Cần bổ sung thông tin này'});
 if(!definition.title?.trim())add('title');
 if(!definition.courseCode)add('courseCode');
 for(const block of definition.blocks){
  if(!block.title?.trim())add('blockTitle',null,{blockId:block.blockId});
  if(!block.items.length)add('items',null,{blockId:block.blockId});
  for(const item of block.items){
   if(!item.prompt?.trim())add('prompt',item);
   if(!item.skillCodes?.length)add('skillCodes',item);
   for(const option of item.options||[])if(!option.label?.trim())add('option',item,{optionId:option.id});
   const key=gradingKey.items?.[item.itemVersionId];
   if(item.graderType==='accepted_text_sequence')for(let slot=0;slot<(item.interactionConfig.responseCount||0);slot++){
    if(!key?.acceptedBySlot?.[slot]?.some(s=>s.trim()))add('answer',item,{slot,blankId:item.interactionConfig.blankIds?.[slot]});
   }else if(item.graderType!=='none'&&!key)add('answer',item);
   for(const rows of Object.values(gradingKey.authoringState?.[item.itemVersionId]?.answerRows||{}))for(const row of rows)if(!row.value.trim())add('answer',item,{rowId:row.id});
  }
 }
 return issues;
}
export function schemaFieldIssues(issues,definition){
 return (issues||[]).map(issue=>{
  if(issue.field)return issue;
  const path=issue.path||[],bi=path.indexOf('blocks'),ii=path.indexOf('items'),oi=path.indexOf('options');
  const block=bi<0?null:definition.blocks[path[bi+1]],item=block&&ii>bi?block.items[path[ii+1]]:ii>=0?definition.blocks.flatMap(b=>b.items).find(i=>i.itemVersionId===path[ii+1]):null;
  const field=oi>=0?'option':ii>=0&&item?(path.includes('skillCodes')?'skillCodes':path.includes('prompt')?'prompt':path.includes('max')?'config.max':'answer'):bi>=0?'blockTitle':path.includes('courseCode')?'courseCode':path.includes('title')?'title':null;
  const si=path.indexOf('acceptedBySlot'),slot=si>=0?path[si+1]:undefined;
  return {...issue,field,blockId:block?.blockId,itemVersionId:item?.itemVersionId,slot,blankId:slot!=null?item?.interactionConfig.blankIds?.[slot]:undefined,optionId:oi>=0?item?.options[path[oi+1]]?.id:undefined};
 }).filter(issue=>issue.field);
}
const bindings=new WeakMap();
export function showAuthoringIssues(root,issues,{focus=false,getIssues}={}){
 bindings.get(root)?.abort();const controller=new AbortController();bindings.set(root,controller);
 for(const e of root.querySelectorAll('.thuy-field-error'))e.remove();
 for(const e of root.querySelectorAll('[data-validation-error]')){e.removeAttribute('aria-invalid');e.removeAttribute('data-validation-error');e.removeAttribute('aria-errormessage');}
 let first;
 for(const [index,issue]of issues.entries()){
  const card=issue.itemVersionId?root.querySelector('[data-question="'+CSS.escape(issue.itemVersionId)+'"]'):issue.blockId?root.querySelector('[data-block="'+CSS.escape(issue.blockId)+'"]'):root;
  if(!card)continue;
  const exact=issue.rowId?'[data-answer-row="'+CSS.escape(issue.rowId)+'"]':issue.blankId?'[data-blank-group="'+CSS.escape(issue.blankId)+'"] input':issue.optionId?'[data-option="'+CSS.escape(issue.optionId)+'"]':'[data-validation-field="'+CSS.escape(issue.field)+'"]';
  const input=card.querySelector(exact)||(issue.slot!=null?card.querySelectorAll('.thuy-answer-group input')[issue.slot]:null)||card.querySelector('input,textarea,select')||card;
  if(input.dataset.validationError)continue;
  const message=document.createElement('p');message.className='thuy-field-error';message.id='authoring-error-'+index;message.textContent=issue.message==='Cần bổ sung thông tin này'||issue.code==='too_small'?'Cần bổ sung thông tin này':issue.message||'Cần bổ sung thông tin này';
  input.setAttribute('aria-invalid','true');input.setAttribute('aria-errormessage',message.id);input.dataset.validationError='true';
  input.after(message);for(let e=input.parentElement;e&&e!==root;e=e.parentElement)if(e.tagName==='DETAILS')e.open=true;
  const clear=()=>{
   const same=other=>['field','itemVersionId','optionId','rowId','blankId','slot'].every(key=>other[key]===issue[key]);
   if(getIssues?getIssues().some(same):!input.value?.trim())return;
   message.remove();input.removeAttribute('aria-invalid');input.removeAttribute('aria-errormessage');delete input.dataset.validationError;
  };
  input.addEventListener('input',clear,{signal:controller.signal});
  if(issue.field==='answer')card.addEventListener('change',clear,{signal:controller.signal});
  first??=input.matches('input,textarea,select,[contenteditable=true]')?input:card.querySelector('input,textarea,select')||input;
 }
 if(focus&&first)requestAnimationFrame(()=>{first.scrollIntoView({block:'center'});first.focus({preventScroll:true});});
 return first;
}

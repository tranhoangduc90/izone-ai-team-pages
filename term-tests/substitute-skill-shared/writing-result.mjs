import {appendSafeWritingFeedback} from './native-writing.mjs';

const names={TA:'Task Achievement',TR:'Task Response',CC:'Coherence & Cohesion',LR:'Lexical Resource',GRA:'Grammatical Range & Accuracy'};
const labels={summary:'Nhận xét tổng hợp',feedback:'Nhận xét chi tiết',body:'Phân tích',conclusion:'Kết luận',strengths:'Điểm tốt',improvements:'Điểm cần cải thiện',examples:'Ví dụ',analysis:'Phân tích',recommendations:'Gợi ý cải thiện',score:'Điểm',bandScore:'Điểm'};
const aliases={'TASK ACHIEVEMENT':'TA','TASK RESPONSE':'TR','COHERENCE & COHESION':'CC','COHERENCE AND COHESION':'CC','LEXICAL RESOURCE':'LR','GRAMMATICAL RANGE & ACCURACY':'GRA','GRAMMATICAL RANGE AND ACCURACY':'GRA'};
const el=(tag,className,text)=>{const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;};
const band=value=>value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value))?Number(value).toFixed(1):'—';
const rawText=value=>typeof value==='string'?value:JSON.stringify(value??'');

// Chỉ tách tại tiêu đề tiêu chí khớp chính xác; mọi dòng còn lại được giữ.
// Báo cáo HTML/không có tiêu đề chuẩn vẫn hiện đầy đủ trong phần tổng hợp.
function reportParts(value){
 const text=typeof value==='string'?value:'';
 if(/<\/?[a-z][^>]*>/i.test(text)){
  const safe=el('div');appendSafeWritingFeedback(safe,text,{preserveContent:true,linksAsText:true});
  const nodes=[];const collect=node=>{if(node.nodeType===1&&node.tagName==='DIV')for(const child of node.childNodes)collect(child);else nodes.push(node);};for(const node of safe.childNodes)collect(node);
  const criteria={};let intro='',code=null;
  for(const node of nodes){const next=node.nodeType===1&&/^H[1-6]$/.test(node.tagName)?aliases[node.textContent.trim().toUpperCase()]:null;
   if(next){code=next;criteria[code]??='';continue;}
   const holder=el('div');holder.append(node.cloneNode(true));const html=holder.innerHTML;
   if(code)criteria[code]+=html;else intro+=html;
  }
  return {intro,criteria};
 }
 const criteria={};let intro='',code=null;
 for(const line of text.split('\n')){
  const heading=/^\s*#{1,6}\s+(.+?)\s*#*\s*$/.exec(line),title=heading?.[1].replace(/\*\*/g,'').trim().toUpperCase(),next=aliases[title];
  if(next){code=next;criteria[code]??='';continue;}
  if(code)criteria[code]+=line+'\n';else intro+=line+'\n';
 }
 return {intro:intro.trim(),criteria};
}

function appendValue(parent,value){
 if(value===null||value===undefined||value==='')return;
 if(typeof value!=='object'){
  appendSafeWritingFeedback(parent,String(value),{preserveContent:true,linksAsText:true});return;
 }
 if(Array.isArray(value)){for(const item of value)appendValue(parent,item);return;}
 for(const[key,item]of Object.entries(value)){
  if(item===null||item===undefined||item==='')continue;
  const group=el('section','writing-feedback-field');group.append(el('h5','',labels[key]??key));appendValue(group,item);parent.append(group);
 }
}

function appendCriterion(parent,criterion,report,index){
 const code=criterion.code??criterion.key,card=el('section','writing-criterion-card'),header=el('header','writing-criterion-heading'),title=el('div','writing-criterion-name');
 title.append(el('span','writing-criterion-number',String(index+1).padStart(2,'0')),el('h4','',criterion.name||names[code]||String(code||'Tiêu chí')));
 const score=el('span','writing-criterion-score',band(criterion.bandScore??criterion.score));score.append(el('small','',' / 9'));header.append(title,score);card.append(header);
 const body=el('div','writing-criterion-content writing-feedback-richtext');
 if(report)appendValue(body,report);
 const feedback=criterion.feedback;
 if(feedback&&!report?.includes(rawText(feedback)))appendValue(body,feedback);
 const components=criterion.components==null?[]:Array.isArray(criterion.components)?criterion.components:[criterion.components];
 for(const component of components){
  if(component===null||typeof component!=='object'){appendValue(body,component);continue;}
  const section=el('section','writing-feedback-component');let content=false;
  for(const[key,value]of Object.entries(component)){
   if(['label','code'].includes(key)||value===null||value===undefined||value==='')continue;
   // Bỏ đúng bản sao đã có nguyên văn ở trên, không rút gọn một phần nhận xét.
   if(typeof value==='string'&&[report,typeof feedback==='string'?feedback:''].some(text=>text?.includes(value)))continue;
   if(!content){section.append(el('h5','',component.label||component.code||'Phân tích thành phần'));content=true;}
   if(!['summary','feedback'].includes(key))section.append(el('h5','',labels[key]??key));
   appendValue(section,value);
  }
  if(content)body.append(section);
 }
 for(const[key,value]of Object.entries(criterion))if(!['code','key','name','bandScore','score','feedback','components'].includes(key)){
  const extra=el('section','writing-feedback-field');extra.append(el('h5','',labels[key]??key));appendValue(extra,value);body.append(extra);
 }
 if(!body.childNodes.length)body.append(el('p','','Chưa có nội dung nhận xét cho tiêu chí này.'));
 card.append(body);parent.append(card);
}

export function renderCompleteWritingResult(target,result){
 const fragment=document.createDocumentFragment(),tasks=Array.from(result.tasks??[]).sort((a,b)=>a.taskNumber-b.taskNumber);
 for(const task of tasks){
  const section=el('section','writing-task-result');section.dataset.taskNumber=String(task.taskNumber);
  if(tasks.length>1)section.append(el('h3','writing-task-result-title',`Task ${task.taskNumber} · ${band(task.taskScore)} / 9`));
  if(task.gradingMethod==='blank_rule'){
   section.append(el('p','','Task để trống khi hết giờ. Áp dụng quy tắc bài trống của đề gốc.'));appendValue(section,task.report?.html??task.report);fragment.append(section);continue;
  }
  const report=task.report?.html??task.browserResult?.report??task.report??'',parts=reportParts(report),criteria=task.browserResult?.criteria??task.criteria??[];
  if(parts.intro){const intro=el('section','writing-report-summary writing-feedback-richtext');intro.append(el('h3','writing-report-title','Nhận xét tổng hợp'));appendValue(intro,parts.intro);section.append(intro);}
  else if(report&&typeof report!=='string')appendValue(section,report);
  const consumed=new Set();criteria.forEach((criterion,index)=>{const code=criterion.code??criterion.key;consumed.add(code);appendCriterion(section,criterion,parts.criteria[code],index);});
  let extraIndex=criteria.length;for(const[code,text]of Object.entries(parts.criteria))if(!consumed.has(code))appendCriterion(section,{code},text,extraIndex++);
  if(!section.childNodes.length)section.append(el('p','','Chưa có nội dung nhận xét.'));
  fragment.append(section);
 }
 target.replaceChildren(fragment);
}

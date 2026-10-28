import {insertBlank,removeBlank} from './authoring-parts.js?rev=20261028-the15-v1';
import {ensureBlankIds,answerValues,answerRows,syncAnswerRows} from './authoring-answers.js?rev=20261028-the15-v1';
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
const button=(text,action)=>{const n=el('button',text,'button');n.type='button';n.addEventListener('click',action);return n;};
const histories=new WeakMap(),privateFields=['items','referenceAnswers','referenceAnswersBySlot','savedExerciseKeys','authoringState'];
const snapshot=(item,key)=>({item:structuredClone(item),key:Object.fromEntries(privateFields.map(name=>[name,structuredClone(key[name]?.[item.itemVersionId])]))});
function prepareAnswers(item,key){ensureBlankIds(item,key);for(let slot=0;slot<(item.interactionConfig.responseCount||1);slot++)answerRows(item,key,item.graderType==='none'?'survey':'exercise',slot);}
function restore(item,key,value){const id=item.itemVersionId;for(const name of Object.keys(item))delete item[name];Object.assign(item,structuredClone(value.item));for(const name of privateFields){if(value.key[name]===undefined)delete key[name]?.[id];else{key[name]??={};key[name][id]=structuredClone(value.key[name]);}}}
function commit(item,key,action){
 prepareAnswers(item,key);
 const before=snapshot(item,key),signature=JSON.stringify(before);let history=histories.get(item);
 if(!history||JSON.stringify(history.values[history.index])!==signature){history={values:[before],index:0};histories.set(item,history);}
 try{action();prepareAnswers(item,key);}catch(error){restore(item,key,before);throw error;}
 const after=snapshot(item,key);if(JSON.stringify(after)===signature)return;
 history.values.splice(history.index+1);history.values.push(after);if(history.values.length>30)history.values.shift();history.index=history.values.length-1;
}
function undo(item,key,redo=false){const h=histories.get(item);if(h&&JSON.stringify(snapshot(item,key))!==JSON.stringify(h.values[h.index])){histories.delete(item);return false;}const next=h&&(h.index+(redo?1:-1));if(!h||next<0||next>=h.values.length)return false;h.index=next;restore(item,key,h.values[next]);return true;}

function renderAnswerGroups(host,{item,key,kind,readonly,onChange,onStructure,onError}){
 host.replaceChildren();if(!readonly)ensureBlankIds(item,key);
 const ids=item.interactionConfig.blankIds||[],count=item.interactionConfig.responseCount||1;
 for(let slot=0;slot<count;slot++){
  const blankId=ids[slot]||(count>1?'slot-'+slot:'answer'),group=el('section',undefined,'thuy-answer-group');group.dataset.blankGroup=blankId;
  const top=el('div',undefined,'thuy-answer-group-head'),title=el('h4',ids.length?'Ô trống '+(slot+1):kind==='survey'?'Đáp án tham khảo':'Đáp án chấp nhận');top.append(title);
  const source=key.authoringState?.[item.itemVersionId]?.sources?.[blankId];if(source!==undefined)top.append(el('small',source,'thuy-gap-source'));
  if(ids.length&&item.interactionConfig.sentenceLines&&!readonly){
   const remove=button('Bỏ ô',()=>{try{commit(item,key,()=>{
    let cursor=slot,lineIndex=0;for(const line of item.interactionConfig.sentenceLines){if(cursor<line.parts.length-1)break;cursor-=line.parts.length-1;lineIndex++;}
    removeBlank(item,key,{lineIndex,partIndex:cursor,kind});
   });onChange();onStructure();}catch(error){onError(error.message);}});remove.setAttribute('aria-label','Bỏ ô trống '+(slot+1)+' câu '+item.position);top.append(remove);
  }group.append(top);
  const rows=readonly?(key.authoringState?.[item.itemVersionId]?.answerRows?.[blankId]||answerValues(item,key,kind,slot).map((value,i)=>({id:'readonly-'+item.itemVersionId+'-'+slot+'-'+i,value}))):answerRows(item,key,kind,slot);
  rows.forEach((row,index)=>{
   const line=el('div',undefined,'thuy-answer-row'),field=el('div',undefined,'thuy-answer-field'),input=el('input'),error=el('p','Hãy nhập đáp án hoặc bỏ ô đáp án này.','thuy-answer-error');
   input.type='text';input.value=row.value;input.maxLength=300;input.disabled=readonly;input.dataset.answerRow=row.id;
   input.setAttribute('aria-label','Đáp án '+(index+1)+' '+(ids.length?'ô '+(slot+1)+' ':'')+'câu '+item.position);
   error.id='answer-error-'+row.id;error.hidden=true;error.setAttribute('aria-live','polite');input.setAttribute('aria-describedby',error.id);
   let touched=Boolean(row.touched);const check=()=>{const bad=touched&&!input.value.trim();error.hidden=!bad;input.setAttribute('aria-invalid',String(bad));};check();
   input.addEventListener('input',()=>{commit(item,key,()=>{row.value=input.value;syncAnswerRows(item,key,kind);});check();onChange();});
   input.addEventListener('blur',()=>{if(readonly)return;commit(item,key,()=>{row.touched=true;});touched=true;check();onChange();});field.append(input,error);line.append(field);
   if(!readonly&&(rows.length>1||kind==='survey')){
    const remove=button('Bỏ đáp án',()=>{commit(item,key,()=>{rows.splice(index,1);syncAnswerRows(item,key,kind);});onChange();onStructure();});remove.setAttribute('aria-label','Bỏ đáp án '+(index+1)+' '+(ids.length?'ô '+(slot+1)+' ':'')+'câu '+item.position);line.append(remove);
   }
   if(index===rows.length-1&&!readonly){const add=button('Thêm đáp án',()=>addRow());add.disabled=rows.length>=40;line.append(add);}group.append(line);
  });
  function addRow(){
   let rowId;commit(item,key,()=>{rowId=crypto.randomUUID();rows.push({id:rowId,value:''});syncAnswerRows(item,key,kind);});onChange();onStructure();
   host.querySelector('[data-answer-row="'+rowId+'"]')?.focus({preventScroll:true});
  }
  if(!rows.length){group.append(el('p',kind==='survey'?'Chưa thêm đáp án tham khảo.':'Chưa nhập đáp án.','help'));if(!readonly)group.append(button('Thêm đáp án',addRow));}
  host.append(group);
 }
}

// Một vùng soạn liên tục. Mã ô là token không chỉnh trực tiếp; Bỏ ô giữ chữ gốc và key cùng nhau.
export function mountGapAuthoring(parent,{item,key,kind,readonly=false,onChange=()=>{},onError=()=>{}}){
 const controller=new AbortController(),opts={signal:controller.signal},widget=el('div',undefined,'thuy-gap-authoring'),sentenceField=el('label',undefined,'field');
 const caption=el('span','Nội dung câu hỏi'),editor=el('div',undefined,'thuy-gap-text');editor.contentEditable=String(!readonly);editor.setAttribute('role','textbox');editor.setAttribute('aria-multiline','true');editor.setAttribute('aria-label','Nội dung câu hỏi');
 sentenceField.append(caption,editor);const instructions=el('label',undefined,'field'),instructionInput=el('textarea');instructions.append(el('span','Yêu cầu của câu hỏi'),instructionInput);instructionInput.setAttribute('aria-label','Yêu cầu câu '+item.position);instructionInput.disabled=readonly;instructionInput.maxLength=2000;
 const notice=el('p','','help'),answers=el('div',undefined,'thuy-answer-groups'),popup=button('Tạo chỗ trống',createBlank);popup.classList.add('thuy-selection-popup');popup.hidden=true;popup.disabled=readonly;popup.setAttribute('aria-label','Tạo chỗ trống câu '+item.position);
 widget.append(instructions,sentenceField,notice,popup,answers);parent.append(widget);let selected=null,composing=false,busy=false;
 const fail=message=>{notice.textContent=message;onError(message);};
 function refresh(){
  selected=null;popup.hidden=true;if(!readonly)ensureBlankIds(item,key);
  const config=item.interactionConfig,lines=config.sentenceLines||[{title:'',parts:[item.prompt]}],state=key.authoringState?.[item.itemVersionId];let slot=0;
  instructions.hidden=!config.sentenceLines;instructionInput.value=config.sentenceLines?item.prompt:'';editor.replaceChildren();
  for(const [lineIndex,line]of lines.entries()){
   const row=el('div',undefined,'thuy-gap-line');row.dataset.line=String(lineIndex);
   if(line.title){const title=el('span',line.title+' ','thuy-gap-line-title');title.contentEditable='false';row.append(title);}
   for(const [partIndex,text]of line.parts.entries()){
    const part=el('span',text,'thuy-gap-segment');part.dataset.line=String(lineIndex);part.dataset.part=String(partIndex);row.append(part);
    if(partIndex<line.parts.length-1){const id=config.blankIds?.[slot],number=++slot,chip=el('span',undefined,'thuy-gap-chip');chip.contentEditable='false';chip.dataset.blankId=id||String(number);chip.tabIndex=0;chip.setAttribute('role','button');chip.setAttribute('aria-label','Ô trống '+number+' câu '+item.position);
     chip.append(el('b',String(number)),el('span',state?.sources?.[id]??'Ô trống '+number));
     const focus=()=>{const target=answers.querySelector('[data-blank-group="'+id+'"]');target?.scrollIntoView({block:'nearest'});target?.querySelector('input')?.focus({preventScroll:true});};chip.addEventListener('click',focus);chip.addEventListener('keydown',event=>{if(['Enter',' '].includes(event.key)){event.preventDefault();focus();}});row.append(chip);
    }
   }editor.append(row);
  }
  renderAnswerGroups(answers,{item,key,kind,readonly,onChange,onStructure:refresh,onError:fail});
 }
 function segmentFor(node){return (node?.nodeType===Node.ELEMENT_NODE?node:node?.parentElement)?.closest('.thuy-gap-segment');}
 function point(node,offset,end=false){
  const own=segmentFor(node);if(own&&editor.contains(own))return {node,offset,segment:own};
  if(node?.nodeType!==Node.ELEMENT_NODE||!(node===editor||editor.contains(node)))return null;
  const next=node.childNodes[offset],previous=node.childNodes[offset-1];
  const first=child=>child?.matches?.('.thuy-gap-segment')?child:child?.querySelector?.('.thuy-gap-segment');
  const last=child=>child?.matches?.('.thuy-gap-segment')?child:[...(child?.querySelectorAll?.('.thuy-gap-segment')||[])].at(-1);
  const segment=(end?last(previous):first(next))||last(previous)||first(next);if(!segment)return null;
  const atEnd=segment===last(previous);return {node:segment,offset:atEnd?segment.childNodes.length:0,segment};
 }
 function rangeInfo(){
  const selection=getSelection();if(!selection?.rangeCount)return null;const original=selection.getRangeAt(0),startPoint=point(original.startContainer,original.startOffset),endPoint=original.collapsed?startPoint:point(original.endContainer,original.endOffset,true);
  if(!startPoint||!endPoint||startPoint.segment!==endPoint.segment)return null;
  const segment=startPoint.segment,range=original.cloneRange();range.setStart(startPoint.node,startPoint.offset);range.setEnd(endPoint.node,endPoint.offset);
  const prefix=range.cloneRange();prefix.selectNodeContents(segment);prefix.setEnd(range.startContainer,range.startOffset);const start=prefix.toString().length;
  return {range:range.cloneRange(),segment,start,end:start+range.toString().length,lineIndex:Number(segment.dataset.line),partIndex:Number(segment.dataset.part)};
 }
 function select(){
  if(readonly||busy||composing){popup.hidden=true;return;}const info=rangeInfo();selected=info&&info.end>info.start&&info.range.toString().trim()?info:null;popup.hidden=!selected;
  if(!selected)return;const rect=[...selected.range.getClientRects()].find(r=>r.width)||selected.range.getBoundingClientRect();
  const width=popup.offsetWidth,height=popup.offsetHeight;popup.style.left=Math.max(8,Math.min(rect.left,innerWidth-width-8))+'px';popup.style.top=(rect.top-height-6>=8?rect.top-height-6:Math.min(rect.bottom+6,innerHeight-height-8))+'px';
 }
 function createBlank(){
  if(!selected||readonly||busy)return;const range=selected;
  try{commit(item,key,()=>insertBlank(item,key,{lineIndex:range.lineIndex,partIndex:range.partIndex,start:range.start,end:range.end,kind}));notice.textContent='';onChange();refresh();focusText();}
  catch(error){fail(error.message);}
 }
 function syncText(){
  if(readonly||busy)return;
  if(!item.interactionConfig.sentenceLines&&!editor.querySelector('.thuy-gap-segment')){
   const text=editor.innerText;const line=el('div',undefined,'thuy-gap-line'),part=el('span',text,'thuy-gap-segment');part.dataset.line='0';part.dataset.part='0';line.append(part);editor.replaceChildren(line);focusText(true);
  }
  const segments=[...editor.querySelectorAll('.thuy-gap-segment')];commit(item,key,()=>{
   if(item.interactionConfig.sentenceLines){for(const part of segments)item.interactionConfig.sentenceLines[Number(part.dataset.line)].parts[Number(part.dataset.part)]=part.textContent;}
   else item.prompt=segments.map(part=>part.textContent).join('\n');
  });onChange();select();
 }
 function insertText(text){
  if(readonly||busy)return;
  const info=rangeInfo();if(!info)return fail('Hãy đặt con trỏ trong đoạn chữ cần sửa; dùng Bỏ ô để sửa vùng đánh dấu.');
  const range=info.range;range.deleteContents();const node=document.createTextNode(text);range.insertNode(node);range.setStartAfter(node);range.collapse(true);const selection=getSelection();selection.removeAllRanges();selection.addRange(range);syncText();
 }
 editor.addEventListener('beforeinput',event=>{
  if(readonly||busy){event.preventDefault();return;}
  if(composing||event.isComposing)return;
  if(['insertParagraph','insertLineBreak'].includes(event.inputType)){event.preventDefault();insertText('\n');return;}
  const info=rangeInfo();if(!info){event.preventDefault();fail('Chỉ sửa đoạn chữ hoặc bấm Bỏ ô để bỏ vùng đã đánh dấu.');return;}
  const selection=getSelection();selection.removeAllRanges();selection.addRange(info.range);
  const deletingBack=event.inputType?.startsWith('delete')&&event.inputType.includes('Backward'),deletingForward=event.inputType?.startsWith('delete')&&event.inputType.includes('Forward');
  if(info.start===info.end&&(deletingBack&&info.start===0&&info.segment.previousElementSibling?.classList.contains('thuy-gap-chip')||deletingForward&&info.end===info.segment.textContent.length&&info.segment.nextElementSibling?.classList.contains('thuy-gap-chip'))){event.preventDefault();fail('Dùng Bỏ ô trong nhóm đáp án để giữ đúng nội dung và đáp án.');}
 });
 editor.addEventListener('paste',event=>{event.preventDefault();insertText(event.clipboardData.getData('text/plain'));});
 editor.addEventListener('input',()=>{if(!composing)syncText();});editor.addEventListener('compositionstart',()=>{composing=true;popup.hidden=true;});editor.addEventListener('compositionend',()=>{composing=false;syncText();});
 instructionInput.addEventListener('input',()=>{commit(item,key,()=>{item.prompt=instructionInput.value;});onChange();});
 widget.addEventListener('keydown',event=>{
  if(event.key==='Escape'){popup.hidden=true;selected=null;}
  if((event.ctrlKey||event.metaKey)&&['z','y'].includes(event.key.toLowerCase())&&!readonly&&!busy){event.preventDefault();restoreHistory(event.key.toLowerCase()==='y'||event.shiftKey);}
 });
 function restoreHistory(redo){const active=document.activeElement?.dataset.answerRow;if(undo(item,key,redo)){onChange();refresh();const field=active&&answers.querySelector('[data-answer-row="'+active+'"]');if(field)field.focus({preventScroll:true});else focusText();}}
 widget.addEventListener('beforeinput',event=>{if(!['historyUndo','historyRedo'].includes(event.inputType))return;event.preventDefault();event.stopPropagation();if(!readonly&&!busy)restoreHistory(event.inputType==='historyRedo');},true);
 popup.addEventListener('pointerdown',event=>event.preventDefault());
 document.addEventListener('selectionchange',select,opts);window.addEventListener('scroll',select,{capture:true,signal:controller.signal});window.addEventListener('resize',select,opts);
 function focusText(end=false){const segments=editor.querySelectorAll('.thuy-gap-segment'),segment=segments[end?segments.length-1:0];if(!segment)return;editor.focus({preventScroll:true});const range=document.createRange();range.selectNodeContents(segment);range.collapse(!end);const selection=getSelection();selection.removeAllRanges();selection.addRange(range);}
 refresh();return {dispose(){controller.abort();popup.remove();},refresh,setBusy(value){busy=value;editor.contentEditable=String(!readonly&&!busy);if(busy){selected=null;popup.hidden=true;}}};
}

export function mountSlotAnswers(parent,settings){const host=el('div',undefined,'thuy-answer-groups');parent.append(host);const refresh=()=>renderAnswerGroups(host,{...settings,onStructure:refresh});refresh();return {dispose(){},refresh};}

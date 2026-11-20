// Chữ gốc và các hàng input chưa hoàn tất thuộc khóa riêng của bộ soạn.
const clone=value=>structuredClone(value),uuid=()=>crypto.randomUUID();
export function authoringState(item,key){key.authoringState??={};return key.authoringState[item.itemVersionId]??={};}
export function ensureBlankIds(item,key){
 const count=item.interactionConfig.responseCount||0;
 if(count&&!item.interactionConfig.blankIds)item.interactionConfig.blankIds=Array.from({length:count},uuid);
 const state=authoringState(item,key);state.sources??={};
 for(const [slot,id]of (item.interactionConfig.blankIds||[]).entries())if(!(id in state.sources)){
  const source=key.items[item.itemVersionId]?.acceptedBySlot?.[slot]?.[0]??key.referenceAnswersBySlot?.[item.itemVersionId]?.[slot]?.[0]??key.referenceAnswers?.[item.itemVersionId]?.[slot];
  if(source!==undefined)state.sources[id]=source;
 }
 return item.interactionConfig.blankIds||[];
}
export function answerValues(item,key,kind,slot=0){
 const id=item.itemVersionId;
 if(item.interactionConfig.responseCount)return kind==='survey'
  ?key.referenceAnswersBySlot?.[id]?.[slot]??(key.referenceAnswers?.[id]?.[slot]?[key.referenceAnswers[id][slot]]:[])
  :key.items[id]?.acceptedBySlot?.[slot]||[];
 return kind==='survey'?key.referenceAnswers?.[id]||[]:key.items[id]?.accepted||[];
}
export function answerRows(item,key,kind,slot=0){
 const ids=ensureBlankIds(item,key),id=ids[slot]||'answer',state=authoringState(item,key);state.answerRows??={};
 if(!state.answerRows[id]){
  const values=answerValues(item,key,kind,slot);state.answerRows[id]=(values.length?values:kind==='exercise'?['']:[]).map(value=>({id:uuid(),value}));
 }
 return state.answerRows[id];
}
export function syncAnswerRows(item,key,kind){
 const state=authoringState(item,key),id=item.itemVersionId,ids=item.interactionConfig.blankIds||[],values=rows=>(rows||[]).map(row=>row.value.trim()).filter(Boolean);
 if(ids.length){
  const slots=ids.map((blankId,slot)=>state.answerRows?.[blankId]?values(state.answerRows[blankId]):answerValues(item,key,kind,slot));
  if(kind==='survey'){
   key.referenceAnswersBySlot??={};
   const explicitSlots=Boolean(key.referenceAnswersBySlot[id]);
   if(slots.some(a=>a.length)||explicitSlots)key.referenceAnswersBySlot[id]=slots;else delete key.referenceAnswersBySlot[id];
   if(!explicitSlots)delete key.referenceAnswers?.[id];
   delete key.items[id];
  }else key.items[id]={graderType:'accepted_text_sequence',acceptedBySlot:slots,normalization:key.items[id]?.normalization||{caseInsensitive:true,collapseWhitespace:true}};
 }else{
  const accepted=values(state.answerRows?.answer);
  if(kind==='survey'){key.referenceAnswers??={};if(accepted.length)key.referenceAnswers[id]=accepted;else delete key.referenceAnswers[id];delete key.items[id];}
  else if(accepted.length)key.items[id]={graderType:'accepted_text',accepted,normalization:key.items[id]?.normalization||{caseInsensitive:true,collapseWhitespace:true}};
  else delete key.items[id];
 }
}
export function incompleteAnswerRows(key){return Object.entries(key.authoringState||{}).flatMap(([itemId,state])=>Object.entries(state.answerRows||{}).flatMap(([blankId,rows])=>rows.filter(row=>!row.value.trim()).map(row=>({itemId,blankId,rowId:row.id}))));}
const shape=item=>JSON.stringify({
 layout:item.layoutType,blanks:item.interactionConfig.blankIds||[],
 options:(item.options||[]).map(({id,label})=>({id,label})),
 count:item.interactionConfig.responseCount||null,prompt:item.prompt,lines:item.interactionConfig.sentenceLines||null,
 ...(item.interactionConfig.matchingPrompts?{pairs:item.interactionConfig.matchingPrompts}:{}),
 ...(item.interactionConfig.responseLabels?{labels:item.interactionConfig.responseLabels}:{}),
 ...(item.interactionConfig.exclusiveOptionId?{exclusive:item.interactionConfig.exclusiveOptionId}:{})
});
const directTypes=new Set(['mcq','multi','dropdown','short_answer','gapfill','numbered_short_texts','matching']);
export const canChangeQuestionKind=type=>directTypes.has(type);

function keyMatches(item,key){
 if(!key||key.graderType!==item.graderType)return false;
 if(key.expectedOptionId)return item.options.some(option=>option.id===key.expectedOptionId);
 if(key.expectedOptionIds){
  const ids=key.expectedOptionIds,exclusive=item.interactionConfig.exclusiveOptionId;
  return new Set(ids).size===ids.length&&ids.every(id=>item.options.some(option=>option.id===id))
    &&(key.graderType!=='exact_sequence'||ids.length===item.interactionConfig.matchingPrompts.length)
    &&(!exclusive||!ids.includes(exclusive)||ids.length===1);
 }
 if(key.acceptedBySlot)return key.acceptedBySlot.length===item.interactionConfig.responseCount&&key.acceptedBySlot.every(values=>values.length);
 return Boolean(key.accepted?.length);
}
function fallbackReference(item,key,current){
 const id=item.itemVersionId;
 if(current.acceptedBySlot){
  key.referenceAnswersBySlot??={};
  key.referenceAnswersBySlot[id]??=clone(current.acceptedBySlot);
  return;
 }
 const values=current.expectedOptionId?[current.expectedOptionId]:current.expectedOptionIds||current.accepted;
 if(!values?.length)return;
 key.referenceAnswers??={};
 key.referenceAnswers[id]??=values.map(value=>item.options.find(option=>option.id===value)?.label||value);
}
export function changeQuestionKind(item,key,kind,type){
 if(!canChangeQuestionKind(type))throw Error('Dạng này cần đổi cấu trúc trước khi đổi chế độ.');
 const id=item.itemVersionId,state=authoringState(item,key),current=key.items[id];
 if(kind==='survey'){
  if(current){
   key.savedExerciseKeys??={};
   key.savedExerciseKeys[id]=clone(current);
   state.exerciseShape=shape(item);
   if(item.maxScore>0)state.exerciseMaxScore=item.maxScore;
   fallbackReference(item,key,current);
  }
  item.graderType='none';
  item.maxScore=0;
  delete key.items[id];
  if(type==='multi')delete item.interactionConfig.maxSelections;
 }else{
  item.graderType=['mcq','dropdown'].includes(type)?'exact_option':type==='multi'?'exact_option_set':type==='matching'?'exact_sequence':item.interactionConfig.responseCount?'accepted_text_sequence':'accepted_text';
  const saved=key.savedExerciseKeys?.[id];
  delete key.items[id];
  if(state.exerciseShape===shape(item)&&keyMatches(item,saved))key.items[id]=clone(saved);
  item.maxScore=(key.items[id]?state.exerciseMaxScore:undefined)||item.interactionConfig.responseCount||1;
  if(type==='multi')item.interactionConfig.maxSelections=Math.max(1,key.items[id]?.expectedOptionIds?.length||1);
 }
 item.kind=kind;
 delete state.answerRows;
 if(key.importReviews?.[id])delete key.importReviews[id].reviewedContent;
}

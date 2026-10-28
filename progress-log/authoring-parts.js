// Danh mục câu và thao tác ô trống; không gọi API hay AI.
import {authoringState} from './authoring-answers.js?rev=20261028-the15-v1';
export const PART_TYPES={exercise:[['mcq','Trắc nghiệm'],['multi','Chọn nhiều đáp án'],['short_answer','Điền từ'],['dropdown','Danh sách xổ xuống']],
  survey:[['mcq','Trắc nghiệm'],['multi','Chọn nhiều đáp án'],['short_answer','Điền từ'],['dropdown','Danh sách xổ xuống'],['reflection','Trả lời mở'],['self_reported_score','Ghi số câu đúng']]};
export const PART_SKILLS=[['','Kỹ năng'],['general','Chung'],['listening','Listening'],['reading','Reading'],['speaking','Speaking'],['writing','Writing']];
export function partAllows(kind,type){return PART_TYPES[kind]?.some(([id])=>id===type||id==='short_answer'&&type==='gapfill')||false;}
export function selectedLimit(item,key,kind){
  if(item.layoutType!=='multiple_choice_cards')return;
  if(kind==='survey')delete item.interactionConfig.maxSelections;
  else item.interactionConfig.maxSelections=Math.max(1,key?.expectedOptionIds?.length||1);
}
export function preparePartItem(item,kind){
  item.kind=kind;
  item.skillCodes=[];
  if(['choice_cards','multiple_choice_cards','matching_heading_dropdown'].includes(item.layoutType))item.options=Array.from({length:item.layoutType==='multiple_choice_cards'?5:4},()=>({id:crypto.randomUUID(),label:''}));
  if(kind==='survey'){item.graderType='none';item.maxScore=0;}
  selectedLimit(item,null,kind);return item;
}
export function missingSkills(definition){return definition.blocks.flatMap(b=>b.items).filter(i=>!i.skillCodes?.length).map(i=>i.position);}

// Cơ chế tách theo offset kế thừa src/lib/transcript.ts của Đức Anh, commit 0d7bde4195.
// Chỉ vùng bôi chọn thành ô trống; cùng chữ ở chỗ khác không bị thay. Mã ô cũ giữ nguyên.
export function insertBlank(item,gradingKey,{lineIndex=0,partIndex=0,start,end,kind='exercise',uuid=()=>crypto.randomUUID()}){
  const config=item.interactionConfig;
  const lines=config.sentenceLines||[{title:'',parts:[item.prompt]}];
  const line=lines[lineIndex],content=line?.parts[partIndex];
  if(typeof content!=='string'||start<0||end>content.length||start>=end||!content.slice(start,end).trim())throw Error('Hãy bôi chọn đúng từ hoặc cụm từ cần tạo chỗ trống.');
  const oldCount=lines.reduce((n,l)=>n+l.parts.length-1,0);
  if(oldCount>=10)throw Error('Mỗi câu có tối đa 10 ô trống.');
  const slot=lines.slice(0,lineIndex).reduce((n,l)=>n+l.parts.length-1,0)+partIndex;
  const ids=config.blankIds||Array.from({length:oldCount},uuid),id=uuid(),selected=content.slice(start,end).trim();
  if(selected.length>300)throw Error('Đáp án của một ô tối đa 300 ký tự. Hãy chọn một từ hoặc cụm ngắn hơn.');
  const primary=kind==='survey'?structuredClone(gradingKey.referenceAnswersBySlot?.[item.itemVersionId]||Array.from({length:oldCount},(_,i)=>gradingKey.referenceAnswers?.[item.itemVersionId]?.[i]?[gradingKey.referenceAnswers[item.itemVersionId][i]]:[])):null;
  const accepted=kind==='exercise'?structuredClone(gradingKey.items[item.itemVersionId]?.acceptedBySlot||Array.from({length:oldCount},()=>[])):null;
  if(content.slice(0,start).length>2000||content.slice(end).length>2000)throw Error('Mỗi đoạn quanh ô trống tối đa 2000 ký tự. Hãy chia thành câu ngắn hơn.');
  line.parts.splice(partIndex,1,content.slice(0,start),content.slice(end));ids.splice(slot,0,id);
  const state=authoringState(item,gradingKey);state.sources??={};state.sources[id]=content.slice(start,end);delete state.answerRows?.answer;
  if(!config.sentenceLines)item.prompt='Điền từ vào chỗ trống';
  delete config.beforeText;delete config.afterText;
  Object.assign(config,{sentenceLines:lines,responseCount:oldCount+1,blankIds:ids});delete config.responseLabels;
  item.layoutType='numbered_short_texts';item.interactionType='short_text';item.pedagogicalTypeCode='sentence_completion';
  if(kind==='survey'){
    item.graderType='none';item.maxScore=0;delete gradingKey.items[item.itemVersionId];
    primary.splice(slot,0,[selected]);gradingKey.referenceAnswersBySlot??={};gradingKey.referenceAnswersBySlot[item.itemVersionId]=primary;delete gradingKey.referenceAnswers?.[item.itemVersionId];
  }else{
    item.graderType='accepted_text_sequence';item.maxScore=oldCount+1;accepted.splice(slot,0,[selected]);
    gradingKey.items[item.itemVersionId]={graderType:'accepted_text_sequence',acceptedBySlot:accepted,normalization:{caseInsensitive:true,collapseWhitespace:true}};
  }
  return id;
}
export function removeBlank(item,gradingKey,{lineIndex,partIndex,kind='exercise'}){
  const config=item.interactionConfig,line=config.sentenceLines?.[lineIndex];
  if(!line||partIndex<0||partIndex>=line.parts.length-1)throw Error('Không tìm thấy ô trống này.');
  const slot=config.sentenceLines.slice(0,lineIndex).reduce((n,l)=>n+l.parts.length-1,0)+partIndex;
  const key=gradingKey.items[item.itemVersionId],refs=gradingKey.referenceAnswers?.[item.itemVersionId],slots=gradingKey.referenceAnswersBySlot?.[item.itemVersionId],id=config.blankIds?.[slot],state=gradingKey.authoringState?.[item.itemVersionId];
  const restored=state?.sources?.[id]??(kind==='survey'?slots?.[slot]?.[0]??refs?.[slot]??'':key?.acceptedBySlot?.[slot]?.[0]??'');
  const combined=line.parts[partIndex]+restored+line.parts[partIndex+1];
  if(combined.length>2000||config.responseCount===1&&config.sentenceLines.map(l=>(l.title?l.title+' ':'')+(l===line?combined:l.parts[0])).join('\n').length>2000)throw Error('Nội dung sau khi bỏ ô vượt 2000 ký tự. Hãy chia câu trước; ô và đáp án vẫn được giữ.');
  line.parts.splice(partIndex,2,combined);
  config.blankIds?.splice(slot,1);key?.acceptedBySlot?.splice(slot,1);refs?.splice(slot,1);slots?.splice(slot,1);config.responseCount--;
  if(id){delete state?.sources?.[id];delete state?.answerRows?.[id];}
  if(!config.responseCount){
    item.prompt=config.sentenceLines.map(l=>(l.title?l.title+' ':'')+l.parts[0]).join('\n');item.layoutType='plain_prompt';
    delete config.sentenceLines;delete config.responseCount;delete config.blankIds;delete config.responseLabels;
    item.graderType=kind==='survey'?'none':'accepted_text';item.maxScore=kind==='survey'?0:1;
    delete gradingKey.items[item.itemVersionId];delete gradingKey.referenceAnswers?.[item.itemVersionId];
    delete gradingKey.referenceAnswersBySlot?.[item.itemVersionId];
  }else if(kind==='exercise')item.maxScore=config.responseCount;
}

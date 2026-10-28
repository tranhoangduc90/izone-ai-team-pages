// Dùng kết quả đã lọc quyền từ API. Không tự lấy key, suy đáp án hoặc chấm ở trình duyệt.
import {questionPresentation} from './question-presentation.js?rev=20261022-parity-v1';
import {effectiveItemKind} from '../item-kind.js?rev=20261028-the15-v1';
const node=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e;};
function answer(item,value){
 const values=Array.isArray(value)?value:[value];
 return values.map((id,index)=>{
  const label=item.options.find(o=>o.id===id)?.label||(id==null||id===''?'Để trống':typeof id==='object'?`${id.correct}/${id.total}`:String(id));
  return item.layoutType==='matching_pairs'?`${item.interactionConfig.matchingPrompts[index]} → ${label}`:label;
 }).join(' · ');
}
export function partFeedback(block,result){
 if(!result)return null;
 const grades=(result.items||[]).filter(i=>block.items.some(q=>q.itemVersionId===i.itemVersionId));
 const canReview=grade=>result.answerRelease==='released'||effectiveItemKind(block.items.find(item=>item.itemVersionId===grade.itemVersionId),block)==='survey';
 if(!grades.some(g=>canReview(g)&&(g.expectedAnswer!=null||g.referenceSlots?.some(s=>s.expectedAnswer.length)||g.explanation)))return null;
 const root=node('div');root.className='thuy-part-review';
 const scored=grades.filter(g=>g.maxScore>0&&result.answerRelease==='released'),units=scored.flatMap(g=>g.slotResults||[g]),correct=units.filter(g=>g.verdict==='correct').length;
 const unit=scored.some(g=>g.slotResults)?'ô':'câu';
 root.append(node('p',units.length?`${correct} đúng · ${units.length-correct} sai / ${units.length} ${unit} đã chấm`:'Đáp án tham khảo'));
 for(const item of block.items){const survey=effectiveItemKind(item,block)==='survey',stored=grades.find(g=>g.itemVersionId===item.itemVersionId);if(!stored)continue;const grade=canReview(stored)?stored:{...stored,expectedAnswer:undefined,explanation:undefined,slotResults:undefined,referenceSlots:undefined};
  const display=questionPresentation(item),card=node('article'),heading=node('h3',`Câu ${display.number} · ${display.title}`);
  card.append(heading);
  if(survey&&grade.referenceSlots){
   const list=node('ol');list.className='thuy-slot-review';
   for(const slot of grade.referenceSlots){const row=node('li');row.dataset.slot=slot.slot;row.append(node('b',item.interactionConfig.responseLabels?.[slot.slot]||'Ô '+(slot.slot+1)),node('p','Câu trả lời của em: '+(slot.rawAnswer||'Để trống')));if(slot.expectedAnswer.length)row.append(node('p','Đáp án tham khảo: '+slot.expectedAnswer.join(' / ')));list.append(row);}card.append(list);
  }else if(!survey&&grade.slotResults&&result.answerRelease==='released'){
   const list=node('ol');list.className='thuy-slot-review';
   for(const slot of grade.slotResults){
    const row=node('li');row.dataset.slot=slot.slot;row.dataset.verdict=slot.verdict;
    row.append(node('b',item.interactionConfig.responseLabels?.[slot.slot]||'Ô '+(slot.slot+1)),
     node('p','Câu trả lời của em: '+(slot.rawAnswer||'Để trống')),
     node('b',slot.verdict==='correct'?'✓ Đúng':'✕ Sai'));
    if(slot.expectedAnswer)row.append(node('p','Đáp án: '+slot.expectedAnswer.join(' / ')));
    list.append(row);
   }card.append(list);
  }else{
  card.append(node('p','Câu trả lời của em: '+answer(item,grade.rawAnswer)));
  if(grade.expectedAnswer!=null){if(!survey)card.append(node('b',grade.verdict==='correct'?'✓ Đúng':'✕ Sai'));card.append(node('p',(survey?'Đáp án tham khảo: ':'Đáp án: ')+answer(item,grade.expectedAnswer)));}
  else if(survey||grade.maxScore===0)card.append(node('p','Không tự chấm đúng/sai'));
  }
  if(grade.explanation)card.append(node('p','Giải thích: '+grade.explanation));
  if(item.options.length){const details=node('details');details.append(node('summary','Xem toàn bộ lựa chọn'));for(const option of item.options)details.append(node('p',option.id+'. '+option.label));card.append(details);}
  root.append(card);
 }return root;
}

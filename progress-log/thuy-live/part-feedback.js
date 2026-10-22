// Dùng kết quả đã lọc quyền từ API. Không tự lấy key, suy đáp án hoặc chấm ở trình duyệt.
import {questionPresentation} from './question-presentation.js?rev=20261022-parity-v1';
const node=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e;};
function answer(item,value){
 const values=Array.isArray(value)?value:[value];
 return values.map((id,index)=>{
  const label=item.options.find(o=>o.id===id)?.label||(id==null||id===''?'Để trống':typeof id==='object'?`${id.correct}/${id.total}`:String(id));
  return item.layoutType==='matching_pairs'?`${item.interactionConfig.matchingPrompts[index]} → ${label}`:label;
 }).join(' · ');
}
export function partFeedback(block,result){
 if(result?.answerRelease!=='released')return null;
 const grades=(result.items||[]).filter(i=>block.items.some(q=>q.itemVersionId===i.itemVersionId));
 if(!grades.some(g=>(g.maxScore>0&&g.expectedAnswer!=null)||g.explanation))return null;
 const root=node('div');root.className='thuy-part-review';
 const scored=grades.filter(g=>g.maxScore>0),units=scored.flatMap(g=>g.slotResults||[g]),correct=units.filter(g=>g.verdict==='correct').length;
 const unit=scored.some(g=>g.slotResults)?'ô':'câu';
 root.append(node('p',units.length?`${correct} đúng · ${units.length-correct} sai / ${units.length} ${unit} đã chấm`:'Đáp án đối chiếu · Phần này không tự chấm đúng/sai'));
 for(const item of block.items){const grade=grades.find(g=>g.itemVersionId===item.itemVersionId);if(!grade)continue;
  const display=questionPresentation(item),card=node('article'),heading=node('h3',`Câu ${display.number} · ${display.title}`);
  card.append(heading);
  if(grade.slotResults){
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
  if(grade.expectedAnswer!=null){card.append(node('b',grade.verdict==='correct'?'✓ Đúng':'✕ Sai'),node('p','Đáp án: '+answer(item,grade.expectedAnswer)));}
  else card.append(node('p','Không tự chấm đúng/sai'));
  }
  if(grade.explanation)card.append(node('p','Giải thích: '+grade.explanation));
  if(item.options.length){const details=node('details');details.append(node('summary','Xem toàn bộ lựa chọn'));for(const option of item.options)details.append(node('p',option.id+'. '+option.label));card.append(details);}
  root.append(card);
 }return root;
}

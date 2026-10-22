// Dùng kết quả đã lọc quyền từ API. Không tự lấy key, suy đáp án hoặc chấm ở trình duyệt.
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
 if(!grades.some(g=>g.maxScore>0&&g.expectedAnswer!=null))return null;
 const root=node('div');root.className='thuy-part-review';
 const scored=grades.filter(g=>g.maxScore>0),correct=scored.filter(g=>g.verdict==='correct').length;
 root.append(node('p',`${correct} đúng · ${scored.length-correct} sai / ${scored.length} câu đã chấm`));
 for(const item of block.items){const grade=grades.find(g=>g.itemVersionId===item.itemVersionId);if(!grade)continue;
  const card=node('article'),heading=node('h3',`Câu ${item.displayNumber||item.position} · ${item.prompt}`);
  card.append(heading,node('p','Câu trả lời của em: '+answer(item,grade.rawAnswer)));
  if(grade.expectedAnswer!=null){card.append(node('b',grade.verdict==='correct'?'✓ Đúng':'✕ Sai'),node('p','Đáp án: '+answer(item,grade.expectedAnswer)));}
  else card.append(node('p','Không tự chấm đúng/sai'));
  if(grade.explanation)card.append(node('p','Giải thích: '+grade.explanation));
  if(item.options.length){const details=node('details');details.append(node('summary','Xem toàn bộ lựa chọn'));for(const option of item.options)details.append(node('p',option.id+'. '+option.label));card.append(details);}
  root.append(card);
 }return root;
}

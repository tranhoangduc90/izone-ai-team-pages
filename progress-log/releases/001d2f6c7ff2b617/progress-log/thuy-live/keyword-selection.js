// Nhận câu cùng các mã từ ổn định; chọn/bỏ bằng chuột hoặc bàn phím, trả lại mã từ cho API chung.
// Không suy ra đáp án và không chấm ở trình duyệt. Văn bản luôn dựng bằng textContent.
export function keywordSelection(item, value, onChange, {disabled=false, document:doc=globalThis.document}={}) {
  const line=doc.createElement('div');line.className='keyword-line';line.setAttribute('role','group');
  line.setAttribute('aria-label',item.prompt);
  let selected=new Set(Array.isArray(value)?value:[]);
  const limit=Math.min(10,item.interactionConfig?.maxSelections||10),status=doc.createElement('small');status.setAttribute('role','status');status.className='keyword-status';
  for(const option of item.options||[]) {
    const word=doc.createElement('button');word.type='button';word.className='keyword-word';
    word.textContent=option.label;word.dataset.keyword=option.id;word.disabled=disabled;
    const paint=()=>{word.setAttribute('aria-pressed',String(selected.has(option.id)));};paint();
    word.addEventListener('click',()=>{
      if(selected.has(option.id))selected.delete(option.id);
      else if(selected.size<limit)selected.add(option.id);
      else {status.textContent=`Mỗi câu chọn tối đa ${limit} từ. Bỏ một từ để chọn từ khác.`;return;}
      status.textContent='';
      paint();
      const result=(item.options||[]).filter(o=>selected.has(o.id)).map(o=>o.id);
      onChange(item.itemVersionId,result.length?result:undefined);
    });
    line.append(word,doc.createTextNode(' '));
  }
  line.append(status);
  return line;
}

export function keywordAnswer(item,value) {
  const ids=new Set(Array.isArray(value)?value:[]);
  return (item.options||[]).filter(o=>ids.has(o.id)).map(o=>o.label).join(' ')||'Chưa chọn từ khóa';
}

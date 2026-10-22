// Số câu là dữ liệu hiển thị riêng. Không sửa definition, ID hoặc đáp án đã lưu.
export function questionPresentation(item) {
  const number=String(item.displayNumber||item.position);
  const escaped=number.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const prompt=String(item.prompt||'').replace(new RegExp('^Câu\\s+'+escaped+'(?=\\s|[.·:()])\\s*[·.:]?\\s*','iu'),'');
  return {number,title:prompt};
}
// Chỉ nhóm các dòng gạch chân liền nhau có cùng số gốc: 1, 1A, 1B, 1C.
// Từng control vẫn giữ nguyên itemVersionId và callback lưu riêng.
export function buildKeywordGroup(items,buildQuestion) {
  const first=items[0],number=String(first.displayNumber||first.position);
  if(first.layoutType!=='keyword_selection'||!/^\d+$/u.test(number))return null;
  const group=[first];
  for(const item of items.slice(1)){
    if(item.layoutType!=='keyword_selection'||!new RegExp('^'+number+'[A-Z]$','u').test(String(item.displayNumber||'')))break;
    group.push(item);
  }
  if(group.length===1)return null;
  const section=document.createElement('section');section.className='thuy-keyword-question';
  const heading=document.createElement('h3');heading.className='thuy-question-heading';heading.textContent='Câu '+number;section.append(heading);
  for(const [index,item]of group.entries()){
    const row=buildQuestion(item);row.classList.add('thuy-keyword-subitem');row.querySelector('.question-number').hidden=true;
    const label=row.querySelector('h3');label.textContent=index===0?'Câu hỏi':String(item.displayNumber).slice(number.length);
    section.append(row);
  }
  return {element:section,count:group.length};
}

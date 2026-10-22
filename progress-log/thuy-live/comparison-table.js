// Dựng bảng từ sentenceLines có sẵn; giữ thứ tự ô của từng item để API lưu/chấm đúng nguồn.
export function comparisonTable(items,{valueFor,onChange,resizeInput}) {
  const section=document.createElement('section');section.className='thuy-comparison';
  const heading=document.createElement('h3');heading.className='thuy-question-heading';heading.textContent='Câu '+(items[0].displayNumber||items[0].position)+' · Phân biệt Scanning và Skimming';section.append(heading);
  const wrap=document.createElement('div');wrap.className='thuy-comparison-scroll';
  const table=document.createElement('table'),thead=document.createElement('thead'),head=document.createElement('tr');
  for(const title of ['Tiêu chí',...items.map(i=>i.prompt)]){const th=document.createElement('th');th.scope='col';th.textContent=title;head.append(th);}thead.append(head);table.append(thead);
  const data=items.map(item=>{
    let slot=0;const values=Array.isArray(valueFor(item))?[...valueFor(item)]:Array(item.interactionConfig.responseCount).fill('');
    const lines=item.interactionConfig.sentenceLines.map(line=>{
      const start=slot;
      slot+=line.parts.length-1;
      return {...line,start};
    });
    return {item,values,lines};
  });
  const criteria=[...new Set(data.flatMap(d=>d.lines.map(l=>l.title)))];const tbody=document.createElement('tbody');
  for(const criterion of criteria){
    const row=document.createElement('tr'),th=document.createElement('th');th.scope='row';th.textContent=criterion;row.append(th);
    for(const entry of data){
      const cell=document.createElement('td');
      for(const line of entry.lines.filter(l=>l.title===criterion)){
        const p=document.createElement('p');p.className='sentence-text';
        line.parts.forEach((part,index)=>{
          p.append(document.createTextNode(part));
          if(index===line.parts.length-1)return;
          const slot=line.start+index,input=document.createElement('textarea');input.rows=1;input.className='sentence-blank';input.maxLength=2000;
          input.value=entry.values[slot]||'';input.setAttribute('aria-label',`${entry.item.prompt} · ${criterion} · ô ${slot+1}`);
          input.dataset.itemVersionId=entry.item.itemVersionId;input.dataset.slot=slot;
          input.addEventListener('input',event=>{
            if(!event.isComposing)input.value=input.value.replace(/\s*[\r\n]+\s*/g,' ');
            resizeInput(input);entry.values[slot]=input.value;onChange(entry.item.itemVersionId,[...entry.values]);
          });
          input.addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.isComposing)event.preventDefault();});p.append(input);
        });cell.append(p);
      }row.append(cell);
    }tbody.append(row);
  }table.append(tbody);wrap.append(table);section.append(wrap);return section;
}

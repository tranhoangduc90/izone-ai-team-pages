// Dùng cùng nhóm ô và mảng câu trả lời của engine; bảng chỉ giữ bố cục nguồn, không chứa key.
export function docsSourceTable(item,{values=[],onChange,resizeInput,required=false}){
  const {tableLayout,sentenceLines}=item.interactionConfig,answers=Array.from({length:item.interactionConfig.responseCount},(_,i)=>values[i]||'');
  const starts=[];let count=0;for(const line of sentenceLines){starts.push(count);count+=line.parts.length-1;}
  const wrap=document.createElement('div');wrap.className='docs-source-table';wrap.setAttribute('role','region');wrap.setAttribute('aria-label','Bảng câu hỏi');wrap.tabIndex=0;
  const table=document.createElement('table'),thead=document.createElement('thead'),head=document.createElement('tr');
  for(const title of ['Tiêu chí',...tableLayout.columnHeaders]){const th=document.createElement('th');th.scope='col';th.textContent=title;head.append(th);}
  thead.append(head);table.append(thead);const body=document.createElement('tbody');
  for(const row of tableLayout.rows){const tr=document.createElement('tr'),label=document.createElement('th');label.scope='row';label.textContent=row.label;tr.append(label);
    row.cells.forEach((cell,column)=>{const td=document.createElement('td');
      if(cell.text){const context=document.createElement('p');context.textContent=cell.text;td.append(context);}
      for(const index of cell.lineIndexes||[]){const line=sentenceLines[index],p=document.createElement('p');p.className='sentence-text';
        line.parts.forEach((text,part)=>{p.append(document.createTextNode(text));if(part===line.parts.length-1)return;
          const slot=starts[index]+part,input=document.createElement('textarea');input.rows=1;input.className='sentence-blank';input.maxLength=2000;input.required=required;input.value=answers[slot];
          input.dataset.itemVersionId=item.itemVersionId;input.dataset.slot=String(slot);
          input.setAttribute('aria-label',`${row.label} · ${tableLayout.columnHeaders[column]} · ô ${slot+1}`);
          input.addEventListener('input',event=>{if(!event.isComposing)input.value=input.value.replace(/\s*[\r\n]+\s*/gu,' ');
            resizeInput(input);answers[slot]=input.value;onChange([...answers]);});
          input.addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.isComposing)event.preventDefault();});p.append(input);
        });td.append(p);
      }tr.append(td);
    });body.append(tr);
  }table.append(body);wrap.append(table);return wrap;
}

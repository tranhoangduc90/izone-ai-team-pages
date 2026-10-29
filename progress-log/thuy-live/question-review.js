// Cùng một bản chỉ đọc cho thống kê GV và câu đã chữa của HV. Key do caller đã kiểm quyền cấp.
import {questionPresentation} from './question-presentation.js?rev=20261022-parity-v1';
const node=(tag,text='',className='')=>{const e=document.createElement(tag);e.textContent=text;e.className=className;return e;};
const values=value=>value==null?[]:Array.isArray(value)?value:[value];
const text=value=>values(value).map(v=>Array.isArray(v)?v.join(' / '):typeof v==='object'?`${v.correct??''}/${v.total??''}`:String(v)).join(' · ');
export function questionReview(item,{correctAnswer=null,expectedIds=[],rawAnswer=null,explanation='',includeHeading=true,reference=false}={}){
  if(!document.getElementById('thuy-question-review-style')){const css=document.createElement('link');css.id='thuy-question-review-style';css.rel='stylesheet';css.href=new URL('./question-review.css?rev=20261030-the17-19-v1',import.meta.url).href;document.head.append(css);}
  const root=node('div','','thuy-question-review'),display=questionPresentation(item),config=item.interactionConfig||{},options=item.options||[];
  if(includeHeading)root.append(node('small','Câu '+display.number),node('h3',display.title));
  if(item.helpText)root.append(node('p',item.helpText,'muted'));
  const selected=new Set(values(rawAnswer)),expected=new Set(values(expectedIds));
  if(options.length&&!['matching_pairs','matching_heading_dropdown','keyword_selection'].includes(item.layoutType)){
    const choices=node('div','','choice-list');
    for(const [index,option]of options.entries()){
      const row=node('label','','choice'),input=node('input');input.type=item.interactionType==='single_choice'?'radio':'checkbox';input.disabled=true;input.checked=selected.has(option.id);
      const label=/^[A-Z]$/u.test(option.id)?option.id:String.fromCharCode(65+index);row.dataset.key=label;
      row.append(input,node('span',label,'choice-key'),node('span',option.label,'choice-text'));
      if(expected.has(option.id)&&!reference){row.classList.add('feedback-correct');row.append(node('span','Đáp án đúng','choice-feedback'));}
      if(input.checked)row.classList.add('selected');choices.append(row);
    }root.append(choices);
  }else if(item.layoutType==='matching_pairs'){
    const table=node('table','','thuy-review-pairs'),body=node('tbody');
    for(const [index,prompt]of (config.matchingPrompts||[]).entries()){
      const row=node('tr'),chosen=values(rawAnswer)[index]??values(expectedIds)[index],right=options.find(o=>o.id===chosen);
      row.append(node('td',prompt),node('td','→'),node('td',right?right.label:options.map(o=>o.id+'. '+o.label).join(' / ')));body.append(row);
    }table.append(body);root.append(table);
  }else if(item.layoutType==='matching_heading_dropdown'){
    const select=node('select');select.disabled=true;select.setAttribute('aria-label','Lựa chọn câu '+display.number);select.append(new Option('Chọn đáp án',''));
    for(const option of options)select.append(new Option(option.id+'. '+option.label,option.id));select.value=String(rawAnswer??values(expectedIds)[0]??'');root.append(select);
  }else if(config.sentenceLines?.length){
    let slot=0;for(const line of config.sentenceLines){const paragraph=node('p','','thuy-review-sentence');if(line.title)paragraph.append(node('strong',line.title+' '));
      for(const [index,part]of line.parts.entries()){paragraph.append(document.createTextNode(part));if(index<line.parts.length-1){const value=values(rawAnswer)[slot]??(Array.isArray(correctAnswer?.[slot])?correctAnswer[slot][0]:correctAnswer?.[slot])??'';const blank=node('input');blank.className='sentence-blank';blank.readOnly=true;blank.setAttribute('aria-label',config.responseLabels?.[slot]||'Ô '+(slot+1));blank.value=String(value);paragraph.append(blank);slot++;}}root.append(paragraph);
    }
  }else if(config.responseCount){
    const list=node('ol');for(let index=0;index<config.responseCount;index++){const li=node('li'),input=node('input');input.readOnly=true;input.value=String(values(rawAnswer)[index]??'');input.setAttribute('aria-label',config.responseLabels?.[index]||'Ô '+(index+1));li.append(node('span',(config.responseLabels?.[index]||'Ô '+(index+1))+' '),input);list.append(li);}root.append(list);
  }else if(item.layoutType==='keyword_selection'){
    const line=node('p','','keyword-line');for(const option of options){const word=node('span',option.label+' ');if(selected.has(option.id))word.style.textDecoration='underline';line.append(word);}root.append(line);
  }else if(item.interactionType==='number_score'){
    root.append(node('p',rawAnswer==null?'… / '+(config.max??'…'):text(rawAnswer),'thuy-review-score'));
  }else{
    const input=node(item.interactionType==='long_text'?'textarea':'input');input.readOnly=true;input.setAttribute('aria-label','Câu trả lời câu '+display.number);input.value=text(rawAnswer);root.append(input);
  }
  if(correctAnswer!=null)root.append(node('p',(reference?'Đáp án tham khảo: ':'Đáp án đúng: ')+text(values(correctAnswer).map(value=>options.find(o=>o.id===value)?.label??value)),'thuy-review-key'));
  if(explanation)root.append(node('p','Giải thích: '+explanation));return root;
}

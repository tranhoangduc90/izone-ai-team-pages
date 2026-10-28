// API giáo viên trả đáp án sau kiểm quyền; cập nhật nền chỉ thay câu có dữ liệu mới.
import {questionPresentation} from './question-presentation.js?rev=20261022-parity-v1';
const node=(tag,text='',className='')=>{const e=document.createElement(tag);e.textContent=text;e.className=className;return e;};
const views=new WeakMap();
const answerText=value=>Array.isArray(value)?value.map(v=>Array.isArray(v)?v.join(' / '):v).join(' · '):String(value||'');
export function renderThuyAnalytics(root,analytics,{definition}){
  let view=views.get(root);
  if(!view||!view.header.isConnected){
    const header=node('div','','thuy-analytics-heading'),summary=node('small'),workspace=node('div','','thuy-question-workspace');
    const navigation=node('div','','thuy-question-list'),detail=node('div','','thuy-question-detail');
    header.append(node('h2','Tổng quan lớp'),summary);workspace.append(navigation,detail);root.replaceChildren(header,workspace);
    view={header,summary,navigation,detail,rows:new Map(),groups:new Map(),selected:root.dataset.selectedItem||null};views.set(root,view);
  }
  const summary=`${analytics.submittedCount}/${analytics.rosterCount} học viên có bài nộp hiện hành`;
  if(view.summary.textContent!==summary)view.summary.textContent=summary;
  const sourceItems=new Map((definition?.blocks||[]).flatMap(b=>b.items).map(item=>[item.itemVersionId,item]));
  const group=item=>!item.objective?3:item.counts.incorrect>0?0:item.counts.graded>0?1:2;
  const items=[...analytics.items].sort((a,b)=>group(a)-group(b)||(b.counts.incorrect||0)-(a.counts.incorrect||0)||a.position-b.position);
  const ids=new Set(items.map(item=>item.itemVersionId));
  for(const [id,row]of view.rows)if(!ids.has(id)){row.choose.remove();row.card.remove();view.rows.delete(id);}
  if(!ids.has(view.selected))view.selected=items[0]?.itemVersionId||null;
  const choose=id=>{
    view.selected=id;root.dataset.selectedItem=id;
    const row=view.rows.get(id);if(row&&view.detail.firstElementChild!==row.card)view.detail.replaceChildren(row.card);
    for(const [key,value]of view.rows)value.choose.setAttribute('aria-pressed',String(key===id));
  };
  for(const [index,item]of items.entries()){
    const source=sourceItems.get(item.itemVersionId)||item,display=questionPresentation(source),number=source.displayNumber||item.position;
    let row=view.rows.get(item.itemVersionId);
    if(!row){const select=node('button','','thuy-question-select');select.type='button';select.dataset.itemId=item.itemVersionId;
      select.addEventListener('click',()=>choose(item.itemVersionId));row={choose:select,card:node('section','','thuy-question-card')};view.rows.set(item.itemVersionId,row);}
    const count=item.counts,wrong=count.incorrect||0,graded=count.graded||0;
    const label=`Câu ${number} · ${display.title}`;
    const state=!item.objective?'Không chấm điểm':wrong?`${wrong}/${graded} học viên đã chấm sai`:graded?'Chưa có học viên trả lời sai':'Chưa có kết quả chấm';
    const part=(definition?.blocks||[]).find(block=>block.items.some(question=>question.itemVersionId===item.itemVersionId));
    const skills=(source.skillCodes||[]).map(skill=>({general:'Chung',listening:'Listening',reading:'Reading',writing:'Writing',speaking:'Speaking'})[skill]||skill).join(', ');
    const type=source.layoutType==='matching_heading_dropdown'?'Dropdown':source.interactionType==='single_choice'?'Trắc nghiệm':source.interactionType==='multi_choice_group'?'Chọn nhiều đáp án':source.interactionType==='number_score'?'Tự báo điểm':source.interactionType==='long_text'?'Trả lời mở':'Điền từ';
    const percent=graded?new Intl.NumberFormat('vi-VN',{maximumFractionDigits:1}).format(wrong/graded*100)+'%':null;
    const metadata=[part?.title,skills,type].filter(Boolean).join(' · '),result=state+(item.objective&&percent?' · '+percent:'');
    const navLabel=JSON.stringify([label,metadata,result]);
    if(row.navLabel!==navLabel){row.choose.replaceChildren(node('span',label),node('small',metadata),node('small',result));row.navLabel=navLabel;}
    const fingerprint=JSON.stringify([item,source]);
    if(row.fingerprint!==fingerprint){
      const card=node('section','','thuy-question-card');card.append(node('small','Câu '+number),node('h3',display.title));
      if(source.helpText)card.append(node('p',source.helpText,'muted'));
      for(const option of item.options||source.options||[])card.append(node('p',option.label));
      for(const line of source.interactionConfig?.sentenceLines||[])card.append(node('p',line.parts.join(' […] ')));
      if(item.objective)card.append(node('h4','Đáp án đúng'),node('p',answerText(item.correctAnswer)||'Chưa đọc được đáp án chuẩn.'));
      const percent=graded?new Intl.NumberFormat('vi-VN',{maximumFractionDigits:1}).format(wrong/graded*100)+'%':'Chưa có mẫu số';
      card.append(node('p',item.objective?`${wrong}/${graded} học viên đã chấm trả lời sai · ${percent}`:
        `${count.answered}/${count.visible} đã trả lời · Không chấm đúng/sai`));
      card.append(node('small',`${count.pending||0} chờ chấm · ${count.manual||0} cần kiểm tra · ${count.ungraded||0} không chấm · ${count.hidden||0} không áp dụng`,'muted'));
      row.card=card;row.fingerprint=fingerprint;
    }
  }
  const desired=[];
  for(const [index,label]of ['Có học viên trả lời sai','Chưa có học viên trả lời sai','Chưa có kết quả chấm','Không chấm điểm'].entries()){
    const members=items.filter(item=>group(item)===index);if(!members.length)continue;
    let heading=view.groups.get(index);if(!heading){heading=node('h3','','thuy-question-group');view.groups.set(index,heading);}
    const text=label+' · '+members.length;if(heading.textContent!==text)heading.textContent=text;
    desired.push(heading,...members.map(item=>view.rows.get(item.itemVersionId).choose));
  }
  for(const child of [...view.navigation.children])if(!desired.includes(child))child.remove();
  for(const [index,child]of desired.entries())if(view.navigation.children[index]!==child)view.navigation.insertBefore(child,view.navigation.children[index]||null);
  if(view.selected)choose(view.selected);
  else if(view.detail.textContent!=='Chưa có câu hỏi để thống kê.')view.detail.replaceChildren(node('p','Chưa có câu hỏi để thống kê.','muted'));
}

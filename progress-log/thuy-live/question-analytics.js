// API giáo viên trả đáp án sau kiểm quyền; cập nhật nền chỉ thay câu có dữ liệu mới.
import {questionPresentation} from './question-presentation.js?rev=20261022-parity-v1';
import {questionReview} from './question-review.js?rev=20261030-the17-19-v1';
const node=(tag,text='',className='')=>{const e=document.createElement(tag);e.textContent=text;e.className=className;return e;};
import {createQuestionResponses} from './question-responses.js?rev=20261114-response-sync';
const views=new WeakMap();

export function clearThuyAnalytics(root){views.get(root)?.responses.clear();}
export function refreshThuyResponses(root){views.get(root)?.responses.refresh();}
export function renderThuyAnalytics(root,analytics,{definition,readResponses,syncResponses}){
  let view=views.get(root);
  if(!view||!view.header.isConnected||view.assignmentId!==analytics.assignmentId){
    view?.responses.clear();
    const header=node('div','','thuy-analytics-heading'),summary=node('small'),workspace=node('div','','thuy-question-workspace');
    const navigation=node('div','','thuy-question-list'),detail=node('div','','thuy-question-detail');
    const review=node('div'),responses=createQuestionResponses();
    detail.append(review,responses.section);
    header.append(node('h2','Tổng quan lớp'),summary);workspace.append(navigation,detail);root.replaceChildren(header,workspace);
    view={header,summary,navigation,review,responses,assignmentId:analytics.assignmentId,rows:new Map(),groups:new Map(),selected:null};views.set(root,view);
  }
  const liveParts=Array.isArray(analytics.parts);
  const summary=`${analytics.submittedCount}/${analytics.rosterCount} học viên ${liveParts?'đã nộp ít nhất một phần':'có bài nộp hiện hành'}`;
  if(view.summary.textContent!==summary)view.summary.textContent=summary;
  const blocks=definition?.blocks||[];
  const sourceItems=new Map(blocks.flatMap(part=>part.items.map(item=>[item.itemVersionId,{item,part}])));
  const partCounts=new Map(analytics.parts?.map(part=>[part.blockId,part.submittedCount]));
  const group=item=>!item.objective?3:item.counts.incorrect>0?0:item.counts.graded>0?1:2;
  const items=[...analytics.items].sort((a,b)=>liveParts?a.position-b.position:
    group(a)-group(b)||(b.counts.incorrect||0)-(a.counts.incorrect||0)||a.position-b.position);
  const ids=new Set(items.map(item=>item.itemVersionId));
  for(const [id,row]of view.rows)if(!ids.has(id)){row.choose.remove();row.card.remove();view.rows.delete(id);}
  if(!ids.has(view.selected))view.selected=items[0]?.itemVersionId||null;
  view.choose=(id,open=false)=>{
    view.selected=id;root.dataset.selectedItem=id;
    const row=view.rows.get(id);
    if(row&&view.review.firstElementChild!==row.card)view.review.replaceChildren(row.card);
    view.responses.select({assignmentId:analytics.assignmentId,formVersionId:analytics.formVersionId,item:row?.item,read:readResponses,sync:syncResponses,open});
    for(const [key,value]of view.rows){
      const pressed=String(key===id);
      if(value.choose.getAttribute('aria-pressed')!==pressed)value.choose.setAttribute('aria-pressed',pressed);
    }
  };
  for(const [index,item]of items.entries()){
    const {item:source=item,part}=sourceItems.get(item.itemVersionId)||{};
    const display=questionPresentation(source),number=source.displayNumber||item.position;
    let row=view.rows.get(item.itemVersionId);
    if(!row){const select=node('button','','thuy-question-select');select.type='button';select.dataset.itemId=item.itemVersionId;
      select.addEventListener('click',()=>view.choose(item.itemVersionId,true));row={choose:select,card:node('section','','thuy-question-card')};view.rows.set(item.itemVersionId,row);}
    row.item=item;
    const count=item.counts,wrong=count.incorrect||0,graded=count.graded||0;
    const label=`Câu ${number} · ${display.title}`;
    const state=!item.objective?'Không chấm điểm':wrong?`${wrong}/${graded} học viên đã chấm sai`:graded?'Chưa có học viên trả lời sai':'Chưa có kết quả chấm';
    const skills=(source.skillCodes||[]).map(skill=>({general:'Chung',listening:'Listening',reading:'Reading',writing:'Writing',speaking:'Speaking'})[skill]||skill).join(', ');
    const type=source.layoutType==='matching_heading_dropdown'?'Dropdown':source.interactionType==='single_choice'?'Trắc nghiệm':source.interactionType==='multi_choice_group'?'Chọn nhiều đáp án':source.interactionType==='number_score'?'Tự báo điểm':source.interactionType==='long_text'?'Trả lời mở':'Điền từ';
    const percent=graded?new Intl.NumberFormat('vi-VN',{maximumFractionDigits:1}).format(wrong/graded*100)+'%':null;
    const metadata=[part?.title,skills,type].filter(Boolean).join(' · ');
    const submittedLabel=`${count.answered} đã trả lời`;
    const gradeLabel=item.objective?`${count.correct||0} đúng · ${wrong} sai${count.pending?` · ${count.pending} chờ chấm`:''}`:'Không chấm điểm';
    const primary=liveParts?submittedLabel:item.objective&&graded?wrong+'/'+graded+' sai':state;
    const secondary=liveParts?gradeLabel:item.objective&&percent?percent+' sai':'';
    const navLabel=JSON.stringify([label,metadata]);
    if(row.navLabel!==navLabel){
      const copy=node('span','','thuy-question-copy'),stats=node('span','','thuy-question-stats');
      copy.append(node('span',label),node('small',metadata));
      row.primary=node('strong');row.secondary=node('small');
      stats.append(row.primary,row.secondary);row.choose.replaceChildren(copy,stats);row.navLabel=navLabel;
    }
    if(row.primary.textContent!==primary)row.primary.textContent=primary;
    if(row.secondary.textContent!==secondary)row.secondary.textContent=secondary;
    const fingerprint=JSON.stringify([item.correctAnswer,item.referenceAnswer,item.correctOptionIds,item.explanation,item.objective,source]);
    if(row.fingerprint!==fingerprint){
      const card=node('section','','thuy-question-card');
      const expectedIds=item.correctOptionIds||[];
      card.append(questionReview(source,{correctAnswer:item.correctAnswer??item.referenceAnswer,expectedIds,explanation:item.explanation,reference:!item.objective}));
      row.totals=node('p');
      card.append(row.totals);
      row.card=card;row.fingerprint=fingerprint;
    }
    const totals=liveParts?`${submittedLabel} · ${count.submitted} đã nộp phần · ${gradeLabel}`:
      item.objective?`${wrong}/${graded} học viên đã chấm trả lời sai · ${percent||'Chưa có mẫu số'}`:
        `${count.answered}/${count.visible} đã trả lời · Không chấm đúng/sai`;
    if(row.totals.textContent!==totals)row.totals.textContent=totals;
  }
  const desired=[];
  const groups=liveParts&&blocks.length?blocks.map(part=>({key:part.blockId,
    text:`${part.title} · ${partCounts.get(part.blockId)||0}/${analytics.rosterCount} đã nộp phần`,
    members:items.filter(item=>sourceItems.get(item.itemVersionId)?.part===part)})):
    ['Thống kê theo câu hỏi','Chưa có học viên trả lời sai','Chưa có kết quả chấm','Không chấm điểm']
      .map((label,key)=>{
        const members=items.filter(item=>group(item)===key);
        return {key,text:label+' · '+members.length,members};
      });
  for(const {key,text,members} of groups){
    if(!members.length)continue;
    let heading=view.groups.get(key);if(!heading){heading=node('h3','','thuy-question-group');view.groups.set(key,heading);}
    if(heading.textContent!==text)heading.textContent=text;
    desired.push(heading,...members.map(item=>view.rows.get(item.itemVersionId).choose));
  }
  for(const child of [...view.navigation.children])if(!desired.includes(child))child.remove();
  for(const [index,child]of desired.entries())if(view.navigation.children[index]!==child)view.navigation.insertBefore(child,view.navigation.children[index]||null);
  if(view.selected)view.choose(view.selected);
  else {view.responses.clear();if(view.review.textContent!=='Chưa có câu hỏi để thống kê.')view.review.replaceChildren(node('p','Chưa có câu hỏi để thống kê.','muted'));}
}

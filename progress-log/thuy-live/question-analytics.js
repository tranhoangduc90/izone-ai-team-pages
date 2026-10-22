// Thống kê từ API đã kiểm quyền; chỉ mở danh sách người khi giảng viên cần đối chiếu.
import {bindDialogDismiss} from '../session-comments.js';
import {questionPresentation} from './question-presentation.js?rev=20261022-parity-v1';
const node=(tag,text='',className='')=>{const e=document.createElement(tag);e.textContent=text;e.className=className;return e;};
export function renderThuyAnalytics(root,analytics,{onStudent,definition}){
 const sourceItems=new Map((definition?.blocks||[]).flatMap(block=>block.items).map(item=>[item.itemVersionId,item]));
 const header=node('div','','thuy-analytics-heading');header.append(node('h2','Thống kê theo câu hỏi'),node('small',`${analytics.submittedCount}/${analytics.rosterCount} học viên có bài nộp hiện hành`));
 const list=node('div','','thuy-question-workspace'),navigation=node('div','','thuy-question-list'),detail=node('div','','thuy-question-detail');list.append(navigation,detail);
 for(const item of [...analytics.items].sort((a,b)=>(b.counts.incorrect||0)-(a.counts.incorrect||0))){
  const number=sourceItems.get(item.itemVersionId)?.displayNumber||item.position;
  const source=sourceItems.get(item.itemVersionId),display=questionPresentation(source||item),card=node('section','','thuy-question-card');
  card.append(node('small','Câu '+number),node('h3',display.title),node('p',item.objective?`${item.counts.incorrect}/${item.counts.graded} đã chấm sai`:`${item.counts.answered}/${item.counts.visible} đã trả lời · Không tự chấm đúng/sai`));
  if(source?.helpText)card.append(node('p',source.helpText,'muted'));
  for(const option of source?.options||[])card.append(node('p',option.label));
  for(const line of source?.interactionConfig?.sentenceLines||[])card.append(node('p',line.parts.join(' […] ')));
  if(item.objective)card.append(node('p','Dữ liệu phân tích hiện chưa kèm đáp án chuẩn; không suy đáp án từ số người chọn.','muted'));
  const open=node('button','Xem phân bố và học viên','button');open.type='button';
  open.addEventListener('click',()=>{
   const dialog=node('dialog','','thuy-question-distribution'),head=node('header','','thuy-distribution-head'),title=node('h2','Phân bố câu '+number),close=node('button','×','button');close.type='button';close.setAttribute('aria-label','Đóng phân bố');
   close.addEventListener('click',()=>dialog.close());head.append(title,close);dialog.append(head,node('p',item.prompt));
   const counts=item.counts;dialog.append(node('p',`${counts.submitted} bài nộp · ${counts.answered} đã trả lời · ${counts.unanswered} để trống · ${counts.hidden} không áp dụng`,'muted'));
   for(const choice of item.choices||[])dialog.append(node('p',`${choice.label}: ${choice.count} học viên chọn`));
   const people=node('div','','thuy-distribution-people');
   for(const student of item.students||[]){const button=node('button',student.name+(student.discriminator?' · '+student.discriminator:''),'button');button.type='button';button.addEventListener('click',()=>{dialog.close();onStudent(student,item.itemVersionId);});people.append(button);}
   if(!people.childElementCount)people.append(node('p','Chưa có bài nộp để đối chiếu học viên.','muted'));dialog.append(people);
   document.body.append(dialog);bindDialogDismiss(dialog);dialog.addEventListener('close',()=>{dialog.remove();if(open.isConnected)open.focus({preventScroll:true});},{once:true});dialog.showModal();
  });card.append(open);
  const choose=node('button','Câu '+number+' · '+display.title,'thuy-question-select');choose.type='button';choose.append(node('small',item.objective?item.counts.incorrect+'/'+item.counts.graded+' đã chấm sai':item.counts.answered+'/'+item.counts.visible+' đã trả lời'));
  choose.addEventListener('click',()=>{detail.replaceChildren(card);for(const button of navigation.querySelectorAll('button'))button.setAttribute('aria-pressed',String(button===choose));});navigation.append(choose);if(!detail.childElementCount){detail.append(card);choose.setAttribute('aria-pressed','true');}
 }
 if(!analytics.items.length)list.append(node('p','Chưa có câu hỏi để thống kê.','muted'));
 root.replaceChildren(header,list);
}

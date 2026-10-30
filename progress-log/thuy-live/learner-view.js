// Đầu vào là trạng thái thật của app chung. Chỉ sắp xếp các phần trong một trang;
// mở phần, lưu, nộp và quyền đáp án vẫn lấy từ máy chủ, không dùng kho dữ liệu demo.
import {partFeedback} from './part-feedback.js?rev=20261030-the17-19-v1';
function node(tag,text='',className='') {const e=document.createElement(tag);e.textContent=text;e.className=className;return e;}
export function renderThuyLearner({state,elements,blocks,buildQuestions,canSubmit,releaseFor,onSubmit,onRetry,onJourney,onRefresh}) {
  const root=elements.questionList,expanded=state.thuyExpanded??=new Set();
  root.replaceChildren();
  elements.checkpointLabel.textContent=`${state.assignment.class.name} · BUỔI ${state.assignment.sessionNumber}`;
  elements.checkpointTitle.textContent=state.assignment.definition.title;
  elements.checkpointInstructions.textContent=state.assignment.definition.instructions||'';
  elements.checkpointInstructions.hidden=!elements.checkpointInstructions.textContent;
  const count=blocks.filter(b=>state.checkpointSubmissions.has(b.blockId)).length;
  const savedResult=state.thuyReadOnly?{items:(state.thuyReadOnly.gradingItems||[]).map(item=>({
    ...item,rawAnswer:state.responses[item.itemVersionId]??null
  }))}:null;
  const progress=node('div','','thuy-progress');
  progress.append(node('strong',state.thuyReadOnly?'Phiếu đã nộp · Chỉ đọc':`Đã nộp ${count}/${blocks.length} phần`),node('span',count||state.thuyReadOnly?'Đã nhận bài trong Progress Log':'Chưa ghi nhận tham gia',count||state.thuyReadOnly?'badge green':'badge'));
  root.append(progress);
  if(state.thuyCompletionError) {
    const error=node('div','','thuy-inline-error');error.setAttribute('role','alert');
    error.append(node('p',state.thuyCompletionError));const retry=node('button','Thử hoàn tất phiếu','button primary');retry.type='button';retry.addEventListener('click',onRetry);error.append(retry);root.append(error);
  }
  for(const [index,block] of blocks.entries()) {
    const submitted=state.thuyReadOnly||state.checkpointSubmissions.has(block.blockId),release=releaseFor(block),open=!release||release.status==='open';
    const part=node('section','','thuy-part');part.dataset.part=block.blockId;
    const head=node('div','','thuy-part-head'),copy=node('div');
    copy.append(node('small',`PHẦN ${index+1}`),node('h2',block.title));
    head.append(copy,node('span',submitted?'Đã nộp':open?'Đã mở':release?.status==='closed'?'Đã đóng':'Chưa mở',submitted?'badge green':open?'badge blue':'badge'));
    part.append(head);
    if(expanded.has(block.blockId)) {
      const body=node('div','','thuy-part-body');if(block.instructions)body.append(node('p',block.instructions,'help'));
      const feedback=submitted?partFeedback(block,state.submissionPayload?.result||state.checkpointSubmissions.get(block.blockId)?.result||savedResult):null;
      if(feedback)body.append(feedback);else body.append(...buildQuestions(block.items.filter(i=>i.layoutType!=='inline_option_text')));
      const locked=submitted||!open||!canSubmit||Boolean(state.submissionPayload)||state.submitting;
      for(const control of body.querySelectorAll('input,textarea,select,button.keyword-word'))control.disabled=locked;
      if(submitted)body.append(node('p','Đã nhận phần này · Bài làm chỉ đọc.','thuy-readonly'));
      else if(open&&canSubmit&&!state.submissionPayload) {
        const submit=node('button',state.submitting?'Đang nhận bài…':'Nộp phần này','button primary');submit.type='button';submit.dataset.thuySubmit='';submit.disabled=state.submitting;
        submit.addEventListener('click',()=>onSubmit(index));body.append(submit);
      } else body.append(node('p',!canSubmit?'Phiếu đã khóa nhận bài; nội dung đang làm được giữ lại.':'Giảng viên đã đóng phần này. Nháp của bạn được giữ.','thuy-readonly'));
      part.append(body);
      const collapse=node('button','Thu gọn','button text-button');collapse.type='button';collapse.addEventListener('click',()=>{expanded.delete(block.blockId);onRefresh();});part.append(collapse);
    } else if(submitted||open) {
      const start=node('button',submitted?'Xem bài đã nộp':canSubmit?'Tiếp tục làm':'Xem nháp đã giữ',submitted?'button':'button primary');start.type='button';
      if(!submitted&&!Object.keys(state.responses).some(id=>block.items.some(i=>i.itemVersionId===id)))start.textContent=canSubmit?'Bắt đầu làm':'Xem phần này';
      start.addEventListener('click',()=>{expanded.add(block.blockId);onRefresh();});part.append(start);
    } else part.append(node('p','Chờ giảng viên mở phần này.','muted'));
    root.append(part);
  }
  elements.previousButton.hidden=elements.nextButton.hidden=elements.submitButton.hidden=true;
  elements.progressBar.style.width=`${blocks.length?count/blocks.length*100:0}%`;
  const journey=node('button','Kết quả học tập','button');journey.type='button';journey.addEventListener('click',onJourney);root.append(journey);
}

/* Dữ liệu vào: DOM do bộ làm bài hiện hành dựng. Di chuyển nguyên control để giữ handler/identity/nháp.
   Chỉ thêm nhận diện và thu phần ghi nhớ ít dùng; không thay điểm, trạng thái lưu/nộp hoặc thời gian. */
(()=>{
 document.body.classList.add('design67');
 const markFilled=event=>{if(event.target.matches('.question input,.question select'))event.target.dataset.designFilled=String(Boolean(event.target.value.trim()));};
 document.addEventListener('input',markFilled);document.addEventListener('change',markFilled);
 let frame=0;
 function refresh(){
  frame=0;
  // Gom hướng dẫn với đúng phần trả lời, giữ nguyên các node để không mất handler/nháp.
  // Bản so sánh A/B/C riêng vẫn dùng cấu trúc riêng để đối chiếu lịch sử.
  if(!new URLSearchParams(location.search).has('instruction')){
    const boundary='.cbt-subsection-heading,.cbt-section-intro,.cbt-section-pager,.cbt-map-workspace,.design-question-group';
    for(const heading of document.querySelectorAll('.cbt-subsection-heading,.cbt-listening-section>.cbt-section-intro')){
      if(heading.closest('.design-question-group'))continue;
      if(heading.parentElement.matches('.cbt-map-workspace')){
        heading.parentElement.classList.add('design-question-group','design-map-group');continue;
      }
      const body=[];let next=heading.nextElementSibling;
      while(next&&!next.matches(boundary)){body.push(next);next=next.nextElementSibling;}
      if(!body.length)continue;
      const group=document.createElement('section');group.className='design-question-group';
      const content=document.createElement('div');content.className='design-question-content';
      heading.before(group);content.append(...body);group.append(heading,content);
    }
  }
  for(const select of document.querySelectorAll('.question select')){const first=select.options[0];if(first?.value===''&&first.textContent.includes('Nhấn'))first.textContent='Chọn…';}
  for(const legend of document.querySelectorAll('.cbt-nav-legend'))if(legend.textContent.includes('Xanh lá'))legend.textContent='Navy đậm: đang chọn · Navy nhạt: đã trả lời · Gạch vàng: cần xem lại';
  for(const field of document.querySelectorAll('.question select,.question input'))field.dataset.designFilled=String(Boolean(field.value.trim()));
  // Chỉ thêm nhãn khi hộp bài chấm đã được renderer gốc tạo; không suy điểm tốt/xấu.
  for(const header of document.querySelectorAll('.writing-feedback-header'))if(!header.querySelector('.design-feedback-status')){
    const copy=header.firstElementChild,title=copy?.querySelector('h2');
    if(title){const status=document.createElement('span');status.className='design-feedback-status';status.textContent='Đã có bài chấm';copy.insertBefore(status,title);}
  }
  // Màu lưu bám vào thông báo thật đã dựng, không tự coi thao tác nhập là lưu thành công.
  for(const status of document.querySelectorAll('.writing-editor-meta>span:first-child,.writing-outline-status')){
    const message=status.textContent.trim();
    status.dataset.designStatus=/^(Đã lưu trên hệ thống|Dàn ý đã lưu riêng)/.test(message)?'saved':/^(Chưa lưu được|Lỗi)/.test(message)?'error':'pending';
  }
  const bar=document.querySelector('.topbar');
  if(bar&&!bar.querySelector('.design-brand')){
    const brand=document.createElement('span');brand.className='design-brand';brand.textContent='IZONE';brand.setAttribute('aria-label','IZONE');bar.prepend(brand);
  }
  const reading=document.getElementById('readingView');
  const toolbar=reading?.querySelector('.cbt-toolbar');
  if(toolbar&&!toolbar.querySelector('.reading-view-switch')){
    const switcher=document.createElement('nav');switcher.className='reading-view-switch';switcher.setAttribute('aria-label','Vùng đọc và trả lời trên điện thoại');
    const showPane=(pane)=>{
      reading.dataset.designPane=pane;
      for(const b of switcher.children)b.setAttribute('aria-pressed',String(b.dataset.pane===pane));
    };
    for(const [pane,label] of [['passage','Bài đọc'],['questions','Câu hỏi']]){
      const button=document.createElement('button');button.type='button';button.dataset.pane=pane;button.textContent=label;
      button.addEventListener('click',()=>showPane(pane));switcher.append(button);
    }
    toolbar.append(switcher);showPane(new URLSearchParams(location.search).get('pane')==='questions'?'questions':'passage');
    reading.addEventListener('click',event=>{
      if(event.target.closest('.cbt-question-button,.cbt-review-question')&&matchMedia('(max-width:980px)').matches)showPane('questions');
    },true);
  }
  const writing=document.getElementById('writingView');
  const header=writing?.querySelector('.writing-exam-header');
  if(header&&!header.querySelector('.writing-view-switch')){
    const switcher=document.createElement('nav');switcher.className='writing-view-switch';switcher.setAttribute('aria-label','Đề bài và bài làm trên điện thoại');
    const showPane=(pane)=>{writing.dataset.designPane=pane;for(const b of switcher.children)b.setAttribute('aria-pressed',String(b.dataset.pane===pane));};
    for(const [pane,label] of [['prompt','Đề bài'],['answer','Bài làm']]){
      const button=document.createElement('button');button.type='button';button.dataset.pane=pane;button.textContent=label;
      button.addEventListener('click',()=>showPane(pane));switcher.append(button);
    }
    header.append(switcher);showPane('prompt');
    writing.addEventListener('click',event=>{if(event.target.closest('.writing-task-tab,#previousWritingTask,#nextWritingTask')&&matchMedia('(max-width:980px)').matches)showPane('answer');},true);
  }
  const panel=document.querySelector('.cbt-identity-panel');
  const checkbox=document.getElementById('remember-student');
  if(panel&&checkbox&&!checkbox.closest('.identity-options')){
    const options=document.createElement('details');options.className='identity-options';
    const summary=document.createElement('summary');summary.textContent='Danh tính & ghi nhớ';
    const body=document.createElement('div');body.className='identity-options-body';
    const label=checkbox.closest('label');
    const nodes=[label,document.getElementById('remember-student-status'),document.getElementById('confirm-remembered-student'),document.getElementById('change-remembered-student')].filter(Boolean);
    body.append(...nodes);options.append(summary,body);panel.append(options);
    const confirm=document.getElementById('confirm-remembered-student');
    const ensureConfirm=()=>{if(confirm&&!confirm.hidden)options.open=true;};
    if(confirm)new MutationObserver(ensureConfirm).observe(confirm,{attributes:true,attributeFilter:['hidden']});
    ensureConfirm();
  }
 }
 const observer=new MutationObserver(()=>{if(!frame)frame=requestAnimationFrame(refresh);});
 observer.observe(document.getElementById('app'),{subtree:true,childList:true});
 const dialogs=new MutationObserver(records=>{if(records.some(record=>[...record.addedNodes].some(node=>node.nodeType===1&&node.matches('.writing-feedback-dialog'))))refresh();});
 dialogs.observe(document.body,{childList:true});
 refresh();
 window.addEventListener('pagehide',()=>{observer.disconnect();dialogs.disconnect();},{once:true});
})();

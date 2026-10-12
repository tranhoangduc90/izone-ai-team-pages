// Chọn thành phần màu → tìm đúng vùng đang dùng màu đó, giữ nguyên câu trả lời.
// Chỉ cuộn khi đổi trường hoặc bấm tìm lại; nhập/đổi preset không kéo trang liên tục.
(()=>{
 const root=document.getElementById('demo-color-lab');if(!root||root.dataset.locator)return;root.dataset.locator='true';
 const header='.demo-lobby-header,.design-question-group>.cbt-subsection-heading,.design-question-group>.cbt-section-intro,.writing-pane-header,.writing-criterion-card>header,.sample-heading';
 const badge='.demo-lobby-badge,.design-question-group>.cbt-subsection-heading>:is(h3,h4),.design-question-group>.cbt-section-intro>:is(h3,h4),.sample-heading h3';
 const primary='.button-primary,.button.primary,.cbt-heading-submit,.cbt-review-open';
 const selected='.cbt-choice:has(input:checked),.cbt-inline-answer.is-answered input,.cbt-select-answer.is-answered select,.question [data-design-filled=true],.sample-field input';
 const rose='.demo-lobby-step .button-secondary,.cbt-part-button.is-active,.writing-task-tab.is-active,.writing-component-toggle,.cbt-section-page-button,.sample-actions a';
 const success='.demo-lobby-step[data-state=complete] .demo-lobby-status,.notice.success,.design-feedback-status,.analysis-card.best,.sample-success';
 const flag='.cbt-flag-button.is-flagged,.sample-flag';
 const selectors={header,badge,badgeText:badge,hint:header,edge:'.demo-lobby-card,.design-question-group,.writing-criterion-card,.sample-group',line:'.demo-lobby-card,.design-question-group,.writing-criterion-card,.sample-group',surface:'.demo-lobby-steps,.design-question-content,.cbt-passage-body,.writing-prompt-body,.writing-feedback-essay,.sample-body',ink:'.demo-lobby-steps,.design-question-content,.cbt-passage-body,.writing-feedback-essay,.sample-body',primary,primaryText:primary,selected,selectedText:selected,selectedLine:selected,rose,roseText:rose,success,successText:success,flag,flagText:flag};
 const note=document.createElement('p');note.className='lab-location-status';note.setAttribute('role','status');
 const again=document.createElement('button');again.type='button';again.textContent='Tìm lại vị trí';
 const next=document.createElement('button');next.type='button';next.textContent='Vị trí tiếp theo';
 const tools=document.createElement('div');tools.className='lab-location-tools';tools.append(again,next);
 const locationBox=document.createElement('div');locationBox.className='lab-location';locationBox.append(note,tools);root.querySelector('footer').prepend(locationBox);
 const strip=document.createElement('section');strip.className='lab-mini-adjust';strip.hidden=true;
 const reopen=document.createElement('button');reopen.type='button';reopen.textContent='Mở bảng';strip.append(reopen);root.append(strip);
 let active='',index=0,lastTarget=null,timer=0,moved=null,placeholder=null;
 const visible=n=>!n.closest('#demo-color-lab,[hidden],[inert]')&&n.getClientRects().length&&getComputedStyle(n).visibility!=='hidden';
 function candidates(){const dialog=[...document.querySelectorAll('dialog[open]')].at(-1);return [...(dialog||document).querySelectorAll(selectors[active]||'no-element')].filter(visible);}
 function restoreRow(){if(moved&&placeholder){placeholder.replaceWith(moved);moved=null;placeholder=null;}strip.hidden=true;root.classList.remove('lab-is-mini');}
 function compact(){
  if(!matchMedia('(max-width:600px)').matches)return;
  const row=root.querySelector('#lab-hex-'+active)?.closest('.lab-row');if(!row)return;
  restoreRow();placeholder=document.createElement('span');row.before(placeholder);moved=row;strip.prepend(row);strip.hidden=false;root.classList.add('lab-is-mini');
 }
 function revealMobilePane(){
  if(!['header','badge','badgeText','hint','edge','line','selected','selectedText','selectedLine'].includes(active))return;
  const switcher=document.querySelector('#readingView:not([hidden]) .reading-view-switch button[data-pane=questions]');
  if(switcher&&getComputedStyle(switcher.parentElement).display!=='none'&&switcher.getAttribute('aria-pressed')!=='true')switcher.click();
 }
 function locate(cycle=false){
  if(!active)return;revealMobilePane();let targets=candidates();
  if(!targets.length){note.textContent='Màn này chưa có “'+label()+'”. '+(active.startsWith('selected')?'Chọn một đáp án trong bản thử để xem màu này.':active.startsWith('flag')?'Đánh dấu một câu cần xem lại để xem màu cờ.':active.startsWith('success')?'Mở màn kết quả hoặc bài chấm để xem trạng thái hoàn thành.':'Chọn màn làm bài hoặc mở bài chấm có thành phần này.');next.disabled=true;return;}
  if(cycle)index=(index+1)%targets.length;else{const distances=targets.map(n=>Math.abs(n.getBoundingClientRect().top-innerHeight/3));index=distances.indexOf(Math.min(...distances));}
  const target=targets[index];if(lastTarget)lastTarget.classList.remove('lab-located');clearTimeout(timer);lastTarget=target;
  compact();target.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth',block:'center',inline:'nearest'});
  root.classList.toggle('lab-on-left',!matchMedia('(max-width:600px)').matches&&target.getBoundingClientRect().left>innerWidth/2-100);
  target.classList.add('lab-located');timer=setTimeout(()=>target.classList.remove('lab-located'),5000);
  note.textContent=label()+' · vị trí '+(index+1)+'/'+targets.length;next.disabled=targets.length<2;
 }
 function label(){return root.querySelector('#lab-hex-'+active)?.closest('.lab-row')?.querySelector('label')?.textContent||active;}
 function activate(event){const row=event.target.closest('.lab-row');if(!row)return;const id=row.querySelector('input[type=color]')?.id.replace('lab-color-','');if(!id||id===active)return;active=id;index=0;locate();}
 let pointerFocus=false;
 root.addEventListener('pointerdown',()=>{pointerFocus=true;});
 root.addEventListener('focusin',event=>{if(!pointerFocus)activate(event);});
 root.addEventListener('click',event=>{pointerFocus=false;activate(event);event.stopPropagation();});
 document.addEventListener('pointerup',()=>setTimeout(()=>{pointerFocus=false;},0));
 again.addEventListener('click',()=>locate());next.addEventListener('click',()=>locate(true));
 reopen.addEventListener('click',()=>{restoreRow();root.querySelector('#lab-hex-'+active)?.focus({preventScroll:true});});
 root.querySelector('.lab-launch').addEventListener('click',restoreRow);root.querySelector('.lab-collapse').addEventListener('click',restoreRow);
 root.addEventListener('keydown',e=>{if(e.key==='Escape')restoreRow();});
 note.textContent='Chọn tên thành phần hoặc ô màu để tìm vị trí trên trang.';
})();

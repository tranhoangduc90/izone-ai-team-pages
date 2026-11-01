// Kiểm nội dung theo cấu hình máy chủ; giữ việc nhập/sửa/lưu nháp khi chưa thể Check.
export const hasWritingContent = value => Boolean(String(value ?? '').replace(/[\s\u200B-\u200D\u2060\uFEFF]/gu, ''));
export function missingCheckFields(definitions, section, responses) {
  const definition = definitions.find(d => (d.section || d.key) === section);
  if (!definition) throw Error('Chưa đọc được cấu hình phần cần chấm. Hãy đọc cập nhật rồi thử lại.');
  const required = definition.requiredFields || definition.inputFields || [];
  const missing = required.filter(key => !hasWritingContent(responses[key]));
  return definition.validationMode === 'any' && missing.length < required.length ? [] : missing;
}
const labels = {
  body1_message:'Thông điệp chung của thân bài 1',body2_message:'Thông điệp chung của thân bài 2',
  body1_idea1:'Idea 1 của thân bài 1',body1_idea2:'Idea 2 của thân bài 1',body2_idea1:'Idea 1 của thân bài 2',body2_idea2:'Idea 2 của thân bài 2',
  body_choice:'Thân bài bạn sẽ luyện',topic_sentence:'Topic sentence của thân bài đã chọn',
  idea1_a:'Điểm đầu A · Ý 1',idea1_x:'Cầu nối X · Ý 1',idea1_b:'Điểm cuối B · Ý 1',
  idea2_a:'Điểm đầu A · Ý 2',idea2_x:'Cầu nối X · Ý 2',idea2_b:'Điểm cuối B · Ý 2',draft1:'Draft 1',draft2:'Draft 2',
};
export function createCheckFeedback({root, serverField, fieldLabel=key=>labels[key]||key}) {
  const missing = new Set();
  let owner, pending = false;
  if (!document.querySelector('[data-writing-check-style]')) {
    const style=document.createElement('link');style.rel='stylesheet';style.href=new URL('./writing-check-feedback.css?v=20261101-v1',import.meta.url).href;style.dataset.writingCheckStyle='';document.head.append(style);
  }
  function controls() { return [...root.querySelectorAll('[data-check],[data-action="grade"]')]; }
  function target(key, values) {
    return [...root.querySelectorAll('[data-field],#body-choice')].find(el => (el.id === 'body-choice' ? 'body_choice' : serverField(el.dataset.field,values.body_choice)) === key);
  }
  function focusField(key, values) {
    const el = target(key,values);if (!el) return;
    for (let p=el.parentElement;p;p=p.parentElement) if(p.tagName==='DETAILS') p.open=true;
    el.scrollIntoView({block:'center'});el.focus({preventScroll:true});
  }
  function sync(values, sessionRef) {
    if (owner !== sessionRef) { missing.clear();owner=sessionRef;pending=false;root.querySelector('#writing-check-dialog')?.remove(); }
    for (const key of missing) if (hasWritingContent(values[key])) missing.delete(key);
    for (const el of root.querySelectorAll('[data-field],#body-choice')) {
      const key=el.id==='body-choice'?'body_choice':serverField(el.dataset.field,values.body_choice),invalid=missing.has(key);
      const hintId=el.id+'-check-hint';let hint=root.querySelector('#'+hintId);
      el.classList.toggle('writing-check-invalid',invalid);
      if (invalid) {
        el.setAttribute('aria-invalid','true');
        const described=new Set((el.getAttribute('aria-describedby')||'').split(/\s+/).filter(Boolean));described.add(hintId);el.setAttribute('aria-describedby',[...described].join(' '));
        if (!hint) {hint=document.createElement('small');hint.id=hintId;hint.className='writing-check-hint';el.after(hint);}
        hint.textContent='Cần bổ sung: '+fieldLabel(key)+'.';
      } else if (hint) {
        hint.remove();el.removeAttribute('aria-invalid');
        const rest=(el.getAttribute('aria-describedby')||'').split(/\s+/).filter(id=>id!==hintId);if(rest.length)el.setAttribute('aria-describedby',rest.join(' '));else el.removeAttribute('aria-describedby');
      }
    }
    for (const button of controls()) {
      if (pending && !button.disabled) {button.dataset.checkWaiting=button.textContent;button.disabled=true;button.setAttribute('aria-busy','true');button.textContent='Đang lưu và gửi chấm…';}
      else if (!pending && button.dataset.checkWaiting) {button.textContent=button.dataset.checkWaiting;delete button.dataset.checkWaiting;button.disabled=false;button.removeAttribute('aria-busy');}
    }
  }
  function modal(title, text, fields, onClose) {
    root.querySelector('#writing-check-dialog')?.remove();
    const dialog=document.createElement('dialog');dialog.id='writing-check-dialog';dialog.className='writing-check-dialog';dialog.setAttribute('aria-labelledby','writing-check-title');dialog.setAttribute('aria-describedby','writing-check-description');
    const heading=document.createElement('h2');heading.id='writing-check-title';heading.textContent=title;
    const description=document.createElement('p');description.id='writing-check-description';description.textContent=text;
    dialog.append(heading,description);
    if (fields.length) {const list=document.createElement('ul');for(const key of fields){const li=document.createElement('li');li.textContent=fieldLabel(key);list.append(li);}dialog.append(list);}
    const button=document.createElement('button');button.className='primary';button.textContent=fields.length?'Đến ô cần bổ sung':'Quay lại bài làm';dialog.append(button);
    function close(){dialog.remove();onClose();}
    button.addEventListener('click',close);dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
    let outside=false;const isOutside=e=>{const r=dialog.getBoundingClientRect();return e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom;};
    dialog.addEventListener('pointerdown',e=>outside=e.target===dialog&&isOutside(e));dialog.addEventListener('pointerup',e=>{if(outside&&e.target===dialog&&isOutside(e))close();outside=false;});
    root.append(dialog);dialog.showModal();button.focus();
  }
  return {
    sync,
    pending(value,values,sessionRef){pending=value;sync(values,sessionRef);},
    clear(){missing.clear();root.querySelector('#writing-check-dialog')?.remove();},
    missing(fields,values,sessionRef){for(const key of fields)missing.add(key);sync(values,sessionRef);modal('Chưa thể gửi chấm','Bạn cần điền đủ các ô sau. Nội dung đã nhập được giữ nguyên.',fields,()=>focusField(fields[0],values));},
    error(error,button){const text=error.name==='TimeoutError'||error.name==='AbortError'?'Chưa nhận được xác nhận từ máy chủ. Nội dung vẫn được giữ. Hãy đọc cập nhật trước khi thử lại.':error.message||'Chưa gửi được yêu cầu chấm. Nội dung vẫn được giữ.';let hint=button?.parentElement?.querySelector('.writing-check-error');if(button&&!hint){hint=document.createElement('p');hint.className='writing-check-error';hint.setAttribute('role','alert');button.parentElement.append(hint);}if(hint)hint.textContent=text;modal('Chưa thể hoàn tất Check',text,[],()=>button?.focus());},
  };
}

// Nhận xét đã được server kiểm người/lớp/buổi. Chỉ dựng chữ; không thực thi HTML từ GV.
export function node(tag,value='',className='') {
  const element=document.createElement(tag);element.textContent=value;element.className=className;return element;
}
export function commentPanel(comment,{compact=false}={}) {
  if(!comment?.noteText || comment.visibility==='hidden') return null;
  const panel=node('section','','session-comment'+(compact?' compact':''));
  panel.dataset.sessionComment=String(comment.sessionNumber);
  panel.append(node('b',compact?'Nhận xét':'Nhận xét của giáo viên'));
  if(!compact) panel.append(node('small',[comment.authorDisplayName||'Giáo viên',
    comment.updatedAt?new Date(comment.updatedAt).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'}):''].filter(Boolean).join(' · ')));
  panel.append(node('p',comment.noteText));return panel;
}
export function latestComment(sessions,onOpen) {
  const session=[...sessions].filter(s=>s.sessionComment?.visibility!=='hidden'&&s.sessionComment?.noteText)
    .sort((a,b)=>Date.parse(b.sessionComment.updatedAt)-Date.parse(a.sessionComment.updatedAt))[0];
  if(!session) return null;
  const box=commentPanel(session.sessionComment);box.classList.add('latest-session-comment');
  box.prepend(node('small','LỜI NHẮN MỚI NHẤT TỪ GIÁO VIÊN','studentPortalEyebrow'),
    node('h2',`Buổi ${String(session.sessionNumber).padStart(2,'0')} · ${session.title||'Trong kế hoạch lớp'}`));
  const button=node('button','Xem lại buổi học này →','mini-action');button.type='button';
  button.addEventListener('click',()=>onOpen(session));box.append(button);return box;
}
export function paintJourneyComments(root,list,sessions,onOpen) {
  root.querySelector('.latest-session-comment')?.remove();
  const latest=latestComment(sessions,onOpen);if(latest){let host=list;while(host.parentElement!==root&&host.parentElement)host=host.parentElement;host.before(latest);}
  let filter=root.querySelector('.journey-comment-filter select');
  if(!filter){const label=node('label','Hiển thị','journey-comment-filter');filter=node('select');filter.setAttribute('aria-label','Lọc buổi học theo nhận xét');
    for(const [value,text] of [['all','Tất cả buổi học'],['comments','Buổi có nhận xét']]){const option=node('option',text);option.value=value;filter.append(option);}label.append(filter);list.before(label);}
  const apply=()=>{const visible=new Set(sessions.filter(s=>s.sessionComment?.noteText&&s.sessionComment.visibility!=='hidden').map(s=>String(s.sessionNumber)));
    for(const card of list.children)card.hidden=filter.value==='comments'&&!visible.has(card.dataset.sessionNumber);};
  filter.onchange=apply;apply();
}
export function bindDialogDismiss(dialog) {
  if(dialog.dataset.outsideDismiss)return;dialog.dataset.outsideDismiss='true';
  const outside=e=>{const r=dialog.getBoundingClientRect();return e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom;};
  let pressedOutside=false;
  dialog.addEventListener('pointerdown',e=>{pressedOutside=outside(e);});
  dialog.addEventListener('click',e=>{if(pressedOutside&&outside(e))dialog.close();pressedOutside=false;});
}
// Một lượt đọc mỗi 30 giây khi tab đang thấy; đổi người/view hủy response cũ.
export function createCommentPoller({request,context,onData,onError=()=>{}}) {
  let timer,controller,generation=0,disposed=false;
  const key=value=>JSON.stringify(value);
  async function refresh() {
    clearTimeout(timer);controller?.abort();const run=++generation,value=context();
    if(disposed||document.hidden||!value)return;
    controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),15000);
    try {
      const data=await request('/student/session-comments',{body:value,signal:controller.signal});
      if(run===generation&&key(context())===key(value)&&!disposed)onData(data,value);
    }catch(error){if(run===generation&&!disposed)onError(error);}
    finally{clearTimeout(timeout);if(run===generation&&!disposed)timer=setTimeout(refresh,30000);}
  }
  const visibility=()=>{if(document.hidden){clearTimeout(timer);controller?.abort();generation++;}else void refresh();};
  document.addEventListener('visibilitychange',visibility);
  return {refresh,stop(){disposed=true;generation++;clearTimeout(timer);controller?.abort();document.removeEventListener('visibilitychange',visibility);}};
}

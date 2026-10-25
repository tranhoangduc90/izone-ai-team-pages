export const docsProgressPending=value=>Boolean(value&&['pending','processing'].includes(value.status));
export function renderDocsProgress(value){
  let node=document.getElementById('docs-progress-status');
  const progress=document.querySelector('.submission-progress');
  const host=progress||document.getElementById('draft-status')?.parentElement;
  if(!node&&host){node=document.createElement('p');node.id='docs-progress-status';node.className='small muted';node.setAttribute('role','status');
    if(progress)progress.insertAdjacentElement('afterend',node);else host.append(node);}
  if(!node)return;
  node.hidden=!value;
  node.textContent=!value?'':value.status==='verified'?'Đã cập nhật tiến độ về Docs.':value.status==='blocked'
    ?'Bài đã được lưu. Chưa cập nhật được Docs; hệ thống cần kiểm tra lại.'
    :'Bài đã được lưu — đang cập nhật tiến độ về Docs…';
}

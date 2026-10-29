// Chỉ nhúng dịch vụ demo. Không dùng URL/token học viên hoặc fallback sang lớp thật.
import {bindDialogDismiss,node} from './session-comments.js';
export function mountWorksheetFrame(host,{grant,title}){
  const frame=node('iframe');frame.title='Xem trước như học viên · '+title;frame.className='thuy-library-preview';
  const url=new URL('./demo/thuy.html',import.meta.url);url.searchParams.set('view','worksheet');url.hash=new URLSearchParams({grant});
  frame.src=url.href;host.append(frame);return frame;
}
export function openWorksheetPreview({title,prepare,current=()=>true}){
  const opener=document.activeElement,dialog=node('dialog','','thuy-management-dialog thuy-library-detail thuy-worksheet-preview');
  const head=node('header','','thuy-management-head'),body=node('div','','thuy-management-body'),status=node('p','','notice');status.setAttribute('role','status');
  const close=node('button','×','button');close.type='button';close.setAttribute('aria-label','Đóng xem trước');close.addEventListener('click',()=>dialog.close());
  head.append(node('h2',title),close);body.append(status);dialog.append(head,body);document.body.append(dialog);bindDialogDismiss(dialog);
  let sequence=0;
  async function load(){
    const run=++sequence;body.replaceChildren(status);status.textContent='Đang mở phiếu xem trước…';status.hidden=false;
    try{const grant=await prepare();if(run!==sequence||!dialog.open)return;if(!current()){dialog.close();return;}
      mountWorksheetFrame(body,{grant,title});status.hidden=true;
    }catch(error){if(run!==sequence||!dialog.open)return;status.textContent='Chưa mở được bản xem trước: '+error.message;
      const retry=node('button','Thử mở lại','button');retry.type='button';retry.addEventListener('click',()=>void load());body.append(retry);
    }
  }
  dialog.addEventListener('close',()=>{sequence++;dialog.remove();if(opener?.isConnected)opener.focus({preventScroll:true});},{once:true});
  dialog.showModal();void load();return {close:()=>{sequence++;if(dialog.open)dialog.close();else dialog.remove();}};
}

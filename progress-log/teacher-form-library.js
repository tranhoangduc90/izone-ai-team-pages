// Kho có thật do API cấp; toàn hàng mở xem trước, nút sửa ở đầu, không tự giao bài.
import {bindDialogDismiss,node} from './session-comments.js';
const button=(text,action)=>{const b=node('button',text,'button');b.type='button';b.addEventListener('click',action);return b;};
export function createFormLibrary({host,request,onCopy}){
 let scope='izone',generation=0;const status=node('p','Chọn nguồn để đọc kho bài.');status.setAttribute('role','status');
 const nav=node('nav','','editor-library-tabs'),filter=node('select'),list=node('div');filter.setAttribute('aria-label','Lọc kỹ năng trong kho phiếu');
 for(const [value,label]of [['','Tất cả kỹ năng'],['listening','Listening'],['reading','Reading'],['speaking','Speaking'],['writing','Writing']]){const o=node('option',label);o.value=value;filter.append(o);}
 async function load(){const run=++generation;status.textContent='Đang đọc kho…';
  try{const reply=await request('/teacher/form-library?scope='+scope+'&skill='+filter.value);if(run!==generation)return;
   list.replaceChildren();status.textContent=reply.entries.length+' phiếu · '+(scope==='izone'?'Kho IZONE':'Của tôi');
   if(!reply.entries.length){list.append(node('p',scope==='izone'?'Chưa có bộ bài chuẩn được đưa vào Kho IZONE. Người phụ trách cần chuẩn bị và duyệt nội dung; các phiếu đã dùng không tự trở thành bài chuẩn.':'Chưa có phiếu lưu trong kho cá nhân. Mở hoặc soạn một nháp, rồi bấm Lưu vào Của tôi.'));return;}
   const table=node('table'),head=node('tr');for(const title of ['Tên bài tập','Kỹ năng','Nguồn'])head.append(node('th',title));const body=node('tbody');table.append(head,body);
   for(const entry of reply.entries){const row=node('tr');row.tabIndex=0;row.setAttribute('aria-label','Xem '+entry.title);
    const name=node('td');name.append(node('b',entry.title),node('small',entry.itemCount+' câu · '+new Date(entry.createdAt).toLocaleDateString('vi-VN')));
    row.append(name,node('td',entry.skills.map(s=>({listening:'Listening',reading:'Reading',speaking:'Speaking',writing:'Writing'})[s]||s).join(' · ')||'Chưa gắn kỹ năng'),node('td',scope==='izone'?'Kho IZONE':'Của tôi'));
    row.addEventListener('click',()=>void preview(entry));row.addEventListener('keydown',event=>{if(['Enter',' '].includes(event.key)){event.preventDefault();void preview(entry);}});body.append(row);}
   list.append(table);
  }catch(error){if(run===generation)status.textContent='Chưa đọc được kho: '+error.message;}
 }
 async function preview(entry){
  const opener=document.activeElement,d=node('dialog','','thuy-management-dialog'),head=node('header','','thuy-management-head'),body=node('div','','thuy-management-body');
  const close=button('×',()=>d.close());close.setAttribute('aria-label','Đóng');head.append(node('h2',entry.title),button('Sửa bài tập',async()=>{
   const result=await onCopy(entry);if(result!==false)d.close();
  }),close);d.append(head,body);body.append(node('p','Đang tải nội dung…'));document.body.append(d);bindDialogDismiss(d);d.showModal();
  d.addEventListener('close',()=>{d.remove();if(opener?.isConnected)opener.focus();},{once:true});
  try{const reply=await request('/teacher/form-library/'+entry.id);if(!d.open)return;
   if(reply.entry.id!==entry.id)throw Error('Phiếu trả về chưa khớp.');body.replaceChildren(node('p','Sửa tạo một bản nháp riêng tại lớp/buổi đang chọn; bài đã giao và bản trong kho được giữ nguyên.'));
   for(const block of reply.entry.definition.blocks){body.append(node('h3',block.title),node('p',block.instructions||''));for(const item of block.items){const card=node('section');card.append(node('b',item.prompt),node('p',item.helpText||''));for(const option of item.options||[])card.append(node('p',option.label));body.append(card);}}
  }catch(error){body.replaceChildren(node('p',error.message));}
 }
 for(const [value,label]of [['izone','Kho IZONE'],['personal','Của tôi']])nav.append(button(label,()=>{scope=value;for(const b of nav.querySelectorAll('button'))b.setAttribute('aria-pressed',String(b.textContent===label));void load();}));
 nav.firstElementChild.setAttribute('aria-pressed','true');filter.addEventListener('change',()=>void load());
 host.append(node('h2','Kho bài tập'),nav,filter,status,list);
 return {refresh:load,clear(){generation++;list.replaceChildren();status.textContent='Đăng nhập để mở kho bài.';}};
}

import {parseLinks,buildPayload,sendSubmission} from './contract.mjs';
// Nhận lớp từ link chung và tên từ phần sau dấu # của link cá nhân.
// Xóa phần tên khỏi thanh địa chỉ; không tải danh sách tên từ website công khai.
const form=document.querySelector('#submission');
const classInput=document.querySelector('#class'),student=document.querySelector('#student'),links=document.querySelector('#links');
const send=document.querySelector('#send'),result=document.querySelector('#result'),preview=document.querySelector('#preview');
const classCode=new URLSearchParams(location.search).get('class')||'';
const fragment=new URLSearchParams(location.hash.slice(1));
classInput.value=classCode;
student.value=(fragment.get('student')||'').normalize('NFC');
if(location.hash)history.replaceState(null,'',location.pathname+location.search);
let busy=false;
function status(message,state){result.textContent=message;result.dataset.state=state;}
if(classCode!=='IC2314'){send.disabled=true;status('Hãy mở đúng link IC2314 do giáo viên gửi.','error');}
links.addEventListener('input',()=>{
  if(!links.value.trim()){preview.textContent='';return;}
  try{preview.textContent=parseLinks(links.value).length+' link chia sẻ hợp lệ.';}
  catch(error){preview.textContent=error.message;}
});
form.addEventListener('submit',async event=>{
  event.preventDefault();if(busy)return;
  let payload;
  try{payload=buildPayload(classCode,student.value,parseLinks(links.value));}
  catch(error){status(error.message,'error');return;}
  busy=true;send.disabled=true;send.textContent='Đang gửi…';links.readOnly=true;student.readOnly=true;
  status('Đang gửi bài. Vui lòng chờ phản hồi.','waiting');
  try{
    await sendSubmission(payload);
    status('Hệ thống đã nhận yêu cầu gửi '+payload.records.length+' bài.\nBác sĩ AI sẽ xử lý tiếp; bạn xem kết quả trong bảng luyện tập cá nhân.','received');
    links.value='';preview.textContent='';
  }catch(error){
    status('Chưa xác nhận được bài đã nhận. Link bạn nhập vẫn được giữ.\nHãy kiểm tra bảng luyện tập hoặc báo giáo viên trước khi gửi lại.','error');
  }finally{busy=false;send.disabled=classCode!=='IC2314';send.textContent='Gửi bài bổ trợ';links.readOnly=false;student.readOnly=false;}
});

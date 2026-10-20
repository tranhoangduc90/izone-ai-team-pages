// Pages đọc file do người xem chọn vào bộ nhớ. Không gửi nội dung tới máy chủ.
// Các thao tác thử dùng cùng bộ nhớ mô phỏng với bản chạy local; đóng trang sẽ bỏ phiên.
import {createDemoStore} from './demo-store.mjs';
let store;
const channel=typeof BroadcastChannel==='function'?new BroadcastChannel('thuy-review-demo-v1'):null;
let currentPackage;
channel?.addEventListener('message',event=>{
  if(event.data?.kind==='request'&&store)channel.postMessage({kind:'snapshot',id:event.data.id,package:store.exportPackage()});
  if(event.data?.kind==='mutation'&&store){try{store.mutate(event.data.body);}catch{/* Trang gửi đã hiển thị lỗi; không đổi dữ liệu khi không hợp lệ. */}}
});
export const localAPI=['127.0.0.1','localhost'].includes(location.hostname)&&['7163','7164','7166'].includes(location.port)&&!new URLSearchParams(location.search).has('pages');
export async function preparePages(){
  // Một trang cùng phiên có thể chia sẻ file đã mở qua bộ nhớ trình duyệt, không qua mạng.
  const shared=await new Promise(resolve=>{
    if(!channel)return resolve(null);
    const id=crypto.randomUUID(),timer=setTimeout(()=>{channel.removeEventListener('message',receive);resolve(null);},350);
    const receive=event=>{if(event.data?.kind==='snapshot'&&event.data.id===id){clearTimeout(timer);channel.removeEventListener('message',receive);resolve(event.data.package);}};
    channel.addEventListener('message',receive);channel.postMessage({kind:'request',id});
  });
  if(shared){currentPackage=shared;store=createDemoStore(shared);return;}
  document.querySelector('#app').innerHTML=`<main class="fileEntry"><div class="brand"><div class="logo">IZONE</div><small>IELTS CHIẾN LƯỢC</small></div><h1>Progress Log · Bản demo của Thủy</h1><p>Mở file dữ liệu riêng của IC2305 để xem ba buổi gần nhất và lịch sử đã có. Nội dung chỉ được đọc trên trình duyệt này, không tải lên GitHub.</p><label class="btn primary" for="demo-file">Chọn file dữ liệu riêng</label><input id="demo-file" type="file" accept=".json,application/json"><p class="caption">File được bàn giao riêng cùng đường dẫn demo. Chưa chọn file thì không có dữ liệu học viên trên trang công khai.</p><p id="file-error" role="alert"></p></main>`;
  await new Promise(resolve=>document.querySelector('#demo-file').addEventListener('change',async event=>{
    const error=document.querySelector('#file-error');error.textContent='';
    try{
      const file=event.target.files[0];if(!file)return;
      if(file.size>15000000)throw Error('File quá lớn. Hãy chọn đúng gói dữ liệu demo đã bàn giao.');
      const value=JSON.parse(await file.text());
      if(value.format!=='thuy-review-data-v1'||value.data?.className!=='IC2305'||!Array.isArray(value.data.sessions)||value.data.sessions.length!==3)throw Error('Không đúng file dữ liệu IC2305 của bản demo này.');
      currentPackage=value;store=createDemoStore(value);resolve();
    }catch(e){error.textContent=e.message;event.target.value='';}
  }));
}
export async function pagesAPI(path,body){
  if(!store)throw Error('Chưa mở file dữ liệu riêng.');
  const url=new URL(path,location.href);
  if(body){if(url.pathname!=='/api/demo')throw Error('Không có tuyến ghi này.');const result=structuredClone(store.mutate(body));channel?.postMessage({kind:'mutation',body});return result;}
  if(url.pathname==='/api/teacher')return store.teacher();
  if(url.pathname==='/api/student')return store.student(url.searchParams.get('number'),url.searchParams.get('ref'),url.searchParams.get('generation'));
  throw Error('Không có tuyến dữ liệu này.');
}

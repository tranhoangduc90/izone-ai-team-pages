// Pages tải gói demo đã được Đức cho phép công bố vào bộ nhớ trình duyệt.
// Các thao tác thử dùng cùng bộ nhớ mô phỏng với bản chạy local; đóng trang sẽ bỏ phiên.
import {createDemoStore} from './demo-store.mjs';
let store;
const channel=typeof BroadcastChannel==='function'?new BroadcastChannel('thuy-review-demo-v1'):null;
channel?.addEventListener('message',event=>{
  if(event.data?.kind==='request'&&store)channel.postMessage({kind:'snapshot',id:event.data.id,package:store.exportPackage()});
  if(event.data?.kind==='mutation'&&store){try{store.mutate(event.data.body);}catch{/* Trang gửi đã hiển thị lỗi; không đổi dữ liệu khi không hợp lệ. */}}
});
export const localAPI=['127.0.0.1','localhost'].includes(location.hostname)&&['7163','7164','7166'].includes(location.port)&&!new URLSearchParams(location.search).has('pages');
export async function preparePages(){
  // Tab mới nhận trạng thái đang thử từ tab cũ; nếu chưa có phiên thì tải bản gốc.
  const shared=await new Promise(resolve=>{
    if(!channel)return resolve(null);
    const id=crypto.randomUUID(),timer=setTimeout(()=>{channel.removeEventListener('message',receive);resolve(null);},350);
    const receive=event=>{if(event.data?.kind==='snapshot'&&event.data.id===id){clearTimeout(timer);channel.removeEventListener('message',receive);resolve(event.data.package);}};
    channel.addEventListener('message',receive);channel.postMessage({kind:'request',id});
  });
  if(shared){store=createDemoStore(shared);return;}
  await new Promise(resolve=>{
    // Tải lỗi thì giữ thông báo và cho thử lại; chỉ mở giao diện khi gói hợp lệ.
    const load=async()=>{
      document.querySelector('#app').innerHTML=`<main class="fileEntry"><div class="brand"><div class="logo">IZONE</div><small>IELTS CHIẾN LƯỢC</small></div><h1>Progress Log · Bản demo của Thủy</h1><p id="load-status" role="status">Đang tải dữ liệu IC2305…</p><button id="retry-data" class="btn primary" hidden>Thử tải lại</button></main>`;
      try{
        const response=await fetch(new URL('./demo-data.json',import.meta.url),{cache:'no-cache',signal:AbortSignal.timeout(30000)});
        if(!response.ok)throw Error(`Không tải được dữ liệu demo (HTTP ${response.status}).`);
        const value=await response.json();
        if(value.format!=='thuy-review-data-v1'||value.data?.className!=='IC2305'||!Array.isArray(value.data.sessions)||value.data.sessions.length!==3)throw Error('Gói dữ liệu demo không đúng định dạng IC2305.');
        store=createDemoStore(value);resolve();
      }catch(e){
        document.querySelector('#load-status').textContent=`Chưa tải được dữ liệu IC2305. ${e.message} Hãy kiểm tra kết nối rồi thử lại.`;
        const retry=document.querySelector('#retry-data');retry.hidden=false;retry.addEventListener('click',load,{once:true});
      }
    };
    load();
  });
}
export async function pagesAPI(path,body){
  if(!store)throw Error('Chưa tải được dữ liệu demo.');
  const url=new URL(path,location.href);
  if(body){if(url.pathname!=='/api/demo')throw Error('Không có tuyến ghi này.');const result=structuredClone(store.mutate(body));channel?.postMessage({kind:'mutation',body});return result;}
  if(url.pathname==='/api/teacher')return store.teacher();
  if(url.pathname==='/api/student')return store.student(url.searchParams.get('number'),url.searchParams.get('ref'),url.searchParams.get('generation'));
  throw Error('Không có tuyến dữ liệu này.');
}

// Pages tải gói demo đã được Đức cho phép công bố vào bộ nhớ trình duyệt.
// Các thao tác thử dùng cùng bộ nhớ mô phỏng với bản chạy local; đóng trang sẽ bỏ phiên.
import {createDemoStore} from './demo-store.mjs';
let store;
const params=new URLSearchParams(location.hash.includes('view=')?location.hash.slice(1):location.search);
const role=params.get('view')==='student'?'student':'teacher',number=Number(params.get('number')||10);
const bound=role==='student'&&params.has('generation');
const channel=typeof BroadcastChannel==='function'?new BroadcastChannel('thuy-review-demo-v1'):null;
channel?.addEventListener('message',event=>{
  if(event.data?.kind==='request'&&store)channel.postMessage({kind:'snapshot',id:event.data.id,role,package:store.exportPackage()});
  if(event.data?.kind==='mutation'&&store){try{store.mutate(event.data.body);}catch{/* Trang gửi đã hiển thị lỗi; không đổi dữ liệu khi không hợp lệ. */}}
});
export const localAPI=['127.0.0.1','localhost'].includes(location.hostname)&&['7163','7164','7166'].includes(location.port)&&!new URLSearchParams(location.search).has('pages');
const validPackage=value=>value?.format==='thuy-review-data-v1'&&value.data?.className==='IC2305'&&Array.isArray(value.data.sessions)&&value.data.sessions.length===3;
function sharedPackage(){
  // Ưu tiên tab giảng viên; phản hồi của tab học viên cũ không được mở sai lần giao bài.
  return new Promise(resolve=>{
    if(!channel)return resolve(null);
    let best=null,generation=-1;
    const id=crypto.randomUUID(),finish=value=>{clearTimeout(timer);channel.removeEventListener('message',receive);resolve(value);};
    const receive=event=>{
      const message=event.data,value=message?.package;
      if(message?.kind!=='snapshot'||message.id!==id||!validPackage(value))return;
      const candidate=value.data.sessions.find(s=>s.number===number)?.generation;
      if(bound&&String(candidate)!==params.get('generation'))return;
      if(bound&&message.role==='student')return;
      if(message.role==='teacher')return finish(value);
      // Tương thích tab đã mở bằng bản cũ: chờ thêm và chọn lần giao mới hơn.
      if(Number(candidate)>=generation){generation=Number(candidate);best=value;}
    };
    const timer=setTimeout(()=>finish(best),3000);
    channel.addEventListener('message',receive);channel.postMessage({kind:'request',id,role});
  });
}
export async function preparePages(){
  await new Promise(resolve=>{
    // Link từ giảng viên phải nhận đúng lần giao; nhận chậm thì cho thử lại, không đổi sang bài gốc.
    const load=async()=>{
      document.querySelector('#app').innerHTML=`<main class="fileEntry"><div class="brand"><div class="logo">IZONE</div><small>IELTS CHIẾN LƯỢC</small></div><h1>Progress Log · Bản demo của Thủy</h1><p id="load-status" role="status">Đang nhận bài đang giao từ tab giảng viên…</p><button id="retry-data" class="btn primary" hidden>Thử tải lại</button></main>`;
      try{
        const shared=await sharedPackage();
        if(shared){store=createDemoStore(shared);resolve();return;}
        if(bound)throw Error('Chưa nhận được đúng bài đang giao. Giữ tab giảng viên đang mở rồi bấm Thử tải lại.');
        document.querySelector('#load-status').textContent='Đang tải bản chụp dữ liệu IC2305…';
        const response=await fetch(new URL('./demo-data.json',import.meta.url),{cache:'no-cache',signal:AbortSignal.timeout(30000)});
        if(!response.ok)throw Error(`Không tải được dữ liệu demo (HTTP ${response.status}).`);
        const value=await response.json();
        if(!validPackage(value))throw Error('Gói dữ liệu demo không đúng định dạng IC2305.');
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

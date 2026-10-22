// Pages giữ phiên IC2305 trên trình duyệt; không ghi vào hệ thống thật.
import {createDemoStore} from './demo-store.mjs';
import {sessionDatabase,draftJournal,draftKey,validSessionPackage} from './session-storage.mjs';
let store,database,epoch,revision=-1,sessionStale=false;
export const sessionDrafts=draftJournal(()=>globalThis.localStorage);
const mutationListeners=new Set();
export function onPagesMutation(listener){mutationListeners.add(listener);return ()=>mutationListeners.delete(listener);}
const storageListeners=new Set();
let storageState={error:false,message:'Phiên demo được lưu trên trình duyệt này'};
export const sessionStorageState=()=>storageState;
export function onSessionStorage(listener){storageListeners.add(listener);return ()=>storageListeners.delete(listener);}
function storageStatus(message,error=false){storageState={message,error};for(const listener of storageListeners)listener(storageState);}
export function keepSessionDraft(body){
  if(localAPI)return;
  if(sessionStale)throw Error('Phiên demo đã được đặt lại. Tải lại trang trước khi viết tiếp.');
  sessionDrafts.save(draftKey(body),epoch||'unavailable',body);
}
export function pendingSessionDraft(body){const entry=sessionDrafts.get(draftKey(body));return entry?.epoch===epoch?entry.body:null;}
function syncRecord(record){
  if(!record)throw Error('Chưa tìm thấy phiên đã lưu. Hãy tải lại trang; dữ liệu đang mở vẫn được giữ.');
  if(epoch&&epoch!==record.epoch){sessionStale=true;storageStatus('Phiên demo đã được đặt lại ở tab khác. Tải lại trang để tiếp tục.',true);}
  if(record.revision>=revision){store=createDemoStore(record.package);epoch=record.epoch;revision=record.revision;}
}
async function commit(body,broadcast=true){
  if(!database)throw Error('Trình duyệt chưa cho lưu phiên demo. Hãy giữ trang và cho phép lưu dữ liệu trang web rồi tải lại.');
  if(sessionStale)throw Error('Phiên demo đã được đặt lại ở tab khác. Tải lại trang để tiếp tục.');
  try{
    const pending=sessionDrafts.list();
    const saved=await database.change(body,pending,epoch);
    let cleanupFailed=false;
    try{
      if(body?.action==='reset'){epoch=saved.record.epoch;sessionDrafts.clearSessionDrafts();}
      else sessionDrafts.clearAccepted(saved.accepted);
    }catch{cleanupFailed=true;}
    syncRecord(saved.record);
    storageStatus(cleanupFailed?'Phiên demo đã lưu, nhưng chưa dọn được bản đệm. Giữ trang và kiểm tra quyền lưu dữ liệu trang web.':'Phiên demo đã lưu trên trình duyệt này',cleanupFailed);
    if(body&&broadcast)channel?.postMessage({kind:'mutation',body,revision,epoch});
    return saved.result;
  }catch(error){if(error.storageFailure)storageStatus(error.message,true);throw error;}
}
const params=new URLSearchParams(location.hash.includes('view=')?location.hash.slice(1):location.search);
const role=params.get('view')==='student'?'student':'teacher',number=Number(params.get('number')||10);
const bound=role==='student'&&params.has('generation');
const channel=typeof BroadcastChannel==='function'?new BroadcastChannel('thuy-review-demo-v1'):null;
channel?.addEventListener('message',event=>{
  if(event.data?.kind==='request'&&store)channel.postMessage({kind:'snapshot',id:event.data.id,role,package:store.exportPackage(),revision,epoch});
  if(event.data?.kind==='mutation'&&store){
    const message=event.data;
    if(database){
      if(message.revision==null){storageStatus('Có tab đang dùng bản demo cũ. Tải lại tab đó để các thay đổi tiếp theo được lưu đầy đủ.',true);return;}
      // Tab mới cùng đọc một kho; không chạy lại thao tác đã commit như thay bài/reset.
      const update=database.read().then(syncRecord);
      update.then(()=>{for(const listener of mutationListeners)listener(message.body);}).catch(error=>storageStatus(error.message,true));
    }else{
      try{store.mutate(message.body);}catch{return;}
      for(const listener of mutationListeners)listener(message.body);
    }
  }
});
export const localAPI=['127.0.0.1','localhost'].includes(location.hostname)&&['7163','7164','7166'].includes(location.port)&&!new URLSearchParams(location.search).has('pages');
const validPackage=validSessionPackage;
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
    const load=async()=>{
      document.querySelector('#app').innerHTML=`<main class="fileEntry"><div class="brand"><div class="logo">IZONE</div><small>IELTS CHIẾN LƯỢC</small></div><h1>Progress Log · Bản demo của Thủy</h1><p id="load-status" role="status">Đang mở phiên demo đã lưu…</p><button id="retry-data" class="btn primary" hidden>Thử tải lại</button></main>`;
      try{
        if(globalThis.indexedDB){
          database=await sessionDatabase(globalThis.indexedDB);
          const saved=await database.read();
          if(saved){
            syncRecord(saved);
            if(bound&&String(store.teacher().sessions.find(v=>v.number===number)?.generation)!==params.get('generation'))throw Error('Link này thuộc bài đã thu hồi. Phiên hiện tại vẫn được giữ; hãy mở lại link bài đang giao từ màn giảng viên.');
            await commit();resolve();return;
          }
        }else storageStatus('Trình duyệt chưa cho lưu phiên. Bạn chỉ đang xem bản tạm; các thao tác ghi chưa được bật.',true);
        const shared=await sharedPackage();
        let value=shared;
        if(!value){
          if(bound)throw Error('Chưa nhận được đúng bài đang giao. Giữ tab giảng viên đang mở rồi bấm Thử tải lại.');
          document.querySelector('#load-status').textContent='Đang tải bản chụp dữ liệu IC2305…';
          const response=await fetch(new URL('./demo-data.json',import.meta.url),{cache:'no-cache',signal:AbortSignal.timeout(30000)});
          if(!response.ok)throw Error(`Không tải được dữ liệu demo (HTTP ${response.status}).`);
          value=await response.json();
        }
        if(!validPackage(value))throw Error('Gói dữ liệu demo không đúng định dạng IC2305.');
        if(database){syncRecord(await database.initialize(value));await commit();}
        else store=createDemoStore(value);
        resolve();
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
  if(body){if(url.pathname!=='/api/demo')throw Error('Không có tuyến ghi này.');return commit(body);}
  if(database)syncRecord(await database.read());
  if(url.pathname==='/api/teacher')return store.teacher();
  if(url.pathname==='/api/student')return store.student(url.searchParams.get('number'),url.searchParams.get('ref'),url.searchParams.get('generation'));
  throw Error('Không có tuyến dữ liệu này.');
}

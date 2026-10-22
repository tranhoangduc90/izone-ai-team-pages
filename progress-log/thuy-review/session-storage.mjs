// Kho phiên lớn dùng IndexedDB; bản đệm nhỏ giữ ngay khi gõ, không chờ lúc đóng tab.
import {createDemoStore} from './demo-store.mjs?v=review-20261022';
export const SESSION_DB='izone-progress-log-thuy-review-v1';
export const JOURNAL_PREFIX='izone:progress-log:thuy-review:pending:v1:';
export const validSessionPackage=value=>value?.format==='thuy-review-data-v1'&&value.data?.className==='IC2305'&&Array.isArray(value.data.sessions)&&value.data.sessions.length===3;
const storageError=()=>Object.assign(Error('Chưa lưu được phiên demo: bộ nhớ trình duyệt bị chặn, đã đầy hoặc đang bận. Hãy giữ trang đang mở và thử lại.'),{storageFailure:true});
export const draftKey=body=>`${body.action}:${body.number}:${body.generation}:${body.ref}`;
export function draftJournal(getStorage){
  function decode(key,raw){
    const value=JSON.parse(raw);
    if(value.version!==1||typeof value.scope!=='string'||typeof value.epoch!=='string'||key!==JOURNAL_PREFIX+value.scope)throw Error('Có bản nháp đã lưu chưa đọc được. Dữ liệu cũ vẫn được giữ, không tự đặt lại.');
    return {...value,key,raw};
  }
  return {
    save(scope,epoch,body){
      try{
        const storage=getStorage(),key=JOURNAL_PREFIX+scope,previous=storage.getItem(key),old=previous?decode(key,previous):null;
        const value={version:1,scope,epoch,body:structuredClone(body)};
        // Chỉ gộp các ô vừa sửa, không mang giá trị cũ từ tab khác ghi đè toàn bài.
        if(body.action==='draft'&&old?.epoch===epoch)value.body.responses={...old.body.responses,...body.responses};
        const raw=JSON.stringify(value);storage.setItem(key,raw);
        if(storage.getItem(key)!==raw)throw storageError();
        return value;
      }catch(error){throw error.storageFailure?error:storageError();}
    },
    list(){
      const storage=getStorage(),values=[];
      for(let i=0;i<storage.length;i++){const key=storage.key(i);if(key?.startsWith(JOURNAL_PREFIX)){const raw=storage.getItem(key);if(raw!==null)values.push(decode(key,raw));}}
      return values;
    },
    get(scope){const storage=getStorage(),key=JOURNAL_PREFIX+scope,raw=storage.getItem(key);return raw===null?null:decode(key,raw);},
    remove(scope){getStorage().removeItem(JOURNAL_PREFIX+scope);},
    clearAccepted(entries){
      const storage=getStorage();
      for(const entry of entries)if(storage.getItem(entry.key)===entry.raw)storage.removeItem(entry.key);
    },
    clearSessionDrafts(){const storage=getStorage();for(const entry of this.list())if(['draft','feedbackDraft'].includes(entry.body?.action))storage.removeItem(entry.key);}
  };
}
function validateRecord(record){
  if(record?.version!==1||typeof record.epoch!=='string'||!Number.isSafeInteger(record.revision)||record.revision<0||!validSessionPackage(record.package))throw Object.assign(Error('Phiên demo đã lưu chưa đọc được hoặc thuộc phiên bản khác. Bản cũ vẫn được giữ; không tự đặt lại dữ liệu.'),{storageFailure:true});
  return record;
}
export function applySessionChange(record,body,pending=[]){
  validateRecord(record);
  const store=createDemoStore(record.package),accepted=[];
  for(const entry of pending){
    if(entry.epoch!==record.epoch||!['draft','feedbackDraft'].includes(entry.body?.action))continue;
    try{store.mutate(entry.body);accepted.push(entry);}catch{/* Nháp sai lần giao/không hợp lệ vẫn giữ trong bản đệm, không ghi sang bài khác. */}
  }
  let effective=body;
  if(body&&['draft','feedbackDraft'].includes(body.action)){
    const newest=accepted.find(entry=>draftKey(entry.body)===draftKey(body))?.body;
    if(newest)effective=body.action==='draft'?{...body,responses:{...body.responses,...newest.responses}}:{...body,text:newest.text};
  }
  const result=body?store.mutate(effective):{ok:true};
  const next={version:1,epoch:body?.action==='reset'?crypto.randomUUID():record.epoch,revision:record.revision+1,package:store.exportPackage()};
  return {record:next,result,accepted};
}
export async function sessionDatabase(indexedDB){
  if(!indexedDB)throw storageError();
  const db=await new Promise((resolve,reject)=>{
    const request=indexedDB.open(SESSION_DB,1),timer=setTimeout(()=>reject(storageError()),10000);
    request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains('session'))request.result.createObjectStore('session');};
    request.onsuccess=()=>{clearTimeout(timer);resolve(request.result);};
    request.onerror=request.onblocked=()=>{clearTimeout(timer);reject(storageError());};
  });
  db.onversionchange=()=>db.close();
  function transaction(write,transform){
    return new Promise((resolve,reject)=>{
      let value,failure,tx;
      try{tx=write?db.transaction('session','readwrite',{durability:'strict'}):db.transaction('session','readonly');}
      catch{return reject(storageError());}
      const target=tx.objectStore('session'),request=target.get('IC2305');
      request.onsuccess=()=>{
        try{value=transform(request.result);}
        catch(error){failure=error;tx.abort();}
        if(!failure&&write)try{target.put(value.record,'IC2305');}catch{failure=storageError();tx.abort();}
      };
      tx.oncomplete=()=>resolve(value);
      tx.onabort=()=>reject(failure||storageError());
      tx.onerror=()=>{};
    });
  }
  return {
    read:()=>transaction(false,value=>value===undefined?null:validateRecord(value)),
    initialize:value=>transaction(true,existing=>({record:existing?validateRecord(existing):{version:1,epoch:crypto.randomUUID(),revision:0,package:createDemoStore(value).exportPackage()}})).then(v=>v.record),
    change:(body,pending,epoch)=>transaction(true,existing=>{
      validateRecord(existing);
      if(existing.epoch!==epoch)throw Error('Phiên demo đã được đặt lại ở tab khác. Tải lại trang để tiếp tục; không ghi nháp cũ vào phiên mới.');
      return applySessionChange(existing,body,pending);
    }),
    close:()=>db.close()
  };
}

// Điều phối phiên riêng K56; cookie/quyền/thời hạn vẫn do backend xác minh.
// Storage chỉ chứa ý định ngẫu nhiên, không chứa token hoặc danh tính.
import {createTeacherSessionClient as createBaseClient,teacherSessionRequestOptions} from '../../shared/teacher-session-client.js?rev=20261026-startup1&startup=20261026-v2';
export {teacherSessionRequestOptions};
const queues=new Map();
const keyFor=api=>'izone:teacher-k56:logout-pending:'+api;
const read=api=>{try{return window.localStorage.getItem(keyFor(api));}catch{return null;}};
function write(api,value){try{window.localStorage.setItem(keyFor(api),value);}catch{/* Backend vẫn bắt buộc cookie hợp lệ. */}}
function resolution(api){
 try{return JSON.parse(window.localStorage.getItem(keyFor(api)+':resolved')||'null');}catch{return null;}
}
function resolveIntent(api,intent,outcome){
 // Không xóa/ghi đè intent: nếu logout mới đến đúng lúc này, ID mới vẫn khác ACK cũ.
 try{window.localStorage.setItem(keyFor(api)+':resolved',JSON.stringify({intent,outcome}));}catch{/* URL signed_out vẫn giữ fail-closed. */}
}
const operationId=()=>globalThis.crypto?.randomUUID?.()||Date.now()+':'+Math.random();
const pending=value=>value==='1'||String(value||'').startsWith('logout:');
function unresolved(api){const value=read(api);return pending(value)&&resolution(api)?.intent!==value;}
function serialized(api,operation){
 // Web Locks tuần tự hóa cả hai trang/các tab cùng trình duyệt, theo đúng API.
 if(globalThis.navigator?.locks?.request)return navigator.locks.request('izone:k56:teacher-session:'+api,operation);
 const next=(queues.get(api)||Promise.resolve()).then(operation);
 queues.set(api,next.catch(()=>undefined));return next;
}
export function hasK56LogoutIntent(api){
 const value=read(api);
 if(unresolved(api))return true;
 // Phiên mới đã được backend xác nhận thay ý định cũ, kể cả URL tab cũ còn signed_out.
 const resolved=resolution(api);
 if(resolved&&resolved.intent===value)return false;
 return Boolean(api)&&new URL(window.location.href).searchParams.get('signed_out')===api;
}
export function createTeacherSessionClient(options){
 const api=String(options.apiBaseUrl||'');const client=createBaseClient(options);
 return {
  async login(credential){
   const before=read(api);
   return serialized(api,async()=>{
    if(read(api)!==before)throw Object.assign(new Error('Đã có yêu cầu đăng xuất mới hơn.'),{staleSession:true});
    const response=await client.login(credential);
    if(read(api)!==before){
     // Một logout mới hơn đã đến trong lúc POST chờ; không cho phiên muộn sống lại.
     // Trình duyệt thiếu Web Locks có thể nhận cookie POST sau DELETE đã xong.
     // Mở lại blocker nếu intent mới đã được ACK; không tự gửi DELETE lặp.
     if(!unresolved(api))write(api,'logout:'+operationId());
     throw Object.assign(new Error('Đã có yêu cầu đăng xuất mới hơn.'),{staleSession:true});
    }
    resolveIntent(api,before,'login');
    return response;
   });
  },
  async restore(){
   if(unresolved(api))return null;
   return client.restore();
  },
  async logout(){
   // Đánh dấu ngay trước khi xếp hàng; POST đang chờ phải thấy ý định mới này.
   const marker='logout:'+operationId();write(api,marker);
   return serialized(api,async()=>{
    const response=await client.logout();resolveIntent(api,marker,'logout');return response;
   });
  }
 };
}

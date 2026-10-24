/* Phiên giảng viên dùng chung. Cookie HttpOnly chỉ đi giữa trình duyệt và máy chủ.
   Không đọc mã Google, nháp hay danh tính học viên; không can thiệp API học viên. */
(function(){
 'use strict';
 if(typeof window==='undefined'||typeof window.fetch!=='function'||window.IzoneTeacherSso)return;
 if(new URL(window.location.href).origin!=='https://tranhoangduc90.github.io')return;
 const origin='https://ducizone.ddns.net',base=origin+'/shops-review-preview-api/api/v1/preview-sso/v1';
 const products=[{id:'writing',prefix:'/shops-review-preview-api/api',source:'/shops-review-preview-api/api/v1/auth/session/shared-session'}];
 const original=window.fetch.bind(window),pending=new Map(),initialized=new Set();
 let discovery=null,generation=0;
 const post=(url,body={})=>original(url,{method:'POST',credentials:'include',cache:'no-store',headers:{'Content-Type':'application/json','X-Izone-Csrf':'1'},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
 async function restore(id){
  const start=generation;
  const key=start+':'+id;
  if(pending.has(key))return pending.get(key);
  const work=(async()=>{
   let response=await post(base+'/restore/'+id);
   if(start!==generation)return false;
   if(response.status===401){
    if(!discovery||discovery.generation!==start){
     const current={generation:start};
     current.promise=(async()=>{
     const first=products.find(p=>p.id===id),ordered=[first,...products.filter(p=>p!==first)].filter(p=>p.source);
     for(const p of ordered){if(start!==generation)return false;const check=await post(origin+p.source);if(start!==generation)return false;if(check.ok)return true;if(check.status!==401)throw Object.assign(Error('Chưa xác minh được phiên giảng viên dùng chung.'),{status:check.status});}
     return false;
     })().finally(()=>{if(discovery===current)discovery=null;});
     discovery=current;
    }
    if(!await discovery.promise)return false;
    if(start!==generation)return false;
    response=await post(base+'/restore/'+id);
   }
   if(start!==generation)return false;
   if(response.status===401)return false;
   if(response.status===403)throw Object.assign(Error('Tài khoản đang đăng nhập chưa có quyền sản phẩm này.'),{status:403});
   if(!response.ok)throw Error('Chưa khôi phục được phiên giảng viên dùng chung. Hãy thử lại.');
   return true;
  })().finally(()=>pending.delete(key));
  pending.set(key,work);return work;
 }
 function route(input,options){
  let url;try{url=new URL(typeof input==='string'||input instanceof URL?String(input):input.url,window.location.href);}catch{return null;}
  const product=products.find(p=>(url.origin===origin||url.origin===p.apiOrigin)&&url.pathname.startsWith(p.prefix+'/'));if(!product)return null;
  const path=url.pathname.slice(product.prefix.length).replace(/^\/v1\/auth\/session$/,'/auth/session'),method=(options?.method||input?.method||'GET').toUpperCase();
  if(!path.startsWith('/teacher/')&&path!=='/auth/session')return null;
  if(path==='/teacher/config')return null;
  return {product,path,method,login:method==='POST'&&['/teacher/login','/teacher/session','/auth/session'].includes(path),logout:method==='DELETE'&&['/auth/session','/teacher/session'].includes(path)||method==='POST'&&path==='/teacher/logout'};
 }
 window.fetch=async function(input,options){
  const match=route(input,options);if(!match)return original(input,options);
  const version=generation;
  if(match.login&&match.product.identity){
   const body=JSON.parse(options?.body||'{}');
   await login(match.product.id,body.credential,body.remember!==false);
   return original(input,{...options,method:'GET',body:undefined,credentials:'include'});
  }
  // Xác nhận tài khoản chung trước lần đọc đầu, tránh dùng cookie riêng của tài khoản cũ.
  let missingSharedSession=false;
  if(match.method==='GET'&&!initialized.has(match.product.id)){
   if(await restore(match.product.id)){if(version===generation)initialized.add(match.product.id);}
   else missingSharedSession=true;
  }
  if(match.method==='GET'&&version!==generation)throw Error('Phiên giảng viên vừa thay đổi. Hãy mở lại bài.');
  // Chỉ GET bị từ chối mới được thử lại; không tự phát lại thao tác sửa/nộp/chấm.
  let response=await original(input,options);
  if(match.logout){
   if(response.ok||response.status===401){generation++;initialized.clear();const result=await post(base+'/logout');if(!result.ok)throw Error('Chưa đăng xuất hết các sản phẩm. Hãy thử lại.');try{window.localStorage.setItem('izone:teacher-sso-shops-preview-logout',String(Date.now()));}catch{}}
   return response;
  }
  if(match.login&&response.ok){generation++;initialized.clear();const result=await post(origin+match.product.source,{replace:true});if(!result.ok)throw Error('Đã đăng nhập sản phẩm này nhưng chưa lưu được phiên dùng chung. Hãy thử lại.');try{window.localStorage.setItem('izone:teacher-sso-shops-preview-login',String(Date.now()));}catch{}return response;}
  // Lần đọc này đã dò mà không có phiên: không dò lại cùng các nguồn lần hai.
  // Không giữ kết quả âm sang request sau hoặc qua lần đăng nhập/đăng xuất.
  if(match.method==='GET'&&version!==generation)throw Error('Phiên giảng viên vừa thay đổi. Hãy mở lại bài.');
  if(match.method==='GET'&&response.status===401&&!missingSharedSession&&await restore(match.product.id))response=await original(input,options);
  if(match.method==='GET'&&version!==generation)throw Error('Phiên giảng viên vừa thay đổi. Hãy mở lại bài.');
  return response;
 };
 window.addEventListener('storage',event=>{if(['izone:teacher-sso-shops-preview-logout','izone:teacher-sso-shops-preview-login'].includes(event.key)){generation++;initialized.clear();}});
 async function login(product,credential,remember=true){
  if(!products.some(p=>p.id===product&&p.identity))throw Error('Sản phẩm chưa hỗ trợ đăng nhập chung.');
  const result=await post(base+'/login/'+product,{credential,remember});
  if(!result.ok)throw Error('Chưa xác minh được tài khoản Google. Hãy đăng nhập lại.');
  generation++;initialized.clear();try{window.localStorage.setItem('izone:teacher-sso-shops-preview-login',String(Date.now()));}catch{}
 }
 async function logout(){
  const result=await post(base+'/logout');if(!result.ok)throw Error('Chưa đăng xuất hết các sản phẩm. Hãy thử lại.');
  generation++;initialized.clear();try{window.localStorage.setItem('izone:teacher-sso-shops-preview-logout',String(Date.now()));}catch{}
 }
 window.IzoneTeacherSso={restore,login,logout};
}());

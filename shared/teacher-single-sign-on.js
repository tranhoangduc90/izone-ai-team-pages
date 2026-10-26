/* Phiên giảng viên dùng chung. Cookie HttpOnly chỉ đi giữa trình duyệt và máy chủ.
   Không đọc mã Google, nháp hay danh tính học viên; không can thiệp API học viên. */
(function(){
 'use strict';
 if(typeof window==='undefined'||typeof window.fetch!=='function'||window.IzoneTeacherSso)return;
 if(new URL(window.location.href).origin!=='https://tranhoangduc90.github.io')return;
 const origin='https://ducizone.ddns.net',base=origin+'/teacher-session-api/v1';
 const products=[
  {id:'reading',prefix:'/reading-practice-api/api',source:'/reading-practice-api/api/teacher/shared-session'},
  {id:'listening',prefix:'/listening-practice-api/api',source:'/listening-practice-api/api/teacher/shared-session'},
  {id:'writing',prefix:'/writing-api/api',source:'/writing-api/api/auth/session/shared-session'},
  {id:'mapping',prefix:'/mapping-api/api',source:'/mapping-api/api/auth/session/shared-session'},
  {id:'term67',prefix:'/term-mini-k67-api/api',source:'/term-mini-k67-api/api/auth/session/shared-session',apiOrigin:'https://ducizone.ddns.net:18869'},
  {id:'materials',prefix:'/reading67-materials/api/reading-skills67',source:'/reading67-materials/api/reading-skills67/teacher/shared-session'},
  {id:'k56',prefix:'/mapping-api-k56/api',source:'/mapping-api-k56/api/auth/session/shared-session'},
  {id:'k56demo',prefix:'/mapping-api-demo/api',source:'/mapping-api-demo/api/auth/session/shared-session'},
  {id:'handout67',prefix:'/api/handout67/v1',source:'/api/handout67/v1/teacher/shared-session',identity:true},
  {id:'substitute',prefix:'/substitute-teacher-api',identity:true},
  {id:'shops',prefix:'/shops-writing-api/api',source:'/shops-writing-api/api/v1/auth/session/shared-session'}
 ];
 const original=window.fetch.bind(window),pending=new Map(),initialized=new Set();
 let discovery=null,generation=0,startup=null;
 const post=(url,body={})=>original(url,{method:'POST',credentials:'include',cache:'no-store',headers:{'Content-Type':'application/json','X-Izone-Csrf':'1'},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
 async function performRestore(id,force=false){
  if(!products.some(p=>p.id===id))throw Error('Sản phẩm chưa hỗ trợ đăng nhập chung.');
  if(!force&&initialized.has(id))return true;
  if(force)initialized.delete(id);
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
   initialized.add(id);
   return true;
  })().finally(()=>pending.delete(key));
  pending.set(key,work);return work;
 }
 // Trang GV và lần đọc API đầu dùng chung kết quả khởi động, kể cả kết quả
 // không có phiên/lỗi. Chỉ tiêu thụ một lần; thử lại sau đó luôn hỏi máy chủ.
 function restore(id,{force=false}={}){
  const early=startup;startup=null;
  if(!force&&early?.generation===generation&&early.id===id)return early.promise;
  return performRestore(id,force);
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
   if(response.ok||response.status===401){generation++;initialized.clear();const result=await post(base+'/logout');if(!result.ok)throw Error('Chưa đăng xuất hết các sản phẩm. Hãy thử lại.');try{window.localStorage.setItem('izone:teacher-sso-logout',String(Date.now()));}catch{}}
   return response;
  }
  if(match.login&&response.ok){generation++;initialized.clear();const result=await post(origin+match.product.source,{replace:true});if(!result.ok)throw Error('Đã đăng nhập sản phẩm này nhưng chưa lưu được phiên dùng chung. Hãy thử lại.');try{window.localStorage.setItem('izone:teacher-sso-login',String(Date.now()));}catch{}return response;}
  // Lần đọc này đã dò mà không có phiên: không dò lại cùng các nguồn lần hai.
  // Không giữ kết quả âm sang request sau hoặc qua lần đăng nhập/đăng xuất.
  if(match.method==='GET'&&version!==generation)throw Error('Phiên giảng viên vừa thay đổi. Hãy mở lại bài.');
  if(match.method==='GET'&&response.status===401&&!missingSharedSession&&await restore(match.product.id,{force:true}))response=await original(input,options);
  if(match.method==='GET'&&version!==generation)throw Error('Phiên giảng viên vừa thay đổi. Hãy mở lại bài.');
  return response;
 };
 window.addEventListener('storage',event=>{if(['izone:teacher-sso-logout','izone:teacher-sso-login'].includes(event.key)){generation++;initialized.clear();}});
 async function login(product,credential,remember=true){
  if(!products.some(p=>p.id===product&&p.identity))throw Error('Sản phẩm chưa hỗ trợ đăng nhập chung.');
  const result=await post(base+'/login/'+product,{credential,remember});
  if(!result.ok)throw Error('Chưa xác minh được tài khoản Google. Hãy đăng nhập lại.');
  generation++;initialized.clear();try{window.localStorage.setItem('izone:teacher-sso-login',String(Date.now()));}catch{}
 }
 async function logout(){
  const result=await post(base+'/logout');if(!result.ok)throw Error('Chưa đăng xuất hết các sản phẩm. Hãy thử lại.');
  generation++;initialized.clear();try{window.localStorage.setItem('izone:teacher-sso-logout',String(Date.now()));}catch{}
 }
 window.IzoneTeacherSso={restore,login,logout};
 // Chỉ trang vào dành cho GV khai báo thuộc tính này. Trang học viên giữ nguyên.
 const entry=typeof document!=='undefined'?document.currentScript?.dataset.izoneTeacherProduct:null;
 if(products.some(p=>p.id===entry)){
  const promise=performRestore(entry);startup={id:entry,generation,promise};
  promise.catch(()=>{}); // Giao diện sẽ nhận lỗi khi tiêu thụ kết quả, không bỏ lỗi.
 }
}());

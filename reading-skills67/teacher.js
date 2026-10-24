/* Giảng viên dùng Google/cookie máy chủ, quyền lớp kiểm lại trước đọc nháp/lượt.
   Bản demo có credential giả riêng ở localhost; không có đường nộp/chấm thay. */
(async function(){
 'use strict';
 const root=document.querySelector('#teacher-app'),prefix=window.READING67_API_BASE||new URL('../api/reading-skills67',location.href).pathname;let config,generation=0;
 // Chỉ quay về đúng trang bài của sản phẩm và cùng origin; không nhận redirect ngoài.
 let returnTarget=null;
 try{const raw=new URLSearchParams(location.search).get('returnTo');if(raw){const target=new URL(raw,location.href),entry=new URL('./',location.href);if(target.origin===entry.origin&&target.pathname===entry.pathname&&target.searchParams.get('teacher')==='1'&&target.searchParams.get('classId')&&target.searchParams.get('studentRef'))returnTarget=target.href;}}catch{}
 const e=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 async function request(route,body){const r=await fetch(prefix+route,{credentials:'include',...(body?{method:'POST',headers:{'Content-Type':'application/json','X-Izone-Csrf':'1'},body:JSON.stringify(body)}:{})});const data=await r.json();if(!r.ok)throw Object.assign(new Error(({ACCESS_DENIED:'Tài khoản chưa được cấp quyền lớp này.',TEACHER_LOGIN_REQUIRED:'Cần đăng nhập Google.',GOOGLE_IDENTITY_INVALID:'Google chưa xác minh được tài khoản.'})[data.error]||data.error),{status:r.status});return data;}
 async function screen(){
  const result=await request('/teacher/classes');
  window.MaterialsTeacherLogin?.clear();
  if(returnTarget){location.replace(returnTarget);return;}
  root.innerHTML='<section class="teacher-heading"><div><p class="kicker">'+(config.demo?'BẢN THỬ · ':'')+'GIẢNG VIÊN CHỈ XEM</p><h1>'+e(config.title)+'</h1><p>Chọn học viên để xem nháp đã lưu và từng bản đã chấm.</p></div><button class="secondary" id="teacher-logout">Đăng xuất</button></section><label for="teacher-class">Lớp được phụ trách</label><select id="teacher-class"><option value="">Chọn lớp…</option>'+result.classes.map(c=>'<option value="'+c.id+'">'+e(c.classCode)+'</option>').join('')+'</select><div id="teacher-students"></div>';
  root.querySelector('#teacher-logout').onclick=async()=>{await request('/teacher/logout',{});login();};
  root.querySelector('#teacher-class').onchange=async event=>{const version=++generation,classId=event.target.value,list=root.querySelector('#teacher-students');list.textContent='Đang đọc danh sách…';list.dataset.state='pending';try{const data=await request('/teacher/students/'+encodeURIComponent(classId));if(version!==generation)return;delete list.dataset.state;list.innerHTML='<div class="history-list">'+data.students.map(s=>'<div class="history-row"><strong>'+e(s.name)+'</strong><a class="secondary" href="./?server=1&teacher=1&classId='+encodeURIComponent(classId)+'&studentRef='+s.studentRef+'">Xem nháp và lịch sử</a></div>').join('')+'</div>';}catch(error){if(version===generation){list.textContent=error.message;list.dataset.state='error';}}};
 }
 function login(){
  root.innerHTML='<section class="access-card"><p class="kicker">GIẢNG VIÊN · READING 67</p><h1>Xem bài học viên</h1><p>Đăng nhập bằng tài khoản Google đã được cấp quyền lớp.</p><label class="remember"><input type="checkbox" id="teacher-remember" checked> Ghi nhớ đăng nhập</label><div id="google-button"></div><p id="teacher-error" role="alert"></p>'+(config.demoGoogle?'<button class="primary" id="demo-teacher">Vào vai giảng viên thử</button><p class="minimum-note">Tài khoản giả, chỉ có quyền lớp READING67DEMO trên máy này.</p>':'')+'</section>';
  window.MaterialsTeacherLogin?.render(root,config);
  const enter=async credential=>{try{await request('/teacher/login',{credential,remember:root.querySelector('#teacher-remember').checked});await screen();}catch(error){root.querySelector('#teacher-error').textContent=error.message;}};
  if(config.demoGoogle){root.querySelector('#demo-teacher').onclick=()=>enter('demo-teacher-allowed');return;}
  const start=()=>{window.google.accounts.id.initialize({client_id:config.googleClientId,callback:value=>enter(value.credential)});window.google.accounts.id.renderButton(root.querySelector('#google-button'),{theme:'outline',size:'large',text:'signin_with'});};
  if(window.google?.accounts?.id)start();else{const script=document.createElement('script');script.src='https://accounts.google.com/gsi/client';script.onload=start;script.onerror=()=>root.querySelector('#teacher-error').textContent='Chưa tải được đăng nhập Google. Hãy tải lại trang.';document.head.append(script);}
 }
 try{config=await request('/config');try{await screen();}catch(error){if(error.status===401)login();else throw error;}}catch(error){root.innerHTML='<section class="access-card"><h1>Chưa mở được trang giảng viên</h1><p>'+e(error.message)+'</p></section>';}
}());

import {createTeacherSessionClient,teacherSessionRequestOptions} from '../../shared/teacher-session-client.js?startup=20261026-v2';

// Đọc lớp/bản lưu qua phiên Google riêng. Không dùng bộ nhớ hoặc token học viên,
// không gọi các đường kiểm/nháp/nộp của học viên và không tạo trình phát audio.
const config=window.TERM_TEST_APP_CONFIG,base=config.API_BASE_URL.replace(/\/$/,''),root='/api/k67-readiness/v1/teacher';
const client=createTeacherSessionClient({apiBaseUrl:base,sessionPath:'/api/auth/session'});
const $=id=>document.getElementById(id),escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const stamp=v=>v&&Number.isFinite(Date.parse(v))?new Date(v).toLocaleString('vi-VN'):'Chưa có';
const yes=v=>v===true?'Có':v===false?'Không':'Chưa xác nhận';
const checkLabels={environment:'Trình duyệt',session:'Kết nối hệ thống',localDraft:'Lưu nháp trên thiết bị',audio:'Nhận tệp âm thanh',cache:'Giữ tệp trên máy',format:'Định dạng âm thanh',playback:'Phát thử',draftSync:'Lưu lên hệ thống',hearing:'Xác nhận nghe rõ',page:'Trạng thái trang',load:'Độ phản hồi',output:'Đầu ra âm thanh',wake:'Giữ máy không ngủ'};
const checkStates={pass:'Đạt',warn:'Cần kiểm tra',fail:'Chưa đạt',pending:'Đang kiểm',unknown:'Chưa xác định'};
let generation=0,detailGeneration=0,controller=new AbortController(),timer,googlePromise;
let classes=[],students=[],classId='',selected='',detail=null,chosen='';
const query=new URLSearchParams(location.search);$('student-return').href='./index.html'+(query.get('class')?'?'+new URLSearchParams({class:query.get('class')}):'');
function notice(text){$('notice').textContent=text;}
function cancel(){generation++;detailGeneration++;controller.abort();controller=new AbortController();clearTimeout(timer);}
function clearDetail(){detailGeneration++;selected='';detail=null;chosen='';$('detail').replaceChildren();$('detail').hidden=true;}
function clearPrivate(){clearDetail();students=[];$('rows').replaceChildren();$('workspace').hidden=true;}
function remember(ref=''){const url=new URL(location.href);url.searchParams.set('classId',classId);url.hash=ref?new URLSearchParams({student:ref,...(chosen?{view:chosen}:{})}).toString():'';history.replaceState({},'',url);}
async function request(path){
 const response=await fetch(base+root+path,teacherSessionRequestOptions({cache:'no-store',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(15000)])}));
 const data=await response.json().catch(()=>({}));if(!response.ok||data.ok===false)throw Object.assign(new Error(data.message||'Chưa đọc được bản đã lưu.'),{status:response.status});return data;
}
async function handle(error,current=generation){
 if(current!==generation||error.name==='AbortError')return;
 if(error.status===401||error.status===403){cancel();clearPrivate();if(error.status===401)await login();notice(error.message);}
 else{notice(error.message+' Sẽ tự thử lại; nội dung đang hiện là bản đọc trước đó.');schedule();}
}
function schedule(){clearTimeout(timer);if(!document.hidden&&!$('workspace').hidden)timer=setTimeout(()=>void refresh(),30000);}
function renderRows(){
 const q=$('search').value.trim().toLocaleLowerCase('vi'),rows=students.filter(s=>s.name.toLocaleLowerCase('vi').includes(q));
 $('rows').innerHTML=rows.map(s=>{const latest=s.sessions.at(-1);return `<tr><td><strong>${escape(s.name)}</strong>${s.active===false?'<small>Hồ sơ cũ</small>':''}</td><td>${s.sessions.length}</td><td>${latest?latest.heardConfirmed===true?'Đã xác nhận nghe rõ':latest.submittedAt?'Đã gửi kết quả thử':'Chưa hoàn tất':'Chưa có bản lưu'}</td><td>${latest?`Reading: ${latest.readingSubmittedAt?'đã nộp':latest.readingSaved?'đã lưu nháp':'chưa có'}<br>Writing: ${latest.writingSubmittedAt?'đã nộp':latest.writingSaved?'đã lưu nháp':'chưa có'}`:'Chưa có'}</td><td>${s.sessions.length?`<button class="text" type="button" data-student="${escape(s.studentRef)}">Xem bản đã lưu →</button>`:'Chưa mở'}</td></tr>`;}).join('')||'<tr><td colspan="5">Không có học viên phù hợp.</td></tr>';
 $('list-count').textContent=`${rows.length}/${students.length} học viên · Chỉ phản ánh dữ liệu hệ thống đã nhận`;
}
async function refresh(){
 const current=generation;
 try{const data=await request('/students?'+new URLSearchParams({classId}));if(current!==generation)return;students=data.students;renderRows();
  if(selected){if(students.some(s=>s.studentRef===selected&&s.sessions.length))await loadDetail(selected);else clearDetail();}
  if(current!==generation)return;notice('Đã đọc lúc '+new Date().toLocaleTimeString('vi-VN')+' · Tự đọc lại sau 30 giây khi trang đang mở.');schedule();
 }catch(error){await handle(error,current);}
}
function answers(value){const rows=Object.entries(value||{}).sort((a,b)=>Number(a[0])-Number(b[0]));return rows.length?rows.map(([n,v])=>`<div class="teacher-answer"><span>Câu ${escape(n)}</span><span>${escape(v||'Chưa nhập')}</span></div>`).join(''):'<p>Chưa có câu trả lời đã lưu.</p>';}
function renderDetail(){
 const s=detail.sessions.find(s=>s.viewId===chosen)||detail.sessions.at(-1);chosen=s?.viewId||'';
 $('detail').innerHTML=`<div class="teacher-detail-heading"><h2>${escape(detail.student.name)}</h2><button id="close-detail" class="text" type="button">Đóng chi tiết</button></div>${s?`
  <label for="session-select">Lượt làm quen</label><select id="session-select">${detail.sessions.map((r,i)=>`<option value="${r.viewId}" ${r.viewId===chosen?'selected':''}>Lượt ${i+1} · ${escape(stamp(r.createdAt))}${r.expired?' · Phiên học viên đã hết hạn':''}</option>`).join('')}</select>
  <section class="teacher-paper"><h3>Thiết bị và kết quả tự khai</h3><p>Cùng máy dự kiến thi: ${yes(s.sameComputer)} · Cùng tai nghe: ${yes(s.sameHeadphones)}</p><p>Thời gian đã phát: ${Number(s.heardSeconds)||0} giây · Xác nhận nghe rõ: ${yes(s.heardConfirmed)}</p><p>Kết quả nghe: ${s.submittedAt?'đã gửi lúc '+escape(stamp(s.submittedAt)):'chưa gửi hoàn tất'}</p>
  ${s.webChecks?.checks?.length?'<ul>'+s.webChecks.checks.map(c=>`<li>${escape(checkLabels[c.id]||'Mục kiểm')}: ${escape(checkStates[c.state]||'Chưa xác định')}</li>`).join('')+'</ul>':'<p>Chưa có báo cáo kiểm trên trình duyệt.</p>'}</section>
  <div class="teacher-grid"><section class="teacher-paper"><h3>Listening đã lưu</h3>${answers(s.listeningAnswers)}</section><section class="teacher-paper"><h3>Reading đã lưu</h3><p>${s.readingSubmittedAt?'Đã nộp lúc '+escape(stamp(s.readingSubmittedAt)):'Chưa nộp'}</p>${answers(s.readingAnswers)}</section></div>
  <section class="teacher-paper"><h3>Writing đã lưu</h3><p>${s.writingSubmittedAt?'Đã nộp lúc '+escape(stamp(s.writingSubmittedAt)):'Chưa nộp'}</p><div class="teacher-notes">${escape(s.writingText||'Chưa có nội dung đã lưu.')}</div></section>`:'<p>Chưa có lượt làm quen.</p>'}`;
 $('detail').hidden=false;$('close-detail').addEventListener('click',()=>{clearDetail();remember();});
 $('session-select')?.addEventListener('change',()=>{chosen=$('session-select').value;renderDetail();remember(selected);});
}
async function loadDetail(ref){
 const current=generation,sequence=++detailGeneration;selected=ref;
 try{const data=await request('/students/'+encodeURIComponent(ref)+'?'+new URLSearchParams({classId}));if(current!==generation||sequence!==detailGeneration||selected!==ref)return;
  if(data.student.studentRef!==ref)throw new Error('Bản trả về chưa khớp học viên đang chọn.');detail=data;renderDetail();remember(ref);schedule();
 }catch(error){await handle(error,current);}
}
async function boot(){
 cancel();clearPrivate();$('auth').hidden=true;const current=generation;
 try{await window.IzoneTeacherSso?.restore('term67');if(current!==generation)return;const options=await request('/classes');if(current!==generation)return;classes=options.classes;
  const params=new URLSearchParams(location.search),requested=params.get('classId')||params.get('class'),match=classes.find(c=>c.classId===requested||c.classCode===requested);
  if(requested&&!match)throw Object.assign(new Error('Tài khoản chưa có quyền xem lớp trong link này.'),{status:403});
  classId=(match||classes[0])?.classId;if(!classId)throw new Error('Chưa có lớp được cấp quyền.');
  $('class-select').innerHTML=classes.map(c=>`<option value="${escape(c.classId)}">${escape(c.classCode)}</option>`).join('');$('class-select').value=classId;$('workspace').hidden=false;await refresh();
  const fragment=new URLSearchParams(location.hash.slice(1)),wanted=fragment.get('student');if(current===generation&&wanted&&students.some(s=>s.studentRef===wanted&&s.sessions.length)){chosen=/^[a-f0-9]{64}$/.test(fragment.get('view')||'')?fragment.get('view'):'';await loadDetail(wanted);}
 }catch(error){await handle(error,current);}
}
async function login(){
 $('auth').hidden=false;
 try{googlePromise||=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='https://accounts.google.com/gsi/client';script.onload=resolve;script.onerror=()=>{googlePromise=null;reject(new Error('Chưa tải được đăng nhập Google.'));};document.head.append(script);});await googlePromise;
  google.accounts.id.initialize({client_id:config.GOOGLE_CLIENT_ID,auto_select:false,callback:async value=>{try{await client.login(value.credential);await boot();}catch(e){notice(e.message);}}});
  google.accounts.id.renderButton($('google-signin'),{theme:'outline',size:'large',text:'signin_with'});
 }catch(e){notice(e.message);}
}
$('rows').addEventListener('click',event=>{const button=event.target.closest('[data-student]');if(button){clearDetail();void loadDetail(button.dataset.student);}});
$('search').addEventListener('input',renderRows);$('refresh').addEventListener('click',()=>void refresh());$('retry').addEventListener('click',()=>void boot());
$('class-select').addEventListener('change',()=>{cancel();clearDetail();students=[];$('rows').replaceChildren();classId=$('class-select').value;remember();void refresh();});
$('logout').addEventListener('click',async()=>{cancel();clearPrivate();try{await client.logout();window.google?.accounts?.id?.disableAutoSelect();await login();notice('Đã đăng xuất.');}catch(e){notice('Chưa xác nhận đăng xuất: '+e.message);}});
document.addEventListener('visibilitychange',()=>{clearTimeout(timer);if(!document.hidden&&!$('workspace').hidden)void refresh();});
void boot();

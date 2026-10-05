import {ORDER,FIELDS} from '../lesson5-demo/core.mjs';
// Nhận cookie giảng viên riêng, đọc tiến độ/bài và ghi góp ý vào đúng phiên/phần.
// Không lưu credential Google trong localStorage. Lỗi giữ lời góp ý để thử lại.
const base='https://ducizone.ddns.net/api/handout67/v1/teacher';
const $=id=>document.getElementById(id);
const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const labels={topic:'Topic sentence và idea',b1:'Điểm B · Ý 1',a1:'Điểm A · Ý 1',x1:'Cầu nối X · Ý 1',b2:'Điểm B · Ý 2',a2:'Điểm A · Ý 2',x2:'Cầu nối X · Ý 2',idea1:'Idea 1',idea2:'Idea 2',topicSentence:'Topic sentence'};
const statuses={draft:'Chưa check',passed:'Đạt',revision:'Cần sửa',pending:'Đang chấm',technical_error:'Gặp lỗi'};
let epoch=0,rows=[],selected=null,timer=null,loading=false,sending=false,detailSequence=0,detailVersion=null,authBusy=false,actorEmail='';
async function request(path,method='GET',body){
 const payload=body===undefined?undefined:JSON.stringify(body);
 const requestEpoch=epoch;
 let response,value;
 for(let i=0;i<2;i++){
  if(requestEpoch!==epoch)throw Object.assign(new Error('IDENTITY_CHANGED'),{status:401});
  try{response=await fetch(base+path,{method,credentials:'include',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000),headers:{'Content-Type':'application/json',...(method==='GET'?{}:{'X-Handout67-CSRF':'1'})},...(payload===undefined?{}:{body:payload})});value=await response.json();break;}catch(e){if(i===1)throw e;}
 }
 if(requestEpoch!==epoch)throw Object.assign(new Error('IDENTITY_CHANGED'),{status:401});
 if(!response.ok||value.ok!==true)throw Object.assign(new Error(value.error||'TECHNICAL_FAILURE'),{status:response.status});return value;
}
function errorText(error){return error.status===409?'Học viên vừa sửa bài. Nhấn Cập nhật để đọc bài mới rồi gửi lại góp ý; lời góp ý đang nhập được giữ.':error.status===401?'Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.':error.status===403?'Tài khoản của bạn chưa có quyền xem lớp hoặc thao tác này.':'Chưa tải được dữ liệu. Hãy thử lại khi kết nối ổn định.';}
function report(error,target='error'){const node=$(target);node.textContent=errorText(error);node.hidden=false;}
function rowStatus(row){const s=Object.values(row.steps);return !row.sessionRef?'not_started':row.passed===7?'complete':s.includes('technical_error')?'technical_error':s.includes('pending')?'pending':s.includes('revision')?'revision':'working';}
function renderRows(){
 const q=$('search').value.trim().toLocaleLowerCase('vi'),filter=$('status-filter').value;
 const filtered=rows.filter(r=>r.displayName.toLocaleLowerCase('vi').includes(q)&&(filter==='all'||rowStatus(r)===filter));
 $('students').innerHTML=filtered.map(r=>`<tr><td><button type="button" data-student="${escape(r.studentRef)}">${escape(r.displayName)}</button><small>${r.sessionRef?'Đã mở bài':'Chưa bắt đầu'}</small></td><td>${r.passed}/7</td>${ORDER.map(k=>`<td><span class="step-status ${escape(r.steps[k]||'draft')}">${r.steps[k]?statuses[r.steps[k]]:'—'}</span></td>`).join('')}<td>${r.comments}</td></tr>`).join('')||'<tr><td colspan="10" class="empty">Không có học viên phù hợp.</td></tr>';
 $('summary').textContent=`${rows.length} học viên · ${rows.filter(r=>!r.sessionRef).length} chưa bắt đầu · ${rows.filter(r=>r.passed===7).length} đã xong · ${rows.filter(r=>rowStatus(r)==='revision').length} cần sửa`;
}
async function refresh(forceDetail=false){
 if(loading||document.hidden)return;loading=true;const current=epoch,classRef=$('class-select').value;
 try{const value=await request('/students?class='+encodeURIComponent(classRef));if(current!==epoch||classRef!==$('class-select').value)return;rows=value.students;renderRows();$('updated').textContent='Đã cập nhật '+new Date().toLocaleTimeString('vi-VN');$('error').hidden=true;if(selected?.ref&&!sending&&(forceDetail||!$('comment-text').value.trim()))await readDetail(selected.ref);}catch(e){if(current===epoch)report(e);}finally{loading=false;}
}
function snapshot(note){return Object.entries(note.snapshot||{}).map(([k,v])=>(labels[k]||k)+': '+v).join('\n\n');}
function renderDetail(session){
 detailVersion=session.version;
 $('comment-form').hidden=false;if(!sending)$('comment-submit').disabled=false;
 $('detail-content').innerHTML=ORDER.map(key=>{
  const s=session.steps[key];
  const fields=FIELDS[key].map(f=>`<b>${labels[f]||labels[key]}</b><p class="field-read">${escape(session.responses[f])||'<span class="empty">Chưa có nội dung.</span>'}</p>`).join('');
  const ai=[...s.history].reverse().map((h,i)=>`<details class="detail-comments" ${i===0?'open':''}><summary>AI · Comment lần ${h.number} · ${statuses[h.status]}</summary><p>${escape(h.feedback)}</p><details><summary>Nội dung đã gửi</summary><pre>${escape(snapshot(h))}</pre></details></details>`).join('');
  const teacher=(session.teacherComments||[]).filter(c=>c.section===key).reverse().map(c=>`<details class="detail-comments teacher-note" open><summary>Giảng viên · ${escape(c.authorName)}</summary><p>${escape(c.feedback)}</p><details><summary>Nội dung lúc góp ý</summary><pre>${escape(snapshot(c))}</pre></details></details>`).join('');
  return `<section class="detail-step"><header><h3>${labels[key]}</h3><span class="step-status ${escape(s.status)}">${statuses[s.status]}</span></header>${fields}${teacher}${ai}${s.status==='technical_error'?'<p class="error">Chấm gặp lỗi kỹ thuật. Học viên có thể gửi Check lại; nội dung đã lưu được giữ.</p>':''}</section>`;
 }).join('')+Object.entries(session.vocabulary||{}).map(([idea,v])=>`<div class="vocab-read"><h3>Từ vựng · Ý ${escape(idea)}</h3>${v.status==='ready'?Object.entries(v.groups).map(([k,list])=>`<p><b>${k}</b> · ${list.map(x=>escape(x.phrase)+' — '+escape(x.meaningVi)).join('; ')}</p>`).join(''):`<p>${v.status==='failed'?'Gợi ý gặp lỗi, học viên có thể thử lại.':'Đang chuẩn bị gợi ý.'}</p>`}</div>`).join('');
}
async function readDetail(ref){
 const current=epoch,sequence=++detailSequence;
 const value=await request('/sessions/'+ref);
 if(current===epoch&&selected?.ref===ref&&sequence===detailSequence)renderDetail(value.session);
}
async function openDetail(studentRef){
 if(sending)return;
 const row=rows.find(r=>r.studentRef===studentRef);if(!row)return;
 const current=epoch;detailVersion=null;detailSequence++;selected={studentRef,ref:row.sessionRef};$('detail').hidden=false;$('detail-name').textContent=row.displayName;$('detail-content').textContent=row.sessionRef?'Đang tải bài…':'Học viên chưa bắt đầu bài làm.';$('comment-form').hidden=true;$('comment-submit').disabled=true;$('comment-text').value='';$('comment-status').textContent='';
 if(row.sessionRef){try{await readDetail(row.sessionRef);}catch(e){if(current===epoch&&selected?.ref===row.sessionRef)report(e);}}
 $('detail').scrollIntoView({behavior:'smooth',block:'start'});
}
async function enter(){
 const current=++epoch;
 const result=await request('/classes');if(current!==epoch)return;
 $('class-select').innerHTML=result.classes.map(c=>`<option value="${escape(c.classRef)}">${escape(c.className)}</option>`).join('');
 if(!result.classes.length)throw Object.assign(new Error('TEACHER_FORBIDDEN'),{status:403});
 $('login').hidden=true;$('dashboard').hidden=false;await refresh();if(current!==epoch)return;clearInterval(timer);timer=setInterval(refresh,15000);
}
async function login(response){if(authBusy)return;authBusy=true;try{const result=await request('/session','POST',{credential:response.credential});actorEmail=result.reviewer.email;await enter();$('login-error').hidden=true;}catch(e){report(e,'login-error');}finally{authBusy=false;}}
$('refresh').addEventListener('click',()=>refresh(true));$('search').addEventListener('input',renderRows);$('status-filter').addEventListener('change',renderRows);
$('class-select').addEventListener('change',()=>{epoch++;selected=null;$('detail').hidden=true;void refresh();});
$('students').addEventListener('click',event=>{const b=event.target.closest('[data-student]');if(b)void openDetail(b.dataset.student);});
$('close-detail').addEventListener('click',()=>{selected=null;detailVersion=null;detailSequence++;$('detail').hidden=true;});
$('logout').addEventListener('click',async()=>{if(authBusy)return;authBusy=true;epoch++;clearInterval(timer);selected=null;rows=[];$('detail').hidden=true;$('dashboard').hidden=true;$('login').hidden=true;$('students').innerHTML='';$('comment-text').value='';try{await request('/session','DELETE');}catch(e){report(e,'login-error');}finally{authBusy=false;$('login').hidden=false;}window.google?.accounts.id.disableAutoSelect();});
$('comment-form').addEventListener('submit',async event=>{
 event.preventDefault();if(sending||!selected?.ref||!Number.isSafeInteger(detailVersion))return;
 const ref=selected.ref,current=epoch,feedback=$('comment-text').value.trim(),section=$('comment-section').value;if(!feedback)return;
 sending=true;detailSequence++;$('comment-submit').disabled=true;$('comment-status').textContent='Đang gửi góp ý…';
 try{const value=await request('/sessions/'+ref+'/comments','POST',{section,feedback,expectedActor:actorEmail,expectedVersion:detailVersion,requestId:crypto.randomUUID()});if(current!==epoch||selected?.ref!==ref)return;detailSequence++;renderDetail(value.session);if($('comment-text').value.trim()===feedback)$('comment-text').value='';$('comment-status').textContent='Đã lưu góp ý; học viên sẽ thấy ở đúng phần bài.';await refresh();}catch(e){if(current===epoch&&selected?.ref===ref)$('comment-status').textContent=errorText(e);}finally{sending=false;$('comment-submit').disabled=false;}
});
async function boot(){
 try{const result=await request('/session');actorEmail=result.reviewer.email;await enter();}catch(e){if(e.status!==401)report(e,'login-error');}
 try{const {clientId}=await request('/config');let attempts=0;const setup=()=>{if(window.google?.accounts?.id){window.google.accounts.id.initialize({client_id:clientId,callback:login,auto_select:false});window.google.accounts.id.renderButton($('google-signin'),{theme:'outline',size:'large',text:'signin_with',locale:'vi'});}else if(attempts++<100)setTimeout(setup,100);else $('login-error').textContent='Chưa tải được nút Google. Hãy tải lại trang.';};setup();}catch(e){report(e,'login-error');}
}
void boot();

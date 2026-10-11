// Phiên Google riêng cho demo, mở cho mọi tài khoản Google đã xác minh. Đề, bài viết, nhận xét chỉ ở bộ nhớ tab.
// Đổi bài/hết phiên hủy yêu cầu cũ; iframe riêng không có quyền gửi bài học viên.
import { createTeacherSessionClient, teacherSessionRequestOptions } from '../../shared/teacher-session-client.js';
const config = window.TERM_TEST_APP_CONFIG;
const session = createTeacherSessionClient({ apiBaseUrl: config.API_BASE_URL, sessionPath:'/api/term-tests/teacher/design-demo/session' });
const endpoint = config.API_BASE_URL + '/api/term-tests/teacher/design-demo';
const el = Object.fromEntries(['access','workspace','logout','restore','mode','attempt','attempt-label','screen','reset-trial','source-note','frame-slot','real-status'].map(id=>[id,document.getElementById(id)]));
let generation=0, controller=new AbortController(), authenticated=false, content=null, snapshot=null, audioUrl=null;
let trial={ listening:{}, reading:{}, task1:'', task2:'', plans:{}, result:null, writingSubmitted:false };
const status=(message,error=false)=>{el['real-status'].textContent=message;el['real-status'].dataset.error=String(error);};
function clearPrivate(){generation++;controller.abort();controller=new AbortController();authenticated=false;content=null;snapshot=null;trial={listening:{},reading:{},task1:'',task2:'',plans:{},result:null,writingSubmitted:false};el['frame-slot'].replaceChildren();el.attempt.replaceChildren();if(audioUrl)URL.revokeObjectURL(audioUrl);audioUrl=null;el.workspace.hidden=true;el.access.hidden=false;el.logout.hidden=true;}
async function request(path,options={}){
 const ticket=generation;const response=await fetch(endpoint+path,teacherSessionRequestOptions({...options,cache:'no-store',signal:controller.signal}));
 const data=await response.json();if(ticket!==generation)throw new DOMException('Yêu cầu cũ','AbortError');
 if(!response.ok||!data.ok){if(response.status===401||response.status===403)clearPrivate();throw new Error(data.message||data.error||'Chưa tải được dữ liệu.');}return data;
}
const scope='?class=IC2200&test=term-test-2';
async function selectAttempt(){
 const ticket=++generation;controller.abort();controller=new AbortController();snapshot=null;el['frame-slot'].replaceChildren();
 if(el.mode.value==='saved'){
   if(!el.attempt.value){status('Lớp chưa có bài đã nộp để xem.');return;}
   status('Đang tải đúng bài làm và lần chấm đã lưu…');
   const data=await request('/snapshot'+scope+'&attempt='+encodeURIComponent(el.attempt.value));if(ticket!==generation)return;snapshot=data.snapshot;
 }
 if(ticket!==generation)return;renderFrame();status('');
}
function renderFrame(){
 if(!authenticated||!content)return;
 const saved=el.mode.value==='saved';if(saved&&!snapshot)return;
 el['attempt-label'].hidden=!saved;el['reset-trial'].hidden=saved;
 el['source-note'].textContent=saved?'Chỉ đọc · đề v'+snapshot.definitionVersion+' · lần chấm '+(snapshot.grading?.gradingVersion??'chưa có'):'Bản thử riêng · không ghi điểm hoặc gửi chấm AI';
 const frame=document.createElement('iframe');frame.title='Demo Term Test 2';frame.src='real-exam.html?test=term-test-2&class=DEMO67&screen='+el.screen.value;
 el['frame-slot'].replaceChildren(frame);
}
// Chỉ iframe cùng nguồn đang được hiển thị được nhận dữ liệu; không dùng postMessage wildcard.
window.getRealDemoContext=child=>{
 if(!authenticated||child!==el['frame-slot'].firstElementChild?.contentWindow)throw new Error('Phiên demo không còn hiệu lực.');
 return {content:content.content,timing:content.timing,snapshot,trial,mode:el.mode.value,screen:el.screen.value,
  navigate(screen){if(['listening','reading','writing','result'].includes(screen)){el.screen.value=screen;renderFrame();}},
  async grade(){const data=await request('/grade'+scope,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({definitionVersion:content.definitionVersion,listening:trial.listening,reading:trial.reading})});trial.result=data.result;return data.result;},
  async audio(){if(audioUrl)return audioUrl;const ticket=generation;const response=await fetch(endpoint+'/audio'+scope,teacherSessionRequestOptions({cache:'no-store',signal:controller.signal}));if(!response.ok){if([401,403].includes(response.status))clearPrivate();throw new Error('Không tải được audio đề thật.');}const blob=await response.blob();if(ticket!==generation)throw new DOMException('Yêu cầu cũ','AbortError');audioUrl=URL.createObjectURL(blob);return audioUrl;}
 };
};
async function connect(){
 const ticket=generation;const restored=await session.restore();if(ticket!==generation)return;if(!restored){clearPrivate();status('Đăng nhập để mở đề và bài của IC2200.');return;}
 authenticated=true;status('Đang tải bộ đề và danh sách bài…');
 try{const [c,list]=await Promise.all([request('/content'+scope),request('/attempts'+scope)]);content=c;
 el.attempt.replaceChildren(...list.attempts.map(a=>{const o=document.createElement('option');o.value=a.id;o.textContent=a.name+' · '+new Date(a.submittedAt).toLocaleDateString('vi-VN');return o;}));
 el.access.hidden=true;el.workspace.hidden=false;el.logout.hidden=false;await selectAttempt();
 }catch(error){if(error.name!=='AbortError'){clearPrivate();status(error.message,true);}}
}
async function action(fn){try{await fn();}catch(error){if(error.name!=='AbortError')status(error.message,true);}}
el.mode.addEventListener('change',()=>action(selectAttempt));el.attempt.addEventListener('change',()=>action(selectAttempt));el.screen.addEventListener('change',renderFrame);
el['reset-trial'].addEventListener('click',()=>{trial={listening:{},reading:{},task1:'',task2:'',plans:{},result:null,writingSubmitted:false};renderFrame();});
el.restore.addEventListener('click',()=>action(connect));
el.logout.addEventListener('click',()=>action(async()=>{clearPrivate();try{window.google?.accounts.id.disableAutoSelect();}catch{}await session.logout();status('Đã đăng xuất; đề và bài học viên đã được xóa khỏi màn hình.');}));
window.addEventListener('pagehide',clearPrivate);window.addEventListener('pageshow',e=>{if(e.persisted)action(connect);});
// Kiểm lại quyền khi quay lại tab; không để màn hình bài thật sống qua phiên đã hết hạn.
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&authenticated)action(async()=>{if(!await session.restore()){clearPrivate();status('Phiên đã hết hạn. Hãy đăng nhập lại.');}});});
const googleScript=document.createElement('script');googleScript.src='https://accounts.google.com/gsi/client';googleScript.onload=()=>{
 window.google.accounts.id.initialize({client_id:config.GOOGLE_CLIENT_ID,callback:response=>action(async()=>{clearPrivate();await session.login(response.credential);await connect();})});
 window.google.accounts.id.renderButton(document.getElementById('google-login'),{type:'standard',theme:'outline',size:'large',text:'signin_with'});
};googleScript.onerror=()=>status('Không tải được nút Google. Bạn vẫn có thể kiểm tra phiên đăng nhập đã có.',true);document.head.append(googleScript);
action(connect);

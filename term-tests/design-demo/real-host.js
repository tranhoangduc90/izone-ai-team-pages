// Demo mở thẳng nội dung IC2200. Bài thử và nhận xét chỉ ở bộ nhớ tab.
// Đổi bài hủy yêu cầu cũ; iframe chỉ dùng adapter demo không ghi bài học viên.
const toolsEnabled=document.body.dataset.demoTools!=='off';
const assetBase=document.body.dataset.demoAssets||'.';
let currentScreen='lobby';
const mode=()=>toolsEnabled?el.mode.value:'blank';
const config = window.TERM_TEST_APP_CONFIG;
const endpoint = config.API_BASE_URL + '/api/term-tests/teacher/design-demo';
const el = Object.fromEntries(['workspace','mode','attempt','attempt-label','screen','reset-trial','source-note','frame-slot','real-status'].map(id=>[id,document.getElementById(id)]));
let generation=0, controller=new AbortController(), ready=false, content=null, snapshot=null, audioUrl=null;
let trial={ listening:{}, reading:{}, task1:'', task2:'', plans:{}, result:null, writingSubmitted:false };
const status=(message,error=false)=>{el['real-status'].textContent=message;el['real-status'].dataset.error=String(error);};
function clearPrivate(){generation++;controller.abort();controller=new AbortController();ready=false;content=null;snapshot=null;trial={listening:{},reading:{},task1:'',task2:'',plans:{},result:null,writingSubmitted:false};el['frame-slot'].replaceChildren();el.attempt?.replaceChildren();if(audioUrl)URL.revokeObjectURL(audioUrl);audioUrl=null;el.workspace.hidden=false;}
async function request(path,options={}){
 const ticket=generation;const response=await fetch(endpoint+path,{...options,credentials:'omit',cache:'no-store',signal:controller.signal});
 const data=await response.json();if(ticket!==generation)throw new DOMException('Yêu cầu cũ','AbortError');
 if(!response.ok||!data.ok){if(response.status===401||response.status===403)clearPrivate();throw new Error(data.message||data.error||'Chưa tải được dữ liệu.');}return data;
}
const scope='?class=IC2200&test=term-test-2';
async function selectAttempt(){
 const ticket=++generation;controller.abort();controller=new AbortController();snapshot=null;el['frame-slot'].replaceChildren();
 if(mode()==='saved'){
   if(!el.attempt.value){status('Lớp chưa có bài đã nộp để xem.');return;}
   status('Đang tải đúng bài làm và lần chấm đã lưu…');
   const data=await request('/snapshot'+scope+'&attempt='+encodeURIComponent(el.attempt.value));if(ticket!==generation)return;snapshot=data.snapshot;
 }
 if(ticket!==generation)return;renderFrame();status('');
}
function renderFrame(){
 if(!ready||!content)return;
 const saved=mode()==='saved';if(saved&&!snapshot)return;
 if(el['attempt-label'])el['attempt-label'].hidden=!saved;if(el['reset-trial'])el['reset-trial'].hidden=saved;
 if(el['source-note'])el['source-note'].textContent=saved?'Chỉ đọc · đề v'+snapshot.definitionVersion+' · lần chấm '+(snapshot.grading?.gradingVersion??'chưa có'):'Bản thử riêng · không ghi điểm hoặc gửi chấm AI';
 const frame=document.createElement('iframe');frame.title='Demo Term Test 2';frame.src=assetBase+'/real-exam.html?v=split-demo-20261012&test=term-test-2&class=DEMO67&screen='+currentScreen;
 // Giữ preset được chọn từ link xem demo khi chuyển giữa các màn.
 const palette=toolsEnabled?new URLSearchParams(location.search).get('labOption'):null;
 if(['mist','sage','sand','lavender','reading'].includes(palette))frame.src+='&labOption='+palette;
 el['frame-slot'].replaceChildren(frame);
}
// Chỉ iframe cùng nguồn đang được hiển thị được nhận dữ liệu; không dùng postMessage wildcard.
window.getRealDemoContext=child=>{
 if(!ready||child!==el['frame-slot'].firstElementChild?.contentWindow)throw new Error('Phiên demo không còn hiệu lực.');
 return {content:content.content,timing:content.timing,snapshot,trial,mode:mode(),screen:currentScreen,toolsEnabled,
  navigate(screen){if(['lobby','listening','reading','writing','result'].includes(screen)){currentScreen=screen;if(el.screen)el.screen.value=screen;renderFrame();}},
  async grade(){const data=await request('/grade'+scope,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({definitionVersion:content.definitionVersion,listening:trial.listening,reading:trial.reading})});trial.result=data.result;return data.result;},
  async audio(){if(audioUrl)return audioUrl;const ticket=generation;const response=await fetch(endpoint+'/audio'+scope,{credentials:'omit',cache:'no-store',signal:controller.signal});if(!response.ok){if([401,403].includes(response.status))clearPrivate();throw new Error('Không tải được audio đề thật.');}const blob=await response.blob();if(ticket!==generation)throw new DOMException('Yêu cầu cũ','AbortError');audioUrl=URL.createObjectURL(blob);return audioUrl;}
 };
};
async function connect(){
 const ticket=generation;status(toolsEnabled?'Đang tải bộ đề và danh sách bài…':'Đang tải đề Term Test 2…');
 try{const [c,list]=await Promise.all([request('/content'+scope),toolsEnabled?request('/attempts'+scope):Promise.resolve({attempts:[]})]);if(ticket!==generation)return;content=c;ready=true;
 el.attempt?.replaceChildren(...list.attempts.map(a=>{const o=document.createElement('option');o.value=a.id;o.textContent=a.name+' · '+new Date(a.submittedAt).toLocaleDateString('vi-VN');return o;}));
 el.workspace.hidden=false;await selectAttempt();
 }catch(error){if(error.name!=='AbortError'){clearPrivate();status(error.message,true);}}
}
async function action(fn){try{await fn();}catch(error){if(error.name!=='AbortError')status(error.message,true);}}
el.mode?.addEventListener('change',()=>action(selectAttempt));el.attempt?.addEventListener('change',()=>action(selectAttempt));el.screen?.addEventListener('change',()=>{currentScreen=el.screen.value;renderFrame();});
el['reset-trial']?.addEventListener('click',()=>{trial={listening:{},reading:{},task1:'',task2:'',plans:{},result:null,writingSubmitted:false};renderFrame();});
window.addEventListener('pagehide',clearPrivate);
window.addEventListener('pageshow',e=>{if(e.persisted)action(connect);});
action(connect);

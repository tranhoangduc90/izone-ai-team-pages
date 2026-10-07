// Chỉ dùng trong Substitute. Token Google ở RAM; không dùng session/DB của Term Test.
const API='https://ducizone.ddns.net/substitute-teacher-api';
const TITLES={'substitute-test-1-k56':'Substitute Test 1 · Khóa 56','substitute-test-2-k56':'Substitute Test 2 · Khóa 56','substitute-test-1-k67':'Substitute Test 1 · Khóa 67','substitute-test-2-k67':'Substitute Test 2 · Khóa 67'};
const $=id=>document.getElementById(id);
const state={token:null,generation:0,detailGeneration:0,controller:null,scopes:[],rows:[],offset:0,hasMore:false};
const initial=new URLSearchParams(location.search);
const pageTest=Object.keys(TITLES).find(slug=>location.pathname.includes(slug+'-results'));
const selectedTest=()=>$('test-select').value;
const statusText=value=>({queued:'Chờ chấm Writing',processing:'Đang chấm Writing',ready:'Đã chấm Writing',failed:'Cần kiểm tra bài chấm'}[value]||'Chưa xác nhận');
const portalText=value=>({not_applicable:'DEMO · không gửi Portal',pending:'Chờ đồng bộ Portal',unknown:'Chưa xác nhận Portal',synced:'Đã xác nhận đồng bộ Portal'}[value]||'Chưa xác nhận Portal');
const number=value=>typeof value==='number'&&Number.isFinite(value)?String(value):'—';
const time=value=>value&&!Number.isNaN(Date.parse(value))?new Date(value).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'}):'—';
function node(tag,text,className){const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(className)el.className=className;return el;}
function message(text,type=''){const el=$('page-message');el.hidden=!text;el.textContent=text;el.className='notice '+type;}
function clearResults(text='Đăng nhập để xem kết quả của những lượt nộp thật.'){
 state.rows=[];$('student-detail').hidden=true;$('attempt-content').replaceChildren();$('student-rows').replaceChildren();
 const row=node('tr'),cell=node('td',text,'empty-cell');cell.colSpan=7;row.append(cell);$('student-rows').append(row);
 $('updated-at').textContent='';$('previous-page').disabled=true;$('next-page').disabled=true;$('page-range').textContent='';
}
function cancel(){state.generation++;state.controller?.abort();state.controller=null;}
function logout(){cancel();state.token=null;state.scopes=[];clearResults();$('filter-section').hidden=true;$('roster-section').hidden=true;$('logout').hidden=true;$('login-status').textContent='Chỉ giáo viên/quản trị được cấp quyền mới xem được kết quả.';$('google-signin').hidden=false;message('');window.google?.accounts?.id.disableAutoSelect();}
async function request(route,params={},signal,authenticated=true){
 const url=new URL(API+route);for(const [k,v]of Object.entries(params))url.searchParams.set(k,String(v));
 const controller=new AbortController(),abort=()=>controller.abort();signal?.addEventListener('abort',abort,{once:true});
 if(signal?.aborted)controller.abort();const timer=setTimeout(abort,20000);
 try{
  const response=await fetch(url,{method:'GET',cache:'no-store',credentials:'omit',headers:authenticated?{Authorization:'Bearer '+state.token}:{},signal:controller.signal});
  const data=await response.json().catch(()=>({}));
  if(!response.ok){const error=new Error(response.status===401?'Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.':response.status===403?'Tài khoản này không có quyền xem bài/lớp đã chọn.':'Không tải được kết quả. Hãy thử lại sau.');error.status=response.status;throw error;}
  return data;
 }finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
}
function handleError(error,generation){if(generation!==state.generation)return;if(error.status===401)logout();else clearResults('Chưa tải được kết quả.');message(error.name==='AbortError'?'Kết nối bị gián đoạn hoặc quá thời gian chờ. Bạn có thể tải lại kết quả.':error.message,'error');}
function classesForTest(){return state.scopes.filter(scope=>scope.testSlug===selectedTest()).map(scope=>scope.classCode);}
function renderClasses(requested='ALL'){
 const classes=classesForTest();$('class-filter').replaceChildren(new Option('Tất cả lớp được phép','ALL'),...classes.map(code=>new Option(code,code)));
 $('class-filter').value=classes.includes(requested)?requested:'ALL';
}
function score(skill,row){const value=row.scores?.[skill];if(!value)return'—';return row.testSlug==='substitute-test-1-k56'?`${number(value.raw)}/${number(value.max)}`:`${number(value.band)}/9 (${number(value.raw)}/${number(value.max)} câu)`;}
function renderRows(){
 $('student-rows').replaceChildren();
 for(const attempt of state.rows){
  const row=node('tr');row.dataset.attempt=attempt.attemptToken;
  const who=node('td',undefined,'student-cell');who.append(node('strong',attempt.studentName),node('span',attempt.classCode+' · '+time(attempt.submittedAt)));
  row.append(who,node('td',score('listening',attempt),'score-cell'),node('td',score('reading',attempt),'score-cell'),node('td',attempt.result?number(attempt.result.taskScore)+'/9':'—','score-cell'),node('td',statusText(attempt.status)),node('td',portalText(attempt.portalStatus)));
  const actions=node('td'),button=node('button','Chi tiết','open-student');button.type='button';button.addEventListener('click',()=>openAttempt(attempt));actions.append(button);row.append(actions);$('student-rows').append(row);
 }
 if(!state.rows.length){const row=node('tr'),cell=node('td','Chưa có lượt nộp trong phạm vi này.','empty-cell');cell.colSpan=7;row.append(cell);$('student-rows').append(row);}
 $('page-range').textContent=state.rows.length?`Lượt ${state.offset+1}–${state.offset+state.rows.length}`:'0 lượt nộp';
 $('previous-page').disabled=state.offset===0;$('next-page').disabled=!state.hasMore;
}
// HTML từ bài chấm chỉ hiển thị trong iframe không có quyền script, mạng, form hay điều hướng trang chính.
function appendFeedback(parent,value){
 if(value==null)return;
 if(typeof value==='object'){
  if(Array.isArray(value)){for(const part of value)appendFeedback(parent,part);}
  else for(const [key,part]of Object.entries(value)){parent.append(node('h4',({summary:'Nhận xét tổng hợp',strengths:'Điểm mạnh',improvements:'Cần cải thiện',annotations:'Ghi chú',text:'Nội dung',reason:'Lý do'}[key]||key)));appendFeedback(parent,part);}
  return;
 }
 const text=String(value);
 if(/<(?:p|div|table|h[1-6]|html)\b/i.test(text)){
  const frame=node('iframe');frame.title='Nhận xét Writing';frame.className='feedback-frame';frame.setAttribute('sandbox','');frame.referrerPolicy='no-referrer';
  frame.srcdoc='<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'; base-uri \'none\'; form-action \'none\'"><style>body{font:16px/1.6 system-ui;color:#182b45;margin:16px;overflow-wrap:anywhere}table{border-collapse:collapse;width:100%}td,th{border:1px solid #dce4ee;padding:8px}img,iframe,object,embed,form,script{display:none}</style></head><body>'+text+'</body></html>';
  parent.append(frame);
 }else parent.append(node('p',text,'feedback-text'));
}
async function openAttempt(attempt){
 const generation=state.generation,detailGeneration=++state.detailGeneration;$('student-detail').hidden=false;$('student-name').textContent=attempt.studentName;
 $('student-status').textContent=attempt.classCode+' · Nộp lúc '+time(attempt.submittedAt);$('attempt-content').replaceChildren(node('p','Đang tải đúng lượt nộp…'));
 state.selectedAttempt=attempt.attemptToken;
 try{
  const data=await request('/teacher/result',{test:attempt.testSlug,class:attempt.classCode,student:attempt.studentRef,attempt:attempt.attemptToken},state.controller?.signal);
  if(generation!==state.generation||detailGeneration!==state.detailGeneration||state.selectedAttempt!==attempt.attemptToken)return;
  if(data.attemptToken!==attempt.attemptToken||data.testSlug!==attempt.testSlug||data.classCode!==attempt.classCode||data.studentRef!==attempt.studentRef)throw new Error('Kết quả trả về không khớp lượt đã chọn.');
  const content=$('attempt-content');content.replaceChildren(node('p',statusText(data.status)+' · '+portalText(data.portalStatus)));
  content.append(node('h3',`Writing Task ${data.taskNumber} · ${data.result?number(data.result.taskScore)+'/9':'Chưa có điểm'}`));
  if(data.result){
   const criteria=node('div',undefined,'criterion-grid');for(const item of data.result.criteria||[]){const detail=node('details',undefined,'criterion-card');detail.append(node('summary',`${item.key||item.code} · ${number(item.score??item.bandScore)}/9`));appendFeedback(detail,item.feedback);if(item.components)appendFeedback(detail,item.components);criteria.append(detail);}content.append(criteria,node('h3','Báo cáo Writing cuối cùng'));appendFeedback(content,data.result.report);
  }else content.append(node('p','Bài làm của học viên đang được chấm, kết quả sẽ hiện lại sau'));
 }catch(error){if(detailGeneration===state.detailGeneration&&state.selectedAttempt===attempt.attemptToken)handleError(error,generation);}
}
async function loadResults(){
 if(!state.token)return;cancel();state.controller=new AbortController();const generation=state.generation;
 const test=selectedTest(),classCode=$('class-filter').value;
 clearResults('Đang tải kết quả…');message('');$('load-results').disabled=true;
 try{
  const data=await request('/teacher/results',{test,class:classCode,limit:50,offset:state.offset},state.controller.signal);
  if(generation!==state.generation)return;
  if(data.testSlug!==test||data.classCode!==classCode||!Array.isArray(data.results))throw new Error('Dữ liệu kết quả không đúng phạm vi đã chọn.');
  state.rows=data.results;state.hasMore=data.hasMore===true;renderRows();$('updated-at').textContent='Cập nhật '+time(new Date().toISOString());
  const url=new URL(location.href);url.searchParams.set('test',test);url.searchParams.set('class',classCode);history.replaceState(null,'',url);
 }catch(error){handleError(error,generation);}finally{if(generation===state.generation)$('load-results').disabled=false;}
}
async function signIn(response){
 cancel();clearResults();state.scopes=[];$('filter-section').hidden=true;$('roster-section').hidden=true;state.token=typeof response?.credential==='string'?response.credential:null;const generation=state.generation;
 if(!state.token){message('Chưa nhận được xác nhận đăng nhập từ Google.','error');return;}
 $('login-status').textContent='Đang kiểm tra quyền xem Substitute…';$('logout').hidden=false;
 try{
  const data=await request('/teacher/scopes');if(generation!==state.generation)return;
  state.scopes=(data.scopes||[]).filter(scope=>TITLES[scope.testSlug]);if(!state.scopes.length)throw new Error('Tài khoản này chưa được cấp quyền xem Substitute.');
  const tests=[...new Set(state.scopes.map(scope=>scope.testSlug))];$('test-select').replaceChildren(...tests.map(slug=>new Option(TITLES[slug],slug)));
  $('test-select').value=tests.includes(initial.get('test')||pageTest)?initial.get('test')||pageTest:tests[0];renderClasses((initial.get('class')||'ALL').toUpperCase());
  $('filter-section').hidden=false;$('roster-section').hidden=false;$('google-signin').hidden=true;$('login-status').textContent='Đã đăng nhập · chỉ hiển thị các bài/lớp được cấp quyền.';state.offset=0;await loadResults();
 }catch(error){if(generation===state.generation){state.token=null;$('login-status').textContent='Chưa mở được quyền xem kết quả.';message(error.message,'error');}}
}
async function initialize(){
 logout();
 try{
  const config=await request('/teacher/config',{},undefined,false);
  if(!window.google?.accounts?.id)await new Promise((resolve,reject)=>{const script=$('google-identity'),timer=setTimeout(()=>reject(new Error('Không tải được Google đăng nhập. Hãy tải lại trang.')),15000);script.addEventListener('load',()=>{clearTimeout(timer);resolve();},{once:true});script.addEventListener('error',()=>{clearTimeout(timer);reject(new Error('Trình duyệt không tải được Google đăng nhập.'));},{once:true});});
  window.google.accounts.id.initialize({client_id:config.googleClientId,callback:signIn,auto_select:false});
  window.google.accounts.id.renderButton($('google-signin'),{type:'standard',theme:'outline',size:'large',text:'signin_with',locale:'vi',width:270});
 }catch(error){message(error.message,'error');}
}
$('logout').addEventListener('click',logout);$('load-results').addEventListener('click',()=>{state.offset=0;loadResults();});
$('test-select').addEventListener('change',()=>{renderClasses();state.offset=0;loadResults();});$('class-filter').addEventListener('change',()=>{state.offset=0;loadResults();});
$('previous-page').addEventListener('click',()=>{state.offset=Math.max(0,state.offset-50);loadResults();});$('next-page').addEventListener('click',()=>{state.offset+=50;loadResults();});
initialize();

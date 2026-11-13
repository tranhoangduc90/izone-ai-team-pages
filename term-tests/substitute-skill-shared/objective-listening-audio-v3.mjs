import {portalStatus} from './portal-status.mjs';
import {DurableStore} from './storage.mjs';
import {prepareWritingOffline as prepareOffline} from './offline.mjs';
import {createAudioTools} from './audio.mjs';
const $=id=>document.getElementById(id),text=(id,v)=>$(id).textContent=v,show=(id,v=true)=>$(id).hidden=!v;
const testId=document.body.dataset.test,skill=document.body.dataset.skill,isListening=skill==='listening',API='https://ducizone.ddns.net/substitute-teacher-api/skill-makeup/v1/tests/'+testId;
let state,storage,content,native,player,busy=false,syncing=false,ownerHeld=false,releaseOwner,epoch=0,baseNow=Date.now(),baseMono=performance.now(),saveTimer,mounted=false,trialPassed=false;
let playbackStarted=false, stallReported=false, eofInFlight=false, eofNeedsSave=false, sealedNeedsSave=false;
const build='substitute-skill-audio-v3';
function audioEvidence(event, data={}){
 const observations=state.audioObservations||=[];
 observations.push({event,at:Date.now(),build,positionMs:Math.round((player?.snapshot().playerCurrentTime||0)*1000),...data});
 if(observations.length>24)observations.shift();
}
function setWaitingForAudio(waiting){
 $('objective-form').inert=waiting;
 $('submit').disabled=waiting||!state.audioEndedAt;
}
function displayPlaybackRetry(){
 $('start-audio').hidden=false;
 $('start-audio').disabled=false;
 text('local-status','Trình duyệt yêu cầu bấm Phát audio. Câu trả lời sẽ mở khi audio chạy.');
}
async function playOfficial(){
 const start=$('start-audio');
 start.disabled=true;
 try{
  await player.start();
  if(!ownerHeld||state.phase!=='draft'){
   player.finish('technical_stop','start_superseded',{stopAudio:true});
   return;
  }
  playbackStarted=true;
  start.hidden=true;
  setWaitingForAudio(false);
  text('local-status','Audio đang phát.');
  audioEvidence('playback_started');
  void persist().catch(fail);
 }catch(error){
  if(!ownerHeld||state.phase!=='draft')return;
  if(error.code==='PLAY_NOT_ALLOWED'){
   audioEvidence('playback_waiting_for_gesture',{code:error.code});
   displayPlaybackRetry();
   void persist().catch(fail);
   return;
  }
  await stop('learner_report',error.code||'PLAY_FAILED');
 }
}

function fail(e){text('notice',({OWNER_BUSY:'Bài đang mở ở tab khác. Hãy quay lại tab đó.',SKILL_GENERATION_STALE:'Giảng viên đã cấp lại lượt. Bản cũ được giữ để đối soát.',ALREADY_SUBMITTED:'Bạn đã nộp bài này. Hãy liên hệ giảng viên nếu cần hỗ trợ.',ATTEMPT_ALREADY_ACTIVE:'Bạn đang có một lượt thi. Hãy dùng trình duyệt đang làm hoặc nhờ giảng viên cấp lại.',SKILL_TEST_UNAVAILABLE:'Bài chưa mở hoặc đang tạm đóng.',SKILL_INTAKE_CLOSED:'Bài đang tạm đóng nhận lượt mới. Hãy liên hệ giảng viên.',LOCAL_PERSIST_FAILED:'Không lưu được trên thiết bị. Giữ nguyên trang và liên hệ giảng viên.'}[e.code]||'Chưa hoàn tất kết nối. Bài trên thiết bị vẫn được giữ; hãy thử lại khi có mạng.'));if(e.code==='SKILL_GENERATION_STALE'){freeze();show('replace-attempt');}}
async function api(action,body,method='POST',keepalive=false){const r=await fetch(API+'/'+action,{method,cache:'no-store',credentials:'omit',headers:method==='POST'?{'content-type':'application/json'}:{},...(method==='POST'?{body:JSON.stringify(body)}:{}),keepalive,signal:AbortSignal.timeout(12000)}),v=await r.json();if(!r.ok)throw Object.assign(Error(),{code:v.code,status:r.status});return v;}
async function own(){if(ownerHeld)return;if(!navigator.locks)throw Object.assign(Error(),{code:'OWNER_BUSY'});await new Promise((resolve,reject)=>navigator.locks.request('substitute-skill:'+testId,{ifAvailable:true},async lock=>{if(!lock)return reject(Object.assign(Error(),{code:'OWNER_BUSY'}));ownerHeld=true;resolve();await new Promise(r=>releaseOwner=r);}).catch(reject));}
const persist=()=>{if(!ownerHeld)throw Object.assign(Error(),{code:'OWNER_BUSY'});state.savedAt=Date.now();return storage.put(testId,state);};
const current=(e,id)=>ownerHeld&&epoch===e&&state?.identity?.attemptId===id;
const now=()=>Math.max(baseNow+performance.now()-baseMono,state?.lastTime||0);
const anchor=v=>{baseNow=v.serverNow;baseMono=performance.now();};
function payload(){return {...state.identity,revision:state.revision,capturedAt:Math.min(now(),state.deadlineAt??Infinity),snapshot:{answers:structuredClone(state.answers||{})}};}
function freeze(){if($('objective-form'))$('objective-form').inert=true;$('submit').disabled=true;}
function portal(v){text('portal-status',portalStatus(v));}
function finish(v=state.lastServer||{}){show('lobby',false);show('exam',false);show('finished');show('change-person',!!v.receipt);text('receipt',v.receipt?'Mã biên nhận: '+v.receipt.receiptId:state.phase==='technical_stop'?'Gián đoạn kỹ thuật · chưa thu bài để chấm.':'Bản nộp đã lưu trên thiết bị · đang chờ biên nhận');text('grading-status',state.phase==='technical_stop'?'Bài và nhật ký gián đoạn được giữ. Hãy liên hệ giảng viên để được cấp lại; không ghi điểm 0.':v.receipt?'Đã nhận và chấm bài.':'Chưa xác nhận máy chủ đã nhận. Hãy giữ trang hoặc mở lại trên thiết bị này.');portal(v);if(v.result){text('score',(isListening?'Listening':'Reading')+': '+v.result.score+' / '+v.result.max+' · Band '+v.result.band);if($('feedback').dataset.hash!==v.receipt?.snapshotHash){const table=document.createElement('table');table.className='skill-answer-table';const head=document.createElement('thead');head.innerHTML='<tr><th>Câu</th><th>Bài làm</th><th>Đáp án</th><th>Kết quả</th></tr>';table.append(head);const body=document.createElement('tbody');for(const d of v.result.details){const row=document.createElement('tr');for(const val of [d.number,d.studentAnswer,d.correctAnswer,({correct:'Đúng',incorrect:'Sai',blank:'Để trống'}[d.result])]){const cell=document.createElement('td');cell.textContent=val;row.append(cell);}body.append(row);}table.append(body);$('feedback').replaceChildren(table);$('feedback').dataset.hash=v.receipt.snapshotHash;}}}
async function check(){if(!ownerHeld||!state?.identity||busy||syncing)return;const e=epoch,id=state.identity.attemptId;try{const v=await api('status',state.identity);if(!current(e,id))return;anchor(v);state.lastServer=v;if(v.receipt){if(state.sealed&&state.sealed.operationId!==v.receipt.operationId)throw Error('RECEIPT_CONFLICT');state.phase='submitted';state.sealed=null;await persist();if(current(e,id))finish(v);}else if(state.phase==='technical_stop')await sync();}catch(error){if(current(e,id))fail(error);}}
async function sync(){if(!ownerHeld||busy||syncing||!state?.identity)return;syncing=true;const e=epoch,id=state.identity.attemptId;try{
 if(state.stopPending){const v=await api('interrupt',{...state.identity,reason:state.stopPending});if(!current(e,id))return;state.lastServer=v;state.stopPending=null;await persist();finish(v);}
 else if(state.sealed){
  if(sealedNeedsSave){
   await persist();
   if(!current(e,id))return;
   sealedNeedsSave=false;
   text('notice','');
   finish({...state.lastServer,receipt:null});
  }
  let v=await api('receipt',state.identity);if(!current(e,id))return;if(!v.receipt)v=await api('submit',state.sealed);if(!current(e,id))return;if(v.receipt?.operationId!==state.sealed.operationId)throw Error('RECEIPT_CONFLICT');state.lastServer=v;state.phase='submitted';state.sealed=null;await persist();if(current(e,id))finish(v);}
 else if(state.phase==='draft'&&state.pending){const pending=structuredClone(state.pending);await api('snapshot',pending);if(!current(e,id))return;if(state.pending?.revision===pending.revision)state.pending=null;await persist();text('local-status','Đã lưu trên hệ thống');}
 }catch(error){
  if(current(e,id)){
   text('local-status',sealedNeedsSave?'Đang chờ lưu bản chốt trên thiết bị':'Đã lưu trên thiết bị · chờ kết nối');
   fail(error);
  }
 }finally{syncing=false;}
}
async function changed(){if(!ownerHeld||state.phase!=='draft'||state.sealed)return;if(state.deadlineAt&&now()>=state.deadlineAt)return seal(true);state.revision++;state.lastTime=now();state.pending=payload();try{await persist();text('local-status','Đã lưu trên thiết bị');clearTimeout(saveTimer);saveTimer=setTimeout(sync,700);}catch(e){freeze();fail(e);}}
async function mount(){if(mounted)return;mounted=true;native=await import('./native-'+skill+'.mjs');const ui=state.ui??={flags:{[skill]:{}},activeSection:{[skill]:0},fontSize:{[skill]:100}};native[isListening?'mountNativeListening':'mountNativeReading']({content,answers:state.answers,grid:$(skill+'Questions'),form:$(skill+'View'),heading:$('exam-heading'),uiState:ui,onUiState:value=>{state.ui=structuredClone(value);void persist().catch(fail);}});await native.nativeLayout(content.controls,content.sourceSlug);for(const f of document.querySelectorAll('[data-question]')){f.value=state.answers?.[f.dataset.question]||'';f.dispatchEvent(new Event('input',{bubbles:true}));}await native.nativeAnnotations({content,identity:state.identity,storage,onError:fail});$(skill+'View').addEventListener('submit',e=>e.preventDefault());$(skill+'View').addEventListener('input',e=>{const n=e.target.dataset.question;if(n&&state.phase==='draft'){state.answers[n]=e.target.value;void changed();}});}
async function display(){show('lobby',false);show('finished',false);show('exam');text('learner',state.name+' · '+state.identity.classCode);await mount();tick();}
function tick(){
 if(!ownerHeld||state?.phase!=='draft'||state.sealed||eofNeedsSave)return;
 if(isListening&&!state.audioEndedAt){
  const audio=player?.snapshot();
  if(!playbackStarted){
   text('listening-clock','Chờ phát audio');
   return;
  }
  const heard=Math.floor(audio.playerCurrentTime);
  text('listening-clock','Đang nghe · '+Math.floor(heard/60)+':'+String(heard%60).padStart(2,'0'));
  if(audio.lastAdvanceAgeMs>15000&&!stallReported){
   stallReported=true;
   audioEvidence('playback_not_advancing',{ageMs:Math.round(audio.lastAdvanceAgeMs)});
   text('local-status','Audio chưa tiến. Nếu không nghe được, bấm Tôi không nghe được.');
   void persist().catch(fail);
  }else if(audio.lastAdvanceAgeMs<=15000&&stallReported){
   stallReported=false;
   audioEvidence('playback_advanced');
   text('local-status','Audio đang phát.');
   void persist().catch(fail);
  }
  return;
 }
 const left=Math.max(0,state.deadlineAt-now()),s=Math.ceil(left/1000);
 text(skill+'-clock',Math.floor(s/60)+':'+String(s%60).padStart(2,'0'));
 if(!left)void seal(true);
}
async function confirmAudioEnd(){
 if(eofInFlight||eofNeedsSave||!ownerHeld||state?.phase!=='draft'||!state.audioEndedAt||state.lastServer?.audioEndedAt)return;
 eofInFlight=true;
 const e=epoch,id=state.identity.attemptId;
 try{
  const v=await api('audio-ended',{...state.identity,audioEndedAt:state.audioEndedAt});
  if(!current(e,id)||state.phase!=='draft')return;
  anchor(v);state.deadlineAt=v.deadlineAt;state.lastServer=v;
  audioEvidence('eof_confirmed');
  await persist();
 }catch(error){if(current(e,id)&&state.phase==='draft')fail(error);}
 finally{eofInFlight=false;}
}
async function saveAudioEnd(){
 if(!eofNeedsSave||!ownerHeld||state.phase!=='draft')return;
 try{await persist();}
 catch(error){fail(error);return;}
 if(!eofNeedsSave||!ownerHeld||state.phase!=='draft')return;
 eofNeedsSave=false;
 setWaitingForAudio(false);
 show('cannot-hear',false);
 text('notice','');
 tick();
 void confirmAudioEnd();
}
async function ended(){
 if(state.phase!=='draft'||state.audioEndedAt)return;
 eofNeedsSave=true;
 state.audioEndedAt=Math.max(now(),state.startedAt+content.audio.seconds*1000);
 state.deadlineAt=state.audioEndedAt+content.reviewMs;
 audioEvidence('media_eof');
 freeze();
 show('cannot-hear',false);
 await saveAudioEnd();
}
async function stop(reason,cause=reason){if(!ownerHeld||state?.phase!=='draft'||state.audioEndedAt||state.sealed)return;audioEvidence('technical_stop',{cause});state.phase='technical_stop';state.stopPending=reason;clearTimeout(saveTimer);player?.finish('technical_stop',reason,{stopAudio:true});freeze();try{await persist();finish();void sync();}catch(e){fail(e);}}
async function seal(automatic=false){
 if(busy||!ownerHeld||state.phase!=='draft'||state.sealed||!state.audioEndedAt||eofNeedsSave)return;
 state.revision++;
 state.sealed={...payload(),operationId:crypto.randomUUID(),automatic,confirmedEarlySubmit:!automatic,audioEndedAt:state.audioEndedAt};
 state.pending=null;
 sealedNeedsSave=true;
 freeze();
 void sync();
}
async function prepare(){if(busy)return;busy=true;try{const selected=roster.find(r=>r.studentRef===$('student').value)||state?.prepareOperation&&{name:state.name,studentRef:state.studentRef};if(!selected)return;state??={prepareOperation:crypto.randomUUID(),classCode:$('class').value,studentRef:selected.studentRef,name:selected.name};await persist();const v=state.identity?await api('status',state.identity):await api('prepare',{classCode:state.classCode,studentRef:state.studentRef,operationId:state.prepareOperation});state.identity=v.identity;state.phase=v.status;state.revision=v.revision;state.lastServer=v;state.startedAt=v.startedAt;state.deadlineAt=v.deadlineAt;state.audioEndedAt=v.audioEndedAt;await persist();if(v.status==='technical_stop'){finish(v);return;}if(isListening&&v.status==='draft'&&!v.audioEndedAt){busy=false;await stop('reload');return;}content=await api('content',state.identity);if(content.testId!==testId||content.skill!==skill||content.contentHash!==state.identity.contentHash)throw Error('CONTENT_CONFLICT');state.content=content;state.answers??={};await persist();anchor(v);if(v.status==='submitted'){finish(v);return;}if(v.status==='draft'){if(!Object.keys(state.answers).length&&v.snapshot?.answers)state.answers=structuredClone(v.snapshot.answers);await display();tick();return;}text('prepare-status','Đang lưu đề và giao diện để phục hồi…');const offline=await prepareOffline();state.offlineBuild=offline.build;await persist();if(offline.updated){location.reload();return;}show('identity-form',false);show('ready');
 if(isListening){text('prepare-status','Đang tải và kiểm tra đầy đủ audio…');const journal={emit(){}};const {downloadAudio,LocalPlayer}=createAudioTools(content.audio),asset=await downloadAudio({journal,onProgress:(n,total)=>text('prepare-status','Đang tải audio '+Math.floor(n/total*100)+'%')});player=new LocalPlayer($('official-audio'),journal);player.onFault=code=>void stop('learner_report',code);player.onEnded=()=>void ended();await player.attach(asset);text('prepare-status','Đã kiểm tra audio. Nghe thử 10 giây rồi xác nhận nghe rõ.');$('preview').disabled=false;}
 else{text('prepare-status','Đã sẵn sàng · '+content.durationMinutes+' phút · '+content.controls.length+' câu');$('start').disabled=false;}
 }catch(e){fail(e);}finally{busy=false;}}
async function start(){
 if(busy||isListening&&(!trialPassed||!$('heard').checked))return;
 busy=true;
 try{
  const v=await api('start',{...state.identity,...isListening?{audioHash:content.audio.hash}:{}});
  anchor(v);state.phase=v.status;state.startedAt=v.startedAt;state.deadlineAt=v.deadlineAt;state.lastServer=v;
  await persist();
  if(isListening)setWaitingForAudio(true);
  await display();
  if(isListening){
   show('cannot-hear');
   await playOfficial();
  }else $('submit').disabled=false;
 }catch(error){fail(error);}
 finally{busy=false;if(state?.stopPending)void sync();}
}
let roster=[];$('class').onchange=async()=>{const code=$('class').value;$('prepare').disabled=true;$('student').replaceChildren(new Option('Chọn họ tên',''));if(!code)return;try{const v=await api('roster?class='+encodeURIComponent(code),null,'GET');if($('class').value!==code)return;roster=v.students;for(const s of roster)$('student').add(new Option(s.name,s.studentRef));if(!roster.length)text('notice','Không còn học viên đủ điều kiện trong lớp này.');}catch(e){fail(e);}};$('student').onchange=()=>$('prepare').disabled=!$('student').value;
async function classes(){const v=await api('classes',null,'GET');for(const c of v.classes)$('class').add(new Option(c.code,c.code));text('prepare-status','Chọn lớp, họ tên và xác nhận đúng người trước khi làm bài.');}
$('prepare').onclick=()=>{text('confirm-name',roster.find(r=>r.studentRef===$('student').value)?.name||'');$('confirm-identity').showModal();};$('confirm-yes').onclick=()=>{$('confirm-identity').close();void prepare();};$('confirm-no').onclick=()=>$('confirm-identity').close();$('start').onclick=start;
$('submit').onclick=()=>$('confirm-submit').showModal();$('accept-submit').onclick=()=>{$('confirm-submit').close();void seal();};$('cancel-submit').onclick=()=>$('confirm-submit').close();$('check-result').onclick=()=>void check();$('retry-send').onclick=()=>void sync();
if(isListening){
$('start-audio').onclick=async()=>{
 if(busy||!ownerHeld||state?.phase!=='draft'||playbackStarted)return;
 busy=true;
 try{await playOfficial();}
 finally{busy=false;if(state?.stopPending)void sync();}
};
$('preview').onclick=async()=>{if(busy||!player)return;busy=true;$('preview').disabled=true;try{await player.preview(p=>text('prepare-status','Đang nghe thử '+Math.floor(p*100)+'%'));trialPassed=true;show('heard-label');text('prepare-status','Nghe thử hoàn tất. Xác nhận nghe rõ trước khi bắt đầu.');}catch(e){fail(e);$('preview').disabled=false;}finally{busy=false;}};$('heard').onchange=()=>$('start').disabled=!(trialPassed&&$('heard').checked);$('cannot-hear').onclick=()=>$('confirm-stop').showModal();$('accept-stop').onclick=()=>{$('confirm-stop').close();void stop('learner_report');};$('cancel-stop').onclick=()=>$('confirm-stop').close();$('volume').oninput=()=>player?.setVolume(Number($('volume').value));}
async function archive(){epoch++;clearTimeout(saveTimer);await storage.put(testId+':history:'+(state.identity?.attemptId||state.prepareOperation),structuredClone(state));state={};await persist();ownerHeld=false;releaseOwner?.();location.reload();}
$('replace-attempt').onclick=async()=>{if(busy||!ownerHeld)return;busy=true;try{if(state.identity)await api('status',state.identity);else await api('prepare',{classCode:state.classCode,studentRef:state.studentRef,operationId:state.prepareOperation});text('notice','Chưa xác nhận lượt đã được cấp lại.');}catch(e){if(e.code==='SKILL_GENERATION_STALE')await archive();else fail(e);}finally{busy=false;}};
$('change-person').onclick=()=>$('confirm-change-person').showModal();$('cancel-change-person').onclick=()=>$('confirm-change-person').close();$('accept-change-person').onclick=async()=>{if(busy||!state?.lastServer?.receipt)return;busy=true;try{const v=await api('receipt',state.identity);if(v.receipt)await archive();}catch(e){fail(e);}finally{busy=false;}};
addEventListener('online',()=>{void sync();void check();});addEventListener('pagehide',()=>{if(ownerHeld&&state?.identity){state.lastTime=now();if(isListening&&state.phase==='draft'&&!state.audioEndedAt&&!state.sealed){audioEvidence('technical_stop',{cause:'page_exit'});state.phase='technical_stop';state.stopPending='page_exit';void api('interrupt',{...state.identity,reason:'page_exit'},'POST',true).catch(()=>{});}void persist().catch(()=>{});}releaseOwner?.();ownerHeld=false;});addEventListener('pageshow',e=>{if(e.persisted)location.reload();});
try{await own();storage=await new DurableStore().open();state=await storage.get(testId);content=state?.content;if(state?.identity){if(state.sealed||state.phase==='submitted'){finish();await sync();await check();}else if(state.phase==='technical_stop'){finish();await sync();await check();}else if(state.phase==='draft'){
 baseNow=Math.max(state.lastTime||state.lastServer.serverNow,(state.lastTime||state.lastServer.serverNow)+Math.max(0,Date.now()-(state.savedAt||Date.now())));baseMono=performance.now();
 if(isListening&&!state.audioEndedAt){await stop('reload');}else{await display();try{const v=await api('status',state.identity);anchor(v);state.lastServer=v;if(v.status==='submitted'){state.phase='submitted';await persist();finish(v);}else if(v.status==='draft'){
  state.deadlineAt=v.deadlineAt??state.deadlineAt;
  if(isListening&&state.audioEndedAt)void confirmAudioEnd();
  tick();
 }else{freeze();throw Object.assign(Error(),{code:'SKILL_GENERATION_STALE'});}}catch(e){if(e.status&&e.status<500)freeze();fail(e);}}}
 else await prepare();}else if(state?.prepareOperation)await prepare();else{state=null;await classes();}}catch(e){fail(e);}
setInterval(tick,250);setInterval(()=>{if(!ownerHeld)return;if(state?.phase==='draft'&&!state.sealed){state.lastTime=now();void persist().catch(fail);}if(state?.stopPending||state?.sealed)void sync();
else if(eofNeedsSave)void saveAudioEnd();
else if(state?.audioEndedAt)void confirmAudioEnd();},3000);setInterval(()=>{if(state?.phase==='submitted')void check();},15000);

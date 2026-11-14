import {nativeVisibility,updateNativeShell,audioProgress} from './native-shell.mjs';
import {portalStatus} from './portal-status.mjs';
import {DurableStore,PREFIX} from './storage.mjs';
import {prepareWritingOffline as prepareOffline} from './offline.mjs';
import {createAudioTools} from './audio.mjs';
const $=id=>document.getElementById(id),text=(id,v)=>{const e=$(id);e.textContent=v;if(id==='notice')e.hidden=!v;},show=(id,v=true)=>nativeVisibility(id,v);
const testId=document.body.dataset.test,skill=document.body.dataset.skill,isListening=skill==='listening',REAL_API='https://ducizone.ddns.net/substitute-teacher-api/skill-makeup/v1/tests/'+testId;
let state,storage,content,native,player,busy=false,syncing=false,ownerHeld=false,releaseOwner,epoch=0,baseNow=Date.now(),baseMono=performance.now(),saveTimer,mounted=false,trialPassed=false;
let playbackStarted=false,stallReported=false,eofInFlight=false,eofNeedsSave=false,sealedNeedsSave=false;
const build='substitute-native-audio-v4';
const earlyObservations=[];
const quietJournal={emit(action,data){if(isListening&&state?.identity&&state.identity.classCode!=='DEMO'&&earlyObservations.length<16)earlyObservations.push([state.identity,action,data]);}};
let observation=quietJournal, journalLoading=false;
function listenJournal(){
 if(!isListening||!state?.identity||state.identity.classCode==='DEMO'||journalLoading||observation!==quietJournal)return;
 journalLoading=true;
 observation.emit('owner_acquired');
 void import('./listening-journal-v1.mjs').then(({createListeningJournal})=>{
  observation=createListeningJournal({endpoint:REAL_API,build,getIdentity:()=>state?.identity?.classCode!=='DEMO'?state?.identity:undefined,getMedia:()=>player?.snapshot()});
  for(const [identity,action,data] of earlyObservations.splice(0)){
   if(identity.attemptId===state?.identity?.attemptId&&identity.generation===state.identity.generation)observation.emit(action,data);
  }
 }).catch(()=>{earlyObservations.length=0;}).finally(()=>{journalLoading=false;});
}

function audioEvidence(event, data={}){
 const observations=state.audioObservations||=[];
 observations.push({event,at:Date.now(),build,positionMs:Math.round((player?.snapshot().playerCurrentTime||0)*1000),...data});
 if(observations.length>24)observations.shift();
 observation.emit(event,{...data,mediaReason:data.cause,audioEndedAtMs:state.audioEndedAt,deadlineAtMs:state.deadlineAt});
}
function setWaitingForAudio(waiting){
 $('listening-clock').closest('[role=timer]').hidden=!state.audioEndedAt;const viewport=$('questions');$('objective-form').inert=waiting&&!viewport;if(viewport)viewport.inert=waiting;$(skill+'View').classList.toggle('awaiting-audio',waiting);
 $('submit').disabled=waiting||!state.audioEndedAt;if(state.audioEndedAt)text('official-audio-status','Đã kết thúc audio · đang rà soát bài.');
}
function displayPlaybackRetry(){
 $('start-audio').hidden=false;
 $('start-audio').disabled=false;
 text('local-status','Trình duyệt yêu cầu bấm Phát audio. Câu trả lời sẽ mở khi audio chạy.');text('official-audio-status','Bấm Phát audio để tiếp tục. Câu trả lời mở khi audio chạy.');
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
 }catch(error){if(current(e,id)&&state.phase==='draft'){observation.emit('eof_request_failed',{code:error.code,http:error.status,audioEndedAtMs:state.audioEndedAt,deadlineAtMs:state.deadlineAt});fail(error);}}
 finally{eofInFlight=false;}
}
async function saveAudioEnd(){
 if(!eofNeedsSave||!ownerHeld||state.phase!=='draft')return;
 const e=epoch,id=state.identity.attemptId;
 try{await persist();}
 catch(error){if(current(e,id)&&state.phase==='draft'){observation.emit('eof_local_save_failed',{code:error.code,audioEndedAtMs:state.audioEndedAt,deadlineAtMs:state.deadlineAt});fail(error);}return;}
 if(!current(e,id)||!eofNeedsSave||state.phase!=='draft')return;
 eofNeedsSave=false;
 observation.emit('eof_local_saved',{audioEndedAtMs:state.audioEndedAt,deadlineAtMs:state.deadlineAt,persisted:true});
 setWaitingForAudio(false);
 show('cannot-hear',false);
 text('notice','');
 tick();
 void confirmAudioEnd();
}
function fail(e){text('notice',({OWNER_BUSY:'Bài đang mở ở tab khác. Hãy quay lại tab đó.',SKILL_GENERATION_STALE:'Giảng viên đã cấp lại lượt. Bản cũ được giữ để đối soát.',ALREADY_SUBMITTED:'Bạn đã nộp bài này. Hãy liên hệ giảng viên nếu cần hỗ trợ.',ATTEMPT_ALREADY_ACTIVE:'Bạn đang có một lượt thi. Hãy dùng trình duyệt đang làm hoặc nhờ giảng viên cấp lại.',SKILL_TEST_UNAVAILABLE:'Bài chưa mở hoặc đang tạm đóng.',SKILL_INTAKE_CLOSED:'Bài đang tạm đóng nhận lượt mới. Hãy liên hệ giảng viên.',LOCAL_PERSIST_FAILED:'Không lưu được trên thiết bị. Giữ nguyên trang và liên hệ giảng viên.'}[e.code]||'Chưa hoàn tất kết nối. Bài trên thiết bị vẫn được giữ; hãy thử lại khi có mạng.'));if(e.code==='SKILL_GENERATION_STALE'){freeze();show('replace-attempt');}}
async function api(action,body,method='POST',keepalive=false){const r=await fetch(((state?.identity?.classCode||state?.classCode||$('class').value)==='DEMO'?REAL_API.replace('/v1/tests/','/v1/demo/tests/'):REAL_API)+'/'+action,{method,cache:'no-store',credentials:'omit',headers:method==='POST'?{'content-type':'application/json'}:{},...(method==='POST'?{body:JSON.stringify(body)}:{}),keepalive,signal:AbortSignal.timeout(12000)}),v=await r.json();if(!r.ok)throw Object.assign(Error(),{code:v.code,status:r.status});return v;}
async function own(){if(ownerHeld)return;if(!navigator.locks)throw Object.assign(Error(),{code:'OWNER_BUSY'});await new Promise((resolve,reject)=>navigator.locks.request('substitute-skill:'+testId,{ifAvailable:true},async lock=>{if(!lock)return reject(Object.assign(Error(),{code:'OWNER_BUSY'}));ownerHeld=true;resolve();await new Promise(r=>releaseOwner=r);}).catch(reject));}

const personKey=(c,r)=>testId+':person:'+encodeURIComponent(c)+':'+encodeURIComponent(r);
async function retainPerson(){if(state?.prepareOperation)await storage.put(personKey(state.identity?.classCode||state.classCode,state.identity?.studentRef||state.studentRef),structuredClone(state));}
async function restorePerson(c,r){const saved=await storage.get(personKey(c,r));if(saved?.prepareOperation){state=saved;content=saved.content;}}
async function leaveCurrent({reset=false,abandon=false}={}){
 epoch++;clearTimeout(saveTimer);freeze();player?.finish('technical_stop','page_exit',{stopAudio:true});
 if(abandon){await storage.put(testId+':history:'+(state.identity?.attemptId||state.prepareOperation),structuredClone(state));await storage.put(personKey(state.identity?.classCode||state.classCode,state.identity?.studentRef||state.studentRef),{});}else if(!reset)await retainPerson();
 const saved=state;state={};
 if(reset){await storage.put(personKey('DEMO',saved?.identity?.studentRef||saved?.studentRef||'demo'),{});}
 await storage.put(testId,{});ownerHeld=false;releaseOwner?.();if(reset)localStorage.setItem('substitute-skill-demo-reset:'+testId,JSON.stringify({attemptId:saved?.identity?.attemptId,nonce:crypto.randomUUID()}));
 const url=new URL(location.href);if(reset)url.searchParams.set('class','DEMO');else url.searchParams.delete('class');location.replace(url.href);
}

const persist=()=>{if(!ownerHeld)throw Object.assign(Error(),{code:'OWNER_BUSY'});state.savedAt=Date.now();return storage.put(testId,state);};
const current=(e,id)=>ownerHeld&&epoch===e&&state?.identity?.attemptId===id;
const now=()=>Math.max(baseNow+performance.now()-baseMono,state?.lastTime||0);
const anchor=v=>{baseNow=v.serverNow;baseMono=performance.now();};
function payload(){return {...state.identity,revision:state.revision,capturedAt:Math.min(now(),state.deadlineAt??Infinity),snapshot:{answers:structuredClone(state.answers||{})}};}
function freeze(){if($('objective-form'))$('objective-form').inert=true;$('submit').disabled=true;}
function portal(v){text('portal-status',portalStatus(v));}
function finish(v=state.lastServer||{}){show('lobby',false);show('exam',false);show('finished');show('change-person',!!v.receipt);text('receipt',v.receipt?'Mã biên nhận: '+v.receipt.receiptId:state.phase==='technical_stop'?'Gián đoạn kỹ thuật · chưa thu bài để chấm.':'Bản nộp đã lưu trên thiết bị · đang chờ biên nhận');text('grading-status',state.phase==='technical_stop'?'Bài và nhật ký gián đoạn được giữ. Hãy liên hệ giảng viên để được cấp lại; không ghi điểm 0.':v.receipt?'Đã nhận và chấm bài.':'Chưa xác nhận máy chủ đã nhận. Hãy giữ trang hoặc mở lại trên thiết bị này.');portal(v);if(v.result)text('score',(isListening?'Listening':'Reading')+': '+v.result.score+' / '+v.result.max+' · Band '+v.result.band);updateNativeShell(state,content,v,()=>persist());}

async function check(){if(!ownerHeld||!state?.identity||busy||syncing)return;const e=epoch,id=state.identity.attemptId;try{const v=await api('status',state.identity);if(!current(e,id))return;anchor(v);state.lastServer=v;if(v.receipt){if(state.sealed&&state.sealed.operationId!==v.receipt.operationId)throw Error('RECEIPT_CONFLICT');state.phase='submitted';state.sealed=null;await persist();if(current(e,id))finish(v);}else if(state.phase==='technical_stop')await sync();}catch(error){if(current(e,id))fail(error);}}
async function sync(){if(!ownerHeld||busy||syncing||!state?.identity)return;syncing=true;const e=epoch,id=state.identity.attemptId;try{
 if(state.stopPending){const v=await api('interrupt',{...state.identity,reason:state.stopPending});if(!current(e,id))return;state.lastServer=v;state.stopPending=null;await persist();finish(v);}
 else if(state.sealed){
  if(sealedNeedsSave){
   try{await persist();}catch(error){observation.emit('seal_save_failed',{operationId:state.sealed?.operationId,code:error.code});throw error;}
   if(!current(e,id))return;
   sealedNeedsSave=false;
   observation.emit('seal_saved',{operationId:state.sealed?.operationId,persisted:true,revision:state.sealed?.revision});
   text('notice','');
   finish({...state.lastServer,receipt:null});
  }
  const operationId=state.sealed.operationId;
  observation.emit('receipt_lookup',{operationId});
  let v=await api('receipt',state.identity);
  if(!current(e,id))return;
  if(!v.receipt){
   observation.emit('receipt_missing',{operationId});
   observation.emit('submit_requested',{operationId});
   try{v=await api('submit',state.sealed);}
   catch(error){if(current(e,id))observation.emit('submit_failed',{operationId,code:error.code,http:error.status});throw error;}
  }
  if(!current(e,id))return;
  if(v.receipt?.operationId!==operationId)throw Error('RECEIPT_CONFLICT');
  observation.emit('receipt_observed',{operationId,receiptId:v.receipt.receiptId});
  state.lastServer=v;state.phase='submitted';state.sealed=null;await persist();if(current(e,id))finish(v);}
 else if(state.phase==='draft'&&state.pending){const pending=structuredClone(state.pending);await api('snapshot',pending);if(!current(e,id))return;if(state.pending?.revision===pending.revision)state.pending=null;await persist();text('local-status','Đã lưu trên hệ thống');}
 }catch(error){
  if(current(e,id)){
   text('local-status',sealedNeedsSave?'Đang chờ lưu bản chốt trên thiết bị':'Đã lưu trên thiết bị · chờ kết nối');
   fail(error);
  }
 }finally{syncing=false;}
}
async function changed(){if(!ownerHeld||state.phase!=='draft'||state.sealed)return;if(state.deadlineAt&&now()>=state.deadlineAt)return seal(true);state.revision++;state.lastTime=now();state.pending=payload();try{await persist();text('local-status','Đã lưu trên thiết bị');clearTimeout(saveTimer);saveTimer=setTimeout(sync,700);}catch(e){freeze();fail(e);}}
async function mount(){if(mounted)return;mounted=true;native=await import('./native-'+skill+'.mjs');const ui=state.ui??={flags:{[skill]:{}},activeSection:{[skill]:0},fontSize:{[skill]:100}};native[isListening?'mountNativeListening':'mountNativeReading']({content,answers:state.answers,grid:$(skill+'Questions'),form:$(skill+'View'),heading:$('exam-heading').closest('.section-heading'),uiState:ui,onUiState:value=>{state.ui=structuredClone(value);void persist().catch(fail);}});await native.nativeLayout(content.controls,content.sourceSlug);for(const f of document.querySelectorAll('[data-question]')){f.value=state.answers?.[f.dataset.question]||'';f.dispatchEvent(new Event('input',{bubbles:true}));}await native.nativeAnnotations({content,identity:state.identity,storage,onError:fail});$(skill+'View').addEventListener('submit',e=>e.preventDefault());$(skill+'View').addEventListener('input',e=>{const n=e.target.dataset.question;if(n&&state.phase==='draft'){state.answers[n]=e.target.value;void changed();}});}
async function display(){show('lobby',false);show('finished',false);show('exam');text('learner',state.name+' · '+state.identity.classCode);await mount();updateNativeShell(state,content,undefined,()=>persist());tick();}
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
 text(skill+'-clock',(isListening?'Điền đáp án · ':'')+(isListening?String(Math.floor(s/60)).padStart(2,'0'):Math.floor(s/60))+':'+String(s%60).padStart(2,'0'));if(isListening)$('listening-clock').setAttribute('aria-label','Còn '+s+' giây để điền đáp án Listening');
 if(!left)void seal(true);
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
async function stop(reason,cause=reason){if(!ownerHeld||state?.phase!=='draft'||state.audioEndedAt||state.sealed)return;audioEvidence('technical_stop',{cause,nativeReason:reason});state.phase='technical_stop';state.stopPending=reason;clearTimeout(saveTimer);player?.finish('technical_stop',reason,{stopAudio:true});freeze();try{await persist();finish();void sync();}catch(e){fail(e);}}
async function seal(automatic=false){
 if(busy||!ownerHeld||state.phase!=='draft'||state.sealed||isListening&&(!state.audioEndedAt||eofNeedsSave))return;
 state.revision++;
 state.sealed={...payload(),operationId:crypto.randomUUID(),automatic,confirmedEarlySubmit:!automatic,...isListening?{audioEndedAt:state.audioEndedAt}:{}};
 observation.emit('seal_created',{operationId:state.sealed.operationId,revision:state.revision,automatic,deadlineAtMs:state.deadlineAt});
 state.pending=null;
 sealedNeedsSave=true;
 freeze();
 void sync();
}
async function prepare(){if(busy)return;busy=true;try{const selected=roster.find(r=>r.studentRef===$('student').value)||state?.prepareOperation&&{name:state.name,studentRef:state.studentRef};if(!selected)return;if(!state?.prepareOperation)await restorePerson($('class').value,selected.studentRef);listenJournal();if(state?.sealed||state?.phase==='submitted'){finish();busy=false;await sync();await check();return;}state??={prepareOperation:crypto.randomUUID(),classCode:$('class').value,studentRef:selected.studentRef,name:selected.name};await persist();const v=state.identity?await api('status',state.identity):await api('prepare',{classCode:state.classCode,studentRef:state.studentRef,operationId:state.prepareOperation});state.identity=v.identity;listenJournal();state.phase=v.status;state.revision=Math.max(state.revision||0,v.revision);state.lastServer=v;state.startedAt=v.startedAt;state.deadlineAt=v.deadlineAt;state.audioEndedAt=v.audioEndedAt;await persist();if(v.status==='technical_stop'){finish(v);return;}if(isListening&&v.status==='draft'&&!v.audioEndedAt){busy=false;await stop('reload');return;}content=await api('content',state.identity);if(content.testId!==testId||content.skill!==skill||content.contentHash!==state.identity.contentHash)throw Error('CONTENT_CONFLICT');state.content=content;state.answers??={};await persist();anchor(v);if(v.status==='submitted'){finish(v);return;}if(v.status==='draft'){if(!Object.keys(state.answers).length&&v.snapshot?.answers)state.answers=structuredClone(v.snapshot.answers);await display();tick();return;}text('prepare-status','Đang lưu đề và giao diện để phục hồi…');const offline=await prepareOffline();state.offlineBuild=offline.build;await persist();if(offline.updated){location.reload();return;}show('identity-form',false);show('ready');
 if(isListening){listenJournal();text('prepare-status','Đang tải và kiểm tra đầy đủ audio…');const journal={emit:(action,data)=>observation.emit(action,data)};const {downloadAudio,LocalPlayer}=createAudioTools(content.audio),asset=await downloadAudio({journal,onProgress:audioProgress});player=new LocalPlayer($('official-audio'),journal);player.onFault=code=>void stop('learner_report',code);player.onEnded=()=>void ended();await player.attach(asset);player.setVolume(state.audioVolume??Number($('volume').value));text('prepare-status','Đã kiểm tra audio. Nghe thử 10 giây rồi xác nhận nghe rõ.');$('preview').disabled=false;$('volume').disabled=false;show('retry-audio',false);text('bootstrapPreviewStatus','Sẵn sàng nghe thử.');}
 else{text('prepare-status','Đã sẵn sàng · '+content.durationMinutes+' phút · '+content.controls.length+' câu');$('start').disabled=false;}
 }catch(e){if(isListening&&state?.phase==='prepared')show('retry-audio');fail(e);}finally{busy=false;updateNativeShell(state,content,undefined,()=>persist());}}
async function start(){
 if(busy||isListening&&(!trialPassed||!$('heard').checked))return;
 busy=true;
 try{
  observation.emit('start_requested');
  const v=await api('start',{...state.identity,...isListening?{audioHash:content.audio.hash}:{}});
  observation.emit('start_confirmed');
  anchor(v);state.phase=v.status;state.startedAt=v.startedAt;state.deadlineAt=v.deadlineAt;state.lastServer=v;
  await persist();
  if(isListening)setWaitingForAudio(true);
  await display();
  if(isListening){
   setWaitingForAudio(true);
   show('cannot-hear');
   await playOfficial();
  }else $('submit').disabled=false;
 }catch(error){observation.emit('start_failed',{code:error.code,http:error.status});fail(error);}
 finally{busy=false;if(state?.stopPending)void sync();}
}
let roster=[];$('class').onchange=async()=>{const code=$('class').value;$('prepare').disabled=true;$('student').replaceChildren(new Option(code?'Chọn họ tên':'Chọn lớp trước',''));if(!code)return;try{const v=await api('roster?class='+encodeURIComponent(code),null,'GET');if($('class').value!==code)return;roster=v.students;for(const s of roster)$('student').add(new Option(s.name,s.studentRef));if(!roster.length)text('notice','Không còn học viên đủ điều kiện trong lớp này.');}catch(e){fail(e);}};$('student').onchange=()=>$('prepare').disabled=!$('student').value;
async function classes(){const v=await api('classes',null,'GET');for(const c of v.classes)$('class').add(new Option(c.code,c.code));if(v.demo?.available)$('class').add(new Option('DEMO · Chỉ kiểm tra, không gửi Portal','DEMO'));text('prepare-status','Chọn lớp, họ tên và xác nhận đúng người trước khi làm bài.');const hinted=new URL(location.href).searchParams.get('class');if(hinted&&[...$('class').options].some(o=>o.value===hinted)){$('class').value=hinted;$('class').dispatchEvent(new Event('change'));}}
$('prepare').onclick=()=>{text('confirm-name',roster.find(r=>r.studentRef===$('student').value)?.name||'');$('confirm-identity').showModal();};$('confirm-yes').onclick=()=>{$('confirm-identity').close();void prepare();};$('confirm-no').onclick=()=>$('confirm-identity').close();$('start').onclick=start;
$('submit').onclick=()=>$('confirm-submit').showModal();$('accept-submit').onclick=()=>{$('confirm-submit').close();void seal();};$('cancel-submit').onclick=()=>$('confirm-submit').close();$('check-result').onclick=()=>void check();$('retry-send').onclick=()=>void sync();
$('retry-audio').onclick=()=>void prepare();
if(isListening){$('preview').onclick=async()=>{if(busy||!player)return;busy=true;trialPassed=false;$('heard').checked=false;$('start').disabled=true;$('preview').disabled=true;window.IZONE_CBT_AUDIO_START_LABEL?.($('start'),false);try{await player.preview(p=>{text('bootstrapPreviewStatus','Đang nghe thử '+Math.floor(p*100)+'%');window.IZONE_CBT_AUDIO_START_WAIT?.($('start'),10*(1-p));});trialPassed=true;$('heard').checked=true;text('bootstrapPreviewStatus','Đã nghe thử đủ 10 giây.');$('start').disabled=false;$('preview').disabled=false;$('preview').textContent='Nghe lại 10 giây đầu';window.IZONE_CBT_AUDIO_START_WAIT?.($('start'));window.IZONE_CBT_AUDIO_START_LABEL?.($('start'),true);}catch(e){window.IZONE_CBT_AUDIO_START_WAIT?.($('start'));fail(e);$('preview').disabled=false;}finally{busy=false;updateNativeShell(state,content,undefined,()=>persist());}};$('heard').onchange=()=>$('start').disabled=!(trialPassed&&$('heard').checked);$('cannot-hear').onclick=()=>$('confirm-stop').showModal();$('accept-stop').onclick=()=>{$('confirm-stop').close();void stop('learner_report');};$('cancel-stop').onclick=()=>$('confirm-stop').close();$('volume').oninput=()=>{if(!ownerHeld||!state?.identity)return;state.audioVolume=Number($('volume').value);player?.setVolume(state.audioVolume);$('official-volume').value=$('volume').value;void persist().catch(fail);};}
async function archive(){await leaveCurrent({abandon:true});}
$('replace-attempt').onclick=async()=>{if(busy||!ownerHeld)return;busy=true;try{if(state.identity)await api('status',state.identity);else await api('prepare',{classCode:state.classCode,studentRef:state.studentRef,operationId:state.prepareOperation});text('notice','Chưa xác nhận lượt đã được cấp lại.');}catch(e){if(e.code==='SKILL_GENERATION_STALE')await archive();else fail(e);}finally{busy=false;}};
$('change-person').onclick=()=>$('confirm-change-person').showModal();$('cancel-change-person').onclick=()=>$('confirm-change-person').close();$('accept-change-person').onclick=async()=>{if(busy||!state?.lastServer?.receipt)return;busy=true;try{const v=await api('receipt',state.identity);if(v.receipt)await archive();}catch(e){fail(e);}finally{busy=false;}};
addEventListener('online',()=>{void sync();void check();});addEventListener('pagehide',()=>{if(ownerHeld&&state?.identity){state.lastTime=now();if(isListening&&state.phase==='draft'&&!state.audioEndedAt&&!state.sealed){audioEvidence('technical_stop',{cause:'page_exit',nativeReason:'page_exit'});state.phase='technical_stop';state.stopPending='page_exit';void api('interrupt',{...state.identity,reason:'page_exit'},'POST',true).catch(()=>{});}void persist().catch(()=>{});}releaseOwner?.();ownerHeld=false;});addEventListener('pageshow',e=>{if(e.persisted)location.reload();});
try{await own();storage=await new DurableStore().open();state=await storage.get(testId);try{const reset=JSON.parse(localStorage.getItem('substitute-skill-demo-reset:'+testId)||'null');if(reset?.attemptId&&state?.identity?.classCode==='DEMO'&&state.identity.attemptId===reset.attemptId){state=null;await storage.put(testId,{});}}catch{}content=state?.content;if(state?.identity){listenJournal();if(state.sealed||state.phase==='submitted'){finish();await sync();await check();}else if(state.phase==='technical_stop'){finish();await sync();await check();}else if(state.phase==='draft'){
 baseNow=Math.max(state.lastTime||state.lastServer.serverNow,(state.lastTime||state.lastServer.serverNow)+Math.max(0,Date.now()-(state.savedAt||Date.now())));baseMono=performance.now();
 if(isListening&&!state.audioEndedAt){await stop('reload');}else{observation.emit('eof_restored',{audioEndedAtMs:state.audioEndedAt,deadlineAtMs:state.deadlineAt});await display();try{const v=await api('status',state.identity);anchor(v);state.lastServer=v;if(v.status==='submitted'){state.phase='submitted';await persist();finish(v);}else if(v.status==='draft'){state.deadlineAt=v.deadlineAt??state.deadlineAt;if(isListening&&state.audioEndedAt)void confirmAudioEnd();tick();}else{freeze();throw Object.assign(Error(),{code:'SKILL_GENERATION_STALE'});}}catch(e){if(e.status&&e.status<500)freeze();fail(e);}}}
 else await prepare();}else if(state?.prepareOperation)await prepare();else{state=null;await classes();}}catch(e){if(e.code==='OWNER_BUSY'&&isListening){void Promise.resolve().then(()=>{const saved=JSON.parse(localStorage.getItem(PREFIX+testId)||'null');if(!saved?.identity||saved.identity.classCode==='DEMO')return;const getIdentity=()=>{try{const latest=JSON.parse(localStorage.getItem(PREFIX+testId)||'null')?.identity;return latest?.classCode!=='DEMO'&&latest?.attemptId===saved.identity.attemptId&&latest.generation===saved.identity.generation?latest:undefined;}catch{return undefined;}};return import('./listening-journal-v1.mjs').then(({createListeningJournal})=>{if(!getIdentity())return;createListeningJournal({endpoint:REAL_API,build,getIdentity,getMedia:()=>null}).emit('owner_blocked');});}).catch(()=>{});}fail(e);}
if(isListening){$('official-audio').addEventListener('timeupdate',()=>{const a=$('official-audio');$('official-audio-progress').value=a.duration?a.currentTime/a.duration:0;text('official-audio-status',state?.audioEndedAt?'Đã kết thúc audio · đang rà soát bài.':'Đang phát audio · chỉ phát một lượt.');});}
if(isListening)$('start-audio').onclick=async()=>{if(busy||!ownerHeld||state?.phase!=='draft'||playbackStarted)return;busy=true;try{await playOfficial();}finally{busy=false;if(state?.stopPending)void sync();}};
setInterval(tick,250);setInterval(()=>{if(!ownerHeld)return;if(state?.phase==='draft'&&!state.sealed){state.lastTime=now();void persist().catch(fail);}if(state?.stopPending||state?.sealed)void sync();else if(eofNeedsSave)void saveAudioEnd();else if(isListening&&state?.audioEndedAt)void confirmAudioEnd();},3000);setInterval(()=>{if(state?.phase==='submitted')void check();},15000);

addEventListener('skill-demo-reset',async()=>{if(busy||syncing)return;const actual=state?.identity?.classCode||state?.classCode||$('class').value;if(actual!=='DEMO')return;busy=true;try{if(state?.identity){state.resetOperation??=crypto.randomUUID();await persist();await api('reset',{...state.identity,operationId:state.resetOperation});}if(state?.prepareOperation)await storage.put(testId+':demo-history:'+(state.identity?.attemptId||state.prepareOperation),structuredClone(state));await leaveCurrent({reset:true});}catch(e){fail(e);}finally{busy=false;}});
addEventListener('storage',event=>{if(event.key==='substitute-skill-demo-reset:'+testId&&(!state?.identity||state.identity.classCode==='DEMO')){epoch++;clearTimeout(saveTimer);ownerHeld=false;releaseOwner?.();state={};freeze();show('exam',false);show('finished',false);show('result-ready',false);show('lobby');$('lobby').querySelectorAll('button,input,select').forEach(e=>e.disabled=true);updateNativeShell(state,null,{},()=>{});$('reset-demo').hidden=true;text('notice','Lượt DEMO đã được reset ở tab khác. Tiếp tục tại tab vừa reset; tải lại tab này khi cần kiểm tra.');}});
function requestChangePerson(){if(busy||syncing)return;if(!state?.identity){void leaveCurrent().catch(fail);return;}const d=$('confirm-change-person');d.querySelector('p').textContent='Bài làm và thời gian của người hiện tại vẫn được giữ. Bạn có thể chọn lại người này để tiếp tục đúng lượt cũ.';d.showModal();}
$('change-person').onclick=requestChangePerson;
$('accept-change-person').onclick=async()=>{if(busy||syncing)return;busy=true;try{if(isListening&&state?.phase==='draft'&&!state.audioEndedAt){await stop('page_exit');await sync();}await leaveCurrent();}catch(e){fail(e);}finally{busy=false;}};
addEventListener('skill-change-person',requestChangePerson);

import {API,BUILD,AUDIO,CONTENT_VERSION,REVIEW_MS} from './config.mjs?v=20261106-controls-v3';
import {DurableStore} from './storage.mjs';
import {Telemetry} from './telemetry.mjs?v=20261106-controls-v3';
import {LocalPlayer,downloadAudio} from './audio.mjs?v=20261110-continuity-v1';
import {mountNativeListening,nativeLayout,nativeAnnotations} from './native-ui.mjs?v=20261110-continuity-v1';
const $=id=>document.getElementById(id),text=(id,value)=>$(id).textContent=value;
function show(id,value=true){$(id).hidden=!value;if(id==='exam'){$('listeningView').hidden=!value;$('identityView').hidden=!value;$('page-shell').classList.toggle('cbt-bootstrap-shell',!value);if(value)$('lobby').hidden=true;}if(id==='finished'&&value)$('lobby').hidden=true;}
const storage=await new DurableStore().open().catch(e=>{text('identity-status',e.message);throw e;});
let state=await storage.get('current'),preparation=await storage.get('preparation'),busy=false,syncing=false,syncFailures=0,retryAt=0,content,roster,prepared=false,reviewMono=null,presentationReady=false,trialPassed=false,reviewAsset;
const tabId=crypto.randomUUID(),audioOwnerId=state?.identity?.audioOwnerId||preparation?.audioOwnerId||crypto.randomUUID();
let releaseOwner,ownerHeld=false,durablePending=state?.pending?.operationId??null;
async function acquireOwner(){
 if(ownerHeld)return;if(!navigator.locks?.request)throw Object.assign(Error(),{code:'BROWSER_OWNER_LOCK_UNAVAILABLE'});
 await new Promise((resolve,reject)=>{navigator.locks.request('listening-retake:'+state.identity.attemptId,{ifAvailable:true},async lock=>{if(!lock){reject(Object.assign(Error(),{code:'AUDIO_OWNER_CONFLICT'}));return;}ownerHeld=true;resolve();await new Promise(r=>releaseOwner=r);ownerHeld=false;}).catch(reject);});
}
const journal=new Telemetry({tabId,audioOwnerId}),player=new LocalPlayer($('audio'),journal);journal.snapshot=()=>player.snapshot();
const note=message=>{text('notice',message);show('notice');};
const done=id=>$(id).classList.add('done');
async function persist(){
 const operationId=state?.pending?.operationId??null;
 await storage.put('current',state);
 if(operationId===(state?.pending?.operationId??null))durablePending=operationId;
}
function snapshot(status=state.phase){return {operationId:crypto.randomUUID(),generation:state.identity.generation,revision:++state.revision,tabId,audioOwnerId,recoveryId:state.recoveryId??null,answers:{...state.answers},status:['submitted','technical_stop'].includes(status)?status:'draft',startedAt:state.startedAt||null,audioEndedAt:state.audioEndedAt||null,sealedAt:status==='submitted'?new Date().toISOString():null,submitReason:state.submitReason||null,playedSeconds:state.eofPlayedSeconds??player.snapshot().playerCurrentTime,reviewElapsedMs:reviewMono===null?0:Math.max(0,performance.now()-reviewMono)};}
function validReceipt(v,p){return v?.ok===true&&v.persisted===true&&v.attemptId===state.identity.attemptId&&v.studentRef===state.identity.studentRef&&v.classCode===state.identity.classCode&&v.generation===state.identity.generation&&v.operationId===p.operationId&&v.revision===p.revision&&v.status===p.status&&typeof v.receiptId==='string';}
async function synchronize(force=false){
 if(syncing||!state?.permit||!state.pending||state.pending.operationId!==durablePending||
  navigator.onLine===false||!force&&performance.now()<retryAt)return;syncing=true;let sentOperation=null;
 try{
  while(state.pending?.operationId===durablePending&&state.pending){const pending=structuredClone(state.pending);sentOperation=pending.operationId;let r;
   if(state.uncertainOperation===pending.operationId){r=await journal.request('/operation-status',{operationId:pending.operationId});if(!r.value.persisted)r=null;}
   if(!r)r=await journal.request('/snapshot',pending,{operationId:pending.operationId});
   if(!validReceipt(r.value,pending)){journal.decision(r.requestId,pending.operationId,false,{errorCode:'AUDIO_CONTRACT_MISMATCH',errorOrigin:'controller',reason:'receipt_mismatch',revisionSent:pending.revision,revisionReceived:r.value?.revision??null});throw Object.assign(Error(),{code:'AUDIO_CONTRACT_MISMATCH'});}
   const same=state.pending?.operationId===pending.operationId;
   journal.serverAckedHeardSeconds=r.value.serverAckedHeardSeconds??null;journal.serverAckedAt=r.value.serverNow;
   journal.decision(r.requestId,pending.operationId,same,{revisionSent:pending.revision,revisionReceived:r.value.revision,reason:same?'receipt_verified':'newer_local_revision'});
   state.ackedRevision=Math.max(state.ackedRevision||0,pending.revision);state.uncertainOperation=null;
   if(same)state.pending=null;
   const submitted = pending.status === 'submitted' && state.sealed?.operationId === pending.operationId;
   const interruption=pending.status==='technical_stop'&&same;
   if(submitted){state.receipt=r.value;state.serverConfirmed=true;}
   if(interruption)state.interruptionReceipt=r.value;
   try { await persist(); }
   catch (error) {
     if (submitted) {
       state.pending = pending;
       state.serverConfirmed = false;
       state.receipt = null;
     }
     if(interruption){state.pending=pending;state.interruptionReceipt=null;}
     throw error;
   }
   syncFailures=0;text('save-status','Đã lưu lên máy chủ');
   if(interruption&&$('technical').open)text('interruption-save-status','Máy chủ đã nhận thông tin gián đoạn.');
   if(submitted||interruption&&state.interruptionConfirmed)renderFinished();
  }
 }catch(e){state.uncertainOperation=sentOperation;if(state.pending&&state.pending.operationId!==sentOperation)journal.emit('operation_superseded',{operationId:sentOperation,reason:'newer_local_revision',serverOutcome:'unknown'});retryAt=performance.now()+Math.min(60000,2000*2**Math.min(5,syncFailures++));await persist().catch(()=>{});text('save-status','Đã lưu trên thiết bị · chờ đồng bộ');if(state.phase==='submitted')renderFinished();}
 finally{syncing=false;}
}
async function queueDraft(){
 if(!state||!['playing','review'].includes(state.phase))return;state.pending=snapshot();
 try{await persist();text('save-status',navigator.onLine?'Đã lưu trên thiết bị':'Mất mạng · đáp án vẫn được lưu trên thiết bị');void synchronize();}
 catch{note('Không lưu được đáp án trên thiết bị. Hệ thống đang thử lưu lên máy chủ.');try{const r=await journal.request('/snapshot',state.pending);if(!validReceipt(r.value,state.pending))throw Error();state.ackedRevision=r.value.revision;}catch{note('Chưa lưu được đáp án. Hãy giữ trang mở để thử lưu lại; audio vẫn tiếp tục.');}}
}
function renderFinished(){
 show('identity',false);show('preparation',false);show('exam',false);show('finished');
 show('sync-now',state.phase==='technical_stop'?!state.interruptionReceipt:!state.serverConfirmed);
 text('finish-title',state.phase==='technical_stop'?'Cần giảng viên hỗ trợ':state.serverConfirmed?'Đã nộp thành công':'Bài làm đã được khóa · chờ đồng bộ');
 text('finish-message',state.phase==='technical_stop'?
  'Hãy liên hệ giảng viên sau buổi thi để nhận bài Listening thay thế. '+(state.interruptionReceipt?'Máy chủ đã nhận thông tin gián đoạn.':'Thông tin gián đoạn đã lưu trên thiết bị và sẽ gửi khi có mạng.'):state.serverConfirmed?'Máy chủ đã xác nhận nhận bài Listening. Bạn có thể đóng trang.':'Bài làm đã được lưu trên thiết bị này, chưa được máy chủ xác nhận. Hệ thống sẽ tự gửi khi có kết nối. Hãy giữ trang mở; nếu đã đóng trang, mở lại liên kết này trên cùng thiết bị và trình duyệt khi có mạng. Không xóa dữ liệu trình duyệt trước khi có xác nhận nộp thành công.');
 text('receipt',state.serverConfirmed?'Biên nhận: '+state.receipt.receiptId+' · '+new Date(state.receipt.serverNow).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'}):'Mã lượt: '+state.identity.attemptId.slice(0,8));
 show('check-new-attempt',state.phase==='technical_stop');if(state.localPersistFailed)text('finish-message','Bộ nhớ trình duyệt đang gặp lỗi; một phần bài có thể chưa lưu được. Không đóng trang và liên hệ giảng viên ngay để kiểm tra phần đã lưu.');
 const link = $('view-review');
 const confirmed = state.phase === 'submitted' && state.serverConfirmed && !state.pending && state.receipt?.receiptId;
 if (link) link.hidden = !confirmed;
 if (link && confirmed && navigator.onLine && !state.localPersistFailed && new URLSearchParams(location.search).get('result') !== '0') {
   location.replace(link.href);
 }
}
async function presentInterruption(){
 const dialog=$('technical');
 $('ack-interruption').disabled=true;
 $('retry-interruption').hidden=true;
 if(!dialog.open)dialog.showModal();
 text('interruption-save-status','Đang lưu trạng thái gián đoạn trên thiết bị…');
 try{
  await persist();
  $('ack-interruption').disabled=false;
  text('interruption-save-status',state.interruptionReceipt?'Máy chủ đã nhận thông tin gián đoạn.':'Đã lưu trên thiết bị. Thông tin sẽ được gửi khi có mạng.');
  void synchronize(true);
 }catch{
  text('interruption-save-status','Chưa lưu được trên thiết bị. Hãy thử lưu lại.');
  $('retry-interruption').hidden=false;
 }
}
async function technicalStop(reason){
 if(!state||['submitted','technical_stop'].includes(state.phase))return;
 const learner=reason==='LEARNER_CANNOT_HEAR';
 state.phase='technical_stop';
 player.finish('technical_stop',reason,{stopAudio:learner});
 state.pending=snapshot('technical_stop');
 state.stopReason=reason;state.interruptionConfirmed=false;
 $('listeningView').inert=true;
 journal.emit('technical_stop',{reason,operationId:state.pending.operationId,audioAfter:player.snapshot()});
 await presentInterruption();
}
async function cacheReviewAudio() {
 if (!reviewAsset || !globalThis.caches) return;
 const key = new URL('../ic2311-retake-review/verified-audio-' + reviewAsset.hash + '.mp3', location.href);
 try {
   const cache = await caches.open('ic2311-retake-review-audio-v1');
   await cache.put(key, new Response(reviewAsset.blob));
 } catch {}
}
async function seal(reason){
 if(!['playing','review'].includes(state?.phase)||busy)return;busy=true;
 try{state.submitReason=reason;state.phase='submitted';state.sealed=snapshot('submitted');state.pending=structuredClone(state.sealed);player.finish('submitted',reason,{stopAudio:reason==='manual'});$('listeningView').inert=true;await persist();void cacheReviewAudio();journal.emit('submission_sealed',{operationId:state.sealed.operationId,revisionSent:state.sealed.revision,submitReason:reason});renderFinished();void synchronize(true);}
 catch{note('Chưa lưu được bài đã khóa trên thiết bị. Giữ trang mở và liên hệ giảng viên ngay.');show('finished');text('finish-message','Chưa xác nhận lưu được bài trên thiết bị. Không đóng trang; hãy liên hệ giảng viên.');}
 finally{busy=false;}
}
async function renderContent(){
 const uiState=await storage.get('ui:'+state?.identity?.attemptId)||{flags:{listening:{}},activeSection:{listening:0},fontSize:{listening:100}};
 mountNativeListening({content,answers:state?.answers,grid:$('listeningQuestions'),form:$('listeningView'),heading:$('exam-heading'),uiState,onUiState:value=>{if(state?.identity)void storage.put('ui:'+state.identity.attemptId,value).catch(()=>note('Chưa lưu được đánh dấu/cỡ chữ trên thiết bị. Đáp án được lưu riêng.'));}});
 $('listeningView').addEventListener('submit',event=>event.preventDefault());$('listeningView').addEventListener('input',event=>{const n=event.target.dataset.question;if(!n||!['playing','review'].includes(state.phase))return;state.answers[n]=event.target.value;void queueDraft();});
 await nativeLayout(content.controls);presentationReady=true;$('prepare').disabled=!presentationReady||!$('student').value;text('identity-status','');
}
async function loadContent(){
 const key='content:'+CONTENT_VERSION;
 const cached=await storage.get(key);
 if(cached?.contentVersion===CONTENT_VERSION&&cached.sourceSlug==='substitute-test-1-k56'&&cached.controls?.length===40)
  return cached;
 const response=await fetch('content.json?v='+CONTENT_VERSION);
 if(!response.ok)throw Error('CONTENT_UNAVAILABLE');
 const value=await response.json();
 if(value.contentVersion!==CONTENT_VERSION||value.sourceSlug!=='substitute-test-1-k56'||value.listening.sections.length!==4||
  value.controls.length!==40||new Set(value.controls.map(c=>c.number)).size!==40||
  value.controls.some(c=>!Number.isInteger(c.number)||c.number<1||c.number>40))throw Error('CONTENT_CONTRACT_MISMATCH');
 await storage.put(key,value);
 return value;
}
async function restoreReview(){
 content=await loadContent();
 await renderContent();
 const ended=Date.parse(state.audioEndedAt);
 if(!Number.isFinite(ended))throw Error('REVIEW_TIME_UNAVAILABLE');
 reviewMono=performance.now()-Math.min(REVIEW_MS,Math.max(0,Date.now()-ended));
 state.eofPlayedSeconds??=AUDIO.seconds;
 show('preparation',false);show('exam');text('learner',state.learnerName||'Lượt đã xác nhận');
 $('audio-problem').disabled=true;
 await nativeAnnotations({content,identity:state.identity,storage,onError:()=>{}});
}
async function prepareOfflineShell(){
 if(!('serviceWorker' in navigator)||!globalThis.caches)return false;
 let timer;
 try{
  return await Promise.race([new Promise(resolve=>{timer=setTimeout(()=>resolve(false),6000);}), (async()=>{
   await navigator.serviceWorker.register('./offline-sw.js?v=20261110-continuity-v1');
   const worker=(await navigator.serviceWorker.ready).active;
   if(!worker)return false;
   const urls=[...performance.getEntriesByType('resource').map(entry=>entry.name),
    ...Array.from(document.querySelectorAll('script[src],link[href],img[src]'),element=>element.src||element.href)];
   const {port1,port2}=new MessageChannel();
   try{return await new Promise(resolve=>{
    port1.onmessage=event=>resolve(event.data?.ok===true);
    worker.postMessage({type:'PREPARE_LISTENING_SHELL',urls},[port2]);
   });}finally{port1.close();}
  })()]);
 }catch{return false;}finally{clearTimeout(timer);}
}
async function prepare(){
 if(busy||!presentationReady||(!$('student').value&&!state?.permit))return;busy=true;$('prepare').disabled=true;show('preparation');show('retry-preparation',false);
 try{
  done('check-content');done('check-storage');
  if(!state?.permit){const studentRef=$('student').value;if(preparation?.studentRef!==studentRef)preparation={studentRef,audioOwnerId,operationId:crypto.randomUUID()};await storage.put('preparation',preparation);const operationId=preparation.operationId;const r=await journal.request('/prepare',{classCode:'IC2311',studentRef,audioOwnerId,tabId,operationId},{permit:null,operationId});
   if(r.value.identity.contentVersion!==CONTENT_VERSION||r.value.identity.audioHash!==AUDIO.hash||r.value.identity.studentRef!==studentRef)throw Error('PREPARE_CONTRACT_MISMATCH');
   state={permit:r.value.permit,identity:r.value.identity,revision:r.value.revision,answers:Object.fromEntries(Array.from({length:40},(_,i)=>[i+1,''])),phase:'prepared',pending:null,serverConfirmed:false};await persist();
  }
  await acquireOwner();if(!journal.permit)journal.bind(state.identity,state.permit);done('check-permit');$('student').disabled=true;
  const downloadedAt=performance.now();
  const asset=await downloadAudio({journal,onProgress:(n,total,source)=>{$('download').value=n/total;text('prepare-status','Đang tải audio '+Math.round(n/total*100)+'% · '+(source==='github_pages'?'GitHub Pages':'Cloudinary'));}});
  reviewAsset=asset;
  const verifiedAt=performance.now();
  done('check-audio');await player.attach(asset);
  journal.emit('app_ready',{phase:'player_ready',elapsedMs:performance.now()-verifiedAt,
   totalElapsedMs:performance.now()-downloadedAt,audioAfter:player.snapshot()});await document.fonts.ready;if([...document.querySelectorAll('link[data-native-style]')].some(link=>!link.sheet))throw Object.assign(Error(),{code:'NATIVE_STYLE_UNAVAILABLE'});await nativeAnnotations({content,identity:state.identity,storage,onError:()=>note('Chưa lưu được Highlight/Note. Đáp án vẫn được lưu riêng; hãy giữ trang mở.')});done('check-player');
  const shellReady=await prepareOfflineShell();
  journal.emit('app_ready',{phase:shellReady?'offline_shell_ready':'offline_shell_partial'});
  prepared=true;$('trial').dataset.ready='true';$('preview').disabled=false;$('download-step').dataset.state='complete';$('preview-step').dataset.state='active';show('trial');text('prepare-status','Sẵn sàng trên thiết bị. Nếu mất mạng từ bây giờ, bạn vẫn nghe thử, bắt đầu và làm hết bài được.');journal.emit('app_ready',{phase:'ready',audioAfter:player.snapshot()});
 }catch(e){
  if(e.code==='ALREADY_SUBMITTED'){
   text('prepare-status','Bài này đã được nộp. ');
   const link=document.createElement('a');
   link.href='../ic2311-retake-review/?skill=listening&view=by-name';
   link.textContent='Xem kết quả';
   $('prepare-status').append(link);
   document.dispatchEvent(new Event('retake-already-submitted'));
   return;
  }
  text('prepare-status','Chưa chuẩn bị được bài thi ('+(e.code||'PREPARATION_FAILED')+'). Bạn chưa nên bắt đầu. Hãy thử lại; nếu vẫn lỗi, liên hệ giảng viên để được tổ chức thi lại.');show('retry-preparation');}
 finally{busy=false;$('prepare').disabled=prepared||!presentationReady||!$('student').value;}
}
$('student').addEventListener('change',()=>{$('prepare').disabled=busy||!presentationReady||!$('student').value;});$('prepare').onclick=prepare;$('retry-preparation').onclick=prepare;
$('preview').onclick=async()=>{
 if(!prepared||busy)return;busy=true;$('preview').disabled=true;trialPassed=false;$('start').disabled=true;
 try{await player.preview(p=>text('preview-status','Đang kiểm tra phát âm thanh · '+Math.round(p*100)+'%'));text('preview-status','Phát bình thường. Nếu nghe rõ và sẵn sàng, nhấn Bắt đầu thi Listening.');trialPassed=true;$('start').disabled=false;
 $('start').replaceChildren('Đã nghe rõ',document.createElement('br'),'Bắt đầu thi Listening');
 $('start-step').dataset.state='active';$('preview-step').dataset.state='complete';}
 catch(e){text('preview-status','Âm thanh chưa ổn định ('+(e.code||'PLAY_FAILED')+'). Chưa bắt đầu thi. Hãy kiểm tra thiết bị hoặc liên hệ giảng viên.');}
 finally{busy=false;$('preview').disabled=false;}
};
for(const id of ['volume','exam-volume'])$(id).oninput=()=>{const v=Number($(id).value);player.setVolume(v);$('volume').value=v;$('exam-volume').value=v;};
$('start').onclick=async()=>{
 if(busy||!prepared||!trialPassed)return;busy=true;$('start').disabled=true;
 try{state.phase='playing';state.startedAt=new Date().toISOString();state.startedMono=performance.now();
 state.learnerName=roster.students.find(s=>s.studentRef===state.identity.studentRef)?.name;await persist();
 await player.start();show('preparation',false);show('exam');text('learner',state.learnerName);text('phase-label','Đang nghe');
 journal.emit('official_player_started',{phase:'playing',elapsedMs:performance.now()-state.startedMono,audioAfter:player.snapshot()});await queueDraft();}
 catch(e){state.phase='prepared';state.startedAt=null;await persist().catch(()=>{});
 text('preview-status','Chưa bắt đầu được audio ('+(e.code||'PLAY_FAILED')+'). Nhấn Bắt đầu để thử lại.');$('start').disabled=false;}
 finally{busy=false;}
};
player.onEnded=async()=>{if(state?.phase!=='playing')return;state.phase='review';state.audioEndedAt=new Date().toISOString();state.eofPlayedSeconds=player.snapshot().playerCurrentTime;reviewMono=performance.now();journal.emit('audio_natural_ended',{phase:'review',audioAfter:player.snapshot()});$('audio-problem').disabled=true;await queueDraft();};
player.onFault=reason=>{journal.emit('audio_media_event',{reason,audioAfter:player.snapshot()});};
$('audio-problem').onclick=()=>{if(state?.phase==='playing'&&!busy)void technicalStop('LEARNER_CANNOT_HEAR');};
$('technical').addEventListener('cancel',event=>event.preventDefault());
$('retry-interruption').onclick=()=>void presentInterruption();
$('ack-interruption').onclick=async()=>{
 if(state?.phase!=='technical_stop')return;
 state.interruptionConfirmed=true;
 try{await persist();$('technical').close();renderFinished();}
 catch{state.interruptionConfirmed=false;await presentInterruption();}
};
$('submit').onclick=()=>{if(!['playing','review'].includes(state?.phase))return;const empty=Object.values(state.answers).filter(v=>!v.trim()).length;text('confirm-text','Bạn còn '+empty+' câu chưa trả lời.'+(state.phase==='playing'?' Nộp bây giờ sẽ kết thúc phần nghe.':''));$('confirm-submit').showModal();};
$('cancel-submit').onclick=()=>$('confirm-submit').close();$('accept-submit').onclick=()=>{$('confirm-submit').close();void seal('manual');};$('confirm-submit').addEventListener('click',e=>{if(e.target===$('confirm-submit'))$('confirm-submit').close();});
$('sync-now').onclick=async()=>{
 retryAt=0;
 try{if(state?.pending&&state.pending.operationId!==durablePending)await persist();await synchronize(true);}
 catch{note('Chưa lưu được trên thiết bị. Hãy giữ trang mở và thử lại.');}
};
$('check-new-attempt').onclick=async()=>{
 if(busy||state?.phase!=='technical_stop')return;busy=true;
 try{if(!state.replacementPreparation)state.replacementPreparation={operationId:crypto.randomUUID(),audioOwnerId:crypto.randomUUID()};await persist();const {operationId,audioOwnerId:owner}=state.replacementPreparation;const r=await journal.request('/prepare',{classCode:state.identity.classCode,studentRef:state.identity.studentRef,operationId,tabId,audioOwnerId:owner},{permit:null,operationId});if(r.value.identity.generation<=state.identity.generation||r.value.identity.contentVersion!==CONTENT_VERSION||r.value.identity.audioHash!==AUDIO.hash||r.value.identity.studentRef!==state.identity.studentRef)throw Error('NEW_GENERATION_REQUIRED');await storage.put('attempt:'+state.identity.attemptId,state);state={permit:r.value.permit,identity:r.value.identity,revision:r.value.revision,answers:Object.fromEntries(Array.from({length:40},(_,i)=>[i+1,''])),phase:'prepared',pending:null,serverConfirmed:false};await persist();location.reload();}catch{note('Chưa có lượt mới được xác nhận. Hãy giữ bài hiện tại và liên hệ giảng viên; hệ thống không tự reset lượt thi.');}finally{busy=false;}
};
addEventListener('offline',()=>{if(['playing','review'].includes(state?.phase))note('Bạn đang mất kết nối. Audio và bài thi vẫn tiếp tục. Đáp án đang được lưu trên thiết bị này.');});
addEventListener('online',()=>{retryAt=0;void synchronize(true);});
addEventListener('pagehide',()=>{releaseOwner?.();if(state&&['playing','review','technical_hold'].includes(state.phase)){state.departed=true;void persist();journal.emit('page_departed',{phase:state.phase,audioAfter:player.snapshot()});}});
addEventListener('pageshow',event=>{
 if(!event.persisted||!['playing','review','technical_hold'].includes(state?.phase))return;
 void acquireOwner().then(()=>{
  if(state.phase==='review'){
   reviewMono=performance.now()-Math.min(REVIEW_MS,Math.max(0,Date.now()-Date.parse(state.audioEndedAt)));
  }else return technicalStop('PAGE_RELOADED_DURING_EXAM');
 }).catch(()=>note('Lượt thi đang mở ở tab khác. Hãy quay lại đúng tab.'));
});
setInterval(()=>{if(state?.phase==='review'&&reviewMono!==null){const left=Math.max(0,REVIEW_MS-(performance.now()-reviewMono));text('phase-label','Rà đáp án · '+Math.ceil(left/60000)+' phút');if(left<=0)void seal('review_deadline');}if(state?.pending)void synchronize();},1000);
try{
 if(state?.permit){if(!['submitted','technical_stop'].includes(state.phase))await acquireOwner();journal.bind(state.identity,state.permit);if(state.phase==='technical_stop'&&state.interruptionConfirmed===false)await presentInterruption();
 else if(['submitted','technical_stop'].includes(state.phase)){renderFinished();void synchronize(true);}
 else if(state.phase==='review')await restoreReview();
 else if(state.phase!=='prepared'){await technicalStop('PAGE_RELOADED_DURING_EXAM');}}
 if(!state||state.phase==='prepared'){
  if(![...document.styleSheets].some(sheet=>sheet.href?.includes('/native-upgrades.css')))throw Error('STYLESHEET_UNAVAILABLE');
  const results=await Promise.all([loadContent(),journal.request('/roster?purpose=prepare',null,{permit:null,method:'GET'})]);content=results[0];roster=results[1].value;
  if(roster.classCode!=='IC2311'||roster.contentVersion!==CONTENT_VERSION)throw Error('CONTENT_CONTRACT_MISMATCH');
  const img=new Image();await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;img.src='assets/kinney-hotel-plan.png';});
  $('student').replaceChildren(new Option('Chọn tên của bạn',''));for(const s of roster.students)$('student').add(new Option(s.name,s.studentRef));await renderContent();
  if(!roster.students.length)text('identity-status','Hiện không còn học viên trong danh sách vào thi. Nếu bạn cần hỗ trợ, hãy liên hệ giảng viên.');
  if(state?.phase==='prepared'){$('student').value=state.identity.studentRef;void prepare();}
 }
}catch(e){if(e.code==='AUDIO_OWNER_CONFLICT'){show('identity',false);note('Bài Listening đang mở ở tab khác. Hãy quay lại tab đó để tiếp tục; trang này không thay đổi bài đang làm.');}else text('identity-status','Chưa tải được nội dung hoặc danh sách học viên. Hãy kết nối mạng và tải lại trước khi bắt đầu.');}

void import('../ic2311-retake-review/student-review-entry.mjs?v=1')
  .then(({attachStudentReview})=>attachStudentReview({api:API,skill:'listening'})).catch(()=>{});

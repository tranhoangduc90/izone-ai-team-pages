import "../shared/cbt-audio-preview-sync-v1.js?rev=20261123-verified-preview-v1";

export function createAudioTools(AUDIO){
const error=code=>Object.assign(Error(code),{code});
async function downloadAudio({journal,onProgress,signal}){
 for(const source of AUDIO.sources){
  const requestId=crypto.randomUUID(),controller=new AbortController(),began=performance.now();let reason='',idle,first,total;
  const abort=()=>{reason='USER_CANCELLED';controller.abort();};signal?.addEventListener('abort',abort,{once:true});
  const deadline=(ms,why)=>setTimeout(()=>{reason=why;controller.abort();},ms);
  first=deadline(8000,'FIRST_BYTE_TIMEOUT');total=deadline(90000,'CLIENT_TIMEOUT');
  journal.emit('audio_download_started',{requestId,assetId:source.id,phase:'preparing',timeoutMs:90000});
  try{
   const r=await fetch(source.url,{credentials:'omit',cache:'default',signal:controller.signal});if(!r.ok)throw error('AUDIO_HTTP_ERROR');const reader=r.body.getReader(),chunks=[];let size=0;
   while(true){const{done,value}=await reader.read();if(done)break;clearTimeout(first);clearTimeout(idle);idle=deadline(10000,'DOWNLOAD_STALLED');size+=value.length;if(size>AUDIO.bytes)throw error('AUDIO_SIZE_MISMATCH');chunks.push(value);onProgress(size,AUDIO.bytes,source.id);}
   clearTimeout(idle);if(size!==AUDIO.bytes)throw error('AUDIO_SIZE_MISMATCH');const blob=new Blob(chunks,{type:'audio/mpeg'}),bytes=await blob.arrayBuffer();
   const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('');if(hash!==AUDIO.hash)throw error('AUDIO_HASH_MISMATCH');
   journal.emit('audio_asset_verified',{requestId,assetId:source.id,verifiedAudioSha256:hash,verifiedAudioBytes:size,elapsedMs:performance.now()-began,sourceKind:'local_blob'});return {blob,hash,size,source:source.id};
  }catch(e){journal.emit('audio_download_failed',{requestId,assetId:source.id,errorCode:reason||e.code||'FETCH_FAILED_UNCLASSIFIED',errorOrigin:'client_transport',elapsedMs:performance.now()-began});if(reason==='USER_CANCELLED')throw error(reason);}
  finally{clearTimeout(first);clearTimeout(idle);clearTimeout(total);signal?.removeEventListener('abort',abort);}
 }
 throw error('AUDIO_SOURCES_EXHAUSTED');
}
class LocalPlayer{
 #preview=null;
 #audio;#url;#asset;#journal;#lifecycle=new AbortController();#phase='preparing';#lastAdvance=performance.now();#lastPosition=0;#intended=null;
 constructor(audio,journal){this.#audio=audio;this.#journal=journal;this.onFault=()=>{};this.onEnded=()=>{};
  for(const type of ['pause','seeking','seeked','emptied','error','ended','playing','ratechange','waiting','stalled'])audio.addEventListener(type,()=>{
   const cmd=this.#intended;this.#journal.emit('audio_media_event',{phase:this.#phase,reason:type,commandId:cmd?.commandId,audioAfter:this.snapshot()});
   if(['pause','seeking','emptied'].includes(type)&&!cmd&&!['preparing','preview','ready','ended','submitted','technical_stop'].includes(this.#phase))this.#journal.emit('audio_unattributed_transition',{reason:type,audioAfter:this.snapshot()});
   if(type==='seeked'||type==='pause')this.#intended=null;
   if(this.#phase==='playing'&&(type==='error'||['seeking','emptied','pause'].includes(type)&&!cmd&&!audio.ended||type==='ratechange'&&audio.playbackRate!==1))this.onFault('MEDIA_INTERRUPTED');
   if(type==='ended'&&this.#phase==='playing'){if(Math.abs(audio.currentTime-AUDIO.seconds)>1){this.onFault('MEDIA_EARLY_ENDED');return;}this.#phase='ended';this.onEnded();}
  },{signal:this.#lifecycle.signal});
  audio.addEventListener('timeupdate',()=>{if(audio.currentTime>this.#lastPosition+.05&&!audio.seeking&&audio.playbackRate===1){this.#lastPosition=audio.currentTime;this.#lastAdvance=performance.now();}},{signal:this.#lifecycle.signal});
 }
 snapshot(){const a=this.#audio;return {playerCurrentTime:a.currentTime,paused:a.paused,ended:a.ended,readyState:a.readyState,mediaErrorCode:a.error?.code??null,playbackRate:a.playbackRate,muted:a.muted,volume:a.volume,sourceKind:this.#asset?'local_blob':'none',verifiedAudioSha256:this.#asset?.hash,verifiedAudioBytes:this.#asset?.size,lastPositionAdvanceMonoMs:this.#lastAdvance,lastAdvancedPosition:this.#lastPosition,lastAdvanceAgeMs:performance.now()-this.#lastAdvance,controllerStateBefore:this.#phase};}
 #command(action,actor,reason,fn){const commandId=crypto.randomUUID();this.#journal.emit('audio_command_requested',{commandId,actor,reason,callsiteId:'LocalPlayer.'+action,phase:this.#phase,audioBefore:this.snapshot()});this.#intended={commandId,action};try{const v=fn();this.#journal.emit('audio_command_observed',{commandId,actor,reason,callsiteId:'LocalPlayer.'+action,phase:this.#phase,audioAfter:this.snapshot()});return v;}catch(e){this.#journal.emit('audio_command_failed',{commandId,errorCode:'MEDIA_COMMAND_FAILED',audioAfter:this.snapshot()});throw e;}}
 async attach(asset){
  this.#asset=asset;this.#url=URL.createObjectURL(asset.blob);this.#command('set_source','initialization','verified_asset',()=>{this.#audio.src=this.#url;this.#audio.preload='auto';this.#audio.load();});
  await new Promise((resolve,reject)=>{let timer;const clean=()=>{clearTimeout(timer);this.#audio.removeEventListener('canplay',ok);this.#audio.removeEventListener('error',bad);};const ok=()=>{clean();resolve();},bad=()=>{clean();reject(error('AUDIO_BLOB_UNAVAILABLE'));};this.#audio.addEventListener('canplay',ok,{once:true});this.#audio.addEventListener('error',bad,{once:true});timer=setTimeout(bad,10000);if(this.#audio.readyState>=3)ok();});
  if(Math.abs(this.#audio.duration-AUDIO.seconds)>1)throw error('AUDIO_DURATION_MISMATCH');this.#phase='ready';
 }
 async #play(reason){this.#journal.emit('audio_play_requested',{phase:this.#phase,reason,audioBefore:this.snapshot()});try{await this.#audio.play();this.#intended=null;this.#journal.emit('audio_play_resolved',{phase:this.#phase,reason,audioAfter:this.snapshot()});}catch(e){this.#journal.emit('audio_play_rejected',{phase:this.#phase,reason,errorCode:e.name==='NotAllowedError'?'PLAY_NOT_ALLOWED':'PLAY_FAILED',exceptionName:e.name==='NotAllowedError'?'NotAllowedError':'OtherError',audioAfter:this.snapshot()});throw error(e.name==='NotAllowedError'?'PLAY_NOT_ALLOWED':'PLAY_FAILED');}}
 get previewing(){return this.#preview!==null;}
 stopPreview(reason='manual'){
  const run=this.#preview;
  if(!run)return;
  this.#preview=null;
  const {audio,handlers,onStopped}=run;
  handlers.abort();
  window.IZONE_CBT_AUDIO_CANCEL_PREVIEW_WAIT(audio);
  audio.pause();
  audio.removeAttribute('src');
  audio.load();
  audio.remove();
  onStopped(reason);
 }
 async preview({startButton,onReady,onProgress,onStopped}){
  if(this.#phase!=='ready'||this.#lifecycle.signal.aborted||!this.#asset)throw error('PLAYER_NOT_READY');
  this.stopPreview();
  const audio=document.createElement('audio');
  audio.id='skill-preview-audio';
  audio.hidden=true;
  audio.preload='auto';
  audio.src=this.#url;
  audio.volume=this.#audio.volume;
  document.body.append(audio);
  const handlers=new AbortController();
  const listener={signal:handlers.signal};
  const run={audio,handlers,onStopped};
  this.#preview=run;
  const limit=30;
  audio.addEventListener('timeupdate',()=>{
   if(audio.paused)return;
   onProgress(Math.min(limit,audio.currentTime));
   if(audio.currentTime>=limit)this.stopPreview('complete');
  },listener);
  audio.addEventListener('ended',()=>this.stopPreview('complete'),listener);
  audio.addEventListener('error',()=>this.stopPreview('error'),listener);
  const started=performance.now();
  try{
   await audio.play();
   if(this.#preview!==run)return;
   window.IZONE_CBT_AUDIO_WAIT_FOR_PREVIEW(audio,startButton,()=>{
    if(this.#preview!==run)return;
    this.#journal.emit('audio_trial_completed',{elapsedMs:performance.now()-started,positionBefore:0,
     positionAfter:audio.currentTime,playbackRate:audio.playbackRate,outcome:'verified'});
    onReady();
   });
  }catch(err){
   if(this.#preview!==run)return;
   this.stopPreview('error');
   throw error(err?.name==='NotAllowedError'?'PLAY_NOT_ALLOWED':'PLAY_FAILED');
  }
 }
 async start(position){
  if(this.#phase!=='ready'||this.#lifecycle.signal.aborted)throw error('PLAYER_NOT_READY');
  if(position!==undefined){
   if(!Number.isFinite(position)||position<0||position>=this.#audio.duration)throw error('AUDIO_RESUME_POSITION_INVALID');
   this.#command('seek','learner','verified_checkpoint',()=>{this.#audio.currentTime=position;});
  }
  await this.#play(position===undefined?'official_start':'official_resume');
  if(this.#lifecycle.signal.aborted)throw error('PLAYER_NOT_READY');
  if(position!==undefined){
   const a=this.#audio,expires=performance.now()+5000;
   while(!this.#lifecycle.signal.aborted&&!a.paused&&!a.error&&a.playbackRate===1&&performance.now()<expires){
    if(!a.seeking&&a.currentTime>=position+.05)break;
    await new Promise(resolve=>setTimeout(resolve,50));
   }
   if(this.#lifecycle.signal.aborted||a.paused||a.error||a.seeking||a.playbackRate!==1||a.currentTime<position+.05){
    if(!this.#lifecycle.signal.aborted)this.pause('learner','resume_unverified');
    throw error('AUDIO_RESUME_UNVERIFIED');
   }
  }
  this.#phase='playing';this.#lastPosition=this.#audio.currentTime;this.#lastAdvance=performance.now();
 }
 dispose(){
  if(this.#lifecycle.signal.aborted)return;
  this.stopPreview('dispose');
  this.#lifecycle.abort();
  this.#command('clear_source','navigation','listening_exit',()=>{
   this.#audio.pause();
   this.#audio.removeAttribute('src');
   this.#audio.load();
  });
  if(this.#url)URL.revokeObjectURL(this.#url);
  this.#asset=null;
 }
 pause(actor,reason){this.#command('pause',actor,reason,()=>this.#audio.pause());}
 finish(status,reason,{stopAudio=false}={}){
  const actor=reason==='review_deadline'?'review_deadline':['manual','LEARNER_CANNOT_HEAR'].includes(reason)?'learner':'navigation';
  this.#journal.emit('controller_transition',{actor,reason,controllerStateBefore:this.#phase,controllerStateAfter:status,audioBefore:this.snapshot()});
  this.#phase=status;
  if(stopAudio&&!this.#audio.paused&&!this.#audio.ended)this.pause(actor,reason);
 }
 setVolume(v){
  const volume=Math.max(0,Math.min(1,v));
  this.#audio.volume=volume;
  if(this.#preview)this.#preview.audio.volume=volume;
 }
}

return {downloadAudio,LocalPlayer};}

import {AUDIO} from './config.mjs';
const error=code=>Object.assign(Error(code),{code});
export async function downloadAudio({journal,onProgress,signal}){
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
export class LocalPlayer{
 #audio;#url;#asset;#journal;#phase='preparing';#lastAdvance=performance.now();#lastPosition=0;#intended=null;
 constructor(audio,journal){this.#audio=audio;this.#journal=journal;this.noProgressRecoveries=0;this.recoveryCount=0;this.onFault=()=>{};this.onEnded=()=>{};
  for(const type of ['pause','seeking','seeked','emptied','error','ended','playing','ratechange'])audio.addEventListener(type,()=>{
   const cmd=this.#intended;this.#journal.emit('audio_media_event',{phase:this.#phase,reason:type,commandId:cmd?.commandId,audioAfter:this.snapshot()});
   if(['pause','seeking','emptied'].includes(type)&&!cmd&&!['preparing','preview','ready','ended','submitted','technical_stop'].includes(this.#phase))this.#journal.emit('audio_unattributed_transition',{reason:type,audioAfter:this.snapshot()});
   if(type==='seeked'||type==='pause')this.#intended=null;
   if(type==='error'&&this.#phase==='playing')this.onFault('MEDIA_ERROR');
   if(type==='ended'&&['playing','recovering'].includes(this.#phase)){if(Math.abs(audio.currentTime-AUDIO.seconds)>1){this.onFault('MEDIA_EARLY_ENDED');return;}this.#phase='ended';this.onEnded();}
  });
  audio.addEventListener('timeupdate',()=>{if(audio.currentTime>this.#lastPosition+.05){this.#lastPosition=audio.currentTime;this.#lastAdvance=performance.now();}});
 }
 snapshot(){const a=this.#audio;return {playerCurrentTime:a.currentTime,paused:a.paused,ended:a.ended,readyState:a.readyState,mediaErrorCode:a.error?.code??null,playbackRate:a.playbackRate,muted:a.muted,volume:a.volume,sourceKind:this.#asset?'local_blob':'none',verifiedAudioSha256:this.#asset?.hash,verifiedAudioBytes:this.#asset?.size,lastPositionAdvanceMonoMs:this.#lastAdvance,lastAdvancedPosition:this.#lastPosition,lastAdvanceAgeMs:performance.now()-this.#lastAdvance,controllerStateBefore:this.#phase,consecutiveNoProgressRecoveries:this.noProgressRecoveries};}
 #command(action,actor,reason,fn){const commandId=crypto.randomUUID();this.#journal.emit('audio_command_requested',{commandId,actor,reason,callsiteId:'LocalPlayer.'+action,phase:this.#phase,audioBefore:this.snapshot()});this.#intended={commandId,action};try{const v=fn();this.#journal.emit('audio_command_observed',{commandId,actor,reason,callsiteId:'LocalPlayer.'+action,phase:this.#phase,audioAfter:this.snapshot()});return v;}catch(e){this.#journal.emit('audio_command_failed',{commandId,errorCode:'MEDIA_COMMAND_FAILED',audioAfter:this.snapshot()});throw e;}}
 async attach(asset){
  this.#asset=asset;this.#url=URL.createObjectURL(asset.blob);this.#command('set_source','initialization','verified_asset',()=>{this.#audio.src=this.#url;this.#audio.preload='auto';this.#audio.load();});
  await new Promise((resolve,reject)=>{let timer;const clean=()=>{clearTimeout(timer);this.#audio.removeEventListener('canplay',ok);this.#audio.removeEventListener('error',bad);};const ok=()=>{clean();resolve();},bad=()=>{clean();reject(error('AUDIO_BLOB_UNAVAILABLE'));};this.#audio.addEventListener('canplay',ok,{once:true});this.#audio.addEventListener('error',bad,{once:true});timer=setTimeout(bad,10000);if(this.#audio.readyState>=3)ok();});
  if(Math.abs(this.#audio.duration-AUDIO.seconds)>1)throw error('AUDIO_DURATION_MISMATCH');this.#phase='ready';
 }
 async #play(reason){this.#journal.emit('audio_play_requested',{phase:this.#phase,reason,audioBefore:this.snapshot()});try{await this.#audio.play();this.#intended=null;this.#journal.emit('audio_play_resolved',{phase:this.#phase,reason,audioAfter:this.snapshot()});}catch(e){this.#journal.emit('audio_play_rejected',{phase:this.#phase,reason,errorCode:e.name==='NotAllowedError'?'PLAY_NOT_ALLOWED':'PLAY_FAILED',exceptionName:e.name==='NotAllowedError'?'NotAllowedError':'OtherError',audioAfter:this.snapshot()});throw error(e.name==='NotAllowedError'?'PLAY_NOT_ALLOWED':'PLAY_FAILED');}}
 async preview(onProgress){
  this.#phase='preview';this.#command('seek','initialization','preview_start',()=>{this.#audio.currentTime=0;});await this.#play('preview');
  let before={time:this.#audio.currentTime,mono:performance.now()};await new Promise(r=>setTimeout(r,1000));before={time:this.#audio.currentTime,mono:performance.now()};
  await new Promise((resolve,reject)=>{const timer=setInterval(()=>{const elapsed=performance.now()-before.mono;onProgress(Math.min(1,elapsed/10000));if(elapsed<10000)return;clearInterval(timer);const advanced=this.#audio.currentTime-before.time,ratio=advanced/(elapsed/1000);this.pause('initialization','preview_finished');this.#command('seek','initialization','preview_reset',()=>{this.#audio.currentTime=0;});this.#phase='ready';this.#journal.emit('audio_trial_completed',{elapsedMs:elapsed,positionBefore:before.time,positionAfter:before.time+advanced,playbackRate:ratio});if(ratio<.95||ratio>1.05||this.#audio.error)reject(error('PLAYER_NOT_REAL_TIME'));else resolve();},200);});
 }
 async start(){if(this.#phase!=='ready')throw error('PLAYER_NOT_READY');await this.#play('official_start');this.#phase='playing';this.#lastPosition=this.#audio.currentTime;this.#lastAdvance=performance.now();
  this.watch=setInterval(()=>{if(this.#phase==='playing'&&!this.#audio.ended&&performance.now()-this.#lastAdvance>5000)this.onFault('PLAYER_NO_PROGRESS');},1000);
  this.progress=setInterval(()=>{if(this.#phase==='playing')this.#journal.emit('audio_progress',{phase:'playing',audioAfter:this.snapshot()});},10000);
 }
 pause(actor,reason){this.#command('pause',actor,reason,()=>this.#audio.pause());}
 hold(reason,recoveryId,actor='learner'){this.recoveryId=recoveryId||crypto.randomUUID();this.#journal.emit('controller_transition',{recoveryId:this.recoveryId,actor,reason,controllerStateBefore:this.#phase,controllerStateAfter:'technical_hold',audioBefore:this.snapshot()});this.#phase='technical_hold';this.pause(actor,reason);}
 async resume(onPlaying=()=>{}){
  if(this.#phase!=='technical_hold'||this.recoveryCount>=1)throw error('RECOVERY_LIMIT_REACHED');this.recoveryCount++;
  if(this.#audio.currentTime+.25<this.#lastPosition){this.noProgressRecoveries++;this.#journal.emit('recovery_no_progress',{recoveryId:this.recoveryId,errorCode:'AUDIO_PROGRESS_STALE',playerCurrentTime:this.#audio.currentTime,lastAdvancedPosition:this.#lastPosition,consecutiveNoProgressRecoveries:this.noProgressRecoveries});throw error('AUDIO_PROGRESS_STALE');}
  const recoveryId=this.recoveryId,before=this.#audio.currentTime,start=performance.now();await this.#play('technical_resume');this.#phase='recovering';onPlaying();
  await new Promise(r=>setTimeout(r,3000));const advanced=this.#audio.currentTime-before;
  if(this.#phase==='ended')return;if(['submitted','technical_stop'].includes(this.#phase))throw error('RECOVERY_INTERRUPTED');
  if(advanced<2.8){this.noProgressRecoveries++;this.#journal.emit('recovery_no_progress',{recoveryId,positionBefore:before,positionAfter:this.#audio.currentTime,consecutiveNoProgressRecoveries:this.noProgressRecoveries});throw error('PLAYER_NO_PROGRESS');}
  this.#journal.emit('recovery_position_advanced',{recoveryId,positionBefore:before,positionAfter:this.#audio.currentTime,elapsedMs:performance.now()-start});
  await new Promise(r=>setTimeout(r,7000));if(this.#phase==='ended')return;if(['submitted','technical_stop'].includes(this.#phase))throw error('RECOVERY_INTERRUPTED');if(this.#audio.currentTime-before<9.5){this.noProgressRecoveries++;throw error('PLAYER_NO_PROGRESS');}
  this.#phase='playing';this.#lastAdvance=performance.now();this.noProgressRecoveries=0;this.#journal.emit('recovery_playback_stable',{recoveryId,positionBefore:before,positionAfter:this.#audio.currentTime});
 }
 finish(status,reason){const actor=reason==='review_deadline'?'review_deadline':reason==='manual'||reason==='LEARNER_STOPPED'?'learner':reason==='PAGE_RELOADED_DURING_EXAM'?'navigation':'controller';this.#journal.emit('controller_transition',{actor,reason,controllerStateBefore:this.#phase,controllerStateAfter:status,audioBefore:this.snapshot()});this.#phase=status;clearInterval(this.watch);clearInterval(this.progress);this.pause(actor,reason);}
 setVolume(v){this.#audio.volume=Math.max(0,Math.min(1,v));}
}

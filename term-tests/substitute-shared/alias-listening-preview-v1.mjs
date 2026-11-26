import '../shared/cbt-audio-preview-sync-v1.js?rev=20261123-verified-preview-v1';

export function createVerifiedAliasPreview({official,startButton,onReady,onStopped,journal}){
  let active;
  function stop(reason){
    const run=active;
    if(!run)return;
    active=undefined;
    run.handlers.abort();
    window.IZONE_CBT_AUDIO_CANCEL_PREVIEW_WAIT(run.audio);
    run.audio.pause();
    run.audio.removeAttribute('src');
    run.audio.load();
    run.audio.remove();
    journal.emit('alias_preview_stopped',{reason});
    onStopped(reason,run.qualified);
  }
  async function start(){
    stop('replaced');
    const source=official.currentSrc;
    if(!source.startsWith('blob:')||source!==official.src||!official.paused)
      throw Object.assign(Error('PLAYER_NOT_READY'),{code:'PLAYER_NOT_READY'});
    const audio=document.createElement('audio');
    audio.hidden=true;
    audio.id='alias-preview-audio';
    audio.preload='auto';
    audio.volume=official.volume;
    audio.src=source;
    const run={audio,handlers:new AbortController(),qualified:false};
    active=run;
    const {signal}=run.handlers;
    const atLimit=()=>{
      if(audio.currentTime>=30)stop('preview_limit');
    };
    audio.addEventListener('timeupdate',atLimit,{signal});
    audio.addEventListener('ended',()=>stop('preview_end'),{signal,once:true});
    audio.addEventListener('error',()=>stop('preview_error'),{signal,once:true});
    document.body.append(audio);
    journal.emit('alias_preview_play_requested',{reason:'sample_from_verified_audio'});
    try{
      await audio.play();
      if(active!==run)return;
      window.IZONE_CBT_AUDIO_WAIT_FOR_PREVIEW(audio,startButton,()=>{
        if(active!==run||official.currentSrc!==source||!official.paused)return;
        run.qualified=true;
        journal.emit('alias_preview_qualified',{positionAfter:audio.currentTime,playbackRate:audio.playbackRate});
        onReady();
      });
    }catch(error){
      if(active!==run)return;
      stop('preview_error');
      throw error;
    }
  }
  return{
    start,stop,
    running:()=>Boolean(active),
    setVolume(volume){if(active)active.audio.volume=volume;}
  };
}

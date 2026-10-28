// Chỉ quản lý cửa sổ đáp án và bộ phát xem lại. Các màn khác do app gốc điều khiển.
// Nhận đúng kết quả đã nộp từ app; lỗi audio hiện tại nút, không ghi thay bài làm.
window.ListeningReview = (() => {
  let context, number, player, blobUrl='';
  let resultScope=null, preparation=null;
  const escape = value => String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clock = ms => `${String(Math.floor(ms/60000)).padStart(2,'0')}:${(ms/1000%60).toFixed(2).padStart(5,'0')}`;
  const dialog = () => document.querySelector('#explanation-dialog');
  const allSegments = () => {
    const q=context.data.review.questions[number];
    return [...new Map([...q.replay,...Object.values(q.optionReplay).flat()].map(r=>[r.id,r])).values()];
  };
  function scrollEvidence(id) {
    const pane=dialog().querySelector('.explanation-dialog-passage-scroll');
    const target=pane?.querySelector(`[data-evidence-id="${id}"]`);
    if(pane&&target)pane.scrollTop+=target.getBoundingClientRect().top-pane.getBoundingClientRect().top-25;
  }
  function transcript(replay) {
    const data=context.data.review,marks=Object.assign({},...replay.map(r=>r.marks));
    const safe=value=>/^#[0-9a-f]{6}$/i.test(value||'')?value:null;
    return data.segments.map(s=>{
      const active=replay.some(r=>s.wordStart<r.wordEnd&&s.wordEnd>r.wordStart);
      let body='';
      for(let i=s.wordStart;i<s.wordEnd;i++){
        const r=replay.find(r=>i>=r.wordStart&&i<r.wordEnd),m=marks[i];
        let text=escape(data.words[i].word);
        if(m){const bg=safe(m.background),fg=safe(m.foreground);text=`<mark style="${[bg?`background-color:${bg}`:'',fg?`color:${fg}`:''].filter(Boolean).join(';')}">${text}</mark>`;}
        body+=`<span ${r?`class="is-current-evidence" data-evidence-id="${r.id}"`:''}>${text}</span>`;
      }
      return `<div class="transcript-segment ${active?'explanation-active-paragraph':''}" data-transcript-segment="${s.id}"><span class="transcript-time">${clock(s.start*1000)}</span><p>${body}</p></div>`;
    }).join('');
  }
  function pieces(replay) {
    return replay.map((r,i)=>{
      const label=`▶ Nghe lại ${replay.length>1?'đoạn '+(i+1):'đoạn này'}`;
      return `<div class="replay-evidence">${context.renderParagraphs(r.paragraphs)}<button type="button" class="replay-button" data-replay="${r.id}" data-label="${label}" aria-pressed="false">${label}</button><span class="replay-meta">${clock(r.startMs)}–${clock(r.endMs)} · tự dừng khi hết đoạn</span><span class="replay-status" role="status" aria-live="polite" data-status="${r.id}"></span></div>`;
    }).join('<p class="replay-meta">[…]</p>');
  }
  function cancelPreparation(){
    const job=preparation;
    preparation=null;
    job?.controller.abort();
    if(job&&!job.ready)releaseMedia();
  }
  function playback({state,segment,message,reason}) {
    // Changing the selected clip cancels play intent, while the same authorized
    // result may keep preparing. Explicit cancellation/close/hidden stops work.
    if(reason&&!['replace','change-question','open-question'].includes(reason)&&!preparation?.ready)cancelPreparation();
    const d=dialog();if(!d.open)return;
    d.querySelectorAll('[data-replay]').forEach(button=>{
      const active=button.dataset.replay===segment?.id;
      button.setAttribute('aria-pressed',String(active&&state==='playing'));
      button.setAttribute('aria-busy',String(active&&state==='loading'));
      button.textContent=active&&state==='playing'?'■ Dừng đoạn này':active&&state==='loading'?'Hủy tải đoạn này':button.dataset.label;
      const status=d.querySelector(`[data-status="${button.dataset.replay}"]`);
      status.classList.remove('is-error');
      status.textContent=active&&state==='playing'?'Đang phát · tự dừng khi hết đoạn':active&&state==='loading'?'Đang tải đoạn nghe…':'';
    });
    if(message){const status=d.querySelector('.replay-status');if(status){status.textContent=message;status.classList.add('is-error');}}
    if(state==='playing'&&segment){
      const q=context.data.review.questions[number],group=q.optionReplay[segment.option]||q.replay;
      d.querySelector('.explanation-dialog-passage-scroll').innerHTML=`<p class="passage-subtitle">${escape(context.data.lesson?.title||'Science experiment for Year 12 students')}</p>${transcript(group)}`;
      scrollEvidence(segment.id);
    }
  }
  function close(){player?.stop('close');if(dialog().open)dialog().close();}
  function render() {
    const d=dialog(),data=context.data,a=context.attempt,e=data.explanations.entries[number];
    const lesson=data.lesson,ids=lesson?.questionIds?.map(Number)||Array.from({length:10},(_,i)=>i+21),index=ids.indexOf(number);
    const q=data.review.questions[number],raw=document.createElement('template');
    raw.innerHTML=context.renderContent(e);
    const analysis=raw.content.querySelector('.explanation-analysis');
    // Cả trích dẫn phương án sai vẫn giữ nguyên lời giải và có đúng đoạn nghe riêng.
    for(const option of e.options||[]){
      if(option.correct)continue;
      const groups=q.optionReplay[option.letter]||[];
      const quote=analysis.querySelector(`[data-option="${option.letter}"] blockquote`);
      if(quote&&groups.length)quote.innerHTML=pieces(groups);
    }
    const prompt=[e.prompt];if(e.kind==='mcq'&&e.options?.find(o=>o.correct))prompt.push(e.options.find(o=>o.correct).label);
    const answer=e.answer.join(' / '),row=a.result.rows.find(r=>r.number===number);
    const bank=e.kind==='flowchart'&&data.definition.bank?data.definition.bank.find(x=>x[0]===answer):null;
    d.innerHTML=`<div class="explanation-dialog-shell"><header class="explanation-dialog-header"><div><span class="kicker">BUỔI ${lesson?.lesson||8} · ĐÁP ÁN VÀ GIẢI THÍCH</span><h2 id="explanation-dialog-title">Câu ${number} · ${escape(lesson?.groups.find(g=>number>=g.start&&number<=g.end)?.label||(e.kind==='mcq'?'Multiple Choice':'Flow-chart Completion'))}</h2></div><button type="button" class="explanation-dialog-close" data-review-close aria-label="Đóng giải thích">×</button></header><div class="explanation-dialog-columns"><section class="explanation-dialog-passage" aria-label="Transcript"><div class="explanation-dialog-pane-head"><strong>Transcript · ${escape(lesson?.title||'Clare – Jake')}</strong><span>Câu ${number}</span></div><div class="explanation-dialog-passage-scroll"><p class="passage-subtitle">${escape(context.data.lesson?.title||'Science experiment for Year 12 students')}</p>${transcript(q.replay)}</div></section><section class="explanation-dialog-detail" aria-label="Đáp án và giải thích"><div class="explanation-dialog-detail-scroll"><div class="explanation-dialog-answer"><span>Đáp án đúng <strong>${escape(answer)}${bank?' · '+escape(bank[1]):''}</strong></span><span>Bài làm của bạn <strong>${escape(a.answers[number]||'—')}</strong></span><span class="result-${row.state}">${row.state==='correct'?'Đúng':row.state==='blank'?'Bỏ trống':'Sai'}</span></div><h3>Đối chiếu ý trong đề và transcript</h3><p class="explanation-dialog-hint">Các màu giống nhau chỉ ý tương ứng, kể cả khi cách diễn đạt khác nhau.</p><div class="explanation-dialog-compare"><section><h4>Nội dung đề bài</h4>${context.renderParagraphs(prompt)}</section><section><h4>Bằng chứng trong transcript</h4>${pieces(q.replay)}</section></div><section class="explanation-dialog-analysis"><h3>Giải thích chi tiết</h3>${analysis.innerHTML}</section></div></section></div><footer class="explanation-dialog-footer"><span>Câu ${index+1}/${ids.length}</span><nav aria-label="Chuyển câu giải thích"><button type="button" class="button outline" data-review-prev ${index===0?'disabled':''}>← Câu trước</button><button type="button" class="button outline" data-review-next ${index===ids.length-1?'disabled':''}>Câu sau →</button></nav></footer></div>`;
    d.querySelector('[data-review-close]').onclick=close;
    d.querySelector('[data-review-prev]').onclick=()=>{player.stop('change-question');number=ids[index-1];render();};
    d.querySelector('[data-review-next]').onclick=()=>{player.stop('change-question');number=ids[index+1];render();};
    d.querySelectorAll('[data-replay]').forEach(button=>button.onclick=()=>player.play(allSegments().find(r=>r.id===button.dataset.replay)));
    d.querySelector('[data-review-close]').focus({preventScroll:true});
    requestAnimationFrame(()=>scrollEvidence(q.replay[0].id));
  }
  function initPlayer() {
    if(!player){
      player=new ReviewAudio(document.querySelector('#review-audio'),playback);
      const d=dialog();d.addEventListener('cancel',()=>player.stop('escape'));
      // Giữ popup khi kéo chọn chữ qua mép; chỉ đóng nếu nhấn và thả đều ngoài khung.
      let outsidePointer=null;
      const outside=e=>{const r=d.getBoundingClientRect();return e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom;};
      d.addEventListener('pointerdown',e=>{outsidePointer=outside(e)?e.pointerId:null;});
      d.addEventListener('pointerup',e=>{const shouldClose=outsidePointer===e.pointerId&&outside(e);outsidePointer=null;if(shouldClose)close();});
      d.addEventListener('pointercancel',()=>{outsidePointer=null;});
      d.addEventListener('close',()=>{if(!d.open&&context?.trigger?.isConnected)context.trigger.focus();});
      window.addEventListener('resize',()=>{if(d.open&&context)scrollEvidence(context.data.review.questions[number].replay[0].id);});
    }
  }
  function useResult(input){
    const {attempt,data}=input,review=data?.review;
    if(attempt?.status!=='submitted'||!review||!data.reviewAudioUrl||
      review.audioSha256!==data.definition?.audio?.sha256||review.contentVersion!==data.contentVersion)return false;
    let base,url;
    try{base=new URL(window.LISTENING_CONFIG.apiBase.replace(/\/$/,'')+'/',location.href);url=new URL(data.reviewAudioUrl,base);}catch{return false;}
    if(url.origin!==base.origin||!url.pathname.startsWith(base.pathname))return false;
    const key=JSON.stringify([input.owner,input.role,attempt.id,data.contentVersion,review.audioSha256,url.href]);
    if(resultScope?.key===key&&resultScope.token===input.token)return true;
    reset();initPlayer();
    resultScope={key,url:url.href,hash:review.audioSha256,token:input.token};
    player.durationMs=review.audioDurationMs;
    player.prepare=signal=>prepareAudio(signal);
    return true;
  }
  function prepareAudio(signal){
    signal?.throwIfAborted();
    if(!resultScope)throw new DOMException('Cancelled','AbortError');
    if(!preparation){
      const scope=resultScope,controller=new AbortController(),job={controller,ready:false};
      const timer=setTimeout(()=>controller.abort(),120000);
      preparation=job;
      job.promise=(async()=>{
        const {fetchListeningAudio}=await import('./audio-delivery.mjs?v=20261026-review-fast1&journal=20261024-audio-v1&audio=20261028-part-rescue-v1');
        const blob=await fetchListeningAudio(scope.url,{headers:scope.token?{Authorization:`Bearer ${scope.token}`}:{},credentials:'include',signal:controller.signal,expectedSha256:scope.hash});
        controller.signal.throwIfAborted();
        if(resultScope!==scope||preparation!==job)throw new DOMException('Cancelled','AbortError');
        blobUrl=URL.createObjectURL(blob);
        player.audio.preload='auto';player.audio.src=blobUrl;
        await player.prime(controller.signal);
        controller.signal.throwIfAborted();
        if(resultScope!==scope||preparation!==job)throw new DOMException('Cancelled','AbortError');
        job.ready=true;
      })().catch(error=>{
        if(preparation===job){preparation=null;releaseMedia();}
        throw error;
      }).finally(()=>clearTimeout(timer));
    }
    const pending=preparation.promise;
    if(!signal)return pending;
    return new Promise((resolve,reject)=>{
      const cancelled=()=>{cleanup();reject(new DOMException('Cancelled','AbortError'));};
      const cleanup=()=>signal.removeEventListener('abort',cancelled);
      signal.addEventListener('abort',cancelled,{once:true});
      pending.then(value=>{cleanup();resolve(value);},error=>{cleanup();reject(error);});
      if(signal.aborted)cancelled();
    });
  }
  // Called after an authorized submitted result is visible; it never opens a
  // popup or plays. The click joins this exact job, including its API grant.
  function warm(input){if(useResult(input)&&!document.hidden)void prepareAudio().catch(()=>{});}
  function open(input) {
    if(!useResult(input))return;
    player.stop('open-question');context=input;number=input.number;
    if(!dialog().open)dialog().showModal();render();
  }
  function releaseMedia(){
    if(blobUrl){URL.revokeObjectURL(blobUrl);blobUrl='';
      if(player){player.audio.removeAttribute('src');player.audio.load();}}
  }
  // Đăng xuất phải xóa cả dữ liệu/audio đang xem, kể cả từ tab khác.
  function reset(){close();cancelPreparation();resultScope=null;context=null;dialog().replaceChildren();releaseMedia();}
  return {open,close,reset,warm,debug:()=>({player,number,attemptId:context?.attempt.id,ready:preparation?.ready===true})};
})();

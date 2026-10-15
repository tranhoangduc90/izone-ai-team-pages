// Chỉ quản lý cửa sổ đáp án và bộ phát xem lại. Các màn khác do app gốc điều khiển.
// Nhận đúng kết quả đã nộp từ app; lỗi audio hiện tại nút, không ghi thay bài làm.
window.ListeningReview = (() => {
  let context, number, player, blobUrl='',blobKey='';
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
  function playback({state,segment,message}) {
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
      d.querySelector('.explanation-dialog-passage-scroll').innerHTML=`<p class="passage-subtitle">Science experiment for Year 12 students</p>${transcript(group)}`;
      scrollEvidence(segment.id);
    }
  }
  function close(){player?.stop('close');if(dialog().open)dialog().close();}
  function render() {
    const d=dialog(),data=context.data,a=context.attempt,e=data.explanations.entries[number];
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
    const prompt=[e.prompt];if(e.kind==='mcq')prompt.push(e.options.find(o=>o.correct).label);
    const answer=e.answer.join(' / '),row=a.result.rows.find(r=>r.number===number);
    const bank=e.kind==='flowchart'?data.definition.bank.find(x=>x[0]===answer):null;
    d.innerHTML=`<div class="explanation-dialog-shell"><header class="explanation-dialog-header"><div><span class="kicker">BUỔI 8 · ĐÁP ÁN VÀ GIẢI THÍCH</span><h2 id="explanation-dialog-title">Câu ${number} · ${e.kind==='mcq'?'Multiple Choice':'Flow-chart Completion'}</h2></div><button type="button" class="explanation-dialog-close" data-review-close aria-label="Đóng giải thích">×</button></header><div class="explanation-dialog-columns"><section class="explanation-dialog-passage" aria-label="Transcript"><div class="explanation-dialog-pane-head"><strong>Transcript · Clare – Jake</strong><span>Câu ${number}</span></div><div class="explanation-dialog-passage-scroll"><p class="passage-subtitle">Science experiment for Year 12 students</p>${transcript(q.replay)}</div></section><section class="explanation-dialog-detail" aria-label="Đáp án và giải thích"><div class="explanation-dialog-detail-scroll"><div class="explanation-dialog-answer"><span>Đáp án đúng <strong>${escape(answer)}${bank?' · '+escape(bank[1]):''}</strong></span><span>Bài làm của bạn <strong>${escape(a.answers[number]||'—')}</strong></span><span class="result-${row.state}">${row.state==='correct'?'Đúng':row.state==='blank'?'Bỏ trống':'Sai'}</span></div><h3>Đối chiếu ý trong đề và transcript</h3><p class="explanation-dialog-hint">Các màu giống nhau chỉ ý tương ứng, kể cả khi cách diễn đạt khác nhau.</p><div class="explanation-dialog-compare"><section><h4>Nội dung đề bài</h4>${context.renderParagraphs(prompt)}</section><section><h4>Bằng chứng trong transcript</h4>${pieces(q.replay)}</section></div><section class="explanation-dialog-analysis"><h3>Giải thích chi tiết</h3>${analysis.innerHTML}</section></div></section></div><footer class="explanation-dialog-footer"><span>Câu ${number-20}/10</span><nav aria-label="Chuyển câu giải thích"><button type="button" class="button outline" data-review-prev ${number===21?'disabled':''}>← Câu trước</button><button type="button" class="button outline" data-review-next ${number===30?'disabled':''}>Câu sau →</button></nav></footer></div>`;
    d.querySelector('[data-review-close]').onclick=close;
    d.querySelector('[data-review-prev]').onclick=()=>{player.stop('change-question');number--;render();};
    d.querySelector('[data-review-next]').onclick=()=>{player.stop('change-question');number++;render();};
    d.querySelectorAll('[data-replay]').forEach(button=>button.onclick=()=>player.play(allSegments().find(r=>r.id===button.dataset.replay)));
    d.querySelector('[data-review-close]').focus({preventScroll:true});
    requestAnimationFrame(()=>scrollEvidence(q.replay[0].id));
  }
  function open(input) {
    if(!input.data.review){return;}
    if(!player){
      player=new ReviewAudio(document.querySelector('#review-audio'),playback);
      const d=dialog();d.addEventListener('cancel',()=>player.stop('escape'));
      d.addEventListener('click',e=>{if(e.target===d)close();});
      d.addEventListener('close',()=>{player.stop('closed');if(context?.trigger?.isConnected)context.trigger.focus();});
      window.addEventListener('hashchange',close);
      window.addEventListener('resize',()=>{if(d.open)scrollEvidence(context.data.review.questions[number].replay[0].id);});
    }
    player.stop('open-question');context=input;number=input.number;
    player.prepare=async signal=>{
      const current=context;
      // API có prefix riêng trên production; không lấy nhầm audio từ tên miền Pages.
      const base=new URL(window.LISTENING_CONFIG.apiBase.replace(/\/$/,'')+'/',location.href);
      const key=new URL(current.data.reviewAudioUrl,base).href;
      if(blobKey===key&&blobUrl)return;
      const response=await fetch(key,{headers:current.token?{Authorization:`Bearer ${current.token}`}:{},credentials:'include',signal});
      if(!response.ok)throw new Error('REVIEW_AUDIO_UNAVAILABLE');
      const blob=await response.blob();if(signal.aborted)throw new DOMException('Cancelled','AbortError');
      if(blobUrl)URL.revokeObjectURL(blobUrl);
      blobUrl=URL.createObjectURL(blob);blobKey=key;player.audio.src=blobUrl;
    };
    if(!dialog().open)dialog().showModal();render();
  }
  return {open,close,debug:()=>({player,number,attemptId:context?.attempt.id})};
})();

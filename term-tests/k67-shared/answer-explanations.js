// Nhận kết quả đã nộp; Test có nghe lại chuẩn bị sớm qua cùng API quyền xem lời giải.
// Dựng cửa sổ giống Reading/Listening thực chiến. Lỗi tải hiện tại nút, không đổi bài làm hay điểm.
(function () {
  'use strict';
  const supported = new Set(['term-test-1', 'term-test-2', 'mini-test-lesson-5', 'substitute-test-1-k67']);
  const replayTests = new Set(['term-test-1', 'term-test-2', 'substitute-test-1-k67']);
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[c]);
  let activeAttempt = '', cached, context, number, dialog, trigger, generation = 0;
  const scriptBase = new URL('.', document.currentScript.src);
  let player, reviewAudio, blobUrl = '', playerKey = '', preparation, warmedGeneration = -1;
  const clock = ms => `${String(Math.floor(ms / 60000)).padStart(2, '0')}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;
  function replayButtons(clips) {
    return (clips || []).map((clip, i) => {
      const label = `▶ Nghe lại ${clips.length > 1 ? clip.label || 'đoạn ' + (i + 1) : 'dẫn chứng'}`;
      return `<div class="explanation-replay"><button type="button" class="explanation-replay-button" data-k67-replay="${escape(clip.id)}" data-replay-label="${escape(label)}" aria-pressed="false">${escape(label)}</button><span>${clock(clip.startMs)}–${clock(clip.endMs)} · tự dừng</span><span class="explanation-replay-status" role="status"></span></div>`;
    }).join('');
  }
  function releaseMedia() {
    if (blobUrl) { URL.revokeObjectURL(blobUrl); blobUrl = ''; }
    if (reviewAudio?.hasAttribute('src')) { reviewAudio.removeAttribute('src'); reviewAudio.load(); }
  }
  function cancelPreparation() {
    const job = preparation; preparation = null; job?.controller.abort();
    if (job && !job.ready) releaseMedia();
  }
  function clearAudio() {
    cancelPreparation(); player?.dispose(); player = null; playerKey = '';
    releaseMedia(); reviewAudio?.remove(); reviewAudio = null;
  }
  function sourceFor(review) {
    const descriptor = review.bundle.reviewAudio;
    if (!descriptor || !/^[a-f0-9]{64}$/.test(descriptor.sha256) || !Number.isInteger(descriptor.durationMs) || descriptor.durationMs < 1) throw Error('Sai định danh audio');
    const substitute = review.bundle.testSlug === 'substitute-test-1-k67' && descriptor.asset === 'substitute-test-1-k67.mp3'
      && descriptor.sha256 === '59e69c9691841655a639a22fa9d7a8aec658e4c0c82c5e1451dd5bdd895d0b10';
    const termAsset = {
      'term-test-1': /^term-test-1-128kbps-[0-9a-f]{16}\.mp3$/,
      'term-test-2': /^term-test-2-96kbps-[0-9a-f]{16}\.mp3$/
    }[review.bundle.testSlug];
    if (!substitute && !termAsset?.test(descriptor.asset)) throw Error('Sai nguồn audio');
    return new URL(substitute ? '../substitute-test-1-k67-computer-based/assets/private/listening-substitute-test-1-k67.mp3'
      : '../k67-audio-assets/' + descriptor.asset, scriptBase).href;
  }
  function ensurePlayer(review, epoch) {
    const descriptor = review.bundle.reviewAudio;
    if (!descriptor || !window.K67ReviewAudio) throw Error('Chưa tải đủ bộ phát nghe lại. Hãy tải lại trang.');
    const key = JSON.stringify([epoch, review.bundle.testSlug, descriptor.sha256, descriptor.durationMs]);
    if (player && playerKey === key) return;
    clearAudio(); playerKey = key;
    if (!reviewAudio) {
      reviewAudio = document.createElement('audio'); reviewAudio.hidden = true; reviewAudio.preload = 'none';
      reviewAudio.dataset.k67ReviewAudio = ''; document.body.append(reviewAudio);
    }
    player = new window.K67ReviewAudio(reviewAudio, { durationMs: descriptor.durationMs,
      prepare: signal => prepareAudio(review, epoch, signal),
      onState: ({ state, segment, message, reason }) => {
        if (reason && !['replace','change-question'].includes(reason) && !preparation?.ready) cancelPreparation();
        dialog?.querySelectorAll('[data-k67-replay]').forEach(button => {
          const active = button.dataset.k67Replay === segment?.id;
          button.setAttribute('aria-pressed', String(active && state === 'playing'));
          button.textContent = active && state === 'playing' ? '■ Dừng đoạn này' : active && state === 'loading' ? 'Hủy tải đoạn nghe' : button.dataset.replayLabel;
          button.parentNode.querySelector('.explanation-replay-status').textContent = active && state === 'playing' ? 'Đang phát · tự dừng khi hết đoạn' : '';
        });
        if (message) { const status = dialog?.querySelector('.explanation-replay-status'); if (status) status.textContent = message; }
      }
    });
  }
  function prepareAudio(review, epoch, signal) {
    signal?.throwIfAborted();
    if (epoch !== generation) throw new DOMException('Cancelled', 'AbortError');
    const source = sourceFor(review), descriptor = review.bundle.reviewAudio;
    ensurePlayer(review, epoch);
    if (!preparation) {
      const controller = new AbortController(), currentPlayer = player, job = {controller, ready:false};
      const timer = setTimeout(() => controller.abort(), 120000);
      preparation = job;
      job.promise = (async () => {
        const {downloadReview} = await import(new URL('../../shared/audio/transport.mjs?v=20261026-term1-replay1&journal=20261024-startup-v2&resilience=20261027-v1&audio=20261028-part-rescue-v1&ej=ej-a176e4d58d3089a76456', scriptBase));
        let blob = await downloadReview(source, descriptor.sha256, {signal:controller.signal});
        if (!blob) {
          const response = await fetch(source, {signal:controller.signal, cache:'force-cache'});
          if (!response.ok) throw Error('Không tải được audio');
          blob = await response.blob();
          const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer()))].map(b=>b.toString(16).padStart(2,'0')).join('');
          if (hash !== descriptor.sha256) throw Error('Audio không khớp phiên bản lời giải');
        }
        controller.signal.throwIfAborted();
        if (epoch !== generation || preparation !== job) throw new DOMException('Cancelled', 'AbortError');
        blobUrl = URL.createObjectURL(blob); reviewAudio.preload = 'auto'; reviewAudio.src = blobUrl;
        await currentPlayer.prime(controller.signal);
        controller.signal.throwIfAborted();
        if (epoch !== generation || preparation !== job) throw new DOMException('Cancelled', 'AbortError');
        job.ready = true;
      })().catch(error => { if (preparation === job) { preparation = null; releaseMedia(); } throw error; }).finally(() => clearTimeout(timer));
    }
    const pending = preparation.promise;
    if (!signal) return pending;
    return new Promise((resolve,reject) => {
      const cleanup = () => signal.removeEventListener('abort', cancelled);
      const cancelled = () => { cleanup(); reject(new DOMException('Cancelled', 'AbortError')); };
      signal.addEventListener('abort', cancelled, {once:true});
      pending.then(value=>{cleanup();resolve(value);}, error=>{cleanup();reject(error);});
      if (signal.aborted) cancelled();
    });
  }
  async function playClip(clip) {
    ensurePlayer(context.review, generation);
    await player.play(clip);
  }
  function closeDialog() { player?.stop('', 'closed'); if (dialog?.open) dialog.close(); }
  const text = paragraphs => (paragraphs || []).map(p => p.map(r => r.text).join('')).join('\n');
  const colorClass = (prefix, color) => /^#[0-9a-f]{6}$/i.test(color || '') ? ` ex-${prefix}-${color.slice(1)}` : '';
  function paragraphs(value, colors = true) {
    return (value || []).map(p => `<p>${p.map(r => {
      const classes = `${r.bold ? 'ex-bold' : ''}${r.italic ? ' ex-italic' : ''}${colors ? colorClass('fg', r.foreground) + colorClass('bg', r.background) : ''}`;
      return `<span class="${classes}">${escape(r.text)}</span>`;
    }).join('')}</p>`).join('');
  }
  // HTML bài đọc đến từ kho đề riêng. Loại thành phần có thể chạy mã trước khi đưa vào cửa sổ chỉ đọc.
  function passageHtml(html) {
    const template = document.createElement('template');
    template.innerHTML = String(html || '');
    template.content.querySelectorAll('script,style,iframe,object,embed,form,input,button').forEach(n => n.remove());
    template.content.querySelectorAll('*').forEach(n => {
      for (const attr of [...n.attributes]) {
        if (/^on/i.test(attr.name) || ['style', 'srcdoc'].includes(attr.name)
          || (['href', 'src'].includes(attr.name) && /^\s*(javascript|data:text\/html):/i.test(attr.value))) n.removeAttribute(attr.name);
      }
    });
    return template.innerHTML;
  }
  function ensureDialog() {
    if (dialog) return dialog;
    dialog = document.createElement('dialog');
    dialog.id = 'explanation-dialog';
    dialog.setAttribute('aria-labelledby', 'explanation-dialog-title');
    document.body.append(dialog);
    let pressedOutside = false, releasedOutside = false;
    const outside = event => {
      const r = dialog.getBoundingClientRect();
      return event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom;
    };
    dialog.addEventListener('pointerdown', event => { pressedOutside = outside(event); releasedOutside = false; });
    dialog.addEventListener('pointerup', event => { releasedOutside = outside(event); });
    dialog.addEventListener('click', event => {
      if (event.target === dialog && pressedOutside && releasedOutside) closeDialog();
      pressedOutside = releasedOutside = false;
    });
    dialog.addEventListener('cancel', () => player?.stop('', 'escape'));
    dialog.addEventListener('close', () => { if (!dialog.open && trigger?.isConnected) trigger.focus(); });
    window.addEventListener('pagehide', () => { dialog.close(); cached = null; clearAudio(); });
    return dialog;
  }
  const normalize = value => value.normalize('NFKC').toLowerCase().replace(/[’‘]/g, "'").replace(/[^\p{L}\p{N}]/gu, '');
  function colorEvidence(paragraph, evidence) {
    const original = paragraph.textContent;
    const positions = [], characters = [];
    for (let i = 0; i < original.length; i++) {
      const value = normalize(original[i]);
      for (const character of value) { characters.push(character); positions.push(i); }
    }
    const normalized = characters.join(''), ranges = [];
    for (const p of evidence) for (const run of p) {
      const color = colorClass('bg', run.background) + colorClass('fg', run.foreground);
      if (!color || (!run.background && ['#000000', '#333333', '#282828'].includes(run.foreground))) continue;
      for (const piece of run.text.split(/\[?\.\.\.\]?|[…]/)) {
        const fragment = normalize(piece);
        if (fragment.length < 4) continue;
        const at = normalized.indexOf(fragment);
        if (at < 0) continue;
        const start = positions[at], end = positions[at + fragment.length - 1] + 1;
        if (!ranges.some(r => start < r.end && end > r.start)) ranges.push({ start, end, color });
      }
    }
    // Bọc từ cuối đoạn để các vị trí chữ phía trước không bị thay đổi.
    for (const item of ranges.sort((a, b) => b.start - a.start)) {
      const walker = document.createTreeWalker(paragraph, NodeFilter.SHOW_TEXT);
      let node, offset = 0, startNode, endNode, startOffset, endOffset;
      while ((node = walker.nextNode())) {
        const next = offset + node.textContent.length;
        if (!startNode && item.start >= offset && item.start < next) { startNode = node; startOffset = item.start - offset; }
        if (item.end > offset && item.end <= next) { endNode = node; endOffset = item.end - offset; break; }
        offset = next;
      }
      if (!startNode || !endNode) continue;
      const range = document.createRange();
      range.setStart(startNode, startOffset); range.setEnd(endNode, endOffset);
      const mark = document.createElement('span'); mark.className = item.color.trim();
      mark.append(range.extractContents()); range.insertNode(mark);
    }
  }
  function markReadingEvidence(pane, entry) {
    const excerpts = entry.evidence.map(p => p.map(r => r.text).join(''))
      .map(t => t.replace(/^Đoạn\s+[^:]+:\s*/i, ''))
      .map(t => t.replace(/^\s*\[[A-Z][A-Z ]*\]\s*:?\s*/, ''))
      .flatMap(t => t.split(/\[?\.\.\.\]?|[…]/)).map(normalize).filter(t => t.length >= 25);
    const candidates = [...pane.querySelectorAll('p, .cbt-passage-paragraph')]
      .filter(p => !p.querySelector('p, .cbt-passage-paragraph'));
    const matches = candidates.filter(p => {
      const body = normalize(p.textContent);
      return excerpts.some(e => body.includes(e) || (body.length > 40 && e.includes(body)));
    });
    // Nguồn cũ đôi khi có biến thể focused/focussed hoặc metres/meters.
    // Chỉ dùng cụm màu dài nằm duy nhất trong một đoạn, không đoán theo từ chung.
    if (!matches.length) {
      const anchors = entry.evidence.flatMap(p => p.filter(r => r.background || r.foreground === '#ff0000' || r.foreground === '#d90000')
        .map(r => normalize(r.text))).filter(t => t.length >= 14);
      for (const anchor of anchors) {
        const found = candidates.filter(p => normalize(p.textContent).includes(anchor));
        if (found.length === 1 && !matches.includes(found[0])) matches.push(found[0]);
      }
    }
    for (const p of matches) {
      p.classList.add('explanation-active-paragraph'); colorEvidence(p, entry.evidence);
    }
  }
  // Cuộn chính vùng đọc đến chữ dẫn chứng, kể cả khi nó nằm cuối một đoạn dài.
  function scrollToEvidence(pane) {
    const first = pane.querySelector('.explanation-active-paragraph [class*="ex-bg-"], .explanation-active-paragraph [class*="ex-fg-"]')
      || pane.querySelector('.explanation-active-paragraph');
    if (first) pane.scrollTop += first.getBoundingClientRect().top - pane.getBoundingClientRect().top - 24;
  }
  function render() {
    player?.stop('', 'change-question');
    const { review, skill } = context;
    const entries = review.bundle.skills[skill].entries;
    const numbers = Object.keys(entries).map(Number).sort((a, b) => a - b);
    const entry = entries[number];
    const row = review.result?.[skill]?.details?.find(r => Number(r.number) === number);
    const section = review.content[skill].sections[entry.section];
    const isReading = skill === 'reading';
    const sectionTitle = section.title || section.label;
    const correctAnswer = (entry.gradingNote ? null : row?.correctAnswer) || entry.answers.join(entry.pairNumbers ? ' + ' : ' / ');
    const studentAnswer = row?.studentAnswer ?? review.answers?.[skill]?.[number] ?? '';
    const outcome = ['correct', 'incorrect', 'blank'].includes(row?.result) ? row.result : 'unknown';
    const evidenceText = new Set(entry.evidence.map(p => text([p])));
    const excerptMap = new Map();
    Object.values(entries).filter(e => e.section === entry.section).forEach(e => e.blocks.forEach(b => {
      b.evidence.forEach(p => { const key = text([p]); if (key.trim()) excerptMap.set(key, p); });
    }));
    // Các câu khác chỉ làm ngữ cảnh. Nếu dùng chung trích dẫn, lấy màu của đúng câu đang mở.
    const currentExcerpts = new Map(entry.blocks.flatMap(b => b.evidence).map(p => [text([p]), p]));
    for (const [key, p] of currentExcerpts) if (excerptMap.has(key)) excerptMap.set(key, p);
    const fullTranscript = !isReading && Array.isArray(section.transcript);
    const left = isReading ? passageHtml(section.passageHtml) : fullTranscript ? paragraphs(section.transcript, false) : [...excerptMap].map(([key, p]) =>
      `<div class="cbt-passage-paragraph${evidenceText.has(key) ? ' explanation-active-paragraph' : ''}">${paragraphs([p], currentExcerpts.has(key))}</div>`).join('');
    const analysis = entry.blocks.map(block => {
      const quotes = paragraphs(block.evidence);
      const primary = block.evidence.some(p => evidenceText.has(text([p])));
      return `<div class="explanation-source-block">${paragraphs(block.analysis)}${quotes
        ? primary ? `<blockquote>${quotes}${replayButtons(block.replay)}</blockquote>` : `<details class="explanation-option-quote"><summary>Xem trích dẫn</summary><blockquote>${quotes}${replayButtons(block.replay)}</blockquote></details>` : ''}</div>`;
    }).join('');
    const index = numbers.indexOf(number);
    const d = ensureDialog();
    d.innerHTML = `<div class="explanation-dialog-shell"><header class="explanation-dialog-header"><div><span class="kicker">${escape(context.title)} · ĐÁP ÁN VÀ GIẢI THÍCH</span><h2 id="explanation-dialog-title">Câu ${number} · ${escape(entry.type.replace(/^(Reading|Listening) - /, ''))}</h2></div><button type="button" class="explanation-dialog-close" data-explanation-close aria-label="Đóng giải thích">×</button></header><div class="explanation-dialog-columns"><section class="explanation-dialog-passage" aria-label="${isReading ? 'Bài đọc' : fullTranscript ? 'Transcript đầy đủ' : 'Trích transcript'}"><div class="explanation-dialog-pane-head"><strong>${isReading ? 'Bài đọc' : fullTranscript ? 'Transcript đầy đủ' : 'Trích transcript'} · ${escape(section.label)}</strong><span>Câu ${number}</span></div><div class="explanation-dialog-passage-scroll"><p class="passage-subtitle">${escape(sectionTitle)}</p>${left}</div></section><section class="explanation-dialog-detail" aria-label="Đáp án và giải thích"><div class="explanation-dialog-detail-scroll"><div class="explanation-dialog-answer"><span>Đáp án đúng <strong>${escape(correctAnswer)}</strong></span><span>${escape(context.answerLabel || 'Bài làm của bạn')} <strong>${escape(studentAnswer || '—')}</strong></span><span class="result-${outcome}">${outcome === 'correct' ? 'Đúng' : outcome === 'blank' ? 'Bỏ trống' : outcome === 'incorrect' ? 'Sai' : 'Chưa có dữ liệu từng câu'}</span></div>${entry.gradingNote ? `<p class="explanation-dialog-hint">${escape(entry.gradingNote)}</p>` : ''}${entry.pairNumbers ? `<p class="explanation-dialog-hint">Câu ${entry.pairNumbers.join('–')} dùng chung lời giải; hai đáp án đúng không xét thứ tự. Kết quả từng câu giữ theo bài đã chấm.</p>` : ''}<h3>Đối chiếu ý trong đề và ${isReading ? 'bài đọc' : 'transcript'}</h3><p class="explanation-dialog-hint">Các màu giống nhau chỉ ý tương ứng, kể cả khi cách diễn đạt khác nhau.</p><div class="explanation-dialog-compare"><section><h4>Nội dung đề bài</h4>${paragraphs(entry.prompt)}</section><section><h4>Bằng chứng trong ${isReading ? 'bài đọc' : 'transcript'}</h4>${entry.contextOnly ? `<p>${escape(entry.contextNote)}</p>` : paragraphs(entry.evidence)}</section></div><section class="explanation-dialog-analysis"><h3>Giải thích chi tiết</h3>${analysis}</section></div></section></div><footer class="explanation-dialog-footer"><span>Câu ${index + 1}/${numbers.length}</span><nav aria-label="Chuyển câu giải thích"><button type="button" class="button outline" data-explanation-prev ${index === 0 ? 'disabled' : ''}>← Câu trước</button><button type="button" class="button outline" data-explanation-next ${index === numbers.length - 1 ? 'disabled' : ''}>Câu sau →</button></nav></footer></div>`;
    d.querySelector('[data-explanation-close]').onclick = closeDialog;
    if (fullTranscript) d.querySelector('.explanation-dialog-passage-scroll').classList.add('explanation-full-transcript');
    if (review.bundle.testSlug === 'substitute-test-1-k67' && entry.figure === 'home-improvement-store.png') {
      const image = document.createElement('img');
      image.src = new URL('../substitute-test-1-k67-computer-based/assets/figures/home-improvement-store.png', scriptBase);
      image.alt = 'Sơ đồ Home Improvement Store, các vị trí A–H';
      image.className = 'explanation-question-figure';
      d.querySelector('.explanation-dialog-compare>section').append(image);
    }
    if (!isReading && entry.replay?.length) {
      d.querySelector('.explanation-dialog-compare>section:last-child').insertAdjacentHTML('beforeend', replayButtons(entry.replay));
      const clips = new Map([...entry.replay, ...entry.blocks.flatMap(b => b.replay || [])].map(c => [c.id, c]));
      d.querySelectorAll('[data-k67-replay]').forEach(button => button.onclick = () => playClip(clips.get(button.dataset.k67Replay)).catch(error => {
        button.parentNode.querySelector('.explanation-replay-status').textContent = error.message;
      }));
    }
    d.querySelector('[data-explanation-prev]').onclick = () => { number = numbers[index - 1]; render(); };
    d.querySelector('[data-explanation-next]').onclick = () => { number = numbers[index + 1]; render(); };
    if (!d.open) d.showModal();
    d.querySelector('[data-explanation-close]').focus({ preventScroll: true });
    const renderedNumber = number;
    requestAnimationFrame(() => {
      if (!d.open || context?.review !== review || context?.skill !== skill || number !== renderedNumber) return;
      const pane = d.querySelector('.explanation-dialog-passage-scroll');
      if (isReading || fullTranscript) markReadingEvidence(pane, entry);
      scrollToEvidence(pane);
    });
  }
  function attach({ container, payload, attemptToken, reviewKey = attemptToken, testSlug, title, request,
    loadReview, answerLabel = 'Bài làm của bạn' }) {
    if (!supported.has(testSlug) || !payload.completed || !reviewKey || (!attemptToken && !loadReview)) return;
    const scopeKey = JSON.stringify([testSlug,reviewKey]);
    if (activeAttempt !== scopeKey) {
      clearAudio(); player = null;
      activeAttempt = scopeKey; cached = null; generation++;
      if (dialog?.open) dialog.close();
    }
    const epoch = generation;
    const load = () => {
      if (epoch !== generation) return Promise.reject(new DOMException('Cancelled', 'AbortError'));
      if (!cached) {
        const pending = Promise.resolve().then(() => loadReview ? loadReview() : request('/api/term-tests/result/explanations', {method:'POST',
          headers:{'Content-Type':'application/json'}, body:JSON.stringify({attemptToken})}));
        cached = pending;
        pending.catch(() => { if (cached === pending) cached = null; });
      }
      return cached;
    };
    // Only existing replay tests prefetch, after the normal completed-result
    // gate and through the exact same native review authorization as a click.
    if (replayTests.has(testSlug) && warmedGeneration !== epoch && !document.hidden) {
      warmedGeneration = epoch;
      void load().then(response => {
        if (epoch !== generation || document.hidden || !container.isConnected || container.closest('[hidden]')) return;
        const review = response.review;
        if (review?.bundle?.testSlug !== testSlug || !review.bundle.reviewAudio || !review.bundle.skills?.listening) return;
        return prepareAudio(review, epoch);
      }).catch(() => {});
    }
    container.querySelectorAll('.detail-block').forEach(block => {
      const skill = block.dataset.skill?.toLowerCase();
      if (!['listening', 'reading'].includes(skill)) return;
      const table = block.querySelector('table');
      if (!table || table.dataset.explanationsAttached === String(epoch)) return;
      table.querySelectorAll('[data-explanation-column]').forEach(node => node.remove());
      table.dataset.explanationsAttached = String(epoch);
      const heading = document.createElement('th'); heading.textContent = 'Giải thích';
      heading.dataset.explanationColumn = 'true';
      table.querySelector('thead tr').append(heading);
      const rows = payload.result[skill]?.details || [];
      [...table.querySelectorAll('tbody tr')].forEach((tr, i) => {
        const cell = document.createElement('td'), button = document.createElement('button'), status = document.createElement('span');
        cell.dataset.explanationColumn = 'true';
        button.type = 'button'; button.className = 'explanation-open'; button.textContent = 'Xem giải thích';
        button.setAttribute('aria-label', `${skill === 'reading' ? 'Reading' : 'Listening'} câu ${rows[i].number}: Xem giải thích`);
        status.className = 'explanation-load-status'; status.setAttribute('role', 'status');
        if (dialog?.open && context?.skill === skill && Number(rows[i].number) === number) trigger = button;
        button.onclick = async () => {
          const epoch = generation;
          button.disabled = true; status.textContent = 'Đang tải lời giải…';
          try {
            const response = await load();
            if (epoch !== generation) return;
            const review = response.review;
            if (review?.bundle?.testSlug !== testSlug || !review.bundle.skills?.[skill]?.entries?.[rows[i].number]) throw new Error('Lời giải chưa khớp câu hỏi.');
            trigger = button; context = { review, skill, title, answerLabel }; number = Number(rows[i].number);
            status.textContent = ''; render();
          } catch (error) {
            if (epoch !== generation) return;
            cached = null; status.textContent = `${error.message || 'Không tải được lời giải.'} Bấm để thử lại.`;
          } finally { button.disabled = false; }
        };
        cell.append(button, status); tr.append(cell);
      });
    });
  }
  function reset() {
    clearAudio(); player = null;
    generation++; activeAttempt = ''; cached = null; context = null; warmedGeneration = -1;
    if (dialog?.open) dialog.close();
    dialog?.replaceChildren(); trigger = null;
  }
  window.K67_ANSWER_EXPLANATIONS = Object.freeze({ attach, reset });
}());

// Nhận kết quả đã nộp từ màn kết quả; tải lời giải riêng theo mã lượt thi khi bấm xem.
// Dựng cửa sổ giống Reading/Listening thực chiến. Lỗi tải hiện tại nút, không đổi bài làm hay điểm.
(function () {
  'use strict';
  const supported = new Set(['term-test-1', 'term-test-2', 'mini-test-lesson-5']);
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[c]);
  let activeAttempt = '', cached, context, number, dialog, trigger, generation = 0;
  const scriptBase = new URL('.', document.currentScript.src);
  let player, reviewAudio, blobUrl = '', blobHash = '';
  const clock = ms => `${String(Math.floor(ms / 60000)).padStart(2, '0')}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;
  function replayButtons(clips) {
    return (clips || []).map((clip, i) => {
      const label = `▶ Nghe lại ${clips.length > 1 ? clip.label || 'đoạn ' + (i + 1) : 'dẫn chứng'}`;
      return `<div class="explanation-replay"><button type="button" class="explanation-replay-button" data-k67-replay="${escape(clip.id)}" data-replay-label="${escape(label)}" aria-pressed="false">${escape(label)}</button><span>${clock(clip.startMs)}–${clock(clip.endMs)} · tự dừng</span><span class="explanation-replay-status" role="status"></span></div>`;
    }).join('');
  }
  function clearAudio() {
    player?.dispose(); player = null;
    if (blobUrl) URL.revokeObjectURL(blobUrl);
    blobUrl = blobHash = '';
    if (reviewAudio) { reviewAudio.removeAttribute('src'); reviewAudio.load(); reviewAudio.remove(); reviewAudio = null; }
  }
  async function playClip(clip) {
    const review = context.review, descriptor = review.bundle.reviewAudio;
    if (!descriptor || !window.K67ReviewAudio) throw Error('Chưa tải đủ bộ phát nghe lại. Hãy tải lại trang.');
    if (!reviewAudio) {
      reviewAudio = document.createElement('audio'); reviewAudio.hidden = true; reviewAudio.preload = 'none';
      reviewAudio.dataset.k67ReviewAudio = ''; document.body.append(reviewAudio);
    }
    if (!player) player = new window.K67ReviewAudio(reviewAudio, { durationMs: descriptor.durationMs,
      prepare: async signal => {
        if (blobHash === descriptor.sha256 && blobUrl) return;
        if (!/^term-test-2-96kbps-[0-9a-f]{16}\.mp3$/.test(descriptor.asset)) throw Error('Sai nguồn audio');
        const response = await fetch(new URL('../k67-audio-assets/' + descriptor.asset, scriptBase), { signal, cache: 'force-cache' });
        if (!response.ok) throw Error('Không tải được audio');
        const bytes = await response.arrayBuffer();
        const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(b => b.toString(16).padStart(2, '0')).join('');
        if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
        if (hash !== descriptor.sha256) throw Error('Audio không khớp phiên bản lời giải');
        if (blobUrl) URL.revokeObjectURL(blobUrl);
        blobUrl = URL.createObjectURL(new Blob([bytes], { type: 'audio/mpeg' })); blobHash = hash; reviewAudio.src = blobUrl;
      },
      onState: ({ state, segment, message }) => {
        dialog?.querySelectorAll('[data-k67-replay]').forEach(button => {
          const active = button.dataset.k67Replay === segment?.id;
          button.setAttribute('aria-pressed', String(active && state === 'playing'));
          button.textContent = active && state === 'playing' ? '■ Dừng đoạn này' : active && state === 'loading' ? 'Hủy tải đoạn nghe' : button.dataset.replayLabel;
          button.parentNode.querySelector('.explanation-replay-status').textContent = active && state === 'playing' ? 'Đang phát · tự dừng khi hết đoạn' : '';
        });
        if (message) { const status = dialog?.querySelector('.explanation-replay-status'); if (status) status.textContent = message; }
      }
    });
    await player.play(clip);
  }
  const text = paragraphs => (paragraphs || []).map(p => p.map(r => r.text).join('')).join('\n');
  const colorClass = (prefix, color) => /^#[0-9a-f]{6}$/i.test(color || '') ? ` ex-${prefix}-${color.slice(1)}` : '';
  function paragraphs(value) {
    return (value || []).map(p => `<p>${p.map(r => {
      const classes = `${r.bold ? 'ex-bold' : ''}${r.italic ? ' ex-italic' : ''}${colorClass('fg', r.foreground)}${colorClass('bg', r.background)}`;
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
      if (event.target === dialog && pressedOutside && releasedOutside) dialog.close();
      pressedOutside = releasedOutside = false;
    });
    dialog.addEventListener('close', () => { player?.stop(); if (trigger?.isConnected) trigger.focus(); });
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
      const fragment = normalize(run.text);
      if (fragment.length < 4) continue;
      const at = normalized.indexOf(fragment);
      if (at < 0) continue;
      const start = positions[at], end = positions[at + fragment.length - 1] + 1;
      if (!ranges.some(r => start < r.end && end > r.start)) ranges.push({ start, end, color });
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
      .flatMap(t => t.split(/\[?\.\.\.\]?|[…]/)).map(normalize).filter(t => t.length >= 25);
    const candidates = [...pane.querySelectorAll('p, .cbt-passage-paragraph')];
    for (const p of candidates) {
      const body = normalize(p.textContent);
      if (excerpts.some(e => body.includes(e) || (body.length > 40 && e.includes(body)))) {
        p.classList.add('explanation-active-paragraph'); colorEvidence(p, entry.evidence);
      }
    }
    const first = pane.querySelector('.explanation-active-paragraph');
    if (first) pane.scrollTop = first.offsetTop - pane.offsetTop - 20;
  }
  function render() {
    player?.stop();
    const { review, skill } = context;
    const entries = review.bundle.skills[skill].entries;
    const numbers = Object.keys(entries).map(Number).sort((a, b) => a - b);
    const entry = entries[number];
    const row = review.result?.[skill]?.details?.find(r => Number(r.number) === number);
    const section = review.content[skill].sections[entry.section];
    const isReading = skill === 'reading';
    const sectionTitle = section.title || section.label;
    const correctAnswer = row?.correctAnswer || entry.answers.join(entry.pairNumbers ? ' + ' : ' / ');
    const studentAnswer = row?.studentAnswer ?? review.answers?.[skill]?.[number] ?? '';
    const outcome = ['correct', 'incorrect', 'blank'].includes(row?.result) ? row.result : 'unknown';
    const evidenceText = new Set(entry.evidence.map(p => text([p])));
    const excerptMap = new Map();
    Object.values(entries).filter(e => e.section === entry.section).forEach(e => e.blocks.forEach(b => {
      b.evidence.forEach(p => { const key = text([p]); if (key.trim()) excerptMap.set(key, p); });
    }));
    const left = isReading ? passageHtml(section.passageHtml) : [...excerptMap].map(([key, p]) =>
      `<div class="cbt-passage-paragraph${evidenceText.has(key) ? ' explanation-active-paragraph' : ''}">${paragraphs([p])}</div>`).join('');
    const analysis = entry.blocks.map(block => {
      const quotes = paragraphs(block.evidence);
      const primary = block.evidence.some(p => evidenceText.has(text([p])));
      return `<div class="explanation-source-block">${paragraphs(block.analysis)}${quotes
        ? primary ? `<blockquote>${quotes}${replayButtons(block.replay)}</blockquote>` : `<details class="explanation-option-quote"><summary>Xem trích dẫn</summary><blockquote>${quotes}${replayButtons(block.replay)}</blockquote></details>` : ''}</div>`;
    }).join('');
    const index = numbers.indexOf(number);
    const d = ensureDialog();
    d.innerHTML = `<div class="explanation-dialog-shell"><header class="explanation-dialog-header"><div><span class="kicker">${escape(context.title)} · ĐÁP ÁN VÀ GIẢI THÍCH</span><h2 id="explanation-dialog-title">Câu ${number} · ${escape(entry.type.replace(/^(Reading|Listening) - /, ''))}</h2></div><button type="button" class="explanation-dialog-close" data-explanation-close aria-label="Đóng giải thích">×</button></header><div class="explanation-dialog-columns"><section class="explanation-dialog-passage" aria-label="${isReading ? 'Bài đọc' : 'Trích transcript'}"><div class="explanation-dialog-pane-head"><strong>${isReading ? 'Bài đọc' : 'Trích transcript'} · ${escape(section.label)}</strong><span>Câu ${number}</span></div><div class="explanation-dialog-passage-scroll"><p class="passage-subtitle">${escape(sectionTitle)}</p>${left}</div></section><section class="explanation-dialog-detail" aria-label="Đáp án và giải thích"><div class="explanation-dialog-detail-scroll"><div class="explanation-dialog-answer"><span>Đáp án đúng <strong>${escape(correctAnswer)}</strong></span><span>${escape(context.answerLabel || 'Bài làm của bạn')} <strong>${escape(studentAnswer || '—')}</strong></span><span class="result-${outcome}">${outcome === 'correct' ? 'Đúng' : outcome === 'blank' ? 'Bỏ trống' : outcome === 'incorrect' ? 'Sai' : 'Chưa có dữ liệu từng câu'}</span></div>${entry.pairNumbers ? `<p class="explanation-dialog-hint">Câu ${entry.pairNumbers.join('–')} dùng chung lời giải; hai đáp án đúng không xét thứ tự. Kết quả từng câu giữ theo bài đã chấm.</p>` : ''}<h3>Đối chiếu ý trong đề và ${isReading ? 'bài đọc' : 'transcript'}</h3><p class="explanation-dialog-hint">Các màu giống nhau chỉ ý tương ứng, kể cả khi cách diễn đạt khác nhau.</p><div class="explanation-dialog-compare"><section><h4>Nội dung đề bài</h4>${paragraphs(entry.prompt)}</section><section><h4>Bằng chứng trong ${isReading ? 'bài đọc' : 'transcript'}</h4>${paragraphs(entry.evidence)}</section></div><section class="explanation-dialog-analysis"><h3>Giải thích chi tiết</h3>${analysis}</section></div></section></div><footer class="explanation-dialog-footer"><span>Câu ${index + 1}/${numbers.length}</span><nav aria-label="Chuyển câu giải thích"><button type="button" class="button outline" data-explanation-prev ${index === 0 ? 'disabled' : ''}>← Câu trước</button><button type="button" class="button outline" data-explanation-next ${index === numbers.length - 1 ? 'disabled' : ''}>Câu sau →</button></nav></footer></div>`;
    d.querySelector('[data-explanation-close]').onclick = () => d.close();
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
    requestAnimationFrame(() => {
      const pane = d.querySelector('.explanation-dialog-passage-scroll');
      if (isReading) markReadingEvidence(pane, entry);
      else { const first = pane.querySelector('.explanation-active-paragraph'); if (first) pane.scrollTop = first.offsetTop - pane.offsetTop - 20; }
    });
  }
  function attach({ container, payload, attemptToken, reviewKey = attemptToken, testSlug, title, request,
    loadReview, answerLabel = 'Bài làm của bạn' }) {
    if (!supported.has(testSlug) || !payload.completed || !reviewKey || (!attemptToken && !loadReview)) return;
    if (activeAttempt !== reviewKey) {
      clearAudio(); player = null;
      activeAttempt = reviewKey; cached = null; generation++;
      if (dialog?.open) dialog.close();
    }
    container.querySelectorAll('.detail-block').forEach(block => {
      const skill = block.dataset.skill?.toLowerCase();
      if (!['listening', 'reading'].includes(skill)) return;
      const table = block.querySelector('table');
      if (!table || table.dataset.explanationsAttached) return;
      table.dataset.explanationsAttached = 'true';
      const heading = document.createElement('th'); heading.textContent = 'Giải thích';
      table.querySelector('thead tr').append(heading);
      const rows = payload.result[skill]?.details || [];
      [...table.querySelectorAll('tbody tr')].forEach((tr, i) => {
        const cell = document.createElement('td'), button = document.createElement('button'), status = document.createElement('span');
        button.type = 'button'; button.className = 'explanation-open'; button.textContent = 'Xem giải thích';
        button.setAttribute('aria-label', `${skill === 'reading' ? 'Reading' : 'Listening'} câu ${rows[i].number}: Xem giải thích`);
        status.className = 'explanation-load-status'; status.setAttribute('role', 'status');
        if (dialog?.open && context?.skill === skill && Number(rows[i].number) === number) trigger = button;
        button.onclick = async () => {
          const epoch = generation;
          button.disabled = true; status.textContent = 'Đang tải lời giải…';
          try {
            if (!cached) cached = loadReview ? loadReview() : request('/api/term-tests/result/explanations', { method: 'POST',
              headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ attemptToken }) });
            const response = await cached;
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
    generation++; activeAttempt = ''; cached = null; context = null;
    if (dialog?.open) dialog.close();
    dialog?.replaceChildren(); trigger = null;
  }
  window.K67_ANSWER_EXPLANATIONS = Object.freeze({ attach, reset });
}());

(function () {
  'use strict';
  if (window.K67_LISTENING_PROTECTION) return;

  // Nhận player/phiên K67 thật; giữ bài trước khi gọi mạng, chỉ mở lại sau ACK phục hồi.
  // Mỗi yêu cầu thử lại giữ nguyên ID/payload. Lỗi telemetry không dừng audio đang nghe.
  window.K67_LISTENING_PROTECTION = function ({audio, session, slug, apiBase, generation = 0}) {
    if (session.audioProtocolVersion !== 1) return null;
    const token = session.examSessionToken;
    const key = `izone-k67-audio-incident:v1:${slug}:${token}:${generation}`;
    let stored = null;
    try { stored = JSON.parse(localStorage.getItem(key) || 'null'); } catch { /* UI báo hạn chế lưu khi ghi lỗi. */ }
    let snapshot = session, pending = stored?.pending || null;
    let held = Boolean(session.activeIncident || pending), stopped = false, suppressPause = false, armed = false;
    let incidentId = session.activeIncident?.incidentId || pending?.incidentId || '';
    let anchor = Number(session.activeIncident?.anchorSeconds ?? pending?.heardSeconds ?? audio.currentTime) || 0;
    let recovering = false, opening = null, sampleHeard = false;
    let panel, message, sampleButton, continueButton, reportButton, helpButton;
    let sampleAudio = null, sampleUrl = '', storageFailed = false, progressPending = false;
    let lastPosition = Number(audio.currentTime) || 0, lastAdvance = performance.now(), waitSince = 0;
    let resumeRequest = stored?.resumeRequest || null, lastMessage = '';
    const pause = () => { suppressPause = true; audio.pause(); suppressPause = false; };
    function persist() {
      try {
        if (held) localStorage.setItem(key, JSON.stringify({pending, resumeRequest}));
        else localStorage.removeItem(key);
      } catch { storageFailed = true; }
    }
    function notify() {
      window.dispatchEvent(new CustomEvent('term-test:listening-protection-updated', {detail: {held, ...snapshot}}));
      render();
    }
    function apply(value) {
      if (Number(value.audioRevision) < Number(snapshot.audioRevision || 0)) return false;
      snapshot = {...snapshot, ...value};
      if (value.needsTeacher) lastMessage = '';
      if (value.activeIncident) { incidentId = value.activeIncident.incidentId; anchor = value.activeIncident.anchorSeconds; }
      window.dispatchEvent(new CustomEvent('term-test:listening-timing-updated', {detail: snapshot}));
      return true;
    }
    async function request(suffix, data, retry = true) {
      // Dữ liệu chỉ gửi tới backend của phiên; lỗi quyền/xung đột không retry mù.
      const body = JSON.stringify({examSessionToken: token, generation, orderClientVersion: 1, ...data});
      for (let attempt = 0; ; attempt++) {
        try {
          const response = await fetch(`${apiBase}/api/term-tests/${slug}/session/${suffix}`, {
            method: 'POST', headers: {'Content-Type': 'application/json'}, body, signal: AbortSignal.timeout(2500)
          });
          const payload = await response.json();
          if (!response.ok) throw Object.assign(new Error(payload.message || 'Chưa kết nối được máy chủ.'), {status: response.status});
          return payload;
        } catch (error) {
          if (!retry || attempt >= 1 || (error.status && error.status < 500)) throw error;
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }
    }
    function render(copy) {
      if (!panel) return;
      if (copy !== undefined) lastMessage = copy;
      panel.hidden = !held;
      reportButton.disabled = held || stopped;
      const teacher = snapshot.needsTeacher;
      message.textContent = lastMessage || (teacher
        ? 'Bài đang được giữ. Bạn cần giáo viên hỗ trợ trước khi tiếp tục; hệ thống chưa thu bài.'
        : pending ? 'Đã giữ bài trên máy. Đang chờ kết nối để máy chủ xác nhận sự cố.'
          : 'Bài và mốc nghe đang được giữ. Kiểm âm lượng, đầu ra/tai nghe và đóng ứng dụng gọi/họp không cần thiết.');
      if (storageFailed) message.textContent += ' Chưa lưu được sự cố qua tải lại; hãy giữ trang này và nhờ giáo viên.';
      sampleButton.disabled = recovering || teacher;
      continueButton.disabled = recovering || teacher || !sampleHeard;
      helpButton.disabled = recovering;
    }
    async function synchronize() {
      if (opening) return opening;
      opening = (async () => {
        const value = pending ? await request('audio-incident', pending) : await request('audio-state', {});
        apply(value);
        if (!value.activeIncident) throw new Error('Chưa xác nhận được trạng thái giữ bài. Hãy nhờ giáo viên.');
        pending = null; lastMessage = ''; persist(); notify();
        return value;
      })();
      try { return await opening; } finally { opening = null; }
    }
    async function report(reason = 'manual') {
      if (stopped) return;
      if (!held) {
        held = true; sampleHeard = false; lastMessage = '';
        anchor = Math.max(0, Number(audio.currentTime) || 0); incidentId = crypto.randomUUID();
        const draft = window.K67_LISTENING_ADAPTER?.capture() || {};
        pending = {eventId: incidentId, incidentId, heardSeconds: anchor, reason, ...draft};
        pause(); persist(); notify();
        panel?.querySelector('h3')?.focus();
      }
      try { await synchronize(); }
      catch { render('Đã giữ bài trên máy, chưa nhận xác nhận từ máy chủ. Kiểm tra mạng rồi thử lại hoặc nhờ giáo viên.'); }
    }
    async function waitForAdvance() {
      const start = performance.now();
      while (performance.now() - start < 2000) {
        const advance = Number(audio.currentTime) - anchor;
        if (!audio.paused && advance >= 0.1 && advance <= 3) return Number(audio.currentTime);
        await new Promise(resolve => setTimeout(resolve, 40));
      }
      throw new Error('Audio chưa phát lại.');
    }
    function stopSample() {
      sampleAudio?.pause(); sampleAudio = null;
      if (sampleUrl) URL.revokeObjectURL(sampleUrl);
      sampleUrl = '';
    }
    async function resume(automatic = false) {
      if (recovering || stopped || !held || (!automatic && !sampleHeard)) return;
      recovering = true; render('Đang kiểm quyền tiếp tục và khôi phục mốc nghe...');
      try {
        // Nếu mất ACK confirm: đọc lại trước, không tạo lượt thử/bù lần nữa.
        if (resumeRequest) {
          const prior = await request('audio-state', {});
          apply(prior);
          resumeRequest = null; persist();
          if (!prior.activeIncident) {
            // Máy chủ đã đóng sự cố nhưng player hiện bị dừng: mở sự cố kế tiếp để giữ đúng thời gian.
            held = false; resumeRequest = null; pending = null; persist();
            await report('pause');
          }
        }
        await synchronize();
        if (snapshot.needsTeacher) return;
        const resumeAttemptId = crypto.randomUUID();
        const prepared = await request('audio-resume', {incidentId, resumeAttemptId, eventId: crypto.randomUUID(), phase: 'prepare', heardSeconds: anchor});
        apply(prepared); if (prepared.needsTeacher) return;
        stopSample(); pause();
        audio.currentTime = anchor;
        await audio.play();
        const heardSeconds = await waitForAdvance();
        resumeRequest = {incidentId, resumeAttemptId, eventId: crypto.randomUUID(), phase: 'confirm', heardSeconds};
        persist();
        const confirmed = await request('audio-resume', resumeRequest);
        apply(confirmed);
        if (confirmed.activeIncident) { pause(); return; }
        held = false; pending = null; resumeRequest = null; sampleHeard = false;
        lastPosition = audio.currentTime; lastAdvance = performance.now(); waitSince = 0;
        persist(); notify();
      } catch (error) {
        pause();
        render(`Bài vẫn được giữ. ${error.message} Hãy thử âm thanh hoặc nhờ giáo viên.`);
      } finally { recovering = false; render(); }
    }
    function attach(container) {
      if (panel) return;
      reportButton = document.createElement('button'); reportButton.type = 'button';
      reportButton.className = 'cbt-button'; reportButton.id = 'k67ReportAudio'; reportButton.textContent = 'Tôi không nghe được';
      container.append(reportButton);
      panel = document.createElement('section'); panel.className = 'cbt-audio-incident'; panel.id = 'k67AudioIncident';
      panel.setAttribute('aria-labelledby', 'k67AudioIncidentTitle');
      const title = document.createElement('h3'); title.id = 'k67AudioIncidentTitle'; title.tabIndex = -1; title.textContent = 'Đang giữ bài để kiểm tra âm thanh';
      message = document.createElement('p'); message.setAttribute('role', 'status');
      const controls = document.createElement('div'); controls.className = 'cbt-audio-controls';
      const button = (id, text) => { const node = document.createElement('button'); node.type = 'button'; node.id = id; node.className = 'cbt-button'; node.textContent = text; controls.append(node); return node; };
      sampleButton = button('k67TestSound', 'Thử âm thanh');
      continueButton = button('k67ResumeAudio', 'Tôi đã nghe được — tiếp tục');
      helpButton = button('k67AudioHelp', 'Cần giáo viên hỗ trợ');
      panel.append(title, message, controls); container.after(panel);
      reportButton.addEventListener('click', () => report('manual'));
      sampleButton.addEventListener('click', async () => {
        stopSample(); pause(); sampleHeard = false;
        // Mẫu thử chỉ là tiếng báo tạo tại máy, không chứa câu hỏi và không xin microphone.
        const samples = 8000, bytes = new ArrayBuffer(44 + samples * 2), view = new DataView(bytes);
        const text = (at, value) => [...value].forEach((c, i) => view.setUint8(at + i, c.charCodeAt(0)));
        text(0, 'RIFF'); view.setUint32(4, bytes.byteLength - 8, true); text(8, 'WAVEfmt ');
        view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
        view.setUint32(24, 8000, true); view.setUint32(28, 16000, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
        text(36, 'data'); view.setUint32(40, samples * 2, true);
        for (let i = 0; i < samples; i++) view.setInt16(44 + i * 2, Math.sin(i * 440 * Math.PI * 2 / 8000) * 2500 * Math.min(1, i / 100, (samples - i) / 100), true);
        sampleUrl = URL.createObjectURL(new Blob([bytes], {type: 'audio/wav'}));
        sampleAudio = new Audio(sampleUrl); sampleAudio.volume = audio.volume;
        try { await sampleAudio.play(); sampleHeard = true; render('Bạn có nghe rõ tiếng thử không? Nếu có, nhấn “Tôi đã nghe được — tiếp tục”.'); }
        catch { render('Trình duyệt chưa phát được mẫu thử. Kiểm âm lượng/tai nghe rồi nhấn thử lại.'); }
      });
      continueButton.addEventListener('click', () => resume(false));
      helpButton.addEventListener('click', () => { pause(); render('Giữ nguyên trang và báo giáo viên. Bài chưa được thu; giáo viên sẽ kiểm tra thiết bị và hướng dẫn cách tiếp tục.'); });
      if (held) { pause(); notify(); synchronize().catch(() => render()); }
      else notify();
    }
    async function automatic(reason) {
      if (!armed || held || stopped || recovering || document.getElementById('listeningView')?.dataset.listeningSubmitting === 'true') return;
      await report(reason);
      // Giới hạn thuộc chu kỳ tự phục hồi, không reset khi mất ACK buộc mở sự cố kế tiếp.
      for (let attempt = 0; held && !pending && !snapshot.needsTeacher && attempt < 2; attempt++) await resume(true);
    }
    audio.addEventListener('pause', () => { if (!suppressPause && !audio.ended) automatic('pause'); });
    audio.addEventListener('waiting', () => { waitSince ||= performance.now(); });
    audio.addEventListener('stalled', () => { waitSince ||= performance.now(); });
    audio.addEventListener('error', () => automatic('error'));
    const watchdog = setInterval(() => {
      if (!armed || held || stopped || recovering || audio.ended || document.getElementById('listeningView')?.hidden) return;
      if (audio.currentTime > lastPosition + 0.05) { lastPosition = audio.currentTime; lastAdvance = performance.now(); waitSince = 0; }
      else if (audio.paused || performance.now() - lastAdvance > 2000) automatic(audio.paused ? 'pause' : 'stalled');
    }, 500);
    const progress = setInterval(async () => {
      if (!armed || held || stopped || progressPending || audio.paused || audio.ended) return;
      progressPending = true;
      try {
        const value = await request('audio-progress', {heardSeconds: audio.currentTime, state: 'playing'}, false);
        if (!apply(value)) return;
        if (snapshot.activeIncident) { held = true; pause(); notify(); }
      } catch { /* Nhịp sau sẽ gửi mốc mới; không pause vì lỗi API tiến độ. */ }
      finally { progressPending = false; }
    }, 5000);
    const online = () => { if (held) synchronize().catch(() => render()); };
    window.addEventListener('online', online);
    function stop() { stopped = true; pause(); stopSample(); clearInterval(watchdog); clearInterval(progress); window.removeEventListener('online', online); }
    if (held) pause();
    return {attach, report, stop, arm: () => {armed = true; lastAdvance = performance.now();}, isHeld: () => held, getSnapshot: () => ({held, ...snapshot})};
  };
}());

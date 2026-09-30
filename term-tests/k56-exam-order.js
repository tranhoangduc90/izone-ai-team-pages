// Thứ tự chỉ thay hành trình, không nằm trong khóa storage hoặc identity của lượt thi.
window.K56_EXAM_ORDER = Object.freeze({
  requested: () => new URLSearchParams(window.location.search).get('mode') || 'lis_first',
  skills: mode => mode === 'read_first' ? ['reading', 'listening'] : ['listening', 'reading'],
  deadlineGuard: (state, elements) => {
    if (document.body.classList.contains('cbt-mode')) return;
    if (elements.k56GuardTimer) return;
    let lastSubmit = 0;
    elements.k56GuardTimer = window.setInterval(() => {
      const skill = state.stage;
      if (!['listening', 'reading'].includes(skill)) return;
      const deadline = Date.parse(state[skill + 'DeadlineAt']);
      if (!Number.isFinite(deadline)) return;
      const form = elements[skill + 'View'];
      const button = elements[skill === 'listening' ? 'submitListening' : 'submitReading'];
      let clock = form.querySelector('.k56-server-clock');
      if (!clock) { clock = document.createElement('p'); clock.className = 'k56-server-clock'; clock.setAttribute('role', 'timer'); form.prepend(clock); }
      const seconds = Math.max(0, Math.ceil((deadline - Date.now() - (Number(state.serverTimeOffsetMs) || 0)) / 1000));
      clock.textContent = `Còn ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
      if (!seconds && !button.disabled && Date.now() - lastSubmit > 5000) {
        lastSubmit = Date.now(); button.dataset.autoSubmit = 'true'; form.requestSubmit(button);
      }
    }, 500);
  },
  apply: (state, response) => {
    const mode = response.examMode || 'lis_first';
    const url = new URL(window.location.href);
    const changed = (url.searchParams.get('mode') || 'lis_first') !== mode;
    url.searchParams.set('mode', mode);
    window.history.replaceState(window.history.state, '', url.href);
    Object.assign(state, {
      examMode: mode, nextSection: response.nextSection,
      attemptToken: response.attemptToken, examSessionToken: response.examSessionToken || '',
      studentName: response.studentName || state.studentName,
      listeningSubmitted: Boolean(response.listeningSubmitted), readingSubmitted: Boolean(response.readingSubmitted),
      listeningStartedAt: response.listeningStartedAt || '', listeningDeadlineAt: response.listeningDeadlineAt || '',
      readingStartedAt: response.readingStartedAt || '', readingDeadlineAt: response.readingDeadlineAt || '',
      writingStartedAt: response.writingStartedAt || '', writingDeadlineAt: response.writingDeadlineAt || '',
      completed: Boolean(response.completed), writingStarted: Boolean(response.writingStartedAt),
      writingSubmitted: Boolean(response.writingSubmittedAt),
      serverTimeOffsetMs: Date.parse(response.serverNow) - Date.now()
    });
    return changed;
  }
});

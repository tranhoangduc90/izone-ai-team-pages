// Mô phỏng phản hồi ngay trong tab. Nút lưu/nộp chỉ thay trạng thái demo, không gọi API thật.
(() => {
  const query = new URLSearchParams(location.search), cfg = window.DESIGN_DEMO_CONTENT, slug = cfg.baseTestSlug;
  const screen = query.get('screen') || 'listening', now = () => new Date().toISOString(), later = m => new Date(Date.now() + m * 60000).toISOString();
  const ref = '11111111-1111-4111-8111-111111111111', attempt = '22222222-2222-4222-8222-222222222222', token = '33333333-3333-4333-8333-333333333333';
  const mockBase = new URL('mock-api', location.href).href;
  const state = { completed: ['result', 'writing'].includes(screen), listeningSubmitted: ['reading', 'writing', 'result'].includes(screen), writingStarted: ['writing', 'result'].includes(screen), writingSubmitted: screen === 'result', listening: {}, reading: {}, revision: 0, readingDeadlineAt: later(48), writingDeadlineAt: later(42), task1: '', task2: '', plans: {} };
  const essays = {
    task1: 'The chart compares the number of visitors to a community learning centre in January, February and March. Overall, attendance increased over the period, with the largest rise occurring in the final month.\n\nIn January, the centre welcomed 120 visitors. This figure rose to 180 in February, an increase of 60. By March, attendance had reached 300, which was more than twice the January figure. The growth may reflect increasing awareness of the programme, although the chart does not explain the reasons for this change.',
    task2: 'Community learning centres can give residents an accessible place to develop practical skills and meet people with similar interests. In my view, their main benefits are the opportunities for learning and the sense of connection they create.\n\nFirst, a local centre can make informal education easier to access. People who cannot attend a full course may still be able to join a short workshop after work. For example, a beginner could practise a language with volunteers or learn how to repair a household item. These activities offer an achievable first step and may encourage further study.\n\nA second benefit is social contact. Working on a shared project gives residents a reason to speak to people outside their usual circle. This can be particularly helpful for someone who has recently moved to the area. However, the centre must offer activities at different times so that working adults and families can take part.\n\nTo attract more visitors, towns should publish a clear timetable and invite residents to suggest topics. A free introductory session could also reduce uncertainty for new participants. In conclusion, a well-run learning centre can support both education and community life when its programme responds to local needs.'
  };
  if (screen === 'result') Object.assign(state, essays);
  function section(skill) {
    const controls = window.TERM_TEST_CONFIG[skill].controls, total = controls.length, correct = Math.floor(total * .75);
    return { correct, total, answered: total, band: 6.5, details: controls.map((q, i) => ({ number: q.number, studentAnswer: i < correct ? 'Mẫu A' : 'Mẫu B', correctAnswer: 'Minh họa', correct: i < correct, result: i < correct ? 'correct' : 'incorrect', type: 'multiple_choice' })), typeStats: [{ type: 'multiple_choice', label: 'Multiple choice', correct, total, percentage: correct / total }] };
  }
  const dimensions = [
    ['Phát triển và đáp ứng yêu cầu', 'Bài đã nêu hai lợi ích rõ và có hướng đề xuất phù hợp. Phần giải thích vì sao người mới ngại tham gia còn ngắn.', 'Sau ý về buổi giới thiệu, hãy giải thích rào cản cụ thể: người mới chưa biết mức độ khó, cần chuẩn bị gì hoặc có thể đi một mình hay không. Liên kết giải pháp với rào cản đó sẽ làm lập luận thuyết phục hơn.'],
    ['Liên kết và tổ chức ý', 'Các đoạn có trọng tâm riêng, trình tự lợi ích rồi đến giải pháp dễ theo dõi.', 'Ở đầu đoạn giải pháp, thêm một câu nối với khó khăn vừa nêu. Tránh chỉ dùng các từ nối như “first” hoặc “second”; hãy cho người đọc thấy quan hệ nguyên nhân và kết quả giữa các ý.'],
    ['Độ chính xác của từ vựng', 'Từ vựng phù hợp chủ đề, các cụm “accessible place” và “shared project” được dùng tự nhiên.', 'Kiểm tra những chỗ lặp “centre” và “activities”. Chỉ thay bằng từ khác khi nghĩa vẫn chính xác; có thể dùng đại từ hoặc thay cấu trúc câu để giảm lặp mà không làm câu khó đọc.'],
    ['Cấu trúc và độ chính xác của câu', 'Bài có kết hợp câu đơn và câu phức; nội dung nhìn chung rõ nghĩa.', 'Đọc lại từng câu có “which”, “when” và “so that”: xác định chúng bổ nghĩa cho ý nào. Sau đó kiểm tra sự thống nhất giữa chủ ngữ và động từ, dấu phẩy và cách chia thì.']
  ];
  function result() {
    const listening = section('listening'), reading = section('reading');
    return { ...base(), portalSyncStatus: 'not_applicable', result: state.completed ? { testTitle: cfg.title, listening, reading, summary: { totalCorrect: listening.correct + reading.correct, totalQuestions: listening.total + reading.total, averageBand: 6.5 }, typeStats: listening.typeStats, performance: { best: listening.typeStats, needsImprovement: reading.typeStats } } : null, writing: cfg.writing ? { started: state.writingStarted, submitted: state.writingSubmitted, task1: state.task1, task2: state.task2, revision: state.revision, grading: state.writingSubmitted ? { ready: true, status: 'ready', writingScore: 6.5, task1Score: 6.5, task2Score: 6.5, tasks: cfg.writing.tasks.map(t => ({ taskNumber: Number(t.id.slice(-1)), taskScore: 6.5, wordCount: (state[t.id] || '').split(/\s+/).length, report: 'Nhận xét minh họa do người thiết kế chuẩn bị để thử giao diện; không phải kết quả chấm bài thực tế.', criteria: dimensions.map(([label, summary, feedback], i) => ({ code: [t.id === 'task1' ? 'TA' : 'TR', 'CC', 'LR', 'GRA'][i], name: label, bandScore: 6.5, feedback: summary, components: [{ code: 'demo_' + i, label, summary, feedback }] })) })) } : { ready: false, status: 'processing', tasks: [] } } : null };
  }
  function base() { return { ok: true, studentRef: ref, studentName: 'Học viên minh họa', className: 'DEMO67', attemptToken: attempt, examSessionToken: token, serverNow: now(), content: cfg, completed: state.completed, listeningSubmitted: state.listeningSubmitted, listeningDraft: state.listening, readingDraft: state.reading, readingDeadlineAt: state.readingDeadlineAt, listeningDeadlineAt: later(25), readingStartedAt: state.listeningSubmitted ? now() : null, exam: { readingDeadlineAt: state.readingDeadlineAt } }; }
  window.TERM_TEST_APP_CONFIG = Object.freeze({ API_BASE_URL: mockBase, AUTH_MODE: 'preview' });
  window.DESIGN_PREVIEW_SCREEN = screen; window.DESIGN_PREVIEW_REAL = false;
  for (const storage of [localStorage, sessionStorage]) { storage.removeItem(`izone-test:${slug}:DEMO67`); storage.removeItem(`izone-test-ui:${slug}:DEMO67`); }
  if (!['lobby', 'answer-sheet'].includes(screen)) {
    window.TERM_TEST_CONTENT = cfg;
    window.TERM_TEST_BOOTSTRAP = { examSessionToken: token, serverNow: now(), listeningDeadlineAt: later(25), skipListeningAudio: true };
    const seed = { studentRef: ref, studentName: 'Học viên minh họa', examSessionToken: token, attemptToken: screen === 'listening' ? '' : attempt, listeningStartedAt: now(), listeningDeadlineAt: later(25), readingDeadlineAt: screen === 'reading' ? state.readingDeadlineAt : '', completed: state.completed, listeningSubmitted: state.listeningSubmitted, writingStarted: state.writingStarted, writingSubmitted: state.writingSubmitted, writingDeadlineAt: state.writingDeadlineAt, drafts: { listening: {}, reading: {}, writing: { task1: state.task1, task2: state.task2, outline: '' } } };
    for (const storage of [localStorage, sessionStorage]) { storage.setItem(`izone-test:${slug}:DEMO67`, JSON.stringify(seed)); storage.removeItem(`izone-test-ui:${slug}:DEMO67`); }
  }
  const nativeFetch = window.fetch.bind(window);
  const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
  window.fetch = async (input, init = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url, location.href);
    if (!url.href.startsWith(mockBase + '/')) {
      if (url.origin !== location.origin || /\/api\//.test(url.pathname)) return json({ error: 'DEMO_EXTERNAL_REQUEST_BLOCKED' }, 403);
      return nativeFetch(input, init);
    }
    const endpoint = url.pathname.slice(new URL(mockBase).pathname.length + 1);
    if (endpoint === 'fixture-audio') return nativeFetch(new URL('assets/sample.wav', location.href));
    let body = {}; try { body = JSON.parse(init.body || '{}'); } catch {}
    if (endpoint.endsWith('roster')) return json({ ok: true, class: { name: 'DEMO67', id: 1 }, students: [{ ref, name: 'Học viên minh họa' }] });
    if (endpoint.endsWith('classes')) return json({ ok: true, classes: [{ name: 'DEMO67' }] });
    if (endpoint.endsWith('writing/planning')) { const taskNumber = Number(body.taskNumber); const plan = state.plans[taskNumber] ||= { taskNumber, outline: '', revision: 0, startedAt: now(), deadlineAt: later(taskNumber === 1 ? 5 : 10) }; if (body.action === 'save') { plan.outline = String(body.outline || ''); plan.revision = Number(body.revision) || 0; } return json({ ok: true, accepted: true, planning: plan, serverNow: now() }); }
    if (endpoint.endsWith('attempt/active')) return json({ ok: true, active: false });
    if (endpoint.endsWith('/writing')) { state.task1 = body.task1 || ''; state.task2 = body.task2 || ''; state.revision = Number(body.revision) || 0; state.writingStarted = true; state.writingSubmitted = body.action === 'submit'; return json({ ...base(), writing: { accepted: true, revision: state.revision, task1: state.task1, task2: state.task2, started: true, submitted: state.writingSubmitted, deadlineAt: state.writingDeadlineAt } }); }
    if (endpoint.endsWith('draft')) { const skill = body.skill || body.section || (/reading/.test(endpoint) ? 'reading' : 'listening'); state[skill] = { ...(body.answers || body.draft || {}) }; return json({ ...base(), accepted: true, revision: body.revision || 1, draft: state[skill] }); }
    if (endpoint.endsWith('result/stream')) return json({ error: 'DEMO_POLL' }, 404);
    if (endpoint.endsWith('result')) return json(result());
    if (endpoint.endsWith('listening')) { state.listeningSubmitted = true; return json({ ...base(), listeningSubmitted: true }); }
    if (endpoint.endsWith('reading')) { state.completed = true; return json({ ...base(), completed: true }); }
    if (endpoint.endsWith('open')) return json({ ...base(), attemptMode: 'answer_sheet', policy: { timed: false, autoSubmit: false }, generation: 0, listeningDraftRevision: 0, readingDraftRevision: 0, readingDeadlineAt: null });
    if (endpoint.includes('session/prepare')) return json({ ...base(), attemptToken: '', listeningSubmitted: false, completed: false, encryptedAudioUrl: '/fixture-audio', previewAudioUrl: '/fixture-audio', listeningStartedAt: null });
    return json({ ...base(), writing: { started: state.writingStarted, submitted: state.writingSubmitted, deadlineAt: state.writingDeadlineAt } });
  };
})();

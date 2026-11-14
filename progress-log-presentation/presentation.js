/* Phím trình chiếu điều khiển các thao tác trên chính màn giảng viên. */
(async () => {
  const base = window.progressPresentation.base;
  const { createPresentationHistory } = await import(new URL('presentation-history.js', base));
  const lesson = window.presentationData;
  const root = document.documentElement;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const layer = document.createElement('div');
  layer.className = 'presenter-layer';
  layer.setAttribute('aria-hidden', 'true');
  const focus = document.createElement('div');
  focus.className = 'presenter-focus';
  const pointer = document.createElement('div');
  pointer.className = 'presenter-pointer';
  const arrow = document.createElement('span');
  arrow.className = 'presenter-arrow';
  const ripple = document.createElement('span');
  ripple.className = 'presenter-ripple';
  pointer.append(arrow, ripple);
  layer.append(focus, pointer);
  document.body.append(layer);
  let frame;
  let frameObserver;
  const activeDocument = () => frame?.contentDocument || document;
  const select = selector => activeDocument().querySelector(selector);
  const findText = (selector, value) => [...activeDocument().querySelectorAll(selector)]
    .find(element => visible(element) && element.textContent.trim() === value);
  const findContaining = (selector, value) => [...activeDocument().querySelectorAll(selector)]
    .find(element => visible(element) && element.textContent.includes(value));
  const visible = element => Boolean(element?.getClientRects().length);
  const classCard = () => [...document.querySelectorAll('.thuy-class-card')]
    .find(card => card.querySelector('b')?.textContent === lesson.targetClass);
  const home = () => [...document.querySelectorAll('.thuy-side button')].find(button => button.textContent === 'Quản lý lớp');
  const search = () => select('#teacherClassPortal input[type=search]');
  const session = () => select('#assignmentSelect');
  const header = () => select('.thuy-session-header');
  const part = () => select('#blockControls .block-control');
  const openButton = () => part()?.querySelector('button[aria-label="Mở phần 1"]');
  const closeButton = () => part()?.querySelector('button[aria-label="Đóng phần 1"]');
  const teacherRow = () => select('.thuy-roster tr[data-student="' + lesson.studentRef + '"]');
  const learnerStart = () => findText('#formView .thuy-part button', 'Bắt đầu làm');
  const learnerChoice = () => select('[data-item-version-id="' + lesson.firstQuestion + '"] label:has(input[value=A])');
  const learnerInput = () => select('[data-item-version-id="' + lesson.reflectionQuestion + '"] textarea');
  const learnerSubmit = () => select('#formView [data-thuy-submit]');
  const question = () => select('.thuy-question-select[data-item-id="' + lesson.firstQuestion + '"]');
  const responseRow = () => findContaining('.thuy-responses-table tbody tr', lesson.studentName);
  const editorInput = () => select('#draftDialog .session-comment-editor textarea:not(:disabled)');
  const currentSession = () => select('#journeyView .studentSessionCard[data-session-number="7"]');
  const sentComment = () => findContaining('#thuyStudentJourneySkills .thuy-skill-block', lesson.feedback);
  const skills = () => select('#thuyStudentJourneySkills .thuy-four-skills');
  const previousSession = () => select('#journeyView button.studentSessionCard[data-session-number="6"]');
  const history = () => select('#journeyDetailDialog[open]');
  const overview = () => findText('[role=tab]', 'Tổng quan lớp');
  const personal = () => findText('[role=tab]', 'Nhận xét cá nhân');
  const results = () => select('[data-thuy-mode=results]');
  const editor = () => select('#draftDialog .session-comment-editor');
  const send = () => findText('#draftDialog button', 'Gửi cho học viên');
  const closeHistory = () => findText('#journeyDetailDialog button', 'Đóng chi tiết');
  const progress = () => select('#formView .thuy-progress');
  const questionCard = () => select('.thuy-question-detail .thuy-question-card');
  const detailComment = () => findContaining('#journeyDetailDialog .session-comment', lesson.feedback);
  const responseFilter = () => select('[data-response-filter=incorrect]');
  const library = () => select('#createTab');
  const personalLibrary = () => findContaining('#formDraftEditor button', 'Kho cá nhân');
  const newExercise = () => findText('#formDraftEditor button', '+ Tạo bài tập');
  const addQuestion = () => findText('#formDraftEditor button', '+ Trắc nghiệm');
  const exerciseName = () => select('#formDraftEditor [aria-label="Tên bài tập"]');
  const manualQuestion = () => select('#formDraftEditor .thuy-editor-question');
  const questionText = () => manualQuestion()?.querySelector('[aria-label="Nội dung câu hỏi"]');
  const choiceA = () => select('#formDraftEditor [aria-label="Lựa chọn A câu 1"]');
  const choiceB = () => select('#formDraftEditor [aria-label="Lựa chọn B câu 1"]');
  const choiceC = () => select('#formDraftEditor [aria-label="Lựa chọn C câu 1"]');
  const choiceD = () => select('#formDraftEditor [aria-label="Lựa chọn D câu 1"]');
  const keyB = () => select('#formDraftEditor [aria-label="Đáp án đúng B câu 1"]');
  const skill = () => select('#formDraftEditor [aria-label="Kỹ năng câu 1"]');
  const save = () => findText('#formDraftEditor button', 'Lưu nháp');
  const saved = () => findText('#formDraftEditor .thuy-editor-save-state', 'Đã lưu nháp');
  const aiButton = () => select('#formDraftEditor [data-ai-target-block]');
  const aiDialog = () => select('dialog.thuy-editor-ai[open]');
  const aiInput = () => aiDialog()?.querySelector('textarea[aria-label="Nội dung câu hỏi có sẵn"]');
  const createAI = () => findText('dialog.thuy-editor-ai[open] button', 'Tạo bài');
  const imported = () => [...activeDocument().querySelectorAll('.thuy-editor-question')].find(
    card => card.querySelector('[aria-label="Nội dung câu hỏi"]')?.value === lesson.aiQuestion,
  );
  let step = 0;
  let liveStep = 0;
  let motion;
  let target;
  let pointerAnchor;
  let anchoredElement;
  let presenter;
  let cursor = { x: 0, y: 0 };
  const screens = createPresentationHistory(onKey);
  let liveModal = null;
  root.dataset.presentationStep = '0';

  async function waitFor(find) {
    const until = performance.now() + 6000;
    do {
      const element = find();
      if (element) return element;
      await new Promise(resolve => setTimeout(resolve, 25));
    } while (performance.now() < until);
    throw new Error('Chưa tải được màn hình của bước này.');
  }

  function pause(ms) {
    if (!motion || motion.signal.aborted || reducedMotion.matches) return Promise.resolve();
    return new Promise(resolve => {
      const signal = motion.signal;
      const timer = setTimeout(finish, ms);
      function finish() {
        clearTimeout(timer);
        signal.removeEventListener('abort', finish);
        resolve();
      }
      signal.addEventListener('abort', finish, { once: true });
    });
  }

  function positionFocus() {
    const element = target?.();
    if (!visible(element)) {
      focus.classList.remove('visible');
      if (pointerAnchor) pointer.classList.remove('visible');
      return;
    }
    const rect = screenRect(element);
    const left = Math.max(4, rect.left - 5);
    const top = Math.max(4, rect.top - 5);
    const width = Math.min(innerWidth - 4, rect.right + 5) - left;
    const height = Math.min(innerHeight - 4, rect.bottom + 5) - top;
    focus.classList.toggle('visible', width > 0 && height > 0);
    Object.assign(focus.style, {
      left: left + 'px', top: top + 'px', width: Math.max(0, width) + 'px', height: Math.max(0, height) + 'px',
    });
    if (pointerAnchor === target && width > 0 && height > 0) {
      placePointer(pointAt(element));
      if (element !== anchoredElement) {
        anchoredElement = element;
        if (element.ownerDocument.hasFocus()) focusControl(element);
      }
    }
  }

  // Tìm lại khối sau mỗi lần renderer thay nút trong lượt đọc định kỳ.
  function highlight(find, typing = false) {
    pointerAnchor = null;
    anchoredElement = null;
    target = find;
    focus.classList.toggle('typing', typing);
    positionFocus();
  }
  const observer = new MutationObserver(positionFocus);
  observer.observe(document.querySelector('#teacherWorkspace'), { childList: true, subtree: true });
  const monitorModal = new MutationObserver(() => {
    const modal = document.querySelector('dialog:modal');
    if (modal === liveModal) return;
    liveModal = modal;
    if (layer.matches(':popover-open')) layer.hidePopover();
    if (modal) {
      layer.setAttribute('popover', 'manual');
      layer.showPopover();
      screens.raise();
    } else layer.removeAttribute('popover');
  });
  monitorModal.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['open'] });
  window.addEventListener('resize', positionFocus);
  document.addEventListener('scroll', positionFocus, { capture: true, passive: true });

  function screenRect(element) {
    const rect = element.getBoundingClientRect();
    if (element.ownerDocument === document || !frame) return rect;
    const offset = frame.getBoundingClientRect();
    return { top: rect.top + offset.top, bottom: rect.bottom + offset.top, left: rect.left + offset.left,
      right: rect.right + offset.left, width: rect.width, height: rect.height };
  }

  function pointAt(element) {
    const rect = screenRect(element);
    return { x: rect.left + Math.min(rect.width * .52, 170), y: rect.top + rect.height * .55 };
  }

  function placePointer(point) {
    cursor = point;
    pointer.style.transform = 'translate(' + point.x + 'px, ' + point.y + 'px)';
    pointer.classList.add('visible');
  }

  async function moveTo(element, animate) {
    element.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
    const to = pointAt(element);
    if (animate && motion && !motion.signal.aborted && !reducedMotion.matches) {
      if (!pointer.classList.contains('visible')) {
        placePointer({ x: Math.max(16, to.x - 82), y: Math.max(16, to.y - 24) });
      }
      const travel = pointer.animate(
        [{ transform: 'translate(' + cursor.x + 'px, ' + cursor.y + 'px)' },
          { transform: 'translate(' + to.x + 'px, ' + to.y + 'px)' }],
        { duration: 460, easing: 'cubic-bezier(.22,.75,.26,1)' },
      );
      const signal = motion.signal;
      const skip = () => travel.finish();
      signal.addEventListener('abort', skip, { once: true });
      await travel.finished;
      signal.removeEventListener('abort', skip);
    }
    placePointer(to);
  }

  const control = find => waitFor(() => {
    const element = find();
    return visible(element) && !element.disabled && element;
  });

  function focusControl(element) {
    const node = element.matches('label') ? element.control || element : element;
    node.focus({ preventScroll: true });
  }

  async function aim(find, animate, typing = false) {
    const element = await control(find);
    highlight(find, typing);
    await moveTo(element, animate);
    anchoredElement = await control(find);
    focusControl(anchoredElement);
    pointerAnchor = find;
    positionFocus();
  }

  async function click(find, animate) {
    const element = await control(find);
    if (animate) {
      highlight(find);
      placePointer(pointAt(element));
      if (!motion.signal.aborted && !reducedMotion.matches) {
        ripple.animate([{ opacity: .9, scale: '.35' }, { opacity: 0, scale: '1.65' }], { duration: 420 });
      }
    }
    // Đọc lại control nếu cập nhật nền vừa thay nút.
    (await control(find)).click();
    if (animate) {
      await pause(250);
      pointer.classList.remove('visible');
    }
  }

  async function keepAttention(find, animate) {
    const element = await waitFor(() => visible(find()) && find());
    const rect = screenRect(element);
    const outsideReadingArea = rect.top < 82 || rect.bottom > innerHeight - 32;
    if (outsideReadingArea) element.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
    if (animate) {
      pointer.classList.remove('visible');
      highlight(find);
    }
  }

  function showTeacher() {
    highlight(null);
    pointer.classList.remove('visible');
    frameObserver?.disconnect();
    frame?.remove();
    frame = null;
    window.focus();
    root.classList.remove('presenter-showing-student');
    scrollTo(0, 0);
  }

  async function showStudent(path) {
    showTeacher();
    document.querySelector('#draftDialog[open]')?.close();
    const nextFrame = document.createElement('iframe');
    nextFrame.className = 'presenter-student';
    nextFrame.title = 'Progress Log';
    nextFrame.src = new URL(path, base);
    frame = nextFrame;
    root.classList.add('presenter-showing-student');
    document.body.append(nextFrame);
    await waitFor(() => nextFrame.contentDocument?.getElementById(path.startsWith('journey') ? 'journeyView' : 'identityView'));
    nextFrame.contentWindow.addEventListener('keydown', onKey, true);
    nextFrame.contentDocument.addEventListener('scroll', positionFocus, { capture: true, passive: true });
    frameObserver = new MutationObserver(positionFocus);
    frameObserver.observe(nextFrame.contentDocument.body, { childList: true, subtree: true });
    nextFrame.contentWindow.focus();
  }

  async function typeText(find, value, animate, pace = 35) {
    const input = await control(find);
    if (animate) {
      input.focus({ preventScroll: true });
      highlight(find, true);
    }
    input.value = '';
    for (const character of animate ? Array.from(value) : [value]) {
      input.value += character;
      input.dispatchEvent(new input.ownerDocument.defaultView.InputEvent('input', {
        bubbles: true, data: character, inputType: 'insertText',
      }));
      if (animate) await pause(pace);
    }
    if (animate) await pause(210);
    input.blur();
    if (animate) {
      pointer.classList.remove('visible');
      highlight(find);
    }
  }

  async function refreshTeacher(predicate) {
    const refresh = document.querySelector('#refreshDashboardButton');
    refresh.click();
    await waitFor(predicate);
  }

  const point = (id, label, after, run) => ({ id, label, after, run });
  const pair = (id, label, find, run, after, typing = false) => [
    { id: id + '-aim', label: 'Dừng ở ' + label, find, typing },
    point(id, (typing ? 'Gõ vào ' : 'Thao tác tại ') + label, after, run),
  ];
  const press = (id, label, find, after, wait) =>
    pair(id, label, find, async animate => {
      await click(find, animate);
      if (wait) await waitFor(wait);
    }, after);
  const type = (id, label, find, value, pace = 26) =>
    pair(id, label, find, animate => typeText(find, value, animate, pace), find, true);
  const choose = (id, label, find, value, after, wait) =>
    pair(id, label, find, async () => {
      const picker = await control(find);
      picker.value = value;
      picker.dispatchEvent(new picker.ownerDocument.defaultView.Event('change', { bubbles: true }));
      picker.blur();
      if (wait) await waitFor(wait);
    }, after);

  // Mỗi cảnh giữ các nhịp theo thứ tự. Nhịp đưa con trỏ không kích hoạt control.
  const authoringScenes = [
    [
      point('teacher-authoring', 'Trở về vai giảng viên', library, showTeacher),
      ...press('library', 'Quản lý bài tập', library, personalLibrary, personalLibrary),
      ...press('personal-library', 'Kho cá nhân', personalLibrary, newExercise, newExercise),
      ...press('create', 'nút Tạo bài tập', newExercise, exerciseName, exerciseName),
      ...type('title', 'tên bài tập', exerciseName, 'Listening · Nghe ngày và giờ'),
      ...press('mcq', 'dạng Trắc nghiệm', addQuestion, questionText, questionText),
      ...choose('skill', 'kỹ năng của câu', skill, 'listening', skill),
      ...type('prompt', 'nội dung câu hỏi', questionText, 'What time does the class start?'),
      ...type('option-a', 'phương án A', choiceA, '8:00'),
      ...type('option-b', 'phương án B', choiceB, '8:30'),
      ...type('option-c', 'phương án C', choiceC, '9:00'),
      ...type('option-d', 'phương án D', choiceD, '9:30'),
      ...press('key', 'đáp án đúng B', keyB, () => keyB()?.closest('.thuy-editor-option'), () => keyB()?.checked),
      ...press('save', 'nút Lưu nháp', save, saved, saved),
    ],
    [
      ...press('ai', 'nút Tạo bài tập bằng AI', aiButton, aiInput, aiInput),
      ...type('source', 'ô nội dung câu hỏi có sẵn', aiInput, lesson.aiSource, 18),
      ...press('ai-create', 'nút Tạo bài', createAI, imported, () => saved() && !aiDialog() && imported()),
    ],
  ];
  const scenes = [
    [
      ...type('search', 'ô Tìm lớp', search, lesson.targetClass, 125),
      ...press('class', 'thẻ lớp ' + lesson.targetClass, classCard, header, () => visible(header()) && openButton()),
      ...choose('session', 'bộ chọn buổi học', session, lesson.targetAssignment, header,
        () => select('#dashboardTitle')?.textContent === lesson.targetTitle && openButton()),
    ],
    [...press('open', 'nút Mở phần Listening', openButton, part, closeButton)],
    [
      point('student', 'Chuyển sang màn học viên', () => select('#progressLogStudentName'), async () => {
        sessionStorage.setItem('izone:progress-log:selection-handoff:v1', JSON.stringify({
          classId: '9041', studentRef: lesson.studentRef, remember: false, at: Date.now(),
          logoutEpoch: localStorage.getItem('izone:progress-log:logout:v1') || '0',
        }));
        await showStudent('thuy.html#assignment=' + lesson.publicToken + '&student=' + lesson.studentRef);
        await waitFor(() => visible(learnerStart()));
      }),
      ...press('start', 'nút Bắt đầu làm', learnerStart, () => learnerChoice()?.closest('[data-item-version-id]'), learnerChoice),
    ],
    [
      ...press('choice', 'phương án Friday', learnerChoice, learnerChoice, () => learnerChoice()?.querySelector('input')?.checked),
      ...pair('reflection', 'ô trả lời mở', learnerInput, animate => typeText(learnerInput, lesson.reflection, animate, 42), learnerInput, true),
    ],
    [...press('submit', 'nút Nộp phần này', learnerSubmit, progress, () => progress()?.textContent.includes('Đã nộp 1/2 phần'))],
    [point('teacher', 'Chuyển về bảng Tiến độ', teacherRow, async () => {
      showTeacher();
      await refreshTeacher(() => teacherRow()?.textContent.includes('Đã nhận bài'));
    })],
    [
      ...pair('result', 'nút Kết quả', results, async animate => {
        lesson.finishClass();
        await click(results, animate);
        await waitFor(overview);
      }, overview),
      ...press('overview', 'tab Tổng quan lớp', overview, questionCard, question),
    ],
    [
      ...press('question', 'câu có 5/8 học viên trả lời sai', question, responseRow, responseRow),
      ...press('filter', 'bộ lọc Sai', responseFilter, responseRow, () => responseFilter()?.getAttribute('aria-pressed') === 'true'),
    ],
    [
      ...press('personal', 'tab Nhận xét cá nhân', personal, teacherRow, () => visible(teacherRow())),
      ...press('row', 'hàng của ' + lesson.studentName, teacherRow, editor, editorInput),
      ...pair('feedback', 'ô nhận xét', editorInput, animate => typeText(editorInput, lesson.feedback, animate, 27), editorInput, true),
      ...press('send', 'nút Gửi cho học viên', send, editor, () => editor()?.textContent.includes('Đã gửi. Học viên đọc được')),
    ],
    [
      point('journey', 'Mở Hành trình cá nhân', sentComment, () => showStudent('journey.html#access=' + lesson.accessToken)),
      ...press('review', 'thẻ Buổi 7', currentSession, detailComment, detailComment),
    ],
    [
      ...press('close-review', 'nút Đóng chi tiết', closeHistory, skills, () => !history()),
      ...press('older', 'thẻ Buổi 6', previousSession, history, () => history()?.textContent.includes('Em đọc ý chính')),
    ],
    [
      ...press('close-older', 'nút Đóng chi tiết bài cũ', closeHistory, previousSession, () => !history()),
      point('finish', 'Làm nổi lời nhận xét đã gửi', sentComment),
    ],
    ...authoringScenes,
  ];

  const sceneStarts = scenes.map((_, index) => scenes.slice(0, index).reduce((count, scene) => count + scene.length, 0));
  const actions = scenes.flat();

  async function renderBeat(beat, animate) {
    if (!beat) return;
    if (beat.find) {
      await aim(beat.find, animate, beat.typing);
      return;
    }
    await beat.run?.(animate);
    if (beat.after) {
      await keepAttention(beat.after, true);
    }
  }

  const report = () => presenter?.postMessage({
    type: 'progress-log-position', step, total: actions.length, sceneStarts,
    label: actions[step - 1]?.label ?? '', error: root.dataset.presentationError || '',
  }, location.origin);

  async function change(next, animate) {
    motion = new AbortController();
    root.dataset.presentationPlaying = 'true';
    try {
      await document.fonts.ready;
      if (!screens.has(0)) {
        await waitFor(() => visible(classCard()));
        screens.remember(0, document, layer);
      }
      if (next < liveStep) await screens.show(next);
      else if (next === liveStep) returnToLive();
      else {
        if (animate) returnToLive();
        else await screens.show(step, { focus: false });
        while (liveStep < next) {
          const beat = actions[liveStep];
          await renderBeat(beat, animate);
          screens.remember(++liveStep, activeDocument(), layer, target?.(), pointer.classList.contains('visible'));
        }
        returnToLive();
      }
      step = next;
      root.dataset.presentationStep = String(step);
      root.dataset.presentationBeat = actions[step - 1]?.id ?? '';
      delete root.dataset.presentationError;
    } catch (error) {
      root.dataset.presentationError = error.message;
      console.error(error);
      if (screens.has(step)) await screens.show(step);
    } finally {
      motion = null;
      root.dataset.presentationPlaying = 'false';
      report();
    }
  }

  function returnToLive() {
    screens.hide();
    const doc = activeDocument();
    doc.defaultView.focus();
    if (pointerAnchor && visible(pointerAnchor())) focusControl(pointerAnchor());
  }

  window.addEventListener('message', event => {
    if (event.origin !== location.origin || !presenter || event.source !== presenter) return;
    if (event.data?.type === 'progress-log-position-request') {
      report();
      return;
    }
    const index = event.data?.step;
    if (event.data?.type === 'progress-log-jump' && !motion &&
        Number.isInteger(index) && index >= 0 && index <= actions.length) void change(index, false);
  });

  function onKey(event) {
    if (event.ctrlKey || event.altKey || event.metaKey) return;
    const forward = ['Enter', 'ArrowRight', 'PageDown'].includes(event.key);
    const back = ['ArrowLeft', 'PageUp'].includes(event.key);
    if (event.key.toLowerCase() === 'p') {
      event.preventDefault();
      presenter = window.open(new URL('ghi-chu.html', base), 'progress-log-notes', 'popup,width=570,height=730');
      return;
    }
    if (!forward && !back && event.key !== 'Home' && event.key !== 'Escape') return;
    if (event.key === 'Escape') { highlight(null); pointer.classList.remove('visible'); return; }
    event.preventDefault();
    event.stopImmediatePropagation();
    if (event.repeat) return;
    if (motion) { if (forward) motion.abort(); return; }
    if (forward && step < actions.length) void change(step + 1, true);
    if (back && step > 0) void change(step - 1, false);
    if (event.key === 'Home') void change(0, false);
  }
  window.addEventListener('keydown', onKey, true);
})();

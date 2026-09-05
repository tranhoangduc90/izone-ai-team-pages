(function () {
  'use strict';

  // Engine Webtest 34 — bản demo tĩnh.
  //   - 5 phần: Vocabulary → Listening → Pronunciation → Translation → Writing/Speaking.
  //   - Chạy hoàn toàn trên trình duyệt (localStorage). Chưa gọi máy chủ.
  //   - Điểm là ĐIỂM MINH HỌA (giả lập), không phải chấm thật.
  //   - Điểm nối backend/AI chấm sau: thay phần submitPartToServer/demo grade.

  const testConfig = window.TERM_TEST_CONFIG;
  const appConfig = window.TERM_TEST_APP_CONFIG;
  const demoContent = window.WEBTEST34_CONTENT || window.TERM_TEST_DEMO_CONTENT;
  const root = document.getElementById('app');
  const query = new URLSearchParams(window.location.search);
  const classCode = (query.get('class') || '').trim().toUpperCase();
  const demoClass = (testConfig && testConfig.demoClassCode) || 'CODEXWEB34';
  const isDemo = !classCode || classCode === demoClass || appConfig?.LOCAL_DEMO_ONLY;

  if (!testConfig || !demoContent || !root) return;

  const PART_IDS = testConfig.parts.map(part => part.id);
  const storageKey = `izone-test:${testConfig.slug}:${classCode || demoClass}`;
  const demoRoster = Object.freeze([
    { ref: 'w34-demo-01', name: 'Học viên Demo 01' },
    { ref: 'w34-demo-02', name: 'Học viên Demo 02' },
    { ref: 'w34-demo-03', name: 'Học viên Demo 03' }
  ]);

  function readSession() {
    for (const storage of [sessionStorage, localStorage]) {
      try {
        const restored = JSON.parse(storage.getItem(storageKey) || '{}');
        if (Object.keys(restored).length) return restored;
      } catch {
        // Trình duyệt có thể chặn storage; dùng nguồn còn lại hoặc bắt đầu mới.
      }
    }
    return {};
  }

  const restored = readSession();
  const state = {
    stage: 'identity',
    className: classCode || demoClass,
    studentRef: String(restored.studentRef || ''),
    studentName: String(restored.studentName || ''),
    submitted: { vocabulary: false, listening: false, pronunciation: false, translation: false, writing: false },
    drafts: { vocabulary: {}, listening: {}, pronunciation: {}, translation: {}, writing: {} },
    partScores: restored.partScores || null,
    result: restored.result || null,
    ...restored,
    submitted: { vocabulary: false, listening: false, pronunciation: false, translation: false, writing: false, ...(restored.submitted || {}) },
    drafts: {
      vocabulary: { ...(restored.drafts?.vocabulary || {}) },
      listening: { ...(restored.drafts?.listening || {}) },
      pronunciation: { ...(restored.drafts?.pronunciation || {}) },
      translation: { ...(restored.drafts?.translation || {}) },
      writing: { ...(restored.drafts?.writing || {}) }
    }
  };

  function saveSession() {
    const serialized = JSON.stringify({
      className: state.className,
      studentRef: state.studentRef,
      studentName: state.studentName,
      submitted: state.submitted,
      drafts: state.drafts,
      partScores: state.partScores,
      result: state.result
    });
    for (const storage of [sessionStorage, localStorage]) {
      try {
        storage.setItem(storageKey, serialized);
      } catch {
        // Không làm gián đoạn nếu trình duyệt chặn/quá hạn mức storage.
      }
    }
  }

  const elements = {};
  const $ = (id) => elements[id] || (elements[id] = document.getElementById(id));

  function escapeText(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function normalizeAnswer(value) {
    return String(value || '')
      .normalize('NFKC')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');
  }

  // ---------- Giao diện nền ----------

  const progressMarkup = PART_IDS.map((partId, index) => {
    const part = testConfig.parts[index];
    return `<div class="w34-progress-step" data-progress="${partId}">${index + 1}. ${escapeText(part.title)}</div>`;
  }).join('');

  function partViewId(partId) { return `part-${partId}`; }

  const transitionMarkup = testConfig.parts.map((part, index) => {
    const next = testConfig.parts[index + 1];
    const isLast = !next;
    return `
      <section class="panel transition-card" id="transition-${part.id}" hidden>
        <div class="transition-icon">✓</div>
        <p class="eyebrow">Phần ${index + 1} · ${escapeText(part.title)} đã nộp</p>
        <h2>${isLast ? 'Hoàn tất bài kiểm tra' : `Sẵn sàng cho phần ${next.title}`}</h2>
        <p>${isLast
          ? 'Cả 5 phần đã được gửi. Hệ thống đang chuẩn bị kết quả minh họa.'
          : `Phần ${escapeText(part.title)} đã được lưu. Bạn có thể bắt đầu phần tiếp theo bất cứ lúc nào.`}</p>
        <div class="transition-actions form-actions">
          ${isLast
            ? '<button class="button button-primary" type="button" data-action="view-result">Xem kết quả</button>'
            : `<button class="button button-primary" type="button" data-action="start-next" data-next="${next.id}">Bắt đầu ${escapeText(next.title)}</button>`}
        </div>
      </section>`;
  }).join('');

  root.innerHTML = `
    <div class="shell">
      <header class="topbar">
        <div class="topbar-inner">
          <div class="brand">
            <div class="brand-mark">IZ</div>
            <div class="brand-copy">
              <div class="brand-title">Khóa 34 · Phase 1 · Test 1</div>
              <div class="brand-sub">Bài kiểm tra 120 phút · Bản demo</div>
            </div>
          </div>
          <div class="top-actions">
            <span class="save-state" id="saveState">Đã lưu trên máy</span>
            <div class="timer" aria-label="Thời gian làm bài">120:00</div>
          </div>
        </div>
        <div class="section-nav-wrap">
          <nav class="section-nav" aria-label="Các phần của bài thi">
            ${testConfig.parts.map((part, index) => `<button class="section-tab" type="button" data-part-nav="${part.id}">${index + 1}. ${escapeText(part.title)}<span class="tab-count" data-nav-count="${part.id}">0</span></button>`).join('')}
          </nav>
        </div>
      </header>
      <main>
        <div class="notice notice-wrap" id="notice" role="status" hidden></div>

        <section class="intro" id="identityView" hidden>
          <div class="intro-card">
            <div class="eyebrow">IZONE · COMPUTER-BASED TEST</div>
            <h1>34 PHASE 1 · TEST 1</h1>
            <p class="lead">${escapeText(testConfig.intro || 'Bài kiểm tra gồm 5 kỹ năng, tổng 100 điểm và thời lượng 120 phút.')} Bản demo chạy trên trình duyệt; điểm hiển thị là minh họa.</p>
            <div class="score-grid" aria-label="Cấu trúc điểm">
              ${testConfig.parts.map(part => `<div class="score-card">${escapeText(part.title)}<strong>${escapeText(part.maxPoints)}</strong><span class="meta">điểm</span></div>`).join('')}
            </div>
            <div class="start-form">
              <div class="field">
                <label for="studentSelect">Họ và tên</label>
                <select id="studentSelect" required><option value="">Nhấn để chọn</option></select>
                <span class="field-hint" id="classLabel"></span>
              </div>
            </div>
            <div class="start-actions">
              <button class="btn btn-primary" id="confirmIdentity" type="button" disabled>Xác nhận và bắt đầu</button>
            </div>
          </div>
        </section>

        <div class="exam-layout">
          <div class="main-column">
            <div class="w34-progress" aria-label="Tiến độ bài kiểm tra">${progressMarkup}</div>
            ${testConfig.parts.map((part, index) => `
              <section class="panel test-panel" id="${partViewId(part.id)}" hidden>
                <header class="section-heading section-hero">
                  <div><p class="eyebrow">Phần ${index + 1} / ${testConfig.parts.length} · ${escapeText(part.maxPoints)} điểm</p><h2 class="w34-part-heading">${escapeText(part.title)}</h2></div>
                  <span class="answer-count" id="count-${part.id}">0 câu đã nhập</span>
                </header>
                <div class="w34-panel-body"><p class="w34-part-description" id="description-${part.id}"></p><div id="body-${part.id}"></div></div>
                <div class="form-actions w34-actions-top-border bottom-actions"><span class="autosave-status" id="autosave-${part.id}" data-status="idle">Đã lưu trên máy</span><button class="btn btn-primary" id="submit-${part.id}" type="button" disabled>Nộp bài ${escapeText(part.title)}</button></div>
              </section>`).join('')}
            ${transitionMarkup}
            <section class="panel result-panel" id="resultView" hidden></section>
          </div>
          <aside class="side-panel panel-card"><div class="progress-row"><strong>Tiến độ bài thi</strong><span id="sideProgress">0 / ${testConfig.parts.length}</span></div><div class="progress-track"><div class="progress-fill" id="sideProgressFill"></div></div><p class="meta">Các phần đã hoàn thành sẽ được lưu trên thiết bị này.</p></aside>
        </div>
      </main>
    </div>`;

  // ---------- Helpers render từng phần ----------

  const partTotals = {};
  let activePartId = '';

  function questionCountFor(partId) {
    const content = demoContent[partId];
    if (partId === 'vocabulary') {
      return content.exercise1.items.length + content.exercise2.items.length;
    }
    if (partId === 'listening') {
      return content.part1.sentences.length + content.part2.gapAnswers.length + content.part3.items.length;
    }
    if (partId === 'pronunciation') {
      return content.part1.items.length + content.part2.items.length;
    }
    if (partId === 'translation') return content.sentences.length;
    if (partId === 'writing') return content.questions.length;
    return 0;
  }

  function collectPartAnswers(partId) {
    const body = $(`body-${partId}`);
    const answers = {};
    for (const field of body.querySelectorAll('[data-question-key]')) {
      if (field.type === 'radio') {
        if (field.checked) answers[field.dataset.questionKey] = field.value;
      } else {
        answers[field.dataset.questionKey] = field.value;
      }
    }
    return answers;
  }

  function countAnswered(partId) {
    const answers = state.drafts[partId] || {};
    return Object.values(answers).filter(value => String(value || '').trim() !== '').length;
  }

  function updateAnswerCount(partId) {
    const answered = countAnswered(partId);
    const total = partTotals[partId] || 0;
    const countEl = $(`count-${partId}`);
    const submit = $(`submit-${partId}`);
    if (countEl) countEl.textContent = `${answered}/${total} câu đã nhập`;
    if (submit) submit.disabled = state.submitted[partId] || answered === 0;
  }

  function bindSave(partId) {
    const body = $(`body-${partId}`);
    body.addEventListener('input', (event) => {
      const field = event.target.closest('[data-question-key]');
      if (!field) return;
      const key = field.dataset.questionKey;
      state.drafts[partId][key] = collectPartAnswers(partId)[key] ?? '';
      saveSession();
      const status = $(`autosave-${partId}`);
      if (status) {
        status.textContent = 'Đã lưu trên máy';
        status.dataset.status = 'saved';
      }
      updateAnswerCount(partId);
    });
    body.addEventListener('click', (event) => {
      const button = event.target.closest('[data-tf-value]');
      if (!button) return;
      const key = button.dataset.questionKey;
      const group = button.parentElement;
      for (const sibling of group.querySelectorAll('[data-tf-value]')) sibling.classList.remove('is-selected');
      button.classList.add('is-selected');
      state.drafts[partId][key] = button.dataset.tfValue;
      saveSession();
      updateAnswerCount(partId);
    });
  }

  // Render cụ thể theo phần — dùng nội dung demo để vẽ các control.
  function renderVocabulary(partId) {
    const content = demoContent.vocabulary;
    const exercise2Items = content.exercise2.items;
    let number = 0;
    const renderStem = (item) => `<div class="w34-question-stem">${escapeText(item.audioLabel || item.ipa || '')}</div>`;
    const markup = `
      <div class="w34-exercise">
        <header class="w34-exercise-header">
          <h3 class="w34-exercise-title">${escapeText(content.exercise1.label)}</h3>
        </header>
        <p class="w34-exercise-instruction">Nghe và viết từ/cụm từ. (Bản demo chưa có audio — dùng gợi ý nghĩa để thử.)</p>
        <div class="w34-question-list">
          ${content.exercise1.items.map(item => `
            <div class="w34-question">
              <span class="question-number">Câu ${item.number}</span>
              <div class="w34-question-main">
                <div class="w34-question-stem">🔊 ${escapeText(item.hint || '')}</div>
                <input type="text" data-question-key="vocab-${item.number}" maxlength="120" placeholder="Câu trả lời của bạn" value="${escapeText(state.drafts[partId][`vocab-${item.number}`] || '')}">
              </div>
            </div>`).join('')}
        </div>
      </div>
      <div class="w34-exercise">
        <header class="w34-exercise-header">
          <h3 class="w34-exercise-title">${escapeText(content.exercise2.label)}</h3>
        </header>
        <div class="w34-question-list">
          ${exercise2Items.map(item => `
            <div class="w34-question w34-picture-card">
              <span class="question-number">Câu ${item.number}</span>
              <img class="w34-picture" src="${escapeText(item.image)}" alt="${escapeText(item.hint || 'tranh')}">
              <div class="w34-question-main">
                <div class="w34-question-hint">${escapeText(item.hint || '')}</div>
                <input type="text" data-question-key="vocab-${item.number}" maxlength="120" placeholder="Từ/Cụm từ cho bức tranh" value="${escapeText(state.drafts[partId][`vocab-${item.number}`] || '')}">
              </div>
            </div>`).join('')}
        </div>
      </div>`;
    $(`body-${partId}`).innerHTML = markup;
  }

  function renderListening(partId) {
    const content = demoContent.listening;
    const markup = `
      <div class="w34-exercise">
        <header class="w34-exercise-header">
          <h3 class="w34-exercise-title">${escapeText(content.part1.label)}</h3>
        </header>
        <p class="w34-exercise-instruction">${escapeText(content.part1.instruction)}</p>
        <div class="w34-order-list">
          ${content.part1.sentences.map(sentence => `
            <div class="w34-order-item">
              <span class="w34-order-letter">${escapeText(sentence.letter)}</span>
              <span class="w34-order-text">${escapeText(sentence.text)}</span>
              <label class="w34-order-input">Thứ tự
                <input type="number" min="1" max="5" data-question-key="order-${sentence.letter}" value="${escapeText(state.drafts[partId][`order-${sentence.letter}`] || '')}" inputmode="numeric">
              </label>
            </div>`).join('')}
        </div>
      </div>
      <div class="w34-exercise">
        <header class="w34-exercise-header">
          <h3 class="w34-exercise-title">${escapeText(content.part2.label)}</h3>
        </header>
        <p class="w34-exercise-instruction">${escapeText(content.part2.instruction)}</p>
        <div class="w34-table-wrap w34-table-scroll">
          <table class="w34-table">
            <tbody>
              ${content.part2.rows.map(row => `
                <tr>
                  <th>${escapeText(row.label)}</th>
                  <td>${row.cells.map(cell => renderGapCell(cell, partId)).join('<br>')}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>
      <div class="w34-exercise">
        <header class="w34-exercise-header">
          <h3 class="w34-exercise-title">${escapeText(content.part3.label)}</h3>
        </header>
        <p class="w34-exercise-instruction">${escapeText(content.part3.instruction)}</p>
        <div class="w34-tf-list">
          ${content.part3.items.map(item => `
            <div class="w34-tf-item">
              <span class="w34-question-number">${item.number}</span>
              <span class="w34-question-stem">${escapeText(item.sentence)}</span>
              <span class="w34-tf-actions" role="radiogroup" aria-label="Câu ${item.number}">
                ${['T', 'F'].map(value => `
                  <button type="button" class="${state.drafts[partId][`tf-${item.number}`] === value ? 'is-selected' : ''}"
                    data-tf-value="${value}" data-question-key="tf-${item.number}">${value}</button>`).join('')}
              </span>
            </div>`).join('')}
        </div>
      </div>`;
    $(`body-${partId}`).innerHTML = markup;
  }

  // Hỗ trợ Listening Part 2: chuyển "(n) ______" thành ô nhập data-question-key.
  function renderGapCell(cell, partId) {
    return cell.replace(/\((\d+)\)\s*_+/g, (_, n) => {
      const key = `gap-${n}`;
      return `<input type="text" data-question-key="${key}" maxlength="30" placeholder="Từ ${n}" value="${escapeText(state.drafts[partId][key] || '')}">`;
    });
  }

  function renderPronunciation(partId) {
    const content = demoContent.pronunciation;
    const markup = `
      <div class="w34-exercise">
        <header class="w34-exercise-header">
          <h3 class="w34-exercise-title">${escapeText(content.part1.label)}</h3>
        </header>
        <div class="w34-question-list">
          ${content.part1.items.map(item => `
            <div class="w34-question">
              <span class="question-number">Câu ${item.number}</span>
              <div class="w34-question-main">
                <div class="w34-question-stem"><span class="w34-ipa">${escapeText(item.ipa)}</span></div>
                <input type="text" data-question-key="ipa-${item.number}" maxlength="60" autocapitalize="off" autocomplete="off" autocorrect="off" spellcheck="false" placeholder="Viết từ tiếng Anh" value="${escapeText(state.drafts[partId][`ipa-${item.number}`] || '')}">
              </div>
            </div>`).join('')}
        </div>
      </div>
      <div class="w34-exercise">
        <header class="w34-exercise-header">
          <h3 class="w34-exercise-title">${escapeText(content.part2.label)}</h3>
        </header>
        <div class="w34-question-list">
          ${content.part2.items.map(item => `
            <div class="w34-question">
              <span class="question-number">Câu ${item.number}</span>
              <div class="w34-question-main">
                <div class="w34-question-stem">${escapeText(item.word)}</div>
                <div class="w34-choices">
                  ${item.options.map((option, index) => `
                    <label class="w34-choice ${state.drafts[partId][`ipa-${item.number}`] === String.fromCharCode(65 + index) ? 'is-selected' : ''}">
                      <input type="radio" name="pron-${item.number}" value="${String.fromCharCode(65 + index)}" data-question-key="ipa-${item.number}"
                        ${state.drafts[partId][`ipa-${item.number}`] === String.fromCharCode(65 + index) ? 'checked' : ''}>
                      <span class="w34-ipa">${escapeText(option)}</span>
                    </label>`).join('')}
                </div>
              </div>
            </div>`).join('')}
        </div>
      </div>`;
    $(`body-${partId}`).innerHTML = markup;
  }

  function renderTranslation(partId) {
    const content = demoContent.translation;
    const markup = `
      <p class="w34-part-description">${escapeText(content.description)}</p>
      <div class="w34-sentences">
        ${content.sentences.map(item => `
          <div class="w34-sentence-card">
            <p class="w34-sentence-stem"><strong>Câu ${item.number}.</strong> ${escapeText(item.vi)}</p>
            <textarea class="w34-answer-textarea" data-question-key="trans-${item.number}" maxlength="600" placeholder="Viết câu tiếng Anh của bạn">${escapeText(state.drafts[partId][`trans-${item.number}`] || '')}</textarea>
            <div class="w34-structure-hints" title="Cấu trúc gợi ý (bài thật dùng để AI chấm)">
              ${item.structures.map(s => `<span class="w34-structure-chip">${escapeText(s)}</span>`).join('')}
            </div>
            <p class="w34-word-count" data-word-count-for="trans-${item.number}"></p>
          </div>`).join('')}
      </div>`;
    $(`body-${partId}`).innerHTML = markup;
  }

  function renderWriting(partId) {
    const content = demoContent.writing;
    const markup = `
      <p class="w34-part-description">${escapeText(content.description)}</p>
      <div class="w34-sentences">
        ${content.questions.map(item => `
          <div class="w34-sentence-card">
            <p class="w34-sentence-stem"><strong>Câu ${item.number}.</strong> ${escapeText(item.prompt)}</p>
            <textarea class="w34-answer-textarea" data-question-key="writing-${item.number}" maxlength="1200" placeholder="Gõ câu trả lời của bạn">${escapeText(state.drafts[partId][`writing-${item.number}`] || '')}</textarea>
            <div class="w34-structure-hints" title="Cấu trúc gợi ý (bài thật dùng để AI chấm)">
              ${item.structures.map(s => `<span class="w34-structure-chip">${escapeText(s)}</span>`).join('')}
            </div>
            <p class="w34-word-count" data-word-count-for="writing-${item.number}"></p>
          </div>`).join('')}
      </div>`;
    $(`body-${partId}`).innerHTML = markup;
  }

  const renderers = {
    vocabulary: renderVocabulary,
    listening: renderListening,
    pronunciation: renderPronunciation,
    translation: renderTranslation,
    writing: renderWriting
  };

  // ---------- Chấm demo (minh họa) ----------

  // Bản demo không chấm dựa trên dữ liệu public; answer key chỉ được dùng ở server.
  const expectedOf = {
    vocabulary: () => null,
    listening: () => null,
    pronunciation: () => null
  };

  function answerIsCorrect(partId, key, studentAnswer) {
    const expected = expectedOf[partId] && expectedOf[partId](key, state.drafts[partId]);
    if (expected == null) return 'ungraded';
    if (Array.isArray(expected)) {
      return expected.some(item => normalizeAnswer(item) === normalizeAnswer(studentAnswer)) ? 'correct' : 'incorrect';
    }
    return normalizeAnswer(expected) === normalizeAnswer(studentAnswer) ? 'correct' : 'incorrect';
  }

  // Gán điểm minh họa cho các câu mở (Translation/Writing). Khi nối AI chấm,
  // chỉ cần thay nội dung hàm này.
  function demoGradeOpenAnswer(partId) {
    const total = Object.keys(state.drafts[partId] || {}).length;
    if (!total) return { score: 0, maxPoints: 0 };
    const maxPoints = testConfig.parts.find(part => part.id === partId).maxPoints;
    const score = Math.max(0, Math.min(maxPoints, Math.round(maxPoints * 0.8)));
    return { score, maxPoints };
  }

  function gradePart(partId) {
    const drafts = state.drafts[partId];
    const maxPoints = testConfig.parts.find(part => part.id === partId).maxPoints;
    if (partId === 'translation' || partId === 'writing') {
      const opened = Object.keys(drafts).filter(key => String(drafts[key] || '').trim() !== '');
      const total = questionCountFor(partId);
      const details = opened.map((key, index) => ({
        key,
        number: key.split('-')[1],
        studentAnswer: drafts[key],
        expected: 'AI chấm (bản demo: điểm minh họa)',
        result: 'ungraded'
      }));
      const base = demoGradeOpenAnswer(partId);
      // Phân bổ điểm mỗi câu đều nhau; câu bỏ trống 0 điểm.
      const perQuestion = base.maxPoints / total;
      const perQuestionScore = opened.length ? Math.max(0, Math.min(perQuestion, base.score / opened.length)) : 0;
      const scored = details.map(detail => ({
        ...detail,
        score: Math.round(perQuestionScore * 10) / 10
      }));
      return { partId, maxPoints, score: Math.round(base.score * 10) / 10, details: scored };
    }
    const keys = Object.keys(drafts).filter(key => String(drafts[key] || '').trim() !== '');
    const perQuestionPoints = maxPoints / questionCountFor(partId);
    let totalScore = 0;
    const details = [];
    for (const key of keys) {
      const result = answerIsCorrect(partId, key, drafts[key]);
      const scored = result === 'correct';
      const score = scored ? perQuestionPoints : 0;
      totalScore += score;
      details.push({
        key,
        number: key.includes('-') ? key.split('-').pop() : key,
        studentAnswer: drafts[key],
        expected: expectedOf[partId](key, drafts) ?? '—',
        result,
        score
      });
    }
    // Các câu bỏ trống vẫn hiện trong chi tiết.
    const allKeys = partQuestionKeys(partId);
    for (const key of allKeys) {
      if (!details.some(detail => detail.key === key)) {
        details.push({
          key,
          number: key.includes('-') ? key.split('-').pop() : key,
          studentAnswer: '',
          expected: expectedOf[partId](key, drafts) ?? '—',
          result: 'blank',
          score: 0
        });
      }
    }
    details.sort((a, b) => String(a.number).localeCompare(String(b.number), 'en', { numeric: true }));
    return { partId, maxPoints, score: Math.round(totalScore * 10) / 10, details };
  }

  // Tất cả key câu hỏi của một phần (để render dòng trống).
  function partQuestionKeys(partId) {
    const content = demoContent[partId];
    if (partId === 'vocabulary') {
      return [
        ...content.exercise1.items.map(item => `vocab-${item.number}`),
        ...content.exercise2.items.map(item => `vocab-${item.number}`)
      ];
    }
    if (partId === 'listening') {
      return [
        ...content.part1.sentences.map(item => `order-${item.letter}`),
        ...content.part2.gapAnswers.map(item => `gap-${item.number}`),
        ...content.part3.items.map(item => `tf-${item.number}`)
      ];
    }
    if (partId === 'pronunciation') {
      return [
        ...content.part1.items.map(item => `ipa-${item.number}`),
        ...content.part2.items.map(item => `ipa-${item.number}`)
      ];
    }
    if (partId === 'translation') return content.sentences.map(item => `trans-${item.number}`);
    if (partId === 'writing') return content.questions.map(item => `writing-${item.number}`);
    return [];
  }

  // ---------- Kết quả ----------

  function renderResult() {
    const view = $('resultView');
    const partScores = state.partScores;
    const totalPoints = testConfig.parts.reduce((sum, part) => sum + part.maxPoints, 0);
    const totalScore = testConfig.parts.reduce((sum, part) => sum + (partScores[part.id]?.score || 0), 0);
    const summaryCards = testConfig.parts.map(part => {
      const scored = partScores[part.id] || { score: 0, maxPoints: part.maxPoints };
      return `
        <div class="summary-card">
          <span>${escapeText(part.title)}</span>
          <strong>${scored.score}<small class="w34-total-suffix"> / ${part.maxPoints}</small></strong>
        </div>`;
    }).join('');

    const detailsHtml = testConfig.parts.map(part => {
      const scored = partScores[part.id];
      if (!scored || !scored.details) return '';
      const rows = scored.details.map(detail => {
        const isCorrect = detail.result === 'correct';
        const isBlank = detail.result === 'blank';
        const rowClass = isCorrect ? 'detail-row-correct' : (isBlank ? 'detail-row-blank' : 'detail-row-incorrect');
        const icon = isCorrect ? '✓' : (isBlank ? '–' : '✕');
        const resultClass = isCorrect ? 'result-correct' : (isBlank ? 'result-blank' : 'result-incorrect');
        return `
          <tr class="${rowClass}">
            <td>${escapeText(detail.number)}</td>
            <td>${escapeText(detail.studentAnswer || '—')}</td>
            <td>${escapeText(detail.expected)}</td>
            <td><span class="detail-result-cell ${resultClass}"><span class="detail-result-icon">${icon}</span>${escapeText(detail.score)}</span></td>
          </tr>`;
      }).join('');
      return `
        <div class="detail-block">
          <details>
            <summary>${escapeText(part.title)} · ${scored.score} / ${scored.maxPoints} điểm</summary>
            <div class="detail-table-wrap">
              <table class="detail-table">
                <thead><tr><th>Câu</th><th>Bài làm</th><th>Đáp án / Ghi chú</th><th>Kết quả</th></tr></thead>
                <tbody>${rows}</tbody>
              </table>
            </div>
          </details>
        </div>`;
    }).join('');

    view.innerHTML = `
      <header class="result-heading">
        <div>
          <p class="eyebrow">Kết quả minh họa · Bản demo</p>
          <h2>Bài làm của ${escapeText(state.studentName || 'học viên')}</h2>
          <p>Lớp ${escapeText(state.className)} · Điểm dưới đây là minh họa, chưa phải chấm thật và chưa đồng bộ hệ thống.</p>
        </div>
      </header>
      <div class="result-status">Tổng điểm minh họa: <strong>${totalScore}</strong> / ${totalPoints}</div>
      <div class="summary-grid">${summaryCards}</div>
      <p class="w34-result-note">
        Translation và Writing/Speaking sẽ được chấm bằng AI theo cấu trúc ở bài thật. Trong bản demo, các phần này được
        gán điểm minh họa 80% nếu có câu trả lời.
      </p>
      ${detailsHtml}
      <div class="form-actions result-actions w34-result-actions-top">
        <button class="button button-secondary" type="button" data-action="print-result">In / lưu PDF</button>
        <button class="button button-secondary" type="button" data-action="restart-demo">Làm lại từ đầu</button>
      </div>`;
    view.hidden = false;
  }

  // ---------- Điểm nối máy chủ (sẽ thay khi có API thật) ----------

  async function submitPartToServer(partId, answers) {
    // Bản demo tĩnh: không gửi đi đâu. Khi có API:
    //   POST ${appConfig.API_BASE_URL}/api/webtest-34/${partId}
    //   với { classCode, studentRef, partId, answers }
    await Promise.resolve(answers);
    return { ok: true, demo: true };
  }

  // ---------- Luồng chính ----------

  function showNotice(message, kind) {
    const notice = $('notice');
    notice.textContent = message;
    notice.className = `notice ${kind || ''}`.trim();
    notice.hidden = !message;
  }

  function setProgress(partIndex) {
    document.querySelectorAll('.w34-progress-step').forEach((step, index) => {
      step.classList.toggle('done', index < partIndex);
      step.classList.toggle('active', index === partIndex);
    });
    document.querySelectorAll('[data-part-nav]').forEach((tab, index) => {
      tab.classList.toggle('active', index === partIndex);
      const count = tab.querySelector('[data-nav-count]');
      if (count) count.textContent = index < partIndex ? '✓' : String(index + 1);
    });
    const sideProgress = $('sideProgress');
    const sideProgressFill = $('sideProgressFill');
    if (sideProgress) sideProgress.textContent = `${Math.min(partIndex, testConfig.parts.length)} / ${testConfig.parts.length}`;
    if (sideProgressFill) sideProgressFill.style.width = `${Math.min(partIndex, testConfig.parts.length) / testConfig.parts.length * 100}%`;
  }

  function setStage(stage) {
    state.stage = stage;
    const isPartStage = testConfig.parts.some(part => part.id === stage);
    $('identityView').hidden = stage !== 'identity';
    testConfig.parts.forEach(part => {
      $(partViewId(part.id)).hidden = stage !== part.id;
    });
    document.querySelectorAll('[id^="transition-"]').forEach(node => {
      node.hidden = !(stage === '__transition__' && node.id === `transition-${activePartId}`);
    });
    const resultView = $('resultView');
    resultView.hidden = stage !== 'result';
    if (stage !== 'result') {
      resultView.innerHTML = '';
    }
    // Vô hiệu hoá/che các phần đã nộp khi đang ở một phần khác.
    if (isPartStage) {
      document.querySelectorAll('[id^="transition-"]').forEach(node => { node.hidden = true; });
      resultView.hidden = true;
    }
  }

  function showPart(partId) {
    const part = testConfig.parts.find(p => p.id === partId);
    activePartId = partId;
    renderers[partId](partId);
    $(`description-${partId}`).textContent = '';
    const content = demoContent[partId];
    if (content && content.description && partId !== 'translation' && partId !== 'writing') {
      $(`description-${partId}`).textContent = content.description;
    }
    bindSave(partId);
    partTotals[partId] = questionCountFor(partId);
    updateAnswerCount(partId);
    setProgress(testConfig.parts.findIndex(p => p.id === partId));
    setStage(partId);
    showNotice('');
  }

  async function submitPart(partId) {
    const part = testConfig.parts.find(p => p.id === partId);
    const submitButton = $(`submit-${partId}`);
    const status = $(`autosave-${partId}`);
    const answers = collectPartAnswers(partId);
    state.drafts[partId] = { ...answers };
    submitButton.disabled = true;
    status.textContent = 'Đang lưu và nộp...';
    status.dataset.status = 'saving';
    try {
      await submitPartToServer(partId, answers);
      state.submitted[partId] = true;
      state.partScores = { ...(state.partScores || {}), [partId]: gradePart(partId) };
      state.result = null;
      saveSession();
      setProgress(testConfig.parts.findIndex(p => p.id === partId) + 1);
      status.textContent = 'Đã nộp';
      status.dataset.status = 'saved';
      showTransition(partId);
    } catch (error) {
      submitButton.disabled = false;
      status.textContent = 'Chưa nộp được · thử lại';
      status.dataset.status = 'error';
      showNotice(`Không thể nộp phần này: ${error.message}`, 'error');
    }
  }

  function showTransition(partId) {
    const index = testConfig.parts.findIndex(p => p.id === partId);
    activePartId = partId;
    setStage('__transition__');
    const transition = document.getElementById(`transition-${partId}`);
    if (transition) transition.hidden = false;
    if (index === testConfig.parts.length - 1) {
      state.completed = true;
      saveSession();
    }
  }

  function openPart(partId) {
    // Nếu phần đã nộp, chuyển sang phần kế tiếp; phần hiện tại khoá control.
    if (state.submitted[partId]) {
      const index = testConfig.parts.findIndex(p => p.id === partId);
      const next = testConfig.parts[index + 1];
      if (next) return openPart(next.id);
      return renderResultStage();
    }
    if (state.partScores && state.partScores[partId]) {
      showPart(partId);
      // Đã nộp rồi nhưng chưa đánh dấu submitted → đánh dấu và khoá.
      const status = $(`autosave-${partId}`);
      if (status) { status.textContent = 'Đã nộp'; status.dataset.status = 'saved'; }
      return;
    }
    showPart(partId);
  }

  function renderResultStage() {
    setProgress(testConfig.parts.length);
    setStage('result');
    renderResult();
  }

  function initIdentity() {
    const classLabel = $('classLabel');
    classLabel.textContent = `Lớp ${state.className}`;
    const select = $('studentSelect');
    select.replaceChildren(new Option('Nhấn để chọn', ''));
    if (state.studentRef) {
      select.append(new Option(state.studentName, state.studentRef));
      select.value = state.studentRef;
      $('confirmIdentity').disabled = false;
      return;
    }
    demoRoster.forEach(student => {
      select.append(new Option(student.name, student.ref));
    });
    select.addEventListener('change', () => {
      const student = demoRoster.find(item => item.ref === select.value);
      $('confirmIdentity').disabled = !student;
    });
  }

  // ---------- Khởi động ----------

  function initialize() {
    if (isDemo) {
      // Chế độ demo: chọn tên rồi vào phần đầu tiên còn dở.
      initIdentity();
      $('identityView').hidden = false;
      $('confirmIdentity').addEventListener('click', () => {
        const select = $('studentSelect');
        const student = demoRoster.find(item => item.ref === select.value);
        if (!student) return;
        state.studentRef = student.ref;
        state.studentName = student.name;
        state.className = classCode || demoClass;
        saveSession();
        showNotice(`Xin chào ${student.name}. Bắt đầu phần Vocabulary nhé.`, 'success');
        // Mở phần đầu tiên chưa nộp.
        const firstOpen = testConfig.parts.find(part => !state.submitted[part.id]);
        showPart(firstOpen ? firstOpen.id : testConfig.parts[0].id);
      });
      $('studentSelect').dispatchEvent(new Event('change'));
      return;
    }

    showNotice('Bản demo Webtest 34 dùng lớp CODEXWEB34. Mở lại bằng ?class=CODEXWEB34.', 'error');
    root.querySelector('.identity-panel')?.setAttribute('hidden', '');
    const firstOpen = testConfig.parts.find(part => !state.submitted[part.id]);
    showPart(firstOpen ? firstOpen.id : testConfig.parts[0].id);
  }

  // Gắn sự kiện submit các phần (delegate).
  document.addEventListener('click', (event) => {
    const partNav = event.target.closest('[data-part-nav]');
    if (partNav) {
      openPart(partNav.dataset.partNav);
      return;
    }
    const submitButton = event.target.closest('[id^="submit-"]');
    if (submitButton && !submitButton.disabled) {
      const partId = submitButton.id.slice('submit-'.length);
      submitPart(partId);
      return;
    }
    const startNext = event.target.closest('[data-action="start-next"]');
    if (startNext) {
      openPart(startNext.dataset.next);
      return;
    }
    const viewResult = event.target.closest('[data-action="view-result"]');
    if (viewResult) {
      renderResultStage();
      return;
    }
    const printResult = event.target.closest('[data-action="print-result"]');
    if (printResult) {
      window.print();
      return;
    }
    const restart = event.target.closest('[data-action="restart-demo"]');
    if (restart) {
      for (const storage of [sessionStorage, localStorage]) {
        try { storage.removeItem(storageKey); } catch { /* bỏ qua */ }
      }
      window.location.reload();
    }
  });

  // Đếm từ cho textarea Translation/Writing.
  document.addEventListener('input', (event) => {
    const textarea = event.target.closest('textarea[data-question-key]');
    if (!textarea) return;
    const counter = document.querySelector(`[data-word-count-for="${textarea.dataset.questionKey}"]`);
    if (counter) {
      const count = textarea.value.trim() ? textarea.value.trim().split(/\s+/).length : 0;
      counter.textContent = `${count} từ`;
    }
  });

  initialize();
}());

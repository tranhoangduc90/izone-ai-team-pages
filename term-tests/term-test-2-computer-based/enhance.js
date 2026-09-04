(function () {
  'use strict';

  const contentConfig = window.TERM_TEST_CONTENT;
  const testConfig = window.TERM_TEST_CONFIG;
  const query = new URLSearchParams(window.location.search);
  const classCode = (query.get('class') || '').trim().toUpperCase();
  const isDemo = ['complete', 'listening-only', 'writing-prep', 'writing'].includes(query.get('demo'));

  if (!contentConfig || !testConfig || contentConfig.baseTestSlug !== testConfig.slug) return;

  const uiStorageKey = 'izone-test-ui:' + testConfig.slug + ':' + classCode;
  const submissionStorageKey = 'izone-test:' + testConfig.slug + ':' + classCode;
  const readingMinutes = Math.max(1, Number(contentConfig.timing?.readingMinutes) || 60);
  const writingMinutes = Math.max(1, Number(contentConfig.timing?.writingMinutes) || 60);
  const uiState = readUiState();

  // Dữ liệu vào: phần đang mở, câu đánh dấu, cỡ chữ, vị trí audio và hạn giờ Reading/Writing trên máy hiện tại.
  // Việc chính: đọc an toàn rồi bổ sung giá trị mặc định cho Listening, Reading và Writing.
  // Kết quả: tải lại trang vẫn trở về đúng ngữ cảnh học viên đang làm.
  // Khi lỗi: dùng cấu hình mặc định; luồng lưu bài của shared/app.js không bị ảnh hưởng.
  function readUiState() {
    let stored = {};
    for (const storage of [sessionStorage, localStorage]) {
      try {
        stored = JSON.parse(storage.getItem(uiStorageKey) || '{}');
        if (Object.keys(stored).length) break;
      } catch {
        stored = {};
      }
    }
    return {
      flags: {
        listening: { ...(stored.flags?.listening || {}) },
        reading: { ...(stored.flags?.reading || {}) }
      },
      activeSection: {
        listening: Number(stored.activeSection?.listening) || 0,
        reading: Number(stored.activeSection?.reading) || 0
      },
      fontSize: {
        listening: Number(stored.fontSize?.listening) || 100,
        reading: Number(stored.fontSize?.reading) || 100
      },
      audio: {
        started: Boolean(stored.audio?.started),
        time: Number(stored.audio?.time) || 0,
        volume: Number(stored.audio?.volume) || 1
      },
      readingTimer: {
        deadline: Number(stored.readingTimer?.deadline) || 0,
        attemptToken: String(stored.readingTimer?.attemptToken || '')
      },
      writingTimer: {
        deadline: Number(stored.writingTimer?.deadline) || 0,
        attemptToken: String(stored.writingTimer?.attemptToken || '')
      }
    };
  }

  function saveUiState() {
    const serialized = JSON.stringify(uiState);
    for (const storage of [sessionStorage, localStorage]) {
      try {
        storage.setItem(uiStorageKey, serialized);
      } catch {
        // Bộ nhớ trình duyệt có thể bị chặn; bài làm chính vẫn được shared/app.js quản lý.
      }
    }
  }

  function makeButton(className, label) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = className;
    button.textContent = label;
    return button;
  }

  // Dữ liệu vào: khối chọn học viên do shared/app.js dựng, mã lớp và thanh tiêu đề của bài thi.
  // Việc chính: bỏ nhãn lặp rồi chuyển nguyên khối lớp/tên đã chọn lên cùng hàng với tiêu đề.
  // Kết quả: phần làm bài có thêm chiều cao nhưng dropdown và trạng thái khóa tên vẫn là phần tử gốc.
  // Khi thiếu phần tử: giữ nguyên bố cục cũ để không cản học viên vào bài.
  function compactIdentityPanel() {
    const panel = document.getElementById('identityView');
    const copy = panel?.querySelector('.identity-copy');
    const oldEyebrow = copy?.querySelector('.eyebrow');
    const identityTitle = document.getElementById('identityTitle');
    const classLabel = document.getElementById('classLabel');
    const select = document.getElementById('studentSelect');
    const selectLabel = select?.closest('label');
    const topbar = document.querySelector('.topbar');
    if (!panel || !copy || !classLabel || !select || !selectLabel || !topbar) return;

    oldEyebrow?.remove();
    classLabel.classList.add('eyebrow', 'cbt-class-label');
    copy.prepend(classLabel);
    select.setAttribute('aria-label', 'Họ và tên');
    selectLabel.classList.add('cbt-student-select');
    selectLabel.replaceChildren(select);
    panel.classList.add('cbt-identity-panel');
    topbar.classList.add('cbt-topbar-with-identity');
    topbar.append(panel);

    // Danh sách lớp được shared/app.js nạp bất đồng bộ sau khi enhancer chạy.
    // Khóa đúng học viên khi option xuất hiện để tải nhanh hay tải lại đều không yêu cầu chọn tên lần nữa.
    function lockPreparedIdentity() {
      if (isDemo || !window.TERM_TEST_BOOTSTRAP || !select.value) return;
      select.disabled = true;
      select.setAttribute('aria-label', 'Họ và tên đã xác nhận');
      panel.dataset.studentLocked = 'true';
      if (identityTitle) identityTitle.textContent = 'Họ và tên đã xác nhận';
    }

    lockPreparedIdentity();
    const identityObserver = new MutationObserver(lockPreparedIdentity);
    identityObserver.observe(select, { childList: true });
    window.addEventListener('pagehide', () => identityObserver.disconnect(), { once: true });
  }

  function replaceInstructions(list, instructions) {
    list.replaceChildren(...instructions.map(text => {
      const item = document.createElement('li');
      item.textContent = text;
      return item;
    }));
  }

  function formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
    const whole = Math.floor(seconds);
    const minutes = Math.floor(whole / 60);
    const remaining = whole % 60;
    return String(minutes).padStart(2, '0') + ':' + String(remaining).padStart(2, '0');
  }

  function collectFields(grid) {
    const fields = new Map();
    grid.querySelectorAll('.question').forEach(question => {
      const field = question.querySelector('[data-number]');
      if (!field) return;
      const number = String(field.dataset.number);
      field.setAttribute('aria-label', 'Câu ' + number);
      field.title = 'Câu ' + number;
      if (field.tagName === 'INPUT') field.placeholder = 'Nhập đáp án';
      if (field.tagName === 'SELECT' && field.options[0]) field.options[0].textContent = 'Chọn';
      fields.set(number, field);
    });
    return fields;
  }

  function hideBackingField(field) {
    field.classList.add('cbt-visually-hidden-field');
    field.hidden = true;
    field.setAttribute('aria-hidden', 'true');
    field.tabIndex = -1;
  }

  function syncRadioField(field, card) {
    const groupName = 'cbt-choice-' + card.dataset.questionNumber + '-' + Math.random().toString(36).slice(2, 8);
    const radios = [...card.querySelectorAll('[data-choice-value]')].map(label => {
      const choiceValue = String(label.dataset.choiceValue || '').trim();
      const compact = value => String(value || '').toUpperCase().replace(/\s+/g, '');
      const badge = label.querySelector(':scope > strong, :scope > .cbt-choice-letter');
      if (badge
        && compact(badge.textContent) === compact(choiceValue)
        && compact(label.textContent) === compact(choiceValue + choiceValue)) {
        // Dữ liệu vào: lựa chọn có cùng nhãn ở cả badge và phần chữ, ví dụ TRUE + TRUE.
        // Việc chính: bỏ badge lặp và chuyển hàng về bố cục radio + một nhãn đầy đủ.
        // Kết quả: học viên chỉ thấy TRUE, FALSE hoặc NOT GIVEN đúng một lần.
        // Khi nhãn không trùng hoàn toàn: giữ nguyên cấu trúc nguồn để tránh mất nội dung.
        badge.remove();
        label.classList.add('cbt-choice-single-label');
      }
      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = groupName;
      radio.value = label.dataset.choiceValue;
      radio.checked = field.value === radio.value;
      radio.setAttribute('aria-label', 'Câu ' + field.dataset.number + ', đáp án ' + radio.value);
      radio.addEventListener('change', () => {
        if (!radio.checked) return;
        field.value = radio.value;
        field.dispatchEvent(new Event('input', { bubbles: true }));
        field.dispatchEvent(new Event('change', { bubbles: true }));
      });
      label.prepend(radio);
      return radio;
    });
    hideBackingField(field);
    const renderRadioSelection = () => {
      radios.forEach(radio => { radio.checked = field.value === radio.value; });
    };
    field.addEventListener('input', renderRadioSelection);
    field.addEventListener('term-test:draft-restored', renderRadioSelection);
    return radios;
  }

  function syncMultiFields(card, fields) {
    const limit = fields.length;
    const status = document.createElement('p');
    status.className = 'cbt-multi-status';
    status.setAttribute('role', 'status');

    function readValues() {
      return [...new Set(fields.map(field => field.value).filter(Boolean))].slice(0, limit);
    }

    function writeValues(values) {
      const changed = [];
      fields.forEach((field, index) => {
        const nextValue = values[index] || '';
        if (field.value === nextValue) return;
        field.value = nextValue;
        changed.push(field);
      });
      changed.forEach(field => {
        field.dispatchEvent(new Event('input', { bubbles: true }));
        field.dispatchEvent(new Event('change', { bubbles: true }));
      });
    }

    const checkboxes = [...card.querySelectorAll('[data-choice-value]')].map(label => {
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = label.dataset.choiceValue;
      checkbox.setAttribute('aria-label', 'Câu ' + fields.map(field => field.dataset.number).join('–') + ', đáp án ' + checkbox.value);
      label.prepend(checkbox);
      return checkbox;
    });

    function renderSelection(message = '') {
      const values = readValues();
      checkboxes.forEach(checkbox => { checkbox.checked = values.includes(checkbox.value); });
      card.classList.toggle('is-complete', values.length === limit);
      card.classList.toggle('is-limit', Boolean(message));
      status.textContent = message || 'Đã chọn ' + values.length + '/' + limit + '. Có thể bỏ tick để đổi đáp án.';
    }

    checkboxes.forEach(checkbox => {
      checkbox.addEventListener('change', () => {
        let values = readValues();
        if (checkbox.checked) {
          if (values.length >= limit) {
            checkbox.checked = false;
            renderSelection('Tối đa ' + limit + ' phương án. Hãy bỏ tick một phương án trước khi chọn đáp án khác.');
            return;
          }
          values.push(checkbox.value);
        } else {
          values = values.filter(value => value !== checkbox.value);
        }
        writeValues(values);
        renderSelection();
      });
    });
    fields.forEach(field => {
      hideBackingField(field);
      field.addEventListener('input', () => renderSelection());
      field.addEventListener('term-test:draft-restored', () => renderSelection());
    });
    card.append(status);
    renderSelection();
    return checkboxes;
  }

  // Dữ liệu vào: HTML đề, 40 ô do shared/app.js tạo và trạng thái đánh dấu.
  // Việc chính: chuyển từng ô thật vào đúng data-answer-slot rồi nối radio hoặc checkbox HTML với select gốc.
  // Kết quả: giao diện đẹp hơn nhưng dữ liệu vẫn đi qua đúng field, draft và API cũ.
  // Khi thiếu slot: câu đó được giữ trong bản đồ để test DOM phát hiện trước khi phát hành.
  function attachAnswerFields(skill, sectionNode, sectionIndex, fields, items) {
    const processedSlots = new Set();
    sectionNode.querySelectorAll('[data-control="multi"]').forEach(card => {
      const numbers = (card.dataset.questionNumbers || '').split(',').filter(Boolean);
      const multiFields = numbers.map(number => fields.get(number)).filter(Boolean);
      if (multiFields.length !== numbers.length) return;

      numbers.forEach((number, index) => {
        const slot = card.querySelector('[data-answer-slot="' + number + '"]');
        const field = multiFields[index];
        if (!slot) return;
        field.classList.add('cbt-answer-select');
        slot.append(field);
        processedSlots.add(slot);
      });
      const checkboxes = syncMultiFields(card, multiFields);
      const flags = document.createElement('span');
      flags.className = 'cbt-multi-flags';
      card.querySelector('.cbt-question-heading')?.append(flags);

      multiFields.forEach(field => {
        const number = String(field.dataset.number);
        const flagButton = makeButton('cbt-flag-button cbt-multi-flag', '⚑' + number);
        flagButton.setAttribute('aria-label', 'Đánh dấu câu ' + number);
        flagButton.title = 'Đánh dấu câu ' + number + ' để xem lại';
        flags.append(flagButton);
        items.push({
          skill,
          number,
          field,
          target: card,
          flagButton,
          radios: checkboxes,
          sectionIndex
        });
      });
    });

    sectionNode.querySelectorAll('[data-answer-slot]').forEach(slot => {
      if (processedSlots.has(slot)) return;
      const number = String(slot.dataset.answerSlot);
      const field = fields.get(number);
      if (!field) return;

      const target = slot.closest('[data-question-number]') || slot;
      field.classList.add(field.tagName === 'SELECT' ? 'cbt-answer-select' : 'cbt-answer-input');
      slot.append(field);

      let radios = [];
      const radioCard = target.closest('[data-control="radio"]');
      if (radioCard) radios = syncRadioField(field, radioCard);

      const flagButton = makeButton('cbt-flag-button', '⚑');
      flagButton.setAttribute('aria-label', 'Đánh dấu câu ' + number);
      flagButton.title = 'Đánh dấu để xem lại';
      const heading = target.querySelector?.(':scope > .cbt-question-heading');
      (heading || target).append(flagButton);

      items.push({
        skill,
        number,
        field,
        target,
        flagButton,
        radios,
        sectionIndex
      });
    });
  }

  function createToolbar(heading, skill, sectionConfig) {
    const toolbar = document.createElement('div');
    toolbar.className = 'cbt-toolbar';
    heading.classList.add('cbt-test-heading');

    const controls = document.createElement('div');
    controls.className = 'cbt-toolbar-controls';
    const partNav = document.createElement('nav');
    partNav.className = 'cbt-part-nav';
    partNav.setAttribute('aria-label', skill === 'listening' ? 'Chọn phần Listening' : 'Chọn bài đọc');

    const sizeControls = document.createElement('div');
    sizeControls.className = 'cbt-text-size';
    const sizeLabel = document.createElement('span');
    sizeLabel.textContent = 'Cỡ chữ';
    const smaller = makeButton('cbt-tool-button', 'A−');
    smaller.setAttribute('aria-label', 'Giảm cỡ chữ');
    const sizeValue = document.createElement('strong');
    const larger = makeButton('cbt-tool-button', 'A+');
    larger.setAttribute('aria-label', 'Tăng cỡ chữ');
    sizeControls.append(sizeLabel, smaller, sizeValue, larger);

    controls.append(partNav, sizeControls);
    toolbar.append(heading, controls);
    return { toolbar, partNav, smaller, larger, sizeValue, sectionConfig };
  }

  function createSectionPager(skill, sectionIndex, sectionCount, onActivate) {
    const noun = skill === 'listening' ? 'Part' : 'Passage';
    const pager = document.createElement('nav');
    pager.className = 'cbt-section-pager';
    pager.setAttribute('aria-label', 'Chuyển ' + noun);

    const previous = makeButton('cbt-section-page-button is-previous', '← Previous ' + noun);
    previous.disabled = sectionIndex === 0;
    previous.addEventListener('click', () => onActivate(sectionIndex - 1));

    const position = document.createElement('span');
    position.textContent = noun + ' ' + (sectionIndex + 1) + ' / ' + sectionCount;

    const next = makeButton('cbt-section-page-button is-next', 'Next ' + noun + ' →');
    next.disabled = sectionIndex === sectionCount - 1;
    next.addEventListener('click', () => onActivate(sectionIndex + 1));
    pager.append(previous, position, next);
    return pager;
  }

  // Dữ liệu vào: từng khối nội dung của một Part/Passage và các số câu đã có trong HTML đề.
  // Việc chính: gắn dải câu cho cả tiêu đề, chú giải và khối bài tập, kể cả khối không chứa ô trả lời.
  // Kết quả: Note có thể hiện đúng nhãn như 31–32 thay vì chỉ biết dải câu của toàn Part/Passage.
  // Khi không đọc được dải riêng: dùng dải câu chung của Part/Passage để không tạo nhãn sai hoặc rỗng.
  function annotateQuestionRanges(sectionNode, host, fallbackRange) {
    function rangeFromNumbers(numbers) {
      const sorted = [...new Set(numbers.map(Number).filter(number => number >= 1 && number <= 40))]
        .sort((left, right) => left - right);
      if (!sorted.length) return '';
      if (sorted.length === 1) return String(sorted[0]);
      return sorted[0] + '–' + sorted[sorted.length - 1];
    }

    function numbersFrom(value) {
      return (String(value || '').match(/\d+/g) || []).map(Number);
    }

    let activeRange = rangeFromNumbers(numbersFrom(fallbackRange));
    sectionNode.dataset.questionRange = activeRange;
    [...host.children].forEach(child => {
      if (child.classList.contains('cbt-section-intro')) {
        child.dataset.questionRange = activeRange;
        return;
      }
      if (child.classList.contains('cbt-subsection-heading')) {
        const rangeHeading = child.querySelector('h1, h2, h3, h4, h5, h6');
        activeRange = rangeFromNumbers(numbersFrom(rangeHeading?.textContent)) || activeRange;
        child.dataset.questionRange = activeRange;
        return;
      }
      const containedNumbers = [...child.querySelectorAll(
        '[data-question-numbers], [data-question-number], [data-answer-slot]'
      )].flatMap(node => numbersFrom(
        node.dataset.questionNumbers || node.dataset.questionNumber || node.dataset.answerSlot
      ));
      child.dataset.questionRange = rangeFromNumbers(containedNumbers) || activeRange;
    });
  }

  function configureMatchingLayouts(sectionNode) {
    // Dữ liệu vào: các khối matching trong đề computer-based sau khi nội dung đã được dựng.
    // Việc chính: ẩn bảng Locations bị lặp ở bài Map, ghép Map với phần trả lời,
    // và đặt câu hỏi trước bảng phương án ở các bài matching còn lại.
    // Kết quả: học viên nhìn theo thứ tự dữ kiện → ô chọn → phương án tham chiếu.
    // Khi cấu trúc hoặc tiêu đề nguồn thay đổi: giữ nguyên bố cục cũ, không ảnh hưởng đáp án.
    const compactReferenceTitles = new Set(['Words', 'People']);

    sectionNode.querySelectorAll('.cbt-matching-layout').forEach(layout => {
      const optionBank = layout.querySelector(':scope > .cbt-option-bank');
      const bankTitle = optionBank?.querySelector('h4')?.textContent?.trim() || '';

      if (bankTitle && bankTitle !== 'Locations') {
        layout.classList.add('cbt-answer-first-matching-layout');
        if (compactReferenceTitles.has(bankTitle)) {
          layout.classList.add('cbt-compact-reference-layout');
        }
        layout.append(optionBank);
        return;
      }

      if (bankTitle !== 'Locations') return;
      const visual = layout.previousElementSibling;
      const heading = visual?.previousElementSibling;
      if (!visual?.classList.contains('cbt-visual-card')
        || !heading?.classList.contains('cbt-subsection-heading')) return;

      optionBank.hidden = true;
      layout.classList.add('cbt-map-matching-layout');
      const workspace = document.createElement('div');
      workspace.className = 'cbt-map-workspace';
      workspace.dataset.answerCount = String(layout.querySelectorAll('[data-answer-slot]').length);
      heading.before(workspace);
      workspace.append(heading, visual, layout);
    });
  }

  function createSemanticPane(skill, sectionConfig, heading, fields) {
    const pane = document.createElement('section');
    pane.className = 'cbt-semantic-pane';
    pane.setAttribute('aria-label', skill === 'listening' ? 'Đề Listening HTML' : 'Đề Reading HTML');

    const toolbarParts = createToolbar(heading, skill, sectionConfig);
    const viewport = document.createElement('div');
    viewport.className = 'cbt-content-viewport';
    viewport.dataset.skill = skill;
    const sectionNodes = [];
    const items = [];

    sectionConfig.sections.forEach((section, sectionIndex) => {
      let sectionNode;
      let pagerHost;
      if (skill === 'reading') {
        sectionNode = document.createElement('section');
        sectionNode.className = 'cbt-reading-section';

        const passage = document.createElement('article');
        passage.className = 'cbt-reading-passage';
        const passageHeader = document.createElement('header');
        passageHeader.className = 'cbt-passage-header';
        const passageLabel = document.createElement('span');
        passageLabel.textContent = section.label;
        const passageTitle = document.createElement('h3');
        passageTitle.textContent = section.title;
        passageHeader.append(passageLabel, passageTitle);
        const passageBody = document.createElement('div');
        passageBody.className = 'cbt-passage-body';
        passageBody.innerHTML = section.passageHtml;
        passage.append(passageHeader, passageBody);

        const questions = document.createElement('div');
        questions.className = 'cbt-reading-questions';
        questions.innerHTML = section.questionsHtml;
        sectionNode.append(passage, questions);
        pagerHost = questions;
      } else {
        sectionNode = document.createElement('article');
        sectionNode.className = 'cbt-listening-section';
        sectionNode.innerHTML = section.html;
        pagerHost = sectionNode;
      }
      configureMatchingLayouts(sectionNode);
      pagerHost.append(createSectionPager(skill, sectionIndex, sectionConfig.sections.length, activateSection));
      sectionNode.dataset.sectionIndex = String(sectionIndex);
      annotateQuestionRanges(sectionNode, pagerHost, section.range);
      sectionNode.hidden = true;
      viewport.append(sectionNode);
      sectionNodes.push(sectionNode);
      attachAnswerFields(skill, sectionNode, sectionIndex, fields, items);
    });

    const partButtons = sectionConfig.sections.map((section, index) => {
      const button = makeButton('cbt-part-button', section.label + ' · ' + section.range.replace('Questions ', 'Q'));
      button.addEventListener('click', () => activateSection(index));
      toolbarParts.partNav.append(button);
      return button;
    });

    function activateSection(index, focusTop = true) {
      const safeIndex = Math.min(sectionNodes.length - 1, Math.max(0, Number(index) || 0));
      sectionNodes.forEach((node, nodeIndex) => { node.hidden = nodeIndex !== safeIndex; });
      partButtons.forEach((button, buttonIndex) => {
        const active = buttonIndex === safeIndex;
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-current', active ? 'true' : 'false');
      });
      uiState.activeSection[skill] = safeIndex;
      saveUiState();
      if (focusTop) {
        if (skill === 'listening') {
          sectionNodes[safeIndex].scrollTo(0, 0);
        } else {
          sectionNodes[safeIndex].querySelectorAll('.cbt-reading-passage, .cbt-reading-questions').forEach(node => node.scrollTo(0, 0));
        }
      }
    }

    function applyFontSize(nextSize) {
      const allowed = [90, 100, 110, 120];
      const selected = allowed.reduce((best, value) => Math.abs(value - nextSize) < Math.abs(best - nextSize) ? value : best, 100);
      uiState.fontSize[skill] = selected;
      viewport.dataset.fontSize = String(selected);
      toolbarParts.sizeValue.textContent = selected + '%';
      saveUiState();
    }

    toolbarParts.smaller.addEventListener('click', () => applyFontSize(uiState.fontSize[skill] - 10));
    toolbarParts.larger.addEventListener('click', () => applyFontSize(uiState.fontSize[skill] + 10));
    applyFontSize(uiState.fontSize[skill]);
    activateSection(uiState.activeSection[skill], false);

    pane.append(toolbarParts.toolbar, viewport);
    return { pane, toolbar: toolbarParts.toolbar, viewport, sectionNodes, items, activateSection };
  }

  function createQuestionNav(skill, source) {
    const wrap = document.createElement('div');
    wrap.className = 'cbt-question-nav-wrap';
    const nav = document.createElement('nav');
    nav.className = 'cbt-question-nav';
    nav.setAttribute('aria-label', 'Điều hướng câu hỏi');
    const legend = document.createElement('p');
    legend.className = 'cbt-nav-legend';
    legend.textContent = 'Viền xanh: đang chọn · Xanh lá: đã làm · Gạch vàng: cần xem lại';
    wrap.append(nav, legend);

    let activeNumber = '';
    const itemByNumber = new Map(source.items.map(item => [item.number, item]));

    function updateItem(item) {
      const answered = Boolean(item.field.value.trim());
      const flagged = Boolean(uiState.flags[skill][item.number]);
      const active = activeNumber === item.number;
      const targetItems = source.items.filter(candidate => candidate.target === item.target);
      item.target.classList.toggle('is-answered', targetItems.some(candidate => Boolean(candidate.field.value.trim())));
      item.target.classList.toggle('is-flagged', targetItems.some(candidate => Boolean(uiState.flags[skill][candidate.number])));
      item.target.classList.toggle('is-active', targetItems.some(candidate => activeNumber === candidate.number));
      item.flagButton.classList.toggle('is-flagged', flagged);
      const button = nav.querySelector('[data-nav-number="' + item.number + '"]');
      if (button) {
        button.classList.toggle('is-answered', answered);
        button.classList.toggle('is-flagged', flagged);
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-label', 'Câu ' + item.number + (answered ? ', đã làm' : ', chưa làm') + (flagged ? ', đã đánh dấu' : ''));
      }
    }

    function refreshAll() {
      source.items.forEach(updateItem);
    }

    function focusItem(item) {
      activeNumber = item.number;
      source.activateSection(item.sectionIndex, false);
      window.requestAnimationFrame(() => {
        const mapWorkspace = item.target.closest('.cbt-map-workspace');
        const scrollTarget = mapWorkspace || item.target;
        scrollTarget.scrollIntoView({
          behavior: 'smooth',
          block: mapWorkspace ? 'start' : 'center',
          inline: 'nearest'
        });
        const focusTarget = item.radios.find(radio => radio.checked) || item.radios[0] || item.field;
        focusTarget.focus({ preventScroll: true });
        refreshAll();
      });
    }

    [...itemByNumber.values()].sort((a, b) => Number(a.number) - Number(b.number)).forEach(item => {
      const button = makeButton('cbt-question-button', item.number);
      button.dataset.navNumber = item.number;
      button.addEventListener('click', () => focusItem(item));
      nav.append(button);

      item.field.addEventListener('input', refreshAll);
      item.field.addEventListener('term-test:draft-restored', refreshAll);
      item.field.addEventListener('focus', () => {
        activeNumber = item.number;
        refreshAll();
      });
      item.radios.forEach(radio => radio.addEventListener('focus', () => {
        activeNumber = item.number;
        refreshAll();
      }));
      item.flagButton.addEventListener('click', event => {
        event.preventDefault();
        uiState.flags[skill][item.number] = !uiState.flags[skill][item.number];
        saveUiState();
        updateItem(item);
      });
    });
    refreshAll();
    return wrap;
  }

  // Dữ liệu vào: bộ đếm câu đã làm và nút nộp gốc của từng kỹ năng.
  // Việc chính: đặt hai phần tử cạnh nhau trên thanh tiêu đề và xóa khung chân trang rỗng.
  // Kết quả: nút nộp vẫn nằm trong form nên validation, trạng thái bận và API giữ nguyên.
  // Khi thiếu phần tử: không thay đổi DOM của form để luồng nộp bài cũ tiếp tục hoạt động.
  function placeSubmitInHeading(skill, heading, actions) {
    const count = document.getElementById(skill + 'Count');
    const saveStatus = document.getElementById(skill + 'SaveStatus');
    const saveMeta = count?.closest('.answer-save-meta');
    const submit = actions.querySelector('button[type="submit"]');
    if (!count || !submit) return false;

    const cluster = document.createElement('div');
    cluster.className = 'cbt-heading-actions';
    submit.classList.add('cbt-heading-submit');
    if (saveStatus) cluster.append(count, saveStatus, submit);
    else cluster.append(count, submit);
    heading.append(cluster);
    saveMeta?.remove();
    actions.remove();
    return true;
  }

  function enhanceForm(skill) {
    const form = document.getElementById(skill + 'View');
    const grid = document.getElementById(skill + 'Questions');
    const heading = form?.querySelector('.section-heading');
    const actions = form?.querySelector('.form-actions');
    if (!form || !grid || !heading || !actions) return null;

    const fields = collectFields(grid);
    const submitMoved = placeSubmitInHeading(skill, heading, actions);
    const source = createSemanticPane(skill, contentConfig[skill], heading, fields);
    grid.className = 'questions-grid cbt-semantic-stage';
    grid.replaceChildren(source.pane);
    const nav = createQuestionNav(skill, source);
    if (submitMoved) {
      form.append(nav);
    } else {
      actions.classList.add('cbt-form-actions');
      form.insertBefore(nav, actions);
    }
    form.classList.add('cbt-test-form', 'cbt-' + skill + '-form');
    return { form, source };
  }

  // Dữ liệu vào: file audio gốc, giao diện Listening và trạng thái phiên thi trong bộ nhớ trình duyệt.
  // Việc chính: ẩn toàn bộ đề, tải đủ audio, cho nghe thử tối đa 30 giây rồi mới bắt đầu bài thật từ giây 0.
  // Kết quả: học viên không thể xem trước đề; khi audio chính thức phát thành công thì đề và ô trả lời mới xuất hiện.
  // Khi lỗi: phòng chờ vẫn giữ đề bị khóa, giải thích rõ và cho tải lại mà không làm mất draft.
  function setupBufferedAudio(listeningForm) {
    if (!listeningForm) return;
    const protectedBootstrap = window.TERM_TEST_BOOTSTRAP || null;
    const preparedVolume = Number(protectedBootstrap?.audioVolume);
    if (Number.isFinite(preparedVolume) && preparedVolume >= 0.1 && preparedVolume <= 1) {
      uiState.audio.volume = preparedVolume;
      saveUiState();
    }
    const studentSelect = document.getElementById('studentSelect');
    const identityPanel = document.getElementById('identityView');
    const identityTitle = document.getElementById('identityTitle');
    const examRegions = [
      listeningForm.form.querySelector('.cbt-semantic-stage'),
      listeningForm.form.querySelector('.cbt-question-nav-wrap')
    ].filter(Boolean);
    const gatedControls = examRegions.flatMap(region => [...region.querySelectorAll('button, input, select, textarea')]);
    const initialDisabled = new Map(gatedControls.map(control => [control, control.disabled]));

    const lobby = document.createElement('section');
    lobby.className = 'cbt-listening-lobby';
    lobby.setAttribute('aria-labelledby', 'cbtListeningLobbyTitle');

    const lobbyHeader = document.createElement('header');
    lobbyHeader.className = 'cbt-lobby-header';
    const lobbyBadge = document.createElement('span');
    lobbyBadge.className = 'cbt-lobby-badge';
    lobbyBadge.textContent = 'Phòng chờ Listening';
    const lobbyTitle = document.createElement('h2');
    lobbyTitle.id = 'cbtListeningLobbyTitle';
    lobbyTitle.textContent = uiState.audio.started ? 'Tiếp tục bài thi Listening' : 'Kiểm tra âm thanh trước khi bắt đầu';
    const lobbyLead = document.createElement('p');
    lobbyLead.textContent = uiState.audio.started
      ? 'Bài thi của bạn đã bắt đầu. Đề sẽ mở lại khi audio tải đủ và tiếp tục phát.'
      : 'Đề Listening đang được khóa. Hãy hoàn thành ba bước dưới đây; audio thi thật sẽ quay về đầu khi bạn bắt đầu.';
    lobbyHeader.append(lobbyBadge, lobbyTitle, lobbyLead);

    function createLobbyStep(number, title, description) {
      const step = document.createElement('section');
      step.className = 'cbt-lobby-step';
      const numberNode = document.createElement('span');
      numberNode.className = 'cbt-lobby-step-number';
      numberNode.textContent = String(number);
      const body = document.createElement('div');
      body.className = 'cbt-lobby-step-body';
      const heading = document.createElement('h3');
      heading.textContent = title;
      const copy = document.createElement('p');
      copy.textContent = description;
      body.append(heading, copy);
      step.append(numberNode, body);
      return { step, body, copy };
    }

    const downloadStep = createLobbyStep(1, 'Tải đủ audio', 'Chờ thanh tải đạt 100%. Đề vẫn bị khóa trong lúc tải.');
    const downloadStatus = document.createElement('strong');
    downloadStatus.className = 'cbt-audio-status cbt-lobby-download-status';
    downloadStatus.setAttribute('role', 'status');
    downloadStatus.textContent = 'Đang tải audio...';
    const downloadProgress = document.createElement('progress');
    downloadProgress.className = 'cbt-audio-progress';
    downloadProgress.max = 1;
    downloadProgress.value = 0;
    const retryButton = makeButton('cbt-audio-retry', 'Tải lại audio');
    retryButton.hidden = true;
    downloadStep.body.append(downloadStatus, downloadProgress, retryButton);

    const previewStep = createLobbyStep(2, 'Nghe thử 30 giây', 'Nghe đoạn đầu và chỉnh âm lượng cho vừa tai. Mức này được giữ nguyên cho toàn bộ bài thi Listening.');
    const previewControls = document.createElement('div');
    previewControls.className = 'cbt-lobby-preview-controls';
    const previewButton = makeButton('cbt-audio-preview', 'Nghe thử 30 giây đầu');
    previewButton.disabled = true;
    const volume = document.createElement('label');
    volume.className = 'cbt-volume cbt-lobby-volume';
    const volumeText = document.createElement('span');
    volumeText.textContent = 'Âm lượng';
    const volumeInput = document.createElement('input');
    volumeInput.type = 'range';
    volumeInput.min = '0.1';
    volumeInput.max = '1';
    volumeInput.step = '0.1';
    volumeInput.value = String(uiState.audio.volume);
    volumeInput.disabled = true;
    volume.append(volumeText, volumeInput);
    previewControls.append(previewButton, volume);
    const previewStatus = document.createElement('span');
    previewStatus.className = 'cbt-preview-status';
    previewStatus.setAttribute('role', 'status');
    previewStatus.textContent = 'Chờ tải audio xong để nghe thử.';
    previewStep.body.append(previewControls, previewStatus);

    const startStep = createLobbyStep(3, 'Bắt đầu thi', 'Khi đã nghe rõ, bấm nút dưới đây. Audio chính thức và đề sẽ cùng bắt đầu.');
    const startButton = makeButton('cbt-start-listening', uiState.audio.started ? 'Tiếp tục bài thi Listening' : 'Bắt đầu thi Listening');
    startButton.disabled = true;
    const startNotice = document.createElement('p');
    startNotice.className = 'cbt-start-notice';
    startNotice.textContent = uiState.audio.started
      ? 'Audio sẽ tiếp tục từ vị trí gần nhất đã lưu.'
      : 'Sau khi bắt đầu, bạn không thể quay lại chế độ nghe thử.';
    startStep.body.append(startButton, startNotice);

    const steps = document.createElement('div');
    steps.className = 'cbt-lobby-steps';
    steps.append(downloadStep.step, previewStep.step, startStep.step);
    lobby.append(lobbyHeader, steps);
    listeningForm.form.prepend(lobby);

    const examCard = document.createElement('section');
    examCard.className = 'cbt-audio-card';
    examCard.setAttribute('aria-label', 'Trạng thái audio Listening');
    examCard.hidden = true;
    const examCopy = document.createElement('div');
    examCopy.className = 'cbt-audio-copy';
    const examLabel = document.createElement('strong');
    examLabel.textContent = contentConfig.audio.label;
    const examStatus = document.createElement('span');
    examStatus.className = 'cbt-audio-status';
    examStatus.setAttribute('role', 'status');
    examCopy.append(examLabel, examStatus);
    const examControls = document.createElement('div');
    examControls.className = 'cbt-audio-controls';
    const resumeButton = makeButton('cbt-audio-play', 'Tiếp tục audio');
    resumeButton.hidden = true;
    const examRetryButton = makeButton('cbt-audio-retry', 'Khôi phục audio');
    examRetryButton.hidden = true;
    const playbackProgress = document.createElement('progress');
    playbackProgress.className = 'cbt-audio-progress';
    playbackProgress.max = 1;
    playbackProgress.value = 0;
    const examVolume = volume.cloneNode(true);
    examVolume.classList.remove('cbt-lobby-volume');
    const examVolumeInput = examVolume.querySelector('input');
    examVolumeInput.disabled = false;
    examControls.append(resumeButton, examRetryButton, playbackProgress, examVolume);
    examCard.append(examCopy, examControls);
    listeningForm.source.toolbar.append(examCard);

    const audio = protectedBootstrap?.officialAudioElement || document.createElement('audio');
    audio.preload = 'auto';
    audio.volume = uiState.audio.volume;
    audio.hidden = true;
    lobby.append(audio);

    let lastSavedSecond = Math.floor(uiState.audio.time);
    let examStarted = Boolean(protectedBootstrap?.officialAudioElement || uiState.audio.started);
    let previewHeard = false;
    let previewing = false;
    let ready = false;
    let allowPause = false;
    let downloadRun = 0;
    let downloadController = null;
    let objectUrl = protectedBootstrap?.officialAudioUrl || '';

    function readSavedStudentRef() {
      for (const storage of [sessionStorage, localStorage]) {
        try {
          const ref = String(JSON.parse(storage.getItem(submissionStorageKey) || '{}').studentRef || '');
          if (ref) return ref;
        } catch {
          // Tiếp tục với nguồn bộ nhớ còn lại nếu dữ liệu trình duyệt bị lỗi.
        }
      }
      return '';
    }

    function restoreStudentSelection() {
      if (!studentSelect) return '';
      const savedRef = readSavedStudentRef();
      if (savedRef && [...studentSelect.options].some(option => option.value === savedRef)) {
        studentSelect.value = savedRef;
      }
      return studentSelect.value;
    }

    function hasSelectedStudent() {
      return Boolean(restoreStudentSelection());
    }

    function updateStartAvailability() {
      const audioReady = ready && (examStarted || previewHeard);
      const identityReady = hasSelectedStudent();
      startButton.disabled = !(audioReady && identityReady);
      if (audioReady && !identityReady) {
        startNotice.textContent = 'Hãy chọn họ và tên ở phía trên trước khi bắt đầu thi Listening.';
      } else {
        startNotice.textContent = examStarted
          ? 'Audio sẽ tiếp tục từ vị trí gần nhất đã lưu.'
          : 'Sau khi bắt đầu, họ tên được khóa và bạn không thể quay lại chế độ nghe thử.';
      }
    }

    function lockStudentSelection() {
      if (!studentSelect || !restoreStudentSelection()) return false;
      studentSelect.disabled = true;
      studentSelect.setAttribute('aria-label', 'Họ và tên đã xác nhận');
      if (identityPanel) identityPanel.dataset.studentLocked = 'true';
      if (identityTitle) identityTitle.textContent = 'Họ và tên đã xác nhận';
      return true;
    }

    function setStepState(step, state) {
      step.dataset.state = state;
    }

    function setListeningVisible(visible) {
      listeningForm.form.classList.toggle('cbt-listening-locked', !visible);
      for (const control of gatedControls) {
        control.disabled = visible ? Boolean(initialDisabled.get(control)) : true;
      }
      for (const region of examRegions) {
        region.hidden = !visible;
        region.inert = !visible;
        region.setAttribute('aria-hidden', visible ? 'false' : 'true');
      }
      lobby.hidden = visible;
      examCard.hidden = !visible;
    }

    function formatBytes(bytes) {
      if (!Number.isFinite(bytes) || bytes <= 0) return '0 MB';
      return (bytes / 1024 / 1024).toFixed(1) + ' MB';
    }

    function revokeAudioUrl() {
      if (!objectUrl) return;
      URL.revokeObjectURL(objectUrl);
      objectUrl = '';
    }

    function failDownload(message) {
      ready = false;
      listeningForm.form.setAttribute('aria-busy', 'false');
      setListeningVisible(false);
      setStepState(downloadStep.step, 'error');
      setStepState(previewStep.step, 'locked');
      setStepState(startStep.step, 'locked');
      previewButton.disabled = true;
      volumeInput.disabled = true;
      startButton.disabled = true;
      retryButton.hidden = false;
      downloadProgress.removeAttribute('value');
      downloadStatus.textContent = message;
    }

    function restoreOfficialTime() {
      if (protectedBootstrap?.officialAudioElement || !examStarted || !Number.isFinite(audio.duration)) return;
      const safeTime = Math.min(Math.max(0, uiState.audio.time), Math.max(0, audio.duration - 1));
      audio.currentTime = safeTime;
    }

    function updateExamStatus(prefix) {
      if (!ready || !examStarted) return;
      const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
      const current = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
      playbackProgress.max = duration || 1;
      playbackProgress.value = current;
      examStatus.textContent = prefix + ' · ' + formatTime(current) + ' / '
        + (duration ? formatTime(duration) : contentConfig.audio.durationLabel);
    }

    audio.addEventListener('loadedmetadata', () => {
      ready = true;
      restoreOfficialTime();
      listeningForm.form.setAttribute('aria-busy', 'false');
      downloadProgress.max = 1;
      downloadProgress.value = 1;
      retryButton.hidden = true;
      volumeInput.disabled = false;
      setStepState(downloadStep.step, 'complete');
      if (examStarted) {
        downloadStatus.textContent = 'Đã tải đủ audio · sẵn sàng tiếp tục bài thi.';
        previewButton.hidden = true;
        previewStatus.textContent = 'Chế độ nghe thử đã đóng vì bài thi đã bắt đầu.';
        setStepState(previewStep.step, 'skipped');
        setStepState(startStep.step, 'active');
      } else {
        downloadStatus.textContent = 'Đã tải đủ audio · 100%.';
        previewButton.hidden = false;
        previewButton.disabled = false;
        setStepState(previewStep.step, previewHeard ? 'complete' : 'active');
        setStepState(startStep.step, previewHeard ? 'active' : 'locked');
        previewStatus.textContent = previewHeard
          ? 'Đã nghe thử. Khi âm lượng vừa tai, bạn có thể bắt đầu thi.'
          : 'Bấm “Nghe thử 30 giây đầu” để kiểm tra âm lượng.';
      }
      updateStartAvailability();
    });
    audio.addEventListener('timeupdate', () => {
      if (previewing && !examStarted) {
        const previewTime = Math.min(30, Number.isFinite(audio.currentTime) ? audio.currentTime : 0);
        previewStatus.textContent = 'Đang nghe thử · ' + formatTime(previewTime) + ' / 00:30';
        if (previewTime >= 30) {
          allowPause = true;
          audio.pause();
          allowPause = false;
          previewing = false;
          previewButton.textContent = 'Nghe lại 30 giây đầu';
          previewStatus.textContent = 'Đã nghe hết 30 giây thử. Nếu âm lượng vừa tai, bạn có thể bắt đầu thi.';
        }
        return;
      }
      if (!examStarted) return;
      updateExamStatus(audio.paused ? 'Audio đang bị gián đoạn' : 'Đang phát bài thi');
      const currentSecond = Math.floor(audio.currentTime);
      if (currentSecond - lastSavedSecond >= 5) {
        lastSavedSecond = currentSecond;
        uiState.audio.time = audio.currentTime;
        saveUiState();
      }
    });
    audio.addEventListener('ended', () => {
      if (!examStarted) {
        previewing = false;
        previewButton.textContent = 'Nghe lại 30 giây đầu';
        previewStatus.textContent = 'Đã nghe hết đoạn thử. Nếu âm lượng vừa tai, bạn có thể bắt đầu thi.';
        return;
      }
      uiState.audio.time = audio.duration || uiState.audio.time;
      resumeButton.hidden = true;
      updateExamStatus('Đã phát xong');
      saveUiState();
    });
    audio.addEventListener('pause', () => {
      if (!examStarted || audio.ended || allowPause || examCard.hidden) return;
      audio.play().catch(() => {
        resumeButton.hidden = false;
        updateExamStatus('Audio đang bị gián đoạn · nhấn Tiếp tục audio');
      });
    });
    audio.addEventListener('error', () => {
      if (!ready) {
        failDownload('File audio tải xong nhưng trình duyệt không đọc được. Hãy nhấn “Tải lại audio”.');
      } else if (examStarted) {
        examStatus.textContent = 'Không thể phát audio. Hãy nhấn “Khôi phục audio”.';
        examRetryButton.hidden = false;
      } else {
        failDownload('Không thể phát đoạn nghe thử. Hãy nhấn “Tải lại audio”.');
      }
    });

    async function downloadFullAudio() {
      downloadRun += 1;
      const currentRun = downloadRun;
      downloadController?.abort();
      downloadController = new AbortController();
      allowPause = true;
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
      allowPause = false;
      revokeAudioUrl();
      ready = false;
      previewing = false;
      setListeningVisible(false);
      listeningForm.form.setAttribute('aria-busy', 'true');
      setStepState(downloadStep.step, 'active');
      setStepState(previewStep.step, examStarted ? 'skipped' : 'locked');
      setStepState(startStep.step, 'locked');
      previewButton.disabled = true;
      volumeInput.disabled = true;
      startButton.disabled = true;
      retryButton.hidden = true;
      examRetryButton.hidden = true;
      downloadProgress.max = 1;
      downloadProgress.value = 0;
      downloadStatus.textContent = examStarted
        ? 'Đang tải đủ audio để tiếp tục bài thi...'
        : 'Đang tải đủ audio trước khi cho nghe thử...';
      try {
        const loader = window.TERM_TEST_AUDIO_LOADER?.downloadAudio;
        if (!loader) throw new Error('AUDIO_LOADER_MISSING');
        const blob = await loader(contentConfig.audio.src, {
          signal: downloadController.signal,
          onProgress: ({ loaded, total, complete }) => {
            if (currentRun !== downloadRun) return;
            if (total > 0) {
              downloadProgress.max = total;
              downloadProgress.value = loaded;
              const percent = Math.min(100, Math.round(loaded * 100 / total));
              downloadStatus.textContent = (complete ? 'Đã tải đủ' : 'Đang tải audio')
                + ' · ' + percent + '% · ' + formatBytes(loaded) + ' / ' + formatBytes(total);
            } else {
              downloadProgress.removeAttribute('value');
              downloadStatus.textContent = 'Đang tải audio · ' + formatBytes(loaded);
            }
          }
        });
        if (currentRun !== downloadRun) return;
        objectUrl = URL.createObjectURL(blob);
        audio.src = objectUrl;
        audio.load();
      } catch (error) {
        if (currentRun !== downloadRun || error?.name === 'AbortError') return;
        failDownload('Chưa tải đủ audio nên bài vẫn đang khóa. Kiểm tra mạng rồi nhấn “Tải lại audio”.');
      }
    }

    previewButton.addEventListener('click', async () => {
      if (!ready || examStarted) return;
      if (previewing && !audio.paused) {
        allowPause = true;
        audio.pause();
        allowPause = false;
        previewing = false;
        previewButton.textContent = 'Nghe lại 30 giây đầu';
        previewStatus.textContent = 'Đã dừng nghe thử. Khi âm lượng vừa tai, bạn có thể bắt đầu thi.';
        return;
      }
      audio.currentTime = 0;
      previewing = true;
      try {
        await audio.play();
        previewHeard = true;
        previewButton.textContent = 'Dừng nghe thử';
        setStepState(previewStep.step, 'complete');
        setStepState(startStep.step, 'active');
        previewStatus.textContent = 'Đang nghe thử · 00:00 / 00:30';
        updateStartAvailability();
      } catch {
        previewing = false;
        previewStatus.textContent = 'Trình duyệt chưa cho phép phát. Hãy nhấn lại nút nghe thử.';
      }
    });
    startButton.addEventListener('click', async () => {
      if (!ready || (!examStarted && !previewHeard)) return;
      if (!restoreStudentSelection()) {
        studentSelect?.reportValidity();
        studentSelect?.focus();
        identityPanel?.scrollIntoView({ block: 'center', behavior: 'smooth' });
        updateStartAvailability();
        return;
      }
      allowPause = true;
      audio.pause();
      previewing = false;
      const officialTime = examStarted ? uiState.audio.time : 0;
      audio.currentTime = Math.min(Math.max(0, officialTime), Math.max(0, (audio.duration || 1) - 1));
      try {
        await audio.play();
        examStarted = true;
        uiState.audio.started = true;
        uiState.audio.time = audio.currentTime;
        lastSavedSecond = Math.floor(audio.currentTime);
        allowPause = false;
        lockStudentSelection();
        setListeningVisible(true);
        updateExamStatus('Đang phát bài thi');
        saveUiState();
      } catch {
        allowPause = false;
        downloadStatus.textContent = 'Trình duyệt chưa cho phép phát audio. Hãy nhấn lại “Bắt đầu thi Listening”.';
      }
    });
    resumeButton.addEventListener('click', async () => {
      try {
        await audio.play();
        resumeButton.hidden = true;
        updateExamStatus('Đang phát bài thi');
      } catch {
        updateExamStatus('Chưa thể phát · hãy nhấn lại Tiếp tục audio');
      }
    });
    retryButton.addEventListener('click', downloadFullAudio);
    examRetryButton.addEventListener('click', protectedBootstrap?.officialAudioElement
      ? () => window.location.reload()
      : downloadFullAudio);
    function applyVolume(value) {
      const nextVolume = Number(value);
      audio.volume = nextVolume;
      uiState.audio.volume = nextVolume;
      volumeInput.value = String(nextVolume);
      examVolumeInput.value = String(nextVolume);
      saveUiState();
    }
    volumeInput.addEventListener('input', () => applyVolume(volumeInput.value));
    examVolumeInput.addEventListener('input', () => applyVolume(examVolumeInput.value));
    studentSelect?.addEventListener('change', updateStartAvailability);
    if (studentSelect) {
      new MutationObserver(updateStartAvailability).observe(studentSelect, { childList: true });
    }
    listeningForm.form.addEventListener('submit', () => {
      allowPause = true;
      audio.pause();
      if (examStarted) uiState.audio.time = audio.currentTime;
      saveUiState();
    });
    window.addEventListener('pagehide', () => {
      allowPause = true;
      if (examStarted) uiState.audio.time = audio.currentTime;
      saveUiState();
      downloadController?.abort();
      revokeAudioUrl();
    });

    if (protectedBootstrap?.officialAudioElement) {
      ready = true;
      uiState.audio.started = true;
      uiState.audio.time = audio.currentTime || 0;
      lockStudentSelection();
      setListeningVisible(true);
      updateExamStatus(audio.ended ? 'Đã phát xong' : 'Đang phát bài thi');
      saveUiState();
    } else {
      setListeningVisible(false);
      downloadFullAudio();
    }
  }

  // Dữ liệu vào: deadline Listening do máy chủ tạo khi học viên bấm Bắt đầu.
  // Việc chính: theo dõi deadline ở chế độ nền và khóa/tự nộp đúng hạn, không hiện số giây gây mất tập trung.
  // Kết quả: audio kết thúc không tạo thêm thời gian làm vô hạn; lần thử lại vẫn dùng bản đáp án đã khóa.
  // Khi lỗi mạng: form tiếp tục bị khóa và shared/app.js tự thử gửi lại cùng một payload.
  function setupListeningTimer(listeningForm) {
    if (!listeningForm) return;
    const autoSubmit = makeButton('cbt-listening-auto-submit', 'Tự nộp bài Listening');
    autoSubmit.type = 'submit';
    autoSubmit.hidden = true;
    autoSubmit.dataset.autoSubmit = 'true';
    autoSubmit.tabIndex = -1;
    listeningForm.form.append(autoSubmit);
    let intervalId = 0;
    let lastAttempt = 0;

    function readExamState() {
      for (const storage of [sessionStorage, localStorage]) {
        try {
          const parsed = JSON.parse(storage.getItem(submissionStorageKey) || '{}');
          if (parsed.listeningDeadlineAt) return parsed;
        } catch {
          // Tiếp tục với nguồn bộ nhớ còn lại.
        }
      }
      return {};
    }

    function lockAndSubmit(now) {
      if (window.TERM_TEST_DEADLINE_GUARD_ACTIVE) return;
      if (listeningForm.form.dataset.listeningSubmitting === 'true' || now - lastAttempt < 15_000) return;
      lastAttempt = now;
      listeningForm.form.dataset.listeningTimeExpired = 'true';
      for (const control of listeningForm.form.querySelectorAll('input, select, textarea, .cbt-choice input')) {
        control.disabled = true;
      }
      listeningForm.form.requestSubmit(autoSubmit);
    }

    function render() {
      const exam = readExamState();
      const deadline = Date.parse(exam.listeningDeadlineAt || '');
      if (!Number.isFinite(deadline)) return;
      const serverOffset = Number(exam.serverTimeOffsetMs) || 0;
      const remaining = Math.max(0, deadline - (Date.now() + serverOffset));
      if (remaining === 0) lockAndSubmit(Date.now());
    }
    render();
    intervalId = window.setInterval(render, 1000);
    listeningForm.form.addEventListener('term-test:listening-submitted', () => window.clearInterval(intervalId));
    window.addEventListener('pagehide', () => window.clearInterval(intervalId));
  }

  // Dữ liệu vào: form Reading, mốc kết thúc đã lưu và trạng thái gửi bài của shared/app.js.
  // Việc chính: bắt đầu 60 phút khi đề Reading xuất hiện, cảnh báo 10 phút cuối và tự gửi khi hết giờ.
  // Kết quả: tải lại trang không được cộng lại thời gian; bài hết giờ tự chấm, đồng bộ Portal rồi chuyển sang Writing.
  // Khi lỗi mạng: giữ nguyên draft và thử nộp lại mỗi 15 giây trong lúc trang Reading còn mở.
  function setupReadingTimer(readingForm) {
    if (!readingForm) return;
    const headingActions = readingForm.form.querySelector('.cbt-heading-actions');
    if (!headingActions) return;

    const retryDelayMs = 15 * 1000;
    const clock = document.createElement('div');
    clock.className = 'cbt-reading-clock';
    clock.setAttribute('role', 'timer');
    clock.setAttribute('aria-live', 'polite');
    clock.setAttribute('aria-label', 'Thời gian còn lại của bài Reading');
    const clockLabel = document.createElement('span');
    clockLabel.textContent = 'Còn';
    const clockValue = document.createElement('strong');
    clockValue.textContent = String(readingMinutes);
    const clockTotal = document.createElement('span');
    clockTotal.textContent = `/ ${readingMinutes} phút`;
    clock.append(clockLabel, clockValue, clockTotal);
    headingActions.prepend(clock);

    const autoSubmitButton = makeButton('cbt-reading-auto-submit', 'Tự nộp bài Reading');
    autoSubmitButton.type = 'submit';
    autoSubmitButton.hidden = true;
    autoSubmitButton.dataset.autoSubmit = 'true';
    autoSubmitButton.tabIndex = -1;
    readingForm.form.append(autoSubmitButton);

    let intervalId = 0;
    let lastRenderedMinute = null;
    let lastAutoSubmitAttempt = 0;

    function readAttemptToken() {
      for (const storage of [sessionStorage, localStorage]) {
        try {
          const token = String(JSON.parse(storage.getItem(submissionStorageKey) || '{}').attemptToken || '');
          if (token) return token;
        } catch {
          // Tiếp tục kiểm tra nguồn bộ nhớ còn lại.
        }
      }
      return '';
    }

    function stopTimer() {
      if (intervalId) window.clearInterval(intervalId);
      intervalId = 0;
    }

    function submitExpiredReading(now) {
      if (window.TERM_TEST_DEADLINE_GUARD_ACTIVE) return;
      if (readingForm.form.hidden || readingForm.form.dataset.readingSubmitting === 'true') return;
      if (now - lastAutoSubmitAttempt < retryDelayMs) return;
      lastAutoSubmitAttempt = now;
      readingForm.form.dataset.readingTimeExpired = 'true';
      readingForm.form.requestSubmit(autoSubmitButton);
    }

    function renderTimer() {
      if (readingForm.form.hidden || !uiState.readingTimer.deadline) return;
      const now = Date.now();
      const remainingMs = Math.max(0, uiState.readingTimer.deadline - now);
      const minutes = Math.ceil(remainingMs / 60_000);
      if (minutes !== lastRenderedMinute) {
        lastRenderedMinute = minutes;
        clockValue.textContent = String(minutes);
        clock.dataset.minutes = String(minutes);
        clock.classList.toggle('is-warning', minutes <= 10 && minutes > 0);
        clock.classList.toggle('is-expired', minutes === 0);
        clock.setAttribute('aria-label', minutes > 0
          ? 'Còn ' + minutes + ` trên ${readingMinutes} phút làm bài Reading`
          : `Đã hết ${readingMinutes} phút làm bài Reading; hệ thống đang tự nộp bài`);
      }
      if (remainingMs === 0) submitExpiredReading(now);
    }

    function startTimer() {
      if (readingForm.form.hidden || intervalId) return;
      const attemptToken = readAttemptToken();
      if (attemptToken && uiState.readingTimer.attemptToken !== attemptToken) {
        uiState.readingTimer.deadline = 0;
        uiState.readingTimer.attemptToken = attemptToken;
      }
      for (const storage of [sessionStorage, localStorage]) {
        try {
          const session = JSON.parse(storage.getItem(submissionStorageKey) || '{}');
          const deadline = Date.parse(session.readingDeadlineAt || '');
          if (Number.isFinite(deadline)) uiState.readingTimer.deadline = deadline - (Number(session.serverTimeOffsetMs) || 0);
        } catch {
          // Tiếp tục với nguồn bộ nhớ còn lại.
        }
      }
      if (!uiState.readingTimer.deadline) return;
      renderTimer();
      intervalId = window.setInterval(renderTimer, 1000);
    }

    const visibilityObserver = new MutationObserver(() => {
      if (readingForm.form.hidden) stopTimer();
      else startTimer();
    });
    visibilityObserver.observe(readingForm.form, { attributes: true, attributeFilter: ['hidden'] });
    readingForm.form.addEventListener('term-test:reading-submitted', stopTimer);
    window.addEventListener('pagehide', () => {
      stopTimer();
      visibilityObserver.disconnect();
    });
    startTimer();
  }

  // Dữ liệu vào: form Writing, attempt token đã chốt sau Reading và hạn giờ lưu trong bộ nhớ trình duyệt.
  // Việc chính: chạy 60 phút từ lúc Writing mở, cảnh báo 10 phút cuối và gọi đúng luồng nộp Writing khi hết giờ.
  // Kết quả: bản mới nhất được gửi lên database, sau đó hệ thống tự mở kết quả Listening và Reading.
  // Khi lỗi mạng: bài vẫn được giữ trên máy/database và hệ thống thử tự nộp lại mỗi 15 giây.
  function setupWritingTimer() {
    const form = document.getElementById('writingView');
    const header = form?.querySelector('.writing-exam-header');
    if (!form || !header) return;

    const retryDelayMs = 15 * 1000;
    const clock = document.createElement('div');
    clock.className = 'cbt-reading-clock cbt-writing-clock';
    clock.setAttribute('role', 'timer');
    clock.setAttribute('aria-live', 'polite');
    clock.setAttribute('aria-label', 'Thời gian còn lại của bài Writing');
    const clockLabel = document.createElement('span');
    clockLabel.textContent = 'Còn';
    const clockValue = document.createElement('strong');
    clockValue.textContent = String(writingMinutes);
    const clockTotal = document.createElement('span');
    clockTotal.textContent = `/ ${writingMinutes} phút`;
    clock.append(clockLabel, clockValue, clockTotal);
    header.insertBefore(clock, document.getElementById('submitWriting'));

    const autoSubmitButton = makeButton('cbt-writing-auto-submit', 'Tự nộp bài Writing');
    autoSubmitButton.type = 'submit';
    autoSubmitButton.hidden = true;
    autoSubmitButton.dataset.autoSubmit = 'true';
    autoSubmitButton.tabIndex = -1;
    form.append(autoSubmitButton);

    let intervalId = 0;
    let lastRenderedMinute = null;
    let lastAutoSubmitAttempt = 0;

    function readAttemptToken() {
      for (const storage of [sessionStorage, localStorage]) {
        try {
          const token = String(JSON.parse(storage.getItem(submissionStorageKey) || '{}').attemptToken || '');
          if (token) return token;
        } catch {
          // Tiếp tục kiểm tra nguồn bộ nhớ còn lại.
        }
      }
      return '';
    }

    function stopTimer() {
      if (intervalId) window.clearInterval(intervalId);
      intervalId = 0;
    }

    function submitExpiredWriting(now) {
      if (form.hidden || form.dataset.writingSubmitting === 'true') return;
      if (now - lastAutoSubmitAttempt < retryDelayMs) return;
      lastAutoSubmitAttempt = now;
      form.dataset.writingTimeExpired = 'true';
      form.requestSubmit(autoSubmitButton);
    }

    function renderTimer() {
      if (form.hidden || !uiState.writingTimer.deadline) return;
      const now = Date.now();
      const remainingMs = Math.max(0, uiState.writingTimer.deadline - now);
      const minutes = Math.ceil(remainingMs / 60_000);
      if (minutes !== lastRenderedMinute) {
        lastRenderedMinute = minutes;
        clockValue.textContent = String(minutes);
        clock.dataset.minutes = String(minutes);
        clock.classList.toggle('is-warning', minutes <= 10 && minutes > 0);
        clock.classList.toggle('is-expired', minutes === 0);
        clock.setAttribute('aria-label', minutes > 0
          ? 'Còn ' + minutes + ` trên ${writingMinutes} phút làm bài Writing`
          : `Đã hết ${writingMinutes} phút làm bài Writing; hệ thống đang tự nộp bài`);
      }
      if (remainingMs === 0) submitExpiredWriting(now);
    }

    function startTimer() {
      if (form.hidden || intervalId) return;
      const attemptToken = readAttemptToken();
      if (!attemptToken) return;
      if (uiState.writingTimer.attemptToken !== attemptToken) {
        uiState.writingTimer.deadline = 0;
        uiState.writingTimer.attemptToken = attemptToken;
      }
      for (const storage of [sessionStorage, localStorage]) {
        try {
          const session = JSON.parse(storage.getItem(submissionStorageKey) || '{}');
          const deadline = Date.parse(session.writingDeadlineAt || '');
          if (Number.isFinite(deadline)) uiState.writingTimer.deadline = deadline - (Number(session.serverTimeOffsetMs) || 0);
        } catch {
          // Tiếp tục với nguồn bộ nhớ còn lại.
        }
      }
      if (!uiState.writingTimer.deadline) return;
      renderTimer();
      intervalId = window.setInterval(renderTimer, 1000);
    }

    const visibilityObserver = new MutationObserver(() => {
      if (form.hidden) stopTimer();
      else startTimer();
    });
    visibilityObserver.observe(form, { attributes: true, attributeFilter: ['hidden'] });
    form.addEventListener('term-test:writing-submitted', stopTimer);
    window.addEventListener('pagehide', () => {
      stopTimer();
      visibilityObserver.disconnect();
    });
    startTimer();
  }

  document.body.classList.add('cbt-mode', 'cbt-semantic-mode');
  compactIdentityPanel();
  const topbarTitle = document.querySelector('.topbar h1');
  if (topbarTitle) topbarTitle.textContent = testConfig.title;

  const loadingLabel = document.querySelector('#loadingView strong');
  const listeningSavedCopy = document.querySelector('#listeningSavedView > p:not(.eyebrow)');
  if (loadingLabel) loadingLabel.textContent = 'Đang chuẩn bị đề thi HTML...';
  if (listeningSavedCopy) listeningSavedCopy.textContent = 'Hệ thống đã ghi bài Listening. Kết quả đang được giữ kín; khi sẵn sàng, mở Reading để tiếp tục làm bài.';

  const listeningInstructions = document.getElementById('listeningInstructions');
  const readingInstructions = document.getElementById('readingInstructions');
  if (listeningInstructions) replaceInstructions(listeningInstructions, contentConfig.listening.instructions);
  if (readingInstructions) replaceInstructions(readingInstructions, contentConfig.reading.instructions);

  const listeningForm = enhanceForm('listening');
  const readingForm = enhanceForm('reading');
  if (!isDemo) {
    if (!window.TERM_TEST_BOOTSTRAP?.skipListeningAudio) {
      setupBufferedAudio(listeningForm);
      setupListeningTimer(listeningForm);
    }
    setupReadingTimer(readingForm);
    setupWritingTimer();
  }
  window.addEventListener('pagehide', saveUiState);
}());

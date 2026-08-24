(function () {
  'use strict';

  function createNode(tag, className = '', text = '') {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== '') node.textContent = text;
    return node;
  }

  function countWords(value) {
    const cleaned = String(value || '').trim();
    return cleaned ? cleaned.split(/\s+/).length : 0;
  }

  function answerFor(answers, number) {
    return String(answers?.[String(number)] || '').trim();
  }

  // Dữ liệu vào: HTML đề đã được máy chủ cấp và câu trả lời đã lưu trong database.
  // Việc chính: điền câu trả lời vào đúng ô, đánh dấu lựa chọn đã tick và khóa toàn bộ ở chế độ chỉ đọc.
  // Kết quả: người xem thấy lại đúng ngữ cảnh đề và bài làm nhưng không thể thay đổi dữ liệu.
  // Khi một câu bỏ trống: hiện “Chưa trả lời” ngay tại vị trí ô làm bài.
  function applyAnswers(root, answers) {
    root.querySelectorAll('[data-answer-slot]').forEach(slot => {
      const number = String(slot.dataset.answerSlot || '');
      const value = answerFor(answers, number);
      const answer = createNode(
        'span',
        `attempt-review-answer${value ? '' : ' is-empty'}`,
        value || 'Chưa trả lời'
      );
      answer.setAttribute('aria-label', `Câu ${number}: ${value || 'chưa trả lời'}`);
      slot.replaceChildren(answer);
    });

    root.querySelectorAll('[data-choice-value]').forEach(choice => {
      const card = choice.closest('[data-question-number], [data-question-numbers]');
      const numbers = String(card?.dataset.questionNumbers || card?.dataset.questionNumber || '')
        .split(',')
        .map(value => value.trim())
        .filter(Boolean);
      const selected = numbers.some(number => answerFor(answers, number) === String(choice.dataset.choiceValue || ''));
      choice.classList.toggle('attempt-review-choice-selected', selected);
      choice.setAttribute('aria-checked', String(selected));
    });

    root.querySelectorAll('a').forEach(link => {
      link.setAttribute('target', '_blank');
      link.setAttribute('rel', 'noopener noreferrer');
    });
  }

  function renderListening(review) {
    const panel = createNode('section', 'attempt-review-skill-panel');
    panel.dataset.reviewSkillPanel = 'listening';
    const sections = Array.from(review.content?.listening?.sections || []);
    if (!sections.length) {
      panel.append(createNode('p', 'attempt-review-empty', 'Không có nội dung Listening để hiển thị.'));
      return panel;
    }
    for (const section of sections) {
      const card = createNode('article', 'attempt-review-section attempt-review-listening-section');
      const heading = createNode('header', 'attempt-review-section-heading');
      heading.append(
        createNode('strong', '', section.label || 'Listening'),
        createNode('span', '', section.range || '')
      );
      const content = createNode('div', 'attempt-review-semantic-content');
      content.innerHTML = String(section.html || '');
      applyAnswers(content, review.answers?.listening || {});
      card.append(heading, content);
      panel.append(card);
    }
    return panel;
  }

  function renderReading(review) {
    const panel = createNode('section', 'attempt-review-skill-panel');
    panel.dataset.reviewSkillPanel = 'reading';
    const sections = Array.from(review.content?.reading?.sections || []);
    if (!sections.length) {
      panel.append(createNode('p', 'attempt-review-empty', 'Không có nội dung Reading để hiển thị.'));
      return panel;
    }
    for (const section of sections) {
      const card = createNode('article', 'attempt-review-section attempt-review-reading-section');
      const heading = createNode('header', 'attempt-review-section-heading');
      const headingCopy = document.createElement('div');
      headingCopy.append(
        createNode('strong', '', section.label || 'Reading'),
        createNode('h3', '', section.title || '')
      );
      heading.append(headingCopy, createNode('span', '', section.range || ''));
      const split = createNode('div', 'attempt-review-reading-split');
      const passage = createNode('section', 'attempt-review-passage');
      passage.innerHTML = String(section.passageHtml || '');
      const questions = createNode('section', 'attempt-review-questions attempt-review-semantic-content');
      questions.innerHTML = String(section.questionsHtml || '');
      applyAnswers(questions, review.answers?.reading || {});
      split.append(passage, questions);
      card.append(heading, split);
      panel.append(card);
    }
    return panel;
  }

  function renderWriting(review) {
    const panel = createNode('section', 'attempt-review-skill-panel');
    panel.dataset.reviewSkillPanel = 'writing';
    const tasks = Array.from(review.content?.writing?.tasks || []);
    if (!tasks.length) {
      panel.append(createNode('p', 'attempt-review-empty', 'Không có nội dung Writing để hiển thị.'));
      return panel;
    }
    for (const task of tasks) {
      const essay = String(review.answers?.writing?.[task.id] || '');
      const card = createNode('article', 'attempt-review-section attempt-review-writing-section');
      const heading = createNode('header', 'attempt-review-section-heading');
      heading.append(
        createNode('strong', '', `Writing ${task.label || task.id}`),
        createNode('span', '', `${countWords(essay)} từ`)
      );
      const split = createNode('div', 'attempt-review-writing-split');
      const promptPane = createNode('section', 'attempt-review-writing-prompt');
      promptPane.append(createNode('h3', '', 'Đề bài'), createNode('p', '', task.prompt || ''));
      if (task.followUp) promptPane.append(createNode('p', '', task.followUp));
      if (task.image?.src) {
        const image = document.createElement('img');
        image.src = task.image.src;
        image.alt = task.image.alt || `Hình minh họa ${task.label || ''}`;
        image.loading = 'lazy';
        promptPane.append(image);
      }
      const essayPane = createNode('section', 'attempt-review-writing-essay');
      essayPane.append(
        createNode('h3', '', 'Bài làm đã nộp'),
        createNode('div', `attempt-review-essay-text${essay.trim() ? '' : ' is-empty'}`, essay.trim() || 'Chưa có nội dung')
      );
      split.append(promptPane, essayPane);
      card.append(heading, split);
      panel.append(card);
    }
    return panel;
  }

  function open(review) {
    if (!review || typeof review !== 'object') throw new Error('Dữ liệu bài làm không hợp lệ.');
    document.querySelector('.attempt-review-dialog')?.remove();

    const dialog = document.createElement('dialog');
    dialog.className = 'attempt-review-dialog';
    dialog.setAttribute('aria-labelledby', 'attemptReviewTitle');
    const shell = createNode('div', 'attempt-review-shell');
    const header = createNode('header', 'attempt-review-header');
    const headerCopy = document.createElement('div');
    headerCopy.append(
      createNode('span', '', 'Bài thi đã nộp · Chế độ chỉ đọc'),
      createNode('h2', '', review.studentName || 'Bài làm của học viên'),
      createNode('p', '', 'Nội dung dưới đây giữ nguyên đề và câu trả lời đã lưu; không thể sửa lại bài.')
    );
    headerCopy.querySelector('h2').id = 'attemptReviewTitle';
    const close = createNode('button', 'attempt-review-close', '×');
    close.type = 'button';
    close.setAttribute('aria-label', 'Đóng phần xem lại bài làm');
    close.addEventListener('click', () => dialog.close());
    header.append(headerCopy, close);

    const nav = createNode('nav', 'attempt-review-tabs');
    nav.setAttribute('aria-label', 'Chọn kỹ năng muốn xem lại');
    const body = createNode('div', 'attempt-review-body');
    const panels = [renderListening(review), renderReading(review), renderWriting(review)];
    const labels = { listening: 'Listening', reading: 'Reading', writing: 'Writing' };

    function activate(skill) {
      panels.forEach(panel => { panel.hidden = panel.dataset.reviewSkillPanel !== skill; });
      nav.querySelectorAll('[data-review-skill]').forEach(button => {
        const active = button.dataset.reviewSkill === skill;
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-selected', String(active));
      });
      body.scrollTo({ top: 0, behavior: 'auto' });
    }

    for (const panel of panels) {
      const skill = panel.dataset.reviewSkillPanel;
      const button = createNode('button', 'attempt-review-tab', labels[skill]);
      button.type = 'button';
      button.dataset.reviewSkill = skill;
      button.setAttribute('role', 'tab');
      button.addEventListener('click', () => activate(skill));
      nav.append(button);
      body.append(panel);
    }
    activate('listening');
    shell.append(header, nav, body);
    dialog.append(shell);
    dialog.addEventListener('click', event => {
      if (event.target === dialog) dialog.close();
    });
    dialog.addEventListener('close', () => dialog.remove(), { once: true });
    document.body.append(dialog);
    dialog.showModal();
    close.focus();
    return dialog;
  }

  window.TERM_TEST_ATTEMPT_REVIEW = Object.freeze({ open });
})();

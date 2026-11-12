(() => {
  'use strict';

  // Adapt the published question markup before the native CBT renderer attaches
  // its answer controls and flags. The stored question package stays canonical.
  function wrapSlot(slot, classes) {
    const number = slot.dataset.answerSlot;
    const answer = document.createElement('span');
    answer.className = classes;
    answer.dataset.questionNumber = number;
    const badge = document.createElement('span');
    badge.className = 'cbt-blank-number';
    badge.textContent = number;
    slot.replaceWith(answer);
    answer.append(badge, slot);
  }

  function formatQuestions(html) {
    const template = document.createElement('template');
    template.innerHTML = html;
    const questions = template.content;

    questions.querySelectorAll('.cbt-multi-choice').forEach(card => {
      card.classList.add('authored-pair');
      card.querySelector('.cbt-multi-choice-list')?.classList.add('cbt-choice-list');
      card.querySelectorAll('[data-answer-slot]').forEach(slot => slot.classList.add('cbt-native-slot'));
      card.querySelectorAll('.cbt-choice > span > strong').forEach(letter => {
        const choiceText = letter.parentElement;
        letter.classList.add('cbt-choice-letter');
        choiceText.before(letter);
      });
    });

    questions.querySelectorAll('.cbt-matching-questions > [data-question-number]').forEach(row => {
      const slot = row.querySelector(':scope > [data-answer-slot]');
      if (!slot) return;
      const oldNumber = row.querySelector(':scope > span > strong');
      if (oldNumber?.textContent.trim() === slot.dataset.answerSlot) oldNumber.remove();
      row.removeAttribute('data-question-number');
      wrapSlot(slot, 'cbt-select-answer');
    });

    questions.querySelectorAll('.cbt-summary-card [data-answer-slot]').forEach(slot => {
      if (!slot.closest('.cbt-inline-answer')) wrapSlot(slot, 'cbt-inline-answer is-short');
    });
    return template.innerHTML;
  }

  window.K67_PRETEST_QUESTION_LAYOUT = content => {
    if (content?.baseTestSlug !== 'pretest-lesson-16' || content.variant !== 'semantic-html') return content;
    return {
      ...content,
      listening: {
        ...content.listening,
        sections: content.listening.sections.map(section => ({ ...section, html: formatQuestions(section.html) }))
      },
      reading: {
        ...content.reading,
        sections: content.reading.sections.map(section => ({
          ...section, questionsHtml: formatQuestions(section.questionsHtml)
        }))
      }
    };
  };
})();

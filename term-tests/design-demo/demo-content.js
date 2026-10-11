// Nội dung tự soạn chỉ để thử giao diện. Không chứa đề, đáp án hoặc bài của học viên thật.
(() => {
  const config = window.TERM_TEST_CONFIG;
  const title = 'A community learning centre';
  const topics = ['Opening hours and activities', 'Planning a community workshop', 'Learning together', 'Designing a quiet study space'];
  const answers = ['a short introductory workshop', 'a guided tour of the learning centre', 'a practical group activity', 'an online information pack', 'a discussion with local volunteers'];
  const slot = n => `<span class="cbt-inline-answer" data-answer-slot="${n}"></span>`;
  const heading = (a, b, instruction) => `<header class="cbt-subsection-heading" data-question-range="${a}–${b}"><h4>Questions ${a}–${b}</h4><p>${instruction}</p></header>`;
  const choices = values => values.map((value, i) => `<label class="cbt-choice" data-choice-value="${value}"><strong class="cbt-choice-letter">${value}</strong><span>${answers[i % answers.length]}</span></label>`).join('');
  function groupHTML(controls, skill) {
    let html = '', i = 0;
    while (i < controls.length) {
      const c = controls[i];
      if (skill === 'listening' && c.number === 21 && controls[i + 1]?.number === 22 && c.options?.length === 5) {
        html += heading(21, 22, 'Which <strong>TWO</strong> activities would help new visitors feel welcome?') + `<article class="cbt-question-card" data-control="multi" data-question-numbers="21,22"><div class="cbt-question-heading"><strong class="cbt-question-number">21–22</strong><p>Choose TWO answers.</p></div><p>Tick up to TWO options. Untick one before choosing another.</p><div class="cbt-choice-list">${choices(c.options)}</div><div class="cbt-native-slot">${slot(21)}${slot(22)}</div></article>`;
        i += 2; continue;
      }
      const end = Math.min(i + 4, controls.length);
      const chunk = controls.slice(i, end);
      html += heading(c.number, chunk.at(-1).number, c.kind === 'text' ? 'Complete the notes. Write <strong>ONE WORD ONLY</strong> in each gap.' : 'Choose the most suitable option for each question.');
      if (c.kind === 'text') html += `<div class="cbt-notes-card"><h4>${title}</h4>`;
      for (const q of chunk) {
        if (q.kind === 'text') html += `<p data-question-number="${q.number}">The centre offers a welcoming space for ${slot(q.number)} and shared activities.</p>`;
        else if (q.options?.length <= 5 && !q.options.includes('TRUE') && q.number % 3 !== 0) html += `<article class="cbt-question-card" data-question-number="${q.number}" data-control="radio"><div class="cbt-question-heading"><strong class="cbt-question-number">${q.number}</strong><p>Which activity would be most useful for visitors in this situation?</p></div><div class="cbt-choice-list">${choices(q.options)}</div><div class="cbt-native-slot">${slot(q.number)}</div></article>`;
        else html += `<div class="cbt-question-card" data-question-number="${q.number}"><div class="cbt-question-heading"><strong class="cbt-question-number">${q.number}</strong><p>The centre gives visitors a chance to learn a practical skill.</p></div><div class="cbt-answer-row">${slot(q.number)}</div></div>`;
      }
      if (c.kind === 'text') html += '</div>';
      i = end;
    }
    return html;
  }
  const paragraph = [
    'A small learning centre recently opened near the town library. Its rooms are used for language practice, art workshops and quiet study. The organisers asked local residents how the space could support people with different interests. They wanted visitors to feel comfortable asking questions and trying activities that were new to them.',
    'During the first month, volunteers observed which rooms were used most often. Some visitors preferred a quiet desk by the window, while others enjoyed working around a shared table. Rather than choosing one arrangement for everyone, the team created several clearly marked areas. This made it easier to find a suitable place without interrupting other people.',
    'The weekly programme combines short introductions with longer practical sessions. New participants can begin with a simple task before joining a group project. Written instructions are placed next to the materials, so people can check what to do when they need help. A volunteer remains available to explain any unfamiliar steps.',
    'The organisers plan to review the programme regularly. They collect suggestions at the end of each workshop and compare attendance across different times of day. Their aim is to improve the experience gradually while keeping the centre affordable and welcoming. The example illustrates how small changes can make a shared space more useful.'
  ];
  const sections = skill => {
    const controls = config[skill].controls, size = skill === 'listening' ? 10 : 14;
    const out = [];
    for (let i = 0; i < controls.length; i += size) {
      const part = controls.slice(i, i + size), index = out.length;
      const info = { label: `${skill === 'listening' ? 'Part' : 'Passage'} ${index + 1}`, range: `Questions ${part[0].number}–${part.at(-1).number}` };
      if (skill === 'reading') Object.assign(info, { title: topics[index], passageHtml: paragraph.map(p => `<p>${p}</p>`).join(''), questionsHtml: groupHTML(part, skill) });
      else info.html = `<div class="cbt-section-intro"><p class="cbt-kicker">${info.label}</p><h3>${topics[index]}</h3><p>Nội dung minh họa để thử giao diện.</p></div>` + groupHTML(part, skill);
      out.push(info);
    }
    return out;
  };
  const tasks = [{ id: 'task2', label: 'Task 2', recommendedMinutes: 40, minimumWords: 250, initialSplit: 42, prompt: 'Some towns are investing in community learning centres where people can study and share practical skills.', followUp: 'What benefits can these centres bring? How can towns encourage more people to use them?' }];
  if (config.slug === 'term-test-2') tasks.unshift({ id: 'task1', label: 'Task 1', recommendedMinutes: 20, minimumWords: 150, image: 'assets/learning-chart.svg', prompt: 'The chart shows the number of visitors to a community learning centre during three months.', followUp: 'Summarise the information by selecting and reporting the main features, and make comparisons where relevant.' });
  window.DESIGN_DEMO_CONTENT = { variant: 'semantic-html', baseTestSlug: config.slug, title: config.title + ' · Minh họa', timing: { readingMinutes: 60, writingMinutes: config.slug === 'term-test-2' ? 60 : 40 }, audio: { src: '', label: 'Audio minh họa', durationLabel: '10 giây thử âm thanh' }, listening: { instructions: ['Đề minh họa, không dùng để đánh giá năng lực.'], sections: sections('listening') }, reading: { instructions: ['Đề minh họa để thử các dạng ô nhập và bố cục.'], sections: sections('reading') }, ...(config.slug.startsWith('term-test') ? { writing: { tasks } } : {}) };
})();

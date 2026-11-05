// Nhận item đã có của Progress Log: ghép notes và answer sheet theo groupId riêng.
// Giữ mỗi ô gắn đúng item để nháp, required và chấm chạy như cũ; dữ liệu không phù hợp trả null.
function noteGroups(items) {
  if (!items.length || !items.every(item => item.groupId?.startsWith('notes-')
    && item.interactionType === 'short_text' && item.pedagogicalTypeCode === 'sentence_completion')) return null;
  const groups = [];
  const numbers = new Set();
  for (const item of items) {
    const gaps = [...item.prompt.matchAll(/(\d{1,3})\s+([‘'“"]?)\.{3,}/g)];
    if (gaps.length !== 1 || gaps[0][1] !== item.displayNumber || numbers.has(item.displayNumber)) return null;
    numbers.add(item.displayNumber);
    let group = groups.at(-1);
    if (group?.id !== item.groupId) {
      if (groups.some(previous => previous.id === item.groupId)) return null;
      group = {id: item.groupId, title: item.helpText, items: []};
      groups.push(group);
    }
    if (!group.title || group.title !== item.helpText) return null;
    group.items.push(item);
  }
  return groups;
}

export function buildCompactExercises(items, {valueFor, requiredFor, onChange, resizeInput}) {
  const groups = noteGroups(items);
  if (groups) {
    const sheet = document.createElement('div');
    sheet.className = 'compact-exercises listening-notes';
    for (const group of groups) {
      const section = document.createElement('section');
      const heading = document.createElement('h3');
      heading.textContent = group.title;
      section.append(heading);
      for (const item of group.items) {
        const question = document.createElement('div');
        question.className = 'compact-exercise-answer';
        question.dataset.itemVersionId = item.itemVersionId;
        for (const line of item.prompt.split('\n')) {
          const paragraph = document.createElement('p');
          paragraph.className = 'sentence-text';
          const gap = /(\d{1,3})\s+([‘'“"]?)\.{3,}/.exec(line);
          if (!gap) paragraph.textContent = line;
          else {
            const label = document.createElement('label');
            label.className = 'notes-gap';
            const number = document.createElement('b');
            number.textContent = item.displayNumber;
            const input = document.createElement('textarea');
            input.className = 'sentence-blank';
            input.rows = 1;
            input.maxLength = 2000;
            input.required = requiredFor(item);
            input.value = String(valueFor(item) || '');
            input.setAttribute('aria-label', `Câu ${item.displayNumber} · ${group.title}`);
            input.addEventListener('input', event => {
              if (!event.isComposing) input.value = input.value.replace(/\s*[\r\n]+\s*/g, ' ');
              resizeInput(input);
              onChange(item.itemVersionId, input.value);
            });
            input.addEventListener('keydown', event => {
              if (event.key === 'Enter' && !event.isComposing) event.preventDefault();
            });
            // Giữ dấu mở nháy của câu gốc ngay trước ô, dấu đóng nằm trong phần chữ sau ô.
            label.append(number);
            if (gap[2]) label.append(document.createTextNode(' ' + gap[2]));
            label.append(input);
            paragraph.append(document.createTextNode(line.slice(0, gap.index)), label,
              document.createTextNode(line.slice(gap.index + gap[0].length)));
          }
          question.append(paragraph);
        }
        section.append(question);
      }
      sheet.append(section);
    }
    return [sheet];
  }

  // Answer sheet chỉ hiện số câu, ngân hàng tên và ô chọn; không nhân lại passage/câu hỏi giấy.
  if (!items.length || !items.every(item => item.groupId?.startsWith('answer-sheet-')
    && item.groupId === items[0].groupId && item.interactionType === 'single_choice'
    && item.layoutType === 'matching_heading_dropdown' && item.options?.length
    && JSON.stringify(item.options) === JSON.stringify(items[0].options))
    || new Set(items.map(item => item.displayNumber)).size !== items.length) return null;
  const sheet = document.createElement('div');
  sheet.className = 'compact-exercises matching-names-sheet';
  const bank = document.createElement('div');
  bank.className = 'matching-names-bank';
  const heading = document.createElement('h3');
  heading.textContent = 'List of Researchers';
  bank.append(heading);
  for (const option of items[0].options) {
    const line = document.createElement('p');
    const letter = document.createElement('b');
    letter.textContent = option.id + ' ';
    line.append(letter, document.createTextNode(option.label));
    bank.append(line);
  }
  sheet.append(bank);
  for (const item of items) {
    const row = document.createElement('div');
    row.className = 'matching-names-row';
    row.dataset.itemVersionId = item.itemVersionId;
    const number = document.createElement('label');
    number.className = 'question-number';
    const controlId = `matching-name-${item.itemVersionId}`;
    number.htmlFor = controlId;
    number.textContent = item.displayNumber;
    const content = document.createElement('div');
    content.className = 'question-content';
    const select = document.createElement('select');
    select.id = controlId;
    select.className = 'matching-heading-select';
    select.required = requiredFor(item);
    select.setAttribute('aria-label', `Câu ${item.displayNumber}`);
    select.append(new Option('Chọn tên', ''));
    for (const option of item.options) select.append(new Option(`${option.id} · ${option.label}`, option.id));
    select.value = String(valueFor(item) || '');
    select.addEventListener('change', () => onChange(item.itemVersionId, select.value || undefined));
    content.append(select);
    row.append(number, content);
    sheet.append(row);
  }
  return [sheet];
}

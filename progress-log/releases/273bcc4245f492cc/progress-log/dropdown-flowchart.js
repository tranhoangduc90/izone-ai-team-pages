// Nhận các câu dropdown cùng nhóm flowchart-, giữ nguyên câu và nối số ô với item riêng.
// Chọn đáp án trả về mã option cho luồng nháp/nộp hiện hành; cấu trúc không hợp lệ dùng giao diện dropdown cũ.
export function buildDropdownFlowchart(items, {valueFor, requiredFor, onChange}) {
  if (!items.length || !items.every(item => item.groupId?.startsWith('flowchart-')
    && item.layoutType === 'matching_heading_dropdown' && item.interactionType === 'single_choice')) return null;
  const byNumber = new Map(items.map(item => [item.displayNumber, item]));
  const groups = new Map();
  const seen = new Set();
  for (const item of items) {
    const group = groups.get(item.groupId) || {title: item.helpText, items: [], prompts: new Set()};
    if (!group.title || group.title !== item.helpText
      || JSON.stringify(item.options) !== JSON.stringify(items[0].options)) return null;
    group.items.push(item);
    group.prompts.add(item.prompt);
    groups.set(item.groupId, group);
  }
  for (const group of groups.values()) {
    for (const prompt of group.prompts) {
      for (const match of prompt.matchAll(/(\d{1,3})\s+\.{3,}/g)) {
        const item = byNumber.get(match[1]);
        if (!item || !group.items.includes(item) || seen.has(item.itemVersionId)) return null;
        seen.add(item.itemVersionId);
      }
    }
  }
  if (seen.size !== items.length) return null;

  const bank = document.createElement('div');
  bank.className = 'flowchart-option-bank';
  bank.setAttribute('aria-label', 'Các phương án trả lời');
  for (const option of items[0].options) {
    const entry = document.createElement('span');
    const letter = document.createElement('b');
    letter.textContent = option.id + ' ';
    entry.append(letter, document.createTextNode(option.label));
    bank.append(entry);
  }
  const nodes = [bank];
  let stage = 0;
  for (const group of groups.values()) {
    const wrapper = document.createElement('section');
    wrapper.className = 'question flowchart-stage';
    const number = document.createElement('span');
    number.className = 'question-number';
    number.textContent = String(++stage);
    const content = document.createElement('div');
    content.className = 'question-content';
    const heading = document.createElement('h3');
    heading.textContent = group.title;
    content.append(heading);
    for (const prompt of group.prompts) {
      for (const line of prompt.split('\n')) {
        const paragraph = document.createElement('p');
        paragraph.className = 'flowchart-line';
        let start = 0;
        for (const match of line.matchAll(/(\d{1,3})\s+\.{3,}/g)) {
          paragraph.append(document.createTextNode(line.slice(start, match.index) + match[1] + ' '));
          const item = byNumber.get(match[1]);
          const field = document.createElement('span');
          field.className = 'flowchart-answer';
          field.dataset.itemVersionId = item.itemVersionId;
          const select = document.createElement('select');
          select.className = 'matching-heading-select flowchart-select';
          select.required = requiredFor(item);
          select.setAttribute('aria-label', `Câu ${item.displayNumber} · ${group.title}`);
          select.append(new Option('Chọn A–H', ''));
          for (const option of item.options) select.append(new Option(`${option.id} · ${option.label}`, option.id));
          select.value = String(valueFor(item) || '');
          select.addEventListener('change', () => onChange(item.itemVersionId, select.value || undefined));
          field.append(select);
          paragraph.append(field);
          start = match.index + match[0].length;
        }
        paragraph.append(document.createTextNode(line.slice(start)));
        content.append(paragraph);
      }
    }
    const feedback = document.createElement('div');
    feedback.className = 'flowchart-feedback';
    content.append(feedback);
    wrapper.append(number, content);
    nodes.push(wrapper);
  }
  return nodes;
}

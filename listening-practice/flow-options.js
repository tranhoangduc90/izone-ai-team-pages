(() => {
  'use strict';
  // Nhận phương án và ô select đã có trong bài gốc. Chỉ thêm cách nhìn/chọn;
  // việc lưu nháp, thời gian và chấm điểm vẫn do handler gốc xử lý qua sự kiện change.
  const app = document.querySelector('#app');
  let active = null, serial = 0;
  const writable = () => window.ReadingInteractionBridge?.writable() === true;
  const words = node => [...node.querySelectorAll(':scope > div')].map(row => ({
    letter: row.querySelector('strong')?.textContent.trim(),
    text: row.querySelector('span')?.textContent.trim()
  })).filter(row => row.letter && row.text);

  function close(restore = true) {
    if (!active) return;
    const old = active;
    active = null;
    old.trigger.setAttribute('aria-expanded', 'false');
    if (old.dialog.open) old.dialog.close();
    old.dialog.remove();
    if (restore && old.trigger.isConnected) old.trigger.focus({preventScroll: true});
  }

  function position() {
    if (!active) return;
    const {dialog, trigger} = active;
    if (matchMedia('(max-width:600px)').matches) {
      dialog.style.removeProperty('left');
      dialog.style.removeProperty('top');
      return;
    }
    const rect = trigger.getBoundingClientRect();
    const height = dialog.offsetHeight, width = dialog.offsetWidth;
    dialog.style.left = `${Math.max(12, Math.min(rect.left, innerWidth - width - 12))}px`;
    dialog.style.top = `${rect.top - height - 8 >= 12 ? rect.top - height - 8 : Math.max(12, Math.min(rect.bottom + 8, innerHeight - height - 12))}px`;
  }

  function open(trigger, select, options, context = '') {
    if (!writable()) return;
    close(false);
    const id = `flow-picker-${++serial}`, number = select?.dataset.answer;
    const dialog = document.createElement('dialog');
    dialog.className = 'flow-option-picker';
    dialog.setAttribute('aria-labelledby', `${id}-title`);
    const header = document.createElement('header');
    header.className = 'flow-picker-heading';
    const title = document.createElement('strong');
    title.id = `${id}-title`;
    title.textContent = number ? `Câu ${number} · Chọn đáp án` : 'Options A–H';
    const exit = document.createElement('button');
    exit.type = 'button'; exit.className = 'flow-picker-close';
    exit.setAttribute('aria-label', 'Đóng bảng phương án'); exit.textContent = '×';
    exit.addEventListener('click', () => close());
    header.append(title, exit); dialog.append(header);
    if (context) {
      const paragraph = document.createElement('p');
      paragraph.className = 'flow-picker-context'; paragraph.textContent = context;
      paragraph.id = `${id}-context`;
      dialog.setAttribute('aria-describedby', paragraph.id); dialog.append(paragraph);
    }
    const list = document.createElement('div');
    list.className = 'flow-picker-list'; list.setAttribute('role', 'listbox');
    list.setAttribute('aria-label', number ? `Phương án câu ${number}` : 'Danh sách A–H');
    const buttons = [];
    function choose(value) {
      if (select && select.isConnected && writable()) {
        // Select gốc là nguồn đáp án duy nhất. Sự kiện này chạy saveAnswer() gốc.
        select.value = value;
        select.dispatchEvent(new Event('change', {bubbles: true}));
      }
      close();
    }
    for (const option of options) {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'flow-picker-option';
      button.setAttribute('role', 'option'); button.dataset.value = option.letter;
      button.setAttribute('aria-selected', String(select?.value === option.letter));
      const letter = document.createElement('strong'), text = document.createElement('span');
      letter.textContent = option.letter; text.textContent = option.text;
      button.append(letter, text);
      const chosen = select?.value === option.letter;
      if (chosen) {const mark = document.createElement('span'); mark.className = 'flow-picker-check'; mark.textContent = '✓'; mark.setAttribute('aria-hidden', 'true'); button.append(mark);}
      button.addEventListener('click', () => select ? choose(option.letter) : close());
      buttons.push(button); list.append(button);
    }
    dialog.append(list);
    if (select) {
      const clear = document.createElement('button');
      clear.type = 'button'; clear.className = 'flow-picker-clear'; clear.textContent = 'Xóa lựa chọn';
      clear.addEventListener('click', () => choose('')); dialog.append(clear);
    }
    dialog.addEventListener('cancel', event => {event.preventDefault(); close();});
    dialog.addEventListener('click', event => {
      const rect = dialog.getBoundingClientRect();
      if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) close();
    });
    dialog.addEventListener('keydown', event => {
      const index = buttons.indexOf(document.activeElement);
      let next;
      if (event.key === 'ArrowDown') next = (index + 1) % buttons.length;
      if (event.key === 'ArrowUp') next = (index - 1 + buttons.length) % buttons.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = buttons.length - 1;
      if (/^[a-h]$/i.test(event.key)) next = options.findIndex(option => option.letter === event.key.toUpperCase());
      if (next !== undefined && next >= 0) {event.preventDefault(); buttons[next].focus(); buttons[next].scrollIntoView({block: 'nearest'});}
    });
    document.body.append(dialog);
    active = {dialog, trigger};
    trigger.setAttribute('aria-expanded', 'true');
    dialog.showModal(); position();
    const selected = buttons.find(button => button.dataset.value === select?.value);
    (selected || buttons[0] || exit).focus({preventScroll: true});
  }

  function install() {
    // Chỉ bỏ dòng đang nghe thông thường; giữ thông báo chờ/phục hồi của audio gốc.
    const status = app.querySelector('#audio-status');
    status?.classList.toggle('is-routine-audio-status', status.textContent.trim() === 'Đang nghe · tốc độ gốc');
    if (active && (!active.trigger.isConnected || !writable())) close(false);
    const pane = app.querySelector('#question-scroll');
    const bank = pane?.querySelector('.listening-bank');
    const flow = pane?.querySelector('.listening-flow');
    if (!bank || !flow || flow.dataset.optionsEnhanced) return;
    const options = words(bank);
    if (!options.length) return;
    flow.dataset.optionsEnhanced = 'true';
    const layout = document.createElement('div');
    // Giữ thứ tự chữ trong DOM (bảng rồi flow) để mốc Highlight/Note cũ không đổi.
    // CSS chỉ đổi vị trí nhìn thấy; không đổi chuỗi chữ mà bộ ghi chú gốc đang dùng.
    layout.className = 'flow-reference-layout'; bank.before(layout); layout.append(bank, flow);
    bank.closest('.design-question-group')?.classList.add('flow-reference-group');
    const reference = document.createElement('button');
    reference.type = 'button'; reference.className = 'flow-bank-toggle';
    reference.textContent = 'Xem danh sách A–H';
    reference.setAttribute('aria-haspopup', 'dialog'); reference.setAttribute('aria-expanded', 'false');
    layout.before(reference); reference.addEventListener('click', () => open(reference, null, options));
    for (const select of flow.querySelectorAll('select[data-answer]')) {
      const step = select.closest('.flow-step'), clone = step.querySelector('p').cloneNode(true);
      clone.querySelector('.cbt-select-answer')?.replaceWith(document.createTextNode('____'));
      const context = clone.textContent.replace(/\s+/g, ' ').trim();
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'flow-answer-trigger';
      button.dataset.flowQuestion = select.dataset.answer;
      button.setAttribute('aria-haspopup', 'dialog'); button.setAttribute('aria-expanded', 'false');
      const label = document.createElement('span'), arrow = document.createElement('span');
      label.className = 'flow-answer-label'; arrow.className = 'flow-picker-chevron';
      arrow.textContent = '⌄'; arrow.setAttribute('aria-hidden', 'true');
      button.append(label, arrow);
      function sync() {
        const option = options.find(item => item.letter === select.value);
        label.textContent = option ? `${option.letter} · ${option.text}` : 'Nhấn để chọn';
        button.setAttribute('aria-label', `Câu ${select.dataset.answer}: ${option ? `${option.letter}, ${option.text}` : 'chưa chọn đáp án'}`);
      }
      select.addEventListener('change', sync);
      // Điều hướng gốc vẫn focus select; đưa focus tới nút nhìn thấy mà không cuộn lại.
      select.addEventListener('focus', () => button.focus({preventScroll: true}));
      button.addEventListener('focus', () => select.dispatchEvent(new FocusEvent('focusin', {bubbles: true})));
      button.addEventListener('click', () => open(button, select, options, context));
      button.addEventListener('keydown', event => {
        if (['ArrowDown', 'ArrowUp'].includes(event.key)) {event.preventDefault(); open(button, select, options, context);}
      });
      select.after(button); select.classList.add('flow-native-select');
      select.tabIndex = -1; select.setAttribute('aria-hidden', 'true'); sync();
    }
  }
  if (!app) return;
  new MutationObserver(install).observe(app, {childList: true, subtree: true});
  window.addEventListener('resize', position);
  window.visualViewport?.addEventListener('resize', position);
  install();
})();

// Pure presentation; source SHA-256 28adb334c3039ec9099b0b3e88407beba596d5d4371233deb4760ae71ceb11a0
// Pinned pure presentation functions from Substitute K56 enhance.js at Pages 3b0bdc5b.
// No legacy audio, timer, identity, draft or API controller is loaded.
export function mountNativeReading({content,grid,form,heading,uiState,onUiState}){
 const saveUiState=()=>onUiState(uiState);
  function makeButton(className, label) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = className;
    button.textContent = label;
    return button;
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
      label.classList.add('cbt-choice');
      label.querySelector(':scope > strong')?.classList.add('cbt-choice-letter');
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
    field.addEventListener('input', () => {
      radios.forEach(radio => { radio.checked = field.value === radio.value; });
    });
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
    });
    card.append(status);
    renderSelection();
    return checkboxes;
  }

  function attachAnswerFields(skill, sectionNode, sectionIndex, fields, items) {
    const processedSlots = new Set();

    sectionNode.querySelectorAll('[data-control="pair"]').forEach(card => {
      const keys = (card.dataset.answerKeys || '').split(',').filter(Boolean);
      const pairFields = keys.map(key => fields.get(key)).filter(Boolean);
      if (pairFields.length !== keys.length) return;

      keys.forEach((key, index) => {
        const slot = card.querySelector('[data-answer-slot="' + key + '"]');
        if (!slot) return;
        const field = pairFields[index];
        field.classList.add('cbt-answer-input', 'cbt-pair-answer');
        slot.append(field);
        processedSlots.add(slot);
      });

      const number = String(card.dataset.questionNumber || keys[0]);
      const flagButton = makeButton('cbt-flag-button', '⚑');
      flagButton.setAttribute('aria-label', 'Đánh dấu câu ' + number);
      flagButton.title = 'Đánh dấu để xem lại';
      card.append(flagButton);
      items.push({
        skill,
        number,
        field: pairFields[0],
        fields: pairFields,
        target: card,
        flagButton,
        radios: [],
        sectionIndex
      });
    });

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
      pagerHost.append(createSectionPager(skill, sectionIndex, sectionConfig.sections.length, activateSection));
      sectionNode.dataset.sectionIndex = String(sectionIndex);
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

    function itemFields(item) {
      return item.fields || [item.field];
    }

    function itemAnswered(item) {
      return itemFields(item).every(field => Boolean(field.value.trim()));
    }

    function updateItem(item) {
      const answered = itemAnswered(item);
      const flagged = Boolean(uiState.flags[skill][item.number]);
      const active = activeNumber === item.number;
      const targetItems = source.items.filter(candidate => candidate.target === item.target);
      item.target.classList.toggle('is-answered', targetItems.some(itemAnswered));
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
        item.target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
        const focusTarget = item.radios.find(radio => radio.checked)
          || item.radios[0]
          || itemFields(item).find(field => !field.value.trim())
          || item.field;
        focusTarget.focus({ preventScroll: true });
        refreshAll();
      });
    }

    [...itemByNumber.values()].sort((a, b) => Number(a.number) - Number(b.number)).forEach(item => {
      const button = makeButton('cbt-question-button', item.number);
      button.dataset.navNumber = item.number;
      button.addEventListener('click', () => focusItem(item));
      nav.append(button);

      itemFields(item).forEach(field => {
        field.addEventListener('input', refreshAll);
        field.addEventListener('focus', () => {
          activeNumber = item.number;
          refreshAll();
        });
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
 const fields=new Map();
 for(const c of content.controls){const field=document.createElement(c.kind==='select'?'select':'input');field.dataset.number=String(c.number);field.dataset.question=String(c.number);field.name='question-'+c.number;field.setAttribute('aria-label','Câu '+c.number);field.title='Câu '+c.number;if(c.kind==='select'){field.add(new Option('Chọn',''));for(const v of c.options)field.add(new Option(v,v));}else{field.type='text';field.maxLength=250;field.autocomplete='off';field.placeholder='Nhập đáp án';field.spellcheck=false;}fields.set(String(c.number),field);}
 const source=createSemanticPane('reading',content.reading,heading,fields);
 source.viewport.id='questions';source.toolbar.querySelector('.cbt-part-nav').id='section-nav';
 grid.replaceChildren(source.pane);form.append(createQuestionNav('reading',source));
 const count=()=>{document.getElementById('answer-count').textContent=[...fields.values()].filter(f=>f.value.trim()).length+'/'+content.controls.length+' đã nhập';};form.addEventListener('input',count);count();
 return source;
}

export async function nativeLayout(controls,slug){window.TERM_TEST_CONFIG={slug,reading:{controls}};await import('../substitute-shared/exam-controls.js');}
export async function nativeAnnotations({content,identity,storage,onError,onChange,load=()=>import('../substitute-test-1-k56-computer-based/annotations.js')}){if(document.getElementById('cbtNotesPanel'))return;const recordKey='annotations:'+identity.attemptId,saved=await storage.get(recordKey);let cache=saved?.raw||null;const session=JSON.stringify({annotationRunId:identity.attemptId});const adapter={getItem:key=>key.includes('annotations:')?cache:session,setItem:(key,value)=>{if(!key.includes('annotations:'))return;cache=value;void storage.put(recordKey,{raw:value}).catch(onError);onChange?.(value);}};window.TERM_TEST_CONTENT=content;window.SUBSTITUTE_STATE={storages:()=>[adapter],accept:()=>true,stamp:value=>value,key:prefix=>prefix+identity.attemptId,resolveClass:()=>identity.classCode};await load();}

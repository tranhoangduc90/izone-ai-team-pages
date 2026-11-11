import { feedbackCardsHtml } from './feedback-cards.js';
import {feedbackBlockHtml,feedbackTextHtml,overallFeedback} from './feedback-format.js';
import {languageCards} from './language-cards.js';

function editableText(id,title,text,esc,ranges=[]){
  if(id==='review-feedback'&&!text)return `<section class="feedback-review-section"><details class="feedback-edit"><summary>Thêm nhận xét chung</summary><h3 class="sr-only">${title}</h3><div class="feedback-text feedback-rich" data-feedback-preview="${id}"></div><label class="field"><span class="sr-only">${title}</span><textarea id="${id}" rows="5"></textarea></label></details></section>`;
  return `<section class="feedback-review-section"><h3>${title}</h3><div class="feedback-text feedback-rich" data-feedback-preview="${id}">${feedbackTextHtml(text,ranges)}</div><details class="feedback-edit"><summary>Chỉnh sửa ${title.toLowerCase()}</summary><label class="field"><span class="sr-only">${title}</span><textarea id="${id}" rows="5">${esc(text)}</textarea></label></details></section>`;
}

export function teacherCommentsHtml(comments = [], esc, highlights={}) {
  return comments.length ? `<section class="teacher-extra-published"><h3>Nhận xét thêm của giảng viên</h3>${comments.map((c, i) => `<article class="teacher-note"><h4>Nhận xét ${i + 1}</h4>${c.anchor ? `<blockquote lang="en">${esc(c.anchor.quote)}</blockquote>` : '<small>Nhận xét chung cho bài</small>'}${feedbackBlockHtml(c.text,highlights['comment:'+c.id]?.ranges)}</article>`).join('')}</section>` : '';
}

export function feedbackTabsHtml(result, { esc, marked, editable = false }) {
  const marks=key=>result.teacherHighlights?.[key]?.ranges||[];
  const feedback=overallFeedback(result.feedback);
  return `${editable&&result.atomicReview?.items?.length?`<aside class="error-panel atomic-review-warning" role="note"><strong>Cần GV đối chiếu ${result.atomicReview.items.length} câu</strong><p>Một số chỗ sửa chưa đủ căn cứ để đánh dấu. GV cần kiểm tra cả câu sửa và lý do trước khi duyệt; các cụm không chắc chắn đã được bỏ khỏi phần tô sáng.</p></aside>`:''}<div class="feedback-tabs" data-feedback-tabs>
    <div class="feedback-tab-list" role="tablist" aria-label="Phần nhận xét đã duyệt">
      <button type="button" id="feedback-tab-overall" role="tab" aria-selected="true" aria-controls="feedback-panel-overall" data-feedback-tab="overall">Nhận xét về nội dung</button>
      <button type="button" id="feedback-tab-sentences" role="tab" aria-selected="false" aria-controls="feedback-panel-sentences" tabindex="-1" data-feedback-tab="sentences">Sửa từng câu <span class="tab-count">${languageCards(result).length}</span></button>
    </div>
    <section id="feedback-panel-overall" class="feedback-tab-panel" role="tabpanel" aria-labelledby="feedback-tab-overall" tabindex="0" data-feedback-panel="overall">
      ${editable ? editableText('review-feedback','Nhận xét chung',feedback,esc,marks('feedback'))+editableText('review-trcc','Ý và mạch bài · TR/CC',result.trcc,esc,marks('trcc')) : `${feedback?`<h3>Nhận xét chung</h3>${feedbackBlockHtml(feedback,marks('feedback'))}`:''}${result.trcc ? `<h3>Ý và mạch bài · TR/CC</h3>${feedbackBlockHtml(result.trcc,marks('trcc'))}` : ''}`}
    </section>
    <section id="feedback-panel-sentences" class="feedback-tab-panel" role="tabpanel" aria-labelledby="feedback-tab-sentences" tabindex="0" data-feedback-panel="sentences" hidden>
      <h3 class="sr-only">Góp ý từng câu</h3>${feedbackCardsHtml(result.items, { esc, marked, editable, result })}
    </section>
  </div>${editable ? '' : teacherCommentsHtml(result.teacherComments, esc,result.teacherHighlights)}`;
}

export function setupFeedbackTabs(root, { storageKey, onSelect } = {}) {
  root?.querySelectorAll('[data-feedback-preview]').forEach(preview=>{
    const input=root.querySelector('#'+preview.dataset.feedbackPreview);
    input?.addEventListener('input',()=>{if(input.dataset.richSync)return;preview.innerHTML=feedbackTextHtml(input.value);});
    input?.addEventListener('highlightchange',event=>{if(input.dataset.richSync)return;preview.innerHTML=feedbackTextHtml(input.value,event.detail.ranges);});
  });
  const tabs = [...(root?.querySelectorAll('[data-feedback-tab]') || [])];
  if (!tabs.length) return;
  const list = root.querySelector('[role="tablist"]');
  const panels = [...root.querySelectorAll('[data-feedback-panel]')];
  const pane = root.closest('.study-context,.review-column');
  const scrollPositions = { overall: 0, sentences: 0 };
  let current = 'overall', initial = 'overall';
  if (storageKey) { try { initial = sessionStorage.getItem(storageKey) || initial; } catch { /* Chặn storage vẫn đọc được cả hai mục. */ } }
  const select = (value, moveFocus = false) => {
    const selected = tabs.find(t => t.dataset.feedbackTab === value) || tabs[0];
    const next = selected.dataset.feedbackTab;
    const independent = pane && getComputedStyle(pane).overflowY === 'scroll';
    if (independent && next !== current) scrollPositions[current] = pane.scrollTop;
    tabs.forEach(tab => { const active = tab === selected; tab.setAttribute('aria-selected', String(active)); tab.tabIndex = active ? 0 : -1; });
    panels.forEach(panel => { panel.hidden = panel.dataset.feedbackPanel !== next; });
    onSelect?.();
    if (independent && next !== current) pane.scrollTop = scrollPositions[next];
    current = next;
    if (storageKey) { try { sessionStorage.setItem(storageKey, current); } catch { /* Lưu lựa chọn không chặn tương tác. */ } }
    if (moveFocus) selected.focus({ preventScroll: true });
  };
  tabs.forEach(tab => { tab.onclick = () => select(tab.dataset.feedbackTab); });
  list.addEventListener('keydown', e => {
    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    const at = tabs.indexOf(e.target);
    if (at < 0) return;
    const destination = { ArrowRight: (at + 1) % tabs.length, ArrowLeft: (at + tabs.length - 1) % tabs.length, Home: 0, End: tabs.length - 1 }[e.key];
    if (destination === undefined) return;
    e.preventDefault(); select(tabs[destination].dataset.feedbackTab, true);
  });
  select(initial);
}

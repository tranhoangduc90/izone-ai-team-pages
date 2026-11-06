// Cách đọc kế thừa thẻ LMS: mỗi thẻ giữ trọn câu gốc, gợi ý và nhận xét.
// Module chỉ hiển thị dữ liệu đã công bố do caller cung cấp; không gọi API chấm.
import {feedbackBlockHtml} from './feedback-format.js';
import {languageCards} from './language-cards.js';
import {highlightHtml} from './text-highlights.js';
export function feedbackCardsHtml(sourceItems, { esc, marked, editable = false, result = {items:sourceItems} }) {
  const items=languageCards(result),marks=key=>result.teacherHighlights?.[key]?.ranges||[];
  if (!items.length) return '<p class="empty-inline">Bản đã duyệt này không có thẻ nhận xét từng câu.</p>';
  return `<div class="feedback-deck" data-feedback-deck role="region" aria-roledescription="bộ thẻ" aria-label="Nhận xét từng câu" tabindex="0">
    <div class="feedback-card-shell"><nav class="card-arrow-nav" aria-label="Chuyển thẻ nhận xét"><button type="button" data-card-prev disabled aria-label="Thẻ trước" title="Câu trước">‹</button><button type="button" data-card-next ${items.length === 1 ? 'disabled' : ''} aria-label="Thẻ tiếp theo" title="Câu tiếp theo">›</button></nav>
    <div class="feedback-cards">${items.map((item, i) => `<article class="feedback-card" data-feedback-card ${i ? 'hidden' : ''} aria-labelledby="feedback-card-title-${i}">
      <header class="feedback-card-header"><h4 id="feedback-card-title-${i}" tabindex="-1">Câu ${esc(item.item)}${item.correctionCount>1?` · Sửa ${item.correctionIndex+1}/${item.correctionCount}`:''}</h4><span class="badge ${item.decision === 'KEEP' ? 'success' : 'attention'}">${item.decision === 'KEEP' ? 'Giữ nguyên' : item.decision === 'UPGRADE' ? 'Gợi ý nâng cấp' : 'Cần chỉnh sửa'}</span></header>
      ${editable&&item.needsReview?'<p class="section-note atomic-card-warning">Chưa xác định đủ từng cụm sửa. GV cần đối chiếu câu này trước khi trả bài.</p>':''}
      <div class="card-comparison ${!editable && item.original_text === item.revised_text ? 'is-unchanged' : ''}"><section class="card-version original"><h5>${editable?'Bài làm':'Bài của em'}</h5><div lang="en">${marked(item.original_text, item.highlights, 'original')}</div></section>${editable ? `<label class="field card-edit-field"><span>Gợi ý chỉnh sửa</span><textarea data-revised="${i}" data-card-key="${item.id}" rows="3" lang="en">${esc(item.revised_text)}</textarea></label>` : item.original_text === item.revised_text ? `<p class="same-suggestion ${item.decision === 'KEEP' ? 'confirmed' : ''}">${item.decision === 'KEEP' ? '✓ ' : ''}Gợi ý đã duyệt trùng với bài của em</p>` : `<section class="card-version revised"><h5>Gợi ý chỉnh sửa đã duyệt</h5><div lang="en">${marks('card:'+item.id+':revised').length?highlightHtml(item.revised_text,marks('card:'+item.id+':revised')):marked(item.revised_text,item.revisedHighlights,'revised')}</div></section>`}</div>
      <section class="card-explanation">${editable ? `<label class="field"><span>Nhận xét</span><textarea data-explanation="${i}" data-card-key="${item.id}" rows="3">${esc(item.explanation)}</textarea></label>` : `<h5>Nhận xét</h5>${feedbackBlockHtml(item.explanation,marks('card:'+item.id+':explanation'))}`}</section>
    </article>`).join('')}</div></div>
    <nav class="sentence-jumps" aria-label="Chọn câu nhận xét">${items.map((item, i) => `<button type="button" data-card-jump="${i}" aria-label="Xem câu ${esc(item.item)}${item.correctionCount>1?' · sửa '+(item.correctionIndex+1):''}" ${i === 0 ? 'aria-current="true"' : ''}>${esc(item.item)}${item.correctionCount>1?'.'+(item.correctionIndex+1):''}</button>`).join('')}</nav>
    <p class="card-position" data-card-position aria-live="polite" aria-atomic="true">Thẻ 1 / ${items.length}</p>
    <p class="deck-boundary" data-card-boundary></p>
  </div>`;
}

export function setupFeedbackCards(root, { storageKey } = {}) {
  const deck = root?.querySelector('[data-feedback-deck]');
  if (!deck) return;
  const cards = [...deck.querySelectorAll('[data-feedback-card]')];
  const previous = deck.querySelector('[data-card-prev]'), next = deck.querySelector('[data-card-next]');
  let index = 0, start = null;
  const show = (requested, moveFocus = false) => {
    index = Math.max(0, Math.min(cards.length - 1, Number.isFinite(requested) ? Math.trunc(requested) : 0));
    cards.forEach((card, i) => { card.hidden = i !== index; });
    previous.disabled = index === 0; next.disabled = index === cards.length - 1;
    deck.querySelectorAll('[data-card-jump]').forEach(button => { if (Number(button.dataset.cardJump) === index) button.setAttribute('aria-current', 'true'); else button.removeAttribute('aria-current'); });
    deck.querySelector('[data-card-position]').textContent = `Thẻ ${index + 1} / ${cards.length}`;
    deck.querySelector('[data-card-boundary]').textContent = cards.length === 1 ? 'Bản này có một thẻ nhận xét.' : index === cards.length - 1 ? 'Đây là thẻ cuối cùng. Em có thể quay lại thẻ trước hoặc tiếp tục viết bản sửa.' : '';
    if (storageKey) { try { sessionStorage.setItem(storageKey, String(index)); } catch { /* Vẫn đọc thẻ khi storage bị chặn. */ } }
    if (moveFocus) {
      const title = cards[index].querySelector('h4'); title.focus({ preventScroll: true });
      const pane = deck.closest('.study-context');
      if (pane && matchMedia('(min-width:1001px)').matches) {
        const tabHeight = root.querySelector('[role="tablist"]')?.getBoundingClientRect().height || 0;
        const bounds = pane.getBoundingClientRect(), heading = title.getBoundingClientRect();
        if (heading.top < bounds.top + tabHeight + 12 || heading.bottom > bounds.bottom - 12) pane.scrollTop += heading.top - bounds.top - tabHeight - 16;
      }
    }
  };
  let initial = 0;
  if (storageKey) { try { initial = Number(sessionStorage.getItem(storageKey)); } catch { /* Mở thẻ đầu. */ } }
  show(initial);
  previous.onclick = () => show(index - 1, true);
  next.onclick = () => show(index + 1, true);
  deck.querySelectorAll('[data-card-jump]').forEach(button => { button.onclick = () => show(Number(button.dataset.cardJump), true); });
  deck.addEventListener('keydown', e => {
    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || !root.ownerDocument.getSelection()?.isCollapsed || e.target.closest('input,textarea,select,[contenteditable="true"]')) return;
    const target = { ArrowLeft: index - 1, ArrowRight: index + 1, Home: 0, End: cards.length - 1 }[e.key];
    if (target === undefined) return;
    e.preventDefault(); show(target, true);
  });
  deck.addEventListener('pointerdown', e => {
    if (e.pointerType !== 'touch' || e.target.closest('button,a,input,textarea,select')) return;
    start = { x: e.clientX, y: e.clientY, id: e.pointerId };
  });
  deck.addEventListener('pointercancel', () => { start = null; });
  deck.addEventListener('pointerup', e => {
    const origin = start; start = null;
    if (!origin || origin.id !== e.pointerId || !root.ownerDocument.getSelection()?.isCollapsed) return;
    const dx = e.clientX - origin.x, dy = e.clientY - origin.y;
    if (Math.abs(dx) >= 56 && Math.abs(dx) > Math.abs(dy) * 1.5) show(index + (dx < 0 ? 1 : -1), true);
  });
}

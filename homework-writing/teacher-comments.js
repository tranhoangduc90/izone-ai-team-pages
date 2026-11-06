// Tham khảo selectionOffsets/annotatedSegments của handout Speaking Writing.
// Neo vào bản nộp bất biến; không tự tìm lại theo quote khi nguồn không khớp.
export function setupTeacherComments(root, { sourceText, comments = [], onDirty, onSave }) {
  const source = root.querySelector('.student-original'), list = root.querySelector('#teacher-comments-list');
  const abort = new AbortController(), options = { signal: abort.signal };
  let notes = structuredClone(comments), pending = null;
  const offer = document.createElement('button'); offer.type = 'button'; offer.className = 'selection-comment-offer';
  offer.textContent = '+ Nhận xét đoạn đã chọn'; offer.hidden = true; source.parentElement.append(offer);
  const renderSource = () => {
    const anchors = notes.filter(c => c.anchor).map(c => ({ ...c.anchor, id: c.id }));
    const boundaries = [...new Set([0, sourceText.length, ...anchors.flatMap(a => [a.start, a.end])])].sort((a, b) => a - b);
    source.replaceChildren();
    for (let i = 0; i < boundaries.length - 1; i++) {
      const start = boundaries[i], end = boundaries[i + 1], match = anchors.find(a => a.start < end && a.end > start);
      if (!match) source.append(document.createTextNode(sourceText.slice(start, end)));
      else {
        const mark = document.createElement('mark'); mark.className = 'teacher-comment-mark'; mark.textContent = sourceText.slice(start, end);
        mark.tabIndex = 0; mark.setAttribute('role', 'button'); mark.setAttribute('aria-label', 'Mở nhận xét cho đoạn này');
        const open = () => list.querySelector(`[data-note-id="${CSS.escape(match.id)}"] textarea`)?.focus();
        mark.addEventListener('click', open); mark.addEventListener('keydown', e => { if (['Enter', ' '].includes(e.key)) { e.preventDefault(); open(); } }); source.append(mark);
      }
    }
  };
  const renderList = () => {
    list.replaceChildren();
    notes.forEach((note, index) => {
      const article = document.createElement('article'); article.className = 'teacher-note'; article.dataset.noteId = note.id;
      const label = document.createElement('label'); label.className = 'field';
      const title = document.createElement('span'); title.textContent = `Nhận xét thêm ${index + 1}`;
      if (note.anchor) { const quote = document.createElement('blockquote'); quote.lang = 'en'; quote.textContent = note.anchor.quote; article.append(quote); }
      const input = document.createElement('textarea'); input.rows = 3; input.value = note.text; input.dataset.teacherComment = note.id;
      input.addEventListener('input', () => { note.text = input.value; onDirty(); }); label.append(title, input); article.append(label);
      const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'text-button'; remove.textContent = 'Bỏ nhận xét';
      remove.onclick = () => { if (note.text && !confirm('Bỏ nhận xét này khỏi bản đang chỉnh?')) return; notes = notes.filter(n => n.id !== note.id); renderList(); renderSource(); onDirty(); };
      const save = document.createElement('button'); save.type = 'button'; save.textContent = 'Lưu nhận xét'; save.dataset.saveTeacherComment = note.id;
      const status = document.createElement('p'); status.className = 'section-note comment-save-status'; status.setAttribute('role', 'status');
      const hint = document.createElement('small'); hint.textContent = 'Lưu cùng các chỉnh sửa phản hồi đang có; chưa trả cho học viên.';
      save.onclick = async () => {
        if (save.disabled) return;
        save.disabled = true; status.textContent = 'Đang lưu…';
        try { const saved = await onSave(); status.textContent = saved?.dirty ? 'Đã lưu bản trước; còn chỉnh sửa mới chưa lưu.' : 'Đã lưu phản hồi · chưa trả cho học viên.'; }
        catch (e) { status.textContent = e.message + ' Nội dung đang nhập vẫn được giữ.'; }
        finally { save.disabled = false; }
      };
      input.addEventListener('input', () => { status.textContent = 'Có chỉnh sửa chưa lưu.'; });
      const actions = document.createElement('div'); actions.className = 'comment-actions'; actions.append(save, remove);
      article.append(actions, hint, status); list.append(article);
    });
  };
  const add = anchor => {
    const note = { id: crypto.randomUUID(), anchor: anchor ? { ...anchor } : null, text: '' };
    notes.push(note); pending = null; offer.hidden = true; renderSource(); renderList(); onDirty();
    list.querySelector(`[data-note-id="${CSS.escape(note.id)}"] textarea`).focus();
  };
  root.querySelector('#add-teacher-comment').onclick = () => add(null);
  const selectionChanged = () => {
    if (!root.isConnected) return;
    const selection = root.ownerDocument.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount !== 1) { pending = null; offer.hidden = true; return; }
    const range = selection.getRangeAt(0);
    if (!source.contains(range.startContainer) || !source.contains(range.endContainer)) { pending = null; offer.hidden = true; return; }
    const before = range.cloneRange(); before.selectNodeContents(source); before.setEnd(range.startContainer, range.startOffset);
    const start = before.toString().length, quote = range.toString(), end = start + quote.length;
    if (!quote.trim() || sourceText.slice(start, end) !== quote) { pending = null; offer.hidden = true; return; }
    pending = { start, end, quote }; offer.hidden = false;
    const bounds = range.getBoundingClientRect();
    offer.style.left = Math.max(12, Math.min(bounds.left, innerWidth - 300)) + 'px';
    offer.style.top = Math.max(12, Math.min(bounds.bottom + 8, innerHeight - 64)) + 'px';
  };
  root.ownerDocument.addEventListener('selectionchange', selectionChanged, options);
  root.addEventListener('scroll', () => { pending = null; offer.hidden = true; }, { ...options, capture: true });
  window.addEventListener('scroll', () => { pending = null; offer.hidden = true; }, options);
  window.addEventListener('resize', () => { pending = null; offer.hidden = true; }, options);
  root.ownerDocument.addEventListener('keydown', e => { if (e.key === 'Escape') { pending = null; offer.hidden = true; } }, options);
  offer.addEventListener('pointerdown', e => e.preventDefault());
  offer.onclick = () => { if (pending) add(pending); };
  renderList(); renderSource();
  return {
    collect: () => structuredClone(notes),
    commit: saved => { notes.forEach(note => { const server = saved.find(c => c.id === note.id); if (server) { note.authorId = server.authorId; note.createdMs = server.createdMs; } }); },
    destroy: () => { abort.abort(); offer.remove(); }
  };
}

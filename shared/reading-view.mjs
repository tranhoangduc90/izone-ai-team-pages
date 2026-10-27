// Nhận markup đã render/escape của SW, chỉ sửa node thay đổi khi đọc nền.
// Giữ nguyên subtree kết quả cùng lượt; HTTP và quyền vẫn do consumer kiểm.
export function patchReadingView(root, next) {
  const key = node => node.nodeType === 1
    ? node.id ? '#'+node.id : node.dataset.history ? 'history:'+node.dataset.history : '' : '';
  const compatible = (left,right) => left.nodeType === right.nodeType
    && left.nodeName === right.nodeName && key(left) === key(right);
  function children(parent, desired) {
    let cursor=parent.firstChild;
    for (const incoming of [...desired.childNodes]) {
      const wantedKey=key(incoming);
      let existing=cursor;
      if (wantedKey && key(existing||{}) !== wantedKey) {
        existing=[...parent.childNodes].find(node=>key(node)===wantedKey);
      }
      if (!existing) { parent.insertBefore(incoming,cursor); continue; }
      if (existing!==cursor) parent.insertBefore(existing,cursor);
      if (!compatible(existing,incoming)) {
        parent.replaceChild(incoming,existing);cursor=incoming.nextSibling;continue;
      }
      patch(existing,incoming);cursor=existing.nextSibling;
    }
    while(cursor){const after=cursor.nextSibling;cursor.remove();cursor=after;}
  }
  function patch(existing,incoming) {
    if (existing.nodeType === 1 && existing.id === 'connected-draft-result'
      && existing.dataset.resultKey === incoming.dataset.resultKey) return;
    if (existing.isEqualNode(incoming)) return;
    if (existing.nodeType !== 1) { existing.nodeValue=incoming.nodeValue;return; }
    // Dialog đang mở phải tiếp tục ở top layer; không tháo open khi đọc nền.
    const preserveOpen=existing.tagName==='DIALOG' && existing.open;
    for(const attribute of [...existing.attributes]) {
      if(!incoming.hasAttribute(attribute.name) && !(preserveOpen&&attribute.name==='open'))existing.removeAttribute(attribute.name);
    }
    for(const attribute of incoming.attributes) {
      if(existing.getAttribute(attribute.name)!==attribute.value)existing.setAttribute(attribute.name,attribute.value);
    }
    children(existing,incoming);
    if(existing instanceof HTMLTextAreaElement && existing.value!==incoming.value)existing.value=incoming.value;
    if(existing instanceof HTMLInputElement && existing.value!==incoming.value)existing.value=incoming.value;
  }
  children(root,next);
}

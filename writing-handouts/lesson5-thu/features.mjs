// Màn HV/GV chỉ hiển thị bản bài và thread máy chủ đã xác nhận; không tự mở khóa.
export const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function annotate(text,threads){
 const anchored=threads.filter(t=>t.anchor?.kind==='quote'&&!t.anchor.detached&&t.anchor.start>=0&&t.anchor.end<=text.length&&text.slice(t.anchor.start,t.anchor.end)===t.quote);
 const cuts=[...new Set([0,text.length,...anchored.flatMap(t=>[t.anchor.start,t.anchor.end])])].sort((a,b)=>a-b);
 return cuts.slice(0,-1).map((start,i)=>{
  const end=cuts[i+1],refs=anchored.filter(t=>t.anchor.start<end&&t.anchor.end>start).map(t=>t.ref);
  return refs.length?`<mark tabindex="0" role="button" data-threads="${esc(refs.join(','))}" aria-label="Xem ${refs.length} trao đổi về đoạn này">${esc(text.slice(start,end))}</mark>`:esc(text.slice(start,end));
 }).join('');
}
export function savedContent(session,field,{editable=false,teacher=false}={}){
 const value=session.responses[field]||'',threads=(session.commentThreads||[]).filter(t=>t.field===field);
 return `<div class="saved-field"><div class="saved-text" ${teacher?`data-select-field="${field}" tabindex="0"`:''}>${annotate(value,threads)||'<span class="empty">Chưa có nội dung.</span>'}</div>${editable&&value?`<button type="button" class="edit-content" data-edit="${field}">Edit</button>`:''}${teacher&&value?`<button type="button" class="edit-content" data-comment-field="${field}">Comment cả phần</button><small>Bôi đen một đoạn để góp ý trực tiếp.</small>`:''}</div>`;
}
export function threadsView(threads,{teacher=false}={}){
 return threads.map(t=>`<article class="h67-thread" id="thread-${esc(t.ref)}"><header><strong>Trao đổi với giảng viên</strong><span>${t.status==='addressed'?'Đã xử lý':'Đang trao đổi'}</span></header>${t.quote?`<blockquote>${esc(t.quote)}</blockquote>`:'<small>Nhận xét cả phần</small>'}${t.anchor?.detached?'<p class="old-version">Trích đoạn thuộc bản bài cũ. Nội dung gốc và trao đổi vẫn được giữ.</p>':''}${t.originalContent?`<details class="original-content"><summary>Xem nội dung lúc GV góp ý</summary><p>${esc(t.originalContent)}</p></details>`:''}${t.messages.map(m=>`<div class="thread-message ${m.role}"><strong>${m.role==='teacher'?'GV':'HV'} · ${esc(m.authorName)}</strong><time>${esc(new Date(m.createdAt).toLocaleString('vi-VN'))}</time><p>${esc(m.body)}</p></div>`).join('')}<form data-thread-reply="${esc(t.ref)}"><label>Trả lời trong cùng luồng<textarea name="body" maxlength="5000" required placeholder="Nhập lời trả lời…"></textarea></label><button type="submit" class="secondary">Gửi trả lời</button><p class="thread-status" role="status"></p></form>${teacher?`<button type="button" class="edit-content" data-thread-status="${esc(t.ref)}" data-status="${t.status==='addressed'?'open':'addressed'}">${t.status==='addressed'?'Mở lại trao đổi':'Đánh dấu đã xử lý'}</button>`:''}</article>`).join('');
}
export function approvalLabel(step){
 return step.approval?.source==='student_attested_teacher_permission'?'HV xác nhận GV đã đồng ý miệng':step.status==='passed'?'AI thông qua':'';
}
export function selectionOffsets(root,selection){
 if(!selection?.rangeCount||selection.isCollapsed)return null;
 const range=selection.getRangeAt(0);if(!root.contains(range.startContainer)||!root.contains(range.endContainer))return null;
 const before=range.cloneRange();before.selectNodeContents(root);before.setEnd(range.startContainer,range.startOffset);
 const start=before.toString().length,end=start+range.toString().length;
 return end>start&&end-start<=2000?{start,end}:null;
}
export async function fieldHash(text){
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));
 return Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('');
}
export function installStyles(){
 if(document.querySelector('[data-handout67-features]'))return;
 const link=document.createElement('link');link.rel='stylesheet';link.href=new URL('./features.css?v=20261006-2',import.meta.url).href;link.dataset.handout67Features='1';document.head.append(link);
}

// Công cụ xem thử và liên kết quay lại bảng màn; mọi nhãn chỉ mô tả trạng thái mô phỏng.
(() => {
 const q = new URLSearchParams(location.search), root = document.getElementById('app');
 const label = document.createElement('div'); label.className = 'design-preview-label';
 const link = document.createElement('a'); link.href = './' + (q.has('labOption') ? '?labOption=' + encodeURIComponent(q.get('labOption')) : ''); link.textContent = '← Toàn bộ màn demo';
 label.append(link, document.createTextNode('DỮ LIỆU MINH HỌA · Không nộp bài thật')); document.body.append(label);
 let opened = false, resultOpened = false;
 const apply = () => {
  if(q.get('screen')==='result'&&!resultOpened&&!window.DESIGN_DEMO_CONTENT.writing){const b=document.querySelector('#viewResult');if(b&&b.getClientRects().length&&!b.disabled){resultOpened=true;b.click();}}
  for(const s of document.querySelectorAll('.design-feedback-status'))if(s.textContent==='Đã có bài chấm')s.textContent='Nhận xét minh họa';
  for (const n of document.querySelectorAll('.notice')) if (n.textContent.includes('Portal') && !n.textContent.includes('minh họa')) n.textContent = 'Kết quả minh họa · không ghi điểm vào hệ thống.';
  const feedback = Number(q.get('feedback'));
  if (!opened && [1, 2].includes(feedback)) { const cards = [...document.querySelectorAll('.writing-score-card.is-action')]; const card = cards.find(c => c.textContent.includes('Task ' + feedback)); if (card) { opened = true; card.click(); } }
 };
 new MutationObserver(apply).observe(root, { childList: true, subtree: true }); apply();
 if (q.get('screen') === 'lobby') document.addEventListener('click', e => { const b = e.target.closest('#bootstrapStart'); if (!b || b.disabled) return; e.preventDefault(); e.stopImmediatePropagation(); const url = new URL(location.href); url.searchParams.set('screen', 'listening'); location.assign(url); }, true);
})();

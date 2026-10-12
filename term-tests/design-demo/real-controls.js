// Thu gọn panel để dành chiều cao cho demo; giữ nguyên iframe, bài đang xem và bài thử.
// Mỗi lần mở trang đều hiện đầy đủ điều hướng, không lưu trạng thái thu gọn.
(()=>{
 const button=document.getElementById('demo-controls-toggle');
 const panel=document.getElementById('demo-controls');
 if(!button||!panel)return;
 button.addEventListener('click',()=>{
  const expanded=button.getAttribute('aria-expanded')!=='true';
  panel.hidden=!expanded;
  button.setAttribute('aria-expanded',String(expanded));
  button.textContent=expanded?'Thu gọn điều hướng ↑':'Mở điều hướng ↓';
 });
})();

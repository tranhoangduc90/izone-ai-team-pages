// Thu gọn panel để dành chiều cao cho demo; giữ nguyên iframe, bài đang xem và bài thử.
// Mỗi lần mở trang đều hiện đầy đủ điều hướng, không lưu trạng thái thu gọn.
(()=>{
 const button=document.getElementById('demo-controls-toggle');
 const panel=document.getElementById('demo-controls');
 const toolbar=document.getElementById('demo-toolbar');
 if(!button||!panel||!toolbar)return;
 // Lớp nổi của trình duyệt giúp nút không giữ chỗ trong hàng bố cục của demo.
 if(typeof button.showPopover==='function')button.showPopover();
 button.addEventListener('click',()=>{
  const expanded=button.getAttribute('aria-expanded')!=='true';
  panel.hidden=!expanded;
  toolbar.hidden=!expanded;
  document.body.dataset.navigationCollapsed=String(!expanded);
  button.setAttribute('aria-expanded',String(expanded));
  button.textContent=expanded?'Thu gọn điều hướng ↑':'☰ Điều hướng demo';
 });
})();

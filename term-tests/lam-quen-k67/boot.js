// Báo sớm lỗi nạp module/cấu hình thay vì để màn hình xoay mãi; không đọc hoặc mở đề thi.
(function(){
  let started=false;
  window.addEventListener('k67-readiness-started',()=>{started=true;});
  function failed(){
    window.K67_READINESS_BOOT_ERROR=true;
    const app=document.getElementById('app');
    if(!app)return;
    app.textContent='Chưa tải được bài làm quen hoặc bộ kiểm. Hãy tải lại trang khi có mạng. Nếu vẫn lỗi, dùng Chrome/Edge cập nhật hoặc trao đổi với giảng viên. Chưa mở đề hay tính giờ thi.';
    app.setAttribute('role','alert');
  }
  window.addEventListener('error',e=>{if(!started&&((e.target?.tagName==='SCRIPT'&&e.target.src)||(e.target?.tagName==='LINK'&&e.target.rel==='stylesheet')))failed();},true);
  document.addEventListener('DOMContentLoaded',()=>{if(window.K67_READINESS_BOOT_ERROR)failed();});
  setTimeout(()=>{if(!started)failed();},12000);
})();

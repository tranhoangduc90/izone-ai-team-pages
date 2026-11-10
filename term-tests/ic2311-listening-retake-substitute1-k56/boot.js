// Readiness watchdog runs even if an essential module fails to download/evaluate.
(function(){
 const status=document.getElementById('identity-status');
 const fail=()=>{status.textContent='Chưa tải đủ bộ chương trình bài thi. Bạn chưa nên bắt đầu. Hãy kết nối mạng và tải lại; nếu vẫn lỗi, liên hệ giảng viên.';document.getElementById('prepare').disabled=true;};
 const timer=setTimeout(fail,15000);
 import('./app.mjs?v=20261110-open-roster-v1').then(()=>clearTimeout(timer)).catch(()=>{clearTimeout(timer);fail();});
}());

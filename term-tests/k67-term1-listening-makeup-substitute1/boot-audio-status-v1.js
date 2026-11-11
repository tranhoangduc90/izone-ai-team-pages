// Readiness watchdog runs even if an essential module fails to download/evaluate.
(function(){
 if(window.IZONE_EXAM_DEVICE_BLOCKED)return;
 const status=document.getElementById('identity-status');
 const fail=()=>{status.textContent='Chưa tải đủ bộ chương trình bài thi. Bạn chưa nên bắt đầu. Hãy kết nối mạng và tải lại; nếu vẫn lỗi, liên hệ giảng viên.';document.getElementById('prepare').disabled=true;};
 if(!window.IZONE_EXAM_DEVICE_CHECKED){fail();return;}
 const timer=setTimeout(fail,15000);
 import('./app-audio-status-v1.mjs?v=20261111-audio-status-v1').then(()=>clearTimeout(timer)).catch(()=>{clearTimeout(timer);fail();});
}());

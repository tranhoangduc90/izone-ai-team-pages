if(new URL(location.href).searchParams.get('class')==='DEMO'){import('../substitute-skill-shared/legacy-demo-entry-listening-preview-v1.mjs?v=20261125-preview-v1').then(m=>m.bootLegacyDemo()).catch(()=>{const e=document.getElementById('identity-status');if(e)e.textContent='Chưa tải được lớp DEMO. Hãy thử lại khi có mạng.';});}else{
// Readiness watchdog runs even if an essential module fails to download/evaluate.
(function(){
 if(window.IZONE_EXAM_DEVICE_BLOCKED)return;
 const status=document.getElementById('identity-status');
 const fail=()=>{status.textContent='Chưa tải đủ bộ chương trình bài thi. Bạn chưa nên bắt đầu. Hãy kết nối mạng và tải lại; nếu vẫn lỗi, liên hệ giảng viên.';document.getElementById('prepare').disabled=true;};
 if(!window.IZONE_EXAM_DEVICE_CHECKED){fail();return;}
 const timer=setTimeout(fail,15000);
 import('./app-journey-20261127-v1.mjs?v=listening-recovery-20261125-v2').then(()=>clearTimeout(timer)).catch(()=>{clearTimeout(timer);fail();});
}());

}

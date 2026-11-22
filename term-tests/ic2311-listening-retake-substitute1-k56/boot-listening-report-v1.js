if(!window.IZONE_EXAM_DEVICE_BLOCKED){
if(new URL(location.href).searchParams.get('class')==='DEMO'){import('../substitute-skill-shared/legacy-demo-entry.mjs').then(m=>m.bootLegacyDemo()).catch(()=>{const e=document.getElementById('identity-status');if(e)e.textContent='Chưa tải được lớp DEMO. Hãy thử lại khi có mạng.';});}else{
// Readiness watchdog runs even if an essential module fails to download/evaluate.
(function(){
 const status=document.getElementById('identity-status');
 const fail=()=>{status.textContent='Chưa tải đủ bộ chương trình bài thi. Bạn chưa nên bắt đầu. Hãy kết nối mạng và tải lại; nếu vẫn lỗi, liên hệ giảng viên.';document.getElementById('prepare').disabled=true;};
 const timer=setTimeout(fail,15000);
 import('./app-listening-report-v1.mjs?v=sitting-release-20261122').then(async()=>{const {connectLegacyDirectory}=await import('../substitute-skill-shared/class-directory.mjs');await connectLegacyDirectory();}).then(()=>clearTimeout(timer)).catch(()=>{clearTimeout(timer);fail();});
}());

}

}

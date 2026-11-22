if(!window.IZONE_EXAM_DEVICE_BLOCKED){
if(new URL(location.href).searchParams.get('class')==='DEMO'){import('../substitute-skill-shared/legacy-demo-entry.mjs?v=roster-picker-20261122').then(m=>m.bootLegacyDemo()).catch(()=>{const e=document.getElementById('identity-status');if(e)e.textContent='Chưa tải được lớp DEMO. Hãy thử lại khi có mạng.';});}else{
import('./app.mjs?v=roster-picker-20261122').catch(error=>{const e=document.getElementById('identity-status');if(e)e.textContent=error?.code==='LOCAL_PERSIST_FAILED'?'Không lưu được bài trên trình duyệt này. Bạn chưa nên bắt đầu. Hãy liên hệ giảng viên để kiểm tra thiết bị; nếu đang có bài, giữ nguyên trang và dữ liệu trình duyệt.':'Chưa tải đủ chương trình. Hãy kết nối mạng rồi thử tải lại trước khi thi. Nếu đang có bài, giữ nguyên dữ liệu trình duyệt và liên hệ giảng viên.';});

}

}

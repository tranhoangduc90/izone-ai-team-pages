// Compact labels retain their complete message for assistive technology and inspection.
const saveLabels=new Map([
 ['Đang giữ bản nhập trên thiết bị; chờ lưu lên hệ thống…',['Đang lưu…','pending']],
 ['Đã lưu nháp trên hệ thống.',['Đã lưu nháp','saved']],
 ['Đã tải nháp đã lưu trên hệ thống.',['Đã tải nháp','loaded']],
 ['Chưa có nháp. Bài sẽ tự lưu khi bạn nhập.',['Tự động lưu','idle']],
 ['Nháp học viên · Chỉ xem',['Chỉ xem','readonly']],
 ['Đã giữ trong bản xem thử này.',['Đã giữ bản thử','local']],
 ['Dữ liệu thử chỉ được giữ trong tab này.',['Bản thử trong tab','local']]
]);
export function setWorkspaceText(id,value){
 const node=document.getElementById(id);
 if(id!=='save-status'){if(node.textContent!==value)node.textContent=value;return;}
 const [label,state]=saveLabels.get(value)||['Cần kiểm tra lưu','error'];
 if(node.textContent!==label)node.textContent=label;
 node.title=value;node.setAttribute('aria-label',value);node.dataset.saveState=state;
 const detail=document.getElementById('save-problem'),message=state==='error'?value:'';
 if(detail.textContent!==message)detail.textContent=message;
}

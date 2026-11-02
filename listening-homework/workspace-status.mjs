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

// Di chuyển chính các node hiện có, giữ ID/callback/live region và mọi dữ liệu đang nhập.
export function mountWorkspaceStatus(){
 if(document.body.dataset.workspaceSpace!=='unified')return;
 const bar=document.querySelector('.hw-question-dock .cbt-review-bar');if(!bar)return;
 let area=bar.querySelector('.hw-status-area');
 if(!area){area=document.createElement('div');area.className='hw-status-area';area.setAttribute('aria-label','Tiến độ và trạng thái bài làm');bar.prepend(area);}
 for(const id of ['progress','save-status','docs-status','grade-status','save-problem','audio-status','threshold']){
  const node=document.getElementById(id);if(node&&node.parentElement!==area)area.append(node);
 }
 const recovery=document.querySelector('.compact-recovery');if(recovery&&recovery.parentElement!==area)area.append(recovery);
 const review=document.getElementById('review-count');if(review)review.hidden=true;
}

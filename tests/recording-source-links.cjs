const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../recordings/source-links.js'),'utf8');
function fixture(){
 const events={},dateEvents={},cell={dataset:{sourceLinkId:'old'},innerHTML:''},date={value:'',addEventListener:(n,f)=>dateEvents[n]=f};
 const record={id:'old',recordingStart:'2026-09-17T11:00:00Z'};
 const ctx={loggedIn:false,state:{records:[record]},nightlyState:{snapshot:null},escapeHtml:s=>String(s),setInterval:()=>{},Date,Map,Set,window:{},document:{querySelectorAll:()=>[cell],getElementById:()=>date,addEventListener:(n,f)=>events[n]=f}};
 ctx.window.recordingAuth={isAuthenticated:()=>ctx.loggedIn,request:async()=>({ok:true,json:async()=>({status:'available',url:'https://zoom.us/rec/play/safe',scope:'file'})})};
 vm.createContext(ctx);vm.runInContext(source,ctx);return {ctx,events,dateEvents,cell,date,record};
}
test('Legacy không cần snapshot vẫn tra theo ngày recording và cache trong phiên',async()=>{
 const f=fixture();let calls=0;f.ctx.loggedIn=true;f.ctx.window.recordingAuth.request=async body=>{calls++;assert.equal(body.date,'2026-09-17');return {ok:true,json:async()=>({status:'available',url:'https://zoom.us/rec/play/safe'})};};
 await vm.runInContext('refreshSourceLinks()',f.ctx);assert.match(f.cell.innerHTML,/href="https:\/\/zoom.us\/rec\/play\/safe"/);
 await vm.runInContext('refreshSourceLinks()',f.ctx);assert.equal(calls,1);
});
test('Phản hồi link muộn không hiện lại sau logout',async()=>{
 const f=fixture();let resolve;f.ctx.loggedIn=true;f.ctx.window.recordingAuth.request=()=>new Promise(r=>resolve=r);
 const pending=vm.runInContext('refreshSourceLinks()',f.ctx);f.ctx.loggedIn=false;f.events['recording-auth-changed']();resolve({ok:true,json:async()=>({status:'available',url:'https://zoom.us/rec/play/private'})});await pending;
 assert.doesNotMatch(f.cell.innerHTML,/private|href=/);assert.match(f.cell.innerHTML,/Đăng nhập/);
});
test('Đổi ngày bỏ phản hồi cũ; lỗi và URL giả không thành link hoặc đã xóa',async()=>{
 const f=fixture();let resolve;f.ctx.loggedIn=true;f.ctx.window.recordingAuth.request=()=>new Promise(r=>resolve=r);
 const pending=vm.runInContext('refreshSourceLinks()',f.ctx);f.date.value='2026-09-18';f.dateEvents.change();resolve({ok:true,json:async()=>({status:'available',url:'https://zoom.us/rec/play/old'})});await pending;
 assert.doesNotMatch(f.cell.innerHTML,/href=/);
 f.ctx.window.recordingAuth.request=async()=>({ok:true,json:async()=>({status:'available',url:'https://evil.test/rec/play/a'})});await vm.runInContext('refreshSourceLinks()',f.ctx);assert.doesNotMatch(f.cell.innerHTML,/href=|đã được xóa/);
});
test('Đã xóa chỉ hiển thị từ trạng thái deleted; dòng Portal báo đúng nguồn thiếu',()=>{
 const f=fixture();f.ctx.loggedIn=true;
 vm.runInContext("sourceLinks.set(sourceLinkKey(state.records[0]),{result:{status:'deleted'},at:Date.now()});paintSourceLinks()",f.ctx);
 assert.match(f.cell.innerHTML,/Recording đã được xóa trong Zoom/);
 f.record.kind='session';f.record.status='missing_assignment';vm.runInContext('paintSourceLinks()',f.ctx);assert.match(f.cell.innerHTML,/Chưa xác định tài khoản Zoom/);assert.doesNotMatch(f.cell.innerHTML,/đã được xóa/);
});

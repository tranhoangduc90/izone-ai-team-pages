const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'../recordings');
const ctx=vm.createContext({nightlyState:{snapshot:{records:[]}},state:{records:[]},escapeHtml:String,window:{},Set,document:{getElementById:()=>({})}});
vm.runInContext(fs.readFileSync(path.join(root,'publication-policy.js'),'utf8'),ctx);
const manual=fs.readFileSync(path.join(root,'manual-upload.js'),'utf8');
vm.runInContext(manual.slice(0,manual.indexOf("document.addEventListener('click'")),ctx);
const source=seconds=>({id:'fixture',kind:'recording',type:'MP4',status:'completed',fileSize:1024,source:'Zoom 6',recordingFileId:'fixture',recordingStart:'2026-10-05T11:00:00Z',recordingEnd:seconds===null?'':new Date(Date.parse('2026-10-05T11:00:00Z')+seconds*1000).toISOString()});
test('Nút đăng dùng giây chưa làm tròn: 599 khóa, 600/601 mở; tooltip không tạo caption',()=>{
 for(const seconds of [599,600,601,null]){const r=source(seconds);ctx.nightlyState.snapshot.records=[r];const html=ctx.manualUploadCell(r);assert.equal(/disabled/.test(html),seconds===null||seconds<600);assert.doesNotMatch(html,/<div|subtext/);if(seconds===599)assert.match(html,/Video dưới 10 phút/);if(seconds===null)assert.match(html,/Chưa xác minh thời lượng/);}
});
test('Lý do khóa riêng cho processing, metadata, dung lượng và tác vụ đang xử lý',()=>{
 for(const [patch,expected]of [[{status:'processing'},/processing/],[{observationStale:true},/Metadata/],[{fileSize:0},/Dung lượng/],[{fileSize:1024*1024*1024+1},/1024.0 MiB.*1 GiB/],[{youtubeStatus:'uploading'},/đang xử lý/]]){const r={...source(600),...patch};ctx.nightlyState.snapshot.records=[r];assert.match(ctx.manualUploadUnavailable(r),expected);}
});
test('Tìm đủ playlist cuối danh sách; mã lớp chính xác trước mã dài hơn và giữ tên ổn định',()=>{
 const playlists=Array.from({length:310},(_,i)=>({id:'p'+i,title:'IC'+(9000+i)}));playlists.push({id:'exact',title:'IC2253 - GV B'},{id:'similar',title:'IC22530 - GV A'},{id:'duplicate',title:'IC2253 - GV A'});
 const result=ctx.recordingPublication.playlistResults(playlists,'ic2253');assert.deepEqual(Array.from(result,p=>p.id),['duplicate','exact','similar']);
 assert.equal(ctx.recordingPublication.playlistResults(playlists,'IC9309')[0].id,'p309');assert.equal(ctx.recordingPublication.playlistResults(playlists,'không tồn tại').length,0);
});
test('Tên mới ngày Việt Nam, phần đã xác nhận; không dùng tên tự nhập từ browser',()=>{
 assert.equal(ctx.recordingPublication.date('2026-10-04T18:00:00Z'),'2026-10-05');
 assert.equal(ctx.recordingPublication.title({lessonNumber:1,recordingDate:'2026-10-05'}),'Buổi 1 (05.10.26)');
 assert.equal(ctx.recordingPublication.title({lessonNumber:11,recordingDate:'2026-10-05',partNumber:1,totalParts:2}),'Buổi 11 (05.10.26) - Phần 1');
 assert.equal(ctx.recordingPublication.validDate('2026-99-99'),false);
});

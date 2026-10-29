import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const root=new URL('../recordings/',import.meta.url);
function rules(){const context={};vm.createContext(context);vm.runInContext(fs.readFileSync(new URL('filters.js',root),'utf8'),context);return context.recordingFilters;}
const day=value=>new Date(value).toLocaleDateString('en-CA',{timeZone:'Asia/Ho_Chi_Minh'});
const rows=[
 {id:'a',source:'Zoom 6',className:'IC9001',title:'Buổi 1',recordingStart:'2026-10-25T17:00:00Z',reviewStatus:'pending'},
 {id:'b',source:'Zoom 25',className:'IC9002',title:'Buổi 2',recordingStart:'2026-10-27T14:00:00Z',reviewStatus:'approved',videoId:'fixture'},
 {id:'c',source:'Zoom 6',className:'IC9003',recordingStart:'2026-10-28T14:00:00Z',reviewStatus:'pending'},
];
test('Khoảng ngày tính cả hai đầu và đúng ngày Việt Nam ở mốc nửa đêm',()=>{
 const f=rules(),filter={from:'2026-10-26',to:'2026-10-27'};
 assert.deepEqual(rows.filter(r=>f.matches(r,filter,day)).map(r=>r.id),['a','b']);
 assert.equal(f.range('2026-12-31','2027-01-01').days.join(','),'2026-12-31,2027-01-01');
 assert.throws(()=>f.range('2026-10-29','2026-10-27'),/REVERSED/);
 assert.throws(()=>f.range('2026-02-30','2026-03-01'),/INVALID/);
 assert.throws(()=>f.range('2026-01-01','2026-12-31'),/TOO_LARGE/);
});
test('Bộ lọc cột và các trạng thái kết hợp, tìm không phân biệt dấu/hoa thường',()=>{
 const f=rules();assert.equal(rows.filter(r=>f.matches(r,{column:'title',search:'BUOI 2',review:'approved',youtube:'has_link'},day)).length,1);
 assert.equal(rows.filter(r=>f.matches(r,{column:'className',search:'Buổi'},day)).length,0);
 assert.equal(rows.filter(r=>f.matches(r,{account:'Zoom 6',review:'pending'},day)).length,2);
 assert.equal(f.youtube({videoId:'exists',destinationHold:{reason:'missing'}}),'error');
 assert.equal(f.youtube({videoId:'exists',stage:'processing'}),'processing');
});
test('Số tổng / cần duyệt / đã duyệt dùng đúng tập đang lọc',()=>{
 const f=fs.existsSync(new URL('filters.js',root))?rules():null,elements={};for(const id of ['dateFilter','dateToFilter','accountFilter','reviewFilter','youtubeFilter','columnFilter','searchFilter','totalCount','reviewCount','approvedCount','yesterdayClassCount'])elements[id]={value:'',textContent:''};
 elements.dateFilter.value='2026-10-26';elements.dateToFilter.value='2026-10-27';
 const app=fs.readFileSync(new URL('app.js',root),'utf8');
 const start=app.includes('function currentRecordingFilter()')?app.indexOf('function currentRecordingFilter()'):app.indexOf('function filteredRecords(');
 const c={recordingFilters:f,$:id=>elements[id],localDate:day,state:{records:rows,yesterdayClasses:[]},nightlyState:{error:false},isApproved:r=>r.reviewStatus==='approved'};
 vm.createContext(c);vm.runInContext(app.slice(start,app.indexOf('function renderYesterday()',start)),c);
 c.renderStats();assert.equal(String(elements.totalCount.textContent),'2');assert.equal(elements.reviewCount.textContent,'1');assert.equal(elements.approvedCount.textContent,'1');
 elements.accountFilter.value='Zoom 6';c.renderStats();assert.equal(elements.totalCount.textContent,'1');assert.equal(elements.approvedCount.textContent,'0');
 c.nightlyState.error=true;c.renderStats();assert.equal(elements.totalCount.textContent,'≥ 1');
});
test('Đọc nhiều ngày giới hạn ba request và kết quả không phụ thuộc thứ tự trả về',async()=>{
 const f=rules();let active=0,max=0;
 const r=await f.loadRange(['2026-10-26','2026-10-27','2026-10-28','2026-10-29'],async date=>{max=Math.max(max,++active);await new Promise(r=>setTimeout(r,date.endsWith('26')?20:2));active--;return {date,records:[]};});
 assert.equal(max,3);assert.equal(r.snapshots.map(s=>s.date).join(','),'2026-10-26,2026-10-27,2026-10-28,2026-10-29');
});
test('Thiếu snapshot, lỗi mạng và sai ngày được báo riêng; không coi là ngày không có recording',async()=>{
 const f=rules();const r=await f.loadRange(['2026-10-26','2026-10-27','2026-10-28'],async date=>date.endsWith('26')?null:date.endsWith('27')?{date:'2026-10-29'}:Promise.reject(Error('NETWORK')));
 assert.equal(r.missing.join(','),'2026-10-26');assert.equal(r.failed.join(','),'2026-10-27,2026-10-28');assert.equal(r.snapshots.length,0);
});
test('Ngày mặc định từ API được chấp nhận; hủy lượt cũ không đánh dấu thành công',async()=>{
 const f=rules();const r=await f.loadRange([''],async()=>({date:'2026-10-28',records:[]}));assert.equal(r.snapshots.length,1);
 const controller=new AbortController();controller.abort();await assert.rejects(f.loadRange(['2026-10-28'],async()=>({}),{signal:controller.signal}),/RANGE_ABORTED/);
});
test('Gộp đúng danh tính Zoom + file ID và giữ ngày nguồn từng recording',()=>{
 const f=rules(),a={date:'2026-10-26',records:[{id:'Zoom 6:a',source:'Zoom 6',recordingFileId:'a',version:1}]},b={date:'2026-10-27',records:[{id:'Zoom 6:a',source:'Zoom 6',recordingFileId:'a',version:2},{id:'Zoom 25:a',source:'Zoom 25',recordingFileId:'a'}]};
 const merged=f.combine([b,a]);assert.equal(merged.records.length,2);assert.equal(merged.records[0].version,2);assert.equal(merged.records[0]._snapshotDate,'2026-10-27');assert.equal(a.records[0]._snapshotDate,undefined);
});
test('Tick duyệt dùng ngày của recording trong khoảng, không dùng ngày cuối',()=>{
 const row={id:'Zoom 6:a',source:'Zoom 6',recordingFileId:'a',recordingStart:'2026-10-26T12:00:00Z',kind:'recording',_snapshotDate:'2026-10-26'};
 const c={state:{records:[row]},nightlyState:{snapshot:{date:'2026-10-28',records:[row]}},localDate:day,document:{addEventListener:()=>{}},window:{}};
 vm.createContext(c);vm.runInContext(fs.readFileSync(new URL('review.js',root),'utf8'),c);assert.equal(c.recordingReviewTarget(row).date,'2026-10-26');
});
test('Route không còn bảng và script lưu trữ VPS; bộ dọn không bị thay đổi',()=>{
 const html=fs.readFileSync(new URL('index.html',root),'utf8');assert.doesNotMatch(html,/id="recordingStorage"|src="storage\.js|Lưu trữ VPS/);
 assert.ok(fs.existsSync(new URL('storage.js',root)));assert.match(html,/id="dateToFilter"/);assert.match(html,/id="columnFilter"/);
});

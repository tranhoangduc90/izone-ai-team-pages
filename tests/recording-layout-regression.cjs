const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=process.env.RECORDING_LAYOUT_ROOT||path.resolve(__dirname,'../recordings');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8'),nightly=fs.readFileSync(path.join(root,'nightly.js'),'utf8'),css=fs.readFileSync(path.join(root,'styles.css'),'utf8'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
test('Các bảng dùng chung bảy độ rộng cột và căn ô duyệt đồng nhất',()=>{
 assert.match(app,/<colgroup>/);assert.equal((app.match(/<col class="column-/g)||[]).length,7);assert.match(css,/table-layout:\s*fixed/);assert.match(nightly,/<td class="approval-cell">/);
});
test('Nhãn lớp chưa xác định thống nhất nhưng không che mã lớp thật đang chờ duyệt',()=>{
 const body=app.match(/function displayClassName\(record\)\s*\{[\s\S]*?\n\}/)?.[0];assert.ok(body);const label=new Function(body+';return displayClassName;')();
 for(const className of ['',null,'Cần duyệt','Chưa xác định','Chưa xác định lớp'])assert.equal(label({className}),'Chưa xác định');
 assert.equal(label({className:'IC9001',reviewStatus:'pending'}),'IC9001');assert.equal(label({className:'<test>'}),'<test>');
 assert.match(nightly,/displayClassName\(record\)/);
});
test('Ô tài khoản chỉ hiện nút; status giữ cho trình đọc màn hình',()=>{
 assert.match(html,/id="recordingAuthStatus" class="sr-only"/);assert.match(css,/\.account-box\s*\{[^}]*width:\s*fit-content/);
});
test('Bảng recording bỏ buổi Portal nhưng giữ nguồn Zoom chưa đăng hoặc đã xóa',()=>{
 const body=nightly.slice(nightly.indexOf('function mergeNightlyRecords'),nightly.indexOf('async function loadNightly'));
 const rules=fs.readFileSync(path.join(root,'recording-row-rules.js'),'utf8');
 const merge=new Function(rules+'\n'+body+';return mergeNightlyRecords;')();
 const old={id:'old',kind:'recording',source:'Zoom 36',recordingFileId:'f1',title:'Đã đăng'};
 const portal={id:'session:s1',kind:'session',className:'IC9001',status:'missing_assignment'};
 const file={id:'new',kind:'recording',source:'Zoom 6',recordingFileId:'f2',status:'deleted'};
 assert.deepEqual(merge([old,portal],{records:[portal,file]}).map(r=>r.id),['old','new']);
});

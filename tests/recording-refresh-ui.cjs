const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const rulesPath = path.join(__dirname, '../recordings/recording-row-rules.js');
const source = fs.existsSync(rulesPath) ? fs.readFileSync(rulesPath, 'utf8') : '';
const nightly = fs.readFileSync(path.join(__dirname, '../recordings/nightly.js'), 'utf8');
const app = fs.readFileSync(path.join(__dirname, '../recordings/app.js'), 'utf8');
const context = vm.createContext({});
vm.runInContext(source, context);
vm.runInContext(nightly.slice(0, nightly.indexOf('async function loadNightly')), context);
vm.runInContext('function escapeHtml(v){return String(v)}; function manualUploadCell(){return "UPLOAD"}', context);
vm.runInContext(app.slice(app.indexOf('function videoEditCell'), app.indexOf('function recordRow')), context);

test('Zoom 57 chỉ hiển thị MP4, không tính bốn tệp phụ là recording', () => {
  const files = ['MP4', 'CHAT', 'TRANSCRIPT', 'TIMELINE', 'CC'].map((type) => ({kind:'recording',type,source:'Zoom 57'}));
  const visible = context.mergeNightlyRecords([], {records: files});
  assert.deepEqual(Array.from(visible, row => row.type), ['MP4']);
});

test('Zoom 55 processing vẫn hiện và có thao tác kiểm tra lại tệp', () => {
  const row = {kind:'recording',source:'Zoom 55',account:'Zoom 55',meetingUuid:'meeting',type:'',status:'processing',fileSize:0,reviewStatus:'pending'};
  assert.equal(context.shouldShowRecordingRow(row), true);
  assert.equal(context.canRefreshRecordingFile(row), true);
  assert.equal(context.canRefreshRecordingFile({...row,videoId:'already-posted'}), false);
  assert.equal(context.canRefreshRecordingFile({...row,reviewStatus:'approved'}), false);
  assert.match(context.videoEditCell({...row,id:'Zoom 55:pending'}), /<select[^>]+>[\s\S]*Kiểm tra lại tệp/);
  assert.equal(context.videoEditCell({...row,type:'MP4',status:'completed',fileSize:100}), 'UPLOAD');
});

test('Snapshot vừa kiểm tra lại thắng trạng thái file cũ từ danh sách tổng hợp',()=>{
  const previous={id:'Zoom 55:pending',kind:'recording',source:'Zoom 55',recordingFileId:'pending',type:'',status:'processing',fileSize:0,version:1};
  const refreshed={...previous,type:'MP4',status:'completed',fileSize:2048,version:2,sourceRefreshedAt:'now'};
  const [merged]=context.mergeNightlyRecords([previous],{records:[refreshed]});
  assert.equal(merged.type,'MP4');assert.equal(merged.status,'completed');assert.equal(merged.fileSize,2048);assert.equal(merged.version,2);
});

test('Zoom cấp file ID mới: ẩn placeholder cũ và chỉ hiển thị MP4 mới',()=>{
  const old={id:'Zoom 55:pending',kind:'recording',source:'Zoom 55',recordingFileId:'pending',status:'processing',type:''};
  const ready={id:'Zoom 55:ready',kind:'recording',source:'Zoom 55',recordingFileId:'ready',status:'completed',type:'MP4',
    audit:[{action:'refresh_processing_source',previousRecordId:old.id}]};
  const result=context.mergeNightlyRecords([old],{records:[ready]});
  assert.deepEqual(Array.from(result,r=>r.id),['Zoom 55:ready']);
});

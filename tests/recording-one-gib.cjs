const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
test('Nút đăng mở file Zoom28 778 MiB, nhận đúng 1GiB và chặn byte tiếp theo',()=>{
 const ctx={nightlyState:{snapshot:{records:[]}},state:{records:[]},escapeHtml:String,window:{},Set,document:{getElementById:()=>({})}};vm.createContext(ctx);
 const root=path.join(__dirname,'../recordings');vm.runInContext(fs.readFileSync(path.join(root,'publication-policy.js'),'utf8'),ctx);const code=fs.readFileSync(path.join(root,'manual-upload.js'),'utf8');vm.runInContext(code.slice(0,code.indexOf("document.addEventListener('click'")),ctx);
 for(const size of [815561046,1073741824,1073741825]){const row={id:'Zoom 28:fixture',kind:'recording',account:'Zoom 28',type:'MP4',status:'completed',fileSize:size,recordingFileId:'fixture',recordingStart:'2026-10-09T10:00:00Z',recordingEnd:'2026-10-09T11:00:00Z'};ctx.nightlyState.snapshot.records=[row];const html=ctx.manualUploadCell(row);assert.equal(/disabled/.test(html),size>1073741824);assert.doesNotMatch(html,/<div|subtext/);}
});

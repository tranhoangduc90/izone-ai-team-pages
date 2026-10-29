// Nhận bảy app Writing thật; chạy cùng ca gõ, retry, xung đột và phục hồi trong Chrome.
// Không gọi API ngoài; client nào lỗi giữ exit code và báo cáo để chặn phát hành.
const test = require('node:test');
const assert = require('node:assert/strict');
const {spawn} = require('node:child_process');
const {join} = require('node:path');
for (const client of ['shared','k56-shared','k56-mini-shared','k56-test2-shared','substitute-k56-shared','substitute-k67-shared','substitute-test-2-k56-shared']) {
  test(`D08 giao diện ${client}: hành vi lưu và phục hồi`, async () => {
    // Runner con chạy đủ ca của từng app, không kế thừa kênh IPC của node --test cha.
    const childEnv = {...process.env,D08_SOURCE_APP:join(__dirname,'../term-tests',client,'app.js'),D08_DEBUG:''};
    delete childEnv.NODE_TEST_CONTEXT;
    const result = await new Promise(resolve => {
      const child=spawn(process.execPath,['--test','--test-reporter=tap',join(__dirname,'term-writing-save-ui.cjs')],{
        cwd:join(__dirname,'..'),env:childEnv,stdio:['ignore','pipe','pipe']
      });
      let stdout='',stderr='';
      child.stdout.on('data',chunk=>{stdout+=chunk;});child.stderr.on('data',chunk=>{stderr+=chunk;});
      const timer=setTimeout(()=>child.kill(),180000);
      child.on('error',error=>{clearTimeout(timer);resolve({error,stdout,stderr});});
      child.on('exit',status=>{clearTimeout(timer);resolve({status,stdout,stderr});});
    });
    assert.equal(result.error,undefined,result.error?.message);
    assert.equal(result.status,0,(result.stdout||'')+(result.stderr||''));
    const count=client==='shared'?16:12;
    assert.match(result.stdout,new RegExp(`tests ${count}`));assert.match(result.stdout,new RegExp(`pass ${count}`));
    assert.match(result.stdout,/fail 0/);assert.match(result.stdout,/skipped 0/);
  });
}

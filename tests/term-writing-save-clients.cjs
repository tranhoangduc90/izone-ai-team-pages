// Nhận bảy app Writing thật; chạy cùng ca gõ, retry, xung đột và phục hồi trong Chrome.
// Không gọi API ngoài; client nào lỗi giữ exit code và báo cáo để chặn phát hành.
const test = require('node:test');
const assert = require('node:assert/strict');
const {spawnSync} = require('node:child_process');
const {join} = require('node:path');
for (const client of ['shared','k56-shared','k56-mini-shared','k56-test2-shared','substitute-k56-shared','substitute-k67-shared','substitute-test-2-k56-shared']) {
  test(`D08 giao diện ${client}: 12 ca hành vi lưu và phục hồi`, () => {
    const result = spawnSync(process.execPath,['--test',join(__dirname,'term-writing-save-ui.cjs')],{
      cwd:join(__dirname,'..'),encoding:'utf8',timeout:180000,
      env:{...process.env,D08_SOURCE_APP:join(__dirname,'../term-tests',client,'app.js'),D08_DEBUG:''}
    });
    assert.equal(result.error,undefined,result.error?.message);
    assert.equal(result.status,0,(result.stdout||'')+(result.stderr||''));
    assert.match(result.stdout,/tests 12/);assert.match(result.stdout,/pass 12/);
    assert.match(result.stdout,/fail 0/);assert.match(result.stdout,/skipped 0/);
  });
}

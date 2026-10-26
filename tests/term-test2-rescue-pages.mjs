import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const script=readFileSync(new URL('../term-tests/term-test-2-rescue/rescue-audio.js',import.meta.url),'utf8');
function boot(classCode='IC2213',slug='term-test-2') {
  const calls=[],notice={textContent:''},verify=()=>{};
  const win={TERM_TEST_APP_CONFIG:{native:true},TERM_TEST_CONFIG:{slug},K67_PUBLIC_AUDIO:{verify,download:(manifest,options)=>{calls.push({manifest,options});return 'checked-blob';}}};
  vm.runInNewContext(script,{window:win,location:{search:'?class='+classCode},URLSearchParams,document:{getElementById:()=>notice}});
  return{win,calls,notice,verify};
}
test('IC2213 giữ xác minh file và chọn Pages mà không sửa manifest/quyền gốc',()=>{
  const f=boot(),manifest={sha256:'same',cloudflare:{version:1},url:'same-public-file'},options={signal:{}};
  assert.equal(f.win.K67_PUBLIC_AUDIO.download(manifest,options),'checked-blob');
  assert.equal(f.calls[0].manifest.cloudflare,undefined);
  assert.equal(f.calls[0].manifest.sha256,manifest.sha256);
  assert.ok(manifest.cloudflare);
  assert.equal(f.calls[0].options,options);
  assert.equal(f.win.K67_PUBLIC_AUDIO.verify,f.verify);
  assert.equal(f.win.TERM_TEST_APP_CONFIG.native,true);
});
test('link sai lớp/bài dừng trước khởi động API',()=>{
  for(const [code,slug] of [['OTHER','term-test-2'],['IC2213','term-test-1']]){
    const f=boot(code,slug);assert.equal(f.win.TERM_TEST_APP_CONFIG,undefined);assert.match(f.notice.textContent,/IC2213/);assert.equal(f.calls.length,0);
  }
});
test('entry giữ engine/config/controller gốc; mọi script và CSS cùng origin có file thật',()=>{
  const entry=new URL('../term-tests/term-test-2-rescue/index.html',import.meta.url),html=readFileSync(entry,'utf8');
  assert.match(html,/\.\.\/term-test-2-computer-based\/bootstrap\.js/);
  assert.match(html,/\.\.\/k67-shared\/config\.js/);
  assert.ok(html.indexOf('rescue-audio.js')<html.indexOf('src="../term-test-2-computer-based/bootstrap.js'));
  for(const [,src] of html.matchAll(/(?:src|href)="([^"#]+)"/g)){
    if(/^(?:data:|https:)/.test(src))continue;
    assert.ok(existsSync(fileURLToPath(new URL(src.split('?')[0],entry))),src);
  }
});

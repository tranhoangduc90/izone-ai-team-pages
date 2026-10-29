// Đối chiếu graph entry → bootstrap → app của sáu test và thi bù K67.
// Không tải mạng; lỗi version khiến runner thất bại để tránh nhận nhầm bản cache cũ.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const version='20261023-submit-v1';
for(const slug of ['term-test-1','term-test-2','mini-test-lesson-5','term-test-1-k56','term-test-2-k56','mini-test-k56']){
 for(const delivery of ['','-computer-based'])test(slug+delivery+': entry nạp revision mới',()=>{
  const html=fs.readFileSync(`term-tests/${slug+delivery}/index.html`,'utf8');
  const target=delivery?'bootstrap.js':'shared/app.js';
  const urls=[...html.matchAll(/src="([^"]+)"/g)].map(m=>m[1]).filter(url=>url.includes(target));
  const expectedVersion=delivery?'20261024-cf512-1':version;
  assert.equal(urls.length,1);assert.equal(new URL(urls[0],'https://fixture.invalid').searchParams.get('v'),expectedVersion);
 });
}
for(const directory of ['term-test-2-computer-based','term-test-1-k56-computer-based','term-test-2-k56-computer-based','mini-test-k56-computer-based'])test(directory+': mọi đường nạp app chính/dự phòng dùng revision mới',()=>{
 const source=fs.readFileSync(`term-tests/${directory}/bootstrap.js`,'utf8');
 const urls=[...source.matchAll(/(?:shared|k56-shared|k56-test2-shared|k56-mini-shared)\/app\.js\?[^'"\s)]+/g)].map(m=>m[0]);
 assert.ok(urls.length>0);for(const url of urls)assert.equal(new URL(url,'https://fixture.invalid').searchParams.get('v'),version);
});
test('Thi bù Listening giữ cùng bản vá; module không có đáp án/chìa khóa',()=>{
 assert.match(fs.readFileSync('term-tests/term-test-1-listening-retake/index.html','utf8'),/bootstrap\.js\?v=20261023-submit-v1/);
 const source=fs.readFileSync('term-tests/shared/section-submission.mjs','utf8');
 assert.doesNotMatch(source,/correctAnswers|acceptedAnswers|api_key|Bearer /);
});
test('K67 nạp bản phục hồi ACK qua entry, bootstrap và phiếu cứu hộ',()=>{
 const files=['term-test-1/index.html','term-test-2/index.html','mini-test-lesson-5/index.html',
  'term-test-1-computer-based/index.html','term-test-2-computer-based/index.html','mini-test-lesson-5-computer-based/index.html',
  'term-test-1-listening-retake/index.html','term-test-2-rescue/index.html'];
 for(const file of files){
  const html=fs.readFileSync('term-tests/'+file,'utf8');
  const urls=[...html.matchAll(/src="([^"]+)"/g)].map(m=>m[1]).filter(url=>url.includes('shared/app.js')||url.includes('bootstrap.js'));
  assert.equal(urls.length,1,file);
  assert.equal(new URL(urls[0].replaceAll('&amp;','&'),'https://fixture.invalid').searchParams.get('writing_ack'),'20261029-v1',file);
 }
 const bootstrap=fs.readFileSync('term-tests/term-test-2-computer-based/bootstrap.js','utf8');
 const apps=[...bootstrap.matchAll(/\.\.\/shared\/app\.js\?[^'"\s)]+/g)].map(m=>m[0]);
 assert.ok(apps.length);for(const url of apps)assert.equal(new URL(url,'https://fixture.invalid').searchParams.get('writing_ack'),'20261029-v1');
 // enhance phải có bản vá submission hiện hành cả khi qua cbtAssetUrl.
 const enhanceLoads=[...bootstrap.matchAll(/cbtAssetUrl\('(enhance\.js[^']*)', '([^']+)'\)/g)];
 assert.equal(enhanceLoads.length,1);
 for(const [,file,revision] of enhanceLoads){
  const url=new URL(`${file}?rev=${revision}`,'https://fixture.invalid');
  assert.equal(url.searchParams.get('v'),version);
 }
});

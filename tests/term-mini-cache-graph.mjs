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
  const expectedVersion=delivery&&slug.endsWith('k56')?'20261023-pages-audio1':version;
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

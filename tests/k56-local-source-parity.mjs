import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repo=process.cwd();
const workspace=path.resolve(repo,'../..');
const pairs=[
  ['term-tests/izone-term-tests-k56/term-test-1-k56-computer-based','term-tests/term-test-1-k56-computer-based'],
  ['term-tests/izone-term-test-2-k56/term-test-2-k56-computer-based','term-tests/term-test-2-k56-computer-based']
];
const normalizeContent=text=>text.replace(/src:\s*(?:['"]assets\/private\/[^'"]+['"]|'')/g,"src:''").replace(/\r\n/g,'\n');
for(const [sourceRelative,onlineRelative] of pairs){
  const source=path.join(workspace,sourceRelative),online=path.join(repo,onlineRelative);
  assert.equal(normalizeContent(fs.readFileSync(path.join(online,'content.js'),'utf8')),normalizeContent(fs.readFileSync(path.join(source,'content.js'),'utf8')));
  assert.equal(fs.readFileSync(path.join(online,'layout-updates.css'),'utf8').replace(/\r\n/g,'\n'),fs.readFileSync(path.join(source,'layout-updates.css'),'utf8').replace(/\r\n/g,'\n'));
  assert.match(fs.readFileSync(path.join(online,'index.html'),'utf8'),/layout-updates\.css/);
}
assert.equal(fs.readFileSync(path.join(repo,'term-tests/term-test-1-k56-computer-based/styles.css'),'utf8').replace(/\r\n/g,'\n'),fs.readFileSync(path.join(workspace,'term-tests/izone-term-tests-k56/term-test-1-k56-computer-based/styles.css'),'utf8').replace(/\r\n/g,'\n'));
console.log('K56 online giữ nguyên bố cục/nội dung bản local; chỉ loại URL audio riêng tư.');

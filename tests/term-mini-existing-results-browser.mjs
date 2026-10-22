// Mở bài cũ qua entry/nhận diện/bootstrap thật; API chỉ trả điểm và bài giả đã có.
// Không nộp/chấm lại hoặc gửi điểm ra ngoài. Hai thứ tự phải mở cùng đúng kết quả cũ.
import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {serve,completedPage} from './helpers/result-details-browser-fixture.mjs';
const modules=process.env.CODEX_NODE_MODULES||resolve(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const {chromium}=createRequire(pathToFileURL(resolve(modules,'playwright/package.json')))('playwright');
let browser,server;
before(async()=>{server=await serve();browser=await chromium.launch({channel:'msedge',headless:true});});
after(async()=>{await browser?.close();await server?.close();});
for(const slug of ['term-test-1-k56','term-test-2-k56','mini-test-k56'])for(const delivery of ['','-computer-based'])for(const mode of ['lis_first','read_first'])
test(slug+delivery+'/'+mode+': mở đúng bài/điểm cũ',async()=>{
 const f=await completedPage(browser,server.base,slug+delivery,{examMode:mode,waitTimeout:15000});
 try{
  if(!await f.details.first().evaluate(el=>el.open))await f.details.first().locator('summary').click();
  const text=await f.page.locator('#questionDetails').innerText();assert.match(text,/OLD-RUN/);
  assert.equal(await f.page.locator('#resultStudentName').innerText(),'Học viên giả A');
  assert.equal(await f.details.count(),2);assert.deepEqual(f.errors,[]);
 }finally{await f.close();}
});

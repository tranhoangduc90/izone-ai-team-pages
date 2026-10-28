// Kiểm đáp án đối chiếu từ kết quả API đã mở quyền; không chứa dữ liệu lớp thật.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const {chromium}=createRequire('C:/Users/ADMIN/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json')('playwright');
const root=fileURLToPath(new URL('../',import.meta.url));
test('Đối chiếu sau nộp: giữ ẩn theo quyền, hiện đáp án nguồn mà không gọi thành đúng/sai',{timeout:30000},async()=>{
 const server=createServer(async(req,res)=>{try{const path=new URL(req.url,'http://local').pathname;
  if(path==='/fixture'){res.setHeader('content-type','text/html');return res.end('<!doctype html><main></main>');}
  const file=resolve(root,'.'+path);if(!file.startsWith(resolve(root)+sep))throw Error('Denied');res.setHeader('content-type',extname(file)==='.js'?'text/javascript':'text/plain');res.end(await readFile(file));
 }catch{res.writeHead(404);res.end();}});await new Promise(done=>server.listen(0,'127.0.0.1',done));
 const origin=`http://127.0.0.1:${server.address().port}`,browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage();
 try{await page.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());await page.goto(origin+'/fixture');
  const result=await page.evaluate(async()=>{
   const {partFeedback}=await import('/progress-log/thuy-live/part-feedback.js');
   const item={itemVersionId:'ref',position:1,prompt:'Câu giả có ô điền',layoutType:'numbered_short_texts',options:[]},block={items:[item]},grade={itemVersionId:'ref',rawAnswer:['Chữ của người học'],maxScore:0,verdict:'ungraded',explanation:'Đáp án đối chiếu giả: ý chính.'};
   const hidden=partFeedback(block,{answerRelease:'hidden',items:[grade]});
   const shown=partFeedback(block,{answerRelease:'released',items:[grade]});document.querySelector('main').append(shown);
   return {hidden:hidden===null,text:shown.innerText};
  });assert.equal(result.hidden,true);assert.match(result.text,/ý chính/);assert.match(result.text,/không tự chấm đúng\/sai/i);assert.doesNotMatch(result.text,/✕ Sai|✓ Đúng|0 đúng/);
  const graded=await page.evaluate(async()=>{
   const {partFeedback}=await import('/progress-log/thuy-live/part-feedback.js');
   const items=[4,6,2].map((count,index)=>({itemVersionId:'group-'+index,position:index+1,prompt:'Nhóm giả '+index,layoutType:'numbered_short_texts',options:[],interactionConfig:{responseCount:count,responseLabels:Array.from({length:count},(_,i)=>'Nhãn giả '+index+' · '+i)}}));
   const grades=items.map(item=>({itemVersionId:item.itemVersionId,maxScore:item.interactionConfig.responseCount,verdict:'partial',expectedAnswer:['khóa nhóm'],slotResults:Array.from({length:item.interactionConfig.responseCount},(_,slot)=>({slot,rawAnswer:slot===1?null:'Nội dung giả',verdict:slot===1?'incorrect':'correct',expectedAnswer:['Đáp án giả '+slot]}))}));
   const hidden=partFeedback({items},{answerRelease:'hidden',items:grades});
   const shown=partFeedback({items},{answerRelease:'released',items:grades});document.querySelector('main').replaceChildren(shown);
   const {reviewItems}=await import('/progress-log/answer-review.js');
   const history=reviewItems({definition:{blocks:[{items}]},responses:{},gradingItems:grades,submissionId:'fake'});
   return {hidden:hidden===null,text:shown.innerText,slots:shown.querySelectorAll('.thuy-slot-review li').length,history};
  });
  assert.equal(graded.hidden,true);assert.equal(graded.slots,12);assert.match(graded.text,/9 đúng · 3 sai \/ 12 ô đã chấm/);
  assert.match(graded.text,/Nhãn giả 1 · 5/);assert.match(graded.text,/Để trống/);assert.match(graded.text,/✓ Đúng/);assert.match(graded.text,/✕ Sai/);
  assert.match(graded.history,/Đúng một phần/);assert.doesNotMatch(graded.history,/Chưa có kết quả chấm/);
  await page.setViewportSize({width:390,height:850});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 }finally{await browser.close();await new Promise(done=>server.close(done));}
});

// Entry, renderer và client lưu thật; HTTP giả cách ly, không gọi dịch vụ học viên.
// Bảo vệ đáp án khi trình duyệt từ chối sửa URL; test cũ chỉ kiểm History API hoạt động.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {serveDirectory} from './fixtures/static-ui-server.mjs';

const root=path.resolve(fileURLToPath(new URL('../',import.meta.url)));
const {chromium}=createRequire(path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json'))('playwright');
const content={type:'tfng',lesson:12,code:'synthetic-history-input',version:'fixture-v1',title:'Bài đối chiếu giả',blankValues:['','—','...'],dropdownPlaceholders:['Nhấn để chọn'],minimumRequired:42,
 paragraphs:[{id:'1',text:'Synthetic source for an isolated input and saving test.'}],questions:[],targets:[]};
for(let number=1;number<=6;number++){
 const q={number,text:'Synthetic statement '+number,leader:'synthetic',sensitive:'scope',targets:{},chunks:[]};
 for(let m=1;m<=3;m++){
  const evidenceTarget=`q${number}.m${m}.evidence`,labelTarget=`q${number}.m${m}.label`;
  q.chunks.push({number:m,text:'Synthetic fragment '+m,evidenceTarget,labelTarget});
  q.targets['m'+m+'_evidence']=evidenceTarget;q.targets['m'+m+'_label']=labelTarget;
  content.targets.push({id:evidenceTarget,kind:'evidence',question:number,label:'Evidence'},{id:labelTarget,kind:'chunk_label',question:number,label:'Label'});
 }
 q.targets.conclusion=`q${number}.conclusion`;content.targets.push({id:q.targets.conclusion,kind:'conclusion',question:number,label:'Conclusion'});content.questions.push(q);
}
let site,browser;
test.before(async()=>{site=await serveDirectory(root);browser=await chromium.launch({channel:'chrome',headless:true});});
test.after(async()=>{await browser?.close();await site?.close();});

for(const [width,mode] of [[1440,'throws'],[390,'throws'],[1440,'unchanged-url']]){
 test(`Đủ 42 đáp án, lưu và mở lại khi URL ${mode} · ${width}px`,{timeout:30000},async t=>{
  const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage();
  t.after(()=>context.close());page.setDefaultTimeout(7000);
  const errors=[],external=[],puts=[];page.on('pageerror',e=>errors.push(e.message));
  let body={answers:{},flags:[],notes:'',annotations:[]},revision=0,savedAt=null;
  const completeness=()=>({filled_cells:Object.values(body.answers).filter(v=>String(v).trim()).length,total_cells:42,minimum_required:42});
  await page.addInitScript(mode=>{
   const replace=history.replaceState.bind(history);window.__historyCalls=0;
   history.replaceState=(...args)=>{window.__historyCalls++;if(mode==='throws')throw new DOMException('Synthetic history permission rejection','SecurityError');return replace(...args);};
  },mode);
  await context.route('**/*',async route=>{
   const req=route.request(),url=new URL(req.url()),reply=value=>route.fulfill({json:value});
   if(url.origin!==site.origin){external.push(url.origin);return route.abort();}
   if(url.pathname.endsWith('/api-config.js'))return route.fulfill({contentType:'text/javascript',body:'window.READING67_API_BASE='+JSON.stringify(site.origin+'/__input-test')+';'});
   if(url.pathname.endsWith('/access.js'))return route.fulfill({contentType:'text/javascript',body:'window.Reading67Access={open:async()=>({config:{demo:true,type:"tfng",lesson:12}}),headers:{}};'});
   if(!url.pathname.startsWith('/__input-test'))return route.continue();
   const api=url.pathname.slice('/__input-test'.length);
   if(api==='/lesson')return reply({identity:{ownerId:'synthetic-owner',courseId:'1124',name:'Người học giả',className:'LỚP THỬ'},content});
   if(api==='/attempts')return reply({attempts:[]});
   if(api==='/draft'&&req.method()==='GET')return reply({body,revision,savedAt,completeness:completeness()});
   if(api==='/draft'&&req.method()==='PUT'){
    const operation=req.postDataJSON();assert.equal(operation.baseRevision,revision);body=structuredClone(operation.body);puts.push(body);revision++;savedAt='2026-11-02T05:00:00.000Z';
    return reply({body,revision,savedAt,completeness:completeness()});
   }
   throw Error('Unexpected fixture request: '+req.method()+' '+api);
  });
  const entry=site.origin+'/reading-skills67/butterflies-britain-tfng/?server=1'+(mode==='throws'?'&scenario=current':'');
  await page.goto(entry);await page.locator('textarea[data-target]').first().waitFor({state:'attached'});
  if(width===390)await page.locator('[data-pane="questions"]').click();
  const expected={};
  for(const target of content.targets){
   const control=page.locator('[data-target="'+target.id+'"]'),value=target.kind==='evidence'?'Nội dung tự viết '+target.id:'TRUE';expected[target.id]=value;
   if(target.kind==='evidence')await control.fill(value);else await control.selectOption(value);
  }
  await page.evaluate(()=>window.ReadingServerClient.flush());
  assert.deepEqual(body.answers,expected,'Cả 42 giá trị đang hiện phải được gửi lưu, kể cả khi History API bị từ chối.');
  assert.ok(puts.length>0);assert.deepEqual(await page.evaluate(()=>window.ReadingInteractionBridge.current().answers),expected);
  await page.locator('[data-action="review"]').first().click();assert.match(await page.locator('#modal').innerText(),/42\/42 phần/);await page.keyboard.press('Escape');
  if(mode==='unchanged-url')assert.equal(await page.evaluate(()=>window.__historyCalls),0,'Gõ đáp án không được sửa lịch sử URL nếu URL không đổi.');
  else assert.ok(await page.evaluate(()=>window.__historyCalls)>0,'Ca từ chối phải thực sự chạm History API.');
  assert.deepEqual(errors,[]);
  await page.reload();await page.locator('textarea[data-target]').first().waitFor({state:'attached'});
  assert.deepEqual(await page.evaluate(()=>window.ReadingInteractionBridge.current().answers),expected);
  assert.match(await page.locator('#progress-label').textContent(),/42\/42/);
  // Mọi request bên ngoài bị chặn trước khi gửi; fixture không đăng nhập hoặc ghi dịch vụ thật.
  assert.deepEqual(external,[]);
 });
}

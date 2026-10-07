// Giao diện thật, bài giả, mọi kết nối ngoài local bị chặn; không gọi AI/Portal.
import {createServer} from 'node:http';import fs from 'node:fs';import path from 'node:path';import {createRequire} from 'node:module';import assert from 'node:assert/strict';
const root=path.resolve(new URL('../',import.meta.url).pathname.replace(/^\/([A-Z]:)/,'$1'));
const {chromium}=createRequire('C:/Users/vukha/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json')('playwright');
const server=createServer((req,res)=>{const u=new URL(req.url,'http://localhost'),p=path.resolve(root,'.'+u.pathname+(u.pathname.endsWith('/')?'index.html':''));if(!p.startsWith(root+path.sep))return res.writeHead(403).end();try{res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png'})[path.extname(p)]||'application/octet-stream');res.end(fs.readFileSync(p));}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=process.argv.includes('--online')?'https://tranhoangduc90.github.io/izone-ai-team-pages':'http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({channel:'msedge',headless:true}),out=path.join(root,'output/playwright/substitute-two-task');fs.mkdirSync(out,{recursive:true});
try{for(const viewport of [{width:1440,height:1000},{width:390,height:844}]){
 const context=await browser.newContext({viewport});await context.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/term-tests/substitute-test-2-k67-computer-based/?demo=writing&class=DEMO');await page.locator('#writingView').waitFor({state:'visible'});
 const tabs=page.locator('#writingTaskTabs button');assert.deepEqual(await tabs.allTextContents(),['Task 1','Task 2']);
 assert.equal(await page.locator('.writing-task-figure img').evaluate(img=>img.complete&&img.naturalWidth>0),true);
 const t1=page.locator('[data-writing-task="task1"]'),t2=page.locator('[data-writing-task="task2"]'),o1=page.locator('[data-writing-outline="task1"]'),o2=page.locator('[data-writing-outline="task2"]');
 await t1.fill('Fictional chart report.');await o1.fill('Fictional chart plan.');
 await tabs.nth(1).click();await o2.fill('Fictional congestion plan.');await page.locator('#submitWriting').click();
 assert.match(await page.locator('#notice').textContent(),/Bạn chưa viết Task 2/);assert.equal(await o2.inputValue(),'Fictional congestion plan.');assert.equal(await page.locator('#resultView').isVisible(),false);
 await t2.fill('Fictional traffic essay.');await tabs.nth(0).click();assert.equal(await t1.inputValue(),'Fictional chart report.');assert.equal(await o1.inputValue(),'Fictional chart plan.');
 await page.screenshot({path:path.join(out,'task1-'+viewport.width+'.png'),fullPage:true});await tabs.nth(1).click();assert.equal(await t2.inputValue(),'Fictional traffic essay.');assert.equal(await o2.inputValue(),'Fictional congestion plan.');
 await page.screenshot({path:path.join(out,'task2-'+viewport.width+'.png'),fullPage:true});
 await page.reload();await page.locator('#writingView').waitFor({state:'visible'});assert.equal(await page.locator('[data-writing-task="task2"]').inputValue(),'Fictional traffic essay.');
 await page.locator('#writingTaskTabs button').nth(0).click();assert.equal(await page.locator('[data-writing-task="task1"]').inputValue(),'Fictional chart report.');assert.equal(await page.locator('[data-writing-outline="task1"]').inputValue(),'Fictional chart plan.');
 // Bàn phím kích hoạt Task 2, không phụ thuộc chuột.
 await page.locator('#writingTaskTabs button').nth(1).focus();await page.keyboard.press('Enter');assert.equal(await page.locator('[data-writing-task="task2"]').isVisible(),true);
 assert.deepEqual(errors,[]);await context.close();
}console.log(JSON.stringify({ok:true,desktopMobile:true,twoDraftsReload:true,blankManualBlocked:true,keyboard:true,aiCalls:0,portalWrites:0,screenshots:out}));}
finally{await browser.close();await new Promise(r=>server.close(r));}

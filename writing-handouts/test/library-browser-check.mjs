// Navigation regression: fake authentication only; no real student is opened/submitted.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL,fileURLToPath} from 'node:url';
const modules=resolve(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const {chromium}=createRequire(pathToFileURL(resolve(modules,'playwright/package.json')))('playwright');
const live=process.argv.includes('--live'),base='https://tranhoangduc90.github.io/izone-ai-team-pages/';
const root=fileURLToPath(new URL('../../',import.meta.url)),out=process.env.SHOPS_LIBRARY_QA_OUT;
const browser=await chromium.launch({channel:'msedge',headless:true}),context=await browser.newContext(),requests=[],errors=[];
let accessError=0;
context.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));
if(!live)await context.route(base+'**',async route=>{
 const relative=decodeURIComponent(new URL(route.request().url()).pathname.slice(new URL(base).pathname.length));
 const path=resolve(root,relative.endsWith('/')?relative+'index.html':relative);assert.ok(path.startsWith(resolve(root)+sep));
 const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.css':'text/css','.woff2':'font/woff2','.png':'image/png'};
 await route.fulfill({status:200,body:await readFile(path),contentType:types[extname(path)]||'application/octet-stream'});
});
await context.route('https://ducizone.ddns.net/teacher-session-api/**',route=>route.fulfill({status:route.request().url().endsWith('/restore/writing')?200:401,json:{ok:route.request().url().endsWith('/restore/writing')}}));
await context.route('https://ducizone.ddns.net/writing-api/**',async route=>{
 const path=new URL(route.request().url()).pathname;requests.push(path);
 if(path.endsWith('/admin/me')&&accessError)return route.fulfill({status:accessError,json:{ok:false}});
 if(path.endsWith('/auth/session')||path.endsWith('/admin/me'))return route.fulfill({status:200,json:{ok:true,reviewer:{role:'admin'},classes:[]}});
 if(path.endsWith('/admin/live/activities/writing-task2-public-health-ban'))return route.fulfill({status:404,json:{ok:false,error:'ACTIVITY_NOT_FOUND'}});
 if(path.endsWith('/shared-session'))return route.fulfill({status:401,json:{ok:false}});
 throw Error('Unexpected Writing request: '+path);
});
await context.route('https://ducizone.ddns.net/shops-writing-api/api/v1/auth/session',route=>route.fulfill({status:401,json:{ok:false}}));
await context.route('https://ducizone.ddns.net/**/shared-session',route=>route.fulfill({status:401,json:{ok:false}}));
try{
 const page=await context.newPage();await page.goto(base+'writing-handouts/library.html');
 await page.locator('#library-content:not([hidden])').waitFor({timeout:7000});
 assert.equal(requests.some(p=>p.includes('/admin/live/activities/writing-task2-public-health-ban')),false);
 await page.locator('#class-select').selectOption('CS.181026');
 const card=page.locator('[data-slug="writing-task2-public-health-ban"]');
 assert.equal(await card.getByRole('button',{name:'Xem dashboard',exact:true}).isEnabled(),true);
 await context.grantPermissions(['clipboard-read','clipboard-write'],{origin:new URL(base).origin});
 await card.getByRole('button',{name:'Sao chép link học viên',exact:true}).click();
 const copied=await page.evaluate(()=>navigator.clipboard.readText());assert.equal(new URL(copied).pathname,'/izone-ai-team-pages/shops-writing/');assert.equal(new URL(copied).searchParams.get('class'),'CS.181026');
 const [student]=await Promise.all([context.waitForEvent('page'),card.getByRole('button',{name:'Xem handout',exact:true}).click()]);
 await student.locator('#identity-form').waitFor();assert.equal(new URL(student.url()).searchParams.get('class'),'CS.181026');assert.equal(await student.locator('#identity-person option').count(),24);await student.close();
 await card.getByRole('button',{name:'Xem dashboard',exact:true}).click();await page.waitForURL('**/shops-writing/teacher.html?**');assert.equal(new URL(page.url()).searchParams.get('class'),'CS.181026');
 for(const status of [403,503]){
  accessError=status;const denied=await context.newPage();await denied.goto(base+'writing-handouts/library.html');
  await denied.locator('#auth-status').filter({hasText:status===403?'chưa được cấp quyền':'Không thể xác minh'}).waitFor();assert.equal(await denied.locator('#library-content').isHidden(),true);await denied.close();
 }
 assert.equal(errors.length,0,errors.join('\n'));
 const report={outcome:'passed',mode:live?'live':'candidate',authentication:'fixture',retiredShopsAuthProbeNotUsed:true,newClassAvailable:true,copiedStudentLinkCorrect:true,studentNavigationCorrect:true,teacherNavigationCorrect:true,permissionDeniedAndServiceFailureStayLocked:true,realStudentSessionsOpened:0};
 if(out)await writeFile(resolve(out,'library-'+(live?'live':'candidate')+'.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}catch(error){if(out)await writeFile(resolve(out,'library-'+(live?'live':'candidate')+'-failure.json'),JSON.stringify({error:error.message,requests,errors}));throw error;}
finally{await context.close();await browser.close();}

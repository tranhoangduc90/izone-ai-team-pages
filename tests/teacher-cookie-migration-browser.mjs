import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';

assert.ok(process.env.SPEAKING_BACKEND_DIR);
assert.ok(process.env.PLAYWRIGHT_MODULE);
assert.ok(process.env.TEACHER_COOKIE_EVIDENCE_DIR);
const backend=resolve(process.env.SPEAKING_BACKEND_DIR),output=resolve(process.env.TEACHER_COOKIE_EVIDENCE_DIR);
await mkdir(output,{recursive:true});
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const {fixture}=await import(pathToFileURL(join(backend,'test/auth-observation-fixture.mjs')).href);
const {createApp}=await import(pathToFileURL(join(backend,'src/app.js')).href);
const f=await fixture(),servers=[],external=[],errors=[];let browser;
const listen=async server=>{servers.push(server);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));return server.address().port;};
let result={outcome:'failure',fixtureGoogle:true,productionCalls:false};
try{
 await f.db.exec('ALTER TABLE mapping.reviewer_session ADD COLUMN revoked_reason text');
 const pageServer=createServer((_req,res)=>res.writeHead(200,{'content-type':'text/html'}).end('<!doctype html><title>Teacher cookie migration fixture</title>'));
 const pageOrigin='http://127.0.0.1:'+await listen(pageServer);
 const app=createApp({config:{...f.config,googleClientId:'fixture-only-client',trustProxyHops:0,
  allowedOrigins:new Set([pageOrigin]),teacherSessionCookieName:'izone_teacher_session',teacherSessionCookiePath:'/mapping-api',
  teacherSessionCookieSecure:true,teacherSessionCookieSameSite:'None',teacherSessionCookiePartitioned:true,
  teacherSessionIdleDays:90,teacherSessionAbsoluteDays:365},pool:f.authPool,
  verifyGoogleToken:async credential=>{assert.equal(credential,'google-credential-for-isolated-cookie-fixture');return{email:'teacher1@fixture.test',sub:'subject-1',email_verified:true};}});
 const apiServer=createServer((req,res)=>{assert.ok(req.url.startsWith('/mapping-api/'));req.url=req.url.slice('/mapping-api'.length);app(req,res);});
 const apiOrigin='http://localhost:'+await listen(apiServer);
 browser=await chromium.launch({channel:'msedge',headless:true});
 const context=await browser.newContext();
 await context.route('**/*',route=>{const url=new URL(route.request().url());if(![pageOrigin,apiOrigin].includes(url.origin)){external.push(url.origin);return route.abort();}return route.continue();});
 const stale='z'.repeat(43),sibling='y'.repeat(43);
 await context.addCookies([
  {name:'izone_teacher_session',value:stale,domain:'localhost',path:'/mapping-api',httpOnly:true,secure:true,sameSite:'None'},
  {name:'izone_teacher_session',value:sibling,domain:'localhost',path:'/other-product',httpOnly:true,secure:true,sameSite:'None'},
 ]);
 const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));await page.goto(pageOrigin);
 const actual=await page.evaluate(async base=>{
  const login=await fetch(base+'/mapping-api/api/auth/session',{method:'POST',credentials:'include',headers:{'content-type':'application/json'},body:JSON.stringify({credential:'google-credential-for-isolated-cookie-fixture'})});
  await login.arrayBuffer();
  const restored=await fetch(base+'/mapping-api/api/auth/session',{credentials:'include'}),body=await restored.json();
  return{loginStatus:login.status,restoreStatus:restored.status,authenticated:body.ok===true&&!!body.reviewer,role:body.reviewer?.role,error:body.error};
 },apiOrigin);
 const cookies=await context.cookies(),native=cookies.filter(row=>row.domain==='localhost'&&row.name==='izone_teacher_session'&&row.path==='/mapping-api');
 result={...result,actual,nativeCookies:native.map(({name,path,secure,httpOnly,sameSite,partitionKey})=>({name,path,secure,httpOnly,sameSite,partitionKey})),
  staleCookieRemains:native.some(row=>row.value===stale),siblingPreserved:cookies.some(row=>row.name==='izone_teacher_session'&&row.path==='/other-product'&&row.value===sibling),externalAttempts:external.length,pageErrors:errors};
 await writeFile(join(output,'result.json'),JSON.stringify(result,null,2)+'\n');
 assert.equal(actual.loginStatus,201);
 assert.equal(actual.restoreStatus,200,'An expired unpartitioned cookie must not shadow the new valid partitioned session after Google login');
 assert.equal(actual.authenticated,true);assert.equal(result.staleCookieRemains,false);assert.equal(native.length,1);
 assert.ok(native[0].partitionKey);assert.equal(result.siblingPreserved,true);assert.deepEqual(external,[]);assert.deepEqual(errors,[]);
 result.outcome='success';await writeFile(join(output,'result.json'),JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify({event:'teacher_cookie_migration_browser',outcome:result.outcome,actual,staleCookieRemoved:true,siblingPreserved:true,externalAttempts:0,fixtureGoogle:true}));
}finally{
 await browser?.close();
 for(const server of servers){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
 await f.close();
}

import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
const code=fs.readFileSync(new URL('../teacher-sso.js',import.meta.url),'utf8'),origin='https://ducizone.ddns.net';
function setup(status=200){const calls=[];const box={URL,Headers,Request,Response,AbortSignal,location:{href:'https://tranhoangduc90.github.io/izone-ai-team-pages/task1-preview-20261025/teacher.html'},localStorage:{setItem(){}},addEventListener(){},fetch:async(url,options)=>{calls.push({url:String(url),options});return {ok:status===200,status,json:async()=>({ok:status===200})};}};box.window=box;vm.createContext(box);vm.runInContext(code,box);return {box,calls};}
test('Task 1 teacher restores its own shared identity before reading, student writes are untouched',async()=>{
 const {box,calls}=setup();await box.fetch(origin+'/task1-preview-api/api/v1/auth/session');assert.equal(calls.length,2);assert.ok(calls[0].url.endsWith('/restore/task1'));
 calls.length=0;await box.fetch(origin+'/task1-preview-api/api/v1/sessions',{method:'POST',body:'fixture-draft'});assert.equal(calls.length,1);assert.equal(calls[0].options.body,'fixture-draft');
});
test('Task 1 login goes to the registered broker with remember preference; logout is shared',async()=>{
 const {box,calls}=setup();await box.IzoneTeacherSso.login('task1','fixture-google',false);assert.ok(calls[0].url.endsWith('/login/task1'));assert.equal(calls[0].options.body,'{"credential":"fixture-google","remember":false}');assert.equal(calls[0].options.credentials,'include');
 await box.IzoneTeacherSso.logout();assert.ok(calls.at(-1).url.endsWith('/v1/logout'));
});
test('broker unavailable cannot become a restored teacher',async()=>{const {box}=setup(503);await assert.rejects(box.IzoneTeacherSso.restore('task1'));});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source=await readFile(new URL('../js/shops-entry-redirect.js',import.meta.url),'utf8');
const library=JSON.parse(await readFile(new URL('../library.json',import.meta.url),'utf8'));
function redirect(href){let target;const window={},location={href,pathname:new URL(href).pathname,replace:value=>{target=new URL(value);}};vm.runInNewContext(source,{URL,window,location});return {target,window};}
test('8 bài SW giữ bài/lớp/người/phiên/anchor khi chuyển link học viên và giảng viên',()=>{
 for(const lesson of library.handouts.filter(h=>h.taskNumber===2))for(const page of ['lesson.html','teacher.html']){
  const entry=new URL('https://example.invalid/izone-ai-team-pages/writing-handouts/'+page);entry.search=new URLSearchParams({task:lesson.slug,class:'CS.181026',student:'synthetic-person',session:'synthetic-session'});entry.hash='draft';
  const {target,window}=redirect(entry.href);assert.ok(target);assert.equal(target.pathname,'/izone-ai-team-pages/sw-task2-writing/'+(page==='teacher.html'?'teacher.html':'index.html'));assert.equal(target.search,entry.search);assert.equal(target.hash,entry.hash);assert.equal(window.__IZONE_SW_TASK2_REDIRECTING__,true);
 }
});
test('link Shops cũ không có task vẫn mở Shops; link Task 1 giữ tuyến hiện hành',()=>{
 const shops=redirect('https://example.invalid/izone-ai-team-pages/shops-writing/?class=CS.160826');assert.equal(shops.target.searchParams.get('task'),'writing-task2-public-health-ban');assert.equal(shops.target.searchParams.get('class'),'CS.160826');
 for(const lesson of library.handouts.filter(h=>h.taskNumber===1)){
  const {target,window}=redirect('https://example.invalid/izone-ai-team-pages/writing-handouts/teacher.html?task='+lesson.slug+'&class=CS.070626');assert.equal(target,undefined);assert.equal(window.__IZONE_SW_TASK2_REDIRECTING__,undefined);
 }
});

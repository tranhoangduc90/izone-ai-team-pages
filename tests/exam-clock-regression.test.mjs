import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const apps=['shared','k56-shared','k56-test2-shared','k56-mini-shared','substitute-k56-shared','substitute-k67-shared'];
const clockPath=new URL('../term-tests/shared/exam-clock.js',import.meta.url);
for(const app of apps)test(`${app}: changing Windows time cannot expire or extend the section`,()=>{
  const epoch=Date.parse('2026-10-26T12:00:00Z');let wall=epoch,mono=0;
  const DateFixture=class extends Date{static now(){return wall;}};
  const state={serverTimeOffsetMs:0,listeningDeadlineAt:new Date(epoch+60000).toISOString(),readingDeadlineAt:new Date(epoch+60000).toISOString()};
  const window={addEventListener(){},dispatchEvent(){}};
  const context=vm.createContext({window,document:{addEventListener(){}},Date:DateFixture,performance:{now:()=>mono},state,miniAnswerSheet:false,paperMini:false,console,AbortSignal,CustomEvent:class{},setTimeout,clearTimeout});
  if(fs.existsSync(clockPath))vm.runInContext(fs.readFileSync(clockPath,'utf8'),context);
  window.IZONE_EXAM_CLOCK?.sync(new Date(epoch).toISOString());
  const source=fs.readFileSync(new URL(`../term-tests/${app}/app.js`,import.meta.url),'utf8');
  const fn=source.match(/  function isSectionExpired\(skill\) \{[\s\S]*?\n  \}/)?.[0];
  assert.ok(fn,'real section guard must be exercised');
  vm.runInContext(fn+';globalThis.expired=isSectionExpired;',context);
  wall+=3600000;mono=10000;
  assert.equal(context.expired('listening'),false,'forward clock jump must not auto-submit early');
  assert.equal(context.expired('reading'),false);
  wall-=7200000;mono=61000;
  assert.equal(context.expired('listening'),true,'backward clock jump must not add exam time');
  assert.equal(context.expired('reading'),true);
});

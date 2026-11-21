import assert from 'node:assert/strict';
import test from 'node:test';
import { selectMiniJournalIngress } from '../term-tests/shared/exam-journal/bridge-mini-demo-journal-v1.mjs';

const demo='https://ducizone.ddns.net/mapping-api-demo/api/term-tests/mini-test-k56';
const main='https://ducizone.ddns.net/mapping-api-k56/api/term-tests/mini-test-k56';
const worker='https://izone-journal-prod-261116-k56-mini-cbt-demo-ingress.tranhoangduc90.workers.dev/k67/pilot/journal-events';
const student='https://izone-journal-prod-261116-k56-mini-ingress.tranhoangduc90.workers.dev/k67/pilot/journal-events';
const makeMeta=(content,code)=>({content,getAttribute:()=>code});
function choose(url,state,overrides={}) {
  const demoMeta=Object.hasOwn(overrides,'meta')?overrides.meta:makeMeta(worker,'CODEXDEMO56');
  return selectMiniJournalIngress({
    target:new URL(url),state,testSlug:overrides.slug??'mini-test-k56',
    path:['term-tests',overrides.page??'mini-test-k56-computer-based'],
    document:{querySelector:key=>key.includes('demo-')?demoMeta:makeMeta(student,null)}
  });
}
test('Mini K56 DEMO routes to its own worker only on the exact class and API',()=>{
  assert.equal(choose(demo,{classCode:'CODEXDEMO56'}),worker);
  assert.equal(choose(demo,{className:'codexdemo56'}),worker);
  for(const classCode of ['IC5601','','CODEXDEMO67'])assert.equal(choose(demo,{classCode}),null);
  for(const url of [main,demo.replace('ducizone.ddns.net','fixture.invalid'),demo+'x',demo.replace('https:','http:')])
    assert.equal(choose(url,{classCode:'CODEXDEMO56'}),null);
});
test('An absent or changed DEMO worker setting leaves log on its current route',()=>{
  for(const meta of [null,makeMeta(student,'CODEXDEMO56'),makeMeta(worker,null),makeMeta(worker+'?alternate=1','CODEXDEMO56')])
    assert.equal(choose(demo,{classCode:'CODEXDEMO56'},{meta}),null);
});
test('Mini CBT student routing is unchanged and no other route selects a Mini worker',()=>{
  assert.equal(choose(main,{classCode:'IC5601'}),student);
  assert.equal(choose(demo,{classCode:'CODEXDEMO56'},{slug:'term-test-1-k56'}),null);
  assert.equal(choose(demo,{classCode:'CODEXDEMO56'},{page:'mini-test-k56'}),null);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
const read = path => process.env.REGRESSION_BASE ? execFileSync('git',['show',process.env.REGRESSION_BASE+':'+path],{encoding:'utf8'}) : fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
const apps=['substitute-k56-shared','substitute-test-2-k56-shared','substitute-k67-shared'];
for(const app of apps) test(app+': không khôi phục bài khác học viên hoặc dữ liệu không có định danh',()=>{
 const source=read('term-tests/'+app+'/app.js');
 const start=source.indexOf('  function readSession()');
 const end=source.indexOf('\n  let localSaveStatus',start);
 const stored={studentRef:'fictional-other',drafts:{writing:{task2:'Fictional old essay'}},testGrades:{listening:{correct:0,total:40}}};
 const storage={getItem:()=>JSON.stringify(stored)};
 const context=vm.createContext({serverGradingMode:true,storageKey:'fixture',sessionStorage:storage,localStorage:storage,
  window:{TERM_TEST_BOOTSTRAP:{studentRef:'fictional-new',clientRunId:'new-run'},SUBSTITUTE_STATE:{accept:()=>false}},JSON});
 vm.runInContext(source.slice(start,end),context);
 assert.equal(JSON.stringify(vm.runInContext('readSession()',context)),'{}');
});
test('dashboard: đủ bốn số riêng khi xem tất cả',()=>{
 const html=read('term-tests/substitute-test-1-k56-dashboard/index.html');
 assert.deepEqual([...html.matchAll(/class="test-number"[^>]*>(\d+)</g)].map(m=>m[1]),['01','02','03','04']);
});

if(!process.env.REGRESSION_BASE)for(const app of apps)test(app+': chưa có grade không dựng điểm 0, nhưng giữ điểm 0 thật',()=>{
 const source=read('term-tests/'+app+'/app.js');const start=source.indexOf('  function pendingSection('),end=source.indexOf('  async function initialize()',start);
 const state={testGrades:{},drafts:{writing:{task1:'',task2:''}}};const context=vm.createContext({serverGradingMode:true,state,testConfig:{reading:{totalQuestions:40}},classCode:'DEMO',countWords:()=>0});
 vm.runInContext(source.slice(start,end),context);const pending=vm.runInContext("buildDemoPayload('complete')",context);assert.equal(pending.result.listening.correct,null);assert.equal(pending.result.reading.correct,null);
 state.testGrades={listening:{correct:0,total:40,typeStats:[],details:[]},reading:{correct:0,total:40,typeStats:[],details:[]}};const zero=vm.runInContext("buildDemoPayload('complete')",context);assert.equal(zero.result.listening.correct,0);assert.equal(zero.result.reading.correct,0);
});

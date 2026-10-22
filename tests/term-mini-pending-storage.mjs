// Chạy initializer/saveSession thật; giữ nguyên gói chưa rõ kết quả khi JSON hóa và tải lại.
// Kho lưu và người/lượt là giả trong bộ nhớ, không đọc hoặc ghi bài thật.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
function fixture(source,restored){
 const data=new Map(),storage={setItem:(k,v)=>data.set(k,v),getItem:k=>data.get(k)},store={};
 const init=source.indexOf('  const state = {'),initEnd=source.indexOf('\n  };',init)+5;
 const save=source.indexOf('  function saveSession()'),saveEnd=source.indexOf('\n  }',save)+4;
 assert.ok(init>=0&&initEnd>init&&save>=0&&saveEnd>save);
 const context=vm.createContext({window:{},document:{getElementById:()=>null},availableStorages:()=>[storage],restoredSession:restored});
 vm.runInContext(`const miniAnswerSheet=false,miniConfirmed=false,miniGeneration=0,paperMini=false,paperConfirmed=false,paperIdentity=null,storageKey='fixture',classCode='FIXTURE';${source.slice(init,initEnd)}\n${source.slice(save,saveEnd)}\nsaveSession();`,context);
 return JSON.parse(data.get('fixture'));
}
for(const module of ['shared','k56-shared','k56-test2-shared','k56-mini-shared'])test(module+': lưu và khôi phục nguyên gói nộp đang chờ',()=>{
 const source=fs.readFileSync('term-tests/'+module+'/app.js','utf8');
 const pending={listening:{owner:'fixture-scope',body:{clientSubmissionId:'44444444-4444-4444-8444-444444444444',answers:{1:'Bài cần giữ'},generation:0},answers:{1:'Bài cần giữ'}}};
 const saved=fixture(source,{pendingSubmissions:pending});
 assert.deepEqual(saved.pendingSubmissions,pending);
 assert.deepEqual(fixture(source,saved).pendingSubmissions,pending);
});

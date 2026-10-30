// Dữ liệu giả: trạng thái trình bày không được đi qua hai phiên Listening khác nhau.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';

const slugs=['substitute-test-1-k56','substitute-test-2-k56','substitute-test-1-k67','substitute-test-2-k67'];
for(const slug of slugs)for(const {sameSession,fresh}of [{sameSession:false,fresh:false},{sameSession:true,fresh:false},{sameSession:true,fresh:true}])test(`${slug}: ${fresh?'bắt đầu mới luôn ở Section1/Passage1':sameSession?'cùng phiên giữ vị trí đang làm':'phiên mới bỏ vị trí Section4/Passage2 của phiên cũ'}`,()=>{
  const file=`term-tests/${slug}-computer-based/enhance.js`;
  const source=process.env.REGRESSION_BASE?execFileSync('git',['show',process.env.REGRESSION_BASE+':'+file],{encoding:'utf8'}):fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');
  const start=source.indexOf('  function readUiState()'),end=source.indexOf('\n  function saveUiState()',start);
  assert.ok(start>=0&&end>start);
  const state={_substitute:{examSessionId:sameSession?'current-session':'previous-session'},activeSection:{listening:3,reading:1},fontSize:{listening:110,reading:120}};
  const store={getItem:()=>JSON.stringify(state)};
  const context=vm.createContext({serverGradingMode:true,uiStorageKey:'fixture',window:{TERM_TEST_BOOTSTRAP:{examSessionId:'current-session',startAtFirstSection:fresh},SUBSTITUTE_STATE:{storages:()=>[store],accept:()=>true}}});
  // Chủ bài/lượt/epoch đã đúng; đây là biên phiên audio riêng mà readUiState phải kiểm.
  vm.runInContext(source.slice(start,end)+'\nresult=readUiState();',context);
  assert.equal(context.result.activeSection.listening,sameSession&&!fresh?3:0);
  assert.equal(context.result.activeSection.reading,sameSession&&!fresh?1:0);
});

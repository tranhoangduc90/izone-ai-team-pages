import fs from 'node:fs';import vm from 'node:vm';import test from 'node:test';import assert from 'node:assert/strict';import {execFileSync} from 'node:child_process';
for(const slug of ['substitute-test-1-k56','substitute-test-2-k56','substitute-test-1-k67','substitute-test-2-k67']){
 test(`${slug}: hủy/lưu lỗi giữ audio, chỉ biên nhận nộp thành công mới dừng`,()=>{
  const file=`term-tests/${slug}-computer-based/enhance.js`;
  const source=process.env.REGRESSION_BASE?execFileSync('git',['show',process.env.REGRESSION_BASE+':'+file],{encoding:'utf8'}):fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');
  const blocks=[...source.matchAll(/    listeningForm.form.addEventListener\('(submit|term-test:listening-submitted)', \(\) => \{[\s\S]*?\r?\n    \}\);/g)];
  assert.equal(blocks.length,1);
  const form=new EventTarget(),audio={paused:false,pause(){this.paused=true;}},context=vm.createContext({listeningForm:{form},audio,allowPause:false,audioWatchdog:1,examStarted:true,rememberActualHeardPosition(){},window:{clearInterval(){}}});
  vm.runInContext(blocks[0][0],context);
  // Một submit bị hủy hoặc lỗi mạng không có sự kiện xác nhận lưu.
  form.dispatchEvent(new Event('submit',{cancelable:true}));
  assert.equal(audio.paused,false,'Chưa xác nhận lưu không được dừng audio');
  form.dispatchEvent(new Event('term-test:listening-submitted'));
  assert.equal(audio.paused,true);assert.equal(context.allowPause,true);
 });
}

import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const source = fs.readFileSync('term-tests/k56-audio-shared/app.js', 'utf8');
const settle = async () => { for (let i=0;i<15;i++) await Promise.resolve(); };
function fixture({failDownload=false}={}) {
  const nodes = new Map();
  function node(id) {
    if (!nodes.has(id)) nodes.set(id, {disabled:true, hidden:false, value:id==='audioVolume'?'1':0, currentTime:0, ended:false, open:false, events:{},
      addEventListener(type,fn){this.events[type]=fn;},
      async fire(type){return this.events[type]?.();},
      play(){this.plays=(this.plays||0)+1; return this.blocked?Promise.reject(Error('blocked')):Promise.resolve();},
      pause(){this.pauses=(this.pauses||0)+1;},
      showModal(){this.open=true;}, close(){this.open=false;this.events.close?.();}
    });
    return nodes.get(id);
  }
  let reads=0;
  const response={ok:true,body:{getReader(){return {async read(){if(failDownload)throw Error('network');return reads++?{done:true}:{done:false,value:new Uint8Array(4)};}};}},headers:{get(){return '4';}}};
  const c=vm.createContext({window:{K56_AUDIO_BACKUP_CONFIG:{title:'Audio giả',src:'fake.mp3'},addEventListener(){}},
    document:{getElementById:node,querySelector:node},location:{search:'?class=CODEXDEMO56'},
    URL:{createObjectURL(){return 'blob:fake';},revokeObjectURL(){}},URLSearchParams,AbortController,Blob,
    fetch:async()=>response,Number,String,Math});
  vm.runInContext(source,c);
  return {node};
}
test('tải đủ trước khi thử; xác nhận âm lượng mới mở nút phát', async()=>{
  const f=fixture();await settle();
  assert.equal(f.node('audioProgress').value,1);
  assert.equal(f.node('previewAudio').disabled,false);
  assert.equal(f.node('playAudio').disabled,true);
  await f.node('playAudio').fire('click');assert.equal(f.node('mainPlayer').plays,undefined);
  await f.node('previewAudio').fire('click');await settle();
  assert.equal(f.node('volumeModal').open,true);
  assert.equal(f.node('confirmVolume').disabled,false);
  f.node('audioVolume').value='.4';await f.node('audioVolume').fire('input');
  assert.equal(f.node('mainPlayer').volume,.4);
  f.node('previewPlayer').currentTime=30;await f.node('previewPlayer').fire('timeupdate');
  assert.match(f.node('previewStatus').textContent,/30 giây/);
  await f.node('confirmVolume').fire('click');assert.equal(f.node('playAudio').disabled,false);
  await f.node('playAudio').fire('click');
  assert.equal(f.node('.actions').hidden,true);
});
test('autoplay bị chặn có nút tiếp tục, không tua audio khi phát tiếp', async()=>{
  const f=fixture();await settle();
  await f.node('previewAudio').fire('click');await settle();await f.node('confirmVolume').fire('click');
  await f.node('playAudio').fire('click');
  f.node('mainPlayer').currentTime=123;f.node('mainPlayer').blocked=true;
  await f.node('mainPlayer').fire('pause');await settle();
  assert.equal(f.node('resumeAudio').hidden,false);
  f.node('mainPlayer').blocked=false;await f.node('resumeAudio').fire('click');
  assert.equal(f.node('mainPlayer').currentTime,123);
  assert.equal(f.node('resumeAudio').hidden,true);
});
test('lỗi tải không mở nút phát và có nút tải lại',async()=>{
  const f=fixture({failDownload:true});await settle();
  assert.equal(f.node('retryAudio').hidden,false);
  assert.equal(f.node('playAudio').disabled,true);
});
test('cả ba trang có popup xác nhận, cache mới, không khóa theo giờ',()=>{
  for(const slug of ['term-test-1-k56','term-test-2-k56','mini-test-k56']) {
    const html=fs.readFileSync('term-tests/'+slug+'-audio/index.html','utf8');
    for(const id of ['volumeModal','audioVolume','confirmVolume','resumeAudio','replayPreview'])assert.match(html,new RegExp('id="'+id+'"'));
    assert.match(html,/20260914-k56-audio-volume-v2/);
  }
  assert.doesNotMatch(source,/18:45|19:00|getHours|getMinutes/);
});

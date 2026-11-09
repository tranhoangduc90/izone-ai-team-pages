import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../listening-practice/app.js',import.meta.url),'utf8');
const section=(start,end)=>source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start)));

function harness(){
 let now=0,nextTimer=0;
 const timers=new Map(),events=new Map(),records=[],pauses=[];
 const attempt={id:'copy-ic2200',status:'running',phase:'listening',owner:'fixture-tab',answers:{1:'answer'},notes:'draft'};
 const audio={currentTime:15.482,paused:false,readyState:4,networkState:1,
  addEventListener:(name,fn)=>events.set(name,fn),pause:()=>{audio.paused=true;}};
 const context=vm.createContext({
  audio,current:()=>attempt,TAB:'fixture-tab',route:'exercise',observeListeningAudio:(...args)=>records.push(args),
  pause:reason=>{pauses.push(reason);attempt.status='paused';context.stopAudio();},
  setTimeout:(fn,delay)=>{timers.set(++nextTimer,{fn,at:now+delay});return nextTimer;},clearTimeout:id=>timers.delete(id),
 });
 vm.runInContext('let audioStarted=true,seekingAudio=false,playbackGeneration=1,audioFetchController=null;\n'
  +section(source.includes('const BUFFERING_GRACE_MS')?'const BUFFERING_GRACE_MS':'function stopAudio(', 'function consumeTime(')
  +section("audio.addEventListener('playing'", "audio.addEventListener('error'"),context);
 function advance(ms){
  const end=now+ms;
  for(const [id,t] of timers){
   if(t.at>end)continue;
   timers.delete(id);now=t.at;t.fn();
  }
  now=end;
 }
 return {audio,attempt,records,pauses,advance,stop:()=>context.stopAudio(),event:name=>events.get(name)()};
}

test('IC2200: waiting rồi playing sau 1 ms, bộ phát tiến và giữ nguyên lượt/nháp',()=>{
 const h=harness();
 h.event('waiting');
 h.advance(1);h.event('playing');
 h.audio.currentTime=16.22;h.advance(800);
 assert.deepEqual(h.pauses,[]);
 assert.equal(h.attempt.status,'running');
 assert.equal(h.attempt.id,'copy-ic2200');
 assert.deepEqual(h.attempt.answers,{1:'answer'});
 assert.equal(h.attempt.notes,'draft');
 assert.deepEqual(h.records.map(x=>x[0]),['waiting','playing']);
});

test('bộ phát đứng thật dù lại có playing hoặc waiting: chỉ tạm dừng một lần sau cửa sổ kiểm',()=>{
 const h=harness();
 h.audio.readyState=2;h.event('waiting');
 h.advance(1);h.event('playing');
 h.advance(499);h.event('waiting');
 assert.deepEqual(h.pauses,[]);
 h.advance(251);
 assert.deepEqual(h.pauses,['audio-buffering']);
 assert.equal(h.audio.currentTime,15.482);
 h.advance(900);assert.equal(h.pauses.length,1);
});

test('lần chờ mới sau khi audio đã tiến được tính từ vị trí mới',()=>{
 const h=harness();
 h.event('waiting');h.advance(500);
 h.audio.currentTime=15.8;h.event('waiting');h.advance(251);
 assert.deepEqual(h.pauses,[]);
 h.advance(500);assert.deepEqual(h.pauses,['audio-buffering']);
});

test('dừng hoặc đổi phiên hủy bộ hẹn cũ',()=>{
 const h=harness();
 h.event('waiting');h.advance(300);h.stop();h.advance(800);
 assert.deepEqual(h.pauses,[]);
});

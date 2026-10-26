import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

const source=await fs.readFile(new URL('../listening-practice/review-audio.js',import.meta.url),'utf8');
function fixture(){
  const timers=new Map();let next=0;
  const audio=new EventTarget();Object.assign(audio,{readyState:0,currentTime:27,paused:true,loads:0,plays:0,
    load(){this.loads++;},pause(){this.paused=true;},play(){this.plays++;this.paused=false;return Promise.resolve();}});
  const context={document:new EventTarget(),window:new EventTarget(),DOMException,
    setTimeout:fn=>{timers.set(++next,fn);return next;},clearTimeout:id=>timers.delete(id),
    clearInterval(){},cancelAnimationFrame(){}};
  const Player=vm.runInNewContext(source+'\nReviewAudio;',context);
  return{audio,timers,player:new Player(audio,()=>{})};
}
test('decoder preparation is silent and bounded when metadata never arrives',async()=>{
  const f=fixture(),pending=f.player.prime(new AbortController().signal);
  assert.equal(f.audio.loads,1);assert.equal(f.audio.plays,0);assert.equal(f.audio.currentTime,27);
  f.timers.values().next().value();
  await assert.rejects(pending,/AUDIO_READY_TIMEOUT/);assert.equal(f.timers.size,0);
});
test('cancelled metadata preparation cleans up and an already-ready decoder is reused',async()=>{
  const f=fixture(),controller=new AbortController(),pending=f.player.prime(controller.signal);
  controller.abort();await assert.rejects(pending,{name:'AbortError'});assert.equal(f.timers.size,0);
  f.audio.readyState=1;await f.player.prime(new AbortController().signal);
  assert.equal(f.audio.loads,1);assert.equal(f.audio.plays,0);assert.equal(f.player.state,'idle');
});

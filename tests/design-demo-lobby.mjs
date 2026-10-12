import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../term-tests/design-demo/real-lobby.js',import.meta.url),'utf8');
function harness({audioResult=async()=> 'blob:real-audio',play=async()=>{},mode='blank'}={}){
 const elements=new Map(),events={},timers=new Map(),navigated=[],trial={};let nextTimer=0,requests=0;
 const element=()=>({listeners:{},dataset:{},disabled:true,hidden:false,value:'1',textContent:'',classList:{add(){}},append(){},addEventListener(n,f){this.listeners[n]=f;},removeAttribute(n){delete this[n];},load(){},pause(){this.paused=true;},play,currentTime:0});
 const audio=element(),document={getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id);},body:element(),createElement:()=>audio};
 const context={window:{REAL_DEMO:{trial,mode,audio:()=>{requests++;return audioResult();},navigate:s=>navigated.push(s)},addEventListener(n,f){events[n]=f;}},document,clearTimeout:id=>timers.delete(id),setTimeout:(f,ms)=>{timers.set(++nextTimer,{f,ms});return nextTimer;}};
 vm.runInNewContext(source,context);
 return {elements,audio,trial,navigated,events,timers,get requests(){return requests;},click:id=>elements.get('lobby-'+id).listeners.click(),settle:()=>new Promise(r=>setImmediate(r))};
}
test('start waits for audio and a successful preview; volume and prepared audio follow navigation',async()=>{
 const h=harness();await h.settle();assert.equal(h.elements.get('lobby-start').disabled,true);
 await h.click('start');assert.deepEqual(h.navigated,[]);
 await h.click('preview');assert.equal(h.elements.get('lobby-start').disabled,false);
 h.elements.get('lobby-volume').value='0.4';h.elements.get('lobby-volume').listeners.input();
 await h.click('start');assert.deepEqual(h.navigated,['listening']);assert.equal(h.trial.audioVolume,0.4);assert.equal(h.trial.audioPrepared,true);assert.equal(h.audio.paused,true);
});
test('both playback time and wall clock cap the preview at 30 seconds',async()=>{
 const h=harness();await h.settle();await h.click('preview');assert.equal([...h.timers.values()][0].ms,30000);
 h.audio.currentTime=30;h.audio.listeners.timeupdate();assert.equal(h.audio.paused,true);assert.equal(h.timers.size,0);
 await h.click('preview');[...h.timers.values()][0].f();assert.equal(h.audio.paused,true);assert.equal(h.timers.size,0);
});
test('download failures can retry and rejected playback does not unlock start',async()=>{
 let fail=true;const h=harness({audioResult:async()=>{if(fail)throw Error('offline');return 'blob:real';},play:async()=>{throw Error('blocked');}});
 await h.settle();assert.equal(h.elements.get('lobby-retry').hidden,false);assert.equal(h.elements.get('lobby-preview').disabled,true);
 fail=false;await h.click('retry');assert.equal(h.elements.get('lobby-preview').disabled,false);
 await h.click('preview');assert.equal(h.elements.get('lobby-start').disabled,true);assert.match(h.elements.get('lobby-preview-status').textContent,/Chưa phát/);
});
test('leaving during download prevents late audio from reopening the lobby; saved mode only navigates',async()=>{
 let resolve;const h=harness({audioResult:()=>new Promise(r=>resolve=r)});h.events.pagehide();resolve('blob:late');await h.settle();assert.equal(h.audio.src,undefined);assert.equal(h.elements.get('lobby-start').disabled,true);
 const saved=harness({mode:'saved'});await saved.settle();await saved.click('preview');await saved.click('start');assert.deepEqual(saved.navigated,['listening']);assert.equal(saved.requests,1);
});

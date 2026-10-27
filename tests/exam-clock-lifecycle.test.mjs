import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
const source=fs.readFileSync(new URL('../term-tests/shared/exam-clock.js',import.meta.url),'utf8');
function fixture(){
 let wall=Date.parse('2026-10-26T12:00:00Z'),mono=0;
 const window=new EventTarget(),document=new EventTarget();document.visibilityState='visible';
 const context=vm.createContext({window,document,Date:class extends Date{static now(){return wall;}},performance:{now:()=>mono},CustomEvent:class extends Event{}});
 vm.runInContext(source,context);
 return {clock:window.IZONE_EXAM_CLOCK,window,document,advance(ms){mono+=ms;wall+=ms;},jump(ms){wall+=ms;}};
}
test('server epoch is authoritative; initial skew, timezone changes and later clock jumps do not alter elapsed time',()=>{
 const f=fixture();f.jump(-86400000);assert.equal(f.clock.sync('2026-10-26T12:00:00Z'),true);
 f.advance(15000);f.jump(172800000);assert.equal(f.clock.now(),Date.parse('2026-10-26T12:00:15Z'));
 assert.equal(f.clock.sync('2026-10-26 12:00:00'),false,'timezone-free timestamps must not become server samples');
 assert.equal(f.clock.now(),Date.parse('2026-10-26T12:00:15Z'));
});
test('wake invalidates the old sample, concurrent retries coalesce, failed reads never auto-submit from guessed time',async()=>{
 const f=fixture();let calls=0,fail=false,release;
 await f.clock.configure(async()=>{calls++;if(fail)throw Error('offline');if(release!==undefined)await new Promise(done=>release=done);return {serverNow:'2026-10-26T12:00:00Z'};});
 assert.equal(f.clock.ready,true);fail=true;f.document.dispatchEvent(new Event('resume'));await f.clock.resync();
 assert.equal(f.clock.ready,false);assert.ok(Number.isNaN(f.clock.now()));assert.equal(calls,2);
 fail=false;release=null;
 const retry=f.clock.resync(),same=f.clock.resync();assert.equal(calls,3);release();
 assert.equal(await retry,true);assert.equal(await same,true);assert.equal(f.clock.ready,true);assert.equal(calls,3);
});
test('a local demo uses monotonic elapsed time without contacting a server',()=>{
 const f=fixture(),before=f.clock.now();f.advance(60000);f.jump(-7200000);assert.equal(f.clock.now()-before,60000);
});
test('a delayed response cannot move the exam clock backwards and grant extra time',()=>{
 const f=fixture();f.clock.sync('2026-10-26T12:00:00Z');f.advance(20000);f.clock.sync('2026-10-26T12:00:10Z');
 assert.equal(f.clock.now(),Date.parse('2026-10-26T12:00:20Z'));
});

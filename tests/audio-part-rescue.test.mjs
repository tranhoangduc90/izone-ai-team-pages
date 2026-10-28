import test from 'node:test';
import assert from 'node:assert/strict';
import {createCipheriv,createHash} from 'node:crypto';
import {downloadAudio} from '../shared/audio/chunks.mjs';

// Dữ liệu giả độc lập: HTTP chỉ trả byte/mã lỗi; bộ tải thật phải chọn nguồn,
// giải mã, kiểm hash và ghép file. Không gọi mạng hoặc tạo phiên học viên.
const size=524288,plain=Buffer.alloc(size*7+123,37),rawKey=Buffer.alloc(32,19);
const hash=b=>createHash('sha256').update(b).digest('hex');
const context={product:'public-mp3-v1',classId:'public',testId:'fixture',owner:'public',sid:'fixture',generation:1,purpose:'audio.public',assetHash:hash(plain),downloadId:'fixture'};
const chunks=Array.from({length:Math.ceil(plain.length/size)},(_,i)=>{const b=plain.subarray(i*size,(i+1)*size);return {byteLength:b.length,sha256:hash(b)};});
const manifest={version:1,chunkSize:size,sha256:hash(plain),byteLength:plain.length,chunks,context,ticket:'fixture',primaryUrl:'https://izone-audio-delivery.tranhoangduc90.workers.dev/parts/fixture',fallbackUrl:'https://tranhoangduc90.github.io/izone-ai-team-pages/term-tests/fixture.mp3'};
function frame(index){
 const b=plain.subarray(index*size,(index+1)*size),iv=Buffer.alloc(12,index);
 const kc=JSON.stringify([1,context.product,context.classId,context.testId,context.owner,context.sid,context.generation,context.purpose,context.assetHash,context.downloadId]);
 const cipher=createCipheriv('aes-256-gcm',rawKey,iv);cipher.setAAD(Buffer.from(JSON.stringify([kc,size,index,index*size,b.length])));
 return Buffer.concat([Buffer.from('IZAP1'),iv,cipher.update(b),cipher.final(),cipher.getAuthTag()]);
}
function fixture(primary){
 const calls=[],events=[];let sourceFailures=0;
 const fetchImpl=async(url,init)=>{
  const text=String(url);assert.equal(init.credentials,'omit');
  if(text===manifest.fallbackUrl){
   assert.equal(init.headers.Authorization,undefined);const [,start,end]=/^bytes=(\d+)-(\d+)$/.exec(init.headers.Range);
   const index=Math.floor(+start/size);calls.push({source:'pages',index});return new Response(plain.subarray(+start,+end+1),{status:206});
  }
  const index=Number(new URL(text).pathname.split('/').at(-1));calls.push({source:'cloudflare',index});
  return primary(index,init,calls);
 };
 return {calls,events,options:{key:rawKey,fetchImpl,onEvent:e=>events.push(e),onPrimaryFailure:()=>sourceFailures++},failures:()=>sourceFailures};
}
async function verified(f,extra={}){const r=await downloadAudio(manifest,{...f.options,...extra});assert.equal(hash(Buffer.from(await r.blob.arrayBuffer())),manifest.sha256);return r;}

test('one broken part uses Pages for that part; later parts keep Cloudflare and no source breaker opens',async()=>{
 const f=fixture(async i=>i===0?new Response('temporary',{status:500}):new Response(frame(i)));
 await verified(f);
 assert.deepEqual(f.calls.filter(x=>x.source==='pages').map(x=>x.index),[0]);
 assert.ok(f.calls.some(x=>x.source==='cloudflare'&&x.index===7));assert.equal(f.failures(),0);
});

test('a stalled part is aborted and rescued once without another full timeout or abandoning healthy parts',async()=>{
 let aborted=0;
 const f=fixture(async(i,init)=>i===0?new Promise((resolve,reject)=>{
  init.signal.addEventListener('abort',()=>{aborted++;reject(init.signal.reason);},{once:true});
 }):new Response(frame(i)));
 await verified(f,{primaryTimeoutMs:30});
 assert.equal(aborted,1);assert.equal(f.calls.filter(x=>x.source==='cloudflare'&&x.index===0).length,1);
 assert.deepEqual(f.calls.filter(x=>x.source==='pages').map(x=>x.index),[0]);assert.equal(f.failures(),0);
});

test('several slow parts cannot open a source breaker while other Cloudflare parts are healthy',async()=>{
 const f=fixture(async(i,init)=>i<3?new Promise((resolve,reject)=>init.signal.addEventListener('abort',()=>reject(init.signal.reason),{once:true})):new Response(frame(i)));
 await verified(f,{concurrency:4,primaryTimeoutMs:30});assert.equal(f.failures(),0);
 assert.deepEqual(f.calls.filter(x=>x.source==='pages').map(x=>x.index).sort(),[0,1,2]);
});

test('four lanes reduce to two after a timeout while keeping subsequent parts on Cloudflare',async()=>{
 let stalled=true,active=0,peakAfterTimeout=0;
 const f=fixture(async(i,init)=>{
  if(i===0)return new Promise((resolve,reject)=>init.signal.addEventListener('abort',()=>{stalled=false;reject(init.signal.reason);},{once:true}));
  active++;if(!stalled)peakAfterTimeout=Math.max(peakAfterTimeout,active);
  await new Promise(resolve=>setTimeout(resolve,20));active--;return new Response(frame(i));
 });
 await verified(f,{concurrency:4,primaryTimeoutMs:30});
 assert.ok(peakAfterTimeout>0);assert.ok(peakAfterTimeout<=2);assert.equal(f.failures(),0);
 assert.deepEqual(f.calls.filter(x=>x.source==='pages').map(x=>x.index),[0]);
});

for(const concurrency of [2,4])test(`${concurrency} download lanes stay bounded and reconstruct the same verified audio`,async()=>{
 let active=0,peak=0;
 const f=fixture(async(i,init)=>{active++;peak=Math.max(peak,active);await new Promise(resolve=>setTimeout(resolve,10));active--;return new Response(frame(i));});
 await verified(f,{concurrency});assert.equal(peak,concurrency);assert.equal(active,0);assert.equal(f.calls.filter(x=>x.source==='pages').length,0);
});

for(const status of [401,403])test(`primary ${status} stops the transfer without a Pages bypass`,async()=>{
 const f=fixture(async()=>Response.json({code:'SCOPE_DENIED'},{status}));
 await assert.rejects(downloadAudio(manifest,{...f.options,concurrency:4}),e=>e.accessDenied===true);
 assert.equal(f.calls.filter(x=>x.source==='pages').length,0);
});

test('confirmed Worker quota stops repeated primary requests and uses verified Pages',async()=>{
 const f=fixture(async()=>new Response('Error 1027',{status:403}));await verified(f,{concurrency:4});
 assert.ok(f.calls.filter(x=>x.source==='cloudflare').length<=4);assert.equal(f.failures(),1);
});

test('a source-wide outage is bounded rather than repeating timeouts for every remaining part',async()=>{
 const f=fixture(async()=>new Response('unavailable',{status:503}));await verified(f);
 assert.ok(f.calls.filter(x=>x.source==='cloudflare').length<chunks.length*2);assert.equal(f.failures(),1);
});

test('abort in four active lanes stops network work and retains only parts verified before cancellation',async()=>{
 const controller=new AbortController(),parts=new Map();let active=0,aborts=0,progress=0;
 const f=fixture(async(i,init)=>{
  if(i===0)return new Response(frame(i));
  active++;return new Promise((resolve,reject)=>init.signal.addEventListener('abort',()=>{active--;aborts++;reject(init.signal.reason);},{once:true}));
 });
 const work=downloadAudio(manifest,{...f.options,parts,signal:controller.signal,concurrency:4,onProgress:()=>{progress++;controller.abort();}});
 await assert.rejects(work,e=>e.name==='AbortError');assert.equal(active,0);assert.equal(aborts,3);assert.equal(progress,1);
 assert.equal(parts.size,1);assert.equal(f.calls.filter(x=>x.source==='pages').length,0);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {createDecipheriv,hkdfSync,randomUUID,createHmac} from 'node:crypto';
import {ASSETS} from '../shared/audio/catalog.mjs';
import {WORKER_ORIGIN} from '../shared/audio/config.mjs';

const workerDir=process.env.AUDIO_WORKER_SOURCE;
if(!workerDir)throw Error('AUDIO_WORKER_SOURCE required: isolated backend release source');
const {default:worker}=await import(pathToFileURL(workerDir+'/worker.mjs'));
const env={AUDIO_ENABLED:'true',AUDIO_ORIGINS:'["https://tranhoangduc90.github.io"]',AUDIO_TICKET_SECRET:'isolated-test-signing-secret',AUDIO_KEY_SECRET:'isolated-test-key-secret'};
const origin=WORKER_ORIGIN,asset=ASSETS['mini-test-k56'];
const input=async(url,init={})=>worker.fetch(new Request(url,init),env);
const issue=async(a=asset,id=randomUUID())=>(await input(origin+'/access/'+a.id+'/'+id)).json();
const part=(a,t,index=0)=>input(origin+'/parts/'+a.id+'/524288/'+index,{headers:{Authorization:'Bearer '+t}});
function m(a=asset){return {...a,envelopeVersion:'MP3',cloudflare:{version:1,policy:'public-mp3-v1',chunkSize:524288}};}
async function transport(){return import('../shared/audio/transport.mjs?test='+randomUUID());}
const sha=async b=>Buffer.from(await crypto.subtle.digest('SHA-256',b)).toString('hex');

test('Worker public policy, CORS, flags, methods and exact 512 KiB ranges',async()=>{
 const grant=await issue();let reads=0;
 env.AUDIO={get:async(key,{range})=>{reads++;assert.equal(key,asset.key);assert.deepEqual(range,{offset:0,length:524288});return{size:asset.byteLength,arrayBuffer:async()=>Buffer.alloc(524288,31)};}};
 const r=await part(asset,grant.ticket);assert.equal(r.status,200);assert.equal((await r.arrayBuffer()).byteLength,524288+33);assert.equal(reads,1);
 assert.equal((await input(origin+'/parts/'+asset.id+'/1048576/0',{headers:{Authorization:'Bearer '+grant.ticket}})).status,404);
 assert.equal((await part(asset,grant.ticket,999)).status,416);
 assert.equal((await input(origin+'/access/'+asset.id+'/'+randomUUID(),{headers:{Origin:'https://evil.invalid'}})).status,403);
 assert.equal((await input(origin+'/parts/'+asset.id+'/524288/0',{method:'OPTIONS',headers:{Origin:'https://tranhoangduc90.github.io'}})).status,204);
 assert.equal((await input(origin+'/access/'+asset.id+'/'+randomUUID(),{method:'POST'})).status,405);
 assert.equal((await worker.fetch(new Request(origin+'/access/'+asset.id+'/'+randomUUID()),{...env,AUDIO_ENABLED:'false'})).status,503);
 assert.equal((await worker.fetch(new Request(origin+'/access/'+asset.id+'/'+randomUUID()),{...env,STAGE_DEADLINE:'1'})).status,503);
});

test('Independent Node HKDF/AES-GCM decrypts frame; wrong download, AAD, key and corruption reject',async()=>{
 const grant=await issue(),plain=Buffer.alloc(524288,19);
 env.AUDIO={get:async()=>({size:asset.byteLength,arrayBuffer:async()=>plain})};
 const frame=Buffer.from(await(await part(asset,grant.ticket)).arrayBuffer());
 assert.equal(frame.subarray(0,5).toString(),'IZAP1');
 const c=grant.context,kc=JSON.stringify([1,c.product,c.classId,c.testId,c.owner,c.sid,c.generation,c.purpose,c.assetHash,c.downloadId]);
 const key=Buffer.from(hkdfSync('sha256',env.AUDIO_KEY_SECRET,c.sid,'izone-audio-parts-v1:'+kc,32));
 assert.deepEqual(key,Buffer.from(grant.key,'base64url'));
 const aad=Buffer.from(JSON.stringify([kc,524288,0,0,524288]));
 function decrypt(k=key,a=aad,b=frame){const d=createDecipheriv('aes-256-gcm',k,b.subarray(5,17));d.setAAD(a);d.setAuthTag(b.subarray(-16));return Buffer.concat([d.update(b.subarray(17,-16)),d.final()]);}
 assert.deepEqual(decrypt(),plain);
 assert.throws(()=>decrypt(Buffer.alloc(32)));assert.throws(()=>decrypt(key,Buffer.from('wrong AAD')));
 const corrupt=Buffer.from(frame);corrupt[30]^=1;assert.throws(()=>decrypt(key,aad,corrupt));
 const second=await issue();assert.notEqual(grant.key,second.key);
 const frame2=Buffer.from(await(await part(asset,grant.ticket)).arrayBuffer());assert.notDeepEqual(frame.subarray(5,17),frame2.subarray(5,17));
});

test('Signed scope tampering, expiration, wrong asset/owner/purpose fail before R2',async()=>{
 let reads=0;env.AUDIO={get:async()=>{reads++;throw Error('must not read');}};
 const grant=await issue(),raw=JSON.parse(Buffer.from(grant.ticket.split('.')[0],'base64url').toString());
 const sign=c=>{const b=Buffer.from(JSON.stringify(c));return b.toString('base64url')+'.'+createHmac('sha256',env.AUDIO_TICKET_SECRET).update(b).digest('base64url');};
 for(const patch of [{exp:1},{owner:'someone'},{purpose:'audio.review'},{generation:2},{testId:'term-test-1'},{assetHash:'0'.repeat(64)},{sid:randomUUID()}]){
  assert.ok([401,403].includes((await part(asset,sign({...raw,...patch}))).status));
 }
 assert.equal((await part(ASSETS['term-test-1'],grant.ticket)).status,403);
 const token=grant.ticket.slice(0,-8)+'AAAAAAAA';assert.equal((await part(asset,token)).status,401);assert.equal(reads,0);
});

test('Public transport denies unknown manifests and native-source authorization failures without Pages',async()=>{
 const t=await transport();let calls=0;
 for(const value of [{...m(),sha256:'0'.repeat(64)},{...m(),url:'https://evil.invalid/a.mp3'},{...m(),byteLength:1}]){
  await assert.rejects(t.downloadPreferred(value,{fetchImpl:async()=>{calls++;}}),/CATALOG/);
 }
 assert.equal(calls,0);
 for(const status of [401,403]){
  const x=await transport();const urls=[];
  await assert.rejects(x.downloadPreferred(m(),{fetchImpl:async url=>{urls.push(String(url));return Response.json({code:'SCOPE_DENIED'},{status});}}),/ACCESS_DENIED/);
  assert.equal(urls.length,1);assert.ok(urls[0].startsWith(origin));
 }
});

test('Blocked IndexedDB waits once, then uses RAM; a technical source failure opens a ten-minute breaker',async()=>{
 const oldDb=globalThis.indexedDB,oldNow=Date.now;let opens=0,now=oldNow(),accesses=0;
 globalThis.indexedDB={open:()=>{opens++;return {};}};
 Date.now=()=>now;
 try{
  const bytes=await readFile(process.env.AUDIO_PUBLIC_FIXTURE),x=await transport();
  const fetchImpl=async(url,init)=>{
   if(String(url).startsWith(origin)){accesses++;return new Response('temporary unavailable',{status:503});}
   assert.equal(String(url),asset.url);const [,a,b]=/^bytes=(\d+)-(\d+)$/.exec(init.headers.Range);
   return new Response(bytes.subarray(+a,+b+1),{status:206});
  };
  assert.equal((await x.downloadPreferred(m(),{fetchImpl})).size,asset.byteLength);assert.equal(opens,1);assert.equal(accesses,1);
  await x.downloadPreferred(m(),{fetchImpl,parts:new Map()});assert.equal(accesses,1,'breaker avoids an access request for a fresh uncached download');
  now+=600001;await x.downloadPreferred(m(),{fetchImpl,parts:new Map()});assert.equal(accesses,2,'source is probed after ten minutes');
 }finally{globalThis.indexedDB=oldDb;Date.now=oldNow;}
});

test('Full primary, partial fallback, 1027/429, truncated 200, bad AES and cache/abort boundaries',async t=>{
 const file=process.env.AUDIO_PUBLIC_FIXTURE;
 if(!file)throw Error('AUDIO_PUBLIC_FIXTURE required: local verified public MP3');
 const bytes=await readFile(file);assert.equal(await sha(bytes),asset.sha256);
 env.AUDIO={get:async(_key,{range})=>({size:asset.byteLength,arrayBuffer:async()=>bytes.subarray(range.offset,range.offset+range.length)})};
 for(const mode of ['primary','partial','quota1027','quota429','truncated','tampered','whole200','parts403','abort'])await t.test(mode,async()=>{
  const x=await transport(),calls=[],controller=new AbortController();let count=0;
  if(mode==='abort')controller.abort();
  const fetchImpl=async(url,init)=>{
   url=String(url);calls.push(url);assert.equal(init.credentials,'omit');assert.equal(init.headers?.Cookie,undefined);
   if(url.startsWith(origin)){
    if(url.includes('/parts/')){
     count++;
     if(mode==='parts403')return Response.json({code:'SCOPE_DENIED'},{status:403});
     if(mode==='partial'&&Number(url.split('/').at(-1))>=2)return new Response('cpu',{status:500});
     if(mode==='quota1027')return new Response('<h1>Error 1027</h1>',{status:403});
     if(mode==='quota429'||mode==='whole200')return new Response('quota',{status:429});
     if(mode==='truncated')return new Response('short');
     const response=await input(url,init);
     if(mode==='tampered'){const b=new Uint8Array(await response.arrayBuffer());b[30]^=1;return new Response(b);}
     return response;
    }
    return input(url,init);
   }
   assert.equal(url,asset.url);assert.equal(init.headers.Authorization,undefined);
   if(mode==='whole200')return new Response(bytes);
   const [,start,end]=/^bytes=(\d+)-(\d+)$/.exec(init.headers.Range);return new Response(bytes.subarray(+start,+end+1),{status:206});
  };
  if(mode==='parts403'||mode==='abort'){
   await assert.rejects(x.downloadPreferred(m(),{fetchImpl,signal:controller.signal}));assert.equal(calls.filter(u=>u===asset.url).length,0);if(mode==='abort')assert.equal(calls.length,0);return;
  }
  const progress=[],blob=await x.downloadPreferred(m(),{fetchImpl,onProgress:p=>progress.push(p)});
  assert.equal(await sha(await blob.arrayBuffer()),asset.sha256);assert.equal(progress.at(-1).loaded,asset.byteLength);
  assert.ok(progress.every((p,i)=>!i||p.loaded>=progress[i-1].loaded));
  if(mode==='primary')assert.equal(calls.filter(u=>u===asset.url).length,0);else assert.ok(calls.includes(asset.url));
  const before=calls.length;assert.equal((await x.downloadPreferred(m(),{fetchImpl})).size,asset.byteLength);assert.equal(calls.length,before,'verified public cache makes no new network request');
 });
});

test('rescuing one part does not disable Cloudflare for the next uncached transfer',async()=>{
 const bytes=await readFile(process.env.AUDIO_PUBLIC_FIXTURE);assert.equal(await sha(bytes),asset.sha256);
 env.AUDIO={get:async(_key,{range})=>({size:asset.byteLength,arrayBuffer:async()=>bytes.subarray(range.offset,range.offset+range.length)})};
 const x=await transport();let accesses=0;const rescued=[];
 const fetchImpl=async(url,init)=>{
  url=String(url);
  if(url.startsWith(origin)){
   if(url.includes('/access/'))accesses++;
   if(url.endsWith('/524288/0'))return new Response('isolated part failure',{status:500});
   return input(url,init);
  }
  assert.equal(url,asset.url);const [,start,end]=/^bytes=(\d+)-(\d+)$/.exec(init.headers.Range);rescued.push(+start);
  return new Response(bytes.subarray(+start,+end+1),{status:206});
 };
 for(let run=0;run<2;run++)assert.equal((await x.downloadPreferred(m(),{parts:new Map(),fetchImpl})).size,asset.byteLength);
 assert.equal(accesses,2,'each fresh transfer still starts with Cloudflare');assert.deepEqual(rescued,[0,0]);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {randomUUID,createHash} from 'node:crypto';
import {ASSETS} from '../shared/audio/catalog.mjs';
import {WORKER_ORIGIN} from '../shared/audio/config.mjs';
const asset=ASSETS[process.env.LISTENING_AUDIO_ASSET||'homework-listening-02-scandinavian'];
const bytes=await readFile(new URL('../listening-homework/audio-assets/'+asset.url.split('/').at(-1),import.meta.url));
assert.equal(createHash('sha256').update(bytes).digest('hex'),asset.sha256);
const {default:worker}=await import(pathToFileURL(process.env.AUDIO_WORKER_SOURCE+'/worker.mjs'));
const env={AUDIO_ENABLED:'true',AUDIO_ORIGINS:'["https://tranhoangduc90.github.io"]',AUDIO_TICKET_SECRET:'fixture-listening-ticket-secret',AUDIO_KEY_SECRET:'fixture-listening-key-secret',AUDIO:{get:async(key,{range})=>{assert.equal(key,asset.key);return {size:bytes.length,arrayBuffer:async()=>bytes.subarray(range.offset,range.offset+range.length)};}}};
const manifest={...asset,envelopeVersion:'MP3',cloudflare:{version:1,policy:'public-mp3-v1'}};
const fresh=()=>import('../shared/audio/transport.mjs?lesson2='+randomUUID());
for(const mode of ['primary','partial','1027','429','truncated','corrupt','denied','cache'])test('Lesson 2 complete MP3: '+mode,async()=>{
 const transport=await fresh(),events=[];let primary=0,fallback=0,access=0;
 const fetchImpl=async(url,init)=>{url=String(url);assert.equal(init.credentials,'omit');assert.equal(init.headers?.Cookie,undefined);
  if(url.startsWith(WORKER_ORIGIN)){
   if(url.includes('/access/')){access++;if(mode==='denied')return Response.json({code:'SCOPE_DENIED'},{status:403});return worker.fetch(new Request(url,init),env);}
   primary++;
   if(mode==='partial'&&primary>2)return new Response('temporary failure',{status:503});
   if(mode==='1027')return new Response('Error code: 1027',{status:403});
   if(mode==='429')return new Response('quota',{status:429});
   if(mode==='truncated')return new Response(new Uint8Array(30));
   const response=await worker.fetch(new Request(url,init),env);
   if(mode==='corrupt'){const b=new Uint8Array(await response.arrayBuffer());b[25]^=1;return new Response(b);}
   return response;
  }
  assert.equal(url,asset.url);fallback++;const [,start,end]=/^bytes=(\d+)-(\d+)$/.exec(init.headers.Range);return new Response(bytes.subarray(+start,+end+1),{status:206});
 };
 const work=transport.downloadPreferred(manifest,{fetchImpl,onEvent:e=>events.push(e)});
 if(mode==='denied'){await assert.rejects(work,e=>e.accessDenied===true);assert.equal(primary,0);assert.equal(fallback,0);return;}
 const blob=await work;assert.equal(blob.size,bytes.length);assert.equal(createHash('sha256').update(new Uint8Array(await blob.arrayBuffer())).digest('hex'),asset.sha256);
 if(['partial','1027','429','truncated','corrupt'].includes(mode))assert.ok(fallback>0);else assert.equal(fallback,0);
 if(mode==='cache'){const oldPrimary=primary,oldAccess=access;assert.strictEqual(await transport.downloadPreferred(manifest,{fetchImpl}),blob);assert.equal(primary,oldPrimary);assert.equal(access,oldAccess);}
});
for(const skew of [-86400000,86400000])test('Lesson 2 valid server ticket with Windows clock offset '+skew,async()=>{
 const {downloadPreferred}=await fresh(),now=Date.now(),clock=Date.now;let fallback=0;
 Date.now=()=>now+skew;
 try{const blob=await downloadPreferred(manifest,{parts:new Map(),fetchImpl:async(url,init)=>{url=String(url);if(url.includes('/access/')){const id=url.split('/').at(-1);return Response.json({version:1,policy:'public-mp3-v1',expiresAt:now+600000,ticket:'fixture-ticket',key:'A'.repeat(43),context:{product:'public-mp3-v1',classId:'public',testId:asset.id,owner:'public',sid:id,generation:1,purpose:'audio.public',assetHash:asset.sha256,downloadId:id}});}if(url.includes('/parts/'))return new Response('temporary failure',{status:503});fallback++;const [,start,end]=/^bytes=(\d+)-(\d+)$/.exec(init.headers.Range);return new Response(bytes.subarray(+start,+end+1),{status:206});}});assert.equal(blob.size,bytes.length);assert.ok(fallback>0);}finally{Date.now=clock;}
});

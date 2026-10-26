import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {ASSETS} from '../shared/audio/catalog.mjs';

// Real verified MP3 bytes and transport. A source failure is injected only at
// the network boundary; native authorization remains the caller's obligation.
const asset=ASSETS['mini-test-k56'];
const bytes=await readFile(new URL('../term-tests/k56-audio-assets/mini-test-k56-93a3901c37fb37a8.mp3',import.meta.url));
const manifest={...asset,envelopeVersion:'MP3',cloudflare:{version:1,policy:'public-mp3-v1'}};
async function fixture(){
  const transport=await import('../shared/audio/transport.mjs?replay-test='+randomUUID());
  let requests=0;
  const fetchImpl=async(url,options)=>{
    requests++;
    if(String(url).includes('.workers.dev'))return new Response('fixture unavailable',{status:503});
    assert.equal(String(url),asset.url);
    const [,start,end]=/^bytes=(\d+)-(\d+)$/.exec(options.headers.Range);
    return new Response(bytes.subarray(+start,+end+1),{status:206});
  };
  return{transport,fetchImpl,requests:()=>requests};
}
test('replay uses the exact complete verified Blob already loaded for the exam',async()=>{
  const f=await fixture(),first=await f.transport.downloadPreferred(manifest,{fetchImpl:f.fetchImpl}),before=f.requests(),events=[],progress=[];
  const second=await f.transport.downloadPreferred(manifest,{fetchImpl:f.fetchImpl,onEvent:e=>events.push(e),onProgress:p=>progress.push(p)});
  assert.strictEqual(second,first,'A warm review should not reconstruct and hash the complete MP3 again');
  assert.equal(f.requests(),before);assert.ok(events.some(e=>e.source==='cache'&&e.wireBytes===0));
  assert.equal(progress.at(-1).complete,true);assert.equal(progress.at(-1).loaded,bytes.length);
});
test('complete-file reuse still checks catalog, envelope and cancellation',async()=>{
  const f=await fixture();await f.transport.downloadPreferred(manifest,{fetchImpl:f.fetchImpl});const before=f.requests();
  for(const change of [{sha256:'f'.repeat(64)},{url:'https://other.invalid/audio.mp3'},{envelopeVersion:'IZTT1'}])
    await assert.rejects(f.transport.downloadPreferred({...manifest,...change},{fetchImpl:f.fetchImpl}),/AUDIO_CATALOG_MISMATCH/);
  const controller=new AbortController();controller.abort();
  await assert.rejects(f.transport.downloadPreferred(manifest,{fetchImpl:f.fetchImpl,signal:controller.signal}),{name:'AbortError'});
  assert.equal(f.requests(),before);
});
test('caller-owned parts collection is populated even when the complete file is warm',async()=>{
  const f=await fixture();await f.transport.downloadPreferred(manifest,{fetchImpl:f.fetchImpl});
  const parts=new Map(),blob=await f.transport.downloadPreferred(manifest,{fetchImpl:f.fetchImpl,parts});
  assert.equal(parts.size,asset.chunks.length);assert.equal(blob.size,asset.byteLength);
});
test('an expired complete file is verified and reconstructed again instead of retained indefinitely',async()=>{
  const f=await fixture(),first=await f.transport.downloadPreferred(manifest,{fetchImpl:f.fetchImpl}),before=f.requests();
  const original=Date.now,now=original();
  try{Date.now=()=>now+86400001;
    assert.notStrictEqual(await f.transport.downloadPreferred(manifest,{fetchImpl:f.fetchImpl}),first);
    assert.ok(f.requests()>before);
  }finally{Date.now=original;}
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {ASSETS} from '../shared/audio/catalog.mjs';
import {downloadDirect,validateDirectGrant} from '../shared/audio/direct.mjs';
const a=ASSETS['homework-listening-origami'];
const bytes=new Uint8Array(await readFile(new URL('../listening-homework/audio-assets/'+new URL(a.url).pathname.split('/').at(-1),import.meta.url)));
const manifest={...a,envelopeVersion:'MP3'};
const grant={version:1,policy:'r2-direct-v1',method:'GET',url:'https://e340869dcc6ff285504947407d148104.r2.cloudflarestorage.com/izone-audio-r2-lab-20261023/'+a.key+'?fixture=1',sha256:a.sha256,byteLength:a.byteLength,validForSeconds:600,fallback:'public-pages'};
function cache(){const map=new Map();return {map,get:async(_,i)=>map.get(i),put:async(_,i,b)=>{map.set(i,b);return true;}};}
function response(offset=0,status=offset?206:200){return new Response(bytes.slice(offset),{status,headers:offset?{'Content-Range':`bytes ${offset}-${bytes.length-1}/${bytes.length}`}:{}});}
const renew=async()=>({manifest,download:grant});
test('one R2 GET verifies all bytes without native headers',async()=>{let calls=0;const b=await downloadDirect(manifest,grant,{cache:cache(),fetchImpl:async(u,o)=>{calls++;assert.equal(o.credentials,'omit');assert.equal(o.headers.Authorization,undefined);assert.equal(o.headers.Range,undefined);return response();}});assert.equal(b.size,a.byteLength);assert.equal(calls,1);});
test('network disconnect keeps verified prefix and resumes by Range',async()=>{let calls=0,range;const c=cache();const b=await downloadDirect(manifest,grant,{cache:c,refresh:renew,fetchImpl:async(u,o)=>{if(calls++===0){let n=0;return new Response(new ReadableStream({pull(x){if(n++===0)x.enqueue(bytes.slice(0,600000));else x.error(Error('network disconnect'));}},{highWaterMark:0}));}range=o.headers.Range;return response(524288);}});assert.equal(b.size,a.byteLength);assert.equal(range,'bytes=524288-');assert.equal(calls,2);});
test('reload reuses verified prefix; corrupt cached next block does not pass',async()=>{const c=cache();c.map.set(0,bytes.slice(0,524288));c.map.set(1,new Uint8Array(524288));let range;await downloadDirect(manifest,grant,{cache:c,fetchImpl:async(u,o)=>{range=o.headers.Range;return response(524288);}});assert.equal(range,'bytes=524288-');});
test('expired source renews once through native route',async()=>{let n=0,r=0;await downloadDirect(manifest,grant,{cache:cache(),refresh:async()=>{r++;return renew();},fetchImpl:async()=>n++===0?new Response(null,{status:403}):response()});assert.equal(r,1);assert.equal(n,2);});
test('native denied renewal stops before retry or Pages',async()=>{let n=0;await assert.rejects(downloadDirect(manifest,grant,{cache:cache(),refresh:async()=>{throw Object.assign(Error('NATIVE_DENIED'),{status:403});},fetchImpl:async()=>{n++;return new Response(null,{status:403});}}),e=>e.accessDenied&&e.message==='NATIVE_DENIED');assert.equal(n,1);});
test('source failure falls back to exact Pages URL after bounded renewal',async()=>{let n=0;const urls=[];await downloadDirect(manifest,grant,{cache:cache(),refresh:renew,fetchImpl:async(u)=>{urls.push(u);return n++<2?new Response(null,{status:503}):response();}});assert.deepEqual(urls,[grant.url,grant.url,a.url]);});
test('Mini K67 tries R2 first and only falls back to identical pinned Pages bytes when renewal is unavailable', async () => {
  const mini = ASSETS['mini-test-lesson-5'];
  const pinned = { ...mini, envelopeVersion: 'MP3' };
  const signed = { ...grant, url: grant.url.replace(a.key, mini.key), sha256: mini.sha256, byteLength: mini.byteLength };
  const mp3 = await readFile(new URL('../term-tests/k67-audio-assets/'+new URL(mini.url).pathname.split('/').at(-1), import.meta.url));
  const fetched = [];
  const blob = await downloadDirect(pinned, signed, {
    termSlug: mini.id, cache: cache(),
    refresh: async () => { throw Object.assign(new Error('temporary outage'), { audioRefreshUnavailable: true }); },
    fetchImpl: async url => {
      fetched.push(url);
      return url === signed.url ? new Response(null, { status: 403 }) : new Response(mp3);
    }
  });
  assert.deepEqual(fetched, [signed.url, mini.url]);
  assert.equal(blob.size, mini.byteLength);
  await assert.rejects(downloadDirect(pinned, signed, { termSlug: 'mini-test-k56' }), /AUDIO_MANIFEST_DENIED/);
});
test('persistent source/CORS failure has at most three requests',async()=>{let n=0;await assert.rejects(downloadDirect(manifest,grant,{cache:cache(),refresh:renew,fetchImpl:async()=>{n++;throw new TypeError('Failed to fetch');}}));assert.equal(n,3);});
test('idle timeout is separate from whole-download timeout',async()=>{let n=0;const b=await downloadDirect(manifest,grant,{cache:cache(),idleTimeoutMs:10,totalTimeoutMs:1000,refresh:renew,fetchImpl:async(u,o)=>{if(n++===0)return new Promise((_,reject)=>o.signal.addEventListener('abort',()=>reject(new DOMException('timeout','AbortError')),{once:true}));return response();}});assert.equal(b.size,a.byteLength);assert.equal(n,2);});
test('cancel after verified part retains cache but never returns playback bytes',async()=>{const c=cache(),abort=new AbortController();await assert.rejects(downloadDirect(manifest,grant,{cache:c,signal:abort.signal,onVerifiedPart:()=>abort.abort(),fetchImpl:async()=>response()}),{name:'AbortError'});assert.ok(c.map.has(0));});
test('range mismatch is fatal and cannot silently switch files',async()=>{const c=cache();c.map.set(0,bytes.slice(0,524288));let n=0;await assert.rejects(downloadDirect(manifest,grant,{cache:c,fetchImpl:async()=>{n++;return new Response(bytes.slice(524288),{status:206,headers:{'Content-Range':`bytes 0-${bytes.length-1}/${bytes.length}`}});}}),/AUDIO_RANGE_DENIED/);assert.equal(n,1);});
test('200 on resume restarts complete verification without duplicate prefix',async()=>{const c=cache();c.map.set(0,bytes.slice(0,524288));const b=await downloadDirect(manifest,grant,{cache:c,fetchImpl:async()=>response()});assert.equal(b.size,a.byteLength);});
test('hash-corrupt source is never played and public fallback is verified',async()=>{let n=0;const b=await downloadDirect(manifest,grant,{cache:cache(),refresh:renew,fetchImpl:async()=>n++===0?new Response(new Uint8Array(bytes.length)):response()});assert.equal(b.size,a.byteLength);assert.equal(n,2);});
test('invalid descriptor origin, object, hash and scope are rejected',()=>{for(const patch of [{url:'https://evil.example/audio.mp3'},{url:grant.url.replace(a.sha256,'0'.repeat(64))},{sha256:'0'.repeat(64)},{validForSeconds:999999},{policy:'anything'}])assert.throws(()=>validateDirectGrant(manifest,{...grant,...patch}),/AUDIO_GRANT_DENIED/);});
for(const offset of [-86400000,86400000])test('client clock offset '+offset+' cannot reject a valid grant',async()=>{const original=Date.now;try{Date.now=()=>original()+offset;assert.equal((await downloadDirect(manifest,grant,{cache:cache(),fetchImpl:async()=>response()})).size,a.byteLength);}finally{Date.now=original;}});

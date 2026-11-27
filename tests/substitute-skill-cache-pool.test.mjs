import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {cacheVerifiedAssets} from '../term-tests/substitute-skill-shared/offline-asset-pool-20261127-v1.mjs';
const bytes='verified fixture',sha=createHash('sha256').update(bytes).digest('hex');
const assets=Array.from({length:12},(_,i)=>({path:'asset-'+i+'.js',sha256:sha}));
const base='https://fixture.invalid/test/';
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function store(){const rows=new Map();let puts=0;return {rows,get puts(){return puts;},async match(url){return rows.get(url.href)?.clone();},async put(url,response){puts++;rows.set(url.href,response.clone());}};}
test('cold cache tải tối đa bốn tệp song song, warm cache không tải/ghi lại',async()=>{
  const cache=store();let active=0,max=0,calls=0;
  const fetchAsset=async()=>{calls++;active++;max=Math.max(max,active);await pause(5);active--;return new Response(bytes);};
  const first=await cacheVerifiedAssets({cache,assets,base,fetchAsset});
  assert.deepEqual(first,{assets:12,hits:0,writes:12});assert.equal(max,4);
  assert.deepEqual(await cacheVerifiedAssets({cache,assets,base,fetchAsset}),{assets:12,hits:12,writes:0});
  assert.equal(calls,12);assert.equal(cache.puts,12);
});
test('cache sai hash được thay bằng đúng tệp; tệp mạng sai hash không được lưu',async()=>{
  const cache=store();cache.rows.set(new URL(assets[0].path,base).href,new Response('corrupt'));
  await cacheVerifiedAssets({cache,assets:[assets[0]],base,fetchAsset:async()=>new Response(bytes)});
  assert.equal(await (await cache.match(new URL(assets[0].path,base))).text(),bytes);
  await assert.rejects(cacheVerifiedAssets({cache,assets:[assets[1]],base,fetchAsset:async()=>new Response('wrong')}),e=>e.code==='CACHE_CONTENT_MISMATCH');
  assert.equal(cache.puts,1);
});
test('phản hồi về sau khi hủy không được ghi cache hoặc báo hoàn thành',async()=>{
  const cache=store(),controller=new AbortController();let progress=0,started,finish,calls=0;
  const entered=new Promise(resolve=>started=resolve),reply=new Promise(resolve=>finish=resolve);
  const pending=cacheVerifiedAssets({cache,assets,base,signal:controller.signal,onProgress:()=>progress++,fetchAsset:async()=>{calls++;started();await reply;return new Response(bytes);}});
  await entered;controller.abort();finish();await assert.rejects(pending,e=>e.name==='AbortError');await pause(25);
  assert.ok(calls>0);
  assert.equal(cache.puts,0);assert.equal(progress,0);
});
test('manifest khác origin hoặc mâu thuẫn hash bị chặn trước fetch',async()=>{
  let calls=0;const args={cache:store(),base,fetchAsset:async()=>{calls++;return new Response(bytes);}};
  await assert.rejects(cacheVerifiedAssets({...args,assets:[{path:'https://other.invalid/a',sha256:sha}]}),e=>e.code==='CACHE_UNAVAILABLE');
  await assert.rejects(cacheVerifiedAssets({...args,assets:[assets[0],{...assets[0],sha256:'a'.repeat(64)}]}),e=>e.code==='CACHE_CONTENT_MISMATCH');
  assert.equal(calls,0);
});

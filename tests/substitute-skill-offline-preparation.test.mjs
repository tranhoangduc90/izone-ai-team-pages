import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash,webcrypto} from 'node:crypto';
import vm from 'node:vm';
import {cacheVerifiedAssets} from '../term-tests/substitute-skill-shared/offline-asset-pool-20261127-v1.mjs';
const root=new URL('../',import.meta.url);
const isBase=process.env.SUBSTITUTE_SKILL_OFFLINE_BASE==='1';
const path='term-tests/substitute-skill-shared/'+(isBase?'offline.mjs':'offline-journey-20261127-v1.mjs');
const source=isBase?execFileSync('git',['show','5d127071b19cd3fdc188c33e46f6bb5739ad448e:'+path],{cwd:root,encoding:'utf8'}):readFileSync(new URL(path,root),'utf8');
async function fixture({oldPage=false}={}){
  const body='fixture',sha=createHash('sha256').update(body).digest('hex'),release='skills-journey-20261127-v1';
  const manifest={testId:'fixture',build:'issue611-'+'a'.repeat(16),preparationRelease:release,assets:Array.from({length:8},(_,i)=>({path:i+'.js',sha256:sha}))};
  const rows=new Map();let active=0,max=0,puts=0,fetches=0;
  const cache={async match(url){return rows.get(url.href)?.clone();},async put(url,response){puts++;rows.set(url.href,response.clone());}};
  const worker=new EventTarget();worker.register=async url=>{worker.controller={scriptURL:url.href};worker.dispatchEvent(new Event('controllerchange'));};
  const window={caches:{open:async()=>cache}},document={body:{dataset:{test:'fixture',preparationRelease:oldPage?'old':release}}};
  const context=vm.createContext({window,document,navigator:{serviceWorker:worker},caches:window.caches,location:{href:'https://fixture.invalid/test/',origin:'https://fixture.invalid'},
    crypto:webcrypto,URL,AbortSignal,setTimeout,clearTimeout,cacheVerifiedAssets,
    fetch:async url=>{if(String(url)==='asset-manifest.json')return Response.json(manifest);fetches++;active++;max=Math.max(max,active);
      await new Promise(resolve=>setTimeout(resolve,5));active--;return new Response(body);}});
  vm.runInContext(source.replace(/^import .*;\r?\n/gm,'').replaceAll('export ',''),context);
  return {prepare:()=>context.prepareWritingOffline(),stats:()=>({max,puts,fetches})};
}
test('lần cài đầu của đúng bản không reload và không bắt học viên chuẩn bị lần hai',async()=>{
  const f=await fixture();assert.equal((await f.prepare()).updated,false);
});
test('cold cache chạy song song có giới hạn; warm cache không tải hoặc ghi lại',async()=>{
  const f=await fixture();await f.prepare();const before=f.stats();assert.equal(before.max,4);
  await f.prepare();assert.deepEqual(f.stats(),before);
});
test('trang cũ vẫn phải reload trước khi dùng bộ cache của bản mới',async()=>{
  const f=await fixture({oldPage:true});assert.equal((await f.prepare()).updated,true);
});

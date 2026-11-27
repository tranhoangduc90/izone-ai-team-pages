import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const root='https://fixture.invalid/term-tests/';
function runtime(source,scope,cached){
 const listeners={},empty={match:async()=>undefined};
 const caches={open:async name=>({match:async url=>cached.get(name)?.get(typeof url==='string'?url:url.url) }),
  match:async(request,{cacheName}={})=>cached.get(cacheName)?.get(request.url)};
 const self={location:new URL(scope+'worker.js'),navigator:{onLine:false},clients:{get:async()=>null},
  addEventListener:(event,fn)=>listeners[event]=fn,routeSubstituteDemoFetch:(event,fn)=>fn(event)};
 vm.runInNewContext(source,{self,caches,URL,Request,Response,importScripts(){},fetch:async()=>{throw Error('OFFLINE');},console});
 return async url=>{let result;listeners.fetch({request:new Request(url),respondWith:p=>result=p,clientId:''});return result;};
}
for(const course of [56,67])for(const number of [1,2])test('Full '+number+' K'+course+' giữ asset chính xác từ cache v2 khi mất mạng qua đổi bản',async()=>{
 const slug='substitute-test-'+number+'-k'+course,scope=root+slug+'-computer-based/',url=scope+'old-asset.js?v=old';
 const cached=new Map([[slug+'-verified-shell-journey-20261127-v2',new Map([[url,new Response('previous verified')]])]]);
 const handle=runtime(readFileSync('term-tests/'+slug+'-computer-based/offline-sw-journey-20261127-v3.js','utf8'),scope,cached);
 assert.equal(await (await handle(url)).text(),'previous verified');
});
test('Reading giữ shell departure v2 đã verified khi bản mới chưa cache xong',async()=>{
 const scope=root+'ic2311-reading-retake-substitute1-k56/',url=scope+'old-asset.js';
 const cached=new Map([['reading-retake:reading-retake-20261125-departure-v2',new Map([[scope+'.verified-shell',new Response('verified')],[url,new Response('previous verified')]])]]);
 const handle=runtime(readFileSync('term-tests/ic2311-reading-retake-substitute1-k56/sw-journey-20261127-v1.js','utf8'),scope,cached);
 assert.equal(await (await handle(url)).text(),'previous verified');
});

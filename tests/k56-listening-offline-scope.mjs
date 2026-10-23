import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
const path = new URL('../term-tests/k56-listening-offline-worker.js',import.meta.url);
const source=fs.readFileSync(path,'utf8');
console.log(JSON.stringify({workerSha256:crypto.createHash('sha256').update(source).digest('hex'),scope:'Actual worker source in VM. URL filtering and cache navigation key only; does not prove browser installation/offline lifecycle.'}));
function harness(prefix='') {
  const scope=`https://tranhoangduc90.github.io${prefix}/term-tests/term-test-1-k56-computer-based/`;
  const handlers={},matched=[];
  const ctx=vm.createContext({URL,self:{registration:{scope},addEventListener:(name,fn)=>handlers[name]=fn},
    caches:{open:async()=>({match:async key=>{matched.push(key);return {cached:true};}})},
    fetch:async()=>{throw new Error('Synthetic offline');}});
  vm.runInContext(source,ctx);
  return {ctx,handlers,scope,matched};
}
for(const prefix of ['', '/izone-ai-team-pages']) {
  test(`public shell/resources remain eligible at deployment prefix '${prefix}'`,()=>{
    const h=harness(prefix);
    assert.equal(h.ctx.publicFile(new URL(h.scope)),true);
    assert.equal(h.ctx.publicFile(new URL('bootstrap.js?rev=public-build',h.scope)),true);
    assert.equal(h.ctx.publicFile(new URL('../k56-audio-recovery.js?rev=public-build',h.scope)),true);
    assert.equal(h.ctx.publicFile(new URL('../k56-design/assets/SourceSans3-Variable.woff2',h.scope)),true);
    assert.equal(h.ctx.publicFile(new URL('../k56-design/assets/izone-logo-color.png',h.scope)),true);
  });
  test(`API/audio/private assets and external origins cannot enter cache '${prefix}'`,()=>{
    const h=harness(prefix);
    for(const value of [
      `https://tranhoangduc90.github.io${prefix}/api/term-tests/session/audio`,
      new URL('../k56-audio-assets/term-test-1-k56.mp3',h.scope).href,
      new URL('assets/private/audio.js',h.scope).href,
      new URL('../k56-design/assets/private.js',h.scope).href,
      new URL('../k56-design/assets/draft.json',h.scope).href,
      'https://ducizone.ddns.net/api/term-tests/session/audio',
      'https://example.invalid/static.js'
    ])assert.equal(h.ctx.publicFile(new URL(value)),false,value);
  });
  test(`navigation fallback key excludes identity query '${prefix}'`,async()=>{
    const h=harness(prefix);let result;
    h.handlers.fetch({request:{method:'GET',mode:'navigate',url:h.scope+'?class=SYNTHETIC&student=synthetic-id'},respondWith:p=>{result=p;}});
    assert(result,'Worker must intercept the deployed navigation');
    await result;
    assert.deepEqual(h.matched,[h.scope]);
  });
}

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {ASSETS} from '../shared/audio/catalog.mjs';
import {WORKER_ORIGIN} from '../shared/audio/config.mjs';

// The issuer's clock is independent of the learner's Windows clock. This tests
// the real transport boundary; Worker signature/expiry checks have their own suite.
const asset=ASSETS['mini-test-k56'];
const bytes=await readFile(new URL('..'+new URL(asset.url).pathname.replace('/izone-ai-team-pages',''),import.meta.url));
for(const skew of [-86400000,-30000,86400000])test(`valid server ticket survives client clock skew ${skew}ms`,async()=>{
  const {downloadPreferred}=await import('../shared/audio/transport.mjs?skew='+randomUUID());
  const serverNow=Date.now(),original=Date.now,calls=[];
  Date.now=()=>serverNow+skew;
  try{
    const blob=await downloadPreferred({...asset,envelopeVersion:'MP3',cloudflare:{version:1,policy:'public-mp3-v1'}},{
      fetchImpl:async(url,init)=>{
        url=String(url);calls.push(url);
        if(url.startsWith(WORKER_ORIGIN+'/access/')){
          const id=url.split('/').at(-1);
          return Response.json({version:1,policy:'public-mp3-v1',expiresAt:serverNow+600000,key:'A'.repeat(43),ticket:'test-ticket',
            context:{product:'public-mp3-v1',classId:'public',testId:asset.id,owner:'public',sid:id,generation:1,purpose:'audio.public',assetHash:asset.sha256,downloadId:id}});
        }
        if(url.startsWith(WORKER_ORIGIN+'/parts/'))return new Response('source unavailable',{status:503});
        assert.equal(url,asset.url);
        const [,start,end]=/^bytes=(\d+)-(\d+)$/.exec(init.headers.Range);
        return new Response(bytes.subarray(+start,+end+1),{status:206});
      }
    });
    assert.equal(blob.size,asset.byteLength);
    assert.ok(calls.some(url=>url.startsWith(WORKER_ORIGIN+'/parts/')),'valid ticket reaches the server for authorization');
    assert.ok(calls.includes(asset.url),'technical source failure still uses verified fallback');
  }finally{Date.now=original;}
});

for(const denied of [false,true])test(`manual fallback preserves access validation (${denied?'denied':'authorized'})`,async()=>{
  const {downloadPreferred}=await import('../shared/audio/transport.mjs?manual='+randomUUID());let access=0,primary=0,fallback=0;
  const work=downloadPreferred({...asset,envelopeVersion:'MP3',cloudflare:{version:1,policy:'public-mp3-v1'}},{preferFallback:true,fetchImpl:async(url,init)=>{
    url=String(url);
    if(url.startsWith(WORKER_ORIGIN+'/access/')){
      access++;if(denied)return new Response('denied',{status:403});const id=url.split('/').at(-1);
      return Response.json({version:1,policy:'public-mp3-v1',expiresAt:Date.now()+600000,key:'A'.repeat(43),ticket:'test-ticket',
        context:{product:'public-mp3-v1',classId:'public',testId:asset.id,owner:'public',sid:id,generation:1,purpose:'audio.public',assetHash:asset.sha256,downloadId:id}});
    }
    if(url.startsWith(WORKER_ORIGIN+'/parts/')){primary++;throw Error('must not request primary parts');}
    assert.equal(url,asset.url);fallback++;const [,start,end]=/^bytes=(\d+)-(\d+)$/.exec(init.headers.Range);
    return new Response(bytes.subarray(+start,+end+1),{status:206});
  }});
  if(denied){await assert.rejects(work,e=>e.accessDenied===true&&e.userMessage.includes('giáo viên'));assert.equal(fallback,0);}
  else{assert.equal((await work).size,asset.byteLength);assert.ok(fallback>0);}
  assert.equal(access,1);assert.equal(primary,0);
});

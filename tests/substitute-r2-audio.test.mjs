import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {ASSETS} from '../shared/audio/catalog.mjs';
import {authorizeSubstituteAudio} from '../term-tests/substitute-shared/audio-preparation.mjs';

const testSlug='substitute-test-1-k56';
const asset=ASSETS[testSlug];
const scope={testSlug,classCode:'DEMO',studentRef:'fixture',clientRunId:'fixture-run',historyEpoch:'fixture-epoch',
 examOrder:'listening-first',deviceId:'fixture-device',generation:1};
const assetUrl=new URL(asset.url);
const audio=await readFile(new URL('../'+assetUrl.pathname.replace(/^\/izone-ai-team-pages\//,''),import.meta.url));
const manifest={sha256:asset.sha256,byteLength:asset.byteLength,url:asset.url,envelopeVersion:'MP3'};
const signedUrl=`https://e340869dcc6ff285504947407d148104.r2.cloudflarestorage.com/izone-audio-r2-lab-20261023/${asset.key}?fixture=synthetic`;
const ready={audioTransport:'r2-direct-v1',binding:{...scope,sha256:asset.sha256},manifest,audioPreparationToken:'fixture-preparation-token',
 audioDownload:{version:1,policy:'r2-direct-v1',method:'GET',url:signedUrl,sha256:asset.sha256,byteLength:asset.byteLength,
  validForSeconds:600,fallback:'public-pages'}};
const cache={get:async()=>null,put:async()=>true};

test('verified native grant downloads R2 first and holds the start token in the matching scope',async()=>{
 const paths=[];
 const prepared=await authorizeSubstituteAudio(scope,async input=>{
  assert.deepEqual(input,{...scope,audioPolicy:'r2-direct-v1'});return ready;
 });
 const blob=await prepared.download({cache,fetchImpl:async(url,init)=>{
  paths.push(url);assert.equal(init.credentials,'omit');return new Response(audio);
 }});
 assert.equal(blob.size,asset.byteLength);assert.deepEqual(paths,[signedUrl]);
 assert.deepEqual(prepared.startFields(scope),{audioPolicy:'r2-direct-v1',audioPreparationToken:'fixture-preparation-token'});
 assert.equal(prepared.isCurrent({...scope,examOrder:'reading-first'}),false);
 assert.throws(()=>prepared.startFields({...scope,generation:2}),{accessDenied:true});
});

test('after authorized R2 failure renew once then use only the same verified Pages file',async()=>{
 let approvals=0;const paths=[];
 const prepared=await authorizeSubstituteAudio(scope,async()=>++approvals===1?ready:{...ready,audioDownload:null});
 const blob=await prepared.download({cache,fetchImpl:async url=>{
  paths.push(url);return url===signedUrl?new Response('',{status:403}):new Response(audio);
 }});
 assert.equal(blob.size,asset.byteLength);assert.equal(approvals,2);assert.deepEqual(paths,[signedUrl,asset.url]);
});

test('native deny on renew stops before fallback, and a mismatched native scope is rejected',async()=>{
 let approvals=0;const paths=[];
 const prepared=await authorizeSubstituteAudio(scope,async()=>{
  if(++approvals===1)return ready;
  throw Object.assign(Error('forbidden'),{accessDenied:true});
 });
 await assert.rejects(prepared.download({cache,fetchImpl:async url=>{
  paths.push(url);return new Response('',{status:403});
 }}),{accessDenied:true});
 assert.deepEqual(paths,[signedUrl]);
 await assert.rejects(authorizeSubstituteAudio(scope,async()=>({...ready,binding:{...ready.binding,studentRef:'different'}})),{accessDenied:true});
});

test('authorized Pages-only response never requests a signed URL, while legacy remains available',async()=>{
 const prepared=await authorizeSubstituteAudio(scope,async()=>({...ready,audioDownload:null}));
 const blob=await prepared.download({cache,fetchImpl:async url=>{assert.equal(url,asset.url);return new Response(audio);}});
 assert.equal(blob.size,asset.byteLength);
 assert.equal(await authorizeSubstituteAudio(scope,async()=>({audioTransport:'legacy'})),null);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createPublicAudio} from '../shared/public-audio.mjs';
import {fetchListeningAudio,AUDIO_MANIFEST_TYPE} from '../listening-practice/audio-delivery.mjs';
import {plaintextAudio} from '../term-tests/k56-shared/public-audio.mjs';

// Own byte expectations at the HTTP/Blob boundary. No mock performs hashing,
// reconstruction, cache selection, or token forwarding for the implementation.
const bytes=Buffer.alloc(2*1048576+731,41),hash=b=>createHash('sha256').update(b).digest('hex'),sha=hash(bytes);
function manifest(prefix='listening-practice/audio-assets/') {
  return {envelopeVersion:'MP3',assetVersion:'sha256-'+sha,sha256:sha,byteLength:bytes.length,
    encryptedByteLength:bytes.length,chunkSize:1048576,
    url:`https://tranhoangduc90.github.io/izone-ai-team-pages/${prefix}fixture-${sha.slice(0,16)}.mp3`,
    chunks:Array.from({length:3},(_,i)=>{const value=bytes.subarray(i*1048576,(i+1)*1048576);return{byteLength:value.length,sha256:hash(value)};})};
}
function store(){return createPublicAudio({database:'fixture',prefixes:['/izone-ai-team-pages/listening-practice/audio-assets/']});}
function part(range){const[,a,b]=/^bytes=(\d+)-(\d+)$/.exec(range);return new Response(bytes.subarray(+a,+b+1),{status:206});}
test('partial failure keeps good chunks and retries only the missing part',async()=>{
  const s=store(),m=manifest(),calls=[];let fail=true;
  const fetchImpl=async(_u,o)=>{calls.push(o.headers.Range);if(fail&&o.headers.Range.startsWith('bytes=1048576-'))throw Error('fixture-network');return part(o.headers.Range);};
  await assert.rejects(s.download(m,{fetchImpl}),/fixture-network/);fail=false;
  assert.deepEqual(Buffer.from(await (await s.download(m,{fetchImpl})).arrayBuffer()),bytes);
  assert.equal(calls.filter(r=>r==='bytes=0-1048575').length,1);
});
test('corrupt or short chunks cannot play; full file response still needs the expected hash',async()=>{
  for(const payload of [Buffer.alloc(1048576),Buffer.from('short')])await assert.rejects(store().download(manifest(),{fetchImpl:async()=>new Response(payload,{status:206})}));
  assert.equal(hash(Buffer.from(await(await store().download(manifest(),{fetchImpl:async()=>new Response(bytes)})).arrayBuffer())),sha);
  await assert.rejects(store().download(manifest(),{fetchImpl:async()=>new Response(Buffer.alloc(bytes.length))}));
});
test('wrong product path, host, hash and cancelled requests fail before audio fetch',async()=>{
  for(const m of [manifest('term-tests/k67-audio-assets/'),{...manifest(),url:'https://evil.test/fixture.mp3'},
    {...manifest(),assetVersion:'sha256-'+'0'.repeat(64)}, {...manifest(),chunks:[]}]) {
    let calls=0;await assert.rejects(store().download(m,{fetchImpl:async()=>{calls++;}}));assert.equal(calls,0);
  }
  const c=new AbortController();c.abort();let calls=0;
  await assert.rejects(store().download(manifest(),{signal:c.signal,fetchImpl:async()=>{calls++;}}));assert.equal(calls,0);
});
test('Listening authorizes through API each load, only Range goes to Pages, old API remains compatible',async t=>{
  const original=globalThis.fetch;t.after(()=>globalThis.fetch=original);const m=manifest(),calls=[];
  globalThis.fetch=async(url,o)=>{
    calls.push({url,options:o});
    if(url==='https://api.example.test/audio/fixture'){
      assert.equal(o.headers.get('Accept'),AUDIO_MANIFEST_TYPE);assert.equal(o.headers.get('Authorization'),'Bearer fixture-private');
      return Response.json({audioManifest:m});
    }
    assert.equal(url,m.url);assert.equal(o.headers.Authorization,undefined);assert.equal(o.credentials,undefined);return part(o.headers.Range);
  };
  const options={headers:{Authorization:'Bearer fixture-private'},credentials:'include'};
  assert.equal((await fetchListeningAudio('https://api.example.test/audio/fixture',options)).size,bytes.length);
  assert.equal((await fetchListeningAudio('https://api.example.test/audio/fixture',options)).size,bytes.length);
  assert.equal(calls.filter(c=>c.url.includes('api.example.test')).length,2);
  assert.equal(calls.filter(c=>c.url===m.url).length,3);
  globalThis.fetch=async()=>new Response('legacy fixture',{headers:{'Content-Type':'audio/mpeg'}});
  assert.equal(await(await fetchListeningAudio('https://api.example.test/audio/fixture',options)).text(),'legacy fixture');
});
test('K56 public audio skips session decryption only for a full verified MP3',async()=>{
  const m=manifest('term-tests/k56-audio-assets/');
  assert.deepEqual(Buffer.from(await plaintextAudio(new Blob([bytes]),m)),bytes);
  await assert.rejects(plaintextAudio(new Blob([Buffer.alloc(bytes.length)]),m));
});

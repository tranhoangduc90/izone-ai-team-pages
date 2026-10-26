import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash, randomUUID} from 'node:crypto';

// Exercise the real API/verified-Blob boundary. Cache never substitutes for an
// API grant, and stale downloads must not repopulate memory after logout.
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
function fixture(value = 41) {
  const bytes = Buffer.alloc(64013, value), sha256 = hash(bytes);
  return {bytes, manifest: {envelopeVersion:'MP3', assetVersion:'sha256-'+sha256,
    sha256, byteLength:bytes.length, encryptedByteLength:bytes.length, chunkSize:1048576,
    url:`https://tranhoangduc90.github.io/izone-ai-team-pages/listening-practice/audio-assets/fixture-${sha256.slice(0,16)}.mp3`,
    chunks:[{byteLength:bytes.length, sha256}]}};
}
async function setup(t) {
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  const loader = await import('../listening-practice/audio-delivery.mjs?fixture='+randomUUID());
  let source = fixture(), status = 200, transfers = 0, grants = 0, delay;
  globalThis.fetch = async (url, options) => {
    if (url === 'https://api.example.test/review') {
      grants++;
      assert.equal(options.headers.get('Accept'), loader.AUDIO_MANIFEST_TYPE);
      if (status !== 200) return new Response('', {status});
      return Response.json({audioManifest:source.manifest});
    }
    transfers++;
    assert.equal(url, source.manifest.url);
    assert.equal(options.headers.Authorization, undefined);
    if (delay) await delay;
    return new Response(source.bytes, {status:206});
  };
  return {loader, load:options => loader.fetchListeningAudio('https://api.example.test/review', options),
    get source(){return source;}, set source(value){source=value;},
    set status(value){status=value;}, set delay(value){delay=value;},
    counts:() => ({grants,transfers})};
}

test('same verified audio is reused without reconstruction after a fresh API grant', async t => {
  const f=await setup(t), first=await f.load(), second=await f.load();
  assert.strictEqual(second,first,'Review should reuse the complete verified file from exam playback');
  assert.deepEqual(f.counts(),{grants:2,transfers:1});
  assert.equal(hash(Buffer.from(await second.arrayBuffer())),f.source.manifest.sha256);
});
test('warm file cannot bypass revoked authorization or an aborted request', async t => {
  const f=await setup(t);await f.load();f.status=403;
  await assert.rejects(f.load(), error=>error.httpStatus===403);
  f.status=200;const controller=new AbortController();controller.abort();
  await assert.rejects(f.load({signal:controller.signal}),{name:'AbortError'});
  assert.equal(f.counts().transfers,1);
});
test('review hash mismatch is rejected before cached audio or media download', async t => {
  const f=await setup(t);await f.load();
  await assert.rejects(f.load({expectedSha256:'f'.repeat(64)}),/AUDIO_VERSION_MISMATCH/);
  assert.equal(f.counts().transfers,1);
});
test('only the latest complete file is retained; logout clears it', async t => {
  const f=await setup(t), first=await f.load(), original=f.source;
  f.source=fixture(42);const other=await f.load();assert.notStrictEqual(other,first);
  f.source=original;const rebuilt=await f.load();assert.notStrictEqual(rebuilt,first);
  f.loader.clearListeningAudioMemory();
  assert.notStrictEqual(await f.load(),rebuilt);
});
test('an in-flight download cannot refill complete-file memory after logout', async t => {
  const f=await setup(t);let release;
  f.delay=new Promise(resolve=>{release=resolve;});const pending=f.load();
  while(!f.counts().transfers)await new Promise(resolve=>setImmediate(resolve));
  f.loader.clearListeningAudioMemory();release();const old=await pending;
  assert.notStrictEqual(await f.load(),old);
});
test('legacy API remains usable and a review still verifies its expected hash', async t => {
  const f=await setup(t), bytes=Buffer.from('legacy audio fixture');
  globalThis.fetch=async()=>new Response(bytes,{headers:{'Content-Type':'audio/mpeg'}});
  assert.equal(await(await f.load()).text(),bytes.toString());
  assert.equal(await(await f.load({expectedSha256:hash(bytes)})).text(),bytes.toString());
  await assert.rejects(f.load({expectedSha256:'f'.repeat(64)}),/AUDIO_VERSION_MISMATCH/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {webcrypto,createHash} from 'node:crypto';

// Byte giả và HTTP giả; kiểm nội dung thật của Blob, retry và điều kiện mở audio.
// Cache qua reload/IndexedDB thật được kiểm riêng bằng trình duyệt.
const source = await readFile(new URL('../term-tests/k67-shared/public-audio.js', import.meta.url), 'utf8');
const bytes = Buffer.alloc(2 * 1048576 + 731, 67);
const hash = b => createHash('sha256').update(b).digest('hex');
const sha256 = hash(bytes);
const manifest = {assetVersion: 'sha256-' + sha256, sha256, byteLength: bytes.length,
  encryptedByteLength: bytes.length, envelopeVersion: 'MP3', chunkSize: 1048576,
  url: `https://tranhoangduc90.github.io/izone-ai-team-pages/term-tests/k67-audio-assets/test-${sha256.slice(0,16)}.mp3`,
  chunks: Array.from({length: 3}, (_, i) => {const b = bytes.subarray(i*1048576, (i+1)*1048576); return {byteLength:b.length,sha256:hash(b)};})};
function loader() {
  const window = {};
  vm.runInNewContext(source, {window,document:{currentScript:{src:'https://tranhoangduc90.github.io/izone-ai-team-pages/term-tests/k67-shared/public-audio.js'}}, URL, Blob, crypto:webcrypto, Uint8Array, AbortController, setTimeout, clearTimeout, console});
  return window.K67_PUBLIC_AUDIO;
}
const partial = range => {
  const [, start, end] = /^bytes=(\d+)-(\d+)$/.exec(range);
  return new Response(bytes.subarray(Number(start), Number(end)+1), {status:206});
};
test('Tải lỗi hai lần giữ phần đúng; thử lại chỉ tải phần thiếu và toàn file khớp', async () => {
  const api = loader(), calls = [], progress = [];
  let fail = true;
  const fetchImpl = async (_url, options) => {
    const range = options.headers.Range; calls.push(range);
    if (range.startsWith('bytes=1048576-') && fail) throw new Error('Mất mạng giả');
    return partial(range);
  };
  await assert.rejects(api.download(manifest, {fetchImpl}), /Mất mạng giả/);
  const prior = [...calls]; fail = false;
  const blob = await api.download(manifest, {fetchImpl, onProgress:p=>progress.push(p)});
  assert.deepEqual(Buffer.from(await blob.arrayBuffer()), bytes);
  assert.equal(calls.filter(r=>r==='bytes=0-1048575').length, 1);
  assert.equal(calls.filter(r=>r.startsWith('bytes=1048576-')).length, 3);
  assert.ok(prior.length >= 3);
  assert.equal(progress.at(-1).complete, true);
});
test('Phần sai hash không vào cache; lần thử đúng khôi phục riêng phần đó', async () => {
  const api = loader(), calls = [];
  const blob = await api.download(manifest, {fetchImpl:async(_u, o)=>{
    calls.push(o.headers.Range);
    if(calls.length===1) return new Response(Buffer.alloc(1048576, 0), {status:206});
    return partial(o.headers.Range);
  }});
  assert.equal(hash(Buffer.from(await blob.arrayBuffer())), sha256);
  assert.equal(calls.filter(r=>r==='bytes=0-1048575').length, 2);
});
test('Thiếu dữ liệu hoặc sai nội dung không được nhận là tải đủ', async () => {
  for (const response of [()=>new Response('ngắn',{status:206}), ()=>new Response(Buffer.alloc(1048576),{status:206})]) {
    const api=loader(); await assert.rejects(api.download(manifest,{fetchImpl:async()=>response()}));
  }
  await assert.rejects(loader().verify(new Blob([bytes.subarray(1)]),manifest));
});
test('Máy phân phối trả toàn file vẫn phải kiểm hash; không ghép nhầm phần', async () => {
  const api=loader(); const b=await api.download(manifest,{fetchImpl:async()=>new Response(bytes)});
  assert.deepEqual(Buffer.from(await b.arrayBuffer()),bytes);
  await assert.rejects(loader().download(manifest,{fetchImpl:async()=>new Response(Buffer.alloc(bytes.length))}));
});
test('Manifest sai phiên bản, kích thước, hash, URL bị chặn trước gọi mạng', async () => {
  for (const patch of [{assetVersion:'sha256-'+'0'.repeat(64)}, {byteLength:0}, {encryptedByteLength:1},
    {url:'https://example.com/file.mp3'}, {chunks:manifest.chunks.slice(1)}, {envelopeVersion:'IZTT1'}]) {
    let calls=0; await assert.rejects(loader().download({...manifest,...patch},{fetchImpl:async()=>{calls++;return partial('bytes=0-1048575');}}));
    assert.equal(calls,0);
  }
});
test('Hủy lượt tải không được trả file hoặc tự tiếp tục retry', async () => {
  const controller=new AbortController();controller.abort();let calls=0;
  await assert.rejects(loader().download(manifest,{signal:controller.signal,fetchImpl:async()=>{calls++;}}));
  assert.equal(calls,0);
});

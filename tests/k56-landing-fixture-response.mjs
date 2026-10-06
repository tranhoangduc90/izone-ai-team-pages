// Regression máy chủ fixture: thiếu favicon không được gửi hai bộ header.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { extname, resolve, sep } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('./k56-landing-demo-picker-browser.mjs', import.meta.url), 'utf8');
const start = source.indexOf('  const server = createServer(');
const end = source.indexOf('\n  await new Promise(done => server.listen', start);
assert.ok(start >= 0 && end > start);

for (const missing of [true, false]) {
  test(`landing fixture: ${missing ? 'file thiếu trả 404' : 'file có trả 200'} đúng một lần`, async () => {
    let handler;
    const context = vm.createContext({
      URL, resolve, extname, sep, root: resolve('.'),
      createServer: callback => { handler = callback; return {}; },
      readFile: async () => { if (missing) throw Object.assign(new Error('Synthetic missing file'), { code: 'ENOENT' }); return Buffer.from('Synthetic content'); }
    });
    vm.runInContext(source.slice(start, end), context);
    const headers = [];
    let ended = 0;
    const response = {
      writeHead(status) { assert.equal(headers.length, 0, 'Không gửi header lần hai'); headers.push(status); return this; },
      end(content) { ended += 1; this.content = content; return this; }
    };
    await handler({ url: missing ? '/favicon.ico' : '/term-tests/k56-demo/index.html' }, response);
    assert.deepEqual(headers, [missing ? 404 : 200]);
    assert.equal(ended, 1);
    if (!missing) assert.equal(response.content.toString(), 'Synthetic content');
  });
}

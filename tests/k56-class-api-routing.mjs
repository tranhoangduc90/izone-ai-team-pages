import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../term-tests/k56-shared/config.js', import.meta.url), 'utf8');
for (const initialClass of ['IC2264', 'CODEXDEMO56', 'ic2264', '']) {
  test(`K56 định tuyến hai lớp độc lập với lớp mở ban đầu: ${initialClass}`, () => {
    const window = { location: { search: `?class=${initialClass}` } };
    vm.runInNewContext(source, { window, URLSearchParams });
    const config = window.TERM_TEST_APP_CONFIG;
    for (const [classCode, endpoint] of [
      ['CODEXDEMO56', 'mapping-api-demo'], ['IC2264', 'mapping-api-k56']
    ]) {
      assert.equal(config.API_BY_CLASS[classCode] || config.API_BASE_URL, `https://ducizone.ddns.net/${endpoint}`);
    }
    assert.ok(Object.isFrozen(config.API_BY_CLASS));
  });
}

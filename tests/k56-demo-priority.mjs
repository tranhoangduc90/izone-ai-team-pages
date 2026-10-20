// Khối demo ở cuối dashboard theo bố cục mới; bộ chọn lớp giữ hành vi hiện hành.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildK56LandingClasses} from '../term-tests/k56-demo/landing-model.js';
test('Demo đứng đầu, lớp thật giữ thứ tự và không nhận lại mã demo cũ',()=>{
  const result=buildK56LandingClasses([{name:'IC2264'},{name:'CODEXDEMO806'},{name:'IC2370'},{name:'CODEXDEMO56'},{name:'CODEXDEMO56'},{name:'CODEXID261018'}]);
  assert.deepEqual(result.map(c=>c.name),['CODEXDEMO56','IC2370','IC2264']);
  assert.match(result[0].label,/demo.*10 học viên/i);
  assert.deepEqual(buildK56LandingClasses([]).map(c=>c.name),['CODEXDEMO56']);
});
test('Khối lớp demo nằm cuối dashboard, sau phần xem kết quả',()=>{
  const html=readFileSync(new URL('../term-tests/k56-demo/index.html',import.meta.url),'utf8');
  const entry=html.indexOf('id="demoClassEntry"');assert.ok(entry>0);
  assert.ok(entry>html.indexOf('class="landing-auth"'));
  assert.ok(entry>html.indexOf('id="teacherDashboard"'));
  assert.match(html, /href="\.\.\/demo\/\?course=56"/);
});

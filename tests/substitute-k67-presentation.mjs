import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read = p => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const load = n => { const c = { window: {} }; vm.runInNewContext(read(`term-tests/substitute-test-${n}-k67-computer-based/content.js`), c); return c.window[`K67_SUBSTITUTE_TEST_${n}_CONTENT`]; };
for (const n of [1, 2]) test(`K67 Sub ${n}: source notes have title and subsection hierarchy`, () => {
  const d = load(n);
  for (const i of [0, 3]) {
    assert.match(d.listening.sections[i].html, /<h3 class="k67-content-title">/);
    assert.match(d.listening.sections[i].html, /<h4 class="k67-note-heading">/);
    assert.match(d.listening.sections[i].html, /k67-note-bullet/);
  }
  assert.match(d.reading.sections[0].questionsHtml, /<h3 class="k67-content-title">/);
  for (const s of d.reading.sections) assert.match(s.questionsHtml, /k67-instruction-block/);
});
test('K67 Sub 1 matching 27–30 renders questions before the A–F option bank', () => {
  const html = load(1).listening.sections[2].html;
  const columns = html.slice(html.indexOf('class="k67-matching-columns"'));
  assert.ok(columns.length > 0);
  assert.ok(columns.indexOf('data-answer-slot="27"') < columns.indexOf('class="k67-option-bank"'));
  for (const letter of 'ABCDEF') assert.match(columns, new RegExp('data-option-letter="' + letter + '"'));
});
test('question ranges use an unwrapped pill with a dedicated wide grid column', () => {
  const css = read('term-tests/substitute-k67-shared/semantic-layout.css');
  assert.match(css, /\[data-control="multi"\] \.cbt-question-heading\s*\{[^}]*grid-template-columns:\s*64px/);
  assert.match(css, /\[data-control="multi"\] \.cbt-question-number\s*\{[^}]*white-space:\s*nowrap/);
});

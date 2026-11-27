import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import { demoJournalPage } from '../term-tests/demo/journal-entry-v4.mjs';
import { demoContext } from '../term-tests/demo/model.js';

const pages = 'https://tranhoangduc90.github.io/izone-ai-team-pages/term-tests/';
const demo = 'https://ducizone.ddns.net/exam-demo/term-tests/';
const script = readFileSync(new URL('../term-tests/demo/bookmark-v1.js', import.meta.url), 'utf8');

function destination(url, code) {
  let replaced;
  const location = new URL(url);
  location.replace = value => { replaced = value; };
  runInNewContext(script, { location, URL, URLSearchParams, document: {
    currentScript: { dataset: { demoClass: code } },
  } });
  return replaced;
}

for (const course of ['56', '67']) {
  for (const exam of ['term1', 'term2', 'mini']) {
    for (const suffix of ['', '-computer-based']) {
      const { slug, code } = demoContext(course, exam);
      const path = demoJournalPage(slug + suffix, code);
      test(`Demo bookmark ${path} stays on the selected test, format and order`, () => {
        const file = path.endsWith('/') ? path + 'index.html' : path;
        const html = readFileSync(new URL('../term-tests/' + file, import.meta.url), 'utf8');
        const tag = html.match(/<script[^>]*>/i)?.[0];
        assert.equal(tag, `<script src="../demo/bookmark-v1.js" data-demo-class="${code}">`);
        for (const mode of ['lis_first', 'read_first']) {
          const query = `?class=${code}&mode=${mode}`;
          assert.equal(destination(pages + path + query + '&demoStudent=old#old', code), demo + path + query);
        }
        assert.equal(destination(pages + path + '?class=IC2000&mode=read_first', code), undefined);
        assert.equal(destination(pages + path, code), undefined);
        assert.equal(destination(pages + path + '?class=CODEXDEMO000', code), undefined);
        assert.equal(destination(demo + path + `?class=${code}`, code), undefined);
      });
    }
  }
}

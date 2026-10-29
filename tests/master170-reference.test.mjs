import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {groupsHtml} from '../reading-practice/authored-ui.js';
import {isNoteDocument} from '../listening-practice/authored-ui.js';

const root=fileURLToPath(new URL('../',import.meta.url));
const directory=path.join(root,'design-reference/master170');
const cases=JSON.parse(await fs.readFile(path.join(directory,'cases.json'),'utf8'));
test('reference links cover the declared cases and native question families',async()=>{
 const manifest=JSON.parse(await fs.readFile(path.join(directory,'manifest.json'),'utf8'));
 assert.equal(cases.length,31);assert.equal(manifest.count,cases.length);
 assert.equal(new Set(cases.map(c=>c.id)).size,cases.length);
 for(const id of ['reading-tfng','reading-ynng','reading-mcq','reading-multiple','reading-headings','reading-features','reading-endings','reading-information','reading-summary','reading-summary-bank','reading-sentence','reading-short','reading-table','listening-note','listening-table','listening-pair','listening-map','reading-homework','reading-homework-tfng','listening-homework','remember'])assert.ok(cases.some(c=>c.id===id),id);
});
test('demo HTML resolves its native local resources under the Pages prefix',async()=>{
 for(const file of (await fs.readdir(directory)).filter(f=>f.endsWith('.html'))){
  const html=await fs.readFile(path.join(directory,file),'utf8');
  const base=new URL(html.match(/<base href="([^"]+)"/)?.[1]||file,'https://example.invalid/izone-ai-team-pages/design-reference/master170/');
  for(const match of html.replace(/<base\b[^>]*>/g,'').matchAll(/(?:src|href)="([^"]+)"/g)){
   if(/^(?:data:|#|https?:)/.test(match[1]))continue;
   const url=new URL(match[1],base);assert.ok(url.pathname.startsWith('/izone-ai-team-pages/'),url.href);
   const relative=decodeURIComponent(url.pathname.slice('/izone-ai-team-pages/'.length));await fs.access(path.join(root,relative));
  }
 }
});
test('synthetic Homework fixtures match native counts and never load account clients',async()=>{
 for(const [file,count]of [['homework-reading.html',20],['homework-tfng.html',42]]){
  const html=await fs.readFile(path.join(directory,file),'utf8');
  assert.doesNotMatch(html,/<script[^>]+src="(?:api-config|access|web-client)\.js/);
  assert.match(html,/Object\.defineProperty\(window,"localStorage"/);
  const content=JSON.parse(html.match(/const demoContent=(.*?);const demoFeedback=/)[1]);
  assert.equal(content.targets.length,count);assert.ok(Array.isArray(content.blankValues));assert.ok(Array.isArray(content.dropdownPlaceholders));
  assert.match(html,/Demo không gọi API thật/);
 }
});
test('judgment and continuous-note examples use the corrected native components',()=>{
 for(const id of ['reading-tfng','reading-ynng']){
  const c=cases.find(c=>c.id===id),html=groupsHtml(c.groups,{answers:{}},()=>'<button aria-label="Flag"></button>');
  assert.equal((html.match(/type="radio"/g)||[]).length,6);assert.doesNotMatch(html,/<select/);assert.match(html,/authored-annotation-context[^>]+hidden aria-hidden/);
 }
 const notes=cases.find(c=>c.id==='listening-note');assert.equal(isNoteDocument(notes.groups),true);
 assert.deepEqual(notes.groups.flatMap(g=>g.questions.map(q=>q.n)),Array.from({length:10},(_,i)=>31+i));
});

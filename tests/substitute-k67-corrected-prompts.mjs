import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const load=n=>{const c={window:{}};vm.runInNewContext(read(`term-tests/substitute-test-${n}-k67-computer-based/content.js`),c);return c.window[`K67_SUBSTITUTE_TEST_${n}_CONTENT`];};
const prompts=[
 'Some people feel that the private lives of celebrities should not be openly shared by the media. To what extent do you agree or disagree?',
 'Many cities are becoming increasingly crowded, and traffic congestion is getting worse. What problems does this cause, and what measures can be taken to solve them?'
];
for(const n of [1,2])test(`Sub ${n}: only the user-specified Writing Task 2`,()=>{
 const d=load(n); assert.equal(d.writing.tasks.length,1);assert.equal(d.writing.tasks[0].id,'task2');
 assert.equal([d.writing.tasks[0].prompt,d.writing.tasks[0].followUp].filter(Boolean).join(' '),prompts[n-1]);
 const c={window:{}};vm.runInNewContext(read(`term-tests/substitute-test-${n}-k67/test-config.js`),c);assert.equal(c.window.TERM_TEST_CONFIG.writing.totalQuestions,1);
});
for(const [n,p,start,end,last]of [[1,2,33,36,'I'],[2,1,19,23,'C'],[2,2,31,35,'G']])test(`Sub ${n} Reading ${start}-${end}: questions left, separate options right`,()=>{
 const html=load(n).reading.sections[p].questionsHtml;
 const match=html.match(new RegExp(`<div class="k67-matching-columns k67-reading-matching" data-matching-range="${start}-${end}">([\\s\\S]*?)<\\/aside><\\/div>`));
 assert.ok(match,'Missing scoped two-column group');const body=match[1];
 assert.ok(body.indexOf(`data-answer-slot="${start}"`)<body.indexOf('class="k67-option-bank"'));
 assert.equal((body.match(/data-option-letter=/g)||[]).length,last.charCodeAt(0)-64);
 for(let q=start;q<=end;q++)assert.equal((body.match(new RegExp(`data-answer-slot="${q}"`,'g'))||[]).length,1);
});
test('Sub 2 Listening has the supplied Section 1 and 2 instructions',()=>{
 const d=load(2);assert.match(d.listening.sections[0].html,/SECTION 1[\s\S]*Questions 1[–-]10[\s\S]*Complete the notes below\.[\s\S]*Write ONE WORD AND\/OR A NUMBER for each answer\./);
 assert.match(d.listening.sections[1].html,/SECTION 2[\s\S]*Questions 11[–-]20[\s\S]*Choose the correct letter, A, B or C\./);
});

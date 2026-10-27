import test from 'node:test';import assert from 'node:assert/strict';
import {passageFor,passageSubset,dialogHtml} from '../reading-practice/authored-ui.js';
// Hai passage giả có cùng nhãn A; popup phải dùng định danh riêng theo câu.
test('popup qua ranh giới chỉ dùng đúng toàn văn và nhãn đoạn của passage mới',()=>{
 const lesson={lesson:914,title:'Synthetic full test',questionIds:['13','14'],passages:[{id:'p1',label:'Passage 1',title:'First',start:1,end:13,paragraphs:['p1_A'],labels:{p1_A:'A'}},{id:'p2',label:'Passage 2',title:'Second',start:14,end:26,paragraphs:['p2_A'],labels:{p2_A:'A'}}],groups:[{start:1,end:13,label:'Completion'},{start:14,end:26,label:'Completion'}]};
 assert.equal(passageFor(lesson,14).id,'p2');assert.deepEqual(passageSubset({p1_A:'First source',p2_A:'Second source'},passageFor(lesson,14)),{p2_A:'Second source'});
 const p=text=>({runs:[{text}]});const data={definition:{passage:{p1_A:'First source',p2_A:'Second source'}},explanations:{entries:{14:{answer:['word'],prompt:p('Question'),reason:[p('Reason')],evidenceGroups:[{paragraph:'p2_A',speaker:'',paragraphs:[p('Second source')],marks:[{start:0,end:6,background:'#ffe599'}]}]}}}};
 const html=dialogHtml(lesson,data,{answers:{14:'word'},result:{rows:[{number:14,state:'correct'}]}},14,ps=>ps.map(p=>p.runs.map(r=>r.text).join('')).join(''));
 assert.ok(html.includes('Passage 2'));assert.ok(html.includes('Second source'));assert.ok(!html.includes('First source'));assert.ok(html.includes('>A</span>'));
});

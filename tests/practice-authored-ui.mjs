// Dữ liệu giả có hai vị trí xa nhau; kiểm HTML giữ lối chuyển dẫn chứng gốc của Robots and us.
import test from 'node:test';
import assert from 'node:assert/strict';
import {dialogHtml,prepHtml,groupsHtml} from '../reading-practice/authored-ui.js';

test('Chuẩn bị MCQ Reading giữ phương pháp đã chốt, không thay bằng chỉ dẫn điền đáp án',()=>{
 const lesson={title:'Fixture',questionIds:['1'],totalMs:1200000,groups:[{kind:'mcq',label:'Multiple Choice',instruction:'Choose one letter.'}]};
 const html=prepHtml(lesson,null,'reading',()=>'',()=> '');
 for(const text of ['Đọc câu hỏi, định vị','Tự nén ý cần tìm','Loại ý sai đối tượng'])assert.ok(html.includes(text),text);
});

test('Summary giữ câu ngữ cảnh không có số, ô gốc và đáp án nháp sau dựng lại',()=>{
 const group={id:'summary',kind:'summary',label:'Summary',instruction:'ONE WORD ONLY',summaryTitle:'A new library',summaryParagraphs:['The library opens after renovation. It uses {{24}} on the roof.','Unnumbered context remains visible. The walls use {{25}}.'],questions:[{n:24,text:'Roof material'},{n:25,text:'Wall material'}]};
 const html=groupsHtml([group],{answers:{24:'grass',25:'wood'}},n=>`<button aria-label="Đánh dấu câu ${n}">⚑</button>`);
 for(const text of ['The library opens after renovation.','Unnumbered context remains visible.','ONE WORD ONLY','value="grass"','value="wood"'])assert.ok(html.includes(text),text);
 for(const n of [24,25])assert.equal(html.split(`id="answer-${n}"`).length-1,1);
 assert.equal(html.includes('{{'),false);
});

test('Phương pháp của bài mới có trước Bắt đầu, không cần cấp câu hỏi/key',()=>{
 const lesson={title:'Fixture',questionIds:['14'],totalMs:1200000,groups:[{id:'information',kind:'matching',label:'Matching Information'}],preparationMethods:{information:['Định vị ý theo nghĩa rồi kiểm lại đoạn.']}};
 const html=prepHtml(lesson,null,'reading',()=>'',()=> '');
 assert.ok(html.includes('Định vị ý theo nghĩa rồi kiểm lại đoạn.'));
});

test('Popup bài mới có nút tới từng đoạn dẫn chứng và đủ toàn bài',()=>{
 const lesson={lesson:91,title:'Fixture',questionIds:['1'],groups:[{start:1,end:1,label:'Matching Endings'}]};
 const paragraph=text=>({runs:[{text}]});
 const e={answer:['A'],kind:'endings',prompt:paragraph('Statement'),reason:[paragraph('Full reasoning')],evidenceGroups:[
  {paragraph:'A',speaker:'Expert 1',paragraphs:[paragraph('First view')],marks:[{start:0,end:10,background:'#fff2cc'}]},
  {paragraph:'C',speaker:'Expert 2',paragraphs:[paragraph('Other view')],marks:[{start:0,end:10,background:'#d9ead3'}]}]};
 const data={definition:{passage:{A:'First view',B:'Unselected full paragraph',C:'Other view'}},explanations:{entries:{1:e}}};
 const html=dialogHtml(lesson,data,{answers:{1:'B'},result:{rows:[{number:1,state:'incorrect'}]}},1,ps=>(ps||[]).map(p=>p.runs.map(r=>r.text).join('')).join(''));
 for(const paragraph of ['A','C'])assert.ok(html.includes(`data-evidence-paragraph="${paragraph}"`),'Thiếu lối tới đoạn '+paragraph);
 for(const text of ['Unselected full paragraph','Expert 1','Expert 2','Full reasoning'])assert.ok(html.includes(text),'Thiếu '+text);
});

// Một tờ ghi chú phải giữ đủ ô, thứ tự và các gốc Highlight/Note cũ.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as ui from '../listening-practice/authored-ui.js';
const groups=[
 {id:'definition',kind:'completion',label:'Definition',start:31,end:32,instruction:'Write ONE WORD ONLY.',questions:[31,32].map(n=>({n,text:`Source statement ${n} {blank} remains complete.`}))},
 {id:'examples',kind:'completion',label:'Examples of inclusive design',start:33,end:36,instruction:'Write ONE WORD ONLY.',questions:[33,34,35,36].map(n=>({n,text:`Source statement ${n} {blank} remains complete.`}))},
 {id:'impact',kind:'completion',label:'Impact of non-inclusive designs',start:37,end:40,instruction:'Write ONE WORD ONLY.',introduction:'Access\nLoss of independence for disabled people.',questions:[37,38,39,40].map(n=>({n,text:`Source statement ${n} {blank} remains complete.`}))}
];
test('Gộp được ghi chú liên tục cùng chỉ dẫn; giữ nguyên dữ liệu nguồn',()=>{
 const before=JSON.stringify(groups);assert.equal(typeof ui.isNoteDocument,'function');assert.equal(ui.isNoteDocument(groups),true);assert.equal(JSON.stringify(groups),before);
});
test('Không gộp dạng khác, bảng khác, câu không liên tục hoặc giới hạn từ khác',()=>{
 assert.equal(typeof ui.isNoteDocument,'function');
 for(const changed of [{...groups[1],kind:'mcq'},{...groups[1],options:[{value:'A',text:'Choice'}]},{...groups[1],table:{headers:['A'],rows:[]}},{...groups[1],start:34},{...groups[1],instruction:'Write TWO WORDS.'}])assert.equal(ui.isNoteDocument([groups[0],changed]),false);
});
test('Fixture vẫn có đúng mười ô và chữ hai bên mỗi ô',()=>{
 const html=ui.groupsHtml(groups,{answers:{31:'draft'}},n=>`<button data-flag="${n}">Flag ${n}</button>`);
 for(let n=31;n<=40;n++){assert.equal(html.split(`id="answer-${n}"`).length-1,1);assert.ok(html.includes(`Source statement ${n} `));}
 assert.ok(html.includes('Loss of independence for disabled people.'));assert.ok(html.includes('value="draft"'));
});

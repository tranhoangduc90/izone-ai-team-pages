// Kiểm lựa chọn Nối cặp giữ đúng mã, không đổi khóa đáp án khi học viên ghép thử.
import test from 'node:test';
import assert from 'node:assert/strict';
import {matchingMarkup,toDefinition} from './editor-bridge.mjs';
import {grade} from './model.mjs';
const pairs=[{left:'increase',right:'tăng'},{left:'decrease',right:'giảm'},{left:'remain stable',right:'giữ nguyên'}];
test('Mỗi vế trái có ô chọn vế phải, ban đầu không tự chọn đúng và chữ được thoát HTML',()=>{
 const html=matchingMarkup([{left:'<increase>',right:'tăng & tăng'},...pairs.slice(1)]);
 assert.equal((html.match(/<select /g)||[]).length,3);
 assert.equal((html.match(/Chọn vế phải/g)||[]).length,3);
 assert.ok(!html.includes(' selected'));assert.ok(!html.includes('data-item='));
 assert.ok(html.includes('&lt;increase&gt;'));assert.ok(html.includes('tăng &amp; tăng'));
});
test('Cùng bộ hiển thị cho preview và học viên, giữ lựa chọn 0 và mã riêng từng cặp',()=>{
 const preview=matchingMarkup(pairs,{value:{0:'1',1:'',2:'0'}});
 const student=matchingMarkup(pairs,{itemId:'q"x',value:{0:'1',1:'',2:'0'}});
 assert.equal((student.match(/data-item="q&quot;x"/g)||[]).length,3);
 assert.equal((student.match(/data-pair-index=/g)||[]).length,3);
 assert.equal((student.match(/ selected/g)||[]).length,2);
 assert.equal(preview.replace(/data-preview-pair="(\d+)"/g,'PAIR=$1'),student.replace(/data-item="q&quot;x" data-pair-index="(\d+)"/g,'PAIR=$1'));
});
test('Xuất bản và chọn cặp không thay thứ tự khóa: đúng, sai, thiếu đều chấm theo cặp gốc',()=>{
 const form={title:'Phiếu giả',sections:[],questions:[{id:'pair',type:'matching',purpose:'practice',skill:'reading',prompt:'Nối cặp',pairs:structuredClone(pairs)}]};
 const {definition,keys}=toDefinition(form),before=JSON.stringify({definition,keys});
 for(const [answer,score] of [[{0:'0',1:'1',2:'2'},1],[{0:'1',1:'0',2:'2'},0],[{0:'0',1:'1'},0],[{},0]]){
  matchingMarkup(pairs,{value:answer});const result=grade(definition,{pair:answer},keys)[0];assert.equal(result.scoreEarned,score);assert.equal(result.maxScore,1);
 }
 assert.equal(JSON.stringify({definition,keys}),before);assert.deepEqual(form.questions[0].pairs,pairs);
});

// Đề Note Completion có chữ sau ô trống; kiểm học viên thấy nguyên câu và ô nhập đúng vị trí.
import test from 'node:test';
import assert from 'node:assert/strict';
import {groupsHtml,prepHtml} from '../listening-practice/authored-ui.js';

test('Note Completion giữ ô trống trước problems và không hiện ký hiệu bản soạn',()=>{
 const group={id:'definition',kind:'completion',label:'Definition',instruction:'Write ONE WORD ONLY.',questions:[{n:32,text:'people with {blank} problems.'}]};
 const html=groupsHtml([group],{answers:{32:'example'}},()=>'<button>⚑</button>');
 assert.ok(!html.includes('{blank}'));
 assert.match(html,/people with[\s\S]*data-answer="32"[\s\S]*problems\./);
 assert.equal((html.match(/data-answer="32"/g)||[]).length,1);
});

test('Note Completion giữ ghi chú không đánh số và phương pháp từ nguồn, escape dữ liệu',()=>{
 const group={id:'impact',kind:'completion',label:'Impact',instruction:'ONE WORD ONLY',introduction:'Access\nLoss of independence for disabled people.',preparationSteps:['Đọc giới hạn từ.','Đoán loại từ <script>.'],questions:[{n:40,text:'The {blank} in offices is often too low.'}]};
 assert.ok(groupsHtml([group],{answers:{}},()=> '').includes('Loss of independence for disabled people.'));
 const html=prepHtml({questionIds:['40'],audioMs:1000,reviewMs:120000,groups:[group]},null,'listening',()=>'',()=> '');
 assert.ok(html.includes('Đọc giới hạn từ.'));
 assert.ok(html.includes('&lt;script&gt;'));
});

test('Màn chuẩn bị có phương pháp ngay từ metadata, trước khi được cấp đề',()=>{
 const lesson={questionIds:['31'],audioMs:486322,reviewMs:120000,preparationSteps:['Đọc lướt chỗ trống.','Xác định loại từ.'],groups:[{kind:'completion',label:'Definition',start:31,end:31}]};
 const html=prepHtml(lesson,null,'listening',()=>'',()=> '');
 assert.ok(html.includes('Đọc lướt chỗ trống.'));
 assert.ok(html.includes('Xác định loại từ.'));
 assert.ok(!html.includes('Đọc chỉ dẫn của nhóm câu trước khi trả lời.'));
});

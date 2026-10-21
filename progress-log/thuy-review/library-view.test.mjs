// Kiểm danh mục và bộ lọc bằng dữ liệu nhỏ, không ghi vào lớp thật.
import test from 'node:test';
import assert from 'node:assert/strict';
import {libraryEntries,filterLibraryEntries} from './model.mjs';

const session=(number,title,skills)=>({number,title,date:'2026-10-19',retired:[],definition:{blocks:[{items:skills.map((skill,n)=>({itemVersionId:String(n),skillCodes:[skill]}))}]}});
const privateForm={id:'own',title:'Ôn Speaking',status:'draft',revision:1,questions:[{skill:'speaking'},{skill:'general'}]};
test('Kho phân biệt phiếu đã dùng và bài riêng, kỹ năng theo câu thay vì đoán tên',()=>{
 const entries=libraryEntries([session(10,'Writing và Listening',['writing','listening','speaking'])],[privateForm]);
 assert.deepEqual(entries.map(e=>[e.source,e.count,e.skills]),[['used',3,['writing','listening','speaking']],['mine',2,['speaking','general']]]);
 assert.equal(filterLibraryEntries(entries,{skill:'speaking'}).length,2);
 assert.deepEqual(filterLibraryEntries(entries,{source:'mine',skill:'general'}).map(e=>e.title),['Ôn Speaking']);
});
test('Tìm tên kết hợp nhóm và kỹ năng, khoảng trắng và Unicode tiếng Việt',()=>{
 const sessions=[session(10,'ÔN WRITING 4',['writing']),session(9,'ÔN READING 2 + WRITING 4',['reading','writing']),session(8,'READING 2',['reading'])];
 const before=JSON.stringify(sessions),entries=libraryEntries(sessions,[privateForm]);
 assert.deepEqual(filterLibraryEntries(entries,{source:'used',skill:'writing',query:'  reading  '}).map(e=>e.session.number),[9]);
 assert.equal(filterLibraryEntries(entries,{query:'ÔN'.normalize('NFD')}).length,3);
 assert.equal(filterLibraryEntries(entries,{source:'mine',skill:'writing'}).length,0);
 assert.equal(JSON.stringify(sessions),before);
});
test('Thay bài nhiều lần vẫn xem và sao chép phiếu gốc lần đầu trong kho',()=>{
 const s=session(10,'Bài thay thế lần hai',['speaking']);
 s.retired=[{title:'Phiếu gốc',definition:session(10,'',['writing']).definition,answerKey:{a:{expectedOptionId:'A'}}},{title:'Bài thay thế lần một',definition:session(10,'',['reading']).definition}];
 const entry=libraryEntries([s],[])[0];
 assert.equal(entry.title,'Phiếu gốc');assert.equal(entry.session.number,10);assert.equal(entry.session.date,s.date);
 assert.deepEqual(entry.skills,['writing']);assert.deepEqual(entry.session.answerKey,{a:{expectedOptionId:'A'}});
 assert.equal(s.title,'Bài thay thế lần hai');assert.deepEqual(filterLibraryEntries([entry],{skill:'reading'}),[]);
});
test('Nháp chưa có câu không bị tự gán kỹ năng hoặc thêm bài mẫu',()=>{
 assert.deepEqual(libraryEntries([],[]),[]);
 const entries=libraryEntries([],[{id:'empty',title:'Nháp',questions:[]}]);
 assert.deepEqual(entries[0].skills,[]);assert.equal(filterLibraryEntries(entries,{source:'mine'}).length,1);
 assert.equal(filterLibraryEntries(entries,{skill:'general'}).length,0);
});

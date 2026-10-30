import test from 'node:test';
import assert from 'node:assert/strict';
import {collectPublishIssues,schemaFieldIssues} from '../progress-log/authoring-validation.js';
import {currentLibraryRows} from '../progress-log/teacher-form-library.js';
import {publishedSpeakingComments} from '../progress-log/thuy-live/course-skills.js';
import {AI_IMPORT_EXAMPLE} from '../progress-log/ai-import-example.js';

test('Thẻ 22: cùng phiếu chọn đúng head, giữ hai đích giao riêng và không chọn snapshot cũ',()=>{
 const a={source:'personal',id:'snapshot-new',sourceDraftId:'root',title:'Mới'},old={...a,id:'snapshot-old',title:'Cũ'};
 const current={source:'personal',id:'head',worksheetId:'root',title:'Đang sửa'};
 assert.deepEqual(currentLibraryRows([a,old],[],[]),[a]);
 assert.deepEqual(currentLibraryRows([a,old],[current],[{source:'used',id:'delivery-1'},{source:'used',id:'delivery-2'}]),[current,{source:'used',id:'delivery-1'},{source:'used',id:'delivery-2'}]);
});
test('Thẻ 22: trả đủ vị trí lỗi, khảo sát không bị bắt key, mẫu AI đủ ba câu',()=>{
 const survey={itemVersionId:'s',prompt:'Phản hồi',skillCodes:['speaking'],graderType:'none',options:[]};
 const objective={itemVersionId:'a',prompt:'',skillCodes:[],graderType:'exact_option',options:[{id:'A',label:''}]};
 const definition={title:'',blocks:[{blockId:'b',title:'Phần 1',items:[survey,objective]}]};
 const issues=collectPublishIssues({definition,gradingKey:{items:{}}});
 assert.deepEqual(issues.map(i=>[i.field,i.itemVersionId,i.optionId]),[['title',undefined,undefined],['courseCode',undefined,undefined],['prompt','a',undefined],['skillCodes','a',undefined],['option','a','A'],['answer','a',undefined]]);
 assert.ok(!issues.some(i=>i.itemVersionId==='s'));
 assert.equal(schemaFieldIssues([{path:['blocks',0,'items',1,'options',0,'label'],message:'Thiếu'}],definition)[0].optionId,'A');
 assert.match(AI_IMPORT_EXAMPLE,/Câu 1:/u);assert.match(AI_IMPORT_EXAMPLE,/Câu 2 \(Writing Style\)/u);assert.match(AI_IMPORT_EXAMPLE,/Câu 3\./u);assert.equal((AI_IMPORT_EXAMPLE.match(/Đáp án: B/gu)||[]).length,2);
});
test('Thẻ 23: mọi buổi đã công bố, buổi mới trước và một nhận xét hiện hành mỗi buổi',()=>{
 const session=(number,text)=>({number,students:[{studentRef:'a',publishedFeedback:text}]});
 const course={sessions:[session(1,'Đầu khóa'),session(3,'Mới nhất\nNội dung đầy đủ'),session(2,''),session(1,'Bản lặp không lấy')]};
 assert.deepEqual(publishedSpeakingComments(course,'a'),[{sessionNumber:3,text:'Mới nhất\nNội dung đầy đủ'},{sessionNumber:1,text:'Đầu khóa'}]);
 assert.deepEqual(publishedSpeakingComments(course,'khác'),[]);
});

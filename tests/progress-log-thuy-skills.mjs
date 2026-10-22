// Dữ liệu giả kiểm việc phân biệt số tự báo, điểm Test, nháp và số 0 hợp lệ.
import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSkillCourse,skillReports,testRecords} from '../progress-log/thuy-live/course-skills.js';
import {priority} from '../progress-log/thuy-review/model.mjs';
const person={studentRef:'a',name:'Tên trùng',cells:[{sessionNumber:8,testResult:{title:'Mini Test',listening:{correct:40,total:40},writing:{score:0}}}]};
const other={studentRef:'b',name:'Tên trùng',cells:[]};
const overview={classId:'1294',sessions:[1,2,3,4,5,6].map(sessionNumber=>({sessionNumber})),students:[person,other]};
function form(sessionNumber,correct,{final=true,total=10}={}){
 const itemVersionId='score-'+sessionNumber;
 return {sessionNumber,definition:{blocks:[{items:[{itemVersionId,interactionType:'number_score',skillCodes:['listening']}]}]},
  dashboard:{students:[{...person,submissionId:final?'s'+sessionNumber:null},{...other,submissionId:null}]},
  live:{students:[{studentRef:'a',submissionId:final?'s'+sessionNumber:null,finalResponses:final?{[itemVersionId]:{correct,total}}:{},draftResponses:{[itemVersionId]:{correct:10,total:10}}}]}};
}
test('Thủy kỹ năng: chỉ số tự báo đã nộp, đúng người; không dùng nháp hoặc điểm Mini Test thay vào TB',()=>{
 const course=buildSkillCourse(overview,[form(1,0),form(2,4),form(3,5),form(4,10,{final:false})]);
 const reports=skillReports(course,'a','listening');assert.deepEqual(reports.map(r=>r.percent),[0,40,50]);
 assert.equal(priority(reports).recentAverage,30);assert.equal(priority(reports).flagged,true);
 assert.deepEqual(skillReports(course,'b','listening'),[]);assert.deepEqual(skillReports(course,'a','reading'),[]);
 assert.equal(testRecords(person)[0].writing.score,0);
});
test('Thủy kỹ năng: chỉ ba buổi gần nhất, thiếu không thành 0; đủ 60% không gắn nhãn',()=>{
 const course=buildSkillCourse(overview,[form(1,1),form(2,2),form(3,2),form(4,6),form(5,6),form(6,6)]),result=priority(skillReports(course,'a','listening'));
 assert.ok(result.average<60);assert.equal(result.recentAverage,60);assert.equal(result.flagged,false);
 assert.equal(priority(skillReports(buildSkillCourse(overview,[form(1,0),form(2,0)]),'a','listening')).flagged,false);
});
test('Thủy kỹ năng: dữ liệu tự báo không hợp lệ không được chuyển thành một tỷ lệ',()=>{
 for(const [correct,total] of [[11,10],[-1,10],[0,0],['5',10]])assert.deepEqual(skillReports(buildSkillCourse(overview,[form(1,correct,{total})]),'a','listening'),[]);
});

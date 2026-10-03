import {sessionHeading} from '../progress-log/session-presentation.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../progress-log/teacher.js',import.meta.url),'utf8');
const code=source.slice(source.indexOf('function currentJourneyPlanDates('),source.indexOf('async function loadDashboard('));
function node(tag='div') {
  return {tag,children:[],dataset:{},value:'',textContent:'',disabled:false,
    append(...items){for(const item of items){item.parentElement=this;this.children.push(item);}},
    replaceChildren(...items){this.children=items;},addEventListener(){},
    matches(selector){return selector.startsWith(this.tag);},
    querySelectorAll(selector){return this.children.flatMap(x=>[...(x.tag===selector.split('[')[0]?[x]:[]),...x.querySelectorAll(selector)]);}};
}
function fixture() {
  const elements=Object.fromEntries(['assignmentSelect','journeyPlanTests','journeyPlanTotal','journeyPlanDates','journeyPlanStatus'].map(k=>[k,node()]));
  elements.assignmentSelect.value='assignment';elements.journeyPlanTests.value='';elements.journeyPlanTotal.value=3;
  const state={journeyPlanDateDraft:new Map(),journeyPlanAssignmentId:'assignment',journeyErpScheduleAssignmentId:'assignment',journeyPlan:{sessionDates:[]},
    journeyErpSchedule:{sessions:[
      {erpSessionId:'11',erpSessionNumber:1,numberSource:'teacher_confirmed',date:'2026-09-14',startsAt:'2026-09-14 18:30:00',proposalEligible:true},
      {erpSessionId:'12',erpSessionNumber:2,numberSource:'teacher_confirmed',date:'2026-09-17',startsAt:'2026-09-17 18:30:00',proposalEligible:true},
      {erpSessionId:'13',erpSessionNumber:3,numberSource:'proposal',date:'2026-09-21',startsAt:'2026-09-21 18:30:00',proposalEligible:true}
    ],assignmentSessionNumbers:[1]}};
  const context={sessionHeading,state,elements,document:{createElement:node}};vm.createContext(context);vm.runInContext(code,context);
  return {state,elements,run:expression=>vm.runInContext(expression,context)};
}
test('E01: mỗi buổi chỉ có một dropdown, nhãn thứ/ngày/số buổi không giờ hoặc mã dòng',()=>{
  const ui=fixture();ui.run('renderJourneyPlanDateInputs(3, [])');
  assert.equal(ui.elements.journeyPlanDates.querySelectorAll('input').length,0);
  assert.equal(ui.elements.journeyPlanDates.querySelectorAll('select').length,3);
  const labels=ui.elements.journeyPlanDates.children[1].children[1].children.map(x=>x.textContent);
  assert.ok(labels.includes('Buổi ERP 2 · T5 17/09/2026'));
  assert.ok(labels.every(x=>!x.includes('18:30')&&!x.includes('dòng 12')));
});
test('E03/E04: đề xuất chưa ghi bản chốt, giữ mốc và không ghép lịch thiếu/ngày trùng',()=>{
  const ui=fixture();
  ui.state.journeyPlan.sessionDates=[{sessionNumber:1,erpSessionId:'11',date:'2026-09-14'}];
  const proposed=ui.run('proposeJourneyPlanDates(3, state.journeyPlan.sessionDates, state.journeyErpSchedule)');
  assert.equal(proposed.dates.length,3);
  assert.equal(ui.state.journeyPlan.sessionDates.length,1);
  ui.state.journeyErpSchedule.sessions.pop();
  const shorter=ui.run('proposeJourneyPlanDates(3, state.journeyPlan.sessionDates, state.journeyErpSchedule)');
  assert.equal(shorter.dates.length,1);
  assert.match(shorter.message,/đối chiếu/);
});

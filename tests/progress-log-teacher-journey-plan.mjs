import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const source = await readFile(new URL('../progress-log/teacher.js', import.meta.url), 'utf8');
const start = source.indexOf('function currentJourneyPlanDates(');
const end = source.indexOf('async function loadDashboard(', start);
assert.ok(start >= 0 && end > start);

test('giảng viên xác nhận số buổi và Test của lớp qua dashboard', async () => {
  const assignmentId = '11111111-1111-4111-8111-111111111111';
  const elements = Object.fromEntries([
    'assignmentSelect', 'journeyPlanTotal', 'journeyPlanTests', 'journeyPlanDates',
    'journeyPlanForm', 'journeyPlanConflict', 'journeyPlanStatus', 'saveJourneyPlanButton',
    'loadJourneyErpScheduleButton', 'journeyErpScheduleStatus',
    'loadJourneyTestSourcesButton', 'journeyTestSourcesStatus', 'journeyPlanTestSources', 'journeyPlanDatesDetails'
  ].map(id => [id, { value: '', hidden: false, disabled: false,
    setCustomValidity() {}, reportValidity() {},replaceChildren() {} }]));
  elements.assignmentSelect.value = assignmentId;
  elements.journeyPlanDates.inputs = [];
  elements.journeyPlanDates.replaceChildren = (...rows) => {
    elements.journeyPlanDates.inputs = rows.map(row => row.children[1]);
    elements.journeyPlanDates.rows = rows;
  };
  elements.journeyPlanDates.querySelectorAll = () => elements.journeyPlanDates.inputs;
  elements.journeyPlanTestSources.replaceChildren = (...rows) => {
    elements.journeyPlanTestSources.selects = rows.map(row => row.children[1]);
  };
  elements.journeyPlanTestSources.querySelectorAll = () => elements.journeyPlanTestSources.selects || [];
  const state = {
    assignments:[{assignment_id:assignmentId,class_id:'123'}],journeyPlanDrafts:new Map(),
    journeyPlan: null, journeyPlanAssignmentId: '',
    journeyPlanGeneration: 0, journeyPlanDirty: false,
    journeyErpSchedule: null, journeyErpScheduleAssignmentId: '', journeyErpScheduleGeneration: 0,
    journeyTestSources: null, journeyTestSourcesAssignmentId: '', journeyTestSourcesGeneration: 0
  };
  const calls = [];
  const plan = {
    classId: '123', className: 'Lớp giả', highestKnownSession: 6,
    totalSessions: null, testSessionNumbers: [], revision: 0
  };
  const context = {
    AbortController, setTimeout, clearTimeout,
    elements, state, window: { confirm: () => true },
    document: { createElement: tag => ({
      tag, dataset: {}, children: [], append(...children) {
        for (const child of children) { child.parentElement = this; this.children.push(child); }
      },
      querySelector(selector) {
        return this.children.find(child => selector.startsWith(child.tag)) || null;
      },
      matches(selector) { return selector.startsWith(this.tag); }
      ,addEventListener() {}
    }) },
    setNotice: message => calls.push({ notice: message }),
    apiRequest: async (path, options) => {
      calls.push({ path, options });
      if (path.includes('/erp-schedule?')) return { schedule: {
        classId:'123',
        fingerprint: 'a'.repeat(64),
        sessions: [{ erpSessionId: '35811', erpSessionNumber: 2, numberSource: 'teacher_confirmed',
          startsAt: '2026-09-14 18:00:00', date: '2026-09-14' }]
      } };
      if (path.includes('/test-sources?')) return { sources: { tests: [
        { testSlug: 'mini-test-lesson-5', title: 'Mini Test',
          studentsWithResult: 3, classEvidence: 'result' },
        { testSlug: 'term-test-2', title: 'Term Test 2',
          studentsWithResult: 0, classEvidence: 'roster' }
      ] } };
      if (path.includes('?')) return { plan };
      return { plan: { ...plan, ...options.body, revision: 1, replayed: false } };
    }
  };
  const actions = vm.runInNewContext(source.slice(start, end)
    + '\n({ loadJourneyPlan, loadJourneyErpSchedule, loadJourneyTestSources, saveJourneyPlan, renderJourneyPlanDateInputs, renderJourneyTestSourceInputs, currentJourneyPlanDates, currentJourneyTestSources, onJourneyPlanDateInput, onJourneyPlanDateChange })', context);
  await actions.loadJourneyPlan();
  assert.equal(elements.journeyPlanTotal.value, 6);
  elements.journeyPlanTotal.value = '8';
  actions.renderJourneyPlanDateInputs(8, []);
  elements.journeyPlanDates.inputs[6].dataset.date = '2026-09-30';
  actions.renderJourneyPlanDateInputs(6, actions.currentJourneyPlanDates());
  actions.renderJourneyPlanDateInputs(8, actions.currentJourneyPlanDates());
  assert.equal(elements.journeyPlanDates.inputs[6].dataset.date, '2026-09-30');
  state.journeyPlanDirty = true;
  await actions.loadJourneyErpSchedule();
  assert.match(elements.journeyErpScheduleStatus.textContent, /1 buổi ERP/);
  const erpSelect = elements.journeyPlanDates.rows[1].children[1];
  erpSelect.value = '35811';
  actions.onJourneyPlanDateChange({ target: erpSelect });
  elements.journeyPlanDates.inputs[1].dataset.date = '2026-09-15';
  await actions.loadJourneyErpSchedule();
  assert.match(elements.journeyErpScheduleStatus.textContent, /1 buổi cần đối chiếu lại/);
  await actions.saveJourneyPlan({ preventDefault() {} });
  assert.match(elements.journeyPlanStatus.textContent, /không khớp lịch ERP/);
  assert.equal(calls.filter(call => call.path === '/teacher/journey-plan').length, 0);
  const refreshedSelect = elements.journeyPlanDates.rows[1].children[1];
  refreshedSelect.value = '35811';
  actions.onJourneyPlanDateChange({ target: refreshedSelect });
  assert.equal(elements.journeyPlanDates.inputs[1].dataset.date, '2026-09-14');
  assert.equal(elements.journeyPlanDates.inputs[1].value, '35811');
  refreshedSelect.value = '';
  actions.onJourneyPlanDateChange({ target: refreshedSelect });
  assert.equal(elements.journeyPlanDates.inputs[1].dataset.date, '');
  assert.equal(refreshedSelect.value, '');
  refreshedSelect.value = '35811';
  actions.onJourneyPlanDateChange({ target: refreshedSelect });
  elements.journeyPlanTests.value = '7, 5';
  actions.renderJourneyTestSourceInputs([]);
  await actions.loadJourneyTestSources();
  assert.match(elements.journeyTestSourcesStatus.textContent, /2 bài Test có thể ghép/);
  assert.match(elements.journeyPlanTestSources.selects[0].children[2].textContent,
    /đã có danh sách lớp, chưa có kết quả/);
  elements.journeyPlanTestSources.selects[0].value = 'mini-test-lesson-5';
  await actions.saveJourneyPlan({ preventDefault() {} });
  const saved = calls.find(call => call.path === '/teacher/journey-plan');
  assert.equal(saved.options.body.totalSessions, 8);
  assert.deepEqual(Array.from(saved.options.body.testSessionNumbers), [5, 7]);
  assert.deepEqual(Array.from(saved.options.body.testSources, item => ({
    sessionNumber: item.sessionNumber, testSlug: item.testSlug
  })), [{ sessionNumber: 5, testSlug: 'mini-test-lesson-5' }]);
  assert.deepEqual(Array.from(saved.options.body.sessionDates, item => ({
    sessionNumber: item.sessionNumber, date: item.date,
    erpSessionId: item.erpSessionId
  })), [
    { sessionNumber: 2, date: '2026-09-14', erpSessionId: '35811' },
    { sessionNumber: 7, date: '2026-09-30', erpSessionId: undefined }
  ]);
  assert.equal(state.journeyPlan.revision, 1);
  assert.equal(elements.journeyPlanForm.hidden, false);
});

import {WHOLE,available,vocabEligible} from '../shared/workflow.mjs';
import {TASK,REQUESTED_TASK} from './lesson-config.mjs';
export {TASK};
export const ACTIVITY = REQUESTED_TASK;
export const STATEMENT = TASK?.statement||'';
export const LABELS = {
  topicSentence: 'Topic Sentence', idea1: 'Idea 1', idea2: 'Idea 2',
  a1: 'A1 · Điểm đầu', x1: 'X1 · Cầu nối', b1: 'B1 · Điểm cuối',
  a2: 'A2 · Điểm đầu', x2: 'X2 · Cầu nối', b2: 'B2 · Điểm cuối',
  draft1: 'Draft 1', draft2: 'Draft 2',
};
export const SECTIONS = { topic: 'Ý tưởng & Topic Sentence', si1: 'Lập luận ý 1', si2: 'Lập luận ý 2', draft: 'Draft' };
export const STATUS = { draft: 'Chưa Check', revision: 'Cần sửa', passed: 'Đã thông qua', pending: 'Đang xử lý', technical_error: 'Lỗi xử lý' };
export const canOpen = (s, section) => ['topic', 'si1', 'si2'].includes(section)
  ? available(s, section) : ['summary', 'draft', 'result'].includes(section) && vocabEligible(s, 0)
    && (section !== 'result' || s.steps.draft.status === 'passed');
export const completeCount = s => ['topic', 'si1', 'si2'].filter(k => s.steps[k].status === 'passed').length;
export const wordCount = text => String(text || '').trim().split(/\s+/).filter(Boolean).length;

// Empty projection only; responses and all completion states come from Shops API.
export const PEOPLE = [];
export const VOCABULARY = [];
export function fixture(person) {
 const step=()=>({status:'draft',history:[],edited:false});
 const fields=[...Object.keys(LABELS),'body1_message','body1_idea1','body1_idea2','body2_message','body2_idea1','body2_idea2'];
 return {activity:ACTIVITY,workflowMode:WHOLE,workflowVersion:1,id:person.id,instance:crypto.randomUUID(),person,revision:0,updatedAt:new Date().toISOString(),responses:Object.fromEntries(fields.map(k=>[k,''])),bodyChoice:'body1',steps:{topic:step(),si1:step(),si2:step(),draft:step()},idea2Open:false,draft2Open:false,threads:[],events:[],view:'topic'};
}
export function dashboardState(s) {
  if (Object.values(s.steps).some(p => p.status === 'technical_error')) return 'error';
  if (s.threads.some(t => !t.resolved) || Object.values(s.steps).some(p => p.status === 'revision')) return 'support';
  if (s.steps.draft.status === 'passed' && !s.steps.draft.edited) return 'complete';
  if (Object.values(s.steps).some(p => p.status === 'pending')) return 'pending';
  if (!Object.values(s.responses).some(Boolean)) return 'fresh';
  return 'working';
}

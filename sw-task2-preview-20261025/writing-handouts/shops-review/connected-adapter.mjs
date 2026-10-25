import {fixture,ACTIVITY} from './model.mjs';
export const SECTION={topic:'topic_sentence',si1:'supporting_idea_1',si2:'supporting_idea_2',draft:'draft'};
export const FIELD={topicSentence:'topic_sentence',a1:'idea1_a',x1:'idea1_x',b1:'idea1_b',a2:'idea2_a',x2:'idea2_x',b2:'idea2_b',draft1:'draft1',draft2:'draft2'};
export const viewField=(field,body='body1')=>field===body+'_idea1'?'idea1':field===body+'_idea2'?'idea2':Object.keys(FIELD).find(k=>FIELD[k]===field)||field;
export const serverField=(field,body='body1')=>field==='idea1'?body+'_idea1':field==='idea2'?body+'_idea2':FIELD[field]||field;
const resultStatus=status=>status==='passed'?'passed':status==='needs_revision'?'revision':status==='queued'||status==='leased'?'pending':status==='technical_error'||status==='failed'?'technical_error':'draft';
export function viewResponses(responses){
 const body=responses.body_choice==='body2'?'body2':'body1';
 return {...responses,...Object.fromEntries(Object.entries(FIELD).map(([key,field])=>[key,responses[field]||''])),idea1:responses[body+'_idea1']||'',idea2:responses[body+'_idea2']||''};
}
export function connectedState(raw,person,threads=[]){
 if(raw.activitySlug!==ACTIVITY)throw Error('SESSION_ACTIVITY_MISMATCH');
 const s=fixture(person,'fresh'),ui=raw.ui?.data||{};
 const comments=raw.comments.map(c=>({...c,resultStatus:raw.attempts.find(a=>a.attemptRef===c.attemptRef)?.resultStatus||c.status}));
 Object.assign(s,{connected:true,id:person.id,instance:raw.sessionRef,sessionRef:raw.sessionRef,revision:raw.draftVersion,updatedAt:raw.updatedAt,bodyChoice:raw.responses.body_choice==='body2'?'body2':'body1',responses:viewResponses(raw.responses),idea2Open:!!ui.idea2Opened,draft2Open:Object.hasOwn(ui,'draft2Open')?!!ui.draft2Open:!!raw.responses.draft2,vocabStatus:'pending',vocabularyGroups:{},raw});
 for(const [key,section] of Object.entries(SECTION)){
  const state=raw.sections[section]||{},attempts=raw.attempts.filter(a=>a.section===section),latest=attempts[0];
  const history=comments.filter(c=>c.section===section&&['passed','needs_revision'].includes(c.resultStatus)).map(c=>({status:resultStatus(c.resultStatus),at:c.createdAt,feedback:c.feedback,snapshot:viewResponses(attempts.find(a=>a.attemptRef===c.attemptRef)?.snapshot||{}),attemptRef:c.attemptRef}));
  s.steps[key]={status:resultStatus(state.status),history,submitted:!!attempts.length,attemptCount:attempts.length,edited:(ui.editedFields||[]).some(f=>Object.entries(FIELD).some(([alias,actual])=>actual===f&&alias.endsWith(key.slice(-1)))||(key==='topic'&&(f==='topic_sentence'||f.startsWith(s.bodyChoice+'_idea')))),approval:ui.approvals?.[section]||null};
  if(latest?.status==='failed'&&!state.locked)s.steps[key].status='technical_error';
  if(key==='draft'&&state.locked){const old=attempts.find(a=>a.status==='completed'&&a.resultStatus==='passed');s.steps[key].edited=!!old&&['draft1','draft2'].some(f=>old.snapshot?.[f]!==raw.responses[f]);}
  if(['queued','leased'].includes(latest?.status))s.steps[key].job={id:latest.attemptRef};
 }
 if(raw.ui?.version==='legacy-v1')s.idea2Open=s.steps.si1.status==='passed'||!!raw.responses.idea2_a;
 // Chỉ dùng định danh A1/X1/B1/A2/X2/B2 do artifact khai báo; không ghép theo thứ tự mảng.
 const vocabulary=comments.toReversed().find(c=>c.section==='supporting_idea_2'&&c.resultStatus==='passed'&&c.artifacts?.vocabulary)?.artifacts.vocabulary;
 if(Array.isArray(vocabulary)){
  for(const row of vocabulary){
   const point=String(row.point||row.key||row.idea||'').toUpperCase();
   if(!/^[AXB][12]$/.test(point))continue;
   s.vocabularyGroups[point]=(row.terms||[]).map(term=>typeof term==='string'?{phrase:term,meaningVi:''}:{phrase:term.phrase||'',meaningVi:term.meaningVi||''}).filter(t=>t.phrase);
  }
  s.vocabStatus=Object.keys(s.vocabularyGroups).length===6?'ready':'failed';
 }
 if(raw.uiVocabulary&&raw.uiVocabulary.status!=='missing'){
  s.vocabStatus=raw.uiVocabulary.status==='completed'?'ready':raw.uiVocabulary.status==='failed'?'failed':'pending';
  if(s.vocabStatus==='ready')s.vocabularyGroups=raw.uiVocabulary.groups;
 }
 s.threads=threads.map(t=>({id:t.threadRef,field:viewField(t.fieldKey,s.bodyChoice),quote:t.anchor?.quote||'',source:t.anchor?.detached?'Bản trước: '+(t.anchor?.quote||''):s.responses[viewField(t.fieldKey,s.bodyChoice)],resolved:t.status==='addressed',messages:t.messages.map(m=>({actor:m.authorRole,text:m.body,at:m.createdAt}))}));
 s.events=[...(raw.uiEvents||[]).map(e=>({id:e.id,text:e.kind,at:e.at,kind:'student_updated',event_at:e.at})),...raw.attempts.map(a=>({id:a.attemptRef,kind:a.status==='completed'?'job_completed':a.status==='failed'?'job_failed':'job_queued',job_ref:a.attemptRef,event_at:a.completedAt||a.createdAt,section:Object.keys(SECTION).find(k=>SECTION[k]===a.section),snapshot:viewResponses(a.snapshot||{}),feedback:comments.find(c=>c.attemptRef===a.attemptRef)?.feedback||'',status:resultStatus(a.resultStatus||a.status)}))].sort((a,b)=>Date.parse(b.event_at)-Date.parse(a.event_at));
 return s;
}

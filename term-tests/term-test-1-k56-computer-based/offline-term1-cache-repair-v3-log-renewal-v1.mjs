import {Term1Offline as Previous} from './offline-term1-parallel-entry-v1-log-renewal-v1.mjs';
export {BUILD,canonical,hash,ExamStore,exportHtml} from './offline-term1-parallel-entry-v1-log-renewal-v1.mjs';
export class Term1Offline extends Previous {
 acceptOfficialProgress(progress,onlySkill=null){
  if(progress&&!onlySkill&&this.record){
   progress={...progress};
   for(const [skill,section] of Object.entries(this.record.sections)){
    // Resume cannot tell our unacknowledged commit from another profile's seal.
    // Status must read its receipt or an explicit conflict before discarding it.
    if(section.operationId&&this.record.operations.some(op=>op.operationId===section.operationId
      &&(op.kind==='seal'||op.kind==='interrupt')))delete progress[skill];
   }
  }
  return super.acceptOfficialProgress(progress,onlySkill);
 }
}

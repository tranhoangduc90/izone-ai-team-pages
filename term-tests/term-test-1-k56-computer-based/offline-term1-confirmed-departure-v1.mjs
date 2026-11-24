import {Term1Offline as Base} from './offline-term1-cache-repair-v3-log-renewal-v1.mjs';
import {withExamDeparture} from '../k56-offline-shared/exam-departure-v1.mjs';

export {BUILD,canonical,hash,ExamStore,exportHtml} from './offline-term1-cache-repair-v3-log-renewal-v1.mjs';
export const Term1Offline = withExamDeparture(Base, {taskId:'task2'});

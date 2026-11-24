import {OfflineRuntime as Base} from './offline-mini-browser-cloud-v1.mjs';
import {withExamDeparture} from '../k56-offline-shared/exam-departure-v1.mjs';

export {BUILD,canonical,hash,ExamStore,exportHtml} from './offline-mini-browser-cloud-v1.mjs';
export const OfflineRuntime = withExamDeparture(Base, {taskId:'task2'});

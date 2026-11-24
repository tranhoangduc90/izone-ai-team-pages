import {Term2Offline as Base} from './offline-term2-export-v2-log-renewal-v1.mjs';
import {withProtectedListening} from '../k56-offline-shared/listening-continuity-protected-v2.mjs';

export {ExamStore} from './offline-term2-export-v2-log-renewal-v1.mjs';
export const Term2Offline = withProtectedListening(Base);

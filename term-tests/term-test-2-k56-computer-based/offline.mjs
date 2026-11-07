import {createOfflineRuntime} from '../k56-offline-shared/runtime.mjs';
import {TERM2_PROFILE} from '../k56-offline-shared/profiles.mjs';
const runtime=createOfflineRuntime(TERM2_PROFILE);
export const {BUILD,canonical,hash,ExamStore,exportHtml}=runtime;
export const Term2Offline=runtime.OfflineRuntime;

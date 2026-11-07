import {createOfflineRuntime} from '../k56-offline-shared/runtime.mjs?v=20261107-k56-r2-v1';
import {TERM2_PROFILE} from '../k56-offline-shared/profiles.mjs';
const runtime=createOfflineRuntime(TERM2_PROFILE);
export const {BUILD,canonical,hash,ExamStore,exportHtml}=runtime;
export const Term2Offline=runtime.OfflineRuntime;

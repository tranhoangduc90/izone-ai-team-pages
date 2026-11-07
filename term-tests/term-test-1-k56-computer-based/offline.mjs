import {createOfflineRuntime} from '../k56-offline-shared/runtime.mjs';
import {TERM1_PROFILE} from '../k56-offline-shared/profiles.mjs';
const runtime=createOfflineRuntime(TERM1_PROFILE);
export const {BUILD,canonical,hash,ExamStore,exportHtml}=runtime;
export const Term1Offline=runtime.OfflineRuntime;

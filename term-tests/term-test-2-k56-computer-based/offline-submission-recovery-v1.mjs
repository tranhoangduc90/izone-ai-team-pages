import {createOfflineRuntime,withListeningContinuity} from '../k56-offline-shared/runtime-term-submission-recovery-v1.mjs?v=20261107-k56-r2-v1';
import {TERM2_PROFILE} from '../k56-offline-shared/profiles.mjs';
const runtime=createOfflineRuntime(TERM2_PROFILE);
export const {BUILD,canonical,hash,ExamStore,exportHtml}=runtime;
export const Term2Offline=withListeningContinuity(runtime.OfflineRuntime);

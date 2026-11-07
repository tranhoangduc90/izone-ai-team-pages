import {createOfflineRuntime} from '../k56-offline-shared/runtime.mjs?v=20261107-mini-v3';
import {MINI_PAPER_PROFILE} from '../k56-offline-shared/profiles.mjs?v=20261107-mini-v1';
const runtime=createOfflineRuntime(MINI_PAPER_PROFILE);
export const {BUILD,ExamStore,OfflineRuntime,exportHtml}=runtime;

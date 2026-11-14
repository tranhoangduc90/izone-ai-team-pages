import {createOfflineRuntime} from '../k56-offline-shared/runtime-recovery-v1.mjs?journalAudio=20261114-mini-journal-v1&v=20261112-k56-submission&audioSeal=20261113-v1';
import {MINI_PAPER_PROFILE} from '../k56-offline-shared/profiles.mjs?v=20261107-mini-v1';
const runtime=createOfflineRuntime(MINI_PAPER_PROFILE);
export const {BUILD,ExamStore,OfflineRuntime,exportHtml}=runtime;

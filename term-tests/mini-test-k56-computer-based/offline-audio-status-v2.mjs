import {createOfflineRuntime,withListeningContinuity} from '../k56-offline-shared/runtime-recovery-v1.mjs?journalAudio=20261114-mini-journal-v1&v=20261107-mini-v3&miniAudio=20261108-v1&audioSeal=20261113-v1';
import {MINI_CBT_PROFILE} from '../k56-offline-shared/profiles.mjs?v=20261107-mini-v1';
const runtime=createOfflineRuntime(MINI_CBT_PROFILE);
export const {BUILD,ExamStore,exportHtml}=runtime;
export const OfflineRuntime=withListeningContinuity(runtime.OfflineRuntime);

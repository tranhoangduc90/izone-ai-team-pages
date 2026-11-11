import {createOfflineRuntime,withListeningContinuity} from '../k56-offline-shared/runtime-audio-status-v2.mjs?v=20261107-mini-v3&miniAudio=20261108-v1';
import {MINI_CBT_PROFILE} from '../k56-offline-shared/profiles.mjs?v=20261107-mini-v1';
const runtime=createOfflineRuntime(MINI_CBT_PROFILE);
export const {BUILD,ExamStore,exportHtml}=runtime;
export const OfflineRuntime=withListeningContinuity(runtime.OfflineRuntime);

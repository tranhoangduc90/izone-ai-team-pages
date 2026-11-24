import { ASSETS, ASSET_HASHES, ASSET_BUILD_ID } from './offline-assets-student-cache-v3-confirmed-departure-v1.mjs';
import { registerExamShell } from '../k56-offline-shared/worker-audio-status-v2-confirmed-departure-v1.mjs';

registerExamShell({
  build: 'pretest-lesson-16-k67-paper-v1',
  assets: ASSETS,
  hashes: ASSET_HASHES,
  assetBuildId: ASSET_BUILD_ID
});

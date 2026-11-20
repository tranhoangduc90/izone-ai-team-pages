import { ASSETS, ASSET_HASHES, ASSET_BUILD_ID } from './offline-assets-student-cache-v2.mjs';
import { registerExamShell } from './worker-student-cache-v2.mjs';
registerExamShell({ build: 'mini-k67-paper-offline-v1', assets: ASSETS, hashes: ASSET_HASHES, assetBuildId: ASSET_BUILD_ID });

import {ASSETS,ASSET_HASHES,ASSET_BUILD_ID} from './offline-assets-audio-status-v1.mjs';
import {registerExamShell} from '../k56-offline-shared/worker-audio-status-v1.mjs';
registerExamShell({build:'term1-k56-skill-fallback-v1',assets:ASSETS,hashes:ASSET_HASHES,assetBuildId:ASSET_BUILD_ID});

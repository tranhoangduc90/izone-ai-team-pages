import {ASSETS,ASSET_HASHES,ASSET_BUILD_ID} from './offline-assets-skill-cloud-v1.mjs';
import {registerExamShell} from './worker-skill-cloud-v1.mjs';
registerExamShell({build:'term1-k56-skill-fallback-v1',assets:ASSETS,hashes:ASSET_HASHES,assetBuildId:ASSET_BUILD_ID});

import {ASSETS,ASSET_HASHES,ASSET_BUILD_ID} from './offline-assets-mini-demo-journal-v1.mjs';
import {registerExamShell} from './worker-mini-demo-journal-v1.mjs';
registerExamShell({build:'mini-k56-cbt-offline-v1',assets:ASSETS,hashes:ASSET_HASHES,assetBuildId:ASSET_BUILD_ID});

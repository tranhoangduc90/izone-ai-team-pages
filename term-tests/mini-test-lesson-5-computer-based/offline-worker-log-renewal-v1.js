import {ASSETS,ASSET_HASHES,ASSET_BUILD_ID} from './offline-assets-log-renewal-v1.mjs';
import {registerExamShell} from './shell-worker-log-renewal-v1.mjs';
registerExamShell({build:'mini-k67-cbt-shell-v1',assets:ASSETS,hashes:ASSET_HASHES,assetBuildId:ASSET_BUILD_ID});

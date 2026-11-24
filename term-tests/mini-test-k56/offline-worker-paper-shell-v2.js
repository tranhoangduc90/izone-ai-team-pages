import {ASSETS,ASSET_HASHES,ASSET_BUILD_ID} from './offline-assets-paper-shell-confirmed-departure-v1.mjs';
import {registerExamShell} from './worker-paper-shell-confirmed-departure-v1.mjs';

registerExamShell({build:'mini-k56-paper-offline-v1',assets:ASSETS,hashes:ASSET_HASHES,assetBuildId:ASSET_BUILD_ID});

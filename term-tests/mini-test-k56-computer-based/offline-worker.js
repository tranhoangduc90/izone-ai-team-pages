import {ASSETS,ASSET_HASHES,ASSET_BUILD_ID} from './offline-assets-legacy-audio-status-v1.mjs';
import {registerExamShell} from '../k56-offline-shared/worker-audio-status-v1.mjs';
registerExamShell({build:'mini-k56-cbt-offline-v1',assets:ASSETS,hashes:ASSET_HASHES,assetBuildId:ASSET_BUILD_ID,legacy:true});

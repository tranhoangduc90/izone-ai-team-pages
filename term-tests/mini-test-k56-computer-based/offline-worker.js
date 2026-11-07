import {ASSETS,ASSET_HASHES,ASSET_BUILD_ID} from './offline-assets.mjs?v=mini-k56-offline-v1';
import {registerExamShell} from '../k56-offline-shared/worker.mjs?v=mini-k56-offline-v1';
registerExamShell({build:'mini-k56-cbt-offline-v1',assets:ASSETS,hashes:ASSET_HASHES,assetBuildId:ASSET_BUILD_ID});

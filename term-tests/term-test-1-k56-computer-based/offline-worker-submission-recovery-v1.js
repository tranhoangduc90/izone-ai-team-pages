import {ASSETS,ASSET_HASHES,ASSET_BUILD_ID} from './offline-assets-submission-recovery-v1.mjs';
import {registerExamShell} from '../k56-offline-shared/worker-term-submission-recovery-v1.mjs';
registerExamShell({build:'term1-offline-20261107-v1',assets:ASSETS,hashes:ASSET_HASHES,assetBuildId:ASSET_BUILD_ID});

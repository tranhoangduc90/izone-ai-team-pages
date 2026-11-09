import { registerExamShell } from '../k56-offline-shared/worker.mjs?v=20261107-k56-r2-v1';
import { ASSETS, ASSET_HASHES, ASSET_BUILD_ID } from './offline-assets.mjs?v=20261110-continuity-v1';

registerExamShell({ build: 'term1-k56-skill-fallback-v1', assets: ASSETS,
  hashes: ASSET_HASHES, assetBuildId: ASSET_BUILD_ID });

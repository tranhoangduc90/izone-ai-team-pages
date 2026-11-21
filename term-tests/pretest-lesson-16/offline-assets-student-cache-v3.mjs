import { ASSETS as PREVIOUS_ASSETS, ASSET_HASHES as PREVIOUS_HASHES } from './offline-assets-audio-status-v5.mjs';

// Student cache is independent of the online teacher login module.
export const ASSETS = PREVIOUS_ASSETS.filter(asset => asset !== '../../shared/teacher-single-sign-on.js');
const worker = 'offline-worker-audio-status-v2.js';
const workerHash = '12c10f69dadaa8acd26250e24050d276355d86a76cf92caf2003f55ff331396f';
export const ASSET_HASHES = Object.fromEntries(
  ASSETS.map(asset => [asset, asset === worker ? workerHash : PREVIOUS_HASHES[asset]])
);
export const ASSET_BUILD_ID = 'bd594dc01007d5821b8d411ce8ca28debded7aafcc3bf9255a77b6b75fa232be';

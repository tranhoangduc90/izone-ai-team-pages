import { ASSETS as BASE, ASSET_HASHES as BASE_HASHES } from '../offline-assets-student-cache-v1.mjs';

const extra = {
  "bootstrap-term1-demo-journal-v1.js": "ea9c69cf80aeed206a123406025d27b64e773158c03fc1f2c07ea45ed93f387e",
  "demo-journal-v1/index.html": "ef2aecbb122234dd1ff326c1d463754edbf93bb64c02bdffcc9ade129659ad0c",
  "demo-journal-v1/offline.mjs": "2b214b763c74cb892b61abe796b9aca8b1763d877cd9a98379e85166d5417632",
  "demo-journal-v1/listening-preparation.mjs": "8803179aa45de9959506031c71a362a3235e46e31b511d681e4d7d95d8375189"
};
export const ASSETS = [...BASE, ...Object.keys(extra)];
export const ASSET_HASHES = { ...BASE_HASHES, ...extra };
export const ASSET_BUILD_ID = "d2f1433ef33795e5277e38dac44a1a6924453f878e36fcaf94d2389a608d91bf";

const recorderPairs = [
  ['../shared/exam-journal/recorder.mjs', '../shared/exam-journal/recorder-term1-k56-fallback-v1.mjs'],
  ['../shared/exam-journal/recorder-pretest-content-v1.mjs', '../shared/exam-journal/recorder-pretest-content-fallback-v1.mjs']
];

export function journalRecorderCache({assets, assetBuildId, url, verify}) {
  const pairs = new Map();
  for (const pair of recorderPairs) {
    for (const asset of pair) pairs.set(new URL(url(asset)).pathname, pair);
  }
  const requiredAssets = assets.filter(asset => !pairs.has(new URL(url(asset)).pathname));

  async function get(cache, path) {
    const pair = pairs.get(path);
    if (!pair) return null;
    const [canonical] = pair;
    for (const asset of pair) {
      try {
        const request = new URL(url(asset));
        request.searchParams.set('examBuild', assetBuildId);
        const response = await fetch(request, {cache:'reload', signal:AbortSignal.timeout(2000)});
        await verify(response, canonical);
        await cache.put(url(canonical), response.clone());
        return response;
      } catch {
        // Recording failures must leave the verified exam shell and submission outbox available.
      }
    }
    return null;
  }

  return {get, requiredAssets, handles:path => pairs.has(path)};
}

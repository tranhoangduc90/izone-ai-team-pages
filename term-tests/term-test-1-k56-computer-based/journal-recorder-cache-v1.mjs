const recorder = '../shared/exam-journal/recorder.mjs';
const alternate = '../shared/exam-journal/recorder-term1-k56-fallback-v1.mjs';

export function journalRecorderCache({assets, assetBuildId, url, verify}) {
  const paths = new Set([recorder, alternate].map(asset => new URL(url(asset)).pathname));
  const requiredAssets = assets.filter(asset => asset !== recorder && asset !== alternate);

  async function get(cache) {
    for (const asset of [recorder, alternate]) {
      try {
        const request = new URL(url(asset));
        request.searchParams.set('examBuild', assetBuildId);
        const response = await fetch(request, {cache:'reload', signal:AbortSignal.timeout(2000)});
        // The alternate must match the canonical recorder's hash before it can serve that URL.
        await verify(response, recorder);
        await cache.put(url(recorder), response.clone());
        return response;
      } catch {
        // Journal transport is independent of the verified exam shell and its submission outbox.
      }
    }
    return null;
  }

  return {get, requiredAssets, handles:path => paths.has(path)};
}

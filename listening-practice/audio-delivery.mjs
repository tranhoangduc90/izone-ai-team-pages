import {createPublicAudio} from '../shared/public-audio.mjs?v=20261024-cf512-1&journal=20261024-audio-v1';

const store = createPublicAudio({
  database: 'izone-listening-public-audio-v1',
  prefixes: ['/izone-ai-team-pages/listening-practice/audio-assets/']
});
export const AUDIO_MANIFEST_TYPE = 'application/vnd.izone.audio-manifest+json';
let completeAudio = null, memoryGeneration = 0;

// Keep one verified public file in this tab. Grants and identity are never cached.
export function clearListeningAudioMemory() {
  memoryGeneration++;
  completeAudio = null;
}

// Authorization stays on the existing API. Only verified MP3 bytes use Pages.
// An older API may still return the original audio response during rollout.
export async function fetchListeningAudio(url, options = {}) {
  const {expectedSha256, ...requestOptions} = options;
  const generation = memoryGeneration;
  options.signal?.throwIfAborted();
  const headers = new Headers(requestOptions.headers);
  headers.set('Accept', AUDIO_MANIFEST_TYPE);
  const response = await fetch(url, {...requestOptions, headers, cache:'no-store'});
  if (!response.ok) throw Object.assign(new Error('Chưa tải được audio. Nhấn Tiếp tục để thử lại.'), {httpStatus:response.status});
  options.signal?.throwIfAborted();
  if (response.headers.get('Content-Type')?.includes('json')) {
    const {audioManifest} = await response.json();
    if (!store.validManifest(audioManifest)) throw new Error('Định danh audio Pages không hợp lệ.');
    if (expectedSha256 && audioManifest.sha256 !== expectedSha256) throw new Error('AUDIO_VERSION_MISMATCH');
    options.signal?.throwIfAborted();
    const key = audioManifest.assetVersion + ':' + audioManifest.byteLength;
    if (completeAudio?.key === key) return completeAudio.blob;
    const blob = await store.download(audioManifest, {signal:options.signal});
    options.signal?.throwIfAborted();
    if (generation === memoryGeneration) completeAudio = {key, blob};
    return blob;
  }
  const blob = await response.blob();
  if (expectedSha256) {
    const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
    const hash = Array.from(new Uint8Array(digest), n=>n.toString(16).padStart(2,'0')).join('');
    if (hash !== expectedSha256) throw new Error('AUDIO_VERSION_MISMATCH');
  }
  options.signal?.throwIfAborted();
  return blob;
}

import {createPublicAudio} from '../shared/public-audio.mjs?v=20261024-cf512-1';

const store = createPublicAudio({
  database: 'izone-listening-public-audio-v1',
  prefixes: ['/izone-ai-team-pages/listening-practice/audio-assets/']
});
export const AUDIO_MANIFEST_TYPE = 'application/vnd.izone.audio-manifest+json';

// Authorization stays on the existing API. Only verified MP3 bytes use Pages.
// An older API may still return the original audio response during rollout.
export async function fetchListeningAudio(url, options = {}) {
  const headers = new Headers(options.headers);
  headers.set('Accept', AUDIO_MANIFEST_TYPE);
  const response = await fetch(url, {...options, headers});
  if (!response.ok) throw new Error('Chưa tải được audio. Nhấn Tiếp tục để thử lại.');
  if (response.headers.get('Content-Type')?.includes('json')) {
    const {audioManifest} = await response.json();
    return store.download(audioManifest, {signal: options.signal});
  }
  return response.blob();
}

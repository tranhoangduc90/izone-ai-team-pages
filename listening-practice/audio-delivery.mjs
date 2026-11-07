import {createPublicAudio} from '../shared/public-audio.mjs?v=20261024-cf512-1&journal=20261024-audio-v1&audio=20261028-part-rescue-v1';
import {downloadDirect,supportsDirect,validateDirectGrant} from '../shared/audio/direct.mjs?v=20261107-r2-direct1';

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
  const current=()=>{options.signal?.throwIfAborted();if(generation!==memoryGeneration)throw new DOMException('Identity changed','AbortError');};
  options.signal?.throwIfAborted();
  const headers = new Headers(requestOptions.headers);
  headers.set('Accept', AUDIO_MANIFEST_TYPE);
  if(supportsDirect())headers.set('X-Izone-Audio-Transport','r2-direct-v1');
  const response = await fetch(url, {...requestOptions, headers, cache:'no-store'});
  if (!response.ok) throw Object.assign(new Error('Chưa tải được audio. Nhấn Tiếp tục để thử lại.'), {httpStatus:response.status});
  options.signal?.throwIfAborted();
  if (response.headers.get('Content-Type')?.includes('json')) {
    const {audioManifest,audioDownload} = await response.json();
    if (!store.validManifest(audioManifest)) throw new Error('Định danh audio Pages không hợp lệ.');
    if (expectedSha256 && audioManifest.sha256 !== expectedSha256) throw new Error('AUDIO_VERSION_MISMATCH');
    if(audioDownload&&supportsDirect())validateDirectGrant(audioManifest,audioDownload);
    current();
    const key = audioManifest.assetVersion + ':' + audioManifest.byteLength;
    if (completeAudio?.key === key) return completeAudio.blob;
    const refresh=async({signal})=>{
      const r=await fetch(url,{...requestOptions,signal,headers,cache:'no-store'});
      if(!r.ok)throw Object.assign(Error('AUDIO_NATIVE_DENIED'),{accessDenied:true,httpStatus:r.status});
      const value=await r.json();if(!store.validManifest(value.audioManifest)||value.audioManifest.sha256!==audioManifest.sha256)throw Object.assign(Error('AUDIO_VERSION_MISMATCH'),{accessDenied:true});
      if(generation!==memoryGeneration)throw new DOMException('Identity changed','AbortError');
      return {manifest:value.audioManifest,download:value.audioDownload};
    };
    const blob = audioDownload&&supportsDirect()?await downloadDirect(audioManifest,audioDownload,{signal:options.signal,refresh}):await store.download(audioManifest, {signal:options.signal});
    current();
    if (generation === memoryGeneration) completeAudio = {key, blob};
    return blob;
  }
  const blob = await response.blob();
  if (expectedSha256) {
    const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
    const hash = Array.from(new Uint8Array(digest), n=>n.toString(16).padStart(2,'0')).join('');
    if (hash !== expectedSha256) throw new Error('AUDIO_VERSION_MISMATCH');
  }
  current();
  return blob;
}

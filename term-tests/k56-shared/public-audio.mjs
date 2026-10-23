import {createPublicAudio} from '../../shared/public-audio.mjs?v=20261024-cf512-1';

// Same download/hash/cache contract as K67; separate allowlist and cache.
export const publicAudio = createPublicAudio({
  database: 'izone-k56-public-audio-v1',
  prefixes: ['/izone-ai-team-pages/term-tests/k56-audio-assets/']
});

export async function downloadSessionAudio(manifest, options) {
  return publicAudio.download(manifest, options);
}

export async function plaintextAudio(blob, manifest) {
  return (await publicAudio.verify(blob, manifest)).arrayBuffer();
}

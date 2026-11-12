import { ASSETS } from '../../shared/audio/catalog.mjs?v=20261101-natural-dyes1';
import { downloadPreferred } from '../../shared/audio/transport.mjs?v=20261112-k67-paper-audio';

const paperAssets = new Set(['term-test-1', 'term-test-2', 'mini-test-lesson-5']);
const sourceLabels = { cloudflare: 'Cloudflare', pages: 'GitHub Pages', cache: 'bộ nhớ đệm' };

export function mountPaperAudio({ slug, onReady }) {
  if (!paperAssets.has(slug) || ASSETS[slug]?.id !== slug) {
    throw new Error('Bài thi giấy chưa có audio trong danh mục.');
  }
  const asset = ASSETS[slug];
  const status = document.getElementById('status');
  const sourceLabel = document.getElementById('audioSource');
  const retry = document.getElementById('audioRetry');
  const progressBar = document.getElementById('progress-bar');
  const progressText = document.getElementById('progress-text');
  let loading = false;

  function showProgress(loaded) {
    const percent = Math.min(100, Math.round(100 * loaded / asset.byteLength));
    progressBar.style.width = percent + '%';
    progressText.textContent = `Đã tải: ${percent}% (${(loaded / 1048576).toFixed(1)} MB / ${(asset.byteLength / 1048576).toFixed(1)} MB)`;
  }

  async function load() {
    if (loading) return;
    loading = true;
    const start = performance.now();
    const sources = new Set();
    retry.hidden = true;
    sourceLabel.textContent = '';
    status.textContent = 'Đang tải audio…';
    showProgress(0);
    try {
      const blob = await downloadPreferred({
        ...asset,
        envelopeVersion: 'MP3',
        cloudflare: { version: 1, policy: 'public-mp3-v1' }
      }, {
        signal: AbortSignal.timeout(90000),
        onProgress: ({ loaded }) => showProgress(loaded),
        onEvent: ({ source, wireBytes }) => {
          if (source === 'cache' || (wireBytes > 0 && (source === 'cloudflare' || source === 'pages'))) {
            sources.add(source);
          }
        }
      });
      if (!blob || blob.size !== asset.byteLength) throw new Error('AUDIO_EMPTY');
      onReady(URL.createObjectURL(blob));
      showProgress(blob.size);
      progressBar.style.backgroundColor = '#4CAF50';
      status.textContent = '✅ Tải xong 100%. Đã sẵn sàng!';
      sourceLabel.textContent = sources.size ? 'Nguồn: ' + [...sources].map(source => sourceLabels[source]).join(', ') : '';
      report('ready', blob.size);
    } catch (error) {
      const denied = error?.accessDenied === true;
      status.textContent = denied ? 'Chưa xác nhận được quyền tải audio.' : 'Chưa tải được audio. Hãy thử lại.';
      retry.hidden = false;
      report(denied ? 'access_denied' : 'load_failed', 0);
    } finally {
      loading = false;
    }

    function report(outcome, bytes) {
      document.dispatchEvent(new CustomEvent('k67:paper-audio-load', {
        detail: { slug, outcome, sources: [...sources], bytes, elapsedMs: Math.round(performance.now() - start) }
      }));
    }
  }

  retry.addEventListener('click', load);
  void load();
}

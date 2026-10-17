// Chạy bằng trình duyệt qua fixture HTML; không gọi API hoặc lưu dữ liệu.
// Cùng phép đo phải FAIL trên base khi map/sơ đồ rộng hơn khung.
export function inspectReviewImageFit() {
  const images = Array.from(document.images).filter(image => image.getClientRects().length);
  const rows = images.map(image => {
    const box = image.getBoundingClientRect();
    const parent = image.parentElement.getBoundingClientRect();
    return {
      alt: image.alt,
      loaded: image.complete && image.naturalWidth > 0,
      width: box.width,
      parentWidth: parent.width,
      fits: box.width <= parent.width + 1,
      aspectPreserved: Math.abs(box.width / box.height - image.naturalWidth / image.naturalHeight) < 0.02
    };
  });
  return { viewport: innerWidth, images: rows, pass: rows.length > 0 && rows.every(row => row.loaded && row.fits && row.aspectPreserved) };
}

const slug = new URLSearchParams(location.search).get('test') || 'term-test-1-k56';
if (!['term-test-1-k56', 'term-test-2-k56', 'mini-test-k56'].includes(slug)) throw new Error('Đề fixture không hợp lệ');
const base = new URL(`../../term-tests/${slug}-computer-based/`, import.meta.url);
async function loadScript(url) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = url;
    script.onload = resolve;
    script.onerror = reject;
    document.head.append(script);
  });
}
if (slug !== 'term-test-1-k56') await loadScript(new URL('passages.js', base));
await loadScript(new URL('content.js', base));
await loadScript(new URL('../../term-tests/shared/attempt-review.js', import.meta.url));
const dialog = window.TERM_TEST_ATTEMPT_REVIEW.open({ studentName: 'Hồ sơ giả kiểm ảnh', content: window.K56_TERM_TEST_CONTENT, answers: {} });
for (const image of dialog.querySelectorAll('img[src]')) image.src = new URL(image.getAttribute('src'), base);
const button = document.createElement('button');
button.type = 'button';
button.textContent = 'Kiểm kích thước ảnh';
const output = document.createElement('output');
output.id = 'imageFitResult';
button.addEventListener('click', () => { const report = inspectReviewImageFit(); output.textContent = `${report.pass ? 'PASS' : 'FAIL'} · ${report.images.length} ảnh · ${report.viewport}px`; });
button.style.maxWidth = '100%';
output.style.display = 'block';
dialog.querySelector('.attempt-review-header > div').append(button, output);

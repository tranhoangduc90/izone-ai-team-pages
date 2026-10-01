// Dữ liệu nhận vào: trang học viên Progress Log chính thức.
// Việc chính: dùng cùng giao diện, đổi tài nguyên sang thư mục cha và khóa mạng vào API demo.
// Kết quả: trang xem thử học viên; --check báo lỗi nếu bản copy đã cũ.
// Khi lỗi: dừng build và giữ nguyên các trang đã phát hành.
import { readFile, writeFile } from 'node:fs/promises';

const pages = ['index.html'];
const check = process.argv.includes('--check');

for (const name of pages) {
  // Chuẩn hóa xuống dòng để checkout Windows và Linux tạo cùng một trang xem thử.
  let html = (await readFile(new URL(`../${name}`, import.meta.url), 'utf8')).replaceAll('\r\n', '\n');
  html = html.replaceAll('https://ducizone.ddns.net', 'https://ducizone.ddns.net/mapping-api-progress-log-demo/');
  html = html.replace('connect-src \'self\' ', 'connect-src \'self\' http://127.0.0.1:8792 ');
  html = html.replaceAll(/(?:href|src)="(styles\.css|teacher\.css|journey\.css|app\.js|teacher\.js|journey\.js)/g,
    match => match.replace('="', '="../'));
  html = html.replace(/\s*<script src="https:\/\/accounts\.google\.com\/gsi\/client" async defer><\/script>/, '');
  if (name === 'index.html') {
    html = html.replace('src="../app.js?', 'src="boot.js?');
    // Bản thử dùng cùng API Journey trong kho demo, nên giữ hai nút của trang chính.
    html = html.replace('<main class="shell">', `<aside class="demo-banner" role="note">
      <b>BẢN THỬ · KHÔNG GHI BÀI THẬT</b>
      <span>Nội dung phiếu thật; bài làm và điểm danh chỉ lưu trong bản thử.</span>
      <span class="demo-actions"><button class="button" id="openDemoBlocksButton" type="button" hidden>Mở các phần để thử</button>
      <button class="button" id="resetDemoButton" type="button" hidden>Làm lại từ đầu</button></span>
    </aside>
    <main class="shell">`);
  }
  html = html.replace('<title>', '<title>Bản thử · ');
  html = html.replace(/src="config\.js\?rev=[^"]+"/, 'src="config.js?rev=20260924-generic-demo-v1"');
  if (name === 'index.html') {
    html = html.replace(/src="boot\.js\?rev=[^"]+"/, 'src="boot.js?rev=20261001-journey-loading-v1"');
  }
  html = html.replace('</head>', '    <link rel="stylesheet" href="demo.css?rev=20260924-v1">\n  </head>');
  const output = new URL(name, import.meta.url);
  if (check) {
    const current = (await readFile(output, 'utf8')).replaceAll('\r\n', '\n');
    if (current !== html) throw new Error(`${name} chưa đồng bộ với trang chính.`);
  } else {
    await writeFile(output, html, 'utf8');
  }
}

// Dữ liệu nhận vào: ba trang Progress Log chính thức.
// Việc chính: dùng cùng cấu trúc giao diện, đổi tài nguyên sang thư mục cha và khóa mạng vào API demo.
// Kết quả: ba trang bản thử; --check báo lỗi nếu bản copy đã cũ.
// Khi lỗi: dừng build và giữ nguyên các trang đã phát hành.
import { readFile, writeFile } from 'node:fs/promises';

const pages = ['index.html', 'teacher.html', 'journey.html'];
const check = process.argv.includes('--check');

for (const name of pages) {
  let html = await readFile(new URL(`../${name}`, import.meta.url), 'utf8');
  html = html.replaceAll('https://ducizone.ddns.net', 'https://ducizone.ddns.net/mapping-api-progress-log-demo/');
  html = html.replace('connect-src \'self\' ', 'connect-src \'self\' http://127.0.0.1:8792 ');
  html = html.replaceAll(/(?:href|src)="(styles\.css|teacher\.css|journey\.css|app\.js|teacher\.js|journey\.js)/g,
    match => match.replace('="', '="../'));
  html = html.replace(/\s*<script src="https:\/\/accounts\.google\.com\/gsi\/client" async defer><\/script>/, '');
  if (name === 'index.html') {
    html = html.replace('src="../app.js?', 'src="boot.js?');
    html = html.replace('<main class="shell">', `<aside class="demo-banner" role="note">
      <b>BẢN THỬ · CHỈ DỮ LIỆU MẪU</b>
      <span>Bài làm và điểm danh ở đây không vào lớp thật.</span>
      <a id="demoTeacherLink" hidden>Mở màn giảng viên thử</a>
    </aside>
    <main class="shell">`);
  } else if (name === 'teacher.html') {
    html = html.replace('<main class="teacher-shell">', `<aside class="demo-banner" role="note">
      <b>BẢN THỬ · CHỈ DỮ LIỆU MẪU</b>
      <span>Nhận xét, bài làm và điểm danh không vào lớp thật; Portal được mô phỏng.</span>
      <button class="button" id="resetDemoButton" type="button">Đặt lại lượt thử</button>
    </aside>
    <main class="teacher-shell">`);
  } else {
    html = html.replace('<main', `<aside class="demo-banner" role="note">
      <b>BẢN THỬ · CHỈ DỮ LIỆU MẪU</b>
      <span>Nhận xét hiển thị trong lượt thử này, không phải thông tin lớp thật.</span>
    </aside>
    <main`);
  }
  html = html.replace('<title>', '<title>Bản thử · ');
  html = html.replace(/src="config\.js\?rev=[^"]+"/, 'src="config.js?rev=20260924-generic-demo-v1"');
  if (name === 'index.html') {
    html = html.replace(/src="boot\.js\?rev=[^"]+"/, 'src="boot.js?rev=20260924-generic-demo-v1"');
  }
  html = html.replace('</head>', '    <link rel="stylesheet" href="demo.css?rev=20260924-v1">\n  </head>');
  const output = new URL(name, import.meta.url);
  if (check) {
    const current = await readFile(output, 'utf8');
    if (current !== html) throw new Error(`${name} chưa đồng bộ với trang chính.`);
  } else {
    await writeFile(output, html, 'utf8');
  }
}

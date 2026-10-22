// Nhận cách so, font, màu và cỡ chữ; dựng cùng nội dung cho mọi bản.
// Thao tác thử được đồng bộ trong trang, không gửi bài hoặc lưu dữ liệu lên hệ thống.
const fonts = [
  { id: 'nunito', name: 'Nunito Sans', source: 'Reading' },
  { id: 'segoe', name: 'Segoe UI', source: 'K56', local: true },
  { id: 'geologica', name: 'Geologica', source: 'Mẫu Thủy' },
];
const themes = [
  { id: 'reading', name: 'Reading', description: 'Nền xám sáng · Hành động navy · Đỏ nhấn nhỏ', swatches: ['#152B4E', '#DB0829', '#F5F6F8', '#FFFFFF'] },
  { id: 'k56', name: 'K56', description: 'Nền xám xanh · Hành động xanh dương · Đầu vùng navy', swatches: ['#173B67', '#2F6FED', '#EEF2F7', '#FFFFFF'] },
  { id: 'thuy', name: 'Mẫu Thủy', description: 'Nền xám sáng · Hành động đỏ · Tiêu đề xanh đậm', swatches: ['#174266', '#DB0829', '#F3F4F6', '#FFFFFF'] },
];
const params = new URLSearchParams(location.search);
// Link Inter/Georgia của bản thử cũ chuyển sang font giao diện K56 đã xác minh.
const requestedFont = ['inter', 'georgia'].includes(params.get('font')) ? 'segoe' : params.get('font');
// Mỗi font giữ màu riêng; link cũ có một theme chỉ dùng làm màu khởi đầu.
const initialTheme = themes.some(t => t.id === params.get('theme')) ? params.get('theme') : 'reading';
const state = {
  view: ['single', 'colors'].includes(params.get('view')) ? params.get('view') : 'compare',
  themes: Object.fromEntries(fonts.map(f => {
    const choice = params.get(`theme_${f.id}`);
    return [f.id, themes.some(t => t.id === choice) ? choice : initialTheme];
  })),
  scene: ['lesson', 'reading', 'dashboard'].includes(params.get('scene')) ? params.get('scene') : 'lesson',
  font: fonts.some(f => f.id === requestedFont) ? requestedFont : 'nunito',
  scale: ['1', '1.125', '1.25'].includes(params.get('scale')) ? params.get('scale') : '1',
  answer: 'B', note: '', saved: false,
};
const comparison = document.querySelector('#comparison');
const commonTop = '<div class="sample-top"><strong>IZONE · Lớp minh họa</strong><span>Buổi 08 · Reading</span></div>';
const actions = '<div class="sample-actions"><button class="sample-button" type="button" data-save>Lưu nháp thử</button><button class="sample-button secondary" type="button" data-reset>Xóa nội dung thử</button></div><p class="save-status" aria-live="polite"></p>';
const field = id => `<label class="sample-field" for="note-${id}">Ghi chú của bạn<textarea id="note-${id}" data-note placeholder="Gõ vài dòng tiếng Việt để cảm nhận font…"></textarea></label>`;
// Tạo toàn bộ nguyên âm Việt với sáu thanh để người xem tự kiểm cả chữ hoa và thường.
const vietnameseLetters = [...'aăâeêioôơuưy'].flatMap(letter => ['', '\u0300', '\u0301', '\u0309', '\u0303', '\u0323'].map(tone => (letter + tone).normalize('NFC'))).join(' ');
function lesson(id) {
  return `<p class="sample-kicker">LUYỆN ĐỌC · PHẦN 1</p><h2 class="sample-title">Những thành phố đáng sống hơn</h2><p class="sample-description">Đọc đoạn văn và chọn ý chính. Bạn có thể đổi lựa chọn, gõ ghi chú và thử các nút bên dưới.</p>
  <p>Không gian xanh giúp người dân nghỉ ngơi, gặp gỡ và vận động mỗi ngày. Một thành phố đáng sống cần quan tâm đến trải nghiệm của cả người đi bộ, trẻ nhỏ và người cao tuổi.</p>
  <div class="sample-section"><h3>Read the passage</h3><p>Small changes to public spaces can make everyday life more comfortable. A shaded path, a quiet garden or a welcoming library gives people more reasons to spend time together.</p></div>
  <div class="sample-section"><p class="sample-question">1. What is the main idea of the passage?</p><div class="choice-list">${['A. Cities should build more roads.', 'B. Public spaces can improve daily life.', 'C. Libraries should replace public gardens.'].map((text, i) => `<label class="choice"><input type="radio" name="answer-${id}" value="${String.fromCharCode(65 + i)}" data-answer><span>${text}</span></label>`).join('')}</div></div>
  ${field(id)}${actions}<div class="feedback">✓ Trạng thái minh họa: Đã nộp phần Ôn tập</div><div class="feedback flag">⚑ Trạng thái minh họa: Còn 2 câu cần xem lại</div>`;
}
function reading() {
  return `<p class="sample-kicker">BÀI ĐỌC DÀI · VIỆT & ANH</p><h2 class="sample-title">Thiết kế bắt đầu từ những điều thường ngày</h2><p class="sample-description">Cùng một đoạn văn, cùng cỡ chữ 16 px và giãn dòng 1,7. Hãy đọc hết một đoạn ở mỗi font.</p>
  <div class="reading-text"><p>Mỗi buổi sáng, người dân bước ra khỏi nhà và đưa ra hàng chục lựa chọn nhỏ: đi bộ qua công viên hay dọc theo đường lớn, chờ xe buýt dưới bóng cây hay đứng bên một bức tường nóng. Những lựa chọn ấy cho thấy thiết kế đô thị ảnh hưởng đến cuộc sống theo những cách rất gần gũi.</p>
  <p>Một con đường dễ đi không chỉ cần bằng phẳng. Người sử dụng còn cần nhìn rõ hướng đi, nhận biết chỗ sang đường và tìm được nơi nghỉ chân. Với người lớn tuổi hoặc người đang đẩy xe trẻ em, một thay đổi nhỏ ở vỉa hè có thể tạo ra khác biệt đáng kể.</p>
  <h3>Small details, meaningful changes</h3><p>Good design often becomes noticeable when something goes wrong. A sign may look elegant but fail to explain where a visitor should go. A form may seem simple until someone makes a mistake and cannot understand how to correct it.</p>
  <p>The most useful improvements usually begin with careful observation. Designers watch people complete ordinary tasks, listen to their questions and examine the points at which they hesitate. They then test a small change before applying it more widely.</p>
  <p>Clear information can also make an experience feel calmer. When people know what has happened, what remains to be done and how to return to an earlier step, they can focus on their work instead of trying to understand the interface.</p>
  <h3>Đọc rõ cả nội dung lẫn chi tiết</h3><p>Trong một ứng dụng học tập, tiêu đề giúp định hướng, đoạn văn truyền tải kiến thức và nhãn trạng thái giúp người học biết bài của mình đang ở đâu. Một hệ chữ tốt cần giữ được cả ba vai trò khi nội dung dài hơn dự kiến.</p></div>
  <div class="diacritics"><strong>Thử dấu và chữ số</strong><p>Nguyễn · Thủy · Khánh · Đặng · Ước mơ · Quyền lựa chọn</p><p>Ă Â Ê Ô Ơ Ư Đ · ă â ê ô ơ ư đ</p><p>0 1 2 3 4 5 6 7 8 9 · 17/20 · 85,7% · 22:00</p><details><summary>Kiểm đủ sáu thanh tiếng Việt</summary><p>${vietnameseLetters}</p><p>${vietnameseLetters.toUpperCase()}</p></details></div>`;
}
function dashboard(id) {
  return `<p class="sample-kicker">KHÔNG GIAN GIẢNG VIÊN</p><h2 class="sample-title">Kết quả buổi học</h2><p class="sample-description">Lớp minh họa · Buổi 08<br>Điểm và trạng thái bên dưới đều là dữ liệu giả.</p>
  <div class="table-wrap"><table class="sample-table"><thead><tr><th scope="col">Học viên</th><th scope="col" class="number">Reading</th><th scope="col">Trạng thái</th></tr></thead><tbody><tr><td>Học viên A</td><td class="number">17/20</td><td><span class="tag">Đã nộp</span></td></tr><tr><td>Học viên B</td><td class="number">12/20</td><td><span class="tag waiting">Cần xem lại</span></td></tr><tr><td>Học viên C</td><td class="number">—</td><td>Chưa có bài</td></tr></tbody></table></div>
  <div class="sample-section"><h3>Nhận xét của giảng viên</h3><p>Bạn đã xác định đúng ý chính và tìm được dẫn chứng phù hợp. Ở câu 3, hãy đối chiếu kỹ đối tượng được nhắc đến trước khi chọn đáp án.</p><p class="sample-meta">Nhận xét minh họa · 19:45, ngày 22/10/2026</p></div>${field(id)}${actions}
  <div class="feedback">✓ Minh họa thành công: Đã lưu nhận xét</div><div class="feedback flag">⚑ Minh họa cần chú ý: Còn 1 bài chưa nộp</div><div class="feedback error">! Minh họa lỗi: Chưa lưu được. Hãy thử lại.</div>`;
}
function updateUrl() {
  const query = new URLSearchParams({ view: state.view, scene: state.scene, font: state.font, theme: state.themes[state.font], scale: state.scale });
  fonts.forEach(f => query.set(`theme_${f.id}`, state.themes[f.id]));
  history.replaceState(null, '', `${location.pathname}?${query}`);
}
function syncExamples() {
  document.querySelectorAll('[data-answer]').forEach(input => { input.checked = input.value === state.answer; });
  document.querySelectorAll('[data-note]').forEach(input => { if (input.value !== state.note) input.value = state.note; });
  document.querySelectorAll('.save-status').forEach(el => { el.textContent = state.saved ? '✓ Đã giữ nội dung thử trong trang này.' : ''; });
}
function render() {
  document.documentElement.style.setProperty('--scale', state.scale);
  document.querySelector('#scale').value = state.scale;
  document.querySelector('.single-picker').hidden = state.view === 'compare';
  document.querySelector('.theme-picker').hidden = state.view !== 'single';
  document.querySelector('#mobileHint').hidden = state.view === 'single';
  for (const key of ['view', 'scene', 'font']) document.querySelectorAll(`[data-${key}]`).forEach(button => button.setAttribute('aria-pressed', String(button.dataset[key] === state[key])));
  document.querySelectorAll('[data-theme]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.theme === state.themes[state.font])));
  comparison.classList.toggle('single', state.view === 'single');
  comparison.classList.toggle('compare-colors', state.view === 'colors');
  const font = fonts.find(f => f.id === state.font), theme = themes.find(t => t.id === state.themes[state.font]);
  const shown = state.view === 'colors' ? themes.map(t => ({ font, theme: t })) : (state.view === 'single' ? [font] : fonts).map(f => ({ font: f, theme: themes.find(t => t.id === state.themes[f.id]) }));
  document.querySelector('#themeDescription').textContent = theme.description;
  document.querySelector('#comparisonHelp').textContent = state.view === 'colors' ? 'Cùng một font và bố cục. Ba bản chỉ khác cách phối màu; không sao chép bố cục riêng của sản phẩm gốc.' : state.view === 'single' ? 'Màu được giữ riêng cho font đang xem. Đổi font để xem hoặc chỉnh màu của bản khác.' : 'Cùng nội dung, cỡ chữ và bố cục. Chọn màu riêng ngay dưới tên mỗi font; các cột khác giữ nguyên.';
  const palette = document.querySelector('.palette');
  palette.hidden = state.view !== 'single';
  palette.querySelectorAll('.swatch').forEach((swatch, i) => { swatch.style.background = theme.swatches[i]; swatch.style.borderColor = i < 2 ? theme.swatches[i] : ''; swatch.title = theme.swatches[i]; });
  comparison.innerHTML = shown.map(({ font: f, theme: t }) => {
    const id = `${f.id}-${t.id}`;
    const family = `'${f.name}'`;
    const subtitle = state.view === 'colors' ? `${f.name} · Font ${f.source}` : `Font ${f.source} · Màu ${t.name}`;
    const picker = state.view === 'compare' ? `<div class="column-theme-picker" role="group" aria-label="Phối màu cho ${f.name}">${themes.map(option => `<button type="button" data-column-theme="${option.id}" data-owner-font="${f.id}" aria-pressed="${option.id === t.id}">${option.name}</button>`).join('')}</div>` : '';
    return `<article class="font-column" data-family="${f.name}" data-palette="${t.id}" style="--sample-font:${family}"><div class="font-caption"><div><h2>${state.view === 'colors' ? t.name : f.name}</h2><p class="font-subtitle">${subtitle}</p></div><span data-font-state>Đang kiểm…</span></div>${picker}<div class="specimen">${commonTop}<div class="sample-body">${state.scene === 'reading' ? reading() : state.scene === 'dashboard' ? dashboard(id) : lesson(id)}</div></div></article>`;
  }).join('');
  syncExamples(); updateFontLabels(); updateUrl();
}
// Kiểm tài nguyên font đã tải; nếu thiếu, hiển thị lỗi thay vì nhận nhầm font dự phòng.
const loaded = new Set();
const failed = new Set();
function updateFontLabels() {
  document.querySelectorAll('[data-family]').forEach(column => {
    const family = column.dataset.family;
    column.querySelector('[data-font-state]').textContent = failed.has(family) ? (family === 'Segoe UI' ? 'Máy chưa có Segoe UI' : 'Chưa tải được font') : loaded.has(family) ? (family === 'Segoe UI' ? '✓ Font hệ thống' : '✓ Font đã tải') : 'Đang kiểm…';
    column.classList.toggle('font-unavailable', failed.has(family));
  });
}
document.addEventListener('click', event => {
  const button = event.target.closest('button'); if (!button) return;
  if (button.dataset.columnTheme) {
    const owner = button.dataset.ownerFont, choice = button.dataset.columnTheme;
    state.themes[owner] = choice;
    render();
    // Dựng lại cột không làm mất vị trí bàn phím ở bộ chọn vừa dùng.
    comparison.querySelector(`[data-owner-font="${owner}"][data-column-theme="${choice}"]`).focus({ preventScroll: true });
    return;
  }
  if (button.dataset.theme) { state.themes[state.font] = button.dataset.theme; render(); return; }
  for (const key of ['view', 'scene', 'font']) if (button.dataset[key]) { state[key] = button.dataset[key]; render(); return; }
  if (button.hasAttribute('data-save')) { state.saved = true; syncExamples(); }
  if (button.hasAttribute('data-reset')) { state.note = ''; state.answer = 'B'; state.saved = false; syncExamples(); }
});
document.addEventListener('input', event => {
  if (event.target.matches('[data-note]')) { state.note = event.target.value; state.saved = false; syncExamples(); }
});
document.addEventListener('change', event => {
  if (event.target.id === 'scale') { state.scale = event.target.value; render(); }
  if (event.target.matches('[data-answer]')) { state.answer = event.target.value; syncExamples(); }
});
render();
Promise.allSettled(fonts.map(async f => {
  try {
    if (f.local) {
      // Chỉ dò Segoe UI cài sẵn; không sao chép hoặc phát hành tệp font hệ thống.
      await new FontFace('Segoe UI local probe', 'local("Segoe UI")').load();
    } else {
      for (const weight of [400, 500, 600, 700]) {
        const faces = await document.fonts.load(`${weight} 16px "${f.name}"`, 'Tiếng Việt: Nguyễn Thủy Đặng Ước mơ 85,7% Reading');
        if (!faces.length) throw new Error(`Thiếu font ${f.name}`);
      }
    }
    loaded.add(f.name);
  } catch (error) {
    failed.add(f.name);
    throw error;
  } finally {
    updateFontLabels();
  }
})).then(() => {
  const status = document.querySelector('#fontStatus');
  status.textContent = failed.size ? `Chưa dùng được: ${[...failed].join(', ')}. Không dùng bản đó để kết luận về font.` : '✓ Đủ 3 font đúng nguồn';
  status.className = failed.size ? 'error' : 'ready';
});

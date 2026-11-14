const card = `<section class="share-practice" aria-labelledby="practice-title">
  <div><p class="headings-kicker">TRƯỚC KHI VIẾT</p><h2 id="practice-title">Thực hiện đoạn chat “Writing Lesson 4”</h2>
    <p>Luyện đến khi chatbot kết thúc bài, rồi gửi link chia sẻ cả hội thoại.</p></div>
  <a class="primary practice-open" href="https://ducizone.short.gy/writing_lesson_4" target="_blank" rel="noopener">Mở bài luyện ↗</a>
  <details><summary>Cách lấy link chia sẻ</summary><ol>
    <li>Mở bài luyện, nhấn tiếp tục hội thoại và trả lời câu hỏi đầu tiên.</li>
    <li>Luyện theo hướng dẫn. Khi chatbot kết thúc bài, chọn Chia sẻ → Tạo liên kết → Sao chép liên kết.</li>
    <li>Dán link dạng chatgpt.com/share/… vào ô dưới. Nếu luyện tiếp, cập nhật link chia sẻ trước khi kiểm lại.</li>
  </ol><p>Chia sẻ cả cuộc hội thoại để hệ thống đọc được bài luyện.</p></details>
  <label for="practice-share">Link chia sẻ hội thoại</label>
  <div class="share-practice-input"><input id="practice-share" type="url" inputmode="url" autocomplete="off" placeholder="https://chatgpt.com/share/…">
    <button class="secondary" type="button" id="practice-check">Kiểm tra link</button></div>
  <p id="practice-status" role="status" aria-live="polite">Đang đọc trạng thái luyện tập…</p>
</section>`;

export function mountLesson4Practice(workspace, client) {
  if (!workspace.querySelector('.reading-practice-gate')) {
    const layout = workspace.querySelector('.layout');
    const title = layout.querySelector('.page-title');
    title.classList.add('lesson4-page-title');
    layout.before(title);
    layout.insertAdjacentHTML('beforebegin', card + `<div class="reading-practice-gate" data-locked="true">
      <div class="reading-practice-overlay"><section class="reading-practice-lock-notice" role="status" aria-labelledby="practice-lock-title">
        <h2 id="practice-lock-title">Hoàn thành luyện ChatGPT để mở bài viết</h2>
        <p>Gửi link chia sẻ ở trên. Bài viết sẽ mở khi hệ thống xác nhận bạn đã luyện xong.</p>
        <button class="primary" type="button" id="practice-gate-jump">Tới phần luyện ChatGPT ↑</button>
      </section></div></div>`);
    layout.classList.add('reading-practice-content');
    layout.inert = true;
    workspace.querySelector('.reading-practice-gate').append(layout);
  }
  window.ReadingSharePractice.bind({
    content: { practice: true, code: 'writing67-lesson4-ideas', version: 'v1' },
    client: { ...client, identity: { ownerId: client.ref, courseId: 'handout67' } },
  });
}

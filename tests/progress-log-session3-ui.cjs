// Nhận trang Progress Log chạy trên localhost và chặn toàn bộ API bằng dữ liệu giả.
// Việc chính: đi hết luồng OTHER, đổi lựa chọn, nội dung dài, điểm ngoài phạm vi và nộp cuối.
// Kết quả: trả danh sách contract đã kiểm; khi lỗi throw để tiến trình trả exit code 1.
async (page) => {
  const ensure = (condition, message) => { if (!condition) throw Error(message); };
  const base = 'http://127.0.0.1:4188/progress-log/';
  const publicToken = '57000000-0000-4000-8000-000000000004';
  const assignmentId = '57000000-0000-4000-8000-000000000003';
  const studentRef = '57000000-0000-4000-8100-000000000003';
  const attemptToken = '57000000-0000-4000-8200-000000000003';
  const definitionHash = 'a'.repeat(64);
  const itemIds = Array.from({ length: 6 }, (_, index) =>
    `57000000-0000-4000-8600-${String(index + 1).padStart(12, '0')}`);
  const blockIds = Array.from({ length: 3 }, (_, index) =>
    `57000000-0000-4000-8300-${String(index + 1).padStart(12, '0')}`);
  const baseItem = (index, overrides = {}) => ({
    itemFamilyId: `57000000-0000-4000-8500-${String(index + 1).padStart(12, '0')}`,
    itemVersionId: itemIds[index],
    position: index + 1,
    prompt: `Câu kiểm thử ${index + 1}`,
    helpText: '',
    interactionType: 'short_text',
    pedagogicalTypeCode: 'reflection',
    layoutType: 'plain_prompt',
    graderType: 'none',
    groupId: null,
    required: true,
    maxScore: 0,
    options: [],
    interactionConfig: {},
    skillCodes: [],
    evidenceSource: 'student_self_report',
    releasePolicy: 'inherit',
    ...overrides,
  });
  const definition = {
    schemaVersion: 'FormDefinitionV1',
    formVersionId: '57000000-0000-4000-8000-000000000006',
    courseCode: '56',
    title: 'ENTRANCE TICKET • LISTENING 1 + SPEAKING 2',
    kind: 'mixed',
    answerReleasePolicy: 'hidden',
    blocks: [
      {
        blockId: blockIds[0], checkpoint: 1, title: 'Nhìn lại bài học trước', instructions: '',
        items: [
          baseItem(0, {
            displayNumber: '1', prompt: 'Chọn đáp án ôn tập Writing.',
            interactionType: 'single_choice', pedagogicalTypeCode: 'writing_example_selection',
            layoutType: 'choice_cards', graderType: 'exact_option', maxScore: 1,
            options: [{ id: 'A', label: 'Phương án A' }, { id: 'B', label: 'Phương án B' }],
          }),
          baseItem(1, {
            displayNumber: '2', prompt: 'Hoàn thiện mắt xích lập luận.',
            pedagogicalTypeCode: 'writing_argument_development', layoutType: 'reasoning_chain_completion',
            interactionConfig: { beforeText: 'Nguyên nhân', afterText: 'Kết quả' },
          }),
        ],
      },
      {
        blockId: blockIds[1], checkpoint: 2, title: 'Buổi học hôm nay · Speaking', instructions: '',
        items: [
          baseItem(2, {
            displayNumber: '1', prompt: 'Vấn đề speaking lớn nhất của em là gì?',
            interactionType: 'single_choice', pedagogicalTypeCode: 'speaking_self_assessment',
            layoutType: 'choice_cards',
            options: [{ id: 'VOCABULARY', label: 'Thiếu từ vựng' }, { id: 'OTHER', label: 'Vấn đề khác' }],
          }),
          baseItem(3, {
            prompt: 'Nêu rõ vấn đề khác.', pedagogicalTypeCode: 'speaking_self_assessment',
            layoutType: 'conditional_other_text', required: false,
            interactionConfig: {
              visibleWhenItemVersionId: itemIds[2], visibleWhenValue: 'OTHER', requiredWhenVisible: true,
            },
          }),
          baseItem(4, {
            displayNumber: '2', prompt: 'Giáo viên nhận xét gì?', interactionType: 'long_text',
            pedagogicalTypeCode: 'speaking_teacher_feedback_recall', required: false,
            evidenceSource: 'student_reported_teacher_feedback',
          }),
        ],
      },
      {
        blockId: blockIds[2], checkpoint: 3, title: 'Buổi học hôm nay · Listening', instructions: '',
        items: [baseItem(5, {
          displayNumber: '1', prompt: 'Số câu em làm đúng là:', interactionType: 'number_score',
          pedagogicalTypeCode: 'listening_practice_score', layoutType: 'score_fraction',
          interactionConfig: { min: 0, max: 6, step: 1, unit: 'câu' },
        })],
      },
    ],
  };
  let draftRevision = 0;
  let lastDraft = {};
  const checkpoints = [];
  const pageErrors = [];
  const blocked = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.context().route('**/*', async route => {
    const request = route.request();
    const address = request.url();
    if (address.startsWith('http://127.0.0.1:4188/')) return route.continue();
    if (!address.includes('/api/learning/')) {
      blocked.push(address.split('?')[0]);
      return route.abort();
    }
    const path = address.split('/api/learning/')[1].split('?')[0];
    const body = request.postDataJSON?.() || {};
    const send = payload => route.fulfill({
      status: 200,
      contentType: 'application/json; charset=utf-8',
      body: JSON.stringify({ ok: true, ...payload }),
    });
    if (path === 'assignments/open') return send({ assignment: {
      assignmentId, publicToken, definitionHash, title: definition.title, sessionNumber: 3,
      class: { id: '1294', classRef: 'IC2305', name: 'IC2305' },
      roster: [{ studentRef, name: 'Học viên giả', discriminator: 'Mã 001' }],
      definition,
      blockReleases: blockIds.map((blockId, index) => ({ blockId, checkpoint: index + 1, status: 'open' })),
    } });
    if (path === 'attempts/start') return send({ attempt: {
      attemptId: attemptToken, attemptToken, draftRevision, draft: lastDraft,
      checkpointSubmissions: checkpoints,
      identity: { studentName: 'Học viên giả', className: 'IC2305', sessionNumber: 3 },
    } });
    if (path === 'attempts/draft') {
      draftRevision = Number(body.revision);
      lastDraft = body.responses || {};
      return send({ draft: { revision: draftRevision } });
    }
    if (path === 'attempts/checkpoints/submit') {
      checkpoints.push({ blockId: body.blockId, checkpoint: body.checkpoint, submittedAt: new Date().toISOString() });
      return send({ checkpointSubmission: checkpoints.at(-1) });
    }
    if (path === 'attempts/submit') return send({ receipt: {
      schemaVersion: 'SubmissionReceiptV1', submissionId: body.submissionId,
      receivedAt: new Date().toISOString(), completeness: 'complete',
      attendanceStatus: 'self_confirmed', gradingStatus: 'complete',
      message: 'Hệ thống đã nhận đủ phiếu và tự ghi nhận điểm danh của bạn.', nextAction: '',
    } });
    throw Error(`Mock chưa khai báo API ${path}`);
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${base}index.html?ui-test=session3#assignment=${publicToken}`);
  await page.waitForTimeout(200);
  ensure(await page.locator('#identityView').isVisible(),
    `Không mở được màn chọn tên: ${(await page.locator('body').innerText()).slice(0, 500)}; blocked=${blocked.join(',')}`);
  await page.locator('#studentSelect').selectOption(studentRef);
  await page.getByRole('button', { name: 'Tiếp tục' }).click();
  await page.getByRole('button', { name: 'Đúng là em' }).click();

  const writingGroup = page.locator('[role=radiogroup]').first();
  await writingGroup.locator('input[value=B]').focus();
  await page.keyboard.press('Space');
  ensure(await writingGroup.locator('input[value=B]').isChecked(), 'MCQ không chọn được bằng bàn phím.');
  const chain = page.locator('.reasoning-chain-input');
  await chain.fill('Một mắt xích rất dài để xác nhận ô trả lời tự tăng chiều cao và không che mất nội dung học viên đã gõ.');
  const chainBox = await chain.evaluate(element => ({
    clientHeight: element.clientHeight, scrollHeight: element.scrollHeight,
    overflowY: getComputedStyle(element).overflowY,
  }));
  ensure(chainBox.clientHeight >= chainBox.scrollHeight - 3 && chainBox.overflowY === 'hidden', 'Ô lập luận dài bị che hoặc cuộn dọc.');
  ensure(!(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)), 'Trang 390 px bị tràn ngang.');
  await page.getByRole('button', { name: 'Nộp phần và tiếp tục' }).click();

  await page.locator('input[value=OTHER]').check();
  const otherField = page.getByRole('textbox', { name: 'Nêu rõ vấn đề khác.' });
  ensure(await otherField.isVisible(), 'Chọn OTHER nhưng ô nêu rõ không hiện.');
  ensure(await otherField.getAttribute('required') !== null, 'Ô OTHER đang hiện nhưng không bắt buộc.');
  ensure((await page.getByRole('heading', { name: /Nêu rõ vấn đề khác/ }).innerText()).includes('*'), 'Ô OTHER thiếu dấu bắt buộc.');
  await otherField.fill('Nội dung cũ phải được xóa.');
  await page.locator('input[value=VOCABULARY]').check();
  ensure(!(await otherField.isVisible()), 'Đổi khỏi OTHER nhưng ô phụ vẫn còn hiện.');
  const stored = JSON.parse(await page.evaluate(() => Object.values(sessionStorage).find(value => value.includes('definitionHash'))));
  ensure(!Object.hasOwn(stored.responses, itemIds[3]), 'Đổi khỏi OTHER nhưng draft cục bộ còn dữ liệu phụ.');
  await page.getByRole('button', { name: 'Nộp phần và tiếp tục' }).click();

  const score = page.locator('input[type=number]');
  await score.fill('7');
  await page.getByRole('button', { name: 'Nộp phiếu & điểm danh' }).click();
  ensure(await score.isVisible(), 'Điểm vượt phạm vi vẫn nộp được.');
  ensure(!(await score.evaluate(element => element.validity.valid)), 'Input không đánh dấu điểm 7/6 là sai.');
  await score.fill('5');
  await page.getByRole('button', { name: 'Nộp phiếu & điểm danh' }).click();
  await page.getByText('ĐÃ NHẬN PHIẾU').waitFor();
  ensure(!(await page.locator('body').innerText()).includes('VIỆC TIẾP THEO'), 'Màn hoàn tất còn khối Việc tiếp theo.');
  ensure(pageErrors.length === 0, `Trang phát sinh lỗi JavaScript: ${pageErrors.join('; ')}`);
  ensure(blocked.length === 0, `Trang gọi ra ngoài phạm vi mock: ${blocked.join(', ')}`);

  return {
    outcome: 'success',
    baseline: false,
    checks: [
      'MCQ dùng bàn phím', 'ô lập luận dài tự nở', 'mobile không tràn',
      'OTHER hiện và bắt buộc', 'đổi lựa chọn xóa dữ liệu phụ',
      'chặn 7/6', 'nộp 5/6', 'màn hoàn tất không có Việc tiếp theo',
    ],
    draftRevision,
  };
}

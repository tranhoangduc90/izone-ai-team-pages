/* Dữ liệu trình chiếu cho renderer giảng viên. Mỗi tab có phiên riêng trong bộ nhớ. */
(() => {
  const id = n => 'd0000000-0000-4000-8000-' + String(n).padStart(12, '0');
  const reviewer = { name: 'Nguyễn Minh An', email: 'minhan@example.invalid' };
  const classes = [
    { class_id: '9041', class_name: 'IC2481', class_status: 'on_going', can_manage: true },
    { class_id: '9042', class_name: 'IC2483', class_status: 'on_going', can_manage: true },
    { class_id: '9043', class_name: 'IC2475', class_status: 'completed', can_manage: true },
  ];
  const lessons = [
    { session: 6, title: 'Reading · Matching Headings', parts: ['Luyện tập Reading', 'Nhìn lại bài học'] },
    { session: 7, title: 'Listening 2 + Speaking 2', parts: ['Listening · Nhận diện từ khóa', 'Speaking · Mở rộng câu trả lời'] },
    { session: 8, title: 'Reading 3 + Writing 1', parts: ['Reading · Tìm thông tin', 'Writing · Nhìn lại bài học'] },
  ];
  const assignments = lessons.map(({ session, title }) => ({
    assignment_id: id(session), public_token: id(100 + session), class_id: '9041',
    class_name: 'IC2481', session_number: session, title, status: 'published',
  }));
  const names = [
    'Bùi Hoàng Anh', 'Đỗ Khánh Linh', 'Lê Minh Châu', 'Lý Gia Hân', 'Nguyễn Anh Duy',
    'Nguyễn Hà My', 'Nguyễn Minh Khang', 'Phạm Thảo Nguyên', 'Trần Đức Anh', 'Vũ Bảo Ngọc',
  ];
  const openParts = new Map();
  const releaseWrites = [];
  const writes = [];
  const authoringWrites = [];
  const drafts = new Map();
  const aiSource = 'When is the meeting now?\nA. Friday\nB. Tuesday\nAnswer: B';
  const aiQuestion = 'When is the meeting now?';
  const studentRef = id(500);
  const studentName = names[0];
  const accessToken = 'progress-log-ic2481-bui-hoang-anh';
  const attemptToken = id(710);
  const firstQuestion = id(414);
  const reflectionQuestion = id(714);
  const reflection = 'Em nghe được “Friday” nhưng bỏ lỡ “moved to”.';
  const feedback = 'Lần tới em nghe lại cả cụm “moved to Tuesday”, rồi nói lại ngày mới bằng một câu đầy đủ nhé.';
  const attempt = { draft: {}, revision: 0, checkpoints: [], started: false };
  let afterClass = false;
  let comment = null;
  const json = (data, status = 200) => new Response(JSON.stringify(data), {
    status, headers: { 'Content-Type': 'application/json' },
  });
  const success = data => json({ ok: true, ...data });
  const unknown = () => json({ ok: false, message: 'Không có dữ liệu cho thao tác này.' }, 404);
  const blocksFor = assignment => {
    const number = assignment.session_number;
    return lessons.find(lesson => lesson.session === number).parts.map((title, index) => ({
      blockId: id(200 + number * 2 + index), checkpoint: index + 1, title,
      items: number === 7 && index === 0 ? [{
        itemVersionId: firstQuestion, itemFamilyId: firstQuestion, position: 1, displayNumber: '1',
        prompt: 'The meeting was planned for Friday, but it has been moved to Tuesday. What day is the meeting now?',
        skillCodes: ['listening'], interactionType: 'single_choice', layoutType: 'choice_cards',
        graderType: 'exact', maxScore: 1, options: [
          { id: 'A', label: 'Friday' }, { id: 'B', label: 'Tuesday' }, { id: 'C', label: 'Thursday' },
        ],
      }, {
        itemVersionId: reflectionQuestion, itemFamilyId: reflectionQuestion, position: 2, displayNumber: '2',
        prompt: 'Điều gì khiến em dễ chọn nhầm ở câu vừa rồi?',
        skillCodes: ['listening'], interactionType: 'long_text', graderType: 'none', maxScore: 0, options: [],
      }] : [{
        itemVersionId: id(400 + number * 2 + index), position: 1, displayNumber: '1',
        prompt: 'Điều em muốn ghi nhớ sau hoạt động này là gì?',
        skillCodes: [number === 7 ? ['listening', 'speaking'][index] : 'reading'],
        interactionType: 'long_text', graderType: 'none', maxScore: 0, options: [],
      }, ...(number === 6 && index === 0 ? [{
        itemVersionId: id(716), position: 2, displayNumber: '2', prompt: 'Em làm đúng bao nhiêu câu Matching Headings?',
        skillCodes: ['reading'], interactionType: 'number_score', layoutType: 'score_fraction',
        interactionConfig: { max: 10 }, graderType: 'none', maxScore: 0, options: [],
      }] : [])],
    }));
  };
  const record = (assignment, index) => {
    const number = assignment.session_number;
    const blocks = blocksFor(assignment);
    if (number === 7 && index === 0) {
      return {
        started: attempt.started, full: afterClass,
        values: { ...attempt.draft, ...(afterClass ? { [blocks[1].items[0].itemVersionId]: 'The meeting has been moved to Tuesday.' } : {}) },
        checkpoints: afterClass ? blocks.map(({ blockId }) => ({ blockId })) : attempt.checkpoints,
      };
    }
    const full = number === 6 && index < 8 || number === 7 && afterClass && index < 8;
    const partial = number === 6 && index === 8;
    let values = {};
    if (number === 7 && full) values = {
      [firstQuestion]: index < 5 ? 'A' : 'B',
      [reflectionQuestion]: index < 5 ? 'Em nghe thấy ngày đầu tiên nên chọn luôn.' : 'Em nghe được cụm nói đổi lịch.',
      [blocks[1].items[0].itemVersionId]: 'The meeting is on Tuesday.',
    };
    if (number === 6 && full) values = {
      [blocks[0].items[0].itemVersionId]: 'Em đọc ý chính của cả đoạn rồi mới chọn heading.',
      [id(716)]: { correct: 7, total: 10 },
      [blocks[1].items[0].itemVersionId]: 'Em cần tránh chọn theo một từ trùng với tiêu đề.',
    };
    return { started: full || partial, full, values, checkpoints: blocks.slice(0, full ? 2 : partial ? 1 : 0).map(({ blockId }) => ({ blockId })) };
  };
  const submissionIdFor = (assignment, index) => id(3000 + 10 * assignment.session_number + index);
  const studentsFor = assignment => names.map((name, index) => {
    const { full, checkpoints } = record(assignment, index);
    return {
      name, studentRef: id(500 + index), current: true, submissionId: full ? submissionIdFor(assignment, index) : null,
      checkpoints, attendanceStatus: checkpoints.length ? 'self_confirmed' : null,
      portalSync: full && assignment.session_number === 6
        ? { status: 'complete', portalStatus: 'synced', readbackAt: '2026-11-11T12:45:00Z' } : null,
      sessionComment: assignment.session_number === 7 && index === 0 ? comment : null,
    };
  });
  const byNumber = number => assignments.find(assignment => assignment.session_number === Number(number));
  const formVersionId = assignment => id(1000 + assignment.session_number);
  const definitionHash = 'a'.repeat(64);
  const definitionFor = assignment => ({
    schemaVersion: 'FormDefinitionV1', formVersionId: formVersionId(assignment), kind: 'mixed',
    title: assignment.title, blocks: blocksFor(assignment), answerReleasePolicy: 'hidden',
  });
  const blockReleases = assignment => blocksFor(assignment).map(({ blockId, checkpoint }) => ({
    blockId, checkpoint, status: openParts.get(blockId) || (assignment.session_number === 6 ? 'closed' : 'locked'),
  }));
  const submissionWindow = assignment => ({
    canSubmit: assignment.session_number === 7,
    effectiveClosesAt: afterClass ? '2026-11-14T15:00:00Z' : null,
    completeStudents: afterClass ? 8 : 0,
    serverNow: afterClass ? '2026-11-14T13:15:00Z' : '2026-11-14T12:00:00Z',
  });
  const grades = (assignment, values) => blocksFor(assignment).flatMap(({ items }) => items.map(item => {
    const rawAnswer = values[item.itemVersionId] ?? '';
    const scored = item.itemVersionId === firstQuestion;
    const score = scored && rawAnswer === 'B' ? 1 : 0;
    return { itemVersionId: item.itemVersionId, rawAnswer, maxScore: item.maxScore,
      verdict: scored ? score ? 'correct' : 'incorrect' : 'ungraded', score, scoreEarned: score };
  }));
  const classInfo = { classId: '9041', name: 'IC2481' };
  const person = { studentRef, name: studentName };
  const detailFor = assignment => {
    const saved = record(assignment, 0);
    return { classId: classInfo.classId, student: person, sessionNumber: assignment.session_number,
      status: saved.full ? 'complete' : 'not_submitted', definition: definitionFor(assignment),
      submissionId: saved.full ? submissionIdFor(assignment, 0) : null,
      responses: saved.values, gradingItems: grades(assignment, saved.values),
      sessionComment: assignment.session_number === 7 ? comment : null };
  };
  const journey = () => ({
    schemaVersion: 'StudentCourseJourneyV1', class: classInfo, student: person,
    coverage: { schedule: 'teacher_confirmed', plannedSessions: 8, testResults: 'connected', portalTests: 'connected' },
    summary: { totalSessions: 8, submittedComplete: afterClass ? 2 : 1, attendedSessions: attempt.checkpoints.length ? 2 : 1, availableReports: 0 },
    reports: [],
    externalTests: [{
      testSlug: 'mini-test-erp-56', title: 'Mini Test', source: 'erp_56_mini_test', completedAt: '2026-11-08T12:40:00Z',
      listening: { correct: 7, total: 10 }, reading: { correct: 9, total: 13 },
    }],
    sessions: assignments.map(assignment => {
      const n = assignment.session_number;
      return { sessionNumber: n, classId: classInfo.classId, title: assignment.title,
        sessionDate: { 6: '2026-11-11', 7: '2026-11-14', 8: '2026-11-18' }[n],
        assignmentId: assignment.assignment_id, publicToken: assignment.public_token,
        assignmentStatus: 'published', sessionKind: 'lesson', completeness: record(assignment, 0).full ? 'complete' : null,
        submissionWindow: submissionWindow(assignment), sessionComment: n === 7 ? comment : null,
        quizSummary: n === 7 && afterClass ? { correct: 0, incorrect: 1, graded: 1 } : null };
    }),
  });
  const answersFor = (assignment, item) => {
    const objective = item.itemVersionId === firstQuestion;
    const students = studentsFor(assignment).flatMap((student, index) => {
      const { full, values } = record(assignment, index);
      if (!full) return [];
      const answer = values[item.itemVersionId] ?? '';
      return [{ name: student.name, studentRef: student.studentRef, answer, answerState: answer ? 'answered' : 'blank',
        verdict: objective ? answer === 'B' ? 'correct' : 'incorrect' : 'ungraded' }];
    });
    const count = verdict => students.filter(row => row.verdict === verdict).length;
    return { assignmentId: assignment.assignment_id, formVersionId: formVersionId(assignment), itemVersionId: item.itemVersionId,
      position: item.position, objective, options: item.options, responseVersion: afterClass ? 'after-class' : 'in-class',
      correctOptionIds: objective ? ['B'] : [],
      explanation: objective ? '“Has been moved to Tuesday” cho biết lịch mới là thứ Ba. Friday là lịch ban đầu.' : '',
      counts: { visible: students.length, answered: students.filter(row => row.answerState === 'answered').length,
        graded: count('correct') + count('incorrect'), correct: count('correct'), incorrect: count('incorrect'),
        pending: 0, manual: 0, ungraded: count('ungraded') },
      students };
  };

  window.PROGRESS_LOG_CONFIG = { API_BASE_URL: location.origin };
  // Giữ phiên mẫu ngay cả khi thư viện phiên chung khởi tạo trên tên miền Pages.
  Object.defineProperty(window, 'IzoneTeacherSso', {
    value: Object.freeze({ restore: async product => product === 'mapping' }),
  });
  window.presentationData = {
    targetClass: 'IC2481', targetAssignment: id(7), targetTitle: lessons[1].title,
    publicToken: byNumber(7).public_token, studentName, studentRef, firstQuestion, reflectionQuestion,
    reflection, feedback, accessToken,
    aiSource, aiQuestion,
    reset() {
      openParts.clear();
      drafts.clear();
      Object.assign(attempt, { draft: {}, revision: 0, checkpoints: [], started: false });
      afterClass = false;
      comment = null;
      localStorage.removeItem('progress-log:draft:' + id(7) + ':' + studentRef);
      localStorage.removeItem('progress-log-comment-draft-v1:' + reviewer.email + ':9041:' + studentRef + ':7');
    },
    finishClass() {
      if (!attempt.checkpoints.length) throw Error('Chưa có bài Listening để chuyển sang kết quả.');
      afterClass = true;
      openParts.set(blocksFor(byNumber(7))[1].blockId, 'open');
    },
    writes() { return structuredClone(releaseWrites); },
    inspect() { return structuredClone({ attempt, afterClass, comment, writes, authoringWrites, drafts: [...drafts.values()] }); },
  };

  const realFetch = window.fetch.bind(window);
  const request = async (input, options = {}) => {
    const url = new URL(input instanceof Request ? input.url : input, location.href);
    if (url.origin !== location.origin) throw new Error('Địa chỉ ngoài phiên trình chiếu.');
    const method = (options.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
    if (url.pathname === '/api/auth/session' && method === 'GET') return success({ reviewer });
    if (url.pathname === '/api/student-identity/resolve' && method === 'POST') {
      const wanted = JSON.parse(options.body || '{}');
      if (wanted.studentRef && wanted.studentRef !== studentRef) return unknown();
      return success({ status: 'unique', identity: { authority: 'erp-contact', id: '9041500' },
        aliases: [{ classId: classInfo.classId, classCode: classInfo.name, studentRef, studentName }] });
    }
    if (!url.pathname.startsWith('/api/learning/')) return realFetch(input, options);
    const path = url.pathname.slice('/api/learning'.length);
    const body = options.body ? JSON.parse(options.body) : {};
    if (method === 'GET' && path === '/teacher/form-library') return success({ entries: [] });
    if (method === 'GET' && path === '/teacher/form-publications') return success({ publications: [] });
    if (method === 'GET' && path === '/teacher/form-drafts/review-queue') return success({ drafts: [] });
    if (method === 'GET' && path === '/teacher/form-drafts') return success({ drafts: [...drafts.values()] });
    if (method === 'POST' && path === '/teacher/form-drafts') {
      const draftId = id(880 + drafts.size);
      const draft = { ...body, id: draftId, worksheetId: draftId, scope: 'personal',
        classId: body.classId || classInfo.classId, sessionNumber: body.sessionNumber || 1,
        status: 'draft', revision: 1, contentHash: 'b'.repeat(64) };
      drafts.set(draftId, draft);
      authoringWrites.push({ action: 'create', draftId });
      return success({ draft });
    }
    const authorRoute = path.match(/^\/teacher\/form-drafts\/([^/]+)(?:\/(ai-import-preview))?$/);
    if (authorRoute) {
      const draft = drafts.get(authorRoute[1]);
      if (!draft) return unknown();
      if (authorRoute[2] && method === 'POST') {
        if (body.text !== aiSource || body.expectedRevision !== draft.revision) return unknown();
        const definition = structuredClone(draft.definition);
        const gradingKey = structuredClone(draft.gradingKey);
        const itemId = id(899);
        definition.blocks[0].items.push({
          itemVersionId: itemId, itemFamilyId: itemId, kind: 'exercise',
          position: definition.blocks[0].items.length + 1, prompt: aiQuestion, required: true,
          helpText: '', skillCodes: ['listening'], pedagogicalTypeCode: 'multiple_choice',
          interactionType: 'single_choice', layoutType: 'choice_cards', graderType: 'exact_option', maxScore: 1,
          options: [{ id: 'A', label: 'Friday' }, { id: 'B', label: 'Tuesday' }],
          interactionConfig: {}, releasePolicy: 'inherit',
        });
        gradingKey.items[itemId] = { graderType: 'exact_option', expectedOptionId: 'B' };
        authoringWrites.push({ action: 'ai-preview', draftId: draft.id });
        return success({ preview: { baseRevision: draft.revision, payload: { definition, gradingKey }, errors: [], warnings: [] } });
      }
      if (method === 'GET' && !authorRoute[2]) return success({ draft });
      if (method === 'PUT' && body.expectedRevision === draft.revision) {
        Object.assign(draft, { definition: body.definition, gradingKey: body.gradingKey, revision: draft.revision + 1 });
        authoringWrites.push({ action: 'save', draftId: draft.id });
        return success({ draft });
      }
      return unknown();
    }
    const activeAssignment = byNumber(7);
    const ownAttempt = body.attemptToken === attemptToken;
    const ownEntry = body.publicToken === activeAssignment.public_token && body.studentRef === studentRef;
    const ownJourney = body.accessToken === accessToken || ownEntry || ownAttempt;
    if (path === '/assignments/open' && method === 'POST') {
      const assignment = assignments.find(row => row.public_token === body.publicToken);
      if (!assignment) return unknown();
      return success({ assignment: {
        assignmentId: assignment.assignment_id, publicToken: assignment.public_token, title: assignment.title,
        class: { id: classInfo.classId, name: classInfo.name }, courseCode: '56', sessionNumber: assignment.session_number,
        definition: definitionFor(assignment), definitionHash, roster: names.map((name, index) => ({
          name, studentRef: id(500 + index),
        })), blockReleases: blockReleases(assignment), submissionWindow: submissionWindow(assignment),
      } });
    }
    if (path === '/student/course-journey' && ownJourney) return success({ journey: journey() });
    if (path === '/student/course-session-detail' && ownJourney) {
      const assignment = byNumber(body.sessionNumber);
      if (!assignment) return unknown();
      if (!record(assignment, 0).full) return json({ ok: false, error: 'JOURNEY_SUBMISSION_NOT_READY', message: 'Buổi này chưa có bài nộp cuối.' }, 409);
      return success({ detail: detailFor(assignment) });
    }
    if (path === '/student/session-comments' && ownJourney) return success({
      classId: classInfo.classId, studentRef, comments: comment ? [comment] : [],
    });
    if ((path === '/attempts/start' || path === '/attempts/resume') && ownEntry && body.identityConfirmed) {
      if (path.endsWith('/resume') && !attempt.started) return unknown();
      attempt.started = true;
      return success({ attempt: { attemptToken, assignmentId: activeAssignment.assignment_id, definitionHash,
        draft: attempt.draft, draftRevision: attempt.revision, checkpointSubmissions: attempt.checkpoints,
        identity: { studentRef, studentName, classId: classInfo.classId, className: classInfo.name, sessionNumber: 7 },
      } });
    }
    if (path === '/attempts/draft' && method === 'PATCH' && ownAttempt && body.definitionHash === definitionHash) {
      attempt.draft = structuredClone(body.responses);
      attempt.revision = body.revision;
      return success({ draft: { revision: attempt.revision } });
    }
    if (path === '/attempts/checkpoints/submit' && method === 'POST' && ownAttempt) {
      const first = blocksFor(activeAssignment)[0];
      if (body.blockId !== first.blockId || openParts.get(first.blockId) !== 'open' ||
          body.draftRevision !== attempt.revision || body.definitionHash !== definitionHash) return unknown();
      const existing = attempt.checkpoints.find(row => row.blockId === first.blockId);
      if (existing) return success({ checkpointSubmission: existing });
      const checkpointSubmission = { blockId: first.blockId, checkpoint: 1, checkpointSubmissionId: body.checkpointSubmissionId,
        attendance: { status: 'self_confirmed' }, result: { answerRelease: 'hidden', items: grades(activeAssignment, attempt.draft) } };
      attempt.checkpoints.push(checkpointSubmission);
      writes.push({ action: 'checkpoint', blockId: first.blockId, values: structuredClone(attempt.draft) });
      return success({ checkpointSubmission });
    }
    if (path === '/teacher/session-comments/editor' && method === 'GET' &&
        url.searchParams.get('studentRef') === studentRef && url.searchParams.get('sessionNumber') === '7') {
      return success({ classId: classInfo.classId, studentRef, sessionNumber: 7, comment, draft: null });
    }
    if (path === '/teacher/session-comments/send' && method === 'POST' &&
        body.studentRef === studentRef && String(body.classId) === classInfo.classId && body.sessionNumber === 7 &&
        afterClass && body.noteText.trim() && body.expectedRevision === (comment?.revision || 0)) {
      comment = { classId: classInfo.classId, studentRef, sessionNumber: 7,
        noteText: body.noteText, visibility: 'visible', revision: body.expectedRevision + 1, draftRevision: 0,
        authorDisplayName: reviewer.name, updatedAt: '2026-11-14T13:20:00Z' };
      writes.push({ action: 'comment', studentRef, sessionNumber: 7, noteText: comment.noteText });
      return success({ comment });
    }
    if (path === '/teacher/blocks/release' && method === 'POST') {
      const assignment = assignments.find(row => row.assignment_id === body.assignmentId);
      if (!assignment || !blocksFor(assignment).some(block => block.blockId === body.blockId) ||
          !['open', 'closed'].includes(body.status)) return unknown();
      openParts.set(body.blockId, body.status);
      releaseWrites.push({ assignmentId: body.assignmentId, blockId: body.blockId, status: body.status });
      return success({ status: body.status });
    }
    if (method !== 'GET') return unknown();
    if (path === '/teacher/options') return success({ reviewer, classes, assignments, capabilities: { questionResponses: true } });
    const analyticsRoute = path.match(/^\/teacher\/assignments\/([^/]+)\/question-analytics(?:\/([^/]+)\/responses)?$/);
    if (analyticsRoute) {
      const assignment = assignments.find(row => row.assignment_id === analyticsRoute[1]);
      if (!assignment) return unknown();
      const items = blocksFor(assignment).flatMap(block => block.items);
      if (analyticsRoute[2]) {
        const item = items.find(row => row.itemVersionId === analyticsRoute[2]);
        return item ? success({ detail: answersFor(assignment, item) }) : unknown();
      }
      return success({ analytics: { assignmentId: assignment.assignment_id, formVersionId: formVersionId(assignment),
        submittedCount: studentsFor(assignment).filter(student => student.submissionId).length, rosterCount: names.length,
        items: items.map(item => {
          const { students, ...analytics } = answersFor(assignment, item);
          return analytics;
        }) } });
    }
    const assignment = assignments.find(row => row.assignment_id === url.searchParams.get('assignment'));
    if (!assignment) return unknown();
    if (path === '/teacher/dashboard') {
      return success({ dashboard: {
        assignmentId: assignment.assignment_id, publicToken: assignment.public_token,
        classId: assignment.class_id, className: assignment.class_name, sessionNumber: assignment.session_number,
        title: assignment.title, definition: definitionFor(assignment),
        students: studentsFor(assignment), classInsights: [], journeyCommentsEnabled: true,
        blockReleases: blockReleases(assignment),
      } });
    }
    if (path === '/teacher/live-drafts') return success({ live: {
      assignmentId: assignment.assignment_id, generatedAt: '2026-11-14T13:20:00Z',
      students: studentsFor(assignment).flatMap((student, index) => {
        const saved = record(assignment, index);
        if (!saved.started) return [];
        return [{ ...student, attemptId: id(2000 + index), draftRevision: saved.full ? 1 : attempt.revision,
          draftResponses: saved.values, finalResponses: saved.full ? saved.values : {},
          draftUpdatedAt: '2026-11-14T12:10:00Z', submittedAt: '2026-11-14T13:12:00Z',
          gradingResult: { items: grades(assignment, saved.values) },
        }];
      }),
    } });
    if (path === '/teacher/question-analytics') return success({ analytics: {
      assignmentId: assignment.assignment_id, submittedCount: 0, rosterCount: names.length, items: [],
    } });
    return unknown();
  };
  window.presentationRequest = window.fetch = request;
})();

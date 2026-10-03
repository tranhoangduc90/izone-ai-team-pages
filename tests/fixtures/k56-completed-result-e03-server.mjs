// Nhận vào: source backend đã khóa revision và một bài giả đã hoàn thành.
// Tạo PostgreSQL trong RAM, nạp kết quả và gọi handler đọc kết quả thật.
// Chỉ cổng localhost được mở; mọi route khác bị chặn, Portal dùng bộ đếm giả.
// Trả server và phép audit trước/sau; lỗi làm bài kiểm dừng, không gọi production.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export async function createCompletedResultFixture({ backendRoot, pagesRoot, fixture, item }) {
  const requireBackend = createRequire(pathToFileURL(resolve(backendRoot, 'backend/package.json')));
  const express = requireBackend('express');
  const { PGlite } = requireBackend('@electric-sql/pglite');
  const { createApp } = await import(pathToFileURL(resolve(backendRoot, 'backend/src/app.js')));
  const { createAssessmentSchemaPool } = await import(pathToFileURL(resolve(backendRoot, 'backend/src/assessment-schema-pool.js')));
  const { createTermTestWritingGradingService } = await import(pathToFileURL(resolve(backendRoot, 'backend/src/term-test-writing-grading.js')));
  const database = new PGlite();
  const runKey = `${item.slug}:${item.attemptToken}:task${item.taskNumber}:v1`;
  const taskResult = {
    taskNumber: item.taskNumber, taskScore: item.score, report: item.feedback,
    criteria: [item.taskNumber === 1 ? 'TA' : 'TR', 'CC', 'LR', 'GRA'].map(code => ({
      code, name: code, bandScore: item.score, feedback: item.feedback, components: []
    }))
  };
  // Kho trống này chỉ cần các cột mà handler kết quả và dịch vụ chấm thật sử dụng.
  await database.exec(`CREATE SCHEMA assessment_k56;
    CREATE TABLE assessment_k56.test_definition (slug text, title text, version int);
    CREATE TABLE assessment_k56.term_test_attempt (
      id uuid PRIMARY KEY, test_slug text, definition_version int,
      erp_course_class_id bigint, erp_student_contact_id bigint,
      class_name_snapshot text, student_name_snapshot text, exam_session_id uuid,
      listening_submitted_at timestamptz, reading_started_at timestamptz,
      reading_deadline_at timestamptz, reading_draft_updated_at timestamptz,
      reading_submitted_at timestamptz, completed_at timestamptz,
      writing_task_1 text, writing_task_2 text, writing_draft_revision int,
      writing_started_at timestamptz, writing_deadline_at timestamptz,
      writing_updated_at timestamptz, writing_submitted_at timestamptz,
      listening_result jsonb, combined_result jsonb
    );`);
  const migration = await readFile(resolve(backendRoot, 'docs/migrations/2026-08-19-term-test-writing-grading.sql'), 'utf8');
  await database.exec(migration.replace(/\bassessment\./gu, 'assessment_k56.'));
  const combined = {
    testTitle: item.title,
    listening: { correct: item.listeningCorrect, total: 40, details: [], typeStats: [] },
    reading: { correct: item.readingCorrect, total: item.readingTotal, details: [], typeStats: [] }
  };
  await database.query('INSERT INTO assessment_k56.test_definition VALUES ($1, $2, 1)', [item.slug, item.title]);
  await database.query(`INSERT INTO assessment_k56.term_test_attempt (
    id, test_slug, definition_version, erp_course_class_id, erp_student_contact_id,
    class_name_snapshot, student_name_snapshot, listening_submitted_at,
    reading_submitted_at, completed_at, writing_task_1, writing_task_2,
    writing_draft_revision, writing_started_at, writing_submitted_at, combined_result
  ) VALUES ($1::uuid, $2, 1, 99000301, 99000301, $3, $4, $5::timestamptz,
    $5::timestamptz, $5::timestamptz, $6, $7, 1, $5::timestamptz, $5::timestamptz, $8::jsonb)`,
  [item.attemptToken, item.slug, fixture.classCode, fixture.studentName, fixture.completedAt,
    item.taskNumber === 1 ? item.essay : '', item.taskNumber === 2 ? item.essay : '', JSON.stringify(combined)]);
  const run = await database.query(`INSERT INTO assessment_k56.term_test_writing_grading_run (
    attempt_id, task_number, grading_version, run_key, prompt_text, essay_text,
    word_count, status, task_score, result_json, completed_at
  ) VALUES ($1::uuid, $2, 1, $3, 'Đề giả E-03', $4, $5, 'complete', $6, $7::jsonb, $8::timestamptz)
    RETURNING id::text`, [item.attemptToken, item.taskNumber, runKey, item.essay,
    item.essay.split(/\s+/u).length, item.score, JSON.stringify(taskResult), fixture.completedAt]);
  for (const jobType of ['dispatch', 'collect']) {
    await database.query(`INSERT INTO assessment_k56.term_test_writing_grading_job
      (run_id, job_type, idempotency_key, status, completed_at)
      VALUES ($1::uuid, $2, $3, 'complete', $4::timestamptz)`,
    [run.rows[0].id, jobType, `${runKey}:${jobType}`, fixture.completedAt]);
  }
  await database.query(`INSERT INTO assessment_k56.term_test_writing_grading_final
    (attempt_id, grading_version, task_1_score, task_2_score, writing_score, status, ready_at)
    VALUES ($1::uuid, 1, $2, $3, $4, 'ready', $5::timestamptz)`, [item.attemptToken,
    item.taskNumber === 1 ? item.score : null, item.taskNumber === 2 ? item.score : null, item.score, fixture.completedAt]);

  // PGlite có một kết nối; giữ transaction tuần tự để mô phỏng khóa cùng một attempt của pg.
  let transactionTail = Promise.resolve();
  const query = async (sql, params) => {
    const result = await database.query(sql, params);
    return { ...result, rowCount: result.rows.length };
  };
  const pool = createAssessmentSchemaPool({
    query,
    async connect() {
      const previous = transactionTail;
      let release;
      transactionTail = new Promise(done => { release = done; });
      await previous;
      return { query, release };
    }
  }, { family: 'k56' });
  const counters = { resultReads: 0, portalWrites: 0, blockedApiWrites: 0 };
  const allowedOrigins = new Set();
  const writer = async () => { counters.portalWrites += 1; return { status: 'synced' }; };
  const gradingService = createTermTestWritingGradingService({ pool, syncErpGrades: writer });
  const backendApp = createApp({
    config: { nodeEnv: 'test', authMode: 'legacy', allowedOrigins,
      trustProxyHops: 0, deploymentProfileName: 'k56-ic2264' },
    pool, syncErpGrades: writer, termTestWritingGradingService: gradingService,
    termTestPortalSyncService: {
      getStatus: async () => 'synced',
      enqueue: writer
    },
    termTestAssetService: {
      getContent: async () => ({ writing: { tasks: [{ id: `task${item.taskNumber}`, prompt: 'Đề giả E-03' }] } })
    },
    logger: { info() {}, error() {} }
  });
  const app = express();
  app.use('/fixture-api', (req, res, next) => {
    if (req.method !== 'POST' || req.path !== '/api/term-tests/result') {
      counters.blockedApiWrites += 1;
      return res.status(405).json({ error: 'E03_FIXTURE_READ_ONLY' });
    }
    counters.resultReads += 1;
    return next();
  }, backendApp);
  app.use(express.static(pagesRoot));
  const server = await new Promise(done => {
    const listening = app.listen(0, '127.0.0.1', () => done(listening));
  });
  allowedOrigins.add(`http://127.0.0.1:${server.address().port}`);
  const tables = ['term_test_attempt', 'term_test_writing_grading_run', 'term_test_writing_grading_job', 'term_test_writing_grading_final'];
  return {
    url: `http://127.0.0.1:${server.address().port}`, counters,
    async audit() {
      const snapshot = {};
      for (const table of tables) {
        const rows = await database.query(`SELECT to_jsonb(row) AS data FROM assessment_k56.${table} AS row ORDER BY to_jsonb(row)::text`);
        snapshot[table] = rows.rows.map(row => row.data);
      }
      return snapshot;
    },
    async injectExtraJobForProbe() {
      await database.query(`INSERT INTO assessment_k56.term_test_writing_grading_job
        (run_id, job_type, idempotency_key) VALUES ($1::uuid, 'dispatch', 'E03-probe-extra-job')`, [run.rows[0].id]);
    },
    async close() {
      // Đóng cổng trước rồi ngắt kết nối tải audio còn mở của fixture localhost.
      // Không áp dụng cho server thật; giúp teardown kết thúc sau khi browser đã đóng.
      const closed = new Promise((done, fail) => server.close(error => error ? fail(error) : done()));
      server.closeAllConnections();
      await closed;
      await database.close();
    }
  };
}

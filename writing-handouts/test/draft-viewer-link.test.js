// Link giả kiểm hợp đồng kết quả; không gọi mạng hoặc chấm bài.
import test from 'node:test';
import assert from 'node:assert/strict';
import { safeLmsUrl } from '../js/core.js';

const viewer = `https://ducizone.ddns.net/writing/shared/writing-essays/${'a'.repeat(48)}/edit`;

test('Draft nhận link viewer mới để tải đủ thẻ nhận xét', () => {
  assert.equal(safeLmsUrl(viewer), viewer);
});

test('Draft chặn link giả, credential, port và biến thể chưa hỗ trợ', () => {
  for (const value of [
    viewer.replace('https:', 'http:'), viewer.replace('ducizone.ddns.net', 'ducizone.ddns.net.evil.example'),
    viewer.replace('https://', 'https://user:password@'), viewer.replace('.net/', '.net:444/'),
    viewer + '?url=https://evil.example', viewer + '#fragment', viewer.replace('/edit', '/view?v=1'),
    viewer.replace('a'.repeat(48), 'a'.repeat(47)), viewer.replace('/writing/shared/', '/shared/'),
    'https://user:password@practice.izone.edu.vn/shared/writing-essays/legacy-id/edit',
  ]) assert.equal(safeLmsUrl(value), null, value);
});

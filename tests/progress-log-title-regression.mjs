import test from 'node:test';
import assert from 'node:assert/strict';
import {contentTitle,sessionHeading} from '../progress-log/session-presentation.js';
// Phiếu cũ có tên lớp/số buổi trong title: chỉ giữ nội dung đã xác nhận.
test('Production title regression: bỏ metadata lớp/buổi và không bịa nội dung',()=>{
  for(const title of ['IC2304 · Buổi 4','IC2304 · Buổi 4 · Progress Log','Progress Log'])
    assert.equal(contentTitle({sessionNumber:4},{title}),'Nội dung chưa được xác nhận');
  assert.equal(sessionHeading({sessionNumber:4},{title:'IC2304 · Buổi 4 · Listening 2 + Writing 1'}),'Buổi 04 · Listening 2 + Writing 1');
  assert.equal(contentTitle({}, {title:'Progress Log - Buổi 3 - Reading 3 + Writing 1'}),'Reading 3 + Writing 1');
  assert.equal(contentTitle({}, {title:'ENTRANCE TICKET • LISTENING 1 + SPEAKING 2'}),'Listening 1 + Speaking 2');
});

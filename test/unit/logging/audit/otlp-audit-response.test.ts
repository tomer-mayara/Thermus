import assert from 'node:assert/strict';
import test from 'node:test';
import { interpretAuditResponse, type AuditHttpResponse } from '../../../../src/logs/audit/otlp-audit-response.ts';

const now = Date.parse('2026-10-23T12:00:00Z');
type ResponseHead = Partial<Omit<AuditHttpResponse, 'body'>>;
const response = (body: string, { statusCode = 200, contentType = 'application/json', retryAfter }: ResponseHead = {}) => interpretAuditResponse({ statusCode, contentType, retryAfter, body: Buffer.from(body) }, now);

for (const body of ['{}', '{"futureField":true}', '{"partialSuccess":null}', '{"partialSuccess":{}}', '{"partialSuccess":{"rejectedLogRecords":"0","errorMessage":""}}']) {
  test(`Given a valid full response ${body}, when decoded, then acceptance is confirmed`, () => assert.deepEqual(response(body), { kind: 'accepted' }));
}
for (const count of ['"0"', '0']) {
  test(`Given a zero-rejection warning with count ${count}, when decoded, then the warning has no raw diagnostic`, () => assert.deepEqual(response(`{"partialSuccess":{"rejectedLogRecords":${count},"errorMessage":"private raw detail"}}`), { kind: 'warning' }));
}
for (const count of ['"1"', '1']) {
  test(`Given rejection count ${count}, when decoded, then the caller receives one rejected record`, () => assert.deepEqual(response(`{"partialSuccess":{"rejectedLogRecords":${count}}}`), { kind: 'partial_rejection', rejectedRecords: 1 }));
}
for (const body of ['', '{', '[]', 'null', '42', '{"partialSuccess":[]}', '{"partialSuccess":{"rejectedLogRecords":"2"}}', '{"partialSuccess":{"rejectedLogRecords":-1}}', '{"partialSuccess":{"rejectedLogRecords":"9223372036854775808"}}', '{"partialSuccess":{"errorMessage":{}}}', '{"partialSuccess":{"rejectedLogRecords":1.5}}']) {
  test(`Given invalid success response ${body}, when decoded, then acceptance is unconfirmed without retry`, () => assert.deepEqual(response(body), { kind: 'unconfirmed', reason: 'invalid_response' }));
}
for (const contentType of ['text/html', 'application/x-protobuf', '', 'application/jsonx']) {
  test(`Given HTTP 200 with ${contentType || 'no content type'}, when decoded, then it cannot confirm acceptance`, () => assert.deepEqual(response('{}', { contentType }), { kind: 'unconfirmed', reason: 'invalid_response' }));
}
test('Given JSON with charset, when decoded, then it is accepted', () => assert.deepEqual(response('{}', { contentType: 'application/json; charset=utf-8' }), { kind: 'accepted' }));
for (const statusCode of [301, 302, 307, 308, 400, 401, 403, 404, 408, 500, 501, 505]) {
  test(`Given HTTP ${statusCode}, when decoded, then there is no redirect or retry`, () => assert.deepEqual(response('{}', { statusCode }), { kind: 'permanent_failure', reason: 'http_status', statusCode }));
}
for (const statusCode of [429, 502, 503, 504]) {
  test(`Given HTTP ${statusCode} with an HTML error, when decoded, then status remains retryable`, () => assert.deepEqual(response('<html>private failure</html>', { statusCode, contentType: 'text/html' }), { kind: 'transient_failure', reason: 'http_status', statusCode }));
}
test('Given Retry-After seconds, when decoded, then the full delay is returned', () => assert.deepEqual(response('{}', { statusCode: 503, retryAfter: '12' }), { kind: 'transient_failure', reason: 'http_status', statusCode: 503, retryAfterMs: 12_000 }));
test('Given Retry-After date, when decoded, then the full delay is returned', () => assert.equal(response('{}', { statusCode: 429, retryAfter: 'Fri, 23 Oct 2026 12:00:10 GMT' }).retryAfterMs, 10_000));
test('Given a past Retry-After date, when decoded, then delay is zero', () => assert.equal(response('{}', { statusCode: 429, retryAfter: 'Fri, 23 Oct 2026 11:00:00 GMT' }).retryAfterMs, 0));
for (const value of ['86401', '999999999999999999999999', 'Sat, 24 Oct 2026 12:00:01 GMT']) {
  test(`Given excessive Retry-After ${value}, when decoded, then work is dropped without shortening the delay`, () => assert.deepEqual(response('{}', { statusCode: 503, retryAfter: value }), { kind: 'permanent_failure', reason: 'retry_after_exceeds_limit', statusCode: 503 }));
}
for (const value of ['bad', '-1', '1.5', '1e3']) {
  test(`Given invalid Retry-After ${value}, when decoded, then status is preserved without a server delay`, () => assert.deepEqual(response('{}', { statusCode: 503, retryAfter: value }), { kind: 'transient_failure', reason: 'http_status', statusCode: 503 }));
}
test('Given an oversized HTTP 503 body, when decoded, then oversize forbids retry', () => assert.deepEqual(response('x'.repeat(16_385), { statusCode: 503 }), { kind: 'unconfirmed', reason: 'response_too_large' }));
test('Given invalid UTF-8 in a success body, when decoded, then acceptance is unconfirmed', () => assert.deepEqual(interpretAuditResponse({ statusCode: 200, contentType: 'application/json', body: Buffer.from([0x7b, 0x22, 0x78, 0x22, 0x3a, 0x22, 0xff, 0x22, 0x7d]) }, now), { kind: 'unconfirmed', reason: 'invalid_response' }));

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PageFetchFailure } from '../../../src/page-fetch/fetch-failure.ts';

for (const status of [400, 403, 404, 418, 429, 500, 503, 599]) {
  test(`Given an HTTP ${status} failure, when its public failure is made, then it reports that status`, () => {
    assert.equal(new PageFetchFailure({ category: 'http', phase: 'renderer_result', httpStatus: status }).message, `Page fetch failed: HTTP ${status}`);
  });
}

for (const status of [undefined, null, 399, 600, 429.5, NaN, Infinity, '429', '429\nPRIVATE']) {
  test(`Given an HTTP failure with unavailable status ${String(status)}, when its public failure is made, then it uses fixed text`, () => {
    assert.equal(new PageFetchFailure({ category: 'http', phase: 'renderer_result', httpStatus: status }).message, 'Page fetch failed: HTTP request failed (status unavailable)');
  });
}

for (const [diagnostic, detail] of [
  [{ category: 'readiness_timeout', phase: 'renderer_process', budgetMs: 20_000 }, 'Renderer readiness timed out'],
  [{ category: 'dns_timeout', phase: 'destination_policy', budgetMs: 5_000 }, 'DNS lookup timed out'],
  [{ category: 'http', phase: 'renderer_process', exitCode: 22, metadata: 'absent' }, 'HTTP request failed (status unavailable)'],
  [{ category: 'http', phase: 'renderer_process', exitCode: 22, metadata: 'invalid' }, 'HTTP request failed (status unavailable)'],
  [{ category: 'launch', phase: 'renderer_launch' }, 'Renderer could not start'],
  ...['ENOENT', 'EACCES', 'ENOEXEC', 'ENOTDIR'].map((code) => [{ category: 'launch', phase: 'renderer_launch', processErrorCode: code }, `Renderer could not start (${code})`] as const),
  ...['ENOTFOUND', 'EAI_AGAIN'].map((code) => [{ category: 'unknown', phase: 'destination_policy', processErrorCode: code }, 'DNS lookup failed'] as const),
  [{ category: 'renderer', phase: 'renderer_result', rendererErrorCode: 'OperationTimedout' }, 'Renderer request timed out'],
  [{ category: 'renderer', phase: 'renderer_result', rendererErrorCode: 'HttpError' }, 'HTTP request failed (status unavailable)'],
  ...['CouldntResolveHost', 'CouldntResolveProxy'].map((code) => [{ category: 'renderer', phase: 'renderer_result', rendererErrorCode: code }, 'DNS lookup failed'] as const),
  ...['CouldntConnect', 'NoConnectionAvailable'].map((code) => [{ category: 'renderer', phase: 'renderer_result', rendererErrorCode: code }, 'Renderer connection failed'] as const),
  ...['SslConnectError', 'PeerFailedVerification', 'SslCertproblem', 'SslCacertBadfile', 'SslIssuerError', 'SslPinnedpubkeynotmatch', 'SslInvalidcertstatus', 'UseSslFailed'].map((code) => [{ category: 'renderer', phase: 'renderer_result', rendererErrorCode: code }, 'Renderer TLS failed'] as const),
  [{ category: 'renderer', phase: 'renderer_result', rendererErrorCode: 'TooManyRedirects' }, 'Renderer redirect limit exceeded'],
  ...['ReadError', 'SendError', 'RecvError'].map((code) => [{ category: 'renderer', phase: 'renderer_result', rendererErrorCode: code }, 'Renderer transfer failed'] as const),
  [{ category: 'unknown', phase: 'renderer_process', processErrorCode: 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER' }, 'Renderer output limit exceeded'],
  [{ category: 'unknown', phase: 'renderer_process', killed: true, httpStatus: 429 }, 'Renderer process was killed'],
  [{ category: 'unknown', phase: 'renderer_process', signal: 'SIGTERM', httpStatus: 429 }, 'Renderer process was interrupted'],
  [{ category: 'unknown', phase: 'renderer_result', exitCode: 1, httpStatus: 200 }, 'Renderer process failed'],
] as const) {
  test(`Given ${JSON.stringify(diagnostic)}, when its public failure is made, then only the safe diagnosis is retained`, () => {
    const failure = new PageFetchFailure({ ...diagnostic, message: 'PRIVATE', cause: new Error('PRIVATE'), html: 'PRIVATE' });
    assert.equal(failure.message, `Page fetch failed: ${detail}`);
    assert.equal(failure.cause, undefined);
    assert.equal(Object.hasOwn(failure, 'diagnostic'), false);
    assert.doesNotMatch(JSON.stringify(failure), /PRIVATE/);
  });
}

for (const diagnostic of [
  undefined, null, [], 'PRIVATE', {}, { category: 'PRIVATE', phase: 'renderer_result', httpStatus: 429 },
  { category: 'unknown', phase: 'renderer_result', httpStatus: 429 },
  { category: 'renderer', phase: 'renderer_result', rendererErrorCode: 'PRIVATE' },
  { category: 'renderer', phase: 'renderer_result', rendererErrorCode: '__proto__' },
  { category: 'renderer', phase: 'renderer_result', rendererErrorCode: 'toString' },
  { category: 'http', phase: 'PRIVATE', httpStatus: 429 },
  { category: 'validation', phase: 'destination_policy', reason: 'blocked_destination' },
  { category: 'unknown', phase: 'renderer_process', signal: 'PRIVATE', killed: 'true', exitCode: '1' },
]) {
  test(`Given an unclassified diagnostic ${JSON.stringify(diagnostic)}, when its public failure is made, then it falls back safely`, () => {
    assert.equal(new PageFetchFailure(diagnostic).message, 'Page fetch failed');
  });
}

for (const code of ['EPRIVATE', 'ENOENT\nPRIVATE', '__proto__', 'toString', 22]) {
  test(`Given an unapproved launch code ${String(code)}, when its public failure is made, then no code is shown`, () => {
    assert.equal(new PageFetchFailure({ category: 'launch', phase: 'renderer_launch', processErrorCode: code }).message, 'Page fetch failed: Renderer could not start');
  });
}

for (const interrupted of [{ killed: true }, { signal: 'SIGTERM' }]) {
  test(`Given an HTTP status with interruption evidence ${JSON.stringify(interrupted)}, when its public failure is made, then HTTP is not claimed as the cause`, () => {
    assert.doesNotMatch(new PageFetchFailure({ category: 'http', phase: 'renderer_result', httpStatus: 429, ...interrupted }).message, /HTTP/);
  });
}

test('Given a nonstring process code, when its public failure is made, then the code is not coerced or read as public evidence', () => {
  const code = { toString: () => { throw new Error('PRIVATE'); } };
  assert.equal(new PageFetchFailure({ category: 'unknown', phase: 'destination_policy', processErrorCode: code }).message, 'Page fetch failed');
});

test('Given a public failure with an overwritten Error message, when its public message is requested, then the selected safe diagnosis remains', () => {
  const diagnostic = { category: 'http', phase: 'renderer_result', httpStatus: 429 };
  const failure = new PageFetchFailure(diagnostic);
  diagnostic.httpStatus = 500;
  failure.message = 'PRIVATE message';
  assert.equal(failure.publicMessage, 'Page fetch failed: HTTP 429');
});

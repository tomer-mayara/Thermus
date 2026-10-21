import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SearchFailure } from '../../../src/pipelines/search/search-failure.ts';

let caseNumber = 0;
for (const [diagnostic, detail] of [
  [{ phase: 'renderer_result', category: 'http', httpStatus: 429 }, 'HTTP 429'],
  [{ phase: 'renderer_result', category: 'renderer', rendererErrorCode: 'SslConnectError' }, 'Renderer TLS failed'],
  [{ phase: 'renderer_result', category: 'renderer', rendererErrorCode: 'CouldntConnect' }, 'Renderer connection failed'],
  [{ phase: 'renderer_launch', category: 'launch', processErrorCode: 'ENOENT' }, 'Renderer could not start (ENOENT)'],
  [{ phase: 'renderer_process', category: 'unknown', processErrorCode: 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER' }, 'Renderer output limit exceeded'],
  [{ phase: 'renderer_process', category: 'unknown', exitCode: 1 }, 'Renderer process failed'],
  [{ phase: 'renderer_process', category: 'unknown', killed: true }, 'Renderer process was killed'],
  [null, undefined],
  [{ phase: 'renderer_result', category: 'renderer', rendererErrorCode: 'private' }, undefined],
  [{ get phase() { throw new Error('private getter'); } }, undefined],
] as const) {
  test(`Given renderer detail ${detail ?? 'none'} from case ${++caseNumber}, when search failure is made, then only bounded safe detail survives`, () => {
    const error = new SearchFailure(diagnostic);
    assert.equal(error.publicMessage, detail === undefined ? 'Search failed' : `Search failed: ${detail}`);
    assert.equal(error.cause, undefined); assert.doesNotMatch(JSON.stringify(error), /private/);
    error.message = 'changed'; assert.notEqual(error.publicMessage, error.message);
  });
}

for (const status of [400, 599, 399, 600, Infinity, '429', undefined]) {
  test(`Given HTTP status ${status}, when mapped, then only valid bounded status survives`, () => {
    assert.equal(new SearchFailure({ phase: 'renderer_result', category: 'http', httpStatus: status }).publicMessage,
      typeof status === 'number' && Number.isInteger(status) && status >= 400 && status <= 599 ? `Search failed: HTTP ${status}` : 'Search failed: HTTP request failed (status unavailable)');
  });
}
for (const [label, diagnostic, detail] of [
  ['readiness', { phase: 'renderer_process', category: 'readiness_timeout' }, 'Renderer readiness timed out'],
  ['DNS timeout', { phase: 'destination_policy', category: 'dns_timeout' }, 'DNS lookup timed out'],
  ['DNS lookup', { phase: 'destination_policy', processErrorCode: 'ENOTFOUND' }, 'DNS lookup failed'],
  ['DNS retry', { phase: 'destination_policy', processErrorCode: 'EAI_AGAIN' }, 'DNS lookup failed'],
  ['unknown DNS', { phase: 'destination_policy', processErrorCode: 'private' }, undefined],
  ['unknown launch', { phase: 'renderer_launch', category: 'launch', processErrorCode: 'private' }, 'Renderer could not start'],
  ['launch access', { phase: 'renderer_launch', category: 'launch', processErrorCode: 'EACCES' }, 'Renderer could not start (EACCES)'],
  ['known signal', { phase: 'renderer_process', signal: 'SIGTERM' }, 'Renderer process was interrupted'],
  ['unknown signal', { phase: 'renderer_process', signal: 'private' }, undefined],
  ['unknown process code', { phase: 'renderer_process', processErrorCode: 'private' }, undefined],
  ['exit maximum', { phase: 'renderer_process', exitCode: 255 }, 'Renderer process failed'],
  ['exit zero', { phase: 'renderer_process', exitCode: 0 }, undefined],
  ['exit oversized', { phase: 'renderer_process', exitCode: 256 }, undefined],
  ['exit fractional', { phase: 'renderer_process', exitCode: 1.5 }, undefined],
  ['exit string', { phase: 'renderer_process', exitCode: '1' }, undefined],
  ['exit infinity', { phase: 'renderer_process', exitCode: Infinity }, undefined],
  ['renderer timeout', { phase: 'renderer_result', category: 'renderer', rendererErrorCode: 'OperationTimedout' }, 'Renderer request timed out'],
] as const) {
  test(`Given ${label}, when mapped, then only approved public detail survives`, () => {
    assert.equal(new SearchFailure(diagnostic).publicMessage, detail === undefined ? 'Search failed' : `Search failed: ${detail}`);
  });
}
test('Given mutable input diagnostics, when changed after construction, then the captured public message remains fixed', () => {
  const diagnostic = { phase: 'renderer_result', category: 'http', httpStatus: 429 };
  const error = new SearchFailure(diagnostic); diagnostic.httpStatus = 500; diagnostic.phase = 'private';
  assert.equal(error.publicMessage, 'Search failed: HTTP 429');
});

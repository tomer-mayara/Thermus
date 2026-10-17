import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assertServerRedirect } from '../../support/dsl/hosted-live-response.ts';

const location = 'https://localhost:46443/invitations';

test('Given an invitation change that failed, when its redirect is checked, then the failure names its status and the last three operator errors without response credentials', () => {
  const reports = ['ERROR old failure', 'ERROR first failure', 'INFO account change', 'ERROR second failure', 'ERROR WorkOS failed (status 503, code server_error, request ID request-503)'];
  const answer = { status: 500, location: undefined, body: 'invitation-secret', setCookies: ['session-secret'] };

  assert.throws(() => assertServerRedirect(answer, location, reports), (error: unknown) => {
    assert.ok(error instanceof Error);
    assert.equal(error.message, `Expected a 303 redirect to ${location}; the server gave 500. The last operator reports:\n${reports[1]}\n${reports[3]}\n${reports[4]}`);
    assert.doesNotMatch(error.message, /old failure|account change|invitation-secret|session-secret/);
    return true;
  });
});

test('Given a change that redirects elsewhere, when its redirect is checked, then it fails with the operator report and does not print the returned location', () => {
  assert.throws(() => assertServerRedirect({ status: 303, location: 'https://example.com/invite?token=secret' }, location, ['ERROR change failed']), (error: unknown) => {
    assert.ok(error instanceof Error);
    assert.match(error.message, /server gave 303/);
    assert.match(error.message, /ERROR change failed/);
    assert.doesNotMatch(error.message, /token=secret/);
    return true;
  });
});

test('Given a successful invitation change, when its redirect is checked, then it passes only with 303 and the expected location', () => {
  assert.doesNotThrow(() => assertServerRedirect({ status: 303, location }, location, []));
});

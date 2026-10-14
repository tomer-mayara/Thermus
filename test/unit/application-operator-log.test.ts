import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GenericServerException, OauthException, RateLimitExceededException } from '@workos-inc/node';
import { accountChangeRecorder, accountFailureReporter, operatorFailureReporter } from '../../src/application.ts';
import type { FailureReport } from '../../src/mcp/mcp-server.ts';
import type { ChangeRecord } from '../../src/organizations/change-records.ts';

class RecordingLogger {
  readonly lines: string[] = [];
  readonly info = (message: string): void => { this.lines.push(message); };
  readonly error = (message: string): void => { this.lines.push(`ERROR ${message}`); };
}

const reports: ReadonlyArray<{ label: string; report: FailureReport; line: string }> = [
  {
    label: 'a token-verification report with an error cause',
    report: { step: 'token-verification', cause: new Error('identity provider unavailable') },
    line: 'An MCP request failed unexpectedly in token-verification: Error: identity provider unavailable',
  },
  {
    label: 'an access-resolution report with an error cause',
    report: { step: 'access-resolution', cause: new RangeError('membership lookup timed out') },
    line: 'An MCP request failed unexpectedly in access-resolution: RangeError: membership lookup timed out',
  },
  {
    label: 'a report with a cause that is not an error',
    report: { step: 'access-resolution', cause: 'membership store closed' },
    line: 'An MCP request failed unexpectedly in access-resolution: membership store closed',
  },
];

for (const { label, report, line } of reports) {
  test(`Given ${label}, when the application gives it to the operator, then the log gets one error line with the failed step and the cause`, () => {
    const logger = new RecordingLogger();

    operatorFailureReporter(logger)(report);

    assert.deepEqual(logger.lines, [`ERROR ${line}`]);
  });
}

test('Given an account failure report, when the application gives it to the operator, then the log gets one error line with the path and the cause, also for a cause that is not an error', () => {
  const logger = new RecordingLogger();

  accountFailureReporter(logger)({ path: '/team/organizations', cause: new Error('organization directory timed out') });
  accountFailureReporter(logger)({ path: '/team/organizations/select', cause: 'session provider closed' });

  assert.deepEqual(logger.lines, [
    'ERROR An account request failed unexpectedly for /team/organizations: Error: organization directory timed out',
    'ERROR An account request failed unexpectedly for /team/organizations/select: session provider closed',
  ]);
});

// The pinned SDK wraps an answer that is not JSON, such as an HTML 502 page of the WorkOS edge, and a request without an
// answer, in an Error whose cause holds the facts. The SDK does not export these causes, so they are copied by shape.
// Its ParseError always has the status 500, and the status of the answer in rawStatus.
function unexpectedError(cause: Error): Error {
  return new Error(`Unexpected error: ${String(cause)}`, { cause });
}

const htmlAnswer = Object.assign(new Error('Unexpected token \'<\', "<html>" is not valid JSON'), { name: 'ParseError', status: 500, rawStatus: 502, requestID: 'request-html-502' });
const closedConnection = new TypeError('fetch failed', { cause: Object.assign(new Error('other side closed'), { code: 'UND_ERR_SOCKET' }) });

const providerFailures: ReadonlyArray<{ label: string; cause: unknown; line: string }> = [
  {
    label: 'a WorkOS 503 answer',
    cause: new GenericServerException(503, undefined, { code: 'server_error' }, 'request-503'),
    line: 'GenericServerException: The request could not be completed. (status 503, code server_error, request ID request-503)',
  },
  {
    label: 'a WorkOS 429 answer',
    cause: new RateLimitExceededException('Too many requests', 'request-429', null),
    line: 'RateLimitExceededException: Too many requests (status 429, request ID request-429)',
  },
  {
    label: 'a WorkOS read without an answer before the client timeout, which the SDK gives as 408',
    cause: new OauthException(408, '', 'Request timeout', undefined, { error: 'Request timeout' }),
    line: 'OauthException: Error: Request timeout (status 408)',
  },
  {
    label: 'a WorkOS answer that is an HTML page',
    cause: unexpectedError(htmlAnswer),
    line: `Error: Unexpected error: ${String(htmlAnswer)} (status 502, request ID request-html-502)`,
  },
  {
    label: 'a WorkOS read whose connection closed',
    cause: unexpectedError(closedConnection),
    line: 'Error: Unexpected error: TypeError: fetch failed (code UND_ERR_SOCKET)',
  },
];

for (const { label, cause, line } of providerFailures) {
  test(`Given an account failure caused by ${label}, when the application gives it to the operator, then the line also names the status, the code, and the request ID of the answer that the failure or its causes carry`, () => {
    const logger = new RecordingLogger();

    accountFailureReporter(logger)({ path: '/team/members', cause });

    assert.deepEqual(logger.lines, [`ERROR An account request failed unexpectedly for /team/members: ${line}`]);
  });
}

test('Given an account failure whose status, code, or request ID is not a short token, when the application gives it to the operator, then the line names only the fields that are, so that a field cannot add a line or a long text', () => {
  const logger = new RecordingLogger();
  const cause = Object.assign(new Error('directory failed'), { status: '500\nERROR forged line', code: 'a'.repeat(101), requestID: 'request 01' });

  accountFailureReporter(logger)({ path: '/team/members', cause: Object.assign(new Error('page failed', { cause }), { status: 500 }) });

  assert.deepEqual(logger.lines, ['ERROR An account request failed unexpectedly for /team/members: Error: page failed (status 500)']);
});

test('Given privileged change records, when the hosted application keeps them, then the operator log gets one info line for each with the record as JSON, also for a value with a line break', () => {
  const logger = new RecordingLogger();
  const records: readonly ChangeRecord[] = [
    {
      time: '2026-10-13T12:00:00.000Z',
      actor: { authority: 'hosted-provider-double', subject: 'user-sam' },
      organizationId: 'org-a',
      target: { membershipId: 'membership-user-sam-org-a' },
      action: 'grant',
      role: 'admin',
      outcome: 'applied',
    },
    {
      time: '2026-10-13T12:01:00.000Z',
      actor: { authority: 'hosted-provider-double', subject: 'user-eve' },
      organizationId: 'org-a',
      target: { email: 'new@example.com\nERROR forged line' },
      action: 'invite',
      role: 'admin',
      outcome: 'denied',
    },
  ];

  for (const record of records) accountChangeRecorder(logger).record(record);

  assert.deepEqual(logger.lines, records.map((record) => `Account change record: ${JSON.stringify(record)}`));
  assert.ok(logger.lines.every((line) => !line.includes('\n')));
});

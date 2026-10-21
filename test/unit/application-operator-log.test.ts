import assert from 'node:assert/strict';
import { test } from 'node:test';
import { accountChangeRecorder, accountFailureReporter, operatorFailureReporter } from '../../src/app/application.ts';
import type { FailureReport } from '../../src/interfaces/mcp/mcp-server.ts';
import type { ChangeRecord } from '../../src/accounts/organizations/change-records.ts';

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

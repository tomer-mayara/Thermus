import assert from 'node:assert/strict';
import { test } from 'node:test';
import { operatorFailureReporter } from '../../src/application.ts';
import type { FailureReport } from '../../src/mcp/mcp-server.ts';

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

import type { FailureReport } from '../../../../src/mcp/mcp-server.ts';

export class FailureReporterMock {
  readonly reports: FailureReport[] = [];

  readonly report = (report: FailureReport): void => {
    this.reports.push(report);
  };
}

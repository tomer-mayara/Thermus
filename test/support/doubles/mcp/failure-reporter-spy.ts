import type { FailureReport } from '../../../../src/interfaces/mcp/mcp-server.ts';

export class FailureReporterSpy {
  readonly reports: FailureReport[] = [];

  readonly report = (report: FailureReport): void => {
    this.reports.push(report);
  };
}

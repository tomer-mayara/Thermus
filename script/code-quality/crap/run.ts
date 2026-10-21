import type { StageReport } from '../shared/report.ts';
import type { CrapCommand } from './command-line.ts';
import { goalRowsOf } from './input.ts';
import { crapReportOf } from './report.ts';
import { selectionOf, type Selection } from './selection.ts';

type ReportCommand = Extract<CrapCommand, { kind: 'report' }>;

export async function runCrap(command: ReportCommand, selection: Selection = selectionOf(command)): Promise<StageReport> {
  if (selection.paths.length === 0) return { text: 'No production files to assess.\n', passed: true };
  const report = crapReportOf(await goalRowsOf(command, selection), command);
  return { text: `${report.text}\n`, passed: report.passed };
}

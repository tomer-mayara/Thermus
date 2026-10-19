import type { ArchitectureCommand } from './command-line.ts';
import { crapDeltaOf } from './crap-delta.ts';
import { mapSourcesOf } from './input.ts';
import { architectureReportOf } from './report.ts';
import { trendLinesOf } from './trend.ts';

type ReportCommand = Extract<ArchitectureCommand, { readonly kind: 'report' }>;

// Render every section before a caller can publish a verified history record.
export async function prepareArchitecture(command: ReportCommand, coverageNotice?: string) {
  const measured = await mapSourcesOf(command);
  const sources = coverageNotice === undefined ? measured : { ...measured, coverageNotice };
  const delta = crapDeltaOf(sources);
  const architecture = architectureReportOf(sources, delta);
  const render = (record: boolean) => `${[architecture, ...trendLinesOf({ ...command, record }, sources, delta)].join('\n')}\n`;
  return { text: render(false), publish: () => render(true) };
}

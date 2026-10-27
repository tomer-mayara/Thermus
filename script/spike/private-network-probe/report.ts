import type { RateLimits } from '../render-tenant-lifecycle/render-client.ts';
import { ROLES, serviceLine, type ProbeContext } from './context.ts';

function cell(value: string | undefined): string {
  return value === undefined ? 'absent' : value.replaceAll('|', '\\|');
}

function limitCells(limits: RateLimits): string {
  return [limits.limit, limits.remaining, limits.reset, limits.retryAfter].map(cell).join(' | ');
}

function transcript(context: ProbeContext): readonly string[] {
  const { startCommand, transcript: lines } = context.report;
  if (startCommand === undefined) return ['No job ran in this run.'];
  const fence = '```';
  const table = lines.length === 0 ? ['No log line of this run was found.'] : [
    '| Line | Timestamp | Labels |', '| --- | --- | --- |',
    ...lines.map((line, index) => `| ${index + 1} | ${cell(line.timestamp)} | ${cell(line.labels)} |`), '',
    'The messages of these lines, verbatim:', '', `${fence}text`, ...lines.map((line) => line.message), fence,
  ];
  return ['The start command of the job, as sent:', '', `${fence}text`, startCommand, fence, '', 'The log lines of this run, as GET /logs gave them:', '', ...table];
}

export function renderReport(context: ProbeContext): string {
  const { report, client, inputs } = context;
  const services = ROLES.map((role) => `${context.state.services[role].label} ${serviceLine(context.state.services[role])}`).join(' and ');
  return [
    '## Render private network probe', '',
    `Node ${process.version}. Start ${context.startedAt.toISOString()}. The ${services}, in ${inputs.region}, owner ${inputs.owner}.`,
    'Times are seconds on the clock of this machine, from the start of the write that began each wait.', '',
    '| Step | Check | Expected | Measured |', '| --- | --- | --- | --- |',
    ...report.rows.map((row) => `| ${row.step} | ${cell(row.check)} | ${cell(row.expected)} | ${cell(row.measured)} |`), '',
    '### Job transcript', '', ...transcript(context), '',
    '### Writes, durations, and rate-limit headers', '',
    `Writes in this run: ${client.writes.length}. Reads: ${client.reads}; the last read had Ratelimit-Limit ${cell(client.lastReadLimits.limit)}, Ratelimit-Remaining ${cell(client.lastReadLimits.remaining)}, and Ratelimit-Reset ${cell(client.lastReadLimits.reset)}.`, '',
    '| Step | Call | Status | Duration | Ratelimit-Limit | Ratelimit-Remaining | Ratelimit-Reset | Retry-After |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
    ...client.writes.map((write) => `| ${write.step} | \`${write.call}\` | ${write.status} | ${(write.ms / 1_000).toFixed(2)} s | ${limitCells(write.limits)} |`), '',
    '### Conclusions', '', ...report.conclusions, '',
  ].join('\n');
}

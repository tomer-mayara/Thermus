import type { ProbeContext } from './context.ts';
import type { RateLimits } from './render-client.ts';

function cell(value: string | undefined): string {
  return value === undefined ? 'absent' : value.replaceAll('|', '\\|');
}

function limitCells(limits: RateLimits): string {
  return [limits.limit, limits.remaining, limits.reset, limits.retryAfter].map(cell).join(' | ');
}

export function renderReport(context: ProbeContext): string {
  const { report, client, inputs } = context;
  const service = context.state.serviceId === undefined ? 'no service ID' : context.state.serviceId;
  return [
    '## Render private service lifecycle probe', '',
    `Node ${process.version}. Start ${context.startedAt.toISOString()}. Service ${context.name} (${service}) in ${inputs.region}, owner ${inputs.owner}.`,
    'Times are seconds on the clock of this machine, from the start of the write that began each wait.', '',
    '| Step | Check | Expected | Measured |', '| --- | --- | --- | --- |',
    ...report.rows.map((row) => `| ${row.step} | ${cell(row.check)} | ${cell(row.expected)} | ${cell(row.measured)} |`), '',
    '### Writes, durations, and rate-limit headers', '',
    `Writes in this run: ${client.writes.length}. Reads: ${client.reads}; the last read had Ratelimit-Limit ${cell(client.lastReadLimits.limit)}, Ratelimit-Remaining ${cell(client.lastReadLimits.remaining)}, and Ratelimit-Reset ${cell(client.lastReadLimits.reset)}.`, '',
    '| Step | Call | Status | Duration | Ratelimit-Limit | Ratelimit-Remaining | Ratelimit-Reset | Retry-After |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
    ...client.writes.map((write) => `| ${write.step} | \`${write.call}\` | ${write.status} | ${(write.ms / 1_000).toFixed(2)} s | ${limitCells(write.limits)} |`), '',
    '### Fields for the Slice 2 provisioner', '',
    '| Field | Answer | Value |', '| --- | --- | --- |',
    ...report.fields.map((field) => `| \`${field.field}\` | ${cell(field.answer)} | ${cell(field.value)} |`), '',
    '### Conclusions', '', ...report.conclusions, '',
  ].join('\n');
}

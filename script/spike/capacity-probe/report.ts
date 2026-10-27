import { FREE_PLAN, TEAM_PLAN } from '../render-tenant-lifecycle/calls.ts';
import type { RateLimits } from '../render-tenant-lifecycle/render-client.ts';
import { ROLES, serviceLine, type CallRecord, type ProbeContext, type WindowRecord } from './context.ts';
import { firstKilled } from './windows.ts';

function cell(value: string | undefined): string {
  return value === undefined ? 'absent' : value.replaceAll('|', '\\|');
}

function limitCells(limits: RateLimits): string {
  return [limits.limit, limits.remaining, limits.reset, limits.retryAfter].map(cell).join(' | ');
}

function durations(calls: readonly CallRecord[]): string {
  const values = calls.map((call) => call.ms / 1_000).sort((a, b) => a - b);
  if (values.length === 0) return 'none';
  const median = values[Math.floor((values.length - 1) / 2)] ?? 0;
  return `${(values[0] ?? 0).toFixed(1)} / ${median.toFixed(1)} / ${(values.at(-1) ?? 0).toFixed(1)}`;
}

function outcomes(calls: readonly CallRecord[]): string {
  const counts = new Map<string, number>();
  for (const call of calls) counts.set(call.outcome, (counts.get(call.outcome) ?? 0) + 1);
  return [...counts].map(([outcome, count]) => `${count} ${outcome}`).join(', ');
}

function characters(calls: readonly CallRecord[]): string {
  const sizes = [...new Set(calls.map((call) => call.chars))].sort((a, b) => a - b);
  return sizes.join(', ');
}

function windowRows(windows: readonly WindowRecord[]): readonly string[] {
  return [
    '| Instance | Parallelism | Workload | Outcomes | Duration s, min / median / max | Result characters | Peak memory | Memory limit | CPU peak | Instances | Kills | Restart | Metrics lag | Events |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    ...windows.map((item) => `| ${item.plan} | ${item.parallelism} | ${item.workload} | ${cell(outcomes(item.calls))} | ${durations(item.calls)} | ${characters(item.calls)} | ${cell(item.memory)} | ${cell(item.limit)} | ${cell(item.cpu)} | ${cell(item.instances)} | ${item.kills} | ${cell(item.restart)} | ${cell(item.lag)} | ${cell(item.events)} |`),
  ];
}

function callRows(windows: readonly WindowRecord[]): readonly string[] {
  return [
    '| Instance | Parallelism | Workload | Call | Outcome | Duration | Characters |', '| --- | --- | --- | --- | --- | --- | --- |',
    ...windows.flatMap((item) => item.calls.map((call) => `| ${item.plan} | ${item.parallelism} | ${item.workload} | ${call.index} | ${cell(call.outcome)} | ${(call.ms / 1_000).toFixed(1)} s | ${call.chars} |`)),
  ];
}

function killLines(windows: readonly WindowRecord[]): readonly string[] {
  return [FREE_PLAN, TEAM_PLAN].filter((plan) => windows.some((item) => item.plan === plan)).map((plan) => {
    const first = firstKilled(windows, plan);
    const renderer = windows.filter((item) => item.plan === plan && item.calls.some((call) => call.outcome.includes('Renderer process was killed'))).map((item) => item.parallelism);
    const killed = first === undefined ? 'no window had a server_failed event' : `the first parallelism with a server_failed event is ${first}`;
    return `- ${plan}: ${killed}; ${renderer.length === 0 ? 'no call reported a killed renderer' : `the first parallelism with a killed renderer is ${Math.min(...renderer)}`}.`;
  });
}

function header(context: ProbeContext): readonly string[] {
  const { inputs } = context;
  const services = ROLES.map((role) => `${context.state.services[role].label} ${serviceLine(context.state.services[role])}`).join(' and ');
  const tokens = context.state.tokens;
  return [
    '## Capacity and memory probe', '',
    `Node ${process.version}. Start ${context.startedAt.toISOString()}. The ${services}, in ${inputs.region}, owner ${inputs.owner}.`,
    `Image ${inputs.image.ref}. Parallelism ${inputs.parallelism.join(', ')}; workloads ${inputs.workloads.join(', ')}.`,
    `Connect token: ${tokens === undefined ? 'none' : `lifetime ${tokens.lifetimeSeconds} s, ${tokens.refreshes} refreshes`}. Times are seconds on the clock of this machine.`,
  ];
}

export function renderReport(context: ProbeContext): string {
  const { report, client } = context;
  return [
    ...header(context), '',
    '| Step | Check | Expected | Measured |', '| --- | --- | --- | --- |',
    ...report.rows.map((row) => `| ${row.step} | ${cell(row.check)} | ${cell(row.expected)} | ${cell(row.measured)} |`), '',
    '### Windows', '', ...(report.windows.length === 0 ? ['No window ran in this run.'] : windowRows(report.windows)), '',
    '### First killed parallelism', '', ...(report.windows.length === 0 ? ['No window ran in this run.'] : killLines(report.windows)), '',
    '### Calls', '', ...(report.windows.length === 0 ? ['No call ran in this run.'] : callRows(report.windows)), '',
    '### Render writes, durations, and rate-limit headers', '',
    `Writes in this run: ${client.writes.length}. Reads: ${client.reads}; the last read had Ratelimit-Limit ${cell(client.lastReadLimits.limit)}, Ratelimit-Remaining ${cell(client.lastReadLimits.remaining)}, and Ratelimit-Reset ${cell(client.lastReadLimits.reset)}.`, '',
    '| Step | Call | Status | Duration | Ratelimit-Limit | Ratelimit-Remaining | Ratelimit-Reset | Retry-After |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
    ...client.writes.map((write) => `| ${write.step} | \`${write.call}\` | ${write.status} | ${(write.ms / 1_000).toFixed(2)} s | ${limitCells(write.limits)} |`), '',
    '### WorkOS Staging writes', '',
    '| Step | Call | Result | Duration |', '| --- | --- | --- | --- |',
    ...report.workosWrites.map((write) => `| ${write.step} | \`${write.call}\` | ${write.status} | ${(write.ms / 1_000).toFixed(2)} s |`), '',
    '### Conclusions', '', ...report.conclusions, '',
  ].join('\n');
}

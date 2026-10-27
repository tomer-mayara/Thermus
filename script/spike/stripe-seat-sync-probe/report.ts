import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import type { WriteRecord } from './calls.ts';
import type { CreatedObject, ProbeContext, Row, SeatEvent } from './context.ts';
import { redact } from './secrets.ts';
import { STRIPE_SDK } from './stripe-client.ts';

function cell(value: string): string {
  return redact(value).replaceAll('|', '\\|').replace(/\s*\n\s*/g, ' ');
}

function packageVersion(name: string): string {
  try {
    const entry = pathToFileURL(createRequire(import.meta.url).resolve(name));
    for (const relative of ['../package.json', '../../package.json']) {
      const manifest = JSON.parse(readFileSync(new URL(relative, entry), 'utf8')) as { name?: unknown; version?: unknown };
      if (manifest.name === name && typeof manifest.version === 'string') return manifest.version;
    }
  } catch {
    return 'unknown';
  }
  return 'unknown';
}

function rowLine(row: Row): string {
  return `| ${row.step} | ${cell(row.check)} | ${cell(row.expected)} | ${cell(row.measured)} |`;
}

function seatTable(events: readonly SeatEvent[]): readonly string[] {
  if (events.length === 0) return ['No membership changed in this run.'];
  return [
    '| Change | Active memberships in WorkOS | Meter value | Delay after the WorkOS answer |', '| --- | --- | --- | --- |',
    ...events.map((event) => `| ${cell(event.change)} | ${cell(event.memberships)} | ${cell(event.meter)} | ${cell(event.delay)} |`),
  ];
}

function objectsTable(objects: readonly CreatedObject[]): readonly string[] {
  if (objects.length === 0) return ['This run created no object.'];
  return [
    '| System | Object | ID | Created in | Cleanup |', '| --- | --- | --- | --- | --- |',
    ...objects.map((object) => `| ${object.system} | ${object.kind} | \`${object.id}\` | ${object.step} | ${cell(object.outcome ?? 'not reached')} |`),
  ];
}

function writesTable(writes: readonly WriteRecord[]): readonly string[] {
  if (writes.length === 0) return ['No write in this run.'];
  return [
    '| Step | Call | Status | Duration |', '| --- | --- | --- | --- |',
    ...writes.map((write) => `| ${write.step} | \`${cell(write.call)}\` | ${write.status} | ${(write.ms / 1_000).toFixed(2)} s |`),
  ];
}

function header(context: ProbeContext): string {
  const cli = context.state.cliVersion ?? 'not used';
  const versions = `Node ${process.version}, stripe ${STRIPE_SDK.version} (API version ${STRIPE_SDK.apiVersion}), @workos-inc/node ${packageVersion('@workos-inc/node')}, Stripe CLI ${cli}`;
  const steps = context.inputs.sweep ? 'the sweep of earlier runs' : context.inputs.steps.join(', ');
  return `${versions}. Start ${context.startedAt.toISOString()}. Run \`${context.run}\`. Steps: ${steps}${context.inputs.workosOnly ? ' (WorkOS only)' : ''}. Times are seconds on the clock of this machine.`;
}

export function renderReport(context: ProbeContext): string {
  const { report, state } = context;
  const writes = [...(context.workos?.writes ?? []), ...(context.stripe?.writes ?? [])].sort((first, second) => first.at - second.at);
  const reads = (context.workos?.reads ?? 0) + (context.stripe?.reads ?? 0);
  return [
    '## Stripe seat sync probe', '', header(context), '',
    '| Step | Check | Expected | Measured |', '| --- | --- | --- | --- |', ...report.rows.map(rowLine), '',
    '### Seat events', '', ...seatTable(report.seatEvents), '',
    '### Objects created and deleted', '', ...objectsTable(state.created), '',
    '### Writes', '', `Writes: ${writes.length}. Reads: ${reads}.`, '', ...writesTable(writes), '',
    '### Conclusions', '', ...report.conclusions.map(redact), '',
  ].join('\n');
}

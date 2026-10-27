import type { ProbeInputs } from './inputs.ts';
import type { RenderClient } from './render-client.ts';

export interface Row {
  readonly step: string;
  readonly check: string;
  readonly expected: string;
  readonly measured: string;
}

export interface Field {
  readonly field: string;
  readonly answer: string;
  readonly value: string;
}

interface Report {
  readonly rows: Row[];
  readonly fields: Field[];
  readonly conclusions: string[];
}

interface RunState {
  createSent: boolean;
  serviceId?: string;
  serviceName?: string;
  credentialId?: string;
}

export interface ProbeContext {
  readonly inputs: ProbeInputs;
  readonly name: string;
  readonly client: RenderClient;
  readonly report: Report;
  readonly state: RunState;
  readonly signal: AbortSignal;
  readonly startedAt: Date;
}

export interface ProbeStep {
  readonly name: string;
  readonly spec: string;
  run(context: ProbeContext): Promise<string>;
}

export function serviceIdOf(context: ProbeContext): string {
  const id = context.state.serviceId;
  if (id === undefined) throw new Error('No service: the create step did not finish.');
  return id;
}

export function addRow(context: ProbeContext, step: string, values: Omit<Row, 'step'>): void {
  context.report.rows.push({ step, ...values });
}

export function addField(context: ProbeContext, field: string, values: Omit<Field, 'field'>): void {
  context.report.fields.push({ field, ...values });
}

export function progress(line: string): void {
  process.stderr.write(`render-tenant-lifecycle: ${line}\n`);
}

export function seconds(ms: number): string {
  return `${(ms / 1_000).toFixed(1)} s`;
}

export function shown(value: string | number | undefined): string {
  return value === undefined || value === '' ? 'absent' : `\`${value}\``;
}

export function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

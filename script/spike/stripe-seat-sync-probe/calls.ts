import type { ProbeInputs } from './inputs.ts';

// One SDK call of the probe. The dry run prints the REST line, the SDK method, and the parameters; real mode passes
// the same parameters to the same SDK method, so the printed parameters are the sent parameters.
type Method = 'GET' | 'POST' | 'PUT' | 'DELETE';

export interface Call<Client, Result> {
  readonly method: Method;
  readonly path: string;
  readonly sdk: string;
  readonly params?: unknown;
  readonly send: (client: Client) => Promise<Result>;
}

export interface WriteRecord {
  readonly at: number;
  readonly step: string;
  readonly call: string;
  readonly status: string;
  readonly ms: number;
}

export interface PlannedCall {
  readonly line: string;
  readonly sdk?: string;
  readonly params?: unknown;
  readonly note: string;
}

// The values that real mode reads from the inputs or from earlier answers. The dry run shows placeholders.
export interface Placeholders {
  readonly run: string;
  readonly priceId: string;
  readonly meterId: string;
}

export type Plan = (inputs: ProbeInputs, values: Placeholders) => readonly PlannedCall[];

export function callLine(call: Pick<Call<unknown, unknown>, 'method' | 'path'>): string {
  return `${call.method} ${call.path}`;
}

export function query(values: Readonly<Record<string, string | number | boolean>>): string {
  return Object.entries(values).map(([key, value]) => `${key}=${String(value)}`).join('&');
}

export function planned<Client>(call: Call<Client, unknown>, note: string): PlannedCall {
  return { line: callLine(call), sdk: call.sdk, params: call.params, note };
}

export function action(line: string, note: string): PlannedCall {
  return { line, note };
}

import { randomBytes } from 'node:crypto';
import type Stripe from 'stripe';
import { runToken } from '../render-tenant-lifecycle/runner.ts';
import type { Plan } from './calls.ts';
import type { ProbeInputs, WorkStepId } from './inputs.ts';
import { redact, type ProbeSecrets } from './secrets.ts';
import type { StripeProbeClient } from './stripe-client.ts';
import type { WorkOSProbeClient } from './workos-client.ts';

// Every object of the probe carries the run token in its name, its email, or its metadata, so that the cleanup of a
// run and the sweep of earlier runs find it. The prefix differs from the "Thermus live" prefix of the hosted-live
// fixtures, so that neither cleanup deletes the objects of the other.
export const PREFIX = 'thermus-spike-stripe-';
export const PROBE_TAG = 'so-01f';

export interface Row {
  readonly step: string;
  readonly check: string;
  readonly expected: string;
  readonly measured: string;
}

export interface SeatEvent {
  readonly change: string;
  readonly memberships: string;
  readonly meter: string;
  readonly delay: string;
}

export type ObjectKind = 'organization' | 'user' | 'customer' | 'subscription' | 'checkout session' | 'test clock';

export interface CreatedObject {
  readonly system: 'Stripe' | 'WorkOS';
  readonly kind: ObjectKind;
  readonly id: string;
  readonly step: string;
  outcome?: string;
}

interface Report {
  readonly rows: Row[];
  readonly seatEvents: SeatEvent[];
  readonly conclusions: string[];
}

interface RunState {
  readonly created: CreatedObject[];
  price?: Stripe.Price;
  meter?: Stripe.Billing.Meter;
  // Read with stripe listen --print-secret. It stays in memory; no output holds it.
  signingSecret?: string;
  cliVersion?: string;
}

export interface ProbeContext {
  readonly inputs: ProbeInputs;
  readonly run: string;
  readonly secrets: ProbeSecrets;
  readonly stripe?: StripeProbeClient;
  readonly workos?: WorkOSProbeClient;
  readonly report: Report;
  readonly state: RunState;
  readonly signal: AbortSignal;
  readonly startedAt: Date;
}

export interface ProbeStep {
  readonly id?: WorkStepId;
  readonly name: string;
  readonly spec: string;
  run(context: ProbeContext): Promise<string>;
  readonly plan: Plan;
}

export function runTokenOf(now: Date): string {
  return `${runToken(now)}-${randomBytes(2).toString('hex')}`;
}

export function objectName(run: string, role: string): string {
  return `${PREFIX}${run} ${role}`;
}

export function probeEmail(run: string, role: string): string {
  return `${PREFIX}${run}-${role}@example.net`;
}

export function probeMetadata(run: string): Record<string, string> {
  return { thermus_probe: PROBE_TAG, thermus_probe_run: run };
}

export function newContext(base: Omit<ProbeContext, 'report' | 'state'>): ProbeContext {
  return { ...base, report: { rows: [], seatEvents: [], conclusions: [] }, state: { created: [] } };
}

export function stripeOf(context: ProbeContext): StripeProbeClient {
  if (context.stripe === undefined) throw new Error('No Stripe client: this run has no STRIPE_RESTRICTED_KEY.');
  return context.stripe;
}

export function workosOf(context: ProbeContext): WorkOSProbeClient {
  if (context.workos === undefined) throw new Error('No WorkOS client: this run has no WORKOS_API_KEY.');
  return context.workos;
}

export function remember(context: ProbeContext, object: Omit<CreatedObject, 'outcome'>): void {
  context.state.created.push({ ...object });
}

export function objectLabel(object: CreatedObject): string {
  return `${object.system} ${object.kind} ${object.id}`;
}

export function addRow(context: ProbeContext, step: string, values: Omit<Row, 'step'>): void {
  context.report.rows.push({ step, ...values });
}

export function progress(line: string): void {
  process.stderr.write(`stripe-seat-sync-probe: ${redact(line)}\n`);
}

export function seconds(ms: number): string {
  return `${(ms / 1_000).toFixed(1)} s`;
}

export function messageOf(error: unknown): string {
  return redact(error instanceof Error ? error.message : String(error));
}

type StepWork = (context: ProbeContext) => Promise<string>;

// The shared runner prints the conclusion or the failure of each step. This wrapper removes any key or signing
// secret from both before they reach the runner.
export function redacted(work: StepWork): StepWork {
  return async (context) => {
    try {
      return redact(await work(context));
    } catch (error) {
      throw new Error(messageOf(error), { cause: error });
    }
  };
}

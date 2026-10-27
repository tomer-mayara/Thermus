import type { WorkOS } from '@workos-inc/node';
import type { Row, ServiceSession } from '../render-tenant-lifecycle/context.ts';
import type { RenderClient } from '../render-tenant-lifecycle/render-client.ts';
import type { FixtureRegistry } from '../../../test/support/hosted-live/fixture-registry.ts';
import type { LiveBrowser } from '../../../test/support/hosted-live/live-browser.ts';
import { PAGES_PREFIX, TENANT_PREFIX, type ProbeInputs, type StepId, type Workload } from './inputs.ts';
import type { ProbeSecrets } from './secrets.ts';

export type Role = 'tenant' | 'pages';
export const ROLES: readonly Role[] = ['tenant', 'pages'];
export const REUSE_OPTION: Readonly<Record<Role, string>> = { tenant: '--service-id', pages: '--pages-id' };

export interface ServiceState {
  readonly label: string;
  readonly prefix: string;
  readonly reuseId?: string;
  name: string;
  serviceId?: string;
  createSent: boolean;
  // The public origin from serviceDetails.url, such as https://<name>.onrender.com, without a final slash.
  origin?: string;
}

export interface CallRecord {
  readonly index: number;
  readonly outcome: string;
  readonly ok: boolean;
  readonly ms: number;
  readonly chars: number;
}

export interface WindowRecord {
  readonly plan: string;
  readonly parallelism: number;
  readonly workload: Workload;
  readonly start: string;
  readonly calls: readonly CallRecord[];
  readonly memory: string;
  readonly limit: string;
  readonly cpu: string;
  readonly instances: string;
  readonly lag: string;
  readonly kills: number;
  readonly restart: string;
  readonly events: string;
}

interface WorkOSWrite {
  readonly step: string;
  readonly call: string;
  readonly status: string;
  readonly ms: number;
}

interface Report {
  readonly rows: Row[];
  readonly windows: WindowRecord[];
  readonly workosWrites: WorkOSWrite[];
  readonly conclusions: string[];
}

// The OAuth resource of the tenant service. The cleanup deletes only an ID that this run created.
interface ResourceState {
  readonly uri: string;
  readonly id: string;
  readonly createdInRun: boolean;
}

// The WorkOS Staging parts of one run. The registry knows each fixture that the run created, so the cleanup can
// delete them; the browser runs the Connect authorization.
export interface FixtureParts {
  readonly workos: WorkOS;
  readonly registry: FixtureRegistry;
  readonly browser: LiveBrowser;
  readonly runId: string;
}

// Gives a Connect access token for the tenant resource, refreshed before it expires.
export interface TokenProvider {
  token(): Promise<string>;
  readonly lifetimeSeconds: number;
  readonly refreshes: number;
}

interface RunState {
  credentialId?: string;
  readonly services: Readonly<Record<Role, ServiceState>>;
  resource?: ResourceState;
  fixtures?: FixtureParts;
  tokens?: TokenProvider;
  metricsTime?: 'epoch' | 'iso';
  lastWindowEnd?: number;
}

export interface ProbeContext {
  readonly inputs: ProbeInputs;
  readonly secrets: ProbeSecrets;
  readonly run: string;
  readonly client: RenderClient;
  readonly report: Report;
  readonly state: RunState;
  readonly signal: AbortSignal;
  readonly startedAt: Date;
}

export interface ProbeStep {
  readonly id?: StepId;
  readonly name: string;
  readonly spec: string;
  run(context: ProbeContext): Promise<string>;
}

// The service names of a run end with its UTC start time. A reused service gets its listed name in the preflight.
export function newState(inputs: ProbeInputs, run: string): RunState {
  return {
    services: {
      tenant: { label: 'tenant service', prefix: TENANT_PREFIX, reuseId: inputs.serviceId, name: `${TENANT_PREFIX}${run}`, createSent: false },
      pages: { label: 'pages origin', prefix: PAGES_PREFIX, reuseId: inputs.pagesId, name: `${PAGES_PREFIX}${run}`, createSent: false },
    },
  };
}

export function newReport(): Report {
  return { rows: [], windows: [], workosWrites: [], conclusions: [] };
}

// The SO-01c waits and reads take one service; this gives them the service of one role, with the rows of the report.
export function sessionOf(context: ProbeContext, role: Role): ServiceSession & { readonly report: { readonly rows: Row[] } } {
  return { client: context.client, signal: context.signal, state: context.state.services[role], report: context.report };
}

export function originOf(context: ProbeContext, role: Role): string {
  const origin = context.state.services[role].origin;
  if (origin === undefined) throw new Error(`No public URL of the ${context.state.services[role].label}: the setup did not finish.`);
  return origin;
}

export function serviceLine(state: ServiceState): string {
  return `${state.name} (${state.serviceId ?? 'no service ID'})`;
}

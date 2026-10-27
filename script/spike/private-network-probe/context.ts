import { SERVICE_PREFIX } from '../render-tenant-lifecycle/calls.ts';
import type { Row, ServiceSession } from '../render-tenant-lifecycle/context.ts';
import type { RenderClient } from '../render-tenant-lifecycle/render-client.ts';
import { WEB_PREFIX, type ProbeInputs, type StepId } from './inputs.ts';

export type Role = 'private' | 'web';

export interface ServiceState {
  readonly label: string;
  readonly reuseId?: string;
  name: string;
  serviceId?: string;
  createSent: boolean;
}

export interface PrivateAddress {
  readonly slug: string;
  readonly url: string;
}

// The cleanup cancels a job that has not ended on the service that runs it.
interface JobState {
  readonly id: string;
  readonly serviceId: string;
  status?: string;
}

export interface TranscriptLine {
  readonly timestamp: string;
  readonly labels: string;
  readonly message: string;
}

interface Report {
  readonly rows: Row[];
  readonly transcript: TranscriptLine[];
  readonly conclusions: string[];
  startCommand?: string;
}

interface RunState {
  credentialId?: string;
  readonly services: Readonly<Record<Role, ServiceState>>;
  address?: PrivateAddress;
  job?: JobState;
}

export interface ProbeContext {
  readonly inputs: ProbeInputs;
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

export const ROLES: readonly Role[] = ['private', 'web'];

export function newState(inputs: ProbeInputs, run: string): RunState {
  return {
    services: {
      private: { label: 'private service', reuseId: inputs.privateServiceId, name: `${SERVICE_PREFIX}${run}`, createSent: false },
      web: { label: 'web service', reuseId: inputs.webServiceId, name: `${WEB_PREFIX}${run}`, createSent: false },
    },
  };
}

export function sessionOf(context: ProbeContext, role: Role): ServiceSession {
  return { client: context.client, signal: context.signal, state: context.state.services[role] };
}

export function serviceLine(state: ServiceState): string {
  return `${state.name} (${state.serviceId ?? 'no service ID'})`;
}

export function addressOf(context: ProbeContext): PrivateAddress {
  const address = context.state.address;
  if (address === undefined) throw new Error('No internal address: the private step did not finish.');
  return address;
}

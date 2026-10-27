import assert from 'node:assert/strict';
import { envVarsCall, servicesNamedCall, type Call, type ServiceType } from './calls.ts';
import { fieldJson, fieldText, listItems, renderId, serviceOf, type DeployView, type ServiceView } from './answers.ts';
import { seconds, type ServiceSession } from './context.ts';
import { poll, POLLS, watch } from './polls.ts';
import { probeServices } from './waits.ts';

interface Lister extends Pick<ServiceSession, 'client' | 'signal'> {
  readonly owner: string;
}

export interface CreatedService {
  readonly service: ServiceView;
  readonly deployId: string;
  readonly ms: number;
}

interface CreateTarget extends ServiceSession {
  readonly state: { createSent: boolean; serviceId?: string };
}

// The create goes one time only, because a repeated create can make a second service. createSent is set before the
// write, so that the cleanup looks for the service by its name when the answer is lost.
export async function sendCreate(target: CreateTarget, step: string, call: Call): Promise<CreatedService> {
  target.state.createSent = true;
  const answer = await target.client.write(step, call, target.signal);
  assert.equal(answer.status, 201, `POST /services answered ${answer.status}, not 201`);
  const service = serviceOf(fieldJson(answer.json, 'service'));
  target.client.confirmOwnService(service.id, service.name);
  target.state.serviceId = service.id;
  return { service, deployId: renderId(fieldJson(answer.json, 'deployId'), 'deployId'), ms: answer.ms };
}

// The services that a create of the run made: the ID of the create answer, or, when that answer was lost, each service
// with the exact name of the run. Each one becomes a service that the client may touch.
export async function createdIds(lister: Lister, state: { readonly serviceId?: string; readonly createSent: boolean; readonly name: string }): Promise<readonly string[]> {
  if (state.serviceId !== undefined) return [state.serviceId];
  if (!state.createSent) return [];
  const named = await watch({ plan: POLLS.window, signal: lister.signal, what: `a service named ${state.name}` }, async () => {
    const answer = await lister.client.read(servicesNamedCall(lister.owner, state.name), lister.signal);
    const ids = listItems(answer.json, 'service').items.map(serviceOf).filter((service) => service.name === state.name).map((service) => service.id);
    for (const id of ids) lister.client.confirmOwnService(id, state.name);
    return ids.length > 0 ? ids : undefined;
  });
  return named ?? [];
}

export function untilGone(lister: Lister, gone: { readonly names: readonly string[]; readonly types: readonly ServiceType[]; readonly what: string }): Promise<readonly string[]> {
  return poll({ plan: POLLS.cleanup, signal: lister.signal, what: gone.what }, async () => {
    const listed = (await probeServices({ client: lister.client, inputs: { owner: lister.owner } }, lister.signal, gone.types)).map((service) => service.name);
    return gone.names.some((name) => listed.includes(name)) ? undefined : listed;
  });
}

// The answer also holds the values of the variables; only the keys leave this function.
export async function variableKeys(target: Pick<ServiceSession, 'client' | 'signal'>, serviceId: string): Promise<readonly string[]> {
  const answer = await target.client.read(envVarsCall(serviceId), target.signal);
  return listItems(answer.json, 'envVar').items.map((item) => fieldText(item, 'key') ?? '').sort();
}

export function renderTimes(deploy: DeployView): string {
  const created = Date.parse(deploy.createdAt ?? '');
  const finished = Date.parse(deploy.finishedAt ?? '');
  if (!Number.isFinite(created) || !Number.isFinite(finished)) return 'Render times absent';
  return `Render: createdAt ${deploy.createdAt}, finishedAt ${deploy.finishedAt}, ${seconds(finished - created)}`;
}

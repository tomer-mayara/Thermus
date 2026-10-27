import {
  deployCall, deployImageCall, eventsCall, instancesCall, PAGE_SIZE, PRIVATE_SERVICES, recentDeploysCall, SERVICE_PREFIX, serviceCall,
  servicesCall, type ServiceType,
} from './calls.ts';
import { deployOf, eventsOf, instanceIdsOf, listItems, serviceOf, type DeployView, type ServiceView } from './answers.ts';
import { progress, seconds, serviceIdOf, type ProbeContext, type ServiceSession } from './context.ts';
import { poll, POLLS, watch } from './polls.ts';
import type { RenderClient } from './render-client.ts';

const ENDED = new Set(['build_failed', 'update_failed', 'canceled', 'pre_deploy_failed', 'deactivated']);
const CLOCK_SKEW_MS = 2_000;
const MAX_PAGES = 20;

export interface LiveDeploy {
  readonly deploy: DeployView;
  readonly ms: number;
  readonly statuses: readonly string[];
}

export async function waitForLive(context: ServiceSession, deployId: string, since: number): Promise<LiveDeploy> {
  const serviceId = serviceIdOf(context);
  const statuses: string[] = [];
  const deploy = await poll({ plan: POLLS.deploy, signal: context.signal, what: `deploy ${deployId} to be live` }, async () => {
    const current = deployOf((await context.client.read(deployCall(serviceId, deployId), context.signal)).json);
    const status = current.status ?? 'absent';
    if (statuses.at(-1) !== status) {
      statuses.push(status);
      progress(`deploy ${deployId}: ${status} after ${seconds(performance.now() - since)}`);
    }
    if (ENDED.has(status)) throw new Error(`Deploy ${deployId} ended as ${status} (statuses: ${statuses.join(' > ')})`);
    return status === 'live' ? current : undefined;
  });
  return { deploy, ms: performance.now() - since, statuses };
}

export async function recentDeploys(context: ServiceSession): Promise<readonly DeployView[]> {
  const answer = await context.client.read(recentDeploysCall(serviceIdOf(context)), context.signal);
  return listItems(answer.json, 'deploy').items.map(deployOf);
}

export async function deployIds(context: ProbeContext): Promise<ReadonlySet<string>> {
  return new Set((await recentDeploys(context)).map((deploy) => deploy.id));
}

async function unknownDeploy(context: ProbeContext, known: ReadonlySet<string>): Promise<DeployView | undefined> {
  return (await recentDeploys(context)).find((deploy) => !known.has(deploy.id));
}

export function deployStartedByRender(context: ProbeContext, known: ReadonlySet<string>): Promise<DeployView | undefined> {
  return watch({ plan: POLLS.window, signal: context.signal, what: 'a deploy that Render started' }, () => unknownDeploy(context, known));
}

export function listedDeploy(context: ProbeContext, known: ReadonlySet<string>): Promise<DeployView> {
  return poll({ plan: POLLS.newDeploy, signal: context.signal, what: 'a new deploy in the deploy list' }, () => unknownDeploy(context, known));
}

export async function deployImage2(context: ProbeContext, step: string, known: ReadonlySet<string>): Promise<{ readonly id: string; readonly status: number }> {
  const call = deployImageCall(serviceIdOf(context), context.inputs.secondImage.ref);
  const answer = await context.client.write(step, call, context.signal);
  if (answer.status !== 201 && answer.status !== 202) throw new Error(`${call.method} ${call.path} answered ${answer.status}, not 201 or 202`);
  const id = answer.status === 201 ? deployOf(answer.json).id : (await listedDeploy(context, known)).id;
  return { id, status: answer.status };
}

export async function readService(context: ServiceSession): Promise<ServiceView> {
  return serviceOf((await context.client.read(serviceCall(serviceIdOf(context)), context.signal)).json);
}

export async function waitForSuspended(context: ProbeContext, wanted: 'suspended' | 'not_suspended', since: number): Promise<{ readonly service: ServiceView; readonly ms: number }> {
  const service = await poll({ plan: POLLS.state, signal: context.signal, what: `suspended to be ${wanted}` }, async () => {
    const current = await readService(context);
    return current.suspended === wanted ? current : undefined;
  });
  return { service, ms: performance.now() - since };
}

export async function instanceIds(context: ProbeContext): Promise<readonly string[]> {
  return instanceIdsOf((await context.client.read(instancesCall(serviceIdOf(context)), context.signal)).json);
}

export async function eventTypesSince(context: ProbeContext, sinceEpochMs: number): Promise<readonly string[]> {
  const answer = await context.client.read(eventsCall(serviceIdOf(context)), context.signal);
  const recent = eventsOf(answer.json).filter((event) => event.at >= sinceEpochMs - CLOCK_SKEW_MS);
  return recent.map((event) => `${event.type} (${event.at < sinceEpochMs ? '-' : '+'}${seconds(Math.abs(event.at - sinceEpochMs))})`);
}

export interface ProbeService {
  readonly id: string;
  readonly name: string;
}

interface ServiceLister {
  readonly client: RenderClient;
  readonly inputs: { readonly owner: string };
}

export async function probeServices(context: ServiceLister, signal: AbortSignal, types: readonly ServiceType[] = PRIVATE_SERVICES): Promise<readonly ProbeService[]> {
  const found: ProbeService[] = [];
  let cursor: string | undefined;
  for (let page = 1; page <= MAX_PAGES; page++) {
    const answer = await context.client.read(servicesCall(context.inputs.owner, types, cursor), signal);
    const { items, cursor: next } = listItems(answer.json, 'service');
    const services = items.map(serviceOf).map((service) => ({ id: service.id, name: service.name ?? '' }));
    found.push(...services.filter((service) => service.name.startsWith(SERVICE_PREFIX)));
    if (items.length < PAGE_SIZE || next === undefined) return found;
    cursor = next;
  }
  throw new Error(`The service list has more than ${MAX_PAGES} pages`);
}

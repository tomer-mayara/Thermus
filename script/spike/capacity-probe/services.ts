import assert from 'node:assert/strict';
import { FREE_PLAN, HEALTH_CHECK_PATH, type Call } from '../render-tenant-lifecycle/calls.ts';
import { samePlan, type ServiceView } from '../render-tenant-lifecycle/answers.ts';
import { addRow, progress, seconds, shown } from '../render-tenant-lifecycle/context.ts';
import { renderTimes, sendCreate } from '../render-tenant-lifecycle/create.ts';
import { sleep } from '../render-tenant-lifecycle/polls.ts';
import { readService, recentDeploys, waitForLive } from '../render-tenant-lifecycle/waits.ts';
import { answeredOk, outcomeText, requestHere, type Outcome } from '../private-network-probe/here.ts';
import { sessionOf, type ProbeContext, type Role } from './context.ts';

export const STEP_OF: Readonly<Record<Role, string>> = { tenant: 'Tenant service', pages: 'Pages origin' };
// A new web service answered 502 on its public URL once or twice after its deploy was live (SO-01d part two).
export const PUBLIC_HEALTH = { everyMs: 5_000, attempts: 24, timeoutMs: 10_000 } as const;
const PUBLIC_ORIGIN = /^https:\/\/[a-z0-9-]+\.onrender\.com$/;

export interface LiveService {
  readonly service: ServiceView;
  readonly note: string;
}

function assertWebService(context: ProbeContext, service: ServiceView, digest: string): void {
  assert.equal(service.type, 'web_service', `The service type is ${shown(service.type)}, not web_service`);
  assert.equal(service.runtime, 'image', `The runtime is ${shown(service.runtime)}, not image`);
  assert.equal(service.region, context.inputs.region, `The region is ${shown(service.region)}`);
  assert.ok(service.imagePath?.includes(digest) === true, `The image setting is ${shown(service.imagePath)}, not the digest ${digest}`);
}

interface PlannedCreate {
  readonly call: () => Call;
  readonly digest: string;
}

async function createLive(context: ProbeContext, role: Role, create: PlannedCreate): Promise<LiveService> {
  const state = context.state.services[role];
  const { digest } = create;
  const started = performance.now();
  const { service, deployId, ms } = await sendCreate({ client: context.client, signal: context.signal, state }, STEP_OF[role], create.call());
  progress(`created the ${state.label} ${state.name} (${service.id}); the cleanup deletes it unless --keep`);
  addRow(context, STEP_OF[role], { check: 'Create answer', expected: '201 with the service and deployId', measured: `201 after ${seconds(ms)}: ${service.id}, ${shown(service.type)}, plan ${shown(service.plan)}` });
  assertWebService(context, service, digest);
  assert.ok(samePlan(service.plan, FREE_PLAN), `The plan is ${shown(service.plan)}, not ${FREE_PLAN}`);
  const live = await waitForLive(sessionOf(context, role), deployId, started);
  addRow(context, STEP_OF[role], { check: 'First deploy', expected: 'live; time recorded', measured: `live ${seconds(live.ms)} after the create call (${live.statuses.join(' > ')}); ${renderTimes(live.deploy)}` });
  return { service, note: `was created and was live ${seconds(live.ms)} after the create call` };
}

async function useLive(context: ProbeContext, role: Role, digest: string): Promise<LiveService> {
  const session = sessionOf(context, role);
  const service = await readService(session);
  const [latest] = await recentDeploys(session);
  addRow(context, STEP_OF[role], { check: 'Given service', expected: 'not suspended; the last deploy is live', measured: `${service.id}: ${shown(service.suspended)}, plan ${shown(service.plan)}; last deploy ${latest?.id ?? 'none'} ${shown(latest?.status)}` });
  assertWebService(context, service, digest);
  assert.equal(service.suspended, 'not_suspended', `The given service is ${shown(service.suspended)}`);
  assert.equal(latest?.status, 'live', `The last deploy of the given service is ${shown(latest?.status)}, not live`);
  return { service, note: 'is the given service, live' };
}

// The create goes one time only; a reused service must be live already.
export function liveService(context: ProbeContext, role: Role, create: PlannedCreate): Promise<LiveService> {
  const reused = context.state.services[role].reuseId !== undefined;
  return reused ? useLive(context, role, create.digest) : createLive(context, role, create);
}

export async function readOrigin(context: ProbeContext, role: Role): Promise<string> {
  const service = await readService(sessionOf(context, role));
  const origin = (service.url ?? '').replace(/\/$/, '');
  addRow(context, STEP_OF[role], { check: 'Public URL', expected: 'https://<name>.onrender.com in serviceDetails.url', measured: shown(service.url) });
  assert.ok(PUBLIC_ORIGIN.test(origin), `serviceDetails.url is ${shown(service.url)}, not an onrender.com https origin`);
  context.state.services[role].origin = origin;
  return origin;
}

async function requestUntilOk(context: ProbeContext, url: string): Promise<{ readonly outcome: Outcome; readonly tries: number; readonly ms: number }> {
  const started = performance.now();
  for (let tries = 1; ; tries++) {
    const outcome = await requestHere(url, PUBLIC_HEALTH.timeoutMs, context.signal);
    if (answeredOk(outcome) || tries === PUBLIC_HEALTH.attempts) return { outcome, tries, ms: performance.now() - started };
    await sleep(PUBLIC_HEALTH.everyMs, context.signal);
  }
}

export interface Health {
  readonly ok: boolean;
  readonly text: string;
  readonly url: string;
  // The time of the answer, in milliseconds since the Unix epoch.
  readonly at: number;
}

// GET <origin>/healthz from this machine, repeated for a bounded time until it answers 200 with ok.
export async function waitHealthy(context: ProbeContext, role: Role): Promise<Health> {
  const url = `${context.state.services[role].origin ?? ''}${HEALTH_CHECK_PATH}`;
  const { outcome, tries, ms } = await requestUntilOk(context, url);
  const text = `${outcomeText(outcome)}; request ${tries} of at most ${PUBLIC_HEALTH.attempts}, ${seconds(ms)} after the first`;
  return { ok: answeredOk(outcome), text, url, at: Date.now() };
}

export async function healthFromHere(context: ProbeContext, role: Role, step = STEP_OF[role]): Promise<Health> {
  const health = await waitHealthy(context, role);
  addRow(context, step, { check: `GET ${health.url} from this machine`, expected: '200 with body ok', measured: health.text });
  return health;
}

import assert from 'node:assert/strict';
import {
  createServiceCall, envVarsCall, FREE_PLAN, HEALTH_CHECK_PATH, LISTEN_PORT, PLACEHOLDER_ENVIRONMENT, serviceCall, type ServiceType,
} from '../render-tenant-lifecycle/calls.ts';
import { addressFields, fieldText, listItems, samePlan, serviceOf, type ServiceView } from '../render-tenant-lifecycle/answers.ts';
import { addRow, progress, seconds, serviceIdOf, shown } from '../render-tenant-lifecycle/context.ts';
import { renderTimes, sendCreate } from '../render-tenant-lifecycle/create.ts';
import { readService, recentDeploys, waitForLive } from '../render-tenant-lifecycle/waits.ts';
import { sessionOf, type ProbeContext, type Role } from './context.ts';
import { checkPublicHealth } from './web-health.ts';

const TYPES: Readonly<Record<Role, ServiceType>> = { private: 'private_service', web: 'web_service' };
const STEP: Readonly<Record<Role, string>> = { private: 'Private service', web: 'Web service' };
const SLUG = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

function assertService(context: ProbeContext, role: Role, service: ServiceView): void {
  assert.equal(service.type, TYPES[role], `The service type is ${shown(service.type)}, not ${TYPES[role]}`);
  assert.equal(service.runtime, 'image', `The runtime is ${shown(service.runtime)}, not image`);
  assert.ok(samePlan(service.plan, FREE_PLAN), `The plan is ${shown(service.plan)}, not ${FREE_PLAN}`);
  assert.equal(service.region, context.inputs.region, `The region is ${shown(service.region)}`);
  assert.ok(service.imagePath?.includes(context.inputs.image.digest), `The image setting is ${shown(service.imagePath)}, not the given image`);
}

async function variableKeys(context: ProbeContext, serviceId: string): Promise<readonly string[]> {
  const answer = await context.client.read(envVarsCall(serviceId), context.signal);
  return listItems(answer.json, 'envVar').items.map((item) => fieldText(item, 'key') ?? '').sort();
}

async function checkVariables(context: ProbeContext, role: Role, serviceId: string): Promise<void> {
  const keys = await variableKeys(context, serviceId);
  const planned = PLACEHOLDER_ENVIRONMENT.map(([key]) => key).sort();
  addRow(context, STEP[role], { check: 'Variables (keys only)', expected: planned.join(', '), measured: keys.join(', ') });
  assert.deepEqual(keys, planned, `The service has the variables ${keys.join(', ')}, not ${planned.join(', ')}`);
}

async function createLive(context: ProbeContext, role: Role): Promise<{ readonly service: ServiceView; readonly note: string }> {
  const state = context.state.services[role];
  const credentialId = context.state.credentialId;
  if (credentialId === undefined) throw new Error('No registry credential: the preflight did not find it.');
  const started = performance.now();
  const source = role === 'web' ? { ...context.inputs, serviceType: TYPES.web } : context.inputs;
  const target = { client: context.client, signal: context.signal, state };
  const { service, deployId, ms } = await sendCreate(target, STEP[role], createServiceCall(source, state.name, credentialId));
  progress(`created the ${state.label} ${state.name} (${service.id}); the cleanup deletes it`);
  addRow(context, STEP[role], { check: 'Create answer', expected: '201 with the service and deployId', measured: `201 after ${seconds(ms)}: ${service.id}, ${shown(service.type)}, plan ${shown(service.plan)}` });
  assertService(context, role, service);
  const live = await waitForLive(sessionOf(context, role), deployId, started);
  addRow(context, STEP[role], { check: 'First deploy', expected: 'live; time recorded', measured: `live ${seconds(live.ms)} after the create call (${live.statuses.join(' > ')}); ${renderTimes(live.deploy)}` });
  await checkVariables(context, role, service.id);
  return { service, note: `was created and was live ${seconds(live.ms)} after the create call` };
}

async function useLive(context: ProbeContext, role: Role): Promise<{ readonly service: ServiceView; readonly note: string }> {
  const session = sessionOf(context, role);
  const service = await readService(session);
  const [latest] = await recentDeploys(session);
  addRow(context, STEP[role], { check: 'Given service', expected: 'not suspended; the last deploy is live', measured: `${service.id}: ${shown(service.suspended)}; last deploy ${latest?.id ?? 'none'} ${shown(latest?.status)}` });
  assertService(context, role, service);
  assert.equal(service.suspended, 'not_suspended', `The given service is ${shown(service.suspended)}`);
  assert.equal(latest?.status, 'live', `The last deploy of the given service is ${shown(latest?.status)}, not live`);
  await checkVariables(context, role, service.id);
  return { service, note: 'is the given service, live' };
}

function liveService(context: ProbeContext, role: Role): Promise<{ readonly service: ServiceView; readonly note: string }> {
  return context.state.services[role].reuseId === undefined ? createLive(context, role) : useLive(context, role);
}

export async function privateService(context: ProbeContext): Promise<string> {
  const { service, note } = await liveService(context, 'private');
  const answer = await context.client.read(serviceCall(serviceIdOf(sessionOf(context, 'private'))), context.signal);
  const read = serviceOf(answer.json);
  const ports = read.openPorts.join(', ') || 'none';
  const fields = addressFields(answer.json).filter((field) => field.host === read.slug).map((field) => `${field.value} in service.${field.path}`);
  addRow(context, STEP.private, { check: 'Internal address', expected: `serviceDetails.url holds <slug>:<port>; openPorts holds ${LISTEN_PORT}`, measured: `${fields.join('; ') || `none: url ${shown(read.url)}`}; slug ${shown(read.slug)}; openPorts ${ports}` });
  const url = read.url ?? '';
  const slug = read.slug ?? '';
  assert.ok(SLUG.test(slug), `The slug ${shown(read.slug)} is not a host name of letters, digits, and hyphens`);
  assert.ok(addressFields(url).some((field) => field.host === slug), `serviceDetails.url is ${shown(read.url)}, not <slug>:<port>`);
  assert.ok(read.openPorts.includes(LISTEN_PORT), `serviceDetails.openPorts holds ${ports}, not ${LISTEN_PORT}`);
  context.state.address = { slug, url };
  return `${service.name} (${service.id}) ${note}; serviceDetails.url is ${url}, and openPorts holds ${ports}.`;
}

export async function webService(context: ProbeContext): Promise<string> {
  const { service, note } = await liveService(context, 'web');
  const read = await readService(sessionOf(context, 'web'));
  const publicUrl = read.url ?? '';
  addRow(context, STEP.web, { check: 'Public URL', expected: 'an https URL in serviceDetails.url', measured: shown(read.url) });
  assert.ok(/^https:\/\/[a-z0-9.-]+\/?$/.test(publicUrl), `The web service answer has the URL ${shown(read.url)}, not an https URL`);
  const health = await checkPublicHealth(context, `${publicUrl.replace(/\/$/, '')}${HEALTH_CHECK_PATH}`);
  return `${service.name} (${service.id}) ${note}; ${health}`;
}

import assert from 'node:assert/strict';
import {
  createServiceCall, envVarsCall, FREE_PLAN, LISTEN_PORT, PLACEHOLDER_ENVIRONMENT, serviceCall,
} from './calls.ts';
import {
  addressFields, fieldJson, fieldText, listItems, renderId, sameDigest, samePlan, serviceOf, type DeployView, type ServiceView,
} from './answers.ts';
import { addField, addRow, seconds, serviceIdOf, shown, type ProbeContext } from './context.ts';
import { deployIds, deployImage2, readService, recentDeploys, waitForLive } from './waits.ts';

const READ = 'GET /services/{id}';

function assertCreated(context: ProbeContext, service: ServiceView): void {
  assert.equal(service.name, context.name, 'The create answer names another service');
  assert.equal(service.type, 'private_service', `The service type is ${shown(service.type)}`);
  assert.equal(service.runtime, 'image', `The runtime is ${shown(service.runtime)}, not image`);
  assert.ok(samePlan(service.plan, FREE_PLAN), `The plan is ${shown(service.plan)}, not ${FREE_PLAN}`);
  assert.equal(service.region, context.inputs.region, `The region is ${shown(service.region)}`);
  assert.ok(service.imagePath?.includes(context.inputs.image.digest), `The image setting is ${shown(service.imagePath)}, not image 1`);
}

function recordCreated(context: ProbeContext, service: ServiceView, deployId: string): void {
  const answer = 'POST /services (201)';
  const fields: [string, string | undefined][] = [
    ['service.id', service.id], ['deployId', deployId], ['service.slug', service.slug],
    ['service.serviceDetails.plan', service.plan], ['service.serviceDetails.region', service.region],
    ['service.serviceDetails.runtime', service.runtime], ['service.imagePath', service.imagePath],
    ['service.registryCredential.name', service.credentialName], ['service.suspended', service.suspended],
  ];
  for (const [field, value] of fields) addField(context, field, { answer, value: shown(value) });
}

function renderTimes(deploy: DeployView): string {
  const created = Date.parse(deploy.createdAt ?? '');
  const finished = Date.parse(deploy.finishedAt ?? '');
  if (!Number.isFinite(created) || !Number.isFinite(finished)) return 'Render times absent';
  return `Render: createdAt ${deploy.createdAt}, finishedAt ${deploy.finishedAt}, ${seconds(finished - created)}`;
}

export function imageName(context: ProbeContext, deploy: DeployView): string {
  const { image, secondImage } = context.inputs;
  const named = (ref: { digest: string }): boolean => sameDigest(deploy.imageSha, ref.digest) || deploy.imageRef?.includes(ref.digest) === true;
  if (named(secondImage)) return 'image 2';
  if (named(image)) return 'image 1';
  return `ref ${shown(deploy.imageRef)}, sha ${shown(deploy.imageSha)}`;
}

async function sendCreate(context: ProbeContext): Promise<{ readonly service: ServiceView; readonly deployId: string; readonly ms: number }> {
  const credentialId = context.state.credentialId;
  if (credentialId === undefined) throw new Error('No registry credential: the preflight did not find it.');
  context.state.createSent = true;
  context.state.serviceName = context.name;
  const answer = await context.client.write('Create', createServiceCall(context.inputs, context.name, credentialId), context.signal);
  assert.equal(answer.status, 201, `POST /services answered ${answer.status}, not 201`);
  const service = serviceOf(fieldJson(answer.json, 'service'));
  context.client.confirmOwnService(service.id, service.name);
  context.state.serviceId = service.id;
  return { service, deployId: renderId(fieldJson(answer.json, 'deployId'), 'deployId'), ms: answer.ms };
}

function recordDeploy(context: ProbeContext, deploy: DeployView): void {
  const fields: [string, string | undefined][] = [['deploy.trigger', deploy.trigger], ['deploy.image.ref', deploy.imageRef], ['deploy.image.sha', deploy.imageSha]];
  for (const [field, value] of fields) addField(context, field, { answer: 'GET /services/{id}/deploys/{deployId}', value: shown(value) });
}

async function variableKeys(context: ProbeContext, serviceId: string): Promise<readonly string[]> {
  const answer = await context.client.read(envVarsCall(serviceId), context.signal);
  return listItems(answer.json, 'envVar').items.map((item) => fieldText(item, 'key') ?? '').sort();
}

export async function create(context: ProbeContext): Promise<string> {
  const started = performance.now();
  const { service, deployId, ms } = await sendCreate(context);
  addRow(context, 'Create', { check: 'Create answer', expected: '201 with the service and deployId', measured: `201 after ${seconds(ms)}: ${service.id}, plan ${shown(service.plan)}, runtime ${shown(service.runtime)}` });
  recordCreated(context, service, deployId);
  assertCreated(context, service);
  const live = await waitForLive(context, deployId, started);
  addRow(context, 'Create', { check: 'First deploy', expected: 'live; time recorded', measured: `live ${seconds(live.ms)} after the create call (${live.statuses.join(' > ')}); ${renderTimes(live.deploy)}` });
  addRow(context, 'Create', { check: 'Image of the first deploy', expected: 'image 1', measured: imageName(context, live.deploy) });
  recordDeploy(context, live.deploy);
  const keys = await variableKeys(context, service.id);
  const planned = PLACEHOLDER_ENVIRONMENT.map(([key]) => key).sort();
  addRow(context, 'Create', { check: 'Variables (keys only)', expected: planned.join(', '), measured: keys.join(', ') });
  assert.deepEqual(keys, planned, `The service has the variables ${keys.join(', ')}, not ${planned.join(', ')}`);
  return `${service.id} was created on ${FREE_PLAN} in ${context.inputs.region} with ${keys.length} variables; its first deploy was live ${seconds(live.ms)} after the create call.`;
}

export async function internalAddress(context: ProbeContext): Promise<string> {
  const answer = await context.client.read(serviceCall(serviceIdOf(context)), context.signal);
  const service = serviceOf(answer.json);
  addField(context, 'service.serviceDetails.openPorts[].port', { answer: READ, value: service.openPorts.join(', ') || 'none' });
  addField(context, 'service.serviceDetails.url', { answer: READ, value: shown(service.url) });
  addField(context, 'service.slug', { answer: READ, value: shown(service.slug) });
  const ports = service.openPorts.join(', ') || 'none';
  const found = addressFields(answer.json).filter((field) => field.host === service.slug);
  const listed = found.map((field) => `${field.value} in service.${field.path}`).join('; ');
  const seen = `slug ${shown(service.slug)}, serviceDetails.url ${shown(service.url)}, openPorts ${ports}`;
  addRow(context, 'Internal address', { check: 'Field with <slug>:<port>, and the open port', expected: `one field; openPorts holds ${LISTEN_PORT}`, measured: found.length === 0 ? `none: ${seen}` : `${listed}; openPorts ${ports}` });
  const [address] = found;
  assert.ok(address !== undefined, `No field holds <slug>:<port>: ${seen}, serviceDetails keys ${service.detailKeys.join(', ')}`);
  assert.ok(service.openPorts.includes(LISTEN_PORT), `serviceDetails.openPorts holds ${ports}, not ${LISTEN_PORT}`);
  const portNote = address.port === LISTEN_PORT ? 'the same port' : `port ${LISTEN_PORT}, but the field names port ${address.port}`;
  return `the field service.${address.path} holds the internal address ${address.value}; serviceDetails.openPorts holds ${portNote}.`;
}

export async function secondImage(context: ProbeContext): Promise<string> {
  const known = await deployIds(context);
  const started = performance.now();
  const deploy = await deployImage2(context, 'Image 2', known);
  addField(context, 'POST /services/{id}/deploys status', { answer: 'create-deploy', value: `${deploy.status}${deploy.status === 201 ? ', deploy in the body' : ', no body'}` });
  const live = await waitForLive(context, deploy.id, started);
  addRow(context, 'Image 2', { check: 'Deploy with imageUrl', expected: 'live', measured: `answer ${deploy.status}; live ${seconds(live.ms)} after the call (${live.statuses.join(' > ')}); ${renderTimes(live.deploy)}` });
  const liveDeploys = (await recentDeploys(context)).filter((item) => item.status === 'live');
  const [current] = liveDeploys;
  assert.ok(current !== undefined && liveDeploys.length === 1 && current.id === deploy.id, `The live deploys are ${liveDeploys.map((item) => item.id).join(', ') || 'none'}, not only ${deploy.id}`);
  const reported = imageName(context, current);
  addRow(context, 'Image 2', { check: 'Image of the live deploy', expected: 'image 2', measured: reported });
  const setting = imageSetting(context, await readService(context));
  addRow(context, 'Image 2', { check: 'Image setting of the service (imagePath)', expected: 'not documented; recorded', measured: setting });
  assert.equal(reported, 'image 2', `The live deploy reports ${reported}, not image 2`);
  return `the deploy of image 2 was live ${seconds(live.ms)} after the call, and the live deploy reports image 2; the image setting of the service shows ${setting}.`;
}

function imageSetting(context: ProbeContext, service: ServiceView): string {
  if (service.imagePath === context.inputs.secondImage.ref) return 'image 2';
  if (service.imagePath === context.inputs.image.ref) return 'image 1';
  return shown(service.imagePath);
}

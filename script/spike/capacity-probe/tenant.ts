import assert from 'node:assert/strict';
import { createServiceCall, FREE_PLAN, updateVariableCall, type Call, type Variables } from '../render-tenant-lifecycle/calls.ts';
import { fieldText, sameDigest, samePlan, type DeployView } from '../render-tenant-lifecycle/answers.ts';
import { addRow, seconds, serviceIdOf, shown } from '../render-tenant-lifecycle/context.ts';
import { variableKeys } from '../render-tenant-lifecycle/create.ts';
import type { ImageRef } from '../render-tenant-lifecycle/inputs.ts';
import { changePlan, type PlanImage } from '../render-tenant-lifecycle/steps-lifecycle.ts';
import { deployIds, deployImage, waitForLive } from '../render-tenant-lifecycle/waits.ts';
import { serviceLine, sessionOf, type ProbeContext } from './context.ts';
import { healthFromHere, liveService, readOrigin, STEP_OF } from './services.ts';
import { baseUrlOf, newCookiePassword, predictedOrigin, tenantVariables } from './variables.ts';

const STEP = STEP_OF.tenant;

export interface TenantCreate {
  readonly source: { readonly owner: string; readonly region: string; readonly image: ImageRef };
  readonly name: string;
  readonly credentialId: string;
  readonly variables: Variables;
}

export function tenantCreateCall(create: TenantCreate): Call {
  return createServiceCall({ ...create.source, serviceType: 'web_service', variables: create.variables }, create.name, create.credentialId);
}

export function probeImage(image: ImageRef): PlanImage {
  const named = (deploy: DeployView): boolean => sameDigest(deploy.imageSha, image.digest) || deploy.imageRef?.includes(image.digest) === true;
  return { url: image.ref, label: 'the probe image', nameOf: (deploy) => (named(deploy) ? 'the probe image' : `ref ${shown(deploy.imageRef)}, sha ${shown(deploy.imageSha)}`) };
}

function variableCall(serviceId: string, key: string): Call {
  return { method: 'GET', path: `/services/${serviceId}/env-vars/${encodeURIComponent(key)}` };
}

// PUBLIC_BASE_URL and WORKOS_REDIRECT_URI hold no secret, so the probe reads PUBLIC_BASE_URL itself. When it does not
// name the public URL of the service, the probe updates both and deploys, so the server starts with them.
async function checkBaseUrl(context: ProbeContext, origin: string): Promise<string> {
  const serviceId = serviceIdOf(sessionOf(context, 'tenant'));
  const answer = await context.client.read(variableCall(serviceId, 'PUBLIC_BASE_URL'), context.signal);
  const base = fieldText(answer.json, 'value');
  const wanted = baseUrlOf(origin);
  const predicted = baseUrlOf(predictedOrigin(context.state.services.tenant.name));
  addRow(context, STEP, { check: 'PUBLIC_BASE_URL', expected: `${wanted}, the public URL of the service`, measured: `${shown(base)}; predicted from the name: ${predicted === wanted ? 'the same' : predicted}` });
  if (base === wanted) return 'PUBLIC_BASE_URL names the public URL';
  const known = await deployIds(sessionOf(context, 'tenant'));
  for (const [key, value] of [['PUBLIC_BASE_URL', wanted], ['WORKOS_REDIRECT_URI', new URL('callback', wanted).href]]) {
    await context.client.write(STEP, updateVariableCall(serviceId, key, value), context.signal);
  }
  const started = performance.now();
  const deploy = await deployImage(sessionOf(context, 'tenant'), STEP, { known, imageUrl: context.inputs.image.ref });
  const live = await waitForLive(sessionOf(context, 'tenant'), deploy.id, started);
  addRow(context, STEP, { check: 'Variable update and deploy', expected: 'live with the public URL', measured: `PUBLIC_BASE_URL and WORKOS_REDIRECT_URI updated; deploy ${deploy.id} live ${seconds(live.ms)} after the call` });
  return `PUBLIC_BASE_URL was ${shown(base)}, so the probe set it to ${wanted} and deployed`;
}

async function checkKeys(context: ProbeContext, planned: Variables): Promise<void> {
  const keys = await variableKeys(context, serviceIdOf(sessionOf(context, 'tenant')));
  const wanted = planned.map(([key]) => key).sort();
  addRow(context, STEP, { check: 'Variables (keys only)', expected: wanted.join(', '), measured: keys.join(', ') });
  assert.deepEqual(keys, wanted, `The service has the variables ${keys.join(', ')}, not ${wanted.join(', ')}`);
}

export async function setupTenant(context: ProbeContext): Promise<string> {
  const state = context.state.services.tenant;
  const credentialId = context.state.credentialId;
  if (credentialId === undefined) throw new Error('No registry credential: the preflight did not find it.');
  const variables = tenantVariables(predictedOrigin(state.name), context.secrets.workos, newCookiePassword());
  const create = { source: context.inputs, name: state.name, credentialId, variables };
  const { service, note } = await liveService(context, 'tenant', { call: () => tenantCreateCall(create), digest: context.inputs.image.digest });
  const origin = await readOrigin(context, 'tenant');
  await checkKeys(context, variables);
  const base = await checkBaseUrl(context, origin);
  const plan = samePlan(service.plan, FREE_PLAN) ? `on ${FREE_PLAN}` : await changePlan(sessionOf(context, 'tenant'), FREE_PLAN, probeImage(context.inputs.image));
  const health = await healthFromHere(context, 'tenant');
  assert.ok(health.ok, `GET ${origin}/healthz from this machine gave ${health.text}, not 200 with body ok`);
  return `${serviceLine(state)} ${note}; ${base}; plan: ${plan}; ${origin}/healthz answered 200 with ok.`;
}

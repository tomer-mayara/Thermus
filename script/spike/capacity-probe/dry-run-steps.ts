import {
  callLine, credentialsCall, deleteServiceCall, deployCall, deployImageCall, envVarsCall, eventsCall, instancesCall, ownerCall,
  recentDeploysCall, serviceCall, servicesCall, servicesNamedCall, updatePlanCall, updateVariableCall, type Call,
} from '../render-tenant-lifecycle/calls.ts';
import { POLLS } from '../render-tenant-lifecycle/polls.ts';
import { ANY_TYPE } from '../private-network-probe/preflight.ts';
import { REUSE_OPTION, type Role } from './context.ts';
import type { ProbeInputs } from './inputs.ts';
import { metricCall, SETTLE, SHIFTS_SECONDS } from './metrics.ts';
import { LIVE_GATE_RESOURCE, RESOURCES_PATH } from './oauth-resource.ts';
import { PAGES } from './pages.ts';
import { STAGING_ISSUER } from './secrets.ts';
import { PUBLIC_HEALTH } from './services.ts';

export interface Planned {
  readonly line: string;
  readonly body?: unknown;
  readonly note: string;
  readonly write: boolean;
  readonly optional: boolean;
}

export interface Plan {
  readonly inputs: ProbeInputs;
  readonly names: Readonly<Record<Role, string>>;
  readonly ids: Readonly<Record<Role, string>>;
  readonly origins: Readonly<Record<Role, string>>;
  readonly reused: Readonly<Record<Role, boolean>>;
}

export function every(poll: { readonly everyMs: number; readonly attempts: number }): string {
  return `Every ${poll.everyMs / 1000} s, at most ${poll.attempts} times`;
}

export function api(call: Call, note: string, optional = false): Planned {
  return { line: decodeURIComponent(callLine(call)), body: call.body, note, write: call.method !== 'GET', optional };
}

export function other(line: string, note: string, flags: { readonly write?: boolean; readonly optional?: boolean } = {}): Planned {
  return { line, note, write: flags.write === true, optional: flags.optional === true };
}

export function preflightCalls(plan: Plan): readonly Planned[] {
  const reused = (['tenant', 'pages'] as const).filter((role) => plan.reused[role]).map((role) => plan.ids[role]);
  const rule = reused.length === 0 ? 'No service named thermus-spike-* of any type may exist.' : `${reused.join(' and ')} must be listed with the names of their roles, and no other thermus-spike-* service.`;
  return [
    api(ownerCall(plan.inputs.owner), 'The workspace exists.'),
    api(credentialsCall(plan.inputs.owner), `One credential has the ID or name "${plan.inputs.registryCredential}", for GITHUB. Its ID becomes {registryCredentialId}.`),
    api(servicesCall(plan.inputs.owner, ANY_TYPE), `No type filter. With each next cursor until a page is not full. ${rule}`),
    other(`WorkOS: GET https://api.workos.com${RESOURCES_PATH}?limit=100&order=asc`, `Reads only. The answer must list the live gate URI ${LIVE_GATE_RESOURCE}.`),
  ];
}

export function liveCalls(plan: Plan, role: Role, create: Call): readonly Planned[] {
  const id = plan.ids[role];
  if (plan.reused[role]) {
    return [api(serviceCall(id), `${REUSE_OPTION[role]}: no create. The service must not be suspended.`), api(recentDeploysCall(id), 'Its last deploy must be live.')];
  }
  return [
    api(create, 'The answer gives the service and the ID of its first deploy. The create goes one time only.'),
    api(deployCall(id, '{deployId}'), `${every(POLLS.deploy)}, until the deploy is live. A failed, canceled, or deactivated deploy fails the step.`),
  ];
}

export function healthCall(plan: Plan, role: Role, when = ''): Planned {
  return other(`From this machine: GET ${plan.origins[role]}/healthz`, `${when}${every(PUBLIC_HEALTH)}, with a ${PUBLIC_HEALTH.timeoutMs / 1000} s timeout, until 200 with body ok.`);
}

export function pageChecks(plan: Plan): readonly Planned[] {
  return Object.values(PAGES).map((page) => other(`From this machine: GET ${plan.origins.pages}${page.path}`, `200 with exactly ${page.bytes} bytes; the marker "${page.marker}" ${page.markerInHtml ? 'is' : 'is not'} in the HTML.`));
}

export function baseUrlCalls(plan: Plan): readonly Planned[] {
  const id = plan.ids.tenant;
  return [
    api(envVarsCall(id), 'The keys must be the seven keys of the create call. The answer also holds the values; only the keys are kept.'),
    api(serviceCall(id), 'serviceDetails.url must be https://<name>.onrender.com. It becomes {tenantOrigin}.'),
    api({ method: 'GET', path: `/services/${id}/env-vars/PUBLIC_BASE_URL` }, 'PUBLIC_BASE_URL must be {tenantOrigin}/.'),
    api(updateVariableCall(id, 'PUBLIC_BASE_URL', '{tenantOrigin}/'), 'Only when PUBLIC_BASE_URL is another URL.', true),
    api(updateVariableCall(id, 'WORKOS_REDIRECT_URI', '{tenantOrigin}/callback'), 'Only when PUBLIC_BASE_URL is another URL.', true),
    api(deployImageCall(id, plan.inputs.image.ref), 'Only after the variable updates: the deploy that starts the server with them, then the wait for live.', true),
  ];
}

export function planCalls(plan: Plan, target: string, when: string): readonly Planned[] {
  const id = plan.ids.tenant;
  return [
    api(instancesCall(id), `${when}The instances before the change.`, when !== ''),
    api(recentDeploysCall(id), 'The deploy IDs before the change.', when !== ''),
    api(updatePlanCall(id, target), `The answer must show plan ${target}.`, when !== ''),
    api(recentDeploysCall(id), `${every(POLLS.window)}: did Render start a deploy after the update?`, when !== ''),
    api(deployImageCall(id, plan.inputs.image.ref), 'Only when Render started no deploy: the deploy that applies the plan, with the probe image.', true),
    api(deployCall(id, '{deployId}'), `${every(POLLS.deploy)}, until the deploy is live.`, when !== ''),
    api(serviceCall(id), `The service must show plan ${target}.`, when !== ''),
    api(instancesCall(id), 'A new instance ID means that a new container replaced the old one.', when !== ''),
    api(eventsCall(id), 'The event types since the update, for the record. No event details are printed.', when !== ''),
  ];
}

export function windowCalls(plan: Plan, onPlan: string): readonly Planned[] {
  const id = plan.ids.tenant;
  const range = { startSeconds: 0, endSeconds: 30 };
  const metric = (name: 'memory' | 'memory-limit' | 'cpu' | 'instance-count'): string => decodeURIComponent(metricCall({ metric: name, serviceId: id, range }).path)
    .replace(/startTime=[^&]+/, 'startTime={windowStart}').replace(/endTime=[^&]+/, 'endTime={windowEnd}');
  const windows = plan.inputs.parallelism.flatMap((count) => plan.inputs.workloads.map((workload) => `${count} × ${workload}`)).join(', ');
  return [
    other(`MCP: POST ${plan.origins.tenant}/mcp, initialize, for each call of the window`, `Windows on ${onPlan}, in this order: ${windows}. One client for each call, with the bearer token; the clients connect first.`),
    other(`MCP: POST ${plan.origins.tenant}/mcp, tools/call, all calls of the window at the same time`, `getURLAsMarkdown { url: ${plan.origins.pages}${PAGES.page9m.path} or ${PAGES.js.path}, reason } or search { query: "Lightpanda browser documentation", reason }. Each call has 5 minutes.`),
    other(`GET ${metric('memory')}`, `Three reads with the starts ${SHIFTS_SECONDS.join(', ')} s later, after the window range ends. ${every(SETTLE)}, until the values are the same in ${SETTLE.stableReads} reads.`),
    other(`GET ${metric('memory-limit')}`, 'The memory limit of the window.'),
    other(`GET ${metric('cpu')}`, 'The CPU peak of the window.'),
    other(`GET ${metric('instance-count')}`, 'The instance count of the window.'),
    api(eventsCall(id), 'The events since the window start: server_failed is a kill, with its reason keys.'),
    healthCall(plan, 'tenant', 'Only after a server_failed event or a transport failure. '),
    other(`AuthKit: POST ${STAGING_ISSUER}/oauth2/token, grant_type=refresh_token, with the tenant resource`, 'Only when the access token has less than 120 s left.', { optional: true }),
  ];
}

export function cleanupCalls(plan: Plan): readonly Planned[] {
  const keep = plan.inputs.keep;
  const deleteNote = keep ? 'Not with --keep.' : 'Up to 3 attempts. A 404 answer means that the service is already gone.';
  const byName = (['tenant', 'pages'] as const).filter((role) => !plan.reused[role])
    .map((role) => api(servicesNamedCall(plan.inputs.owner, plan.names[role]), 'Only when the create answer gave no service ID: each service with this exact name is deleted.', true));
  return [
    other('WorkOS: DELETE /connect/applications/{applicationId}, /user_management/users/{userId}, /organizations/{organizationId}', 'The fixtures that this run made, in this order, also after a failure.', { write: true }),
    other('WorkOS: GET /connect/applications, /user_management/users?email=…, /organizations', 'No fixture named with the run ID may remain.'),
    other(`WorkOS: DELETE ${RESOURCES_PATH}/{resourceId}`, `Only the ID that this run created, not with --keep. Never the live gate URI ${LIVE_GATE_RESOURCE}.`, { write: true, optional: true }),
    api(deleteServiceCall(plan.ids.tenant), deleteNote, keep),
    api(deleteServiceCall(plan.ids.pages), deleteNote, keep),
    ...byName,
    api(servicesCall(plan.inputs.owner, ANY_TYPE), `${every(POLLS.cleanup)}, until no service of this run is listed.`),
  ];
}


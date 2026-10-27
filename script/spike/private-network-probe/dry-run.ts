import {
  API_BASE, callLine, createServiceCall, credentialsCall, deleteServiceCall, deployCall, envVarsCall, HEALTH_CHECK_PATH, LISTEN_PORT,
  ownerCall, recentDeploysCall, serviceCall, servicesCall, servicesNamedCall, type Call,
} from '../render-tenant-lifecycle/calls.ts';
import { POLLS } from '../render-tenant-lifecycle/polls.ts';
import {
  cancelJobCall, healthProgram, healthTargets, jobCall, jobStatusCall, logsCall, RENDER_PRIVATE_PORT, REQUEST_TIMEOUT_MS, startCommand,
} from './calls.ts';
import { newState, ROLES, type Role } from './context.ts';
import type { ProbeInputs, StepId } from './inputs.ts';
import { LOG_POLL } from './job-logs.ts';
import { JOB_POLL } from './job.ts';
import { ANY_TYPE, REUSE_OPTION } from './preflight.ts';
import { PUBLIC_HEALTH } from './web-health.ts';

interface Planned {
  readonly line: string;
  readonly body?: unknown;
  readonly note: string;
  readonly write: boolean;
  readonly optional: boolean;
}

interface PlannedStep {
  readonly title: string;
  readonly calls: readonly Planned[];
}

interface Plan {
  readonly inputs: ProbeInputs;
  readonly names: Readonly<Record<Role, string>>;
  readonly ids: Readonly<Record<Role, string>>;
  readonly reused: Readonly<Record<Role, boolean>>;
}

const RUN = 'YYYYMMDD-HHMMSS';
const SLUG = '{slug}';
const URL_FIELD = '{serviceDetails.url}';

function every(poll: { readonly everyMs: number; readonly attempts: number }): string {
  return `Every ${poll.everyMs / 1000} s, at most ${poll.attempts} times`;
}

function api(call: Call, note: string, optional = false): Planned {
  return { line: decodeURIComponent(callLine(call)), body: call.body, note, write: call.method !== 'GET', optional };
}

function here(line: string, note: string): Planned {
  return { line: `From this machine: ${line}`, note, write: false, optional: false };
}

function preflight(plan: Plan): PlannedStep {
  const reused = ROLES.filter((role) => plan.reused[role]).map((role) => plan.ids[role]);
  const rule = reused.length === 0 ? 'No service named thermus-spike-* of any type may exist.' : `${reused.join(' and ')} must be in this list, and no other thermus-spike-* service.`;
  return { title: 'Preflight (reads only)', calls: [
    api(ownerCall(plan.inputs.owner), 'The workspace exists.'),
    api(credentialsCall(plan.inputs.owner), `One credential has the ID or name "${plan.inputs.registryCredential}", for GITHUB. Its ID becomes {registryCredentialId}.`),
    api(servicesCall(plan.inputs.owner, ANY_TYPE), `No type filter. With each next cursor until a page is not full. ${rule}`),
  ] };
}

function liveService(plan: Plan, role: Role): readonly Planned[] {
  const id = plan.ids[role];
  if (plan.reused[role]) {
    return [
      api(serviceCall(id), `${REUSE_OPTION[role]}: no create. The service must not be suspended.`),
      api(recentDeploysCall(id), 'Its last deploy must be live.'),
      api(envVarsCall(id), 'The keys must be the six placeholder keys. No value is printed.'),
    ];
  }
  const source = role === 'web' ? { ...plan.inputs, serviceType: 'web_service' as const } : plan.inputs;
  return [
    api(createServiceCall(source, plan.names[role], '{registryCredentialId}'), 'The answer gives the service and the ID of its first deploy.'),
    api(deployCall(id, '{deployId}'), `${every(POLLS.deploy)}, until the deploy is live. A failed, canceled, or deactivated deploy fails the step.`),
    api(envVarsCall(id), 'The keys must be the keys of the create call. No value is printed.'),
  ];
}

function jobCalls(plan: Plan): readonly Planned[] {
  const command = startCommand(healthProgram(healthTargets(SLUG, URL_FIELD), RUN));
  const window = { startTime: '{createdAt-10s}', endTime: '{now}' };
  return [
    api(jobCall(plan.ids.web, command), `Without JSON escapes, the start command is: ${command}`),
    api(jobStatusCall(plan.ids.web, '{jobId}'), `${every(JOB_POLL)}, until the status is succeeded, failed, or canceled.`),
    api(logsCall(plan.inputs.owner, [plan.ids.web, '{jobId}'], window), `The lines of a job carry the job ID as their resource. startTime is the createdAt of the job less 10 s, and endTime the time of the read, in ISO 8601. ${every(LOG_POLL)}, with each next page while hasMore, until each request has its line: a JSON object with probe "SO-01d" and run "${RUN}".`),
  ];
}

const builders: Readonly<Record<StepId, (plan: Plan) => PlannedStep>> = {
  private: (plan) => ({ title: 'Private service', calls: [
    ...liveService(plan, 'private'),
    api(serviceCall(plan.ids.private), `serviceDetails.url must hold <slug>:<port>, and serviceDetails.openPorts must hold ${LISTEN_PORT}. They give ${SLUG} and ${URL_FIELD}.`),
  ] }),
  web: (plan) => ({ title: 'Web service', calls: [
    ...liveService(plan, 'web'),
    api(serviceCall(plan.ids.web), 'serviceDetails.url must be an https URL. It becomes {publicUrl}.'),
    here(`GET {publicUrl}${HEALTH_CHECK_PATH}`, `${every(PUBLIC_HEALTH)}, with a ${PUBLIC_HEALTH.timeoutMs / 1000} s timeout, until 200 with body ok.`),
  ] }),
  job: (plan) => ({ title: 'One-off job on the web service', calls: jobCalls(plan) }),
  'public-check': (plan) => ({ title: 'Public internet check', calls: [
    here(`DNS lookup of ${SLUG}`, 'The lookup must fail. The error code is recorded.'),
    here(`GET http://${SLUG}:${RENDER_PRIVATE_PORT}${HEALTH_CHECK_PATH}`, `With a ${REQUEST_TIMEOUT_MS / 1000} s timeout. The request must get no answer.`),
    api(serviceCall(plan.ids.private), 'serviceDetails.url must have no scheme, and no field may name onrender.com.'),
    here(`DNS lookup of ${SLUG}.onrender.com, then GET https://${SLUG}.onrender.com${HEALTH_CHECK_PATH} when it resolves`, 'Extra, recorded only.'),
  ] }),
};

function cleanup(plan: Plan): PlannedStep {
  const deleteNote = plan.inputs.keep ? 'Only after a failed step: --keep keeps the services when every step passed.' : 'Up to 3 attempts. A 404 answer means that the service is already gone.';
  const byName = ROLES.filter((role) => !plan.reused[role])
    .map((role) => api(servicesNamedCall(plan.inputs.owner, plan.names[role]), 'Only when the create answer gave no service ID: each service with this exact name is deleted.'));
  return { title: 'Cleanup (always, also after a failure or a stop signal)', calls: [
    api(jobStatusCall(plan.ids.web, '{jobId}'), 'Only when the job did not end in its step.'),
    api(cancelJobCall(plan.ids.web, '{jobId}'), 'Only when that read shows pending or running.', true),
    api(deleteServiceCall(plan.ids.web), deleteNote, plan.inputs.keep),
    api(deleteServiceCall(plan.ids.private), deleteNote, plan.inputs.keep),
    ...byName,
    api(servicesCall(plan.inputs.owner, ANY_TYPE), `${every(POLLS.cleanup)}, until no service of this run is listed; then no service named thermus-spike-* may exist.`),
  ] };
}

function plannedSteps(plan: Plan): readonly PlannedStep[] {
  if (plan.inputs.preflightOnly) return [preflight(plan)];
  return [preflight(plan), ...plan.inputs.steps.map((id) => builders[id](plan)), cleanup(plan)];
}

function writeCount(steps: readonly PlannedStep[]): string {
  const writes = steps.flatMap((step) => step.calls).filter((item) => item.write);
  const optional = writes.filter((item) => item.optional).length;
  if (writes.length === 0) return 'none: the client refuses each write';
  return optional === 0 ? `${writes.length}` : `${writes.length} at most; ${optional} of them only when needed (the notes that start with "Only")`;
}

function callText(planned: Planned): string[] {
  const lines = [planned.line];
  if (planned.body !== undefined) lines.push(...JSON.stringify(planned.body, null, 2).split('\n').map((line) => `  ${line}`));
  lines.push(`  -> ${planned.note}`);
  return lines;
}

function header(plan: Plan, steps: readonly PlannedStep[]): readonly string[] {
  const { inputs } = plan;
  const service = (role: Role): string => (plan.reused[role] ? `${plan.ids[role]}, given with ${REUSE_OPTION[role]}` : `${plan.names[role]}, created by this run`);
  const end = inputs.preflightOnly ? 'no cleanup' : `the services are ${inputs.keep ? 'kept (--keep)' : 'deleted at the end'}`;
  return [
    '# SO-01d part two dry run: planned calls', '',
    `No network call and no write. Real mode sends these calls in this order to ${API_BASE}, with the header`,
    '"Authorization: Bearer <RENDER_API_KEY>"; the key is never printed. Query values are shown decoded. Values in braces',
    'come from earlier answers. In real mode, YYYYMMDD-HHMMSS is the UTC start time. The variable values are',
    'placeholders, not secrets. A line that starts with "From this machine" is not a Render API call and sends no key.', '',
    `- Workspace: ${inputs.owner}; region ${inputs.region}`,
    `- Private service: ${service('private')}`,
    `- Web service: ${service('web')}`,
    `- Image: ${inputs.image.ref}`,
    `- Steps: ${inputs.preflightOnly ? 'the preflight only' : inputs.steps.join(', ')}; ${end}`,
    `- Writes: ${writeCount(steps)}`,
  ];
}

export function renderDryRun(inputs: ProbeInputs): string {
  const { services } = newState(inputs, RUN);
  const plan: Plan = {
    inputs,
    names: { private: services.private.name, web: services.web.name },
    ids: { private: services.private.reuseId ?? '{privateServiceId}', web: services.web.reuseId ?? '{webServiceId}' },
    reused: { private: services.private.reuseId !== undefined, web: services.web.reuseId !== undefined },
  };
  const steps = plannedSteps(plan);
  const body = steps.flatMap((step) => ['', `## ${step.title}`, '', ...step.calls.flatMap(callText)]);
  return `${[...header(plan, steps), ...body].join('\n')}\n`;
}

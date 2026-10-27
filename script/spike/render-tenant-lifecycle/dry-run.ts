import {
  API_BASE, callLine, createServiceCall, credentialsCall, deleteServiceCall, deployCall, deployImageCall, envVarsCall,
  eventsCall, FREE_PLAN, instancesCall, ownerCall, privateServicesCall, recentDeploysCall, resumeCall, serviceCall,
  servicesNamedCall, suspendCall, TEAM_PLAN, updatePlanCall, type Call,
} from './calls.ts';
import type { ProbeInputs } from './inputs.ts';
import { POLLS } from './polls.ts';
import type { StepId } from './step-ids.ts';

interface PlannedCall {
  readonly call: Call;
  readonly note: string;
  readonly optional?: boolean;
}

interface PlannedStep {
  readonly title: string;
  readonly calls: readonly PlannedCall[];
}

type Builder = (inputs: ProbeInputs, name: string, service: string) => readonly PlannedStep[];

export const DRY_RUN_NAME = 'thermus-spike-YYYYMMDD-HHMMSS';
const DEPLOY = '{deployId}';

function planned(call: Call, note: string, optional = false): PlannedCall {
  return { call, note, optional };
}

function waitLive(service: string): PlannedCall {
  return planned(deployCall(service, DEPLOY), `Every ${POLLS.deploy.everyMs / 1000} s, at most ${POLLS.deploy.attempts} times, until the deploy is live. A failed, canceled, or deactivated deploy fails the step.`);
}

function preflight(inputs: ProbeInputs): PlannedStep {
  const reuse = inputs.serviceId === undefined ? 'No service named thermus-spike-* may exist.' : `${inputs.serviceId} must be in this list, and no other thermus-spike-* service.`;
  return { title: 'Preflight (reads only)', calls: [
    planned(ownerCall(inputs.owner), 'The workspace exists.'),
    planned(credentialsCall(inputs.owner), `One credential has the ID or name "${inputs.registryCredential}", for GITHUB. Its ID becomes {registryCredentialId}.`),
    planned(privateServicesCall(inputs.owner), `With each next cursor until a page is not full. ${reuse}`),
  ] };
}

function planChange(inputs: ProbeInputs, service: string, plan: string): PlannedStep {
  return { title: `Plan change to ${plan}`, calls: [
    planned(instancesCall(service), 'The instances before the change.'),
    planned(recentDeploysCall(service), 'The deploy IDs before the change.'),
    planned(updatePlanCall(service, plan), `The answer must show plan ${plan}.`),
    planned(recentDeploysCall(service), `Every ${POLLS.window.everyMs / 1000} s, ${POLLS.window.attempts} times: did Render start a deploy after the update?`),
    planned(deployImageCall(service, inputs.secondImage.ref), 'Only when Render started no deploy: the deploy that applies the plan, with image 2.', true),
    waitLive(service),
    planned(serviceCall(service), `The service must show plan ${plan}.`),
    planned(instancesCall(service), 'A new instance ID means that a new container replaced the old one.'),
    planned(eventsCall(service), 'The event types since the update, for the record. No event details are printed.'),
  ] };
}

const builders: Readonly<Record<StepId, Builder>> = {
  create: (inputs, name, service) => [{ title: 'Create the private service', calls: [
    planned(createServiceCall(inputs, name, '{registryCredentialId}'), 'The answer gives the service and the ID of its first deploy.'),
    waitLive(service),
    planned(envVarsCall(service), 'The keys must be the keys of the create call. No value is printed.'),
  ] }],
  'internal-address': (_inputs, _name, service) => [{ title: 'Read the internal address', calls: [
    planned(serviceCall(service), 'A field must hold <slug>:<port>, and serviceDetails.openPorts must hold 8080.'),
  ] }],
  'image-2': (inputs, _name, service) => [{ title: 'Deploy image 2', calls: [
    planned(recentDeploysCall(service), 'The deploy IDs before the deploy.'),
    planned(deployImageCall(service, inputs.secondImage.ref), 'A 202 answer has no body: the probe then finds the new deploy in the deploy list.'),
    waitLive(service),
    planned(recentDeploysCall(service), 'The live deploy of the service must report image 2.'),
    planned(serviceCall(service), 'The image setting of the service, for the record.'),
  ] }],
  'plan-change': (inputs, _name, service) => [planChange(inputs, service, TEAM_PLAN), planChange(inputs, service, FREE_PLAN)],
  'suspend-resume': (_inputs, _name, service) => [{ title: 'Suspend and resume', calls: [
    planned(suspendCall(service), 'The answer is 202.'),
    planned(serviceCall(service), `Every ${POLLS.state.everyMs / 1000} s, at most ${POLLS.state.attempts} times, until suspended is "suspended".`),
    planned(instancesCall(service), 'The instances while suspended.'),
    planned(resumeCall(service), 'The answer is 202.'),
    planned(serviceCall(service), 'Until suspended is "not_suspended".'),
    planned(recentDeploysCall(service), `Every ${POLLS.newDeploy.everyMs / 1000} s, at most ${POLLS.newDeploy.attempts} times, until a deploy appears after the resume.`),
    waitLive(service),
    planned(eventsCall(service), 'The event types since the suspend, for the record.'),
  ] }],
};

function cleanup(inputs: ProbeInputs, name: string, service: string): PlannedStep {
  const title = 'Cleanup (always, also after a failure or a stop signal)';
  const list = privateServicesCall(inputs.owner);
  if (inputs.keep) {
    return { title, calls: [
      planned(deleteServiceCall(service), 'Only after a failed step: --keep keeps the service when every step passed.', true),
      planned(list, 'No other thermus-spike-* service may exist.'),
    ] };
  }
  const byName = inputs.serviceId === undefined ? [planned(servicesNamedCall(inputs.owner, name), 'Only when the create answer gave no service ID: each service with this exact name is deleted.')] : [];
  return { title, calls: [
    planned(deleteServiceCall(service), 'Up to 3 attempts. A 404 answer means that the service is already gone.'),
    ...byName,
    planned(list, `Every ${POLLS.cleanup.everyMs / 1000} s, at most ${POLLS.cleanup.attempts} times, until no service named thermus-spike-* exists.`),
  ] };
}

function plannedSteps(inputs: ProbeInputs, name: string): readonly PlannedStep[] {
  const service = inputs.serviceId ?? '{serviceId}';
  if (inputs.preflightOnly) return [preflight(inputs)];
  return [preflight(inputs), ...inputs.steps.flatMap((id) => builders[id](inputs, name, service)), cleanup(inputs, name, service)];
}

function writeCount(steps: readonly PlannedStep[]): string {
  const writes = steps.flatMap((step) => step.calls).filter((item) => item.call.method !== 'GET');
  const optional = writes.filter((item) => item.optional === true).length;
  if (writes.length === 0) return 'none: the client refuses each write';
  return optional === 0 ? `${writes.length}` : `${writes.length} at most; ${optional} of them only when needed (the notes that start with "Only")`;
}

function callText({ call, note }: PlannedCall): string[] {
  const lines = [callLine(call)];
  if (call.body !== undefined) lines.push(...JSON.stringify(call.body, null, 2).split('\n').map((line) => `  ${line}`));
  lines.push(`  -> ${note}`);
  return lines;
}

export function renderDryRun(inputs: ProbeInputs, name: string): string {
  const steps = plannedSteps(inputs, name);
  const created = inputs.preflightOnly ? 'none (--preflight)' : `${name}, created by this run`;
  const service = inputs.serviceId === undefined ? created : `${inputs.serviceId}, given with --service-id`;
  const end = inputs.preflightOnly ? 'no cleanup' : `the service is ${inputs.keep ? 'kept (--keep)' : 'deleted at the end'}`;
  const header = [
    '# SO-01c dry run: planned calls', '',
    `No network call and no write. Real mode sends these calls in this order to ${API_BASE}, with the header`,
    '"Authorization: Bearer <RENDER_API_KEY>"; the key is never printed. {serviceId}, {deployId}, and',
    '{registryCredentialId} come from earlier answers. In real mode, YYYYMMDD-HHMMSS is the UTC start time.',
    'The variable values are placeholders, not secrets.', '',
    `- Workspace: ${inputs.owner}; region ${inputs.region}`,
    `- Service: ${service}`,
    `- Steps: ${inputs.preflightOnly ? 'the preflight only' : inputs.steps.join(', ')}; ${end}`,
    `- Image 1: ${inputs.image.ref}`,
    `- Image 2: ${inputs.secondImage.ref}`,
    `- Writes: ${writeCount(steps)}`,
  ];
  const body = steps.flatMap((step) => ['', `## ${step.title}`, '', ...step.calls.flatMap(callText)]);
  return `${[...header, ...body].join('\n')}\n`;
}

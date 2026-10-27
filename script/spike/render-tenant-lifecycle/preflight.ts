import assert from 'node:assert/strict';
import { credentialsCall, ownerCall } from './calls.ts';
import { credentialsOf, fieldText } from './answers.ts';
import { addRow, type ProbeContext } from './context.ts';
import { probeServices } from './waits.ts';

async function readWorkspace(context: ProbeContext, problems: string[]): Promise<string> {
  const owner = (await context.client.read(ownerCall(context.inputs.owner), context.signal)).json;
  const workspace = `${fieldText(owner, 'name') ?? 'no name'} (${fieldText(owner, 'type') ?? 'no type'})`;
  if (fieldText(owner, 'id') !== context.inputs.owner) problems.push(`The workspace answer names ${fieldText(owner, 'id') ?? 'no ID'}, not ${context.inputs.owner}.`);
  addRow(context, 'Preflight', { check: 'Workspace', expected: 'the given owner', measured: workspace });
  return workspace;
}

async function findCredential(context: ProbeContext, problems: string[]): Promise<string> {
  const wanted = context.inputs.registryCredential;
  const credentials = credentialsOf((await context.client.read(credentialsCall(context.inputs.owner), context.signal)).json);
  const matches = credentials.filter((item) => item.id === wanted || item.name === wanted);
  const [match] = matches;
  const measured = match === undefined ? `none of ${credentials.length} credentials of the workspace` : matches.map((item) => `${item.name ?? 'no name'} (${item.id}), ${item.registry ?? 'no registry'}`).join('; ');
  addRow(context, 'Preflight', { check: `Registry credential "${wanted}"`, expected: 'one credential with this ID or name; registry GITHUB', measured });
  if (match === undefined) {
    problems.push(`The workspace has no registry credential with the ID or name "${wanted}". Create it as the SO-01b owner steps say.`);
    return 'no credential';
  }
  if (matches.length > 1) problems.push(`${matches.length} registry credentials have the ID or name "${wanted}". Give the ID.`);
  if (match.registry !== 'GITHUB') problems.push(`The registry credential "${wanted}" is for ${match.registry ?? 'no registry'}, not GITHUB.`);
  context.state.credentialId = match.id;
  return `${match.name ?? 'no name'} (${match.id})`;
}

async function checkServices(context: ProbeContext, problems: string[]): Promise<void> {
  const reuse = context.inputs.serviceId;
  const services = await probeServices(context, context.signal);
  const reused = services.find((service) => service.id === reuse);
  const others = services.filter((service) => service.id !== reuse);
  const listed = services.map((service) => `${service.name} (${service.id})`).join(', ') || 'none';
  addRow(context, 'Preflight', { check: 'Services named thermus-spike-*', expected: reuse === undefined ? 'none' : `only ${reuse}`, measured: listed });
  if (reuse !== undefined && reused === undefined) problems.push(`--service-id ${reuse} is not a thermus-spike-* private service of the workspace ${context.inputs.owner}. The probe touches no other service.`);
  if (others.length > 0) problems.push(`Services of an earlier run exist: ${others.map((service) => service.name).join(', ')}. Delete them in the Render Dashboard, or give one with --service-id.`);
  if (reused !== undefined) {
    context.client.confirmOwnService(reused.id, reused.name);
    context.state.serviceId = reused.id;
    context.state.serviceName = reused.name;
  }
}

export async function preflight(context: ProbeContext): Promise<string> {
  const problems: string[] = [];
  const workspace = await readWorkspace(context, problems);
  const credential = await findCredential(context, problems);
  await checkServices(context, problems);
  assert.deepEqual(problems, [], problems.join(' '));
  const service = context.state.serviceId === undefined ? 'no service of an earlier run exists' : `the probe uses ${context.state.serviceName} (${context.state.serviceId})`;
  return `the workspace ${workspace} and the credential ${credential} exist, and ${service}.`;
}

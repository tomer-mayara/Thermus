import assert from 'node:assert/strict';
import { addRow } from '../render-tenant-lifecycle/context.ts';
import { findCredential, readWorkspace } from '../render-tenant-lifecycle/preflight.ts';
import { probeServices, type ProbeService } from '../render-tenant-lifecycle/waits.ts';
import { ANY_TYPE } from '../private-network-probe/preflight.ts';
import { REUSE_OPTION, ROLES, type ProbeContext, type Role } from './context.ts';
import { LIVE_GATE_RESOURCE, listResources, RESOURCES_PATH } from './oauth-resource.ts';

// A reused service must be in the list with the name of its role. Only then may the run touch it.
function useListed(context: ProbeContext, role: Role, services: readonly ProbeService[]): string | undefined {
  const state = context.state.services[role];
  if (state.reuseId === undefined) return undefined;
  const found = services.find((service) => service.id === state.reuseId);
  if (found === undefined) return `${REUSE_OPTION[role]} ${state.reuseId} is not a thermus-spike-* service of the workspace ${context.inputs.owner}. The probe touches no other service.`;
  if (!found.name.startsWith(state.prefix)) return `${REUSE_OPTION[role]} ${found.id} names ${found.name}, not a ${state.prefix}* ${state.label}.`;
  context.client.confirmOwnService(found.id, found.name);
  state.serviceId = found.id;
  state.name = found.name;
  return undefined;
}

async function checkServices(context: ProbeContext, problems: string[]): Promise<void> {
  const services = await probeServices(context, context.signal, ANY_TYPE);
  const reuseIds = ROLES.map((role) => context.state.services[role].reuseId).filter((id) => id !== undefined);
  const others = services.filter((service) => !reuseIds.includes(service.id));
  const listed = services.map((service) => `${service.name} (${service.id})`).join(', ') || 'none';
  addRow(context, 'Preflight', { check: 'Services named thermus-spike-*, any type', expected: reuseIds.length === 0 ? 'none' : `only ${reuseIds.join(', ')}`, measured: listed });
  for (const role of ROLES) {
    const problem = useListed(context, role, services);
    if (problem !== undefined) problems.push(problem);
  }
  if (others.length > 0) problems.push(`Services of an earlier run exist: ${others.map((service) => service.name).join(', ')}. Delete them, or give them with ${REUSE_OPTION.tenant} and ${REUSE_OPTION.pages}.`);
}

// A read of the WorkOS Staging environment: its resource list answers and holds the live gate URI.
async function checkWorkOS(context: ProbeContext, problems: string[]): Promise<string> {
  const resources = await listResources(context.secrets.workos);
  const gate = resources.some((item) => item.uri === LIVE_GATE_RESOURCE);
  addRow(context, 'Preflight', { check: `WorkOS Staging: GET ${RESOURCES_PATH}`, expected: `200; the live gate URI ${LIVE_GATE_RESOURCE} is listed`, measured: `200; ${resources.length} resources; the live gate URI is ${gate ? '' : 'NOT '}listed` });
  if (!gate) problems.push(`The live gate URI ${LIVE_GATE_RESOURCE} is not listed in the WorkOS Staging environment.`);
  return `${resources.length} WorkOS resources`;
}

export async function preflight(context: ProbeContext): Promise<string> {
  const problems: string[] = [];
  const workspace = await readWorkspace(context, problems);
  const credential = await findCredential(context, problems);
  await checkServices(context, problems);
  const workos = await checkWorkOS(context, problems);
  assert.deepEqual(problems, [], problems.join(' '));
  const used = ROLES.map((role) => context.state.services[role]).filter((state) => state.serviceId !== undefined);
  const services = used.length === 0 ? 'no service of an earlier run exists' : `the probe uses ${used.map((state) => `${state.name} (${state.serviceId})`).join(' and ')}`;
  return `the workspace ${workspace} and the credential ${credential} exist, ${services}, and the WorkOS Staging environment answers (${workos}, the live gate URI listed).`;
}

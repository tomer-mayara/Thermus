import assert from 'node:assert/strict';
import type { ServiceType } from '../render-tenant-lifecycle/calls.ts';
import { addRow } from '../render-tenant-lifecycle/context.ts';
import { findCredential, readWorkspace } from '../render-tenant-lifecycle/preflight.ts';
import { probeServices, type ProbeService } from '../render-tenant-lifecycle/waits.ts';
import { ROLES, type ProbeContext, type Role } from './context.ts';
import { WEB_PREFIX } from './inputs.ts';

// An empty type list sends no type filter: the preflight and the cleanup see thermus-spike-* services of every type.
export const ANY_TYPE: readonly ServiceType[] = [];

export const REUSE_OPTION: Readonly<Record<Role, string>> = { private: '--private-service-id', web: '--web-service-id' };

function nameFitsRole(role: Role, name: string): boolean {
  return role === 'web' ? name.startsWith(WEB_PREFIX) : !name.startsWith(WEB_PREFIX);
}

// A reused service must be in the list and have the name of its role. Only then may the run touch it.
function useListed(context: ProbeContext, role: Role, services: readonly ProbeService[]): string | undefined {
  const state = context.state.services[role];
  if (state.reuseId === undefined) return undefined;
  const found = services.find((service) => service.id === state.reuseId);
  if (found === undefined) return `${REUSE_OPTION[role]} ${state.reuseId} is not a thermus-spike-* service of the workspace ${context.inputs.owner}. The probe touches no other service.`;
  if (!nameFitsRole(role, found.name)) return `${REUSE_OPTION[role]} ${found.id} names ${found.name}, which is not the name of a ${state.label} of this probe.`;
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
  if (others.length > 0) problems.push(`Services of an earlier run exist: ${others.map((service) => service.name).join(', ')}. Delete them in the Render Dashboard, or give them with ${REUSE_OPTION.private} and ${REUSE_OPTION.web}.`);
}

export async function preflight(context: ProbeContext): Promise<string> {
  const problems: string[] = [];
  const workspace = await readWorkspace(context, problems);
  const credential = await findCredential(context, problems);
  await checkServices(context, problems);
  assert.deepEqual(problems, [], problems.join(' '));
  const used = ROLES.map((role) => context.state.services[role]).filter((state) => state.serviceId !== undefined);
  const services = used.length === 0 ? 'no service of an earlier run exists' : `the probe uses ${used.map((state) => `${state.name} (${state.serviceId})`).join(' and ')}`;
  return `the workspace ${workspace} and the credential ${credential} exist, and ${services}.`;
}

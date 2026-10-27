import assert from 'node:assert/strict';
import { deleteServiceCall } from '../render-tenant-lifecycle/calls.ts';
import { addRow, messageOf, seconds } from '../render-tenant-lifecycle/context.ts';
import { createdIds, untilGone } from '../render-tenant-lifecycle/create.ts';
import { probeServices } from '../render-tenant-lifecycle/waits.ts';
import { ANY_TYPE } from '../private-network-probe/preflight.ts';
import { fixtureEmailPrefix, fixtureNamePrefix } from '../../../test/support/hosted-live/fixture-registry.ts';
import { REUSE_OPTION, ROLES, serviceLine, type FixtureParts, type ProbeContext, type ProbeStep, type Role } from './context.ts';
import { deleteOwnResource } from './oauth-resource.ts';

const STEP = 'Cleanup';
const DELETE_ORDER: readonly Role[] = ['tenant', 'pages'];

// The fixtures of the run, found again by their names and their email: none may remain after the deletes.
async function fixturesOfRun(fixtures: FixtureParts): Promise<readonly string[]> {
  const { workos, runId } = fixtures;
  const name = `${fixtureNamePrefix}${runId} `;
  const applications = await (await workos.connect.listApplications()).autoPagination();
  const users = await (await workos.userManagement.listUsers({ email: `${fixtureEmailPrefix}${runId}-capacity@example.net` })).autoPagination();
  const organizations = await (await workos.organizations.listOrganizations()).autoPagination();
  return [
    ...applications.filter((item) => item.name.startsWith(name)).map((item) => `application ${item.id}`),
    ...users.map((item) => `user ${item.id}`),
    ...organizations.filter((item) => item.name.startsWith(name)).map((item) => `organization ${item.id}`),
  ];
}

// The registry deletes the application, then the user with its membership, then the organization.
async function deleteFixtures(context: ProbeContext, problems: string[]): Promise<string> {
  const fixtures = context.state.fixtures;
  if (fixtures === undefined) return 'no WorkOS fixture of this run';
  await fixtures.browser.close().catch((error: unknown) => problems.push(`The browser did not close: ${messageOf(error)}`));
  await fixtures.registry.deleteAll().catch((error: unknown) => problems.push(messageOf(error)));
  const left = await fixturesOfRun(fixtures);
  addRow(context, STEP, { check: `WorkOS fixtures named with ${fixtures.runId}`, expected: '0 after the deletes', measured: left.length === 0 ? '0' : left.join(', ') });
  if (left.length > 0) problems.push(`WorkOS fixtures of the run remain: ${left.join(', ')}.`);
  return `deleted the WorkOS fixtures of ${fixtures.runId}`;
}

async function resourceCleanup(context: ProbeContext, problems: string[]): Promise<string> {
  const resource = context.state.resource;
  if (context.inputs.keep && resource !== undefined) {
    addRow(context, STEP, { check: 'OAuth resource (--keep)', expected: 'kept with the services', measured: `${resource.uri} (${resource.id}), ${resource.createdInRun ? 'created by this run' : 'from an earlier run'}` });
    return `kept the OAuth resource ${resource.uri}`;
  }
  try {
    const text = await deleteOwnResource(context);
    addRow(context, STEP, { check: 'OAuth resource', expected: 'deleted when this run created it; the live gate URI untouched', measured: text });
    return text;
  } catch (error) {
    problems.push(`${messageOf(error)}. Delete ${resource?.uri ?? 'the resource'} in the WorkOS Staging dashboard.`);
    return 'the OAuth resource delete failed';
  }
}

async function deleteService(context: ProbeContext, role: Role, id: string): Promise<string | undefined> {
  const state = context.state.services[role];
  try {
    const answer = await context.client.remove(STEP, deleteServiceCall(id), context.signal);
    addRow(context, STEP, { check: `Delete the ${state.label} ${id}`, expected: '204, or 404 when already gone', measured: `${answer.status} after ${seconds(answer.ms)}` });
    return undefined;
  } catch (error) {
    addRow(context, STEP, { check: `Delete the ${state.label} ${id}`, expected: '204, or 404 when already gone', measured: `failed: ${messageOf(error)}` });
    return `${messageOf(error)}. Delete ${state.name} (${id}) in the Render Dashboard.`;
  }
}

async function keepServices(context: ProbeContext): Promise<string> {
  const kept = ROLES.filter((role) => context.state.services[role].serviceId !== undefined);
  const ids = kept.map((role) => context.state.services[role].serviceId);
  const others = (await probeServices(context, context.signal, ANY_TYPE)).filter((service) => !ids.includes(service.id));
  const lines = kept.map((role) => serviceLine(context.state.services[role]));
  addRow(context, STEP, { check: 'Kept services (--keep)', expected: 'the services of this run only', measured: `${lines.join(', ') || 'none'}; other thermus-spike-* services: ${others.length}` });
  const options = kept.map((role) => `${REUSE_OPTION[role]} ${context.state.services[role].serviceId}`);
  return kept.length === 0 ? 'no service of this run existed' : `kept ${lines.join(' and ')}; a later run takes ${options.join(' ')}`;
}

async function deleteServices(context: ProbeContext, problems: string[]): Promise<string> {
  const lister = { client: context.client, signal: context.signal, owner: context.inputs.owner };
  const deleted: string[] = [];
  for (const role of DELETE_ORDER) {
    for (const id of await createdIds(lister, context.state.services[role])) {
      const problem = await deleteService(context, role, id);
      if (problem === undefined) deleted.push(id);
      else problems.push(problem);
    }
  }
  const names = ROLES.map((role) => context.state.services[role].name);
  const started = performance.now();
  const remaining = await untilGone(lister, { names, types: ANY_TYPE, what: 'the services of this run to leave the service list' });
  addRow(context, STEP, { check: 'Services of this run in the list', expected: '0', measured: `0, ${seconds(performance.now() - started)} after the deletes; other thermus-spike-* services: ${remaining.join(', ') || 'none'}` });
  return deleted.length === 0 ? 'no service of this run existed' : `deleted ${deleted.join(' and ')}`;
}

async function cleanup(context: ProbeContext): Promise<string> {
  const problems: string[] = [];
  const fixtures = await deleteFixtures(context, problems).catch((error: unknown) => {
    problems.push(`The fixture check failed: ${messageOf(error)}`);
    return 'the WorkOS fixture check failed';
  });
  const resource = await resourceCleanup(context, problems);
  const services = context.inputs.keep ? await keepServices(context) : await deleteServices(context, problems);
  assert.deepEqual(problems, [], problems.join(' '));
  return `${fixtures}; ${resource}; ${services}.`;
}

export const cleanupStep: ProbeStep = {
  name: STEP,
  spec: 'Given any step, when the probe fails or ends, then it deletes the WorkOS fixtures of the run, the OAuth resource that this run created and the two services unless --keep, and no service of this run remains in the list.',
  run: cleanup,
};

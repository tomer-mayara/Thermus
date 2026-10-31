// The WorkOS Staging objects of the rehearsal: the OAuth resource of the staging control plane (R3b), organization A
// with its user and membership, a client owner organization with the Connect application (R6), the signup user of
// organization B (R9), the removal of A (R13), and the cleanup. Each name and email has the run ID. Only the WorkOS
// Staging values of the launcher reach this module (rehearsal-settings.ts).
import type { WorkOS } from '@workos-inc/node';
import { listResources, RESOURCES_PATH } from '../../spike/capacity-probe/oauth-resource.ts';
import { FixtureRegistry } from '../../../test/support/hosted-live/fixture-registry.ts';
import { requestTimeout, type HostedLiveSettings } from '../../../test/support/hosted-live/settings.ts';
import { FixtureFactory } from '../../../test/support/hosted-live/staging-fixtures.ts';
import { deleteWorkOSResource } from '../../../test/support/hosted-live/workos-api.ts';
import { statusOf } from '../../../test/support/hosted-live/sdk-errors.ts';
import { setTimeout as delay } from 'node:timers/promises';
import { CONNECT_CALLBACK, utcNow } from './rehearsal-settings.ts';
import { updateState, type RehearsalState } from './rehearsal-state.ts';

type Print = (line: string) => void;

/** The WorkOS client of Staging, the private state folder, and the output of one command. */
export interface WorkOSSession {
  readonly workos: WorkOS;
  readonly settings: HostedLiveSettings;
  readonly dir: string;
  readonly print: Print;
}

const GONE_READS = { everyMs: 2_000, attempts: 60 };

export async function printResources(settings: HostedLiveSettings, print: Print): Promise<void> {
  for (const resource of await listResources(settings)) print(`OAuth resource ${resource.id} ${resource.uri}`);
}

/** R3b: the additive POST of one OAuth resource; the other resources stay. */
export async function addResource({ settings, dir, print }: WorkOSSession, uri: string): Promise<void> {
  if ((await listResources(settings)).some((item) => item.uri === uri)) throw new Error(`${uri} is listed already. Nothing changed.`);
  const response = await fetch(`https://api.workos.com${RESOURCES_PATH}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${settings.apiKey}`, Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ uri }),
    redirect: 'error',
    signal: AbortSignal.timeout(requestTimeout),
  });
  const body = await response.json().catch(() => ({})) as { id?: unknown; uri?: unknown };
  print(`POST ${RESOURCES_PATH} at ${utcNow()}: ${response.status}`);
  if ((response.status !== 200 && response.status !== 201) || typeof body.id !== 'string') throw new Error(`The resource create answered ${response.status}.`);
  const id = body.id;
  updateState(dir, (state) => { state.resource = { id, uri }; });
  print(`Created ${id} ${String(body.uri)}`);
  await printResources(settings, print);
}

/** R6: the client owner organization, organization A, its user with the roles user and admin, and the Connect application. */
export async function makeFixtures({ workos, dir, print }: WorkOSSession, runId: string): Promise<void> {
  const make = new FixtureFactory(workos, new FixtureRegistry(workos), runId);
  const owner = await make.organization('client owner');
  updateState(dir, (state) => { state.organizations.owner = { id: owner.id, name: owner.name }; });
  const organization = await make.organization('A');
  updateState(dir, (state) => { state.organizations.A = { id: organization.id, name: organization.name }; });
  const user = await make.user('a');
  updateState(dir, (state) => { state.users.A = user; });
  const membership = await make.membership(user, organization, ['user', 'admin']);
  updateState(dir, (state) => { state.memberships.A = membership; });
  const application = await workos.connect.createApplication({
    applicationType: 'oauth', name: `Thermus live ${runId} MCP client`, isFirstParty: false, organizationId: owner.id, usesPkce: true,
    redirectUris: [{ uri: CONNECT_CALLBACK, default: true }],
  });
  updateState(dir, (state) => { state.application = { id: application.id, clientId: application.clientId }; });
  print(`Client owner organization ${owner.id} "${owner.name}"; organization A ${organization.id} "${organization.name}"`);
  print(`User A ${user.id} ${user.email}; membership ${membership} with the roles user and admin`);
  print(`Connect application ${application.id}, client ${application.clientId}, callback ${CONNECT_CALLBACK}, owner ${owner.id}`);
}

/** R9: a new verified user without memberships, for the signup of organization B. */
export async function makeSignupUser({ workos, dir, print }: WorkOSSession, runId: string): Promise<void> {
  const user = await new FixtureFactory(workos, new FixtureRegistry(workos), runId).user('b');
  updateState(dir, (state) => { state.users.B = user; });
  print(`User B ${user.id} ${user.email}, verified, without memberships`);
}

async function gone(read: () => Promise<unknown>): Promise<boolean> {
  try {
    await read();
    return false;
  } catch (error) {
    if (statusOf(error) === 404) return true;
    throw error;
  }
}

/** Reads one object by its ID until WorkOS answers 404, and prints the time. */
async function untilGone(what: string, read: () => Promise<unknown>, since: { readonly print: Print; readonly deletedAt: number }): Promise<void> {
  const { print, deletedAt } = since;
  for (let attempt = 1; attempt <= GONE_READS.attempts; attempt++) {
    if (await gone(read)) {
      print(`${what}: 404 at read ${attempt}, ${((performance.now() - deletedAt) / 1_000).toFixed(1)} s after the delete`);
      return;
    }
    await delay(GONE_READS.everyMs);
  }
  throw new Error(`${what} still answered after ${GONE_READS.attempts} reads.`);
}

/** R13: the delete of one organization by its exact ID, then reads by ID until the answer is 404. */
export async function deleteOrganization(workos: WorkOS, id: string, print: Print): Promise<void> {
  print(`DELETE organization ${id} at ${utcNow()}`);
  const deletedAt = performance.now();
  await workos.organizations.deleteOrganization(id);
  await untilGone(`Organization ${id}`, () => workos.organizations.getOrganization(id), { print, deletedAt });
}

async function removeObject(what: string, remove: () => Promise<unknown>, print: Print): Promise<void> {
  try {
    await remove();
    print(`Deleted ${what}`);
  } catch (error) {
    if (statusOf(error) !== 404) throw error;
    print(`${what}: already gone (404)`);
  }
}

/** The cleanup of the WorkOS objects of the state, in the order application, users, organizations, resource. */
export async function cleanupWorkOS({ workos, settings, print }: WorkOSSession, state: RehearsalState): Promise<void> {
  const started = performance.now();
  const since = { print, deletedAt: started };
  const application = state.application;
  if (application !== undefined) await removeObject(`Connect application ${application.id}`, () => workos.connect.deleteApplication({ id: application.id }), print);
  for (const user of Object.values(state.users)) await removeObject(`user ${user.id}`, () => workos.userManagement.deleteUser(user.id), print);
  for (const organization of Object.values(state.organizations)) await removeObject(`organization ${organization.id}`, () => workos.organizations.deleteOrganization(organization.id), print);
  if (state.resource !== undefined) {
    const status = await deleteWorkOSResource(settings, `${RESOURCES_PATH}/${state.resource.id}`);
    print(`DELETE OAuth resource ${state.resource.id}: ${status}`);
  }
  if (application !== undefined) await untilGone(`Connect application ${application.id}`, () => workos.connect.getApplication({ id: application.id }), since);
  for (const user of Object.values(state.users)) await untilGone(`User ${user.id}`, () => workos.userManagement.getUser(user.id), since);
  for (const organization of Object.values(state.organizations)) await untilGone(`Organization ${organization.id}`, () => workos.organizations.getOrganization(organization.id), since);
}

/** The organizations that WorkOS Staging made since a time: the ID, the creation time, and the name. */
export async function organizationsSince(workos: WorkOS, since: string, print: Print): Promise<void> {
  const all = await (await workos.organizations.listOrganizations()).autoPagination();
  const made = all.filter((organization) => organization.createdAt >= since).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  print(`${all.length} organizations in WorkOS Staging; ${made.length} made since ${since}`);
  for (const organization of made) print(`${organization.id} ${organization.createdAt} "${organization.name}"`);
}

/** The organizations, users, and Connect applications whose name or email holds the run ID. */
export async function runObjects(workos: WorkOS, runId: string, print: Print): Promise<number> {
  const organizations = (await (await workos.organizations.listOrganizations()).autoPagination()).filter((item) => item.name.includes(runId));
  const users = (await (await workos.userManagement.listUsers()).autoPagination()).filter((item) => item.email.includes(runId));
  const applications = (await (await workos.connect.listApplications()).autoPagination()).filter((item) => item.name.includes(runId));
  print(`Objects with the run ID ${runId}: ${organizations.length} organizations, ${users.length} users, ${applications.length} Connect applications`);
  for (const item of organizations) print(`organization ${item.id} "${item.name}"`);
  for (const item of users) print(`user ${item.id} ${item.email}`);
  for (const item of applications) print(`application ${item.id} "${item.name}"`);
  return organizations.length + users.length + applications.length;
}

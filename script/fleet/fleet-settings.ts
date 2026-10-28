// The settings of the fleet script, from the environment. In development, run it with
// `node --env-file=/Users/tomermayara/git/Thermus/.env.local`, and through the WorkOS Staging launcher for a command
// that reads WorkOS. Each refusal names the variable, never its value.
import { readFile } from 'node:fs/promises';
import { loadFreeTenantLimit } from '../../src/runtime/config/free-tenant-limit-config.ts';
import { loadTenantNamePrefix } from '../../src/runtime/config/mcp-tenants-config.ts';

type Environment = Readonly<Record<string, string | undefined>>;

// My Workspace of the owner's Render user holds no Thermus service, so the script never uses it.
const MY_WORKSPACE_ID = 'tea-d3mlbrvdiees73ca4rdg';
const OWNER_ID = /^tea-[a-z0-9]{1,64}$/;

/** A usage error or a refused setting: the script stops before any call, with exit code 2. */
export class FleetUsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FleetUsageError';
  }
}

export interface RegistrySettings {
  readonly connectionString: string;
  readonly ca?: string;
}

export interface RenderSettings {
  // The fleet key: the Render API key of the owner's Render user, not the key of the control plane (plan section 4.2).
  readonly apiKey: string;
  readonly ownerId: string;
}

function required(environment: Environment, name: string, purpose: string): string {
  const value = environment[name];
  if (value === undefined || value === '') throw new FleetUsageError(`${name} is required: ${purpose}.`);
  return value;
}

/** DATABASE_URL and the optional DATABASE_CA_CERT_PATH: the tenant registry of the fleet. */
export async function registrySettingsOf(environment: Environment): Promise<RegistrySettings> {
  const connectionString = required(environment, 'DATABASE_URL', 'the connection of the runtime role to the tenant registry');
  const path = environment.DATABASE_CA_CERT_PATH;
  if (path === undefined || path === '') return { connectionString };
  try {
    return { connectionString, ca: await readFile(path, 'utf8') };
  } catch {
    throw new FleetUsageError('DATABASE_CA_CERT_PATH must name a readable PEM certificate file.');
  }
}

/** RENDER_API_KEY and RENDER_OWNER_ID: the fleet key and the workspace of the tenants, never My Workspace. */
export function renderSettingsOf(environment: Environment): RenderSettings {
  const apiKey = required(environment, 'RENDER_API_KEY', 'the Render API key of the fleet');
  const ownerId = required(environment, 'RENDER_OWNER_ID', 'the Render workspace of the tenants, tea-db8i6ceq1p3s73dev9og for Thermus AI');
  if (!OWNER_ID.test(ownerId)) throw new FleetUsageError('RENDER_OWNER_ID must be the ID of a Render workspace, such as tea-<lowercase letters and digits>.');
  if (ownerId === MY_WORKSPACE_ID) throw new FleetUsageError(`RENDER_OWNER_ID names My Workspace (${MY_WORKSPACE_ID}), which holds no Thermus service.`);
  return { apiKey, ownerId };
}

/** WORKOS_API_KEY and WORKOS_CLIENT_ID: the WorkOS environment of the organizations. */
export function workosSettingsOf(environment: Environment): { readonly apiKey: string; readonly clientId?: string } {
  const apiKey = required(environment, 'WORKOS_API_KEY', 'the WorkOS environment of the organizations; in development, run the script through the WorkOS Staging launcher');
  const clientId = environment.WORKOS_CLIENT_ID;
  return clientId === undefined || clientId === '' ? { apiKey } : { apiKey, clientId };
}

/** TENANT_PLAN_FREE: the plan of a free tenant, which the cost of the summary needs. */
export function freePlanOf(environment: Environment): string {
  return required(environment, 'TENANT_PLAN_FREE', 'the Render plan of a free tenant, such as 0.5c-512mb, for the cost of the summary');
}

/** TENANT_NAME_PREFIX, with the rule of the control plane: the script works only on the tenants of this prefix. */
export function namePrefixOf(environment: Environment): string {
  return withUsageError(() => loadTenantNamePrefix(environment));
}

/** FREE_TENANT_LIMIT, with the rule and the default of the control plane. */
export function freeTenantLimitOf(environment: Environment): number {
  return withUsageError(() => loadFreeTenantLimit(environment));
}

function withUsageError<T>(read: () => T): T {
  try {
    return read();
  } catch (error) {
    throw new FleetUsageError(error instanceof Error ? error.message : String(error));
  }
}

#!/usr/bin/env node
// SO-09 of the self on-boarding plan: the fleet script of the tenant services, over the Render adapter of the tenant
// platform and the tenant registry of the control plane, which it imports from src. Each write command prints what it
// will do and waits for the answer yes; without it, it writes nothing. The script works only on the rows of its
// TENANT_NAME_PREFIX, never on the production service srv-db8mnqg473hc739d529g, and never in My Workspace. It never
// prints a key. Exit code 0: the command ended, also after an answer other than yes. 1: a step failed. 2: a usage
// error or a refused setting, before any write.
import { parseArgs } from 'node:util';
import { processIo } from './fleet-confirm.ts';
import { FleetContext } from './fleet-context.ts';
import { deleteTenant } from './fleet-delete.ts';
import { resumeTenant, suspendTenant } from './fleet-power.ts';
import { fleetSummary, listTenants, tenantStatus, type CommandParts } from './fleet-reads.ts';
import { requestTenant } from './fleet-request.ts';
import { FleetStepError } from './fleet-rows.ts';
import { FleetUsageError, namePrefixOf } from './fleet-settings.ts';
import { MAX_BATCH, upgradeTenants } from './fleet-upgrade.ts';

const USAGE = `Usage: node --env-file=<main checkout>/.env.local script/fleet/fleet.ts <command> [options]

Commands:
  list                                    The rows of the tenant registry of TENANT_NAME_PREFIX.
  status --organization <id>              The row of the organization, and its newest deploy and internal address.
  request --organization <id>             A tenant for an organization that WorkOS has: a requested row inside
                                          FREE_TENANT_LIMIT; a deleted row becomes requested again.
  upgrade --image <reference@sha256:...> (--organization <id> | --all) [--batch-size 1..${MAX_BATCH}]
                                          Deploy the image to the live tenants in batches of ${MAX_BATCH}, stop at the
                                          first deploy that does not reach live, and record the digest.
  suspend --organization <id>             Suspend a live tenant.
  resume --organization <id>              Resume a suspended tenant, and wait until its deploy is live.
  delete --organization <id>              Delete the Render service of the tenant, then set its row deleted.
  summary                                 Print the daily summary line: Tenant fleet summary: <JSON>.

Settings from the environment:
  DATABASE_URL, DATABASE_CA_CERT_PATH     The tenant registry (each command).
  RENDER_API_KEY, RENDER_OWNER_ID         The fleet key and the workspace (status, upgrade, suspend, resume, delete,
                                          summary).
  WORKOS_API_KEY, WORKOS_CLIENT_ID        The WorkOS environment (request, summary).
  TENANT_NAME_PREFIX                      The prefix of the tenant services; default thermus-tenant-.
  TENANT_PLAN_FREE                        The plan of a free tenant, for the cost of the summary (summary).
  FREE_TENANT_LIMIT                       The cap of a request; default 25 (request).
`;

type Command = (parts: CommandParts) => Promise<void>;

const ORGANIZATION = /^org_[A-Za-z0-9]{1,64}$/;

function organizationOf(values: { readonly organization?: string }): string {
  const organizationId = values.organization;
  if (organizationId === undefined || !ORGANIZATION.test(organizationId)) throw new FleetUsageError('--organization must name a WorkOS organization ID, such as org_01HX...');
  return organizationId;
}

function batchSizeOf(value: string | undefined): number {
  if (value === undefined) return MAX_BATCH;
  if (!/^[1-9]$/.test(value) || Number(value) > MAX_BATCH) throw new FleetUsageError(`--batch-size must be a whole number from 1 to ${MAX_BATCH}.`);
  return Number(value);
}

function commandOf(argv: readonly string[]): Command {
  const { positionals, values } = parseArgs({
    args: [...argv], allowPositionals: true, strict: true,
    options: { organization: { type: 'string' }, image: { type: 'string' }, all: { type: 'boolean' }, 'batch-size': { type: 'string' }, help: { type: 'boolean', short: 'h' } },
  });
  const [name, ...rest] = positionals;
  if (values.help === true) return async ({ io }) => { io.line(USAGE); };
  if (name === undefined) throw new FleetUsageError(USAGE);
  if (rest.length > 0) throw new FleetUsageError(`Unexpected arguments: ${rest.join(' ')}`);
  const commands: Readonly<Record<string, () => Command>> = {
    list: () => listTenants,
    summary: () => fleetSummary,
    status: () => { const organizationId = organizationOf(values); return (parts) => tenantStatus(parts, organizationId); },
    request: () => { const organizationId = organizationOf(values); return (parts) => requestTenant(parts, organizationId); },
    suspend: () => { const organizationId = organizationOf(values); return (parts) => suspendTenant(parts, organizationId); },
    resume: () => { const organizationId = organizationOf(values); return (parts) => resumeTenant(parts, organizationId); },
    delete: () => { const organizationId = organizationOf(values); return (parts) => deleteTenant(parts, organizationId); },
    upgrade: () => {
      if (values.image === undefined) throw new FleetUsageError('upgrade needs --image <reference@sha256:...>.');
      if ((values.all === true) === (values.organization !== undefined)) throw new FleetUsageError('upgrade needs exactly one of --organization <id> and --all.');
      const target = values.all === true ? 'all' as const : { organizationId: organizationOf(values) };
      const request = { image: values.image, target, batchSize: batchSizeOf(values['batch-size']) };
      return (parts) => upgradeTenants(parts, request);
    },
  };
  const command = commands[name];
  if (command === undefined) throw new FleetUsageError(`Unknown command ${name}.\n\n${USAGE}`);
  return command();
}

async function main(argv: readonly string[]): Promise<number> {
  const controller = new AbortController();
  const stop = (signalName: string) => {
    // A second signal ends the process at once; the first one stops the waits and closes the registry.
    if (controller.signal.aborted) process.exit(1);
    controller.abort(new Error(`Stopped by ${signalName}`));
  };
  process.on('SIGINT', () => stop('SIGINT'));
  process.on('SIGTERM', () => stop('SIGTERM'));
  const context = new FleetContext(process.env);
  try {
    const command = commandOf(argv);
    await command({ context, io: processIo, prefix: namePrefixOf(process.env), signal: controller.signal });
    return 0;
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    if (error instanceof FleetUsageError) return 2;
    if (!(error instanceof FleetStepError) && !controller.signal.aborted) process.stderr.write('The command stopped on an unexpected error.\n');
    return 1;
  } finally {
    await context.close();
  }
}

process.exitCode = await main(process.argv.slice(2));

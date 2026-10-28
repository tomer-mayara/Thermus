// The upgrade command: one or all live tenants of the prefix deploy one image by digest, in batches of at most three
// (answer 5 of 27 October 2026). The deploys of a batch go one after the other, then the batch waits until each deploy
// is live or failed. A deploy that reaches live counts as healthy, and the registry records its digest. The upgrade
// stops at the first batch with a deploy that does not reach live: the later batches do not start, and nothing is
// deployed again. A suspended tenant is left as it is.
import { systemClock } from '../../src/app/system-clock.ts';
import { isImageByDigest } from '../../src/tenancy/providers/render/render-changes.ts';
import type { FleetRow } from '../../src/tenancy/tenants/tenant-fleet-store.ts';
import type { DeployStart } from '../../src/tenancy/tenants/tenant-platform.ts';
import { confirmed } from './fleet-confirm.ts';
import { newDeployOf, newestDeployId } from './fleet-deploys.ts';
import type { CommandParts } from './fleet-reads.ts';
import { counted, existingRow, FleetStepError, rowsOfPrefix, shortDigest } from './fleet-rows.ts';
import { FleetUsageError } from './fleet-settings.ts';

export const MAX_BATCH = 3;

export interface UpgradeRequest {
  readonly image: string;
  readonly target: { readonly organizationId: string } | 'all';
  readonly batchSize: number;
}

type LiveRow = FleetRow & { readonly serviceId: string };
type Upgraded = { readonly row: LiveRow; readonly ok: boolean; readonly text: string };

export async function upgradeTenants(parts: CommandParts, request: UpgradeRequest): Promise<void> {
  if (!isImageByDigest(request.image)) throw new FleetUsageError('--image must be an image reference by digest, such as ghcr.io/owner/name@sha256:<64 hexadecimal digits>.');
  const { live, suspended } = await targetsOf(parts, request);
  const digest = request.image.slice(request.image.lastIndexOf('@') + 1);
  const batches = batchesOf(live, request.batchSize);
  const plan = [
    `Upgrade ${counted(live.length, 'live tenant', 'live tenants')} of the prefix ${parts.prefix} to ${request.image}, in ${counted(batches.length, 'batch', 'batches')} of at most ${request.batchSize}:`,
    ...batches.flatMap((batch, index) => batch.map((row) => `  batch ${index + 1}: ${row.organizationId} ${row.serviceId} ${shortDigest(row.imageDigest)} -> ${shortDigest(digest)}`)),
    ...(suspended.length === 0 ? [] : [`Left as they are: ${counted(suspended.length, 'suspended tenant', 'suspended tenants')} (${suspended.join(', ')}). A resume deploys the image of the service settings.`]),
    'Each deploy also sets the image of its service. The upgrade stops after the first batch with a deploy that does not reach live.',
  ];
  if (live.length === 0) {
    plan.forEach((text) => parts.io.line(text));
    parts.io.line('No live tenant to upgrade: nothing changed.');
    return;
  }
  if (!await confirmed(parts.io, plan)) return;
  await runBatches(parts, batches, request.image, digest);
}

async function targetsOf({ context, prefix }: CommandParts, request: UpgradeRequest): Promise<{ readonly live: readonly LiveRow[]; readonly suspended: readonly string[] }> {
  const { fleet } = await context.stores();
  if (request.target !== 'all') {
    const row = await existingRow(fleet, prefix, request.target.organizationId);
    if (row.state !== 'live' || row.serviceId === null) throw new FleetStepError(`The tenant of ${row.organizationId} is ${row.state}, not live. Only a live tenant is upgraded; resume a suspended tenant first.`);
    return { live: [row as LiveRow], suspended: [] };
  }
  const { rows } = await rowsOfPrefix(fleet, prefix);
  return { live: rows.filter((row): row is LiveRow => row.state === 'live' && row.serviceId !== null), suspended: rows.filter((row) => row.state === 'suspended').map((row) => row.organizationId) };
}

async function runBatches(parts: CommandParts, batches: readonly (readonly LiveRow[])[], image: string, digest: string): Promise<void> {
  let upgraded = 0;
  for (const [index, batch] of batches.entries()) {
    const started: (() => Promise<Upgraded>)[] = [];
    for (const row of batch) started.push(await startDeploy(parts, row, image, digest));
    const results = await Promise.all(started.map((wait) => wait()));
    for (const result of results) parts.io.line(`batch ${index + 1}: ${result.row.organizationId} ${result.row.serviceId}: ${result.text}`);
    upgraded += results.filter((result) => result.ok).length;
    if (!results.every((result) => result.ok)) {
      const left = batches.slice(index + 1).flat().length;
      throw new FleetStepError(`The upgrade stopped after batch ${index + 1}: ${counted(upgraded, 'tenant runs', 'tenants run')} ${shortDigest(digest)}, and ${counted(left, 'tenant', 'tenants')} of later batches did not start.`);
    }
  }
  parts.io.line(`Done: ${counted(upgraded, 'tenant runs', 'tenants run')} ${digest}, and the registry records it.`);
}

// The deploy call of one tenant now, and the wait for its deploy later, so the deploys of a batch run at the same time.
async function startDeploy({ context, signal }: CommandParts, row: LiveRow, image: string, digest: string): Promise<() => Promise<Upgraded>> {
  const platform = await context.platform();
  const previous = await newestDeployId(platform, row.serviceId, signal);
  if ('failure' in previous) return async () => ({ row, ok: false, text: `not deployed: ${previous.failure}` });
  const start = await platform.deployImage(row.serviceId, image, signal);
  if (start.status !== 'started') return async () => ({ row, ok: false, text: `not deployed: ${startFailureOf(start)}` });
  return async () => {
    const deploy = await newDeployOf({ platform, clock: systemClock }, row.serviceId, previous.id, signal);
    if (deploy.status === 'failed') return { row, ok: false, text: `did not reach live: ${deploy.reason}` };
    const runs = deploy.deploy.imageDigest ?? digest;
    if (runs !== digest) return { row, ok: false, text: `${deploy.deploy.id} is live with ${shortDigest(runs)}, not with ${shortDigest(digest)}` };
    const recorded = await (await context.stores()).fleet.recordDigest(row.organizationId, row.serviceId, digest);
    if (recorded.status !== 'recorded') return { row, ok: false, text: `${deploy.deploy.id} is live after ${deploy.seconds} s, but the registry did not record the digest (${recorded.status})` };
    return { row, ok: true, text: `${deploy.deploy.id} live after ${deploy.seconds} s; digest recorded` };
  };
}

function startFailureOf(start: Exclude<DeployStart, { readonly status: 'started' }>): string {
  if (start.status === 'gone') return 'the tenant service no longer exists';
  if (start.status === 'rate-limited') return `Render limits the deploys of the service for ${Math.ceil(start.retryAfterMs / 1_000)} s`;
  return start.status === 'unknown' ? `the deploy call got no clear answer (${start.reason}); a deploy can run, so read the status first` : start.reason;
}

function batchesOf<T>(items: readonly T[], size: number): readonly (readonly T[])[] {
  const batches: T[][] = [];
  for (let index = 0; index < items.length; index += size) batches.push(items.slice(index, index + size));
  return batches;
}

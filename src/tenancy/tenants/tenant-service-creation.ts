import type { SystemLog } from '../../logs/system/system-logger.ts';
import type { ProvisioningClock } from './provisioning-clock.ts';
import type { ServiceCreation, TenantPlatform, TenantServiceRequest } from './tenant-platform.ts';

// The bounds of 27 October 2026: a create is sent one time in each attempt, and only after a search by name has
// found no service; a row has at most three attempts. A rate-limited create waits for the time that Render gives,
// at most one hour, which is the window of the create limit.
const CREATE_ATTEMPTS = 3;
const ATTEMPT_PAUSE_MS = 30_000;
const MAX_LIMIT_WAIT_MS = 3_600_000;

export type ServiceOutcome =
  | { readonly status: 'service'; readonly serviceId: string }
  | { readonly status: 'failed'; readonly reason: string };

type Attempt = ServiceOutcome | { readonly status: 'again'; readonly reason: string; readonly waitMs: number };

export interface CreationParts {
  readonly platform: Pick<TenantPlatform, 'findServices' | 'createService'>;
  readonly clock: ProvisioningClock;
  readonly log: SystemLog;
}

/**
 * The service of a creating row: the one service with its name, else a new one. Two services with the name stop the
 * row, because the provisioner cannot tell which one is the tenant.
 */
export async function serviceForRow(parts: CreationParts, work: { readonly organizationId: string; readonly request: TenantServiceRequest }, signal: AbortSignal): Promise<ServiceOutcome> {
  let reason = '';
  for (let attempt = 1; attempt <= CREATE_ATTEMPTS; attempt += 1) {
    const result = await attemptService(parts.platform, work.request, signal);
    if (result.status !== 'again') return result;
    reason = result.reason;
    if (attempt < CREATE_ATTEMPTS) {
      const retry = { organizationId: work.organizationId, attempt: attempt + 1, waitSeconds: result.waitMs / 1_000, reason };
      parts.log.info(`Tenant provisioning retry: ${JSON.stringify(retry)}`);
      await parts.clock.sleep(result.waitMs, signal);
    }
  }
  return { status: 'failed', reason: `No Render service after ${CREATE_ATTEMPTS} attempts. The last attempt: ${reason}` };
}

async function attemptService(platform: CreationParts['platform'], request: TenantServiceRequest, signal: AbortSignal): Promise<Attempt> {
  const search = await platform.findServices(request.name, signal);
  if (search.status === 'unavailable') return again(`the service list is unavailable (${search.reason})`, ATTEMPT_PAUSE_MS);
  if (search.services.length > 1) return { status: 'failed', reason: `${search.services.length} Render services have the name ${request.name}` };
  const [service] = search.services;
  if (service !== undefined) return { status: 'service', serviceId: service.id };
  return outcomeOf(await platform.createService(request, signal));
}

function outcomeOf(creation: ServiceCreation): Attempt {
  switch (creation.status) {
    case 'created': return { status: 'service', serviceId: creation.service.id };
    case 'refused': return { status: 'failed', reason: `Render refused the create: ${creation.reason}` };
    case 'rate-limited': return again(`Render limits the creates for ${Math.ceil(creation.retryAfterMs / 1_000)} s`, Math.min(creation.retryAfterMs, MAX_LIMIT_WAIT_MS));
    case 'unknown': return again(`the create got no clear answer (${creation.reason})`, ATTEMPT_PAUSE_MS);
  }
}

function again(reason: string, waitMs: number): Attempt {
  return { status: 'again', reason, waitMs };
}

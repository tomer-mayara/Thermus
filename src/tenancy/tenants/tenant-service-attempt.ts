import type { ServiceCreation, TenantPlatform, TenantServiceRequest } from './tenant-platform.ts';

const ATTEMPT_PAUSE_MS = 30_000;
// A rate-limited create waits for the time that the platform gives, at most one hour: the window of the create limit.
const MAX_LIMIT_WAIT_MS = 3_600_000;

export type ServiceOutcome =
  | { readonly status: 'service'; readonly serviceId: string }
  | { readonly status: 'failed'; readonly reason: string };

/** No service yet: the next attempt comes after waitMs and searches by name first. */
export interface AgainAttempt { readonly status: 'again'; readonly reason: string; readonly waitMs: number }

export type Attempt = ServiceOutcome | AgainAttempt;

export type CreationPlatform = Pick<TenantPlatform, 'findServices' | 'createService'>;

/**
 * One attempt: a search by name, then one create only when the search found no service. So a create that got no clear
 * answer never makes a second service, and two services with the name stop the row, because the provisioner cannot
 * tell which one is the tenant.
 */
export async function attemptService(platform: CreationPlatform, request: TenantServiceRequest, signal: AbortSignal): Promise<Attempt> {
  const search = await platform.findServices(request.name, signal);
  if (search.status === 'unavailable') return again(`the service list is unavailable (${search.reason})`, ATTEMPT_PAUSE_MS);
  if (search.services.length > 1) return { status: 'failed', reason: `${search.services.length} services of the platform have the name ${request.name}` };
  const [service] = search.services;
  if (service !== undefined) return { status: 'service', serviceId: service.id };
  return outcomeOf(await platform.createService(request, signal));
}

function outcomeOf(creation: ServiceCreation): Attempt {
  switch (creation.status) {
    case 'created': return { status: 'service', serviceId: creation.service.id };
    case 'refused': return { status: 'failed', reason: `The platform refused the create: ${creation.reason}` };
    case 'rate-limited': return again(`The platform limits the creates for ${Math.ceil(creation.retryAfterMs / 1_000)} s`, Math.min(creation.retryAfterMs, MAX_LIMIT_WAIT_MS));
    case 'unknown': return again(`the create got no clear answer (${creation.reason})`, ATTEMPT_PAUSE_MS);
  }
}

function again(reason: string, waitMs: number): Attempt {
  return { status: 'again', reason, waitMs };
}

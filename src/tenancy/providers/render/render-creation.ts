import type { ServiceCreation, TenantServiceRequest } from '../../tenants/tenant-platform.ts';
import type { RenderAnswer, RenderLimits } from './render-api.ts';
import { answerReason } from './render-exchanges.ts';
import { createdServiceOf } from './render-services.ts';

// The region of the control plane: the private network joins only the services of one workspace and one region.
const REGION = 'oregon';
const DEFAULT_LIMIT_WAIT_MS = 60_000;

export interface ServiceSource {
  readonly ownerId: string;
  readonly registryCredentialId: string;
  readonly image: string;
}

export function createBodyOf(source: ServiceSource, request: TenantServiceRequest): unknown {
  const { ownerId, image, registryCredentialId } = source;
  return {
    type: 'private_service',
    name: request.name,
    ownerId,
    image: { ownerId, imagePath: image, registryCredentialId },
    envVars: [...request.environment].map(([key, value]) => ({ key, value })),
    serviceDetails: { runtime: 'image', plan: request.plan, region: REGION, numInstances: 1 },
  };
}

/** The outcome of one create answer. A 5xx can come after Render made the service, so it is unknown, not refused. */
export function creationOf(answer: RenderAnswer): ServiceCreation {
  if (answer.status === 429) return { status: 'rate-limited', retryAfterMs: limitWaitOf(answer.limits) };
  if (answer.status >= 500) return { status: 'unknown', reason: answerReason(answer) };
  if (answer.status >= 300) return { status: 'refused', reason: answerReason(answer) };
  const service = createdServiceOf(answer.json);
  return service === undefined ? { status: 'unknown', reason: `Render answered ${answer.status} without a valid service` } : { status: 'created', service };
}

/**
 * The create window of the Render user: 20 creates an hour, also for the other callers of the same user. Each create
 * answer gives its state, so the adapter sends no create that Render would refuse.
 */
export class CreateWindow {
  #until = Number.NEGATIVE_INFINITY;

  waitMs(now: number): number {
    return Math.max(0, this.#until - now);
  }

  count(answer: RenderAnswer, now: number): void {
    if (answer.status === 429) this.#until = now + limitWaitOf(answer.limits);
    else if (answer.limits.remaining === 0 && answer.limits.resetSeconds !== undefined) this.#until = now + answer.limits.resetSeconds * 1_000;
  }
}

/** The wait after a 429. Retry-After comes first: it is the answer for this call, and the reset time is the end of the whole window. */
export function limitWaitOf(limits: RenderLimits): number {
  const seconds = limits.retryAfterSeconds ?? limits.resetSeconds;
  return seconds === undefined ? DEFAULT_LIMIT_WAIT_MS : seconds * 1_000;
}

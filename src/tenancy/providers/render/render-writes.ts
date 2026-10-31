import type { DeployStart, ServiceChange, ServiceCreation, ServiceDeletion, TenantServiceRequest } from '../../tenants/tenant-platform.ts';
import type { RenderApi, RenderClock } from './render-api.ts';
import { deployStartOf, isImageByDigest, serviceChangeOf } from './render-changes.ts';
import { CreateWindow, createBodyOf, creationOf, type ServiceSource } from './render-creation.ts';
import { reasonOf, retryable, sendRepeated, successOf } from './render-exchanges.ts';
import { isServiceId } from './render-services.ts';

// The production service of Thermus AI. The guard refuses it by its ID, also when a registry row names it by mistake.
export const PRODUCTION_SERVICE_ID = 'srv-db8mnqg473hc739d529g';

export interface WriteParts {
  readonly api: RenderApi;
  readonly clock: RenderClock;
  readonly source: ServiceSource;
  // The write guard: true when the tenant registry owns the service (answer 4 of 27 October 2026).
  readonly ownsService: (serviceId: string) => Promise<boolean>;
}

/**
 * The writes of the tenant platform on Render. A create, a deploy, a suspend, and a resume are sent one time only,
 * because a repeat can double the effect; the caller reads the state before another one. The delete follows the retry
 * rule of the reads. Each write for a service that the tenant registry does not own is refused, and always each write
 * for the production service, before any call.
 */
export class RenderWrites {
  private readonly parts: WriteParts;
  private readonly window = new CreateWindow();

  constructor(parts: WriteParts) {
    this.parts = parts;
  }

  /** One create call, unless the create window of the Render user is used up. */
  async createService(request: TenantServiceRequest, signal: AbortSignal): Promise<ServiceCreation> {
    const { api, clock, source } = this.parts;
    const waitMs = this.window.waitMs(clock.now());
    if (waitMs > 0) return { status: 'rate-limited', retryAfterMs: waitMs };
    const exchange = await api.send({ method: 'POST', path: '/services', body: createBodyOf(source, request) }, signal);
    if (exchange.answer === undefined) return { status: 'unknown', reason: exchange.failure };
    this.window.count(exchange.answer, clock.now());
    return creationOf(exchange.answer);
  }

  /** Deletes a service that the registry owns. A service that is already gone counts as deleted. */
  async deleteService(serviceId: string, signal: AbortSignal): Promise<ServiceDeletion> {
    const refusal = await this.refusalOf(serviceId);
    if (refusal !== undefined) return { status: 'refused', reason: refusal };
    const exchange = await sendRepeated(this.parts, { method: 'DELETE', path: `/services/${serviceId}` }, signal);
    if (successOf(exchange) !== undefined || exchange.answer?.status === 404) return { status: 'deleted' };
    return { status: retryable(exchange) ? 'unavailable' : 'refused', reason: reasonOf(exchange) };
  }

  /** One deploy of an image by digest; the API deploy with imageUrl also sets the image of the service (SO-01c). */
  async deployImage(serviceId: string, image: string, signal: AbortSignal): Promise<DeployStart> {
    if (!isImageByDigest(image)) return { status: 'refused', reason: 'The Render adapter deploys only an image reference by digest.' };
    const refusal = await this.refusalOf(serviceId);
    if (refusal !== undefined) return { status: 'refused', reason: refusal };
    return deployStartOf(await this.parts.api.send({ method: 'POST', path: `/services/${serviceId}/deploys`, body: { imageUrl: image } }, signal));
  }

  suspendService(serviceId: string, signal: AbortSignal): Promise<ServiceChange> {
    return this.change(serviceId, 'suspend', signal);
  }

  resumeService(serviceId: string, signal: AbortSignal): Promise<ServiceChange> {
    return this.change(serviceId, 'resume', signal);
  }

  private async change(serviceId: string, action: 'suspend' | 'resume', signal: AbortSignal): Promise<ServiceChange> {
    const refusal = await this.refusalOf(serviceId);
    if (refusal !== undefined) return { status: 'refused', reason: refusal };
    return serviceChangeOf(await this.parts.api.send({ method: 'POST', path: `/services/${serviceId}/${action}` }, signal));
  }

  // The two checks without a registry read come first, so they hold also when the registry is unavailable.
  private async refusalOf(serviceId: string): Promise<string | undefined> {
    if (serviceId === PRODUCTION_SERVICE_ID) return `The Render adapter never changes the production service ${PRODUCTION_SERVICE_ID}.`;
    if (!isServiceId(serviceId)) return 'The Render adapter changes only a service with a Render service ID.';
    if (!await this.parts.ownsService(serviceId)) return `The tenant registry does not own the Render service ${serviceId}.`;
    return undefined;
  }
}

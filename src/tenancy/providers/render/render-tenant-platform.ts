import type {
  AddressRead, DeployRead, ServiceCreation, ServiceDeletion, ServiceSearch, TenantPlatform, TenantServiceRequest,
} from '../../tenants/tenant-platform.ts';
import { RenderApi, type RenderAnswer, type RenderCall, type RenderClock, type RenderExchange, type RenderLimits } from './render-api.ts';
import { answerReason, createdServiceOf, internalUrlOf, isServiceId, newestDeployOf, reasonOf, servicesOf } from './render-answers.ts';

export const PRODUCTION_SERVICE_ID = 'srv-db8mnqg473hc739d529g';
// The region of the control plane: the private network joins only the services of one workspace and one region.
const REGION = 'oregon';
// The bounds of 27 October 2026: a read or the delete has up to 3 attempts after a 429, a 5xx, or no answer. A
// read waits 5 s after a failure, and the Retry-After time, at most 60 s, after a 429.
const ATTEMPTS = 3;
const RETRY_PAUSE_MS = 5_000;
const MAX_READ_WAIT_MS = 60_000;
const DEFAULT_LIMIT_WAIT_MS = 60_000;

export interface RenderTenantPlatformOptions {
  readonly apiKey: string;
  readonly ownerId: string;
  readonly registryCredentialId: string;
  // The image of each new tenant, by digest.
  readonly image: string;
  // The write guard: true when the tenant registry owns the service (answer 4 of 27 October 2026).
  readonly ownsService: (serviceId: string) => Promise<boolean>;
  readonly clock: RenderClock;
  readonly fetch?: typeof fetch;
}

type Settings = Omit<RenderTenantPlatformOptions, 'apiKey' | 'fetch'>;

/**
 * The tenant platform on Render. A create or a deploy is sent one time only, because a repeat can double its effect;
 * the caller searches by name before another create. The adapter counts the create limit from the rate-limit headers.
 * It refuses each write for a service that the tenant registry does not own, and always for the production service.
 */
export class RenderTenantPlatform implements TenantPlatform {
  readonly #api: RenderApi;
  readonly #settings: Settings;
  // No create is sent before this time of the clock: the create window is used up.
  #createsUntil = Number.NEGATIVE_INFINITY;

  constructor(options: RenderTenantPlatformOptions) {
    const { apiKey, fetch: fetchFunction = globalThis.fetch, ...settings } = options;
    this.#api = new RenderApi(apiKey, fetchFunction);
    this.#settings = settings;
  }

  async findServices(name: string, signal: AbortSignal): Promise<ServiceSearch> {
    const query = new URLSearchParams({ ownerId: this.#settings.ownerId, name, type: 'private_service', limit: '100' });
    const exchange = await this.read(`/services?${query}`, signal);
    const answer = successOf(exchange);
    if (answer === undefined) return { status: 'unavailable', reason: reasonOf(exchange) };
    const services = servicesOf(answer.json);
    if (services === undefined) return { status: 'unavailable', reason: 'Render answered an invalid service list' };
    return { status: 'found', services: services.filter((service) => service.name === name) };
  }

  async createService(request: TenantServiceRequest, signal: AbortSignal): Promise<ServiceCreation> {
    const waitMs = this.#createsUntil - this.#settings.clock.now();
    if (waitMs > 0) return { status: 'rate-limited', retryAfterMs: waitMs };
    const exchange = await this.#api.send({ method: 'POST', path: '/services', body: this.createBody(request) }, signal);
    if (exchange.answer === undefined) return { status: 'unknown', reason: exchange.failure };
    this.countCreate(exchange.answer);
    return creationOf(exchange.answer);
  }

  async newestDeploy(serviceId: string, signal: AbortSignal): Promise<DeployRead> {
    if (!isServiceId(serviceId)) return { status: 'gone' };
    const exchange = await this.read(`/services/${serviceId}/deploys?limit=20`, signal);
    if (exchange.answer?.status === 404) return { status: 'gone' };
    const answer = successOf(exchange);
    if (answer === undefined) return { status: 'unavailable', reason: reasonOf(exchange) };
    const deploy = newestDeployOf(answer.json);
    if (deploy === undefined) return { status: 'unavailable', reason: 'Render answered an invalid deploy list' };
    return deploy === null ? { status: 'none' } : { status: 'found', deploy };
  }

  async internalAddress(serviceId: string, signal: AbortSignal): Promise<AddressRead> {
    if (!isServiceId(serviceId)) return { status: 'unavailable', reason: 'not a Render service ID' };
    const exchange = await this.read(`/services/${serviceId}`, signal);
    const answer = successOf(exchange);
    if (answer === undefined) return { status: 'unavailable', reason: reasonOf(exchange) };
    const internalUrl = internalUrlOf(answer.json);
    return internalUrl === undefined ? { status: 'pending' } : { status: 'found', internalUrl };
  }

  async deleteService(serviceId: string, signal: AbortSignal): Promise<ServiceDeletion> {
    const refusal = await this.writeRefusal(serviceId);
    if (refusal !== undefined) return { status: 'refused', reason: refusal };
    const exchange = await this.repeated({ method: 'DELETE', path: `/services/${serviceId}` }, signal);
    if (successOf(exchange) !== undefined || exchange.answer?.status === 404) return { status: 'deleted' };
    return { status: retryable(exchange) ? 'unavailable' : 'refused', reason: reasonOf(exchange) };
  }

  private async writeRefusal(serviceId: string): Promise<string | undefined> {
    if (serviceId === PRODUCTION_SERVICE_ID) return `The Render adapter never changes the production service ${PRODUCTION_SERVICE_ID}.`;
    if (!isServiceId(serviceId)) return 'The Render adapter changes only a service with a Render service ID.';
    if (!await this.#settings.ownsService(serviceId)) return `The tenant registry does not own the Render service ${serviceId}.`;
    return undefined;
  }

  private createBody(request: TenantServiceRequest): unknown {
    const { ownerId, image, registryCredentialId } = this.#settings;
    return {
      type: 'private_service',
      name: request.name,
      ownerId,
      image: { ownerId, imagePath: image, registryCredentialId },
      envVars: [...request.environment].map(([key, value]) => ({ key, value })),
      serviceDetails: { runtime: 'image', plan: request.plan, region: REGION, numInstances: 1 },
    };
  }

  // Each create answer gives the state of the create window, also a create of another caller of the same user.
  private countCreate(answer: RenderAnswer): void {
    const now = this.#settings.clock.now();
    if (answer.status === 429) this.#createsUntil = now + limitWaitOf(answer.limits);
    else if (answer.limits.remaining === 0 && answer.limits.resetSeconds !== undefined) this.#createsUntil = now + answer.limits.resetSeconds * 1_000;
  }

  private read(path: string, signal: AbortSignal): Promise<RenderExchange> {
    return this.repeated({ method: 'GET', path }, signal);
  }

  private async repeated(call: RenderCall, signal: AbortSignal): Promise<RenderExchange> {
    let exchange = await this.#api.send(call, signal);
    for (let attempt = 2; attempt <= ATTEMPTS && retryable(exchange); attempt += 1) {
      await this.#settings.clock.sleep(retryPauseOf(exchange), signal);
      exchange = await this.#api.send(call, signal);
    }
    return exchange;
  }
}

function successOf(exchange: RenderExchange): RenderAnswer | undefined {
  const { answer } = exchange;
  return answer !== undefined && answer.status >= 200 && answer.status < 300 ? answer : undefined;
}

function retryable(exchange: RenderExchange): boolean {
  return exchange.answer === undefined || exchange.answer.status === 429 || exchange.answer.status >= 500;
}

function retryPauseOf(exchange: RenderExchange): number {
  if (exchange.answer?.status !== 429) return RETRY_PAUSE_MS;
  const { retryAfterSeconds, resetSeconds } = exchange.answer.limits;
  const seconds = retryAfterSeconds ?? resetSeconds;
  return seconds === undefined ? RETRY_PAUSE_MS : Math.min(seconds * 1_000, MAX_READ_WAIT_MS);
}

function limitWaitOf(limits: RenderLimits): number {
  const seconds = limits.retryAfterSeconds ?? limits.resetSeconds;
  return seconds === undefined ? DEFAULT_LIMIT_WAIT_MS : seconds * 1_000;
}

function creationOf(answer: RenderAnswer): ServiceCreation {
  if (answer.status === 429) return { status: 'rate-limited', retryAfterMs: limitWaitOf(answer.limits) };
  if (answer.status >= 500) return { status: 'unknown', reason: answerReason(answer) };
  if (answer.status >= 300) return { status: 'refused', reason: answerReason(answer) };
  const service = createdServiceOf(answer);
  return service === undefined ? { status: 'unknown', reason: `Render answered ${answer.status} without a valid service` } : { status: 'created', service };
}

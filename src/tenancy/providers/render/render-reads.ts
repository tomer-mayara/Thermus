import type { AddressRead, DeployRead, ServiceSearch } from '../../tenants/tenant-platform.ts';
import type { RenderApi, RenderClock, RenderExchange } from './render-api.ts';
import { newestDeployOf } from './render-deploys.ts';
import { reasonOf, sendRepeated, successOf } from './render-exchanges.ts';
import { internalUrlOf, isServiceId, servicesOf } from './render-services.ts';

interface ReadParts {
  readonly api: RenderApi;
  readonly clock: RenderClock;
  readonly ownerId: string;
}

/**
 * The reads of the tenant platform on Render. Each read follows the retry rule of answer 3 of 27 October 2026, so a
 * 429, a 5xx, or a lost answer costs at most three calls; an answer that the reader cannot use is unavailable.
 */
export class RenderReads {
  private readonly parts: ReadParts;

  constructor(parts: ReadParts) {
    this.parts = parts;
  }

  /** The private services of the workspace with exactly this name. The filter of Render is not documented as exact. */
  async findServices(name: string, signal: AbortSignal): Promise<ServiceSearch> {
    // 100 is the largest page of Render. The provisioner needs to tell 0, 1, or more services with the name.
    const query = new URLSearchParams({ ownerId: this.parts.ownerId, name, type: 'private_service', limit: '100' });
    const exchange = await this.read(`/services?${query}`, signal);
    const answer = successOf(exchange);
    if (answer === undefined) return { status: 'unavailable', reason: reasonOf(exchange) };
    const services = servicesOf(answer.json);
    if (services === undefined) return { status: 'unavailable', reason: 'Render answered an invalid service list' };
    return { status: 'found', services: services.filter((service) => service.name === name) };
  }

  /** The newest deploy of a service: also the deploy that Render starts after a resume. A 404 means gone. */
  async newestDeploy(serviceId: string, signal: AbortSignal): Promise<DeployRead> {
    // An ID without the form of a Render service ID names no service, so the row has lost its service.
    if (!isServiceId(serviceId)) return { status: 'gone' };
    // A new tenant has one deploy and a resumed one a few, so the first 20 hold the newest deploy in each order.
    const exchange = await this.read(`/services/${serviceId}/deploys?limit=20`, signal);
    if (exchange.answer?.status === 404) return { status: 'gone' };
    const answer = successOf(exchange);
    if (answer === undefined) return { status: 'unavailable', reason: reasonOf(exchange) };
    const deploy = newestDeployOf(answer.json);
    if (deploy === undefined) return { status: 'unavailable', reason: 'Render answered an invalid deploy list' };
    return deploy === null ? { status: 'none' } : { status: 'found', deploy };
  }

  /** The address of the service on the private network, pending until Render gives its host and its open port. */
  async internalAddress(serviceId: string, signal: AbortSignal): Promise<AddressRead> {
    if (!isServiceId(serviceId)) return { status: 'unavailable', reason: 'not a Render service ID' };
    const exchange = await this.read(`/services/${serviceId}`, signal);
    const answer = successOf(exchange);
    if (answer === undefined) return { status: 'unavailable', reason: reasonOf(exchange) };
    const internalUrl = internalUrlOf(answer.json);
    return internalUrl === undefined ? { status: 'pending' } : { status: 'found', internalUrl };
  }

  private read(path: string, signal: AbortSignal): Promise<RenderExchange> {
    return sendRepeated(this.parts, { method: 'GET', path }, signal);
  }
}

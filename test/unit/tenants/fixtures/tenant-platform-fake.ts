import type {
  AddressRead, DeployRead, PlatformService, ServiceCreation, ServiceDeletion, ServiceSearch, TenantPlatform, TenantServiceRequest,
} from '../../../../src/tenancy/tenants/tenant-platform.ts';

// A fake (Meszaros) of the tenant platform with the services that it made. Each queue holds the next answers of one
// operation; an empty queue gives the normal answer: the services of the name, a new service, a live deploy, and
// http://<name>:8080. calls records each operation in order, and requests the create requests.
export class TenantPlatformFake implements TenantPlatform {
  readonly calls: string[] = [];
  readonly requests: TenantServiceRequest[] = [];
  readonly services: PlatformService[] = [];
  readonly searches: ServiceSearch[] = [];
  readonly creations: ServiceCreation[] = [];
  readonly deploys: DeployRead[] = [];
  readonly addresses: AddressRead[] = [];
  /** Runs at the start of each operation, so a test can stop the caller or change the registry at that point. */
  onCall: (call: string) => void = () => {};
  #sequence = 0;

  async findServices(name: string, signal: AbortSignal): Promise<ServiceSearch> {
    this.call(`find ${name}`, signal);
    return this.searches.shift() ?? { status: 'found', services: this.services.filter((service) => service.name === name) };
  }

  async createService(request: TenantServiceRequest, signal: AbortSignal): Promise<ServiceCreation> {
    this.call(`create ${request.name}`, signal);
    this.requests.push(request);
    const creation = this.creations.shift() ?? { status: 'created', service: { id: this.nextServiceId(), name: request.name } };
    if (creation.status === 'created') this.services.push(creation.service);
    return creation;
  }

  async newestDeploy(serviceId: string, signal: AbortSignal): Promise<DeployRead> {
    this.call(`deploy ${serviceId}`, signal);
    return this.deploys.shift() ?? { status: 'found', deploy: { id: 'dep-live', progress: 'live', status: 'live', imageDigest: `sha256:${'d'.repeat(64)}` } };
  }

  async internalAddress(serviceId: string, signal: AbortSignal): Promise<AddressRead> {
    this.call(`address ${serviceId}`, signal);
    return this.addresses.shift() ?? { status: 'found', internalUrl: `http://slug-of-${serviceId}:8080` };
  }

  async deleteService(serviceId: string, signal: AbortSignal): Promise<ServiceDeletion> {
    this.call(`delete ${serviceId}`, signal);
    return { status: 'deleted' };
  }

  private call(call: string, signal: AbortSignal): void {
    this.calls.push(call);
    this.onCall(call);
    signal.throwIfAborted();
  }

  private nextServiceId(): string {
    this.#sequence += 1;
    return `srv-new${this.#sequence}`;
  }
}

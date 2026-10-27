// A fake (Meszaros) of the Render API v1 for the calls of the tenant platform: list the services of a name, create an
// image-backed private service, read a service and its deploys, and delete a service. It keeps services and deploys
// in memory, with the answer shapes and rate-limit headers that record SO-01c measured. A new deploy shows
// update_in_progress for deployReads reads of the deploy list and then ends with deployOutcome. The fake makes the
// slug as the SO-06 live runs measured: Render keeps the name up to its first underscore. So a name with an underscore
// gets a slug that differs from it, and a test can see that the adapter reads the slug and does not compute it.
// Saboteur entries (failNext) replace the next answer of a route with a status, a network failure before Render sees
// the request, or a lost answer after Render did the work.

export type RenderRoute = 'list services' | 'create service' | 'read service' | 'list deploys' | 'delete service';

export type RenderFault =
  | { readonly status: number; readonly headers?: Readonly<Record<string, string>>; readonly body?: unknown }
  | 'network'
  | 'lost';

export interface RenderRequest {
  readonly route: RenderRoute | 'unknown';
  readonly method: string;
  readonly path: string;
  readonly query: URLSearchParams;
  readonly body: unknown;
  readonly authorized: boolean;
  /** The time of the clock of the test when the request arrived. */
  readonly at: number;
}

export interface FakeDeploy {
  readonly id: string;
  status: string;
  readonly trigger: string;
  readonly imageRef: string;
  readonly createdAt: string;
  readsLeft: number;
  readonly outcome: string;
}

export interface FakeService {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly ownerId: string;
  readonly imagePath: string;
  readonly registryCredentialId?: string;
  readonly plan: string;
  readonly region: string;
  readonly envVars: ReadonlyMap<string, string>;
  readonly deploys: FakeDeploy[];
  openPorts: number[];
}

interface Account {
  readonly apiKey: string;
  readonly ownerId: string;
  readonly now?: () => number;
}

type ServiceInput = Omit<FakeService, 'id' | 'slug' | 'ownerId' | 'deploys' | 'openPorts'>;
type Answer = { readonly status: number; readonly body?: unknown; readonly headers?: Readonly<Record<string, string>> };

const SERVER_PORT = 8080;
const ENDED = new Set(['live', 'build_failed', 'update_failed', 'canceled', 'pre_deploy_failed', 'deactivated']);
const readLimits = { 'Ratelimit-Limit': '400', 'Ratelimit-Remaining': '399', 'Ratelimit-Reset': '30' };
const deleteLimits = { 'Ratelimit-Limit': '100', 'Ratelimit-Remaining': '99', 'Ratelimit-Reset': '22' };
const notFound: Answer = { status: 404, body: { message: 'Not Found' } };

export class RenderFake {
  readonly requests: RenderRequest[] = [];
  /** The reads of the deploy list that show a new deploy in progress before it ends. */
  deployReads = 2;
  /** The end of each new deploy: live, or a failed status such as update_failed. */
  deployOutcome = 'live';
  /** Ratelimit-Remaining of the next create answer. */
  createsRemaining = 19;
  /** Runs before Render handles a create call, so a test can observe the system at that moment. */
  beforeCreate: (request: RenderRequest) => void | Promise<void> = () => {};
  readonly fetch: typeof fetch = (input, init) => this.answer(input, init);
  readonly #account: Account;
  readonly #services = new Map<string, FakeService>();
  readonly #faults: { readonly route: RenderRoute; readonly fault: RenderFault }[] = [];
  #sequence = 0;
  #time = Date.parse('2026-10-27T12:00:00Z');

  constructor(account: Account) {
    this.#account = account;
  }

  services(): FakeService[] {
    return [...this.#services.values()];
  }

  service(name: string): FakeService | undefined {
    return this.services().find((service) => service.name === name);
  }

  requestsOf(route: RenderRoute): RenderRequest[] {
    return this.requests.filter((request) => request.route === route);
  }

  /** A service that Render already has, such as one of an earlier run, with a first deploy that ends as outcome. */
  addService(name: string, deploy: { readonly outcome: string; readonly readsLeft: number } = { outcome: 'live', readsLeft: 0 }): FakeService {
    const service = this.makeService({ name, imagePath: `ghcr.io/tomer-mayara/thermus-hosted@sha256:${'e'.repeat(64)}`, plan: '0.5c-512mb', region: 'oregon', envVars: new Map() });
    this.addDeploy(service.id, { trigger: 'manual', ...deploy });
    return service;
  }

  /** A new deploy of a service, such as the deploy that Render starts after a resume. */
  addDeploy(serviceId: string, deploy: { readonly trigger: string; readonly outcome: string; readonly readsLeft: number }): FakeDeploy {
    const service = this.#services.get(serviceId);
    if (service === undefined) throw new Error(`The fake has no service ${serviceId}`);
    const added: FakeDeploy = {
      id: this.nextId('dep'), status: deploy.readsLeft === 0 ? deploy.outcome : 'created', trigger: deploy.trigger,
      imageRef: service.imagePath, createdAt: this.nextTime(), readsLeft: deploy.readsLeft, outcome: deploy.outcome,
    };
    service.deploys.unshift(added);
    if (added.status === 'live') this.goLive(service, added);
    return added;
  }

  failNext(route: RenderRoute, fault: RenderFault): void {
    this.#faults.push({ route, fault });
  }

  private async answer(input: Parameters<typeof fetch>[0], init: RequestInit = {}): Promise<Response> {
    init.signal?.throwIfAborted();
    const request = this.recorded(new URL(input instanceof Request ? input.url : input), init);
    const fault = request.route === 'unknown' ? undefined : this.takeFault(request.route);
    if (fault === 'network') throw new TypeError('fetch failed');
    if (fault !== undefined && fault !== 'lost') return responseOf(fault);
    const answer = await this.handled(request);
    if (fault === 'lost') throw new TypeError('fetch failed');
    return responseOf(answer);
  }

  private async handled(request: RenderRequest): Promise<Answer> {
    if (!request.authorized) return { status: 401, body: { message: 'Unauthorized' } };
    if (request.route === 'create service') await this.beforeCreate(request);
    return this.handle(request);
  }

  private recorded(url: URL, init: RequestInit): RenderRequest {
    const method = init.method ?? 'GET';
    const request: RenderRequest = {
      route: routeOf(method, url.pathname), method, path: url.pathname.replace(/^\/v1/, ''), query: url.searchParams,
      body: typeof init.body === 'string' ? JSON.parse(init.body) as unknown : undefined,
      authorized: new Headers(init.headers).get('Authorization') === `Bearer ${this.#account.apiKey}`,
      at: this.#account.now?.() ?? 0,
    };
    this.requests.push(request);
    return request;
  }

  private takeFault(route: RenderRoute): RenderFault | undefined {
    const index = this.#faults.findIndex((entry) => entry.route === route);
    return index === -1 ? undefined : this.#faults.splice(index, 1)[0]?.fault;
  }

  private handle(request: RenderRequest): Answer {
    const id = /^\/services\/([^/]+)/.exec(request.path)?.[1] ?? '';
    switch (request.route) {
      case 'list services': return this.listServices(request.query);
      case 'create service': return this.createService(request.body);
      case 'read service': return this.readService(id);
      case 'list deploys': return this.listDeploys(id, request.query);
      case 'delete service': return this.deleteService(id);
      default: return notFound;
    }
  }

  private listServices(query: URLSearchParams): Answer {
    const names = query.getAll('name');
    const types = query.getAll('type');
    const listed = this.services().filter((service) => (query.get('ownerId') ?? service.ownerId) === service.ownerId
      && (names.length === 0 || names.includes(service.name)) && (types.length === 0 || types.includes('private_service')));
    const limit = Number(query.get('limit') ?? '20');
    const items = listed.slice(0, limit).map((service) => ({ service: this.serviceJson(service), cursor: `cursor-${service.id}` }));
    return { status: 200, body: items, headers: readLimits };
  }

  private createService(body: unknown): Answer {
    const limits = { 'Ratelimit-Limit': '20', 'Ratelimit-Remaining': String(this.createsRemaining), 'Ratelimit-Reset': '1588' };
    const input = createInputOf(body, this.#account.ownerId);
    if (typeof input === 'string') return { status: 400, body: { message: input }, headers: limits };
    this.createsRemaining = Math.max(0, this.createsRemaining - 1);
    const service = this.makeService(input);
    const deploy = this.addDeploy(service.id, { trigger: 'manual', outcome: this.deployOutcome, readsLeft: this.deployReads });
    return { status: 201, body: { service: this.serviceJson(service), deployId: deploy.id }, headers: limits };
  }

  private readService(id: string): Answer {
    const service = this.#services.get(id);
    return service === undefined ? notFound : { status: 200, body: this.serviceJson(service), headers: readLimits };
  }

  private listDeploys(id: string, query: URLSearchParams): Answer {
    const service = this.#services.get(id);
    if (service === undefined) return notFound;
    this.advance(service);
    const limit = Number(query.get('limit') ?? '20');
    const items = service.deploys.slice(0, limit).map((deploy) => ({ deploy: deployJson(deploy), cursor: `cursor-${deploy.id}` }));
    return { status: 200, body: items, headers: readLimits };
  }

  private deleteService(id: string): Answer {
    if (!this.#services.delete(id)) return { ...notFound, headers: deleteLimits };
    return { status: 204, headers: deleteLimits };
  }

  // One read of the deploy list moves the newest deploy that has not ended one step on.
  private advance(service: FakeService): void {
    const deploy = service.deploys.find((item) => !ENDED.has(item.status));
    if (deploy === undefined) return;
    if (deploy.readsLeft > 0) {
      deploy.readsLeft -= 1;
      deploy.status = 'update_in_progress';
      return;
    }
    deploy.status = deploy.outcome;
    if (deploy.status === 'live') this.goLive(service, deploy);
  }

  private goLive(service: FakeService, live: FakeDeploy): void {
    for (const deploy of service.deploys) if (deploy !== live && deploy.status === 'live') deploy.status = 'deactivated';
    service.openPorts = [SERVER_PORT];
  }

  private makeService(input: ServiceInput): FakeService {
    const service: FakeService = { ...input, id: this.nextId('srv'), slug: this.slugOf(input.name), ownerId: this.#account.ownerId, deploys: [], openPorts: [] };
    this.#services.set(service.id, service);
    return service;
  }

  // The measured rule: the name up to its first underscore. The suffix for a slug that another service has is the rule
  // of this fake only; the answer of Render in that case is not measured.
  private slugOf(name: string): string {
    const [slug = name] = name.toLowerCase().split('_', 1);
    return this.services().some((service) => service.slug === slug) ? `${slug}-${this.#sequence.toString(36)}x` : slug;
  }

  private serviceJson(service: FakeService): unknown {
    const credential = service.registryCredentialId === undefined ? {} : { registryCredential: { id: service.registryCredentialId, name: 'ghcr-thermus-hosted-read' } };
    return {
      id: service.id, name: service.name, slug: service.slug, ownerId: service.ownerId, type: 'private_service',
      imagePath: service.imagePath, suspended: 'not_suspended', suspenders: [], ...credential,
      serviceDetails: {
        runtime: 'image', plan: service.plan, region: service.region, numInstances: 1, url: `${service.slug}:10000`,
        openPorts: service.openPorts.map((port) => ({ port, protocol: 'TCP' })),
      },
    };
  }

  private nextId(prefix: 'srv' | 'dep'): string {
    this.#sequence += 1;
    return `${prefix}-fake${this.#sequence.toString().padStart(16, '0')}`;
  }

  private nextTime(): string {
    this.#time += 1_000;
    return new Date(this.#time).toISOString();
  }
}

function routeOf(method: string, path: string): RenderRoute | 'unknown' {
  if (path === '/v1/services') return method === 'GET' ? 'list services' : method === 'POST' ? 'create service' : 'unknown';
  if (/^\/v1\/services\/[^/]+$/.test(path)) return method === 'GET' ? 'read service' : method === 'DELETE' ? 'delete service' : 'unknown';
  if (/^\/v1\/services\/[^/]+\/deploys$/.test(path) && method === 'GET') return 'list deploys';
  return 'unknown';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function recordOf(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function isText(value: unknown): value is string {
  return typeof value === 'string' && value !== '';
}

interface CreateParts {
  readonly service: Record<string, unknown>;
  readonly image: Record<string, unknown>;
  readonly details: Record<string, unknown>;
}

// The checks of Render on a create body, as far as the tenant platform uses them. The first text names the refused part.
const createChecks: readonly (readonly [string, (parts: CreateParts, ownerId: string) => boolean])[] = [
  ['invalid service', ({ service }, ownerId) => service.type === 'private_service' && service.ownerId === ownerId && isText(service.name)],
  ['invalid image', ({ image }, ownerId) => image.ownerId === ownerId && isText(image.imagePath)],
  ['invalid serviceDetails', ({ details }) => details.runtime === 'image' && isText(details.plan) && isText(details.region)],
];

function createInputOf(body: unknown, ownerId: string): ServiceInput | string {
  const service = recordOf(body);
  const parts: CreateParts = { service, image: recordOf(service.image), details: recordOf(service.serviceDetails) };
  const refusal = createChecks.find(([, valid]) => !valid(parts, ownerId))?.[0];
  if (refusal !== undefined) return refusal;
  const envVars = variablesOf(service.envVars);
  return envVars === undefined ? 'invalid envVars' : serviceInputOf(parts, envVars);
}

function serviceInputOf({ service, image, details }: CreateParts, envVars: ReadonlyMap<string, string>): ServiceInput {
  const credential = typeof image.registryCredentialId === 'string' ? { registryCredentialId: image.registryCredentialId } : {};
  return { name: String(service.name), imagePath: String(image.imagePath), plan: String(details.plan), region: String(details.region), ...credential, envVars };
}

function variablesOf(value: unknown): Map<string, string> | undefined {
  const items: unknown[] = Array.isArray(value) ? value : [];
  const pairs = items.map(recordOf);
  if (!pairs.every((pair) => typeof pair.key === 'string' && typeof pair.value === 'string')) return undefined;
  return new Map(pairs.map((pair) => [String(pair.key), String(pair.value)]));
}

function deployJson(deploy: FakeDeploy): unknown {
  const digest = /@(sha256:[0-9a-f]{64})$/.exec(deploy.imageRef)?.[1];
  return {
    id: deploy.id, status: deploy.status, trigger: deploy.trigger, createdAt: deploy.createdAt, updatedAt: deploy.createdAt,
    image: { ref: deploy.imageRef, ...(digest === undefined ? {} : { sha: digest }) },
  };
}

function responseOf(answer: Answer): Response {
  const headers = new Headers(answer.headers);
  if (answer.body === undefined) return new Response(null, { status: answer.status, headers });
  headers.set('Content-Type', 'application/json');
  return new Response(JSON.stringify(answer.body), { status: answer.status, headers });
}

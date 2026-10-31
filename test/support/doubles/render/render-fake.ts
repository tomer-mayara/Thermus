// A fake (Meszaros) of the Render API v1 for the calls of the tenant platform: list the services of a name, create an
// image-backed private service, read a service and its deploys, delete, suspend, and resume a service, and read the
// memory metrics and the events of the sweeps. It keeps services, deploys, memory points, and events in memory, with
// the answer shapes and rate-limit headers that records SO-01c and SO-01e measured. A new deploy shows
// update_in_progress for deployReads reads of the deploy list and then ends with deployOutcome. A suspended service
// keeps its last deploy live, and a resume adds a deploy with the trigger service_resumed resumeDeployDelayMs after the
// resume call, by the clock of the test, as records SO-01c and SO-09 measured: until then, the newest deploy is the one
// from before the suspend. The fake makes the slug as the SO-06 live runs measured: Render keeps a short name whole,
// shortens a long name at the last separator before a limit, and gives a second service with the same shortened start
// a unique suffix. So a long name gets a slug that differs from it, and a test can see that the adapter reads the slug
// and does not compute it. Saboteur entries (failNext) replace the next answer of a route with a status, a network
// failure before Render sees the request, or a lost answer after Render did the work; hold keeps the answers of a route
// until the test releases them.

export type RenderRoute = 'list services' | 'create service' | 'read service' | 'list deploys' | 'delete service' | 'suspend service' | 'resume service' | 'memory metrics' | 'memory limit metrics' | 'list events';

// A limit between the longest whole slug that the live runs saw (33 characters) and the shortest shortened name (42).
const SLUG_LIMIT = 40;

function shortSlugOf(name: string): string {
  if (name.length <= SLUG_LIMIT) return name;
  const cut = name.slice(0, SLUG_LIMIT + 1);
  const separator = Math.max(cut.lastIndexOf('-'), cut.lastIndexOf('_'));
  return separator > 0 ? name.slice(0, separator) : name.slice(0, SLUG_LIMIT);
}

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
  /** The port that the server of the service opens. */
  readonly port: number;
  /** True after a suspend call, until a resume call. */
  suspended: boolean;
  /** The time of the clock of the test at the last resume call, until Render adds the deploy of that resume. */
  resumedAt?: number;
  readonly ownerId: string;
  readonly imagePath: string;
  readonly registryCredentialId?: string;
  readonly plan: string;
  readonly region: string;
  readonly envVars: ReadonlyMap<string, string>;
  readonly deploys: FakeDeploy[];
  openPorts: number[];
  /** The memory points of the service, in bytes, and the memory limit of its plan. */
  readonly memory: { readonly at: string; readonly bytes: number }[];
  memoryLimitBytes?: number;
  /** The events of the service, such as server_failed or deploy_started. */
  readonly events: { readonly type: string; readonly at: string }[];
}

interface Account {
  readonly apiKey: string;
  readonly ownerId: string;
  readonly now?: () => number;
}

type ServiceInput = Omit<FakeService, 'id' | 'slug' | 'port' | 'suspended' | 'resumedAt' | 'ownerId' | 'deploys' | 'openPorts' | 'memory' | 'memoryLimitBytes' | 'events'>;
type ServiceAddress = { readonly host: string; readonly port: number };
type Answer = { readonly status: number; readonly body?: unknown; readonly headers?: Readonly<Record<string, string>> };

const SERVER_PORT = 8080;
const ENDED = new Set(['live', 'build_failed', 'update_failed', 'canceled', 'pre_deploy_failed', 'deactivated']);
const readLimits = { 'Ratelimit-Limit': '400', 'Ratelimit-Remaining': '399', 'Ratelimit-Reset': '30' };
// 10 suspends, resumes, and deploys a minute for each service (record SO-01c).
const changeLimits = { 'Ratelimit-Limit': '10', 'Ratelimit-Remaining': '9', 'Ratelimit-Reset': '40' };
const metricsLimits = { 'Ratelimit-Limit': '30', 'Ratelimit-Remaining': '29', 'Ratelimit-Reset': '50' };
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
  /** The time from a resume call to the deploy of that resume, by the clock of the test: 1.8 to 2.0 s in SO-01c and SO-09. */
  resumeDeployDelayMs = 2_000;
  /** Runs before Render handles a create call, so a test can observe the system at that moment. */
  beforeCreate: (request: RenderRequest) => void | Promise<void> = () => {};
  readonly fetch: typeof fetch = (input, init) => this.answer(input, init);
  readonly #account: Account;
  readonly #services = new Map<string, FakeService>();
  readonly #faults: { readonly route: RenderRoute; readonly fault: RenderFault }[] = [];
  readonly #holds = new Map<RenderRoute, Promise<void>>();
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

  /**
   * A service that Render already has, such as one of an earlier run, with a first deploy that ends as outcome. An
   * address gives the service another hostname and port, such as those of a local server of the test.
   */
  addService(name: string, deploy: { readonly outcome: string; readonly readsLeft: number } = { outcome: 'live', readsLeft: 0 }, address?: ServiceAddress): FakeService {
    const service = this.makeService({ name, imagePath: `ghcr.io/tomer-mayara/thermus-hosted@sha256:${'e'.repeat(64)}`, plan: '0.5c-512mb', region: 'oregon', envVars: new Map() }, address);
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

  /** Each answer of the route waits until release(), so a test can see the system while a call of the route runs. */
  hold(route: RenderRoute): { release(): void } {
    const gate = Promise.withResolvers<void>();
    this.#holds.set(route, gate.promise);
    return { release: () => { this.#holds.delete(route); gate.resolve(); } };
  }

  private async answer(input: Parameters<typeof fetch>[0], init: RequestInit = {}): Promise<Response> {
    init.signal?.throwIfAborted();
    const request = this.recorded(new URL(input instanceof Request ? input.url : input), init);
    if (request.route !== 'unknown') await this.#holds.get(request.route);
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

  // The answer of each route; the service ID is the path part after /services/, empty for a route without it.
  readonly #routes: Readonly<Record<RenderRoute, (request: RenderRequest, id: string) => Answer>> = {
    'list services': (request) => this.listServices(request.query),
    'create service': (request) => this.createService(request.body),
    'read service': (_request, id) => this.readService(id),
    'list deploys': (request, id) => this.listDeploys(id, request.query),
    'delete service': (_request, id) => this.deleteService(id),
    'suspend service': (_request, id) => this.suspendService(id),
    'resume service': (_request, id) => this.resumeService(id),
    'memory metrics': (request) => this.metrics(request.query, memoryPointsOf),
    'memory limit metrics': (request) => this.metrics(request.query, memoryLimitPointsOf),
    'list events': (request, id) => this.listEvents(id, request.query),
  };

  private handle(request: RenderRequest): Answer {
    if (request.route === 'unknown') return notFound;
    return this.#routes[request.route](request, /^\/services\/([^/]+)/.exec(request.path)?.[1] ?? '');
  }

  // One series for each named service with points in the window, labelled as SO-01e measured, in bytes.
  private metrics(query: URLSearchParams, pointsOf: (service: FakeService, window: MetricsWindow) => readonly unknown[]): Answer {
    const window = { startMs: Date.parse(query.get('startTime') ?? ''), endMs: Date.parse(query.get('endTime') ?? '') };
    if (!Number.isFinite(window.startMs) || !Number.isFinite(window.endMs)) return { status: 400, body: { message: 'invalid filter parameter' }, headers: metricsLimits };
    const series = query.getAll('resource').flatMap((id) => {
      const service = this.#services.get(id);
      const values = service === undefined ? [] : pointsOf(service, window);
      return values.length === 0 ? [] : [{ labels: [{ field: 'resource', value: id }, { field: 'service', value: id }, { field: 'instance', value: `${id}-x7k2p` }], unit: 'bytes', values }];
    });
    return { status: 200, body: series, headers: metricsLimits };
  }

  // The events of the window, the newest first, at most limit of them.
  private listEvents(id: string, query: URLSearchParams): Answer {
    const service = this.#services.get(id);
    if (service === undefined) return notFound;
    const window = { startMs: Date.parse(query.get('startTime') ?? ''), endMs: Date.parse(query.get('endTime') ?? '') };
    const events = service.events.filter(({ at }) => inWindow(at, window)).toSorted((first, second) => second.at.localeCompare(first.at));
    const items = events.slice(0, Number(query.get('limit') ?? '20')).map(({ type, at }, index) => ({ event: { id: `evt-${id}-${index}`, timestamp: at, serviceId: id, type, details: {} }, cursor: `cursor-${index}` }));
    return { status: 200, body: items, headers: readLimits };
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
    this.addResumeDeploy(service);
    this.advance(service);
    const limit = Number(query.get('limit') ?? '20');
    const items = service.deploys.slice(0, limit).map((deploy) => ({ deploy: deployJson(deploy), cursor: `cursor-${deploy.id}` }));
    return { status: 200, body: items, headers: readLimits };
  }

  private deleteService(id: string): Answer {
    if (!this.#services.delete(id)) return { ...notFound, headers: deleteLimits };
    return { status: 204, headers: deleteLimits };
  }

  // Render answers 202 without a body (SO-01c). The last deploy keeps its status live while the service is suspended.
  private suspendService(id: string): Answer {
    const service = this.#services.get(id);
    if (service === undefined) return notFound;
    service.suspended = true;
    return { status: 202, headers: changeLimits };
  }

  private resumeService(id: string): Answer {
    const service = this.#services.get(id);
    if (service === undefined) return notFound;
    if (service.suspended) {
      service.suspended = false;
      service.resumedAt = this.#account.now?.() ?? 0;
    }
    return { status: 202, headers: changeLimits };
  }

  // The deploy of a resume, once resumeDeployDelayMs passed on the clock of the test; without a clock, at the next read.
  private addResumeDeploy(service: FakeService): void {
    const { resumedAt } = service;
    if (resumedAt === undefined) return;
    const now = this.#account.now;
    if (now !== undefined && now() < resumedAt + this.resumeDeployDelayMs) return;
    service.resumedAt = undefined;
    this.addDeploy(service.id, { trigger: 'service_resumed', outcome: this.deployOutcome, readsLeft: this.deployReads });
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
    service.openPorts = [service.port];
  }

  private makeService(input: ServiceInput, address?: ServiceAddress): FakeService {
    const service: FakeService = {
      ...input, id: this.nextId('srv'), slug: address?.host ?? this.slugOf(input.name), port: address?.port ?? SERVER_PORT, suspended: false,
      ownerId: this.#account.ownerId, deploys: [], openPorts: [], memory: [], events: [],
    };
    this.#services.set(service.id, service);
    return service;
  }

  // The measured rule (SO-06 live runs 1 to 4): a name up to the limit stays whole, and a longer one ends at the last
  // separator before the limit. A slug that another service has gets a suffix of four letters and digits, as the
  // second service of run 4 got.
  private slugOf(name: string): string {
    const slug = shortSlugOf(name.toLowerCase());
    return this.services().some((service) => service.slug === slug) ? `${slug}-${this.#sequence.toString(36).padStart(4, 'x')}` : slug;
  }

  private serviceJson(service: FakeService): unknown {
    const credential = service.registryCredentialId === undefined ? {} : { registryCredential: { id: service.registryCredentialId, name: 'ghcr-thermus-hosted-read' } };
    return {
      id: service.id, name: service.name, slug: service.slug, ownerId: service.ownerId, type: 'private_service',
      imagePath: service.imagePath, suspended: service.suspended ? 'suspended' : 'not_suspended', suspenders: service.suspended ? ['user'] : [], ...credential,
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

const READ_ROUTES: readonly (readonly [RegExp, RenderRoute])[] = [
  [/^\/v1\/services\/[^/]+\/deploys$/, 'list deploys'],
  [/^\/v1\/services\/[^/]+\/events$/, 'list events'],
  [/^\/v1\/metrics\/memory$/, 'memory metrics'],
  [/^\/v1\/metrics\/memory-limit$/, 'memory limit metrics'],
];

const CHANGE_ROUTES: Readonly<Record<string, RenderRoute>> = { suspend: 'suspend service', resume: 'resume service' };

function routeOf(method: string, path: string): RenderRoute | 'unknown' {
  if (path === '/v1/services') return method === 'GET' ? 'list services' : method === 'POST' ? 'create service' : 'unknown';
  if (/^\/v1\/services\/[^/]+$/.test(path)) return method === 'GET' ? 'read service' : method === 'DELETE' ? 'delete service' : 'unknown';
  const change = /^\/v1\/services\/[^/]+\/(suspend|resume)$/.exec(path)?.[1];
  if (change !== undefined) return method === 'POST' ? CHANGE_ROUTES[change] ?? 'unknown' : 'unknown';
  const read = READ_ROUTES.find(([pattern]) => pattern.test(path));
  return read !== undefined && method === 'GET' ? read[1] : 'unknown';
}

interface MetricsWindow {
  readonly startMs: number;
  readonly endMs: number;
}

function inWindow(at: string, window: MetricsWindow): boolean {
  const time = Date.parse(at);
  return time >= window.startMs && time <= window.endMs;
}

// The memory points of a service in the window.
function memoryPointsOf(service: FakeService, window: MetricsWindow): readonly unknown[] {
  return service.memory.filter(({ at }) => inWindow(at, window)).map(({ at, bytes }) => ({ timestamp: at, value: bytes }));
}

// The memory limit of a service: one point at the end of the window, or none without a limit.
function memoryLimitPointsOf(service: FakeService, window: MetricsWindow): readonly unknown[] {
  return service.memoryLimitBytes === undefined ? [] : [{ timestamp: new Date(window.endMs).toISOString(), value: service.memoryLimitBytes }];
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

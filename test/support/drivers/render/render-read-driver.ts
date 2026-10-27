// The protocol driver of the Render API v1 for the reads of the live interface test: the workspace, the registry
// credentials, the services of the workspace, and the slug and URL of one service. It sends no write. The API key
// stays in a private field: no output, error, or report holds the key or a request header.

const API_BASE = 'https://api.render.com/v1';
const REQUEST_TIMEOUT_MS = 30_000;
const PAGE_SIZE = 100;
const MAX_PAGES = 20;

type Json = Record<string, unknown>;

export interface WorkspaceView {
  readonly id: string;
  readonly name: string;
  readonly type: string;
}

export interface CredentialView {
  readonly id: string;
  readonly name: string;
  readonly registry: string;
}

export interface ServiceView {
  readonly id: string;
  readonly name: string;
  readonly type: string;
}

/** The fields of one service that name its private address: the slug and serviceDetails.url. */
export interface AddressView {
  readonly name: string;
  readonly slug: string;
  readonly url: string;
}

function record(value: unknown): Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Json : {};
}

function text(value: Json, key: string): string {
  const item = value[key];
  return typeof item === 'string' ? item : '';
}

export class RenderReadDriver {
  readonly #key: string;
  readonly #ownerId: string;

  constructor(key: string, ownerId: string) {
    this.#key = key;
    this.#ownerId = ownerId;
  }

  async workspace(): Promise<WorkspaceView> {
    const owner = record(await this.read(`/owners/${this.#ownerId}`));
    return { id: text(owner, 'id'), name: text(owner, 'name'), type: text(owner, 'type') };
  }

  async registryCredentials(): Promise<readonly CredentialView[]> {
    const items = await this.read(`/registrycredentials?${new URLSearchParams({ ownerId: this.#ownerId, limit: String(PAGE_SIZE) })}`);
    const credentials = Array.isArray(items) ? items.map(record) : [];
    return credentials.map((item) => record(item.registryCredential ?? item)).map((item) => ({ id: text(item, 'id'), name: text(item, 'name'), registry: text(item, 'registry') }));
  }

  /** Each service of the workspace, of every type, page by page. */
  async services(): Promise<readonly ServiceView[]> {
    const found: ServiceView[] = [];
    let cursor: string | undefined;
    for (let page = 1; page <= MAX_PAGES; page += 1) {
      const query = new URLSearchParams({ ownerId: this.#ownerId, limit: String(PAGE_SIZE), ...(cursor === undefined ? {} : { cursor }) });
      const items = await this.read(`/services?${query}`);
      const entries = Array.isArray(items) ? items.map(record) : [];
      found.push(...entries.map((entry) => record(entry.service)).map((service) => ({ id: text(service, 'id'), name: text(service, 'name'), type: text(service, 'type') })));
      cursor = entries.length === PAGE_SIZE ? text(entries.at(-1) ?? {}, 'cursor') || undefined : undefined;
      if (cursor === undefined) return found;
    }
    throw new Error(`The service list of the workspace has more than ${MAX_PAGES} pages`);
  }

  async address(serviceId: string): Promise<AddressView> {
    const service = record(await this.read(`/services/${encodeURIComponent(serviceId)}`));
    return { name: text(service, 'name'), slug: text(service, 'slug'), url: text(record(service.serviceDetails), 'url') };
  }

  private async read(path: string): Promise<unknown> {
    const response = await fetch(`${API_BASE}${path}`, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${this.#key}` },
      redirect: 'error',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const body = await response.text();
    if (!response.ok) throw new Error(`GET ${path.split('?')[0]} answered ${response.status}`);
    return body === '' ? undefined : JSON.parse(body) as unknown;
  }
}

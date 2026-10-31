// The Render calls of the rehearsal, through the guarded client of the Render probes: it refuses each call to a service
// that this run did not confirm as a thermus-spike-* service, and always the production service. A read repeats after
// a 429, a 5xx answer, or a network failure; a create, an update, or a deploy goes one time only.
import type { Call } from '../../spike/render-tenant-lifecycle/calls.ts';
import { fieldJson, fieldText, listItems } from '../../spike/render-tenant-lifecycle/answers.ts';
import { sleep } from '../../spike/render-tenant-lifecycle/polls.ts';
import { RenderClient, type Answer } from '../../spike/render-tenant-lifecycle/render-client.ts';
import { CONTROL_NAME, OWNER_ID, PRODUCTION_SERVICE_ID, TENANT_PREFIX } from './rehearsal-settings.ts';

const PAGE = '100';
const MAX_PAGES = 20;
const MESSAGE_LIMIT = 400;

export interface ServiceLine {
  readonly id: string;
  readonly name: string;
  readonly type: string;
  readonly suspended: string;
}

export interface LogLine {
  readonly timestamp: string;
  readonly message: string;
  readonly labels: Readonly<Record<string, string>>;
}

function labelsOf(value: unknown): Readonly<Record<string, string>> {
  const labels = Array.isArray(value) ? value : [];
  return Object.fromEntries(labels.map((label) => [fieldText(label, 'name') ?? '', fieldText(label, 'value') ?? '']));
}

export class RehearsalRender {
  readonly client: RenderClient;
  readonly signal: AbortSignal;

  constructor(key: string, signal: AbortSignal) {
    this.client = new RenderClient(key, true);
    this.signal = signal;
  }

  read(path: string): Promise<Answer> {
    return this.client.read({ method: 'GET', path }, this.signal);
  }

  write(step: string, call: Call): Promise<Answer> {
    return this.client.write(step, call, this.signal);
  }

  /** Each service of the workspace, of every type, one page after the other. */
  async services(query: Readonly<Record<string, string>> = {}): Promise<readonly ServiceLine[]> {
    const found: ServiceLine[] = [];
    let cursor: string | undefined;
    for (let page = 1; page <= MAX_PAGES; page++) {
      const search = new URLSearchParams({ ownerId: OWNER_ID, ...query, limit: PAGE, ...(cursor === undefined ? {} : { cursor }) });
      const { items, cursor: next } = listItems((await this.read(`/services?${search}`)).json, 'service');
      found.push(...items.map((item) => ({ id: fieldText(item, 'id') ?? '', name: fieldText(item, 'name') ?? '', type: fieldText(item, 'type') ?? '', suspended: fieldText(item, 'suspended') ?? '' })));
      if (items.length < Number(PAGE) || next === undefined) return found;
      cursor = next;
    }
    throw new Error(`The service list has more than ${MAX_PAGES} pages.`);
  }

  /** Finds the one service with this exact name and a thermus-spike-* name, and lets the client call it. */
  async confirmNamed(name: string): Promise<string | undefined> {
    const named = (await this.services({ name })).filter((service) => service.name === name);
    if (named.length > 1) throw new Error(`${named.length} services have the name ${name}. Stop and check the Render Dashboard.`);
    const [service] = named;
    if (service === undefined) return undefined;
    this.client.confirmOwnService(service.id, service.name);
    return service.id;
  }

  async confirmControl(): Promise<string> {
    const id = await this.confirmNamed(CONTROL_NAME);
    if (id === undefined) throw new Error(`No service has the name ${CONTROL_NAME}.`);
    return id;
  }

  /** A tenant service of the rehearsal: a private service whose name starts with thermus-spike-tenant-. */
  async confirmTenant(serviceId: string): Promise<string> {
    const tenant = (await this.services({ type: 'private_service' })).find((service) => service.id === serviceId);
    if (tenant === undefined || !tenant.name.startsWith(TENANT_PREFIX) || tenant.id === PRODUCTION_SERVICE_ID) {
      throw new Error(`${serviceId} is not a private service whose name starts with ${TENANT_PREFIX}.`);
    }
    this.client.confirmOwnService(tenant.id, tenant.name);
    return tenant.name;
  }

  async service(serviceId: string): Promise<unknown> {
    return (await this.read(`/services/${serviceId}`)).json;
  }

  async deploys(serviceId: string, limit = 10): Promise<readonly unknown[]> {
    return listItems((await this.read(`/services/${serviceId}/deploys?limit=${limit}`)).json, 'deploy').items;
  }

  async deploy(serviceId: string, deployId: string): Promise<unknown> {
    return (await this.read(`/services/${serviceId}/deploys/${deployId}`)).json;
  }

  async events(serviceId: string): Promise<readonly unknown[]> {
    return listItems((await this.read(`/services/${serviceId}/events?limit=100`)).json, 'event').items;
  }

  /** The variable names of a service, never a value, and the value of the names in show only. */
  async variables(serviceId: string, show: readonly string[] = []): Promise<readonly { readonly key: string; readonly value?: string }[]> {
    const { items } = listItems((await this.read(`/services/${serviceId}/env-vars?limit=${PAGE}`)).json, 'envVar');
    return items.map((item) => {
      const key = fieldText(item, 'key') ?? '';
      return show.includes(key) ? { key, value: fieldText(item, 'value') } : { key };
    }).sort((a, b) => a.key.localeCompare(b.key));
  }

  /** The log lines of a service since a time, one page after the other. */
  async logs(resource: string, startTime: string, types: readonly string[] = []): Promise<readonly LogLine[]> {
    const lines: LogLine[] = [];
    let window = { startTime, endTime: new Date().toISOString() };
    for (let page = 1; page <= MAX_PAGES; page++) {
      const search = new URLSearchParams({ ownerId: OWNER_ID, resource, startTime: window.startTime, endTime: window.endTime, direction: 'forward', limit: PAGE });
      for (const type of types) search.append('type', type);
      const answer = (await this.read(`/logs?${search}`)).json;
      const logs = fieldJson(answer, 'logs');
      lines.push(...(Array.isArray(logs) ? logs : []).map((item) => ({ timestamp: fieldText(item, 'timestamp') ?? '', message: fieldText(item, 'message') ?? '', labels: labelsOf(fieldJson(item, 'labels')) })));
      const next = { startTime: fieldText(answer, 'nextStartTime'), endTime: fieldText(answer, 'nextEndTime') };
      if (fieldJson(answer, 'hasMore') !== true || next.startTime === undefined || next.endTime === undefined) return lines;
      window = { startTime: next.startTime, endTime: next.endTime };
    }
    return lines;
  }

  /** PUT of one variable. The answer holds the value, so nothing prints its body. A 429 waits and tries again. */
  async putVariable(serviceId: string, key: string, value: string): Promise<Answer> {
    const call: Call = { method: 'PUT', path: `/services/${serviceId}/env-vars/${encodeURIComponent(key)}`, body: { value } };
    for (let attempt = 1; ; attempt++) {
      try {
        const answer = await this.write(`PUT ${key}`, call);
        if (answer.limits.remaining === '0') await sleep((Number(answer.limits.reset ?? '60') + 1) * 1_000, this.signal);
        return answer;
      } catch (error) {
        const limited = error instanceof Error && error.message.includes(' answered 429');
        if (!limited || attempt === 3) throw error;
        await sleep(61_000, this.signal);
      }
    }
  }
}

export function limitsText(answer: Answer): string {
  const { limit, remaining, reset, retryAfter } = answer.limits;
  return `Ratelimit-Limit ${limit ?? 'absent'}, Ratelimit-Remaining ${remaining ?? 'absent'}, Ratelimit-Reset ${reset ?? 'absent'}${retryAfter === undefined ? '' : `, Retry-After ${retryAfter}`}`;
}

export function messageOf(value: unknown): string {
  return (fieldText(value, 'message') ?? '').slice(0, MESSAGE_LIMIT);
}

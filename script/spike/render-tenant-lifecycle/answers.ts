type Json = Record<string, unknown>;

export interface ServiceView {
  readonly id: string;
  readonly name?: string;
  readonly slug?: string;
  readonly type?: string;
  readonly imagePath?: string;
  readonly suspended?: string;
  readonly suspenders: readonly string[];
  readonly credentialName?: string;
  readonly plan?: string;
  readonly region?: string;
  readonly runtime?: string;
  readonly url?: string;
  readonly openPorts: readonly number[];
  readonly detailKeys: readonly string[];
}

export interface DeployView {
  readonly id: string;
  readonly status?: string;
  readonly trigger?: string;
  readonly imageRef?: string;
  readonly imageSha?: string;
  readonly createdAt?: string;
  readonly finishedAt?: string;
}

export interface AddressField {
  readonly path: string;
  readonly value: string;
  readonly host: string;
  readonly port: number;
}

const RENDER_ID = /^[A-Za-z0-9_-]{1,64}$/;
const INTERNAL_ADDRESS = /^(?:https?:\/\/)?([a-z0-9](?:[a-z0-9-]*[a-z0-9])?):(\d{1,5})\/?$/;

function isJson(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(record: Json, key: string): string | undefined {
  const value = record[key];
  return typeof value === 'string' ? value : undefined;
}

export function fieldText(value: unknown, key: string): string | undefined {
  return isJson(value) ? text(value, key) : undefined;
}

export function fieldJson(value: unknown, key: string): unknown {
  return isJson(value) ? value[key] : undefined;
}

function json(record: Json, key: string): Json {
  const value = record[key];
  return isJson(value) ? value : {};
}

export function renderId(value: unknown, field: string): string {
  if (typeof value !== 'string' || !RENDER_ID.test(value)) throw new Error(`The answer has no valid ${field}.`);
  return value;
}

export function serviceOf(value: unknown): ServiceView {
  const service = isJson(value) ? value : {};
  const details = json(service, 'serviceDetails');
  const ports = Array.isArray(details.openPorts) ? details.openPorts.filter(isJson).map((port) => port.port) : [];
  return {
    id: renderId(service.id, 'service.id'),
    name: text(service, 'name'),
    slug: text(service, 'slug'),
    type: text(service, 'type'),
    imagePath: text(service, 'imagePath'),
    suspended: text(service, 'suspended'),
    suspenders: Array.isArray(service.suspenders) ? service.suspenders.filter((item) => typeof item === 'string') : [],
    credentialName: text(json(service, 'registryCredential'), 'name'),
    plan: text(details, 'plan'),
    region: text(details, 'region'),
    runtime: text(details, 'runtime'),
    url: text(details, 'url'),
    openPorts: ports.filter((port) => typeof port === 'number'),
    detailKeys: Object.keys(details).sort(),
  };
}

export function deployOf(value: unknown): DeployView {
  const deploy = isJson(value) ? value : {};
  const image = json(deploy, 'image');
  return {
    id: renderId(deploy.id, 'deploy.id'),
    status: text(deploy, 'status'),
    trigger: text(deploy, 'trigger'),
    imageRef: text(image, 'ref'),
    imageSha: text(image, 'sha'),
    createdAt: text(deploy, 'createdAt'),
    finishedAt: text(deploy, 'finishedAt'),
  };
}

export function listItems(value: unknown, key: string): { readonly items: readonly unknown[]; readonly cursor?: string } {
  const entries = Array.isArray(value) ? value.filter(isJson) : [];
  const last = entries.at(-1);
  return { items: entries.map((entry) => entry[key]), cursor: last === undefined ? undefined : text(last, 'cursor') };
}

export interface CredentialView {
  readonly id: string;
  readonly name?: string;
  readonly registry?: string;
}

export function credentialsOf(value: unknown): readonly CredentialView[] {
  const items = Array.isArray(value) ? value.filter(isJson) : [];
  return items.map((item) => (isJson(item.registryCredential) ? item.registryCredential : item))
    .map((item) => ({ id: renderId(item.id, 'registryCredential.id'), name: text(item, 'name'), registry: text(item, 'registry') }));
}

export function instanceIdsOf(value: unknown): readonly string[] {
  const items = Array.isArray(value) ? value.filter(isJson) : [];
  return items.map((item) => renderId(item.id, 'instance.id'));
}

export function eventsOf(value: unknown): readonly { readonly type: string; readonly at: number }[] {
  const events = listItems(value, 'event').items.filter(isJson);
  const typed = events.map((event) => ({ type: text(event, 'type') ?? 'unknown', at: Date.parse(text(event, 'timestamp') ?? '') }));
  return typed.filter((event) => Number.isFinite(event.at)).sort((a, b) => a.at - b.at);
}

export function addressFields(value: unknown, path = ''): AddressField[] {
  if (typeof value === 'string') {
    const match = INTERNAL_ADDRESS.exec(value);
    return match?.[1] === undefined ? [] : [{ path, value, host: match[1], port: Number(match[2]) }];
  }
  if (Array.isArray(value)) return value.flatMap((item, index) => addressFields(item, `${path}[${index}]`));
  if (!isJson(value)) return [];
  return Object.entries(value).flatMap(([key, item]) => addressFields(item, path === '' ? key : `${path}.${key}`));
}

const LEGACY_PLAN_NAMES: Readonly<Record<string, string>> = { '0.5c-512mb': 'starter', '1c-2g': 'standard' };

export function samePlan(value: string | undefined, plan: string): boolean {
  return value === plan || (value !== undefined && value === LEGACY_PLAN_NAMES[plan]);
}

export function sameDigest(sha: string | undefined, digest: string): boolean {
  return sha !== undefined && sha.replace(/^sha256:/, '') === digest.replace(/^sha256:/, '');
}

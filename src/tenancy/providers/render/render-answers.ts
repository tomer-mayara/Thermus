import type { DeployProgress, PlatformDeploy, PlatformService } from '../../tenants/tenant-platform.ts';
import type { RenderAnswer, RenderExchange } from './render-api.ts';

// The reading of the Render answers that the tenant platform uses. An ID goes into a path or the registry only when it
// has the form of a Render ID, and the internal address only when its host is a private service name.
const SERVICE_ID = /^srv-[a-z0-9]+$/;
const DEPLOY_ID = /^dep-[a-z0-9]+$/;
const DIGEST = /^sha256:[0-9a-f]{64}$/;
const SERVICE_ADDRESS = /^(?:https?:\/\/)?([a-z0-9](?:[a-z0-9-]*[a-z0-9])?):\d{1,5}\/?$/;
const FAILED_STATUSES = new Set(['build_failed', 'update_failed', 'canceled', 'pre_deploy_failed', 'deactivated']);
const MESSAGE_LIMIT = 200;

type Json = Record<string, unknown>;

function record(value: unknown): Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Json : {};
}

export function isServiceId(value: string): boolean {
  return SERVICE_ID.test(value);
}

function serviceOf(value: unknown): PlatformService | undefined {
  const { id, name } = record(value);
  return typeof id === 'string' && isServiceId(id) && typeof name === 'string' ? { id, name } : undefined;
}

/** The services of a list answer, or undefined when an item is not a valid service. */
export function servicesOf(json: unknown): readonly PlatformService[] | undefined {
  if (!Array.isArray(json)) return undefined;
  const services = json.map((item) => serviceOf(record(item).service));
  return services.every((service) => service !== undefined) ? services : undefined;
}

/** The deploy with the latest creation time of a list answer, null for an empty list, undefined for an invalid one. */
export function newestDeployOf(json: unknown): PlatformDeploy | null | undefined {
  if (!Array.isArray(json)) return undefined;
  const deploys = json.map((item) => deployOf(record(item).deploy));
  if (!deploys.every((deploy) => deploy !== undefined)) return undefined;
  const newest = deploys.reduce<(typeof deploys)[number] | null>((latest, deploy) => latest === null || deploy.createdAt > latest.createdAt ? deploy : latest, null);
  if (newest === null) return null;
  const { createdAt: _createdAt, ...deploy } = newest;
  return deploy;
}

function deployOf(value: unknown): (PlatformDeploy & { readonly createdAt: number }) | undefined {
  const { id, status, image, createdAt } = record(value);
  if (typeof id !== 'string' || !DEPLOY_ID.test(id) || typeof status !== 'string') return undefined;
  const { sha } = record(image);
  const created = typeof createdAt === 'string' ? Date.parse(createdAt) : Number.NaN;
  return {
    id, status, progress: progressOf(status),
    ...(typeof sha === 'string' && DIGEST.test(sha) ? { imageDigest: sha } : {}),
    createdAt: Number.isNaN(created) ? -Infinity : created,
  };
}

function progressOf(status: string): DeployProgress {
  if (status === 'live') return 'live';
  return FAILED_STATUSES.has(status) ? 'failed' : 'pending';
}

/**
 * The address of a private service: http:// with the host of serviceDetails.url and the first TCP port of
 * serviceDetails.openPorts. The port of serviceDetails.url (10000) refused connections; the open port answered
 * (record SO-01d part two). The slug is read from the answer, never computed from the name.
 */
export function internalUrlOf(json: unknown): string | undefined {
  const details = record(record(json).serviceDetails);
  const host = typeof details.url === 'string' ? SERVICE_ADDRESS.exec(details.url)?.[1] : undefined;
  const ports: unknown[] = Array.isArray(details.openPorts) ? details.openPorts : [];
  const port = ports.map(record).find((open) => open.protocol === 'TCP' && Number.isInteger(open.port) && Number(open.port) > 0 && Number(open.port) < 65_536)?.port;
  return host === undefined || port === undefined ? undefined : `http://${host}:${String(port)}`;
}

export function answerReason(answer: RenderAnswer): string {
  const { message } = record(answer.json);
  return `Render answered ${answer.status}${typeof message === 'string' && message !== '' ? `: ${message.slice(0, MESSAGE_LIMIT)}` : ''}`;
}

export function reasonOf(exchange: RenderExchange): string {
  return exchange.answer === undefined ? exchange.failure : answerReason(exchange.answer);
}

export function createdServiceOf(answer: RenderAnswer): PlatformService | undefined {
  return serviceOf(record(answer.json).service);
}

import type { PlatformService } from '../../tenants/tenant-platform.ts';

// An ID goes into a path or the registry only when it has the form of a Render service ID, and the internal address
// only when its host is a private service name.
const SERVICE_ID = /^srv-[a-z0-9]+$/;
const SERVICE_ADDRESS = /^(?:https?:\/\/)?([a-z0-9](?:[a-z0-9-]*[a-z0-9])?):\d{1,5}\/?$/;

type Json = Record<string, unknown>;

export function recordOf(value: unknown): Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Json : {};
}

export function isServiceId(value: string): boolean {
  return SERVICE_ID.test(value);
}

function serviceOf(value: unknown): PlatformService | undefined {
  const { id, name } = recordOf(value);
  return typeof id === 'string' && isServiceId(id) && typeof name === 'string' ? { id, name } : undefined;
}

/** The service of a create answer. */
export function createdServiceOf(json: unknown): PlatformService | undefined {
  return serviceOf(recordOf(json).service);
}

/** The services of a list answer, or undefined when an item is not a valid service. */
export function servicesOf(json: unknown): readonly PlatformService[] | undefined {
  if (!Array.isArray(json)) return undefined;
  const services = json.map((item) => serviceOf(recordOf(item).service));
  return services.every((service) => service !== undefined) ? services : undefined;
}

/**
 * The address of a private service: http:// with the host of serviceDetails.url and the first TCP port of
 * serviceDetails.openPorts. The port of serviceDetails.url (10000) refused connections; the open port answered
 * (record SO-01d part two). The slug is read from the answer, never computed from the name.
 */
export function internalUrlOf(json: unknown): string | undefined {
  const details = recordOf(recordOf(json).serviceDetails);
  const host = typeof details.url === 'string' ? SERVICE_ADDRESS.exec(details.url)?.[1] : undefined;
  const port = tcpPortOf(details.openPorts);
  return host === undefined || port === undefined ? undefined : `http://${host}:${port}`;
}

function tcpPortOf(openPorts: unknown): number | undefined {
  const ports: unknown[] = Array.isArray(openPorts) ? openPorts : [];
  return ports.map(recordOf).map((open) => (open.protocol === 'TCP' ? open.port : undefined)).find(isPort);
}

function isPort(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) > 0 && Number(value) < 65_536;
}

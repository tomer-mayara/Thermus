// The fields of the Render API answers that the deploy job reads. A missing or malformed field stays undefined, so
// each check names what the answer held.

export interface ServiceView {
  readonly id: string;
  readonly name?: string;
  readonly ownerId?: string;
  readonly type?: string;
  readonly runtime?: string;
  readonly imagePath?: string;
  readonly suspended?: string;
  readonly url?: string;
}

export interface DeployView {
  readonly id: string;
  readonly status?: string;
  readonly imageSha?: string;
  readonly createdAt?: string;
  readonly finishedAt?: string;
}

function recordOf(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function textOf(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

export function shown(value: string | undefined): string {
  return value === undefined || value === '' ? 'empty' : value;
}

export function serviceOf(value: unknown): ServiceView {
  const service = recordOf(value);
  const details = recordOf(service.serviceDetails);
  return {
    id: textOf(service.id) ?? '',
    name: textOf(service.name),
    ownerId: textOf(service.ownerId),
    type: textOf(service.type),
    runtime: textOf(details.runtime),
    imagePath: textOf(service.imagePath),
    suspended: textOf(service.suspended),
    url: textOf(details.url),
  };
}

export function deployOf(value: unknown): DeployView {
  const deploy = recordOf(value);
  return {
    id: textOf(deploy.id) ?? '',
    status: textOf(deploy.status),
    imageSha: textOf(recordOf(deploy.image).sha),
    createdAt: textOf(deploy.createdAt),
    finishedAt: textOf(deploy.finishedAt),
  };
}

// Render lists wrap each item with its cursor: [{ "deploy": {...}, "cursor": "..." }].
export function itemsOf(value: unknown, key: string): readonly Record<string, unknown>[] {
  return Array.isArray(value) ? value.map((item) => recordOf(recordOf(item)[key])) : [];
}

export function repositoryOf(imagePath: string | undefined): string | undefined {
  if (imagePath === undefined) return undefined;
  const [name = ''] = imagePath.split('@');
  const tag = name.lastIndexOf(':');
  return tag > name.lastIndexOf('/') ? name.slice(0, tag) : name;
}

export function sameDigest(sha: string | undefined, digest: string): boolean {
  return sha !== undefined && sha.replace(/^sha256:/, '') === digest.replace(/^sha256:/, '');
}

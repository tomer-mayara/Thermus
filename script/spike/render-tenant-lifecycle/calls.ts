type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

export interface Call {
  readonly method: Method;
  readonly path: string;
  readonly body?: unknown;
}

export type ServiceType = 'private_service' | 'web_service';
export type Variables = readonly (readonly [string, string])[];

// The SO-01c inputs have no serviceType, so the SO-01c create call stays a private service. Without variables, the
// call holds the placeholder variables; a Docker command replaces the command of the image.
interface ServiceSource {
  readonly owner: string;
  readonly region: string;
  readonly image: { readonly ref: string };
  readonly serviceType?: ServiceType;
  readonly variables?: Variables;
  readonly dockerCommand?: string;
}

export const API_BASE = 'https://api.render.com/v1';
export const FREE_PLAN = '0.5c-512mb';
export const TEAM_PLAN = '1c-2g';
export const LISTEN_PORT = 8080;
export const SERVICE_PREFIX = 'thermus-spike-';
export const PRODUCTION_SERVICE_ID = 'srv-db8mnqg473hc739d529g';
export const HEALTH_CHECK_PATH = '/healthz';
export const PAGE_SIZE = 100;
const PAGE_LIMIT = String(PAGE_SIZE);
export const PRIVATE_SERVICES: readonly ServiceType[] = ['private_service'];

export const PLACEHOLDER_ENVIRONMENT: Variables = [
  ['PUBLIC_BASE_URL', 'https://thermus.example/'],
  ['WORKOS_API_KEY', 'sk_test_placeholder'],
  ['WORKOS_CLIENT_ID', 'client_placeholder'],
  ['WORKOS_AUTHKIT_ISSUER', 'https://thermus-test.authkit.app'],
  ['WORKOS_REDIRECT_URI', 'https://thermus.example/callback'],
  ['WORKOS_COOKIE_PASSWORD', 'cookie-password-placeholder-0032'],
];

// A public image needs no registry credential: an undefined credential ID leaves the field out.
export function createServiceCall(source: ServiceSource, name: string, credentialId: string | undefined): Call {
  const type = source.serviceType ?? 'private_service';
  const details = { runtime: 'image', plan: FREE_PLAN, region: source.region, numInstances: 1 };
  // A web service gets the Render health check. The OpenAPI document gives healthCheckPath only for web services.
  const checked = type === 'web_service' ? { ...details, healthCheckPath: HEALTH_CHECK_PATH } : details;
  const credential = credentialId === undefined ? {} : { registryCredentialId: credentialId };
  return {
    method: 'POST',
    path: '/services',
    body: {
      type,
      name,
      ownerId: source.owner,
      image: { ownerId: source.owner, imagePath: source.image.ref, ...credential },
      envVars: (source.variables ?? PLACEHOLDER_ENVIRONMENT).map(([key, value]) => ({ key, value })),
      serviceDetails: source.dockerCommand === undefined ? checked : { ...checked, envSpecificDetails: { dockerCommand: source.dockerCommand } },
    },
  };
}

// The answer holds the value, so no caller may record its body. The server reads the new value at its next start.
export function updateVariableCall(serviceId: string, key: string, value: string): Call {
  return { method: 'PUT', path: `/services/${serviceId}/env-vars/${encodeURIComponent(key)}`, body: { value } };
}

export function deployImageCall(serviceId: string, imageUrl: string): Call {
  return { method: 'POST', path: `/services/${serviceId}/deploys`, body: { imageUrl } };
}

export function updatePlanCall(serviceId: string, plan: string): Call {
  return { method: 'PATCH', path: `/services/${serviceId}`, body: { serviceDetails: { plan } } };
}

export function suspendCall(serviceId: string): Call {
  return { method: 'POST', path: `/services/${serviceId}/suspend` };
}

export function resumeCall(serviceId: string): Call {
  return { method: 'POST', path: `/services/${serviceId}/resume` };
}

export function deleteServiceCall(serviceId: string): Call {
  return { method: 'DELETE', path: `/services/${serviceId}` };
}

export function ownerCall(owner: string): Call {
  return { method: 'GET', path: `/owners/${owner}` };
}

export function credentialsCall(owner: string): Call {
  return { method: 'GET', path: `/registrycredentials?${new URLSearchParams({ ownerId: owner, limit: PAGE_LIMIT })}` };
}

// An empty list of types sends no type filter, so the answer holds services of every type.
export function servicesCall(owner: string, types: readonly ServiceType[], cursor?: string): Call {
  const query = new URLSearchParams({ ownerId: owner });
  if (types.length > 0) query.set('type', types.join(','));
  query.set('limit', PAGE_LIMIT);
  if (cursor !== undefined) query.set('cursor', cursor);
  return { method: 'GET', path: `/services?${query}` };
}

export function servicesNamedCall(owner: string, name: string): Call {
  return { method: 'GET', path: `/services?${new URLSearchParams({ ownerId: owner, name, limit: PAGE_LIMIT })}` };
}

export function serviceCall(serviceId: string): Call {
  return { method: 'GET', path: `/services/${serviceId}` };
}

export function envVarsCall(serviceId: string): Call {
  return { method: 'GET', path: `/services/${serviceId}/env-vars?limit=${PAGE_LIMIT}` };
}

export function instancesCall(serviceId: string): Call {
  return { method: 'GET', path: `/services/${serviceId}/instances` };
}

export function eventsCall(serviceId: string): Call {
  return { method: 'GET', path: `/services/${serviceId}/events?limit=${PAGE_LIMIT}` };
}

export function recentDeploysCall(serviceId: string): Call {
  return { method: 'GET', path: `/services/${serviceId}/deploys?limit=20` };
}

export function deployCall(serviceId: string, deployId: string): Call {
  return { method: 'GET', path: `/services/${serviceId}/deploys/${deployId}` };
}

export function callLine(call: Call): string {
  return `${call.method} ${call.path}`;
}

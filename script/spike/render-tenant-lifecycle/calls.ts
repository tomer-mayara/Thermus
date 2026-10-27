import type { ProbeInputs } from './inputs.ts';

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE';

export interface Call {
  readonly method: Method;
  readonly path: string;
  readonly body?: unknown;
}

export const API_BASE = 'https://api.render.com/v1';
export const FREE_PLAN = '0.5c-512mb';
export const TEAM_PLAN = '1c-2g';
export const LISTEN_PORT = 8080;
export const SERVICE_PREFIX = 'thermus-spike-';
export const PRODUCTION_SERVICE_ID = 'srv-db8mnqg473hc739d529g';
export const PAGE_SIZE = 100;
const PAGE_LIMIT = String(PAGE_SIZE);

export const PLACEHOLDER_ENVIRONMENT: readonly (readonly [string, string])[] = [
  ['PUBLIC_BASE_URL', 'https://thermus.example/'],
  ['WORKOS_API_KEY', 'sk_test_placeholder'],
  ['WORKOS_CLIENT_ID', 'client_placeholder'],
  ['WORKOS_AUTHKIT_ISSUER', 'https://thermus-test.authkit.app'],
  ['WORKOS_REDIRECT_URI', 'https://thermus.example/callback'],
  ['WORKOS_COOKIE_PASSWORD', 'cookie-password-placeholder-0032'],
];

export function createServiceCall(inputs: ProbeInputs, name: string, credentialId: string): Call {
  return {
    method: 'POST',
    path: '/services',
    body: {
      type: 'private_service',
      name,
      ownerId: inputs.owner,
      image: { ownerId: inputs.owner, imagePath: inputs.image.ref, registryCredentialId: credentialId },
      envVars: PLACEHOLDER_ENVIRONMENT.map(([key, value]) => ({ key, value })),
      serviceDetails: { runtime: 'image', plan: FREE_PLAN, region: inputs.region, numInstances: 1 },
    },
  };
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

export function privateServicesCall(owner: string, cursor?: string): Call {
  const query = new URLSearchParams({ ownerId: owner, type: 'private_service', limit: PAGE_LIMIT });
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

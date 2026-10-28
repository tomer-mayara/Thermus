import { RenderTenantPlatform } from '../../../../src/tenancy/providers/render/render-tenant-platform.ts';
import { VirtualClock } from '../../../support/doubles/tenants/virtual-clock.ts';

// The Render adapter over a stub (Meszaros) of fetch: each call takes the next scripted answer, a Response or an Error
// for a call without an answer. sent records each request, and guarded each service ID that the write guard checked.

export const apiKey = 'rnd_unitTestKey0123456789';
export const ownerId = 'tea-db8i6ceq1p3s73dev9og';
export const image = `ghcr.io/tomer-mayara/thermus-hosted@sha256:${'ab'.repeat(32)}`;
export const productionServiceId = 'srv-db8mnqg473hc739d529g';
export const signal = new AbortController().signal;

type Scripted = Response | Error;

export interface Sent {
  readonly url: string;
  readonly method: string;
  readonly headers: Headers;
  readonly body: unknown;
}

export function json(status: number, body: unknown, headers: Readonly<Record<string, string>> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });
}

export function platformWith(answers: Scripted[], owned: (serviceId: string) => boolean = () => true) {
  const sent: Sent[] = [];
  const guarded: string[] = [];
  const clock = new VirtualClock();
  const fetchStub: typeof fetch = async (input, init = {}) => {
    sent.push({ url: String(input), method: init.method ?? 'GET', headers: new Headers(init.headers), body: typeof init.body === 'string' ? JSON.parse(init.body) as unknown : undefined });
    const answer = answers.shift();
    if (answer === undefined) throw new Error('No scripted answer');
    if (answer instanceof Error) throw answer;
    return answer;
  };
  const platform = new RenderTenantPlatform({
    apiKey, ownerId, registryCredentialId: 'rgc-dbg1h0142hec73da9ra0', image, clock, fetch: fetchStub,
    ownsService: async (serviceId) => { guarded.push(serviceId); return owned(serviceId); },
  });
  return { platform, sent, guarded, clock };
}

export const serviceJson = (id: string, name: string, details: Record<string, unknown> = {}) => ({ id, name, slug: name, type: 'private_service', serviceDetails: { url: `${name}:10000`, openPorts: [{ port: 8080, protocol: 'TCP' }], ...details } });

export const deployJson = (deploy: { readonly id: string; readonly status: string; readonly createdAt: string; readonly sha?: string }) => ({
  id: deploy.id, status: deploy.status, trigger: 'manual', createdAt: deploy.createdAt, image: { ref: image, ...(deploy.sha === undefined ? {} : { sha: deploy.sha }) },
});

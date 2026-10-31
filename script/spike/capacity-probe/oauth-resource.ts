import assert from 'node:assert/strict';
import { addRow, seconds } from '../render-tenant-lifecycle/context.ts';
import { mcpResource, requestTimeout, type HostedLiveSettings } from '../../../test/support/hosted-live/settings.ts';
import { deleteWorkOSResource } from '../../../test/support/hosted-live/workos-api.ts';
import { originOf, type ProbeContext } from './context.ts';
import { resourceOf } from './variables.ts';

// The MCP resource indicators of the WorkOS environment (workos.com/docs/reference/authkit/oauth-resource): POST adds
// one and leaves the others in place, and DELETE also removes the consents that were granted against it.
export const RESOURCES_PATH = '/user_management/authkit_oauth_resources';
// The resource of the hosted live gate. The probe asserts that it stays, and never deletes it.
export const LIVE_GATE_RESOURCE = mcpResource;
const API_ORIGIN = 'https://api.workos.com';
const PAGE_LIMIT = 100;
const MAX_PAGES = 10;
const STEP = 'OAuth resource';

export interface ResourceView {
  readonly id: string;
  readonly uri: string;
}

type Json = Record<string, unknown>;

function isJson(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function workosJson(settings: HostedLiveSettings, request: { readonly method: 'GET' | 'POST'; readonly path: string; readonly body?: unknown }): Promise<{ readonly status: number; readonly json: unknown; readonly ms: number }> {
  const started = performance.now();
  const headers: Record<string, string> = { Authorization: `Bearer ${settings.apiKey}`, Accept: 'application/json' };
  if (request.body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${API_ORIGIN}${request.path}`, {
    method: request.method, headers, body: request.body === undefined ? undefined : JSON.stringify(request.body), redirect: 'error', signal: AbortSignal.timeout(requestTimeout),
  });
  const json: unknown = await response.json().catch(() => undefined);
  return { status: response.status, json, ms: performance.now() - started };
}

function resourceView(value: unknown): ResourceView {
  const item = isJson(value) ? value : {};
  assert.ok(typeof item.id === 'string' && typeof item.uri === 'string', 'A resource of the answer has no id or uri.');
  return { id: item.id, uri: item.uri };
}

export async function listResources(settings: HostedLiveSettings): Promise<readonly ResourceView[]> {
  const found: ResourceView[] = [];
  let after: string | undefined;
  for (let page = 1; page <= MAX_PAGES; page++) {
    const query = new URLSearchParams({ limit: String(PAGE_LIMIT), order: 'asc', ...(after === undefined ? {} : { after }) });
    const answer = await workosJson(settings, { method: 'GET', path: `${RESOURCES_PATH}?${query}` });
    assert.equal(answer.status, 200, `GET ${RESOURCES_PATH} answered ${answer.status}`);
    const body = isJson(answer.json) ? answer.json : {};
    found.push(...(Array.isArray(body.data) ? body.data.map(resourceView) : []));
    const metadata = isJson(body.list_metadata) ? body.list_metadata : {};
    after = typeof metadata.after === 'string' ? metadata.after : undefined;
    if (after === undefined) return found;
  }
  throw new Error(`The resource list has more than ${MAX_PAGES} pages.`);
}

function listedText(resources: readonly ResourceView[], uri: string): string {
  const gate = resources.some((item) => item.uri === LIVE_GATE_RESOURCE) ? 'the live gate URI is listed' : 'the live gate URI is NOT listed';
  const own = resources.find((item) => item.uri === uri);
  return `${resources.length} resources; ${gate}; ${own === undefined ? `${uri} is not listed` : `${uri} is listed as ${own.id}`}`;
}

export async function ensureResource(context: ProbeContext): Promise<string> {
  const settings = context.secrets.workos;
  const uri = resourceOf(originOf(context, 'tenant'));
  assert.notEqual(uri, LIVE_GATE_RESOURCE, 'The tenant resource must not be the live gate URI.');
  const before = await listResources(settings);
  addRow(context, STEP, { check: `GET ${RESOURCES_PATH}`, expected: 'the live gate URI is listed', measured: listedText(before, uri) });
  assert.ok(before.some((item) => item.uri === LIVE_GATE_RESOURCE), `The live gate URI ${LIVE_GATE_RESOURCE} is not listed. Stop and check the WorkOS Staging environment.`);
  const listed = before.find((item) => item.uri === uri);
  if (listed !== undefined) {
    context.state.resource = { uri, id: listed.id, createdInRun: false };
    return `${uri} was listed as ${listed.id}, from an earlier run; this run does not delete it.`;
  }
  const answer = await workosJson(settings, { method: 'POST', path: RESOURCES_PATH, body: { uri } });
  context.report.workosWrites.push({ step: STEP, call: `POST ${RESOURCES_PATH}`, status: String(answer.status), ms: answer.ms });
  assert.ok(answer.status === 200 || answer.status === 201, `POST ${RESOURCES_PATH} answered ${answer.status}`);
  const created = resourceView(answer.json);
  assert.equal(created.uri, uri, `The created resource has the URI ${created.uri}, not ${uri}`);
  context.state.resource = { uri, id: created.id, createdInRun: true };
  const after = await listResources(settings);
  addRow(context, STEP, { check: `POST ${RESOURCES_PATH}, then GET`, expected: `${uri} added; the live gate URI still listed`, measured: `${answer.status} after ${seconds(answer.ms)}: ${created.id}; ${listedText(after, uri)}` });
  assert.ok(after.some((item) => item.uri === LIVE_GATE_RESOURCE), 'After the create, the live gate URI is not listed.');
  assert.ok(after.some((item) => item.id === created.id), 'After the create, the new resource is not listed.');
  return `registered ${uri} as ${created.id}; the live gate URI is still listed.`;
}

// Only an ID that this run created, and never the live gate URI.
export async function deleteOwnResource(context: ProbeContext): Promise<string> {
  const resource = context.state.resource;
  if (resource === undefined) return 'no resource of this run';
  if (!resource.createdInRun || resource.uri === LIVE_GATE_RESOURCE) return `${resource.uri} (${resource.id}) stays: this run did not create it`;
  const started = performance.now();
  const status = await deleteWorkOSResource(context.secrets.workos, `${RESOURCES_PATH}/${resource.id}`);
  context.report.workosWrites.push({ step: 'Cleanup', call: `DELETE ${RESOURCES_PATH}/${resource.id}`, status: String(status), ms: performance.now() - started });
  assert.ok(status === 200 || status === 202 || status === 204 || status === 404, `DELETE ${RESOURCES_PATH}/${resource.id} answered ${status}`);
  return `deleted ${resource.uri} (${resource.id}): ${status}`;
}

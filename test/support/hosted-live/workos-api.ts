import assert from 'node:assert/strict';
import { requestTimeout, type HostedLiveSettings } from './settings.ts';

type JsonObject = Readonly<Record<string, unknown>>;

const apiOrigin = 'https://api.workos.com';

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function bearer(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}`, Accept: 'application/json' };
}

async function jsonObject(response: Response, request: string): Promise<JsonObject> {
  const body: unknown = await response.json().catch(() => undefined);
  assert.equal(response.status, 200, `${request} gave HTTP ${response.status}: ${JSON.stringify(body)}`);
  assert.ok(isJsonObject(body), `${request} gave no JSON object.`);
  return body;
}

export async function deleteWorkOSResource(settings: HostedLiveSettings, path: string): Promise<number> {
  const response = await fetch(`${apiOrigin}${path}`, { method: 'DELETE', headers: bearer(settings.apiKey), signal: AbortSignal.timeout(requestTimeout) });
  await response.body?.cancel();
  return response.status;
}

export async function queryWidgetGraph(widgetToken: string, query: string): Promise<JsonObject> {
  const response = await fetch(`${apiOrigin}/client/graphql`, {
    method: 'POST',
    headers: { ...bearer(widgetToken), 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
    signal: AbortSignal.timeout(requestTimeout),
  });
  const { data, errors } = await jsonObject(response, 'POST /client/graphql');
  assert.equal(errors, undefined, `The widget GraphQL query gave errors: ${JSON.stringify(errors)}`);
  assert.ok(isJsonObject(data), 'The widget GraphQL query gave no data.');
  return data;
}

export function field(object: JsonObject, name: string): JsonObject {
  const value = object[name];
  assert.ok(isJsonObject(value), `${name} is not a JSON object: ${JSON.stringify(value)}`);
  return value;
}

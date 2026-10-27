import assert from 'node:assert/strict';
import { TEAM_PLAN } from '../render-tenant-lifecycle/calls.ts';
import { addRow } from '../render-tenant-lifecycle/context.ts';
import { changePlan } from '../render-tenant-lifecycle/steps-lifecycle.ts';
import { originOf, sessionOf, type ProbeContext } from './context.ts';
import { createIdentity } from './identity.ts';
import { connectTenant, FETCH_TOOL, SEARCH_TOOL } from './mcp.ts';
import { ensureResource } from './oauth-resource.ts';
import { setupPages } from './origin.ts';
import { healthFromHere } from './services.ts';
import { probeImage, setupTenant } from './tenant.ts';
import { baseUrlOf } from './variables.ts';

async function checkMcp(context: ProbeContext): Promise<string> {
  const tokens = context.state.tokens;
  assert.ok(tokens !== undefined, 'No Connect token: the identity part did not finish.');
  const endpoint = new URL('mcp', baseUrlOf(originOf(context, 'tenant')));
  const client = await connectTenant(endpoint, tokens);
  try {
    const names = (await client.listTools()).tools.map((tool) => tool.name).sort();
    const protocol = client.getNegotiatedProtocolVersion() ?? 'none';
    addRow(context, 'MCP', { check: `initialize and tools/list at ${endpoint.href}`, expected: `${FETCH_TOOL} and ${SEARCH_TOOL}`, measured: `protocol ${protocol}; tools ${names.join(', ')}` });
    assert.ok(names.includes(FETCH_TOOL) && names.includes(SEARCH_TOOL), `tools/list names ${names.join(', ')}`);
    return `MCP protocol ${protocol} lists ${FETCH_TOOL} and ${SEARCH_TOOL}.`;
  } finally {
    await client.close();
  }
}

export async function setup(context: ProbeContext): Promise<string> {
  const pages = await setupPages(context);
  const tenant = await setupTenant(context);
  const resource = await ensureResource(context);
  const uri = context.state.resource?.uri;
  assert.ok(uri !== undefined, 'No OAuth resource: its part did not finish.');
  const identity = await createIdentity(context, uri);
  const mcp = await checkMcp(context);
  return `pages origin: ${pages} Tenant: ${tenant} Resource: ${resource} Identity: ${identity} ${mcp}`;
}

export async function planTeam(context: ProbeContext): Promise<string> {
  const change = await changePlan(sessionOf(context, 'tenant'), TEAM_PLAN, probeImage(context.inputs.image));
  const health = await healthFromHere(context, 'tenant', `Plan ${TEAM_PLAN}`);
  assert.ok(health.ok, `After the plan change, /healthz gave ${health.text}`);
  return `${change} After it, /healthz answered 200 with ok.`;
}

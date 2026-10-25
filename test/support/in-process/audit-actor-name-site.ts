import type { TestContext } from 'node:test';
import { AuditLog } from '../../../src/logs/audit/audit-log.ts';
import { encodeAuditEvent } from '../../../src/logs/audit/otlp-audit-encoding.ts';
import { mcpRequest, rpcResult } from '../drivers/mcp/mcp-http-request.ts';
import { hostedConfig } from '../fixtures/hosted-config.ts';
import { serveWorkOSSite } from './workos-site.ts';

const user = { id: 'user_AUDIT_NAME', email: 'private-email@example.com', firstName: 'Zoë' };
const organizationId = 'org_AUDIT_NAME';

export async function serveAuditActorNameSite(t: TestContext) {
  const records: Record<string, { stringValue?: string }>[] = [];
  const site = await serveWorkOSSite(t, {
    organizations: [organizationId],
    toolOperations: { fetch: async () => 'public page', search: async () => ({ status: 'released', markdown: 'public search' }) },
    audit: new AuditLog({ writeAuditEvent: event => {
      const record = JSON.parse(encodeAuditEvent(event).toString()).resourceLogs[0].scopeLogs[0].logRecords[0];
      records.push(Object.fromEntries(record.attributes.map((attribute: { key: string; value: unknown }) => [attribute.key, attribute.value])));
    } }),
    setUp: world => {
      world.users = [user];
      world.memberships = [{ userId: user.id, organizationId, roles: ['admin'] }];
    },
  });
  const token = await site.world.connectToken(user, { org_id: organizationId, name: 'forged token name' });
  return {
    site, records, user,
    call: (tool: 'search' | 'getURLAsMarkdown') => site.transport(mcpRequest({
      url: hostedConfig.mcpResourceUrl, method: 'tools/call', token,
      headers: { 'X-User-Name': 'forged header name' },
      params: { name: tool, arguments: tool === 'search' ? { query: 'query', reason: 'reason' } : { url: 'https://example.com/', reason: 'reason' }, _meta: { name: 'forged metadata name' } },
    })).then(rpcResult),
  };
}

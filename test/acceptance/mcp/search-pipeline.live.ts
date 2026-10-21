// The separate real-Brave proof: npm run test:mcp:search:live. Ordinary *.test.js gates exclude this file.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assertUsefulLightpandaResult } from '../../support/dsl/search-results.ts';
import { addUser, operatorOn, registerArgs, registeredClientId } from '../../support/dsl/local-commands.ts';
import { connectWithToken, issuedGrants } from '../../support/dsl/local-mcp-user.ts';
import { stepRecordsIn } from '../../support/drivers/operator-log.ts';
import { generatedOperationIdPattern } from '../../support/fixtures/execution-context.ts';
import { InProcessServer } from '../../support/in-process/in-process-server.ts';
import { selfHostedServerSettings } from '../../support/in-process/local-runtime.ts';
import { dataDirectory } from '../../support/isolation/data-directory.ts';
import { assertExit } from '../../support/processes/command-process.ts';
import { pinnedRenderer } from '../../support/processes/pinned-renderer.ts';

const query = 'Lightpanda browser';
const reason = 'Find public information about the Lightpanda browser';

test('Given pinned Lightpanda 1.0.0, real Brave access, and a real local access token, when an MCP client searches, then the real provider, classifier, and cleaners return useful results with safe correlated records', { timeout: 120_000 }, async (t) => {
  const executable = await pinnedRenderer();
  const account = { email: 'live-search@example.com', password: 'live-search-local-password-1' };
  const directory = dataDirectory(t);
  const operator = operatorOn(t, directory);
  assertExit(await addUser(operator, account), 0);
  const clientId = registeredClientId(await operator(registerArgs(account), [account.password]));
  const grant = (await issuedGrants(directory, clientId, [account])).get(account.email);
  assert.ok(grant);
  const server = InProcessServer.open(t);
  await server.start({ ...selfHostedServerSettings(directory), LIGHTPANDA_BIN: executable });
  const client = await connectWithToken(t, { server: server.address, token: () => grant.accessToken });

  // One public request only. A block, unsupported page, or HTTP error must fail this proof.
  const result = await client.callTool({ name: 'search', arguments: { query, reason } });
  const tenant = server.tenant();
  await server.stop();
  const completions = server.completionRecords();
  const stages = stepRecordsIn(server.lines.join('\n'));
  t.diagnostic(JSON.stringify({ date: new Date().toISOString(), lightpandaVersion: '1.0.0', query, result, stages, completions, rendererErrors: server.errorLines() }));

  assert.notEqual(result.isError, true, 'Live Brave search must return success; a provider block is an incomplete proof.');
  assert.equal(result.structuredContent, undefined);
  assert.equal(result.content.length, 1);
  const content = result.content[0];
  assert.equal(content.type, 'text');
  if (content.type !== 'text') throw new Error('Expected Markdown search results');
  assert.ok(content.text.trim().length > 0, 'Search results must not be blank');
  assert.notEqual(content.text, 'No search results.');

  assertUsefulLightpandaResult(content.text);

  assert.equal(completions.length, 1);
  const { operationId, durationMs, ...completion } = completions[0];
  assert.match(operationId as string, generatedOperationIdPattern);
  assert.ok(typeof durationMs === 'number' && Number.isFinite(durationMs) && durationMs >= 0);
  assert.deepEqual(completion, {
    event: 'mcp.tool.completed', authority: `better-auth:${tenant.slice('local:'.length)}`, subject: grant.id,
    tenantId: tenant, tool: 'search', status: 'success',
  });
  assert.deepEqual(stages.map(({ stepId }) => stepId), ['search.outgoing.observe_request', 'search.incoming.process_html']);
  for (const stage of stages) {
    const { durationMs: stageDuration, ...record } = stage;
    assert.ok(Number.isSafeInteger(stageDuration) && (stageDuration as number) >= 0);
    assert.deepEqual(record, { event: 'pipeline.step.completed', operationId, stepId: stage.stepId, outcome: 'allowed' });
  }
  const records = JSON.stringify({ stages, completions });
  assert.ok(!records.includes(query) && !records.includes(reason) && !records.includes('https://'));
  assert.deepEqual(server.errorLines(), []);
});

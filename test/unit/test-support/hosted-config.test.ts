import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { loadDeploymentConfig } from '../../../src/runtime/config/deployment-config.ts';
import { hostedRootConfig } from '../../support/fixtures/hosted-config.ts';

describe('Hosted test configuration of the offline hosted sites', () => {
  test('Given the hosted test configuration at the root of the host, when a test reads it, then it is the hosted edition at the public base URL https://thermus.example/ with the MCP resource https://thermus.example/mcp, and the origin without the slash loads the same values', () => {
    assert.equal(hostedRootConfig.deployment, 'hosted');
    assert.equal(hostedRootConfig.publicBaseUrl, 'https://thermus.example/');
    assert.equal(hostedRootConfig.mcpResourceUrl, 'https://thermus.example/mcp');
    assert.deepEqual(loadDeploymentConfig({ DEPLOYMENT: 'hosted', PUBLIC_BASE_URL: new URL(hostedRootConfig.publicBaseUrl).origin }, 'http'), hostedRootConfig);
  });
});

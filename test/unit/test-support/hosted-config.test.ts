import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { loadDeploymentConfig } from '../../../src/config/deployment-config.ts';
import { hostedConfig, hostedRootConfig } from '../../support/fixtures/hosted-config.ts';

describe('Hosted test configuration of the offline hosted sites', () => {
  test('Given the hosted test configuration, when a test reads it, then it is the hosted edition at the public base URL https://thermus.example/team/, with the slash that the loader adds', () => {
    assert.equal(hostedConfig.deployment, 'hosted');
    assert.equal(hostedConfig.publicBaseUrl, 'https://thermus.example/team/');
  });

  test('Given the hosted test configuration, when a test reads its MCP URLs, then the MCP resource is https://thermus.example/team/mcp, and the resource metadata URL is on the same origin', () => {
    assert.equal(hostedConfig.mcpResourceUrl, 'https://thermus.example/team/mcp');
    assert.equal(new URL(hostedConfig.resourceMetadataUrl).origin, 'https://thermus.example');
  });

  test('Given the hosted test configuration at the root of the host, when a test reads it, then it is the hosted edition at the public base URL https://thermus.example/ with the MCP resource https://thermus.example/mcp, and the origin without the slash loads the same values', () => {
    assert.equal(hostedRootConfig.deployment, 'hosted');
    assert.equal(hostedRootConfig.publicBaseUrl, 'https://thermus.example/');
    assert.equal(hostedRootConfig.mcpResourceUrl, 'https://thermus.example/mcp');
    assert.deepEqual(loadDeploymentConfig({ DEPLOYMENT: 'hosted', PUBLIC_BASE_URL: new URL(hostedRootConfig.publicBaseUrl).origin }, 'http'), hostedRootConfig);
  });
});

import { loadDeploymentConfig } from '../../../src/runtime/config/deployment-config.ts';

// The hosted test configuration: the hosted edition at the public base URL https://thermus.example/team, with MCP over
// HTTP, not stdio. It is a test setting of the hosted environment, not literal test data.
export const hostedConfig = loadDeploymentConfig({ DEPLOYMENT: 'hosted', PUBLIC_BASE_URL: 'https://thermus.example/team' }, 'http');

// The hosted edition at the root of the host. 'https://thermus.example' without the slash loads the same values.
export const hostedRootConfig = loadDeploymentConfig({ DEPLOYMENT: 'hosted', PUBLIC_BASE_URL: 'https://thermus.example/' }, 'http');

import { loadDeploymentConfig } from '../../../src/runtime/config/deployment-config.ts';

export const hostedConfig = loadDeploymentConfig({ DEPLOYMENT: 'hosted', PUBLIC_BASE_URL: 'https://thermus.example/team' }, 'http');

// The hosted edition at the root of the host. 'https://thermus.example' without the slash loads the same values.
export const hostedRootConfig = loadDeploymentConfig({ DEPLOYMENT: 'hosted', PUBLIC_BASE_URL: 'https://thermus.example/' }, 'http');

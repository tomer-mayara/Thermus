import { loadDeploymentConfig } from '../../../src/runtime/config/deployment-config.ts';

export const hostedConfig = loadDeploymentConfig({ DEPLOYMENT: 'hosted', PUBLIC_BASE_URL: 'https://thermus.example/team' }, 'http');

export const hostedRootConfig = loadDeploymentConfig({ DEPLOYMENT: 'hosted', PUBLIC_BASE_URL: 'https://thermus.example/' }, 'http');

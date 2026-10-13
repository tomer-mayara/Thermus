import assert from 'node:assert/strict';
import { openBetterAuthRuntime } from '../../src/auth-better-auth/better-auth-runtime.js';
import { loadDeploymentConfig } from '../../src/config/deployment-config.js';
import { publicBaseUrl } from './better-auth-local.js';
export function selfHostedSettings(directory) {
    return { DEPLOYMENT: 'self-hosted', PUBLIC_BASE_URL: publicBaseUrl, DATA_DIR: directory, LISTEN_HOST: '127.0.0.1', LISTEN_PORT: '0' };
}
export function selfHostedConfig(directory) {
    const config = loadDeploymentConfig(selfHostedSettings(directory), 'http');
    assert.ok(config.deployment === 'self-hosted');
    return config;
}
export async function withRuntime(directory, work) {
    const runtime = await openBetterAuthRuntime(selfHostedConfig(directory));
    try {
        return await work(runtime);
    }
    finally {
        await runtime.close();
    }
}
export function passwordOf(email) {
    return `${email}-password`;
}
export async function addAccount(runtime, email, disabled = false) {
    const { user } = await runtime.auth.api.createUser({ body: { email, password: passwordOf(email), name: email } });
    if (disabled)
        await (await runtime.auth.$context).internalAdapter.updateUser(user.id, { banned: true });
    return user.id;
}
export async function accountsOf(runtime) {
    const users = await (await runtime.auth.$context).internalAdapter.listUsers();
    return users
        .map(({ id, email, banned }) => ({ id, email, disabled: banned === true }))
        .sort((first, second) => first.email.localeCompare(second.email));
}
//# sourceMappingURL=local-runtime.js.map
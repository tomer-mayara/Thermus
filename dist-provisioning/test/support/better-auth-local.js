import { DatabaseSync } from 'node:sqlite';
import { betterAuth } from 'better-auth';
import { applySetCookies } from 'better-auth/cookies';
import { getMigrations } from 'better-auth/db/migration';
import { localProviderOptions } from '../../src/auth-better-auth/better-auth-runtime.js';
import { CLIENT_ADDRESS_HEADER } from '../../src/http/server.js';
export const publicBaseUrl = 'http://localhost:8080';
export const authIssuer = `${publicBaseUrl}/api/auth`;
export const mcpResourceUrl = `${publicBaseUrl}/mcp`;
export const clientAddressHeader = CLIENT_ADDRESS_HEADER;
export const localInstallationId = '0f6c1e9a-4b7d-4e2a-9c35-8d1f2a6b7e40';
export async function startLocalProvider() {
    const database = new DatabaseSync(':memory:');
    try {
        const options = localProviderOptions({
            publicBaseUrl,
            mcpResourceUrl,
            secret: 'interface-test-secret-0123456789abcdef0123456789',
            database,
            installationId: localInstallationId,
        });
        await (await getMigrations(options)).runMigrations();
        return { auth: betterAuth(options), database };
    }
    catch (error) {
        database.close();
        throw error;
    }
}
export async function withRegistrationSession(auth, account, register) {
    const { headers, response } = await auth.api.signInEmail({
        body: { email: account.email, password: account.password },
        returnHeaders: true,
    });
    const sessionHeaders = new Headers();
    applySetCookies(sessionHeaders, headers.getSetCookie());
    try {
        return await register(sessionHeaders);
    }
    finally {
        await (await auth.$context).internalAdapter.deleteSession(response.token);
    }
}
//# sourceMappingURL=better-auth-local.js.map
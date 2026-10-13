import assert from 'node:assert/strict';
import type { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import {
  openBetterAuthRuntime,
  type LocalAuth,
  type LocalAuthResources,
  type LocalProviderSettings,
} from '../../../src/auth/local-auth/better-auth/better-auth-runtime.ts';
import type { DataDirectoryLock } from '../../../src/auth/local-auth/better-auth/data-directory-lock.ts';
import type { LocalInstallation, StoredResourceServerClient } from '../../../src/auth/local-auth/better-auth/local-installation.ts';

const settings = {
  dataDirectory: '/var/lib/magumagu',
  publicBaseUrl: 'http://localhost:8080/',
  mcpResourceUrl: 'http://localhost:8080/mcp',
};
const installationId = '0f6c1e9a-4b7d-4e2a-9c35-8d1f2a6b7e40';
const database = { name: 'database double' } as unknown as DatabaseSync;
const provider = { name: 'provider double' } as unknown as LocalAuth;
const storedClient: StoredResourceServerClient = {
  clientId: 'resource-server-client-id',
  clientSecret: 'resource-server-client-secret',
  resource: 'http://localhost:8080/mcp',
};

interface Failures {
  readonly lock?: Error;
  readonly installation?: Error;
  readonly provider?: Error;
  readonly installationClose?: Error;
  readonly clientRead?: Error;
}

class ResourceDoubles implements LocalAuthResources {
  readonly events: string[] = [];
  readonly providerSettings: LocalProviderSettings[] = [];
  storedClient: StoredResourceServerClient | undefined;
  private readonly failures: Failures;

  constructor(failures: Failures = {}) {
    this.failures = failures;
  }

  lockDataDirectory(directory: string): DataDirectoryLock {
    this.events.push(`lock ${directory}`);
    if (this.failures.lock) throw this.failures.lock;
    return { release: () => { this.events.push('release lock'); } };
  }

  openInstallation(directory: string): LocalInstallation {
    this.events.push(`open installation ${directory}`);
    if (this.failures.installation) throw this.failures.installation;
    return {
      id: installationId,
      secret: 'installation-secret-double',
      database,
      readResourceServerClient: () => {
        if (this.failures.clientRead) throw this.failures.clientRead;
        return this.storedClient;
      },
      writeResourceServerClient: (client) => {
        this.storedClient = client;
      },
      close: () => {
        this.events.push('close installation');
        if (this.failures.installationClose) throw this.failures.installationClose;
      },
    };
  }

  async startProvider(providerSettings: LocalProviderSettings): Promise<LocalAuth> {
    this.events.push('start provider');
    this.providerSettings.push(providerSettings);
    if (this.failures.provider) throw this.failures.provider;
    return provider;
  }
}

test('Given free resources, when the runtime opens, then it locks the data directory, opens the installation, starts the provider with the installation identity, and reports the local tenant', async () => {
  const resources = new ResourceDoubles();

  const runtime = await openBetterAuthRuntime(settings, resources);

  assert.deepEqual(resources.events, ['lock /var/lib/magumagu', 'open installation /var/lib/magumagu', 'start provider']);
  assert.deepEqual(resources.providerSettings, [{
    publicBaseUrl: 'http://localhost:8080/',
    mcpResourceUrl: 'http://localhost:8080/mcp',
    secret: 'installation-secret-double',
    database,
    installationId,
  }]);
  assert.equal(runtime.installationId, installationId);
  assert.equal(runtime.tenantId, `local:${installationId}`);
  assert.equal(runtime.auth, provider);
});

test('Given a data directory that another process uses, when the runtime opens, then the lock error reaches the caller and no installation or provider starts', async () => {
  const lockError = new Error('in use');
  const resources = new ResourceDoubles({ lock: lockError });

  await assert.rejects(openBetterAuthRuntime(settings, resources), (error) => error === lockError);

  assert.deepEqual(resources.events, ['lock /var/lib/magumagu']);
});

test('Given an installation that fails closed, when the runtime opens, then it releases the lock, starts no provider, and the installation error reaches the caller', async () => {
  const installationError = new Error('missing identity');
  const resources = new ResourceDoubles({ installation: installationError });

  await assert.rejects(openBetterAuthRuntime(settings, resources), (error) => error === installationError);

  assert.deepEqual(resources.events, ['lock /var/lib/magumagu', 'open installation /var/lib/magumagu', 'release lock']);
});

test('Given a provider that fails to start, when the runtime opens, then it closes the installation, then releases the lock, and the provider error reaches the caller', async () => {
  const providerError = new Error('schema mismatch');
  const resources = new ResourceDoubles({ provider: providerError });

  await assert.rejects(openBetterAuthRuntime(settings, resources), (error) => error === providerError);

  assert.deepEqual(resources.events.slice(-3), ['start provider', 'close installation', 'release lock']);
});

test('Given a provider failure and an installation that fails to close, when the runtime opens, then it still releases the lock and the caller gets both errors', async () => {
  const providerError = new Error('schema mismatch');
  const closeError = new Error('close failed');
  const resources = new ResourceDoubles({ provider: providerError, installationClose: closeError });

  await assert.rejects(openBetterAuthRuntime(settings, resources), (error) => {
    assert.ok(error instanceof SuppressedError);
    assert.equal(error.error, closeError);
    assert.equal(error.suppressed, providerError);
    return true;
  });

  assert.deepEqual(resources.events.slice(-3), ['start provider', 'close installation', 'release lock']);
});

test('Given an open runtime, when it closes two times, also at the same time, then it closes the installation and then releases the lock one time', async () => {
  const resources = new ResourceDoubles();
  const runtime = await openBetterAuthRuntime(settings, resources);

  await Promise.all([runtime.close(), runtime.close()]);
  await runtime.close();

  assert.deepEqual(resources.events.slice(-2), ['close installation', 'release lock']);
  assert.equal(resources.events.filter((event) => event === 'release lock').length, 1);
});

test('Given an open runtime whose installation fails to close, when it closes, then it still releases the lock and the close error reaches the caller', async () => {
  const closeError = new Error('close failed');
  const resources = new ResourceDoubles({ installationClose: closeError });
  const runtime = await openBetterAuthRuntime(settings, resources);

  await assert.rejects(runtime.close(), (error) => error === closeError);

  assert.deepEqual(resources.events.slice(-2), ['close installation', 'release lock']);
});

test('Given a stored resource-server client for the MCP resource of the runtime, when the runtime gives its resource-server client, then it gives the client ID and secret', async () => {
  const resources = new ResourceDoubles();
  resources.storedClient = storedClient;

  const runtime = await openBetterAuthRuntime(settings, resources);

  assert.deepEqual(runtime.resourceServerClient.current(), { clientId: 'resource-server-client-id', clientSecret: 'resource-server-client-secret' });
});

test('Given no stored resource-server client, or one for another MCP resource, when the runtime gives its resource-server client, then it gives none', async () => {
  for (const stored of [undefined, { ...storedClient, resource: 'http://localhost:9090/mcp' }]) {
    const resources = new ResourceDoubles();
    resources.storedClient = stored;

    const runtime = await openBetterAuthRuntime(settings, resources);

    assert.equal(runtime.resourceServerClient.current(), undefined, stored?.resource);
  }
});

test('Given a resource-server client for another MCP resource, when the runtime records a client, then the installation replaces it with the client for the MCP resource of the runtime, and the runtime gives that client', async () => {
  const resources = new ResourceDoubles();
  resources.storedClient = { clientId: 'other-client-id', clientSecret: 'other-client-secret', resource: 'http://localhost:9090/mcp' };
  const runtime = await openBetterAuthRuntime(settings, resources);

  runtime.resourceServerClient.record({ clientId: 'resource-server-client-id', clientSecret: 'resource-server-client-secret' });

  assert.deepEqual(resources.storedClient, storedClient);
  assert.deepEqual(runtime.resourceServerClient.current(), { clientId: 'resource-server-client-id', clientSecret: 'resource-server-client-secret' });
});

test('Given a resource-server client that the installation cannot read, when the runtime opens, then it opens, and only the resource-server client gives the installation error', async () => {
  const readError = new Error('resource-server client not valid');
  const resources = new ResourceDoubles({ clientRead: readError });

  const runtime = await openBetterAuthRuntime(settings, resources);

  assert.throws(() => runtime.resourceServerClient.current(), (error) => error === readError);
});

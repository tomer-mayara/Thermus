import assert from 'node:assert/strict';
import type { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import {
  localProviderOptions,
  ProviderEnvironmentError,
  type LocalProviderSettings,
} from '../../../src/auth-better-auth/better-auth-runtime.ts';
import { setProcessEnvironment } from '../../support/process-environment.ts';

const settings: LocalProviderSettings = {
  publicBaseUrl: 'http://localhost:8080/',
  mcpResourceUrl: 'http://localhost:8080/mcp',
  secret: 'installation-secret-0123456789abcdef0123456789',
  database: { name: 'database double' } as unknown as DatabaseSync,
  installationId: '0f6c1e9a-4b7d-4e2a-9c35-8d1f2a6b7e40',
};

const refusedVariables = {
  BETTER_AUTH_SECRETS: '1:environment-secret-0123456789abcdef0123456789',
  BETTER_AUTH_TRUSTED_ORIGINS: 'https://foreign-origin.example',
  BETTER_AUTH_TELEMETRY: 'telemetry-from-the-environment',
};

test('Given the local provider settings, when the provider options are built, then they use the installation secret, turn telemetry off, and keep the origin check on', () => {
  const options = localProviderOptions(settings);

  assert.equal(options.secret, settings.secret);
  assert.deepEqual(options.telemetry, { enabled: false });
  assert.equal(options.advanced.disableOriginCheck, false);
});

for (const [variable, value] of Object.entries(refusedVariables)) {
  test(`Given ${variable} with a value in the process environment, when the provider options are built, then they throw ProviderEnvironmentError that names the variable but not its value`, (t) => {
    setProcessEnvironment(t, { [variable]: value });

    assert.throws(() => localProviderOptions(settings), (error: unknown) => {
      assert.ok(error instanceof ProviderEnvironmentError, String(error));
      assert.match(error.message, new RegExp(`\\b${variable}\\b`));
      assert.ok(!error.message.includes(value), error.message);
      return true;
    });
  });
}

test('Given empty values of those variables, NODE_ENV=test, TEST=1, and a telemetry endpoint without BETTER_AUTH_TELEMETRY, when the provider options are built, then no error stops startup', (t) => {
  setProcessEnvironment(t, {
    BETTER_AUTH_SECRETS: '',
    BETTER_AUTH_TRUSTED_ORIGINS: '',
    BETTER_AUTH_TELEMETRY: '',
    BETTER_AUTH_TELEMETRY_ENDPOINT: 'https://telemetry.example/v1/track',
    NODE_ENV: 'test',
    TEST: '1',
  });

  const options = localProviderOptions(settings);

  assert.equal(options.secret, settings.secret);
});

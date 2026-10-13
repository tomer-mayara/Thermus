import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const entry = fileURLToPath(new URL('../../../src/index.js', import.meta.url));
const blocked = 'The test blocked a provider module';
const guard = `import { registerHooks } from 'node:module';
registerHooks({ resolve(specifier, context, nextResolve) {
  const result = nextResolve(specifier, context);
  if (['better-auth-runtime', 'better-auth-user-administration'].some(name => result.url.endsWith('/src/auth/local-auth/better-auth/' + name + '.js'))) {
    throw new Error(${JSON.stringify(blocked)});
  }
  return result;
} });`;
const preload = `data:text/javascript,${encodeURIComponent(guard)}`;

test('Given a provider import guard, when syntax, configuration, or the edition refuses a command, then no provider module loads; an accepted local command reaches the guarded opener', { timeout: 30_000 }, () => {
  const local = { DEPLOYMENT: 'self-hosted', PUBLIC_BASE_URL: 'http://localhost:8080', DATA_DIR: '/var/lib/magumagu' };
  const cases = [
    { args: ['users'], environment: local, code: 2, message: /Unknown command/ },
    { args: ['users', 'list'], environment: { ...local, DATA_DIR: '' }, code: 1, message: /DATA_DIR is required/ },
    { args: ['users', 'list'], environment: { DEPLOYMENT: 'hosted', PUBLIC_BASE_URL: 'https://magumagu.example' }, code: 1, message: /only for DEPLOYMENT=self-hosted/ },
  ];
  for (const { args, environment, code, message } of cases) {
    const result = spawnSync(process.execPath, ['--import', preload, entry, ...args], { env: environment, encoding: 'utf8', timeout: 10_000 });
    assert.equal(result.status, code, result.stderr);
    assert.match(result.stderr, message);
    assert.doesNotMatch(result.stderr, new RegExp(blocked));
    assert.equal(result.stdout, '');
  }
  const control = spawnSync(process.execPath, ['--import', preload, entry, 'users', 'list'], { env: local, encoding: 'utf8', timeout: 10_000 });
  assert.equal(control.status, 1, control.stderr);
  assert.match(control.stderr, new RegExp(blocked));
});

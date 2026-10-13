import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DeploymentConfigError, loadListenAddress } from '../../../src/config/deployment-config.ts';

type Environment = Record<string, string | undefined>;

function assignments(settings: Environment): string {
  return Object.entries(settings).map(([name, value]) => `${name}=${value ?? '(missing)'}`).join(' and ');
}

test('Given no listen settings, when the listen address loads, then it uses the loopback host and port 8080', () => {
  assert.deepEqual(loadListenAddress({}), { host: '127.0.0.1', port: 8080 });
  assert.deepEqual(loadListenAddress({ LISTEN_HOST: '', LISTEN_PORT: '' }), { host: '127.0.0.1', port: 8080 });
});

const listenAddresses: ReadonlyArray<[Environment, { host: string; port: number }]> = [
  [{ LISTEN_HOST: '0.0.0.0', LISTEN_PORT: '3000' }, { host: '0.0.0.0', port: 3000 }],
  [{ LISTEN_HOST: '::1', LISTEN_PORT: '65535' }, { host: '::1', port: 65535 }],
  [{ LISTEN_HOST: 'localhost', LISTEN_PORT: '0' }, { host: 'localhost', port: 0 }],
];
for (const [settings, expected] of listenAddresses) {
  test(`Given ${assignments(settings)}, when the listen address loads, then it returns host ${expected.host} and port ${expected.port}`, () => {
    const address = loadListenAddress(settings);
    assert.deepEqual(address, expected);
    assert.ok(Object.isFrozen(address));
  });
}

for (const port of ['-1', '65536', '80.5', '0x50', '1e3', ' 8080', '8080 ', '+80', 'http']) {
  test(`Given LISTEN_PORT=${JSON.stringify(port)}, when the listen address loads, then it rejects the port without its value`, () => {
    let message = '';
    assert.throws(() => loadListenAddress({ LISTEN_PORT: port }), (error) => {
      assert.ok(error instanceof DeploymentConfigError);
      message = error.message;
      return true;
    });
    assert.equal(message, 'LISTEN_PORT must be a whole number from 0 to 65535.');
  });
}

for (const host of [' 127.0.0.1', '127.0.0.1 ', 'local host', 'localhost\n']) {
  test(`Given LISTEN_HOST=${JSON.stringify(host)}, when the listen address loads, then it rejects the host without its value`, () => {
    assert.throws(() => loadListenAddress({ LISTEN_HOST: host }), {
      name: 'DeploymentConfigError',
      message: 'LISTEN_HOST must not contain spaces or control characters.',
    });
  });
}

test('Given a full environment, when the listen address loads, then it reads only LISTEN_HOST and LISTEN_PORT', (context) => {
  context.mock.property(process, 'env', { LISTEN_HOST: '0.0.0.0', LISTEN_PORT: '9999' });
  const read = new Set<string>();
  const environment = { DEPLOYMENT: 'self-hosted', PUBLIC_BASE_URL: 'https://thermus.example', DATA_DIR: '/var/lib/thermus', LISTEN_PORT: '8443' };
  const settings = new Proxy(environment, {
    get: (target, name) => { read.add(String(name)); return Reflect.get(target, name); },
  });
  assert.deepEqual(loadListenAddress(settings), { host: '127.0.0.1', port: 8443 });
  assert.equal([...read].sort().join(' '), 'LISTEN_HOST LISTEN_PORT');
});

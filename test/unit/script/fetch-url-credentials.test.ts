import assert from 'node:assert/strict';
import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { test, type TestContext } from 'node:test';
import { fetchUrlCredentials } from '../../support/processes/module-paths.ts';
import { holdOAuthStore } from '../../support/processes/oauth-store-process.ts';

const profile = { endpoint: 'https://thermus.example/mcp', issuer: 'https://auth.thermus.example', clientId: 'client-test' };
const ready = { status: 'ready' as const, accessToken: 'private-access-token', refreshToken: 'private-refresh-token', scope: 'openid offline_access', expiresAt: 2_000_000_000_000 };

interface Grant {
  status: 'ready';
  accessToken: string;
  refreshToken?: string;
  scope?: string;
  expiresAt: number;
}

interface Store {
  read(): null | { status: 'login-required' } | Grant;
  markLoginRequired(): void;
  saveReady(value: Omit<Grant, 'status'>): void;
  logout(): void;
}

const { withOAuthStore } = await import(fetchUrlCredentials) as {
  withOAuthStore<T>(binding: typeof profile, operation: (store: Store) => Promise<T>): Promise<T>;
};

async function saveReadyGrant() {
  await withOAuthStore(profile, async (store) => store.saveReady(ready));
}

function privateState(t: TestContext) {
  const state = fs.realpathSync(fs.mkdtempSync(join(tmpdir(), 'thermus-oauth-store-')));
  const previous = process.env.XDG_STATE_HOME;
  process.env.XDG_STATE_HOME = state;
  t.after(() => {
    if (previous === undefined) delete process.env.XDG_STATE_HOME;
    else process.env.XDG_STATE_HOME = previous;
    fs.rmSync(state, { recursive: true, force: true });
  });
  const directory = join(state, 'thermus', 'mcp-fetch');
  return { state, directory, grant: join(directory, 'grant.json'), lock: join(directory, 'grant.lock') };
}

test('Given private OAuth state, when a grant and refresh marker are saved, then later reads retain exact expiry and the marker contains no credential', async (t) => {
  const paths = privateState(t);
  await withOAuthStore(profile, async (store) => {
    assert.equal(store.read(), null);
    store.saveReady(ready);
  });
  await withOAuthStore(profile, async (store) => {
    assert.deepEqual(store.read(), ready);
    store.markLoginRequired();
    assert.deepEqual(store.read(), { status: 'login-required' });
  });
  assert.doesNotMatch(fs.readFileSync(paths.grant, 'utf8'), /private-access-token|private-refresh-token/);
  assert.equal(fs.statSync(paths.directory).mode & 0o777, 0o700);
  for (const file of [paths.grant, paths.lock]) assert.equal(fs.statSync(file).mode & 0o777, 0o600);
});

test('Given a local grant, when logout runs repeatedly, then it removes credentials and retains the same lock inode', async (t) => {
  const paths = privateState(t);
  await saveReadyGrant();
  const inode = fs.statSync(paths.lock).ino;
  for (let repeat = 0; repeat < 2; repeat++) {
    await withOAuthStore(profile, async (store) => {
      store.logout();
      assert.equal(store.read(), null);
    });
    assert.equal(fs.existsSync(paths.grant), false);
    assert.equal(fs.statSync(paths.lock).ino, inode);
  }
});

test('Given a ready record without refresh credentials, when it is saved and loaded, then no token or expiry is invented', async (t) => {
  privateState(t);
  const accessOnly = { status: 'ready' as const, accessToken: 'access-only', expiresAt: 1 };
  await withOAuthStore(profile, async (store) => store.saveReady(accessOnly));
  await withOAuthStore(profile, async (store) => assert.deepEqual(store.read(), accessOnly));
});

test('Given a crash temporary file and an unrelated file, when logout opens the store, then it removes owned credentials and keeps unrelated bytes and the lock inode', async (t) => {
  const paths = privateState(t);
  await saveReadyGrant();
  const temporary = join(paths.directory, '.grant-00000000-0000-4000-8000-000000000000.tmp');
  const unrelated = join(paths.directory, 'notes.txt');
  fs.writeFileSync(temporary, 'private-orphan-refresh', { mode: 0o600 });
  fs.writeFileSync(unrelated, 'operator note', { mode: 0o600 });
  const inode = fs.statSync(paths.lock).ino;
  await withOAuthStore(profile, async (store) => store.logout());
  assert.equal(fs.existsSync(temporary), false);
  assert.equal(fs.existsSync(paths.grant), false);
  assert.equal(fs.readFileSync(unrelated, 'utf8'), 'operator note');
  assert.equal(fs.statSync(paths.lock).ino, inode);
});

test('Given a symbolic link with a reserved temporary name, when the store opens, then it refuses without following or deleting that link', async (t) => {
  const paths = privateState(t);
  await withOAuthStore(profile, async () => undefined);
  const destination = join(paths.state, 'untouched');
  fs.writeFileSync(destination, 'private-outside-data', { mode: 0o600 });
  const temporary = join(paths.directory, '.grant-00000000-0000-4000-8000-000000000000.tmp');
  fs.symlinkSync(destination, temporary);
  await assert.rejects(withOAuthStore(profile, async (store) => store.read()), /storage|safe|permission/i);
  assert.equal(fs.lstatSync(temporary).isSymbolicLink(), true);
  assert.equal(fs.readFileSync(destination, 'utf8'), 'private-outside-data');
});

test('Given an operation that has ended, when a retained store handle tries to write, then it cannot change credentials outside its lock', async (t) => {
  privateState(t);
  const closed = await withOAuthStore(profile, async (store) => store);
  assert.throws(() => closed.saveReady(ready), /closed|operation|lock/i);
  await withOAuthStore(profile, async (store) => assert.equal(store.read(), null));
});

for (const [name, alter] of [
  ['unknown version', (record: Record<string, unknown>) => { record.version = 99; }],
  ['different binding', (record: Record<string, unknown>) => { record.binding = { ...profile, clientId: 'other-client' }; }],
  ['unrecognized binding field', (record: Record<string, unknown>) => { record.binding = { ...profile, name: 'private-profile' }; }],
  ['header text in access token', (record: Record<string, unknown>) => { record.accessToken = 'private-token\nHeader: value'; }],
  ['oversized refresh token', (record: Record<string, unknown>) => { record.refreshToken = 'x'.repeat(65_537); }],
  ['oversized scope', (record: Record<string, unknown>) => { record.scope = 'x'.repeat(65_537); }],
  ['invalid expiry', (record: Record<string, unknown>) => { record.expiresAt = 'tomorrow'; }],
  ['unsupported expiry range', (record: Record<string, unknown>) => { record.expiresAt = 8_640_000_000_000_001; }],
] as const) {
  test(`Given ${name} in a saved record, when the store reads it, then it refuses with a safe local login diagnostic`, async (t) => {
    const paths = privateState(t);
    await saveReadyGrant();
    const record = JSON.parse(fs.readFileSync(paths.grant, 'utf8')) as Record<string, unknown>;
    alter(record);
    fs.writeFileSync(paths.grant, JSON.stringify(record));
    await assert.rejects(withOAuthStore(profile, async (store) => store.read()), (error: Error) => {
      assert.match(error.message, /login|credential/i);
      assert.doesNotMatch(error.message, /private-|Header:|other-client|tomorrow/);
      return true;
    });
  });
}

test('Given a relative state path, when OAuth storage opens, then it refuses before creating a cache', async (t) => {
  privateState(t);
  process.env.XDG_STATE_HOME = 'relative-state';
  await assert.rejects(withOAuthStore(profile, async () => undefined), /absolute|state|storage/i);
});

test('Given a filesystem that cannot sync new directory entries, when the store opens, then it stops before authentication can start', async (t) => {
  privateState(t);
  const originalSync = fs.fsyncSync;
  let called = false;
  t.mock.method(fs, 'fsyncSync', (fd: number) => {
    if (fs.fstatSync(fd).isDirectory()) throw new Error('private-sync-fault');
    originalSync(fd);
  });
  syncBuiltinESMExports();
  try {
    await assert.rejects(withOAuthStore(profile, async () => { called = true; }), /storage|permission/i);
    assert.equal(called, false);
  } finally {
    t.mock.restoreAll();
    syncBuiltinESMExports();
  }
});

for (const target of ['directory', 'grant', 'lock'] as const) {
  test(`Given a symlink at the OAuth ${target}, when the store opens it, then the target is not read or changed`, async (t) => {
    const paths = privateState(t);
    await saveReadyGrant();
    const destination = join(paths.state, 'untouched');
    const location = paths[target];
    fs.renameSync(location, destination);
    fs.symlinkSync(destination, location);
    const before = target === 'directory' ? fs.readdirSync(destination) : fs.readFileSync(destination);
    await assert.rejects(withOAuthStore(profile, async (store) => store.read()), /permission|safe|symbolic|symlink|storage/i);
    const after = target === 'directory' ? fs.readdirSync(destination) : fs.readFileSync(destination);
    assert.deepEqual(after, before);
  });
}

for (const target of ['directory', 'grant', 'lock'] as const) {
  test(`Given public permissions on the OAuth ${target}, when the store opens it, then it refuses instead of silently changing permissions`, async (t) => {
    const paths = privateState(t);
    await saveReadyGrant();
    fs.chmodSync(paths[target], target === 'directory' ? 0o755 : 0o644);
    await assert.rejects(withOAuthStore(profile, async (store) => store.read()), /permission|safe|storage/i);
    assert.equal(fs.statSync(paths[target]).mode & 0o777, target === 'directory' ? 0o755 : 0o644);
  });
}

for (const failDirectorySync of [false, true]) {
  test(`Given a ${failDirectorySync ? 'directory' : 'file'} sync failure, when replacement is attempted, then the failed run stops and disk holds only the ${failDirectorySync ? 'new validated' : 'previous'} record`, async (t) => {
    const paths = privateState(t);
    await saveReadyGrant();
    const replacement = { ...ready, accessToken: 'new-access-token', refreshToken: 'new-refresh-token' };
    const originalSync = fs.fsyncSync;
    await withOAuthStore(profile, async (store) => {
      t.mock.method(fs, 'fsyncSync', (fd: number) => {
        if (fs.fstatSync(fd).isDirectory() === failDirectorySync) throw new Error('private-fault-payload');
        originalSync(fd);
      });
      syncBuiltinESMExports();
      try {
        assert.throws(() => store.saveReady(replacement), (error: Error) => {
          assert.match(error.message, /save|storage|credential|write/i);
          assert.doesNotMatch(error.message, /private-|new-refresh-token/);
          return true;
        });
      } finally {
        t.mock.restoreAll();
        syncBuiltinESMExports();
      }
      assert.deepEqual(store.read(), failDirectorySync ? replacement : ready);
    });
    assert.deepEqual(fs.readdirSync(paths.directory).sort(), ['grant.json', 'grant.lock']);
  });
}

for (const saved of ['marker', 'ready', 'temporary'] as const) {
  test(`Given a process killed at the ${saved} boundary, when another process uses the store, then the OS releases the lock and only the committed record remains`, { timeout: 10_000 }, async (t) => {
    const paths = privateState(t);
    const owner = await holdOAuthStore(t, { state: paths.state, profile, boundary: saved });
    await assert.rejects(withOAuthStore(profile, async (store) => store.read()), /busy|in use|progress|another/i);
    await owner.stop();
    await withOAuthStore(profile, async (store) => {
      assert.deepEqual(store.read(), saved === 'ready' ? { status: 'ready', accessToken: 'new-access', refreshToken: 'new-refresh', expiresAt: 2_000_000_000_000 } : { status: 'login-required' });
    });
    assert.doesNotMatch(fs.readFileSync(paths.grant, 'utf8'), /old-refresh/);
    assert.deepEqual(fs.readdirSync(paths.directory).sort(), ['grant.json', 'grant.lock']);
  });
}

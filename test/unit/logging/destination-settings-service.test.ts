import assert from 'node:assert/strict';
import test from 'node:test';
import { DestinationSettingsService } from '../../../src/logs/audit/destination-settings-service.ts';
import type { DestinationSettingsStore, StoredDestinationSettings } from '../../../src/logs/audit/destination-settings-store.ts';

const key = Buffer.alloc(32, 7);
const input = { expectedRevision: null as string | null, endpoint: 'https://collector.example/v1/logs', auth: 'bearer' as const, enabled: true, token: 'private-token' };

function storeFake() {
  const rows = new Map<string, StoredDestinationSettings>();
  let writes = 0;
  const store: DestinationSettingsStore = {
    async read(tenant) { const settings = rows.get(tenant); return settings ? { status: 'found', settings } : { status: 'absent' }; },
    async save(tenant, expected, desired) {
      const current = rows.get(tenant);
      if ((current?.revision ?? null) !== expected) return { status: 'conflict' };
      if (current && JSON.stringify(desired) === JSON.stringify({ endpoint: current.endpoint, auth: current.auth, enabled: current.enabled, encryptedCredential: current.encryptedCredential })) return { status: 'unchanged', settings: current };
      const settings = { ...desired, revision: `revision-${++writes}` };
      rows.set(tenant, settings);
      return { status: 'saved', settings };
    },
  };
  return { store, rows, writes: () => writes };
}

test('Given absent settings, when read, then the destination starts disabled without a credential', async () => {
  const service = new DestinationSettingsService(storeFake().store, key);
  assert.deepEqual(await service.read('tenant-a'), { status: 'absent', settings: { revision: null, endpoint: '', auth: 'none', enabled: false, tokenPresent: false } });
});

test('Given a bearer destination, when saved and reread, then only token presence is public and the ciphertext is tenant bound', async () => {
  const fake = storeFake();
  const service = new DestinationSettingsService(fake.store, key);
  assert.equal((await service.save('tenant-a', input)).status, 'saved');
  const result = await service.read('tenant-a');
  assert.deepEqual(result, { status: 'found', settings: { revision: 'revision-1', endpoint: input.endpoint, auth: 'bearer', enabled: true, tokenPresent: true } });
  assert.ok(!JSON.stringify([...fake.rows.values()]).includes(input.token));
  fake.rows.set('tenant-b', fake.rows.get('tenant-a')!);
  assert.deepEqual(await service.read('tenant-b'), { status: 'unavailable' });
});

for (const endpoint of ['http://collector.example', 'https://user:secret@collector.example', 'https://collector.example/?secret', 'https://collector.example/#secret', 'https://127.1', 'https://10.1.1.1', 'https://172.16.0.1', 'https://192.168.0.1', 'https://169.254.169.254', 'https://[::1]', 'https://[::ffff:127.0.0.1]', 'https://localhost', 'https://a.localhost', 'https://192.0.0.1', 'https://192.0.2.1', 'https://198.51.100.1', 'https://203.0.113.1']) {
  test(`Given unsafe endpoint ${endpoint}, when saved, then all settings are refused`, async () => {
    const fake = storeFake();
    assert.deepEqual(await new DestinationSettingsService(fake.store, key).save('tenant-a', { ...input, endpoint }), { status: 'invalid', reason: 'endpoint' });
    assert.equal(fake.writes(), 0);
  });
}

test('Given saved Bearer, when the same token or a blank token is saved, then its ciphertext and revision are preserved', async () => {
  const fake = storeFake();
  const service = new DestinationSettingsService(fake.store, key);
  await service.save('tenant-a', input);
  const ciphertext = fake.rows.get('tenant-a')?.encryptedCredential;
  for (const token of [input.token, '']) {
    assert.equal((await service.save('tenant-a', { ...input, expectedRevision: 'revision-1', token })).status, 'unchanged');
    assert.equal(fake.rows.get('tenant-a')?.encryptedCredential, ciphertext);
  }
});

test('Given saved Bearer, when endpoint changes without a token, then Save refuses; None clears the credential', async () => {
  const fake = storeFake();
  const service = new DestinationSettingsService(fake.store, key);
  await service.save('tenant-a', input);
  assert.deepEqual(await service.save('tenant-a', { ...input, expectedRevision: 'revision-1', endpoint: 'https://other.example', token: '' }), { status: 'invalid', reason: 'token' });
  assert.equal((await service.save('tenant-a', { ...input, expectedRevision: 'revision-1', auth: 'none', token: '' })).status, 'saved');
  assert.equal(fake.rows.get('tenant-a')?.encryptedCredential, null);
});

test('Given invalid token or missing Bearer, when saved, then no write occurs', async () => {
  for (const token of ['', 'bad\r\ntoken', 'bad\u0000token', 'a'.repeat(8193)]) {
    const fake = storeFake();
    assert.deepEqual(await new DestinationSettingsService(fake.store, key).save('tenant-a', { ...input, token }), { status: 'invalid', reason: 'token' });
    assert.equal(fake.writes(), 0);
  }
});

test('Given corrupt or wrong-key credentials, when read or saved, then only a safe unavailable outcome escapes', async () => {
  const fake = storeFake();
  const service = new DestinationSettingsService(fake.store, key);
  await service.save('tenant-a', input);
  const wrongKey = new DestinationSettingsService(fake.store, Buffer.alloc(32, 8));
  assert.deepEqual(await wrongKey.read('tenant-a'), { status: 'unavailable' });
  assert.deepEqual(await wrongKey.save('tenant-a', { ...input, expectedRevision: 'revision-1' }), { status: 'unavailable' });
  const current = fake.rows.get('tenant-a')!;
  fake.rows.set('tenant-a', { ...current, encryptedCredential: `${current.encryptedCredential!.slice(0, 5)}AAAA` });
  assert.deepEqual(await service.read('tenant-a'), { status: 'unavailable' });
  assert.deepEqual(await service.save('tenant-a', { ...input, expectedRevision: 'revision-1', auth: 'none' }), { status: 'unavailable' });
});

test('Given two forms with one revision, when saved concurrently, then one wins and the stale form cannot replace it', async () => {
  const fake = storeFake();
  const service = new DestinationSettingsService(fake.store, key);
  const results = await Promise.all([service.save('tenant-a', input), service.save('tenant-a', { ...input, token: 'other-token' })]);
  assert.deepEqual(results.map(result => result.status).sort(), ['conflict', 'saved']);
  assert.equal(fake.writes(), 1);
});

test('Given input changes while storage is pending, when Save completes, then it uses the submitted snapshot', async () => {
  const fake = storeFake();
  let release!: () => void;
  const wait = new Promise<void>(resolve => { release = resolve; });
  const service = new DestinationSettingsService({ ...fake.store, async read(tenant) { await wait; return fake.store.read(tenant); } }, key);
  const submitted = { ...input };
  const pending = service.save('tenant-a', submitted);
  submitted.endpoint = 'https://attacker.example';
  submitted.token = 'changed-after-submit';
  release();
  assert.equal((await pending).status, 'saved');
  assert.equal(fake.rows.get('tenant-a')?.endpoint, input.endpoint);
  assert.equal((await service.save('tenant-a', { ...input, expectedRevision: 'revision-1' })).status, 'unchanged');
});

test('Given an unconfirmed Save with a late commit, when a reloaded form competes, then the expected revision prevents replacement', async () => {
  const fake = storeFake();
  let lateCommit!: () => Promise<unknown>;
  let uncertain = true;
  const service = new DestinationSettingsService({
    read: tenant => fake.store.read(tenant),
    async save(tenant, revision, desired) {
      if (!uncertain) return fake.store.save(tenant, revision, desired);
      uncertain = false;
      lateCommit = () => fake.store.save(tenant, revision, desired);
      return { status: 'unconfirmed' };
    },
  }, key);
  assert.deepEqual(await service.save('tenant-a', input), { status: 'unconfirmed' });
  assert.equal((await service.read('tenant-a')).status, 'absent');
  await lateCommit();
  assert.deepEqual(await service.save('tenant-a', { ...input, token: 'competing-token' }), { status: 'conflict' });
  assert.equal(fake.writes(), 1);
});

test('Given a competing commit before the late Save, when that late Save resumes, then it loses its stale revision', async () => {
  const fake = storeFake();
  let lateCommit!: () => Promise<unknown>;
  const uncertain = new DestinationSettingsService({
    read: tenant => fake.store.read(tenant),
    async save(tenant, revision, desired) { lateCommit = () => fake.store.save(tenant, revision, desired); return { status: 'unconfirmed' }; },
  }, key);
  assert.deepEqual(await uncertain.save('tenant-a', input), { status: 'unconfirmed' });
  const competing = new DestinationSettingsService(fake.store, key);
  assert.equal((await competing.save('tenant-a', { ...input, token: 'competing-token' })).status, 'saved');
  assert.deepEqual(await lateCommit(), { status: 'conflict' });
  assert.equal(fake.writes(), 1);
});

for (const endpoint of ['https://[2::1]', 'https:collector.example']) {
  test(`Given invalid public HTTPS syntax ${endpoint}, when saved, then no settings change`, async () => {
    assert.deepEqual(await new DestinationSettingsService(storeFake().store, key).save('tenant-a', { ...input, endpoint }), { status: 'invalid', reason: 'endpoint' });
  });
}

for (const token of ['two tokens', 'snowman-☃', '\tsecret']) {
  test('Given a token that cannot form one Bearer header value, when saved, then no settings change', async () => {
    assert.deepEqual(await new DestinationSettingsService(storeFake().store, key).save('tenant-a', { ...input, token }), { status: 'invalid', reason: 'token' });
  });
}

test('Given storage throws private diagnostics, when read or saved, then safe failure outcomes leave the owner', async () => {
  const fake = storeFake();
  const failingRead: DestinationSettingsStore = { ...fake.store, async read() { throw new Error('private database secret'); } };
  const readService = new DestinationSettingsService(failingRead, key);
  assert.deepEqual(await readService.read('tenant-a'), { status: 'unavailable' });
  assert.deepEqual(await readService.save('tenant-a', input), { status: 'unavailable' });
  const saveService = new DestinationSettingsService({ ...fake.store, async save() { throw new Error('private database secret'); } }, key);
  assert.deepEqual(await saveService.save('tenant-a', input), { status: 'unconfirmed' });
});

test('Given malformed stored settings, when read or saved, then no configured values escape and no update occurs', async () => {
  const fake = storeFake();
  const service = new DestinationSettingsService(fake.store, key);
  await service.save('tenant-a', input);
  const current = fake.rows.get('tenant-a')!;
  for (const invalid of [
    { endpoint: 'https://secret:password@collector.example' },
    { auth: 'unexpected' }, { enabled: 'true' }, { revision: '' },
  ]) {
    fake.rows.set('tenant-a', { ...current, ...invalid } as StoredDestinationSettings);
    assert.deepEqual(await service.read('tenant-a'), { status: 'unavailable' });
    assert.deepEqual(await service.save('tenant-a', { ...input, expectedRevision: 'revision-1' }), { status: 'unavailable' });
  }
});

test('Given an empty userinfo marker in an endpoint, when saved, then the endpoint is refused', async () => {
  assert.deepEqual(await new DestinationSettingsService(storeFake().store, key).save('tenant-a', { ...input, endpoint: 'https://@collector.example' }), { status: 'invalid', reason: 'endpoint' });
});

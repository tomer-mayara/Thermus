import assert from 'node:assert/strict';
import test from 'node:test';
import { DestinationSettingsService } from '../../../src/logs/audit/destination-settings-service.ts';
import type { DestinationTestSender } from '../../../src/logs/audit/destination-test.ts';
import type { DestinationSettingsStore, StoredDestinationSettings } from '../../../src/logs/audit/destination-settings-store.ts';

const senderStub: DestinationTestSender = { send: async () => { throw new Error('Read and Save must not send.'); } };

const key = Buffer.alloc(32, 7);
const input = { expectedRevision: null as string | null, endpoint: 'https://collector.example/v1/logs', auth: 'bearer' as const, enabled: true, token: 'private-token' };

test('Given an Axiom dataset, when saved and read, then the dataset is public and its credential remains private', async () => {
  const fake = storeFake();
  const service = new DestinationSettingsService(fake.store, key, senderStub);
  const axiom = { ...input, axiomDataset: 'audit-log-test' };
  assert.deepEqual(await service.save('tenant-a', axiom), { status: 'saved', settings: { revision: 'revision-1', endpoint: input.endpoint, auth: 'bearer', enabled: true, tokenPresent: true, tokenPreview: 'priv****', axiomDataset: axiom.axiomDataset } });
  assert.deepEqual(await service.authorizeExport('tenant-a', 'revision-1'), { status: 'ready', destination: { endpoint: input.endpoint, auth: { type: 'bearer', token: input.token }, axiomDataset: axiom.axiomDataset } });
  assert.ok(!JSON.stringify([...fake.rows.values()]).includes(input.token));
});

test('Given an invalid Axiom dataset, when saved, then no settings are written', async () => {
  for (const axiomDataset of ['bad\r\nX-Injected: value', 'two words', 'audit_test', 'audit.test', 'ü', 'x'.repeat(129), 42, null]) {
    const fake = storeFake();
    const desired = { ...input, axiomDataset };
    assert.deepEqual(await new DestinationSettingsService(fake.store, key, senderStub).save('tenant-a', desired as typeof input), { status: 'invalid', reason: 'dataset' });
    assert.equal(fake.writes(), 0);
  }
});

test('Given a blank or omitted Axiom dataset, when saved, then a generic Collector has no dataset header', async () => {
  for (const axiomDataset of ['', undefined]) {
    const fake = storeFake();
    const desired = { ...input, axiomDataset };
    const service = new DestinationSettingsService(fake.store, key, senderStub);
    assert.equal((await service.save('tenant-a', desired)).status, 'saved');
    assert.deepEqual(await service.authorizeExport('tenant-a', 'revision-1'), { status: 'ready', destination: { endpoint: input.endpoint, auth: { type: 'bearer', token: input.token } } });
  }
});

test('Given a saved Axiom dataset, when it is repeated or cleared, then only clearing advances the revision and the saved token is retained', async () => {
  const fake = storeFake();
  const service = new DestinationSettingsService(fake.store, key, senderStub);
  await service.save('tenant-a', { ...input, axiomDataset: 'audit-log-test' });
  const ciphertext = fake.rows.get('tenant-a')?.encryptedCredential;
  assert.equal((await service.save('tenant-a', { ...input, expectedRevision: 'revision-1', axiomDataset: 'audit-log-test', token: '' })).status, 'unchanged');
  assert.equal((await service.save('tenant-a', { ...input, expectedRevision: 'revision-1', axiomDataset: '', token: '' })).status, 'saved');
  assert.equal(fake.rows.get('tenant-a')?.encryptedCredential, ciphertext);
  assert.deepEqual(await service.authorizeExport('tenant-a', 'revision-1'), { status: 'changed' });
  assert.deepEqual(await service.authorizeExport('tenant-a', 'revision-2'), { status: 'ready', destination: { endpoint: input.endpoint, auth: { type: 'bearer', token: input.token } } });
});

function storeFake() {
  const rows = new Map<string, StoredDestinationSettings>();
  let writes = 0;
  const store: DestinationSettingsStore = {
    async read(tenant) { const settings = rows.get(tenant); return settings ? { status: 'found', settings } : { status: 'absent' }; },
    async save(tenant, expected, desired) {
      const current = rows.get(tenant);
      if ((current?.revision ?? null) !== expected) return { status: 'conflict' };
      if (current && desired.endpoint === current.endpoint && desired.axiomDataset === current.axiomDataset && desired.auth === current.auth && desired.enabled === current.enabled && desired.encryptedCredential === current.encryptedCredential) return { status: 'unchanged', settings: current };
      const settings = { ...desired, revision: `revision-${++writes}` };
      rows.set(tenant, settings);
      return { status: 'saved', settings };
    },
  };
  return { store, rows, writes: () => writes };
}

test('Given absent settings, when read, then the destination starts disabled without a credential', async () => {
  const service = new DestinationSettingsService(storeFake().store, key, senderStub);
  assert.deepEqual(await service.read('tenant-a'), { status: 'absent', settings: { revision: null, endpoint: '', auth: 'none', enabled: false, tokenPresent: false } });
});

test('Given a bearer destination, when saved and reread, then only token presence and its masked prefix are public and ciphertext is tenant bound', async () => {
  const fake = storeFake();
  const service = new DestinationSettingsService(fake.store, key, senderStub);
  assert.equal((await service.save('tenant-a', input)).status, 'saved');
  const result = await service.read('tenant-a');
  assert.deepEqual(result, { status: 'found', settings: { revision: 'revision-1', endpoint: input.endpoint, auth: 'bearer', enabled: true, tokenPresent: true, tokenPreview: 'priv****' } });
  assert.ok(!JSON.stringify([...fake.rows.values()]).includes(input.token));
  const saved = fake.rows.get('tenant-a');
  assert.ok(saved);
  fake.rows.set('tenant-b', saved);
  assert.deepEqual(await service.read('tenant-b'), { status: 'unavailable' });
});

for (const endpoint of ['http://collector.example', 'https://user:secret@collector.example', 'https://collector.example/?secret', 'https://collector.example/#secret', 'https://127.1', 'https://10.1.1.1', 'https://172.16.0.1', 'https://192.168.0.1', 'https://169.254.169.254', 'https://[::1]', 'https://[::ffff:127.0.0.1]', 'https://localhost', 'https://a.localhost', 'https://192.0.0.1', 'https://192.0.2.1', 'https://198.51.100.1', 'https://203.0.113.1']) {
  test(`Given unsafe endpoint ${endpoint}, when saved, then all settings are refused`, async () => {
    const fake = storeFake();
    assert.deepEqual(await new DestinationSettingsService(fake.store, key, senderStub).save('tenant-a', { ...input, endpoint }), { status: 'invalid', reason: 'endpoint' });
    assert.equal(fake.writes(), 0);
  });
}

test('Given saved Bearer, when the same token or a blank token is saved, then its ciphertext and revision are preserved', async () => {
  const fake = storeFake();
  const service = new DestinationSettingsService(fake.store, key, senderStub);
  await service.save('tenant-a', input);
  const ciphertext = fake.rows.get('tenant-a')?.encryptedCredential;
  for (const token of [input.token, '']) {
    assert.equal((await service.save('tenant-a', { ...input, expectedRevision: 'revision-1', token })).status, 'unchanged');
    assert.equal(fake.rows.get('tenant-a')?.encryptedCredential, ciphertext);
  }
});

test('Given saved Bearer, when endpoint changes without a token, then Save refuses; None clears the credential', async () => {
  const fake = storeFake();
  const service = new DestinationSettingsService(fake.store, key, senderStub);
  await service.save('tenant-a', input);
  assert.deepEqual(await service.save('tenant-a', { ...input, expectedRevision: 'revision-1', endpoint: 'https://other.example', token: '' }), { status: 'invalid', reason: 'token' });
  assert.equal((await service.save('tenant-a', { ...input, expectedRevision: 'revision-1', auth: 'none', token: '' })).status, 'saved');
  assert.equal(fake.rows.get('tenant-a')?.encryptedCredential, null);
});

test('Given invalid token or missing Bearer, when saved, then no write occurs', async () => {
  for (const token of ['', 'bad\r\ntoken', 'bad\u0000token', 'a'.repeat(8193)]) {
    const fake = storeFake();
    assert.deepEqual(await new DestinationSettingsService(fake.store, key, senderStub).save('tenant-a', { ...input, token }), { status: 'invalid', reason: 'token' });
    assert.equal(fake.writes(), 0);
  }
});

test('Given corrupt or wrong-key credentials, when read or saved, then only a safe unavailable outcome escapes', async () => {
  const fake = storeFake();
  const service = new DestinationSettingsService(fake.store, key, senderStub);
  await service.save('tenant-a', input);
  const wrongKey = new DestinationSettingsService(fake.store, Buffer.alloc(32, 8), senderStub);
  assert.deepEqual(await wrongKey.read('tenant-a'), { status: 'unavailable' });
  assert.deepEqual(await wrongKey.save('tenant-a', { ...input, expectedRevision: 'revision-1' }), { status: 'unavailable' });
  const current = fake.rows.get('tenant-a');
  assert.ok(current?.encryptedCredential);
  fake.rows.set('tenant-a', { ...current, encryptedCredential: `${current.encryptedCredential.slice(0, 5)}AAAA` });
  assert.deepEqual(await service.read('tenant-a'), { status: 'unavailable' });
  assert.deepEqual(await service.save('tenant-a', { ...input, expectedRevision: 'revision-1', auth: 'none' }), { status: 'unavailable' });
});

test('Given two forms with one revision, when saved concurrently, then one wins and the stale form cannot replace it', async () => {
  const fake = storeFake();
  const service = new DestinationSettingsService(fake.store, key, senderStub);
  const results = await Promise.all([service.save('tenant-a', input), service.save('tenant-a', { ...input, token: 'other-token' })]);
  assert.deepEqual(results.map(result => result.status).sort(), ['conflict', 'saved']);
  assert.equal(fake.writes(), 1);
});

test('Given input changes while storage is pending, when Save completes, then it uses the submitted snapshot', async () => {
  const fake = storeFake();
  let release!: () => void;
  const wait = new Promise<void>(resolve => { release = resolve; });
  const service = new DestinationSettingsService({ ...fake.store, async read(tenant) { await wait; return fake.store.read(tenant); } }, key, senderStub);
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
  }, key, senderStub);
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
  }, key, senderStub);
  assert.deepEqual(await uncertain.save('tenant-a', input), { status: 'unconfirmed' });
  const competing = new DestinationSettingsService(fake.store, key, senderStub);
  assert.equal((await competing.save('tenant-a', { ...input, token: 'competing-token' })).status, 'saved');
  assert.deepEqual(await lateCommit(), { status: 'conflict' });
  assert.equal(fake.writes(), 1);
});

for (const endpoint of ['https://[2::1]', 'https:collector.example']) {
  test(`Given invalid public HTTPS syntax ${endpoint}, when saved, then no settings change`, async () => {
    assert.deepEqual(await new DestinationSettingsService(storeFake().store, key, senderStub).save('tenant-a', { ...input, endpoint }), { status: 'invalid', reason: 'endpoint' });
  });
}

for (const token of ['two tokens', 'snowman-☃', '\tsecret']) {
  test('Given a token that cannot form one Bearer header value, when saved, then no settings change', async () => {
    assert.deepEqual(await new DestinationSettingsService(storeFake().store, key, senderStub).save('tenant-a', { ...input, token }), { status: 'invalid', reason: 'token' });
  });
}

test('Given storage throws private diagnostics, when read or saved, then safe failure outcomes leave the owner', async () => {
  const fake = storeFake();
  const failingRead: DestinationSettingsStore = { ...fake.store, async read() { throw new Error('private database secret'); } };
  const readService = new DestinationSettingsService(failingRead, key, senderStub);
  assert.deepEqual(await readService.read('tenant-a'), { status: 'unavailable' });
  assert.deepEqual(await readService.save('tenant-a', input), { status: 'unavailable' });
  const saveService = new DestinationSettingsService({ ...fake.store, async save() { throw new Error('private database secret'); } }, key, senderStub);
  assert.deepEqual(await saveService.save('tenant-a', input), { status: 'unconfirmed' });
});

test('Given malformed stored settings, when read or saved, then no configured values escape and no update occurs', async () => {
  const fake = storeFake();
  const service = new DestinationSettingsService(fake.store, key, senderStub);
  await service.save('tenant-a', input);
  const current = fake.rows.get('tenant-a');
  assert.ok(current);
  for (const invalid of [
    { endpoint: 'https://secret:password@collector.example' },
    { auth: 'unexpected' }, { enabled: 'true' }, { revision: '' }, { axiomDataset: 'bad\r\ndataset' },
  ]) {
    fake.rows.set('tenant-a', { ...current, ...invalid } as StoredDestinationSettings);
    assert.deepEqual(await service.read('tenant-a'), { status: 'unavailable' });
    assert.deepEqual(await service.save('tenant-a', { ...input, expectedRevision: 'revision-1' }), { status: 'unavailable' });
  }
});

test('Given an empty userinfo marker in an endpoint, when saved, then the endpoint is refused', async () => {
  assert.deepEqual(await new DestinationSettingsService(storeFake().store, key, senderStub).save('tenant-a', { ...input, endpoint: 'https://@collector.example' }), { status: 'invalid', reason: 'endpoint' });
});

for (const token of ['a', 'ab', 'abc', 'abcd', 'abcde', 'long-private-token']) {
  test(`Given a saved Bearer token of ${token.length} characters, when projected to an Admin, then only its masked prefix is shown and storage keeps no preview`, async () => {
    const fake = storeFake();
    const service = new DestinationSettingsService(fake.store, key, senderStub);
    const saved = await service.save('tenant-a', { ...input, token });
    assert.ok(saved.status === 'saved');
    const expected = token.length <= 4 ? '****' : `${token.slice(0, 4)}****`;
    assert.equal(saved.settings.tokenPreview, expected);
    const read = await service.read('tenant-a');
    assert.ok(read.status === 'found');
    assert.equal(read.settings.tokenPreview, expected);
    assert.deepEqual(Object.keys(fake.rows.get('tenant-a') ?? {}).sort(), ['auth', 'enabled', 'encryptedCredential', 'endpoint', 'revision']);
    const kept = await service.save('tenant-a', { ...input, expectedRevision: read.settings.revision, token: '' });
    assert.ok(kept.status === 'unchanged');
    assert.equal(kept.settings.tokenPreview, expected);
    const none = await service.save('tenant-a', { ...input, expectedRevision: read.settings.revision, auth: 'none', token: '' });
    assert.ok(none.status === 'saved');
    assert.equal(Object.hasOwn(none.settings, 'tokenPreview'), false);
  });
}

import assert from 'node:assert/strict';
import test from 'node:test';
import { DestinationSettingsService } from '../../../../src/logs/audit/destination-settings-service.ts';
import { DestinationCredentialCodec } from '../../../../src/logs/audit/destination-credential-codec.ts';
import type { ReadSettingsResult } from '../../../../src/logs/audit/destination-settings-store.ts';

const key = Buffer.alloc(32, 6);
const saved = { enabled: true, revision: 'saved-r1', endpoint: 'https://collector.example/v1/logs', auth: 'bearer' as const, encryptedCredential: new DestinationCredentialCodec(key).encrypt('tenant-a', 'saved-token') };

for (const answer of [
  { status: 'absent' }, { status: 'found', settings: { ...saved, enabled: false } }, { status: 'found', settings: { ...saved, revision: 'new-version', endpoint: 'https://new.example/' } },
] as ReadSettingsResult[]) {
  test(`Given ${JSON.stringify(answer).slice(0, 90)}, when a queued revision is authorized, then no destination is returned`, async () => {
    let reads = 0;
    const service = new DestinationSettingsService({ read: async () => { reads++; return answer; }, save: async () => { throw new Error('must not save'); } }, key);
    assert.deepEqual(await service.authorizeExport('tenant-a', 'saved-r1'), { status: 'changed' });
    assert.equal(reads, 1);
  });
}

test('Given one valid saved version, when authorized, then exactly that read supplies destination and tenant-bound credential', async () => {
  const reads: string[] = [];
  const service = new DestinationSettingsService({ read: async tenant => { reads.push(tenant); return { status: 'found', settings: saved }; }, save: async () => { throw new Error('must not save'); } }, key);
  assert.deepEqual(await service.authorizeExport('tenant-a', 'saved-r1'), { status: 'ready', destination: { endpoint: saved.endpoint, auth: { type: 'bearer', token: 'saved-token' } } });
  assert.deepEqual(reads, ['tenant-a']);
  assert.deepEqual(await service.authorizeExport('tenant-b', 'saved-r1'), { status: 'unavailable' });
});

for (const answer of [ { status: 'unavailable' }, { status: 'found', settings: { ...saved, encryptedCredential: 'private-corrupt-ciphertext' } } ] as ReadSettingsResult[]) {
  test('Given unavailable or corrupt settings, when authorized, then only a fixed unavailable result escapes', async () => {
    const service = new DestinationSettingsService({ read: async () => answer, save: async () => { throw new Error('must not save'); } }, key);
    assert.deepEqual(await service.authorizeExport('tenant-a', 'saved-r1'), { status: 'unavailable' });
  });
}

test('Given a settings read that throws, when authorized, then a safe unavailable result escapes', async () => {
  const service = new DestinationSettingsService({ read: async () => { throw new Error('private SQL credentials'); }, save: async () => { throw new Error('must not save'); } }, key);
  assert.deepEqual(await service.authorizeExport('tenant-a', 'saved-r1'), { status: 'unavailable' });
});

test('Given cancelled authorization during a slow read, when settings arrive, then credentials are not recovered or returned', async () => {
  const held = Promise.withResolvers<ReadSettingsResult>();
  const service = new DestinationSettingsService({ read: () => held.promise, save: async () => { throw new Error('must not save'); } }, key);
  const controller = new AbortController();
  const result = service.authorizeExport('tenant-a', 'saved-r1', controller.signal);
  controller.abort();
  const settings = { ...saved };
  Object.defineProperty(settings, 'encryptedCredential', { get: () => assert.fail('cancelled authorization must not read credentials') });
  held.resolve({ status: 'found', settings });
  assert.deepEqual(await result, { status: 'unavailable' });
});

test('Given saved None authentication, when authorized, then no token is needed and the same version is returned', async () => {
  const service = new DestinationSettingsService({ read: async () => ({ status: 'found', settings: { ...saved, auth: 'none', encryptedCredential: null } }), save: async () => { throw new Error('must not save'); } }, key);
  assert.deepEqual(await service.authorizeExport('tenant-a', 'saved-r1'), { status: 'ready', destination: { endpoint: saved.endpoint, auth: { type: 'none' } } });
});

test('Given authorization is already cancelled, when called, then no settings read starts', async () => {
  let reads = 0;
  const service = new DestinationSettingsService({ read: async () => { reads++; return { status: 'found', settings: saved }; }, save: async () => { throw new Error('must not save'); } }, key);
  const controller = new AbortController(); controller.abort();
  assert.deepEqual(await service.authorizeExport('tenant-a', 'saved-r1', controller.signal), { status: 'unavailable' });
  assert.equal(reads, 0);
});

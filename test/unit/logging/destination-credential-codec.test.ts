import assert from 'node:assert/strict';
import test from 'node:test';
import { DestinationCredentialCodec } from '../../../src/logs/audit/destination-credential-codec.ts';

test('Given one tenant and token, when encrypted twice, then fresh authenticated ciphertext decrypts only for that tenant', () => {
  const codec = new DestinationCredentialCodec(Buffer.alloc(32, 9));
  const first = codec.encrypt('tenant-a', 'secret-token');
  const second = codec.encrypt('tenant-a', 'secret-token');
  assert.notEqual(first, second);
  assert.equal(codec.decrypt('tenant-a', first), 'secret-token');
  assert.equal(codec.decrypt('tenant-b', first), null);
  assert.equal(new DestinationCredentialCodec(Buffer.alloc(32, 8)).decrypt('tenant-a', first), null);
  const changed = Buffer.from(first, 'base64');
  changed[changed.length - 1] = changed[changed.length - 1]! ^ 1;
  assert.equal(codec.decrypt('tenant-a', changed.toString('base64')), null);
});

test('Given malformed ciphertext or an invalid key, when used, then no private diagnostics escape', () => {
  const codec = new DestinationCredentialCodec(Buffer.alloc(32, 9));
  for (const value of ['', 'invalid secret', Buffer.alloc(28).toString('base64')]) assert.equal(codec.decrypt('tenant-a', value), null);
  assert.throws(() => new DestinationCredentialCodec(Buffer.alloc(31)), { message: 'Destination encryption key is unavailable.' });
});

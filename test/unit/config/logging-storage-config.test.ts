import assert from 'node:assert/strict';
import { test } from 'node:test';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { rootCertificates } from 'node:tls';
import { dataDirectory } from '../../support/isolation/data-directory.ts';
import { loadLoggingStorageConfig } from '../../../src/runtime/config/logging-storage-config.ts';

const valid = { DATABASE_URL: 'postgresql://user:password@db.example:5432/logging', LOGGING_DESTINATION_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64') };

test('Given complete logging settings, when loaded, then the independent key and explicit database connection are available', async () => {
  const config = await loadLoggingStorageConfig(valid);
  assert.equal(config.status, 'available');
  if (config.status !== 'available') return;
  assert.equal(config.connectionString, valid.DATABASE_URL);
  assert.deepEqual(config.encryptionKey, Buffer.alloc(32, 7));
});

test('Given missing logging settings, when loaded, then storage is unavailable with variable names and rules', async () => {
  assert.deepEqual(await loadLoggingStorageConfig({}), { status: 'unavailable', issues: ['DATABASE_URL must be a full postgres or postgresql URI with explicit nonblank username and password, a host and database, without query parameters or fragments.', 'LOGGING_DESTINATION_ENCRYPTION_KEY must be canonical base64 for exactly 32 bytes.'] });
});

for (const DATABASE_URL of ['https://user:password@db.example/logging', 'postgresql://user:password@/logging', 'postgresql://user:password@db.example', 'postgresql://user:password@db.example/logging#secret', ...['ssl', 'sslmode', 'sslrootcert', 'sslcert', 'sslkey', 'host', 'options', 'service', 'port'].map((name) => `postgresql://user:password@db.example/logging?${name}=secret`)]) {
  test(`Given refused database URI form ${DATABASE_URL.split('?')[1]?.split('=')[0] ?? 'structure'}, when loaded, then storage is unavailable without the supplied value`, async () => {
    const config = await loadLoggingStorageConfig({ ...valid, DATABASE_URL });
    assert.equal(config.status, 'unavailable');
    assert.ok(!JSON.stringify(config).includes('secret'));
  });
}

for (const key of ['bad-secret', Buffer.alloc(31).toString('base64'), `${valid.LOGGING_DESTINATION_ENCRYPTION_KEY}\n`, valid.LOGGING_DESTINATION_ENCRYPTION_KEY.replace(/=$/, '')]) {
  test('Given a noncanonical or wrong-size encryption key, when loaded, then storage is unavailable', async () => {
    assert.equal((await loadLoggingStorageConfig({ ...valid, LOGGING_DESTINATION_ENCRYPTION_KEY: key })).status, 'unavailable');
  });
}

test('Given an unreadable custom CA, when loaded, then storage is unavailable and the file path stays private', async () => {
  assert.deepEqual(await loadLoggingStorageConfig({ ...valid, DATABASE_CA_CERT_PATH: '/private/secret-certificate' }), { status: 'unavailable', issues: ['DATABASE_CA_CERT_PATH must name a readable PEM certificate file.'] });
});

test('Given an encoded Unix socket host, when loaded, then storage cannot bypass the explicit network host', async () => {
  assert.equal((await loadLoggingStorageConfig({ ...valid, DATABASE_URL: 'postgresql://user:password@%2Fvar%2Frun%2Fpostgresql/logging' })).status, 'unavailable');
});

for (const ca of ['', 'private malformed certificate', `${rootCertificates[0]}\nprivate malformed certificate`]) {
  test('Given an empty or malformed custom CA, when loaded, then storage is unavailable without certificate contents', async (t) => {
    const path = join(dataDirectory(t), 'ca.pem');
    await writeFile(path, ca);
    const config = await loadLoggingStorageConfig({ ...valid, DATABASE_CA_CERT_PATH: path });
    assert.equal(config.status, 'unavailable');
    assert.ok(!JSON.stringify(config).includes('private malformed certificate'));
  });
}

test('Given a readable PEM trust bundle and the session pooler URI, when loaded, then storage retains the trust bundle', async (t) => {
  const path = join(dataDirectory(t), 'ca.pem');
  const ca = `${rootCertificates[0]}\n${rootCertificates[1]}`;
  await writeFile(path, ca);
  const config = await loadLoggingStorageConfig({ ...valid, DATABASE_URL: 'postgresql://postgres.project:password@aws-0-us-west-1.pooler.supabase.com:5432/postgres', DATABASE_CA_CERT_PATH: path });
  assert.equal(config.status, 'available');
  if (config.status === 'available') assert.equal(config.ca, ca);
});

for (const DATABASE_URL of ['postgresql://db.example/logging', 'postgresql://user@db.example/logging', 'postgresql://user:@db.example/logging', 'postgresql://:password@db.example/logging', 'postgresql://%20:password@db.example/logging', 'postgresql://user:%20@db.example/logging']) {
  test('Given missing or blank explicit database credentials, when loaded, then storage cannot inherit process credentials', async () => {
    assert.equal((await loadLoggingStorageConfig({ ...valid, DATABASE_URL })).status, 'unavailable');
  });
}

import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { chmod, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { TestContext } from 'node:test';
import { promisify } from 'node:util';
import { loggingSettingsMigrations } from '../processes/module-paths.ts';

const exec = promisify(execFile);

/** Starts only a disposable PostgreSQL container with a private runtime role and verified TLS. */
export async function postgresSettingsSite(t: TestContext, certificateNames = 'DNS:localhost,IP:127.0.0.1'): Promise<{ connection: { connectionString: string; ca: string }; container: string; settingsConnections(activeOnly?: boolean): Promise<number>; disconnectIdleSettingsConnections(): Promise<void> }> {
  const directory = await mkdtemp(join(tmpdir(), 'thermus-settings-'));
  const container = `thermus-settings-${randomUUID()}`;
  t.after(async () => {
    await exec('docker', ['rm', '-f', '--volumes', container]).catch(() => {});
    await rm(directory, { recursive: true, force: true });
  });
  await exec('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', join(directory, 'server.key'), '-out', join(directory, 'server.crt'), '-days', '1', '-subj', '/CN=localhost', '-addext', `subjectAltName=${certificateNames}`]);
  await exec('docker', ['create', '--name', container, '-e', 'POSTGRES_PASSWORD=local-owner-fixture', '-p', '127.0.0.1::5432', '--entrypoint', 'sh', 'postgres:17-alpine', '-c', 'cp /cert/server.key /tmp/server.key && chown postgres:postgres /tmp/server.key && chmod 600 /tmp/server.key && exec docker-entrypoint.sh postgres -c ssl=on -c ssl_cert_file=/cert/server.crt -c ssl_key_file=/tmp/server.key']);
  await chmod(directory, 0o755);
  await exec('docker', ['cp', directory, `${container}:/cert`]);
  await exec('docker', ['start', container]);
  for (let attempt = 0; attempt < 100; attempt++) {
    const ready = await exec('docker', ['exec', container, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres']).then(() => true, () => false);
    if (ready) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  for (const migration of loggingSettingsMigrations) {
    await exec('docker', ['cp', migration, `${container}:/tmp/settings.sql`]);
    await exec('docker', ['exec', container, 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-f', '/tmp/settings.sql']);
  }
  await exec('docker', ['exec', container, 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-c', "ALTER ROLE thermus_logging LOGIN PASSWORD 'local-runtime-fixture'"]);
  const port = (await exec('docker', ['port', container, '5432/tcp'])).stdout.trim().split(':').at(-1);
  return { container, disconnectIdleSettingsConnections: async () => {
    await exec('docker', ['exec', container, 'psql', '-U', 'postgres', '-Atc', "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE application_name = 'thermus-settings' AND state = 'idle'"]);
  }, settingsConnections: async (activeOnly = false) => Number((await exec('docker', ['exec', container, 'psql', '-U', 'postgres', '-Atc', `SELECT count(*) FROM pg_stat_activity WHERE application_name = 'thermus-settings'${activeOnly ? " AND state = 'active'" : ''}`])).stdout.trim()), connection: { connectionString: `postgresql://thermus_logging:local-runtime-fixture@127.0.0.1:${port}/postgres`, ca: await readFile(join(directory, 'server.crt'), 'utf8') } };
}

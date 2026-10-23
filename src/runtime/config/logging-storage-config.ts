import { X509Certificate } from 'node:crypto';
import { readFile } from 'node:fs/promises';

type Environment = Readonly<Record<string, string | undefined>>;

export type LoggingStorageConfig = {
  readonly status: 'available';
  readonly connectionString: string;
  readonly encryptionKey: Buffer;
  readonly ca?: string;
} | {
  readonly status: 'unavailable';
  readonly issues: readonly string[];
};

const DATABASE_RULE = 'DATABASE_URL must be a full postgres or postgresql URI with explicit nonblank username and password, a host and database, without query parameters or fragments.';
const KEY_RULE = 'LOGGING_DESTINATION_ENCRYPTION_KEY must be canonical base64 for exactly 32 bytes.';

// Query parameters are refused as a group so libpq connection overrides cannot change TLS or the host.
export async function loadLoggingStorageConfig(environment: Environment): Promise<LoggingStorageConfig> {
  const connectionString = environment.DATABASE_URL ?? '';
  const encodedKey = environment.LOGGING_DESTINATION_ENCRYPTION_KEY ?? '';
  const encryptionKey = Buffer.from(encodedKey, 'base64');
  const issues: string[] = [];
  if (!validDatabaseUri(connectionString)) issues.push(DATABASE_RULE);
  if (encryptionKey.length !== 32 || encryptionKey.toString('base64') !== encodedKey) issues.push(KEY_RULE);
  if (issues.length > 0) return { status: 'unavailable', issues };
  const path = environment.DATABASE_CA_CERT_PATH;
  if (path === undefined || path === '') return { status: 'available', connectionString, encryptionKey };
  try {
    const ca = await readFile(path, 'utf8');
    validateCertificates(ca);
    return { status: 'available', connectionString, encryptionKey, ca };
  } catch {
    return { status: 'unavailable', issues: ['DATABASE_CA_CERT_PATH must name a readable PEM certificate file.'] };
  }
}

function validDatabaseUri(value: string): boolean {
  const url = URL.parse(value);
  return url !== null && ['postgres:', 'postgresql:'].includes(url.protocol)
    && explicitCredentials(url) && url.hostname !== '' && !url.hostname.includes('%') && url.pathname.length > 1
    && !/[?#\s\p{Cc}]/u.test(value);
}

function validateCertificates(ca: string): void {
  const pem = /-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g;
  const certificates = ca.match(pem) ?? [];
  if (certificates.length === 0 || ca.replace(pem, '').trim() !== '') throw new Error('Invalid certificate bundle.');
  for (const certificate of certificates) new X509Certificate(certificate);
}

function explicitCredentials(url: URL): boolean {
  try {
    return decodeURIComponent(url.username).trim() !== '' && decodeURIComponent(url.password).trim() !== '';
  } catch {
    return false;
  }
}

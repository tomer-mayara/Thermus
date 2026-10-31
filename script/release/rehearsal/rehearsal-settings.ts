// The fixed names and IDs of the SO-12 rehearsal (docs/implementation/self-onboarding-s2-release.md, section 3), and
// the checks of the environment. Each check names the variable, never its value. The script never prints a key, a
// token, a password, a cookie secret, or a private key.
import { readFileSync, statSync } from 'node:fs';
import { STAGING_CLIENT_ID, STAGING_ISSUER } from '../../spike/capacity-probe/secrets.ts';
import type { HostedLiveSettings } from '../../../test/support/hosted-live/settings.ts';

type Environment = Readonly<Record<string, string | undefined>>;

export const OWNER_ID = 'tea-db8i6ceq1p3s73dev9og';
export const PRODUCTION_SERVICE_ID = 'srv-db8mnqg473hc739d529g';
export const CONTROL_NAME = 'thermus-spike-control';
export const TENANT_PREFIX = 'thermus-spike-tenant-';
export const REGISTRY_CREDENTIAL_ID = 'rgc-dbg1h0142hec73da9ra0';
const IMAGE = 'ghcr.io/tomer-mayara/thermus-hosted';
export const CANDIDATE_DIGEST = 'sha256:8025ae1b37b10575f80e5df415f7723f79f58822ce88f3d6d85bd705f63084d9';
export const REPOSITORY = 'https://github.com/tomer-mayara/Thermus';
export const REGION = 'oregon';
export const FREE_PLAN = '0.5c-512mb';
export const LISTEN_PORT = 8080;
// The Render secret file of the CA of the staging database, as production has it (section 3.3).
export const CA_FILE_NAME = 'supabase-ca.crt';
export const CA_PATH_IN_SERVICE = `/etc/secrets/${CA_FILE_NAME}`;
// The loopback callback of the Connect application of the rehearsal. No server listens on it: the browser catches it.
// It is not the callback of the hosted live gate (port 24480).
export const CONNECT_CALLBACK = 'http://127.0.0.1:24490/callback';
const STAGING_DATABASE_USER = 'thermus_logging.kgiidcbufczoyifzxvtf';
const STAGING_DATABASE_HOST = 'aws-0-us-west-1.pooler.supabase.com';
const SPACE_OR_CONTROL = /[\s\p{Cc}]/u;

/** A refused setting or usage: the script stops before any call, with exit code 2. */
export class RehearsalUsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RehearsalUsageError';
  }
}

function required(environment: Environment, name: string, purpose: string): string {
  const value = environment[name] ?? '';
  if (value.trim() === '' || SPACE_OR_CONTROL.test(value)) throw new RehearsalUsageError(`${name} is required, without spaces: ${purpose}.`);
  return value;
}

/** The fleet key: the Render API key of the owner's Render user, from .env.local of the main checkout. */
export function renderKeyOf(environment: Environment): string {
  return required(environment, 'RENDER_API_KEY', 'the fleet key; run the script with node --env-file=<main checkout>/.env.local');
}

/** The WorkOS Staging values of the launcher. .env.local holds the values of another environment, so each is checked. */
export function stagingWorkOSOf(environment: Environment): HostedLiveSettings {
  const apiKey = required(environment, 'WORKOS_API_KEY', 'the WorkOS Staging key; run the script through with-workos-staging.cjs');
  if (!apiKey.startsWith('sk_test_')) throw new RehearsalUsageError('WORKOS_API_KEY must be a WorkOS test key that starts with sk_test_.');
  if (environment.WORKOS_CLIENT_ID !== STAGING_CLIENT_ID) throw new RehearsalUsageError(`WORKOS_CLIENT_ID must be the client of WorkOS Staging, ${STAGING_CLIENT_ID}. Run the script through with-workos-staging.cjs.`);
  if (environment.WORKOS_AUTHKIT_ISSUER !== STAGING_ISSUER) throw new RehearsalUsageError(`WORKOS_AUTHKIT_ISSUER must be the issuer of WorkOS Staging, ${STAGING_ISSUER}.`);
  return { apiKey, clientId: STAGING_CLIENT_ID, authkitIssuer: STAGING_ISSUER };
}

/** STAGING_DATABASE_URL: the runtime role of the staging project through its session pooler, never production. */
export function stagingDatabaseUrlOf(environment: Environment): string {
  const value = required(environment, 'STAGING_DATABASE_URL', 'the runtime connection of the staging database');
  const url = new URL(value);
  if (url.hostname !== STAGING_DATABASE_HOST || decodeURIComponent(url.username) !== STAGING_DATABASE_USER || url.search !== '') {
    throw new RehearsalUsageError(`STAGING_DATABASE_URL must name the user ${STAGING_DATABASE_USER} on ${STAGING_DATABASE_HOST}, with no query.`);
  }
  return value;
}

/** The PEM file of the CA of the staging database, outside the repository. */
export function caPemOf(environment: Environment): string {
  const path = required(environment, 'REHEARSAL_CA_PATH', 'the PEM file of the CA of the staging database');
  const pem = readFileSync(path, 'utf8');
  if (!pem.startsWith('-----BEGIN CERTIFICATE-----')) throw new RehearsalUsageError('REHEARSAL_CA_PATH must name a PEM certificate file.');
  return pem;
}

/** The Axiom token and the edge endpoint of the system log export to system-log-test (section 3.4). */
export function systemLogOf(environment: Environment): { readonly token: string; readonly endpoint: string } {
  const token = required(environment, 'AXIOM_API_KEY', 'the Axiom token of the dataset system-log-test');
  const edge = new URL(required(environment, 'AXOIM_ENDPOINT_URL', 'the Axiom edge host'));
  return { token, endpoint: new URL('/v1/logs', edge.origin).href };
}

/** REHEARSAL_STATE_DIR: a folder with mode 700 outside the repository. The cleanup deletes it. */
export function stateDirOf(environment: Environment): string {
  const path = required(environment, 'REHEARSAL_STATE_DIR', 'the private folder of the rehearsal state');
  const mode = statSync(path).mode & 0o777;
  if (mode !== 0o700) throw new RehearsalUsageError('REHEARSAL_STATE_DIR must be a folder with mode 700.');
  return path;
}

/** The run ID: the start time in UTC, such as 20261031-2030 (section 3.2). */
export function runIdOf(environment: Environment): string {
  const value = required(environment, 'REHEARSAL_RUN_ID', 'the run ID, the start time in UTC such as 20261031-2030');
  if (!/^\d{8}-\d{4}$/.test(value)) throw new RehearsalUsageError('REHEARSAL_RUN_ID must be the start time in UTC, such as 20261031-2030.');
  return value;
}

export function imageOf(digest: string): string {
  if (!/^sha256:[0-9a-f]{64}$/.test(digest)) throw new RehearsalUsageError('The digest must be sha256:<64 lowercase hex characters>.');
  return `${IMAGE}@${digest}`;
}

export function utcNow(): string {
  return new Date().toISOString();
}

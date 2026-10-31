// The variables of the staging control plane (section 3.4 of the release record). Each new secret is made here in
// memory and goes to Render in the body of the call only; nothing prints it, and no file holds it.
import { generateKeyPairSync, randomBytes } from 'node:crypto';
import {
  CA_PATH_IN_SERVICE, CANDIDATE_DIGEST, FREE_PLAN, imageOf, LISTEN_PORT, OWNER_ID, REGISTRY_CREDENTIAL_ID, renderKeyOf, stagingDatabaseUrlOf,
  stagingWorkOSOf, systemLogOf, TENANT_PREFIX,
} from './rehearsal-settings.ts';

type Environment = Readonly<Record<string, string | undefined>>;
export type Variables = readonly (readonly [string, string])[];

// The variables that hold a secret. A report shows each of them as <set> with its length.
export const SECRET_NAMES: ReadonlySet<string> = new Set([
  'WORKOS_API_KEY', 'WORKOS_COOKIE_PASSWORD', 'DATABASE_URL', 'LOGGING_DESTINATION_ENCRYPTION_KEY', 'GATEWAY_SIGNING_KEY', 'RENDER_API_KEY', 'SYSTEM_LOG_OTLP_TOKEN',
]);

function baseUrlOf(origin: string): string {
  return `${origin}/`;
}

/** The variables of step R1, with the public origin of the service. */
export function createVariables(environment: Environment, origin: string): Variables {
  const workos = stagingWorkOSOf(environment);
  return [
    ['DEPLOYMENT', 'hosted'],
    ['PORT', String(LISTEN_PORT)],
    ['PUBLIC_BASE_URL', baseUrlOf(origin)],
    ['WORKOS_API_KEY', workos.apiKey],
    ['WORKOS_CLIENT_ID', workos.clientId],
    ['WORKOS_AUTHKIT_ISSUER', workos.authkitIssuer],
    ['WORKOS_REDIRECT_URI', new URL('callback', baseUrlOf(origin)).href],
    // 32 random bytes in base64url: 43 characters; the hosted server needs at least 32.
    ['WORKOS_COOKIE_PASSWORD', randomBytes(32).toString('base64url')],
    ['DATABASE_URL', stagingDatabaseUrlOf(environment)],
    // 32 random bytes in canonical base64.
    ['LOGGING_DESTINATION_ENCRYPTION_KEY', randomBytes(32).toString('base64')],
    ['DATABASE_CA_CERT_PATH', CA_PATH_IN_SERVICE],
    ['OPERATION_CAPACITY', '1'],
    ['SELF_SERVE_SIGNUP_ENABLED', 'false'],
  ];
}

/** The host variables of step R2, when the public host differs from the guessed one. */
export function hostVariables(origin: string): Variables {
  return [['PUBLIC_BASE_URL', baseUrlOf(origin)], ['WORKOS_REDIRECT_URI', new URL('callback', baseUrlOf(origin)).href]];
}

// A new Ed25519 key pair, as runbook 5.2 step 1 makes it with openssl, in PEM form (PKCS #8 and SPKI).
function gatewayKeyPair(): { readonly signing: string; readonly publicKey: string } {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519', { privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } });
  return { signing: privateKey, publicKey };
}

/**
 * The variables of step R7. The switch MCP_TENANTS_ENABLED comes last and the token of the system log just before
 * its endpoint, so that a deploy that Render starts during the updates meets a start that the settings allow.
 */
export function switchOnVariables(environment: Environment, slug: string, sweepHourUtc: number): Variables {
  const gateway = gatewayKeyPair();
  const systemLog = systemLogOf(environment);
  return [
    ['GATEWAY_PUBLIC_KEY', gateway.publicKey.trim()],
    ['GATEWAY_SIGNING_KEY', gateway.signing.trim()],
    ['CONTROL_PLANE_INTERNAL_URL', `http://${slug}:${LISTEN_PORT}`],
    ['RENDER_API_KEY', renderKeyOf(environment)],
    ['RENDER_OWNER_ID', OWNER_ID],
    ['RENDER_REGISTRY_CREDENTIAL_ID', REGISTRY_CREDENTIAL_ID],
    ['TENANT_IMAGE', imageOf(CANDIDATE_DIGEST)],
    ['TENANT_PLAN_FREE', FREE_PLAN],
    ['TENANT_NAME_PREFIX', TENANT_PREFIX],
    ['FREE_TENANT_LIMIT', '25'],
    ['FREE_TENANT_IDLE_DAYS', '14'],
    ['TENANT_SWEEP_HOUR_UTC', String(sweepHourUtc)],
    ['SYSTEM_LOG_AXIOM_DATASET', 'system-log-test'],
    ['SYSTEM_LOG_OTLP_TOKEN', systemLog.token],
    ['SYSTEM_LOG_OTLP_ENDPOINT', systemLog.endpoint],
    ['MCP_TENANTS_ENABLED', 'true'],
  ];
}

/** The text of a variable for a report: the value of a plain variable, and only the length of a secret. */
export function shownVariable([key, value]: readonly [string, string]): string {
  return SECRET_NAMES.has(key) ? `${key}=<set, ${value.length} characters>` : `${key}=${value}`;
}

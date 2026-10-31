import { createPrivateKey, createPublicKey, type KeyObject } from 'node:crypto';
import { DeploymentConfigError } from './deployment-config.ts';
import { ed25519PublicKeysOf } from './gateway-public-keys.ts';
import { originWithSlashOf } from './setting-origins.ts';

type Environment = Readonly<Record<string, string | undefined>>;

export interface GatewaySettings {
  /** GATEWAY_SIGNING_KEY: the Ed25519 private key that signs each access context. Only the control plane holds it. */
  readonly signingKey: KeyObject;
  readonly verifyingKey: KeyObject;
  /**
   * CONTROL_PLANE_INTERNAL_URL: the origin of the control plane on the private network, without a final slash. Each
   * tenant relays its audit events to this origin, so the relay route accepts only its host.
   */
  readonly controlPlaneInternalUrl: string;
}

const KEY_RULE = 'GATEWAY_SIGNING_KEY must be one PEM private key of type Ed25519.';
const LISTED_KEY_RULE = 'GATEWAY_PUBLIC_KEY must include the public key of GATEWAY_SIGNING_KEY.';
const INTERNAL_URL_RULE = 'CONTROL_PLANE_INTERNAL_URL must be the http or https origin of the control plane on the private network, such as http://thermus-control-plane:8080, without a path, a username, a password, a query, or a fragment.';
// Exactly one PEM block with the private key label, as Node writes an Ed25519 key in PKCS #8.
const PEM_PRIVATE_KEY = /^-----BEGIN PRIVATE KEY-----[A-Za-z0-9+/=\s]+-----END PRIVATE KEY-----$/;

/** Reads and checks the gateway settings. A missing or invalid setting stops the start before the server listens. */
export function loadGatewaySettings(environment: Environment): GatewaySettings {
  const signingKey = signingKeyOf(required(environment, 'GATEWAY_SIGNING_KEY'));
  return Object.freeze({
    signingKey,
    verifyingKey: createPublicKey(signingKey),
    controlPlaneInternalUrl: internalOriginOf(required(environment, 'CONTROL_PLANE_INTERNAL_URL')),
  });
}

/**
 * Stops the start unless GATEWAY_PUBLIC_KEY holds the public key of GATEWAY_SIGNING_KEY: each new tenant gets that list
 * and accepts only a context that a key of the list verifies. The list can hold more keys for a rotation. The keys are
 * compared in DER form, so other line ends or spaces in the list do not change the result.
 */
export function requireSigningKeyIn(settings: Pick<GatewaySettings, 'verifyingKey'>, gatewayPublicKey: string): void {
  const signing = derOf(settings.verifyingKey);
  if (!(ed25519PublicKeysOf(gatewayPublicKey) ?? []).some((key) => derOf(key).equals(signing))) throw new DeploymentConfigError(LISTED_KEY_RULE);
}

function derOf(key: KeyObject): Buffer {
  return key.export({ type: 'spki', format: 'der' });
}

function required(environment: Environment, name: string): string {
  const value = environment[name];
  if (value === undefined || value === '') throw new DeploymentConfigError(`${name} is required when MCP_TENANTS_ENABLED is true.`);
  return value;
}

// Each rule names the setting, never its value.
function signingKeyOf(value: string): KeyObject {
  const pem = value.trim();
  const key = PEM_PRIVATE_KEY.test(pem) ? privateKeyOf(pem) : undefined;
  if (key?.asymmetricKeyType !== 'ed25519') throw new DeploymentConfigError(KEY_RULE);
  return key;
}

function privateKeyOf(pem: string): KeyObject | undefined {
  try {
    return createPrivateKey({ key: pem, format: 'pem' });
  } catch {
    // A refused key gives no detail: the message of the start names the setting only.
    return undefined;
  }
}

function internalOriginOf(value: string): string {
  const origin = originWithSlashOf(value, ['http:', 'https:']);
  if (origin === undefined) throw new DeploymentConfigError(INTERNAL_URL_RULE);
  return origin.slice(0, -1);
}

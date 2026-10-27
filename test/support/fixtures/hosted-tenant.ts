import { generateKeyPairSync, type KeyObject } from 'node:crypto';
import { workOSSettings } from './hosted-placeholder.ts';

// The organization that the tenant of the offline tests serves, and an organization of another tenant.
export const tenantOrganizationId = 'org_01TENANTA';
export const otherOrganizationId = 'org_01TENANTB';

// The identity authority of the control plane with the placeholder WorkOS settings: workos:<WORKOS_CLIENT_ID>. The
// control plane signs it into each access context, so a tenant gives the same tenant ID as the control plane.
export const controlPlaneAuthority = `workos:${workOSSettings.WORKOS_CLIENT_ID}`;

export interface GatewayKeyPair {
  // GATEWAY_PUBLIC_KEY of a tenant: one PEM public key.
  readonly publicKeyPem: string;
  // GATEWAY_SIGNING_KEY of the control plane. Only the gateway of the tests holds it.
  readonly privateKey: KeyObject;
}

// A new Ed25519 key pair of the gateway for each call.
export function gatewayKeyPairOf(): GatewayKeyPair {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  return { publicKeyPem: publicKey.export({ type: 'spki', format: 'pem' }).toString(), privateKey };
}

// The tenant settings of plan section 4.1 for the public base URL https://thermus.example/. They hold no WorkOS
// secret, no database setting, and no Render or Stripe setting.
export function tenantSettingsOf(publicKeyPem: string, controlPlaneInternalUrl: string): Readonly<Record<string, string>> {
  return {
    DEPLOYMENT: 'hosted',
    THERMUS_ROLE: 'tenant',
    PUBLIC_BASE_URL: 'https://thermus.example/',
    TENANT_ORGANIZATION_ID: tenantOrganizationId,
    GATEWAY_PUBLIC_KEY: publicKeyPem,
    CONTROL_PLANE_INTERNAL_URL: controlPlaneInternalUrl,
    WORKOS_AUTHKIT_ISSUER: workOSSettings.WORKOS_AUTHKIT_ISSUER,
  };
}

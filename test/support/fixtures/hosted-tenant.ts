import { generateKeyPairSync, type KeyObject } from 'node:crypto';
import { workOSSettings } from './hosted-placeholder.ts';

export const tenantOrganizationId = 'org_01TENANTA';
export const otherOrganizationId = 'org_01TENANTB';

// The identity authority of the control plane with the placeholder WorkOS settings: workos:<WORKOS_CLIENT_ID>. The
// control plane signs it into each access context, so a tenant gives the same tenant ID as the control plane.
export const controlPlaneAuthority = `workos:${workOSSettings.WORKOS_CLIENT_ID}`;

export interface GatewayKeyPair {
  readonly publicKeyPem: string;
  readonly privateKey: KeyObject;
}

export function gatewayKeyPairOf(): GatewayKeyPair {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  return { publicKeyPem: publicKey.export({ type: 'spki', format: 'pem' }).toString(), privateKey };
}

export function gatewaySigningSettingsOf(keys: GatewayKeyPair = gatewayKeyPairOf(), controlPlaneInternalUrl = 'http://thermus-control-plane:8080'): Readonly<Record<string, string>> {
  return { GATEWAY_SIGNING_KEY: keys.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(), CONTROL_PLANE_INTERNAL_URL: controlPlaneInternalUrl };
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

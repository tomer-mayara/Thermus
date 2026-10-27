import { generateKeyPairSync } from 'node:crypto';
import { workOSSettings } from './hosted-placeholder.ts';

// The settings of a control plane with MCP_TENANTS_ENABLED=true (plan section 4.1), with placeholder values that pass
// the startup checks: a fake Render key, workspace, and registry credential, a tenant image by digest, the free plan,
// and the public values that each new tenant gets. No value reaches Render or another service.

const gatewayKeys = generateKeyPairSync('ed25519');

export const tenantImage = `ghcr.io/tomer-mayara/thermus-hosted@sha256:${'0123456789abcdef'.repeat(4)}`;
export const tenantImageDigest = `sha256:${'0123456789abcdef'.repeat(4)}`;
export const controlPlanePublicBaseUrl = 'https://thermus.example/';
export const controlPlaneAuthkitIssuer = workOSSettings.WORKOS_AUTHKIT_ISSUER ?? '';

export const tenantProvisioningSettings: Readonly<Record<string, string>> = {
  MCP_TENANTS_ENABLED: 'true',
  RENDER_API_KEY: 'rnd_placeholderProvisionerKey0123',
  RENDER_OWNER_ID: 'tea-placeholderworkspace',
  RENDER_REGISTRY_CREDENTIAL_ID: 'rgc-placeholdercredential',
  TENANT_IMAGE: tenantImage,
  TENANT_PLAN_FREE: '0.5c-512mb',
  GATEWAY_PUBLIC_KEY: gatewayKeys.publicKey.export({ type: 'spki', format: 'pem' }).toString(),
  CONTROL_PLANE_INTERNAL_URL: 'http://thermus-control-plane:8080',
};

// The secrets of the control plane. A tenant renders untrusted pages, so it must get none of them (decision D-14).
export const controlPlaneSecrets: Readonly<Record<string, string>> = {
  WORKOS_API_KEY: workOSSettings.WORKOS_API_KEY ?? '',
  WORKOS_COOKIE_PASSWORD: workOSSettings.WORKOS_COOKIE_PASSWORD ?? '',
  WORKOS_CLIENT_SECRET: 'client-secret-placeholder-0123456789',
  GATEWAY_SIGNING_KEY: gatewayKeys.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
  DATABASE_URL: 'postgresql://thermus_logging:placeholder-database-password@database.example:5432/postgres',
  LOGGING_DESTINATION_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'),
  RENDER_API_KEY: tenantProvisioningSettings.RENDER_API_KEY ?? '',
  STRIPE_SECRET_KEY: 'sk_test_placeholderStripeSecretKey',
  STRIPE_WEBHOOK_SECRET: 'whsec_placeholderStripeWebhookSecret',
};

// The whole environment of such a control plane: the hosted settings, every secret, and the tenant settings.
export const controlPlaneEnvironment: Readonly<Record<string, string>> = {
  DEPLOYMENT: 'hosted',
  PUBLIC_BASE_URL: controlPlanePublicBaseUrl,
  ...workOSSettings,
  ...controlPlaneSecrets,
  ...tenantProvisioningSettings,
};

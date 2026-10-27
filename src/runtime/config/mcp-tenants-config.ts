import { DeploymentConfigError } from './deployment-config.ts';
import { ed25519PublicKeysOf } from './gateway-public-keys.ts';
import { originWithSlashOf } from './setting-origins.ts';

type Environment = Readonly<Record<string, string | undefined>>;

/** The settings that the control plane reads only with MCP_TENANTS_ENABLED=true (plan section 4.1). */
export interface TenantProvisioningSettings {
  readonly render: {
    // The key of the dedicated Render user of the control plane. It stays in the control plane.
    readonly apiKey: string;
    readonly ownerId: string;
    readonly registryCredentialId: string;
    // The hosted image of each new tenant, by digest.
    readonly tenantImage: string;
  };
  readonly freePlan: string;
  // The name of a tenant service is this prefix and the organization ID in lower case.
  readonly namePrefix: string;
  // The public values that each new tenant gets, with the rules of the tenant role: the gateway public keys and the
  // private address of the control plane.
  readonly gatewayPublicKey: string;
  readonly controlPlaneInternalUrl: string;
}

const DEFAULT_NAME_PREFIX = 'thermus-tenant-';
const SWITCH_RULE = 'MCP_TENANTS_ENABLED must be exactly true or false.';
const PREFIX_RULE = 'TENANT_NAME_PREFIX must start with a lowercase letter and hold at most 40 lowercase letters, digits, or hyphens.';
const KEY_RULE = 'GATEWAY_PUBLIC_KEY must hold one or more PEM public keys of type Ed25519, separated by commas.';
const INTERNAL_URL_RULE = 'CONTROL_PLANE_INTERNAL_URL must be the http or https origin of the control plane on the private network, such as http://thermus-control-plane:8080, without a path, a username, a password, a query, or a fragment.';

// Each rule names the setting, never its value.
const RULES = {
  RENDER_API_KEY: { pattern: /^[^\s\p{Cc}]+$/u, rule: 'RENDER_API_KEY must not contain spaces or control characters.' },
  RENDER_OWNER_ID: { pattern: /^(?:tea|usr)-[a-z0-9]{1,64}$/, rule: 'RENDER_OWNER_ID must be the ID of a Render workspace, such as tea-<lowercase letters and digits>.' },
  RENDER_REGISTRY_CREDENTIAL_ID: { pattern: /^rgc-[a-z0-9]{1,64}$/, rule: 'RENDER_REGISTRY_CREDENTIAL_ID must be the ID of a Render registry credential, such as rgc-<lowercase letters and digits>.' },
  TENANT_IMAGE: {
    pattern: /^[a-z0-9][a-z0-9.-]*(?::\d{1,5})?(?:\/[a-z0-9][a-z0-9._-]*)+@sha256:[0-9a-f]{64}$/,
    rule: 'TENANT_IMAGE must be an image reference by digest, such as ghcr.io/owner/name@sha256:<64 hexadecimal digits>.',
  },
  TENANT_PLAN_FREE: { pattern: /^[a-z0-9][a-z0-9._-]{0,63}$/, rule: 'TENANT_PLAN_FREE must be the name of a Render plan, such as 0.5c-512mb.' },
} as const;

/** The rollout switch of the tenant containers. Off by default: then no setting of the tenants is read. */
export function loadMcpTenantsEnabled(environment: Environment): boolean {
  const value = environment.MCP_TENANTS_ENABLED;
  if (value === undefined || value === '' || value === 'false') return false;
  if (value === 'true') return true;
  throw new DeploymentConfigError(SWITCH_RULE);
}

/** Reads and checks the provisioning settings. A missing or invalid setting stops the start before the server listens. */
export function loadTenantProvisioningSettings(environment: Environment): TenantProvisioningSettings {
  const read = (name: keyof typeof RULES): string => matching(environment, name);
  const settings: TenantProvisioningSettings = {
    render: { apiKey: read('RENDER_API_KEY'), ownerId: read('RENDER_OWNER_ID'), registryCredentialId: read('RENDER_REGISTRY_CREDENTIAL_ID'), tenantImage: read('TENANT_IMAGE') },
    freePlan: read('TENANT_PLAN_FREE'),
    namePrefix: namePrefixOf(environment.TENANT_NAME_PREFIX),
    gatewayPublicKey: gatewayPublicKeyOf(required(environment, 'GATEWAY_PUBLIC_KEY')),
    controlPlaneInternalUrl: internalOriginOf(required(environment, 'CONTROL_PLANE_INTERNAL_URL')),
  };
  return Object.freeze(settings);
}

function required(environment: Environment, name: string): string {
  const value = environment[name];
  if (value === undefined || value === '') throw new DeploymentConfigError(`${name} is required when MCP_TENANTS_ENABLED is true.`);
  return value;
}

function matching(environment: Environment, name: keyof typeof RULES): string {
  const value = required(environment, name);
  if (!RULES[name].pattern.test(value)) throw new DeploymentConfigError(RULES[name].rule);
  return value;
}

function namePrefixOf(value: string | undefined): string {
  if (value === undefined || value === '') return DEFAULT_NAME_PREFIX;
  if (!/^[a-z][a-z0-9-]{0,39}$/.test(value)) throw new DeploymentConfigError(PREFIX_RULE);
  return value;
}

// The rule of the tenant role (tenant-settings.ts), so a value that passes here also starts a tenant. A private key
// never passes, also when Node can derive its public key from it: a tenant must not hold it.
function gatewayPublicKeyOf(list: string): string {
  if (ed25519PublicKeysOf(list) === undefined) throw new DeploymentConfigError(KEY_RULE);
  return list;
}

// The origin without its final slash, as the tenant role reads it.
function internalOriginOf(value: string): string {
  const origin = originWithSlashOf(value, ['http:', 'https:']);
  if (origin === undefined) throw new DeploymentConfigError(INTERNAL_URL_RULE);
  return origin.slice(0, -1);
}

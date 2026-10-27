import type { TenantSettings } from './deployment-config.ts';
import { controlPlaneSecretsRefusal } from './control-plane-secrets.ts';
import { ed25519PublicKeysOf } from './gateway-public-keys.ts';
import { exactOriginOf, originWithSlashOf } from './setting-origins.ts';

type Environment = Readonly<Record<string, string | undefined>>;
// Stops the start with a message that names the setting and its rule, but never its value.
type Refuse = (message: string) => never;

const ORGANIZATION_ID = /^[\x21-\x7e]{1,256}$/;
const KEY_RULE = 'GATEWAY_PUBLIC_KEY must hold one or more PEM public keys of type Ed25519, separated by commas.';
// The audit relay posts to this origin over the private network, so plain http is accepted.
const INTERNAL_URL_RULE = 'CONTROL_PLANE_INTERNAL_URL must be the http or https origin of the control plane on the private network, such as http://thermus-control-plane:8080, without a path, a username, a password, a query, or a fragment.';
// The issuer is exact: a path or a final slash would make the issuer check of each Connect token fail.
const ISSUER_RULE = 'WORKOS_AUTHKIT_ISSUER must be the https origin of the AuthKit domain, such as https://example.authkit.app, without a path, a final slash, a username, a password, a query, or a fragment.';

/** The settings of plan section 4.1 for THERMUS_ROLE=tenant. The first broken rule stops the start through refuse. */
export function readTenantSettings(environment: Environment, refuse: Refuse): TenantSettings {
  const secrets = controlPlaneSecretsRefusal(environment);
  if (secrets !== undefined) refuse(secrets);
  const read = (name: string): string => environment[name] || refuse(`${name} is required.`);
  const organizationId = read('TENANT_ORGANIZATION_ID');
  const settings: TenantSettings = {
    organizationId: ORGANIZATION_ID.test(organizationId) ? organizationId : refuse('TENANT_ORGANIZATION_ID must have 1 to 256 visible ASCII characters.'),
    gatewayPublicKeys: ed25519PublicKeysOf(read('GATEWAY_PUBLIC_KEY')) ?? refuse(KEY_RULE),
    controlPlaneInternalUrl: originWithSlashOf(read('CONTROL_PLANE_INTERNAL_URL'), ['http:', 'https:']) ?? refuse(INTERNAL_URL_RULE),
    authkitIssuer: exactOriginOf(read('WORKOS_AUTHKIT_ISSUER'), ['https:']) ?? refuse(ISSUER_RULE),
  };
  return Object.freeze(settings);
}

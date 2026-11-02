// D-15, final on 27 October 2026: a free tenant serves 5 tool calls at a time, and a team tenant 10. The provisioner
// sets the value of the tier in the tenant; the default of OPERATION_CAPACITY in the source stays 10.
const OPERATION_CAPACITY_BY_TIER = { free: 5, team: 10 } as const;
// The ID part has 30 characters and the prefix at most 40, so this limit keeps the whole name short. Render shortens a
// long name into the hostname at a separator, and the gateway reads the address from Render, never from the name.
const ORGANIZATION_SLUG_LIMIT = 30;

/** The public values of the control plane that each tenant gets (plan section 4.1). None of them is a secret. */
export interface TenantPublicSettings {
  readonly publicBaseUrl: string;
  readonly authkitIssuer: string;
  readonly gatewayPublicKey: string;
  readonly controlPlaneInternalUrl: string;
}

/**
 * The name of the service of an organization: the prefix and the organization ID in lower case, with each character
 * outside a-z, 0-9, and hyphen as a hyphen, so the name is DNS-safe (27 October 2026). For the organization name of
 * hosted signup, the slug of that name and a hyphen come before the ID (2 November 2026). Without a name, or with a
 * name whose slug is empty, the name is the same as before, so existing rows and services keep their names. The ID
 * part makes each name unique. The platform can shorten a long name into the hostname and keep hostnames unique
 * (SO-06), so the private address comes from the platform, never from this name.
 */
export function serviceNameOf(prefix: string, organizationId: string, organizationName?: string | null): string {
  const idPart = organizationId.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  const namePart = organizationSlugOf(organizationName ?? '');
  return namePart === '' ? `${prefix}${idPart}` : `${prefix}${namePart}-${idPart}`;
}

// The organization name in its compatibility decomposition (NFKD), without marks, and in lower case, with one hyphen
// for each run of characters outside a-z and 0-9, no hyphen at its ends, and at most ORGANIZATION_SLUG_LIMIT
// characters. It is empty when no such letter or digit stays, for example for a name in Hebrew letters only.
function organizationSlugOf(organizationName: string): string {
  const hyphenated = organizationName.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return hyphenated.replace(/^-|-$/g, '').slice(0, ORGANIZATION_SLUG_LIMIT).replace(/-$/, '');
}

/**
 * The variables of the first deploy of a free tenant. The create call starts that deploy, so the call holds each
 * tenant setting. The list is closed: no WorkOS secret, database setting, platform setting, or Stripe setting can enter
 * it (decision D-14).
 */
export function freeTenantEnvironment(organizationId: string, settings: TenantPublicSettings): ReadonlyMap<string, string> {
  return new Map([
    ['THERMUS_ROLE', 'tenant'],
    ['TENANT_ORGANIZATION_ID', organizationId],
    ['PUBLIC_BASE_URL', settings.publicBaseUrl],
    ['WORKOS_AUTHKIT_ISSUER', settings.authkitIssuer],
    ['GATEWAY_PUBLIC_KEY', settings.gatewayPublicKey],
    ['CONTROL_PLANE_INTERNAL_URL', settings.controlPlaneInternalUrl],
    ['OPERATION_CAPACITY', String(OPERATION_CAPACITY_BY_TIER.free)],
  ]);
}

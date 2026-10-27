// D-15, final on 27 October 2026: a free tenant serves 5 tool calls at a time, and a team tenant 10. The provisioner
// sets the value of the tier in the tenant; the default of OPERATION_CAPACITY in the source stays 10.
const OPERATION_CAPACITY_BY_TIER = { free: 5, team: 10 } as const;

/** The public values of the control plane that each tenant gets (plan section 4.1). None of them is a secret. */
export interface TenantPublicSettings {
  readonly publicBaseUrl: string;
  readonly authkitIssuer: string;
  // One or more PEM public keys of the gateway, separated by commas.
  readonly gatewayPublicKey: string;
  readonly controlPlaneInternalUrl: string;
}

/**
 * The name of the service of an organization: the prefix and the organization ID in lower case, with each character
 * outside a-z, 0-9, and hyphen as a hyphen (27 October 2026). Render makes the slug of the private address from the
 * name up to its first underscore, so a name without one keeps each tenant address whole and distinct.
 */
export function serviceNameOf(prefix: string, organizationId: string): string {
  return `${prefix}${organizationId.toLowerCase().replace(/[^a-z0-9-]/g, '-')}`;
}

/**
 * The variables of the first deploy of a free tenant. The create call starts that deploy, so the call holds each
 * tenant setting. The list is closed: no WorkOS secret, database setting, Render setting, or Stripe setting can enter
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

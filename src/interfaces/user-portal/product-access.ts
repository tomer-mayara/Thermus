// The product access answer of the server for the organization that the session selected. The portal shows these values
// as text; they select no tenant and give no access. A free plan has a member limit, and a team plan has none.
type ProductPlan = { readonly plan: 'free'; readonly memberLimit: number } | { readonly plan: 'team' };

export type ProductAccess = ProductPlan & {
  readonly organizationId: string;
  readonly organizationName: string;
  readonly roles: readonly string[];
  readonly mcpUrl: string;
};

type AnswerField = 'organizationId' | 'organizationName' | 'roles' | 'plan' | 'memberLimit' | 'mcpUrl';

// An answer that does not keep the contract throws, so that the portal shows the safe error and no guide.
export function productAccess(body: unknown): ProductAccess {
  const { organizationId, organizationName, roles, plan, memberLimit, mcpUrl } = (body ?? {}) as Partial<Record<AnswerField, unknown>>;
  if (typeof organizationId !== 'string' || typeof organizationName !== 'string' || organizationName.trim() === ''
    || !Array.isArray(roles) || typeof mcpUrl !== 'string') throw new Error('The product access answer is not valid');
  const endpoint = new URL(mcpUrl);
  if (!['http:', 'https:'].includes(endpoint.protocol) || endpoint.username || endpoint.password) throw new Error('The MCP endpoint is not valid');
  return { organizationId, organizationName, roles: roles.map(String), mcpUrl, ...productPlan(plan, memberLimit) };
}

// A plan name that this portal does not know gives the safe error, so that it never shows the text of another plan.
function productPlan(plan: unknown, memberLimit: unknown): ProductPlan {
  if (plan === 'team') return { plan };
  if (plan === 'free' && typeof memberLimit === 'number' && Number.isSafeInteger(memberLimit) && memberLimit > 0) return { plan, memberLimit };
  throw new Error('The product access answer has no valid plan');
}

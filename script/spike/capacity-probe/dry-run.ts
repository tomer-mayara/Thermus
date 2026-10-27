import { API_BASE, FREE_PLAN, TEAM_PLAN } from '../render-tenant-lifecycle/calls.ts';
import { connectRedirectUri, connectScope } from '../../../test/support/hosted-live/settings.ts';
import { newState, REUSE_OPTION, ROLES, type Role } from './context.ts';
import {
  api, baseUrlCalls, cleanupCalls, healthCall, liveCalls, other, pageChecks, planCalls, preflightCalls, windowCalls, type Plan, type Planned,
} from './dry-run-steps.ts';
import type { ProbeInputs } from './inputs.ts';
import { LIVE_GATE_RESOURCE, RESOURCES_PATH } from './oauth-resource.ts';
import { pagesCreateCall } from './origin.ts';
import { PAGES_IMAGE } from './pages.ts';
import { STAGING_CLIENT_ID, STAGING_ISSUER } from './secrets.ts';
import { tenantCreateCall } from './tenant.ts';
import { predictedOrigin, resourceOf, SECRET_SHOWN, tenantVariables } from './variables.ts';

interface PlannedStep {
  readonly title: string;
  readonly calls: readonly Planned[];
}

const DRY_RUN = 'YYYYMMDD-HHMMSS';

function identityCalls(plan: Plan): readonly Planned[] {
  const resource = plan.reused.tenant ? `${plan.origins.tenant}/mcp` : resourceOf(plan.origins.tenant);
  return [
    other(`WorkOS: GET ${RESOURCES_PATH}`, `${resource} is registered only when it is not listed.`),
    other(`WorkOS: POST ${RESOURCES_PATH} { "uri": "${resource}" }`, 'Only when not listed. One indicator is added, and no other changes. The returned ID is the ID that the cleanup may delete.', { write: true, optional: true }),
    other(`WorkOS: GET ${RESOURCES_PATH}`, `After the create: the new ID and the live gate URI ${LIVE_GATE_RESOURCE} must be listed.`, { optional: true }),
    other('WorkOS: POST /organizations, /user_management/users, /user_management/organization_memberships, /connect/applications', `The hosted-live fixtures, named with the run ID so01e-${DRY_RUN.toLowerCase()}: one organization, one user with the role user, and one OAuth application with PKCE and the redirect URI ${connectRedirectUri}.`, { write: true }),
    other(`Browser: GET ${STAGING_ISSUER}/oauth2/authorize`, `In a headless Chromium: response_type=code, client_id={clientId}, redirect_uri=${connectRedirectUri}, PKCE S256, state, scope "${connectScope}", resource=${resource}. The driver fills the AuthKit sign-in and consent pages; the callback is intercepted.`),
    other(`AuthKit: POST ${STAGING_ISSUER}/oauth2/token`, `grant_type=authorization_code with the code, the verifier, and resource=${resource}. The token is never printed; its audience, organization, user, and lifetime are checked.`),
    other(`MCP: POST ${plan.origins.tenant}/mcp, initialize and tools/list`, 'With the bearer token. The tools must be getURLAsMarkdown and search.'),
  ];
}

function setupStep(plan: Plan): PlannedStep {
  const { inputs } = plan;
  const variables = tenantVariables(predictedOrigin(plan.names.tenant), { apiKey: SECRET_SHOWN, clientId: STAGING_CLIENT_ID, authkitIssuer: STAGING_ISSUER }, SECRET_SHOWN);
  const tenantCreate = tenantCreateCall({ source: inputs, name: plan.names.tenant, credentialId: '{registryCredentialId}', variables });
  return { title: 'Setup', calls: [
    ...liveCalls(plan, 'pages', pagesCreateCall(inputs, plan.names.pages)),
    api({ method: 'GET', path: `/services/${plan.ids.pages}` }, 'serviceDetails.url must be https://<name>.onrender.com. It becomes {pagesOrigin}.'),
    healthCall(plan, 'pages'),
    ...pageChecks(plan),
    ...liveCalls(plan, 'tenant', tenantCreate),
    ...baseUrlCalls(plan),
    ...(plan.reused.tenant ? planCalls(plan, FREE_PLAN, 'Only when the given tenant service is not on 0.5c-512mb: ') : []),
    healthCall(plan, 'tenant'),
    ...identityCalls(plan),
  ] };
}

function plannedSteps(plan: Plan): readonly PlannedStep[] {
  const preflight = { title: 'Preflight (reads only)', calls: preflightCalls(plan) };
  if (plan.inputs.preflightOnly) return [preflight];
  const steps: Record<string, () => PlannedStep> = {
    setup: () => setupStep(plan),
    'calls-free': () => ({ title: `Calls on ${FREE_PLAN}`, calls: windowCalls(plan, FREE_PLAN) }),
    'plan-team': () => ({ title: `Plan change to ${TEAM_PLAN}`, calls: [...planCalls(plan, TEAM_PLAN, ''), healthCall(plan, 'tenant')] }),
    'calls-team': () => ({ title: `Calls on ${TEAM_PLAN}`, calls: windowCalls(plan, TEAM_PLAN) }),
  };
  const chosen = plan.inputs.steps.flatMap((id) => (steps[id] === undefined ? [] : [steps[id]()]));
  return [preflight, ...chosen, { title: 'Cleanup (always, also after a failure or a stop signal)', calls: cleanupCalls(plan) }];
}

function writeCount(steps: readonly PlannedStep[]): string {
  const writes = steps.flatMap((step) => step.calls).filter((item) => item.write);
  const optional = writes.filter((item) => item.optional).length;
  if (writes.length === 0) return 'none: the Render client refuses each write';
  return `${writes.length} kinds of write; ${optional} of them only when needed (the notes that start with "Only")`;
}

function callText(planned: Planned): string[] {
  const lines = [planned.line];
  if (planned.body !== undefined) lines.push(...JSON.stringify(planned.body, null, 2).split('\n').map((line) => `  ${line}`));
  lines.push(`  -> ${planned.note}`);
  return lines;
}

function header(plan: Plan, steps: readonly PlannedStep[]): readonly string[] {
  const { inputs } = plan;
  const service = (role: Role): string => (plan.reused[role] ? `${plan.ids[role]}, given with ${REUSE_OPTION[role]}` : `${plan.names[role]}, created by this run`);
  const end = inputs.preflightOnly ? 'no cleanup' : `the services are ${inputs.keep ? 'kept (--keep)' : 'deleted at the end'}`;
  return [
    '# SO-01e dry run: planned calls', '',
    `No network call and no write. Real mode sends the Render calls in this order to ${API_BASE}, with the header`,
    '"Authorization: Bearer <RENDER_API_KEY>", and the WorkOS calls with the WorkOS Staging key; no key is printed.',
    `A secret value is shown as ${SECRET_SHOWN}. Query values are shown decoded. Values in braces come from earlier answers.`,
    'In real mode, YYYYMMDD-HHMMSS is the UTC start time. A line that starts with "From this machine", "Browser", "AuthKit",',
    'or "MCP" is not a Render API call and sends no Render key.', '',
    `- Workspace: ${inputs.owner}; region ${inputs.region}`,
    `- Tenant service: ${service('tenant')}; image ${inputs.image.ref}`,
    `- Pages origin: ${service('pages')}; image ${PAGES_IMAGE}`,
    `- Steps: ${inputs.preflightOnly ? 'the preflight only' : inputs.steps.join(', ')}; ${end}`,
    `- Parallelism ${inputs.parallelism.join(', ')}; workloads ${inputs.workloads.join(', ')}`,
    `- Writes: ${writeCount(steps)}`,
  ];
}

export function renderDryRun(inputs: ProbeInputs): string {
  const { services } = newState(inputs, DRY_RUN);
  const ids = { tenant: services.tenant.reuseId ?? '{tenantServiceId}', pages: services.pages.reuseId ?? '{pagesServiceId}' };
  const names = { tenant: services.tenant.name, pages: services.pages.name };
  const reused = { tenant: services.tenant.reuseId !== undefined, pages: services.pages.reuseId !== undefined };
  const origins = Object.fromEntries(ROLES.map((role) => [role, reused[role] ? `{${role}Origin}` : predictedOrigin(names[role])])) as Record<Role, string>;
  const plan: Plan = { inputs, names, ids, origins, reused };
  const steps = plannedSteps(plan);
  const body = steps.flatMap((step) => ['', `## ${step.title}`, '', ...step.calls.flatMap(callText)]);
  return `${[...header(plan, steps), ...body].join('\n')}\n`;
}

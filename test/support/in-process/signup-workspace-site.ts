import assert from 'node:assert/strict';
import { createPublicKey } from 'node:crypto';
import type { TestContext } from 'node:test';
import { composeLoggingStorage } from '../../../src/app/logging-storage.ts';
import { gatewayTenantsOf } from '../../../src/app/mcp-gateway-composition.ts';
import { TenantActivity } from '../../../src/tenancy/tenants/tenant-activity.ts';
import { TenantLookup } from '../../../src/tenancy/tenants/tenant-lookup.ts';
import type { TenantState } from '../../../src/tenancy/tenants/tenant-registry-store.ts';
import { TenantRequests } from '../../../src/tenancy/tenants/tenant-requests.ts';
import { TenantResumes } from '../../../src/tenancy/tenants/tenant-resumes.ts';
import { AuditExportSenderSpy } from '../doubles/logging/audit-export-sender-spy.ts';
import { SnapshotSettingsStoreSpy } from '../doubles/logging/snapshot-settings-store-spy.ts';
import { TenantFleetStoreFake } from '../doubles/tenants/tenant-fleet-store-fake.ts';
import { TenantRegistryFake } from '../doubles/tenants/tenant-registry-fake.ts';
import { TenantResumeSpy } from '../doubles/tenants/tenant-resume-spy.ts';
import type { FakeUser, WorkOSFake } from '../doubles/workos/workos-fake.ts';
import { formsIn, type HostedBrowser } from '../drivers/browser/hosted-browser.ts';
import { signInThroughServer } from '../dsl/workos-sign-in.ts';
import { hostedRootConfig } from '../fixtures/hosted-config.ts';
import { gatewayKeyPairOf } from '../fixtures/hosted-tenant.ts';
import { signupDocuments } from '../fixtures/signup-documents.ts';
import { serveWorkOSSite } from './workos-site.ts';

export interface SignupWorkspaceSiteOptions {
  // MCP_TENANTS_ENABLED of the composition. The default is on.
  readonly tenantsEnabled?: boolean;
  // SELF_SERVE_SIGNUP_ENABLED of the composition. The default is on, with the test documents.
  readonly signupEnabled?: boolean;
  readonly freeTenantLimit?: number;
  // The organizations that the WorkOS fake knows at the start, with their memberships and names.
  readonly setUp?: (world: WorkOSFake) => void;
  readonly organizations?: readonly string[];
}

// The time after which the registry copy of the lookup reads the registry again (answer of 27 October 2026).
const COPY_REFRESH_MS = 10_000;

export type SignupWorkspaceSite = Awaited<ReturnType<typeof openSignupWorkspaceSite>>;

// The control plane of SO-07: the real hosted composition against the WorkOS fake and its signup fake, with signup open
// on the test documents. The registry rules of the tenants owner (the lookup copy with a clock of the test, and the
// tenant request inside the cap) run over an in-memory registry. With MCP_TENANTS_ENABLED on, the composition also gets
// the gateway parts on the same rules. The provisioner does not run: a case moves a row as the provisioner would, and
// the provisioner specifications of SO-06 cover that loop.
export async function openSignupWorkspaceSite(t: TestContext, options: SignupWorkspaceSiteOptions = {}) {
  const registry = new TenantRegistryFake();
  let now = 0;
  const clock = (): number => now;
  const requests = new TenantRequests(registry, options.freeTenantLimit ?? 25);
  const lookup = new TenantLookup(registry, clock);
  const settings = new SnapshotSettingsStoreSpy();
  // The provisioning and the fleet statements share one SQL runtime in production; one fake stands in for both.
  const statements = new TenantFleetStoreFake();
  const sender = new AuditExportSenderSpy();
  const loggingStorage = composeLoggingStorage({
    store: settings,
    tenants: { requests, lookup, provisioning: statements, gateway: registry, fleet: statements },
    close: async () => { settings.close(); },
  }, Buffer.alloc(32, 7), sender);
  const keys = gatewayKeyPairOf();
  const gateway = options.tenantsEnabled === false ? undefined : {
    settings: { signingKey: keys.privateKey, verifyingKey: createPublicKey(keys.publicKeyPem), controlPlaneInternalUrl: 'http://thermus-control-plane:8080' },
    tenants: gatewayTenantsOf({ lookup, requests, resumes: new TenantResumes(registry, new TenantResumeSpy()), activity: new TenantActivity(registry, clock) }),
  };
  const site = await serveWorkOSSite(t, {
    config: hostedRootConfig,
    organizations: options.organizations ?? [],
    signupFake: true,
    signup: options.signupEnabled === false ? { enabled: false } : { enabled: true, documents: signupDocuments },
    loggingStorage,
    gateway,
    ...(options.setUp === undefined ? {} : { setUp: options.setUp }),
  });

  // The provisioner moves the row. The next ask of the lookup reads the registry again, as after 10 s.
  const provision = (organizationId: string, state: TenantState, internalUrl?: string): void => {
    registry.set(organizationId, { state, ...(internalUrl === undefined ? {} : { internalUrl }) });
    now += COPY_REFRESH_MS;
  };

  // The organization creation of a verified visitor who opens the signup page at the path, names the organization,
  // and accepts the one agreement.
  const signUp = async (user: FakeUser, organizationName: string, path = 'signup?tier=free') => {
    site.world.users = [...site.world.users, user];
    const { browser } = await signInThroughServer(site, user);
    const form = formsIn((await browser.open(path)).body).find(({ action }) => action === '/signup');
    assert.ok(form, 'The signup page offers the organization form.');
    const answer = await browser.post('signup', { ...form.fields, organization_name: organizationName, agreement: 'accepted' });
    const created = site.signupFake.organizations.at(-1);
    return { browser, answer, organizationId: created === undefined ? undefined : String(created.id) };
  };

  // The portal read of the workspace status, with the cookies of the browser.
  const status = async (browser: HostedBrowser) => {
    const answer = await browser.open('workspace/status', { Accept: 'application/json' });
    const json = answer.headers.get('Content-Type')?.startsWith('application/json') === true;
    return { status: answer.status, body: json ? JSON.parse(answer.body) as unknown : answer.body };
  };

  return { ...site, registry, provision, signUp, status, signIn: (user: FakeUser, organizationId?: string) => signInThroughServer(site, user, organizationId) };
}

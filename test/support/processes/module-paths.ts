import { fileURLToPath } from 'node:url';

// The one module that computes run-time paths from the support code to other folders and to the repository root
// (rule D8 of docs/testing/test-code-layout.md). Its consumers use these paths to start child processes and load
// fixtures. The module runs from the source
// tree (.ts) and from dist/ (.js), where it sits one folder deeper.
const fromSource = import.meta.url.endsWith('.ts');
const extension = fromSource ? 'ts' : 'js';

function siblingModule(name: string): URL {
  return new URL(`./${name}.${extension}`, import.meta.url);
}

function containerModule(name: string): string {
  return fileURLToPath(new URL(`../container/${name}.${extension}`, import.meta.url));
}

export const repositoryRoot = new URL(fromSource ? '../../../' : '../../../../', import.meta.url);

// The portal build that the local HTTPS site serves. It exists only after npm run build:user-portal.
export const portalBuild = fileURLToPath(new URL('src/interfaces/user-portal/dist/', repositoryRoot));

// Offline hosted tests select these local inputs without changing the real portal build. The stub of the Lightpanda
// executable answers only the pinned version.
export const hostedPortalFixture = new URL('test/support/fixtures/hosted-portal/', repositoryRoot);
export const lightpandaStub = fileURLToPath(new URL('test/support/doubles/website-fetcher/lightpanda-stub.sh', repositoryRoot));
export const hostedPortalPreload = siblingModule('use-hosted-portal-fixture').href;

export const programEntry = fileURLToPath(new URL(`../../../src/index.${extension}`, import.meta.url));

// The preloads load by URL through --import. The probe runs as the main module of a new Node process.
export const crashChildHelper = siblingModule('crash-child').href;
export const membershipRemovalChild = fileURLToPath(siblingModule('membership-removal-child'));
export const networkBlocker = siblingModule('deny-network').href;
export const sqlTracer = siblingModule('trace-sqlite').href;
export const foreignOriginProbe = fileURLToPath(siblingModule('foreign-origin-probe'));

export const lingeringHostedHandle = siblingModule('keep-hosted-handle-open').href;
export const heldHostedIdentity = siblingModule('hold-hosted-identity').href;
export const heldHostedCleanup = siblingModule('hold-hosted-cleanup').href;

export const loopbackNetworkBlocker = siblingModule('deny-public-network').href;
export const workosFakeRoute = siblingModule('route-workos-to-fake').href;
export const oneLiveTenant = siblingModule('serve-one-live-tenant').href;

export const containerEdgeScript = containerModule('container-edge');
export const containerPageScript = containerModule('container-page');
export const containerProbeScript = containerModule('container-probe');

export const hostedImageIdentity = containerModule('hosted-image-identity');

// The debug command runs directly from source; no build copies the script.
export const fetchPublicScriptEntry = fileURLToPath(siblingModule('fetch-public-script-entry'));
export const fetchUrlScript = fileURLToPath(new URL('script/fetch-url/fetch-url.ts', repositoryRoot));

// The scoped owner setup of the thermus_admin schema, in the order of the S2-01a process, used by the disposable
// PostgreSQL settings site.
export const thermusAdminMigrations = [
  '20261023211956_logging_destination_settings.sql',
  '20261024231921_add_logging_axiom_dataset.sql',
  '20261025082850_membership_removal_operations.sql',
  '20261027175430_tenant_registry_and_billing.sql',
  '20261031221342_tenant_claim_lease.sql',
  '20261101023017_tenant_sweep_ticks.sql',
].map(name => fileURLToPath(new URL(`sql/migrations/${name}`, repositoryRoot)));

export const auditSenderRuntime = {
  source: fileURLToPath(new URL(fromSource ? 'src/' : 'dist/src/', repositoryRoot)),
  support: fileURLToPath(new URL(fromSource ? 'test/support/' : 'dist/test/support/', repositoryRoot)),
  extension,
};

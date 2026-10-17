import { fileURLToPath } from 'node:url';

// The one module that computes run-time paths from the support code to other folders and to the repository root
// (rule D8 of docs/testing/test-code-layout.md). The compiler cannot check these paths, so
// test/unit/test-support-paths.test.ts proves that each one exists after a build. The module runs from the source
// tree (.ts) and from dist/ (.js), where it sits one folder deeper.
const fromSource = import.meta.url.endsWith('.ts');
const extension = fromSource ? 'ts' : 'js';

function siblingModule(name: string): URL {
  return new URL(`./${name}.${extension}`, import.meta.url);
}

// The folder of package.json.
export const repositoryRoot = new URL(fromSource ? '../../../' : '../../../../', import.meta.url);

// The portal build that the local HTTPS site serves. It exists only after npm run build:user-portal, so the paths
// test checks only its parent folder.
export const portalBuild = fileURLToPath(new URL('src/user-portal/dist/', repositoryRoot));

// Offline hosted tests select these local inputs without changing the real portal build.
export const hostedPortalFixture = new URL('test/support/fixtures/hosted-portal/', repositoryRoot);
export const hostedRendererFixture = fileURLToPath(new URL('test/support/doubles/website-fetcher/lightpanda-stub.sh', repositoryRoot));
export const hostedPortalPreload = siblingModule('use-hosted-portal-fixture').href;

// The program that the child-process sites and the command tests run: dist/src/index.js after a build.
export const programEntry = fileURLToPath(new URL(`../../../src/index.${extension}`, import.meta.url));

// The preloads load by URL through --import. The probe runs as the main module of a new Node process.
export const networkBlocker = siblingModule('deny-network').href;
export const sqlTracer = siblingModule('trace-sqlite').href;
export const foreignOriginProbe = fileURLToPath(siblingModule('foreign-origin-probe'));
export const workSliceShutdownProbe = fileURLToPath(siblingModule('work-slice-shutdown-probe'));

export const lingeringHostedHandle = siblingModule('keep-hosted-handle-open').href;
export const heldHostedIdentity = siblingModule('hold-hosted-identity').href;
export const heldHostedCleanup = siblingModule('hold-hosted-cleanup').href;

// Files mounted into the hosted-image gate; none is copied into the final image.
export const hostedImageIdentity = fileURLToPath(new URL(`../container/hosted-image-identity.${extension}`, import.meta.url));
export const hostedImagePage = fileURLToPath(new URL(`../container/hosted-image-page.${extension}`, import.meta.url));
export const hostedImageProbe = fileURLToPath(new URL(`../container/hosted-image-probe.${extension}`, import.meta.url));

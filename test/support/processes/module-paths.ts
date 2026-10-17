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

function containerModule(name: string): string {
  return fileURLToPath(new URL(`../container/${name}.${extension}`, import.meta.url));
}

// The folder of package.json.
export const repositoryRoot = new URL(fromSource ? '../../../' : '../../../../', import.meta.url);

// The portal build that the local HTTPS site serves. It exists only after npm run build:user-portal, so the paths
// test checks only its parent folder.
export const portalBuild = fileURLToPath(new URL('src/user-portal/dist/', repositoryRoot));

// Offline hosted tests select these local inputs without changing the real portal build. The stub of the Lightpanda
// executable answers only the pinned version.
export const hostedPortalFixture = new URL('test/support/fixtures/hosted-portal/', repositoryRoot);
export const lightpandaStub = fileURLToPath(new URL('test/support/doubles/website-fetcher/lightpanda-stub.sh', repositoryRoot));
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

// The container sites send these scripts into containers. container-site.ts copies the edge and the page seam, and
// hosted-image-gate.ts mounts the page seam. container-gate.ts and hosted-image-gate.ts send the probe on standard
// input. The paths test proves that each one exists after a build.
export const containerEdgeScript = containerModule('container-edge');
export const containerPageScript = containerModule('container-page');
export const containerProbeScript = containerModule('container-probe');

// The identity preload that the hosted-image gate mounts. It is not copied into the final image.
export const hostedImageIdentity = containerModule('hosted-image-identity');

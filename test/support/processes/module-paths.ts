import { fileURLToPath } from 'node:url';

// The one module that computes run-time paths from the support code to other folders and to the repository root
// (rule D8 of docs/testing/test-code-layout.md). The compiler cannot check these paths, so
// test/unit/test-support-paths.test.ts proves that each one exists after a build. The module runs from the source
// tree (.ts) and from dist/ (.js), where it sits one folder deeper.
const fromSource = import.meta.url.endsWith('.ts');
const extension = fromSource ? 'ts' : 'js';

function supportModule(name: string): URL {
  return new URL(`../${name}.${extension}`, import.meta.url);
}

// The folder of package.json.
export const repositoryRoot = new URL(fromSource ? '../../../' : '../../../../', import.meta.url);

// The portal build that the local HTTPS site serves. It exists only after npm run build:user-portal, so the paths
// test checks only its parent folder.
export const portalBuild = fileURLToPath(new URL('src/user-portal/dist/', repositoryRoot));

// The program that the child-process sites and the command tests run: dist/src/index.js after a build.
export const programEntry = fileURLToPath(new URL(`../../../src/index.${extension}`, import.meta.url));

// The preloads load by URL through --import. The probe runs as the main module of a new Node process.
export const networkBlocker = supportModule('deny-network').href;
export const sqlTracer = supportModule('trace-sqlite').href;
export const foreignOriginProbe = fileURLToPath(supportModule('foreign-origin-probe'));

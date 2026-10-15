import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { trustedAdRulesFile } from '../support/fixtures/ad-rules.ts';
import { probeScript } from '../support/container/container-gate.ts';
import { edgeScript, pageScript } from '../support/container/container-site.ts';
import { foreignOriginProbe, networkBlocker, portalBuild, programEntry, repositoryRoot, sqlTracer } from '../support/processes/module-paths.ts';
import { failingAdCleaner } from '../support/processes/server-preloads.ts';

// The support code computes these paths at run time, so the compiler cannot check them. A moved module, preload,
// or fixture file otherwise fails only in the suite that uses it, and the container and live gates run rarely.
const files = {
  programEntry,
  networkBlocker: fileURLToPath(networkBlocker),
  sqlTracer: fileURLToPath(sqlTracer),
  foreignOriginProbe,
  failingAdCleaner: fileURLToPath(failingAdCleaner),
  trustedAdRulesFile,
  edgeScript,
  pageScript,
  probeScript,
};

describe('Run-time paths of the test support code', () => {
  for (const [name, path] of Object.entries(files)) {
    test(`Given a build, when ${name} is resolved, then it names a file that exists`, () => {
      assert.ok(existsSync(path), `${name} names ${path}, which does not exist.`);
    });
  }

  // The portal build exists only after npm run build:user-portal, which npm run check runs after the unit tests.
  test('Given the repository, when the portal build is resolved, then it is the dist folder of the portal source', () => {
    assert.ok(existsSync(dirname(portalBuild)), `${portalBuild} is not under the portal source.`);
    assert.ok(portalBuild.endsWith('/src/user-portal/dist/'), portalBuild);
  });

  test('Given a build, when the repository root is resolved, then it is the folder of package.json', () => {
    assert.ok(existsSync(new URL('package.json', repositoryRoot)), `${repositoryRoot.href} holds no package.json.`);
  });
});

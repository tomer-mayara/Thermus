import assert from 'node:assert/strict';
import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL(import.meta.url.endsWith('.ts') ? '../../../' : '../../../../', import.meta.url));
const script = join(root, 'docker/check-lightpanda-digest.sh');
const runtimeGuide = readFileSync(join(root, 'docs/lightpanda-runtime.md'), 'utf8');
// The Docker target architecture and the name of the Lightpanda asset for it in the runtime guide.
const platforms = [['amd64', 'x86_64-linux'], ['arm64', 'aarch64-linux']] as const;

function recordedDigest(asset: string): string {
  const digest = new RegExp(`^ *${asset}\\) lightpanda_sha256=([0-9a-f]{64}) ;;$`, 'm').exec(runtimeGuide)?.[1];
  assert.ok(digest, `docs/lightpanda-runtime.md records no digest for ${asset}`);
  return digest;
}

// The unit suite has no Lightpanda asset, so a sha256sum double gives the check the digest of the asset.
function checkAsset(t: TestContext, architecture: string, digest: string): SpawnSyncReturns<string> {
  const directory = mkdtempSync(join(tmpdir(), 'thermus-digest-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const sha256sum = join(directory, 'sha256sum');
  writeFileSync(sha256sum, `#!/bin/sh\nprintf '%s  %s\\n' '${digest}' "$1"\n`);
  chmodSync(sha256sum, 0o755);
  const environment = { ...process.env, PATH: `${directory}:${process.env.PATH ?? ''}` };
  return spawnSync('sh', [script, architecture, join(directory, 'lightpanda')], { encoding: 'utf8', env: environment });
}

for (const [architecture, asset] of platforms) {
  test(`Given the asset digest that docs/lightpanda-runtime.md records for linux/${architecture}, when the image build checks the asset, then the check accepts it without output`, (t) => {
    const result = checkAsset(t, architecture, recordedDigest(asset));

    assert.deepEqual([result.status, result.stdout, result.stderr], [0, '', '']);
  });
}

for (const [architecture, asset] of platforms) {
  test(`Given another digest for linux/${architecture}, also the digest of the other Linux asset, when the image build checks the asset, then the check stops the build with an error that names the platform and both digests`, (t) => {
    const expected = recordedDigest(asset);
    const others = [...platforms.filter(([other]) => other !== architecture).map(([, name]) => recordedDigest(name)), '0'.repeat(64)];

    for (const other of others) {
      const result = checkAsset(t, architecture, other);

      assert.equal(result.status, 1, result.stderr);
      assert.equal(result.stdout, '');
      assert.equal(result.stderr, `Lightpanda SHA256 check failed for linux/${architecture}: the asset has the digest ${other}, `
        + `but docs/lightpanda-runtime.md records ${expected}. The image build stops.\n`);
    }
  });
}

test('Given a target architecture without a Lightpanda 1.0.0 Linux asset, when the image build checks an asset for it, then the check stops the build with an error that names the supported platforms', (t) => {
  const result = checkAsset(t, 's390x', recordedDigest('x86_64-linux'));

  assert.equal(result.status, 1, result.stderr);
  assert.equal(result.stderr, 'Lightpanda 1.0.0 has no Linux asset for s390x. The image supports linux/amd64 and linux/arm64.\n');
});

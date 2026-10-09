import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

test('a deployment without test fixtures applies supplied rules across working directories', (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'magumagu-ad-rules-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const deployment = join(directory, 'deployment');
  const firstCwd = join(directory, 'first');
  const secondCwd = join(directory, 'second');
  mkdirSync(firstCwd);
  mkdirSync(secondCwd);
  cpSync(new URL('../../src/', import.meta.url), join(deployment, 'src'), { recursive: true });
  writeFileSync(join(deployment, 'package.json'), '{"type":"module"}');
  symlinkSync(fileURLToPath(new URL('../../../node_modules/', import.meta.url)),
    join(deployment, 'node_modules'), 'dir');
  assert.equal(existsSync(join(deployment, 'test')), false);

  const moduleUrl = pathToFileURL(join(deployment,
    'src/html-cleaner-pipeline/ad-cleaner/adb/clean-html-ads-adblock-rs.js')).href;
  const script = `
    const { CleanHtmlAdsAdblockRs } = await import(process.argv[1]);
    const rules = 'example.com##.advert';
    const cleaner = new CleanHtmlAdsAdblockRs(rules);
    const input = {
      url: 'https://example.com/article',
      html: '<p>Story</p><aside class="advert">Ad</aside>',
      removed: 0,
      skipped: 0,
    };
    const before = await cleaner.invoke(input);
    process.chdir(process.argv[2]);
    const after = await cleaner.invoke(input);
    const fresh = await new CleanHtmlAdsAdblockRs(rules).invoke(input);
    console.log(JSON.stringify([before, after, fresh]));
  `;

  for (const [cwd, nextCwd] of [[firstCwd, secondCwd], [secondCwd, firstCwd]]) {
    const child = spawnSync(process.execPath, ['--input-type=module', '--eval', script, moduleUrl, nextCwd],
      { cwd, encoding: 'utf8', timeout: 10_000 });
    assert.equal(child.error, undefined);
    assert.equal(child.status, 0, child.stderr);
    assert.deepEqual(JSON.parse(child.stdout), Array.from({ length: 3 }, () => ({
      url: 'https://example.com/article',
      html: '<p>Story</p>',
      removed: 1,
      skipped: 0,
    })));
  }
});

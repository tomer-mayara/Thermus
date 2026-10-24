import { readFile, writeFile } from 'node:fs/promises';
import { test } from 'node:test';
import { runHostedAuditJourney } from '../in-process/hosted-audit-journey-site.ts';

test('Observe the public hosted audit journey', async t => {
  const destination = JSON.parse(await readFile('/fixture/public-journey.json', 'utf8'));
  const result = await runHostedAuditJourney(t, destination);
  await writeFile('/fixture/public-journey-result.json', JSON.stringify(result));
});

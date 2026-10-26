import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { organizationRemovalDocuments } from '../../../src/accounts/providers/workos/workos-organization-removal-documents.ts';

const source = 'docs/legal/organization-removal-2026-10-26-proposal-v1';

for (const [part, file, version, bytes, sha256] of [
  ['terms', 'terms.md', 'hosted-terms-organization-removal-proposal-2026-10-26-v1', 20941, '164e013e2cbf0889ad5aaaef14aac745acaed01023bc914c7adae1a4bf4ce048'],
  ['notice', 'privacy.md', 'hosted-privacy-organization-removal-proposal-2026-10-26-v1', 38594, 'df330cf3d905f4bd6f64d3a9dfd8dded5be476c39e40e05b87596e6678429b1c'],
  ['agreement', 'agreement.txt', 'hosted-agreement-organization-proposal-2026-10-23-v2', 378, '279cb2f3005131618bcf7f3ea755ad09205dca3c490f2c3de0c70b25e1ef2a9a'],
] as const) {
  test(`Given the approved removal ${part}, when the runtime bundle loads, then its exact frozen bytes, version and hash are retained`, async () => {
    const document = organizationRemovalDocuments[part];
    assert.equal(document.text, await readFile(`${source}/${file}`, 'utf8'));
    assert.equal(document.version, version);
    assert.equal(Buffer.byteLength(document.text), bytes);
    assert.equal(createHash('sha256').update(document.text).digest('hex'), sha256);
    if ('sha256' in document) assert.equal(document.sha256, sha256);
    assert.ok(Object.isFrozen(document));
  });
}

test('Given the approved removal documents, when the runtime bundle loads, then its frozen purpose and version authorize organization creation only', () => {
  assert.equal(organizationRemovalDocuments.purpose, 'organization-creation');
  assert.equal(organizationRemovalDocuments.version, 's2502-organization-removal-proposal-2026-10-26-v1');
  assert.ok(Object.isFrozen(organizationRemovalDocuments));
});

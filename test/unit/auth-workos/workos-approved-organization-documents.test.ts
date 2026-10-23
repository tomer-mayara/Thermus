import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

test('Given the approved organization bundle, when loaded, then its frozen documents retain the approved canonical bytes, versions, and purpose', async () => {
  const { approvedOrganizationDocuments } = await import('../../../src/accounts/providers/workos/workos-approved-organization-documents.ts');
  assert.equal(approvedOrganizationDocuments.purpose, 'organization-creation');
  assert.equal(approvedOrganizationDocuments.version, 's105-organization-proposal-2026-10-23-v2');
  const documents = [
    ['terms', 'terms.md', 'hosted-terms-organization-proposal-2026-10-23-v2', 18896, '625010f6b3fd118c13a29cca29cfb066d5511d7d91d0c29e0e430ac0bdc14d0e'],
    ['notice', 'privacy.md', 'hosted-privacy-organization-proposal-2026-10-23-v2', 29125, 'd44db6099b758534e8d17f34bcda7096e02775ffccb40972ea1429093c1396ac'],
    ['agreement', 'agreement.txt', 'hosted-agreement-organization-proposal-2026-10-23-v2', 378, '279cb2f3005131618bcf7f3ea755ad09205dca3c490f2c3de0c70b25e1ef2a9a'],
  ] as const;
  assert.ok(Object.isFrozen(approvedOrganizationDocuments));
  for (const [part, file, version, bytes, hash] of documents) {
    const document = approvedOrganizationDocuments[part];
    assert.equal(document.text, await readFile(`docs/legal/organization-signup-2026-10-23/${file}`, 'utf8'));
    assert.equal(document.version, version);
    assert.equal(Buffer.byteLength(document.text), bytes);
    assert.equal(createHash('sha256').update(document.text).digest('hex'), hash);
    if ('sha256' in document) assert.equal(document.sha256, hash);
    assert.ok(Object.isFrozen(document));
  }
});

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { organizationAuditDocuments } from '../../../src/accounts/providers/workos/workos-organization-audit-documents.ts';

const source = 'docs/legal/organization-audit-2026-10-24-proposal-v3';

for (const [part, file, version, sha256] of [
  ['terms', 'terms.md', 'hosted-terms-organization-audit-proposal-2026-10-24-v3', 'ce5f1afb9ac2759117b722a4d819b6207f23e2ff99f15d09a5abbd9e1b32eee3'],
  ['notice', 'privacy.md', 'hosted-privacy-organization-audit-proposal-2026-10-24-v3', '692801219c0ac19c50300cd188cfd2ca55cb7e89caaba656269e484b44d4dcc6'],
  ['agreement', 'agreement.txt', 'hosted-agreement-organization-proposal-2026-10-23-v2', '279cb2f3005131618bcf7f3ea755ad09205dca3c490f2c3de0c70b25e1ef2a9a'],
] as const) {
  test(`S2-04 Given the prepared organization Audit ${part}, when the runtime bundle loads, then it preserves the exact UTF-8 bytes, version, and review hash`, async () => {
    const document = organizationAuditDocuments[part];
    assert.equal(document.text, await readFile(`${source}/${file}`, 'utf8'));
    assert.equal(document.version, version);
    assert.equal(createHash('sha256').update(document.text, 'utf8').digest('hex'), sha256);
    if ('sha256' in document) assert.equal(document.sha256, sha256);
    assert.ok(Object.isFrozen(document));
  });
}

test('S2-04 Given the prepared organization Audit documents, when the runtime bundle loads, then the frozen bundle binds them to organization creation with its review version', () => {
  assert.ok(Object.isFrozen(organizationAuditDocuments));
  assert.equal(organizationAuditDocuments.purpose, 'organization-creation');
  assert.equal(organizationAuditDocuments.version, 's204-organization-audit-proposal-2026-10-24-v3');
});

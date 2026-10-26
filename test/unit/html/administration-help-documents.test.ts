import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { auditHelpDocument, membersRemovalHelpDocument } from '../../../src/interfaces/web/account/administration-help-documents.ts';

for (const [document, file, version, bytes, sha256] of [
  [auditHelpDocument, 'audit-help.md', 'hosted-audit-help-organization-removal-proposal-2026-10-26-v1', 2961, '91c500488861110b50b01aea8cda7ba60cf5a7990e5a398a9124742b77588391'],
  [membersRemovalHelpDocument, 'members-help.md', 'hosted-members-help-organization-removal-proposal-2026-10-26-v1', 2414, '853d344d0f861fd3a53ed05b846909108d56d39d6105a7fa4fcc626e0d1aa9ca'],
] as const) {
  test(`Given the approved ${file}, when account help loads, then its frozen exact bytes, version and hash remain together`, async () => {
    assert.equal(document.text, await readFile(`docs/legal/organization-removal-2026-10-26-proposal-v1/${file}`, 'utf8'));
    assert.equal(document.version, version);
    assert.equal(Buffer.byteLength(document.text), bytes);
    assert.equal(createHash('sha256').update(document.text).digest('hex'), sha256);
    assert.equal(document.sha256, sha256);
    assert.ok(Object.isFrozen(document));
  });
}

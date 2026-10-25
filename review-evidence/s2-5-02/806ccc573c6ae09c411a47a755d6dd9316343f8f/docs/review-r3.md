# Review revision 3: current Audit form and Test flow

Independent review identified inherited help that described a None option and a
Test action that did not save. Read the complete current logging-page.ts,
logging-form.ts, logging-routes.ts, logging-test-page.ts, and
DestinationSettingsService. Corrected audit-help.md and privacy.md together.
Current Axiom/Custom form requires Bearer. Axiom needs a dataset; Custom rejects
one. Blank token keeps the saved Bearer only for the same endpoint. The current
form supplies no None/token-removal control. The masked preview can show four
token characters. Test first saves submitted destination and enabled state, then
uses that saved revision for the synthetic event. Failed/unconfirmed Save sends
no Test; Test failure cannot roll back Save. Source hashes are in manifest.

Reviewed remaining public copy against the existing source contracts: authority,
exact membership scope, last active Admin, pending invitations, unknown/no retry,
operation record fields and lifetime, removal/export metadata, capture/redaction
and byte limits, bounded-memory delivery/loss/duplicates, and no-backup scope.
No additional source/copy contradiction was found. The five proposed public
files contain no stale None-removes, Test-does-not-save, invitation-only or
no-member-removal statement. Historical before-text stays in changes.patch;
README describes the still-selected older frozen runtime bundle accurately.

Updated S4 future recovery guidance: Test applies the submitted enabled state;
keep the switch off until explicit Admin enable is intended. This is a procedure
correction, not a claim that the future recovery procedure was executed.

Manifest r3 retains r2's complete document hashes and manifest hash, plus the r2
history that links r1. Cache retains manifest-review-r2.json and
verification-review-r2.json. Current verification.json passes 36 manual artifact
checks and 54 relative links. Patch replay reproduces every proposed public
file. Prior legal bytes, frozen modules and runtime selection remain unchanged.
Current help source hashes also match all five inspected files.

No source change, database execution, build, test, subagent, commit, publication,
legal approval or deployed presentation is claimed. Exact owner decisions and
release holds remain in the proposal README and manager ledger.

Root review follow-up: removed the duplicate consecutive historical-drill
limitation paragraph from admin-s4-recovery.md. Terms/Privacy role and MFA text
was read again: no role editor is offered and MFA status remains no application
access requirement. No additional current UI contradiction was found.

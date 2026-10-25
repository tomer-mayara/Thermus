# Audit destination selector implementation

Manager owns the complete-candidate checks, documents, impact declaration, commits, and PR. This worker made no commit, push, PR, migration, service, sender, store, or public settings contract change.

## Red and green evidence

Node runtime: `pnpm exec node --version` -> v24.20.0.

1. BDD first: `pnpm exec node --import tsx --test --test-name-pattern='Admin choosing an audit destination' test/acceptance/logging/hosted-destination-settings.test.ts` failed before implementation. The first assertion required the missing Destination legend. The scenario also required Axiom/Custom selection, the exact short privacy notice, Bearer-only UI, and save/reread of Axiom. Manager was notified before source implementation.
2. Direct source test execution without `--import tsx` failed on existing TypeScript constructor parameter properties. This was a test-runner setup failure, not the BDD red. All subsequent focused commands use tsx.
3. Form TDD: `pnpm exec node --import tsx --test test/unit/html/logging-form.test.ts` -> 4 failures, then 7/7 pass. Cases cover known required single destination, Axiom dataset syntax/length/absence, Custom nonempty dataset refusal, forged None authentication, duplicates, and CSRF-first refusal.
4. Page TDD: `pnpm exec node --import tsx --test test/unit/html/logging-page.test.ts` -> 4 failures before page/script implementation. Combined page/form suite -> 10/11 pass; the DOM fixture showed that its required property does not reflect to the attribute. Browser code now uses toggleAttribute for required/disabled. Combined page/form suite then -> 11/11 pass. It covers saved selection inference, write-only token, switching without lost edits, conditional hidden/required/disabled dataset, script hash, unchanged Members script restriction, and usable no-JS fields/instructions.
5. BDD scenario rerun -> 1/1 pass.
6. Focused regression batch -> 105/106 pass. One expected destination object accidentally included the private UI field; corrected that fixture (service contract remains unchanged).
7. Final focused regression batch -> 109/109 pass, no skipped or deferred cases in that batch.

Final focused command:

```sh
pnpm exec node --import tsx --test test/unit/html/logging-form.test.ts test/unit/html/logging-page.test.ts test/unit/html/logging-routes.test.ts test/unit/html/logging-test-routes.test.ts test/acceptance/logging/hosted-destination-settings.test.ts test/acceptance/logging/hosted-destination-test.test.ts test/integration/hosted-admin/account-routes-logging.test.ts test/integration/hosted-admin/account-routes-audit.test.ts test/acceptance/logging/audit/administration-capture.test.ts
```

No broad suite, coverage, or metrics command was run by this worker. Runtime Collector tests and changed probes are left to the manager's coordinated gate run. They must run before commit.

## Behavior and boundaries

- A nonempty saved dataset selects Axiom; all other saved rows and an absent destination select Custom.
- Both choices submit hidden auth=bearer. Axiom requires 1–128 ASCII letters/digits/hyphens. Custom permits only an absent or empty dataset. Choice is a required single known form field. Auth=None and forged combinations fail at the server form boundary before a service call. CSRF validation retains precedence.
- The browser script changes only dataset visibility, disabled, and required state. It preserves endpoint, token, and dataset edits across switches. Only Audit logs receives the exact script SHA-256 CSP permission. Members retains default-src none without script-src permission. No unsafe-inline, unsafe-eval, framework, or new dependency.
- Without scripts, the dataset stays visible and editable with instructions to clear it for Custom. Server validation is authoritative. Acceptance uses the existing non-script browser helper to save Axiom then Custom and confirms the dataset is removed.
- Saved tokens stay blank/write-only. Same endpoint and Bearer can retain a blank token. An endpoint change requires a new token; acceptance verifies refusal and unchanged saved settings. HTTP and blank endpoints remain invalid through the existing service.
- Legacy None rows remain readable and unchanged until explicit Save. The UI requires a new Bearer token and says Save before Test. Acceptance at root and nested public paths confirms Test before upgrade sends nothing and does not rewrite the row, then Save with a new token upgrades and Test uses Bearer.
- The warning contains only the requested authority/access/retention/Privacy Policy prose and the original privacy URL. Action guidance is short and says Save before Test.

## Changed runtime coverage

The runtime test of the real logging form now Tests two saved Bearer destinations: the Collector's unauthenticated receiver and its Bearer receiver. Its two synthetic event, no settings rewrite, revision, content, and secrecy assertions remain. Other runtime tests still verify None and Bearer sender/service behavior. The destination probe asserts inferred destination and Bearer form fields; the public hosted journey asserts Custom and Bearer. Neither expands service contracts.

## Review notes

Likely T1 for changed protected form behavior and scoped script CSP; manager must classify complete candidate. No storage migration or public module export change is intended. No application-level privacy, redaction, export, retry, retention, sender, or security assertion was removed. The old help-copy assertions were replaced because the requested UI removes that prose. Existing legacy None UI success cases now explicitly verify no send before an intentional Bearer upgrade. Underlying None service/sender coverage remains.

## Build-type retry

The manager's first broad `npm test` stopped during the clean build, before any tests ran. TypeScript reported TS2322 in the new malformed-submission acceptance case: inferred members of a heterogeneous array had optional undefined properties, which did not fit the browser driver's string-record field contract. The worker replaced inferred array typing with `readonly Readonly<Record<string, string>>[]`. No scenario or assertion changed.

After the correction:

- `pnpm exec node --import tsx --test test/acceptance/logging/hosted-destination-settings.test.ts` -> 11/11 pass.
- `pnpm exec tsc --project tsconfig.build.json --noEmit` -> exit 0.

The worker did not delete or rewrite dist. Source/test edits are stable for the manager's broad retry.

## Habit-hooks assessment

These are advisory findings in the manager's `habit-hooks.log`; the worker made no source or test edit during the manager's complete-suite run. The snooze file stays empty.

- `src/interfaces/web/account/logging-form.ts`, high complexity: the function is one 24-line ordered boundary. Decisions correspond to explicit form refusal rules: CSRF/field envelope, optional field cardinality, native checkbox values, destination/dataset invariant, tenant/revision syntax, and Bearer authentication. It uses guard clauses and no nested workflow. A small private `validDestinationSelection(destination, datasetValues)` predicate is a coherent optional extraction because choice and dataset are one invariant independent of the envelope. It would remain in this boundary owner and run only after CSRF validation. Do not split tenant/revision guards into generic validators just to move score. The manager will use measured MI delta/CRAP and readability to decide; a below-85 existing file alone does not require a new-file exception.
- `test/unit/html/logging-page.test.ts`, eight non-null assertions: six DOM lookups name required controls in the page under test; two header lookups inspect headers that every rendered page must return. Absence fails a local assertion or throws while accessing that control, so it cannot silently pass or affect production. These are test preconditions rather than a circular object graph. An optional test-only cleanup can replace the new assertions with explicit asserted lookups if the manager chooses; it has no runtime safety effect.
- `test/unit/html/logging-routes.test.ts`, thirteen non-null assertions: retained fixture use at known registered route paths plus required security header checks. A missing route/header fails the test at the call or matching assertion. Production routes do not use these assertions. There is no partially constructed collaborator or null-object case to redesign.
- `test/integration/hosted-admin/account-routes-logging.test.ts`, three non-null assertions: retained assertions inspect expected Set-Cookie headers after specific account operations. A missing header fails the following match; it is observable test failure rather than suppressed runtime behavior.
- `src/interfaces/web/account/logging-form.ts`, comment: retain because the HTML field's legacy name `organization_id` contains a trusted tenant ID. The comment explains the security-relevant semantic mismatch and prevents treating it as a provider organization selector.
- `src/interfaces/web/account/members-page-layout.ts`, comment: retain because keeping the embedded style and CSP hash in one owner prevents a permission/content mismatch. It states the reason for ownership rather than restating rendering steps.
- `test/support/processes/audit-destination-test-probe.ts`, comment: retain to identify the two controlled test boundaries and the real collaborators. Reviewers need this scope to assess runtime evidence; the imports alone do not establish it.
- `test/support/in-process/hosted-audit-journey-site.ts`, comment: retain to distinguish shared public-channel production capture from the controlled page operation. It documents the evidence limit of the hosted journey.
- `test/acceptance/logging/hosted-destination-settings.test.ts`, oversized file: retain this cohesive specification of one protected settings page's Read/Save/Test input boundary. The shared site setup serves root/nested paths, authorization, stale/forged requests, write-only credentials, lost Save outcomes, and destination validation. Splitting solely at 200 lines would duplicate or export scenario-specific setup without improving ownership. The new cases preserve these distinct security and state invariants.

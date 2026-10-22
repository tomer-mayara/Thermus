# S1-02 implementation record

Status: implementation complete; application checks pass; required metrics blocked,
22 October 2026. [Draft PR #221](https://github.com/tomer-mayara/Thermus/pull/221)
is stacked on [S1-01 PR #220](https://github.com/tomer-mayara/Thermus/pull/220).

## Scope

Implement [S1-02](../design/organization-admin-plan.md#s1-02--useradmin-password-access)
on top of [S1-01 PR #220](https://github.com/tomer-mayara/Thermus/pull/220).
The branch starts at `3023003681e65bc9254eda5ea6f6cb9128145f7f`; the new pull
request targets `codex/admin-s1-01`.

User has product and MCP access. Admin includes that access and can use the
existing member and invitation operations for either invitation role. Current
membership and organization permissions still decide access. Remove the
application's MFA preconditions and inferred MFA evidence. Keep password/session
protections, provider failures, and browser/MCP organization separation.

User has `product:access`. Admin has that permission, `user-grants:manage`,
`admin-grants:manage`, and `billing:manage`. The permission names do not restore
the grant writer retired by S1-01. Billing remains a free read with no new
payment or seat-synchronization feature. The Members summary now says
**Active product members** and counts each active product-authorized membership
once, including Admin alone. Existing count field names stay unchanged.

Existing Admin-only access now offers Continue during signup. It creates no
new workspace or User grant. Named organization creation and the first Admin
remain S1-03a work. The approved legal bundle is unchanged.

The application has no MFA gate, policy mode, inference option, factor state,
or new UI. Fresh WorkOS sessions report `mfaCompleted: false`. Existing cookies
still pass real seal verification; old inferred `mfa: true` values are discarded
on read, refresh, and organization selection. Keeping the wire field avoids an
unneeded cookie-format change. This does not disable a WorkOS provider policy
or an existing account's factor requirement.

The [operator checklist](hosted-organization-setup.md#s1-05-cutover-checklist-prepared-not-executed)
prepares role/password cutover. Production cutover remains in S1-05. This ticket
adds no database, SDK dependency, provider setting change, or new infrastructure.

## Acceptance and TDD evidence

The workers observed these failures before editing the relevant source:

- The new Admin-only password acceptance case received `403`, not `200`, at
  product access. The companion User case passed: two tests, one expected
  failure. Focused role-catalog and administration units then failed for the
  old three-role mapping and MFA prerequisite: two tests, two failures.
- The four MFA acceptance cases reported `true`, not `false`: fresh Password
  callback under retained Required settings, plus a legacy cookie read,
  refresh, and organization selection. All four failed. Focused session tests
  exposed five failures; settings tests exposed three.

The workers changed the smallest existing owners to make those cases pass.
The final role acceptance has eight cases, including loss of access through
default, retired, unknown, inactive, removed, and another person's membership.
Each keeps valid access in another organization. The four legacy-MFA cases
pass without a production-only test switch. See
[role acceptance](../../test/acceptance/auth/hosted-workos-role-access.test.ts)
and [session acceptance](../../test/acceptance/auth/hosted-workos-mfa-policy.test.ts).

Signup already checked product permission. Its unit changes characterize that
existing rule with the correct Admin grant; they are not claimed as new red
evidence. The composed [signup acceptance](../../test/acceptance/auth/hosted-workos-signup.test.ts)
checks Continue and a stale signup form after an Admin grant, with no provider
write. Default, inactive, failed-read, recovery, and legal-document protections
remain.

Workers ran each owned changed ordinary test with `pnpm exec node --import tsx
--test ...`. Passing focused groups include role/domain/routes (207), shared
WorkOS fixtures (77), final account-route fixtures (152), session/configuration
(128), ordinary administration/billing compatibility (58), signup (116), and
the work-slice (9). These groups overlap and are not a total test count.
The manager also reviews the full emitted suite, including shared-fixture
consumers. Initial type checking found a fixture's `undefined` cookie argument;
the fixture now converts it to `null`, and both consumer files passed (six tests).
The first complete emitted run had 4,080 passes and eight failures from old
role fixtures and expectations. The workers corrected those consumers. Their
follow-up groups passed: 16 organization/MCP/seat acceptance cases, 18 directory
and organization integration cases, two MCP guidance cases, and 30 explicit
permission-contract cases. Synthetic management-only roles keep the latter
tests independent of the hosted customer catalog. The final fixture-name cleanup
passed all 41 cases in its five files before commit. The complete ordinary suite
and type check then passed again for the corrected candidate.

## Complete-candidate verification

The selected scope is every change from trusted `origin/main`, including
S1-01. A source change selects the full ordinary suite, type checking, portal
build, self-hosted container, hosted offline build, and Linux AMD64 hosted
image. The hosted build already includes its `check` stage; no extra standalone
`npm run check` is selected. Coverage may collect the complete unit and
integration suites because both are in this selection.

Commands use pinned Node 24.20.0 through `pnpm exec`. Local renderer runs use the
verified Lightpanda 1.0.0 executable, not the installed nightly build.

| Check | Result |
| --- | --- |
| `npm test` | Exit 0 after the final test changes: 4,091 backend tests in 261 suites and 41 portal tests passed; no failures, cancellations, skips, or todos. |
| `npm run typecheck` | Exit 0, including portal types; repeated after the final test changes. |
| `npm run build:user-portal` | Exit 0. |
| `npm run test:container` | Exit 0: all 11 self-hosted container tests passed. |
| `npm run build:hosted` | Exit 0: 2,643 unit, 23 portal unit, 18 portal acceptance, 942 integration, 116 selected acceptance/interface, and 13 renderer tests passed. |
| `npm run test:container:hosted` | Exit 0: all seven Linux AMD64 image tests passed. They cover startup, portal/assets, legal-document bytes, TLS and script rendering, access and capacity guards, cancellation, and shutdown. |
| Selected-suite coverage | Exit 0 for the complete unit and integration suites: 2,643 emitted unit, 23 portal unit, and 942 integration cases passed. The verified report contains 137 source files from 633 processes. No coverage data was edited. |
| Base and head snapshots | Exit 0. The snapshots retain incomplete function identity evidence instead of treating it as complete. Type-only contracts have no function metrics. |
| Metrics process and standalone CRAP | Exit 1. Delta and Review retain goal misses. CRAP fails because the native tool omits source declarations; Architecture is unavailable because its prerequisite failed. No valid CRAP rows file is produced. |
| Review-tier checker | Classification completes: **T2 Need architect**, local eligibility **blocked** by failed CRAP, unavailable Architecture, and missing CRAP rows. No undeclared dependency fact or new cycle is reported. |

The last five-file cleanup only names generic permission fixtures. It changes
no assertions or production behavior. The final ordinary suite, focused run,
type check, and coverage include it. The hosted build and image use the same
production code. Final documentation changes require only the applicable manual
checks and refreshed candidate-bound quality evidence.

Local Markdown links and code fences, the deployment verifier syntax, and
`git diff --check` pass. Both changed Mermaid diagrams render and are readable.
No tests were added for documents, configuration, or tooling.

The changed dedicated WorkOS live checks did not run: `hosted.live.ts`,
`fetch-public-script.live.ts`, and `fetch-public-connect.live.ts`. The saved
client differs from the connected staging client and the saved issuer is
missing. The new preflight requires password authentication enabled and both
provider MFA flags disabled. It reads settings; it changes none. As before,
the live harness creates owned fixture records before that read, so it must not
run without an authorized matching scope. No provider call was made for this
ticket. API-created verified users do not prove real email verification or
password reset; those checks remain in the cutover procedure.

## Architecture and contract review

The manager reviewed the complete candidate and the workers' changes. An
independent worker reviewed the role and session implementations and found no
actionable issue. This technical review does not replace required human review.

The [registry](../../architecture/components.md) changes the organization
component responsibility and member-read runtime sequence. Current grants
authorize reads and invitation operations without an MFA branch. The same
WorkOS adapter, neutral contracts, and application composition remain. Context,
containers, deployment, resource ownership, provider boundaries, and package
edges stay unchanged. S1-01's neutral session/signup contracts remain intact.

The changed Mermaid component and runtime diagrams were parsed and rendered
with Mermaid CLI 12.0.0 and local Chromium. The manager inspected both results:
labels, boundaries, arrows, and sequence order are readable. No repository
dependency was added for this check.

Observable contract changes:

- `Actor` contains only the user. `AdministrationRefusal` and `ChangeResult`
  no longer include `mfa-required`; the unreachable notice is removed.
- WorkOS settings, sign-in/session options, and composition no longer expose
  MFA inference or policy options. A retained `WORKOS_MFA_POLICY` environment
  value is ignored. Shared session and sealed-cookie fields remain compatible.
- Admin permissions include product/MCP and both invitation roles. WorkOS
  validates only User/Admin application roles and rejects invalid catalogs.
  The unused `hasRole` export is removed. Count API names remain, but the count
  now represents active product access.
- The inherited S1-01 candidate removes the grant-writing contract and supplies
  neutral session/profile and signup roles. Its changed public surfaces are
  recorded in [the parent record](admin-s1-01.md).

Current-membership reads, foreign-organization refusals, origin/CSRF guards,
PKCE/state, cookie effects, safe return paths, logout, stale-target checks,
provider outage behavior, and separate browser/MCP organizations remain.
No new architecture decision record was requested.

The protected-path questions have these answers:

- Checks and decision makers: test selection, quality goals, and approval
  authority stay the same. The inherited policy edit declares S1-01's two
  public contracts. The live preflight now requires password authentication
  with both provider MFA flags off; it checks the Slice 1 contract without
  changing provider settings or weakening the other isolation checks.
- Image, runtime, data, and recovery: the deployment verifier drops an unused
  environment value. There is no data migration. S1-05 must coordinate the
  application image and compatible WorkOS role catalog for cutover or rollback;
  restoring an old image against the new catalog can fail closed. This PR
  executes neither operation.
- Admission and trust: Admin gains product access and both invitation roles;
  current organization authority still decides every protected operation.
  Application MFA preconditions are removed. Token, cookie, origin/CSRF,
  callback, provider-failure, and tenant-separation protections remain.
- Observable promises: the contract changes listed above cover the two-role
  model, removed MFA options/refusals, false legacy MFA evidence, and member
  count meaning. The parent record covers the retired writer and neutral
  session/signup interfaces. No new provider or storage contract is added here.

## Retained quality findings

The pinned ast-metrics version is 0.43.1. The table records every changed
implementation file below MI 85 against trusted `origin/main`, including the
parent ticket. These are retained goal misses, not passes. The source review,
file reports, and parent review support the reasons below. No new implementation
file misses the goal: the two added files contain only contracts.
`customer-roles.ts` scores 89.9 and `change-records.ts` scores 90.4.

| File | Base → head MI | Reason to retain |
| --- | ---: | --- |
| `administration-overviews.ts` | 77.0 → 76.3 | Keep small frozen read projections together. Paths fall from 18 to 15; product-member counting has two paths. |
| `organization-administration.ts` | 64.8 → 66.9 | Writer and MFA removal reduce paths from 57 to 42. Current authority, invitation state, and outcome recording remain necessary. |
| `hosted-role-mapping.ts` | 73.1 → 73.3 | Validate the whole catalog before giving a grant. The same small mapper now checks two roles. |
| `session-cookies.ts` | 66.3 → 66.3 | Compatibility comment only. Seal verification and cookie effects remain unchanged. |
| `workos-auth-provider.ts` | 67.9 → 67.9 | Contract comment only. Existing verification and current-membership resolution remain unchanged. |
| `workos-browser-session.ts` | 63.9 → 64.2 | Remove inferred MFA while keeping session refresh and cookie effects together; paths fall from 49 to 48. |
| `workos-organizations.ts` | 53.1 → 53.9 | Parent writer removal reduces paths from 110 to 102. Keep provider validation, bounded pagination, and invitation operations cohesive. |
| `workos-settings.ts` | 66.4 → 69.1 | Remove the MFA mode; paths fall from 37 to 33. Keep startup validation and safe diagnostics. |
| `workos-sign-in.ts` | 66.8 → 66.6 | Remove inference; paths fall from 21 to 20. The remaining state, expiry, and callback checks belong to one sign-in operation. |
| `workos-signup-documents.ts` | 72.3 → 72.3 | Parent type import change only; document validation is unchanged. |
| `workos-signup.ts` | 36.3 → 36.7 | Parent contract extraction preserves creator and recovery behavior. A recovery redesign would expand this ticket. |
| `hosted-portal.ts` | 50.6 → 49.9 | Parent origin validation adds three required paths. Keep existing routing and build-output guards. Trivial wrappers would not simplify them. |
| `hosted-workos-application.ts` | 63.0 → 62.5 | Remove the MFA option from the existing composition and resource lifetime; paths fall from 13 to 12. |
| `account-form.ts` | 61.2 → 61.6 | Parent grant-parser removal reduces paths from 49 to 45. Bounded-body and CSRF validation remain. |
| `account-pages.ts` | 75.2 → 75.4 | Remove the unreachable MFA notice. Keep the small related notice renderers together. |
| `account-routes.ts` | 61.2 → 61.2 | Parent boundary change preserves current access, selection, cookies, and failure behavior. |
| `administration-pages.ts` | 69.1 → 70.6 | Parent grant forms are removed; the member summary now describes product access. No template framework is needed. |
| `administration-routes.ts` | 61.3 → 62.8 | Writer and MFA-result removal reduce paths from 44 to 40. Remaining request guards are required. |
| `portal-access.ts` | 79.7 → 79.7 | Permission contract comment only; current-membership enforcement is unchanged. |
| `workos-session-routes.ts` | 61.6 → 61.8 | Parent contract extraction preserves callback, return-path, logout, and cookie behavior. |
| `workos-signup-document-reader.ts` | 81.2 → 81.2 | Parent shared-type import only; bounded legal-document rendering stays the same. |
| `workos-signup-pages.ts` | 52.4 → 52.4 | Parent shared-type import only; page decisions stay the same. |
| `workos-signup-routes.ts` | 43.9 → 43.9 | Parent contract extraction preserves admission, CSRF, cancellation, and recovery behavior. |

The native review reports 14 high maintainability findings on changed production
files. The table covers 13 of them. The other finding is the `ChangeRecording`
class in `change-records.ts`: its unchanged failure/outcome logic keeps checks
separate from the single provider mutation, while the file change removes only
obsolete result types. Keep that logic together. Native class scores differ from
the file scores above.

One further high finding concerns the MFA acceptance file. Its four direct
scenarios now prove a fresh callback and three retained-cookie paths without
inference. Keep those scenarios explicit; test files have no MI goal. The other
48 high findings are on files unchanged by the complete candidate. Native
`new-violation` labels do not by themselves show a new source regression.

`habit-hooks --branch origin/main` exits 1 with two high-complexity, 616 comment,
and 20 oversized-file findings. The complex bodies are the existing portal
request handler and index validator. Their routing and build-output checks stay
necessary. Retained comments state authority, trust, cookie effects, uncertain
provider outcomes, protocol assumptions, or test-seam constraints.

The oversized production files are the same WorkOS organizations and signup
adapters retained by the parent. The other 18 findings are cohesive live
fixtures/runbooks, role and signup acceptance/integration scenarios, and their
provider doubles and units. They exercise one public boundary per group. The
change removes duplicate Optional-MFA live coverage and its TOTP helper. A new
test framework or broad file reorganization would add scope without improving
this access change. The full habit report names each file. The snooze file stays
empty. These retained findings require human review.

## Measurement blocker and evidence

The process and standalone CRAP command both stop at:

```text
get_file_metrics omitted source declarations in src/accounts/organizations/organization-administration.ts. The required goals are unresolved.
```

That file has 29 source declarations and 20 native rows at the base, versus 24
declarations and 17 rows in this candidate. The omission also affects WorkOS
organizations and signup, hosted portal, account routes, administration routes,
session routes, and signup routes. Across these eight changed files there are
185 declarations, 139 native rows, and only 119 rows with usable source identity.
The snapshots mark the evidence incomplete. This is the same native omission
that blocks S1-01, reproduced on this candidate.

Coverage cannot supply missing complexity or function identity. A validated
tool/parser compatibility fix is needed before the required assessment can
finish. The omission guard, metric policy, coverage, and production structure
were not changed to hide the failure. No metric exception or empty CRAP report
was created. No history record was written because the four-stage process did
not complete. The manual architecture review is complete, but it does not
replace the unavailable metrics Architecture stage.

The local ignored `ast-report/` directory retains the complete snapshots,
process and review reports, coverage, omission diagnostic, classifier output,
command logs, and rendered diagrams. Its `README.md` indexes them. The PR records
the exact candidate SHA and artifact location. These are local review artifacts,
not uploaded CI results. No live provider pass or human approval is claimed.

## Stack and verification

PR #220 must merge before this pull request. Its unresolved metrics evidence
and human review remain separate. The new branch preserves the parent worktree
and its reports. Full candidate checks use the trusted `origin/main` policy;
the pull request diff against S1-01 identifies this ticket's incremental changes.

The changed authorization and session guarantees require **T2 Need architect**.
The checker also retains T1 reasons for policy/deployment/security paths, the
test-gate policy, parent public-module declarations, public-surface changes,
review size, renamed/removed test cases, retained high findings, and declared
component, internal-interface, sensitive-behavior, and policy impact. Many test
name changes replace the old three-role/MFA model; they are not skipped tests.
The full classifier report retains every individual reason.

An independent authorized human architect must approve the current candidate.
No such approval is claimed. The PR remains Draft while required local quality
evidence is unresolved. No implementation merge or rollout is requested here.

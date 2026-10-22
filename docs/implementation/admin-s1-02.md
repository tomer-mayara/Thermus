# S1-02 implementation record

Status: implementation complete; complete-candidate checks in progress,
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
tests independent of the hosted customer catalog. The full suite is repeated
for the corrected candidate.

## Complete-candidate verification

The selected scope is every change from trusted `origin/main`, including
S1-01. A source change selects the full ordinary suite, type checking, portal
build, self-hosted container, hosted offline build, and Linux AMD64 hosted
image. The hosted build already includes its `check` stage; no extra standalone
`npm run check` is selected. Coverage may collect the complete unit and
integration suites because both are in this selection.

The final command results and quality reports will be recorded after the
complete candidate finishes its checks. Local renderer runs use the pinned
Lightpanda 1.0.0 executable, not the installed nightly build.

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

## Stack and verification

PR #220 must merge before this pull request. Its unresolved metrics evidence
and human review remain separate. The new branch preserves the parent worktree
and its reports. Full candidate checks use the trusted `origin/main` policy;
the pull request diff against S1-01 identifies this ticket's incremental changes.

The changed authorization and session guarantees require **T2 Need architect**.
An independent authorized human architect must approve the current candidate.
No such approval is claimed. The PR remains Draft while required local quality
evidence is unresolved. No implementation merge or rollout is requested here.

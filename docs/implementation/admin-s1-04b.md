# S1-04b implementation record

Status: source implemented and local functional gates passed, 22 October 2026.
Draft: required native metrics and live invitation verification remain blocked.

## Scope and result

Implement [S1-04b](../design/organization-admin-plan.md#s1-04b--invitation-acceptance-and-trusted-landing)
on top of [S1-04a PR #224](https://github.com/tomer-mayara/Thermus/pull/224).
The parent is `586714e74a5d447041325d1d85a9eb479973c825`; the PR targets
`codex/admin-s1-04a`. Main's review-policy update at
`682b387f2d07ce665e610157a1640a02c33d397b` is included.

A default sign-in now opens the portal only when validated provider identity
selects an organization and a fresh access read confirms product access there.
Otherwise it opens the existing workspace selector. No path chooses the first
or only membership. The selector retains its current authorization and recovery.
An access-read failure after code exchange keeps the completed session cookies
and offers an Open your workspaces link. It does not replay the used code.

An explicit safe return destination, including the portal root, keeps its old
behavior and route access checks. Absent and explicit destinations stay distinct
inside the sealed pending sign-in. Old envelopes with a string destination
remain valid. The neutral sign-in completion now supplies trusted identity, and
composition supplies the existing access resolver to the callback routes.

The [AuthKit Node guide](https://workos.com/docs/authkit/vanilla/nodejs#configure-initiate-login-uri)
says AuthKit preserves invitation context when the configured Initiate login URI
starts normal sign-in. Thermus adds no invitation marker, token handoff,
acceptance endpoint, activation registry, or invited-member agreement. Existing
MCP tokens remain bound to their original organization after a browser switch.
No MFA, removal, role-change UI, provider setting, SDK method, datastore,
infrastructure, or paid feature is added. This request includes no merge or rollout.

## BDD and TDD evidence

The first hosted HTTP acceptance run used the pinned WorkOS SDK with a local
provider fake. The ambiguous default case failed because the callback went to
`/team/` instead of `/team/organizations`. The selected-organization and explicit
return characterization cases passed: three tests, two passes, one failure.

Focused TDD then proceeded in two steps:

1. Optional sealed destination and trusted completion identity: four failures in
   35 unit cases, followed by 35 passes. Existing explicit envelopes stayed green.
2. Callback default landing and failure recovery: five failures in 15 route cases,
   followed by 15 passes. The code reuses the supplied resolver and selector.

The acceptance file now has ten cases. It covers one, several, and no eligible
memberships; trusted and stale selection; forged query hints; explicit safe
returns; no creator/activation writes; post-exchange recovery; selection refusal
and outage; and reuse of the same MCP token after browser selection changes.
Portal characterization retains readable Terms and Privacy links with no
agreement checkbox or acceptance form.

The final focused run passed 361 compiled tests and 20 portal acceptance tests,
with no failures, skips, or todos. It includes all auth-workos unit and route
cases, browser-session integration consumers, provider organization tests,
account selector/cookie cases, and hosted WorkOS/organization/landing acceptance.
Independent review then requested one new-stage cancellation case: abort while
the post-exchange access read is pending and observe its late failure. The five
cancellation cases passed directly from TypeScript, with no recovery response or
operator report after disconnect. No production fix was needed.

Logs are retained locally under `/tmp/thermus-s1-04b-`: `bdd-red.log`,
`unit-red.log`, `unit-green.log`, `routes-red.log`, `routes-green.log`,
`focused.log`, and `cancellation.log`. Fake-based passes prove application policy,
not WorkOS's native role-preservation behavior.

## Native verification hold

Read-only WorkOS discovery confirmed the connected Thermus Staging environment
and its saved local HTTPS login/callback settings. The saved local test client
belongs to a different client; its issuer is missing and its callback differs.
Staging MFA is Optional, while this Slice 1 live test profile requires Disabled.
No credentials, policy, provider resources, or emails were changed. The live
harness was not started because it creates and cleans fixtures.

The [native proof matrix](../testing/workos-invitation-proof-matrix.md) is prepared
and explicitly NOT RUN. It covers active User/Admin preservation with alternate
corporate recipients, both overlap orders, acceptance/resend/revoke orderings and
races, and controlled consumer exact-address behavior. It specifies direct
membership assertions, fresh reads after unknown outcomes, and owned-fixture
cleanup. Existing live exact-recipient tests and SDK request contracts cannot
replace these proofs. This hold blocks S1-04b completion and release.

## Architecture and review

The manager and an independent agent reviewed the complete S1-04b source/test
diff. No source defect was found. The new cancellation case resolves the review's
coverage request. Agent sign-off does not supply the required human approval.

The public boundary comparison found these changes:

- `BrowserSessionControls.startSignIn` accepts an absent destination. Successful
  `BrowserSignInCompletion` adds a trusted `AuthenticatedUser` and optional
  destination. The adapter does not expose provider exchange secrets.
- The private WorkOS sign-in result carries validated session facts to that
  neutral projection. Pending cookie validation accepts either exact old or new
  shape, still rejecting extra or malformed fields.
- `WorkOSSessionRoutesOptions` adds the existing `AccessResolver` role. Default
  HTTP landing now checks matching current product access. Explicit destinations,
  state/PKCE, callback input validation, CSRF, origin, and logout rules stay intact.
- `signedInRecovery` adds a fixed failure page that preserves cookie effects and
  links to the existing selector. It excludes the code and private failure cause.

The [component registry](../../architecture/components.md) updates hosted session
contract text and adds the callback runtime sequence. The hosted component view
already shows the supplied session and access roles; its edges remain accurate.
Context, container, deployment, resource ownership, and MCP binding views were
checked and remain unchanged. No new runtime dependency or source owner appears.
The manager manually authored a parent-to-head Before/After comparison for the
PR. The current sequence and both comparison diagrams were parsed, rendered with
Mermaid CLI 12.0.0, and visually inspected. Historical change colors stay in the
PR comparison, outside the current-system registry.

## Complete-candidate validation

The trusted policy/metrics base is `origin/main`, not only PR #224. Complete-stack
source changes select the full ordinary suite, type check, portal build,
self-hosted container, hosted offline build, hosted Linux AMD64 image, applicable
live check, habit-hooks, and metrics. Do not add a separate `npm run check`.
The hosted build retains its existing nested checks. The live gate is unrun for
the reasons above. All dist-changing commands run sequentially.

| Check | Result |
| --- | --- |
| Focused source/portal checks | 361 compiled and 20 portal cases passed; final compiled cancellation file 5/5 passed after rebuild. |
| `npm test` | 4,177 server and 49 portal tests passed, zero failures/skips/todos. The final additional cancellation case is covered by the focused run above. |
| `npm run typecheck` | Passed. |
| `npm run build:user-portal` | Passed. |
| Recovery page | Chromium at 320 px, JavaScript disabled: readable link and no horizontal overflow; visually inspected. |
| Registry and comparison diagrams | All three parsed, rendered, and visually inspected with Mermaid CLI 12.0.0. |
| Local documentation links | 183 file links checked; none missing. |
| `npm run test:container` | 11/11 passed with the real self-hosted image. |
| `npm run build:hosted` | Passed: 2,596 server unit, 29 portal unit, 20 portal acceptance, 1,045 integration, 118 selected acceptance/interface, and 13 renderer tests. |
| `npm run test:container:hosted` | 7/7 passed with the real Linux AMD64 image. |
| Unit/integration coverage | Verified capture: 139 source files, 635 processes. |
| Native metrics | Delta/Review have retained goal misses. CRAP fails on omitted native declarations; Architecture is unavailable. |
| Review tier | T2 Need architect; eligibility blocked by incomplete required metrics. Native provider proofs and current human approval remain separate holds. |
| Hosted live / native matrix | NOT RUN: environment holds above. |

The full quality reports will be retained in this worktree's `ast-report/`.
Preserve the parent worktree and its reports.

## Quality review

The final habit-hooks run exits 1 with five complexity, one parameter-count,
663 comment, and 24 file-size findings. The snooze file stays empty. This is a
retained-finding result, not a clean lint pass. Complexity, parameter, and size
findings keep the [parent reasons](admin-s1-04a.md#complete-candidate-validation):
strict signup checks and ordered browser outcomes stay cohesive. The added
landing behavior introduces no new complexity, parameter, or size finding.
New comments explain trust sources, absent destinations, and recovery without
code replay; these constraints are not apparent from a type or method name.
Parent comments retain their documented contract, provider-limit, and
unknown-write reasons. No unsafe assertion or dependency smell is retained.


## Metrics and final eligibility

Native ast-metrics 0.43.1 still omits source declarations in
`src/accounts/organizations/organization-administration.ts`. The full process and
standalone CRAP command each exit 1 with that diagnostic. There is no valid
`crap.json`, no assessed Architecture stage, and no new metrics history record.
This is a tool failure, not an allowed metric exception. It must be corrected
before Ready; coverage and manual inspection cannot replace missing source rows.
No rules, baseline, coverage data, or exception was changed to hide it.

Against trusted `origin/main`, 26 changed production files remain below MI 85.
Twenty files not changed by this increment keep the
[parent table's reasons](admin-s1-04a.md#metrics-review). The six implementations
changed by S1-04b were inspected through the native MCP wrapper:

| File | Base → head MI | Reason to retain |
| --- | ---: | --- |
| `session-cookies.ts` | 66.3 → 66.4 | Keep exact old/new envelope validation with seal and cookie handling. Absence differs from an explicit destination, and extra keys remain invalid. |
| `workos-browser-session.ts` | 63.9 → 63.3 | Keep refresh, selection, and cookie effects together. The two-path completion projects validated facts into neutral identity without exporting provider data. |
| `workos-sign-in.ts` | 66.8 → 66.5 | Carry validated facts through the existing ordered PKCE, expiry, refusal, and cookie flow. |
| `hosted-workos-application.ts` | 63.0 → 62.2 | Supply the existing resolver instead of creating another organization service or changing resource ownership. |
| `workos-session-pages.ts` | 76.6 → 75.6 | Keep the one-path recovery response with fixed notices and escaping. It preserves cookies and excludes private causes and codes. |
| `workos-session-routes.ts` | 61.6 → 58.2 | Keep default landing separate from exchange and explicit returns. Callback has six paths; default landing has five. Current access, cancellation, and recovery guards stay visible. |

The retained native high findings affect 15 production locations and three test
locations. Production findings retain the reasons above and in the parent
record, including the class measure in `change-records.ts` whose file measure
passes. The new cancellation-test finding keeps the explicit pending operation,
abort, late rejection, and no-report observations in one case. The two inherited
test findings keep the explicit session-MFA and portal-access matrices. Another
48 high findings concern files unchanged by the complete candidate and do not
raise this PR's tier. No new-in-stack production file is below MI 85; the complete
snapshot confirms function-free CSS/type-only contracts as N/A. No MI exception
is needed. CRAP goals remain unassessed because of the tool failure above.

The complete stack requires **T2 Need architect** for changed authorization,
signup/persistence, and portal/callback contracts. T1 reasons also apply to its
protected paths, policy/dependency declarations, public surfaces, review size,
test changes, retained high findings, and declared component/internal-interface/
sensitive behavior. The final tier report records every mechanical reason and
blocker. Required metrics must complete before Ready. An independent authorized
human architect must approve the current candidate before merge. Agent review
and the tier label provide no human approval. S1-04b's native acceptance proofs
remain unproven; no merge or rollout is included.

Full local reports, original coverage captures, inspection output, diagrams,
logs, and the manual architecture comparison remain in `ast-report/README.md`
in this worktree. They are local artifacts, not uploaded CI results. The final
candidate SHA and report links are recorded on the PR.

# Independent UI-03 candidate review

Result: no actionable findings in the reviewed source, test or document increment.
This is agent review evidence, not independent authorized human approval or a
merge decision. Required complete-candidate gates and the final policy checker
remain the manager's responsibility.

## Provenance and limits

Review date: 2026-10-26. Parent branch: `origin/codex/ui-01-refined-tabs`.
Parent/base: `a017020ebe2448f5de6cc7d9cbb0700367fc80b1`.
Observed HEAD: `2330b7157546a55859db1334d3e50c3333f22626`. The working candidate was dirty; the complete scope
below includes tracked changes against the parent plus both untracked helpers.
The new implementation record is already in HEAD and is included in this review.

Tracked binary diff SHA-256: `75fda6ae06e23f35b872d07d8451b5344d882b2f0c3b6f31e2aed57134917353`.
File-content scope SHA-256 (sorted path, tab, content hash, joined with newline):
`92d2617be311f9dde1769832232a38d430f208641c92298b590c10653f942cdf`.

No test, build, metrics process, Git checkout or provider call ran for this
review. I read existing focused result logs, inspected code and document diffs,
read new untracked helpers, searched literal consumers, checked the diff for
whitespace errors, and inspected existing screenshots. The logs report 38/38
browser cases and 137/137 focused ordinary cases, no failures, skips or todos.
These are implementation-agent results, not independent reruns or complete gate
results. The focused ESLint green log is empty; a file alone does not establish
its process exit status.

During review, the implementation agent consolidated `cookieHeader` and
`javaScriptEnabled` into the `memberRemovalBrowser` options argument. I reread
that helper and its only caller at the end. Both now agree. The hashes below
bind this assessment to the latest observed bytes; later changes need review of
the affected diff, and final committed code still needs manager pinning.

## Source behavior

The production delta is three private files in the existing Web owner:
`administration-pages.ts`, `members-style.ts` and `account-pages.ts`.
`sendForm` keeps its allowed-role early return, escaped workspace/role/action
values, exact scope and CSRF fields, labelled required email with maxlength 254,
required role radios and User default when available. One native closed Details
contains one form. The provider-neutral recipient-policy text is moved before
the Send invitation button. Both policy strings retain their exact bytes.

Cancel is an ordinary, escaped Members link and performs a fresh GET. It adds
no script, stored draft, custom focus flow or mutation. The new disclosure does
not change the route's authorization or POST validation. The unchanged service
and route still decide duplicate, refusal and uncertain outcomes. A pending
record is not presented as email delivery. No restoration or retry form is
added to fixed server notices.

The last-Admin page adds one instruction beside its existing invitation link.
Its route and redirect remain unchanged. The browser recovery case follows
that route into the normal closed invitation task and selects Admin without a
write. No removal authority, approved help, product seat rule, provider behavior,
public callable contract or resource lifetime changes.

## Native browser semantics and geometry

The browser scenarios cover initial hidden state, keyboard opening, typed
Cancel with a fresh GET and no POST, native invalid-email retention, valid User
and Admin sends, protected payloads, one provider invitation request, the real
303 response and fixed refusal/unconfirmed notices. Each creates a fresh site,
provider fake, settings store, removal store, signed-in session and browser;
there is no inter-test fixture dependency. The role subset and no-role cases
also have focused route coverage. Existing safety and refusal assertions stay.

At 320px and 1280px, new cases explicitly use JavaScript on and off. The driver
checks visible target bounds, policy-before-submit order, full-width form,
form-before-member-list order, orange submit emphasis and native state. Long
workspace/doubled-text cases cover 481, 600, 860 and 1280px. Existing shell tests
retain doubled text at 320/1280 and Audit navigation, Save/Test and focus checks.
Native summary focus uses the existing shared focus rule. The new neutral
border/text colors and orange submit colors use the existing palette.

Inspected screenshots:

- `invitation-closed-off-1280.png`: quiet task beside Members, no visible form.
- `invitation-open-off-1280.png`: focused neutral trigger, full-width form,
  policy above the sole orange action, Cancel below, lists after the form.
- `invitation-open-off-320.png`: task stacks below the heading; controls and
  policy wrap within the viewport; Cancel and member lists remain reachable.
- `invitation-double-text-double-text-860.png`: long workspace text and open
  form wrap without heading/trigger overlap or horizontal clipping.

These screenshots show UI-01 member rows and pending sections, which is correct
for this sibling candidate. They do not claim UI-02/04 behavior. Existing
screenshots and computed assertions are complementary; no static HTML parser
is used as proof of native validation, hidden content or CSS geometry.

## HTTPS bridge and test protection

`member-removal-browser.ts` maps only the test hostname to a fresh loopback TLS
port in its own Chromium instance. It disables the proxy for that instance,
installs the existing secure session cookies and uses the normal browser
request/redirect path. `ignoreHTTPSErrors` applies only to the fixture context;
it does not alter production CSP, form-action or origin checks.

`browser-transport-site.ts` forwards method, original headers and request bytes
to the existing real-listener transport. The upstream transport does not follow
redirects. The bridge returns the original status and Location to Chromium,
preserves repeated Set-Cookie values with `getSetCookie()` as a header array,
and returns the actual response body. It does not synthesize a 200 or manually
resubmit the form. Browser POST Origin/Content-Type and secure cookies therefore
reach the production form protection. The complete scenario exercises HTTPS
front, local HTTP listener, production app and browser redirect.

The front listens only on 127.0.0.1 with an ephemeral port and a disposable
certificate. It records transport failures and fails teardown if any exchange
failed. It closes its connections and server, removes certificate files and
closes Chromium through test cleanup. Reuse of the existing certificate function
adds OpenSSL as a documented browser prerequisite. No new package, production
TLS exception or live credential is added.

## Consumers, documents and architecture

The remaining literal Invite occurrences are task/recovery wording, unchanged
approved help or provider-double error messages. All old submit-label consumers
found in ordinary tests, hosted-live administration, SQL storage-failure runtime,
Audit journey/snapshot helpers and the shared browser driver now use the new
presentation. State/role/refusal/recording checks were retained. Shared snapshot
consumers remain ordinary integration/acceptance; the journey's process and
container mount path still selects Collector. SQL and hosted live remain
separate selected dedicated groups as recorded in `gate-review.md`.

The design documents correctly state that UI-02 and UI-03 are siblings based on
UI-01, and do not claim a merge or deployment. The UI-03 implementation record
states scope and validation work without falsely claiming completed full gates.
The browser gate inventory adds the actual cases and OpenSSL/loopback TLS needs;
its command, assertions, deadlines, environment switches and policy authority
stay unchanged. The impact declaration matches the implementation and checked
registry views. Its all-false architecture flags remain appropriate subject to
the final trusted checker; the protected policy-document path can still select
T1 Team review independently.

Production architecture is unchanged. All 15 registry drawings, Web ownership,
member-read order, WorkOS/organization collaboration, removal safeguards, Audit
composition, resource ownership and deployment views remain accurate. No registry
edit or architecture comparison diagram is needed. No production callable
contract changes, so L4 is omitted. Test helper APIs do not create a production
contract fact. The manager must refresh this assessment if the final diff adds
source responsibilities, imports, declarations or policy behavior.

## Reviewed file hashes

- `.pr-impact.json`: `00de937957258f33f40f529c84696ff55be86f9490882f85eddc7499739b249c`
- `docs/design/organization-admin-plan.md`: `019a61950d3b04f6b3b7b5f4abce076b772985f81d9e494f20d3b48578241d4f`
- `docs/design/portal-design.md`: `512e2d63fe577dc18ee54c731937c55d8d84b137710bba7b6589ea7410b608ec`
- `docs/implementation/admin-ui-03.md`: `ab2728e0c177072bc9596177079090cfaed884603b675b6c6718d5f5705e21cf`
- `docs/implementation/test-gate-policy.md`: `0d5be808f2359cd8c73ede2c64f7957396df205248bea48c5f6355b4693622f8`
- `src/interfaces/web/account/account-pages.ts`: `5987f579e7f529860798af4dd6d38cdea79549776ef313b1a6184a456fe17f50`
- `src/interfaces/web/account/administration-pages.ts`: `65ae788a542c42cd1b26e5a07dd92499bac247e23bae7ee9dad8f01f96ea9b8b`
- `src/interfaces/web/account/members-style.ts`: `5cdfc10018df38a7725be7997463e21dc60b5a9b8ea3320a265682bba355f4ac`
- `test/acceptance/auth/hosted-admin-journey.test.ts`: `7ea523e53e53c7ccd7de8f80561e01954fc332bb40634bb1d1ed44d1b92015c5`
- `test/acceptance/auth/hosted-invitation-refusals.test.ts`: `8d7c20556b7160e0ad40de7ea995eb746531a2fda182b76a8bd4fca7260b08e4`
- `test/acceptance/auth/hosted-invitations.test.ts`: `582b9969fe23b254c37fb289a29e758a7741981da6cb88959ada93b8ed7fa9f6`
- `test/acceptance/auth/hosted-live/administration-server.ts`: `e6896bcb13ce2015a942c5466b8dadf891b8d61be9549df6e2997ef2907a1a1f`
- `test/acceptance/auth/hosted-member-removal-browser.runtime.ts`: `a0605434ec50aec85a95160fd0ee4d55759b26b877887850e85f5f351efb8801`
- `test/acceptance/auth/hosted-member-removal-scope.test.ts`: `197e82948b22f40b1839c2dab1cfcff78003a45003002d290183f5f87d98555d`
- `test/acceptance/auth/hosted-members.test.ts`: `05d7ba1efdc7d6a7efeab016d8557f005d3b921dd19fd6b097b07a7307efe4f4`
- `test/acceptance/auth/hosted-membership-access.test.ts`: `6d8fa904418174ddc121460eb7537b92f4bf5711c48ef031e088dddb55062c54`
- `test/acceptance/auth/hosted-workos-administration.test.ts`: `bfb6898539461231453bfca91ae8897867d38bfe0bedbabf052954d22c13381b`
- `test/acceptance/auth/hosted-workos-role-access.test.ts`: `ff3d70502f9d8af45238f14aedbf6da4ce3ae079bb1cd73f6ca32586d10b0037`
- `test/acceptance/logging/audit/administration-capture.test.ts`: `d1e371558bc06cd8044ac42a606b30f28b6c35a73f2e12e0300662b93cf9d4a8`
- `test/acceptance/logging/audit/hosted-storage-failure.runtime.ts`: `eb4ccdaa898797aa8ac92809aa316f9ef686940b2182a604cf804cafefa7753f`
- `test/integration/auth/hosted-administration.test.ts`: `871dab0b6d3416dbea6adcee825b9c9d8c85dc12da51217d1aa2eb979ce84569`
- `test/integration/hosted-admin/account-routes-administration-pages.test.ts`: `e94c6dea702f22326f7d5ab58a4b709329d60d35f1148d79d80118a7d28369eb`
- `test/integration/hosted-admin/account-routes-removal.test.ts`: `dc0bcafbd9e6066b2fc98dbaa2e5c68f1995e6acb616f7da35a14a993797c54d`
- `test/support/drivers/browser/admin-shell-browser.ts`: `a6d41c86c952a9fef2c653783048eea9563a16e63a17e805cc4774e49822c310`
- `test/support/drivers/browser/invitation-browser.ts`: `6ed0fd1b72585e6344948ade30aedbf0f9946c00202305ab0f2de64dcf977b81`
- `test/support/drivers/browser/member-removal-browser.ts`: `a70c097eccba8c20bfef17f3e7c9f74e3825a21bd275014b3c459367c097823a`
- `test/support/in-process/browser-transport-site.ts`: `81d0290bdcb241696ab52172a849b8bd01d9e5ab76fc002ebe9c0c47ef2453a2`
- `test/support/in-process/hosted-audit-journey-site.ts`: `8b59ce25e5aff471bbb18fa1cee668bf77f73edfeff9b75f0fbd0f6c19eab8cd`
- `test/support/in-process/hosted-audit-snapshot-site.ts`: `e1e5b7d7b5853809cb81aae0b7b84393207ac264f8a13c049248d57743a23215`


## Follow-up: Collector fixture and implementation record

Reviewed on 2026-10-26 against the same UI-01 parent. Observed HEAD remains
`2330b7157546a55859db1334d3e50c3333f22626`; the candidate is still dirty. The original review and
fingerprint above remain historical. I compared every previously recorded file
hash: only `docs/implementation/admin-ui-03.md` changed among those 29 files.
The new changed path is `test/support/container/audit-sender-site.ts`. The three
production file hashes and all earlier test changes still match the prior
review. This follow-up covers the additional helper diff and expanded record.

Result: no actionable finding in this additional increment.

The saved-destination probe now starts from `/workspace/test/support/processes/`
and receives read-only mounts for the candidate source tree, test support tree,
installed node_modules and package.json. This is the same mounting pattern as
the existing publicJourney. Module paths still select either source TypeScript
or emitted JavaScript correctly. The real logging-page import can now resolve
micromark and its transitive dependencies instead of running from an incomplete
manually copied subset under `/fixture/app`.

The four mount roots contain program inputs, not an environment file or a host
home directory. All are read-only. The input JSON and temporary verified CA
remain under `/fixture`. The container retains the existing pinned Node image,
isolated internal network, explicit Collector hostname mapping and verified
TLS CA setting. There is no public-network bypass, production address-policy
change, added credential or relaxed TLS check. The probe uses the same real
LoggingRoutes, settings service, credential codec and sender. Assertions,
statuses, deadlines, refusal checks, synthetic event expectations, redaction and
settings-revision checks are unchanged.

The client is still added to the cleanup list before create. Existing test
cleanup removes all tracked containers and then the internal network and
always removes temporary files. Neither failure handling nor cleanup is
weakened. Repeating the existing mount pattern is the second copy, so no shared
abstraction is required by DRY3.

Consumer trace: `audit-sender-site.ts` has exactly two test entry consumers:
`test/integration/logging/audit/audit-sender.runtime.ts` and
`test/acceptance/logging/audit/hosted-audit-journey.runtime.ts`. Both belong to
`npm run test:logging:collector`, already selected by the UI-03 label migration.
The saved-destination calls are in the integration file; the acceptance file
uses publicJourney. No new SQL, hosted-live, ordinary test or container-image
group is selected by this support-only addition. Existing source-selected gates
continue to apply to the complete candidate.

I read retained logs rather than rerunning tests. The failed Collector result
in `implementation/collector-observed-red.log` records 10 tests, 8 passes and
2 failures, both missing micromark from logging-page under `/fixture/app`.
The replacement `implementation/collector-fixed-green.log` records the same
10 tests with 10 passes, zero failures, zero skips and zero todos. The failed
attempt remains relevant history; it must not be reported as a pass. The green
log alone does not pin the final commit, which remains the manager's task.

The expanded implementation record accurately describes the implemented native
behavior, red/green observations, browser transport, fresh fixtures, focused
counts, required gate selection, sibling status and unchanged architecture.
It claims no merge or deployment and sends full validation history to the
maintained PR comments. This prose update changes no test requirement or
production contract. Production architecture remains unchanged.

Follow-up file hashes:

- `test/support/container/audit-sender-site.ts`: `6a976c549d1b46336a22bac9ba9dd4c250a16b29c1cbd7183b1981621dd46025`
- `docs/implementation/admin-ui-03.md`: `ebb431dbd75e2c206396e01d2a394111d40066c3bd8006a13d949a11f270627b`


## Final delta: early send assertion and live evidence limits

Reviewed 2026-10-26, same UI-01 base, observed HEAD `2330b7157546a55859db1334d3e50c3333f22626`.
The working candidate remains dirty. All previously reviewed hashes still match
except the two repository files listed below. In particular, all production
source hashes remain unchanged. No build, test, metrics command, checkout or
provider contact ran for this delta review.

Result: no actionable code or documentation finding in this delta. The required
hosted-live gate remains blocked by incomplete passing evidence.

In `test/acceptance/auth/hosted-live/administration-server.ts:200`, the existing
`assertSeeOther(third, 'members')` now runs immediately after the third invitation
send, before the test reads its Revoke form. `assertSeeOther` still requires
status 303 and the exact Members Location. Removing third from the later loop
removes only a duplicate assertion: sent, resent and revoked still run through
that loop, refused responses still require the same 409 notice, and the later
provider-state, role, record and credential checks remain intact. An unsuccessful
third send now reports its own result before a dependent missing-form failure.
This improves diagnosis without changing application behavior or relaxing a
successful outcome. The same complete hosted-live group remains selected.

`docs/implementation/test-gate-policy.md:37` now includes the existing absolute
pinned LIGHTPANDA_BIN prerequisite in the live-gate table. The detailed live
section already required it. No command, selected file, deadline, assertion,
skip/environment gate or decision authority changes. This corrects the table;
it does not waive the gate after setup or quota failure.

`workos-quota.md` correctly separates the retained full run (28 of 29 tests,
missing third Revoke form with no established root cause) from the later
focused diagnostic. The latter records HTTP 429 during administration fixture
creation, the sandbox invitation-email quota message, request ID and absent
Retry-After. I read those retained log facts. They establish the later rerun's
quota blocker, not the earlier missing form's cause or a reset time. This is
not a pass of the changed live case or full gate. The note preserves required
future passing evidence and does not authorize provider changes. I did not
revisit its linked official sources or contact WorkOS for this review.

Delta file hashes:

- `test/acceptance/auth/hosted-live/administration-server.ts`: `3b80a89267a47441a6229a3412fbdd3bdae346992a008d090109d2d6e91bdab1`
- `docs/implementation/test-gate-policy.md`: `ca84ae652ad3f561ecd6fecf366002d4e27971858867782b5d9940a2cb628b22`
- `.cache/ui03/validation/workos-quota.md`: `42d48c74ef824b4d119ad8b2ec56481630ee8b30ac2021a52e4e254a1a3172c0`

# S2-04 Habit Hooks review

Reviewed 2026-10-24T23:44:36.685434+00:00. Base:
`845cec3060b0880cd27c36047f1da57a1c3772ba`; current local HEAD:
`a7bdf1f32bb2d67e87d85ea03a701078ec04808b`, with the working candidate above it.
Source/test hashes matched `architecture/v2/candidate-manifest.json` at initial
review. The manager then authorized the one test-oracle correction below; that
test file now differs from the prior snapshot. Final-source provenance is refreshed
in `architecture/v3/`; the eventual commit still needs a committed-head stamp.
The final reviewed log is `habit-hooks-final.log`, SHA-256
`bbbd3be1a23bc77dc32124665a32f4c8e9e73e4dc4516c1f35ade12402239239`.
The earlier `habit-hooks.log` remains historical at SHA-256
`1511e9189feb8d36f4014d05ff00af4017d025f6713cd88af03c51f4184b5284`.
`.habit-hooks/snooze.json` is `[]` and was not changed. The only test edit by this
reviewer is the manager-authorized setup assertion below. No production source
was changed, and no build or test was run by this reviewer.

The final log reports 92 locations: 10 complexity, 15 non-null assertions, three
parameter counts, 59 comments, and five file sizes. The only removed finding
from the 93-location original is the corrected test-oracle assertion at original
line 217. No finding was added. Its source-run verification passed 39/39 after
an initial strip-only tooling failure; both attempts are retained. All 92 final
locations have specific retained reasons. Their presence on main is not
their reason. This review does not change MI/CRAP
goals, existing authorized dispositions, exceptions, or required human approval.

## Test-oracle correction

`test/unit/logging/destination-settings-service.test.ts:217`: the malformed-row
case retrieves `current` with `!` after an unchecked initial Save. If that Save
fails, object spread tolerates `undefined`; each malformed row can then be
rejected for missing setup rather than the intended corrupt field, and the
unavailable assertions can still pass. This is a test-oracle weakness, not an
observed production failure. With manager authorization, the unnecessary `!` was
removed and `assert.ok(current)` added immediately after retrieval. The test now
fails if its seed row is absent before any malformed-row assertion can run. No
extraction or API changed. The active gate runner owns dist, so no build or test
was started by this reviewer. The manager subsequently ran the source case with
`--import tsx`; all 39 tests passed with no failures/skips/todos, including this
case. An earlier strip-only invocation failed before test execution and remains
in `checks/settings-oracle.log`; the successful run is
`checks/settings-oracle-tsx.log`. The final Hook log removes this exact finding.
Final coverage and committed-candidate provenance must retain the strengthened
test.

## Complexity: retain the bounded rule owners

| Location | Retained reason |
| --- | --- |
| `src/app/hosted-workos-application.ts:97` | One composition root selects supplied overrides, creates shared capture only when storage exists, and binds cleanup to the same owner. The branches preserve construction and lifetime order; they are not duplicated business rules. |
| `src/interfaces/web/account/logging-form.ts:6` | One short boundary rejects malformed/duplicate fields, checks CSRF through the existing parser, preserves trusted tenant syntax, and maps native checkbox/optional dataset fields. Early refusals keep invalid input out of the service. |
| `src/interfaces/web/account/logging-routes.ts:30` | One route dispatcher checks current Admin authority before read/Save/Test, and converts sensitive collaborator failures to a safe page. Moving these guards can obscure which paths are protected. |
| `src/logs/audit/destination-settings-service.ts:46` | Fresh authorization checks cancellation, found/enabled state, expected revision, and decryptability before returning one saved destination. These guards jointly enforce dispatch authority. |
| Same file, `:67` | Saved Test must check before sending and again after settlement. Distinct cancelled, unavailable, conflict, unsaved, and unconfirmed outcomes are part of its contract; no SQL lock spans network work. |
| Same file, `:101` | Save coordinates validation, current revision, token retention/encryption, and atomic persistence. It preserves ciphertext on no-op and distinguishes invalid/conflict/unconfirmed outcomes. Dataset handling extends this same invariant. |
| Same file, `:139` | Central input validation names settings/endpoint/dataset/token refusal causes and bounds untrusted values. Combining or redistributing the conditions only to lower a counter would weaken review clarity. |
| `src/logs/audit/public-audit-destination.ts:24` | The sender independently validates URL, optional header value, and Bearer syntax before DNS/TLS/HTTP. The explicit guards prevent unsafe destinations and header injection even outside the settings UI. |
| `test/acceptance/auth/hosted-workos-signup.test.ts:457` | One public creation journey checks exact documents, unchecked agreement, stale-form refusal, persisted legal facts, first Admin, and product access. Assertion and two small document loops are not production decision complexity. |
| `test/support/doubles/logging/destination-settings-fake.ts:15` | The fake models one atomic expected-revision Save and equality across all persisted fields, plus one explicit uncertain-commit switch. Dataset equality is required to avoid hiding revision regressions. |

## Non-null assertions

- `test/unit/html/logging-routes.test.ts:19,25,35,64,70,75,81,89,98,100,104,120`:
  these call a handler for a fixed recognized route on a new local fixture. An
  absent handler is invoked/dereferenced immediately and fails the test; there
  is no production fallback or silent authorization path. Retain the direct
  boundary calls rather than add a new test dispatch wrapper solely for this
  finding.
- `test/unit/logging/destination-settings-service.test.ts:81`: the same test has
  already asserted a saved result and exact found/public state before copying
  its ciphertext row to another tenant. Missing setup fails those assertions.
- Same file, `:128,129`: wrong-key reads have already been required to return
  unavailable for a saved Bearer row, then the test dereferences the row and
  slices its ciphertext to inject corruption. Missing/non-Bearer data fails
  loudly before the corruption assertions; no production null handling is
  suppressed.
- Same file, original `:217`: corrected with an explicit `assert.ok(current)`
  guard as described above. This finding is absent from the final Hook log, and
  the focused source rerun passed all 39 tests. Final coverage remains manager-owned.

## Parameter count

- `destination-settings-service.ts:61,67`: trusted tenant, submitted settings,
  trusted actor, and cancellation have separate authority and lifetime meanings.
  They are already domain records where appropriate. The public Test snapshots
  them before handing control to its lifetime owner. A general options bag or
  new class would hide those distinctions without reducing coupling.
- `src/logs/audit/otlp-audit-request.ts:8`: checked TLS socket, validated URL,
  encoded body, explicit header metadata, and cancellation are the narrow
  transport inputs. Keeping the established socket explicit prevents this
  helper from performing unchecked DNS/connection setup or reading System/OTel
  defaults. No new request framework is needed.

## Comments: retain contract and environment reasons

| Locations | Retained reason |
| --- | --- |
| `hosted-workos-application.ts:28,29,36,37,41,44,48,50` | State production versus explicit development composition, precedence, environment binding, and selection of exact legal bytes. These are injection/authority limits that structural names alone do not express. |
| Same file, `:54,78,79,140,141` | Explain no SDK retry, request timeout, lazy key loading, fail-before-listen behavior, and sharing one directory for current grants and writes. These choices affect outage behavior and consistency. |
| `audit-send.ts:3,12,19,25,32` | Define no ambient/System defaults, suppression of raw receiver text, caller outcome versus physical settlement, cancellation/accounting, and safe internal failure data. These constraints prevent leaks and premature slot release. |
| `destination-settings-service.ts:45,60` | Identify current saved-version dispatch authority and trusted caller ownership of tenant/actor. They prevent an unsafe interpretation of otherwise plain identifiers. |
| `destination-settings-store.ts:1,24` | Specify trusted opaque tenant source, absence expectation, and ciphertext preservation. These are port semantics, not descriptions of SQL syntax. |
| `otlp-audit-request.ts:7` | Requires a previously checked TLS socket and forbids global agent/OTel defaults. This transport precondition matters across callers. |
| `otlp-audit-sender.ts:19,31,54,60,78` | Explain untrusted error metadata, payload clearing, synchronous preparation, absence of nested queue/defaults, and caller settlement before native cleanup. These are security/resource-lifetime reasons. |
| `public-audit-destination.ts:8,43` | Document the non-obvious Azure virtual-IP exclusion and why uncancellable native DNS keeps its admission reservation. |
| `test/acceptance/auth/hosted-image.test.ts:21` | States the real AMD64/Docker prerequisite and absence of live identity credentials; it bounds the evidence claim. |
| `test/acceptance/auth/hosted-workos-signup.test.ts:539` | Explains why the fake exists before composition fails and can prove no provider operation occurred. |
| `test/support/container/audit-sender-site.ts:59,75,182` | Explain isolated public-shaped networking, disposable fixture keys, and the real sender/TLS evidence boundary. Removing these can make fixture permissions look like production guidance. |
| `test/support/in-process/postgres-settings-site.ts:12` | Identifies the disposable database and verified-TLS fixture, not a production/shared-project connection. |
| `test/support/processes/audit-destination-test-probe.ts:26` | Names the two replaced boundaries while routes/service/codec/sender are real, so the proof is not mistaken for live-provider/SQL evidence. |
| `test/support/processes/module-paths.ts:3,4,5,6,18,21,24,25,30,33,43,44,50,53,57,63` | Explain the single D8 path owner, source/dist depth and extension differences, executable versus preload URLs, prerequisites, fixture mounting/copying, migration order, and container isolation. These prevent hidden source-layout assumptions in consumers. |
| `workos-organization-audit-documents.ts:3` | Explains why exact prepared bytes and versions stay together while owner approval/publication remain separate. The comment prevents mistaking an embedded bundle for approval evidence. |
| `logging-form.ts:16`; `logging-routes.ts:18,44,110` | State the legacy field's trusted-tenant meaning, current access boundary, secret-bearing exception suppression, and independence of completed Save/Test outcomes from capture failure. These are authority and failure constraints. |
| `test/support/doubles/logging/destination-settings-fake.ts:4` | Explains that an uncertain response may follow a committed in-memory write, which matters to recovery/retry assertions. |

Paths in this section use `src/` unless they start with `test/`; the named file
paths are unambiguous in the reviewed log. Every one of the 59 comment locations
is covered above.

## File size

- `test/acceptance/auth/hosted-workos-signup.test.ts`: retains related signup
  journeys, shared fixture lifetime, recovery/replay cases, and complete document
  comparison. New assertions extend the existing production-composition case.
- `test/support/container/audit-sender-site.ts`: one disposable Docker site owns
  its certificates, isolated network, receiver/Collector processes, public probes,
  and cleanup. Splitting by line count would distribute that resource lifetime.
- `test/unit/logging/audit/otlp-audit-sender.test.ts`: shared socket/native-work
  doubles support protocol, cancellation, payload clearing, and physical-settlement
  cases. The new header case belongs to that sender boundary.
- `test/unit/logging/destination-settings-service.test.ts`: one service fixture
  supports validation, tenant-bound encryption, revision authority, token retention,
  and unavailable/unconfirmed behavior. New dataset cases exercise the same
  settings invariant. Keep the test-oracle correction above separate from size.
- `src/accounts/providers/workos/workos-organization-audit-documents.ts`: this is
  a 346-line frozen exact-byte legal bundle, not 346 lines of branching program
  logic. One call validates its purpose, versions, hashes, and literal documents.
  Terms/Privacy/agreement must remain consistent and match canonical UTF-8 bytes;
  arbitrary splitting or string assembly adds review risk without reducing code
  complexity. Exact-byte source contracts and real-composition acceptance tests
  cover the new bundle. Retain it as one cohesive static artifact; it does not
  replace legal approval or relax a production complexity goal.

## Final committed-candidate verification

`habit-hooks --branch origin/main --no-snooze` ran on `85206b1c22dab78e8379d7a10e2f2b9ac31af9c6` against `845cec3060b0880cd27c36047f1da57a1c3772ba`. It exited 1 with the same 92 findings and an empty snooze file. The only log difference is the order of the five oversized-file paths; no finding was added or removed. Every retained reason above still applies. The final log is `habit-hooks-committed.log`, SHA-256 `d75e8d896ca5b6c5872714da1f84f6c38593031e3f548ae78a136afc750bdac7`.

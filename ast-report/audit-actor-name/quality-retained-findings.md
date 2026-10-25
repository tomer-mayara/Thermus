# Independent retained-finding review

Independent review covered source candidate `05b0d00df028a220893fbc7fae14ac889a586fdd`.
Manager follow-up covers comment-only cleanup `2d0ad41846a99ce8fac1a3bec6582f04df5178ca` against `origin/main`,
the supplied habit-hooks reports, and `docs/coding-principles.md`.
This is agent review evidence for manager sign-off, not human approval.
No source, tests, or tracked documents were changed. No tests, builds, or metrics
were run.

The final habit-hooks command exited 1 with 101 findings: 11 complexity,
one function size, two parameter count, 83 comments, and four file size. The
initial 84-finding report remains in `habit-hooks-initial.log`; the intermediate
100-finding report remains in `habit-hooks-before-comment-cleanup.log`. Selecting
the administration test added inherited comments and a file-size finding. Two
inaccurate comment lines were removed in 2d0ad418; the remaining findings are
retained for the reasons below. This is not a clean lint pass. The snooze file
is `[]`. CRAP results were not available at independent review time.

## Complexity and function size

| Finding | Disposition and reason |
| --- | --- |
| `workos-auth-provider.ts:168`, `profileNameOf` | Retain. The new function owns one adapter policy: select display data from a matching provider profile. Its early guards separate an unknown/wrong user, native-name precedence, wrong native type, and split-field fallback. A nonempty native name, including invalid control-bearing data, must reach context validation rather than permit fallback; null/blank native values may use split fields. These are distinct required outcomes, not independent services. Further extraction would scatter a short precedence rule or hide it behind generic validators. The context owns final UTF-8/Unicode bounds. New-function CRAP must still be assessed; this rationale cannot waive its goal. |
| `hosted-workos-application.ts:97`, `composeWorkOSApplication` | Retain. It is the composition/lifetime owner: explicit audit overrides, optional storage snapshots, tool-server selection, disposal, and provider/account wiring must fit together. The changed line supplies an existing SDK collaborator to the provider. Moving choices into a generic factory would hide override and resource ownership. |
| `fetch-tool-server.ts:35`, `callTool` | Retain. It owns one MCP call from validated tool input through cancellation, safe public outcome mapping, SDK result projection, and final audit/System completion. The audit actor gains one optional field; the operation order and completed-result invariant stay local. Extracting a second lifecycle owner could separate the captured outcome from the result actually returned. |
| `fetch-tool-server.ts:96`, `safeFailure` | Retain. It maps untrusted failures to a small public vocabulary and rechecks cancellation after error property reads. Its guards protect against throwing getters and prevent raw exception data reaching the client. Table lookup is already used for fixed public messages; a further polymorphic layer does not simplify untrusted input. |
| `audit-event-projection.ts:31`, `inputOf` | Retain. Search and fetch have different accepted input contracts and redaction rules. The early guards constrain supported protocols, URL authority, point counts, and malformed text before copying content. This candidate adds no input branch. A shared generic text/URL validator would obscure those different guarantees. |
| `audit-event-projection.ts:63`, `projectAdministrationChange` | Retain. It validates one invitation-event union: action, outcome, optional customer role, and email-versus-invitation target. Validation and the named-field output belong together at the capture boundary. Optional actor-name policy is delegated to the common context projection, not repeated per event. |
| `destination-settings-service.ts:49`, `authorizeExport` | Retain. The guards ensure one current enabled revision authorizes one attempt and that only a usable tenant credential can be returned. Cancellation, absent/changed state, and unavailable storage have deliberately different outcomes. A cached authorization or broad exception handler outside this operation could weaken revocation. |
| `destination-settings-service.ts:71`, `testSaved` | Retain. This operation owns Test's one saved-revision snapshot, no-save rule, one send, cancellation checks, and post-send revision confirmation. These phases make a lost or changed result explicit. The candidate changes only the actor contract; its name is copied before asynchronous work. |
| `destination-settings-service.ts:106`, `save` | Retain. The sequence joins input validation, current revision, retained-token policy, tenant-bound encryption, and one optimistic save. Moving individual guards away would make credential retention or conflict behavior harder to verify. Actor-name support introduces no Save branch. |
| `destination-settings-service.ts:144`, `invalidInput` | Retain. The flat guards return field-specific errors for settings, public endpoint, dataset, and token. They implement one input contract and do not mix external work or recovery. Replacing them with a generic schema framework is beyond this change and does not improve the visible rules. |
| `otlp-audit-encoding.ts:23`, `eventAttributes` | Retain. The discriminated event union has different wire attributes and tool-result consistency checks. One explicit dispatch makes the allowed OTLP fields visible; it also rejects unsupported events. The new common actor attribute stays in the common encoder, outside the per-event dispatch. |
| `fetch-tool-server.ts:20`, `createFetchToolServer` size | Retain. The factory binds one trusted request context, tool listing, call lifecycle, and lifetime tracking to one SDK server. Its nested call handler is request-local by design. Moving it merely to satisfy a line threshold would add a context-passing abstraction without changing ownership. |

## Parameter count

Retain `DestinationSettingsService.test` and `testSaved`. Tenant scope, desired
saved settings, trusted actor, and cancellation signal are four different inputs
with different authority and lifetime. Input settings already form their domain
record. Tenant/actor are supplied independently from the trusted Admin context;
the signal controls work rather than data. A new all-fields options bag would
hide those distinctions. Reusing `AuditContext` as a whole would also require a
premature timestamp and misrepresent the synthetic event's send time.

## Comment groups

- `access-context.ts:4`, `workos-auth-provider.ts:26,171`, and
  `audit-content.ts:78`: retain the new constraints. Display metadata cannot
  authorize; optional provider failure cannot deny access; invalid nonempty
  native names cannot cause fallback; invalid display data cannot drop the
  stable-identity event. These constraints are not stated by the optional string
  type or by function names alone.
- WorkOS provider's remaining comments: retain the authority/issuer distinction,
  fresh-grant rule, user-versus-M2M `sid` rule, safe token-error boundary, and
  `jose` issue-time limitation. They explain security/protocol choices which a
  normal field name does not establish.
- BetterAuth provider comments: retain issuer/resource/installation semantics,
  local-signature-check-before-introspection order, account-ban lifetime, local
  key-set read, and introspection's session-revocation role. They explain why
  similar-looking checks are required and why provider outages differ from
  rejected credentials. They also prevent a future optimization from dropping
  a necessary check or leaking response contents.
- Hosted application comments: retain provider connection scope, production/test
  composition seams, explicit override precedence, short no-retry timeout,
  startup failure policy, shared-directory role, and resource-selection rules.
  These are composition contracts, not merely a narration of assignments.
- MCP failure/completion comments: retain throwing-getter and best-effort
  boundaries. A completed tool result must survive either logger or customer
  capture failure. An empty catch without this reason invites unsafe replay or
  propagation.
- Audit content comments: retain escaped-quote/enclosure rules, public URL
  boundary, recognized-credential limit, and byte-budget reservation. The regex
  and Unicode slicing code do not make these constraints clear by themselves.
- AuditLog comments: retain timestamp units, caller-validated-input/final-public-
  text precondition, truncation-marker accounting, synthetic-Test distinction,
  synchronous admission contract, allowlisted capture policy, and reasons that
  capture failure cannot replay an administration write or replace a result.
- Destination settings and OTLP encoder comments: retain fresh-revision
  authorization, trusted Admin context provenance, and named-field-only wire
  translation. They define authority and information-flow boundaries.
- `test/unit/auth/access-context.test.ts:13`: retain the explanation that
  synthetic test roles exercise explicit permissions and do not represent the
  current customer role catalog. It protects test meaning during role changes.
- `test/acceptance/auth/hosted-workos-administration.test.ts:8-11`: retain the
  application-side proof limit, real loopback HTTP composition, fake-provider
  seam, and separate hosted-live gate. These prevent local fake success from
  being presented as provider evidence.
- Same test, lines 16 and 33-34: retain the external-ID and mixed-role/inactive
  membership fixture context. The fixtures model important authorization cases
  and the seat-count baseline, rather than an arbitrary catalog of names.
- Same test, lines 80-81: retain why CSRF comes from the session endpoint. A
  refused page has no form, so reading a form token from it would test a false
  precondition.
- Same test, lines 107-108 and 137-138: retain the distinction between
  authentication/refresh traffic, access-resolution reads scoped to the current
  user, and protected organization reads/writes. This distinction is exactly
  what the own-profile-read correction must preserve.
- Same test, former lines 115-116: **fixed in 2d0ad418**. The text says "A single-role write
  on the authorization resource of Acme..." immediately above `changeRecords`,
  but that function only selects and parses System log records and performs no
  provider write. The manager removed the two stale lines. Being inherited does
  not justify inaccurate prose.

These are bounded dispositions for the reported groups, not a global exception
for future explanatory comments.

## Test file sizes

- `test/acceptance/auth/hosted-workos-administration.test.ts`: retain the complete
  hosted current-grant, revocation, target-scope, invitation, and record story
  through the same real HTTP application composition. The correction allows
  only exact `GET /user_management/users/<current-subject>` reads and asserts
  their count equals the refused request count. Other user reads, member reads,
  invitation requests, and writes remain in the forbidden set. It adds no new
  scenario family or helper responsibility that warrants a suite split. The
  existing fake/live evidence boundaries must stay visible if a later change
  extracts larger independent stories.
- `test/integration/auth/local-access.test.ts`: retain its complete local OAuth,
  real SQLite/BetterAuth, and MCP access story. This change updates one expected
  resolved profile value. Splitting the established installation/session
  lifecycle for that assertion would add fixture coordination without isolating
  a new subject.
- `test/unit/logging/audit/audit-capture.test.ts`: retain the one capture-boundary
  subject and adversarial text/URL/budget matrix. Name cases check detached
  actor copies and optional-field omission through that same public boundary.
  A separate tiny helper-test module would weaken the visible boundary story.
- `test/unit/logging/audit/destination-test.test.ts`: retain one Test operation's
  saved-state, credential, cancellation, concurrency, and snapshot contract.
  New actor mutation/invalid-name cases fit its existing snapshot subject.
  Moving them away would duplicate the saved-settings fixture.

## Maintainability dispositions

Scores below are the manager-supplied snapshot values, not a new measurement.
Every changed production file remains below 85 except `AuditLog`; no production
file is new. Retention is justified by ownership and behavior, not by the fact
that the file was already low. These reasons do not claim the goal passes.

| File | Base → head MI | Reason |
| --- | --- | --- |
| `accounts/identity/access-context.ts` | 62 → 66.4 | Keep canonical identity copying, immutable grants, and optional display validation at the shared context boundary. The small display guard prevents every caller from having to enforce it. |
| `accounts/providers/better-auth/better-auth-provider.ts` | 64.4 → 63.9 | Keep local token verification/introspection and account status with the provider. Retaining its existing account-read result adds the profile name without another query or caller authority. |
| `accounts/providers/workos/workos-auth-provider.ts` | 67.9 → 61.6 | Keep provider profile adaptation and optional failure within the WorkOS owner, after its fresh access resolution. The new native/split precedence branches encode the stated behavior. Splitting this small adapter into a new component would add a boundary without removing a responsibility. |
| `app/hosted-workos-application.ts` | 56.2 → 56.2 | Keep explicit provider composition and disposable storage/snapshot lifetime. The candidate injects the already configured bounded SDK client and creates no second connection owner. |
| `interfaces/mcp/fetch-tool-server.ts` | 44.7 → 44.5 | Keep trusted-context capture beside final projected tool completion so actor attribution and public result refer to the same request/outcome. The optional name adds no network work here. |
| `logs/audit/audit-content.ts` | 66 → 65.3 | Keep export-specific normalization/redaction and byte limits with capture content. The actor-name helper serves projection, synthetic Test, and direct encoding. Identity validation stays separate because identity does not own customer-export redaction; two similar guards do not justify a cross-component dependency. |
| `logs/audit/audit-event-projection.ts` | 37 → 36.6 | Keep explicit event-union validation, named-field copies, and serialized result-budget reservation in one capture boundary. Name omission is common context policy, not a new branch in every event projector. |
| `logs/audit/audit-log.ts` | 88.1 → 88.1 | Passes the MI goal. The optional actor field preserves the event contract's small synchronous capture owner. |
| `logs/audit/destination-settings-service.ts` | 39 → 38.6 | Keep saved-revision, credential, and Test outcome authority in one service. Copy/sanitize the name before asynchronous Test work; do not make the exporter call identity services. |
| `logs/audit/otlp-audit-encoding.ts` | 54.6 → 53.9 | Keep the allowlisted event-to-wire translation, direct-event validation, timestamp representation and request-size bound together. The encoder must independently omit unsafe optional display data because direct synthetic callers need not pass through AuditLog. |

No source fix was requested. The stale test comment is corrected. The
complete-candidate process and CRAP reports must still be read. A new/changed
function goal miss, tool failure,
missing evidence, or required exception cannot be waived by these MI or
habit-hooks retention reasons. Root manager sign-off on these retained findings
is recorded below; final metrics and eligibility are separate.

## Manager disposition after review

Removed the two inaccurate provider-write comment lines above the read-only `changeRecords` test helper in 2d0ad418. No executable source or test behavior changed. The post-cleanup habit-hooks run reported 98 findings (11 complexity, 1 function size, 2 parameter count, 80 comments, 4 file size) and exit 1; it is a reviewed retained-findings run, not a clean lint pass. Root manager reviewed the source, independent reasons and correction, and accepts the remaining dispositions. The snooze file stays empty. Final CRAP and checker evidence remain separate and can still block readiness.

## Coverage repair follow-up

The final complete-candidate run after 2e5d7ad3 adds three existing comment findings in `script/code-quality/coverage/source-bindings.ts` (lines 12, 45, 46). Retain them: they state the strict executable range and exact declaration-boundary requirements, and explain the modifier prefixes V8 omits. These are safety constraints that prevent a later fuzzy match from fabricating coverage identity. No threshold or evidence guard was weakened. Final count is 101; snooze remains empty. Independent audit_name_design review and root manager review accept the one-line JSDoc skip, actual-function/Inspector proof and 33 unchanged negative guards. The original raw coverage data/report remains retained; fresh capture is required after tooling inputs changed.

## Final metrics assessment at 19e60e2b

Fresh verified unit + integration coverage maps every added/changed production function. All 22 rows meet their applicable CRAP goals; new functions are at most 12, changed functions below 30. `profileNameOf` is 12 at 100% own-character coverage; `auditActorName` is 7 at 100%; `displayNameOf` is 6 at 100%; `encodeAuditEvent` is 5 at 100%. The largest changed row is `callTool`, 16.000006912 at 99.7%; `testSaved` is 15.002737575 at 97.7%. No numeric exception is needed or used. The process exits 1 for retained MI/review goal misses; CRAP and Architecture pass. This is valid completed evidence, not a tool failure or an assertion that every quality goal passes.

Retain the remaining AST findings for specific reasons:

- High WorkOS MI drop (67.8821 to 61.5815), file complexity 56 over 40, and the new `profileNameOf` complexity 12: the short provider adapter owns matching-profile, native-name precedence and split fallback after current grants. Splitting it solely to change counts would scatter this one provider policy. Required branches have 100% measured own-character coverage.
- High test-only MI drop in `workos-connection.test.ts` (49.0302 to 41.2021): the complete stalled-response proof must show fetch signal, body entry, predeadline state, deadline rejection and one attempt together. It is a focused integration proof of actual transport cancellation; tests have no production MI goal.
- `callTool` complexity 15 to 16: the extra decision copies an optional field into the explicit trusted actor allowlist beside the final projected result. Retaining it keeps attribution with that completion, and its changed-function CRAP passes.
- `audit-event-projection.ts` and `destination-settings-service.ts` efferent coupling 11 over 10: both call the audit-owned name normalizer; the service also reuses the existing Audit actor type. These are deliberate collaborations within the same Audit component, with no new component edge or cycle. Shared redaction at three Audit entry points prevents inconsistent optional-field policy.

The checker notes all 48 public modules with three snapshot changes. Other affected surfaces keep declarations unchanged: Audit sender/send transitively consume the optional field without changing their own signature; browser-session, session-controls and verifier retain their signatures and use the shared optional user field only through resolved context. None gains name-based authority. The WorkOS MI-drop/high-finding notes are covered above. The checker reports local mechanical eligibility only; it cannot prove the required container gates or current human approval. Those remain explicit overall blockers.

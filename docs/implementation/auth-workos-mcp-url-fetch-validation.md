# Auth WorkOS MCP URL fetch: validation record

Date: 2026-10-15. Runtime: Node 24.20.0.
PR: `3-headed-monkey/Thermus#108`. Status: Draft.

This record covers the reviewed source candidate `975b2b10` on
`codex/pr108-workos-onboarding`, after the merge of main, commit `6cab980f`. The original PR head was
`b846e1a572c72edd29f15ee3e77bcff90c87759a`. The manager reviewed the final
source and the findings below. No Ready or merge approval is recorded here.
The complete hosted live gate passed. The fresh-account browser-first proof
remains open.

## Complete-candidate checks

All passing test reports below have zero failures, cancellations, skips, and
todo tests. Counts are per command; repeated cases are not additional test
coverage. `npm run check` also completed type checking and the portal build.

| Command | Exit | Reported result |
| --- | ---: | --- |
| `npm run check` | 0 | Node unit: 2,449 tests in 183 suites, all passed; portal unit: 8/8; build: 10/10; portal acceptance: 4/4. |
| `npm run test:integration` | 0 | 411/411 tests in 44 suites passed. |
| `npm run test:acceptance` | 0 | 298/298 tests in 42 suites, then 4/4 portal acceptance tests passed. |
| `npm run test:container` | 0 | 12/12 tests in 1 suite passed in 105,520 ms; Docker 29.5.2, `linux/arm64`. |
| `habit-hooks` | 1 | 258 `non-essential-comment` and 6 oversized-file findings. The manager accepts retention for the exact locations and reasons below. The command did not exit 0. |
| `npm run test:mcp:renderer` with pinned `LIGHTPANDA_BIN` | 0 | Optional renderer gate: 7/7 tests in 1 suite passed in 9,468 ms with pinned Lightpanda 1.0.0. |
| `npm run test:hosted-live` through the staging launcher | 0 | 77/77 tests in 17 suites passed in 697,702 ms. This complete run includes the changed Google-only and DCR/CIMD configuration proofs. |
| Live slice, invalid Bearer request over trusted HTTPS | 0 | The running slice returned `401 invalid_token` and a Bearer challenge with `https://localhost:46443/.well-known/oauth-protected-resource/mcp`. |
| Manual Google → Connect → HTTPS MCP fetch → Axiom proof | Pending | The user chose a fresh `thermus.ai` Google account. The walk has not completed. |

Full check logs at the time of review:
`/tmp/thermus-pr108-checks.b4oEa2/check.log`, `integration.log`,
`acceptance.log`, `container.log`, `habit-hooks.log`, `hosted-live.log`, and
`slice-final-wording.log` in that directory.
These are local temporary evidence files; the results and retention decisions
are preserved in this repository record.

## Focused checks

| Scope | Result | Evidence limit |
| --- | --- | --- |
| Merge verification before the new onboarding work | 138/138 passed; the then-existing HTTPS site cases also passed 3/3. | Baseline after main integration; these runs do not certify the later source changes. |
| Final onboarding candidate | Exit 0; 82/82 tests in 9 suites passed. Breakdown: 34 onboarding integration, 2 callback unit, 3 new acceptance, 5 existing slice acceptance, and 38 WorkOS interface tests. | Compiled output from the shared build; local WorkOS API fake and renderer double. |
| Final HTTPS front | Exit 0; 11/11 passed. | Compiled integration cases; authenticated POST, token/current-role refusal, disconnect, streaming, and application/listener cleanup. |
| Final launcher | Exit 0; 13/13 passed. | Source and compiled unit cases use `pnpm` and `openssl` doubles; include the slice organization default, override, and secret-output checks. |
| Dee scenario wording correction after the complete checks | Exit 0; 5/5 source and 5/5 final compiled slice acceptance tests passed, with zero failures, cancellations, skips, or todo cases. | Only the title and comment changed: a non-`thermus.ai` Google identity has no automatic membership; a later external User grant is observed on the next MCP request. |

The compiled onboarding command selects these five files with `pnpm exec
node --test`:

```sh
pnpm exec node --test \
  dist/test/unit/auth-workos/workos-sign-in-onboarding.test.js \
  dist/test/integration/auth/workos-google-onboarding.test.js \
  dist/test/acceptance/work-slice/auth-workos-mcp-url-fetch/auth-workos-onboarding.test.js \
  dist/test/acceptance/work-slice/auth-workos-mcp-url-fetch/auth-workos-mcp-url-fetch.test.js \
  dist/test/interface/auth/workos.test.js
```

The HTTPS and launcher focused files are
`dist/test/integration/auth/hosted-live-site.test.js` and
`dist/test/unit/work-slice/auth-workos-mcp-url-fetch-script.test.js`.
The wording-only check ran the existing slice acceptance file from source,
then reran its final compiled output; both passed 5/5.
`bash -n` for the shell launcher and `git diff --check` also passed.

These passes establish application behavior and the tested contracts. They do
not prove real Google authentication, a real client's registration and
Connect browser consent, a real renderer fetch through the authenticated
HTTPS endpoint, or Axiom delivery.

## Habit-hooks retention decision

`habit-hooks` exited 1. Its only findings are the 258 comment findings and the
6 oversized files below. The manager reviewed and accepts each retention
reason under [AGENTS.md](../../AGENTS.md) and the
[test gate policy](test-gate-policy.md#required-runs), which permit a reason
for a retained smell. This is not a claim that habit-hooks exited 0.
`.habit-hooks/snooze.json` remains `[]`; no suppression or snooze was added.

The source review is `/tmp/thermus-pr108-habit-hooks-retention.md`. Each row
lists every reported location in that file. The tables map 258/258 comment
findings across 26 files and 6/6 oversized-file findings. Exact stripped-text
provenance at the same path is 186 from main, 55 from the original PR head,
and 17 from this implementation, totaling 258. A moved equivalent comment can
appear under the original PR head in this comparison. Provenance is context;
the behavioral reason in each row is the retention decision.

### Comment findings: 258 of 258

| File and all reported lines | Findings | Reason to retain |
| --- | ---: | --- |
| `src/hosted-workos-application.ts`: 21, 22, 29, 30, 34, 38, 45, 46, 86, 87 | 10 | Retain the connection and composition comments (21–22, 29–30, 34): they define the opt-in test/slice seams and state that normal production has neither a fetch tool nor automatic enrollment. Retain 38, 45–46: timeout/retry and lazy network behavior are operational constraints, not promises visible in the types. Retain 86–87: the same directory must serve access checks and account operations, so changes cannot use a separate stale grant source. |
| `src/index.ts`: 38, 67, 69, 78 | 4 | Retain 38: it protects the edition boundary and the lazy-load constraint. Retain 67, 69, 78: shutdown order, early signal registration, and cleanup after failed startup prevent hangs and listener leaks; the order is a lifecycle rule. |
| `test/unit/stop-signal.test.ts`: 7 | 1 | Retain 7: EventEmitter is a deliberate substitute for process signals. Its emit call must include the signal argument, which is not implied by the event name; the comment records that contract. |
| `test/unit/test-support-paths.test.ts`: 12, 13, 33 | 3 | Retain 12–13: these checks exist because the compiler cannot validate runtime paths and the gates that consume them run less often. Retain 33: the portal build is absent at this stage of the check command, so this test must check its parent rather than require a completed portal build. |
| `src/organizations/change-records.ts`: 3, 4, 7, 8, 13, 15, 20, 21, 31, 34, 43, 44, 45, 71 | 14 | Retain 3–4, 7–8, 13, 15, 20–21, 31, 34: these define public outcome meanings, timestamp units, credential exclusion, and when the role becomes known. Retain 43–45 and 71: a failed write can have an unknown effect, must not be repeated, and records must select safe fields. These are audit and retry invariants. |
| `test/acceptance/auth/hosted-workos-administration.test.ts`: 11, 12, 13, 14, 20, 37, 38, 39, 107, 108, 134, 135, 142, 143, 172, 173 | 16 | Retain 11–14: the fake establishes application behavior only, not live WorkOS behavior. Retain 20, 37–39: the fixture includes an external-ID resource and an explicit seat/role matrix that explains the cases. Retain 107–108, 134–135, 142–143, 172–173: these distinguish safe CSRF token reads, actual writes, external-ID resource naming, and member-list reads from access reads. Removing these qualifications can make the assertions claim the wrong provider behavior. |
| `test/acceptance/auth/hosted-workos-organizations.test.ts`: 12, 13, 14, 32, 33, 34, 91 | 7 | Retain 12–14: the evidence boundary excludes proof of WorkOS itself. Retain 32–34: the fixture matrix explains inactive, default-role, cross-organization, and Super Admin cases. Retain 91: only refresh requests count as organization-switch evidence. |
| `test/acceptance/auth/hosted-workos.test.ts`: 15, 16, 17, 43, 44 | 5 | Retain 15–17: offline application checks cannot establish real WorkOS behavior. Retain 43–44: the role matrix explains why the same endpoint accepts or refuses each actor. |
| `test/acceptance/auth/hosted.live.ts`: 20, 53, 81, 113, 175, 176 | 6 | Retain 20 and 53: setup refusals must name no secret and all later settings must pass the same preflight. Retain 81: failed setup must fail the run without network activity or misleading skipped cases. Retain 113: metadata must satisfy the same jose contract as tokens. Retain 175–176: suite order deliberately reuses a 300-second expiry wait; reordering can invalidate the later expiry case. |
| `test/integration/auth/hosted-live-site.test.ts`: 18, 45, 46, 62, 63, 82, 89, 100, 101, 134, 147, 179 | 12 | Retain 18: placeholder settings must never call a real WorkOS environment. Retain 45–46: an absent PATH is not the same as an empty PATH for Node command lookup. Retain 62–63, 82, 134: cleanup must let a failing test exit, account for Node handle removal, and close MCP exactly once. Retain 89, 100–101: the two TLS observations deliberately use different certificate trust behavior and short-lived connections. Retain 147 and 179: fixed-port cases share the live/slice port and must be serialized. |
| `test/interface/auth/workos.test.ts`: 31, 32, 42, 162, 277 | 5 | Retain 31–32: pinned SDK proofs using a fake do not prove the real service. Retain 42: the type assertion deliberately detects SDK contract drift. Retain 162: omission of external_id differs from a present empty value. Retain 277: key-set, issuer, audience, and algorithm checks define the verifier boundary that these proofs must preserve. |
| `test/support/hosted-live/https-client.ts`: 9 | 1 | Retain 9: trusting only the site certificate and using one connection per request are intentional TLS and resource-isolation properties of this test driver. |
| `test/support/hosted-live/local-https-site.ts`: 29, 46, 48, 50, 53, 54, 58, 59, 60, 61, 62, 66, 75, 81, 90, 99, 107 | 17 | Retain 29: generating a certificate also writes persistent filenames; the signature alone shows only returned buffers. Retain 46, 48, 50, 53–54: the exported options document defaults, ownership, logger routing, and the custom-application seam. Retain 58–62 and 75: the site is a specific two-listener deployment shared by a live gate and a manual slice, with different certificate/application lifetimes. Retain 66, 81, 90, 99, 107: resource order, preflight, independent listener ownership, early rejection observation, and partial-listen cleanup prevent leaked servers and deadlock. These comments explain why the disposal stack is registered in this order. |
| `test/support/hosted-live/portal-front.ts`: 7, 8, 23, 24, 25, 95 | 6 | Retain 7–8: HTTP routing owns no listener; the site owns the lifecycle. Retain 23–25: Chrome applies form-action to redirect targets after POST, which explains the WorkOS/AuthKit CSP origins. Retain 95: Set-Cookie must remain separate repeated fields, not a combined header; the flat array preserves that wire contract. |
| `test/support/processes/module-paths.ts`: 3, 4, 5, 6, 14, 17, 18, 21, 24 | 9 | Retain 3–6: D8 centralizes runtime path knowledge, and source and built modules have different depths. Retain 14 and 21: these exports deliberately name the repository containing package.json and the built program rather than a source entry. Retain 17–18: the portal build has a later build phase, so its parent alone is checked. Retain 24: --import requires URL preloads while the child probe is an executable path. These distinctions prevent path changes that compile but fail only at runtime. |
| `test/support/work-slice/observe-fetches.ts`: 5, 29 | 2 | Retain 5: the limit counts Unicode code points in the completed log line, not bytes or UTF-16 units and not the caller result. Retain 29: string iteration preserves surrogate pairs while the slice indices use UTF-16 offsets; this explains the otherwise non-obvious counting algorithm. |
| `test/acceptance/work-slice/auth-workos-mcp-url-fetch/auth-workos-mcp-url-fetch.test.ts`: 17, 18, 23, 29, 47, 73, 75, 84, 88, 115 | 10 | Retain 17–18: offline fakes cannot prove Google, client registration, or Axiom ingestion. Retain 23: the duplicated fixture is the second copy and follows the explicit DRY3 rule. Retain 29: the expected missing paragraph comes from a trusted selector fixture. Retain 47, 84, 88: listener URLs differ from public/audience URLs, close is idempotent, and shutdown preserves production order. Retain 73, 75: Google supplies no MFA evidence, and Dee’s example.com address must remain outside the automatic-enrollment domain so the manual membership case stays distinct. Retain 115: refused HTML pages are deliberately represented by an empty JSON body in this test driver. |
| `test/acceptance/work-slice/auth-workos-mcp-url-fetch/auth-workos-mcp-url-fetch.ts`: 1, 2, 3, 4, 5, 45, 46, 65, 82, 89 | 10 | Retain 1–5 and 45–46: the manual slice is a separate composition root with a direct-execution guard and a deliberate production boundary; it adds the fetch tool, full Markdown logs, and fixed verified-Google enrollment only to this slice. Retain 65: site cleanup must finish before the logger flushes. Retain 82: Ctrl+C can arrive immediately when instructions appear. Retain 89: WorkOS URIs require a root origin, so an otherwise valid URL with a path is refused. |
| `test/acceptance/work-slice/basic-mcp-url-fetch/basic-mcp-url-fetch.ts`: 1, 2, 3, 4, 27, 28 | 6 | Retain 1–4: this is a manual entry point and importable composition; its execution guard prevents side effects in acceptance tests. Retain 27–28: production deliberately excludes the mock provider and full page-text logging; this slice has neither OAuth nor browser pages, which explains its route behavior. |
| `test/support/doubles/workos/workos-fake.ts`: 12, 19, 31, 55, 62, 102, 119, 124, 137, 138, 156, 161, 162, 163, 164, 165, 172, 174, 175, 177, 179, 180, 182, 185, 186, 188, 190, 191, 196, 199, 200, 243, 244, 257, 264, 288, 301, 310, 311, 319, 320, 327, 328, 343, 344, 361, 389, 390, 391, 392, 405, 406, 411, 419, 426, 443, 444, 456, 457, 467, 476, 506, 528, 529, 543, 544, 558 | 67 | Retain all listed locations: they document the external WorkOS contract represented by this stateful fake, not merely the mechanics of its methods. The groups cover verified-email defaults (12, 172), default membership roles (19, 55, 62, 419), expiry and pagination behavior (31, 124, 137–138, 182, 185–186, 343–344, 426), revision/change semantics (102, 119, 199–200, 243–244, 301, 467, 558), error shapes (156, 190–191), fake scope and stable identities (161–165, 177, 196, 288, 327–328, 506), privacy canaries (174–175), external-ID resource naming (179–180, 389–392, 405–406), authentication and refresh behavior (188, 257, 264), non-idempotent/reactivating creation (361), single-role assignment semantics (411), and invitation side effects/status/roles (310–311, 319–320, 443–444, 456–457, 476, 528–529, 543–544). Tests rely on these provider-specific behaviors. Keeping the contract next to the fake avoids treating it as proof of unobserved live service behavior. |
| `test/integration/auth/fixtures/https-site-fixtures.ts`: 8 | 1 | Retain 8: the fixture settings explicitly cannot access a real WorkOS environment; this states the isolation boundary of the HTTP integration cases. |
| `test/unit/work-slice/fixtures/launcher-case.ts`: 10, 11, 12, 24, 35, 36, 66, 97 | 8 | Retain 10–12: each launcher case runs in a temporary physical repository so it cannot change the real rules, certificate, or portal build. Retain 24: the openssl substitute preserves the base64 length contract without generating a real secret. Retain 35–36: the shell-to-JSON fixture has a restricted quoting domain and deliberately records no secret values. Retain 66: the physical path must match shell resolution through symlinks. Retain 97: an inherited shell setting could defeat isolation and make missing-setting cases falsely pass. |
| `src/auth/hosted-auth/workos/workos-browser-session.ts`: 14, 16, 26, 34, 43, 44, 79, 88, 93, 94, 95, 108, 116, 125, 152, 162, 163 | 17 | Retain 14, 16, 26, 34, 43–44, 79, 88: these define shared authority, clock units, display-only data, logout behavior, and the session/CSRF/MFA envelope across rotating seals. Retain 93–95, 108, 116, 125, 152, 162–163: the pinned SDK cannot distinguish some invalid/expired/new-key states, a rotated refresh seal must survive a refused organization switch, and only terminal failures clear the cookie. These are security and outage-preservation rules, not obvious from method names. |
| `src/auth/hosted-auth/workos/workos-google-onboarding.ts`: 29, 30, 31, 77 | 4 | Retain 29–31: enrollment is opt-in, retains existing grants/status, and has only an in-process queue; external writers and permanent deletion remain limitations. Retain 77: an unknown create outcome is reconciled by read and must never trigger a second create because WorkOS create can reactivate an account. |
| `src/auth/hosted-auth/workos/workos-session-client.ts`: 3, 16, 26, 37, 58, 59, 64, 69, 70, 75 | 10 | Retain 3, 26, 37: the types form the minimal adapter contract of the pinned SDK rather than generic domain session objects. Retain 16: verified email is trusted only from the code exchange, never from callback input or decoded token claims. Retain 58–59: the SDK embeds its own jose, so instanceof against the separately installed package fails. Retain 64, 69–70, 75: new signing keys, damaged seals, and 4xx OAuth refusals need different retry/session behavior; these comments state the SDK-specific classification reasons. |
| `src/auth/hosted-auth/workos/workos-sign-in.ts`: 43, 44, 72, 83, 89, 102, 122 | 7 | Retain 43–44, 72, 89, 122: PKCE state/verifier ownership, single-use cleanup, ordered pre-exchange validation, and rejecting duplicate callback values are trust-boundary requirements. Retain 83: WorkOS provides no MFA claim, so only the configured required-MFA password method supplies evidence. Retain 102: invalid, reused, and expired codes are terminal refusals, not provider outages. |

### Oversized files: 6 of 6

| File | Lines in final candidate | Reason to retain |
| --- | ---: | --- |
| `test/acceptance/auth/hosted-workos-administration.test.ts` | 518 | One application acceptance suite for hosted administration through real HTTP and a WorkOS fake. Its named scenario groups share the same actor/role matrix, request recorder, and grant/invitation assertions. Splitting by a line threshold would duplicate that scenario context or create a fixture module solely to distribute lines. This PR changes the composition call and retains the suite’s public behavioral scope. |
| `test/acceptance/auth/hosted-workos-organizations.test.ts` | 264 | One organization onboarding/selection acceptance suite. The actor matrix and switch-request evidence serve the same public flow. The existing file is cohesive; no additional concern was introduced by the composition-call update. |
| `test/acceptance/auth/hosted-workos.test.ts` | 294 | One hosted authentication acceptance suite with browser/session, Connect, and connection-startup groups using one HTTP site and identity matrix. The existing suite proves the same boundary after the composition seam change. Its groups are already named; a size-only split offers no clearer public contract. |
| `test/acceptance/work-slice/auth-workos-mcp-url-fetch/auth-workos-mcp-url-fetch.test.ts` | 248 | One offline acceptance specification of the slice composition in both MCP protocol eras, including refusal cases. The same fake site, renderer, logger, and actors make the observable fetch result and safe refusal assertions comparable. The file existed in b846e1a and remains a single coherent end-to-end composition suite. New automatic-enrollment acceptance cases live in a separate file rather than expanding this suite. |
| `test/interface/auth/workos.test.ts` | 1181 | One pinned WorkOS SDK/jose interface contract against the same fake API. It intentionally keeps request/response shapes, token/seal fixtures, error classification, and SDK behavior proofs together. It was already large before this change; the new verified-email assertion extends the same code-exchange contract. A future semantic split is possible, but this PR adds no unrelated responsibility and a threshold-only split would obscure shared SDK upgrade evidence. |
| `test/support/doubles/workos/workos-fake.ts` | 642 | One stateful external-provider fixture implementing WorkOS HTTP contracts. Memberships, authorization resources, role assignments, users, invitations, code exchange, and refresh share identities and state; separating route methods mechanically would hide these invariants or expose mutable state across files. The fake was already present and cohesive. The new behavior extends its existing membership and authentication contract; it adds no second external system. |

## Open release evidence

Keep the PR in Draft. The hosted live gate passed; complete the real
browser-first walk in the [slice guide](../../test/acceptance/work-slice/auth-workos-mcp-url-fetch/README.md#the-walk).
The fresh Google account must pass the trusted verified-domain callback,
receive explicit User membership and a selected browser organization, then
complete the client's separate Connect browser consent. Verify the client's
authenticated real HTTPS MCP fetch, renderer output, and the three matching
Axiom records. Verify wrong-token refusal and current User-role removal,
including a new Google sign-in that does not restore the role. Never print
keys, tokens, cookies, authorization codes, or complete authentication URLs.

A setup read-back is not this live proof. Missing credentials, an incomplete
walk, a filtered gate run, or skipped tests cannot count as a pass. Record any
new gate result here only after its command completes. After all required
local checks and the live proof are recorded, Ready still requires every
Actions job started for the final head to pass. A later source fix returns
the PR to Draft and requires the affected checks again.

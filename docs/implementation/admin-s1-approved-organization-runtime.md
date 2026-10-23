# Approved organization documents in production composition

Implemented 23 October 2026 after owner approval of the complete version 2
organization bundle and runtime publication. This record covers runtime wiring
and focused local verification. The legal package and approval record retain the
approval scope. This change performs no provider or Render action.

## Behavior

Production composition now supplies `approvedOrganizationDocuments` from
`src/accounts/providers/workos/workos-approved-organization-documents.ts`.
The bundle has purpose `organization-creation` and version
`s105-organization-proposal-2026-10-23-v2`. It embeds the exact canonical UTF-8
bytes from [the approved legal package](../legal/organization-signup-2026-10-23/manifest.json).
Startup validates the terms and privacy hashes through the existing validator.
The agreement version and exact text remain part of the frozen bundle.

| Document | UTF-8 bytes | SHA-256 |
| --- | --- | --- |
| Terms | 18,896 | `625010f6b3fd118c13a29cca29cfb066d5511d7d91d0c29e0e430ac0bdc14d0e` |
| Privacy | 29,125 | `d44db6099b758534e8d17f34bcda7096e02775ffccb40972ea1429093c1396ac` |
| Agreement | 378 | `279cb2f3005131618bcf7f3ea755ad09205dca3c490f2c3de0c70b25e1ef2a9a` |

Each document version uses its `hosted-terms`, `hosted-privacy`, or
`hosted-agreement` prefix and suffix `organization-proposal-2026-10-23-v2`.
The earlier personal bundle module, version IDs, text, and hashes are unchanged.
Supplying that earlier bundle to an explicitly enabled organization composition
still fails before provider requests.

Signup stays false by default. Closed GET/HEAD/POST behavior is retained. Enabled
signup shows the complete approved privacy notice before sign-in. The eligible
creator sees the organization name and one initially unchecked agreement; the
existing form checks and activation flow save the approved document versions and
hashes, then confirm first Admin and current product access. No MFA or policy
behavior is added. Production opening and remaining release gates belong to the
manager's execution record.

## BDD and TDD evidence

The acceptance specification was changed before production code. It uses the
real `openWorkOSApplication` composition through `openProductionSignupSite`, with
only external WorkOS transport and portal files replaced by local fixtures.

1. RED: the new approved-organization production acceptance case failed with
   `Enabled organization creation requires organization-creation documents.`
   The runtime still supplied the personal bundle.
2. RED: the focused bundle unit contract failed with `ERR_MODULE_NOT_FOUND`
   before the new bundle module existed.
3. GREEN: after adding the exact-byte frozen bundle, its unit contract passed.
4. GREEN: after switching the production import, the real-composition acceptance
   passed. It checks complete rendered legal text against canonical Markdown,
   fixed source hashes, document versions, exact agreement bytes/hash, one
   unchecked checkbox, saved legal versions/hashes, first Admin, and product access.
5. The combined focused run passed 63 tests, with zero failures, skips,
   cancellations, or todo tests. Backend `tsc --noEmit` passed.

The tests ran from TypeScript source with Node 24.20.0 and `--import tsx`; they
rewrote no `dist/` or portal build files while the manager used the existing live
probe build. Two earlier source-run attempts failed because the default Node 22
could not load TypeScript and Node 24 strip-only mode could not parse a parameter
property. These were tooling failures, not the behavioral RED evidence above.

Focused commands, with the pinned Node binary selected:

```sh
node --import tsx --test --test-name-pattern='approved organization bundle in production' test/acceptance/auth/hosted-workos-signup.test.ts
node --import tsx --test test/unit/auth-workos/workos-approved-organization-documents.test.ts
node --import tsx --test test/acceptance/auth/hosted-workos-signup.test.ts test/unit/auth-workos/workos-approved-organization-documents.test.ts test/unit/auth-workos/workos-signup-documents.test.ts test/integration/auth/workos-signup-routes.test.ts
node node_modules/typescript/bin/tsc --noEmit
```

The hosted-image acceptance case was updated to require successful enabled
startup and the complete approved privacy notice before sign-in. It retains the
closed-default image checks and makes no activation request. Its initial container
run was deferred while the manager used dist for live probes. The later dedicated
Linux AMD64 gate passed 7/7, including the approved enabled notice. The completed
worker gates below are separate from manager-owned Habit Hooks, metrics, final
architecture review, candidate classification, and human approval.

## Complete-candidate check follow-up

The first complete `build:hosted` attempt stopped in an existing search-completion
integration assertion. It searched the entire serialized log for `429`; a random
operation UUID contained those digits, although the structured completion held
only safe fields. This was a test false positive, not leaked HTTP detail.

The manager approved a test-only correction. The test keeps the client's exact
`Search failed: HTTP 429` response, checks one completion, validates the generated
operation ID and finite nonnegative duration, and compares every remaining field
with the exact safe completion shape. Private detail or extra HTTP fields fail
that comparison. Random IDs and duration digits no longer determine the result.
The affected integration file passed 47/47 locally with zero skips. The failed
full log is retained as `gate-build-hosted.log`; the fresh full attempt is
`gate-build-hosted-r2.log` under the ignored invitation-fixes evidence folder.
Final complete-candidate gate results belong to the manager's validation record.


The completed worker gate commands passed with Node 24.20.0 and
`LIGHTPANDA_DISABLE_TELEMETRY=true`:

| Command | Result |
| --- | --- |
| `pnpm install --frozen-lockfile` | Exit 0; pnpm 12.10.1. |
| `pnpm run test` | Exit 0; 4,182 Node tests and 49 portal tests. |
| `pnpm run typecheck` | Exit 0; backend and portal. |
| `pnpm run build:user-portal` | Exit 0. |
| `pnpm run test:container` | Exit 0; 11 tests. |
| `pnpm run build:hosted`, second attempt | Exit 0; 2,597 backend unit, 29 portal unit, 20 portal acceptance, 1,045 integration, 119 selected acceptance/interface, and 13 renderer cases. |
| `pnpm run test:container:hosted` | Exit 0; seven tests including the outer case, Linux AMD64 image and runtime. |

All completed test reports above show zero failed, cancelled, skipped, and todo
tests. The first `build:hosted` failure remains recorded above; its successful
second attempt followed the approved narrow test correction. No production source
changed to resolve that test failure. The hosted Docker context includes exactly
the three public canonical legal files needed by embedded checks; it includes no
restricted approval record.

Logs and exact source/test/build-input fingerprints are retained in the ignored
[worker gate artifact](../../ast-report/invitation-fixes-2026-10-23/worker-gate-results.json)
and its referenced logs. The manager fast-forwarded the base from `285f5f044409775c864556c335ca17f9d7f64c1f`
to `1c7a0b688318c0a1864ddf3360957804369f97d4` during the image gate; the base trees
are identical. All seven tested runtime, test, and build-context file SHA-256
fingerprints still matched at gate completion. These runs cover the retained uncommitted candidate bytes, not an
unspecified future commit. No worker live test, metric coverage, or provider action
was part of these gate commands.

## Manager quality review

The manager reviewed the complete source, tests, legal bytes, worker evidence,
and independent review. The full Staging journey also passed 28/28 and retained
the original complete inventory; its scope and log hash are in the
[release record](admin-s1-staging-release-verification.md#current-runtime-candidate).
The seven file hashes in the worker record bind the passing runs to the candidate.

The metrics process completed all four sections with verified unit coverage.
Review, CRAP, and architecture passed. Delta reports one retained MI goal miss:
`src/app/hosted-workos-application.ts` remains at 62.161664960403826, exactly its
base score, below 85. The change substitutes one validated document input and
adds no branch or responsibility. A larger composition refactor is outside this
release correction. The new immutable document module has no functions; its MI
and function CRAP are N/A, as the complete snapshot records. No metric exception
file or rule changed.

The changed `openWorkOSApplication` function has two paths and CRAP 6.0, below
30. Its measured unit coverage is 0%; the separate production-composition
acceptance and image checks exercise it. This is not a claim of measured
acceptance coverage. There are no new functions, CRAP goal misses, unknown
function identities, or high review findings. The data module's medium line-count
finding is retained because its one concern is the complete approved bundle.
The image test's low Halstead estimate change comes from the required full-notice
assertion. Splitting either solely to meet a line threshold would obscure that
contract.

Habit Hooks completed with exit 1 for 14 comment lines and three oversized
files. The manager accepts the per-finding reasons in the retained
`independent-final-review.md`: comments explain provenance, external seams,
request lifetime, and gate prerequisites; the three files each keep one legal
bundle or one acceptance/integration surface together. The snooze file stays
empty. Do not report this as an automated zero-finding pass.

All 11 registry Mermaid blocks are unchanged. Registry prose names the approved
bundle and existing metadata fields. Production callable declarations, authority,
write order, replay barriers, current-membership rules, storage, and deployment
topology are unchanged. No L4 view or decision record is needed. T1 review is
required for sensitive composition, protected provider paths, and the updated
gate description; the final checker records all mechanical reasons. Agent review
does not supply the required independent human approval of the committed head.

Full reports remain under `ast-report/`: `process.md`, `process.json`,
`snapshot-base.json`, `snapshot.json`, `review.json`, `crap.json`, and the verified
`coverage.json` with its original captures. The final PR binds refreshed reports
to its actual base and head. The generated immutable base record is committed
under `docs/metrics/`; it was not edited. Relative document links resolve.
Whitespace checks exclude the exact approved legal copies and their embedded
text, which retain required Markdown hard breaks, and the frozen patch, whose
blank context lines retain their patch prefix. Those bytes must not be trimmed.

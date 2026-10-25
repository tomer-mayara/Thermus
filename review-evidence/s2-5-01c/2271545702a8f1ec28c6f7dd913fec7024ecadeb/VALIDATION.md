# Validation

Candidate: `2271545702a8f1ec28c6f7dd913fec7024ecadeb`.
Actual parent: `0ff3f6cdde5be4124df0ed2ab002844d5db1c502` (PR #253).
Complete-candidate main merge base: `9d0546b93d37e74ee9ddc7d9f7f4a66b18de0546`.

Source changes select the full ordinary suite, typecheck, portal build, and the
applicable production gates. Selection includes the parent stack against main.
The final ordinary run has 4,997 backend and 49 portal tests, all passing.
Every selected new or changed test ran locally before its commit. Dedicated
runtime and live tests also ran; no new skip or todo was added.

| Check | Result | Full log |
| --- | --- | --- |
| `npm test` | 4,997 backend + 49 portal pass | [Ordinary](checks/npm-test-final.log) |
| `npm run typecheck` | Pass | [Typecheck](checks/typecheck-complete.log) |
| `npm run build:user-portal` | Pass | [Portal build](checks/portal-build.log) |
| Removal focus, including Chromium | 168 pass, including 29 acceptance cases | [Focused](checks/final-focused.log) |
| Changed compatibility tests | 29 pass | [Compatibility](checks/compatibility-focused.log) |
| Private PostgreSQL gate | 22 pass | [PostgreSQL](checks/postgres.log) |
| Audit Collector gate | 10 pass | [Collector](checks/collector.log) |
| Self-hosted container gate | 11 pass | [Container](checks/self-hosted-container.log) |
| Linux AMD64 hosted image gate | Seven pass, including the offline build | [Image](checks/hosted-image.log), [nested build](checks/hosted-image-build.log) |
| WorkOS staging gate | 28 pass | [Staging](checks/hosted-live-final.log) |
| API surface verification | All 49 snapshots current | [Snapshots](checks/api-final.log) |
| Selected coverage collection | 3,219 backend unit + 29 portal unit; 1,120 integration; 594 backend acceptance + 20 portal acceptance pass | [Coverage](checks/coverage-combined.log) |

The image's required offline build runs its own `check` stage. No extra standalone
`npm run check` was added. Ordinary tests register the gated self-hosted suite
without cases; the explicit 11-case container run supplies that proof. A dedicated
Members browser command loads the built portal assets and real Chromium at
390 × 844, checks the logo and fonts, uses keyboard open/Cancel/confirm, verifies
no Cancel write and one confirmed deletion, and checks horizontal bounds. The
manager inspected [the final screenshot](browser/members-remove-narrow.png).

## Commands and environment

Node 24.20.0, the pinned dependencies, and Lightpanda 1.0.0 were used. The renderer
binary SHA-256 is `955440053a84754dd64c62f970449a56a2b350cdf43ea5f2e809a73047b8173d`.
The ordinary suite used the owner's existing local environment for Axiom test
credentials. Staging used the existing Keychain launcher and a password-only
WorkOS profile with provider MFA disabled. No credential value is included here.

Dedicated gates ran their exact emitted test selections after central backend
and portal builds, avoiding concurrent resets of `dist`. The source selection
permits the nested image builds. PostgreSQL used disposable local PostgreSQL 17,
verified test TLS and the scoped runtime role. Collector used its isolated Docker
network. Self-hosted containers had no outbound access. The hosted image ran Linux
AMD64 under Colima emulation, including real CLI, TLS renderer and shutdown checks.

Production source, registry and API snapshots have identical bytes from
`69d0c9b0dcaa98722ef4faa350e2545a13c8acbd` through the final candidate. Later changes
correct old test expectations, remove two stale comments, and update documents.
The final ordinary, staging, typecheck, coverage and API checks include those
corrections. The image ran before the last three test-only corrections; its older
VCS label alone is not candidate proof. [Final source hashes](architecture/final-provenance.json)
and the build/test logs retain the tested scope. No production file changed after
the successful focused/browser, PostgreSQL, Collector or image runs.

The API emitter reports 33 diagnostics in two unlisted modules, which its contract
ignores. All 49 public snapshots verify, and the separate full typecheck passes.
GitHub reported no checks or statuses for this head at the final local inspection;
that is not a claim of a separate CI pass.

## Failure and retry history

- Acceptance began red because Members had no removal form. Route/browser cases
  and domain/Audit cases also failed before implementation. The retained
  `acceptance-red`, `focused-red` and `domain-audit-red` logs record that sequence.
  Domain/form, route/Audit and complete acceptance runs then passed.
- The first expanded acceptance run passed 27 of 29 cases. The browser driver used
  a string instead of a Playwright evaluate callback, and a read-failure assertion
  expected 503 where the existing Members boundary returns 500. Both test issues
  were corrected. The confirmed POST outcome and no-replay assertions remain.
  The rerun passed all 29; the final 168-case focus includes the real-asset browser
  proof. Earlier screenshots are historical, not the final visual evidence.
- The first complete ordinary run had five outdated invitation/grant form
  expectations. The forms now permit exactly the checked removal route while
  retaining invitation, password-only, retired-route and no-mutation assertions.
  A focused 29-case rerun passed. A subsequent ordinary run had four port-collision
  failures because the separate staging gate also used port 46443. Those suites
  were then run sequentially; the final ordinary run passed all 4,997 + 49 tests.
  No timeout or safety assertion was weakened for that collision.
- The first staging run passed 27 of 28 tests. Its remaining invitation-only form
  assertion was updated to allow only the known invitation routes and checked
  removal fields. The final 28-case rerun passed, including actual 300-second token
  expiry. Its duration is about 8.3 minutes.
- Habit-hooks found one new non-null assertion. It was replaced with an explicit
  assertion. Two inherited comments describing obsolete single-role writes were
  removed. The final hook inventory has no unresolved correction; all retained
  findings have specific reasons and the snooze file is empty.

The full failed logs remain in `checks/`. Prior diagram and review drafts remain
in `architecture/` and `review/`; final provenance and manager review supersede
working-tree pins. There is no human approval or de-escalation in this history.

## Coverage and limits

Coverage was collected on the final candidate from the already-selected unit,
integration and acceptance suites. The report records 172 source files and 1,321
processes, with verified capture identities and manifests. The capture report and
selected manifests are retained; raw V8 files remain local. No report, percentage,
source mapping or observation was edited. Coverage does not include a claim for
staging, Docker image or Chromium runtime behavior. Main-base values derived with
head coverage are estimates, not measured base coverage.

The new removal journeys use real application/server collaboration with provider
and operation-store test doubles. The fixture explicitly does not prove SQL
persistence; the separate 22-case PostgreSQL gate does. Account, other-membership,
seeded-factor preservation and invitation-only rejoin are controlled proof.
The existing staging regression does not replace S2.5-02's new scoped live removal
journey, recovery/restore drill, updated versioned notices, owner runbooks or actual
release. No production migration, deployment, customer removal, account deletion
or new paid resource was performed.

The standalone live Brave search, Axiom interface-only gate and new release gates
are not selected by this increment. Existing ordinary Axiom tests ran. Renderer
source is unchanged; its runtime fixtures still run inside the required hosted
image build. No extra suite was selected solely to test documents or tooling.

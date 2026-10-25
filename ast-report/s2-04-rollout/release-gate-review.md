# S2-04 final release-gate audit

Reviewed 2026-10-25T00:09:19.989514+00:00. This is a read-only gate-selection audit. No build,
live suite, provider operation, source mutation, commit, or PR change was made.
The ongoing image runner retains ownership of dist and portal build files.

## Hosted live selection and prerequisite audit (initial)

`docs/implementation/test-gate-policy.md:287` selects `npm run test:hosted-live`
when changed source affects hosted authentication or WorkOS organization reads
and changes and staging settings are available. This candidate changes production
signup bundle selection, rejects the prior form version, and saves different
creator Terms/Privacy versions and hashes. It also changes the shared hosted
Admin page style. The runtime-notice implementation record explicitly retains
the hosted live selection when staging is available. The earlier full live run
covers an earlier candidate, not this changed notice composition.

The existing protected launcher supplies all three required settings. A child
printed only presence/prefix/identity-match booleans: staging key prefix,
designated staging client, designated staging issuer, and Node 24 all matched.
Ambient variables are absent, but this does not mean credentials are unavailable.
The pinned Lightpanda file is executable, Playwright's expected Chromium executable
exists, OpenSSL is available, and ports 46443/46480 were bindable on both IPv4
and IPv6 loopback. `hosted-live-prerequisites.json` retains only names/booleans.
No credentials or URLs with credentials were printed. Saved provider profile and
registered URL correctness still belong to the existing gate preflight; local
presence does not establish them or a successful live run.

Queue this exact dedicated gate after the active image runner completes:

```sh
LIGHTPANDA_BIN="$PWD/.cache/lightpanda/1.0.0/lightpanda" pnpm exec node /Users/tomermayara/.config/thermus/with-workos-staging.cjs pnpm exec npm run test:hosted-live
```

It rebuilds backend and portal, so it must not run concurrently with the image
runner or other dist users. It creates and deletes only its designated Staging
fixtures. Do not substitute Production credentials, a name-pattern subset, or a
missing-credentials setup failure. Retain actual counts, all failures/retries,
and fixture cleanup. The standard Staging profile is password-only with MFA off;
preflight reads it and changes none of those settings.

This gate proves provider/composition regression behavior. Its signup cases use
marked test documents, so it does not prove approval of the final legal bytes,
public publication, or the Render Admin/Axiom journey. Those retain their separate
offline/image/manual evidence; do not repeat the native invitation matrix merely
to run this gate.

## Complete selected checks, without duplicate aggregates

`checks/results.json` records successful ordinary suite, typecheck, portal build,
hosted offline build, and self-hosted container commands. The Linux AMD64 hosted
image gate was active during the initial audit; its later pass is recorded below. The direct
Axiom record retains the dedicated real PostgreSQL 13/13 and TLS/Collector 10/10
passes. The later test setup guard and text-input selector change do not alter
SQL or sender behavior. Preserve their exact input provenance; neither a record
nor this audit is a new gate run.

The initial `checks/inputs.json` does not match the current
`members-style.ts` or strengthened service test; it still matches the final
`logging-page.ts`. Keep that map as initial-run evidence. Link the later manual
CSS check and 39-case test rerun, final coverage, and the image gate's actual
captured Docker context. Do not overwrite old provenance or infer that every
completed stage used the final two edits solely from its later completion time.

- At the initial audit, the complete hosted live command above was still missing.
  The later final run passed; see the status update below.
- The image outcome is now a pass. Finish the manager's final coverage,
  metrics/process, public-surface check, review-tier evidence, and approval for
  the actual committed candidate. No unobserved outcome is called a pass here.
- The selected hosted build already runs both local renderer files. No extra
  standalone renderer repeat is needed after that successful phase.
- No separate `npm run check`, whole interface/integration/acceptance repeat,
  System Axiom interface run, Brave live proof, or `docker compose build` is
  selected merely because this is a Slice 2 hosted release. The policy's separate
  self-hosted evaluation release section does not apply to this hosted rollout.
- Habit Hooks final log has 92 findings, exactly the original 93 minus the
  corrected test setup non-null assertion. `habit-review.md` gives every retained
  reason. Snooze remains empty. The manager's source rerun of the strengthened
  unit file passed 39/39 after a retained strip-only tooling failure.

## Actual release blockers remain separate from local suites

The current ledger already closes SQL migration, restricted LOGIN, verified
client-to-pooler TLS, local store persistence/isolation/conflict proof, Render CA
wiring and an authorized deployed empty-settings read. The local production
sender reached the existing Axiom dataset and the manager observed its marker.
The old absent-role/CA, zero-user, closed-signup, and unproved destination-canary
statements are superseded; do not reopen those holds. The ledger accurately
limits TLS to the verified client/pooler leg and limits canary capacity to the
small controlled rollout.

Remaining release work is concrete:

1. Complete final candidate checks and required current-head independent human
   approval. Prior merged-candidate approval and this agent review do not approve
   changed source or new legal bytes.
2. Obtain owner approval of the complete current Terms/Privacy/help bytes,
   versions/hashes, date, publication/runtime scope, and existing-organization
   notice/agreement handling. Current manifest SHA-256 is `9ff7e5f5fa48bad17dcf5cde7248aa226700e2b10f3eb9da26a1de42c6f90075`.
   Since architecture v2, manifest provenance now pins the final HTML-pattern
   source and records the actual local Axiom canary; Terms/Privacy/help bytes are
   unchanged. Marketing exact-document comparison remains valid, but approval
   should reference current complete-package provenance.
3. After approved publication/deployment, verify complete public and in-app
   notice presentation, current Admin disabled Save, one optional Test, Enable,
   activity-triggered snapshot load, later MCP/Admin actions and actual Axiom
   receipt. Verify deployed restart persistence, current role/tenant refusals,
   product availability, and exact owned-fixture cleanup. Current empty settings
   and local proofs do not establish these deployed writes and journey results.
4. Record the precise S1 disposition: alternate corporate-address join does not
   activate the target; revoke-race native generic error remains with verified
   ordinary-login recovery; mail delivery/password reset/controlled consumer
   exact-address checks are deferred, not passed. Current two-account password
   inventory and accepted invitation do not prove mailbox/reset UI behavior.
   Do not repeat passed active-role preservation/lifecycle cases as a broad hold.

The owner explicitly removed backup/recovery from Slice 2. No backup, retention,
custody, restore, MFA, member-removal, role-change, paid billing, new infrastructure,
or shared-database outage drill is a release prerequisite for this scope.

## Architecture source refresh

`architecture/v3/candidate-manifest.json` now pins stable source after the unit
setup guard and shared text-input CSS correction. It preserves v1/v2 review
history. Registry bytes, all 13 diagram sources, and the L3 source are unchanged;
the manager's accepted six renders remain valid. No redundant diagram review or
render is needed. Final commit/base stamping and current candidate links still
need refresh after commit; the manifest is not a committed-head approval.

## Image-context provenance clarification

The manager reports that the obsolete first Docker context loaded at 23:49:06 UTC,
after the test-oracle fix at 23:44:54 but before the sole CSS selector addition
at 23:50:20. Retain that run's actual context and result. It cannot be labeled
the final source image solely because it finishes after the CSS edit.

The policy states: “The gate must build and run the final `Dockerfile.hosted`
image for `linux/amd64`.” It also states: “A successful build alone does not pass
the runtime gate.” Applicable production gates are selected “when the changed
source affects their behavior.” These are the rules; no CSS exception is stated.

Interpretation: the initial image remains valid scoped historical evidence.
Manual CSS verification plus final ordinary/type/portal checks proves the small
UI/source increment but does not make the old-context runtime image a final-image
pass. A second gate on the final image is the strictly supported path unless an
explicit authorized user/policy exception accepts narrower evidence. Its embedded
`build:hosted` phase can provide the final hosted offline proof; a separate duplicate
host `build:hosted` is not needed for the same final inputs. The previous
self-hosted-container proof can be retained with explicit delta provenance because
the hosted account-form CSS selector does not change self-hosted behavior; that
last conclusion is a scope interpretation, not a blanket waiver. No running
command was cancelled or started by this reviewer.

## Final gate update

Runner 83077 completed on the frozen executable source. The final Linux AMD64
hosted image gate passed 7/7, exit 0, in 989.0 seconds. Its embedded hosted build
passed 3,064 backend unit, 29 portal unit, 20 portal acceptance, 1,070 integration,
119 selected acceptance/interface, and 13 renderer tests. The complete hosted
live gate then passed 28/28 in eight suites, exit 0, in 527.3 seconds. Every
reported test group had zero failures, cancellations, skips and todos. All five
final stages, including ordinary/type/portal, report no changed inputs during
their runs. The stage manifests still match current source/test/SQL files.

This replaces the pending image/live statuses in the initial audit; it does not
erase the cancelled obsolete image or earlier failed attempts. Full compatible
coverage, metrics/process/CRAP, final committed-candidate classification, approval,
and deployed release-only proof remain pending. Status-only prose corrections
do not change the frozen executable or exact legal bytes. The tested
source/docs/tests are committed as `185e372a85dc749a36a0b058151d960d0c4f71da`.
Stamp final provenance again if generated metrics history adds a commit.

## Existing internal organization: rule and scope interpretation

**Literal rule.** The notice review requires: “Verify the approved public and
in-app presentation, readable document links, Audit logs help, and recorded
agreement versions as applicable.” The v3 manifest separately says: “No automatic
replacement or new acceptance claim. Owner must select any required existing-
organization notice/agreement process before enabled export.” These rules require
actual presentation evidence and an owner-selected existing-org disposition.
Neither requires another Production organization or a new Production signup
acceptance. Sources: `docs/implementation/admin-s2-04-notice-review.md:58` and
`docs/legal/organization-audit-2026-10-24-proposal-v3/manifest.json:69`.

**Interpretation for this controlled rollout.** The existing internal Thermus AI
organization and its current Admin may be used. Approved deployed public policies,
signed-out Privacy, Admin help and readable links, exact deployed commit, final
image/composition tests, and an explicit owner disposition can satisfy this
existing-org presentation scope without creating another organization. This is
a scope interpretation, not a waiver of the literal “as applicable” requirement
or a claim that posting/signing in accepts updated Terms.

**Exact limits.** Existing-access users get Continue rather than the creator form
(`workos-signup-routes.ts:122`), and that flow records no new agreement. The v3
creator form, one unchecked checkbox, stale-form refusal and saved legal metadata
are proved by exact-bundle composition tests; the final image proves its actual
packaged Privacy presentation. The live provider gate uses explicit marked test
documents. No new Production v3 acceptance record or new-creator form submission
was exercised. Preserve the earlier WorkOS creator/agreement records. Production
public Terms/Privacy, signed-out `/signup` Privacy, current-Admin help and their
links still need actual approved-deployment/publication readback. Current-source
Admin Save/Test/Enable and MCP/Admin/Axiom delivery remain separate live proof.
Do not describe the operational internal scope as a new technical per-org feature
restriction or a completed universal Production signup test.

**Proposed bundled owner wording.** Replace package/hash/date placeholders with
the final approved identifiers, and record the human response:

> I confirm that I have authority to make this decision for the existing internal
> Thermus AI organization. I approve the complete identified v3 package, versions,
> hashes, effective date, and public/runtime publication scope. I authorize the
> controlled Audit rollout to Axiom `audit-log-test`, with the disclosed data flows
> and no settings backup. I select this recorded internal-use notice and
> authorization as the existing-organization disposition; no additional signup or
> agreement flow is required for this controlled trial. Preserve prior acceptance
> records and do not claim a new signup acceptance.

This is proposed wording, not an approval. Required current-candidate human review
and the specific S1 native/mailbox dispositions remain independent decisions.

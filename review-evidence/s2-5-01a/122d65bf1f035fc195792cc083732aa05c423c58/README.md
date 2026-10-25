# S2.5-01a review evidence

Candidate: [122d65bf1f035fc195792cc083732aa05c423c58](https://github.com/tomer-mayara/Thermus/commit/122d65bf1f035fc195792cc083732aa05c423c58).
Trusted main merge base: [9d0546b93d37e74ee9ddc7d9f7f4a66b18de0546](https://github.com/tomer-mayara/Thermus/commit/9d0546b93d37e74ee9ddc7d9f7f4a66b18de0546).
This is not a stack. The feature branch has no review-report files added to its candidate.

The final checker reports **T2 Need architect**, with no local eligibility blockers.
Overall merge status remains **blocked**: independent authorized human architect
approval of this candidate is pending. No human approval or de-escalation has
been recorded. Agent review is implementation evidence, not human approval.

## Validation

See [the result manifest](validation.json), [the final checker](checks/tier-final.json),
and [the implementation and red/green record](https://github.com/tomer-mayara/Thermus/blob/122d65bf1f035fc195792cc083732aa05c423c58/docs/implementation/admin-s2-5-01a.md).

| Check | Result | Full evidence |
| --- | --- | --- |
| `npm test` | Exit 0; 4827 backend and 49 portal cases pass. | [Log](checks/npm-test.log) |
| `npm run typecheck` | Exit 0. | [Log](checks/typecheck.log) |
| `npm run build:user-portal` | Exit 0. | [Log](checks/portal-build.log) |
| `npm run test:hosted-live` | Exit 0; 28 cases pass against WorkOS staging. | [Log](checks/hosted-live.log) |
| `npm run build:hosted` | Exit 0 inside the clean AMD64 image build, with network disabled. Its phases pass 3118, 29, 20, 1074, 119, and 13 cases. No duplicate host run. | [Full build log](checks/container-hosted-build-progress.log) |
| `npm run test:container:hosted` | Exit 0; all 7 AMD64 image cases pass. | [Log](checks/container-hosted.log) |
| `npm run test:container` | Exit 0; all 11 cases pass with outbound access denied. | [Log](checks/container-self-hosted.log) |
| API snapshot check | Exit 0; one declaration changes. | [Log](checks/api-surface-check.log), [final checker](checks/tier-final.json) |
| Source metrics | Complete report; exit 1 for retained file findings. CRAP and architecture pass. No report section failed to run. | [Process](reports/process.md), [machine report](reports/process.json) |
| CRAP | Exit 0; all 17 added or changed functions meet their goals. | [Report](reports/crap.json), [log](checks/crap-final.log) |
| `habit-hooks --branch origin/main` | Exit 1; reviewed retained findings below. Snooze remains empty. | [Log](checks/habit-hooks-final.log) |
| Tier checker | Exit 0; T2, no local blockers. It does not certify human approval. | [Report](checks/tier-final.json) |
| Manual review | Source, tests, documentation, links, contract, registry, and whitespace checked. Independent code/test review and manager signoff complete. | This record and the implementation record |

The complete candidate changes `src/`, so the trusted gate policy selects the
full ordinary suite, type check, portal build, and applicable production gates.
Hosted membership reads and changes select the hosted live and image gates.
The accounts and application paths select the self-hosted gate. The nested
hosted offline build is part of the selected real image gate; its complete
command ran successfully, including its renderer phase.

Separate search-live, logging PostgreSQL, and Audit Collector gates are N/A:
this change does not alter the search provider, SQL runtime or settings store,
Audit encoding, transport, destination policy, or export journey. No release,
deployment, schema migration, or paid resource was requested or performed.
The live gate exercises the new raw reader through existing hosted journeys.
It does not prove live use of the new deletion method. S2.5-02 retains that
scoped provider proof. Local acceptance and transport cases use the source
adapter and pinned SDK against controlled HTTP responses.

## Candidate and run history

All source, tests, dependency, and build inputs at final HEAD match implementation
commit `313f980a3ac76ec9c95d5dbc346fb9bb7699e442`. A Git diff excluding `docs/**`
is empty between those commits. The two later commits add the required base
metric record and update the implementation record only. The hosted image was
built from `543550dff9d1d88aaa69e2285678e18b74b36aed`. The final snapshots, process,
CRAP, impact declaration, and checker are pinned to final HEAD.

- Acceptance cases were written before source behavior. The first setup failure
  was a missing dependency, not a valid behavior red. The factor fixture was
  corrected to the pinned SDK method before recording the behavior red.
- Existing member characterization passed 28 cases. The new evidence/revision
  tests first had 30 passes and 9 failures, then all 39 passed. The 9 new deletion
  tests first failed on the absent method, then all passed. The first 2 acceptance
  cases failed, then passed; refusal and lost-reply cases extended the set to 4.
- Independent review found that SDK 11 defaults a missing/null wire management
  value to false. New real-wire acceptance cases produced 4 passes and 2 failures.
  A new reader test failed on its absent export. The raw reader correction made
  all 6 acceptance cases pass. A clean compiled affected run passed 246 cases.
  Independent review then found no remaining code or test issue. The manager
  reviewed the complete source and tests and accepted the correction.
- An earlier full ordinary run passed 4815 backend and 49 portal cases before
  that correction. It is **superseded** by the 4827 + 49 run. The earlier
  [log](checks/npm-test-before-wire-fix.log) is history, not final proof.
- Direct TypeScript execution of the connection test encountered the existing
  parameter-property stripping limit. The compiled test passed. This setup
  result was not used as the feature's red test.
- The first metrics install attempt lacked Go. The verified existing pinned
  `0.43.1-thermus.1` runtime was reused and checked; no global tool was installed.
- A head snapshot started concurrently with the initial metrics process rejected
  changed inputs. It published no valid snapshot. A sequential retry and the
  final head snapshot passed. [Initial diagnostic](checks/snapshot-head.log),
  [retry](checks/snapshot-head-retry.log), [final](checks/snapshot-head-final.log).
- The metrics process exits 1 because of the retained findings below. These are
  assessed findings, not a tool failure. The trusted checker permits their
  recorded disposition and returns no local blockers.
- The API declaration emitter reports 33 declaration-only type-name diagnostics:
  30 in unchanged `better-auth-runtime.ts` and 3 in unchanged
  `css-visibility-selectors.ts`. Neither file is in `public_surface`. The emitter
  explicitly excludes those diagnostics from its snapshot decision. Normal full
  type checking passes. [Diagnostics](checks/declaration-diagnostics.log).
- [Earlier PR text and comments](checks/pr-progress-history.json) and the
  [earlier checker result](checks/tier.json) retain the progress history. Their
  candidate and pending-check statements are superseded by this record.

## Coverage and metrics disposition

The complete unit backend and portal suites produced
[verified coverage](reports/coverage.json) on `313f980a3ac76ec9c95d5dbc346fb9bb7699e442`.
Final processing verifies its source and input fingerprints for final HEAD.
The runtime is Node 24.20.0 and the compiler is TypeScript 7.0.2. No coverage
report was edited. A base CRAP value derived from head coverage is an estimate,
not measured base coverage. See the full [base snapshot](reports/snapshot-base.json),
[head snapshot](reports/snapshot.json), [review](reports/review.json), and
[function results](reports/crap.json). One unmeasured function is unchanged;
no added or changed function has an unknown required assessment.

| File finding | Value | Retained reason |
| --- | --- | --- |
| WorkOS organization provider MI | 53.4834 to 48.1109; drop 5.37; retained high review finding | The adapter remains one cohesive provider boundary. New mapping, reader, and deletion functions are short and have 1–4 paths. Splitting existing invitation and member operations solely for the file score would expand this ticket and add interfaces. Added/changed functions meet the CRAP goals. |
| Hosted application composition MI | 56.2086 to 56.1691 | This file owns provider/resource setup and cleanup. The change binds one reader in the existing composition. Moving that lifecycle ownership would add unrelated change. |
| Connection integration test MI | 49.0302 to 39.1443; high review finding | The independent transport outcome and timeout cases belong with the existing real-client fixture. Their state stays isolated. A metric-driven test framework or file split would obscure that contract. Tests have no MI goal. |

There are no new production files below MI 85 and no metric exception entries.
The largest added-function CRAP is 4; the largest changed-function CRAP is 7.
The contract-only directory module has no meaningful raw function MI. All
relevant changed function rows are retained in the complete function report.

Habit-hooks findings have these dispositions; the log lists every location:

- `high-complexity` (1): unchanged `composeWorkOSApplication` owns ordered resource
  cleanup. This ticket changes the smaller provider-parts binding. Refactoring
  that lifecycle would add unrelated behavior and risk.
- `non-essential-comment` (224): retain the comments that describe authority,
  provider constraints, unknown effects, the SDK default workaround, query
  filters, and fixture isolation. Those comments state why the contract must
  hold, and preserve context that short names cannot express. The existing
  explanation comments in expanded fixtures remain with their tests.
- `oversized-file` (10): retain cohesive provider/fake/fixture and member test
  groups. The cases share a public boundary but retain independent state. A
  mechanical split to meet a line count would expand the ticket. The exact
  files are in the linked log; no boundary or correctness lint finding was
  suppressed. `.habit-hooks/snooze.json` is `[]`.

## Architecture assessment and approval

The [committed declaration](https://github.com/tomer-mayara/Thermus/blob/122d65bf1f035fc195792cc083732aa05c423c58/.pr-impact.json)
and [bound copy](reports/impact.json) set only `internalInterface` and
`sensitiveBehavior`. The generated reason is **T2: declarations changed in 1
public module**. Fact d is the changed organization-directory declaration.
The internal-interface flag is a second T2 reason; sensitive membership behavior
is also T1. No component, edge, public module, registry view, deployment, or
container is added. No decision record is requested or needed for this bounded
extension of the approved provider boundary.

The public-input/output policy answer is: the internal directory gains portable
management evidence and exact-ID deletion. Normal SDK void completion is
`applied`. Only the documented HTTP 422 and directory-managed code proves the
`unsupported` no-effect outcome. All other errors retain unknown effects and
throw unchanged. There is no browser or MCP removal API. Its caller will own
admission, current authority, serialization, and last-Admin safety in S2.5-01b.

The checker notes 48 public modules and one changed snapshot. Its three
transitively touched public modules (`administration-overviews`, `customer-roles`,
and `organization-administration`) retain their declaration text. Their current
grant checks, view filtering, and authority remain unchanged. The other two
informational notes are the provider MI drop and retained high finding; their
reasons are above. No exception, de-escalation, or undisclosed blocker is used.

All 13 Mermaid blocks were inventoried and compared byte-for-byte against the
trusted base; they are unchanged. [Inventory](checks/architecture-inventory.json).
The affected views checked were Context, hosted containers, hosted authentication,
collaboration overview, default sign-in landing, member read, and deployment.
Registry prose records the raw-reader binding and unused deletion boundary.
The owner remains the organizations directory and its WorkOS adapter in the
hosted Node server; WorkOS remains the same external provider. No L2 or deploy
change is hidden by that scope.

Before/after sources: [base registry](https://github.com/tomer-mayara/Thermus/blob/9d0546b93d37e74ee9ddc7d9f7f4a66b18de0546/architecture/components.md),
[candidate registry](https://github.com/tomer-mayara/Thermus/blob/122d65bf1f035fc195792cc083732aa05c423c58/architecture/components.md#L864),
[base contract](https://github.com/tomer-mayara/Thermus/blob/9d0546b93d37e74ee9ddc7d9f7f4a66b18de0546/src/accounts/organizations/organization-directory.ts),
[candidate contract](https://github.com/tomer-mayara/Thermus/blob/122d65bf1f035fc195792cc083732aa05c423c58/src/accounts/organizations/organization-directory.ts#L99),
[base provider](https://github.com/tomer-mayara/Thermus/blob/9d0546b93d37e74ee9ddc7d9f7f4a66b18de0546/src/accounts/providers/workos/workos-organizations.ts),
[candidate deletion](https://github.com/tomer-mayara/Thermus/blob/122d65bf1f035fc195792cc083732aa05c423c58/src/accounts/providers/workos/workos-organizations.ts#L165),
[candidate reader](https://github.com/tomer-mayara/Thermus/blob/122d65bf1f035fc195792cc083732aa05c423c58/src/accounts/providers/workos/workos-organizations.ts#L412),
and [hosted binding](https://github.com/tomer-mayara/Thermus/blob/122d65bf1f035fc195792cc083732aa05c423c58/src/app/hosted-workos-application.ts#L142).
The acceptance, unit, and transport tests in the candidate exercise these paths.
An `rg` check finds no application caller of `deleteMembership`.

The PR main summary holds the authoritative comparison: one folded declaration
diff and four behavior notes, as policy permits for fact d alone. No component
drawing is needed. The strongest changed callable contract is `deleteMembership`:
the review question is whether it changes only the exact membership, and whether
uncertain failures can become success. Its declaration, caller ownership, and
four notes answer that question. An L4 drawing adds no missing information.
Drawing generation, rendering, and normal-width inspection are N/A because no
drawing changes or is added. The manager reviewed the SDK correction, contract,
source, tests, and registry assessment; no agent finding remains open. Human
architect approval of the exact candidate is still required before merge.

# Review tiers from architecture facts

Status: approved by the owner on 2026-10-24, with decisions D1 to D11 as
recommended. The [rules file](../implementation/pr-review-rules.yaml), the
[review playbook](../implementation/pr-review-playbook.md), and the
[checker guide](../../script/pr-review/README.md) hold the active rules. This
record keeps the reasons and the measurements. The numbers are of `main` at
`b03e2d2c`, unless a section gives another revision.

This design changes the tier selection of the
[process proposal](pr-process-proposal.md) of 2026-10-21. The tier names, the
merge conditions, the human approvals, and the report layout of PR #246 stay.

## Goal and rule

The owner wants three things:

- Nobody reads a pull request that stays inside a component.
- An architect reads a pull request that changes the architecture: a
  component, a public interface, a dependency between components, a
  container, an external system, or the deployment.
- The architect sees in one glance why the pull request needs them.

The rule: **the checker detects architecture facts from the code and the rules
file. A fact selects the tier. A file path alone does not.** Quality signals
(size, maintainability index, review findings) inform the author. They do not
call a human.

## Why the earlier rules called a human for 18 of 21 pull requests

Of the 21 pull requests that merged from #213 to #236, 18 were T1 or T2. These
causes made the difference:

| Cause | Earlier rule | Effect |
| --- | --- | --- |
| `protected_paths.security` listed whole folders | 101 of 145 source files (70%) were on the list: all of `web`, `identity`, `organizations`, `providers`, `billing`, `config`, and `cli` | A CSS color change on the Members page (#236) was T1 |
| A `public_surface` touch was T1 | Any edit to one of 43 public modules, also inside a function body | #226 had 26 T1 reasons, and no declaration was compared |
| T2 had no mechanical trigger | Only the five architecture flags that the writing agent set in `.pr-impact.json` | The architect tier depended on the judgment of the agent, and nothing checked it |
| The size limits were below a normal feature | 400 production lines or 1,500 total lines was T1 | Every admin slice was T1 before any other rule applied |
| Quality signals were T1 | An MI drop of 5, a retained high finding, fewer tests, a new skip | A human decided what a gate or the author must settle |

## The tiers

### T2 Need architect

Any one of these facts selects T2. The checker establishes facts a to e and g
from the merge base and HEAD. Fact f comes from the committed declaration.

| Fact | How the checker sees it |
| --- | --- |
| a. The component set changes | `dependency_graph.components` differs between the rules of the merge base and of HEAD: an ID is added or removed, or its roots or files change |
| b. A dependency between components is added, or a type-only edge becomes runtime | `dependency_graph.allowed_edges` gains an entry, or a type-only entry becomes runtime. An edge that the rules do not list stays blocked |
| c. A module joins the public surface | `public_surface` gains a module: a file becomes a contract between components or with the outside |
| d. The declarations of a public module change | The committed declaration snapshot of the module differs between the merge base and HEAD |
| e. A view of the component registry changes | A Mermaid block in `architecture/components.md` is added, removed, or edited. A prose edit is not a fact |
| f. An architect flag | `.pr-impact.json` sets `container`, `external`, `contract`, `deployment`, `crossCutting`, `component`, or `internalInterface`. A flag can raise the tier. It cannot lower it. Flags cover what code cannot show: topology, external systems, runtime order, and authority |
| g. A decision record | A file is added under `architecture/decisions/`. The owner merges the pull request |

Consistency rule: when the checker finds a fact a to e or g and every architect
flag is `false`, the result is blocked until the declaration names the change. The
summary of the declaration is the first sentence that the architect reads, so it
must exist.

### T1 Team review

No T2 fact applies, and any one of these applies:

| Reason | Scope |
| --- | --- |
| Policy path | `AGENTS.md`, `CLAUDE.md`, `.github/**`, the rules file, the playbook, the registry workflow, `script/pr-review/**`, `script/code-quality/review/**`, `script/component-ownership.ts`, `.habit-hooks/**`, `.ast-metrics.yaml` |
| Read path | `.code-quality-exceptions.yaml`, `.ast-metrics-baseline.yaml`, `.agent/**`. The test gate policy and the metrics review guide count only when the diff removes lines from them, because a feature pull request adds its gate section (D10) |
| New third-party code | A component gains an npm package or a Node builtin (`allowed_external_imports`, `allowed_node_builtins`); `package.json` gains or loses a dependency key; `pnpm-workspace.yaml`, `patches/**`, `tsconfig*.json`, `.npmrc`, `.nvmrc`, `.gitmodules` |
| Deploy and data | `Dockerfile*`, `.dockerignore`, `compose.yaml`, `docker/**`, `migrations/**`, `.env.example` |
| Security guarantee file | The short list of the section "The security list" below (D1) |
| Client contract file | `src/index.ts` and `src/interfaces/mcp/fetch-tool-schema.ts`, the group `protected_paths.contracts` of the rules file |
| Fewer test cases than the base | Unchanged. It protects against the deletion of failing tests (D4) |
| A metric exception that the pull request uses | Unchanged. The author asks, and another person grants |
| Contract documents | `docs/reference/**`, the prose specifications of the MCP tools and limits. A prose edit cannot be told from a contract edit, so a team member decides (D9) |
| Team flags | `sensitiveBehavior`, `dependencyRisk`, `policy` |

### Stacked pull requests (D11)

A stacked pull request takes its tier from the increment against its actual
parent, and its flags describe that increment. The architecture of the parent
is reviewed with the parent. The complete candidate against main stays visible
in Validation. Merges keep the bottom-up order, so no increment lands before
its parent.

### T0 Auto merge

Everything else: changes inside a component, UI and CSS, tests, documents,
internal edits of a public module that keep its declarations identical,
version-only dependency bumps, and registry prose fixes. An authorized agent
merges after the checks pass, as the playbook already allowed.

### Blocked, at every tier

These results block merge at every tier:

- a forbidden edge; an undeclared edge, component, external import, or public
  module; a new or grown cycle
- a stale, missing, orphan, or unverified declaration snapshot
- a fact a to e or g while every architect flag is `false`
- a new skip or todo marker in a test (earlier T1, D8)
- a new production file under MI 85, or a CRAP goal miss, without an exception;
  an expired exception on a changed unit
- a non-empty habit-hooks snooze
- the `uncertain` flag, a missing impact declaration, or missing required
  metric evidence

### Informational, no tier

The report keeps these lines, and the Quality review comment records the
reasons of the author, as AGENTS.md already requires (D3):

- production and total line counts (earlier T1 above 400 / 1,500)
- an MI drop of five or more on an existing file (earlier T1)
- retained high review findings on changed files (earlier T1)
- public modules touched with identical declarations (earlier T1)
- removed edges or removed public modules
- version-only dependency bumps and lockfile-only changes

## Declaration snapshots: the public interface as a file

Each module in `public_surface` has a committed declaration file under
`docs/api-surface/`, at the path of the module, for example
`docs/api-surface/src/accounts/identity/browser-session-controls.d.ts` (D6).
The script `script/pr-review/api-surface.ts` writes the files with the installed
compiler: `tsc --declaration --emitDeclarationOnly` with
`tsconfig.api-surface.json`, over `src/` without the browser portal. The
checker:

1. regenerates the snapshots at HEAD and compares them byte for byte with the
   committed files; a difference blocks ("run api-surface");
2. reads the committed files of the merge base from git, so the base is
   trusted and needs no second compile;
3. reports each module whose snapshot differs as fact d, with the unified diff.

Measured on `main`:

| Measure | Value |
| --- | --- |
| Compiler | TypeScript 7.0.2, already installed |
| Emit time, source only | 2 to 5 seconds on a shared development Mac |
| Deterministic | yes, two runs give the same bytes |
| Snapshot size | 43 modules, 875 lines in the committed snapshots |
| Diagnostics | 33, all `TS2883`, in `better-auth-runtime.ts` and `css-visibility-selectors.ts`, which are not public modules; a diagnostic in a public module stops the tool |

Measured on PR #226 against its parent: 7 source files changed, 40 of 43
public modules kept identical declarations, and 3 changed. The diff of
`browser-session-controls` is twelve lines: `BrowserSignInCompletion` gains
`user: AuthenticatedUser`, and `returnTo` becomes optional in the completion
and in `startSignIn`. That diff is the view of the architect on the contract
change. The registry drawing adds the runtime story.

An added export of a public module is also fact d, for example one line in
`account-form.ts` in #238. Keep public modules small, or list the smaller
contract file instead of the busy one.

A compiler upgrade can reformat every snapshot. The version change alone is a
note, but each changed snapshot is fact d, so that pull request is T2. The
owner accepts the regenerated files one time. This is rare and visible.

## The security list (D1)

The list keeps as T1 the files whose behavior is a guarantee even when their
declarations do not change. It has 13 entries, 11 files and 2 folders, that
cover 33 source files. The earlier list had 28 entries that covered 101 source
files.

| Path | Guarantee |
| --- | --- |
| `src/pipelines/providers/website-fetcher/network-policy.ts` | Which destinations may be fetched |
| `src/pipelines/html-processing/prompt-injection-remover/**` | Untrusted text that reaches the model |
| `src/pipelines/html-processing/html-to-markdown/sanitize-html-document.ts` | Untrusted text that reaches the model |
| `src/pipelines/html-processing/html-input-limit.ts` | Resource limits |
| `src/pipelines/html-processing/ad-cleaner/html-depth-limit-error.ts` | Resource limits |
| `src/interfaces/mcp/identity-verifier-sdk-adapter.ts` | Token verification |
| `src/interfaces/mcp/protected-resource-endpoint.ts` | Token verification |
| `src/accounts/identity/identity-verifier.ts` | Token verification |
| `src/accounts/providers/workos/session-cookies.ts` | Cookie sealing |
| `src/accounts/providers/workos/workos-signup.ts` | One-time grant authority |
| `src/runtime/http/client-address.ts` | Trusted proxy address |
| `src/interfaces/web/account/account-form.ts` | CSRF and bounded body parsing |
| `src/runtime/config/**` | What the deployment trusts |

Everything else in `web`, `identity`, `organizations`, `billing`, `cli`, and
`app` left the list. Fact d protects their contracts. The acceptance tests and
the `sensitiveBehavior` flag protect their behavior; the writing agent must set
the flag when authorization or session behavior changes. The cost: an
authorization bug inside, for example, `workos-organizations.ts` that changes
no declaration and that no test catches merges on green. Before, a human read
that diff. The owner accepted this cost with D1.

## What the architect sees

With the report layout of PR #246, the Review block of the description starts
with the tier and a generated reason line. Then comes the **Architecture
facts** list that the checker prints, then the summary of the declaration. This
illustration uses the facts of PR #226 and adds one edge:

```markdown
## Review

**T2** — public declarations changed in identity/browser-session-controls and
workos/session-cookies; runtime edge web → organizations added.

Architecture facts (checker, candidate b72e4c64 vs parent 11e37481):
- d. declarations: src/accounts/identity/browser-session-controls.ts (+3 −2 lines, diff below)
- d. declarations: src/accounts/providers/workos/session-cookies.ts (+4 −1)
- b. dependency: web → organizations (runtime), declared in allowed_edges
- e. registry: one runtime view added (hosted default sign-in landing)

Why (from .pr-impact.json): Default sign-in opens the selected workspace only
after a current product-access check; completion now carries the trusted user ...

<details><summary>Declaration diffs</summary> ... unified diffs ... </details>

Architecture comparison: <the L3 drawing and three or four behavior notes,
required when fact a, b, c, e or a flag applies; for fact d alone the diff
and the notes are sufficient (decision D5)>
```

The architect reads the first five lines and knows why they were called. The
Validation and Quality review comments keep the evidence, as PR #246 defines.

## Effect on the last 31 pull requests

Method: the committed checker of `b03e2d2c` was replayed over the 31 pull
requests that merged since 2026-10-22 or were open on 2026-10-24 (#213, #216,
and #218 to #246). Each ran against the merge base with its actual parent: main,
or the stack parent for an open stacked pull request. For the 17 that changed
`src/`, declarations were emitted at both revisions and the public modules
compared, the same measurement as in the snapshot section. A script applied the
approved rules to the recorded facts. To evaluate the implemented rules and
checker on earlier pull requests, use `script/pr-review/replay.ts`, as the
[checker guide](../../script/pr-review/README.md) describes.

| Rule set | T0 | T1 | T2 |
| --- | ---: | ---: | ---: |
| Earlier rules, by label | 3 | 11 | 17 |
| Approved rules, with the flags that the agents set | 5 | 10 | 16 |
| Approved rules, mechanical facts only | 7 | 11 | 13 |

| PR | Earlier | Approved, with flags | Facts only | Reasons, facts only |
| --- | --- | --- | --- | --- |
| #213 Fix search failures on Brave inline question results | T1 | T0 | T0 | inside a component |
| #216 Implement T0 Auto merge, T1 Team review, and T2 Need architect | T2 | T1 | T1 | policy path; read path |
| #218 Rename connection tab to Desktop and Web Apps | T0 | T0 | T0 | inside a component |
| #219 Document the organization admin plan and implementation slices | T0 | T0 | T0 | inside a component |
| #220 S1-01: Retire grant writes and use shared account contracts | T2 | T2 | T2 | c. new public module; d. declarations (8) |
| #221 S1-02: User/Admin password access | T2 | T2 | T2 | d. declarations (4); e. registry view |
| #222 S1-03a: Create named organizations with a confirmed first Admin | T2 | T2 | T2 | b. new edge; d. declarations (2) |
| #223 S1-03b: Verify safe signup recovery and eligibility | T2 | T2 | T0 | inside a component (flags raise) |
| #224 S1-04a: Add Members and native invitation management | T2 | T2 | T2 | d. declarations (3); e. registry view |
| #225 Require manual architecture diff comments for T2 reviews | T1 | T1 | T1 | policy path |
| #226 S1-04b: Resolve trusted organization landing after sign-in | T2 | T2 | T2 | d. declarations (3); e. registry view |
| #227 Refine architecture diagram review guidance | T1 | T1 | T1 | policy path |
| #228 Capture architecture diagram review lessons | T1 | T1 | T1 | policy path |
| #229 S1-05: Add combined admin onboarding acceptance coverage | T2 | T2 | T0 | inside a component (flags raise) |
| #230 Fix ast-metrics function inventory and coverage identity | T1 | T1 | T1 | read path; build file |
| #231 Focus architecture diff comments on C4 components | T1 | T1 | T1 | policy path |
| #232 Refine optional L4 architecture comparisons | T1 | T1 | T1 | policy path |
| #233 docs: refine architecture diff report guidance | T1 | T1 | T1 | policy path |
| #234 test(auth): verify Slice 1 Staging journeys | T0 | T0 | T0 | inside a component |
| #235 Use the approved organization bundle for hosted signup | T1 | T1 | T1 | read path; deploy/data |
| #236 Distinguish invitation revoke buttons with danger colors | T1 | T0 | T0 | inside a component |
| #237 Add durable logging settings storage (S2-01a) | T2 | T2 | T2 | e. registry view |
| #238 S2-01b: Add protected Audit logs settings and atomic Save | T2 | T2 | T2 | b. new edge; c. new public module; d. declarations (1); e. registry view |
| #239 Separate system logs from customer audit logs | T2 | T2 | T2 | a. component set; b. new edge; c. new public module; d. declarations (2); e. registry view |
| #240 S2-02a: Add bounded Audit delivery and explicit System output sinks | T2 | T2 | T2 | c. new public module (2); d. declarations (2); e. registry view |
| #241 S2-02b: Test the saved Audit log destination | T2 | T2 | T2 | b. new edge; c. new public module; d. declarations (2); e. registry view |
| #242 S2-03a: Capture customer audit events without System log content | T2 | T2 | T2 | b. new edge; d. declarations (3); e. registry view |
| #243 S2-03b: Load audit destination snapshots from activity | T2 | T2 | T2 | e. registry view |
| #244 S2-03c: Deliver customer audit events with bounded retries | T2 | T2 | T2 | b. new edge; c. new public module; d. declarations (6); e. registry view |
| #245 S2-04: Verify the integrated audit journey and prepare rollout | T2 | T2 | T1 | read path (flags raise) |
| #246 docs: put PR decisions before supporting reports | T1 | T1 | T1 | policy path; read path |

Three findings:

1. **The facts find the architecture changes.** Of the 17 pull requests
   labeled T2 under the earlier rules, 13 show a fact a to e without any flag.
   The S1 and S2 programs add the `logs/audit` and `logs/system` components,
   add edges, add public modules, and change `index.ts`, the MCP tool schema,
   and about twenty declaration files. They also edit registry views. These are
   the pull requests that an architect must see. The new rules do not reduce
   them. They give the architect the facts and the declaration diff instead of
   a search.
2. **Inherited flags make verification-only pull requests T2.** #223, #229, and
   #245 change no source file or one. The agents copied the flags of the whole
   stack into each pull request, as the earlier complete-candidate rule asked.
   The increment rule (D11) returns them to T0 or T1.
3. **The broad lists produce the false T1 results.** #213 and #236 go to T0.
   #235 and #245 stay T1 only through edits of the test gate policy and a
   dockerignore file (D10). The eight policy pull requests (#216, #225, #227,
   #228, #231 to #233, #246) stay T1 by the rule of the owner. They are process
   tuning and must become rare.

Limits of the sample: the window holds two architecture programs and a burst
of process tuning. Ordinary fixes were rare, so the T0 share here is a floor.
Pull requests before the rules file (#196 to #211) cannot be replayed. All
revisions compiled against one `node_modules`, so dependency upgrades inside a
pull request did not show as declaration changes. The numbers come from the
model of the approved rules, before the implementation; a replay with the
implemented checker can differ in detail.

### Replay of the implemented checker

On 2026-10-24, `script/pr-review/replay.ts` evaluated the implemented rules and
checker over the same 31 pull requests, with each pull request's own impact
flags. It classified 23: T0 4 (#218, #219, #234, #236), T1 11, T2 8 (#220 to
#224, #226, #229, #237). The eight pull requests of the S2 audit-log stack
(#238 to #245) could not be replayed: they add the source folders
`src/logs/audit` and `src/logs/system`, which the rules under test do not list,
so the checker stops with "has no component owner", as it does for a candidate
that did not declare its component. The facts agreed with the estimate above:
#220 to #222, #224 and #226 show changed declarations, #221, #224, #226 and
#237 changed registry views, and #223 and #229 are T2 through inherited flags
alone. Pull requests older than #220 show `public_surface.snapshots` blockers,
because two listed modules did not exist yet at their revisions.

## Decisions

The owner approved each decision as recommended on 2026-10-24.

| # | Decision | Approved |
| --- | --- | --- |
| D1 | Security list: 13 guarantee entries, or keep whole folders | 13 entries. Fact d protects the contracts |
| D2 | Deploy, data, and dependency files | T1 as before; they are rare. In `package.json`, an added or removed dependency key is T1; a version-only change and a lockfile-only change are notes |
| D3 | Size, MI drop, retained high findings | Informational; the gates and the author own quality |
| D4 | Fewer test cases than the base | Keep T1; a cheap guard against the deletion of tests |
| D5 | Fact d alone (a declaration change) | The diff plus behavior notes; no drawing required |
| D6 | Declaration snapshots committed under `docs/api-surface/` | Yes; the diff shows in the Files tab and the base is trusted |
| D7 | A registry Mermaid change is a T2 fact | Yes; a changed drawing is an architecture claim |
| D8 | A new skip or todo in tests blocks instead of T1 | Yes; fix or delete the test, do not review it |
| D9 | Contract documents under `docs/reference/**` | Keep T1; a prose edit is not an architecture fact |
| D10 | Edits of the test gate policy and the metrics guide | T1 only when lines are removed; a new gate section is a note |
| D11 | Stacked pull requests | The tier comes from the increment against the actual parent; the flags describe the increment |

## Implementation and transition

The rules file holds the new sections `architecture`, `impact`, `dependencies`,
and `public_surface.snapshots`, the short security list,
`read_paths.removal_paths`, and the note outcomes of size, MI drop, and review
findings. The [checker guide](../../script/pr-review/README.md) describes the
reason keys, the report, `api-surface.ts`, and `replay.ts`. The
[playbook](../implementation/pr-review-playbook.md) gives the tier lists and
the report layout.

The rules of the merge base govern each candidate. A merge base whose rules
predate 2026-10-24 keeps the earlier outcomes for its candidate. The pull
request that implemented this design was classified under the earlier rules:
T1 Team review for its policy paths. An open pull request keeps the earlier
rules until its merge base contains the new rules.

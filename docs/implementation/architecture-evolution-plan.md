# Architecture and complexity evolution plan

Status: agreed with the owner on 2026-10-17, see "Decisions". Nothing is
implemented yet. It builds on the process of PR #154 ("Code quality review
with ast-metrics" in [AGENTS.md](../../AGENTS.md) and
[the review guide](ast-metrics-review.md)).

## Objective

For each pull request, show two things in the pull request itself: (1) how the
component structure of `src/` changed, and (2) where complexity and
maintainability moved, with the risk of untested complex code on top. Keep a
record per merge, so that the owner sees how the architecture evolves over
months and where complexity accumulates.

## What the study says

The published practice, condensed to what applies here:

1. **Judge the change, not the total.** SonarQube's "Clean as You Code" gates
   only the new code of a pull request, with few conditions, because a gate on
   the whole codebase gets ignored
   ([SonarQube docs](https://docs.sonarsource.com/sonarqube-server/10.5/user-guide/clean-as-you-code)).
   The delta gate of PR #154 already does this.
2. **Weight by where the work happens.** Tornhill's hotspots rank code by
   complexity times change frequency; CodeScene reports a "hotspot code
   health" as its main KPI, weighted by lines of code, and a study of 39
   codebases found that work in the worst code takes 124% longer and carries
   15 times more defects
   ([Code Red, Tornhill and Borg](https://arxiv.org/pdf/2203.04374);
   [CodeScene code health](https://docs.enterprise.codescene.io/versions/6.0.6/guides/technical/code-health.html)).
   ast-metrics already computes a risk score from complexity, maintainability,
   coupling, and change frequency, and a bus factor per community.
3. **Code health is a bundle of factors**, not one number: nested complexity,
   brain methods, bumpy roads, duplication, primitive obsession, developer
   congestion, knowledge loss (CodeScene lists 25+). The lesson for us: show a
   few numbers side by side, weight averages by lines of code, and never show a
   plain average of maintainability over files.
4. **Cyclomatic complexity measures testability; cognitive complexity measures
   understandability**
   ([SonarSource](https://sonarsource.com/blog/cognitive-complexity-because-testability-understandability)).
   ast-metrics gives cyclomatic only. The repository already enforces
   `complexity: 10` and `max-depth: 4` per function through ESLint in
   habit-hooks, which is the function-level fitness function. Cognitive
   complexity can come later from `eslint-plugin-sonarjs`.
5. **CRAP** (Change Risk Anti-Patterns, Savoia and Evans 2007):
   `CRAP = CC² × (1 − coverage)³ + CC` per function, threshold 30; with full
   coverage it falls to `CC`, and above `CC ≈ 30` no coverage saves it
   ([crap4py](https://pypi.org/project/crap4py/),
   [cargo-crap](https://docs.rs/cargo-crap/0.4.2/cargo_crap/)). It needs
   coverage per function. Node 24's built-in coverage gives that: with
   `--enable-source-maps`, `--test-reporter=lcov` writes `SF:src/x.ts` and
   `FN:<line>,<name>` with `FNDA` hit counts (verified on this repository on
   2026-10-17, unit suite). Joined with the per-function complexity of
   ast-metrics, CRAP per function needs no new dependency.
6. **Structure metrics**: the design structure matrix work of MacCormack,
   Rusnak, and Baldwin defines propagation cost and clustered cost
   ([paper](https://flosshub.org/184)); later work found raw propagation cost
   an inconsistent health signal and prefers pattern-aware variants. A small,
   stable set serves better: modularity, the share of dependencies that cross
   communities, the number and size of cycles, and the membership of each
   community. ast-metrics gives all four, plus the suggested cuts.
7. **Fitness functions**: automated structural checks that fail the build
   (Ford, Parsons, Kua). The repository has them for the test layout (ESLint
   rules D1 to D7 and the architecture tests); `dependency-cruiser` is the
   TypeScript tool for layer rules in `src/`, and it is optional here because
   `.ast-metrics.yaml` can forbid dependencies and `no_community_cycles` is on.
8. **Visualization**: polymetric views and CodeCity map metrics to visual
   properties consistently; the known hard part of evolution views is
   stability across snapshots (entities that move or get renamed break the
   picture) ([Lanza](https://scg.unibe.ch/assets/archive/papers/Lanz03dTSEPolymetric.pdf),
   [CodeCity](https://www.inf.unibz.it/~rrobbes/p/ICSE2011-codecity.pdf)).
   GitHub renders Mermaid in Markdown; keep a diagram under about 15 nodes and
   avoid backticks in labels, or it renders badly or not at all.
9. **History** lives outside the tool: Codacy shows per-commit deltas and
   coderadar runs analyzers over the whole history; ast-metrics stores
   nothing and offers no trend. A snapshot per merge is ours to keep.

## What ast-metrics gives today

Verified with 0.43.1 on this repository:

- Communities from the dependency graph (`get_communities`): members, hubs,
  internal, inbound, and outbound references, cohesion, exposed share, bus
  factor, history cohesion; globally modularity, cross share, cycles, typed
  findings, and ranked cut actions. `src/` has 7 communities and one cycle.
- Per file: maintainability, decision paths, lines, coupling, risk; per
  function: decision paths, maintainability, lines.
- `review --base` for the deltas of the changed files; `--compare-with` for a
  file-by-file before and after. No per-community numbers, no time series, no
  diagram export (the HTML map is drawn in the browser).
- Community identities are not stable: when code grows elsewhere, ast-metrics
  regroups and renames them (seen on 2026-10-17 when `script/` grew).

## Design

Three views, all produced by commands under `script/` with tests, and shown
in the pull request body by step 5 of the process:

1. **Architecture delta.** A Mermaid graph of the `src/` communities at the
   head, with the base state in the labels: one node per community (its
   name, files, LOC-weighted maintainability, decision paths, CRAP load), one
   edge per dependency with its reference count, cycle edges marked, nodes and
   edges that the pull request changed marked with `+` and `−`. One summary
   line: modularity, cross share, cycles, base → head. Only `src/` takes part;
   `script/` and `test/` stay out of the map.
2. **Complexity delta.** A table of the changed files: maintainability,
   decision paths, CRAP load before → after; the hotspots the pull request
   touched (risk score); the functions that the pull request added with CRAP
   at 30 or more. The review of PR #154 already gives most of the inputs.
3. **Trend.** A snapshot per merge to `main` with the global numbers and the
   numbers per community, matched to the previous snapshot by member overlap.
   The pull request shows the last ten snapshots as a table (modularity,
   cross share, cycles, CRAP load, hotspot health); a dashboard draws them.

Base state for a pull request: analyze the merge base in a temporary
`git worktree` (ast-metrics and its MCP server take about two seconds per
run), not from the stored history, so a pull request never depends on the
trend store.

Community identity: match head communities to base communities by the
Jaccard overlap of their members (0.5 or more); label a community by its hub
and its largest namespace, not by the generated name.

## Steps

Each step is one pull request that follows the AGENTS.md process, with the
acceptance test first (doubles of ast-metrics and of the lcov file, golden
Markdown and Mermaid output, and one live test with the real tool).

- **A1. Snapshot.** `script/ast-metrics-snapshot.ts` writes
  `ast-report/snapshot.json` from one analysis: global numbers, communities
  with members and references, per-file metrics, per-function decision paths.
  It is the single source for the other steps.
- **A2. Architecture delta.** `script/ast-metrics-architecture.ts --base REF`
  makes the base snapshot in a temporary worktree, matches communities, and
  prints the Markdown with the Mermaid graph and the summary line. AGENTS.md
  step 5 adds it to the pull request body when the pull request changes a
  file under `src/`.
- **A3. CRAP overlay.** `script/ast-metrics-crap.ts` runs the unit suite with
  Node's coverage (`node --test --experimental-test-coverage
  --enable-source-maps --test-reporter=lcov`), joins `FN` records with the
  functions of the snapshot by file and name (by line where names are
  anonymous), computes CRAP per function, and aggregates per file and per
  community ("CRAP load": the sum of CRAP above 30, and the count). A2 and the
  complexity delta read it. Cost: the unit suite once more per run, about two
  to three minutes on this Mac.
- **A4. Trend.** The merge of a pull request appends the snapshot of `main`
  as one JSON file under `docs/metrics/` (named by date and commit), and A2
  prints the trend table of the last ten files. The files are small (the
  global numbers and the numbers per community, not the per-file data) and
  reviewable in git. A dashboard can read them later; none is part of this
  plan.
- **A5. Optional.** Cognitive complexity per function from
  `eslint-plugin-sonarjs` as a column; `dependency-cruiser` layer rules for
  `src/` as a fitness function.

## Decisions

The owner decided on 2026-10-17:

1. The picture in the pull request is a Mermaid graph in the body: text that
   GitHub renders, diff-able, produced by the command. An image is not part
   of the process.
2. CRAP is computed per pull request: each review adds one coverage run of
   the unit suite, and the pull request shows CRAP before and after for its
   changed functions and files.
3. The trend store is JSON files under `docs/metrics/`, one per merge to
   `main`.
4. The architecture map covers `src/` only; `script/` and `test/` appear in
   the complexity delta, not on the map.

## Limits known in advance

- Coverage comes from the unit suite in process; code that only the
  acceptance tests exercise through child processes counts as uncovered
  unless `NODE_V8_COVERAGE` reaches the children. CRAP then overstates risk
  for such code; the table must say which suite produced the coverage.
- ast-metrics measures TypeScript only; a change to `.mjs` files or to
  configuration does not appear.
- A community that splits or merges between base and head appears as one
  removed and one or two added nodes; the matching by overlap labels this
  case instead of hiding it.

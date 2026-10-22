## Review tier

Tier: `T1 Team review`
Local eligibility: `eligible`
Candidate: d5b4a051c589b55338cad9b6b002817b99fa22e3
Merge base: 9127545cb49b63ab9fab9d0952190d5bb2a87021

Reasons:
- T1 Team review protected_paths.policy: docs/reference/mcp-search-tool.md
- T1 Team review protected_paths.security: src/pipelines/providers/search-engine/search-engine-brave-http.ts
- T1 Team review public_surface: docs/reference/mcp-search-tool.md
- T1 Team review ratchet.review_findings: src/pipelines/html-processing/search-results/brave-result-document.ts: Maintainability too low: got 43 (min: 85)
- T1 Team review ratchet.review_findings: src/pipelines/providers/search-engine/search-engine-brave-http.ts: Maintainability too low: got 33 (min: 85)

Evidence blockers:
- none

Questions to answer:
- protected_paths.policy: Does this change what the checks enforce, or who decides? Record the new rule and why.
- protected_paths.security: Does this change admission, trust, permissions, or what untrusted content can reach? Record the guarantee that holds after the change.
- protected_paths.contracts: Does a client, a user or an operator see a different input, output, error or default? Record the promise.

Changed paths:
- M .pr-impact.json
- A docs/metrics/2026-10-21-6adb9425.json
- A docs/metrics/2026-10-21-9127545c.json
- M docs/reference/mcp-search-tool.md
- M src/pipelines/html-processing/search-results/brave-result-document.ts
- M src/pipelines/providers/search-engine/search-engine-brave-http.ts
- M test/acceptance/mcp/search-pipeline.test.ts
- M test/acceptance/mcp/self-hosted-fetch-tool.test.ts
- M test/integration/search-pipeline/brave-markdown.test.ts
- M test/support/fixtures/search-engine/README.md
- A test/support/fixtures/search-engine/brave-results-inline-qa-expected.json
- A test/support/fixtures/search-engine/brave-results-inline-qa.html
- A test/support/fixtures/search-engine/brave-results-inline-qa.json
- M test/unit/html-cleaner-pipeline/search-results/brave-http-result-cleanup.test.ts
- M test/unit/search-engine/search-engine-brave-http.test.ts

Line counts:
- Production: 27 (limit 400)
- Total without generated files: 412 (limit 1500)

Tests:
- Added test cases: 6
- Removed test cases: 0
- Added skips or todos: none

MI:
- changed: src/pipelines/html-processing/search-results/brave-result-document.ts: 42.59975401354927 to 42.592123601221445
- changed: src/pipelines/providers/search-engine/search-engine-brave-http.ts: 34.06480213065153 to 33.048995725150206

CRAP:
- src/pipelines/providers/search-engine/search-engine-brave-http.ts: search-engine-brave-http\SearchEngineBraveHttp.isNoResults: 21.0
- src/pipelines/providers/search-engine/search-engine-brave-http.ts: search-engine-brave-http\SearchEngineBraveHttp.classify: 10.0
- src/pipelines/providers/search-engine/search-engine-brave-http.ts: search-engine-brave-http\SearchEngineBraveHttp.isWebResult: 7.0
- src/pipelines/html-processing/search-results/brave-result-document.ts: brave-result-document\BraveResultDocument.resultRow: 5.0

Metrics:
- Delta: goal miss
- Review: goal miss
- CRAP: passed
- Architecture: passed
- 60 findings on unchanged files, reason unchanged by this PR

Facts to declare:
- none

Declared facts:
- none

Surface differences:
- docs/reference/mcp-search-tool.md

Notes:
- The check does not compare declarations: compare the exported declarations of each module under "Surface differences" before and after the change, and record the result in the architecture impact.
- Local eligibility is preliminary. The manager or Delamain session must verify current local checks, holds, and required independent human approval.

Label:
`gh pr edit <n> --repo tomer-mayara/Thermus --add-label 'T1 Team review' --remove-label 'T2 Need architect' --remove-label 'T0 Auto merge'`

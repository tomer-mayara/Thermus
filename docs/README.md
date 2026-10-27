# Documentation

Completed implementation plans belong in `archive/`. Current contracts and
runtime guides stay current after implementation.

## Working guidance

- [Free subscription guide](free-subscription-guide.md): turn signup on or off, then connect, test, and disconnect Claude Code.
- [Coding principles](coding-principles.md): design and verification guidance.
- [Lightpanda runtime](lightpanda-runtime.md): runtime installation and renderer checks.
- [Test gate policy](implementation/test-gate-policy.md): suite commands, required runs before Ready, the container gate, the renderer gate, the hosted offline checks, the self-hosted release checks, and later release gates.
- [ast-metrics review guide](implementation/ast-metrics-review.md): the required complete-candidate quality review, scripts, metric goals, the architecture delta with its CRAP bands, the trend store `metrics/`, and tool limits.
- [Test code layout](testing/test-code-layout.md): the terms for the auxiliary test files, the four-layer layout of `test/support`, and the placement and dependency rules.
- [Work slices](../test/acceptance/work-slice/README.md): the manual runs of one thin path through the product, their entry points, and what each needs.
- [Container installation](../README.md#container-installation): the self-hosted evaluation image, its data volume, the stopped-server commands, backup and restore, and recovery.
- [Hosted organization setup and recovery](implementation/hosted-organization-setup.md): the operator runbook to set up a hosted organization and its Super Admin, and to revoke, replace, or recover a Super Admin in WorkOS.

## Current reference

- [MCP HTTP fetch tool](reference/mcp-fetch-tool.md): input, result, safe records, cancellation, and both production compositions.
- [User portal](user-portal.md): browser build, environment, and WorkOS application setup.
- [Website fetcher](reference/website-fetcher.md): rendering, readiness, and error behavior.
- [Fetch result URL metadata](reference/fetch-result-url-metadata.md): requested and final URLs.
- [Renderer network policy](reference/renderer-network-policy.md): destination checks and network restrictions.
- [Ad rules](reference/ad-rules.md): trusted rule input, cleaner behavior, and the server rules file (`AD_RULES_FILE`).
- [Hidden-text sanitizer](reference/hidden-text-sanitizer.md): hidden content and control sanitation.
- [HTML processing limits](reference/html-processing-limits.md): parsed element depth and failure behavior.
- [Pipeline metrics](reference/pipeline-metrics.md): removal counts, skipped work, and findings.

## Design and testing

- [Self on-boarding plan](implementation/self-onboarding-plan.md): free-tier self signup with one credential-free Render container for each tenant behind the existing origin, the `free` and `team` tiers with a 5-member free limit, the per-member Stripe upgrade through the WorkOS seat meter, the owner answers to D-1 to D-14 of 26 October 2026, and the tickets SO-00 to SO-16 in four slices.
- [PR review playbook](implementation/pr-review-playbook.md): proposal in manual trial, in which agents run the check on each pull request; the five routes, the seven deterministic checks that decide when a human reads a pull request, the [rules file](implementation/pr-review-rules.yaml) with the protected paths, the public surface, the package graph, the metric ratchet and the size limits, and the [check](../script/pr-review/README.md) that computes the route.
- [PR review change request](implementation/pr-review-change-request.md): the plan to adopt five pieces of PR #201 into the review process, one stacked pull request each, with the design decisions and the tickets.
- [MCP pipeline refinements implementation record](implementation/mcp-pipeline-refinements.md): implemented and validated naming, trusted record identity, and static result refinements in [PR #164](https://github.com/tomer-mayara/Thermus/pull/164), with functional gates, manager sign-off, and retained quality exceptions.
- [Two MCP pipelines plan](implementation/mcp-pipelines-plan.md): four slices for a neutral fetch operation, correlation IDs, outgoing observation, and incoming decisions; 01 merged in PR #155, 02 merged in PR #159, 03 merged in PR #160, and 04 is implemented and validated with manager sign-off in PR #162.
- [Two MCP pipelines plan review](implementation/mcp-pipelines-plan-review.md): the deep review, corrected logical errors, section-by-section simplifications, and design sign-off.
- [MCP-PIPE-01 implementation record](implementation/mcp-pipe-01.md): protected neutral fetch extraction at `bcae8707`, completed functional validation and VM restoration, and retained quality findings with reasons; merged in PR #155.
- [MCP-PIPE-02 implementation record](implementation/mcp-pipe-02.md): operation correlation and event-aware readers at `aa76f9f6`; functional proofs and environment restoration complete, with retained quality findings and reasons; merged in PR #159.
- [MCP-PIPE-03 implementation record](implementation/mcp-pipe-03.md): outgoing observation and a local decision executor from baseline `12160950`; all functional proofs and environment restoration complete, with manager sign-off and retained quality findings; merged in PR #160.
- [MCP-PIPE-04 implementation record](implementation/mcp-pipe-04.md): incoming processing, typed scan withholding, and fixed incoming records from baseline `190d60f7`; functional gates and environment restoration passed, with manager sign-off and explicit retained quality findings; PR #162 tracks final PR steps.
- [Hosted Docker on Render plan](implementation/render-hosted-docker-plan.md): the GitHub auto-deploy target, production identity setup, checks, recovery, and delivery slices; RHD-01 and RHD-02 implementation and verification are complete; PR #116 is stacked on PR #115, and both await owner review.
- [RHD-01 implementation record](implementation/rhd-01.md): protected hosted fetch, fixed capacity, cancellation, shutdown deadline, and verification results.
- [RHD-02 implementation record](implementation/rhd-02.md): hosted portal, local startup and health checks, MCP Origin validation, and completed verification results.
- [MCP-P01 implementation record](implementation/mcp-p01.md): delivered HTTP fetch scope and historical verification before rebase.
- [MCP-P02 implementation record](implementation/mcp-p02.md): shutdown ownership, request isolation, and its candidate verification.
- [MCP-P03 implementation record](implementation/mcp-p03.md): the self-hosted fetch tool composition, the ad rules file, the local renderer runtime, image limits, and the renderer gate.
- [MCP server implementation plan](implementation/mcp-server-plan.md): the GET-to-Markdown tool, test-only authentication, call records, verification gates, and board tickets.
- [Basic MCP URL fetch work slice](implementation/basic-mcp-url-fetch-plan.md): the development script that serves the fetch tool with the test-only mock provider, the LLM client setup, the Axiom log check, and the record of the run.
- [Auth WorkOS MCP URL fetch work slice](implementation/auth-workos-mcp-url-fetch-plan.md): the slice that serves the fetch tool behind the hosted WorkOS edition, with Google sign-in, a Connect token for Claude Code, and the Axiom log check; its decisions, its steps, and the record of the runs.
- [Authentication implementation plan](design/authentication-design.md): provider contracts, offline local accounts in one shared workspace, the hosted placeholder, hosted scope, and implementation gates.
- [Paid billing design](design/billing-design.md): the `Billing` interface, free billing until the owner chooses a payment provider, the open paid decisions, and the AUTH-11 specification.
- [Planned cache key design](design/cache-design.md): pending cache requirements.
- [ast-metrics change request](implementation/ast-metrics-change-request.md): delivery record for revision 4, with implemented coverage and architecture changes, explicit owner dispositions, deferred measured base coverage and merge workflow, and CR-21 archival.
- [Test inventory](testing/test-list.md): executed cases and pending cache tests.
- [Test code refactoring plan](implementation/test-code-refactoring-plan.md): the terms for auxiliary test files, the four-layer target layout of `test/**`, and the ordered steps that move, merge, and split them with no `src` change.

## Archive

- [Architecture and complexity evolution record](archive/architecture-evolution-plan.md): the study, original design, dated measurements, and completed T1 to T7; later CR delivery and deferred work are recorded in the change request. Current commands, decisions, and limits are in the ast-metrics review guide.
- [MCP pipelines improvement plan](archive/mcp-pipelines-improvement-plan.md): historical reviewed scope and discussion; selected refinements 01–04 are implemented and validated in [PR #164](https://github.com/tomer-mayara/Thermus/pull/164); 05 remains deferred. Includes the frozen [Martin-inspired review](archive/mcp-pipelines-review-martin.md) and [Metz-inspired review](archive/mcp-pipelines-review-metz.md).

- [Completed authentication refactoring record](archive/auth-refactoring-plan.md): two merged slices, local command role and lazy opener, auth layout, direct import checks, preserved behavior, and deferred limits.
- [Completed OO refactoring record](archive/oo-refactoring-plan.md): implementation scope, recorded verification, and deferred design decisions.

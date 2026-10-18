# Documentation

Completed implementation plans belong in `archive/`. Current contracts and
runtime guides stay current after implementation.

## Working guidance

- [Free subscription guide](free-subscription-guide.md): turn signup on or off, then connect, test, and disconnect Claude Code.
- [Coding principles](coding-principles.md): design and verification guidance.
- [Lightpanda runtime](lightpanda-runtime.md): runtime installation and renderer checks.
- [Test gate policy](implementation/test-gate-policy.md): suite commands, required runs before Ready, the container gate, the renderer gate, the hosted offline checks, the self-hosted release checks, and later release gates.
- [ast-metrics review guide](implementation/ast-metrics-review.md): the required complete-candidate quality review, scripts, metric goals, and tool limits.
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

- [Two MCP pipelines plan](implementation/mcp-pipelines-plan.md): four slices for a neutral fetch operation, correlation IDs, outgoing observation, and incoming decisions; MCP-PIPE-01 is in progress from implementation baseline `8d12c1e7`; 02–04 have not started.
- [Two MCP pipelines plan review](implementation/mcp-pipelines-plan-review.md): the deep review, corrected logical errors, section-by-section simplifications, and design sign-off.
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
- [Test inventory](testing/test-list.md): executed cases and pending cache tests.
- [Test code refactoring plan](implementation/test-code-refactoring-plan.md): the terms for auxiliary test files, the four-layer target layout of `test/**`, and the ordered steps that move, merge, and split them with no `src` change.

## Archive

- [Completed authentication refactoring record](archive/auth-refactoring-plan.md): two merged slices, local command role and lazy opener, auth layout, direct import checks, preserved behavior, and deferred limits.
- [Completed OO refactoring record](archive/oo-refactoring-plan.md): implementation scope, recorded verification, and deferred design decisions.

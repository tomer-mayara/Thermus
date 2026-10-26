# Independent stale-session recovery sign-off

Reviewed committed candidate `c8b12419a812534d93343eb24248d70de7cf828e` against `c9da79e63406e71dd15032d4ab9dfb85f2766918` on 26 October 2026. The working tree is clean. This supersedes the prior uncommitted review, retained in `static-quality/independent-review-before-commit.md`.

## Decision

No code, security, architecture, public-declaration, or material test-gap blocker found. Approve the design and implementation for continued validation as **T1 Team review**, through `sensitiveBehavior: true`. This agent sign-off does not supply required independent authorized human approval, completed source gates, or permission to deploy.

## Behavior and security

The catch is confined to automatic `WorkOSBrowserSession.refreshed`. It requires exact name `OauthException`, numeric status 400, and the pinned SDK's `error` field `organization_membership_not_found`. A match returns the existing signed-out result and exact clear-cookie effect. Unrecognized thrown errors retain their identity and propagate. Existing SDK terminal refusal results still clear the cookie; retryable failures keep it.

Explicit organization switching keeps its existing refusal semantics. Recovery selects no workspace and replays no removal. Reauthentication and current-access checks determine retained access. Roles, permissions, MFA, CSRF, cookie format, Connect-token scope, and remote-provider logout semantics stay unchanged. The fix ends only the local browser session.

## Tests and documents

The acceptance scenarios cover both `/session` and `/organizations`, 401 and cookie clearing, reauthentication, explicit retained-workspace selection, stale MCP403, durable removal receipt, and no repeated DELETE. Unit tests cover the exact error and meaningful near misses; the integration case exercises real pinned-SDK classification against the local provider fake. Existing acceptance tests cover outage cookie retention and recovery; existing integration tests cover switch refusal without cookie change. No material coverage gap was found. The manager reports 43 focused cases passed; this reviewer ran no tests.

The registry, implementation record, and impact declaration accurately separate existing terminal results, retryable outages, local-fake evidence, and later production proof. Earlier prose findings are resolved.

## Architecture and metrics

The helper stays inside the WorkOS owner and outside `public_surface`. Existing public signatures and neutral return shapes are unchanged. No new owner, cross-component edge, runtime dependency, public module, container, deployment, or architecture guarantee is introduced. A direct committed-text comparison confirms all 15 registry Mermaid blocks are identical to base. No new diagram or L4 view is needed.

Static snapshots and review are pinned to these exact commits. Review passes with zero high/medium and two retained low test-volume findings. Browser-session MI remains below 85 at 62.6167 (base 63.3184); retain the narrow lifecycle catch to avoid an unrelated security-sensitive refactor. Session-client MI remains above 85 at 91.1798. Reasons for each retained finding, changed-function path counts, commands, and the unchanged CSS dependency-evidence limit are recorded in `static-quality/summary.md` and JSON, with full snapshots/review/architecture reports alongside them.

## Remaining manager validation

Complete source-selected tests/builds/container/live gates, coverage-dependent CRAP and full process evidence, trusted candidate checker, habit-hooks, public-declaration verification, and current-head authorized human approval remain separate. No process, coverage, build, dist, source/index/config/baseline mutation, browser or cloud-account operation was performed by this reviewer. Only ignored evidence outputs were written. Public WorkOS README/quickstart were read to satisfy the skill; local pinned SDK source is the implementation evidence.

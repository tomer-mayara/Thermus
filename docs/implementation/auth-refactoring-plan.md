# Authentication refactoring plan

Status: Both implementation slices are complete and merged after owner review.
Slice 1 merged in pull request
[#56](https://github.com/3-headed-monkey/Magumagu/pull/56) as `f677c5c`.
Slice 2 merged in pull request
[#57](https://github.com/3-headed-monkey/Magumagu/pull/57) as `e44e296`.
The pull requests record the gate results and reviews.

Revision date: 2026-10-13. Reviewed baseline: `b73a7f821edac538afdd0498874dd7f28b3c1fc2`.

Slice 1 added the local command role and lazy opener. Slice 2 puts the auth files
at the layout below and separates the MCP outage endpoint and HTTP address
contract. Follow the
[coding principles](../coding-principles.md),
[repository work rules](../../AGENTS.md), and [test gate policy](test-gate-policy.md).

## Scope

Put auth contracts and implementations under one `src/auth/`. Preserve public
behavior, security checks, durable data, and resource lifetimes. Extract the
local command's current collaboration role, then relocate each file once.

Shared roles belong at the auth root; hosted contracts in `hosted-auth/`; local
commands in `local-auth/`; Better Auth details under its vendor directory. Keep
the placeholder flat. Create `hosted-auth/workos/` only when implemented.

Keep organization contracts and use cases in `organizations/`, account routes
and views in `hosted-admin/`, and billing, config, terminal, HTTP, and MCP SDK
code outside auth. Valid UI dependencies on organization use cases remain.
Defer `Pick<Concrete>` signature changes and routing or lifecycle redesign.
Add no common provider base, auth facade, command class per action, factory
framework, separate npm package, or empty future contract.

## Target layout

```text
src/
  auth/
    access-context.ts
    identity-verifier.ts
    hosted-auth/
      browser-session.ts
      unavailable-hosted-authentication.ts
    local-auth/
      local-user-administration.ts
      local-auth-command.ts
      local-auth-command-line.ts
      better-auth/
        better-auth-user-administration.ts
        better-auth-runtime.ts
        better-auth-provider.ts
        local-installation.ts
        data-directory-lock.ts
        local-auth-pages.ts
        local-auth-provider-routes.ts
        local-auth-page-form.ts
        local-auth-page-html.ts
  http/
    client-address.ts
    server.ts
  mcp/
    unavailable-mcp-endpoint.ts
    identity-verifier-sdk-adapter.ts
    mcp-server.ts
```

## Contracts and implementation decisions

Keep [access-context.ts](../../src/auth/access-context.ts) compact: identities,
grants, access decisions, `AccessResolver`, context creation, and permission checks.

The [identity-verifier.ts](../../src/auth/identity-verifier.ts) contract now lives
at the auth root. `IdentityVerifier` verifies OAuth access tokens; it is not a generic
login role. Preserve its token semantics and one canonical
`InvalidAccessTokenError` class. The SDK adapter uses `instanceof` against it;
a duplicate rejection class would change behavior. SDK translation stays in MCP.

The [BrowserSession](../../src/auth/hosted-auth/browser-session.ts) contract lives in hosted auth.
Its organization switching, MFA evidence, CSRF state, and cookie effects are
hosted concerns. Local auth need not implement it. The
[hosted placeholder](../../src/auth/hosted-auth/unavailable-hosted-authentication.ts)
uses the flat hosted directory. Its separate
[UnavailableMcpEndpoint](../../src/mcp/unavailable-mcp-endpoint.ts) belongs to MCP: this
HTTP/OAuth response returns 503 even without credentials, with no Bearer challenge.

Keep Better Auth pages, routes, forms, and HTML together. They depend on signed
`oauth_query`, provider endpoints, and error codes
([pages](../../src/auth/local-auth/better-auth/local-auth-pages.ts),
[routes](../../src/auth/local-auth/better-auth/local-auth-provider-routes.ts)).
Keep `LocalInstallation` and `data-directory-lock.ts` concrete: they own the
provider schema and SQLite storage
([installation](../../src/auth/local-auth/better-auth/local-installation.ts)).
`CLIENT_ADDRESS_HEADER` lives in [http/client-address.ts](../../src/http/client-address.ts).
The server still overwrites client copies with the socket address. These endpoint
and header moves add no interfaces.

## Local command role and opener

The [command](../../src/auth/local-auth/local-auth-command.ts) previously created
the runtime and administrator; its fixtures depended on that runtime. Slice 1
extracts this existing collaboration as `LocalUserAdministration`, without an
imagined second vendor.

`auth/local-auth/local-user-administration.ts` defines `addUser`, `listUsers`,
`resetPassword`, `disableUser`, and `registerClient`. One caller needs all five.
The small command switch remains.

The role module owns the consumer records: `LocalAccount`, `ApprovedClient`,
`RegisteredClient` (including its `resourceServerClientRegistered` output flag),
and `PasswordSource`. It reuses `LocalAuthSettings` with its existing
`Pick` of the self-hosted config for `dataDirectory`, `publicBaseUrl`, and
`mcpResourceUrl`. The [runtime](../../src/auth/local-auth/better-auth/better-auth-runtime.ts)
uses that neutral type too.
The settings shape and name stay; no duplicate record or conversion model is added.

The provider keeps `LocalAdministrationError`, `AdministrationFailure`, private
messages, and SDK error translation. The command uses `Error.message`
and `SuppressedError`; it needs no shared typed error protocol. The concrete
class is `BetterAuthUserAdministration`.

The command context requires a lazy `openAdministration`. Its `OpenAdministration`
and `OpenedLocalAdministration` types stay beside that context. It accepts the
neutral settings and returns
only `{ administration, close(): Promise<void> }`. The role itself owns no
open or close. The command receives no `BetterAuthRuntime`, `LocalAuth`,
`$context`, SQLite, or provider/client-record secrets.

`index.ts` injects an async closure that imports the concrete opener only when
invoked, after syntax, config, and edition validation. The exported
`openBetterAuthAdministration` function stays beside the concrete administrator.
It owns the runtime until it
returns successfully and releases it on pre-return failure, preserving both
opening and cleanup errors. Then the command owns closure through its existing
`AsyncDisposableStack`. The opener reuses the runtime's idempotent close.

The sequence remains: parse syntax → load config/check edition → open → invoke
the selected operation with a lazy password source where needed → write output
→ close. Do not add a universal target-validation or password stage.

| Operation | Existing timing to preserve |
| --- | --- |
| Add | Check duplicate email before password input. The provider checks invalid email after password input. |
| Reset password | Check the account and password credential before password input. |
| Register client | Check client values, then a known enabled account, before password input and sign-in. |
| List or disable | Never request a password. |

The operation owns password-callback timing. Keep the lock during input,
output-before-close, cleanup after operation or output failure, and primary plus
cleanup error/`SuppressedError` behavior. The command reads and passes transient
passwords; it never receives long-lived provider secrets or the raw runtime.

## Logical packages and dependency rules

Folder nesting does not merge these logical packages into one unit-test package.
The local-command package contains the three files directly in
`auth/local-auth/`; its `better-auth/` subtree is a separate implementation
package. Config remains a separate package. The table gives the final boundaries.

| Logical package | Final source boundary |
| --- | --- |
| Shared auth | `auth/access-context.ts`, `auth/identity-verifier.ts` |
| Local commands | The three files directly in `auth/local-auth/` |
| Better Auth implementation | `auth/local-auth/better-auth/**` |
| Hosted auth | Hosted session contract and placeholder in `auth/hosted-auth/` |
| Existing packages | MCP, HTTP, config, hosted-admin, organizations, billing, terminal, and other existing owners keep their boundaries. |

Shared auth depends on shared contracts, not provider or transport implementations.
Neutral local files may use the config public contract; they do not import provider
internals or packages. Providers implement the relevant roles and may collaborate
inside their own package. Better Auth browser adapters may use provider details.

External MCP and hosted-account consumers depend on auth contracts and use cases.
This rule is not a ban on provider-internal browser adapters. `application.ts`
and `index.ts` remain composition roots: they may name concrete types and use
edition-specific dynamic imports. Add no eager root barrel that loads providers.

Tests are classified by the packages whose behavior they execute, not imports
alone. Type-only public contract imports are allowed. Real `createRequestContext`
or canonical rejection-class collaboration across packages is integration.
Command tests that load real config remain integration even with an administration
role double. Preserve the real rejection class; add no config injection or fake
error just to retain a unit label. Change only affected test files and keep the
real provider integration and acceptance cases.

## Preparation

Record a passing characterization baseline and coverage for the invariants below.
Add passing cases where needed; do not force unchanged acceptance cases to fail.
Use BDD/TDD red-green for new contracts and guards, per the coding principles.

The slice 1 characterization baseline ran on commit `5d15746`, based on
`385fe91`. It exited with status 0: 28 tests, 28 passed, none failed, skipped,
or todo. It used this focused command:

```sh
npm run build && node --test dist/test/integration/auth/local-auth-command*.test.js dist/test/unit/auth-better-auth/better-auth-runtime.test.js dist/test/acceptance/auth/local-user-commands.test.js dist/test/acceptance/auth/local-client-registration.test.js
```

The new provider-loading acceptance case failed before production changes:
malformed `users` syntax loaded a provider module and returned status 1 instead
of usage status 2. This establishes the red step for the lazy opener. It is not
a complete-candidate gate result.

## Implementation slices

### 1. Extract the local role and lazy opener

The neutral role, consumer records, and existing settings shape are extracted.
The new role file used its final path. In this slice, command, parser, and concrete
administrator kept their original paths and the concrete class kept its original
name. Slice 2 relocates and renames them.

`index.ts` injects the required lazy opener. The command has no concrete
construction or vendor runtime dependency. Each operation keeps its input and
failure timing. Focused cases cover opening failure, opening plus cleanup failure,
operation failure, output failure, cleanup failure, and repeated close. They also
cover lazy password reads, no prompts for list/disable, and output-before-close.

Affected docs and tests are updated in this slice. The relevant gates apply
to its complete candidate.

Exit: the command uses the five-operation role and narrow opener result; its
observable operations, errors, password timing, output, and resource ownership
remain covered and passing.

### 2. Relocate once and enforce direct boundaries

Status: implemented in pull request #57, based on merged slice 1. The pull
request records gate results and owner review status.

The files use their final paths. The concrete administrator is renamed, and the
MCP outage endpoint and HTTP header have their own transport modules. Imports
and composition follow the new paths; provider pages and storage stay together.
The old source paths are removed. Command files moved once.

The existing [ESLint configuration](../../.habit-hooks/eslint.config.mjs) checks
exact shared-auth and three neutral-local file scopes, plus `src/mcp/**/*.ts`
and `src/hosted-admin/**/*.ts`. The provider subtree is outside the neutral
scope. These files cannot import the Better Auth subtree, the hosted placeholder
implementation, or installed Better Auth packages and subpaths. Shared auth also
cannot import MCP, hosted-account, or HTTP implementations, except the
client-address contract, or the installed MCP server/client SDKs. External
consumers cannot import the command or parser. Public contracts, neutral config,
organization use cases, provider-internal browser adapters, the HTTP header,
and the `application.ts` and `index.ts` composition roots remain allowed.

`no-restricted-imports` checks static and type imports and named, type, star, and
namespace re-exports. A separate `no-restricted-syntax` selector checks literal
dynamic `ImportExpression`. The
[boundary specification](../../test/acceptance/architecture/auth-boundaries.test.ts)
checks forbidden forms and allowed collaborators at these paths. These are
direct source checks; computed imports and transitive dependencies are outside
their scope. No custom plugin or dependency graph tool is added.

Complete the path and documentation audit below and run the applicable gates.

Exit: final paths and direct guards are in place; old paths and stale build output
are gone; documentation matches the new rules; the complete candidate passes
required gates and receives manager and owner review.

## Path and documentation audit

Audit static/type/literal dynamic imports, public re-exports, fixtures, support
files, and generated child-process module URLs. These specific risks need checks:

- The [lock test](../../test/unit/auth-better-auth/data-directory-lock.test.ts)
  builds a child-process module URL; check that it targets the relocated module.
- The [command integration test](../../test/integration/auth/local-auth-command.test.ts)
  has a SQL trace guard. It must match `better-auth-user-administration` without
  weakening the assertion that no command SQL edits provider tables.
- The [provider-loading acceptance test](../../test/acceptance/auth/local-command-provider-loading.test.ts)
  guards provider paths in a subprocess import hook. Check the relocated paths
  and retain its accepted-command control, which proves that
  the guard catches a provider load.

Update the README, [authentication design](../design/authentication-design.md),
[test inventory](../testing/test-list.md), and [test gate policy](test-gate-policy.md)
with each affected slice. The authentication design now places the verifier at
the auth root and keeps OAuth token semantics and SDK translation separate.
Historical archive records need not be rewritten.

Use clean builds to remove stale `dist/` paths. Source nesting needs no compiler
or Docker copy changes. Preserve SQL, schema/version, data files, migrations,
`#auth-local-migrations/*`, installation UUID/authority/tenant, URLs, commands,
and pinned provider versions.

## Preserved invariants and evidence

| Invariant | Existing evidence to retain |
| --- | --- |
| Offline discovery, sign-in, consent, PKCE, and MCP; issuer/audience/expiry checks; invalid token versus outage | [Local acceptance](../../test/acceptance/auth/self-hosted.test.ts), [provider proofs](../../test/interface/auth/better-auth.test.ts), [failure reports](../../test/acceptance/auth/mcp-failure-reports.test.ts) |
| Session revocation, disabled users, peer isolation, current grants, and trusted per-request tenant | [Local access](../../test/integration/auth/local-access.test.ts), [MCP context](../../test/integration/auth/mcp-context.test.ts), local acceptance and provider proofs |
| Private provider route allowlist, CSRF, cookie effects, MFA, and organization authority | Local acceptance/provider proofs; [hosted account](../../test/integration/auth/hosted-account.test.ts), [hosted administration](../../test/integration/auth/hosted-administration.test.ts) |
| Hosted 503 without challenge or credential; no accidental local startup | [Hosted placeholder](../../test/acceptance/auth/hosted-placeholder.test.ts), [startup](../../test/acceptance/auth/self-hosted-startup.test.ts) |
| Exclusive lock, startup cleanup, durable data, idempotent close; MCP before runtime, installation before lock | [Runtime lifecycle](../../test/unit/auth-better-auth/better-auth-runtime.test.ts), [installation integration](../../test/integration/auth/local-installation.test.ts), startup coverage |
| Password timing, safe output, resource cleanup, and secret privacy | [Command integration](../../test/integration/auth/local-auth-command.test.ts), [user commands](../../test/acceptance/auth/local-user-commands.test.ts), [client registration](../../test/acceptance/auth/local-client-registration.test.ts), focused slice 1 cases |

Retain all affected cases, not only this table's examples. Hosted doubles show
application policy and placeholder behavior; they do not prove WorkOS behavior.

## Completion gates

These instructions apply to each implementation slice. Run changed tests locally
before each commit. On each complete candidate, run `npm run check`,
`habit-hooks` with `.habit-hooks/snooze.json` as `[]`,
`npm run test:integration`, and `npm run test:acceptance`.

Run the offline proof:
`npm run build && node --test dist/test/interface/auth/better-auth.test.js`.
Run `npm run test:container` separately; normal acceptance skips its suite.
Record gate results as required by the test gate policy.

Open a draft PR first; complete candidate gates before Ready. The manager reviews
delegated work and the owner reviews the implementation. Every started Actions
job must pass. Return to Draft before a fix after Ready. Follow repository merge
rules. Record implementation and gate evidence in the pull request notes; do not
treat the saved plan as evidence of a gate pass.

## Review corrections and references

The review corrected wording that could introduce a common preflight stage and
change operation timing. The plan reuses the existing settings shape and keeps
error types unused by the command in the provider.
It narrows the UI and secret rules, states actual test packages, and checks rename
risks. Two slices and a flat placeholder reduce file churn; these are design
choices, not security defects.

Independent AI reviews were informed by Robert C. Martin's
[Clean Architecture](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
and Sandi Metz's [The Wrong Abstraction](https://sandimetz.com/blog/2016/1/20/the-wrong-abstraction)
and [What does OO afford?](https://sandimetz.com/blog/2018/21/what-does-oo-afford).
Neither author was contacted. Neither reviewed or endorsed this plan.

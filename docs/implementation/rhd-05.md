# RHD-05: first deployment and release proof

Status: initial public acceptance satisfied; full RHD-05 incomplete. Client date: 2026-10-15.
Draft [PR #119](https://github.com/tomer-mayara/Thermus/pull/119) tracks this work,
stacked on Draft [PR #118](https://github.com/tomer-mayara/Thermus/pull/118).
Both branches incorporate current `main`. The acceptance below was written before
the first deployment. The retry is live and public smoke passed 15/15.

## Manual first-deployment acceptance

**Given** checked `main`, the approved Render configuration, and the owner's
explicit deferral of public privacy/terms pages and Google publication,

**When** Render builds and deploys the exact checked revision below,

**Then** deployment status is live, and the initial public remote smoke confirms:

- `GET` and `HEAD /healthz` return `200`.
- The portal and its assets load with the required CSP.
- Protected resource and authorization metadata name the exact production MCP
  resource and issuer below.
- MCP without a token returns `401`; foreign, malformed, and opaque `null`
  Origin values return `403` before authentication.
- Protected account requests without a session cookie return `401`.
- Runtime logs show the expected listener port and no startup errors.

These initial public checks passed. The deferral does not block this deployment or
public smoke. It does not prove Google publication or any authenticated journey.
Keep auto-deploy off until authenticated remote smoke passes.

## Checked revision and review evidence

The owner authorized review and merge of PRs #115–117 and the first deployment.
The manager reviewed the code with no blockers and audited the recorded required
gate evidence. This record adds no code or tests. Retained `habit-hooks` findings
are documented in the [RHD-03 record](rhd-03.md#retained-habit-hooks-findings).
There are no Actions workflows or jobs for these changes.

| Pull request | Merge commit |
| --- | --- |
| #115 | `2d01d55da88e9034e2119a9d49a8434d487ca23f` |
| #116 | `3e054b7e5b1666e0dd0467b7a887a759e819b4d3` |
| #117 | `3736b78d18f34c0b559870b00f90bd2bab3cbe31` |

The initial revision `3736b78d18f34c0b559870b00f90bd2bab3cbe31` had whole tree
`b8a9df79fd46e1e1aabc179138c016a357b3ecb0`, exactly matching reviewed PR #117
head `c3a2734144a043b1d184f8531a59d4f2dafe41b1`.

The first intended deploy, `dep-db8pua7f3r2c73f0b3ag`, failed its build at
`2026-10-16T03:53:10Z` (October 15 client date). Unit tests passed 2533 of 2534;
the CSS selector child exceeded its unchanged 3000 ms deadline. Runtime was not
reached.

The manager reviewed and merged [PR #120](https://github.com/tomer-mayara/Thermus/pull/120).
It adds `--test-concurrency=1` for backend unit test files and updates the test
policy. Tests, deadlines, and runtime behavior are unchanged. Host
`build:hosted` passed its groups of 2534, 8, 10, 4, 424, 90, and 9 tests;
the selector checks passed 4/4. Final Linux AMD64 hosted image checks passed 8/8
on a 2 CPU / 4 GiB Rosetta runtime; self-hosted container checks passed 13/13.
Changed-file `habit-hooks` reported zero findings, with snooze `[]`. The prior
180 root findings remain retained for the RHD-03 reasons.

Current `main` is `1c2fa0440b41df534d7a077c55411e7fc4113b3f`, merging #120.
Its whole tree exactly matches tested fix head
`08c9676201bbe42996b7b58a5641810aa4e2c096`.
Retry `dep-db8qf4mq1p3s7391cm1g` started at `2026-10-16T04:26:58Z` from this
exact `main`. It became live at `2026-10-16T04:31:50.782873Z` (October 15 client
date), with that exact commit.

## Public smoke results and limits

All 15 public checks passed: health GET/HEAD `200`; portal `200` with exact CSP,
`nosniff`, and `DENY`; JavaScript/CSS `200`; anonymous MCP `401` with same-origin
protected metadata; foreign, malformed, `null`, and path-bearing Origin `403`
before authentication; valid same-origin MCP `401`; exact resource and production
issuer; AuthKit metadata `200` with CIMD, S256, and no DCR endpoint; account
without a session cookie `401`; and login `303` to `api.workos.com` with the
matching production client and callback. The temporary probe first expected
`302`; the existing application contract is `303`. Correcting that probe yielded
15/15 without an application change.

The browser showed Welcome and Sign in, with no console errors or warnings.
Safe results are `/tmp/thermus-rhd05/public-smoke-results.json` and
`/tmp/thermus-rhd05/public-smoke.log`; the screenshot is
`/tmp/thermus-rhd05/portal-live.jpg`.

The listener logged `http://0.0.0.0:8080` at `04:31:47Z`; Render reports open port
8080 and one `1c-2g` instance. The unpaginated error query for
`04:31:40–04:34:05Z` returned zero errors. One memory sample was 110174210 bytes;
there was no CPU data. These samples do not prove capacity or authenticated
WorkOS API-key use. Auto-deploy remains `no`, trigger `off`, and previews off.

Both Colima and Lima configurations were restored exactly to their originals:
4 CPU / 4 GiB, QEMU, no Rosetta. Scoped gates left no owned containers.

## Approved target

Reuse Render `Thermus`, service `srv-db8mnqg473hc739d529g`, in Thermus AI workspace
`tea-db8i6ceq1p3s73dev9og`. The origin is `https://thermus.onrender.com`;
the MCP resource is `https://thermus.onrender.com/mcp` and production issuer is
`https://spontaneous-mountain-26.authkit.app`.

The service uses Oregon, one `1c-2g` instance at $25/month plus usage, Docker,
`main`, context `.`, `Dockerfile.hosted`, and `/healthz`. Auto-deploy and previews
are off. The canonical repository is `https://github.com/tomer-mayara/Thermus`.
The [RHD-04 record](rhd-04.md) gives saved runtime and identity settings,
their read-back limits, and the two earlier failed setup attempts.

## Remaining release work

After the first deployment, complete provider verification of the initial
identities and explicit RHD-04 User grants before protected product/MCP success
checks. Ungranted access stays denied. RHD-04 remains incomplete until its grants
and read-backs pass.

Full RHD-05 still needs live API credential use, Google publication and browser journeys, native CIMD
registration/login/refresh, real fetch and denial/revocation checks, capacity
measurement, cookie continuity, On Commit proof, rollback, and restoration.
The native client configuration is ready; live proofs have not run. Public policy
pages remain owner-deferred. No release or complete RHD-05 pass is recorded.

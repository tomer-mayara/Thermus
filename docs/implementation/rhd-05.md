# RHD-05: first deployment and release proof

Status: initial specification; acceptance unsatisfied. Date: 2026-10-15.
This record precedes the first intended deployment. It will be in a draft pull
request stacked on Draft [PR #118](https://github.com/3-headed-monkey/Thermus/pull/118).
No first deployment has started. The current remote `/healthz` returns `502`;
there is no live deployment.

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

These checks are pending. The deferral does not block this initial deployment or
public smoke. It does not prove Google publication or any authenticated journey.
Keep auto-deploy off until authenticated remote smoke passes.

## Checked revision and review evidence

The owner authorized review and merge of PRs #115–117 and the first deployment.
The manager reviewed the code with no blockers and audited the recorded required
gate evidence. No new code or tests were added. Retained `habit-hooks` findings
are documented in the [RHD-03 record](rhd-03.md#retained-habit-hooks-findings).
There are no Actions workflows or jobs for these changes.

| Pull request | Merge commit |
| --- | --- |
| #115 | `2d01d55da88e9034e2119a9d49a8434d487ca23f` |
| #116 | `3e054b7e5b1666e0dd0467b7a887a759e819b4d3` |
| #117 | `3736b78d18f34c0b559870b00f90bd2bab3cbe31` |

Deploy `main` commit `3736b78d18f34c0b559870b00f90bd2bab3cbe31`.
Its whole tree is `b8a9df79fd46e1e1aabc179138c016a357b3ecb0`, exactly matching
reviewed PR #117 head `c3a2734144a043b1d184f8531a59d4f2dafe41b1`.

## Approved target

Reuse Render `Thermus`, service `srv-db8mnqg473hc739d529g`, in Thermus AI workspace
`tea-db8i6ceq1p3s73dev9og`. The origin is `https://thermus.onrender.com`;
the MCP resource is `https://thermus.onrender.com/mcp` and production issuer is
`https://spontaneous-mountain-26.authkit.app`.

The service uses Oregon, one `1c-2g` instance at $25/month plus usage, Docker,
`main`, context `.`, `Dockerfile.hosted`, and `/healthz`. Auto-deploy and previews
are off. The [RHD-04 record](rhd-04.md) gives saved runtime and identity settings,
their read-back limits, and the two earlier failed setup attempts.

## Remaining release work

After the first deployment, complete provider verification of the initial
identities and explicit RHD-04 User grants before protected product/MCP success
checks. Ungranted access stays denied. RHD-04 remains incomplete until its grants
and read-backs pass.

Full RHD-05 also needs Google publication and browser journeys, native CIMD
registration/login/refresh, real fetch and denial/revocation checks, capacity
measurement, cookie continuity, On Commit proof, rollback, and restoration.
The native client configuration is ready; live proofs have not run. Public policy
pages remain owner-deferred. No release or complete RHD-05 pass is recorded.

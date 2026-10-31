# Self on-boarding Slice 2 release record (SO-12)

Date: 31 October 2026 (UTC). Ticket SO-12 of the
[self on-boarding plan](self-onboarding-plan.md#slice-2-free-tier-end-to-end),
board ticket `5f858d`. This record releases the free tier. It follows the model
of the [Slice 2.5 release checkpoint](admin-s2-5-production-release.md).

The release has three parts:

- Part A: this record, the marketing pull request, and the free-tier guides.
  Part A changes no Render service, WorkOS object, Supabase project, GitHub
  secret, or GitHub environment, and it deploys and publishes nothing.
- Part B: the rehearsal of [section 3](#3-rehearsal), in WorkOS Staging and the
  Render workspace Thermus AI, never on the production service.
- Part C: the production order of [section 4](#4-production-order). Each step
  starts only after the owner's go-ahead, and the [record](#7-record) has the
  result of each step before the next step starts.

This record holds no secret. It names each secret by its variable and by the
place where it lives. Do not write a key, a token, a password, or a private
key into this record, a pull request, a ticket, a chat, or a log.

## 1. Scope and candidate

### 1.1 What the release contains

Every code ticket of Slice 2 is merged:
SO-02 ([#282](https://github.com/tomer-mayara/Thermus/pull/282)),
SO-03 ([#280](https://github.com/tomer-mayara/Thermus/pull/280)),
SO-04 ([#279](https://github.com/tomer-mayara/Thermus/pull/279)),
SO-05 ([#285](https://github.com/tomer-mayara/Thermus/pull/285)),
SO-06 ([#283](https://github.com/tomer-mayara/Thermus/pull/283)),
SO-07 ([#293](https://github.com/tomer-mayara/Thermus/pull/293)),
SO-08 ([#284](https://github.com/tomer-mayara/Thermus/pull/284)),
SO-09 ([#288](https://github.com/tomer-mayara/Thermus/pull/288)),
SO-10 ([#295](https://github.com/tomer-mayara/Thermus/pull/295)),
SO-11 ([#286](https://github.com/tomer-mayara/Thermus/pull/286)), and
SO-11a ([#287](https://github.com/tomer-mayara/Thermus/pull/287)).
The tier rules are in [plan section 4.4](self-onboarding-plan.md#44-tier-rules):
5 seats, a container of its own on `0.5c-512mb`, 5 tool calls at a time
(D-15), and a pause after 14 days without use (D-6).

### 1.2 Release candidate

| Item | Value |
| --- | --- |
| Commit | main `fa787be415c2d4afd23745dd2840a4ea3357cc6a` (SO-10, #295) |
| Image | `ghcr.io/tomer-mayara/thermus-hosted@sha256:8025ae1b37b10575f80e5df415f7723f79f58822ce88f3d6d85bd705f63084d9` |
| Run | [41232469232](https://github.com/tomer-mayara/Thermus/actions/runs/41232469232), push on `main`, 19:04:39 to 19:12:38 UTC on 31 October 2026 |
| Checks in the image build | `npm run build:hosted` under `--network=none`: 3,962 backend unit, 59 portal unit, 28 portal acceptance, 1,260 integration, 222 selected acceptance and interface, and 13 renderer tests passed, with no failure, cancellation, skip, or todo |
| Hosted image gate | `npm run test:container:hosted` on the native AMD64 runner: 7 of 7 passed |
| Size and times | 155,608,246 bytes (148.4 MiB) compressed, 16 layers, `linux/amd64`; build 360 s, gate 15 s, push 14 s |

The pushed digest is on the line `<commit>: digest: sha256:... size: 3667` of
the record step of the job log. The line `Digest: sha256:...` of the same log
belongs to an image that the job pulls, and it is not an image of Thermus.

The previous run on main, [41226665538](https://github.com/tomer-mayara/Thermus/actions/runs/41226665538)
(commit `a0c077db`, SO-07), pushed
`sha256:fd8d747ed68393587b029bb88efd75f716384b5db439199f1babfe41cc6e5efa`.
The rehearsal uses it for the fleet upgrade. Its tenant role is the same as in
the candidate: `git diff a0c077db fa787be4` shows no change in
`src/app/tenant-*.ts`, `src/accounts/identity/`, the tenant settings, or the
audit relay sink.

### 1.3 Production state on 31 October 2026

The manager read these facts on 31 October 2026:

- The production service `srv-db8mnqg473hc739d529g` ("Thermus") is a web
  service on `1c-2g` in Oregon. It builds from Git (runtime `docker`, with
  `Dockerfile.hosted`), with `autoDeploy: no`. It runs commit `b0723a0a`
  ([#292](https://github.com/tomer-mayara/Thermus/pull/292)), deploy
  `dep-dbh91hmc6qcc73endk40`, live since 29 October 2026 00:21 UTC. Main is 9
  commits ahead of production.
- Its variables are `DATABASE_CA_CERT_PATH`, `DATABASE_URL`, `DEPLOYMENT`,
  `LOGGING_DESTINATION_ENCRYPTION_KEY`, `OPERATION_CAPACITY` (1 since
  26 October 2026), `PORT`, `PUBLIC_BASE_URL`, `SELF_SERVE_SIGNUP_ENABLED`,
  `WORKOS_API_KEY`, `WORKOS_AUTHKIT_ISSUER`, `WORKOS_CLIENT_ID`,
  `WORKOS_COOKIE_PASSWORD`, `WORKOS_MFA_POLICY`, and `WORKOS_REDIRECT_URI`.
  There is no `RENDER_API_KEY`, no gateway key, no `MCP_TENANTS_ENABLED`, and
  no system log export variable. The code no longer reads
  `WORKOS_MFA_POLICY`.
- The workspace Thermus AI (`tea-db8i6ceq1p3s73dev9og`) holds only that
  service. It has no `thermus-spike-*` service and no Render PostgreSQL. The
  registry credential `ghcr-thermus-hosted-read` (`rgc-dbg1h0142hec73da9ra0`)
  exists.
- GitHub has the repository secret `RENDER_API_KEY`, the release key of a
  dedicated Render user. The only GitHub environment is `copilot`, and the
  deploy job of [`hosted-image.yml`](../../.github/workflows/hosted-image.yml)
  names no environment.

There is no image of the production commit `b0723a0a`: its run
[40793133570](https://github.com/tomer-mayara/Thermus/actions/runs/40793133570)
did not start. GitHub says: "The job was not started because recent account
payments have failed or your spending limit needs to be increased." All ten
push runs on main from `89e79754` (27 October 23:07 UTC) to `81e8f2df`
(29 October 02:53 UTC) failed; the three runs that the worker read show the
same message. The repository has been public since 31 October 2026, and the
later runs passed. A manual dispatch on main then built `81e8f2df` in run
[41149413480](https://github.com/tomer-mayara/Thermus/actions/runs/41149413480)
(31 October 00:18 to 00:25 UTC) and pushed
`sha256:bbee3f8951ea2f93835b8beb671f85d6bf3b7a8aea91598fb511dc9504c9e40f`.
`81e8f2df` differs from `b0723a0a` only in `CLAUDE.md`, which the runtime
image does not hold. So this digest has the code of production today, and it is
the rollback image of [section 5](#5-rollback). Keep it in GHCR until the
release is complete ([runbook 5.5](tenant-fleet-runbooks.md#55-monthly-ghcr-pruning)).

### 1.4 Application checks of the candidate (part B)

Part B runs these checks on a clean checkout of `fa787be4` before the
rehearsal. They follow the ticket and the
[test gate policy](test-gate-policy.md#production-gates-for-source-changes).

The manager ran the full set on 31 October 2026 on `3050d706`, the head of
[#295](https://github.com/tomer-mayara/Thermus/pull/295) that the squash merge
made into `fa787be4`: the
[manager verification](https://github.com/tomer-mayara/Thermus/pull/295#issuecomment-6547815686) and the
[Validation comment](https://github.com/tomer-mayara/Thermus/pull/295#issuecomment-6541269914) of #295. Part B checked the tree identity:
`git rev-parse 3050d706^{tree}` and `git rev-parse fa787be4^{tree}` both give
`081f5311b622a67dd33136aae9221b1599006798`. So that run is the run of the
candidate, and part B did not repeat it. Part B ran only the Render interface
gate, before step R1.

| Check | Note | Result (UTC) |
| --- | --- | --- |
| `npm test`, `npm run typecheck`, `npm run build:user-portal` | The ordinary suite and the build checks. | Passed, manager round, 18:36:51 to 18:43:29: `npm run typecheck`; `npm test` 6,037 of 6,037 and portal 87 of 87, with 0 fail, cancelled, skipped, or todo. `npm run build:user-portal` ran in `npm run check` of `npm run build:hosted`. |
| `npm run test:container` | The self-hosted container gate. | Passed, manager round, 18:43:29 to 18:44:57: 11 of 11. |
| `npm run build:hosted`, `npm run test:container:hosted` | Native AMD64. | Passed in run 41232469232: see [1.2](#12-release-candidate). The manager round also ran `npm run build:hosted` on the Mac, 18:44:57 to 18:47:24: unit 3,962, portal 59 and 28, integration 1,260, selection 222, renderer 13. |
| `npm run test:hosted-live` | Through the WorkOS Staging launcher, with `LIGHTPANDA_BIN` of the pinned renderer. Never during the rehearsal ([3.2](#32-rules-of-the-rehearsal)). | Passed, manager round, 18:49:42 to 19:01:29: 30 of 30 in 9 suites, 704 s. Part B did not run it. |
| `npm run test:logging:postgres` | Includes the runtime files of SO-04 to SO-10. | Passed, manager round, 18:47:38 to 18:49:42: 60 of 60. |
| `npm run test:logging:collector` | The test gate policy asks for it for the Slice 2 release. | Passed, manager round, 18:47:24 to 18:47:38: 10 of 10. |
| `npm run test:interface:render` | The live interface command of SO-06. It makes real Render writes, and its preflight refuses to start while a `thermus-spike-*` service exists. Run it before step R1 or after the cleanup. | Passed, part B, 20:26:45 to 20:29:21: 1 of 1, as `npm run build` and then `node --env-file=<main checkout>/.env.local --test dist/test/interface/render/render-tenant-platform.live.js`. Two creates answered `201` after 2.6 and 2.8 s; the deploys were `live` 71.2 and 79.4 s after the create calls; the slugs were `thermus-spike-tenant-org` and `thermus-spike-tenant-org-5efd`; the deletes took 0.5 and 0.9 s. |

## 2. Before production

| Item | State | Evidence |
| --- | --- | --- |
| Deployment proof of the approved removal bundle | Complete. Deployment `57c99e2b` was live at 19:05:56 UTC on 26 October 2026, with the removal, receipt, and audit proofs; the comment says "Slice 2.5 production scope is complete". Production has run `b0723a0a` since 29 October 2026. | [PR #260 Validation](https://github.com/tomer-mayara/Thermus/pull/260#issuecomment-6421162914); the [Slice 2.5 checkpoint](admin-s2-5-production-release.md#update-of-31-october-2026) links it. |
| Marketing **Start free** link | Draft pull request. It stays open until step 9 of the production order. A merge to `main` of that repository publishes `thermus.ai`. | [Thermus-Marketing #37](https://github.com/tomer-mayara/Thermus-Marketing/pull/37), head `edd5a9d` |
| Free-tier guides | The [free subscription guide](../free-subscription-guide.md), the [README](../../README.md#hosted-edition), and the [user portal guide](../user-portal.md#public-entry) name the link `https://app.thermus.ai/signup?tier=free`, the setup state, the pause, and the restart. | [PR #300](https://github.com/tomer-mayara/Thermus/pull/300), the Thermus pull request of part A |

Legal and marketing follow the existing document process (D-11). The marketing
pull request changes no legal page. The approved Terms of Service already say
that hosted early access is free, with no payment card.

## 3. Rehearsal

### 3.1 Inputs for part B

| Input | State |
| --- | --- |
| Staging database | Done on 31 October 2026: see [3.3](#33-resources). |
| CA certificate of the staging database | The manager gives part B the path of the PEM file. It is outside the repository. Done: part B checked the SHA-256 fingerprint of the file against [3.3](#33-resources), and its database reads verified TLS with it. |
| WorkOS Staging redirect URI of the staging control plane | Open. The owner adds `https://<public host>/callback` in the WorkOS dashboard when part B gives the public host (step R3). The first run of 31 October 2026 got the host `thermus-spike-control.onrender.com` and stopped at R1, before R3. |
| Render key of the staging control plane | The fleet key: `RENDER_API_KEY` in `/Users/tomermayara/git/Thermus/.env.local` (owner decision of 31 October 2026). |
| Axiom token of the staging system log | `AXIOM_API_KEY` in the same file, which the OTel logger tests use to ingest into `system-log-test`. If the owner wants a token for `system-log-test` only, the owner adds it to the same file under a new name. |
| A time window | The owner confirms that no hosted live gate, work slice, probe, or Render interface gate runs during the rehearsal ([3.2](#32-rules-of-the-rehearsal)). Done on 31 October 2026: the owner wrote "Yes. No hosted live gate, work slice, or probe runs until the rehearsal ends." |

### 3.2 Rules of the rehearsal

- **Where.** WorkOS Staging (`environment_01M4VDKATD5PXZT4H01EHCMR2A`), only
  through `node ~/.config/thermus/with-workos-staging.cjs <command>`. The Render
  workspace Thermus AI (`tea-db8i6ceq1p3s73dev9og`), region `oregon`. Never the
  production service `srv-db8mnqg473hc739d529g`, and never the workspace My
  Workspace (`tea-d3mlbrvdiees73ca4rdg`).
- **Render key.** The staging control plane uses the fleet key, the API key of
  the owner's Render user (owner decision of 31 October 2026). So the rehearsal
  shares the rate-limit bucket of the fleet script, the probes, and the Render
  interface gate. That bucket allows 20 creates an hour for the user, and 10
  updates, deploys, suspends, and resumes a minute for each service
  ([SO-01c](self-onboarding-s1.md#findings-for-slice-2)). The rehearsal makes
  3 creates: the staging control plane and two tenants. The dedicated Render
  user of the control plane stays a production step before step 6
  ([section 6](#6-owner-steps-outstanding)). Load each key with
  `node --env-file=/Users/tomermayara/git/Thermus/.env.local`. Print the names
  and lengths of variables only.
- **Names.** The staging control plane is `thermus-spike-control`. Its tenants
  get `TENANT_NAME_PREFIX=thermus-spike-tenant-`, so the fleet script and the
  [orphan runbook](tenant-fleet-runbooks.md#2-orphaned-render-service) tell
  them apart from production tenants. Each WorkOS object of the rehearsal has
  the run ID, the start time in UTC such as `20261101-1530`, in its name or
  email address.
- **No overlap with the hosted live gate.** The gate and the rehearsal use the
  same WorkOS Staging environment and the same API key. At its start, the gate
  deletes each organization and Connect application whose name starts with
  `Thermus live `, each user whose email starts with `thermus-live-`, and the
  personal organizations of those users
  ([`fixture-registry.ts`](../../test/support/hosted-live/fixture-registry.ts)).
  Rehearsal objects that the helpers of `test/support/hosted-live/` make have
  these prefixes. The gate also owns the default redirect URI, the default
  sign-out URI, the initiate-login URI, and the OAuth resource
  `https://localhost:24443/mcp`, and its Connect client listens on
  `127.0.0.1:24480` ([test gate policy](test-gate-policy.md#hosted-live-gate-auth-06),
  [SO-01e limits](self-onboarding-s1.md#limits-1)). So never run the gate, or
  the work slice on port 24443, during the rehearsal.
- **No overlap with Render probes.** The probes and the Render interface gate
  refuse to start while a `thermus-spike-*` service exists, and they share the
  bucket of the fleet key.
- **Sign-in.** The initiate-login URI and the default sign-out URI stay with the
  gate (answer 2 of 27 October 2026). So each rehearsal sign-in starts at the
  staging control plane. The rehearsal does not cover the initiate-login entry
  or invitation links, and a sign-out from the staging control plane ends at
  `https://localhost:24443/`, which does not load.
- **Failures.** Stop at the first failed check. Then do the
  [cleanup](#36-cleanup), also after a failure, and record the failure.

### 3.3 Resources

| Resource | Name or ID | Made by | Settings from |
| --- | --- | --- | --- |
| Staging database | Supabase project `thermus-staging-rehearsal`, reference `kgiidcbufczoyifzxvtf`, organization "Thermus", region `us-west-1`, PostgreSQL 17.11, 0 USD a month, made at about 19:40 UTC on 31 October 2026 | The manager and the owner | The four files of [`sql/migrations/`](../../sql/migrations/) are applied in order with the Supabase migration mechanism: `logging_destination_settings`, `add_logging_axiom_dataset`, `membership_removal_operations`, and `tenant_registry_and_billing`. The runtime role `thermus_logging` has LOGIN; the role set its own password from a local script. The five tables exist and are empty, and the runtime role cannot DELETE. |
| Runtime connection | `STAGING_DATABASE_URL` in `.env.local`: the session pooler `aws-0-us-west-1.pooler.supabase.com:5432`, the user `thermus_logging.kgiidcbufczoyifzxvtf`, the database `postgres`, no query parameter | The manager | The [connection pattern of S2-01a](admin-s2-01a-database-setup.md#initial-credentials-and-configuration). `STAGING_DATABASE_ADMIN_URL` holds a placeholder: only the owner can set the database password in the dashboard, and the rehearsal does not need it. |
| CA certificate | "Supabase Root 2021 CA", SHA-256 fingerprint `80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA`, valid to 26 April 2031 | The manager took it from the TLS chain of the pooler, and the chain verifies with it | A Render secret file `supabase-ca.crt` of the staging control plane, so `DATABASE_CA_CERT_PATH=/etc/secrets/supabase-ca.crt`, as production does. Before any production use, the owner compares the fingerprint with the official download in the Supabase dashboard. |
| Staging control plane | Render web service `thermus-spike-control`, Thermus AI, `oregon`, plan `0.5c-512mb`, health check `/healthz` | Part B, with the fleet key | First a Git build of `main` with `Dockerfile.hosted`, as production builds today; then the image of the candidate. Variables: [3.4](#34-variables-of-the-staging-control-plane). |
| Tenants | Render private services `thermus-spike-tenant-org-…`, plan `0.5c-512mb`, image of the candidate | The provisioner of the staging control plane | The seven variables of [`tenant-environment.ts`](../../src/tenancy/tenants/tenant-environment.ts): `THERMUS_ROLE`, `TENANT_ORGANIZATION_ID`, `PUBLIC_BASE_URL`, `WORKOS_AUTHKIT_ISSUER`, `GATEWAY_PUBLIC_KEY`, `CONTROL_PLANE_INTERNAL_URL`, and `OPERATION_CAPACITY=5`. |
| WorkOS redirect URI | `https://<public host>/callback`, not the default | The owner, in the WorkOS dashboard | No public API adds a redirect URI ([plan section 3.3](self-onboarding-plan.md#33-workos)). The WorkOS connector of the owner can add it with `setAuthkitApplicationRedirectUris`; that operation replaces the whole list, so it must carry each existing entry by its ID. |
| WorkOS OAuth resource | `https://<public host>/mcp`, not the default | Part B, through the launcher | The additive public API `POST /user_management/authkit_oauth_resources`, as [`oauth-resource.ts`](../../script/spike/capacity-probe/oauth-resource.ts) of the SO-01e probe does. A delete by ID also removes its consents. |
| WorkOS organization A | An existing organization with an Admin user, made through the API | Part B, through the launcher | It stands for an organization that exists before the release (step 7). |
| WorkOS organization B | The organization of the signup of step R9, with its user | Part B, through the signup page | It stands for the canary signup (step 8). |
| Connect application | One OAuth client of the rehearsal, with its own loopback callback | Part B, through the launcher | It gets Connect tokens for the resource of the staging control plane. A Connect token lasts 300 s ([SO-01e findings](self-onboarding-s1.md#findings)). |
| System log | The Axiom dataset `system-log-test` | Exists | The staging control plane exports its system log there (SO-11a). |
| Deploy dispatches | Runs of [`hosted-image.yml`](../../.github/workflows/hosted-image.yml) on `main` | Part B | The release key of the repository secret. The deploy job accepts each web service of Thermus AI that runs an image of `ghcr.io/tomer-mayara/thermus-hosted` ([Hosted release](../../README.md#hosted-release)). |

### 3.4 Variables of the staging control plane

The list is the complete list of the hosted control plane
([plan section 4.1](self-onboarding-plan.md#41-one-image-two-roles),
[`.env.example`](../../.env.example),
[`mcp-tenants-config.ts`](../../src/runtime/config/mcp-tenants-config.ts)).
`Dockerfile.hosted` sets `NODE_ENV`, `AD_RULES_FILE`, `LIGHTPANDA_BIN`,
`LIGHTPANDA_DISABLE_TELEMETRY`, `LISTEN_HOST`, and `LISTEN_PORT=8080`. The
create script makes each new secret in memory and never prints it.

| Variable | Value or source | From step |
| --- | --- | --- |
| `DEPLOYMENT` | `hosted`, as production | R1 |
| `PORT` | `8080`, the port of the server in the image; production has the variable too, so read its value in the dashboard first | R1 |
| `PUBLIC_BASE_URL` | `https://<public host>/`, from the answer of the create call | R1, R2 |
| `WORKOS_API_KEY` (secret), `WORKOS_CLIENT_ID`, `WORKOS_AUTHKIT_ISSUER` | From the WorkOS Staging launcher | R1 |
| `WORKOS_REDIRECT_URI` | `https://<public host>/callback` | R1, R2 |
| `WORKOS_COOKIE_PASSWORD` (secret) | A new random value of at least 32 characters | R1 |
| `DATABASE_URL` (secret) | `STAGING_DATABASE_URL` of `.env.local` | R1 |
| `LOGGING_DESTINATION_ENCRYPTION_KEY` (secret) | A new random value of 32 bytes in canonical base64 | R1 |
| `DATABASE_CA_CERT_PATH` | `/etc/secrets/supabase-ca.crt`, the secret file of [3.3](#33-resources) | R1 |
| `OPERATION_CAPACITY` | `1`, as production | R1 |
| `SELF_SERVE_SIGNUP_ENABLED` | `false`; `true` from step R9; `false` again at step R14 | R1 |
| `MCP_TENANTS_ENABLED` | `true` at step R7; `false` at step R14 | R7 |
| `GATEWAY_SIGNING_KEY` (secret), `GATEWAY_PUBLIC_KEY` | A new Ed25519 key pair, made as [runbook 5.2](tenant-fleet-runbooks.md#52-gateway-key-pair) step 1 says; the public key in PEM form | R7 |
| `CONTROL_PLANE_INTERNAL_URL` | `http://<slug>:8080`, with the `slug` of the API answer ([SO-03](self-onboarding-s1.md#so-03-private-address-of-the-control-plane)) | R7 |
| `RENDER_API_KEY` (secret) | The fleet key | R7 |
| `RENDER_OWNER_ID` | `tea-db8i6ceq1p3s73dev9og` | R7 |
| `RENDER_REGISTRY_CREDENTIAL_ID` | `rgc-dbg1h0142hec73da9ra0` | R7 |
| `TENANT_IMAGE` | `ghcr.io/tomer-mayara/thermus-hosted@sha256:8025ae1b37b10575f80e5df415f7723f79f58822ce88f3d6d85bd705f63084d9` | R7 |
| `TENANT_PLAN_FREE` | `0.5c-512mb` | R7 |
| `TENANT_NAME_PREFIX` | `thermus-spike-tenant-` | R7 |
| `FREE_TENANT_LIMIT` | `25` (D-6) | R7 |
| `FREE_TENANT_IDLE_DAYS` | `14` (D-6) | R7 |
| `TENANT_SWEEP_HOUR_UTC` | An hour outside the rehearsal window, so that no daily or Monday sweep runs during it; record the value | R7 |
| `SYSTEM_LOG_OTLP_ENDPOINT` | `/v1/logs` on the Axiom edge host of `AXOIM_ENDPOINT_URL` in `.env.local` (production uses `https://us-east-1.aws.edge.axiom.co/v1/logs`) | R7 |
| `SYSTEM_LOG_AXIOM_DATASET` | `system-log-test` | R7 |
| `SYSTEM_LOG_OTLP_TOKEN` (secret) | The Axiom token of [3.1](#31-inputs-for-part-b) | R7 |

The staging control plane gets no `WORKOS_MFA_POLICY`, no `STRIPE_*`
setting, and no `TENANT_PLAN_TEAM`: Slice 3 adds the team tier.

### 3.5 Runbook

Each step names who acts, the action, and the check. Record the time (UTC) and
the result of each step in the [record](#7-record). The expected values come
from the [Slice 1 record](self-onboarding-s1.md):

| Measure | Expected | Source |
| --- | --- | --- |
| First deploy of a new tenant | `live` 71 to 104 s after the create call | [SO-01e findings](self-onboarding-s1.md#findings) |
| First health request of a new web service | `502` one time (in SO-03 also two times) after the deploy is `live`, then `200`: repeat the first request | [SO-01d part two](self-onboarding-s1.md#part-two-findings-for-slice-2) |
| Private address of a new web service | Refused 16.5 s after the first deploy was `live`, and answered 76.4 s after it | [SO-03](self-onboarding-s1.md#so-03-private-address-of-the-control-plane) |
| Render limits | 20 creates an hour for each Render user; 10 updates, deploys, suspends, and resumes a minute for each service | [SO-01c](self-onboarding-s1.md#findings-for-slice-2) |
| Image deploy of an existing service | `live` about 30 to 36 s after the call | SO-01c, [SO-02](self-onboarding-s1.md#so-02-release-path-on-each-merge-to-main) |
| Suspend and resume | Suspended within 1 s; the resume deploy `live` 12 to 29 s after the resume | SO-01c, [SO-09](self-onboarding-s1.md#so-09-fleet-script-and-organization-sweep) |
| WorkOS reads after a delete | A read by ID can show a deleted organization for some seconds (6.6 s, once 77 s) | [SO-01f](self-onboarding-s1.md#workos-organization-check) |

**R0. Preflight (part B, reads only).**
Check: the application checks of [1.4](#14-application-checks-of-the-candidate-part-b)
passed. The owner confirmed the window of [3.2](#32-rules-of-the-rehearsal).
`GET /v1/services?ownerId=tea-db8i6ceq1p3s73dev9og&limit=100` lists only
`srv-db8mnqg473hc739d529g`. The credential `rgc-dbg1h0142hec73da9ra0` has the
registry `GITHUB`. In WorkOS Staging, read the redirect URIs, the sign-out URIs,
the initiate-login URI, and the OAuth resources, and keep the answer for the
cleanup check; no object has the run ID. With `STAGING_DATABASE_URL` and the
CA, the five tables of `thermus_admin` have zero rows. Record the run ID.

**R1. Create the staging control plane as a Git build (part B, fleet key).**
Send `POST /v1/services` with these values:

- type `web_service`, name `thermus-spike-control`, the workspace Thermus AI,
  region `oregon`, and plan `0.5c-512mb`;
- repository `https://github.com/tomer-mayara/Thermus`, branch `main`,
  `autoDeploy: no`, runtime `docker`, Dockerfile `./Dockerfile.hosted`, and
  health check `/healthz`;
- the variables of [3.4](#34-variables-of-the-staging-control-plane) for step
  R1, with the guessed host `thermus-spike-control.onrender.com`;
- the secret file `supabase-ca.crt`.

Record the service ID, the `slug`, the public URL, the first deploy ID, and
`Ratelimit-Remaining` of the creates.
Check: the deploy reaches `live`. `/healthz` answers `200` with `ok` (repeat
after a `502`). The log has `Listening on`, and it has no
`Logging storage is unavailable:` line and no tenant provisioner line.

**R2. Correct the host settings (part B).**
If the public host differs from the guessed host, set `PUBLIC_BASE_URL` and
`WORKOS_REDIRECT_URI` with `PUT /v1/services/<ID>/env-vars/<name>`, and deploy.
Check: `/healthz` answers `200`, and the sign-in of the portal starts with the
redirect URI of the public host.

**R3. WorkOS Staging entries.**
R3a (owner): add the redirect URI `https://<public host>/callback` in the
WorkOS dashboard of Staging, not as the default. R3b (part B, launcher): add
the OAuth resource `https://<public host>/mcp` with the additive API, and
record its ID.
Check: the redirect list and the resource list hold the new entries and each
entry of the gate. The defaults and the initiate-login URI did not change.

**R4. Switch the staging control plane to the image (part B, fleet key).**
This is the rehearsal of step 5a. Send `PATCH /v1/services/<ID>` with
`image.ownerId=tea-db8i6ceq1p3s73dev9og`,
`image.imagePath=ghcr.io/tomer-mayara/thermus-hosted@sha256:8025ae1b…`,
`image.registryCredentialId=rgc-dbg1h0142hec73da9ra0`, and
`serviceDetails.runtime=image`. The Render API reference says that an update is
not deployed automatically.
Check and record: the answer; `GET /v1/services/<ID>` shows the runtime
`image`, the image path, and the credential; and whether Render starts a deploy
in the 120 s after the update (deploy list and events). If Render refuses the
change, record the answer and stop at this step. The manager decides whether
the rehearsal goes on with the Git build or stops with the cleanup, and the
owner decides the path of step 5 ([section 6](#6-owner-steps-outstanding),
item 12).

**R5. Deploy the candidate with the release workflow (part B).**
This is the rehearsal of step 5b. Run
`gh workflow run hosted-image.yml --repo tomer-mayara/Thermus --ref main -f digest=sha256:8025ae1b37b10575f80e5df415f7723f79f58822ce88f3d6d85bd705f63084d9 -f service_id=<staging service ID>`.
Check: the job summary says "Deploy: live". The live deploy and `imagePath`
name the digest, and `/healthz` answers `200`. Record the run ID, the deploy
ID, and the time to `live`.

**R6. Organization A and an MCP call with the switch off (part B, launcher).**
Make organization A, its user, an Admin membership, and the Connect
application. Get a Connect token for the resource of R3b, with the
organization of A. Call `getURLAsMarkdown` with `https://example.com/`.
Check: the answer holds "Example Domain". The control plane served the call
itself: no tenant exists, and `thermus_admin.tenants` has no row.

**R7. The gateway switch on (part B).**
This is the rehearsal of step 6. Add the variables of
[3.4](#34-variables-of-the-staging-control-plane) for step R7 with
`PUT /v1/services/<ID>/env-vars/<name>`. Record whether Render starts a deploy
within 60 s of the first update: step 6 needs this fact. Then deploy the same
digest again with the workflow of R5, after a deploy that Render started by
itself is `live`.
Check: the log has `The tenant provisioner runs:` with the workspace, the
image, the plan, and the prefix `thermus-spike-tenant-`, and
`The tenant sweeps run each day at`. It has no `FATAL` line and no
`System log export failed:` line. The query of
[runbook 7.3](tenant-fleet-runbooks.md#73-axiom-monitors), on
`system-log-test`, shows the `Listening on` line of the deploy.

**R8. Provisioning of organization A (part B).**
This is the rehearsal of step 7. Call the tool for A again.
Check: the first answer is `503` with `Retry-After: 15`. The log has the
`Tenant provisioning record:` lines `creating`, `deploying` with the service
ID, and `live` with `internalUrl` `http://<slug>:8080`. Record the time from the
create call to `live`. After `live`, the call answers "Example Domain".
`fleet.ts list` and `fleet.ts status --organization <A>` show the row, the
digest, and the address. `GET /v1/services/<tenant ID>/env-vars` gives
`OPERATION_CAPACITY` `5` and only the seven tenant names of
[3.3](#33-resources). Print that one value and the names, nothing else.

**R9. Signup of organization B (part B, browser).**
This is the rehearsal of step 8. Set `SELF_SERVE_SIGNUP_ENABLED=true`, and
deploy. With a new verified user, open
`https://<public host>/signup?tier=free`, sign in, name organization B, accept
the agreement, and select **Create organization**.
Check: Quick start opens. Connect shows "Setting up your workspace. This takes
about two minutes." and reloads every 5 s, then shows the connection guide.
Record the time from **Create organization** to the guide. The row of B
becomes `live`. An MCP call for B answers "Example Domain".

**R10. Suspend (part B, fleet script).**
Run `fleet.ts suspend --organization <B>`, and answer `yes`.
Check: Render shows the service `suspended`, and the row is `suspended`.
Connect for B shows "Your workspace was paused after 14 days without use. It
restarts on the next request, which can take about a minute." above the guide.

**R11. Resume by an MCP call (part B).**
Call the tool for B.
Check: the answer is `503` with `Retry-After: 60` and "Your workspace is
restarting after a pause. Try again in a minute."
([`mcp-gateway-refusals.ts`](../../src/interfaces/mcp/mcp-gateway-refusals.ts)).
While the resume deploys, Connect shows the setup words. The row becomes
`live`, and the next call answers. Record the time from the first call to the
first answer.

**R12. Fleet upgrade (part B, fleet script).**
Run `fleet.ts upgrade --all --image ghcr.io/tomer-mayara/thermus-hosted@sha256:fd8d747ed68393587b029bb88efd75f716384b5db439199f1babfe41cc6e5efa`,
and answer `yes`. Then run the same command with the candidate digest. The
second command is the rollback of a fleet upgrade.
Check: each deploy reaches `live`, and each line ends with `digest recorded`.
MCP calls for A and B answer after each command. Record the times.

**R13. Organization removal (part B, launcher and fleet script).**
Delete organization A in WorkOS Staging by its exact ID. Read it by ID until the
answer is `404`. Then run `fleet.ts delete --organization <A>`, and answer
`yes` ([runbook 4](tenant-fleet-runbooks.md#4-deletion-of-a-tenant)).
Check: Render no longer lists the service of A. `fleet.ts status` shows the row
`deleted`. A call with a token of A gets an authorization error, and no tool
runs.

**R14. Rollback steps (part B).**
Do the steps of [section 5](#5-rollback) on the staging control plane, in their
order:

1. Set `MCP_TENANTS_ENABLED=false` and `SELF_SERVE_SIGNUP_ENABLED=false` in one
   change, and deploy.
2. Keep the tenant of B.
3. Deploy the rollback image
   `sha256:bbee3f8951ea2f93835b8beb671f85d6bf3b7a8aea91598fb511dc9504c9e40f`
   with the workflow of R5.

Check: an MCP call for B answers, and the control plane serves it. The signup
page shows "Activation is closed". The service of B and its row stay `live`.
After the rollback deploy, `/healthz` answers `200`, and an MCP call answers.
Then measure only: send a `PATCH` that switches the staging control plane back
to the Git build (`repo`, `branch`, and runtime `docker`). Record whether
Render accepts it. This tells whether production can go back to its Git build.

### 3.6 Cleanup

Do the cleanup at the end, and also after a failure. Order:

1. For each row that is not `deleted`, run `fleet.ts delete --organization <ID>`,
   and answer `yes`.
2. Delete `thermus-spike-control` with `DELETE /v1/services/<ID>` (fleet key).
   Its variables and its secret file go with it.
3. In WorkOS Staging, through the launcher, delete each organization, user,
   and Connect application of the rehearsal by its exact ID. Delete the OAuth
   resource of R3b by its ID.
4. The owner removes the redirect URI of R3a in the WorkOS dashboard.
5. The owner deletes the Supabase project `thermus-staging-rehearsal`. The
   runtime role has no `DELETE` grant, so the rows go with the project.
6. Delete the local key files and the token files of the rehearsal.

| Resource | Check that none remains |
| --- | --- |
| Render services | `GET /v1/services?ownerId=tea-db8i6ceq1p3s73dev9og&limit=100` lists only `srv-db8mnqg473hc739d529g`; no name starts with `thermus-spike-`. |
| WorkOS organizations, users, and Connect applications | A read by ID of each one answers `404`; allow about one minute ([SO-01f](self-onboarding-s1.md#workos-organization-check)). The staging control plane was public, with signup open from R9 to R14. List the organizations that WorkOS Staging made in that window, and give each organization that the rehearsal did not make to the owner. |
| OAuth resource | The resource list equals the list of R0. |
| Redirect URI | The redirect list equals the list of R0. |
| Registry rows | Before step 5 of the cleanup: `SELECT state, count(*) FROM thermus_admin.tenants GROUP BY state` gives `deleted` only. After it: the Supabase dashboard of the organization "Thermus" lists no project `thermus-staging-rehearsal`. |
| Secrets | No key file, token file, or `.env` file of the rehearsal is left on disk outside `.env.local`; the record and the pull requests hold no secret. |

### 3.7 Part B findings

Part B ran two times on 31 October 2026 (UTC). It used the helper
[`rehearsal.ts`](../../script/release/rehearsal/rehearsal.ts)
([Rehearse the SO-12 release](../../script/README.md#rehearse-the-so-12-release))
for the calls that the fleet script, the release workflow, and the probes do
not make. The [record](#7-record) has the result of each step, with the run.

- **Run 1**, run ID `20261031-2029`: R0 passed, and R1 failed (item 1 below).
  Steps R2 to R14 did not run, and the cleanup ran.
- **Run 2**, run ID `20261031-2052`, in the changed order of the manager
  decision below.

**Manager decision of 31 October 2026.** Run the rehearsal again in this order:

1. R1': create `thermus-spike-control` as a Git build, as R1 says, with the
   same variables, the secret file, and `autoDeploy: no`, and record the
   service ID, the `slug`, the public host, and the first deploy ID. Do not
   wait for the Git build, and do not depend on it: the check of R1 on the Git
   build is dropped for this run. The case of item 1 depends on the timing of
   the builder of Render; a fix of the case is a separate source pull request
   that the manager proposes to the owner. If the first deploy is still
   building at R4, cancel it with
   `POST /v1/services/<ID>/deploys/<deploy ID>/cancel`, and record that.
2. R4 at once, with the same checks.
3. R5.
4. R2: correct the host variables if the public host differs from the guess,
   and deploy again with the workflow, or record that nothing changed.
5. R3: the owner adds the redirect URI
   `https://thermus-spike-control.onrender.com/callback` before part B reaches
   R3. If the redirect list holds the URI of the actual public host, part B
   records it and goes on with R3b without a stop; else part B stops and names
   the URI.
6. R6 to R14 and the cleanup, as written. The check that the sign-in of the
   portal starts with the redirect URI of the public host moves from R2 to the
   first sign-in of R6.

The consequence: run 2 does not rehearse a live Git build of the staging
control plane. Production runs a Git build today, and item 1 stands. R14 still
measures the switch back to the Git build, as a measure only.

What differed from the expected values:

1. **R1 stopped run 1.** The first Git build of `main` (`c40b9912`, the
   candidate and the documents of part A) ended as `build_failed` 262 s after
   the create call. The check stage of `Dockerfile.hosted`
   (`npm run build:hosted` under `--network=none`) failed one test of the 222
   tests of its acceptance selection: in `hosted-tenant-capacity.test.js`, the
   case of `OPERATION_CAPACITY=5` got two `busy` events at the relay, not one.
   The same commit passed the same build in the hosted image run
   [41237416820](https://github.com/tomer-mayara/Thermus/actions/runs/41237416820)
   on GitHub (20:07 to 20:13 UTC). The candidate `fa787be4`, with the same
   source and tests, passed `npm run build:hosted` in run 41232469232 and in
   the manager round. So the case depends on the timing of the build machine:
   on the builder of Render it took 11.6 s. The effects:
   - In run 1, steps R2 to R14 did not run, and the cleanup ran. Run 2 used
     the changed order of the manager decision above.
   - Production builds from Git today, with the same `Dockerfile.hosted`. A Git
     deploy of production can fail in the same way until step 5 moves
     production to the image. A rollback to a Git build meets the same check.
   - A new run of R1 can pass, because the case passed in the other
     environments, but the result of one build is not certain. A change of the
     case is a source change outside this documents-only pull request:
     [#302](https://github.com/tomer-mayara/Thermus/pull/302), merged on
     31 October 2026, now counts the relayed events of the case one time for
     each operation ID.
2. **Many measured values match.** The Render interface gate passed, with
   deploys `live` 71.2 and 79.4 s after their create calls, and the tenants
   of run 2 were `live` about 77 s (A) and 90 s (B) after their create calls
   (expected 71 to 104 s). Each image deploy of the staging control plane
   was `live` 24.6 to 29.6 s after its call (expected 30 to 36 s), and each
   health check answered `200` at the first request, with no `502`. The public host was
   the guessed host `thermus-spike-control.onrender.com` in both runs, so R2
   changed nothing. The fleet upgrade deploys were `live` after 21 to 46.8 s.
   A deleted organization answered `404` 7.2 s after its delete (expected
   6.6 s, once 77 s).
3. **`.env.local` holds the WorkOS values of another environment.** Its
   `WORKOS_CLIENT_ID` is the client of WorkOS Production
   (`client_01M4VDKC291XX3CDEFP5ZKY5KP`). The WorkOS Staging launcher sets the
   Staging values first, and `node --env-file` keeps them. A command that runs
   with `node --env-file` but without the launcher gets the values of the file.
   The helper refuses each client ID and issuer that is not of WorkOS Staging.
   Run the fleet commands `request` and `summary` of the rehearsal only through
   the launcher, as [Operate the tenant fleet](../../script/README.md#operate-the-tenant-fleet)
   says.
4. **The words of `https://example.com/` changed.** In run 2, each answer
   was 957 characters and started "This domain is for use in documentation
   examples"; "Example Domain" was absent. The helper uses the marker of the
   hosted image gate (`documentation examples|illustrative examples|Example Domain`),
   as [`hosted-image.test.ts`](../../test/acceptance/auth/hosted-image.test.ts)
   does. The manager decided on 31 October 2026 that each check of R6 to R14
   that names "Example Domain" counts as passed with this marker. The same
   pull request corrects the expected words of the test call in the
   [free subscription guide](../free-subscription-guide.md#4-test-a-real-thermus-call)
   and in the check of step 8. The checks of [3.5](#35-runbook) keep the
   words with which the rehearsal ran.
5. **A new tenant refuses calls for about 75 s after `live`.** In R8, the
   row of A was `live` at 21:15:36, and four calls from 21:15:47 to 21:16:37
   got `MCP gateway tenant restart:` lines at the level ERROR, with
   `"cause":"connection"`; the call at 21:16:52 answered. SO-03 measured the
   same window for the private address of a new web service: refused 16.5 s
   after `live`, answered 76.4 s after it. The effects:
   - The Axiom monitor Tenant restart of
     [runbook 7.3](tenant-fleet-runbooks.md#73-axiom-monitors) matches each
     of these lines, so the first calls of a new tenant can send emails that
     do not mean a restart.
   - Connect shows the connection guide when the row is `live`, about 10 s
     later, so a new member can connect in the window and get "Server
     restarted. Try again in a minute.". For the discovery request of the
     MCP client, the gateway gives a JSON-RPC error, which the client of the
     helper reported as a failed protocol negotiation.
   - After a resume (R11), the calls 1.4 s and 12 s after `live` answered,
     with no restart line.
6. **Two provisioner loops run during a deploy of the control plane.** Render
   stopped the old instance about 120 s after the new deploy was `live`
   (21:21:51.9 after 21:19:52.2 in R9, and 21:36:08.4 after 21:34:08.7 in
   R14), not 60 s as [runbook 5.2](tenant-fleet-runbooks.md#52-gateway-key-pair)
   step 5 says. In R9, both instances ran the provisioner: the new one
   recorded the service of B at 21:20:29.8, and the old one claimed the same
   row 0.4 s later (`deploying`, `resumed`); the new one recorded `live`, and
   no second service came. The claim takes a `creating` row, and a
   `deploying` row without an address, at once, so a claim during the create
   call of the other loop can make a second service with the same name; the
   provisioner then stops the row with `2 services of the platform have the
   name`. [Plan section 7](self-onboarding-plan.md#7-risks-and-limits) counts
   one instance of the control plane and says that a second instance needs a
   shared claim for the loops; each deploy of the control plane runs two
   instances for about 2 minutes. In R14, the old instance with the switch on
   also ran its loop and its sweeps for 2 minutes after the deploy that turned
   the switch off.
7. **Render calls of steps 5 and 6.** R4 showed that Render accepts the
   switch of a Git build service to the image with one `PATCH` and starts no
   deploy; the release workflow then deploys the image. So item 12 of
   [section 6](#6-owner-steps-outstanding) needs no decision. R14 showed that
   Render also accepts the switch back to the Git build, and starts no deploy;
   the next Git deploy would meet item 1. In R7, the 16 variable updates went
   through the API in a bucket of 100 writes, and Render started no deploy in
   180 s, so the deploy after them is a step of its own.
8. **Resume times.** The resume deploys of R11 were `live` 39 s and 22.8 s
   after the resume (expected 12 to 29 s). The first answer came 46 s and
   40.6 s after the first call; the `Retry-After: 60` of the gateway covers
   both. In R9, the connection guide showed 103.5 s after **Create
   organization**, inside the "about two minutes" of the setup words.
9. **R3a needed a second entry.** After the owner reported the redirect URI,
   the redirect list of the Staging application did not hold it, and AuthKit
   answered the sign-in start with `/redirect-uri-invalid`. Run 2 stopped at
   R3a, and the manager added the URI through the WorkOS connector
   (`redir_01M69WDTZHN880TX6KV645D8P8`). In a later rehearsal, read the
   redirect list of the Staging application and try the sign-in start once
   before R3b.

## 4. Production order

Each step starts only after the owner's go-ahead. Write the go-ahead and the
result of each step in its slots and in the [record](#7-record) before the next
step starts.

**Preconditions.** The rehearsal passed, with its cleanup. Before step 5: the
GitHub environment for `RENDER_API_KEY`, the Render failure emails, and the
GHCR token expiry of [section 6](#6-owner-steps-outstanding). Before step 6:
the dedicated Render user of the control plane, the gateway key pair, and the
system log settings with their privacy decision. Production keeps
`SELF_SERVE_SIGNUP_ENABLED=false` and `MCP_TENANTS_ENABLED` off until their
steps; step 1 reads them.

### Step 1. Fresh WorkOS inventory and the D-10 cleanup

- **Who:** the owner. The agent can read the inventory with the owner's
  go-ahead.
- **Action:** read the organizations, users, memberships, and pending
  invitations of WorkOS production (`environment_01M4VDKBVH3BKNY1F64VSWJ9ZD`).
  On 23 October 2026 there were seven organizations, zero users, and zero
  pending invitations ([plan section 3.3](self-onboarding-plan.md#33-workos)).
  For each organization, the owner decides "keep" or "unused test". The owner
  deletes each unused test organization in the WorkOS dashboard. Also read the
  values of `SELF_SERVE_SIGNUP_ENABLED` and `MCP_TENANTS_ENABLED` of the
  production service: they are not secrets.
- **Check:** a second read lists only the kept organizations. A read by ID of
  each deleted organization answers `404`. The record has the counts and the
  kept organization IDs, and no person's name. `SELF_SERVE_SIGNUP_ENABLED` is
  `false`, and `MCP_TENANTS_ENABLED` is absent or `false`.
- **Go-ahead:** the owner, 31 October 2026 at 21:50 UTC: "Go ahead with step 1: read the WorkOS production inventory (organizations, users, memberships, pending invitations) and the two production switches, read only."
- **Result:** done, 31 October 2026, 21:51 to 22:16 UTC. The manager read WorkOS production through the WorkOS connector (read operations only) and the production variables through the Render API. Before the cleanup: 8 organizations (7 on 23 October), 2 users, 2 active memberships, 0 pending invitations. Kept: `org_01M5N95EJA1AKHHERCD7971AJ7` "Thermus AI" (the signup of 23 October; one Admin and one User, both accounts of the owner) and `org_01M515XQD27ZTRYZ546RSWBMY8` "Thermus AI" (external ID `thermus-ai`, 16 October, no user). Unused test, deleted by the owner in the dashboard at about 22:16 UTC: six "Personal workspace" organizations from signups of 17 to 19 October with no user (`org_01M5B3DS9GFRRYHMXJAWP0MKES`, `org_01M5AKRDB1XKF67D18DVVMRBVC`, `org_01M5ADVSBAYMTFP4GD2SAEH05A`, `org_01M550DZHMT0DFY2F54AF2SMSG`, `org_01M547HN59DT6RBMYYQXKDYBQY`, `org_01M5448JCCP69X2MKSYPF1EK8J`). Check: the second read lists the two kept organizations, the organization count is 2, and a read by ID of each deleted organization answers "Organization not found". Switches: `MCP_TENANTS_ENABLED` is absent; `SELF_SERVE_SIGNUP_ENABLED` was `true`, against the precondition, so on the owner's word the manager set it to `false` through the Render API at 21:53 UTC (`PUT` answered `200`, read back `false`); no deploy started (the latest deploy stays `dep-dbh91hmc6qcc73endk40` of 29 October), so the running instance keeps the old value until the deploy of step 5 applies the new one. `OPERATION_CAPACITY` is `1`.

### Step 2. Disposition of the open release holds

- **Who:** the owner.
- **Action:** decide each open hold of the
  [S2-04 ledger](admin-s2-04.md#evidence-and-release-holds) and of the
  [S2.5-02 ledger](admin-s2-5-02.md) ([plan section 3.4](self-onboarding-plan.md#34-legal-and-marketing)):
  accept, close, or keep as a stop.
- **Check:** each hold has a written disposition. A hold that stays a stop
  stops the order.
- **Go-ahead:** the owner, 31 October 2026 at 22:18 UTC, after the manager's summary of the ledgers: "I accept the alternate-address joining limit, the native generic error after a concurrent revoke, and the deferred mailbox checks as documented limits; the S2.5-02 gates are closed by the 26 October release; the $0 constraint is superseded by the self on-boarding plan. Record them and go on."
- **Result:** done, 31 October 2026, 22:18 UTC. Dispositions: (1) alternate-address joining, accepted as a documented limit (the remedy is a new invitation to the exact address, [Slice 1 verification](admin-s1-staging-release-verification.md#follow-up-native-diagnostics)); (2) the native generic error after a concurrent revoke, accepted as a documented limit (the state stays revoked); (3) the deferred mailbox checks (mail delivery, password reset, consumer exact-address acceptance), accepted as a documented limit; the canary signup of step 8 with an owner account exercises the verification mail for real. The S2.5-02 gates (deployment preflight, repair and review, earlier release, notice approval, notice and help integration, publication, production storage, removal rollout) are closed by the removal release of 26 October 2026 ([PR #260 Validation](https://github.com/tomer-mayara/Thermus/pull/260#issuecomment-6421162914)). The $0 new-infrastructure constraint of the S2-04 ledger is superseded by the self on-boarding plan (D-6: each live free tenant costs about 7 USD a month; SO-00 records the supersession). The recovery row keeps the owner's choice of no backup for Slice 2. No hold stays a stop. Open and separate from the holds: the privacy text for the Axiom export of the system log (D-11), decided before the token of step 6 ([section 6](#6-owner-steps-outstanding), item 4).

### Step 3. Database migration of SO-04

- **Who:** the agent with the owner's go-ahead, through the Supabase connector
  (`apply_migration` with the name `tenant_registry_and_billing`), or the owner
  in the SQL editor with stop-on-error.
- **Action:** first check that `thermus_admin.tenants`,
  `thermus_admin.subscriptions`, and `thermus_admin.billing_events` do not
  exist in the project Thermus AI (`rnqktgtgrvvqptbaosth`). Then apply
  [`20261027175430_tenant_registry_and_billing.sql`](../../sql/migrations/20261027175430_tenant_registry_and_billing.sql)
  one time, with SHA-256
  `7db781bffc9801b94f7a8e063e62258cfb9396f60a88a9cb66c17cbb1c173e81`
  ([S2-01a](admin-s2-01a-database-setup.md#add-the-tenant-registry-tables-before-slice-2-self-on-boarding)).
- **Check:** the three tables have the columns and checks of the file and zero
  rows. `thermus_logging` has SELECT, INSERT, and UPDATE, and no DELETE,
  TRUNCATE, DDL, or ownership. PUBLIC, `anon`, `authenticated`, and
  `service_role` have no access. RLS is on and forced, with the policies of the
  file. The security advisors show no new finding. Production `/healthz`
  answers `200`.
- **Go-ahead:** the owner, 31 October 2026 at 22:24 UTC, after the read-only pre-check: "Go ahead with step 3: apply the tenant registry migration to the production Supabase project through the connector, then run the checks."
- **Result:** done, 31 October 2026, 22:25 UTC. Pre-check at 22:19 UTC: `thermus_admin` of the project `rnqktgtgrvvqptbaosth` held only `logging_destination_settings` (1 row) and `membership_removal_operations` (2 rows); the migration history had four entries and no `tenant_registry_and_billing`; the file on main has the SHA-256 `7db781bffc9801b94f7a8e063e62258cfb9396f60a88a9cb66c17cbb1c173e81`. The manager applied the file one time through the Supabase connector as migration `20261031222505` `tenant_registry_and_billing`. Checks at 22:25 UTC: the three tables `tenants`, `subscriptions`, and `billing_events` exist with zero rows, row level security enabled and forced, owner `postgres`; `thermus_logging` has INSERT, SELECT, and UPDATE on each and no DELETE, TRUNCATE, REFERENCES, or TRIGGER; no grant to PUBLIC, `anon`, `authenticated`, or `service_role`; the nine policies of the file exist for `thermus_logging`; the security advisors report no finding; `https://app.thermus.ai/healthz` answers `200` with `ok` and the portal root answers `200`. The running control plane does not read the new tables until step 6.

### Step 4. Registry credential

- **Who:** the agent reads; the owner reads the token expiry.
- **Action:** production reuses `ghcr-thermus-hosted-read`
  (`rgc-dbg1h0142hec73da9ra0`) (answer 4 of 27 October 2026). Read
  `GET /v1/registrycredentials/rgc-dbg1h0142hec73da9ra0`. The owner reads the
  expiry date of its GitHub token and writes it in the operator record
  ([runbook 5.4](tenant-fleet-runbooks.md#54-github-token-of-the-registry-credential)).
  If the date is less than 14 days away, rotate the token first.
- **Check:** the credential has the registry `GITHUB` and the user
  `tomer-mayara`. The rehearsal tenants pulled the candidate with it. The
  operator record has the expiry date.
- **Go-ahead:** —
- **Result:** —

### Step 5. Control plane deploy with the gateway switch off

The Git build of production ends here (answer 5 of 27 October 2026). The deploy
job refuses a service whose runtime is not `image`, so step 5a comes first.
The custom-domain health URL and `confirm_production` run for real for the
first time at step 5b.

- **Who:** 5a: the owner in the Render dashboard, or the agent with the fleet
  key after the owner's go-ahead, by the method that step R4 proved. 5b: the
  agent after the owner's go-ahead.
- **Before:** items 5, 8, and 9 of [section 6](#6-owner-steps-outstanding) are
  done, and the workflow change of item 5 is merged. The rollback image
  `sha256:bbee3f89…` is in GHCR.
- **Action 5a:** switch `srv-db8mnqg473hc739d529g` to the image:
  `image.ownerId=tea-db8i6ceq1p3s73dev9og`,
  `image.imagePath=ghcr.io/tomer-mayara/thermus-hosted@sha256:8025ae1b37b10575f80e5df415f7723f79f58822ce88f3d6d85bd705f63084d9`,
  `image.registryCredentialId=rgc-dbg1h0142hec73da9ra0`, and runtime `image`.
- **Check 5a:** `GET /v1/services/srv-db8mnqg473hc739d529g` shows the runtime,
  the image path, and the credential. Record whether a deploy started, as step
  R4 recorded it. `/healthz` answers `200`.
- **Action 5b:**
  `gh workflow run hosted-image.yml --repo tomer-mayara/Thermus --ref main -f digest=sha256:8025ae1b37b10575f80e5df415f7723f79f58822ce88f3d6d85bd705f63084d9 -f service_id=srv-db8mnqg473hc739d529g -f confirm_production=srv-db8mnqg473hc739d529g`
- **Check 5b:** the job summary says "Deploy: live". The live deploy and
  `imagePath` name the digest. `https://app.thermus.ai/healthz` answers `200`
  with `ok`. The portal root answers `200`. The Render log has no `FATAL` line
  and no `Logging storage is unavailable:` line. When an account with product
  access exists, one MCP call answers; the control plane serves it with
  capacity 1. Record the run ID and the deploy ID.
- **Go-ahead:** —
- **Result:** —

### Step 6. The gateway switch on, with the system log settings

The new settings are read only with the switch on (answer 6 of 27 October
2026), so they come with this step.

- **Who:** the owner enters each secret in the Render dashboard. The agent
  reads the `slug` of the production service and checks the start.
- **Before:** items 1, 4, 9, and 10 of [section 6](#6-owner-steps-outstanding).
- **Action:** in one save of the Environment page of the production service,
  set these variables, then select **Save and deploy**. Step R7 showed that a
  variable update through the API starts no deploy ([3.7](#37-part-b-findings),
  item 7): so the owner uses **Save and deploy** in the dashboard, or the agent
  dispatches the workflow deploy of the current digest again after the save.

  | Variable | Value |
  | --- | --- |
  | `MCP_TENANTS_ENABLED` | `true` |
  | `GATEWAY_SIGNING_KEY` (secret), `GATEWAY_PUBLIC_KEY` | A new key pair of the owner ([runbook 5.2](tenant-fleet-runbooks.md#52-gateway-key-pair), step 1) |
  | `CONTROL_PLANE_INTERNAL_URL` | `http://<slug of the production service>:8080` |
  | `RENDER_API_KEY` (secret) | The key of the dedicated Render user of the control plane |
  | `RENDER_OWNER_ID` | `tea-db8i6ceq1p3s73dev9og` |
  | `RENDER_REGISTRY_CREDENTIAL_ID` | `rgc-dbg1h0142hec73da9ra0` |
  | `TENANT_IMAGE` | `ghcr.io/tomer-mayara/thermus-hosted@sha256:8025ae1b37b10575f80e5df415f7723f79f58822ce88f3d6d85bd705f63084d9` |
  | `TENANT_PLAN_FREE` | `0.5c-512mb` |
  | `TENANT_NAME_PREFIX` | not set: the default `thermus-tenant-` |
  | `FREE_TENANT_LIMIT` | `25` |
  | `FREE_TENANT_IDLE_DAYS` | `14` |
  | `SYSTEM_LOG_OTLP_ENDPOINT` | `https://us-east-1.aws.edge.axiom.co/v1/logs` |
  | `SYSTEM_LOG_AXIOM_DATASET` | `system-log` |
  | `SYSTEM_LOG_OTLP_TOKEN` (secret) | The Axiom ingest token for `system-log` only ([runbook 5.6](tenant-fleet-runbooks.md#56-axiom-ingest-token-of-the-system-log)) |

  `OPERATION_CAPACITY` stays `1`: it applies to the control plane while it
  serves the tools with the switch off. Each free tenant gets 5 from the
  provisioner (D-15). `TENANT_SWEEP_HOUR_UTC` stays at its default, 4.
- **Check:** the deploy is `live`. The log has `The tenant provisioner runs:`
  and `The tenant sweeps run each day at`, and no `FATAL` line. The query of
  [runbook 7.3](tenant-fleet-runbooks.md#73-axiom-monitors) shows the
  `Listening on` line in `system-log`, and the Render log has no
  `System log export failed:` line. Then the owner makes the monitor Tenant
  restart ([runbook 7.4](tenant-fleet-runbooks.md#74-owner-steps-for-the-alerts),
  step 4). A new tenant refuses calls for about 75 s after its row is `live`,
  and it writes `MCP gateway tenant restart:` lines at the level ERROR in that
  window ([3.7](#37-part-b-findings), item 5). So the owner expects an email
  of this monitor for each new tenant, until the monitor or the gateway is
  changed ([section 6](#6-owner-steps-outstanding), item 15).
- **Go-ahead:** —
- **Result:** —

### Step 7. One real MCP call for each kept organization

- **Who:** the owner, with a member of each kept organization.
- **Before:** the old instance of the control plane has stopped, about two
  minutes after the deploy of step 6 is `live`. Until then, two provisioner
  loops run, and in R9 the old loop claimed a row a second time
  ([3.7](#37-part-b-findings), item 6). The Render log shows
  `Stopping after SIGTERM` for the old instance.
- **Action:** a member of each kept organization makes one MCP call. The first
  call gets `503` with `Retry-After: 15`, and the provisioner makes the tenant.
  The member calls again after about two minutes. A portal visit of a member
  also requests the tenant. An organization without an active member gets no
  call and no tenant until its first use; record it.
- **Check:** each kept organization with a call has a `live` row with the
  candidate digest: `fleet.ts list` with the production registry settings, or
  a read of `thermus_admin.tenants` through the Supabase connector. Each tenant
  has `OPERATION_CAPACITY` `5`. The call after the setup state answers. The
  creates of this step share the 20 creates an hour of the dedicated Render
  user.
- **Go-ahead:** —
- **Result:** —

### Step 8. Canary signup with an owner account

- **Who:** the owner.
- **Action:** a canary signup needs `SELF_SERVE_SIGNUP_ENABLED=true`, but step
  10 opens signup. So the owner sets it to `true`, deploys, and does the canary
  at once. Then the owner sets it to `false` again and deploys, unless the owner
  decides to keep signup open from this step ([section 6](#6-owner-steps-outstanding),
  item 11). In a private window, open `https://app.thermus.ai/signup?tier=free`
  with an owner account that has no Thermus access, and follow section 2 of the
  [free subscription guide](../free-subscription-guide.md). Then connect a
  client and call the tool, as sections 3 and 4 of the guide say.
- **Check:** Quick start opens. Connect shows the setup words, then the
  connection guide. The organization has a `live` tenant, and the MCP call
  answers with the Markdown of example.com: today it starts with "This domain
  is for use in documentation examples". The hosted image gate accepts
  "documentation examples", "illustrative examples", or "Example Domain"
  ([3.7](#37-part-b-findings), item 4). The owner decides to keep or remove
  the canary organization ([runbook 4](tenant-fleet-runbooks.md#4-deletion-of-a-tenant)).
- **Go-ahead:** —
- **Result:** —

### Step 9. Marketing publication

- **Who:** the owner, or the agent after the owner's go-ahead.
- **Action:** mark [Thermus-Marketing #37](https://github.com/tomer-mayara/Thermus-Marketing/pull/37)
  Ready, check its Netlify Deploy Preview, and merge it. Netlify publishes
  `main`.
- **Check:** the Netlify deploy of the merge commit is published.
  `https://thermus.ai/` has the Hosted Free card, and its **Start free** link is
  `https://app.thermus.ai/signup?tier=free`.
  `https://thermus.ai/guide/pricing-hosting.md` has the free tier rules.
  `npm run check:discovery` of that repository passes. If signup is closed, do
  step 10 soon after this step: until then, the link opens "Activation is
  closed".
- **Go-ahead:** —
- **Result:** —

### Step 10. The signup switch on

- **Who:** the owner.
- **Action:** in the Render dashboard, set `SELF_SERVE_SIGNUP_ENABLED=true`,
  and select **Save and deploy** (section 1 of the
  [free subscription guide](../free-subscription-guide.md)).
- **Check:** in a private window, `https://app.thermus.ai/signup?tier=free`
  shows **Start free access**. The first signups give
  `Tenant provisioning record:` lines. After the first live tenant, the owner
  makes the monitors Tenant memory at 80 % and Fleet summary
  ([runbook 7.4](tenant-fleet-runbooks.md#74-owner-steps-for-the-alerts),
  step 5).
- **Go-ahead:** —
- **Result:** —

## 5. Rollback

Do these steps in this order. Stop when the service is healthy again.

1. **Turn the gateway switch off.** Set `MCP_TENANTS_ENABLED=false`, and
   deploy. The control plane then serves the tools of each organization itself,
   with `OPERATION_CAPACITY` `1`, and starts no provisioner or sweep. Check: an
   MCP call answers, and the start has no `The tenant provisioner runs:` line.
2. **Close signup.** Set `SELF_SERVE_SIGNUP_ENABLED=false`, in the same save
   as step 1 when both are needed, and deploy. Check: `/signup` shows
   "Activation is closed".
3. **Keep the tenants running.** Do not suspend or delete a tenant, and do
   not change a registry row. Each live free tenant costs about 7 USD a month.
   Record the list of `fleet.ts list`.
4. **Redeploy the previous control plane release, if necessary.** After step
   5 of the order, run
   `gh workflow run hosted-image.yml --repo tomer-mayara/Thermus --ref main -f digest=sha256:bbee3f8951ea2f93835b8beb671f85d6bf3b7a8aea91598fb511dc9504c9e40f -f service_id=srv-db8mnqg473hc739d529g -f confirm_production=srv-db8mnqg473hc739d529g`.
   This image has the code of production today ([1.3](#13-production-state-on-31-october-2026)).
   Do it after step 1: that code reads no setting of Slice 2 with the switch
   off. Check: the deploy is `live`, `/healthz` answers `200`, and an MCP call
   answers. Step R14 recorded whether Render can switch an image service back
   to a Git build.

The rollback keeps the registry tables, the organizations and their signup
records, the tenants, and the WorkOS settings. If the marketing page must go
back too, revert the merge of step 9 in the marketing repository; Netlify
publishes the revert.

## 6. Owner steps outstanding

| Item | Owner step | Before |
| --- | --- | --- |
| 1 | Make the dedicated Render user of the control plane, a Member of Thermus AI, and its API key ([runbook 5.1](tenant-fleet-runbooks.md#51-render-api-keys)). The owner enters the key in the Render dashboard at step 6. The rehearsal uses the fleet key (owner decision of 31 October 2026). | Step 6 |
| 2 | The staging Supabase project is done. After the rehearsal, delete `thermus-staging-rehearsal` (`kgiidcbufczoyifzxvtf`). Before any production use of the extracted CA, compare its fingerprint with the official download. | Cleanup |
| 3 | Add the WorkOS Staging redirect URI `https://<public host>/callback` when part B gives the host, and remove it at the cleanup. | Step R3 |
| 4 | Make the Axiom ingest token for `system-log` only ([runbook 5.6](tenant-fleet-runbooks.md#56-axiom-ingest-token-of-the-system-log)). Before that, decide the update of the privacy text under D-11: the hosted document bundles name Render, not Axiom, as the processor of the service logs (the open point of SO-11a in [plan section 6](self-onboarding-plan.md#slice-2-free-tier-end-to-end)). | Step 6 |
| 5 | Make a GitHub environment, for example `production`, with a deployment branch rule that allows only `main`. Put the release key in it as `RENDER_API_KEY`. A pull request then adds `environment: production` to the deploy job of `hosted-image.yml` (a policy path, so T1 Team review) and updates [Hosted release](../../README.md#hosted-release). After a dispatch passes, delete the repository secret. | Step 5 |
| 6 | Do the WorkOS production inventory and the D-10 cleanup. | Step 1 |
| 7 | Decide the open release holds of the S2-04 and S2.5-02 ledgers. | Step 2 |
| 8 | Write the expiry date of the GitHub token of `ghcr-thermus-hosted-read` in the operator record ([runbook 5.4](tenant-fleet-runbooks.md#54-github-token-of-the-registry-credential)). | Step 4 |
| 9 | Set the Render failure emails ([runbook 7.2](tenant-fleet-runbooks.md#72-render-failure-emails)). Make the Axiom email notifier and the three monitors in the order of [runbook 7.4](tenant-fleet-runbooks.md#74-owner-steps-for-the-alerts) and [7.3](tenant-fleet-runbooks.md#73-axiom-monitors). | Emails before step 5; notifier at step 6; monitors at steps 6 and 10 |
| 10 | Make the gateway key pair on the Mac of the owner, and enter it in the Render dashboard ([runbook 5.2](tenant-fleet-runbooks.md#52-gateway-key-pair), step 1). Delete the key files after step 6. | Step 6 |
| 11 | Decide the window of the signup switch around step 8. | Step 8 |
| 12 | If step R4 shows that Render cannot switch a Git build to an image, decide the path of step 5. Answered by run 2 of the rehearsal: Render accepts the switch ([3.7](#37-part-b-findings), item 7), so no decision is needed. | Step 5 |
| 13 | Review the copy of the marketing pull request, and give the go-ahead for its merge at step 9. | Step 9 |
| 14 | At the monthly GHCR pruning, keep the candidate digest `sha256:8025ae1b…`, the rollback digest `sha256:bbee3f89…`, and the upgrade digest `sha256:fd8d747e…` until the release is complete ([runbook 5.5](tenant-fleet-runbooks.md#55-monthly-ghcr-pruning)). | Each pruning |
| 15 | Open follow-ups of the rehearsal ([3.7](#37-part-b-findings), items 5 and 6). (a) A new tenant refuses calls for about 75 s after its row is `live` and writes `MCP gateway tenant restart:` lines at the level ERROR, so the monitor Tenant restart sends an email for each new tenant: change the monitor or the gateway. (b) During each deploy of the control plane, the old instance runs its provisioner loop for about two minutes, and in R9 it claimed a row a second time: decide a shared claim of the rows, which [plan section 7](self-onboarding-plan.md#7-risks-and-limits) names for a second instance. Until then, step 7 waits for the old instance to stop. | Open; no step of section 4 waits for it |

## 7. Record

Part B and part C fill this table. Write the time in UTC from `date -u`. Write
no secret.

| Step | Time (UTC) | Result | Evidence |
| --- | --- | --- | --- |
| 1.4 Application checks | 18:36:51 to 19:01:29 (manager round); 20:26:45 to 20:29:21 (Render interface gate) | Passed | [1.4](#14-application-checks-of-the-candidate-part-b): the manager round on `3050d706`, the same tree as `fa787be4` ([verification](https://github.com/tomer-mayara/Thermus/pull/295#issuecomment-6547815686)), and the Render interface gate of part B before step R1. |
| R0 Preflight | Run 1: 20:29:59 to 20:30:32. Run 2: 20:53:01 to 20:53:05 | Passed in both runs. Run IDs `20261031-2029` and `20261031-2052`. | Run 2: the service list, the objects with the run ID, the OAuth resources, and the five tables gave the same answers as in run 1. Run 1: the owner confirmed the window ([3.1](#31-inputs-for-part-b)). The service list of Thermus AI held only `srv-db8mnqg473hc739d529g`. `rgc-dbg1h0142hec73da9ra0` (`ghcr-thermus-hosted-read`) has the registry `GITHUB` and the user `tomer-mayara`. WorkOS Staging, kept for the cleanup check: the redirect URIs `https://localhost:24443/callback` (default, `redir_01M5YQXX5MZ202HY1SJAXBR180`) and `https://localhost:46443/callback` (`redir_01M5Z30C8MKYE38WW92WNB2VR6`); the sign-out URIs `https://localhost:24443/` (default) and `https://localhost:46443/`; the initiate-login URI `https://localhost:24443/login`; the OAuth resources `https://localhost:24443/mcp` (`authkit_oauth_resource_01M5YQXZ9GZ4VVYFQYQZZXTP41`) and `https://localhost:46443/mcp` (`authkit_oauth_resource_01M5Z30RTN19ZAJGV5TR7HFPEM`). No organization, user, or Connect application held the run ID. With `STAGING_DATABASE_URL` and the CA, with verified TLS, the five tables of `thermus_admin` had 0 rows. The production variable `PORT` is `8080` (one read at 20:30:32). |
| R1 Git build of `thermus-spike-control` | Run 1: 20:30:40 (create) to 20:35:04 (`build_failed`). Run 2 (R1'): 20:53:10 (create) to 20:53:21 (cancel) | Run 1: failed, the first deploy ended as `build_failed`, and run 1 stopped here. Run 2: R1' as the manager decision of 31 October 2026 says ([3.7](#37-part-b-findings)): created, the Git build canceled, and its check dropped. | Run 2: `POST /v1/services` answered `201` after 1.6 s, with `Ratelimit-Remaining` 16 of 20 and `Ratelimit-Reset` 409 s: service `srv-dbj5advf3r2c73f08rf0`, slug `thermus-spike-control`, public host `thermus-spike-control.onrender.com` (the guessed host), first deploy `dep-dbj5ae7f3r2c73f08sbg` (trigger `manual`, commit `c40b9912`, `build_in_progress`). `POST /v1/services/srv-dbj5advf3r2c73f08rf0/deploys/dep-dbj5ae7f3r2c73f08sbg/cancel` answered `200` after 0.2 s at 20:53:21; the deploy is `canceled`, finished at 20:53:21.4. Events: `build_started` and `deploy_started` at 20:53:12, `deploy_ended` and `build_ended` at 20:53:21. Run 1: `POST /v1/services` answered `201` after 2.3 s, with `Ratelimit-Remaining` 17 of 20 and `Ratelimit-Reset` 1,759 s: service `srv-dbj4vs6c6qcc73bfrgv0`, slug `thermus-spike-control`, public URL `https://thermus-spike-control.onrender.com` (the guessed host), first deploy `dep-dbj4vsmc6qcc73bfri00` (trigger `manual`, commit `c40b9912`). The create call held the 13 variables of R1 and the secret file `supabase-ca.crt`. The build ran `RUN --network=none npm run build:hosted` of `Dockerfile.hosted`: `npm run check` and the integration run (1,260 of 1,260) passed, and the acceptance selection failed 1 of 222: `dist/test/acceptance/mcp/hosted-tenant-capacity.test.js:59`, "Given OPERATION_CAPACITY=5 and 5 running calls, when a 6th call arrives, then it gets Server busy with completion busy and the relay receives its busy event" (11.6 s). The relay statuses were `busy, busy, success, success, success, success`, not one `busy` and five `success`. Events: `deploy_started` and `build_started` at 20:30:42, `build_ended` at 20:35:03, `deploy_ended` at 20:35:04. See [3.7](#37-part-b-findings). |
| R2 Host settings | Run 2: 20:57 | Run 2: passed; nothing changed. | The public host is the guessed host `thermus-spike-control.onrender.com`, so `PUBLIC_BASE_URL` and `WORKOS_REDIRECT_URI` of R1 stay, and no deploy was needed. The check of the sign-in moved to R6 (manager decision). Run 1: not run. |
| R3 WorkOS Staging entries | Run 2: 20:57:40 to 21:04:48 | Run 2: passed after one stop at R3a. | R3a: at 20:57:40 and 21:01:45, the redirect list of the default AuthKit application of Staging (`app_01M4VDKBBVBVZJCQJRE60RCMAQ`) held only the two redirect URIs of R0, and the sign-in start of the staging control plane ended at the AuthKit page `/redirect-uri-invalid` in 13 tries from 20:58:16 to 21:01:26, so part B stopped and named the URI. The manager then added `https://thermus-spike-control.onrender.com/callback` through the WorkOS connector (`redir_01M69WDTZHN880TX6KV645D8P8`, not the default). The read at 21:04 lists it with the two entries of the gate; the default redirect URI, the sign-out URIs, and the initiate-login URI did not change. At 21:04:38 the sign-in start went from `/login` to `api.workos.com/user_management/authorize` with `redirect_uri=https://thermus-spike-control.onrender.com/callback`, then to the AuthKit sign-in page. R3b: `POST /user_management/authkit_oauth_resources` answered `201` at 21:04:47 with `authkit_oauth_resource_01M69WF050ZR1JTAN4QZW41XYD` for `https://thermus-spike-control.onrender.com/mcp`; the list holds it and the two resources of the gate. Run 1: not run. |
| R4 Switch to the image | Run 2: 20:53:27 (update) to 20:55:44 (end of the watch) | Run 2: passed. Render accepts the switch of a Git build service to the image, and it starts no deploy. | `PATCH /v1/services/srv-dbj5advf3r2c73f08rf0` with `image.ownerId`, `image.imagePath` of the candidate, `image.registryCredentialId`, and `serviceDetails.runtime` `image` answered `200` after 1.3 s, with `Ratelimit-Remaining` 9 of 10. The answer and `GET /v1/services/srv-dbj5advf3r2c73f08rf0` show the runtime `image`, `imagePath` `ghcr.io/tomer-mayara/thermus-hosted@sha256:8025ae1b…`, the credential `rgc-dbg1h0142hec73da9ra0` (`ghcr-thermus-hosted-read`), no `repo` and no `branch`, and `autoDeploy` `no`. Render started no deploy in the 120 s after the update: a watch of the deploys and the events every 10 s, to 20:55:44, showed only the canceled Git build and no new event. Run 1: not run. |
| R5 Deploy of the candidate | Run 2: 20:56:07 (dispatch) to 20:57:21 | Run 2: passed. | Run [41241201078](https://github.com/tomer-mayara/Thermus/actions/runs/41241201078): the job summary says "Deploy: live". Deploy `dep-dbj5c48473hc73b75bug` was `live` 29.6 s after the deploy call (Render: createdAt 20:56:49.9, finishedAt 20:57:11.8); the live deploy and `imagePath` name the candidate digest; `GET https://thermus-spike-control.onrender.com/healthz` answered `200` with `ok` at the first request, with no `502`. The log of the start has `Listening on http://0.0.0.0:8080` at 20:57:04, and no `Logging storage is unavailable:` line, no tenant provisioner line, and no `FATAL` line. Run 1: not run. |
| R6 Organization A and the call with the switch off | Run 2: 21:04:57 to 21:08:55 | Run 2: passed, with another marker word (item 4 of [3.7](#37-part-b-findings)). | Client owner organization `org_01M69WF8FWHWPH8AWRMTS7PBJY` and organization A `org_01M69WF8TCW2C4BMH73PAXVY19` ("Thermus live 20261031-2052 A"); user A `user_01M69WF92892WD69EPY5E8NPQZ` with the Admin membership `om_01M69WF9FDKQ6H34JZ9KSKWKEH`; Connect application `connect_app_01M69WF9MP9N9V7546H6FXT2XQ` of the client owner organization, with the loopback callback `http://127.0.0.1:24490/callback`. The first sign-in of the portal (the check moved from R2) started at `/login` with the redirect URI of the public host and ended at `/` of the staging control plane at 21:06:51; Connect showed the connection guide and "You have product access in organization org_01M69WF8TCW2C4BMH73PAXVY19. Roles: admin." The Connect token for the resource of R3b came in 5.3 s, with the audience of the resource, the organization and the user of A, and a lifetime of 300 s. `getURLAsMarkdown` with `https://example.com/` answered 957 characters at 21:07:37, 21:07:56, and 21:08:55: the page starts "This domain is for use in documentation examples", and "Example Domain" is absent. The control plane served the calls itself: its log has `mcp.tool.completed` for user A, Render lists no tenant service, and `thermus_admin.tenants` has no row. Run 1: not run. |
| R7 Switch on | Run 2: 21:09:14 (first update) to 21:13:30 (deploy live) | Run 2: passed. A variable update starts no deploy. | 16 `PUT /v1/services/srv-dbj5advf3r2c73f08rf0/env-vars/<name>` from 21:09:14.3 to 21:09:16.2, each `200`, in a bucket of 100 writes (`Ratelimit-Limit` 100), with `TENANT_SWEEP_HOUR_UTC` `6` and `MCP_TENANTS_ENABLED` last. Render started no deploy and wrote no event in a watch from 21:09:10 to 21:12:19, which covers 60 s after the first update. Run [41242522775](https://github.com/tomer-mayara/Thermus/actions/runs/41242522775) then deployed the same digest: "Deploy: live", deploy `dep-dbj5jo8ae00c73d9ge5g` `live` 24.6 s after the call, `/healthz` `200` at the first request. The log of the start: `The tenant provisioner runs: Render workspace tea-db8i6ceq1p3s73dev9og, image ghcr.io/tomer-mayara/thermus-hosted@sha256:8025ae1b…, plan 0.5c-512mb, name prefix thermus-spike-tenant-.`, `The tenant sweeps run each day at 06:00 UTC`, and `Listening on`, with no `FATAL` line and no `System log export failed:` line. The query of runbook 7.3 on `system-log-test` shows the `Listening on` line at 21:13:16.428, instance `srv-dbj5advf3r2c73f08rf0-68899565b-tdzxs`. Run 1: not run. |
| R8 Provisioning of A | Run 2: 21:14:12 (first call) to 21:17:49 | Run 2: passed, with a window of tenant restart answers after `live` (item 5 of [3.7](#37-part-b-findings)). | The first call got `503` with `Retry-After: 15` and "Your workspace is not ready yet. Try again in 15 seconds."; so did five more calls to 21:15:31. The log: `MCP gateway refusal:` with `"reason":"starting"`, then `Tenant provisioning record:` `creating` at 21:14:17.4, `deploying` with `serviceId` `srv-dbj5kajbc2fs73bt71j0` at 21:14:19.9, and `live` with `internalUrl` `http://thermus-spike-tenant-org:8080` and the digest at 21:15:36.4: about 77 s from the create call to `live` (the deploy `dep-dbj5karbc2fs73bt724g`, created 21:14:19.8, finished 21:15:36.0). Four calls from 21:15:47 to 21:16:37 then got `MCP gateway tenant restart:` lines at the level ERROR, with `"phase":"before-answer"` and `"cause":"connection"`, and the MCP client reported a failed protocol negotiation. The call at 21:16:52, 75.6 s after `live` and 162.4 s after the first call, answered with the page. `fleet.ts list` and `fleet.ts status` show the row `live` with the digest `sha256:8025ae1b37b1…`, the newest deploy `live`, and the address `http://thermus-spike-tenant-org:8080`. The tenant service has the 7 variable names of [3.3](#33-resources) and `OPERATION_CAPACITY` `5`. Run 1: not run. |
| R9 Signup of B | Run 2: 21:18:53 (switch) to 21:23:22 (answer) | Run 2: passed. | `PUT SELF_SERVE_SIGNUP_ENABLED=true` at 21:18:53, then run [41243009421](https://github.com/tomer-mayara/Thermus/actions/runs/41243009421): "Deploy: live", deploy `dep-dbj5mogae00c73d9ods0` `live` 29.6 s after the call, at 21:19:52. User B `user_01M69X98QQEP00EENP5V7XPAQC` (verified, without memberships) signed in at the staging control plane and landed on `/organizations`; at `/signup?tier=free` part B named "Thermus live 20261031-2052 B", accepted the agreement, and selected **Create organization** at 21:20:23.7. Quick start opened 3.0 s later. Organization B is `org_01M69XBJYWXGDYV7V82G7K723J`. Connect showed "Setting up your workspace. This takes about two minutes." with a meta refresh of 5 s at 21:20:29, and the connection guide at 21:22:07.2: 103.5 s after **Create organization**. The row: `creating` at 21:20:27.0, `deploying` with `srv-dbj5n77b9u1s73d47ndg` at 21:20:29.8, `live` at 21:21:56.8, with the address `http://thermus-spike-tenant-org-6lgd:8080`. The call for B at 21:23:20 answered with the page. During the deploy of this step, the old instance of the control plane claimed the same row a second time (item 6 of [3.7](#37-part-b-findings)). Run 1: not run. |
| R10 Suspend | Run 2: 21:24:22 and 21:28:11 (two times) | Run 2: passed. | `fleet.ts suspend --organization org_01M69XBJYWXGDYV7V82G7K723J` with `yes`: "Done: srv-dbj5n77b9u1s73d47ndg is suspended, and the row is suspended." Render shows `suspended` (event `service_suspended` at 21:24:23.4, 1 s after the command started), and the row is `suspended`. Connect for B at 21:24:47 showed "Your workspace was paused after 14 days without use. It restarts on the next request, which can take about a minute." above the connection guide. Part B suspended B a second time at 21:28:11, because the helper had read the Connect view of the first resume too late (R11). Run 1: not run. |
| R11 Resume | Run 2: 21:25:17 to 21:26:04, and 21:28:21 to 21:29:02 | Run 2: passed. | Second resume: the first call at 21:28:21.96 got `503` with `Retry-After: 60` and "Your workspace is restarting after a pause. Try again in a minute."; the log has `MCP gateway refusal:` with `"reason":"resuming"` and `"resume":"sent"`. Render: `service_resumed` at 21:28:22.6, the resume deploy `dep-dbj5qtss728c738tjc0g` (trigger `service_resumed`) from 21:28:23.4 to 21:28:45.4. Connect at 21:28:31 showed the setup words with a meta refresh of 5 s, and no pause notice. The row: `deploying` (`resumed`) at 21:28:37.9, `live` at 21:28:48.3. A call at 21:28:44.9 got the same `503`; the call at 21:29:00.5 answered: 40.6 s from the first call to the first answer. First resume: the same `503` at 21:25:17.9, the resume deploy from 21:25:19.4 to 21:25:57.9 (39 s, above the expected 12 to 29 s), `live` at 21:26:00.6, the answer at 21:26:04: 46 s; the helper read Connect only 4 s after the call, when the registry copy of the portal still said `suspended`. Run 1: not run. |
| R12 Fleet upgrade | Run 2: 21:29:32 to 21:31:29 | Run 2: passed. | `fleet.ts upgrade --all --image ghcr.io/tomer-mayara/thermus-hosted@sha256:fd8d747e…` with `yes`: one batch of 2; A `dep-dbj5rgetlv9c73cahs3g` `live` after 21 s and B `dep-dbj5rhbbc2fs73btp220` after 26.5 s, each line ending with `digest recorded` (21:29:32 to 21:30:08). Calls for A and B answered at 21:30:15 and 21:30:17. The same command with the candidate digest: A `dep-dbj5ruajnfac73c7kimg` after 41.7 s and B `dep-dbj5rvflk1mc738bcbjg` after 46.8 s, each `digest recorded` (21:30:28 to 21:31:24). Calls for A and B answered at 21:31:24 and 21:31:27. Run 1: not run. |
| R13 Organization removal | Run 2: 21:31:41 to 21:32:02 | Run 2: passed. | A new token of A at 21:31:37, then the delete of organization A `org_01M69WF8TCW2C4BMH73PAXVY19` at 21:31:41.4: the read by ID answered `404` at read 4, 7.2 s after the delete. `fleet.ts delete --organization org_01M69WF8TCW2C4BMH73PAXVY19` with `yes` at 21:31:57: "Done: srv-dbj5kajbc2fs73bt71j0 is deleted, and the row of org_01M69WF8TCW2C4BMH73PAXVY19 is deleted." Render no longer lists the service, and `fleet.ts status` shows the row `deleted`, the newest deploy `gone`, and the address `unavailable`. The call with the token of A at 21:31:59 got `403` with `access_denied` ("Access denied. Open https://thermus-spike-control.onrender.com/signup to check free signup availability. ...") in 0.3 s; the control plane forwarded nothing. Run 1: not run. |
| R14 Rollback steps | Run 2: 21:33:18 to 21:37:43 | Run 2: passed. Render also accepts the switch back to the Git build. | 1: `PUT MCP_TENANTS_ENABLED=false` and `PUT SELF_SERVE_SIGNUP_ENABLED=false` at 21:33:18 (each `200`), then run [41244137060](https://github.com/tomer-mayara/Thermus/actions/runs/41244137060): "Deploy: live", deploy `dep-dbj5teks728c738tpln0` `live` 29.6 s after the call, `/healthz` `200`. The new start has `Listening on` and no `The tenant provisioner runs:` line. The call for B at 21:34:37 answered, and the control plane served it: its log has `mcp.tool.completed` for user B, and the registry kept the last use of B at 21:31:28. `/signup?tier=free` showed "Activation is closed" at 21:34:40. 2: the service of B stayed `not_suspended`, and its row `live`. 3: run [41244265833](https://github.com/tomer-mayara/Thermus/actions/runs/41244265833) deployed `sha256:bbee3f89…`: "Deploy: live", deploy `dep-dbj5u7ks728c738trjl0` `live` 24.8 s after the call, the digest in the live deploy and in `imagePath`, `/healthz` `200` at the first request, and a start with no error line. The call for B at 21:36:14 answered, served by the rollback image. The measure: `PATCH /v1/services/srv-dbj5advf3r2c73f08rf0` with `repo`, `branch` `main`, and the runtime `docker` with `./Dockerfile.hosted` answered `200` after 0.9 s at 21:36:38; the service then shows the runtime `docker`, the repository, and no `imagePath` or credential. Render started no deploy in the 60 s after it, and the deploy of the rollback image stayed `live`. Run 1: not run. |
| Cleanup | Run 1: 20:40:10 to 20:40:48. Run 2: 21:37:58 to 21:38:57 | Done. The manager removes the redirect URI `redir_01M69WDTZHN880TX6KV645D8P8` through the WorkOS connector, and the owner deletes the Supabase project `thermus-staging-rehearsal` (two `deleted` rows in `tenants`, the other four tables empty). | Run 2. Step 1: `fleet.ts delete --organization org_01M69XBJYWXGDYV7V82G7K723J` with `yes` at 21:37:59 deleted the service of B and set its row `deleted`; then `SELECT state, count(*) FROM thermus_admin.tenants GROUP BY state` gives `deleted 2`. Step 2: `DELETE /v1/services/srv-dbj5advf3r2c73f08rf0` answered `204` at 21:38:09, and the service list at 21:38:10 held only `srv-db8mnqg473hc739d529g`. Step 3: the Connect application, users A and B, the client owner organization, and organization B were deleted (organization A was gone already), and the OAuth resource `authkit_oauth_resource_01M69WF050ZR1JTAN4QZW41XYD` (`204`); each read by ID answered `404` within 4.8 s. No organization, user, or Connect application holds the run ID. In run 2, WorkOS Staging made only the client owner organization (21:04:56) and organization B (21:20:24); no organization of another party came in the signup window, 21:19:46 to 21:36:08. The OAuth resources equal those of R0. Step 4: the redirect URI `redir_01M69WDTZHN880TX6KV645D8P8` stays for the manager, who removes it through the WorkOS connector after this cleanup; the other redirect URIs, the sign-out URIs, and the initiate-login URI equal those of R0. Step 5 (owner): delete the Supabase project `thermus-staging-rehearsal`; its tenant registry holds the two `deleted` rows, and the other four tables have 0 rows. Step 6: the private state folder (the IDs, the passwords of the test users, and the Connect tokens) was deleted at 21:38:57; no key file, token file, or `.env` file of the rehearsal is left; the cookie password, the settings key, and the gateway key pair were made in memory only. Run 1. Step 1: the registry had no row. Step 2: `DELETE /v1/services/srv-dbj4vs6c6qcc73bfrgv0` answered `204` at 20:40:16, and the service list at 20:40:17 held only `srv-db8mnqg473hc739d529g`. Step 3: the run made no WorkOS object and no OAuth resource. No organization, user, or Connect application holds the run ID, WorkOS Staging made no organization after 20:29, and the OAuth resources, the redirect URIs, the sign-out URIs, and the initiate-login URI equal those of R0. Step 4: the owner added no redirect URI, so none is to be removed. Step 5 (owner): the Supabase project `thermus-staging-rehearsal` stays until the manager decides about a new run; its five tables have 0 rows. Step 6: the private state folder of the run, which held only the service IDs, was deleted at 20:40:48. |
| 1 WorkOS inventory and D-10 cleanup | 31 October 2026, 21:51 to 22:16 | done: 2 organizations kept, 6 deleted by the owner, 2 users, 0 invitations; `SELF_SERVE_SIGNUP_ENABLED` set to `false` through the API without a deploy | [Step 1](#step-1-fresh-workos-inventory-and-the-d-10-cleanup); the board ticket `5f858d` |
| 2 Release holds | 31 October 2026, 22:18 | done: three native-flow holds accepted as documented limits; the S2.5-02 gates closed by the 26 October release; the $0 constraint superseded; no stop | [Step 2](#step-2-disposition-of-the-open-release-holds) |
| 3 Database migration | 31 October 2026, 22:19 to 22:25 | done: migration `20261031222505` applied; three empty tables with forced RLS; runtime grants SELECT, INSERT, UPDATE only; no advisor finding; production health `200` | [Step 3](#step-3-database-migration-of-so-04) |
| 4 Registry credential | — | — | — |
| 5 Deploy with the switch off | — | — | — |
| 6 Switch on | — | — | — |
| 7 Kept organizations | — | — | — |
| 8 Canary signup | — | — | — |
| 9 Marketing publication | — | — | — |
| 10 Signup switch | — | — | — |

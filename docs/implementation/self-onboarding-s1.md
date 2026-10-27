# Self on-boarding Slice 1 evidence

This record keeps the evidence of the Slice 1 tickets of the self on-boarding
plan ([PR #259](https://github.com/tomer-mayara/Thermus/pull/259)), and of two
Slice 2 tickets: SO-03, the private address of the control plane, and SO-02,
which makes the workflow of SO-01b the release path. Each ticket or probe adds
one section: what ran and where, the durations and limits, and what a client
saw. The record holds no secret.

SO-03 of Slice 2 adds its measurement of the private address of the control
plane here, because it extends the private network probe of SO-01d.

## SO-01b: hosted image on a native AMD64 runner

Date: 26 October 2026. Branch `self-ob-s1-so-01b-hosted-image-workflow-656360`,
from main `c42aa823`.

The workflow [`hosted-image.yml`](../../.github/workflows/hosted-image.yml) has
manual dispatch only, with no push or pull request trigger. SO-02 later makes
it the release path. One job on `ubuntu-latest` does these steps:

1. It checks out the repository without its submodule.
   `Dockerfile.hosted.dockerignore` keeps `tools/` out of the build context.
2. It sets up Node 24.20.0 from `.nvmrc` and the pnpm of the `packageManager`
   field, 12.10.1, and runs `pnpm install --frozen-lockfile`.
3. It builds `Dockerfile.hosted` for `linux/amd64` once with Buildx and loads
   the image as `ghcr.io/tomer-mayara/thermus-hosted:<commit SHA>`. The build
   runs `npm run build:hosted` without network access. A failed check stops the
   build, so no image exists for the later steps.
4. It runs the [hosted image gate](test-gate-policy.md#hosted-image-gate),
   `npm run test:container:hosted`, with `THERMUS_HOSTED_GATE_IMAGE` set to that
   tag. The gate tests that image and builds none. It removes only its own
   containers. Without the setting, the gate builds and removes its own image,
   as before.
5. It logs in to GHCR with `GITHUB_TOKEN` (`contents: read`, `packages: write`)
   and pushes the tested image.
6. It writes the digest, the compressed size, and the build, gate, and push
   times to the job summary and to the log. It stops with an error if the
   pushed image is not the tested image.

Choices:

- The actions are pinned by commit SHA, with the release in a comment:
  `actions/checkout` v7.0.1, `actions/setup-node` v7.1.0,
  `docker/setup-buildx-action` v4.4.1, and `docker/login-action` v4.6.0.
- One build. The gate tests the image that the job pushes, so no second build
  runs. In the final run, the image ID that the gate tested is the config
  digest of the pushed manifest, because the runner uses the classic image
  store.
- No layer cache. A `type=gha` cache lets a rerun with the same inputs skip the
  stage that runs the offline checks. The
  [hosted offline build checks](test-gate-policy.md#hosted-offline-build-checks)
  say that every real hosted image build runs the complete checks. A cold build
  took 6 to 8 minutes on the runner. SO-02 can cache the dependency stages
  only, if the time becomes important.
- `--provenance=false`: the pushed digest names one image manifest, not an
  index with an attestation manifest.
- Timeouts: 120 minutes for the job, 60 for the build, 30 for the gate, and
  15 for the push. The gate allows 60 minutes for its build and image cases.

Each run used the GitHub-hosted image `ubuntu-24.04` version 20261012.334.1,
with 2 CPUs, 7,938 MiB of memory, 11 to 12 GB of free disk of 72 GB, and Docker
Engine 28.0.4 with the overlay2 image store. A run annotation says that
`ubuntu-latest` moves to Ubuntu 26 from 19 October 2026, so the Docker version
can change.

### Gate helper changes

Two changes in [`hosted-image-gate.ts`](../../test/support/container/hosted-image-gate.ts):

- `THERMUS_HOSTED_GATE_IMAGE` names an image that the caller built. The gate
  checks that the image is `linux/amd64`, writes a diagnostic line that names
  the image and its ID, and runs its cases without a build.
- The missing-portal case mounts its empty anonymous volume (`volume-nocopy`)
  without `readonly`. Docker Engine 28.0.4 refuses a read-only anonymous
  volume: "invalid mount config for type "volume": must not set ReadOnly mode
  when using anonymous volumes". Docker Engine 29.5.2 on the owner's Mac
  accepts it. The empty volume belongs to root with mode 755, so the `node`
  user sees no portal and cannot write one. The case and its assertion do not
  change.

### Registering the workflow

GitHub dispatches a workflow outside the default branch only after the
workflow has run one time. The first dispatch got HTTP 404, "workflow
hosted-image.yml not found on the default branch". One push-triggered run with
a skipped job registered the workflow. The temporary commit `79d6435d` added a
push trigger for this branch and the job guard
`if: github.event_name == 'workflow_dispatch'`. Its run
[40413094357](https://github.com/tomer-mayara/Thermus/actions/runs/40413094357)
skipped the job. The branch was then reset to `2381c7b4`, so its history does
not hold that commit. After the merge to main, this step is not necessary.

### Runs

| Run | Commit | Result | Step times |
| --- | --- | --- | --- |
| [40413199958, attempt 1](https://github.com/tomer-mayara/Thermus/actions/runs/40413199958/job/121888852363) | `2381c7b4` | The build failed in the integration suite: the port 46443 flake below. No image. | Build 3 min 46 s |
| [40413199958, attempt 2](https://github.com/tomer-mayara/Thermus/actions/runs/40413199958/job/121892267118) | `2381c7b4` | The build passed. The gate passed 5 of its 6 cases; the missing-portal case could not create its container. No push. | Build 5 min 36 s, gate 11 s |
| [40413396454](https://github.com/tomer-mayara/Thermus/actions/runs/40413396454/job/121889521286) | `8a4a6066`, throwaway | The build failed at the deliberate unit test. No image. | Build 3 min 22 s |
| [40415702003](https://github.com/tomer-mayara/Thermus/actions/runs/40415702003/job/121897364456), final | `2a900dcf` | Passed: build, gate 7/7, push, and record. | Build 472 s, gate 17 s, push 18 s; job 10 min 39 s |

In attempt 2, `npm run build:hosted` in the image build passed: backend units
3,301/3,301, portal units 29/29, portal acceptance 20/20, integration
1,156/1,156, the selected acceptance and interface files 119/119, and the
renderer gate 13/13. No test failed, was cancelled, was skipped, or was todo.
The gate wrote "Reused the caller-built image
ghcr.io/tomer-mayara/thermus-hosted:2381c7b47a79f2290858634c19a82a9d25476f33"
with image ID
`sha256:c04e9e13d69600cd94e8d4e397cd87dce1dbf6c4b3d3559c9736653317c57cd5`.

### Final evidence run

Run [40415702003](https://github.com/tomer-mayara/Thermus/actions/runs/40415702003/job/121897364456)
ran on commit `2a900dcf8ca79f527c6ddf60a60c426f5026ea59`, after the mount
change, and passed. The values come from the table that the record step wrote
to the log:

| Item | Value |
| --- | --- |
| Pull by digest | `ghcr.io/tomer-mayara/thermus-hosted@sha256:ca1ab23d3bd8ea2397076a370939173eb2548e275f322c7749d460a28ec71d26` |
| Tag | `ghcr.io/tomer-mayara/thermus-hosted:2a900dcf8ca79f527c6ddf60a60c426f5026ea59` |
| Compressed size | 154,723,455 bytes (147.6 MiB), 16 layers, `linux/amd64` |
| Build time | 472 s, the Buildx build of `Dockerfile.hosted` with its offline checks |
| Gate time | 17 s, `npm run test:container:hosted` against the built image |
| Push time | 18 s |
| Tested image ID and config digest | `sha256:876a8fc739a16389ad283346f58de56f61844d436a92d9279c74204a36e5959c` |

`docker push` reported the same digest, with a manifest of 3,667 bytes. In the
image build, `npm run build:hosted` passed the same counts as attempt 2. The
gate passed 7 of 7 tests, its six cases and their parent, with no failed,
cancelled, skipped, or todo test, in 12.1 s. It wrote "Reused the caller-built
image ghcr.io/tomer-mayara/thermus-hosted:2a900dcf8ca79f527c6ddf60a60c426f5026ea59"
with the image ID above. The pnpm install took 96 s.

### Retry history: port 46443

Attempt 1 failed in the integration suite of the image build. The case "Given
a WorkOS User grant and Connect token, when an HTTPS MCP POST calls the fetch
tool, then the verified identity and body reach the tool and the client
receives its result; an invalid token or removed grant starts no work", in
`test/integration/auth/hosted-live-site/mcp.ts`, stopped with
`listen EADDRINUSE: address already in use 127.0.0.1:46443`. Integration passed
1,155 of 1,156. The next case of the same describe listens on the same port
and passed.

Port 46443 is in the Linux ephemeral port range, 32768 to 60999. Just before
the fixed-port listen, the case binds port 0 for its WorkOS fake and for the
Thermus listener of the site, so an ephemeral socket can hold 46443. The
manager accepted one rerun. This ticket does not change the test; a follow-up
ticket moves the fixed port. The rerun, attempt 2, then stopped at the
read-only mount above, which is not a flake.

### A failed check stops the push

The throwaway branch `so-01b-failing-gate`, commit `8a4a6066` on `2381c7b4`,
added one failing offline unit test,
`test/unit/so-01b-deliberate-failure.test.ts`. In run 40413396454, the backend
units passed 3,301 of 3,302; the one failure was the deliberate test.
`npm run build:hosted` exited 1, and the build step failed after 3 min 22 s.
The gate, login, push, and record steps were skipped, so no image was pushed.

After the final run, the versions page of the package showed 1 tagged and 0
untagged versions: only the tag `2a900dcf8ca79f527c6ddf60a60c426f5026ea59`.
No version has the tag of the throwaway commit or of the two failed attempts.
The throwaway branch was then deleted.

### GHCR facts

From the GitHub documentation, read on 26 October 2026:

- Quota: "Container image storage and bandwidth for the Container registry is
  currently free." GitHub gives at least one month of notice before a change.
  Other private packages count toward the plan: 500 MB of storage on Free and
  2 GB on Pro and Team, shared with Actions artifacts.
- Retention: GHCR deletes no version automatically. Each run adds one version,
  and old versions stay until someone deletes them. SO-02 chooses the pruning
  rule and keeps the digests that a rollback needs.
- Limits: 10 GB for each layer and 10 minutes for each upload.
- Visibility and link: a new package is private by default. A package that a
  workflow publishes with `GITHUB_TOKEN` is linked to the repository of the
  workflow, and that repository gets the admin role on the package.

Seen on the package pages in the owner's browser after the final run:

- The package `ghcr.io/tomer-mayara/thermus-hosted` is private and linked to
  the repository: its page moved to
  `https://github.com/tomer-mayara/Thermus/pkgs/container/thermus-hosted`.
- Its settings name `tomer-mayara/Thermus` as the repository source and show
  the source label as `https://github.com/tomer-mayara/Thermus`.
  `Dockerfile.hosted` still names the old URL,
  `https://github.com/3-headed-monkey/Thermus`, which redirects; GHCR linked
  the package correctly, so the owner does not need to connect it by hand.
- Actions access: the repository Thermus has the Admin role. The package
  inherits its access from the repository.
- Versions: 1 tagged and 0 untagged, about 148 MiB compressed in total.

The session could not read the account plan, the billing usage, or the package
REST API. Its token scopes (`repo`, `workflow`, `gist`, `admin:org`) include
neither `user` nor `read:packages`.

### Owner steps: Render registry credential

SO-01c pulls the digest from a Render service in My Workspace. The package is
private, so Render needs a registry credential. The worker cannot make a GitHub
token. The owner does these steps:

1. On GitHub, open **Settings** > **Developer settings** > **Personal access
   tokens** > **Tokens (classic)**, and click **Generate new token (classic)**.
   GitHub Packages accepts only a personal access token (classic).
2. Type a note, for example `Render My Workspace GHCR pull`. Set an expiry
   date, for example in 90 days, and write the date down.
3. Select only the scope `read:packages`. Do not select `repo`,
   `write:packages`, or `delete:packages`.
4. Click **Generate token** and copy the token. GitHub shows it one time only.
5. In the Render Dashboard, select the My Workspace workspace. Open the
   workspace settings, find **Container Registry Credentials**, and add a
   credential:
   - Name: `ghcr-thermus-hosted-read`
   - Registry: the GitHub Container Registry option
   - Username: `tomer-mayara`
   - Personal Access Token: the token of step 4
6. Save the credential. Keep the token only in Render, not in the repository,
   a ticket, a chat, or a log. The token can read each package that the
   account can read.
7. Give the credential name and the expiry date to the SO-01c worker. SO-01c
   finds the credential ID with the Render API and pulls the image by the
   digest of the [final evidence run](#final-evidence-run).

To replace the token before it expires, make a new token with the same scope,
update the credential in Render, and then delete the old token on GitHub.

27 October 2026: the owner chose the Thermus AI workspace instead of My
Workspace. The manager created the credential `ghcr-thermus-hosted-read` there
through the API, with the ID `rgc-dbg1h0142hec73da9ra0` (see
[SO-01c](#so-01c-render-private-service-lifecycle)).

## SO-01d: gateway proxy and private network

Date: 26 October 2026. Part one is a local probe, in pull request
[#269](https://github.com/tomer-mayara/Thermus/pull/269), branch
`self-ob-s1-so-01d-gateway-proxy-probe-012463`. Part two uses the private
service of SO-01c on Render; it ran on 27 October 2026 (UTC), in pull request
[#271](https://github.com/tomer-mayara/Thermus/pull/271)
([part two](#part-two-render-private-network)).

### Part one: what the probe models

[`gateway-proxy-probe.ts`](../../script/spike/gateway-proxy-probe.ts) models
the MCP gateway of the plan, sections 4.1 and 4.2. It starts three parts in
one Node process, each on its own loopback port:

1. A stand-in tenant upstream,
   [`upstream.ts`](../../script/spike/gateway-proxy/upstream.ts). It serves
   `createMcpHandler` of `@modelcontextprotocol/server` 2.3.1, with one server
   for each request, through a small `node:http` bridge in the pattern of
   [`fetch-exchange.ts`](../../src/runtime/http/fetch-exchange.ts). Before any
   MCP handling, it checks the `Thermus-Access` header. It answers `403` with
   a JSON error when the header is missing, has a bad signature, or has an
   expired context. Its one tool, `slow`, sends a progress notification every
   200 ms for 3 seconds. Then it answers with text that names the
   organization of the verified context. It obeys the abort signal of the
   request and records the time when the signal fires.
2. A proxy, [`proxy.ts`](../../script/spike/gateway-proxy/proxy.ts). It
   forwards `POST /mcp` to the upstream with Node's fetch and a streamed body
   (`duplex: 'half'`). It removes the hop-by-hop headers and sets its own
   signed `Thermus-Access` header. It passes the abort of the client to the
   upstream request and streams the answer back, chunk by chunk.
3. An MCP client, `@modelcontextprotocol/client` 2.3.1, with the streamable
   HTTP transport, pinned to protocol 2026-07-28. It connects through the
   proxy.

[`access-context.ts`](../../script/spike/gateway-proxy/access-context.ts) has
the header format: a base64url JSON body `{ organizationId, subject,
expiresAt }`, a dot, and a base64url Ed25519 signature of the raw body bytes.
`expiresAt` is in milliseconds since the Unix epoch. The proxy signs a context
that is valid for 2 minutes. Each run makes new key pairs with
`generateKeyPairSync('ed25519')`.

To run the probe, type `node script/spike/gateway-proxy-probe.ts` in the
repository root. A run takes about 7 seconds and uses no network. The steps go
to stderr and the report goes to stdout. A failed step writes
`FAIL <step>: <reason>`, and the exit code is 1.

### Part one: steps

Each step is an assertion of the script. The two steps marked "extra" are not
in the ticket. Headers checks the header rules of the proxy. Early abort
checks the abort path that the 500 ms abort does not reach (see the mutation
checks).

| Step | Given, when, then |
| --- | --- |
| Streaming | Given the three parts, when the client lists the tools and calls `slow`, then 15 progress notifications arrive before the result, each at most 250 ms after its tick. |
| Headers (extra) | Given the requests of that call, when they reach the upstream, then they carry the bearer token of the client, and not `TE`, `Trailer`, `Proxy-Probe`, or the `Thermus-Access` value of the client. |
| Abort | Given a second `slow` call, when the client aborts it after 500 ms, then the upstream handler sees its signal within 100 ms of the abort and stops within 20 ms of the signal. |
| Early abort (extra) | Given a third call, when the client aborts it after 50 ms, before the upstream answers, then the same limits apply. |
| Signed header | Given a request with no header, a header signed by another key pair, or an expired context, when it goes to the upstream directly, then the answer is `403` before any MCP handling. Through the proxy, a normal call gets its result. |
| Cleanup | Given the end of the probe, then both listeners are closed and no TCP handle is open. A timer that does not keep the process alive stops the process with code 1 if it does not exit within 5 seconds. |

### Part one: measured times

Run 1 of 5, on 26 October 2026, on the owner's Mac (Darwin 27.0.0), with the
probe source of pull request #269; the later commits of that pull request
change only the record and the declaration. The table and the conclusions are
as the script printed them. The
script printed this line first: "Node v24.20.0, @modelcontextprotocol/server
2.3.1, @modelcontextprotocol/client 2.3.1, protocol 2026-07-28. Times are
milliseconds after the start of each call, on one clock; a "+" time is after
the client abort."

| Part | Event | Expected | Measured |
| --- | --- | --- | --- |
| Streaming | Progress 1 received | about 200 ms | 215.7 ms (sent 207.7 ms) |
| Streaming | Progress 2 received | about 400 ms | 412.7 ms (sent 408.8 ms) |
| Streaming | Progress 3 received | about 600 ms | 611.4 ms (sent 607.7 ms) |
| Streaming | Progress 4 received | about 800 ms | 814.5 ms (sent 809.2 ms) |
| Streaming | Progress 5 received | about 1000 ms | 1009.6 ms (sent 1006.1 ms) |
| Streaming | Progress 6 received | about 1200 ms | 1211.4 ms (sent 1207.8 ms) |
| Streaming | Progress 7 received | about 1400 ms | 1413.1 ms (sent 1409.6 ms) |
| Streaming | Progress 8 received | about 1600 ms | 1612.1 ms (sent 1607.8 ms) |
| Streaming | Progress 9 received | about 1800 ms | 1808.2 ms (sent 1805.7 ms) |
| Streaming | Progress 10 received | about 2000 ms | 2008.5 ms (sent 2007.3 ms) |
| Streaming | Progress 11 received | about 2200 ms | 2207.4 ms (sent 2206.4 ms) |
| Streaming | Progress 12 received | about 2400 ms | 2408.8 ms (sent 2407.6 ms) |
| Streaming | Progress 13 received | about 2600 ms | 2609.0 ms (sent 2606.2 ms) |
| Streaming | Progress 14 received | about 2800 ms | 2806.4 ms (sent 2805.8 ms) |
| Streaming | Progress 15 received | about 3000 ms | 3012.7 ms (sent 3009.6 ms) |
| Streaming | Result received | after progress 15 | 3014.2 ms |
| Headers | Bearer token at the upstream | forwarded | forwarded in 3 of 3 requests (server/discover, tools/list, tools/call) |
| Headers | TE, Trailer, and Proxy-Probe at the upstream | removed | removed in 3 of 3 requests |
| Headers | Thermus-Access value of the client | replaced | replaced in 3 of 3 requests |
| Abort | Client abort | about 500 ms | 502.2 ms |
| Abort | Progress received before the abort | 2 | 2 |
| Abort | Proxy sees the client go (response close) | after the abort | +6.4 ms |
| Abort | Upstream handler signal | within 100 ms of the abort | +8.2 ms |
| Abort | Upstream handler stops | within 20 ms of its signal | +8.4 ms |
| Abort | Proxy incoming request close event | not a client signal | 2.0 ms, at the body end |
| Early abort | Client abort | about 50 ms | 52.5 ms |
| Early abort | Progress received before the abort | 0 | 0 |
| Early abort | Proxy sees the client go (response close) | after the abort | +2.5 ms |
| Early abort | Upstream handler signal | within 100 ms of the abort | +3.6 ms |
| Early abort | Upstream handler stops | within 20 ms of its signal | +3.9 ms |
| Signed header | Direct request, no header | 403 | 403, reason missing |
| Signed header | Direct request, signed by another key pair | 403 | 403, reason bad_signature |
| Signed header | Direct request, expired context | 403 | 403, reason expired |
| Signed header | MCP handling of the refused requests | none | none |
| Signed header | Call through the proxy | result | result at 3006.6 ms |
| Cleanup | Open listeners and TCP handles | 0 | 0 |

- PASS Streaming: 15 progress notifications arrived before the result, from 215.7 ms to 3012.7 ms; the result came at 3014.2 ms.
- PASS Headers: the bearer token reached the upstream in 3 of 3 requests; TE, Trailer, and Proxy-* did not; the proxy replaced the Thermus-Access value of the client.
- PASS Abort: the upstream handler saw its signal 8.2 ms after the client abort (limit 100 ms) and stopped; the proxy used the close event of its response, because the close event of the incoming request came at the body end.
- PASS Early abort: before the upstream answered, the proxy aborted its pending upstream request; the handler saw its signal 3.6 ms after the client abort.
- PASS Signed header: direct requests with no header, another key pair, or an expired context got 403 before MCP handling; the call through the proxy got its result.
- PASS Cleanup: both listeners are closed and no TCP handle is open; a watchdog stops the process with code 1 if it does not exit.

Five runs in sequence, all with exit code 0:

| Measure | Range of five runs |
| --- | --- |
| Progress arrival after its planned tick | 6.4 to 20.1 ms |
| Upstream send to client arrival, the largest in a run | 7.2 to 10.5 ms |
| Result of the first call | 3,011.0 to 3,017.7 ms |
| Abort at 500 ms: the proxy sees the client go | +1.9 to +9.2 ms |
| Abort at 500 ms: upstream handler signal | +2.8 to +12.4 ms |
| Abort at 500 ms: handler stop after its signal | 0.1 to 0.3 ms |
| Abort at 50 ms: upstream handler signal | +1.3 to +3.6 ms |
| Close event of the incoming request at the proxy | 2.0 to 4.4 ms after the call start |
| Direct requests: no header, other key pair, expired context | `403`, with reason `missing`, `bad_signature`, and `expired`, in each run |
| Run time | 6.84 to 6.85 s |

### Part one: mutation checks

To show that each assertion can fail, the worker changed one line at a time,
ran the probe, and then reverted the change. No change is in the branch.

| Change | Result |
| --- | --- |
| The proxy reads the whole answer before it sends it. | `FAIL Streaming`: progress 1 arrived at 3,012.3 ms, after the 450 ms limit. |
| The proxy aborts the upstream request on the `close` event of the incoming request. | `FAIL Setup`: the first request, the version negotiation probe, failed with "fetch failed". |
| The proxy does not set its signed header. | `FAIL Setup`: the server denied access (HTTP 403). |
| The proxy forwards the hop-by-hop request headers. | `FAIL Headers`: the proxy forwarded `te`. |
| The upstream handler ignores its abort signal. | `FAIL Abort`: the handler stopped 95.9 ms after its signal; the limit is 20 ms. The first version of this check had a limit of 100 ms after the abort, and the change failed it by only 1.7 ms. |
| The proxy does not abort its pending upstream request. | `FAIL Early abort`: the upstream signal fired 157.2 ms after the abort. Before the Early abort step was added, this change passed. |
| The proxy listener stays open. | `FAIL Cleanup`: the proxy listener is still open. The timer then stopped the process with code 1, 5 seconds later. |

### Part one: findings for the gateway

- The proxy streams. Each progress notification reached the client 6.4 to
  20.1 ms after its tick. A buffered answer delivers all of them at about
  3,000 ms, as the first mutation check shows.
- In protocol 2026-07-28, the SDK client cancels a call when it closes the
  HTTP stream of that call (SDK client source). The abort crosses the proxy as
  a closed connection. The upstream handler saw its signal 1.3 to 12.4 ms
  after the client abort.
- Watch the `close` event of the response, with `writableFinished` false. Do
  not use the `close` event of the incoming request. In Node 24, the incoming
  request closes when its body ends: 2.0 to 4.4 ms after the call start. An
  abort on that event stopped the first request of the client immediately.
  The bridge in `fetch-exchange.ts` uses the same response rule.
- The abort has two paths. Before the upstream answers, only the abort of the
  pending fetch stops the upstream request. After the answer starts, a cancel
  of the response body also stops it. The gateway must have the two paths.
- The proxy must replace a `Thermus-Access` value that the client sends. The
  Headers step checks that the upstream never sees the client value.
- For connect, list, and call, the client sent three requests through the
  proxy: `server/discover`, `tools/list`, and `tools/call`. The proxy signed
  each one. The refused direct requests started no MCP server.
- Seen in a separate check with Node 24.20.0: Node's fetch refuses a request
  with a `keep-alive`, `transfer-encoding`, or `upgrade` header ("invalid
  header"). So the gateway must remove these headers before its fetch. A
  client that sends a chunked body sends `transfer-encoding`. The probe client
  sends none of the three.

### Part one: limits

- One process, one clock, and loopback ports. No TLS and no real network. The
  Render private network adds latency; part two checks only that the private
  address answers.
- A model, not the production code. The upstream does not check the bearer
  token, its hash, the pinned organization, the grants, or a repeated context.
  The proxy signs one fixed organization and subject.
- Only protocol 2026-07-28. In protocol 2025-11-25, the SDK client cancels
  with a `notifications/cancelled` POST and does not close the stream (SDK
  client source). The default run does not test that era; the 2025-11-25 run
  of the probe now measures it, in
  [Cancellation by notifications/cancelled](#cancellation-by-notificationscancelled-2025-era-clients).
- No compressed answer, no large body, no slow reader, and no calls at the same
  time. SO-01e measures the capacity. The proxy forwards only `POST /mcp` and
  answers `404` to other requests.

### Part two: Render private network

Date: 27 October 2026 (UTC). Pull request
[#271](https://github.com/tomer-mayara/Thermus/pull/271), branch
`self-ob-s1-so-01d-private-network-012463`, from main `9507e751`. The final
run used the script of commit `eb3f920c`. A later commit changed only
comments and the name of one function in the script.

Status: the probe is complete. The final complete run passed each step with 5
writes, and its cleanup deleted both of its services. From inside the private
network, port 8080 of the private service answered `200` with `ok`. Port
10000, the port in `serviceDetails.url`, refused the connection. From the
public internet, the name of the private service does not resolve.

Deviation from the ticket, a manager decision told to the owner: the shell
session of the operator becomes a one-off job on the web service. The probe
starts the job through the Render API, and the log lines of the job are the
transcript. Reason: the check repeats, and it needs no person at a keyboard. A
job runs on its own instance with the build and the variables of its service
([One-Off Jobs](https://render.com/docs/one-off-jobs)). The job reached the
private service, so it ran on the private network of the workspace.

[`private-network-probe.ts`](../../script/spike/private-network-probe.ts)
runs a preflight that only reads, and then four steps in order. Each step is
an assertion of the script. The helper modules are in
[`private-network-probe/`](../../script/spike/private-network-probe/). The
probe imports the Render client, the calls, the waits, the polls, and the
answers of SO-01c. For this reuse, the SO-01c modules changed in small ways:
the create call takes a service type, the service list takes a list of types,
the waits and the reads take one service, and the preflight reads and the
input checks are exported. The SO-01c dry run printed the same output before
and after the change.

1. Private service: the probe creates `thermus-spike-<UTC start time>` as
   SO-01c does, waits for `live`, checks the six variable keys, and reads
   `serviceDetails.url` and `serviceDetails.openPorts`.
2. Web service: the probe creates `thermus-spike-web-<UTC start time>` from
   the same image, with the same registry credential, variables, plan, and
   region, and the health check path `/healthz`. It waits for `live`, reads
   the public URL in `serviceDetails.url`, and requests `/healthz` there
   from this machine.
3. Job: the probe starts a one-off job on the web service. Its start command
   runs one line of JavaScript with `node -e`. The program requests, with a
   5 s timeout each, `http://<slug>:10000/healthz`,
   `http://<slug>:8080/healthz`, and `http://<serviceDetails.url>/healthz`.
   For each request, it prints one JSON line with the URL and the status and
   the first 100 characters of the body, or the error. The probe reads the
   job until it ends, and then reads its lines through `GET /logs`.
4. Public check: from this machine, the probe looks up the slug in DNS and
   requests `http://<slug>:10000/healthz`. It reads the private service and
   checks that the answer holds no public URL. Extra, recorded only: the
   slug under `onrender.com`.

The quoting of the start command. The runtime stage of
[`Dockerfile.hosted`](../../Dockerfile.hosted) starts from
`node:24.20.0-trixie-slim`, which has `/bin/sh`. The image runs as the user
`node` with the entrypoint `node /app/dist/src/index.js`. The docs do not say
whether a start command runs through a shell. So the program is one line with
no single quote, backslash, dollar sign, or backtick, and the start command
puts it in single quotes: `node -e '<program>'`. A shell and a shell-style
word split give the same arguments. On Render, the start command replaced the
entrypoint: the job printed its lines and ended, and the server did not start.

Run it from the repository root, as SO-01c:

```sh
node --env-file=/Users/tomermayara/git/Thermus/.env.local script/spike/private-network-probe.ts \
  --owner tea-db8i6ceq1p3s73dev9og --registry-credential ghcr-thermus-hosted-read \
  --image ghcr.io/tomer-mayara/thermus-hosted@sha256:d6b8a8fd3174c02984267f6aef54a7ee4e4bc783776ae9b856685202972dbfbd
```

Options:

- `--owner`, `--registry-credential`, `--region`, `--dry-run`, and
  `--preflight`: as in SO-01c. `--image`: one digest for both services.
- `--private-service-id` and `--web-service-id`: use live services instead of
  a create. The preflight must find each one in the service list, and its name
  must fit its role: `thermus-spike-web-*` for the web service, and another
  `thermus-spike-*` name for the private service.
- `--steps`: run only some of `private`, `web`, `job`, and `public-check`, in
  this order. `job` needs `private` and `web`; `public-check` needs `private`.
- `--keep`: keep both services when each step passed. After a failed step,
  the cleanup deletes them, also with `--keep`.

Rules of the script, in addition to the rules of SO-01c:

- The client rules of SO-01c apply. Each call to a path `/services/{id}` must
  name a service of this run, and the client always refuses
  `srv-db8mnqg473hc739d529g`. No output holds the key. The requests from this
  machine to the public URL and to the internal address send no key.
- The preflight and the cleanup list the services of the workspace with no
  type filter, so a `thermus-spike-*` service of any type counts.
- The job create goes one time only, as each write other than the delete.
- Bounds: the public `/healthz` gets at most 6 requests, 5 s apart, with a
  10 s timeout each. The job is read every 5 s, at most 60 times (5 minutes),
  and the logs every 5 s, at most 18 times (90 s).
- The cleanup first cancels a job that has not ended, because the docs do not
  say that a delete of its service stops it. Then it deletes the web service
  and the private service. When a create answer gave no service ID, it deletes
  each service with the exact name of this run. Then it reads the service list
  until no service of this run is listed, and no `thermus-spike-*` service may
  remain.
- Exit code 0: each step and the cleanup passed. Exit code 1: a step or the
  cleanup failed. Exit code 2: a usage error.

### Part two: steps

| Step | Given, when, then |
| --- | --- |
| Preflight | Given the inputs, when the probe reads the workspace, its registry credentials, and its services of every type, then one credential has the given ID or name and registry `GITHUB`, and no service named `thermus-spike-*` exists (with the reuse options: only those services). |
| Private service | Given the inputs, when the probe creates the private service as SO-01c does, then the answer is `201`, the first deploy reaches `live`, the service has the six variable keys, `serviceDetails.url` holds `<slug>:<port>`, and `serviceDetails.openPorts` holds 8080. |
| Web service | Given the same image, credential, variables, plan, and region, when the probe creates a web service with the health check path `/healthz`, then the answer is `201`, the first deploy reaches `live`, `serviceDetails.url` is an https URL, and `<public URL>/healthz` answers `200` with `ok` from this machine. |
| Job | Given both services live, when a one-off job on the web service requests `/healthz` of the private service on port 10000, on port 8080, and at `serviceDetails.url`, then the job ends, its log lines hold one JSON line for each request, and at least one request answered `200` with `ok`. |
| Public check | Given the private service, when this machine looks up its slug and requests `http://<slug>:10000/healthz`, then the lookup fails, the request gets no answer, `serviceDetails.url` has no scheme, and no field of the service answer names `onrender.com`. |
| Cleanup | Given any step, when the probe fails or ends, then it cancels a job that has not ended, deletes both services (unless `--keep` after a passed run), and no service named `thermus-spike-*` of any type exists. |

### Part two: planned calls

All calls go to `https://api.render.com/v1` with the header
`Authorization: Bearer <key>`, as in SO-01c. The pages were read on 27
October 2026 (UTC). On that day, the SHA-256 of
[render-public-api-1.json](https://api-docs.render.com/openapi/render-public-api-1.json)
was `c1502d3adbf703d66e351ed3bc3af699b858a755ee28f80e40b12ebf7b20a306`; it
changed after the SO-01c reading.

| Step | Method | Path | Documentation page |
| --- | --- | --- | --- |
| Preflight | `GET` | `/owners/{ownerId}` | [Retrieve workspace](https://api-docs.render.com/reference/retrieve-owner) |
| Preflight | `GET` | `/registrycredentials?ownerId=…&limit=100` | [List registry credentials](https://api-docs.render.com/reference/list-registry-credentials) |
| Preflight, Cleanup | `GET` | `/services?ownerId=…&limit=100`, then with `cursor` | [List services](https://api-docs.render.com/reference/list-services), [Pagination](https://api-docs.render.com/reference/pagination) |
| Private service, Web service | `POST` | `/services` | [Create service](https://api-docs.render.com/reference/create-service) |
| Private service, Web service | `GET` | `/services/{serviceId}/deploys/{deployId}` | [Retrieve deploy](https://api-docs.render.com/reference/retrieve-deploy) |
| Private service, Web service | `GET` | `/services/{serviceId}/env-vars?limit=100` | [List environment variables](https://api-docs.render.com/reference/get-env-vars-for-service) |
| Private service, Web service, Public check | `GET` | `/services/{serviceId}` | [Retrieve service](https://api-docs.render.com/reference/retrieve-service), [Private Network](https://render.com/docs/private-network) |
| Private service, Web service, only with a reuse option | `GET` | `/services/{serviceId}/deploys?limit=20` | [List deploys](https://api-docs.render.com/reference/list-deploys) |
| Job | `POST` | `/services/{serviceId}/jobs` with `startCommand` | [Create job](https://api-docs.render.com/reference/post-job), [One-Off Jobs](https://render.com/docs/one-off-jobs) |
| Job, Cleanup | `GET` | `/services/{serviceId}/jobs/{jobId}` | [Retrieve job](https://api-docs.render.com/reference/retrieve-job) |
| Job | `GET` | `/logs?ownerId=…&resource={webServiceId}&resource={jobId}&startTime=…&endTime=…&direction=forward&limit=100` | [List logs](https://api-docs.render.com/reference/list-logs) |
| Cleanup, only for a job that has not ended | `POST` | `/services/{serviceId}/jobs/{jobId}/cancel` | [Cancel running job](https://api-docs.render.com/reference/cancel-job) |
| Cleanup, only without a service ID | `GET` | `/services?ownerId=…&name=…&limit=100` | [List services](https://api-docs.render.com/reference/list-services) |
| Cleanup | `DELETE` | `/services/{serviceId}` | [Delete service](https://api-docs.render.com/reference/delete-service) |

The create body of the private service is the body of SO-01c, with the image
of this run. The create body of the web service differs in three places: `"type": "web_service"`, the name
`thermus-spike-web-…`, and `"healthCheckPath": "/healthz"` in
`serviceDetails`. The OpenAPI document gives `healthCheckPath` only in the
create details of a web service. The job body is
`{ "startCommand": "node -e '<program>'" }`; the measured section shows the
command of the final run. `startTime` is the `createdAt` of the job less
10 s, and `endTime` the time of the read, both in ISO 8601.

### Part two: checks before the writes

- `--dry-run` prints the calls of each step and exits with 0. With the
  network blocker preload of the tests,
  [`deny-network.ts`](../../test/support/processes/deny-network.ts), it makes
  no outbound attempt.
- Each of these stops the script with exit code 2 before any call, with no
  outbound attempt: no `RENDER_API_KEY` in real mode;
  `--owner tea-d3mlbrvdiees73ca4rdg`; `--private-service-id` or
  `--web-service-id` with `srv-db8mnqg473hc739d529g`; one ID for both
  options; no `--owner` or no `--image`; an image without a digest;
  `--steps job` without `private` and `web`; `--preflight` with `--keep`.
- A local check ran the start command against a loopback server, through
  `/bin/sh -c` and through a shell-style word split (Python `shlex`) with a
  direct start. Both printed the same three JSON lines and ended with exit
  code 0.
- Real mode ran against a stand-in for the Render API: a module, not in the
  branch, that replaced `fetch` in the process and made the timers shorter.
  Its workspace also listed the production web service. These runs measure
  nothing about Render. They show that each assertion can fail and that the
  cleanup runs. In no run did the probe call the production service, and no
  request outside the Render API carried the key.

| Change in the stand-in | Result |
| --- | --- |
| None | Exit code 0. Each step passed. 5 writes, and no probe service remained. |
| The job ends as `failed`, with no line. | `FAIL Job`. The cleanup deleted both services. Exit code 1. |
| The job succeeds, but the logs hold no line of it. | `FAIL Job` after 18 reads of the logs. The cleanup deleted both services. |
| Each request of the job is refused. | `FAIL Job`: "No request of the job answered 200 with ok", with each error. The cleanup deleted both services, also with `--keep`. |
| The job stays `running`. | `FAIL Job` after 60 reads. The cleanup canceled the job and deleted both services: 6 writes. |
| `SIGINT` while the job runs. | `FAIL Job: Stopped by SIGINT`. The cleanup canceled the job and deleted both services. |
| The delete of the web service answers `500`. | `FAIL Cleanup`, with the name and the ID of the web service. The cleanup deleted the private service. |
| The create of the web service gets no answer, but the service exists. | `FAIL Web service`. The cleanup found the web service by its name and deleted both services. |
| A service of an earlier run exists. | `FAIL Preflight` and `FAIL Cleanup`, with no write. |
| Both reuse options name live services, with `--keep`. | Exit code 0 with 1 write, the job. Both services stayed. |
| The two reuse IDs are swapped. | `FAIL Preflight`: no name fits its role. No write and no delete. |

The stand-in runs, the local check, and the development script below are in
the session scratchpad, not in the branch.

### Part two: development runs

The manager kept the Render write window for this probe until its final run.
All times are UTC.

| Start | Options | Writes | Result |
| --- | --- | --- | --- |
| 04:58:57 | `--preflight` | 0 | Pass. The service list with no type filter held no `thermus-spike-*` service. |
| 04:59:20 | `--steps private,web --keep` | 2 | Pass. The private service `srv-dbg2val9el5s73bo4bl0` was `live` 86.7 s after its create call, and the web service `srv-dbg300avcj2c73b0p2n0` 102.6 s after its create call. The public `/healthz` answered `200` at the second request. Both services stayed. |
| 05:03:27 | A development script with the modules and the start command of the probe, on the web service that stayed | 1 | The job ran the program. Port 8080 answered `200` with `ok`, and port 10000 refused the connection. `GET /logs` with the web service as the only resource gave none of the job lines; with the job ID, it gave all three, with the label `resource=<job ID>`. The probe then read the logs with both IDs. |
| 05:07:10 | `--private-service-id … --web-service-id … --keep` | 1 | Pass, with the same answers. |
| 05:08:22 | `--private-service-id … --web-service-id … --steps private,web,public-check` | 2 | Pass. The cleanup deleted both services. |

### Part two: measured

Final complete run, on the owner's Mac (Darwin 27.0.0), with the script of
commit `eb3f920c`. The exit code was 0. The tables, the transcript, and the
conclusions are as the script printed them. The script printed these lines
first: "Node v24.20.0. Start 2026-10-27T05:08:52.245Z. The private service thermus-spike-20261027-050852 (srv-dbg33pd9el5s73bogqdg) and web service thermus-spike-web-20261027-050852 (srv-dbg34csipgvc73ec2me0), in oregon, owner tea-db8i6ceq1p3s73dev9og." and "Times are seconds on the clock of this machine, from the start of the write that began each wait."

| Step | Check | Expected | Measured |
| --- | --- | --- | --- |
| Preflight | Workspace | the given owner | Thermus AI (team) |
| Preflight | Registry credential "ghcr-thermus-hosted-read" | one credential with this ID or name; registry GITHUB | ghcr-thermus-hosted-read (rgc-dbg1h0142hec73da9ra0), GITHUB |
| Preflight | Services named thermus-spike-*, any type | none | none |
| Private service | Create answer | 201 with the service and deployId | 201 after 2.5 s: srv-dbg33pd9el5s73bogqdg, `private_service`, plan `0.5c-512mb` |
| Private service | First deploy | live; time recorded | live 77.0 s after the create call (update_in_progress > live); Render: createdAt 2026-10-27T05:08:54.958242Z, finishedAt 2026-10-27T05:10:04.429727Z, 69.5 s |
| Private service | Variables (keys only) | PUBLIC_BASE_URL, WORKOS_API_KEY, WORKOS_AUTHKIT_ISSUER, WORKOS_CLIENT_ID, WORKOS_COOKIE_PASSWORD, WORKOS_REDIRECT_URI | PUBLIC_BASE_URL, WORKOS_API_KEY, WORKOS_AUTHKIT_ISSUER, WORKOS_CLIENT_ID, WORKOS_COOKIE_PASSWORD, WORKOS_REDIRECT_URI |
| Private service | Internal address | serviceDetails.url holds <slug>:<port>; openPorts holds 8080 | thermus-spike-20261027-050852:10000 in service.serviceDetails.url; slug `thermus-spike-20261027-050852`; openPorts 8080 |
| Web service | Create answer | 201 with the service and deployId | 201 after 2.9 s: srv-dbg34csipgvc73ec2me0, `web_service`, plan `0.5c-512mb` |
| Web service | First deploy | live; time recorded | live 92.2 s after the create call (update_in_progress > live); Render: createdAt 2026-10-27T05:10:12.666682Z, finishedAt 2026-10-27T05:11:37.284227Z, 84.6 s |
| Web service | Variables (keys only) | PUBLIC_BASE_URL, WORKOS_API_KEY, WORKOS_AUTHKIT_ISSUER, WORKOS_CLIENT_ID, WORKOS_COOKIE_PASSWORD, WORKOS_REDIRECT_URI | PUBLIC_BASE_URL, WORKOS_API_KEY, WORKOS_AUTHKIT_ISSUER, WORKOS_CLIENT_ID, WORKOS_COOKIE_PASSWORD, WORKOS_REDIRECT_URI |
| Web service | Public URL | an https URL in serviceDetails.url | `https://thermus-spike-web-20261027-050852.onrender.com` |
| Web service | GET https://thermus-spike-web-20261027-050852.onrender.com/healthz from this machine | 200 with body ok | 200, body "ok\n", after 270 ms; request 2 of at most 6; the requests before it: 502 |
| Job | Create answer | 201 with the job | 201 after 0.2 s: job-dbg354p42hec73deojhg, plan `plan-srv-031`, status `pending` |
| Job | Job end | succeeded; times recorded | succeeded 20.9 s after the create call (running > succeeded); Render: createdAt 2026-10-27T05:11:47.833506Z, startedAt 2026-10-27T05:11:47Z, finishedAt 2026-10-27T05:12:03Z; under 1 s to start, 16.0 s to run |
| Job | Log lines of this run | 3, one for each request | 3 of 3 log entries, 0.1 s after the job end (1 read of GET /logs with resource srv-dbg34csipgvc73ec2me0 and job-dbg354p42hec73deojhg; the last read: Ratelimit-Limit 30, Ratelimit-Remaining 29); resource label of the lines: job-dbg354p42hec73deojhg |
| Job | GET http://thermus-spike-20261027-050852:10000/healthz in the job (slug:10000) | recorded; one request at least answers 200 with ok | no answer: ECONNREFUSED, "connect ECONNREFUSED 10.12.163.32:10000", after 44 ms |
| Job | GET http://thermus-spike-20261027-050852:8080/healthz in the job (slug:8080) | recorded; one request at least answers 200 with ok | 200, body "ok\n", after 64 ms |
| Job | GET http://thermus-spike-20261027-050852:10000/healthz in the job (serviceDetails.url) | recorded; one request at least answers 200 with ok | no answer: ECONNREFUSED, "connect ECONNREFUSED 10.12.163.32:10000", after 3 ms |
| Public check | DNS lookup of thermus-spike-20261027-050852 from this machine | fails | fails: ENOTFOUND |
| Public check | GET http://thermus-spike-20261027-050852:10000/healthz from this machine | no answer | no answer: ENOTFOUND, "getaddrinfo ENOTFOUND thermus-spike-20261027-050852", after 10 ms |
| Public check | Public URL in the private service answer | none: serviceDetails.url has no scheme, and no field names onrender.com | serviceDetails.url `thermus-spike-20261027-050852:10000`; no field names onrender.com |
| Public check | https://thermus-spike-20261027-050852.onrender.com/healthz from this machine (extra) | recorded | DNS resolves to 216.24.57.18; GET answers 404 |
| Cleanup | Delete the web service srv-dbg34csipgvc73ec2me0 | 204, or 404 when already gone | 204 after 0.7 s |
| Cleanup | Delete the private service srv-dbg33pd9el5s73bogqdg | 204, or 404 when already gone | 204 after 1.1 s |
| Cleanup | Services named thermus-spike-*, any type | 0 | 0, 0.2 s after the deletes |

The start command of the job, as sent:

```text
node -e 'const targets=[["slug:10000","http://thermus-spike-20261027-050852:10000/healthz"],["slug:8080","http://thermus-spike-20261027-050852:8080/healthz"],["serviceDetails.url","http://thermus-spike-20261027-050852:10000/healthz"]];(async()=>{for(const [from,url] of targets){const started=Date.now();try{const response=await fetch(url,{signal:AbortSignal.timeout(5000)});console.log(JSON.stringify({probe:"SO-01d",run:"20261027-050852",from,url,status:response.status,body:(await response.text()).slice(0,100),ms:Date.now()-started}))}catch(error){const cause=error.cause||{};console.log(JSON.stringify({probe:"SO-01d",run:"20261027-050852",from,url,error:cause.code||error.name,message:String(cause.message||error.message).slice(0,200),ms:Date.now()-started}))}}})()'
```

The log lines of this run, as `GET /logs` gave them:

| Line | Timestamp | Labels |
| --- | --- | --- |
| 1 | 2026-10-27T05:11:57.313200901Z | resource=job-dbg354p42hec73deojhg instance=absent type=app level=error |
| 2 | 2026-10-27T05:11:57.377779859Z | resource=job-dbg354p42hec73deojhg instance=absent type=app level=info |
| 3 | 2026-10-27T05:11:57.380166998Z | resource=job-dbg354p42hec73deojhg instance=absent type=app level=error |

The messages of these lines, verbatim. They are the transcript:

```text
{"probe":"SO-01d","run":"20261027-050852","from":"slug:10000","url":"http://thermus-spike-20261027-050852:10000/healthz","error":"ECONNREFUSED","message":"connect ECONNREFUSED 10.12.163.32:10000","ms":44}
{"probe":"SO-01d","run":"20261027-050852","from":"slug:8080","url":"http://thermus-spike-20261027-050852:8080/healthz","status":200,"body":"ok\n","ms":64}
{"probe":"SO-01d","run":"20261027-050852","from":"serviceDetails.url","url":"http://thermus-spike-20261027-050852:10000/healthz","error":"ECONNREFUSED","message":"connect ECONNREFUSED 10.12.163.32:10000","ms":3}
```

Writes in this run: 5. Reads: 48; the last read had Ratelimit-Limit 400, Ratelimit-Remaining 396, and Ratelimit-Reset 48.

| Step | Call | Status | Duration | Ratelimit-Limit | Ratelimit-Remaining | Ratelimit-Reset | Retry-After |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Private service | `POST /services` | 201 | 2.50 s | 20 | 18 | 3067 | absent |
| Web service | `POST /services` | 201 | 2.90 s | 20 | 17 | 2990 | absent |
| Job | `POST /services/srv-dbg34csipgvc73ec2me0/jobs` | 201 | 0.23 s | 100 | 99 | 12 | absent |
| Cleanup | `DELETE /services/srv-dbg34csipgvc73ec2me0` | 204 | 0.73 s | 100 | 99 | 50 | absent |
| Cleanup | `DELETE /services/srv-dbg33pd9el5s73bogqdg` | 204 | 1.09 s | 100 | 98 | 49 | absent |

- PASS Preflight: the workspace Thermus AI (team) and the credential ghcr-thermus-hosted-read (rgc-dbg1h0142hec73da9ra0) exist, and no service of an earlier run exists.
- PASS Private service: thermus-spike-20261027-050852 (srv-dbg33pd9el5s73bogqdg) was created and was live 77.0 s after the create call; serviceDetails.url is thermus-spike-20261027-050852:10000, and openPorts holds 8080.
- PASS Web service: thermus-spike-web-20261027-050852 (srv-dbg34csipgvc73ec2me0) was created and was live 92.2 s after the create call; GET https://thermus-spike-web-20261027-050852.onrender.com/healthz from this machine answered 200 with ok (request 2).
- PASS Job: the job job-dbg354p42hec73deojhg ended succeeded; 200 with ok from slug:8080; other answers: slug:10000: no answer: ECONNREFUSED, "connect ECONNREFUSED 10.12.163.32:10000", after 44 ms; serviceDetails.url: no answer: ECONNREFUSED, "connect ECONNREFUSED 10.12.163.32:10000", after 3 ms.
- PASS Public check: from this machine, thermus-spike-20261027-050852 does not resolve (ENOTFOUND), GET http://thermus-spike-20261027-050852:10000/healthz gets no answer (ENOTFOUND), and the private service answer holds no public URL.
- PASS Cleanup: deleted srv-dbg34csipgvc73ec2me0 and srv-dbg33pd9el5s73bogqdg; no service named thermus-spike-* exists.

A preflight at 05:12:47 UTC, with reads only, listed no service named
`thermus-spike-*`. In all, the runs of this part made 11 writes: 4 creates, 3
jobs, and 4 deletes. A preflight of the SO-01c probe, with reads only, also
passed after the change of its modules.

Manager verification run, 27 October 2026 at 05:29 UTC, with the script of
commit `23a7c772` (the same real-mode code): exit code 0, 5 writes; private
service `srv-dbg3dl9srm7s73cctd4g` `live` 91.7 s after its create call; web
service `srv-dbg3ecec6qcc73e7cjr0` `live` 77.0 s after its create call, and
its public `/healthz` answered `200` at the third request after two `502`
answers; the job succeeded 16.1 s after its create call; port 8080 answered
`200` with `ok` after 15 ms, and port 10000 and `serviceDetails.url` got
`ECONNREFUSED`; `ENOTFOUND` from this machine; both deletes `204`; no
service named `thermus-spike-*` left. The full tables are in the Validation
comment of pull request #271.

The measured times of the three jobs and the four new services:

| Measure | Final run | Development runs |
| --- | --- | --- |
| Private service: create call to `live` | 77.0 s (Render: 69.5 s) | 86.7 s (Render: 83.3 s) |
| Web service: create call to `live` | 92.2 s (Render: 84.6 s) | 102.6 s (Render: 97.5 s) |
| Public `/healthz` of the new web service | `200` at the second request; the first got `502` | `200` at the second request |
| Job: create call to `running` | 0.3 s | 0.1 and 0.4 s |
| Job: create call to `succeeded`, as the probe saw it | 20.9 s | 10.6 and 16.1 s |
| Job: `startedAt` to `finishedAt` | 16 s | 6 and 15 s |
| Job lines in `GET /logs` | at the first read, 0.1 s after the job end | at the first read |
| Request from the job to port 8080 | `200` with `ok` after 64 ms | after 65 and 69 ms |
| Requests from the job to port 10000 | `ECONNREFUSED` after 44 ms, then after 3 ms | after 63 and 48 ms, then after 3 ms |

### Part two: findings for Slice 2

- The internal address. The provisioner stores `http://<slug>:8080` in the
  `internal_url` column: the host of `serviceDetails.url` with the port of
  `serviceDetails.openPorts`, which is `LISTEN_PORT` of the image. In the
  final run, that is `http://thermus-spike-20261027-050852:8080`. It does
  not store `serviceDetails.url` as it is: its port 10000 refused the
  connection in each job. The 10000 rule of the
  [Private Network](https://render.com/docs/private-network) page is for web
  services; for a private service, the server port is the port that answers.
- Inside the private network, the slug resolved to a `10.` address: one
  address for the service of the development runs, and another for the service
  of the final run. The page says that the addresses can change, so the
  gateway uses the name, not the address.
- A one-off job of a web service in the same workspace and region reaches the
  internal address. So a health check of the fleet script of SO-09 can use a
  job on a web service of the workspace. The job create is in a bucket of 100
  a minute, and each job is billed by the second
  ([One-Off Jobs](https://render.com/docs/one-off-jobs)).
- The lines of a job carry the ID of the job as their `resource` label, and
  they have no `instance` label. `GET /logs` with the ID of the service alone
  does not give them. The two lines with an `error` field had the label
  `level=error`, and the line with the status `200` had `level=info`.
- From the public internet, the slug does not resolve (`ENOTFOUND`). The name
  `<slug>.onrender.com` resolves, because `onrender.com` answers each name,
  but `/healthz` there answered `404`. So no public route reaches the private
  service.
- A new web service answered `502` once on its public URL after its deploy
  was `live`, and `200` 5 s later. A client that checks a new web service must
  repeat its first request.
- Rate limits, from the headers: the job create had `Ratelimit-Limit 100`,
  and `GET /logs` had `Ratelimit-Limit 30`. The
  [Rate Limiting](https://api-docs.render.com/reference/rate-limiting) page
  gives 100 jobs and 30 log reads a minute. The creates of this part used the
  bucket of 20 an hour of the same Render user: `Ratelimit-Remaining` was 17
  after the last create.

### Part two: documentation facts

- The One-Off Jobs page does not say whether `startCommand` runs through a
  shell, or how it acts on the entrypoint of an image. The runs showed that
  the start command replaced the entrypoint, and that the quoted program
  reached `node -e` as one argument.
- The page names no status values and no time fields of a job. The OpenAPI
  document gives `pending`, `running`, `succeeded`, `failed`, and `canceled`,
  and `createdAt`, `startedAt`, and `finishedAt`. In the answers,
  `startedAt` and `finishedAt` had whole seconds, and `createdAt` had
  fractions of a second.
- The plan ID of each job was `plan-srv-031`, for a web service on
  `0.5c-512mb`. The plan table of the One-Off Jobs page has `plan-srv-006`
  for 0.5 CPU and 512 MB.
- Neither the One-Off Jobs page nor the Private Network page says whether a
  job can use the private network. The runs showed that it can.
- List logs: the `resource` description names "job" as a resource. The
  description of `startTime` and `endTime` says "Epoch/Unix timestamp", but
  their format is `date-time` with ISO 8601 examples. The probe sent ISO 8601
  times, and Render accepted them. `resource` is an array with no style in the
  OpenAPI document; the probe repeated the parameter, and Render accepted two
  values.
- The Rate Limiting page writes the job path as `POST /v1/jobs`. The headers
  of `POST /services/{serviceId}/jobs` match its limit of 100 a minute.

### Part two: limits

- One complete run and two development jobs, in one region, with one instance
  of each service. The jobs requested one path, `/healthz`, with plain HTTP.
  No MCP call reached the private service, and the probe did not run the
  gateway code.
- The public check ran from one machine and one network. It shows that the
  name does not resolve in public DNS and that `onrender.com` has no route to
  the service. It does not test other ways into the private network.
- The services ran with the placeholder WorkOS values of SO-01c.

### Cancellation by notifications/cancelled (2025-era clients)

Date: 27 October 2026 (UTC). Board ticket 9f8980, pull request
[#272](https://github.com/tomer-mayara/Thermus/pull/272), branch
`self-ob-s1-cancel-notification-9f8980`. A local probe: no Render and no
secret. The SDK lines below are in version 2.3.1, under
`node_modules/@modelcontextprotocol/client/dist/` (client) and
`node_modules/@modelcontextprotocol/server/dist/` (server).

**Question.** In protocol 2026-07-28, the SDK client cancels a call when it
closes the HTTP stream of that call, and part one shows that the upstream
handler then stops. In protocol 2025-11-25, the SDK client sends a
`notifications/cancelled` POST and keeps the stream open. The upstream makes
one MCP server for each request, like the hosted server. When a 2025-era
client cancels a running call through the gateway, does the running handler
stop? How long does the client wait? What must the gateway do with the POST?

**How the client was pinned.** The SDK refuses `{ pin: '2025-11-25' }`:
pinning is for 2026-07-28 and later (client `index.mjs:2570`). So
`newLegacyClient()` in [`client.ts`](../../script/spike/gateway-proxy/client.ts)
uses `versionNegotiation: { mode: 'legacy' }` and
`supportedProtocolVersions: ['2025-11-25']`. Mode `legacy` runs the
`initialize` handshake. The client offers the first legacy version of its list
(client `index.mjs:3351`) and accepts only a version of that list (client
`index.mjs:3362`). Thus it offers and accepts only 2025-11-25. Mode `legacy`
is also the default of the SDK (client `index.mjs:2559`).

**What the run does.** Type
`node script/spike/gateway-proxy-probe.ts --protocol 2025-11-25` in the
repository root. The run starts the three parts of part one, with the client
pinned to 2025-11-25. A wire tap,
[`wire-tap.ts`](../../script/spike/gateway-proxy/wire-tap.ts), is the `fetch`
of the client transport. It records each request with its JSON-RPC message,
the answer status, and the end of the answer stream at the client. It also
keeps each error that the client reports. The proxy also records when it ends
an answer. The steps are in
[`cancel-notification.ts`](../../script/spike/gateway-proxy/cancel-notification.ts),
and the measure of one aborted call is in
[`cancel-measure.ts`](../../script/spike/gateway-proxy/cancel-measure.ts). A
run takes about 4 seconds and uses no network. Without the option, the probe
runs part one. Its output before and after this change is the same apart from
the times: a `diff` of the two outputs, with the times masked, found no
difference.

| Step | Given, when, then |
| --- | --- |
| Handshake (extra) | Given the three parts with the client pinned to 2025-11-25, when it connects, then `initialize` gets `200` and `notifications/initialized` gets `202` through the proxy, and the proxy answers the GET stream of the client with `404`. A direct GET to the upstream with a signed header gets `405`. |
| Cancel by notification | Given a `slow` call of that client, when the client aborts it after 500 ms, then the client sends one `notifications/cancelled` POST with the id of the call and settles the call within 100 ms. The proxy forwards the POST, and a new upstream server answers `202`. The upstream handler sees no signal while it runs and sends all 15 progress notifications. The stream of the call stays open until the result, and the client drops each later message. |
| Contrast 2026-07-28 | Given a second client pinned to 2026-07-28, when it aborts a `slow` call after 500 ms, then it sends no request and closes the stream of the call. The upstream handler sees its signal within 100 ms of the abort and stops within 20 ms of its signal. |
| Cleanup | The Cleanup step of part one. |

**Measured times.** Run 1 of 5, on 27 October 2026 (UTC), on the owner's Mac
(Darwin 27.0.0). The table and the conclusions are as the script printed
them. The script printed this line first: "Node v24.20.0,
@modelcontextprotocol/server 2.3.1, @modelcontextprotocol/client 2.3.1,
protocol 2025-11-25. Times are milliseconds after the start of each call, on
one clock; a "+" time is after the client abort."

| Part | Event | Expected | Measured |
| --- | --- | --- | --- |
| Handshake | initialize POST through the proxy | 200, version 2025-11-25 | 200; offered and negotiated 2025-11-25 |
| Handshake | notifications/initialized POST | 202 | 202 |
| Handshake | GET stream after notifications/initialized | 404: the proxy forwards only POST | 404; the client reported "Failed to open SSE stream: Not Found" 2 times |
| Handshake | Direct GET to the upstream with a signed header | 405 | 405 |
| Cancel by notification | Client abort | about 500 ms | 501.4 ms |
| Cancel by notification | Progress received before the abort | 2 | 2 |
| Cancel by notification | Request on the abort | notifications/cancelled POST | POST at +0.9 ms: notifications/cancelled, requestId 1 (the id of the call), reason "AbortError: This operation was aborted" |
| Cancel by notification | Answer to that POST | 202 from a new upstream server | 202 at +6.9 ms; the upstream factory made a server for it |
| Cancel by notification | Client call settles | at the abort, with an error | +1.3 ms: SdkError REQUEST_TIMEOUT "AbortError: This operation was aborted" |
| Cancel by notification | Stream of the call at the client | stays open | open; it ended at 3009.6 ms, after the result |
| Cancel by notification | Proxy sees the client go (response close) | not seen | not seen; the proxy ended the answer at 3009.2 ms |
| Cancel by notification | Upstream handler signal | none while it runs | none while it ran; it fired 1.0 ms after its end, when the SDK closed its server |
| Cancel by notification | Upstream handler end | runs to its end | finished at 3007.8 ms, after 15 of 15 progress notifications |
| Cancel by notification | Messages the client drops after the abort | 13 progress notifications and the result | 13 progress notifications and 1 result |
| Contrast 2026-07-28 | Client abort | about 500 ms | 500.2 ms |
| Contrast 2026-07-28 | Progress received before the abort | 2 | 2 |
| Contrast 2026-07-28 | Request on the abort | none; the client closes the stream of the call | none |
| Contrast 2026-07-28 | Client call settles | at the abort, with an error | +4.0 ms: SdkError REQUEST_TIMEOUT "AbortError: This operation was aborted" |
| Contrast 2026-07-28 | Stream of the call at the client | closed at the abort | closed (aborted) at +3.3 ms |
| Contrast 2026-07-28 | Proxy sees the client go (response close) | after the abort | +4.5 ms |
| Contrast 2026-07-28 | Upstream handler signal | within 100 ms of the abort | +5.8 ms |
| Contrast 2026-07-28 | Upstream handler end | stops within 20 ms of its signal | stopped at +6.0 ms, after 2 of 15 progress notifications |
| Contrast 2026-07-28 | Messages the client drops after the abort | none | 0 |
| Cleanup | Open listeners and TCP handles | 0 | 0 |

- PASS Handshake: the client negotiated 2025-11-25 through the proxy with initialize (200) and notifications/initialized (202); the proxy answered its GET stream with 404, and the client reported it 2 times and kept working; a direct GET to the upstream got 405.
- PASS Cancel by notification: on the abort, the client sent one notifications/cancelled POST for request 1 and settled its call 1.3 ms later; the proxy forwarded it, and a new upstream server answered 202; the running handler saw no signal and ran to its end at 3007.8 ms; the proxy sent the whole answer, and the client dropped 13 progress notifications and the result.
- PASS Contrast 2026-07-28: the 2026-07-28 client sent no request on the abort and closed the stream of the call; the upstream handler saw its signal 5.8 ms after the abort and stopped.
- PASS Cleanup: both listeners are closed and no TCP handle is open; a watchdog stops the process with code 1 if it does not exit.

Five runs in sequence, all with exit code 0, each in 3.80 to 3.93 s. The two
clients side by side:

| Measure | 2025-11-25 client | 2026-07-28 client |
| --- | --- | --- |
| Client abort after the call start | 500.6 to 502.6 ms | 500.2 to 502.6 ms |
| Request on the abort | `notifications/cancelled` POST at +0.9 to +1.3 ms, with `requestId` 1 and `reason` "AbortError: This operation was aborted" | none |
| Answer to that request | `202` at +6.9 to +8.8 ms | none |
| Client call settles | +1.3 to +2.4 ms, `SdkError` `REQUEST_TIMEOUT` | +2.2 to +4.7 ms, `SdkError` `REQUEST_TIMEOUT` |
| Stream of the call at the client | open until 3,008.4 to 3,019.2 ms, after the result | closed at +1.9 to +3.5 ms |
| Proxy sees the client go | not seen; the proxy ended the answer at 3,008.0 to 3,018.1 ms | +2.4 to +4.9 ms |
| Upstream handler signal | none while it ran; 1.0 to 4.6 ms after its end | +3.7 to +5.8 ms |
| Upstream handler end | finished at 3,006.4 to 3,011.3 ms, after 15 of 15 progress notifications | stopped at +3.8 to +6.0 ms, after 2 of 15 |
| Messages the client drops after the abort | 13 progress notifications and the result | none |

**Mutation check.** To show that the new assertion can fail, the worker
changed the proxy, ran the 2025-11-25 run, and then reverted the change. No
change is in the branch.

| Change | Result |
| --- | --- |
| The proxy reads each request body. When the body is a `notifications/cancelled` POST, the proxy aborts its pending upstream requests and then forwards the POST. | `FAIL Cancel by notification: The upstream handler saw its signal 12.5 ms after the abort, while it ran`, exit code 1. |

**Findings.**

- The 2025-era client does not wait. 0.9 to 1.3 ms after the abort, it sends
  the notification with the id of the call, and the text of the abort reason
  as `reason`. Then it rejects the call at once, with `SdkError` code
  `REQUEST_TIMEOUT` and the message "AbortError: This operation was aborted"
  (client `src-WCy6ifGf.mjs:6189` to `6206`). It does not wait for the `202`.
  A 2026-era abort gives the same error.
- The client closes the stream of the call only when the era is 2026-07-28
  and the transport has a stream for each request (client
  `src-WCy6ifGf.mjs:6169`; `StreamableHTTPClientTransport` sets
  `hasPerRequestStream`, client `index.mjs:5368`). In the 2025 era, it sends
  the notification instead.
- The stream of the call stays open. The client reads it to its end and drops
  each later message, with the client errors "Received a progress
  notification for an unknown token" and "Received a response for an unknown
  message ID" (client `src-WCy6ifGf.mjs:6024` and `6050`). Thus the gateway
  streams the whole answer of a cancelled call, and the tenant does all the
  work.
- The proxy forwards the notification like each other `POST /mcp`, with its
  signed header, to the same upstream. The upstream answers `202` from a new
  server. For each 2025-era POST, `createMcpHandler` gets a new server from
  the factory and a new stateless transport (server `index.mjs:1064` to
  `1083`), and a POST without a request gets `202` (server `index.mjs:771` to
  `776`). `_oncancel` looks for the request id only in the map of its own
  server (server `src-Cqbh3MYc.mjs:6337` to `6339`). That map gets an entry
  only when the same server runs the request (server
  `src-Cqbh3MYc.mjs:6508`). So the notification cannot reach the running
  call.
- The handler of the call saw no signal while it ran. Its signal fired 1.0 to
  4.6 ms after its end: at the end of the answer stream, the SDK closes the
  server (server `index.mjs:1105`), and the close aborts each handler that is
  still registered (server `src-Cqbh3MYc.mjs:6424`).
- The hosted server of today has the same behavior. `MCPServer` mounts
  `createMcpHandler` with the default stateless serving of 2025-era requests
  ([`mcp-server.ts`](../../src/interfaces/mcp/mcp-server.ts), line 59), and
  makes a new server for each request (`serverForRequest`, line 187). The
  signal of a tool joins the signal of the SDK request and the signal of the
  HTTP request
  ([`fetch-tool-server.ts`](../../src/interfaces/mcp/fetch-tool-server.ts),
  line 39). Neither fires on a 2025-era cancel. So a 2025-era cancel does not
  stop a fetch or a search today, with or without a gateway.
- A closed upstream request stops the handler in both eras. For a 2025-era
  request, the stateless serving closes the server when the request signal
  aborts (server `index.mjs:1083`). In the mutation check, the handler saw its
  signal 12.5 ms after the abort.
- After `notifications/initialized`, a 2025-era client opens a GET stream
  (client `index.mjs:5797`). The proxy forwards only `POST` and answered
  `404`. The client reported "Failed to open SSE stream: Not Found" two times
  to its error handler (client `index.mjs:5548`) and kept working. The
  stateless SDK serving answers a GET with `405` (server `index.mjs:1066`),
  and the client accepts a `405` without an error (client `index.mjs:5543`).
  So the gateway must pass a GET to the tenant; with `404`, each 2025-era
  client reports an error at each connect.

**What the gateway must do with the POST.** Forward it like each other
`POST /mcp`: to the tenant of the same organization, with the signed context.
Return the `202` of the tenant. A `202` from the gateway itself would hide the
notification from the tenant, and a later fix in the tenant would then also
need a gateway change. The gateway needs nothing more. Forwarding alone does
not stop the call.

**Design note for Slice 2.** Two options:

1. **Documented limit.** A 2025-era cancel does not stop the work in the
   tenant. The call runs to its own bounds, for a page render up to the
   60-second limit of Lightpanda (`LIGHTPANDA_TIMEOUT_MS` in
   [`website-fetcher-lightpanda.ts`](../../src/pipelines/providers/website-fetcher/website-fetcher-lightpanda.ts)).
   Until then, it keeps one `OPERATION_CAPACITY` slot and its renderer. The
   client discards the result, and the audit event records the real end, for
   example `success`, not `cancelled`. Cost: no code; one sentence in the plan
   and in the client guide. Risk: with a small capacity, a retry after a
   cancel can get `Server busy` until the first call ends, and a render (one
   reached 631 MiB, D-15) runs for nothing.
2. **Cancellation registry in the tenant process.** The gateway forwards the
   notification to the same tenant, as above. In the tenant, `MCPServer` keeps
   one map for the process. Its key is the hash of the bearer token and the
   JSON-RPC request id; its value is the abort controller of the running tool
   call. The `tools/call` handler adds its entry and removes it at its end,
   and the signal of the tool also joins that controller. Each per-request
   server gets a `notifications/cancelled` handler that finds the key and
   aborts the call. The token hash is necessary: the stateless 2025-era
   serving has no session ID, and each client numbers its requests from 0. So
   two clients can run a call with the same id at the same time. When more
   than one running call has the key, the handler aborts none. A notification
   that comes before its call starts has no effect. Cost, an estimate: size S,
   about 50 to 80 lines in `src/interfaces/mcp/`, one acceptance test (a
   2025-11-25 client cancels a fetch; the tool signal fires, and the audit
   status is `cancelled`), and unit tests of the map. No gateway change. It
   also fixes the hosted server of today.

A third option is rejected: a registry in the gateway that closes the
upstream stream of the matching call. The mutation check shows that this
stops the handler. But the gateway must then parse each JSON-RPC body and keep
the request ids, and the plan keeps the gateway a light streaming proxy.

Recommendation: option 2, the registry in the tenant, as a small ticket in
Slice 2 next to SO-03, or earlier on main. Reason: mode `legacy` is the SDK
default, so a client that does not choose a mode negotiates 2025-11-25 and
cancels by notification. With the limit, each cancel keeps a capacity slot
and a renderer of a small free container busy for up to 60 seconds. The
registry needs no gateway change, and it also fixes the hosted server of
today. The manager decides; option 1 is the fallback.

**Limits.**

- The limits of part one apply: one process, one clock, loopback ports, and a
  model of the upstream, not the production code.
- One client of each era, one call at a time, and one abort time. The probe
  does not test two clients with the same request id, a notification that
  comes before its call, or a cancel while the tenant resumes.
- We still do not know which protocol versions the production clients
  negotiate. The default of SDK 2.3.1 is `legacy`; other client libraries can
  differ.

## SO-01c: Render private service lifecycle

Date: 27 October 2026 (UTC). Branch `self-ob-s1-so-01c-render-lifecycle-570d06`,
from main `2b3ad13b`. The final run used the script of commit `22cff848`. A
later commit changed only the dry-run note of the address step.

Owner decision of 27 October 2026: probes run in the Thermus AI workspace in a
service named `thermus-spike-<time>`, never on the production service.

Status: the probe is complete. The final complete run passed each step with 9
writes, and its cleanup deleted its service. Before it, the development runs
used 9 writes on one other service, and the last of them deleted that service.
After the runs, no service named `thermus-spike-*` existed.

### What the probe does

[`render-tenant-lifecycle.ts`](../../script/spike/render-tenant-lifecycle.ts)
runs a preflight that only reads, and then the six steps of the ticket in
order. Each step is an assertion of the script. The helper modules are in
[`render-tenant-lifecycle/`](../../script/spike/render-tenant-lifecycle/).
[`calls.ts`](../../script/spike/render-tenant-lifecycle/calls.ts) builds each
call and its body. The dry run prints these calls, and real mode sends them,
so the printed bodies are the sent bodies. These calls become the Render
adapter of SO-06.

Run it from the repository root. The key comes from the git-ignored
`.env.local` of the main checkout, and the script reads only
`RENDER_API_KEY` from the environment:

```sh
node --env-file=/Users/tomermayara/git/Thermus/.env.local script/spike/render-tenant-lifecycle.ts \
  --owner tea-db8i6ceq1p3s73dev9og --registry-credential ghcr-thermus-hosted-read \
  --image ghcr.io/tomer-mayara/thermus-hosted@sha256:ca1ab23d3bd8ea2397076a370939173eb2548e275f322c7749d460a28ec71d26 \
  --second-image ghcr.io/tomer-mayara/thermus-hosted@sha256:d6b8a8fd3174c02984267f6aef54a7ee4e4bc783776ae9b856685202972dbfbd
```

Options:

- `--owner`: the workspace Thermus AI, `tea-db8i6ceq1p3s73dev9og`. The probe
  refuses My Workspace, `tea-d3mlbrvdiees73ca4rdg`, before any call.
- `--registry-credential`: the ID or the name of the credential. The
  preflight finds it in the credential list of the workspace.
- `--image` and `--second-image`: two digests of one repository. A deploy with
  `imageUrl` must keep the host, the repository, and the image name.
- `--region`: the default is `oregon`, the region of the production service.
- `--dry-run`: print the calls that the same options send. This mode makes no
  network call and needs no key.
- `--preflight`: make only the reads of the preflight. The client refuses
  each write before it sends it.
- `--service-id`, `--steps`, and `--keep`: use a live `thermus-spike-*`
  service instead of a create, run only some steps, and keep the service when
  each step passed. After a failed step, the cleanup deletes the service, also
  with `--keep`. These options save writes while a developer works on one
  step.

Rules of the script:

- Each call to a path `/services/{id}` must name the service of this run: the
  ID from the create answer, the `--service-id` that the preflight found in
  the service list of the workspace, or a service with the exact name of this
  run. The client refuses each other service before it sends the call, and it
  always refuses `srv-db8mnqg473hc739d529g`, the production service. The
  service lists always filter by the owner and by `type=private_service`.
- The key stays in a private field of the client. No output holds the key or
  a request header. The report holds no variable value and no event detail,
  because an event detail can name a user. A Render API key reaches every
  workspace of its user; the key of these runs sees two workspaces.
- A read or the delete has up to 3 attempts after a `429`, a `5xx` answer, or
  a network failure. Each other write goes one time only, because a repeated
  create or deploy can double its effect.
- Each wait reads every 5 s, with a fixed number of reads: 180 for a deploy
  (about 15 minutes), 36 to find a deploy that an answer did not name, 6
  after a plan update, 60 for a suspend or resume state, and 24 for the
  cleanup.
- The cleanup runs after each run, also after a failed step and after the
  first `SIGINT` or `SIGTERM`. Then it reads the service list until no
  service named `thermus-spike-*` exists. A second signal stops the probe at
  once and can leave the service.
- Exit code 0: each step and the cleanup passed. Exit code 1: a step or the
  cleanup failed. Exit code 2: a usage error.

The registry credential is `rgc-dbg1h0142hec73da9ra0`, name
`ghcr-thermus-hosted-read`, registry `GITHUB`, user `tomer-mayara`, in Thermus
AI. The manager made it on 27 October 2026 at about 03:10 UTC with
`POST /v1/registrycredentials`. Its token has only the `read:packages` scope.
Credential IDs start with `rgc-`.

### Steps

| Step | Given, when, then |
| --- | --- |
| Preflight (extra) | Given the inputs, when the probe reads the workspace, its registry credentials, and its private services, then one credential has the given ID or name and registry `GITHUB`, and no service named `thermus-spike-*` exists (with `--service-id`: only that one). |
| Create | Given the inputs, when the probe creates an image-backed private service named `thermus-spike-<UTC start time>` on `0.5c-512mb` with every variable in the create call, then the answer is `201` with the service and its first deploy ID, the first deploy reaches `live`, and the service has the six variable keys. The record gives the time to `live`. |
| Internal address | Given the live service, when the probe reads it, then a field of the answer holds `<slug>:<port>`, and `serviceDetails.openPorts` holds 8080. The record names the field. |
| Image 2 | Given the second digest, when the probe deploys it with `imageUrl`, then the deploy reaches `live`, and the only live deploy of the service reports image 2. The record also gives the image setting `imagePath` of the service. |
| Plan change | Given the live service, when the probe updates the plan to `1c-2g` and then back to `0.5c-512mb`, then each update answer shows the new plan, the deploy that applies it reaches `live`, and the service shows the new plan. The record says whether a new instance replaced the old one. |
| Suspend and resume | Given the live service, when the probe suspends it, then `suspended` becomes `suspended`. When it resumes it, then `suspended` becomes `not_suspended`, and a new deploy reaches `live`. The record gives both times and the image of that deploy. |
| Cleanup | Given any step, when the probe fails or ends, then it deletes the service, and the service list holds no service named `thermus-spike-*`. |

### Planned calls

All calls go to `https://api.render.com/v1` with the header
`Authorization: Bearer <key>`
([Authentication](https://api-docs.render.com/reference/authentication)). The
pages were read on 27 October 2026 (UTC). The OpenAPI document is
[render-public-api-1.json](https://api-docs.render.com/openapi/render-public-api-1.json),
SHA-256 `627b43845a33f79f1d0e3dbf46807b5d34072c746b1123b1e19972674ee9c5ba` on
that day. Each reference page shows the operation from that document.

| Step | Method | Path | Documentation page |
| --- | --- | --- | --- |
| Preflight | `GET` | `/owners/{ownerId}` | [Retrieve workspace](https://api-docs.render.com/reference/retrieve-owner) |
| Preflight | `GET` | `/registrycredentials?ownerId=…&limit=100` | [List registry credentials](https://api-docs.render.com/reference/list-registry-credentials) |
| Preflight, Cleanup | `GET` | `/services?ownerId=…&type=private_service&limit=100`, then with `cursor` | [List services](https://api-docs.render.com/reference/list-services), [Pagination](https://api-docs.render.com/reference/pagination) |
| Create | `POST` | `/services` | [Create service](https://api-docs.render.com/reference/create-service) |
| Create, Image 2, Plan change, Resume | `GET` | `/services/{serviceId}/deploys/{deployId}` | [Retrieve deploy](https://api-docs.render.com/reference/retrieve-deploy) |
| Create | `GET` | `/services/{serviceId}/env-vars?limit=100` | [List environment variables](https://api-docs.render.com/reference/get-env-vars-for-service) |
| Internal address, Image 2, Plan change, Suspend and resume | `GET` | `/services/{serviceId}` | [Retrieve service](https://api-docs.render.com/reference/retrieve-service), [Private Network](https://render.com/docs/private-network) |
| Image 2, Plan change, Resume | `GET` | `/services/{serviceId}/deploys?limit=20` | [List deploys](https://api-docs.render.com/reference/list-deploys) |
| Image 2, Plan change | `POST` | `/services/{serviceId}/deploys` with `imageUrl` | [Trigger deploy](https://api-docs.render.com/reference/create-deploy), [Deploy a Prebuilt Docker Image](https://render.com/docs/deploying-an-image) |
| Plan change | `PATCH` | `/services/{serviceId}` with `serviceDetails.plan` | [Update service](https://api-docs.render.com/reference/update-service), [Render Compute Plans](https://render.com/docs/compute-plans) |
| Plan change, Suspend | `GET` | `/services/{serviceId}/instances` | [List instances](https://api-docs.render.com/reference/list-instances) |
| Plan change, Resume | `GET` | `/services/{serviceId}/events?limit=100` | [List events](https://api-docs.render.com/reference/list-events) |
| Suspend | `POST` | `/services/{serviceId}/suspend` | [Suspend service](https://api-docs.render.com/reference/suspend-service-1) |
| Resume | `POST` | `/services/{serviceId}/resume` | [Resume service](https://api-docs.render.com/reference/resume-service-1) |
| Cleanup, only without a service ID | `GET` | `/services?ownerId=…&name=…&limit=100` | [List services](https://api-docs.render.com/reference/list-services) |
| Cleanup | `DELETE` | `/services/{serviceId}` | [Delete service](https://api-docs.render.com/reference/delete-service) |

The create body, as the dry run prints it:

```json
{
  "type": "private_service",
  "name": "thermus-spike-YYYYMMDD-HHMMSS",
  "ownerId": "tea-db8i6ceq1p3s73dev9og",
  "image": {
    "ownerId": "tea-db8i6ceq1p3s73dev9og",
    "imagePath": "ghcr.io/tomer-mayara/thermus-hosted@sha256:ca1ab23d3bd8ea2397076a370939173eb2548e275f322c7749d460a28ec71d26",
    "registryCredentialId": "{registryCredentialId}"
  },
  "envVars": [
    { "key": "PUBLIC_BASE_URL", "value": "https://thermus.example/" },
    { "key": "WORKOS_API_KEY", "value": "sk_test_placeholder" },
    { "key": "WORKOS_CLIENT_ID", "value": "client_placeholder" },
    { "key": "WORKOS_AUTHKIT_ISSUER", "value": "https://thermus-test.authkit.app" },
    { "key": "WORKOS_REDIRECT_URI", "value": "https://thermus.example/callback" },
    { "key": "WORKOS_COOKIE_PASSWORD", "value": "cookie-password-placeholder-0032" }
  ],
  "serviceDetails": { "runtime": "image", "plan": "0.5c-512mb", "region": "oregon", "numInstances": 1 }
}
```

The other bodies are `{ "imageUrl": "<image 2>" }` for each deploy and
`{ "serviceDetails": { "plan": "<plan>" } }` for each plan update. The
suspend, resume, and delete calls have no body.

### Placeholder environment

The create call holds every variable that the hosted image does not set
itself. The values are placeholders, not secrets. They are the values of
[`hosted-placeholder.ts`](../../test/support/fixtures/hosted-placeholder.ts),
with which the hosted image gate of the
[final evidence run](#final-evidence-run) started image 1.

| Variable | Value | Why startup accepts it |
| --- | --- | --- |
| `PUBLIC_BASE_URL` | `https://thermus.example/` | https, the root base path, no query |
| `WORKOS_API_KEY` | `sk_test_placeholder` | starts with `sk_` |
| `WORKOS_CLIENT_ID` | `client_placeholder` | starts with `client_` |
| `WORKOS_AUTHKIT_ISSUER` | `https://thermus-test.authkit.app` | an https origin with no path |
| `WORKOS_REDIRECT_URI` | `https://thermus.example/callback` | inside `PUBLIC_BASE_URL` |
| `WORKOS_COOKIE_PASSWORD` | `cookie-password-placeholder-0032` | 32 characters |

`Dockerfile.hosted` sets `NODE_ENV`, `DEPLOYMENT=hosted`, `AD_RULES_FILE`,
`LIGHTPANDA_BIN`, `LIGHTPANDA_DISABLE_TELEMETRY`, `LISTEN_HOST=0.0.0.0`, and
`LISTEN_PORT=8080`. Startup makes no WorkOS call: the key set of AuthKit loads
at the first check of a Connect token. Without `DATABASE_URL` and
`LOGGING_DESTINATION_ENCRYPTION_KEY`, startup writes one `ERROR` line,
"Logging storage is unavailable", and MCP stays available. The create call
sets no `SELF_SERVE_SIGNUP_ENABLED` and no `OPERATION_CAPACITY`, so signup
stays closed and the capacity is 10.

Local check, 27 October 2026 (UTC), on the owner's Mac with Node 24.20.0 and the
pinned Lightpanda 1.0.0 (its SHA-256 matches the `aarch64-macos` digest of
[the runtime guide](../lightpanda-runtime.md)). The check started the server
with the six variables above, the settings of `Dockerfile.hosted` (except
`LISTEN_HOST=127.0.0.1` and `LISTEN_PORT=0`), the built portal, and the network
blocker preload of the tests, which reports each outbound connection:

| Start command | Listening after | `GET /healthz` | After `SIGTERM` | Outbound attempts | Key or cookie password in the log |
| --- | --- | --- | --- | --- | --- |
| `node dist/src/index.js`, the start command of the image, after `npm run build` | 0.7 s | `200`, `ok` | exit code 0 | 0 | no |
| `node --import tsx src/index.ts`, from source | 1.8 s | `200`, `ok` | exit code 0 | 2, from `tsx` itself | no |

Node cannot strip the types of the source (an `enum` in
`src/logs/system/system-logger.ts`), so the run from source needs `tsx`. `tsx`
alone also opens two local sockets when it loads, so the blocker counts two
attempts in that run. The server log had four lines: the WorkOS line with
`client_placeholder` and the issuer, the logging storage line,
`Listening on`, and `Stopping after SIGTERM`. On Render, each deploy of this
probe reached `live` with these variables.

### Checks before the writes

- `--dry-run` prints the calls of each step and exits with 0. With the network
  blocker preload, it makes no outbound attempt.
- A missing `--owner` stops the script with a usage message and exit code 2.
  Real mode without `RENDER_API_KEY` stops in the same way, with no outbound
  attempt. `--owner tea-d3mlbrvdiees73ca4rdg` and
  `--service-id srv-db8mnqg473hc739d529g` also stop with exit code 2 before
  any call.
- Real mode ran against a stand-in for the Render API: a module, not in the
  branch, that replaced `fetch` in the process. Its workspace also held a web
  service with the production ID and a private service with another name.
  These runs measure nothing about Render. They show that each assertion can
  fail, that the cleanup runs, and that the probe sent no call to the two
  other services in any case:

| Change in the stand-in | Result |
| --- | --- |
| None | Exit code 0. Each step passed. 9 writes, and no probe service remained. |
| The update answer shows the old plan. | `FAIL Plan change`. The cleanup deleted the service. Exit code 1. |
| The first deploy ends as `update_failed`. | `FAIL Create`. The cleanup deleted the service, also with `--keep`. |
| No field holds the internal address. | `FAIL Internal address`, with the slug, `url`, ports, and keys of `serviceDetails`. |
| Each deploy answers `202` with no body. | Pass: the probe found each deploy in the deploy list. |
| Render starts a deploy after the update. | Pass: the probe used that deploy and sent no deploy itself, 7 writes. |
| The workspace has no matching credential. | `FAIL Preflight` with "no registry credential with the ID or name", and no write. |
| `--service-id` names the private service with another name. | `FAIL Preflight`: "not a thermus-spike-* private service", and no write. |
| A service of an earlier run exists. | `FAIL Preflight` and `FAIL Cleanup`, with no write. |
| The create answers `429` with `Retry-After`. | `FAIL Create`; the write row shows `Retry-After`. The cleanup found no service. |
| The create gets no answer, but the service exists. | `FAIL Create`. The cleanup found the service by its name and deleted it. |
| The key is wrong. | `FAIL Preflight` with `401`, and no write. |
| `SIGINT` during the first deploy. | `FAIL Create: Stopped by SIGINT`. The cleanup deleted the service. Exit code 1. |

No output of these runs held the key or the word `Bearer`. The stand-in runs
and the local check used scripts in the session scratchpad, not in the branch.

### Development runs

The manager allowed reads after the key was in `.env.local`, and writes after
the credential existed. The development runs used one service,
`srv-dbg1imgn74is73bjamjg` (`thermus-spike-20261027-032408`), with
`--service-id` and `--keep`:

| Start (UTC) | Options | Writes | Result |
| --- | --- | --- | --- |
| 03:22:33 | `--preflight` | 0 | Pass. The credential resolved by name, and no probe service existed. |
| 03:24:08 | `--steps create,internal-address --keep` | 1 | Pass. The service was `live` 80.6 s after the create call. No field held `<host>:8080`, so the first version of the address check gave the address from `slug` and `openPorts`. |
| 03:26:25 | `--service-id … --steps internal-address --keep` | 0 | Pass. This run recorded `serviceDetails.url`: `thermus-spike-20261027-032408:10000`. The address check then changed to the rule of the Steps table. |
| 03:27:43 | `--service-id … --steps internal-address --keep` | 0 | Pass with the changed check. |
| 03:27:58 | `--service-id … --steps image-2 --keep` | 1 | Pass. The deploy was `live` 35.5 s after the call. |
| 03:29:06 | `--service-id … --steps plan-change --keep` | 4 | Pass. |
| 03:31:42 | `--service-id … --steps suspend-resume --keep` | 2 | Pass. |
| 03:32:40 | `--service-id … --steps internal-address` | 1 | Pass. The cleanup deleted the service, and the list held no probe service. |

After these runs, the plan step also gives the time from the deploy call,
because the time from the update includes the 30 s wait.

### Measured

Final complete run, on the owner's Mac (Darwin 27.0.0), with the script of
commit `22cff848`. The exit code was 0. The tables and the conclusions are as
the script printed them. The script printed these lines first:
"Node v24.20.0. Start 2026-10-27T03:33:30.712Z. Service thermus-spike-20261027-033330 (srv-dbg1n359fdbs73cgpgbg) in oregon, owner tea-db8i6ceq1p3s73dev9og." and "Times are seconds on the clock of this machine, from the start of the write that began each wait."

| Step | Check | Expected | Measured |
| --- | --- | --- | --- |
| Preflight | Workspace | the given owner | Thermus AI (team) |
| Preflight | Registry credential "ghcr-thermus-hosted-read" | one credential with this ID or name; registry GITHUB | ghcr-thermus-hosted-read (rgc-dbg1h0142hec73da9ra0), GITHUB |
| Preflight | Services named thermus-spike-* | none | none |
| Create | Create answer | 201 with the service and deployId | 201 after 2.8 s: srv-dbg1n359fdbs73cgpgbg, plan `0.5c-512mb`, runtime `image` |
| Create | First deploy | live; time recorded | live 75.8 s after the create call (update_in_progress > live); Render: createdAt 2026-10-27T03:33:33.995789Z, finishedAt 2026-10-27T03:34:42.618907Z, 68.6 s |
| Create | Image of the first deploy | image 1 | image 1 |
| Create | Variables (keys only) | PUBLIC_BASE_URL, WORKOS_API_KEY, WORKOS_AUTHKIT_ISSUER, WORKOS_CLIENT_ID, WORKOS_COOKIE_PASSWORD, WORKOS_REDIRECT_URI | PUBLIC_BASE_URL, WORKOS_API_KEY, WORKOS_AUTHKIT_ISSUER, WORKOS_CLIENT_ID, WORKOS_COOKIE_PASSWORD, WORKOS_REDIRECT_URI |
| Internal address | Field with <slug>:<port>, and the open port | one field; openPorts holds 8080 | thermus-spike-20261027-033330:10000 in service.serviceDetails.url; openPorts 8080 |
| Image 2 | Deploy with imageUrl | live | answer 201; live 36.1 s after the call (update_in_progress > live); Render: createdAt 2026-10-27T03:34:51.142811Z, finishedAt 2026-10-27T03:35:23.366531Z, 32.2 s |
| Image 2 | Image of the live deploy | image 2 | image 2 |
| Image 2 | Image setting of the service (imagePath) | not documented; recorded | image 2 |
| Plan 1c-2g | Update answer | plan 1c-2g | 200, plan `1c-2g`, after 0.1 s |
| Plan 1c-2g | Deploy that applies the plan | live | started by the probe, with image 2 (answer 201); live 58.5 s after the update and 30.4 s after the deploy call (update_in_progress > live); image 2 |
| Plan 1c-2g | Service after the deploy | plan 1c-2g | plan `1c-2g` |
| Plan 1c-2g | Container restarted | recorded; docs: the deploy starts a new instance | yes: new instance srv-dbg1n359fdbs73cgpgbg-7sfnj; the old instance is no longer listed |
| Plan 1c-2g | Event types since the update | recorded | deploy_ended (-0.3 s), plan_changed (+0.1 s), deploy_started (+32.0 s), deploy_ended (+53.8 s) |
| Plan 0.5c-512mb | Update answer | plan 0.5c-512mb | 200, plan `0.5c-512mb`, after 0.2 s |
| Plan 0.5c-512mb | Deploy that applies the plan | live | started by the probe, with image 2 (answer 201); live 56.2 s after the update and 29.9 s after the deploy call (update_in_progress > live); image 2 |
| Plan 0.5c-512mb | Service after the deploy | plan 0.5c-512mb | plan `0.5c-512mb` |
| Plan 0.5c-512mb | Container restarted | recorded; docs: the deploy starts a new instance | yes: new instance srv-dbg1n359fdbs73cgpgbg-hkzjk; the old instance is no longer listed |
| Plan 0.5c-512mb | Event types since the update | recorded | plan_changed (+0.1 s), deploy_started (+30.3 s), deploy_ended (+52.2 s) |
| Suspend | State after the suspend call | suspended | suspended 0.8 s after the call; suspenders user; instances listed: 0 |
| Resume | State after the resume call | not_suspended | not_suspended 0.9 s after the call |
| Resume | Deploy after the resume | live; time recorded | trigger `service_resumed`; live 16.6 s after the resume call (update_in_progress > live); image 2 |
| Resume | Event types since the suspend | recorded | service_suspended (+0.1 s), suspender_added (+0.1 s), service_resumed (+1.1 s), suspender_removed (+1.1 s), deploy_started (+2.0 s), deploy_ended (+13.9 s) |
| Cleanup | Delete srv-dbg1n359fdbs73cgpgbg | 204, or 404 when already gone | 204 after 0.4 s |
| Cleanup | Services named thermus-spike-* | 0 | 0, 0.1 s after the delete |

Writes in this run: 9. Reads: 75; the last read had Ratelimit-Limit 400, Ratelimit-Remaining 382, and Ratelimit-Reset 22.

| Step | Call | Status | Duration | Ratelimit-Limit | Ratelimit-Remaining | Ratelimit-Reset | Retry-After |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Create | `POST /services` | 201 | 2.78 s | 20 | 18 | 1588 | absent |
| Image 2 | `POST /services/srv-dbg1n359fdbs73cgpgbg/deploys` | 201 | 3.82 s | 10 | 9 | 12 | absent |
| Plan 1c-2g | `PATCH /services/srv-dbg1n359fdbs73cgpgbg` | 200 | 0.14 s | 10 | 9 | 36 | absent |
| Plan 1c-2g | `POST /services/srv-dbg1n359fdbs73cgpgbg/deploys` | 201 | 3.80 s | 10 | 8 | 8 | absent |
| Plan 0.5c-512mb | `PATCH /services/srv-dbg1n359fdbs73cgpgbg` | 200 | 0.18 s | 10 | 9 | 37 | absent |
| Plan 0.5c-512mb | `POST /services/srv-dbg1n359fdbs73cgpgbg/deploys` | 201 | 3.83 s | 10 | 8 | 10 | absent |
| Suspend | `POST /services/srv-dbg1n359fdbs73cgpgbg/suspend` | 202 | 0.64 s | 10 | 9 | 40 | absent |
| Resume | `POST /services/srv-dbg1n359fdbs73cgpgbg/resume` | 202 | 0.83 s | 10 | 8 | 39 | absent |
| Cleanup | `DELETE /services/srv-dbg1n359fdbs73cgpgbg` | 204 | 0.36 s | 100 | 99 | 22 | absent |

| Field | Answer | Value |
| --- | --- | --- |
| `service.id` | POST /services (201) | `srv-dbg1n359fdbs73cgpgbg` |
| `deployId` | POST /services (201) | `dep-dbg1n3d9fdbs73cgpglg` |
| `service.slug` | POST /services (201) | `thermus-spike-20261027-033330` |
| `service.serviceDetails.plan` | POST /services (201) | `0.5c-512mb` |
| `service.serviceDetails.region` | POST /services (201) | `oregon` |
| `service.serviceDetails.runtime` | POST /services (201) | `image` |
| `service.imagePath` | POST /services (201) | `ghcr.io/tomer-mayara/thermus-hosted@sha256:ca1ab23d3bd8ea2397076a370939173eb2548e275f322c7749d460a28ec71d26` |
| `service.registryCredential.name` | POST /services (201) | `ghcr-thermus-hosted-read` |
| `service.suspended` | POST /services (201) | `not_suspended` |
| `deploy.trigger` | GET /services/{id}/deploys/{deployId} | `manual` |
| `deploy.image.ref` | GET /services/{id}/deploys/{deployId} | `ghcr.io/tomer-mayara/thermus-hosted@sha256:ca1ab23d3bd8ea2397076a370939173eb2548e275f322c7749d460a28ec71d26` |
| `deploy.image.sha` | GET /services/{id}/deploys/{deployId} | `sha256:ca1ab23d3bd8ea2397076a370939173eb2548e275f322c7749d460a28ec71d26` |
| `service.serviceDetails.openPorts[].port` | GET /services/{id} | 8080 |
| `service.serviceDetails.url` | GET /services/{id} | `thermus-spike-20261027-033330:10000` |
| `service.slug` | GET /services/{id} | `thermus-spike-20261027-033330` |
| `POST /services/{id}/deploys status` | create-deploy | 201, deploy in the body |
| `service.serviceDetails.plan` | PATCH /services/{id} (200) | 1c-2g, then 0.5c-512mb |
| `service.suspended, service.suspenders` | GET /services/{id} after the suspend | suspended; user |
| `deploy.trigger after a resume` | GET /services/{id}/deploys | `service_resumed` |

- PASS Preflight: the workspace Thermus AI (team) and the credential ghcr-thermus-hosted-read (rgc-dbg1h0142hec73da9ra0) exist, and no service of an earlier run exists.
- PASS Create: srv-dbg1n359fdbs73cgpgbg was created on 0.5c-512mb in oregon with 6 variables; its first deploy was live 75.8 s after the create call.
- PASS Internal address: the field service.serviceDetails.url holds the internal address thermus-spike-20261027-033330:10000; serviceDetails.openPorts holds port 8080, but the field names port 10000.
- PASS Image 2: the deploy of image 2 was live 36.1 s after the call, and the live deploy reports image 2; the image setting of the service shows image 2.
- PASS Plan change: to 1c-2g: the update answer showed 1c-2g; the deploy that applied it was started by the probe, with image 2 (answer 201) and was live 58.5 s after the update; container restarted: yes: new instance srv-dbg1n359fdbs73cgpgbg-7sfnj; the old instance is no longer listed. Back to 0.5c-512mb: the update answer showed 0.5c-512mb; the deploy that applied it was started by the probe, with image 2 (answer 201) and was live 56.2 s after the update; container restarted: yes: new instance srv-dbg1n359fdbs73cgpgbg-hkzjk; the old instance is no longer listed.
- PASS Suspend and resume: the state was suspended 0.8 s after the call; the resume deploy (trigger `service_resumed`) was live 16.6 s after the resume call and runs image 2.
- PASS Cleanup: deleted srv-dbg1n359fdbs73cgpgbg; no service named thermus-spike-* exists.

A preflight at 03:38:22 UTC, with reads only, listed no service named
`thermus-spike-*`.

Manager verification run, 27 October 2026 at 03:52 UTC, with the script of
commit `a4e861a3` (the same real-mode code): exit code 0, 9 writes, 75 reads;
service `srv-dbg1vqt9fdbs73chii70`; first deploy `live` 81.6 s after the
create call; image 2 deploy `live` 30.6 s after the call; plan `1c-2g`
applied by a deploy `live` 19.8 s after the deploy call, back to
`0.5c-512mb` in 40.9 s, each with a new instance; suspended after 0.7 s;
resume deploy `live` 17.0 s after the resume call; delete `204` in 0.5 s; no
service named `thermus-spike-*` left. The full tables are in the Validation
comment of pull request #270.

### Findings for Slice 2

The values come from the final run and the development runs. Where two
values are given, the first is from the final run.

- Internal address. `serviceDetails.url` holds `<slug>:10000`, for example
  `thermus-spike-20261027-033330:10000`. In both services, `slug` was the
  service name, with no random part. `serviceDetails.openPorts` holds 8080,
  the port of the server. From outside the private network, the probe cannot
  tell which port reaches the server. SO-01d part two must request `/healthz`
  on both ports. It did: port 8080 answered `200` with `ok`, and port 10000
  refused the connection ([part two](#part-two-findings-for-slice-2)). The
  provisioner stores the address that SO-01d part two confirms, in the
  `internal_url` column.
- Create. The answer was `201` after 2.8 and 3.0 s. The first deploy was
  `live` 75.8 and 80.6 s after the create call; the Render times of the
  deploy give 68.6 and 74.3 s. The first deploy has the trigger `manual`, and
  its `image.sha` is the digest of image 1. The statuses seen were
  `update_in_progress` and then `live`.
- Image deploy. `POST /services/{id}/deploys` with `imageUrl` answered `201`
  with the deploy in the body. The deploy was `live` 36.1 and 35.5 s after the
  call. Then `imagePath` showed image 2: the API deploy changes the image
  setting. A fleet upgrade by `imageUrl` therefore also sets the image of
  later Render deploys. The resume deploy ran image 2.
- Plan change. Each `PATCH` answered `200` in 0.1 to 0.2 s and showed the new
  plan at once. In each of four updates, Render started no deploy in the 30 s
  after it. The deploy of the probe applied the plan: `live` 30.4 and 29.9 s
  after the deploy call in the final run. Each deploy replaced the instance:
  a new instance ID, such as `srv-dbg1n359fdbs73cgpgbg-7sfnj`, and the old
  instance was not in the list when the deploy was `live`. The events were
  `plan_changed` at the update, then `deploy_started` and `deploy_ended`.
  Section 4.2 of the plan says that the service update restarts the container
  once. It does not: the provisioner must follow each plan update with a
  deploy, and that deploy replaces the container. The runs sent no tool call
  during the switch.
- Suspend and resume. Suspend answered `202`. The service was `suspended`
  after 0.8 and 0.7 s, with the suspender `user`, and the instance list was
  empty. Resume answered `202`, and the service was `not_suspended` after 0.9
  and 2.2 s. A new deploy with the trigger `service_resumed` was `live` 16.6
  and 28.6 s after the resume call. The events were `service_suspended`,
  `suspender_added`, `service_resumed`, `suspender_removed`, `deploy_started`,
  and `deploy_ended`. The `Retry-After: 60` of the gateway in section 4.2 of
  the plan covers these times.
- Delete. `DELETE` answered `204` in 0.4 s, and the service left the list at
  once: the next read, 0.1 s later, did not list it.
- Rate limits, from the headers of each write:

  | Calls | `Ratelimit-Limit` | `Ratelimit-Remaining` | `Ratelimit-Reset` | Reading |
  | --- | --- | --- | --- | --- |
  | `POST /services` | 20 | 19, then 18 | 2151, then 1588 | 20 creates an hour for each user, as the reference page says |
  | `PATCH`, deploys, suspend, resume | 10 | 9 or 8 | 1 to 57 | 10 a minute for each service, as the reference page says |
  | `DELETE /services/{id}` | 100 | 99 | 18 to 22 | a bucket of 100; the reference page says 30 a minute for other writes |
  | `GET` | 400 | 382 to 397 | 22 to 49 | 400 a minute, as the reference page says |

  `Ratelimit-Reset` is in seconds until the window resets. The credential
  create of the manager also answered `Ratelimit-Remaining 99`. Section 3.2 of
  the plan says 20 an hour for creates, modifies, suspends, and resumes
  together, and 20 deploys an hour for each service. The headers show 20 an
  hour for creates only. Modifies, deploys, suspends, and resumes have 10 a
  minute for each service. The probe made 18 writes on 27 October 2026,
  2 of them creates. The 20 creates an hour are shared with each other create
  call of the same Render user.
- IDs. Services start with `srv-`, deploys with `dep-`, and registry
  credentials with `rgc-`. An instance ID is the service ID with a suffix of
  five characters.

### Documentation facts

From the pages above, with what the runs showed:

- Plans. The API calls the plans `0.5c-512mb` and `1c-2g`; the legacy names
  `starter` and `standard` stay valid. A new private service gets
  `0.5c-512mb` when the create call names no plan. Each answer of the runs
  used the new names.
- Plan change. The update endpoint does not start a deploy, and the plan
  changes at the first successful deploy after the update. A service without
  a disk redeploys with zero downtime: a new instance starts, gets the
  traffic, and the old instance gets `SIGTERM` 60 seconds later. The runs
  showed this: Render started no deploy in the 30 s after an update, and the
  deploy of the probe replaced the instance.
- Deploy with `imageUrl`. The answer is `201` with the deploy or `202` with no
  body; the runs got `201`. For a deploy hook with `imgURL`, the image page
  says that later deploys keep the image of the service settings. The API
  deploy with `imageUrl` changed `imagePath` of the service in the runs.
- Internal address. The Private Network page shows the service address of a
  private service, such as `elasticsearch-2j3e:9200`, and documents port
  10000 only for web services. The API reference names no field for it.
- Suspend and resume. Both answer `202` with no body. The service field
  `suspended` is `suspended` or `not_suspended`.
- Rate limits, from the
  [Rate Limiting](https://api-docs.render.com/reference/rate-limiting) page,
  updated on 27 October 2025: `POST /v1/services` 20 an hour for each user;
  `PATCH /v1/services`, deploys, resumes, suspends, and deploy hooks 10 a
  minute for each service; other `POST`, `PATCH`, and `DELETE` calls 30 a
  minute; other `GET` calls 400 a minute. The headers of the runs match this
  page, except for the other writes (see the findings).
- Rate-limit headers. The example of that page shows `Ratelimit-Limit`,
  `Ratelimit-Remaining`, and `Ratelimit-Reset`. Its table writes `Rate-Limit`
  and says that `Ratelimit-Reset` is a time in UTC epoch seconds. The OpenAPI
  `429` answer says "seconds until the current rate limit window resets". The
  runs got seconds, for example `24` on a read and `2151` on the create.
- Lists use cursors, with at most 100 items in a page. The event list reads
  the last hour by default. The unit of its `startTime` is not clear, so the
  probe uses the default and filters by time itself.

### Limits

- The probe runs outside the private network, so it cannot call `/healthz` of
  the service. The `live` state of the deploy is the only start signal. SO-01d
  part two checks the internal address, and which of the ports 10000 and 8080
  reaches the server, from inside the network.
- The probe deletes its service at the end. SO-01d part two needs a live
  private service for some minutes: a run with `--steps create --keep` gives
  one, and a later run with `--service-id` and without `--keep` deletes it.
- One run, one region, and one instance. No call reaches the service during a
  plan change, so the probe does not show whether a call fails during the
  switch.
- After the image 2 deploy, `imagePath` showed image 2. So the resume deploy
  of image 2 does not show which of the two Render uses on a resume: the
  image setting or the last deployed image.

## SO-01e: capacity and memory

Date: 27 October 2026 (UTC). Branch `self-ob-s1-so-01e-capacity-probe-7e8c5c`.

Status: the probe is complete. Run A measured the free instance `0.5c-512mb`
and run B the team instance `1c-2g`, each with 9 windows and its full cleanup.
A dedicated repeat settled the one window with `HTTP 502`. After the runs, a
reads-only preflight listed no `thermus-spike-*` service, and no WorkOS fixture
of a run remained. The [measured runs](#measured-runs) and the
[recommendation for D-15](#recommendation-for-d-15) are below.

Until the owner fixed the WorkOS Staging launcher on 27 October 2026, the
WorkOS steps waited: `~/.config/thermus/with-workos-staging.cjs` accepted only
the `3-headed-monkey/Thermus` origins, not the new origin of the repository.

### What the probe does

[`capacity-probe.ts`](../../script/spike/capacity-probe.ts) runs a preflight
that only reads, and then four steps and the cleanup. Each step is an
assertion of the script. The helper modules are in
[`capacity-probe/`](../../script/spike/capacity-probe/). In the workspace
Thermus AI, the probe makes two web services, or reuses them with
`--service-id` and `--pages-id`:

- The tenant service, `thermus-spike-cap-<UTC start time>`, from the hosted
  image of SO-01b with the registry credential, on `0.5c-512mb` with one
  instance, and later on `1c-2g`.
- The pages origin, `thermus-spike-pages-<UTC start time>`, that serves the
  controlled pages of the RHD-05 protocol.

Then the probe registers `https://<tenant host>/mcp` as an OAuth resource of the
WorkOS Staging environment, makes the hosted-live fixtures, and gets a Connect
token. It sends 1, 5, and 10 MCP calls at the same time for each workload, and
it reads the Render metrics and events of each window.

The probe reuses the Render client, the calls, the waits, the polls, the plan
change, and the answers of SO-01c, and the web service create, the public
check, and the requests from this machine of SO-01d part two. For this reuse,
the shared modules changed in small ways:

- The create call takes its variables and a Docker command. For a public
  image, it needs no registry credential. A new call updates one variable.
- The client also refuses a `/metrics/*` read that names no service of the run
  in its `resource` parameters. Without a `resource` parameter, Render reads
  each service of the owner, also the production service.
- The waits take one service session, and the deploy takes any image. The plan
  change of SO-01c is exported with the image of its deploy.
- Three probes now have the same code for some parts, so they share it (DRY3):
  the step runner, the signal handling, the exit codes, and the run token in
  [`runner.ts`](../../script/spike/render-tenant-lifecycle/runner.ts); and the
  service create, the variable keys, the Render times of a deploy, the services
  of a run, and the wait until they leave the list in
  [`create.ts`](../../script/spike/render-tenant-lifecycle/create.ts).

The SO-01c and SO-01d part two dry runs printed the same output, byte for byte,
before and after these changes, for eight option sets.

Run it from the repository root, through the WorkOS Staging launcher:

```sh
node ~/.config/thermus/with-workos-staging.cjs node --env-file=/Users/tomermayara/git/Thermus/.env.local \
  script/spike/capacity-probe.ts --owner tea-db8i6ceq1p3s73dev9og --registry-credential ghcr-thermus-hosted-read \
  --image ghcr.io/tomer-mayara/thermus-hosted@sha256:d6b8a8fd3174c02984267f6aef54a7ee4e4bc783776ae9b856685202972dbfbd
```

Options:

- `--owner`, `--registry-credential`, `--image`, `--region`, `--dry-run`, and
  `--preflight`: as in SO-01c.
- `--service-id` and `--pages-id`: use a live tenant service and a live pages
  origin. The preflight must find each one in the service list. Its name must
  start with `thermus-spike-cap-` or `thermus-spike-pages-`.
- `--steps`: run only some of `setup`, `calls-free`, `plan-team`, and
  `calls-team`, in this order. The three later steps need `setup`, because
  setup checks the services and gets the token. The cleanup always runs last.
  `--steps cleanup` alone runs only the preflight and the cleanup.
- `--keep`: keep both services and the OAuth resource for a later run. The
  WorkOS fixtures of the run are always deleted.
- `--parallelism`: the numbers of calls at the same time, from 1 to 20. The
  default is `1,5,10`.
- `--workloads`: any of `page9m`, `js`, and `search`. The default is all three.

Rules of the script, in addition to the rules of SO-01c:

- Real mode needs `RENDER_API_KEY`, `WORKOS_API_KEY`, `WORKOS_CLIENT_ID`, and
  `WORKOS_AUTHKIT_ISSUER` in the environment. The WorkOS key must start with
  `sk_test_`, and the client and the issuer must be those of the WorkOS Staging
  environment. Each other value stops the script with exit code 2 before any
  call. No message holds a value.
- No output holds a key, a token, or a variable value. The dry run shows each
  secret value as `<set>`. The report gives the lifetime and the claims checks
  of the token, not the token.
- The OAuth resource. The setup reads the resource list. When the tenant URI is
  not listed, it sends one `POST`, which adds one indicator and changes no
  other. After the create, the list must still hold the live gate URI
  `https://localhost:46443/mcp`. The cleanup deletes only an ID that this run
  created, and not with `--keep`. It never deletes the live gate URI.
- The fixtures. The organization, the user, and the Connect application have
  the run ID `so01e-<UTC start time>` in their names and email. The probe does
  not delete stale fixtures of other runs. The cleanup deletes the fixtures of
  the run and then checks that none remains. The WorkOS lists can show a
  deleted fixture for a short time, so the check reads them again, every 5 s,
  at most 12 times.
- Exit code 0: each step and the cleanup passed. Exit code 1: a step or the
  cleanup failed. Exit code 2: a usage error.

### The pages origin

The pages origin is an image-backed web service from the public image
`docker.io/library/node@sha256:2dd9a4f758e173b65fee15388f7706af6fb01ef50cf7a2c0538711d67a6981ae`.
This is the linux/amd64 manifest of `node:24-slim`, version 24-bookworm-slim,
created on 21 October 2026. Its index is
`sha256:55fb5f5a527ea2c5c4a95f963e48ef90aa38c7b346054fdc8ee9957a2b55d205`.
The Docker command of the service is `node -e '<program>'`, 2,108 characters.
The program builds both pages in memory at its start, and it serves them with
`/healthz`, `content-length`, and `cache-control: no-store`. The program has no
single quote, backslash, dollar sign, or backtick, so a shell and a
shell-style word split give the same arguments, as for the SO-01d part two job.
The source is [`pages.ts`](../../script/spike/capacity-probe/pages.ts).

Reason for this form: it needs no repository change, no registry credential,
and no GitHub access for Render. A Render static site needs the branch on
GitHub and the GitHub app of Render. The Render documentation says that the
Docker command replaces the `CMD` of the image
([Docker on Render](https://render.com/docs/docker)). The `node:24-slim` entry
point runs that command.

The pages hold generated words only, no real content:

| Page | Path | Bytes | Marker | Marker in the raw HTML |
| --- | --- | --- | --- | --- |
| Near-limit page: a short body, then 9 MiB (9,437,184 bytes) of inert JSON hydration input in a `script type=application/json` tag | `/page9m` | 9,437,483 | "Near-limit page marker 7319" | yes |
| Representative JavaScript page: generated paragraphs; a script adds the marker paragraph with `String.fromCharCode` | `/js` | 14,845 | "JavaScript page marker 2741" | no |

Local check of the pages, 27 October 2026, on the owner's Mac. The check ran
the Docker command through `/bin/sh -c` on a loopback port, rendered each page
with the pinned Lightpanda 1.0.0 (without the private network block of the
fetcher), and cleaned the rendered HTML with the pipeline of the hosted fetch
tool: the ad cleaner with `docker/hosted-ad-rules.txt`, the prompt injection
sanitizer, and Defuddle.

| Page | Served | Lightpanda | Rendered HTML | Cleaning | Markdown |
| --- | --- | --- | --- | --- | --- |
| `/page9m` | 200, 9,437,483 bytes | 2.7 s | 9,437,492 bytes, marker present | 2.6 s; the Node RSS grew from 208 MiB to 616 MiB | 74 characters with the marker (RHD-05: 73) |
| `/js` | 200, 14,845 bytes, marker absent | 0.15 s | 14,884 bytes, marker present: the script ran | 58 ms | 13,698 characters with the marker |

On Render, 27 October 2026 at 05:52:51 UTC, a development driver (in the
session scratchpad, not in the branch) used the modules of the probe to create
the pages origin and check it:

| Step | Check | Expected | Measured |
| --- | --- | --- | --- |
| Pages origin | Create answer | 201 with the service and deployId | 201 after 1.9 s: srv-dbg3od0m7kps73bafuvg, `web_service`, plan `0.5c-512mb` |
| Pages origin | First deploy | live; time recorded | live 17.7 s after the create call (update_in_progress > live); Render: createdAt 2026-10-27T05:52:53.338584Z, finishedAt 2026-10-27T05:53:06.286376Z, 12.9 s |
| Pages origin | Public URL | https://<name>.onrender.com in serviceDetails.url | `https://thermus-spike-pages-20261027-055251.onrender.com` |
| Pages origin | GET https://thermus-spike-pages-20261027-055251.onrender.com/healthz from this machine | 200 with body ok | 200, body "ok", after 137 ms; request 2 of at most 24, 5.7 s after the first |
| Pages origin | GET https://thermus-spike-pages-20261027-055251.onrender.com/page9m from this machine | 200, 9437483 bytes, marker in the HTML | 200, 9437483 bytes, marker in the HTML, after 0.4 s |
| Pages origin | GET https://thermus-spike-pages-20261027-055251.onrender.com/js from this machine | 200, 14845 bytes, marker not in the HTML | 200, 14845 bytes, marker not in the HTML, after 0.1 s |

The create had `Ratelimit-Limit 20`, `Ratelimit-Remaining 14`, and
`Ratelimit-Reset 428`. The setup run, the development runs, and run A used
this pages origin `srv-dbg3od0m7kps73bafuvg` with `--pages-id`, and the cleanup
of run A deleted it. Run B and the repeat made their own pages origins.

### The tenant service

The create call has every variable that the hosted image does not set itself:

| Variable | Value | Reason |
| --- | --- | --- |
| `PUBLIC_BASE_URL` | `https://thermus-spike-cap-<time>.onrender.com/`, from the name | The server takes its MCP resource from it: `new URL('mcp', base)` ([`deployment-config.ts`](../../src/runtime/config/deployment-config.ts)). Each Connect token must have that resource as its audience ([`workos-auth-provider.ts`](../../src/accounts/providers/workos/workos-auth-provider.ts)). |
| `WORKOS_API_KEY`, `WORKOS_CLIENT_ID`, `WORKOS_AUTHKIT_ISSUER` | the WorkOS Staging values from the environment; the key shown as `<set>` | The server checks each membership with WorkOS on each call. |
| `WORKOS_REDIRECT_URI` | `<PUBLIC_BASE_URL>callback` | It must be inside `PUBLIC_BASE_URL`. |
| `WORKOS_COOKIE_PASSWORD` | 43 random characters, new for each create; shown as `<set>` | At least 32 characters. |
| `OPERATION_CAPACITY` | `10` | D-15. |

The setup reads `serviceDetails.url` and `PUBLIC_BASE_URL`. When
`PUBLIC_BASE_URL` does not name the public URL of the service, the probe
updates `PUBLIC_BASE_URL` and `WORKOS_REDIRECT_URI` and deploys. In SO-01d part
two, the web service got the host `<name>.onrender.com`. A reused tenant
service that is on `1c-2g` goes back to `0.5c-512mb` with the plan change of
SO-01c.

The Connect token. The probe uses an automated browser, as the hosted-live
fixtures do; no person signs in. The browser is a headless Chromium of
Playwright through `LiveBrowser`, and `visitAuthKit` fills the AuthKit email,
password, and consent pages. The authorization URL is the one of
`connectAuthorizationRequest` (PKCE S256, state, the scope of the live gate,
and the redirect URI of the OAuth application fixture), with the tenant
resource in place of the live gate resource. The code exchange is
`exchangeConnectCode` with the tenant resource. The probe refreshes the token
through `refreshAuthorization` of the MCP SDK when less than 2 minutes are
left: an earlier run measured a lifetime of 300 s. The browser flow needs
password sign-in without MFA in WorkOS Staging, as the hosted live gate needs.
If AuthKit asks for MFA, the driver stops with its message.

### Steps

| Step | Given, when, then |
| --- | --- |
| Preflight | Given the inputs, when the probe reads the workspace, its registry credentials, its services of every type, and the WorkOS Staging resources, then the credential exists, no other `thermus-spike-*` service exists, and the live gate URI is listed. |
| Setup | Given the inputs, when the probe makes or reuses the pages origin and the tenant service on `0.5c-512mb`, registers the tenant resource, and gets a Connect token, then both pages answer with their sizes and markers, `/healthz` answers `200` with `ok`, and `tools/list` names `getURLAsMarkdown` and `search`. |
| Calls on `0.5c-512mb` | Given the tenant service on `0.5c-512mb`, when the probe sends 1, 5, and 10 calls at the same time for the 9 MiB page, the JavaScript page, and the search, then each call has its outcome and duration, and each window has its memory peak, memory limit, CPU peak, instance count, kills, and restart time. |
| Plan `1c-2g` | Given the tenant service, when the probe updates the plan to `1c-2g` and deploys, then the service shows `1c-2g`, a new instance replaced the old one, and `/healthz` answers `200` with `ok`. |
| Calls on `1c-2g` | The calls step again, on `1c-2g`. |
| Cleanup | Given any step, when the probe fails or ends, then it deletes the WorkOS fixtures of the run, and, unless `--keep`, the OAuth resource that this run created and the two services; no service of this run remains in the list. |

A window. The clients connect first, one client for each call, pinned to
protocol 2026-07-28. Then all tool calls leave at the same time. Each call has
5 minutes, because the cleaning of a 9 MiB page has no time limit of its own.
The outcome of a call is one of these:

- `ok`: the result has the marker. For a search, the marker is a result link.
- `ok, no marker`.
- `busy`: the tool error "Server busy. Try again later.".
- `error: <text>`: another tool error. The texts are the fixed public texts of
  the [fetch tool](../reference/mcp-fetch-tool.md#public-fetch-failures) and
  the [search tool](../reference/mcp-search-tool.md#results-and-failures).
- A transport failure: `HTTP <status>`, `network <code>`, `client timeout`, or
  `connect <failure>`.

After the calls, the probe waits for the final metrics of the window. Then it
reads the memory peak, the memory limit, the CPU peak, the instance count, and
the events since the window start. A `server_failed` event is a kill. After a
kill or a transport failure, the probe waits until `/healthz` answers again,
and the restart time counts from the event or from the window end. The next
window starts at least two buckets (60 s) after the end of the window before
it.

After the last window of a calls step, the probe waits until 120 s after its
end. Then it reads the events of the step again and counts the kills of each
window again. It also records the instance IDs at the step start and after the
last window: a new ID is a new instance.

### Planned calls

The Render calls of SO-01c and SO-01d part two keep their documentation pages
(see those sections). The new calls:

| Step | Method | Path or URL | Documentation page |
| --- | --- | --- | --- |
| Setup | `POST` | `/services` with `envSpecificDetails.dockerCommand` and no `registryCredentialId` | [Create service](https://api-docs.render.com/reference/create-service), [Deploy a Prebuilt Docker Image](https://render.com/docs/deploying-an-image), [Docker on Render](https://render.com/docs/docker), [Web Services](https://render.com/docs/web-services) |
| Setup | `GET` | `/services/{serviceId}/env-vars/PUBLIC_BASE_URL` | [Retrieve environment variable](https://api-docs.render.com/reference/retrieve-env-var) |
| Setup, only when the host differs | `PUT` | `/services/{serviceId}/env-vars/{key}` | [Add or update environment variable](https://api-docs.render.com/reference/update-env-var) |
| Calls | `GET` | `/metrics/memory`, `/metrics/memory-limit`, `/metrics/cpu` with `aggregationMethod=MAX`, `/metrics/instance-count`, each with `resource`, `startTime`, `endTime`, and `resolutionSeconds=30` | [Get memory usage](https://api-docs.render.com/reference/get-memory), [Get memory limit](https://api-docs.render.com/reference/get-memory-limit), [Get CPU usage](https://api-docs.render.com/reference/get-cpu), [Get instance count](https://api-docs.render.com/reference/get-instance-count) |
| Calls | `GET` | `/services/{serviceId}/events?limit=100` | [List events](https://api-docs.render.com/reference/list-events) |
| Preflight, Setup, Cleanup | `GET`, `POST`, `DELETE` | `https://api.workos.com/user_management/authkit_oauth_resources` | [MCP resource indicator](https://workos.com/docs/reference/authkit/oauth-resource), [Model Context Protocol](https://workos.com/docs/authkit/mcp) |
| Setup | SDK | create organization, user, organization membership, Connect application | [Create an organization](https://workos.com/docs/reference/organization/create), [Create a user](https://workos.com/docs/reference/authkit/user/create), [Create an organization membership](https://workos.com/docs/reference/authkit/organization-membership/create), [Create a Connect application](https://workos.com/docs/reference/workos-connect/applications/create) |
| Setup, Calls | `POST` | `https://<tenant host>/mcp`: initialize, `tools/list`, `tools/call` | [MCP fetch tool](../reference/mcp-fetch-tool.md), [MCP search tool](../reference/mcp-search-tool.md) |

### Metrics facts, measured on the pages origin

The manager allowed reads and writes on Render on 27 October 2026. Until the
launcher works, the pages origin stands in for the tenant service in the
metrics and event reads. All reads were from this machine, on 27 October 2026
between 05:53 and 06:30 UTC.

- Resolution. `resolutionSeconds` 1, 10, and 15 got `400` with
  "resolutionSeconds must be >= 30". 30, 60, and 90 got `200`. At 30, the
  points were 30 s apart. The smallest resolution is 30 s, as the OpenAPI
  minimum says.
- Time form. `startTime=1793078696` (epoch seconds) got `400` with "invalid
  filter parameter: could not parse input 1793078696 for field startTime".
  ISO 8601 got `200`. The OpenAPI document says "Epoch/Unix timestamp" in the
  description, but its schema is a `date-time` string. The probe sends ISO
  8601.
- Point placement. Render places the points of a read at start + k × 30 s. A
  read that ends now gives a point at now, which can still change. Reads of
  the same minutes with starts 10 and 20 s later gave other points: the read
  with the start 20 s later showed the memory step from 31.9 MB to 42.3 MB 10 s
  before the aligned read showed it. For each window, the probe therefore reads
  a fixed range and takes the peak of three reads with starts 0, 10, and 20 s
  later. A shift gave the same CPU values.
- Series and units. Memory: one series with the labels `instance`,
  `resource`, and `service`, unit `bytes`. Memory limit: unit `bytes`,
  536,870,900 for `0.5c-512mb`. CPU with `aggregationMethod=MAX`: one series
  without labels, unit `cpu`. Instance count: label `resource`, unit
  `unitless`. For the new service, the memory limit and instance count series
  came about 2.5 minutes after the create; memory and CPU came earlier.
- Lag. The probe calls the values of a window final when three reads, 10 s
  apart, after the window range ends, give the same values. In six rehearsal
  windows, the final values came 23.4 to 62.1 s after the window end. Up to
  32 s of this is the wait for the bucket of the window end to close.
- Rate limit. The metrics reads answered `Ratelimit-Limit 30` with a reset of
  under 60 s; other reads answered 400. The probe reads one range until the
  values are final, and the shifted ranges only once at the end: 67 reads for
  six windows.
- Events. The create of the pages origin gave `deploy_started` (+2.2 s) and
  `deploy_ended` (+14.9 s). A `server_failed` event has `instanceID` and a
  `reason` object with `oomKilled.memoryLimit`, `nonZeroExit`, `earlyExit`,
  `evicted`, and other keys (OpenAPI document). The report keeps the reason
  keys, the memory limit, and the exit code only.

### Rehearsal of the calls step

A development script (in the session scratchpad, not in the branch) ran the
calls step of the probe against a local stand-in MCP server. The stand-in had
the two tool names, a capacity of 3, and canned Markdown with the page
markers. It answered `HTTP 502` to every 7th `tools/call` request, and for 12 s
it closed its listener with each connection. The pages origin gave the page
URLs, and its service ID stood in for the tenant service in the metrics and
event reads. These runs measure nothing about the tenant. They show that the
windows, the outcome classes, the metrics reads, the recovery, and the report
work:

| Parallelism | Workload | Outcomes | Restart | Metrics lag |
| --- | --- | --- | --- | --- |
| 1 | page9m | 1 ok | none | 54.4 s (4 reads) |
| 1 | js | 1 ok | none | 37.0 s (4 reads) |
| 1 | search | 1 ok | none | 35.4 s (4 reads) |
| 5 | page9m | 3 ok, 1 HTTP 502, 1 busy | /healthz 200 0.0 s after the window end | 23.7 s (3 reads) |
| 5 | js | 4 network UND_ERR_SOCKET, 1 network ECONNRESET | /healthz 200 15.0 s after the window end | 23.4 s (3 reads) |
| 5 | search | 3 ok, 1 HTTP 502, 1 busy | /healthz 200 0.0 s after the window end | 62.1 s (4 reads) |

The first rehearsal found two faults, which are now corrected. The restart time
held the metrics wait, so the health check now starts at the window end. The
settle reads used most of the metrics rate limit, so the shifted reads now come
once at the end.

### Checks before the writes

- `--dry-run` prints the calls of each step and exits with 0. With a network
  blocker preload, it makes no outbound attempt, and the output holds no secret.
- Each of these stops the script with exit code 2 before any call, with no
  outbound attempt: no `--owner`; `--owner tea-d3mlbrvdiees73ca4rdg`;
  `--service-id` or `--pages-id` with `srv-db8mnqg473hc739d529g`; one ID for
  both options; `--steps calls-free` without `setup`; `--steps cleanup` with
  `--keep`; `--parallelism 0,5`; an unknown workload; real mode without
  `RENDER_API_KEY`; without `WORKOS_API_KEY`; with a key that does not start
  with `sk_test_`; with another client; with another issuer.
- The SO-01c and SO-01d part two dry runs are the same as before, for eight
  option sets.
- `npm run typecheck`, `eslint` with the habit-hooks configuration on
  `script/spike`, and `knip` pass; knip gives only its two earlier hints.

### Measured runs

All times are UTC on 27 October 2026. Each run used the image
`ghcr.io/tomer-mayara/thermus-hosted@sha256:d6b8a8fd3174c02984267f6aef54a7ee4e4bc783776ae9b856685202972dbfbd`
in the region `oregon`. Each run had the `--owner`, `--registry-credential`,
and `--image` options of the command above. Each run started on the owner's
Mac (Darwin 27.0.0, Node 24.20.0) through the WorkOS Staging launcher. The
record uses run A, run B, and the repeat. Each of them ended with the full
cleanup, and reads-only checks of Render and WorkOS Staging came after them.

| Start | Run | Options or calls | Render writes | Result |
| --- | --- | --- | --- | --- |
| 05:52:51 | Development driver (scratchpad) | the probe modules: create the pages origin | 1 | Pass. `srv-dbg3od0m7kps73bafuvg` stayed for the later runs. |
| 12:58:21 | Preflight | `--preflight --pages-id srv-dbg3od0m7kps73bafuvg` | 0 | Pass. |
| 13:00:19 | Setup | `--pages-id srv-dbg3od0m7kps73bafuvg --steps setup --keep` | 1 | The setup passed. The tenant `srv-dbga0pp42hec73e1nrug` and its OAuth resource R1 `authkit_oauth_resource_01M5YQ8ME9NWTK3S2GZG83FX7E` stayed for the later runs. The cleanup failed its fixture check (see the findings). |
| 13:04:16 | Development 1 | `--service-id srv-dbga0pp42hec73e1nrug --pages-id srv-dbg3od0m7kps73bafuvg --steps setup,calls-free --parallelism 1 --workloads page9m --keep` | 0 | Pass. |
| 13:06:49 | Development 2 | the same, with `--workloads js,search` | 0 | Pass. |
| 13:11 | R1 delete, a one-off that the manager approved | `GET` of R1 by its ID: `404`, because WorkOS has no read of one resource. The list `GET` showed R1 with the URI that the setup recorded. `DELETE` of R1: `204`. | 0 | R1 deleted; the live gate URI still listed. |
| 13:11:28 | Run A, free plan | `--service-id srv-dbga0pp42hec73e1nrug --pages-id srv-dbg3od0m7kps73bafuvg --steps setup,calls-free` | 2 | Pass, with the full cleanup. |
| 13:25:21 | Preflight and fixture check | reads only | 0 | Pass: no `thermus-spike-*` service, and no fixture of a run. |
| 13:31:57 | Run B, attempt 1 | `--steps setup,plan-team,calls-team` | 2 | FAIL Setup: the new pages origin answered `/page9m` with `404` (see the findings). The cleanup deleted the pages origin `srv-dbgafjqjnfac73fo8g00`. |
| 13:33:45 | Run B, team plan | `--steps setup,plan-team,calls-team` | 6 | Pass, with the full cleanup. |
| 13:49:40 | Repeat of the `HTTP 502` window | `--steps setup,calls-free --parallelism 10 --workloads page9m` | 4 | Pass, with the full cleanup. |
| 13:54:57 | Final preflight and fixture check | reads only | 0 | Pass: no `thermus-spike-*` service, and no fixture of a run. |
| 14:05 | Fixture and resource check | reads only: the 18 fixture IDs of the six runs with WorkOS writes, and the resource list | 0 | Each fixture ID answers `404`, and the lists hold no fixture of a run. The resource list holds only the live gate URI and `https://localhost:24443/mcp` of the owner. |

#### Run A: `0.5c-512mb`

The script printed these lines first:

> Node v24.20.0. Start 2026-10-27T13:11:28.488Z. The tenant service thermus-spike-cap-20261027-130019 (srv-dbga0pp42hec73e1nrug) and pages origin thermus-spike-pages-20261027-055251 (srv-dbg3od0m7kps73bafuvg), in oregon, owner tea-db8i6ceq1p3s73dev9og.
>
> Image ghcr.io/tomer-mayara/thermus-hosted@sha256:d6b8a8fd3174c02984267f6aef54a7ee4e4bc783776ae9b856685202972dbfbd. Parallelism 1, 5, 10; workloads page9m, js, search.
>
> Connect token: lifetime 300 s, 2 refreshes. Times are seconds on the clock of this machine.

| Instance | Parallelism | Workload | Outcomes | Duration s, min / median / max | Result characters | Peak memory | Memory limit | CPU peak | Instances | Kills | Restart | Metrics lag | Events |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 0.5c-512mb | 1 | page9m | 1 error: Page fetch failed: Renderer readiness timed out | 20.7 / 20.7 / 20.7 | 47 | 170,631,170 bytes (163 MiB) | 536,870,900 bytes (512 MiB) | 0.3327 cpu | 1 unitless | 0 | none | 58.0 s (4 reads) | none |
| 0.5c-512mb | 1 | js | 1 ok | 1.0 / 1.0 / 1.0 | 13698 | 145,383,420 bytes (139 MiB) | 536,870,900 bytes (512 MiB) | 0.0004021 cpu | 1 unitless | 0 | none | 36.1 s (4 reads) | none |
| 0.5c-512mb | 1 | search | 1 ok | 4.2 / 4.2 / 4.2 | 6144 | 144,814,080 bytes (138 MiB) | 536,870,900 bytes (512 MiB) | 0.06109 cpu | 1 unitless | 0 | none | 61.0 s (4 reads) | none |
| 0.5c-512mb | 5 | page9m | 5 error: Page fetch failed: Renderer readiness timed out | 20.7 / 20.7 / 20.8 | 47 | 397,824,000 bytes (379 MiB) | 536,870,900 bytes (512 MiB) | 0.2857 cpu | 1 unitless | 0 | none | 46.4 s (4 reads) | none |
| 0.5c-512mb | 5 | js | 5 ok | 0.9 / 1.8 / 2.5 | 13698 | 145,645,570 bytes (139 MiB) | 536,870,900 bytes (512 MiB) | 0.05515 cpu | 1 unitless | 0 | none | 35.7 s (4 reads) | none |
| 0.5c-512mb | 5 | search | 5 ok | 7.3 / 11.2 / 14.9 | 6144 | 165,552,130 bytes (158 MiB) | 536,870,900 bytes (512 MiB) | 0.2473 cpu | 1 unitless | 0 | none | 49.8 s (4 reads) | none |
| 0.5c-512mb | 10 | page9m | 10 HTTP 502 | 2.3 / 2.4 / 2.5 | 0 | 165,552,130 bytes (158 MiB) | 536,870,900 bytes (512 MiB) | 0.0002588 cpu | 1 unitless | 0 | /healthz 200 15.8 s after the window end | 33.7 s (4 reads) | none |
| 0.5c-512mb | 10 | js | 10 ok | 1.9 / 3.4 / 5.0 | 13698 | 145,326,080 bytes (139 MiB) | 536,870,900 bytes (512 MiB) | 0.09398 cpu | 1 unitless | 0 | none | 57.9 s (4 reads) | none |
| 0.5c-512mb | 10 | search | 10 error: Search failed: HTTP 429 | 3.7 / 4.2 / 4.5 | 23 | 126,402,560 bytes (121 MiB) | 536,870,900 bytes (512 MiB) | 0.07394 cpu | 1 unitless | 0 | none | 62.4 s (4 reads) | none |

<details>
<summary>The other tables and the conclusions of run A, as the script printed them</summary>

| Step | Check | Expected | Measured |
| --- | --- | --- | --- |
| Preflight | Workspace | the given owner | Thermus AI (team) |
| Preflight | Registry credential "ghcr-thermus-hosted-read" | one credential with this ID or name; registry GITHUB | ghcr-thermus-hosted-read (rgc-dbg1h0142hec73da9ra0), GITHUB |
| Preflight | Services named thermus-spike-*, any type | only srv-dbga0pp42hec73e1nrug, srv-dbg3od0m7kps73bafuvg | thermus-spike-cap-20261027-130019 (srv-dbga0pp42hec73e1nrug), thermus-spike-pages-20261027-055251 (srv-dbg3od0m7kps73bafuvg) |
| Preflight | WorkOS Staging: GET /user_management/authkit_oauth_resources | 200; the live gate URI https://localhost:46443/mcp is listed | 200; 1 resources; the live gate URI is listed |
| Pages origin | Given service | not suspended; the last deploy is live | srv-dbg3od0m7kps73bafuvg: `not_suspended`, plan `0.5c-512mb`; last deploy dep-dbg3od8m7kps73bafve0 `live` |
| Pages origin | Public URL | https://<name>.onrender.com in serviceDetails.url | `https://thermus-spike-pages-20261027-055251.onrender.com` |
| Pages origin | GET https://thermus-spike-pages-20261027-055251.onrender.com/healthz from this machine | 200 with body ok | 200, body "ok", after 209 ms; request 1 of at most 24, 0.2 s after the first |
| Pages origin | GET https://thermus-spike-pages-20261027-055251.onrender.com/page9m from this machine | 200, 9437483 bytes, marker in the HTML | 200, 9437483 bytes, marker in the HTML, after 0.7 s |
| Pages origin | GET https://thermus-spike-pages-20261027-055251.onrender.com/js from this machine | 200, 14845 bytes, marker not in the HTML | 200, 14845 bytes, marker not in the HTML, after 0.1 s |
| Tenant service | Given service | not suspended; the last deploy is live | srv-dbga0pp42hec73e1nrug: `not_suspended`, plan `0.5c-512mb`; last deploy dep-dbga0q142hec73e1ntdg `live` |
| Tenant service | Public URL | https://<name>.onrender.com in serviceDetails.url | `https://thermus-spike-cap-20261027-130019.onrender.com` |
| Tenant service | Variables (keys only) | OPERATION_CAPACITY, PUBLIC_BASE_URL, WORKOS_API_KEY, WORKOS_AUTHKIT_ISSUER, WORKOS_CLIENT_ID, WORKOS_COOKIE_PASSWORD, WORKOS_REDIRECT_URI | OPERATION_CAPACITY, PUBLIC_BASE_URL, WORKOS_API_KEY, WORKOS_AUTHKIT_ISSUER, WORKOS_CLIENT_ID, WORKOS_COOKIE_PASSWORD, WORKOS_REDIRECT_URI |
| Tenant service | PUBLIC_BASE_URL | https://thermus-spike-cap-20261027-130019.onrender.com/, the public URL of the service | `https://thermus-spike-cap-20261027-130019.onrender.com/`; predicted from the name: the same |
| Tenant service | GET https://thermus-spike-cap-20261027-130019.onrender.com/healthz from this machine | 200 with body ok | 200, body "ok\n", after 193 ms; request 1 of at most 24, 0.2 s after the first |
| OAuth resource | GET /user_management/authkit_oauth_resources | the live gate URI is listed | 1 resources; the live gate URI is listed; https://thermus-spike-cap-20261027-130019.onrender.com/mcp is not listed |
| OAuth resource | POST /user_management/authkit_oauth_resources, then GET | https://thermus-spike-cap-20261027-130019.onrender.com/mcp added; the live gate URI still listed | 201 after 0.1 s: authkit_oauth_resource_01M5YQSH7W0ZBZ8KHQTE20N57W; 2 resources; the live gate URI is listed; https://thermus-spike-cap-20261027-130019.onrender.com/mcp is listed as authkit_oauth_resource_01M5YQSH7W0ZBZ8KHQTE20N57W |
| Identity | Fixtures of the run | organization, user with a membership, Connect application | org_01M5YQSHH5EC4KE051GBYTC4NQ, user_01M5YQSHZ1856ZNAWY1W16QTTW, connect_app_01M5YQSJJAAZ7EPEZAMZD541VA; names and email have the run ID so01e-20261027-131128 |
| Identity | Connect authorization in a headless browser | the callback has the code and the state | 9.2 s; AuthKit pages / > /password > /application-authorization > /application-authorization/success |
| Identity | Connect access token (claims only, never the token) | audience, organization, and user of the run; lifetime recorded | audience is the tenant resource; organization matches; user matches; lifetime 300 s; refresh token present |
| MCP | initialize and tools/list at https://thermus-spike-cap-20261027-130019.onrender.com/mcp | getURLAsMarkdown and search | protocol 2026-07-28; tools getURLAsMarkdown, search |
| Cleanup | WorkOS fixtures named with so01e-20261027-131128 | 0 after the deletes, within 12 reads 5 s apart | 0; 2 reads of the lists, 6.6 s after the deletes |
| Cleanup | OAuth resource | deleted when this run created it; the live gate URI untouched | deleted https://thermus-spike-cap-20261027-130019.onrender.com/mcp (authkit_oauth_resource_01M5YQSH7W0ZBZ8KHQTE20N57W): 204 |
| Cleanup | Delete the tenant service srv-dbga0pp42hec73e1nrug | 204, or 404 when already gone | 204 after 0.6 s |
| Cleanup | Delete the pages origin srv-dbg3od0m7kps73bafuvg | 204, or 404 when already gone | 204 after 0.5 s |
| Cleanup | Services of this run in the list | 0 | 0, 0.1 s after the deletes; other thermus-spike-* services: none |

**First killed parallelism**

- 0.5c-512mb: no window had a server_failed event; no call reported a killed renderer.

**Calls**

| Instance | Parallelism | Workload | Call | Outcome | Duration | Characters |
| --- | --- | --- | --- | --- | --- | --- |
| 0.5c-512mb | 1 | page9m | 1 | error: Page fetch failed: Renderer readiness timed out | 20.7 s | 47 |
| 0.5c-512mb | 1 | js | 1 | ok | 1.0 s | 13698 |
| 0.5c-512mb | 1 | search | 1 | ok | 4.2 s | 6144 |
| 0.5c-512mb | 5 | page9m | 1 | error: Page fetch failed: Renderer readiness timed out | 20.7 s | 47 |
| 0.5c-512mb | 5 | page9m | 2 | error: Page fetch failed: Renderer readiness timed out | 20.7 s | 47 |
| 0.5c-512mb | 5 | page9m | 3 | error: Page fetch failed: Renderer readiness timed out | 20.8 s | 47 |
| 0.5c-512mb | 5 | page9m | 4 | error: Page fetch failed: Renderer readiness timed out | 20.7 s | 47 |
| 0.5c-512mb | 5 | page9m | 5 | error: Page fetch failed: Renderer readiness timed out | 20.7 s | 47 |
| 0.5c-512mb | 5 | js | 1 | ok | 1.8 s | 13698 |
| 0.5c-512mb | 5 | js | 2 | ok | 0.9 s | 13698 |
| 0.5c-512mb | 5 | js | 3 | ok | 2.1 s | 13698 |
| 0.5c-512mb | 5 | js | 4 | ok | 2.5 s | 13698 |
| 0.5c-512mb | 5 | js | 5 | ok | 1.2 s | 13698 |
| 0.5c-512mb | 5 | search | 1 | ok | 7.3 s | 6144 |
| 0.5c-512mb | 5 | search | 2 | ok | 14.9 s | 6144 |
| 0.5c-512mb | 5 | search | 3 | ok | 13.1 s | 6144 |
| 0.5c-512mb | 5 | search | 4 | ok | 9.4 s | 6144 |
| 0.5c-512mb | 5 | search | 5 | ok | 11.2 s | 6144 |
| 0.5c-512mb | 10 | page9m | 1 | HTTP 502 | 2.4 s | 0 |
| 0.5c-512mb | 10 | page9m | 2 | HTTP 502 | 2.5 s | 0 |
| 0.5c-512mb | 10 | page9m | 3 | HTTP 502 | 2.4 s | 0 |
| 0.5c-512mb | 10 | page9m | 4 | HTTP 502 | 2.4 s | 0 |
| 0.5c-512mb | 10 | page9m | 5 | HTTP 502 | 2.3 s | 0 |
| 0.5c-512mb | 10 | page9m | 6 | HTTP 502 | 2.5 s | 0 |
| 0.5c-512mb | 10 | page9m | 7 | HTTP 502 | 2.3 s | 0 |
| 0.5c-512mb | 10 | page9m | 8 | HTTP 502 | 2.3 s | 0 |
| 0.5c-512mb | 10 | page9m | 9 | HTTP 502 | 2.4 s | 0 |
| 0.5c-512mb | 10 | page9m | 10 | HTTP 502 | 2.5 s | 0 |
| 0.5c-512mb | 10 | js | 1 | ok | 3.4 s | 13698 |
| 0.5c-512mb | 10 | js | 2 | ok | 2.3 s | 13698 |
| 0.5c-512mb | 10 | js | 3 | ok | 4.1 s | 13698 |
| 0.5c-512mb | 10 | js | 4 | ok | 1.9 s | 13698 |
| 0.5c-512mb | 10 | js | 5 | ok | 2.6 s | 13698 |
| 0.5c-512mb | 10 | js | 6 | ok | 5.0 s | 13698 |
| 0.5c-512mb | 10 | js | 7 | ok | 2.9 s | 13698 |
| 0.5c-512mb | 10 | js | 8 | ok | 4.5 s | 13698 |
| 0.5c-512mb | 10 | js | 9 | ok | 3.8 s | 13698 |
| 0.5c-512mb | 10 | js | 10 | ok | 4.3 s | 13698 |
| 0.5c-512mb | 10 | search | 1 | error: Search failed: HTTP 429 | 3.9 s | 23 |
| 0.5c-512mb | 10 | search | 2 | error: Search failed: HTTP 429 | 4.2 s | 23 |
| 0.5c-512mb | 10 | search | 3 | error: Search failed: HTTP 429 | 3.7 s | 23 |
| 0.5c-512mb | 10 | search | 4 | error: Search failed: HTTP 429 | 4.2 s | 23 |
| 0.5c-512mb | 10 | search | 5 | error: Search failed: HTTP 429 | 4.0 s | 23 |
| 0.5c-512mb | 10 | search | 6 | error: Search failed: HTTP 429 | 4.2 s | 23 |
| 0.5c-512mb | 10 | search | 7 | error: Search failed: HTTP 429 | 3.7 s | 23 |
| 0.5c-512mb | 10 | search | 8 | error: Search failed: HTTP 429 | 4.2 s | 23 |
| 0.5c-512mb | 10 | search | 9 | error: Search failed: HTTP 429 | 4.2 s | 23 |
| 0.5c-512mb | 10 | search | 10 | error: Search failed: HTTP 429 | 4.5 s | 23 |

**Render writes, durations, and rate-limit headers**

Writes in this run: 2. Reads: 112; the last read had Ratelimit-Limit 400, Ratelimit-Remaining 399, and Ratelimit-Reset 57.

| Step | Call | Status | Duration | Ratelimit-Limit | Ratelimit-Remaining | Ratelimit-Reset | Retry-After |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Cleanup | `DELETE /services/srv-dbga0pp42hec73e1nrug` | 204 | 0.64 s | 100 | 99 | 58 | absent |
| Cleanup | `DELETE /services/srv-dbg3od0m7kps73bafuvg` | 204 | 0.52 s | 100 | 98 | 57 | absent |

**WorkOS Staging writes**

| Step | Call | Result | Duration |
| --- | --- | --- | --- |
| OAuth resource | `POST /user_management/authkit_oauth_resources` | 201 | 0.15 s |
| Identity | `createOrganization` | done | 0.40 s |
| Identity | `createUser` | done | 0.48 s |
| Identity | `createOrganizationMembership (role user)` | done | 0.17 s |
| Identity | `connect.createApplication (OAuth, PKCE)` | done | 0.19 s |
| Cleanup | `DELETE /user_management/authkit_oauth_resources/authkit_oauth_resource_01M5YQSH7W0ZBZ8KHQTE20N57W` | 204 | 0.12 s |

**Conclusions**

- PASS Preflight: the workspace Thermus AI (team) and the credential ghcr-thermus-hosted-read (rgc-dbg1h0142hec73da9ra0) exist, the probe uses thermus-spike-cap-20261027-130019 (srv-dbga0pp42hec73e1nrug) and thermus-spike-pages-20261027-055251 (srv-dbg3od0m7kps73bafuvg), and the WorkOS Staging environment answers (1 WorkOS resources, the live gate URI listed).
- PASS Setup: pages origin: thermus-spike-pages-20261027-055251 (srv-dbg3od0m7kps73bafuvg) is the given service, live; https://thermus-spike-pages-20261027-055251.onrender.com/healthz answered 200 with ok, and /page9m (9437483 bytes) and /js (14845 bytes) answered 200 with the planned sizes and markers. Tenant: thermus-spike-cap-20261027-130019 (srv-dbga0pp42hec73e1nrug) is the given service, live; PUBLIC_BASE_URL names the public URL; plan: on 0.5c-512mb; https://thermus-spike-cap-20261027-130019.onrender.com/healthz answered 200 with ok. Resource: registered https://thermus-spike-cap-20261027-130019.onrender.com/mcp as authkit_oauth_resource_01M5YQSH7W0ZBZ8KHQTE20N57W; the live gate URI is still listed. Identity: the fixtures of so01e-20261027-131128 exist, and the Connect token for https://thermus-spike-cap-20261027-130019.onrender.com/mcp lasts 300 s. MCP protocol 2026-07-28 lists getURLAsMarkdown and search.
- PASS Calls on 0.5c-512mb: 9 windows on 0.5c-512mb; 0 server_failed events; no window was killed.
- PASS Cleanup: deleted the WorkOS fixtures of so01e-20261027-131128; deleted https://thermus-spike-cap-20261027-130019.onrender.com/mcp (authkit_oauth_resource_01M5YQSH7W0ZBZ8KHQTE20N57W): 204; deleted srv-dbga0pp42hec73e1nrug and srv-dbg3od0m7kps73bafuvg.

</details>

#### Run B: `1c-2g`

The script printed these lines first:

> Node v24.20.0. Start 2026-10-27T13:33:45.621Z. The tenant service thermus-spike-cap-20261027-133345 (srv-dbgagkt9el5s73ccktig) and pages origin thermus-spike-pages-20261027-133345 (srv-dbgaget9el5s73cckgf0), in oregon, owner tea-db8i6ceq1p3s73dev9og.
>
> Image ghcr.io/tomer-mayara/thermus-hosted@sha256:d6b8a8fd3174c02984267f6aef54a7ee4e4bc783776ae9b856685202972dbfbd. Parallelism 1, 5, 10; workloads page9m, js, search.
>
> Connect token: lifetime 300 s, 3 refreshes. Times are seconds on the clock of this machine.

| Instance | Parallelism | Workload | Outcomes | Duration s, min / median / max | Result characters | Peak memory | Memory limit | CPU peak | Instances | Kills | Restart | Metrics lag | Events |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1c-2g | 1 | page9m | 1 error: Page fetch failed: Renderer readiness timed out | 20.7 / 20.7 / 20.7 | 47 | 139,730,940 bytes (133 MiB) | 2,147,483,600 bytes (2048 MiB) | 0.3296 cpu | no point | 0 | none | 41.5 s (4 reads) | none |
| 1c-2g | 1 | js | 1 ok | 1.1 / 1.1 / 1.1 | 13698 | 190,578,690 bytes (182 MiB) | 536,870,900 bytes (512 MiB) | 0.004188 cpu | 1 unitless | 0 | none | 36.4 s (4 reads) | none |
| 1c-2g | 1 | search | 1 ok | 2.8 / 2.8 / 2.8 | 4996 | 212,398,080 bytes (203 MiB) | 2,147,483,600 bytes (2048 MiB) | 0.02643 cpu | 1 unitless | 0 | none | 32.4 s (4 reads) | none |
| 1c-2g | 5 | page9m | 5 error: Page fetch failed: Renderer readiness timed out | 20.6 / 20.6 / 20.7 | 47 | 389,406,720 bytes (371 MiB) | 2,147,483,600 bytes (2048 MiB) | 0.2011 cpu | 1 unitless | 0 | none | 40.8 s (4 reads) | none |
| 1c-2g | 5 | js | 5 ok | 0.9 / 1.2 / 1.6 | 13698 | 227,487,740 bytes (217 MiB) | 2,147,483,600 bytes (2048 MiB) | 0.4726 cpu | 1 unitless | 0 | none | 35.6 s (4 reads) | none |
| 1c-2g | 5 | search | 5 ok | 3.8 / 5.0 / 6.3 | 4996 | 241,750,020 bytes (231 MiB) | 2,147,483,600 bytes (2048 MiB) | 0.1935 cpu | 1 unitless | 0 | none | 57.2 s (4 reads) | none |
| 1c-2g | 10 | page9m | 10 error: Page fetch failed: Renderer readiness timed out | 20.5 / 20.5 / 20.7 | 47 | 743,059,460 bytes (709 MiB) | 2,147,483,600 bytes (2048 MiB) | 0.6817 cpu | 1 unitless | 0 | none | 46.9 s (4 reads) | none |
| 1c-2g | 10 | js | 10 ok | 0.9 / 1.4 / 1.7 | 13698 | 265,977,860 bytes (254 MiB) | 2,147,483,600 bytes (2048 MiB) | 0.0003874 cpu | 1 unitless | 0 | none | 35.1 s (4 reads) | none |
| 1c-2g | 10 | search | 4 error: Search failed: HTTP 429, 6 ok | 2.2 / 4.5 / 7.2 | 23, 4996 | 251,969,540 bytes (240 MiB) | 2,147,483,600 bytes (2048 MiB) | 0.2293 cpu | 1 unitless | 0 | none | 56.6 s (4 reads) | none |

<details>
<summary>The other tables and the conclusions of run B, as the script printed them</summary>

| Step | Check | Expected | Measured |
| --- | --- | --- | --- |
| Preflight | Workspace | the given owner | Thermus AI (team) |
| Preflight | Registry credential "ghcr-thermus-hosted-read" | one credential with this ID or name; registry GITHUB | ghcr-thermus-hosted-read (rgc-dbg1h0142hec73da9ra0), GITHUB |
| Preflight | Services named thermus-spike-*, any type | none | none |
| Preflight | WorkOS Staging: GET /user_management/authkit_oauth_resources | 200; the live gate URI https://localhost:46443/mcp is listed | 200; 2 resources; the live gate URI is listed |
| Pages origin | Create answer | 201 with the service and deployId | 201 after 1.9 s: srv-dbgaget9el5s73cckgf0, `web_service`, plan `0.5c-512mb` |
| Pages origin | First deploy | live; time recorded | live 17.5 s after the create call (update_in_progress > live); Render: createdAt 2026-10-27T13:33:48.02865Z, finishedAt 2026-10-27T13:34:00.546738Z, 12.5 s |
| Pages origin | Public URL | https://<name>.onrender.com in serviceDetails.url | `https://thermus-spike-pages-20261027-133345.onrender.com` |
| Pages origin | GET https://thermus-spike-pages-20261027-133345.onrender.com/healthz from this machine | 200 with body ok | 200, body "ok", after 217 ms; request 2 of at most 24, 5.4 s after the first |
| Pages origin | GET https://thermus-spike-pages-20261027-133345.onrender.com/page9m from this machine | 200, 9437483 bytes, marker in the HTML | 200, 9437483 bytes, marker in the HTML, after 0.2 s; request 1 of at most 6 |
| Pages origin | GET https://thermus-spike-pages-20261027-133345.onrender.com/js from this machine | 200, 14845 bytes, marker not in the HTML | 200, 14845 bytes, marker not in the HTML, after 0.1 s; request 1 of at most 6 |
| Tenant service | Create answer | 201 with the service and deployId | 201 after 3.1 s: srv-dbgagkt9el5s73ccktig, `web_service`, plan `0.5c-512mb` |
| Tenant service | First deploy | live; time recorded | live 71.3 s after the create call (update_in_progress > live); Render: createdAt 2026-10-27T13:34:12.558382Z, finishedAt 2026-10-27T13:35:20.685881Z, 68.1 s |
| Tenant service | Public URL | https://<name>.onrender.com in serviceDetails.url | `https://thermus-spike-cap-20261027-133345.onrender.com` |
| Tenant service | Variables (keys only) | OPERATION_CAPACITY, PUBLIC_BASE_URL, WORKOS_API_KEY, WORKOS_AUTHKIT_ISSUER, WORKOS_CLIENT_ID, WORKOS_COOKIE_PASSWORD, WORKOS_REDIRECT_URI | OPERATION_CAPACITY, PUBLIC_BASE_URL, WORKOS_API_KEY, WORKOS_AUTHKIT_ISSUER, WORKOS_CLIENT_ID, WORKOS_COOKIE_PASSWORD, WORKOS_REDIRECT_URI |
| Tenant service | PUBLIC_BASE_URL | https://thermus-spike-cap-20261027-133345.onrender.com/, the public URL of the service | `https://thermus-spike-cap-20261027-133345.onrender.com/`; predicted from the name: the same |
| Tenant service | GET https://thermus-spike-cap-20261027-133345.onrender.com/healthz from this machine | 200 with body ok | 200, body "ok\n", after 718 ms; request 2 of at most 24, 5.9 s after the first |
| OAuth resource | GET /user_management/authkit_oauth_resources | the live gate URI is listed | 2 resources; the live gate URI is listed; https://thermus-spike-cap-20261027-133345.onrender.com/mcp is not listed |
| OAuth resource | POST /user_management/authkit_oauth_resources, then GET | https://thermus-spike-cap-20261027-133345.onrender.com/mcp added; the live gate URI still listed | 201 after 0.1 s: authkit_oauth_resource_01M5YS5BMGSDFSA79JYGBNBJB3; 3 resources; the live gate URI is listed; https://thermus-spike-cap-20261027-133345.onrender.com/mcp is listed as authkit_oauth_resource_01M5YS5BMGSDFSA79JYGBNBJB3 |
| Identity | Fixtures of the run | organization, user with a membership, Connect application | org_01M5YS5C07ZWFB710QK4D982CG, user_01M5YS5C7YWMJJKRNDGNAHYMBB, connect_app_01M5YS5CHKPQX40YF8D38J3XNP; names and email have the run ID so01e-20261027-133345 |
| Identity | Connect authorization in a headless browser | the callback has the code and the state | 7.1 s; AuthKit pages / > /password > /application-authorization > /application-authorization/success |
| Identity | Connect access token (claims only, never the token) | audience, organization, and user of the run; lifetime recorded | audience is the tenant resource; organization matches; user matches; lifetime 300 s; refresh token present |
| MCP | initialize and tools/list at https://thermus-spike-cap-20261027-133345.onrender.com/mcp | getURLAsMarkdown and search | protocol 2026-07-28; tools getURLAsMarkdown, search |
| Plan 1c-2g | Update answer | plan 1c-2g | 200, plan `1c-2g`, after 0.2 s |
| Plan 1c-2g | Deploy that applies the plan | live | started by the probe, with the probe image (answer 201); live 51.8 s after the update and 25.7 s after the deploy call (update_in_progress > live); the probe image |
| Plan 1c-2g | Service after the deploy | plan 1c-2g | plan `1c-2g` |
| Plan 1c-2g | Container restarted | recorded; docs: the deploy starts a new instance | yes: new instance srv-dbgagkt9el5s73ccktig-mslp2; the old instance is no longer listed |
| Plan 1c-2g | Event types since the update | recorded | plan_changed (+0.1 s), deploy_started (+31.2 s), deploy_ended (+50.6 s) |
| Plan 1c-2g | GET https://thermus-spike-cap-20261027-133345.onrender.com/healthz from this machine | 200 with body ok | 200, body "ok\n", after 128 ms; request 1 of at most 24, 0.1 s after the first |
| Calls on 1c-2g | Events of the step, read after the last window | recorded; server_failed is a kill | deploy_ended (-1.7 s) |
| Cleanup | WorkOS fixtures named with so01e-20261027-133345 | 0 after the deletes, within 12 reads 5 s apart | 0; 2 reads of the lists, 6.8 s after the deletes |
| Cleanup | OAuth resource | deleted when this run created it; the live gate URI untouched | deleted https://thermus-spike-cap-20261027-133345.onrender.com/mcp (authkit_oauth_resource_01M5YS5BMGSDFSA79JYGBNBJB3): 204 |
| Cleanup | Delete the tenant service srv-dbgagkt9el5s73ccktig | 204, or 404 when already gone | 204 after 1.1 s |
| Cleanup | Delete the pages origin srv-dbgaget9el5s73cckgf0 | 204, or 404 when already gone | 204 after 0.7 s |
| Cleanup | Services of this run in the list | 0 | 0, 0.1 s after the deletes; other thermus-spike-* services: none |

**First killed parallelism**

- 1c-2g: no window had a server_failed event; no call reported a killed renderer.

**Calls**

| Instance | Parallelism | Workload | Call | Outcome | Duration | Characters |
| --- | --- | --- | --- | --- | --- | --- |
| 1c-2g | 1 | page9m | 1 | error: Page fetch failed: Renderer readiness timed out | 20.7 s | 47 |
| 1c-2g | 1 | js | 1 | ok | 1.1 s | 13698 |
| 1c-2g | 1 | search | 1 | ok | 2.8 s | 4996 |
| 1c-2g | 5 | page9m | 1 | error: Page fetch failed: Renderer readiness timed out | 20.6 s | 47 |
| 1c-2g | 5 | page9m | 2 | error: Page fetch failed: Renderer readiness timed out | 20.6 s | 47 |
| 1c-2g | 5 | page9m | 3 | error: Page fetch failed: Renderer readiness timed out | 20.7 s | 47 |
| 1c-2g | 5 | page9m | 4 | error: Page fetch failed: Renderer readiness timed out | 20.6 s | 47 |
| 1c-2g | 5 | page9m | 5 | error: Page fetch failed: Renderer readiness timed out | 20.6 s | 47 |
| 1c-2g | 5 | js | 1 | ok | 0.9 s | 13698 |
| 1c-2g | 5 | js | 2 | ok | 1.6 s | 13698 |
| 1c-2g | 5 | js | 3 | ok | 1.5 s | 13698 |
| 1c-2g | 5 | js | 4 | ok | 1.1 s | 13698 |
| 1c-2g | 5 | js | 5 | ok | 1.2 s | 13698 |
| 1c-2g | 5 | search | 1 | ok | 5.7 s | 4996 |
| 1c-2g | 5 | search | 2 | ok | 5.0 s | 4996 |
| 1c-2g | 5 | search | 3 | ok | 3.8 s | 4996 |
| 1c-2g | 5 | search | 4 | ok | 6.3 s | 4996 |
| 1c-2g | 5 | search | 5 | ok | 4.5 s | 4996 |
| 1c-2g | 10 | page9m | 1 | error: Page fetch failed: Renderer readiness timed out | 20.5 s | 47 |
| 1c-2g | 10 | page9m | 2 | error: Page fetch failed: Renderer readiness timed out | 20.5 s | 47 |
| 1c-2g | 10 | page9m | 3 | error: Page fetch failed: Renderer readiness timed out | 20.7 s | 47 |
| 1c-2g | 10 | page9m | 4 | error: Page fetch failed: Renderer readiness timed out | 20.5 s | 47 |
| 1c-2g | 10 | page9m | 5 | error: Page fetch failed: Renderer readiness timed out | 20.5 s | 47 |
| 1c-2g | 10 | page9m | 6 | error: Page fetch failed: Renderer readiness timed out | 20.7 s | 47 |
| 1c-2g | 10 | page9m | 7 | error: Page fetch failed: Renderer readiness timed out | 20.7 s | 47 |
| 1c-2g | 10 | page9m | 8 | error: Page fetch failed: Renderer readiness timed out | 20.7 s | 47 |
| 1c-2g | 10 | page9m | 9 | error: Page fetch failed: Renderer readiness timed out | 20.7 s | 47 |
| 1c-2g | 10 | page9m | 10 | error: Page fetch failed: Renderer readiness timed out | 20.5 s | 47 |
| 1c-2g | 10 | js | 1 | ok | 1.6 s | 13698 |
| 1c-2g | 10 | js | 2 | ok | 1.4 s | 13698 |
| 1c-2g | 10 | js | 3 | ok | 1.3 s | 13698 |
| 1c-2g | 10 | js | 4 | ok | 1.2 s | 13698 |
| 1c-2g | 10 | js | 5 | ok | 1.5 s | 13698 |
| 1c-2g | 10 | js | 6 | ok | 1.4 s | 13698 |
| 1c-2g | 10 | js | 7 | ok | 1.1 s | 13698 |
| 1c-2g | 10 | js | 8 | ok | 0.9 s | 13698 |
| 1c-2g | 10 | js | 9 | ok | 1.7 s | 13698 |
| 1c-2g | 10 | js | 10 | ok | 1.7 s | 13698 |
| 1c-2g | 10 | search | 1 | error: Search failed: HTTP 429 | 2.3 s | 23 |
| 1c-2g | 10 | search | 2 | ok | 5.3 s | 4996 |
| 1c-2g | 10 | search | 3 | ok | 5.6 s | 4996 |
| 1c-2g | 10 | search | 4 | error: Search failed: HTTP 429 | 2.4 s | 23 |
| 1c-2g | 10 | search | 5 | ok | 4.5 s | 4996 |
| 1c-2g | 10 | search | 6 | ok | 7.2 s | 4996 |
| 1c-2g | 10 | search | 7 | error: Search failed: HTTP 429 | 2.2 s | 23 |
| 1c-2g | 10 | search | 8 | ok | 6.2 s | 4996 |
| 1c-2g | 10 | search | 9 | ok | 6.7 s | 4996 |
| 1c-2g | 10 | search | 10 | error: Search failed: HTTP 429 | 2.7 s | 23 |

**Render writes, durations, and rate-limit headers**

Writes in this run: 6. Reads: 143; the last read had Ratelimit-Limit 400, Ratelimit-Remaining 399, and Ratelimit-Reset 56.

| Step | Call | Status | Duration | Ratelimit-Limit | Ratelimit-Remaining | Ratelimit-Reset | Retry-After |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Pages origin | `POST /services` | 201 | 1.89 s | 20 | 17 | 1573 | absent |
| Tenant service | `POST /services` | 201 | 3.11 s | 20 | 16 | 1550 | absent |
| Plan 1c-2g | `PATCH /services/srv-dbgagkt9el5s73ccktig` | 200 | 0.20 s | 10 | 9 | 22 | absent |
| Plan 1c-2g | `POST /services/srv-dbgagkt9el5s73ccktig/deploys` | 201 | 4.63 s | 10 | 9 | 56 | absent |
| Cleanup | `DELETE /services/srv-dbgagkt9el5s73ccktig` | 204 | 1.05 s | 100 | 99 | 57 | absent |
| Cleanup | `DELETE /services/srv-dbgaget9el5s73cckgf0` | 204 | 0.71 s | 100 | 98 | 56 | absent |

**WorkOS Staging writes**

| Step | Call | Result | Duration |
| --- | --- | --- | --- |
| OAuth resource | `POST /user_management/authkit_oauth_resources` | 201 | 0.15 s |
| Identity | `createOrganization` | done | 0.20 s |
| Identity | `createUser` | done | 0.21 s |
| Identity | `createOrganizationMembership (role user)` | done | 0.17 s |
| Identity | `connect.createApplication (OAuth, PKCE)` | done | 0.16 s |
| Cleanup | `DELETE /user_management/authkit_oauth_resources/authkit_oauth_resource_01M5YS5BMGSDFSA79JYGBNBJB3` | 204 | 0.14 s |

**Conclusions**

- PASS Preflight: the workspace Thermus AI (team) and the credential ghcr-thermus-hosted-read (rgc-dbg1h0142hec73da9ra0) exist, no service of an earlier run exists, and the WorkOS Staging environment answers (2 WorkOS resources, the live gate URI listed).
- PASS Setup: pages origin: thermus-spike-pages-20261027-133345 (srv-dbgaget9el5s73cckgf0) was created and was live 17.5 s after the create call; https://thermus-spike-pages-20261027-133345.onrender.com/healthz answered 200 with ok, and /page9m (9437483 bytes) and /js (14845 bytes) answered 200 with the planned sizes and markers. Tenant: thermus-spike-cap-20261027-133345 (srv-dbgagkt9el5s73ccktig) was created and was live 71.3 s after the create call; PUBLIC_BASE_URL names the public URL; plan: on 0.5c-512mb; https://thermus-spike-cap-20261027-133345.onrender.com/healthz answered 200 with ok. Resource: registered https://thermus-spike-cap-20261027-133345.onrender.com/mcp as authkit_oauth_resource_01M5YS5BMGSDFSA79JYGBNBJB3; the live gate URI is still listed. Identity: the fixtures of so01e-20261027-133345 exist, and the Connect token for https://thermus-spike-cap-20261027-133345.onrender.com/mcp lasts 300 s. MCP protocol 2026-07-28 lists getURLAsMarkdown and search.
- PASS Plan 1c-2g: the update answer showed 1c-2g; the deploy that applied it was started by the probe, with the probe image (answer 201) and was live 51.8 s after the update; container restarted: yes: new instance srv-dbgagkt9el5s73ccktig-mslp2; the old instance is no longer listed. After it, /healthz answered 200 with ok.
- PASS Calls on 1c-2g: 9 windows on 1c-2g; 0 server_failed events; no window was killed.
- PASS Cleanup: deleted the WorkOS fixtures of so01e-20261027-133345; deleted https://thermus-spike-cap-20261027-133345.onrender.com/mcp (authkit_oauth_resource_01M5YS5BMGSDFSA79JYGBNBJB3): 204; deleted srv-dbgagkt9el5s73ccktig and srv-dbgaget9el5s73cckgf0.

</details>

#### Repeat of the `HTTP 502` window on `0.5c-512mb`

The script printed these lines first:

> Node v24.20.0. Start 2026-10-27T13:49:40.978Z. The tenant service thermus-spike-cap-20261027-134940 (srv-dbgao559el5s73cd9ijg) and pages origin thermus-spike-pages-20261027-134940 (srv-dbgantl9el5s73cd8r60), in oregon, owner tea-db8i6ceq1p3s73dev9og.
>
> Image ghcr.io/tomer-mayara/thermus-hosted@sha256:d6b8a8fd3174c02984267f6aef54a7ee4e4bc783776ae9b856685202972dbfbd. Parallelism 10; workloads page9m.
>
> Connect token: lifetime 300 s, 0 refreshes. Times are seconds on the clock of this machine.

| Instance | Parallelism | Workload | Outcomes | Duration s, min / median / max | Result characters | Peak memory | Memory limit | CPU peak | Instances | Kills | Restart | Metrics lag | Events |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 0.5c-512mb | 10 | page9m | 10 HTTP 502 | 2.6 / 2.7 / 2.8 | 0 | 79,572,990 bytes (76 MiB) | 536,870,900 bytes (512 MiB) | 0.0001142 cpu | 0 unitless | 0 | /healthz 200 5.4 s after the window end | 33.9 s (4 reads) | none |

The two rows of the calls step, as the script printed them:

| Step | Check | Expected | Measured |
| --- | --- | --- | --- |
| Calls on 0.5c-512mb | Events of the step, read 120 s or more after the last window | recorded; server_failed is a kill | none |
| Calls on 0.5c-512mb | Instances at the step start and after the last window | recorded; a new ID is a new instance | srv-dbgao559el5s73cd9ijg-kxp8q; then srv-dbgao559el5s73cd9ijg-kxp8q |

<details>
<summary>The other tables and the conclusions of the repeat, as the script printed them</summary>

| Step | Check | Expected | Measured |
| --- | --- | --- | --- |
| Preflight | Workspace | the given owner | Thermus AI (team) |
| Preflight | Registry credential "ghcr-thermus-hosted-read" | one credential with this ID or name; registry GITHUB | ghcr-thermus-hosted-read (rgc-dbg1h0142hec73da9ra0), GITHUB |
| Preflight | Services named thermus-spike-*, any type | none | none |
| Preflight | WorkOS Staging: GET /user_management/authkit_oauth_resources | 200; the live gate URI https://localhost:46443/mcp is listed | 200; 2 resources; the live gate URI is listed |
| Pages origin | Create answer | 201 with the service and deployId | 201 after 2.2 s: srv-dbgantl9el5s73cd8r60, `web_service`, plan `0.5c-512mb` |
| Pages origin | First deploy | live; time recorded | live 18.0 s after the create call (update_in_progress > live); Render: createdAt 2026-10-27T13:49:43.728879Z, finishedAt 2026-10-27T13:49:56.985562Z, 13.3 s |
| Pages origin | Public URL | https://<name>.onrender.com in serviceDetails.url | `https://thermus-spike-pages-20261027-134940.onrender.com` |
| Pages origin | GET https://thermus-spike-pages-20261027-134940.onrender.com/healthz from this machine | 200 with body ok | 200, body "ok", after 192 ms; request 3 of at most 24, 11.1 s after the first |
| Pages origin | GET https://thermus-spike-pages-20261027-134940.onrender.com/page9m from this machine | 200, 9437483 bytes, marker in the HTML | 200, 9437483 bytes, marker in the HTML, after 0.4 s; request 1 of at most 6 |
| Pages origin | GET https://thermus-spike-pages-20261027-134940.onrender.com/js from this machine | 200, 14845 bytes, marker not in the HTML | 200, 14845 bytes, marker not in the HTML, after 0.1 s; request 1 of at most 6 |
| Tenant service | Create answer | 201 with the service and deployId | 201 after 3.3 s: srv-dbgao559el5s73cd9ijg, `web_service`, plan `0.5c-512mb` |
| Tenant service | First deploy | live; time recorded | live 92.5 s after the create call (update_in_progress > live); Render: createdAt 2026-10-27T13:50:14.490926Z, finishedAt 2026-10-27T13:51:41.119242Z, 86.6 s |
| Tenant service | Public URL | https://<name>.onrender.com in serviceDetails.url | `https://thermus-spike-cap-20261027-134940.onrender.com` |
| Tenant service | Variables (keys only) | OPERATION_CAPACITY, PUBLIC_BASE_URL, WORKOS_API_KEY, WORKOS_AUTHKIT_ISSUER, WORKOS_CLIENT_ID, WORKOS_COOKIE_PASSWORD, WORKOS_REDIRECT_URI | OPERATION_CAPACITY, PUBLIC_BASE_URL, WORKOS_API_KEY, WORKOS_AUTHKIT_ISSUER, WORKOS_CLIENT_ID, WORKOS_COOKIE_PASSWORD, WORKOS_REDIRECT_URI |
| Tenant service | PUBLIC_BASE_URL | https://thermus-spike-cap-20261027-134940.onrender.com/, the public URL of the service | `https://thermus-spike-cap-20261027-134940.onrender.com/`; predicted from the name: the same |
| Tenant service | GET https://thermus-spike-cap-20261027-134940.onrender.com/healthz from this machine | 200 with body ok | 200, body "ok\n", after 240 ms; request 1 of at most 24, 0.2 s after the first |
| OAuth resource | GET /user_management/authkit_oauth_resources | the live gate URI is listed | 2 resources; the live gate URI is listed; https://thermus-spike-cap-20261027-134940.onrender.com/mcp is not listed |
| OAuth resource | POST /user_management/authkit_oauth_resources, then GET | https://thermus-spike-cap-20261027-134940.onrender.com/mcp added; the live gate URI still listed | 201 after 0.1 s: authkit_oauth_resource_01M5YT362V4V59W4JMWCW306GS; 3 resources; the live gate URI is listed; https://thermus-spike-cap-20261027-134940.onrender.com/mcp is listed as authkit_oauth_resource_01M5YT362V4V59W4JMWCW306GS |
| Identity | Fixtures of the run | organization, user with a membership, Connect application | org_01M5YT36D7N40FVWR4FAA1K9FS, user_01M5YT36MK983W2FWJW58VAM0T, connect_app_01M5YT36Z09V06A4437WDWNF48; names and email have the run ID so01e-20261027-134940 |
| Identity | Connect authorization in a headless browser | the callback has the code and the state | 7.2 s; AuthKit pages / > /password > /application-authorization > /application-authorization/success |
| Identity | Connect access token (claims only, never the token) | audience, organization, and user of the run; lifetime recorded | audience is the tenant resource; organization matches; user matches; lifetime 300 s; refresh token present |
| MCP | initialize and tools/list at https://thermus-spike-cap-20261027-134940.onrender.com/mcp | getURLAsMarkdown and search | protocol 2026-07-28; tools getURLAsMarkdown, search |
| Calls on 0.5c-512mb | Events of the step, read 120 s or more after the last window | recorded; server_failed is a kill | none |
| Calls on 0.5c-512mb | Instances at the step start and after the last window | recorded; a new ID is a new instance | srv-dbgao559el5s73cd9ijg-kxp8q; then srv-dbgao559el5s73cd9ijg-kxp8q |
| Cleanup | WorkOS fixtures named with so01e-20261027-134940 | 0 after the deletes, within 12 reads 5 s apart | 0; 3 reads of the lists, 12.4 s after the deletes |
| Cleanup | OAuth resource | deleted when this run created it; the live gate URI untouched | deleted https://thermus-spike-cap-20261027-134940.onrender.com/mcp (authkit_oauth_resource_01M5YT362V4V59W4JMWCW306GS): 204 |
| Cleanup | Delete the tenant service srv-dbgao559el5s73cd9ijg | 204, or 404 when already gone | 204 after 0.6 s |
| Cleanup | Delete the pages origin srv-dbgantl9el5s73cd8r60 | 204, or 404 when already gone | 204 after 0.6 s |
| Cleanup | Services of this run in the list | 0 | 0, 0.1 s after the deletes; other thermus-spike-* services: none |

**First killed parallelism**

- 0.5c-512mb: no window had a server_failed event; no call reported a killed renderer.

**Calls**

| Instance | Parallelism | Workload | Call | Outcome | Duration | Characters |
| --- | --- | --- | --- | --- | --- | --- |
| 0.5c-512mb | 10 | page9m | 1 | HTTP 502 | 2.6 s | 0 |
| 0.5c-512mb | 10 | page9m | 2 | HTTP 502 | 2.7 s | 0 |
| 0.5c-512mb | 10 | page9m | 3 | HTTP 502 | 2.7 s | 0 |
| 0.5c-512mb | 10 | page9m | 4 | HTTP 502 | 2.7 s | 0 |
| 0.5c-512mb | 10 | page9m | 5 | HTTP 502 | 2.7 s | 0 |
| 0.5c-512mb | 10 | page9m | 6 | HTTP 502 | 2.7 s | 0 |
| 0.5c-512mb | 10 | page9m | 7 | HTTP 502 | 2.8 s | 0 |
| 0.5c-512mb | 10 | page9m | 8 | HTTP 502 | 2.7 s | 0 |
| 0.5c-512mb | 10 | page9m | 9 | HTTP 502 | 2.6 s | 0 |
| 0.5c-512mb | 10 | page9m | 10 | HTTP 502 | 2.7 s | 0 |

**Render writes, durations, and rate-limit headers**

Writes in this run: 4. Reads: 45; the last read had Ratelimit-Limit 400, Ratelimit-Remaining 399, and Ratelimit-Reset 46.

| Step | Call | Status | Duration | Ratelimit-Limit | Ratelimit-Remaining | Ratelimit-Reset | Retry-After |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Pages origin | `POST /services` | 201 | 2.21 s | 20 | 15 | 618 | absent |
| Tenant service | `POST /services` | 201 | 3.35 s | 20 | 14 | 588 | absent |
| Cleanup | `DELETE /services/srv-dbgao559el5s73cd9ijg` | 204 | 0.56 s | 100 | 99 | 47 | absent |
| Cleanup | `DELETE /services/srv-dbgantl9el5s73cd8r60` | 204 | 0.62 s | 100 | 98 | 47 | absent |

**WorkOS Staging writes**

| Step | Call | Result | Duration |
| --- | --- | --- | --- |
| OAuth resource | `POST /user_management/authkit_oauth_resources` | 201 | 0.12 s |
| Identity | `createOrganization` | done | 0.18 s |
| Identity | `createUser` | done | 0.21 s |
| Identity | `createOrganizationMembership (role user)` | done | 0.20 s |
| Identity | `connect.createApplication (OAuth, PKCE)` | done | 0.41 s |
| Cleanup | `DELETE /user_management/authkit_oauth_resources/authkit_oauth_resource_01M5YT362V4V59W4JMWCW306GS` | 204 | 0.12 s |

**Conclusions**

- PASS Preflight: the workspace Thermus AI (team) and the credential ghcr-thermus-hosted-read (rgc-dbg1h0142hec73da9ra0) exist, no service of an earlier run exists, and the WorkOS Staging environment answers (2 WorkOS resources, the live gate URI listed).
- PASS Setup: pages origin: thermus-spike-pages-20261027-134940 (srv-dbgantl9el5s73cd8r60) was created and was live 18.0 s after the create call; https://thermus-spike-pages-20261027-134940.onrender.com/healthz answered 200 with ok, and /page9m (9437483 bytes) and /js (14845 bytes) answered 200 with the planned sizes and markers. Tenant: thermus-spike-cap-20261027-134940 (srv-dbgao559el5s73cd9ijg) was created and was live 92.5 s after the create call; PUBLIC_BASE_URL names the public URL; plan: on 0.5c-512mb; https://thermus-spike-cap-20261027-134940.onrender.com/healthz answered 200 with ok. Resource: registered https://thermus-spike-cap-20261027-134940.onrender.com/mcp as authkit_oauth_resource_01M5YT362V4V59W4JMWCW306GS; the live gate URI is still listed. Identity: the fixtures of so01e-20261027-134940 exist, and the Connect token for https://thermus-spike-cap-20261027-134940.onrender.com/mcp lasts 300 s. MCP protocol 2026-07-28 lists getURLAsMarkdown and search.
- PASS Calls on 0.5c-512mb: 1 windows on 0.5c-512mb; 0 server_failed events; no window was killed.
- PASS Cleanup: deleted the WorkOS fixtures of so01e-20261027-134940; deleted https://thermus-spike-cap-20261027-134940.onrender.com/mcp (authkit_oauth_resource_01M5YT362V4V59W4JMWCW306GS): 204; deleted srv-dbgao559el5s73cd9ijg and srv-dbgantl9el5s73cd8r60.

</details>

### Findings

**The owner of the readiness limit.** The limit is the constant
`WEBSITE_FETCH_READINESS_BUDGET_MS = 20_000` in
[`website-fetcher.ts`](../../src/pipelines/providers/website-fetcher/website-fetcher.ts).
`WebsiteFetcherLightpanda` starts the timer when it starts the renderer
process, and at the limit it stops the renderer with `SIGKILL`
([`website-fetcher-lightpanda.ts`](../../src/pipelines/providers/website-fetcher/website-fetcher-lightpanda.ts)).
The [website fetcher reference](../reference/website-fetcher.md) says that the
limit is "not a request option or an environment setting". So an operator
cannot change it for one instance. A change is a source change for all
instances.

**The 9 MiB page does not render within the limit on either plan.**

- On `0.5c-512mb`, at 1 and 5 calls, each call ended after 20.7 to 20.8 s with
  "Page fetch failed: Renderer readiness timed out". No call reported a kill,
  and no `server_failed` event came. The memory peaks were 163 and 379 MiB.
- On `1c-2g`, at 1, 5, and 10 calls, each call also ended after 20.5 to 20.7 s
  with the readiness timeout and no kill. The memory peaks were 133, 371, and
  709 MiB. So `1c-2g` does not render the page either.
- So the "kills on huge pages" of D-2 were readiness timeouts on both plans.
  The only exception is 10 calls on `0.5c-512mb`: there, the container
  restarted (see the next finding).
- The fetch failed, so the cleaning did not run. The peaks are the memory of
  the renderers, not of the cleaning.
- The probe did not measure why the render on Render takes more than 20 s. The
  local check above rendered the same page in 2.7 s. RHD-05 rendered and
  cleaned its near-limit page on `1c-2g` in 12.8 s of server time, with the
  page served through a tunnel.

**The `HTTP 502` window was a container restart, with no kill event.**

- Run A, 10 calls of the 9 MiB page on `0.5c-512mb`: all 10 calls got
  `HTTP 502` from Render after 2.3 to 2.5 s. `/healthz` answered `200` again
  15.8 s after the window end. The events, read about 34 s after the window,
  had no `server_failed` event. The metrics showed no memory peak and an
  instance count of 1. So run A showed a suspected container restart. The
  evidence had three limits. The metrics have a resolution of 30 s, so a crash
  of a few seconds does not show. The probe read the events only 34 s after
  the window. The probe read `/healthz` from this machine every 5 s.
- The late events read of run B covers only the windows on `1c-2g`. It gave
  only the `deploy_ended` event of the plan change, so it shows no kill on
  `1c-2g`. It cannot settle the window on `0.5c-512mb`. For that, a repeat ran
  the same window on a new `0.5c-512mb` tenant. The repeat read the events
  120 s or more after the window, and it recorded the instance IDs.
- The repeat: all 10 calls got `HTTP 502` after 2.6 to 2.8 s. `/healthz`
  answered `200` again 5.4 s after the window end. The instance count was 0
  for the window. The instance ID was the same at the step start and after the
  window. The event list had no entry, also 2 minutes after the window.
- Result: the container restarted in place, and the event list of Render does
  not report this restart. The kill count from the events is 0 in both
  windows. The restart count from the client outcomes, `/healthz`, and the
  instance count is 1 in each window. So the first parallelism with a restart
  is 10 on `0.5c-512mb`, for the 9 MiB page. `1c-2g` had no restart.
- The likely cause is memory: on `1c-2g`, 10 renders of the page held 709 MiB,
  and `0.5c-512mb` has 512 MiB.

**Brave refuses 10 searches at the same time.**

- With 10 searches at the same time, Brave answered `HTTP 429` to all 10 on
  `0.5c-512mb` and to 4 of 10 on `1c-2g`. The container was not at a limit:
  its peaks were 121 MiB and 0.07 CPU, and 240 MiB and 0.23 CPU.
- The search tool reads the public Brave website without an API key
  ([search tool](../reference/mcp-search-tool.md)). Render shares the outbound
  IP ranges of a region across all services in that region
  ([Outbound IP addresses](https://render.com/docs/outbound-ip-addresses)). So
  this is an external rate limit for the source address. It is not a limit of
  the container or of a key.
- For Slices 2 and 3: all tenants in a region send their searches from the
  same address ranges. When the searches of one organization use the limit,
  the searches of the other organizations fail too.
- The measured basis is 5 searches at the same time. All of them passed, in
  7.3 to 14.9 s on `0.5c-512mb` and in 3.8 to 6.3 s on `1c-2g`.

**Normal pages are far from the limits.** Ten JavaScript pages at the same
time took 1.9 to 5.0 s on `0.5c-512mb`, with a memory peak of 139 MiB. On
`1c-2g`, they took 0.9 to 1.7 s, with 254 MiB.

**Times on Render and WorkOS.** A new tenant service was `live` 71.3 to
104.1 s after its create call, and a new pages origin 17.5 to 18.1 s after its
create call. The plan change was `live` 51.8 s after the plan update and
25.7 s after the deploy call, with a new instance. The Connect authorization in
the headless browser took 6.3 to 9.2 s. Each token had a lifetime of 300 s, and
the probe refreshed it 2 times in run A and 3 times in run B.

**Details of Render and WorkOS.**

- Right after the plan change of run B, the first window read no instance
  count, and the second window read a memory limit of 512 MiB. The other
  windows read 2048 MiB.
- In run B attempt 1, `/healthz` of the new pages origin answered `200`. Then
  `/page9m` got a `404` of 10 bytes, which the program of the origin does not
  send. Probably, the router of Render did not yet send all requests for the
  new name to the service. The probe now repeats a page request that does not
  get `200`, every 5 s, at most 6 times.
- In the setup run, right after the deletes, the organization list of WorkOS
  still showed the deleted organization. Less than one minute later, a read of
  the organization by its ID answered `404`, and the list did not show it. The
  cleanup check now reads the lists again, every 5 s, at most 12 times. In the
  later runs, the check passed after 2 or 3 reads, 6.5 to 12.8 s after the
  deletes.

### Recommendation for D-15

The owner decides D-15. These values come from the runs above. On
27 October 2026, the owner accepted the free value 5 and the team value 10
([plan section 5](self-onboarding-plan.md#5-owner-decisions-answered-on-26-october-2026)).

- **Free tenants, `0.5c-512mb`: lower `OPERATION_CAPACITY` to 5.** With 10,
  ten 9 MiB calls restarted the container in run A and in the repeat. Each
  time, the container of the organization did not answer until 5.4 to 15.8 s
  after the window end. A restart stops each call that runs in the container,
  also the calls of the other members. Five such calls peaked at 379 MiB, 74 %
  of 512 MiB, with no restart: they ended with the readiness timeout. A free
  organization has at most 5 members (D-5), so 5 still gives one call for each
  member at the same time. The sixth call gets "Server busy. Try again
  later.".
- **Team tenants, `1c-2g`: keep `OPERATION_CAPACITY` at 10.** Ten 9 MiB calls
  peaked at 709 MiB, 35 % of 2048 MiB, with no restart.
- **Keep the readiness limit at 20 s.** The limit also sets a limit on the
  memory of a heavy call, because the renderer stops at 20 s and the cleaning
  does not run. When a page renders in time, its cleaning adds much memory. In
  the local check above, the cleaning of this page increased the Node memory
  from 208 to 616 MiB. In RHD-05, the samples reached 631 MiB on `1c-2g`. So
  on `0.5c-512mb`, one such call can restart the container at each capacity,
  as D-2 accepts. Measure again before a change of the limit.
- **Alert threshold.** Alert on the first tenant restart outside a deploy.
  The event list of Render did not report the restarts above, so the Render
  failure emails of SO-11 can miss them too. The gateway (SO-05) sees a
  restart as an `HTTP 502` or a reset connection from a live tenant, and the
  instance count can show 0. Also alert on a memory value at or above 80 % of
  the limit: 410 MiB for `0.5c-512mb` and 1,638 MiB for `1c-2g`. With a
  capacity of 5, the 9 MiB page stays below 80 %. So the alert shows a page or
  a load that needs more memory than these runs measured.
- **Words of the failure message.** For each call that a tenant restart stops,
  the gateway returns one tool error with `isError: true` and the words "Server
  restarted. Try again in a minute.". This has the form of "Server busy. Try
  again later.". A heavy page keeps "Page fetch failed: Renderer readiness
  timed out", and a refused search keeps "Search failed: HTTP 429".
- **Search.** `OPERATION_CAPACITY` does not protect the Brave limit, because
  the limit applies to the shared outbound addresses of the region. For Slices
  2 and 3, there are three options. The gateway can limit the searches of all
  tenants together. A Brave Search API key has its own limits. Render sells
  dedicated outbound IP addresses for a workspace. The measured basis is 5
  searches at the same time: 7.3 to 14.9 s on `0.5c-512mb`.

### Limits

- A memory value is a value of the Render series at a point, not a kernel
  peak. The probe takes the largest of three reads with starts 10 s apart, so
  a peak shorter than about 10 s can still be lower in the record. A container
  that restarts in a few seconds shows no peak: the two `HTTP 502` windows have
  none.
- The event list of Render did not report the container restarts. The client
  outcomes, `/healthz`, and the instance count show them. The instance count is
  a 30-second value, and it showed 0 only in the repeat.
- The renderer is a child process in the same container. A memory kill can
  stop only the renderer: then the call gets "Page fetch failed: Renderer
  process was killed", and no `server_failed` event comes. The report counts
  these calls apart from the kills. No call got this error.
- The 9 MiB page did not render on Render, so the runs did not measure the
  memory of the cleaning on Render. A smaller page that renders within 20 s
  and needs a long cleaning was not measured.
- Right after the plan change, two windows of run B read values that are not
  those of `1c-2g`: a memory limit of 512 MiB, and no instance count.
- One region, one instance, and one pages origin in the same region, from one
  machine. The search uses the public Brave website, which rate-limits many
  searches from one address. Other traffic from the shared Render addresses can
  change the results.
- The hosted-live fixtures have the name prefix "Thermus live". A hosted live
  gate run that starts during a probe run deletes them as stale fixtures, so
  the two must not run at the same time.

## SO-01f: Stripe Checkout, webhooks, test clocks, and WorkOS seat sync

Date: 27 October 2026 (UTC). Branch `self-ob-s1-so-01f-stripe-seat-sync-7e93b8`,
on main.

Status: built and checked. On 27 October 2026, the owner moved the real run
of the probe, with the seat sync, Checkout, webhook, and test clock steps, to
Slice 3. Slice 1 delivers the probe and the WorkOS-only check.
[Owner steps](#owner-steps) 1 to 9 are the prerequisites of the Slice 3 run.
On that day, the WorkOS Stripe add-on of the Staging environment was not
connected, Seat Sync and Entitlements were off, `.env.local` held no Stripe
variable, and the Stripe CLI was not installed on the owner's Mac (`stripe`
was not found).

The [WorkOS organization check](#workos-organization-check) needs no Stripe
key and no add-on. It ran in the WorkOS Staging environment on 27 October
2026, after the owner added the new origin to the allow-list of the launcher.
Its first run found a gap of the probe in the check after the deletes. After
the fix, the second run passed.

### What the probe does

[`stripe-seat-sync-probe.ts`](../../script/spike/stripe-seat-sync-probe.ts)
runs a preflight that only reads, then the steps of the ticket in a fixed
order, then the cleanup. Each step is an assertion of the script. The helper
modules are in
[`stripe-seat-sync-probe/`](../../script/spike/stripe-seat-sync-probe/). The
probe reuses the step runner and the polls of SO-01c,
[`runner.ts`](../../script/spike/render-tenant-lifecycle/runner.ts) and
[`polls.ts`](../../script/spike/render-tenant-lifecycle/polls.ts).

The probe calls Stripe through the `stripe` package, pinned to the exact
version 23.0.1 in the dev dependencies. This version pins the Stripe API
version `2026-09-30.endive`
([stripe-node changelog](https://github.com/stripe/stripe-node/blob/master/CHANGELOG.md)).
No file under `src/` imports the package. The probe calls WorkOS through
`@workos-inc/node` 11.0.0, the version of `src/`.
[`stripe-calls.ts`](../../script/spike/stripe-seat-sync-probe/stripe-calls.ts)
and [`workos-calls.ts`](../../script/spike/stripe-seat-sync-probe/workos-calls.ts)
build each call, and
[`stripe-params.ts`](../../script/spike/stripe-seat-sync-probe/stripe-params.ts)
builds the parameters of the Stripe writes. The dry run prints these calls,
and real mode sends them, so the printed parameters are the sent parameters.

Run it from the repository root, through the WorkOS Staging launcher, with the
git-ignored `.env.local` of the main checkout:

```sh
node ~/.config/thermus/with-workos-staging.cjs node --env-file=/Users/tomermayara/git/Thermus/.env.local \
  script/spike/stripe-seat-sync-probe.ts [--steps <step,...>] [--workos-only] [--keep] [--dry-run]
```

Options:

- `--steps`: `seat-sync`, `checkout`, `webhook`, and `test-clock`, in this
  order. The default is all of them. `--steps cleanup` runs alone: it deletes
  the objects of earlier runs (the sweep).
- `--workos-only`: only the WorkOS part of seat-sync, with the fake customer
  ID `cus_ThermusSpike` and the last four characters of the run token. No
  Stripe call and no Stripe key.
- `--keep`: keep the objects of the run when every step passed. The next run
  refuses to start until `--steps cleanup` deletes them.
- `--dry-run`: print the planned calls. No network call and no key.

Rules of the script:

- Every object carries the run token, the UTC start time and four random
  hexadecimal digits (`YYYYMMDD-HHMMSS-xxxx`). The WorkOS organization is
  named `thermus-spike-stripe-<run> seat-sync`, and each user has the email
  `thermus-spike-stripe-<run>-member-<n>@example.net`. Each Stripe customer
  has a name with the token and the metadata `thermus_probe: so-01f` and
  `thermus_probe_run: <run>`. The test clock has a name with the token. The
  Checkout Session, its subscription, and the subscriptions of the CLI
  trigger and of the test clock carry the same metadata. The prefix differs
  from the `Thermus live` prefix of the hosted-live fixtures, so neither
  cleanup deletes the objects of the other.
- The secrets come only from the environment. No output holds a key or the
  signing secret: the dry run prints `<set>`, and each message and report
  line goes through a redaction of key, signing-secret, and bearer patterns.
  The Stripe CLI runs with no variable of the probe secrets and no
  `STRIPE_API_KEY`, so it uses its own login.
- Before any call, the script stops with exit code 2 for: a key that the
  selected steps need and that is not set; a Stripe key that starts with
  `rk_live_` or `sk_live_`; a Stripe secret key, `sk_test_`, instead of a
  restricted key; a missing or malformed `STRIPE_PRICE_ID`; a WorkOS key that
  starts with `sk_live_` or not with `sk_test_`; and a `WORKOS_CLIENT_ID` of
  the WorkOS Production environment, `client_01M4VDKC291XX3CDEFP5ZKY5KP`.
- The preflight makes reads only; both clients refuse each write until it
  passes. It refuses to start while an object of an earlier run exists. The
  Stripe client also stops at any answer that holds a live-mode object.
- Stripe calls go through the SDK with 2 network retries. The SDK repeats a
  request after a network failure, a `409`, or a `5xx` answer, unless Stripe
  marks it as not safe to repeat, and it sends one idempotency key with every
  attempt of a POST (`RequestSender.js` of the package). WorkOS creates go one
  time only. WorkOS deletes have up to 3 attempts after a network failure, a
  `429`, or a `5xx` answer.
- Each wait has a fixed bound: the meter, every 2 s, at most 300 reads (10
  minutes) for each membership change; Checkout, every 5 s, at most 180 reads
  (15 minutes); a test clock advance, every 2 s, at most 150 reads;
  `stripe listen`, 60 s until "Ready!"; `stripe trigger`, 120 s; the
  forwarded event, 60 s; the retries of the test clock, at most 14 advances
  and 63 days of clock time; the check after the deletes, every 2 s, at most
  60 reads.
- The cleanup runs after each run, also after a failed step and after the
  first `SIGINT` or `SIGTERM`. It removes the objects that the steps remember
  and the objects that it finds by the run token, and then reads each one
  until it is gone: WorkOS Staging can still show an organization for some
  seconds after its `DELETE` answer
  ([WorkOS organization check](#workos-organization-check)). The reads stop
  early when only objects whose removal failed remain. A second signal stops
  the probe at once and can leave objects.
- Exit code 0: each step and the cleanup passed. Exit code 1: a step or the
  cleanup failed. Exit code 2: a usage error.

### Owner steps

Each Stripe step is in the Stripe Dashboard of the standard Stripe account,
in test mode: "WorkOS does not currently support connecting to a Stripe
Sandbox account"
([WorkOS Stripe add-on](https://workos.com/docs/authkit/add-ons/stripe)). No
step puts a secret in the repository, a ticket, a chat, or a log.

1. WorkOS Dashboard, Staging environment: **Authentication** > **Add-ons** >
   Stripe > **Enable**. In the dialog, select **Stripe entitlements** and
   **organization seat count sync**, and leave Radar payment outcomes off.
   Click **Continue**, approve the connection in Stripe, and close the tab.
   Then, in Stripe test mode, **Billing** > **Meters** lists the meter "User
   Seat Count" with the event name `workos_seat_count`.
2. Stripe: **Product catalog** > **Create product**, for example "Thermus
   Team (test)". Select **Recurring**, then **More pricing options** >
   **Usage-based** > **Per unit**. Set an amount in USD in whole cents (the
   probe reads it), the meter "User Seat Count", and the billing period
   **Monthly**. Set the tax behavior of the price, or the default tax
   behavior of step 3. Copy the price ID.
3. Stripe: **Settings** > **Tax**: the head office address, a preset product
   tax code, and the default tax behavior, until the status of the tax
   settings is active. A registration (**Tax** > **Registrations**) is
   optional for the probe: "Stripe Tax only collects tax in jurisdictions
   where you have an active registration"
   ([Collect tax with the Checkout page](https://docs.stripe.com/tax/checkout/page)),
   so without one the session shows a tax of 0.
4. Stripe: **Settings** > **Business** > **Public details**: a terms of
   service URL. Checkout refuses `consent_collection.terms_of_service:
   required` without "a valid terms of service URL set in your Dashboard
   settings"
   ([Create a Checkout Session](https://docs.stripe.com/api/checkout/sessions/create)).
   The owner chooses the URL. No customer reaches Checkout before SO-14
   (D-11).
5. Stripe: **Settings** > **Billing** > **Customer portal**: cancellation on,
   at the end of the billing period; **Update quantities** and **Switch
   plan** off. Save, so that a default configuration exists.
6. Stripe: **Billing** > **Revenue recovery** > **Retries**: a retry policy,
   for example the recommended Smart Retries of 8 tries within 2 weeks, and
   **Cancel the subscription** when all retries for a payment fail
   ([Automate payment retries](https://docs.stripe.com/billing/revenue-recovery/smart-retries)).
7. Stripe: **Developers** > **API keys** > **Create restricted key**, in
   test mode, named for example `thermus-so-01f-probe`, with the
   [permissions below](#permissions-of-the-restricted-key) and **None** for
   every other resource. Copy the key value one time.
8. Main checkout `.env.local`, which git ignores: add `STRIPE_RESTRICTED_KEY`
   with the key of step 7 and `STRIPE_PRICE_ID` with the price ID of step 2.
9. This Mac: install the Stripe CLI, for example with
   `brew install stripe/stripe-cli/stripe`, and sign in with `stripe login`.
   The login makes an API key for the CLI that "is valid for 90 days"
   ([Set up events](https://docs.stripe.com/events/set-up-events)). Then
   `stripe listen --print-secret` must exit with code 0. Do not copy its
   output: it is the signing secret.
10. The WorkOS Staging launcher must accept the origin
    `https://github.com/tomer-mayara/Thermus.git`. Done on 27 October 2026.

### Variables

| Variable | Source | Rule |
| --- | --- | --- |
| `STRIPE_RESTRICTED_KEY` | `.env.local` of the main checkout | A restricted key of Stripe test mode, `rk_test_…`. The probe refuses `rk_live_…`, `sk_live_…`, and `sk_test_…`. |
| `STRIPE_PRICE_ID` | `.env.local` | `price_…`, the metered monthly price of owner step 2. |
| `WORKOS_API_KEY` | the Staging launcher, from the Keychain | `sk_test_…`; the probe refuses `sk_live_…`. Node keeps a variable of the environment over the file. |
| `WORKOS_CLIENT_ID` | the Staging launcher | Not used. The probe refuses the client of the Production environment. |

There is no `STRIPE_WEBHOOK_SECRET`. The webhook step reads the signing secret
at run time with `stripe listen --print-secret`, keeps it in memory, and
prints it nowhere. The CLI reference says that "the webhook signing secret
provided will not change between restarts to the listen command"
([stripe listen](https://docs.stripe.com/cli/listen)), and the secret of the
CLI differs from the secret of a Dashboard endpoint
([Manage webhook endpoints](https://docs.stripe.com/events/manage-webhook-endpoints)).
A stored copy would add one more secret at rest and no check. SO-13 uses the
secret of its Dashboard endpoint, `STRIPE_WEBHOOK_SECRET` of plan section 4.1.

### Permissions of the restricted key

From the calls of the probe, with the rules of
[Restricted API keys](https://docs.stripe.com/keys/restricted-api-keys) ("GET"
is a read; "POST" and "DELETE" are writes; "Write permissions include Read
permissions") and the resource names of the
[Stripe permissions reference](https://docs.stripe.com/stripe-apps/reference/permissions):

| Resource | Permission | Calls of the probe |
| --- | --- | --- |
| Customers | Write | create, retrieve, update the default payment method, delete, search |
| Payment Methods | Write | attach `pm_card_chargeCustomerFail` |
| Checkout Sessions | Write | create, retrieve with the subscription expanded, expire |
| Subscriptions | Write | create (test clock), retrieve, cancel |
| Invoices | Read | list by subscription, retrieve |
| Prices | Read | retrieve `STRIPE_PRICE_ID` |
| Billing Meters | Read | retrieve the meter, list the event summaries of a customer |
| Billing Meter Events | Write | report the seats of the test clock customer |
| Test Clocks | Write | create, retrieve, list, advance, delete |
| Customer Portal | Read | list the default configuration |
| Tax Settings, Registrations | Read | retrieve the tax settings |
| Every other resource | None | |

The real run confirms the list. When a restricted key lacks a permission,
"the response body includes an error message explaining which permissions to
add" (restricted key guide), and the probe prints that message with the key
replaced by `<key>`. The final list of the real run replaces this table. The
Stripe CLI does not use this key: `stripe listen` and `stripe trigger` use
the login of the CLI. SO-13 also creates Customer Portal sessions, which this
probe does not do.

### Steps

| Step | Given, when, then |
| --- | --- |
| Preflight (extra) | Given the inputs, when the probe reads the price, its meter, the tax settings and the default Customer Portal configuration (with `checkout`), the Stripe CLI (with `webhook`), and the objects of earlier runs, then the price is active, USD, monthly, metered, and per unit with a whole-cent unit amount, on a meter with the event name `workos_seat_count`, the aggregation `last`, and the status `active`; the tax settings are `active`; the portal cancels at the period end and allows no quantity update; the CLI gives a signing secret; and no object of an earlier run exists. |
| Seat sync | Given a new Stripe customer and a disposable WorkOS organization with that `stripe_customer_id`, when the probe adds one membership, then a second, and then removes one, then WorkOS shows 1, 2, and 1 active memberships, the meter shows the counts 1, 2, and 1 for the customer, and the record has the delay of each event. |
| Seat sync, WorkOS only (extra) | Given no Stripe key, when the probe creates a disposable organization, sets the fake `stripe_customer_id`, reads the organization, adds one membership, then a second, and removes one, then the record says whether WorkOS accepts the field without the Stripe add-on, and WorkOS shows 1, 2, and 1 active memberships. |
| Checkout | Given the price, when the probe creates a Checkout Session in subscription mode with required terms acceptance and Stripe Tax, and the operator completes it with a Stripe test card, then the session is `complete` with `consent.terms_of_service` `accepted`, automatic tax on, and a billing address, and its subscription is `active`, with one item on the price and no quantity. |
| Webhook | Given the Stripe CLI forwarding to the probe's local listener, when the CLI triggers `customer.subscription.created`, then the listener accepts the signed event of the run with `200`, and refuses with `400` the same event with a changed status and the original signature, and the same event without a signature. |
| Test clock | Given a test clock customer with the metered price and three reported seats, when the clock passes the period end, then the cycle invoice has a subtotal of three times the unit amount; when the payment method fails and the clock passes the retries, then the subscription is `past_due` and then `canceled`. |
| Cleanup | Given the end of the probe, when it cleans up, then no Checkout Session of the run is open, its subscriptions are canceled, and its customers, test clock, WorkOS organization, and users are deleted, also after a failure or the first stop signal. |
| Sweep (extra) | Given objects of earlier runs, when the probe runs with `--steps cleanup`, then it deletes each WorkOS organization and user with the probe prefix and each Stripe customer and test clock with the probe tag, and none remains. |

How each step works:

- Seat sync. The probe creates the organization, then the Stripe customer
  with the metadata `workos_organization_id`, and then sets
  `stripe_customer_id` with the update call: the create call of WorkOS takes
  no such field
  ([Update organization](https://workos.com/docs/reference/organization/update);
  the create options of `@workos-inc/node` 11.0.0 have no `stripeCustomerId`).
  The memberships have the role `user`. After each change, the probe reads
  the active memberships from WorkOS, and then one event summary of the
  customer with no `value_grouping_window`: with the `last` aggregation, its
  value is the value of the last event. The window starts at the minute
  boundary before the step start and ends at the minute boundary after the
  read; "start_time" and "end_time" must align with minute boundaries
  ([List billing meter event summaries](https://docs.stripe.com/api/billing/meter-event-summary/list)).
  The delay is the time from the WorkOS answer to the first summary that
  shows the new count, with a resolution of 2 s. Stripe processes meter
  events asynchronously, so a summary can show a new event late
  ([Record usage with the API](https://docs.stripe.com/billing/subscriptions/usage-based/recording-usage-api)).
  WorkOS sends a count "whenever a member is added, removed, deactivated, or
  activated" (WorkOS Stripe add-on).
- Checkout. The probe creates the customer first, as the upgrade of SO-13
  does, so the session gets `customer_update` `address: auto` with
  `billing_address_collection: required` for the tax location, and
  `name: auto` for tax ID collection
  ([Collect tax with the Checkout page](https://docs.stripe.com/tax/checkout/page),
  [Collect customer tax IDs with Checkout](https://docs.stripe.com/tax/checkout/tax-ids)).
  The line item has no quantity: "Quantity should not be defined when
  `recurring.usage_type=metered`" (Create a Checkout Session). The session
  expires 31 minutes after the create, because `expires_at` "can be anywhere
  from 30 minutes to 24 hours after Checkout Session creation". The success
  URL is a page of example.com with the session ID, so no Thermus code runs
  and the probe reads the session from Stripe. The probe prints the session
  URL on stderr and reads the session every 5 s for at most 15 minutes. The
  operator pays with the card 4242 4242 4242 4242, any future expiry date,
  and any CVC, ticks the terms box, and enters a billing address.
- Webhook. The listener serves `POST /stripe/events` on the loopback address
  and calls `stripe.webhooks.constructEvent(raw body, Stripe-Signature,
  secret)` on the raw body ([Set up events](https://docs.stripe.com/events/set-up-events)):
  `200` when it returns the event, `400` when it throws. `stripe listen`
  forwards `customer.created` and `customer.subscription.created`. The CLI
  fixture of `customer.subscription.created` makes a customer, a product, a
  price, and a subscription
  ([fixture](https://github.com/stripe/stripe-cli/blob/master/pkg/fixtures/triggers/customer.subscription.created.json)).
  The trigger skips the product and the price, puts the price of the run on
  the subscription with `--override`, and adds the run token to the customer
  and the subscription with `--add` ([stripe trigger](https://docs.stripe.com/cli/trigger)).
  So every object that the trigger makes can be deleted, and the cleanup
  deletes the customer, which "immediately cancels any active subscriptions"
  ([Delete a customer](https://docs.stripe.com/api/customers/delete)). The
  changed payload is the event with its subscription status changed and
  written again with two-space indents; the probe posts it with the original
  `Stripe-Signature` header. An unchanged repeat must still get `200`: the
  check alone accepts a repeat in its tolerance of 300 s, so SO-13 drops a
  repeated event ID.
- Test clock. The clock starts at the time of this machine. The customer is
  on the clock with the test card `pm_card_chargeCustomerFail`, which
  attaches to a customer but fails each charge
  ([Testing](https://docs.stripe.com/testing)), set as
  `invoice_settings.default_payment_method`
  ([Attach a PaymentMethod](https://docs.stripe.com/api/payment_methods/attach)).
  The subscription has no billing mode in the call, so it is `flexible`, and
  Stripe "excludes metered line items from the first invoice since no prior
  usage exists to bill"
  ([Create a subscription](https://docs.stripe.com/api/subscriptions/create),
  [Set up a pay-as-you-go pricing model](https://docs.stripe.com/billing/subscriptions/usage-based/implementation-guide)).
  One meter event of the probe reports 3 seats one second after the frozen
  time, with the event name and the payload keys of the meter. The timestamp
  of a meter event can be at most 35 days in the past and 5 minutes in the
  future ([Create a billing meter event](https://docs.stripe.com/api/billing/meter-event/create)),
  and no page says whether a test clock moves that window, so the probe
  reports usage in the first period only, where both readings hold. The
  clock then goes to the period end of the subscription item plus 2 hours:
  "By default, the invoice appears in a draft status for one hour"
  ([Test clocks: API and advanced usage](https://docs.stripe.com/billing/testing/test-clocks/api-advanced-usage)),
  and then Stripe tries the payment. The cycle invoice must have the subtotal
  3 times the unit amount, the status `open`, and at least one attempt, and
  the subscription must be `past_due`. Then each advance goes to one hour
  after the `next_payment_attempt` of the invoice, or 7 days on, until the
  subscription is `canceled`. One advance can go at most two intervals of the
  shortest subscription of the clock
  ([Advance a test clock](https://docs.stripe.com/api/test_clocks/advance)).
  The longest Smart Retries window is 2 months.

### Planned calls

The probe sends each Stripe call to `https://api.stripe.com` with the
restricted key, and each WorkOS call to `https://api.workos.com` with the
Staging key, through the SDKs. The pages were read on 27 October 2026 (UTC).

| Step | Call | SDK method | Documentation page |
| --- | --- | --- | --- |
| Preflight | `GET /v1/prices/{id}` | `prices.retrieve` | [The Price object](https://docs.stripe.com/api/prices/object) |
| Preflight | `GET /v1/billing/meters/{id}` | `billing.meters.retrieve` | [The Meter object](https://docs.stripe.com/api/billing/meter/object) |
| Preflight, with `checkout` | `GET /v1/tax/settings` | `tax.settings.retrieve` | [The Tax Setting object](https://docs.stripe.com/api/tax/settings/object) |
| Preflight, with `checkout` | `GET /v1/billing_portal/configurations?is_default=true&limit=1` | `billingPortal.configurations.list` | [List portal configurations](https://docs.stripe.com/api/customer_portal/configurations/list), [The portal configuration object](https://docs.stripe.com/api/customer_portal/configurations/object) |
| Preflight, with `webhook` | `stripe --version`, `stripe listen --print-secret` | CLI | [stripe listen](https://docs.stripe.com/cli/listen) |
| Preflight, Cleanup, Sweep | `GET /organizations?limit=100`, every page | `organizations.listOrganizations` | [List organizations](https://workos.com/docs/reference/organization/list) |
| Preflight, Cleanup, Sweep | `GET /user_management/users?limit=100`, every page | `userManagement.listUsers` | [List users](https://workos.com/docs/reference/authkit/user/list) |
| Preflight, Cleanup, Sweep | `GET /v1/customers/search?query=metadata['thermus_probe']:'so-01f'` (the run token in the cleanup) | `customers.search` | [Search customers](https://docs.stripe.com/api/customers/search), [Search](https://docs.stripe.com/search) |
| Preflight, Cleanup, Sweep | `GET /v1/test_helpers/test_clocks?limit=100` | `testHelpers.testClocks.list` | [Test clocks: API and advanced usage](https://docs.stripe.com/billing/testing/test-clocks/api-advanced-usage) |
| Seat sync | `POST /organizations` | `organizations.createOrganization` | [Create an organization](https://workos.com/docs/reference/organization/create) |
| Seat sync, Checkout, Test clock | `POST /v1/customers` | `customers.create` | [Set up a pay-as-you-go pricing model](https://docs.stripe.com/billing/subscriptions/usage-based/implementation-guide) |
| Seat sync | `PUT /organizations/{id}` with `stripe_customer_id` | `organizations.updateOrganization` | [Update organization](https://workos.com/docs/reference/organization/update), [WorkOS Stripe add-on](https://workos.com/docs/authkit/add-ons/stripe) |
| Seat sync | `POST /user_management/users` | `userManagement.createUser` | [Create a user](https://workos.com/docs/reference/authkit/user/create) |
| Seat sync | `POST /user_management/organization_memberships` | `userManagement.createOrganizationMembership` | [Create an organization membership](https://workos.com/docs/reference/authkit/organization-membership/create) |
| Seat sync | `DELETE /user_management/organization_memberships/{id}` | `userManagement.deleteOrganizationMembership` | [Delete organization membership](https://workos.com/docs/reference/authkit/organization-membership/delete) |
| Seat sync | `GET /user_management/organization_memberships?organization_id=…&statuses=active` | `userManagement.listOrganizationMemberships` | [List organization memberships](https://workos.com/docs/reference/authkit/organization-membership/list) |
| Seat sync, Test clock | `GET /v1/billing/meters/{id}/event_summaries?customer=…&start_time=…&end_time=…` | `billing.meters.listEventSummaries` | [List billing meter event summaries](https://docs.stripe.com/api/billing/meter-event-summary/list) |
| Checkout | `POST /v1/checkout/sessions` | `checkout.sessions.create` | [Create a Checkout Session](https://docs.stripe.com/api/checkout/sessions/create) |
| Checkout, Cleanup | `GET /v1/checkout/sessions/{id}?expand[]=subscription` | `checkout.sessions.retrieve` | [The Checkout Session object](https://docs.stripe.com/api/checkout/sessions/object) |
| Cleanup, only for an open session | `POST /v1/checkout/sessions/{id}/expire` | `checkout.sessions.expire` | [Expire a Checkout Session](https://docs.stripe.com/api/checkout/sessions/expire) |
| Webhook | `stripe listen --forward-to …`, `stripe trigger customer.subscription.created …` | CLI, as child processes | [stripe listen](https://docs.stripe.com/cli/listen), [stripe trigger](https://docs.stripe.com/cli/trigger) |
| Webhook | `stripe.webhooks.constructEvent` in the listener | SDK, local | [Set up events](https://docs.stripe.com/events/set-up-events), [Manage webhook endpoints](https://docs.stripe.com/events/manage-webhook-endpoints) |
| Test clock | `POST /v1/test_helpers/test_clocks` | `testHelpers.testClocks.create` | [Test clocks: API and advanced usage](https://docs.stripe.com/billing/testing/test-clocks/api-advanced-usage) |
| Test clock | `POST /v1/payment_methods/pm_card_chargeCustomerFail/attach` | `paymentMethods.attach` | [Attach a PaymentMethod](https://docs.stripe.com/api/payment_methods/attach), [Testing](https://docs.stripe.com/testing) |
| Test clock | `POST /v1/customers/{id}` with `invoice_settings.default_payment_method` | `customers.update` | [Attach a PaymentMethod](https://docs.stripe.com/api/payment_methods/attach) |
| Test clock | `POST /v1/subscriptions` | `subscriptions.create` | [Create a subscription](https://docs.stripe.com/api/subscriptions/create) |
| Test clock | `POST /v1/billing/meter_events` | `billing.meterEvents.create` | [Create a billing meter event](https://docs.stripe.com/api/billing/meter-event/create) |
| Test clock | `POST /v1/test_helpers/test_clocks/{id}/advance`, then `GET /v1/test_helpers/test_clocks/{id}` | `testHelpers.testClocks.advance`, `.retrieve` | [Advance a test clock](https://docs.stripe.com/api/test_clocks/advance) |
| Test clock | `GET /v1/invoices?subscription=…`, `GET /v1/invoices/{id}` | `invoices.list`, `invoices.retrieve` | [List all invoices](https://docs.stripe.com/api/invoices/list), [Test your Billing integration](https://docs.stripe.com/billing/testing) |
| Test clock, Cleanup | `GET /v1/subscriptions/{id}` | `subscriptions.retrieve` | [Automate payment retries](https://docs.stripe.com/billing/revenue-recovery/smart-retries) |
| Cleanup, only when not canceled | `DELETE /v1/subscriptions/{id}` | `subscriptions.cancel` | [Cancel a subscription](https://docs.stripe.com/api/subscriptions/cancel) |
| Cleanup, Sweep | `DELETE /v1/customers/{id}`, then `GET /v1/customers/{id}` | `customers.del`, `customers.retrieve` | [Delete a customer](https://docs.stripe.com/api/customers/delete) |
| Cleanup, Sweep | `DELETE /v1/test_helpers/test_clocks/{id}` | `testHelpers.testClocks.del` | [Test clocks: API and advanced usage](https://docs.stripe.com/billing/testing/test-clocks/api-advanced-usage) |
| Cleanup, Sweep | `DELETE /user_management/users/{id}`, then `GET` | `userManagement.deleteUser`, `getUser` | [Delete a user](https://workos.com/docs/reference/authkit/user/delete) |
| Cleanup, Sweep | `DELETE /organizations/{id}`, then `GET` | `organizations.deleteOrganization`, `getOrganization` | [Delete an organization](https://workos.com/docs/reference/organization/delete) |

The parameters of the Checkout Session, as the dry run prints them:

```json
{
  "mode": "subscription",
  "customer": "{customerId}",
  "line_items": [{ "price": "{STRIPE_PRICE_ID}" }],
  "consent_collection": { "terms_of_service": "required" },
  "automatic_tax": { "enabled": true },
  "billing_address_collection": "required",
  "tax_id_collection": { "enabled": true },
  "customer_update": { "address": "auto", "name": "auto" },
  "client_reference_id": "thermus-spike-stripe-YYYYMMDD-HHMMSS-xxxx",
  "metadata": { "thermus_probe": "so-01f", "thermus_probe_run": "YYYYMMDD-HHMMSS-xxxx" },
  "subscription_data": { "metadata": { "thermus_probe": "so-01f", "thermus_probe_run": "YYYYMMDD-HHMMSS-xxxx" } },
  "success_url": "https://example.com/thermus-spike/checkout-return?session_id={CHECKOUT_SESSION_ID}",
  "expires_at": "{now + 1860}"
}
```

The trigger of the webhook step, as the dry run prints it; real mode passes
the same arguments with no shell:

```sh
stripe trigger customer.subscription.created --skip product --skip price \
  --override 'subscription:items[0].price={STRIPE_PRICE_ID}' \
  --override 'customer:description=thermus-spike-stripe-YYYYMMDD-HHMMSS-xxxx webhook' \
  --add 'customer:name=thermus-spike-stripe-YYYYMMDD-HHMMSS-xxxx webhook' \
  --add customer:metadata.thermus_probe=so-01f --add customer:metadata.thermus_probe_run=YYYYMMDD-HHMMSS-xxxx \
  --add subscription:metadata.thermus_probe=so-01f --add subscription:metadata.thermus_probe_run=YYYYMMDD-HHMMSS-xxxx
```

### Checks before the real run

- `--dry-run` prints 261 lines of planned calls and exits with code 0. With
  the network blocker preload of the tests,
  [`deny-network.ts`](../../test/support/processes/deny-network.ts), it makes
  no outbound attempt, also with fake keys of the right prefixes set. It
  prints `<set>` for a set key and never a value.
- The guards stop the script with exit code 2 and no outbound attempt, with
  the preload, and no output holds the fake key values:

| Case | Options | Exit code | Message, after `stripe-seat-sync-probe:` |
| --- | --- | --- | --- |
| No `STRIPE_RESTRICTED_KEY` | `--steps checkout` | 2 | STRIPE_RESTRICTED_KEY is not set. The Stripe steps need a restricted key of Stripe test mode; --dry-run and --workos-only need none. |
| `STRIPE_RESTRICTED_KEY=rk_live_…` | none | 2 | STRIPE_RESTRICTED_KEY is a live key. The probe runs in Stripe test mode only; give a restricted test key (rk_test_). |
| `STRIPE_RESTRICTED_KEY=sk_live_…` | none | 2 | The same message. |
| `STRIPE_RESTRICTED_KEY=sk_test_…` | none | 2 | STRIPE_RESTRICTED_KEY is a secret key. Give a restricted test key (rk_test_) with the permissions of the record. |
| No `STRIPE_PRICE_ID` | `--steps test-clock` | 2 | STRIPE_PRICE_ID is not set. The Stripe steps need the ID of the metered monthly price on the meter "User Seat Count". |
| `STRIPE_PRICE_ID=prod_…` | `--steps test-clock` | 2 | STRIPE_PRICE_ID must be a Stripe price ID: price_ and letters or digits. |
| No `WORKOS_API_KEY` | `--workos-only` | 2 | WORKOS_API_KEY is not set. Run the probe through the WorkOS Staging launcher, ~/.config/thermus/with-workos-staging.cjs. |
| `WORKOS_API_KEY=sk_live_…` | `--workos-only` | 2 | WORKOS_API_KEY is a production key. The probe runs in the WorkOS Staging environment only. |
| `WORKOS_CLIENT_ID` of Production | `--workos-only` | 2 | WORKOS_CLIENT_ID names the client of the WorkOS Production environment. The probe never touches it; run it through the Staging launcher. |
| `cleanup` with another step | `--steps cleanup,checkout` | 2 | --steps cleanup runs alone: it deletes the objects of earlier runs. |
| `--workos-only` with `--steps` | `--workos-only --steps seat-sync` | 2 | --workos-only runs only the WorkOS part of seat-sync, so it takes no --steps. |
| The sweep with `--keep` | `--steps cleanup --keep` | 2 | --steps cleanup deletes objects, so it takes no --keep. |
| An unknown step | `--steps portal` | 2 | --steps names unknown steps: portal. The steps are seat-sync, checkout, webhook, test-clock, cleanup. |

- Real mode ran against a stand-in for the Stripe and WorkOS APIs and the
  Stripe CLI: a local HTTP server, a preload that sent the calls of the SDKs
  for `api.stripe.com` and `api.workos.com` to it, and a stand-in `stripe`
  command on the `PATH`. The stand-in models the documented behavior that
  the probe relies on, with a WorkOS seat sync that reports the active count
  to the meter after 1.5 s, an operator who completes Checkout after two
  reads, an invoice that bills the last meter value of the period, and a
  retry schedule of three retries, 3 days apart, then a cancellation. These
  runs measure nothing about Stripe or WorkOS. They show that each assertion
  can fail and that the cleanup runs. The run with all steps passed with exit
  code 0, made 30 writes and 55 reads, and removed 12 objects. No output of any run held
  a key, the signing secret, or a bearer token.

| Change in the stand-in | Options | Exit code | Result |
| --- | --- | --- | --- |
| None | none | 0 | Each step and the cleanup passed. |
| None | `--workos-only` | 0 | Pass: "WorkOS accepted the stripe_customer_id … without the Stripe add-on"; 1, 2, and 1 active memberships. The cleanup removed 3 objects. |
| WorkOS refuses `stripe_customer_id` with `422` | `--workos-only` | 0 | Pass: "WorkOS refused the stripe_customer_id … (read back: absent)". |
| The same | `--steps seat-sync` | 1 | `FAIL Seat sync`: "PUT /organizations/… answered HTTP 422". The cleanup removed 2 objects. |
| The meter shows one seat too many | `--steps seat-sync` | 1 | `FAIL Seat sync`: "Timed out after 300 reads every 2 s waiting for the meter to show 1 for cus_… Values seen: no summary, 2." The cleanup removed 3 objects. |
| The price is licensed | `--steps test-clock` | 1 | `FAIL Preflight`: "… does not have: usage_type metered", and no write. |
| The meter aggregation is `sum` | `--steps seat-sync` | 1 | `FAIL Preflight`: "… does not have: default_aggregation last". |
| The price answer is in live mode | `--steps test-clock` | 1 | `FAIL Preflight`: "… answered with a live-mode object. The probe stops: it runs in Stripe test mode only." |
| The tax settings are `pending` | `--steps checkout` | 1 | `FAIL Preflight`: "Tax settings does not have: status active". |
| The portal allows quantity updates | `--steps checkout` | 1 | `FAIL Preflight`: "… does not have: no quantity update". |
| The CLI is not signed in | `--steps webhook` | 1 | `FAIL Preflight`: "stripe listen --print-secret gave exit code 1 and no signing secret: You have not configured API keys yet …". |
| The key lacks the customer permission (`403`) | `--steps checkout` | 1 | `FAIL Preflight` with the permission that the answer names and the key as `<key>`. `FAIL Cleanup`: "removed 0 objects; none is left. The search for other objects of this run failed …". |
| The key lacks the Checkout permission (`403`) | `--steps checkout` | 1 | `FAIL Checkout`: "POST /v1/checkout/sessions answered HTTP 403 …". The cleanup removed the customer. |
| The session completes without accepted terms | `--steps checkout` | 1 | `FAIL Checkout`: "… does not have: consent.terms_of_service accepted". The cleanup removed 3 objects. |
| The subscription item has a quantity | `--steps checkout` | 1 | `FAIL Checkout`: "Subscription of the session does not have: no quantity on the item". |
| The operator never pays | `--steps checkout` | 1 | `FAIL Checkout`: "Timed out after 180 reads every 5 s waiting for the operator to complete the Checkout Session cs_test_…". The cleanup expired the session and deleted the customer. |
| The operator never pays, and `SIGINT` comes 1 s after the URL | `--steps checkout` | 1 | `FAIL Checkout: Stopped by SIGINT`. The cleanup expired the session and deleted the customer. |
| `stripe trigger` fails | `--steps webhook` | 1 | `FAIL Webhook`: "stripe trigger failed: Trigger failed: Request failed, status=400 …". |
| The CLI signs with another secret | `--steps webhook` | 1 | `FAIL Webhook`: "No matching delivery within 60 s", with both forwarded events refused with `400`. |
| The invoice bills twice the seats | `--steps test-clock` | 1 | `FAIL Test clock`: "Invoice of the first period does not have: subtotal 3000: 3 times 1000". |
| The meter event is refused | `--steps test-clock` | 1 | `FAIL Test clock`: "POST /v1/billing/meter_events answered HTTP 400 …". |
| The clock reports `internal_failure` | `--steps test-clock` | 1 | `FAIL Test clock`: "The test clock … stopped with the status internal_failure". |
| The subscription stays `past_due` after the retries | `--steps test-clock` | 1 | `FAIL Test clock`: "The subscription stayed past_due 65 days after the first failed payment. Set Billing > Revenue recovery > Retries to cancel the subscription after the last retry." |
| None, with `--keep`; then a second run; then the sweep | `--steps checkout --keep`; `--steps checkout`; `--steps cleanup` | 0; 1; 0 | Kept 3 objects. Then `FAIL Preflight`: "Objects of earlier runs exist: Stripe customer …". Then `PASS Sweep`: the customer was removed; deleting it canceled the kept subscription. |
| A read by ID shows the organization for 5 s after its `DELETE` answer, as WorkOS Staging did | `--workos-only` | 0 | `PASS Cleanup`: "removed 3 objects; none is left; gone only at a later read: WorkOS organization org_… at read 4, 6.0 s after the deletes". Before the fix: exit code 1, `FAIL Cleanup` with "Objects left: 1". |
| The same | `--steps seat-sync` | 0 | `PASS Cleanup`: 4 objects removed; the organization was gone at read 4. |
| The same | `--workos-only --keep`; `--steps cleanup` | 0; 0 | Kept 3 objects. Then `PASS Sweep`: 3 objects removed; the organization was gone at read 4. |
| WorkOS refuses the organization delete with `403` | `--workos-only` | 1 | `FAIL Cleanup` after 0.3 s: "Delete these objects by hand … DELETE /organizations/org_… answered HTTP 403 …". |
| WorkOS answers the organization delete but never deletes it | `--workos-only` | 1 | `FAIL Cleanup` after 60 reads, 119 s: "Delete these objects by hand … WorkOS organization org_…". |

The stand-in, its scenario runner, and the guard runner are in the session
scratchpad, not in the branch. Two stand-in faults found gaps of the stand-in,
not of the probe: the automatic tax flag of a completed session, and the
retrieve of one invoice. The scenario with no customer write permission found
a gap of the probe: the cleanup stopped when its search failed. The cleanup
now removes the remembered objects first, and then fails with the reason. The
first real WorkOS organization check found a second gap of the probe: the
check after the deletes read each object one time. The five scenarios of a
slow or refused organization delete came after it. Before the fix, the probe
failed the three scenarios of a slow delete. After the fix, the run with all
steps, the `SIGINT` scenario, and the 19 scenarios that take less than two
minutes each gave the same results as before. The scenarios of the meter and
of the operator who never pays were not run again; their cleanup removes the
same kinds of objects.

### WorkOS organization check

Run on 27 October 2026 (UTC) in the WorkOS Staging environment, from the
repository root of this branch, after the owner added the origin of this
checkout to the launcher:

```sh
node ~/.config/thermus/with-workos-staging.cjs node --env-file=/Users/tomermayara/git/Thermus/.env.local \
  script/spike/stripe-seat-sync-probe.ts --workos-only
```

The check creates one disposable organization and two users, sets
`stripe_customer_id` to `cus_ThermusSpike` and the last four characters of
the run token, reads the organization back, adds and removes the
memberships, and deletes the users and the organization. The planned calls
are the "Seat sync (WorkOS only)" and "Cleanup" parts of
`--dry-run --workos-only`. Before the runs, that dry run through the launcher
printed `WORKOS_API_KEY: <set>`, and `STRIPE_RESTRICTED_KEY` and
`STRIPE_PRICE_ID` as `<not set>`. No run made a Stripe call.

| Run | Probe | Exit code | Result |
| --- | --- | --- | --- |
| `20261027-130244-e432` | the probe before the cleanup fix | 1 | The preflight and the seat sync passed. `FAIL Cleanup`: the deletes of the two users and of the organization `org_01M5YQ9EY9C3QC60PYW6B5F2TA` answered, but the read right after the deletes still showed the organization. A read 77 s later answered `404` for the organization and both users, and no organization or user with the probe prefix was listed. |
| `20261027-132448-e66f` | the probe with the cleanup fix | 0 | Each step and the cleanup passed. The organization was gone at read 4, 6.6 s after the deletes. |

The report of the second run, as the script printed it:

| Step | Check | Expected | Measured |
| --- | --- | --- | --- |
| Preflight | Objects of earlier runs | none | none |
| Seat sync (WorkOS only) | stripe_customer_id cus_ThermusSpikee66f, Stripe add-on not connected | recorded: accepted or refused | accepted: the answer shows stripe_customer_id cus_ThermusSpikee66f |
| Seat sync (WorkOS only) | stripe_customer_id after a read of the organization | recorded | cus_ThermusSpikee66f |
| Seat sync (WorkOS only) | Add membership 1 | 1 active membership | 1 active membership |
| Seat sync (WorkOS only) | Add membership 2 | 2 active memberships | 2 active memberships |
| Seat sync (WorkOS only) | Remove membership 2 | 1 active membership | 1 active membership |
| Cleanup | Remove WorkOS user user_01M5YRHWQHP9VMSHV98SJ2VJP7 | deleted, canceled, or expired; or already gone | deleted |
| Cleanup | Remove WorkOS user user_01M5YRHX5DA2SDE95QHNW7NMQ1 | deleted, canceled, or expired; or already gone | deleted |
| Cleanup | Remove WorkOS organization org_01M5YRHW7S7V3T6Q09XPQ6T46X | deleted, canceled, or expired; or already gone | deleted |
| Cleanup | Objects left | 0, within 60 reads 2 s apart | 0; gone only at a later read: WorkOS organization org_01M5YRHW7S7V3T6Q09XPQ6T46X at read 4, 6.6 s after the deletes |

| System | Object | ID | Created in | Cleanup |
| --- | --- | --- | --- | --- |
| WorkOS | organization | `org_01M5YRHW7S7V3T6Q09XPQ6T46X` | Seat sync (WorkOS only) | deleted |
| WorkOS | user | `user_01M5YRHWQHP9VMSHV98SJ2VJP7` | Seat sync (WorkOS only) | deleted |
| WorkOS | user | `user_01M5YRHX5DA2SDE95QHNW7NMQ1` | Seat sync (WorkOS only) | deleted |

The run made 10 writes, each answered in 0.13 s to 0.45 s, and 11 reads with
an answer; the count leaves out the `404` answers of the check after the
deletes. The first run made the same writes for the organization
`org_01M5YQ9EY9C3QC60PYW6B5F2TA` and the users
`user_01M5YQ9FH082YD110HC8YBBYA5` and `user_01M5YQ9G1VYSD15RJMCADWMD0A`.

Results:

- Without the Stripe add-on, WorkOS accepts a `stripe_customer_id` that
  names no Stripe customer: the update answered with the fake ID, and a read
  gave it back. So an accepted update does not show that the add-on is
  connected or that the customer exists; the meter of the seat-sync step
  shows whether the add-on sends counts. Whether WorkOS checks the ID when
  the add-on is connected waits for the real run in Slice 3.
- WorkOS showed 1, 2, and 1 active memberships at the first read after each
  change.
- A read by ID can still show a deleted organization for some seconds after
  its `DELETE` answer: 6.6 s in the second run. The users were gone at the
  first read. In the SO-01e setup run, the list call still showed a deleted
  organization while a read by its ID answered `404`. A Thermus flow that
  deletes an organization and then reads it must allow for this lag.
- After both runs, no organization or user with the probe prefix was listed
  in the Staging environment. The environment had two other organizations
  and two other users, which the probe did not touch.

### Measured

Moved to Slice 3 with the real run. The script prints these tables; the
Slice 3 run adds them here as the script prints them.

| Step | Check | Expected | Measured |
| --- | --- | --- | --- |

| Change | Active memberships in WorkOS | Meter value | Delay after the WorkOS answer |
| --- | --- | --- | --- |

| System | Object | ID | Created in | Cleanup |
| --- | --- | --- | --- | --- |

| Step | Call | Status | Duration |
| --- | --- | --- | --- |

### Documentation facts for Slice 3

From the pages above, read on 27 October 2026 (UTC), for SO-13 to SO-15:

- WorkOS sets the seat count meter up and sends the count; Thermus only sets
  `stripe_customer_id`, with the update call. The add-on page names the event
  fields "Customer ID" and "Value" but not their payload keys; the meter
  gives them in `customer_mapping.event_payload_key` and
  `value_settings.event_payload_key`, and the probe reads them.
- Stripe marks Billing Meters "Not Recommended" for a new usage-based
  integration and points to Metronome (Set up a pay-as-you-go pricing
  model). The WorkOS Seat Sync uses a Billing Meter, and D-3 depends on the
  Seat Sync.
- A new subscription is `flexible` by default and has no first invoice for a
  metered item. The first charge comes at the end of the first period, as
  section 4.2 of the plan says.
- Checkout with an existing customer needs `customer_update` `address: auto`
  and `billing_address_collection: required` for the tax location,
  `name: auto` for the tax ID, a terms of service URL in the public details,
  and no quantity on a metered line item.
- Stripe recommends thin events for new integrations ("Use thin events for
  new integrations", Set up events); stripe-node 23.0.0 adds thin
  notifications for subscriptions, such as `V1CustomerSubscriptionUpdatedEvent`.
  The ticket checks snapshot events with `constructEvent`; SO-13 chooses the
  format.
- The signature check alone accepts a repeated event in its tolerance, so the
  event ID table of SO-13 stays necessary. In stripe-node 23, a tolerance of
  0 skips the timestamp check, and 23.0.1 refuses a signing secret of only
  white space (changelog).
- A list call omits the objects of a test clock unless it names a parent,
  such as the subscription (Test clocks: API and advanced usage). A customer
  search lags writes by less than a minute, and "up to an hour" during
  outages (Search customers).
- A deleted customer can still be read, with `deleted: true` (Delete a
  customer). A subscription cancel stops the automatic collection of the
  finalized invoices of the customer (Cancel a subscription).

### Limits

- The real run moved to Slice 3. Only the stand-in exercised the Stripe code
  paths and the meter reads of the seat sync, and it models the pages as the
  probe reads them, so it cannot show the real behavior. The WorkOS
  organization check is the only real run in Slice 1: two runs, one lag
  measurement. The Slice 3 run must answer these points: whether the summary call accepts an `end_time` at the
  next minute boundary, which is in the future; whether the CLI accepts
  `--skip product --skip price` with the price override; whether a meter
  event at the frozen time plus one second counts for a test clock customer;
  whether WorkOS sends a count when the probe sets `stripe_customer_id`; the
  billing reason of the first invoice in flexible mode; and the permissions
  that the key really needs.
- The sweep finds customers by search and test clocks by name. It expires no
  open Checkout Session of an earlier run (a session expires on its own 31
  minutes after its create) and cancels no subscription directly (the
  customer delete cancels it).
- Meter events cannot be deleted; they stay with the deleted customers.
- No step checks Entitlements: the ticket has no criterion for it, and the
  plan reads the tier from PostgreSQL, not from the `entitlements` claim.
- The test clock reports usage in one period only.
- The webhook step uses the secret of the CLI and snapshot events. SO-13 uses
  a Dashboard endpoint and its own secret.
- Under Claude Code, stripe-node 23.0.1 writes one hint line to stderr when
  it loads, and the SDK sends the name of the agent in its user agent
  (`stripe.esm.node.js` of the package). The report on stdout does not
  change.
- Test mode only, one run, and one meter. A membership with only the default
  role is not checked.

## SO-03: private address of the control plane

Date: 27 October 2026 (UTC). Ticket SO-03 of Slice 2 (board ticket 4673f5),
branch `self-ob-s2-so-03-tenant-role-4673f5`. The plan (section 6, SO-03) asks
this ticket to measure the private address of the control plane with a one-off
job from a disposable tenant to `http://<control-plane-slug>:8080/healthz`, and
to fix `CONTROL_PLANE_INTERNAL_URL` from the result (open question 2 of the
ticket). The tenant relays its audit events to that address. SO-01d part two
measured only the opposite direction: a job of a web service to a private
service. No probe had requested a web service through the private network.

Status: measured. `CONTROL_PLANE_INTERNAL_URL` is
`http://<slug of the control plane>:8080`: the `slug` of the control plane
service with the port of the server in the image. From a job of a private
service, the web service answered `200` with `ok` on port 8080 and on port
10000, 76 s after its first deploy was live. 16 s after its first deploy was
live, both ports refused the connection.

The probe of SO-01d part two gained the step `control-plane`, run with
`--steps private,web,control-plane`. The private service plays the tenant and
the web service plays the control plane; both are disposable
`thermus-spike-*` services in the workspace Thermus AI, never the production
service. The step reads the `slug` and the public URL of the web service, waits
60 s, and starts one one-off job on the private service. The job program first
logs the DNS answers of both slugs, then requests `/healthz` at
`http://<own slug>:8080` (a control), `http://<web slug>:8080`,
`http://<web slug>:10000`, and the public URL of the web service (a control).
Only an answer of the web service on the private network passes the step. The
cleanup cancels a job that has not ended on the service that runs it, and
deletes both services. The dry runs of the earlier option sets of SO-01d part
two stay byte-identical to the dry runs of the script on main, and the job
program of the SO-01d run of this record stays byte-identical too.

```sh
node --env-file=/Users/tomermayara/git/Thermus/.env.local script/spike/private-network-probe.ts \
  --owner tea-db8i6ceq1p3s73dev9og --registry-credential ghcr-thermus-hosted-read \
  --image ghcr.io/tomer-mayara/thermus-hosted@sha256:d6b8a8fd3174c02984267f6aef54a7ee4e4bc783776ae9b856685202972dbfbd \
  --steps private,web,control-plane
```

| Step | Given, when, then |
| --- | --- |
| Control plane | Given both services live, when a one-off job on the private service requests `/healthz` of the web service at its slug on port 8080 and on port 10000, then its log lines show at least one `200` with `ok` from the web service. |

### Runs

Two complete runs on the owner's Mac, Node v24.20.0. Each ran the preflight
(no `thermus-spike-*` service of any type) and ended with the full cleanup.

| Run | Start (UTC) | Private service (the tenant) | Web service (the control plane) | Job | First request after the web deploy was live |
| --- | --- | --- | --- | --- | --- |
| 1 | 18:38:47 | `thermus-spike-20261027-183847`, `srv-dbgeveek1f9s73945n00` | `thermus-spike-web-20261027-183847`, `srv-dbgf01fb9u1s73c5hmvg` | `job-dbgf0p942hec738thrc0`, succeeded | 16.5 s (deploy finished 18:41:35.0, request 18:41:51.5); no wait step yet |
| 2 | 18:46:09 | `thermus-spike-20261027-184609`, `srv-dbgf2st9fdbs738677eg` | `thermus-spike-web-20261027-184609`, `srv-dbgf3difngtc738rs0q0` | `job-dbgf4jl9el5s73arfdk0`, succeeded | 76.4 s (deploy finished 18:48:36.9, request 18:49:53.3), with the wait of 60 s |

| Run | Request in the job | Answer |
| --- | --- | --- |
| 1 | `GET http://thermus-spike-web-20261027-183847:8080/healthz` | no answer: `ECONNREFUSED`, "connect ECONNREFUSED 10.12.228.8:8080", after 114 ms |
| 1 | `GET http://thermus-spike-web-20261027-183847:10000/healthz` | no answer: `ECONNREFUSED`, "connect ECONNREFUSED 10.12.228.8:10000", after 5 ms |
| 2 | DNS lookup of `thermus-spike-web-20261027-184609` | `10.15.25.140`, after 8 ms |
| 2 | DNS lookup of `thermus-spike-20261027-184609` | `10.15.67.103`, after 2 ms |
| 2 | `GET http://thermus-spike-20261027-184609:8080/healthz` (own service, control) | `200`, body "ok\n", after 102 ms |
| 2 | `GET http://thermus-spike-web-20261027-184609:8080/healthz` | `200`, body "ok\n", after 7 ms |
| 2 | `GET http://thermus-spike-web-20261027-184609:10000/healthz` | `200`, body "ok\n", after 4 ms |
| 2 | `GET https://thermus-spike-web-20261027-184609.onrender.com/healthz` (public, control) | `200`, body "ok\n", after 147 ms |

The other measured times: the private services were `live` 75.8 s and 67.0 s
after their create calls, the web services 91.9 s and 81.8 s. The public
`/healthz` of the new web service answered `502` one time in run 1 and two
times in run 2 before its `200`, from this machine. Each job started in under
1 s and ran 15 s and 6 s. Writes: 5 in each run, 10 in all: 4 creates, 2 jobs,
and 4 deletes, each delete `204`. A reads-only preflight at 18:50:36 UTC listed
no service named `thermus-spike-*`.

### Findings for Slice 2

- A tenant reaches the control plane at `http://<slug>:8080`, the port of the
  server in the hosted image, as the control plane reaches a tenant at
  `http://<slug>:8080` (SO-01d part two). Port 10000 answered too: the
  [Private Network](https://render.com/docs/private-network) page says that
  port 10000 of a web service always routes to its primary HTTP server. The
  setting uses 8080, the port that the image owns, for both directions.
- The private address of a new web service refused connections for some time
  after its first deploy was `live`: 16.5 s after `live`, both ports refused,
  while its public URL already answered. 76.4 s after `live`, both ports
  answered. The public router of a new web service lags too (`502`, then
  `200`, as in SO-01d). The control plane is a long-lived service, so this
  matters for a new control plane, for example in a rehearsal of SO-12, and
  for the first relays after it; a relay in that window fails and loses its
  event, as the bounded relay accepts.
- The slug of a web service is its `slug` field in the API answer, the same
  name as its public subdomain. The disabled public subdomain of the
  production service does not change this name (plan section 6, SO-03); SO-12
  reads the slug of the production service when it sets the variable.
- In each run, the slug of the web service resolved to one `10.` address,
  another address in each run, as for a private service. The tenant uses the
  name, not the address.

### Limits

- Two runs in one region, with one instance of each service, on
  `0.5c-512mb`. The job runs on its own instance of the private service, not
  on a running tenant: it shows the network path of the private service, not
  the relay code of SO-03.
- The window after a first deploy was measured at two points only, 16.5 s and
  76.4 s. The probe did not measure where it ends, and it did not measure the
  private address during a later deploy of a live web service.
- The production service was not read: its slug, and the private network of a
  service with a custom domain and a disabled subdomain, stay unmeasured.
- The services ran with the placeholder WorkOS values of SO-01c, so the web
  service was a control plane without real WorkOS settings.

## SO-02: release path on each merge to main

Date: 27 October 2026 (UTC). Branch `self-ob-s2-so-02-release-workflow-1d4667`,
from main `77477864`. The workflow and the deploy script of the runs are those
of commit `a0f94659`; the later commits of the branch change documents only.

[`hosted-image.yml`](../../.github/workflows/hosted-image.yml) keeps the build,
the gate, and the push of [SO-01b](#so-01b-hosted-image-on-a-native-amd64-runner)
and adds two things, as the answers of 27 October 2026 decided:

- The trigger `push` on `main`. Each merge builds, gates, and pushes by
  digest, and deploys nothing. The build job has no concurrency group, so a
  newer merge cannot cancel the pending build of an earlier one. The record
  table names the event and the ref of the run.
- The deploy job, only for a manual dispatch with the inputs `digest` and
  `service_id`, and `confirm_production` for the production service. It runs
  [`deploy-hosted-image.ts`](../../script/release/deploy-hosted-image.ts):
  first the request check, which makes no call, then the GHCR check of the
  digest, then the Render API deploy with `imageUrl`, the wait for `live`, the
  image check, and `/healthz`. [Hosted release](../../README.md#hosted-release)
  gives the rules.

### Runs

The digests: D1 `sha256:9c034b74b8a55c3faeb61c8ea6f063334e2e3fe78b0493b6530ed2e7008402e8`
(commit `a0f94659`) and D2
`sha256:3a9beb582cceb154b17dd8cbb248c06305ee9c704344021f24f36fe4d5a3a304`
(throwaway commit `1ba8a4f0`). Each is 154.7 MB (147.6 MiB) compressed, in 16
layers, `linux/amd64`. Neither is a release digest.

| Run | Commit and event | Result | Times |
| --- | --- | --- | --- |
| A, [40582338941](https://github.com/tomer-mayara/Thermus/actions/runs/40582338941) | `a0f94659`, the candidate; dispatch without inputs | Passed: build, gate 7 of 7, push of D1, and record. The deploy job was skipped. | Build 370 s, gate 12 s, push 15 s; job 8 min 26 s |
| B, [40582429843](https://github.com/tomer-mayara/Thermus/actions/runs/40582429843) | `ed4817e7`, throwaway branch `so-02-failing-gate`; dispatch without inputs | The build failed at the deliberate unit test: backend units 3,353 of 3,354. The gate, login, push, and record steps were skipped, and the deploy job was skipped. | Build step 3 min 51 s; job 6 min 0 s |
| C, [40582571919](https://github.com/tomer-mayara/Thermus/actions/runs/40582571919) | `a0f94659`; dispatch with a digest of zeros, `service_id` the production service, no `confirm_production` | The request check failed with two errors: the run is not on `main`, and the production service needs `confirm_production`. The GHCR and deploy steps were skipped, and the build job was skipped. | Job 17 s |
| D, [40582508603](https://github.com/tomer-mayara/Thermus/actions/runs/40582508603) | `1ba8a4f0`, throwaway branch `so-02-deploy-check`; push | Passed: build, gate 7 of 7, push of D2, and record. The deploy job was skipped. | Build 356 s, gate 13 s, push 15 s; job 8 min 11 s |
| G, [40583680586](https://github.com/tomer-mayara/Thermus/actions/runs/40583680586) | `1ba8a4f0`; dispatch with a digest of zeros and the disposable service | The request check passed. The GHCR check failed with "not found", and the deploy step was skipped. | Job 23 s |
| E, [40583851233](https://github.com/tomer-mayara/Thermus/actions/runs/40583851233) | `1ba8a4f0`; dispatch with D1 and the disposable service | Passed: GHCR check, deploy `dep-dbgh4l59el5s739oujgg` (`update_in_progress` > `live`), D1 in the live deploy and in `imagePath`, and `/healthz` `200` with `ok` at the first request. | Live 29.6 s after the deploy call; Render: 22.4 s; deploy step 30 s; job 60 s |

In runs A and D, `npm run build:hosted` in the image build passed backend
units 3,353 of 3,353, portal units 31 of 31, portal acceptance 20 of 20,
integration 1,169 of 1,169, the selected acceptance and interface files 123
of 123, and the renderer gate 13 of 13. The hosted image gate passed 7 of 7.
No test failed, was cancelled, was skipped, or was todo. The gate wrote
"Reused the caller-built image" with the tag of the run. Each run used the
GitHub-hosted image `ubuntu-24.04` version 20261012.334.1, with 2 CPUs,
7,938 MiB of memory, 12 GB of free disk of 72 GB, and Docker Engine 28.0.4.

GitHub reads the trigger `push` on `main` and the branch rule of the deploy
only on `main`, so they run for the first time at the merge. Before the merge,
the throwaway branch `so-02-deploy-check` stood in for `main` with one
temporary commit of two lines: `branches: [main, so-02-deploy-check]` in the
trigger, and `refs/heads/so-02-deploy-check` as the release ref in
[`deploy-request.ts`](../../script/release/deploy-request.ts). Run C shows the
rule of the candidate: a deploy request from another branch stops at the
request check. Both throwaway branches were deleted after their runs.

### Disposable service

The service came from the SO-01c create call, through the web step of the
[SO-01d part two](#part-two-render-private-network) probe, with the owner's
local key and the registry credential `ghcr-thermus-hosted-read`
(`rgc-dbg1h0142hec73da9ra0`). Before any call, the probe refused
`--owner tea-d3mlbrvdiees73ca4rdg` and `--web-service-id srv-db8mnqg473hc739d529g`
with exit code 2; the network blocker preload saw no outbound attempt.

| Time (UTC) | Step | Result |
| --- | --- | --- |
| 21:01:38 | Preflight, reads only | No service named `thermus-spike-*` of any type. |
| 21:01:45 | Create, `--steps web --keep`, image `sha256:d6b8a8fd…` of main `9a3ac1f9` | `thermus-spike-web-20261027-210145` (`srv-dbgh2evf3r2c73ejo0fg`), `0.5c-512mb`, oregon: `201` after 2.9 s. The first deploy `dep-dbgh2fff3r2c73ejo1t0` was `live` 79.9 s after the create call (Render: 70.8 s). The public `/healthz` answered `502` and then `200` with `ok` at the second request. `Ratelimit-Remaining` 19 of 20 creates. |
| 21:04:51 to 21:06:59 | Runs G and E | See the table above. |
| After run E | Read only, with the SO-01c client and writes refused | `imagePath` D1. Two deploys: `dep-dbgh4l59el5s739oujgg`, `live`, trigger `api`, image D1; `dep-dbgh2fff3r2c73ejo1t0`, `deactivated`, trigger `manual`, image `sha256:d6b8a8fd…`. So runs C and G started no deploy. |
| 21:07:56 | Check and delete, `--web-service-id` without `--keep`, image D1 | The last deploy was `live`, the image setting held D1, and `/healthz` answered `200` with `ok` at the first request. `DELETE` `204` after 0.4 s; no service named `thermus-spike-*` 0.3 s later. |
| 21:08:04 | Preflight, reads only | No service named `thermus-spike-*` of any type. |

Writes in the Thermus AI workspace: 1 create and 1 delete with the owner's key,
and 1 deploy with the key of the dedicated Render user, from run E. One
disposable service of the two allowed.

### Checks before the runs

These checks used scripts in the session scratchpad, not in the branch:

- The request rules, in `check` and `deploy` mode, with the network blocker
  preload: 13 cases passed, with no outbound attempt. Among them: another
  branch, the production service without, with another, and with the right
  `confirm_production`, `confirm_production` for another service, empty and
  malformed inputs, and `deploy` without `RENDER_API_KEY`.
- The `deploy` mode against a stand-in for the Render API, a module that
  replaced `fetch` in the process: 12 scenarios passed. A `201` and a `202`
  answer, a `502` and then `200`, a verified custom domain with a redirect
  domain beside it, a deploy that ends as `update_failed`, `/healthz` `404`,
  six `502` answers, an image setting that does not change, a private
  service, a `docker` runtime, a suspended service, and another workspace. The
  last four got no deploy call. No output held the key, and the health
  requests had no `Authorization` header. The stand-in measures nothing about
  Render.

### Findings

- The API deploy with `imageUrl` on an image-backed web service had the
  trigger `api`, reached `live` 29.6 s after the call, and changed `imagePath`
  to the deployed digest, as on the private service of SO-01c.
- The existing web service answered `/healthz` at the first request after the
  deploy. The new web service answered `502` once before `200`, as in SO-01d
  part two, so the repeat after a `502` stays.
- The image build took 356 and 370 s, against 472 to 490 s in SO-01b; the
  push took 15 s. A merge run takes about 8 to 9 minutes.

### Limits

- The trigger `push` on `main` and the branch rule of the deploy run for the
  first time at the merge; the pull request records that first run.
- No deploy reached production. The rule for `confirm_production` and the
  health URL on a custom domain ran only in the local checks and the
  stand-in. Step 5 of the SO-12 order is their first real use. The production
  service builds from Git (runtime `docker`), and the deploy job refuses a
  service whose runtime is not `image`.
- There is no GitHub environment, so a workflow on any branch of the
  repository can read `RENDER_API_KEY`. The branch rule is in the workflow and
  the script of the dispatched ref.
- The deploy job takes each digest that GHCR has, also the image of a branch
  build. The operator chooses a release digest.
- The session cannot list the GHCR versions: its token has the scopes `repo`,
  `workflow`, `gist`, and `admin:org`, not `read:packages`. The record step of
  each run names its digest, and the skipped push steps show that runs B, C,
  and G pushed nothing.
- One run of each path, one region, and one disposable service.

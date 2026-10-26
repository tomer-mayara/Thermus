# Self on-boarding Slice 1 evidence

This record keeps the evidence of the Slice 1 tickets of the self on-boarding
plan ([PR #259](https://github.com/tomer-mayara/Thermus/pull/259)). Each ticket
or probe adds one section: what ran and where, the durations and limits, and
what a client saw. The record holds no secret.

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

## SO-01d: gateway proxy and private network

Date: 26 October 2026. Branch `self-ob-s1-so-01d-gateway-proxy-probe-012463`,
on the SO-01b branch at `6fcfe3fb`. Part one is a local probe. Part two needs
the private service of SO-01c.

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

Run 1 of 5, on 26 October 2026, on the owner's Mac (Darwin 27.0.0) at commit
`506e88ed`. The table and the conclusions are as the script printed them. The
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
  client source). The probe does not test that era.
- No compressed answer, no large body, no slow reader, and no calls at the same
  time. SO-01e measures the capacity. The proxy forwards only `POST /mcp` and
  answers `404` to other requests.

### Part two: Render private network

This part waits for SO-01c. When the private service of SO-01c is live, the
operator starts a disposable web service from the same image, in the same
workspace and region. The operator opens a Render shell on the web service and
requests `/healthz` at the internal address of the private service. The answer
must be `200` with `ok`. From the public internet, the internal address must
not resolve. The transcript of that check goes here.

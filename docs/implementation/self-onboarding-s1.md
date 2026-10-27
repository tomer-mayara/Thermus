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
  client source). The probe does not test that era.
- No compressed answer, no large body, no slow reader, and no calls at the same
  time. SO-01e measures the capacity. The proxy forwards only `POST /mcp` and
  answers `404` to other requests.

### Part two: Render private network

Date: 27 October 2026 (UTC). Pull request
[#271](https://github.com/tomer-mayara/Thermus/pull/271), branch
`self-ob-s1-so-01d-private-network-012463`, from main `9507e751`. The final
run used the script of commit `eb3f920c`.

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

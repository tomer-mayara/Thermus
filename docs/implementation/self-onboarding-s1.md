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

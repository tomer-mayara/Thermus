# S2.5-R1 local environment facts

Read-only observation: 2026-10-25, about 15:50-15:56 America/Denver. This file
records local prerequisites and a proposal. It does not authorize or claim a VM,
container, build, gate, metrics run, or cleanup by this worker.

## Available prerequisites

| Item | Observed result |
| --- | --- |
| Node | Direct Node and `pnpm exec node`: `v24.20.0` |
| pnpm | `12.10.1` |
| Dependencies | `node_modules` exists; final frozen install still needs evidence |
| OpenSSL | Homebrew OpenSSL 3.6.3; executable in PATH |
| Git | `/usr/bin/git` |
| Lightpanda asset | Executable `.cache/lightpanda/1.0.0/lightpanda`, 90,354,360 bytes; no renderer run performed |
| Chromium | Playwright resolves cached Chromium 1248 for macOS ARM64; executable exists |
| Axiom | The prior checkout's `.env.local` exists; required key and endpoint are nonempty; dataset setting is permitted; no values printed |
| WorkOS | Keychain launcher exists; process-only boolean probe succeeded for staging key prefix, key, client ID, issuer; no values printed |
| WorkOS origin | Launcher allowlist accepts the preserved `https://github.com/3-headed-monkey/Thermus.git` alias |
| Live ports | No listener on TCP 46443 or 46480 at observation time |
| Host disk | 460 GiB volume; 399 GiB used; about 20 GiB available; 96% capacity |
| Host memory | 16 GiB physical RAM; current pressure depends on other work |
| Colima base image | Prior aarch64 compressed image remains cached, about 317 MiB |

The availability probe did not call WorkOS or establish the provider's saved
password/MFA/redirect/Connect settings. The real gate must run its preflight.
No network reachability probe, image pull, install, or browser launch ran here.

## Shared Docker state

- Active global context is `colima`, socket
  `/Users/tomermayara/.colima/default/docker.sock`. Only the default profile
  exists. The earlier `thermus-s25-02` profile and context are absent.
- Docker server 29.5.2; Buildx 0.38.0 and Compose 5.6.0 are installed.
- Default profile: VZ, aarch64, 4 CPUs, 4 GiB RAM, 25 GiB data disk.
- `df` in that VM reported 19 GiB used and 4.4 GiB available (82% used).
  Guest memory showed about 2.1 GiB available and no swap.
- Six unrelated services are running. Preserve all of them. At the first
  inventory there were also two active Thermus self-hosted-gate containers.
  Soon after, process inventory showed another checkout,
  `/Users/tomermayara/.codex/worktrees/5c73/Thermus`, building its hosted image
  with `docker build --platform linux/amd64`.
- This session observed six Docker volumes, all active, rather than the
  historical 224-volume count in the handoff. This discrepancy gives no cleanup
  authority. Preserve every current shared volume, image, service, and builder.
- `docker system df`: 16 images, 19.53 GB apparent image size; 138 build-cache
  records, 12.46 GB apparent size. Shared layers make these totals unsuitable
  for estimating free filesystem space. Use the guest `df` result.
- The active Buildx listing advertises `linux/arm64, linux/386`. The guest's
  Rosetta binfmt handler is enabled with OCF flags. Thus the listing alone does
  not prove that AMD64 execution is unavailable. The other checkout is already
  using the AMD64 image path. Do not install handlers or alter its builder.
- The `default` builder points to unavailable `/var/run/docker.sock`. Do not
  repair global builder selection for this repair task.

## Proposed isolated local profile

The smallest safe isolation path is a new profile owned only by this task,
`thermus-s25-r1`, with explicit per-command context. It avoids the busy shared
engine, shared build cache pressure, and global context changes. No cloud cost
is involved. Do not create it until the coordinator starts the gate phase and
rechecks disk/memory headroom. A second 3 GiB VM alongside the existing 4 GiB VM
leaves about 9 GiB physical memory for macOS, applications, and test processes;
run heavyweight builds sequentially. About 20 GiB host free is adequate only
with monitoring and task-owned cleanup. It is not room for an unrestricted
cache or several simultaneous image builds.

Proposed command, not executed:

```sh
colima start thermus-s25-r1 --activate=false --arch aarch64 --vm-type vz --vz-rosetta --cpus 2 --memory 3 --disk 10
```

The previous startup log `.cache/s25-02/disposable-docker-start.log` proves
VZ/aarch64, Rosetta, amd64 binfmt, and a 10 GiB data disk. That log does not
retain the original shell command or CPU/RAM arguments. The command above is
an explicit equivalent proposal; its CPU/RAM values are chosen for current
host capacity, not copied from an unrecorded prior command. Local `colima start
--help` confirms every flag, including `--activate=false`.

After creation, read back the profile, context socket, guest disk, binfmt, and
Buildx state. Require the owned context to exist and global `docker context show`
to remain `colima`. Use only the profile's built-in builder. Do not run a
privileged binfmt installer on the shared engine. If the new profile does not
support the actual AMD64 image build/runtime, stop that gate and record setup
failure; investigate only inside the owned profile.

Every Docker-using command, including PostgreSQL, Collector, staging removal,
self-hosted container, hosted image, inventory, and owned cleanup, must use:

```sh
env -u DOCKER_HOST -u DOCKER_TLS_VERIFY -u DOCKER_CERT_PATH -u BUILDX_BUILDER DOCKER_CONTEXT=colima-thermus-s25-r1 <command>
```

Do not use `docker context use`. Recheck `df -h .` and
`colima --profile thermus-s25-r1 ssh -- df -h /var/lib/docker` between costly builds.
The PostgreSQL and Collector images may need fresh network pulls in this new
engine. Reuse the host's existing Colima base and Lightpanda assets; do not copy
unrelated shared caches. The native and AMD64 builds have different layers.
The prior 10 GiB profile ran both image gates successfully, but a new candidate
can consume more space. Stop before exhaustion; retain logs and inspect exact
task-owned resources. A larger disk or shared cleanup is not an automatic retry.

Gate cleanup must stay within each test's exact run labels/names in the owned
context. Once all evidence is retained and no test uses the profile, the
coordinator can remove only this newly created task-owned profile and its data.
No cleanup was performed by this worker. The prior cleanup evidence is
`.cache/s25-02/review/docker-isolation-cleanup.json`: it removed only
`thermus-s25-02` and explicitly preserved the shared services and volumes.

## Concrete blockers and next path

1. The source worker is still changing R1 source/tests. Full candidate gates
   must wait for stable bytes; its fast focused tests can continue now.
2. Shared Docker has active work and only 4.4 GiB free. Do not schedule this
   repair's large builds there. Use the proposed owned profile with explicit
   context after capacity read-back. No contact with the other chat is needed.
3. Fresh source makes prior full gates and coverage historical. Run the selected
   sequence in `test-selection.md` on the complete repaired candidate; retain
   new failures and retries. Old green logs do not remove this requirement.
4. Host disk is tight. Recheck free space before profile creation and between
   image builds. Preserve all shared resources. If the owned profile cannot
   finish within current space, report the exact remaining gate and owned usage.

No credential blocker was found. No service was stopped, resource deleted,
global context changed, paid resource created, or gate run by this worker.

# Read-only Buildx history fallback

The running native container gate uses `docker build --quiet` in `test/support/container/container-gate.ts:41`. Its wrapper log preserves the streams that Docker emits; quiet mode does not provide full build-phase output. Do not describe that file as complete phase evidence.

The hosted image gate uses `docker build --platform linux/amd64 --progress=plain --file Dockerfile.hosted ...` in `test/support/container/hosted-image-gate.ts:76`. Its wrapper log should contain the nested `npm run build:hosted` phase output. The manager must inspect that actual completed log and bind its hash. No fallback extraction or duplicate log is needed when that log contains the required evidence.

No build, gate, argument, wrapper, Docker context or builder was changed during this investigation. Local CLI help confirms the following read-only commands. Use the owned context and builder explicitly:

```sh
/opt/homebrew/bin/docker --context colima-thermus-pr251-r2 buildx history ls --builder colima-thermus-pr251-r2 --no-trunc --format '{{json .}}'
/opt/homebrew/bin/docker --context colima-thermus-pr251-r2 buildx history inspect --builder colima-thermus-pr251-r2 SHORT_BUILD_ID --format json
/opt/homebrew/bin/docker --context colima-thermus-pr251-r2 buildx history logs --builder colima-thermus-pr251-r2 --progress plain SHORT_BUILD_ID
```

Select the completed hosted record by `Dockerfile: Dockerfile.hosted`, the source gate `VCSRevision: fd7fa0b1e53d653f92168b75ba4d65618a9138a8`, its start time, and the hosted gate label. Check the completed status before reading the complete history log. The short ID is the last segment of the list's `ref`. Do not use `^0` because another build can become latest. Do not select a self-hosted Dockerfile record as hosted evidence.

Discovery observed the first native build as running with short ID `drgvpwel0g04kg1y0y182vazb`, Dockerfile `Dockerfile`, gate label `thermus.container-gate=9bdfa24c`, and source revision `fd7fa0b1e53d653f92168b75ba4d65618a9138a8`. This observation is not a completed build or test result. No history log was extracted.

The initial read-only inspect using the full list ref `colima-thermus-pr251-r2/colima-thermus-pr251-r2/drgvpwel0g04kg1y0y182vazb` returned `no record found`; the short ID worked. This is a discovery-command failure, not a test or build failure. A separate read-only `buildx ls` noted an unrelated unavailable default socket; the owned builder was running. These discoveries do not change the selected gates or their results.

If the completed hosted wrapper stream lacks required output, the history command can supply the missing phase evidence without another build. Save that output once, record the exact command, short build ID, inspected revision/status, timestamps, exit and hash, then add the reviewed filename to the explicit publication log allowlist before inventory approval. The current helper deliberately rejects an unlisted root log. Keep earlier genuine gate failures and retries separate from read-only discovery results.

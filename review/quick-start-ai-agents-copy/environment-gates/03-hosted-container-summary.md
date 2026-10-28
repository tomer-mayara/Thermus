# AI Agents copy: final AMD64 image gate

Base: cc2ed669d6821525e23c6ff3d6ddcdc6339862bd
Primary HEAD at report: 0445dfa6e566bf99155a6bf8f4e65c7619b3c322
Original two-file overlay SHA256: e21a565e25f38351bd5ba41b7b7678323bbe4695632de2e7665d9b67216eb69c

Command: npm run test:container:hosted
Result: exit 0; 7/7 tests passed; zero failures, cancellations, skips or todo cases; 786143.649917 ms. First attempt, no retries.

This is the actual final Linux AMD64 image proof, including public HTTPS and controlled JavaScript rendering, private-address guards, capacity, cancellation, SIGTERM, protected runtime routes and invalid startup. The image build also passed its selected offline checks: 3693 unit + 39 portal unit + 21 portal acceptance + 1219 integration + 189 hosted acceptance + 13 real local renderer tests. The normal inner build runs are part of this selected image gate; no extra group was dispatched. Final image manifest: sha256:a4c8d6d488aa1db523296c46920c5e932131c3f95b1f6a6c250a92a7ffe30352.

The manager's frozen quick-start-content.ts and matching approved guide were overlaid exactly in the managed quick-start-copy-image checkout at the pinned base. Original per-file, package/lock, npmrc, Docker build/config and root impact hashes are retained in 03-hosted-container-provenance.json; the exact original patch is 03-image-overlay.patch. Final comparison verifies both source and guide still match primary byte-for-byte, and package/lock/npmrc/Docker inputs are unchanged. The only production/test/runtime-path delta from base is quick-start-content.ts; no test/helper/auth source changed. The root impact declaration changed only as the manager anticipated; its original/current hashes and exact metadata diff are retained, without replacing the original executed image provenance.

Actual Node24.20.0 and verified Lightpanda1.0.0 were selected; dependencies were shared through a temporary isolated node_modules symlink with exact package/lock inputs. No broad .env file, Axiom key, WorkOS key or live credentials were loaded. The safe runner passes only expected shell/tool/renderer settings and redacts API-key/JWT-shaped values before logs are saved.

The gate used its own random Docker names/ports and label. No deadline, assertion, network guard or configured bound changed. Hosted-live was not selected or run: authentication, WorkOS flows and live helpers are unchanged. No production settings, global tools, Docker configuration, deployment, registry push, source commit or PR was changed by this worker.

Full outer log/JSON, inner build-progress log, original provenance and final candidate comparison are retained under the requested prefix. Test-owned containers and image cleanup belong to the gate. The isolated dependency symlink is removed after completion; primary dependencies stay in place. The manager can archive the managed worktree after these safe artifacts are retained.

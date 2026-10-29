# Final Linux AMD64 hosted image gate

Candidate: 8eb8d34519bd9aa0e2541bf3ad79f0ca8ad84ac0
Base: 21458b0d18cc4f9efd3a59f6361a86f1acdc317c

## Final result

The complete unchanged command `npm run test:container:hosted` passed on the one manager-authorized retry: exit 0; 7 tests passed; zero failures, cancellations, skips or todo cases; 672180.6965 ms. The actual final Linux AMD64 image passed public HTTPS and controlled JavaScript rendering, protected routes, network guards, capacity, cancellation, SIGTERM and invalid startup proofs. Its fresh inner build passed 3,693 unit, 39 portal unit, 21 portal acceptance, 1,219 integration, 189 hosted acceptance and 13 real local renderer cases. No previous pass or caller-built passing image was substituted.

Final image manifest: sha256:3b93856f7c840093d97f96800fb37122c92aaa3f1249c61a84fd8f2a0a191804.

## Failure and retry history

Attempt 1 exited 1 before image assembly/runtime: the outer gate had zero passes and one failure. Inner unit/portal groups passed; integration had 1,218 passes and one failure, with zero cancellations or skips. The unchanged refused-loopback JWKS test expected error name TypeError but received JWKSTimeout. The case took 431.857417 ms with its existing 100 ms timeout. This was an offline local fixture, not a live WorkOS request. A transport-versus-timer race under shared-host/emulation load is the supported inference, not a reproduced root-cause proof.

The manager reviewed the exact test and passing native/coverage integration runs, confirmed heavy primary jobs had finished, and authorized one complete unchanged retry. Attempt 2 passed the same refused-port assertion in 12.433833 ms with the same timeout and expected error, then passed the complete gate. No source, Dockerfile, assertion, deadline, network guard or configured bound changed. No further retry ran.

The full first-failure logs, JSON, provenance, overlay, historical failure note and original hash manifest remain byte-for-byte under `attempt-1/`. That note predates retry authorization; this summary states the current result. Fresh second-attempt artifacts and their own manifest are under `attempt-2/`. Original first-attempt root files were also retained. Canonical final hashes are in `03-final-artifact-sha256.json`.

## Final candidate compatibility

The manager confirmed candidate 8eb8d34519bd9aa0e2541bf3ad79f0ca8ad84ac0; primary git status is clean. Its complete committed delta contains only the frozen source and guide, the root impact declaration, and `docs/metrics/2026-10-28-21458b0d.json`. All runtime, test, script, package, lock, Docker and TypeScript build inputs match the base plus the tested frozen source change. The refused-port test also matches the immutable base exactly. The impact declaration and immutable metrics record are nonruntime metadata; they do not establish a new image execution. Exact comparisons and hashes are in `03-hosted-container-final-comparison.json`.

Source SHA256: e90e4ec93542c04ef770409faa84c54a1f350e57619b8972c5688d30f2e28ab9.
Guide SHA256: 0c3220c3e928bf32f996711b6fe399c0a1e4c6810ab049b7efe67512a500ea1b.
Original two-file overlay SHA256: cc221ae49bd7f488481dfc0c82c5e7cd1eb93ca103b7bec5dd89265e0f5ebaff.

## Runtime and cleanup

The runs used actual Node 24.20.0 and checksum-verified Lightpanda 1.0.0. No broad environment file, staging launcher or live gate ran. New runner/build logs were sanitized before retention. No test-owned containers remain under either gate label. Only this worker's isolated dependency symlink was removed; primary dependencies remain in place. The manager confirmed the candidate and authorized archive after evidence retention. The managed image-gate checkout was archived after evidence retention and manager confirmation; its archived attachment was verified. No candidate source fix or commit, push, PR, deployment, image publication or global configuration change was made by this worker.
